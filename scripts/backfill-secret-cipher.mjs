// 1회성 백필: 기존 비공개(owner_private/embargo/work) 이벤트의 평문 본문을 암호화해
// events.secret_cipher로 옮기고, 평문 컬럼은 플레이스홀더로 바꾼다. 평문 private_meta는 삭제.
//
// 사용: node scripts/backfill-secret-cipher.mjs            (실제 적용)
//       node scripts/backfill-secret-cipher.mjs --dry-run  (변경 없이 미리보기)
//
// 멱등: secret_cipher가 이미 있는 행은 건너뛴다. 공개 이벤트는 절대 건드리지 않는다.
// 배포 순서: 0045 마이그레이션 적용 → 리더 코드 배포 → 이 스크립트 실행.
//
// ⚠ 암호화 상수(HKDF info/salt, IV 길이, 'v1$' 포맷)는 lib/private-layer/secret-crypto.ts와
//   반드시 동일해야 한다. 단일 출처는 secret-crypto.ts. 시작 전 encrypt→decrypt 셀프체크로 검증한다.
import { readFileSync } from "node:fs";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { Client } from "pg";

const DRY_RUN = process.argv.includes("--dry-run");

// ── secret-crypto.ts와 동일한 암호화 (인라인 복제) ──────────────────────────
const VERSION = "v1";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const PLACEHOLDER = "비공개";

function subkeyFor(master, calendarId) {
  return Buffer.from(
    hkdfSync("sha256", master, Buffer.from(calendarId, "utf8"), "vic-event-secret", KEY_BYTES)
  );
}

function encryptSecret(master, payload, calendarId) {
  const key = subkeyFor(master, calendarId);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const pt = Buffer.from(JSON.stringify(payload), "utf8");
  const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join("$");
}

function decryptSecret(master, stored, calendarId) {
  const [, ivB64, tagB64, ctB64] = stored.split("$");
  const key = subkeyFor(master, calendarId);
  const d = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  d.setAuthTag(Buffer.from(tagB64, "base64"));
  const pt = Buffer.concat([d.update(Buffer.from(ctB64, "base64")), d.final()]);
  return JSON.parse(pt.toString("utf8"));
}
// ────────────────────────────────────────────────────────────────────────────

function parseEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const env = parseEnvLocal();
const password = env.SUPABASE_DB_PASSWORD;
const ref = (env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const keyB64 = env.PRIVATE_DATA_ENC_KEY;

if (!password || !ref) {
  console.error("SUPABASE_DB_PASSWORD 또는 프로젝트 ref를 .env.local에서 찾지 못했습니다.");
  process.exit(1);
}
if (!keyB64) {
  console.error("PRIVATE_DATA_ENC_KEY가 .env.local에 없습니다. (openssl rand -base64 32)");
  process.exit(1);
}
const master = Buffer.from(keyB64, "base64");
if (master.length !== KEY_BYTES) {
  console.error(`PRIVATE_DATA_ENC_KEY 길이 오류(${master.length}바이트). base64 32바이트 필요.`);
  process.exit(1);
}

// 셀프체크: 인라인 암복호 왕복이 맞는지(상수 드리프트 방지).
{
  const probe = { publicTitle: "셀프체크", privateMemo: "round-trip" };
  const round = decryptSecret(master, encryptSecret(master, probe, "selfcheck-cal"), "selfcheck-cal");
  if (round.publicTitle !== probe.publicTitle || round.privateMemo !== probe.privateMemo) {
    console.error("암복호 셀프체크 실패 — 상수가 secret-crypto.ts와 다릅니다. 중단.");
    process.exit(1);
  }
}

const candidates = [
  { host: `aws-0-ap-northeast-2.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `aws-1-ap-northeast-2.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" }
];

async function tryConnect(cfg) {
  const client = new Client({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    statement_timeout: 60000
  });
  await client.connect();
  await client.query("select 1");
  return client;
}

let client = null;
for (const cfg of candidates) {
  try {
    process.stdout.write(`접속 시도: ${cfg.host} (user=${cfg.user}) ... `);
    client = await tryConnect(cfg);
    console.log("성공 ✅");
    break;
  } catch (err) {
    console.log(`실패 (${err.code || err.message})`);
  }
}
if (!client) {
  console.error("\n모든 후보 접속 실패.");
  process.exit(2);
}

console.log(DRY_RUN ? "\n[DRY RUN] 변경 없이 미리보기만 합니다.\n" : "");

// 비공개 + 아직 미암호화 행 + 평문 메타 조인.
const { rows } = await client.query(
  `select e.id, e.calendar_id, e.public_title, e.public_description,
          m.private_title, m.private_memo, m.editor_note
     from public.events e
     left join public.event_private_meta m on m.event_id = e.id
    where e.visibility_scope <> 'public'
      and e.secret_cipher is null`
);

console.log(`대상 행: ${rows.length}개`);

let changed = 0;
for (const r of rows) {
  const payload = {
    publicTitle: r.public_title || undefined,
    publicDescription: r.public_description || undefined,
    privateTitle: r.private_title || undefined,
    privateMemo: r.private_memo || undefined,
    editorNote: r.editor_note || undefined
  };
  const cipher = encryptSecret(master, payload, r.calendar_id);

  if (DRY_RUN) {
    console.log(`  [dry] ${r.id} "${r.public_title}" → 암호화`);
    changed++;
    continue;
  }

  await client.query(
    `update public.events
        set public_title = $1, public_description = null, secret_cipher = $2, updated_at = now()
      where id = $3`,
    [PLACEHOLDER, cipher, r.id]
  );
  // 평문 private_meta 제거(블롭이 단일 출처).
  await client.query(`delete from public.event_private_meta where event_id = $1`, [r.id]);
  changed++;
  console.log(`  ✅ ${r.id} 암호화 완료`);
}

await client.end();
console.log(`\n완료: ${changed}/${rows.length} ${DRY_RUN ? "(dry-run)" : "변경"} ✅`);

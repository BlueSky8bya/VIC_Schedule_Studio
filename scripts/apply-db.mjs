// 일회성 DB 적용 스크립트.
// .env.local에서 비밀번호/프로젝트 ref를 읽어 Supabase에 접속하고,
// 인자로 받은 SQL 파일들을 순서대로 실행한다.
//
// 사용: node scripts/apply-db.mjs <file1.sql> <file2.sql> ...
import { readFileSync } from "node:fs";
import { Client } from "pg";

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

if (!password || !ref) {
  console.error("SUPABASE_DB_PASSWORD 또는 프로젝트 ref를 .env.local에서 찾지 못했습니다.");
  process.exit(1);
}

// 접속 후보 (서울 리전 풀러 우선, 직접연결 후순위)
const candidates = [
  { host: `aws-0-ap-northeast-2.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `aws-1-ap-northeast-2.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" }
];

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("실행할 SQL 파일을 인자로 주세요.");
  process.exit(1);
}

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
  console.error("\n모든 후보 접속 실패. 네트워크/리전 문제일 수 있습니다.");
  process.exit(2);
}

// 시드(0002/0003)는 소유자 이메일을 GUC(app.owner_email)에서 읽는다(공개 저장소에
// 개인 이메일을 박지 않기 위함). .env.local의 OWNER_EMAIL을 이 세션에 주입해 둔다.
if (env.OWNER_EMAIL) {
  // OWNER_EMAIL은 콤마로 여러 계정을 담을 수 있다(공동 소유자).
  //  - app.owner_email  = 첫 번째(주 소유자). 0002/0003 seed가 owner_id를 잡는 기준.
  //  - app.owner_emails = 전체 목록. 0013 seed가 calendar_co_owners를 동기화하는 기준.
  const emails = env.OWNER_EMAIL.split(",").map((e) => e.trim()).filter(Boolean);
  await client.query("select set_config('app.owner_email', $1, false)", [emails[0]]);
  await client.query("select set_config('app.owner_emails', $1, false)", [emails.join(",")]);
  console.log(`\napp.owner_email = ${emails[0]} (주 소유자)`);
  if (emails.length > 1) {
    console.log(`app.owner_emails = ${emails.join(", ")} (공동 소유자 포함)`);
  }
}

for (const file of files) {
  const sql = readFileSync(file, "utf8");
  process.stdout.write(`\n실행: ${file} ... `);
  try {
    await client.query(sql);
    console.log("OK ✅");
  } catch (err) {
    console.log("오류 ❌");
    console.error(`  → ${err.message}`);
    await client.end();
    process.exit(3);
  }
}

await client.end();
console.log("\n전체 완료 ✅");

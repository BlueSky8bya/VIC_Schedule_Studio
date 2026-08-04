// 방송 세션 시작/종료 시각 사후 보정(백필).
//
// 왜: 시작시각 출처(방송국 API broad_start)가 SOOP 변경으로 죽어 있던 동안 기록된 세션들은
// 시작이 '첫 폴링 발견 시각'으로 굳었고(머리 손실), 백업 폴러 간격이 성겨 종료도 '마지막 폴링'
// 으로 일찍 끊겼다(꼬리 손실). 라이브 응답의 BTIME(진행 중 방송)과 다시보기 VOD(끝난 방송)로
// 정답값을 되찾아 과거 행을 고친다.
//
// 사용: node scripts/backfill-broadcast-times.mjs            (드라이런 — 무엇이 바뀔지만 출력)
//       node scripts/backfill-broadcast-times.mjs --apply    (실제 반영)
import { readFileSync } from "node:fs";
import { Client } from "pg";

const APPLY = process.argv.includes("--apply");
const BJ_ID = process.env.SOOP_BJ_ID ?? "toryvac";
const KST_MS = 9 * 3600 * 1000;
const kstDay = (ms) => new Date(ms + KST_MS).toISOString().slice(0, 10);
const fmt = (iso) => new Date(new Date(iso).getTime() + KST_MS).toISOString().replace("T", " ").slice(0, 19);
const hours = (a, b) => ((new Date(b) - new Date(a)) / 3600000).toFixed(2);

function env() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function connect(e) {
  const ref = (e.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  const candidates = [
    { host: "aws-0-ap-northeast-2.pooler.supabase.com", user: `postgres.${ref}` },
    { host: "aws-1-ap-northeast-2.pooler.supabase.com", user: `postgres.${ref}` },
    { host: `db.${ref}.supabase.co`, user: "postgres" }
  ];
  for (const c of candidates) {
    const client = new Client({
      host: c.host,
      port: 5432,
      user: c.user,
      password: e.SUPABASE_DB_PASSWORD,
      database: "postgres",
      ssl: { rejectUnauthorized: false }
    });
    try {
      await client.connect();
      return client;
    } catch {
      /* 다음 후보 */
    }
  }
  throw new Error("Supabase 접속 실패");
}

// 다시보기 목록(최근 N건) → { bno: {startedAt, endedAt} }
async function vodMap() {
  const url = `https://chapi.sooplive.co.kr/api/${BJ_ID}/vods/review?page=1&per_page=60&orderby=reg_date`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return new Map();
  const json = await res.json();
  const map = new Map();
  for (const item of json.data ?? []) {
    const bno = item.ucc?.thumb?.match(/_(\d+)_\d+_r/)?.[1];
    const durMs = Number(item.ucc?.total_file_duration);
    const endMs = Date.parse(`${String(item.reg_date ?? "").replace(" ", "T")}+09:00`);
    if (!bno || !Number.isFinite(durMs) || !Number.isFinite(endMs)) continue;
    if (durMs < 60_000 || durMs > 24 * 3600_000) continue;
    map.set(bno, {
      startedAt: new Date(endMs - durMs).toISOString(),
      endedAt: new Date(endMs).toISOString()
    });
  }
  return map;
}

// 진행 중인 방송의 실제 시작 시각(BTIME 기반)
async function liveStart() {
  try {
    const res = await fetch("https://live.sooplive.com/afreeca/player_live_api.php", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0"
      },
      body: new URLSearchParams({ bid: BJ_ID, type: "live", player_type: "html5" })
    });
    const json = await res.json();
    const c = json.CHANNEL ?? {};
    if (Number(c.RESULT) !== 1) return null;
    const sec = Number(c.BTIME);
    if (!Number.isFinite(sec) || sec <= 0 || sec > 48 * 3600) return null;
    return { bno: String(c.BNO), startedAt: new Date(Date.now() - sec * 1000).toISOString() };
  } catch {
    return null;
  }
}

const e = env();
const client = await connect(e);
const [vods, live] = await Promise.all([vodMap(), liveStart()]);
console.log(`VOD ${vods.size}건, 진행중 방송 ${live ? live.bno : "없음"}\n`);

const { rows } = await client.query(
  `select id, bno, start_day, started_at, last_live_at, ended_at, start_verified, vod_verified
     from broadcast_session order by started_at desc limit 60`
);

let changed = 0;
for (const row of rows) {
  const patch = {};
  const startMs = new Date(row.started_at).getTime();

  // 1) 진행 중인 방송 — BTIME이 정답. 머리만 당긴다(뒤로 미루지 않는다).
  if (live && row.bno === live.bno && row.ended_at === null) {
    if (new Date(live.startedAt).getTime() < startMs - 60_000) {
      patch.started_at = live.startedAt;
      patch.start_day = kstDay(new Date(live.startedAt).getTime());
      patch.start_verified = true;
    }
  }

  // 2) 끝난 방송 — VOD가 정답(등록시각 ≈ 방종, 길이 = 실제 방송시간).
  const vod = row.bno ? vods.get(row.bno) : null;
  if (vod) {
    if (new Date(vod.startedAt).getTime() < startMs - 60_000) {
      patch.started_at = vod.startedAt;
      patch.start_day = kstDay(new Date(vod.startedAt).getTime());
      patch.start_verified = true;
    }
    const endRef = new Date(row.ended_at ?? row.last_live_at).getTime();
    // 꼬리는 늘리기만 한다(VOD 종료가 기존 종료보다 뒤일 때만) — 과대집계 방지.
    if (new Date(vod.endedAt).getTime() > endRef + 60_000) {
      patch.ended_at = vod.endedAt;
      patch.last_live_at = vod.endedAt;
      patch.vod_verified = true;
    }
  }

  if (Object.keys(patch).length === 0) continue;
  changed += 1;
  const before = hours(row.started_at, row.ended_at ?? row.last_live_at);
  const after = hours(
    patch.started_at ?? row.started_at,
    patch.ended_at ?? row.ended_at ?? patch.last_live_at ?? row.last_live_at
  );
  console.log(
    `${row.start_day.toISOString?.().slice(0, 10) ?? row.start_day} bno=${row.bno} ` +
      `${before}h → ${after}h  (시작 ${fmt(row.started_at)}${
        patch.started_at ? ` → ${fmt(patch.started_at)}` : ""
      }, 종료 ${fmt(row.ended_at ?? row.last_live_at)}${
        patch.ended_at ? ` → ${fmt(patch.ended_at)}` : ""
      })`
  );

  if (APPLY) {
    const keys = Object.keys(patch);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    await client.query(`update broadcast_session set ${sets} where id = $1`, [
      row.id,
      ...keys.map((k) => patch[k])
    ]);
  }
}

console.log(`\n${changed}건 ${APPLY ? "반영 완료" : "변경 예정(드라이런 — --apply로 반영)"}`);
await client.end();

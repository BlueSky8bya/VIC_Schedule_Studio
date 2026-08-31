// 숲 다시보기(VOD) 아카이브 초기 백필(0068, PLAN-20260831-001 Phase 1).
// chapi 다시보기 목록 전체 페이지를 읽어 vod_archive에 upsert한다(Supabase REST, service_role).
// 이후 증분은 broadcast-poll 크론이 맡는다(오프라인 30분마다 1페이지) — 이 스크립트는 1회성.
//
// 사용: node scripts/backfill-vod-archive.mjs
// 파싱 규칙은 lib/broadcast/vod-archive.ts와 동일해야 한다(rowKey 날짜/bno, KST→ISO, 시작일 귀속).
import { readFileSync } from "node:fs";

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
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const BJ_ID = env.SOOP_BJ_ID || "toryvac";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 .env.local에서 찾지 못했습니다.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseThumbRowKey(thumb) {
  if (typeof thumb !== "string") return null;
  const m = /rowKey=(\d{4})(\d{2})(\d{2})_[0-9A-Fa-f]+_(\d+)_/.exec(thumb);
  if (!m) return null;
  return { day: `${m[1]}-${m[2]}-${m[3]}`, bno: m[4] };
}
function kstStringToIso(value) {
  if (typeof value !== "string" || value.length < 19) return null;
  const ms = Date.parse(`${value.replace(" ", "T")}+09:00`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function mapItem(item) {
  const titleNo = Number(item.title_no);
  if (!Number.isFinite(titleNo) || titleNo <= 0) return null;
  const durRaw = Number(item.ucc?.total_file_duration);
  const dur = Number.isFinite(durRaw) && durRaw > 0 ? Math.round(durRaw) : 0;
  const rowKey = parseThumbRowKey(item.ucc?.thumb);
  const regIso = kstStringToIso(item.reg_date);
  let day = rowKey?.day ?? null;
  if (!day && regIso) {
    day = new Date(Date.parse(regIso) - dur + 9 * 3600_000).toISOString().slice(0, 10);
  }
  if (!day) return null;
  return {
    title_no: titleNo,
    bno: rowKey?.bno ?? null,
    broadcast_day: day,
    title: typeof item.title_name === "string" ? item.title_name : "",
    duration_ms: dur,
    reg_date: regIso,
    comment_cnt: Number(item.count?.comment_cnt) || 0,
    like_cnt: Number(item.count?.like_cnt) || 0,
    read_cnt: Number(item.count?.read_cnt) || 0,
    synced_at: new Date().toISOString()
  };
}

async function fetchPage(page) {
  const url = `https://chapi.sooplive.co.kr/api/${BJ_ID}/vods/review?page=${page}&per_page=20&orderby=reg_date`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`VOD 목록 ${page}페이지 실패: ${res.status}`);
  return res.json();
}

async function upsert(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/vod_archive?on_conflict=title_no`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) throw new Error(`upsert 실패: ${res.status} ${await res.text()}`);
}

let page = 1;
let total = 0;
let skipped = 0;
for (;;) {
  const json = await fetchPage(page);
  const items = Array.isArray(json.data) ? json.data : [];
  if (items.length === 0) break;
  const rows = items.map(mapItem).filter(Boolean);
  skipped += items.length - rows.length;
  if (rows.length > 0) await upsert(rows);
  total += rows.length;
  const last = json.meta?.last_page ?? page;
  console.log(`페이지 ${page}/${last}: ${rows.length}건 upsert (누적 ${total})`);
  if (page >= last) break;
  page += 1;
  await sleep(300);
}
console.log(`완료: ${total}건 저장, ${skipped}건 스킵(날짜 귀속 불가).`);

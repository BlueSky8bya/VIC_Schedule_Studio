// 구독 전용 업로드 영상 백필(0155→0156) — 숲 카드의 '구독' 배지(file_type NORMAL + auth_no 107).
// chapi 목록 전 페이지를 읽어 vod_archive에 upload=true 행으로 upsert한다(Supabase REST, service_role). 이후는 runVodPipeline이 맡는다.
//
// 사용: node scripts/backfill-vod-uploads.mjs [--dry]
// 파싱 규칙은 lib/broadcast/vod-upload.ts와 같아야 한다(제목 'M월 D일' 우선, 없으면 등록 시각 − 6시 경계).
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
const DRY = process.argv.includes("--dry");
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 .env.local에서 찾지 못했습니다.");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const kstDayOf = (ms) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
function kstStringToIso(value) {
  if (typeof value !== "string" || value.length < 19) return null;
  const ms = Date.parse(`${value.replace(" ", "T")}+09:00`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function attributeUploadDay(title, regIso) {
  const regMs = regIso ? Date.parse(regIso) : NaN;
  if (!Number.isFinite(regMs)) return null;
  const regDay = kstDayOf(regMs);
  const m = /(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(title);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = month > Number(regDay.slice(5, 7)) ? Number(regDay.slice(0, 4)) - 1 : Number(regDay.slice(0, 4));
      const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      if (new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso) return iso;
    }
  }
  return kstDayOf(regMs - 6 * 3600_000);
}

const rows = new Map();
let lastPage = 1;
for (let page = 1; page <= lastPage; page++) {
  const res = await fetch(`https://chapi.sooplive.co.kr/api/${BJ_ID}/vods/normal?page=${page}&per_page=60&orderby=reg_date`, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });
  if (!res.ok) throw new Error(`page ${page}: HTTP ${res.status}`);
  const json = await res.json();
  if (page > 1 && Number(json.meta?.last_page) !== lastPage) throw new Error("목록이 넘기는 사이 바뀌었습니다 — 다시 실행하세요.");
  lastPage = Number(json.meta?.last_page);
  for (const item of json.data ?? []) {
    if (item.ucc?.file_type !== "NORMAL" || Number(item.auth_no) !== 107) continue;
    const title = typeof item.title_name === "string" ? item.title_name : "";
    const regDate = kstStringToIso(item.reg_date);
    const uploadDay = attributeUploadDay(title, regDate);
    if (!uploadDay) throw new Error(`날짜 귀속 실패: ${item.title_no}`);
    const dur = Number(item.ucc?.total_file_duration);
    rows.set(Number(item.title_no), {
      title_no: Number(item.title_no), broadcast_day: uploadDay, title,
      duration_ms: Number.isFinite(dur) && dur > 0 ? Math.round(dur) : 0,
      thumb: typeof item.ucc?.thumb === "string" ? item.ucc.thumb : "",
      reg_date: regDate, auth_no: 107, upload: true, guest: false, synced_at: new Date().toISOString()
    });
  }
  await sleep(250);
}

const list = [...rows.values()].sort((a, b) => a.broadcast_day.localeCompare(b.broadcast_day));
for (const r of list) console.log(r.broadcast_day, r.title_no, r.title.slice(0, 40));
console.log(`구독 전용 업로드 ${list.length}건 (페이지 ${lastPage})`);
if (DRY || list.length === 0) process.exit(0);

const res = await fetch(`${SUPABASE_URL}/rest/v1/vod_archive?on_conflict=title_no`, {
  method: "POST",
  headers: {
    apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=minimal"
  },
  body: JSON.stringify(list)
});
if (!res.ok) throw new Error(`upsert 실패: HTTP ${res.status} ${await res.text()}`);
console.log("upsert 완료");

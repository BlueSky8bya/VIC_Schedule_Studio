// 과거 일정 카드 자동 생성(2026-08-31 사용자 지시) — 일정 시스템 이전(≤2025-12-31)의
// '다시보기는 있는데 일정 카드가 없는 날'에 VOD 제목으로 유추한 일정을 만들어 준다.
//
// 규칙:
//  - 대상: vod_archive의 broadcast_day ≤ 2025-12-31 중, 그 날 events(deleted_at null)가 0개인 날
//  - 제목: VOD 제목에서 분할 접미사(" - 1" 등)를 떼고 중복을 합친 뒤, 여러 개면 줄바꿈으로
//    이어 붙인다(카드의 main+sub 문법). 저녁 시작(새벽 귀속 아님)이면 "N시 " 접두 — 기존
//    2026 카드 문법("21시 라이츄합방")과 통일
//  - status/visibility/category = 기본값(scheduled/public/stream), 태그 없음(중립색)
//  - 멱등: 이미 일정이 있는 날은 건너뜀. 생성한 id는 JSON으로 남긴다(롤백용)
//
// 사용: node scripts/backfill-history-events.mjs          (실행)
//       node scripts/backfill-history-events.mjs --dry    (미리보기만)
import { readFileSync, writeFileSync } from "node:fs";

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
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY가 필요합니다.");
  process.exit(1);
}
const H = { apikey: K, Authorization: `Bearer ${K}` };
const DRY = process.argv.includes("--dry");
const CUTOFF = "2025-12-31";

async function all(path) {
  const out = [];
  for (let off = 0; ; off += 500) {
    const res = await fetch(`${U}/rest/v1/${path}&limit=500&offset=${off}`, { headers: H });
    if (!res.ok) throw new Error(`${path} 조회 실패: ${res.status}`);
    const r = await res.json();
    out.push(...r);
    if (r.length < 500) break;
  }
  return out;
}

// 캘린더 id (slug=vic)
const cal = await fetch(`${U}/rest/v1/calendars?select=id&slug=eq.vic`, { headers: H }).then((r) => r.json());
const calendarId = cal[0]?.id;
if (!calendarId) throw new Error("캘린더(vic)를 찾지 못했습니다.");

const vods = await all(
  `vod_archive?select=title_no,broadcast_day,title,duration_ms,reg_date&broadcast_day=lte.${CUTOFF}&order=reg_date.asc`
);
const events = await all(
  `events?select=date_key&calendar_id=eq.${calendarId}&date_key=lte.${CUTOFF}&deleted_at=is.null&order=date_key.asc`
);
const haveEvents = new Set(events.map((e) => e.date_key));

// 분할 접미사 제거(" - 1"/" -2" 꼬리) 후 공백 정리
const cleanTitle = (t) => t.replace(/\s*[-–]\s*\d{1,2}\s*$/, "").trim();
const kstStartOf = (v) => new Date(Date.parse(v.reg_date) - v.duration_ms + 9 * 3600_000);

const byDay = new Map();
for (const v of vods) {
  const l = byDay.get(v.broadcast_day) ?? [];
  l.push(v);
  byDay.set(v.broadcast_day, l);
}

const rows = [];
for (const [day, list] of [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  if (haveEvents.has(day)) continue;
  // 중복 제거(등장 순서 유지)
  const titles = [];
  for (const v of list) {
    const t = cleanTitle(v.title);
    if (t && !titles.includes(t)) titles.push(t);
  }
  if (titles.length === 0) continue;
  // 시작 "N시 " 접두 — 새벽 귀속(달력상 시작일 ≠ broadcast_day)이 아닌 첫 VOD의 KST 시각.
  const first = list.find((v) => kstStartOf(v).toISOString().slice(0, 10) === day);
  const hour = first ? kstStartOf(first).getUTCHours() : null;
  const main = hour !== null ? `${hour}시 ${titles[0]}` : titles[0];
  rows.push({
    calendar_id: calendarId,
    date_key: day,
    public_title: [main, ...titles.slice(1)].join("\n")
  });
}

console.log(`VOD 있는 날 ${byDay.size} · 이미 일정 있는 날 ${haveEvents.size} · 생성 대상 ${rows.length}일`);
for (const r of rows.slice(0, 8)) console.log(`  ${r.date_key} | ${r.public_title.split("\n").join(" ⏎ ").slice(0, 70)}`);
if (rows.length > 8) console.log(`  … 외 ${rows.length - 8}일`);
if (DRY) process.exit(0);

let created = [];
for (let i = 0; i < rows.length; i += 100) {
  const res = await fetch(`${U}/rest/v1/events`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(rows.slice(i, i + 100))
  });
  if (!res.ok) throw new Error(`insert 실패: ${res.status} ${await res.text()}`);
  const got = await res.json();
  created = created.concat(got.map((e) => ({ id: e.id, date_key: e.date_key })));
}
writeFileSync(
  new URL("../.scratch-pw/generated-history-events.json", import.meta.url),
  JSON.stringify({ generatedAt: new Date().toISOString(), count: created.length, ids: created }, null, 2)
);
console.log(`생성 완료: ${created.length}건 (id 목록 → .scratch-pw/generated-history-events.json)`);

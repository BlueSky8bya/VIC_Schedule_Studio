// 과거 일정 카드 자동 생성 v2(2026-08-31 사용자 지시) — 일정 시스템 이전(≤2025-12-31)의
// '다시보기는 있는데 일정 카드가 없는 날'에 VOD 제목으로 유추한 일정을 만든다.
//
// v2 규칙(사용자 피드백 반영):
//  - 하루를 무조건 카드 1장으로 합치지 않는다 — **정제 제목이 다르면 별도 일정**(분위기 구분).
//    같은 제목의 분할(-1/-2)만 한 장으로 접는다. sort_order = 방송 순서.
//  - **태그 자동 부여**: 제목 키워드 → 콘텐츠 태그(첫 매치가 대표) + 형식 태그, 최대 6개.
//    아무것도 안 맞으면 태그 없음(중립색) — 틀린 태그보다 무태그가 낫다.
//  - 저녁 시작(새벽 귀속 아님)이면 "N시 " 접두(기존 카드 문법). 기본값 scheduled/public/stream.
//  - 멱등: 일정이 이미 있는 날은 건너뜀. 생성 id는 JSON으로 남긴다(롤백용).
//
// 사용: node scripts/backfill-history-events.mjs --dry            (미리보기)
//       node scripts/backfill-history-events.mjs                  (실행)
//       node scripts/backfill-history-events.mjs --purge <json>   (해당 id 목록 일괄 삭제)
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

// ── 퍼지 모드: 생성 기록 JSON의 id를 일괄 hard delete(event_tags는 FK cascade) ──
const purgeIdx = process.argv.indexOf("--purge");
if (purgeIdx !== -1) {
  const file = process.argv[purgeIdx + 1];
  if (!file) throw new Error("--purge <json파일> 형식으로 주세요.");
  const ids = JSON.parse(readFileSync(file, "utf8")).ids.map((r) => r.id);
  for (let i = 0; i < ids.length; i += 80) {
    const chunk = ids.slice(i, i + 80);
    const res = await fetch(`${U}/rest/v1/events?id=in.(${chunk.join(",")})`, {
      method: "DELETE",
      headers: H
    });
    if (!res.ok) throw new Error(`delete 실패: ${res.status} ${await res.text()}`);
  }
  console.log(`퍼지 완료: ${ids.length}건 삭제.`);
  process.exit(0);
}

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

const cal = await fetch(`${U}/rest/v1/calendars?select=id&slug=eq.vic`, { headers: H }).then((r) => r.json());
const calendarId = cal[0]?.id;
if (!calendarId) throw new Error("캘린더(vic)를 찾지 못했습니다.");

// 태그 사전(이름 → id/kind). 이름이 바뀌면 매핑이 조용히 빠지므로 마지막에 미매치 이름을 알린다.
const tags = await all(`broadcast_tags?select=id,display_name,kind&calendar_id=eq.${calendarId}&is_active=eq.true&order=sort_order.asc`);
const tagByName = new Map(tags.map((t) => [t.display_name, t]));

// 제목 키워드 → 태그 이름. 콘텐츠는 **순서가 우선순위**(첫 매치 = 대표 태그).
const CONTENT_RULES = [
  ["대회", /대회|[0-9]+강|결승|본선|경기|마라톤|대잔치|배그전쟁|뱅온전쟁|3배싸움|드림팀|티어 ?배치|생컨|버축대|사이클|WBD|릴동파|아이스골프|왁타배그|왁징어게임|배그 삼국지|티어게임|해상전쟁|공주배그|하렘배그|커플 서바이벌|고멤드림|점프맵|아라포|보물찾기|올랜설/],
  ["합방", /합방|고릴뱅|시점|w\.|참여|초대|민박|같이|리스닝파티|신년회|갈틱|도방|레슨|1:1|나작비|님 안녕/],
  // 서버가 게임보다 앞 — 채무의숲·맹든링·돌발서버는 '서버 이름'(2026-08-31 사용자 정정)이라
  // 마크류 단어가 섞여도 대표는 서버여야 한다.
  ["서버", /서버|왁조트|채무의숲|맹든링/],
  // 아르마(Arma)·60 Minutes to Extinction(방탈출)·백룸·구구덕(구스구스덕)·마리오(카트/고양이)·
  // 인슈라오디드(Enshrouded)·미메시스·베이비스탭·클로버 핏·프클(FC 프로클럽)·점프킹 = 전부 게임
  // (2026-08-31 사용자 정정 + 검색 확인). 괴식(먹방)은 게임이 아니라 소통으로 이동.
  ["게임", /배그|배틀그라운드|스타 |스타!|스타 연습|롤 |롤!|FC2[56]|마크|마인크래프트|좀보이드|배틀크러쉬|골프|야구|델타룬|링피트|픽크타|포챔스|경도|잔디|메이플|엔드필드|Darkwater|데바데|농구|오버워치|산나비|Palworld|포켓몬|엔더드래곤|8번출구|DEVOUR|왁피스|찍먹|아르마|Arma|60 ?[Mm]inutes|[Ee]scape ?[Rr]oom|방탈출|백룸|구구덕|구스구스덕|마리오|인슈라오디드|Enshrouded|미메시스|베이비스탭|클로버 핏|길드|점프킹|프클|Shapes|게임/],
  ["풀트", /풀트|촉각슈트|스트레칭|춤뱅/],
  ["시네티", /시네티/],
  ["월드컵", /월드컵/],
  // 괴식(먹방)·새해맞이·감컴&버컴(감스트/버튜버 컴퍼니 소식 — 검색 확인)·오타마톤(악기 장난감)은 소통.
  ["소통", /소통|노가리|눕뱅|잔잔|후기|짧뱅|토크|빅이봤|별별랭킹|상식퀴즈|타로|릴스|썰|이야기|Q&A|큐앤|가리!|데뷔|구경|테스트|정해보|괴식|새해|감컴|버컴|오타마톤|베스 |인상!|후열대화|챌린지|기타치|롤링페이퍼/]
];
const MODIFIER_RULES = [
  ["연습", /연습/],
  ["모캡", /모캡|모션캡/],
  ["VRChat", /VRC/i],
  ["시참", /시참/],
  ["리캡보기", /리캡/],
  ["구플뱅", /구플/],
  ["오픈런", /오픈런/],
  ["비방", /비방/],
  // 빅이봤 = 토리님 숲 방송국(게시판) 보기 → 카페보기(2026-08-31 사용자 정정).
  ["카페보기", /카페|빅이봤/]
];
const missedTagNames = new Set();
function tagsForTitle(title) {
  const picked = [];
  for (const [name, re] of CONTENT_RULES) {
    if (!re.test(title)) continue;
    const t = tagByName.get(name);
    if (!t) { missedTagNames.add(name); continue; }
    picked.push(t);
    if (picked.length >= 3) break; // 콘텐츠는 3개까지(대표 = 첫 번째)
  }
  for (const [name, re] of MODIFIER_RULES) {
    if (picked.length >= 6) break;
    if (!re.test(title)) continue;
    const t = tagByName.get(name);
    if (!t) { missedTagNames.add(name); continue; }
    picked.push(t);
  }
  return picked;
}

const vods = await all(
  `vod_archive?select=title_no,broadcast_day,title,duration_ms,reg_date&broadcast_day=lte.${CUTOFF}&order=reg_date.asc`
);
const events = await all(
  `events?select=date_key&calendar_id=eq.${calendarId}&date_key=lte.${CUTOFF}&deleted_at=is.null&order=date_key.asc`
);
const haveEvents = new Set(events.map((e) => e.date_key));

const cleanTitle = (t) => t.replace(/\s*[-–]\s*\d{1,2}\s*$/, "").trim();
const kstStartOf = (v) => new Date(Date.parse(v.reg_date) - v.duration_ms + 9 * 3600_000);

const byDay = new Map();
for (const v of vods) {
  const l = byDay.get(v.broadcast_day) ?? [];
  l.push(v);
  byDay.set(v.broadcast_day, l);
}

// 생성 행: '+'로 이어진 활동은 **각각 별도 일정**(2026-08-31 사용자 지시), 같은 텍스트는
// 하루 안에서 중복 제거. " - " 소제목 구조는 길 때만 줄바꿈으로 들여쓴다(카드 main+sub 문법).
// 시각 접두는 각 VOD의 첫 조각에만(뒤 조각들의 내부 시각은 모른다).
const rows = []; // { calendar_id, date_key, public_title, sort_order, _tags: [{id,kind}] }
for (const [day, list] of [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
  if (haveEvents.has(day)) continue;
  const segs = []; // { text, vod, first }
  for (const v of list) {
    const t = cleanTitle(v.title);
    if (!t) continue;
    t.split(/\s*\+\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s, si) => {
        if (segs.some((x) => x.text === s)) return;
        segs.push({ text: s, vod: v, first: si === 0 });
      });
  }
  segs.forEach((g, i) => {
    const start = kstStartOf(g.vod);
    const sameDay = start.toISOString().slice(0, 10) === day;
    let parts = [g.text];
    if (g.text.length > 16 && g.text.includes(" - ")) {
      parts = g.text.split(" - ").map((s) => s.trim()).filter(Boolean);
    }
    const hour = g.first && sameDay ? `${start.getUTCHours()}시 ` : "";
    rows.push({
      calendar_id: calendarId,
      date_key: day,
      public_title: [hour + parts[0], ...parts.slice(1)].join("\n"),
      sort_order: i,
      _tags: tagsForTitle(g.text)
    });
  });
}

console.log(`VOD 있는 날 ${byDay.size} · 이미 일정 있는 날 스킵 ${haveEvents.size} · 생성 일정 ${rows.length}건`);
for (const r of rows.slice(0, 14)) {
  console.log(`  ${r.date_key}#${r.sort_order} [${r._tags.map((t) => t.display_name).join("·") || "무태그"}] ${r.public_title.slice(0, 56)}`);
}
if (rows.length > 14) console.log(`  … 외 ${rows.length - 14}건`);
const untagged = rows.filter((r) => r._tags.length === 0);
console.log(`무태그 ${untagged.length}건:`);
for (const r of untagged) console.log(`   ${r.date_key} | ${r.public_title.slice(0, 60)}`);
if (missedTagNames.size > 0) console.log(`⚠ 사전에 없는 태그 이름: ${[...missedTagNames].join(", ")}`);
if (DRY) process.exit(0);

let created = [];
for (let i = 0; i < rows.length; i += 100) {
  const chunk = rows.slice(i, i + 100);
  const res = await fetch(`${U}/rest/v1/events`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(chunk.map(({ _tags, ...row }) => row))
  });
  if (!res.ok) throw new Error(`insert 실패: ${res.status} ${await res.text()}`);
  const got = await res.json();
  // (date_key, public_title)로 짝을 맞춘다 — 응답 순서에 기대지 않는다.
  for (const e of got) {
    const src = chunk.find((r) => r.date_key === e.date_key && r.public_title === e.public_title);
    created.push({ id: e.id, date_key: e.date_key, tags: src?._tags ?? [] });
  }
}
// 태그 부여 — 첫 콘텐츠 태그가 대표(is_primary).
const tagRows = [];
for (const c of created) {
  c.tags.forEach((t, i) => {
    tagRows.push({ event_id: c.id, tag_id: t.id, is_primary: i === 0 && t.kind === "content", sort_order: i });
  });
}
for (let i = 0; i < tagRows.length; i += 200) {
  const res = await fetch(`${U}/rest/v1/event_tags`, {
    method: "POST",
    headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(tagRows.slice(i, i + 200))
  });
  if (!res.ok) throw new Error(`event_tags insert 실패: ${res.status} ${await res.text()}`);
}
writeFileSync(
  new URL("../db/backfills/2026-08-31-history-events.json", import.meta.url),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), count: created.length, ids: created.map(({ id, date_key }) => ({ id, date_key })) },
    null,
    2
  )
);
console.log(`생성 완료: 일정 ${created.length}건 · 태그 ${tagRows.length}건 (id 목록 → db/backfills/2026-08-31-history-events.json)`);

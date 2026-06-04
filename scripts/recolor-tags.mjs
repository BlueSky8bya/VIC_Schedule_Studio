// 태그 색 리뉴얼 v3 — Open Color 기반, 감사 통과형(WCAG 대비 + 색맹).
//  · 콘텐츠: 연한 shade-2 카드 + '아주 진한' 글씨(대비 ≥4.5) + 무늬. hue 가까운 묶음은 무늬를 달리해
//    색맹(적/녹색맹)에서도 무늬로 구분되게 한다(WCAG 1.4.1 — 색만으로 구분 금지).
//  · 방식: 점/칩. 진한 shade-8 bg + 흰 글씨(대비 확보) → 연한 카드 위에서도, 칩 글씨도 또렷.
//  · 휴뱅: 중립 회색.
//  · 배정: 사용 빈도 내림차순 → 배열 앞쪽(눈 편한 초록·충돌 적은 색)부터.
//  · dry-run: `node scripts/recolor-tags.mjs --dry` → DB 변경 없이 계획만 출력.
import { readFileSync } from "node:fs";
import { Client } from "pg";

const DRY = process.argv.includes("--dry");

// 콘텐츠 — bg(연한 카드) / text(아주 진한, 대비≥4.5) / border / pat(무늬). 빈도순으로 위에서부터 배정.
// pat은 hue 가까운 묶음(보라계 VRChat·월드컵·시네티 / 초록계 게임·풀트뱅·소통뱅·별별랭킹)이
// 서로 다르도록 손배치 → 색맹에서 무늬로 구분된다.
const CONTENT = [
  { n: "그린", bg: "#b2f2bb", text: "#14532d", border: "#69db7c", pat: "diag" },   // 게임
  { n: "바이올렛", bg: "#d0bfff", text: "#3a228f", border: "#9775fa", pat: "diag" }, // VRChat
  { n: "핑크", bg: "#fcc2d7", text: "#8a1a40", border: "#f783ac", pat: "dots" },   // 서버
  { n: "옐로우", bg: "#ffec99", text: "#6b4e00", border: "#ffd43b", pat: "grid" }, // 풀트뱅(CK와 교환)
  { n: "그레이프", bg: "#eebefa", text: "#6b1485", border: "#da77f2", pat: "cross" }, // 월드컵(보라, VRChat과 무늬 다름)
  { n: "블루", bg: "#a5d8ff", text: "#0f4c81", border: "#4dabf7", pat: "dash" },   // 기타
  { n: "인디고", bg: "#bac8ff", text: "#283a94", border: "#748ffc", pat: "dots" }, // 시네티(보라, VRChat·월드컵과 무늬 다름)
  { n: "오렌지", bg: "#ffd8a8", text: "#9a3412", border: "#ffa94d", pat: "cross" }, // 타스뱅송(게임 초록과 적색맹 혼동 → 무늬 다르게)
  { n: "시안", bg: "#99e9f2", text: "#094a56", border: "#3bc9db", pat: "grid" },   // CK(풀트뱅과 교환)
  { n: "민트", bg: "#63e6be", text: "#044a35", border: "#20c997", pat: "cross" },  // 소통뱅(CK 시안과 분리 — 더 진한 민트)
  { n: "라임", bg: "#d8f5a2", text: "#365314", border: "#a9e34b", pat: "dash" },   // 별별랭킹(초록, 게임·소통뱅과 무늬 다름)
  { n: "살몬레드", bg: "#ffa8a8", text: "#8a1313", border: "#ff8787", pat: "grid" }, // 토크쇼(서버 핑크와 분리 — 더 진한 빨강)
  { n: "그레이프2", bg: "#f3d9fa", text: "#7a1a8f", border: "#e599f7", pat: "dots" }
];
// 방식 — 점/칩. 진한 shade-8 bg + 흰 글씨(대비≥4.5). hue 전부 분리. 합방(게임 초록 위 자주)은 초록 금지.
// 방식 점/칩 — 어두운 shade-8은 명도가 다 비슷해 칙칙하게 뭉쳤다. '선명한(vivid)' 색으로 바꿔
// hue를 풀 스펙트럼으로 벌리고(보라·파랑·초록·빨강·시안·마젠타·주황) 명도도 살린다 → 확실히 구분.
// 굵은 칩 글씨라 흰 글씨 3:1↑면 읽힘. 채도 높아 연한 카드 위 점으로도 또렷.
const MOD = [
  { n: "바이올렛", bg: "#7048e8", text: "#ffffff", border: "#5f3dc4" }, // 합방(보라)
  { n: "블루", bg: "#1c7ed6", text: "#ffffff", border: "#1864ab" },     // 대회(파랑)
  { n: "그린", bg: "#2f9e44", text: "#ffffff", border: "#2b8a3e" },     // 연습(초록)
  { n: "레드", bg: "#e03131", text: "#ffffff", border: "#c92a2a" },     // 시참(빨강)
  { n: "시안", bg: "#1098ad", text: "#ffffff", border: "#0c8599" },     // 짧뱅(시안)
  { n: "마젠타", bg: "#ae3ec9", text: "#ffffff", border: "#9c36b5" },   // 모캡(마젠타)
  // 구플뱅 — 예전 주황(#e8590c)이 시참 빨강(#e03131)과 hue ~19°라 작은 점/칩에서 거의 구분 안 됐다.
  // 선명한 앰버(노랑쪽)로 옮겨 hue·명도 둘 다 벌린다. 밝아 흰 글씨는 대비가 모자라 → 진한 갈색 글씨.
  { n: "앰버", bg: "#f59f00", text: "#3d2800", border: "#e08a00" }     // 구플뱅(앰버 — 시참 빨강과 분리)
];

const t = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2]; }
const ref = (e.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
const c = new Client({ host: "aws-1-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres." + ref, password: e.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
await c.connect();
const cal = (await c.query("select id from calendars where slug='vic'")).rows[0].id;

const tags = (await c.query(
  `select bt.id, bt.tag_key, bt.display_name, bt.kind, count(et.event_id)::int uses
   from broadcast_tags bt left join event_tags et on et.tag_id = bt.id
   where bt.calendar_id=$1 and bt.is_active=true and bt.parent_id is null group by bt.id`,
  [cal]
)).rows;
const byUses = (a, b) => b.uses - a.uses || a.display_name.localeCompare(b.display_name);
const mods = tags.filter((x) => x.kind === "modifier").sort(byUses);
const content = tags.filter((x) => x.kind !== "modifier" && x.tag_key !== "dayoff").sort(byUses);

async function setColor(key, name, col, sort, tagId) {
  if (DRY) return;
  await c.query(
    `insert into color_palette (calendar_id,key,name,bg_color,text_color,border_color,sort_order)
     values ($1,$2,$3,$4,$5,$6,$7) on conflict (calendar_id,key) do update
       set bg_color=excluded.bg_color, text_color=excluded.text_color, border_color=excluded.border_color`,
    [cal, key, name, col.bg, col.text, col.border, sort]
  );
  await c.query("update broadcast_tags set color_key=$1 where id=$2", [key, tagId]);
}

console.log(DRY ? "── DRY RUN (DB 변경 없음) ──" : "── 적용 ──");
for (let i = 0; i < mods.length; i++) {
  const col = MOD[i % MOD.length];
  await setColor(`gen-plain-m${i}`, mods[i].display_name, col, 70 + i, mods[i].id);
  console.log(`방식  ${mods[i].display_name.padEnd(8)} ${String(mods[i].uses).padStart(3)}회 → ${col.n} ${col.bg}`);
}
for (let i = 0; i < content.length; i++) {
  const col = CONTENT[i % CONTENT.length];
  await setColor(`gen-${col.pat}-c${i}`, content[i].display_name, col, 50 + i, content[i].id);
  console.log(`콘텐츠 ${content[i].display_name.padEnd(8)} ${String(content[i].uses).padStart(3)}회 → ${col.n} ${col.bg} (${col.pat})`);
}
// 휴뱅 — 중립 회색
if (!DRY) {
  await c.query(
    `insert into color_palette (calendar_id,key,name,bg_color,text_color,border_color,sort_order)
     values ($1,'gray','회색','#e9ecef','#495057','#ced4da',1) on conflict (calendar_id,key) do update
       set bg_color=excluded.bg_color, text_color=excluded.text_color, border_color=excluded.border_color`,
    [cal]
  );
  // 안 쓰는 색 전부 정리
  const pruned = await c.query(
    `delete from color_palette where calendar_id=$1
       and key not in (select color_key from broadcast_tags where calendar_id=$1 and color_key is not null)
       returning key`,
    [cal]
  );
  console.log(`prune(${pruned.rows.length}): ${pruned.rows.map((r) => r.key).join(", ") || "none"}`);
}
await c.end();
console.log(DRY ? "DRY 끝 (적용하려면 --dry 빼고 실행)" : "완료 ✅");

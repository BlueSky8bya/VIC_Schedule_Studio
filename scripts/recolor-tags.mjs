// 태그 색 리뉴얼 v2 — Tailwind 색 스케일 벤치마킹.
//   콘텐츠(무늬): bg=Tailwind-200, text=Tailwind-700, border=Tailwind-300 → 조화롭고 글자 대비 강함.
//   방식(단색 점): bg=Tailwind-300, text=Tailwind-700, border=Tailwind-500 → 작은 점이라 더 또렷한 톤.
//   휴뱅: slate(중립 회색) 고정.
// 흙색(올리브·탁한 황토) 회피, 스펙트럼 균등 배치. 무늬는 키 접두사(gen-{pat})로 globals.css가 얹는다.
// 사용: node scripts/recolor-tags.mjs
import { readFileSync } from "node:fs";
import { Client } from "pg";

// Open Color(yeun) 벤치마킹 — 맑은 파스텔, 똥색(갈색·황토·올리브) 전혀 없음.
// bg=shade-2, text=shade-8(따뜻한 색은 더 진하게 보정), border=shade-4.
// 순서 = '눈이 편한 → 자극적인'. 망막은 S-cone(파랑)이 가장 적고 포화 파랑은 색수차로 피로하다.
// 그래서 가장 자주 쓰는 태그(달력을 뒤덮는)는 눈이 제일 편한 '초록'(시감도 피크)부터 받고,
// 파랑은 고빈도에서 빼 중간 빈도로 보낸다. 따뜻한 색(주황·노랑·빨강)은 가장 드문 태그(강조)에만.
const CONTENT = [
  { n: "그린", bg: "#b2f2bb", text: "#2b8a3e", border: "#69db7c" },
  { n: "틸", bg: "#96f2d7", text: "#087f5b", border: "#38d9a9" },
  { n: "바이올렛", bg: "#d0bfff", text: "#5f3dc4", border: "#9775fa" },
  { n: "핑크", bg: "#fcc2d7", text: "#a61e4d", border: "#f783ac" },
  { n: "시안", bg: "#99e9f2", text: "#0b7285", border: "#3bc9db" },
  { n: "그레이프", bg: "#eebefa", text: "#862e9c", border: "#da77f2" },
  { n: "블루", bg: "#a5d8ff", text: "#1864ab", border: "#4dabf7" },
  { n: "라임", bg: "#d8f5a2", text: "#5c940d", border: "#a9e34b" },
  { n: "인디고", bg: "#bac8ff", text: "#364fc7", border: "#748ffc" },
  { n: "오렌지", bg: "#ffd8a8", text: "#d9480f", border: "#ffa94d" },
  { n: "옐로우", bg: "#ffec99", text: "#946800", border: "#ffd43b" },
  { n: "레드", bg: "#ffc9c9", text: "#c92a2a", border: "#ff8787" },
  { n: "그레이프2", bg: "#f3d9fa", text: "#9c36b5", border: "#e599f7" }
];
// 방식용 — 점(작은 원). 같은 '눈 편한→자극적' 순. shade-4 bg + shade-8 text + shade-6 border.
const MOD = [
  { n: "그린", bg: "#69db7c", text: "#2b8a3e", border: "#40c057" },
  { n: "틸", bg: "#38d9a9", text: "#087f5b", border: "#12b886" },
  { n: "시안", bg: "#3bc9db", text: "#0b7285", border: "#15aabf" },
  { n: "그레이프", bg: "#da77f2", text: "#862e9c", border: "#be4bdb" },
  { n: "오렌지", bg: "#ffa94d", text: "#d9480f", border: "#fd7e14" },
  { n: "옐로우", bg: "#ffd43b", text: "#946800", border: "#fab005" },
  { n: "레드", bg: "#ff8787", text: "#c92a2a", border: "#fa5252" }
];
const PATS = ["diag", "dots", "grid", "cross", "dash"];

const t = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2]; }
const ref = (e.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
const c = new Client({ host: "aws-1-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres." + ref, password: e.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
await c.connect();
const cal = (await c.query("select id from calendars where slug='vic'")).rows[0].id;

// 사용 빈도(event_tags 연결 수)를 함께 받아 '많이 쓰는 순'으로 정렬한다 → 차분한 색을 앞에서 배정.
const tags = (await c.query(
  `select bt.id, bt.tag_key, bt.display_name, bt.kind, count(et.event_id)::int uses
   from broadcast_tags bt
   left join event_tags et on et.tag_id = bt.id
   where bt.calendar_id=$1 and bt.is_active=true and bt.parent_id is null
   group by bt.id`,
  [cal]
)).rows;

// 자주 쓰는 태그일수록 앞(차분한 색). 동률은 이름 안정 정렬.
const byUses = (a, b) => b.uses - a.uses || a.display_name.localeCompare(b.display_name);
const mods = tags.filter((x) => x.kind === "modifier").sort(byUses);
const content = tags
  .filter((x) => x.kind !== "modifier" && x.tag_key !== "dayoff")
  .sort(byUses);

async function setColor(key, name, col, sort, tagId) {
  await c.query(
    `insert into color_palette (calendar_id,key,name,bg_color,text_color,border_color,sort_order)
     values ($1,$2,$3,$4,$5,$6,$7) on conflict (calendar_id,key) do update
       set bg_color=excluded.bg_color, text_color=excluded.text_color, border_color=excluded.border_color`,
    [cal, key, name, col.bg, col.text, col.border, sort]
  );
  await c.query("update broadcast_tags set color_key=$1 where id=$2", [key, tagId]);
}

// 1) 방식 → 단색 점(gen-plain)
for (let i = 0; i < mods.length; i++) {
  const col = MOD[i % MOD.length];
  const key = `gen-plain-m${i}`;
  await setColor(key, mods[i].display_name, col, 70 + i, mods[i].id);
  console.log(`방식  ${mods[i].display_name.padEnd(8)} ${String(mods[i].uses).padStart(3)}회 → ${col.n}`);
}

// 2) 콘텐츠 → 무늬색(gen-{pat})
for (let i = 0; i < content.length; i++) {
  const col = CONTENT[i % CONTENT.length];
  const pat = PATS[i % PATS.length];
  const key = `gen-${pat}-c${i}`;
  await setColor(key, content[i].display_name, col, 50 + i, content[i].id);
  console.log(`콘텐츠 ${content[i].display_name.padEnd(8)} ${String(content[i].uses).padStart(3)}회 → ${col.n} (${pat})`);
}

// 3) 휴뱅 — Open Color 중립 회색 고정
await c.query(
  `insert into color_palette (calendar_id,key,name,bg_color,text_color,border_color,sort_order)
   values ($1,'gray','회색','#e9ecef','#495057','#ced4da',1) on conflict (calendar_id,key) do update
     set bg_color=excluded.bg_color, text_color=excluded.text_color, border_color=excluded.border_color`,
  [cal]
);

// 4) 안 쓰는 gen-* 정리
const pruned = await c.query(
  `delete from color_palette where calendar_id=$1 and key like 'gen-%'
     and key not in (select color_key from broadcast_tags where calendar_id=$1) returning key`,
  [cal]
);
console.log(`prune: ${pruned.rows.map((r) => r.key).join(", ") || "none"}`);
await c.end();
console.log("완료 ✅");

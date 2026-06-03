// 태그 색 리뉴얼 v2 — Tailwind 색 스케일 벤치마킹.
//   콘텐츠(무늬): bg=Tailwind-200, text=Tailwind-700, border=Tailwind-300 → 조화롭고 글자 대비 강함.
//   방식(단색 점): bg=Tailwind-300, text=Tailwind-700, border=Tailwind-500 → 작은 점이라 더 또렷한 톤.
//   휴뱅: slate(중립 회색) 고정.
// 흙색(올리브·탁한 황토) 회피, 스펙트럼 균등 배치. 무늬는 키 접두사(gen-{pat})로 globals.css가 얹는다.
// 사용: node scripts/recolor-tags.mjs
import { readFileSync } from "node:fs";
import { Client } from "pg";

// 콘텐츠용 — '차분(cool·눈이 덜 가는)' → '선명(warm·강조)' 순. 자주 쓰는 태그(달력에 잔뜩 깔리는)는
// 앞쪽 차분한 색을, 드문 태그는 뒤쪽 선명한 색을 받아 전체가 시끄럽지 않고 조화롭게 보인다.
// 앞 6개(차분 묶음)는 서로 충분히 다른 hue(파랑·청록·초록·남보라·청록2·보라)라 고빈도끼리도 구분된다.
const CONTENT = [
  { n: "스카이", bg: "#bae6fd", text: "#0369a1", border: "#7dd3fc" },
  { n: "틸", bg: "#99f6e4", text: "#0f766e", border: "#5eead4" },
  { n: "그린", bg: "#bbf7d0", text: "#15803d", border: "#86efac" },
  { n: "인디고", bg: "#c7d2fe", text: "#4338ca", border: "#a5b4fc" },
  { n: "시안", bg: "#a5f3fc", text: "#0e7490", border: "#67e8f9" },
  { n: "바이올렛", bg: "#ddd6fe", text: "#6d28d9", border: "#c4b5fd" },
  { n: "블루", bg: "#bfdbfe", text: "#1d4ed8", border: "#93c5fd" },
  { n: "라임", bg: "#d9f99d", text: "#4d7c0f", border: "#bef264" },
  { n: "앰버", bg: "#fde68a", text: "#b45309", border: "#fcd34d" },
  { n: "핑크", bg: "#fbcfe8", text: "#be185d", border: "#f9a8d4" },
  { n: "로즈", bg: "#fecdd3", text: "#be123c", border: "#fda4af" },
  { n: "오렌지", bg: "#fed7aa", text: "#c2410c", border: "#fdba74" },
  { n: "푸시아", bg: "#f5d0fe", text: "#a21caf", border: "#f0abfc" }
];
// 방식용 — 점(작은 원). 같은 '차분→선명' 원칙. 콘텐츠와 톤이 같아 함께 조화롭다.
const MOD = [
  { n: "블루", bg: "#93c5fd", text: "#1d4ed8", border: "#3b82f6" },
  { n: "에메랄드", bg: "#6ee7b7", text: "#047857", border: "#10b981" },
  { n: "시안", bg: "#67e8f9", text: "#0e7490", border: "#06b6d4" },
  { n: "앰버", bg: "#fcd34d", text: "#b45309", border: "#f59e0b" },
  { n: "오렌지", bg: "#fdba74", text: "#c2410c", border: "#f97316" },
  { n: "퍼플", bg: "#d8b4fe", text: "#7e22ce", border: "#a855f7" },
  { n: "레드", bg: "#fca5a5", text: "#b91c1c", border: "#ef4444" }
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

// 3) 휴뱅 — 중립 회색(slate) 고정
await c.query(
  `insert into color_palette (calendar_id,key,name,bg_color,text_color,border_color,sort_order)
   values ($1,'gray','회색','#e2e8f0','#475569','#cbd5e1',1) on conflict (calendar_id,key) do update
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

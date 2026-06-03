// 태그 색 리뉴얼 v2 — Tailwind 색 스케일 벤치마킹.
//   콘텐츠(무늬): bg=Tailwind-200, text=Tailwind-700, border=Tailwind-300 → 조화롭고 글자 대비 강함.
//   방식(단색 점): bg=Tailwind-300, text=Tailwind-700, border=Tailwind-500 → 작은 점이라 더 또렷한 톤.
//   휴뱅: slate(중립 회색) 고정.
// 흙색(올리브·탁한 황토) 회피, 스펙트럼 균등 배치. 무늬는 키 접두사(gen-{pat})로 globals.css가 얹는다.
// 사용: node scripts/recolor-tags.mjs
import { readFileSync } from "node:fs";
import { Client } from "pg";

// Catppuccin Latte 벤치마킹(스트리머·버튜버 감성 포근 파스텔). 공식 accent를 연한 bg 틴트 +
// 진한 동색 글씨(라이트한 노랑·피치 accent는 글씨를 충분히 어둡게 보정해 대비 확보)로 변환.
// '차분(cool) → 선명(warm)' 순 — 자주 쓰는 태그가 앞쪽 차분한 색을 받는다.
// 앞 6(차분 묶음): 블루·틸·그린·라벤더·스카이·모브 — 서로 다른 hue라 고빈도끼리도 구분.
const CONTENT = [
  { n: "블루", bg: "#cdddfd", text: "#1b54cc", border: "#9bbcfa" },
  { n: "틸", bg: "#c5e6e8", text: "#0f6f74", border: "#8fcdd0" },
  { n: "그린", bg: "#d3eccc", text: "#2e7d1f", border: "#a9d79f" },
  { n: "라벤더", bg: "#dadffb", text: "#4e5fd0", border: "#b5c0f8" },
  { n: "스카이", bg: "#c2e9fa", text: "#0379a8", border: "#88d3f3" },
  { n: "모브", bg: "#e1d2fb", text: "#6f23d4", border: "#c3a6f6" },
  { n: "사파이어", bg: "#c6e8ee", text: "#16707f", border: "#92d2dd" },
  { n: "옐로우", bg: "#f7e6c8", text: "#9a6310", border: "#eecf99" },
  { n: "피치", bg: "#ffdcc6", text: "#c2430a", border: "#fdb78c" },
  { n: "핑크", bg: "#fad6ef", text: "#b83f96", border: "#f3b0e0" },
  { n: "마룬", bg: "#fbd2d6", text: "#c01f2d", border: "#f4a3ab" },
  { n: "레드", bg: "#f7ccd4", text: "#b00d30", border: "#ee99a6" },
  { n: "플라밍고", bg: "#f7d6d6", text: "#c14a4a", border: "#efb0b0" }
];
// 방식용 — 점(작은 원). 같은 '차분→선명' 원칙. Catppuccin accent를 더 진한 톤(보더=accent)으로.
const MOD = [
  { n: "블루", bg: "#9bbcfa", text: "#1b54cc", border: "#1e66f5" },
  { n: "그린", bg: "#a9d79f", text: "#2e7d1f", border: "#40a02b" },
  { n: "사파이어", bg: "#92d2dd", text: "#16707f", border: "#209fb5" },
  { n: "옐로우", bg: "#eecf99", text: "#9a6310", border: "#df8e1d" },
  { n: "피치", bg: "#fdb78c", text: "#c2430a", border: "#fe640b" },
  { n: "모브", bg: "#c3a6f6", text: "#6f23d4", border: "#8839ef" },
  { n: "레드", bg: "#ee99a6", text: "#b00d30", border: "#d20f39" }
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

// 3) 휴뱅 — Catppuccin Latte 중립 회색(surface) 고정
await c.query(
  `insert into color_palette (calendar_id,key,name,bg_color,text_color,border_color,sort_order)
   values ($1,'gray','회색','#dce0e8','#5c5f77','#bcc0cc',1) on conflict (calendar_id,key) do update
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

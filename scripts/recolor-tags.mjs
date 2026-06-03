// 태그 색 리뉴얼: 귀엽고 화사한 파스텔. 방식=무늬 없는 단색, 콘텐츠=무늬 색. 휴뱅=회색 고정.
// + 대분류 '조공','노래' 제거(event_tags는 기타로 이전 후 삭제). 일회성.
// 사용: node scripts/recolor-tags.mjs
import { readFileSync } from "node:fs";
import { Client } from "pg";

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const t = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${t(r)}${t(g)}${t(b)}`;
}
// 화사 파스텔(밝고 선명). 무늬 콘텐츠는 위에 옅은 무늬가 덧대져도 산뜻하게.
const mk = (h) => ({ bg: hslToHex(h, 78, 90), text: hslToHex(h, 52, 38), border: hslToHex(h, 62, 74) });

const t = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2]; }
const ref = (e.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
const c = new Client({ host: "aws-1-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres." + ref, password: e.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
await c.connect();
const cal = (await c.query("select id from calendars where slug='vic'")).rows[0].id;

// 0) 조공·노래 제거 — event_tags를 기타로 이전 후 태그 삭제.
const etc = (await c.query("select id from broadcast_tags where calendar_id=$1 and display_name='기타'", [cal])).rows[0]?.id;
const drop = (await c.query("select id, display_name from broadcast_tags where calendar_id=$1 and display_name in ('조공','노래')", [cal])).rows;
for (const d of drop) {
  if (etc) {
    await c.query(
      `update event_tags set tag_id=$1 where tag_id=$2 and event_id not in (select event_id from event_tags where tag_id=$1)`,
      [etc, d.id]
    );
  }
  await c.query("delete from broadcast_tags where id=$1", [d.id]);
  console.log(`제거: ${d.display_name}`);
}

const tags = (await c.query(
  "select id, tag_key, display_name, kind from broadcast_tags where calendar_id=$1 and is_active=true and parent_id is null order by sort_order",
  [cal]
)).rows;

// 귀여운 hue 모음(칙칙한 카키/올리브 회피). 콘텐츠/방식은 서로 다른 풀.
const CONTENT_HUES = [350, 16, 38, 52, 96, 135, 168, 190, 205, 232, 262, 305, 322, 8];
const MOD_HUES = [330, 28, 58, 150, 196, 248, 288, 12, 178];
const PATS = ["diag", "dots", "grid", "cross", "dash"];

const mods = tags.filter((x) => x.kind === "modifier");
const content = tags.filter((x) => x.kind !== "modifier" && x.tag_key !== "dayoff");

// 1) 방식 → 화사 단색(gen-plain)
for (let i = 0; i < mods.length; i++) {
  const h = MOD_HUES[i % MOD_HUES.length];
  const col = mk(h);
  const key = `gen-plain-m${i}`;
  await c.query(
    `insert into color_palette (calendar_id,key,name,bg_color,text_color,border_color,sort_order)
     values ($1,$2,$3,$4,$5,$6,$7) on conflict (calendar_id,key) do update
       set bg_color=excluded.bg_color, text_color=excluded.text_color, border_color=excluded.border_color`,
    [cal, key, mods[i].display_name, col.bg, col.text, col.border, 70 + i]
  );
  await c.query("update broadcast_tags set color_key=$1 where id=$2", [key, mods[i].id]);
  console.log(`방식  ${mods[i].display_name.padEnd(8)} → ${key} (hue ${h})`);
}

// 2) 콘텐츠 → 화사 무늬색
for (let i = 0; i < content.length; i++) {
  const h = CONTENT_HUES[i % CONTENT_HUES.length];
  const pat = PATS[i % PATS.length];
  const col = mk(h);
  const key = `gen-${pat}-c${i}`;
  await c.query(
    `insert into color_palette (calendar_id,key,name,bg_color,text_color,border_color,sort_order)
     values ($1,$2,$3,$4,$5,$6,$7) on conflict (calendar_id,key) do update
       set bg_color=excluded.bg_color, text_color=excluded.text_color, border_color=excluded.border_color`,
    [cal, key, content[i].display_name, col.bg, col.text, col.border, 50 + i]
  );
  await c.query("update broadcast_tags set color_key=$1 where id=$2", [key, content[i].id]);
  console.log(`콘텐츠 ${content[i].display_name.padEnd(8)} → ${key} (hue ${h}, ${pat})`);
}

// 3) 휴뱅은 화사한 회색으로(고정 단색)
await c.query(
  `insert into color_palette (calendar_id,key,name,bg_color,text_color,border_color,sort_order)
   values ($1,'gray','회색','#dfe3ea','#3f4654','#b9c0cd',1) on conflict (calendar_id,key) do update
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

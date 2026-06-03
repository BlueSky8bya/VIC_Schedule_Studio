// 기존 태그 색 재배치: 방식(modifier)=무늬 없는 단색(점으로만 보임), 콘텐츠=무늬 있는 색(카드에서
// 최대한 구분). 휴뱅(dayoff)은 회색 고정. 일회성. 사용: node scripts/recolor-tags.mjs
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

const t = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2]; }
const ref = (e.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
const c = new Client({ host: "aws-1-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres." + ref, password: e.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000 });
await c.connect();
const cal = (await c.query("select id from calendars where slug='vic'")).rows[0].id;
const tags = (await c.query(
  "select id, tag_key, display_name, kind from broadcast_tags where calendar_id=$1 and is_active=true order by sort_order",
  [cal]
)).rows;

// 방식: 무늬 없는 기본 단색(patternOf=plain인 것만).
const PLAIN_BASE = ["blue", "pink", "lime", "red", "teal", "lavender", "beige", "yellow", "orange"];
const PATS = ["diag", "dots", "grid", "cross", "dash"];

const mods = tags.filter((x) => x.kind === "modifier");
const content = tags.filter((x) => x.kind !== "modifier" && x.tag_key !== "dayoff");

if (mods.length > PLAIN_BASE.length) {
  console.error(`방식 ${mods.length}개 > 단색 ${PLAIN_BASE.length}개. 단색 부족.`); process.exit(1);
}

// 1) 방식 → 단색 기본 팔레트 키
for (let i = 0; i < mods.length; i++) {
  await c.query("update broadcast_tags set color_key=$1 where id=$2", [PLAIN_BASE[i], mods[i].id]);
  console.log(`방식  ${mods[i].display_name.padEnd(8)} → ${PLAIN_BASE[i]}`);
}

// 2) 콘텐츠 → 무늬 gen 색(hue 고르게 분산 + 무늬 순환)
for (let i = 0; i < content.length; i++) {
  const hue = Math.round((i * 360) / content.length + 13) % 360;
  const pat = PATS[i % PATS.length];
  const key = `gen-${pat}-c${i}`;
  const bg = hslToHex(hue, 62, 86), text = hslToHex(hue, 55, 28), border = hslToHex(hue, 52, 68);
  await c.query(
    `insert into color_palette (calendar_id, key, name, bg_color, text_color, border_color, sort_order)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (calendar_id, key) do update set bg_color=excluded.bg_color, text_color=excluded.text_color, border_color=excluded.border_color`,
    [cal, key, content[i].display_name, bg, text, border, 60 + i]
  );
  await c.query("update broadcast_tags set color_key=$1 where id=$2", [key, content[i].id]);
  console.log(`콘텐츠 ${content[i].display_name.padEnd(8)} → ${key} (hue ${hue}, ${pat})`);
}

// 3) 어떤 태그도 안 쓰는 gen-* 팔레트 정리(이전 색 잔재)
const pruned = await c.query(
  `delete from color_palette where calendar_id=$1 and key like 'gen-%'
     and key not in (select color_key from broadcast_tags where calendar_id=$1) returning key`,
  [cal]
);
console.log(`prune gen-* orphan: ${pruned.rows.map((r) => r.key).join(", ") || "none"}`);

await c.end();
console.log("완료 ✅");

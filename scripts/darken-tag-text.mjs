// 기존 색 팔레트의 글씨색만 진하게(연한 배경 위 가독성 ↑). 배경·테두리·키는 그대로.
// 각 행의 bg_color에서 hue를 뽑아 text_color=hsl(hue,62,27)로 재계산. 일회성.
// 사용: node scripts/darken-tag-text.mjs
import { readFileSync } from "node:fs";
import { Client } from "pg";

// bg → {hue, sat} (sat 0~1). 회색(채도 ~0)이면 글씨도 무채색으로 둬야 한다(회색이 빨강 안 되게).
function hexToHs(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d === 0) return { hue: 0, sat: 0 };
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { hue: ((h * 60) + 360) % 360, sat };
}
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
const rows = (await c.query("select id, key, bg_color, text_color from color_palette")).rows;
let n = 0;
for (const row of rows) {
  const hs = hexToHs(row.bg_color);
  if (!hs) continue;
  // 무채색(휴뱅 회색)은 글씨도 회색(채도 0), 유채색은 진한 동색 글씨로.
  const text = hs.sat < 0.12 ? hslToHex(0, 0, 30) : hslToHex(hs.hue, 62, 27);
  if (text.toLowerCase() === (row.text_color || "").toLowerCase()) continue;
  await c.query("update color_palette set text_color=$1 where id=$2", [text, row.id]);
  n++;
}
console.log(`darkened ${n}/${rows.length} palette text colors`);
await c.end();

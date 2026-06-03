// 태그 색 감사 — (1) WCAG 대비비(글씨 vs 배경) 4.5:1 통과 여부, (2) 색맹(적/녹/청) 시뮬 후
// 콘텐츠 배경색끼리 구분되는지(ΔE76) 검사. 읽기 전용(DB SELECT만). 사용: node scripts/audit-colors.mjs
import { readFileSync } from "node:fs";
import { Client } from "pg";

const hexToRgb = (h) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((h || "").trim());
  if (!m) return null;
  let s = m[1];
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const n = parseInt(s, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const srgbToLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const linToSrgb = (c) => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
const lum = (rgb) => { const [r, g, b] = rgb.map(srgbToLin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const la = lum(a), lb = lum(b); const [hi, lo] = la > lb ? [la, lb] : [lb, la]; return (hi + 0.05) / (lo + 0.05); };

// sRGB → Lab (D65)
function rgbToLab(rgb) {
  const [r, g, b] = rgb.map(srgbToLin);
  let x = r * 0.4124 + g * 0.3576 + b * 0.1805;
  let y = r * 0.2126 + g * 0.7152 + b * 0.0722;
  let z = r * 0.0193 + g * 0.1192 + b * 0.9505;
  x /= 0.95047; z /= 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const deltaE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Machado 2009 색맹 시뮬(심각도 1.0), 선형 RGB에 적용.
const CVD = {
  적색맹: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  녹색맹: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.011820, 0.042940, 0.968881],
  청색맹: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.303900]
};
function simulate(rgb, m) {
  const lin = rgb.map(srgbToLin);
  const o = [
    m[0] * lin[0] + m[1] * lin[1] + m[2] * lin[2],
    m[3] * lin[0] + m[4] * lin[1] + m[5] * lin[2],
    m[6] * lin[0] + m[7] * lin[1] + m[8] * lin[2]
  ];
  return o.map((c) => Math.max(0, Math.min(255, linToSrgb(c))));
}

const t = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2]; }
const ref = e.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
const c = new Client({ host: "aws-1-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres." + ref, password: e.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const cal = (await c.query("select id from calendars where slug='vic'")).rows[0].id;
const rows = (await c.query(`
  select bt.display_name name, bt.kind, bt.tag_key, cp.bg_color bg, cp.text_color txt,
    (select count(*) from event_tags et where et.tag_id=bt.id)::int uses
  from broadcast_tags bt join color_palette cp on cp.key=bt.color_key
  where bt.calendar_id=$1 and bt.is_active=true and bt.parent_id is null`, [cal])).rows;

// ── 1) WCAG 대비 ──
console.log("\n=== WCAG 대비 (글씨 vs 배경, 목표 ≥ 4.5) ===");
const audit = rows.map((r) => ({ name: r.name, kind: r.kind === "modifier" ? "방식" : "콘텐츠", ratio: +contrast(hexToRgb(r.txt), hexToRgb(r.bg)).toFixed(2), bg: r.bg, txt: r.txt }));
audit.sort((a, b) => a.ratio - b.ratio);
console.table(audit.map((a) => ({ ...a, pass: a.ratio >= 4.5 ? "OK" : a.ratio >= 3 ? "△(큰글씨만)" : "✗ FAIL" })));
const fails = audit.filter((a) => a.ratio < 4.5);
console.log(`대비 4.5 미만: ${fails.length}개 — ${fails.map((f) => `${f.name}(${f.ratio})`).join(", ") || "없음"}`);

// ── 2) 색맹 시뮬: 콘텐츠 배경색끼리 구분 ──
const content = rows.filter((r) => r.kind !== "modifier" && r.tag_key !== "dayoff");
console.log("\n=== 색맹 시뮬: 콘텐츠 배경색 구분 (ΔE76, < 12면 혼동 위험) ===");
for (const [cvd, m] of Object.entries(CVD)) {
  const sim = content.map((r) => ({ name: r.name, uses: r.uses, lab: rgbToLab(simulate(hexToRgb(r.bg), m)) }));
  const pairs = [];
  for (let i = 0; i < sim.length; i++) for (let j = i + 1; j < sim.length; j++) {
    const d = deltaE(sim[i].lab, sim[j].lab);
    if (d < 12) pairs.push({ a: sim[i].name, b: sim[j].name, dE: +d.toFixed(1), 합산빈도: sim[i].uses + sim[j].uses });
  }
  pairs.sort((x, y) => y.합산빈도 - x.합산빈도 || x.dE - y.dE);
  console.log(`\n[${cvd}] 혼동 위험 쌍 ${pairs.length}개 (합산빈도 높은 순):`);
  if (pairs.length) console.table(pairs.slice(0, 10));
  else console.log("  없음 ✅");
}
await c.end();

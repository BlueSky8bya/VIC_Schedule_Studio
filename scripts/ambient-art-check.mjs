// 앰비언트 아트 납품 검사(2026-09-08) — `art:normalize`의 게이트(색 수·반투명·채움비·떠 있는 가로줄)가
// 잡지 못하는 **한 자리 안의 관계**를 잰다. 세 가지다:
//
//   ① 도트 결   — 같은 세트인가. 합격본과 나란히 놓았을 때 어법이 갈리지 않는가(스티플/노이즈 검출).
//   ② 다양성    — 한 화면에 여러 장이 깔리는 자리에서 변형끼리 실제로 다른가(쌍별 실루엣 IoU).
//   ③ 계절 짝   — `<id>-n` · `<id>-autumn-n` · `<id>-winter-n`이 **같은 한 그루**인가.
//   (겨울 자리면 눈의 양, 가을 자리면 잎 색상도 함께 잰다.)
//
// **왜 추적되는 스크립트인가**: 이 계측을 두 번 `.scratch-pw/`에 만들었고 두 번 다 다른 기기에서 사라졌다
// (2026-09-08 인계 문서 "도구 다시 만들기"). 검사 기준이 세션마다 달라지면 "지난번보다 나아졌나"를 못 묻는다.
//
//   node scripts/ambient-art-check.mjs tree-pine                    → public/ambient/art 에서 tree-pine* 를 잰다
//   node scripts/ambient-art-check.mjs tree-pine --dir art-src/incoming-pine
//   node scripts/ambient-art-check.mjs tree-pine --baseline public/ambient/art   (반려본을 합격본과 함께 볼 때)
//
// 수치는 **폭 240으로 맞춘 뒤** 잰다 — 1024 원본과 정리본(240×432)을 그냥 비교하면 축소가 만든 잡음을 화풍 차이로 읽는다.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const VALUED = new Set(["--dir", "--baseline"]); // 값을 하나 먹는 플래그 — 그 값을 자리 이름으로 착각하면 안 된다
const flag = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !VALUED.has(args[i - 1]));
const family = positional[0];
if (!family) {
  console.error("자리 이름을 달라 — 예: node scripts/ambient-art-check.mjs tree-pine");
  process.exit(1);
}
const dir = path.resolve(root, flag("dir", "public/ambient/art"));
const baseDir = flag("baseline") ? path.resolve(root, flag("baseline")) : null;

// ── 계측 ─────────────────────────────────────────────────────────────────────────────────────
const NORM_W = 240; // 비교용 공통 폭

/** 알파 상자로 자르고 공통 폭으로 nearest 축소한 RGBA. */
async function pixels(file) {
  const t = await sharp(file).ensureAlpha().trim({ threshold: 8 }).png().toBuffer({ resolveWithObject: true });
  const h = Math.max(1, Math.round((t.info.height / t.info.width) * NORM_W));
  const { data, info } = await sharp(t.data).resize(NORM_W, h, { kernel: "nearest" }).raw().toBuffer({ resolveWithObject: true });
  return { d: data, W: info.width, H: info.height, C: info.channels, box: [t.info.width, t.info.height] };
}

/** ① 도트 결 — 한 줄에서 색이 바뀌는 횟수(스티플일수록 크다)와 같은 색이 가로로 이어지는 평균 길이. */
function texture({ d, W, H, C }) {
  const cols = new Map();
  let runs = 0, opaque = 0, changes = 0;
  for (let y = 0; y < H; y++) {
    let prev = null;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * C;
      const k = (C === 4 ? d[i + 3] : 255) > 128 ? `${d[i]},${d[i + 1]},${d[i + 2]}` : null;
      if (k) { opaque++; cols.set(k, (cols.get(k) ?? 0) + 1); }
      if (k !== prev) { if (k) runs++; if (prev && k) changes++; }
      prev = k;
    }
  }
  return { colors: cols.size, meanRun: opaque / Math.max(1, runs), changesPerRow: changes / H, opaque };
}

/** 실루엣 — 알파 상자를 격자로 나눈 칸별 불투명 비율(soft mask). */
function silhouette({ d, W, H, C }, G = 16) {
  const on = new Float64Array(G * G), n = new Float64Array(G * G);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const g = Math.min(G - 1, Math.floor((y / H) * G)) * G + Math.min(G - 1, Math.floor((x / W) * G));
    n[g]++;
    if ((C === 4 ? d[(y * W + x) * C + 3] : 255) > 96) on[g]++;
  }
  const f = new Float64Array(G * G);
  for (let i = 0; i < G * G; i++) f[i] = n[i] ? on[i] / n[i] : 0;
  return f;
}

const iou = (a, b) => {
  let lo = 0, hi = 0;
  for (let i = 0; i < a.length; i++) { lo += Math.min(a[i], b[i]); hi += Math.max(a[i], b[i]); }
  return hi ? lo / hi : 0;
};

/** 눈 — **밝고 크로마가 낮은** 화소의 비율. HSL의 S는 흰색 근처에서 오히려 커져 눈을 걸러낸다(2026-09-08에 그래서 0%로 나왔다). */
function snowShare({ d, W, H, C }) {
  let op = 0, sn = 0;
  for (let i = 0, p = 0; p < W * H; p++, i += C) {
    if ((C === 4 ? d[i + 3] : 255) <= 128) continue;
    op++;
    const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if ((mx + mn) / 2 > 190 && mx - mn < 30) sn++;
  }
  return op ? (sn / op) * 100 : 0;
}

/** 잎 색상 — 색이 있는 초록~노랑 대역만 본다(줄기 갈색·눈 제외). 노랑기 = 색상 75° 미만. */
function leafHue({ d, W, H, C }) {
  let n = 0, hs = 0, yellow = 0;
  for (let i = 0, p = 0; p < W * H; p++, i += C) {
    if ((C === 4 ? d[i + 3] : 255) <= 128) continue;
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
    if (!c) continue;
    const s = c / (255 - Math.abs(mx + mn - 255));
    let h = mx === r ? 60 * (((g - b) / c) % 6) : mx === g ? 60 * ((b - r) / c + 2) : 60 * ((r - g) / c + 4);
    if (h < 0) h += 360;
    if (s < 0.08 || h < 40 || h > 190) continue;
    n++; hs += h;
    if (h < 75) yellow++;
  }
  return n ? { mean: hs / n, yellowPct: (yellow / n) * 100, n } : null;
}

// ── 파일 모으기 ──────────────────────────────────────────────────────────────────────────────
/** `tree-pine` → 자리 셋(tree-pine · tree-pine-autumn · tree-pine-winter)의 변형 파일들. */
function collect(d) {
  if (!fs.existsSync(d)) return {};
  const out = {};
  for (const f of fs.readdirSync(d)) {
    const m = /^(.+?)-(\d+)\.png$/.exec(f);
    if (!m || !m[1].startsWith(family)) continue;
    (out[m[1]] ??= {})[Number(m[2])] = path.join(d, f);
  }
  return out;
}

const found = collect(dir);
// `--baseline`은 **합격본**이다 — 같은 이름이 양쪽에 있으면 기준선이 이긴다. (반려본 폴더에도 합격본을 되돌리기 전의
// 사본이 남아 있어서, 채우기만 하면 검사가 반려본을 기준선이라고 믿는다 — 2026-09-08에 실제로 그랬다.)
const fromBase = new Set();
if (baseDir) {
  const base = collect(baseDir);
  for (const [slot, byN] of Object.entries(base)) for (const [n, p] of Object.entries(byN)) {
    (found[slot] ??= {})[n] = p;
    fromBase.add(`${slot}-${n}`);
  }
}
const slots = Object.keys(found).sort();
if (!slots.length) {
  console.error(`${dir} 에 ${family}* 변형 파일이 없다.`);
  process.exit(1);
}

const M = {};
for (const slot of slots) {
  M[slot] = {};
  for (const [n, file] of Object.entries(found[slot])) {
    const px = await pixels(file);
    M[slot][n] = { file, px, tex: texture(px), sil: silhouette(px), snow: snowShare(px), hue: leafHue(px) };
  }
}

// ── 보고 ─────────────────────────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
const p1 = (v) => v.toFixed(1);
const warn = (bad) => (bad ? " ⚠" : "");
/** 기준선(합격본)에서 온 줄은 표시한다 — 목표치를 못 맞춰도 그건 "지금의 기준"이지 반려가 아니다. */
const tag = (slot, n) => (fromBase.has(`${slot}-${n}`) ? "  ← 기준" : "");

console.log(`\n■ 도트 결 — 같은 세트로 보이는가 (목표: 줄당 변화 ≤ 5.5 · 평균 가로 런 ≥ 18px, 폭 ${NORM_W} 기준)`);
console.log(pad("파일", 28) + pad("상자", 12) + pad("색", 6) + pad("평균가로", 10) + "줄당변화");
for (const slot of slots) for (const n of Object.keys(M[slot]).sort((a, b) => a - b)) {
  const r = M[slot][n];
  const bad = r.tex.changesPerRow > 5.5 || r.tex.meanRun < 18;
  console.log(pad(path.basename(r.file), 28) + pad(r.px.box.join("×"), 12) + pad(r.tex.colors, 6) + pad(r.tex.meanRun.toFixed(2), 10) + p1(r.tex.changesPerRow) + warn(bad) + tag(slot, n));
}

console.log(`\n■ 다양성 — 같은 자리의 변형끼리 (목표: 어느 두 장도 실루엣 일치 80% 미만)`);
for (const slot of slots) {
  const ns = Object.keys(M[slot]).sort((a, b) => a - b);
  if (ns.length < 2) { console.log(`${slot}: 변형 ${ns.length}장 — 생략`); continue; }
  let max = 0, maxp = "", sum = 0, cnt = 0, over = 0;
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const v = iou(M[slot][ns[i]].sil, M[slot][ns[j]].sil);
    sum += v; cnt++;
    if (v >= 0.8) over++;
    if (v > max) { max = v; maxp = `-${ns[i]}↔-${ns[j]}`; }
  }
  console.log(`${pad(slot, 22)} 평균 ${p1((sum / cnt) * 100)}%  최대 ${p1(max * 100)}% (${maxp})  80%↑ ${over}/${cnt}쌍${warn(over > 0)}`);
}

const seasonal = slots.filter((s) => s !== family);
if (seasonal.length) {
  console.log(`\n■ 계절 짝 — \`-n\`끼리 같은 한 그루인가 (목표: 실루엣 일치 ≥ 95%. 어긋나면 달을 넘길 때 나무가 바뀐다)`);
  for (const other of seasonal) {
    const row = [];
    let worst = 1;
    for (const n of Object.keys(M[family] ?? {}).sort((a, b) => a - b)) {
      if (!M[other][n]) continue;
      const v = iou(M[family][n].sil, M[other][n].sil);
      worst = Math.min(worst, v);
      row.push(`-${n} ${p1(v * 100)}%`);
    }
    if (row.length) console.log(`${pad(`${family} ↔ ${other}`, 40)}${warn(worst < 0.95)}\n  ${row.join("  ")}`);
  }
}

const winter = slots.filter((s) => s.endsWith("-winter"));
if (winter.length) {
  console.log(`\n■ 눈의 양 — 겨울판 (목표: 몸의 20% 이상. 그 아래면 화면에서 흰 줄 몇 가닥으로 읽힌다)`);
  for (const slot of winter) for (const n of Object.keys(M[slot]).sort((a, b) => a - b)) {
    const r = M[slot][n];
    console.log(`  ${pad(path.basename(r.file), 28)}${p1(r.snow)}%${warn(r.snow < 20)}${tag(slot, n)}`);
  }
}

const autumn = slots.filter((s) => s.endsWith("-autumn"));
if (autumn.length) {
  console.log(`\n■ 잎 색상 — 가을판 (목표: 노랑기(75° 미만) ≤ 20% · 평균 색상 ≥ 85°. 오행 규칙상 선명한 노랑 금지)`);
  for (const slot of autumn) for (const n of Object.keys(M[slot]).sort((a, b) => a - b)) {
    const r = M[slot][n];
    if (!r.hue) continue;
    const bad = r.hue.yellowPct > 20 || r.hue.mean < 85;
    console.log(`  ${pad(path.basename(r.file), 28)}평균 ${p1(r.hue.mean)}°  노랑기 ${p1(r.hue.yellowPct)}%${warn(bad)}${tag(slot, n)}`);
  }
}

console.log("");

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
const esbuild = require("esbuild");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 매니페스트가 정본이다 — 자리마다 검사가 **뜻이 있는지**가 거기 적혀 있다(한 화면에 하나뿐인 달에 "변형끼리 달라야
// 한다"를 물으면 여덟 위상이 전부 반려로 잡힌다). normalize와 같은 방식으로 번들해 읽는다.
const manifestOut = path.join(root, ".next", "cache", "ambient-art-manifest-check.cjs");
fs.mkdirSync(path.dirname(manifestOut), { recursive: true });
esbuild.buildSync({
  entryPoints: [path.join(root, "components/shared/ambient/art/manifest.ts")],
  bundle: true, platform: "node", format: "cjs", outfile: manifestOut, logLevel: "silent",
  tsconfig: path.join(root, "tsconfig.json"),
});
const { artSlot } = require(manifestOut);

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
let baseDir = flag("baseline") ? path.resolve(root, flag("baseline")) : null;

// `--baseline git` — **커밋된 판**을 기준선으로 쓴다. 납품물은 보통 합격본과 **같은 폴더에** 떨어지므로
// (`public/ambient/art/`에 -2~-8을 넣으면 -1이 그 옆에 있다) 폴더로는 둘을 가를 수 없다. 커밋 여부가 가른다:
// 커밋된 것 = 이미 합격해 화면에 쓰이던 것, 커밋 안 된 것 = 이번에 들어온 것.
if (flag("baseline") === "git") {
  const { execFileSync } = require("node:child_process");
  const rel = path.relative(root, dir).split(path.sep).join("/");
  baseDir = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "art-base-"));
  const listed = execFileSync("git", ["ls-tree", "--name-only", "HEAD", `${rel}/`], { cwd: root, encoding: "utf8" })
    .split(String.fromCharCode(10)).map((v) => v.trim()).filter((v) => v.endsWith(".png"));
  for (const f of listed) {
    const name = path.basename(f);
    if (!name.startsWith(family)) continue;
    const buf = execFileSync("git", ["show", `HEAD:${f}`], { cwd: root, maxBuffer: 1 << 28 });
    fs.writeFileSync(path.join(baseDir, name), buf);
  }
}

// ── 계측 ─────────────────────────────────────────────────────────────────────────────────────
const NORM_W = 240; // 비교용 공통 폭

/** 알파 상자로 자르고 공통 폭으로 nearest 축소한 RGBA. */
async function pixels(file) {
  const t = await sharp(file).ensureAlpha().trim({ threshold: 8 }).png().toBuffer({ resolveWithObject: true });
  const h = Math.max(1, Math.round((t.info.height / t.info.width) * NORM_W));
  const { data, info } = await sharp(t.data).resize(NORM_W, h, { kernel: "nearest" }).raw().toBuffer({ resolveWithObject: true });
  return { d: data, W: info.width, H: info.height, C: info.channels, box: [t.info.width, t.info.height] };
}

/** ① 도트 결 — 한 색이 가로로 **몇 칸** 이어지는가, 한 줄에서 색이 몇 번 바뀌는가.
 *  ⚠ **칸 단위로 잰다.** px로 재면 자리마다 도트 크기가 달라 기준이 안 선다 — 소나무에 맞춘 "평균 런 18px"이
 *  새털구름(도트가 잘고 그림이 길다)을 결함으로 잡았다. 같은 그림을 칸으로 재면 소나무 2.5칸, 새털 5.9칸이다. */
function texture({ g, GW, GH }) {
  const cols = new Map();
  let runs = 0, cells = 0, changes = 0;
  for (let y = 0; y < GH; y++) {
    let prev = null;
    for (let x = 0; x < GW; x++) {
      const k = g[y * GW + x];
      if (k) { cells++; cols.set(k, (cols.get(k) ?? 0) + 1); }
      if (k !== prev) { if (k) runs++; if (prev && k) changes++; }
      prev = k;
    }
  }
    // 색 변화는 **칸당 밀도**로 낸다 — 줄당 횟수는 그림이 넓을수록 커져(참나무 105칸 대 소나무 30칸) 자리끼리 비교가 안 된다.
  return { colors: cols.size, meanRun: cells / Math.max(1, runs), changeDensity: changes / Math.max(1, GH * GW), cells };
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

// ── 구조 결함 ────────────────────────────────────────────────────────────────────────────────
// 소유자가 눈으로 잡아 온 셋 — **한 칸씩 튀는 색 · 속에 갇힌 얼룩("구멍") · 끊긴 외곽선**. 생성기는 이것들을
// 만들어 놓고도 "다 됐다"고 말하므로, 프롬프트로는 줄일 수는 있어도 막을 수는 없다. 여기서 기계로 잡는다.
// 셋 다 **도트 격자 위에서** 재야 뜻이 맞는다(화소 단위로 재면 한 도트 안의 계단이 결함으로 잡힌다).

const lum = (k) => { const [r, g, b] = k.split(",").map(Number); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/** 눈·흰 하이라이트 칸 — 외곽선 판정에서 뺀다. 눈은 실루엣 위에 **얹히는** 것이라 그 자리의 경계는 밝은 게 맞고,
 *  빼지 않으면 겨울판이 구조적으로 전부 "외곽선 끊김"으로 잡힌다(합격본 겨울 소나무가 71.7%로 걸렸다). */
const isSnowCell = (k) => {
  const [r, g, b] = k.split(",").map(Number);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return (mx + mn) / 2 > 190 && mx - mn < 30;
};

/** 도트 격자 — 블록 크기를 **그림에서 추정한다**(자리마다 다르고, 저장할 때 정수배로 줄어 매니페스트 값과도 다르다).
 *  b×b 정렬 칸이 단색인 비율이 95% 이상인 가장 큰 b가 그 그림의 도트다. */
async function dotCells(file) {
  const t = await sharp(file).ensureAlpha().trim({ threshold: 8 }).raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels: C } = t.info, d = t.data;
  const at = (x, y) => { const i = (y * W + x) * C; return d[i + 3] > 128 ? `${d[i]},${d[i + 1]},${d[i + 2]}` : null; };
  let block = 1;
  for (const b of [2, 3, 4, 6, 8, 12, 16]) {
    if (W % b || H % b) continue;
    let ok = 0, all = 0;
    for (let cy = 0; cy < H / b; cy++) for (let cx = 0; cx < W / b; cx++) {
      all++;
      const c0 = at(cx * b, cy * b);
      let uni = true;
      for (let y = 0; y < b && uni; y++) for (let x = 0; x < b; x++) if (at(cx * b + x, cy * b + y) !== c0) { uni = false; break; }
      if (uni) ok++;
    }
    if (ok / all >= 0.95) block = b;
  }
  const GW = Math.floor(W / block), GH = Math.floor(H / block);
  const g = new Array(GW * GH);
  for (let cy = 0; cy < GH; cy++) for (let cx = 0; cx < GW; cx++) {
    const cnt = new Map();
    for (let y = 0; y < block; y++) for (let x = 0; x < block; x++) {
      const k = at(cx * block + x, cy * block + y);
      cnt.set(k, (cnt.get(k) ?? 0) + 1);
    }
    g[cy * GW + cx] = [...cnt.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return { g, GW, GH, block };
}

function structure({ g, GW, GH, block }) {
  const n4 = (i) => {
    const x = i % GW, y = (i / GW) | 0;
    return [x > 0 ? i - 1 : -1, x < GW - 1 ? i + 1 : -1, y > 0 ? i - GW : -1, y < GH - 1 ? i + GW : -1].filter((v) => v >= 0);
  };
  let body = 0;
  for (let i = 0; i < g.length; i++) if (g[i]) body++;

  // ① 고아 칸 — 이웃 넷 중 같은 색이 하나도 없다. 붓이 한 칸 미끄러진 자리이고, 화면에서 잡티로 읽힌다.
  let orphan = 0;
  for (let i = 0; i < g.length; i++) {
    if (!g[i]) continue;
    if (!n4(i).some((j) => g[j] === g[i])) orphan++;
  }

  // ② 외곽선 — 경계 칸이 **바로 안쪽 이웃보다 어두운가**. 팔레트에서 "가장 어두운 색"을 골라 견주는 방식은
  //    자리마다 색 구성이 달라 헛짚는다(참나무 봄이 51%로 나왔다) — 이웃과의 상대 밝기는 어떤 팔레트에서도 성립한다.
  const isEdge = new Uint8Array(g.length);
  const around = (i) => {
    const x = i % GW, y = (i / GW) | 0;
    let sum = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
      const c = g[ny * GW + nx];
      if (c) { sum += lum(c); n++; }
    }
    return n ? sum / n : null;
  };
  let edge = 0, edgeDark = 0;
  for (let i = 0; i < g.length; i++) {
    if (!g[i]) continue;
    const x = i % GW, y = (i / GW) | 0;
    const open = [x > 0 ? i - 1 : null, x < GW - 1 ? i + 1 : null, y > 0 ? i - GW : null, y < GH - 1 ? i + GW : null]
      .some((j) => j === null || !g[j]);
    if (!open) continue;
    if (isSnowCell(g[i])) continue; // 눈이 얹힌 자리 — 외곽선이 밝은 게 정상이다
    isEdge[i] = 1;
    edge++;
    const a = around(i);
    if (a !== null && lum(g[i]) <= a + 2) edgeDark++;
  }
  // **끊긴 곳** — 안쪽보다 밝게 남은 경계 칸의 8연결 덩어리 수. 눈 덮인 꼭대기는 한두 덩이로 끝나지만,
  // 외곽선이 여기저기 빠졌으면 덩어리가 여럿 생긴다(비율만으로는 그 둘이 구별되지 않는다).
  const seenGap = new Uint8Array(g.length);
  const lighter = (i) => { const a = around(i); return a !== null && lum(g[i]) > a + 2; };
  let gaps = 0;
  for (let i0 = 0; i0 < g.length; i0++) {
    if (seenGap[i0] || !isEdge[i0] || !lighter(i0)) continue;
    const q = [i0]; seenGap[i0] = 1;
    while (q.length) {
      const i = q.pop(), x = i % GW, y = (i / GW) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        const j = ny * GW + nx;
        if (!seenGap[j] && isEdge[j] && lighter(j)) { seenGap[j] = 1; q.push(j); }
      }
    }
    gaps++;
  }

  // ③ 눈이 **몸 위에 있는가, 테두리에 둘렀는가.** 눈 칸 중 실루엣 경계에 닿은 비율.
  //    "눈이 몸의 20% 이상"만 걸면 **윤곽을 따라 흰 테를 두르는 것으로도 충족된다** — 3차 납품이 실제로 그랬다
  //    (합격본 21%, 납품본 38~45%). 눈은 단 윗면을 덮는 것이지 나무에 후광을 씌우는 것이 아니다.
  let snowCells = 0, snowEdge = 0;
  for (let i = 0; i < g.length; i++) {
    if (!g[i] || !isSnowCell(g[i])) continue;
    snowCells++;
    const x = i % GW, y = (i / GW) | 0;
    const open = [x > 0 ? i - 1 : null, x < GW - 1 ? i + 1 : null, y > 0 ? i - GW : null, y < GH - 1 ? i + GW : null]
      .some((j) => j === null || !g[j]);
    if (open) snowEdge++;
  }

  // ④ 밑동이 **한 덩이인가.** 아래 12% 높이의 한 줄에서 불투명 덩어리가 몇 개로 갈라지는가.
  //    3차 납품은 줄기가 게 다리처럼 서너 갈래로 갈라져 내려왔다(합격본 1가닥, 납품본 3가닥).
  let trunkRuns = 0;
  for (let y = Math.floor(GH * 0.88); y < GH; y++) {
    let runs = 0, prev = false;
    for (let x = 0; x < GW; x++) { const on = !!g[y * GW + x]; if (on && !prev) runs++; prev = on; }
    if (runs > trunkRuns) trunkRuns = runs;
  }

  // ⑤ 갇힌 얼룩 — **한 가지 색으로만** 둘러싸인 작은 색 덩어리. 소유자가 "구멍이 뻥 뚫렸다"고 부르는 것이
  //    대개 이것이다(알파 구멍은 실제로 0이었다 — 배경이 비치는 게 아니라 속에 남의 색이 박혀 있다).
  const seen = new Uint8Array(g.length);
  let blob = 0;
  for (let i0 = 0; i0 < g.length; i0++) {
    if (seen[i0] || !g[i0]) continue;
    const col = g[i0], q = [i0], cells = [];
    seen[i0] = 1;
    const ring = new Set();
    while (q.length) {
      const i = q.pop(); cells.push(i);
      for (const j of n4(i)) {
        if (g[j] === col) { if (!seen[j]) { seen[j] = 1; q.push(j); } }
        else ring.add(g[j] ?? "∅");
      }
    }
    if (cells.length <= 6 && ring.size === 1 && !ring.has("∅")) blob++;
  }
  // **밝은 물체는 외곽선 규칙 밖이다.** 새털구름·구름 조각은 투명 위에 놓인 옅은 흰 획이라 "경계가 안쪽보다 어둡다"가
  // 성립하지 않는다(실측: cloud-high·cloud-wisp가 0.0%로 나왔다 — 결함이 아니라 그런 그림이다).
  let lumSum = 0;
  for (let i = 0; i < g.length; i++) if (g[i]) lumSum += lum(g[i]);
  const bright = body ? lumSum / body > 190 : false;
  return { block, body, bright, snowEdgePct: snowCells ? (snowEdge / snowCells) * 100 : null, trunkRuns, orphanPct: body ? (orphan / body) * 100 : 0, blobPer1k: body ? (blob / body) * 1000 : 0, edgeDarkPct: edge ? (edgeDark / edge) * 100 : 0, gaps };
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
    // 도트 결·구조 결함은 **줄이지 않은 원본의 도트 격자**에서 잰다 — 폭 240으로 맞추면 한 칸짜리 잡티가 이웃과 섞여 사라진다.
    const cells = await dotCells(file);
    M[slot][n] = { file, px, tex: texture(cells), sil: silhouette(px), snow: snowShare(px), hue: leafHue(px), st: structure(cells) };
  }
}

// ── 보고 ─────────────────────────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s).padEnd(n);
const p1 = (v) => v.toFixed(1);
const warn = (bad) => (bad ? " ⚠" : "");
/** 기준선(합격본)에서 온 줄은 표시한다 — 목표치를 못 맞춰도 그건 "지금의 기준"이지 반려가 아니다. */
const tag = (slot, n) => (fromBase.has(`${slot}-${n}`) ? "  ← 기준" : "");
/** 이 자리의 **합격본**(기준선에서 온 줄) — 있으면 판정은 절대 수치가 아니라 **그것과의 차이**로 한다.
 *  자리마다 도트 굵기·물체 모양이 달라 절대 임계값은 반드시 헛짚는다(겨울 참나무의 앙상한 가지, 작은 바위,
 *  긴 새털구름이 전부 그랬다). 우리가 물어야 할 것은 "합격한 그림보다 나쁜가"다. */
const baseOf = (slot) => {
  for (const n of Object.keys(M[slot])) if (fromBase.has(`${slot}-${n}`)) return M[slot][n];
  return null;
};

console.log(`\n■ 도트 결 — 같은 세트로 보이는가 (합격본 대비: 가로 런 −15% 이내 · 색 변화 밀도 +25% 이내)`);
console.log(pad("파일", 28) + pad("상자", 12) + pad("색", 6) + pad("평균가로", 10) + "변화밀도");
for (const slot of slots) for (const n of Object.keys(M[slot]).sort((a, b) => a - b)) {
  const r = M[slot][n];
  const b = baseOf(slot);
  // 합격본이 있으면 **그것보다 나쁜가**를 묻는다(런이 15% 넘게 짧아졌거나, 색 변화가 25% 넘게 잦아졌거나).
  // 없으면 느슨한 절대 기준으로만 본다 — 자리마다 도트 굵기가 달라 촘촘한 절대값은 반드시 헛짚는다.
  // 합격본이 없으면 **판정하지 않는다** — 큰 파탄만 본다. 이 지표의 정상 범위는 자리마다 다르고(바위 1.5칸,
  // 소나무 2.5칸, 새털구름 5.9칸), 절대 임계값을 세우면 이미 합격한 그림을 되레 반려하게 된다.
  const bad = b && b !== r
    ? r.tex.meanRun < b.tex.meanRun * 0.85 || r.tex.changeDensity > b.tex.changeDensity * 1.25
    : r.st.body >= 300 && r.tex.meanRun < 1.3;
  console.log(pad(path.basename(r.file), 28) + pad(r.px.box.join("×"), 12) + pad(r.tex.colors, 6) + pad(`${r.tex.meanRun.toFixed(2)}칸`, 10) + r.tex.changeDensity.toFixed(3) + warn(bad) + tag(slot, n));
}

console.log(`\n■ 구조 결함 — 생성기가 "다 됐다"고 하고 남기는 것 (합격본 대비: 고아 +5%p · 얼룩 +8 · 외곽선 −8%p · 끊긴 곳 +6 이내)`);
console.log(`  고아 = 이웃 넷 중 같은 색이 없는 칸(잡티) · 얼룩 = 한 색에만 둘러싸인 작은 덩어리(속 "구멍") · 외곽선 = 경계 칸이 안쪽보다 어두운 비율`);
console.log(`  밑동 = 맨 아래 줄이 몇 갈래인가(게 다리처럼 갈라졌나) · 눈이 테두리에 = 눈 칸 중 실루엣 가장자리에 붙은 비율(높으면 후광을 두른 것)`);
console.log(pad("파일", 28) + pad("도트", 6) + pad("몸통칸", 8) + pad("고아", 9) + pad("얼룩/천칸", 11) + pad("외곽선", 8) + pad("끊긴곳", 8) + pad("밑동", 6) + "눈이 테두리에");
let sawSmall = false;
for (const slot of slots) for (const n of Object.keys(M[slot]).sort((a, b) => a - b)) {
  const st = M[slot][n].st;
  // 작은 자리(몸통 300칸 미만: 바위·자갈)는 속이 거의 없어 고아 비율이 구조적으로 높다 — 재되 경고하지 않는다.
  const small = st.body < 300;
  if (small) sawSmall = true;
  const bs = baseOf(slot)?.st;
  // 합격본이 있으면 **그것보다 나쁜가**로 본다. 절대 임계값은 자리마다 헛짚는다 — 겨울 참나무의 앙상한 가지,
  // 몸통 100칸짜리 바위, 길고 옅은 새털구름이 모두 "결함"으로 잡혔지만 셋 다 합격한 그림이다.
  const bad = bs && bs !== st
    ? st.orphanPct > bs.orphanPct + 5 || st.blobPer1k > bs.blobPer1k + 8 || (!st.bright && (st.edgeDarkPct < bs.edgeDarkPct - 8 || st.gaps > bs.gaps + 6))
      // 밑동이 합격본보다 더 갈라졌거나, 눈이 합격본보다 훨씬 더 테두리에 몰렸으면 반려.
      // 이 둘은 3차 납품이 **재는 항목을 다 통과하고도** 틀렸던 자리다 — 재지 않으면 다음에도 같은 곳이 뚫린다.
      || st.trunkRuns > bs.trunkRuns || (st.snowEdgePct !== null && bs.snowEdgePct !== null && st.snowEdgePct > bs.snowEdgePct + 10)
    : !small && (st.orphanPct > 30 || st.blobPer1k > 60 || (!st.bright && st.edgeDarkPct < 65));
  console.log(
    pad(path.basename(M[slot][n].file), 28) + pad(`${st.block}px`, 6) + pad(st.body, 8) +
    pad(`${p1(st.orphanPct)}%${small ? "*" : ""}`, 9) + pad(p1(st.blobPer1k), 11) +
    pad(st.bright ? "밝음—" : `${p1(st.edgeDarkPct)}%`, 8) + pad(st.bright ? "-" : st.gaps, 8) +
    pad(`${st.trunkRuns}가닥`, 6) + pad(st.snowEdgePct === null ? "-" : `${p1(st.snowEdgePct)}%`, 8) + warn(bad) + tag(slot, n)
  );
}
if (slots.some((s2) => Object.values(M[s2]).some((r) => r.st.bright))) console.log("  밝음— = 옅은 흰 물체(새털구름 등) — 경계가 안쪽보다 어두울 수 없다. 외곽선은 재지 않는다.");
if (sawSmall) console.log("  * 몸통 300칸 미만 — 속이 거의 없어 고아 비율이 구조적으로 높다. 재기만 하고 경고하지 않는다.");

console.log(`\n■ 다양성 — 같은 자리의 변형끼리 (목표: 어느 두 장도 실루엣 일치 80% 미만)`);
for (const slot of slots) {
  const ns = Object.keys(M[slot]).sort((a, b) => a - b);
  if (ns.length < 2) { console.log(`${slot}: 변형 ${ns.length}장 — 생략`); continue; }
  // 한 화면에 하나만 놓이는 자리(달 위상·해)는 변형이 **같은 것의 다른 상태**다 — 여기에 "서로 달라야 한다"를
  // 물으면 여덟 위상이 전부 반려로 잡힌다. 다양성은 `perScreen`이 적힌 자리에서만 뜻이 있다.
  const meta = artSlot(slot);
  if (!meta?.perScreen) { console.log(`${pad(slot, 22)} 한 화면에 하나 — 변형끼리 달라야 할 이유가 없다(검사 제외)`); continue; }
  const smallBody = Object.values(M[slot]).some((r) => r.st.body < 300);
  let max = 0, maxp = "", sum = 0, cnt = 0, over = 0;
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
    const v = iou(M[slot][ns[i]].sil, M[slot][ns[j]].sil);
    sum += v; cnt++;
    if (v >= 0.8) over++;
    if (v > max) { max = v; maxp = `-${ns[i]}↔-${ns[j]}`; }
  }
  // 작은 물체(바위·자갈)는 16×16 격자에서 실루엣이 다 "덩어리"로 수렴한다 — 재되 경고하지 않는다.
  //   그 자리의 변별은 실루엣 전체가 아니라 윗선에서 나오고, 그건 이 지표가 보는 것이 아니다.
  console.log(`${pad(slot, 22)} 평균 ${p1((sum / cnt) * 100)}%  최대 ${p1(max * 100)}% (${maxp})  80%↑ ${over}/${cnt}쌍${smallBody ? "*" : warn(over > 0)}`);
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
    // 20%는 **소나무 합격본에서 나온 수**다(22.3%). 다른 종에 그대로 들이대면 헛짚는다(눈이 가지에만 앉는
    // 겨울 참나무가 18.8%로 걸렸다) — 그 자리의 합격본이 있을 때만 판정한다.
    const bsnow = baseOf(slot)?.snow;
    const bad = bsnow !== undefined && baseOf(slot) !== r ? r.snow < bsnow - 3 : false;
    console.log(`  ${pad(path.basename(r.file), 28)}${p1(r.snow)}%${warn(bad)}${tag(slot, n)}`);
  }
}

const autumn = slots.filter((s) => s.endsWith("-autumn"));
if (autumn.length) {
  console.log(`\n■ 잎 색상 — 가을판 (목표: 노랑기(75° 미만) ≤ 20% · 평균 색상 ≥ 85°. 오행 규칙상 선명한 노랑 금지)`);
  for (const slot of autumn) for (const n of Object.keys(M[slot]).sort((a, b) => a - b)) {
    const r = M[slot][n];
    if (!r.hue) continue;
    const bh = baseOf(slot)?.hue;
    const bad = bh && baseOf(slot) !== r ? r.hue.yellowPct > bh.yellowPct + 10 || r.hue.mean < bh.mean - 8 : r.hue.yellowPct > 20;
    console.log(`  ${pad(path.basename(r.file), 28)}평균 ${p1(r.hue.mean)}°  노랑기 ${p1(r.hue.yellowPct)}%${warn(bad)}${tag(slot, n)}`);
  }
}

console.log("");

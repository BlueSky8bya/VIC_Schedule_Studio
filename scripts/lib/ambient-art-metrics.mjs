import { createRequire } from "node:module";
const sharp = createRequire(import.meta.url)("sharp");
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

export { pixels, texture, silhouette, iou, snowShare, leafHue, dotCells, structure };

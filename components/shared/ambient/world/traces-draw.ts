// 연대기 흔적 렌더(2026-09-04, Phase A) — chronicle()이 준 흔적을 계절 장면 위에 그린다. 장면은 바탕을 그린 뒤 생물 전에 한 번
// `drawTraces(g, f, season, bakes)`를 부른다. 스프라이트는 한 번 굽는다(식물·무생물은 우리 그림 — 동물은 여기 없다).
//  · 저장소(cache) = 흙더미 · 싹(sprout) = Noto 🌱(세워 그림) · 묘목(sapling) = Noto 🌿 · 나무(tree) = 위에서 본 캐노피(계절색; 겨울은
//    헐벗은 잔가지) + 발밑 그림자 · 두더지 흙더미(molehill) = 흙더미(여름엔 풀 얼룩) · 눈사람(snowman) = 공 1~3 + 나뭇가지 팔 ·
//    연잎(lilypad) = 갈라진 둥근 잎 + 물빛 그늘.
// 좌표는 정규화(u,v) → 캔버스 px. 핫 존(달력) 안에 떨어지면 그리지 않는다(어차피 가려진다; 캔버스 비용도 아낀다).

import type { Frame } from "@/components/shared/ambient/scene-engine";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import { ASSET, loadSprite, type Sprite } from "@/components/shared/ambient/assets";
import { makeCanvas, rng, shadowSprite, softBlob, TAU } from "@/components/shared/ambient/scenes/util";

export type TraceBakes = {
  mound: HTMLCanvasElement;
  mole: HTMLCanvasElement;
  patch: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
  canopy: Map<string, HTMLCanvasElement>; // `${season}:${age}`
  bare: Map<number, HTMLCanvasElement>;
  snowman: Map<number, HTMLCanvasElement>;
  lily: HTMLCanvasElement;
  sprout: Sprite | null;
  sapling: Sprite | null;
};

const CANOPY: Record<SeasonKey, string[]> = {
  spring: ["#8fb07a", "#7aa068", "#a3c08c"],
  summer: ["#6f9a62", "#5f8a56", "#7fa870"],
  autumn: ["#9a7a4c", "#8a6a44", "#a88a58"],
  winter: ["#8a8f86", "#7a807a", "#9a9f96"]
};

export function bakeTraces(): TraceBakes {
  // 흙더미 — 가을 장면의 것과 같은 문법(작은 갈색 봉우리, 옅은 테).
  const mound = makeCanvas(26, 16);
  {
    const g = mound.g;
    g.translate(13, 8);
    g.scale(1, 16 / 26);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, 13);
    rg.addColorStop(0, "rgb(88 66 46 / 0.55)");
    rg.addColorStop(0.55, "rgb(120 95 70 / 0.5)");
    rg.addColorStop(0.82, "rgb(152 128 98 / 0.4)");
    rg.addColorStop(1, "rgb(152 128 98 / 0)");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(0, 0, 13, 0, TAU);
    g.fill();
  }
  // 두더지 흙더미 — 봉긋한 새 흙(따뜻한 갈색, 위쪽 빛·아래쪽 그늘). 잔디 위에서 회색 얼룩으로 읽히지 않게 저장소 흙더미보다 크고 따뜻하다.
  const mole = makeCanvas(34, 22);
  {
    const g = mole.g;
    g.translate(17, 12);
    softBlob(g, 1, 3, 15, "60 46 34", 0.22, 0); // 발밑 그늘
    g.save();
    g.scale(1, 0.62);
    const rg = g.createRadialGradient(-4, -5, 1, 0, 0, 14);
    rg.addColorStop(0, "#a8896a");
    rg.addColorStop(0.6, "#8a6a4c");
    rg.addColorStop(1, "#6f543c");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(0, 0, 14, 0, TAU);
    g.fill();
    g.restore();
    // 흙 알갱이 몇 점.
    g.fillStyle = "rgb(60 46 34 / 0.45)";
    for (const [x, y] of [[-6, -2], [3, -4], [7, 2], [-2, 4], [1, -1]] as const) {
      g.beginPath();
      g.arc(x, y, 0.9, 0, TAU);
      g.fill();
    }
  }
  // 풀 얼룩(여름 두더지 자리) — 조금 더 진한 초록 얼룩.
  const patch = makeCanvas(40, 28);
  softBlob(patch.g, 20, 14, 18, "96 150 92", 0.28, 0);
  const lily = makeCanvas(64, 64);
  {
    const g = lily.g;
    g.translate(32, 32);
    // 연잎 — 둥근 잎에 한 곳 V자 갈라짐, 잎맥 몇 줄, 가장자리 살짝 밝게.
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, 28, 0.35, TAU - 0.35);
    g.closePath();
    const rg = g.createRadialGradient(-6, -6, 2, 0, 0, 28);
    rg.addColorStop(0, "#8fb894");
    rg.addColorStop(1, "#5f8f6c");
    g.fillStyle = rg;
    g.fill();
    g.strokeStyle = "rgb(255 255 250 / 0.35)";
    g.lineWidth = 1.2;
    g.stroke();
    g.strokeStyle = "rgb(60 100 70 / 0.35)";
    g.lineWidth = 0.9;
    for (let i = 0; i < 7; i++) {
      const a = 0.9 + (i / 6) * (TAU - 1.8);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
      g.stroke();
    }
  }
  const bakes: TraceBakes = {
    mound: mound.c,
    mole: mole.c,
    patch: patch.c,
    shadow: shadowSprite(96, 96, "40 34 30", 0.5),
    canopy: new Map(),
    bare: new Map(),
    snowman: new Map(),
    lily: lily.c,
    sprout: null,
    sapling: null
  };
  void loadSprite(ASSET.sprout, 28, 28).then((s) => (bakes.sprout = s)).catch(() => {});
  void loadSprite(ASSET.herb, 40, 40).then((s) => (bakes.sapling = s)).catch(() => {});
  return bakes;
}

// 캐노피 — 위에서 본 나무: 둥근 잎 뭉치 여러 개(반지름 R만큼 큼), 안쪽이 어둡고 바깥이 밝다. 결정적(R·계절별 한 장).
const treeRadius = (age: number) => 26 + Math.min(5, age) * 8;
function canopySprite(season: SeasonKey, R: number): HTMLCanvasElement {
  const S = R * 2 + 12;
  const { c, g } = makeCanvas(S, S);
  const r = rng(1000 + R * 7);
  g.translate(S / 2, S / 2);
  const cols = CANOPY[season];
  const blobs = 6 + Math.round(R / 3);
  for (let i = 0; i < blobs; i++) {
    const a = r() * TAU;
    const d = r() * R * 0.62;
    const rr = R * (0.32 + r() * 0.22);
    g.fillStyle = cols[i % cols.length];
    g.beginPath();
    g.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, TAU);
    g.fill();
  }
  // 안쪽 그늘·바깥 빛 — 위에서 본 둥근 덩어리 느낌.
  const sh = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
  sh.addColorStop(0, "rgb(30 40 24 / 0.22)");
  sh.addColorStop(0.7, "rgb(30 40 24 / 0.05)");
  sh.addColorStop(1, "rgb(255 255 240 / 0.12)");
  g.fillStyle = sh;
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.fill();
  return c;
}
// 헐벗은 나무(겨울) — 위에서 본 수관(樹冠)은 곧은 살이 아니라 **갈라지는 가지의 그물**이다(곧은 살 8개 = 거미로 읽혔다, 2026-09-04 실측).
// 줄기에서 주가지 4~5 → 세 번 갈라지며 가늘어진다(끝은 0.6px). 가지 위엔 눈(흰 선 살짝 어긋나게), 안쪽은 옅은 둥근 그늘.
function bareSprite(R: number): HTMLCanvasElement {
  const S = R * 2 + 12;
  const { c, g } = makeCanvas(S, S);
  const r = rng(500 + R * 11);
  g.translate(S / 2, S / 2);
  g.lineCap = "round";
  g.lineJoin = "round";
  const branch = (x: number, y: number, a: number, len: number, depth: number, width: number) => {
    const bend = (r() - 0.5) * 0.35;
    const mx = x + Math.cos(a + bend) * len * 0.5;
    const my = y + Math.sin(a + bend) * len * 0.5;
    const ex = x + Math.cos(a) * len;
    const ey = y + Math.sin(a) * len;
    g.strokeStyle = `rgb(96 84 76 / ${0.72 - depth * 0.1})`;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(mx, my, ex, ey);
    g.stroke();
    // 눈 — 가지의 위쪽(화면 위 = 북서쪽 빛) 한 올.
    g.strokeStyle = `rgb(255 255 255 / ${0.55 - depth * 0.08})`;
    g.lineWidth = Math.max(0.5, width * 0.5);
    g.beginPath();
    g.moveTo(x - 0.7, y - 0.7);
    g.quadraticCurveTo(mx - 0.7, my - 0.7, ex - 0.7, ey - 0.7);
    g.stroke();
    if (depth < 3) {
      const n = depth === 0 ? 3 : 2 + (r() < 0.45 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const spread = depth === 0 ? 0.9 : 1.15;
        branch(ex, ey, a + (i - (n - 1) / 2) * (spread / Math.max(1, n - 1)) + (r() - 0.5) * 0.3, len * (0.5 + r() * 0.2), depth + 1, Math.max(0.6, width * 0.62));
      }
    }
  };
  const mains = 4 + (r() < 0.5 ? 1 : 0);
  const off = r() * TAU;
  for (let i = 0; i < mains; i++) branch(0, 0, off + (i / mains) * TAU + (r() - 0.5) * 0.5, R * (0.42 + r() * 0.14), 0, 2.6);
  // 줄기 마디 — 위에서 본 줄기 끝(작은 갈색 원)과 그 위의 눈.
  g.fillStyle = "rgb(84 70 60)";
  g.beginPath();
  g.arc(0, 0, 3.2, 0, TAU);
  g.fill();
  g.fillStyle = "rgb(255 255 255 / 0.8)";
  g.beginPath();
  g.arc(-0.8, -0.8, 1.8, 0, TAU);
  g.fill();
  return c;
}
// 눈사람 — 단계별 공(1~3) + 완성엔 나뭇가지 팔·석탄 눈·(무채색) 단추. 위에서 본 것이 아니라 세워 그린 소품(오리와 같은 규칙).
function snowmanSprite(stage: number): HTMLCanvasElement {
  const S = 72;
  const { c, g } = makeCanvas(S, S);
  g.translate(S / 2, S - 6);
  const ball = (cx: number, cy: number, rr: number) => {
    const rg = g.createRadialGradient(cx - rr * 0.35, cy - rr * 0.4, rr * 0.1, cx, cy, rr);
    rg.addColorStop(0, "#ffffff");
    rg.addColorStop(0.8, "#e9eef3");
    rg.addColorStop(1, "#c9d4de");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(cx, cy, rr, 0, TAU);
    g.fill();
  };
  ball(0, -16, 16);
  if (stage >= 2) ball(0, -38, 12);
  if (stage >= 3) {
    ball(0, -55, 9);
    g.strokeStyle = "rgb(84 70 60)";
    g.lineWidth = 2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-11, -40);
    g.lineTo(-24, -50);
    g.moveTo(11, -40);
    g.lineTo(24, -50);
    g.stroke();
    g.fillStyle = "#3b3f46";
    for (const [x, y, r] of [[-3, -57, 1.3], [3, -57, 1.3], [0, -36, 1.2], [0, -30, 1.2]] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  }
  return c;
}

// 나무 한 그루(반지름 R) — 겨울은 헐벗은 가지, 그 외는 계절색 캐노피 + 해 방향 그림자(새벽·아침 = 서쪽, 노을·저녁 = 동쪽).
function drawTree(g: CanvasRenderingContext2D, f: Frame, season: SeasonKey, b: TraceBakes, x: number, y: number, R: number) {
  if (season === "winter") {
    let s = b.bare.get(R);
    if (!s) {
      s = bareSprite(R);
      b.bare.set(R, s);
    }
    g.save();
    g.globalAlpha = 0.22;
    g.translate(x + 4, y + 6);
    g.drawImage(b.shadow, -s.width * 0.45, -s.height * 0.45, s.width * 0.9, s.height * 0.9);
    g.restore();
    g.drawImage(s, x - s.width / 2, y - s.height / 2);
    return;
  }
  const key = `${season}:${R}`;
  let s = b.canopy.get(key);
  if (!s) {
    s = canopySprite(season, R);
    b.canopy.set(key, s);
  }
  const h = f.time.hour;
  const dx = h < 12 ? -10 - Math.max(0, 11 - h) * 2 : 10 + Math.max(0, h - 13) * 2;
  g.save();
  g.globalAlpha = 0.28;
  g.translate(x + dx * 0.5, y + 10);
  g.drawImage(b.shadow, -s.width * 0.55, -s.height * 0.5, s.width * 1.1, s.height);
  g.restore();
  g.drawImage(s, x - s.width / 2, y - s.height / 2);
}

// 여름 물가 — 물 장면의 위 띠는 **뭍**이다(계획서 §3.2 "물가": 갈대·통나무가 서는 가장자리). 땅의 흔적(데뷔 나무·나무·싹·흙더미)이
// 물 위에 떠 보이지 않게 모래·풀이 섞인 부드러운 기슭 띠를 한 번 굽고, 그 위에만 땅 흔적을 그린다.
export const SHORE_V = 0.115; // 기슭 띠의 아래 끝(정규화 세로)
export function bakeShore(w: number, h: number): HTMLCanvasElement {
  const H = Math.round(h * SHORE_V) + 24;
  const { c, g } = makeCanvas(Math.max(1, w), H);
  const r = rng(77 + w);
  const edge = H - 24;
  // 모래빛 바탕 → 물 쪽으로 옅어진다.
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgb(226 216 192 / 0.92)");
  grad.addColorStop(0.7, "rgb(222 212 188 / 0.85)");
  grad.addColorStop(1, "rgb(222 212 188 / 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, H);
  // 물가 선 — 살짝 굽이치는 흰 거품 선 + 젖은 모래(진한 띠).
  g.beginPath();
  for (let x = 0; x <= w; x += 12) {
    const y = edge + Math.sin(x * 0.02 + 0.7) * 3 + Math.sin(x * 0.053) * 1.5;
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.strokeStyle = "rgb(150 135 105 / 0.35)";
  g.lineWidth = 6;
  g.stroke();
  g.strokeStyle = "rgb(255 255 250 / 0.75)";
  g.lineWidth = 1.6;
  g.stroke();
  // 풀포기·조약돌 — 봄 바탕과 같은 문법으로 조금만.
  g.lineCap = "round";
  const tufts = Math.round(w / 14);
  for (let i = 0; i < tufts; i++) {
    const x = r() * w;
    const y = r() * (edge - 6);
    for (let k = 0; k < 3; k++) {
      const len = 5 + r() * 7;
      const a = -Math.PI / 2 + (r() - 0.5) * 1.4;
      g.strokeStyle = r() < 0.5 ? "rgb(150 178 118 / 0.6)" : "rgb(120 160 104 / 0.55)";
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(x + k * 2 - 2, y);
      g.lineTo(x + k * 2 - 2 + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
  }
  const pebbles = Math.round(w / 90);
  for (let i = 0; i < pebbles; i++) {
    const x = r() * w;
    const y = edge - 4 - r() * 14;
    const rr = 2 + r() * 2.5;
    g.fillStyle = r() < 0.5 ? "rgb(178 172 160)" : "rgb(160 150 138)";
    g.beginPath();
    g.ellipse(x, y, rr * 1.3, rr * 0.9, r() * TAU, 0, TAU);
    g.fill();
  }
  return c;
}

const LAND_KINDS = new Set(["cache", "sprout", "sapling", "tree", "molehill", "snowman", "debut"]);

/** 흔적을 그린다 — 바탕 뒤·생물 앞. hideCaches = 장면이 저장소를 제 흙더미 시스템으로 그릴 때(가을) 중복을 피한다.
 *  landOnShore = 물 장면(여름): 땅의 흔적은 기슭 띠(v ≤ SHORE_V) 안에 있는 것만 그린다. */
export function drawTraces(g: CanvasRenderingContext2D, f: Frame, season: SeasonKey, b: TraceBakes, opts: { hideCaches?: boolean; landOnShore?: boolean } = {}) {
  const hot = f.hot;
  const inHot = (x: number, y: number) => !!hot && x >= hot.x - 10 && x <= hot.x + hot.w + 10 && y >= hot.y - 10 && y <= hot.y + hot.h + 10;
  for (const t of f.traces) {
    const x = t.u * f.w;
    const y = t.v * f.h;
    if (inHot(x, y)) continue;
    if (opts.landOnShore && LAND_KINDS.has(t.kind) && t.v > SHORE_V) continue;
    switch (t.kind) {
      case "cache":
        if (opts.hideCaches) break;
        g.save();
        g.globalAlpha = t.stage === 1 ? 0.7 : 0.55;
        g.drawImage(b.mound, x - 13, y - 8);
        g.restore();
        break;
      case "molehill":
        if (t.stage === 1) g.drawImage(b.patch, x - 20, y - 14);
        else g.drawImage(b.mole, x - 17, y - 12);
        break;
      case "sprout":
        if (b.sprout) {
          const k = 0.6 + 0.5 * t.stage;
          g.save();
          g.globalAlpha = 0.28;
          g.translate(x + 2, y + 4);
          g.drawImage(b.shadow, -9 * k, -5 * k, 18 * k, 10 * k);
          g.restore();
          g.drawImage(b.sprout.c, x - (14 * k), y - 24 * k, 28 * k, 28 * k);
        }
        break;
      case "sapling":
        if (b.sapling) {
          const k = 0.7 + 0.5 * t.stage;
          g.save();
          g.globalAlpha = 0.3;
          g.translate(x + 3, y + 5);
          g.drawImage(b.shadow, -13 * k, -7 * k, 26 * k, 14 * k);
          g.restore();
          g.drawImage(b.sapling.c, x - 20 * k, y - 34 * k, 40 * k, 40 * k);
        }
        break;
      case "tree":
        drawTree(g, f, season, b, x, y, treeRadius(t.stage));
        break;
      case "debut": {
        // 데뷔 나무 — 2023-05 씨앗(흙더미) → 2025-10-01 싹 → 실제 키(cm)로 자란다: 15cm까지 싹 🌱, 80cm까지 어린 나무 🌿,
        // 그 뒤는 키에 비례하는 캐노피(위에서 본 수관 반지름 ≈ 키의 1/12, 상한 84px). 겨울엔 헐벗은 가지.
        const hcm = t.stage;
        if (hcm <= 0) {
          g.save();
          g.globalAlpha = 0.6;
          g.drawImage(b.mound, x - 13, y - 8);
          g.restore();
        } else if (hcm < 15 && b.sprout) {
          const k = 0.6 + (hcm / 15) * 0.5;
          g.save();
          g.globalAlpha = 0.28;
          g.translate(x + 2, y + 4);
          g.drawImage(b.shadow, -9 * k, -5 * k, 18 * k, 10 * k);
          g.restore();
          g.drawImage(b.sprout.c, x - 14 * k, y - 24 * k, 28 * k, 28 * k);
        } else if (hcm < 80 && b.sapling) {
          const k = 0.8 + ((hcm - 15) / 65) * 0.9;
          g.save();
          g.globalAlpha = 0.3;
          g.translate(x + 3, y + 5);
          g.drawImage(b.shadow, -13 * k, -7 * k, 26 * k, 14 * k);
          g.restore();
          g.drawImage(b.sapling.c, x - 20 * k, y - 34 * k, 40 * k, 40 * k);
        } else {
          const R = Math.round(Math.min(84, 14 + hcm / 12) / 4) * 4;
          drawTree(g, f, season, b, x, y, R);
        }
        break;
      }
      case "snowman": {
        let s = b.snowman.get(t.stage);
        if (!s) {
          s = snowmanSprite(t.stage);
          b.snowman.set(t.stage, s);
        }
        g.save();
        g.globalAlpha = 0.25;
        g.translate(x + 2, y + 3);
        g.drawImage(b.shadow, -22, -9, 44, 18);
        g.restore();
        g.drawImage(s, x - s.width / 2, y - s.height + 8);
        break;
      }
      case "lilypad": {
        const k = t.stage;
        g.save();
        g.globalAlpha = 0.28;
        g.translate(x + 2, y + 3);
        g.drawImage(b.shadow, -34 * k, -34 * k, 68 * k, 68 * k);
        g.restore();
        g.save();
        g.translate(x, y);
        g.rotate((t.u * 7 + t.v * 5) % TAU);
        g.drawImage(b.lily, -32 * k, -32 * k, 64 * k, 64 * k);
        g.restore();
        break;
      }
    }
  }
}

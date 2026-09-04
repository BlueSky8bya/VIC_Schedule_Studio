// 연대기 흔적 렌더(2026-09-04, Phase A) — chronicle()이 준 흔적을 계절 장면 위에 그린다. 장면은 바탕을 그린 뒤 생물 전에 한 번
// `drawTraces(g, f, season, bakes)`를 부른다. 스프라이트는 한 번 굽는다(식물·무생물은 우리 그림 — 동물은 여기 없다).
//  · 저장소(cache) = 흙더미 · 싹(sprout) · 묘목(sapling) · 나무(tree) · 두더지 흙더미(molehill, 여름엔 풀 얼룩) · 눈사람(snowman) · 연잎(lilypad).
//  · **아트 우선(2026-09-04, art/manifest.ts)**: `public/ambient/art/<id>.png`가 있으면 그 그림(나무 = 동물의 숲 카메라로 세운 그림,
//    발밑 그림자는 여기서), 없으면 옛 대체물(코드 도형·Noto 이모지). 소품은 `drawProp`(art/props.ts)로 한 API.
//  · **3/4 시점(PLAN-004 §2.5)**: 좌표는 정규화(u,v) → `toScreen`(지평선 아래 땅), 크기는 `depthScale`(위 = 멀다 = 작다), 납작한 것
//    (흙더미·풀 얼룩·연잎)은 `GROUND_SQUASH`로 세로 눌림. 축척은 `scale.ts`(참나무 성목 수관 폭 128, 데뷔 상한 192).
// 핫 존(달력) 안에 떨어지면 그리지 않는다(어차피 가려진다; 캔버스 비용도 아낀다).

import type { Frame } from "@/components/shared/ambient/scene-engine";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import { ASSET, loadSprite, type Sprite } from "@/components/shared/ambient/assets";
import { ArtSet, drawArt } from "@/components/shared/ambient/art/load";
import { drawProp } from "@/components/shared/ambient/art/props";
import { makeCanvas, rng, shadowSprite, TAU } from "@/components/shared/ambient/scenes/util";
import { SIZE } from "./scale";
import { depthScale, GROUND_SQUASH, toScreen } from "./view";

export type TraceBakes = {
  shadow: HTMLCanvasElement;
  canopy: Map<string, HTMLCanvasElement>; // `${season}:${R}`
  bare: Map<number, HTMLCanvasElement>;
  sprout: Sprite | null;
  sapling: Sprite | null;
  /** 아트 자리(있는 것만 쓴다) */
  art: ArtSet;
};

const TRACE_ART = [
  "tree-oak-spring",
  "tree-oak-summer",
  "tree-oak-autumn",
  "tree-oak-winter",
  "sapling-green",
  "sapling-autumn",
  "sapling-bare",
  "sprout",
  "soil-mound",
  "molehill",
  "grass-patch",
  "lilypad",
  "lotus",
  "snowman-1",
  "snowman-2",
  "snowman-3"
] as const;

const CANOPY: Record<SeasonKey, string[]> = {
  spring: ["#8fb07a", "#7aa068", "#a3c08c"],
  summer: ["#6f9a62", "#5f8a56", "#7fa870"],
  autumn: ["#9a7a4c", "#8a6a44", "#a88a58"],
  winter: ["#8a8f86", "#7a807a", "#9a9f96"]
};

export function bakeTraces(): TraceBakes {
  const bakes: TraceBakes = {
    shadow: shadowSprite(96, 96, "40 34 30", 0.5),
    canopy: new Map(),
    bare: new Map(),
    sprout: null,
    sapling: null,
    // 나무는 키에 따라 크게 확대되므로 3배로 굽는다.
    art: new ArtSet(TRACE_ART, { scale: 2, scaleOf: { "tree-oak-spring": 3, "tree-oak-summer": 3, "tree-oak-autumn": 3, "tree-oak-winter": 3 } })
  };
  void loadSprite(ASSET.sprout, 28, 28).then((s) => (bakes.sprout = s)).catch(() => {});
  void loadSprite(ASSET.herb, 40, 40).then((s) => (bakes.sapling = s)).catch(() => {});
  return bakes;
}

// 수관 반지름 — 나이 1 = 40, 5년째부터 성목 SIZE.treeCrownW/2(64) · 데뷔 나무는 키(cm)/12, 상한 SIZE.debutCrownW/2(96).
const MATURE_R = SIZE.treeCrownW / 2;
const treeRadius = (age: number) => Math.round(MATURE_R - 24 + Math.min(5, age) * 4.8);
const debutRadius = (hcm: number) => Math.round(Math.min(SIZE.debutCrownW / 2, 14 + hcm / 12) / 4) * 4;

// 캐노피(대체물) — 위에서 본 나무: 둥근 잎 뭉치 여러 개(반지름 R만큼 큼), 안쪽이 어둡고 바깥이 밝다. 결정적(R·계절별 한 장).
export function canopyTreeSprite(season: SeasonKey, R: number): HTMLCanvasElement {
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
// 헐벗은 나무(대체물, 겨울) — 위에서 본 수관은 곧은 살이 아니라 **갈라지는 가지의 그물**(곧은 살 8개 = 거미로 읽혔다). 소유자 2026-09-04:
// "말미잘 같다" → 아트(tree-oak-winter.png)가 오면 그것으로 대체된다.
export function bareTreeSprite(R: number): HTMLCanvasElement {
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

// 나무 한 그루(수관 반지름 R — 이미 거리 축소가 곱해진 값, (x,y) = 수관 중심 자리) — 아트가 있으면 동물의 숲 카메라로 세운 그림(발은
// y + 0.9R, 수관 폭 ≈ 2R, 발밑 타원 그림자 + 해 방향), 없으면 대체물(겨울 = 헐벗은 가지, 그 외 = 계절색 캐노피).
function drawTree(g: CanvasRenderingContext2D, f: Frame, season: SeasonKey, b: TraceBakes, x: number, y: number, R: number) {
  const h = f.time.hour;
  const dx = h < 12 ? -10 - Math.max(0, 11 - h) * 2 : 10 + Math.max(0, h - 13) * 2;
  const art = b.art.get(`tree-oak-${season}`);
  if (art) {
    const k = (2 * R) / art.w;
    const base = y + R * 0.9;
    g.save();
    g.globalAlpha = 0.26;
    g.translate(x + dx * 0.35, base - 2);
    g.drawImage(b.shadow, -R * 0.95, -R * 0.3, R * 1.9, R * 0.6);
    g.restore();
    drawArt(g, art, x, base, k);
    return;
  }
  if (season === "winter") {
    let s = b.bare.get(R);
    if (!s) {
      s = bareTreeSprite(R);
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
    s = canopyTreeSprite(season, R);
    b.canopy.set(key, s);
  }
  g.save();
  g.globalAlpha = 0.28;
  g.translate(x + dx * 0.5, y + 10);
  g.drawImage(b.shadow, -s.width * 0.55, -s.height * 0.5, s.width * 1.1, s.height);
  g.restore();
  g.drawImage(s, x - s.width / 2, y - s.height / 2);
}

// 싹·묘목 — 아트가 있으면 그것(바닥 접점 = y + 4), 없으면 Noto 이모지(옛 자리 그대로). k에는 거리 축소가 이미 곱해져 있다.
function drawSprout(g: CanvasRenderingContext2D, b: TraceBakes, x: number, y: number, k: number) {
  g.save();
  g.globalAlpha = 0.28;
  g.translate(x + 2, y + 4);
  g.drawImage(b.shadow, -9 * k, -5 * k, 18 * k, 10 * k);
  g.restore();
  if (b.art.has("sprout")) {
    drawProp(g, b.art, "sprout", x, y + 4, { k });
    return;
  }
  if (b.sprout) g.drawImage(b.sprout.c, x - 14 * k, y - 24 * k, 28 * k, 28 * k);
}
function drawSapling(g: CanvasRenderingContext2D, season: SeasonKey, b: TraceBakes, x: number, y: number, k: number) {
  g.save();
  g.globalAlpha = 0.3;
  g.translate(x + 3, y + 5);
  g.drawImage(b.shadow, -13 * k, -7 * k, 26 * k, 14 * k);
  g.restore();
  const id = season === "winter" ? "sapling-bare" : season === "autumn" ? "sapling-autumn" : "sapling-green";
  if (b.art.has(id)) {
    drawProp(g, b.art, id, x, y + 5, { k });
    return;
  }
  if (b.sapling) g.drawImage(b.sapling.c, x - 20 * k, y - 34 * k, 40 * k, 40 * k);
}

// 여름 물가 — 물 장면의 위 띠는 **뭍**이다(계획서 §3.2 "물가": 갈대·통나무가 서는 가장자리). 땅의 흔적(데뷔 나무·나무·싹·흙더미)이
// 물 위에 떠 보이지 않게 모래·풀이 섞인 부드러운 기슭 띠를 한 번 굽고, 그 위에만 땅 흔적을 그린다. (PLAN-004 P1에서 연못·해안
// 바이옴으로 이사한다 — 초원 여름은 물 없음.)
export const SHORE_V = 0.115; // 기슭 띠의 아래 끝(정규화 세로)
export function bakeShore(w: number, h: number): HTMLCanvasElement {
  const H = Math.round(h * SHORE_V) + 24;
  const { c, g } = makeCanvas(Math.max(1, w), H);
  const r = rng(77 + w);
  const edge = H - 24;
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "rgb(226 216 192 / 0.92)");
  grad.addColorStop(0.7, "rgb(222 212 188 / 0.85)");
  grad.addColorStop(1, "rgb(222 212 188 / 0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, w, H);
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
const hash01 = (a: number, b: number) => (((Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1) + 1) % 1;

/** 흔적을 그린다 — 바탕 뒤·생물 앞. hideCaches = 장면이 저장소를 제 흙더미 시스템으로 그릴 때(가을) 중복을 피한다.
 *  landOnShore = 물 장면(연못): 땅의 흔적은 기슭 띠(v ≤ SHORE_V) 안에 있는 것만 그린다. water = 물 흔적(연잎)을 그리는 장면(연못만 —
 *  초원엔 물이 없다, PLAN-004). 먼 것(위)부터 그린다(y-sort). */
export function drawTraces(g: CanvasRenderingContext2D, f: Frame, season: SeasonKey, b: TraceBakes, opts: { hideCaches?: boolean; landOnShore?: boolean; water?: boolean } = {}) {
  const hot = f.hot;
  const inHot = (x: number, y: number) => !!hot && x >= hot.x - 10 && x <= hot.x + hot.w + 10 && y >= hot.y - 10 && y <= hot.y + hot.h + 10;
  const items = f.traces
    .filter((t) => (t.kind === "lilypad" ? !!opts.water : true))
    .map((t) => {
      const [x, y] = opts.landOnShore && LAND_KINDS.has(t.kind) ? [t.u * f.w, t.v * f.h] : toScreen(t.u, t.v, f.w, f.h);
      return { t, x, y };
    })
    .sort((a, c) => a.y - c.y);
  for (const { t, x, y } of items) {
    if (inHot(x, y)) continue;
    if (opts.landOnShore && LAND_KINDS.has(t.kind) && t.v > SHORE_V) continue;
    const ds = depthScale(y, f.h);
    switch (t.kind) {
      case "cache":
        if (opts.hideCaches) break;
        drawProp(g, b.art, "soil-mound", x, y, { alpha: t.stage === 1 ? 0.7 : 0.55, k: ds, sy: GROUND_SQUASH });
        break;
      case "molehill":
        if (t.stage === 1) drawProp(g, b.art, "grass-patch", x, y, { k: ds, sy: GROUND_SQUASH });
        else drawProp(g, b.art, "molehill", x, y + 8 * ds, { k: ds });
        break;
      case "sprout":
        drawSprout(g, b, x, y, (0.6 + 0.5 * t.stage) * ds);
        break;
      case "sapling":
        drawSapling(g, season, b, x, y, (0.7 + 0.5 * t.stage) * ds);
        break;
      case "tree":
        drawTree(g, f, season, b, x, y, Math.round((treeRadius(t.stage) * ds) / 4) * 4);
        break;
      case "debut": {
        // 데뷔 나무 — 2023-05 씨앗(흙더미) → 2025-10-01 싹 → 실제 키(cm)로 자란다: 15cm까지 싹, 80cm까지 어린 나무,
        // 그 뒤는 키에 비례하는 수관(반지름 ≈ 키의 1/12, 상한 SIZE.debutCrownW/2). 겨울엔 헐벗은 가지.
        const hcm = t.stage;
        if (hcm <= 0) drawProp(g, b.art, "soil-mound", x, y, { alpha: 0.6, k: ds, sy: GROUND_SQUASH });
        else if (hcm < 15) drawSprout(g, b, x, y, (0.6 + (hcm / 15) * 0.5) * ds);
        else if (hcm < 80) drawSapling(g, season, b, x, y, (0.8 + ((hcm - 15) / 65) * 0.9) * ds);
        else drawTree(g, f, season, b, x, y, Math.round((debutRadius(hcm) * ds) / 4) * 4);
        break;
      }
      case "snowman": {
        g.save();
        g.globalAlpha = 0.25;
        g.translate(x + 2, y + 3);
        g.drawImage(b.shadow, -22 * ds, -9 * ds, 44 * ds, 18 * ds);
        g.restore();
        drawProp(g, b.art, `snowman-${Math.max(1, Math.min(3, t.stage))}`, x, y + 8 * ds, { k: ds });
        break;
      }
      case "lilypad": {
        // 연잎 — 아트(변형 3)나 대체물(두께 있는 잎), 3/4 시점이라 세로로 눌린다; 물그늘은 살짝 오른쪽 아래. 연꽃 아트가 있으면 3할의 잎에 한 송이.
        const k = t.stage * (SIZE.lilypad / 56) * ds;
        const v = hash01(t.u, t.v);
        g.save();
        g.globalAlpha = 0.26;
        g.translate(x + 2, y + 3);
        g.drawImage(b.shadow, -30 * k, -30 * k * GROUND_SQUASH, 60 * k, 60 * k * GROUND_SQUASH);
        g.restore();
        drawProp(g, b.art, "lilypad", x, y, { k, rot: (t.u * 7 + t.v * 5) % TAU, r: v, sy: GROUND_SQUASH });
        if (v < 0.3 && b.art.has("lotus")) drawProp(g, b.art, "lotus", x + 4 * k, y + 2 * k, { k: 0.8 + 0.3 * k });
        break;
      }
    }
  }
}

// 소품 그리기(2026-09-04) — 장면·연대기가 놓는 작은 것들(흙더미·연잎·버섯·잔가지·조약돌·풀포기·클로버·데이지·민들레·눈사람)을 **한 API**로
// 그린다: `drawProp(g, art, id, x, y, …)`. 아트 파일(`public/ambient/art/<id>.png`)이 있으면 그것, 없으면 여기의 코드 도형(옛 그림을
// 그대로 옮긴 대체물)을 한 번 구워 쓴다. 앵커는 아트와 같다(stand = 바닥 접점, flat = 가운데) — 파일이 생겨도 자리가 안 움직인다.
// 아트 보드(/studio/ambient-art)의 '지금' 미리보기도 같은 대체물을 보여준다(`fallbackSprite`).

import { artSlot } from "./manifest";
import { drawArt, type ArtSet, type ArtSprite } from "./load";
import { makeCanvas, rng, softBlob, TAU } from "@/components/shared/ambient/scenes/util";

const cache = new Map<string, HTMLCanvasElement | null>();
const SCALE = 2;

type Painter = (g: CanvasRenderingContext2D, W: number, H: number, r: () => number, variant: number) => void;

// 각 대체물은 (W×H) 상자 안에 그린다. stand는 바닥이 H, flat은 가운데 (W/2, H/2).
const PAINT: Record<string, Painter> = {
  "soil-mound": (g, W, H) => {
    g.translate(W / 2, H / 2);
    g.scale(1, H / W);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, W / 2);
    rg.addColorStop(0, "rgb(88 66 46 / 0.55)");
    rg.addColorStop(0.55, "rgb(120 95 70 / 0.5)");
    rg.addColorStop(0.82, "rgb(152 128 98 / 0.4)");
    rg.addColorStop(1, "rgb(152 128 98 / 0)");
    g.fillStyle = rg;
    g.beginPath();
    g.arc(0, 0, W / 2, 0, TAU);
    g.fill();
  },
  molehill: (g, W, H) => {
    g.translate(W / 2, H - 8);
    softBlob(g, 1, 3, 15, "60 46 34", 0.22, 0);
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
    g.fillStyle = "rgb(60 46 34 / 0.45)";
    for (const [x, y] of [[-6, -2], [3, -4], [7, 2], [-2, 4], [1, -1]] as const) {
      g.beginPath();
      g.arc(x, y, 0.9, 0, TAU);
      g.fill();
    }
  },
  "grass-patch": (g, W, H) => {
    softBlob(g, W / 2, H / 2, 18, "96 150 92", 0.28, 0);
  },
  lilypad: (g, W, H, r, variant) => {
    // 연잎 — 둥근 잎에 V자 갈라짐, 잎맥, **가장자리 두께**(아래쪽 어두운 초승달 + 바깥 밝은 테). 겹쳐도 층이 읽히게(2026-09-04 소유자).
    const R = Math.min(W, H) / 2 - 3;
    g.translate(W / 2, H / 2);
    g.rotate(variant * 2.1);
    const cut = 0.32 + variant * 0.06;
    const leaf = (rr: number) => {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, rr, cut, TAU - cut);
      g.closePath();
    };
    // 아래쪽 두께(그늘 초승달)
    g.save();
    g.translate(1.5, 2.2);
    leaf(R);
    g.fillStyle = "rgb(46 82 60 / 0.55)";
    g.fill();
    g.restore();
    leaf(R);
    const rg = g.createRadialGradient(-R * 0.25, -R * 0.25, 2, 0, 0, R);
    rg.addColorStop(0, "#93bb95");
    rg.addColorStop(0.75, "#6a9a72");
    rg.addColorStop(1, "#5a8a66");
    g.fillStyle = rg;
    g.fill();
    g.strokeStyle = "rgb(230 245 225 / 0.55)";
    g.lineWidth = 1.3;
    g.stroke();
    g.strokeStyle = "rgb(60 100 70 / 0.32)";
    g.lineWidth = 0.9;
    for (let i = 0; i < 7; i++) {
      const a = cut + 0.5 + (i / 6) * (TAU - 2 * cut - 1);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86);
      g.stroke();
    }
    softBlob(g, -R * 0.3, -R * 0.35, R * 0.45, "255 255 240", 0.16, 0);
  },
  mushroom: (g, W, H, r, variant) => {
    const one = (x: number, base: number, rr: number) => {
      g.fillStyle = "rgb(236 224 200)";
      g.beginPath();
      g.ellipse(x, base - rr * 0.55, rr * 0.42, rr * 0.6, 0, 0, TAU);
      g.fill();
      const cap = g.createRadialGradient(x - rr * 0.3, base - rr * 1.2, 1, x, base - rr, rr);
      cap.addColorStop(0, "#b48864");
      cap.addColorStop(1, "#7f5a40");
      g.fillStyle = cap;
      g.beginPath();
      g.ellipse(x, base - rr, rr, rr * 0.8, 0, 0, TAU);
      g.fill();
      g.fillStyle = "rgb(245 236 218 / 0.85)";
      for (let k = 0; k < 4; k++) {
        const aa = r() * TAU;
        const d = r() * rr * 0.55;
        g.beginPath();
        g.arc(x + Math.cos(aa) * d, base - rr + Math.sin(aa) * d * 0.8, 1 + r() * 1.2, 0, TAU);
        g.fill();
      }
    };
    if (variant === 0) one(W / 2, H - 1, Math.min(W, H) * 0.42);
    else {
      one(W * 0.38, H - 1, Math.min(W, H) * 0.36);
      one(W * 0.68, H - 1, Math.min(W, H) * 0.26);
    }
  },
  twig: (g, W, H, r) => {
    const len = W * 0.86;
    const x = W * 0.07;
    const y = H / 2;
    g.lineCap = "round";
    g.strokeStyle = "rgb(96 74 52 / 0.7)";
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(x, y + 1);
    g.lineTo(x + len * 0.55, y - 1);
    g.lineTo(x + len, y + (r() - 0.5) * 6);
    g.stroke();
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x + len * 0.55, y - 1);
    g.lineTo(x + len * 0.8, y - H * 0.35);
    g.stroke();
  },
  pebble: (g, W, H, r) => {
    const x = W / 2;
    const y = H / 2;
    const rr = Math.min(W, H) * 0.42;
    g.fillStyle = r() < 0.5 ? "rgb(178 172 160)" : "rgb(160 150 138)";
    g.beginPath();
    g.ellipse(x, y, rr * 1.15, rr * 0.85, 0, 0, TAU);
    g.fill();
    g.fillStyle = "rgb(255 255 250 / 0.4)";
    g.beginPath();
    g.ellipse(x - rr * 0.3, y - rr * 0.3, rr * 0.45, rr * 0.28, 0, 0, TAU);
    g.fill();
  },
  "grass-tuft": (g, W, H, r) => tuft(g, W, H, r, ["rgb(140 190 118 / 0.75)", "rgb(112 168 104 / 0.7)"]),
  "grass-dry": (g, W, H, r) => tuft(g, W, H, r, ["rgb(168 140 88 / 0.65)", "rgb(140 118 74 / 0.6)"]),
  clover: (g, W, H, r) => {
    const x = W / 2;
    const y = H / 2;
    g.fillStyle = "rgb(96 150 92 / 0.7)";
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * TAU + r() * 0.3;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 3.2, y + Math.sin(a) * 3.2, 3.4, 2.6, a, 0, TAU);
      g.fill();
    }
    g.fillStyle = "rgb(230 245 225 / 0.35)";
    g.beginPath();
    g.arc(x, y, 1.3, 0, TAU);
    g.fill();
  },
  daisy: (g, W, H) => {
    const x = W / 2;
    const y = H * 0.42;
    g.strokeStyle = "rgb(120 165 100 / 0.8)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(x, y + 3);
    g.lineTo(x + 1, H - 1);
    g.stroke();
    g.fillStyle = "rgb(255 255 255 / 0.95)";
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      g.beginPath();
      g.ellipse(x + Math.cos(a) * 4.2, y + Math.sin(a) * 4.2, 3.2, 1.9, a, 0, TAU);
      g.fill();
    }
    g.fillStyle = "rgb(240 214 120 / 0.95)";
    g.beginPath();
    g.arc(x, y, 2.3, 0, TAU);
    g.fill();
  },
  "dandelion-puff": (g, W, H) => {
    const x = W / 2;
    const y = H * 0.38;
    g.strokeStyle = "rgb(120 165 100 / 0.7)";
    g.lineWidth = 1.4;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, y + 6);
    g.lineTo(x + 2, H - 1);
    g.stroke();
    softBlob(g, x, y, 12, "255 255 255", 0.55, 0);
    g.strokeStyle = "rgb(255 255 255 / 0.85)";
    g.lineWidth = 0.9;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * TAU;
      g.beginPath();
      g.moveTo(x + Math.cos(a) * 2.5, y + Math.sin(a) * 2.5);
      g.lineTo(x + Math.cos(a) * 9.5, y + Math.sin(a) * 9.5);
      g.stroke();
      g.fillStyle = "rgb(255 255 255 / 0.95)";
      g.beginPath();
      g.arc(x + Math.cos(a) * 9.5, y + Math.sin(a) * 9.5, 1, 0, TAU);
      g.fill();
    }
    g.fillStyle = "rgb(190 210 150)";
    g.beginPath();
    g.arc(x, y, 2.6, 0, TAU);
    g.fill();
  },
  "snowman-1": (g, W, H) => snowman(g, W, H, 1),
  "snowman-2": (g, W, H) => snowman(g, W, H, 2),
  "snowman-3": (g, W, H) => snowman(g, W, H, 3)
};

function tuft(g: CanvasRenderingContext2D, W: number, H: number, r: () => number, cols: string[]) {
  g.lineCap = "round";
  const x = W / 2;
  const y = H - 1;
  const n = 3 + Math.floor(r() * 2);
  for (let k = 0; k < n; k++) {
    const len = H * (0.5 + r() * 0.45);
    const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.42 + (r() - 0.5) * 0.3;
    const bend = (r() - 0.5) * 5;
    g.strokeStyle = cols[k % cols.length];
    g.lineWidth = 1.2 + r() * 0.8;
    g.beginPath();
    g.moveTo(x + k * 1.6 - (n - 1) * 0.8, y);
    g.quadraticCurveTo(x + bend, y + Math.sin(a) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len);
    g.stroke();
  }
}

function snowman(g: CanvasRenderingContext2D, W: number, H: number, stage: number) {
  g.translate(W / 2, H - 2);
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
  ball(0, -14, 14);
  if (stage >= 2) ball(0, -34, 11);
  if (stage >= 3) {
    ball(0, -50, 8.5);
    g.strokeStyle = "rgb(84 70 60)";
    g.lineWidth = 2;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(-10, -36);
    g.lineTo(-21, -46);
    g.moveTo(10, -36);
    g.lineTo(21, -46);
    g.stroke();
    g.fillStyle = "#3b3f46";
    for (const [x, y, r] of [[-3, -52, 1.3], [3, -52, 1.3], [0, -33, 1.2], [0, -27, 1.2]] as const) {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  }
}

/** 대체물(코드 도형)을 자리 크기로 한 번 굽는다. 없는 자리는 null. */
export function fallbackSprite(id: string, variant = 0): HTMLCanvasElement | null {
  const key = `${id}:${variant}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const slot = artSlot(id);
  const paint = PAINT[id];
  if (!slot || !paint) {
    cache.set(key, null);
    return null;
  }
  const [W, H] = slot.px;
  const { c, g } = makeCanvas(W * SCALE, H * SCALE);
  g.scale(SCALE, SCALE);
  paint(g, W, H, rng(1000 + id.length * 31 + variant * 97), variant);
  cache.set(key, c);
  return c;
}

/** 아트가 **있을 때만** 놓이는 큰 소품(관목·바위·그루터기·통나무·눈 무더기 …)을 바탕에 결정적으로 흩뿌린다. band = "edge"(기본: 위 띠
 *  0~10% · 아래 띠 90~100% · 좌우 0~7% — 달력 밖) 또는 "any". 같은 rng 순서를 쓰므로 아트가 없어도 rng 소비가 같다(다른 소품 자리 불변). */
export function scatterProps(
  g: CanvasRenderingContext2D,
  art: ArtSet | null,
  w: number,
  h: number,
  r: () => number,
  list: { id: string; n: number; band?: "edge" | "any"; k?: number }[]
) {
  for (const it of list) {
    for (let i = 0; i < it.n; i++) {
      let x: number;
      let y: number;
      if (it.band === "any") {
        x = 20 + r() * (w - 40);
        y = 20 + r() * (h - 40);
      } else {
        const t = r();
        if (t < 0.5) {
          x = 30 + r() * (w - 60);
          y = 10 + r() * h * 0.09;
        } else if (t < 0.8) {
          x = 30 + r() * (w - 60);
          y = h * 0.9 + r() * h * 0.08;
        } else if (t < 0.9) {
          x = 10 + r() * w * 0.06;
          y = h * 0.15 + r() * h * 0.7;
        } else {
          x = w * 0.93 + r() * w * 0.05;
          y = h * 0.15 + r() * h * 0.7;
        }
      }
      const k = (it.k ?? 1) * (0.85 + r() * 0.3);
      const v = r();
      const flip = r() < 0.5;
      if (!art || !art.has(it.id)) continue;
      const slot = artSlot(it.id);
      if (slot?.view === "stand") softBlob(g, x + 2, y - 2, slot.px[0] * 0.45 * k, "40 34 30", 0.18, 0);
      drawProp(g, art, it.id, x, y, { k, r: v, flip });
    }
  }
}

/** 소품 하나를 그린다. 아트가 있으면 아트, 없으면 대체물. r(0~1)로 변형을 고른다. 그린 게 있으면 true. */
export function drawProp(
  g: CanvasRenderingContext2D,
  art: ArtSet | null,
  id: string,
  x: number,
  y: number,
  opts: { k?: number; rot?: number; r?: number; alpha?: number; flip?: boolean; sy?: number } = {}
): boolean {
  const k = opts.k ?? 1;
  const r = opts.r ?? 0;
  const sy = opts.sy ?? 1; // 3/4 시점 바닥 눌림(납작한 것) — 회전 전에 화면 세로로
  const a: ArtSprite | null = art ? art.pick(id, r) : null;
  if (opts.alpha !== undefined) {
    g.save();
    g.globalAlpha *= opts.alpha;
  }
  let drew = false;
  if (a) {
    drawArt(g, a, x, y, k, opts.rot ?? 0, opts.flip, sy);
    drew = true;
  } else {
    const slot = artSlot(id);
    const variants = slot?.variants && slot.variants > 1 ? slot.variants : 1;
    const c = fallbackSprite(id, Math.min(variants - 1, Math.floor(Math.max(0, Math.min(0.999, r)) * variants)));
    if (c && slot) {
      const [W, H] = slot.px;
      g.save();
      g.translate(x, y);
      if (sy !== 1) g.scale(1, sy);
      if (opts.rot) g.rotate(opts.rot);
      g.scale(opts.flip ? -k : k, k);
      g.drawImage(c, -W / 2, slot.view === "stand" ? -H : -H / 2, W, H);
      g.restore();
      drew = true;
    }
  }
  if (opts.alpha !== undefined) g.restore();
  return drew;
}

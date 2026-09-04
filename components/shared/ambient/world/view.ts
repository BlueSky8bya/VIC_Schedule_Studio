// 3/4 시점(2026-09-04, PLAN-20260904-004 §2.5) — 동물의 숲 카메라: 45~50°로 비스듬히 내려다본다. 소유자: "완전 위에서가 아니라 3/4 각도로
// 비스듬히 — 거리감". 전 장면 공통 규칙 한 곳:
//  · 바닥에 납작한 것(flat: 발자국·클로버·연잎·조약돌·낙엽·물고기 그림자·파문 고리·발밑 그림자)은 세로로 눌린다(GROUND_SQUASH).
//  · 서 있는 것·생물은 위(멀다)에서 작고 아래(가깝다)에서 크다(depthScale, 0.80 → 1.00). 픽셀 격자가 깨지지 않게 0.05 단위로 양자화.
//  · 화면 위 HORIZON_V(12%)는 지평선 띠 — 먼 것의 자리(낮은 언덕·작은 나무 줄·수평선). 대기 원근: 채도↓ 명도↑ 옅은 안개.
//  · 세계 좌표(정규화 u,v)는 지평선 아래 땅에 놓인다: toScreen(u, v) = (u·w, horizon + v·(h − horizon)).
//  · 그리기 순서는 발 위치 y-sort(뒤가 앞에 가려진다).

import type { SeasonKey } from "@/components/shared/ambient/registry";
import { makeCanvas, rng, softBlob, TAU } from "@/components/shared/ambient/scenes/util";

export const GROUND_SQUASH = 0.7;
export const HORIZON_V = 0.12;
export const DEPTH_FAR = 0.8;

export const horizonY = (h: number) => h * HORIZON_V;

/** 거리 축소 — 지평선에서 0.80, 화면 아래에서 1.00. 0.05 단위. */
export function depthScale(y: number, h: number): number {
  const hz = horizonY(h);
  const t = Math.max(0, Math.min(1, (y - hz) / Math.max(1, h - hz)));
  return Math.round((DEPTH_FAR + (1 - DEPTH_FAR) * t) * 20) / 20;
}

/** 세계 정규화 좌표 → 화면 px(지평선 아래 땅). */
export function toScreen(u: number, v: number, w: number, h: number): [number, number] {
  const hz = horizonY(h);
  return [u * w, hz + v * (h - hz)];
}
/** 화면 y → 땅의 정규화 v(스폰·판정용). */
export function toGroundV(y: number, h: number): number {
  const hz = horizonY(h);
  return Math.max(0, Math.min(1, (y - hz) / Math.max(1, h - hz)));
}

/** 납작한 것을 그릴 때의 변환 — translate(x,y) · rotate · scale(k, k·SQUASH). 호출 쪽이 save/restore. */
export function flatXform(g: CanvasRenderingContext2D, x: number, y: number, k = 1, rot = 0) {
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.scale(k, k * GROUND_SQUASH);
}

/** 발밑 타원 그림자(폭 w, 알파 a). 해 방향 오프셋은 호출 쪽이 x에 더한다. */
export function footShadow(g: CanvasRenderingContext2D, x: number, y: number, w: number, a = 0.22) {
  g.save();
  g.globalAlpha *= a;
  g.fillStyle = "rgb(40 34 30)";
  g.beginPath();
  g.ellipse(x, y, w / 2, (w / 2) * 0.35, 0, 0, TAU);
  g.fill();
  g.restore();
}

/** y-sort — 발 위치 y가 작은 것(먼 것)부터. 제자리 정렬. */
export function ySort<T extends { y: number }>(items: T[]): T[] {
  return items.sort((a, b) => a.y - b.y);
}

const HZ_COLORS: Record<SeasonKey, { haze: string; hill: string; hill2: string; tree: string }> = {
  spring: { haze: "232 240 226", hill: "#c2d6b0", hill2: "#b0c89e", tree: "#8fae7c" },
  summer: { haze: "226 236 222", hill: "#a9c79a", hill2: "#96b888", tree: "#6f9a62" },
  autumn: { haze: "236 232 222", hill: "#d2c5a6", hill2: "#c2b494", tree: "#9a7a4c" },
  winter: { haze: "240 243 247", hill: "#e6ebf1", hill2: "#dbe2ea", tree: "#8a8f86" }
};

/** 지평선 띠를 한 번 굽는다(w×(hz+24)) — 안개 그라데이션 + 낮은 언덕 두 겹 + 작은 나무 줄(실루엣). 결정적(폭·계절 시드).
 *  장면은 바탕을 그린 뒤 이것을 위에 얹는다(캔버스 위 12%). 채도가 낮고 밝아 "멀다"로 읽힌다. */
export function bakeHorizon(season: SeasonKey, w: number, h: number, dpr = 1): HTMLCanvasElement {
  const hz = horizonY(h);
  const H = Math.ceil(hz + 24);
  const { c, g } = makeCanvas(Math.max(1, Math.ceil(w * dpr)), Math.ceil(H * dpr));
  g.scale(dpr, dpr);
  const col = HZ_COLORS[season];
  const r = rng(311 + Math.round(w) * 3 + season.length);
  // 안개 — 위는 짙게, 지평선 아래로 옅어진다(대기 원근).
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `rgb(${col.haze} / 0.78)`);
  grad.addColorStop(hz / H, `rgb(${col.haze} / 0.55)`);
  grad.addColorStop(1, `rgb(${col.haze} / 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, H);
  // 먼 언덕 두 겹(뒤가 더 밝고 옅다). 아래로 갈수록 투명해져 땅과 **경계선 없이** 섞인다(딱 떨어지는 가로선은 '도로'로 읽혔다).
  const hill = (base: number, amp: number, color: string, alpha: number, seed: number) => {
    g.save();
    g.globalAlpha = alpha;
    const fg = g.createLinearGradient(0, base - amp, 0, H);
    fg.addColorStop(0, color);
    fg.addColorStop(0.55, color);
    fg.addColorStop(1, `${color}00`);
    g.fillStyle = fg;
    g.beginPath();
    g.moveTo(0, H);
    for (let x = 0; x <= w; x += 16) {
      const y = base + Math.sin(x * 0.004 + seed) * amp + Math.sin(x * 0.011 + seed * 2.3) * amp * 0.45;
      g.lineTo(x, y);
    }
    g.lineTo(w, H);
    g.closePath();
    g.fill();
    g.restore();
  };
  hill(hz * 0.5, hz * 0.18, col.hill, 0.5, 1.3);
  hill(hz * 0.72, hz * 0.14, col.hill2, 0.5, 4.1);
  // 작은 나무 줄 — 지평선 바로 위에 실루엣(둥근 수관 + 짧은 줄기), 겨울은 나목 점. 드문드문·옅게(먼 숲의 윤곽).
  const n = Math.round(w / 52);
  g.fillStyle = col.tree;
  for (let i = 0; i < n; i++) {
    if (r() < 0.45) continue;
    const x = (i + 0.5) * (w / n) + (r() - 0.5) * 24;
    const s = 4 + r() * 5;
    const y = hz * (0.74 + r() * 0.12);
    g.globalAlpha = 0.3 + r() * 0.18;
    if (season === "winter") {
      g.fillRect(x - 0.6, y - s * 1.4, 1.2, s * 1.4);
      g.beginPath();
      g.arc(x, y - s * 1.3, s * 0.55, 0, TAU);
      g.fill();
    } else {
      g.fillRect(x - 1, y - s * 0.6, 2, s * 0.9);
      g.beginPath();
      g.arc(x, y - s * 0.8, s, 0, TAU);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  // 지평선 선 — 아주 옅은 밝은 줄(하늘과 땅의 경계 느낌).
  softBlob(g, w / 2, hz * 0.5, w * 0.6, "255 255 255", 0.12, 0);
  return c;
}

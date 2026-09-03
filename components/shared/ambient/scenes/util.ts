// 장면 공용 유틸 — 결정적 난수(같은 seed면 같은 배치: 검증 재현), 오프스크린 스프라이트, 수치 보조.

export type Rng = () => number;

/** mulberry32 — 작고 결정적. */
export function rng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const TAU = Math.PI * 2;

/** 오프스크린 캔버스 — 스프라이트·바탕을 한 번 굽는 용도. */
export function makeCanvas(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const g = c.getContext("2d");
  if (!g) throw new Error("2d context");
  return { c, g };
}

/** 부드러운 원형 얼룩(그림자·빛). blur 필터 대신 radial gradient. */
export function softBlob(g: CanvasRenderingContext2D, x: number, y: number, r: number, rgb: string, a0: number, a1 = 0) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, `rgb(${rgb} / ${a0})`);
  grad.addColorStop(1, `rgb(${rgb} / ${a1})`);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
}

/** 잎 윤곽(가을·봄 공용). r = 반지름 척도, shape 0 둥근 잎 · 1 뾰족 잎 · 2 갸름한 잎. */
export function leafPath(g: CanvasRenderingContext2D, r: number, shape: number) {
  g.beginPath();
  if (shape === 1) {
    g.moveTo(0, -r);
    g.bezierCurveTo(r * 0.7, -r * 0.55, r * 0.78, r * 0.15, 0, r);
    g.bezierCurveTo(-r * 0.78, r * 0.15, -r * 0.7, -r * 0.55, 0, -r);
  } else if (shape === 2) {
    g.moveTo(0, -r);
    g.bezierCurveTo(r * 0.42, -r * 0.6, r * 0.46, r * 0.5, 0, r);
    g.bezierCurveTo(-r * 0.46, r * 0.5, -r * 0.42, -r * 0.6, 0, -r);
  } else {
    g.moveTo(0, -r);
    g.bezierCurveTo(r * 0.58, -r * 0.78, r * 0.8, -r * 0.2, r * 0.66, r * 0.34);
    g.bezierCurveTo(r * 0.55, r * 0.78, r * 0.22, r, 0, r);
    g.bezierCurveTo(-r * 0.22, r, -r * 0.55, r * 0.78, -r * 0.66, r * 0.34);
    g.bezierCurveTo(-r * 0.8, -r * 0.2, -r * 0.58, -r * 0.78, 0, -r);
  }
  g.closePath();
}

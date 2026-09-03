// 장면 공용 유틸 — 결정적 난수(같은 seed면 같은 배치: 검증 재현), 오프스크린 스프라이트, 잎 윤곽, 수치 보조.

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

/** 부드러운 타원 그림자 스프라이트(가장자리가 흐린 어두운 타원) — 매 프레임 blur 대신 한 번 굽는다. */
export function shadowSprite(w: number, h: number, rgb = "40 34 30", a = 0.5): HTMLCanvasElement {
  const { c, g } = makeCanvas(w, h);
  g.translate(w / 2, h / 2);
  g.scale(1, h / w);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  grad.addColorStop(0, `rgb(${rgb} / ${a})`);
  grad.addColorStop(0.55, `rgb(${rgb} / ${a * 0.55})`);
  grad.addColorStop(1, `rgb(${rgb} / 0)`);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, w / 2, 0, TAU);
  g.fill();
  return c;
}

/** 잎 윤곽. r = 반지름 척도. shape 0 둥근 잎 · 1 뾰족 잎(느릅) · 2 갸름한 잎(버들) · 3 단풍(5갈래) · 4 은행(부채) · 5 참나무(물결 갈래). */
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
  } else if (shape === 3) {
    // 단풍 — 다섯 갈래, 갈래 끝은 뾰족하고 사이는 깊게 파인다.
    const pts: [number, number][] = [
      [0, -1], [0.17, -0.52], [0.62, -0.74], [0.4, -0.28], [0.98, -0.12], [0.5, 0.14], [0.6, 0.62], [0.2, 0.44], [0.07, 0.92],
      [-0.07, 0.92], [-0.2, 0.44], [-0.6, 0.62], [-0.5, 0.14], [-0.98, -0.12], [-0.4, -0.28], [-0.62, -0.74], [-0.17, -0.52]
    ];
    g.moveTo(pts[0][0] * r, pts[0][1] * r);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * r, pts[i][1] * r);
  } else if (shape === 4) {
    // 은행 — 부채꼴, 위 가운데가 살짝 갈라진다. 잎자루는 아래로.
    const cx = 0;
    const cy = r * 0.42;
    const R = r * 1.08;
    g.moveTo(cx, cy);
    g.arc(cx, cy, R, (-90 - 64) * (Math.PI / 180), (-90 - 7) * (Math.PI / 180));
    g.lineTo(cx, cy - R * 0.84);
    g.arc(cx, cy, R, (-90 + 7) * (Math.PI / 180), (-90 + 64) * (Math.PI / 180));
    g.lineTo(cx, cy);
  } else if (shape === 5) {
    // 참나무 — 양옆 세 갈래가 물결처럼.
    const right: [number, number][] = [[0.5, -0.66], [0.22, -0.42], [0.62, -0.18], [0.28, 0.06], [0.56, 0.36], [0.22, 0.56], [0.1, 0.9]];
    g.moveTo(0, -r);
    let px = 0;
    let py = -r;
    for (const [x, y] of right) {
      const nx = x * r;
      const ny = y * r;
      g.quadraticCurveTo((px + nx) / 2 + (nx - px) * 0.35, (py + ny) / 2 - Math.abs(nx - px) * 0.2, nx, ny);
      px = nx;
      py = ny;
    }
    g.lineTo(-0.1 * r, 0.9 * r);
    for (let i = right.length - 2; i >= 0; i--) {
      const nx = -right[i][0] * r;
      const ny = right[i][1] * r;
      g.quadraticCurveTo((px + nx) / 2 + (nx - px) * 0.35, (py + ny) / 2 - Math.abs(nx - px) * 0.2, nx, ny);
      px = nx;
      py = ny;
    }
    g.quadraticCurveTo(-0.3 * r, -0.95 * r, 0, -r);
  } else {
    g.moveTo(0, -r);
    g.bezierCurveTo(r * 0.58, -r * 0.78, r * 0.8, -r * 0.2, r * 0.66, r * 0.34);
    g.bezierCurveTo(r * 0.55, r * 0.78, r * 0.22, r, 0, r);
    g.bezierCurveTo(-r * 0.22, r, -r * 0.55, r * 0.78, -r * 0.66, r * 0.34);
    g.bezierCurveTo(-r * 0.8, -r * 0.2, -r * 0.58, -r * 0.78, 0, -r);
  }
  g.closePath();
}

/** 솔잎 다발 — 밑동에서 가늘고 긴 잎 세 가닥이 부채처럼. 채움이 아니라 선(stroke). */
export function pineNeedles(g: CanvasRenderingContext2D, r: number, color: string, width = 1.7) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = "round";
  g.beginPath();
  for (const a of [-24, 0, 22]) {
    const rad = (-90 + a) * (Math.PI / 180);
    g.moveTo(0, r * 0.85);
    g.lineTo(Math.cos(rad) * r * 1.9, r * 0.85 + Math.sin(rad) * r * 1.9);
  }
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.arc(0, r * 0.85, width * 1.1, 0, TAU);
  g.fill();
}

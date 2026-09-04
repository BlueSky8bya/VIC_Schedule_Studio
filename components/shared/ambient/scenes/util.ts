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

/** 두 각의 최단 차(−π..π). */
export function angleDiff(want: number, cur: number): number {
  let d = want - cur;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

/** 생물의 위협 지각(2026-09-04, 동물 행동 연구 기반) — 포인터가 (x,y)로 **얼마나 빨리 다가오나**(looming).
 *  물고기·토끼·다람쥐의 도망 개시 거리(flight initiation distance)는 고정 반경이 아니라 접근 속도에 따라 늘어난다:
 *  천천히 오면 꽤 가까이 두고, 휙 덤비면 멀리서 튄다(Ydenberg & Dill 1986; Domenici & Hale 2019 물고기 C-start —
 *  '시각 각의 팽창률'이 가장 좋은 예측자). loom = 접근 속도 ÷ 거리(1/s): 값이 클수록 '덮쳐온다'.
 *  d = 거리, rate = 접근 속도(px/s, 양수 = 다가옴), loom = rate / max(d, 24). 포인터가 밖이면 전부 0. */
export function threat(p: { x: number; y: number; vx: number; vy: number; inside: boolean }, x: number, y: number): { d: number; rate: number; loom: number } {
  if (!p.inside) return { d: Infinity, rate: 0, loom: 0 };
  const dx = x - p.x;
  const dy = y - p.y;
  const d = Math.hypot(dx, dy) || 0.001;
  const rate = (p.vx * dx + p.vy * dy) / d;
  return { d, rate, loom: rate / Math.max(d, 24) };
}

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

type Pt = [number, number];

/** 꼭짓점 사이에 톱니를 넣어 잎 가장자리를 만든다(amp = 톱니 깊이, r 단위). 톱니는 안쪽으로 파인다. */
function toothed(g: CanvasRenderingContext2D, pts: Pt[], r: number, teethPerEdge: number, amp: number, close = true) {
  const n = pts.length;
  g.moveTo(pts[0][0] * r, pts[0][1] * r);
  for (let i = 0; i < (close ? n : n - 1); i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const len = Math.hypot(ex, ey) || 1;
    // 안쪽 법선(원점 쪽)
    let nx = -ey / len;
    let ny = ex / len;
    const mx = (a[0] + b[0]) / 2;
    const my = (a[1] + b[1]) / 2;
    if (nx * mx + ny * my > 0) {
      nx = -nx;
      ny = -ny;
    }
    const k = Math.max(1, Math.round(teethPerEdge * len));
    for (let j = 1; j <= k; j++) {
      const t = j / k;
      const px = a[0] + ex * t;
      const py = a[1] + ey * t;
      if (j < k) {
        const tm = (j - 0.5) / k;
        g.lineTo((a[0] + ex * tm + nx * amp) * r, (a[1] + ey * tm + ny * amp) * r);
      }
      g.lineTo(px * r, py * r);
    }
  }
  if (close) g.closePath();
}

/** 잎 윤곽. r = 반지름 척도(잎 길이의 절반). shape 0 벚·느티(톱니 타원) · 1 느릅(밑동 비대칭·톱니) · 2 버들(가늘고 긴 톱니) ·
 *  3 단풍(일곱 갈래·톱니) · 4 은행(부채, 물결 가장자리·가운데 갈라짐) · 5 참나무(둥근 갈래 넷). */
export function leafPath(g: CanvasRenderingContext2D, r: number, shape: number) {
  g.beginPath();
  if (shape === 1) {
    // 느릅 — 한쪽 밑동이 더 내려온 비대칭 타원, 잔톱니.
    const pts: Pt[] = [
      [0, -1], [0.3, -0.86], [0.54, -0.55], [0.6, -0.15], [0.5, 0.3], [0.28, 0.72], [0.06, 0.96],
      [-0.1, 0.9], [-0.34, 0.66], [-0.58, 0.28], [-0.62, -0.18], [-0.5, -0.6], [-0.26, -0.9]
    ];
    toothed(g, pts, r, 5, 0.035);
  } else if (shape === 2) {
    // 버들 — 가늘고 길며 잔톱니.
    const pts: Pt[] = [[0, -1], [0.2, -0.7], [0.3, -0.25], [0.28, 0.3], [0.16, 0.78], [0, 1], [-0.16, 0.78], [-0.28, 0.3], [-0.3, -0.25], [-0.2, -0.7]];
    toothed(g, pts, r, 6, 0.028);
  } else if (shape === 3) {
    // 단풍(Acer palmatum) — 일곱 갈래. 갈래는 어깨가 있고 끝이 뾰족, 사이 홈은 절반 깊이, 가장자리는 잔톱니.
    // 갈래 i의 방향각 ang, 이웃과의 반각 hs. 윤곽 = [홈 → 왼 어깨 → 끝 → 오른 어깨] 반복 → 밑동.
    const pts: Pt[] = [];
    const lobes = 7;
    const span = Math.PI * 1.6;
    const hs = span / (lobes - 1) / 2;
    const tipOf = (i: number) => (i === 3 ? 1 : i === 2 || i === 4 ? 0.95 : i === 1 || i === 5 ? 0.84 : 0.66);
    for (let i = 0; i < lobes; i++) {
      const ang = -Math.PI / 2 + (i - (lobes - 1) / 2) * hs * 2;
      const tipR = tipOf(i);
      const notchR = tipR * 0.5;
      pts.push([Math.cos(ang - hs) * notchR, Math.sin(ang - hs) * notchR]);
      pts.push([Math.cos(ang - hs * 0.55) * tipR * 0.74, Math.sin(ang - hs * 0.55) * tipR * 0.74]);
      pts.push([Math.cos(ang - hs * 0.22) * tipR * 0.9, Math.sin(ang - hs * 0.22) * tipR * 0.9]);
      pts.push([Math.cos(ang) * tipR, Math.sin(ang) * tipR]);
      pts.push([Math.cos(ang + hs * 0.22) * tipR * 0.9, Math.sin(ang + hs * 0.22) * tipR * 0.9]);
      pts.push([Math.cos(ang + hs * 0.55) * tipR * 0.74, Math.sin(ang + hs * 0.55) * tipR * 0.74]);
    }
    const last = -Math.PI / 2 + ((lobes - 1) / 2) * hs * 2 + hs;
    pts.push([Math.cos(last) * 0.33, Math.sin(last) * 0.33]);
    pts.push([0.07, 0.42], [0.05, 0.92], [-0.05, 0.92], [-0.07, 0.42]);
    const first = -Math.PI / 2 - ((lobes - 1) / 2) * hs * 2 - hs;
    pts.push([Math.cos(first) * 0.33, Math.sin(first) * 0.33]);
    toothed(g, pts, r, 5, 0.022);
  } else if (shape === 4) {
    // 은행 — 부채꼴, 바깥 가장자리가 물결치고 가운데가 갈라진다.
    const cx = 0;
    const cy = 0.5;
    const R = 1.08;
    const a0 = (-90 - 66) * (Math.PI / 180);
    const a1 = (-90 + 66) * (Math.PI / 180);
    g.moveTo(cx * r, cy * r);
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = a0 + (a1 - a0) * t;
      // 가운데 갈라짐(t≈.5에서 깊이 .22) + 잔물결
      const notch = Math.exp(-Math.pow((t - 0.5) / 0.05, 2)) * 0.22;
      const ripple = Math.sin(t * Math.PI * 9) * 0.035;
      const rr = R * (1 - notch + ripple);
      g.lineTo((cx + Math.cos(a) * rr) * r, (cy + Math.sin(a) * rr) * r);
    }
    g.closePath();
  } else if (shape === 5) {
    // 참나무(Quercus) — 긴 타원 바탕에 양옆 둥근 갈래 넷(홈은 깊게), 밑동으로 갈수록 좁다. 매끈한 표본 곡선.
    const N = 56;
    const side = (s: number) => {
      for (let i = 0; i <= N; i++) {
        const t = i / N; // 0 = 끝(위), 1 = 밑동
        const y = -1 + t * 1.9;
        const ell = Math.sqrt(Math.max(0, 1 - Math.pow((y + 0.05) / 1.0, 2)));
        const lobe = 0.5 + 0.5 * Math.cos(t * Math.PI * 7.4 - 0.4); // 갈래 3.7개 — 위·아래는 작게
        const w = (0.16 + 0.42 * ell) * (0.68 + 0.42 * lobe) * (1 - 0.35 * t * t);
        const x = s * w;
        if (i === 0 && s > 0) g.moveTo(0, -r);
        else g.lineTo(x * r, y * r);
      }
    };
    side(1);
    g.lineTo(0.08 * r, 0.92 * r);
    g.lineTo(-0.08 * r, 0.92 * r);
    // 왼쪽은 밑동에서 끝으로 거슬러 올라간다.
    for (let i = N; i >= 0; i--) {
      const t = i / N;
      const y = -1 + t * 1.9;
      const ell = Math.sqrt(Math.max(0, 1 - Math.pow((y + 0.05) / 1.0, 2)));
      const lobe = 0.5 + 0.5 * Math.cos(t * Math.PI * 7.4 - 0.4);
      const w = (0.16 + 0.42 * ell) * (0.68 + 0.42 * lobe) * (1 - 0.35 * t * t);
      g.lineTo(-w * r, y * r);
    }
  } else {
    // 벚·느티 — 끝이 뾰족한 타원, 잔톱니.
    const pts: Pt[] = [
      [0, -1], [0.26, -0.8], [0.5, -0.5], [0.6, -0.1], [0.54, 0.34], [0.36, 0.7], [0.1, 0.94], [-0.1, 0.94],
      [-0.36, 0.7], [-0.54, 0.34], [-0.6, -0.1], [-0.5, -0.5], [-0.26, -0.8]
    ];
    toothed(g, pts, r, 5, 0.03);
  }
  g.closePath();
}

/** 잎맥 — 중심맥 + 양옆으로 휘어 오르는 곁맥(단풍은 갈래마다, 은행은 부채살, 참나무는 갈래마다). */
export function leafVeins(g: CanvasRenderingContext2D, r: number, shape: number) {
  g.beginPath();
  if (shape === 4) {
    for (let k = -4; k <= 4; k++) {
      const a = (-90 + k * 15) * (Math.PI / 180);
      g.moveTo(0, r * 0.5);
      g.quadraticCurveTo(Math.cos(a) * r * 0.5, r * 0.5 + Math.sin(a) * r * 0.5 - k * k * 0.004 * r, Math.cos(a) * r * 1.02, r * 0.5 + Math.sin(a) * r * 1.02);
    }
  } else if (shape === 3) {
    const lobes = 7;
    for (let i = 0; i < lobes; i++) {
      const ang = -Math.PI / 2 + ((i - (lobes - 1) / 2) / (lobes - 1)) * Math.PI * 1.55;
      const tipR = i === 3 ? 1 : i === 2 || i === 4 ? 0.94 : i === 1 || i === 5 ? 0.82 : 0.62;
      g.moveTo(0, r * 0.3);
      g.lineTo(Math.cos(ang) * tipR * r * 0.92, Math.sin(ang) * tipR * r * 0.92);
    }
  } else {
    g.moveTo(0, -r * 0.92);
    g.lineTo(0, r * 0.9);
    const rows = shape === 5 ? 4 : 5;
    for (let k = 0; k < rows; k++) {
      const y = -r * 0.7 + (k / (rows - 1)) * r * 1.2;
      const spread = shape === 2 ? 0.26 : shape === 5 ? 0.5 : 0.48;
      for (const s of [-1, 1]) {
        g.moveTo(0, y);
        g.quadraticCurveTo(s * spread * r * 0.5, y - r * 0.08, s * spread * r, y - r * 0.26);
      }
    }
  }
  g.stroke();
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
    g.quadraticCurveTo(Math.cos(rad) * r * 1.0 + a * 0.01 * r, r * 0.85 + Math.sin(rad) * r * 1.0, Math.cos(rad) * r * 1.9, r * 0.85 + Math.sin(rad) * r * 1.9);
  }
  g.stroke();
  g.fillStyle = color;
  g.beginPath();
  g.arc(0, r * 0.85, width * 1.1, 0, TAU);
  g.fill();
}

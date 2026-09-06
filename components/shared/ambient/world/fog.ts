// 안개 밀도장(2026-09-06 비주얼 QA 라운드 11, 우선순위 E) — `drawLightPass`의 옛 `groundFog`(화면 좌표 4-stop 세로
// 그라데이션 + `hz + .3(h−hz)` 고정 띠 + 바닥 8%f)는 세 라운드 연속 **"박스형 필터"**로 지적됐다(라운드 10 C #3 실측:
// 원경/중경/근경 D = 1.98/2.91/0.89로 중경이 가장 짙은 **역전**, x 방향 변화 0, 물·능선·나무를 감싸지 않음, 원경 실루엣 대비
// 언덕 16.2 → 1.44). 안개는 **지형과 거리를 아는 밀도장 F(x, y)** 여야 한다:
//
//   F = 깊이항 d(y) × 고도항 a(x, y) × 결(noise)
//   · d(y): 지평선 아래 v로 **단조 감소**(원경 .55 → 근경 .05, 돌출 금지) — 대기는 멀리서 두껍다.
//   · a(x, y): 그 열의 **지면선**(`floor(x)`)에서 위로 얼마나 떠 있나 — 안개는 저지대에 머물고 능선·수관 꼭대기는 발보다 옅다.
//     장면이 `fogFloor(x)`를 내놓으면 그것을, 없으면 `groundYAt(v)`(평지)를 쓴다.
//   · 결: 32×32 값 노이즈로 윗변을 ±15% 흔든다 — 직선 행(전폭 계단)을 없앤다.
//
// LOD 규칙(ADR-0017 ⑧): 1/8 해상 오프스크린에 굽고 확대한다 — 부드러운 것은 저해상으로. 조명 전이 중에는 프레임마다 굽지 않게
// (밀도 f · 색 · 크기 · floor 서명)으로 캐시한다.

import { groundYAt, horizonY } from "./view";

const SCALE = 8;

type FogCache = { key: string; c: HTMLCanvasElement };
let cache: FogCache | null = null;

/** 값 노이즈(2옥타브, 격자 해시) — `rng()`를 쓰지 않는다(호출 쪽 난수 흐름을 밀지 않게). */
function vnoise(u: number, v: number, sc: number, seed: number): number {
  const hsh = (i: number, j: number) => {
    const x = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const fx = u * sc;
  const fy = v * sc;
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const sm = (t: number) => t * t * (3 - 2 * t);
  const a = hsh(i, j);
  const b = hsh(i + 1, j);
  const c = hsh(i, j + 1);
  const d = hsh(i + 1, j + 1);
  return a + (b - a) * sm(tx) + (c - a) * sm(ty) + (a - b - c + d) * sm(tx) * sm(ty);
}

/** 밀도장의 세로 프로파일 — 지평선 아래 땅 비율 v(0 = 지평선, 1 = 화면 아래)에서의 깊이항. 단조 감소. */
export function fogDepth(v: number): number {
  const t = Math.max(0, Math.min(1, v));
  // 원경 .55 → 근경 .05. 지수 곡선 — 지평선 바로 아래가 가장 짙고 발치로 오면 거의 없다(GRAMMAR §3.2 안개 행 후경 .55 · 중경 .3 · 전경 .1).
  return 0.05 + 0.5 * Math.pow(1 - t, 1.6);
}

/**
 * 밀도장을 굽는다. `f`는 조명의 `groundFog`(0~1), `rgb`는 안개색, `floor(x)`는 그 열의 지면선(화면 y).
 * 반환 캔버스는 화면 크기의 1/8 — 그릴 때 `drawImage(c, 0, 0, w, h)`로 늘린다.
 */
export function bakeFogField(w: number, h: number, f: number, rgb: string, floor: ((x: number) => number) | null, floorKey: string): HTMLCanvasElement {
  const key = `${w}:${h}:${f.toFixed(3)}:${rgb}:${floorKey}`;
  if (cache && cache.key === key) return cache.c;
  const cw = Math.max(1, Math.ceil(w / SCALE));
  const ch = Math.max(1, Math.ceil(h / SCALE));
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d")!;
  const im = g.createImageData(cw, ch);
  const d = im.data;
  const [r0, g0, b0] = rgb.split(" ").map(Number);
  const hz = horizonY(h);
  const gh = Math.max(1, h - hz);
  // 열마다 지면선을 한 번씩 — floor는 장면 함수라 비용이 있을 수 있다.
  const floors = new Float32Array(cw);
  for (let i = 0; i < cw; i++) {
    const x = (i + 0.5) * SCALE;
    floors[i] = floor ? floor(x) : Number.NaN;
  }
  // 안개의 세로 두께 — 지면선 위 이만큼까지 차오른다(땅 높이의 30%). 그 위(능선·수관)는 옅다.
  const H_FOG = gh * 0.3;
  for (let j = 0; j < ch; j++) {
    const y = (j + 0.5) * SCALE;
    const v = (y - hz) / gh;
    // 지평선 위: 얇은 꼬리만(지평선 광 아래 6%까지) — 하늘은 하늘 판이 맡는다.
    const above = y < hz ? Math.max(0, 1 - (hz - y) / (h * 0.06)) : 1;
    const depth = y < hz ? fogDepth(0) * above : fogDepth(v);
    for (let i = 0; i < cw; i++) {
      const x = (i + 0.5) * SCALE;
      const fl = Number.isFinite(floors[i]) ? floors[i] : groundYAt(Math.max(0, v), h); // NaN·∞ 전부 평지로(C #2 가드)
      // 고도항: 지면선보다 위로 뜬 만큼 옅어진다(저지대 체류). 지면선 아래(땅 속·물속)는 1.
      const lift = Math.max(0, fl - y);
      // 고도항은 **가까울수록** 예민하다(v^.6) — 원경(v → 0)에서는 지면선 위로 떠도 대기 자체가 두꺼워 거의 그대로다.
      // 첫 판(전 깊이 동일)은 계곡 상류·언덕 뒤 띠의 원경 안개를 지면선 위라는 이유로 지워 far < mid 역전이 남았다.
      const alt = y < hz ? 0.35 : Math.max(0.12, 1 - (lift / Math.max(1, H_FOG)) * Math.pow(Math.max(0, v), 0.6));
      // 결 — 윗변을 흔들고 안쪽에 저주파 얼룩.
      const n1 = vnoise(x / w, y / h, 6, 3);
      const n2 = vnoise(x / w, y / h, 14, 11);
      const grain = 0.85 + 0.3 * n1 + 0.1 * (n2 - 0.5);
      let a = f * depth * alt * grain;
      // 발치(v ≥ .7)는 거의 0 — 관찰자 발까지 안개를 깔면 "필터"다(C: 발치 D ≤ .3L).
      if (v > 0.7) a *= Math.max(0, 1 - (v - 0.7) / 0.3);
      a = Math.max(0, Math.min(0.85, a));
      const k = (j * cw + i) * 4;
      d[k] = r0;
      d[k + 1] = g0;
      d[k + 2] = b0;
      d[k + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(im, 0, 0);
  cache = { key, c };
  return c;
}

/** 밀도장 한 겹을 그린다(장면 위, 조명 오버레이 아래). */
export function drawFogField(g: CanvasRenderingContext2D, w: number, h: number, f: number, rgb: string, floor: ((x: number) => number) | null, floorKey: string) {
  if (f <= 0.001) return;
  const c = bakeFogField(w, h, f, rgb, floor, floorKey);
  g.save();
  g.imageSmoothingEnabled = true;
  g.drawImage(c, 0, 0, w, h);
  g.restore();
}

/**
 * 개체별 안개 감쇠 — 발 y에서의 밀도장 값(0~1). `depthFade`가 멀리 있는 것을 흐리는 데 더해, 안개 날씨에는 이 값만큼 더 옅게
 * 그린다(라운드 10 C #3 처방 ⑤: 전 화면 오버레이가 근경 줄기를 원경만큼 들지 않게).
 */
export function fogAt(y: number, h: number, f: number, floorY?: number): number {
  if (f <= 0.001) return 0;
  const hz = horizonY(h);
  const v = (y - hz) / Math.max(1, h - hz);
  const depth = fogDepth(Math.max(0, v));
  const lift = floorY === undefined ? 0 : Math.max(0, floorY - y);
  const alt = Math.max(0.12, 1 - (lift / Math.max(1, (h - hz) * 0.3)) * Math.pow(Math.max(0, v), 0.6));
  return Math.max(0, Math.min(0.85, f * depth * alt));
}

// 3/4 시점(2026-09-04, PLAN-20260904-004 §2.5) — 동물의 숲 카메라: 45~50°로 비스듬히 내려다본다. 소유자: "완전 위에서가 아니라 3/4 각도로
// 비스듬히 — 거리감". 전 장면 공통 규칙 한 곳:
//  · 바닥에 납작한 것(flat: 발자국·클로버·연잎·조약돌·낙엽·물고기 그림자·파문 고리·발밑 그림자)은 세로로 눌린다(GROUND_SQUASH).
//  · 서 있는 것·생물은 위(멀다)에서 작고 아래(가깝다)에서 크다(depthScale, 0.80 → 1.00). 픽셀 격자가 깨지지 않게 0.05 단위로 양자화.
//  · 화면 위 HORIZON_V는 **하늘**이고 그 아래가 땅이다. 2026-09-06 소유자: "밤하늘 비율이 너무 적다 — 하늘을 늘리고
//    땅을 줄여라" → 0.12 → **0.26**. 검토 3인이 각각 .30(A — 3분할) / .20(B — 땅 손실 10% 미만) / .26(C — 달을 놓을 자리 +
//    depthScale 8단계 유지)을 제안했고, 세 권고의 공통 구간이 .26이다. 하늘 103 → 224px, 땅 757 → 636px(−16%). 지평선 **바로 위**는 여전히 먼 것의 자리(낮은 언덕·작은 나무 줄·수평선)인데, 그
//    띠는 하늘 비율이 아니라 **지평선에서의 거리**로 붙인다(aboveHz) — hz에 비례시키면 먼 숲이 하늘 한가운데 뜬다.
//    대기 원근: 채도↓ 명도↑ 옅은 안개.
//  · 세계 좌표(정규화 u,v)는 지평선 아래 땅에 놓인다: toScreen(u, v) = (u·w, horizon + v·(h − horizon)).
//  · 그리기 순서는 발 위치 y-sort(뒤가 앞에 가려진다).

import type { SeasonKey } from "@/components/shared/ambient/registry";
import { makeCanvas, rng, softBlob, TAU } from "@/components/shared/ambient/scenes/util";
import { isNeutralMul, type Light } from "./light";

export const GROUND_SQUASH = 0.7;
export const HORIZON_V = 0.26;
// 지평선에서의 배율 — 0.8은 소유자 실측에서 "원근이 약하다"(2026-09-04) → 0.6(먼 나무 ≈ 가까운 나무의 6할).
export const DEPTH_FAR = 0.6;
// 대기 원근 안개 — 지평선에서 이 알파, 화면 HAZE_END_V까지 0으로. 잔디·물·발자국·생물 전부 멀수록 옅어진다(엔진이 장면 위에 한 겹).
// 0.34/0.58은 화면 절반을 우윳빛으로 덮어 모든 바이옴이 "안개 낀 빈 판"으로 보였다(검토 1차) → 옅고 짧게.
// 0.17/0.44도 여전히 전경·중경·원경을 같은 중간 톤으로 눌러 44장 중 30장이 밋밋했다(라운드2 사이클5 최종 지적)
// → 0.11/0.36. 하단 2/3는 안개 밖이라 어두운 전경 앵커가 살아난다.
export const HAZE_ALPHA = 0.13; // .11 → .13(2026-09-06): 하늘이 넓어진 만큼 대기층도 두꺼워 보여야 한다(검토 C)
// 안개가 사라지는 곳 — **지평선 아래 땅에서의 비율**로 적는다(2026-09-06). 화면 분수(옛 0.36)로 두면 하늘 비율을
// 키울 때(HORIZON_V) 안개 끝이 지평선을 타고 올라가 띠가 눌린다. 0.2727 × (h − hz)는 hz .12에서 정확히 옛 0.36h다.
export const HAZE_END_GV = 0.28;

export const horizonY = (h: number) => h * HORIZON_V;
/** 지평선에서 **위로** dh·h 만큼 떨어진 y. 지평선에 붙어 있어야 하는 것(먼 언덕·나무 줄·지평선 광·안개 시작)은
 *  hz에 비례(hz·0.5 …)시키면 하늘을 키울 때 하늘 한복판으로 떠오른다 — 거리로 붙인다(2026-09-06). */
export const aboveHz = (h: number, dh: number) => Math.max(0, horizonY(h) - dh * h);
/** `bakeHorizon`이 그리는 **먼 언덕의 마루**(가장 높은 지점) — 별·달·해는 이 위에만 놓인다.
 *  안 그러면 지는 해가 언덕 사면에 얹힌다(2026-09-06 라운드 7 C: 해 y 168~190 vs 언덕 마루 153~191). */
export const hillCrestY = (h: number) => aboveHz(h, 0.06) - h * 0.022;
/** 지평선 아래 땅에서의 비율 v → 화면 y. 화면 분수를 직접 쓰면 지평선을 옮길 때 전부 어긋난다. */
export const groundYAt = (v: number, h: number) => {
  const hz = horizonY(h);
  return hz + v * (h - hz);
};
/** 옛 지평선(.12) 때의 땅 높이 대비 지금 땅의 비율 — 1.0이면 예전과 같다. 절대 px로 박힌 진폭·여유를
 *  새 땅 높이에 맞추는 데 쓴다(2026-09-06 하늘 확대, 검토 B ⑤). */
export const groundK = (h: number) => (h - horizonY(h)) / Math.max(1, h * 0.88);
/** 대기 안개가 0이 되는 y. */
export const hazeEndY = (h: number) => groundYAt(HAZE_END_GV, h);

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

/** 원근 이동 배율 — **화면에서의** 속도(0.22 → 1.00). 지평선 쪽으로 갈수록 한 픽셀 가는 데 오래 걸린다.
 *  같은 걸음이라도 멀리 있으면 화면에서 천천히 움직여야 한다(2026-09-04 소유자: "토끼가 1초 뛰면 몇 백 미터를
 *  간 것처럼 지평선까지 닿는다"). 생물의 위치 적분 `v * dt`에 이 값을 곱한다. depthScale의 세제곱 = 약 4.6배 차. */
export function moveScale(y: number, h: number): number {
  const d = depthScale(y, h);
  return d * d * d;
}

/** 거리 흐림 — 지평선에서 0.78, 아래에서 1(개별 소품의 알파에 곱할 때). 화면 전체의 안개는 drawDepthHaze가 맡는다.
 *  옛 0.55는 먼 나무 **너머로 뒤 나무가 비쳐** 앞뒤 관계가 사라졌다(검토 라운드2 경계 #5: "유령처럼 보인다"). */
export function depthFade(y: number, h: number): number {
  const hz = horizonY(h);
  const t = Math.max(0, Math.min(1, (y - hz) / Math.max(1, hazeEndY(h) - hz)));
  return 0.78 + 0.22 * t;
}

const hazeCache = new Map<string, CanvasGradient>();
/** 대기 원근 안개 한 겹 — 장면을 다 그린 뒤, 조명 패스 전에. 지평선에서 짙고 화면 36%에서 사라진다. 색·알파는 조명(시간대·날씨)이
 *  정하고(라운드 2, `light.hazeRgb`/`hazeK`), 없으면 계절 안개색·기본 알파(= 옛 그림 그대로). 그라데이션은 크기·색·알파별 캐시. */
export function drawDepthHaze(g: CanvasRenderingContext2D, season: SeasonKey, w: number, h: number, light?: Light) {
  const c = light?.hazeRgb || HZ_COLORS[season].haze;
  const a = Math.min(0.6, HAZE_ALPHA * (light?.hazeK ?? 1));
  const key = `${season}:${w}:${h}:${c}:${a.toFixed(4)}`;
  let grad = hazeCache.get(key);
  const start = horizonY(h) * 0.85; // (검토 C: 안개는 대기 하부의 현상 — 넓어진 하늘의 위쪽은 건드리지 않는다) (옛 hz·0.4 = 지평선 위 .072h) 지평선 **위**에서 0으로 시작 — 지평선에서 바로 0.34로 켜지면 화면을 가로지르는 선이 생기고,
  //                        지평선을 걸친 물체는 아래(가까운)쪽만 하얘져 원근이 뒤집힌다(2026-09-04 검토 1차).
  if (!grad) {
    grad = g.createLinearGradient(0, start, 0, hazeEndY(h));
    grad.addColorStop(0, `rgb(${c} / 0)`);
    grad.addColorStop(0.16, `rgb(${c} / ${a})`);
    grad.addColorStop(0.5, `rgb(${c} / ${a * 0.42})`);
    grad.addColorStop(1, `rgb(${c} / 0)`);
    hazeCache.set(key, grad);
    if (hazeCache.size > 24) hazeCache.delete(hazeCache.keys().next().value as string);
  }
  g.save();
  g.fillStyle = grad;
  g.fillRect(0, start, w, hazeEndY(h) - start + 2);
  g.restore();
}

/** 조명 패스(라운드 2, world/light.ts) — 장면·입자·대기 안개 위에 순서대로: ① 안개 날씨의 층별 누적 안개 + 지면 안개 띠(D-3)
 *  ② 하늘/지평선 오버레이(위 → 지평선 아래 16%) ③ 지면 노출 = multiply(ΔL + 색온도) ④ 채도 = saturation 블렌드 ⑤ 옅은 틴트.
 *  점심·맑음은 다섯 개 전부 건너뛴다(항등) — 옛 파이프라인과 픽셀이 같다. 캔버스는 장면이 전면을 채워 불투명하다(multiply 안전). */
export function drawLightPass(g: CanvasRenderingContext2D, w: number, h: number, L: Light) {
  const hz = horizonY(h);
  g.save();
  if (L.groundFog > 0) {
    const c = L.hazeRgb || "228 232 234";
    const f = L.groundFog;
    // 층별 누적 — 후경 .55 · 중경 .3 · 전경 .1(GRAMMAR §3.2 안개 행). 위는 α 0에서 시작해 hz·.5에서 .55f로 오른다 — 옛 코드는
    // 첫 스톱이 .55f인 채 hz·.5에서 fillRect를 시작해 어두운 하늘(새벽·밤)에 전폭 가로 절단선(−2~−4 L)이 생겼다(라운드 3 C#6).
    const y0 = aboveHz(h, 0.06);
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, `rgb(${c} / 0)`);
    gr.addColorStop(y0 / h, `rgb(${c} / ${(0.55 * f).toFixed(3)})`);
    gr.addColorStop(y0 / h + 0.32 * (1 - y0 / h), `rgb(${c} / ${(0.3 * f).toFixed(3)})`);
    gr.addColorStop(y0 / h + 0.62 * (1 - y0 / h), `rgb(${c} / ${(0.1 * f).toFixed(3)})`);
    gr.addColorStop(1, `rgb(${c} / ${(0.08 * f).toFixed(3)})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    // 지면 안개 띠 — 발치 높이(v ≈ .3)에 낮게 깔린 띠. 드리프트하는 뭉치는 입자층이 맡는다.
    const by = hz + 0.3 * (h - hz);
    const bh = 0.1 * h;
    const gb = g.createLinearGradient(0, by - bh, 0, by + bh);
    gb.addColorStop(0, `rgb(${c} / 0)`);
    gb.addColorStop(0.5, `rgb(${c} / ${(0.25 * f).toFixed(3)})`);
    gb.addColorStop(1, `rgb(${c} / 0)`);
    g.fillStyle = gb;
    g.fillRect(0, by - bh, w, bh * 2);
  }
  if (L.skyAlpha > 0) {
    // 하늘 오버레이는 **지평선 바로 아래(hz + .06h)에서 끝난다** — 옛 hz + .16h는 산 ①·② 봉우리(y 150~300)까지 덮어
    // 하늘↔①↔② 단차를 눌렀다(라운드 2 실측 5.6/5.9 → 2.5/2.2). 봉우리는 multiply만 받는다.
    // **지평선 광**(QA 라운드 3, AMB-D1-01): 하늘은 천정이 어둡고 지평선 쪽이 밝다(대기 산란). 오버레이 색을 아래로 갈수록
    // 밝은 판으로 섞고 α도 줄여 지평선 바로 위의 하늘이 ① 봉우리보다 ≥ 4L 밝게 남는다 — 라운드 2에서 하늘↔①이 2.2~4.0으로
    // 눌린 원인은 오버레이가 지평선까지 같은 어두운 색이었기 때문이다. 점심·맑음은 skyAlpha 0이라 그대로.
    const end = hz * 1.1; // 하늘 판 **안에서** 끝난다(검토 C: hz+.06h를 그대로 두면 원경 띠와 겹쳐 능선 위 하늘만 두 번 눌린다)
    const gs = g.createLinearGradient(0, 0, 0, end);
    const glow = L.sky
      .split(" ")
      .map((v) => Math.round(Number(v) + (236 - Number(v)) * 0.55))
      .join(" ");
    gs.addColorStop(0, `rgb(${L.sky} / ${L.skyAlpha.toFixed(3)})`);
    gs.addColorStop(0.5, `rgb(${L.sky} / ${(L.skyAlpha * 0.6).toFixed(3)})`);
    gs.addColorStop(0.82, `rgb(${glow} / ${(L.skyAlpha * 0.25).toFixed(3)})`);
    gs.addColorStop(1, `rgb(${glow} / 0)`);
    g.fillStyle = gs;
    g.fillRect(0, 0, w, end);
    // **원경 띠 어둡힘**(라운드 3 AMB-D1-01, 2차): 지평선 바로 아래의 먼 것(산 ①·②, 먼 언덕·나무 줄, 먼 수면)은 노을·밤에 **하늘보다
    // 어두운 실루엣**이다 — 하늘만 오버레이로 어둡히고 ①은 multiply만 받으면 노을·밤에 ①이 하늘보다 밝아 층이 뒤집힌다(라운드 2
    // 실측 2.2~4.0 → 라운드 3 1차 −3.4). ①·②를 같은 α로 하늘색 쪽으로 눌러(①↔② 비례 유지) ③ 앞에서 사라진다. 점심·맑음 0.
    const fa = L.skyAlpha * 0.6;
    const fEnd = groundYAt(0.3, h); // 원경 띠는 땅의 위 30%까지(검토 C: 옛 hz+.42h는 화면 68%를 덮는다)
    const gf = g.createLinearGradient(0, hz, 0, fEnd);
    // 시작은 α 0에서 — 옛 .7fa 시작은 지평선(hz)에 밤 3.4 L 전폭 계단을 남겼다(라운드 4 A#3). .04h 안에 .7fa로 오르고
    // ① 봉우리(hz + .05h 아래)부터는 옛 값 그대로라 산 층 단차(라운드 3 B 표)는 그대로다.
    gf.addColorStop(0, `rgb(${L.sky} / 0)`);
    gf.addColorStop(0.04 / 0.42, `rgb(${L.sky} / ${(fa * 0.7).toFixed(3)})`);
    gf.addColorStop(0.12, `rgb(${L.sky} / ${fa.toFixed(3)})`);
    gf.addColorStop(0.45, `rgb(${L.sky} / ${fa.toFixed(3)})`);
    gf.addColorStop(1, `rgb(${L.sky} / 0)`);
    g.fillStyle = gf;
    g.fillRect(0, hz, w, fEnd - hz);
    // **하늘의 방향**(라운드 4 A#2 "노을 하늘 좌(30,10) = 우(1370,10), 방향 0 → 세피아 필터로 읽힘"): 해·달 쪽(reflect.x)은 밝은 판(glow)으로
    // 밝히고 반대쪽은 하늘색으로 한 번 더 눌러, 지평선 위 띠가 좌우로 기울어진 빛을 갖는다. 세기 skyK(노을 .32 · 새벽 .16 · 저녁 .14 ·
    // 밤 .1, 흐림·비·안개 0). 점심·아침은 0 — 항등. 색은 이미 오행 팔레트(회장미·청회)의 밝은/어두운 판이라 새 색을 들이지 않는다.
    if (L.reflect.skyK > 0.005) {
      const k = L.reflect.skyK;
      const gh = g.createLinearGradient(0, 0, w, 0);
      const u = Math.max(0, Math.min(1, L.reflect.x));
      // 해 쪽 끝 = glow α k, 해 자리 = glow α .7k, 반대쪽 끝 = 하늘색 α .8k.
      const stops: [number, string][] = u < 0.5
        ? [[0, `rgb(${glow} / ${k.toFixed(3)})`], [u, `rgb(${glow} / ${(k * 0.7).toFixed(3)})`], [Math.min(1, u + 0.3), `rgb(${glow} / 0)`], [1, `rgb(${L.sky} / ${(k * 0.8).toFixed(3)})`]]
        : [[0, `rgb(${L.sky} / ${(k * 0.8).toFixed(3)})`], [Math.max(0, u - 0.3), `rgb(${glow} / 0)`], [u, `rgb(${glow} / ${(k * 0.7).toFixed(3)})`], [1, `rgb(${glow} / ${k.toFixed(3)})`]];
      for (const [p, c] of stops) gh.addColorStop(p, c);
      // 세로 범위는 하늘 오버레이와 같다(0 ~ end) — 원경 띠는 이미 far-band가 눌렀다.
      g.fillStyle = gh;
      g.fillRect(0, 0, w, end);
    }
  }
  if (!isNeutralMul(L.mul)) {
    // 지면 노출은 세로 그라데이션 — 지평선 쪽(원경)은 35% 덜 누른다. 밤의 원경은 하늘빛을 받아 상대적으로 밝고(대기 원근),
    // 같은 비율로 누르면 산 층 단차가 비례로 줄어 밤에 ①↔②가 사라진다(MOUNTAIN §4 밤 ≥ 6L).
    const far: [number, number, number] = [
      Math.round(L.mul[0] + (255 - L.mul[0]) * 0.35),
      Math.round(L.mul[1] + (255 - L.mul[1]) * 0.35),
      Math.round(L.mul[2] + (255 - L.mul[2]) * 0.35)
    ];
    const gm = g.createLinearGradient(0, 0, 0, groundYAt(0.4318, h)); // = 옛 h·.5
    gm.addColorStop(0, `rgb(${far[0]} ${far[1]} ${far[2]})`);
    gm.addColorStop(Math.min(0.99, aboveHz(h, 0.012) / Math.max(1, groundYAt(0.4318, h))), `rgb(${far[0]} ${far[1]} ${far[2]})`);
    gm.addColorStop(1, `rgb(${L.mul[0]} ${L.mul[1]} ${L.mul[2]})`);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = gm;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = "source-over";
  }
  if (L.desat > 0) {
    g.globalCompositeOperation = "saturation";
    g.globalAlpha = L.desat;
    g.fillStyle = "rgb(128 128 128)";
    g.fillRect(0, 0, w, h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
  if (L.tint.alpha > 0) {
    g.fillStyle = `rgb(${L.tint.rgb} / ${L.tint.alpha.toFixed(3)})`;
    g.fillRect(0, 0, w, h);
  }
  g.restore();
}

/** y-sort — 발 위치 y가 작은 것(먼 것)부터. 제자리 정렬. */
export function ySort<T extends { y: number }>(items: T[]): T[] {
  return items.sort((a, b) => a.y - b.y);
}

const HZ_COLORS: Record<SeasonKey, { haze: string; hill: string; hill2: string; tree: string }> = {
  spring: { haze: "232 240 226", hill: "#c2d6b0", hill2: "#b0c89e", tree: "#8fae7c" },
  summer: { haze: "226 236 222", hill: "#a9c79a", hill2: "#96b888", tree: "#6f9a62" },
  autumn: { haze: "228 224 214", hill: "#c1b7a0", hill2: "#a99d86", tree: "#8a7256" },
  winter: { haze: "240 243 247", hill: "#e6ebf1", hill2: "#dbe2ea", tree: "#8a8f86" }
};

/** 지평선 띠를 한 번 굽는다(w×(hz+24)) — 안개 그라데이션 + 낮은 언덕 두 겹 + 작은 나무 줄(실루엣). 결정적(폭·계절 시드).
 *  장면은 바탕을 그린 뒤 이것을 위에 얹는다(캔버스 위 12%). 채도가 낮고 밝아 "멀다"로 읽힌다. */
export type HorizonProfile = "land" | "sea" | "mountain";
/** profile "sea" = 먼 언덕·나무 줄 없이 안개 띠와 수평선만(바다·해안은 뭍의 능선이 있으면 거짓말이 된다).
 *  profile "mountain" = 같음 — 산은 봉우리 자체가 원경이라, 그 뒤에 초원의 언덕·나무 줄이 비치면 "봉우리 속 언덕"이 된다
 *  (QA 라운드 1 D-2, MOUNTAIN_DEPTH_RULES §1). */
export function bakeHorizon(season: SeasonKey, w: number, h: number, dpr = 1, profile: HorizonProfile = "land"): HTMLCanvasElement {
  const hz = horizonY(h);
  // 띠는 지평선 아래로 **길게** 이어진다(옛 24px). 24px 안에서 안개를 0으로 떨어뜨리면 그 끝이 44장 전부에
  // 전폭 가로 이음매로 보였다(검토 라운드2 #1: "흐린 원경 띠가 뚝 끝나고 지면이 시작한다"). 화면 높이의 16%에
  // 걸쳐 서서히 사라지면 띠와 땅이 경계선 없이 섞인다.
  const H = Math.ceil(hz + Math.max(48, (h - hz) * 0.22)); // 지금과 같은 두께감(검토 C)
  const { c, g } = makeCanvas(Math.max(1, Math.ceil(w * dpr)), Math.ceil(H * dpr));
  g.scale(dpr, dpr);
  const col = HZ_COLORS[season];
  const r = rng(311 + Math.round(w) * 3 + season.length);
  // 안개 — 위는 짙게, 지평선 아래로 옅어진다(대기 원근).
  const grad = g.createLinearGradient(0, 0, 0, H);
  // 위쪽 α .55 → .28(라운드 5): 하늘 판(world/sky.ts)이 생겨 안개가 하늘을 하얗게 덮으면 가을의 높은 파랑이 죽는다. 지평선 값은 그대로(계단 없음).
  grad.addColorStop(0, `rgb(${col.haze} / 0.18)`);
  // 지평선에서의 값은 엔진의 대기 안개(drawDepthHaze, HAZE_ALPHA 0.17)와 **같아야** 계단이 안 생긴다.
  grad.addColorStop(hz / H, `rgb(${col.haze} / ${HAZE_ALPHA})`);
  grad.addColorStop(0.62, `rgb(${col.haze} / ${HAZE_ALPHA * 0.4})`);
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
  if (profile === "land") {
    hill(aboveHz(h, 0.06), h * 0.022, col.hill, 0.5, 1.3); // 진폭도 hz 비례가 아니라 절대치(= 옛 hz·0.18)
    hill(aboveHz(h, 0.034), h * 0.017, col.hill2, 0.5, 4.1);
  }
  // 작은 나무 줄 — 지평선 바로 위에 실루엣(둥근 수관 + 짧은 줄기), 겨울은 나목 점. 드문드문·옅게(먼 숲의 윤곽).
  // 먼 숲 실루엣 줄(라운드 5 A#8 — 옛 "같은 크기 원+막대 롤리팝 20여 개 한 줄"): 세 종(둥근 참나무·삼각 소나무·낮은 관목) × 크기 3단(±35%),
  // 무리 3~5 + 빈 구간, 기준선 y ±4px 흩기, 줄기 폭은 수관에 비례. 픽셀 격자(2px)로 찍어 AA 없음.
  const n = profile === "land" ? Math.round(w / 34) : 0;
  g.fillStyle = col.tree;
  let skip = 0;
  let runLeft = 0;
  for (let i = 0; i < n; i++) {
    if (skip > 0) { skip--; continue; }
    if (runLeft <= 0) {
      if (r() < 0.35) { skip = 2 + Math.floor(r() * 4); continue; } // 빈 구간
      runLeft = 3 + Math.floor(r() * 3);
    }
    runLeft--;
    const pitch = w / n;
    const x = Math.round(((i + 0.5) * pitch + (r() - 0.5) * pitch * 0.9) / 2) * 2;
    const s = (4 + r() * 7) * (0.65 + r() * 0.7);
    const y = Math.round((aboveHz(h, 0.024) + (r() - 0.5) * 8) / 2) * 2;
    g.globalAlpha = 0.3 + r() * 0.18;
    const kind = r();
    const tw = Math.max(2, Math.round((s * 0.2) / 2) * 2);
    if (season === "winter" || kind < 0.3) {
      // 나목/소나무 — 삼각 실루엣(계단 3~4단)
      const hh = s * 1.6;
      const tiers = 3 + (s > 8 ? 1 : 0);
      for (let t = 0; t < tiers; t++) {
        const tw2 = Math.round((s * (1 - t * 0.22)) / 2) * 2;
        const ty = Math.round((y - (hh * t) / tiers) / 2) * 2;
        g.fillRect(x - tw2 / 2, ty - Math.round(hh / tiers), tw2, Math.round(hh / tiers) + 1);
      }
      g.fillRect(x - tw / 2, y - 3, tw, 4);
    } else if (kind < 0.55) {
      // 낮은 관목 — 넓고 낮은 둔덕
      const bw = Math.round((s * 1.6) / 2) * 2;
      g.fillRect(x - bw / 2, y - Math.round(s * 0.6), bw, Math.round(s * 0.6) + 1);
      g.fillRect(x - Math.round(bw * 0.35), y - Math.round(s * 0.9), Math.round(bw * 0.7), Math.round(s * 0.35));
    } else {
      // 둥근 수관 — 사각 계단 셋 + 줄기
      const cw = Math.round((s * 1.4) / 2) * 2;
      const ch = Math.round(s * 0.9);
      g.fillRect(x - cw / 2, y - ch, cw, ch);
      g.fillRect(x - Math.round(cw * 0.36), y - ch - Math.round(s * 0.4), Math.round(cw * 0.72), Math.round(s * 0.4) + 1);
      g.fillRect(x - Math.round(cw * 0.62), y - ch + Math.round(ch * 0.3), Math.round(cw * 1.24), Math.round(ch * 0.4));
      g.fillRect(x - tw / 2, y - 2, tw, Math.round(s * 0.6));
    }
  }
  g.globalAlpha = 1;
  // 지평선 선 — 아주 옅은 밝은 줄(하늘과 땅의 경계 느낌). 반경이 캔버스 높이보다 크면 **아래에서 뭉텅 잘려**
  // 44장 전부에 y=hz+24 가로선이 생긴다(2026-09-04 검토 4차) → 세로로 눌러 띠 안에서 끝내고, 아래 24행은 지운다.
  softBlob(g, w / 2, aboveHz(h, 0.06), w * 0.6, "255 255 255", 0.12, 0, (h * 0.066) / (w * 0.6));
  const fh = H - hz;
  const fade = g.createLinearGradient(0, hz, 0, H);
  fade.addColorStop(0, "rgb(0 0 0 / 0)");
  fade.addColorStop(0.55, "rgb(0 0 0 / 0.55)");
  fade.addColorStop(1, "rgb(0 0 0 / 1)");
  g.save();
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = fade;
  g.fillRect(0, hz, w, fh + 1);
  g.restore();
  return c;
}

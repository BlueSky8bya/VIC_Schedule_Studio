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
// 지평선에서의 배율 — 0.8은 소유자 실측에서 "원근이 약하다"(2026-09-04) → 0.6(먼 나무 ≈ 가까운 나무의 6할).
export const DEPTH_FAR = 0.6;
// 대기 원근 안개 — 지평선에서 이 알파, 화면 HAZE_END_V까지 0으로. 잔디·물·발자국·생물 전부 멀수록 옅어진다(엔진이 장면 위에 한 겹).
// 0.34/0.58은 화면 절반을 우윳빛으로 덮어 모든 바이옴이 "안개 낀 빈 판"으로 보였다(검토 1차) → 옅고 짧게.
// 0.17/0.44도 여전히 전경·중경·원경을 같은 중간 톤으로 눌러 44장 중 30장이 밋밋했다(라운드2 사이클5 최종 지적)
// → 0.11/0.36. 하단 2/3는 안개 밖이라 어두운 전경 앵커가 살아난다.
export const HAZE_ALPHA = 0.11;
export const HAZE_END_V = 0.36;

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
  const t = Math.max(0, Math.min(1, (y - hz) / Math.max(1, h * HAZE_END_V - hz)));
  return 0.78 + 0.22 * t;
}

const hazeCache = new Map<string, CanvasGradient>();
/** 대기 원근 안개 한 겹 — 장면을 다 그린 뒤, 빛 톤 전에. 지평선에서 짙고 화면 58%에서 사라진다(계절 안개색). 그라데이션은 크기·계절별 캐시. */
export function drawDepthHaze(g: CanvasRenderingContext2D, season: SeasonKey, w: number, h: number) {
  const key = `${season}:${w}:${h}`;
  let grad = hazeCache.get(key);
  const hz = horizonY(h);
  const start = hz * 0.4; // 지평선 **위**에서 0으로 시작 — 지평선에서 바로 0.34로 켜지면 화면을 가로지르는 선이 생기고,
  //                        지평선을 걸친 물체는 아래(가까운)쪽만 하얘져 원근이 뒤집힌다(2026-09-04 검토 1차).
  if (!grad) {
    grad = g.createLinearGradient(0, start, 0, h * HAZE_END_V);
    const c = HZ_COLORS[season].haze;
    grad.addColorStop(0, `rgb(${c} / 0)`);
    grad.addColorStop(0.16, `rgb(${c} / ${HAZE_ALPHA})`);
    grad.addColorStop(0.5, `rgb(${c} / ${HAZE_ALPHA * 0.42})`);
    grad.addColorStop(1, `rgb(${c} / 0)`);
    hazeCache.set(key, grad);
    if (hazeCache.size > 12) hazeCache.delete(hazeCache.keys().next().value as string);
  }
  g.save();
  g.fillStyle = grad;
  g.fillRect(0, start, w, h * HAZE_END_V - start + 2);
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
  const H = Math.ceil(hz + Math.max(48, h * 0.16));
  const { c, g } = makeCanvas(Math.max(1, Math.ceil(w * dpr)), Math.ceil(H * dpr));
  g.scale(dpr, dpr);
  const col = HZ_COLORS[season];
  const r = rng(311 + Math.round(w) * 3 + season.length);
  // 안개 — 위는 짙게, 지평선 아래로 옅어진다(대기 원근).
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, `rgb(${col.haze} / 0.55)`);
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
    hill(hz * 0.5, hz * 0.18, col.hill, 0.5, 1.3);
    hill(hz * 0.72, hz * 0.14, col.hill2, 0.5, 4.1);
  }
  // 작은 나무 줄 — 지평선 바로 위에 실루엣(둥근 수관 + 짧은 줄기), 겨울은 나목 점. 드문드문·옅게(먼 숲의 윤곽).
  const n = profile === "land" ? Math.round(w / 34) : 0;
  g.fillStyle = col.tree;
  let skip = 0;
  for (let i = 0; i < n; i++) {
    // 무리 짓기 — 균일 피치 + 작은 흔들림이면 "점선 자"로 읽힌다(검토 3차).
    if (skip > 0) { skip--; continue; }
    if (r() < 0.3) { skip = 1 + Math.floor(r() * 3); continue; }
    const pitch = w / n;
    const x = (i + 0.5) * pitch + (r() - 0.5) * pitch * 0.9;
    const s = 3 + r() * 8;
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
  // 지평선 선 — 아주 옅은 밝은 줄(하늘과 땅의 경계 느낌). 반경이 캔버스 높이보다 크면 **아래에서 뭉텅 잘려**
  // 44장 전부에 y=hz+24 가로선이 생긴다(2026-09-04 검토 4차) → 세로로 눌러 띠 안에서 끝내고, 아래 24행은 지운다.
  softBlob(g, w / 2, hz * 0.5, w * 0.6, "255 255 255", 0.12, 0, (hz * 0.55) / (w * 0.6));
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

// 최초공개(떡밥) 긴장 곡선 — 60초부터 공개 순간까지 '연속' 강도 모델.
// (설계 근거: docs/ux/motion/continuous-hype-curve-plan.ko.md)
//
// 예전엔 h1~h4 이산 단계라 경계에서 툭 바뀌는 게 보였다(사용자 지적). 이제 남은 시간 하나로
// 0~1 강도 I를 만들고, 모든 시각 채널이 I에서 파생된다 → 어느 순간을 잘라 봐도 자연스럽다.
//
// 곡선:
//   60~55초 진입 램프: smootherstep(값·기울기 모두 0에서 출발 → '켜짐'이 안 보인다) × 0.08
//   55~0초 본 곡선: 0.08 + 0.92 · u^1.7 (후반으로 갈수록 가속)
// 주기(period)는 절대 직접 보간하지 않는다 — 빈도(1/P)를 보간해야 후반 가속이 뭉개지지 않는다.

export const HYPE_WINDOW_S = 60; // 하이프가 시작되는 남은 시간
const RAMP_S = 5; // 진입 램프 길이(60~55초)
const RAMP_TOP = 0.08; // 램프 끝 강도
const BODY_EXP = 1.7; // 본 곡선 지수

export function clamp01(v: number): number {
  if (Number.isNaN(v)) return 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function smootherstep(x: number): number {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

// 남은 밀리초 → 강도 I(0~1). 60초보다 많이 남았으면 0, 공개 시각을 지났으면 1.
export function hypeIntensity(remainMs: number): number {
  if (!Number.isFinite(remainMs)) return 0;
  const s = remainMs / 1000;
  if (s >= HYPE_WINDOW_S) return 0;
  if (s <= 0) return 1;
  const rampStart = HYPE_WINDOW_S - RAMP_S; // 55
  if (s > rampStart) {
    // 60~55초: 0 → 0.08
    return RAMP_TOP * smootherstep((HYPE_WINDOW_S - s) / RAMP_S);
  }
  // 55~0초: 0.08 → 1
  const u = clamp01((rampStart - s) / rampStart);
  return RAMP_TOP + (1 - RAMP_TOP) * Math.pow(u, BODY_EXP);
}

// I → 각 시각 채널. 지수(alpha)로 채널마다 '언제 존재감이 커지는지'를 다르게 준다:
// 크기·색은 낮은 지수(중반에도 변화 감지), 흔들림·백색 후광은 높은 지수(후반 집중).
export type HypeChannels = {
  intensity: number;
  ringDurationS: number; // 빛 파동 주기(빈도 보간)
  ring1: number; // 링 3개의 불투명도 — DOM 추가 대신 스며들게
  ring2: number;
  ring3: number;
  shakePx: number; // 카드 '내용'만 흔든다(박스·클릭 타깃 고정)
  shakeDurationS: number;
  goldMix: number; // 보라 → 금빛 혼합률(0~1)
  glow: number; // 따뜻한 후광 불투명도(반복 점멸 없음, 상승만)
  numberScale: number; // 남은 초 글자 크기(em)
  dashDurationS: number; // 리더 점선 흐름 주기(빈도 보간)
};

// 빈도 보간 헬퍼: 주기 a→b를 '빈도' 공간에서 보간한 뒤 다시 주기로.
function lerpPeriod(a: number, b: number, i: number, alpha: number): number {
  const fa = 1 / a;
  const fb = 1 / b;
  const f = fa + (fb - fa) * Math.pow(i, alpha);
  return 1 / f;
}
function lerp(a: number, b: number, i: number, alpha: number): number {
  return a + (b - a) * Math.pow(i, alpha);
}
// 늦게 등장하는 채널 — I가 start를 넘어선 뒤부터 0→1로 자란다.
function delayed(i: number, start: number, alpha: number): number {
  if (i <= start) return 0;
  return Math.pow((i - start) / (1 - start), alpha);
}

export function hypeChannels(intensity: number): HypeChannels {
  const i = clamp01(intensity);
  return {
    intensity: i,
    ringDurationS: lerpPeriod(2.4, 0.55, i, 0.85),
    ring1: 0.72 * Math.pow(i, 0.9),
    ring2: 0.48 * delayed(i, 0.35, 1.4),
    ring3: 0.28 * delayed(i, 0.7, 1.6),
    shakePx: lerp(0, 1.2, i, 2.4),
    shakeDurationS: lerpPeriod(1.4, 0.45, i, 1.6),
    goldMix: lerp(0, 0.78, i, 2.2),
    glow: lerp(0, 0.22, i, 4),
    numberScale: lerp(1.05, 1.85, i, 1.15),
    dashDurationS: lerpPeriod(1.8, 0.6, i, 1.3)
  };
}

// 동작 줄이기·export 캡처용 '정적 강도'. 모션은 CSS가 끄지만 값까지 0이면 임박 상태가
// 아예 안 보인다(계획 요구: 정지 상태에서도 임박이 명확해야 함). 그렇다고 연속값을 그대로
// 쓰면 캡처 시각에 따라 픽셀이 달라져 스냅샷이 흔들린다 → 3단계로 양자화해 결정적으로 만든다.
export function quantizeStaticIntensity(intensity: number): number {
  const i = clamp01(intensity);
  if (i <= 0) return 0;
  if (i < 0.4) return 0.25; // 예열
  if (i < 0.85) return 0.6; // 고조
  return 1; // 임박
}

// 채널 → CSS 커스텀 프로퍼티(요소에 직접 기록해 10Hz 리렌더를 피한다).
export function hypeCssVars(c: HypeChannels): Record<string, string> {
  return {
    "--hype-i": c.intensity.toFixed(3),
    "--hy-ring-dur": `${c.ringDurationS.toFixed(3)}s`,
    "--hy-ring1": c.ring1.toFixed(3),
    "--hy-ring2": c.ring2.toFixed(3),
    "--hy-ring3": c.ring3.toFixed(3),
    "--hy-shake-x": `${c.shakePx.toFixed(2)}px`,
    "--hy-shake-dur": `${c.shakeDurationS.toFixed(3)}s`,
    "--hy-gold": c.goldMix.toFixed(3),
    "--hy-glow": c.glow.toFixed(3),
    "--hy-num": c.numberScale.toFixed(3),
    "--hy-dash-dur": `${c.dashDurationS.toFixed(3)}s`
  };
}

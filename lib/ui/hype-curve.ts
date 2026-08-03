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

// ── 등장(emerge) ─────────────────────────────────────────────────────────────
// 60초에 '공개 시각 알약'이 사라지고 링 카운트다운이 툭 나타나면, 아무리 안쪽 연출이
// 연속이어도 시작이 띡 하고 끊긴다(사용자 지적). 66초부터 8초에 걸쳐 알약은 접히며
// 사라지고 링은 자라며 들어온다 — 두 요소가 겹치는 구간을 둬 이음새를 없앤다.
export const HYPE_EMERGE_S = 66; // 링이 스며들기 시작하는 남은 시간
const EMERGE_SPAN_S = 8; // 66 → 58

export function hypeEmerge(remainMs: number): number {
  if (!Number.isFinite(remainMs)) return 0;
  const s = remainMs / 1000;
  if (s >= HYPE_EMERGE_S) return 0;
  if (s <= HYPE_EMERGE_S - EMERGE_SPAN_S) return 1;
  return smootherstep((HYPE_EMERGE_S - s) / EMERGE_SPAN_S);
}

// ── 마지막 10초의 '시각적 진행' ──────────────────────────────────────────────
// 고요(calm)는 1.8초 만에 완성되는 '동요 끄기' 신호다. 크기·투명도까지 여기에 물리면
// 10초 언저리에서 한꺼번에 변해 '10초 되자마자 확 커진다'가 된다(사용자 지적).
// 마지막 10초 내내 천천히 진행하는 축을 따로 둔다 — 숫자는 계속 자라고, 계기(트랙·눈금·
// 꼬리·별)는 계속 물러난다. 결국 숫자만 남아 링이 있던 자리를 넘어간다.
export const HYPE_FINALE_S = 10;

export function hypeFinale(remainMs: number): number {
  if (!Number.isFinite(remainMs)) return 0;
  const s = remainMs / 1000;
  if (s >= HYPE_FINALE_S) return 0;
  if (s <= 0) return 1;
  return smootherstep((HYPE_FINALE_S - s) / HYPE_FINALE_S);
}

// ── 폭풍의 눈 ────────────────────────────────────────────────────────────────
// 강도만 끝까지 올리면 마지막 10초가 그냥 '가장 시끄러운 구간'이 된다. 그러면 클라이맥스가
// 소음에 묻힌다. 그래서 10초에서 동요(흔들림·잔떨림)를 한 번에 재우고, 대신 박동을 느리고
// 깊게 — 초에 맞춰 한 번씩 — 뛰게 한다. 크기·빛·색은 계속 올라가므로 조용해지지만 더
// 커진다(검이불누 화이불치: 화려하되 사치스럽지 않게).
export const HYPE_CALM_S = 10; // 고요가 '완성'되는 남은 시간
// 고요는 10초에 스위치처럼 켜지지 않는다 — 그 앞 1.8초에 걸쳐 잦아들어, 숫자 '10'이
// 이미 조용해진 자리에 떨어진다. 예전엔 0.35초 만에 끊겨 애니메이션 없이 확 바뀌는
// 느낌이었다(사용자 지적). smootherstep이라 시작·끝의 기울기도 0이라 이음새가 없다.
const CALM_LEAD_S = 1.8;

export function hypeCalm(remainMs: number): number {
  if (!Number.isFinite(remainMs)) return 0;
  const s = remainMs / 1000;
  if (s >= HYPE_CALM_S + CALM_LEAD_S) return 0;
  if (s <= HYPE_CALM_S) return 1;
  return smootherstep((HYPE_CALM_S + CALM_LEAD_S - s) / CALM_LEAD_S);
}

// I → 각 시각 채널. 지수(alpha)로 채널마다 '언제 존재감이 커지는지'를 다르게 준다:
// 크기·색은 낮은 지수(중반에도 변화 감지), 흔들림·백색 후광은 높은 지수(후반 집중).
export type HypeChannels = {
  intensity: number;
  calm: number; // 폭풍의 눈 세기(0~1) — 마지막 10초
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
  sheetWarm: number; // 팝오버 시트 표면 온도(0=크림, 1=금빛). 장식색보다 이르게 오른다.
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

// calm(0~1)은 '폭풍의 눈' 세기다. 동요 채널만 재우고 주기를 늘린다 — 크기·빛·색은 안 건드린다.
export function hypeChannels(intensity: number, calm = 0): HypeChannels {
  const i = clamp01(intensity);
  const c = clamp01(calm);
  return {
    intensity: i,
    calm: c,
    // 하한 0.62s = 1.61Hz. 임의의 1초 창에 들어오는 박동 peak는 최대 2회, 여기에 공개
    // 순간의 단발 섬광 1회를 더해도 3회로 WCAG 2.3.1(초당 3회 '초과' 금지)을 넘지 않는다.
    // 0.55s(1.82Hz)면 최악값이 정확히 한계선에 붙어 여유가 0이라 프레임이 밀리는 순간
    // 위반이 된다 → 체감 차이가 거의 없는 선에서 여유를 남긴다.
    // 고요 구간에선 빠른 떨림(최소 0.62s)을 정확히 1초 박동으로 늘린다 — 박자가 곧 시계가
    // 된다(10..9..8을 몸으로 세게 된다).
    ringDurationS: lerpPeriod(2.4, 0.62, i, 0.85) * (1 - c) + 1 * c,
    ring1: 0.72 * Math.pow(i, 0.9),
    ring2: 0.48 * delayed(i, 0.35, 1.4),
    ring3: 0.28 * delayed(i, 0.7, 1.6),
    // 흔들림은 고요가 오면 사라진다 — 이게 '갑자기 조용해졌다'의 실체다.
    // ⚠ 지수가 2.4면 진폭이 곡선 맨 끝에 몰리는데, 정작 그 끝(10초)에서 고요가 0으로
    // 꺼버려 '흔들리는 구간'이 사실상 없었다(60~10초 내내 1px도 안 움직였다).
    // 고요 이전 구간에서 실제로 보이도록 더 이르게(1.25) 더 크게(1.8px) 올린다.
    shakePx: lerp(0, 1.8, i, 1.25) * (1 - c),
    shakeDurationS: lerpPeriod(1.4, 0.45, i, 1.6),
    goldMix: lerp(0, 0.78, i, 2.2),
    glow: lerp(0, 0.22, i, 4),
    // 1.05→1.85(지수 1.15)는 60초에 걸쳐 고르게 자라서, 인접한 초끼리 비교하면 차이가
    // 거의 안 느껴졌다(사용자 지적). 범위를 넓히고 지수를 올려 후반에 성장을 몰아준다.
    numberScale: lerp(1.05, 2.05, i, 1.45),
    // 리더 점선 — 시작을 더 느리게(갑자기 켜진 느낌 제거), 끝을 더 빠르게(마지막 3초의
    // 차이가 눈에 읽히게). 지수 1.15로 중반 가속을 앞당긴다. 색·밝기가 아니라 질감 이동이라
    // 점멸(flash) 예산에는 포함되지 않는다.
    dashDurationS: lerpPeriod(2.2, 0.52, i, 1.15) * (1 - c) + 1.1 * c,
    // 넓은 저채도 면은 작은 고채도 stroke보다 변화 감지가 약하다 → 금빛(I^2.2)보다 이른
    // I^1.35로 중반부터 온도를 만든다.
    sheetWarm: Math.pow(i, 1.35)
  };
}

// ── 마스터 박동 위상 ────────────────────────────────────────────────────────
// 링·리더선·기대돼요 버튼에 '같은 duration'을 주는 것만으로는 동기화가 아니다 — 각
// CSS 애니메이션은 자기가 시작된 시점부터 세므로, 요소가 다른 순간에 mount되면 위상이
// 어긋난다(따로 뛰면 산만하다). 그래서 위상을 시간에서 직접 계산한다.
//
// 주기가 계속 변하므로 elapsed/현재주기로 나누면 주기가 바뀌는 순간 위상이 점프한다.
// 올바른 정의는 빈도의 적분이다:  phase(t) = ∫ 1/P(I(τ)) dτ  (mod 1)
// 닫힌 형태가 없으므로 60초 구간을 사다리꼴로 미리 적분해 LUT로 들고 있는다.
const PHASE_LUT_STEP_MS = 20; // 100ms 커밋보다 5배 촘촘 — 정밀도 대비 메모리(약 48KB)가 싸다
const PHASE_LUT_N = Math.round((HYPE_WINDOW_S * 1000) / PHASE_LUT_STEP_MS) + 1;

// 남은 시간 → 그 순간의 주기. calm이 섞여 있어 강도만으로는 못 구한다(폭풍의 눈에서
// 주기가 갑자기 늘어난다). 주기가 불연속이어도 '빈도의 적분'인 위상은 연속이라 안전하다.
export function beatPeriodAt(remainMs: number): number {
  return hypeChannels(hypeIntensity(remainMs), hypeCalm(remainMs)).ringDurationS;
}
export function dashPeriodAt(remainMs: number): number {
  return hypeChannels(hypeIntensity(remainMs), hypeCalm(remainMs)).dashDurationS;
}

// remain=60초에서 0, remain이 줄수록 증가하는 누적 사이클 수.
function buildPhaseLut(period: (remainMs: number) => number): Float64Array {
  const lut = new Float64Array(PHASE_LUT_N);
  const dt = PHASE_LUT_STEP_MS / 1000;
  let acc = 0;
  let prev = 1 / period(HYPE_WINDOW_S * 1000);
  for (let k = 1; k < PHASE_LUT_N; k += 1) {
    const remainMs = HYPE_WINDOW_S * 1000 - k * PHASE_LUT_STEP_MS;
    const f = 1 / period(remainMs);
    acc += ((prev + f) / 2) * dt; // 사다리꼴
    prev = f;
    lut[k] = acc;
  }
  return lut;
}
let beatLut: Float64Array | null = null;
let dashLut: Float64Array | null = null;
function cyclesAt(lut: Float64Array, remainMs: number): number {
  const x = (HYPE_WINDOW_S * 1000 - remainMs) / PHASE_LUT_STEP_MS;
  if (x <= 0) return 0;
  if (x >= PHASE_LUT_N - 1) return lut[PHASE_LUT_N - 1];
  const k = Math.floor(x);
  return lut[k] + (lut[k + 1] - lut[k]) * (x - k); // 표 사이는 선형 보간
}
function fract(v: number): number {
  return v - Math.floor(v);
}

// 박동 파형 B(q) — 심장처럼 비대칭이다. 빠르게 수축(20%), 천천히 이완(35%), 나머지 휴지.
// 상승 구간이 최소 주기에서도 100ms 넘게 유지되도록 20%를 골랐다(10Hz 커밋에서 최소 한
// 샘플이 상승 구간에 들어간다 — 12%면 66ms라 프레임을 통째로 건너뛸 수 있었다).
export function beatWave(q: number): number {
  const t = fract(q);
  if (t < 0.2) return smootherstep(t / 0.2);
  if (t < 0.55) return 1 - smootherstep((t - 0.2) / 0.35);
  return 0;
}

// 한 tick의 값 — 모든 host가 같은 remainMs에서 같은 값을 받는다(mount 시점 무관).
//
// 파형 자체는 JS가 그리지 않는다. 10Hz로 크기 값을 직접 쓰면 주기 0.62초에 샘플이 6개뿐이라
// 박동이 뚝뚝 끊긴다 → 파형은 CSS 키프레임이 60fps로 그리고, JS는 '지금 이 순간이 주기의
// 어디인지'만 음수 animation-delay로 못 박는다. 이러면 나중에 mount된 요소도 같은 위상에서
// 시작하므로 링·리더선·기대돼요가 한 심장으로 뛴다(같은 duration만 주는 건 동기화가 아니다).
export type HypeMotionFrame = {
  beatPhase: number; // 0~1, 빈도 적분에서 나온 절대 위상
  dashPhase: number; // 0~1
  beatDurationS: number;
  dashDurationS: number;
  leaderPeak: number; // 박동 최대치(진폭은 I가, 파형은 위상이 결정 — 두 축을 안 섞는다)
  hopePeak: number;
  dotPeak: number;
};

export function hypeMotionFrame(remainMs: number, intensity: number): HypeMotionFrame {
  const i = clamp01(intensity);
  if (!beatLut) beatLut = buildPhaseLut(beatPeriodAt);
  if (!dashLut) dashLut = buildPhaseLut(dashPeriodAt);
  const clamped = Math.min(HYPE_WINDOW_S * 1000, Math.max(0, remainMs));
  const calm = hypeCalm(remainMs);
  const ch = hypeChannels(i, calm);
  // 고요 구간에선 박동이 느려지는 대신 '더 깊어진다' — 조용하지만 더 크게 들리는 심장.
  const deep = 1 + 0.35 * calm;
  return {
    beatPhase: fract(cyclesAt(beatLut, clamped)),
    dashPhase: fract(cyclesAt(dashLut, clamped)),
    beatDurationS: ch.ringDurationS,
    dashDurationS: ch.dashDurationS,
    leaderPeak: 0.7 * Math.pow(i, 1.6) * deep,
    // 1.08은 44px 타깃의 시각 외곽을 3.5px 늘린다(hit box는 고정). 1.10 이상이면 옆 요소와 붙는다.
    hopePeak: 0.08 * Math.pow(i, 1.4) * deep,
    dotPeak: 0.45 * Math.pow(i, 1.6) * deep
  };
}

// 정지 상태(동작 줄이기·export)용 프레임 — 진폭 0이라 파형이 곱해져도 움직임이 없다.
export const STATIC_MOTION_FRAME: HypeMotionFrame = {
  beatPhase: 0,
  dashPhase: 0,
  beatDurationS: 2.4,
  dashDurationS: 2.2,
  leaderPeak: 0,
  hopePeak: 0,
  dotPeak: 0
};

export function hypeMotionCssVars(f: HypeMotionFrame): Record<string, string> {
  return {
    // 음수 delay = '이 애니메이션은 이미 phase만큼 진행된 상태다'. 매 tick 다시 못 박으므로
    // duration이 변해도 위상이 표류하지 않는다.
    "--hy-beat-delay": `${(-f.beatPhase * f.beatDurationS).toFixed(4)}s`,
    "--hy-dash-delay": `${(-f.dashPhase * f.dashDurationS).toFixed(4)}s`,
    "--hy-leader-peak": f.leaderPeak.toFixed(3),
    "--hy-hope-peak": f.hopePeak.toFixed(4),
    "--hy-dot-peak": f.dotPeak.toFixed(4)
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
    "--hy-dash-dur": `${c.dashDurationS.toFixed(3)}s`,
    "--hy-sheet-warm": c.sheetWarm.toFixed(3),
    "--hy-calm": c.calm.toFixed(3)
  };
}

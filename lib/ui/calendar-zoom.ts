// 방송용 달력 확대(A안, PLAN-20260725-001 M1) — 달력 영역 위 Ctrl+휠을 브라우저 줌 대신
// 단계 확대(100/125/150%)로 바꾼다. 여기는 순수 로직만(테스트 대상) — DOM 연결은 studio-shell.
//
// 왜 단계형인가: 연속 배율은 "지금 몇 %인지"를 방송 화면에서 설명하기 어렵고, 트랙패드에선
// 한 제스처에 wheel 이벤트가 수십 개 와서 순식간에 끝까지 가버린다. 예측 가능한 3단만 두고
// 누적 임계값 + cooldown으로 "한 제스처 ≈ 한 단계"를 보장한다.

/**
 * 스튜디오 셸 전체 CSS `zoom`(studio-shell.css: ≥1700px 0.9, ≥2400px 0.8)의 현재 배율.
 * ⚠ CSS zoom 아래에서 `getBoundingClientRect()`는 이미 배율이 곱해진 **화면 px**를 돌려준다.
 * 그 값을 같은 zoom 안쪽 요소의 인라인 `height`/`width`(레이아웃 px)로 되쓰면 배율이 두 번
 * 곱해진다(0.9×0.9) — 드래그 '놓을 자리' 스페이서가 카드보다 10% 낮았던 원인. 레이아웃 px가
 * 필요하면 실측값을 이 값으로 나눈다. (미디어쿼리와 반드시 같은 임계값을 유지할 것.)
 */
export function studioShellZoom(): number {
  if (typeof window === "undefined") return 1;
  if (window.matchMedia("(min-width: 2400px)").matches) return 0.8;
  if (window.matchMedia("(min-width: 1700px)").matches) return 0.9;
  return 1;
}

export const CAL_ZOOM_STEPS = [1, 1.25, 1.5] as const;
export type CalZoom = (typeof CAL_ZOOM_STEPS)[number];

/** 현재 배율에서 한 단계 이동(범위 밖이면 그대로). 목록에 없는 값이 들어와도 가장 가까운 단계 기준. */
export function stepCalZoom(current: number, dir: 1 | -1): CalZoom {
  let idx = 0;
  let best = Infinity;
  CAL_ZOOM_STEPS.forEach((step, i) => {
    const d = Math.abs(step - current);
    if (d < best) {
      best = d;
      idx = i;
    }
  });
  const next = Math.min(CAL_ZOOM_STEPS.length - 1, Math.max(0, idx + dir));
  return CAL_ZOOM_STEPS[next];
}

/** deltaMode 정규화 → px. 0=pixel 그대로, 1=line(≈16px), 2=page(≈화면 높이 대신 보수적 400px). */
export function normalizeWheelDelta(deltaY: number, deltaMode: number): number {
  if (deltaMode === 1) return deltaY * 16;
  if (deltaMode === 2) return deltaY * 400;
  return deltaY;
}

export type WheelStepper = {
  /** 정규화된 deltaY(px)와 현재 시각(ms)을 먹이고, 단계 이동이 확정되면 -1|1, 아니면 0. */
  feed(deltaPx: number, now: number): -1 | 0 | 1;
  reset(): void;
};

/**
 * 누적 임계값 + cooldown 스테퍼.
 * - 같은 방향으로 threshold(px)만큼 쌓이면 1단계 확정, 누적 초기화.
 * - 확정 직후 cooldownMs 동안은 이벤트를 버린다(트랙패드 관성 꼬리가 2단계째를 밀어붙이는 것 방지).
 * - 방향이 뒤집히면 누적을 즉시 버린다(왕복 손떨림이 상쇄 누적되는 것 방지).
 * - idleGapMs 이상 입력이 끊기면 누적을 버린다(한참 전 휠 찌꺼기가 다음 제스처와 합산 방지).
 */
export function createWheelStepper(
  {
    // 40px = '휠 한 칸'이면 어떤 입력에서도 넘는 값 — Chrome 픽셀모드 한 칸 ≈100,
    // Firefox line모드 한 칸 = 3줄×16 = 48, 일부 마우스 드라이버 ≈53. 예전 90은
    // 뒤 두 경우에서 두 칸을 굴려야 1단계가 움직였다. 트랙패드 연속 제스처의 다단계
    // 폭주는 threshold가 아니라 cooldown(220ms)이 막는다.
    threshold = 40,
    cooldownMs = 220,
    idleGapMs = 300
  }: { threshold?: number; cooldownMs?: number; idleGapMs?: number } = {}
): WheelStepper {
  let acc = 0;
  let coolUntil = 0;
  let lastFeedAt = -Infinity;
  return {
    feed(deltaPx, now) {
      if (now < coolUntil) return 0;
      if (now - lastFeedAt > idleGapMs) acc = 0;
      lastFeedAt = now;
      if (acc !== 0 && Math.sign(deltaPx) !== Math.sign(acc)) acc = 0;
      acc += deltaPx;
      if (Math.abs(acc) < threshold) return 0;
      const dir = acc < 0 ? 1 : -1; // 휠 위로(deltaY<0) = 확대
      acc = 0;
      coolUntil = now + cooldownMs;
      return dir;
    },
    reset() {
      acc = 0;
      coolUntil = 0;
    }
  };
}

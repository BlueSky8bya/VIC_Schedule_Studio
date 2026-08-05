// 편집실에서 일정 카드를 끌 때의 '손맛' — 순수 함수 + 상수만(DOM 없음, vitest로 검증).
//
// 2026-08-06 사용자 결정: **회전은 없앤다.** 대신 움직임이 툭툭 끊기지 않게 부드럽게,
// 그리고 놓았을 때 제자리로 '뿅' 들어가게.
//
// 벤치마킹(iOS 드래그앤드롭 / macOS Dock):
//   · 집으면 살짝 커지고 그림자가 깊어진다. **기울지 않는다** — 애플은 카드를 안 눕힌다.
//   · 손가락을 뒤따를 때 임계감쇠 스프링(찰랑임 없이 살짝 늦게 따라옴)을 쓴다.
//   · 놓으면 목적지로 스프링으로 빨려 들어가며 크기가 제자리로 돌아온다(살짝 오버슈트 = '뿅').
//   · 살아있는 느낌은 회전이 아니라 **아주 작은 흔들림 + 크기 호흡**으로 낸다.

/** 손을 따라가는 스프링(임계감쇠에 가깝게 — 흔들리지 않고 살짝 늦게). */
export const FOLLOW_STIFF = 210;
export const FOLLOW_DAMP = 26;
/** 놓을 때 목적지로 빨려 들어가는 스프링 — 조금 더 단단하고 살짝 튄다('뿅'). */
export const LAND_STIFF = 300;
export const LAND_DAMP = 24;
/** 착지 애니메이션 상한(ms) — 이 안에 못 끝나면 그냥 마무리한다(멈춘 유령을 남기지 않는다). */
export const LAND_MAX_MS = 420;
/** 집었을 때 크기. */
export const LIFT_SCALE = 1.06;
/** 흔들림(회전 아님 — 위치를 흔든다). 최대 진폭(px)과 속도에 따른 반응. */
export const SWAY_MAX = 3.2;
export const SWAY_SPEED_FULL = 0.7; // px/ms — 이 속도면 흔들림이 최대
/** 들고 가만히 있을 때도 남는 최소 비율 — '손에 들려 있다'는 숨결(완전 정지는 죽어 보인다). */
export const SWAY_IDLE = 0.32;
/** 던져 버릴 때(화면 밖) 판정 — 회전이 없어졌으므로 **속도만** 본다. */
export const FLING_SPEED = 1.35;

/** 한 프레임 스프링 적분(semi-implicit Euler). dt는 초 단위, 큰 프레임 끊김은 잘라 안정성 확보. */
export function springStep(
  pos: number,
  vel: number,
  target: number,
  stiff: number,
  damp: number,
  dt: number
): { pos: number; vel: number } {
  const h = Math.min(Math.max(dt, 0), 1 / 30); // 30fps보다 긴 프레임은 잘라낸다(발산 방지)
  const a = -stiff * (pos - target) - damp * vel;
  const v = vel + a * h;
  return { pos: pos + v * h, vel: v };
}

/**
 * 아주 작은 흔들림. 회전이 아니라 위치를 흔든다 — 빠르게 움직일 때만 살아나고 손을 멈추면 잦아든다.
 * 난수를 쓰지 않는다(주기가 다른 사인 합 = '불규칙해 보이지만' 프레임마다 재현 가능하고 검증된다).
 */
export function swayOffset(tMs: number, speed: number): { x: number; y: number } {
  const moving = Math.min(1, Math.max(0, speed / SWAY_SPEED_FULL));
  const k = SWAY_IDLE + (1 - SWAY_IDLE) * moving; // 멈춰 있어도 아주 조금은 숨 쉰다
  const amp = SWAY_MAX * k;
  const t = tMs / 1000;
  return {
    x: amp * (Math.sin(t * 7.3) * 0.6 + Math.sin(t * 11.7 + 1.1) * 0.4),
    y: amp * (Math.sin(t * 6.1 + 2.3) * 0.5 + Math.sin(t * 9.4 + 0.7) * 0.3)
  };
}

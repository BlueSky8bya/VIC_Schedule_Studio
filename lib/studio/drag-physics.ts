// 편집실에서 일정 카드를 끌 때의 '물리감' 상수와 순수 함수.
//
// 2026-08-06 사용자 지적: "빙빙 돌릴 수 있게 한 게 이제 너무 과하다 — 완전 90도로 꺾여서
// 옮길 때 불편하다." 재미는 남기되 **일이 되게** 절제한다:
//   · 기울기는 부드럽게 포화(soft clamp)시켜 어떤 손짓에도 MAX_TILT를 넘지 않는다.
//     작게 움직일 때는 예전과 거의 같고(≈선형), 크게 휘두를 때만 완만하게 눕는다.
//   · 진자를 더 길고 무겁게(중력↓·저항↑) — 같은 손짓에 덜 휘둘린다.
//   · 흔들림(wobble)은 절반 이하로.
// 던지기(화면 밖으로 던져 삭제)는 그대로 두되, 실수로 던져지지 않게 회전 문턱을 올린다.

/** 끌 때 카드가 누울 수 있는 최대 각(deg). 이 값에 점근할 뿐 절대 넘지 않는다. */
export const MAX_TILT = 16;
/** 진자 중력(px/frame^2) — 작을수록 천천히 매달린다. */
export const DRAG_GRAVITY = 0.22;
/** 진자 저항 — 작을수록 빨리 멎는다(1 = 무손실). */
export const DRAG_DAMP = 0.86;
/** 진자 길이 하한(px) — 길수록 같은 손짓에 회전이 완만하다. */
export const DRAG_MIN_LEN = 130;
/** 미세 흔들림 진폭(deg)과 난수 폭. */
export const WOBBLE_DEG = 0.45;
export const WOBBLE_RAND = 0.25;
/** 던지기 판정 — 놓는 순간 이 이상이면 날려 보낸다(px/ms, deg/frame). */
export const FLING_SPEED = 1.2;
export const FLING_SPIN = 24;

/**
 * 각도를 부드럽게 포화시킨다. |deg|가 작으면 거의 그대로, 커질수록 완만해져 max에 점근한다.
 * 딱 잘라내면(clamp) 한계에서 뚝 멈춰 뻣뻣하게 느껴진다 — tanh는 그 경계가 없다.
 */
export function softTilt(deg: number, max: number = MAX_TILT): number {
  if (max <= 0) return 0;
  return max * Math.tanh(deg / max);
}

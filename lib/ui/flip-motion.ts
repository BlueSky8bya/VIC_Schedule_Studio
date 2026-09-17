"use client";

import { reduceMotionEnabled } from "@/lib/ui/motion";

// FLIP 한 조각 — 레이아웃은 이미 새 자리/새 크기로 잡힌 요소를 `from`(옛 자리·옛 크기로 되돌리는 transform)에서
// 제자리(transform 없음)까지 스프링으로 잇는다. 편집실 달력(접기/펼치기 = scale)과 시청자 포스터(좌우 전환 = translate)가
// **같은 함수**를 쓴다(2026-09-17 소유자: 화면마다 새 장치를 만들지 말 것). 실측·좌표는 레이아웃 값이라 영향 없다.
//
// 곡선 기본값은 앱 스프링(--spring-bouncy)보다 순하게 — 표준 1.56은 시청자 stage가 72px 넘쳐 화면 밖으로 잠깐 나갔다.
export const FLIP_SPRING = "cubic-bezier(0.3, 1.25, 0.5, 1)";
export const FLIP_MS = 520; // 패널 미닫이(0.52s)와 같은 길이 — 달력과 패널이 한 덩어리로 움직인다

export function flipSpring(
  el: HTMLElement,
  from: string,
  opts: { origin?: string; easing?: string; ms?: number } = {}
): void {
  if (reduceMotionEnabled()) return; // 동작 줄이기 = 즉시
  const { origin, easing = FLIP_SPRING, ms = FLIP_MS } = opts;
  el.style.transition = "none";
  if (origin) el.style.transformOrigin = origin;
  el.style.transform = from;
  void el.offsetWidth; // 되돌린 자리를 한 프레임 확정(그래야 다음 줄이 트랜지션이 된다)
  el.style.transition = `transform ${ms}ms ${easing}`;
  el.style.transform = "";
  const done = () => {
    el.style.transition = "";
    if (origin) el.style.transformOrigin = "";
    el.removeEventListener("transitionend", done);
  };
  el.addEventListener("transitionend", done);
}

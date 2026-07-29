"use client";

import { useEffect, useRef } from "react";

// P1-DIALOG-1: 모달 카드 안에 Tab 포커스를 가둔다(순환) + 열릴 때 첫 포커서블로 진입.
// Esc 닫기와 '열기 전 포커스 복원'은 호출부의 기존 효과(B2)가 담당 — 이 훅은 가두기만 한다.
// 반환된 ref를 role="dialog" 카드 요소에 단다. active가 true인 동안만 동작.
export function useFocusTrap<T extends HTMLElement>(active: boolean) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!active) return;
    const card = ref.current;
    if (!card) return;
    const focusables = () =>
      Array.from(
        card.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.getClientRects().length > 0); // display:none 등 비가시 제외
    // 초기 포커스 — 카드 밖에 있으면 첫 포커서블(대개 닫기 버튼)로 들여보낸다.
    if (!card.contains(document.activeElement)) focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      const activeEl = document.activeElement;
      const inside = card.contains(activeEl);
      if (e.shiftKey) {
        if (!inside || activeEl === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (!inside || activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // capture: 아래 전역 단축키 리스너들(월 이동 등)보다 먼저 Tab을 소유한다.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [active]);
  return ref;
}

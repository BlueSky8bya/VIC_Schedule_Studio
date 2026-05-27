"use client";

import { useLayoutEffect, type RefObject } from "react";

// 이어진 일정(같은 data-chain) 칸들의 높이를 그 묶음에서 가장 큰 칸에 맞춘다.
// 글자 수가 달라 높이가 다른 카드들이 이어질 때 이음새가 어긋나 보이는 걸 막는다.
// 줄바꿈은 너비에 따라 달라지므로 리사이즈 때도 다시 맞춘다.
export function useEqualChainHeights(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[]
) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) {
      return;
    }
    let cancelled = false;
    function equalize() {
      if (cancelled) {
        return;
      }
      const pills = Array.from(root!.querySelectorAll<HTMLElement>("[data-chain]"));
      for (const pill of pills) {
        pill.style.minHeight = ""; // 먼저 초기화해 자연 높이를 잰다
      }
      const groups = new Map<string, HTMLElement[]>();
      for (const pill of pills) {
        const key = pill.dataset.chain;
        if (!key) {
          continue;
        }
        const list = groups.get(key);
        if (list) {
          list.push(pill);
        } else {
          groups.set(key, [pill]);
        }
      }
      for (const list of groups.values()) {
        if (list.length < 2) {
          continue; // 혼자면 맞출 필요 없음
        }
        let max = 0;
        for (const el of list) {
          max = Math.max(max, el.offsetHeight);
        }
        for (const el of list) {
          el.style.minHeight = `${max}px`;
        }
      }
    }
    equalize();
    // 첫 렌더가 웹폰트(Pretendard) 로딩 전이면 폴백 글꼴 높이로 재서 이어진 칸이 어긋난다.
    // 폰트가 준비되면 한 번 더 맞춘다(이미 로딩됐으면 즉시 resolve라 비용 없음).
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => equalize()).catch(() => {});
    }
    window.addEventListener("resize", equalize);
    return () => {
      cancelled = true;
      window.removeEventListener("resize", equalize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

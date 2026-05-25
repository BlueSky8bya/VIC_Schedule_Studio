"use client";

import { useEffect, type RefObject } from "react";

// 이어진 일정(같은 data-chain) 칸들의 높이를 그 묶음에서 가장 큰 칸에 맞춘다.
// 글자 수가 달라 높이가 다른 카드들이 이어질 때 이음새가 어긋나 보이는 걸 막는다.
// 줄바꿈은 너비에 따라 달라지므로 리사이즈 때도 다시 맞춘다.
export function useEqualChainHeights(
  ref: RefObject<HTMLElement | null>,
  deps: unknown[]
) {
  useEffect(() => {
    const root = ref.current;
    if (!root) {
      return;
    }
    function equalize() {
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
    window.addEventListener("resize", equalize);
    return () => window.removeEventListener("resize", equalize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

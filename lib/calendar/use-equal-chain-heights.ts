"use client";

import { useCallback, useEffect, useRef } from "react";

// 이어진 일정(같은 data-chain) 칸들의 높이를 그 묶음에서 가장 큰 칸에 맞춘다.
// 글자 수가 달라 높이가 다른 카드가 이어질 때 이음새가 어긋나 보이는 걸 막는다.
//
// ── 왜 callback ref인가(구조적 보장) ──
// 예전엔 RefObject + useLayoutEffect(deps)였다. 그런데 편집실 그리드는 시청자 미리보기·잠금
// 로딩·월 이동(key) 등으로 '통째로 언마운트→리마운트'된다. 그때 ref.current는 새 DOM이 되는데,
// deps에 그 트리거가 안 들어가 있으면 effect가 다시 안 돌아 '갔다 오면 높이가 틀어진' 채 굳었다.
// → 트리거를 일일이 deps에 넣는 방식은 새 화면 전환이 생길 때마다 또 깨질 수 있다(확률 0 불가).
//
// callback ref는 React가 '요소가 실제로 (언)마운트될 때마다' 반드시 호출한다. 즉 어떤 경로로
// 그리드가 다시 뜨든(미리보기 복귀·잠금 해제·월 변경·그 무엇이든) 항상 새 요소로 재설정된다.
// "어떤 상태를 deps에 빠뜨렸나"라는 문제 자체가 사라진다 → 리마운트로 인한 미정렬 확률 0.
// 그리드가 안 바뀐 채 '내용만' 바뀌는 경우(제목 수정·카드 추가/삭제)는 내부 MutationObserver가,
// 폭/스케일 변화는 ResizeObserver가 잡는다. deps는 데이터 변화 시 한 번 더 맞추는 보강일 뿐이다.
export function useEqualChainHeights<T extends HTMLElement>(
  deps: unknown[] = []
): (el: T | null) => void {
  const cleanupRef = useRef<(() => void) | null>(null);
  const scheduleRef = useRef<(() => void) | null>(null);

  const setRef = useCallback((root: T | null) => {
    // 이전 요소가 있었다면 관찰자·리스너를 모두 정리한다.
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
      scheduleRef.current = null;
    }
    if (!root) {
      return;
    }

    let cancelled = false;
    let mo: MutationObserver | null = null;

    function observe() {
      mo?.observe(root!, {
        subtree: true,
        childList: true, // 카드 생성/삭제
        characterData: true, // 제목·항목 글자 변경
        attributes: true,
        attributeFilter: ["class", "data-chain"] // style(=우리 minHeight)은 제외(self-trigger 방지)
      });
    }

    function equalize() {
      if (cancelled) {
        return;
      }
      mo?.disconnect(); // 측정·쓰기 동안 관찰 정지 → 우리 minHeight 변경이 자신을 트리거 못함
      const pills = Array.from(root!.querySelectorAll<HTMLElement>("[data-chain]"));
      for (const p of pills) {
        p.style.minHeight = ""; // 먼저 초기화해 자연 높이를 잰다
      }
      const groups = new Map<string, HTMLElement[]>();
      for (const p of pills) {
        const key = p.dataset.chain;
        if (!key) {
          continue;
        }
        const g = groups.get(key);
        if (g) {
          g.push(p);
        } else {
          groups.set(key, [p]);
        }
      }
      for (const group of groups.values()) {
        if (group.length < 2) {
          continue; // 혼자면 맞출 필요 없음
        }
        let max = 0;
        for (const el of group) {
          max = Math.max(max, el.offsetHeight);
        }
        for (const el of group) {
          el.style.minHeight = `${max}px`;
        }
      }
      observe(); // 반영 끝난 뒤 다시 관찰
    }

    // ── 왜 '매 프레임 펌프'인가(편집 패널 열 때 높이 튐 수정) ──
    // 예전엔 더블-rAF 디바운스였다. 그런데 편집 패널이 열/닫힐 때 그리드 폭이 0.52s 동안 계속
    // 바뀌고 ResizeObserver가 '매 프레임' 발화한다 → 디바운스가 대기 rAF를 매번 취소해 equalize가
    // transitionend에 딱 한 번만 돌았다. 그 사이 긴 글자 카드는 낡은 minHeight를 넘겨 '혼자 먼저'
    // 커지고, 나머지는 끝나서야 따라 점프 → '15일만 튀고 6~14가 뒤늦게 따라오는' 글리치.
    // → 트리거가 오면 '다음 프레임부터 매 프레임' equalize를 돌리고, 마지막 트리거 후 잠깐(꼬리)
    //   더 돌린다. 그러면 이어진 칸들이 폭 변화 내내 같이 높이를 맞춰 한 번에 부드럽게 움직인다.
    let pumpRaf = 0;
    let pumpUntil = 0;
    let pumping = false;
    function pump() {
      pumping = true;
      const step = () => {
        if (cancelled) {
          pumping = false;
          return;
        }
        equalize();
        if (typeof performance !== "undefined" && performance.now() < pumpUntil) {
          pumpRaf = requestAnimationFrame(step);
        } else {
          pumping = false;
        }
      };
      pumpRaf = requestAnimationFrame(step);
    }
    function schedule() {
      // 마지막 트리거 뒤로도 ~250ms(패널 transition 0.52s를 매 프레임 덮고 꼬리 여유) 더 펌프.
      pumpUntil = (typeof performance !== "undefined" ? performance.now() : 0) + 250;
      if (!pumping) {
        pump();
      }
    }
    scheduleRef.current = schedule;

    // 마운트 즉시 1차(페인트 전 가깝게) + 레이아웃 안정 후 한 번 더.
    equalize();
    schedule();
    // 웹폰트 로딩 전 폴백 글꼴로 재면 높이가 어긋난다. 준비되면 다시 맞춘다.
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => schedule()).catch(() => {});
    }
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => schedule()) : null;
    ro?.observe(root);
    mo = typeof MutationObserver !== "undefined" ? new MutationObserver(() => schedule()) : null;
    observe();
    const onSettle = () => schedule();
    root.addEventListener("animationend", onSettle);
    root.addEventListener("transitionend", onSettle);
    window.addEventListener("resize", schedule);

    cleanupRef.current = () => {
      cancelled = true;
      cancelAnimationFrame(pumpRaf);
      ro?.disconnect();
      mo?.disconnect();
      root.removeEventListener("animationend", onSettle);
      root.removeEventListener("transitionend", onSettle);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  // 데이터(이벤트/뷰 등)가 바뀌면 한 번 더 맞춘다 — MutationObserver 보강. 그리드가 안 바뀐 채
  // 내용만 갱신되는 경우의 안전망(콜백 ref는 요소가 안 바뀌면 호출되지 않으므로).
  useEffect(() => {
    scheduleRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // 컴포넌트 언마운트 시 정리.
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  return setRef;
}

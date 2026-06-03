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
    // 콘텐츠가 늦게 바뀌어(하트/뱃지 비동기 로드, 색 style 재조정 등) 칸 높이가 변하면 다시 맞춘다.
    // 우리가 쓰는 minHeight 변경이 자신을 다시 트리거하지 않게 equalize 동안엔 관찰을 끊는다.
    let mo: MutationObserver | null = null;
    function observe() {
      mo?.observe(root!, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["style", "class"]
      });
    }
    function equalize() {
      if (cancelled) {
        return;
      }
      mo?.disconnect();
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
      observe(); // 다시 관찰 시작(우리 변경분 반영 끝난 뒤)
    }
    // 레이아웃이 안정된 뒤 한 번 더 맞춘다(컨테이너 폭·스크롤바·미리보기 전환 등으로 줄바꿈이
    // 바뀔 수 있어). 더블 rAF로 브라우저가 레이아웃을 끝낸 다음 프레임에 잰다.
    let raf1 = 0;
    let raf2 = 0;
    function schedule() {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(equalize);
      });
    }
    // useLayoutEffect라 이 첫 호출은 '페인트 전'에 끝난다 → 첫 화면부터 어긋남 없이 보인다
    // (몇 초 뒤 갑자기 맞춰지는 깜빡임이 구조적으로 안 생긴다).
    equalize();
    schedule();
    // 첫 렌더가 웹폰트(Pretendard) 로딩 전이면 폴백 글꼴 높이로 재서 이어진 칸이 어긋난다.
    // 폰트가 준비되면 한 번 더 맞춘다(이미 로딩됐으면 즉시 resolve라 비용 없음).
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => schedule()).catch(() => {});
    }
    // 컨테이너(달력 그리드) 크기가 바뀌면(사이드바·미리보기 전환·창 크기) 다시 맞춘다.
    // window resize만으로는 못 잡는 레이아웃 변화(부모 폭 변화)까지 흡수해 viewer에서도 확실히 맞는다.
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => schedule()) : null;
    ro?.observe(root);
    // 첫 진입의 등장 애니(스태거 cal-cell-rise 등)는 transform/opacity라 offsetHeight를 바꾸지 않지만,
    // 애니 진행 중·연속 리렌더 타이밍이 겹치면 첫 측정이 안정되기 전에 끝나 minHeight가 안 붙는다.
    // 각 칸 애니가 끝날 때마다(특히 마지막 칸 ~850ms) 다시 맞춰, 재마운트(애니 없는 정적 상태)와
    // 같은 settled 레이아웃에서 확실히 정렬되게 한다.
    const onAnimEnd = () => schedule();
    root.addEventListener("animationend", onAnimEnd);
    // 칸 안 콘텐츠가 늦게 바뀌어도(하트/뱃지 비동기, style 재조정) 다시 맞춘다 — viewer에서 확실히.
    mo = typeof MutationObserver !== "undefined" ? new MutationObserver(() => schedule()) : null;
    observe();
    window.addEventListener("resize", schedule);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
      mo?.disconnect();
      root.removeEventListener("animationend", onAnimEnd);
      window.removeEventListener("resize", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

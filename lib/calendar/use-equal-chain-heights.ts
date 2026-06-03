"use client";

import { useLayoutEffect, type RefObject } from "react";

// 이어진 일정(같은 data-chain) 칸들의 높이를 그 묶음에서 가장 큰 칸에 맞춘다.
// 글자 수가 달라 높이가 다른 카드가 이어질 때 이음새가 어긋나 보이는 걸 막는다.
//
// 설계(race-free): 우리가 쓰는 건 minHeight(=style)뿐이다. 그래서
//  1) 변경 감지(MutationObserver)는 style을 '관찰하지 않는다' — childList/characterData/class만.
//  2) 측정·쓰기(equalize) 동안엔 MO를 잠깐 끊었다가(disconnect) 끝나고 다시 붙인다.
// 이 둘로 "우리 minHeight 쓰기가 자기 자신을 다시 트리거"하는 루프를 원천 차단한다.
// (시간 기반 suppress 창은 정당한 신호까지 먹어 첫 로드 정렬을 깨뜨려 쓰지 않는다.)
// 진짜 변화(폰트 로딩·카드 생성/삭제·제목 글자 변경·창 폭/스케일)만 다시 맞춘다.
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
    let mo: MutationObserver | null = null;

    function observe() {
      mo?.observe(root!, {
        subtree: true,
        childList: true, // 카드 생성/삭제
        characterData: true, // 제목·항목 글자 변경
        attributes: true,
        attributeFilter: ["class", "data-chain"] // style(=우리 minHeight)은 제외
      });
    }

    function equalize() {
      if (cancelled) {
        return;
      }
      mo?.disconnect(); // 측정·쓰기 동안엔 관찰 정지 → 우리 변경이 자신을 트리거 못함
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
      observe(); // 변경분 반영 끝난 뒤 다시 관찰
    }

    let raf1 = 0;
    let raf2 = 0;
    function schedule() {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(equalize);
      });
    }

    // useLayoutEffect라 이 첫 호출은 '페인트 전'에 끝난다 → 첫 화면부터 어긋남 없이 보인다.
    equalize();
    // 레이아웃이 안정된 다음 프레임에 한 번 더(컨테이너 폭·스크롤바·미리보기 전환 등 줄바꿈 변화).
    schedule();
    // 웹폰트(Pretendard) 로딩 전 폴백 글꼴로 재면 높이가 어긋난다. 준비되면 한 번 더 맞춘다.
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => schedule()).catch(() => {});
    }
    // 컨테이너(달력 그리드) 크기·포스터 스케일이 바뀌면 다시 맞춘다(폭 변화로 줄바꿈이 달라짐).
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => schedule()) : null;
    ro?.observe(root);
    // 카드 생성/삭제·글자 변경·클래스 변화를 감지해 다시 맞춘다(style=우리 minHeight는 제외).
    mo = typeof MutationObserver !== "undefined" ? new MutationObserver(() => schedule()) : null;
    observe();
    // 등장/퇴장 애니·전환이 끝나 레이아웃이 안정되면 다시 맞춘다(첫 진입 스태거 포함).
    const onSettle = () => schedule();
    root.addEventListener("animationend", onSettle);
    root.addEventListener("transitionend", onSettle);
    window.addEventListener("resize", schedule);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      ro?.disconnect();
      mo?.disconnect();
      root.removeEventListener("animationend", onSettle);
      root.removeEventListener("transitionend", onSettle);
      window.removeEventListener("resize", schedule);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

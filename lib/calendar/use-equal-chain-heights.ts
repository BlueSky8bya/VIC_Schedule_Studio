"use client";

import { useLayoutEffect, type RefObject } from "react";

// 이어진 일정(같은 data-chain) 칸들의 높이를 그 묶음에서 가장 큰 칸에 맞춘다.
// 글자 수가 달라 높이가 다른 카드들이 이어질 때 이음새가 어긋나 보이는 걸 막는다.
// 줄바꿈·내용은 폭/비동기 로드/카드 생성·삭제로 바뀌므로, 그때마다 다시 맞춘다.
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
    // 우리가 minHeight를 쓰면 칸 크기가 바뀌어 ResizeObserver가 다시 울린다 → 무한 루프가 된다.
    // 쓰기 직후 짧은 창(150ms) 동안 들어오는 관찰 신호는 '우리 변경 탓'으로 보고 무시한다.
    let suppressUntil = 0;
    const nowMs = () => (typeof performance !== "undefined" ? performance.now() : 0);

    function pills(): HTMLElement[] {
      return Array.from(root!.querySelectorAll<HTMLElement>("[data-chain]"));
    }

    let ro: ResizeObserver | null = null;
    // 새로 생긴 칩까지 ResizeObserver에 등록한다(같은 요소 재등록은 무해).
    function observePills() {
      if (!ro) {
        return;
      }
      for (const p of pills()) {
        ro.observe(p);
      }
    }

    function equalize() {
      if (cancelled) {
        return;
      }
      const list = pills();
      for (const p of list) {
        p.style.minHeight = ""; // 먼저 초기화해 자연 높이를 잰다
      }
      const groups = new Map<string, HTMLElement[]>();
      for (const p of list) {
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
      // 방금 쓴 minHeight로 인한 되울림(RO)을 잠깐 무시한다. 새로 생긴 칩 등록도 갱신.
      suppressUntil = nowMs() + 150;
      observePills();
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
    // 우리 자신의 minHeight 쓰기로 인한 신호는 무시하고, 진짜 변화만 다시 맞춘다.
    function onSignal() {
      if (nowMs() < suppressUntil) {
        return;
      }
      schedule();
    }

    // useLayoutEffect라 이 첫 호출은 '페인트 전'에 끝난다 → 첫 화면부터 어긋남 없이 보인다.
    equalize();
    schedule();
    // 웹폰트(Pretendard) 로딩 전 폴백 글꼴로 재면 높이가 어긋난다. 준비되면 한 번 더 맞춘다.
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => schedule()).catch(() => {});
    }
    // 각 칸(pill)의 크기 변화를 직접 관찰 — 카드 생성·삭제·비동기 콘텐츠(하트/뱃지)로 높이가
    // 바뀌면 그 칸만 바뀌어도(루트 크기는 그대로) 잡아 다시 맞춘다. 루트도 함께 관찰(폭 변화).
    ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onSignal) : null;
    ro?.observe(root);
    observePills();
    // 칸이 추가/삭제되거나(childList) 클래스가 바뀌면 다시 맞춘다. style은 우리가 쓰는 minHeight라
    // 관찰에서 제외(self-trigger 방지) — 크기 변화는 위 ResizeObserver가 책임진다.
    const mo =
      typeof MutationObserver !== "undefined" ? new MutationObserver(onSignal) : null;
    mo?.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "data-chain"]
    });
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

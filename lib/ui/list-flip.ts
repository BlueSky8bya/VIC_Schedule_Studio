"use client";

// 목록 FLIP(HCI 벤치마크 B4) — 필터를 켜고 끌 때 항목이 '순간이동'하지 않고 같은 물체가
// 미끄러져 이동한다(애플의 공간 연속성). 사용법:
//   const prev = captureFlip(container);          // 상태 바꾸기 '전' DOM에서 위치 캡쳐
//   setState(...);                                 // React 갱신
//   requestAnimationFrame(() => playFlip(container, prev)); // 커밋 후·페인트 전 재생
// 컨테이너 안 [data-flip-key] 요소가 대상. 이동은 translate 활주, 신규는 페이드+스케일 등장,
// 사라진 항목은 React가 이미 제거해 애니메이션하지 않는다(단순함 우선).
// reduce-motion이면 캡쳐 자체를 생략(전부 즉시 반영).

export function captureFlip(container: HTMLElement | null): Map<string, DOMRect> | null {
  if (!container || typeof document === "undefined") return null;
  if (document.documentElement.hasAttribute("data-reduce-motion")) return null;
  const map = new Map<string, DOMRect>();
  container.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((el) => {
    const key = el.dataset.flipKey;
    if (key) map.set(key, el.getBoundingClientRect());
  });
  return map;
}

export function playFlip(container: HTMLElement | null, prev: Map<string, DOMRect> | null) {
  if (!container || !prev) return;
  const spring = getComputedStyle(document.documentElement)
    .getPropertyValue("--spring-smooth")
    .trim();
  const easing = spring || "cubic-bezier(0.22, 0.61, 0.36, 1)";
  container.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((el) => {
    const key = el.dataset.flipKey;
    if (!key) return;
    const before = prev.get(key);
    try {
      if (before) {
        const after = el.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
        el.animate(
          [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }],
          { duration: 420, easing }
        );
      } else {
        // 신규 등장 — 제자리에서 살짝 떠오른다.
        el.animate(
          [
            { opacity: 0, transform: "translateY(8px) scale(0.98)" },
            { opacity: 1, transform: "none" }
          ],
          { duration: 300, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)" }
        );
      }
    } catch {
      // WAAPI 미지원 — 즉시 반영(기능 무손실)
    }
  });
}

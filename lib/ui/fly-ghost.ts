"use client";

// 카드 → 편집 패널 '잔상 비행'(HCI 벤치마크 B2의 데스크톱 버전).
//
// 데스크톱 편집실의 편집 패널은 항상 같은 자리에 떠 있는 고정 폼이라, 카드가 패널로 통째로
// morph하면 오히려 편집 리듬을 방해한다. 대신 **클릭한 카드의 실물 복제**가 살짝 떠올라
// 패널로 날아가 스며들고, 패널 테두리가 은은하게 한 번 빛나며 '받았다'고 답한다 —
// 추상적인 색 박스보다 "그 카드가 이동했다"는 물체감이 훨씬 또렷하다(애플 matched-geometry 문법).
// DOM에 1회성 요소를 만들어 WAAPI로 재생하고 끝나면 스스로 지운다(React 상태 없음).
export function flyGhost(
  fromEl: HTMLElement,
  toEl: HTMLElement,
  opts?: {
    /** 복제본에서 벗겨낼 상태 클래스(선택 링 등) — 잔상은 '평상시 모습'이어야 깔끔하다. */
    stripClasses?: string[];
  }
) {
  if (typeof document === "undefined") return;
  if (document.documentElement.hasAttribute("data-reduce-motion")) return;
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  if (a.width === 0 || b.width === 0) return;
  // 목표는 패널 '윗부분'(제목이 앉는 자리) — 패널 전체 높이로 늘리면 잔상이 거대해져 어색하다.
  const target = {
    left: b.left + 14,
    top: b.top + 14,
    width: Math.max(80, b.width - 28)
  };

  // 실물 복제 — 같은 스타일시트가 적용되므로 클래스·인라인 스타일이 그대로 살아 카드처럼 보인다.
  const wrap = document.createElement("div");
  wrap.className = "fly-ghost";
  wrap.style.left = `${a.left}px`;
  wrap.style.top = `${a.top}px`;
  wrap.style.width = `${a.width}px`;
  wrap.style.height = `${a.height}px`;
  wrap.style.borderRadius = getComputedStyle(fromEl).borderRadius;
  let clone: HTMLElement | null = null;
  try {
    clone = fromEl.cloneNode(true) as HTMLElement;
    clone.style.margin = "0";
    clone.style.width = "100%";
    clone.style.height = "100%";
    clone.style.boxSizing = "border-box";
    clone.removeAttribute("id");
    // 선택 링·삭제 ✕ 같은 편집 chrome은 잔상에서 제거 — 클릭 직후 카드가 '선택됨'으로
    // 다시 그려진 뒤 복제되므로, 벗겨내지 않으면 빨간 ✕가 함께 날아간다(실측).
    for (const cls of opts?.stripClasses ?? []) clone.classList.remove(cls);
    clone.querySelectorAll("button").forEach((btn) => btn.remove());
    wrap.appendChild(clone);
  } catch {
    // 복제 실패면 잔상 자체를 생략(장식) — 클릭 동작엔 영향 없음.
    return;
  }
  document.body.appendChild(wrap);

  const dx = target.left - a.left;
  const dy = target.top - a.top;
  const sx = target.width / a.width;
  let anim: Animation;
  try {
    // 1) 살짝 떠오름(잡힘) → 2) 감속 비행(도착점을 예고). 크기는 목표 폭에 맞춰 자연스럽게.
    anim = wrap.animate(
      [
        { transform: "none", boxShadow: "0 0 0 rgb(80 70 130 / 0%)" },
        {
          transform: "scale(1.03)",
          boxShadow: "0 10px 26px rgb(80 70 130 / 24%)",
          offset: 0.12
        },
        {
          transform: `translate(${dx}px, ${dy}px) scale(${sx}, 0.96)`,
          boxShadow: "0 2px 8px rgb(80 70 130 / 10%)"
        }
      ],
      { duration: 640, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)", fill: "forwards" }
    );
    // 페이드는 분리 — 이동 이징이 불투명도에 걸리면 초반부터 흐려져 눈에 안 띈다.
    // 여정 대부분은 또렷하게, 도착 구간에만 패널로 스며든다.
    wrap.animate([{ opacity: 1 }, { opacity: 0 }], {
      delay: 470,
      duration: 170,
      easing: "linear",
      fill: "forwards"
    });
  } catch {
    wrap.remove();
    return;
  }
  // 도착 순간 패널이 은은히 한 번 빛난다 — '이 카드를 받아 편집 중'이라는 응답.
  window.setTimeout(() => {
    try {
      const prevOutline = toEl.style.outline;
      const prevOffset = toEl.style.outlineOffset;
      toEl.style.outline = "2px solid transparent";
      toEl.style.outlineOffset = "3px";
      const glow = toEl.animate(
        [
          { outlineColor: "rgb(124 108 240 / 0%)" },
          { outlineColor: "rgb(124 108 240 / 45%)", offset: 0.3 },
          { outlineColor: "rgb(124 108 240 / 0%)" }
        ],
        { duration: 480, easing: "ease-out" }
      );
      const restore = () => {
        toEl.style.outline = prevOutline;
        toEl.style.outlineOffset = prevOffset;
      };
      glow.onfinish = restore;
      glow.oncancel = restore;
    } catch {
      /* 장식 — 실패 무시 */
    }
  }, 470);
  const cleanup = () => wrap.remove();
  anim.onfinish = cleanup;
  anim.oncancel = cleanup;
  // 안전망 — finish 이벤트가 유실돼도 잔상이 화면에 남지 않게.
  window.setTimeout(cleanup, 1000);
}

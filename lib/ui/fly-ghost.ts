"use client";

// 카드 → 편집 패널 '잔상 비행'(HCI 벤치마크 B2의 데스크톱 버전).
//
// 데스크톱 편집실의 편집 패널은 항상 같은 자리에 떠 있는 고정 폼이라, 카드가 패널로 통째로
// morph하면 오히려 편집 리듬을 방해한다. 대신 클릭한 카드의 잔상(테두리 유령)이 패널로
// 날아가 안착하며 사라진다 — '지금 이 카드를 편집 중'이라는 공간 연결감만 가볍게 준다.
// DOM에 1회성 요소를 만들어 WAAPI로 재생하고 끝나면 스스로 지운다(React 상태 없음).
export function flyGhost(fromEl: HTMLElement, toEl: HTMLElement) {
  if (typeof document === "undefined") return;
  if (document.documentElement.hasAttribute("data-reduce-motion")) return;
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  if (a.width === 0 || b.width === 0) return;
  // 목표는 패널 '윗부분'(제목이 앉는 자리) — 패널 전체 높이로 늘리면 유령이 거대해져 어색하다.
  const target = {
    left: b.left + 14,
    top: b.top + 14,
    width: Math.max(80, b.width - 28),
    height: a.height
  };
  const g = document.createElement("div");
  g.className = "fly-ghost";
  g.style.left = `${a.left}px`;
  g.style.top = `${a.top}px`;
  g.style.width = `${a.width}px`;
  g.style.height = `${a.height}px`;
  document.body.appendChild(g);
  const dx = target.left - a.left;
  const dy = target.top - a.top;
  const sx = target.width / a.width;
  let anim: Animation;
  // 이동과 페이드를 분리 — 한 애니메이션에 섞으면 감속 이징이 불투명도에도 걸려 초반부터
  // 흐려진다(0.38s 단일 버전이 "안 보인다"던 피드백의 원인). 여정 460ms는 또렷하게 날아가고,
  // 도착 구간 190ms에만 패널로 스며들며 사라진다.
  g.style.opacity = "0.95";
  try {
    anim = g.animate(
      [
        { transform: "none" },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, 1)` }
      ],
      {
        duration: 650,
        // 감속 곡선 — 목적지를 예고하며 안착(스프링 잔진동은 잔상엔 과함).
        easing: "cubic-bezier(0.05, 0.7, 0.1, 1)",
        fill: "forwards"
      }
    );
    g.animate([{ opacity: 0.95 }, { opacity: 0 }], {
      delay: 460,
      duration: 190,
      easing: "linear",
      fill: "forwards"
    });
  } catch {
    g.remove();
    return;
  }
  const cleanup = () => g.remove();
  anim.onfinish = cleanup;
  anim.oncancel = cleanup;
  // 안전망 — finish 이벤트가 유실돼도 유령이 화면에 남지 않게.
  window.setTimeout(cleanup, 1000);
}

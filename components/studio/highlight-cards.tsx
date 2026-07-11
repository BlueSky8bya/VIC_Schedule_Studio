"use client";

// 차트 스타일은 편집실·시청자 양쪽에서 공유한다(어느 화면에서 열든 같은 차트).
import "@/components/studio/insights-charts.css";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent
} from "react";

// 하이라이트 패널의 카드 4개(방문 최다일·최고 시간대·인기 컨텐츠·최다요일)를 한곳에서 그린다.
// 개발자/관리자 인사이트가 같은 모양을 각각 그리던 걸 합쳐 동작을 일치시킨다.
export type HighlightCard = {
  key: string;
  emoji: string;
  tone: string;
  label: [string, string];
  main: string;
  sub?: string;
  heart?: boolean;
};

type Tip = { key: string; x: number; top: number; text: string };

// 인기 컨텐츠처럼 제목이 길면 카드 안에서 …로 잘린다(특히 모바일). 잘렸을 때만 호버(웹)·탭(모바일)
// 으로 전체 제목을 그리드 위에 띄운다 — z-index로 다른 카드에 안 가리고, 그리드 폭 안으로 clamp해
// 양옆이 잘리지 않게.
export function HighlightCards({ cards }: { cards: HighlightCard[] }) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const hideTimer = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  // 제목이 실제로 잘렸을 때만 그 카드 위 가운데에 전체 제목을 띄운다(짧은 제목엔 안 뜸).
  const showFor = useCallback((card: HTMLElement, key: string, text: string) => {
    const grid = gridRef.current;
    const main = card.querySelector<HTMLElement>(".hl-main");
    if (!grid || !main) return;
    if (main.scrollWidth <= main.clientWidth + 1) {
      setTip(null);
      return;
    }
    const g = grid.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const x = ((c.left + c.width / 2 - g.left) / g.width) * 100;
    setTip({ key, x, top: c.top - g.top, text });
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  return (
    <div className="highlight-grid" ref={gridRef}>
      {cards.map((c) => (
        <div
          className="highlight-card"
          data-tone={c.tone}
          key={c.key}
          onPointerEnter={(e: PointerEvent<HTMLDivElement>) => {
            // 웹(마우스) — 호버 동안만 표시.
            if (e.pointerType === "mouse") {
              clearTimer();
              showFor(e.currentTarget, c.key, c.main);
            }
          }}
          onPointerLeave={(e: PointerEvent<HTMLDivElement>) => {
            if (e.pointerType === "mouse") setTip(null);
          }}
          onPointerUp={(e: PointerEvent<HTMLDivElement>) => {
            // 모바일(터치/펜) — 탭으로 토글(같은 카드 다시 탭하면 닫힘), 잠시 후 자동으로 사라짐.
            if (e.pointerType === "mouse") return;
            clearTimer();
            if (tip?.key === c.key) {
              setTip(null);
              return;
            }
            showFor(e.currentTarget, c.key, c.main);
            hideTimer.current = window.setTimeout(() => setTip(null), 2600);
          }}
        >
          <span className="hl-emoji" aria-hidden="true">
            {c.emoji}
          </span>
          <span className="hl-body">
            <span className="hl-label">
              {c.label[0]}
              <i className="hl-lbreak" aria-hidden="true" />
              {c.label[1]}
            </span>
            {c.main ? <strong className="hl-main">{c.main}</strong> : null}
          </span>
          {c.sub ? (
            <span className="hl-sub">
              {c.heart ? (
                <i className="hl-heart" aria-hidden="true">
                  ♥
                </i>
              ) : null}
              {c.sub}
            </span>
          ) : null}
        </div>
      ))}
      {tip ? (
        <span
          className="hl-tip"
          role="tooltip"
          style={{ "--tip-x": `${tip.x}%`, top: tip.top } as CSSProperties}
        >
          {tip.text}
        </span>
      ) : null}
    </div>
  );
}

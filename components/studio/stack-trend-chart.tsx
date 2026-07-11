"use client";

// 차트 스타일은 편집실·시청자 양쪽에서 공유한다(어느 화면에서 열든 같은 차트).
import "@/components/studio/insights-charts.css";

import { type PointerEvent as ReactPointerEvent, useState } from "react";
import { createPortal } from "react-dom";
import type { TrendStack } from "@/lib/insights/actions";

// 카테고리별(태그/역할/기기) 6개월 누적 막대 트렌드.
// 호버 분해 박스는 body로 포털 + position:fixed로 띄운다 → 차트가 모달 스크롤 안에 쌓여 있어도
// 위(고정 헤더/탭)에 가려지거나 다음 차트 뒤에 깔리지 않고, 화면에서 여유 있는 쪽(위/아래)으로
// 자동으로 뒤집혀 항상 온전히 보인다.
type Hover = {
  ym: string;
  total: number;
  counts: Record<string, number>;
  cx: number; // 막대의 화면 가로 중심(px)
  y: number; // 띄울 기준 y(px) — above면 막대 위, 아니면 막대 아래
  above: boolean;
};

export function StackTrendChart({
  data,
  title,
  showNumbers = true,
  showLegend = true,
  rankLabel = "비율 높은 순"
}: {
  data: TrendStack;
  title: string;
  showNumbers?: boolean;
  showLegend?: boolean;
  // 범례 없는(태그) 차트의 호버박스 제목 — 큰 값 순 정렬임을 알린다. 차트 의미에 맞게 바꾼다
  // (컨텐츠="비율 높은 순", 하트="인기 높은 순"). 총개수 숫자 대신 이걸 제목으로 쓴다.
  rankLabel?: string;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  const max = Math.max(1, ...data.months.map((m) => m.total));
  const empty = data.cats.length === 0 || data.months.every((m) => m.total === 0);
  // 범례를 숨긴 차트(태그 많음)는 호버 박스를 2열로 + 그 달 값이 큰 순으로 정렬해(왼쪽위→오른쪽아래)
  // 수치가 없어도 비율 높낮이를 한눈에. (방문 트렌드처럼 범례 있는 차트는 카테고리 순서 그대로.)
  const tipCats = (h: Hover) =>
    showLegend
      ? data.cats
      : [...data.cats].sort((a, b) => (h.counts[b.key] ?? 0) - (h.counts[a.key] ?? 0));

  return (
    <div className="trend-row">
      <div className="trend-head">
        <span>{title}</span>
      </div>
      {empty ? (
        <p className="insight-empty">집계할 데이터가 아직 없어요.</p>
      ) : (
        <>
          <div className="vt-chart" role="img" aria-label={title} onPointerLeave={() => setHover(null)}>
            {data.months.map((mo) => {
              const enter = (e: ReactPointerEvent<HTMLDivElement>) => {
                if (mo.total <= 0) {
                  setHover(null);
                  return;
                }
                const r = e.currentTarget.getBoundingClientRect();
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                // 위/아래 중 여유가 더 큰 쪽에 띄운다(잘림 방지). 가로는 화면 안으로 clamp.
                const above = r.top > vh - r.bottom;
                const cx = Math.min(Math.max(r.left + r.width / 2, 124), vw - 124);
                setHover({
                  ym: mo.ym,
                  total: mo.total,
                  counts: mo.counts,
                  cx,
                  y: above ? r.top - 8 : r.bottom + 8,
                  above
                });
              };
              return (
                <div
                  className="vt-col"
                  key={mo.ym}
                  onPointerEnter={enter}
                  onPointerMove={enter}
                  onPointerLeave={() => setHover(null)}
                >
                  <div className="vt-barwrap">
                    <div className="vt-bar" style={{ height: `${(mo.total / max) * 100}%` }}>
                      <div className="vt-fill">
                        {data.cats.map((c) => {
                          const n = mo.counts[c.key] ?? 0;
                          return n > 0 ? (
                            <span
                              className="vt-seg"
                              key={c.key}
                              style={{ flexGrow: n, background: c.color }}
                            />
                          ) : null;
                        })}
                      </div>
                    </div>
                  </div>
                  <span className="vt-day">{Number(mo.ym.slice(5, 7))}월</span>
                </div>
              );
            })}
          </div>
          {showLegend ? (
            <ul className="vt-legend">
              {data.cats.map((c) => (
                <li key={c.key}>
                  <span style={{ background: c.color }} />
                  {c.label}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
      {hover && hover.total > 0 && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`vt-tip vt-tip-float${showLegend ? "" : " vt-tip-grid"}`}
              style={{
                position: "fixed",
                left: hover.cx,
                top: hover.y,
                transform: `translateX(-50%)${hover.above ? " translateY(-100%)" : ""}`,
                zIndex: 9999
              }}
            >
              {/* 태그 차트(범례 없음)는 총개수 숫자 대신 '큰 값 순'임을 알리는 제목(화살표 없이).
                  역할/기기 차트(범례 있음)는 관리자에게 총합 숫자를 보여준다. */}
              {!showLegend ? (
                <strong className="vt-tip-note">{rankLabel}</strong>
              ) : showNumbers ? (
                <strong>{hover.total}</strong>
              ) : null}
              {(() => {
                const rows = tipCats(hover).filter((c) => (hover.counts[c.key] ?? 0) > 0);
                // 2열 박스는 '열 우선'으로 채운다 — 왼쪽 열 위→아래 먼저, 그 다음 오른쪽 열 위→아래.
                // (grid-auto-flow: column + 행 수 고정.) 1열 박스는 그대로 세로 나열.
                const colStyle = showLegend
                  ? undefined
                  : {
                      gridAutoFlow: "column" as const,
                      gridTemplateRows: `repeat(${Math.max(1, Math.ceil(rows.length / 2))}, auto)`
                    };
                return (
                  <div className="vt-tip-rows" style={colStyle}>
                    {rows.map((c, idx) => (
                      <span className="vt-tip-row" key={c.key}>
                        <i style={{ background: c.color }} />
                        {/* 태그 차트는 큰 값 순 등수를 앞에 — "1. 서버", "2. 종겜"처럼 한눈에. */}
                        {!showLegend ? `${idx + 1}. ${c.label}` : c.label}
                        {showNumbers ? <b>{hover.counts[c.key] ?? 0}</b> : null}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

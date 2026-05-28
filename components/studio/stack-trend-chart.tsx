"use client";

import { type CSSProperties, useState } from "react";
import type { TrendStack } from "@/lib/insights/actions";

// 카테고리별(태그/역할/기기) 6개월 누적 막대 트렌드. 방문 그래프와 같은 .vt-* 스타일·클램프 툴팁을
// 재사용한다. showNumbers=false면 막대 비율만 보여주고 수치는 숨긴다(비개발자 민감 지표용).
type Hover = { x: number; ym: string; total: number; counts: Record<string, number> };

export function StackTrendChart({
  data,
  title,
  showNumbers = true,
  showLegend = true
}: {
  data: TrendStack;
  title: string;
  showNumbers?: boolean;
  showLegend?: boolean;
}) {
  const [hover, setHover] = useState<Hover | null>(null);
  const max = Math.max(1, ...data.months.map((m) => m.total));
  const empty = data.cats.length === 0 || data.months.every((m) => m.total === 0);
  // 범례를 숨긴 차트(태그 많음)는 호버 툴팁을 2열로 + 그 달 값이 큰 순으로 정렬해(왼쪽위→오른쪽아래)
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
            {data.months.map((mo, i) => {
              const enter = () =>
                setHover({
                  x: ((i + 0.5) / data.months.length) * 100,
                  ym: mo.ym,
                  total: mo.total,
                  counts: mo.counts
                });
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
            {hover && hover.total > 0 ? (
              <div
                className={`vt-tip${showLegend ? "" : " vt-tip-grid"}`}
                style={{ "--tip-x": `${hover.x}%` } as CSSProperties}
              >
                {showNumbers ? (
                  <strong>{hover.total}</strong>
                ) : !showLegend ? (
                  <strong className="vt-tip-note">비율 높은 순 ↓</strong>
                ) : null}
                <div className="vt-tip-rows">
                  {tipCats(hover).map((c) => {
                    const n = hover.counts[c.key] ?? 0;
                    return n > 0 ? (
                      <span className="vt-tip-row" key={c.key}>
                        <i style={{ background: c.color }} />
                        {c.label}
                        {showNumbers ? <b>{n}</b> : null}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            ) : null}
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
    </div>
  );
}

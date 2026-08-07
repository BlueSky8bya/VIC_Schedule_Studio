"use client";

import { monthProgress, trendDelta } from "@/lib/insights/month-progress";

// 추이 배지 한 벌 — 6개월 추이를 쓰는 모든 카드(방문·하트·콘텐츠·형식·방송시간)가 같이 쓴다.
// 진행 중인 달이면 ① '진행 중 7/31일' 칩을 붙이고 ② 배지는 지난달 '같은 페이스' 환산치와
// 비교한 값(≈)이다. 예전엔 8월 7일치를 7월 전체와 그대로 비교해 매달 초마다 ▼70%가 떴다.
export function TrendDeltaBadge({
  cur,
  prev,
  ym,
  fmt = (n: number) => n.toLocaleString()
}: {
  cur: number;
  prev: number;
  ym: string; // 마지막 칸의 달(YYYY-MM) — 이게 이번 달이면 진행 중이다
  fmt?: (n: number) => string;
}) {
  const prog = monthProgress(ym);
  const d = trendDelta(cur, prev, prog);
  const paceTitle = d.pace
    ? `지난달 전체 ${fmt(prev)} · 이 시점까지의 페이스로 환산하면 ${fmt(
        Math.round(d.base * 10) / 10
      )} — 그것과 비교한 값이에요.`
    : `지난달 ${fmt(prev)}와 비교`;
  return (
    <>
      {d.pct === null ? (
        <em className="trend-new">신규</em>
      ) : d.pct === 0 ? (
        // 동률이면 방향색(빨강/파랑) 대신 중립 대시로 — "변화 없음".
        <em className="insight-trend flat" title={paceTitle}>
          —
        </em>
      ) : (
        <em
          className={`insight-trend ${d.pct > 0 ? "up" : "down"}${d.pace ? " pace" : ""}`}
          title={paceTitle}
        >
          {d.pace ? "≈" : ""}
          {d.pct > 0 ? "▲" : "▼"}
          {Math.abs(d.pct)}%
        </em>
      )}
      {prog ? (
        <em
          className="trend-partial"
          title={`이번 달은 아직 끝나지 않았어요 — ${prog.elapsedDays}일까지의 값입니다.`}
        >
          진행 중 {prog.elapsedDays}/{prog.totalDays}일
        </em>
      ) : null}
    </>
  );
}

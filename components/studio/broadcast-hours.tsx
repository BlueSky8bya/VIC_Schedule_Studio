"use client";

import { useRef, useState } from "react";

// 방송시간(시간, 소수) → "32시간 30분" 표기. 0이면 "0분".
export function fmtHoursLabel(h: number): string {
  const totalMin = Math.round(h * 60);
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  if (hh === 0) return `${mm}분`;
  if (mm === 0) return `${hh}시간`;
  return `${hh}시간 ${mm}분`;
}

// "📺 방송 시간" — 월별 6개월 막대 + 이 달 일별 막대 + 요약(총/방송일수/일평균).
// 개발자 인사이트와 멤버 인사이트(관리자·매니저·작업자)가 함께 쓴다.
// 일별 막대는 값 툴팁을 '호버(데스크톱) + 탭(모바일)' 둘 다로 띄운다 — 모바일은 호버가 없어
// 탭하면 잠깐 뜨고, 한 개만 떠서 활성 막대 위에 clamp되어(양 끝 포함) 안 잘린다.
export function BroadcastHours({
  months,
  broadcastHours,
  broadcastDaily,
  broadcastDays
}: {
  months: string[]; // 6개월(YYYY-MM, 오래된→최신)
  broadcastHours: number[];
  broadcastDaily: number[];
  broadcastDays: number;
}) {
  const monthVals = broadcastHours;
  const cur = monthVals[monthVals.length - 1] ?? 0;
  const prev = monthVals[monthVals.length - 2] ?? 0;
  const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  const monthMax = Math.max(0.1, ...monthVals);
  const daily = broadcastDaily;
  const dayMax = Math.max(0.1, ...daily);
  const days = broadcastDays;
  const avg = days > 0 ? cur / days : 0;
  const hasAny = monthVals.some((v) => v > 0);
  // 연도가 바뀌는 첫 칸에만 "YY년" 표기(막대 바닥선이 어긋나지 않게 x라벨 높이는 CSS로 고정).
  const xLabels = months.map((mk, i) => {
    const [yy, mm] = mk.split("-").map(Number);
    const prevYy = i > 0 ? Number(months[i - 1].split("-")[0]) : null;
    return { showYear: i === 0 || yy !== prevYy, yy: yy % 100, mm };
  });

  const [active, setActive] = useState<number | null>(null);
  const clearTimer = useRef<number | null>(null);
  const showDay = (i: number, touch: boolean) => {
    if (clearTimer.current) window.clearTimeout(clearTimer.current);
    setActive(i);
    // 모바일(탭)은 호버-아웃이 없으니 잠깐 보여주고 자동으로 지운다.
    if (touch) clearTimer.current = window.setTimeout(() => setActive(null), 2200);
  };

  return (
    <div className="bcast-trend">
      <div className="trend-row">
        <div className="trend-head">
          <span>📺 방송 시간</span>
          <strong>{fmtHoursLabel(cur)}</strong>
          {delta === null ? (
            <em className="trend-new">신규</em>
          ) : delta === 0 ? (
            <em className="insight-trend flat">—</em>
          ) : (
            <em className={`insight-trend ${delta > 0 ? "up" : "down"}`}>
              {delta > 0 ? "▲" : "▼"}
              {Math.abs(delta)}%
            </em>
          )}
        </div>
        <div className="trend-spark">
          {monthVals.map((v, i) => (
            <div className="trend-bcol" key={i}>
              <div className="trend-bwrap">
                <div
                  className={`trend-bar ${i === monthVals.length - 1 ? "cur" : ""}`}
                  data-v={fmtHoursLabel(v)}
                  style={{ height: `${(v / monthMax) * 100}%` }}
                />
              </div>
              <span className="trend-x">
                {xLabels[i]?.showYear ? <em>{xLabels[i].yy}년</em> : null}
                {xLabels[i]?.mm}월
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="bcast-chips">
        <span>
          이 달 방송 <strong>{days}</strong>일
        </span>
        <span>
          일평균 <strong>{fmtHoursLabel(avg)}</strong>
        </span>
      </div>
      {/* 일별 막대는 빈 달이어도 항상 보여준다(어디에 쌓일지 미리 보이게 — 월별과 대칭). */}
      <div
        className="bcast-daily"
        aria-label="이 달 일별 방송 시간"
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setActive(null);
        }}
      >
        {active != null ? (
          <div
            className="bcast-tip"
            style={{
              left: `clamp(32px, ${((active + 0.5) / Math.max(1, daily.length)) * 100}%, calc(100% - 32px))`
            }}
          >
            {active + 1}일 · {fmtHoursLabel(daily[active] ?? 0)}
          </div>
        ) : null}
        {daily.map((v, i) => (
          <div
            className="bcast-dcol"
            key={i}
            aria-label={`${i + 1}일 ${fmtHoursLabel(v)}`}
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") showDay(i, false);
            }}
            onPointerDown={(e) => showDay(i, e.pointerType !== "mouse")}
          >
            <div className="bcast-dwrap">
              <div
                className="bcast-dbar"
                data-on={v > 0 ? "" : undefined}
                data-active={active === i ? "" : undefined}
                style={{ height: `${Math.max(v > 0 ? 6 : 0, (v / dayMax) * 100)}%` }}
              />
            </div>
            {(i + 1) % 5 === 0 || i === 0 ? (
              <span className="bcast-dx">{i + 1}</span>
            ) : (
              <span className="bcast-dx" />
            )}
          </div>
        ))}
      </div>
      {!hasAny ? (
        <p className="insight-note bcast-empty">
          아직 방송 기록이 없어요 — 방송을 켜면 여기 막대가 채워져요(1분마다 자동 기록).
        </p>
      ) : null}
    </div>
  );
}

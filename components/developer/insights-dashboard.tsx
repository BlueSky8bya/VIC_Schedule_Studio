"use client";

import { tagColor } from "@/lib/tags/dark-palette";

import { CalendarDays, ChevronLeft, ChevronRight, Heart, LineChart } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { BroadcastHours } from "@/components/studio/broadcast-hours";
import { StackTrendChart } from "@/components/studio/stack-trend-chart";
import { TrendDeltaBadge } from "@/components/studio/trend-delta-badge";
import {
  getInsightsAction,
  getTrendAction,
  type InsightsData,
  type TrendData
} from "@/lib/insights/actions";
import type { ArchivePayload } from "@/lib/insights/archive";
import { monthProgress } from "@/lib/insights/month-progress";
import {
  HEART_BLAZE_MIN,
  HEART_BLAZE_RATIO,
  HEART_CROWN,
  HEART_HOT_MIN,
  HEART_HOT_RATIO,
  HEART_MIN
} from "@/lib/schedules/heart-tiers";
import { hapticTick } from "@/lib/ui/haptics";
import { InsightsTabs, insightTabStep } from "@/components/shared/insights-tabs";
import { LoadError, LoadingState } from "@/components/shared/loading-state";

// 보고 있는 달 기준의 "월별 인사이트"(개발자 전용) — 트렌드·일정·참여 세 칸.
// 실시간(동접)·방문 칸은 2026-11-13 방문 기록 철수와 함께 뺐다(이용 기록은 개발자 본인의 행동만 남는다).
// 기기 표기·시각 헬퍼는 이용 기록(activity-timeline)도 쓴다 → 단일 출처.
export const DEVICE_META: { key: string; label: string; color: string }[] = [
  { key: "desktop", label: "웹", color: "#6b8cef" },
  { key: "android", label: "안드로이드", color: "#3ddc84" },
  { key: "ios", label: "iOS", color: "#a1a1aa" },
  { key: "mobile", label: "기타", color: "#f59e0b" }
];
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

// 트렌드가 첫 탭 = 기본 화면(2026-08-31 사용자 지시 — 열자마자 흐름부터). 아래 트랙 섹션 순서도
// 이와 일치해야 한다(CSS가 data-active=n ↔ nth-child로 짝을 맞춘다 — 여기만 바꾸면 안 된다).
// (보안·시스템은 2026-11-13 설정 창으로 옮겼다. 실시간·방문은 같은 날 철수.)
const PANELS = [
  { key: "trend", label: "트렌드", icon: LineChart },
  { key: "content", label: "일정", icon: CalendarDays },
  { key: "engagement", label: "참여", icon: Heart }
] as const;
function weekdayLabel(wd: number | null): string {
  return wd !== null ? `${WEEKDAY[wd]}요일` : "—";
}
function fmtMonthDay(dateKey: string): string {
  const [yy, mm, dd] = dateKey.split("-").map(Number);
  const wd = WEEKDAY[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()] ?? "";
  return `${mm}/${dd}(${wd})`;
}

function StatTile({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  const isText = typeof value !== "number";
  return (
    <div className="insight-tile" data-tone={tone} data-text={isText ? "" : undefined}>
      <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
      <span>{label}</span>
    </div>
  );
}

// epoch ms → KST(=UTC+9)로 옮긴 Date(이후 getUTC*가 곧 KST 값). "HH:MM" 표기에 쓴다. (이용 기록과 공유)
const kstOf = (ms: number) => new Date(ms + 9 * 3600 * 1000);
export const hhmm = (ms: number) => {
  const d = kstOf(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
// 머문 시간 표기 — 60초 미만은 '초', 그 이상은 '분'. (이용 기록과 공유)
export const fmtDur = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s}초` : `${Math.round(s / 60)}분`;
};
export const deviceLabel = (key: string) =>
  DEVICE_META.find((m) => m.key === key)?.label ?? key;

// archived: 연간 아카이브(0160)의 숫자로 같은 화면을 다시 그린다 — 서버를 부르지 않는다.
export function InsightsDashboard({
  year,
  month,
  archived
}: {
  year: number;
  month: number;
  archived?: ArchivePayload;
}) {
  const [index, setIndex] = useState(0);
  // 탭·트랙·점·키보드가 모두 이 목록 하나를 따른다(라이브·아카이브 같은 세 칸).
  const panels = PANELS;
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  const [retry, setRetry] = useState(0); // 실패 뒤 '다시 시도' — 같은 요청을 처음처럼 다시 보낸다

  useEffect(() => {
    if (archived) {
      setData(archived.insights);
      setError(archived.insights ? null : "이 달 인사이트가 아카이브에 없어요.");
      setLoading(false);
      setTrend(archived.trend);
      setTrendLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setError(null);
    setTrendLoading(true);
    getInsightsAction(year, month)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setData(r.data);
        else setError(r.error);
      })
      .catch(() => {
        if (alive) setError("인사이트를 불러오지 못했어요. 잠시 후 다시 열어 주세요.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    getTrendAction(year, month)
      .then((r) => {
        if (alive && r.ok) setTrend(r.data);
      })
      .catch(() => { /* A failed request is not a zero-activity result. */ })
      .finally(() => {
        if (alive) setTrendLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [year, month, archived, retry]);

  const go = (i: number) => setIndex(Math.max(0, Math.min(panels.length - 1, i)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      // Follow the same actual row layout as the shared tab control.
      const LEN = panels.length;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => Math.min(LEN - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => insightTabStep(i, "ArrowUp", LEN));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => insightTabStep(i, "ArrowDown", LEN));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panels]);

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onSwipeStart = (e: ReactPointerEvent) => {
    // 터치만 스와이프로 — 웹에서 마우스로 텍스트를 긁으면(드래그) 패널이 휙 넘어가던 문제 차단.
    if (e.pointerType !== "touch") {
      swipeStart.current = null;
      return;
    }
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };
  const onSwipeEnd = (e: ReactPointerEvent) => {
    if (e.pointerType !== "touch") return;
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const LEN = panels.length;
    // 가로 스와이프만 패널 전환(±1). 세로는 패널 내용 스크롤과 겹쳐서 쓰지 않는다(웹은 방향키로 격자 이동).
    if (ax > 45 && ax > ay * 1.3) {
      const next = Math.max(0, Math.min(LEN - 1, index + (dx < 0 ? 1 : -1)));
      if (next !== index) {
        hapticTick(); // 스와이프로 패널이 실제로 바뀔 때만 톡(경계에서 헛스와이프는 무음)
        setIndex(next);
      }
    }
  };

  function withData(render: (d: InsightsData) => React.ReactNode) {
    if (loading) {
      return (
        <LoadingState label="인사이트 불러오는 중…">
          <div className="insight-skel">
            <span />
            <span />
            <span />
          </div>
        </LoadingState>
      );
    }
    if (error || !data) {
      return (
        <LoadError
          act="insight-retry"
          message={error ?? "불러오지 못했어요."}
          onRetry={archived ? undefined : () => setRetry((n) => n + 1)}
        />
      );
    }
    return render(data);
  }

  const tagMax = Math.max(1, ...(data?.content.tags.map((t) => t.count) ?? [1]));
  const heartMax = Math.max(1, ...(data?.engagement.topEvents.map((t) => t.count) ?? [1]));

  function renderTrend() {
    if (trendLoading || loading) {
      return (
        <LoadingState label="추이 불러오는 중…">
          <div className="insight-skel">
            <span />
            <span />
            <span />
          </div>
        </LoadingState>
      );
    }
    if (!trend || !data) {
      return (
        <LoadError
          act="insight-retry"
          message="추이를 불러오지 못했어요."
          onRetry={archived ? undefined : () => setRetry((n) => n + 1)}
        />
      );
    }
    const series = [
      { key: "content", label: "🗓️ 컨텐츠", values: trend.content },
      { key: "hearts", label: "💗 하트", values: data.engagement.monthly.map((x) => x.count) }
    ];
    // x축 라벨: 첫 칸과 연도가 바뀌는 칸엔 "YY년"을 윗줄에 작게(예: 26년 1월), 나머진 "M월".
    const xLabels = trend.months.map((mk, i) => {
      const [yy, mm] = mk.split("-").map(Number);
      const prevYy = i > 0 ? Number(trend.months[i - 1].split("-")[0]) : null;
      return { showYear: i === 0 || yy !== prevYy, yy: yy % 100, mm };
    });
    // 마지막 칸의 달 — 이게 이번 달이면 아직 진행 중이다(배지·막대 표시가 달라진다).
    const lastYm = trend.months[trend.months.length - 1] ?? "";
    const partial = monthProgress(lastYm);
    return (
      <>
        <p className="insight-note">
          최근 6개월 추이 · 배지는 지난달 대비 변화
          {partial ? " (이번 달은 진행 중이라 지난달 같은 페이스와 비교)" : ""}
        </p>
        <BroadcastHours
          months={trend.months}
          broadcastHours={trend.broadcastHours}
          broadcastDaily={trend.broadcastDaily}
          broadcastDays={trend.broadcastDays}
        />
        {series.map((s) => {
          const cur = s.values[s.values.length - 1] ?? 0;
          const prev = s.values[s.values.length - 2] ?? 0;
          const max = Math.max(1, ...s.values);
          return (
            <div className="trend-row" key={s.key}>
              <div className="trend-head">
                <span>{s.label}</span>
                <strong>{cur.toLocaleString()}</strong>
                <TrendDeltaBadge cur={cur} prev={prev} ym={lastYm} />
              </div>
              <div className="trend-spark">
                {s.values.map((v, i) => (
                  <div className="trend-bcol" key={i}>
                    <div className="trend-bwrap">
                      {/* 진행 중인 달은 빗금 — 옆 칸(완료된 달)과 같은 자격으로 읽히면 안 된다. */}
                      <div
                        className={`trend-bar ${i === s.values.length - 1 ? "cur" : ""}${
                          partial && i === s.values.length - 1 ? " partial" : ""
                        }`}
                        data-v={`${v}`}
                        style={{ height: `${(v / max) * 100}%` }}
                      />
                    </div>
                    <span className="trend-x">
                      {xLabels[i].showYear ? <em>{xLabels[i].yy}년</em> : null}
                      {xLabels[i].mm}월
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <StackTrendChart data={trend.contentByTag} showLegend={false} title="🗓️ 콘텐츠별" />
        <StackTrendChart data={trend.modifierByTag} showLegend={false} title="🎛️ 형식별" />
        <StackTrendChart
          data={trend.heartsByTag}
          rankLabel="일정당 평균 하트 순"
          showLegend={false}
          title="💗 하트 받은 태그"
        />
      </>
    );
  }

  return (
    <div className="insights" data-archived={archived ? "" : undefined}>
      <div className="insights-head">
        <p className="insights-month">{archived ? `${year}년 ${month}월 인사이트` : `${month}월 인사이트`}</p>
      </div>
      <InsightsTabs active={index} onChange={go} tabs={panels} />

      <div
        className="insights-viewport"
        onPointerCancel={() => (swipeStart.current = null)}
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
      >
        <div
          className="insights-track"
          data-active={index}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {/* 1) 트렌드(최근 6개월) — 기본 화면(첫 탭) */}
          <section className="insights-panel">{renderTrend()}</section>

          {/* 2) 일정·콘텐츠(이 달) — 공유 4패널 윗줄 */}
          <section className="insights-panel">
            {withData((d) => {
              const trend = d.content.thisMonthContent - d.content.lastMonthContent;
              return (
                <>
                  <div className="insight-next">
                    <span>다음 방송</span>
                    {d.content.nextBroadcast ? (
                      <div className="insight-next-body">
                        <strong>{fmtMonthDay(d.content.nextBroadcast.dateKey)}</strong>
                        <div className="insight-chips">
                          {d.content.nextBroadcast.titles.map((t, i) => (
                            <span className="insight-chip" key={`${t}-${i}`}>
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <strong className="muted">예정된 방송 없음</strong>
                    )}
                  </div>
                  <div className="insight-grid">
                    <div className="insight-tile" data-tone="public">
                      <strong>
                        {d.content.thisMonthContent}
                        {trend !== 0 ? (
                          <em className={`insight-trend ${trend > 0 ? "up" : "down"}`}>
                            {trend > 0 ? "▲" : "▼"}
                            {Math.abs(trend)}
                          </em>
                        ) : null}
                      </strong>
                      <span>이번 달 컨텐츠</span>
                    </div>
                    <StatTile value={d.content.daysWithContent} label="컨텐츠 있는 날" />
                    <StatTile value={d.content.restDays} label="휴뱅 날" />
                    <StatTile value={weekdayLabel(d.content.busiestWeekday)} label="바쁜 요일" />
                    <StatTile value={weekdayLabel(d.content.quietestWeekday)} label="한가한 요일" />
                  </div>
                  <h4 className="insight-subhead">이번 달 컨텐츠 순위</h4>
                  {d.content.tags.length === 0 ? (
                    <p className="insight-empty">집계할 컨텐츠가 아직 없어요.</p>
                  ) : (
                    <ul className="insight-bars">
                      {d.content.tags.map((t) => (
                        <li key={t.name}>
                          <span className="insight-bar-label">{t.name}</span>
                          <span className="insight-bar-track">
                            <span
                              className="insight-bar-fill"
                              style={{
                                width: `${Math.round((t.count / tagMax) * 100)}%`,
                                background: tagColor(t.bgColor),
                                borderColor: tagColor(t.bgColor, "borderColor", undefined, t.borderColor)
                              }}
                            />
                          </span>
                          <span className="insight-bar-count">{t.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              );
            })}
          </section>

          {/* 3) 참여·인기(이 달) */}
          <section className="insights-panel">
            {withData((d) => {
              const monMax = Math.max(1, ...d.engagement.monthly.map((x) => x.count));
              return (
                <>
                  <div className="insight-grid">
                    <StatTile value={d.engagement.monthHearts} label={`${month}월 하트`} tone="heart" />
                    <StatTile value={d.engagement.totalHearts} label="누적 하트" tone="heart" />
                  </div>
                  <h4 className="insight-subhead">월별 하트 (최근 6개월)</h4>
                  <div className="vt-chart" role="img" aria-label="월별 하트 그래프">
                    {d.engagement.monthly.map((mo) => (
                      <div className="vt-col" key={mo.ym}>
                        <div className="vt-barwrap">
                          <div
                            className="vt-bar heart"
                            data-v={`♥ ${mo.count}`}
                            style={{ height: `${(mo.count / monMax) * 100}%` }}
                          />
                        </div>
                        <span className="vt-day">{Number(mo.ym.slice(5, 7))}월</span>
                      </div>
                    ))}
                  </div>
                  <h4 className="insight-subhead">이번 달 인기 컨텐츠 TOP</h4>
                  {d.engagement.topEvents.length === 0 ? (
                    <p className="insight-empty">이 달엔 하트를 받은 일정이 없어요.</p>
                  ) : (
                    <ul className="insight-bars titles">
                      {d.engagement.topEvents.map((e, i) => (
                        <li key={`${e.title}-${i}`}>
                          <span className="insight-bar-label" title={e.title}>
                            {i + 1}. {e.title}
                          </span>
                          <span className="insight-bar-track">
                            <span
                              className="insight-bar-fill heart"
                              style={{ width: `${Math.round((e.count / heartMax) * 100)}%` }}
                            />
                          </span>
                          <span className="insight-bar-count">♥ {e.count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* 관심 단계 기준 — 시청자 포스터의 테두리 링·👑을 어떻게 받는지(기준은
                      lib/schedules/heart-tiers 단일 출처라 포스터와 항상 일치). 2026-08-27부터
                      '이 달 최다 대비 비율 + 절대 하한'. */}
                  <h4 className="insight-subhead">관심 단계 받는 기준</h4>
                  <ul className="badge-criteria">
                    <li>
                      <span className="bc-flame" style={{ color: "#f59e0b" }}>●</span>
                      <div className="bc-body">
                        <b>관심</b>
                        <em>하트 {HEART_MIN}개 이상</em>
                      </div>
                    </li>
                    <li>
                      <span className="bc-flame" style={{ color: "#f97316" }}>●</span>
                      <div className="bc-body">
                        <b>높은 관심</b>
                        <em>
                          이 달 최다의 {Math.round(HEART_HOT_RATIO * 100)}% 이상 · 최소 {HEART_HOT_MIN}개
                        </em>
                      </div>
                    </li>
                    <li>
                      <span className="bc-flame" style={{ color: "#dc2626" }}>●</span>
                      <div className="bc-body">
                        <b>폭발적 관심</b>
                        <em>
                          이 달 최다의 {Math.round(HEART_BLAZE_RATIO * 100)}% 이상 · 최소 {HEART_BLAZE_MIN}개
                        </em>
                      </div>
                    </li>
                    <li>
                      <span className="bc-flame">👑</span>
                      <div className="bc-body">
                        <b>최고 인기(이 달 1위)</b>
                        <em>이 달 최다(공동 포함) · 하트 {HEART_CROWN}개 이상</em>
                      </div>
                    </li>
                  </ul>
                  <p className="insight-note">
                    하트 {HEART_MIN}개 미만은 단계 없음. 시청자에겐 숫자 없이 테두리 링·👑·상세 배지로만
                    보입니다. 비율 기준이라 다른 일정에 하트가 쌓여 이 달 최다가 오르면 단계가 내려갈 수
                    있습니다(이 달의 상대 인기).
                  </p>
                </>
              );
            })}
          </section>
        </div>
      </div>

      <div className="insights-nav">
        <button
          aria-label="이전"
          className="insights-arrow"
          disabled={index === 0}
          onClick={() => go(index - 1)}
          type="button"
         data-act="insights-panel-prev">
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <div className="insights-dots" aria-hidden="true">
          {panels.map((p, i) => (
            <span className={i === index ? "on" : ""} key={p.key} />
          ))}
        </div>
        <button
          aria-label="다음"
          className="insights-arrow"
          disabled={index === panels.length - 1}
          onClick={() => go(index + 1)}
          type="button"
         data-act="insights-panel-next">
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  );
}

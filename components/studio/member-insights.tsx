"use client";

import { tagColor } from "@/lib/tags/dark-palette";

import "@/components/studio/insights-charts.css";

import { CalendarDays, ChevronLeft, ChevronRight, Heart, LineChart } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import { getMemberInsightsAction, type MemberInsightsData } from "@/lib/insights/actions";
import { BroadcastHours } from "@/components/studio/broadcast-hours";
import { StackTrendChart } from "@/components/studio/stack-trend-chart";
import { TrendDeltaBadge } from "@/components/studio/trend-delta-badge";
import { monthProgress } from "@/lib/insights/month-progress";
import { hapticTick } from "@/lib/ui/haptics";
import { LoadError, LoadingState } from "@/components/shared/loading-state";
import { InsightsTabs } from "@/components/shared/insights-tabs";

// 관리자·매니저용 월별 인사이트 — 수치 없는 3패널(트렌드·일정·참여).
// 데이터는 getMemberInsightsAction이 이미 수치를 빼고(보안/시스템/방문 원시값 없음, 막대는 0~1 비율)
// 내려주므로 여기선 그대로 그린다. 허용된 하트 합계(이 달/누적)만 숫자로 보인다.
// 트렌드가 첫 탭 = 기본 화면 — 개발자판(insights-dashboard)과 같은 순서(2026-08-31 사용자 지시).
const PANELS = [
  { key: "trend", label: "트렌드", icon: LineChart },
  { key: "content", label: "일정", icon: CalendarDays },
  { key: "engagement", label: "참여", icon: Heart }
] as const;

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
function weekdayLabel(wd: number | null): string {
  return wd !== null ? `${WEEKDAY[wd]}요일` : "—";
}
function fmtMonthDay(dateKey: string): string {
  const [yy, mm, dd] = dateKey.split("-").map(Number);
  const wd = WEEKDAY[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()] ?? "";
  return `${mm}/${dd}(${wd})`;
}

// (보안 탭은 2026-11-13 설정 창 '보안' 묶음으로 옮겼다 — components/studio/security-panel.)
export function MemberInsights({ year, month }: { year: number; month: number }) {
  const [index, setIndex] = useState(0);
  const [data, setData] = useState<MemberInsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0); // 실패 뒤 '다시 시도'

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getMemberInsightsAction(year, month)
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
    return () => {
      alive = false;
    };
  }, [year, month, retry]);

  // 실제 패널 목록. 키보드/스와이프 경계도 이 길이를 쓴다.
  const panels = PANELS;
  const lastIndexRef = useRef(0); // 키보드 핸들러(고정 등록)가 호출 시점의 최신 경계를 읽도록.
  lastIndexRef.current = panels.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => Math.min(lastIndexRef.current, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onSwipeEnd = (e: ReactPointerEvent) => {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      const next = Math.max(0, Math.min(panels.length - 1, index + (dx < 0 ? 1 : -1)));
      if (next !== index) {
        hapticTick(); // 스와이프로 패널이 실제로 바뀔 때만 톡(경계에서 헛스와이프는 무음)
        setIndex(next);
      }
    }
  };

  function withData(render: (d: MemberInsightsData) => ReactNode) {
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
      return <LoadError act="insight-retry" message={error ?? "불러오지 못했어요."} onRetry={() => setRetry((n) => n + 1)} />;
    }
    return render(data);
  }

  function renderContent(d: MemberInsightsData) {
    const contentTrend = d.content.thisMonthContent - d.content.lastMonthContent;
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
              {/* 배지의 근거를 적어둔다 — 숫자만 있으면 무엇과 비교한 값인지 알 수 없다. */}
              {contentTrend !== 0 ? (
                <em
                  className={`insight-trend ${contentTrend > 0 ? "up" : "down"}`}
                  title={`지난달 ${d.content.lastMonthContent}건과 비교`}
                >
                  {contentTrend > 0 ? "▲" : "▼"}
                  {Math.abs(contentTrend)}
                </em>
              ) : null}
            </strong>
            <span>이번 달 컨텐츠</span>
          </div>
          <div className="insight-tile">
            <strong>{d.content.daysWithContent}</strong>
            <span>컨텐츠 있는 날</span>
          </div>
          <div className="insight-tile">
            <strong>{d.content.restDays}</strong>
            <span>휴뱅 날</span>
          </div>
          <div className="insight-tile" data-text="">
            <strong>{weekdayLabel(d.content.busiestWeekday)}</strong>
            <span>바쁜 요일</span>
          </div>
          <div className="insight-tile" data-text="">
            <strong>{weekdayLabel(d.content.quietestWeekday)}</strong>
            <span>한가한 요일</span>
          </div>
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
                      width: `${Math.round(t.ratio * 100)}%`,
                      background: tagColor(t.bgColor),
                      borderColor: tagColor(t.bgColor, "borderColor", undefined, t.borderColor)
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  function renderEngagement(d: MemberInsightsData) {
    return (
      <>
        <div className="insight-grid">
          <div className="insight-tile" data-tone="heart">
            <strong>{d.engagement.monthHearts.toLocaleString()}</strong>
            <span>{month}월 하트</span>
          </div>
          <div className="insight-tile" data-tone="heart">
            <strong>{d.engagement.totalHearts.toLocaleString()}</strong>
            <span>누적 하트</span>
          </div>
        </div>
        <h4 className="insight-subhead">월별 하트 (최근 6개월)</h4>
        <div className="vt-chart" role="img" aria-label="월별 하트 그래프">
          {(() => {
            const monMax = Math.max(1, ...d.engagement.monthly.map((m) => m.count));
            return d.engagement.monthly.map((mo) => (
              <div className="vt-col" key={mo.ym}>
                <div className="vt-barwrap">
                  <div
                    className="vt-bar heart"
                    data-v={`♥ ${mo.count}`}
                    style={{ height: `${Math.round((mo.count / monMax) * 100)}%` }}
                  />
                </div>
                <span className="vt-day">{Number(mo.ym.slice(5, 7))}월</span>
              </div>
            ));
          })()}
        </div>
        <h4 className="insight-subhead">이번 달 인기 컨텐츠 TOP</h4>
        {d.engagement.topTitles.length === 0 ? (
          <p className="insight-empty">이 달엔 하트를 받은 일정이 없어요.</p>
        ) : (
          <ul className="insight-rows">
            {d.engagement.topTitles.map((t, i) => (
              <li key={`${t}-${i}`}>
                <span>
                  {i + 1}. {t}
                </span>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  function renderTrend(d: MemberInsightsData) {
    const xLabels = d.trend.months.map((mk, i) => {
      const [yy, mm] = mk.split("-").map(Number);
      const prevYy = i > 0 ? Number(d.trend.months[i - 1].split("-")[0]) : null;
      return { showYear: i === 0 || yy !== prevYy, yy: yy % 100, mm };
    });
    const series = [
      { key: "content", label: "🗓️ 컨텐츠", values: d.trend.content },
      { key: "hearts", label: "💗 하트", values: d.trend.hearts }
    ];
    // 마지막 칸이 이번 달이면 아직 진행 중 — 배지 기준과 막대 표시가 달라진다.
    const lastYm = d.trend.months[d.trend.months.length - 1] ?? "";
    const partial = monthProgress(lastYm);
    return (
      <>
        <p className="insight-note">
          최근 6개월 추이 · 배지는 지난달 대비 변화
          {partial ? " (이번 달은 진행 중이라 지난달 같은 페이스와 비교)" : ""}
        </p>
        <BroadcastHours
          months={d.trend.months}
          broadcastHours={d.trend.broadcastHours}
          broadcastDaily={d.trend.broadcastDaily}
          broadcastDays={d.trend.broadcastDays}
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
                      {/* 진행 중인 달은 빗금 — 끝난 달과 같은 자격으로 읽히면 안 된다. */}
                      <div
                        className={`trend-bar ${i === s.values.length - 1 ? "cur" : ""}${
                          partial && i === s.values.length - 1 ? " partial" : ""
                        }`}
                        data-v={`${v}`}
                        style={{ height: `${Math.max(4, Math.round((v / max) * 100))}%` }}
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
        <StackTrendChart data={d.trend.contentByTag} showLegend={false} title="🗓️ 콘텐츠별" />
        <StackTrendChart data={d.trend.modifierByTag} showLegend={false} title="🎛️ 형식별" />
        <StackTrendChart
          data={d.trend.heartsByTag}
          rankLabel="일정당 평균 하트 순"
          showLegend={false}
          showNumbers={false}
          title="💗 하트 받은 태그"
        />
      </>
    );
  }

  // 인덱스 평행 배열이 아니라 key로 짝을 맞춘다 — 탭 순서를 바꿀 때 렌더러가 따라오지 않아
  // 엉뚱한 패널이 그려지는 사고를 구조적으로 막는다.
  const renderers: Record<string, (d: MemberInsightsData) => ReactNode> = {
    content: renderContent,
    engagement: renderEngagement,
    trend: renderTrend
  };

  return (
    <div className="insights">
      <p className="insights-month">{month}월 인사이트</p>
      <InsightsTabs active={index} onChange={setIndex} tabs={panels} />

      <div
        className="insights-viewport"
        onPointerCancel={() => (swipeStart.current = null)}
        onPointerDown={(e) => (swipeStart.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={onSwipeEnd}
      >
        <div
          className="insights-track"
          data-active={index}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {panels.map((p) => (
            <section className="insights-panel" key={p.key}>
              {withData(renderers[p.key])}
            </section>
          ))}
        </div>
      </div>

      <div className="insights-nav">
        <button
          aria-label="이전"
          className="insights-arrow"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          type="button"
         data-act="minsights-panel-prev">
          <ChevronLeft aria-hidden="true" size={20} />
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
          onClick={() => setIndex((i) => Math.min(panels.length - 1, i + 1))}
          type="button"
         data-act="minsights-panel-next">
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>
    </div>
  );
}

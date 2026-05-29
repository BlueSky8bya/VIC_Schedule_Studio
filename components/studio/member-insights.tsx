"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Heart, LineChart, Lock, Trophy } from "lucide-react";
import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from "react";
import {
  getMemberInsightsAction,
  getOwnerSecurityAction,
  type MemberInsightsData,
  type OwnerSecurityData
} from "@/lib/insights/actions";
import { clearUnlockSessionForUserAction } from "@/lib/private-layer/actions";
import { HighlightCards } from "@/components/studio/highlight-cards";
import { SecurityPanel } from "@/components/studio/security-panel";
import { StackTrendChart } from "@/components/studio/stack-trend-chart";
import { hapticTick } from "@/lib/ui/haptics";

// 관리자·매니저·작업자용 월별 인사이트 — 수치 없는 4패널(일정·참여·트렌드·하이라이트).
// 데이터는 getMemberInsightsAction이 이미 수치를 빼고(보안/시스템/방문 원시값 없음, 막대는 0~1 비율)
// 내려주므로 여기선 그대로 그린다. 허용된 하트 합계(이 달/누적)만 숫자로 보인다.
const PANELS = [
  { key: "content", label: "일정", icon: CalendarDays },
  { key: "engagement", label: "참여", icon: Heart },
  { key: "trend", label: "트렌드", icon: LineChart },
  { key: "highlight", label: "하이라이트", icon: Trophy }
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

export function MemberInsights({
  year,
  month,
  canSecurity = false,
  onChangePasscode
}: {
  year: number;
  month: number;
  // 보안 탭은 관리자(소유자)에게만 — 매니저·작업자에겐 탭도 데이터도 없다.
  canSecurity?: boolean;
  onChangePasscode?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [data, setData] = useState<MemberInsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [securityData, setSecurityData] = useState<OwnerSecurityData | null>(null);

  useEffect(() => {
    let alive = true;
    getMemberInsightsAction(year, month)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setData(r.data);
        else setError(r.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [year, month]);

  // 보안 데이터(관리자 전용)는 별도 액션으로 — 월과 무관(현재 세션·암호·자격자).
  useEffect(() => {
    if (!canSecurity) return;
    let alive = true;
    getOwnerSecurityAction().then((r) => {
      if (alive && r.ok) setSecurityData(r.data);
    });
    return () => {
      alive = false;
    };
  }, [canSecurity]);

  async function expireUser(userId: string) {
    const res = await clearUnlockSessionForUserAction(userId);
    if (res.ok) {
      const fresh = await getOwnerSecurityAction();
      if (fresh.ok) setSecurityData(fresh.data);
    } else if (typeof window !== "undefined") {
      window.alert(res.error);
    }
  }

  // 보안 탭(관리자 전용)을 마지막에 더한 실제 패널 목록. 키보드/스와이프 경계도 이 길이를 쓴다.
  const panels = canSecurity
    ? [...PANELS, { key: "security" as const, label: "보안", icon: Lock }]
    : PANELS;
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

  function renderSecurity() {
    if (!securityData) {
      return (
        <div className="insight-skel" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      );
    }
    return (
      <SecurityPanel
        data={securityData}
        onChangePasscode={onChangePasscode}
        onExpire={expireUser}
        showDevelopers={false}
      />
    );
  }

  function withData(render: (d: MemberInsightsData) => ReactNode) {
    if (loading) {
      return (
        <div className="insight-skel" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      );
    }
    if (error || !data) {
      return <p className="insight-empty">{error ?? "불러오지 못했어요."}</p>;
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
              {contentTrend !== 0 ? (
                <em className={`insight-trend ${contentTrend > 0 ? "up" : "down"}`}>
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
                      background: t.bgColor,
                      borderColor: t.borderColor
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
    return (
      <>
        <p className="insight-note">최근 6개월 추이 · 배지는 지난달 대비 변화</p>
        {series.map((s) => {
          const cur = s.values[s.values.length - 1] ?? 0;
          const prev = s.values[s.values.length - 2] ?? 0;
          const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
          const max = Math.max(1, ...s.values);
          return (
            <div className="trend-row" key={s.key}>
              <div className="trend-head">
                <span>{s.label}</span>
                <strong>{cur.toLocaleString()}</strong>
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
                {s.values.map((v, i) => (
                  <div className="trend-bcol" key={i}>
                    <div className="trend-bwrap">
                      <div
                        className={`trend-bar ${i === s.values.length - 1 ? "cur" : ""}`}
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
        <StackTrendChart data={d.trend.contentByTag} showLegend={false} title="🗓️ 태그별 컨텐츠" />
        <StackTrendChart
          data={d.trend.heartsByTag}
          showLegend={false}
          showNumbers={false}
          title="💗 하트 받은 태그"
        />
      </>
    );
  }

  function renderHighlights(d: MemberInsightsData) {
    const bw = d.highlight.busiestWeekday;
    const cards: { key: string; emoji: string; tone: string; label: [string, string]; main: string; sub?: string }[] = [
      {
        key: "day",
        emoji: "🗓️",
        tone: "day",
        label: ["방문", "최다일"],
        main: d.highlight.peakDay ? fmtMonthDay(d.highlight.peakDay) : "—"
      },
      {
        key: "hour",
        emoji: "⏰",
        tone: "hour",
        label: ["최고 방문", "시간대"],
        main: d.highlight.peakHour !== null ? `${d.highlight.peakHour}시` : "—"
      },
      {
        key: "top",
        emoji: "💗",
        tone: "top",
        label: ["인기", "컨텐츠"],
        main: d.highlight.topTitle ?? "—"
      },
      {
        key: "wd",
        emoji: "🔥",
        tone: "wd",
        label: ["컨텐츠", "최다요일"],
        main: "",
        sub: bw !== null ? WEEKDAY[bw] : "—"
      }
    ];
    return <HighlightCards cards={cards} />;
  }

  const renderers = [renderContent, renderEngagement, renderTrend, renderHighlights];

  return (
    <div className="insights">
      <p className="insights-month">{month}월 인사이트</p>
      <div className="insights-tabs" role="tablist" aria-label="인사이트 영역">
        {panels.map((p, i) => (
          <button
            aria-selected={i === index}
            className={`insights-tab ${i === index ? "active" : ""}${
              p.key === "security" ? " insights-tab-wide" : ""
            }`}
            key={p.key}
            onClick={() => setIndex(i)}
            role="tab"
            type="button"
          >
            <p.icon aria-hidden="true" size={14} />
            {p.label}
          </button>
        ))}
      </div>

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
          {panels.map((p, i) => (
            <section className="insights-panel" key={p.key}>
              {p.key === "security" ? renderSecurity() : withData(renderers[i])}
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
        >
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
        >
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>
    </div>
  );
}

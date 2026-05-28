"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cog,
  Heart,
  Lock,
  Radio,
  TrendingUp
} from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { DeveloperPanel } from "@/components/developer/developer-panel";
import {
  getInsightsAction,
  getVisitTrendsAction,
  type InsightsData,
  type VisitTrends
} from "@/lib/insights/actions";

// 방문 추이 그래프의 역할 색·표기.
const ROLE_META: { key: string; label: string; color: string }[] = [
  { key: "viewer", label: "시청자", color: "#9aa0ab" },
  { key: "worker", label: "작업자", color: "#f59e0b" },
  { key: "manager", label: "매니저", color: "#7c6cf0" },
  { key: "owner", label: "관리자", color: "#34d399" },
  { key: "developer", label: "개발자", color: "#60a5fa" }
];

// 개발자 전용 "🛠 인사이트" — 비슷한 지표끼리 패널로 묶어 좌우로 슬라이딩하며 본다.
// 실시간 패널은 Supabase Presence(즉시), 나머지는 서버 집계(getInsightsAction)로 채운다.
// 모든 값은 합계/개수만 — 비공개·owner_private 일정의 '내용'은 절대 노출하지 않는다.

const PANELS = [
  { key: "live", label: "실시간", icon: Radio },
  { key: "visits", label: "방문", icon: TrendingUp },
  { key: "content", label: "일정", icon: CalendarDays },
  { key: "engagement", label: "참여", icon: Heart },
  { key: "security", label: "보안", icon: Lock },
  { key: "system", label: "시스템", icon: Cog }
] as const;

function kst(iso: string | null): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getTime() + 9 * 3600 * 1000);
}
function fmtDate(iso: string | null): string {
  const k = kst(iso);
  return k ? `${k.getUTCFullYear()}.${k.getUTCMonth() + 1}.${k.getUTCDate()}` : "—";
}
function fmtTime(iso: string | null): string {
  const k = kst(iso);
  return k
    ? `${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`
    : "—";
}
function fmtDateTime(iso: string | null): string {
  const k = kst(iso);
  return k
    ? `${k.getUTCMonth() + 1}.${k.getUTCDate()} ${String(k.getUTCHours()).padStart(2, "0")}:${String(k.getUTCMinutes()).padStart(2, "0")}`
    : "—";
}
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
function fmtMonthDay(dateKey: string): string {
  // "YYYY-MM-DD" → "M/D(요일)"
  const [yy, mm, dd] = dateKey.split("-").map(Number);
  const wd = WEEKDAY[new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay()] ?? "";
  return `${mm}/${dd}(${wd})`;
}

function StatTile({ value, label, tone }: { value: number | string; label: string; tone?: string }) {
  return (
    <div className="insight-tile" data-tone={tone}>
      <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function InsightsDashboard() {
  const [index, setIndex] = useState(0);
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<VisitTrends | null>(null);
  const [visitsLoading, setVisitsLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getInsightsAction()
      .then((r) => {
        if (!alive) return;
        if (r.ok) setData(r.data);
        else setError(r.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    getVisitTrendsAction()
      .then((r) => {
        if (alive && r.ok) setVisits(r.data);
      })
      .finally(() => {
        if (alive) setVisitsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const go = (i: number) => setIndex(Math.max(0, Math.min(PANELS.length - 1, i)));

  // 웹: 좌/우 방향키로 패널 이동(모달 열린 동안). 입력칸 포커스 땐 무시.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => Math.min(PANELS.length - 1, i + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 모바일/웹: 좌우로 밀어(스와이프) 패널 이동. 세로 드래그(스크롤)는 무시.
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onSwipeStart = (e: ReactPointerEvent) => {
    swipeStart.current = { x: e.clientX, y: e.clientY };
  };
  const onSwipeEnd = (e: ReactPointerEvent) => {
    const s = swipeStart.current;
    swipeStart.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      setIndex((i) => Math.max(0, Math.min(PANELS.length - 1, i + (dx < 0 ? 1 : -1))));
    }
  };

  // 패널 2~5 공통: 로딩 스켈레톤 / 오류 / 데이터.
  function withData(render: (d: InsightsData) => React.ReactNode) {
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

  const tagMax = Math.max(1, ...(data?.content.tags.map((t) => t.count) ?? [1]));
  const heartMax = Math.max(1, ...(data?.engagement.topEvents.map((t) => t.count) ?? [1]));

  function renderVisits() {
    if (visitsLoading) {
      return (
        <div className="insight-skel" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      );
    }
    if (!visits || !visits.ready) {
      return (
        <p className="insight-empty">
          아직 방문 데이터가 없어요. 마이그레이션(0023_visit_log)을 적용하면 하루 단위로 쌓여
          여기에 날짜별·역할별 그래프가 그려집니다.
        </p>
      );
    }
    const maxTotal = Math.max(1, ...visits.days.map((d) => d.total));
    const maxHour = Math.max(1, ...visits.hours);
    const total14 = visits.days.reduce((s, d) => s + d.total, 0);
    return (
      <>
        <div className="insight-grid">
          <StatTile value={visits.todayTotal} label="오늘 방문" tone="soon" />
          <StatTile value={total14} label="최근 14일" />
        </div>
        <h4 className="insight-subhead">날짜별 방문 (역할 누적)</h4>
        <div className="vt-chart" role="img" aria-label="날짜별 역할 방문 그래프">
          {visits.days.map((d) => (
            <div className="vt-col" key={d.day} title={`${d.day} · ${d.total}명`}>
              <div className="vt-barwrap">
                <div className="vt-bar" style={{ height: `${(d.total / maxTotal) * 100}%` }}>
                  {ROLE_META.map((r) => {
                    const c = d.roles[r.key] ?? 0;
                    return c > 0 ? (
                      <span
                        className="vt-seg"
                        key={r.key}
                        style={{ flexGrow: c, background: r.color }}
                      />
                    ) : null;
                  })}
                </div>
              </div>
              <span className="vt-day">{Number(d.day.slice(8, 10))}</span>
            </div>
          ))}
        </div>
        <ul className="vt-legend">
          {ROLE_META.map((r) => (
            <li key={r.key}>
              <span style={{ background: r.color }} />
              {r.label}
            </li>
          ))}
        </ul>
        <h4 className="insight-subhead">시간대 분포 (KST · 최근 30일)</h4>
        <div className="vt-hours" role="img" aria-label="시간대별 방문 분포">
          {visits.hours.map((c, h) => (
            <div className="vt-hcol" key={h} title={`${h}시 · ${c}명`}>
              <div className="vt-hbar" style={{ height: `${(c / maxHour) * 100}%` }} />
              <span className="vt-hlabel">{h % 6 === 0 ? h : ""}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="insights">
      <div className="insights-tabs" role="tablist" aria-label="인사이트 영역">
        {PANELS.map((p, i) => (
          <button
            aria-selected={i === index}
            className={`insights-tab ${i === index ? "active" : ""}`}
            key={p.key}
            onClick={() => go(i)}
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
        onPointerDown={onSwipeStart}
        onPointerUp={onSwipeEnd}
      >
        <div className="insights-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {/* 1) 실시간 — 기존 프레즌스 패널 그대로(즉시 갱신) */}
          <section className="insights-panel">
            <DeveloperPanel />
          </section>

          {/* 2) 방문 추이 — 날짜×역할 스택 그래프 + 시간대 분포 */}
          <section className="insights-panel">{renderVisits()}</section>

          {/* 3) 일정·콘텐츠 */}
          <section className="insights-panel">
            {withData((d) => {
              const trend = d.content.thisMonthPublic - d.content.lastMonthPublic;
              return (
                <>
                  <div className="insight-next">
                    <span>다음 방송</span>
                    {d.content.nextEvent ? (
                      <strong>
                        {fmtMonthDay(d.content.nextEvent.dateKey)} · {d.content.nextEvent.title}
                      </strong>
                    ) : (
                      <strong className="muted">예정된 공개 일정 없음</strong>
                    )}
                  </div>
                  <div className="insight-grid">
                    <div className="insight-tile" data-tone="public">
                      <strong>
                        {d.content.thisMonthPublic}
                        {trend !== 0 ? (
                          <em className={`insight-trend ${trend > 0 ? "up" : "down"}`}>
                            {trend > 0 ? "▲" : "▼"}
                            {Math.abs(trend)}
                          </em>
                        ) : null}
                      </strong>
                      <span>이번 달 방송</span>
                    </div>
                    <StatTile value={d.content.daysWithStream} label="방송 있는 날" />
                    <StatTile value={d.content.emptyDays} label="빈 날" />
                    <StatTile
                      value={
                        d.content.busiestWeekday !== null
                          ? `${WEEKDAY[d.content.busiestWeekday]}요일`
                          : "—"
                      }
                      label="가장 바쁜 요일"
                    />
                  </div>
                  <h4 className="insight-subhead">이번 달 태그 사용</h4>
                  {d.content.tags.length === 0 ? (
                    <p className="insight-empty">아직 태그가 붙은 일정이 없어요.</p>
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
                                background: t.bgColor,
                                borderColor: t.borderColor
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

          {/* 4) 참여·인기(하트) */}
          <section className="insights-panel">
            {withData((d) => {
              const monMax = Math.max(1, ...d.engagement.monthly.map((x) => x.count));
              return (
                <>
                  <div className="insight-grid">
                    <StatTile value={d.engagement.thisMonthHearts} label="이번 달 하트" tone="heart" />
                    <StatTile value={d.engagement.totalHearts} label="누적 하트" tone="heart" />
                  </div>
                  <h4 className="insight-subhead">월별 하트 (최근 6개월)</h4>
                  <div className="vt-chart" role="img" aria-label="월별 하트 그래프">
                    {d.engagement.monthly.map((mo) => (
                      <div className="vt-col" key={mo.ym} title={`${mo.ym} · ♥ ${mo.count}`}>
                        <div className="vt-barwrap">
                          <div
                            className="vt-bar heart"
                            style={{ height: `${(mo.count / monMax) * 100}%` }}
                          />
                        </div>
                        <span className="vt-day">{Number(mo.ym.slice(5, 7))}월</span>
                      </div>
                    ))}
                  </div>
                  <h4 className="insight-subhead">인기 일정 TOP</h4>
                  {d.engagement.topEvents.length === 0 ? (
                    <p className="insight-empty">아직 하트를 받은 일정이 없어요.</p>
                  ) : (
                    <ul className="insight-bars">
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
                </>
              );
            })}
          </section>

          {/* 5) 보안·접근 */}
          <section className="insights-panel">
            {withData((d) => (
              <>
                <div
                  className={`insight-banner ${d.security.activeUnlocks.length > 0 ? "warn" : "ok"}`}
                >
                  {d.security.activeUnlocks.length > 0
                    ? `지금 비공개를 연 계정 ${d.security.activeUnlocks.length} — 방송 공유 주의`
                    : "지금 비공개를 연 계정 없음"}
                </div>
                {d.security.activeUnlocks.length > 0 ? (
                  <ul className="insight-rows">
                    {d.security.activeUnlocks.map((u, i) => (
                      <li key={i}>
                        <span>{u.email}</span>
                        <strong>~ {fmtTime(u.expiresAt)} 만료</strong>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <h4 className="insight-subhead">비공개 잠금 암호</h4>
                <ul className="insight-rows">
                  <li>
                    <span>암호 버전</span>
                    <strong>v{d.security.passcodeVersion ?? "—"}</strong>
                  </li>
                  <li>
                    <span>마지막 변경</span>
                    <strong>{fmtDate(d.security.passcodeUpdatedAt)}</strong>
                  </li>
                  <li>
                    <span>잠금 유효 시간</span>
                    <strong>{d.security.unlockDurationMinutes ?? "—"}분</strong>
                  </li>
                </ul>
                <h4 className="insight-subhead">신뢰 멤버 ({d.security.members.length})</h4>
                {d.security.members.length === 0 ? (
                  <p className="insight-empty">등록된 매니저·작업자가 없어요.</p>
                ) : (
                  <ul className="insight-rows">
                    {d.security.members.map((mem) => (
                      <li key={mem.email}>
                        <span>{mem.email}</span>
                        <strong className="insight-roletags">
                          {mem.manager ? <em className="rt manager">매니저</em> : null}
                          {mem.worker ? <em className="rt worker">작업자</em> : null}
                        </strong>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ))}
          </section>

          {/* 6) 시스템·운영 */}
          <section className="insights-panel">
            {withData((d) => (
              <>
                {/* 평소엔 소유자 계정만 깔끔히. 설정과 실제 DB 소유자가 다를 때만 경고를 띄운다. */}
                {d.system.bindingOk ? null : (
                  <div className="insight-banner warn">
                    ⚠ 등록된 소유자와 실제 DB 소유자가 달라요 — 소유자 저장이 실패할 수 있어요.
                    <br />
                    실제 DB 소유자: {d.system.dbOwnerEmail ?? "—"}
                  </div>
                )}
                <h4 className="insight-subhead">소유자 계정 ({d.system.ownerEmails.length})</h4>
                {d.system.ownerEmails.length === 0 ? (
                  <p className="insight-empty">등록된 소유자 계정이 없어요.</p>
                ) : (
                  <ul className="insight-list">
                    {d.system.ownerEmails.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
                <h4 className="insight-subhead">배포</h4>
                <ul className="insight-rows">
                  <li>
                    <span>버전(커밋)</span>
                    <strong>{d.system.commit ?? "로컬"}</strong>
                  </li>
                  <li>
                    <span>기준 시각(KST)</span>
                    <strong>{fmtDateTime(d.system.generatedAt)}</strong>
                  </li>
                </ul>
              </>
            ))}
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
        >
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <div className="insights-dots" aria-hidden="true">
          {PANELS.map((p, i) => (
            <span className={i === index ? "on" : ""} key={p.key} />
          ))}
        </div>
        <button
          aria-label="다음"
          className="insights-arrow"
          disabled={index === PANELS.length - 1}
          onClick={() => go(index + 1)}
          type="button"
        >
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </div>
    </div>
  );
}

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
import { useEffect, useState } from "react";
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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  // KST 날짜로만 간단히 표기.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const k = new Date(d.getTime() + 9 * 3600 * 1000);
  return `${k.getUTCFullYear()}.${k.getUTCMonth() + 1}.${k.getUTCDate()}`;
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

      <div className="insights-viewport">
        <div className="insights-track" style={{ transform: `translateX(-${index * 100}%)` }}>
          {/* 1) 실시간 — 기존 프레즌스 패널 그대로(즉시 갱신) */}
          <section className="insights-panel">
            <DeveloperPanel />
          </section>

          {/* 2) 방문 추이 — 날짜×역할 스택 그래프 + 시간대 분포 */}
          <section className="insights-panel">{renderVisits()}</section>

          {/* 3) 일정·콘텐츠 */}
          <section className="insights-panel">
            {withData((d) => (
              <>
                <div className="insight-grid">
                  <StatTile value={d.content.publicCount} label="이번 달 공개" tone="public" />
                  <StatTile value={d.content.privateCount} label="이번 달 비공개" tone="private" />
                  <StatTile value={d.content.upcoming7} label="앞으로 7일" tone="soon" />
                  <StatTile value={d.content.stickerCount} label="이번 달 스티커" />
                  <StatTile value={d.content.assetCount} label="커스텀 이모지" />
                </div>
                <p className="insight-note">비공개 = 엠바고·작업 · “나만” 일정은 집계에서 제외돼요.</p>
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
                            data-color={t.colorKey}
                            style={{ width: `${Math.round((t.count / tagMax) * 100)}%` }}
                          />
                        </span>
                        <span className="insight-bar-count">{t.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ))}
          </section>

          {/* 3) 참여·인기(하트) */}
          <section className="insights-panel">
            {withData((d) => (
              <>
                <div className="insight-grid">
                  <StatTile value={d.engagement.eventHeartTotal} label="일정 하트 합계" tone="heart" />
                  <StatTile value={d.engagement.calendarHearts} label="달력 누적 하트" tone="heart" />
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
            ))}
          </section>

          {/* 4) 보안·접근 */}
          <section className="insights-panel">
            {withData((d) => (
              <>
                <div className="insight-grid">
                  <StatTile
                    value={d.security.activeUnlocks}
                    label="열린 비공개 세션"
                    tone={d.security.activeUnlocks > 0 ? "warn" : undefined}
                  />
                  <StatTile value={d.security.managers} label="매니저" />
                  <StatTile value={d.security.workers} label="작업자" />
                </div>
                <ul className="insight-rows">
                  <li>
                    <span>패스코드 버전</span>
                    <strong>v{d.security.passcodeVersion ?? "—"}</strong>
                  </li>
                  <li>
                    <span>패스코드 변경일</span>
                    <strong>{fmtDate(d.security.passcodeUpdatedAt)}</strong>
                  </li>
                </ul>
                {d.security.activeUnlocks > 0 ? (
                  <p className="insight-note warn">
                    지금 비공개 레이어가 열린 세션이 있어요. 방송 화면 공유에 주의하세요.
                  </p>
                ) : null}
              </>
            ))}
          </section>

          {/* 5) 시스템·운영 */}
          <section className="insights-panel">
            {withData((d) => (
              <>
                <div className={`insight-banner ${d.system.ownerBindingOk ? "ok" : "warn"}`}>
                  {d.system.ownerBindingOk
                    ? "✅ 소유자 바인딩 정상 (OWNER_EMAIL ↔ 달력 소유자 일치)"
                    : "⚠ 소유자 바인딩 불일치 — 소유자 저장이 실패할 수 있어요."}
                </div>
                <ul className="insight-rows">
                  <li>
                    <span>설정 소유자</span>
                    <strong>{d.system.ownerEmail ?? "—"}</strong>
                  </li>
                  <li>
                    <span>달력 소유 계정</span>
                    <strong>{d.system.calendarOwnerEmail ?? "—"}</strong>
                  </li>
                  <li>
                    <span>배포 버전</span>
                    <strong>{d.system.commit ?? "로컬"}</strong>
                  </li>
                  <li>
                    <span>기준 시각(KST)</span>
                    <strong>{fmtDate(d.system.generatedAt)}</strong>
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

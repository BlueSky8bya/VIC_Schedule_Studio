"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cog,
  Heart,
  LineChart,
  Lock,
  Radio,
  TrendingUp,
  Trophy
} from "lucide-react";
import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState
} from "react";
import { DeveloperPanel } from "@/components/developer/developer-panel";
import { StackTrendChart } from "@/components/studio/stack-trend-chart";
import {
  type AccessPerson,
  getInsightsAction,
  getTrendAction,
  getVisitTrendsAction,
  type InsightsData,
  type TrendData,
  type VisitTrends
} from "@/lib/insights/actions";
import { clearUnlockSessionForUserAction } from "@/lib/private-layer/actions";
import { hapticTick } from "@/lib/ui/haptics";

// 보고 있는 달 기준의 "월별 인사이트". 실시간/보안/시스템은 달과 무관, 방문/일정/참여는 그 달 기준.
const ROLE_META: { key: string; label: string; color: string }[] = [
  { key: "viewer", label: "시청자", color: "#9aa0ab" },
  { key: "worker", label: "작업자", color: "#f59e0b" },
  { key: "manager", label: "매니저", color: "#7c6cf0" },
  { key: "owner", label: "관리자", color: "#34d399" },
  { key: "developer", label: "개발자", color: "#60a5fa" }
];
const DEVICE_META: { key: string; label: string; color: string }[] = [
  { key: "desktop", label: "웹", color: "#6b8cef" },
  { key: "android", label: "안드로이드", color: "#3ddc84" },
  { key: "ios", label: "iOS", color: "#a1a1aa" },
  { key: "mobile", label: "기타", color: "#f59e0b" }
];
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

// 통일성: 비개발자에게 배포하는 4패널(일정·참여·트렌드·하이라이트)을 2×4 격자 윗줄에 두고,
// 개발자 전용(실시간·방문·보안·시스템)은 아랫줄에. 아래 트랙 섹션 순서도 이와 일치해야 한다.
const PANELS = [
  { key: "content", label: "일정", icon: CalendarDays },
  { key: "engagement", label: "참여", icon: Heart },
  { key: "trend", label: "트렌드", icon: LineChart },
  { key: "highlight", label: "하이라이트", icon: Trophy },
  { key: "live", label: "실시간", icon: Radio },
  { key: "visits", label: "방문", icon: TrendingUp },
  { key: "security", label: "보안", icon: Lock },
  { key: "system", label: "시스템", icon: Cog }
] as const;
// 탭/패널 격자 열 수 — CSS의 .insights-tabs(repeat(4,1fr))와 방향키·스와이프 행 이동에 함께 쓴다.
const GRID_COLS = 4;

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

// 막대 호버 시 차트 한 곳에 뜨는 분해 툴팁의 데이터(가로 위치 x%, 총합, 색·라벨·수치 줄들).
type VtHover = { x: number; total: number; rows: { color: string; label: string; count: number }[] };

// 스택 막대 한 줄(방문 그래프 공용 — 역할/기기 등 meta로 구분). 호버하면 차트 단일 툴팁에 분해 수치를
// 올려준다(툴팁은 차트 폭 안에서 clamp되어 양 끝에서도 안 잘린다).
function StackBar({
  meta,
  counts,
  total,
  max,
  label,
  index,
  count,
  onHover,
  onLeave
}: {
  meta: { key: string; label: string; color: string }[];
  counts: Record<string, number>;
  total: number;
  max: number;
  label: string;
  index: number;
  count: number;
  onHover: (tip: VtHover) => void;
  onLeave: () => void;
}) {
  const enter = () => {
    if (total <= 0) {
      onLeave();
      return;
    }
    const rows = meta
      .map((s) => ({ color: s.color, label: s.label, count: counts[s.key] ?? 0 }))
      .filter((r) => r.count > 0);
    onHover({ x: ((index + 0.5) / Math.max(1, count)) * 100, total, rows });
  };
  return (
    <div className="vt-col" onPointerEnter={enter} onPointerMove={enter} onPointerLeave={onLeave}>
      <div className="vt-barwrap">
        <div className="vt-bar" style={{ height: `${(total / max) * 100}%` }}>
          <div className="vt-fill">
            {meta.map((s) => {
              const c = counts[s.key] ?? 0;
              return c > 0 ? (
                <span className="vt-seg" key={s.key} style={{ flexGrow: c, background: s.color }} />
              ) : null;
            })}
          </div>
        </div>
      </div>
      <span className="vt-day">{label}</span>
    </div>
  );
}

export function InsightsDashboard({
  year,
  month,
  onChangePasscode
}: {
  year: number;
  month: number;
  onChangePasscode?: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [data, setData] = useState<InsightsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<VisitTrends | null>(null);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [visitView, setVisitView] = useState<"day" | "week">("day");
  const [visitDim, setVisitDim] = useState<"role" | "device">("role");
  const [vtHover, setVtHover] = useState<VtHover | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);
  // 보안 패널: 지금 개별 만료 중인 사람의 user_id(그 카드 버튼만 비활성).
  const [expiringUserId, setExpiringUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getInsightsAction(year, month)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setData(r.data);
        else setError(r.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    getVisitTrendsAction(year, month)
      .then((r) => {
        if (alive && r.ok) setVisits(r.data);
      })
      .finally(() => {
        if (alive) setVisitsLoading(false);
      });
    getTrendAction(year, month)
      .then((r) => {
        if (alive && r.ok) setTrend(r.data);
      })
      .finally(() => {
        if (alive) setTrendLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [year, month]);

  // 일별/주별·역할별/기기별을 바꾸면 막대가 바뀌므로 떠 있던 분해 툴팁은 지운다.
  useEffect(() => setVtHover(null), [visitView, visitDim]);

  const go = (i: number) => setIndex(Math.max(0, Math.min(PANELS.length - 1, i)));

  // 특정 한 사람의 비공개 잠금만 즉시 만료(초기화). 성공하면 보안 데이터를 다시 불러온다.
  async function expireUser(userId: string, email: string) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`${email}의 비공개 잠금을 지금 만료시킬까요?`)
    ) {
      return;
    }
    setExpiringUserId(userId);
    const res = await clearUnlockSessionForUserAction(userId);
    if (res.ok) {
      const fresh = await getInsightsAction(year, month);
      if (fresh.ok) setData(fresh.data);
    } else if (typeof window !== "undefined") {
      window.alert(res.error);
    }
    setExpiringUserId(null);
  }

  // 역할별 접근 자격자 섹션 — 사람마다 이메일·역할·만료시간(또는 "세션 없음")·개별 만료 버튼.
  function renderAccessSection(title: string, roleLabel: string, roleClass: string, people: AccessPerson[]) {
    return (
      <>
        <h4 className="insight-subhead">
          {title} ({people.length})
        </h4>
        {people.length === 0 ? (
          <p className="insight-empty">없어요.</p>
        ) : (
          <ul className="access-list">
            {people.map((p) => (
              <li className="access-card" key={`${roleClass}-${p.email}`}>
                <div className="access-top">
                  <span className="access-email">{p.email}</span>
                  <em className={`rt ${roleClass}`}>{roleLabel}</em>
                </div>
                <div className="access-bottom">
                  {p.expiresAt && p.userId ? (
                    <>
                      <strong className="access-expiry">~ {fmtTime(p.expiresAt)} 만료</strong>
                      <button
                        className="button danger access-expire"
                        disabled={expiringUserId === p.userId}
                        onClick={() => expireUser(p.userId as string, p.email)}
                        type="button"
                      >
                        {expiringUserId === p.userId ? "만료 중…" : "만료시간 초기화"}
                      </button>
                    </>
                  ) : (
                    <span className="access-none">세션 없음</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </>
    );
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      // 탭이 4×2 격자라 방향키도 격자처럼: ←→는 ±1(순서), ↑↓는 ±4(행 이동). 끝에서 막힘.
      const LEN = PANELS.length;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => Math.min(LEN - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => (i - GRID_COLS >= 0 ? i - GRID_COLS : i));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => (i + GRID_COLS < LEN ? i + GRID_COLS : i));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const LEN = PANELS.length;
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
      return <p className="insight-empty">방문 데이터를 불러올 수 없어요.</p>;
    }
    if (!visits.hasData) {
      return (
        <p className="insight-empty">
          {month}월 방문 기록이 아직 없어요. 방문하면 하루 단위로 쌓여 여기에 날짜별·역할별
          그래프가 그려져요.
        </p>
      );
    }
    const series = visitView === "day" ? visits.days : visits.weeks;
    const max = Math.max(1, ...series.map((s) => s.total));
    const meta = visitDim === "role" ? ROLE_META : DEVICE_META;
    const countsOf = (s: { roles: Record<string, number>; devices: Record<string, number> }) =>
      visitDim === "role" ? s.roles : s.devices;
    const hm = Math.max(1, ...visits.hours);
    return (
      <>
        <div className="insight-grid">
          <StatTile value={visits.total} label={`${month}월 방문`} tone="soon" />
        </div>
        <div className="insights-toolbar">
          <div className="insights-subtabs">
            <button
              className={visitView === "day" ? "active" : ""}
              onClick={() => setVisitView("day")}
              type="button"
            >
              일별
            </button>
            <button
              className={visitView === "week" ? "active" : ""}
              onClick={() => setVisitView("week")}
              type="button"
            >
              주별
            </button>
          </div>
          <div className="insights-subtabs">
            <button
              className={visitDim === "role" ? "active" : ""}
              onClick={() => setVisitDim("role")}
              type="button"
            >
              역할별
            </button>
            <button
              className={visitDim === "device" ? "active" : ""}
              onClick={() => setVisitDim("device")}
              type="button"
            >
              기기별
            </button>
          </div>
        </div>
        <div
          className="vt-chart"
          role="img"
          aria-label="방문 그래프"
          onPointerLeave={() => setVtHover(null)}
        >
          {visitView === "day"
            ? visits.days.map((d, i) => (
                <StackBar
                  count={visits.days.length}
                  counts={countsOf(d)}
                  index={i}
                  key={d.day}
                  label={d.day % 5 === 0 || d.day === 1 ? String(d.day) : ""}
                  max={max}
                  meta={meta}
                  onHover={setVtHover}
                  onLeave={() => setVtHover(null)}
                  total={d.total}
                />
              ))
            : visits.weeks.map((w, i) => (
                <StackBar
                  count={visits.weeks.length}
                  counts={countsOf(w)}
                  index={i}
                  key={w.label}
                  label={w.label}
                  max={max}
                  meta={meta}
                  onHover={setVtHover}
                  onLeave={() => setVtHover(null)}
                  total={w.total}
                />
              ))}
          {vtHover ? (
            <div className="vt-tip" style={{ "--tip-x": `${vtHover.x}%` } as CSSProperties}>
              <strong>{vtHover.total}명</strong>
              {vtHover.rows.map((r) => (
                <span className="vt-tip-row" key={r.label}>
                  <i style={{ background: r.color }} />
                  {r.label}
                  <b>{r.count}</b>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <ul className="vt-legend">
          {meta.map((r) => (
            <li key={r.key}>
              <span style={{ background: r.color }} />
              {r.label}
            </li>
          ))}
        </ul>
        <h4 className="insight-subhead">시간대 분포 (KST)</h4>
        <div className="vt-hours" role="img" aria-label="시간대별 방문 분포">
          {visits.hours.map((c, h) => (
            <div className="vt-hcol" key={h}>
              <div className="vt-hbar" data-v={`${c}명`} style={{ height: `${(c / hm) * 100}%` }} />
              <span className="vt-hlabel">{h % 6 === 0 ? h : ""}</span>
            </div>
          ))}
        </div>
      </>
    );
  }

  function renderTrend() {
    if (trendLoading || loading) {
      return (
        <div className="insight-skel" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      );
    }
    if (!trend || !data) {
      return <p className="insight-empty">추이를 불러오지 못했어요.</p>;
    }
    const series = [
      { key: "visits", label: "👀 방문", values: trend.visits },
      { key: "content", label: "🗓️ 컨텐츠", values: trend.content },
      { key: "hearts", label: "💗 하트", values: data.engagement.monthly.map((x) => x.count) }
    ];
    // x축 라벨: 첫 칸과 연도가 바뀌는 칸엔 "YY년"을 윗줄에 작게(예: 26년 1월), 나머진 "M월".
    const xLabels = trend.months.map((mk, i) => {
      const [yy, mm] = mk.split("-").map(Number);
      const prevYy = i > 0 ? Number(trend.months[i - 1].split("-")[0]) : null;
      return { showYear: i === 0 || yy !== prevYy, yy: yy % 100, mm };
    });
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
                  // 지난달과 동률이면 방향색(빨강/파랑) 대신 중립 대시로 — "변화 없음".
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
        <StackTrendChart data={trend.contentByTag} showLegend={false} title="🗓️ 태그별 컨텐츠" />
        <StackTrendChart data={trend.heartsByTag} showLegend={false} title="💗 하트 받은 태그" />
        <StackTrendChart data={trend.visitsByRole} title="👀 방문 — 역할별" />
        <StackTrendChart data={trend.visitsByDevice} title="👀 방문 — 기기별" />
      </>
    );
  }

  function renderHighlights() {
    if (loading || visitsLoading) {
      return (
        <div className="insight-skel" aria-hidden="true">
          <span />
          <span />
        </div>
      );
    }
    if (!data) {
      return <p className="insight-empty">불러오지 못했어요.</p>;
    }
    const peakDay =
      visits?.hasData ? [...visits.days].sort((a, b) => b.total - a.total)[0] : null;
    const peakHour = visits?.hasData
      ? visits.hours.reduce((best, c, h) => (c > best.c ? { h, c } : best), { h: -1, c: 0 })
      : null;
    const top = data.engagement.topEvents[0] ?? null;
    const bw = data.content.busiestWeekday;
    // 라벨은 [윗줄, 아랫줄] 2분할(모바일은 항상 두 줄, 웹은 긴 것만). 오른쪽 큰 수치는 sub.
    const cards: {
      key: string;
      emoji: string;
      tone: string;
      label: [string, string];
      main: string;
      sub: string;
      heart?: boolean;
    }[] = [
      {
        key: "day",
        emoji: "🗓️",
        tone: "day",
        label: ["방문", "최다일"],
        main: peakDay && peakDay.total > 0 ? `${month}/${peakDay.day}` : "—",
        sub: peakDay && peakDay.total > 0 ? `${peakDay.total}명` : ""
      },
      {
        key: "hour",
        emoji: "⏰",
        tone: "hour",
        label: ["최고", "시간대"],
        main: peakHour && peakHour.c > 0 ? `${peakHour.h}시` : "—",
        sub: peakHour && peakHour.c > 0 ? `${peakHour.c}명` : ""
      },
      {
        key: "top",
        emoji: "💗",
        tone: "top",
        label: ["인기", "컨텐츠"],
        main: top ? top.title : "—",
        sub: top ? `${top.count}` : "",
        heart: true
      },
      {
        // 요일은 오른쪽에 큰 글자로(다른 카드의 수치 자리). 본문은 비우고 라벨만.
        key: "wd",
        emoji: "🔥",
        tone: "wd",
        label: ["컨텐츠", "최다요일"],
        main: "",
        sub: bw !== null ? WEEKDAY[bw] : "—"
      }
    ];
    return (
      <div className="highlight-grid">
        {cards.map((c) => (
          <div className="highlight-card" data-tone={c.tone} key={c.key}>
            <span className="hl-emoji" aria-hidden="true">
              {c.emoji}
            </span>
            <span className="hl-body">
              <span className="hl-label">
                {c.label[0]}
                <i className="hl-lbreak" aria-hidden="true" />
                {c.label[1]}
              </span>
              {c.main ? (
                <strong className="hl-main" title={c.main}>
                  {c.main}
                </strong>
              ) : null}
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
      </div>
    );
  }

  return (
    <div className="insights">
      <p className="insights-month">{month}월 인사이트</p>
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
        <div
          className="insights-track"
          data-active={index}
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {/* 1) 일정·콘텐츠(이 달) — 공유 4패널 윗줄 */}
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

          {/* 4) 참여·인기(이 달) */}
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
                </>
              );
            })}
          </section>

          {/* 5) 트렌드(최근 6개월) */}
          <section className="insights-panel">{renderTrend()}</section>

          {/* 4) 이 달의 하이라이트 */}
          <section className="insights-panel">{renderHighlights()}</section>

          {/* 5) 실시간 — 개발자 전용(아랫줄) */}
          <section className="insights-panel">
            <DeveloperPanel />
          </section>

          {/* 6) 방문(이 달) — 개발자 전용 */}
          <section className="insights-panel">{renderVisits()}</section>

          {/* 7) 보안·접근 */}
          <section className="insights-panel">
            {withData((d) => (
              <>
                <div
                  className={`insight-banner ${d.security.activeUnlocks.length > 0 ? "warn" : "ok"}`}
                >
                  {d.security.activeUnlocks.length > 0
                    ? `지금 비공개를 연 계정 ${d.security.activeUnlocks.length}`
                    : "지금 비공개를 연 계정 없음"}
                </div>
                {/* 누가 열었는지·개별 만료는 아래 역할별 섹션(관리자/개발자/작업자) 카드에서 다룬다. */}
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
                {/* 비밀번호 변경 — 잠금이 살아있어 토글이 팝업을 안 띄울 때도 여기서 바로 변경. */}
                {onChangePasscode ? (
                  <button
                    className="button insight-change-passcode"
                    onClick={onChangePasscode}
                    type="button"
                  >
                    비밀번호 변경
                  </button>
                ) : null}
                {/* 비공개를 열 수 있는 사람(매니저 제외) — 역할별로, 사람마다 개별 만료. */}
                {renderAccessSection("관리자", "관리자", "owner", d.security.access.owners)}
                {renderAccessSection("개발자", "개발자", "developer", d.security.access.developers)}
                {renderAccessSection("작업자", "작업자", "worker", d.security.access.workers)}
              </>
            ))}
          </section>

          {/* 6) 시스템·운영 */}
          <section className="insights-panel">
            {withData((d) => (
              <>
                {d.system.bindingOk ? null : (
                  <div className="insight-banner warn">
                    ⚠ 등록된 관리자와 실제 DB 관리자가 달라요 — 관리자 저장이 실패할 수 있어요.
                    <br />
                    실제 DB 관리자: {d.system.dbOwnerEmail ?? "—"}
                  </div>
                )}
                <h4 className="insight-subhead">관리자 계정 ({d.system.ownerEmails.length})</h4>
                {d.system.ownerEmails.length === 0 ? (
                  <p className="insight-empty">등록된 관리자 계정이 없어요.</p>
                ) : (
                  <ul className="insight-list">
                    {d.system.ownerEmails.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
                <h4 className="insight-subhead">개발자 계정 ({d.system.developerEmails.length})</h4>
                {d.system.developerEmails.length === 0 ? (
                  <p className="insight-empty">등록된 개발자 계정이 없어요.</p>
                ) : (
                  <ul className="insight-list">
                    {d.system.developerEmails.map((e) => (
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
                    <span>배포 시각(KST)</span>
                    <strong>{fmtDateTime(d.system.deployedAt)}</strong>
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

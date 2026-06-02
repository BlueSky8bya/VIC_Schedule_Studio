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
import { HighlightCards } from "@/components/studio/highlight-cards";
import { SecurityPanel } from "@/components/studio/security-panel";
import { StackTrendChart } from "@/components/studio/stack-trend-chart";
import { PlainEmail } from "@/components/ui/plain-email";
import {
  getInsightsAction,
  getTrendAction,
  getVisitTrendsAction,
  type InsightsData,
  type TrendData,
  type VisitSummary,
  type VisitTrends
} from "@/lib/insights/actions";
import { clearUnlockSessionForUserAction } from "@/lib/private-layer/actions";
import { hapticTick } from "@/lib/ui/haptics";

// 보고 있는 달 기준의 "월별 인사이트". 실시간/보안/시스템은 달과 무관, 방문/일정/참여는 그 달 기준.
// META·헬퍼는 일별 방문 모달(DayVisitModal)에서도 그대로 재사용 → 색/표기 단일 출처(드리프트 방지).
export const ROLE_META: { key: string; label: string; color: string }[] = [
  { key: "viewer", label: "시청자", color: "#9aa0ab" },
  { key: "worker", label: "작업자", color: "#f59e0b" },
  { key: "manager", label: "매니저", color: "#7c6cf0" },
  { key: "owner", label: "관리자", color: "#34d399" },
  { key: "developer", label: "개발자", color: "#60a5fa" }
];
export const DEVICE_META: { key: string; label: string; color: string }[] = [
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
// 시간대 동시 접속(체류) 호버 — 평균/최고 동시 접속 + 역할/기기별 평균(소수).
type OccHover = { x: number; avg: number; peak: number; rows: { color: string; label: string; val: number }[] };
// 평균 동시 접속(소수) 표시 — 0.1 단위. (일별 모달과 공유)
export const fmtOcc = (n: number) => n.toFixed(1);
// epoch ms → KST(=UTC+9)로 옮긴 Date(이후 getUTC*가 곧 KST 값). "HH:MM"·요일 표기에 쓴다. (일별 모달과 공유)
export const kstOf = (ms: number) => new Date(ms + 9 * 3600 * 1000);
export const hhmm = (ms: number) => {
  const d = kstOf(ms);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
};
// 월별 세션 로그용 — 한 달 범위라 시각만으론 부족하니 "M/D HH:MM"(KST). 일일 모달은 hhmm만.
export const mdhm = (ms: number) => {
  const d = kstOf(ms);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${hhmm(ms)}`;
};
// 체류 시간 표기 — 60초 미만은 '초', 그 이상은 '분'(초 단위 세션 모델이라 짧은 방문도 정확히). (일별 모달과 공유)
export const fmtDur = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s}초` : `${Math.round(s / 60)}분`;
};
// 세션 로그 역할 배지 색 — 역할별 단일 출처(ROLE_META)에서. (일별 모달과 공유)
export const roleColor = (key: string) =>
  ROLE_META.find((m) => m.key === key)?.color ?? "#9aa0ab";
export const deviceColor = (key: string) =>
  DEVICE_META.find((m) => m.key === key)?.color ?? "#9aa0ab";
export const deviceLabel = (key: string) =>
  DEVICE_META.find((m) => m.key === key)?.label ?? key;

// 방문 품질 요약 블록(개발자 전용 — 방문 패널/일일 상세 공용). 시청자 기준이 기본이고, '운영진 포함'
// 토글로 개발자·관리자 테스트 트래픽까지 합산. 위 분리 배지로 숫자가 부풀었는지 바로 보인다.
export type VisitScope = "viewer" | "operator" | "all";
export function VisitSummaryBlock({
  viewer,
  operator,
  all,
  newVisitors,
  returningVisitors,
  scope,
  onScope
}: {
  viewer: VisitSummary;
  operator: VisitSummary;
  all: VisitSummary;
  newVisitors?: number;
  returningVisitors?: number;
  // 제어형(부모가 scope를 주면 토글이 부모 상태를 바꿔 아래 그래프까지 즉시 전환). 없으면 내부 상태.
  scope?: VisitScope;
  onScope?: (s: VisitScope) => void;
}) {
  const [localScope, setLocalScope] = useState<VisitScope>("viewer");
  const cur = scope ?? localScope;
  const setScope = onScope ?? setLocalScope;
  const s = cur === "viewer" ? viewer : cur === "operator" ? operator : all;
  const tabs: { key: VisitScope; label: string }[] = [
    { key: "viewer", label: "시청자" },
    { key: "operator", label: "운영진" },
    { key: "all", label: "전체" }
  ];
  return (
    <div className="vsum">
      <div className="vsum-head">
        <span className="vsum-split">
          시청자 <b>{viewer.visitors}</b>명 · 운영진 <b>{operator.visitors}</b>명 · 세션{" "}
          <b>{all.sessions}</b>회
        </span>
        <div className="insights-subtabs vsum-toggle">
          {tabs.map((t) => (
            <button
              className={cur === t.key ? "active" : ""}
              key={t.key}
              onClick={() => {
                hapticTick();
                setScope(t.key);
              }}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="vsum-kpis">
        <li>
          <b>{s.visitors}</b>
          <span>방문자</span>
        </li>
        <li>
          <b>{s.sessions}</b>
          <span>세션</span>
        </li>
        <li>
          <b>{s.glances}</b>
          <span>스쳐감</span>
        </li>
        <li>
          <b>{Math.round(s.bounceRate * 100)}%</b>
          <span>바운스</span>
        </li>
        <li>
          <b>{fmtDur(s.avgSeconds)}</b>
          <span>평균체류</span>
        </li>
        <li>
          <b>{fmtDur(s.totalSeconds)}</b>
          <span>총체류</span>
        </li>
        <li>
          <b>{s.peakConcurrent}</b>
          <span>최고동접</span>
        </li>
        {/* R12: 새/재방문(시청자 기준 — 토글과 무관하게 시청자 신호) */}
        {typeof newVisitors === "number" ? (
          <li>
            <b>{newVisitors}</b>
            <span>새 방문</span>
          </li>
        ) : null}
        {typeof returningVisitors === "number" ? (
          <li>
            <b>{returningVisitors}</b>
            <span>재방문</span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

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
  const [visitScope, setVisitScope] = useState<VisitScope>("viewer"); // 시청자/운영진/전체 — 그래프까지 즉시 전환
  const [vtHover, setVtHover] = useState<VtHover | null>(null);
  const [vtHourHover, setVtHourHover] = useState<OccHover | null>(null); // 시간대 점유(체류) 분해 툴팁
  const [ownerTip, setOwnerTip] = useState<{ x: number; top: number; text: string } | null>(null); // 관리자 세션 띠 툴팁
  const [dsessTip, setDsessTip] = useState<{ x: number; day: number; n: number } | null>(null); // 일별 세션 막대 호버
  const [logRole, setLogRole] = useState<string | null>(null); // 세션 로그 역할 필터(null=전체)
  const [logStay, setLogStay] = useState<"all" | "stay" | "glance">("all"); // 머문/스쳐감 필터
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [trendLoading, setTrendLoading] = useState(true);

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
  useEffect(() => {
    setVtHover(null);
    setVtHourHover(null);
  }, [visitView, visitDim]);

  // 방문 패널을 보는 동안엔 20초마다 새로고침 — 지금 내가 보고 있는(진행 중) 세션까지 거의
  // 실시간으로 반영(모달 최초 로드 이후 생긴 세션·갱신된 체류시간이 들어온다).
  useEffect(() => {
    if (PANELS[index]?.key !== "visits") return;
    let alive = true;
    const refresh = () => {
      getVisitTrendsAction(year, month).then((r) => {
        if (alive && r.ok) setVisits(r.data);
      });
    };
    refresh(); // 진입 즉시 한 번
    const id = window.setInterval(refresh, 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [index, year, month]);

  const go = (i: number) => setIndex(Math.max(0, Math.min(PANELS.length - 1, i)));

  // 특정 한 사람의 비공개 잠금만 즉시 만료(초기화) → 성공하면 보안 데이터를 다시 불러온다.
  // (확인 대화/버튼 비활성은 SecurityPanel이 담당.)
  async function expireUser(userId: string) {
    const res = await clearUnlockSessionForUserAction(userId);
    if (res.ok) {
      const fresh = await getInsightsAction(year, month);
      if (fresh.ok) setData(fresh.data);
      return { ok: true };
    }
    return { ok: false, error: res.error };
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
    // 토글(시청자/운영진/전체)이 고른 그래프 묶음 — 아래 막대·동접·히트맵·미니달력 전부 이걸 쓴다.
    const g =
      visitScope === "viewer" ? visits.viewer : visitScope === "operator" ? visits.operator : visits.all;
    const scopeLabel = visitScope === "viewer" ? "시청자" : visitScope === "operator" ? "운영진" : "전체";
    const series = visitView === "day" ? g.days : g.weeks;
    const meta = visitDim === "role" ? ROLE_META : DEVICE_META;
    const countsOf = (s: { roles: Record<string, number>; devices: Record<string, number> }) =>
      visitDim === "role" ? s.roles : s.devices;
    // 역할별 = '방문'(계정 단위, total=방문수). 기기별 = '기기'(한 계정이 웹·iOS면 둘 다 1대라
    // 합이 방문수보다 클 수 있다) → 막대 높이·툴팁 합계도 그 차원에 맞춘다.
    const totalOf = (s: { total: number; devices: Record<string, number> }) =>
      visitDim === "role" ? s.total : Object.values(s.devices).reduce((a, b) => a + b, 0);
    const unit = visitDim === "role" ? "명" : "대";
    const max = Math.max(1, ...series.map(totalOf));
    // 시간대 막대 높이 스케일은 '평균 동시 접속'의 최댓값 기준(상대 스케일이라 절대치가 작아도 형태가 보임).
    const om = Math.max(0.0001, ...g.occupancy.map((s) => s.avg));
    // 관리자 접속 세션을 KST 날짜별로 묶고, 각 세션을 24h 트랙 좌표(시작%·길이%)로 — 수면/스크린타임
    // 타임라인처럼 "언제·몇 분·어느 기기"를 한 줄로 보여준다(최근 날짜가 위).
    const devMeta = (k: string) => DEVICE_META.find((m) => m.key === k) ?? DEVICE_META[0];
    type OwnSeg = {
      startFrac: number;
      widthFrac: number;
      device: string;
      label: string; // 툴팁: "18:03–18:47 · 45분 · 안드로이드"
    };
    const ownerDayMap = new Map<string, { label: string; segs: OwnSeg[] }>();
    for (const s of visits.ownerSessions) {
      const d = kstOf(s.startMs);
      const key = d.toISOString().slice(0, 10);
      const startFrac = (d.getUTCHours() + d.getUTCMinutes() / 60) / 24;
      const widthFrac = Math.min(1 - startFrac, Math.max(s.seconds / 3600 / 24, 0));
      const entry = ownerDayMap.get(key) ?? { label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`, segs: [] };
      entry.segs.push({
        startFrac,
        widthFrac,
        device: s.device,
        label: `${hhmm(s.startMs)}–${hhmm(s.endMs)} · ${fmtDur(s.seconds)} · ${devMeta(s.device).label}`
      });
      ownerDayMap.set(key, entry);
    }
    const ownerDays = [...ownerDayMap.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, v]) => ({ key, ...v }));
    const ownerDevices = DEVICE_META.filter((m) => visits.ownerSessions.some((s) => s.device === m.key));
    const onOwnSeg = (e: ReactPointerEvent<HTMLElement>, text: string) => {
      const cont = e.currentTarget.closest(".own-sessions") as HTMLElement | null;
      if (!cont) return;
      const cr = cont.getBoundingClientRect();
      const sr = e.currentTarget.getBoundingClientRect();
      setOwnerTip({ x: ((sr.left + sr.width / 2 - cr.left) / cr.width) * 100, top: sr.top - cr.top, text });
    };
    return (
      // 웹: 2단 대시보드 그리드(.vpanel) — 요약/문구는 풀폭, 차트는 좌우 2열 카드로 가로폭을 채운다.
      // 모바일: 같은 마크업이 한 줄 세로 스택으로 떨어진다(컴팩트, 카드 테두리 없음).
      <div className="vpanel">
        {/* 방문 품질 요약(R1 컷·R2 토글·R4 KPI·R5 분리·R12 새/재방문·R13 최고동접). — 풀폭 */}
        <VisitSummaryBlock
          viewer={visits.summaryViewer}
          operator={visits.summaryOperator}
          all={visits.summaryAll}
          newVisitors={visits.newVisitors}
          returningVisitors={visits.returningVisitors}
          scope={visitScope}
          onScope={setVisitScope}
        />
        {/* R6: 한 문장 자동 인사이트 — 풀폭 */}
        {visits.insights.length > 0 ? (
          <ul className="vins">
            {visits.insights.map((line, i) => (
              <li key={i}>💡 {line}</li>
            ))}
          </ul>
        ) : null}

        {/* 방문 추이(일별/주별 · 역할/기기) — 좌측 카드 */}
        <section className="vcard">
          <h4 className="insight-subhead">
            방문 추이 ({scopeLabel}) <span className="vcrit">{visitDim === "role" ? "방문 수" : "기기 수"}</span>
          </h4>
          {/* 토글 두 묶음을 좌(일별/주별)·우(역할별/기기별)로 갈라 배치 */}
          <div className="vt-toolbar">
            <div className="insights-subtabs">
              <button
                className={visitView === "day" ? "active" : ""}
                onClick={() => {
                  hapticTick();
                  setVisitView("day");
                }}
                type="button"
              >
                일별
              </button>
              <button
                className={visitView === "week" ? "active" : ""}
                onClick={() => {
                  hapticTick();
                  setVisitView("week");
                }}
                type="button"
              >
                주별
              </button>
            </div>
            <div className="insights-subtabs">
              <button
                className={visitDim === "role" ? "active" : ""}
                onClick={() => {
                  hapticTick();
                  setVisitDim("role");
                }}
                type="button"
              >
                역할별
              </button>
              <button
                className={visitDim === "device" ? "active" : ""}
                onClick={() => {
                  hapticTick();
                  setVisitDim("device");
                }}
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
              ? g.days.map((d, i) => (
                  <StackBar
                    count={g.days.length}
                    counts={countsOf(d)}
                    index={i}
                    key={d.day}
                    label={d.day % 5 === 0 || d.day === 1 ? String(d.day) : ""}
                    max={max}
                    meta={meta}
                    onHover={setVtHover}
                    onLeave={() => setVtHover(null)}
                    total={totalOf(d)}
                  />
                ))
              : g.weeks.map((w, i) => (
                  <StackBar
                    count={g.weeks.length}
                    counts={countsOf(w)}
                    index={i}
                    key={w.label}
                    label={w.label}
                    max={max}
                    meta={meta}
                    onHover={setVtHover}
                    onLeave={() => setVtHover(null)}
                    total={totalOf(w)}
                  />
                ))}
            {vtHover ? (
              <div className="vt-tip" style={{ "--tip-x": `${vtHover.x}%` } as CSSProperties}>
                <strong>{vtHover.total}{unit}</strong>
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
        </section>

        {/* 시간대별 동시 접속(체류) — 우측 카드 */}
        <section className="vcard">
          {/* 위 일별/주별은 '방문 수(첫 진입)'지만, 이 막대는 '그 시각에 떠 있던 인원(체류)'이다. */}
          <h4 className="insight-subhead">
            시간대별 동접 (KST) <span className="vcrit">평균 동시 접속자</span>
          </h4>
          <div
            className={`vt-hours ${g.hasOccupancy ? "" : "empty"}`}
            role="img"
            aria-label="시간대별 동시 접속(체류) 분포(역할·기기 분해)"
            onPointerLeave={() => setVtHourHover(null)}
          >
            {g.occupancy.map((slot, h) => {
              const counts = countsOf(slot);
              const enter = () => {
                if (slot.avg <= 0) {
                  setVtHourHover(null);
                  return;
                }
                const rows = meta
                  .map((m) => ({ color: m.color, label: m.label, val: counts[m.key] ?? 0 }))
                  .filter((r) => r.val > 0.001);
                setVtHourHover({ x: ((h + 0.5) / 24) * 100, avg: slot.avg, peak: slot.peak, rows });
              };
              return (
                <div
                  className="vt-hcol"
                  key={h}
                  onPointerEnter={enter}
                  onPointerMove={enter}
                  onPointerLeave={() => setVtHourHover(null)}
                >
                  <div className="vt-hbar" style={{ height: `${(slot.avg / om) * 100}%` }}>
                    <div className="vt-fill">
                      {meta.map((m) => {
                        const c = counts[m.key] ?? 0;
                        // flex-grow 합이 1 미만(평균<1)이면 fill이 막대를 다 못 채워 배경이 비친다 →
                        // 역할 '비율'(c/총합)로 정규화해 항상 막대 전체를 채운다(높이는 이미 avg가 인코딩).
                        return c > 0 ? (
                          <span
                            className="vt-seg"
                            key={m.key}
                            style={{ flexGrow: slot.avg > 0 ? c / slot.avg : 1, background: m.color }}
                          />
                        ) : null;
                      })}
                    </div>
                  </div>
                  <span className="vt-hlabel">{h % 6 === 0 ? h : ""}</span>
                </div>
              );
            })}
            {vtHourHover ? (
              <div className="vt-tip" style={{ "--tip-x": `${vtHourHover.x}%` } as CSSProperties}>
                <strong>
                  평균 {fmtOcc(vtHourHover.avg)} · 최고 {vtHourHover.peak}
                </strong>
                {vtHourHover.rows.map((r) => (
                  <span className="vt-tip-row" key={r.label}>
                    <i style={{ background: r.color }} />
                    {r.label}
                    <b>{fmtOcc(r.val)}</b>
                  </span>
                ))}
              </div>
            ) : null}
            {g.hasOccupancy ? null : (
              <span className="vt-hours-empty">아직 핑 없음 · 방문자가 다녀가면 막대가 차올라요</span>
            )}
          </div>
          <ul className="vt-legend">
            {meta.map((r) => (
              <li key={r.key}>
                <span style={{ background: r.color }} />
                {r.label}
              </li>
            ))}
          </ul>
        </section>

        {/* R7: 요일×시간 히트맵 — 24열로 넓어 풀폭이 읽기 좋다. */}
        <section className="vcard full">
          <h4 className="insight-subhead">
            요일 × 시간 ({scopeLabel}) <span className="vcrit">세션 수</span>
          </h4>
          {(() => {
            const wdays = ["일", "월", "화", "수", "목", "금", "토"];
            const hmMax = Math.max(1, ...g.heatmap.flat());
            return (
              <div className="vheat" role="img" aria-label="요일×시간 히트맵">
                {g.heatmap.map((row, wd) => (
                  <div className="vheat-row" key={wd}>
                    <span className="vheat-wd">{wdays[wd]}</span>
                    {row.map((c, h) => (
                      <i
                        key={h}
                        title={`${wdays[wd]} ${h}시 · ${c}세션`}
                        style={{ background: c > 0 ? `rgba(124,92,245,${0.15 + (c / hmMax) * 0.8})` : "#f1eef9" }}
                      />
                    ))}
                  </div>
                ))}
                <div className="vheat-axis">
                  <span>0</span>
                  <span>6</span>
                  <span>12</span>
                  <span>18</span>
                  <span>23</span>
                </div>
              </div>
            );
          })()}
        </section>

        {/* 관리자(토리님) 전용 접속 세션 — 가로 24h 타임라인이라 풀폭. */}
        <section className="vcard full">
          <h4 className="insight-subhead">
            관리자 접속 세션 (이번 달) <span className="vcrit">하루 = 한 줄</span>
          </h4>
          {ownerDays.length > 0 ? (
            <>
              <div className="own-sessions" onPointerLeave={() => setOwnerTip(null)}>
                {ownerDays.map((d) => (
                  <div className="own-row" key={d.key}>
                    <span className="own-date">{d.label}</span>
                    <div className="own-track">
                      {d.segs.map((s, i) => (
                        <span
                          className="own-seg"
                          key={i}
                          onPointerEnter={(e) => onOwnSeg(e, s.label)}
                          onPointerMove={(e) => onOwnSeg(e, s.label)}
                          onPointerLeave={() => setOwnerTip(null)}
                          style={{
                            left: `${s.startFrac * 100}%`,
                            width: `${s.widthFrac * 100}%`,
                            background: devMeta(s.device).color
                          }}
                          title={s.label}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="own-axis" aria-hidden="true">
                  <span>0</span>
                  <span>6</span>
                  <span>12</span>
                  <span>18</span>
                  <span>24</span>
                </div>
                {ownerTip ? (
                  <div
                    className="vt-tip own-tip"
                    style={{ "--tip-x": `${ownerTip.x}%`, top: ownerTip.top } as CSSProperties}
                  >
                    <strong>{ownerTip.text}</strong>
                  </div>
                ) : null}
              </div>
              <ul className="vt-legend">
                {ownerDevices.map((m) => (
                  <li key={m.key}>
                    <span style={{ background: m.color }} />
                    {m.label}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="insight-empty">
              아직 관리자 접속 세션이 없어요. 토리님이 접속하면 기기·시간대·머문 시간이 여기 그려져요.
            </p>
          )}
        </section>

        {/* R8: 날짜별 미니 달력 히트맵(체류 긴 날 진하게 — 방문 수가 아니라 총 체류시간). 표시 전용. — 좌측 카드 */}
        <section className="vcard">
          <h4 className="insight-subhead">
            날짜별 <span className="vcrit">체류 시간</span>
          </h4>
          {(() => {
            const firstWd = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
            const stayMax = Math.max(1, ...g.days.map((d) => d.stay));
            const wdays = ["일", "월", "화", "수", "목", "금", "토"];
            return (
              <div className="vmini">
                {wdays.map((w) => (
                  <span className="vmini-h" key={w}>
                    {w}
                  </span>
                ))}
                {Array.from({ length: firstWd }, (_, i) => (
                  <span className="vmini-cell empty" key={`b${i}`} />
                ))}
                {g.days.map((d) => (
                  <span
                    className="vmini-cell"
                    key={d.day}
                    title={`${month}/${d.day} · 체류 ${fmtDur(d.stay)} · ${d.total}방문`}
                    style={{ background: d.stay > 0 ? `rgba(52,211,153,${0.18 + (d.stay / stayMax) * 0.75})` : "#f3f1ee" }}
                  >
                    {d.day}
                  </span>
                ))}
              </div>
            );
          })()}
        </section>

        {/* 개발자 디버깅 푸터(R11 건강 + R10 최근 세션) — 우측 카드 */}
        <section className="vcard vcard-foot">
          <h4 className="insight-subhead">
            세션 로그 <span className="vlive">실시간</span>
          </h4>
          <p className="vhealth">
            오늘 {visits.health.todaySessions}세션 · 미종료 {Math.round(visits.health.openRate * 100)}% · 평균 체류 {fmtDur(visits.health.avgStaySec)}
          </p>
          {/* 하루 단위 기록을 모은 월간 추이 — 일별 세션 수 막대 + 평균/최다일 요약. */}
          {visits.dailySessions.length > 0
            ? (() => {
                const dmax = Math.max(1, ...visits.dailySessions);
                const total = visits.dailySessions.reduce((a, b) => a + b, 0);
                const active = visits.dailySessions.filter((n) => n > 0).length;
                const avg = active > 0 ? Math.round(total / active) : 0;
                const peak = visits.dailySessions.reduce(
                  (b, n, i) => (n > visits.dailySessions[b] ? i : b),
                  0
                );
                return (
                  <>
                    <p className="vhealth">
                      하루 평균 {avg}세션 · 가장 바쁜 날 {month}/{peak + 1} ({visits.dailySessions[peak]}세션)
                    </p>
                    <div
                      aria-label="일별 세션 수"
                      className="dsess"
                      onPointerLeave={() => setDsessTip(null)}
                      role="img"
                    >
                      {visits.dailySessions.map((n, i) => {
                        const enter = () =>
                          setDsessTip({
                            x: ((i + 0.5) / visits.dailySessions.length) * 100,
                            day: i + 1,
                            n
                          });
                        return (
                          <div
                            className="dsess-col"
                            key={i}
                            onPointerEnter={enter}
                            onPointerMove={enter}
                          >
                            <div className="dsess-barwrap">
                              <div className="dsess-bar" style={{ height: `${(n / dmax) * 100}%` }} />
                            </div>
                            <span className="dsess-x">{(i + 1) % 5 === 0 || i === 0 ? i + 1 : ""}</span>
                          </div>
                        );
                      })}
                      {dsessTip ? (
                        <div className="vt-tip" style={{ "--tip-x": `${dsessTip.x}%` } as CSSProperties}>
                          <strong>
                            {month}/{dsessTip.day} · {dsessTip.n}세션
                          </strong>
                        </div>
                      ) : null}
                    </div>
                  </>
                );
              })()
            : null}
          <details className="vrecent" open>
            <summary>세션 {visits.recent.length}건 <span className="vcrit">20초마다 갱신</span></summary>
            {/* 역할 필터 칩 — 모든 역할(ROLE_META) 항상 노출. 세션 0인 역할은 흐리게(있는지 한눈에),
                칩 끝에 건수. 클릭 시 그 역할만(다시 누르면 전체). */}
            {visits.recent.length > 0
              ? (() => {
                  const countByRole = (key: string) =>
                    visits.recent.filter((r) => r.role === key).length;
                  return (
                    <div className="vlog-filter" role="group" aria-label="역할 필터">
                      <button
                        className={`vlog-chip${logRole === null ? " on" : ""}`}
                        onClick={() => {
                          hapticTick();
                          setLogRole(null);
                        }}
                        type="button"
                      >
                        전체 <b>{visits.recent.length}</b>
                      </button>
                      {ROLE_META.map((m) => {
                        const c = countByRole(m.key);
                        return (
                          <button
                            className={`vlog-chip${logRole === m.key ? " on" : ""}${c === 0 ? " zero" : ""}`}
                            data-role={m.key}
                            key={m.key}
                            onClick={() => {
                              hapticTick();
                              setLogRole((cur) => (cur === m.key ? null : m.key));
                            }}
                            style={{ "--rc": m.color } as CSSProperties}
                            type="button"
                          >
                            {m.label} <b>{c}</b>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()
              : null}
            {/* 머문/스쳐감 필터 — 스쳐감(<3초)과 실제 머문 세션 구분. */}
            {visits.recent.length > 0
              ? (() => {
                  const stayN = visits.recent.filter((r) => r.meaningful).length;
                  const glanceN = visits.recent.length - stayN;
                  const opts: { key: "all" | "stay" | "glance"; label: string; n: number }[] = [
                    { key: "all", label: "전체", n: visits.recent.length },
                    { key: "stay", label: "머문", n: stayN },
                    { key: "glance", label: "스쳐감", n: glanceN }
                  ];
                  return (
                    <div className="vlog-filter stay" role="group" aria-label="머문/스쳐감 필터">
                      {opts.map((o) => (
                        <button
                          className={`vlog-chip${logStay === o.key ? " on" : ""}${o.n === 0 ? " zero" : ""}`}
                          key={o.key}
                          onClick={() => {
                            hapticTick();
                            setLogStay(o.key);
                          }}
                          type="button"
                        >
                          {o.label} <b>{o.n}</b>
                        </button>
                      ))}
                    </div>
                  );
                })()
              : null}
            <ul className="vlog">
              {(() => {
                const shown = visits.recent.filter(
                  (r) =>
                    (!logRole || r.role === logRole) &&
                    (logStay === "all" || (logStay === "stay" ? r.meaningful : !r.meaningful))
                );
                if (shown.length === 0) {
                  return <li className="vlog-empty">조건에 맞는 세션이 없어요.</li>;
                }
                return shown.map((r, i) => (
                <li className={`vlog-row${r.meaningful ? "" : " glance"}`} key={i}>
                  <span
                    aria-hidden="true"
                    className="vlog-dot"
                    style={{ background: deviceColor(r.device) }}
                  />
                  <div className="vlog-main">
                    <div className="vlog-line1">
                      <span
                        className="vrecent-role"
                        data-role={r.role}
                        style={{ "--rc": roleColor(r.role) } as CSSProperties}
                      >
                        {r.label}
                        {r.dual ? <em className="vlog-dual">겸</em> : null}
                      </span>
                      <time className="vlog-t">{mdhm(r.t)}</time>
                    </div>
                    <div className="vlog-line2">
                      <span className="vlog-dev">{deviceLabel(r.device)}</span>
                      <span className="vlog-dur">
                        {fmtDur(r.seconds)}
                        {r.meaningful ? "" : " · 스쳐감"}
                      </span>
                    </div>
                  </div>
                </li>
                ));
              })()}
            </ul>
          </details>
        </section>
      </div>
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
        <StackTrendChart
          data={trend.heartsByTag}
          rankLabel="인기 높은 순"
          showLegend={false}
          title="💗 하트 받은 태그"
        />
        <StackTrendChart data={trend.visitsByRole} title="👀 역할별 방문" />
        <StackTrendChart data={trend.visitsByDevice} title="📱 기기별 접속" />
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
      visits?.hasData ? [...visits.all.days].sort((a, b) => b.total - a.total)[0] : null;
    const peakHour = visits?.hasData
      ? visits.all.hours.reduce(
          (best, slot, h) => (slot.total > best.c ? { h, c: slot.total } : best),
          { h: -1, c: 0 }
        )
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
        label: ["최고 방문", "시간대"],
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
    return <HighlightCards cards={cards} />;
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

          {/* 7) 보안·접근 — 공용 SecurityPanel(개발자는 개발자 섹션까지 모두 표시). */}
          <section className="insights-panel">
            {withData((d) => (
              <SecurityPanel
                data={{
                  activeUnlockCount: d.security.activeUnlocks.length,
                  passcodeVersion: d.security.passcodeVersion,
                  passcodeUpdatedAt: d.security.passcodeUpdatedAt,
                  unlockDurationMinutes: d.security.unlockDurationMinutes,
                  access: d.security.access
                }}
                onChangePasscode={onChangePasscode}
                onExpire={expireUser}
                showDevelopers
              />
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
                    실제 DB 관리자:{" "}
                    {d.system.dbOwnerEmail ? <PlainEmail value={d.system.dbOwnerEmail} /> : "—"}
                  </div>
                )}
                <h4 className="insight-subhead">관리자 계정 ({d.system.ownerEmails.length})</h4>
                {d.system.ownerEmails.length === 0 ? (
                  <p className="insight-empty">등록된 관리자 계정이 없어요.</p>
                ) : (
                  <ul className="sys-emails">
                    {d.system.ownerEmails.map((e) => (
                      <li key={e}>
                        <span className="sys-dot" style={{ background: roleColor("owner") }} />
                        <PlainEmail className="sys-email" value={e} />
                      </li>
                    ))}
                  </ul>
                )}
                <h4 className="insight-subhead">개발자 계정 ({d.system.developerEmails.length})</h4>
                {d.system.developerEmails.length === 0 ? (
                  <p className="insight-empty">등록된 개발자 계정이 없어요.</p>
                ) : (
                  <ul className="sys-emails">
                    {d.system.developerEmails.map((e) => (
                      <li key={e}>
                        <span className="sys-dot" style={{ background: roleColor("developer") }} />
                        <PlainEmail className="sys-email" value={e} />
                      </li>
                    ))}
                  </ul>
                )}
                <h4 className="insight-subhead">배포</h4>
                <ul className="insight-rows">
                  <li>
                    <span>버전(커밋)</span>
                    <strong className="sys-commit">{d.system.commit ?? "로컬"}</strong>
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

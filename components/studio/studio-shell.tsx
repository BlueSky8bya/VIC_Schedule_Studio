"use client";

// 인사이트 차트·타일 스타일(편집실·시청자 공용) — studio-shell.css에서 분리된 파일.
import "@/components/studio/insights-charts.css";

import dynamic from "next/dynamic";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  LockKeyhole,
  LogOut,
  Save,
  Sparkles,
  Trash2,
  Vibrate,
  Wrench,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
import type {
  BroadcastTag,
  ColorKey,
  ColorPaletteEntry,
  EventCategory,
  EventStatus,
  EventVisibilityScope,
  MembershipRole,
  StudioSchedule,
  StudioScheduleEvent,
  PublicScheduleEvent
} from "@/lib/domain/schedule-types";
import type { CurrentActor } from "@/lib/auth/actor";
import {
  assignSupportLanes,
  buildCalendarMonth,
  buildChainKeys,
  buildLinkChain,
  buildPaintGroups,
  classifyDay,
  eventColorStyle,
  getAdjacentMonth,
  getEventDateKey,
  getEventsForDate,
  eventMatchesTagFilter,
  getEventSpan,
  getLinkedChainIds,
  getSpanRunRange,
  getTodayKst,
  mixedEventStyle,
  splitEventTitle
} from "@/lib/calendar/month";
import { useEqualChainHeights } from "@/lib/calendar/use-equal-chain-heights";
import { useCellRangeSelect } from "@/lib/calendar/use-cell-range-select";
import { markContentReady } from "@/lib/presence/content-ready";
import { getDayMark } from "@/lib/calendar/holidays";
import { isWorldCupMonth } from "@/lib/calendar/worldcup";
// 월드컵 달에만 뜨는 중력 공 — 정적 import면 lib/football까지 편집실 첫 로드 번들에 얹힌다.
const WorldCupStudioBall = dynamic(
  () => import("@/components/seasonal/worldcup-studio-ball").then((m) => m.WorldCupStudioBall),
  { ssr: false }
);
import {
  canDecorate,
  canEditEventTags,
  canEditSchedule,
  canEditSupport,
  canReadOwnerPrivate,
  canReadPrivateLayer,
  canUsePrivateLayer
} from "@/lib/permissions/roles";
import { isTaxonomyV3, legacyTagView } from "@/lib/tags/taxonomy";
import { createTagVisualResolver } from "@/lib/tags/tag-visual";
import { toggleEventHeartAction } from "@/lib/schedules/heart-actions";
import { removeTagAction, saveTagsAction } from "@/lib/schedules/tag-actions";
import { CalendarSkeleton } from "@/components/skeleton/calendar-skeleton";
import { PrivateLayerPanel } from "@/components/private-layer/private-layer-panel";
import { TagLegendEditor } from "@/components/tags/tag-legend-editor";
import { DateTimePicker } from "@/components/studio/datetime-picker";
import { TagPicker } from "@/components/tags/tag-picker";
import { PlainEmail } from "@/components/ui/plain-email";
import { setPasscodeAction } from "@/lib/private-layer/actions";
import { MOBILE_QUERY } from "@/lib/ui/breakpoints";
import { detectDevice } from "@/lib/presence/presence-client";
import { hapticDelete, hapticsEnabled, hapticTick, setHapticsEnabled } from "@/lib/ui/haptics";
import { eyeComfortEnabled, reduceMotionEnabled, setEyeComfort, setReduceMotion } from "@/lib/ui/motion";
import { hasInnerOverlay } from "@/lib/ui/overlay-pop";
import { writeViewCookie } from "@/lib/ui/view-cookie";
// 스튜디오 CSS는 StudioShell을 렌더하는 페이지(studio/(home), studio/calendar)에서 page-level로
// import한다 — 그래야 <head>에 렌더 차단으로 올라가 모바일 첫 진입에도 깜빡임(FOUC)이 없다.
// (컴포넌트에서 import하면 loading.tsx 이후 스트리밍으로 늦게 적용돼 잠깐 무스타일로 보였다.)
// 루트 전역에는 두지 않으므로 공개 포스터 `/` 시청자는 여전히 이 CSS를 받지 않는다.

// 모달 콘텐츠는 '열 때만' 로드해 편집실 첫 로딩을 가볍게(특히 인사이트 차트는 1600줄+). 전부 클라
// 전용 모달(사용자 동작으로 열림)이라 ssr:false. 닫혀 있는 동안엔 번들·실행에 들어가지 않는다.
const InsightsDashboard = dynamic(
  () => import("@/components/developer/insights-dashboard").then((m) => m.InsightsDashboard),
  { ssr: false }
);
const MemberInsights = dynamic(
  () => import("@/components/studio/member-insights").then((m) => m.MemberInsights),
  { ssr: false }
);
const DayVisitModal = dynamic(
  () => import("@/components/developer/day-visit-modal").then((m) => m.DayVisitModal),
  { ssr: false }
);
const NoticeModal = dynamic(
  () => import("@/components/notice/notice-modal").then((m) => m.NoticeModal),
  { ssr: false }
);
const TrustedMembersPanel = dynamic(
  () => import("@/components/trusted-members/trusted-members-panel").then((m) => m.TrustedMembersPanel),
  { ssr: false }
);
// 시청자 화면 미리보기는 '미리보기 켤 때만' 필요한데, PublicPoster(3800줄+)와 poster.css(59KB)가
// 편집실 첫 로딩에 늘 실려 있었다. 동적 import로 빼서 편집실 초기 JS·CSS를 크게 줄인다. 미리보기를
// 처음 켤 때 잠깐 포스터 스켈레톤(콘텐츠가 놓일 자리)을 보여준다 — ssr:false(사용자 동작으로 열림).
const PublicPoster = dynamic(
  () => import("@/components/poster/public-poster").then((m) => m.PublicPoster),
  { ssr: false, loading: () => <CalendarSkeleton variant="poster" /> }
);

type StudioShellProps = {
  actor: CurrentActor;
  schedule: StudioSchedule;
  hasUnlockSession: boolean;
  // 현재 비밀번호가 아직 초기값(0219)인지 — 비번 변경 폼 placeholder 힌트 분기.
  isDefaultPasscode?: boolean;
  // 새로고침 복원용 초기값(서버가 쿠키에서 읽어 넘긴다). 없으면 기본(현재 달/편집실).
  initialView?: { year: number; month: number };
  initialViewerMode?: boolean;
  // 서버 UA 판정 휴대폰 여부 — 모바일 레이아웃을 처음부터 그려 깜빡임을 없앤다(클라가 보정).
  initialNarrow?: boolean;
};

type EventForm = {
  id?: string;
  publicTitle: string;
  endDateKey: string;
  isSupport: boolean;
  isTentative: boolean;
  supportUrl: string;
  category: EventCategory;
  status: EventStatus;
  visibilityScope: EventVisibilityScope;
  tagIds: string[];
  primaryTagIds: string[];
  teaser: boolean; // 떡밥(가림)
  teaserRevealAt: string; // datetime-local 입력값(빈 문자열=미설정)
};

// #2: Ctrl+C로 복사해 둔 일정 내용(날짜·id 제외). 기간은 일수로 저장해 붙여넣는 날짜 기준으로 재계산.
type CopiedEvent = {
  publicTitle: string;
  spanDays: number;
  isSupport: boolean;
  isTentative: boolean;
  supportUrl: string;
  category: EventCategory;
  status: EventStatus;
  visibilityScope: EventVisibilityScope;
  tagIds: string[];
  primaryTagIds: string[];
};

// 통합 실행취소(Ctrl+Z): 일반 편집기처럼 '액션 단위' LIFO 스택. 각 항목이 자기 역연산을 안다.
// - recreate: 삭제를 되돌림 → 보관한 내용으로 다시 만든다.
// - remove: 생성/붙여넣기를 되돌림 → 그때 만든 카드를 지운다. holder.id는 서버가 임시 id를 실제
//   id로 바꿔줄 때 함께 갱신돼, 되돌릴 때 항상 '그 카드'를 정확히 가리킨다.
//   (예전엔 Ctrl+Z가 무조건 '마지막 삭제분'만 되살려, 복사→삭제→붙여넣기→Ctrl+Z 하면 붙여넣은
//   카드가 사라지는 게 아니라 옛 삭제분이 되살아나는 버그가 있었다.)
// - move: 드래그로 옮긴 것을 되돌림 → 원래 날짜·원래 순서로 다시 옮긴다. 이게 없던 시절엔
//   잘못 떨어뜨린 방송이 조용히 다른 날로 가 있고, Ctrl+Z는 엉뚱하게 '그 전 작업'을 되돌렸다
//   (삭제 토스트가 "Ctrl+Z로 되돌리기"라고 학습시켜 놔서 더 나빴다).
type UndoAction =
  | { type: "recreate"; event: StudioScheduleEvent }
  | { type: "remove"; holder: { id: string } }
  | {
      type: "move";
      holder: { id: string };
      fromDate: string;
      toDate: string;
      /** 옮기기 전, 원래 날짜의 카드 순서(그 카드 포함) — 순서까지 그대로 되돌린다. */
      fromOrderedIds: string[];
    };

// 두 YYYY-MM-DD 사이의 일수 차이(later - earlier).
function daysBetweenIso(start: string, end: string): number {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ye, me, de] = end.split("-").map(Number);
  const a = Date.UTC(ys, ms - 1, ds);
  const b = Date.UTC(ye, me - 1, de);
  return Math.round((b - a) / 86400000);
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
// 2계층 태그: 일정 카드 하나에 달 수 있는 콘텐츠 태그 최대 수(카드 색은 대분류로 합쳐 ≤2 표시).
const MAX_EVENT_TAGS = 6;

// 중대한 쓰기(일정 저장/삭제/이동/태그/업도움/잇기)를 keepalive로 보내는 단일 창구.
// keepalive: true 면 페이지를 떠나거나(달 이동·창 전환·닫기·새로고침) 전송이 끝까지 보장된다
// → "바꾸고 바로 나가면 저장 안 됨"을 구조적으로 없앤다. 결과는 기존 서버 액션과 같은 모양
// ({ok,id} / {ok,error})이라 호출부(임시 id 교체·롤백)를 그대로 쓸 수 있다.
type StudioWriteResult = { ok: true; id?: string } | { ok: false; error: string };
async function postStudioWrite(op: string, payload: unknown): Promise<StudioWriteResult> {
  try {
    const res = await fetch("/api/studio-write", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ op, payload })
    });
    const data = (await res.json().catch(() => null)) as StudioWriteResult | null;
    if (data && typeof (data as { ok?: unknown }).ok === "boolean") return data;
    return { ok: false, error: "저장에 실패했어요." };
  } catch {
    return { ok: false, error: "저장에 실패했어요." };
  }
}

// #3: 업 도움 기간 빠른 선택(종료일 = 시작일 + days)
const SUPPORT_DURATIONS = [
  { days: 1, label: "2일" },
  { days: 2, label: "3일" },
  { days: 4, label: "5일" },
  { days: 6, label: "1주" },
  { days: 13, label: "2주" }
];

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return [
    dt.getUTCFullYear(),
    String(dt.getUTCMonth() + 1).padStart(2, "0"),
    String(dt.getUTCDate()).padStart(2, "0")
  ].join("-");
}

// 시작~종료 포함 일수(같은 날=1).
function spanDays(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return Math.round((Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86400000) + 1;
}
// 업 도움 종료일 표시 — "M월 D일 · N일간". 스텝퍼/슬라이더 공용.
function formatSupportEnd(start: string, end: string): string {
  const [, em, ed] = end.split("-").map(Number);
  return `${em}월 ${ed}일 · ${spanDays(start, end)}일간`;
}


const ROLE_LABEL: Record<MembershipRole, string> = {
  owner: "관리자",
  developer: "개발자",
  manager: "매니저",
  worker: "작업자",
  viewer: "시청자"
};

// 비-owner(매니저·작업자) 읽기전용 상세에서 쓰는 평이한 공개 범위 라벨.
// "엠바고"(DB owner_private, 옛 '나만'·'엠바고' 통합)는 소유자 전용. work는 "작업자".
const VISIBILITY_LABEL: Record<EventVisibilityScope, string> = {
  public: "모두",
  embargo: "엠바고",
  work: "작업자",
  owner_private: "엠바고"
};

// A3: 역할 배지의 "?"를 누르면 뜨는 한 줄 책임 + 할 수 있는 것/없는 것. 빈 버튼으로 권한을
// 추론하게 두지 않고, 특히 매니저·작업자가 자기 역할을 바로 이해하게 한다.
const ROLE_DESC: Record<MembershipRole, { summary: string; can: string[] }> = {
  owner: {
    summary: "일정 발행과 전체 관리를 맡아요.",
    can: [
      "일정·태그·멤버·비밀번호 관리",
      "달력 꾸미기 · 달력 이미지 캡쳐",
      "비공개 일정 보기(‘엠바고’ 포함)"
    ]
  },
  developer: {
    summary: "시스템을 유지보수해요.",
    can: [
      "일정·태그·멤버 유지보수",
      "달력 꾸미기 · 달력 이미지 캡쳐",
      "작업자 일정 보기(엠바고 X)"
    ]
  },
  manager: {
    summary: "방송 운영을 도와요.",
    can: ["업 도움 기간·링크 수정", "이미 생성된 일정의 태그 수정", "달력 꾸미기 · 달력 이미지 캡쳐"]
  },
  worker: {
    summary: "꾸미기·제작을 도와요.",
    can: ["스티커·이미지로 달력 꾸미기", "달력 이미지 캡쳐", "작업자 일정 보기(엠바고 X)"]
  },
  viewer: {
    summary: "공개 일정을 봐요.",
    can: ["일정 보기 · 하트 · 업 도움 링크"]
  }
};

// B2: 제목 아래 데스크 라벨 — 역할에 맞춰 "이 화면이 무슨 작업대인지"를 한 줄로. 권한을 빼서가
// 아니라 의도된 역할 화면으로 보이게 한다.
const DESK_LABEL: Record<MembershipRole, string> = {
  owner: "토리님 편집실",
  developer: "개발자 유지보수",
  manager: "매니저 · 방송 운영",
  worker: "작업자 · 제작",
  viewer: "시청자"
};

const SCOPE_LABEL: Record<EventVisibilityScope, string> = {
  public: "모두",
  embargo: "엠바고",
  work: "작업자",
  owner_private: "엠바고"
};

// 색상 필터에 섞어 쓰는 특수 필터 id — 태그가 아니라 "비공개(공개 아님) 일정"을 골라본다.
const PRIVATE_FILTER = "__private__";

// 잠금 해제 직후 router.refresh()로 비공개 일정을 다시 불러올 때, "방금 풀었으니 보여줘"라는 의도를
// 새 렌더(또는 리마운트)까지 전달하기 위한 모듈 플래그. router.refresh()는 같은 JS 컨텍스트라 이 값이
// 유지되지만, 실제 새로고침(F5)은 모듈을 새로 로드해 false로 리셋된다 → 방송사고 방지 규칙(진입 시 공개 기본) 유지.
let pendingUnlockReveal = false;

// YYYY-MM-DD → "M.D" (업 도움 기간 표시용 — 시청자 화면과 동일 형식)
function formatShortDate(value: string) {
  const [, month, day] = value.split("-");
  return `${Number(month)}.${Number(day)}`;
}

export function StudioShell({
  actor,
  schedule,
  hasUnlockSession,
  isDefaultPasscode,
  initialView,
  initialViewerMode = false,
  initialNarrow = false
}: StudioShellProps) {
  const today = getTodayKst();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // 낙관적 화면을 서버 prop이 덮어쓰지 않게 막는 가드. 저장·삭제·태그(pending)나 이동 저장
  // (pendingPersistRef)이 진행 중이면 prop 동기화를 건너뛴다 → '이전 위치로 순간이동' 방지.
  const pendingRef = useRef(false);
  const pendingPersistRef = useRef(0); // 진행 중인 '이동 저장' 수(F5 경고 + prop 동기화 가드)
  const movePersistChainRef = useRef<Promise<void>>(Promise.resolve()); // 이동 저장 직렬화
  // 진행 중인 모든 중대한 쓰기(save/delete/tags/reorder/support/link)의 약속 집합.
  // flushPendingWrites가 이걸 await해 "편집이 DB·캐시에 확실히 반영된 뒤"에만 시청자
  // 미리보기로 넘어가게 한다 → "넘어가서 새로고침 또 해야 보임" 문제를 구조적으로 없앤다.
  const inflightWritesRef = useRef<Set<Promise<StudioWriteResult>>>(new Set());
  // 이벤트별 태그 토글 직렬화 — 빠르게 여러 번 눌러도 '마지막 의도'가 서버 진실이 되게(레이스로
  // 옛 요청이 새 요청을 덮어쓰지 않게). desired=최신 의도, chain=직렬 큐, sent=중복 전송 방지(레퍼런스).
  const tagDesiredRef = useRef<Map<string, string[]>>(new Map());
  const tagWriteChainRef = useRef<Map<string, Promise<void>>>(new Map());
  const tagSentRef = useRef<Map<string, string[]>>(new Map());
  // 첫 진입(스태거)와 달 이동(슬라이드)을 구분 — 실제로 달을 한 번 넘긴 뒤에만 슬라이드를 켠다.
  const didNavigateRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // #10 저장 신뢰: 모든 쓰기가 studioWrite를 거치므로 거기서 상태를 잡아 헤더 칩에 보여준다.
  // idle(아직 저장 없음)·saving(저장 중)·saved(저장됨+KST 시각)·failed(저장 실패).
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [lastSavedKst, setLastSavedKst] = useState<string | null>(null);
  const savingCountRef = useRef(0); // 동시 진행 쓰기 수 — 0이 될 때 최종 상태 확정
  const savingSinceRef = useRef(0); // 저장 묶음 시작 시각(‘저장 중’ 최소 노출)
  const savedTimerRef = useRef<number | null>(null);
  const editedSinceSyncRef = useRef(false); // 마지막 서버 새로고침 이후 편집이 있었나(미리보기 새로고침 판단)
  function nowKstHm(): string {
    return new Date().toLocaleTimeString("ko-KR", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  }
  // Ctrl+S로 저장할 카드가 없을 때(이미 다 저장됨) — 저장중→저장됨을 잠깐 보여 '저장됐다'를 확인시킨다.
  // 진행 중인 실제 저장이 있으면 그쪽 표시를 건드리지 않는다.
  function flashSavedChip(): void {
    if (savingCountRef.current > 0) return;
    if (savedTimerRef.current) {
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    setSaveState("saving");
    savedTimerRef.current = window.setTimeout(() => {
      if (savingCountRef.current === 0) {
        setSaveState("saved");
        setLastSavedKst(nowKstHm());
      }
      savedTimerRef.current = null;
    }, 600);
  }
  // 저장 상태 칩 — 데스크톱 헤더·모바일 역할바 양쪽에서 같은 모양으로 쓴다.
  function renderSaveStatus() {
    return (
      <span
        className={`save-status ${saveState}`}
        aria-live="polite"
        title={
          saveState === "failed"
            ? "저장에 실패했어요. 잠시 후 다시 시도해 주세요"
            : saveState === "saving"
              ? "저장 중이에요"
              : lastSavedKst
                ? `마지막 저장 ${lastSavedKst} KST`
                : "변경사항이 저장돼 있어요"
        }
      >
        <span className="ss-dot" aria-hidden="true" />
        <em>
          {saveState === "saving" ? "저장 중…" : saveState === "failed" ? "저장 실패" : "저장됨"}
        </em>
        {saveState === "saved" && lastSavedKst ? <b className="ss-time">{lastSavedKst}</b> : null}
      </span>
    );
  }
  // 비밀번호 확인 후 팝업이 닫히고 비공개 일정이 서버에서 다시 불러와지는 동안 "불러오는 중" 표시.
  const [loadingPrivate, startLoadingPrivate] = useTransition();
  // 페이지 이동(꾸미기·계정 변경 등)은 서버 왕복이라 즉시 안 바뀐다 → 눌렀다는 신호를 띄운다.
  const [navMsg, setNavMsg] = useState<string | null>(null);
  function startNav(message: string) {
    setNavMsg(message);
    // 이동이 실패/취소돼 화면이 안 바뀌는 경우를 대비한 안전 해제(보통은 이동하며 언마운트됨).
    window.setTimeout(() => setNavMsg(null), 8000);
  }
  // 모바일 아젠다 월 전환 방향(시청자 화면과 동일한 슬라이드 애니메이션용).
  const [monthDir, setMonthDir] = useState<"next" | "prev">("next");
  // 방송사고 방지: 새로고침/진입 시 항상 공개(일반) 모드가 기본. 잠금 세션이 있어도
  // 사용자가 직접 토글해야 비공개 일정이 보인다.
  const [showPrivate, setShowPrivate] = useState(false);
  // 비밀번호 팝업은 다른 모달(인사이트 등) '위에' 따로 띄우는 독립 오버레이다 → 인사이트를 닫지 않으니
  // 취소 시 리로드 없이 그 보안 패널이 그대로 남는다. "unlock"=잠금 해제, "change"=비밀번호 변경.
  const [passcodeModal, setPasscodeModal] = useState<"unlock" | "change" | null>(null);
  // 방금 잠금 해제했다면(=pendingUnlockReveal), refresh로 세션이 반영(hasUnlockSession=true)되는
  // 즉시 비공개 표시를 켠다. refresh 과정에서 showPrivate 상태가 유실되더라도 확실히 다시 켜진다.
  useEffect(() => {
    if (pendingUnlockReveal && hasUnlockSession) {
      pendingUnlockReveal = false;
      setShowPrivate(true);
    }
  }, [hasUnlockSession]);
  const [modal, setModal] = useState<null | "tags" | "members" | "notice" | "developer" | "dayVisit">(
    null
  );
  // 빠른 휴방: 날짜 우클릭/롱프레스로 뜨는 미니 메뉴(화면 좌표 + 그 날 휴방 여부).
  const [restMenu, setRestMenu] = useState<
    { isoDate: string; x: number; y: number; hasRest: boolean } | null
  >(null);
  // 떡밥 공개시각 선택기(날짜·시간 팝업) 열림 — 모바일 뒤로가기 스택에 한 층으로 넣어, 뒤로가기 때
  // 이 팝업만 닫히고 새 일정 편집 카드로 돌아오게 한다(편집 카드까지 닫히지 않게).
  const [teaserPickerOpen, setTeaserPickerOpen] = useState(false);
  // 공개 범위 + 옵션(미정·업도움·떡밥) 묶음은 기본으로 접혀 있다 — 대부분의 일정이 '모두 공개 +
  // 옵션 없음'이라 매번 펼칠 이유가 없다. 접힌 상태에서도 헤더 요약으로 현재 값이 보인다.
  const [scopeFoldOpen, setScopeFoldOpen] = useState(false);
  // 단축키 안내바는 기본으로 접어 달력을 더 넓게 본다 — '단축키 설명' 탭을 누르면 펼쳐진다.
  const [kbdHintsOpen, setKbdHintsOpen] = useState(false);
  const backdropPressRef = useRef(false); // 모달 배경 클릭 판정(텍스트 드래그 보호)
  // 새 일정 저장 진행 중인 임시 id → 실제 id 약속. 저장 직후 바로 "잇기"를 눌러도 temp id가
  // 서버로 새는 일 없이(=invalid uuid 방지), 저장이 끝나길 기다렸다 실제 id로 잇는다.
  const pendingSavesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  // 저장 끝난 temp → 실제 id 매핑(영구). 저장이 끝나면 pendingSaves 약속은 지워지므로, 저장 직후
  // 삭제하면 resolveEventId가 약속을 못 찾아 null→서버 삭제 누락(=재방문 시 부활)했다. 그래서
  // 실제 id를 따로 보관해, 저장된 temp는 언제든 실제 id로 해석되게 한다.
  const tempToRealRef = useRef<Map<string, string>>(new Map());
  // 전역 직렬 쓰기 체인 — 저장중에 한 후속 동작(삭제·수정·이동·잇기 등)도 거부/레이스 없이
  // '제출한 순서대로' 서버에 반영된다. 즉 1→…→n번 순서로 적용한 최종 결과가 서버 진실이 된다.
  // (낙관적 화면 갱신은 즉시, 서버 전송만 직렬화. 앞 쓰기가 실패해도 체인은 끊기지 않고 다음을 잇는다.)
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  // 통합 실행취소 스택(삭제·생성·붙여넣기 등 '되돌릴 수 있는 액션'을 LIFO로 보관).
  const deletedStackRef = useRef<UndoAction[]>([]);
  // temp id면 저장 약속을 기다려 실제 id로, 실패면 null. 실제 id는 그대로. (null이 새어와도 방어.)
  async function resolveEventId(id: string | null | undefined): Promise<string | null> {
    if (!id) return null;
    if (!id.startsWith("temp-")) {
      return id;
    }
    // 이미 저장돼 실제 id를 아는 temp면 그대로 돌려준다(약속이 정리됐어도 안전).
    const known = tempToRealRef.current.get(id);
    if (known) return known;
    const p = pendingSavesRef.current.get(id);
    return p ? await p : null;
  }
  // 모든 중대한 쓰기는 이 래퍼를 거친다. task를 '제출한 순서대로' 직렬 실행한다(전역 체인).
  // 클릭한 순서 = 서버 적용 순서. id 해석(temp→real)도 task '안'에서 하므로, 앞 작업을 기다리느라
  // 순서가 뒤집히지 않는다(예: 1 저장중에 2 삭제, 3 저장 → 항상 1·2·3 순). 진행 중 약속은 inflight에
  // 등록/해제해 flushPendingWrites가 끝까지 기다릴 수 있게 한다. task가 null을 주면 보낼 게 없다는 뜻.
  function enqueueWrite(
    task: () => Promise<StudioWriteResult | null>
  ): Promise<StudioWriteResult> {
    if (savingCountRef.current === 0) {
      savingSinceRef.current = Date.now(); // 이번 저장 묶음 시작 시각(최소 노출 시간 계산용)
    }
    if (savedTimerRef.current) {
      window.clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
    savingCountRef.current += 1;
    editedSinceSyncRef.current = true; // 이후 미리보기 진입 시 서버를 새로 불러오게 표시
    // 'saving'을 setTimeout(0)으로 트랜지션 밖에서 칠한다 — 새 일정 저장은 startTransition 안에서
    // 불려 setState가 트랜지션(비긴급)으로 묶이는 바람에 빠른 저장에선 '저장 중'이 아예 안 칠해졌다.
    window.setTimeout(() => {
      if (savingCountRef.current > 0) setSaveState("saving");
    }, 0);
    // 직렬화: 앞 task가 끝난 뒤 이 task를 실행. 앞이 실패/거부돼도 이 task는 그대로 잇는다(거부
    // 전파 안 함). task가 null이면 보낼 게 없으니 성공으로 본다(롤백 안 함).
    const p: Promise<StudioWriteResult> = writeChainRef.current.then(async () => {
      const r = await task();
      return r ?? { ok: true, id: "" };
    });
    writeChainRef.current = p.then(
      () => undefined,
      () => undefined
    );
    inflightWritesRef.current.add(p);
    // 낙관적 저장은 너무 빨라(특히 새 일정 생성) '저장 중'이 안 보일 수 있다 → 최소 ~450ms 노출.
    const settleSaved = () => {
      if (savingCountRef.current !== 0) return;
      const elapsed = Date.now() - savingSinceRef.current;
      if (elapsed >= 700) {
        setSaveState("saved");
      } else {
        savedTimerRef.current = window.setTimeout(() => {
          if (savingCountRef.current === 0) setSaveState("saved");
        }, 700 - elapsed);
      }
    };
    void p.then(
      (r) => {
        savingCountRef.current = Math.max(0, savingCountRef.current - 1);
        if (!r.ok) {
          setSaveState("failed"); // 실패는 칩에 빨갛게 + 호출부가 inline 경고도 띄운다(#12)
        } else {
          setLastSavedKst(nowKstHm());
          if (savingCountRef.current === 0) settleSaved();
        }
      },
      () => {
        savingCountRef.current = Math.max(0, savingCountRef.current - 1);
        setSaveState("failed");
      }
    ).finally(() => inflightWritesRef.current.delete(p));
    return p;
  }
  // op/payload가 고정된(temp id 해석이 필요 없는) 일반 쓰기 — 그대로 큐에 올린다.
  function studioWrite(op: string, payload: unknown): Promise<StudioWriteResult> {
    return enqueueWrite(() => postStudioWrite(op, payload));
  }
  // 진행 중인 모든 쓰기(이동 큐 + inflight 집합)가 서버에 반영될 때까지 기다린다.
  // 각 쓰기 액션은 완료 시 revalidatePublicSchedule(태그 무효화)를 호출하므로, flush가 끝난
  // 직후 router.refresh()를 하면 시청자 묶음(getPublicSchedule)이 새로 계산돼 최신이 보인다.
  async function flushPendingWrites() {
    // 이동 큐가 도는 동안 새 inflight가 생기므로 몇 번 반복해 완전히 비운다(상한으로 무한 방지).
    for (let i = 0; i < 6; i++) {
      try {
        await movePersistChainRef.current;
      } catch {
        /* 개별 실패는 무시 — 목적은 '대기'다 */
      }
      if (inflightWritesRef.current.size === 0) break;
      await Promise.allSettled([...inflightWritesRef.current]);
    }
  }
  // 시청자 화면 미리보기로 넘어갈 때: 먼저 진행 중 편집을 모두 반영(flush)한 뒤 서버를 새로
  // 불러온다 → 미리보기가 'DB 진실 = 실제 시청자가 볼 것'과 항상 일치한다(추가 새로고침 불필요).
  function enterViewerMode() {
    // 이번 세션에 편집이 한 번이라도 있었으면(진행 중이든, 방금 끝났든) 서버를 새로 불러와
    // 미리보기가 최신과 일치하게 한다. 예전엔 '지금 진행 중'만 봐서, '저장됨'까지 기다린 뒤 미리보기를
    // 누르면 refresh를 건너뛰어 옛 상태가 보였다(수동 새로고침 필요했던 버그). 편집이 전혀 없으면
    // refresh를 생략해 돌아올 때 깜빡임을 피한다.
    const needsRefresh =
      editedSinceSyncRef.current ||
      pendingRef.current ||
      pendingPersistRef.current > 0 ||
      inflightWritesRef.current.size > 0;
    setViewerMode(true);
    void (async () => {
      await flushPendingWrites();
      if (needsRefresh) {
        router.refresh();
        editedSinceSyncRef.current = false;
      }
    })();
  }
  // 시청자 공개 화면 전체보기 (팝업이 아니라 화면 전체를 교체)
  const [viewerMode, setViewerMode] = useState(initialViewerMode);
  // 모바일(좁은 화면): 편집실을 아젠다(목록) + 인라인 편집 형태로 전환한다.
  const [isNarrow, setIsNarrow] = useState(initialNarrow);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  // 모바일에서 일정 카드를 눌렀을 때 펼치는 인라인 편집 시트(소유자/개발자).
  const [mobileEditId, setMobileEditId] = useState<string | null>(null);
  // 모바일 일정 내용칸: 내용량에 맞춰 높이를 자동으로 맞춘다(처음 열 때 긴 내용도 한 번에 보이게).
  // 사용자가 손잡이로 더 늘리는 것(resize:vertical)도 그대로 가능.
  const mTitleRef = useRef<HTMLTextAreaElement>(null);
  // 데스크톱 편집 패널의 제목칸 — 일정 선택 후 글자 키를 누르면 바로 여기로 포커스를 옮긴다.
  const editorTitleRef = useRef<HTMLTextAreaElement>(null);
  function fitTitleHeight() {
    const el = mTitleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }
  // 시트가 열릴 때(또는 다른 일정으로 바뀔 때) 현재 내용 높이에 맞춘다 — 페인트 전(useLayoutEffect)이라 깜빡임 없음.
  useLayoutEffect(() => {
    if (mobileEditId !== null) fitTitleHeight();
  }, [mobileEditId]);
  // #3 키보드 가림 방지: 모바일 키보드가 뜨면 dvh로는 시트 하단(저장 버튼)이 키보드 뒤로 숨는다.
  // visualViewport로 '실제 보이는' 높이·위치를 잡아 시트 컨테이너를 키보드 바로 위에 맞춰 → 저장
  // 버튼이 항상 보인다. 시트가 닫히면 해제(null).
  const [vvFit, setVvFit] = useState<{ h: number; top: number } | null>(null);
  useEffect(() => {
    if (mobileEditId === null) {
      setVvFit(null);

      return;
    }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setVvFit({ h: vv.height, top: vv.offsetTop });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [mobileEditId]);
  // 업 도움 종료일을 손가락으로 좌우로 밀어 빠르게 바꾸는 스크럽 상태(드래그 시작점 + 그때 종료일).
  const dateScrubRef = useRef<{ x: number; end: string } | null>(null);
  // 스크럽(미는) 중인지 — 값 칩에 확대·발광 애니메이션을 줘서 "조정 중"을 한눈에 알린다.
  const [dateScrubbing, setDateScrubbing] = useState(false);
  // 신뢰 멤버(매니저·작업자)가 기존 업 도움의 기간·링크만 고치는 전용 시트(웹·모바일 공용).
  const [supportSheetId, setSupportSheetId] = useState<string | null>(null);
  const [supportSaving, setSupportSaving] = useState(false);
  // 모바일에서 매니저가 일정의 태그만 고치는 전용 시트(데스크톱 읽기전용 상세의 태그 편집과 동치).
  const [tagSheetId, setTagSheetId] = useState<string | null>(null);
  // 즐거운 모션: 방금 저장·생성된 카드는 통통 착지하며 반짝(just-saved), 삭제되는 카드는
  // 톡 줄어들며 사라진다(deleting). 둘 다 "내가 누른 게 먹혔다"는 확신을 준다.
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const justSavedTimer = useRef<number | null>(null);
  // 저장 시 카드뿐 아니라 편집 패널도 살짝 반짝여 '저장됨'을 더 확실히 알린다.
  const [panelSaved, setPanelSaved] = useState(false);
  const panelSavedTimer = useRef<number | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());
  // 첫 진입(스켈레톤 직후) 한 번만 날짜칸·일정이 차르륵 순차로 등장하게 한다. 달 이동은 기존
  // 슬라이드 그대로 — 그래서 첫 등장에선 컨테이너 슬라이드를 끄고 칸 스태거로 대체한다.
  const firstLoadRef = useRef(true);
  const isFirstReveal = firstLoadRef.current;
  useEffect(() => {
    const t = window.setTimeout(() => {
      firstLoadRef.current = false;
    }, 1800);
    return () => window.clearTimeout(t);
  }, []);
  // 모바일 하단 관리(태그·멤버) 펼침 상태.
  const [mobileMgmt, setMobileMgmt] = useState<null | "tags" | "members">(null);
  // 일정은 로컬 상태로 들고 낙관적으로 갱신한다 — 잇기·복붙·저장·삭제가 서버 왕복/새로고침을
  // 기다리지 않고 화면에 즉시 반영되게 해서 "하는 맛"을 살린다. 서버 데이터가 바뀌면 다시 맞춘다.
  const [events, setEvents] = useState(schedule.events);
  useEffect(() => {
    // 저장·삭제·이동이 진행 중이면 서버 prop이 낙관적 화면을 덮어써 카드가 '이전 위치로
    // 순간이동'하던 문제를 막는다. 작업이 끝난 뒤(idle)의 prop 변화에서만 서버 데이터로 맞춘다.
    if (pendingRef.current || pendingPersistRef.current > 0 || inflightWritesRef.current.size > 0)
      return;
    setEvents(schedule.events);
  }, [schedule.events]);
  // pending(저장/삭제/태그 진행)을 ref로 미러링 — 위 prop 동기화 가드가 deps 없이 읽게.
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);
  // 중대한 변경(생성·삭제·편집·태그·이동)이 아직 서버에 안 들어갔는데 새로고침/닫기 하면
  // "분명 지웠는데 다시 생겨있네?" 같은 불일치가 난다 → 그 짧은 진행 중에만 한 번 경고한다.
  // (idle일 땐 절대 안 뜨므로 평소엔 방해 없음.)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingRef.current || pendingPersistRef.current > 0 || inflightWritesRef.current.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);
  // 태그·색 팔레트도 로컬 상태로 — 추가/삭제/저장을 새로고침 없이 즉시 반영(달력 색도 바로 갱신).
  const [tags, setTags] = useState(schedule.tags);
  const [palette, setPalette] = useState(schedule.palette);
  // events와 같은 가드가 필요하다(위 672-678 참고): 태그 이름변경·재채색·삭제도 낙관적으로 먼저
  // 반영하는데, 그 사이 router.refresh()가 착지하면 서버 prop이 방금 바꾼 값을 옛 값으로 되돌려
  // 깜빡였다. 진행 중(in-flight)엔 서버 prop을 무시하고, idle일 때만 맞춘다.
  useEffect(() => {
    if (pendingRef.current || pendingPersistRef.current > 0 || inflightWritesRef.current.size > 0)
      return;
    setTags(schedule.tags);
  }, [schedule.tags]);
  useEffect(() => {
    if (pendingRef.current || pendingPersistRef.current > 0 || inflightWritesRef.current.size > 0)
      return;
    setPalette(schedule.palette);
  }, [schedule.palette]);
  // 색상 안내 필터 — 편집실에서도 특정 태그 색만 골라볼 수 있게(시청자 화면과 동일 동작).
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  function toggleTagFilter(id: string) {
    hapticTick(); // 셀렉터 손맛(Android만; iOS·미지원은 조용히 무시)
    setTagFilters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function isDimmedByFilter(event: StudioScheduleEvent) {
    if (tagFilters.length === 0) return false;
    const matchesPrivate =
      tagFilters.includes(PRIVATE_FILTER) && event.visibilityScope !== "public";
    // 2계층: 대분류 필터는 그 하위 세부를 가진 이벤트까지 포함(전체집합 매칭).
    const matchesTag = tagFilters.some(
      (id) => id !== PRIVATE_FILTER && eventMatchesTagFilter(event, id, viewTags)
    );
    return !(matchesPrivate || matchesTag);
  }

  // 카드 클릭 = 그 일정을 선택(편집)한다. 잇기는 드래그-놓기, 끊기는 이음새 '칼로 긋기'로만 —
  // 클릭은 어느 쪽도 하지 않는다(제목 편집하려 카드를 오갈 때 실수로 붙거나 끊기던 문제 제거).
  function handlePillClick(eventId: string) {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;
    selectEvent(target);
  }

  // 이음새 '칼로 긋기': 손잡이를 눌러 threshold 이상 그으면 그 연결(earlier.linkNext)만 끊는다.
  // 단순 클릭(움직임 없음)은 아무 일도 안 한다 → 제목 편집 중 실수 끊김 방지.
  function performSeamCut(earlierId: string) {
    if (!canEdit) return;
    const earlier = events.find((e) => e.id === earlierId);
    if (!earlier || !earlier.linkNext) return;
    const snapshot = events;
    setEvents((prev) => prev.map((e) => (e.id === earlierId ? { ...e, linkNext: undefined } : e)));
    setActionError(null);
    hapticTick();
    flashToast("싹둑 — 연결을 끊었어요");
    setCutFlashId(earlierId);
    if (cutFlashTimer.current) window.clearTimeout(cutFlashTimer.current);
    cutFlashTimer.current = window.setTimeout(() => setCutFlashId(null), 480);
    void (async () => {
      const result = await enqueueWrite(async () => {
        const realId = await resolveEventId(earlierId);
        if (!realId) {
          setEvents(snapshot);
          return null;
        }
        return postStudioWrite("unlinkPair", { earlierId: realId });
      });
      if (!result.ok) {
        setActionError(result.error);
        setEvents(snapshot);
      }
    })();
  }

  const [view, setView] = useState(
    initialView ?? {
      year: schedule.calendar.defaultYear,
      month: schedule.calendar.defaultMonth
    }
  );
  const [selectedDate, setSelectedDate] = useState(() => {
    // 복원된(또는 기본) 표시 달이 "이번 달"이면 오늘 날짜 칸을, 아니면 그 달 1일을 선택한다.
    const y = initialView?.year ?? schedule.calendar.defaultYear;
    const m = initialView?.month ?? schedule.calendar.defaultMonth;
    const ym = `${y}-${String(m).padStart(2, "0")}`;
    return today.startsWith(`${ym}-`) ? today : `${ym}-01`;
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // 보던 달·시청자 미리보기 상태를 쿠키에 기록 → 새로고침 때 서버가 읽어 그대로 복원.
  // 초기값이 이미 쿠키에서 온 값이라 첫 기록은 같은 값(무해) — 덮어쓰기 걱정 없음.
  useEffect(() => {
    writeViewCookie({ sy: view.year, sm: view.month, v: viewerMode ? 1 : 0 });
  }, [view, viewerMode]);

  // 새 일정/일정 수정 카드는 달력에서 날짜(또는 일정)를 "선택했을 때"만 보여준다.
  // 편집실 진입 시엔 카드를 띄우지 않고, 칸을 클릭하면 그제서야 나온다.
  const [editorVisible, setEditorVisible] = useState(false);
  // 편집 폼의 remount 키 — '사용자가 명시적으로 다른 날짜/일정을 고를 때'만 올린다(selectDate·
  // selectEvent·moveMonth). 저장·삭제 같은 내부 상태 변화로는 안 올려서 폼이 다시 마운트되지(깜빡이지)
  // 않게 한다. (이전엔 key가 selectedEventId라 저장 시 null로 바뀌며 폼이 깜빡였다.)
  const [editorKey, setEditorKey] = useState(0);
  const bumpEditor = () => setEditorKey((k) => k + 1);

  // 개발자 전용 "역할 미리보기"(보기 전용). 클라이언트 한정 — 쿠키/라우트는 절대 안 건드린다.
  // previewRole이 있으면 UI를 그 역할처럼 그린다(데이터·서버 권한은 그대로, 변경은 차단).
  // 새로고침하면 자동 해제(SSR은 항상 실제 역할로 렌더)되어 라우팅/쿠키 엉킴이 없다.
  const isDeveloper = actor.role === "developer";
  const [previewRole, setPreviewRole] = useState<MembershipRole | null>(null);
  // 이중 역할(매니저·작업자) 미리보기 — 미리보기는 단일 역할이라, 이중은 previewRole="manager"에
  // 이 플래그를 더해 "매니저 권한 + 작업자 비공개 접근 + 매니저·작업자 라벨"로 그린다.
  const [previewDual, setPreviewDual] = useState(false);
  const [previewMenuOpen, setPreviewMenuOpen] = useState(false);
  const effectiveRole: MembershipRole = previewRole ?? actor.role;
  // 미리보기 화면이 보는 역할이 관리자인가(관리자 본인 + "관리자 미리보기" 둘 다 포함).
  const isEffectivelyOwner = effectiveRole === "owner";
  // 편집실 아바타 자리 — 시청자와 같이 보며 작업할 때를 위해 편집실(작업화면)에도 우측/좌측 1/4
  // 아바타 자리를 둔다(관리자·개발자, 데스크탑). 시청자 미리보기 토글과 같은 localStorage 키 공유.
  // 편집실 아바타 자리는 ≥1100px에서만(좁으면 달력 가독성 우선). 필터가 rail로 가므로 viewport
  // 폭을 React가 알아야 깔끔히 끌 수 있다(CSS만으론 rail의 필터를 그리드로 못 되돌림).
  const [avatarWideEnough, setAvatarWideEnough] = useState(true);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1100px)");
    const sync = () => setAvatarWideEnough(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  // 아바타 자리는 관리자(owner)·개발자만. 개발자가 매니저/작업자/시청자로 '미리보기' 중이면
  // 그 역할엔 안 보여야 하므로 raw isDeveloper가 아니라 effectiveRole로 판정.
  const avatarRoleOk = effectiveRole === "owner" || effectiveRole === "developer";
  const avatarEditor = avatarRoleOk && !isNarrow && avatarWideEnough;
  const [avatarOn, setAvatarOn] = useState(true);
  // 최초(메모리 없음) 디폴트는 '왼쪽', 이후엔 마지막 값(편집실·미리보기 공유) 복원.
  const [avatarSide, setAvatarSide] = useState<"left" | "right">("left");
  // localStorage(켜짐 여부)를 읽기 전엔 scene을 렌더하지 않는다 — 기본값(켜짐)으로 한 번 그렸다가
  // 저장값(꺼짐)으로 되돌리며 0.x초 깜빡이던 문제. useLayoutEffect라 '페인트 전'에 확정돼(SSR HTML은
  // scene OFF 기준 → 하이드레이션 일치) 켜짐·꺼짐 어느 쪽도 한 프레임도 안 깜빡인다.
  const [avatarStorageRead, setAvatarStorageRead] = useState(false);
  useLayoutEffect(() => {
    if (!avatarEditor || typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem("vic_avatar_on") === "0") setAvatarOn(false);
      if (window.localStorage.getItem("vic_avatar_side") === "right") setAvatarSide("right");
    } catch {
      /* 저장소 불가 무시 */
    }
    setAvatarStorageRead(true);
  }, [avatarEditor]);
  function toggleAvatarOn() {
    hapticTick();
    setAvatarOn((v) => {
      const next = !v;
      try {
        window.localStorage.setItem("vic_avatar_on", next ? "1" : "0");
      } catch {
        /* 무시 */
      }
      return next;
    });
  }
  function pickAvatarSide(side: "left" | "right") {
    hapticTick();
    setAvatarSide(side);
    try {
      window.localStorage.setItem("vic_avatar_side", side);
    } catch {
      /* 무시 */
    }
  }
  const avatarSceneOn = avatarEditor && avatarOn && avatarStorageRead;
  // 새로고침 직후 슬라이드/등장 애니가 한 번 튀는 것 방지 — 마운트 전엔 애니 끄고, 마운트 후 켠다
  // (이후 사용자 토글에서만 통통 애니).
  const [avatarReady, setAvatarReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAvatarReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  // 인사이트: 개발자(실제, 미리보기 아님)는 전체(8패널·수치), 그 외 관리자·매니저·작업자(또는 그
  // 역할 미리보기)는 수치 없는 4패널(멤버 인사이트)을 본다. 시청자는 인사이트 없음.
  const isDevInsights = isDeveloper && !previewRole;
  const canMemberInsights =
    !isDevInsights &&
    (effectiveRole === "owner" || effectiveRole === "manager" || effectiveRole === "worker");

  const canEdit = canEditSchedule(effectiveRole);
  const canDecorateCalendar = canDecorate(effectiveRole);
  // 매니저(방송 운영)는 업 도움 기간/링크 수정 가능, 작업자(worker)는 읽기 전용.
  const canEditSupportThing = canEditSupport(effectiveRole);
  // 매니저는 일정별 태그 할당도 편집할 수 있다(태그 자체 생성/삭제는 여전히 관리자/개발자 전용).
  const canEditTagsThing = canEditEventTags(effectiveRole);
  // 비공개 레이어 사용 자격(소유자/개발자/작업자). 매니저는 비공개를 전혀 못 본다. 미리보기 중엔
  // 미리보기 역할 기준, 평소엔 실제 작업자 겸직(actor.isWorker)도 인정한다.
  const effIsWorker = previewDual
    ? true
    : previewRole
      ? effectiveRole === "worker"
      : actor.isWorker === true;
  const canTogglePrivateLayer = canUsePrivateLayer(effectiveRole, effIsWorker);

  // 이중 역할(매니저+작업자)은 실제 계정이 둘 다일 때만(미리보기 중엔 단일 역할로 본다).
  const isDualRole = previewDual || (!previewRole && Boolean(actor.isManager && actor.isWorker));

  // 단계 배포: v3 역할(현재 개발자만)은 분류 v3(세부·modifier·신설 그룹)를 그대로 본다. 그 외(관리자·
  // 매니저·작업자·시청자, 또는 개발자가 그 역할로 미리보기)는 레거시 뷰(세부 나누기 이전)로 본다.
  // 렌더·피커·레전드·필터에는 viewTags를, 태그 '정의 편집'(TagLegendEditor)에는 원본 tags를 쓴다.
  const taxonomyV3 = isTaxonomyV3(effectiveRole);
  const viewTags = useMemo(
    () => (taxonomyV3 ? tags : legacyTagView(tags)),
    [tags, taxonomyV3]
  );
  // 0A: 태그 색 계산 단일 진입점(포스터와 동일). 칸색/점줄은 resolver로 — 내부는 기존 로직과
  // 동일(픽셀 불변). 커스텀 색(bg_hex)은 나중에 이 안에서만 얹는다.
  const tagVisual = useMemo(() => createTagVisualResolver(viewTags, palette), [viewTags, palette]);
  // 레거시(세부 나누기 이전)는 카드당 태그 2개까지. v3는 6개(MAX_EVENT_TAGS).
  const maxEventTags = taxonomyV3 ? MAX_EVENT_TAGS : 2;
  // "기타" 태그는 색상 안내·태그 선택 모두에서 항상 맨 끝.
  const legendTags = useMemo(
    () =>
      [...viewTags].sort(
        (a, b) => Number(a.displayName === "기타") - Number(b.displayName === "기타")
      ),
    [viewTags]
  );
  // 모바일은 "달력 꾸미기"가 PC 전용이라 진입을 숨긴다 → 역할 설명에서도 꾸미기·달력 이미지 저장
  // 관련 항목을 빼서, 폰에서 못 하는 걸 할 수 있다고 안내하지 않게 한다.
  const dropDecorate = (items: string[]) =>
    isNarrow ? items.filter((c) => !c.includes("꾸미기") && !c.includes("달력 이미지")) : items;
  const roleDisplay = isDualRole
    ? {
        label: "매니저 · 작업자",
        // 모바일 레일(92px)에선 배지가 색상 필터 폭을 넘지 않게 짧게. 팝오버 제목은 full(label).
        badgeLabel: "매니저+",
        summary: isNarrow ? "방송 운영을 도와요." : "방송 운영과 꾸미기를 함께 도와요.",
        can: dropDecorate([
          "업 도움 기간·링크 수정",
          "이미 생성된 일정의 태그 수정",
          "스티커·이미지로 달력 꾸미기 · 달력 이미지 캡쳐",
          "작업자 일정 보기(엠바고 X)"
        ])
      }
    : {
        label: ROLE_LABEL[effectiveRole],
        badgeLabel: ROLE_LABEL[effectiveRole],
        summary:
          isNarrow && effectiveRole === "worker"
            ? "제작을 도와요."
            : ROLE_DESC[effectiveRole].summary,
        can: dropDecorate(ROLE_DESC[effectiveRole].can)
      };
  const deskLabel = isDualRole ? "매니저 · 작업자" : DESK_LABEL[effectiveRole];
  // A3: 역할 배지 "?" 도움말 팝오버 열림 상태.
  const [roleHelpOpen, setRoleHelpOpen] = useState(false);
  // 진동(햅틱) 설정 토글 — navigator.vibrate 지원 기기(안드로이드)에서만 노출. SSR 불일치 방지로
  // 마운트 후 지원 여부/현재값을 읽는다(기본 ON). 끄면 앱 전체 진동이 조용해진다(스위치보드 기준).
  const [hapticsSupported, setHapticsSupported] = useState(false);
  const [hapticsOn, setHapticsOn] = useState(true);
  useEffect(() => {
    // 진동은 Android(Chrome/삼성)에서만 실제로 울린다. iOS는 'vibrate' 자체가 없어 이미 제외되지만,
    // 데스크톱 Chrome은 'vibrate'가 있으되 무동작 → 웹에선 토글이 무의미하므로 Android에서만 노출.
    const supported =
      typeof navigator !== "undefined" && "vibrate" in navigator && detectDevice() === "android";
    setHapticsSupported(supported);
    if (supported) setHapticsOn(hapticsEnabled());
  }, []);
  const toggleHaptics = () => {
    const next = !hapticsOn;
    setHapticsEnabled(next); // localStorage(vic.haptics)에 먼저 반영
    setHapticsOn(next);
    if (next) hapticTick(); // 켜는 순간 한 번 울려 "이렇게 울려요"를 바로 체감
  };
  // #5/#6 동작 줄이기 — 장식용 반복 모션을 끈다(눈 피로↓). 기기 무관(모든 역할 노출).
  const [reduceMotion, setReduceMotionState] = useState(false);
  useEffect(() => {
    setReduceMotionState(reduceMotionEnabled());
  }, []);
  const toggleReduceMotion = () => {
    const next = !reduceMotion;
    setReduceMotion(next); // localStorage(vic.reduceMotion) + <html data-reduce-motion> 즉시 반영
    setReduceMotionState(next);
    hapticTick();
  };
  // #28 눈 편한 테마 — 채도·눈부심을 낮춘다(오래 보는 작업자용).
  const [eyeComfort, setEyeComfortState] = useState(false);
  useEffect(() => {
    setEyeComfortState(eyeComfortEnabled());
  }, []);
  const toggleEyeComfort = () => {
    const next = !eyeComfort;
    setEyeComfort(next);
    setEyeComfortState(next);
    hapticTick();
  };
  const canReadPrivate =
    canReadPrivateLayer(effectiveRole, effIsWorker, hasUnlockSession) && showPrivate;


  // 미리보기 중 변경 차단(보기 전용). 막았으면 true. (문구는 짧게 — 모바일 컴팩트.)
  function blockedByPreview(): boolean {
    if (previewRole) {
      flashToast("미리보기 중엔 변경 불가");
      return true;
    }
    return false;
  }
  // 역할 미리보기 적용/해제. 시청자는 기존 viewerMode 경로 재사용, 나머지는 previewRole.
  function applyPreview(role: MembershipRole | "" | "dual") {
    setRoleHelpOpen(false);
    if (role === "dual") {
      // 이중(매니저·작업자): 매니저 권한 베이스 + 작업자 비공개 접근(effIsWorker)로 그린다.
      setViewerMode(false);
      setPreviewRole("manager");
      setPreviewDual(true);
      return;
    }
    setPreviewDual(false);
    if (role === "" || role === effectiveRole) {
      setPreviewRole(null);
      setViewerMode(false);
      return;
    }
    if (role === "viewer") {
      setPreviewRole(null);
      enterViewerMode();
      return;
    }
    setViewerMode(false);
    setPreviewRole(role);
  }
  // 개발자 전용 통합 미리보기 드롭다운(커스텀 — 주변 pill 버튼과 통일). 트리거가 곧 현재 상태
  // 표시(미리보기 중이면 "○○ 화면" + 강조색), 메뉴 맨 위 "개발자 화면"이 복귀. 헤더에만 둔다.
  function renderPreviewControl() {
    const options: { value: MembershipRole | "" | "dual"; label: string }[] = [
      { value: "", label: "개발자 화면" },
      { value: "owner", label: "관리자 화면" },
      { value: "manager", label: "매니저 화면" },
      { value: "worker", label: "작업자 화면" },
      { value: "dual", label: "매니저 · 작업자 화면" },
      { value: "viewer", label: "시청자 화면" }
    ];
    // 미리보기 중엔 트리거를 "그 역할 화면에 실제로 있는 버튼"(= 비개발자의 시청자 화면 버튼)으로
    // 위장한다 — 역할별 디자인·너비를 그대로 확인하려고. 모바일 "시청자 화면" / 웹 "시청자 화면 미리보기",
    // 세모(▾)도 숨긴다. 단 개발자가 다시 열 수 있게 특정 색 강조 + 흐릿한 텍스트(=원래 세계로 돌아가는
    // '비밀 차원문'). 클릭하면 드롭다운이 다시 열린다. 미리보기 아닐 땐 평소대로 "미리보기 ▾".
    const previewing = previewDual || previewRole !== null;
    // '보여주기'는 관리자(owner) 미리보기일 때만 — 그 외 역할(매니저·작업자·시청자) 미리보기는 '미리보기'.
    const triggerText = previewing
      ? isNarrow
        ? "시청자 화면"
        : previewRole === "owner"
          ? "시청자 화면 보여주기"
          : "시청자 화면 미리보기"
      : "미리보기";
    return (
      <div className="preview-dd">
        <button
          aria-expanded={previewMenuOpen}
          aria-haspopup="menu"
          className={`button preview-dd-trigger${previewing ? " previewing" : ""}`}
          onClick={() => setPreviewMenuOpen((value) => !value)}
          type="button"
        >
          {triggerText}
          {previewing ? null : (
            <span aria-hidden="true" className="preview-dd-caret">
              ▾
            </span>
          )}
        </button>
        {previewMenuOpen ? (
          <div className="preview-dd-menu" role="menu">
            {options.map((opt) => {
              const active =
                opt.value === "dual" ? previewDual : !previewDual && (previewRole ?? "") === opt.value;
              return (
              <button
                className={`preview-dd-item${active ? " active" : ""}`}
                key={opt.value || "dev"}
                onClick={() => {
                  setPreviewMenuOpen(false);
                  applyPreview(opt.value);
                }}
                role="menuitem"
                type="button"
              >
                {opt.label}
              </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  function togglePrivateLayer() {
    if (hasUnlockSession) {
      setShowPrivate((value) => !value);
    } else {
      setPasscodeModal("unlock");
    }
  }
  // 비밀번호 변경 팝업 열기 — 다른 모달(인사이트) 위에 따로 띄운다(그 모달은 닫지 않음 →
  // 취소하면 리로드 없이 그 화면 그대로 드러난다).
  function openChangePasscode() {
    setPasscodeModal("change");
  }

  // 역할 도움말 팝오버: 배지 바깥을 누르거나 Esc로 닫는다.
  useEffect(() => {
    if (!roleHelpOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement | null)?.closest(".actor-badge-wrap")) {
        setRoleHelpOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setRoleHelpOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [roleHelpOpen]);

  // 미리보기 드롭다운: 바깥을 누르거나 Esc로 닫는다.
  useEffect(() => {
    if (!previewMenuOpen) {
      return;
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target as HTMLElement | null)?.closest(".preview-dd")) {
        setPreviewMenuOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [previewMenuOpen]);

  // A3: 역할 배지 + "?" 도움말 팝오버. 이메일은 배지에 인라인으로 두지 않고(폭 절약·깔끔)
  // 팝오버 안 역할 라벨 아래에 보여준다.
  function renderRoleBadge() {
    return (
      <div className="actor-badge-wrap">
        {/* 배지 전체가 토글 버튼 — "?"만이 아니라 역할 라벨 어디를 눌러도 설명이 뜬다(웹·모바일). */}
        <button
          aria-expanded={roleHelpOpen}
          aria-label="역할 권한 보기"
          className={`actor-badge ${actor.role}`}
          onClick={() => setRoleHelpOpen((value) => !value)}
          type="button"
        >
          <strong>{roleDisplay.badgeLabel}</strong>
          <span className="role-help-q" aria-hidden="true">
            ?
          </span>
        </button>
        {roleHelpOpen ? (
          <div className="role-help-pop" role="dialog" aria-label="역할 권한">
            {/* 미리보기 중이면 역할명 옆에 작게 "(미리보기 중입니다..)" — 아이콘 없이.
                (이중도 previewRole=manager라 포함.) */}
            <strong className="role-help-title">
              {roleDisplay.label}
              {previewRole !== null ? (
                <span className="role-help-preview"> (미리보기 중입니다..)</span>
              ) : null}
            </strong>
            {actor.email ? (
              <PlainEmail className="role-help-email" value={actor.email} />
            ) : (
              <span className="role-help-email">비로그인</span>
            )}
            <p className="role-help-summary">{roleDisplay.summary}</p>
            <ul className="role-help-can">
              {roleDisplay.can.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {/* 진동 켜기/끄기 — 진동 지원 기기(안드로이드)에서만. 켜면 하트·탭·저장·삭제 등에 가볍게 울린다. */}
            {hapticsSupported ? (
              <div className="role-help-haptics">
                <span className="rhh-label">
                  <Vibrate aria-hidden="true" size={14} />
                  진동
                </span>
                <button
                  aria-checked={hapticsOn}
                  aria-label="진동 켜기/끄기"
                  className={`rhh-switch ${hapticsOn ? "on" : ""}`}
                  onClick={toggleHaptics}
                  role="switch"
                  type="button"
                >
                  <span className="rhh-knob" aria-hidden="true" />
                </button>
              </div>
            ) : null}
            {/* 동작 줄이기 — 장식용 반복 모션(제목 ✨·오늘 호흡·불꽃 등)을 끈다. 눈 피로↓.
                기기 무관 항상 노출(진동과 달리 모든 화면에 적용). */}
            <div className="role-help-haptics">
              <span className="rhh-label">
                <Sparkles aria-hidden="true" size={14} />
                동작 줄이기
              </span>
              <button
                aria-checked={reduceMotion}
                aria-label="동작 줄이기 켜기/끄기"
                className={`rhh-switch ${reduceMotion ? "on" : ""}`}
                onClick={toggleReduceMotion}
                role="switch"
                type="button"
              >
                <span className="rhh-knob" aria-hidden="true" />
              </button>
            </div>
            {/* 눈 편한 테마 — 채도·눈부심을 낮춰 오래 봐도 덜 피로하게(글자 대비는 유지). */}
            <div className="role-help-haptics">
              <span className="rhh-label">
                <Eye aria-hidden="true" size={14} />
                눈 편한 테마
              </span>
              <button
                aria-checked={eyeComfort}
                aria-label="눈 편한 테마 켜기/끄기"
                className={`rhh-switch ${eyeComfort ? "on" : ""}`}
                onClick={toggleEyeComfort}
                role="switch"
                type="button"
              >
                <span className="rhh-knob" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  const visibleEvents = useMemo(
    () =>
      events.filter((event) => {
        if (event.visibilityScope === "public") {
          return true;
        }
        if (!canReadPrivate) {
          return false;
        }
        if (event.visibilityScope === "owner_private") {
          return canReadOwnerPrivate(actor.role);
        }
        return true;
      }),
    [actor.role, canReadPrivate, events]
  );
  const cells = useMemo(() => buildCalendarMonth(view.year, view.month), [view]);
  // 업 도움은 기간(종료일, KST)이 지나면 편집실에서도 자동으로 내린다 — 시청자 화면과 동일하게
  // 끝난 업 도움은 달력 띠·줄 칸·모바일 어젠다 어디서도 그리지 않는다. 일반 일정은 그대로 두고
  // 끝난 업 도움만 제외해, 업 도움 시각화가 한 소스에서 일관되게 사라지게 한다.
  const liveEvents = useMemo(
    () =>
      visibleEvents.filter(
        (e) => !e.isSupport || (e.endDateKey ?? getEventDateKey(e)) >= today
      ),
    [visibleEvents, today]
  );
  const supportLanes = useMemo(() => assignSupportLanes(liveEvents), [liveEvents]);
  // 업 도움 띠가 차지하는 줄 수를 "주(週)별"로 센다. 띠가 없는 주는 0 → 그 주의 일정들이 위로
  // 붙는다(예전엔 달 전체 최대 줄 수를 모든 칸에 적용해, 띠 없는 주도 공중에 떠 높이만 낭비됨).
  const weekSupportLaneCount = useMemo(() => {
    const perWeek: number[] = [];
    for (let w = 0; w * 7 < cells.length; w += 1) {
      let maxLane = -1;
      for (const c of cells.slice(w * 7, w * 7 + 7)) {
        for (const s of getEventsForDate(liveEvents, c.isoDate)) {
          if (!s.isSupport) continue;
          maxLane = Math.max(maxLane, supportLanes.lanes.get(s.id) ?? 0);
        }
      }
      perWeek[w] = maxLane + 1;
    }
    return perWeek;
  }, [cells, liveEvents, supportLanes]);
  // 이어진 일정 묶음 키 + 묶음 칸 높이 맞추기(글자 수 달라도 이음새 안 어긋나게).
  const chainKeys = useMemo(() => buildChainKeys(visibleEvents), [visibleEvents]);
  const paintGroups = useMemo(() => buildPaintGroups(visibleEvents), [visibleEvents]);
  // 이어진 칸 높이 맞추기 — callback ref라 그리드가 어떤 경로로 (재)마운트되든(미리보기 복귀·
  // 잠금 로딩·월 변경 등) 항상 새 요소에 자동 재설정된다. deps는 데이터 변화 시 보강용.
  const monthGridRef = useEqualChainHeights<HTMLDivElement>([visibleEvents, view]);
  // 구글 시트식 날짜 칸 범위 선택(마우스 전용, 시각 강조만) + 텍스트 긁힘 방지.
  // 선택은 React state(rangeSelected)라 카드 드래그 등 다른 리렌더에도 안 지워진다.
  // 둘 다 callback ref라 한 요소에 합쳐 단다(안정 identity라 매 렌더 재부착 없음).
  const { setRef: rangeSelectRef, selected: rangeSelected } = useCellRangeSelect<HTMLDivElement>();
  const setMonthGridRef = useCallback(
    (el: HTMLDivElement | null) => {
      monthGridRef(el);
      rangeSelectRef(el);
    },
    [monthGridRef, rangeSelectRef]
  );
  // 실제 편집실 화면이 떴음을 방문 비콘에 알린다(로딩 스켈레톤이 아닌 진짜 화면을 봤을 때만 방문 1).
  useEffect(() => {
    markContentReady();
  }, []);
  // 새 일정 카드: 카드/날짜 칸 바깥을 누르면 닫는다(슬라이드 아웃). 닫기는 '제스처 시작점' 기준이라
  // 제목을 마우스로 긁다가 카드 밖에서 손을 떼도(드래그-선택) 시작점이 카드 안이면 닫지 않는다.
  // (이전엔 click의 target이 두 점의 공통 조상이라 카드 밖으로 잡혀 갑자기 닫히는 버그가 있었다.)
  // 여는 클릭이 바로 닫지 않게 다음 틱부터 듣는다.
  useEffect(() => {
    if (!editorVisible) return;
    // 비공개 토글(.private-toggle)은 '바깥'으로 치지 않는다 → 새 일정 카드를 연 채 비공개 일정 보기를
    // 눌러도 카드가 닫히지 않고, 공개 범위 옵션만 유동적으로 늘어난다(엠바고/작업자 등장).
    // 편집 카드는 '반영구 인스펙터'다(NN/g: 예기치 못한 화면 이동은 해악 / Godot: 컨텍스트가
    // 사라질 때만 자동 닫기). 편집과 무관한 컨트롤을 눌렀다고 카드가 사라지면 안 된다 → 아래는
    // '바깥'으로 치지 않는다: 편집 패널·날짜칸·비공개 토글·날짜시간 선택기 백드롭에 더해,
    // 휴뱅 미니메뉴(.rest-menu), 월 이동 < >(.studio-monthbar, 키보드 ←/→와 동작 일치),
    // 색상 필터 사이드바(.studio-left-panel). 빈 배경 클릭만 닫기로 남긴다.
    const isOutside = (el: HTMLElement | null) =>
      !(
        el?.closest(".event-editor-panel") ||
        el?.closest(".studio-day") ||
        el?.closest(".private-toggle") ||
        el?.closest(".rest-menu") ||
        el?.closest(".studio-monthbar") ||
        el?.closest(".studio-left-panel") ||
        // 날짜·시간 선택기는 portal로 body에 떠 에디터 DOM 밖이지만, 닫기 대상이 아니다.
        el?.closest(".dtp-pop-backdrop") ||
        el?.closest(".dtp-sheet-backdrop")
      );
    let downOutside = false;
    const onDown = (e: PointerEvent) => {
      downOutside = isOutside(e.target as HTMLElement | null);
    };
    const onUp = (e: PointerEvent) => {
      if (!downOutside) return; // 카드/칸 안에서 시작한 드래그(텍스트 긁기 등)는 보호.
      if (!isOutside(e.target as HTMLElement | null)) return; // 끝점도 밖일 때만.
      // 입력칸이 아직 편집 포커스면 닫지 않는다(선택 드래그 중 안전장치).
      if ((document.activeElement as HTMLElement | null)?.closest(".event-editor-panel")) return;
      setEditorVisible(false);
    };
    const id = window.setTimeout(() => {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
    };
  }, [editorVisible]);
  // 선택한 일정이 속한 연결 체인 전체를 하이라이트 대상으로 삼는다.
  const selectedChainIds = useMemo(
    () => getLinkedChainIds(selectedEventId, visibleEvents),
    [selectedEventId, visibleEvents]
  );
  const [form, setForm] = useState<EventForm>(() => createEmptyForm());

  // 접힌 '공개 범위 · 옵션' 헤더에 현재 값을 한 줄로 요약한다 — 접혀 있어도 이 일정이 엠바고인지,
  // 미정인지, 떡밥인지 펼치지 않고 바로 보이게(접기가 정보를 숨기면 안 된다).
  const scopeFoldSummary = [
    form.visibilityScope === "owner_private"
      ? "🔒 엠바고"
      : form.visibilityScope === "work"
        ? "🔧 작업자"
        : "🌐 모두",
    form.isTentative ? "미정" : null,
    form.isSupport ? "🌱 업 도움" : null,
    form.teaser ? "🔮 최초공개" : null
  ]
    .filter(Boolean)
    .join(" · ");
  // 편집 카드 임시 보관(드래프트). 모듈 상단 헬퍼(loadEditDrafts 등) 참고.
  // baseline = '깨끗한' 기준 지문(원본 일정 또는 빈 새 카드). form이 이와 다르면 미저장 변경 → 보관.
  const editDraftsRef = useRef<Map<string, EditDraft>>(new Map());
  const editBaselineRef = useRef<string>(draftFingerprint(createEmptyForm()));
  const draftHydratedRef = useRef(false);
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    editDraftsRef.current = loadEditDrafts(); // 새로고침/탭 닫힘에도 살아남게 localStorage에서 복구
    draftHydratedRef.current = true;
  }, []);
  // 현재 열린 카드의 보관 키 — 기존 일정은 evt:<id>, 날짜 새 카드는 new:<날짜>.
  function draftKeyFor(): string | null {
    if (selectedEventId) return `evt:${selectedEventId}`;
    if (selectedDate) return `new:${selectedDate}`;
    return null;
  }
  // TTL 안에 든 드래프트만 돌려주고, 지난 건 즉시 폐기.
  function freshDraft(key: string): EditDraft | null {
    const d = editDraftsRef.current.get(key);
    if (!d) return null;
    if (d.ts < Date.now() - DRAFT_TTL_MS) {
      editDraftsRef.current.delete(key);
      return null;
    }
    return d;
  }

  // 모바일 오버레이 스택: 편집 시트 → (그 위에) 공지 모달. 레이어마다 히스토리 항목을 하나씩 쌓아,
  // 휴대폰 뒤로가기를 누르면 맨 위 레이어만 닫힌다(공지 → 편집 시트 → 스튜디오). 비번 팝업은
  // 별도 오버레이(passcodeModal)라 스택엔 안 넣되, 스크롤 잠금엔 포함한다.
  const modalIsStackable = modal !== null;
  const overlayDepth = (mobileEditId !== null ? 1 : 0) + (modalIsStackable ? 1 : 0);
  // 스크롤 잠금엔 태그 수정·업 도움 시트·비번 팝업도 포함 — 시트를 잡고 끌면 뒤 배경이 스크롤돼
  // 아래가 뚫리던 문제를 막는다. (히스토리 스택(overlayDepth)은 기존대로.)
  const overlayLocked =
    overlayDepth > 0 || supportSheetId !== null || tagSheetId !== null || passcodeModal !== null;
  // 매니저·작업자 전용 시트(태그 수정·업 도움)도 히스토리에 한 칸 쌓는다 — 안 쌓으면 모바일
  // 뒤로가기가 시트를 닫는 대신 페이지를 떠나(로그인/계정 화면으로) 버린다. 오너의 편집 시트
  // (mobileEditId)·개발자 모달과 동일하게 '뒤로가기=시트 닫기'로 통일.
  const sheetDepth = (tagSheetId !== null ? 1 : 0) + (supportSheetId !== null ? 1 : 0);
  // 비밀번호 팝업(passcodeModal)도 한 칸 쌓는다 — 안 쌓으면 모바일 뒤로가기가 팝업을 닫는 대신
  // 사이트를 종료해 버린다(비공개 일정 잠금해제 입력창에서 발생). 다른 모달 위에도 뜰 수 있어
  // 스택 '맨 위'로 친다.
  const passcodeDepth = passcodeModal !== null ? 1 : 0;
  // 히스토리 스택 깊이 = 오버레이(편집 시트·공지) + 매니저/작업자 시트 + 비번 팝업 + 미리보기.
  // viewerMode도 한 칸 쌓아야, 휴대폰 뒤로가기를 누를 때 로그인 흐름으로 빠지지 않고
  // 편집실로 돌아온다. (스크롤 잠금은 overlayLocked만 사용 — 미리보기 자체 스크롤은 살린다.)
  const stackDepth =
    overlayDepth + sheetDepth + passcodeDepth + (viewerMode ? 1 : 0) + (teaserPickerOpen ? 1 : 0);
  const depthRef = useRef(0);
  const ignorePopRef = useRef(0); // 우리가 정리용으로 부른 history.back의 popstate는 무시
  const backClosingRef = useRef(false); // 뒤로가기로 닫히는 중인지

  // B2(접근성): 모달(modal)·비번 팝업(passcodeModal)을 Esc로 닫고, 닫을 때 열기 전 포커스로
  // 복원한다(키보드 사용자가 위치를 잃지 않게). 닫기는 setState로 — 히스토리 스택은 기존 효과가
  // 정리한다(X·배경 클릭과 동일 경로). 모바일 시트/미리보기는 뒤로가기 스택이 따로 처리.
  useEffect(() => {
    if (modal === null && passcodeModal === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (passcodeModal !== null) setPasscodeModal(null);
      else setModal(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal, passcodeModal]);
  const modalOpenerRef = useRef<HTMLElement | null>(null);
  const prevModalRef = useRef<typeof modal>(null);
  useEffect(() => {
    const prev = prevModalRef.current;
    prevModalRef.current = modal;
    if (prev === null && modal !== null) {
      modalOpenerRef.current = document.activeElement as HTMLElement | null;
    } else if (prev !== null && modal === null) {
      modalOpenerRef.current?.focus?.();
      modalOpenerRef.current = null;
    }
  }, [modal]);

  // (1) 오버레이가 하나라도 열려 있으면 배경 스크롤·당겨서 새로고침을 잠근다.
  useEffect(() => {
    if (!overlayLocked) return;
    const scrollY = window.scrollY;
    const body = document.body;
    const root = document.documentElement;
    const saved = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overscroll: root.style.overscrollBehavior
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    root.style.overscrollBehavior = "none";
    return () => {
      body.style.position = saved.position;
      body.style.top = saved.top;
      body.style.left = saved.left;
      body.style.right = saved.right;
      body.style.width = saved.width;
      root.style.overscrollBehavior = saved.overscroll;
      window.scrollTo(0, scrollY);
    };
  }, [overlayLocked]);

  // (2) 레이어 수(depth)에 맞춰 히스토리 항목을 쌓고/정리한다.
  useEffect(() => {
    const prev = depthRef.current;
    if (stackDepth > prev) {
      for (let i = prev; i < stackDepth; i += 1) {
        window.history.pushState({ vicOverlay: true }, "");
      }
    } else if (stackDepth < prev) {
      if (backClosingRef.current) {
        // 뒤로가기로 닫힘 → 브라우저가 이미 항목을 뺐으니 동기화만.
        backClosingRef.current = false;
      } else {
        // X·취소·버튼 등으로 닫힘 → 우리가 쌓은 항목을 그만큼 정리(그때 나는 popstate는 무시).
        for (let i = stackDepth; i < prev; i += 1) {
          ignorePopRef.current += 1;
          window.history.back();
        }
      }
    }
    depthRef.current = stackDepth;
  }, [stackDepth]);

  // (3) 뒤로가기(popstate) → 맨 위 레이어 하나만 닫는다.
  useEffect(() => {
    function onPop() {
      // 시청자 미리보기 안의 포스터도 자기 오버레이('이 달 기록' 시트)를 히스토리 한 칸으로
      // 관리한다. 그 칸이 살아 있는 동안의 뒤로가기는 그쪽 몫이다 — 우리가 먼저 처리해 버리면
      // 시트 하나 닫자고 미리보기까지 닫혀 편집실로 튕긴다(실제 신고된 증상. 리스너 호출 순서는
      // 바깥이 먼저라 '안쪽이 표식을 남긴다'는 방식으로는 못 막는다 — 실측으로 확인).
      if (hasInnerOverlay()) {
        return;
      }
      if (ignorePopRef.current > 0) {
        ignorePopRef.current -= 1;
        return;
      }
      backClosingRef.current = true;
      // 맨 위 레이어 하나만 닫는다. 보통 동시에 하나만 열리지만, 겹쳐도 위→아래 순으로.
      // 떡밥 공개시각 팝업이 편집 카드 위에 떠 있으면 그것부터 닫는다(편집 카드는 유지).
      if (teaserPickerOpen) {
        setTeaserPickerOpen(false);
      } else if (passcodeModal !== null) {
        setPasscodeModal(null);
      } else if (modalIsStackable) {
        setModal(null);
      } else if (tagSheetId !== null) {
        // 매니저: 태그 수정 시트 → 닫고 편집실 기본 화면으로(계정 화면으로 안 빠짐).
        setTagSheetId(null);
      } else if (supportSheetId !== null) {
        // 매니저·작업자: 업 도움 시트 닫기.
        setSupportSheetId(null);
      } else if (mobileEditId !== null) {
        setMobileEditId(null);
        setSelectedEventId(null);
        setForm(createEmptyForm());
      } else if (viewerMode) {
        // 시청자 미리보기에서 뒤로가기 → 로그인 흐름으로 빠지지 않고 편집실로 복귀.
        setViewerMode(false);
      }
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [
    teaserPickerOpen,
    passcodeModal,
    modalIsStackable,
    tagSheetId,
    supportSheetId,
    mobileEditId,
    viewerMode
  ]);

  // D: 이 일정의 대표 태그(최대 2개) 색. 2개면 그 일정 안에서 그라데이션(경계는 일정 가운데).
  function eventColors(event: StudioScheduleEvent) {
    return tagVisual.eventFills(event);
  }

  function moveMonth(offset: number) {
    hapticTick(); // 달 넘김 손맛 — 버튼·키보드·스와이프 모든 경로 공통(Android만, 그 외 조용히 무시)
    didNavigateRef.current = true; // 이제부턴 달 이동 = 슬라이드(첫 진입 스태거와 구분)
    setMonthDir(offset >= 0 ? "next" : "prev"); // 슬라이드 방향(시청자 화면과 동일)
    setView((current) => {
      const next = getAdjacentMonth(current.year, current.month, offset);
      setSelectedDate(`${next.year}-${String(next.month).padStart(2, "0")}-01`);
      setSelectedEventId(null);
      setForm(createEmptyForm());
      return next;
    });
    bumpEditor(); // 달이 바뀌어 새 날짜로 → 폼 새로 마운트
  }

  // 키보드 ←/→ 로 월 이동(데스크톱 편집실). 입력칸·모달·시청자 미리보기 중엔 동작 안 함.
  useEffect(() => {
    if (isNarrow || viewerMode) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      if (overlayLocked) {
        return; // 모달·시트 열림 중엔 월 이동 막기
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        // 이어진 일정을 선택 중이면 월 이동 대신 체인 안에서 이전/다음 일정을 고른다(날짜 순).
        // 태그 필터로 줄지 않게 전체 events 기준으로 체인을 잡는다.
        const chain = selectedEventId ? getLinkedChainIds(selectedEventId, events) : null;
        if (selectedEventId && chain && chain.size > 1) {
          const ordered = Array.from(chain)
            .map((id) => events.find((ev) => ev.id === id))
            .filter((ev): ev is StudioScheduleEvent => Boolean(ev))
            .sort((a, b) => getEventDateKey(a).localeCompare(getEventDateKey(b)));
          const idx = ordered.findIndex((ev) => ev.id === selectedEventId);
          const nextIdx = event.key === "ArrowLeft" ? idx - 1 : idx + 1;
          if (nextIdx >= 0 && nextIdx < ordered.length) {
            hapticTick();
            selectEvent(ordered[nextIdx]);
          }
          return;
        }
        moveMonth(event.key === "ArrowLeft" ? -1 : 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNarrow, viewerMode, overlayLocked, selectedEventId, events]);

  // 좌/우 스와이프로 월 이동(모바일 아젠다). 가로로 충분히, 세로 스크롤보다 크게 밀었을 때만.
  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  function onAgendaTouchStart(e: ReactTouchEvent) {
    const t = e.touches[0];
    swipeRef.current = { x: t.clientX, y: t.clientY };
  }
  function onAgendaTouchEnd(e: ReactTouchEvent) {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      moveMonth(dx < 0 ? 1 : -1); // haptic은 moveMonth에서 단일 처리
    }
  }

  function selectDate(isoDate: string) {
    // 이미 그 날짜의 새 일정 카드가 열려 있는데 같은 날짜를 또 누르면 → 선택 해제(카드 닫기).
    if (editorVisible && selectedDate === isoDate && selectedEventId === null) {
      setEditorVisible(false);
      return;
    }
    setSelectedDate(isoDate);
    setSelectedEventId(null);
    // 빈 새 카드가 기준 — 같은 날짜에 쓰다 만 임시 내용이 있으면 되살린다.
    editBaselineRef.current = draftFingerprint(createEmptyForm());
    const draft = freshDraft(`new:${isoDate}`);
    setForm(draft ? draft.form : createEmptyForm());
    setDraftRestored(Boolean(draft));
    setEditorVisible(true);
    bumpEditor(); // 사용자가 새 날짜 칸을 고름 → 폼 새로 마운트(전환 애니메이션)
  }

  // ── 일정 카드 드래그 이동 ────────────────────────────────────────────────
  // 카드를 끌어 다른 날짜 칸에 놓으면 그 날짜로 옮긴다. 들면 카드가 살짝 기울고 흔들리는
  // "유령(ghost)"이 손끝을 따라오고(웹·터치 공용), 가장자리에선 자동 스크롤된다.
  // (멀티데이 막대는 칸마다 쪼개 그려 드래그가 까다로워 제외 — 단일일 카드만 끌 수 있다.)
  const [dragEventId, setDragEventId] = useState<string | null>(null);
  // 잇기(연결)를 '드래그'로만 하도록: 카드를 집으면 지금 이 카드와 이을 수 있는(연속+같은태그)
  // 상대 카드들을 강조하고 나머지는 흐릿하게, 그 위로 끌고 가 놓으면 그 구간을 잇는다.
  // (예전 클릭 2번 연결은 제목 편집 왕복 중 실수로 붙던 문제로 제거했다.)
  const [connectCandidates, setConnectCandidates] = useState<Set<string>>(() => new Set());
  const [connectHoverId, setConnectHoverId] = useState<string | null>(null);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const connectCandidatesRef = useRef<Set<string>>(new Set());
  const connectHoverRef = useRef<string | null>(null);
  // 끊기 = 방금 잘린 카드(슬라이스 연출용). 우클릭 빈 공간에서 그은 빨간 선이 이음새를 스치면 끊는다.
  const [cutFlashId, setCutFlashId] = useState<string | null>(null);
  const cutFlashTimer = useRef<number | null>(null);
  // 우클릭 제스처(잇기/끊기): 카드 위에서 시작=잇기(보라 선 → 후보에 놓으면 연결), 빈 곳에서
  // 시작=끊기(빨간 선이 이음새 스치면 끊김). 오버레이 SVG는 명령형으로 붙였다 뗀다(리렌더 회피).
  type RightGesture = {
    mode: "connect" | "cut";
    sourceId: string | null;
    startX: number;
    startY: number;
    moved: boolean;
    svg: SVGSVGElement | null;
    path: SVGElement | null;
    srcX: number;
    srcY: number;
    prevX: number;
    prevY: number;
    seams: { id: string; x1: number; x2: number; top: number; bottom: number }[];
    cutSet: Set<string>;
  };
  const rightGestureRef = useRef<RightGesture | null>(null);
  // 우클릭 '드래그였다' 표시 — 달력 밖에서 시작한 끊기 드래그 뒤 브라우저 우클릭 메뉴를 1회 막는다.
  const rightDragMovedRef = useRef(false);
  // #8: 이동 저장이 진행 중인 카드 id들 — 그 카드에 작은 '동기화 중' 표시를 띄운다(서버 반영 전).
  const [syncingIds, setSyncingIds] = useState<string[]>([]);

  // A2 FLIP(형제 카드 활주) + A1 seam(연결/끊김 연출) — 순수 뷰 레이어. 낙관 상태·직렬 큐·prop
  // 동기화 가드엔 절대 손대지 않는다. transform/opacity만(합성). 드래그 중·just-saved·삭제 중인
  // 카드는 건너뛰어 충돌을 막고, 달 전환 시엔 위치가 통째로 바뀌므로 FLIP/seam을 생략한다.
  const flipRects = useRef<Map<string, DOMRect>>(new Map());
  const seamPrev = useRef<Map<string, string>>(new Map());
  const flipViewKey = useRef("");
  // FLIP 활주(형제 카드 미끄러짐)는 '드래그 재정렬'처럼 위치가 의도적으로 바뀔 때만 보여준다. 저장·
  // 삭제·복붙·잇기·태그 변경 등은 칸 크기/개수가 바뀌며 형제가 reflow되는데, 그때 활주하면 "건드렸더니
  // 일정들이 우르르 움직인다"는 거슬림이 된다 → 기본은 활주 OFF, 드롭(재정렬)에서만 1회 arm한다(그 외엔
  // 위치만 기록하고 즉시 안착). 이렇게 반전해 두면 새 mutation을 추가해도 자동으로 안 움직인다.
  const flipArmedRef = useRef(false);
  useLayoutEffect(() => {
    const viewKey = `${view.year}-${view.month}`;
    const viewChanged = flipViewKey.current !== viewKey;
    flipViewKey.current = viewKey;
    const reduce = prefersReducedMotion();
    const dragging = dragEventId !== null;
    // 이번 변화가 '드래그 재정렬'(arm)일 때만 활주. 그 외(저장·삭제·복붙·잇기·태그)는 위치만 기록.
    const armed = flipArmedRef.current;
    flipArmedRef.current = false;
    document.querySelectorAll<HTMLElement>(".studio-event-pill[data-eventid]").forEach((el) => {
      const id = el.dataset.eventid;
      if (!id) return;
      const last = el.getBoundingClientRect();
      const busy =
        el.classList.contains("dragging-src") ||
        el.classList.contains("just-saved") ||
        el.classList.contains("deleting");
      // A2: First(직전 위치)→Last(현재) 차이를 역보정 후 다음 프레임에 풀어 미끄러지듯 안착.
      const first = flipRects.current.get(id);
      if (first && !reduce && !viewChanged && !busy && armed) {
        const dx = first.left - last.left;
        const dy = first.top - last.top;
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          el.style.transform = `translate(${dx}px, ${dy}px)`;
          el.style.transition = "none";
          requestAnimationFrame(() => {
            el.style.transition = "transform var(--dur-3, 240ms) var(--ease, ease)";
            el.style.transform = "";
          });
        }
      }
      flipRects.current.set(id, last);
      // A1: 맞닿는 변(평평한 모서리)이 늘면 연결(seam-heal 빛), 줄면 끊김(seam-tear 튕김).
      const seam = el.dataset.seam ?? "";
      const prev = seamPrev.current.get(id);
      if (prev !== undefined && prev !== seam && !reduce && !dragging && !viewChanged && !busy) {
        const cls =
          seam.length > prev.length
            ? "seam-joining"
            : seam.length < prev.length
              ? "seam-breaking"
              : null;
        if (cls) {
          el.classList.remove("seam-joining", "seam-breaking");
          void el.offsetWidth; // reflow → 애니 재시작
          el.classList.add(cls);
          window.setTimeout(() => el.classList.remove(cls), 380);
        }
      }
      seamPrev.current.set(id, seam);
    });
  }, [visibleEvents, view, dragEventId]);

  const [dropDate, setDropDate] = useState<string | null>(null);
  const dropDateRef = useRef<string | null>(null);
  // 같은 날 안에서 어느 카드 위/아래에 떨어뜨릴지(순서 변경). null이면 맨 끝에 둠.
  const dropOverRef = useRef<{ id: string; after: boolean } | null>(null);
  // 드롭될 위치 표시(삽입선) — 어느 날, 어느 카드 기준 위/아래인지.
  const [dropSlot, setDropSlot] = useState<{
    day: string;
    overId: string | null;
    after: boolean;
  } | null>(null);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const dragInfoRef = useRef<{
    id: string;
    sourceDate: string;
    node: HTMLElement;
    startX: number;
    startY: number;
    offX: number;
    offY: number;
    started: boolean;
    isTouch: boolean;
    // armed=드래그 시작 가능. 마우스는 즉시, 터치는 롱프레스(제자리 유지) 뒤에만 켜진다.
    // 그 전 터치 움직임은 '스크롤 의도'로 보고 드래그를 포기해 페이지가 그냥 스크롤되게 한다.
    armed: boolean;
  } | null>(null);
  const dragScrollDir = useRef(0);
  const dragRaf = useRef<number | null>(null);
  const dragMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const justDraggedRef = useRef(false);
  // 터치 롱프레스 타이머 + 드래그 활성 동안 네이티브 스크롤을 막는 비수동 리스너.
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preventTouchScrollRef = useRef<((e: TouchEvent) => void) | null>(null);
  // 빈 날짜칸 롱프레스(휴방 메뉴) — pill 드래그(holdTimerRef)와 별개. 시작 좌표로 이동 취소 판정.
  const cellHoldRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellHoldPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressCellClickRef = useRef(false); // 롱프레스로 메뉴 연 직후 click(=selectDate) 한 번 무시
  // 유령 물리감(태그 편집과 동일): 관성 지연 + 움직임 방향 기울기 + 랜덤 흔들림.
  // CSS 애니메이션 대신 JS로 transform을 직접 칠해, 2색(그라데이션) 카드에도 확실히 적용된다.
  const edPosRef = useRef({ x: 0, y: 0 });
  const edTargetRef = useRef({ x: 0, y: 0 });
  // 진자(pendulum) 물리 — 잡은 점(pivot)에 매달린 추(카드 중심)를 Verlet로 시뮬레이션한다.
  // 마우스를 빙빙 돌리면 추가 휙휙 돌아 360° 회전(헬리콥터), 멈추면 달처럼 천천히 아래로 정착.
  const edBobRef = useRef({ x: 0, y: 0 }); // 추 현재 위치
  const edBobPrevRef = useRef({ x: 0, y: 0 }); // 추 이전 위치(Verlet 속도용)
  const edOffRef = useRef({ x: 0, y: 0 }); // 잡은 지점(pivot)의 카드 내 오프셋
  const edLenRef = useRef(1); // 진자 길이(잡은 점→카드 중심 거리)
  const edPhi0Ref = useRef(0); // 카드 로컬에서 (잡은 점→중심) 벡터의 각도(rad)
  const edWobRef = useRef(0);
  const edReducedRef = useRef(false);
  // 던지기(fling) — 빙빙 돌리다 놓으면 그 순간 속도+회전을 받아 포물선으로 날아간다.
  const edDegRef = useRef(0); // 현재 카드 회전각(deg)
  const edAngVelRef = useRef(0); // 회전 각속도(deg/frame, 부호 유지)
  const edWorldPrevRef = useRef(0); // 이전 프레임 월드각(각속도 계산용)
  const edVelRef = useRef({ x: 0, y: 0 }); // 포인터 속도(px/ms)
  const edPtrRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const flingRafRef = useRef<number | null>(null);
  const flingGhostRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    return () => {
      if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
      if (flingRafRef.current) cancelAnimationFrame(flingRafRef.current);
      dragGhostRef.current?.remove();
      flingGhostRef.current?.remove();
      if (dragMoveRef.current) window.removeEventListener("pointermove", dragMoveRef.current);
    };
  }, []);

  function dragAutoScroll() {
    if (dragScrollDir.current !== 0) window.scrollBy(0, 13 * dragScrollDir.current);
    const ghost = dragGhostRef.current;
    if (ghost && edReducedRef.current) {
      ghost.style.left = `${edTargetRef.current.x}px`;
      ghost.style.top = `${edTargetRef.current.y}px`;
    } else if (ghost) {
      // 포인터가 멈추면 move 이벤트가 끊겨 속도가 옛값에 박힌다 → 매 프레임 감쇠시켜,
      // 멈췄다 천천히 놓는 평범한 드롭이 실수로 던져지지 않게 한다(빙빙 돌리는 중엔 move가
      // 계속 들어와 속도가 유지된다).
      edVelRef.current.x *= 0.9;
      edVelRef.current.y *= 0.9;
      const pos = edPosRef.current;
      const t = edTargetRef.current;
      pos.x += (t.x - pos.x) * 0.18; // 위치도 관성 있게 더 부드럽게 뒤따른다
      pos.y += (t.y - pos.y) * 0.18;
      // 진자: pivot = 잡은 점(카드 좌상단 + 오프셋). 추(bob)를 Verlet로 적분 + 막대 길이 구속.
      const pivotX = pos.x + edOffRef.current.x;
      const pivotY = pos.y + edOffRef.current.y;
      const bob = edBobRef.current;
      const prev = edBobPrevRef.current;
      const G = 0.3; // 중력
      const DAMP = 0.9; // 저항을 충분히 줘 발발거림·과한 스윙을 잡는다(관성은 남기되 절제)
      const vx = (bob.x - prev.x) * DAMP;
      const vy = (bob.y - prev.y) * DAMP;
      prev.x = bob.x;
      prev.y = bob.y;
      bob.x += vx;
      bob.y += vy + G; // 중력은 아래로
      // 막대 길이 구속: pivot에서 항상 L 거리에 있게 당긴다(원운동 → 빙빙 돌리면 360° 가능).
      const dx = bob.x - pivotX;
      const dy = bob.y - pivotY;
      const dist = Math.hypot(dx, dy) || 1;
      const L = edLenRef.current;
      bob.x = pivotX + (dx / dist) * L;
      bob.y = pivotY + (dy / dist) * L;
      // 카드 회전 = (pivot→추) 월드각 − 로컬(잡은점→중심)각. 미세 흔들림 추가.
      const worldAngle = Math.atan2(bob.y - pivotY, bob.x - pivotX);
      // 각속도(deg/frame) 추적 — 놓는 순간 던지기 회전에 쓴다. 2π 경계 보정 + EMA로 매끈하게.
      let dA = worldAngle - edWorldPrevRef.current;
      while (dA > Math.PI) dA -= Math.PI * 2;
      while (dA < -Math.PI) dA += Math.PI * 2;
      edWorldPrevRef.current = worldAngle;
      edAngVelRef.current = edAngVelRef.current * 0.7 + ((dA * 180) / Math.PI) * 0.3;
      edWobRef.current += 0.12;
      const w = edWobRef.current;
      const wobble = Math.sin(w) * 1.1 + (Math.random() - 0.5) * 0.7; // deg
      const deg = ((worldAngle - edPhi0Ref.current) * 180) / Math.PI + wobble;
      edDegRef.current = deg;
      ghost.style.left = `${pos.x}px`;
      ghost.style.top = `${pos.y}px`;
      ghost.style.transform = `rotate(${deg}deg) scale(1.06)`;
    }
    dragRaf.current = requestAnimationFrame(dragAutoScroll);
  }

  function endEventDrag() {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (preventTouchScrollRef.current) {
      document.removeEventListener("touchmove", preventTouchScrollRef.current);
      preventTouchScrollRef.current = null;
    }
    if (dragMoveRef.current) {
      window.removeEventListener("pointermove", dragMoveRef.current);
      dragMoveRef.current = null;
    }
    dragScrollDir.current = 0;
    if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
    dragRaf.current = null;
    document.body.style.userSelect = "";
    const info = dragInfoRef.current;
    const target = dropDateRef.current;
    const over = dropOverRef.current;
    const ghost = dragGhostRef.current;
    // 던지기 판정 — 놓는 순간 충분히 빠르거나(px/ms) 빙빙 돌고 있으면(deg/frame) 날려보낸다.
    const v = edVelRef.current;
    const speed = Math.hypot(v.x, v.y);
    const angSpeed = Math.abs(edAngVelRef.current);
    const flung = Boolean(
      info?.started && ghost && !edReducedRef.current && (speed > 1.1 || angSpeed > 16)
    );
    setDropDate(null);
    setDropSlot(null);
    dropDateRef.current = null;
    dropOverRef.current = null;
    if (info?.started) justDraggedRef.current = true; // 다음 click(선택) 1회 무시
    if (flung) {
      // 유령을 던지기 루프로 넘긴다. 화면 밖으로 완전히 날아가면 그 일정을 삭제한다(낙관적 제거 +
      // Ctrl+Z 복구 스택에 적재 — 던져서 버리고, 되돌리면 같은 자리로 다시 생긴다). 새 드래그/언마운트로
      // 중간에 끊기면 삭제하지 않는다.
      dragGhostRef.current = null;
      launchFling(ghost!, v, edAngVelRef.current, info!.id, events);
      dragInfoRef.current = null;
      return;
    }
    ghost?.remove();
    dragGhostRef.current = null;
    setDragEventId(null);
    if (info?.started && target) {
      void dropEventInto(info.id, info.sourceDate, target, over);
    }
    dragInfoRef.current = null;
  }

  // 던지기: 받은 속도(px/ms)·각속도(deg/frame)로 유령을 포물선 + 회전시켜 화면 밖으로 날린다.
  // 화면 밖으로 완전히 벗어나면 그 일정을 삭제한다(commitDelete = 낙관적 제거 + Ctrl+Z 스택).
  function launchFling(
    ghost: HTMLElement,
    v: { x: number; y: number },
    angVel: number,
    eventId: string,
    snapshot: StudioScheduleEvent[]
  ) {
    let fx = v.x * 16; // px/frame(~16ms)
    let fy = v.y * 16;
    const sp = Math.hypot(fx, fy) || 1;
    const m = Math.min(60, Math.max(11, sp)); // 너무 느리면 살짝 띄우고, 너무 빠르면 가둔다
    fx = (fx / sp) * m;
    fy = (fy / sp) * m;
    let posX = edPosRef.current.x;
    let posY = edPosRef.current.y;
    let deg = edDegRef.current;
    let dvel = angVel;
    if (Math.abs(dvel) < 7) dvel = dvel >= 0 ? 7 : -7; // 프로펠러처럼 계속 돌게 최소 회전 보장
    const G = 1.7; // 던지기 중력(px/frame^2)
    flingGhostRef.current = ghost;
    const step = () => {
      fy += G;
      fx *= 0.99; // 공기저항(가로)
      posX += fx;
      posY += fy;
      deg += dvel;
      dvel *= 0.992;
      ghost.style.left = `${posX}px`;
      ghost.style.top = `${posY}px`;
      ghost.style.transform = `rotate(${deg}deg) scale(1.06)`;
      const gw = ghost.offsetWidth;
      const gh = ghost.offsetHeight;
      if (
        posX > window.innerWidth ||
        posX + gw < 0 ||
        posY > window.innerHeight ||
        posY + gh < 0
      ) {
        // 화면 밖 완전 이탈 → 유령 제거 + 일정 삭제(낙관적 + Ctrl+Z 복구 스택).
        if (flingRafRef.current) {
          cancelAnimationFrame(flingRafRef.current);
          flingRafRef.current = null;
        }
        flingGhostRef.current?.remove();
        flingGhostRef.current = null;
        setDragEventId(null);
        hapticDelete();
        commitDelete(eventId, snapshot);
        flashToast("일정을 던져 버렸어요 · Ctrl+Z로 되돌리기");
        return;
      }
      flingRafRef.current = requestAnimationFrame(step);
    };
    flingRafRef.current = requestAnimationFrame(step);
  }

  function onEventDragMove(e: PointerEvent) {
    const info = dragInfoRef.current;
    if (!info) return;
    if (!info.started) {
      const dist = Math.hypot(e.clientX - info.startX, e.clientY - info.startY);
      // 터치: 롱프레스(armed) 전에 움직이면 스크롤 의도 → 드래그 포기(타이머 취소, 리스너 정리)
      // 해서 페이지가 그냥 스크롤되게 둔다. 손가락이 멈춰 있다 집힌 뒤(armed)에만 드래그한다.
      if (info.isTouch && !info.armed) {
        if (dist > 10) {
          if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
          holdTimerRef.current = null;
          window.removeEventListener("pointermove", onEventDragMove);
          dragMoveRef.current = null;
          dragInfoRef.current = null;
        }
        return;
      }
      if (dist < 6) return;
      info.started = true;
      // 새 드래그 시작 → 이전에 날아가던 유령이 있으면 즉시 정리.
      if (flingRafRef.current) {
        cancelAnimationFrame(flingRafRef.current);
        flingRafRef.current = null;
      }
      flingGhostRef.current?.remove();
      flingGhostRef.current = null;
      const rect = info.node.getBoundingClientRect();
      // 카드(그라데이션 inline 스타일)에 직접 transform을 걸면 2색 카드에서 흔들림이 안 보이는
      // 경우가 있어, 깨끗한 래퍼 div에 transform을 걸고 그 안에 카드 복제본을 넣는다.
      const inner = info.node.cloneNode(true) as HTMLElement;
      inner.style.margin = "0";
      inner.style.width = "100%";
      inner.style.transform = "none";
      const ghost = document.createElement("div");
      ghost.className = "event-drag-ghost";
      ghost.style.width = `${rect.width}px`;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      // 중력: 잡은 지점을 회전축(pivot)으로. 그 지점이 카드 중심에서 가로로 벗어난 만큼 강하게
      // 매달린 듯 기운다(가장자리를 잡으면 반대쪽이 거의 수직으로 처짐). 최대 약 ±90°.
      ghost.style.transformOrigin = `${info.offX}px ${info.offY}px`;
      ghost.appendChild(inner);
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;
      setDragEventId(info.id);
      // 진자 물리 초기화. pivot=잡은 점, 추=카드 중심. 길이 L=잡은점→중심 거리(최소 24px),
      // φ0=로컬에서 그 벡터의 각도. 처음엔 카드가 똑바로 선 상태(추=중심 실제 위치)에서 시작해
      // 중력으로 천천히 매달린다.
      edPosRef.current = { x: rect.left, y: rect.top };
      edTargetRef.current = { x: rect.left, y: rect.top };
      edWobRef.current = 0;
      // 던지기 속도 추적 초기화.
      edVelRef.current = { x: 0, y: 0 };
      edPtrRef.current = null;
      edAngVelRef.current = 0;
      edDegRef.current = 0;
      edOffRef.current = { x: info.offX, y: info.offY };
      const lvx = rect.width / 2 - info.offX;
      const lvy = rect.height / 2 - info.offY;
      // 진자 길이를 넉넉히(최소 80px) — 짧으면 작은 손움직임에도 크게 휘둘려(특히 중앙 잡을 때
      // 옆으로만 움직여도 빙글) 과민해진다. 길게 두면 같은 움직임에도 회전이 완만해진다.
      edLenRef.current = Math.max(80, Math.hypot(lvx, lvy));
      edPhi0Ref.current = Math.atan2(lvy, lvx);
      edWorldPrevRef.current = edPhi0Ref.current; // 시작 월드각 = φ0
      const pivotX = rect.left + info.offX;
      const pivotY = rect.top + info.offY;
      edBobRef.current = { x: pivotX + lvx, y: pivotY + lvy };
      edBobPrevRef.current = { x: pivotX + lvx, y: pivotY + lvy };
      edReducedRef.current =
        reduceMotionEnabled() /* OS reduce-motion 무시 — 앱 토글만 */;
      // 드래그 동안 어디서도 글자가 선택(긁힘)되지 않게.
      document.body.style.userSelect = "none";
      dragRaf.current = requestAnimationFrame(dragAutoScroll);
    }
    // 직접 위치를 박지 않고 "목표"만 갱신 → dragAutoScroll 루프가 관성 있게 따라간다.
    edTargetRef.current = { x: e.clientX - info.offX, y: e.clientY - info.offY };
    // 포인터 속도(px/ms) 추적 — 놓는 순간 던지기 세기. EMA로 한 샘플 튐을 누른다.
    const now = performance.now();
    const ps = edPtrRef.current;
    if (ps) {
      const dt = now - ps.t;
      if (dt > 0) {
        const nvx = (e.clientX - ps.x) / dt;
        const nvy = (e.clientY - ps.y) / dt;
        edVelRef.current = {
          x: edVelRef.current.x * 0.4 + nvx * 0.6,
          y: edVelRef.current.y * 0.4 + nvy * 0.6
        };
      }
    }
    edPtrRef.current = { x: e.clientX, y: e.clientY, t: now };
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const dayEl = under?.closest("[data-isodate]") as HTMLElement | null;
    const iso = dayEl?.getAttribute("data-isodate") ?? null;
    if (iso !== dropDateRef.current) {
      dropDateRef.current = iso;
      setDropDate(iso);
    }
    // 같은/다른 날 안에서 어느 카드 앞/뒤에 놓을지 판단(순서 변경).
    //
    // 예전엔 '포인터가 카드 위에 있을 때'만 앞/뒤를 계산하고, 카드 밖(카드 사이 틈, 원래 자리,
    // 칸의 빈 공간)이면 무조건 '맨 끝'으로 쳤다. 그래서 1번 카드를 들고 2번 카드 '위쪽' 빈 공간으로
    // 가져가면 — 눈으로는 분명 위인데 — 안내선이 맨 아래에 떴다(의도와 정반대). 카드 위쪽 40%에
    // 정확히 얹어야만 위로 뜨는 것도 같은 원인.
    //
    // 이제 그 칸의 다른 카드들을 위에서부터 훑어, 포인터보다 '중심이 아래'인 첫 카드 앞에 넣는다.
    // 카드 위든 틈이든 빈 공간이든 규칙이 하나(중심선 기준) — 위에 있으면 위, 아래면 아래.
    // 포인터가 모든 카드보다 아래면 맨 끝.
    dropOverRef.current = null;
    if (dayEl) {
      const pills = Array.from(dayEl.querySelectorAll<HTMLElement>("[data-eventid]")).filter(
        (el) => el.getAttribute("data-eventid") !== info.id
      );
      for (const el of pills) {
        const r = el.getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) {
          dropOverRef.current = { id: el.getAttribute("data-eventid") ?? "", after: false };
          break;
        }
      }
    }
    // 삽입선 위치 갱신(바뀔 때만 state 변경 → 불필요한 재렌더 방지).
    const nextSlot = iso
      ? { day: iso, overId: dropOverRef.current?.id ?? null, after: dropOverRef.current?.after ?? false }
      : null;
    setDropSlot((prev) => {
      if (prev === nextSlot) return prev;
      if (
        prev &&
        nextSlot &&
        prev.day === nextSlot.day &&
        prev.overId === nextSlot.overId &&
        prev.after === nextSlot.after
      ) {
        return prev;
      }
      return nextSlot;
    });
    const margin = 80;
    dragScrollDir.current =
      e.clientY < margin ? -1 : e.clientY > window.innerHeight - margin ? 1 : 0;
  }

  function onPillPointerDown(e: ReactPointerEvent<HTMLDivElement>, event: StudioScheduleEvent) {
    if (!canEdit) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // 카드 안 버튼(삭제 등)을 누른 경우엔 드래그하지 않는다.
    if ((e.target as HTMLElement).closest("button")) return;
    const node = e.currentTarget as HTMLElement;
    const rect = node.getBoundingClientRect();
    justDraggedRef.current = false;
    const isTouch = e.pointerType !== "mouse";
    dragInfoRef.current = {
      id: event.id,
      sourceDate: getEventDateKey(event),
      node,
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      started: false,
      isTouch,
      // 마우스는 즉시 드래그 가능. 터치는 롱프레스 전까지 비활성(그 사이 움직임=스크롤).
      armed: !isTouch
    };
    if (isTouch) {
      // 제자리로 약 260ms 누르고 있으면 '집기' 성립 → 그때부터 드래그(+스크롤 차단).
      // 손가락이 그 전에 움직이면(onEventDragMove) 타이머를 취소해 페이지가 그냥 스크롤된다.
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      holdTimerRef.current = setTimeout(() => {
        const info = dragInfoRef.current;
        if (!info || info.started) return;
        info.armed = true;
        hapticTick(); // 집었다는 촉각 신호
        // 드래그 동안 네이티브 스크롤 차단(비수동 touchmove preventDefault).
        const block = (ev: TouchEvent) => ev.preventDefault();
        preventTouchScrollRef.current = block;
        document.addEventListener("touchmove", block, { passive: false });
      }, 260);
    }
    dragMoveRef.current = onEventDragMove;
    window.addEventListener("pointermove", onEventDragMove);
    window.addEventListener("pointerup", endEventDrag, { once: true });
    window.addEventListener("pointercancel", endEventDrag, { once: true });
  }

  // "끈"(이어진 일정): 멀티데이거나 link로 앞뒤가 이어진 일정. 같은 날에서 항상 위로 정렬된다.
  function isConnectedEvent(e: StudioScheduleEvent) {
    return (
      (e.endDateKey != null && e.endDateKey > getEventDateKey(e)) ||
      Boolean(e.linkNext) ||
      events.some((o) => o.linkNext === e.id)
    );
  }

  // 드래그로 집은 카드와 '이을 수 있는' 상대들을 계산해 강조/흐림을 켠다. 이을 수 있음 =
  // buildLinkChain이 성립(둘 사이 매일 연속 + 맞닿는 변의 대표 태그 일치). 없으면 순수 이동 드래그.
  function armConnectCandidates(draggedId: string) {
    const dragged = events.find((e) => e.id === draggedId);
    if (!dragged || dragged.isSupport) return;
    const set = new Set<string>();
    for (const other of events) {
      if (other.id === draggedId || other.isSupport) continue;
      if (buildLinkChain(dragged, other, events)) set.add(other.id);
    }
    connectCandidatesRef.current = set;
    setConnectCandidates(set);
  }
  function clearConnectCandidates() {
    if (connectCandidatesRef.current.size) {
      connectCandidatesRef.current = new Set();
      setConnectCandidates(new Set());
    }
    if (connectHoverRef.current) {
      connectHoverRef.current = null;
      setConnectHoverId(null);
    }
    setConnectSourceId(null);
  }

  // 두 카드 사이 구간을 잇는다(각 일정 linkNext = 다음 id). 낙관 반영 후 서버엔 실제 id로.
  // 드래그-놓기(연결)와 (임시로 남긴) 클릭-잇기 양쪽에서 쓴다.
  function connectChain(anchorId: string, targetId: string) {
    if (!canEdit) return;
    const anchor = events.find((e) => e.id === anchorId);
    const target = events.find((e) => e.id === targetId);
    if (!anchor || !target) return;
    const chain = buildLinkChain(anchor, target, events);
    if (!chain || chain.length < 2) return;
    // 이미 그대로 이어져 있으면(변화 없음) 서버 쓰기·토스트 없이 조용히 넘어간다.
    const linkMap = new Map<string, string>();
    let changed = false;
    for (let i = 0; i < chain.length - 1; i += 1) {
      linkMap.set(chain[i], chain[i + 1]);
      if (events.find((e) => e.id === chain[i])?.linkNext !== chain[i + 1]) changed = true;
    }
    if (!changed) return;
    const snapshot = events;
    setEvents((prev) =>
      prev.map((e) => (linkMap.has(e.id) ? { ...e, linkNext: linkMap.get(e.id) } : e))
    );
    setActionError(null);
    hapticTick();
    flashToast("이어붙였어요");
    void (async () => {
      const result = await enqueueWrite(async () => {
        const resolved = await Promise.all(chain.map(resolveEventId));
        if (resolved.some((id) => !id)) {
          setEvents(snapshot);
          return null;
        }
        return postStudioWrite("linkChain", { orderedIds: resolved as string[] });
      });
      if (!result.ok) {
        setActionError(result.error);
        setEvents(snapshot);
      }
    })();
  }

  // ── 우클릭 잇기/끊기 제스처 ─────────────────────────────────────────────────
  // 이어진 각 쌍(earlier→next)마다 '끊기 존'을 만든다. earlier '오른쪽 절반' + next '왼쪽 절반' —
  // 빨간 선이 이 존을 지나면(=두 카드의 절반/절반 경계를 훑으면) 그 연결(earlier.linkNext)을 끊는다.
  // 절반이라 존이 넓어 잘 잡히고, 중간 카드도 왼쪽 절반=앞 연결/오른쪽 절반=뒤 연결로 구분된다.
  // 주 경계(토→일)로 갈라진 경우엔 토요일 오른쪽 절반이나 일요일 왼쪽 절반 어느 쪽을 그어도 끊긴다.
  function collectSeams(): { id: string; x1: number; x2: number; top: number; bottom: number }[] {
    const out: { id: string; x1: number; x2: number; top: number; bottom: number }[] = [];
    for (const ev of events) {
      if (!ev.linkNext) continue;
      const el = document.querySelector<HTMLElement>(`[data-eventid="${CSS.escape(ev.id)}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        // earlier 오른쪽 절반(중앙~오른쪽 변, 살짝 넘겨).
        out.push({ id: ev.id, x1: r.left + r.width / 2, x2: r.right + 3, top: r.top - 3, bottom: r.bottom + 3 });
      }
      const nextEl = document.querySelector<HTMLElement>(
        `[data-eventid="${CSS.escape(ev.linkNext)}"]`
      );
      if (nextEl) {
        const nr = nextEl.getBoundingClientRect();
        // next 왼쪽 절반(왼쪽 변~중앙).
        out.push({ id: ev.id, x1: nr.left - 3, x2: nr.left + nr.width / 2, top: nr.top - 3, bottom: nr.bottom + 3 });
      }
    }
    return out;
  }
  // 선분 (x1,y1)-(x2,y2)가 끊기 존(사각형)을 지나는가 — 끝점이 안에 있거나(느린 스침) 존의 세로
  // 변을 가로지르면(빠른 스트로크) 성립. 넓은 절반-존 + 이 판정으로 훨씬 잘 끊긴다.
  function segmentHitsZone(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    z: { x1: number; x2: number; top: number; bottom: number }
  ): boolean {
    const inside = (x: number, y: number) =>
      x >= z.x1 && x <= z.x2 && y >= z.top && y <= z.bottom;
    if (inside(ax, ay) || inside(bx, by)) return true;
    return (
      segCrossesVerticalLine(ax, ay, bx, by, z.x1, z.top, z.bottom) ||
      segCrossesVerticalLine(ax, ay, bx, by, z.x2, z.top, z.bottom)
    );
  }
  function segCrossesVerticalLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    X: number,
    top: number,
    bottom: number
  ): boolean {
    const d1 = x1 - X;
    const d2 = x2 - X;
    if ((d1 <= 0 && d2 >= 0) || (d1 >= 0 && d2 <= 0)) {
      if (d1 === 0 && d2 === 0) return Math.max(y1, y2) >= top && Math.min(y1, y2) <= bottom;
      const t = d1 / (d1 - d2);
      const yc = y1 + t * (y2 - y1);
      return yc >= top && yc <= bottom;
    }
    return false;
  }
  function makeGestureSvg(): SVGSVGElement {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "right-gesture-overlay");
    Object.assign(svg.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: "9998"
    });
    return svg;
  }
  function onRightMove(e: PointerEvent) {
    const g = rightGestureRef.current;
    if (!g) return;
    const ns = "http://www.w3.org/2000/svg";
    if (!g.moved) {
      if (Math.hypot(e.clientX - g.startX, e.clientY - g.startY) < 6) return;
      g.moved = true;
      rightDragMovedRef.current = true; // 뒤따르는 브라우저 contextmenu 1회 차단
      const svg = makeGestureSvg();
      if (g.mode === "connect" && g.sourceId) {
        armConnectCandidates(g.sourceId); // 이을 수 있는 상대 강조/흐림
        setConnectSourceId(g.sourceId); // 소스 카드는 흐리게 하지 않는다
        const sEl = document.querySelector<HTMLElement>(
          `[data-eventid="${CSS.escape(g.sourceId)}"]`
        );
        const sr = sEl?.getBoundingClientRect();
        g.srcX = sr ? sr.left + sr.width / 2 : g.startX;
        g.srcY = sr ? sr.top + sr.height / 2 : g.startY;
        const line = document.createElementNS(ns, "line");
        line.setAttribute("stroke", "rgba(139,92,246,0.92)");
        line.setAttribute("stroke-width", "3");
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("stroke-dasharray", "1 8");
        line.setAttribute("x1", String(g.srcX));
        line.setAttribute("y1", String(g.srcY));
        svg.appendChild(line);
        g.path = line;
      } else {
        g.seams = collectSeams();
        // 실제 그은 경로가 아니라 '시작점→커서'의 깔끔한 직선으로 보여준다(삐뚤빼뚤 X).
        const line = document.createElementNS(ns, "line");
        line.setAttribute("stroke", "rgba(220,38,38,0.92)");
        line.setAttribute("stroke-width", "3");
        line.setAttribute("stroke-linecap", "round");
        line.setAttribute("x1", String(g.startX));
        line.setAttribute("y1", String(g.startY));
        svg.appendChild(line);
        g.path = line;
      }
      document.body.appendChild(svg);
      g.svg = svg;
    }
    if (g.mode === "connect") {
      (g.path as SVGLineElement).setAttribute("x2", String(e.clientX));
      (g.path as SVGLineElement).setAttribute("y2", String(e.clientY));
      const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const pid = under?.closest("[data-eventid]")?.getAttribute("data-eventid") ?? null;
      const hover = pid && connectCandidatesRef.current.has(pid) ? pid : null;
      if (connectHoverRef.current !== hover) {
        connectHoverRef.current = hover;
        setConnectHoverId(hover);
      }
    } else {
      (g.path as SVGLineElement).setAttribute("x2", String(e.clientX));
      (g.path as SVGLineElement).setAttribute("y2", String(e.clientY));
      // 직전 점→현재 점 선분이 '끊기 존(절반)'을 지나면 그 연결을 끊는다(넓은 존 + 관대한 판정).
      for (const s of g.seams) {
        if (g.cutSet.has(s.id)) continue;
        if (segmentHitsZone(g.prevX, g.prevY, e.clientX, e.clientY, s)) {
          g.cutSet.add(s.id);
          performSeamCut(s.id);
        }
      }
      g.prevX = e.clientX;
      g.prevY = e.clientY;
    }
  }
  function onRightUp() {
    window.removeEventListener("pointermove", onRightMove);
    window.removeEventListener("pointerup", onRightUp);
    window.removeEventListener("pointercancel", onRightUp);
    const g = rightGestureRef.current;
    rightGestureRef.current = null;
    if (!g) return;
    if (g.moved && g.mode === "connect") {
      const hover = connectHoverRef.current;
      if (hover && g.sourceId) connectChain(g.sourceId, hover);
    }
    clearConnectCandidates();
    g.svg?.remove();
  }
  // 우클릭 눌림 — '이미 선택된 카드' 위에서 시작할 때만 잇기(보라 선), 그 외(다른 카드·빈 곳·
  // 달력 밖 어디든)는 끊기(빨간 선). 끊기를 카드 위에서 시작해도 잇기로 오인되지 않게, 또 끊는
  // 선을 달력 밖에서 시작해 주 경계 이음새까지 그어 올 수 있게 한다. 실제 시작은 6px 이상 움직였을 때.
  function beginRightGesture(e: PointerEvent) {
    if (!canEdit || e.button !== 2 || e.pointerType !== "mouse") return;
    const el = e.target as HTMLElement;
    const pill = el.closest<HTMLElement>("[data-eventid]");
    const pillId = pill?.getAttribute("data-eventid") ?? null;
    // 잇기 = 선택된 카드에서 출발할 때만. 나머지는 전부 끊기(어디서 시작하든).
    const isConnect = Boolean(pillId) && pillId === selectedEventId;
    rightGestureRef.current = {
      mode: isConnect ? "connect" : "cut",
      sourceId: isConnect ? pillId : null,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      svg: null,
      path: null,
      srcX: e.clientX,
      srcY: e.clientY,
      prevX: e.clientX,
      prevY: e.clientY,
      seams: [],
      cutSet: new Set<string>()
    };
    window.addEventListener("pointermove", onRightMove);
    window.addEventListener("pointerup", onRightUp, { once: true });
    window.addEventListener("pointercancel", onRightUp, { once: true });
  }

  // 우클릭 제스처 배선: 우클릭 눌림을 캡처로 잡고(잇기/끊기 시작), 뒤따르는 contextmenu는 '드래그
  // 였을 때만' 막는다(단순 우클릭은 통과 → 셀의 휴뱅 메뉴 그대로). 소유자(canEdit)에서만.
  useEffect(() => {
    if (!canEdit) return;
    const onDown = (e: PointerEvent) => beginRightGesture(e);
    // 그리드 안 우클릭은 잇기/끊기 전용 → 항상 억제. 밖에서도 '드래그(끊기)였다면' 뒤따르는
    // 메뉴 1회 억제(단순 우클릭은 통과 → 밖에선 브라우저 메뉴 정상).
    const onCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".studio-month-grid")) {
        e.preventDefault();
      } else if (rightDragMovedRef.current) {
        e.preventDefault();
      }
      rightDragMovedRef.current = false;
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("contextmenu", onCtx, true);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("contextmenu", onCtx, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, events, selectedEventId]);

  // 이동(드롭) 저장을 직렬 큐로 처리 — 빠른 연속 이동도 큐 순서대로 저장돼 '마지막 위치'가 서버
  // 최종값이 된다(레이스로 옛 위치가 저장되는 문제 방지). temp id는 저장 완료까지 기다려 보낸다.
  function enqueueMovePersist(move: {
    id: string;
    sourceDate: string;
    targetDate: string;
    orderedIds: string[];
  }) {
    pendingPersistRef.current += 1;
    setSyncingIds((p) => (p.includes(move.id) ? p : [...p, move.id])); // 이 카드에 '동기화 중' 표시
    movePersistChainRef.current = movePersistChainRef.current
      .catch(() => {})
      .then(() => runMovePersist(move))
      .finally(() => {
        pendingPersistRef.current = Math.max(0, pendingPersistRef.current - 1);
        setSyncingIds((p) => p.filter((x) => x !== move.id)); // 반영 끝 → 표시 제거
      });
  }

  async function runMovePersist(move: {
    id: string;
    sourceDate: string;
    targetDate: string;
    orderedIds: string[];
  }) {
    const realMovedId = await resolveEventId(move.id);
    if (!realMovedId) return; // 저장 실패/취소 — 둘 곳 없음
    const realOrderedIds = await Promise.all(move.orderedIds.map((eid) => resolveEventId(eid)));
    if (realOrderedIds.some((x) => x == null)) return; // 같은 날 미저장 카드 — 다음 이동 때 정리됨
    // keepalive 전송(studioWrite) → 옮기고 바로 달을 넘기거나 창을 닫아도 전송이 끝까지 보장된다.
    // (일반 fetch/서버액션은 페이지를 떠나면 중간에 끊겨 "옮긴 곳에 저장 안 됨"이 났다.)
    const result = await studioWrite("reorder", {
      dateKey: move.targetDate,
      orderedIds: realOrderedIds as string[],
      movedId: move.targetDate !== move.sourceDate ? realMovedId : undefined
    });
    if (!result.ok) {
      setActionError(result.error);
      router.refresh(); // 서버 진실로 재동기화(잘못된 중간 상태로 순간이동하지 않게)
    }
  }

  // 드롭: 일정을 target 날짜로(필요 시) 옮기고, 같은 날 안에서 over(위/아래) 위치에 끼워 순서 변경.
  function dropEventInto(
    id: string,
    sourceDate: string,
    targetDate: string,
    over: { id: string; after: boolean } | null
  ) {
    const moved = events.find((ev) => ev.id === id);
    if (!moved) return;

    // target 날짜의 (드래그 중인 카드를 뺀) 현재 표시 순서.
    const dayEvents = getEventsForDate(events, targetDate).filter((e) => e.id !== id);
    let insertIdx = dayEvents.length; // 기본: 맨 끝
    if (over && over.id !== id) {
      const idx = dayEvents.findIndex((e) => e.id === over.id);
      if (idx >= 0) insertIdx = over.after ? idx + 1 : idx;
    }
    // 끈(이어진/멀티데이 일정)은 항상 맨 위에 고정 — 그 위로는 못 끼운다. 끈 아래로만 배치.
    const connectedCount = dayEvents.filter((e) => isConnectedEvent(e)).length;
    insertIdx = Math.max(insertIdx, connectedCount);
    const orderedIds = [
      ...dayEvents.slice(0, insertIdx).map((e) => e.id),
      id,
      ...dayEvents.slice(insertIdx).map((e) => e.id)
    ];

    // 바뀐 게 없으면(같은 날 + 같은 순서) 아무것도 안 한다.
    const currentIds = getEventsForDate(events, targetDate).map((e) => e.id);
    if (targetDate === sourceDate && orderedIds.join() === currentIds.join()) {
      return;
    }

    const delta = Math.round(
      (new Date(`${targetDate}T00:00:00Z`).getTime() -
        new Date(`${getEventDateKey(moved)}T00:00:00Z`).getTime()) /
        86400000
    );
    // Ctrl+Z용 — '옮기기 전'의 원래 날짜와 그 날 순서를 남긴다(실제로 바뀔 때만: 위 no-op 반환 뒤).
    // temp id를 옮겼다면 그 사이 실제 id로 바뀔 수 있는데, 되돌릴 때 tempToRealRef로 해소한다.
    deletedStackRef.current.push({
      type: "move",
      holder: { id },
      fromDate: sourceDate,
      toDate: targetDate,
      fromOrderedIds: getEventsForDate(events, sourceDate).map((e) => e.id)
    });

    const orderPos = new Map(orderedIds.map((eid, i) => [eid, i] as const));
    flipArmedRef.current = true; // 드래그 재정렬 — 이 변화에만 형제 카드 FLIP 활주를 허용.
    // 낙관적 반영(즉시). 서버 prop이 이걸 덮어쓰지 않게 위 prop 동기화는 pendingPersist 동안 멈춘다.
    setEvents((prev) =>
      prev.map((ev) => {
        let next = ev;
        if (ev.id === id && targetDate !== sourceDate) {
          next = {
            ...next,
            startsAt: next.startsAt.replace(/^\d{4}-\d{2}-\d{2}/, targetDate),
            endDateKey: next.endDateKey ? addDaysIso(next.endDateKey, delta) : next.endDateKey
          };
        }
        const pos = orderPos.get(ev.id);
        if (pos !== undefined) next = { ...next, sortOrder: pos };
        return next;
      })
    );
    setSelectedDate(targetDate);
    markJustSaved(id); // A3: 착지한 카드가 통통 안착(+대상 셀은 .selected의 cell-select-pop)
    flashToast(targetDate === sourceDate ? "순서를 바꿨어요" : `${targetDate}로 옮겼어요`);
    // 서버 저장은 직렬 큐로 — 빠른 연속 이동도 순서대로 저장돼 마지막 위치가 서버 최종값이 된다.
    enqueueMovePersist({ id, sourceDate, targetDate, orderedIds });
  }

  // showPanel=false면 오른쪽 편집/상세 패널을 열지 않고 form만 채운다(업 도움 시트처럼 팝업만
  // 띄울 때 — 패널이 같이 슬라이드 인 하는 군더더기를 없앤다).
  function selectEvent(event: StudioScheduleEvent, showPanel = true) {
    setSelectedDate(event.startsAt.slice(0, 10));
    setSelectedEventId(event.id);
    // 원본을 기준(baseline)으로 삼고, TTL 안에 미저장 임시 내용이 있으면 그걸 대신 띄운다.
    const base = eventToForm(event);
    editBaselineRef.current = draftFingerprint(base);
    const draft = freshDraft(`evt:${event.id}`);
    setForm(draft ? { ...draft.form, id: event.id } : base);
    setDraftRestored(Boolean(draft));
    if (showPanel) {
      setEditorVisible(true);
      bumpEditor(); // 사용자가 다른 일정을 고름 → 폼 새로 마운트
    }
  }

  // #3: 매니저용 — 일정의 태그 할당을 토글한다(최대 2개). 낙관적 반영 후 실패 시 롤백.
  // 태그를 강제하지 않는다: 모두 끄면 태그 0개(색 없는 흰 카드). '기타'는 인사이트 합성 버킷일 뿐.

  // 이벤트 하나의 태그 저장을 직렬 큐에 태운다. 큐의 각 단계는 '그 시점의 최신 의도'(desired)를
  // 보내므로, 빠른 연속 토글은 마지막 상태로 collapse되고 옛 요청이 새 요청을 덮어쓰지 못한다.
  function queueTagWrite(eventId: string) {
    const prev = tagWriteChainRef.current.get(eventId) ?? Promise.resolve();
    const run = prev.then(async () => {
      const desired = tagDesiredRef.current.get(eventId);
      if (!desired) return;
      if (tagSentRef.current.get(eventId) === desired) return; // 이미 같은 상태를 보냄(토글 없었음)
      tagSentRef.current.set(eventId, desired);
      const res = await studioWrite("tags", {
        eventId,
        tagIds: desired,
        primaryTagIds: desired
      });
      if (!res.ok) {
        setActionError(res.error);
        // 서버 실패 → 진실로 재동기화하고 의도 캐시 비운다(다음 토글은 서버 상태에서 출발).
        tagDesiredRef.current.delete(eventId);
        tagSentRef.current.delete(eventId);
        router.refresh();
      } else {
        hapticTick(); // ② 서버확인 톡(2단계 컨벤션 — 누름 톡은 피커 칩에서 이미 울림)
      }
    });
    tagWriteChainRef.current.set(eventId, run.catch(() => {}));
  }

  function toggleEventTag(event: StudioScheduleEvent, tagId: string) {
    if (blockedByPreview()) return;
    // 현재 의도(직렬 큐 기준)에서 출발 — 빠른 연속 토글에도 stale prop을 안 읽는다.
    const cur = tagDesiredRef.current.get(event.id) ?? event.tagIds;
    const has = cur.includes(tagId);
    const rawNext = has
      ? cur.filter((id) => id !== tagId)
      : cur.length >= maxEventTags
        ? cur
        : [...cur, tagId];
    if (rawNext === cur) {
      return; // 이미 최대 — 변화 없음
    }
    const nextTagIds = rawNext;
    tagDesiredRef.current.set(event.id, nextTagIds);
    setActionError(null);
    setEvents((prev) =>
      prev.map((e) =>
        e.id === event.id ? { ...e, tagIds: nextTagIds, primaryTagIds: nextTagIds } : e
      )
    );
    queueTagWrite(event.id);
  }

  // A1: 매니저·작업자용 읽기전용 일정 상세. owner 편집 폼을 회색으로 보여주는 대신,
  // 제목·날짜·공개범위·태그·업 도움 링크만 깔끔히 보여준다. owner_private는 애초에 비-owner에게
  // 로드되지 않는다. 매니저(canEditSupportThing)는 업 도움 이벤트에 한해 "업 도움 수정"을 쓸 수 있다.
  function renderReadonlyDetail() {
    const selectedEvent = selectedEventId
      ? events.find((event) => event.id === selectedEventId)
      : null;
    return (
      <div className="event-detail-readonly" key={`${selectedDate}:${selectedEventId ?? "new"}`}>
        <div className="editor-heading">
          {/* 윗줄: 접기(>) 옆에 라벨. 읽기전용이라 저장 버튼은 없다. 날짜는 아래줄(라벨 밑 정렬). */}
          <div className="editor-heading-bar">
            <div className="editor-heading-left">
              <button
                aria-label="상세 카드 닫기"
                className="editor-collapse"
                onClick={() => setEditorVisible(false)}
                title="닫기"
                type="button"
              >
                <ChevronRight aria-hidden="true" size={20} strokeWidth={2.5} />
              </button>
              <p className="eyebrow">일정 보기</p>
            </div>
          </div>
          <h2 className="editor-date editor-heading-date" key={selectedDate}>
            {selectedDate}
          </h2>
        </div>
        {!selectedEvent ? (
          <p className="detail-empty">이 날의 일정을 누르면 자세히 볼 수 있어요.</p>
        ) : (
          <>
            <div className="detail-row">
              <span className="detail-label">제목</span>
              <p className="detail-value">{selectedEvent.publicTitle || "(제목 없음)"}</p>
            </div>
            <div className="detail-row">
              <span className="detail-label">공개 범위</span>
              <p className="detail-value">{VISIBILITY_LABEL[selectedEvent.visibilityScope]}</p>
            </div>
            {canEditTagsThing ? (
              // 매니저: 태그 할당을 직접 토글(최대 2개). 작업자는 읽기 전용 칩만 본다.
              <div className="detail-row">
                <span className="detail-label">
                  태그 <span className="tag-picker-hint">최대 {maxEventTags}개 · 누르면 바로 적용</span>
                </span>
                <div className="tag-picker">
                  {/* 게이트는 좁게 — 예전엔 disabled={pending}이었는데 그 pending은 저장·삭제·이동이
                      함께 쓰는 transition이라, 무관한 배경 저장 하나에 태그 고르기가 통째로 죽었다
                      ("누르면 바로 적용"이라 적어놓고). 태그 쓰기는 아래 toggleEventTag가 일정별
                      직렬 체인 + 의도 ref + 중복 제거로 연타를 이미 감당한다. */}
                  <TagPicker
                    max={maxEventTags}
                    onToggle={(id) => toggleEventTag(selectedEvent, id)}
                    palette={palette}
                    selectedIds={selectedEvent.tagIds}
                    tags={viewTags}
                  />
                </div>
              </div>
            ) : selectedEvent.tagIds.length > 0 ? (
              <div className="detail-row">
                <span className="detail-label">태그</span>
                <div className="detail-tags">
                  {selectedEvent.tagIds.map((id) => {
                    const tag = legendTags.find((item) => item.id === id);
                    const v = tag ? tagVisual.visualOf(tag.id) : null;
                    return tag && v && !v.missing && v.bg ? (
                      <span
                        className="detail-tag"
                        key={id}
                        style={{
                          backgroundColor: v.bg,
                          borderColor: v.border ?? undefined,
                          color: v.legacyTextColor ?? undefined
                        }}
                      >
                        {tag.displayName}
                      </span>
                    ) : null;
                  })}
                </div>
              </div>
            ) : null}
            {selectedEvent.isSupport ? (
              <div className="detail-row">
                <span className="detail-label">업 도와주기</span>
                <div className="detail-value">
                  {selectedEvent.supportUrl ? (
                    <a href={selectedEvent.supportUrl} rel="noreferrer" target="_blank">
                      {selectedEvent.supportUrl}
                    </a>
                  ) : (
                    "링크 없음"
                  )}
                  {selectedEvent.endDateKey ? (
                    <div className="detail-sub">~ {selectedEvent.endDateKey}</div>
                  ) : null}
                </div>
              </div>
            ) : null}
            {selectedEvent.isSupport && canEditSupportThing ? (
              <button
                className="button"
                onClick={() => openSupportSheet(selectedEvent)}
                type="button"
              >
                업 도움 기간/링크 수정
              </button>
            ) : null}
          </>
        )}
      </div>
    );
  }

  // 카드가 열려 있는 동안 폼 변경을 계속 추적해, 원본과 다르면(미저장 변경) 드래프트로 보관하고
  // 같아지면 지운다. 닫기 경로(바깥 클릭·X·뒤로가기)마다 따로 갈고리를 걸 필요 없이, 닫히는 순간의
  // 마지막 내용이 이미 보관돼 있다. 카드가 닫혀 있으면 추적하지 않는다 — closeMobileEdit의 폼
  // 리셋(빈 폼)이 보관본을 덮어쓰지 못하게.
  useEffect(() => {
    if (!draftHydratedRef.current || !canEdit) return;
    const open = mobileEditId !== null || editorVisible;
    if (!open) return;
    const key = draftKeyFor();
    if (!key) return;
    if (draftFingerprint(form) !== editBaselineRef.current) {
      editDraftsRef.current.set(key, { form, ts: Date.now() });
    } else {
      editDraftsRef.current.delete(key);
    }
    persistEditDrafts(editDraftsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editorVisible, mobileEditId, selectedEventId, selectedDate, canEdit]);

  // '새로 쓰기' — 복원된 임시 내용을 버리고 원본(기존 일정) 또는 빈 새 카드로 되돌린다.
  function discardDraft() {
    const key = draftKeyFor();
    if (key) {
      editDraftsRef.current.delete(key);
      persistEditDrafts(editDraftsRef.current);
    }
    const ev = selectedEventId ? events.find((e) => e.id === selectedEventId) : null;
    setForm(ev ? eventToForm(ev) : createEmptyForm());
    setDraftRestored(false);
    hapticTick();
  }

  function saveEvent(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault(); // 폼 제출 외에 단축키(Ctrl+S)로도 부를 수 있게 옵셔널.
    if (blockedByPreview()) return;
    if (!canEdit) {
      return;
    }
    hapticTick(); // ① 눌림: 누른 즉시 "눌렀다" 톡(서버확인 톡은 응답 후 — 2단계 컨벤션)

    const existing = events.find((e) => e.id === form.id);
    const isNew = !form.id;
    const tempId = form.id ?? `temp-${Math.random().toString(36).slice(2)}`;
    // 데스크톱은 안전상 비공개 레이어를 풀어야 비공개 범위를 지정한다.
    // 모바일(소유자/개발자 본인 기기)은 잠금 없이 바로 공개 범위를 지정할 수 있다.
    const scope: EventVisibilityScope =
      canReadPrivate || isNarrow ? form.visibilityScope : "public";
    const endDateKey =
      form.isSupport && form.endDateKey ? form.endDateKey : undefined;
    // 떡밥: 공개 일정 + 공개 시각이 있어야 성립. 공개 시각은 KST 입력 → ISO(UTC)로.
    const teaserOn = form.teaser && Boolean(form.teaserRevealAt) && scope === "public";
    const teaserRevealIso = teaserOn ? kstLocalInputToIso(form.teaserRevealAt) : null;
    // 낙관적 일정 객체(서버 응답 전 화면에 바로 그린다).
    const optimistic: StudioScheduleEvent = {
      id: tempId,
      startsAt: `${selectedDate}T00:00:00+09:00`,
      endDateKey,
      linkNext: existing?.linkNext,
      isSupport: form.isSupport,
      supportUrl: form.supportUrl || undefined,
      isAllDay: true,
      isTentative: form.isTentative,
      publicTitle: form.publicTitle,
      status: form.status,
      visibilityScope: scope,
      category: form.category,
      tagIds: form.tagIds,
      primaryTagIds: form.primaryTagIds.slice(0, 2),
      sortOrder: existing?.sortOrder ?? 0,
      teaser: teaserOn || undefined,
      teaserRevealAt: teaserRevealIso ?? undefined
    };
    // 서버로 보낼 입력은 폼 초기화 전에 미리 만들어 둔다.
    const payload = {
      id: form.id,
      dateKey: selectedDate,
      endDateKey: form.isSupport ? form.endDateKey : "",
      startTime: "",
      endTime: "",
      isAllDay: true,
      isTentative: form.isTentative,
      publicTitle: form.publicTitle,
      publicDescription: "",
      category: form.category,
      status: form.status,
      visibilityScope: scope,
      tagIds: form.tagIds,
      primaryTagIds: form.primaryTagIds.slice(0, 2),
      isSupport: form.isSupport,
      supportUrl: form.supportUrl,
      teaser: teaserOn,
      teaserRevealAt: teaserRevealIso
    };
    const snapshot = events;

    // (FLIP은 기본 OFF — 드롭 재정렬에서만 arm. 저장은 형제 카드를 밀지 않는다.)
    setEvents((prev) =>
      isNew ? [...prev, optimistic] : prev.map((e) => (e.id === tempId ? optimistic : e))
    );
    // 저장 후에도 '그 일정을 계속 편집'하는 상태로 둔다(빈 카드로 리셋하지 않음) — 폼 key(editorKey)도
    // 안 올려 재마운트/깜빡임이 없다. 새 일정이면 임시 id로 선택을 잡아두고, 완료 시 실제 id로 옮긴다.
    setSelectedEventId(tempId);
    setForm((f) => ({ ...f, id: tempId }));
    setActionError(null);
    markJustSaved(tempId); // 카드가 통통 착지하며 반짝
    flashEditorPanel(); // 편집 패널도 살짝 반짝 → 저장 완료를 더 확실히 인지
    // 저장됨 = 더 이상 미저장 변경 없음 → 기준을 방금 저장한 내용으로 올리고 임시 보관을 비운다.
    editBaselineRef.current = draftFingerprint(form);
    setDraftRestored(false);
    editDraftsRef.current.delete(`new:${selectedDate}`);
    if (form.id) editDraftsRef.current.delete(`evt:${form.id}`);
    persistEditDrafts(editDraftsRef.current);

    // 저장이 끝나면 실제 id(또는 실패 시 null)로 풀리는 약속 — "잇기"가 이걸 기다린다.
    let resolveSave: (id: string | null) => void = () => {};
    if (isNew) {
      pendingSavesRef.current.set(
        tempId,
        new Promise<string | null>((r) => {
          resolveSave = r;
        })
      );
    }

    startTransition(async () => {
      const result = await studioWrite("save", payload);
      if (!result.ok) {
        setActionError(result.error);
        setEvents(snapshot); // 실패 → 되돌림
        resolveSave(null);
        pendingSavesRef.current.delete(tempId);
        return;
      }
      hapticTick(); // ② 서버확인: 응답 OK 후 한 번 더 톡 → "서버에 올라갔다"는 체감(2단계 컨벤션)
      // 새 일정이면 임시 id를 실제 id로 교체 + 이 임시 id를 가리키던 linkNext도 함께 교체.
      if (isNew && result.id) {
        const realId = result.id;
        tempToRealRef.current.set(tempId, realId); // 저장 직후 삭제해도 서버 삭제가 실제 id로 가게
        setEvents((prev) =>
          prev.map((e) => {
            let next = e;
            if (e.id === tempId) next = { ...next, id: realId };
            if (e.linkNext === tempId) next = { ...next, linkNext: realId };
            return next;
          })
        );
        // 착지 반짝이 임시 id에 걸려 있었다면 실제 id로 이어준다(키가 바뀌어도 끊기지 않게).
        setJustSavedId((p) => (p === tempId ? realId : p));
        // 편집 카드가 방금 저장한 새 일정을 띄우고 있으면 선택을 실제 id로 옮긴다(editorKey는 그대로
        // — 재마운트/깜빡임 없이 같은 카드가 '수정' 상태로 이어진다).
        setSelectedEventId((cur) => (cur === tempId ? realId : cur));
        setForm((f) => (f.id === tempId ? { ...f, id: realId } : f));
        resolveSave(realId);
        pendingSavesRef.current.delete(tempId);
      }
    });
  }

  function prefersReducedMotion() {
    return reduceMotionEnabled() /* OS reduce-motion 무시 — 앱 토글만 */;
  }
  // 저장·생성 직후 그 카드를 잠깐 "방금 저장됨"으로 표시 → CSS가 통통 착지+반짝을 입힌다.
  function markJustSaved(id: string) {
    if (prefersReducedMotion()) return;
    setJustSavedId(id);
    if (justSavedTimer.current) window.clearTimeout(justSavedTimer.current);
    justSavedTimer.current = window.setTimeout(() => setJustSavedId(null), 650);
  }

  // 편집 패널 반짝(저장 완료 신호). 패널이 열려 있을 때만 의미가 있다.
  function flashEditorPanel() {
    if (prefersReducedMotion() || !editorVisible) return;
    setPanelSaved(false);
    // 연속 저장에도 매번 다시 재생되도록 다음 프레임에 켠다(같은 값 재설정은 애니 리트리거 안 됨).
    requestAnimationFrame(() => {
      setPanelSaved(true);
      if (panelSavedTimer.current) window.clearTimeout(panelSavedTimer.current);
      panelSavedTimer.current = window.setTimeout(() => setPanelSaved(false), 620);
    });
  }

  function deleteEvent(targetId: string) {
    if (blockedByPreview()) return;
    if (!canEdit) {
      return;
    }
    if (!events.some((e) => e.id === targetId)) return;
    // 편집 중인 바로 그 일정을 지우면 카드를 '닫지(슬라이드 아웃)' 않고 같은 자리에서 빈 새 카드로
    // 비운다 — 여러 개를 연속으로 지울 때 카드가 들어갔다 나왔다 하지 않게(공간 안정성). editorKey는
    // 안 올려 매끄럽게. 다른 일정 삭제는 편집 카드를 건드리지 않는다.
    if (selectedEventId === targetId) {
      setSelectedEventId(null);
      setForm(createEmptyForm());
      // 임시 보관 정리 — 지운 일정의 드래프트를 버리고, 복원 안내 박스를 닫고, 기준을 빈 폼으로
      // 내린다. 안 하면 ① 안내 박스가 남고(DEL로 지워도 안 사라짐) ② 비워진 폼이 옛 기준 대비
      // '변경'으로 잡혀 캡처가 빈 드래프트를 다시 저장해 잔류한다.
      editBaselineRef.current = draftFingerprint(createEmptyForm());
      editDraftsRef.current.delete(`evt:${targetId}`);
      editDraftsRef.current.delete(`new:${selectedDate}`);
      persistEditDrafts(editDraftsRef.current);
      setDraftRestored(false);
    }
    hapticDelete(); // 또렷한 한 번(Android만; iOS·미지원은 조용히 무시)
    // 톡! 줄어들며 사라지는 동안만 잠깐 카드를 남겼다가 실제로 제거한다(reduced-motion이면 즉시).
    if (!prefersReducedMotion() && !deletingIds.has(targetId)) {
      const snapshot = events;
      setDeletingIds((prev) => new Set(prev).add(targetId));
      window.setTimeout(() => commitDelete(targetId, snapshot), 230);
      return;
    }
    commitDelete(targetId, events);
  }

  function commitDelete(targetId: string, snapshot: StudioScheduleEvent[]) {
    const removed = snapshot.find((e) => e.id === targetId) ?? null;
    // poof가 끝났으니 표시를 거둔다(실패해 되살아날 때 정상 모습으로 돌아오게).
    setDeletingIds((prev) => {
      if (!prev.has(targetId)) return prev;
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
    // 낙관적 제거 + 이 일정을 가리키던 linkNext도 함께 정리.
    setEvents((prev) =>
      prev
        .filter((e) => e.id !== targetId)
        .map((e) => (e.linkNext === targetId ? { ...e, linkNext: undefined } : e))
    );
    if (selectedEventId === targetId) {
      setSelectedEventId(null);
      setForm(createEmptyForm());
    }
    setActionError(null);
    // Ctrl+Z 복구용으로 삭제 액션을 스택에 올린다(되돌리면 같은 내용으로 다시 만든다).
    if (removed) {
      deletedStackRef.current.push({ type: "recreate", event: removed });
    }
    startTransition(async () => {
      const result = await enqueueWrite(async () => {
        // 큐 차례가 와서 실행 — 이 시점엔 앞(생성) 작업이 끝나 temp가 실제 id로 풀려 있다.
        const realId = await resolveEventId(targetId);
        if (!realId) return null; // 서버에 정말 없음(저장 실패/미저장) → 보낼 것 없음
        // 저장이 삭제 애니메이션 중에 끝나 temp가 실제 id로 바뀐 경우, temp로 건 로컬 제거가 빗나갈
        // 수 있으니 실제 id로도 한 번 더 제거(화면에 되살아 보이지 않게).
        if (realId !== targetId) {
          setEvents((prev) =>
            prev
              .filter((e) => e.id !== realId)
              .map((e) => (e.linkNext === realId ? { ...e, linkNext: undefined } : e))
          );
        }
        return postStudioWrite("delete", { eventId: realId });
      });
      if (!result.ok) {
        setActionError(result.error);
        setEvents(snapshot); // 실패 → 되돌림
        deletedStackRef.current.pop(); // 복구 스택도 되돌림
      }
    });
  }

  // ── 빠른 휴방: 날짜 우클릭/롱프레스 → 미니 메뉴에서 '휴방' 한 번에 ──
  // 휴방 하루 = 공개 'dayoff' 이벤트(제목 "휴뱅" + 휴뱅 태그). 인사이트 restDays도 휴뱅 태그로 센다.
  const restDayTagId = tags.find((t) => t.displayName === "휴뱅")?.id ?? null;
  function isRestEvent(e: StudioScheduleEvent): boolean {
    if (e.category === "dayoff") return true;
    return restDayTagId ? (e.tagIds?.includes(restDayTagId) ?? false) : false;
  }
  function findRestEvent(isoDate: string): StudioScheduleEvent | null {
    return getEventsForDate(events, isoDate).find((e) => !e.isSupport && isRestEvent(e)) ?? null;
  }
  // 커서 위치가 아니라 '그 날짜칸' 기준으로 메뉴를 띄운다(경계에서 눌러도 어느 날인지 분명).
  // x는 칸 가로중앙(메뉴는 CSS translateX(-50%)로 중앙정렬), y는 칸 세로중앙에 메뉴를 얹는다.
  // 메뉴 좌상단을 '클릭 지점(ax,ay)'에 둔다(커서 그대로). 칸중앙/중앙정렬을 쓰면 오른쪽 칸일수록
  // 클램프로 커서보다 왼쪽으로 벌어졌다 — 좌상단 앵커 + 경계 보정만.
  function openRestMenu(ax: number, ay: number, isoDate: string) {
    if (!canEdit || blockedByPreview()) return;
    hapticTick();
    const menuW = 180;
    const menuH = 56;
    const x = Math.max(8, Math.min(ax, window.innerWidth - 8 - menuW));
    const y = Math.max(8, Math.min(ay, window.innerHeight - 8 - menuH));
    setRestMenu({ isoDate, x, y, hasRest: Boolean(findRestEvent(isoDate)) });
  }
  function closeRestMenu() {
    setRestMenu(null);
  }
  // 휴방 토글 — 이미 휴방이면 해제(삭제 파이프라인 재사용), 아니면 휴방 이벤트를 낙관적으로 생성.
  // 생성은 붙여넣기(pasteCopiedEvent)와 같은 패턴: 낙관적 추가 + remove undo + 서버 반영.
  function quickToggleRest(isoDate: string) {
    closeRestMenu();
    if (!canEdit || blockedByPreview()) return;
    const existing = findRestEvent(isoDate);
    if (existing) {
      deleteEvent(existing.id); // 햅틱·poof·Ctrl+Z 복구까지 그대로
      return;
    }
    hapticTick(); // ① 눌림
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    const tagIds = restDayTagId ? [restDayTagId] : [];
    const optimistic: StudioScheduleEvent = {
      id: tempId,
      startsAt: `${isoDate}T00:00:00+09:00`,
      endDateKey: undefined,
      isSupport: false,
      supportUrl: undefined,
      isAllDay: true,
      isTentative: false,
      publicTitle: "휴뱅",
      status: "scheduled",
      visibilityScope: "public",
      category: "dayoff",
      tagIds,
      primaryTagIds: tagIds,
      sortOrder: 0
    };
    const snapshot = events;
    setEvents((prev) => [...prev, optimistic]);
    markJustSaved(tempId); // 통통 착지 반짝
    const undoHolder = { id: tempId };
    deletedStackRef.current.push({ type: "remove", holder: undoHolder }); // Ctrl+Z = 방금 만든 휴방 제거
    setActionError(null);
    // 만든 휴뱅을 곧바로 편집 카드에 띄운다 — 우클릭 한 번으로 만들고 거기서 바로 세부(태그·기간 등)를
    // 만질 수 있게(HCI: 방금 만든 대상이 곧 편집 컨텍스트). 데스크톱 전용 흐름이라 패널을 연다.
    if (!isNarrow) selectEvent(optimistic);
    startTransition(async () => {
      const result = await studioWrite("save", {
        id: undefined,
        dateKey: isoDate,
        endDateKey: "",
        startTime: "",
        endTime: "",
        isAllDay: true,
        isTentative: false,
        publicTitle: "휴뱅",
        publicDescription: "",
        category: "dayoff",
        status: "scheduled",
        visibilityScope: "public",
        tagIds,
        primaryTagIds: tagIds,
        isSupport: false,
        supportUrl: ""
      });
      if (!result.ok) {
        setActionError(result.error);
        setEvents(snapshot);
        deletedStackRef.current.pop();
        return;
      }
      hapticTick(); // ② 서버확인
      if (result.id) {
        const realId = result.id;
        undoHolder.id = realId; // 임시 id → 실제 id(되돌릴 때 올바른 카드 제거)
        tempToRealRef.current.set(tempId, realId); // 저장 직후 삭제해도 서버 삭제가 실제 id로
        setEvents((prev) => prev.map((e) => (e.id === tempId ? { ...e, id: realId } : e)));
        setJustSavedId((p) => (p === tempId ? realId : p));
        // 편집 카드에 이 휴뱅이 떠 있으면 선택을 실제 id로 옮긴다(temp 그대로면 저장·삭제가 어긋남).
        setSelectedEventId((cur) => (cur === tempId ? realId : cur));
        setForm((f) => (f.id === tempId ? { ...f, id: realId } : f));
      }
    });
  }

  // 날짜칸 롱프레스(터치) — 빈 영역을 약 360ms 누르면 휴방 메뉴. pill·버튼 위 누름은 제외(드래그/삭제용).
  function onCellPointerDown(e: ReactPointerEvent<HTMLElement>, isoDate: string) {
    if (!canEdit || e.pointerType === "mouse") return; // 데스크톱은 우클릭(onContextMenu)으로
    if ((e.target as HTMLElement).closest(".studio-event-pill, button, a")) return;
    const px = e.clientX;
    const py = e.clientY;
    cellHoldPosRef.current = { x: px, y: py }; // 이동 취소 판정용
    if (cellHoldRef.current) clearTimeout(cellHoldRef.current);
    cellHoldRef.current = setTimeout(() => {
      suppressCellClickRef.current = true; // 메뉴 연 직후 click(selectDate) 무시
      openRestMenu(px, py, isoDate); // 누른 지점에 메뉴
    }, 360);
  }
  function cancelCellHold() {
    if (cellHoldRef.current) {
      clearTimeout(cellHoldRef.current);
      cellHoldRef.current = null;
    }
    cellHoldPosRef.current = null;
  }
  function onCellPointerMove(e: ReactPointerEvent<HTMLElement>) {
    const p = cellHoldPosRef.current;
    if (!p) return;
    if (Math.abs(e.clientX - p.x) > 10 || Math.abs(e.clientY - p.y) > 10) cancelCellHold();
  }

  // 메뉴 열려 있는 동안 바깥 클릭·Esc·스크롤이면 닫는다.
  useEffect(() => {
    if (!restMenu) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(".rest-menu")) closeRestMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRestMenu();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", closeRestMenu, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", closeRestMenu, true);
    };
  }, [restMenu]);

  // Ctrl+Z: 스택 맨 위 '액션'을 종류에 맞게 되돌린다(LIFO). 삭제=다시 만들기, 생성/붙여넣기=지우기.
  // 그래서 복사→삭제→붙여넣기→Ctrl+Z = '방금 붙여넣은 카드'만 사라지고, 한 번 더 누르면 그 전
  // 삭제가 복구된다(올바른 순서). 예전엔 항상 마지막 삭제분을 되살리는 버그가 있었다.
  function restoreLastDelete() {
    if (!canEdit) {
      return;
    }
    const action = deletedStackRef.current.pop();
    if (!action) {
      flashToast("되돌릴 작업이 없어요");
      return;
    }

    if (action.type === "move") {
      // 드래그 이동 되돌리기 — 원래 날짜·원래 순서로 되돌린다(같은 날 안 순서만 바꾼 경우도 포함).
      // 방금 만든 카드(temp id)를 옮겼다면 그 사이 실제 id로 바뀌었을 수 있다 → 매핑으로 해소.
      const id = tempToRealRef.current.get(action.holder.id) ?? action.holder.id;
      const remap = (eid: string) => tempToRealRef.current.get(eid) ?? eid;
      const fromOrderedIds = action.fromOrderedIds.map(remap);
      const moved = events.find((e) => e.id === id);
      if (!moved) {
        flashToast("되돌릴 카드를 찾을 수 없어요");
        return;
      }
      const delta = daysBetweenIso(getEventDateKey(moved), action.fromDate);
      const orderPos = new Map(fromOrderedIds.map((eid, i) => [eid, i] as const));
      flipArmedRef.current = true; // 되돌아가는 카드도 형제와 함께 활주
      setEvents((prev) =>
        prev.map((ev) => {
          let next = ev;
          if (ev.id === id && action.fromDate !== action.toDate) {
            next = {
              ...next,
              startsAt: next.startsAt.replace(/^\d{4}-\d{2}-\d{2}/, action.fromDate),
              endDateKey: next.endDateKey ? addDaysIso(next.endDateKey, delta) : next.endDateKey
            };
          }
          const pos = orderPos.get(ev.id);
          if (pos !== undefined) next = { ...next, sortOrder: pos };
          return next;
        })
      );
      setSelectedDate(action.fromDate);
      markJustSaved(id); // 되돌아온 카드도 통통 안착
      setActionError(null);
      flashToast(
        action.fromDate === action.toDate ? "순서 되돌림 (Ctrl+Z)" : "이동 취소됨 (Ctrl+Z)"
      );
      // 서버에도 같은 큐(직렬)로 역이동 — 원래 이동과 순서가 뒤바뀌지 않는다.
      enqueueMovePersist({
        id,
        sourceDate: action.toDate,
        targetDate: action.fromDate,
        orderedIds: fromOrderedIds
      });
      return;
    }

    if (action.type === "remove") {
      // 생성/붙여넣기 되돌리기 — 그때 만든 카드를 지운다(holder.id는 실제 id로 갱신돼 있음).
      const id = action.holder.id;
      setEvents((prev) =>
        prev
          .filter((e) => e.id !== id)
          .map((e) => (e.linkNext === id ? { ...e, linkNext: undefined } : e))
      );
      if (selectedEventId === id) {
        setSelectedEventId(null);
        setForm(createEmptyForm());
      }
      setActionError(null);
      flashToast("붙여넣기 취소됨 (Ctrl+Z)");
      startTransition(async () => {
        const result = await enqueueWrite(async () => {
          const realId = await resolveEventId(id);
          if (!realId) return null; // 서버에 아직 없음 → 보낼 것 없음
          return postStudioWrite("delete", { eventId: realId });
        });
        if (!result.ok) setActionError(result.error);
      });
      return;
    }

    // recreate: 삭제 되돌리기 — 보관한 내용으로 새 id를 받아 다시 만든다.
    const ev = action.event;
    const dateKey = getEventDateKey(ev);
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    setEvents((prev) => [...prev, { ...ev, id: tempId, linkNext: undefined }]);
    setActionError(null);
    markJustSaved(tempId); // 되살아난 카드도 통통 착지하며 반짝
    flashToast("삭제 취소됨 (Ctrl+Z)");

    let resolveSave: (id: string | null) => void = () => {};
    pendingSavesRef.current.set(
      tempId,
      new Promise<string | null>((r) => {
        resolveSave = r;
      })
    );
    startTransition(async () => {
      const result = await studioWrite("save", {
        id: undefined,
        dateKey,
        endDateKey: ev.endDateKey ?? "",
        startTime: "",
        endTime: "",
        isAllDay: true,
        isTentative: ev.isTentative ?? false,
        publicTitle: ev.publicTitle,
        publicDescription: "",
        category: ev.category,
        status: ev.status,
        visibilityScope: ev.visibilityScope,
        tagIds: ev.tagIds,
        primaryTagIds: ev.primaryTagIds.slice(0, 2),
        isSupport: ev.isSupport ?? false,
        supportUrl: ev.supportUrl ?? ""
      });
      if (!result.ok) {
        setActionError(result.error);
        setEvents((prev) => prev.filter((e) => e.id !== tempId));
        resolveSave(null);
        pendingSavesRef.current.delete(tempId);
        return;
      }
      if (result.id) {
        const realId = result.id;
        tempToRealRef.current.set(tempId, realId); // 되살린 직후 삭제해도 서버 삭제가 실제 id로
        setEvents((prev) => prev.map((e) => (e.id === tempId ? { ...e, id: realId } : e)));
        resolveSave(realId);
        pendingSavesRef.current.delete(tempId);
      }
    });
  }

  // 2계층: 일정 하나에 콘텐츠 태그 최대 MAX_EVENT_TAGS개. 같은 태그 재클릭=해제. 카드 색은
  // 대분류로 합쳐 ≤2색 + 나머지 점 줄로 표시(month.ts).
  function selectTag(tagId: string) {
    setForm((current) => {
      if (current.tagIds.includes(tagId)) {
        const next = current.tagIds.filter((id) => id !== tagId);
        return { ...current, tagIds: next, primaryTagIds: next };
      }
      if (current.tagIds.length >= maxEventTags) {
        return current; // 최대까지
      }
      const next = [...current.tagIds, tagId];
      return { ...current, tagIds: next, primaryTagIds: next };
    });
  }

  // #4: 태그 추가/삭제/저장을 새로고침 없이 로컬 상태에 즉시 반영(달력 색도 바로 갱신).
  function applyTagAdd(tag: BroadcastTag, color: ColorPaletteEntry) {
    setTags((prev) => [...prev, tag]);
    setPalette((prev) => (prev.some((c) => c.key === color.key) ? prev : [...prev, color]));
  }
  function applyTagRemove(tagId: string) {
    const removed = tags.find((t) => t.id === tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
    if (removed && removed.colorKey.startsWith("gen-")) {
      const stillUsed = tags.some((t) => t.id !== tagId && t.colorKey === removed.colorKey);
      if (!stillUsed) {
        setPalette((prev) => prev.filter((c) => c.key !== removed.colorKey));
      }
    }
  }
  function applyTagUpdates(
    updates: { id: string; displayName: string; colorKey: ColorKey; bgHex?: string | null; sortOrder?: number }[]
  ) {
    setTags((prev) => {
      const mapped = prev.map((t) => {
        const u = updates.find((x) => x.id === t.id);
        return u
          ? {
              ...t,
              displayName: u.displayName,
              colorKey: u.colorKey,
              // bgHex가 payload에 오면 반영(커스텀 색 즉시 카드/범례에). undefined면 유지.
              bgHex: u.bgHex === undefined ? t.bgHex : u.bgHex,
              sortOrder: u.sortOrder ?? t.sortOrder
            }
          : t;
      });
      // 드래그로 바뀐 순서(sort_order)를 즉시 반영 — 달력·색상 안내가 새로고침 없이 갱신.
      return [...mapped].sort((a, b) => a.sortOrder - b.sortOrder);
    });
  }

  // #2: 일정 카드 복사/붙여넣기 — 선택한 일정을 Ctrl+C로 복사, 다른 날짜를 고르고 Ctrl+V.
  const [clipboard, setClipboard] = useState<CopiedEvent | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  function flashToast(message: string) {
    setCopyToast(message);
    window.setTimeout(() => setCopyToast(null), 1600);
  }
  function copySelectedEvent() {
    if (!selectedEventId) return;
    const ev = events.find((e) => e.id === selectedEventId);
    if (!ev) return;
    const start = getEventDateKey(ev);
    setClipboard({
      publicTitle: ev.publicTitle,
      spanDays: ev.endDateKey ? Math.max(0, daysBetweenIso(start, ev.endDateKey)) : 0,
      isSupport: ev.isSupport ?? false,
      isTentative: ev.isTentative ?? false,
      supportUrl: ev.supportUrl ?? "",
      category: ev.category,
      status: ev.status,
      visibilityScope: ev.visibilityScope,
      tagIds: ev.tagIds,
      primaryTagIds: ev.primaryTagIds
    });
    flashToast("일정 복사됨 · 날짜 고르고 Ctrl+V");
  }
  function pasteCopiedEvent() {
    if (!clipboard || !canEdit) return;
    const payload = clipboard;
    const scope: EventVisibilityScope = canReadPrivate ? payload.visibilityScope : "public";
    const endDateKey =
      payload.isSupport && payload.spanDays > 0
        ? addDaysIso(selectedDate, payload.spanDays)
        : undefined;
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    // 낙관적으로 즉시 붙여넣고, 서버엔 백그라운드 반영(새로고침 없이).
    const optimistic: StudioScheduleEvent = {
      id: tempId,
      startsAt: `${selectedDate}T00:00:00+09:00`,
      endDateKey,
      isSupport: payload.isSupport,
      supportUrl: payload.supportUrl || undefined,
      isAllDay: true,
      isTentative: payload.isTentative,
      publicTitle: payload.publicTitle,
      status: payload.status,
      visibilityScope: scope,
      category: payload.category,
      tagIds: payload.tagIds,
      primaryTagIds: payload.primaryTagIds.slice(0, 2),
      sortOrder: 0
    };
    const snapshot = events;
    setEvents((prev) => [...prev, optimistic]);
    // 붙여넣기를 실행취소 스택에 'remove'로 올린다 → Ctrl+Z면 방금 붙여넣은 이 카드가 사라진다.
    const undoHolder = { id: tempId };
    deletedStackRef.current.push({ type: "remove", holder: undoHolder });
    flashToast(`${selectedDate}에 붙여넣음`);
    setActionError(null);
    startTransition(async () => {
      const result = await studioWrite("save", {
        id: undefined,
        dateKey: selectedDate,
        endDateKey: endDateKey ?? "",
        startTime: "",
        endTime: "",
        isAllDay: true,
        isTentative: payload.isTentative,
        publicTitle: payload.publicTitle,
        publicDescription: "",
        category: payload.category,
        status: payload.status,
        visibilityScope: scope,
        tagIds: payload.tagIds,
        primaryTagIds: payload.primaryTagIds.slice(0, 2),
        isSupport: payload.isSupport,
        supportUrl: payload.supportUrl
      });
      if (!result.ok) {
        setActionError(result.error);
        setEvents(snapshot);
        return;
      }
      if (result.id) {
        const realId = result.id; // 클로저 안에서 string으로 좁혀 쓰도록 const로 고정.
        undoHolder.id = realId; // 임시 id → 실제 id: 되돌릴 때 올바른 카드를 지우게.
        tempToRealRef.current.set(tempId, realId); // 붙여넣기 직후 삭제해도 서버 삭제가 실제 id로
        setEvents((prev) => prev.map((e) => (e.id === tempId ? { ...e, id: realId } : e)));
      }
    });
  }

  // 편집 패널 제목칸을 찾아 포커스한다(ref 우선, 없으면 DOM 조회 — ref가 아직 안 잡힌 경우 대비).
  function focusEditorTitle(): HTMLTextAreaElement | null {
    const input =
      editorTitleRef.current ??
      document.querySelector<HTMLTextAreaElement>(".event-editor-panel textarea");
    if (!input || input.disabled) return null;
    if (document.activeElement !== input) {
      input.focus();
      const len = input.value.length;
      try {
        input.setSelectionRange(len, len);
      } catch {
        /* 무시 */
      }
    }
    return input;
  }

  // 일정 단축키(소유자만). 입력칸·팝업·텍스트선택 중에는 가로채지 않는다.
  useEffect(() => {
    if (!canEdit) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      // Ctrl/⌘+S: 어디에 포커스가 있든(제목 입력칸 포함) 브라우저 '페이지 저장'을 가로채고 이 카드
      // 저장. 아래 INPUT/TEXTAREA 가드보다 먼저 처리해야 제목 편집 중에도 'HTML로 저장' 창이 안 뜬다.
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editorVisible && form.publicTitle.trim()) saveEvent();
        else flashSavedChip();
        return;
      }
      // Alt+N: 새 일정 카드 열기/닫기(하나의 키로 통일). 제목칸에 포커스가 있어도 동작하도록
      // INPUT 가드보다 먼저 처리한다 — 맨 N은 패널이 열린 동안 '제목 글자'로 먹혀 닫기가 불가능했다.
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "n" && !modal) {
        e.preventDefault();
        selectDate(selectedDate);
        return;
      }
      // Esc: 편집 패널 닫기 — 제목 입력 중에도(INPUT 가드보다 먼저) 먹힌다.
      if (e.key === "Escape" && editorVisible && !modal) {
        e.preventDefault();
        setEditorVisible(false);
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable || modal) return;
      // 백틱(`) — 제목칸으로 바로 포커스만(글자는 안 넣음). 글자 자동포커스가 안 먹는 환경용 확실한 키.
      if (editorVisible && e.key === "`") {
        e.preventDefault();
        focusEditorTitle();
        return;
      }
      // 편집 패널이 열려 있으면, 글자 키를 누르는 즉시 제목칸으로 포커스를 옮겨 바로 입력되게 한다
      // (마우스로 제목칸을 안 눌러도 됨). Del·화살표·Enter·Esc 등 기능키(길이>1)는 통과하고,
      // 아래 단축키(N 등)보다 먼저 처리해 글자 키가 단축키로 새지 않게 한다.
      if (
        editorVisible &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.isComposing || e.key === "Process" || e.key.length === 1)
      ) {
        const input = focusEditorTitle();
        // 확정 글자(비-IME)는 방금 포커스한 칸에 이 keydown이 안 들어갈 수 있어 직접 끼워 넣는다.
        // IME(한글 조합)는 포커스만 하고 조합은 input이 그대로 받게 둔다(직접 넣으면 겹치거나 깨짐).
        if (input && !e.isComposing && e.key !== "Process" && e.key.length === 1) {
          e.preventDefault();
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? input.value.length;
          const next = input.value.slice(0, start) + e.key + input.value.slice(end);
          setForm((f) => ({ ...f, publicTitle: next }));
          requestAnimationFrame(() => {
            try {
              input.setSelectionRange(start + 1, start + 1);
            } catch {
              /* 무시 */
            }
          });
        }
        return;
      }
      // Delete 키: 선택한 일정 삭제(버튼 없이도).
      if (e.key === "Delete" && selectedEventId) {
        e.preventDefault();
        deleteEvent(selectedEventId);
        return;
      }
      // (맨 N은 없앴다 — 편집 패널이 열린 동안엔 어차피 '제목 글자'로 먹혀 열기만 되고 닫기가 안 돼
      //  비대칭이었다. 열기·닫기 모두 Alt+N 하나로 통일 — 위쪽에서 INPUT 가드보다 먼저 처리한다.)
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        // 실수로 지운 일정 되살리기(편집 중 텍스트는 위 INPUT/TEXTAREA 가드로 보호됨).
        e.preventDefault();
        restoreLastDelete();
      } else if (key === "c" && selectedEventId && !window.getSelection()?.toString()) {
        e.preventDefault();
        copySelectedEvent();
      } else if (key === "v" && clipboard) {
        e.preventDefault();
        pasteCopiedEvent();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canEdit, selectedEventId, clipboard, selectedDate, modal, canReadPrivate, events, editorVisible, form]);

  // 모바일 아젠다도 데스크톱과 동일하게 — 비공개 일정은 "비공개 일정 보기"로 직접 켜기 전까진
  // 누구에게도(개발자·소유자 포함) 보이지 않는다. 방송사고 방지: 진입/새로고침 시 항상 공개 기본.
  const mobileAgendaEvents = liveEvents;

  function openMobileEdit(event: StudioScheduleEvent) {
    hapticTick(); // 카드 탭 손맛(Android만; iOS·미지원은 조용히 무시)
    selectEvent(event);
    setMobileEditId(event.id);
  }
  function openMobileAdd(isoDate: string) {
    selectDate(isoDate); // 빈 폼 또는 같은 날짜의 임시 내용 복원까지 처리
    setMobileEditId("new");
  }
  function closeMobileEdit() {
    setMobileEditId(null);
    setSelectedEventId(null);
    setForm(createEmptyForm());
  }

  // 신뢰 멤버(매니저·작업자)가 기존 업 도움의 기간·링크만 고치는 시트 열기/닫기/저장.
  function openSupportSheet(event: StudioScheduleEvent) {
    // 팝업(시트)만 띄우면 충분 — 오른쪽 패널은 열지 않는다(showPanel=false).
    selectEvent(event, false); // form에 이 업 도움의 기간·링크가 채워진다
    setSupportSheetId(event.id);
  }
  function closeSupportSheet() {
    setSupportSheetId(null);
    setSelectedEventId(null);
    setForm(createEmptyForm());
  }
  function saveSupportSettings() {
    if (blockedByPreview()) return;
    if (!supportSheetId) return;
    const id = supportSheetId;
    setActionError(null);
    setSupportSaving(true);
    setEvents((cur) =>
      cur.map((e) =>
        e.id === id
          ? { ...e, endDateKey: form.endDateKey || undefined, supportUrl: form.supportUrl || undefined }
          : e
      )
    ); // 낙관적 반영
    startTransition(async () => {
      const result = await studioWrite("support", {
        eventId: id,
        endDateKey: form.endDateKey,
        supportUrl: form.supportUrl
      });
      setSupportSaving(false);
      if (result.ok) {
        closeSupportSheet();
      } else {
        setActionError(result.error);
      }
    });
  }

  function renderMobile() {
    const monthCells = cells.filter((c) => c.inCurrentMonth);
    const filtering = tagFilters.length > 0;
    return (
      <div className="studio-mobile">
        {/* 헤더 + 역할 바 — 스크롤해도 관리 창 바로 위까지 같이 따라온다(sticky). */}
        <div className="m-scroll-region">
          <div className="m-topstick">
            <header className="agenda-header">
              {/* 좌측 1열: 배포 버전(커밋) 위 + 저장 상태 칩 아래로 세로로 쌓고, 묶음의 세로
                  중앙이 제목(헤더) 중앙선과 같게 한다. 우상단(3열)은 계정변경 버튼 자리로 비운다. */}
              <div className="m-head-left">
                <span
                  className={`studio-build-tag-m${isDevInsights ? " dev" : ""}`}
                  aria-hidden="true"
                >
                  {process.env.APP_COMMIT?.slice(0, 7) ?? "dev"}
                </span>
                {renderSaveStatus()}
              </div>
              <h1>
                {schedule.calendar.title}
                <span>
                  토리님 편집실 · {view.year}년 {view.month}월
                </span>
              </h1>
              {/* 로그아웃 — 저장됨 칩이 있던 우상단(3열) 자리. 편집실 톤과 어울리게.
                  로그아웃하면 익명 상태로 공개 포스터를 계속 본다(계정 바꾸려면 다시 로그인). */}
              {actor.isAuthenticated ? (
                <form className="m-head-logout" action="/api/auth/logout" method="post">
                  <button
                    className="button"
                    onClick={() => startNav("로그아웃 중…")}
                    type="submit"
                  >
                    <LogOut aria-hidden="true" size={12} strokeWidth={2.5} />
                    로그아웃
                  </button>
                </form>
              ) : (
                <Link className="m-head-logout button" href="/login">
                  로그인
                </Link>
              )}
            </header>

          </div>

          {/* 인사이트 진입(개발자·관리자·매니저·작업자)은 아래 색상 필터 레일 맨 위로 옮겼다. */}
          {/* 비공개 경고 배너는 화면을 공유하는 소유자에게만 — 작업자/매니저/개발자는 표시하지 않음. */}
          {canReadPrivate && isEffectivelyOwner ? (
            <div className="private-warning">
              <LockKeyhole aria-hidden="true" size={16} />⚠ 비공개 일정 표시 중
              {/* 모바일: 끄기는 엄지 닿기 쉬운 이 배너에(토글은 비밀번호 변경 유지). */}
              <button
                className="private-warning-btn"
                onClick={() => setShowPrivate(false)}
                type="button"
              >
                끄기
              </button>
            </div>
          ) : null}

          <section
            className="agenda agenda-studio"
            onTouchEnd={onAgendaTouchEnd}
            onTouchStart={onAgendaTouchStart}
          >
            {/* 오른쪽 레일: (위) 인사이트 진입 버튼 + (아래) 색상 필터 — 같은 92px 폭으로 세로로 쌓는다(편집실). */}
            <div className="agenda-rail">
              {/* 역할 배지(시각 정보)는 색상 필터 위에. */}
              {renderRoleBadge()}
            <aside className="agenda-legend agenda-legend-studio" aria-label="태그 필터">
              <strong>태그 필터</strong>
              {(() => {
                const tops = legendTags.filter((t) => (t.parentId ?? null) === null);
                const legendBtn = (tag: (typeof tops)[number]) => {
                  const v = tagVisual.visualOf(tag.id);
                  if (v.missing || !v.bg) return null;
                  const on = tagFilters.includes(tag.id);
                  return (
                    <button
                      aria-pressed={on}
                      className={`agenda-legend-tag ${
                        tag.kind === "modifier" ? "mod" : ""
                      } ${on ? "on" : ""} ${filtering && !on ? "dim" : ""}`}
                      key={tag.id}
                      onClick={() => toggleTagFilter(tag.id)}
                      type="button"
                    >
                      <i
                        data-color={v.colorKey ?? undefined}
                        style={{ backgroundColor: v.bg, borderColor: v.border ?? undefined }}
                      />
                      {tag.displayName}
                    </button>
                  );
                };
                const content = tops.filter((t) => t.kind !== "modifier");
                const mods = tops.filter((t) => t.kind === "modifier");
                return (
                  <>
                    {content.map(legendBtn)}
                    {mods.length > 0 ? <>{mods.map(legendBtn)}</> : null}
                  </>
                );
              })()}
              {/* 비공개(공개 아님) 일정만 골라보기 — 잠금 해제로 비공개가 보일 때만. */}
              {canReadPrivate ? (
                <button
                  aria-pressed={tagFilters.includes(PRIVATE_FILTER)}
                  className={`agenda-legend-tag ${tagFilters.includes(PRIVATE_FILTER) ? "on" : ""} ${
                    filtering && !tagFilters.includes(PRIVATE_FILTER) ? "dim" : ""
                  }`}
                  onClick={() => toggleTagFilter(PRIVATE_FILTER)}
                  type="button"
                >
                  <i className="legend-private-swatch" aria-hidden="true" />
                  비공개
                </button>
              ) : null}
              {filtering ? (
                <button
                  className="agenda-legend-clear"
                  onClick={() => setTagFilters([])}
                  type="button"
                >
                  필터 해제
                </button>
              ) : null}
            </aside>
              {/* 인사이트 진입은 색상 필터 '아래'(시각 정보 위, 누르는 버튼 아래 원칙). */}
              {isDevInsights || canMemberInsights ? (
                <button
                  className="m-rail-insights"
                  onClick={() => setModal("developer")}
                  type="button"
                >
                  {isDevInsights ? "🛠 인사이트" : "📊 인사이트"}
                </button>
              ) : null}
            </div>

            <div
              className={`agenda-flow${isFirstReveal && !didNavigateRef.current ? " cal-reveal" : ""}`}
              data-enter={didNavigateRef.current ? monthDir : undefined}
              key={`${view.year}-${view.month}`}
            >
              {monthCells.map((cell, agendaIndex) => {
              const day = classifyDay(cell.isoDate, cell.weekday, today);
              const mark = getDayMark(cell.isoDate);
              const dayEvents = mobileAgendaEvents
                .filter((e) => getEventDateKey(e) === cell.isoDate)
                // 편집실 드래그로 정한 같은 날 표시 순서(sort_order)를 편집실 모바일 아젠다도 따른다.
                // 이걸 빼면 달력(getEventsForDate)만 순서를 반영하고 모바일은 created_at 순으로 남아
                // 편집자가 바꾼 순서가 폰에서 안 보였다(public-poster 아젠다와 동일 조치).
                .sort((a, b) => a.sortOrder - b.sortOrder);
              // 모바일 색상 필터: 필터가 켜지면 흐림이 아니라 "걸러진 일정만" 보여준다.
              // 매칭 일정이 하나도 없는 날 카드는 아예 렌더하지 않는다(예: 짧뱅 필터 → 5일·15일만).
              const shownEvents = filtering
                ? dayEvents.filter((e) => !isDimmedByFilter(e))
                : dayEvents;
              if (filtering && shownEvents.length === 0) {
                return null;
              }
              return (
                <div
                  className={`agenda-day ${day.isToday ? "today" : ""}`}
                  key={cell.isoDate}
                  style={isFirstReveal ? ({ "--ri": agendaIndex } as CSSProperties) : undefined}
                >
                  <div className="agenda-when">
                    <strong className={day.isRed ? "red" : day.isSaturday ? "saturday" : ""}>
                      {cell.dayOfMonth}
                    </strong>
                    <span className="agenda-wd">{WEEKDAYS[cell.weekday]}</span>
                  </div>
                  <div className="agenda-day-list">
                    {mark && (mark.name || mark.match) ? (
                      <span className={`agenda-mark ${mark.isHoliday ? "holiday" : ""}`}>
                        {mark.match
                          ? mark.name
                            ? `${mark.name} · ${mark.match.text}`
                            : mark.match.text
                          : mark.name}
                      </span>
                    ) : null}
                    {dayEvents.length === 0 ? (
                      <span className="agenda-noevent">예정된 일정 없음</span>
                    ) : null}
                    {shownEvents.map((event) => {
                      const colors = eventColors(event);
                      const extraColors = tagVisual.eventExtras(event);
                      const { main, subs } = splitEventTitle(event.publicTitle);
                      const barStyle =
                        colors.length >= 2
                          ? {
                              background: `linear-gradient(180deg, ${colors[0].bgColor}, ${colors[1].bgColor})`
                            }
                          : colors[0]
                            ? { background: colors[0].bgColor }
                            : undefined;
                      const dimCls = isDimmedByFilter(event) ? " filter-dim" : "";
                      const tentCls = event.isTentative ? " tentative" : ""; // 미정: 점선 테두리
                      // 업 도움: 시청자 화면처럼 기간 + "도우러 가기" 링크를 인라인으로 보여준다.
                      // (링크를 누르려면 <a>가 필요해 편집 버튼으로 감싸지 않고, 따로 "수정"을 둔다.)
                      if (event.isSupport) {
                        const sEnd = event.endDateKey ?? cell.isoDate;
                        return (
                          <div
                            className={`agenda-event m-support${dimCls}${justSavedId === event.id ? " just-saved" : ""}${deletingIds.has(event.id) ? " deleting" : ""}`}
                            key={event.id}
                          >
                            {/* 시청자 화면과 동일한 초록 세로 바(업 도움 고정색). */}
                            <span className="agenda-bar" style={{ background: "#84b74f" }} />
                            <div className="agenda-content">
                              <p className="agenda-title">
                                <span className="agenda-title-text">🌱 {event.publicTitle}</span>
                                {event.visibilityScope !== "public" ? (
                                  <span className={`m-scope-badge ${event.visibilityScope}`}>
                                    {SCOPE_LABEL[event.visibilityScope]}
                                  </span>
                                ) : null}
                              </p>
                              <p className="agenda-sub">
                                {formatShortDate(cell.isoDate)} ~ {formatShortDate(sEnd)}
                              </p>
                              {/* 도우러 가기 + 수정을 한 줄에 둬 카드 높이를 줄인다. */}
                              <div className="m-support-actions">
                                {event.supportUrl ? (
                                  <a
                                    className="agenda-link"
                                    href={event.supportUrl}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                  >
                                    도우러 가기
                                    <ExternalLink aria-hidden="true" size={13} />
                                  </a>
                                ) : null}
                                {/* 소유자·개발자는 전체 편집, 매니저는 업 도움 설정만 수정. 작업자는 읽기 전용. */}
                                {canEdit ? (
                                  <button
                                    className="m-support-edit"
                                    onClick={() => openMobileEdit(event)}
                                    type="button"
                                  >
                                    수정
                                  </button>
                                ) : canEditSupportThing ? (
                                  <button
                                    className="m-support-edit"
                                    onClick={() => openSupportSheet(event)}
                                    type="button"
                                  >
                                    수정
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      }
                      const inner = (
                        <>
                          {colors.length >= 2 ? (
                            // 2색: 시청자 포스터와 동일하게 위/아래 반쪽에 각자 색+무늬(data-color로
                            // globals.css 무늬 규칙 적용), 가운데 경계는 마스크 페이드로 흐릿하게 섞는다.
                            // (기존 단일 gradient 바는 data-color가 없어 모바일에서 무늬가 안 보였다.)
                            <span className="agenda-bar agenda-bar-2" aria-hidden="true">
                              <i
                                className="agenda-bar-half top"
                                data-color={colors[0].key}
                                style={{ background: colors[0].bgColor }}
                              />
                              <i
                                className="agenda-bar-half bottom"
                                data-color={colors[1].key}
                                style={{ background: colors[1].bgColor }}
                              />
                            </span>
                          ) : (
                            <span
                              className="agenda-bar"
                              data-color={colors[0]?.key}
                              style={barStyle}
                            />
                          )}
                          <div className="agenda-content">
                            <p className="agenda-title">
                              <span className="agenda-title-text">
                                {!event.isSupport && event.isTentative ? (
                                  <span className="evt-tentative">미정</span>
                                ) : null}
                                {event.isSupport ? `🌱 ${event.publicTitle}` : main}
                              </span>
                              {teaserStillHidden(event) ? (
                                <span className="m-teaser-badge" title={teaserBadgeTitle(event.teaserRevealAt)}>
                                  🔮 최초공개
                                </span>
                              ) : null}
                              {event.visibilityScope !== "public" ? (
                                <span className={`m-scope-badge ${event.visibilityScope}`}>
                                  {SCOPE_LABEL[event.visibilityScope]}
                                </span>
                              ) : null}
                            </p>
                            {!event.isSupport && subs.length > 0 ? (
                              <ul className="agenda-subs">
                                {subs.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            ) : null}
                            {/* PR2: 막대 색(≤2)에 못 담은 추가 대분류 점 줄. */}
                            {!event.isSupport && extraColors.length > 0 ? (
                              <span className="pill-dots" aria-hidden="true">
                                {extraColors.map((c, i) => (
                                  <i key={i} style={{ background: c.bgColor, borderColor: c.borderColor }} />
                                ))}
                              </span>
                            ) : null}
                          </div>
                        </>
                      );
                      return canEdit ? (
                        <button
                          className={`agenda-event m-event${dimCls}${tentCls}${justSavedId === event.id ? " just-saved" : ""}${deletingIds.has(event.id) ? " deleting" : ""}`}
                          key={event.id}
                          onClick={() => openMobileEdit(event)}
                          type="button"
                        >
                          {inner}
                        </button>
                      ) : canEditTagsThing ? (
                        // 매니저: 일정을 누르면 태그만 고치는 시트가 열린다(데스크톱 상세의 태그 편집과 동치).
                        <button
                          className={`agenda-event m-event${dimCls}${tentCls}${justSavedId === event.id ? " just-saved" : ""}${deletingIds.has(event.id) ? " deleting" : ""}`}
                          key={event.id}
                          onClick={() => setTagSheetId(event.id)}
                          type="button"
                        >
                          {inner}
                        </button>
                      ) : (
                        <div className={`agenda-event${dimCls}`} key={event.id}>
                          {inner}
                        </div>
                      );
                    })}
                    {canEdit && !filtering ? (
                      <button
                        className="m-add-event"
                        onClick={() => openMobileAdd(cell.isoDate)}
                        type="button"
                      >
                        + 일정 추가
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          </section>
        </div>

        {canEdit ? (
          <section className="m-manage">
            <h2>관리</h2>
            {/* 단계 배포: 태그 '정의 편집'은 v3 역할(현재 개발자)만. 그 외엔 진입 자체를 숨겨
                레거시 사용자가 v3 구조를 보거나 덮어쓰지 못하게 한다. */}
            {taxonomyV3 ? (
              <>
                <button
                  className="button m-io m-io-tags"
                  onClick={() => (blockedByPreview() ? null : setMobileMgmt(mobileMgmt === "tags" ? null : "tags"))}
                  type="button"
                >
                  태그 이름 · 색상 · 순서 {mobileMgmt === "tags" ? "▲" : "▼"}
                </button>
                {mobileMgmt === "tags" && !previewRole ? (
                  <TagLegendEditor
                    canEdit
                    onTagAdded={applyTagAdd}
                    onTagRemoved={applyTagRemove}
                    onTagsUpdated={applyTagUpdates}
                    palette={palette}
                    removeTagAction={removeTagAction}
                    saveTagsAction={saveTagsAction}
                    tags={tags}
                  />
                ) : null}
              </>
            ) : null}
            <button
              className="button m-io m-io-members"
              onClick={() => (blockedByPreview() ? null : setMobileMgmt(mobileMgmt === "members" ? null : "members"))}
              type="button"
            >
              매니저 · 작업자 관리 {mobileMgmt === "members" ? "▲" : "▼"}
            </button>
            {mobileMgmt === "members" && !previewRole ? <TrustedMembersPanel /> : null}
          </section>
        ) : null}

        {/* 하단 엄지존 액션레일 — 옛 '< >' 자리. 월 이동은 좌우 스와이프로(달력을 쓸면 넘어감).
            누르기 쉬운 핵심 버튼(미리보기·비공개)을 엄지 닿는 바닥에 모았다.
            계정변경(로그아웃)은 헤더 우상단으로 옮겼다(저장됨 칩이 있던 자리). */}
        <nav className="m-actionrail" aria-label="편집실 도구">
          {canTogglePrivateLayer ? (
            isEffectivelyOwner && canReadPrivate ? (
              <button className="button primary" onClick={() => openChangePasscode()} type="button">
                비밀번호 변경
              </button>
            ) : (
              <button
                className={canReadPrivate ? "button primary" : "button m-io-pill m-io-private"}
                onClick={togglePrivateLayer}
                type="button"
              >
                {canReadPrivate ? "비공개 중" : "비공개 일정"}
              </button>
            )
          ) : null}
          {/* 오른쪽: 미리보기 / 시청자 화면 — 계정변경과 위치 swap. */}
          {isDeveloper ? (
            renderPreviewControl()
          ) : (
            <button className="button m-io-pill m-io-preview" onClick={() => enterViewerMode()} type="button">
              시청자 화면
            </button>
          )}
        </nav>

        {canEdit && mobileEditId !== null ? renderMobileEditSheet() : null}
      </div>
    );
  }

  // 업 도움 편집 — 켜기/끄기 + 기간 + 링크 + 링크 확인. 웹 폼과 모바일 편집 시트 공용.
  // 업 도움 기간·링크 입력부. editable=true면 신뢰 멤버도 고칠 수 있다(토글은 별도, 소유자 전용).
  function renderSupportFields(editable: boolean) {
    return (
      <div className="support-fields">
        <div className="support-duration">
          <span className="duration-title">업 도움 기간</span>
          <div className="duration-chips">
            {SUPPORT_DURATIONS.map((opt) => {
              const end = addDaysIso(selectedDate, opt.days);
              const active = (form.endDateKey || selectedDate) === end;
              return (
                <button
                  className={active ? "active" : ""}
                  disabled={!editable}
                  key={opt.days}
                  onClick={() => setForm((current) => ({ ...current, endDateKey: end }))}
                  type="button"
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          {/* 종료일 — 못생긴 네이티브 달력 제거. 모바일=스텝퍼+값 좌우 스와이프, 웹=드래그 슬라이더. */}
          {isNarrow ? (
            <div className="duration-manual">
              <span>
                종료일 조절 <em className="dhint">−/+ 또는 밀어서 빠르게</em>
              </span>
              <div className="duration-stepper" role="group" aria-label="종료일 조절">
                <button
                  aria-label="하루 줄이기"
                  className="dstep"
                  disabled={!editable || (form.endDateKey || selectedDate) <= selectedDate}
                  onClick={() => {
                    const end = form.endDateKey || selectedDate;
                    const prev = addDaysIso(end, -1);
                    setForm((current) => ({
                      ...current,
                      endDateKey: prev < selectedDate ? selectedDate : prev
                    }));
                  }}
                  type="button"
                >
                  −
                </button>
                {/* 값을 좌우로 밀면(민감, 8px=1일) 종료일이 빠르게 바뀐다. 시작일 아래로는 안 내려감. */}
                <span
                  className={`dstep-val dstep-scrub${dateScrubbing ? " scrubbing" : ""}`}
                  onPointerDown={(e: ReactPointerEvent<HTMLSpanElement>) => {
                    if (!editable) return;
                    dateScrubRef.current = { x: e.clientX, end: form.endDateKey || selectedDate };
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setDateScrubbing(true);
                  }}
                  onPointerMove={(e: ReactPointerEvent<HTMLSpanElement>) => {
                    const s = dateScrubRef.current;
                    if (!s) return;
                    const d = Math.round((e.clientX - s.x) / 8);
                    let ne = addDaysIso(s.end, d);
                    if (ne < selectedDate) ne = selectedDate;
                    setForm((current) => ({ ...current, endDateKey: ne }));
                  }}
                  onPointerUp={() => {
                    dateScrubRef.current = null;
                    setDateScrubbing(false);
                  }}
                  onPointerCancel={() => {
                    dateScrubRef.current = null;
                    setDateScrubbing(false);
                  }}
                >
                  {formatSupportEnd(selectedDate, form.endDateKey || selectedDate)}
                </span>
                <button
                  aria-label="하루 늘리기"
                  className="dstep"
                  disabled={!editable}
                  onClick={() => {
                    const end = form.endDateKey || selectedDate;
                    setForm((current) => ({ ...current, endDateKey: addDaysIso(end, 1) }));
                  }}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <div className="duration-slider">
              <div className="dslider-head">
                <span>기간 — 끌거나 −/+ 로</span>
                <strong>{formatSupportEnd(selectedDate, form.endDateKey || selectedDate)}</strong>
              </div>
              <div className="dslider-row">
                <button
                  aria-label="하루 줄이기"
                  className="dstep"
                  disabled={!editable || (form.endDateKey || selectedDate) <= selectedDate}
                  onClick={() => {
                    const end = form.endDateKey || selectedDate;
                    const prev = addDaysIso(end, -1);
                    setForm((current) => ({
                      ...current,
                      endDateKey: prev < selectedDate ? selectedDate : prev
                    }));
                  }}
                  type="button"
                >
                  −
                </button>
                <input
                  aria-label="업 도움 기간(일)"
                  disabled={!editable}
                  max={45}
                  min={1}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      endDateKey: addDaysIso(selectedDate, Number(e.target.value) - 1)
                    }))
                  }
                  type="range"
                  value={spanDays(selectedDate, form.endDateKey || selectedDate)}
                />
                <button
                  aria-label="하루 늘리기"
                  className="dstep"
                  disabled={!editable || spanDays(selectedDate, form.endDateKey || selectedDate) >= 45}
                  onClick={() => {
                    const end = form.endDateKey || selectedDate;
                    setForm((current) => ({ ...current, endDateKey: addDaysIso(end, 1) }));
                  }}
                  type="button"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
        <label className="support-link-field">
          <span className="support-link-label">
            <ExternalLink aria-hidden="true" size={13} />
            업 도움 링크
          </span>
          <input
            className="support-link-input"
            disabled={!editable}
            inputMode="url"
            onChange={(event) =>
              setForm((current) => ({ ...current, supportUrl: event.target.value }))
            }
            placeholder="숲 게시글 URL 붙여넣기"
            type="url"
            value={form.supportUrl}
          />
          {/* 이미 설정된 링크는 바로 눌러 확인할 수 있게(같은 줄 끝에 작게). */}
          {form.supportUrl.trim() ? (
            <a
              className="support-visit"
              href={form.supportUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={13} />
              링크 열어 확인
            </a>
          ) : null}
        </label>
      </div>
    );
  }

  function renderSupportEditor() {
    return (
      <>
        {renderTentativeToggle()}
        <button
          aria-pressed={form.isSupport}
          className={`opt-chip support${form.isSupport ? " on" : ""}`}
          disabled={!canEdit}
          onClick={() => {
            hapticTick();
            setForm((current) => ({ ...current, isSupport: !current.isSupport }));
          }}
          type="button"
        >
          <span className="opt-chip-ic" aria-hidden="true">🌱</span>
          <span className="opt-chip-label">업 도움 설정</span>
          <span className="opt-chip-mark" aria-hidden="true">✓</span>
        </button>
        {form.isSupport ? renderSupportFields(canEdit) : null}
      </>
    );
  }

  // #미정: 아직 확정 아님 토글. 켜면 카드에 점선+'미정'으로 표시되고 시청자도 본다(공개 안전 상태값).
  function renderTentativeToggle() {
    return (
      <button
        aria-label="미정(아직 확정 아님) 표시"
        aria-pressed={form.isTentative}
        className={`opt-chip tentative${form.isTentative ? " on" : ""}`}
        disabled={!canEdit}
        onClick={() => {
          hapticTick();
          setForm((current) => ({ ...current, isTentative: !current.isTentative }));
        }}
        type="button"
      >
        <span className="opt-chip-ic" aria-hidden="true">🕗</span>
        <span className="opt-chip-label">아직 확정 아님</span>
        <span className="opt-chip-mark" aria-hidden="true">✓</span>
      </button>
    );
  }

  // 신뢰 멤버(매니저·작업자)용 "업 도움 수정" 시트 — 기간·링크만 고친다(토글·삭제 없음).
  // 모바일 매니저용 태그 수정 시트 — 일정의 태그 할당(최대 2개)만 고친다. toggleEventTag가
  // 낙관적 반영 + 서버 저장 + 미리보기 차단을 모두 처리한다.
  function renderMobileTagSheet() {
    const event = tagSheetId ? events.find((e) => e.id === tagSheetId) : null;
    if (!event) {
      return null;
    }
    return (
      <div
        className="modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) setTagSheetId(null);
        }}
        role="presentation"
      >
        <div className="modal-card" aria-modal="true" role="dialog">
          <div className="modal-head">
            <h2>태그 수정</h2>
            <button aria-label="닫기" className="modal-close" onClick={() => setTagSheetId(null)} type="button">
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <div className="passcode-box">
            <p className="detail-value">{event.publicTitle || "(제목 없음)"}</p>
            <div className="tag-picker">
              <TagPicker
                max={maxEventTags}
                onToggle={(id) => toggleEventTag(event, id)}
                palette={palette}
                selectedIds={event.tagIds}
                tags={viewTags}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSupportSheet() {
    return (
      <div
        className="modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSupportSheet();
        }}
        role="presentation"
      >
        <div className="modal-card" aria-modal="true" role="dialog">
          <div className="modal-head">
            <h2>🌱 업 도움 수정</h2>
            <button aria-label="닫기" className="modal-close" onClick={closeSupportSheet} type="button">
              <X aria-hidden="true" size={18} />
            </button>
          </div>
          <div className="passcode-box">
            {actionError ? <div className="auth-warning">{actionError}</div> : null}
            {renderSupportFields(true)}
            <div className="passcode-actions">
              <button className="button" onClick={closeSupportSheet} type="button">
                취소
              </button>
              <button
                className="button primary"
                disabled={supportSaving}
                onClick={saveSupportSettings}
                type="button"
              >
                <Save aria-hidden="true" size={15} />
                {supportSaving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderMobileEditSheet() {
    return (
      <div
        className="m-edit-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeMobileEdit();
        }}
        role="presentation"
        style={vvFit ? { height: vvFit.h, top: vvFit.top, bottom: "auto" } : undefined}
      >
        <div
          className="m-edit-sheet"
          aria-modal="true"
          role="dialog"
          style={vvFit ? { maxHeight: Math.round(vvFit.h * 0.96) } : undefined}
        >
          {/* 손잡이+헤더를 하나의 불투명 sticky 블록으로 — 스크롤 시 그 사이로 뒤 내용이
              비쳐 '뚫리는' 구간이 안 생긴다(아래로 쓸어 닫는 모바일 표준 어포던스). */}
          <div className="m-sheet-top">
            <button
              className="m-sheet-grab"
              aria-label="닫기"
              onClick={closeMobileEdit}
              type="button"
            >
              <span aria-hidden="true" />
            </button>
            <div className="m-edit-head">
              <strong>{selectedEventId ? "일정 수정" : "새 일정"}</strong>
              <span className="m-edit-date">{selectedDate}</span>
              <button aria-label="닫기" className="m-edit-x" onClick={closeMobileEdit} type="button">
                <X aria-hidden="true" size={20} />
              </button>
            </div>
          </div>

          {actionError ? <div className="auth-warning">{actionError}</div> : null}

          <form
            className="me-form"
            onSubmit={(e) => {
              saveEvent(e);
              setMobileEditId(null);
            }}
          >
            {draftRestored ? (
              <div className="draft-restored" role="status">
                <span>저장 안 한 임시 내용을 불러왔어요.</span>
                <button className="draft-restored-discard" onClick={discardDraft} type="button">
                  새로 쓰기
                </button>
              </div>
            ) : null}

            {/* 제목 — 무테 큰 입력. 화면의 초점. 첫 줄 제목, 다음 줄부터 세부. */}
            <textarea
              className="me-title"
              onChange={(e) => {
                setForm((cur) => ({ ...cur, publicTitle: e.target.value }));
                fitTitleHeight(); // 타이핑하며 줄이 늘면 즉시 높이 따라 키움
              }}
              placeholder="제목 입력 (다음 줄부터 세부 내용)"
              ref={mTitleRef}
              rows={2}
              value={form.publicTitle}
            />

            {/* 설정 그룹 카드 — 공개 범위 + 업 도움을 한 카드에 묶어 목록처럼. */}
            <div className="me-group">
              <div className="me-row me-row-stack">
                <span className="me-row-label">공개 범위</span>
                <div className="me-seg" role="group" aria-label="공개 범위">
                  <button
                    className={form.visibilityScope === "public" ? "on" : ""}
                    onClick={() => setForm((cur) => ({ ...cur, visibilityScope: "public" }))}
                    type="button"
                  >
                    모두
                  </button>
                  {isEffectivelyOwner ? (
                    <button
                      className={form.visibilityScope === "owner_private" ? "on" : ""}
                      onClick={() =>
                        setForm((cur) => ({ ...cur, visibilityScope: "owner_private" }))
                      }
                      type="button"
                    >
                      엠바고
                    </button>
                  ) : null}
                  <button
                    className={form.visibilityScope === "work" ? "on" : ""}
                    onClick={() => setForm((cur) => ({ ...cur, visibilityScope: "work" }))}
                    type="button"
                  >
                    작업자
                  </button>
                </div>
              </div>
              <div className="me-sep" />
              {renderSupportEditor()}
              {/* 떡밥(가림) — 공개 일정에만. 웹과 같은 구조(teaser-field + 칩 + 공개시각 카드/힌트)로
                  통일 → 미정·업도움과 간격도 동일. */}
              {form.visibilityScope === "public" ? (
                <div className="teaser-field">
                  <button
                    aria-pressed={form.teaser}
                    className={`opt-chip teaser${form.teaser ? " on" : ""}`}
                    disabled={!canEdit}
                    onClick={() => {
                      hapticTick();
                      setForm((c) => ({ ...c, teaser: !c.teaser }));
                    }}
                    type="button"
                  >
                    <span className="opt-chip-ic" aria-hidden="true">🔮</span>
                    <span className="opt-chip-label">일정 최초공개</span>
                    <span className="opt-chip-mark" aria-hidden="true">✓</span>
                  </button>
                  {form.teaser ? (
                    <div className="teaser-when">
                      <span className="teaser-when-label">공개 시각 (KST)</span>
                      <DateTimePicker
                        disabled={!canEdit}
                        onChange={(v) => setForm((c) => ({ ...c, teaserRevealAt: v }))}
                        onOpenChange={setTeaserPickerOpen}
                        open={teaserPickerOpen}
                        value={form.teaserRevealAt}
                      />
                      <em className="teaser-when-hint">
                        이 시각 전엔 시청자에게 제목·태그가 ??? 로 가려지고 공개까지 카운트다운만 보여요.
                      </em>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* 태그 그룹 — 대분류→세부 드릴다운 + 검색(2계층). 카드 색은 대분류로 ≤2 표시. */}
            <section className="me-group me-tag-group" aria-label="태그 선택">
              <div className="me-grouphead">
                <span className="me-grouptitle">
                  태그 <em className="me-hint">최대 {maxEventTags}개</em>
                </span>
              </div>
              <TagPicker
                max={maxEventTags}
                onToggle={selectTag}
                palette={palette}
                selectedIds={form.tagIds}
                tags={viewTags}
              />
            </section>

            {/* 공지·방문 그래프 — 보조 도구. 개발자는 둘 다, 그 외 편집자는 공지만. */}
            {isDevInsights ? (
              <div className="me-tools">
                <button className="me-tool" onClick={() => setModal("notice")} type="button">
                  📢 공지 쓰기
                </button>
                <button className="me-tool" onClick={() => setModal("dayVisit")} type="button">
                  📈 방문 그래프
                </button>
              </div>
            ) : canEdit ? (
              <div className="me-tools">
                <button className="me-tool" onClick={() => setModal("notice")} type="button">
                  📢 {selectedDate} 공지 쓰기
                </button>
              </div>
            ) : null}

            {/* 엄지존 고정 바: 스크롤해도 항상 바닥에 붙는다. 저장이 지배적(넓은 한 손 타깃),
                삭제는 보조. 저장은 낙관적(즉시 반영)이라 백그라운드 저장 중에도 막지 않는다 —
                빈 제목일 때만 비활성(빈 일정 생성 방지). */}
            <div className="m-edit-actions">
              {selectedEventId ? (
                <button
                  aria-label="이 일정 삭제"
                  className="button danger m-del"
                  onClick={() => {
                    deleteEvent(selectedEventId);
                    closeMobileEdit();
                  }}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              ) : null}
              <button
                className="button primary m-save"
                disabled={!form.publicTitle.trim()}
                type="submit"
              >
                <Save aria-hidden="true" size={18} />
                저장
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 시청자 화면 전체보기: 스튜디오 UI를 숨기고 공개 화면만 그대로 보여준다.
  if (viewerMode) {
    // 미리보기 일정은 서버 스냅샷(viewerModePreview)이 아니라 '편집실의 현재(낙관적) events'에서
    // 직접 만든다 → 방금 만든/지운 일정이 새로고침 없이 즉시 반영된다(예전엔 router.refresh에 기대
    // 옛 상태가 보였다). 공개 일정만(visibility public, draft 제외) 추리고 privateMeta는 제거해
    // 비공개 정보가 절대 안 샌다. 스티커·하트·팔레트 등 나머지는 서버 스냅샷 그대로 쓴다.
    // 하트 집계(관심도 🔥배지·정렬)는 공개 스냅샷(viewerModePreview)에만 있고 편집실 events엔
    // 없다 → id로 다시 붙여준다. 안 그러면 미리보기에서 '관심' 배지가 통째로 사라져, 실제
    // 로그아웃 공개 화면(배지 보임)과 달라 보인다.
    const heartCountById = new Map(
      (schedule.viewerModePreview.events ?? []).map((e) => [e.id, e.heartCount])
    );
    const previewSchedule = {
      ...schedule.viewerModePreview,
      events: events
        .filter((e) => e.visibilityScope === "public" && e.status !== "draft")
        .map((e) => {
          const { privateMeta: _omit, ...rest } = e;
          void _omit;
          return {
            ...rest,
            heartCount: heartCountById.get(e.id)
          } as unknown as PublicScheduleEvent;
        })
    };
    // 편집실/꾸미기 이동 버튼 — 웹은 포스터 위 오버레이로, 모바일은 포스터 제목 헤더 안으로 주입한다.
    const previewNav = (
      <>
        <button className="button" onClick={() => setViewerMode(false)} type="button">
          <ChevronLeft aria-hidden="true" size={16} />
          {isNarrow ? "편집실" : "편집실로 가기"}
        </button>
        {/* 꾸미기는 PC 전용 — 모바일(isNarrow)에선 진입 버튼을 숨긴다. */}
        {canDecorateCalendar && !isNarrow ? (
          <Link
            className="button"
            href={`/studio/decorate/${view.year}/${view.month}`}
            onClick={() => {
              // 진입 월을 쿠키에 박아 둔다 → 꾸미기 새로고침 시 이 달부터(이후 월 이동도 추적).
              // dp=0으로 리셋: "꾸미기로 가기"는 항상 꾸미기 화면으로(직전 미리보기 상태 무시).
              writeViewCookie({ dy: view.year, dm: view.month, dp: 0 });
              startNav(isNarrow ? "꾸미기 여는 중…" : "꾸미기 화면을 여는 중입니다…");
            }}
          >
            <Sparkles aria-hidden="true" size={16} />
            꾸미러 가기
          </Link>
        ) : null}
      </>
    );
    return (
      <div className="viewer-fullscreen">
        {navMsg ? (
          <div className="private-loading" role="status" aria-live="polite">
            <span className="private-loading-spinner" aria-hidden="true" />
            {navMsg}
          </div>
        ) : null}
        {/* 웹: 흰 바 없이 포스터 위 오버레이로 안내·버튼을 띄운다.
            모바일은 좁아서 제목과 겹치므로 — 아래 PublicPoster의 제목 헤더 안으로 주입한다. */}
        {!isNarrow ? (
          <div className="viewer-preview-overlay">
            <span aria-hidden="true" />
            <div className="viewer-preview-actions">{previewNav}</div>
          </div>
        ) : null}
        <PublicPoster
          avatarSlot={avatarRoleOk}
          avatarOn={avatarOn}
          avatarSide={avatarSide}
          onAvatarToggle={toggleAvatarOn}
          onAvatarSide={pickAvatarSide}
          initialMonth={view.month}
          initialNarrow={isNarrow}
          initialYear={view.year}
          onViewChange={(year, month) => setView({ year, month })}
          previewNav={previewNav}
          schedule={previewSchedule}
          toggleHeartAction={toggleEventHeartAction}
        />
      </div>
    );
  }

  // 색상 필터 패널 — 평소엔 좌측 그리드 칸, 아바타 scene에선 아바타 위 rail에 넣어 재사용.
  const studioFilterPanel = (
    <section>
      <h2>태그 필터</h2>
      <TagLegendEditor
        canEdit={false}
        filterIds={tagFilters}
        onToggleFilter={toggleTagFilter}
        palette={palette}
        tags={viewTags}
      />
      {canReadPrivate ? (
        <button
          aria-pressed={tagFilters.includes(PRIVATE_FILTER)}
          className={`tag-legend-filter ${tagFilters.includes(PRIVATE_FILTER) ? "on" : ""} ${
            tagFilters.length > 0 && !tagFilters.includes(PRIVATE_FILTER) ? "dim" : ""
          }`}
          onClick={() => toggleTagFilter(PRIVATE_FILTER)}
          type="button"
        >
          <i className="legend-private-swatch" aria-hidden="true" />
          비공개
        </button>
      ) : null}
    </section>
  );

  return (
    <main
      className={`studio-shell${avatarSceneOn ? ` avatar-scene avatar-${avatarSide}` : ""}${
        avatarReady ? "" : " avatar-no-anim"
      }`}
    >
      {/* 편집실 중력 축구공(월드컵 기간만) — 편집 중 간단히 갖고 노는 장식. 일정 작업 방해 0.
          (시청자 화면 미리보기에선 위 PublicPoster가 '전체' 미니게임을 직접 띄운다.) */}
      {isWorldCupMonth(view.year, view.month) && !viewerMode ? (
        <WorldCupStudioBall pauseWhenMinigameOn={false} />
      ) : null}
      {/* 아바타 rail — 하나의 fixed flex-column 박스에 [색상필터(위, 스크롤) | 아바타(아래, 고정비율)].
          flex-column이라 둘이 절대 안 겹친다. scene일 때만 필터를 여기 담는다. */}
      {avatarEditor ? (
        <aside className="avatar-rail" aria-label="아바타 자리 영역(관리자 전용)">
          {avatarSceneOn ? <div className="avatar-rail-filter">{studioFilterPanel}</div> : null}
          <div className="avatar-slot">
            <div className="avatar-dock-inner">
              <span className="avatar-slot-hint">🎙️ 아바타 자리</span>
            </div>
          </div>
        </aside>
      ) : null}
      {copyToast ? (
        <div className="copy-toast" role="status" aria-live="polite">
          {copyToast}
        </div>
      ) : null}
      {loadingPrivate ? (
        // 잠금해제 핸드셰이크 2단계(여는 중). 패널의 "확인 중…"(검증)과 ⚠배너(활성) 사이
        // 단계를 명확히 보여 "확인됐는데 아직 안 보이는" 모호한 순간을 없앤다.
        <div className="private-loading private-unlocking" role="status" aria-live="polite">
          <span className="private-loading-spinner" aria-hidden="true" />
          <span className="private-unlocking-text">
            <strong>{isNarrow ? "비공개 여는 중…" : "🔓 비공개 레이어를 여는 중입니다…"}</strong>
            <em>비밀번호가 확인됐어요. 비공개 일정을 불러오고 있습니다.</em>
          </span>
        </div>
      ) : null}
      {navMsg ? (
        <div className="private-loading" role="status" aria-live="polite">
          <span className="private-loading-spinner" aria-hidden="true" />
          {navMsg}
        </div>
      ) : null}
      {isNarrow ? (
        renderMobile()
      ) : (
        <>
      <header className="studio-topbar">
        {/* 왼쪽 칸: 큰 제목(왼쪽 정렬) + 그 오른쪽 아래 끝선에 "토리님 편집실" */}
        <div className="studio-left">
          <h1 className="studio-poster-title">
            <span aria-hidden="true">✨️</span>
            {schedule.calendar.title}
            <span aria-hidden="true">✨️</span>
          </h1>
          <p className="eyebrow studio-eyebrow">{deskLabel}</p>
        </div>

        {/* 가운데: 현재 월(크게). 이동은 하단 플로팅 < > 버튼 + 키보드 ←/→ 로.
            key로 월 바뀔 때 재마운트 → 방향대로 살짝 슬라이드(내가 달을 넘기는 느낌). */}
        <div
          className="studio-month-label"
          aria-label="현재 월"
          data-enter={monthDir}
          key={`${view.year}-${view.month}`}
        >
          <strong>
            {view.year}년 {view.month}월
          </strong>
        </div>

        {/* 오른쪽: 역할·도구 (저장 상태 칩은 아래 액션바의 '비공개 일정 보기' 왼쪽으로 옮겼다.) */}
        <div className="studio-role-tools">
          {/* 미리보기 안내는 역할 배지("?") 설명 팝오버 안 작은 문구로 일원화(별도 플래그 제거). */}
          {renderRoleBadge()}
          {/* 개발자는 역할 미리보기 드롭다운, 그 외 역할은 시청자 화면 미리보기. */}
          {isDeveloper ? (
            renderPreviewControl()
          ) : (
            <button className="button io-accent io-preview" onClick={() => enterViewerMode()} type="button">
              <Eye aria-hidden="true" size={16} />
              {/* '보여주기'는 관리자(owner)만 — 매니저·작업자는 '미리보기'. */}
              {isEffectivelyOwner ? "시청자 화면 보여주기" : "시청자 화면 미리보기"}
            </button>
          )}
          {actor.isAuthenticated ? (
            <form action="/api/auth/logout" method="post">
              <button
                className="button io-accent io-logout"
                onClick={() => startNav("로그아웃 중…")}
                type="submit"
              >
                로그아웃
              </button>
            </form>
          ) : (
            <Link className="button" href="/login">
              로그인
            </Link>
          )}
        </div>
      </header>

      {/* 상단 액션바: 역할(또는 미리보기 역할)에 맞는 작업 버튼만. 미리보기 컨트롤은 헤더에 있다.
          (개발자 역할 표시는 헤더의 역할 배지로 충분 — 별도 세션 안내 줄은 두지 않는다.) */}
      <div className="studio-actionbar">
        <div className="studio-actionbar-tools">
          {/* 배포 확인용 버전(커밋) — 액션바 가운데. 개발자는 또렷한 보라 펄, 그 외엔 흐린 회색. */}
          <span
            className={`studio-build-tag${isDevInsights ? " dev" : ""}`}
            aria-hidden="true"
          >
            {process.env.APP_COMMIT?.slice(0, 7) ?? "dev"}
          </span>
          {/* 관리 묶음 — owner/dev 운영 도구(태그·멤버·접속자)를 한 덩어리로. 매니저/작업자(또는
              그 역할 미리보기 중)는 비어서 렌더하지 않는다 → 액션바가 꾸미기 하나로 깔끔해진다. */}
          {canEdit || (isDeveloper && !previewRole) ? (
            <div className="studio-manage-group" role="group" aria-label="관리">
              {/* 단계 배포: 태그 '정의 편집' 진입은 v3 역할(현재 개발자)만. */}
              {canEdit && taxonomyV3 ? (
                <button
                  className="button io-accent io-tags"
                  onClick={() => (blockedByPreview() ? null : setModal("tags"))}
                  type="button"
                >
                  태그 편집
                </button>
              ) : null}
              {canEdit ? (
                <button
                  className="button io-accent io-members"
                  onClick={() => (blockedByPreview() ? null : setModal("members"))}
                  type="button"
                >
                  멤버 관리
                </button>
              ) : null}
              {isDeveloper && !previewRole ? (
                <button className="button io-accent io-insights" onClick={() => setModal("developer")} type="button">
                  🛠 월별 인사이트
                </button>
              ) : null}
            </div>
          ) : null}
          {/* 관리자·매니저·작업자(또는 그 역할 미리보기) — 수치 없는 4패널 멤버 인사이트. */}
          {canMemberInsights ? (
            <button className="button io-accent io-insights" onClick={() => setModal("developer")} type="button">
              📊 월별 인사이트
            </button>
          ) : null}
          {/* 아바타 자리 토글 — 월별 인사이트 오른쪽. */}
          {avatarEditor ? (
            <div className="studio-avatar-ctl" role="group" aria-label="아바타 자리 설정">
              <button
                type="button"
                className={`avatar-ctl-toggle${avatarOn ? " on" : ""}`}
                aria-pressed={avatarOn}
                onClick={toggleAvatarOn}
              >
                🎙️ 아바타 자리 {avatarOn ? "끄기" : "켜기"}
              </button>
              {avatarOn ? (
                <div className="avatar-ctl-side" role="group" aria-label="아바타 위치">
                  <button
                    type="button"
                    className={avatarSide === "left" ? "on" : ""}
                    aria-pressed={avatarSide === "left"}
                    onClick={() => pickAvatarSide("left")}
                  >
                    왼쪽
                  </button>
                  <button
                    type="button"
                    className={avatarSide === "right" ? "on" : ""}
                    aria-pressed={avatarSide === "right"}
                    onClick={() => pickAvatarSide("right")}
                  >
                    오른쪽
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
          {/* 우측 묶음: 저장 상태 칩 + 비공개 일정 보기(토글) + 달력 꾸미기.
              칩은 '비공개 일정 보기' 왼쪽, 버튼 아래 끝선에 맞춰 둔다. 모든 역할(매니저·작업자
              포함) 공통 — 칩은 studioWrite 한 곳이 구동하므로 그들의 태그·업도움 저장에도 반응. */}
          <div className="studio-actionbar-right">
            {renderSaveStatus()}
            {canTogglePrivateLayer ? (
              isEffectivelyOwner && canReadPrivate ? (
                // 웹: 처음 켠 자리(토글)에 그대로 "비공개 끄기" — 마우스 이동 최소화. 비밀번호 변경은 경고 배너로.
                <button
                  className="private-toggle active io-accent io-private"
                  onClick={() => setShowPrivate(false)}
                  type="button"
                >
                  <EyeOff size={16} />
                  비공개 끄기
                </button>
              ) : (
                <button
                  className={`${canReadPrivate ? "private-toggle active" : "private-toggle"} io-accent io-private`}
                  onClick={togglePrivateLayer}
                  type="button"
                >
                  {canReadPrivate ? <EyeOff size={16} /> : <Eye size={16} />}
                  {canReadPrivate ? "비공개 표시 중" : "비공개 일정 보기"}
                </button>
              )
            ) : null}
            {canDecorateCalendar ? (
              <Link
                // 매니저·작업자는 일정 편집을 못 하니 꾸미기가 1차 작업 → primary로 강조.
                className={`button io-accent ${canEdit ? "io-decorate" : "primary"}`}
                href={`/studio/decorate/${view.year}/${view.month}`}
                onClick={() => {
                  // 진입 월을 쿠키에 박아 둔다 → 꾸미기 새로고침 시 이 달부터(이후 월 이동도 추적).
                  // dp=0으로 리셋: "꾸미기로 가기"는 항상 꾸미기 화면으로(직전 미리보기 상태 무시).
                  writeViewCookie({ dy: view.year, dm: view.month, dp: 0 });
                  startNav(isNarrow ? "꾸미기 여는 중…" : "꾸미기 화면을 여는 중입니다…");
                }}
              >
                달력 꾸미기
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {canReadPrivate && isEffectivelyOwner ? (
        <div className="private-warning">
          <LockKeyhole aria-hidden="true" size={17} />
          ⚠ 비공개 일정 표시 중입니다. 방송 화면 공유에 주의하세요.
          {/* 웹: 끄기는 위 토글 자리로 옮겼고, 여기엔 덜 쓰는 "비밀번호 변경"을 둔다. */}
          <button className="private-warning-btn" onClick={() => openChangePasscode()} type="button">
            비밀번호 변경
          </button>
        </div>
      ) : null}

      {/* #9 키보드 단축키 안내바 — 웹(데스크톱)·소유자(canEdit)에서만. 달력 '위'에 옅게(아래에 두면
          하단 플로팅 바·접힘으로 잘 안 보여 위로 올림). */}
      {canEdit ? (
        // 기본은 접어 달력을 넓게 — '단축키 설명' 탭(역사다리꼴)을 누르면 안내바가 펼쳐진다.
        <div className={`kbd-hints-wrap${kbdHintsOpen ? " open" : ""}`}>
          <button
            type="button"
            className="kbd-hints-toggle"
            aria-expanded={kbdHintsOpen}
            onClick={() => {
              hapticTick();
              setKbdHintsOpen((v) => !v);
            }}
          >
            ⌨ 단축키 설명
            <ChevronDown aria-hidden="true" size={13} />
          </button>
        {kbdHintsOpen ? (
        // 한 줄 칩 흐름 유지. 설명은 라벨 수준으로 짧게 — 키가 주인공이고 문장은 잡음이다.
        <div className="kbd-hints" aria-label="키보드 단축키 안내">
          <span className="kbd-hints-title">단축키</span>
          <span><kbd>Alt</kbd>+<kbd>N</kbd> 새 일정</span>
          <span><kbd>글자</kbd> 제목</span>
          <span><kbd>Ctrl</kbd>+<kbd>S</kbd> 저장</span>
          <span><kbd>Del</kbd> 삭제</span>
          <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> 되살리기</span>
          <span><kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd> 복붙</span>
          <span><kbd>우클릭 드래그</kbd> 잇기</span>
          <span><kbd>우클릭 긋기</kbd> 끊기</span>
          <span><kbd>드래그</kbd> 범위 선택</span>
          <span><kbd>Ctrl</kbd>+클릭 다중 선택</span>
          <span><kbd>←</kbd><kbd>→</kbd> 이동</span>
          <span><kbd>Esc</kbd> 닫기</span>
        </div>
        ) : null}
        </div>
      ) : null}

      <section className={`studio-workspace ${editorVisible ? "editor-open" : ""}`}>
        {/* 아바타 scene에선 색상필터가 우측 rail로 가므로 좌측 칸은 비운다(칸 폭도 0). */}
        <aside className="studio-left-panel">{avatarSceneOn ? null : studioFilterPanel}</aside>

        <section className="studio-calendar-panel">
          <div className="studio-weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday, index) => (
              <span
                className={index === 0 ? "sunday" : index === 6 ? "saturday" : ""}
                key={weekday}
              >
                {weekday}
              </span>
            ))}
          </div>
          <div
            className={`studio-month-grid${isFirstReveal ? " cal-reveal" : ""}`}
            aria-label="월간 달력"
            data-enter={monthDir}
            key={`${view.year}-${view.month}`}
            ref={setMonthGridRef}
          >
            {cells.map((cell, cellIndex) => {
              const covering = getEventsForDate(liveEvents, cell.isoDate);
              const supportHere = covering.filter((e) => e.isSupport);
              const dateEvents = covering.filter((e) => !e.isSupport);
              // 드롭 삽입선이 이 칸의 어느 카드 앞에 올지(없으면 undefined, null이면 맨 끝).
              // 안내선은 '다른' 카드 사이 위/아래를 고를 때만 의미가 있다. 드래그 중인 카드(희미한
              // 원위치)밖에 없는 칸이나 빈 칸엔 띄우지 않는다 — 희미한 카드가 이미 원래 자리를 보여줌.
              let dropLineBeforeId: string | null | undefined = undefined;
              const hasOtherEvent = dateEvents.some((e) => e.id !== dragEventId);
              if (dragEventId && dropSlot && dropSlot.day === cell.isoDate && hasOtherEvent) {
                // 끈(이어진 일정)은 위에 고정 — 안내선은 끈 아래에서만 뜬다.
                const connectedCount = dateEvents.filter((e) => isConnectedEvent(e)).length;
                let li: number;
                if (!dropSlot.overId) {
                  li = dateEvents.length;
                } else {
                  const oi = dateEvents.findIndex((e) => e.id === dropSlot.overId);
                  li = oi < 0 ? dateEvents.length : dropSlot.after ? oi + 1 : oi;
                }
                li = Math.max(li, connectedCount); // 끈 위로는 못 올라감
                dropLineBeforeId = li >= dateEvents.length ? null : dateEvents[li].id;
              }
              const day = classifyDay(cell.isoDate, cell.weekday, today);
              // 이 칸이 속한 주의 업 도움 줄 수만큼만 위 여백을 둔다(띠 없는 주는 0).
              const weekSupCount = weekSupportLaneCount[Math.floor(cellIndex / 7)] ?? 0;

              const dayClass = [
                "studio-day",
                cell.inCurrentMonth ? "" : "outside",
                editorVisible && selectedDate === cell.isoDate ? "selected" : "",
                day.isPast ? "past" : "future",
                day.isToday ? "today" : "",
                // 드래그 중 이 칸 위에 있으면 "여기에 놓기" 강조.
                dragEventId && dropDate === cell.isoDate ? "drop-target" : "",
                // 휴방 메뉴가 이 칸에 떠 있으면 어느 날인지 분명히 강조.
                restMenu?.isoDate === cell.isoDate ? "rest-target" : "",
                // 시트식 범위 선택(시각 강조). React state라 카드 드래그 리렌더에도 유지.
                rangeSelected.has(cellIndex) ? "cell-range-selected" : ""
              ]
                .filter(Boolean)
                .join(" ");

              const numClass = day.isRed ? "red" : day.isSaturday ? "saturday" : "";

              return (
                <article
                  className={dayClass}
                  data-isodate={cell.isoDate}
                  data-cell-index={cellIndex}
                  key={cell.isoDate}
                  onClick={() => {
                    if (suppressCellClickRef.current) {
                      suppressCellClickRef.current = false; // 롱프레스로 메뉴 연 직후의 click 1회 무시
                      return;
                    }
                    selectDate(cell.isoDate);
                  }}
                  onPointerDown={(e) => onCellPointerDown(e, cell.isoDate)}
                  onPointerMove={onCellPointerMove}
                  onPointerUp={cancelCellHold}
                  onPointerLeave={cancelCellHold}
                  onPointerCancel={cancelCellHold}
                  role="button"
                  style={isFirstReveal ? ({ "--ri": cellIndex } as CSSProperties) : undefined}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") selectDate(cell.isoDate);
                  }}
                >
                  {supportHere.map((s) => {
                    const lane = supportLanes.lanes.get(s.id) ?? 0;
                    const start = getEventDateKey(s);
                    const end = s.endDateKey ?? start;
                    const isStart = cell.isoDate === start;
                    const isEnd = cell.isoDate === end;
                    // 주 경계(토→일)에서도 끈을 끊지 않음 → 시작/끝일에만 둥글게
                    const left = isStart;
                    const right = isEnd;
                    return (
                      <div
                        // 필터를 켜면 일정 카드만 흐려지고 업 도움 끈은 쨍하게 남아, 안 고른 기간이
                        // 오히려 제일 눈에 띄었다(시청자 화면에서 같은 이유로 이미 고쳤다).
                        // 판정은 카드와 같은 isDimmedByFilter — 끈에 태그가 없으면 필터 켤 때 물러난다.
                        className={`support-bar${isDimmedByFilter(s) ? " filter-dim" : ""}`}
                        key={s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          // 매니저는 업 도움 설정 수정 시트를 띄운다(전체 편집 불가). 작업자는 읽기 전용.
                          if (!canEdit && canEditSupportThing) {
                            openSupportSheet(s);
                          } else {
                            selectEvent(s);
                          }
                        }}
                        style={{
                          top: 26 + lane * 20,
                          left: left ? 3 : 0,
                          right: right ? 3 : 0,
                          borderTopLeftRadius: left ? 9 : 0,
                          borderBottomLeftRadius: left ? 9 : 0,
                          borderTopRightRadius: right ? 9 : 0,
                          borderBottomRightRadius: right ? 9 : 0
                        }}
                      >
                        {isStart || isEnd ? <span>🌱 {s.publicTitle}</span> : null}
                      </div>
                    );
                  })}
                  <div className="studio-day-head">
                    <strong className={numClass}>{cell.dayOfMonth}</strong>
                    {day.markName ? (
                      <em className={`day-mark${day.markKind ? ` ${day.markKind}` : ""}`}>
                        {day.markName}
                      </em>
                    ) : null}
                  </div>
                  {/* 월드컵 경기 대진·스코어 — 헤더(초복 등)와 별개로 칸 본문 칩(편집실도 시청자와 동일). */}
                  {day.wcMatch ? (
                    <div className={`day-wc-match ${day.wcMatch.kind}`}>{day.wcMatch.text}</div>
                  ) : null}
                  <div
                    className="studio-event-list"
                    style={
                      weekSupCount > 0 ? { paddingTop: 8 + weekSupCount * 20 } : undefined
                    }
                  >
                    {dateEvents.map((event, eventIndex) => {
                      const colors = eventColors(event);
                      // PR2: 칸 색(≤2)에 못 담은 나머지 대분류 → 작은 점 줄("더 있음").
                      const extraColors = tagVisual.eventExtras(event);
                      // 선택 강조(테두리·X)는 오른쪽 편집/상세 패널이 열려 있을 때만 — 패널이
                      // 닫히면(다른 버튼으로 슬라이드-아웃) 카드 선택 표시도 함께 사라지게.
                      const isSel = editorVisible && selectedEventId === event.id;
                      // 연결된 체인이면 체인 전체에 선택 테두리를 입힌다.
                      const inSelChain = editorVisible && selectedChainIds.has(event.id);
                      const { main, subs } = splitEventTitle(event.publicTitle);
                      const span = getEventSpan(
                        event,
                        cell.isoDate,
                        cell.weekday,
                        visibleEvents
                      );
                      const draggable = canEdit && !span.isMulti;
                      // 우클릭-드래그로 잇기 중: 이을 수 있는 상대는 강조(hover면 더 강하게), 나머지는 흐림.
                      const connecting = connectCandidates.size > 0;
                      const isConnTarget = connecting && connectCandidates.has(event.id);
                      const isConnHover = connectHoverId === event.id;
                      const connDim =
                        connecting &&
                        !isConnTarget &&
                        event.id !== connectSourceId &&
                        dragEventId !== event.id;
                      // 떡밥 표시는 '아직 안 풀린'(공개 시각이 미래) 것만. 시각이 지나면 평범한 일정과
                      // 완전히 동일 — 점선·🔮 모두 끈다.
                      const teaserHidden = teaserStillHidden(event);
                      const pillClass = [
                        "studio-event-pill",
                        event.visibilityScope,
                        teaserHidden ? "teaser" : "", // 떡밥(가림, 미공개) — 보라 점선으로 표시
                        inSelChain ? "selected" : "",
                        isSel ? "primary-selected" : "",
                        isDimmedByFilter(event) ? "filter-dim" : "",
                        event.isTentative && span.showTitle ? "tentative" : "",
                        span.isMulti ? "span" : "",
                        span.isMulti && !span.roundLeft ? "no-left" : "",
                        span.isMulti && !span.roundRight ? "no-right" : "",
                        draggable ? "draggable" : "",
                        dragEventId === event.id ? "dragging-src" : "",
                        isConnTarget ? "connect-target" : "",
                        isConnHover ? "connect-hover" : "",
                        connDim ? "connect-dim" : "",
                        cutFlashId === event.id ? "cut-flash" : "",
                        justSavedId === event.id ? "just-saved" : "",
                        deletingIds.has(event.id) ? "deleting" : ""
                      ]
                        .filter(Boolean)
                        .join(" ");
                      const mixed = colors.length >= 2;
                      // 칠 묶음(같은 태그 구성으로 이어진 칸들) 전체 기준으로 경계를 가운데에.
                      const pg = paintGroups.get(event.id);
                      const run =
                        mixed && pg
                          ? getSpanRunRange(pg.start, pg.end, cell.isoDate, cell.weekday)
                          : null;
                      const mixStyle = mixed && run ? mixedEventStyle(colors, run) : null;
                      return (
                        <div
                          className={pillClass}
                          data-chain={chainKeys.get(event.id)}
                          data-color={mixed ? undefined : colors[0]?.key}
                          data-eventid={event.id}
                          // A1: 평평한(이어진) 변 — 'L'/'R'. 이 값이 바뀌면 seam 연출(연결/끊김).
                          data-seam={`${span.isMulti && !span.roundLeft ? "L" : ""}${span.isMulti && !span.roundRight ? "R" : ""}`}
                          data-mixed={mixed ? "" : undefined}
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            // 방금 드래그로 옮겼다면 이 클릭(선택)은 1회 무시한다.
                            if (justDraggedRef.current) {
                              justDraggedRef.current = false;
                              return;
                            }
                            handlePillClick(event.id);
                          }}
                          onPointerDown={
                            draggable ? (e) => onPillPointerDown(e, event) : undefined
                          }
                          role="button"
                          style={
                            mixStyle ?? (colors.length > 0 ? eventColorStyle(colors) : undefined)
                          }
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              handlePillClick(event.id);
                            }
                          }}
                        >
                          {/* 드롭 안내선 — 카드 위/아래 틈에 겹치는 절대 오버레이(레이아웃 영향 없음). */}
                          {dropLineBeforeId === event.id ? (
                            <span className="drop-insert-line" aria-hidden="true" />
                          ) : null}
                          {dropLineBeforeId === null && eventIndex === dateEvents.length - 1 ? (
                            <span className="drop-insert-line end" aria-hidden="true" />
                          ) : null}
                          <div className="pill-main">
                            {/* #8 옮긴 직후 서버 반영 전 — 작은 '동기화 중' 점(돌아감). 반영되면 사라진다. */}
                            {span.showTitle && syncingIds.includes(event.id) ? (
                              <span className="pill-sync" aria-hidden="true" title="동기화 중…" />
                            ) : null}
                            {/* 미정 칩(세로 미/정)은 strong 밖, flex 부모(.pill-main, align-items:center)
                                직속으로 둬 2줄 높이 칩이 제목과 정확히 가운데 정렬되게 한다. */}
                            {span.showTitle && event.isTentative ? (
                              <span className="evt-tentative">미정</span>
                            ) : null}
                            {/* 떡밥(가림) 배지 — 편집실에선 토리·개발자가 어떤 일정이 가려졌는지 한눈에.
                                시청자에겐 공개 시각 전까지 ???로만 보인다. 호버하면 공개 예정 시각. */}
                            {span.showTitle && teaserHidden ? (
                              <span className="pill-teaser" title={teaserBadgeTitle(event.teaserRevealAt)}>
                                🔮
                              </span>
                            ) : null}
                            {/* 이어지는 칸은 제목을 투명하게 그려 시작 칸과 높이를 맞춘다. */}
                            {span.showTitle ? (
                              <strong>{main}</strong>
                            ) : (
                              <strong className="span-cont">{main || " "}</strong>
                            )}
                          </div>
                          {/* 삭제 X는 pill-main 밖(카드 직속)에 둔다 — 2색 카드는 pill-main이
                              position:relative가 돼(무늬 z-index) top:50%가 제목 줄 기준이 되어
                              여러 줄 카드에서 X가 위로 쏠렸다. 카드 직속이면 항상 카드 전체 세로 중앙. */}
                          {span.showTitle && isSel && canEdit ? (
                            <button
                              aria-label="일정 삭제"
                              className="pill-delete"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteEvent(event.id);
                              }}
                              title="이 일정 삭제"
                              type="button"
                            >
                              <X aria-hidden="true" size={17} strokeWidth={3} />
                            </button>
                          ) : null}
                          {/* 일정 카드는 항상 펼침 고정. 이어지는 칸은 투명으로 높이만 맞춘다.
                              형식색 점은 '마지막 서브 줄의 오른쪽'에 함께 둔다 — 서브 텍스트와 점이
                              한 줄에 들어가면 같은 줄에 붙어(별도 줄을 안 써 높이 최소화), 안 들어가면
                              flex-wrap으로 점만 아래로 내려간다(겹침 없음). 서브가 없으면 점만 한 줄에. */}
                          {(() => {
                            const dots =
                              span.showTitle && extraColors.length > 0 ? (
                                <span className="pill-dots" aria-hidden="true">
                                  {extraColors.map((c, i) => (
                                    <i
                                      key={i}
                                      style={{ background: c.bgColor, borderColor: c.borderColor }}
                                    />
                                  ))}
                                </span>
                              ) : null;
                            if (subs.length === 0) return dots;
                            const last = subs.length - 1;
                            return (
                              <ul className={`pill-subs${span.showTitle ? "" : " span-cont"}`}>
                                {subs.map((sub, i) =>
                                  i === last && dots ? (
                                    <li key={i} className="pill-sub-last">
                                      <span className="pill-sub-text">{sub}</span>
                                      {dots}
                                    </li>
                                  ) : (
                                    <li key={i}>{sub}</li>
                                  )
                                )}
                              </ul>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className={`event-editor-panel${panelSaved ? " panel-saved" : ""}`}>
          {/* 매니저·작업자는 편집 불가 → 회색 폼 대신 깔끔한 읽기전용 상세를 보여준다(A1). */}
          {!canEdit ? (
            renderReadonlyDetail()
          ) : (
          /* key는 editorKey(명시적 선택 시에만 증가) — 저장·삭제 같은 내부 상태 변화로는 재마운트
             되지 않아 깜빡이지 않는다. 날짜/일정을 새로 고를 때만 쑥 내려오는 전환. */
          <form onSubmit={saveEvent} key={editorKey}>
            <div className="editor-heading">
              {/* 한 줄: 접기(>) · 날짜 · 라벨 ─ 오른쪽 끝 저장. (높이 절약 — 날짜를 아래줄로 빼지 않음) */}
              <div className="editor-heading-bar">
                <div className="editor-heading-left">
                  <button
                    aria-label="편집 카드 닫기"
                    className="editor-collapse"
                    onClick={() => setEditorVisible(false)}
                    title="닫기"
                    type="button"
                  >
                    <ChevronRight aria-hidden="true" size={20} strokeWidth={2.5} />
                  </button>
                  {/* key로 날짜가 바뀔 때마다 재마운트 → 쓱 바뀌는 애니메이션으로 '옮겼다'를 인지. */}
                  <span className="editor-date-inline" key={selectedDate}>
                    {selectedDate}
                  </span>
                  <p className="eyebrow">{selectedEventId ? "일정 수정" : "새 일정"}</p>
                </div>
                <button
                  className="button primary editor-save"
                  disabled={!canEdit || !form.publicTitle.trim()}
                  type="submit"
                >
                  저장
                </button>
              </div>
            </div>

            {actionError ? <div className="auth-warning">{actionError}</div> : null}

            {draftRestored ? (
              <div className="draft-restored" role="status">
                <span>저장 안 한 임시 내용을 불러왔어요.</span>
                <button className="draft-restored-discard" onClick={discardDraft} type="button">
                  새로 쓰기
                </button>
              </div>
            ) : null}

            <label>
              제목
              <textarea
                disabled={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, publicTitle: event.target.value }))
                }
                placeholder="예: 풀트뱅"
                ref={editorTitleRef}
                value={form.publicTitle}
              />
            </label>

            {/* 공개 범위 + 옵션(미정·업도움·떡밥)은 접어 둔다 — 대부분의 일정은 '모두 공개 + 옵션
                없음'이라 매번 펼쳐 볼 필요가 없다. 제목·태그(자주 쓰는 것)를 먼저 보이게 하고,
                이 묶음은 헤더에 현재 상태를 요약해 보여준 뒤 필요할 때만 펼친다. 기본 접힘. */}
            <div className={`fold-field${scopeFoldOpen ? " open" : ""}`}>
              <button
                aria-expanded={scopeFoldOpen}
                className="fold-head"
                onClick={() => {
                  hapticTick();
                  setScopeFoldOpen((v) => !v);
                }}
                type="button"
              >
                <span className="fold-title">공개 범위 · 옵션</span>
                <span className="fold-summary">{scopeFoldSummary}</span>
                <ChevronDown aria-hidden="true" className="fold-chev" size={16} />
              </button>
              {scopeFoldOpen ? (
                <div className="fold-body">
            <div className="scope-field">
              <span className="scope-field-label">공개 범위</span>
              {canReadPrivate ? (
                (() => {
                  // 역할별 옵션 — 개발자/작업자는 엠바고(owner_private) 없음. 카드 수만큼 칸을 만들어
                  // (2개면 2칸) 오른쪽 빈 공간 없이 폭을 꽉 채운다.
                  const opts = [
                    { v: "public", Icon: Globe, label: "모두", sub: "누구나 봐요" },
                    ...(isEffectivelyOwner
                      ? [{ v: "owner_private", Icon: LockKeyhole, label: "엠바고", sub: "관리자만" }]
                      : []),
                    { v: "work", Icon: Wrench, label: "작업자", sub: "작업자까지" }
                  ];
                  return (
                    <div
                      aria-label="공개 범위"
                      className="scope-picker"
                      role="radiogroup"
                      style={{ gridTemplateColumns: `repeat(${opts.length}, 1fr)` }}
                    >
                      {opts.map(({ v, Icon, label, sub }) => {
                        const on = form.visibilityScope === v;
                        return (
                          <button
                            aria-checked={on}
                            className={`scope-opt${on ? " on" : ""}`}
                            data-scope={v}
                            disabled={!canEdit}
                            key={v}
                            onClick={() => {
                              hapticTick();
                              setForm((current) => ({
                                ...current,
                                visibilityScope: v as EventVisibilityScope
                              }));
                            }}
                            role="radio"
                            type="button"
                          >
                            <Icon aria-hidden="true" className="scope-opt-ic" size={18} />
                            <span className="scope-opt-label">{label}</span>
                            <span className="scope-opt-sub">{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()
              ) : (
                // 비공개 레이어 잠김: 공개 범위는 "모두"로 고정. 풀면 역할에 맞는 범위가 늘어난다
                // (관리자=엠바고·작업자, 개발자·작업자=작업자).
                <div className="scope-picker locked">
                  <div aria-disabled="true" className="scope-opt on" data-scope="public">
                    <Globe aria-hidden="true" className="scope-opt-ic" size={18} />
                    <span className="scope-opt-label">모두</span>
                    <span className="scope-opt-sub">누구나 봐요</span>
                  </div>
                  <p className="scope-locked-note">
                    <LockKeyhole aria-hidden="true" size={12} />{" "}
                    {isEffectivelyOwner
                      ? "비공개 레이어를 풀면 엠바고·작업자 선택"
                      : "비공개 레이어를 풀면 작업자도 선택 가능"}
                  </p>
                </div>
              )}
            </div>

            {/* 옵션 칩 순서(웹·모바일 통일): 미정 → 업도움 → 떡밥 */}
            {renderSupportEditor()}

            {/* 떡밥(가림) — 공개 일정에만. 켜고 공개 시각을 정하면 그 전까진 시청자에게 제목·태그가
                ??? 로 가려지고 카운트다운만 보인다. 실제 내용은 서버가 공개 시각 전엔 안 내보냄. */}
            {form.visibilityScope === "public" ? (
              <div className="teaser-field">
                <button
                  aria-pressed={form.teaser}
                  className={`opt-chip teaser${form.teaser ? " on" : ""}`}
                  disabled={!canEdit}
                  onClick={() => {
                    hapticTick();
                    setForm((c) => ({ ...c, teaser: !c.teaser }));
                  }}
                  type="button"
                >
                  <span className="opt-chip-ic" aria-hidden="true">🔮</span>
                  <span className="opt-chip-label">일정 최초공개</span>
                  <span className="opt-chip-mark" aria-hidden="true">✓</span>
                </button>
                {form.teaser ? (
                  <div className="teaser-when">
                    <span className="teaser-when-label">공개 시각 (KST)</span>
                    <DateTimePicker
                      disabled={!canEdit}
                      onChange={(v) => setForm((c) => ({ ...c, teaserRevealAt: v }))}
                      onOpenChange={setTeaserPickerOpen}
                      open={teaserPickerOpen}
                      value={form.teaserRevealAt}
                    />
                    <em className="teaser-when-hint">
                      이 시각 전엔 시청자에게 제목·태그가 ??? 로 가려지고 공개까지 카운트다운만 보여요.
                    </em>
                  </div>
                ) : null}
              </div>
            ) : null}
                </div>
              ) : null}
            </div>

            <section className="tag-picker" aria-label="태그 선택">
              <h3>
                태그 <span className="tag-picker-hint">최대 {maxEventTags}개</span>
              </h3>
              <TagPicker
                disabled={!canEdit}
                max={maxEventTags}
                onToggle={selectTag}
                palette={palette}
                selectedIds={form.tagIds}
                tags={viewTags}
              />
            </section>

            {selectedEventId &&
            canEdit &&
            events.find((e) => e.id === selectedEventId)?.isSupport ? (
              <button
                className="button danger"
                onClick={() => deleteEvent(selectedEventId)}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />이 업 도움 삭제
              </button>
            ) : null}

            {/* 진짜 개발자 화면(미리보기 아님)에선 공지(토리님 전용) 대신 그날 방문 그래프 버튼. */}
            {isDevInsights ? (
              <>
                {/* 개발자 화면에도 관리자처럼 공지 쓰기를 둔다(방문 그래프 위). NoticeModal은
                    공개 일정으로 공지 문구만 만드는 클라이언트 도구 — 비공개/owner 전용 쓰기 없음. */}
                <button
                  className="button notice-open"
                  onClick={() => setModal("notice")}
                  type="button"
                >
                  📢 {selectedDate} 공지 쓰기
                </button>
                <button
                  className="button notice-open"
                  onClick={() => setModal("dayVisit")}
                  type="button"
                >
                  📈 {selectedDate} 방문 그래프
                </button>
              </>
            ) : canEdit ? (
              <button
                className="button notice-open"
                onClick={() => setModal("notice")}
                type="button"
              >
                📢 {selectedDate} 공지 쓰기
              </button>
            ) : null}
          </form>
          )}
        </aside>
      </section>

      {/* 월 이동: 하단 좌·우 플로팅 < > (꾸미기·시청자 화면과 통일). 키보드 ←/→ 로도 이동. */}
      <nav className="studio-monthbar" aria-label="월 이동">
        <button
          aria-label="이전 달"
          onClick={() => moveMonth(-1)}
          title="이전 달 (←)"
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={22} />
        </button>
        <button
          aria-label="다음 달"
          onClick={() => moveMonth(1)}
          title="다음 달 (→)"
          type="button"
        >
          <ChevronRight aria-hidden="true" size={22} />
        </button>
      </nav>
        </>
      )}

      {supportSheetId !== null ? renderSupportSheet() : null}
      {/* 모바일 매니저 태그 수정 시트 — 매니저(태그 편집 가능 + 일정 미편집)일 때만. */}
      {tagSheetId !== null && canEditTagsThing && !canEdit ? renderMobileTagSheet() : null}
      {/* 빠른 휴방 미니 메뉴 — 날짜 우클릭/롱프레스로 뜸. 한 번 눌러 휴방 표시/해제. */}
      {restMenu ? (
        <div className="rest-menu" role="menu" style={{ left: restMenu.x, top: restMenu.y }}>
          <button
            className="rest-menu-item"
            onClick={() => quickToggleRest(restMenu.isoDate)}
            role="menuitem"
            type="button"
          >
            <span className="rest-menu-emoji" aria-hidden="true">
              🌙
            </span>
            {restMenu.hasRest ? "휴방 해제" : "휴방으로 표시"}
          </button>
        </div>
      ) : null}
      {modal ? (
        <div
          className="modal-backdrop"
          // 텍스트를 드래그 선택하다 배경에서 마우스를 떼도 닫히지 않도록,
          // 누름과 뗌이 모두 배경(자기 자신)에서 일어났을 때만 닫는다.
          onMouseDown={(e) => {
            backdropPressRef.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (backdropPressRef.current && e.target === e.currentTarget) {
              setModal(null);
            }
            backdropPressRef.current = false;
          }}
          role="presentation"
        >
          <div
            className={`modal-card ${modal === "tags" || modal === "notice" || modal === "developer" || modal === "dayVisit" ? "modal-card-wide" : ""}`}
            aria-modal="true"
            role="dialog"
          >
            <div className="modal-head">
              <h2>
                {modal === "tags"
                  ? "태그 이름 · 색상 편집"
                  : modal === "notice"
                    ? "숲 공지 쓰기"
                    : modal === "dayVisit"
                      ? `📈 ${selectedDate} 방문 상세`
                      : modal === "developer"
                        ? isDevInsights
                          ? "🛠 월별 인사이트"
                          : "📊 월별 인사이트"
                        : "매니저 · 작업자 관리"}
              </h2>
              <button
                aria-label="닫기"
                className="modal-close"
                onClick={() => setModal(null)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            {modal === "tags" && taxonomyV3 ? (
              <TagLegendEditor
                canEdit
                onTagAdded={applyTagAdd}
                onTagRemoved={applyTagRemove}
                onTagsUpdated={applyTagUpdates}
                palette={palette}
                removeTagAction={removeTagAction}
                saveTagsAction={saveTagsAction}
                tags={tags}
              />
            ) : null}
            {modal === "members" ? <TrustedMembersPanel /> : null}
            {modal === "dayVisit" ? <DayVisitModal dateKey={selectedDate} /> : null}
            {modal === "developer" ? (
              isDevInsights ? (
                <InsightsDashboard
                  month={view.month}
                  onChangePasscode={canEdit ? openChangePasscode : undefined}
                  year={view.year}
                />
              ) : (
                <MemberInsights
                  canSecurity={isEffectivelyOwner}
                  month={view.month}
                  onChangePasscode={canEdit ? openChangePasscode : undefined}
                  year={view.year}
                />
              )
            ) : null}
            {modal === "notice"
              ? (() => {
                  // 업 공지 자동 채움: 지금 편집 중인 폼이 업 도움이면 (저장 전이라도) 폼 값을, 아니면
                  // 그 날짜에 저장된 업 도움 일정의 값을 쓴다. 제목→대상, 업 도움 링크→링크.
                  const savedSupport = getEventsForDate(events, selectedDate).find(
                    (e) => e.isSupport
                  );
                  const upTarget = form.isSupport
                    ? form.publicTitle
                    : (savedSupport?.publicTitle ?? "");
                  const upLink = form.isSupport
                    ? form.supportUrl
                    : (savedSupport?.supportUrl ?? "");
                  return (
                    <NoticeModal
                      dateKey={selectedDate}
                      initialKind={form.isSupport ? "up" : "bangon"}
                      initialUpLink={upLink}
                      initialUpTarget={upTarget}
                      mobile={isNarrow}
                      onClose={() => setModal(null)}
                    />
                  );
                })()
              : null}
          </div>
        </div>
      ) : null}

      {/* 비밀번호 팝업 — 다른 모달(인사이트) 위에 따로 띄우는 독립 오버레이(z-index 더 높음).
          연 모달을 닫지 않으니 취소/X/배경 클릭 시 리로드 없이 그 화면(보안 패널)이 그대로 드러난다. */}
      {passcodeModal ? (
        <div
          className="modal-backdrop modal-backdrop-passcode"
          onMouseDown={(e) => {
            backdropPressRef.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (backdropPressRef.current && e.target === e.currentTarget) {
              setPasscodeModal(null);
            }
            backdropPressRef.current = false;
          }}
          role="presentation"
        >
          <div className="modal-card" aria-modal="true" role="dialog">
            <div className="modal-head">
              <h2>{passcodeModal === "change" ? "비밀번호 변경" : "비공개 일정"}</h2>
              <button
                aria-label="닫기"
                className="modal-close"
                onClick={() => setPasscodeModal(null)}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
            <PrivateLayerPanel
              canManage={canEdit}
              isDefaultPasscode={isDefaultPasscode}
              onDone={() => setPasscodeModal(null)}
              onUnlocked={() => {
                // 잠금 해제 성공: 팝업 닫고 비공개 일정을 다시 불러오는 동안 "불러오는 중" 표시.
                pendingUnlockReveal = true;
                setPasscodeModal(null);
                setShowPrivate(true);
                startLoadingPrivate(() => {
                  router.refresh();
                });
              }}
              setPasscodeAction={setPasscodeAction}
              startChanging={passcodeModal === "change"}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}

function createEmptyForm(): EventForm {
  return {
    publicTitle: "",
    endDateKey: "",
    isSupport: false,
    isTentative: false,
    supportUrl: "",
    category: "stream",
    status: "scheduled",
    visibilityScope: "public",
    tagIds: [],
    primaryTagIds: [],
    teaser: false,
    teaserRevealAt: ""
  };
}

// ── 편집 카드 임시 보관(드래프트) ──────────────────────────────────────────
// 저장 버튼을 안 누른 채 카드가 닫혀도(실수로 바깥 클릭·슬라이드 아웃·새로고침) 쓰던 내용을
// 잠깐 보관했다가, 같은 일정(또는 같은 날짜의 새 카드)을 다시 열면 되살린다. 공개 반영은
// 여전히 '저장'을 눌러야 일어난다 → 반쯤 쓴 일정이 시청자 포스터로 새어 나가지 않는다.
const DRAFT_TTL_MS = 10 * 60 * 1000; // 10분 — "잠시" 자리 비운 사이만 복원, 그 뒤엔 폐기
const DRAFT_LS_KEY = "vic-edit-draft-v1";
type EditDraft = { form: EventForm; ts: number };

// 폼의 '내용 지문' — id·날짜를 뺀 편집 가능한 필드만 모아 비교한다(원본 대비 변경 여부 판단).
function draftFingerprint(f: EventForm): string {
  return [
    f.publicTitle,
    f.endDateKey,
    f.isSupport,
    f.isTentative,
    f.supportUrl,
    f.category,
    f.status,
    f.visibilityScope,
    f.tagIds.join("|"),
    f.primaryTagIds.join("|"),
    f.teaser,
    f.teaserRevealAt
  ].join("");
}
function loadEditDrafts(): Map<string, EditDraft> {
  const map = new Map<string, EditDraft>();
  try {
    const raw = window.localStorage.getItem(DRAFT_LS_KEY);
    if (!raw) return map;
    const obj = JSON.parse(raw) as Record<string, EditDraft>;
    const cutoff = Date.now() - DRAFT_TTL_MS;
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v.ts === "number" && v.ts >= cutoff && v.form) map.set(k, v);
    }
  } catch {
    /* 깨진 값은 무시 — 보관은 부가기능이라 실패해도 편집엔 영향 없다 */
  }
  return map;
}
function persistEditDrafts(map: Map<string, EditDraft>) {
  try {
    const cutoff = Date.now() - DRAFT_TTL_MS;
    const obj: Record<string, EditDraft> = {};
    for (const [k, v] of map) if (v.ts >= cutoff) obj[k] = v;
    window.localStorage.setItem(DRAFT_LS_KEY, JSON.stringify(obj));
  } catch {
    /* 용량 초과 등은 무시 */
  }
}
// 기존 일정 → 폼 초깃값. selectEvent와 드래프트 폐기('새로 쓰기')가 공유한다.
function eventToForm(event: StudioScheduleEvent): EventForm {
  return {
    id: event.id,
    publicTitle: event.publicTitle,
    endDateKey: event.endDateKey ?? "",
    isSupport: event.isSupport ?? false,
    isTentative: event.isTentative ?? false,
    supportUrl: event.supportUrl ?? "",
    category: event.category,
    status: event.status,
    visibilityScope: event.visibilityScope,
    tagIds: event.tagIds,
    primaryTagIds: event.primaryTagIds,
    // 공개 시각이 지난 떡밥은 일반 일정 취급(토글 내림).
    teaser: teaserStillHidden(event),
    teaserRevealAt: teaserStillHidden(event) ? isoToKstLocalInput(event.teaserRevealAt) : ""
  };
}

// 떡밥 공개 시각 변환: DB(ISO UTC) ↔ datetime-local(KST 벽시계).
// datetime-local은 타임존이 없으니 입력값을 KST(+09:00)로 해석해 저장, 표시할 땐 +9h 한 벽시계로.
function isoToKstLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const k = new Date(t + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())}T${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}
function kstLocalInputToIso(local: string): string | null {
  if (!local) return null;
  const t = Date.parse(`${local}:00+09:00`);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}
// 아직 안 풀린(공개 시각이 미래인) 떡밥인가 — 지나면 일반 일정과 동일 취급.
function teaserStillHidden(e: { teaser?: boolean; teaserRevealAt?: string }): boolean {
  return Boolean(e.teaser && e.teaserRevealAt && Date.parse(e.teaserRevealAt) > Date.now());
}
// 편집실 떡밥 배지 호버 문구 — 공개 예정/완료를 KST로 알려준다.
function teaserBadgeTitle(iso: string | undefined): string {
  if (!iso) return "최초공개 일정 — 공개 시각 미설정";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "최초공개 일정";
  const k = new Date(t + 9 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const when = `${k.getUTCMonth() + 1}/${k.getUTCDate()} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
  return Date.now() >= t ? `🔮 최초공개 — 이미 공개됨 (${when})` : `🔮 최초공개 — ${when}에 공개 예정`;
}

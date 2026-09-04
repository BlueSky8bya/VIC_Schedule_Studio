"use client";

// 인사이트 차트·타일 스타일(편집실·시청자 공용) — studio-shell.css에서 분리된 파일.
import "@/components/studio/insights-charts.css";
// 2026-09-03 배치 대개편 레이어(서쪽 도구 카드 · 물결 배경 · 차분 상단바) — studio-shell.css에서 분리.
import "@/components/studio/studio-calm-layer.css";

import dynamic from "next/dynamic";
import {
  ArrowLeftToLine,
  ArrowRightToLine,
  CalendarCheck,
  ChartColumn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  Heart,
  Keyboard,
  LogOut,
  Pencil,
  Plus,
  Save,
  Settings,
  Tags,
  Trash2,
  X
} from "lucide-react";
import Link from "next/link";
import { AmbientLayer } from "@/components/shared/ambient/ambient-layer";
import { pickAmbient, type SeasonKey } from "@/components/shared/ambient/registry";
import { ShowcaseExit, ViewerAmbientControl } from "@/components/shared/ambient/showcase";
import { useAmbientPause } from "@/lib/ui/ambient-pause";
import { StudioSettingsList } from "@/components/studio/studio-settings";
import { gfxAutoMode, gfxPref, setGfxPref, type GfxMode, type GfxPref } from "@/lib/ui/gfx";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  Fragment,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
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
  EventVisibilityScope,
  MembershipRole,
  PosterThemeKey,
  PublicSchedule,
  StudioSchedule,
  StudioScheduleEvent,
  TagKind
} from "@/lib/domain/schedule-types";
import {
  FLING_SPEED,
  FOLLOW_DAMP,
  FOLLOW_STIFF,
  LAND_DAMP,
  LAND_MAX_MS,
  LAND_STIFF,
  LIFT_SCALE,
  springStep,
  swayOffset
} from "@/lib/studio/drag-physics";
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
import { markContentReady } from "@/lib/presence/content-ready";
import { getDayMark } from "@/lib/calendar/holidays";
import {
  canEditEventTags,
  canEditSchedule,
  canEditSupport,
  canReadOwnerPrivate,
  canReadPrivateLayer
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
import { ReadonlyEventDetail } from "@/components/studio/readonly-event-detail";
import { RoleBadge } from "@/components/studio/role-badge";
import { useStudioWriteQueue } from "@/lib/studio/use-write-queue";
import { setPasscodeAction } from "@/lib/private-layer/actions";
import { STUDIO_AGENDA_QUERY } from "@/lib/ui/breakpoints";
// P2-ARCH-1 1단계: 모듈 레벨 순수 코드(폼 모델·실행취소 타입·날짜/드래프트/떡밥 헬퍼·라벨·
// studio-write 클라이언트)는 lib/studio/editor-model.ts로 이동(동작 변화 0).
import {
  createEmptyForm,
  daysBetweenIso,
  addDaysIso,
  spanDays,
  formatSupportEnd,
  formatShortDate,
  formatEditorDate,
  draftFingerprint,
  eventToForm,
  kstLocalInputToIso,
  teaserStillHidden,
  teaserBadgeTitle,
  postStudioWrite,
  DRAFT_TTL_MS,
  DRAFT_LS_KEY,
  MAX_EVENT_TAGS,
  WEEKDAYS,
  SUPPORT_DURATIONS,
  ROLE_LABEL,
  ROLE_DESC,
  SCOPE_LABEL,
  PRIVATE_FILTER,
  type CopiedEvent,
  type EditDraft,
  type EventForm,
  type UndoAction
} from "@/lib/studio/editor-model";
import { useCellRangeSelect } from "@/lib/calendar/use-cell-range-select";
import { useFocusTrap } from "@/lib/ui/use-focus-trap";
import {
  type CalZoom,
  createWheelStepper,
  normalizeWheelDelta,
  stepCalZoom,
  studioShellZoom
} from "@/lib/ui/calendar-zoom";
import { toBroadcastPanelDays } from "@/lib/schedules/broadcast-dto";
import { detectDevice } from "@/lib/presence/presence-client";
import {
  hapticDelete,
  hapticError,
  hapticsEnabled,
  hapticSuccess,
  hapticTick,
  setHapticsEnabled
} from "@/lib/ui/haptics";
import { logActivity, logSettled } from "@/lib/activity/client";
import { setBandHover } from "@/lib/ui/band-hover";
import { useSectionActivity } from "@/lib/activity/use-section";
import {
  type AmbientMode,
  ambientMode,
  eyeComfortEnabled,
  reduceMotionEnabled,
  setAmbientMode,
  setEyeComfort,
  setReduceMotion
} from "@/lib/ui/motion";
import { hasInnerOverlay } from "@/lib/ui/overlay-pop";
import { useSheetDragClose } from "@/lib/ui/use-sheet-drag-close";
import { captureFlip, playFlip } from "@/lib/ui/list-flip";
import { getPublicPreviewAction } from "@/lib/schedules/preview-actions";
import { writeLoadingToneCookie, writeViewCookie } from "@/lib/ui/view-cookie";
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
// 방송 판서(B안) — owner/developer가 미리보기에서 여는 방송 설명 도구. 열 때만 로드.
const BroadcastPanel = dynamic(
  () => import("@/components/studio/broadcast-panel").then((m) => m.BroadcastPanel),
  { ssr: false }
);
const DayVisitModal = dynamic(
  () => import("@/components/developer/day-visit-modal").then((m) => m.DayVisitModal),
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
  // P2-ROUTE-1: /studio?panel= 딥링크로 열 관리 모달(권한 없으면 조용히 무시).
  initialPanel?: "tags";
  // 계절 배경 강제(fixture/검증 전용, ADR-0017) — 실제 /studio는 넘기지 않는다(오늘 KST 절기로 판정).
  ambientForce?: SeasonKey | null;
};




// 최초공개 게이트의 큰 카운트다운 — 설명문 대신 '얼마나 남았는지'를 주인공으로.
// 값이 바뀌는 숫자만 key 리마운트로 스프링 팝(초 단위 심장박동). reduce-motion은 CSS에서 끔.
function TeaserGateCountdown({ revealAt }: { revealAt: string }) {
  const target = new Date(revealAt).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const left = Math.max(0, target - now);
  const days = Math.floor(left / 86_400_000);
  const hours = Math.floor(left / 3_600_000) % 24;
  const mins = Math.floor(left / 60_000) % 60;
  const secs = Math.floor(left / 1_000) % 60;
  const seg = (value: number, unit: string, id: string, accent = false) => (
    <span className={`tg-seg${accent ? " tg-seg-accent" : ""}`} key={id}>
      {/* key에 값 포함 → 값이 바뀔 때만 리마운트돼 팝 애니메이션이 그 숫자에만 걸린다. */}
      <strong className="tg-num" key={`${id}-${value}`}>
        {String(value).padStart(2, "0")}
      </strong>
      <em className="tg-unit">{unit}</em>
    </span>
  );
  return (
    <div aria-label="공개까지 남은 시간" className="tg-countdown" role="timer">
      {days > 0 ? seg(days, "일", "d") : null}
      {seg(hours, "시간", "h")}
      {seg(mins, "분", "m")}
      {seg(secs, "초", "s", true)}
    </div>
  );
}

export function StudioShell({
  actor,
  schedule,
  hasUnlockSession,
  isDefaultPasscode,
  initialView,
  initialViewerMode = false,
  initialNarrow = false,
  initialPanel,
  ambientForce
}: StudioShellProps) {
  const today = getTodayKst();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // 낙관적 화면을 서버 prop이 덮어쓰지 않게 막는 가드. 저장·삭제·태그(pending)나 이동 저장
  // (pendingPersistRef)이 진행 중이면 prop 동기화를 건너뛴다 → '이전 위치로 순간이동' 방지.
  const pendingRef = useRef(false);
  const pendingPersistRef = useRef(0); // 진행 중인 '이동 저장' 수(F5 경고 + prop 동기화 가드)
  const movePersistChainRef = useRef<Promise<void>>(Promise.resolve()); // 이동 저장 직렬화
  // 쓰기 큐가 완전히 빌 때 부를 콜백(아래 requestServerResync — 실패한 이동의 서버 재동기화).
  const writeDrainRef = useRef<(() => void) | null>(null);
  // P2-ARCH-1 3단계: 전역 직렬 쓰기 큐(저장 칩·temp id 해석·flush 포함)는 훅으로 분리.
  const {
    saveState,
    lastSavedKst,
    editedSinceSyncRef,
    inflightWritesRef,
    pendingSavesRef,
    tempToRealRef,
    resolveEventId,
    enqueueWrite,
    studioWrite,
    flushPendingWrites,
    flashSavedChip
  } = useStudioWriteQueue(movePersistChainRef, writeDrainRef);
  // 첫 진입(스태거)와 달 이동(슬라이드)을 구분 — 실제로 달을 한 번 넘긴 뒤에만 슬라이드를 켠다.
  const didNavigateRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // 배포 버전 배지 클릭 → 버전 문자열 복사(잠깐 '복사됨'으로 확인).
  const [buildCopied, setBuildCopied] = useState(false);
  const buildCopiedTimer = useRef<number | null>(null);
  const buildSha = process.env.APP_COMMIT?.slice(0, 7) ?? "dev";
  function copyBuildSha() {
    hapticTick();
    const done = () => {
      setBuildCopied(true);
      if (buildCopiedTimer.current) window.clearTimeout(buildCopiedTimer.current);
      buildCopiedTimer.current = window.setTimeout(() => setBuildCopied(false), 1400);
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(buildSha).then(done, () => {});
      return;
    }
    // 클립보드 API가 없는 환경(http 등) 폴백.
    const ta = document.createElement("textarea");
    ta.value = buildSha;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done();
    } finally {
      document.body.removeChild(ta);
    }
  }
  // (P2-KST-1: nowKstHm은 lib/calendar/month.ts 단일 출처에서 import.)
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
  // ⚠ useTransition으로 감싸지 않는다 — startTransition(() => router.refresh())로 부르면
  // refresh의 RSC 응답이 클라 트리에 반영되지 않는 문제가 재현됐다(Playwright 실측:
  // 전환 밖의 router.refresh(잠그기 경로)는 정상, 전환 안(해제 경로)만 유실). 로딩 표시는
  // 수동 플래그로 유지하고, 반영 효과(아래 useEffect)가 끈다.
  const [loadingPrivate, setLoadingPrivate] = useState(false);
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
    // 잠금해제 직후의 문서 리로드를 건너온 '방금 풀었으니 보여줘' 의도(1회 소비).
    // 소비 후엔 플래그가 없으므로 이후 일반 F5는 '진입 시 공개 기본'(방송사고 방지) 그대로.
    let fromReload = false;
    try {
      fromReload = window.sessionStorage.getItem("vic:unlockReveal") === "1";
      if (fromReload) window.sessionStorage.removeItem("vic:unlockReveal");
    } catch {
      // 접근 불가 환경이면 무시.
    }
    if (fromReload && hasUnlockSession) {
      setShowPrivate(true);
    }
    if (hasUnlockSession) {
      setLoadingPrivate(false); // 세션 반영 확인 → "여는 중" 종료
    }
  }, [hasUnlockSession]);
  // (members 모달은 멤버 관리 철수(2026-09-04)로 제거, settings 모달은 같은 날 도구 카드 톱니에서 열린다.)
  const [modal, setModal] = useState<null | "tags" | "settings" | "developer" | "dayVisit">(
    null
  );
  // 빠른 휴방: 날짜 우클릭/롱프레스로 뜨는 미니 메뉴(화면 좌표 + 그 날 휴방 여부).
  const [restMenu, setRestMenu] = useState<
    { isoDate: string; x: number; y: number; hasRest: boolean } | null
  >(null);
  // 떡밥 공개시각 선택기(날짜·시간 팝업) 열림 — 모바일 뒤로가기 스택에 한 층으로 넣어, 뒤로가기 때
  // 이 팝업만 닫히고 새 일정 편집 카드로 돌아오게 한다(편집 카드까지 닫히지 않게).
  const [teaserPickerOpen, setTeaserPickerOpen] = useState(false);
  // 최초공개(떡밥) 편집 게이트 — 아직 안 풀린 떡밥 일정은 편집실에서도 제목이 ???로 가려지고,
  // 클릭하면 비공개 레이어 비밀번호 확인을 먼저 거친다(방송 화면 공유 중 오클릭 유출 방지).
  // ⚠ 통과는 '지금 연 이 카드 한 번'만 유효 — 카드를 다시 누르거나 닫으면 무조건 재입력
  // (사용자 결정: 세션 기억 금지. 방송 중 1분 뒤 오클릭에도 바로 열리면 안 된다).
  const [teaserUnlockedId, setTeaserUnlockedId] = useState<string | null>(null);
  const [teaserGatePass, setTeaserGatePass] = useState("");
  const [teaserGateError, setTeaserGateError] = useState<string | null>(null);
  const [teaserGateBusy, setTeaserGateBusy] = useState(false);
  const [teaserGateShake, setTeaserGateShake] = useState(false);
  // 업도움 띠 그룹 호버 — 띠는 칸마다 별도 조각이라 :hover만으론 한 조각만 밝아진다.
  // 같은 일정의 모든 조각이 한 블록처럼 함께 반응하게 호버 중인 띠 id를 들고 있는다.
  // (띠 그룹 호버 상태 hoverSupportId는 2026-09-03 DOM 토글로 대체 — lib/ui/band-hover.)
  // 공개 범위 + 옵션(미정·업도움·떡밥) 묶음은 기본으로 접혀 있다 — 대부분의 일정이 '모두 공개 +
  // 옵션 없음'이라 매번 펼칠 이유가 없다. 접힌 상태에서도 헤더 요약으로 현재 값이 보인다.
  const [scopeFoldOpen, setScopeFoldOpen] = useState(false);
  // 단축키 안내바는 기본으로 접어 달력을 더 넓게 본다 — '단축키 설명' 탭을 누르면 펼쳐진다.
  const [kbdHintsOpen, setKbdHintsOpen] = useState(false);
  const backdropPressRef = useRef(false); // 모달 배경 클릭 판정(텍스트 드래그 보호)
  // 통합 실행취소 스택(삭제·생성·붙여넣기 등 '되돌릴 수 있는 액션'을 LIFO로 보관).
  const deletedStackRef = useRef<UndoAction[]>([]);
  // 다시 실행 스택(P1-HIST-1) — 실행취소가 만든 역연산을 보관. 새 작업이 생기면 비운다
  // (외부/후속 변경과 충돌하는 '다시 실행' 방지 — 갈라진 미래의 redo는 무효).
  const redoStackRef = useRef<UndoAction[]>([]);
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
    // 눌러두기는 **누른 즉시** 시작한다 — flush가 끝난 뒤에 켜면 그 사이(가장 오래 stale인 구간)를
    // 또렷하게 그려버려 결국 같은 깜빡임이 남는다.
    if (needsRefresh) setPreviewWarming(true);
    void (async () => {
      await flushPendingWrites();
      if (needsRefresh) {
        router.refresh();
        editedSinceSyncRef.current = false;
      }
      // 스냅샷은 **쓰기가 끝난 뒤에** 받는다. 예전엔 viewerMode 변화만 보고 곧바로 받아서,
      // 방금 누른 저장이 아직 날아가는 중인 스냅샷(= 저장 전 상태)이 잡혔다. 그 stale 값이
      // previewSnapshot에 눌러앉아 router.refresh()가 가져온 새 데이터까지 가려, 몇 초 기다리거나
      // 편집실을 나갔다 다시 들어와야 반영됐다(2026-08-04 실측).
      void refreshPreviewSnapshot(needsRefresh);
    })();
  }
  // 시청자 공개 화면 전체보기 (팝업이 아니라 화면 전체를 교체)
  const [viewerMode, setViewerMode] = useState(initialViewerMode);
  // 좁은 화면(<1000px, P1-IPAD-1): 편집실을 아젠다(목록) + 인라인 편집 형태로 전환한다.
  // 아이패드 세로(768)·스플릿뷰도 압축 데스크톱 대신 터치 네이티브 아젠다를 받는다(L4).
  const [isNarrow, setIsNarrow] = useState(initialNarrow);
  useEffect(() => {
    const mq = window.matchMedia(STUDIO_AGENDA_QUERY);
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
  // (매니저 전용 '업 도움 수정'·'태그 수정' 시트는 역할 철수(2026-09-04, ADR-0018)로 제거.)
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
  const [mobileMgmt, setMobileMgmt] = useState<null | "tags">(null);
  // 일정은 로컬 상태로 들고 낙관적으로 갱신한다 — 잇기·복붙·저장·삭제가 서버 왕복/새로고침을
  // 기다리지 않고 화면에 즉시 반영되게 해서 "하는 맛"을 살린다. 서버 데이터가 바뀌면 다시 맞춘다.
  const [events, setEvents] = useState(schedule.events);
  // 항상 '지금' 배열 — pointerdown 때 등록한 드롭 핸들러처럼 옛 렌더 클로저에서 불리는 코드가
  // 그 사이 바뀐 상태(예: 저장 완료로 temp id → 실제 id 교체)를 놓치지 않게 한다.
  const eventsRef = useRef(events);
  eventsRef.current = events;
  // temp id와 실제 id를 같은 카드로 본다 — 저장 직후 id가 바뀌는 찰나에 잡힌 드래그가 실패하지 않게.
  // ref만 읽으므로 안정 참조(useCallback []) — effect deps에 넣어도 매 렌더 재실행되지 않는다.
  const canonId = useCallback(
    (eid: string) => tempToRealRef.current.get(eid) ?? eid,
    [tempToRealRef]
  );
  // DOM에서 카드 요소 찾기 — data-eventid가 temp든 실제든(교체 렌더 전후) 같은 카드로 찾는다.
  function findPillEl(eid: string): HTMLElement | null {
    const direct = document.querySelector<HTMLElement>(
      `.studio-event-pill[data-eventid="${CSS.escape(eid)}"]`
    );
    if (direct) return direct;
    const want = canonId(eid);
    for (const el of document.querySelectorAll<HTMLElement>(".studio-event-pill[data-eventid]")) {
      if (canonId(el.getAttribute("data-eventid") ?? "") === want) return el;
    }
    return null;
  }
  const resyncNeededRef = useRef(false); // 서버 진실 재동기화가 필요한데 아직 반영 안 됨(아래 참조)
  useEffect(() => {
    // 저장·삭제·이동이 진행 중이면 서버 prop이 낙관적 화면을 덮어써 카드가 '이전 위치로
    // 순간이동'하던 문제를 막는다. 작업이 끝난 뒤(idle)의 prop 변화에서만 서버 데이터로 맞춘다.
    if (pendingRef.current || pendingPersistRef.current > 0 || inflightWritesRef.current.size > 0)
      return;
    setEvents(schedule.events);
    resyncNeededRef.current = false; // 서버 진실이 실제로 화면에 반영됐다
  }, [schedule.events, inflightWritesRef]);
  // 이동 저장이 실패/누락됐을 때 '서버 진실로 되돌리기'는 큐가 빈 뒤에만 가능하다 — 진행 중에
  // router.refresh()를 불러도 위 가드가 그 prop을 버려서, 화면은 낙관적 순서인 채 서버는 옛
  // 순서로 영영 갈라졌다(2026-08-16 실측: 편집자 화면 [미정, FC, 20시] vs 새로고침 [FC, 미정, 20시]).
  // 플래그로 남겨 두고 idle이 될 때 refresh, 반영이 확인될 때(위 effect) 지운다.
  function requestServerResync() {
    resyncNeededRef.current = true;
    if (pendingRef.current || pendingPersistRef.current > 0 || inflightWritesRef.current.size > 0)
      return; // 큐가 비면 enqueueMovePersist의 finally가 다시 부른다
    flashToast("순서 저장이 안 돼 서버 순서로 되돌렸어요 — 다시 옮겨 주세요");
    router.refresh();
  }
  // 이동 큐뿐 아니라 일반 쓰기(저장·삭제·태그)가 마지막으로 끝나는 순간에도 미룬 재동기화를 실행 —
  // 이동 실패 시점에 다른 저장이 아직 날아가는 중이면 위 가드에 걸려 finally에서 못 했기 때문.
  writeDrainRef.current = () => {
    if (resyncNeededRef.current) requestServerResync();
  };
  // pending(저장/삭제/태그 진행)을 ref로 미러링 — 위 prop 동기화 가드가 deps 없이 읽게.
  useEffect(() => {
    pendingRef.current = pending;
    // 트랜지션(저장/삭제/태그)이 끝나는 순간에도 미룬 재동기화를 실행 — 이동 실패 시점에 이게
    // 아직 true라 requestServerResync가 물러났다면, 여기 말고는 다시 부를 곳이 없다.
    if (!pending && resyncNeededRef.current) requestServerResync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  }, [inflightWritesRef]);
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
  }, [schedule.tags, inflightWritesRef]);
  useEffect(() => {
    if (pendingRef.current || pendingPersistRef.current > 0 || inflightWritesRef.current.size > 0)
      return;
    setPalette(schedule.palette);
  }, [schedule.palette, inflightWritesRef]);
  // 색상 안내 필터 — 편집실에서도 특정 태그 색만 골라볼 수 있게(시청자 화면과 동일 동작).
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  function toggleTagFilter(id: string) {
    hapticTick(); // 셀렉터 손맛(Android만; iOS·미지원은 조용히 무시)
    // B4 FLIP: 모바일 아젠다에서 필터로 날이 사라지고/나타날 때 남은 날이 활주한다.
    const flipContainer = document.querySelector<HTMLElement>(".agenda-flow");
    const flipPrev = captureFlip(flipContainer);
    setTagFilters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
    if (flipPrev) requestAnimationFrame(() => playFlip(flipContainer, flipPrev));
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
    const target = eventsRef.current.find((e) => canonId(e.id) === canonId(eventId));
    if (!target) return;
    selectEvent(target);
  }

  // 이음새 '칼로 긋기': 손잡이를 눌러 threshold 이상 그으면 그 연결(earlier.linkNext)만 끊는다.
  // 단순 클릭(움직임 없음)은 아무 일도 안 한다 → 제목 편집 중 실수 끊김 방지.
  function performSeamCut(rawEarlierId: string) {
    if (!canEdit) return;
    // 제스처 핸들러(옛 렌더 클로저)에서 불린다 — 배열은 ref, id는 canonId(temp↔실제 동일시).
    const earlierId = canonId(rawEarlierId);
    const earlier = eventsRef.current.find((e) => canonId(e.id) === earlierId);
    if (!earlier || !earlier.linkNext) return;
    // target rollback(P0-DATA-2): 실패 시 이 이음새의 linkNext만 복원(다른 편집 보존).
    const prevNext = earlier.linkNext;
    const restoreSeam = () =>
      setEvents((prev) =>
        prev.map((e) => (canonId(e.id) === earlierId ? { ...e, linkNext: prevNext } : e))
      );
    setEvents((prev) =>
      prev.map((e) => (canonId(e.id) === earlierId ? { ...e, linkNext: undefined } : e))
    );
    setActionError(null);
    hapticTick();
    flashToast("싹둑 — 연결을 끊었어요");
    setCutFlashId(earlierId);
    setCutFlashNextId(prevNext);
    if (cutFlashTimer.current) window.clearTimeout(cutFlashTimer.current);
    cutFlashTimer.current = window.setTimeout(() => {
      setCutFlashId(null);
      setCutFlashNextId(null);
    }, 520);
    void (async () => {
      const result = await enqueueWrite(async () => {
        const realId = await resolveEventId(earlierId);
        if (!realId) {
          restoreSeam();
          return null;
        }
        return postStudioWrite("unlinkPair", { earlierId: realId });
      });
      if (!result.ok) {
        setActionError(result.error);
        restoreSeam();
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
    // 다음 콜드 엔트리의 로딩 스켈레톤 톤 힌트 — 편집실을 쓰는 사람은 "편집실" 톤으로.
    writeLoadingToneCookie("s");
  }, [view, viewerMode]);

  // 새 일정/일정 수정 카드는 달력에서 날짜(또는 일정)를 "선택했을 때"만 보여준다.
  // 편집실 진입 시엔 카드를 띄우지 않고, 칸을 클릭하면 그제서야 나온다.
  const [editorVisible, setEditorVisible] = useState(false);
  // 편집 카드 여닫기 계측(2026-09-03, docs/ux/saju-redesign-direction.md F-3) — 30일 로그에서
  // 칸·카드 열기 606회 대 저장 176회. 둘러보기인지 포기인지 가르려면 체류·입력·닫은 방법이 필요.
  // section.enter/leave(target "editor") + leave의 dur_ms·meta{typed, saved, how}. 개인정보 없음.
  const editorOpenedAtRef = useRef(0);
  const editorTypedRef = useRef(false);
  const editorSavedRef = useRef(false);
  const editorCloseHowRef = useRef<"esc" | "outside" | "cell" | "collapse" | "other">("other");
  useEffect(() => {
    if (editorVisible) {
      editorOpenedAtRef.current = Date.now();
      editorTypedRef.current = false;
      editorSavedRef.current = false;
      editorCloseHowRef.current = "other";
      logActivity("section.enter", { target: "editor" });
      return;
    }
    if (!editorOpenedAtRef.current) return;
    logActivity("section.leave", {
      target: "editor",
      durMs: Date.now() - editorOpenedAtRef.current,
      meta: { typed: editorTypedRef.current, saved: editorSavedRef.current, how: editorCloseHowRef.current }
    });
    editorOpenedAtRef.current = 0;
  }, [editorVisible]);
  // 편집 카드/시트가 닫히면 떡밥 게이트 통과도 즉시 소멸 — 다음에 누르면 무조건 비번 재입력
  // (사용자 결정: 방송 중 오클릭 방지가 목적이라 '기억'이 있으면 안 된다).
  useEffect(() => {
    if (!editorVisible && mobileEditId === null) setTeaserUnlockedId(null);
  }, [editorVisible, mobileEditId]);
  // 편집 폼의 remount 키 — '사용자가 명시적으로 다른 날짜/일정을 고를 때'만 올린다(selectDate·
  // selectEvent·moveMonth). 저장·삭제 같은 내부 상태 변화로는 안 올려서 폼이 다시 마운트되지(깜빡이지)
  // 않게 한다. (이전엔 key가 selectedEventId라 저장 시 null로 바뀌며 폼이 깜빡였다.)
  const [editorKey, setEditorKey] = useState(0);
  const bumpEditor = () => setEditorKey((k) => k + 1);

  // 개발자 전용 "역할 미리보기"(보기 전용). 클라이언트 한정 — 쿠키/라우트는 절대 안 건드린다.
  // previewRole이 있으면 UI를 그 역할처럼 그린다(데이터·서버 권한은 그대로, 변경은 차단).
  // 새로고침하면 자동 해제(SSR은 항상 실제 역할로 렌더)되어 라우팅/쿠키 엉킴이 없다.
  // 선택한 일정의 관심(하트) 수. 공개 스냅샷에만 있으므로 비공개 일정은 null(줄을 안 띄운다).
  const heartCountOfSelected = selectedEventId
    ? (schedule.viewerModePreview.events.find((e) => e.id === selectedEventId)?.heartCount ?? null)
    : null;
  const isDeveloper = actor.role === "developer";
  const [previewRole, setPreviewRole] = useState<MembershipRole | null>(null);
  const [previewMenuOpen, setPreviewMenuOpen] = useState(false);
  // 태그 편집기의 저장 전 변경 여부(에디터가 알려줌) — 닫기 경고 게이트.
  const tagsDirtyRef = useRef(false);
  const [tagsDiscardAsk, setTagsDiscardAsk] = useState(false);
  // 태그 모달 닫기 요청 — dirty면 바로 닫지 않고 버리기 확인을 띄운다(드래그 직후엔 이미
  // 화면 순서가 바뀌어 '적용된 것처럼' 보이므로, 조용한 유실이 특히 배신감이 크다).
  const requestCloseModal = useCallback(() => {
    setModal((cur) => {
      if (cur === "tags" && tagsDirtyRef.current) {
        setTagsDiscardAsk(true);
        return cur;
      }
      return null;
    });
  }, []);
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
  // 편집실 아바타 자리는 항상 켜짐(끄기 없음 — 사용자 결정 2026-07-31). 좌/우 위치만 고른다.
  // (시청자 포스터의 켜기/끄기 토글은 그대로 — vic_avatar_on 키는 포스터 전용으로 남는다.)
  // 최초(메모리 없음) 디폴트는 '왼쪽', 이후엔 마지막 값(편집실·미리보기 공유) 복원.
  const [avatarSide, setAvatarSide] = useState<"left" | "right">("left");
  // localStorage(좌/우)를 읽기 전엔 scene을 렌더하지 않는다 — 기본값(왼쪽)으로 한 번 그렸다가
  // 저장값(오른쪽)으로 점프하는 깜빡임 방지. useLayoutEffect라 '페인트 전'에 확정돼(SSR HTML은
  // scene OFF 기준 → 하이드레이션 일치) 어느 쪽도 한 프레임도 안 깜빡인다.
  const [avatarStorageRead, setAvatarStorageRead] = useState(false);
  useLayoutEffect(() => {
    if (!avatarEditor || typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem("vic_avatar_side") === "right") setAvatarSide("right");
    } catch {
      /* 저장소 불가 무시 */
    }
    setAvatarStorageRead(true);
  }, [avatarEditor]);
  function pickAvatarSide(side: "left" | "right") {
    hapticTick();
    setAvatarSide(side);
    try {
      window.localStorage.setItem("vic_avatar_side", side);
    } catch {
      /* 무시 */
    }
  }
  const avatarSceneOn = avatarEditor && avatarStorageRead;
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
  const canMemberInsights = !isDevInsights && effectiveRole === "owner";

  const canEdit = canEditSchedule(effectiveRole);
  // (canEditSupport·canEditEventTags는 매니저 철수 뒤 canEdit과 같다 — 호출부 분기 유지용.)
  const canEditSupportThing = canEditSupport(effectiveRole);
  const canEditTagsThing = canEditEventTags(effectiveRole);
  void canEditSupportThing;
  void canEditTagsThing;

  // 단계 배포: v3 역할(현재 개발자만)은 분류 v3(세부·modifier·신설 그룹)를 그대로 본다. 그 외(관리자·
  // 매니저·작업자·시청자, 또는 개발자가 그 역할로 미리보기)는 레거시 뷰(세부 나누기 이전)로 본다.
  // 렌더·피커·레전드·필터에는 viewTags를, 태그 '정의 편집'(TagLegendEditor)에는 원본 tags를 쓴다.
  const taxonomyV3 = isTaxonomyV3(effectiveRole);
  // P2-ROUTE-1: /studio?panel=tags|members 딥링크 — 옛 /studio/tags·trusted-members 북마크가
  // 여기로 리다이렉트된다. 버튼과 같은 권한 게이트(tags=canEdit+v3, members=canEdit) 미달이면
  // 조용히 무시(권한 오류 모달로 시청자를 놀래지 않는다). 첫 마운트 1회만.
  useEffect(() => {
    if (initialPanel === "tags" && canEdit && taxonomyV3) setModal("tags");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const roleDisplay = {
    label: ROLE_LABEL[effectiveRole],
    badgeLabel: ROLE_LABEL[effectiveRole],
    summary: ROLE_DESC[effectiveRole].summary,
    can: ROLE_DESC[effectiveRole].can
  };
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
  // (차분한 편집실 스위치는 2026-09-04 제거 — 항상 ON, html[data-studio-calm]은 페인트-전 스크립트가 늘 붙인다.)
  // 계절 배경(2026-09-04, ADR-0017) — 기본 ON. 서버 렌더 true = 페인트-전 스크립트(속성 없음)와 일치.
  // 배경 효과 품질(2026-09-04, lib/ui/gfx.ts v3) — 자동/항상 최대/가볍게 + 자동 판정 결과. 판정이 스스로 내려가면
  // (vic:gfx-auto) 토스트로 알려 설정에서 되돌릴 수 있게 한다(토리님 PC: 물결이 몇 초 뒤 사라졌는데 이유를 몰랐다).
  const [gfxPrefState, setGfxPrefState] = useState<GfxPref>("auto");
  const [gfxAuto, setGfxAuto] = useState<GfxMode>("full");
  useEffect(() => {
    setGfxPrefState(gfxPref());
    setGfxAuto(gfxAutoMode());
    const onAuto = (e: Event) => {
      const mode = (e as CustomEvent<{ mode?: GfxMode }>).detail?.mode;
      if (!mode) return;
      setGfxAuto(mode);
      flashToast(
        mode === "soft"
          ? "이 기기는 그래픽 가속이 없어 배경 효과를 껐어요 · 설정 › 배경 효과에서 바꿀 수 있어요"
          : "화면이 버벅여 배경 효과를 가볍게 했어요 · 설정 › 배경 효과에서 바꿀 수 있어요"
      );
    };
    window.addEventListener("vic:gfx-auto", onAuto);
    return () => window.removeEventListener("vic:gfx-auto", onAuto);
  }, []);
  // 계절 배경 세 상태(켜짐·흐리게·끔, 2026-09-04). 상태의 진실은 <html data-ambient>(lib/ui/motion.ts) — 설정 셀렉트, 아바타
  // 자리·시청자 미리보기 레일의 순환 버튼, 페인트-전 스크립트가 전부 그 속성을 쓰므로 여기선 속성 변화를 지켜보며 따라간다.
  const [ambientModeState, setAmbientModeState] = useState<AmbientMode>("on");
  useEffect(() => {
    const read = () => setAmbientModeState(ambientMode());
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ambient"] });
    return () => mo.disconnect();
  }, []);
  // 잠금(2026-09-04 사용자): 계절 배경 끔 ⇔ 배경 효과 '끄기'. 끄면 셀렉트는 '끄기'로 잠기고, 켜짐/흐리게로 돌아오면 '끄기'였던
  // 우선순위는 '자동'으로 풀린다. 셀렉트에서 '끄기'를 고르면 배경도 함께 꺼진다 — 두 컨트롤이 한 상태.
  const changeAmbientMode = (mode: AmbientMode) => {
    if (ambientMode() !== mode) setAmbientMode(mode);
    setAmbientModeState(mode);
    if (mode !== "off" && gfxPrefState === "off") {
      setGfxPref("auto");
      setGfxPrefState("auto");
    }
    hapticTick();
  };
  const changeGfxPref = (pref: GfxPref) => {
    setGfxPref(pref); // localStorage + <html data-gfx> 즉시(배경 레이어는 속성을 지켜본다)
    setGfxPrefState(pref);
    if (pref === "off" && ambientModeState !== "off") {
      setAmbientMode("off");
      setAmbientModeState("off");
    }
    hapticTick();
  };
  // 배경 감상 모드는 공용(components/shared/ambient/showcase.tsx: enterShowcase/<ShowcaseExit/>/<ShowcaseButton/>) —
  // 진입은 아바타 자리의 큰 버튼 + 설정 줄, 나가기는 Esc/상단 알약(body 포털). 무거운 모달(태그·인사이트·이용 기록)이
  // 떠 있는 동안은 배경을 일시정지한다(blur 백드롭이 매 프레임 다시 흐려지는 비용 — lib/ui/ambient-pause.ts).
  useAmbientPause(modal !== null && modal !== "settings", "studio-modal");
  const ambientSeason = pickAmbient(view.month, ambientForce ?? null).season;
  // 포스터 테마(2026-09-03, 물빛 테마와 함께 입구 복원) — 소유자만, 서버(updatePosterThemeAction)도
  // owner 검사. 낙관적으로 먼저 바꿔 보이고(미리보기 즉시), 실패면 되돌린다. 성공 후 router.refresh로
  // 서버 스냅샷(시청자 미리보기)까지 동기화.
  const [posterThemeLocal, setPosterThemeLocal] = useState<PosterThemeKey>(schedule.calendar.posterTheme);
  useEffect(() => {
    setPosterThemeLocal(schedule.calendar.posterTheme);
  }, [schedule.calendar.posterTheme]);
  const [posterThemeSaving, setPosterThemeSaving] = useState(false);
  const changePosterTheme = async (theme: PosterThemeKey) => {
    if (actor.role !== "owner" || posterThemeSaving) return;
    const prev = posterThemeLocal;
    setPosterThemeLocal(theme);
    setPosterThemeSaving(true);
    hapticTick();
    const result = await studioWrite("posterTheme", { theme });
    setPosterThemeSaving(false);
    if (!result.ok) {
      setPosterThemeLocal(prev);
      setActionError(result.error ?? "포스터 테마를 저장하지 못했어요.");
      return;
    }
    hapticTick();
    router.refresh();
  };
  // (휴식 넛지 — 2026-09-03 도입, 2026-09-04 철수: 관리자가 안 쓸 기능이라 사용자 결정. 코드는 git 이력,
  //  옛 행동 기록의 라벨(rest-nudge*)만 사전에 남긴다.)
  const canReadPrivate =
    canReadPrivateLayer(effectiveRole, hasUnlockSession) && showPrivate;


  // 미리보기 중 변경 차단(보기 전용). 막았으면 true. (문구는 짧게 — 모바일 컴팩트.)
  function blockedByPreview(): boolean {
    if (previewRole) {
      flashToast("미리보기 중엔 변경 불가");
      return true;
    }
    return false;
  }
  // 역할 미리보기 적용/해제. 시청자는 기존 viewerMode 경로 재사용, 나머지는 previewRole.
  function applyPreview(role: MembershipRole | "") {
    setRoleHelpOpen(false);
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
    const options: { value: MembershipRole | ""; label: string }[] = [
      { value: "", label: "개발자 화면" },
      { value: "owner", label: "관리자 화면" },
      { value: "viewer", label: "시청자 화면" }
    ];
    // 미리보기 중엔 트리거를 "그 역할 화면에 실제로 있는 버튼"(= 비개발자의 시청자 화면 버튼)으로
    // 위장한다 — 역할별 디자인·너비를 그대로 확인하려고. 모바일 "시청자 화면" / 웹 "시청자 화면 미리보기",
    // 세모(▾)도 숨긴다. 단 개발자가 다시 열 수 있게 특정 색 강조 + 흐릿한 텍스트(=원래 세계로 돌아가는
    // '비밀 차원문'). 클릭하면 드롭다운이 다시 열린다. 미리보기 아닐 땐 평소대로 "미리보기 ▾".
    const previewing = previewRole !== null;
    // '보여주기'는 관리자(owner) 미리보기일 때만 — 그 외 역할(매니저·작업자·시청자) 미리보기는 '미리보기'.
    const triggerText = previewing
      ? isNarrow
        ? "시청자 화면"
        : previewRole === "owner"
          ? "시청자 화면 보여주기"
          : "시청자 화면 미리보기"
      : "미리보기";
    // 압축 1단계(studio-calm-layer.css ⑤)에선 짧은 라벨, 2단계부턴 눈 아이콘만 — 관리자의 보여주기 버튼과 같은 문법.
    const triggerShort = previewing ? (previewRole === "owner" ? "시청자 화면" : "미리보기") : "미리보기";
    return (
      <div className="preview-dd">
        <button
          aria-expanded={previewMenuOpen}
          aria-haspopup="menu"
          aria-label={triggerText}
          className={`button preview-dd-trigger${previewing ? " previewing" : ""}`}
          onClick={() => setPreviewMenuOpen((value) => !value)}
          title={triggerText}
          type="button"
         data-act="preview-dd-trigger">
          <Eye aria-hidden="true" size={16} />
          {/* 모바일은 짧은 라벨 하나만("시청자 화면"/"미리보기") — 웹의 긴/짧은 쌍을 그대로 두면 숨기는 CSS가
              .studio-role-tools 안에만 있어 "미리보기 미리보기"로 겹쳐 보였다(2026-09-04 사용자). */}
          {isNarrow ? (
            <span className="lbl">{triggerText}</span>
          ) : (
            <>
              <span className="lbl-long">{triggerText}</span>
              <span className="lbl-short">{triggerShort}</span>
            </>
          )}
          {previewing ? null : (
            <span aria-hidden="true" className="preview-dd-caret">
              ▾
            </span>
          )}
        </button>
        {previewMenuOpen ? (
          <div className="preview-dd-menu" role="menu">
            {options.map((opt) => {
              const active = (previewRole ?? "") === opt.value;
              return (
              <button
                className={`preview-dd-item${active ? " active" : ""}`}
                data-act={`role-preview-${opt.value || "dev"}`}
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

  // (비공개 일정 보기 토글·지금 잠그기는 2026-08-27 철수 — 관리자가 안 쓰는 기능(ADR-0014). 서버의
  //  비공개 모델·권한 검사는 그대로고 편집실 UI만 없앴다. 비밀번호는 최초공개 게이트·변경에만 쓴다.)
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

  // 설정 목록(2026-09-04) — 스위치 4종 + 포스터 테마 + 멤버 관리 입구. 웹은 도구 카드의 설정(톱니) 팝오버,
  // 모바일은 역할 배지 팝오버 아래에 같은 목록(도구 카드가 없어서). 한 컴포넌트, 두 자리.
  function renderSettingsList() {
    return (
      <StudioSettingsList
        eyeComfort={eyeComfort}
        hapticsOn={hapticsOn}
        hapticsSupported={hapticsSupported}
        onChangePosterTheme={(theme) => void changePosterTheme(theme)}
        onToggleEyeComfort={toggleEyeComfort}
        onToggleHaptics={toggleHaptics}
        onToggleReduceMotion={toggleReduceMotion}
        ambientMode={ambientModeState}
        onChangeAmbientMode={changeAmbientMode}
        gfxPref={gfxPrefState}
        gfxAuto={gfxAuto}
        onChangeGfxPref={changeGfxPref}
        posterTheme={actor.role === "owner" ? posterThemeLocal : null}
        posterThemeSaving={posterThemeSaving}
        reduceMotion={reduceMotion}
      />
    );
  }

  // A3: 역할 배지 + "?" 도움말 팝오버. 이메일은 배지에 인라인으로 두지 않고(폭 절약·깔끔)
  // 팝오버 안 역할 라벨 아래에 보여준다.
  // P2-ARCH-1 2단계: 역할 배지+권한 팝오버는 RoleBadge 컴포넌트로 분리(동작 0 변화).
  // withSettings: 모바일(도구 카드 없음)만 true — 웹의 설정은 서쪽 도구 카드 톱니(2026-09-04).
  function renderRoleBadge(withSettings: boolean) {
    return (
      <RoleBadge
        email={actor.email}
        onToggleOpen={() => setRoleHelpOpen((value) => !value)}
        open={roleHelpOpen}
        previewing={previewRole !== null}
        // 웹(설정 슬롯 없음)은 "?"·팝오버 없이 라벨만(2026-09-04 사용자) — 모바일은 설정 목록이 여기 살아 그대로.
        quiet={!withSettings}
        role={actor.role}
        roleDisplay={roleDisplay}
        settings={withSettings ? renderSettingsList() : undefined}
      />
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
  // 단순 기간 안내(supportKind 'period')는 예외 — 정보성 기록이라 지나도 남긴다(2026-09-01).
  const liveEvents = useMemo(
    () =>
      visibleEvents.filter(
        (e) =>
          !e.isSupport ||
          e.supportKind === "period" ||
          (e.endDateKey ?? getEventDateKey(e)) >= today
      ),
    [visibleEvents, today]
  );
  // 최초공개 게이트 판정 — 편집 패널이 가리키는 일정이 '아직 안 풀린 떡밥'이고 이 세션에서
  // 비번 확인을 안 했으면 폼 대신 게이트를 띄운다. 이동/복사/드래그는 게이트와 무관하게 그대로.
  const selectedLiveEvent = selectedEventId
    ? (liveEvents.find((e) => e.id === selectedEventId) ?? null)
    : null;
  const teaserGateActive = Boolean(
    selectedLiveEvent &&
      teaserStillHidden(selectedLiveEvent) &&
      (teaserUnlockedId === null || canonId(teaserUnlockedId) !== canonId(selectedLiveEvent.id))
  );
  // 업 도움을 편집 중이면 팝오버의 점선·리더 라인을 띠와 같은 장미색으로(보라=일반 일정).
  // (기간 안내=하늘색은 form 선언 뒤의 selectedIsPeriod.)
  const selectedIsSupport = Boolean(selectedLiveEvent?.isSupport);
  const supportLanes = useMemo(() => assignSupportLanes(liveEvents), [liveEvents]);
  // (띠 줄 수 "주별" 계산은 칸별 계산으로 대체 — 2026-09-02, 시청자 포스터와 동일 규칙.
  //  띠가 안 지나가는 칸까지 주 최대값만큼 내려앉아 빈 줄이 생겼다.)
  // 이어진 일정 묶음 키 + 묶음 칸 높이 맞추기(글자 수 달라도 이음새 안 어긋나게).
  const chainKeys = useMemo(() => buildChainKeys(visibleEvents), [visibleEvents]);
  const paintGroups = useMemo(() => buildPaintGroups(visibleEvents), [visibleEvents]);
  // 이어진 칸 높이 맞추기 — callback ref라 그리드가 어떤 경로로 (재)마운트되든(미리보기 복귀·
  // 잠금 로딩·월 변경 등) 항상 새 요소에 자동 재설정된다. deps는 데이터 변화 시 보강용.
  const monthGridRef = useEqualChainHeights<HTMLDivElement>([visibleEvents, view]);
  // 구글 시트식 날짜 칸 범위 선택(마우스 전용, 시각 강조) + 텍스트 긁힘 방지.
  // (P1-MULTI-0로 제거했다가 사용자 요청으로 복원 — 방송 중 기간을 보라 하이라이트로 짚어주는
  //  실사용 용도가 있었다. '액션 없는 상태'가 아니라 그 자체가 판서/설명 도구다.)
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
        el?.closest(".studio-month-label") ||
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
      editorCloseHowRef.current = "outside";
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
  // 기간 안내를 편집 중이면 팝오버 점선·리더 라인·그립을 하늘색으로 — 폼의 **현재** 종류를
  // 따른다(종류 칩을 바꾸면 폼 테마(.support-fields[data-kind])와 함께 즉시 갈아입어야 색이
  // 한 몸으로 읽힌다). 달력 위 띠 자체(.sb-period.is-editing)는 저장값 기준.
  const selectedIsPeriod = selectedIsSupport && form.supportKind === "period";
  // 데스크톱 제목칸을 내용량에 맞춰 자동으로 키운다 — 긴 제목의 일정을 열면 두 줄 남짓 높이에
  // 갇혀 스크롤로만 보이던 문제 제거. 값이 바뀔 때마다(타이핑·다른 일정 선택 모두) 맞춘다.
  useLayoutEffect(() => {
    const el = editorTitleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight + 2, 480)}px`;
  }, [form.publicTitle]);
  // 키보드 달력에서 화살표로 달 경계를 넘을 때, 달 전환 후 이어서 포커스할 날짜(P0-A11Y-1).
  const pendingFocusDateRef = useRef<string | null>(null);
  useEffect(() => {
    const target = pendingFocusDateRef.current;
    if (!target) return;
    pendingFocusDateRef.current = null;
    // 새 달 그리드가 마운트된 다음 프레임에 포커스(슬라이드 애니메이션과 무관하게 DOM은 즉시 있음).
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(`.studio-month-grid [data-isodate="${target}"]`)
          ?.focus();
      })
    );
  }, [view]);

  // P1-TITLE-1(L2 줄바꿈 계약 명시): 첫 줄=제목, 둘째 줄부터=세부 내용 규칙을 입력칸 아래
  // 상시 helper로 보여준다(placeholder는 글자를 치는 순간 사라져 규칙을 잊는다). 첫 줄이
  // 길어지면 소프트 카운터 — 포스터 카드에서 줄바꿈/축소되는 걸 저장 전에 예감하게 한다.
  const titleFirstLineLen = form.publicTitle.split("\n")[0]?.length ?? 0;
  // (제목칸 '카드처럼 렌더' 시도는 사용자 결정으로 철회 — textarea는 줄별 들여쓰기/크기가
  //  불가능해 카드와 정확히 같아질 수 없다(근사가 오히려 더 어색). 규칙 안내는 아래 helper가 담당.)
  // 규칙 문구("첫 줄 = 제목…")는 제거(사용자 결정 — placeholder가 이미 안내). 소프트 카운터만:
  // 첫 줄이 길어질 때만 나타나 포스터 카드에서의 줄바꿈/축소를 저장 전에 예감하게 한다.
  // 업 도움은 카드가 아니라 '띠'로 그려진다 — 포스터 카드의 줄바꿈/축소를 예감시키는 이 카운터가
  // 거기선 아무 의미가 없다(높이만 먹는 소음). 그래서 업 도움 편집에선 아예 띄우지 않는다.
  const renderTitleHelper = () =>
    !form.isSupport && titleFirstLineLen >= 14 ? (
      <div className="title-helper">
        <em className={titleFirstLineLen >= 20 ? "warn" : ""}>
          제목 {titleFirstLineLen}자{titleFirstLineLen >= 20 ? " — 포스터에서 길어요" : ""}
        </em>
      </div>
    ) : null;

  // 접힌 '옵션' 헤더에 현재 값을 한 줄로 요약한다 — 접혀 있어도 이 일정이 미정인지, 떡밥인지
  // 펼치지 않고 바로 보이게(접기가 정보를 숨기면 안 된다). 아무 옵션도 없으면 '없음'.
  // (공개 범위 항목은 2026-08-27 철수 — 모든 일정이 '모두'.)
  const scopeFoldSummary =
    [
      form.isTentative ? "미정" : null,
      form.isSupport ? (form.supportKind === "period" ? "📌 기간 안내" : "🌱 업 도움") : null,
      form.teaser ? "🔮 최초공개" : null
    ]
      .filter(Boolean)
      .join(" · ") || "없음";
  // 편집 카드 임시 보관(드래프트) — **메모리 전용**(P0-PRIV-1, ADR-0011 L3). 같은 세션 안에서
  // 카드를 오갈 때만 복원되고, 새로고침하면 사라진다(localStorage 영속 금지 — 게시 전 내용 잔존 방지).
  // baseline = '깨끗한' 기준 지문(원본 일정 또는 빈 새 카드). form이 이와 다르면 미저장 변경 → 보관.
  const editDraftsRef = useRef<Map<string, EditDraft>>(new Map());
  const editBaselineRef = useRef<string>(draftFingerprint(createEmptyForm()));
  const draftHydratedRef = useRef(false);
  const [draftRestored, setDraftRestored] = useState(false);
  useEffect(() => {
    // P0-PRIV-1: 드래프트는 **메모리 전용** — 게시 전 제목·URL은 scope가 public이어도 민감할
    // 수 있는데, 예전엔 평문 localStorage에 남아 공용 기기/XSS 이후에도 잔존했다. 이제 세션
    // 안에서만 유지(카드 전환 시 복원)하고 새로고침이면 사라진다. 과거 버전이 남긴 키는 물리 삭제.
    try {
      window.localStorage.removeItem(DRAFT_LS_KEY);
    } catch {
      /* 삭제 실패는 무시 — 다음 방문에서 재시도 */
    }
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

  // ── B안(방송 판서, M4a): 미리보기 관리자 오버레이에서 여는 전체화면 판서 모달 ──
  // 데이터는 서버 공개 스냅샷(viewerModePreview)만 — 낙관적 events 재가공 금지(G2 계약,
  // tests/unit/broadcast-callsite.test.ts가 이 호출 인자를 정적으로 고정한다).
  // 히스토리 스택(아래)에 한 칸 쌓여 뒤로가기가 '판서만' 닫는다 — 미리보기는 유지(G3a).
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const broadcastOpenRef = useRef(false);
  broadcastOpenRef.current = broadcastOpen;
  // 라우트가 아닌 화면(모달·전체화면 판서)의 진입/이탈(0062). URL이 안 바뀌므로 route.enter로는
  // 절대 안 잡힌다 — "어떤 도구를 얼마나 쓰나"는 여기서만 나온다. 판서가 열려 있으면 그게 우선.
  useSectionActivity(broadcastOpen ? "broadcast-panel" : modal ? `modal:${modal}` : null);
  const [broadcastSent, setBroadcastSent] = useState<string[]>([]);
  // 판서 날짜 고르기 달력의 월 — 편집실 view와 독립(다른 달 일정도 뽑아온다).
  // 공개 스냅샷(viewerModePreview)은 월 필터 없이 전체 공개 일정을 담고 있어 클라 이동만으로 충분.
  const [broadcastMonth, setBroadcastMonth] = useState<{ year: number; month: number } | null>(null);
  const bcYear = broadcastMonth?.year ?? view.year;
  const bcMonth = broadcastMonth?.month ?? view.month;
  const broadcastCells = useMemo(() => buildCalendarMonth(bcYear, bcMonth), [bcYear, bcMonth]);
  const broadcastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const broadcastDays = useMemo(() => {
    if (!broadcastOpen) return [];
    // 보고 있는 달 42칸 전체(전월/익월 회색 날짜도 선택 가능) + 이미 보낸 날짜(다른 달일 수
    // 있음) 합집합 — 월을 넘나들어도 보낸 카드 데이터가 사라지지 않는다.
    const monthKeys = broadcastCells.map((c) => c.isoDate);
    return toBroadcastPanelDays(schedule.viewerModePreview, [...monthKeys, ...broadcastSent]);
  }, [broadcastOpen, broadcastCells, broadcastSent, schedule.viewerModePreview]);
  function navBroadcastMonth(delta: number) {
    const total = bcYear * 12 + (bcMonth - 1) + delta;
    setBroadcastMonth({ year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 });
  }
  function openBroadcastPanel(trigger: HTMLButtonElement | null) {
    hapticTick();
    broadcastTriggerRef.current = trigger;
    setBroadcastSent([]); // 새로 열면 항상 빈 판 — 이전 기록 복구 없음(계약 3)
    setBroadcastMonth(null); // 날짜 고르기 달력은 항상 지금 보는 달부터
    setBroadcastOpen(true);
  }
  function closeBroadcastPanel() {
    setBroadcastOpen(false);
    setBroadcastSent([]);
    // 닫힌 뒤 포커스는 진입 버튼으로(a11y — 모달 관례).
    broadcastTriggerRef.current?.focus();
  }
  function handleBroadcastSend(dateKeys: string[]) {
    // 보내기 = 추가(dedup) — 그림판에서 컬럼별 ✕로 뺄 수 있으니 누적이 자연스럽다.
    setBroadcastSent((prev) => [...new Set([...prev, ...dateKeys])].sort());
  }
  function removeBroadcastDay(dateKey: string) {
    setBroadcastSent((prev) => prev.filter((k) => k !== dateKey));
  }

  // 모바일 오버레이 스택: 편집 시트 → (그 위에) 모달(인사이트·이용 기록 등). 레이어마다 히스토리
  // 항목을 하나씩 쌓아, 휴대폰 뒤로가기를 누르면 맨 위 레이어만 닫힌다(모달 → 편집 시트 → 스튜디오). 비번 팝업은
  // 별도 오버레이(passcodeModal)라 스택엔 안 넣되, 스크롤 잠금엔 포함한다.
  const modalIsStackable = modal !== null;
  const overlayDepth = (mobileEditId !== null ? 1 : 0) + (modalIsStackable ? 1 : 0);
  // 스크롤 잠금엔 태그 수정·업 도움 시트·비번 팝업도 포함 — 시트를 잡고 끌면 뒤 배경이 스크롤돼
  // 아래가 뚫리던 문제를 막는다. (히스토리 스택(overlayDepth)은 기존대로.)
  const overlayLocked = overlayDepth > 0 || passcodeModal !== null;
  // (매니저 전용 시트(태그 수정·업 도움)의 히스토리 칸은 역할 철수로 제거 — 2026-09-04.)
  // 비밀번호 팝업(passcodeModal)도 한 칸 쌓는다 — 안 쌓으면 모바일 뒤로가기가 팝업을 닫는 대신
  // 사이트를 종료해 버린다(비공개 일정 잠금해제 입력창에서 발생). 다른 모달 위에도 뜰 수 있어
  // 스택 '맨 위'로 친다.
  const passcodeDepth = passcodeModal !== null ? 1 : 0;
  // 히스토리 스택 깊이 = 오버레이(편집 시트·모달) + 매니저/작업자 시트 + 비번 팝업 + 미리보기.
  // viewerMode도 한 칸 쌓아야, 휴대폰 뒤로가기를 누를 때 로그인 흐름으로 빠지지 않고
  // 편집실로 돌아온다. (스크롤 잠금은 overlayLocked만 사용 — 미리보기 자체 스크롤은 살린다.)
  // 방송 판서도 한 칸 — 미리보기(viewerMode) '위'에 뜨므로, 뒤로가기는 판서만 닫고 미리보기는
  // 유지한다. 안 쌓으면 뒤로가기가 미리보기를 닫는데 판서 상태(sent·단축키 가드)가 남는 버그.
  const stackDepth =
    overlayDepth +
    passcodeDepth +
    (viewerMode ? 1 : 0) +
    (teaserPickerOpen ? 1 : 0) +
    (broadcastOpen ? 1 : 0);
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
      else if (tagsDiscardAsk) setTagsDiscardAsk(false); // 확인창에서 Esc = 계속 편집
      else requestCloseModal();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modal, passcodeModal, tagsDiscardAsk, requestCloseModal]);
  // 모달이 바뀌거나 닫히면 확인창·dirty 흔적을 정리.
  useEffect(() => {
    setTagsDiscardAsk(false);
    if (modal !== "tags") tagsDirtyRef.current = false;
  }, [modal]);
  // P1-DIALOG-1: 각 모달 카드에 Tab 포커스 가두기(순환)+초기 포커스. Esc·복원은 위 B2 효과.
  const mainModalTrapRef = useFocusTrap<HTMLDivElement>(modal !== null);
  const passcodeTrapRef = useFocusTrap<HTMLDivElement>(passcodeModal !== null);
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
      // 방송 판서가 맨 위(미리보기 위에 뜸) — 뒤로가기는 판서만 닫고 상태도 소멸(G3a).
      if (broadcastOpen) {
        closeBroadcastPanel();
      } else if (teaserPickerOpen) {
        setTeaserPickerOpen(false);
      } else if (passcodeModal !== null) {
        setPasscodeModal(null);
      } else if (modalIsStackable) {
        setModal(null);
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
    broadcastOpen,
    teaserPickerOpen,
    passcodeModal,
    modalIsStackable,
    mobileEditId,
    viewerMode
  ]);

  // 안전망: 어떤 경로로든 미리보기가 닫히면 판서도 반드시 소멸(단축키 가드 잔류 방지).
  useEffect(() => {
    if (!viewerMode && broadcastOpenRef.current) closeBroadcastPanel();
  }, [viewerMode]);

  // P0-SEC-2: 미리보기를 열 때마다 신선한 서버 공개 스냅샷을 받아온다(떡밥 가림 포함,
  // 낙관적 재가공 금지). 실패하면 페이지 로드 시점 스냅샷(viewerModePreview)으로 동작.
  const [previewSnapshot, setPreviewSnapshot] = useState<PublicSchedule | null>(null);
  // 늦게 도착한 옛 응답이 새 응답을 덮지 않게 하는 순번(요청이 겹칠 수 있다: 진입 + 저장 후 재요청).
  const previewSeqRef = useRef(0);
  // 방금 저장한 내용이 아직 안 실린 스냅샷을 보고 있는 동안 참을 유지한다(살짝 눌러 그린다).
  const [previewWarming, setPreviewWarming] = useState(false);
  const refreshPreviewSnapshot = useCallback(async (warm = false) => {
    const seq = (previewSeqRef.current += 1);
    if (warm) setPreviewWarming(true);
    try {
      const snap = await getPublicPreviewAction();
      // 최신 요청이 아니면 버린다. 받아둔 값을 지우지도 않는다 — 화면을 비우면 깜빡인다.
      if (snap && seq === previewSeqRef.current) setPreviewSnapshot(snap);
    } catch {
      /* 실패 시 기존 스냅샷 유지 */
    } finally {
      if (seq === previewSeqRef.current) setPreviewWarming(false);
    }
  }, []);
  // 차가운 진입(북마크·쿠키 복원 등 enterViewerMode를 안 거친 경로)만 여기서 받는다.
  // 편집실에서 넘어오는 경로는 enterViewerMode가 **쓰기 flush 뒤에** 직접 부른다.
  const coldPreviewFetchedRef = useRef(false);
  useEffect(() => {
    if (!viewerMode || coldPreviewFetchedRef.current) return;
    coldPreviewFetchedRef.current = true;
    void refreshPreviewSnapshot();
  }, [viewerMode, refreshPreviewSnapshot]);

  // D: 이 일정의 대표 태그(최대 2개) 색. 2개면 그 일정 안에서 그라데이션(경계는 일정 가운데).
  // 아직 안 풀린 최초공개(떡밥)는 태그 색도 힌트가 된다 — 공개 화면과 똑같이 무색(흰 카드)으로.
  function eventColors(event: StudioScheduleEvent) {
    if (teaserStillHidden(event)) return [];
    return tagVisual.eventFills(event);
  }
  // 위와 같은 이유 — 추가 대분류 점 줄도 떡밥은 숨긴다.
  function eventExtraColors(event: StudioScheduleEvent) {
    if (teaserStillHidden(event)) return [];
    return tagVisual.eventExtras(event);
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
    // 월 이동 기록은 여기서 하지 않는다 — 아래 useEffect가 '실제로 착지한 view'를 보고 남긴다.
    // (여기서 getAdjacentMonth(view…)를 쓰면 렌더 시점 클로저라, 연타가 리렌더 전에 몰릴 때
    //  16번 다 같은 값이 찍혔다. 실측: ×16을 눌러 2025-04에 갔는데 로그는 2026-07이었다.)
    bumpEditor(); // 달이 바뀌어 새 날짜로 → 폼 새로 마운트
  }

  // 어느 달을 보러 왔는지(0062). **실제로 바뀐 view**를 보고 남긴다 — 클릭 핸들러에서
  // 계산하면 렌더 전 클로저라 도착지가 틀린다(위 moveMonth 주석의 실측 사례).
  // 연타는 정착(700ms) 후 마지막 달 1건으로 압축되고, 누른 횟수는 meta.hops로 남는다.
  const monthLoggedOnce = useRef(false);
  useEffect(() => {
    if (!monthLoggedOnce.current) {
      monthLoggedOnce.current = true; // 최초 마운트는 진입이지 '이동'이 아니다
      return;
    }
    logSettled(
      "month.change",
      "studio-month",
      `${view.year}-${String(view.month).padStart(2, "0")}`
    );
  }, [view]);

  // 모바일 편집실 '오늘' — 시청자 화면과 같은 동작(사용자 요청): 오늘이 속한 달로 복귀한 뒤
  // 오늘 카드로 스크롤(가운데). 이미 그 달이면 스크롤만. 슬라이드가 끝난 뒤 스크롤(360ms).
  const todayYM = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  const onTodayMonth = view.year === todayYM.year && view.month === todayYM.month;
  function jumpTodayMobile() {
    hapticTick();
    const reduceMotion = reduceMotionEnabled();
    if (!onTodayMonth) {
      moveMonth((todayYM.year - view.year) * 12 + (todayYM.month - view.month));
    }
    window.setTimeout(
      () => {
        document
          .querySelector(".studio-mobile .agenda-day.today")
          ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      },
      onTodayMonth || reduceMotion ? 0 : 360
    );
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
        // ←/→ = 항상 월 이동. (예전 '이어진 일정 선택 중엔 체인 안 이전/다음 선택' 기능은
        // 달이 안 넘어가는 것처럼 보여 사용자 결정으로 제거 — 2026-07-31. 재도입 금지.)
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
      editorCloseHowRef.current = "cell";
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
  // 집중 모드(2026-09-04 사용자): 일정을 만지는 동안(편집 카드 열림·끌기) 계절 배경만 옅어진다 — 글자·달력은 그대로, 배경 레이어
  // opacity만(app/ambient.css `html[data-ambient-dim]`). 끝나면 다시 살아난다.
  useEffect(() => {
    const root = document.documentElement;
    if (editorVisible || dragEventId !== null) root.setAttribute("data-ambient-dim", "1");
    else root.removeAttribute("data-ambient-dim");
    return () => root.removeAttribute("data-ambient-dim");
  }, [editorVisible, dragEventId]);
  // 드래그 중 형제 카드 슬라이드 프리뷰(그림판 레이어 문법) 한 칸 크기 — 카드 높이+간격.
  const [dragChipH, setDragChipH] = useState(0);
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
  // 끊긴 이음새의 '다음' 카드 — 앞 카드와 반대 방향으로 반동(스프링 분리 연출).
  const [cutFlashNextId, setCutFlashNextId] = useState<string | null>(null);
  // 방금 이어진 체인 — 딸깍 맞물림 + 보라 글로우 1회.
  const [linkFlashIds, setLinkFlashIds] = useState<Set<string>>(() => new Set());
  const linkFlashTimer = useRef<number | null>(null);
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

  // ── A안(방송 가독성): 달력 위 Ctrl+휠 단계 확대(100/125/150%) — PLAN-20260725-001 M1 ──
  // 브라우저 전체 줌은 CSS viewport 폭을 줄여 640px 경계 아래로 떨어지면 PC에서도 모바일
  // 레이아웃으로 바뀐다. 대신 달력 패널 위에서만 Ctrl+휠을 가로채 CSS 변수(--cal-zoom)로
  // 글자·밀도만 키운다. transform: scale 금지 — 드래그 삽입선·FLIP이 좌표 기반이라 어긋난다.
  const [calZoom, setCalZoom] = useState<CalZoom>(1);
  const calZoomRef = useRef<CalZoom>(1);
  const calPanelRef = useRef<HTMLElement | null>(null);
  // 드래그 중 배율 변경 금지(레이아웃 재배치가 드롭 좌표 판정을 순간적으로 흔든다).
  const dragActiveRef = useRef(false);
  dragActiveRef.current = dragEventId !== null;
  const applyCalZoom = useCallback((next: CalZoom) => {
    if (dragActiveRef.current) return;
    if (calZoomRef.current === next) return;
    calZoomRef.current = next;
    // 배율이 바뀌면 저장해 둔 카드 rect가 전부 무효 — FLIP이 옛 rect로 활주하면 카드가 튄다.
    flipRects.current.clear();
    hapticTick();
    setCalZoom(next);
  }, []);
  useEffect(() => {
    // isNarrow 판정은 STUDIO_AGENDA_QUERY '전체'(폭 999 + 저높이·coarse pointer 포함) — 아젠다
    // 레이아웃으로 넘어가면 배율을 초기화한다(아젠다 뷰엔 확대 개념이 없다).
    if (isNarrow && calZoomRef.current !== 1) {
      calZoomRef.current = 1;
      flipRects.current.clear();
      setCalZoom(1);
    }
  }, [isNarrow]);
  useEffect(() => {
    if (isNarrow || viewerMode) return;
    const el = calPanelRef.current;
    if (!el) return;
    const stepper = createWheelStepper();
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || e.shiftKey || e.altKey) return;
      // 달력 위 Ctrl+휠은 배율 변경 가능 여부와 무관하게 항상 브라우저 줌을 막는다 —
      // 일부 이벤트만 새면 달력·페이지가 따로 확대돼 화면이 뒤죽박죽 된다. 달력 밖은 기본 동작.
      e.preventDefault();
      // 이동 드래그(왼쪽)뿐 아니라 우클릭 잇기·끊기 제스처 중에도 배율 변경 금지 —
      // 진행 중 레이아웃 재배치는 선긋기 좌표·대상 판정을 흔든다.
      if (dragActiveRef.current || rightGestureRef.current?.moved) return;
      const dir = stepper.feed(normalizeWheelDelta(e.deltaY, e.deltaMode), e.timeStamp);
      if (dir === 0) return;
      applyCalZoom(stepCalZoom(calZoomRef.current, dir));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [isNarrow, viewerMode, applyCalZoom]);
  // 아바타 모드 고정 도크(태그필터 rail·편집창)의 top을 실측으로(--dock-top).
  // 하드코딩 148px는 브라우저 확대(헤더·액션바가 더 두꺼워짐)에선 액션바를 침범했고,
  // 스크롤로 막대가 화면 밖으로 나가면 위 공간이 비었다 → 액션바 하단을 따라가고,
  // 지나가면 8px까지 올라붙는다. shell의 zoom(0.9/0.8) 좌표계 보정 포함.
  useEffect(() => {
    if (isNarrow) return;
    const update = () => {
      // 하한 = sticky 상단바 하단(스크롤해도 화면 위에 남는다) — 8px 고정 하한이면 도크가
      // 상단바 '밑으로' 파고들어 편집창 머리가 잘렸다. 액션바가 보이면 그 아래가 우선.
      const bar = document.querySelector(".studio-actionbar");
      const topbar = document.querySelector(".studio-topbar");
      const bottomVisual = Math.max(
        bar?.getBoundingClientRect().bottom ?? 0,
        topbar?.getBoundingClientRect().bottom ?? 0
      );
      const zoomF = studioShellZoom();
      const top = Math.max(8, Math.round(bottomVisual / zoomF) + 8);
      document.documentElement.style.setProperty("--dock-top", `${top}px`);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.documentElement.style.removeProperty("--dock-top");
    };
  }, [isNarrow, viewerMode]);
  // 달력 패널 '실측 폭'이 좁으면(브라우저 확대·편집창+아바타 동시 열림·태블릿) 제목 1줄
  // ellipsis 모드 — viewport가 아니라 패널 폭 기준(G0-r: 실사용 폭은 패널 상태에 좌우된다).
  const [calCompact, setCalCompact] = useState(false);
  useEffect(() => {
    if (isNarrow || viewerMode) return;
    const el = calPanelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setCalCompact(el.clientWidth < 1080);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isNarrow, viewerMode]);
  // 확대 컨트롤 — buildbox(액션바)와, 확대 중 스크롤해도 보이는 하단 플로팅 두 곳에서 재사용.
  function renderCalZoomCtl() {
    return (
      <div className="cal-zoom-ctl" role="group" aria-label="달력 확대(방송용)">
        <button
          type="button"
          className="cal-zoom-btn"
          aria-label="달력 축소"
          disabled={calZoom === 1}
          onClick={() => applyCalZoom(stepCalZoom(calZoomRef.current, -1))}
         data-act="달력 축소">
          −
        </button>
        <button
          type="button"
          className="cal-zoom-pct"
          aria-label="달력 확대 초기화(100%)"
          title="100%로 초기화"
          onClick={() => applyCalZoom(1)}
         data-act="달력 확대 초기화">
          {Math.round(calZoom * 100)}%
        </button>
        <button
          type="button"
          className="cal-zoom-btn"
          aria-label="달력 확대"
          disabled={calZoom === 1.5}
          onClick={() => applyCalZoom(stepCalZoom(calZoomRef.current, 1))}
         data-act="달력 확대">
          ＋
        </button>
      </div>
    );
  }

  // ── A안 M2: 확대(125%+) 시 부제목은 +N로 접고, 상세는 팝오버로 ──
  // hover/focus로 열리고, +N·📌으로 고정(핀)하면 포인터가 떠나도 유지된다. ✕·Esc로 닫으며
  // 닫을 때 포커스는 카드로 복귀. 100%에선 지금과 완전히 동일(접기·팝오버 없음).
  const zoomCollapse = calZoom > 1;
  // 제목 1줄 모드 = 인앱 확대 중이거나 패널이 실측으로 좁을 때. 팝오버도 이 조건에서 동작.
  const titleCompact = zoomCollapse || calCompact;
  // 카드 안에서 ellipsis로 실제 잘린 텍스트(제목·부제목)가 있는지 실측 — 팝오버 열림 판정.
  function hasClippedText(card: HTMLElement): boolean {
    const els = card.querySelectorAll<HTMLElement>(
      ".pill-main strong, .pill-subs li, .pill-sub-last .pill-sub-text"
    );
    for (const el of els) {
      if (el.scrollWidth > el.clientWidth + 1) return true;
    }
    return false;
  }
  const [zoomPeek, setZoomPeek] = useState<{ id: string; pinned: boolean } | null>(null);
  const zoomPeekRef = useRef(zoomPeek);
  zoomPeekRef.current = zoomPeek;
  // 앵커는 '실제 요소'를 기억한다 — 멀티데이는 같은 data-eventid 카드가 여러 개라 셀렉터로
  // 찾으면 첫 칸으로 잘못 복귀한다. 위치 측정도 이 요소 기준(rect 스냅샷보다 정확).
  const peekAnchorRef = useRef<HTMLElement | null>(null);
  const peekElRef = useRef<HTMLDivElement | null>(null);
  // 카드→팝오버로 포인터가 건너가는 짧은 틈(8px)에 닫히지 않게 close는 잠깐 지연한다.
  const peekCloseTimer = useRef<number | null>(null);
  const cancelPeekClose = useCallback(() => {
    if (peekCloseTimer.current !== null) {
      window.clearTimeout(peekCloseTimer.current);
      peekCloseTimer.current = null;
    }
  }, []);
  const openZoomPeek = useCallback(
    (id: string, el: HTMLElement, pinned: boolean) => {
      // 드래그(이동·우클릭 잇기 모두) 중엔 팝오버 금지(좌표 소음·대상 판정 방해)
      if (dragActiveRef.current || rightGestureRef.current?.moved) return;
      const prev = zoomPeekRef.current;
      if (!pinned && prev?.pinned) return; // 핀 고정 중엔 hover가 덮어쓰지 못함
      cancelPeekClose();
      peekAnchorRef.current = el;
      setZoomPeek({ id, pinned });
    },
    [cancelPeekClose]
  );
  const closeZoomPeek = useCallback((opts?: { returnFocus?: boolean }) => {
    const prev = zoomPeekRef.current;
    if (!prev) return;
    cancelPeekClose();
    setZoomPeek(null);
    if (opts?.returnFocus) {
      const anchor = peekAnchorRef.current;
      if (anchor?.isConnected) anchor.focus();
      else
        document
          .querySelector<HTMLElement>(`.studio-event-pill[data-eventid="${prev.id}"]`)
          ?.focus();
    }
  }, [cancelPeekClose]);
  const leaveZoomPeek = useCallback((id: string) => {
    const prev = zoomPeekRef.current;
    if (!prev || prev.pinned || prev.id !== id) return;
    // blur·mouseleave가 연속으로 와도 타이머는 항상 하나만(이전 것 먼저 취소).
    cancelPeekClose();
    peekCloseTimer.current = window.setTimeout(() => {
      // 실행 시점에 상태 재확인 — 유예 중에 핀을 눌렀거나 다른 카드로 옮겨갔으면 건드리지 않는다.
      const cur = zoomPeekRef.current;
      if (cur && !cur.pinned && cur.id === id) setZoomPeek(null);
      peekCloseTimer.current = null;
    }, 140);
  }, [cancelPeekClose]);
  // 위치는 렌더 후 실측으로 잡는다(추정 높이 300px 가정은 420px+padding까지 크는 실제 팝오버에서
  // 화면 아래를 뚫었다). 앵커 아래 우선, 안 들어가면 위, 그래도 넘치면 화면 안으로 클램프.
  useLayoutEffect(() => {
    if (!zoomPeek) return;
    const el = peekElRef.current;
    const anchor = peekAnchorRef.current;
    if (!el || !anchor?.isConnected) return;
    const a = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(a.left, window.innerWidth - w - 8));
    let top = a.bottom + 8;
    if (top + h > window.innerHeight - 8) top = a.top - h - 8;
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = "visible";
  }, [zoomPeek]);
  useEffect(() => {
    if (!zoomPeek) return;
    // Esc는 캡처 단계에서 팝오버'만' 닫고 전파를 끊는다 — 편집 패널 닫힘·선택 해제와 겹치지 않게
    // (한 번에 하나: 첫 Esc = 팝오버, 다음 Esc = 원래 동작). 달력 스크롤·창 크기 변경 시엔 앵커가
    // 어긋나므로 닫는다 — 단, 팝오버 '내부' 스크롤(긴 세부 읽기)은 닫힘 사유가 아니다.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeZoomPeek({ returnFocus: zoomPeekRef.current?.pinned ?? false });
      }
    };
    // 자동 종료(스크롤·resize)여도 포커스가 팝오버 '안'에 있었다면 앵커로 돌려준다 —
    // 핀 dialog의 버튼에 포커스 둔 채 닫히면 포커스가 body로 떨어져 키보드 흐름이 끊긴다.
    const autoClose = () =>
      closeZoomPeek({
        returnFocus:
          (zoomPeekRef.current?.pinned ?? false) &&
          peekElRef.current?.contains(document.activeElement) === true
      });
    const onScroll = (e: Event) => {
      if (e.target instanceof Node && peekElRef.current?.contains(e.target)) return;
      autoClose();
    };
    const onResize = () => autoClose();
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [zoomPeek, closeZoomPeek]);
  // 배율 변경(125↔150 포함)·달 이동·편집창 상태 변화·미리보기 진입 시 팝오버 정리 —
  // 전부 앵커 위치가 무효해지거나 화면 목적이 바뀌는 순간이라 stale overlay를 남기지 않는다.
  useEffect(() => {
    cancelPeekClose(); // 이전 팝오버의 지연 close 타이머가 새 팝오버를 닫는 것 방지
    setZoomPeek(null);
  }, [calZoom, view.year, view.month, editorVisible, selectedEventId, viewerMode, cancelPeekClose]);

  // ── 편집 카드 = 앵커 팝오버(데스크탑) — 오른쪽 고정 패널 대신 '선택한 날짜 칸 옆'에 뜬다.
  // 좌표는 .studio-workspace(position:relative) 기준 absolute. 칸 **왼쪽**이 기본(다음 날 칸을 안 가리게),
  // 자리가 없으면 오른쪽으로 뒤집고(flip), 뷰포트 아래로 넘치면 위로 당긴다. 다른 날짜를 고르면 닫히지 않고 CSS transition으로
  // 그 칸 옆으로 미끄러져 이동. 모바일(isNarrow)은 기존 시트(m-edit-sheet) 그대로.
  const workspaceRef = useRef<HTMLElement | null>(null);
  const editorPanelRef = useRef<HTMLElement | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  // 셸 요소를 **상태**로도 쥔다(콜백 ref) — 시청자 미리보기는 셸을 통째로 언마운트했다 다시 그리므로, 단계 측정 effect가
  // 새 요소에 다시 붙어야 한다(2026-09-04 사용자: "미리보기 갔다 오면 창이 넓은데도 아이콘만 남는다").
  const [shellEl, setShellEl] = useState<HTMLElement | null>(null);
  const setShellRef = useCallback((el: HTMLElement | null) => {
    shellRef.current = el;
    setShellEl(el);
  }, []);
  const bottomRowRef = useRef<HTMLDivElement | null>(null);
  // 크롬 압축 단계(2026-09-04 사용자: "창 비율을 억지로 망가뜨려도 대응") — 0 정상 · 1 미리보기 라벨 짧게 ·
  // 2 라벨→기호("?"·눈·나가기·"저장됨"만) · 3 저장 점만·버전 숨김·제목/달 축소. 단계별 CSS는 studio-calm-layer.css ⑤,
  // 규칙 문서는 docs/ux/chrome-compaction-manual.md. 임계 폭을 외우지 않고 **실측**한다: 단계를 0부터 올려 보며
  // 헤더 한 줄이 넘치지 않는 첫 단계에서 멈춘다(리사이즈 때만, 동기 레이아웃 최대 4회). 넘침 = topbar
  // scrollWidth > clientWidth(계정 모서리는 nowrap이라 못 들어가면 오른쪽으로 샌다) 또는 제목·달·계정 세 칸이 서로
  // 겹침(제목 칸은 min-width:0이라 1fr 열이 min-content 아래로 줄어 달 라벨 밑으로 파고들 수 있다).
  const [chromeTier, setChromeTier] = useState(0);
  useLayoutEffect(() => {
    const shell = shellEl;
    if (!shell) return;
    if (isNarrow) {
      shell.removeAttribute("data-chrome");
      setChromeTier(0);
      return;
    }
    // 레이아웃이 없는 상단바(언마운트됐거나 display:none)는 절대 재지 않는다 — 0×0 rect는 모든 단계에서 '겹침'으로 읽혀
    // 3단계까지 올라간 값이 굳는다(2026-09-04 근본 원인: 시청자 미리보기로 셸이 언마운트되는 순간 ResizeObserver가 0 크기로
    // 한 번 더 울렸고, 돌아온 새 셸은 관찰 대상이 아니라 다시 재지 않았다).
    const measurable = (bar: HTMLElement) => bar.isConnected && bar.clientWidth > 0 && bar.getClientRects().length > 0;
    const overflows = (bar: HTMLElement) => {
      if (bar.scrollWidth > bar.clientWidth + 1) return true;
      const l = bar.querySelector(".studio-left")?.getBoundingClientRect();
      const m = bar.querySelector(".studio-month-label")?.getBoundingClientRect();
      const r = bar.querySelector(".studio-role-tools")?.getBoundingClientRect();
      if (l && m && l.width > 0 && m.width > 0 && m.left < l.right + 4) return true;
      if (m && r && m.width > 0 && r.width > 0 && r.left < m.right + 4) return true;
      // 계정 카드는 rail 폭으로 고정·등분(studio-calm-layer.css ⑦) — 칸보다 긴 라벨은 칸 안에서 넘친다(overflow hidden이라
      // 보이진 않지만 scrollWidth로 드러난다). 그것도 '넘침'으로 쳐서 단계를 올린다.
      for (const cell of bar.querySelectorAll<HTMLElement>(
        ".studio-role-tools .save-status, .studio-role-tools .actor-badge, .studio-role-tools .io-preview, .studio-role-tools .io-logout, .studio-role-tools .preview-dd-trigger, .studio-role-tools > .button"
      )) {
        if (cell.scrollWidth > cell.clientWidth + 1) return true;
      }
      return false;
    };
    const measure = () => {
      const bar = shell.querySelector<HTMLElement>(".studio-topbar");
      if (!bar || !measurable(bar)) return; // 잴 수 없으면 이전 값을 건드리지 않는다(다시 보이면 RO·remount가 다시 잰다)
      let tier = 0;
      for (;;) {
        if (tier === 0) shell.removeAttribute("data-chrome");
        else shell.setAttribute("data-chrome", String(tier));
        if (!overflows(bar) || tier >= 3) break;
        tier += 1;
      }
      setChromeTier(tier);
    };
    measure();
    let cancelled = false;
    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!cancelled) measure();
      });
    };
    // 웹폰트가 늦게 오면 글자 폭이 바뀐다 — 준비되면 한 번 더.
    document.fonts?.ready.then(() => {
      if (!cancelled) measure();
    });
    window.addEventListener("resize", schedule);
    // 창 크기 이벤트 없이도 상단바 폭은 바뀐다(세로 스크롤바 생김/사라짐, rail 열림·닫힘 슬라이드, 웹폰트 교체) — 그때 잰 단계가
    // 그대로 굳어 "창이 넓은데도 아이콘만"이 됐다(2026-09-04 사용자). 상단바·계정 카드 자체를 지켜보며 다시 잰다.
    const ro = new ResizeObserver(schedule);
    ro.observe(shell);
    const bar = shell.querySelector<HTMLElement>(".studio-topbar");
    if (bar) ro.observe(bar);
    const card = shell.querySelector<HTMLElement>(".studio-role-tools");
    if (card) ro.observe(card);
    // 탭이 다시 보이거나(숨겨진 동안의 리사이즈는 RO가 못 본다) 창 포커스가 돌아오면 한 번 더.
    document.addEventListener("visibilitychange", schedule);
    window.addEventListener("pageshow", schedule);
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      document.removeEventListener("visibilitychange", schedule);
      window.removeEventListener("pageshow", schedule);
    };
    // 헤더 내용이 바뀌는 조건들(셸 remount·역할·미리보기·로그인 상태·저장 상태 글자)에서 다시 잰다.
  }, [shellEl, isNarrow, isDeveloper, previewRole, actor.isAuthenticated, isEffectivelyOwner, saveState]);
  // 미리보기 이동 카드(.viewer-preview-actions) = 포스터 레일(.public-right) 폭·오른쪽 끝(2026-09-04 사용자: 편집실 계정 카드와
  // 같은 지적). 오버레이와 레일이 같은 문서에 있으니 여기서 둘 다 재서 카드에 --pv-w/--pv-mr(레이아웃 px = rect ÷ zoom)을
  // 준다(studio-shell.css). 레일이 접힌 아바타 scene에선 변수를 지워 기본 폭. 레일 폭이 바뀌는 순간(포스터 배율·아바타 토글)은
  // ResizeObserver(레일·오버레이) + 래퍼 class 변화로 잡는다.
  useEffect(() => {
    if (!viewerMode || isNarrow) return;
    let raf = 0;
    let ro: ResizeObserver | null = null;
    let mo: MutationObserver | null = null;
    let observedRail: Element | null = null;
    let observedStage: Element | null = null;
    const fit = () => {
      raf = 0;
      const overlay = document.querySelector<HTMLElement>(".viewer-preview-overlay");
      const card = overlay?.querySelector<HTMLElement>(".viewer-preview-actions");
      const rail = document.querySelector<HTMLElement>(".viewer-fullscreen .poster-surface .public-right");
      if (!overlay || !card) return;
      if (ro && rail && rail !== observedRail) {
        if (observedRail) ro.unobserve(observedRail);
        ro.observe(rail);
        observedRail = rail;
      }
      // 포스터 배율이 바뀌면 stage 높이(자연 높이 × 배율)가 바뀐다 — 레일 rect는 transform이라 RO가 못 보므로 stage를 본다.
      const stage = document.querySelector<HTMLElement>(".viewer-fullscreen .poster-stage");
      if (ro && stage && stage !== observedStage) {
        if (observedStage) ro.unobserve(observedStage);
        ro.observe(stage);
        observedStage = stage;
      }
      const rr = rail?.getBoundingClientRect();
      if (!rail || !rr || rr.width < 60) {
        card.style.removeProperty("--pv-w");
        card.style.removeProperty("--pv-mr");
        return;
      }
      const or = overlay.getBoundingClientRect();
      const zoom = overlay.offsetWidth > 0 ? or.width / overlay.offsetWidth : 1;
      const padR = parseFloat(getComputedStyle(overlay).paddingRight) || 0;
      card.style.setProperty("--pv-w", `${Math.round(rr.width / zoom)}px`);
      card.style.setProperty("--pv-mr", `${Math.round((or.right - rr.right) / zoom - padR)}px`);
    };
    const timers: number[] = [];
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(fit);
      // 배율·아바타 전환은 transition(포스터 scaler transform·stage margin 0.55s) 중이라 첫 실측이 중간값이다 — 끝난 뒤 두 번 더.
      for (const id of timers) window.clearTimeout(id);
      timers.length = 0;
      timers.push(window.setTimeout(fit, 400), window.setTimeout(fit, 900));
    };
    ro = new ResizeObserver(schedule);
    const overlay = document.querySelector<HTMLElement>(".viewer-preview-overlay");
    if (overlay) ro.observe(overlay);
    const wrap = document.querySelector<HTMLElement>(".viewer-fullscreen");
    if (wrap) {
      mo = new MutationObserver(schedule);
      mo.observe(wrap, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
      wrap.addEventListener("transitionend", schedule);
    }
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      if (raf) cancelAnimationFrame(raf);
      for (const id of timers) window.clearTimeout(id);
      ro?.disconnect();
      mo?.disconnect();
      wrap?.removeEventListener("transitionend", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [viewerMode, isNarrow]);
  // 자동 배치 좌표 + 등장 원점(ox/oy = 앵커가 팝오버 로컬에서 향하는 지점) — 스케일-인이
  // '클릭한 칸/일정에서부터 자라나듯' 보이게 transform-origin으로 쓴다.
  const [editorPopPos, setEditorPopPos] = useState<{
    left: number;
    top: number;
    ox: number;
    oy: number;
  } | null>(null);
  // 사용자가 헤더를 잡아 끌면 그 자리가 우선(수동 배치) — 다른 날짜/일정을 고르면 자동 배치로 복귀.
  const [editorPopManual, setEditorPopManual] = useState<{ left: number; top: number } | null>(
    null
  );
  const [editorPopDragging, setEditorPopDragging] = useState(false);
  // 화면 밖에서 놓은 직후 스프링 복귀 중 — className은 React가 소유하므로 상태로 관리
  // (classList.add는 다음 리렌더에 지워져 스프링 이징이 무시됐다).
  const [editorPopSnapback, setEditorPopSnapback] = useState(false);
  // 연속 튕김 보장 — 이전 해제 타이머가 새 스냅백 애니 중에 발화해 스프링을 끊지 않게 리셋.
  const editorSnapTimerRef = useRef<number | null>(null);
  // 앵커 칸 중심(workspace 좌표) — 팝오버→칸 리더 라인의 칸 쪽 끝점.
  const [editorAnchorPt, setEditorAnchorPt] = useState<{ x: number; y: number } | null>(null);
  // 팝오버 폼 최대 높이(로컬 px) — '상단 크롬 아래 ~ 화면 바닥' 가용 공간 실측. 고정
  // calc(100dvh-110px)는 크롬이 두꺼운 화면(관리바 포함 ~140px)에서 팝오버가 가용 공간보다
  // 길어져 어떤 클램프로도 '전부 보임'이 불가능했다(스냅백이 안 돌아오는 것처럼 보이던 원인 중 하나).
  const [editorPopMaxH, setEditorPopMaxH] = useState<number | null>(null);
  // 팝오버 실측 크기 — 리더 라인의 카드 쪽 끝점(사각형 최근접 가장자리) 계산용.
  const [editorPopSize, setEditorPopSize] = useState<{ w: number; h: number } | null>(null);
  const editorPopManualRef = useRef<typeof editorPopManual>(null);
  editorPopManualRef.current = editorPopManual;
  // 드래그 진행 중 플래그(ref) — 이동 프레임마다 상태를 안 거치므로, rAF 동기화 루프가
  // '지금은 손이 잡고 있다'를 상태와 무관하게 알 수 있어야 자동 좌표로 안 되돌린다.
  const editorPopDragActiveRef = useRef(false);
  // ⚠ 대형 모니터에선 .studio-shell에 CSS zoom(≥1700px: 0.9, ≥2400px: 0.8)이 걸린다.
  // getBoundingClientRect는 zoom '반영 후' 화면 px를 주지만, 우리가 쓰는 CSS left/top과 SVG
  // 좌표는 zoom이 '곱해지기 전' 로컬 px로 해석된다 → 화면 px를 그대로 쓰면 모든 좌표가
  // 0.9배 지점에 그려져 아래 행일수록 도트가 위로 밀렸다(실사용 드리프트의 진짜 원인).
  // 보정 배율 = 화면 폭 / 로컬 폭(offsetWidth). zoom 없으면 1.
  const getPopZoom = useCallback(() => {
    const ws = workspaceRef.current;
    if (!ws || !ws.offsetWidth) return 1;
    return ws.getBoundingClientRect().width / ws.offsetWidth || 1;
  }, []);
  // 상단 고정 크롬(상단바 + 보이는 액션바)의 하단 — 팝오버가 이 아래로만 오게 하는 기준선.
  // 예전 하드코딩 64px는 상단바만 감안해, 팝오버 머리가 관리(액션)바 '밑으로' 숨어 잡을 수
  // 없게 되는 케이스가 있었다(--dock-top과 같은 실측 문법). 화면(visual) px 반환.
  const getChromeBottomV = useCallback(() => {
    const bar = document.querySelector(".studio-actionbar");
    const topbar = document.querySelector(".studio-topbar");
    return Math.max(
      bar?.getBoundingClientRect().bottom ?? 0,
      topbar?.getBoundingClientRect().bottom ?? 0,
      0
    );
  }, []);
  const editorAnchorPtRef = useRef<typeof editorAnchorPt>(null);
  editorAnchorPtRef.current = editorAnchorPt;
  const anchorLineRef = useRef<SVGLineElement | null>(null);
  // 수동 드래그 클램프 — '꽉 가두기'가 아니라 잡을 수 있는 최소한만 남긴다: 카드가 좌우로는
  // 140px만 화면에 걸치면 되고, 세로는 헤더 바(위 64px 아래~바닥 위 56px)만 손이 닿으면 된다.
  // 몸통이 화면/판 밖으로 나가는 건 허용 — 가두면 큰 카드일수록 이동 여유가 0이 돼 툭툭 걸린다.
  const clampPopPos = useCallback(
    (left: number, top: number) => {
      const ws = workspaceRef.current;
      const panel = editorPanelRef.current;
      if (!ws || !panel) return { left, top };
      const z = getPopZoom();
      const popW = panel.offsetWidth || 384; // offset* = 로컬 px
      const KEEP = 140; // 가로로 화면에 남겨둘 최소 폭(로컬 px)
      const wsTopV = ws.getBoundingClientRect().top; // 화면 px → /z 로 로컬 변환
      // 상단 크롬(상단바+액션바) 아래 — 헤더가 그 밑으로 숨어 못 잡게 되는 일 방지.
      const vpTop = (getChromeBottomV() - wsTopV) / z + 8;
      // 헤더 바가 바닥 아래로 안 사라지게. (문서 높이 팽창은 workspace overflow:clip이 차단 —
      // 파묻힌 몸통은 가장자리에서 시각적으로 잘릴 뿐 스크롤 영역을 안 늘린다.)
      const vpBottom = (window.innerHeight - wsTopV) / z - 56;
      return {
        left: Math.round(Math.max(KEEP - popW, Math.min(left, ws.clientWidth - KEEP))),
        top: Math.round(Math.max(vpTop, Math.min(top, vpBottom)))
      };
    },
    [getPopZoom, getChromeBottomV]
  );
  // 리더 라인의 카드 쪽 끝점 — '팝오버 중심 → 앵커' 방향 선이 팝오버 테두리를 뚫는 지점.
  // 앵커/팝오버가 움직이면 끝점이 테두리를 따라 연속으로 미끄러진다(변 전환에서 툭 안 튐 —
  // 시청자 팝오버와 동일 규칙). 정면일 땐 자연히 그 변의 정중앙. 덮이면 앵커 그대로(선 생략).
  function popEdgePoint(
    pos: { left: number; top: number },
    size: { w: number; h: number },
    anchor: { x: number; y: number }
  ) {
    const cx = pos.left + size.w / 2;
    const cy = pos.top + size.h / 2;
    const dx = anchor.x - cx;
    const dy = anchor.y - cy;
    const hw = size.w / 2;
    const hh = size.h / 2;
    if (Math.abs(dx) <= hw && Math.abs(dy) <= hh) return { x: anchor.x, y: anchor.y }; // 덮임
    const t = Math.min(
      dx !== 0 ? hw / Math.abs(dx) : Infinity,
      dy !== 0 ? hh / Math.abs(dy) : Infinity
    );
    return { x: Math.round(cx + dx * t), y: Math.round(cy + dy * t) };
  }
  const placeEditorPopover = useCallback(() => {
    const ws = workspaceRef.current;
    const panel = editorPanelRef.current;
    const cell = calPanelRef.current?.querySelector<HTMLElement>(
      `.studio-day[data-isodate="${selectedDate}"]`
    );
    if (!ws || !panel || !cell) return;
    const wsRect = ws.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    // 화면 px(getBoundingClientRect) → 로컬 px(/z, CSS zoom 보정) — left/top·SVG 좌표는 로컬.
    const z = getPopZoom();
    const cellL = (cellRect.left - wsRect.left) / z;
    const cellT = (cellRect.top - wsRect.top) / z;
    const cellW = cellRect.width / z;
    const cellH = cellRect.height / z;
    // 리더 도트의 앵커 — '일정 수정'이면 그 일정 칩의 중심(칸 첫 카드에 잘못 찍히던 문제),
    // '새 일정(날짜)'이면 칸 상단 중심. 업 도움은 칩이 없고 띠(.support-bar)가 실체이므로
    // 그 날짜 칸의 띠 조각을 정확히 찍는다. 수동 배치 중에도 항상 갱신(리더 라인용).
    const pill = selectedEventId
      ? (cell.querySelector<HTMLElement>(`.studio-event-pill[data-eventid="${selectedEventId}"]`) ??
        cell.querySelector<HTMLElement>(`.support-bar[data-supportid="${selectedEventId}"]`) ??
        calPanelRef.current?.querySelector<HTMLElement>(
          `.studio-event-pill[data-eventid="${selectedEventId}"], .support-bar[data-supportid="${selectedEventId}"]`
        ))
      : null;
    // 신규(날짜 대상)는 칸 위쪽에서 고정 오프셋으로 찍으면 업 도움 띠 위에 얹혀 "띠를 고르는
    // 중"처럼 보인다(실측). 띠는 목록 위 여백에 깔리므로, **일정 목록의 시작점**을 기준으로
    // 잡으면 띠가 몇 줄이든 항상 칸 본문에 붙는다. 목록이 없으면 칸 중앙으로 물러선다.
    // 신규(날짜 대상)는 **날짜 숫자**를 짚는다. 일정 목록이나 칸 중앙을 짚으면 카드 위에
    // 얹혀 "이 일정을 고르는 중인가?"로 읽힌다 — 처음 보는 사람에겐 구분이 안 된다(실측).
    // 날짜 숫자는 어떤 상황(띠 유무·카드 유무·카드 개수)에서도 늘 칸 맨 위에 있어 흔들리지 않는다.
    const listEl = pill ? null : cell.querySelector<HTMLElement>(".studio-day-head");
    const listRect = listEl?.getBoundingClientRect() ?? null;
    const aRect = pill ? pill.getBoundingClientRect() : (listRect ?? cellRect);
    const aT = (aRect.top - wsRect.top) / z;
    const aH = aRect.height / z;
    const anchor = pill
      ? {
          x: Math.round((aRect.left - wsRect.left) / z + aRect.width / z / 2),
          y: Math.round(aT + aH / 2)
        }
      : listRect
        ? {
            x: Math.round((aRect.left - wsRect.left) / z + aRect.width / z / 2),
            y: Math.round(aT + Math.min(aH / 2, 22))
          }
        : {
            x: Math.round(cellL + cellW / 2),
            y: Math.round(cellT + Math.min(cellH / 2, 46))
          };
    // 폼 최대 높이 = 크롬 아래 가용 세로(로컬) — 팝오버 전체가 항상 화면에 들어갈 수 있게.
    const availH = Math.max(260, Math.round((window.innerHeight - getChromeBottomV()) / z - 64));
    setEditorPopMaxH((v) => (v === availH ? v : availH));
    setEditorAnchorPt((p) => (p && p.x === anchor.x && p.y === anchor.y ? p : anchor));
    const size = { w: panel.offsetWidth || 356, h: panel.offsetHeight || 480 }; // offset* = 로컬
    setEditorPopSize((s) => (s && s.w === size.w && s.h === size.h ? s : size));
    // 드래그 중엔 손이 진실 — 아무것도 안 건드린다.
    if (editorPopDragActiveRef.current) return;
    // 수동 배치는 자동 좌표로 되돌리지 않되, 스크롤 시엔 자동 배치와 같은 '전부 보이게'
    // 클램프를 매 프레임 통과시킨다(드래그용 느슨한 클램프(헤더만)로는 본문이 잘렸다 —
    // 리포트 2회). 클램프에 걸릴 때만 갱신하므로 화면 안에선 놓은 자리 그대로다.
    const manual = editorPopManualRef.current;
    if (manual) {
      const vpTopL = (getChromeBottomV() - wsRect.top) / z + 8;
      const vpBottomL = (window.innerHeight - wsRect.top) / z - 8;
      let mTop = manual.top;
      if (mTop + size.h > vpBottomL) mTop = vpBottomL - size.h;
      if (mTop < vpTopL) mTop = vpTopL;
      const mLeft = Math.max(140 - size.w, Math.min(manual.left, ws.clientWidth - 140));
      const adj = { left: Math.round(mLeft), top: Math.round(mTop) };
      if (adj.left !== manual.left || adj.top !== manual.top) {
        editorPopManualRef.current = adj;
        setEditorPopManual(adj);
      }
      return;
    }
    const popW = size.w;
    const popH = size.h;
    const GAP = 12;
    const PAD = 8;
    const wsW = ws.clientWidth; // 로컬 px
    // 가로: **칸 왼쪽 우선**(2026-09-04 사용자, HCI) — 일정은 보통 날짜순으로 고치는데 오른쪽에 뜨면
    // 바로 다음 날 칸을 가려 팝오버를 치우는 클릭이 매번 한 번 더 들었다. 왼쪽은 이미 손본 날이라
    // 가려도 된다. 왼쪽에 자리가 없으면(일·월요일 칸) 오른쪽으로 flip, 그래도 안 되면 안쪽으로 클램프.
    let left = cellL - popW - GAP;
    if (left < PAD) left = cellL + cellW + GAP;
    left = Math.max(PAD, Math.min(left, wsW - popW - PAD));
    // 세로: 칸 상단 정렬이 기본. 뷰포트(고정 상단바 아래~바닥) 안에 다 보이게 당기고,
    // workspace 밖으로도 안 나가게 마지막으로 클램프. (뷰포트 값도 로컬로 변환)
    let top = cellT - 4;
    const vpTop = (getChromeBottomV() - wsRect.top) / z + PAD; // 상단 크롬(상단바+액션바) 아래
    const vpBottom = (window.innerHeight - wsRect.top) / z - PAD;
    if (top + popH > vpBottom) top = vpBottom - popH;
    if (top < vpTop) top = vpTop;
    // ⚠ workspace 바닥 클램프 금지 — 빈 달에선 rAF 루프가 min-height를 '팝오버 바닥+18'로
    // 늘리는데, 여기서 바닥-8로 다시 당기면 늘어난 만큼 또 내려가는 랫칫이 돼 팝오버가
    // 부들거리며 가라앉았다(실사용 리포트). 뷰포트 클램프가 이미 가시성을 보장하고,
    // workspace는 min-height가 팝오버를 따라 늘어난다.
    top = Math.max(PAD, top);
    const next = {
      left: Math.round(left),
      top: Math.round(top),
      // 등장 원점 = 앵커가 팝오버 로컬 좌표에서 가리키는 지점(팝오버 밖이면 가장자리로 클램프).
      ox: Math.round(Math.max(0, Math.min(anchor.x - left, popW))),
      oy: Math.round(Math.max(0, Math.min(anchor.y - top, popH)))
    };
    setEditorPopPos((p) =>
      p && p.left === next.left && p.top === next.top && p.ox === next.ox && p.oy === next.oy
        ? p
        : next
    );
  }, [selectedDate, selectedEventId, getPopZoom, getChromeBottomV]);
  // 헤더 드래그로 팝오버 이동. 이동 중엔 React 상태를 안 거치고 DOM(style·라인 좌표)을 직접
  // 갱신한다 — 이 컴포넌트는 커서 6천 줄 셸이라 pointermove마다 리렌더하면 툭툭 끊긴다(실측).
  // 손을 떼는 순간에만 상태로 확정(setEditorPopManual)해 React 좌표와 동기화한다.
  function onEditorPopDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    if (isNarrow) return;
    // 버튼(닫기/저장)에서 시작한 제스처는 드래그가 아니다.
    if ((e.target as HTMLElement).closest("button, a, input, textarea, select")) return;
    const panel = editorPanelRef.current;
    const base = editorPopManualRef.current ?? editorPopPos;
    if (!panel || !base) return;
    e.preventDefault();
    // 창 밖(모니터 가장자리 너머)에서 놓아도 pointerup을 받도록 캡처 — 안 하면 up이 유실돼
    // 드래그 상태가 영원히 살아남아 스냅백·추적 루프가 전부 멎는다(파묻힌 채 고정되던 원인).
    try {
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      /* 미지원/실패 무시 — 아래 blur 안전망이 받친다 */
    }
    const startX = e.clientX;
    const startY = e.clientY;
    const z = getPopZoom(); // 포인터 delta는 화면 px — 로컬 px로 변환해야 1:1로 따라온다
    let moved = false;
    let last = base;
    const onMove = (ev: PointerEvent) => {
      // up 유실 자가 치유 — 버튼이 안 눌린 move가 오면(창 밖 릴리즈 등) 즉시 종료 처리.
      if (ev.buttons === 0) {
        onUp();
        return;
      }
      const dx = (ev.clientX - startX) / z;
      const dy = (ev.clientY - startY) / z;
      if (!moved && Math.abs(dx) < 3 && Math.abs(dy) < 3) return; // 클릭 오차 보호
      if (!moved) {
        moved = true;
        editorPopDragActiveRef.current = true; // rAF 루프가 자동 좌표로 되돌리지 않게
        setEditorPopDragging(true); // transition 끄기용 1회 렌더만
      }
      last = clampPopPos(base.left + dx, base.top + dy);
      panel.style.left = `${last.left}px`;
      panel.style.top = `${last.top}px`;
      // 리더 라인도 같은 프레임에 직접 이동(상태 경유 시 한 박자 늦게 따라온다).
      const anchor = editorAnchorPtRef.current;
      const line = anchorLineRef.current;
      if (anchor && line) {
        const edge = popEdgePoint(last, { w: panel.offsetWidth, h: panel.offsetHeight }, anchor);
        line.setAttribute("x2", String(edge.x));
        line.setAttribute("y2", String(edge.y));
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("blur", onUp);
      if (moved) {
        hapticTick();
        // 화면 밖으로 나간 채 놓으면 — 꾸미기 스티커처럼 '전부 보이는' 자리까지 스프링으로
        // 팅 튕겨 복귀한다(드래그 중엔 자유, 파묻힌 채 방치 금지 — 사용자 요청).
        const ws = workspaceRef.current;
        let snapped = last;
        if (ws) {
          const z = getPopZoom();
          const wsTopV = ws.getBoundingClientRect().top;
          const vpTopL = (getChromeBottomV() - wsTopV) / z + 8;
          const vpBottomL = (window.innerHeight - wsTopV) / z - 8;
          const w = panel.offsetWidth || 384;
          const h = panel.offsetHeight || 480;
          snapped = {
            left: Math.round(Math.max(8, Math.min(last.left, ws.clientWidth - w - 8))),
            top: Math.round(Math.max(vpTopL, Math.min(last.top, vpBottomL - h)))
          };
        }
        if (snapped.left !== last.left || snapped.top !== last.top) {
          if (editorSnapTimerRef.current) window.clearTimeout(editorSnapTimerRef.current);
          setEditorPopSnapback(true);
          editorSnapTimerRef.current = window.setTimeout(
            () => setEditorPopSnapback(false),
            650
          );
        }
        setEditorPopManual(snapped); // 확정 — 이후 리렌더에서도 이 좌표 유지
        editorPopManualRef.current = snapped; // rAF 루프가 상태 반영 전 프레임에 되돌리지 않게
        // ⚠ DOM도 직접 동기화 — 드래그 중 직접 쓴 style과 React 가상 스타일이 어긋나면,
        // 새 상태값이 React의 이전 값과 같을 때 React가 '변화 없음'으로 보고 DOM(드래그
        // 값)을 안 고쳐 팝오버가 파묻힌 채 남았다(실측: state 56 vs DOM 245). 직접 쓰면
        // 스프링 transition(pop-snapback)이 그 변화를 그대로 애니메이션한다.
        panel.style.left = `${snapped.left}px`;
        panel.style.top = `${snapped.top}px`;
        const a2 = editorAnchorPtRef.current;
        const line2 = anchorLineRef.current;
        if (a2 && line2) {
          const e2 = popEdgePoint(
            snapped,
            { w: panel.offsetWidth, h: panel.offsetHeight },
            a2
          );
          line2.setAttribute("x2", String(e2.x));
          line2.setAttribute("y2", String(e2.y));
        }
      }
      editorPopDragActiveRef.current = false;
      setEditorPopDragging(false);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("blur", onUp); // 캡처가 실패한 환경의 최후 안전망(창 포커스 이탈 = 종료)
  }
  // 다른 날짜/일정을 고르면(editorKey 증가) 수동 배치를 버리고 새 앵커 옆 자동 배치로.
  useEffect(() => {
    setEditorPopManual(null);
  }, [editorKey]);
  useLayoutEffect(() => {
    if (!editorVisible || isNarrow) {
      setEditorPopPos(null);
      setEditorPopManual(null);
      setEditorAnchorPt(null);
      return;
    }
    placeEditorPopover();
    // 첫 배치(첫 페인트)가 지난 뒤에야 이동 transition을 켠다 — 켜진 채 첫 좌표가 들어가면
    // 기본값(left:0)에서 목표까지의 이동이 애니메이션돼 좌상단에서 날아온다. remount(key)마다
    // 새 노드라 클래스는 자동으로 초기화된다.
    const panel = editorPanelRef.current;
    if (panel && !panel.classList.contains("pop-settled")) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => panel.classList.add("pop-settled"))
      );
    }
    // 위치에 영향 주는 것들: 선택 대상·달·확대 배율·아바타 scene(달력 폭)·에디터 remount.
  }, [
    editorVisible,
    isNarrow,
    placeEditorPopover,
    selectedEventId,
    editorKey,
    view,
    calZoom,
    avatarSceneOn,
    avatarSide
  ]);
  // 열려 있는 동안 매 프레임 실측 동기화(rAF) — 리사이즈·아바타 margin 슬라이드·체인 등높이
  // JS·업도움 띠·폰트 로드 등 '배치 이후의 레이아웃 시프트'를 이벤트별로 쫓아다니지 않고
  // 한 루프로 수렴시킨다(실서비스에서 행이 늦게 밀리며 앵커 도트가 칸 위로 떠 보이던 원인).
  // 읽기 2회 + 값이 같으면 setState가 같은 객체를 반환해 리렌더 0 — 유휴 비용은 측정뿐이다.
  useEffect(() => {
    if (!editorVisible || isNarrow) return;
    const wsEl = workspaceRef.current;
    let raf = 0;
    let rowSeen: HTMLDivElement | null = null; // 정리 때 원위치시킬 알약 행(틱에서 마지막으로 본 노드)
    const tick = () => {
      placeEditorPopover();
      // 일정이 없어 달력이 짧은 달 — workspace(overflow:clip)가 팝오버보다 낮으면 아랫부분이
      // 잘려 폼 하단을 누를 수 없었다. 팝오버 바닥+패딩만큼 최소 높이를 매 프레임 보장
      // (달력이 충분히 길면 no-op, 빈 달에서만 실제로 늘어난다. 닫으면 원복).
      const panel = editorPanelRef.current;
      if (wsEl && panel) {
        const need = panel.offsetTop + panel.offsetHeight + 18;
        const cur = parseFloat(wsEl.style.minHeight || "0") || 0;
        if (Math.abs(cur - need) > 1) wsEl.style.minHeight = `${need}px`;
      }
      // 하단 플로팅 알약(아바타 좌/우·확대) ↔ 팝오버 겹침(2026-09-04 사용자: "겹침이 세서 잘 안 보인다").
      // 알약의 **자연 위치**(화면 정중앙, left:50%)를 기준으로 겹침을 보고 — 이동 중인 실제 rect로 재면 스스로를
      // 쫓아 흔들린다 — 겹치면 팝오버 **옆**(가까운 쪽, workspace 안)으로 비켜 선다(--bfr-shift, CSS 스프링).
      // 양옆 다 자리가 없으면 data-dodge="fade"로 거의 지워 본문이 읽히게(호버에 복귀). 닫히면 원위치.
      const row = bottomRowRef.current;
      if (row) rowSeen = row;
      if (row && panel && wsEl) {
        const pr = panel.getBoundingClientRect();
        const rr = row.getBoundingClientRect();
        const zf = studioShellZoom();
        const natL = document.documentElement.clientWidth / 2 - rr.width / 2;
        const natR = natL + rr.width;
        const GAP = 12;
        const hit =
          natL < pr.right + GAP && natR > pr.left - GAP && rr.top < pr.bottom + GAP && rr.bottom > pr.top - GAP;
        let shift = 0;
        let mode = "";
        if (hit) {
          const wr = wsEl.getBoundingClientRect();
          const leftPos = pr.left - GAP - rr.width;
          const rightPos = pr.right + GAP;
          const canL = leftPos >= wr.left + 8;
          const canR = rightPos + rr.width <= wr.right - 8;
          if (canL && (!canR || natL - leftPos <= rightPos - natL)) {
            shift = (leftPos - natL) / zf;
            mode = "side";
          } else if (canR) {
            shift = (rightPos - natL) / zf;
            mode = "side";
          } else {
            mode = "fade";
          }
        }
        const curShift = parseFloat(row.style.getPropertyValue("--bfr-shift")) || 0;
        if (Math.abs(shift - curShift) > 0.5) row.style.setProperty("--bfr-shift", `${Math.round(shift)}px`);
        if ((row.dataset.dodge ?? "") !== mode) {
          if (mode) row.dataset.dodge = mode;
          else delete row.dataset.dodge;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (wsEl) wsEl.style.minHeight = "";
      if (rowSeen) {
        rowSeen.style.removeProperty("--bfr-shift");
        delete rowSeen.dataset.dodge;
      }
    };
  }, [editorVisible, isNarrow, placeEditorPopover]);

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
      // temp→실제 id 교체 렌더에서도 같은 카드로 이어 붙인다(키가 바뀌면 그 카드만 활주를 놓쳤다).
      const id = el.dataset.eventid ? canonId(el.dataset.eventid) : "";
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
  }, [visibleEvents, view, dragEventId, canonId]);

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
  // 유령 손맛(2026-08-06 사용자 결정): **회전 없음.** 손을 임계감쇠 스프링으로 뒤따르고,
  // 아주 작은 흔들림으로만 살아있게 하고, 놓으면 목적지로 '뿅' 빨려 들어간다.
  // CSS 애니메이션 대신 JS로 transform을 직접 칠해, 2색(그라데이션) 카드에도 확실히 적용된다.
  const edPosRef = useRef({ x: 0, y: 0 });
  const edVelPosRef = useRef({ x: 0, y: 0 }); // 스프링 속도(px/s)
  const edTargetRef = useRef({ x: 0, y: 0 });
  const edFrameRef = useRef(0); // 이전 프레임 시각(ms) — 스프링 dt
  const edReducedRef = useRef(false);
  // 던지기(fling) — 빠르게 뿌리면 포물선으로 날아가 화면 밖에서 삭제된다(회전 없이 작아지며).
  const edVelRef = useRef({ x: 0, y: 0 }); // 포인터 속도(px/ms)
  const edPtrRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const flingRafRef = useRef<number | null>(null);
  const flingGhostRef = useRef<HTMLElement | null>(null);
  // 착지 중인 유령(놓은 뒤 새 자리로 빨려 들어가는 중) — 새 드래그가 시작되면 즉시 치운다.
  const landRafRef = useRef<number | null>(null);
  const landGhostRef = useRef<HTMLElement | null>(null);
  function cancelLanding() {
    if (landRafRef.current !== null) cancelAnimationFrame(landRafRef.current);
    landRafRef.current = null;
    landGhostRef.current?.remove();
    landGhostRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
      if (flingRafRef.current) cancelAnimationFrame(flingRafRef.current);
      if (landRafRef.current) cancelAnimationFrame(landRafRef.current);
      landGhostRef.current?.remove();
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
      // 멈췄다 천천히 놓는 평범한 드롭이 실수로 던져지지 않게 한다.
      edVelRef.current.x *= 0.9;
      edVelRef.current.y *= 0.9;
      const now = performance.now();
      const dt = edFrameRef.current ? (now - edFrameRef.current) / 1000 : 1 / 60;
      edFrameRef.current = now;
      const pos = edPosRef.current;
      const vel = edVelPosRef.current;
      const t = edTargetRef.current;
      // 손을 임계감쇠 스프링으로 뒤따른다 — 찰랑임 없이 '살짝 늦게' 붙는 무게감(iOS 문법).
      const sx = springStep(pos.x, vel.x, t.x, FOLLOW_STIFF, FOLLOW_DAMP, dt);
      const sy = springStep(pos.y, vel.y, t.y, FOLLOW_STIFF, FOLLOW_DAMP, dt);
      pos.x = sx.pos;
      pos.y = sy.pos;
      vel.x = sx.vel;
      vel.y = sy.vel;
      // 살아있는 느낌은 회전이 아니라 아주 작은 흔들림으로 — 빠르게 움직일 때만 살아난다.
      const speed = Math.hypot(edVelRef.current.x, edVelRef.current.y);
      const w = swayOffset(now, speed);
      ghost.style.left = `${pos.x}px`;
      ghost.style.top = `${pos.y}px`;
      ghost.style.transform = `translate3d(${w.x.toFixed(2)}px, ${w.y.toFixed(2)}px, 0) scale(${LIFT_SCALE})`;
    }
    dragRaf.current = requestAnimationFrame(dragAutoScroll);
  }

  /**
   * 놓은 유령을 **목적지 카드 자리로 빨아들이며** 사라지게 한다('뿅').
   * 낙관적 갱신이 끝난 다음 프레임에 실제 카드를 찾아 그 사각형으로 스프링 이동한 뒤,
   * 유령을 지우고 실제 카드에 짧은 정착 펄스를 준다. 목적지를 못 찾으면 그냥 사라진다.
   */
  function landGhost(ghost: HTMLElement, eventId: string) {
    if (edReducedRef.current) {
      ghost.remove();
      return;
    }
    cancelLanding(); // 앞선 착지가 남아 있으면 먼저 치운다(유령 두 장 금지)
    ghost.classList.add("landing");
    landGhostRef.current = ghost;
    const start = performance.now();
    let prev = start;
    const pos = { x: edPosRef.current.x, y: edPosRef.current.y };
    const vel = { x: edVelPosRef.current.x, y: edVelPosRef.current.y };
    let scale = LIFT_SCALE;
    const finish = () => {
      if (landRafRef.current !== null) cancelAnimationFrame(landRafRef.current);
      landRafRef.current = null;
      landGhostRef.current = null;
      ghost.remove();
      const el = findPillEl(eventId);
      if (el) {
        el.classList.remove("just-landed");
        void el.offsetWidth; // 리플로우 한 번 — 같은 카드를 연달아 옮겨도 매번 다시 재생된다
        el.classList.add("just-landed");
        window.setTimeout(() => el.classList.remove("just-landed"), 500);
      }
    };
    const step = () => {
      const now = performance.now();
      const dt = (now - prev) / 1000;
      prev = now;
      const el = findPillEl(eventId);
      if (!el || now - start > LAND_MAX_MS) {
        finish();
        return;
      }
      const r = el.getBoundingClientRect();
      const nx = springStep(pos.x, vel.x, r.left, LAND_STIFF, LAND_DAMP, dt);
      const ny = springStep(pos.y, vel.y, r.top, LAND_STIFF, LAND_DAMP, dt);
      pos.x = nx.pos;
      pos.y = ny.pos;
      vel.x = nx.vel;
      vel.y = ny.vel;
      scale += (1 - scale) * Math.min(1, dt * 14);
      ghost.style.left = `${pos.x}px`;
      ghost.style.top = `${pos.y}px`;
      ghost.style.transform = `scale(${scale.toFixed(3)})`;
      ghost.style.opacity = String(Math.max(0, 0.92 - (now - start) / LAND_MAX_MS));
      if (Math.hypot(pos.x - r.left, pos.y - r.top) < 1.5) {
        finish();
        return;
      }
      landRafRef.current = requestAnimationFrame(step);
    };
    landRafRef.current = requestAnimationFrame(step);
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
    // 던지기 판정 — 회전을 없앴으므로 **뿌린 속도**만 본다(px/ms).
    const v = edVelRef.current;
    const speed = Math.hypot(v.x, v.y);
    const flung = Boolean(info?.started && ghost && !edReducedRef.current && speed > FLING_SPEED);
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
      launchFling(ghost!, v, canonId(info!.id));
      dragInfoRef.current = null;
      return;
    }
    dragGhostRef.current = null;
    setDragEventId(null);
    setDragChipH(0);
    if (info?.started && target) {
      void dropEventInto(info.id, info.sourceDate, target, over);
      // 놓은 유령을 새 자리로 빨아들이며 사라지게 한다('뿅') — 순간이동처럼 툭 끊기지 않게.
      // 끄는 사이 저장이 끝나 id가 바뀌었을 수 있다 → 실제 id로 착지 대상을 찾는다.
      if (ghost) landGhost(ghost, canonId(info.id));
    } else {
      ghost?.remove();
    }
    dragInfoRef.current = null;
  }

  // 던지기: 받은 속도(px/ms)로 유령을 포물선으로 날린다(회전 없음 — 작아지며 멀어진다).
  // 화면 밖으로 완전히 벗어나면 그 일정을 삭제한다(commitDelete = 낙관적 제거 + Ctrl+Z 스택).
  function launchFling(ghost: HTMLElement, v: { x: number; y: number }, eventId: string) {
    let fx = v.x * 16; // px/frame(~16ms)
    let fy = v.y * 16;
    const sp = Math.hypot(fx, fy) || 1;
    const m = Math.min(60, Math.max(11, sp)); // 너무 느리면 살짝 띄우고, 너무 빠르면 가둔다
    fx = (fx / sp) * m;
    fy = (fy / sp) * m;
    let posX = edPosRef.current.x;
    let posY = edPosRef.current.y;
    let scale = LIFT_SCALE;
    const G = 1.7; // 던지기 중력(px/frame^2)
    flingGhostRef.current = ghost;
    const step = () => {
      fy += G;
      fx *= 0.99; // 공기저항(가로)
      posX += fx;
      posY += fy;
      scale = Math.max(0.7, scale - 0.006); // 멀어지듯 조금씩 작아진다(회전 없음)
      ghost.style.left = `${posX}px`;
      ghost.style.top = `${posY}px`;
      ghost.style.transform = `scale(${scale.toFixed(3)})`;
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
        setDragChipH(0);
        hapticDelete();
        commitDelete(eventId); // canonId·현재 배열은 commitDelete 안에서 해석
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
      // 열려 있는 확대 팝오버(hover·핀 모두)는 드래그 시작 즉시 닫는다 — 떠 있으면
      // elementFromPoint를 가로채 드롭 칸·삽입선 판정을 막는다.
      closeZoomPeek();
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
      // 유령은 body에 붙어 달력 패널의 --cal-zoom을 상속받지 못한다(portal) — 현재 배율을
      // 직접 복사해 확대 상태에서도 유령 크기가 원본 카드와 일치하게 한다.
      ghost.style.setProperty("--cal-zoom", String(calZoomRef.current));
      ghost.appendChild(inner);
      document.body.appendChild(ghost);
      dragGhostRef.current = ghost;
      setDragEventId(info.id);
      // 슬라이드 프리뷰 한 칸 = 카드 높이 + 목록 간격(5×zoom) — 형제 카드가 이만큼 밀린다.
      // ⚠ 레이아웃 px로 저장한다: 이 값은 zoom 안쪽 스페이서(.drop-gap)의 인라인 height가
      // 되는데, rect.height는 셸 CSS zoom(≥1700px 0.9)이 이미 곱해진 화면 px라 그대로 쓰면
      // 배율이 두 번 먹어 '놓을 자리'가 '원래 위치'보다 10% 낮았다(큰 화면에서만 재현).
      setDragChipH(rect.height / studioShellZoom() + 5 * calZoomRef.current);
      cancelLanding(); // 앞 카드가 아직 착지 중이면 치우고 시작한다
      // 스프링 추적 초기화 — 잡은 그 자리에서 시작해 손을 뒤따른다(회전 없음).
      edPosRef.current = { x: rect.left, y: rect.top };
      edTargetRef.current = { x: rect.left, y: rect.top };
      edVelPosRef.current = { x: 0, y: 0 };
      edFrameRef.current = 0;
      // 던지기 속도 추적 초기화.
      edVelRef.current = { x: 0, y: 0 };
      edPtrRef.current = null;
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
        (el) => canonId(el.getAttribute("data-eventid") ?? "") !== canonId(info.id)
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
    const c = canonId(e.id);
    return (
      (e.endDateKey != null && e.endDateKey > getEventDateKey(e)) ||
      Boolean(e.linkNext) ||
      eventsRef.current.some((o) => o.linkNext != null && canonId(o.linkNext) === c)
    );
  }

  // 드래그로 집은 카드와 '이을 수 있는' 상대들을 계산해 강조/흐림을 켠다. 이을 수 있음 =
  // buildLinkChain이 성립(둘 사이 매일 연속 + 맞닿는 변의 대표 태그 일치). 없으면 순수 이동 드래그.
  function armConnectCandidates(draggedId: string) {
    // 제스처(옛 렌더 클로저)에서 불린다 — 배열은 ref, id는 canonId(DOM은 실제·클로저는 temp일 수 있다).
    const live = eventsRef.current;
    const dc = canonId(draggedId);
    const dragged = live.find((e) => canonId(e.id) === dc);
    if (!dragged || dragged.isSupport) return;
    const set = new Set<string>();
    for (const other of live) {
      if (canonId(other.id) === dc || other.isSupport) continue;
      if (buildLinkChain(dragged, other, live)) set.add(other.id);
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
  function connectChain(rawAnchorId: string, rawTargetId: string) {
    if (!canEdit) return;
    // 제스처 핸들러(옛 렌더 클로저)에서 불린다 — 배열은 ref로 '지금' 것을, id는 canonId로 비교.
    // 예전엔 DOM의 실제 id와 클로저 배열의 temp id가 어긋나 조용히 return(잇기가 죽음)하거나,
    // 서버엔 실제 id로 잇고 화면(temp 키)엔 반영이 안 됐다.
    const live = eventsRef.current;
    const anchor = live.find((e) => canonId(e.id) === canonId(rawAnchorId));
    const target = live.find((e) => canonId(e.id) === canonId(rawTargetId));
    if (!anchor || !target) return;
    const chain = buildLinkChain(anchor, target, live);
    if (!chain || chain.length < 2) return;
    const chainC = chain.map(canonId);
    const findC = (arr: StudioScheduleEvent[], c: string) => arr.find((e) => canonId(e.id) === c);
    // 이미 그대로 이어져 있으면(변화 없음) 서버 쓰기·토스트 없이 조용히 넘어간다.
    const linkMap = new Map<string, string>(); // canon(earlier) → 다음 카드의 '지금 배열' id
    let changed = false;
    for (let i = 0; i < chainC.length - 1; i += 1) {
      const nextLive = findC(live, chainC[i + 1]);
      const nextId = nextLive?.id ?? chain[i + 1];
      linkMap.set(chainC[i], nextId);
      const curNext = findC(live, chainC[i])?.linkNext;
      if (!curNext || canonId(curNext) !== chainC[i + 1]) changed = true;
    }
    if (!changed) return;
    // target rollback(P0-DATA-2): 실패 시 체인에 포함됐던 카드들의 linkNext만 이전 값으로
    // 복원(다른 편집 보존). 서버 쪽도 0055 link_chain_atomic이라 반쪽 체인이 안 남는다.
    const prevLinks = new Map(chainC.map((c) => [c, findC(live, c)?.linkNext] as const));
    const restoreChain = () =>
      setEvents((prev) =>
        prev.map((e) => {
          const c = canonId(e.id);
          return prevLinks.has(c) ? { ...e, linkNext: prevLinks.get(c) } : e;
        })
      );
    const applyLinks = (arr: StudioScheduleEvent[]) =>
      arr.map((e) => {
        const c = canonId(e.id);
        return linkMap.has(c) ? { ...e, linkNext: linkMap.get(c) } : e;
      });
    setEvents(applyLinks);
    setActionError(null);
    hapticTick();
    flashToast("이어붙였어요");
    // 맞물림 연출 — 새로 이은 두 카드만이 아니라 '이은 결과로 한 몸이 된 체인 전체'가
    // 딸깍(사용자 결정). 낙관 반영 후 상태 기준으로 앞뒤 연결을 전부 따라간다.
    const afterLink = applyLinks(live);
    setLinkFlashIds(getLinkedChainIds(anchor.id, afterLink));
    if (linkFlashTimer.current) window.clearTimeout(linkFlashTimer.current);
    linkFlashTimer.current = window.setTimeout(() => setLinkFlashIds(new Set()), 700);
    void (async () => {
      const result = await enqueueWrite(async () => {
        const resolved = await Promise.all(chain.map(resolveEventId));
        if (resolved.some((id) => !id)) {
          restoreChain();
          return { ok: false, error: "일정 저장이 끝나지 않아 잇지 못했어요." };
        }
        return postStudioWrite("linkChain", { orderedIds: resolved as string[] });
      });
      if (!result.ok) {
        setActionError(result.error);
        restoreChain();
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
    // 제스처 중(옛 렌더 클로저) 호출 — 배열은 ref, 요소는 temp/실제 id 어느 쪽이든 찾는다.
    for (const ev of eventsRef.current) {
      if (!ev.linkNext) continue;
      const el = findPillEl(ev.id);
      if (el) {
        const r = el.getBoundingClientRect();
        // earlier 오른쪽 절반(중앙~오른쪽 변, 살짝 넘겨).
        out.push({ id: ev.id, x1: r.left + r.width / 2, x2: r.right + 3, top: r.top - 3, bottom: r.bottom + 3 });
      }
      const nextEl = findPillEl(ev.linkNext);
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
      // 확대 팝오버가 떠 있으면 잇기·끊기 선긋기의 elementFromPoint 판정을 가로챈다 — 즉시 닫기.
      closeZoomPeek();
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
    // 제스처가 달력 안 요소에 남긴 포커스를 걷어낸다 — 남으면 ←/→가 달 이동 대신
    // roving 날짜 이동으로 먹힌다(아무것도 선택 안 된 상태의 기대와 어긋남).
    if (g.moved) {
      const ae = document.activeElement as HTMLElement | null;
      if (ae?.closest?.(".studio-month-grid")) ae.blur();
    }
  }
  // 우클릭 눌림 — '이미 선택된 카드' 위에서 시작할 때만 잇기(보라 선), 그 외(다른 카드·빈 곳·
  // 달력 밖 어디든)는 끊기(빨간 선). 끊기를 카드 위에서 시작해도 잇기로 오인되지 않게, 또 끊는
  // 선을 달력 밖에서 시작해 주 경계 이음새까지 그어 올 수 있게 한다. 실제 시작은 6px 이상 움직였을 때.
  function beginRightGesture(e: PointerEvent) {
    if (!canEdit || e.button !== 2 || e.pointerType !== "mouse") return;
    // 우클릭이 카드/날짜 칸에 포커스를 옮기지 않게 — 제스처 뒤 ←/→가 (roving 포커스의)
    // 날짜 이동으로 먹혀 달 이동이 안 되던 문제(사용자 지적).
    e.preventDefault();
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
    const syncId = canonId(move.id);
    setSyncingIds((p) => (p.includes(syncId) ? p : [...p, syncId])); // 이 카드에 '동기화 중' 표시
    movePersistChainRef.current = movePersistChainRef.current
      .catch(() => {})
      .then(() => runMovePersist(move))
      .finally(() => {
        pendingPersistRef.current = Math.max(0, pendingPersistRef.current - 1);
        setSyncingIds((p) => p.filter((x) => x !== syncId)); // 반영 끝 → 표시 제거
        // 이번 큐의 어느 이동이든 서버에 못 들어갔으면, 큐가 빈 지금 서버 진실로 되돌린다.
        if (resyncNeededRef.current) requestServerResync();
      });
  }

  async function runMovePersist(move: {
    id: string;
    sourceDate: string;
    targetDate: string;
    orderedIds: string[];
  }) {
    const realMovedId = await resolveEventId(move.id);
    if (!realMovedId) {
      // 옮긴 카드의 저장이 실패/취소돼 서버에 없다 — 화면만 옮겨진 채 두면 새로고침 때 갈라진다.
      resyncNeededRef.current = true;
      return;
    }
    const realOrderedIds = await Promise.all(move.orderedIds.map((eid) => resolveEventId(eid)));
    if (realOrderedIds.some((x) => x == null)) {
      // 같은 날에 저장 실패한 카드가 섞여 있다. 예전엔 조용히 버렸는데("다음 이동 때 정리됨"),
      // 다음 이동이 없으면 이번 순서는 영영 서버에 안 갔다 → 실패한 카드만 빼고 저장한다.
      // (그 카드는 서버에 없으니 순서에서 빠져도 서버 진실과 어긋나지 않는다.)
      const kept = realOrderedIds.filter((x): x is string => x != null);
      if (kept.length === 0) {
        resyncNeededRef.current = true;
        return;
      }
      realOrderedIds.splice(0, realOrderedIds.length, ...kept);
    }
    // keepalive 전송(studioWrite) → 옮기고 바로 달을 넘기거나 창을 닫아도 전송이 끝까지 보장된다.
    // (일반 fetch/서버액션은 페이지를 떠나면 중간에 끊겨 "옮긴 곳에 저장 안 됨"이 났다.)
    const result = await studioWrite("reorder", {
      dateKey: move.targetDate,
      orderedIds: realOrderedIds as string[],
      movedId: move.targetDate !== move.sourceDate ? realMovedId : undefined
    });
    if (!result.ok) {
      setActionError(result.error);
      // 서버 진실로 재동기화 — 단, 지금은 pendingPersistRef>0이라 곧바로 refresh해도 prop 동기화
      // 가드가 버린다. 플래그만 세우고 큐가 빈 뒤(finally)에 실제 refresh한다.
      resyncNeededRef.current = true;
    }
  }

  // 드롭: 일정을 target 날짜로(필요 시) 옮기고, 같은 날 안에서 over(위/아래) 위치에 끼워 순서 변경.
  function dropEventInto(
    id: string,
    sourceDate: string,
    targetDate: string,
    over: { id: string; after: boolean } | null
  ) {
    // ⚠ 이 함수는 pointerdown 때 등록된 리스너(옛 렌더 클로저)에서 불린다. 그 사이 새 카드의
    // 저장이 끝나 id가 temp → 실제로 바뀌었을 수 있다 — 2026-08-16 실측: 만든 직후 끈 카드가
    // 화면에선 순서가 안 바뀌고(옛 id로 찾다 놓침) 서버에만 저장돼, 새로고침하면 순서가 달랐다.
    // 그래서 ① 배열은 ref로 '지금' 것을 읽고 ② id 비교는 전부 canonId(temp↔실제 동일시)로 한다.
    const live = eventsRef.current;
    const cid = canonId(id);
    const moved = live.find((ev) => canonId(ev.id) === cid);
    if (!moved) return;
    id = moved.id; // 이후 로직은 '지금 배열에 있는' id로 통일

    // target 날짜의 (드래그 중인 카드를 뺀) 현재 표시 순서.
    const dayEvents = getEventsForDate(live, targetDate).filter((e) => canonId(e.id) !== cid);
    let insertIdx = dayEvents.length; // 기본: 맨 끝
    if (over && canonId(over.id) !== cid) {
      const overId = canonId(over.id);
      const idx = dayEvents.findIndex((e) => canonId(e.id) === overId);
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
    const currentIds = getEventsForDate(live, targetDate).map((e) => e.id);
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
    pushUndo({
      type: "move",
      holder: { id },
      fromDate: sourceDate,
      toDate: targetDate,
      fromOrderedIds: getEventsForDate(live, sourceDate).map((e) => e.id)
    });

    const orderPos = new Map(orderedIds.map((eid, i) => [canonId(eid), i] as const));
    flipArmedRef.current = true; // 드래그 재정렬 — 이 변화에만 형제 카드 FLIP 활주를 허용.
    // 낙관적 반영(즉시). 서버 prop이 이걸 덮어쓰지 않게 위 prop 동기화는 pendingPersist 동안 멈춘다.
    // updater 안에서도 canonId — setEvents가 실행되는 순간 id가 또 바뀌어 있을 수 있다.
    setEvents((prev) =>
      prev.map((ev) => {
        let next = ev;
        const evc = canonId(ev.id);
        if (evc === cid && targetDate !== sourceDate) {
          next = {
            ...next,
            startsAt: next.startsAt.replace(/^\d{4}-\d{2}-\d{2}/, targetDate),
            endDateKey: next.endDateKey ? addDaysIso(next.endDateKey, delta) : next.endDateKey
          };
        }
        const pos = orderPos.get(evc);
        if (pos !== undefined) next = { ...next, sortOrder: pos };
        return next;
      })
    );
    setSelectedDate(targetDate);
    // ⚠ 여기서 markJustSaved를 부르지 않는다. 옮긴 카드는 유령이 새 자리로 빨려 들어간 뒤
    // 착지 펄스(.just-landed)를 이미 받는다 — 둘 다 켜면 "따닥" 두 번 반짝여 산만하다
    // (2026-08-06 사용자 지적). '반짝'은 저장·생성처럼 결과가 눈에 안 보이는 일에만 쓴다.
    flashToast(targetDate === sourceDate ? "순서를 바꿨어요" : `${targetDate}로 옮겼어요`);
    // 서버 저장은 직렬 큐로 — 빠른 연속 이동도 순서대로 저장돼 마지막 위치가 서버 최종값이 된다.
    enqueueMovePersist({ id, sourceDate, targetDate, orderedIds });
  }

  // showPanel=false면 오른쪽 편집/상세 패널을 열지 않고 form만 채운다(업 도움 시트처럼 팝업만
  // 띄울 때 — 패널이 같이 슬라이드 인 하는 군더더기를 없앤다).
  function selectEvent(event: StudioScheduleEvent, showPanel = true) {
    setSelectedDate(event.startsAt.slice(0, 10));
    setSelectedEventId(event.id);
    // 일정을 (다시) 누르면 게이트도 처음부터 — 통과 기록은 '한 번 연 카드'에만 유효하다.
    setTeaserGatePass("");
    setTeaserGateError(null);
    setTeaserUnlockedId(null);
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

  // (매니저용 태그 토글 `toggleEventTag`와 그 직렬 큐 `queueTagWrite`는 매니저 시트 2종과 함께 철수 —
  //  2026-09-04, ADR-0018. 관리자는 편집 폼 저장으로 태그를 바꾼다.)

  // A1: 읽기전용 일정 상세(지금은 개발자의 시청자 화면 미리보기만 본다 — 매니저·작업자 철수). owner 편집
  // 폼을 회색으로 보여주는 대신 제목·날짜·공개범위·태그·업 도움 링크만 깔끔히. owner_private는 애초에
  // 비-owner에게 로드되지 않는다.
  function renderReadonlyDetail() {
    const selectedEvent = selectedEventId
      ? events.find((event) => event.id === selectedEventId) ?? null
      : null;
    return (
      <ReadonlyEventDetail
        legendTags={legendTags}
        onClose={() => setEditorVisible(false)}
        selectedDate={selectedDate}
        selectedEvent={selectedEvent}
        tagVisual={tagVisual}
      />
    );
  }

  // 최초공개 게이트 — 비공개 레이어 비밀번호를 서버에서 검증만 하고(grant 발급 없음, verifyOnly)
  // 통과하면 이 일정 id를 화면이 살아 있는 동안 기억해 평소 편집 폼으로 전환한다.
  async function submitTeaserGate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const eventId = selectedEventId;
    const pass = teaserGatePass.trim();
    if (!eventId || !pass || teaserGateBusy) return;
    hapticTick(); // ① 눌림(2단계 컨벤션 — 성공 톡은 서버 응답 후)
    setTeaserGateBusy(true);
    setTeaserGateError(null);
    try {
      const res = await fetch("/api/unlock-private-layer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode: pass, verifyOnly: true })
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        hapticSuccess(); // ② 서버확인
        setTeaserGatePass("");
        // 왕복 사이 저장이 끝나 id가 바뀌었을 수 있다 → 실제 id로 기록(안 그러면 방금 푼 카드가 도로 잠김).
        setTeaserUnlockedId(canonId(eventId)); // 이 카드, 이번 열림 한 번만 — 닫히거나 재선택하면 리셋
        bumpEditor(); // 게이트 → 폼: 같은 카드 안에서 폼이 새로 떠오르는 전환
      } else {
        hapticError();
        setTeaserGateError(data.error ?? "비밀번호가 올바르지 않습니다.");
        setTeaserGateShake(true);
        window.setTimeout(() => setTeaserGateShake(false), 420);
      }
    } catch {
      hapticError();
      setTeaserGateError("확인하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setTeaserGateBusy(false);
    }
  }

  // 게이트 카드(데스크톱 팝오버·모바일 시트 공용) — 내용은 일절 안 보여준다.
  // 공개 예정 시각과 비번 입력만. 이동/복사/드래그는 게이트 없이 평소처럼 가능하다.
  // head: 데스크톱 팝오버가 이동 그립·헤더 바를 form '안'에 넣을 때 쓴다 — 카드 chrome
  // (.event-editor-panel form의 배경/그림자/점선 아웃라인)이 폼에 붙으므로 밖에 두면 떠 보인다.
  function renderTeaserGate(head?: ReactNode) {
    return (
      <form className="teaser-gate" onSubmit={submitTeaserGate}>
        {head}
        {/* 설명문·아이콘 없이 카운트다운이 주인공 — 🔮은 헤더 배지에 이미 있다(중복 제거). */}
        {selectedLiveEvent?.teaserRevealAt ? (
          <TeaserGateCountdown revealAt={selectedLiveEvent.teaserRevealAt} />
        ) : null}
        {/* 오답 흔들림은 입력 줄에만 — 카드 전체를 흔들면 팝오버가 두 번 깜빡이는 느낌(사용자 지적). */}
        <div className={`teaser-gate-row${teaserGateShake ? " gate-shake" : ""}`}>
          <input
            aria-label="비공개 레이어 비밀번호"
            autoComplete="off"
            autoFocus
            className="teaser-gate-input"
            onChange={(e) => {
              setTeaserGatePass(e.target.value);
              if (teaserGateError) setTeaserGateError(null);
            }}
            placeholder="비밀번호"
            type="password"
            value={teaserGatePass}
          />
          <button
            className="button primary teaser-gate-submit"
            data-act="teaser-gate-submit"
            disabled={teaserGateBusy || !teaserGatePass.trim()}
            type="submit"
          >
            {teaserGateBusy ? "확인 중…" : "확인"}
          </button>
        </div>
        {/* 상태 줄은 항상 렌더(빈 값 포함) — 에러가 나타나며 카드 높이가 바뀌면 팝오버가
            재배치되며 한 번 더 움직여 보였다. 높이를 예약해 흔들림 없이 글자만 뜬다. */}
        <p aria-live="polite" className="teaser-gate-status" role="status">
          {teaserGateError ?? ""}
        </p>
      </form>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, editorVisible, mobileEditId, selectedEventId, selectedDate, canEdit]);

  // '새로 쓰기' — 복원된 임시 내용을 버리고 원본(기존 일정) 또는 빈 새 카드로 되돌린다.
  function discardDraft() {
    const key = draftKeyFor();
    if (key) {
      editDraftsRef.current.delete(key);
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

    // form.id는 새 카드 첫 저장 직후 temp id일 수 있고, 그 사이 실제 id로 바뀌어 있을 수 있다 —
    // canonId로 '지금 배열의' 카드를 찾는다(못 찾으면 옛 로직대로 '기존 없음'으로 흐른다).
    const formCanon = form.id ? canonId(form.id) : undefined;
    const existing = formCanon
      ? eventsRef.current.find((e) => canonId(e.id) === formCanon)
      : undefined;
    const isNew = !form.id;
    // 기존 카드면 '지금 배열에 있는' id로 통일(temp였다가 실제로 바뀐 경우 실제 id).
    const tempId = existing?.id ?? form.id ?? `temp-${Math.random().toString(36).slice(2)}`;
    // P0-SEC-1(fail-closed): 잠금 상태에서 비공개 범위를 **조용히 공개로 바꾸지 않는다**.
    // 예전엔 데스크톱에서 `"public"`으로 강제 변환했고 모바일은 잠금 없이 통과시켰다 —
    // 둘 다 위험(전자는 비공개 내용이 소리 없이 공개, 후자는 잠금 게이트 우회). 이제 모든
    // 장치에서 동일하게: 비공개 범위 저장은 비공개 보기(잠금 해제)가 켜져 있어야 하고,
    // 아니면 저장을 거부하고 이유를 말한다(서버도 동일 검증 — 클라 게이트는 1차 방어일 뿐).
    if (form.visibilityScope !== "public" && !canReadPrivate) {
      setActionError(
        "비공개 범위(엠바고·작업자)는 '비공개 일정 보기'를 켠 상태에서만 저장할 수 있어요."
      );
      return;
    }
    const scope: EventVisibilityScope = form.visibilityScope;
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
      supportKind: form.isSupport ? form.supportKind : undefined,
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
      id: isNew ? undefined : tempId, // 기존 카드면 '지금 배열의' id(temp면 전송 직전 실제 id로 해석)
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
      supportKind: form.supportKind,
      supportUrl: form.supportUrl,
      teaser: teaserOn,
      teaserRevealAt: teaserRevealIso
    };

    // (FLIP은 기본 OFF — 드롭 재정렬에서만 arm. 저장은 형제 카드를 밀지 않는다.)
    setEvents((prev) =>
      isNew
        ? [...prev, optimistic]
        : prev.map((e) => (canonId(e.id) === canonId(tempId) ? { ...optimistic, id: e.id } : e))
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
      // 기존 카드 수정인데 그 카드가 아직 temp id(첫 저장 진행 중)면, 실제 id가 나올 때까지
      // 기다렸다 그 id로 보낸다 — 예전엔 temp id를 그대로 보내 서버가 '새 일정'으로 하나 더 만들었다.
      const result = isNew
        ? await studioWrite("save", payload)
        : await enqueueWrite(async () => {
            const realId = await resolveEventId(payload.id);
            if (!realId) return { ok: false, error: "앞선 저장이 끝나지 않아 반영하지 못했어요." };
            return postStudioWrite("save", { ...payload, id: realId });
          });
      if (!result.ok) {
        setActionError(result.error);
        // P0-DATA-2(target rollback): 전체 배열 스냅샷 복원은 이 저장 '뒤'에 한 다른 편집까지
        // 지웠다. 실패한 이 일정만 되돌린다 — 새 카드는 제거, 기존 카드는 원본 복원.
        setEvents((prev) =>
          isNew
            ? prev.filter((e) => e.id !== tempId)
            : prev.map((e) => (canonId(e.id) === canonId(tempId) && existing ? existing : e))
        );
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
    editorSavedRef.current = true; // 여닫기 계측: 이 카드에서 저장이 한 번은 있었다
    // 연속 저장에도 매번 다시 재생되도록 다음 프레임에 켠다(같은 값 재설정은 애니 리트리거 안 됨).
    requestAnimationFrame(() => {
      setPanelSaved(true);
      if (panelSavedTimer.current) window.clearTimeout(panelSavedTimer.current);
      panelSavedTimer.current = window.setTimeout(() => setPanelSaved(false), 620);
    });
  }

  function deleteEvent(rawTargetId: string) {
    if (blockedByPreview()) return;
    if (!canEdit) {
      return;
    }
    // temp id ↔ 실제 id를 같은 카드로 본다(저장 직후 지우기). 배열은 ref로 '지금' 것을 읽는다.
    const targetId = canonId(rawTargetId);
    if (!eventsRef.current.some((e) => canonId(e.id) === targetId)) return;
    // 편집 중인 바로 그 일정을 지우면 카드를 '닫지(슬라이드 아웃)' 않고 같은 자리에서 빈 새 카드로
    // 비운다 — 여러 개를 연속으로 지울 때 카드가 들어갔다 나왔다 하지 않게(공간 안정성). editorKey는
    // 안 올려 매끄럽게. 다른 일정 삭제는 편집 카드를 건드리지 않는다.
    if (selectedEventId && canonId(selectedEventId) === targetId) {
      setSelectedEventId(null);
      setForm(createEmptyForm());
      // 임시 보관 정리 — 지운 일정의 드래프트를 버리고, 복원 안내 박스를 닫고, 기준을 빈 폼으로
      // 내린다. 안 하면 ① 안내 박스가 남고(DEL로 지워도 안 사라짐) ② 비워진 폼이 옛 기준 대비
      // '변경'으로 잡혀 캡처가 빈 드래프트를 다시 저장해 잔류한다.
      editBaselineRef.current = draftFingerprint(createEmptyForm());
      editDraftsRef.current.delete(`evt:${rawTargetId}`);
      editDraftsRef.current.delete(`evt:${targetId}`);
      editDraftsRef.current.delete(`new:${selectedDate}`);
      setDraftRestored(false);
    }
    hapticDelete(); // 또렷한 한 번(Android만; iOS·미지원은 조용히 무시)
    // 톡! 줄어들며 사라지는 동안만 잠깐 카드를 남겼다가 실제로 제거한다(reduced-motion이면 즉시).
    // 스냅샷은 commitDelete가 실행되는 순간의 배열을 쓴다(230ms 사이의 다른 편집을 안 잃게).
    if (!prefersReducedMotion() && !deletingIds.has(targetId)) {
      setDeletingIds((prev) => new Set(prev).add(targetId));
      window.setTimeout(() => commitDelete(targetId), 230);
      return;
    }
    commitDelete(targetId);
  }

  // P0-DATA-1: 삭제 직후 8초 스낵바 — 터치에서도 Ctrl+Z 없이 '실행 취소'를 누를 수 있다(L5).
  const [deleteSnack, setDeleteSnack] = useState<{ event: StudioScheduleEvent } | null>(null);
  const deleteSnackTimer = useRef<number | null>(null);
  function showDeleteSnack(removed: StudioScheduleEvent) {
    setDeleteSnack({ event: removed });
    if (deleteSnackTimer.current) window.clearTimeout(deleteSnackTimer.current);
    deleteSnackTimer.current = window.setTimeout(() => setDeleteSnack(null), 8000);
  }

  function commitDelete(rawTargetId: string) {
    const targetId = canonId(rawTargetId);
    const snapshot = eventsRef.current;
    const removed = snapshot.find((e) => canonId(e.id) === targetId) ?? null;
    // poof가 끝났으니 표시를 거둔다(실패해 되살아날 때 정상 모습으로 돌아오게).
    setDeletingIds((prev) => {
      if (!prev.has(targetId)) return prev;
      const next = new Set(prev);
      next.delete(targetId);
      return next;
    });
    // 낙관적 제거 + 이 일정을 가리키던 linkNext도 함께 정리. updater 안에서도 canonId —
    // 실행 순간 temp가 실제 id로 바뀌어 있어도 빗나가지 않는다.
    setEvents((prev) =>
      prev
        .filter((e) => canonId(e.id) !== targetId)
        .map((e) =>
          e.linkNext && canonId(e.linkNext) === targetId ? { ...e, linkNext: undefined } : e
        )
    );
    if (selectedEventId && canonId(selectedEventId) === targetId) {
      setSelectedEventId(null);
      setForm(createEmptyForm());
    }
    setActionError(null);
    // Ctrl+Z 복구용 스택 + 8초 '실행 취소' 스낵바(같은 restore 경로, P0-DATA-1).
    let undoEntry: UndoAction | null = null;
    if (removed) {
      undoEntry = { type: "recreate", event: removed };
      pushUndo(undoEntry);
      showDeleteSnack(removed);
    }
    startTransition(async () => {
      const result = await enqueueWrite(async () => {
        // 큐 차례가 와서 실행 — 이 시점엔 앞(생성) 작업이 끝나 temp가 실제 id로 풀려 있다.
        const realId = await resolveEventId(targetId);
        if (!realId) return null; // 서버에 정말 없음(저장 실패/미저장) → 보낼 것 없음
        return postStudioWrite("delete", { eventId: realId });
      });
      if (!result.ok) {
        setActionError(result.error);
        // P0-DATA-2(target rollback): 지운 그 일정만 되살리고, 이 일정을 가리키던 linkNext만
        // 복원한다 — 삭제 이후에 한 다른 편집은 건드리지 않는다.
        const linkedFrom = snapshot
          .filter((e) => e.linkNext && canonId(e.linkNext) === targetId)
          .map((e) => canonId(e.id));
        setEvents((prev) => {
          const base =
            prev.some((e) => canonId(e.id) === targetId) || !removed ? prev : [...prev, removed];
          return base.map((e) =>
            linkedFrom.includes(canonId(e.id)) ? { ...e, linkNext: removed?.id ?? targetId } : e
          );
        });
        // 복구 스택도 되돌림 — 맨 위(pop)가 아니라 '이 항목'을 뺀다(그 사이 다른 작업이 쌓였을 수 있다).
        if (undoEntry) {
          const idx = deletedStackRef.current.lastIndexOf(undoEntry);
          if (idx >= 0) deletedStackRef.current.splice(idx, 1);
        }
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
    setEvents((prev) => [...prev, optimistic]);
    markJustSaved(tempId); // 통통 착지 반짝
    const undoHolder = { id: tempId };
    const undoAction: UndoAction = { type: "remove", holder: undoHolder };
    pushUndo(undoAction); // Ctrl+Z = 방금 만든 휴방 제거
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
        // target rollback — 방금 만든 휴뱅 카드만 제거(다른 편집 보존).
        setEvents((prev) => prev.filter((e) => e.id !== tempId));
        dropUndoEntry(undoAction);
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

  // P1-HIST-1: 새 '되돌릴 수 있는 작업'은 반드시 이 문으로 — undo 스택에 쌓고 redo 스택을
  // 비운다. 실행취소 뒤 새 작업을 하면 그 시점의 '다시 실행'은 다른 미래와 충돌하므로 무효.
  function pushUndo(action: UndoAction) {
    deletedStackRef.current.push(action);
    redoStackRef.current = [];
  }
  // 낙관적 작업이 서버에서 실패해 되돌릴 때 — 맨 위(pop)가 아니라 '그 항목'을 뺀다. 응답을 기다리는
  // 사이 사용자가 다른 작업(다른 undo 항목)을 쌓았을 수 있어, pop은 엉뚱한 항목을 지웠다.
  function dropUndoEntry(action: UndoAction) {
    const idx = deletedStackRef.current.lastIndexOf(action);
    if (idx >= 0) deletedStackRef.current.splice(idx, 1);
    const r = redoStackRef.current.lastIndexOf(action);
    if (r >= 0) redoStackRef.current.splice(r, 1);
  }

  // Ctrl+Z: 스택 맨 위 '액션'을 종류에 맞게 되돌린다(LIFO). 삭제=다시 만들기, 생성/붙여넣기=지우기.
  // 그래서 복사→삭제→붙여넣기→Ctrl+Z = '방금 붙여넣은 카드'만 사라지고, 한 번 더 누르면 그 전
  // 삭제가 복구된다(올바른 순서). 예전엔 항상 마지막 삭제분을 되살리는 버그가 있었다.
  // 적용이 만든 역연산은 redo 스택으로 — Ctrl+Shift+Z(또는 Ctrl+Y)로 다시 실행.
  function restoreLastDelete() {
    if (!canEdit) {
      return;
    }
    const action = deletedStackRef.current.pop();
    if (!action) {
      flashToast("되돌릴 작업이 없어요");
      return;
    }
    const inverse = applyHistoryAction(action, "undo");
    if (inverse) redoStackRef.current.push(inverse);
  }

  function redoLastUndo() {
    if (!canEdit) {
      return;
    }
    const action = redoStackRef.current.pop();
    if (!action) {
      flashToast("다시 실행할 작업이 없어요");
      return;
    }
    const inverse = applyHistoryAction(action, "redo");
    if (inverse) deletedStackRef.current.push(inverse);
  }

  // 하나의 실행기가 undo/redo 양쪽을 처리한다 — redo 항목은 'undo가 만든 역연산'이라 같은
  // 모양(UndoAction). 반환값 = 이번 적용의 역연산(호출자가 반대 스택에 쌓는다). 대상 카드가
  // 그 사이 사라졌으면 null — 항목은 양쪽 스택 어디에도 남지 않고 소멸(충돌 가드).
  function applyHistoryAction(action: UndoAction, mode: "undo" | "redo"): UndoAction | null {
    const keyHint = mode === "undo" ? "Ctrl+Z" : "Ctrl+Shift+Z";
    if (action.type === "move") {
      // 드래그 이동 되돌리기 — 원래 날짜·원래 순서로 되돌린다(같은 날 안 순서만 바꾼 경우도 포함).
      // 방금 만든 카드(temp id)를 옮겼다면 그 사이 실제 id로 바뀌었을 수 있다 → 매핑으로 해소.
      const id = canonId(action.holder.id);
      const fromOrderedIds = action.fromOrderedIds.map(canonId);
      const moved = eventsRef.current.find((e) => canonId(e.id) === id);
      if (!moved) {
        flashToast("되돌릴 카드를 찾을 수 없어요");
        return null;
      }
      // 역연산: 옮기기 '전'(= 지금) toDate 쪽 순서를 보관 — 다시 실행하면 순서까지 제자리로.
      const inverse: UndoAction = {
        type: "move",
        holder: action.holder,
        fromDate: action.toDate,
        toDate: action.fromDate,
        fromOrderedIds: getEventsForDate(eventsRef.current, action.toDate).map((e) => e.id)
      };
      const delta = daysBetweenIso(getEventDateKey(moved), action.fromDate);
      const orderPos = new Map(fromOrderedIds.map((eid, i) => [eid, i] as const));
      flipArmedRef.current = true; // 되돌아가는 카드도 형제와 함께 활주
      setEvents((prev) =>
        prev.map((ev) => {
          let next = ev;
          const evc = canonId(ev.id);
          if (evc === id && action.fromDate !== action.toDate) {
            next = {
              ...next,
              startsAt: next.startsAt.replace(/^\d{4}-\d{2}-\d{2}/, action.fromDate),
              endDateKey: next.endDateKey ? addDaysIso(next.endDateKey, delta) : next.endDateKey
            };
          }
          const pos = orderPos.get(evc);
          if (pos !== undefined) next = { ...next, sortOrder: pos };
          return next;
        })
      );
      setSelectedDate(action.fromDate);
      markJustSaved(id); // 되돌아온 카드도 통통 안착
      setActionError(null);
      flashToast(
        action.fromDate === action.toDate
          ? `순서 되돌림 (${keyHint})`
          : mode === "undo"
            ? "이동 취소됨 (Ctrl+Z)"
            : "다시 이동함 (Ctrl+Shift+Z)"
      );
      // 서버에도 같은 큐(직렬)로 역이동 — 원래 이동과 순서가 뒤바뀌지 않는다.
      enqueueMovePersist({
        id,
        sourceDate: action.toDate,
        targetDate: action.fromDate,
        orderedIds: fromOrderedIds
      });
      return inverse;
    }

    if (action.type === "remove") {
      // 생성/붙여넣기 되돌리기(또는 삭제 다시 실행) — 그 카드를 지운다(holder.id는 실제 id로
      // 갱신돼 있음). 역연산용으로 지우기 전 카드 내용을 보관 — 되살릴 땐 같은 id tombstone 복구.
      // 'move'와 같은 규칙: id는 canonId, 배열은 ref — 붙여넣기 저장이 아직 진행 중일 때(temp)
      // Ctrl+Z를 눌러도 실제 id로 바뀐 카드를 정확히 잡는다.
      const id = canonId(action.holder.id);
      const snapshot = eventsRef.current.find((e) => canonId(e.id) === id) ?? null;
      setEvents((prev) =>
        prev
          .filter((e) => canonId(e.id) !== id)
          .map((e) =>
            e.linkNext && canonId(e.linkNext) === id ? { ...e, linkNext: undefined } : e
          )
      );
      if (selectedEventId && canonId(selectedEventId) === id) {
        setSelectedEventId(null);
        setForm(createEmptyForm());
      }
      setActionError(null);
      flashToast(mode === "undo" ? "붙여넣기 취소됨 (Ctrl+Z)" : "다시 삭제됨 (Ctrl+Shift+Z)");
      startTransition(async () => {
        const result = await enqueueWrite(async () => {
          const realId = await resolveEventId(id);
          if (!realId) return null; // 서버에 아직 없음 → 보낼 것 없음
          return postStudioWrite("delete", { eventId: realId });
        });
        if (!result.ok) setActionError(result.error);
      });
      return snapshot ? { type: "recreate", event: snapshot } : null;
    }

    // recreate(→ restore, P0-DATA-1): 삭제 되돌리기(또는 생성 다시 실행) — 서버 tombstone을 걷어
    // **같은 id**로 되살린다(태그/연결/하트/비공개 메타 보존. 예전 '재생성' 방식은 새 id라 관계가
    // 유실됐다).
    restoreDeletedEvent(
      action.event,
      mode === "undo" ? "삭제 취소됨" : "다시 실행함 (Ctrl+Shift+Z)"
    );
    return { type: "remove", holder: { id: canonId(action.event.id) } };
  }

  // 삭제 복구 공통 경로 — Ctrl+Z와 삭제 스낵바 '실행 취소'가 함께 쓴다.
  function restoreDeletedEvent(rawEv: StudioScheduleEvent, toast = "삭제 취소됨") {
    setDeleteSnack(null);
    if (deleteSnackTimer.current) window.clearTimeout(deleteSnackTimer.current);
    // 스냅샷이 temp id로 남아 있어도 서버 복원은 실제 id로 간다 — 로컬도 같은 id로 되살려
    // 두 개(temp 유령 + 실제)가 잠깐 겹치지 않게 한다.
    const ev = { ...rawEv, id: canonId(rawEv.id) };
    setEvents((prev) =>
      prev.some((e) => canonId(e.id) === ev.id) ? prev : [...prev, ev]
    );
    setActionError(null);
    markJustSaved(ev.id); // 되살아난 카드도 통통 착지하며 반짝
    flashToast(toast);
    startTransition(async () => {
      const result = await enqueueWrite(async () => {
        const realId = await resolveEventId(ev.id);
        if (!realId) return null; // 서버에 간 적 없는 임시 카드 — 클라 복원으로 충분
        return postStudioWrite("restore", { eventId: realId });
      });
      if (!result.ok) {
        setActionError(result.error);
        setEvents((prev) => prev.filter((e) => canonId(e.id) !== ev.id));
        return;
      }
      hapticTick(); // 서버 확정
      // 이 일정을 가리키던 연결(linkNext)은 서버 원본이 그대로라 정본 동기화 — 큐가 빈 뒤에
      // (진행 중 쓰기가 있으면 prop 동기화 가드가 결과를 버리므로 requestServerResync로 미룬다).
      requestServerResync();
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
    updates: {
      id: string;
      displayName: string;
      colorKey: ColorKey;
      bgHex?: string | null;
      sortOrder?: number;
      kind?: TagKind;
      parentId?: string | null;
    }[]
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
              sortOrder: u.sortOrder ?? t.sortOrder,
              // 종류/부모 변경도 즉시 반영 — 서버엔 저장되는데 이 세션의 섹션 분류만
              // 옛날에 머무르던 문제(태그 감사 P2).
              kind: u.kind ?? t.kind,
              parentId: u.parentId === undefined ? t.parentId : u.parentId
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
      supportKind: ev.supportKind ?? "up",
      isTentative: ev.isTentative ?? false,
      supportUrl: ev.supportUrl ?? "",
      category: ev.category,
      status: ev.status,
      visibilityScope: ev.visibilityScope,
      tagIds: ev.tagIds,
      primaryTagIds: ev.primaryTagIds,
      // 아직 안 풀린 최초공개는 가림째로 복사한다(공개 시각이 지난 떡밥은 평범한 일정으로).
      teaser: teaserStillHidden(ev),
      teaserRevealAt: teaserStillHidden(ev) ? (ev.teaserRevealAt ?? "") : ""
    });
    flashToast("일정 복사됨 · 날짜 고르고 Ctrl+V");
  }
  function pasteCopiedEvent() {
    if (!clipboard) return;
    insertEventCopy(clipboard, selectedDate, `${selectedDate}에 붙여넣음`);
  }
  // (복제 버튼 제거 — Ctrl+C/V가 정식 경로. insertEventCopy는 붙여넣기 전용으로 유지.)
  // 복사본 삽입 공통 경로 — Ctrl+V 붙여넣기가 쓴다(targetDate 파라미터화 유지).
  function insertEventCopy(payload: CopiedEvent, targetDate: string, toast: string) {
    if (!canEdit) return;
    // P0-SEC-1(fail-closed): 잠금 상태에서 비공개 일정을 붙여넣으면 예전엔 공개로 강제 변환
    // 됐다 — 비공개 '내용'이 공개 일정으로 복제되는 유출 경로. 조용한 변환 대신 거부한다.
    if (payload.visibilityScope !== "public" && !canReadPrivate) {
      flashToast("비공개 일정은 '비공개 일정 보기'를 켠 뒤 복제할 수 있어요");
      return;
    }
    const scope: EventVisibilityScope = payload.visibilityScope;
    const endDateKey =
      payload.isSupport && payload.spanDays > 0
        ? addDaysIso(targetDate, payload.spanDays)
        : undefined;
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    // 낙관적으로 즉시 붙여넣고, 서버엔 백그라운드 반영(새로고침 없이).
    const optimistic: StudioScheduleEvent = {
      id: tempId,
      startsAt: `${targetDate}T00:00:00+09:00`,
      endDateKey,
      isSupport: payload.isSupport,
      supportKind: payload.isSupport ? payload.supportKind : undefined,
      supportUrl: payload.supportUrl || undefined,
      isAllDay: true,
      isTentative: payload.isTentative,
      publicTitle: payload.publicTitle,
      status: payload.status,
      visibilityScope: scope,
      category: payload.category,
      tagIds: payload.tagIds,
      primaryTagIds: payload.primaryTagIds.slice(0, 2),
      teaser: payload.teaser || undefined,
      teaserRevealAt: payload.teaser ? payload.teaserRevealAt || undefined : undefined,
      sortOrder: 0
    };
    setEvents((prev) => [...prev, optimistic]);
    // 실행취소 스택에 'remove'로 올린다 → Ctrl+Z면 방금 만든 이 카드가 사라진다.
    const undoHolder = { id: tempId };
    const undoAction: UndoAction = { type: "remove", holder: undoHolder };
    pushUndo(undoAction);
    flashToast(toast);
    setActionError(null);
    startTransition(async () => {
      const result = await studioWrite("save", {
        id: undefined,
        dateKey: targetDate,
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
        supportKind: payload.supportKind,
        supportUrl: payload.supportUrl,
        teaser: payload.teaser,
        teaserRevealAt: payload.teaser ? payload.teaserRevealAt || null : null
      });
      if (!result.ok) {
        setActionError(result.error);
        // target rollback — 붙여넣은 카드만 제거(다른 편집 보존).
        setEvents((prev) => prev.filter((e) => e.id !== tempId));
        dropUndoEntry(undoAction);
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
      // 방송 판서가 열려 있는 동안 편집실 전역 단축키 전면 차단(Ctrl+S/Z/C/V·Alt+N·Esc 전부) —
      // 판서의 Esc/Tab은 판서 자신이 처리한다. 닫히면 이 가드가 자동 해제되어 원상복구.
      if (broadcastOpenRef.current) return;
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
        editorCloseHowRef.current = "esc";
        setEditorVisible(false);
        return;
      }
      // Delete: 선택한 일정 삭제. 떡밥 게이트가 열려 있으면 포커스가 비번칸(autoFocus)이라
      // 아래 INPUT 가드에 막혀 삭제가 안 됐다(사용자 지적) → 비번칸이 '비어 있을 때'만
      // 여기서 먼저 처리한다(입력 중이면 평소대로 글자 지우기가 우선).
      if (e.key === "Delete" && selectedEventId && !modal) {
        const el = t as HTMLInputElement | null;
        const inEmptyGate =
          teaserGateActive && el?.tagName === "INPUT" && el.type === "password" && !el.value;
        if (inEmptyGate) {
          e.preventDefault();
          deleteEvent(selectedEventId);
          return;
        }
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
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      // Ctrl+Shift+Z: 다시 실행(P1-HIST-1). Shift 조합은 이것만 — 나머지는 기존대로 차단.
      if (key === "z" && e.shiftKey) {
        e.preventDefault();
        redoLastUndo();
        return;
      }
      if (e.shiftKey) return;
      if (key === "z") {
        // 실수로 지운 일정 되살리기(편집 중 텍스트는 위 INPUT/TEXTAREA 가드로 보호됨).
        e.preventDefault();
        restoreLastDelete();
      } else if (key === "y") {
        // Ctrl+Y — Windows 관습의 다시 실행(같은 동작).
        e.preventDefault();
        redoLastUndo();
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
  }, [canEdit, selectedEventId, clipboard, selectedDate, modal, canReadPrivate, events, editorVisible, form, teaserGateActive]);

  // 모바일 아젠다도 데스크톱과 동일하게 — 비공개 일정은 "비공개 일정 보기"로 직접 켜기 전까진
  // 누구에게도(개발자·소유자 포함) 보이지 않는다. 방송사고 방지: 진입/새로고침 시 항상 공개 기본.
  const mobileAgendaEvents = liveEvents;

  function openMobileEdit(event: StudioScheduleEvent, originEl?: HTMLElement) {
    hapticTick(); // 카드 탭 손맛(Android만; iOS·미지원은 조용히 무시)
    mobileEditOriginRef.current = originEl?.getBoundingClientRect() ?? null;
    selectEvent(event);
    setMobileEditId(event.id);
  }
  function openMobileAdd(isoDate: string, originEl?: HTMLElement) {
    mobileEditOriginRef.current = originEl?.getBoundingClientRect() ?? null;
    selectDate(isoDate); // 빈 폼 또는 같은 날짜의 임시 내용 복원까지 처리
    setMobileEditId("new");
  }
  function closeMobileEdit() {
    setMobileEditId(null);
    setSelectedEventId(null);
    setForm(createEmptyForm());
  }
  // X·손잡이·백드롭으로 닫을 때는 열림의 정확한 역방향 — 시트가 원래 카드 자리로 줄어들며
  // 돌아간다(B2). 드래그 닫기는 물리 그대로 아래로 슬라이드(훅이 처리), 뒤로가기·저장은 즉시.
  function closeMobileEditAnimated() {
    const el = mobileSheetRef.current;
    const origin = mobileEditOriginRef.current;
    if (!el || !origin || reduceMotionEnabled()) {
      closeMobileEdit();
      return;
    }
    const s = el.getBoundingClientRect();
    if (s.width === 0 || s.height === 0) {
      closeMobileEdit();
      return;
    }
    el.style.transformOrigin = "top left";
    let anim: Animation;
    try {
      anim = el.animate(
        [
          { transform: "none", borderRadius: "22px 22px 0 0", opacity: 1 },
          {
            transform: `translate(${origin.left - s.left}px, ${origin.top - s.top}px) scale(${
              origin.width / s.width
            }, ${Math.max(0.04, origin.height / s.height)})`,
            borderRadius: "12px",
            opacity: 0.3
          }
        ],
        { duration: 300, easing: "cubic-bezier(0.3, 0, 0.8, 0.15)", fill: "forwards" }
      );
    } catch {
      closeMobileEdit();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      closeMobileEdit();
    };
    anim.onfinish = finish;
    anim.oncancel = finish;
    window.setTimeout(finish, 380); // 안전망 — 이벤트 유실에도 반드시 닫힌다
  }
  // 모바일 편집 시트 '끌어서 닫기'(B1) — 손잡이·헤더를 잡고 아래로 쓸면 1:1로 따라오고,
  // 위로는 러버밴딩, 릴리스 속도/거리로 닫힘·복귀 결정. 닫힘 확정 순간 햅틱.
  const { sheetRef: mobileSheetRef, dragBind: mobileSheetDrag } = useSheetDragClose({
    onClose: closeMobileEdit
  });
  // B2(데스크톱, 최종형) — '빈 날짜에 새 일정 만들기'와 '기존 카드 수정'을 시각적으로 구분하려는
  // 시도(클릭한 카드의 잔상이 편집 패널로 날아가는 연출)를 두 차례 다듬어 봤지만, 디자인적으로
  // 짜치다는 피드백으로 롤백했다. 벤치마킹 결론도 같았다 — Linear/Notion/macOS(메일·캘린더) 계열
  // master-detail은 요소를 날리지 않는다: 리스트 쪽 선택 표시(이미 있는 선택 링)가 연결을 맡고,
  // 패널은 **내용만 짧게 전환**한다. 그래서 지금은 다른 일정으로 갈아탈 때 패널 내용이 6px
  // 아래에서 빠르게 떠오르는 절제된 전환(170ms)만 남겼다.
  // TODO(나중에): 새 일정 작성 vs 기존 일정 수정을 안 짜치게 구분할 좋은 방법이 생기면 구현하고
  // 싶다(예: 패널 헤더의 조용한 상태 표기, 폼 톤 미세 차이 등).
  const prevSelectedRef = useRef<string | null>(null);
  useEffect(() => {
    const prev = prevSelectedRef.current;
    prevSelectedRef.current = selectedEventId;
    // '전환'일 때만(처음 열림·닫힘 제외) — 열림은 패널 자체 등장 모션이 이미 있다.
    if (!selectedEventId || prev === null || prev === selectedEventId) return;
    if (isNarrow || reduceMotionEnabled()) return;
    const panel = document.querySelector<HTMLElement>(".event-editor-panel");
    try {
      panel?.animate(
        [
          { opacity: 0.5, transform: "translateY(6px)" },
          { opacity: 1, transform: "none" }
        ],
        { duration: 170, easing: "cubic-bezier(0.05, 0.7, 0.1, 1)" }
      );
    } catch {
      /* 장식 — 실패 무시 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);
  // B2(모바일): 시트가 무관한 위치에서 나타나지 않고, 탭한 그 카드 자리에서 자라난다
  // (matched geometry). 탭 순간의 카드 rect를 기억해 뒀다가 시트 마운트 직후 FLIP으로 재생.
  const mobileEditOriginRef = useRef<DOMRect | null>(null);
  useLayoutEffect(() => {
    if (mobileEditId === null) return;
    const el = mobileSheetRef.current;
    const origin = mobileEditOriginRef.current;
    if (!el || !origin || reduceMotionEnabled()) return;
    el.style.animation = "none"; // 기본 슬라이드업 대신 카드-morph로 등장
    el.style.transformOrigin = "top left";
    const s = el.getBoundingClientRect();
    if (s.width === 0 || s.height === 0) return;
    const spring =
      getComputedStyle(document.documentElement).getPropertyValue("--spring-smooth").trim();
    const frames: Keyframe[] = [
      {
        transform: `translate(${origin.left - s.left}px, ${origin.top - s.top}px) scale(${
          origin.width / s.width
        }, ${Math.max(0.04, origin.height / s.height)})`,
        borderRadius: "12px",
        opacity: 0.6
      },
      { transform: "none", borderRadius: "22px 22px 0 0", opacity: 1 }
    ];
    try {
      el.animate(frames, { duration: 440, easing: spring || "cubic-bezier(0.22, 0.61, 0.36, 1)" });
    } catch {
      try {
        el.animate(frames, { duration: 320, easing: "cubic-bezier(0.22, 0.61, 0.36, 1)" });
      } catch {
        // WAAPI 미지원이면 그냥 즉시 등장 — 기능엔 영향 없음.
      }
    }
    // 내용은 컨테이너가 자리를 잡은 뒤에 떠오른다(찌그러진 글자가 보이지 않게).
    const content = el.querySelector<HTMLElement>(".me-form");
    try {
      content?.animate([{ opacity: 0 }, { opacity: 0, offset: 0.45 }, { opacity: 1 }], {
        duration: 440,
        easing: "ease-out"
      });
    } catch {
      /* 장식 — 실패 무시 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobileEditId]);

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
                {/* 월 표기는 바로 아래 월 내비가 담당 — 중복·겹침 제거(사용자 요청). */}
                <span>편집실</span>
              </h1>
              {/* 로그아웃 — 저장됨 칩이 있던 우상단(3열) 자리. 편집실 톤과 어울리게.
                  로그아웃하면 익명 상태로 공개 포스터를 계속 본다(계정 바꾸려면 다시 로그인). */}
              {actor.isAuthenticated ? (
                <form className="m-head-logout" action="/api/auth/logout" method="post" data-act="logout">
                  <button
                    className="button"
                    data-act="logout"
                    onClick={() => startNav("로그아웃 중…")}
                    type="submit"
                  >
                    <LogOut aria-hidden="true" size={12} strokeWidth={2.5} />
                    로그아웃
                  </button>
                </form>
              ) : (
                <Link className="m-head-logout button" href="/login" data-act="login">
                  로그인
                </Link>
              )}
            </header>

            {/* P0-A11Y-1: 월 이동을 스와이프 없이도 — 보이는 ◀ ▶(44px 터치 타깃). 스와이프·키보드와
                같은 moveMonth 경로라 슬라이드/햅틱도 동일. */}
            <div aria-label="월 이동" className="m-month-nav" role="group">
              <button
                aria-label="이전 달"
                className="m-month-btn"
                onClick={() => moveMonth(-1)} data-act="month-prev"
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.5} />
              </button>
              <strong aria-live="polite">
                {view.year}년 {view.month}월
              </strong>
              <button
                aria-label="다음 달"
                className="m-month-btn"
                onClick={() => moveMonth(1)} data-act="month-next"
                type="button"
              >
                <ChevronRight aria-hidden="true" size={20} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* 인사이트 진입(개발자·관리자·매니저·작업자)은 아래 색상 필터 레일 맨 위로 옮겼다. */}

          <section
            className="agenda agenda-studio"
            onTouchEnd={onAgendaTouchEnd}
            onTouchStart={onAgendaTouchStart}
          >
            {/* 오른쪽 레일: (위) 인사이트 진입 버튼 + (아래) 색상 필터 — 같은 92px 폭으로 세로로 쌓는다(편집실). */}
            <div className="agenda-rail">
              {/* 역할 배지(시각 정보)는 색상 필터 위에. 모바일은 도구 카드가 없어 설정 목록도 이 팝오버에. */}
              {renderRoleBadge(true)}
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
                     data-act="agenda-legend-tag">
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
              {filtering ? (
                <button
                  className="agenda-legend-clear"
                  onClick={() => setTagFilters([])}
                  type="button"
                 data-act="agenda-legend-clear">
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
                 data-act="m-rail-insights">
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
                  data-flip-key={cell.isoDate}
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
                    {mark?.name ? (
                      <span className={`agenda-mark ${mark.isHoliday ? "holiday" : ""}`}>{mark.name}</span>
                    ) : null}
                    {dayEvents.length === 0 ? (
                      <span className="agenda-noevent">예정된 일정 없음</span>
                    ) : null}
                    {shownEvents.map((event) => {
                      const colors = eventColors(event);
                      const extraColors = eventExtraColors(event);
                      // 아직 안 풀린 최초공개는 편집실 목록에서도 내용을 가린다(방송 화면 유출 방지).
                      const { main, subs } = splitEventTitle(
                        teaserStillHidden(event) ? "???" : event.publicTitle
                      );
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
                            className={`agenda-event m-support${dimCls}${justSavedId === event.id ? " just-saved" : ""}${deletingIds.has(canonId(event.id)) ? " deleting" : ""}`}
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
                                   data-act="agenda-link">
                                    {event.supportKind === "period" ? "자세히 보기" : "도우러 가기"}
                                    <ExternalLink aria-hidden="true" size={13} />
                                  </a>
                                ) : null}
                                {/* 소유자·개발자는 전체 편집, 매니저는 업 도움 설정만 수정. 작업자는 읽기 전용. */}
                                {canEdit ? (
                                  <button
                                    className="m-support-edit"
                                    onClick={(e) => openMobileEdit(event, e.currentTarget)}
                                    type="button"
                                   data-act="m-support-edit">
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
                                {event.isSupport
                                  ? `${event.supportKind === "period" ? "📌" : "🌱"} ${teaserStillHidden(event) ? "???" : event.publicTitle}`
                                  : main}
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
                            {/* PR2: 막대 색(≤2)에 못 담은 추가 대분류 형식색 점 줄. PC·시청자와 동일하게
                                '마지막 서브 줄 오른쪽'에 함께 둔다 — 서브 빈 공간에 다 들어가면 같은 줄(별도
                                점 줄 없이 높이 절약), 안 들어가면 flex-wrap으로 점만 아래로. 서브가 없으면
                                따로 오른쪽 정렬 점 줄로. */}
                            {(() => {
                              const dots = !event.isSupport && extraColors.length > 0 ? (
                                <span className="pill-dots" aria-hidden="true">
                                  {extraColors.map((c, i) => (
                                    <i key={i} style={{ background: c.bgColor, borderColor: c.borderColor }} />
                                  ))}
                                </span>
                              ) : null;
                              const dotsInSub = dots && subs.length > 0;
                              return (
                                <>
                                  {!event.isSupport && subs.length > 0 ? (
                                    <ul className="agenda-subs">
                                      {subs.map((s, i) =>
                                        i === subs.length - 1 && dotsInSub ? (
                                          <li key={i} className="pill-sub-last">
                                            <span className="pill-sub-text">{s}</span>
                                            {dots}
                                          </li>
                                        ) : (
                                          <li key={i}>{s}</li>
                                        )
                                      )}
                                    </ul>
                                  ) : null}
                                  {dots && subs.length === 0 ? (
                                    <div className="agenda-meta">{dots}</div>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>
                        </>
                      );
                      return canEdit ? (
                        <button
                          className={`agenda-event m-event${dimCls}${tentCls}${justSavedId === event.id ? " just-saved" : ""}${deletingIds.has(canonId(event.id)) ? " deleting" : ""}`}
                          key={event.id}
                          onClick={(e) => openMobileEdit(event, e.currentTarget)}
                          type="button"
                         data-act="agenda-event">
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
                        onClick={(e) => openMobileAdd(cell.isoDate, e.currentTarget)}
                        type="button"
                       data-act="m-add-event">
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
                 data-act="m-io-tags">
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
            {/* (매니저 관리 접이는 멤버 관리 철수(2026-09-04, ADR-0018)로 제거.) */}
          </section>
        ) : null}

        {/* 하단 엄지존 액션레일 — 옛 '< >' 자리. 월 이동은 좌우 스와이프로(달력을 쓸면 넘어감).
            누르기 쉬운 핵심 버튼(미리보기·비공개)을 엄지 닿는 바닥에 모았다.
            계정변경(로그아웃)은 헤더 우상단으로 옮겼다(저장됨 칩이 있던 자리). */}
        <nav className="m-actionrail" aria-label="편집실 도구">
          {/* '오늘' — 시청자 화면과 같은 복귀 버튼(사용자 요청). 항상 미리보기 바로 왼쪽
              (비공개 버튼이 있는 역할은 그 사이) — 역할이 달라도 같은 자리라 근육기억 유지. */}
          <button
            className="button m-io-pill m-io-today"
            onClick={jumpTodayMobile}
            title={onTodayMonth ? "오늘 위치로" : "오늘이 있는 달로"}
            type="button"
           data-act="m-io-pill">
            <CalendarCheck aria-hidden="true" size={16} />
            오늘
          </button>
          {/* 오른쪽: 미리보기 / 시청자 화면 — 계정변경과 위치 swap. */}
          {isDeveloper ? (
            renderPreviewControl()
          ) : (
            <button className="button m-io-pill m-io-preview" onClick={() => enterViewerMode()} type="button" data-act="m-io-pill">
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
  // data-kind = 색 테마 스위치(장미↔보라) — 부품은 공유하고 변수만 갈아입는다(정형화).
  // ('업 도움 기간' 제목 줄은 제거 — 바로 위 종류 칩이 이미 무엇의 기간인지 말한다.)
  function renderSupportFields(editable: boolean) {
    return (
      <div className="support-fields" data-kind={form.supportKind}>
        <div className="support-duration">
          <div className="duration-chips">
            {SUPPORT_DURATIONS.map((opt) => {
              const end = addDaysIso(selectedDate, opt.days);
              const active = (form.endDateKey || selectedDate) === end;
              return (
                <button
                  className={active ? "active" : ""}
                  data-act="support-duration"
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
                 data-act="하루 줄이기">
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
                 data-act="하루 늘리기">
                  +
                </button>
              </div>
            </div>
          ) : (
            <div className="duration-slider">
              <div className="dslider-head">
                {/* 값이 '시작 ~ 종료'로 길어져 설명이 두 줄로 밀렸다 → 조작법은 바로 옆의
                    슬라이더·−/+ 버튼이 이미 말하고 있으므로 라벨은 대상만 말한다. */}
                <span>기간</span>
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
                 data-act="하루 줄이기">
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
                 data-act="하루 늘리기">
                  +
                </button>
              </div>
            </div>
          )}
        </div>
        <label className="support-link-field">
          <span className="support-link-label">
            <ExternalLink aria-hidden="true" size={13} />
            {form.supportKind === "period" ? "관련 링크 (선택)" : "업 도움 링크"}
          </span>
          <input
            className="support-link-input"
            disabled={!editable}
            inputMode="url"
            onChange={(event) =>
              setForm((current) => ({ ...current, supportUrl: event.target.value }))
            }
            placeholder={form.supportKind === "period" ? "관련 URL 붙여넣기 (https)" : "숲 게시글 URL 붙여넣기"}
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
             data-act="support-visit">
              <ExternalLink aria-hidden="true" size={13} />
              링크 열어 확인
            </a>
          ) : null}
        </label>
      </div>
    );
  }

  function renderSupportEditor() {
    // 달력 띠(2026-09-01 대개편): 마스터 토글 + 하위 라디오(3줄, '업 도움' 세 번 반복·들여쓰기)
    // 대신 종류 칩 두 개가 곧 스위치다 — 켜진 칩을 다시 누르면 끔, 다른 칩을 누르면 그 종류로.
    // 업 도움 = 장미, 기간 안내 = 보라(아래 필드까지 같은 테마 변수로 이어진다).
    return (
      <>
        {renderTentativeToggle()}
        <div aria-label="달력 띠" className="band-kind-row" role="group">
          {(
            [
              ["up", "🌱", "업 도움"],
              ["period", "📌", "기간 안내"]
            ] as const
          ).map(([kind, ic, label]) => {
            const on = form.isSupport && form.supportKind === kind;
            return (
              <button
                aria-pressed={on}
                className={`opt-chip band-kind ${kind}${on ? " on" : ""}`}
                disabled={!canEdit}
                key={kind}
                onClick={() => {
                  hapticTick();
                  setForm((current) => ({
                    ...current,
                    isSupport: !(current.isSupport && current.supportKind === kind),
                    supportKind: kind
                  }));
                }}
                type="button"
                data-act="support-kind"
              >
                <span aria-hidden="true" className="opt-chip-ic">{ic}</span>
                <span className="opt-chip-label">{label}</span>
              </button>
            );
          })}
        </div>
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
       data-act="미정 표시">
        <span className="opt-chip-ic" aria-hidden="true">🕗</span>
        <span className="opt-chip-label">아직 확정 아님</span>
      </button>
    );
  }

  function renderMobileEditSheet() {
    return (
      <div
        className="m-edit-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeMobileEditAnimated();
        }}
        role="presentation"
        style={vvFit ? { height: vvFit.h, top: vvFit.top, bottom: "auto" } : undefined}
      >
        <div
          className="m-edit-sheet"
          aria-modal="true"
          ref={mobileSheetRef}
          role="dialog"
          style={vvFit ? { maxHeight: Math.round(vvFit.h * 0.96) } : undefined}
        >
          {/* 손잡이+헤더를 하나의 불투명 sticky 블록으로 — 스크롤 시 그 사이로 뒤 내용이
              비쳐 '뚫리는' 구간이 안 생긴다(아래로 쓸어 닫는 모바일 표준 어포던스).
              여기가 '끌어서 닫기'의 그립 존이다(폼 스크롤과 충돌 안 함). */}
          <div className="m-sheet-top" {...mobileSheetDrag}>
            <button
              className="m-sheet-grab"
              data-act="close-sheet-grab"
              aria-label="닫기"
              onClick={closeMobileEditAnimated}
              type="button"
            >
              <span aria-hidden="true" />
            </button>
            <div className="m-edit-head">
              <strong>{selectedEventId ? "수정" : "신규"}</strong>
              <span className="m-edit-date">{selectedDate}</span>
              <button
                aria-label="닫기"
                className="m-edit-x"
                onClick={closeMobileEditAnimated}
                type="button"
               data-act="닫기">
                <X aria-hidden="true" size={20} />
              </button>
            </div>
          </div>

          {actionError ? <div className="auth-warning">{actionError}</div> : null}

          {/* 아직 안 풀린 최초공개 일정 — 시트 껍데기는 그대로, 속만 비번 게이트로. */}
          {teaserGateActive ? (
            <div className="me-form teaser-gate-sheet">{renderTeaserGate()}</div>
          ) : (
          <form
            className="me-form"
            onInput={() => {
              editorTypedRef.current = true; // 여닫기 계측: 이 카드에서 뭔가 입력했다
            }}
            onSubmit={(e) => {
              saveEvent(e);
              setMobileEditId(null);
            }}
          >
            {draftRestored ? (
              <div className="draft-restored" role="status">
                <span>저장 안 한 임시 내용을 불러왔어요.</span>
                <button className="draft-restored-discard" onClick={discardDraft} type="button" data-act="draft-restored-discard">
                  새로 쓰기
                </button>
              </div>
            ) : null}

            {/* 제목 — 무테 큰 입력. 화면의 초점. 첫 줄 제목, 다음 줄부터 세부(규칙은 아래 helper). */}
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
            {renderTitleHelper()}

            {/* 설정 그룹 카드 — 옵션(미정·업 도움·최초공개)을 한 카드에 묶어 목록처럼.
                P1-FLOW-1(Quick Add): 데스크톱과 동일하게 기본 접힘 — 대부분의 일정이 '옵션 없음'이라,
                첫 생성 흐름은 제목→태그→저장만 보이게 한다. 접힌 헤더에 현재 값 요약(scopeFoldSummary)을
                항상 보여줘 접기가 정보를 숨기지 않는다. (공개 범위 선택은 2026-08-27 철수.) */}
            <div className={`me-group me-fold${scopeFoldOpen ? " open" : ""}`}>
              <button
                aria-expanded={scopeFoldOpen}
                className="me-fold-head"
                onClick={() => {
                  hapticTick();
                  setScopeFoldOpen((v) => !v);
                }}
                type="button"
               data-act="me-fold-head">
                <span className="me-row-label">옵션</span>
                <span className="me-fold-summary">{scopeFoldSummary}</span>
                <ChevronDown aria-hidden="true" className="me-fold-chev" size={16} />
              </button>
              {scopeFoldOpen ? (
              <div className="me-fold-body">
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
                   data-act="opt-chip">
                    <span className="opt-chip-ic" aria-hidden="true">🔮</span>
                    <span className="opt-chip-label">일정 최초공개</span>
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

            {/* 태그 그룹 — 대분류→세부 드릴다운 + 검색(2계층). 카드 색은 대분류로 ≤2 표시. */}
            <section className="me-group me-tag-group" aria-label="태그 선택">
              <div className="me-grouphead">
                <span className="me-grouptitle">
                  태그{" "}
                  <b className="tp-count" title={`최대 ${maxEventTags}개까지 고를 수 있어요`}>
                    {form.tagIds.length}/{maxEventTags}
                  </b>
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

            {/* 이용 기록(개발자 전용) — 보조 도구. 웹 팝오버와 동일 규칙: '날짜(새 일정) 선택'일
                때만 노출(기존 일정 수정 시트에선 숨김). (숲 '공지 쓰기'는 2026-08-27 제거 —
                관리자가 안 쓰는 기능.) */}
            {selectedEventId ? null : isDevInsights ? (
              <div className="me-tools">
                <button className="me-tool" onClick={() => setModal("dayVisit")} data-act="open-day-visit" type="button">
                  📈 이용 기록
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
                 data-act="이 일정 삭제">
                  <Trash2 aria-hidden="true" size={18} />
                </button>
              ) : null}
              <button
                className="button primary m-save"
                disabled={!form.publicTitle.trim()}
                type="submit"
               data-act="m-save">
                <Save aria-hidden="true" size={18} />
                저장
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    );
  }

  // 시청자 화면 전체보기: 스튜디오 UI를 숨기고 공개 화면만 그대로 보여준다.
  if (viewerMode) {
    // P0-SEC-2: 미리보기는 **서버 공개 스냅샷만** 쓴다. 예전엔 편집실 낙관적 events를 공개
    // 모양으로 spread 재가공했는데, 그 경로는 공개 로더의 떡밥(teaser) 가림을 우회해 공개
    // 시각 전의 실제 제목이 방송 화면(같이보기)에 노출될 수 있었다. 신선도는 미리보기를 열
    // 때마다 서버 액션으로 새 스냅샷을 받아(previewSnapshot) 보완한다 — 저장이 끝난 변경은
    // 즉시 반영되고, 아직 저장 중인 변경만 잠깐 이전 상태로 보인다(저장 완료 시 자동 갱신 아님,
    // 재진입 시 갱신).
    const previewSchedule = previewSnapshot ?? schedule.viewerModePreview;
    // 편집실/꾸미기 이동 버튼 — 웹은 포스터 위 오버레이로, 모바일은 포스터 제목 헤더 안으로 주입한다.
    const previewNav = (
      <>
        <button
          aria-label="편집실로 가기"
          className="button"
          data-act="back-to-studio"
          onClick={() => setViewerMode(false)}
          title="편집실로 가기"
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={16} />
          <span className="lbl">{isNarrow ? "편집실" : "편집실로 가기"}</span>
        </button>
        {/* 일정 그림판(B안) — owner/developer 전용, PC 전용. 공개 스냅샷만 쓰는 안전한
            미리보기 컨텍스트에서만 연다. 실제 공개 페이지·export surface엔 이 버튼이 없다. */}
        {(canEdit || isDeveloper) && !isNarrow ? (
          <button
            aria-label="일정 그림판"
            className="button"
            data-act="open-drawing-board"
            onClick={(e) => openBroadcastPanel(e.currentTarget)}
            title="일정 그림판"
            type="button"
          >
            <span aria-hidden="true">🖊️</span>
            <span className="lbl">일정 그림판</span>
          </button>
        ) : null}
      </>
    );
    return (
      // 방금 편집하고 넘어온 순간엔 화면에 있는 게 아직 '저장 전 스냅샷'이다. 그대로 또렷하게
      // 그렸다가 새 스냅샷으로 갈아끼우면 내용이 툭 바뀌어 깜빡임(혹은 잠깐 빈 카드)으로 읽힌다.
      // 새 스냅샷이 올 때까지만 살짝 눌러 두고, 도착하면 제자리에서 또렷해진다.
      <div className="viewer-fullscreen" data-preview-warming={previewWarming ? "" : undefined}>
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
        {/* 아바타 자리: 미리보기는 시청자 화면 그대로(포스터 자체 상태, 켜기/끄기 토글 유지).
            편집실 작업화면은 항상 켜짐(좌/우만)이라 controlled 공유를 끊었다 — vic_avatar_side
            localStorage 키는 여전히 공유돼 좌/우 선택은 양쪽에서 이어진다. */}
        <PublicPoster
          // 하트 세션 델타의 소유자 — 같은 브라우저 탭에서 개발자→관리자처럼 계정을 바꿔 미리보기를
          // 열면 이전 계정의 낙관적 하트가 섞이지 않게 계정별로 나눈다(accountSwitch가 아니라 표시 없음).
          accountEmail={actor.email}
          avatarSlot={avatarRoleOk}
          initialMonth={view.month}
          initialNarrow={isNarrow}
          initialYear={view.year}
          onViewChange={(year, month) => setView({ year, month })}
          previewNav={previewNav}
          schedule={previewSchedule}
          // "n명이 기다렸어요" 배지는 당분간 개발자 확인용만(사용자 결정 — 카운팅은 쌓되
          // 관리자·시청자에겐 아직 비노출). 역할 미리보기(effectiveRole)가 아니라 실제 역할 기준.
          showHopeBadge={actor.role === "developer"}
          toggleHeartAction={toggleEventHeartAction}
        />
        {broadcastOpen ? (
          <BroadcastPanel
            cells={broadcastCells}
            days={broadcastDays}
            monthLabel={`${bcYear}년 ${bcMonth}월`}
            onClose={closeBroadcastPanel}
            onMonthNav={navBroadcastMonth}
            onRemoveDay={removeBroadcastDay}
            onRestoreSent={(keys) => setBroadcastSent([...keys])}
            onSend={handleBroadcastSend}
            sentDateKeys={broadcastSent}
          />
        ) : null}
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
    </section>
  );

  // 도구 카드(2026-09-03 배치 대개편) — 옛 액션바(두 번째 크롬 행)의 관리 3종 + 단축키를 서쪽 rail로.
  // 방위 규칙(CLAUDE.md Owner-fit palette rule): 서=금=도구. 30일 사용 0~2회(콜드 존)라 아이콘+짧은
  // 라벨 타일이면 충분하고, 달력(핫 존)은 액션바 행 높이만큼 세로를 얻는다. 역할 분기는 옛 액션바와
  // 동일, data-act 키도 동일(인사이트 집계 연속). 아바타 scene이면 rail [필터|도구|아바타 자리],
  // 아니면 .studio-left-panel의 필터 아래. 2026-08의 '관리 3종 드롭다운 접기 철회'는 접지 않는 타일로 존중.
  // 2026-09-04: '멤버 관리' 타일은 빠지고(토리님이 안 쓰는 기능 — 설정 팝오버 맨 아래의 조용한 입구로 강등)
  // 그 자리에 **설정(톱니)** — 스위치 4종·포스터 테마 등 앞으로 생길 설정 전부의 단일 입구. 설정은 역할과
  // 무관하게 편집실의 모두에게 있으므로 카드는 항상 그린다(다른 타일은 역할 분기 그대로).
  const showManageTools = canEdit || (isDeveloper && !previewRole);
  const studioToolsPanel = (
    <div className="studio-tools-wrap">
      <div className="studio-tools" role="group" aria-label="도구">
        {showManageTools && canEdit && taxonomyV3 ? (
          <button
            className="stool stool-tags"
            data-act="manage-tags"
            onClick={() => (blockedByPreview() ? null : setModal("tags"))}
            type="button"
          >
            <Tags aria-hidden="true" size={18} />
            <span>태그 편집</span>
          </button>
        ) : null}
        {showManageTools ? (
          (isDeveloper && !previewRole) || canMemberInsights ? (
            <button
              className="stool stool-insights"
              data-act="manage-insights"
              onClick={() => setModal("developer")}
              type="button"
            >
              <ChartColumn aria-hidden="true" size={18} />
              <span>인사이트</span>
            </button>
          ) : null
        ) : canMemberInsights ? (
          <button
            className="stool stool-insights"
            data-act="io-insights"
            onClick={() => setModal("developer")}
            type="button"
          >
            <ChartColumn aria-hidden="true" size={18} />
            <span>인사이트</span>
          </button>
        ) : null}
        {canEdit ? (
          <button
            aria-expanded={kbdHintsOpen}
            className={`stool stool-kbd${kbdHintsOpen ? " open" : ""}`}
            data-act="kbd-hints-btn"
            onClick={() => {
              hapticTick();
              setKbdHintsOpen((v) => !v);
            }}
            type="button"
          >
            <Keyboard aria-hidden="true" size={18} />
            <span>단축키</span>
          </button>
        ) : null}
        {/* 설정 — 태그 편집·인사이트와 같은 모달 창(사용자 2026-09-04: 팝오버 금지). */}
        <button
          aria-haspopup="dialog"
          className={`stool stool-settings${modal === "settings" ? " open" : ""}`}
          data-act="studio-settings"
          onClick={() => {
            hapticTick();
            setModal("settings");
          }}
          type="button"
        >
          <Settings aria-hidden="true" size={18} />
          <span>설정</span>
        </button>
      </div>
    </div>
  );

  return (
    <main
      className={`studio-shell${avatarSceneOn ? ` avatar-scene avatar-${avatarSide}` : ""}${
        avatarReady ? "" : " avatar-no-anim"
      }`}
      data-chrome={chromeTier || undefined}
      ref={setShellRef}
    >
      {/* 아바타 rail — 하나의 fixed flex-column 박스에 [색상필터(위, 스크롤) | 아바타(아래, 고정비율)].
          flex-column이라 둘이 절대 안 겹친다. scene일 때만 필터를 여기 담는다. */}
      {avatarEditor ? (
        <aside className="avatar-rail" aria-label="아바타 자리 영역(관리자 전용)">
          {avatarSceneOn ? <div className="avatar-rail-filter">{studioFilterPanel}</div> : null}
          {/* 서쪽 도구 카드 — 필터와 아바타 자리 사이(2026-09-03 배치 대개편). */}
          {avatarSceneOn ? studioToolsPanel : null}
          <div className="avatar-slot">
            <div className="avatar-dock-inner">
              {/* 배경 감상 진입(2026-09-04 사용자: "누가 봐도 한 번 눌러보고 싶게, 설정 밖에") — 빈 아바타 자리 위쪽의
                  큰 계절 버튼. 슬롯은 pointer-events:none이라 버튼만 되살린다(CSS .slot-showcase). */}
              {/* [감상하기 | 배경 흐리게/끄기/켜기] — 시청자 레일과 같은 묶음(2026-09-04 사용자: 설정 열지 않고 바꾸기). onChange가
                  설정의 셀렉트·배경 효과 잠금과 같은 경로(changeAmbientMode)를 타서 설정 안 상태와 한 몸. */}
              <ViewerAmbientControl className="slot-showcase" season={ambientSeason} onChange={changeAmbientMode} />
              {/* 좌/우 세그먼트는 하단 중앙 플로팅 행(bottom-float-row)에 — 박스 안에 두면 rail과 함께
                  반대편으로 이동해 되돌릴 때 마우스 왕복이 화면 폭만큼(2026-09-03 사용자). */}
              {/* ("아바타 자리" 안내 글자는 2026-09-04 사용자 결정으로 제거 — 빈 자리 자체가 안내. aria-label은 aside에.) */}
            </div>
          </div>
        </aside>
      ) : null}
      {copyToast ? (
        <div className="copy-toast" role="status" aria-live="polite">
          {copyToast}
        </div>
      ) : null}
      {/* P0-DATA-1: 삭제 스낵바 — 8초 동안 그 자리에서 실행 취소(터치 포함, Ctrl+Z와 같은 복구). */}
      {deleteSnack ? (
        <div className="delete-snack" role="status" aria-live="polite">
          <span className="delete-snack-title">
            &lsquo;{deleteSnack.event.publicTitle.split("\n")[0] || "일정"}&rsquo; 삭제됨
          </span>
          <button
            className="delete-snack-undo"
            onClick={() => {
              hapticTick();
              // Ctrl+Z 스택에서도 이 항목을 걷어낸다(스낵바로 복구했는데 Ctrl+Z가 또 복구 시도 방지).
              const stack = deletedStackRef.current;
              const idx = stack.findIndex(
                (a) => a.type === "recreate" && a.event.id === deleteSnack.event.id
              );
              if (idx >= 0) stack.splice(idx, 1);
              // 스낵바 복구도 '삭제의 실행취소' — 다시 실행(Ctrl+Shift+Z)하면 재삭제되게 적재.
              redoStackRef.current.push({
                type: "remove",
                holder: { id: canonId(deleteSnack.event.id) }
              });
              restoreDeletedEvent(deleteSnack.event);
            }}
            type="button"
           data-act="delete-snack-undo">
            실행 취소
          </button>
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
      {/* 앰비언트 배경(ADR-0016 물결 + ADR-0017 계절, components/shared/ambient — 시청자 화면도 같은
          컴포넌트). 물결은 제 배경이 없는 완전 투명 컨테이너라 body의 아이보리(--paper) 위에 옅은 결만
          얹고("모래 위 얕은 물결"), 오늘(KST) 계절 레이어가 그 위에. 보이는 조건은 CSS가 판단
          (app/metal-water.css `.gs-tide`, app/ambient.css `.gs-season`). */}
      <AmbientLayer force={ambientForce} month={view.month} />
      <header className="studio-topbar">
        {/* 왼쪽 칸: 큰 제목 + 그 옆에 배포 버전 배지(헤더 세로 중앙, 클릭=버전 복사). */}
        <div className="studio-left">
          {/* "✨ 빅토리 일정표 ✨" 제목은 시청자 화면(.poster-chrome-title)에만(2026-09-04 사용자) — 편집실 북서는 배포 버전 배지만
              왼쪽 정렬. 문서 제목(document.title)은 그대로. */}
          <button
            aria-label={`배포 버전 ${buildSha} 복사`}
            className={`studio-build-tag studio-build-copy${isDevInsights ? " dev" : ""}`}
            title="클릭하면 버전이 복사돼요"
            type="button"
            onClick={copyBuildSha}
           data-act="배포 버전 복사">
            {buildCopied ? "복사됨 ✓" : buildSha}
          </button>
        </div>

        {/* 가운데: ‹ 현재 월 › — 월 이동을 헤더로(사용자 요청, 하단 플로팅 < > 폐지).
            키보드 ←/→ 도 그대로. 텍스트만 key 재마운트 → 방향대로 살짝 슬라이드. */}
        <nav className="studio-month-label" aria-label="월 이동">
          <button
            aria-label="이전 달"
            className="month-nav-btn"
            onClick={() => moveMonth(-1)} data-act="month-prev"
            title="이전 달 (←)"
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={22} />
          </button>
          <strong data-enter={monthDir} key={`${view.year}-${view.month}`}>
            {view.year}년 {view.month}월
          </strong>
          <button
            aria-label="다음 달"
            className="month-nav-btn"
            onClick={() => moveMonth(1)} data-act="month-next"
            title="다음 달 (→)"
            type="button"
          >
            <ChevronRight aria-hidden="true" size={22} />
          </button>
        </nav>

        {/* 오른쪽: 역할·도구. 배포 버전(위)+저장됨(아래) 캡슐을 역할 배지 왼쪽에 세로로 —
            모바일 헤더의 캡슐 문법과 통일(메타는 작고 조용, 저장 상태가 주). */}
        <div className="studio-role-tools">
          {/* 배포 버전 배지는 왼쪽 데스크 라벨 아래로 이사 — 여기는 저장 상태 칩만.
              칩의 아래 끝선은 역할 배지 버튼의 아래 끝선과 맞춘다(.studio-meta-capsule). */}
          <div className="studio-meta-capsule">{renderSaveStatus()}</div>
          {/* 계정 모서리(북동, 2026-09-03 배치 대개편): 역할 배지("?" 권한 팝오버)는 미리보기 버튼 **왼쪽**
              (사용자 지정 순서: 저장 상태 · 관리자 · 시청자 화면 보여주기 · 로그아웃). 관리 도구·설정은 서쪽 rail. */}
          {renderRoleBadge(false)}
          {/* 역할 배지·로그아웃은 액션바 오른쪽(단축키 옆)으로 이사(2026-08-27 사용자 지정 배치) —
              헤더는 저장 상태 + 미리보기만. */}
          {/* 미리보기 안내는 역할 배지("?") 설명 팝오버 안 작은 문구로 일원화(별도 플래그 제거). */}
          {/* 개발자는 역할 미리보기 드롭다운, 그 외 역할은 시청자 화면 미리보기. */}
          {isDeveloper ? (
            renderPreviewControl()
          ) : (
            <button
              aria-label={isEffectivelyOwner ? "시청자 화면 보여주기" : "시청자 화면 미리보기"}
              className="button io-accent io-preview"
              onClick={() => enterViewerMode()}
              title={isEffectivelyOwner ? "시청자 화면 보여주기" : "시청자 화면 미리보기"}
              type="button"
              data-act="io-preview"
            >
              <Eye aria-hidden="true" size={16} />
              {/* '보여주기'는 관리자(owner)만 — 그 외 역할 미리보기는 '미리보기'. ≤1560px·압축 1단계에선 짧은 라벨,
                  2단계부턴 눈 아이콘만(aria-label/title이 이름을 지킨다) — studio-calm-layer.css ⑤. */}
              <span className="lbl-long">{isEffectivelyOwner ? "시청자 화면 보여주기" : "시청자 화면 미리보기"}</span>
              {/* 짧은 라벨은 "시청자 화면"(2026-09-04 사용자의 모바일 카피 규칙과 동일 — 가장 짧게 통하는 이름). */}
              <span className="lbl-short">{isEffectivelyOwner ? "시청자 화면" : "미리보기"}</span>
            </button>
          )}
          {actor.isAuthenticated ? (
            <form action="/api/auth/logout" method="post">
              <button
                aria-label="로그아웃"
                className="button io-accent io-logout"
                onClick={() => startNav("로그아웃 중…")}
                title="로그아웃"
                type="submit"
                data-act="io-logout"
              >
                {/* 압축 2단계부턴 아이콘만(studio-calm-layer.css ⑤). */}
                <LogOut aria-hidden="true" size={16} />
                <span className="lbl">로그아웃</span>
              </button>
            </form>
          ) : (
            <Link className="button" data-act="login" href="/login">
              로그인
            </Link>
          )}
        </div>
      </header>

      {/* 하단 중앙 플로팅 행 — 아바타 좌/우 세그먼트(항상, 관리자·개발자) + 확대 배율 컨트롤(필요할 때만).
          아바타 세그먼트가 여기 사는 이유(2026-09-03 사용자): rail 안에 두면 rail이 반대편으로 옮겨갈 때
          버튼도 같이 가서 되돌리려면 화면 폭만큼 마우스를 왕복해야 했다. 화면 중앙 고정 = 어느 쪽에서든
          같은 거리(Fitts). 남쪽이라 색은 은백 고스트(뜨거운 강조 없음). (비공개 경고 알약은 2026-08-27 철수.) */}
      {avatarEditor || zoomCollapse ? (
        <div className="bottom-float-row" ref={bottomRowRef}>
          {avatarEditor ? (
            <div className="studio-avatar-ctl" role="group" aria-label="아바타 자리 설정">
              <button
                type="button"
                className={avatarSide === "left" ? "on" : ""}
                aria-label="아바타 왼쪽에 두기"
                aria-pressed={avatarSide === "left"}
                onClick={() => pickAvatarSide("left")}
                data-act="avatar-ctl-toggle"
              >
                <ArrowLeftToLine aria-hidden="true" size={18} strokeWidth={2.4} />
              </button>
              <span aria-hidden="true" className="avatar-ctl-label">
                아바타 자리
              </span>
              <button
                type="button"
                className={avatarSide === "right" ? "on" : ""}
                aria-label="아바타 오른쪽에 두기"
                aria-pressed={avatarSide === "right"}
                onClick={() => pickAvatarSide("right")}
                data-act="avatar-ctl-toggle"
              >
                <ArrowRightToLine aria-hidden="true" size={18} strokeWidth={2.4} />
              </button>
            </div>
          ) : null}
          {zoomCollapse ? <div className="cal-zoom-float">{renderCalZoomCtl()}</div> : null}
        </div>
      ) : null}

      <ShowcaseExit />

      {/* #9 키보드 단축키 안내바 — canEdit(소유자). 토글은 위 액션바의 버전 박스 안에 있고, 기본은
          접혀 있어 이 바가 안 나온다 → 액션바 바로 아래로 달력이 온다(높이 최적화). 펼치면 여기 뜬다. */}
      {canEdit && kbdHintsOpen ? (
        // 한 줄 칩 흐름 유지. 설명은 라벨 수준으로 짧게 — 키가 주인공이고 문장은 잡음이다.
        <div className="kbd-hints" aria-label="키보드 단축키 안내">
          <span><kbd>Alt</kbd>+<kbd>N</kbd> 새 일정</span>
          <span><kbd>Ctrl</kbd>+<kbd>S</kbd> 저장</span>
          <span><kbd>Del</kbd> 삭제</span>
          <span><kbd>Ctrl</kbd>+<kbd>Z</kbd> 되살리기</span>
          <span><kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd> 복붙</span>
          <span><kbd>우클릭 드래그</kbd> 잇기</span>
          <span><kbd>우클릭 긋기</kbd> 끊기</span>
          <span><kbd>드래그</kbd> 범위 선택</span>
          <span><kbd>Ctrl</kbd>+클릭 다중 선택</span>
          <span><kbd>Ctrl</kbd>+<kbd>휠</kbd> 달력 확대</span>
          <span><kbd>←</kbd><kbd>→</kbd> 이동</span>
          <span><kbd>Esc</kbd> 닫기</span>
        </div>
      ) : null}

      <section
        className={`studio-workspace ${editorVisible ? "editor-open" : ""}`}
        ref={workspaceRef}
      >
        {/* 아바타 scene에선 색상필터가 우측 rail로 가므로 좌측 칸은 비운다(칸 폭도 0). */}
        <aside className="studio-left-panel">
          {avatarSceneOn ? null : (
            <>
              {studioFilterPanel}
              {studioToolsPanel}
            </>
          )}
        </aside>

        <section
          className="studio-calendar-panel"
          data-compact={titleCompact ? "" : undefined}
          data-zoomed={calZoom > 1 ? "" : undefined}
          ref={calPanelRef}
          style={{ "--cal-zoom": calZoom } as CSSProperties}
        >
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
            {(() => {
              // P0-A11Y-1 roving focus: 42칸이 각자 탭 스톱이면 키보드로 달력을 '건너서' 편집
              // 패널에 가는 데 42번의 Tab이 필요했다. 탭 스톱은 한 곳(선택된 날짜, 없으면 이 달
              // 1일)만 두고, 칸 사이 이동은 화살표(±1/±7)·Home/End(주 시작/끝)로 한다(APG grid).
              const selIdx = cells.findIndex((c) => c.isoDate === selectedDate);
              const rovingIdx = selIdx >= 0 ? selIdx : cells.findIndex((c) => c.inCurrentMonth);
              const focusCell = (idx: number) => {
                const clamped = Math.max(0, Math.min(cells.length - 1, idx));
                document
                  .querySelector<HTMLElement>(
                    `.studio-month-grid [data-cell-index="${clamped}"]`
                  )
                  ?.focus();
              };
              // 화살표는 '날짜' 기준으로 움직인다 — 이 달 마지막 날에서 →를 누르면 다음 달로
              // 자연스럽게 이어진다(달 전환 후 그 날짜에 포커스 복원, APG date grid 관례).
              const focusByDate = (fromIso: string, deltaDays: number) => {
                const target = addDaysIso(fromIso, deltaDays);
                const targetMonth = target.slice(0, 7);
                const viewMonth = `${view.year}-${String(view.month).padStart(2, "0")}`;
                if (targetMonth !== viewMonth) {
                  pendingFocusDateRef.current = target;
                  moveMonth(deltaDays > 0 ? 1 : -1);
                  return;
                }
                document
                  .querySelector<HTMLElement>(`.studio-month-grid [data-isodate="${target}"]`)
                  ?.focus();
              };
              return cells.map((cell, cellIndex) => {
              const covering = getEventsForDate(liveEvents, cell.isoDate);
              const supportHere = covering.filter((e) => e.isSupport);
              const dateEvents = covering.filter((e) => !e.isSupport);
              // 드롭 위치 프리뷰(그림판 레이어 문법) — 삽입선 대신 형제 카드가 미끄러져
              // 빈 칸이 열린다. liIdx = 이 칸에서 놓일 인덱스(이 칸이 드롭 대상일 때만).
              let liIdx: number | null = null;
              if (dragEventId && dropSlot && dropSlot.day === cell.isoDate) {
                // 끈(이어진 일정)은 위에 고정 — 그 아래로만 들어간다.
                const connectedCount = dateEvents.filter((e) => isConnectedEvent(e)).length;
                let li: number;
                if (!dropSlot.overId) {
                  li = dateEvents.length;
                } else {
                  const oi = dateEvents.findIndex((e) => canonId(e.id) === canonId(dropSlot.overId!));
                  li = oi < 0 ? dateEvents.length : dropSlot.after ? oi + 1 : oi;
                }
                liIdx = Math.max(li, connectedCount);
              }
              // 드래그 중이면 이 칸의 모든 후보 자리에 스페이서를 미리 깔아 둔다(아래 주석 참조).
              // 이름이 겹치지 않게 dropActive — 상단의 dragActiveRef(포인터 상태)와 별개다.
              const dropActive = dragEventId !== null && dragChipH > 0;
              const dropGapH = Math.max(0, dragChipH - 5 * calZoom);
              // 놓을 자리가 '원래 있던 그 자리'면 도착 표시를 열지 않는다 — 같은 공간을 두 표시가
              // 겹쳐 가리키면 뭘 하려는지 오히려 흐려진다. 그땐 보라 '원래 위치'만 남는다
              // (사용자 결정 2026-08-05). 자리를 벗어나는 순간 도착 표시가 다시 열린다.
              const srcIdxHere = dragEventId
                ? dateEvents.findIndex((e) => canonId(e.id) === canonId(dragEventId))
                : -1;
              const dropIsNoop =
                srcIdxHere >= 0 && liIdx !== null && (liIdx === srcIdxHere || liIdx === srcIdxHere + 1);
              const gapOpen = (idx: number) => liIdx !== null && liIdx === idx && !dropIsNoop;
              const day = classifyDay(cell.isoDate, cell.weekday, today);
              const visibleDayMark = getDayMark(cell.isoDate);
              // 이 칸을 실제로 지나는 띠의 최고 레인 깊이만큼만 위 여백을 둔다(띠 없는 칸은 0).
              // 레인 번호가 절대 위치(top: lane×20)라 '개수'가 아니라 '최고 레인+1'이어야 한다:
              // 레인0 띠가 이 칸을 안 지나가도 레인1 띠가 지나가면 그 아래까지 비워야 한다.
              const cellLaneDepth = supportHere.reduce(
                (max, s) => Math.max(max, (supportLanes.lanes.get(s.id) ?? 0) + 1),
                0
              );

              const dayClass = [
                "studio-day",
                cell.inCurrentMonth ? "" : "outside",
                editorVisible && selectedDate === cell.isoDate ? "selected" : "",
                // 신규 작성 중이면 '날짜 칸'이 대상 — 팝오버 대표색(초록) 점선으로 칸을 두른다.
                // 기존 일정 편집 중에는 칸이 아니라 그 카드가 대상이라 칸 강조를 끈다(경쟁 방지).
                editorVisible && !selectedEventId && selectedDate === cell.isoDate
                  ? "editing-new"
                  : "",
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
                  // 안정 id(0062) — 없으면 aria-label에서 유추해 날짜마다 다른 id가 생기고
                  // 사용량 통계가 칸 수만큼 갈라진다("2026-08-04화요일" 같은 항목이 무한 증식).
                  data-act="calendar-cell"
                  aria-label={`${cell.isoDate} ${WEEKDAYS[cell.weekday]}요일${
                    dateEvents.length > 0 ? ` · 일정 ${dateEvents.length}개` : ""
                  }`}
                  style={isFirstReveal ? ({ "--ri": cellIndex } as CSSProperties) : undefined}
                  tabIndex={cellIndex === rovingIdx ? 0 : -1}
                  onKeyDown={(e) => {
                    // P0-A11Y-1 roving grid: 화살표로 칸 이동, Home/End=주 시작/끝, Enter/Space=선택.
                    // stopPropagation 필수 — ←/→는 전역 '월 이동' 단축키이기도 해서, 막지 않으면
                    // 칸 포커스 이동과 월 넘김이 동시에 일어난다(실측).
                    const nav: Record<string, number> = {
                      ArrowRight: 1,
                      ArrowLeft: -1,
                      ArrowDown: 7,
                      ArrowUp: -7
                    };
                    if (e.key in nav) {
                      // 마우스 클릭(선택 해제 등)으로 얻은 '조용한 포커스'(:focus-visible 아님)
                      // 에선 화살표를 전역 규칙(월 이동)에 양보한다 — 아무것도 선택 안 했는데
                      // 날짜 포커스가 움직여 달이 안 넘어가던 문제(사용자 지적). 키보드로
                      // 들어온 포커스(focus-visible)만 roving 이동.
                      if (!e.currentTarget.matches(":focus-visible")) return;
                      e.preventDefault();
                      e.stopPropagation();
                      focusByDate(cell.isoDate, nav[e.key]);
                      return;
                    }
                    if (e.key === "Home") {
                      e.preventDefault();
                      e.stopPropagation();
                      focusCell(cellIndex - (cellIndex % 7));
                      return;
                    }
                    if (e.key === "End") {
                      e.preventDefault();
                      e.stopPropagation();
                      focusCell(cellIndex - (cellIndex % 7) + 6);
                      return;
                    }
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      e.stopPropagation();
                      selectDate(cell.isoDate);
                    }
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
                    // 라벨은 '시작 칸'과 '주가 바뀐 첫 칸(일요일)'에만 — isEnd 라벨은 같은
                    // 줄에서 제목이 두 번 보였다. 글자는 sb-head로 오른쪽 띠 위로 흘러간다.
                    const showLabel = isStart || (!isStart && cellIndex % 7 === 0);
                    // 라벨 칸에서 이 주(週)에 띠가 몇 칸 이어지는지 — 1칸뿐이면(하루짜리,
                    // 일요일 종료 이어짐, 토요일 시작) 글자가 남의 날짜 위로 튄다(시청자 화면과
                    // 같은 2026-09-01 신고). 칸 안에서 끝나는 압축 모양(sb-solo)으로.
                    const remainDays = Math.round(
                      (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${cell.isoDate}T00:00:00Z`)) /
                        86_400_000
                    );
                    const segSpan = Math.min(Math.max(remainDays, 0), 6 - (cellIndex % 7)) + 1;
                    const solo = showLabel && segSpan <= 1;
                    return (
                      <div
                        // 필터를 켜면 일정 카드만 흐려지고 업 도움 끈은 쨍하게 남아, 안 고른 기간이
                        // 오히려 제일 눈에 띄었다(시청자 화면에서 같은 이유로 이미 고쳤다).
                        // 판정은 카드와 같은 isDimmedByFilter — 끈에 태그가 없으면 필터 켤 때 물러난다.
                        // 편집 중인 업 도움은 **묶인 띠 전체**를 장미색으로 두른다 — 이 끈은
                        // 여러 칸에 걸쳐 있어 한 조각만 강조하면 어디까지가 그 기간인지 안 보인다.
                        className={`support-bar${isDimmedByFilter(s) ? " filter-dim" : ""}${
                          showLabel ? " sb-head" : ""
                        }${solo ? " sb-solo" : ""}${s.supportKind === "period" ? " sb-period" : ""}${
                          editorVisible && selectedEventId === s.id ? " is-editing" : ""
                        }`}
                        data-supportid={s.id}
                        key={s.id}
                        title={s.publicTitle} /* 말줄임된 제목의 전문(호버 툴팁) */
                        /* 그룹 호버는 DOM 클래스 토글(lib/ui/band-hover) — React 상태였을 땐 띠 위를
                           지날 때마다 편집실 전체 리렌더(≈180ms 롱태스크, 2026-09-03 실측). */
                        onMouseEnter={(e) => setBandHover(e.currentTarget.closest(".studio-shell"), s.id, true)}
                        onMouseLeave={(e) => setBandHover(e.currentTarget.closest(".studio-shell"), s.id, false)}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectEvent(s);
                        }}
                        style={{
                          // 날짜 헤더가 --cal-zoom으로 커지므로 띠 시작 높이·레인 간격도 같이
                          // 배율 — 안 그러면 125%+에서 날짜 숫자와 띠가 겹친다.
                          top: Math.round((26 + lane * 20) * calZoom),
                          // 이어지는 칸은 -1px로 칸 경계선을 덮어 마디처럼 끊겨 보이지 않게.
                          left: left ? 3 : -1,
                          right: right ? 3 : -1,
                          borderTopLeftRadius: left ? 9 : 0,
                          borderBottomLeftRadius: left ? 9 : 0,
                          borderTopRightRadius: right ? 9 : 0,
                          borderBottomRightRadius: right ? 9 : 0
                        }}
                      >
                        {showLabel ? (
                          <span>
                            <i className="sb-sprout" aria-hidden="true">
                              {s.supportKind === "period" ? "📌" : "🌱"}
                            </i>
                            {solo ? <b className="sb-title">{s.publicTitle}</b> : s.publicTitle}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                  <div className="studio-day-head">
                    <strong className={numClass}>{cell.dayOfMonth}</strong>
                    {visibleDayMark?.name ? (
                      <em className="day-mark">
                        {visibleDayMark.name}
                      </em>
                    ) : null}
                  </div>
                  <div
                    className="studio-event-list"
                    style={{
                      ...(cellLaneDepth > 0
                        ? { paddingTop: Math.round((8 + cellLaneDepth * 20) * calZoom) }
                        : {}),
                      // (다른 날에서 들어오는 경우의 '자리 열기'는 아래 .drop-gap 스페이서가
                      //  실제 레이아웃으로 만든다 — paddingBottom+transform 조합은 칸을 못 늘려
                      //  맨 아래 카드가 칸 경계를 넘었다.)
                    }}
                  >
                    {/* 카드가 들어올 자리 — **실제 레이아웃 요소**로 연다. transform으로 밀면
                        칸(주 행) 높이가 안 자라 맨 아래 카드가 칸 경계를 넘어 다음 주까지
                        삐져나왔다(사용자 지적 2회). 스페이서는 그리드 자식이라 칸이 정확히
                        그만큼 자란다. 목록 gap이 이미 한 칸 들어가므로 높이에서 뺀다.
                        ⚠ 드래그 중에는 **모든 후보 자리에 높이 0짜리 스페이서를 미리 둔다**.
                        활성 자리에만 DOM을 만들면 삽입 위치가 바뀔 때마다 요소가 사라졌다 새로
                        생겨 카드가 툭툭 끊겨 뛴다(사용자 지적). 미리 두고 높이만 0↔H로 바꾸면
                        열림·닫힘이 CSS 전환으로 이어진다. */}
                    {dropActive ? (
                      <div
                        aria-hidden="true"
                        className={`drop-gap${gapOpen(0) || (liIdx !== null && liIdx < 0 && !dropIsNoop) ? " on" : ""}`}
                        style={{
                          height:
                            gapOpen(0) || (liIdx !== null && liIdx < 0 && !dropIsNoop) ? dropGapH : 0
                        }}
                      />
                    ) : null}
                    {dateEvents.map((event, eventIndex) => {
                      const colors = eventColors(event);
                      // PR2: 칸 색(≤2)에 못 담은 나머지 대분류 → 작은 점 줄("더 있음").
                      const extraColors = eventExtraColors(event);
                      // 선택 강조(테두리·X)는 오른쪽 편집/상세 패널이 열려 있을 때만 — 패널이
                      // 닫히면(다른 버튼으로 슬라이드-아웃) 카드 선택 표시도 함께 사라지게.
                      const isSel = editorVisible && selectedEventId === event.id;
                      // 연결된 체인이면 체인 전체에 선택 테두리를 입힌다.
                      const inSelChain = editorVisible && selectedChainIds.has(event.id);
                      // 아직 안 풀린 최초공개는 편집실 달력에서도 내용을 가린다(방송 화면 유출 방지).
                      const { main, subs } = splitEventTitle(
                        teaserStillHidden(event) ? "???" : event.publicTitle
                      );
                      const span = getEventSpan(
                        event,
                        cell.isoDate,
                        cell.weekday,
                        visibleEvents
                      );
                      // 체인 이음변(색 일치 여부 무관) — 칠(getEventSpan)은 색이 같을 때만
                      // 병합하지만, 선택·연결 후보 '하이라이트'는 체인 전체가 한 덩어리로
                      // 보여야 한다(사용자 결정). CSS가 .selected/.connect-target에서만 쓴다.
                      // ⚠ startsAt.slice는 UTC 날짜 — KST 셀 키와 어긋나 join/recoil 판정이
                      // 통째로 빗나갔다(대나무 마디 링의 진범). KST 정본 헬퍼 사용.
                      const evStartKey = getEventDateKey(event);
                      const evEndKey = event.endDateKey ?? evStartKey;
                      const joinRight =
                        cell.isoDate === evEndKey &&
                        Boolean(event.linkNext) &&
                        visibleEvents.some((o) => o.id === event.linkNext);
                      const joinLeft =
                        cell.isoDate === evStartKey &&
                        visibleEvents.some((o) => o.linkNext === event.id);
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
                        joinRight ? "link-join-right" : "",
                        joinLeft ? "link-join-left" : "",
                        draggable ? "draggable" : "",
                        dragEventId === event.id ? "dragging-src" : "",
                        isConnTarget ? "connect-target" : "",
                        isConnHover ? "connect-hover" : "",
                        connDim ? "connect-dim" : "",
                        // 끊김은 반동(스프링 분리)으로만 표현 — 사선 연출은 사용자 결정으로 제거.
                        cutFlashId === event.id && cell.isoDate === evEndKey
                          ? "cut-recoil-prev"
                          : "",
                        cutFlashNextId === event.id && cell.isoDate === evStartKey
                          ? "cut-recoil-next"
                          : "",
                        linkFlashIds.has(event.id) ? "just-linked" : "",
                        justSavedId === event.id ? "just-saved" : "",
                        deletingIds.has(canonId(event.id)) ? "deleting" : ""
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
                      // 자리 열기는 **항상** .drop-gap 스페이서가 맡는다(A안, 사용자 결정
                      // 2026-08-05) — 같은 칸이든 다른 칸이든 문법이 같다. 예전엔 같은 칸일 때만
                      // transform으로 형제를 밀었는데, 그러면 칸(주 행) 높이가 안 자라 맨 아래
                      // 카드가 칸 밖으로 나갔고 출발 점선('원래 위치')까지 같이 밀렸다.
                      // 지금: 보라 '원래 위치'는 제자리 고정, 민트 '놓을 자리'가 오르내린다.
                      const pillStyle =
                        mixStyle ?? (colors.length > 0 ? eventColorStyle(colors) : undefined);
                      // 이 카드 '다음' 자리(맨 끝 포함)에도 스페이서를 미리 둔다 — 활성일 때만
                      // 높이가 열린다. 삽입 위치가 옮겨가도 DOM이 유지돼야 전환이 이어진다.
                      const gapAfter = gapOpen(eventIndex + 1);
                      const gapEl = dropActive ? (
                        <div
                          aria-hidden="true"
                          className={`drop-gap${gapAfter ? " on" : ""}`}
                          key={`gap-${event.id}`}
                          style={{ height: gapAfter ? dropGapH : 0 }}
                        />
                      ) : null;
                      const pill = (
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
                          style={pillStyle}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            // target 가드: 카드 '자신'에 포커스가 있을 때만 — +N·삭제 같은
                            // 내부 버튼의 Enter가 카드까지 올라와 편집창을 동시에 여는 것 방지.
                            if (e.key === "Enter" && e.target === e.currentTarget) {
                              e.stopPropagation();
                              handlePillClick(event.id);
                            }
                          }}
                          // A안 M2: 확대 중 hover/focus로 상세 팝오버 — '숨은 내용'이 있을 때만.
                          // 숨은 내용 = 접힌 서브(+N) 또는 1줄 ellipsis로 잘린 제목(실측:
                          // scrollWidth > clientWidth). 다 보이는 카드는 팝오버가 중복 소음.
                          aria-describedby={
                            zoomPeek?.id === event.id ? "cal-zoom-peek" : undefined
                          }
                          onMouseEnter={
                            titleCompact && span.showTitle
                              ? (e) => {
                                  // 확대 모드에선 서브가 +N로 접혀 있으니 서브 존재만으로도 열고,
                                  // 좁은 폭 모드(브라우저 확대)에선 제목/부제목이 실제로 잘린
                                  // 카드만 연다(다 보이는 카드는 팝오버 소음).
                                  const el = e.currentTarget;
                                  if (hasClippedText(el) || (zoomCollapse && subs.length > 0))
                                    openZoomPeek(event.id, el, false);
                                }
                              : undefined
                          }
                          onMouseLeave={
                            titleCompact ? () => leaveZoomPeek(event.id) : undefined
                          }
                          onFocus={
                            titleCompact && span.showTitle
                              ? (e) => {
                                  const el = e.currentTarget;
                                  if (hasClippedText(el) || (zoomCollapse && subs.length > 0))
                                    openZoomPeek(event.id, el, false);
                                }
                              : undefined
                          }
                          onBlur={titleCompact ? () => leaveZoomPeek(event.id) : undefined}
                        >
                          {/* 드롭 안내바 — 스페이서(.drop-gap)가 자리를 여는 지금은 그것이 곧
                              위치 표시라 선을 겹쳐 그리지 않는다. 카드 높이를 못 재 스페이서를
                              못 여는 예외 상황(dragChipH=0)에서만 가는 막대로 대신한다. */}
                          {liIdx === eventIndex && dragChipH <= 0 ? (
                            <span className="drop-insert-line" aria-hidden="true" />
                          ) : null}
                          {liIdx !== null &&
                          dragChipH <= 0 &&
                          liIdx >= dateEvents.length &&
                          eventIndex === dateEvents.length - 1 ? (
                            <span className="drop-insert-line end" aria-hidden="true" />
                          ) : null}
                          <div className="pill-main">
                            {/* #8 옮긴 직후 서버 반영 전 — 작은 '동기화 중' 점(돌아감). 반영되면 사라진다. */}
                            {span.showTitle && syncingIds.includes(canonId(event.id)) ? (
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
                             data-act="일정 삭제">
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
                            if (zoomCollapse) {
                              // 확대 = 주제목 중심. 서브는 +N 칩으로 접어 카드 높이를 아끼고,
                              // 전체 내용은 팝오버(+N 클릭 = 핀 고정)로 — 단순 … 절단과 달리
                              // 정보량을 잃지 않는다. 이어지는 칸(span-cont)은 투명으로 높이만 맞춤.
                              return (
                                <div
                                  className={`pill-collapsed-row${span.showTitle ? "" : " span-cont"}`}
                                >
                                  <button
                                    type="button"
                                    className="pill-more"
                                    aria-label={`숨은 세부 ${subs.length}줄 고정해서 보기`}
                                    tabIndex={span.showTitle ? 0 : -1}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const pill = (e.currentTarget as HTMLElement).closest(
                                        ".studio-event-pill"
                                      );
                                      if (pill) openZoomPeek(event.id, pill as HTMLElement, true);
                                    }}
                                   data-act="pill-more">
                                    +{subs.length}
                                  </button>
                                  {dots}
                                </div>
                              );
                            }
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
                      // 스페이서가 있으면 [카드, 자리]로 함께 반환한다(그리드 자식 2개).
                      return gapEl ? [pill, gapEl] : pill;
                    })}
                  </div>
                </article>
              );
              });
            })()}
          </div>
        </section>

        {/* A안 M2: 확대 중 카드 상세 팝오버. 위치는 useLayoutEffect에서 실측 배치(그 전까지
            visibility:hidden — 렌더 시점엔 팝오버 실제 높이를 모른다). 핀·닫기 버튼이 항상
            있으므로 hover 상태 포함 non-modal dialog 하나로 통일. 상호작용 후에만 렌더 — SSR 무관. */}
        {zoomPeek
          ? (() => {
              const ev = liveEvents.find((e) => e.id === zoomPeek.id);
              if (!ev) return null;
              // 확대 상세도 최초공개 가림을 따른다 — 어디서든 게이트 전엔 ???만.
              const { main, subs } = splitEventTitle(
                teaserStillHidden(ev) ? "???" : ev.publicTitle
              );
              // (열림 판정은 카드 핸들러가 실측으로 함 — 서브가 없어도 제목이 잘린 카드는
              //  전체 제목을 보여줄 가치가 있어 여기서 서브 유무로 걸러내지 않는다.)
              // 폭은 내용에 맞춰 줄어들고(짧은 일정 = 좁은 박스), 최대만 제한 — 고정 380px는
              // 좌우 낭비가 컸다(방송 화면에서 빈 여백이 그대로 보임).
              const MAX_W = Math.min(320, window.innerWidth - 16);
              return (
                <div
                  aria-label={`일정 상세: ${main}`}
                  className="cal-zoom-peek"
                  id="cal-zoom-peek"
                  ref={peekElRef}
                  // 핀·닫기 버튼이 항상 있으므로 hover 상태도 tooltip이 아니라 non-modal
                  // dialog로 통일한다(tooltip은 interactive 자식을 가질 수 없다 — G1-r).
                  role="dialog"
                  style={{ maxWidth: MAX_W, visibility: "hidden" }}
                  onMouseEnter={cancelPeekClose}
                  onMouseLeave={() => leaveZoomPeek(zoomPeek.id)}
                >
                  <div className="peek-head">
                    <strong className="peek-title">{main}</strong>
                    {/* 핀 토글은 뺐다(사용자 피드백) — 고정이 필요하면 +N 클릭(=고정 오픈)으로 충분. */}
                    <div className="peek-actions">
                      <button
                        aria-label="상세 닫기"
                        className="peek-close"
                        type="button"
                        onClick={() => closeZoomPeek({ returnFocus: true })}
                       data-act="상세 닫기">
                        <X aria-hidden="true" size={15} strokeWidth={3} />
                      </button>
                    </div>
                  </div>
                  {subs.length > 0 ? (
                    <ul className="peek-subs">
                      {subs.map((sub, i) => (
                        <li key={i}>{sub}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })()
          : null}

        {/* (확대 배율 플로팅은 아래 하단 플로팅 행(bottom-float-row)으로 이동 — 비공개 배너와
            같은 행에 나란히 서서 일정을 최소로 가린다.) */}

        {/* 팝오버 → 앵커 칸 리더 라인 — '어느 칸의 편집창인지'를 항상 시각으로 잇는다.
            칸 쪽 끝은 도트, 카드 쪽 끝은 카드의 '앵커에 가장 가까운 가장자리'에 정확히 붙는다
            (카드가 칸 오른쪽이면 왼쪽 변 — 선이 카드 밑으로 파고들어 끊겨 보이지 않게).
            드래그 중엔 핸들러가 line 좌표를 직접 갱신한다. 새 일정=초록, 일정 수정=보라. */}
        {editorVisible && editorAnchorPt && editorPopSize && (editorPopManual ?? editorPopPos)
          ? (() => {
              const p = editorPopManual ?? editorPopPos!;
              const edge = popEdgePoint(p, editorPopSize, editorAnchorPt);
              // 앵커 칸이 카드에 덮여 있으면(최근접점 = 앵커 그 자체) 선은 무의미 — 도트만.
              const covered = edge.x === editorAnchorPt.x && edge.y === editorAnchorPt.y;
              return (
                // key=editorKey — 새 선택마다 remount해 페이드-인이 팝오버 등장과 함께 다시
                // 재생된다(팝오버보다 선이 먼저 완성돼 있던 부조화 제거).
                <svg
                  aria-hidden="true"
                  className={`editor-anchor-link ${selectedEventId ? "is-edit" : "is-new"}${
                    selectedIsSupport ? " is-support" : ""
                  }${selectedIsPeriod ? " is-period" : ""}`}
                  key={`link-${editorKey}`}
                >
                  {covered ? null : (
                    <line
                      ref={anchorLineRef}
                      x1={editorAnchorPt.x}
                      y1={editorAnchorPt.y}
                      x2={edge.x}
                      y2={edge.y}
                    />
                  )}
                  <circle cx={editorAnchorPt.x} cy={editorAnchorPt.y} r={5} />
                </svg>
              );
            })()
          : null}
        {/* 앵커 팝오버 — 위치는 placeEditorPopover가 실측 배치(선택 칸 옆, flip·클램프).
            좌표 확정 전 한 프레임은 숨겨 (0,0) 번쩍임을 막는다. 헤더를 잡아 끌면 이동.
            key=editorKey — 새 날짜/일정을 고를 때마다 remount: 예전 위치에서 미끄러져
            날아오지 않고, transform-origin(앵커 방향)에서 새로 자라나듯 등장한다. */}
        <aside
          className={`event-editor-panel ${selectedEventId ? "is-edit" : "is-new"}${
            selectedIsSupport ? " is-support" : ""
          }${selectedIsPeriod ? " is-period" : ""}${
            panelSaved ? " panel-saved" : ""
          }${editorPopDragging ? " pop-dragging" : ""}${editorPopSnapback ? " pop-snapback" : ""}${
            teaserGateActive ? " is-gated" : ""
          }`}
          key={`pop-${editorKey}`}
          ref={editorPanelRef}
          style={(() => {
            const maxH = editorPopMaxH ? { "--pop-max-h": `${editorPopMaxH}px` } : {};
            const p = editorPopManual ?? editorPopPos;
            if (!p) return { visibility: "hidden" as const, ...maxH } as CSSProperties;
            return {
              left: p.left,
              top: p.top,
              transformOrigin: editorPopPos
                ? `${editorPopPos.ox}px ${editorPopPos.oy}px`
                : undefined,
              ...maxH
            } as CSSProperties;
          })()}
        >
          {/* 아직 안 풀린 최초공개(떡밥) 일정 — 역할과 무관하게 먼저 비번 게이트.
              같은 팝오버 껍데기(점선 리더 라인·드래그·바깥 클릭 닫기)를 그대로 쓰고 속만 바꾼다. */}
          {teaserGateActive ? (
            <Fragment key={`gate-${editorKey}`}>
              {renderTeaserGate(
                <>
                  <div
                    aria-hidden="true"
                    className="editor-grab"
                    onPointerDown={onEditorPopDragStart}
                    title="끌어서 이동"
                  >
                    <span />
                  </div>
                  <div
                    className="editor-heading-bar teaser-gate-bar"
                    onPointerDown={onEditorPopDragStart}
                    title="끌어서 이동"
                  >
                    <span className="editor-date-inline">{formatEditorDate(selectedDate)}</span>
                    <p className="editor-mode-badge is-edit teaser-gate-badge">🔮 최초공개</p>
                    <button
                      aria-label="닫기"
                      className="teaser-gate-close"
                      onClick={() => setEditorVisible(false)}
                      type="button"
                     data-act="닫기">
                      <X aria-hidden="true" size={16} />
                    </button>
                  </div>
                </>
              )}
            </Fragment>
          ) : !canEdit ? (
            /* 매니저·작업자는 편집 불가 → 회색 폼 대신 깔끔한 읽기전용 상세를 보여준다(A1). */
            renderReadonlyDetail()
          ) : (
          /* key는 editorKey(명시적 선택 시에만 증가) — 저장·삭제 같은 내부 상태 변화로는 재마운트
             되지 않아 깜빡이지 않는다. 날짜/일정을 새로 고를 때만 쑥 내려오는 전환. */
          <form onSubmit={saveEvent} key={editorKey}>
            {/* 이동 손잡이 — 카드 맨 위 전폭 스트립(모드 색 틴트 + 중앙 필). 헤더 바도 같이
                끌 수 있지만, '여길 잡으면 된다'가 보이는 전용 그립을 따로 둔다. */}
            <div
              aria-hidden="true"
              className="editor-grab"
              onPointerDown={onEditorPopDragStart}
              title="끌어서 이동"
            >
              <span />
            </div>
            <div className="editor-heading">
              {/* 한 줄: 접기(>) · 날짜 · 라벨 ─ 오른쪽 끝 저장. (높이 절약 — 날짜를 아래줄로 빼지 않음)
                  이 바를 잡아 끌면 팝오버가 통째로 이동한다(버튼 위 제스처 제외). */}
              <div
                className="editor-heading-bar"
                onPointerDown={onEditorPopDragStart}
                title="끌어서 이동"
              >
                <div className="editor-heading-left">
                  <button
                    aria-label="편집 카드 닫기"
                    className="editor-collapse"
                    onClick={() => {
                      editorCloseHowRef.current = "collapse";
                      setEditorVisible(false);
                    }}
                    title="닫기"
                    type="button"
                   data-act="편집 카드 닫기">
                    <ChevronRight aria-hidden="true" size={16} strokeWidth={2.5} />
                  </button>
                  {/* key로 날짜가 바뀔 때마다 재마운트 → 쓱 바뀌는 애니메이션으로 '옮겼다'를 인지.
                      사람이 읽는 형식(7월 4일 (토)) — '어느 칸' 인지를 헤더에서도 바로 읽게. */}
                  <span className="editor-date-inline" key={selectedDate}>
                    {formatEditorDate(selectedDate)}
                  </span>
                  {/* 새 일정(초록 +) vs 일정 수정(보라 ✎) — 색·아이콘으로 한눈에 구분. */}
                  <p className={`editor-mode-badge ${selectedEventId ? "is-edit" : "is-new"}`}>
                    {selectedEventId ? (
                      <Pencil aria-hidden="true" size={12} strokeWidth={2.5} />
                    ) : (
                      <Plus aria-hidden="true" size={13} strokeWidth={3} />
                    )}
                    {selectedEventId ? "수정" : "신규"}
                  </p>
                </div>
                {/* (이동/복제 버튼 제거 — 사용자 결정: 드래그와 Ctrl+C/V 단축키가 충분해
                    버튼은 헤더 소음이었다. 비드래그 대안이 다시 필요하면 git 이력에 구현이 있다.) */}
                <button
                  className="button primary editor-save"
                  data-act="save-event"
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
                <button className="draft-restored-discard" onClick={discardDraft} type="button" data-act="draft-restored-discard">
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
            {renderTitleHelper()}

            {/* 옵션(미정·업도움·떡밥)은 접어 둔다 — 대부분의 일정은 '옵션 없음'이라 매번 펼쳐 볼
                필요가 없다. 제목·태그(자주 쓰는 것)를 먼저 보이게 하고, 이 묶음은 헤더에 현재 상태를
                요약해 보여준 뒤 필요할 때만 펼친다. 기본 접힘. (공개 범위 피커는 2026-08-27 철수 —
                모든 일정이 '모두'. 비공개 모델은 서버에 그대로.) */}
            <div className={`fold-field${scopeFoldOpen ? " open" : ""}`}>
              <button
                aria-expanded={scopeFoldOpen}
                className="fold-head"
                onClick={() => {
                  hapticTick();
                  setScopeFoldOpen((v) => !v);
                }}
                type="button"
               data-act="fold-head">
                <span className="fold-title">옵션</span>
                <span className="fold-summary">{scopeFoldSummary}</span>
                <ChevronDown aria-hidden="true" className="fold-chev" size={16} />
              </button>
              {scopeFoldOpen ? (
                <div className="fold-body">
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
                 data-act="opt-chip">
                  <span className="opt-chip-ic" aria-hidden="true">🔮</span>
                  <span className="opt-chip-label">일정 최초공개</span>
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
                태그{" "}
                <b className="tp-count" title={`최대 ${maxEventTags}개까지 고를 수 있어요`}>
                  {form.tagIds.length}/{maxEventTags}
                </b>
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
              // 라벨·색은 현재 폼의 종류를 따른다 — 기간 안내를 고르고 있으면 '이 기간 안내 삭제'
              // + 하늘색(폼 테마와 한 몸). 삭제 대상은 어느 쪽이든 같은 일정 한 건.
              <button
                className="button danger support-delete"
                data-act="delete-support"
                data-kind={form.supportKind}
                onClick={() => deleteEvent(selectedEventId)}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />이{" "}
                {form.supportKind === "period" ? "기간 안내" : "업 도움"} 삭제
              </button>
            ) : null}

            {/* 이용 기록(개발자 전용)은 '날짜(새 일정) 선택'일 때만 — 기존 일정 수정 카드에선 숨겨
                폼을 일정 편집에만 집중시킨다(사용자 결정 2026-07-31). (숲 '공지 쓰기' 버튼·모달은
                2026-08-27 제거 — 관리자가 안 쓰는 기능.) */}
            {selectedEventId ? null : isDevInsights ? (
              <button
                className="button aux-open"
                onClick={() => setModal("dayVisit")} data-act="open-day-visit"
                type="button"
              >
                📈 이용 기록
              </button>
            ) : null}

            {/* 이 일정의 관심(하트) 수 — 편집실에서 "이게 반응이 있었나"를 그 자리에서 본다.
                공개 스냅샷(viewerModePreview)에서 읽는다: 하트는 공개 일정에만 붙고, 숫자는
                이미 시청자 화면이 쓰는 값이라 새로 새는 것이 없다.
                비공개 일정은 스냅샷에 없으므로 줄 자체를 띄우지 않는다(0으로 오해되지 않게). */}
            {/* 업 도움은 하트를 못 누른다(시청자 화면에 하트 버튼 자체가 없다) — 0으로 뜨면
                "아무도 안 눌렀다"로 읽혀 없는 반응을 있는 것처럼 만든다. 줄 자체를 뺀다. */}
            {selectedEventId && !selectedIsSupport && heartCountOfSelected !== null ? (
              <p className="editor-hearts">
                <Heart aria-hidden="true" size={13} strokeWidth={2.6} />
                <span>관심</span>
                <b>{heartCountOfSelected}</b>
              </p>
            ) : null}
          </form>
          )}
        </aside>
      </section>

      {/* (하단 플로팅 월 < > 폐지 — 사용자 요청으로 헤더 '‹ 2026년 7월 ›'에 통합.) */}
        </>
      )}

      {/* 빠른 휴방 미니 메뉴 — 날짜 우클릭/롱프레스로 뜸. 한 번 눌러 휴방 표시/해제. */}
      {restMenu ? (
        <div className="rest-menu" role="menu" style={{ left: restMenu.x, top: restMenu.y }}>
          <button
            className="rest-menu-item"
            onClick={() => quickToggleRest(restMenu.isoDate)}
            role="menuitem"
            type="button"
           data-act="rest-menu-item">
            <span className="rest-menu-emoji" aria-hidden="true">
              🌙
            </span>
            {restMenu.hasRest ? "휴방 해제" : "휴방으로 표시"}
          </button>
        </div>
      ) : null}
      {modal ? (
        <div
          className={`modal-backdrop modal-backdrop-${modal}`}
          // 텍스트를 드래그 선택하다 배경에서 마우스를 떼도 닫히지 않도록,
          // 누름과 뗌이 모두 배경(자기 자신)에서 일어났을 때만 닫는다.
          onMouseDown={(e) => {
            backdropPressRef.current = e.target === e.currentTarget;
          }}
          onMouseUp={(e) => {
            if (backdropPressRef.current && e.target === e.currentTarget) {
              requestCloseModal();
            }
            backdropPressRef.current = false;
          }}
          role="presentation"
        >
          <div
            className={`modal-card modal-card-${modal} ${modal === "tags" || modal === "developer" || modal === "dayVisit" ? "modal-card-wide" : ""}`}
            aria-modal="true"
            role="dialog"
            ref={mainModalTrapRef}
          >
            <div className="modal-head">
              <h2>
                {modal === "tags"
                  ? "태그 이름 · 색상 편집"
                  : modal === "dayVisit"
                      ? `📈 ${selectedDate} 이용 기록`
                      : modal === "developer"
                        ? isDevInsights
                          ? "🛠 월별 인사이트"
                          : "📊 월별 인사이트"
                        : "설정"}
              </h2>
              <button
                aria-label="닫기"
                className="modal-close"
                data-act="close-modal"
                onClick={requestCloseModal}
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>

            {modal === "tags" && taxonomyV3 ? (
              <TagLegendEditor
                canEdit
                onDirtyChange={(d) => {
                  tagsDirtyRef.current = d;
                }}
                onTagAdded={applyTagAdd}
                onTagRemoved={applyTagRemove}
                onTagsUpdated={applyTagUpdates}
                palette={palette}
                removeTagAction={removeTagAction}
                saveTagsAction={saveTagsAction}
                tags={tags}
              />
            ) : null}
            {tagsDiscardAsk ? (
              <div className="modal-discard-ask" role="alertdialog" aria-label="변경사항 확인">
                <div className="mda-card">
                  <p>저장하지 않은 변경사항이 있어요.</p>
                  <div className="mda-actions">
                    <button
                      autoFocus
                      className="button"
                      onClick={() => setTagsDiscardAsk(false)}
                      type="button"
                      data-act="mda-keep"
                    >
                      계속 편집
                    </button>
                    <button
                      className="button mda-discard"
                      onClick={() => {
                        setTagsDiscardAsk(false);
                        tagsDirtyRef.current = false;
                        setModal(null);
                      }}
                      type="button"
                      data-act="mda-discard"
                    >
                      버리고 닫기
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
            {/* 설정(2026-09-04 사용자: 팝오버 말고 태그 편집·인사이트처럼 **창**) — 같은 모달 인프라(히스토리
                한 칸·포커스 가둠·스크롤 잠금·백드롭 눌러 닫기·Esc)를 그대로 탄다. 스위치는 설정 목록 한 벌. */}
            {modal === "settings" ? <div className="settings-modal-body">{renderSettingsList()}</div> : null}
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
          <div className="modal-card" aria-modal="true" role="dialog" ref={passcodeTrapRef}>
            <div className="modal-head">
              <h2>{passcodeModal === "change" ? "비밀번호 변경" : "비공개 일정"}</h2>
              <button
                aria-label="닫기"
                className="modal-close"
                data-act="close-modal"
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
                // 잠금 해제 성공 → 곧장 문서 리로드로 비공개 상태를 싣는다.
                // ⚠ router.refresh()/서버액션 revalidatePath로는 안 된다(Playwright 실측):
                // 비번 모달이 닫히며 오버레이 스택이 히스토리를 되감는 순간, 라우터가 방금
                // 도착한 RSC 페이로드를 버려 화면이 잠긴 채 남는 레이스가 있다(모달이 없는
                // '지금 잠그기' 경로만 정상이던 이유). 리로드는 이 레이스가 원천 불가능.
                // '방금 풀었으니 보여줘' 의도는 1회용 sessionStorage 플래그로 리로드를 건너
                // 전달한다 — 일반 F5의 '진입 시 공개 기본'(방송사고 방지) 규칙은 그대로다.
                // ⚠ 여기서 setPasscodeModal(null) 등 상태 변경 금지 — 모달이 닫히면 오버레이
                // 스택 효과가 history.back()을 호출하는데, 그 되감기가 진행 중인 리로드/refresh
                // 네비게이션을 취소해 화면이 잠긴 채 남는다(Playwright로 확정한 근본 원인:
                // 리로드 후에도 브라우저가 이전 render id를 그대로 물고 있었다).
                // 모달은 "확인 중…" 상태 그대로 두고 문서 리로드가 모든 걸 새로 시작하게 한다.
                try {
                  window.sessionStorage.setItem("vic:unlockReveal", "1");
                } catch {
                  // 저장 불가 환경이면 리로드 후 수동으로 '비공개 일정 보기'만 누르면 된다.
                }
                window.location.reload();
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

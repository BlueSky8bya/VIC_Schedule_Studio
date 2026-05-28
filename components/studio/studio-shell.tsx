"use client";

import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Eye,
  EyeOff,
  LockKeyhole,
  Save,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
  useEffect,
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
  StudioScheduleEvent
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
  getEventSpan,
  getEventTagColors,
  getLinkedChainIds,
  getSpanRunRange,
  getTodayKst,
  mixedEventStyle,
  mixedPatternMaskStyle,
  splitEventTitle
} from "@/lib/calendar/month";
import { useEqualChainHeights } from "@/lib/calendar/use-equal-chain-heights";
import { getDayMark } from "@/lib/calendar/holidays";
import {
  canDecorate,
  canEditSchedule,
  canEditSupport,
  canReadOwnerPrivate,
  canReadPrivateLayer
} from "@/lib/permissions/roles";
import {
  deleteEventAction,
  reorderEventsAction,
  saveEventAction,
  updateSupportSettingsAction
} from "@/lib/schedules/event-actions";
import { toggleEventHeartAction } from "@/lib/schedules/heart-actions";
import { linkChainAction, unlinkPairAction } from "@/lib/schedules/link-actions";
import { removeTagAction, saveTagsAction } from "@/lib/schedules/tag-actions";
import { PublicPoster } from "@/components/poster/public-poster";
import { PrivateLayerPanel } from "@/components/private-layer/private-layer-panel";
import { TagLegendEditor } from "@/components/tags/tag-legend-editor";
import { TrustedMembersPanel } from "@/components/trusted-members/trusted-members-panel";
import { DeveloperPanel } from "@/components/developer/developer-panel";
import { NoticeModal } from "@/components/notice/notice-modal";
import { setPasscodeAction } from "@/lib/private-layer/actions";
import { MOBILE_QUERY } from "@/lib/ui/breakpoints";
import { writeViewCookie } from "@/lib/ui/view-cookie";

type StudioShellProps = {
  actor: CurrentActor;
  schedule: StudioSchedule;
  hasUnlockSession: boolean;
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
  supportUrl: string;
  category: EventCategory;
  status: EventStatus;
  visibilityScope: EventVisibilityScope;
  tagIds: string[];
  primaryTagIds: string[];
};

// #2: Ctrl+C로 복사해 둔 일정 내용(날짜·id 제외). 기간은 일수로 저장해 붙여넣는 날짜 기준으로 재계산.
type CopiedEvent = {
  publicTitle: string;
  spanDays: number;
  isSupport: boolean;
  supportUrl: string;
  category: EventCategory;
  status: EventStatus;
  visibilityScope: EventVisibilityScope;
  tagIds: string[];
  primaryTagIds: string[];
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


const ROLE_LABEL: Record<MembershipRole, string> = {
  owner: "소유자",
  developer: "개발자",
  manager: "매니저",
  worker: "작업자",
  viewer: "시청자"
};

// 비-owner(매니저·작업자) 읽기전용 상세에서 쓰는 평이한 공개 범위 라벨.
// owner_private("나만")는 비-owner에게 애초에 노출되지 않지만, 매핑은 빠짐없이 둔다.
const VISIBILITY_LABEL: Record<EventVisibilityScope, string> = {
  public: "모두",
  embargo: "엠바고",
  work: "작업자",
  owner_private: "나만"
};

// A3: 역할 배지의 "?"를 누르면 뜨는 한 줄 책임 + 할 수 있는 것/없는 것. 빈 버튼으로 권한을
// 추론하게 두지 않고, 특히 매니저·작업자가 자기 역할을 바로 이해하게 한다.
const ROLE_DESC: Record<MembershipRole, { summary: string; can: string[]; cant?: string[] }> = {
  owner: {
    summary: "일정 발행과 전체 관리를 맡아요.",
    can: ["일정·태그·멤버·비밀번호 편집", "후원·꾸미기·포스터 내보내기", "비공개 레이어 보기(‘나만’ 포함)"]
  },
  developer: {
    summary: "시스템 유지보수자예요.",
    can: ["일정·태그·멤버 편집(유지보수)", "꾸미기·포스터"],
    cant: ["‘나만’ 일정은 볼 수 없어요"]
  },
  manager: {
    summary: "방송 운영을 도와요.",
    can: ["후원 기간/링크 수정", "꾸미기·포스터 내보내기", "비공개 일정 보기(잠금 해제 시)"],
    cant: ["일정·태그 편집은 불가"]
  },
  worker: {
    summary: "제작을 도와요.",
    can: ["꾸미기·이미지·포스터", "작업 일정 참고", "비공개 일정 보기(잠금 해제 시)"],
    cant: ["일정·후원 편집은 불가"]
  },
  viewer: {
    summary: "공개 일정을 봐요.",
    can: ["일정 보기 · 하트 · 후원 링크"]
  }
};

const SCOPE_LABEL: Record<EventVisibilityScope, string> = {
  public: "모두",
  embargo: "엠바고",
  work: "작업자",
  owner_private: "나만"
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
  initialView,
  initialViewerMode = false,
  initialNarrow = false
}: StudioShellProps) {
  const today = getTodayKst();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
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
  // 방금 잠금 해제했다면(=pendingUnlockReveal), refresh로 세션이 반영(hasUnlockSession=true)되는
  // 즉시 비공개 표시를 켠다. refresh 과정에서 showPrivate 상태가 유실되더라도 확실히 다시 켜진다.
  useEffect(() => {
    if (pendingUnlockReveal && hasUnlockSession) {
      pendingUnlockReveal = false;
      setShowPrivate(true);
    }
  }, [hasUnlockSession]);
  const [modal, setModal] = useState<
    null | "passcode" | "tags" | "members" | "notice" | "developer"
  >(null);
  const backdropPressRef = useRef(false); // 모달 배경 클릭 판정(텍스트 드래그 보호)
  // 새 일정 저장 진행 중인 임시 id → 실제 id 약속. 저장 직후 바로 "잇기"를 눌러도 temp id가
  // 서버로 새는 일 없이(=invalid uuid 방지), 저장이 끝나길 기다렸다 실제 id로 잇는다.
  const pendingSavesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  // 실수로 지운 일정을 Ctrl+Z로 되살리기 위한 스택(삭제된 일정 내용 보관).
  const deletedStackRef = useRef<StudioScheduleEvent[]>([]);
  // temp id면 저장 약속을 기다려 실제 id로, 실패면 null. 실제 id는 그대로.
  async function resolveEventId(id: string): Promise<string | null> {
    if (!id.startsWith("temp-")) {
      return id;
    }
    const p = pendingSavesRef.current.get(id);
    return p ? await p : null;
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
  // 신뢰 멤버(매니저·작업자)가 기존 업 도움의 기간·링크만 고치는 전용 시트(웹·모바일 공용).
  const [supportSheetId, setSupportSheetId] = useState<string | null>(null);
  const [supportSaving, setSupportSaving] = useState(false);
  // 모바일 하단 관리(태그·멤버) 펼침 상태.
  const [mobileMgmt, setMobileMgmt] = useState<null | "tags" | "members">(null);
  // 일정은 로컬 상태로 들고 낙관적으로 갱신한다 — 잇기·복붙·저장·삭제가 서버 왕복/새로고침을
  // 기다리지 않고 화면에 즉시 반영되게 해서 "하는 맛"을 살린다. 서버 데이터가 바뀌면 다시 맞춘다.
  const [events, setEvents] = useState(schedule.events);
  useEffect(() => {
    setEvents(schedule.events);
  }, [schedule.events]);
  // 태그·색 팔레트도 로컬 상태로 — 추가/삭제/저장을 새로고침 없이 즉시 반영(달력 색도 바로 갱신).
  const [tags, setTags] = useState(schedule.tags);
  const [palette, setPalette] = useState(schedule.palette);
  useEffect(() => {
    setTags(schedule.tags);
  }, [schedule.tags]);
  useEffect(() => {
    setPalette(schedule.palette);
  }, [schedule.palette]);
  // #3: "기타" 태그는 색상 안내·태그 선택 모두에서 항상 맨 끝.
  const legendTags = useMemo(
    () =>
      [...tags].sort(
        (a, b) => Number(a.displayName === "기타") - Number(b.displayName === "기타")
      ),
    [tags]
  );

  // 색상 안내 필터 — 편집실에서도 특정 태그 색만 골라볼 수 있게(시청자 화면과 동일 동작).
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  function toggleTagFilter(id: string) {
    setTagFilters((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }
  function isDimmedByFilter(event: StudioScheduleEvent) {
    if (tagFilters.length === 0) return false;
    const matchesPrivate =
      tagFilters.includes(PRIVATE_FILTER) && event.visibilityScope !== "public";
    const matchesTag = tagFilters.some(
      (id) =>
        id !== PRIVATE_FILTER &&
        (event.primaryTagIds.includes(id) || event.tagIds.includes(id))
    );
    return !(matchesPrivate || matchesTag);
  }

  // 카드 클릭:
  // - 선택된 일정과 인접+이미 이어진 카드를 누르면 → 그 이음새 하나만 끊는다(토글).
  // - 선택된 일정과 사이가 "매일 연속 + 같은 색"이면 → 그 구간 전체를 한 번에 잇는다.
  // - 그 외에는 그냥 그 일정을 선택(편집)한다.
  function handlePillClick(eventId: string) {
    const target = events.find((e) => e.id === eventId);
    if (!target) return;

    const anchor =
      selectedEventId && selectedEventId !== eventId
        ? events.find((e) => e.id === selectedEventId)
        : undefined;

    if (canEdit && anchor) {
      const [earlier, later] =
        getEventDateKey(anchor) <= getEventDateKey(target)
          ? [anchor, target]
          : [target, anchor];
      const alreadyLinked = earlier.linkNext === later.id;
      const snapshot = events; // 실패 시 되돌릴 직전 상태

      if (alreadyLinked) {
        // 낙관적으로 이음새를 끊고, 서버엔 백그라운드로 반영(새로고침 없이 즉시 반응).
        setEvents((prev) =>
          prev.map((e) => (e.id === earlier.id ? { ...e, linkNext: undefined } : e))
        );
        setActionError(null);
        void (async () => {
          const realId = await resolveEventId(earlier.id);
          if (!realId) {
            setActionError("저장 중이에요. 잠시 후 다시 시도해 주세요.");
            setEvents(snapshot);
            return;
          }
          const result = await unlinkPairAction(realId);
          if (!result.ok) {
            setActionError(result.error);
            setEvents(snapshot);
          }
        })();
      } else {
        const chain = buildLinkChain(anchor, target, events);
        if (chain) {
          // 낙관적으로 체인 연결(각 일정 linkNext = 다음 id).
          const linkMap = new Map<string, string>();
          for (let i = 0; i < chain.length - 1; i += 1) {
            linkMap.set(chain[i], chain[i + 1]);
          }
          setEvents((prev) =>
            prev.map((e) => (linkMap.has(e.id) ? { ...e, linkNext: linkMap.get(e.id) } : e))
          );
          setActionError(null);
          // 서버에는 실제 id로 보낸다. 새 일정이 아직 저장 중이면 끝나길 기다렸다 잇는다.
          void (async () => {
            const resolved = await Promise.all(chain.map(resolveEventId));
            if (resolved.some((id) => !id)) {
              setActionError("저장 중이에요. 잠시 후 다시 시도해 주세요.");
              setEvents(snapshot);
              return;
            }
            const result = await linkChainAction(resolved as string[]);
            if (!result.ok) {
              setActionError(result.error);
              setEvents(snapshot);
            }
          })();
        }
      }
    }

    selectEvent(target);
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
  const canEdit = canEditSchedule(actor.role);
  const canDecorateCalendar = canDecorate(actor.role);
  // 매니저(방송 운영)는 후원 기간/링크 수정 가능, 작업자(worker)는 읽기 전용.
  const canEditSupportThing = canEditSupport(actor.role);
  const canTogglePrivateLayer = actor.role !== "viewer";
  // A3: 역할 배지 "?" 도움말 팝오버 열림 상태.
  const [roleHelpOpen, setRoleHelpOpen] = useState(false);
  const canReadPrivate = canReadPrivateLayer(actor.role, hasUnlockSession) && showPrivate;

  function togglePrivateLayer() {
    if (hasUnlockSession) {
      setShowPrivate((value) => !value);
    } else {
      setModal("passcode");
    }
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

  // A3: 역할 배지 + "?" 도움말 팝오버. 데스크톱 배지는 이메일도 보여준다.
  function renderRoleBadge(showEmail: boolean) {
    const desc = ROLE_DESC[actor.role];
    return (
      <div className="actor-badge-wrap">
        <span className={`actor-badge ${actor.role}`}>
          <strong>{ROLE_LABEL[actor.role]}</strong>
          {showEmail ? <span>{actor.email ? `(${actor.email})` : "(비로그인)"}</span> : null}
          <button
            aria-expanded={roleHelpOpen}
            aria-label="역할 권한 보기"
            className="role-help-q"
            onClick={() => setRoleHelpOpen((value) => !value)}
            type="button"
          >
            ?
          </button>
        </span>
        {roleHelpOpen ? (
          <div className="role-help-pop" role="dialog" aria-label="역할 권한">
            <strong className="role-help-title">{ROLE_LABEL[actor.role]}</strong>
            <p className="role-help-summary">{desc.summary}</p>
            <ul className="role-help-can">
              {desc.can.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {desc.cant && desc.cant.length > 0 ? (
              <ul className="role-help-cant">
                {desc.cant.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
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
  const supportLanes = useMemo(() => assignSupportLanes(visibleEvents), [visibleEvents]);
  // 업 도움 띠가 차지하는 줄 수를 "주(週)별"로 센다. 띠가 없는 주는 0 → 그 주의 일정들이 위로
  // 붙는다(예전엔 달 전체 최대 줄 수를 모든 칸에 적용해, 띠 없는 주도 공중에 떠 높이만 낭비됨).
  const weekSupportLaneCount = useMemo(() => {
    const perWeek: number[] = [];
    for (let w = 0; w * 7 < cells.length; w += 1) {
      let maxLane = -1;
      for (const c of cells.slice(w * 7, w * 7 + 7)) {
        for (const s of getEventsForDate(visibleEvents, c.isoDate)) {
          if (!s.isSupport) continue;
          maxLane = Math.max(maxLane, supportLanes.lanes.get(s.id) ?? 0);
        }
      }
      perWeek[w] = maxLane + 1;
    }
    return perWeek;
  }, [cells, visibleEvents, supportLanes]);
  // 이어진 일정 묶음 키 + 묶음 칸 높이 맞추기(글자 수 달라도 이음새 안 어긋나게).
  const chainKeys = useMemo(() => buildChainKeys(visibleEvents), [visibleEvents]);
  const paintGroups = useMemo(() => buildPaintGroups(visibleEvents), [visibleEvents]);
  const monthGridRef = useRef<HTMLDivElement>(null);
  useEqualChainHeights(monthGridRef, [visibleEvents, view]);
  // 새 일정 카드: 카드/날짜 칸 바깥을 클릭하면 닫는다(슬라이드 아웃). 여는 클릭이 바로 닫지 않게
  // 다음 틱부터 문서 클릭을 듣는다.
  useEffect(() => {
    if (!editorVisible) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".event-editor-panel") || t?.closest(".studio-day")) return;
      setEditorVisible(false);
    };
    const id = window.setTimeout(() => document.addEventListener("click", onDocClick), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", onDocClick);
    };
  }, [editorVisible]);
  // 선택한 일정이 속한 연결 체인 전체를 하이라이트 대상으로 삼는다.
  const selectedChainIds = useMemo(
    () => getLinkedChainIds(selectedEventId, visibleEvents),
    [selectedEventId, visibleEvents]
  );
  const [form, setForm] = useState<EventForm>(() => createEmptyForm());

  // 모바일 오버레이 스택: 편집 시트 → (그 위에) 공지 모달. 레이어마다 히스토리 항목을 하나씩 쌓아,
  // 휴대폰 뒤로가기를 누르면 맨 위 레이어만 닫힌다(공지 → 편집 시트 → 스튜디오). passcode 모달은
  // 제외 — 잠금 해제 직후 onUnlocked의 router.refresh를 history.back이 취소하던 문제 방지.
  const modalIsStackable = modal !== null && modal !== "passcode";
  const overlayDepth = (mobileEditId !== null ? 1 : 0) + (modalIsStackable ? 1 : 0);
  const overlayLocked = overlayDepth > 0;
  // 히스토리 스택 깊이 = 오버레이(편집 시트·공지) + 시청자 미리보기(viewerMode).
  // viewerMode도 한 칸 쌓아야, 휴대폰 뒤로가기를 누를 때 로그인 흐름으로 빠지지 않고
  // 편집실로 돌아온다. (스크롤 잠금은 overlayLocked만 사용 — 미리보기 자체 스크롤은 살린다.)
  const stackDepth = overlayDepth + (viewerMode ? 1 : 0);
  const depthRef = useRef(0);
  const ignorePopRef = useRef(0); // 우리가 정리용으로 부른 history.back의 popstate는 무시
  const backClosingRef = useRef(false); // 뒤로가기로 닫히는 중인지

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
      if (ignorePopRef.current > 0) {
        ignorePopRef.current -= 1;
        return;
      }
      backClosingRef.current = true;
      if (modalIsStackable) {
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
  }, [modalIsStackable, mobileEditId, viewerMode]);

  // D: 이 일정의 대표 태그(최대 2개) 색. 2개면 그 일정 안에서 그라데이션(경계는 일정 가운데).
  function eventColors(event: StudioScheduleEvent) {
    return getEventTagColors(event, tags, palette);
  }

  function moveMonth(offset: number) {
    setMonthDir(offset >= 0 ? "next" : "prev"); // 슬라이드 방향(시청자 화면과 동일)
    setView((current) => {
      const next = getAdjacentMonth(current.year, current.month, offset);
      setSelectedDate(`${next.year}-${String(next.month).padStart(2, "0")}-01`);
      setSelectedEventId(null);
      setForm(createEmptyForm());
      return next;
    });
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
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveMonth(-1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveMonth(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNarrow, viewerMode, overlayLocked]);

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
      moveMonth(dx < 0 ? 1 : -1);
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
    setForm(createEmptyForm());
    setEditorVisible(true);
  }

  // ── 일정 카드 드래그 이동 ────────────────────────────────────────────────
  // 카드를 끌어 다른 날짜 칸에 놓으면 그 날짜로 옮긴다. 들면 카드가 살짝 기울고 흔들리는
  // "유령(ghost)"이 손끝을 따라오고(웹·터치 공용), 가장자리에선 자동 스크롤된다.
  // (멀티데이 막대는 칸마다 쪼개 그려 드래그가 까다로워 제외 — 단일일 카드만 끌 수 있다.)
  const [dragEventId, setDragEventId] = useState<string | null>(null);
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
  } | null>(null);
  const dragScrollDir = useRef(0);
  const dragRaf = useRef<number | null>(null);
  const dragMoveRef = useRef<((e: PointerEvent) => void) | null>(null);
  const justDraggedRef = useRef(false);
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

  useEffect(() => {
    return () => {
      if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
      dragGhostRef.current?.remove();
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
      edWobRef.current += 0.12;
      const w = edWobRef.current;
      const wobble = Math.sin(w) * 1.1 + (Math.random() - 0.5) * 0.7; // deg
      const deg = ((worldAngle - edPhi0Ref.current) * 180) / Math.PI + wobble;
      ghost.style.left = `${pos.x}px`;
      ghost.style.top = `${pos.y}px`;
      ghost.style.transform = `rotate(${deg}deg) scale(1.06)`;
    }
    dragRaf.current = requestAnimationFrame(dragAutoScroll);
  }

  function endEventDrag() {
    if (dragMoveRef.current) {
      window.removeEventListener("pointermove", dragMoveRef.current);
      dragMoveRef.current = null;
    }
    dragScrollDir.current = 0;
    if (dragRaf.current) cancelAnimationFrame(dragRaf.current);
    dragRaf.current = null;
    dragGhostRef.current?.remove();
    dragGhostRef.current = null;
    document.body.style.userSelect = "";
    const info = dragInfoRef.current;
    const target = dropDateRef.current;
    const over = dropOverRef.current;
    setDragEventId(null);
    setDropDate(null);
    setDropSlot(null);
    dropDateRef.current = null;
    dropOverRef.current = null;
    if (info?.started) {
      justDraggedRef.current = true; // 다음 click(선택) 1회 무시
      if (target) {
        void dropEventInto(info.id, info.sourceDate, target, over);
      }
    }
    dragInfoRef.current = null;
  }

  function onEventDragMove(e: PointerEvent) {
    const info = dragInfoRef.current;
    if (!info) return;
    if (!info.started) {
      if (Math.hypot(e.clientX - info.startX, e.clientY - info.startY) < 6) return;
      info.started = true;
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
      edOffRef.current = { x: info.offX, y: info.offY };
      const lvx = rect.width / 2 - info.offX;
      const lvy = rect.height / 2 - info.offY;
      // 진자 길이를 넉넉히(최소 80px) — 짧으면 작은 손움직임에도 크게 휘둘려(특히 중앙 잡을 때
      // 옆으로만 움직여도 빙글) 과민해진다. 길게 두면 같은 움직임에도 회전이 완만해진다.
      edLenRef.current = Math.max(80, Math.hypot(lvx, lvy));
      edPhi0Ref.current = Math.atan2(lvy, lvx);
      const pivotX = rect.left + info.offX;
      const pivotY = rect.top + info.offY;
      edBobRef.current = { x: pivotX + lvx, y: pivotY + lvy };
      edBobPrevRef.current = { x: pivotX + lvx, y: pivotY + lvy };
      edReducedRef.current =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
      // 드래그 동안 어디서도 글자가 선택(긁힘)되지 않게.
      document.body.style.userSelect = "none";
      dragRaf.current = requestAnimationFrame(dragAutoScroll);
    }
    // 직접 위치를 박지 않고 "목표"만 갱신 → dragAutoScroll 루프가 관성 있게 따라간다.
    edTargetRef.current = { x: e.clientX - info.offX, y: e.clientY - info.offY };
    const under = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const dayEl = under?.closest("[data-isodate]") as HTMLElement | null;
    const iso = dayEl?.getAttribute("data-isodate") ?? null;
    if (iso !== dropDateRef.current) {
      dropDateRef.current = iso;
      setDropDate(iso);
    }
    // 같은/다른 날 안에서 어느 카드 위·아래에 놓을지 판단(순서 변경). 카드 위쪽 절반=그 앞,
    // 아래쪽 절반=그 뒤. 카드가 아니면(빈 공간) null → 맨 끝.
    const pillEl = under?.closest("[data-eventid]") as HTMLElement | null;
    const overId = pillEl?.getAttribute("data-eventid") ?? null;
    if (overId && overId !== info.id) {
      const r = pillEl!.getBoundingClientRect();
      dropOverRef.current = { id: overId, after: e.clientY > r.top + r.height / 2 };
    } else {
      dropOverRef.current = null;
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
    dragInfoRef.current = {
      id: event.id,
      sourceDate: getEventDateKey(event),
      node,
      startX: e.clientX,
      startY: e.clientY,
      offX: e.clientX - rect.left,
      offY: e.clientY - rect.top,
      started: false
    };
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

  // 드롭: 일정을 target 날짜로(필요 시) 옮기고, 같은 날 안에서 over(위/아래) 위치에 끼워 순서 변경.
  async function dropEventInto(
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

    const snapshot = events;
    const delta = Math.round(
      (new Date(`${targetDate}T00:00:00Z`).getTime() -
        new Date(`${getEventDateKey(moved)}T00:00:00Z`).getTime()) /
        86400000
    );
    const orderPos = new Map(orderedIds.map((eid, i) => [eid, i] as const));
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
    flashToast(targetDate === sourceDate ? "순서를 바꿨어요" : `${targetDate}로 옮겼어요`);
    const result = await reorderEventsAction({
      dateKey: targetDate,
      orderedIds,
      movedId: targetDate !== sourceDate ? id : undefined
    });
    if (!result.ok) {
      setEvents(snapshot);
      setActionError(result.error);
    }
  }

  function selectEvent(event: StudioScheduleEvent) {
    setSelectedDate(event.startsAt.slice(0, 10));
    setSelectedEventId(event.id);
    setForm({
      id: event.id,
      publicTitle: event.publicTitle,
      endDateKey: event.endDateKey ?? "",
      isSupport: event.isSupport ?? false,
      supportUrl: event.supportUrl ?? "",
      category: event.category,
      status: event.status,
      visibilityScope: event.visibilityScope,
      tagIds: event.tagIds,
      primaryTagIds: event.primaryTagIds
    });
    setEditorVisible(true);
  }

  // A1: 매니저·작업자용 읽기전용 일정 상세. owner 편집 폼을 회색으로 보여주는 대신,
  // 제목·날짜·공개범위·태그·후원 링크만 깔끔히 보여준다. owner_private는 애초에 비-owner에게
  // 로드되지 않는다. 매니저(canEditSupportThing)는 후원 이벤트에 한해 "후원 수정"을 쓸 수 있다.
  function renderReadonlyDetail() {
    const selectedEvent = selectedEventId
      ? events.find((event) => event.id === selectedEventId)
      : null;
    return (
      <div className="event-detail-readonly" key={selectedDate}>
        <div className="editor-heading">
          <div>
            <p className="eyebrow">일정 보기</p>
            <h2 className="editor-date" key={selectedDate}>
              {selectedDate}
            </h2>
          </div>
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
            {selectedEvent.tagIds.length > 0 ? (
              <div className="detail-row">
                <span className="detail-label">태그</span>
                <div className="detail-tags">
                  {selectedEvent.tagIds.map((id) => {
                    const tag = legendTags.find((item) => item.id === id);
                    const color = tag && palette.find((c) => c.key === tag.colorKey);
                    return tag && color ? (
                      <span
                        className="detail-tag"
                        key={id}
                        style={{
                          backgroundColor: color.bgColor,
                          borderColor: color.borderColor,
                          color: color.textColor
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
                <span className="detail-label">후원</span>
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
                후원 기간/링크 수정
              </button>
            ) : null}
          </>
        )}
      </div>
    );
  }

  function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    const existing = events.find((e) => e.id === form.id);
    const isNew = !form.id;
    const tempId = form.id ?? `temp-${Math.random().toString(36).slice(2)}`;
    // 데스크톱은 안전상 비공개 레이어를 풀어야 비공개 범위를 지정한다.
    // 모바일(소유자/개발자 본인 기기)은 잠금 없이 바로 공개 범위를 지정할 수 있다.
    const scope: EventVisibilityScope =
      canReadPrivate || isNarrow ? form.visibilityScope : "public";
    const endDateKey =
      form.isSupport && form.endDateKey ? form.endDateKey : undefined;
    // 낙관적 일정 객체(서버 응답 전 화면에 바로 그린다).
    const optimistic: StudioScheduleEvent = {
      id: tempId,
      startsAt: `${selectedDate}T00:00:00+09:00`,
      endDateKey,
      linkNext: existing?.linkNext,
      isSupport: form.isSupport,
      supportUrl: form.supportUrl || undefined,
      isAllDay: true,
      publicTitle: form.publicTitle,
      status: form.status,
      visibilityScope: scope,
      category: form.category,
      tagIds: form.tagIds,
      primaryTagIds: form.primaryTagIds.slice(0, 2),
      sortOrder: existing?.sortOrder ?? 0
    };
    // 서버로 보낼 입력은 폼 초기화 전에 미리 만들어 둔다.
    const payload = {
      id: form.id,
      dateKey: selectedDate,
      endDateKey: form.isSupport ? form.endDateKey : "",
      startTime: "",
      endTime: "",
      isAllDay: true,
      publicTitle: form.publicTitle,
      publicDescription: "",
      category: form.category,
      status: form.status,
      visibilityScope: scope,
      tagIds: form.tagIds,
      primaryTagIds: form.primaryTagIds.slice(0, 2),
      isSupport: form.isSupport,
      supportUrl: form.supportUrl
    };
    const snapshot = events;

    setEvents((prev) =>
      isNew ? [...prev, optimistic] : prev.map((e) => (e.id === tempId ? optimistic : e))
    );
    setSelectedEventId(null);
    setForm(createEmptyForm());
    setActionError(null);

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
      const result = await saveEventAction(payload);
      if (!result.ok) {
        setActionError(result.error);
        setEvents(snapshot); // 실패 → 되돌림
        resolveSave(null);
        pendingSavesRef.current.delete(tempId);
        return;
      }
      // 새 일정이면 임시 id를 실제 id로 교체 + 이 임시 id를 가리키던 linkNext도 함께 교체.
      if (isNew && result.id) {
        const realId = result.id;
        setEvents((prev) =>
          prev.map((e) => {
            let next = e;
            if (e.id === tempId) next = { ...next, id: realId };
            if (e.linkNext === tempId) next = { ...next, linkNext: realId };
            return next;
          })
        );
        resolveSave(realId);
        pendingSavesRef.current.delete(tempId);
      }
    });
  }

  function deleteEvent(targetId: string) {
    if (!canEdit) {
      return;
    }

    const snapshot = events;
    const removed = events.find((e) => e.id === targetId) ?? null;
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
    // Ctrl+Z 복구용으로 삭제 내용을 보관.
    if (removed) {
      deletedStackRef.current.push(removed);
    }
    startTransition(async () => {
      // 아직 저장 안 된(temp) 일정이면 실제 id로 바꿔 삭제(잘못된 uuid 방지).
      const realId = await resolveEventId(targetId);
      if (!realId) {
        return; // 서버에 아직 없음 → 로컬 제거로 충분
      }
      const result = await deleteEventAction(realId);
      if (!result.ok) {
        setActionError(result.error);
        setEvents(snapshot); // 실패 → 되돌림
        deletedStackRef.current.pop(); // 복구 스택도 되돌림
      }
    });
  }

  // Ctrl+Z: 가장 최근에 지운 일정을 내용 그대로 되살린다(새 id로 다시 만든다).
  function restoreLastDelete() {
    if (!canEdit) {
      return;
    }
    const ev = deletedStackRef.current.pop();
    if (!ev) {
      flashToast("되돌릴 삭제가 없어요");
      return;
    }
    const dateKey = getEventDateKey(ev);
    const tempId = `temp-${Math.random().toString(36).slice(2)}`;
    setEvents((prev) => [...prev, { ...ev, id: tempId, linkNext: undefined }]);
    setActionError(null);
    flashToast("삭제 취소됨 (Ctrl+Z)");

    let resolveSave: (id: string | null) => void = () => {};
    pendingSavesRef.current.set(
      tempId,
      new Promise<string | null>((r) => {
        resolveSave = r;
      })
    );
    startTransition(async () => {
      const result = await saveEventAction({
        id: undefined,
        dateKey,
        endDateKey: ev.endDateKey ?? "",
        startTime: "",
        endTime: "",
        isAllDay: true,
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
        setEvents((prev) => prev.map((e) => (e.id === tempId ? { ...e, id: realId } : e)));
        resolveSave(realId);
        pendingSavesRef.current.delete(tempId);
      }
    });
  }

  // D: 일정 하나에 태그 최대 2개. 같은 태그를 다시 누르면 해제, 2개 찬 뒤 새 태그는 무시.
  // 고른 태그는 모두 대표(primary)로 — 2개면 일정칸에 두 색이 그라데이션으로 섞인다.
  function selectTag(tagId: string) {
    setForm((current) => {
      if (current.tagIds.includes(tagId)) {
        const next = current.tagIds.filter((id) => id !== tagId);
        return { ...current, tagIds: next, primaryTagIds: next };
      }
      if (current.tagIds.length >= 2) {
        return current; // 최대 2개까지
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
    updates: { id: string; displayName: string; colorKey: ColorKey; sortOrder?: number }[]
  ) {
    setTags((prev) => {
      const mapped = prev.map((t) => {
        const u = updates.find((x) => x.id === t.id);
        return u
          ? { ...t, displayName: u.displayName, colorKey: u.colorKey, sortOrder: u.sortOrder ?? t.sortOrder }
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
    flashToast(`${selectedDate}에 붙여넣음`);
    setActionError(null);
    startTransition(async () => {
      const result = await saveEventAction({
        id: undefined,
        dateKey: selectedDate,
        endDateKey: endDateKey ?? "",
        startTime: "",
        endTime: "",
        isAllDay: true,
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
        setEvents((prev) => prev.map((e) => (e.id === tempId ? { ...e, id: result.id } : e)));
      }
    });
  }

  // 일정 단축키(소유자만). 입력칸·팝업·텍스트선택 중에는 가로채지 않는다.
  useEffect(() => {
    if (!canEdit) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable || modal) return;
      // Delete 키: 선택한 일정 삭제(버튼 없이도).
      if (e.key === "Delete" && selectedEventId) {
        e.preventDefault();
        deleteEvent(selectedEventId);
        return;
      }
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
  }, [canEdit, selectedEventId, clipboard, selectedDate, modal, canReadPrivate, events]);

  // 모바일 아젠다도 데스크톱과 동일하게 — 비공개 일정은 "비공개 일정 보기"로 직접 켜기 전까진
  // 누구에게도(개발자·소유자 포함) 보이지 않는다. 방송사고 방지: 진입/새로고침 시 항상 공개 기본.
  const mobileAgendaEvents = visibleEvents;

  function openMobileEdit(event: StudioScheduleEvent) {
    selectEvent(event);
    setMobileEditId(event.id);
  }
  function openMobileAdd(isoDate: string) {
    selectDate(isoDate);
    setForm(createEmptyForm());
    setMobileEditId("new");
  }
  function closeMobileEdit() {
    setMobileEditId(null);
    setSelectedEventId(null);
    setForm(createEmptyForm());
  }

  // 신뢰 멤버(매니저·작업자)가 기존 업 도움의 기간·링크만 고치는 시트 열기/닫기/저장.
  function openSupportSheet(event: StudioScheduleEvent) {
    selectEvent(event); // form에 이 업 도움의 기간·링크가 채워진다
    setSupportSheetId(event.id);
  }
  function closeSupportSheet() {
    setSupportSheetId(null);
    setSelectedEventId(null);
    setForm(createEmptyForm());
  }
  function saveSupportSettings() {
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
      const result = await updateSupportSettingsAction(id, {
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
              <h1>
                ✨️ {schedule.calendar.title} ✨️
                <span>
                  토리님 편집실 · {view.year}년 {view.month}월
                </span>
              </h1>
            </header>

            <div className="m-rolebar">
              {renderRoleBadge(false)}
              {canTogglePrivateLayer ? (
                <button
                  className={canReadPrivate ? "button primary" : "button"}
                  onClick={togglePrivateLayer}
                  type="button"
                >
                  {canReadPrivate ? <EyeOff size={14} /> : <Eye size={14} />}
                  {canReadPrivate ? "비공개 중" : "비공개 일정"}
                </button>
              ) : null}
              <button className="button" onClick={() => setViewerMode(true)} type="button">
                <Eye size={14} /> 시청자 화면
              </button>
              {actor.isAuthenticated ? (
                <form action="/api/auth/logout" method="post">
                  <button
                    className="button"
                    onClick={() => startNav(isNarrow ? "계정 변경 중…" : "계정 선택 화면으로 이동 중입니다…")}
                    type="submit"
                  >
                    계정변경
                  </button>
                </form>
              ) : (
                <Link className="button" href="/login">
                  로그인
                </Link>
              )}
            </div>
          </div>

          {actor.role === "developer" ? (
            <div className="developer-warning">
              🛠 개발자 세션
              <button
                className="developer-warning-btn"
                onClick={() => setModal("developer")}
                type="button"
              >
                접속자 현황
              </button>
            </div>
          ) : null}
          {/* 비공개 경고 배너는 화면을 공유하는 소유자에게만 — 작업자/매니저/개발자는 표시하지 않음. */}
          {canReadPrivate && actor.role === "owner" ? (
            <div className="private-warning">
              <LockKeyhole aria-hidden="true" size={16} />⚠ 비공개 일정 표시 중
            </div>
          ) : null}

          <section
            className="agenda agenda-studio"
            onTouchEnd={onAgendaTouchEnd}
            onTouchStart={onAgendaTouchStart}
          >
            {/* 오른쪽 색상 필터 레일 — 스크롤을 따라온다(시청자 화면과 동일). */}
            <aside className="agenda-legend agenda-legend-studio" aria-label="색상 필터">
              <strong>색상 필터</strong>
              {legendTags.map((tag) => {
                const color = palette.find((p) => p.key === tag.colorKey);
                if (!color) return null;
                const on = tagFilters.includes(tag.id);
                return (
                  <button
                    aria-pressed={on}
                    className={`agenda-legend-tag ${on ? "on" : ""} ${
                      filtering && !on ? "dim" : ""
                    }`}
                    key={tag.id}
                    onClick={() => toggleTagFilter(tag.id)}
                    type="button"
                  >
                    <i
                      data-color={color.key}
                      style={{ backgroundColor: color.bgColor, borderColor: color.borderColor }}
                    />
                    {tag.displayName}
                  </button>
                );
              })}
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

            <div className="agenda-flow" data-enter={monthDir} key={`${view.year}-${view.month}`}>
              {monthCells.map((cell) => {
              const day = classifyDay(cell.isoDate, cell.weekday, today);
              const mark = getDayMark(cell.isoDate);
              const dayEvents = mobileAgendaEvents.filter(
                (e) => getEventDateKey(e) === cell.isoDate
              );
              // 모바일 색상 필터: 필터가 켜지면 흐림이 아니라 "걸러진 일정만" 보여준다.
              // 매칭 일정이 하나도 없는 날 카드는 아예 렌더하지 않는다(예: 짧뱅 필터 → 5일·15일만).
              const shownEvents = filtering
                ? dayEvents.filter((e) => !isDimmedByFilter(e))
                : dayEvents;
              if (filtering && shownEvents.length === 0) {
                return null;
              }
              return (
                <div className={`agenda-day ${day.isToday ? "today" : ""}`} key={cell.isoDate}>
                  <div className="agenda-when">
                    <strong className={day.isRed ? "red" : day.isSaturday ? "saturday" : ""}>
                      {cell.dayOfMonth}
                    </strong>
                    <span className="agenda-wd">{WEEKDAYS[cell.weekday]}</span>
                  </div>
                  <div className="agenda-day-list">
                    {mark ? (
                      <span className={`agenda-mark ${mark.isHoliday ? "holiday" : ""}`}>
                        {mark.name}
                      </span>
                    ) : null}
                    {dayEvents.length === 0 ? (
                      <span className="agenda-noevent">예정된 일정 없음</span>
                    ) : null}
                    {shownEvents.map((event) => {
                      const colors = eventColors(event);
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
                      // 업 도움: 시청자 화면처럼 기간 + "도우러 가기" 링크를 인라인으로 보여준다.
                      // (링크를 누르려면 <a>가 필요해 편집 버튼으로 감싸지 않고, 따로 "수정"을 둔다.)
                      if (event.isSupport) {
                        const sEnd = event.endDateKey ?? cell.isoDate;
                        return (
                          <div className={`agenda-event m-support${dimCls}`} key={event.id}>
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
                                {/* 소유자·개발자는 전체 편집, 매니저는 후원 설정만 수정. 작업자는 읽기 전용. */}
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
                          <span
                            className="agenda-bar"
                            data-color={colors.length < 2 ? colors[0]?.key : undefined}
                            style={barStyle}
                          />
                          <div className="agenda-content">
                            <p className="agenda-title">
                              <span className="agenda-title-text">
                                {event.isSupport ? `🌱 ${event.publicTitle}` : main}
                              </span>
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
                          </div>
                        </>
                      );
                      return canEdit ? (
                        <button
                          className={`agenda-event m-event${dimCls}`}
                          key={event.id}
                          onClick={() => openMobileEdit(event)}
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
            <button
              className="button"
              onClick={() => setMobileMgmt(mobileMgmt === "tags" ? null : "tags")}
              type="button"
            >
              태그 이름 · 색상 · 순서 {mobileMgmt === "tags" ? "▲" : "▼"}
            </button>
            {mobileMgmt === "tags" ? (
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
            <button
              className="button"
              onClick={() => setMobileMgmt(mobileMgmt === "members" ? null : "members")}
              type="button"
            >
              매니저 · 작업자 관리 {mobileMgmt === "members" ? "▲" : "▼"}
            </button>
            {mobileMgmt === "members" ? <TrustedMembersPanel /> : null}
          </section>
        ) : null}

        <nav className="agenda-monthbar" aria-label="월 이동">
          <button onClick={() => moveMonth(-1)} title="이전 달" type="button">
            <ChevronLeft aria-hidden="true" size={22} />
          </button>
          <button onClick={() => moveMonth(1)} title="다음 달" type="button">
            <ChevronRight aria-hidden="true" size={22} />
          </button>
        </nav>

        {canEdit && mobileEditId !== null ? renderMobileEditSheet() : null}
      </div>
    );
  }

  // 업 도움(후원) 편집 — 켜기/끄기 + 기간 + 링크 + 링크 확인. 웹 폼과 모바일 편집 시트 공용.
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
          <div className="duration-manual">
            <span>종료일 직접 선택</span>
            <input
              disabled={!editable}
              min={selectedDate}
              onChange={(event) =>
                setForm((current) => ({ ...current, endDateKey: event.target.value }))
              }
              type="date"
              value={form.endDateKey || selectedDate}
            />
          </div>
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
        <div className="support-toggle">
          <span>🌱 업 도움 설정</span>
          <button
            aria-checked={form.isSupport}
            className={`switch ${form.isSupport ? "on" : ""}`}
            disabled={!canEdit}
            onClick={() => setForm((current) => ({ ...current, isSupport: !current.isSupport }))}
            role="switch"
            type="button"
          >
            <span className="switch-knob" />
          </button>
        </div>
        {form.isSupport ? renderSupportFields(canEdit) : null}
      </>
    );
  }

  // 신뢰 멤버(매니저·작업자)용 "업 도움 수정" 시트 — 기간·링크만 고친다(토글·삭제 없음).
  function renderSupportSheet() {
    return (
      <div
        className="modal-backdrop"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeSupportSheet();
        }}
        role="presentation"
      >
        <div className="modal-card" role="dialog">
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
      >
        <div className="m-edit-sheet" role="dialog">
          <div className="m-edit-head">
            <strong>{selectedEventId ? "일정 수정" : "새 일정"}</strong>
            <span>{selectedDate}</span>
            <button aria-label="닫기" onClick={closeMobileEdit} type="button">
              <X aria-hidden="true" size={18} />
            </button>
          </div>

          {actionError ? <div className="auth-warning">{actionError}</div> : null}

          <form
            onSubmit={(e) => {
              saveEvent(e);
              setMobileEditId(null);
            }}
          >
            <label>
              제목
              <textarea
                onChange={(e) =>
                  setForm((cur) => ({ ...cur, publicTitle: e.target.value }))
                }
                placeholder="예: 풀트뱅 / 첫 줄은 제목, 다음 줄부터 세부"
                rows={2}
                value={form.publicTitle}
              />
            </label>

            <label>
              공개 범위
              <select
                onChange={(e) =>
                  setForm((cur) => ({
                    ...cur,
                    visibilityScope: e.target.value as EventVisibilityScope
                  }))
                }
                value={form.visibilityScope}
              >
                <option value="public">모두</option>
                <option value="embargo">엠바고</option>
                <option value="work">작업자</option>
                {actor.role === "owner" ? <option value="owner_private">나만</option> : null}
              </select>
            </label>

            {renderSupportEditor()}

            <section className="tag-picker" aria-label="태그 선택">
              <h3>
                태그 <span className="tag-picker-hint">최대 2개</span>
              </h3>
              <div>
                {legendTags.map((tag) => {
                  const color = palette.find((item) => item.key === tag.colorKey);
                  const selected = form.tagIds.includes(tag.id);
                  const full = !selected && form.tagIds.length >= 2;
                  return color ? (
                    <button
                      className={selected ? "selected" : ""}
                      data-color={color.key}
                      disabled={full}
                      key={tag.id}
                      onClick={() => selectTag(tag.id)}
                      style={{
                        backgroundColor: color.bgColor,
                        borderColor: color.borderColor,
                        color: color.textColor
                      }}
                      type="button"
                    >
                      {selected ? `${form.tagIds.indexOf(tag.id) + 1}. ` : ""}
                      {tag.displayName}
                    </button>
                  ) : null;
                })}
              </div>
            </section>

            {/* 선택한 날짜로 숲 공지 초안 만들기 (소유자/개발자). 편집 시트는 그대로 두고 그 위에
                공지 창을 띄운다 → 공지에서 뒤로가기를 누르면 편집 시트로 돌아온다(스택). */}
            {canEdit ? (
              <button
                className="button notice-open"
                onClick={() => setModal("notice")}
                type="button"
              >
                📢 {selectedDate} 공지 쓰기
              </button>
            ) : null}

            <div className="m-edit-actions">
              {selectedEventId ? (
                <button
                  className="button danger"
                  onClick={() => {
                    deleteEvent(selectedEventId);
                    closeMobileEdit();
                  }}
                  type="button"
                >
                  <Trash2 aria-hidden="true" size={15} /> 삭제
                </button>
              ) : (
                <span />
              )}
              <button className="button primary" disabled={pending} type="submit">
                <Save aria-hidden="true" size={15} />
                {pending ? "저장 중…" : "저장"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 시청자 화면 전체보기: 스튜디오 UI를 숨기고 공개 화면만 그대로 보여준다.
  if (viewerMode) {
    return (
      <div className="viewer-fullscreen">
        {navMsg ? (
          <div className="private-loading" role="status" aria-live="polite">
            <span className="private-loading-spinner" aria-hidden="true" />
            {navMsg}
          </div>
        ) : null}
        <div className="viewer-fullscreen-bar">
          {/* 라벨은 왼쪽, "편집실로 돌아가기"는 우측 상단으로(버튼 위치 통일). */}
          <span className="viewer-fullscreen-label">
            {isNarrow ? null : <Eye aria-hidden="true" size={15} />}
            {isNarrow
              ? "시청자가 보는 화면"
              : "시청자가 보는 공개 화면입니다"}
          </span>
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
        </div>
        <PublicPoster
          initialMonth={view.month}
          initialYear={view.year}
          onViewChange={(year, month) => setView({ year, month })}
          schedule={schedule.viewerModePreview}
          toggleHeartAction={toggleEventHeartAction}
        />
      </div>
    );
  }

  return (
    <main className="studio-shell">
      {copyToast ? (
        <div className="copy-toast" role="status">
          {copyToast}
        </div>
      ) : null}
      {loadingPrivate ? (
        // 잠금해제 핸드셰이크 2단계(여는 중). 패널의 "확인 중…"(검증)과 ⚠배너(활성) 사이
        // 단계를 명확히 보여 "확인됐는데 아직 안 보이는" 모호한 순간을 없앤다.
        <div className="private-loading private-unlocking" role="status" aria-live="polite">
          <span className="private-loading-spinner" aria-hidden="true" />
          <span className="private-unlocking-text">
            <strong>{isNarrow ? "🔓 비공개 레이어 여는 중…" : "🔓 비공개 레이어를 여는 중입니다…"}</strong>
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
          <p className="eyebrow studio-eyebrow">토리님 편집실</p>
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

        {/* 오른쪽: 역할·도구 */}
        <div className="studio-role-tools">
          {renderRoleBadge(true)}
          <button
            className={canReadPrivate ? "private-toggle active" : "private-toggle"}
            disabled={!canTogglePrivateLayer}
            onClick={togglePrivateLayer}
            type="button"
          >
            {canReadPrivate ? <EyeOff size={16} /> : <Eye size={16} />}
            {canReadPrivate ? "비공개 표시 중" : "비공개 일정 보기"}
          </button>
          {/* 시청자가 보는 공개 화면 전체보기 — 개발자·매니저·작업자 등 모든 역할이 본다. */}
          <button className="button" onClick={() => setViewerMode(true)} type="button">
            <Eye aria-hidden="true" size={16} />
            시청자 화면 미리보기
          </button>
          {actor.isAuthenticated ? (
            <form action="/api/auth/logout" method="post">
              <button
                className="button"
                onClick={() => startNav(isNarrow ? "계정 변경 중…" : "계정 선택 화면으로 이동 중입니다…")}
                type="submit"
              >
                계정변경
              </button>
            </form>
          ) : (
            <Link className="button" href="/login">
              로그인
            </Link>
          )}
        </div>
      </header>

      {/* 상단 액션바: (개발자면) 세션 안내 + 같은 줄에 관리/개발자/꾸미기 버튼을 역할별로 나열. */}
      <div className="studio-actionbar">
        {actor.role === "developer" ? (
          <span className="studio-actionbar-dev">
            <LockKeyhole aria-hidden="true" size={16} />
            🛠 개발자 세션입니다. 전체 캘린더를 관리 권한으로 보고 있습니다.
          </span>
        ) : null}
        <div className="studio-actionbar-tools">
          {canEdit ? (
            <button className="button" onClick={() => setModal("tags")} type="button">
              태그 편집
            </button>
          ) : null}
          {canEdit ? (
            <button className="button" onClick={() => setModal("members")} type="button">
              멤버 관리
            </button>
          ) : null}
          {actor.role === "developer" ? (
            <button className="button" onClick={() => setModal("developer")} type="button">
              🛠 접속자 현황
            </button>
          ) : null}
          {canDecorateCalendar ? (
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
              달력 꾸미기
            </Link>
          ) : null}
        </div>
      </div>

      {canReadPrivate && actor.role === "owner" ? (
        <div className="private-warning">
          <LockKeyhole aria-hidden="true" size={17} />
          ⚠ 비공개 일정 표시 중입니다. 방송 화면 공유에 주의하세요.
        </div>
      ) : null}

      <section className={`studio-workspace ${editorVisible ? "editor-open" : ""}`}>
        <aside className="studio-left-panel">
          <section>
            <h2>색상 필터</h2>
            <TagLegendEditor
              canEdit={false}
              filterIds={tagFilters}
              onToggleFilter={toggleTagFilter}
              palette={palette}
              tags={tags}
            />
            {/* 비공개(공개 아님) 일정만 골라보기 — 잠금 해제로 비공개가 보일 때만(개발자·소유자·매니저·작업자). */}
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
        </aside>

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
            className="studio-month-grid"
            aria-label="월간 달력"
            data-enter={monthDir}
            key={`${view.year}-${view.month}`}
            ref={monthGridRef}
          >
            {cells.map((cell, cellIndex) => {
              const covering = getEventsForDate(visibleEvents, cell.isoDate);
              const supportHere = covering.filter((e) => e.isSupport);
              const dateEvents = covering.filter((e) => !e.isSupport);
              // 드롭 삽입선이 이 칸의 어느 카드 앞에 올지(없으면 undefined, null이면 맨 끝).
              let dropLineBeforeId: string | null | undefined = undefined;
              if (dragEventId && dropSlot && dropSlot.day === cell.isoDate) {
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
                dragEventId && dropDate === cell.isoDate ? "drop-target" : ""
              ]
                .filter(Boolean)
                .join(" ");

              const numClass = day.isRed ? "red" : day.isSaturday ? "saturday" : "";

              return (
                <article
                  className={dayClass}
                  data-isodate={cell.isoDate}
                  key={cell.isoDate}
                  onClick={() => selectDate(cell.isoDate)}
                  role="button"
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
                        className="support-bar"
                        key={s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          // 매니저는 후원 설정 수정 시트를 띄운다(전체 편집 불가). 작업자는 읽기 전용.
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
                    {day.markName ? <em className="day-mark">{day.markName}</em> : null}
                  </div>
                  <div
                    className="studio-event-list"
                    style={
                      weekSupCount > 0 ? { paddingTop: 8 + weekSupCount * 20 } : undefined
                    }
                  >
                    {dateEvents.map((event, eventIndex) => {
                      const colors = eventColors(event);
                      const isSel = selectedEventId === event.id;
                      // 연결된 체인이면 체인 전체에 선택 테두리를 입힌다.
                      const inSelChain = selectedChainIds.has(event.id);
                      const { main, subs } = splitEventTitle(event.publicTitle);
                      const span = getEventSpan(
                        event,
                        cell.isoDate,
                        cell.weekday,
                        visibleEvents
                      );
                      const draggable = canEdit && !span.isMulti;
                      const pillClass = [
                        "studio-event-pill",
                        event.visibilityScope,
                        inSelChain ? "selected" : "",
                        isSel ? "primary-selected" : "",
                        isDimmedByFilter(event) ? "filter-dim" : "",
                        span.isMulti ? "span" : "",
                        span.isMulti && !span.roundLeft ? "no-left" : "",
                        span.isMulti && !span.roundRight ? "no-right" : "",
                        draggable ? "draggable" : "",
                        dragEventId === event.id ? "dragging-src" : ""
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
                          {mixStyle ? (
                            <>
                              {/* 무늬도 색과 같은 위치에서 부드럽게 사라지게(마스크) — 경계 흐릿 */}
                              <span
                                aria-hidden="true"
                                className="evt-pat"
                                data-color={colors[0].key}
                                style={mixedPatternMaskStyle(mixStyle, "a")}
                              />
                              <span
                                aria-hidden="true"
                                className="evt-pat"
                                data-color={colors[1].key}
                                style={mixedPatternMaskStyle(mixStyle, "b")}
                              />
                            </>
                          ) : null}
                          <div className="pill-main">
                            {/* 이어지는 칸은 제목을 투명하게 그려 시작 칸과 높이를 맞춘다. */}
                            {span.showTitle ? (
                              <strong>{main}</strong>
                            ) : (
                              <strong className="span-cont">{main || " "}</strong>
                            )}
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
                          </div>
                          {/* 일정 카드는 항상 펼침 고정. 이어지는 칸은 투명으로 높이만 맞춘다. */}
                          {subs.length > 0 ? (
                            <ul className={`pill-subs${span.showTitle ? "" : " span-cont"}`}>
                              {subs.map((sub, i) => (
                                <li key={i}>{sub}</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="event-editor-panel">
          {/* 매니저·작업자는 편집 불가 → 회색 폼 대신 깔끔한 읽기전용 상세를 보여준다(A1). */}
          {!canEdit ? (
            renderReadonlyDetail()
          ) : (
          /* key로 날짜가 바뀔 때마다 카드 내용이 재마운트 → 카드 전체가 살짝 쑥 내려오는 애니메이션. */
          <form onSubmit={saveEvent} key={selectedDate}>
            <div className="editor-heading">
              <div>
                <p className="eyebrow">{selectedEventId ? "일정 수정" : "새 일정"}</p>
                {/* key로 날짜가 바뀔 때마다 재마운트 → 날짜가 쓱 바뀌는 애니메이션으로 "옮겼다"를 인지. */}
                <h2 className="editor-date" key={selectedDate}>
                  {selectedDate}
                </h2>
              </div>
              <button className="button primary" disabled={!canEdit || pending} type="submit">
                <Save aria-hidden="true" size={16} />
                {pending ? "저장 중…" : "저장"}
              </button>
            </div>

            {actionError ? <div className="auth-warning">{actionError}</div> : null}

            <label>
              제목
              <textarea
                disabled={!canEdit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, publicTitle: event.target.value }))
                }
                placeholder="예: 풀트뱅"
                value={form.publicTitle}
              />
            </label>

            <label>
              공개 범위
              {canReadPrivate ? (
                <select
                  disabled={!canEdit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      visibilityScope: event.target.value as EventVisibilityScope
                    }))
                  }
                  value={form.visibilityScope}
                >
                  <option value="public">모두</option>
                  <option value="embargo">엠바고</option>
                  <option value="work">작업자</option>
                  {actor.role === "owner" ? <option value="owner_private">나만</option> : null}
                </select>
              ) : (
                // 비공개 레이어 잠김: 공개 범위는 "모두"로 고정. 비밀번호로 풀어야 토글이 열린다.
                <select disabled value="public" title="비공개 레이어를 풀면 엠바고·작업자·나만을 지정할 수 있습니다">
                  <option value="public">모두</option>
                </select>
              )}
            </label>

            {renderSupportEditor()}

            <section className="tag-picker" aria-label="태그 선택">
              <h3>
                태그 <span className="tag-picker-hint">최대 2개</span>
              </h3>
              <div>
                {legendTags.map((tag) => {
                  const color = palette.find((item) => item.key === tag.colorKey);
                  const selected = form.tagIds.includes(tag.id);
                  const full = !selected && form.tagIds.length >= 2;
                  return color ? (
                    <button
                      className={selected ? "selected" : ""}
                      data-color={color.key}
                      disabled={!canEdit || full}
                      key={tag.id}
                      onClick={() => selectTag(tag.id)}
                      style={{
                        backgroundColor: color.bgColor,
                        borderColor: color.borderColor,
                        color: color.textColor
                      }}
                      title={full ? "태그는 최대 2개까지 고를 수 있어요" : tag.displayName}
                      type="button"
                    >
                      {selected ? `${form.tagIds.indexOf(tag.id) + 1}. ` : ""}
                      {tag.displayName}
                    </button>
                  ) : null;
                })}
              </div>
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

            {/* #1: 선택한 날짜로 숲 공지 초안을 만든다(소유자/개발자 전용). */}
            {canEdit ? (
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
            className={`modal-card ${modal === "tags" || modal === "notice" ? "modal-card-wide" : ""}`}
            role="dialog"
          >
            <div className="modal-head">
              <h2>
                {modal === "passcode"
                  ? "비공개 일정"
                  : modal === "tags"
                    ? "태그 이름 · 색상 편집"
                    : modal === "notice"
                      ? "숲 공지 쓰기"
                      : modal === "developer"
                        ? "접속자 현황"
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

            {modal === "passcode" ? (
              <PrivateLayerPanel
                canManage={canEdit}
                onDone={() => setModal(null)}
                onUnlocked={() => {
                  // 팝업을 닫고, 서버에서 비공개 일정을 다시 불러오는 동안 "불러오는 중" 표시.
                  // pendingUnlockReveal: refresh 후 세션이 반영되면 위 useEffect가 표시를 확실히 켠다.
                  pendingUnlockReveal = true;
                  setModal(null);
                  setShowPrivate(true);
                  startLoadingPrivate(() => {
                    router.refresh();
                  });
                }}
                setPasscodeAction={setPasscodeAction}
              />
            ) : null}
            {modal === "tags" ? (
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
            {modal === "developer" ? <DeveloperPanel /> : null}
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
    </main>
  );
}

function createEmptyForm(): EventForm {
  return {
    publicTitle: "",
    endDateKey: "",
    isSupport: false,
    supportUrl: "",
    category: "stream",
    status: "scheduled",
    visibilityScope: "public",
    tagIds: [],
    primaryTagIds: []
  };
}

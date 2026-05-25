"use client";

import {
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Save,
  Trash2,
  X
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
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
  getMonthLabel,
  getSpanRunRange,
  getTodayKst,
  mixedEventStyle,
  mixedPatternMaskStyle,
  splitEventTitle
} from "@/lib/calendar/month";
import { useEqualChainHeights } from "@/lib/calendar/use-equal-chain-heights";
import {
  canDecorate,
  canEditSchedule,
  canReadOwnerPrivate,
  canReadPrivateLayer
} from "@/lib/permissions/roles";
import { deleteEventAction, saveEventAction } from "@/lib/schedules/event-actions";
import { toggleEventHeartAction } from "@/lib/schedules/heart-actions";
import { linkChainAction, unlinkPairAction } from "@/lib/schedules/link-actions";
import { addTagAction, removeTagAction, updateTagsAction } from "@/lib/schedules/tag-actions";
import { PublicPoster } from "@/components/poster/public-poster";
import { PrivateLayerPanel } from "@/components/private-layer/private-layer-panel";
import { TagLegendEditor } from "@/components/tags/tag-legend-editor";
import { TrustedMembersPanel } from "@/components/trusted-members/trusted-members-panel";
import { NoticeModal } from "@/components/notice/notice-modal";
import { setPasscodeAction } from "@/lib/private-layer/actions";

type StudioShellProps = {
  actor: CurrentActor;
  schedule: StudioSchedule;
  hasUnlockSession: boolean;
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

export function StudioShell({
  actor,
  schedule,
  hasUnlockSession
}: StudioShellProps) {
  const today = getTodayKst();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  // 방송사고 방지: 새로고침/진입 시 항상 공개(일반) 모드가 기본. 잠금 세션이 있어도
  // 사용자가 직접 토글해야 비공개 일정이 보인다.
  const [showPrivate, setShowPrivate] = useState(false);
  const [modal, setModal] = useState<null | "passcode" | "tags" | "members" | "notice">(null);
  const backdropPressRef = useRef(false); // 모달 배경 클릭 판정(텍스트 드래그 보호)
  // 새 일정 저장 진행 중인 임시 id → 실제 id 약속. 저장 직후 바로 "잇기"를 눌러도 temp id가
  // 서버로 새는 일 없이(=invalid uuid 방지), 저장이 끝나길 기다렸다 실제 id로 잇는다.
  const pendingSavesRef = useRef<Map<string, Promise<string | null>>>(new Map());
  // temp id면 저장 약속을 기다려 실제 id로, 실패면 null. 실제 id는 그대로.
  async function resolveEventId(id: string): Promise<string | null> {
    if (!id.startsWith("temp-")) {
      return id;
    }
    const p = pendingSavesRef.current.get(id);
    return p ? await p : null;
  }
  // 시청자 공개 화면 전체보기 (팝업이 아니라 화면 전체를 교체)
  const [viewerMode, setViewerMode] = useState(false);
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
  const [view, setView] = useState({
    year: schedule.calendar.defaultYear,
    month: schedule.calendar.defaultMonth
  });
  const [selectedDate, setSelectedDate] = useState(
    `${schedule.calendar.defaultYear}-${String(schedule.calendar.defaultMonth).padStart(2, "0")}-01`
  );
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const canEdit = canEditSchedule(actor.role);
  const canDecorateCalendar = canDecorate(actor.role);
  const canTogglePrivateLayer = actor.role !== "viewer";
  const canReadPrivate = canReadPrivateLayer(actor.role, hasUnlockSession) && showPrivate;

  function togglePrivateLayer() {
    if (hasUnlockSession) {
      setShowPrivate((value) => !value);
    } else {
      setModal("passcode");
    }
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
  // 이어진 일정 묶음 키 + 묶음 칸 높이 맞추기(글자 수 달라도 이음새 안 어긋나게).
  const chainKeys = useMemo(() => buildChainKeys(visibleEvents), [visibleEvents]);
  const paintGroups = useMemo(() => buildPaintGroups(visibleEvents), [visibleEvents]);
  const monthGridRef = useRef<HTMLDivElement>(null);
  useEqualChainHeights(monthGridRef, [visibleEvents, view]);
  // 선택한 일정이 속한 연결 체인 전체를 하이라이트 대상으로 삼는다.
  const selectedChainIds = useMemo(
    () => getLinkedChainIds(selectedEventId, visibleEvents),
    [selectedEventId, visibleEvents]
  );
  const [form, setForm] = useState<EventForm>(() => createEmptyForm());

  // D: 이 일정의 대표 태그(최대 2개) 색. 2개면 그 일정 안에서 그라데이션(경계는 일정 가운데).
  function eventColors(event: StudioScheduleEvent) {
    return getEventTagColors(event, tags, palette);
  }

  function moveMonth(offset: number) {
    setView((current) => {
      const next = getAdjacentMonth(current.year, current.month, offset);
      setSelectedDate(`${next.year}-${String(next.month).padStart(2, "0")}-01`);
      setSelectedEventId(null);
      setForm(createEmptyForm());
      return next;
    });
  }

  function selectDate(isoDate: string) {
    setSelectedDate(isoDate);
    setSelectedEventId(null);
    setForm(createEmptyForm());
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
  }

  function saveEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    const existing = events.find((e) => e.id === form.id);
    const isNew = !form.id;
    const tempId = form.id ?? `temp-${Math.random().toString(36).slice(2)}`;
    const scope: EventVisibilityScope = canReadPrivate ? form.visibilityScope : "public";
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
    startTransition(async () => {
      const result = await deleteEventAction(targetId);
      if (!result.ok) {
        setActionError(result.error);
        setEvents(snapshot); // 실패 → 되돌림
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
  function applyTagUpdates(updates: { id: string; displayName: string; colorKey: ColorKey }[]) {
    setTags((prev) =>
      prev.map((t) => {
        const u = updates.find((x) => x.id === t.id);
        return u ? { ...t, displayName: u.displayName, colorKey: u.colorKey } : t;
      })
    );
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
      if (key === "c" && selectedEventId && !window.getSelection()?.toString()) {
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

  // 시청자 화면 전체보기: 스튜디오 UI를 숨기고 공개 화면만 그대로 보여준다.
  if (viewerMode) {
    return (
      <div className="viewer-fullscreen">
        <div className="viewer-fullscreen-bar">
          <button className="button" onClick={() => setViewerMode(false)} type="button">
            <ChevronLeft aria-hidden="true" size={16} />
            편집실로 돌아가기
          </button>
          <span className="viewer-fullscreen-label">
            <Eye aria-hidden="true" size={15} />
            시청자가 보는 공개 화면입니다 (비공개 일정 미포함)
          </span>
        </div>
        <PublicPoster
          initialMonth={view.month}
          initialYear={view.year}
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
      <header className="studio-topbar">
        <div>
          <p className="eyebrow">빅토리 편집실</p>
          <h1>{schedule.calendar.title}</h1>
        </div>

        <div className="studio-month-nav" aria-label="월 이동">
          <button onClick={() => moveMonth(-1)} title="이전 달" type="button">
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <strong>{getMonthLabel(view.year, view.month)}</strong>
          <button onClick={() => moveMonth(1)} title="다음 달" type="button">
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>

        <div className="studio-role-tools">
          <div className={`actor-badge ${actor.role}`}>
            <strong>{ROLE_LABEL[actor.role]}</strong>
            <span>{actor.email ?? "비로그인"}</span>
          </div>
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
            시청자 화면 보기
          </button>
          {actor.isAuthenticated ? (
            <form action="/api/auth/logout" method="post">
              <button className="button" type="submit">
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

      {actor.role === "developer" ? (
        <div className="developer-warning">
          <LockKeyhole aria-hidden="true" size={17} />
          🛠 개발자 세션입니다. 전체 캘린더를 관리 권한으로 보고 있습니다.
        </div>
      ) : null}

      {canReadPrivate ? (
        <div className="private-warning">
          <LockKeyhole aria-hidden="true" size={17} />
          ⚠ 비공개 일정 표시 중입니다. 방송 화면 공유에 주의하세요.
        </div>
      ) : null}

      <section className="studio-workspace">
        <aside className="studio-left-panel">
          <section>
            <h2>색상 안내</h2>
            <TagLegendEditor
              canEdit={false}
              palette={palette}
              tags={tags}
              updateTagsAction={updateTagsAction}
            />
          </section>

          {canEdit ? (
            <section>
              <h2>관리</h2>
              <button className="button" onClick={() => setModal("tags")} type="button">
                태그 이름 · 색상 편집
              </button>
              <button className="button" onClick={() => setModal("members")} type="button">
                매니저 · 작업자 관리
              </button>
            </section>
          ) : null}

          {/* 꾸미기는 신뢰 멤버(매니저·작업자)도 가능 — 일정 편집 권한과 별개. */}
          {canDecorateCalendar ? (
            <section>
              <h2>꾸미기</h2>
              <Link className="button" href={`/studio/decorate/${view.year}/${view.month}`}>
                달력 꾸미기
              </Link>
            </section>
          ) : null}
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
          <div className="studio-month-grid" aria-label="월간 달력" ref={monthGridRef}>
            {cells.map((cell) => {
              const covering = getEventsForDate(visibleEvents, cell.isoDate);
              const supportHere = covering.filter((e) => e.isSupport);
              const dateEvents = covering.filter((e) => !e.isSupport);
              const day = classifyDay(cell.isoDate, cell.weekday, today);

              const dayClass = [
                "studio-day",
                cell.inCurrentMonth ? "" : "outside",
                selectedDate === cell.isoDate ? "selected" : "",
                day.isPast ? "past" : "future",
                day.isToday ? "today" : ""
              ]
                .filter(Boolean)
                .join(" ");

              const numClass = day.isRed ? "red" : day.isSaturday ? "saturday" : "";

              return (
                <article
                  className={dayClass}
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
                          selectEvent(s);
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
                      supportLanes.count > 0
                        ? { paddingTop: 8 + supportLanes.count * 20 }
                        : undefined
                    }
                  >
                    {dateEvents.map((event) => {
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
                      const pillClass = [
                        "studio-event-pill",
                        event.visibilityScope,
                        inSelChain ? "selected" : "",
                        isSel ? "primary-selected" : "",
                        span.isMulti ? "span" : "",
                        span.isMulti && !span.roundLeft ? "no-left" : "",
                        span.isMulti && !span.roundRight ? "no-right" : ""
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
                          data-mixed={mixed ? "" : undefined}
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePillClick(event.id);
                          }}
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
                                <Trash2 aria-hidden="true" size={16} />
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
          <form onSubmit={saveEvent}>
            <div className="editor-heading">
              <div>
                <p className="eyebrow">{selectedEventId ? "일정 수정" : "새 일정"}</p>
                <h2>{selectedDate}</h2>
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

            <div className="support-toggle">
              <span>🌱 업 도움 설정</span>
              <button
                aria-checked={form.isSupport}
                className={`switch ${form.isSupport ? "on" : ""}`}
                disabled={!canEdit}
                onClick={() =>
                  setForm((current) => ({ ...current, isSupport: !current.isSupport }))
                }
                role="switch"
                type="button"
              >
                <span className="switch-knob" />
              </button>
            </div>

            {form.isSupport ? (
              <>
                <div className="support-duration">
                  <span className="duration-title">업 도움 기간</span>
                  <div className="duration-chips">
                    {SUPPORT_DURATIONS.map((opt) => {
                      const end = addDaysIso(selectedDate, opt.days);
                      const active = (form.endDateKey || selectedDate) === end;
                      return (
                        <button
                          className={active ? "active" : ""}
                          disabled={!canEdit}
                          key={opt.days}
                          onClick={() =>
                            setForm((current) => ({ ...current, endDateKey: end }))
                          }
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
                      disabled={!canEdit}
                      min={selectedDate}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, endDateKey: event.target.value }))
                      }
                      type="date"
                      value={form.endDateKey || selectedDate}
                    />
                  </div>
                </div>
                <label>
                  업 도움 링크
                  <input
                    disabled={!canEdit}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, supportUrl: event.target.value }))
                    }
                    placeholder="숲 게시글 URL"
                    type="url"
                    value={form.supportUrl}
                  />
                </label>
              </>
            ) : null}

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
        </aside>
      </section>

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
                onUnlocked={() => setShowPrivate(true)}
                setPasscodeAction={setPasscodeAction}
              />
            ) : null}
            {modal === "tags" ? (
              <TagLegendEditor
                addTagAction={addTagAction}
                canEdit
                onTagAdded={applyTagAdd}
                onTagRemoved={applyTagRemove}
                onTagsUpdated={applyTagUpdates}
                palette={palette}
                removeTagAction={removeTagAction}
                tags={tags}
                updateTagsAction={updateTagsAction}
              />
            ) : null}
            {modal === "members" ? <TrustedMembersPanel /> : null}
            {modal === "notice" ? (
              <NoticeModal dateKey={selectedDate} onClose={() => setModal(null)} />
            ) : null}
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

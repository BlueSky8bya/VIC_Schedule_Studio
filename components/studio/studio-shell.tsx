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
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type {
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
  buildLinkChain,
  classifyDay,
  getAdjacentMonth,
  getEventDateKey,
  getEventsForDate,
  getEventSpan,
  getLinkedChainIds,
  getMonthLabel,
  getTodayKst,
  splitEventTitle
} from "@/lib/calendar/month";
import {
  canDecorate,
  canEditSchedule,
  canReadOwnerPrivate,
  canReadPrivateLayer
} from "@/lib/permissions/roles";
import { deleteEventAction, saveEventAction } from "@/lib/schedules/event-actions";
import { toggleEventHeartAction } from "@/lib/schedules/heart-actions";
import { linkChainAction, unlinkPairAction } from "@/lib/schedules/link-actions";
import { addTagAction, updateTagsAction } from "@/lib/schedules/tag-actions";
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
  const router = useRouter();
  const today = getTodayKst();
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  // 방송사고 방지: 새로고침/진입 시 항상 공개(일반) 모드가 기본. 잠금 세션이 있어도
  // 사용자가 직접 토글해야 비공개 일정이 보인다.
  const [showPrivate, setShowPrivate] = useState(false);
  const [modal, setModal] = useState<null | "passcode" | "tags" | "members" | "notice">(null);
  const backdropPressRef = useRef(false); // 모달 배경 클릭 판정(텍스트 드래그 보호)
  // 시청자 공개 화면 전체보기 (팝업이 아니라 화면 전체를 교체)
  const [viewerMode, setViewerMode] = useState(false);
  const events = schedule.events;
  // #3: "기타" 태그는 색상 안내·태그 선택 모두에서 항상 맨 끝.
  const legendTags = useMemo(
    () =>
      [...schedule.tags].sort(
        (a, b) => Number(a.displayName === "기타") - Number(b.displayName === "기타")
      ),
    [schedule.tags]
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

      if (alreadyLinked) {
        startTransition(async () => {
          const result = await unlinkPairAction(earlier.id);
          if (!result.ok) setActionError(result.error);
          else router.refresh();
        });
      } else {
        const chain = buildLinkChain(anchor, target, events);
        if (chain) {
          startTransition(async () => {
            const result = await linkChainAction(chain);
            if (!result.ok) setActionError(result.error);
            else router.refresh();
          });
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
  // 선택한 일정이 속한 연결 체인 전체를 하이라이트 대상으로 삼는다.
  const selectedChainIds = useMemo(
    () => getLinkedChainIds(selectedEventId, visibleEvents),
    [selectedEventId, visibleEvents]
  );
  const [form, setForm] = useState<EventForm>(() => createEmptyForm());

  function eventColor(event: StudioScheduleEvent) {
    const tagId = event.primaryTagIds[0] ?? event.tagIds[0];
    const tag = tagId ? schedule.tags.find((t) => t.id === tagId) : undefined;
    return tag ? schedule.palette.find((p) => p.key === tag.colorKey) : undefined;
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

    setActionError(null);
    startTransition(async () => {
      const result = await saveEventAction({
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
        // 비공개 레이어를 풀지 않았으면 공개 범위는 무조건 "모두(public)"로 강제.
        // 엠바고/작업자/나만은 비공개 모드(비밀번호 해제)에서만 지정할 수 있다.
        visibilityScope: canReadPrivate ? form.visibilityScope : "public",
        tagIds: form.tagIds,
        primaryTagIds: form.primaryTagIds.slice(0, 2),
        isSupport: form.isSupport,
        supportUrl: form.supportUrl
      });

      if (!result.ok) {
        setActionError(result.error);
        return;
      }

      setSelectedEventId(null);
      setForm(createEmptyForm());
      router.refresh();
    });
  }

  function deleteEvent(targetId: string) {
    if (!canEdit) {
      return;
    }

    setActionError(null);
    startTransition(async () => {
      const result = await deleteEventAction(targetId);
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      if (selectedEventId === targetId) {
        setSelectedEventId(null);
        setForm(createEmptyForm());
      }
      router.refresh();
    });
  }

  // 일정 하나에 태그 하나. 같은 태그를 다시 누르면 해제.
  function selectTag(tagId: string) {
    setForm((current) => {
      const selected = current.tagIds[0] === tagId;
      return {
        ...current,
        tagIds: selected ? [] : [tagId],
        primaryTagIds: selected ? [] : [tagId]
      };
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
    setActionError(null);
    startTransition(async () => {
      const result = await saveEventAction({
        id: undefined,
        dateKey: selectedDate,
        endDateKey:
          payload.isSupport && payload.spanDays > 0
            ? addDaysIso(selectedDate, payload.spanDays)
            : "",
        startTime: "",
        endTime: "",
        isAllDay: true,
        publicTitle: payload.publicTitle,
        publicDescription: "",
        category: payload.category,
        status: payload.status,
        // 비공개 모드가 아니면 공개로 강제(저장 로직과 동일 규칙).
        visibilityScope: canReadPrivate ? payload.visibilityScope : "public",
        tagIds: payload.tagIds,
        primaryTagIds: payload.primaryTagIds.slice(0, 2),
        isSupport: payload.isSupport,
        supportUrl: payload.supportUrl
      });
      if (!result.ok) {
        setActionError(result.error);
        return;
      }
      flashToast(`${selectedDate}에 붙여넣음`);
      router.refresh();
    });
  }

  // 일정 복사/붙여넣기 단축키. 입력칸·팝업·텍스트선택 중에는 가로채지 않는다.
  useEffect(() => {
    if (!canEdit) return;
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || t?.isContentEditable || modal) return;
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
              palette={schedule.palette}
              tags={schedule.tags}
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
          <div className="studio-month-grid" aria-label="월간 달력">
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
                      const color = eventColor(event);
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
                      return (
                        <div
                          className={pillClass}
                          data-color={color?.key}
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePillClick(event.id);
                          }}
                          role="button"
                          style={
                            color
                              ? {
                                  backgroundColor: color.bgColor,
                                  color: color.textColor,
                                  borderColor: color.borderColor
                                }
                              : undefined
                          }
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                              handlePillClick(event.id);
                            }
                          }}
                        >
                          <div className="pill-main">
                            {span.showTitle ? (
                              <strong>{main}</strong>
                            ) : (
                              <strong className="span-cont">&nbsp;</strong>
                            )}
                            {span.showTitle && isSel && canEdit ? (
                              <button
                                aria-label="일정 삭제"
                                className="pill-delete"
                                disabled={pending}
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
                          {/* 일정 카드는 항상 펼침 고정 — 토글 없음(시청자·꾸미기와 통일). */}
                          {span.showTitle && subs.length > 0 ? (
                            <ul className="pill-subs">
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
              <h3>태그</h3>
              <div>
                {legendTags.map((tag) => {
                  const color = schedule.palette.find((item) => item.key === tag.colorKey);
                  const selected = form.tagIds[0] === tag.id;
                  return color ? (
                    <button
                      className={selected ? "selected" : ""}
                      data-color={color.key}
                      disabled={!canEdit}
                      key={tag.id}
                      onClick={() => selectTag(tag.id)}
                      style={{
                        backgroundColor: color.bgColor,
                        borderColor: color.borderColor,
                        color: color.textColor
                      }}
                      type="button"
                    >
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
                disabled={pending}
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
                key={schedule.tags.map((t) => t.id).join(",")}
                palette={schedule.palette}
                tags={schedule.tags}
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

"use client";

import { FormEvent, useMemo, useState } from "react";
import type {
  EventStatus,
  StudioSchedule,
  StudioScheduleEvent
} from "@/lib/domain/schedule-types";

type StudioShellProps = {
  schedule: StudioSchedule;
  viewerRole?: "viewer" | "owner" | "manager" | "worker";
};

type CalendarMode = "general" | "work";

type DraftForm = {
  publicTitle: string;
  startsAt: string;
  endsAt: string;
  category: StudioScheduleEvent["category"];
};

export function StudioShell({
  schedule,
  viewerRole = "viewer"
}: StudioShellProps) {
  const canUseWorkToggle = ["owner", "manager", "worker"].includes(viewerRole);
  const [mode, setMode] = useState<CalendarMode>("general");
  const [localEvents, setLocalEvents] = useState<StudioScheduleEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => `${schedule.calendar.month}-01`);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftForm>(() => createDraftForm());

  const allEvents = useMemo(
    () => [...schedule.events, ...localEvents],
    [schedule.events, localEvents]
  );
  const visibleEvents = useMemo(
    () =>
      mode === "work"
        ? allEvents
        : allEvents.filter((event) => event.status !== "draft"),
    [allEvents, mode]
  );
  const days = useMemo(
    () => buildMonthDays(schedule.calendar.month),
    [schedule.calendar.month]
  );
  const selectedDateEvents = visibleEvents.filter((event) =>
    event.startsAt.startsWith(selectedDate)
  );
  const selectedEvent =
    allEvents.find((event) => event.id === selectedEventId) ??
    selectedDateEvents[0] ??
    null;

  function handleDayClick(date: string) {
    setSelectedDate(date);
    setSelectedEventId(null);
    setDraft(createDraftForm());
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextEvent: StudioScheduleEvent = {
      id: `local-${Date.now()}`,
      startsAt: toKstDateTime(selectedDate, draft.startsAt),
      endsAt: toKstDateTime(selectedDate, draft.endsAt),
      publicTitle: draft.publicTitle || "새 일정",
      status: "scheduled",
      category: draft.category
    };

    setLocalEvents((events) => [...events, nextEvent]);
    setSelectedEventId(nextEvent.id);
    setDraft(createDraftForm());
  }

  return (
    <main className="studio-shell">
      <aside className="studio-sidebar" aria-label="Calendar tools">
        <p className="eyebrow">Calendar</p>
        <h1>{schedule.calendar.displayName}</h1>

        {canUseWorkToggle ? (
          <div className="mode-toggle" aria-label="Calendar mode">
            <button
              className={mode === "general" ? "active" : ""}
              onClick={() => setMode("general")}
              type="button"
            >
              일반
            </button>
            <button
              className={mode === "work" ? "active" : ""}
              onClick={() => setMode("work")}
              type="button"
            >
              작업
            </button>
          </div>
        ) : null}

        <nav aria-label="Studio sections">
          <a href="#calendar">월간 달력</a>
          <a href="#day-editor">일정 설정</a>
          <a href="#requests">요청함</a>
          <a href="#proposals">제안</a>
        </nav>

        <section className="sidebar-block">
          <h2>운영 요약</h2>
          <dl className="metric-list">
            <div>
              <dt>공개 일정</dt>
              <dd>{visibleEvents.length}</dd>
            </div>
            <div>
              <dt>요청</dt>
              <dd>{schedule.requests.length}</dd>
            </div>
            <div>
              <dt>제안</dt>
              <dd>{schedule.proposals.length}</dd>
            </div>
          </dl>
        </section>
      </aside>

      <section className="studio-main" id="calendar">
        <header className="studio-toolbar">
          <div>
            <strong>{schedule.calendar.month}</strong>
            <span>Asia/Seoul fixed · {mode === "general" ? "일반 모드" : "작업 모드"}</span>
          </div>
          <div className="studio-mode">{selectedDate}</div>
        </header>

        <div className="calendar-weekdays" aria-hidden="true">
          {["월", "화", "수", "목", "금", "토", "일"].map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>

        <div className="studio-calendar" aria-label="Monthly calendar">
          {days.map((day) => {
            const events = visibleEvents.filter((event) =>
              event.startsAt.startsWith(day.isoDate)
            );
            const isSelected = day.isoDate === selectedDate;

            return (
              <button
                className={`calendar-day ${isSelected ? "selected" : ""}`}
                key={day.isoDate}
                onClick={() => handleDayClick(day.isoDate)}
                type="button"
              >
                <span className="calendar-date">{day.dayOfMonth}</span>
                <span className="calendar-events">
                  {events.slice(0, 3).map((event) => (
                    <span
                      className={`calendar-event ${event.category}`}
                      key={event.id}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        setSelectedDate(day.isoDate);
                        setSelectedEventId(event.id);
                      }}
                    >
                      {event.publicTitle}
                    </span>
                  ))}
                  {events.length > 3 ? (
                    <span className="calendar-more">+{events.length - 3}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        <section className="studio-queues">
          <div id="proposals">
            <h2>Viewer Proposals</h2>
            {schedule.proposals.map((proposal) => (
              <p key={proposal.id}>
                {proposal.content} · {proposal.voteCount} votes
              </p>
            ))}
          </div>
          <div id="requests">
            <h2>Request Inbox</h2>
            {schedule.requests.map((request) => (
              <p key={request.id}>
                {request.title} · {request.state}
              </p>
            ))}
          </div>
        </section>
      </section>

      <aside className="studio-drawer" id="day-editor" aria-label="Design and event editor">
        <section className="drawer-block">
          <p className="eyebrow">Design</p>
          <h2>포스터 스타일</h2>
          <div className="style-swatches" aria-label="Poster color options">
            <button className="swatch mint" type="button" aria-label="Mint" />
            <button className="swatch coral" type="button" aria-label="Coral" />
            <button className="swatch amber" type="button" aria-label="Amber" />
          </div>
          <p className="drawer-note">공개 포스터는 같은 일정 데이터를 사용해 안정적으로 렌더링됩니다.</p>
        </section>

        <section className="drawer-block">
          <p className="eyebrow">Selected Day</p>
          <h2>{selectedDate}</h2>
          <form className="event-form" onSubmit={handleSubmit}>
            <label>
              일정 제목
              <input
                onChange={(event) =>
                  setDraft((value) => ({ ...value, publicTitle: event.target.value }))
                }
                placeholder="방송 제목"
                value={draft.publicTitle}
              />
            </label>
            <div className="time-row">
              <label>
                시작
                <input
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, startsAt: event.target.value }))
                  }
                  type="time"
                  value={draft.startsAt}
                />
              </label>
              <label>
                종료
                <input
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, endsAt: event.target.value }))
                  }
                  type="time"
                  value={draft.endsAt}
                />
              </label>
            </div>
            <label>
              분류
              <select
                onChange={(event) =>
                  setDraft((value) => ({
                    ...value,
                    category: event.target.value as DraftForm["category"]
                  }))
                }
                value={draft.category}
              >
                <option value="stream">방송</option>
                <option value="collab">합방</option>
                <option value="notice">공지</option>
                <option value="support">후원</option>
              </select>
            </label>
            <button className="button primary" type="submit">
              일정 설정
            </button>
          </form>
        </section>

        <section className="drawer-block">
          <p className="eyebrow">Selected Event</p>
          <h2>{selectedEvent?.publicTitle ?? "일정 없음"}</h2>
          {selectedEvent ? (
            <dl>
              <div>
                <dt>공개 제목</dt>
                <dd>{selectedEvent.publicTitle}</dd>
              </div>
              <div>
                <dt>상태</dt>
                <dd>{formatStatus(selectedEvent.status)}</dd>
              </div>
              {mode === "work" ? (
                <>
                  <div>
                    <dt>비공개 제목</dt>
                    <dd>{selectedEvent.privateMeta?.privateTitle ?? "없음"}</dd>
                  </div>
                  <div>
                    <dt>코드네임</dt>
                    <dd>{selectedEvent.privateMeta?.codename ?? "없음"}</dd>
                  </div>
                </>
              ) : null}
            </dl>
          ) : null}
        </section>
      </aside>
    </main>
  );
}

function buildMonthDays(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDate = new Date(year, monthNumber, 0).getDate();

  return Array.from({ length: lastDate }, (_, index) => {
    const dayOfMonth = index + 1;
    return {
      dayOfMonth,
      isoDate: `${month}-${String(dayOfMonth).padStart(2, "0")}`
    };
  });
}

function createDraftForm(): DraftForm {
  return {
    publicTitle: "",
    startsAt: "20:00",
    endsAt: "22:00",
    category: "stream"
  };
}

function toKstDateTime(date: string, time: string) {
  return `${date}T${time}:00+09:00`;
}

function formatStatus(status: EventStatus) {
  const labels: Record<EventStatus, string> = {
    draft: "초안",
    scheduled: "예정",
    live: "진행 중",
    done: "완료",
    cancelled: "취소"
  };

  return labels[status];
}

import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";
import { getTodayKst } from "@/lib/calendar/month";

/** Synthetic data for guarded VISUAL_TEST_FIXTURE routes only. No DB calls. */
export function supportContextFixture() {
  const today = getTodayKst();
  const offset = (delta: number) => {
    const date = new Date(`${today}T00:00:00+09:00`);
    date.setUTCDate(date.getUTCDate() + delta);
    return new Date(date.getTime() + 9 * 3600000).toISOString().slice(0, 10);
  };
  const base = (id: string, date: string, title: string): PublicScheduleEvent => ({
    id, startsAt: `${date}T20:00:00+09:00`, isAllDay: true, publicTitle: title,
    status: "scheduled", visibilityScope: "public", category: "stream", tagIds: [], primaryTagIds: [], sortOrder: 0
  });
  const notices: PublicScheduleEvent[] = [
    { ...base("cozy-period-vote", offset(-2), "빅토리의 다음 무대를 응원하는 시청자 인기 투표에 참여해 주세요"), isSupport: true, supportKind: "period", endDateKey: offset(1), supportUrl: "https://example.com/period-vote" },
    { ...base("cozy-period-goods", offset(-1), "가을 한정 굿즈 사전 신청과 배송 일정 안내를 확인해 주세요"), isSupport: true, supportKind: "period", endDateKey: offset(2), supportUrl: "https://example.com/period-goods" },
    { ...base("cozy-support", today, "새 방송 코너에서 함께 나눌 시청자 여러분의 사연을 모집합니다"), isSupport: true, supportKind: "up", endDateKey: offset(3), supportUrl: "https://example.com/support" },
    { ...base("cozy-one-day", offset(5), "방송 기념일 안내"), isSupport: true, supportKind: "period", supportUrl: "https://example.com/one-day" }
  ];
  const events = [...notices, ...Array.from({ length: 11 }, (_, i) => [
    base(`cozy-stream-${i}-a`, offset(i - 3), "목요일 이야기 나누기\n시청자와 함께하는 방송"),
    { ...base(`cozy-stream-${i}-b`, offset(i - 3), "게임 이어서 달려요\n새로운 이야기를 함께 만들어요"), sortOrder: 1 }
  ]).flat()];
  return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)), focusDate: today, events };
}

/** Fixed long month without notices, for header-to-toolbar framing. */
export function agendaFrameFixture() {
  const events: PublicScheduleEvent[] = Array.from({ length: 31 }, (_, i) => ({
    id: `frame-stream-${i + 1}`, startsAt: `2026-07-${String(i + 1).padStart(2, "0")}T20:00:00+09:00`,
    isAllDay: true, publicTitle: "시청자와 함께하는 방송\n오늘의 이야기를 나눠요", status: "scheduled",
    visibilityScope: "public", category: "stream", tagIds: [], primaryTagIds: [], sortOrder: 0
  }));
  return { year: 2026, month: 7, focusDate: "2026-07-15", events };
}

/** Fixed19/20 reading boundary. Only up-support expiry follows real KST, with no clock spoofing. */
export function readingContextFixture() {
  const base = (id: string, date: string, title: string): PublicScheduleEvent => ({
    id, startsAt: `${date}T20:00:00+09:00`, isAllDay: true, publicTitle: title,
    status: "scheduled", visibilityScope: "public", category: "stream", tagIds: [], primaryTagIds: [], sortOrder: 0
  });
  const supportEnd = getTodayKst() > "2026-10-24" ? getTodayKst() : "2026-10-24";
  const notices: PublicScheduleEvent[] = [
    { ...base("reading-ended-19", "2026-10-18", "19일까지 진행한 지난 안내 · 20일에는 종료됩니다"), isSupport: true, supportKind: "period", endDateKey: "2026-10-19", supportUrl: "https://example.com/ended-19" },
    { ...base("reading-vote", "2026-10-18", "빅토리의 다음 무대를 응원하는 시청자 인기 투표에 참여해 주세요"), isSupport: true, supportKind: "period", endDateKey: "2026-10-22", supportUrl: "https://example.com/reading-vote" },
    { ...base("reading-goods", "2026-10-19", "가을 한정 굿즈 사전 신청과 배송 일정 안내를 확인해 주세요"), isSupport: true, supportKind: "period", endDateKey: "2026-10-23", supportUrl: "https://example.com/reading-goods" },
    { ...base("reading-story", "2026-10-20", "새 방송 코너에서 함께 나눌 시청자 여러분의 사연을 모집합니다"), isSupport: true, supportKind: "up", endDateKey: supportEnd, supportUrl: "https://example.com/reading-story" }
  ];
  const events = [...notices, ...Array.from({ length: 7 }, (_, index) => {
    const day = index + 18, date = `2026-10-${day}`;
    return [
      base(`reading-stream-${day}-a`, date, day === 19
        ? "긴 방송 이야기 나누기\n시청자와 함께하는 방송\n지난 방송 다시 이야기하기\n새로운 코너 함께 정하기\n오늘의 사연 나누기\n다음 방송에서 만나요"
        : "함성일 이야기 나누기\n시청자와 함께하는 방송"),
      { ...base(`reading-stream-${day}-b`, date, "게임 이어서 달려요\n새로운 이야기를 함께 만들어요"), sortOrder: 1 }
    ];
  }).flat()];
  return { year: 2026, month: 10, focusDate: "2026-10-20", events };
}

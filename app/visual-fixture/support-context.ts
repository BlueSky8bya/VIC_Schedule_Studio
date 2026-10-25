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

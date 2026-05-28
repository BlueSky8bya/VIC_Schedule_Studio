import { describe, expect, it } from "vitest";
import { getEventSpan } from "@/lib/calendar/month";
import type { StudioScheduleEvent } from "@/lib/domain/schedule-types";

// getEventSpan용 최소 일정 객체. 체인 판정에 쓰는 필드(날짜·linkNext·대표 태그)만 의미 있다.
function ev(part: Partial<StudioScheduleEvent> & { id: string; startsAt: string }): StudioScheduleEvent {
  return {
    isAllDay: true,
    publicTitle: part.id,
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds: [],
    primaryTagIds: [],
    sortOrder: 0,
    ...part
  };
}

const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

describe("getEventSpan 이어짐(체인) 판정", () => {
  it("맞닿는 변 색이 같은 link_next 쌍은 이어진다(모서리 각짐)", () => {
    const a = ev({ id: "a", startsAt: "2026-05-10", primaryTagIds: ["t1"], linkNext: "b" });
    const b = ev({ id: "b", startsAt: "2026-05-11", primaryTagIds: ["t1"] });
    const all = [a, b];

    const aSpan = getEventSpan(a, "2026-05-10", weekdayOf("2026-05-10"), all);
    const bSpan = getEventSpan(b, "2026-05-11", weekdayOf("2026-05-11"), all);

    expect(aSpan.roundRight).toBe(false); // a의 오른쪽 → b로 이어짐
    expect(bSpan.roundLeft).toBe(false); // b의 왼쪽 ← a에서 이어짐
  });

  it("색이 다른 link_next 쌍은 이어지지 않는다(버그 수정: 엠바고+다른 태그)", () => {
    const a = ev({ id: "a", startsAt: "2026-05-10", primaryTagIds: ["t1"], linkNext: "b" });
    const b = ev({ id: "b", startsAt: "2026-05-11", primaryTagIds: ["t2"] });
    const all = [a, b];

    const aSpan = getEventSpan(a, "2026-05-10", weekdayOf("2026-05-10"), all);
    const bSpan = getEventSpan(b, "2026-05-11", weekdayOf("2026-05-11"), all);

    expect(aSpan.roundRight).toBe(true); // 색이 달라 붙지 않는다
    expect(bSpan.roundLeft).toBe(true);
    expect(aSpan.isMulti).toBe(false); // 이어지지 않으니 단독 칸
    expect(bSpan.isMulti).toBe(false);
  });

  it('"A|B"+"B"처럼 맞닿는 변만 같으면 이어진다(부분 일치 허용)', () => {
    const a = ev({ id: "a", startsAt: "2026-05-10", primaryTagIds: ["t1", "t2"], linkNext: "b" });
    const b = ev({ id: "b", startsAt: "2026-05-11", primaryTagIds: ["t2"] });
    const all = [a, b];

    const aSpan = getEventSpan(a, "2026-05-10", weekdayOf("2026-05-10"), all);
    const bSpan = getEventSpan(b, "2026-05-11", weekdayOf("2026-05-11"), all);

    expect(aSpan.roundRight).toBe(false); // a의 오른쪽 변(t2) == b의 왼쪽 변(t2)
    expect(bSpan.roundLeft).toBe(false);
  });

  it("단일 멀티데이 일정은 link_next 없이도 자기 칸들끼리 이어진다", () => {
    const m = ev({
      id: "m",
      startsAt: "2026-05-10",
      endDateKey: "2026-05-12",
      primaryTagIds: ["t1"]
    });
    const all = [m];

    const startSpan = getEventSpan(m, "2026-05-10", weekdayOf("2026-05-10"), all);
    const midSpan = getEventSpan(m, "2026-05-11", weekdayOf("2026-05-11"), all);
    const endSpan = getEventSpan(m, "2026-05-12", weekdayOf("2026-05-12"), all);

    expect(startSpan.roundLeft).toBe(true); // 시작 칸 왼쪽은 둥글게
    expect(startSpan.roundRight).toBe(false); // 다음 칸으로 이어짐
    expect(midSpan.roundLeft).toBe(false);
    expect(midSpan.roundRight).toBe(false);
    expect(endSpan.roundRight).toBe(true); // 끝 칸 오른쪽은 둥글게
    expect(startSpan.isMulti).toBe(true);
  });
});

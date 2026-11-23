import { describe, expect, it } from "vitest";
import { buildChainJoins, getEventDateKey, getEventSpan } from "@/lib/calendar/month";
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
// 화면과 같은 길: 그 주의 칸들로 이음을 먼저 판정하고(buildChainJoins), 칸 모양은 그 판정만 따른다.
function joinsOf(all: StudioScheduleEvent[], days: string[]) {
  return buildChainJoins(
    days.map((isoDate) => ({ isoDate, weekday: weekdayOf(isoDate) })),
    (isoDate) => all.filter((e) => getEventDateKey(e) === isoDate).sort((x, y) => x.sortOrder - y.sortOrder)
  );
}
const DAYS = ["2026-05-11", "2026-05-12", "2026-05-13"]; // 월·화·수 — 주 경계 없음

describe("getEventSpan 이어짐(체인) 판정", () => {
  it("맞닿는 변 색이 같은 link_next 쌍은 이어진다(모서리 각짐)", () => {
    const a = ev({ id: "a", startsAt: "2026-05-11", primaryTagIds: ["t1"], linkNext: "b" });
    const b = ev({ id: "b", startsAt: "2026-05-12", primaryTagIds: ["t1"] });
    const joins = joinsOf([a, b], DAYS);

    expect(getEventSpan(a, "2026-05-11", 1, joins).roundRight).toBe(false); // a의 오른쪽 → b로 이어짐
    expect(getEventSpan(b, "2026-05-12", 2, joins).roundLeft).toBe(false); // b의 왼쪽 ← a에서 이어짐
  });

  it("색이 다른 link_next 쌍은 이어지지 않는다", () => {
    const a = ev({ id: "a", startsAt: "2026-05-11", primaryTagIds: ["t1"], linkNext: "b" });
    const b = ev({ id: "b", startsAt: "2026-05-12", primaryTagIds: ["t2"] });
    const joins = joinsOf([a, b], DAYS);
    const aSpan = getEventSpan(a, "2026-05-11", 1, joins);
    const bSpan = getEventSpan(b, "2026-05-12", 2, joins);

    expect(aSpan.roundRight).toBe(true); // 색이 달라 붙지 않는다
    expect(bSpan.roundLeft).toBe(true);
    expect(aSpan.isMulti).toBe(false); // 이어지지 않으니 단독 칸
    expect(bSpan.isMulti).toBe(false);
  });

  it('"A|B"+"B"처럼 맞닿는 변만 같으면 이어진다(부분 일치 허용)', () => {
    const a = ev({ id: "a", startsAt: "2026-05-11", primaryTagIds: ["t1", "t2"], linkNext: "b" });
    const b = ev({ id: "b", startsAt: "2026-05-12", primaryTagIds: ["t2"] });
    const joins = joinsOf([a, b], DAYS);

    expect(getEventSpan(a, "2026-05-11", 1, joins).roundRight).toBe(false); // a의 오른쪽 변(t2) == b의 왼쪽 변(t2)
    expect(getEventSpan(b, "2026-05-12", 2, joins).roundLeft).toBe(false);
  });

  it("앞날에 뒤따르는 일정이 있어도 둘 다 맨 위면 평평하게 잇는다(2026-11-23)", () => {
    const a = ev({ id: "a", startsAt: "2026-05-11", primaryTagIds: ["t1"], linkNext: "b", sortOrder: 0 });
    const later = ev({ id: "later", startsAt: "2026-05-11", primaryTagIds: ["t3"], sortOrder: 1 });
    const b = ev({ id: "b", startsAt: "2026-05-12", primaryTagIds: ["t1"] });
    const joins = joinsOf([a, later, b], DAYS);

    expect(getEventSpan(a, "2026-05-11", 1, joins).roundRight).toBe(false);
    expect(getEventSpan(b, "2026-05-12", 2, joins).roundLeft).toBe(false);
  });

  it("앞날 그 일정 위에 다른 일정이 있으면 둥근 카드끼리 꺾인 띠로 잇는다(평평한 변 없음)", () => {
    const first = ev({ id: "first", startsAt: "2026-05-11", primaryTagIds: ["t3"], sortOrder: 0 });
    const a = ev({ id: "a", startsAt: "2026-05-11", primaryTagIds: ["t1"], linkNext: "b", sortOrder: 1 });
    const b = ev({ id: "b", startsAt: "2026-05-12", primaryTagIds: ["t1"] });
    const joins = joinsOf([first, a, b], DAYS);

    expect(joins.get("a")?.right?.kind).toBe("step");
    expect(getEventSpan(a, "2026-05-11", 1, joins).roundRight).toBe(true);
    expect(getEventSpan(b, "2026-05-12", 2, joins).roundLeft).toBe(true);
  });

  it("단일 멀티데이 일정은 link_next 없이도 자기 칸들끼리 이어진다", () => {
    const m = ev({
      id: "m",
      startsAt: "2026-05-10",
      endDateKey: "2026-05-12",
      primaryTagIds: ["t1"]
    });
    const joins = joinsOf([m], ["2026-05-10", ...DAYS]);

    const startSpan = getEventSpan(m, "2026-05-10", weekdayOf("2026-05-10"), joins);
    const midSpan = getEventSpan(m, "2026-05-11", weekdayOf("2026-05-11"), joins);
    const endSpan = getEventSpan(m, "2026-05-12", weekdayOf("2026-05-12"), joins);

    expect(startSpan.roundLeft).toBe(true); // 시작 칸 왼쪽은 둥글게
    expect(startSpan.roundRight).toBe(false); // 다음 칸으로 이어짐
    expect(midSpan.roundLeft).toBe(false);
    expect(midSpan.roundRight).toBe(false);
    expect(endSpan.roundRight).toBe(true); // 끝 칸 오른쪽은 둥글게
    expect(startSpan.isMulti).toBe(true);
  });
});

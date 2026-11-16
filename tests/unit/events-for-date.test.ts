import { describe, expect, it } from "vitest";
import { getEventsForDate } from "@/lib/calendar/month";
import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";

// getEventsForDate는 달력 칸마다(42칸) 매 렌더 호출되는 핫 패스다. 성능 때문에 내부 구현을
// 바꿀 때 순서 규칙을 여기서 못박는다. 규칙: ① sortOrder(방송 순서) ② 동률이면 원래 순서(안정).

function ev(over: Partial<PublicScheduleEvent> & { id: string }): PublicScheduleEvent {
  return {
    id: over.id,
    publicTitle: over.publicTitle ?? over.id,
    startsAt: over.startsAt ?? "2026-07-10T00:00:00+09:00",
    endDateKey: over.endDateKey,
    linkNext: over.linkNext,
    sortOrder: over.sortOrder ?? 0,
    tagIds: over.tagIds ?? [],
    isSupport: over.isSupport ?? false,
    isTentative: over.isTentative ?? false,
    heartCount: over.heartCount ?? 0
  } as PublicScheduleEvent;
}

const ids = (list: { id: string }[]) => list.map((e) => e.id);

describe("getEventsForDate — 그 날에 걸치는 일정 고르기", () => {
  it("시작일이 그 날이면 포함, 다른 날이면 제외", () => {
    const events = [
      ev({ id: "오늘" }),
      ev({ id: "내일", startsAt: "2026-07-11T00:00:00+09:00" })
    ];
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(["오늘"]);
  });

  it("여러 날 걸치는 일정은 시작~끝 사이 모든 날에 포함된다", () => {
    const span = ev({ id: "3일짜리", endDateKey: "2026-07-12" });
    expect(ids(getEventsForDate([span], "2026-07-10"))).toEqual(["3일짜리"]);
    expect(ids(getEventsForDate([span], "2026-07-11"))).toEqual(["3일짜리"]);
    expect(ids(getEventsForDate([span], "2026-07-12"))).toEqual(["3일짜리"]);
    expect(ids(getEventsForDate([span], "2026-07-13"))).toEqual([]);
  });
});

describe("getEventsForDate — 순서 규칙", () => {
  // 2026-11-16 소유자: 같은 날 순서 = 방송 순서(sortOrder). 이어진 일정을 위로 올리지 않는다.
  it("이어진/멀티데이 일정도 위로 올리지 않고 sortOrder를 따른다", () => {
    const events = [
      ev({ id: "15시", sortOrder: 0 }),
      ev({ id: "하종와", sortOrder: 1, linkNext: "하종와2" }),
      ev({ id: "멀티", sortOrder: 2, endDateKey: "2026-07-11" })
    ];
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(["15시", "하종와", "멀티"]);
  });

  it("sortOrder 오름차순", () => {
    const events = [
      ev({ id: "셋째", sortOrder: 3 }),
      ev({ id: "첫째", sortOrder: 1 }),
      ev({ id: "둘째", sortOrder: 2 })
    ];
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(["첫째", "둘째", "셋째"]);
  });

  it("sortOrder가 같으면 원래 로드 순서를 지킨다(안정 정렬)", () => {
    const events = [ev({ id: "a" }), ev({ id: "b" }), ev({ id: "c" })];
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(["a", "b", "c"]);
  });
});

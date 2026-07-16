import { describe, expect, it } from "vitest";
import { getEventsForDate } from "@/lib/calendar/month";
import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";

// getEventsForDate는 달력 칸마다(42칸) 매 렌더 호출되는 핫 패스다. 성능 때문에 내부 구현을
// 바꿨으므로(비교자 안의 O(N) 스캔 제거), **순서 규칙이 예전과 한 치도 다르지 않다는 것**을
// 여기서 못박는다. 규칙: ① 연결/멀티데이 일정이 위 ② 그 다음 sortOrder ③ 동률이면 원래 순서(안정).

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
  it("멀티데이가 홑날짜보다 위로", () => {
    const events = [ev({ id: "홑" }), ev({ id: "멀티", endDateKey: "2026-07-11" })];
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(["멀티", "홑"]);
  });

  it("linkNext를 가진 일정이 위로", () => {
    const events = [ev({ id: "홑" }), ev({ id: "앞", linkNext: "뒤" })];
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(["앞", "홑"]);
  });

  it("남이 나를 linkNext로 가리키면(연결의 뒷쪽) 나도 위로 — 비교자 안 O(N) 스캔이 하던 판정", () => {
    const events = [
      ev({ id: "홑" }),
      ev({ id: "뒤" }), // 자신은 linkNext가 없지만 '앞'이 가리킨다
      ev({ id: "앞", startsAt: "2026-07-09T00:00:00+09:00", linkNext: "뒤" })
    ];
    // 7/10 칸에는 '홑'과 '뒤'만 걸친다 — 그중 '뒤'가 연결이라 위로 와야 한다.
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(["뒤", "홑"]);
  });

  it("같은 등급이면 sortOrder 오름차순", () => {
    const events = [
      ev({ id: "셋째", sortOrder: 3 }),
      ev({ id: "첫째", sortOrder: 1 }),
      ev({ id: "둘째", sortOrder: 2 })
    ];
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(["첫째", "둘째", "셋째"]);
  });

  it("등급·sortOrder가 모두 같으면 원래 로드 순서를 지킨다(안정 정렬)", () => {
    const events = [ev({ id: "a" }), ev({ id: "b" }), ev({ id: "c" })];
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(["a", "b", "c"]);
  });

  it("연결이 sortOrder를 이긴다(연결이 먼저, 그 다음 sortOrder)", () => {
    const events = [
      ev({ id: "홑-작은순서", sortOrder: 0 }),
      ev({ id: "멀티-큰순서", sortOrder: 9, endDateKey: "2026-07-11" })
    ];
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(["멀티-큰순서", "홑-작은순서"]);
  });

  it("같은 배열을 여러 칸에 반복 호출해도 결과가 같다(내부 캐시가 오염되지 않는다)", () => {
    const events = [
      ev({ id: "멀티", endDateKey: "2026-07-12" }),
      ev({ id: "홑", sortOrder: 1 })
    ];
    const first = ids(getEventsForDate(events, "2026-07-10"));
    getEventsForDate(events, "2026-07-11");
    getEventsForDate(events, "2026-07-12");
    expect(ids(getEventsForDate(events, "2026-07-10"))).toEqual(first);
  });

  it("배열이 바뀌면 연결 판정도 새로 한다(캐시가 옛 배열을 물고 있지 않다)", () => {
    const before = [ev({ id: "홑" }), ev({ id: "뒤" })];
    expect(ids(getEventsForDate(before, "2026-07-10"))).toEqual(["홑", "뒤"]);
    // '앞'이 생겨 '뒤'를 가리키면, 이제 '뒤'가 연결이라 위로 올라와야 한다.
    const after = [
      ev({ id: "홑" }),
      ev({ id: "뒤" }),
      ev({ id: "앞", startsAt: "2026-07-09T00:00:00+09:00", linkNext: "뒤" })
    ];
    expect(ids(getEventsForDate(after, "2026-07-10"))).toEqual(["뒤", "홑"]);
  });
});

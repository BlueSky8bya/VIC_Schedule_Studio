import { describe, expect, it } from "vitest";
import { buildLinkChain, chainLinkAnchor } from "@/lib/calendar/month";
import { dropHistoryEntry, type UndoAction } from "@/lib/studio/editor-model";
import type { StudioScheduleEvent } from "@/lib/domain/schedule-types";

// 이어진 일정은 한 몸(2026-11-19 소유자): 묶음 어느 카드에서 끌어도 늘어난다. (복사는 누른 카드 하나 — 묶음째 복사는 소유자가 되돌렸다.)

function ev(part: Partial<StudioScheduleEvent> & { id: string; day: string }): StudioScheduleEvent {
  const { day, ...rest } = part;
  return {
    isAllDay: true,
    publicTitle: part.id,
    status: "scheduled",
    visibilityScope: "public",
    category: "stream",
    tagIds: [],
    primaryTagIds: ["t1"],
    sortOrder: 0,
    startsAt: `${day}T12:00:00+09:00`,
    ...rest
  } as StudioScheduleEvent;
}

describe("chainLinkAnchor — right-drag from any member extends the chain", () => {
  // 20→21 이어 둠, 22·23은 아직 혼자, 19는 앞날.
  const events = [
    ev({ id: "d19", day: "2026-06-19" }),
    ev({ id: "d20", day: "2026-06-20", linkNext: "d21" }),
    ev({ id: "d21", day: "2026-06-21" }),
    ev({ id: "d22", day: "2026-06-22" }),
    ev({ id: "d23", day: "2026-06-23" }),
    ev({ id: "other21", day: "2026-06-21", sortOrder: 1 })
  ];
  it("extends from the chain tail whichever member the drag starts on", () => {
    expect(chainLinkAnchor("d20", "d22", events)).toBe("d21"); // 고른(머리) 카드에서
    expect(chainLinkAnchor("d21", "d22", events)).toBe("d21"); // 방금 이은 카드에서
    expect(chainLinkAnchor("d20", "d23", events)).toBe("d21"); // 가운데 날을 건너뛰어도 끝에서
  });
  it("extends from the chain head toward earlier days", () => {
    expect(chainLinkAnchor("d21", "d19", events)).toBe("d20");
  });
  it("refuses members and other events inside the chain's own days", () => {
    expect(chainLinkAnchor("d20", "d21", events)).toBeNull();
    expect(chainLinkAnchor("d20", "other21", events)).toBeNull();
  });
  it("a lone card anchors on itself (old behaviour)", () => {
    expect(chainLinkAnchor("d22", "d23", events)).toBe("d22");
    expect(chainLinkAnchor("d22", "d22", events)).toBeNull();
  });
  it("the resulting link chain keeps the existing links and reaches the new day", () => {
    const anchor = events.find((e) => e.id === chainLinkAnchor("d20", "d23", events))!;
    expect(buildLinkChain(anchor, events.find((e) => e.id === "d23")!, events)).toEqual(["d21", "d22", "d23"]);
  });
});

describe("buildLinkChain prefers the already-linked next card", () => {
  it("does not swap an existing middle link for another same-colour card that day", () => {
    const events = [
      ev({ id: "a", day: "2026-06-10", linkNext: "b2" }),
      ev({ id: "b1", day: "2026-06-11" }), // 같은 색, 배열 앞쪽 — 예전엔 이것이 먼저 잡혔다
      ev({ id: "b2", day: "2026-06-11", sortOrder: 1 }),
      ev({ id: "c", day: "2026-06-12" })
    ];
    expect(buildLinkChain(events[0], events[3], events)).toEqual(["a", "b2", "c"]);
  });
});

describe("buildLinkChain reaches the card the drag aims at", () => {
  // 2026-11-25 실제 사례: 25일에 같은 색 일정이 둘 — 배열 앞쪽 카드가 먼저 잡혀 고른 카드는 이을 수 없었다.
  const events = [
    ev({ id: "a", day: "2026-06-10" }),
    ev({ id: "b1", day: "2026-06-11" }),
    ev({ id: "b2", day: "2026-06-11", sortOrder: 1 })
  ];
  it("links to either same-colour card on the next day, whichever is aimed at", () => {
    expect(buildLinkChain(events[0], events[1], events)).toEqual(["a", "b1"]);
    expect(buildLinkChain(events[0], events[2], events)).toEqual(["a", "b2"]);
  });
  it("works the same when dragging back from the later card", () => {
    expect(buildLinkChain(events[2], events[0], events)).toEqual(["a", "b2"]);
  });
});

describe("dropHistoryEntry — removes a pasted piece inside its group", () => {
  it("drops the nested entry, keeps the group object, and removes an emptied group", () => {
    const a: UndoAction = { type: "remove", holder: { id: "a" } };
    const b: UndoAction = { type: "remove", holder: { id: "b" } };
    const other: UndoAction = { type: "remove", holder: { id: "x" } };
    const group: UndoAction = { type: "group", actions: [a, b] };
    let stack: UndoAction[] = [group, other];
    stack = dropHistoryEntry(stack, a);
    expect(stack).toEqual([group, other]);
    expect(group.type === "group" && group.actions).toEqual([b]);
    stack = dropHistoryEntry(stack, b);
    expect(stack).toEqual([other]);
    expect(dropHistoryEntry(stack, other)).toEqual([]);
  });
});

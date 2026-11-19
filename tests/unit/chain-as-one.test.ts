import { describe, expect, it } from "vitest";
import { buildLinkChain, chainLinkAnchor, chainMembersInOrder, chainPasteRuns, drawnChainMembers } from "@/lib/calendar/month";
import { dropHistoryEntry, type UndoAction } from "@/lib/studio/editor-model";
import type { StudioScheduleEvent } from "@/lib/domain/schedule-types";

// 이어진 일정은 한 몸(2026-11-19 소유자): 묶음 어느 카드에서 끌어도 늘어나고, 복사·붙여넣기도 묶음째.

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

describe("chainMembersInOrder — copy the whole chain in link order", () => {
  it("returns head-first members with day offsets from any member", () => {
    const events = [
      ev({ id: "c", day: "2026-06-04" }),
      ev({ id: "a", day: "2026-06-02", linkNext: "b" }),
      ev({ id: "b", day: "2026-06-03", linkNext: "c" }),
      ev({ id: "x", day: "2026-06-03" })
    ];
    const out = chainMembersInOrder("b", events).map((m) => [m.event.id, m.offset]);
    expect(out).toEqual([["a", 0], ["b", 1], ["c", 2]]);
  });
  it("a lone event is a one-member chain", () => {
    expect(chainMembersInOrder("x", [ev({ id: "x", day: "2026-06-03" })]).map((m) => m.offset)).toEqual([0]);
  });
});

describe("chainPasteRuns — only links that will be drawn are stored", () => {
  const days = (busy: boolean[]) => busy.map((b, i) => ({ busy: b, offset: i }));
  it("keeps one run when the middle days are free", () => {
    expect(chainPasteRuns(days([true, false, false]))).toEqual([0, 0, 0]);
  });
  it("head's own day never breaks (head goes to the bottom); a busy middle day breaks the next link", () => {
    expect(chainPasteRuns(days([true, true, false]))).toEqual([0, 0, 1]);
    expect(chainPasteRuns(days([false, false, true, false]))).toEqual([0, 0, 0, 1]);
  });
  it("breaks where offsets skip a day (a multi-day piece pasted as one day) and around hidden teasers", () => {
    // 6/2~6/4 여러 날 한 장 → 6/5 일정: 시작일 offset 0·3 — 붙이면 사이 빈 날이 생겨 이음이 그려지지 않는다.
    expect(chainPasteRuns([{ busy: false, offset: 0 }, { busy: false, offset: 3 }, { busy: false, offset: 4 }])).toEqual([0, 1, 1]);
    expect(chainPasteRuns([{ busy: false, offset: 0 }, { busy: false, offset: 1, teaser: true }, { busy: false, offset: 2 }])).toEqual([0, 1, 2]);
    expect(chainPasteRuns([{ busy: false, offset: 0, multi: true }, { busy: false, offset: 1 }])).toEqual([0, 1]);
  });
});

describe("drawnChainMembers — never copies what the calendar does not draw", () => {
  it("a public card linked to a private one copies only the public card", () => {
    const events = [
      ev({ id: "pub", day: "2026-06-10", linkNext: "priv" }),
      ev({ id: "priv", day: "2026-06-11", visibilityScope: "owner_private" as StudioScheduleEvent["visibilityScope"], publicTitle: "SECRET" })
    ];
    expect(drawnChainMembers("pub", events).map((m) => m.event.id)).toEqual(["pub"]);
    expect(chainMembersInOrder("pub", events).map((m) => m.event.id)).toEqual(["pub", "priv"]); // 거르지 않으면 샌다
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

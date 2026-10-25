import { describe, expect, it } from "vitest";
import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";
import {
  agendaNoticeGroupAt,
  createAgendaNotices,
  groupAgendaNotices,
  noticeIsActive,
  noticeRangeText,
  type AgendaNotice
} from "@/lib/ui/agenda-notices";

function event(overrides: Partial<PublicScheduleEvent> = {}): PublicScheduleEvent {
  return {
    id: "notice",
    startsAt: "2026-10-29T00:00:00+09:00",
    isAllDay: true,
    isSupport: true,
    publicTitle: "기간 안내의 전체 제목",
    status: "scheduled",
    visibilityScope: "public",
    category: "support",
    tagIds: [],
    primaryTagIds: [],
    sortOrder: 0,
    ...overrides
  };
}

function notice(id: string, start: string, end = start): AgendaNotice {
  return { id, title: `${id}의 전체 제목`, start, end, kind: "period" };
}

describe("agenda notice public presentation", () => {
  it("projects only presentation fields instead of forwarding private or studio extras", () => {
    const source = Object.freeze({
      ...event({ endDateKey: "2026-10-31", supportKind: "period", supportUrl: "https://example.com/help" }),
      publicDescription: "public but unnecessary description",
      privateMeta: { privateTitle: "PRIVATE_CANARY", privateMemo: "PRIVATE_MEMO_CANARY" },
      editorNote: "EDITOR_CANARY",
      ownerEmail: "private-canary@example.invalid"
    });

    const [result] = createAgendaNotices([source], 2026, 10);
    expect(result).toEqual({
      id: "notice",
      title: "기간 안내의 전체 제목",
      start: "2026-10-29",
      end: "2026-10-31",
      kind: "period",
      url: "https://example.com/help"
    });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_|EDITOR_|private-canary|publicDescription/);
    expect(result).not.toBe(source);
  });

  it.each(["2026-10-01T00:00:00+09:00", "2026-10-01T23:59:59+09:00"])(
    "uses the canonical KST start day across the UTC day boundary: %s", startsAt => {
      const [result] = createAgendaNotices([event({ startsAt })], 2026, 10);
      expect(result.start).toBe("2026-10-01");
      expect(result.end).toBe("2026-10-01");
    }
  );

  it("keeps the full original range when it intersects the viewed month, including its last day", () => {
    const result = createAgendaNotices([
      event({ id: "prior-end", startsAt: "2026-09-29T00:00:00+09:00", endDateKey: "2026-10-01" }),
      event({ id: "next-end", startsAt: "2026-10-31T00:00:00+09:00", endDateKey: "2026-11-02" }),
      event({ id: "before", startsAt: "2026-09-28T00:00:00+09:00", endDateKey: "2026-09-30" }),
      event({ id: "after", startsAt: "2026-11-01T00:00:00+09:00" })
    ], 2026, 10);
    expect(result.map(item => [item.id, item.start, item.end])).toEqual([
      ["prior-end", "2026-09-29", "2026-10-01"],
      ["next-end", "2026-10-31", "2026-11-02"]
    ]);
  });

  it("intersects December and January correctly without clipping the year-spanning range", () => {
    const source = event({ startsAt: "2026-12-31T23:00:00+09:00", endDateKey: "2027-01-02" });
    for (const [year, month] of [[2026, 12], [2027, 1]]) {
      const [result] = createAgendaNotices([source], year, month);
      expect([result.start, result.end]).toEqual(["2026-12-31", "2027-01-02"]);
      expect(noticeRangeText(result)).toBe("12.31–1.2");
    }
    expect(createAgendaNotices([source], 2027, 2)).toEqual([]);
  });

  it("does not reapply wall-clock expiry; liveEvents filters expired support upstream", () => {
    const source = event({
      startsAt: "2020-10-03T00:00:00+09:00",
      endsAt: "2020-10-04T23:59:59+09:00",
      endDateKey: "2020-10-04"
    });
    expect(createAgendaNotices([source], 2020, 10)).toHaveLength(1);
  });

  it.each([
    [undefined, "up"], ["up", "up"], ["period", "period"]
  ] as const)("maps support kind %s to %s", (supportKind, expected) => {
    expect(createAgendaNotices([event({ supportKind })], 2026, 10)[0].kind).toBe(expected);
  });

  it("excludes ordinary schedules, empty titles and concealed teasers", () => {
    expect(createAgendaNotices([
      event({ id: "broadcast", isSupport: false }),
      event({ id: "missing-support", isSupport: undefined }),
      event({ id: "empty", publicTitle: "" }),
      event({ id: "teaser", teaser: true, teaserRevealAt: "2099-10-30T00:00:00Z" })
    ], 2026, 10)).toEqual([]);
    expect(createAgendaNotices([], 2026, 10)).toEqual([]);
  });

  it.each(["javascript:alert(1)", "data:text/html,unsafe", "file:///private", "mailto:user@example.com", "/relative", "//example.com/path", "not a URL", ""])(
    "keeps a notice title but rejects unsafe or malformed link %s", supportUrl => {
      const [result] = createAgendaNotices([event({ supportUrl })], 2026, 10);
      expect(result.title).toBe("기간 안내의 전체 제목");
      expect(result.url).toBeUndefined();
    }
  );

  it("orders presentation deterministically by start, end, then id without sorting the input", () => {
    const input = Object.freeze([
      Object.freeze(event({ id: "z", endDateKey: "2026-10-31" })),
      Object.freeze(event({ id: "b", endDateKey: "2026-10-30" })),
      Object.freeze(event({ id: "a", endDateKey: "2026-10-30" })),
      Object.freeze(event({ id: "early", startsAt: "2026-10-28T00:00:00+09:00", endDateKey: "2026-10-31" }))
    ]);
    const result = createAgendaNotices(input, 2026, 10);
    expect(result.map(item => item.id)).toEqual(["early", "a", "b", "z"]);
    expect(input.map(item => item.id)).toEqual(["z", "b", "a", "early"]);
  });
});

describe("agenda notice date context", () => {
  it("keeps three partially overlapping notices together while only matching dates are active", () => {
    const input = [
      notice("vote", "2026-10-26", "2026-10-29"),
      notice("goods", "2026-10-28", "2026-10-31"),
      notice("stories", "2026-10-29", "2026-11-01")
    ];
    const groups = groupAgendaNotices(input);
    expect(groups).toHaveLength(1);
    expect(groups[0].notices.map(item => item.title)).toEqual(input.map(item => item.title));
    const dates = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"];
    expect(dates.map(date => groups[0].notices.filter(item => noticeIsActive(item, date)).length))
      .toEqual([1, 1, 2, 3, 2, 2, 1]);
  });

  it("uses both inclusive endpoints and rejects days outside the period", () => {
    const item = notice("overlap", "2026-10-29", "2026-11-01");
    for (const date of ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"]) {
      expect(noticeIsActive(item, date)).toBe(true);
    }
    for (const date of ["2026-10-28", "2026-11-02"]) expect(noticeIsActive(item, date)).toBe(false);
    const single = notice("single", "2026-10-29");
    expect(noticeIsActive(single, "2026-10-29")).toBe(true);
    expect(noticeIsActive(single, "2026-10-30")).toBe(false);
  });

  it("omits one-day range text with either a missing or explicit matching end", () => {
    const result = createAgendaNotices([event(), event({ id: "explicit", endDateKey: "2026-10-29" })], 2026, 10);
    expect(result.map(noticeRangeText)).toEqual(["", ""]);
    expect(noticeRangeText(notice("multi", "2026-10-29", "2026-10-31"))).toBe("10.29–10.31");
  });

  it("merges connected overlaps transitively, including endpoint contact, but keeps gaps separate", () => {
    const input = Object.freeze([
      Object.freeze(notice("later", "2026-11-03", "2026-11-05")),
      Object.freeze(notice("c", "2026-10-29", "2026-11-01")),
      Object.freeze(notice("a", "2026-10-26", "2026-10-29")),
      Object.freeze(notice("b", "2026-10-26", "2026-10-27")),
      Object.freeze(notice("inside", "2026-10-28"))
    ]);
    const original = JSON.stringify(input);
    const groups = groupAgendaNotices(input);
    expect(groups.map(group => [group.start, group.end, group.notices.map(item => item.id)])).toEqual([
      ["2026-10-26", "2026-11-01", ["a", "b", "inside", "c"]],
      ["2026-11-03", "2026-11-05", ["later"]]
    ]);
    expect(JSON.stringify(input)).toBe(original);
    expect(groupAgendaNotices([...input].reverse())).toEqual(groups);
    expect(groupAgendaNotices([])).toEqual([]);
  });

  it("chooses the active group, otherwise the preceding group, with the first group before all dates", () => {
    const groups = groupAgendaNotices([
      notice("first", "2026-10-01", "2026-10-03"),
      notice("second", "2026-10-10", "2026-10-12"),
      notice("third", "2026-10-20", "2026-10-22")
    ]);
    for (const date of ["2026-09-30", "2026-10-01", "2026-10-03", "2026-10-09"]) {
      expect(agendaNoticeGroupAt(groups, date)).toBe(groups[0]);
    }
    for (const date of ["2026-10-10", "2026-10-12", "2026-10-19"]) {
      expect(agendaNoticeGroupAt(groups, date)).toBe(groups[1]);
    }
    for (const date of ["2026-10-20", "2026-10-22", "2026-11-01"]) {
      expect(agendaNoticeGroupAt(groups, date)).toBe(groups[2]);
    }
    expect(agendaNoticeGroupAt([], "2026-10-29")).toBeUndefined();
  });
});

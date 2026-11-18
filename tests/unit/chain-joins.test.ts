import { describe, expect, it } from "vitest";
import { buildChainJoins, chainRangeOf, getEventSpan, getEventsForDate } from "@/lib/calendar/month";
import { chainCont, chainSlim, chainWrapClasses } from "@/lib/calendar/chain-join-view";
import type { StudioScheduleEvent } from "@/lib/domain/schedule-types";

// 이어진 일정 잇기 규칙(2026-11-16 소유자): 앞날 마지막 카드 = 다음날 첫 카드일 때만 잇는다.
// 앞날에 그 일정 하나뿐이면 띠(band), 앞에 다른 일정이 있으면 꺾인 띠(step), 토→일이면 줄바뀜(wrap).

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

const weekdayOf = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();
function cellsFrom(start: string, n: number) {
  const out: { isoDate: string; weekday: number }[] = [];
  for (let i = 0; i < n; i += 1) {
    const d = new Date(`${start}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    out.push({ isoDate: iso, weekday: weekdayOf(iso) });
  }
  return out;
}
function joinsOf(events: StudioScheduleEvent[], start = "2026-11-08", n = 14) {
  return buildChainJoins(cellsFrom(start, n), (iso) =>
    getEventsForDate(events, iso).filter((e) => !e.isSupport)
  );
}
const BODY = "하종와\n낮의와우와 밤의와우를 보자";

describe("buildChainJoins", () => {
  it("앞에 다른 일정이 있으면 꺾인 띠, 같은 글이면 다음날은 한 줄", () => {
    const events = [
      ev({ id: "15시", day: "2026-11-09", sortOrder: 0 }),
      ev({ id: "a", day: "2026-11-09", sortOrder: 1, publicTitle: BODY, linkNext: "b" }),
      ev({ id: "b", day: "2026-11-10", sortOrder: 0, publicTitle: BODY }),
      ev({ id: "17시", day: "2026-11-10", sortOrder: 1 })
    ];
    const j = joinsOf(events);
    expect(j.get("a")?.right).toEqual({ kind: "step", otherId: "b", sameContent: true });
    expect(j.get("b")?.left).toEqual({ kind: "step", otherId: "a", sameContent: true });
    // 꺾인 띠은 둥근 카드끼리 — 평평한 변 없음
    expect(j.get("a")?.flatRight).toBe(false);
    expect(j.get("b")?.flatLeft).toBe(false);
  });

  it("다음날 첫 카드가 다른 방송이면 끊긴다(순서를 바꾼 경우)", () => {
    const events = [
      ev({ id: "15시", day: "2026-11-09", sortOrder: 0 }),
      ev({ id: "a", day: "2026-11-09", sortOrder: 1, linkNext: "b" }),
      ev({ id: "17시", day: "2026-11-10", sortOrder: 0 }),
      ev({ id: "b", day: "2026-11-10", sortOrder: 1 })
    ];
    const j = joinsOf(events);
    expect(j.get("a")).toBeUndefined();
    expect(j.get("b")).toBeUndefined();
  });

  it("앞날 뒤에 다른 방송이 있으면 끊긴다", () => {
    const events = [
      ev({ id: "a", day: "2026-11-12", sortOrder: 0, linkNext: "b" }),
      ev({ id: "노래", day: "2026-11-12", sortOrder: 1 }),
      ev({ id: "b", day: "2026-11-13", sortOrder: 0 })
    ];
    expect(joinsOf(events).size).toBe(0);
  });

  it("앞날에 그 일정 하나뿐이면 띠 — 같은 글이면 머리 칸이 여러 칸 폭, 뒤 칸은 빈 자리", () => {
    const events = [
      ev({ id: "a", day: "2026-11-11", publicTitle: BODY, linkNext: "b" }),
      ev({ id: "b", day: "2026-11-12", publicTitle: BODY, linkNext: "c" }),
      ev({ id: "c", day: "2026-11-13", publicTitle: BODY }),
      ev({ id: "뒤", day: "2026-11-13", sortOrder: 1 })
    ];
    const j = joinsOf(events);
    expect(j.get("a")?.bandSpan).toBe(3);
    expect(j.get("b")?.bandHeadId).toBe("a");
    expect(j.get("c")?.bandHeadId).toBe("a");
    expect(new Set([j.get("a")?.bandKey, j.get("b")?.bandKey, j.get("c")?.bandKey]).size).toBe(1);
    expect(j.get("a")?.flatRight).toBe(false); // 띠 끝(c) 뒤로 이어지는 게 없다
  });

  it("띠인데 글이 다르면 칸마다 제 글을 쓰고 평평한 변으로 붙는다(예전 모양)", () => {
    const events = [
      ev({ id: "a", day: "2026-11-11", publicTitle: "와우\n1일차", linkNext: "b" }),
      ev({ id: "b", day: "2026-11-12", publicTitle: "와우\n2일차" })
    ];
    const j = joinsOf(events);
    expect(j.get("a")?.bandSpan).toBeUndefined();
    expect(j.get("b")?.bandHeadId).toBeUndefined();
    expect(j.get("a")?.flatRight).toBe(true);
    expect(j.get("b")?.flatLeft).toBe(true);
    expect(j.get("a")?.bandKey).toBe(j.get("b")?.bandKey);
  });

  it("토→일은 줄바뀜 — 평평한 변만, 띠·꺾인 띠 아님", () => {
    const events = [
      ev({ id: "공지", day: "2026-11-14", sortOrder: 0 }),
      ev({ id: "a", day: "2026-11-14", sortOrder: 1, publicTitle: BODY, linkNext: "b" }),
      ev({ id: "b", day: "2026-11-15", publicTitle: BODY })
    ];
    const j = joinsOf(events);
    expect(j.get("a")?.right?.kind).toBe("wrap");
    expect(j.get("b")?.left).toEqual({ kind: "wrap", otherId: "a", sameContent: true });
    expect(j.get("a")?.flatRight).toBe(true);
    expect(j.get("b")?.flatLeft).toBe(true);
  });

  it("줄바뀜은 글자 없이 평평한 변 + 물결 표시, 범위·며칠째는 상세 창 한 줄(2026-11-18)", () => {
    // 금(20)→토(21)→일(22)
    const events = [
      ev({ id: "a", day: "2026-11-20", publicTitle: "와우 포에버\n수도원 40", linkNext: "b" }),
      ev({ id: "b", day: "2026-11-21", publicTitle: "와우 포에버\n노뱅종 2일차", linkNext: "c" }),
      ev({ id: "c", day: "2026-11-22", publicTitle: "와우 포에버\n노뱅종 3일차" })
    ];
    const j = joinsOf(events, "2026-11-15", 14);
    expect(chainWrapClasses(j.get("b"))).toBe("wrap-out");
    expect(chainWrapClasses(j.get("c"))).toBe("wrap-in");
    expect(chainWrapClasses(j.get("a"))).toBe("");
    // 이어 받음 표시(물결)는 글이 달라도 — 앞 카드와 떨어진 카드(줄바뀜·꺾인 띠)면 붙는다. 띠로 붙은 칸은 없다.
    expect(chainCont(j.get("c"))).toBe(true);
    expect(chainCont(j.get("b"))).toBe(false);
    expect(chainCont(j.get("a"))).toBe(false);
    // 한 줄로 줄이는 것은 글까지 같을 때만
    expect(chainSlim(j.get("c"))).toBe(false);
    expect(chainRangeOf("c", events)).toEqual({ start: "2026-11-20", end: "2026-11-22", index: 3, total: 3 });
    expect(chainRangeOf("a", events)?.index).toBe(1);
    expect(chainRangeOf("solo", [ev({ id: "solo", day: "2026-11-20" })])).toBeNull();
  });

  it("3일 묶음 — 첫날 앞에 다른 일정이 있으면 1→2일은 꺾인 띠, 2→3일은 띠(2일은 한 줄 머리)", () => {
    const events = [
      ev({ id: "15시", day: "2026-11-10", sortOrder: 0 }),
      ev({ id: "a", day: "2026-11-10", sortOrder: 1, publicTitle: BODY, linkNext: "b" }),
      ev({ id: "b", day: "2026-11-11", publicTitle: BODY, linkNext: "c" }),
      ev({ id: "c", day: "2026-11-12", publicTitle: BODY })
    ];
    const j = joinsOf(events);
    expect(j.get("a")?.right?.kind).toBe("step");
    expect(j.get("b")?.left?.kind).toBe("step");
    expect(j.get("b")?.right?.kind).toBe("band");
    expect(j.get("b")?.bandSpan).toBe(2);
    expect(j.get("c")?.bandHeadId).toBe("b");
  });

  it("끄는 중(forceStep)인 날에 걸친 띠는 꺾인 띠로 — 줄 높이가 어긋나도 옆 칸을 덮지 않게", () => {
    const events = [
      ev({ id: "a", day: "2026-11-11", publicTitle: BODY, linkNext: "b" }),
      ev({ id: "b", day: "2026-11-12", publicTitle: BODY })
    ];
    const j = buildChainJoins(
      cellsFrom("2026-11-08", 14),
      (iso) => getEventsForDate(events, iso),
      undefined,
      (a, b) => a === "2026-11-11" || b === "2026-11-11"
    );
    expect(j.get("a")?.right?.kind).toBe("step");
    expect(j.get("a")?.bandSpan).toBeUndefined();
  });

  it("색(대표 태그)이 다른 link_next는 잇지 않는다", () => {
    const events = [
      ev({ id: "a", day: "2026-11-11", primaryTagIds: ["t1"], linkNext: "b" }),
      ev({ id: "b", day: "2026-11-12", primaryTagIds: ["t2"] })
    ];
    expect(joinsOf(events).size).toBe(0);
  });

  it("getEventSpan은 joins를 받으면 이어진 판정을 그대로 따른다", () => {
    const events = [
      ev({ id: "15시", day: "2026-11-09", sortOrder: 0 }),
      ev({ id: "a", day: "2026-11-09", sortOrder: 1, linkNext: "b" }),
      ev({ id: "b", day: "2026-11-10" })
    ];
    const j = joinsOf(events);
    const aSpan = getEventSpan(events[1], "2026-11-09", 1, j);
    expect(aSpan.isMulti).toBe(false); // 꺾인 띠 = 둥근 단독 카드
    expect(aSpan.roundRight).toBe(true);
  });
});

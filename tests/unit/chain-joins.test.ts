import { describe, expect, it } from "vitest";
import { buildChainJoins, getEventSpan, getEventsForDate } from "@/lib/calendar/month";
import type { StudioScheduleEvent } from "@/lib/domain/schedule-types";

// 이어진 일정 잇기 규칙(2026-11-16 소유자): 앞날 마지막 카드 = 다음날 첫 카드일 때만 잇는다.
// 앞날에 그 일정 하나뿐이면 띠(band), 앞에 다른 일정이 있으면 곡선(curve), 토→일이면 줄바뀜(wrap).

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
  it("앞에 다른 일정이 있으면 곡선, 같은 글이면 다음날은 한 줄", () => {
    const events = [
      ev({ id: "15시", day: "2026-11-09", sortOrder: 0 }),
      ev({ id: "a", day: "2026-11-09", sortOrder: 1, publicTitle: BODY, linkNext: "b" }),
      ev({ id: "b", day: "2026-11-10", sortOrder: 0, publicTitle: BODY }),
      ev({ id: "17시", day: "2026-11-10", sortOrder: 1 })
    ];
    const j = joinsOf(events);
    expect(j.get("a")?.right).toEqual({ kind: "curve", otherId: "b", sameContent: true });
    expect(j.get("b")?.left).toEqual({ kind: "curve", otherId: "a", sameContent: true });
    // 곡선은 둥근 카드끼리 — 평평한 변 없음
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

  it("토→일은 줄바뀜 — 평평한 변만, 띠·곡선 아님", () => {
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

  it("3일 묶음 — 첫날 앞에 다른 일정이 있으면 1→2일은 곡선, 2→3일은 띠(2일은 한 줄 머리)", () => {
    const events = [
      ev({ id: "15시", day: "2026-11-10", sortOrder: 0 }),
      ev({ id: "a", day: "2026-11-10", sortOrder: 1, publicTitle: BODY, linkNext: "b" }),
      ev({ id: "b", day: "2026-11-11", publicTitle: BODY, linkNext: "c" }),
      ev({ id: "c", day: "2026-11-12", publicTitle: BODY })
    ];
    const j = joinsOf(events);
    expect(j.get("a")?.right?.kind).toBe("curve");
    expect(j.get("b")?.left?.kind).toBe("curve");
    expect(j.get("b")?.right?.kind).toBe("band");
    expect(j.get("b")?.bandSpan).toBe(2);
    expect(j.get("c")?.bandHeadId).toBe("b");
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
    const aSpan = getEventSpan(events[1], "2026-11-09", 1, events, j);
    expect(aSpan.isMulti).toBe(false); // 곡선 = 둥근 단독 카드
    expect(aSpan.roundRight).toBe(true);
  });
});

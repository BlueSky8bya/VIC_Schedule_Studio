import { describe, expect, it } from "vitest";
import type { PublicSchedule, PublicScheduleEvent, PublicVodEntry } from "@/lib/domain/schedule-types";
import { mergeWindowedSchedule, shownRange, upcomingRange, windowPublicSchedule } from "@/lib/schedules/schedule-window";

function ev(id: string, date: string, extra: Partial<PublicScheduleEvent> = {}): PublicScheduleEvent {
  return { id, startsAt: `${date}T12:00:00+09:00`, publicTitle: id, ...extra } as unknown as PublicScheduleEvent;
}
function vod(titleNo: number, dateKey: string): PublicVodEntry {
  return { titleNo, dateKey, title: `v${titleNo}`, durationMs: 1 } as PublicVodEntry;
}
function sched(events: PublicScheduleEvent[], vods: PublicVodEntry[], extra: Partial<PublicSchedule> = {}): PublicSchedule {
  return {
    calendar: { slug: "vic", defaultYear: 2026, defaultMonth: 11 } as PublicSchedule["calendar"],
    events,
    tags: [],
    palette: [],
    vods,
    ...extra
  };
}

const full = sched(
  [
    ev("feb25", "2025-02-27"),
    ev("mar25", "2025-03-02"),
    ev("jun25", "2025-06-10"),
    ev("span", "2026-09-29", { endDateKey: "2026-10-02" }),
    ev("sep", "2026-09-10"),
    ev("teaserOld", "2026-01-05", { teaser: true }),
    ev("oct", "2026-10-15"),
    ev("nov", "2026-11-13"),
    ev("dec", "2026-12-24")
  ],
  [vod(3, "2026-11-01"), vod(2, "2026-10-03"), vod(1, "2025-03-02")]
);
const today = { year: 2026, month: 11 };

describe("schedule window", () => {
  it("builds the shown ±1 month and upcoming ranges", () => {
    expect(shownRange({ year: 2026, month: 1 })).toEqual({ from: "2025-12-01", to: "2026-02-28" });
    expect(shownRange({ year: 2024, month: 3 })).toEqual({ from: "2024-02-01", to: "2024-04-30" });
    expect(upcomingRange(today)).toEqual({ from: "2026-10-01" });
  });

  it("keeps events touching the window, teasers and the future, and drops the rest", () => {
    const w = windowPublicSchedule(full, [shownRange(today), upcomingRange(today)]);
    expect(w.events.map((e) => e.id)).toEqual(["span", "teaserOld", "oct", "nov", "dec"]);
    expect(w.vods?.map((v) => v.titleNo)).toEqual([3, 2]);
  });

  it("loads only the linked old month (±1) plus upcoming for a deep link", () => {
    const w = windowPublicSchedule(full, [shownRange({ year: 2025, month: 3 }), upcomingRange(today)]);
    expect(w.events.map((e) => e.id)).toEqual(["feb25", "mar25", "span", "teaserOld", "oct", "nov", "dec"]);
    expect(w.vods?.map((v) => v.titleNo)).toEqual([3, 2, 1]);
  });

  it("returns the original schedule when nothing would be cut", () => {
    const small = sched([ev("nov", "2026-11-13")], [vod(3, "2026-11-01")]);
    expect(windowPublicSchedule(small, [shownRange(today), upcomingRange(today)])).toBe(small);
  });

  it("merges full data back in the loader order with the window as the fresher source", () => {
    const w = windowPublicSchedule(full, [shownRange(today), upcomingRange(today)]);
    const fresh = {
      ...w,
      // 창 안: oct 수정, dec 삭제, 새 일정 추가
      events: w.events
        .filter((e) => e.id !== "dec")
        .map((e) => (e.id === "oct" ? { ...e, publicTitle: "oct!" } : e))
        .concat(ev("new", "2026-11-20")),
      myHeartIds: ["nov"]
    } as PublicSchedule;
    const merged = mergeWindowedSchedule(fresh, full);
    expect(merged.events.map((e) => e.id)).toEqual(["feb25", "mar25", "jun25", "span", "sep", "teaserOld", "oct", "nov", "new"]);
    expect(merged.events.find((e) => e.id === "oct")?.publicTitle).toBe("oct!");
    expect(merged.vods?.map((v) => v.titleNo)).toEqual([3, 2, 1]);
    expect(merged.myHeartIds).toEqual(["nov"]);
    expect(merged.window).toBeUndefined();
  });

  it("passes through schedules without a window", () => {
    expect(mergeWindowedSchedule(full, sched([], []))).toBe(full);
  });
});

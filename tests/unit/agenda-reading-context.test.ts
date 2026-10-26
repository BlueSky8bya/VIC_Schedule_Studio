import { describe, expect, it } from "vitest";
import { agendaReadingLabel, mostVisibleAgendaDate, sameAgendaReadingDate } from "@/lib/ui/agenda-reading-context";

describe("visible agenda date", () => {
  const rows = [
    { date: "2026-10-19", top: -220, bottom: 25 },
    { date: "2026-10-20", top: 33, bottom: 253 },
    { date: "2026-10-21", top: 261, bottom: 410 }
  ];
  it("chooses the dominant20th rather than a trailing19th fragment", () => {
    expect(mostVisibleAgendaDate(rows, 0, 300)).toEqual({ date: "2026-10-20" });
  });
  it("clips both ends to the actually visible frame, including a sticky header", () => {
    expect(mostVisibleAgendaDate(rows, 245, 390)).toEqual({ date: "2026-10-21" });
    expect(mostVisibleAgendaDate(rows, -200, 20)).toEqual({ date: "2026-10-19" });
  });
  it("keeps a tall date spanning the viewport and ignores invisible last rows", () => {
    expect(mostVisibleAgendaDate([{ date: "20", top: -900, bottom: 900 }, { date: "21", top: 908, bottom: 940 }], 0, 300)).toEqual({ date: "20" });
  });
  it("breaks an equal visible-height tie in reading order without hysteresis or timers", () => {
    expect(mostVisibleAgendaDate([{ date: "19", top: -50, bottom: 100 }, { date: "20", top: 100, bottom: 250 }], 0, 200)).toEqual({ date: "19" });
  });
  it("retains an explicit collapsed date range", () => {
    const next = mostVisibleAgendaDate([{ date: "2026-10-19", endDate: "2026-10-21", top: 5, bottom: 100 }], 0, 200)!;
    expect(agendaReadingLabel(next)).toBe("19–21일");
    expect(sameAgendaReadingDate(next, { date: "2026-10-19" })).toBe(false);
    expect(agendaReadingLabel({ date: "2026-10-20" })).toBe("20일");
  });
  it("does not invent a new date for a hidden or empty frame", () => {
    for (const [top, bottom] of [[0, 0], [20, 10], [NaN, 20], [0, Infinity], [500, 600]]) {
      expect(mostVisibleAgendaDate(rows, top, bottom)).toBeUndefined();
    }
    expect(mostVisibleAgendaDate([], 0, 100)).toBeUndefined();
  });
});

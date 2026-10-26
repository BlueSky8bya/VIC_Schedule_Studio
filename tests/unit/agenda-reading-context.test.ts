import { describe, expect, it } from "vitest";
import { agendaReadingLabel, anchoredAgendaDate, sameAgendaReadingDate } from "@/lib/ui/agenda-reading-context";

describe("visible agenda date", () => {
  const rows = [
    { date: "2026-10-19", top: -220, bottom: 25 },
    { date: "2026-10-20", top: 33, bottom: 253 },
    { date: "2026-10-21", top: 261, bottom: 410 }
  ];
  it("chooses the dominant20th rather than a trailing19th fragment", () => {
    expect(anchoredAgendaDate(rows, 0, 300)).toEqual({ date: "2026-10-20" });
  });
  it("clips both ends to the actually visible frame, including a sticky header", () => {
    expect(anchoredAgendaDate(rows, 245, 390)).toEqual({ date: "2026-10-21" });
    expect(anchoredAgendaDate(rows, -200, 20)).toEqual({ date: "2026-10-19" });
  });
  it("keeps a tall date spanning the viewport and ignores invisible last rows", () => {
    expect(anchoredAgendaDate([{ date: "20", top: -900, bottom: 900 }, { date: "21", top: 908, bottom: 940 }], 0, 300)).toEqual({ date: "20" });
  });
  it("selects a short day even beside a taller following day", () => {
    expect(anchoredAgendaDate([{ date: "20", top: 30, bottom: 78 }, { date: "21", top: 86, bottom: 500 }], 0, 400)).toEqual({ date: "20" });
  });
  it("lets each short month-end day cross the same reading line", () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({ date: String(index + 27), top: index * 60, bottom: index * 60 + 52 }));
    for (let day = 28; day <= 31; day++) {
      const shift = (day - 27) * 60 - 40;
      expect(anchoredAgendaDate(rows.map(row => ({ ...row, top: row.top - shift, bottom: row.bottom - shift })), 0, 400)?.date).toBe(String(day));
    }
  });
  it("keeps the row containing the reading line", () => {
    expect(anchoredAgendaDate([{ date: "19", top: -50, bottom: 100 }, { date: "20", top: 100, bottom: 250 }], 0, 200)).toEqual({ date: "19" });
  });
  it("retains an explicit collapsed date range", () => {
    const next = anchoredAgendaDate([{ date: "2026-10-19", endDate: "2026-10-21", top: 5, bottom: 100 }], 0, 200)!;
    expect(agendaReadingLabel(next)).toBe("19–21일");
    expect(sameAgendaReadingDate(next, { date: "2026-10-19" })).toBe(false);
    expect(agendaReadingLabel({ date: "2026-10-20" })).toBe("20일");
  });
  it("does not invent a new date for a hidden or empty frame", () => {
    for (const [top, bottom] of [[0, 0], [20, 10], [NaN, 20], [0, Infinity], [500, 600]]) {
      expect(anchoredAgendaDate(rows, top, bottom)).toBeUndefined();
    }
    expect(anchoredAgendaDate([], 0, 100)).toBeUndefined();
  });
});

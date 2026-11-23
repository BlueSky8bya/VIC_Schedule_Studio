import { describe, expect, it } from "vitest";
import { addDaysIso, daysBetweenIso, spanDragAnchor, spanGrabOffset, spanGrabZones } from "@/lib/studio/editor-model";

// 묶음 끌기(2026-11-20 소유자): 잡은 날이 손 아래에 남는다 — 이동 폭 = 놓은 날 − 잡은 날, 묶음 전체에 같은 폭.
const move = (start: string, end: string, press: string | null, drop: string) => {
  const delta = daysBetweenIso(spanDragAnchor(press, start, end), drop);
  return [addDaysIso(start, delta), addDaysIso(end, delta)];
};

describe("spanDragAnchor", () => {
  it("grab the last day of 20–22 and drop on the 23rd → 21–23 (not 23–25)", () => {
    expect(move("2026-06-20", "2026-06-22", "2026-06-22", "2026-06-23")).toEqual(["2026-06-21", "2026-06-23"]);
  });
  it("grab the middle of a 5-day run and move one cell right → whole run +1", () => {
    expect(move("2026-06-08", "2026-06-12", "2026-06-10", "2026-06-11")).toEqual(["2026-06-09", "2026-06-13"]);
  });
  it("grab the first day — unchanged behaviour", () => {
    expect(move("2026-06-20", "2026-06-22", "2026-06-20", "2026-06-27")).toEqual(["2026-06-27", "2026-06-29"]);
  });
  it("across a week and backwards", () => {
    expect(move("2026-06-26", "2026-06-28", "2026-06-28", "2026-06-21")).toEqual(["2026-06-19", "2026-06-21"]);
  });
  it("a press just outside the run sticks to the nearest end; unknown press = first day", () => {
    expect(spanDragAnchor("2026-06-25", "2026-06-20", "2026-06-22")).toBe("2026-06-22");
    expect(spanDragAnchor("2026-06-19", "2026-06-20", "2026-06-22")).toBe("2026-06-20");
    expect(spanDragAnchor(null, "2026-06-20", "2026-06-22")).toBe("2026-06-20");
  });
});

// 손에 든 칩의 어디를 쥐는가(2026-11-24 소유자): 칩에 보이는 자리가 곧 뜻 — 왼쪽 끝 = 첫날, 오른쪽 끝 = 끝날, 가운데 = 그 사이.
describe("spanGrabOffset", () => {
  const widths = [70, 90, 130, 200, 340];
  it("only the first day lands in the left end zone, only the last day in the right end zone", () => {
    for (const w of widths) {
      const { edge, inner } = spanGrabZones(w);
      for (const total of [2, 3, 12, 40]) {
        for (const t of [0, 0.5, 1]) {
          expect(spanGrabOffset(0, total, t, w)).toBeLessThanOrEqual(edge + 1e-9);
          expect(spanGrabOffset(total - 1, total, t, w)).toBeGreaterThanOrEqual(w - edge - 1e-9);
          for (let day = 1; day < total - 1; day++) {
            const x = spanGrabOffset(day, total, t, w);
            expect(x).toBeGreaterThanOrEqual(inner - 1e-9);
            expect(x).toBeLessThanOrEqual(w - inner + 1e-9);
          }
        }
      }
    }
  });
  it("the end zone is 16 to 28 px and the gap to the inner zone is at least 14 px on normal chips", () => {
    for (const w of [90, 130, 200, 340]) {
      const { edge, inner } = spanGrabZones(w);
      expect(edge).toBeGreaterThanOrEqual(16);
      expect(edge).toBeLessThanOrEqual(28);
      expect(inner - edge).toBeGreaterThanOrEqual(14 - 1e-9);
    }
  });
  it("a 12-day bar grabbed on its second day is held inside the chip, clear of the left end", () => {
    const w = 130, { edge } = spanGrabZones(w);
    expect(spanGrabOffset(1, 12, 0.5, w)).toBeGreaterThan(edge + 14);
  });
  it("the pointer never sits on the very edge of the chip", () => {
    for (const w of widths) {
      expect(spanGrabOffset(0, 5, 0, w)).toBeGreaterThanOrEqual(6);
      expect(spanGrabOffset(4, 5, 1, w)).toBeLessThanOrEqual(w - 6);
    }
  });
  it("inner days keep their order from left to right", () => {
    const xs = Array.from({ length: 10 }, (_, i) => spanGrabOffset(i + 1, 12, 0.5, 200));
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
  });
  it("a one-day item is held where it was pressed", () => {
    expect(spanGrabOffset(0, 1, 0.7, 100)).toBeCloseTo(70, 6);
  });
});

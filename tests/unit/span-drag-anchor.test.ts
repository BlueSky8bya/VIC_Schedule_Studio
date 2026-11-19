import { describe, expect, it } from "vitest";
import { addDaysIso, daysBetweenIso, spanDragAnchor } from "@/lib/studio/editor-model";

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

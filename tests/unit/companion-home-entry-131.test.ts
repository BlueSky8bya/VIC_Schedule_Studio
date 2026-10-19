import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { companionInitialHomePoint } from "@/lib/ui/viewer-companion/home-entry";

const seat: Platform = { id: "companion-home", kind: "date", x: 100, y: 180, width: 40 };
const floor: Platform = { id: "companion-home-floor-1", kind: "floor", x: 180, y: 260, width: 100, manualOnly: true };
describe("fresh resident's actual home entry", () => {
  it("waits for the actual room instead of borrowing a calendar or viewport floor", () => {
    const calendar: Platform[] = [{ ...seat, id: "date-22" }, { ...floor, id: "viewport-floor" }];
    expect(companionInitialHomePoint(calendar, [], .5)).toBeNull();
    expect(companionInitialHomePoint([], [], .5)).toBeNull();
  });
  it("selects both real cushion and current safe floor fragments with one retained draw", () => {
    expect(companionInitialHomePoint([seat], [floor], 0)).toEqual({ x: 112, y: 180, platformId: seat.id });
    const low = companionInitialHomePoint([seat], [floor], .5)!;
    const high = companionInitialHomePoint([seat], [floor], 1)!;
    expect(low).toEqual({ x: 210, y: 260, platformId: floor.id });
    expect(high).toEqual({ x: 268, y: 260, platformId: floor.id });
    expect(high.x).toBeGreaterThan(low.x);
  });
  it("rejects food-tier, control, stale invalid and zero-width supports", () => {
    for (const p of [{ ...floor, id: "companion-home-floor-food" }, { ...seat, kind: "control" as const }, { ...floor, x: NaN }, { ...seat, width: 0 }, { ...floor, y: Infinity }]) {
      expect(companionInitialHomePoint([p], [], .3)).toBeNull();
    }
  });
  it("does not double-weight supports published in both current tiers", () => {
    expect(companionInitialHomePoint([seat], [seat, floor], .5)).toEqual(companionInitialHomePoint([seat], [floor], .5));
  });
  it("clamps an invalid draw without mutating measured geometry", () => {
    const source = structuredClone([seat, floor]);
    expect(companionInitialHomePoint([seat], [floor], -20)?.platformId).toBe(seat.id);
    expect(companionInitialHomePoint([seat], [floor], NaN)?.platformId).toBe(floor.id);
    expect([seat, floor]).toEqual(source);
  });
});

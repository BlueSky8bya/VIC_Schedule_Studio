import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { nearestVerticalCompanionSupport } from "@/lib/ui/viewer-companion/support-landing";

const span = (id: string, x: number, y: number, width: number, kind: Platform["kind"] = "card"): Platform => ({ id, x, y, width, kind });

describe("companion vertical support recovery", () => {
  it("selects the closest height that actually covers the current x", () => {
    const near = span("near", 90, 515, 40), far = span("far", 0, 580, 400);
    expect(nearestVerticalCompanionSupport({ x: 100, y: 500 }, [far, near])).toBe(near);
    expect(nearestVerticalCompanionSupport({ x: 125, y: 500 }, [far, near])).toBe(near);
  });

  it("uses absolute height rather than always falling to a lower or first floor", () => {
    const floor = span("floor", 0, 750, 500, "floor"), below = span("below", 80, 545, 80), above = span("above", 80, 485, 80);
    expect(nearestVerticalCompanionSupport({ x: 100, y: 500 }, [floor, below, above])).toBe(above);
    expect(nearestVerticalCompanionSupport({ x: 100, y: 540 }, [above, floor, below])).toBe(below);
  });

  it("accepts the real safe edges of a narrow span without the walking inset", () => {
    const narrow = span("narrow", 100, 500, 4);
    for (const x of [100, 100.01, 102, 103.99, 104]) expect(nearestVerticalCompanionSupport({ x, y: 510 }, [narrow])).toBe(narrow);
    expect(nearestVerticalCompanionSupport({ x: 99.999, y: 510 }, [narrow])).toBeUndefined();
    expect(nearestVerticalCompanionSupport({ x: 104.001, y: 510 }, [narrow])).toBeUndefined();
  });

  it("does not cross an occluded gap between fragments of the same anchor", () => {
    const left = span("card-1", 0, 500, 80), right = span("card-1-1", 120, 500, 80);
    expect(nearestVerticalCompanionSupport({ x: 100, y: 500 }, [left, right])).toBeUndefined();
    expect(nearestVerticalCompanionSupport({ x: 80, y: 500 }, [left, right])).toBe(left);
    expect(nearestVerticalCompanionSupport({ x: 120, y: 500 }, [left, right])).toBe(right);
  });

  it("returns no support instead of moving x to an unrelated floor fragment", () => {
    const floor = span("viewport-floor", 20, 780, 90, "floor"), remote = span("remote", 450, 505, 80);
    expect(nearestVerticalCompanionSupport({ x: 300, y: 500 }, [floor, remote])).toBeUndefined();
    expect(nearestVerticalCompanionSupport({ x: 300, y: 500 }, [])).toBeUndefined();
  });

  it("prefers a real nonfloor ledge at an equal distance, independent of input order", () => {
    const floor = span("floor", 0, 520, 500, "floor"), ledge = span("ledge", 80, 480, 80, "date");
    expect(nearestVerticalCompanionSupport({ x: 100, y: 500 }, [floor, ledge])).toBe(ledge);
    expect(nearestVerticalCompanionSupport({ x: 100, y: 500 }, [ledge, floor])).toBe(ledge);
    const closerFloor = span("closer-floor", 0, 501, 500, "floor");
    expect(nearestVerticalCompanionSupport({ x: 100, y: 500 }, [ledge, closerFloor])).toBe(closerFloor);
  });

  it("keeps deterministic first-in order when equally near ledges have the same priority", () => {
    const above = span("above", 80, 480, 80), below = span("below", 80, 520, 80, "date");
    expect(nearestVerticalCompanionSupport({ x: 100, y: 500 }, [above, below])).toBe(above);
    expect(nearestVerticalCompanionSupport({ x: 100, y: 500 }, [below, above])).toBe(below);
  });

  it("rejects invalid points, widths, anonymous ids and overflowing coordinates", () => {
    const valid = span("valid", 80, 500, 80);
    for (const point of [{ x: NaN, y: 500 }, { x: 100, y: Infinity }, { x: -Infinity, y: 0 }]) expect(nearestVerticalCompanionSupport(point, [valid])).toBeUndefined();
    const invalid = [
      span("", 0, 500, 1000), span("nan", NaN, 500, 1000), span("infinite", 0, Infinity, 1000),
      span("zero", 100, 500, 0), span("negative", 100, 500, -100), span("wide", 0, 500, Infinity),
      span("overflow", Number.MAX_VALUE, 500, Number.MAX_VALUE),
    ];
    expect(nearestVerticalCompanionSupport({ x: 100, y: 500 }, invalid)).toBeUndefined();
    expect(nearestVerticalCompanionSupport({ x: 100, y: 500 }, [...invalid, valid])).toBe(valid);
    expect(nearestVerticalCompanionSupport({ x: 0, y: -Number.MAX_VALUE }, [span("distance-overflow", 0, Number.MAX_VALUE, 1)])).toBeUndefined();
  });

  it("leaves the point, platform records and caller ordering untouched", () => {
    const point = Object.freeze({ x: 100, y: 500 });
    const far = Object.freeze(span("far", 80, 580, 80)), near = Object.freeze(span("near", 80, 510, 80));
    const platforms = Object.freeze([far, near]);
    expect(nearestVerticalCompanionSupport(point, platforms)).toBe(near);
    expect(point).toEqual({ x: 100, y: 500 }); expect(platforms).toEqual([far, near]);
    expect(near).toEqual(span("near", 80, 510, 80));
  });
});

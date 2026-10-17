import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { companionViewportFloorAbove, firstCompanionSupportBelow, nearestVerticalCompanionSupport, recoverCompanionDropAtViewportFloor } from "@/lib/ui/viewer-companion/support-landing";

const span = (id: string, x: number, y: number, width: number, kind: Platform["kind"] = "card"): Platform => ({ id, x, y, width, kind });

describe("explicit drop recovery from an occluded floor gap", () => {
  it("slides onto the nearest real floor edge without changing vertical ray helpers", () => {
    const left = span("viewport-floor", 100, 940, 20, "floor"), right = span("viewport-floor-1", 160, 940, 20, "floor");
    const point = { x: 148, y: 980 };
    expect(firstCompanionSupportBelow(point, [left, right])).toBeUndefined();
    expect(companionViewportFloorAbove(point, [left, right])).toBeUndefined();
    expect(recoverCompanionDropAtViewportFloor(point, [left, right])).toEqual({ platform: right, x: 160 });
  });
  it("rejects home/card/lookalike floors and corrupt or empty geometry", () => {
    const candidates = [span("companion-home-floor", 0, 900, 1000, "floor"), span("viewport-floor-lookalike", 0, 900, 1000, "floor"), span("viewport-floor", 0, 900, 1000, "card"), span("viewport-floor-1", NaN, 900, 100, "floor"), span("viewport-floor-2", 0, 900, -1, "floor")];
    expect(recoverCompanionDropAtViewportFloor({ x: 500, y: 980 }, candidates)).toBeUndefined();
    expect(recoverCompanionDropAtViewportFloor({ x: NaN, y: 980 }, [])).toBeUndefined();
    expect(recoverCompanionDropAtViewportFloor({ x: 500, y: 980 }, [])).toBeUndefined();
  });
  it("is deterministic and never mutates the actual safe fragments", () => {
    const left = Object.freeze(span("viewport-floor", 100, 940, 20, "floor")), right = Object.freeze(span("viewport-floor-1", 160, 940, 20, "floor"));
    const point = Object.freeze({ x: 140, y: 980 });
    for (const candidates of [Object.freeze([left, right]), Object.freeze([right, left])]) expect(recoverCompanionDropAtViewportFloor(point, candidates)).toEqual({ platform: left, x: 120 });
    expect(recoverCompanionDropAtViewportFloor({ x: 110, y: 400 }, [left])).toEqual({ platform: left, x: 110 });
  });
});

describe("deliberate first-contact landing", () => {
  it("hits the first lower card instead of the closest upper line or an early floor entry", () => {
    const upper = span("above", 80, 299, 80), first = span("first", 80, 360, 80), lower = span("lower", 80, 500, 80), floor = span("floor", 0, 780, 1000, "floor");
    expect(firstCompanionSupportBelow({ x: 100, y: 300 }, [floor, lower, upper, first])).toBe(first);
    expect(firstCompanionSupportBelow({ x: 100, y: 400 }, [floor, lower, first])).toBe(lower);
  });
  it("keeps the exact vertical ray, including both actual card edges", () => {
    const first = span("first", 100, 400, 80), floor = span("floor", 0, 780, 1000, "floor");
    for (const x of [100, 140, 180]) expect(firstCompanionSupportBelow({ x, y: 300 }, [floor, first])).toBe(first);
    expect(firstCompanionSupportBelow({ x: 99, y: 300 }, [first, floor])).toBe(floor);
    expect(firstCompanionSupportBelow({ x: 181, y: 300 }, [first])).toBeUndefined();
  });
  it("uses edge attraction only when no real lower span covers x", () => {
    const card = span("card", 100, 400, 80), floor = span("floor", 0, 780, 1000, "floor");
    expect(firstCompanionSupportBelow({ x: 90, y: 300 }, [card], 22)).toBe(card);
    expect(firstCompanionSupportBelow({ x: 77, y: 300 }, [card], 22)).toBeUndefined();
    expect(firstCompanionSupportBelow({ x: 90, y: 300 }, [card, floor], 22)).toBe(floor);
  });
  it("does not fall through the same contact because painted feet round by a fraction", () => {
    const card = span("card", 100, 400, 80), floor = span("floor", 0, 780, 1000, "floor");
    expect(firstCompanionSupportBelow({ x: 120, y: 400.000366 }, [floor, card])).toBe(card);
    expect(firstCompanionSupportBelow({ x: 120, y: 400.49 }, [floor, card])).toBe(card);
    expect(firstCompanionSupportBelow({ x: 120, y: 400.51 }, [floor, card])).toBe(floor);
  });
  it("has deterministic nonfloor/id ties regardless of candidate order", () => {
    const a = span("card-a", 0, 500, 300), b = span("card-b", 0, 500, 300), floor = span("floor", 0, 500, 1000, "floor");
    for (const candidates of [[floor, b, a], [a, floor, b], [b, a, floor]]) expect(firstCompanionSupportBelow({ x: 100, y: 400 }, candidates)).toBe(a);
  });
  it("has no upper or invented floor fallback", () => {
    const upper = span("upper", 0, 200, 500), remote = span("remote", 500, 700, 100);
    expect(firstCompanionSupportBelow({ x: 100, y: 400 }, [upper, remote])).toBeUndefined();
    expect(firstCompanionSupportBelow({ x: 100, y: 400 }, [])).toBeUndefined();
  });
  it("skips invalid surfaces and preserves the input records/order", () => {
    const valid = Object.freeze(span("valid", 0, 500, 200));
    const candidates = Object.freeze([span("bad", 0, 450, -10), span("nan", NaN, 450, 500), span("", 0, 450, 500), span("overflow", Number.MAX_VALUE, 450, Number.MAX_VALUE), valid]);
    expect(firstCompanionSupportBelow({ x: 100, y: 400 }, candidates)).toBe(valid);
    expect(candidates.at(-1)).toBe(valid);
    expect(firstCompanionSupportBelow({ x: NaN, y: 400 }, candidates)).toBeUndefined();
    expect(firstCompanionSupportBelow({ x: 100, y: Infinity }, candidates)).toBeUndefined();
  });
});

describe("explicit release below the protected viewport floor", () => {
  it("recovers the actual nearest protected floor at the same x", () => {
    const upper = span("viewport-floor", 80, 900, 160, "floor"), lower = span("viewport-floor-2", 80, 940, 160, "floor");
    const point = { x: 180, y: 980 };
    expect(firstCompanionSupportBelow(point, [upper, lower])).toBeUndefined();
    expect(companionViewportFloorAbove(point, [upper, lower])).toBe(lower);
  });
  it("never substitutes a date, a home floor or a floor outside the safe ray", () => {
    const point = { x: 180, y: 980 };
    const candidates = [span("date-3", 80, 975, 160, "date"), span("companion-home-floor", 80, 975, 160, "floor"), span("viewport-floor-1", 181, 950, 80, "floor"), span("viewport-floor-lookalike", 80, 950, 160, "floor"), span("viewport-floor", 80, 950, 160, "card")];
    expect(companionViewportFloorAbove(point, candidates)).toBeUndefined();
  });
  it("keeps both safe edges and rejects the occluded gap between fragments", () => {
    const left = span("viewport-floor", 100, 940, 20, "floor"), right = span("viewport-floor-1", 160, 940, 20, "floor");
    for (const x of [100, 110, 120]) expect(companionViewportFloorAbove({ x, y: 980 }, [left, right])).toBe(left);
    for (const x of [160, 170, 180]) expect(companionViewportFloorAbove({ x, y: 980 }, [left, right])).toBe(right);
    expect(companionViewportFloorAbove({ x: 140, y: 980 }, [left, right])).toBeUndefined();
  });
  it("leaves ordinary downward contacts to the original first-hit rule", () => {
    const point = { x: 180, y: 920 }, floor = span("viewport-floor", 80, 940, 160, "floor"), card = span("card-top", 80, 930, 160);
    expect(companionViewportFloorAbove(point, [floor, card])).toBeUndefined();
    expect(firstCompanionSupportBelow(point, [floor, card])).toBe(card);
  });
  it("rejects corrupt coordinates without changing caller records", () => {
    const floor = Object.freeze(span("viewport-floor", 80, 940, 160, "floor")), point = Object.freeze({ x: 180, y: 980 });
    const candidates = Object.freeze([span("viewport-floor-1", NaN, 950, 160, "floor"), span("viewport-floor-2", 80, Infinity, 160, "floor"), span("viewport-floor-3", 80, 950, -1, "floor"), floor]);
    expect(companionViewportFloorAbove(point, candidates)).toBe(floor);
    expect(companionViewportFloorAbove({ x: NaN, y: 980 }, candidates)).toBeUndefined();
    expect(companionViewportFloorAbove({ x: 180, y: Infinity }, candidates)).toBeUndefined();
    expect(candidates.at(-1)).toBe(floor); expect(point).toEqual({ x: 180, y: 980 });
  });
});

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

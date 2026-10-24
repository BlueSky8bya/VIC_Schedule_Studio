import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { captureCompanionViewportFloor, restoreCompanionViewportFloor, companionViewportFloorAbove, companionWorldHiddenReason, firstCompanionSupportBelow, nearestVerticalCompanionSupport, recoverCompanionDropAtViewportFloor, recoverCompanionPassiveFloor, recoverCompanionVerticalSupport } from "@/lib/ui/viewer-companion/support-landing";

const span = (id: string, x: number, y: number, width: number, kind: Platform["kind"] = "card"): Platform => ({ id, x, y, width, kind });

describe("lost calendar support at a preserved horizontal point", () => {
  const top = (id: string, y: number, x = 80, width = 100): Platform => ({ ...span(id, x, y, width), manualOnly: true });
  it("keeps a genuine text ledge before considering a closer card top", () => {
    const text = span("card-4", 80, 580, 100), card = top("card-8-top", 502);
    expect(recoverCompanionVerticalSupport({ x: 100, y: 500 }, [text], [card])).toBe(text);
  });
  it("falls onto the first real lower card top instead of an upper edge or floor", () => {
    const upper = top("card-2-top", 480), lower = top("card-3-top-1", 550), floor = span("viewport-floor", 0, 780, 900, "floor");
    expect(recoverCompanionVerticalSupport({ x: 100, y: 500 }, [], [floor, upper, lower])).toBe(lower);
  });
  it("does not change x to cross a protected gap or pull upward onto an old card", () => {
    const upper = top("card-2-top", 480), left = top("card-3-top", 550, 0, 80), right = top("card-4-top", 550, 120, 80);
    expect(recoverCompanionVerticalSupport({ x: 100, y: 500 }, [], [upper, left, right])).toBeUndefined();
  });
  it("accepts an actual viewport floor above the point without fabricating one", () => {
    const floor = span("viewport-floor-2", 80, 740, 100, "floor");
    expect(recoverCompanionVerticalSupport({ x: 100, y: 780 }, [], [floor])).toBe(floor);
    expect(recoverCompanionVerticalSupport({ x: 100, y: 780 }, [], [])).toBeUndefined();
  });
  it("excludes home, control, food and lookalike surfaces from emergency recovery", () => {
    const excluded = [top("companion-home", 550), top("card-2-food-top", 550), { ...top("card-2-top", 550), manualOnly: false }, span("companion-home-floor", 80, 550, 100, "floor"), span("viewport-floor-lookalike", 80, 550, 100, "floor"), span("card-4-top", 80, 550, 100, "control")];
    expect(recoverCompanionVerticalSupport({ x: 100, y: 500 }, [], excluded)).toBeUndefined();
  });
  it("retains exact safe edges and immutable records, and rejects corrupt points", () => {
    const card = Object.freeze(top("card-3-top", 550)), candidates = Object.freeze([card]);
    for (const x of [80, 100, 180]) expect(recoverCompanionVerticalSupport(Object.freeze({ x, y: 500 }), [], candidates)).toBe(card);
    expect(recoverCompanionVerticalSupport({ x: 79.99, y: 500 }, [], candidates)).toBeUndefined();
    expect(recoverCompanionVerticalSupport({ x: NaN, y: 500 }, [], candidates)).toBeUndefined();
    expect(candidates).toEqual([card]);
  });
});

describe("bounded passive recovery onto an existing lower viewport-floor edge", () => {
  it("recovers the measured short-calendar rejection without changing exact-ray intent", () => {
    const point = { x: 918.587, y: 289.923 }, floor = span("viewport-floor-2", 963.601, 410, 120, "floor");
    expect(nearestVerticalCompanionSupport(point, [floor])).toBeUndefined();
    expect(firstCompanionSupportBelow(point, [floor])).toBeUndefined();
    expect(recoverCompanionVerticalSupport(point, [], [floor])).toBeUndefined();
    expect(recoverCompanionPassiveFloor(point, [floor], 92)).toEqual({ platform: floor, x: 963.601 });
  });
  it("accepts the inclusive body-width edge and rejects a farther safe fragment", () => {
    const point = { x: 100, y: 200 }, budget = 92 * .76;
    const right = span("viewport-floor-1", point.x + budget, 400, 20, "floor"), left = span("viewport-floor", point.x - budget - 20, 400, 20, "floor");
    expect(recoverCompanionPassiveFloor(point, [right], 92)).toEqual({ platform: right, x: right.x });
    expect(recoverCompanionPassiveFloor(point, [left], 92)).toEqual({ platform: left, x: left.x + left.width });
    expect(recoverCompanionPassiveFloor(point, [{ ...right, x: right.x + .001 }], 92)).toBeUndefined();
    expect(recoverCompanionPassiveFloor(point, [{ ...left, x: left.x - .001 }], 92)).toBeUndefined();
  });
  it("keeps the first lost-x budget through repeated real revalidation", () => {
    const originX = 100, first = span("viewport-floor", 150, 400, 10, "floor");
    const start = recoverCompanionPassiveFloor({ x: originX, y: 200 }, [first], 92, originX)!;
    expect(start).toEqual({ platform: first, x: 150 });
    const stillInside = span("viewport-floor-1", 169, 420, 10, "floor"), beyondOrigin = span("viewport-floor-2", 180, 420, 10, "floor");
    expect(recoverCompanionPassiveFloor({ x: start.x, y: 300 }, [stillInside], 92, originX)).toEqual({ platform: stillInside, x: 169 });
    expect(recoverCompanionPassiveFloor({ x: start.x, y: 300 }, [beyondOrigin], 92, originX)).toBeUndefined();
    // Resetting origin to the moving point would incorrectly authorize another
    // short slide; the runtime must retain originX for this complete episode.
    expect(recoverCompanionPassiveFloor({ x: start.x, y: 300 }, [beyondOrigin], 92)).toEqual({ platform: beyondOrigin, x: 180 });
  });
  it("chooses the nearest actual contact deterministically without moving an in-span point", () => {
    const point = Object.freeze({ x: 140, y: 200 }), left = Object.freeze(span("viewport-floor", 100, 400, 20, "floor")), right = Object.freeze(span("viewport-floor-1", 160, 400, 20, "floor"));
    for (const candidates of [Object.freeze([left, right]), Object.freeze([right, left])]) expect(recoverCompanionPassiveFloor(point, candidates, 92)).toEqual({ platform: left, x: 120 });
    expect(recoverCompanionPassiveFloor({ x: 110, y: 200 }, [left], 92)).toEqual({ platform: left, x: 110 });
    expect(point).toEqual({ x: 140, y: 200 }); expect(left).toEqual(span("viewport-floor", 100, 400, 20, "floor"));
  });
  it("never invents a floor or pulls upward, and excludes home, card and lookalike planes", () => {
    const point = { x: 140, y: 300 };
    const excluded = [span("viewport-floor", 100, 299.49, 100, "floor"), span("companion-home-floor", 100, 400, 100, "floor"), span("viewport-floor-food", 100, 400, 100, "floor"), span("viewport-floor-lookalike", 100, 400, 100, "floor"), span("viewport-floor-1", 100, 400, 100, "card"), span("card-2-top", 100, 400, 100, "floor")];
    expect(recoverCompanionPassiveFloor(point, excluded, 92)).toBeUndefined();
    expect(recoverCompanionPassiveFloor(point, [], 92)).toBeUndefined();
    const contact = span("viewport-floor-2", 100, 299.5, 100, "floor");
    expect(recoverCompanionPassiveFloor(point, [contact], 92)).toEqual({ platform: contact, x: 140 });
  });
  it("rejects corrupt inputs, nonpositive size and invalid floor endpoints", () => {
    const point = { x: 140, y: 200 }, floor = span("viewport-floor", 160, 400, 20, "floor");
    for (const size of [0, -1, NaN, Infinity]) expect(recoverCompanionPassiveFloor(point, [floor], size)).toBeUndefined();
    for (const origin of [NaN, Infinity, -Infinity]) expect(recoverCompanionPassiveFloor(point, [floor], 92, origin)).toBeUndefined();
    for (const badPoint of [{ x: NaN, y: 200 }, { x: 140, y: Infinity }]) expect(recoverCompanionPassiveFloor(badPoint, [floor], 92)).toBeUndefined();
    const corrupt = [{ ...floor, width: 0 }, { ...floor, width: -1 }, { ...floor, x: NaN }, { ...floor, y: Infinity }, { ...floor, x: Number.MAX_VALUE, width: Number.MAX_VALUE }];
    expect(recoverCompanionPassiveFloor(point, corrupt, 92)).toBeUndefined();
  });
});

describe("world visibility does not depend on ordinary window presentation", () => {
  const valid = { point: { x: 200, y: 500 }, viewport: { width: 1000, height: 800 }, size: 92, awaiting: false as const, hasSupport: true, pendingMonth: false, homeOccluded: false, atHome: false };
  it("keeps every invalid world reason explicit, including a closed resident", () => {
    expect(companionWorldHiddenReason(valid)).toBeNull();
    expect(companionWorldHiddenReason({ ...valid, awaiting: "vertical" })).toBe("vertical");
    expect(companionWorldHiddenReason({ ...valid, awaiting: "drop" })).toBe("drop");
    expect(companionWorldHiddenReason({ ...valid, hasSupport: false })).toBe("support");
    expect(companionWorldHiddenReason({ ...valid, atHome: true, homeOccluded: true })).toBe("home");
    expect(companionWorldHiddenReason({ ...valid, homeOccluded: true })).toBeNull();
  });
  it("permits only the existing pending-month support exception", () => {
    expect(companionWorldHiddenReason({ ...valid, pendingMonth: true, hasSupport: false })).toBeNull();
    expect(companionWorldHiddenReason({ ...valid, pendingMonth: true, awaiting: "vertical" })).toBe("vertical");
  });
  it.each([{ x: 49.99, y: 500 }, { x: 950.01, y: 500 }, { x: 200, y: 99.99 }, { x: 200, y: 788.01 }, { x: NaN, y: 500 }, { x: 200, y: Infinity }])("rejects the whole-cell unsafe point %j", point => {
    expect(companionWorldHiddenReason({ ...valid, point })).toBe("bounds");
  });
  it("keeps exact safe viewport edges and valid resident positions", () => {
    for (const point of [{ x: 50, y: 100 }, { x: 950, y: 788 }]) expect(companionWorldHiddenReason({ ...valid, point })).toBeNull();
  });
  it("keeps only a neutral supported vertical recovery visible above transparent cell padding", () => {
    const point = { x: 200, y: 87 };
    expect(companionWorldHiddenReason({ ...valid, point })).toBe("bounds");
    expect(companionWorldHiddenReason({ ...valid, point, neutralVerticalRecovery: true })).toBeNull();
    expect(companionWorldHiddenReason({ ...valid, point: { x: 200, y: 92 * .82 + 7.99 }, neutralVerticalRecovery: true })).toBe("bounds");
    expect(companionWorldHiddenReason({ ...valid, point, neutralVerticalRecovery: true, hasSupport: false })).toBe("support");
    expect(companionWorldHiddenReason({ ...valid, point, neutralVerticalRecovery: true, awaiting: "vertical" })).toBe("vertical");
    expect(companionWorldHiddenReason({ ...valid, point, neutralVerticalRecovery: true, atHome: true, homeOccluded: true })).toBe("home");
  });
});

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


describe("volatile viewport floor presentation across a real month change", () => {
  const root = { isConnected: true };
  const context = () => ({ point: { x: 210, y: 682 }, platform: span("viewport-floor", 20, 682, 960, "floor"), root,
    viewport: { width: 1000, height: 700 }, size: 92, monthKey: "2026-10", pathname: "/",
    state: { enabled: true, visible: true, blocked: false, reduced: false, held: false, airborne: false, carrying: false, owned: false, resting: false } });
  it("carries the exact measured screen plane and never mutates or invents a new platform list", () => {
    const before = context(), snapshot = captureCompanionViewportFloor(before)!;
    const next = { ...before, monthKey: "2026-8" }, original = structuredClone(snapshot);
    const carried = restoreCompanionViewportFloor(snapshot, next)!;
    expect(carried.point).toEqual(before.point); expect(carried.platform).toEqual(before.platform);
    expect(carried.monthKey).toBe("2026-8"); expect(snapshot).toEqual(original);
    expect(carried.platform).not.toBe(before.platform);
  });
  it.each(["enabled", "visible", "blocked", "reduced", "held", "airborne", "carrying", "owned"] as const)("rejects a revoked or owned capture and restore: %s", key => {
    const before = context(), snapshot = captureCompanionViewportFloor(before)!;
    before.state[key] = !["enabled", "visible"].includes(key);
    expect(captureCompanionViewportFloor(before)).toBeUndefined();
    expect(restoreCompanionViewportFloor(snapshot, { ...before, monthKey: "2026-8" })).toBeUndefined();
  });
  it.each(["same month", "different root", "detached root", "pathname", "viewport width", "viewport height", "footprint", "changed point"])("revokes handoff on %s", reason => {
    const before = context(), snapshot = captureCompanionViewportFloor(before)!;
    const next = { ...context(), monthKey: "2026-8" };
    if (reason === "same month") next.monthKey = before.monthKey;
    if (reason === "different root") next.root = { isConnected: true };
    if (reason === "detached root") { next.root = { isConnected: false }; }
    if (reason === "pathname") next.pathname = "/studio";
    if (reason === "viewport width") next.viewport.width -= 1;
    if (reason === "viewport height") next.viewport.height -= 1;
    if (reason === "footprint") next.size -= 1;
    if (reason === "changed point") next.point.x += 1;
    expect(restoreCompanionViewportFloor(snapshot, next)).toBeUndefined();
  });
  it.each(["calendar", "home", "food tier", "unknown", "body only", "manual", "off plane", "outside span", "NaN"])("does not lend an unproved floor: %s", reason => {
    const next = context();
    if (reason === "calendar") next.platform.id = "date-1-floor";
    if (reason === "home") next.platform.id = "companion-home-floor";
    if (reason === "food tier") next.platform.id = "viewport-floor-food";
    if (reason === "unknown") next.platform.kind = "card";
    if (reason === "body only") next.platform.bodyOnly = true;
    if (reason === "manual") next.platform.manualOnly = true;
    if (reason === "off plane") next.point.y -= 2;
    if (reason === "outside span") next.platform.x = 300;
    if (reason === "NaN") next.platform.width = NaN;
    expect(captureCompanionViewportFloor(next)).toBeUndefined();
  });
});

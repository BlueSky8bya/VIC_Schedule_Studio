import { describe, expect, it } from "vitest";
import { COMPANION_HOME_FLOOR_FOOD, COMPANION_TRASH_DISCARD_MS, COMPANION_TRASH_DWELL_MS, attachCompanionFood, companionFoodJostle, companionTrashProgress, followCompanionFood, followCompanionViewportFloorFood, isCompanionFoodBedSupport, isCompanionHomeFloorFoodSupport, isCompanionViewportFloorFoodSupport, placeCompanionFood, presentCompanionFood, rebaseCompanionFoodSupport, receiveCompanionHomeFloorFood, reconcileCompanionFood, safeCompanionAttachedFood, type CompanionFoodDropSupport } from "@/lib/ui/viewer-companion/food";
import type { CompanionFood, Platform } from "@/lib/ui/viewer-companion/brain";

const floor: Platform = { id: "floor", x: 12, y: 782, width: 976, kind: "floor" };
const card: Platform = { id: "card", x: 100, y: 350, width: 200, kind: "card" };
const apple: CompanionFood = { id: "apple", x: 200, y: 340, kind: "apple" };
const viewport = { width: 1000, height: 800 };

describe("121 fractional native food support", () => {
  it("retains native x fraction across calendar zoom and fixed3px top clearance", () => {
    const before = { x: 100.25, y: 350.125, width: 320.5, height: 40 };
    const attached = attachCompanionFood({ x: before.x + before.width * .37, y: before.y - 3 }, { x: 0, y: 200 }, before);
    const rect = { left: 700.5, top: 280.25, width: 256.4, height: 32 };
    const moved = followCompanionFood(attached, { x: 0, y: 270 }, rect);
    expect(moved.point.x).toBeCloseTo(rect.left + rect.width * .37, 10); expect(moved.point.y).toBe(277.25);
    expect(moved.attachment.elementPoint).toEqual(attached.elementPoint);
    expect(followCompanionFood(moved.attachment, { x: 0, y: 200 }, { left: before.x, top: before.y, width: before.width, height: before.height }).point).toEqual({ x: before.x + before.width * .37, y: before.y - 3 });
  });
  it("rebases the actual first-contact span and collision bounds with native width, once", () => {
    const support = { ...card, x: 150, width: 100, y: 347, dropSurface: { x: 100, width: 400 } };
    const result = rebaseCompanionFoodSupport(support, { left: 100, top: 350, width: 400, height: 100 }, { left: 700.125, top: 200.25, width: 200, height: 50 })!;
    expect(result).toEqual({ ...support, x: 725.125, width: 50, y: 197.25, dropSurface: { x: 700.125, width: 200 } });
    expect(placeCompanionFood(apple, { x: 740, y: 180 }, [result, floor]).platformId).toBe(card.id);
    expect(support.x).toBe(150);
  });
  it("keeps the same native plane clear of new controls while preserving the intended fraction for regrowth", () => {
    const attached = attachCompanionFood({ x: 250, y: 647 }, { x: 0, y: 0 }, { x: 100, y: 300, width: 300, height: 350 });
    const point = followCompanionFood(attached, { x: 0, y: 0 }, { left: 600, top: 100, width: 240, height: 280 }).point;
    expect(point).toEqual({ x: 720, y: 377 });
    expect(safeCompanionAttachedFood(point, [{ ...floor, x: 622, y: 377, width: 50 }, { ...floor, x: 770, y: 377, width: 48 }])).toEqual({ x: 672, y: 377 });
    expect(safeCompanionAttachedFood(point, [{ ...floor, y: 600 }])).toBeUndefined();
    expect(safeCompanionAttachedFood(point, [])).toBeUndefined();
    expect(followCompanionFood(attached, { x: 0, y: 0 }, { left: 100, top: 300, width: 300, height: 350 }).point).toEqual({ x: 250, y: 647 });
  });
  it("retains fixed22px floor hit clearance during pre-scan shrink and rejects a source narrower than the snack", () => {
    const support = { ...floor, x: 122, y: 497, width: 156 };
    const source = { left: 100, top: 300, width: 200, height: 200 };
    const shrunk = rebaseCompanionFoodSupport(support, source, { left: 600, top: 100, width: 100, height: 100 })!;
    expect(shrunk).toMatchObject({ x: 622, width: 56, y: 197 });
    for (const x of [shrunk.x, shrunk.x + shrunk.width]) { expect(x - 22).toBeGreaterThanOrEqual(600); expect(x + 22).toBeLessThanOrEqual(700); }
    expect(rebaseCompanionFoodSupport(support, source, { left: 600, top: 100, width: 43, height: 100 })).toBeUndefined();
    expect(rebaseCompanionFoodSupport(support, source, { ...source })).toEqual(support);
  });
  it("preserves fixed hit clearance beside an internal control and rejects a fragment too narrow after shrink", () => {
    const source = { left: 100, top: 300, width: 200, height: 200 }, rect = { left: 100, top: 100, width: 100, height: 100 };
    // An old control at180 leaves a safe centre span122..155. Its new left
    // edge140 leaves only40px of floor: no44px snack can fit in that gap.
    expect(rebaseCompanionFoodSupport({ ...floor, x: 122, width: 33, y: 497 }, source, rect)).toBeUndefined();
    const roomy = rebaseCompanionFoodSupport({ ...floor, x: 122, width: 93, y: 497 }, source, rect)!;
    // A farther old control at240 moves to170. The retained snack's hit
    // stays entirely left of it, even before the next full geometry scan.
    expect(roomy).toMatchObject({ x: 122, width: 24.5, y: 197 });
    expect(roomy.x + roomy.width + 22).toBeLessThanOrEqual(170);
    const right = rebaseCompanionFoodSupport({ ...floor, x: 185, width: 93, y: 497 }, source, rect)!;
    expect(right.x - 22).toBeGreaterThanOrEqual(130);
  });
});

describe("companion food support", () => {
  it("catches the first real crossed card across a safe-span gap before any lower exact-x card or floor", () => {
    const left = Object.freeze({ ...card, id: "card-3-food-top", x: 100, width: 70, dropSurface: Object.freeze({ x: 100, width: 200 }) });
    const right = Object.freeze({ ...left, id: "card-3-food-top-1", x: 230 });
    const lower = Object.freeze({ ...card, id: "card-4-food-top", y: 500 });
    for (const order of [[floor, lower, right, left], [left, right, lower, floor]]) {
      expect(placeCompanionFood(apple, { x: 190, y: 300 }, order)).toEqual({ ...apple, x: 170, y: 350, platformId: left.id });
      expect(placeCompanionFood(apple, { x: 210, y: 300 }, order)).toEqual({ ...apple, x: 230, y: 350, platformId: right.id });
      expect(placeCompanionFood(apple, { x: 200, y: 360 }, order)).toEqual({ ...apple, x: 200, y: 500, platformId: lower.id });
      expect(placeCompanionFood(apple, { x: 320, y: 300 }, order).platformId).toBe(floor.id);
    }
  });
  it("never expands a card collision from malformed bounds or a safe span outside its own source", () => {
    for (const dropSurface of [{ x: NaN, width: 500 }, { x: 100, width: Infinity }, { x: 100, width: -1 }, { x: 400, width: 200 }, { x: -Number.MAX_VALUE, width: Number.MAX_VALUE * 2 }]) {
      const support = { ...card, dropSurface };
      expect(placeCompanionFood(apple, { x: 500, y: 300 }, [support, floor]).platformId).toBe(floor.id);
    }
    const covered: CompanionFoodDropSupport = { ...card, id: "companion-home", dropSurface: { x: 100, width: 800 } };
    expect(placeCompanionFood(apple, apple, [covered, floor]).platformId).toBe(floor.id);
  });
  it("rebases safe centres and real collision bounds once before a delayed scroll scan and clips a shrinking source", () => {
    const original = Object.freeze({ ...card, x: 140, width: 80, dropSurface: Object.freeze({ x: 100, width: 200 }) });
    const source = Object.freeze({ left: 100, top: 353 });
    const moved = rebaseCompanionFoodSupport(original, source, { left: 120, top: 293, width: 200 })!;
    expect(moved).toEqual({ ...original, x: 160, y: 290, dropSurface: { x: 120, width: 200 } });
    expect(original).toEqual({ ...card, x: 140, width: 80, dropSurface: { x: 100, width: 200 } });
    expect(rebaseCompanionFoodSupport(original, source, { left: 120, top: 293, width: 80 })).toEqual({ ...moved, width: 40, dropSurface: { x: 120, width: 80 } });
    expect(rebaseCompanionFoodSupport(original, source, { left: 120, top: 293, width: 30 })).toBeUndefined();
    expect(rebaseCompanionFoodSupport(original, source, { left: NaN, top: 293, width: 200 })).toBeUndefined();
    const placed = placeCompanionFood(apple, { x: 280, y: 270 }, [moved, floor]);
    expect(placed).toEqual({ ...apple, x: 240, y: 290, platformId: moved.id });
    expect(placeCompanionFood(apple, { x: 110, y: 270 }, [moved, floor]).platformId).toBe(floor.id);
  });
  it("passes through the creature's sofa and every retired food seat, retaining the real first floor below", () => {
    const houseFloor: Platform = Object.freeze({ id: COMPANION_HOME_FLOOR_FOOD, x: 100, y: 600, width: 200, kind: "floor", manualOnly: true });
    for (const id of ["companion-home", "companion-home-1", "companion-home-food", "companion-home-food-2", "companion-home-bed-food", "companion-home-bed-food-3"]) {
      const seat = Object.freeze({ ...card, id, y: 450 });
      expect(isCompanionFoodBedSupport(id)).toBe(true);
      expect(placeCompanionFood(apple, apple, Object.freeze([floor, seat, houseFloor]))).toEqual({ ...apple, y: 600, platformId: houseFloor.id });
      expect(placeCompanionFood(apple, apple, [seat])).toEqual(apple);
      expect(reconcileCompanionFood({ ...apple, platformId: id }, [seat])).toEqual({ ...apple, platformId: undefined });
      expect(seat.y).toBe(450);
    }
    for (const id of [undefined, COMPANION_HOME_FLOOR_FOOD, "companion-home-floor-2", "card-3-food-top", "viewport-floor-food"]) expect(isCompanionFoodBedSupport(id)).toBe(false);
  });
  it("falls onto the real house floor first and recognizes only its explicit attachment family", () => {
    const homeFloor: Platform = { id: `${COMPANION_HOME_FLOOR_FOOD}-1`, x: 140, y: 600, width: 120, kind: "floor", manualOnly: true };
    const placed = placeCompanionFood(apple, { x: 200, y: 490 }, [floor, homeFloor]);
    expect(placed).toEqual({ ...apple, y: 600, platformId: homeFloor.id });
    expect(isCompanionHomeFloorFoodSupport(placed.platformId)).toBe(true);
    expect(isCompanionHomeFloorFoodSupport(COMPANION_HOME_FLOOR_FOOD)).toBe(true);
    for (const id of [undefined, "companion-home-floor", "companion-home-food", `${COMPANION_HOME_FLOOR_FOOD}-extra`, `${COMPANION_HOME_FLOOR_FOOD}-1-extra`]) expect(isCompanionHomeFloorFoodSupport(id)).toBe(false);
    expect(placeCompanionFood(apple, { x: 200, y: 610 }, [floor, homeFloor]).platformId).toBe(floor.id);
    expect(placeCompanionFood(apple, { x: 400, y: 490 }, [floor, homeFloor]).platformId).toBe(floor.id);
  });
  it("lands on a ledge instead of covering its text and keeps only explicit snack fields", () => {
    const placed = placeCompanionFood(apple, apple, [floor, card]);
    expect(placed).toEqual({ id: "apple", kind: "apple", x: 200, y: 350, platformId: "card" });
    expect(placeCompanionFood(apple, { x: 200, y: 400 }, [floor, card]).platformId).toBe("floor");
  });
  it("never picks another visible support when its card leaves the landing list", () => {
    const placed = placeCompanionFood(apple, apple, [floor, card]);
    expect(reconcileCompanionFood(placed, [floor])).toEqual(placed);
    expect(reconcileCompanionFood(placed, [floor, { ...card, x: 250, y: 420 }])).toEqual({ ...placed, x: 262, y: 420 });
  });
  it("keeps x at real safe edges without the creature's walking inset", () => {
    expect(placeCompanionFood({ ...apple, kind: "lemon" }, { x: 12, y: 700 }, [floor]).x).toBe(12);
    expect(placeCompanionFood(apple, { x: 988, y: 700 }, [floor]).x).toBe(988);
    expect(placeCompanionFood(apple, { x: 0, y: 700 }, [floor]).x).toBe(12);
  });
  it("retains a document point when every real ledge is above or horizontally distant", () => {
    expect(placeCompanionFood(apple, { x: 200, y: 800 }, [card, floor])).toEqual({ id: "apple", kind: "apple", x: 200, y: 800 });
    expect(placeCompanionFood(apple, { x: 9999, y: 700 }, [floor])).toEqual({ id: "apple", kind: "apple", x: 9999, y: 700 });
  });
  it("chooses the nearest lower height at the current x before considering small edge attraction", () => {
    const close = { ...card, id: "close", y: 400 }, far = { ...card, id: "far", y: 600 };
    expect(placeCompanionFood(apple, { x: 200, y: 370 }, [floor, far, close])).toEqual({ ...apple, y: 400, platformId: "close" });
    expect(placeCompanionFood(apple, { x: 90, y: 300 }, [card])).toEqual({ ...apple, x: 100, y: 350, platformId: "card" });
    expect(placeCompanionFood(apple, { x: 77, y: 300 }, [card]).platformId).toBeUndefined();
  });
  it("does not mutate the platform ordering and skips malformed lower surfaces", () => {
    const invalid = [{ ...card, id: "", y: 360 }, { ...card, x: NaN }, { ...card, width: -2 }, { ...card, y: Infinity }];
    const platforms = Object.freeze([Object.freeze(floor), ...invalid, Object.freeze(card)]);
    expect(placeCompanionFood(apple, apple, platforms).platformId).toBe("card");
    expect(platforms[0]).toBe(floor);
    expect(placeCompanionFood(apple, { x: NaN, y: 5 }, platforms)).toEqual(apple);
  });
  it("keeps a subpixel contact on its actual ledge without choosing an upper day", () => {
    expect(placeCompanionFood(apple, { x: 200, y: card.y + .000366 }, [floor, card])).toEqual({ ...apple, y: card.y, platformId: "card" });
    expect(placeCompanionFood(apple, { x: 200, y: card.y + .49 }, [floor, card]).platformId).toBe("card");
    expect(placeCompanionFood(apple, { x: 200, y: card.y + .51 }, [floor, card]).platformId).toBe(floor.id);
  });
  it("uses the nearest existing protected screen-floor span only after every real lower ray misses", () => {
    const left = Object.freeze({ id: "viewport-floor-food", x: 24, y: 782, width: 136, kind: "floor" as const });
    const right = Object.freeze({ id: "viewport-floor-food-1", x: 720, y: 782, width: 256, kind: "floor" as const });
    const distantCard = Object.freeze({ ...card, id: "card-4-food-top", x: 600, width: 80, y: 400 });
    const platforms = Object.freeze([left, distantCard, right]);
    const point = Object.freeze({ x: 500, y: 200 });
    expect(placeCompanionFood(apple, point, platforms, { width: 1000, height: 800 })).toEqual({ ...apple, x: 720, y: 782, platformId: right.id });
    expect(placeCompanionFood(apple, point, [...platforms].reverse(), { width: 1000, height: 800 })).toEqual({ ...apple, x: 720, y: 782, platformId: right.id });
    expect(platforms[1]).toBe(distantCard); expect(point).toEqual({ x: 500, y: 200 });
  });
  it("preserves the first crossed card or house floor instead of jumping to the final screen floor", () => {
    const screenFloor: Platform = { id: "viewport-floor-food", x: 500, y: 782, width: 200, kind: "floor" };
    const houseFloor: Platform = { id: COMPANION_HOME_FLOOR_FOOD, x: 150, y: 600, width: 100, kind: "floor" };
    const sofa: Platform = { ...houseFloor, id: "companion-home-food", y: 500 };
    const viewport = { width: 1000, height: 800 };
    expect(placeCompanionFood(apple, apple, [screenFloor, houseFloor, card, sofa], viewport)).toEqual({ ...apple, y: 350, platformId: card.id });
    expect(placeCompanionFood(apple, { x: 200, y: 450 }, [screenFloor, houseFloor, card, sofa], viewport)).toEqual({ ...apple, y: 600, platformId: houseFloor.id });
  });
  it("recovers a native grip below the protected screen floor onto that existing safe span", () => {
    const viewport = Object.freeze({ width: 1920, height: 1100 });
    const left = Object.freeze({ id: "viewport-floor-food", x: 24, y: 1030, width: 840, kind: "floor" as const });
    const right = Object.freeze({ ...left, id: "viewport-floor-food-1", x: 1048, width: 848 });
    const point = Object.freeze({ x: 1050, y: 1076 });
    expect(placeCompanionFood(apple, point, Object.freeze([left, right]), viewport)).toEqual({ ...apple, ...point, y: 1030, platformId: right.id });
    // A grip in the actual control gap goes to a measured safe centre, never
    // a newly manufactured full-width floor across its human hit target.
    expect(placeCompanionFood(apple, { x: 1000, y: 1076 }, [right, left], viewport)).toEqual({ ...apple, x: 1048, y: 1030, platformId: right.id });
    const lower = { ...left, id: "viewport-floor-food-2", x: 24, y: 1090, width: 100 };
    expect(placeCompanionFood(apple, point, [right, lower], viewport).platformId).toBe(lower.id);
    expect(point).toEqual({ x: 1050, y: 1076 }); expect(right.y).toBe(1030);
  });
  it("allows only a bounded visible floor recovery, never an upper card, house seat or stale offscreen span", () => {
    const viewport = { width: 1000, height: 800 }, point = { x: 500, y: 790 };
    const valid: Platform = { id: "viewport-floor-food", x: 450, y: 740, width: 100, kind: "floor" };
    for (const supported of [point, { ...point, y: 844 }, { x: -44, y: 790 }, { x: 1044, y: 790 }]) {
      expect(placeCompanionFood(apple, supported, [valid], viewport).platformId).toBe(valid.id);
    }
    for (const invalid of [{ ...point, y: 844.01 }, { x: -44.01, y: 790 }, { x: 1044.01, y: 790 }]) {
      expect(placeCompanionFood(apple, invalid, [valid], viewport).platformId).toBeUndefined();
    }
    const candidates: Platform[] = [card, { ...valid, kind: "card" }, { ...valid, id: "companion-home-floor-food" },
      { ...valid, x: -1 }, { ...valid, x: 950 }, { ...valid, y: 801 }, { ...valid, y: -1 }, { ...valid, y: 130 }, { ...valid, id: "viewport-floor-food-old" }];
    for (const candidate of candidates) expect(placeCompanionFood(apple, { ...point, y: 840 }, [candidate], viewport).platformId).toBeUndefined();
    // The exact lower bound comes from the existing fixed-bottom-bar rule;
    // a stale short-viewport floor may still be used for an ordinary fall,
    // but never as a large upward recovery after viewport growth.
    expect(placeCompanionFood(apple, { ...point, y: 840 }, [{ ...valid, y: 512 }], viewport).platformId).toBe(valid.id);
    expect(placeCompanionFood(apple, { ...point, y: 840 }, [{ ...valid, y: 511.99 }], viewport).platformId).toBeUndefined();
    expect(placeCompanionFood(apple, { x: 700, y: 100 }, [{ ...valid, y: 130 }], viewport).platformId).toBe(valid.id);
    expect(placeCompanionFood(apple, point, [valid])).toEqual({ ...apple, ...point });
  });
  it("retains an unsupported document floor below the viewport when valid safe floor spans are absent", () => {
    const point = { x: 500, y: 700 }, viewport = { width: 1000, height: 800 };
    const candidates: Platform[] = [
      { id: "viewport-floor-food", x: 50, y: -1, width: 100, kind: "floor" },
      { id: "viewport-floor-food-old", x: 800, y: 780, width: 100, kind: "floor" },
      { id: "companion-home-food", x: 450, y: 750, width: 100, kind: "floor" },
      { id: "viewport-floor-food-2", x: NaN, y: 780, width: 100, kind: "floor" },
      { id: "viewport-floor-food-3", x: 800, y: 780, width: -1, kind: "floor" },
    ];
    const placed = placeCompanionFood(apple, point, candidates, viewport);
    expect(placed).toEqual({ ...apple, x: 500, y: 844 });
    expect(placed.platformId).toBeUndefined();
    const attachment = attachCompanionFood(placed, { x: 0, y: 120 });
    expect(followCompanionFood(attachment, { x: 0, y: 220 }).point).toEqual({ x: 500, y: 744 });
    expect(followCompanionFood(attachment, { x: 0, y: 120 }).point).toEqual({ x: 500, y: 844 });
    expect(placeCompanionFood(apple, { x: 1, y: 700 }, [], viewport)).toEqual({ ...apple, x: 24, y: 844 });
    expect(placeCompanionFood(apple, { x: 999, y: 700 }, [], viewport)).toEqual({ ...apple, x: 976, y: 844 });
  });
  it("keeps the optional viewport fallback fail-closed for invalid dimensions and preserves legacy callers", () => {
    const point = { x: 500, y: 700 }, expected = { ...apple, ...point };
    for (const viewport of [{ width: 0, height: 800 }, { width: 47, height: 800 }, { width: 1000, height: 0 }, { width: NaN, height: 800 }, { width: 1000, height: Infinity }]) {
      expect(placeCompanionFood(apple, point, [], viewport)).toEqual(expected);
    }
    expect(placeCompanionFood(apple, point, [])).toEqual(expected);
  });
});

describe("companion food attachments", () => {
  it("keeps a viewport-floor resident on the current safe input plane instead of applying a document scroll delta", () => {
    const ground = Object.freeze({ ...floor, id: "viewport-floor-food" }), food = Object.freeze({ ...apple, x: 800, y: 782, platformId: ground.id });
    const next = followCompanionViewportFloorFood(food, 800, [ground], viewport)!;
    expect(next).toEqual(food);
    // Document attachments deliberately move with scroll; a floor-bound item
    // uses the current viewport support instead of inheriting this delta.
    expect(followCompanionFood(attachCompanionFood(food, { x: 0, y: 0 }), { x: 0, y: 360 }).point.y).toBe(422);
    expect(followCompanionViewportFloorFood(next, 800, [ground], viewport)).toEqual(food);
    expect(food.y).toBe(782); expect(ground.y).toBe(782);
  });
  it("reflows a floor snack around controls while retaining intended x for viewport regrowth", () => {
    const left: Platform = { id: "viewport-floor-food", x: 24, y: 430, width: 136, kind: "floor" };
    const right: Platform = { ...left, id: "viewport-floor-food-1", x: 240, width: 136 };
    const small = { width: 400, height: 500 }, food = Object.freeze({ ...apple, x: 900, y: 782 });
    expect(followCompanionViewportFloorFood(food, 900, [left, right], small)).toEqual({ ...food, x: 376, y: 430, platformId: right.id });
    const inGap = followCompanionViewportFloorFood(food, 200, [right, left], small)!;
    expect(inGap.x).toBe(160); expect(inGap.y).toBe(430);
    const grown = followCompanionViewportFloorFood(inGap, 900, [{ ...floor, id: left.id }], viewport)!;
    expect(grown.x).toBe(900); expect(grown.y).toBe(782); expect(food.x).toBe(900);
  });
  it("does not manufacture a viewport attachment from another floor family, malformed geometry or a stale short viewport", () => {
    for (const id of [undefined, "floor", "viewport-floor", "viewport-floor-food-old", "viewport-floor-food-1-extra", COMPANION_HOME_FLOOR_FOOD]) expect(isCompanionViewportFloorFoodSupport(id)).toBe(false);
    for (const id of ["viewport-floor-food", "viewport-floor-food-12"]) expect(isCompanionViewportFloorFoodSupport(id)).toBe(true);
    const ground: Platform = { ...floor, id: "viewport-floor-food" };
    for (const candidates of [[], [card], [{ ...ground, id: COMPANION_HOME_FLOOR_FOOD }], [{ ...ground, y: 130 }], [{ ...ground, y: 1182 }], [{ ...ground, x: 980 }], [{ ...ground, kind: "card" as const }], [{ ...ground, width: -1 }], [{ ...ground, x: NaN }]]) expect(followCompanionViewportFloorFood(apple, 500, candidates, viewport)).toBeUndefined();
    expect(followCompanionViewportFloorFood(apple, NaN, [ground], viewport)).toBeUndefined();
    expect(followCompanionViewportFloorFood(apple, 500, [ground], { width: 20, height: 800 })).toBeUndefined();
  });
  const roomFloor = { left: 100, top: 600, width: 300, height: 36 };
  it("settles a real floor release on the room's physical plane independently of its bed", () => {
    expect(receiveCompanionHomeFloorFood({ x: 220, y: 624 }, { x: 220, y: 608 }, roomFloor, [])).toEqual({ x: 220, y: 630 });
    expect(receiveCompanionHomeFloorFood({ x: 110, y: 632 }, { x: 110, y: 616 }, roomFloor, [])).toEqual({ x: 122, y: 630 });
    expect(receiveCompanionHomeFloorFood({ x: 220, y: 624 }, { x: 220, y: 599 }, roomFloor, [])).toBeUndefined();
    expect(receiveCompanionHomeFloorFood({ x: 900, y: 624 }, { x: 220, y: 608 }, roomFloor, [])).toBeUndefined();
  });
  it("keeps the entire44x44 floor input away from actual controls without distant relocation", () => {
    const feeder = { left: 280, top: 574, width: 48, height: 54 };
    expect(receiveCompanionHomeFloorFood({ x: 265, y: 630 }, { x: 265, y: 614 }, roomFloor, [feeder])).toEqual({ x: 258, y: 630 });
    expect(receiveCompanionHomeFloorFood({ x: 305, y: 630 }, { x: 305, y: 614 }, roomFloor, [feeder])).toBeUndefined();
    expect(receiveCompanionHomeFloorFood({ x: 220, y: 630 }, { x: 220, y: 614 }, { ...roomFloor, width: 40 }, [])).toBeUndefined();
    expect(receiveCompanionHomeFloorFood({ x: 220, y: 630 }, { x: 220, y: 614 }, roomFloor, [{ ...roomFloor, width: 300, height: 36 }])).toBeUndefined();
  });
  it("carries a floor attachment across side/scroll/remount without settling it again", () => {
    const placed = receiveCompanionHomeFloorFood({ x: 220, y: 624 }, { x: 220, y: 608 }, roomFloor, [])!;
    const attached = attachCompanionFood(placed, { x: 0, y: 100 }, { x: roomFloor.left, y: roomFloor.top });
    const moved = followCompanionFood(attached, { x: 0, y: 300 }, { ...roomFloor, left: 700, top: 400 }, "floor");
    expect(moved.point).toEqual({ x: 820, y: 430 });
    expect(followCompanionFood(moved.attachment, { x: 0, y: 0 }, roomFloor, "floor").point).toEqual({ x: 220, y: 630 });
  });
  it("uses the current floor plane and control bounds after a zoomed house remounts into its compact portal", () => {
    // The studio's36px room floor measures32.390625px under shell zoom;
    // its compact body portal measures36px. A local y from the first room
    // would otherwise leave this snack3.609375px above its new floor.
    const zoomed = { ...roomFloor, height: 32.390625 };
    const placed = receiveCompanionHomeFloorFood({ x: 250, y: 624 }, { x: 250, y: 608 }, zoomed, [])!;
    expect(placed).toEqual({ x: 250, y: 626.390625 });
    const attached = attachCompanionFood(placed, { x: 0, y: 100 }, { x: zoomed.left, y: zoomed.top });
    const compact = { ...roomFloor, left: 700, top: 500 };
    const moved = followCompanionFood(attached, { x: 0, y: 300 }, compact, "floor");
    expect(receiveCompanionHomeFloorFood(moved.point, { x: moved.point.x, y: 534 }, compact, [], true)).toEqual({ x: 850, y: 530 });
    // This control intersects only the new foot plane, so a stale y would
    // also put the full44px native snack input over the control.
    const control = { left: 830, top: 534, width: 40, height: 20 };
    const safe = receiveCompanionHomeFloorFood(moved.point, { x: moved.point.x, y: 534 }, compact, [control], true)!;
    expect(safe).toEqual({ x: 808, y: 530 });
    const retained = { ...moved.attachment, documentX: safe.x, documentY: safe.y + 300 };
    expect(retained).toMatchObject({ offsetX: 150, offsetY: 26.390625 });
    const returned = followCompanionFood(retained, { x: 0, y: 0 }, zoomed, "floor");
    expect(receiveCompanionHomeFloorFood(returned.point, { x: returned.point.x, y: 630 }, zoomed, [], true)).toEqual(placed);
    expect(attached).toMatchObject({ offsetX: 150, offsetY: 26.390625 });
  });
  it("reflows floor food around shifted controls and restores its intended local x on regrowth", () => {
    const original = { x: 250, y: 630 }, attachment = attachCompanionFood(original, { x: 0, y: 0 }, { x: roomFloor.left, y: roomFloor.top });
    const narrow = { ...roomFloor, width: 220 }, feeder = { left: 200, top: 574, width: 118, height: 54 };
    const followed = followCompanionFood(attachment, { x: 0, y: 0 }, narrow, "floor");
    expect(receiveCompanionHomeFloorFood(followed.point, { x: followed.point.x, y: 634 }, narrow, [feeder])).toBeUndefined();
    const safe = receiveCompanionHomeFloorFood(followed.point, { x: followed.point.x, y: 634 }, narrow, [feeder], true)!;
    expect(safe).toEqual({ x: 178, y: 630 });
    const retained = { ...followed.attachment, documentX: safe.x, documentY: safe.y };
    expect(retained.offsetX).toBe(150);
    const grown = followCompanionFood(retained, { x: 0, y: 0 }, roomFloor, "floor");
    expect(receiveCompanionHomeFloorFood(grown.point, { x: grown.point.x, y: 634 }, roomFloor, [{ ...feeder, left: 280 }], true)).toEqual(original);
  });
  it("validates the actual floor recipient without accepting malformed or distant releases", () => {
    for (const invalid of [{ ...roomFloor, width: 0 }, { ...roomFloor, height: -1 }, { ...roomFloor, left: NaN }, { ...roomFloor, top: Infinity }]) {
      expect(receiveCompanionHomeFloorFood({ x: 220, y: 624 }, { x: 220, y: 608 }, invalid, [])).toBeUndefined();
    }
    expect(receiveCompanionHomeFloorFood({ x: NaN, y: 624 }, { x: 220, y: 608 }, roomFloor, [])).toBeUndefined();
    expect(receiveCompanionHomeFloorFood({ x: 220, y: 624 }, { x: 401, y: 608 }, roomFloor, [])).toBeUndefined();
    expect(receiveCompanionHomeFloorFood({ x: 220, y: 637 }, { x: 220, y: 635 }, roomFloor, [])).toEqual({ x: 220, y: 630 });
  });
  it("keeps floor food inside its remounted source while retaining the intended local x for regrowth", () => {
    const attached = attachCompanionFood({ x: 398, y: 630 }, { x: 0, y: 0 }, { x: roomFloor.left, y: roomFloor.top });
    const smaller = followCompanionFood(attached, { x: 0, y: 0 }, { left: 700, top: 300, width: 100, height: 36 }, "floor");
    expect(smaller.point).toEqual({ x: 800, y: 330 });
    expect(smaller.attachment).toMatchObject({ offsetX: 298, offsetY: 30 });
    expect(followCompanionFood(smaller.attachment, { x: 0, y: 0 }, roomFloor, "floor").point).toEqual({ x: 398, y: 630 });
  });
  it("keeps a home tray outside its tiny dispenser origin without the glyph reflow clamp", () => {
    const attached = attachCompanionFood({ x: 460, y: 509 }, { x: 0, y: 0 }, { x: 500, y: 500 });
    const moved = followCompanionFood(attached, { x: 0, y: 100 }, { left: 200, top: 350, width: 18, height: 5 }, false);
    expect(moved.point).toEqual({ x: 160, y: 359 });
    expect(moved.attachment.offsetX).toBe(-40); expect(moved.attachment.offsetY).toBe(9);
    // The same local origin can bind a remounted home after a fold/portal move.
    expect(followCompanionFood(moved.attachment, { x: 0, y: 0 }, { left: 700, top: 500, width: 24, height: 5 }, false).point).toEqual({ x: 660, y: 509 });
    // Ordinary text attachment keeps its existing height-clamp contract.
    expect(followCompanionFood(attached, { x: 0, y: 0 }, { left: 500, top: 500, width: 18, height: 5 }).point.y).toBe(502);
  });
  it("keeps a document point through scrolling and restores it at the original place", () => {
    const attached = attachCompanionFood({ x: 200, y: 350 }, { x: 0, y: 200 });
    const away = followCompanionFood(attached, { x: 40, y: 900 });
    expect(away.point).toEqual({ x: 160, y: -350 });
    expect(followCompanionFood(away.attachment, { x: 0, y: 200 }).point).toEqual({ x: 200, y: 350 });
    expect(away.attachment.documentY).toBe(550);
  });
  it("follows the same DOM origin even outside the viewport and across nested scrolling", () => {
    const attached = attachCompanionFood({ x: 180, y: 347 }, { x: 0, y: 200 }, { x: 100, y: 350 });
    const away = followCompanionFood(attached, { x: 0, y: 900 }, { left: 90, top: -350, width: 200, height: 30 });
    expect(away.point).toEqual({ x: 170, y: -353 });
    const returned = followCompanionFood(away.attachment, { x: 0, y: 200 }, { left: 100, top: 350, width: 200, height: 30 });
    expect(returned.point).toEqual({ x: 180, y: 347 });
    // A nested scroller changes only the actual origin, not window.scrollY.
    expect(followCompanionFood(returned.attachment, { x: 0, y: 200 }, { left: 100, top: 310 }).point.y).toBe(307);
  });
  it("uses the same source during reflow, and detachment keeps the last document point", () => {
    const attached = attachCompanionFood({ x: 280, y: 380 }, { x: 0, y: 100 }, { x: 100, y: 350 });
    const narrowed = followCompanionFood(attached, { x: 0, y: 100 }, { left: 80, top: 400, width: 90, height: 20 });
    expect(narrowed.point).toEqual({ x: 170, y: 417 });
    // Restore original local offsets when that same source grows again.
    expect(followCompanionFood(narrowed.attachment, { x: 0, y: 100 }, { left: 100, top: 350, width: 250, height: 40 }).point).toEqual({ x: 280, y: 380 });
    expect(followCompanionFood(narrowed.attachment, { x: 0, y: 300 }).point).toEqual({ x: 170, y: 217 });
  });
});

describe("companion food presentation", () => {
  it("keeps food play as a bounded cosmetic arc with a stronger finite toss option", () => {
    expect(companionFoodJostle(0, 38, -1)).toEqual({ height: 24, duration: 420, rotation: -6 });
    expect(companionFoodJostle(0, 38, 1, 2.5)).toEqual({ height: 60, duration: 650, rotation: 6 });
    expect(companionFoodJostle(38, 38, 1)).toEqual({ height: 12, duration: 420, rotation: 6 });
    expect(companionFoodJostle(0, 38, 1, 99)?.height).toBe(72);
    for (const strength of [-1, NaN, Infinity]) expect(companionFoodJostle(0, 38, 1, strength)?.height).toBe(24);
    for (const [distance, radius] of [[NaN, 38], [0, 0], [39, 38], [-1, 38]]) expect(companionFoodJostle(distance, radius, 1)).toBeUndefined();
  });
  const mouth = { x: 420, y: 260 };
  it("lifts the presentation to the mouth without moving its logical support", () => {
    const food = Object.freeze({ ...apple, platformId: "card" });
    expect(presentCompanionFood(food, 0, mouth)).toEqual({ x: 200, y: 340, scale: 1, rotation: 0 });
    const halfway = presentCompanionFood(food, .12, mouth);
    expect(halfway.x).toBeGreaterThan(food.x);
    expect(halfway.x).toBeLessThan(mouth.x);
    expect(halfway.y).toBeLessThan((food.y + mouth.y + 16) / 2);
    const arrived = presentCompanionFood(food, .24, mouth);
    expect(arrived.x).toBe(424); expect(arrived.y).toBeCloseTo(276);
    expect(food).toEqual({ ...apple, platformId: "card" });
  });
  it("chews and shrinks after arrival while keeping the fruit inside the mouth area", () => {
    const poses = Array.from({ length: 77 }, (_, i) => presentCompanionFood(apple, .24 + i / 100, mouth));
    expect(new Set(poses.map(pose => pose.rotation.toFixed(2))).size).toBeGreaterThan(20);
    expect(poses.every(pose => pose.x >= mouth.x && pose.x <= mouth.x + 4 && Math.abs(pose.y - 276) <= .801)).toBe(true);
    expect(poses.at(-1)!.x).toBe(mouth.x);
    for (let i = 1; i < poses.length; i++) expect(poses[i].x).toBeLessThanOrEqual(poses[i - 1].x);
    expect(poses.at(-1)!.scale).toBe(0);
    expect(poses.every(pose => pose.scale >= 0 && pose.scale <= 1.02)).toBe(true);
    expect(presentCompanionFood(apple, .95, mouth).scale).toBeLessThan(.1);
  });
  it("mirrors the small approach offset, freezes reduced motion, and safely clamps bad progress", () => {
    expect(presentCompanionFood(apple, .24, mouth, -1).x).toBe(416);
    expect(presentCompanionFood(apple, .7, mouth, -1, true)).toEqual({ x: 416, y: 276, scale: 1, rotation: 0 });
    expect(presentCompanionFood(apple, NaN, mouth)).toEqual(presentCompanionFood(apple, 0, mouth));
    expect(presentCompanionFood(apple, -8, mouth)).toEqual(presentCompanionFood(apple, 0, mouth));
    expect(presentCompanionFood(apple, 8, mouth)).toEqual(presentCompanionFood(apple, 1, mouth));
    expect(presentCompanionFood(apple, 1, { x: NaN, y: 3 })).toEqual({ x: apple.x, y: apple.y, scale: .28, rotation: 0 });
    expect(presentCompanionFood(apple, .5).scale).toBeCloseTo(.64);
  });
  it("requires a deliberate trash dwell, with a separate finite discard", () => {
    expect(COMPANION_TRASH_DWELL_MS).toBe(320); expect(COMPANION_TRASH_DISCARD_MS).toBe(180);
    expect(companionTrashProgress(-1)).toBe(0); expect(companionTrashProgress(NaN)).toBe(0);
    expect(companionTrashProgress(160)).toBe(.5); expect(companionTrashProgress(319)).toBeLessThan(1);
    expect(companionTrashProgress(320)).toBe(1); expect(companionTrashProgress(900)).toBe(1);
  });
});

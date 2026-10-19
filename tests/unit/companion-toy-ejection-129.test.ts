import { describe, expect, it } from "vitest";
import { platformLandingX, type Platform } from "@/lib/ui/viewer-companion/brain";
import { accessibleCompanionToys, createCompanionToys } from "@/lib/ui/viewer-companion/toys";

type Model = ReturnType<typeof createCompanionToys>;
const bounds = { width: 1920, height: 1100 };
const viewport: Platform = { id: "viewport-floor", x: 12, y: 1030, width: 1896, kind: "floor" };
// 128 native .9 room: actual opening/floor and feeder's protected left edge.
// The old -120 arc could reach only x122.987..127.852 body centres. The actual
// 44px floor still has centres through143.8125, within the unchanged pick48.
const body: Platform = { id: "companion-home-floor", x: 50, y: 491.859375, width: 89.8525, kind: "floor", manualOnly: true };
const small: Platform = { id: "companion-home-floor-food", x: 41, y: body.y, width: 111.8125, kind: "floor", manualOnly: true };
const opening = { x: 281.609375, y: 397.578125, platformId: small.id };
function finish(model: Model, start = 0, cadence = 71) {
  for (let at = start + cadence; at < start + 1800; at += cadence) model.tick(at);
  model.tick(start + 1800);
}
function minimumSeparation(xs: readonly number[]) {
  const ordered = [...xs].sort((a, b) => a - b);
  return Math.min(...ordered.slice(1).map((x, i) => x - ordered[i]));
}

describe("129 real toy source, reachable packing and finite recovery", () => {
  it("reserves the real compact1440 mixed batch's free midpoint after a coherent floor follow", () => {
    // Native129: toy4 fell to viewport x425.366 when only the small tier had
    // followed the floor. Geometry must publish its same-source body sibling
    // too; with that real packet, neither48 nor260 needs a relaxed boundary.
    const compactBody = { ...body, x: 77, y: 306, width: 142.04 }, compactSmall = { ...small, x: 99, y: 306, width: 238 };
    const model = createCompanionToys(() => 0), source = { x: 306, y: 207.21875, platformId: small.id };
    const compactBounds = { width: 1440, height: 1100 };
    model.sync([viewport, compactBody], compactBounds, 0, [compactSmall]);
    for (const x of [188.109, 108.292, 166.109]) {
      const id = model.spawn(source, 0)!;
      expect(model.grab(id)).toBe(true); expect(model.drag(id, { x, y: 306 })).toBe(true);
      expect(model.drop(id, 0)).toBe(true); model.tick(16);
    }
    const foods = [232.109, 144.109, 210.109, 243.04].map(x => ({ x, y: 306 }));
    model.sync([viewport, compactBody], compactBounds, 1000, [compactSmall]);
    const fourth = model.spawn(source, 1000, foods)!;
    expect(model.items().find(toy => toy.id === fourth)).toMatchObject({ x: source.x, y: source.y, platformId: undefined });
    expect(model.occupied().at(-1)!.x).toBeCloseTo(126.2005, 8); expect(model.occupied().at(-1)!.y).toBe(306);
    model.tick(2000);
    const actual = model.available(); expect(actual).toHaveLength(4);
    expect(actual.every(toy => toy.platformId === compactSmall.id && toy.y === 306)).toBe(true);
    const toy = accessibleCompanionToys(actual, [compactBody]).find(item => item.id === fourth)!;
    expect(toy.x).toBeCloseTo(126.2005, 8); expect(model.pick(fourth, toy.stance!)).toBe(true);
  });

  it.each([16, 71, 1100])("uses the real narrow room's free width and pick48 at %ims host cadence", cadence => {
    const model = createCompanionToys(() => 0); model.sync([viewport, body], bounds, 0, [small]);
    const ids = Array.from({ length: 4 }, () => model.spawn(opening, 0)!);
    expect(model.spawn(opening, 0)).toBeUndefined();
    expect(model.items().map(toy => [toy.x, toy.y])).toEqual(ids.map(() => [opening.x, opening.y]));
    model.tick(50);
    const velocities = model.items().map(toy => ({ x: (toy.x - opening.x) / .05, y: (toy.y - opening.y - 450 * .05 ** 2) / .05 }));
    expect(velocities.every(v => Math.abs(v.x) <= 260 + 1e-6 && v.y >= -220 - 1e-6 && v.y <= 140 + 1e-6)).toBe(true);
    expect(velocities.some(v => v.y < -120 - 1e-6)).toBe(true);
    finish(model, 50, cadence);
    const toys = model.available(), xs = toys.map(toy => toy.x);
    expect(toys).toHaveLength(4);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(55);
    expect(minimumSeparation(xs)).toBeGreaterThan(14);
    // Four44px targets cannot be disjoint in this ~61px reachable band. Test
    // real separation and pickup instead of treating distinct subpixels as fit.
    const reachable = accessibleCompanionToys(toys, [body]); expect(reachable).toHaveLength(4);
    for (const toy of reachable) {
      expect(toy.platformId).toBe(small.id); expect(toy.y).toBe(body.y);
      expect(toy.x).toBeGreaterThanOrEqual(platformLandingX(small, -Infinity, 9));
      expect(toy.x).toBeLessThanOrEqual(platformLandingX(small, Infinity, 9));
      expect(toy.stance?.platformId).toBe(body.id);
      expect(Math.hypot(toy.x - toy.stance!.x, toy.y - toy.stance!.y)).toBeLessThanOrEqual(48);
      expect(model.pick(toy.id, toy.stance!)).toBe(true); expect(model.stash(toy.id)).toBe(true);
    }
    expect(model.count()).toBe(0);
  });

  it("admits exactly48px of real pickup while rejecting a farther manual placement", () => {
    const model = createCompanionToys(() => 0); model.sync([viewport, body], bounds, 0, [{ ...small, width: 250 }]);
    const id = model.spawn(opening, 0)!; model.grab(id);
    const stance = { x: platformLandingX(body, Infinity), y: body.y, platformId: body.id };
    model.drag(id, { x: stance.x + 48, y: body.y }); model.drop(id, 0); model.tick(16);
    expect(model.pick(id, { ...stance, x: stance.x - .01 })).toBe(false);
    expect(model.pick(id, stance)).toBe(true);
  });

  it("reserves falling toy and food footprints without moving a settled human placement", () => {
    const wideBody = { ...body, x: 50, width: 650, y: 600 }, wideSmall = { ...small, x: 40, width: 680, y: 600 };
    const model = createCompanionToys(() => 0); model.sync([viewport, wideBody], bounds, 0, [wideSmall]);
    const source = { x: 400, y: 400, platformId: small.id }, human = model.spawn(source, 0)!;
    model.grab(human); model.drag(human, { x: 230, y: 600 }); model.drop(human, 0); model.tick(16);
    const placed = model.available()[0]; expect(placed).toMatchObject({ id: human, x: 230, y: 600 });
    const foods = [{ x: 274, y: 600 }, { x: 318, y: 600 }];
    for (let i = 0; i < 3; i++) expect(model.spawn(source, 1000, foods)).toBeTruthy();
    const reservations = model.occupied(); expect(reservations).toHaveLength(4);
    expect(minimumSeparation([...reservations, ...foods].map(item => item.x))).toBeGreaterThanOrEqual(44 - 1e-6);
    finish(model, 1000);
    expect(model.available().find(toy => toy.id === human)).toEqual(placed);
    expect(model.available()).toHaveLength(4);
    expect(minimumSeparation([...model.available(), ...foods].map(item => item.x))).toBeGreaterThanOrEqual(44 - 1e-6);
  });

  it("takes the first actual front-floor contact while a human throw retains a real card edge", () => {
    const upper = { ...small, id: small.id + "-1", x: 0, width: 1000, y: 430 };
    const card: Platform = { id: "card-top", x: 0, y: 420, width: 1000, kind: "card" };
    const model = createCompanionToys(() => 0); model.sync([card, viewport, body], bounds, 0, [small, upper]);
    model.spawn(opening, 0); model.tick(1200);
    expect(model.available()[0]).toMatchObject({ platformId: upper.id, y: upper.y });
    const human = createCompanionToys(() => 0); human.sync([card, viewport, body], bounds, 0, [small, upper]);
    const id = human.spawn(opening, 0)!; human.grab(id); human.drop(id, 0); human.tick(1200);
    expect(human.available()[0]).toMatchObject({ platformId: card.id, y: card.y });
  });

  it.each(["companion-panel-floor", "companion-panel-floor-food-2"])("falls through transparent %s to the actual viewport floor", id => {
    const panel: Platform = { id, x: 0, y: 783.78125, width: 2400, kind: "floor", manualOnly: true };
    const model = createCompanionToys(() => 0); model.sync([panel, viewport], bounds, 0);
    const toyId = model.spawn({ x: 136, y: 686.78125 }, 0)!;
    model.grab(toyId); model.drop(toyId, 0); model.tick(600);
    expect(model.items()[0].y).toBeGreaterThan(panel.y); expect(model.available()).toEqual([]);
    model.tick(900); expect(model.available()[0]).toMatchObject({ platformId: viewport.id, y: viewport.y });
  });

  it("never snaps a timed-out trajectory up to a missed card, and removes an unsupported recovery finitely", () => {
    const card: Platform = { id: "missed-card", x: 500, y: 500, width: 100, kind: "card" };
    const lowViewport = { ...viewport, y: 4500, width: 1000 }, tall = { width: 1000, height: 5000 };
    const model = createCompanionToys(() => 0); model.sync([card, lowViewport], tall, 0);
    const id = model.spawn({ x: 20, y: 100 }, 0)!; model.grab(id); model.drop(id, 0, { x: 260, y: 0 });
    model.tick(2000);
    expect(model.items()[0]).toMatchObject({ x: 540, y: 1900, platformId: undefined });
    expect(model.available()).toEqual([]); expect(model.moving()).toBe(true);
    model.tick(3000); expect(model.items()[0]).toMatchObject({ x: 540, y: 2350, platformId: undefined });
    model.tick(4000); expect(model.items()).toEqual([]); expect(model.moving()).toBe(false);
  });

  it("can complete that finite recovery only on a current-x actual viewport floor below it", () => {
    const card: Platform = { id: "missed-card", x: 500, y: 500, width: 100, kind: "card" };
    const tall = { width: 1000, height: 5000 }, model = createCompanionToys(() => 0);
    model.sync([card, { ...viewport, y: 4500, width: 1000 }], tall, 0);
    const id = model.spawn({ x: 20, y: 100 }, 0)!; model.grab(id); model.drop(id, 0, { x: 260, y: 0 }); model.tick(2000);
    model.sync([card, { ...viewport, y: 2500, width: 1000 }], tall, 2000); model.tick(3200);
    expect(model.available()[0]).toMatchObject({ x: 540, y: 2500, platformId: viewport.id });
  });
});

import { describe, expect, it } from "vitest";
import { platformLandingX, type Platform } from "@/lib/ui/viewer-companion/brain";
import { accessibleCompanionToys, createCompanionToys, findCompanionToyRoute } from "@/lib/ui/viewer-companion/toys";

// Measured native .8 studio case: the 44px landing is valid, but the pet's
// body-safe stance ends before it. A nominal−80 ejection used to settle at
// 248.121, 50.878px beyond the last 197.243px stance and outside pickup 48.
const body: Platform = { id: "companion-home-floor", x: 50, y: 454.578125, width: 159.243, kind: "floor", manualOnly: true };
const small: Platform = { id: "companion-home-floor-food", x: 41, y: body.y, width: 297, kind: "floor", manualOnly: true };
const ground: Platform = { id: "viewport-floor", x: 0, y: 1030, width: 2400, kind: "floor" };
const opening = { x: 328.078125, y: 384.140625, platformId: small.id };
const bounds = { width: 2400, height: 1100 };
const cadences = [[16], [33], [50], [71], [16, 50, 33, 71]].map(cadence => ({ cadence }));
type Model = ReturnType<typeof createCompanionToys>;
function settle(model: Model, cadence: readonly number[]) {
  let at = 0, step = 0;
  while (at < 1800) { at += cadence[step++ % cadence.length]; model.tick(at); }
}

describe("124 chest ejections retain physical pickup reach", () => {
  it.each(cadences)("lands all four real serial ejections within the unchanged pickup radius at cadence $cadence", ({ cadence }) => {
    const model = createCompanionToys(); model.sync([ground, body], bounds, 0, [small]);
    const ids = Array.from({ length: 4 }, () => model.spawn(opening, 0)!);
    expect(model.items().map(toy => [toy.x, toy.y, toy.platformId])).toEqual(ids.map(() => [opening.x, opening.y, undefined]));
    model.tick(50);
    expect(model.items().every(toy => toy.y < opening.y && !toy.platformId)).toBe(true);
    settle(model, cadence);
    const actual = model.available(), available = accessibleCompanionToys(actual, [ground, body]);
    expect(actual).toHaveLength(4); expect(available).toHaveLength(4);
    for (const toy of available) {
      expect(toy.platformId).toBe(small.id); expect(toy.y).toBe(body.y);
      expect(toy.stance?.platformId).toBe(body.id);
      expect(Math.hypot(toy.x - toy.stance!.x, toy.y - toy.stance!.y)).toBeLessThanOrEqual(48);
      const from = { x: 83, y: body.y, platformId: body.id };
      expect(findCompanionToyRoute(from, toy.stance!, [ground, body], true)).not.toBeNull();
      const boxStance = { x: platformLandingX(body, opening.x), y: body.y, platformId: body.id };
      expect(findCompanionToyRoute(toy.stance!, boxStance, [ground, body], true)).not.toBeNull();
      expect(model.pick(toy.id, toy.stance!)).toBe(true);
      expect(model.carry(toy.id, { x: boxStance.x, y: boxStance.y - 30 })).toBe(true);
      expect(model.stash(toy.id)).toBe(true);
    }
    expect(model.count()).toBe(0);
  });

  it("selects another measured small fragment when the hinted fragment has no body-safe overlap", () => {
    const remote = { ...small, x: 280, width: 50 }, near = { ...small, id: small.id + "-1", x: 140, width: 70 };
    const model = createCompanionToys(); model.sync([ground, body], bounds, 0, [remote, near]);
    model.spawn(opening, 0); settle(model, [33, 50]);
    const actual = model.available()[0], available = accessibleCompanionToys([actual], [body]);
    expect(actual.platformId).toBe(near.id); expect(available).toHaveLength(1);
    expect(model.pick(actual.id, available[0].stance!)).toBe(true);
  });

  it("126 emits in front of the sofa and calendar while a human throw still hits their real ledge", () => {
    const upper: Platform = { id: "card-1-top", x: 0, y: 420, width: 1000, kind: "card" };
    const seat: Platform = { id: "companion-home", x: 0, y: 440, width: 1000, kind: "date" };
    const model = createCompanionToys(); model.sync([upper, seat, ground, body], bounds, 0, [small]);
    model.spawn(opening, 0); settle(model, [50]);
    expect(model.available()[0]).toMatchObject({ platformId: small.id, y: small.y });
    const human = createCompanionToys(); human.sync([upper, seat, ground, body], bounds, 0, [small]);
    const id = human.spawn(opening, 0)!; expect(human.grab(id)).toBe(true);
    expect(human.drag(id, { x: 300, y: 380 })).toBe(true); expect(human.drop(id, 0)).toBe(true);
    settle(human, [50]); expect(human.available()[0]).toMatchObject({ platformId: upper.id, y: upper.y });
  });

  it("does not redirect manual throws toward the chest's landing target", () => {
    const model = createCompanionToys(); model.sync([ground, body], bounds, 0, [small]);
    const id = model.spawn(opening, 0)!;
    expect(model.grab(id)).toBe(true); expect(model.drag(id, { x: 600, y: 300 })).toBe(true);
    expect(model.drop(id, 100, { x: 200, y: -100 })).toBe(true);
    model.tick(200);
    expect(model.items()[0]).toMatchObject({ x: 620, y: 294.5, platformId: undefined });
    expect(model.pick(id, model.items()[0])).toBe(false);
  });

  it("preserves finite physical fallback when no body-safe room support is available", () => {
    const model = createCompanionToys(); model.sync([ground], bounds, 0, [small]);
    model.spawn(opening, 0); expect(model.items()[0]).toMatchObject({ x: opening.x, y: opening.y, platformId: undefined });
    settle(model, [33]);
    const actual = model.available(); expect(actual).toHaveLength(1); expect(actual[0].platformId).toBe(small.id);
    expect(accessibleCompanionToys(actual, [ground])).toEqual([]); expect(model.moving()).toBe(false);
  });
});

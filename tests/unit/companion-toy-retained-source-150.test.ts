import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionToys, type CompanionToyAttachment } from "@/lib/ui/viewer-companion/toys";

const bounds = { width: 1000, height: 800 };
const floor: Platform = { id: "companion-home-floor-food", x: 100, y: 500, width: 240, kind: "floor" };
const screen: Platform = { id: "viewport-floor", x: 0, y: 780, width: 1000, kind: "floor" };
function resting() {
  const world = createCompanionToys(() => 0);
  world.sync([floor, screen], bounds, 0);
  const id = world.spawn({ x: 220, y: 400, platformId: floor.id }, 0)!;
  world.tick(2000);
  expect(world.available()[0]).toMatchObject({ id, y: floor.y, platformId: floor.id });
  return { world, id, toy: world.items()[0] };
}

describe("150 an existing toy keeps its real source through clipped scroll snapshots", () => {
  it.each([false, true])("retains the same object outside the safe landing list while paused=%s", paused => {
    const { world, id, toy } = resting();
    if (paused) world.pause(2000);
    world.sync([screen], bounds, 2100, [], [{ id, platformId: floor.id, x: toy.x + 20, y: -30 }]);
    world.tick(2900);
    expect(world.items()[0]).toMatchObject({ id, platformId: floor.id, x: toy.x + 20, y: -30 });
    expect(world.moving()).toBe(false);
    world.sync([floor, screen], bounds, 3000);
    expect(world.items()[0]).toMatchObject({ id, platformId: floor.id, y: 500 });
    expect(world.moving()).toBe(false);
  });
  it("hides a folded source without turning that temporary absence into gravity", () => {
    const { world, id, toy } = resting();
    world.sync([screen], bounds, 2100, [], [{ id, platformId: floor.id, x: toy.x, y: toy.y, hidden: true }]);
    expect(world.items()[0]).toMatchObject({ id, hidden: true, platformId: floor.id });
    expect(world.available()).toEqual([]); expect(world.moving()).toBe(false);
    world.sync([floor, screen], bounds, 3000);
    expect(world.items()[0]).toMatchObject({ id, hidden: false, platformId: floor.id });
  });
  it.each(["missing", "wrong-object", "wrong-source", "invalid"])("keeps normal recovery when the proof is %s", condition => {
    const { world, id, toy } = resting();
    const proof: CompanionToyAttachment = { id: condition === "wrong-object" ? "other" : id, platformId: condition === "wrong-source" ? "other" : floor.id, x: toy.x, y: condition === "invalid" ? NaN : -30 };
    world.sync([screen], bounds, 2100, [], condition === "missing" ? [] : [proof]);
    expect(world.items()[0].platformId).toBeUndefined(); expect(world.moving()).toBe(true);
  });
  it("never turns a retained source into a flight landing for another toy", () => {
    const { world, id, toy } = resting();
    const other = world.spawn({ x: 600, y: 300 }, 2000)!;
    world.sync([screen], bounds, 2010, [], [{ id, platformId: floor.id, x: toy.x, y: 500 }]);
    world.tick(4000);
    expect(world.items().find(item => item.id === other)).toMatchObject({ platformId: screen.id, y: screen.y });
    expect(world.items().find(item => item.id === id)).toMatchObject({ platformId: floor.id, y: floor.y });
  });
  it("cannot attach a held or carried toy to its former floor", () => {
    for (const carried of [false, true]) {
      const { world, id, toy } = resting();
      expect(carried ? world.pick(id, toy) : world.grab(id)).toBe(true);
      world.sync([screen], bounds, 2100, [], [{ id, platformId: floor.id, x: toy.x + 100, y: -30 }]);
      expect(world.items()[0]).toMatchObject({ id, x: toy.x, y: toy.y, held: !carried, carried });
      expect(world.items()[0].platformId).toBeUndefined();
    }
  });
});

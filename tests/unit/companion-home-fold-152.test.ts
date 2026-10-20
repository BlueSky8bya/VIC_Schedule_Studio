import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionToys } from "@/lib/ui/viewer-companion/toys";

const room: Platform = { id: "companion-home-floor-food", x: 100, y: 500, width: 240, kind: "floor" };
const screen: Platform = { id: "viewport-floor", x: 0, y: 780, width: 1000, kind: "floor" };
const bounds = { width: 1000, height: 800 };
const make = () => { const world = createCompanionToys(() => 0); world.sync([room, screen], bounds, 0); return world; };
describe("152 folding a house while a real toy is still being dispensed", () => {
  it("keeps the same object at the exact home contact its ordinary arc would reach", () => {
    const normal = make(), folded = make(), point = { x: 220, y: 400, platformId: room.id };
    normal.spawn(point, 0); folded.spawn(point, 0); normal.tick(2000);
    expect(folded.settleHomeEmissions()).toBe(1);
    expect(folded.items()).toEqual(normal.items()); expect(folded.moving()).toBe(false);
    expect(folded.settleHomeEmissions()).toBe(0);
  });
  it("does not settle a human throw or steal an active pointer hold", () => {
    const world = make(), emitted = world.spawn({ x: 220, y: 400, platformId: room.id }, 0)!;
    const outside = world.spawn({ x: 700, y: 200 }, 0)!, held = world.spawn({ x: 600, y: 150 }, 0)!;
    world.grab(held); const before = world.items().filter(item => item.id !== emitted);
    expect(world.settleHomeEmissions()).toBe(1);
    expect(world.items().filter(item => item.id !== emitted)).toEqual(before);
    expect(world.items().find(item => item.id === outside)?.platformId).toBeUndefined();
    expect(world.items().find(item => item.id === held)?.held).toBe(true);
  });
  it("retains the landing through folded geometry without unpausing the world", () => {
    const world = make(), id = world.spawn({ x: 220, y: 400, platformId: room.id }, 0)!;
    world.pause(100); world.settleHomeEmissions(); const toy = world.items()[0];
    world.sync([screen], bounds, 1000, [], [{ id, platformId: room.id, x: toy.x, y: toy.y, hidden: true }]);
    world.tick(4000); expect(world.items()[0]).toMatchObject({ id, x: toy.x, y: toy.y, hidden: true });
    expect(world.available()).toEqual([]); world.sync([room, screen], bounds, 5000);
    expect(world.items()[0]).toMatchObject({ id, x: toy.x, y: toy.y, platformId: room.id, hidden: false });
    expect(world.spawn({ x: 600, y: 100 }, 6000)).toBeUndefined();
  });
  it("never invents a home contact for a missing or incorrect source hint", () => {
    const world = createCompanionToys(() => 0); world.sync([screen], bounds, 0);
    world.spawn({ x: 220, y: 400, platformId: room.id }, 0);
    const before = world.items(); expect(world.settleHomeEmissions()).toBe(0); expect(world.items()).toEqual(before);
  });
});

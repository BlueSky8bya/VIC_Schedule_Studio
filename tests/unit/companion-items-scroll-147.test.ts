import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionToys } from "@/lib/ui/viewer-companion/toys";

describe("147 resting objects follow a real floor independently of paused physics", () => {
  const floor: Platform = { id: "companion-home-floor-food", x: 100, y: 500, width: 240, kind: "floor" };
  const bounds = { width: 1000, height: 800 };
  it("moves a resting toy with its same floor while its flight clock stays paused", () => {
    const world = createCompanionToys(() => 0);
    const viewportFloor: Platform = { id: "viewport-floor", x: 0, width: 1000, y: 780, kind: "floor" };
    world.sync([floor, viewportFloor], bounds, 0);
    const resting = world.spawn({ x: 220, y: 400, platformId: floor.id }, 0)!;
    world.tick(2000);
    expect(world.items().find(toy => toy.id === resting)).toMatchObject({ y: 500, platformId: floor.id });
    const falling = world.spawn({ x: 600, y: 400 }, 2000)!;
    world.tick(2060); world.pause(2060);
    const flyingPoint = { ...world.items().find(toy => toy.id === falling)! };
    const point = { ...world.items().find(toy => toy.id === resting)! };
    world.sync([{ ...floor, x: 140, y: 370 }, viewportFloor], bounds, 9000);
    expect(world.items().find(toy => toy.id === resting)).toMatchObject({ x: point.x + 40, y: 370, platformId: floor.id });
    // A free throw has no scrolling source; neither its viewport position
    // nor gravity age can advance merely because a window scrolled.
    const rebasedFlight = world.items().find(toy => toy.id === falling)!;
    world.tick(20000);
    expect(world.items().find(toy => toy.id === falling)).toEqual(rebasedFlight);
    expect(rebasedFlight).toEqual(flyingPoint);
    world.resume(20000); world.tick(22000);
    expect(world.items().find(toy => toy.id === falling)).toMatchObject({ platformId: viewportFloor.id, y: 780 });
  });
  it("does not translate the viewport floor with document scrolling", () => {
    const world = createCompanionToys(() => 0), viewportFloor = { ...floor, id: "viewport-floor", x: 0, width: 1000, y: 780 };
    world.sync([floor, viewportFloor], bounds, 0);
    const id = world.spawn({ x: 500, y: 650 }, 0)!;
    world.tick(2500); const before = world.items().find(toy => toy.id === id)!;
    expect(before.platformId).toBe(viewportFloor.id);
    world.sync([{ ...floor, y: 200 }, viewportFloor], bounds, 2600);
    expect(world.items().find(toy => toy.id === id)).toEqual(before);
  });
});

import { describe, expect, it } from "vitest";
import { createCompanionToys } from "@/lib/ui/viewer-companion/toys";
import type { Platform } from "@/lib/ui/viewer-companion/brain";

const panel: Platform = { id: "companion-panel-floor", x: 100, y: 400, width: 300, kind: "floor", manualOnly: true };
const ground: Platform = { id: "viewport-floor", x: 0, y: 650, width: 1400, kind: "floor" };
function settledPanelToy() {
  const world = createCompanionToys(); world.sync([panel, ground], { width: 1400, height: 700 }, 0);
  const id = world.spawn({ x: 280, y: 380 }, 0)!;
  world.tick(700); expect(world.items()[0].platformId).toBe(panel.id);
  return { world, id, prior: world.items()[0] };
}
describe("toy native panel lifecycle", () => {
  it("retains the same fractional position during a side-remount gap", () => {
    const { world, id, prior } = settledPanelToy();
    world.sync([ground], { width: 1400, height: 700 }, 800);
    expect(world.items()[0]).toMatchObject({ id, hidden: true, platformId: panel.id });
    expect(world.available()).toEqual([]); expect(world.grab(id)).toBe(false); expect(world.pick(id, prior)).toBe(false);
    const moved = { ...panel, x: 950, y: 420, width: 360 };
    world.sync([moved, ground], { width: 1400, height: 700 }, 1100);
    const restored = world.items()[0];
    expect(restored.hidden).toBe(false); expect(restored.platformId).toBe(panel.id);
    expect(restored.x).toBeCloseTo(moved.x + moved.width * prior.fraction!, 6); expect(restored.y).toBe(420);
  });
  it("an actually removed panel expires once into finite gravity onto a current support", () => {
    const { world } = settledPanelToy();
    world.sync([ground], { width: 1400, height: 700 }, 800); world.tick(2200);
    expect(world.items()[0].hidden).toBe(true);
    world.tick(2300); expect(world.items()[0].hidden).toBe(false);
    world.tick(3300); expect(world.items()[0].platformId).toBe(ground.id); expect(world.moving()).toBe(false);
  });
  it("hidden time does not consume a missing-panel recovery lease", () => {
    const { world } = settledPanelToy();
    world.sync([ground], { width: 1400, height: 700 }, 800); world.pause(900);
    world.tick(60_000); expect(world.items()[0].hidden).toBe(true);
    world.resume(60_000); world.tick(60_500); expect(world.items()[0].hidden).toBe(true);
    world.sync([panel, ground], { width: 1400, height: 700 }, 60_600);
    expect(world.items()[0].platformId).toBe(panel.id); expect(world.items()[0].hidden).toBe(false);
  });
});

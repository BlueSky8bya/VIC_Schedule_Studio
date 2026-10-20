import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionToys } from "@/lib/ui/viewer-companion/toys";

const bounds = { width: 1000, height: 800 };
const screen: Platform = { id: "viewport-floor", x: 0, y: 780, width: 1000, kind: "floor" };
describe("151 calendar toys use the current followed support before the cached landing twin", () => {
  it.each(["date", "card", "floor"] as const)("does not pin a toy on %s to the old full-scan position", kind => {
    const initial: Platform = { id: "same-physical-edge", kind, x: 100, y: 350, width: 300 };
    const world = createCompanionToys(() => 0);
    world.sync([initial, screen], bounds, 0);
    const id = world.spawn({ x: 260, y: 240 }, 0)!; world.tick(2000);
    const before = world.items()[0]; expect(before.platformId).toBe(initial.id);
    for (const delta of [-90, -35, 45, -60, 0]) {
      const followed = { ...initial, x: initial.x + delta / 3, y: initial.y + delta };
      // The host's ordinary followed list precedes its cached manual landing
      // list. Geometry.anchor uses that same current followed origin.
      world.sync([followed, screen, initial], bounds, 2100);
      expect(world.items()[0]).toMatchObject({ id, platformId: initial.id, y: followed.y });
      expect(world.items()[0].x).toBeCloseTo(before.x + delta / 3, 8);
      expect(world.moving()).toBe(false);
    }
  });
  it("keeps that precedence while paused and preserves the actual source fraction", () => {
    const initial: Platform = { id: "same-edge", kind: "card", x: 100, y: 350, width: 300 };
    const world = createCompanionToys(() => 0); world.sync([initial, screen], bounds, 0);
    world.spawn({ x: 260, y: 240 }, 0); world.tick(2000); world.pause(2000);
    const before = world.items()[0], followed = { ...initial, x: 140, y: 260, width: 240 };
    world.sync([followed, screen, initial], bounds, 3000);
    const after = world.items()[0]; expect(after.y).toBe(followed.y); expect(after.fraction).toBeCloseTo(before.fraction!);
    expect(after.x).toBeCloseTo(followed.x + followed.width * before.fraction!); expect(world.moving()).toBe(false);
  });
  it("still accepts the later valid support when the first candidate is invalid", () => {
    const valid: Platform = { id: "same-edge", kind: "card", x: 100, y: 350, width: 300 };
    const world = createCompanionToys(() => 0); world.sync([{ ...valid, y: NaN }, valid, screen], bounds, 0);
    world.spawn({ x: 260, y: 240 }, 0); world.tick(2000);
    expect(world.items()[0]).toMatchObject({ platformId: valid.id, y: valid.y });
  });
});

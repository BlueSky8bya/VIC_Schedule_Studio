import { describe, expect, it } from "vitest";
import { createCompanionToys } from "@/lib/ui/viewer-companion/toys";
import type { Platform } from "@/lib/ui/viewer-companion/brain";

const panel: Platform = { id: "companion-panel-floor", x: 100, y: 400, width: 300, kind: "floor", manualOnly: true };
const ground: Platform = { id: "viewport-floor", x: 0, y: 650, width: 1400, kind: "floor" };
const date: Platform = { ...panel, id: "date-3-floor", kind: "date" };
const home: Platform = { ...panel, id: "companion-home-floor" };
const bounds = { width: 1400, height: 700 };
function settledToy(support: Platform = date) {
  const world = createCompanionToys(() => 0); world.sync([support, ground], bounds, 0);
  const id = world.spawn({ x: 280, y: 380 }, 0)!;
  // A native human drop tests attachment ownership independently of the
  // chest's source-bound ejection aim.
  expect(world.grab(id)).toBe(true); expect(world.drop(id, 0)).toBe(true);
  world.tick(400); expect(world.available()[0]).toMatchObject({ id, platformId: support.id, x: 280, y: support.y });
  return { world, id, prior: world.items()[0] };
}

describe("129 real toy support lifecycle (supersedes transparent121 panel catch)", () => {
  it.each([date, home])("retains the same actual $id and fraction through resize/reflow", support => {
    const { world, id, prior } = settledToy(support);
    const moved = { ...support, x: 950, y: 420, width: 360 };
    world.sync([moved, ground], bounds, 500);
    const restored = world.items()[0];
    expect(restored.id).toBe(id); expect(restored.hidden).toBe(false); expect(restored.platformId).toBe(support.id);
    expect(restored.x).toBeCloseTo(moved.x + moved.width * prior.fraction!, 6); expect(restored.y).toBe(420);
    expect(restored.fraction).toBeCloseTo(prior.fraction!, 8); expect(world.available()).toHaveLength(1); expect(world.moving()).toBe(false);
  });
  it("an actually removed source releases once in place and lands on a current lower support", () => {
    const { world, id, prior } = settledToy();
    world.sync([ground], bounds, 500);
    expect(world.items()[0]).toMatchObject({ id, x: prior.x, y: prior.y, hidden: false, platformId: undefined });
    expect(world.available()).toEqual([]); expect(world.pick(id, prior)).toBe(false); expect(world.moving()).toBe(true);
    world.tick(600); expect(world.items()[0].y).toBeCloseTo(prior.y + 4.5, 8);
    world.tick(1300); expect(world.available()[0]).toMatchObject({ id, x: prior.x, y: ground.y, platformId: ground.id });
    expect(world.moving()).toBe(false);
    world.sync([date, ground], bounds, 1400);
    expect(world.available()[0]).toMatchObject({ id, y: ground.y, platformId: ground.id });
  });
  it("excludes hidden elapsed time from a removed source's real gravity recovery", () => {
    const { world, id } = settledToy(home);
    world.sync([ground], bounds, 500); world.tick(600);
    const frozen = world.items()[0]; world.pause(600);
    world.tick(60_000); world.sync([ground], bounds, 60_000);
    expect(world.items()[0]).toEqual(frozen); expect(world.moving()).toBe(false);
    world.resume(60_000); world.tick(60_000); expect(world.items()[0]).toEqual(frozen);
    world.tick(60_100); expect(world.items()[0]).toMatchObject({ id, platformId: undefined }); expect(world.items()[0].y).toBeCloseTo(418, 8);
    world.tick(60_800); expect(world.available()[0]).toMatchObject({ id, y: ground.y, platformId: ground.id });
    expect(world.moving()).toBe(false);
  });
  it("never catches a transparent panel, including a panel published while another source is removed", () => {
    const { world, id } = settledToy();
    const lowerPanel = { ...panel, y: 450 };
    world.sync([lowerPanel, ground], bounds, 500); world.tick(900);
    expect(world.items()[0]).toMatchObject({ id, platformId: undefined, hidden: false }); expect(world.items()[0].y).toBeGreaterThan(lowerPanel.y);
    expect(world.available()).toEqual([]);
    world.tick(1300); expect(world.available()[0]).toMatchObject({ id, y: ground.y, platformId: ground.id });
    world.sync([panel, ground], bounds, 1400); expect(world.available()[0].platformId).toBe(ground.id);
  });
});

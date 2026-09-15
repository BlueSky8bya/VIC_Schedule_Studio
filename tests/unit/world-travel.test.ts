import { describe, expect, it, vi } from "vitest";
import type { Frame, Scene } from "../../components/shared/ambient/scene-engine";

const state = vi.hoisted(() => ({ ready: false, steps: [] as number[] }));
vi.mock("../../components/shared/ambient/scenes/biome-loaders", () => {
  const loader = async () => () => ({
    resize() {}, draw() {}, step(f: Frame) { state.steps.push(f.dt); },
    ready: () => state.ready
  });
  return { BIOME_LOADERS: { meadow: loader, hill: loader } };
});
vi.mock("../../components/shared/ambient/world/depth-render", async (original) => ({
  ...await original<object>(),
  bakeDepthFrame: () => ({ c: { width: 1, height: 1 }, y: 0 })
}));
import { createWorld, PAN_DUR, travelStrip } from "../../components/shared/ambient/world/world-scene";

describe("depth-aware biome travel", () => {
  it("covers the viewport with ordered adjoining strips in every direction", () => {
    for (const hz of [.26, .35, .42]) for (const dx of [-2, 0, 2]) for (const dy of [-2, 0, 2]) {
      for (let n = -20; n <= 20; n++) {
        const phase = n / 20;
        let previous = travelStrip(0, phase, dx, dy, hz);
        expect(previous.y).toBeLessThanOrEqual(0);
        for (let i = 1; i <= 72; i++) {
          const next = travelStrip(i / 72, phase, dx, dy, hz);
          expect(next.y).toBeGreaterThan(previous.y);
          expect(next.x).toBeLessThanOrEqual(1e-12);
          expect(next.x + next.scale).toBeGreaterThanOrEqual(1 - 1e-12);
          previous = next;
        }
        expect(previous.y).toBeGreaterThanOrEqual(1);
      }
    }
  });
  it("keeps exact endpoints and makes near terrain pass faster than the skyline", () => {
    for (const v of [0, .26, .42, .7, 1]) {
      expect(travelStrip(v, 0, 1, 1, .42)).toEqual({ x: 0, y: v, scale: 1 });
    }
    const far = travelStrip(.42, .5, 1, 0, .42);
    const near = travelStrip(1, .5, 1, 0, .42);
    expect((near.x + near.scale / 2) - (far.x + far.scale / 2)).toBeCloseTo(.07);
    expect(far.scale).toBeLessThan(near.scale);
  });
  it("never moves or scales celestial pixels above either terrain horizon", () => {
    for (const hz of [.35, .42]) for (const phase of [-1, -.7, -.2, 0, .2, .7, 1]) {
      for (const v of [0, .1, .2, hz]) {
        expect(travelStrip(v, phase, -1, 1, hz)).toEqual({ x: 0, y: v, scale: 1 });
      }
    }
  });
  it("waits for destination artwork, then travels for 620ms; reduced motion snaps", async () => {
    const f = { w: 1200, h: 800, dpr: 1, q: 2, dt: 0, t: 0, reduced: false,
      p: { x: 600, y: 400, inside: false }, time: { band: "noon" },
      weather: { now: "clear" }, light: {}, load: 1 } as Frame;
    for (const reduced of [false, true]) {
      state.ready = false; state.steps = [];
      const world = createWorld("summer", "meadow", { pin: true })(42) as Scene & { nav: { go(t: "hill"): boolean; moving(): boolean; at(): string } };
      world.resize(f);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(world.nav.go("hill")).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 0));
      world.step({ ...f, reduced, t: 5 });
      expect(world.nav.at()).toBe("meadow");
      expect(world.nav.moving()).toBe(true);
      expect(world.nav.go("hill")).toBe(false);
      expect(state.steps.every(dt => dt === 0)).toBe(true);
      state.ready = true;
      world.step({ ...f, reduced, t: 6 });
      if (!reduced) {
        world.step({ ...f, t: 6 + PAN_DUR - .001 });
        expect(world.nav.at()).toBe("meadow");
        world.step({ ...f, t: 6 + PAN_DUR + .001 });
      }
      expect(world.nav.at()).toBe("hill");
      expect(world.nav.moving()).toBe(false);
      world.dispose?.();
    }
  });
});

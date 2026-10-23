import { afterEach, describe, expect, it, vi } from "vitest";
import type { Frame, Scene } from "@/components/shared/ambient/scene-engine";

const proof = vi.hoisted(() => ({
  loads: [] as string[], seeds: [] as number[], sizes: [] as number[],
  steps: [] as number[], disposed: 0, pending: undefined as undefined | (() => void)
}));
vi.mock("@/components/shared/ambient/scenes/biome-loaders", () => ({
  BIOME_LOADERS: { meadow: (season: string) => {
    proof.loads.push(season);
    return new Promise(resolve => { proof.pending = () => resolve((seed: number) => {
      proof.seeds.push(seed);
      return {
        resize(frame: Frame) { proof.sizes.push(frame.w); },
        step(frame: Frame) { proof.steps.push(frame.dt); },
        draw() {}, dispose() { proof.disposed++; }, ready() { return true; }
      } satisfies Scene;
    }); });
  } }
}));
vi.mock("@/components/shared/ambient/world/depth-render", async original => ({
  ...await original<object>(), bakeDepthFrame: () => ({ c: { width: 1, height: 1 }, y: 0 })
}));
vi.mock("@/components/shared/ambient/world/particles", () => ({
  createParticles: () => ({ step() {}, draw() {}, debug: () => ({}) })
}));
import { createWorld } from "@/components/shared/ambient/world/world-scene";

const frame = { w: 1200, h: 800, dpr: 1, q: 2, dt: 0, t: 0, reduced: false,
  p: { x: 600, y: 600, inside: false }, hot: null, time: { band: "noon" },
  weather: { now: "clear" }, light: {}, load: 1 } as Frame;
afterEach(() => { proof.loads = []; proof.seeds = []; proof.sizes = []; proof.steps = []; proof.disposed = 0; proof.pending = undefined; });

describe("meadow world lifecycle after map retirement", () => {
  it("retains the four seasonal choices and original meadow seed", async () => {
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      const world = createWorld(season)(42);
      world.resize(frame);
      expect(world.ready?.()).toBe(false);
      proof.pending!(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      world.step(frame);
      expect(world.ready?.()).toBe(true);
      expect(world.nav!.at()).toBe("meadow");
      expect(world.nav!.exits()).toEqual({ up: null, down: null, left: null, right: null });
      expect(world.nav!.go("left")).toBe(false);
      expect(world.nav!.moving()).toBe(false);
      expect(world.debug?.()).toMatchObject({ loaded: ["meadow"], grid: "meadow", moving: false });
      world.dispose?.();
    }
    expect(proof.loads).toEqual(["spring", "summer", "autumn", "winter"]);
    expect(proof.seeds).toEqual(Array(4).fill(42 + 6 * 131 + 109 * 17));
    expect(proof.sizes).toEqual(Array(4).fill(1200));
    expect(proof.steps).toEqual(Array(4).fill(0));
    expect(proof.disposed).toBe(4);
  });
  it("disposal before the lazy scene arrives never allocates that scene", async () => {
    const world = createWorld("autumn")(42);
    world.resize(frame); world.dispose?.();
    proof.pending!(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(proof.seeds).toEqual([]);
    expect(proof.sizes).toEqual([]);
    expect(proof.disposed).toBe(0);
    expect(world.debug?.()).toMatchObject({ loaded: [], moving: false });
  });
});

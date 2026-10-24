import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { Frame, Scene, SceneFactory } from "@/components/shared/ambient/scene-engine";
import { BIOME_LOADERS } from "@/components/shared/ambient/scenes/biome-loaders";
import type { ActiveBiomeKey, Dir } from "./biomes";
import { createDepthPointer, depthOffsets } from "./depth";
import { surfaceLocalPoint, withDepthScene, withDepthLayer, bakeDepthFrame, depthCacheStats, clearDepthCache } from "./depth-render";
import { createParticles } from "./particles";
import { drawDepthHaze, drawLightPass, SPRING_MEADOW_HORIZON_V, withViewHorizon } from "./view";

export type WorldNav = {
  // Existing engine/debug consumers retain a fixed destination, with no travel.
  go(target: ActiveBiomeKey | Dir): boolean;
  at(): ActiveBiomeKey;
  moving(): boolean;
  exits(): Record<Dir, ActiveBiomeKey | null>;
};

/** Calendar and showcase share one lazy meadow and one render pass.
 * Depth, inverse pointer coordinates, weather, KST light and still gates stay
 * in the existing engine. Entering a walk never creates a second scenery. */
export function createWorld(season: SeasonKey, initial: ActiveBiomeKey = "meadow", opts: { pin?: boolean } = {}): SceneFactory {
  // Guarded fixture API compatibility does not reopen old destinations.
  void initial; void opts;
  return (seed: number): Scene & { nav: WorldNav } => {
    let scene: Scene | undefined;
    let lastFrame: Frame | undefined;
    let front: ReturnType<typeof bakeDepthFrame> | undefined;
    let sizeKey = "";
    let disposed = false;
    let loading = true;
    let loadError = false;
    let backdropPainted = false;
    const owner = {};
    const pointer = createDepthPointer();
    const particles = createParticles(seed, true);
    const inView = <T,>(run: () => T): T => withViewHorizon(SPRING_MEADOW_HORIZON_V, run);
    const showcase = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-showcase");
    const offsetsOf = (frame: Frame) => depthOffsets(
      pointer.value(frame.t), frame.w, frame.dpr,
      !frame.reduced && showcase() && frame.depthTier !== "still"
        ? frame.depthTier ?? (frame.q < 2 ? "lite" : "full") : "still"
    );
    const localFrame = (frame: Frame): Frame => {
      const offset = offsetsOf(frame).ground;
      const local = (x: number, y: number) => surfaceLocalPoint(x, y, offset, frame.h * SPRING_MEADOW_HORIZON_V, frame.h);
      const point = local(frame.p.x, frame.p.y);
      const a = frame.hot ? local(frame.hot.x, frame.hot.y) : null;
      const b = frame.hot ? local(frame.hot.x + frame.hot.w, frame.hot.y + frame.hot.h) : null;
      return { ...frame, surfaceOffset: offset, p: { ...frame.p, ...point }, hot: frame.hot && a && b ? { ...frame.hot, x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y } : null };
    };
    const fit = (frame: Frame) => {
      if (!scene) return;
      const next = `${frame.w}x${frame.h}@${frame.dpr}/${frame.q}`;
      if (next !== sizeKey) inView(() => scene!.resize(frame));
      if (next !== sizeKey || !front) {
        front = bakeDepthFrame(frame.w, frame.h, season, seed);
        sizeKey = next;
      }
    };
    const nav: WorldNav = {
      go: () => false,
      at: () => "meadow",
      moving: () => false,
      exits: () => ({ up: null, down: null, left: null, right: null })
    };
    void BIOME_LOADERS.meadow(season).then(factory => {
      if (disposed) return;
      // Preserve the original meadow seed across the retirement.
      scene = inView(() => factory(seed + "meadow".length * 131 + "meadow".charCodeAt(0) * 17));
      if (lastFrame) fit(lastFrame);
    }).catch(() => {
      loadError = true;
    }).finally(() => { loading = false; });

    return {
      nav,
      composed: true,
      dispose() {
        disposed = true;
        backdropPainted = false;
        if (front) front.c.width = front.c.height = 1;
        front = undefined;
        clearDepthCache();
        scene?.dispose?.();
        scene = undefined;
      },
      resize(frame) { lastFrame = frame; fit(frame); },
      step(frame) {
        lastFrame = frame;
        if (frame.reduced || !showcase() || frame.depthTier === "still") pointer.reset(frame.t);
        else pointer.aim(frame.t - frame.dt, frame.p, frame.w, frame.h);
        if (!scene) return;
        fit(frame);
        inView(() => {
          particles.step(frame.dt, frame.w, frame.h, frame.weather.now, frame.light, frame.load, frame.q < 2 || frame.depthTier === "lite", scene!.ownsWeather?.(frame.weather.now) ?? false);
          scene!.step(localFrame(frame));
        });
      },
      draw(context, frame) {
        if (!scene) return;
        const local = localFrame({ ...frame, solarHorizon: frame.solarHorizon ?? frame.h * SPRING_MEADOW_HORIZON_V });
        inView(() => withDepthScene(context, offsetsOf(frame), () => {
          scene!.draw(context, local);
          if (scene!.splitHaze?.()) {
            drawDepthHaze(context, season, frame.w, frame.h, frame.light);
            scene!.drawAbove?.(context, local);
            particles.draw(context, frame.w, frame.h, season, frame.weather.now, frame.light, frame.t);
          } else {
            particles.draw(context, frame.w, frame.h, season, frame.weather.now, frame.light, frame.t);
            drawDepthHaze(context, season, frame.w, frame.h, frame.light);
          }
          if (!scene!.drawForeground?.(context, local) && front) withDepthLayer(context, "frame", () => context.drawImage(front!.c, -32, front!.y));
          scene!.drawAirborne?.(context, local);
          drawLightPass(context, frame.w, frame.h, frame.light, scene!.fogFloor ? x => scene!.fogFloor!(x, local) : null, scene!.fogFloorKey?.(local) ?? "", false);
        }, frame.depthTier ?? "full", owner));
        backdropPainted = true;
      },
      backdropPainted: () => backdropPainted,
      pointerDown(frame, onBackground) { return inView(() => scene?.pointerDown?.(localFrame(frame), onBackground) ?? false); },
      pointerUp(frame) { inView(() => scene?.pointerUp?.(localFrame(frame))); },
      ownsWeather(weather) { return scene?.ownsWeather?.(weather) ?? false; },
      ready() { return !loading && !loadError && !!scene && (scene.ready?.() ?? true); },
      fogFloor(x, frame) { return scene?.fogFloor?.(x, frame) ?? Number.NaN; },
      fogFloorKey(frame) { return `meadow:${scene?.fogFloorKey?.(frame) ?? ""}`; },
      splitHaze() { return scene?.splitHaze?.() ?? false; },
      drawAbove(context, frame) { scene?.drawAbove?.(context, frame); },
      debug() {
        return {
          ...inView(() => scene?.debug?.() ?? {}),
          depth: lastFrame ? offsetsOf(lastFrame) : null,
          depthCache: { ...depthCacheStats(), panelBytes: 0, foregroundBytes: front ? front.c.width * front.c.height * 4 : 0 },
          weatherParticles: particles.debug(), biome: "meadow", moving: false,
          loaded: scene ? ["meadow"] : [], visited: ["meadow"], grid: "meadow", loading, loadError
        };
      }
    };
  };
}

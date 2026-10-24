import { publishSceneBackdrop, publishSceneMaterial } from "@/lib/ui/scene-material";
import type { Light } from "./light";
import { drawLightPass, SPRING_MEADOW_HORIZON_V, withViewHorizon } from "./view";

/** Bounded 4×32² color lookup; only rebuilt when the real interpolated light
 * changes. Reuses the world's pass instead of a second day/night palette. */
export function createSceneMaterialPublisher(owner: HTMLCanvasElement) {
  const size = 32;
  let key = "", canvas: HTMLCanvasElement | undefined;
  const clear = () => { publishSceneMaterial(undefined, owner); if (canvas) canvas.width = canvas.height = 1; canvas = undefined; key = ""; };
  return {
    backdrop(night: boolean) { publishSceneBackdrop(night, owner); },
    publish(light: Light, night: boolean, terrain: { width: number; height: number; floor?: (x: number) => number; key: string }) {
      const next = JSON.stringify([light, night, terrain.key]);
      if (key === next) return;
      canvas ??= document.createElement("canvas"); canvas.width = canvas.height = size;
      const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) return;
      const basis = ["#000", "#f00", "#0f0", "#00f"].map(color => {
        context.globalCompositeOperation = "source-over"; context.fillStyle = color; context.fillRect(0, 0, size, size);
        const floor = terrain.floor ? (x: number) => terrain.floor!(x / size * terrain.width) / terrain.height * size : null;
        withViewHorizon(SPRING_MEADOW_HORIZON_V, () => drawLightPass(context, size, size, light, floor, terrain.key));
        return context.getImageData(0, 0, size, size).data;
      });
      key = next; publishSceneMaterial({ canvas: owner, size, basis, night }, owner);
    },
    clear,
    dispose() { clear(); publishSceneBackdrop(undefined, owner); }
  };
}

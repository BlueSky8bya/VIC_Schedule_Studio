// Public render contract only. Source/review provenance stays in art-src.
import geometry from "./meadow-spring-geometry.json";

/** Keep the complete far-to-near progression on every aspect ratio. Wide views
 * compress ground vertically; portrait views crop only the sides. */
export function meadowLayerGroundCrop(w: number, h: number, horizon: number) {
  const height = h - horizon + 8;
  const sw = Math.min(1536, w * 1024 / height);
  return { sx: (1536 - sw) / 2, sy: 0, sw, sh: 1024, y: horizon - 8, height };
}

export const SPRING_MEADOW_BACKDROP = {
  url: "/ambient/art/backdrop-meadow-spring-v1.png",
  ...geometry,
} as const;

/** Uniform scaling, centered horizontally, with the source ground anchored at
 * the engine horizon. The crop never stretches the grass differently on x/y. */
export function meadowGroundCrop(w: number, h: number, horizon: number) {
  const { width, height, horizon: sourceHorizon } = SPRING_MEADOW_BACKDROP;
  const scale = Math.max(w / width, (h - horizon) / (height - sourceHorizon));
  return { sx: (width - w / scale) / 2, sy: sourceHorizon, sw: w / scale, sh: (h - horizon) / scale };
}

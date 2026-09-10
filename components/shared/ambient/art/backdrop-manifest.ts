// Public render contract only. Source/review provenance stays in art-src.
import geometry from "./meadow-spring-geometry.json";

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

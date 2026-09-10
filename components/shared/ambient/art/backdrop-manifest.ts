// Public render contract only. Source/review provenance stays in art-src.
import geometry from "./meadow-spring-geometry.json";

/** Height defines the grass scale. Wide views reveal more terrain, never
 * stretch the source horizontally; portrait views crop the centered tile. */
export function meadowLayerGroundCrop(w: number, h: number, horizon: number) {
  const height = h - horizon + 8;
  const sw = Math.min(1536, w * 1024 / height);
  const tileWidth = 1536 * height / 1024;
  const overlap = tileWidth * .12;
  const stride = tileWidth - overlap;
  const left = (w - tileWidth) / 2;
  const tiles = [];
  for (let i = Math.floor(-left / stride); i < Math.ceil((w - left) / stride); i++) {
    tiles.push({ x: left + i * stride });
  }
  return { sx: (1536 - sw) / 2, sy: 0, sw, sh: 1024, y: horizon - 8, height, tileWidth, overlap, tiles };
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

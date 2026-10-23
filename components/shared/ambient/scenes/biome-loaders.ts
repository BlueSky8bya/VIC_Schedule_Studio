import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { SceneFactory } from "@/components/shared/ambient/scene-engine";
import type { ActiveBiomeKey } from "@/components/shared/ambient/world/biomes";

// A single lazy scene owns all seasons, weather and sky. A stale destination
// has no loader and cannot fetch the retired code or assets.
export const BIOME_LOADERS: Record<ActiveBiomeKey, (season: SeasonKey) => Promise<SceneFactory>> = {
  meadow: (season) => import("./autumn").then((module) => (seed: number) => module.createAutumn(seed, season))
};

// 바이옴 × 계절 → 장면 팩토리(2026-09-04, PLAN-004 §6). 장면 코드는 동적 import — 안 가 본 바이옴은 내려받지도 굽지도 않는다.
// Meadow seasons share the autumn material simulation; only seasonal art/sky varies.

import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { SceneFactory } from "@/components/shared/ambient/scene-engine";
import type { BiomeKey } from "@/components/shared/ambient/world/biomes";

export const BIOME_LOADERS: Record<BiomeKey, (season: SeasonKey) => Promise<SceneFactory>> = {
  meadow: (season) => import("./autumn").then((m) => (seed:number) => m.createAutumn(seed,season)),
  pond: (season) => import("./autumn").then((m) => (seed: number) => m.createAutumn(seed, season, "pond")),
  sea: (season) => import("./sea").then((m) => (seed: number) => m.createSea(seed, { season })),
  // 깊은 바다만 따로 산다(2026-09-06) — 물속 옆모습 시점 + 계절·날씨·시간대 무영향이라 계절을 받지 않는다.
  deep: () => import("./deep").then((m) => m.createDeep),
  tidal: (season) => import("./coast").then((m) => (seed: number) => m.createCoast(seed, { season, mode: "tidal" })),
  sandy: (season) => import("./coast").then((m) => (seed: number) => m.createCoast(seed, { season, mode: "sandy" })),
  rocky: (season) => import("./coast").then((m) => (seed: number) => m.createCoast(seed, { season, mode: "rocky" })),
  forest: (season) => import("./autumn").then((m) => (seed: number) => m.createAutumn(seed, season, "forest")),
  hill: (season) => import("./autumn").then((m) => (seed: number) => m.createAutumn(seed, season, "hill")),
  valley: (season) => import("./autumn").then((m) => (seed: number) => m.createAutumn(seed, season, "valley")),
  mountain: (season) => import("./autumn").then((m) => (seed:number) => m.createAutumn(seed,season,"mountain"))
};

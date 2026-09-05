// 바이옴 × 계절 → 장면 팩토리(2026-09-04, PLAN-004 §6). 장면 코드는 동적 import — 안 가 본 바이옴은 내려받지도 굽지도 않는다.
// 초원 = 지금의 봄/가을/겨울 장면 + 여름 초원(봄 장면의 여름 변주). 민물 = 옛 여름 물 장면(계절 파라미터). 해안 셋·바다 둘·육지 넷은 얇은 판.

import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { SceneFactory } from "@/components/shared/ambient/scene-engine";
import type { BiomeKey } from "@/components/shared/ambient/world/biomes";

export const BIOME_LOADERS: Record<BiomeKey, (season: SeasonKey) => Promise<SceneFactory>> = {
  meadow: (season) => {
    if (season === "autumn") return import("./autumn").then((m) => m.createAutumn);
    if (season === "winter") return import("./winter").then((m) => m.createWinter);
    return import("./spring").then((m) => (seed: number) => m.createSpring(seed, season === "summer" ? "summer" : "spring"));
  },
  pond: (season) => import("./summer").then((m) => (seed: number) => m.createSummer(seed, { season })),
  sea: (season) => import("./sea").then((m) => (seed: number) => m.createSea(seed, { season })),
  // 깊은 바다만 따로 산다(2026-09-06) — 물속 옆모습 시점 + 계절·날씨·시간대 무영향이라 계절을 받지 않는다.
  deep: () => import("./deep").then((m) => m.createDeep),
  tidal: (season) => import("./coast").then((m) => (seed: number) => m.createCoast(seed, { season, mode: "tidal" })),
  sandy: (season) => import("./coast").then((m) => (seed: number) => m.createCoast(seed, { season, mode: "sandy" })),
  rocky: (season) => import("./coast").then((m) => (seed: number) => m.createCoast(seed, { season, mode: "rocky" })),
  forest: (season) => import("./land").then((m) => (seed: number) => m.createLand(seed, { season, kind: "forest" })),
  hill: (season) => import("./land").then((m) => (seed: number) => m.createLand(seed, { season, kind: "hill" })),
  valley: (season) => import("./land").then((m) => (seed: number) => m.createLand(seed, { season, kind: "valley" })),
  mountain: (season) => import("./land").then((m) => (seed: number) => m.createLand(seed, { season, kind: "mountain" }))
};

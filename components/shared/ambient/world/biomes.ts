// The owner's 2026-10-23 world is one seasonal meadow, shared by the calendar
// and the walk. BiomeKey keeps its historical ecological/source meaning so
// immutable codex/art source hashes do not change for a runtime-map retirement.
// Only ActiveBiomeKey can appear in executable scene/fixture/navigation APIs.
export type BiomeKey = "valley" | "pond" | "mountain" | "hill" | "meadow" | "forest" | "tidal" | "sandy" | "rocky" | "shallow" | "sea" | "deep";
export type ActiveBiomeKey = "meadow";
export type Dir = "up" | "down" | "left" | "right";

// Labels describe species/art provenance, never destinations or loaders.
export const ECOLOGICAL_REGIONS: Record<BiomeKey, string> = {
  meadow: "초원", hill: "들판·언덕", forest: "숲", pond: "민물", valley: "계곡",
  mountain: "산", tidal: "갯벌", sandy: "모래해안", rocky: "암석해안",
  shallow: "얕은 바다", sea: "먼바다", deep: "깊은 바다"
};

export type BiomeDef = {
  key: ActiveBiomeKey;
  nameKo: string;
  nameEn: string;
  gx: number;
  gy: number;
  blurb: string;
  land: boolean;
};

export const BIOMES: Record<ActiveBiomeKey, BiomeDef> = {
  meadow: { key: "meadow", nameKo: "초원", nameEn: "Meadow", gx: 0, gy: 0, blurb: "빅타민과 함께 걷는 사계절 초원", land: true }
};
export const isBiomeKey = (value: unknown): value is ActiveBiomeKey => value === "meadow";

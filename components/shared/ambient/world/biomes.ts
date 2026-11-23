// The owner's 2026-10-23 world is one seasonal meadow, shared by the calendar
// and the walk. BiomeKey keeps its historical ecological/source meaning so
// immutable codex/art source hashes do not change for a runtime-map retirement.
// Only ActiveBiomeKey can appear in executable scene/fixture/navigation APIs.
export type BiomeKey = "valley" | "pond" | "mountain" | "hill" | "meadow" | "forest" | "tidal" | "sandy" | "rocky" | "shallow" | "sea" | "deep";
export type ActiveBiomeKey = "meadow";
export type Dir = "up" | "down" | "left" | "right";


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

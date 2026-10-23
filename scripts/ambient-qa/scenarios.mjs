// Only the seasonal meadow remains. Historical meadow IDs stay stable;
// retired map cases are removed rather than silently pointed at meadow.
export const SEASON_MONTH = { spring: 4, summer: 8, autumn: 10, winter: 1 };
export const DEFAULT_SEED = 42;
export const ALT_SEED = 7;
export const SCENARIOS = [
  { id: 3, biome: "meadow", season: "autumn", band: "morning", weather: "clear", why: "가을 식생·이동·레이어", agents: "B·C" },
  { id: 4, biome: "meadow", season: "autumn", band: "dusk", weather: "clear", why: "노을·표면 판정", agents: "C" },
  { id: 16, biome: "meadow", season: "summer", band: "noon", weather: "clear", why: "여름 식생·시간대 기준", agents: "C·A" },
  { id: 17, biome: "meadow", season: "spring", band: "morning", weather: "clear", why: "봄 야생화·새잎·초원 산책", agents: "A·B" },
  { id: 18, biome: "meadow", season: "winter", band: "morning", weather: "snow", why: "겨울 식생·눈·경계", agents: "A·C" },
  { id: 19, biome: "meadow", season: "summer", band: "night", weather: "rain", why: "밤·비·가독성·날씨", agents: "B·C" },
  { id: 20, biome: "meadow", season: "spring", band: "dawn", weather: "fog", why: "새벽·안개·원경 보존", agents: "B·C" }
];
export const SMOKE_IDS = [3, 17, 18];
export const byId = (id) => SCENARIOS.find((scenario) => scenario.id === Number(id));

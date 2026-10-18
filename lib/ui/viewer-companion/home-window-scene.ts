import type { DayBand } from "@/components/shared/ambient/world/time";
import type { Weather } from "@/components/shared/ambient/world/weather";
import type { CompanionHomeEnvironment } from "./home-environment";

export type CompanionWindowPhase = "dawn" | "day" | "dusk" | "night";

const PHASE: Readonly<Record<DayBand, CompanionWindowPhase>> = {
  dawn: "dawn", morning: "day", noon: "day", dusk: "dusk", evening: "night", night: "night",
};
const WEATHER_OVERLAY: Readonly<Record<Weather, string | null>> = {
  clear: null,
  cloud: "/companion/home/123/window-cloud-overlay.webp",
  rain: "/companion/home/122/window-rain-overlay.webp",
  snow: "/companion/home/122/window-snow-overlay.webp",
  fog: "/companion/home/123/window-fog-overlay.webp",
  wind: "/companion/home/123/window-wind-overlay.webp",
};

/** Only select pictures from the already resolved shared world. The solar
 * band owns phase; this presentation adds no clock, weather draw or timer. */
export function resolveCompanionWindowScene(environment?: CompanionHomeEnvironment) {
  const season = environment?.season ?? "spring", weather = environment?.weather ?? "clear";
  const phase = PHASE[environment?.band ?? "noon"];
  return {
    season, weather, phase,
    landscapeSrc: phase === "day" ? `/companion/home/122/window-${season}.webp`
      : `/companion/home/123/window-${season}-${phase}.webp`,
    overlaySrc: WEATHER_OVERLAY[weather],
  };
}

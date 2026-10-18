import { describe, expect, it } from "vitest";
import { DAY_BANDS, worldTimeOfBand, type DayBand } from "@/components/shared/ambient/world/time";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import type { Weather } from "@/components/shared/ambient/world/weather";
import { resolveCompanionHomeEnvironment, type CompanionHomeEnvironment } from "@/lib/ui/viewer-companion/home-environment";
import { resolveCompanionWindowScene } from "@/lib/ui/viewer-companion/home-window-scene";

const seasons: readonly SeasonKey[] = ["spring", "summer", "autumn", "winter"];
const phase: Record<DayBand, string> = { dawn: "dawn", morning: "day", noon: "day", dusk: "dusk", evening: "night", night: "night" };
const base: CompanionHomeEnvironment = { date: { y: 2026, m: 10, d: 19 }, season: "autumn", hour: 13, band: "noon", night: false, weather: "clear" };

describe("123 shared-world window pictures", () => {
  it("selects all16 season/time pictures from the shared solar band, preserving the four existing day pictures", () => {
    const sources = new Set<string>();
    for (const season of seasons) for (const band of DAY_BANDS) {
      const input = Object.freeze({ ...base, season, band }), scene = resolveCompanionWindowScene(input);
      expect(scene.phase).toBe(phase[band]); expect(scene.season).toBe(season);
      expect(scene.landscapeSrc).toBe(phase[band] === "day" ? `/companion/home/122/window-${season}.webp` : `/companion/home/123/window-${season}-${phase[band]}.webp`);
      expect(scene.overlaySrc).toBeNull(); sources.add(scene.landscapeSrc);
    }
    expect(sources.size).toBe(16);
  });

  it("keeps each shared weather identity and uses actual static weather textures rather than a color-only variant", () => {
    const overlays: Record<Weather, string | null> = {
      clear: null, cloud: "/companion/home/123/window-cloud-overlay.webp", rain: "/companion/home/122/window-rain-overlay.webp",
      snow: "/companion/home/122/window-snow-overlay.webp", fog: "/companion/home/123/window-fog-overlay.webp", wind: "/companion/home/123/window-wind-overlay.webp",
    };
    for (const weather of Object.keys(overlays) as Weather[]) for (const band of DAY_BANDS) {
      const scene = resolveCompanionWindowScene({ ...base, band, weather });
      expect(scene.weather).toBe(weather); expect(scene.overlaySrc).toBe(overlays[weather]);
      expect(scene.landscapeSrc).toBe(resolveCompanionWindowScene({ ...base, band }).landscapeSrc);
    }
  });

  it("consumes the existing viewed-month/KST/force resolution without a second hour rule or clock", () => {
    const clock = { today: { y: 2026, m: 10, d: 19 }, hour: 3.25 };
    for (const band of DAY_BANDS) {
      const environment = resolveCompanionHomeEnvironment({ slug: "vic", year: 2027, month: 1, force: { band, weather: "snow" } }, clock);
      const scene = resolveCompanionWindowScene(environment);
      expect(environment.date).toEqual({ y: 2027, m: 1, d: 1 }); expect(scene.season).toBe("winter");
      expect(scene.phase).toBe(phase[environment.band]); expect(scene.overlaySrc).toBe("/companion/home/122/window-snow-overlay.webp");
    }
    // Band is the shared authority even when a caller supplies contradictory
    // legacy hour/night fields. The presentation never invents another clock.
    expect(resolveCompanionWindowScene({ ...base, hour: 0, night: true, band: "noon" }).phase).toBe("day");
    expect(resolveCompanionWindowScene({ ...base, hour: 12, night: false, band: "evening" }).phase).toBe("night");
  });

  it("has a deterministic initial picture when the shared environment has not arrived", () => {
    expect(resolveCompanionWindowScene()).toEqual({ season: "spring", weather: "clear", phase: "day", landscapeSrc: "/companion/home/122/window-spring.webp", overlaySrc: null });
  });

  it("uses the existing fixture's solar representative hours for all four phases in each viewed season", () => {
    const months: Record<SeasonKey, number> = { spring: 4, summer: 7, autumn: 10, winter: 1 };
    for (const season of seasons) for (const band of ["dawn", "noon", "dusk", "night"] as const) {
      const month = months[season], date = { y: 2025, m: month, d: new Date(Date.UTC(2025, month, 0)).getUTCDate() };
      const hour = worldTimeOfBand(season, band, date).hour;
      const shared = resolveCompanionHomeEnvironment({ slug: "vic", year: 2025, month, season, force: { hour } }, { today: { y: 2026, m: 10, d: 19 }, hour: 0 });
      expect(resolveCompanionWindowScene(shared).phase).toBe(phase[band]);
    }
  });
});

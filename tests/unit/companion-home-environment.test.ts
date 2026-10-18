import { describe, expect, it } from "vitest";
import { resolveAmbientEnvironment } from "@/components/shared/ambient/world/environment";
import { seasonOfMonth } from "@/components/shared/ambient/registry";
import { worldTimeOfBand } from "@/components/shared/ambient/world/time";
import { weatherAt, segmentBounds } from "@/components/shared/ambient/world/weather";
import { companionHomeEnvironment, resolveCompanionHomeEnvironment } from "@/lib/ui/viewer-companion/home-environment";

const clock = { today: { y: 2026, m: 10, d: 19 }, hour: 13.25 };
describe("one ambient environment for the house and calendar", () => {
  it("keeps current/past/future viewed-date ownership including leap February", () => {
    const dates = [[2026, 10, 19], [2024, 2, 29], [2027, 1, 1]];
    for (const [year, month, day] of dates) {
      const context = { slug: "vic", year, month, season: seasonOfMonth(month) };
      const environment = resolveAmbientEnvironment(context, clock), home = resolveCompanionHomeEnvironment(context, clock);
      expect(environment.date).toEqual({ y: year, m: month, d: day });
      expect(home).toEqual(companionHomeEnvironment(environment));
      expect(environment.weather).toEqual(weatherAt("vic", year, month, day, clock.hour));
    }
  });

  it("uses the same calendar seed and weather segment at both sides of a real boundary", () => {
    const [boundary] = segmentBounds("vic", 2026, 10, 19);
    const context = { slug: "vic", year: 2026, month: 10, season: "autumn" as const };
    for (const hour of [boundary - .001, boundary, boundary + .001]) {
      const instant = { ...clock, hour }, ambient = resolveAmbientEnvironment(context, instant), home = resolveCompanionHomeEnvironment(context, instant);
      expect(home.weather).toBe(ambient.weather.now);
      expect(home.date).toEqual(ambient.date);
      expect(home.hour).toBe(ambient.time.hour);
      expect(home.band).toBe(ambient.time.band);
    }
  });

  it("follows the viewed month rather than the real current season", () => {
    expect(resolveCompanionHomeEnvironment({ slug: "vic", year: 2027, month: 1 }, clock).season).toBe("winter");
    expect(resolveCompanionHomeEnvironment({ slug: "vic", year: 2026, month: 7 }, clock).season).toBe("summer");
  });

  it("keeps explicit world date/weather and band-over-hour precedence", () => {
    const context = { slug: "vic", year: 2026, month: 10, season: "winter" as const, force: { year: 2024, month: 2, day: 31, hour: 12, band: "night" as const, weather: "snow" as const } };
    const ambient = resolveAmbientEnvironment(context, clock), home = resolveCompanionHomeEnvironment(context, clock);
    expect(ambient.date).toEqual({ y: 2024, m: 2, d: 29 });
    expect(ambient.time).toEqual(worldTimeOfBand("winter", "night", ambient.date));
    expect(home.night).toBe(true);
    expect(home.weather).toBe("snow");
    expect(home).toEqual(companionHomeEnvironment(ambient));
    expect(context.force.day).toBe(31);
  });
});

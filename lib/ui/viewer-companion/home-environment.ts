import { kstToday, pickAmbient, type KstDate, type SeasonKey } from "@/components/shared/ambient/registry";
import { kstHour, type DayBand } from "@/components/shared/ambient/world/time";
import { resolveAmbientEnvironment, type AmbientEnvironment, type AmbientEnvironmentClock, type AmbientEnvironmentForce } from "@/components/shared/ambient/world/environment";
import type { Weather } from "@/components/shared/ambient/world/weather";

export type CompanionHomeEnvironment = Readonly<{
  date: KstDate; season: SeasonKey; hour: number; band: DayBand; night: boolean; weather: Weather;
}>;
export type CompanionHomeEnvironmentContext = {
  slug: string; year: number; month: number; season?: SeasonKey; force?: AmbientEnvironmentForce | null;
};

/** A small, readonly view of the same resolved canvas world. No second
 * weather table, random draw, API, interval or ambient-on dependency. */
export function companionHomeEnvironment(environment: AmbientEnvironment): CompanionHomeEnvironment {
  return { date: { ...environment.date }, season: environment.season, hour: environment.time.hour, band: environment.time.band, night: environment.time.night, weather: environment.weather.now };
}

export function resolveCompanionHomeEnvironment(context: CompanionHomeEnvironmentContext, clock: AmbientEnvironmentClock = { today: kstToday(), hour: kstHour() }): CompanionHomeEnvironment {
  const season = context.season ?? pickAmbient(context.force?.month ?? context.month, null, clock.today).season;
  return companionHomeEnvironment(resolveAmbientEnvironment({ ...context, season }, clock));
}

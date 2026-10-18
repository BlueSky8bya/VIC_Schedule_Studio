import { kstToday, type KstDate, type SeasonKey } from "../registry";
import { kstHour, worldTime, worldTimeOfBand, type DayBand, type WorldTime } from "./time";
import { weatherAt, type DayWeather, type Weather } from "./weather";

export type AmbientEnvironmentForce = {
  year?: number; month?: number; day?: number; hour?: number; band?: DayBand; weather?: Weather;
};
export type AmbientEnvironmentContext = {
  slug: string; season: SeasonKey; year: number; month: number; force?: AmbientEnvironmentForce | null;
};
export type AmbientEnvironmentClock = { today: KstDate; hour: number };
export type AmbientEnvironment = { date: KstDate; season: SeasonKey; time: WorldTime; weather: DayWeather };

/** One calendar world: current month uses today, past months their last day,
 * future months their first. Canvas and the house window consume this same
 * resolver; it owns no clock, random generator, subscription or preference. */
export function resolveAmbientEnvironment(world: AmbientEnvironmentContext, clock: AmbientEnvironmentClock): AmbientEnvironment {
  const force = world.force, { today } = clock;
  const y = Math.max(1900, Math.min(2100, Math.trunc(force?.year ?? world.year)));
  const m = Math.max(1, Math.min(12, Math.trunc(force?.month ?? world.month)));
  const viewDay = y === today.y && m === today.m ? today.d
    : y < today.y || y === today.y && m < today.m ? new Date(Date.UTC(y, m, 0)).getUTCDate() : 1;
  const d = Math.max(1, Math.min(new Date(Date.UTC(y, m, 0)).getUTCDate(), Math.trunc(force?.day ?? viewDay)));
  const date = { y, m, d };
  const time = force?.band ? worldTimeOfBand(world.season, force.band, date) : worldTime(world.season, force?.hour ?? clock.hour, date);
  const weather: DayWeather = force?.weather ? { now: force.weather, prev: force.weather, segment: 0, until: 24 } : weatherAt(world.slug, y, m, d, time.hour);
  return { date, season: world.season, time, weather };
}

/** Read only the established KST sources; callers retain their existing tick. */
export function readAmbientEnvironment(world: AmbientEnvironmentContext): AmbientEnvironment {
  return resolveAmbientEnvironment(world, { today: kstToday(), hour: kstHour() });
}

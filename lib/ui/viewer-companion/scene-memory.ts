import { kstDayKey, kstHour } from "@/lib/calendar/month";
import { COMPANION_WEARABLE_IDS, type CompanionAccessoryId } from "./accessory-catalog";
import { isCompanionFoodKind, type CompanionFoodKind } from "./snacks";
import type { CompanionRadioMood } from "./radio-reaction";
import { isCompanionInstrumentScoreKey } from "./instrument-score";

export const COMPANION_SCENE_MEMORY_KEY = "vic.companionScenes.v1";
export type CompanionScenePlace = "home" | "card" | "floor";
export type CompanionUnfinished = "performance" | "hide" | "melody";
export type CompanionSceneMemory = {
  version: 1;
  lastMinute: number;
  lastVisitMinute: number;
  /** Rolling coarse hour buckets; no visit/session/account or schedule IDs. */
  hours: number[];
  hourDays: number[];
  homeHours: number[];
  music: Record<CompanionRadioMood, number>;
  places: Record<CompanionScenePlace, number>;
  greeting: "bow" | "pounce" | "stretch";
  greetingCount: number;
  reassurance: number;
  unfinished?: CompanionUnfinished;
  /** One allowlisted score segment only; never arbitrary song/schedule text. */
  melody?: { score: string; segment: number };
  first?: "touch" | "meal" | "rest" | "play";
  mishapFood?: CompanionFoodKind;
  outfits: Partial<Record<CompanionAccessoryId, number>>;
};
const count = (value: unknown, cap = 12) => typeof value === "number" && Number.isFinite(value) ? Math.min(cap, Math.max(0, Math.floor(value))) : 0;
const minute = (value: unknown) => count(value, 9_000_000_000);
export const newCompanionSceneMemory = (): CompanionSceneMemory => ({ version: 1, lastMinute: 0, lastVisitMinute: 0, hours: Array(24).fill(0), hourDays: Array(24).fill(0), homeHours: Array(24).fill(0), music: { lively: 0, graceful: 0, calm: 0 }, places: { home: 0, card: 0, floor: 0 }, greeting: "bow", greetingCount: 0, reassurance: 0, outfits: {} });
export function normalizeCompanionSceneMemory(raw: unknown): CompanionSceneMemory {
  const next = newCompanionSceneMemory();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return next;
  const value = raw as Record<string, unknown>;
  if (value.version !== 1) return next;
  next.lastMinute = minute(value.lastMinute); next.lastVisitMinute = minute(value.lastVisitMinute);
  for (const key of ["hours", "homeHours"] as const) if (Array.isArray(value[key])) next[key] = Array.from({ length: 24 }, (_, i) => count((value[key] as unknown[])[i]));
  if (Array.isArray(value.hourDays)) next.hourDays = Array.from({ length: 24 }, (_, i) => count((value.hourDays as unknown[])[i], 4_000_000));
  for (const key of ["music", "places"] as const) {
    const scores = value[key] && typeof value[key] === "object" ? value[key] as Record<string, unknown> : {};
    for (const name of Object.keys(next[key])) (next[key] as Record<string, number>)[name] = count(scores[name]);
  }
  if (["bow", "pounce", "stretch"].includes(String(value.greeting))) next.greeting = value.greeting as CompanionSceneMemory["greeting"];
  next.greetingCount = count(value.greetingCount); next.reassurance = count(value.reassurance);
  if (["performance", "hide", "melody"].includes(String(value.unfinished))) next.unfinished = value.unfinished as CompanionUnfinished;
  const melody = value.melody && typeof value.melody === "object" ? value.melody as Record<string, unknown> : undefined;
  if (melody && isCompanionInstrumentScoreKey(melody.score) && Number.isSafeInteger(melody.segment) && Number(melody.segment) >= 0 && Number(melody.segment) <= 4096) next.melody = { score: melody.score, segment: Number(melody.segment) };
  if (["touch", "meal", "rest", "play"].includes(String(value.first))) next.first = value.first as CompanionSceneMemory["first"];
  if (isCompanionFoodKind(value.mishapFood)) next.mishapFood = value.mishapFood;
  const outfits = value.outfits && typeof value.outfits === "object" ? value.outfits as Record<string, unknown> : {};
  for (const id of COMPANION_WEARABLE_IDS) if (count(outfits[id])) next.outfits[id] = count(outfits[id]);
  return next;
}

export function preferredCompanionSceneAccessory(memory: CompanionSceneMemory, owned: readonly CompanionAccessoryId[]): CompanionAccessoryId | null {
  const safe = normalizeCompanionSceneMemory(memory);
  return COMPANION_WEARABLE_IDS.filter(id => owned.includes(id) && (safe.outfits[id] ?? 0) >= 2)
    .sort((a, b) => (safe.outfits[b] ?? 0) - (safe.outfits[a] ?? 0))[0] ?? null;
}
export function beginCompanionEncounter(memory: CompanionSceneMemory, wallTime: number) {
  const next = normalizeCompanionSceneMemory(memory), at = Math.floor(wallTime / 60000), hour = kstHour(wallTime);
  if (!Number.isFinite(at) || !Number.isFinite(hour) || at <= 0) return { memory: next, gapMinutes: 0, familiar: false, early: false, fresh: false };
  if (next.lastMinute > at || next.lastVisitMinute > at) { next.lastMinute = at; next.lastVisitMinute = at; }
  // Clock rollback/future imported data cannot become a long-absence reward.
  const gapMinutes = next.lastMinute > 0 && at >= next.lastMinute ? Math.min(43_200, at - next.lastMinute) : 0;
  const fresh = !next.lastVisitMinute || at - next.lastVisitMinute >= 20;
  const familiar = next.hours[hour] >= 3;
  const peak = next.hours.indexOf(Math.max(...next.hours));
  const early = Math.max(...next.hours) >= 3 && hour < peak && peak - hour >= 4;
  if (gapMinutes > 43_199) { next.hours = next.hours.map(n => Math.floor(n / 2)); next.homeHours = next.homeHours.map(n => Math.floor(n / 2)); }
  if (fresh) {
    const day = Math.floor(Date.parse(kstDayKey(wallTime)) / 86_400_000);
    if (next.hourDays[hour] !== day) { next.hours[hour] = Math.min(12, next.hours[hour] + 1); next.hourDays[hour] = day; }
    next.lastVisitMinute = at;
  }
  next.lastMinute = at;
  return { memory: next, gapMinutes, familiar, early, fresh };
}
/** Explicit load/flush boundaries only, never on a frame or an absent timer. */
export function createCompanionSceneStore(storage?: Pick<Storage, "getItem" | "setItem">) {
  let loaded = false, memory = newCompanionSceneMemory(), last = "";
  return {
    load(enabled = true) {
      if (!enabled) return newCompanionSceneMemory();
      if (!loaded) { loaded = true; try { const raw = storage?.getItem(COMPANION_SCENE_MEMORY_KEY); if (raw && raw.length <= 8192) memory = normalizeCompanionSceneMemory(JSON.parse(raw)); } catch { /* unavailable storage is a local no-op */ } last = JSON.stringify(memory); }
      return normalizeCompanionSceneMemory(memory);
    },
    save(value: CompanionSceneMemory, enabled = true) {
      if (!enabled) return;
      memory = normalizeCompanionSceneMemory(value); const raw = JSON.stringify(memory);
      if (raw === last) return;
      try { storage?.setItem(COMPANION_SCENE_MEMORY_KEY, raw); last = raw; } catch { /* retain dirty local state for the next established flush */ }
    },
  };
}

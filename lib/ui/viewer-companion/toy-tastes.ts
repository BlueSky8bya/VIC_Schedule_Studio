import { COMPANION_TOY_KINDS, isCompanionToyKind, type CompanionToyKind } from "./toy-catalog";
import { COMPANION_FOOD_KINDS, isCompanionFoodKind, type CompanionFoodKind } from "./snacks";
import { getCompanionFoodPreference, type CompanionLife } from "./life";
import type { CompanionPreferences } from "./preferences";
import type { CompanionBrain } from "./brain";

export const COMPANION_TASTES_KEY = "vic.viewerCompanionTastes";
export const COMPANION_TASTES_EVENT = "vic:companion-tastes";
export type CompanionToyExperience = "taken-out" | "played" | "tidied" | "declined";
type Taste = { score: number; accepted: number; declined: number };
export type CompanionTastes = { version: 1; toys: CompanionToyKind[]; seen: CompanionToyKind[]; toyTastes: Partial<Record<CompanionToyKind, Taste>>; foodTastes: Partial<Record<CompanionFoodKind, Taste>> };
type TasteStorage = Pick<Storage, "getItem" | "setItem">;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(31, Math.floor(value))) : 0;
const score = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
function tastes<K extends string>(keys: readonly K[], value: unknown): Partial<Record<K, Taste>> {
  const source = object(value), result: Partial<Record<K, Taste>> = {};
  for (const key of keys) { const item = object(source[key]), accepted = count(item.accepted), declined = count(item.declined); if (accepted || declined) result[key] = { score: score(item.score), accepted, declined }; }
  return result;
}
/** No dates, instance IDs, arbitrary strings or account/schedule data survive. */
export function normalizeCompanionTastes(value: unknown): CompanionTastes {
  const source = object(value);
  if (source.version !== 1) return { version: 1, toys: [], seen: [], toyTastes: {}, foodTastes: {} };
  const toys = COMPANION_TOY_KINDS.filter(kind => Array.isArray(source.toys) && source.toys.includes(kind));
  const toyTastes = tastes(COMPANION_TOY_KINDS, source.toyTastes);
  for (const kind of COMPANION_TOY_KINDS) if (!toys.includes(kind)) delete toyTastes[kind];
  return { version: 1, toys, seen: toys.filter(kind => Array.isArray(source.seen) && source.seen.includes(kind)), toyTastes, foodTastes: tastes(COMPANION_FOOD_KINDS, source.foodTastes) };
}
const copy = (value: CompanionTastes) => normalizeCompanionTastes(value);
const changeTaste = (previous: Taste | undefined, positive: boolean): Taste => {
  const before = previous ?? { score: 0, accepted: 0, declined: 0 };
  return { score: before.score + .25 * ((positive ? 1 : -1) - before.score), accepted: Math.min(31, before.accepted + Number(positive)), declined: Math.min(31, before.declined + Number(!positive)) };
};
export function companionToyUnread(value: CompanionTastes | null | undefined) { return value?.toys.filter(kind => !value.seen.includes(kind)).length ?? 0; }
export function summarizeCompanionToyTastes(value: CompanionTastes | null | undefined) {
  const entries = COMPANION_TOY_KINDS.filter(kind => value?.toys.includes(kind) && value.toyTastes[kind]);
  const favorite = entries.filter(kind => value!.toyTastes[kind]!.accepted >= 2 && value!.toyTastes[kind]!.score >= .35).sort((a, b) => value!.toyTastes[b]!.score - value!.toyTastes[a]!.score)[0] ?? null;
  const disliked = entries.filter(kind => value!.toyTastes[kind]!.declined >= 2 && value!.toyTastes[kind]!.score <= -.35).sort((a, b) => value!.toyTastes[a]!.score - value!.toyTastes[b]!.score)[0] ?? null;
  return { favorite, disliked };
}
/** A planner may propose an actual short push-away only for a repeatedly
 * played toy and present tired/disinterested needs. This is not an experience
 * by itself: the caller records declined only after its visible clip ends. */
export function shouldDeclineCompanionToy(kind: CompanionToyKind, value: CompanionTastes | null | undefined, preferences: Pick<CompanionPreferences, "personality" | "learnFromYou">, brain: Pick<CompanionBrain, "energy" | "curiosity">) {
  return isCompanionToyKind(kind) && preferences.personality !== "tidy" && preferences.learnFromYou !== false && (value?.toyTastes[kind]?.accepted ?? 0) >= 3 && Number.isFinite(brain.energy) && Number.isFinite(brain.curiosity) && brain.energy < .42 && brain.curiosity < .35;
}
/** Familiar repetition plus low present interest may earn a visible refusal;
 * fullness, an unknown snack or the authored favorite alone never does. */
export function shouldDeclineCompanionFood(kind: CompanionFoodKind, value: CompanionTastes | null | undefined, preferences: Pick<CompanionPreferences, "enabled" | "feeding" | "learnFromYou">, brain: Pick<CompanionBrain, "life" | "hunger" | "curiosity">, knownFoods: readonly CompanionFoodKind[]) {
  return isCompanionFoodKind(kind) && preferences.enabled && preferences.feeding && preferences.learnFromYou !== false && knownFoods.includes(kind)
    && (value?.foodTastes[kind]?.accepted ?? 0) >= 3 && (brain.life?.familiarity[kind] ?? 0) >= .6 && brain.life?.favoriteFood !== kind
    && Number.isFinite(brain.hunger) && brain.hunger < .65 && Number.isFinite(brain.curiosity) && brain.curiosity < .35;
}
/** Existing life keeps its authored first preference, without unlocking its
 * food-book entry. A negative claim needs repeated real familiar-food refusals. */
export function summarizeCompanionFoodTastes(value: CompanionTastes | null | undefined, life: CompanionLife | undefined, consumed: readonly CompanionFoodKind[] = []) {
  const known = COMPANION_FOOD_KINDS.filter(kind => consumed.includes(kind));
  const disliked = known.filter(kind => (value?.foodTastes[kind]?.declined ?? 0) >= 2 && (value?.foodTastes[kind]?.score ?? 0) <= -.35).sort((a, b) => value!.foodTastes[a]!.score - value!.foodTastes[b]!.score)[0] ?? null;
  const favorite = life && life.favoriteFood !== disliked ? life.favoriteFood : known.filter(kind => kind !== disliked).sort((a, b) => getCompanionFoodPreference(life, b) - getCompanionFoodPreference(life, a))[0] ?? null;
  return { favorite, disliked };
}

/** Event boundaries only: no clock, active tick, passive decay or away debt. */
export function createCompanionTastesStore(storage?: TasteStorage, notify?: (value: CompanionTastes) => void) {
  let memory = normalizeCompanionTastes(undefined), rawSeen: string | null | undefined, initialized = false;
  const synchronize = (raw: string | null) => {
    const previous = JSON.stringify(memory); let parsed: unknown;
    try { parsed = raw && raw.length <= 16384 ? JSON.parse(raw) : undefined; } catch { parsed = undefined; }
    memory = normalizeCompanionTastes(parsed); initialized = true; rawSeen = raw;
    if (JSON.stringify(memory) !== previous) notify?.(copy(memory));
    return copy(memory);
  };
  const refresh = () => { try { const raw = storage?.getItem(COMPANION_TASTES_KEY) ?? null; if (!initialized || raw !== rawSeen) synchronize(raw); } catch { initialized = true; } };
  const commit = (next: CompanionTastes) => {
    if (JSON.stringify(next) === JSON.stringify(memory)) return false;
    memory = next;
    try { const raw = JSON.stringify(memory); storage?.setItem(COMPANION_TASTES_KEY, raw); if (storage) rawSeen = raw; } catch { /* Keep this tab's witnessed experience through quota failures. */ }
    notify?.(copy(memory)); return true;
  };
  return {
    load() { refresh(); return copy(memory); }, synchronize,
    recordToy(kind: CompanionToyKind, outcome: CompanionToyExperience, learn = true) {
      if (!isCompanionToyKind(kind) || !["taken-out", "played", "tidied", "declined"].includes(outcome)) return false;
      refresh();
      const next = copy(memory); if (!next.toys.includes(kind)) next.toys = COMPANION_TOY_KINDS.filter(id => id === kind || next.toys.includes(id));
      // Taking out or putting away proves discovery, never dislike or liking.
      if (learn && (outcome === "played" || outcome === "declined")) next.toyTastes[kind] = changeTaste(next.toyTastes[kind], outcome === "played");
      return commit(next);
    },
    recordFood(kind: CompanionFoodKind, reaction: "accepted" | "declined", learn = true) {
      if (!learn || !isCompanionFoodKind(kind) || !["accepted", "declined"].includes(reaction)) return false;
      refresh(); const next = copy(memory); next.foodTastes[kind] = changeTaste(next.foodTastes[kind], reaction === "accepted"); return commit(next);
    },
    acknowledge(kind: CompanionToyKind) {
      if (!isCompanionToyKind(kind)) return false;
      refresh(); if (!memory.toys.includes(kind) || memory.seen.includes(kind)) return false;
      return commit({ ...memory, seen: COMPANION_TOY_KINDS.filter(id => id === kind || memory.seen.includes(id)) });
    },
    resetPreferences() { refresh(); return commit({ ...memory, toyTastes: {}, foodTastes: {} }); },
  };
}
let owner: Window | undefined, device: ReturnType<typeof createCompanionTastesStore> | undefined;
function store() {
  if (typeof window === "undefined") return;
  if (owner !== window || !device) { owner = window; let storage: Storage | undefined; try { storage = window.localStorage; } catch { /* Volatile experience. */ } device = createCompanionTastesStore(storage, value => window.dispatchEvent(new CustomEvent(COMPANION_TASTES_EVENT, { detail: value }))); }
  return device;
}
export function loadCompanionTastes() { return store()?.load() ?? normalizeCompanionTastes(undefined); }
export function recordCompanionToyExperience(kind: CompanionToyKind, outcome: CompanionToyExperience, learn = true) { return store()?.recordToy(kind, outcome, learn) ?? false; }
export function recordCompanionFoodTaste(kind: CompanionFoodKind, reaction: "accepted" | "declined", learn = true) { return store()?.recordFood(kind, reaction, learn) ?? false; }
export function acknowledgeCompanionToy(kind: CompanionToyKind) { return store()?.acknowledge(kind) ?? false; }
export function resetCompanionTastes() { return store()?.resetPreferences() ?? false; }
export function getCompanionToyPreference(kind: CompanionToyKind) { return store()?.load().toyTastes[kind]?.score ?? 0; }
export function subscribeCompanionTastes(listener: (value: CompanionTastes) => void) {
  if (typeof window === "undefined") return () => {};
  const changed = (event: Event) => listener(copy((event as CustomEvent<CompanionTastes>).detail));
  const external = (event: StorageEvent) => { if (event.key === COMPANION_TASTES_KEY || event.key === null) store()?.synchronize(event.key === null ? null : event.newValue); };
  window.addEventListener(COMPANION_TASTES_EVENT, changed); window.addEventListener("storage", external);
  return () => { window.removeEventListener(COMPANION_TASTES_EVENT, changed); window.removeEventListener("storage", external); };
}

import { COMPANION_TOY_KINDS, isCompanionToyKind, type CompanionToyKind } from "./toy-catalog";
import { COMPANION_FOOD_KINDS, isCompanionFoodKind, type CompanionFoodKind } from "./snacks";
import { getCompanionFoodPreference, type CompanionLife } from "./life";
import type { CompanionPreferences } from "./preferences";
import type { CompanionBrain } from "./brain";
import { COMPANION_TASTE_REASON_TEXT, companionInnateFoodReason, companionToyTasteReason, isCompanionFoodTasteOutcome, isCompanionToyTasteReason, isPositiveCompanionTasteReason, type CompanionFoodTasteOutcome, type CompanionFoodTasteReason, type CompanionTasteReason, type CompanionToyTasteReason } from "./taste-reasons";

export const COMPANION_TASTES_KEY = "vic.viewerCompanionTastes";
export const COMPANION_TASTES_EVENT = "vic:companion-tastes";
/**143 expands the finite catalogue from204 to300 identities. The previous
 *16KiB parser could discard this store's own valid earned state on reload.
 *24KiB retains all bounded records+8 reasons; malformed/oversized data still
 *fails closed. The limit is UTF-8 bytes, not JavaScript string length. */
export const COMPANION_TASTES_MAX_BYTES = 24 * 1024;
export type CompanionToyExperience = "taken-out" | "played" | "tidied" | "declined" | "tripped";
type Taste = { score: number; accepted: number; declined: number; tripped?: number };
export type CompanionTasteMemory = { domain: "food"; kind: CompanionFoodKind; reason: CompanionFoodTasteReason; age: number } | { domain: "toy"; kind: CompanionToyKind; reason: CompanionToyTasteReason; age: number };
export type CompanionTastes = { version: 1; toys: CompanionToyKind[]; seen: CompanionToyKind[]; toyTastes: Partial<Record<CompanionToyKind, Taste>>; foodTastes: Partial<Record<CompanionFoodKind, Taste>>; reasons: CompanionTasteMemory[] };
type TasteStorage = Pick<Storage, "getItem" | "setItem">;
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(31, Math.floor(value))) : 0;
const score = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? Math.round(Math.max(-1, Math.min(1, value)) * 10000) / 10000 : 0;
const REASON_STEPS = 240; // Twenty active minutes, in the existing five-second buckets.
function tastes<K extends string>(keys: readonly K[], value: unknown): Partial<Record<K, Taste>> {
  const source = object(value), result: Partial<Record<K, Taste>> = {};
  for (const key of keys) { const item = object(source[key]), accepted = count(item.accepted), declined = count(item.declined), tripped = count(item.tripped); if (accepted || declined || tripped) result[key] = { score: score(item.score), accepted, declined, ...(tripped ? { tripped } : {}) }; }
  return result;
}
/** No dates, instance IDs, arbitrary strings or account/schedule data survive. */
export function normalizeCompanionTastes(value: unknown): CompanionTastes {
  const source = object(value);
  if (source.version !== 1) return { version: 1, toys: [], seen: [], toyTastes: {}, foodTastes: {}, reasons: [] };
  const toys = COMPANION_TOY_KINDS.filter(kind => Array.isArray(source.toys) && source.toys.includes(kind));
  const toyTastes = tastes(COMPANION_TOY_KINDS, source.toyTastes);
  for (const kind of COMPANION_TOY_KINDS) if (!toys.includes(kind)) delete toyTastes[kind];
  const reasons: CompanionTasteMemory[] = [];
  for (const value of Array.isArray(source.reasons) ? source.reasons.slice(-32) : []) {
    const item = object(value), age = typeof item.age === "number" && Number.isFinite(item.age) ? Math.max(0, Math.floor(item.age)) : 0;
    if (age >= REASON_STEPS) continue;
    if (item.domain === "toy" && isCompanionToyKind(item.kind) && toys.includes(item.kind) && isCompanionToyTasteReason(item.kind, item.reason)) reasons.push({ domain: "toy", kind: item.kind, reason: item.reason, age });
    else if (item.domain === "food" && isCompanionFoodKind(item.kind)) {
      const reason = item.reason as CompanionFoodTasteReason;
      if (isCompanionFoodTasteOutcome({ food: item.kind, reason, reaction: "liked" }) || isCompanionFoodTasteOutcome({ food: item.kind, reason, reaction: "disliked" })) reasons.push({ domain: "food", kind: item.kind, reason, age });
    }
  }
  return { version: 1, toys, seen: toys.filter(kind => Array.isArray(source.seen) && source.seen.includes(kind)), toyTastes, foodTastes: tastes(COMPANION_FOOD_KINDS, source.foodTastes), reasons: reasons.slice(-8) };
}
const copy = (value: CompanionTastes) => normalizeCompanionTastes(value);
const changeTaste = (previous: Taste | undefined, positive: boolean): Taste => {
  const before = previous ?? { score: 0, accepted: 0, declined: 0 };
  return { score: score(before.score + (positive ? .5 : .65) * ((positive ? 1 : -1) - before.score)), accepted: Math.min(31, before.accepted + Number(positive)), declined: before.declined, ...((before.tripped ?? 0) || !positive ? { tripped: Math.min(31, (before.tripped ?? 0) + Number(!positive)) } : {}) };
};
const remember = (value: CompanionTastes, reason: CompanionTasteMemory) => { value.reasons = [...value.reasons.filter(item => item.domain !== reason.domain || item.kind !== reason.kind), reason].slice(-8); };
export function companionTasteReason(value: CompanionTastes | null | undefined, domain: "food" | "toy", kind: CompanionFoodKind | CompanionToyKind | null | undefined, valence?: "positive" | "negative"): string | undefined {
  const entry = kind && value?.reasons.filter(item => item.domain === domain && item.kind === kind).at(-1);
  if (entry && valence && isPositiveCompanionTasteReason(entry.reason) !== (valence === "positive")) return;
  return entry ? COMPANION_TASTE_REASON_TEXT[entry.reason as CompanionTasteReason] : undefined;
}
export function companionProfileTasteReason(value: CompanionTastes | null | undefined, domain: "food" | "toy", kind: CompanionFoodKind | CompanionToyKind | null | undefined, valence: "positive" | "negative", life?: CompanionLife): string | undefined {
  if (!kind) return;
  const remembered = companionTasteReason(value, domain, kind, valence);
  if (remembered) return remembered;
  if (domain === "food" && isCompanionFoodKind(kind)) {
    if (valence === "positive" && life?.seedFood === kind && !life.tastedFoods.includes(kind)) return companionInnateFoodReason(kind);
    if (life?.tastedFoods.includes(kind)) return valence === "positive" ? "먹어 보고 마음에 들었어요" : "예전엔 입맛에 잘 안 맞았어요";
    if (valence === "positive" && life?.favoriteFood === kind) return "예전부터 좋아하던 간식이에요";
  }
  if (domain === "toy" && isCompanionToyKind(kind)) {
    const prior = value?.toyTastes[kind];
    if (valence === "positive" && prior && prior.accepted > 0) return prior.accepted >= 3 ? "여러 번 놀아서 정들었어요" : "같이 놀아 보니 마음에 들어요";
    if (valence === "negative" && prior?.tripped) return "전에 걸려 넘어져 조심해요";
  }
}
export function companionToyUnread(value: CompanionTastes | null | undefined) { return value?.toys.filter(kind => !value.seen.includes(kind)).length ?? 0; }
export function summarizeCompanionToyTastes(value: CompanionTastes | null | undefined) {
  const entries = COMPANION_TOY_KINDS.filter(kind => value?.toys.includes(kind) && value.toyTastes[kind]);
  const recency = (kind: CompanionToyKind) => value?.reasons.findIndex(reason => reason.domain === "toy" && reason.kind === kind) ?? -1;
  const favorite = entries.filter(kind => value!.toyTastes[kind]!.accepted >= 1 && value!.toyTastes[kind]!.score >= .35).sort((a, b) => value!.toyTastes[b]!.score - value!.toyTastes[a]!.score || recency(b) - recency(a))[0] ?? null;
  const disliked = entries.filter(kind => (value!.toyTastes[kind]!.tripped ?? 0) >= 1 && value!.toyTastes[kind]!.score <= -.35).sort((a, b) => value!.toyTastes[a]!.score - value!.toyTastes[b]!.score)[0] ?? null;
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
/** Existing life keeps its authored first preference without unlocking its
 * food-book entry. Aversion needs a consumed, tasted meal; refusals do not count. */
export function summarizeCompanionFoodTastes(_value: CompanionTastes | null | undefined, life: CompanionLife | undefined, consumed: readonly CompanionFoodKind[] = []) {
  const known = COMPANION_FOOD_KINDS.filter(kind => consumed.includes(kind));
  const disliked = known.filter(kind => life?.tastedFoods.includes(kind) && life.foodScores[kind] <= .35).sort((a, b) => life!.foodScores[a] - life!.foodScores[b])[0] ?? null;
  const favorite = life && life.favoriteFood !== disliked && (!life.tastedFoods.includes(life.favoriteFood) || life.foodScores[life.favoriteFood] >= .5) ? life.favoriteFood : known.filter(kind => kind !== disliked && (life?.foodScores[kind] ?? .5) > .5).sort((a, b) => getCompanionFoodPreference(life, b) - getCompanionFoodPreference(life, a))[0] ?? null;
  return { favorite, disliked };
}

/** No wall clock or away debt. The host supplies its existing active-time
 * samples; only a five-second bucket touches these bounded records. */
export function createCompanionTastesStore(storage?: TasteStorage, notify?: (value: CompanionTastes) => void) {
  let memory = normalizeCompanionTastes(undefined), rawSeen: string | null | undefined, initialized = false, activeCredit = 0;
  const synchronize = (raw: string | null) => {
    const previous = JSON.stringify(memory); let parsed: unknown;
    try { parsed = raw && raw.length <= COMPANION_TASTES_MAX_BYTES && new TextEncoder().encode(raw).byteLength <= COMPANION_TASTES_MAX_BYTES ? JSON.parse(raw) : undefined; } catch { parsed = undefined; }
    memory = normalizeCompanionTastes(parsed); initialized = true; rawSeen = raw; activeCredit = 0;
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
      if (!isCompanionToyKind(kind) || !["taken-out", "played", "tidied", "declined", "tripped"].includes(outcome)) return false;
      refresh();
      // A spawned/returned/tripped-over object is not a collected toy. Only
      // the pet's completed, witnessed play ACK may add a new identity; keep
      // all existing discoveries, including readable older saved histories.
      if (!memory.toys.includes(kind) && outcome !== "played") return false;
      const next = copy(memory); if (!next.toys.includes(kind)) next.toys = COMPANION_TOY_KINDS.filter(id => id === kind || next.toys.includes(id));
      if (learn && (outcome === "played" || outcome === "tripped")) {
        next.toyTastes[kind] = changeTaste(next.toyTastes[kind], outcome === "played");
        remember(next, { domain: "toy", kind, reason: companionToyTasteReason(kind, outcome, outcome === "played" ? next.toyTastes[kind]!.accepted : next.toyTastes[kind]!.tripped ?? 0), age: 0 });
      }
      return commit(next);
    },
    recordFood(kind: CompanionFoodKind, reaction: "accepted" | "declined", learn = true) {
      if (!learn || !isCompanionFoodKind(kind) || !["accepted", "declined"].includes(reaction)) return false;
      // Legacy callers may still report a completed refusal. It is not a new
      // food aversion and must not write a sensory reason or choice score.
      if (reaction === "declined") return false;
      refresh(); const next = copy(memory), previous = next.foodTastes[kind] ?? { score: 0, accepted: 0, declined: 0 };
      next.foodTastes[kind] = { ...previous, accepted: Math.min(31, previous.accepted + 1) }; return commit(next);
    },
    recordFoodOutcome(outcome: CompanionFoodTasteOutcome, learn = true) {
      if (!learn || !isCompanionFoodTasteOutcome(outcome)) return false;
      refresh(); const next = copy(memory), previous = next.foodTastes[outcome.food] ?? { score: 0, accepted: 0, declined: 0 };
      next.foodTastes[outcome.food] = { ...previous, accepted: Math.min(31, previous.accepted + Number(outcome.reaction !== "disliked")), declined: Math.min(31, previous.declined + Number(outcome.reaction === "disliked")) };
      remember(next, { domain: "food", kind: outcome.food, reason: outcome.reason, age: 0 }); return commit(next);
    },
    advanceActive(elapsedMs: number, learn = true) {
      if (!learn || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return false;
      if (!initialized) refresh();
      activeCredit += Math.min(30000, elapsedMs);
      const steps = Math.floor(activeCredit / 5000); if (!steps) return false;
      activeCredit -= steps * 5000;
      const next = copy(memory), fade = 2 ** (-steps * 5000 / 1200000);
      for (const kind of COMPANION_TOY_KINDS) { const taste = next.toyTastes[kind]; if (taste) taste.score = score(taste.score * fade); }
      next.reasons = next.reasons.map(reason => ({ ...reason, age: reason.age + steps })).filter(reason => reason.age < REASON_STEPS);
      return commit(next);
    },
    acknowledge(kind: CompanionToyKind) {
      if (!isCompanionToyKind(kind)) return false;
      refresh(); if (!memory.toys.includes(kind) || memory.seen.includes(kind)) return false;
      return commit({ ...memory, seen: COMPANION_TOY_KINDS.filter(id => id === kind || memory.seen.includes(id)) });
    },
    resetPreferences() { refresh(); activeCredit = 0; return commit({ ...memory, toyTastes: {}, foodTastes: {}, reasons: [] }); },
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
export function recordCompanionFoodTasteOutcome(outcome: CompanionFoodTasteOutcome, learn = true) { return store()?.recordFoodOutcome(outcome, learn) ?? false; }
export function advanceCompanionTastes(elapsedActiveMs: number, learn = true) { return store()?.advanceActive(elapsedActiveMs, learn) ?? false; }
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

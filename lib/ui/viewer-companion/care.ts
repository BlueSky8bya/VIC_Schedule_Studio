import { DEFAULT_COMPANION_HABITS, normalizeCompanionHabits, type CompanionHabits } from "./habits";
import { createCompanionLife, DEFAULT_COMPANION_LIFE, normalizeCompanionLife, resetCompanionLife, summarizeCompanionLife, type CompanionLife } from "./life";
import { getCompanionLearnedEffectDirections } from "./behavior-profile";
import { COMPANION_PERSONALITIES } from "./preferences";

/** Device-local needs only. No identity, schedule text, dates or elapsed-away
 * timestamp is retained: an absent owner never incurs hunger or care debt. */
export type CompanionCare = { hunger: number; affection: number; energy: number; curiosity: number };
export type CompanionMemory = CompanionCare & { habits: CompanionHabits; life: CompanionLife };
type CompanionCareInput = CompanionCare & { habits?: CompanionHabits; life?: CompanionLife };
export const COMPANION_CARE_KEY = "vic.viewerCompanionCare";
export const COMPANION_HABITS_EVENT = "vic:companion-habits";
export const COMPANION_LIFE_EVENT = "vic:companion-life";
export const DEFAULT_COMPANION_CARE: Readonly<CompanionCare> = Object.freeze({ hunger: .58, affection: .3, energy: .8, curiosity: .7 });
export const DEFAULT_COMPANION_MEMORY: Readonly<CompanionMemory> = Object.freeze({ ...DEFAULT_COMPANION_CARE, habits: DEFAULT_COMPANION_HABITS, life: DEFAULT_COMPANION_LIFE });
export const COMPANION_FULL_THRESHOLD = .35;
const fields = ["hunger", "affection", "energy", "curiosity"] as const;

export function normalizeCompanionCare(value: unknown, base: Readonly<CompanionCare> = DEFAULT_COMPANION_CARE): CompanionCare {
  const next = { ...base };
  if (!value || typeof value !== "object" || Array.isArray(value)) return next;
  const source = value as Record<string, unknown>;
  for (const field of fields) if (typeof source[field] === "number" && Number.isFinite(source[field])) next[field] = Math.max(0, Math.min(1, source[field]));
  return next;
}
type CareStorage = Pick<Storage, "getItem" | "setItem">;
const copyMemory = (memory: CompanionMemory): CompanionMemory => ({ ...memory, habits: { ...memory.habits }, life: normalizeCompanionLife(memory.life) });
const freshMemory = (): CompanionMemory => copyMemory(DEFAULT_COMPANION_MEMORY);
const nextGeneration = (generation: number) => Math.min(Number.MAX_SAFE_INTEGER, generation + 1);

const lifeSignature = (life: CompanionLife) => {
  const summary = summarizeCompanionLife(life);
  // Notify at the exact qualitative boundaries shown by the shared traits
  // card. A numeric bucket can otherwise miss a visible category transition.
  const category = (value: number) => value <= .35 ? "low" : value >= .65 ? "high" : "balanced";
  return JSON.stringify([life.generation, summary.favoriteFood, ...[summary.play, summary.comfort, summary.social, summary.curiosity].map(category), life.social >= .4, life.comfort >= .6, life.play >= .45, life.curiosity >= .4, life.recent]);
};
const effectPreferences = (["default", "cat", "dog"] as const).flatMap(animalMode => COMPANION_PERSONALITIES.flatMap(personality => (["relaxed", "normal", "lively"] as const).map(speed => ({ animalMode, personality, speed }))));

/** Injectable store keeps quota failures and throttling testable without a DOM.
 * An external clear/change wins; an unchanged stale value after a failed write
 * does not erase the current tab's latest feeding or petting. */
export function createCompanionCareStore(storage?: CareStorage, clock: () => number = () => performance.now(), rng: () => number = Math.random, onLifeChange?: (life: CompanionLife) => void, onHabitsChange?: (habits: CompanionHabits) => void) {
  let memory = freshMemory();
  let seededLife: CompanionLife | undefined;
  let rawSeen: string | null | undefined;
  let readInitialized = false;
  let dirty = false;
  let seedPersistPending = false;
  let lastWrite = -Infinity;
  let effectKey = "", effectSignature = "";
  const habitsSignature = (habits: CompanionHabits) => {
    const key = `${habits.sociability}:${habits.playfulness}:${habits.confidence}`;
    // Credit-only needs saves reuse this cache. Check every supported manual
    // profile without reading preferences/storage at ordinary sample time.
    if (key !== effectKey) { effectKey = key; effectSignature = JSON.stringify(effectPreferences.map(prefs => getCompanionLearnedEffectDirections(prefs, habits))); }
    const category = (value: number) => value >= .12 ? 1 : value <= -.12 ? -1 : 0;
    return JSON.stringify([habits.generation, category(habits.sociability), category(habits.playfulness), category(habits.confidence), effectSignature]);
  };
  const seed = () => seededLife ??= createCompanionLife(rng);
  const flush = () => {
    seedPersistPending = false;
    lastWrite = clock();
    try {
      const { hunger, affection, energy, curiosity } = memory;
      const { sociability, playfulness, confidence, credit, generation } = memory.habits;
      const raw = JSON.stringify({ version: 3, hunger, affection, energy, curiosity, habits: { sociability, playfulness, confidence, credit, generation }, life: normalizeCompanionLife(memory.life) });
      if (storage) { storage.setItem(COMPANION_CARE_KEY, raw); rawSeen = raw; dirty = false; }
    } catch { /* Keep the latest device-local memory through quota failures. */ }
  };
  const synchronize = (raw: string | null, explicitClear = false): CompanionMemory => {
    let source: Record<string, unknown> = {};
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "version" in parsed && [1, 2, 3].includes(parsed.version as number)) source = parsed as Record<string, unknown>;
    } catch { /* Malformed data receives one fresh local seed. */ }
    const habits = source.version === 2 || source.version === 3 ? normalizeCompanionHabits(source.habits) : { ...DEFAULT_COMPANION_HABITS };
    const savedLife = source.version === 3 && source.life && typeof source.life === "object" && !Array.isArray(source.life) ? source.life as Record<string, unknown> : undefined;
    const validSeed = savedLife && typeof savedLife.seedFood === "string" && Object.prototype.hasOwnProperty.call(DEFAULT_COMPANION_LIFE.foodScores, savedLife.seedFood);
    const legacySameGeneration = (source.version === 1 || source.version === 2) && seededLife && rawSeen !== undefined && habits.generation === memory.habits.generation;
    const life = validSeed ? normalizeCompanionLife(savedLife) : normalizeCompanionLife(legacySameGeneration ? memory.life : seed());
    seededLife ??= resetCompanionLife(life, 0);
    life.generation = habits.generation;
    const next: CompanionMemory = { ...normalizeCompanionCare(source), habits, life };
    // A deletion in an already-live store invalidates its earlier brain too.
    // Keep this local reset dirty until its next normal write; unchanged null
    // bytes must not downgrade the reset to the fresh-install generation0.
    const cleared = raw === null && (explicitClear || rawSeen !== undefined && raw !== rawSeen);
    if (cleared) {
      next.habits.generation = nextGeneration(memory.habits.generation);
      next.life = resetCompanionLife(memory.life, next.habits.generation);
    }
    seedPersistPending = rawSeen === undefined && !validSeed;
    memory = next; rawSeen = raw; dirty = cleared || !validSeed; readInitialized = true;
    return copyMemory(memory);
  };
  const load = (): CompanionMemory => {
    readInitialized = true;
    try {
      const raw = storage?.getItem(COMPANION_CARE_KEY) ?? null;
      if (rawSeen === undefined || !dirty || raw !== rawSeen) {
        synchronize(raw);
      }
      rawSeen = raw;
      // Persist the first random seed/migration once so a reload cannot reroll
      // it. Failed storage consumes the same existing five-second budget.
      if (seedPersistPending && clock() - lastWrite >= 5000) flush();
    } catch {
      if (rawSeen === undefined) synchronize(null);
      /* Inaccessible storage keeps this tab's current needs/habits/life. */
    }
    return copyMemory(memory);
  };
  const save = (care: CompanionCareInput, force = false, replacement = false): CompanionMemory => {
    const now = clock(), canWrite = force || now - lastWrite >= 5000;
    if (!readInitialized || canWrite) {
      readInitialized = true;
      try {
        const raw = storage?.getItem(COMPANION_CARE_KEY) ?? null;
        // Check external bytes at initialization or an actual write boundary.
        // Storage events already synchronize intervening changes; ordinary
        // active-time samples must not introduce synchronous reads at4Hz.
        if (rawSeen === undefined || raw !== rawSeen) synchronize(raw);
      } catch {
        if (rawSeen === undefined) synchronize(null);
        /* Reads may be blocked too; preserve the current memory. */
      }
    }
    const previousLife = lifeSignature(memory.life);
    const previousHabits = habitsSignature(memory.habits);
    const incoming = care.habits === undefined ? memory.habits : normalizeCompanionHabits(care.habits);
    // Same-generation experiences may legitimately reproduce identical traits
    // after a reset. Only an old reset generation is stale, never its values.
    const habits = !replacement && incoming.generation !== memory.habits.generation ? memory.habits : incoming;
    const incomingLife = care.life === undefined ? memory.life : normalizeCompanionLife(care.life);
    const life = !replacement && incomingLife.generation !== memory.habits.generation ? memory.life : incomingLife;
    memory = { ...normalizeCompanionCare(care), habits: { ...habits }, life: normalizeCompanionLife(life) };
    dirty = true;
    const lifeChanged = lifeSignature(memory.life) !== previousLife;
    const habitsChanged = habitsSignature(memory.habits) !== previousHabits;
    // Failed writes also consume the ordinary 5s budget. A quota-limited
    // browser must not retry at the actor's 12–30Hz paint rate.
    if (canWrite) flush();
    if (lifeChanged) onLifeChange?.(normalizeCompanionLife(memory.life));
    if (habitsChanged) onHabitsChange?.({ ...memory.habits });
    return copyMemory(memory);
  };
  return {
    load,
    save: (care: CompanionCareInput, force = false) => save(care, force),
    /** Browser-provided bytes win even if getItem is blocked or a dirty local
     * write failed. A storage clear can intentionally repeat the same null. */
    synchronize: (raw: string | null) => synchronize(raw, raw === null),
    resetHabits(): CompanionMemory {
      const current = load(), habits = { ...DEFAULT_COMPANION_HABITS, generation: nextGeneration(current.habits.generation) };
      return save({ ...current, habits, life: resetCompanionLife(current.life, habits.generation) }, true, true);
    },
  };
}

let owner: Window | undefined;
let deviceStore: ReturnType<typeof createCompanionCareStore> | undefined;
const synchronizedEvents = new WeakMap<Event, CompanionMemory>();
function store() {
  if (typeof window === "undefined") return undefined;
  if (owner !== window || !deviceStore) {
    owner = window;
    let storage: CareStorage | undefined;
    try { storage = window.localStorage; } catch { /* Optional device memory only. */ }
    deviceStore = createCompanionCareStore(storage, undefined, undefined, life => window.dispatchEvent(new CustomEvent<CompanionLife>(COMPANION_LIFE_EVENT, { detail: life })), habits => window.dispatchEvent(new CustomEvent<CompanionHabits>(COMPANION_HABITS_EVENT, { detail: habits })));
  }
  return deviceStore;
}
function memoryFromStorageEvent(event: StorageEvent): CompanionMemory | undefined {
  if (event.key !== COMPANION_CARE_KEY && event.key !== null) return undefined;
  const previous = synchronizedEvents.get(event);
  if (previous) return previous;
  const memory = store()?.synchronize(event.key === null ? null : event.newValue);
  if (memory) synchronizedEvents.set(event, memory);
  return memory;
}
export function loadCompanionCare(): CompanionMemory { return store()?.load() ?? freshMemory(); }
/** Call while visible, and force after feeding or on cleanup. No background
 * timers or server writes; ordinary active-time saves flush at most every 5s. */
export function saveCompanionCare(care: CompanionCareInput, force = false): CompanionMemory { return store()?.save(care, force) ?? { ...normalizeCompanionCare(care), habits: normalizeCompanionHabits(care.habits), life: normalizeCompanionLife(care.life) }; }

/** Erases only learned habits. Needs and manually chosen preferences remain. */
export function resetCompanionHabits(): CompanionHabits {
  const habits = store()?.resetHabits().habits ?? { ...DEFAULT_COMPANION_HABITS };
  return { ...habits };
}

/** Only sanitized learned numbers cross this local subscription. Neither a
 * timestamp nor a gesture/history/identity is retained or sent anywhere. */
export function subscribeCompanionHabits(listener: (habits: CompanionHabits) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const changed = (event: Event) => listener(normalizeCompanionHabits((event as CustomEvent<unknown>).detail));
  const stored = (event: StorageEvent) => {
    if (event.key !== COMPANION_CARE_KEY && event.key !== null) return;
    const memory = memoryFromStorageEvent(event);
    listener({ ...(memory?.habits ?? DEFAULT_COMPANION_HABITS) });
  };
  window.addEventListener(COMPANION_HABITS_EVENT, changed);
  window.addEventListener("storage", stored);
  return () => {
    window.removeEventListener(COMPANION_HABITS_EVENT, changed);
    window.removeEventListener("storage", stored);
  };
}

/** Same-device sanitized traits only. Credit-only saves and tiny active-time
 * shifts do not notify; meaningful category/experience changes do. */
export function subscribeCompanionLife(listener: (life: CompanionLife) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const changed = (event: Event) => listener(normalizeCompanionLife((event as CustomEvent<unknown>).detail));
  const stored = (event: StorageEvent) => {
    if (event.key !== COMPANION_CARE_KEY && event.key !== null) return;
    const memory = memoryFromStorageEvent(event);
    listener(normalizeCompanionLife(memory?.life));
  };
  window.addEventListener(COMPANION_LIFE_EVENT, changed);
  window.addEventListener("storage", stored);
  return () => { window.removeEventListener(COMPANION_LIFE_EVENT, changed); window.removeEventListener("storage", stored); };
}

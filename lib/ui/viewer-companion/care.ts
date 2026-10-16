import { DEFAULT_COMPANION_HABITS, normalizeCompanionHabits, type CompanionHabits } from "./habits";

/** Device-local needs only. No identity, schedule text, dates or elapsed-away
 * timestamp is retained: an absent owner never incurs hunger or care debt. */
export type CompanionCare = { hunger: number; affection: number; energy: number; curiosity: number };
export type CompanionMemory = CompanionCare & { habits: CompanionHabits };
type CompanionCareInput = CompanionCare & { habits?: CompanionHabits };
export const COMPANION_CARE_KEY = "vic.viewerCompanionCare";
export const COMPANION_HABITS_EVENT = "vic:companion-habits";
export const DEFAULT_COMPANION_CARE: Readonly<CompanionCare> = Object.freeze({ hunger: .58, affection: .3, energy: .8, curiosity: .7 });
export const DEFAULT_COMPANION_MEMORY: Readonly<CompanionMemory> = Object.freeze({ ...DEFAULT_COMPANION_CARE, habits: DEFAULT_COMPANION_HABITS });
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
const copyMemory = (memory: CompanionMemory): CompanionMemory => ({ ...memory, habits: { ...memory.habits } });
const freshMemory = (): CompanionMemory => copyMemory(DEFAULT_COMPANION_MEMORY);
const nextGeneration = (generation: number) => Math.min(Number.MAX_SAFE_INTEGER, generation + 1);

function parseMemory(raw: string | null): CompanionMemory {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object" || Array.isArray(value) || !("version" in value) || (value.version !== 1 && value.version !== 2)) return freshMemory();
    return { ...normalizeCompanionCare(value), habits: value.version === 2 && "habits" in value ? normalizeCompanionHabits(value.habits) : { ...DEFAULT_COMPANION_HABITS } };
  } catch { return freshMemory(); }
}

/** Injectable store keeps quota failures and throttling testable without a DOM.
 * An external clear/change wins; an unchanged stale value after a failed write
 * does not erase the current tab's latest feeding or petting. */
export function createCompanionCareStore(storage?: CareStorage, clock: () => number = () => performance.now()) {
  let memory = freshMemory();
  let rawSeen: string | null | undefined;
  let readInitialized = false;
  let dirty = false;
  let lastWrite = -Infinity;
  const synchronize = (raw: string | null, explicitClear = false): CompanionMemory => {
    const next = parseMemory(raw);
    // A deletion in an already-live store invalidates its earlier brain too.
    // Keep this local reset dirty until its next normal write; unchanged null
    // bytes must not downgrade the reset to the fresh-install generation0.
    const cleared = raw === null && (explicitClear || rawSeen !== undefined && raw !== rawSeen);
    if (cleared) next.habits.generation = nextGeneration(memory.habits.generation);
    memory = next; rawSeen = raw; dirty = cleared; readInitialized = true;
    return copyMemory(memory);
  };
  const load = (): CompanionMemory => {
    readInitialized = true;
    try {
      const raw = storage?.getItem(COMPANION_CARE_KEY) ?? null;
      if (!dirty || raw !== rawSeen) {
        synchronize(raw);
      }
      rawSeen = raw;
    } catch { /* Inaccessible storage keeps this tab's current needs/habits. */ }
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
      } catch { /* Reads may be blocked too; preserve the current memory. */ }
    }
    const incoming = care.habits === undefined ? memory.habits : normalizeCompanionHabits(care.habits);
    // Same-generation experiences may legitimately reproduce identical traits
    // after a reset. Only an old reset generation is stale, never its values.
    const habits = !replacement && incoming.generation !== memory.habits.generation ? memory.habits : incoming;
    memory = { ...normalizeCompanionCare(care), habits: { ...habits } };
    dirty = true;
    if (!canWrite) return copyMemory(memory);
    // Failed writes also consume the ordinary 5s budget. A quota-limited
    // browser must not retry at the actor's 12–30Hz paint rate.
    lastWrite = now;
    try {
      const { hunger, affection, energy, curiosity } = memory;
      const { sociability, playfulness, confidence, credit, generation } = memory.habits;
      const raw = JSON.stringify({ version: 2, hunger, affection, energy, curiosity, habits: { sociability, playfulness, confidence, credit, generation } });
      if (storage) { storage.setItem(COMPANION_CARE_KEY, raw); rawSeen = raw; dirty = false; }
    } catch { /* A later save retries without reverting to stale care/habits. */ }
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
      return save({ ...current, habits }, true, true);
    },
  };
}

let owner: Window | undefined;
let deviceStore: ReturnType<typeof createCompanionCareStore> | undefined;
function store() {
  if (typeof window === "undefined") return undefined;
  if (owner !== window || !deviceStore) {
    owner = window;
    let storage: CareStorage | undefined;
    try { storage = window.localStorage; } catch { /* Optional device memory only. */ }
    deviceStore = createCompanionCareStore(storage);
  }
  return deviceStore;
}
export function loadCompanionCare(): CompanionMemory { return store()?.load() ?? freshMemory(); }
/** Call while visible, and force after feeding or on cleanup. No background
 * timers or server writes; ordinary active-time saves flush at most every 5s. */
export function saveCompanionCare(care: CompanionCareInput, force = false): CompanionMemory { return store()?.save(care, force) ?? { ...normalizeCompanionCare(care), habits: normalizeCompanionHabits(care.habits) }; }

/** Erases only learned habits. Needs and manually chosen preferences remain. */
export function resetCompanionHabits(): CompanionHabits {
  const habits = store()?.resetHabits().habits ?? { ...DEFAULT_COMPANION_HABITS };
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent<CompanionHabits>(COMPANION_HABITS_EVENT, { detail: { ...habits } }));
  return { ...habits };
}

/** Only sanitized learned numbers cross this local subscription. Neither a
 * timestamp nor a gesture/history/identity is retained or sent anywhere. */
export function subscribeCompanionHabits(listener: (habits: CompanionHabits) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const changed = (event: Event) => listener(normalizeCompanionHabits((event as CustomEvent<unknown>).detail));
  const stored = (event: StorageEvent) => {
    if (event.key !== COMPANION_CARE_KEY && event.key !== null) return;
    const memory = store()?.synchronize(event.key === null ? null : event.newValue);
    listener({ ...(memory?.habits ?? DEFAULT_COMPANION_HABITS) });
  };
  window.addEventListener(COMPANION_HABITS_EVENT, changed);
  window.addEventListener("storage", stored);
  return () => {
    window.removeEventListener(COMPANION_HABITS_EVENT, changed);
    window.removeEventListener("storage", stored);
  };
}

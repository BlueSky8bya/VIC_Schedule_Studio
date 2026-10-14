/** Device-local needs only. No identity, schedule text, dates or elapsed-away
 * timestamp is retained: an absent owner never incurs hunger or care debt. */
export type CompanionCare = { hunger: number; affection: number; energy: number; curiosity: number };
export const COMPANION_CARE_KEY = "vic.viewerCompanionCare";
export const DEFAULT_COMPANION_CARE: Readonly<CompanionCare> = Object.freeze({ hunger: .58, affection: .3, energy: .8, curiosity: .7 });
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

/** Injectable store keeps quota failures and throttling testable without a DOM.
 * An external clear/change wins; an unchanged stale value after a failed write
 * does not erase the current tab's latest feeding or petting. */
export function createCompanionCareStore(storage?: CareStorage, clock: () => number = () => performance.now()) {
  let memory = { ...DEFAULT_COMPANION_CARE };
  let rawSeen: string | null | undefined;
  let dirty = false;
  let lastWrite = -Infinity;
  return {
    load(): CompanionCare {
      try {
        const raw = storage?.getItem(COMPANION_CARE_KEY) ?? null;
        if (!dirty || raw !== rawSeen) {
          try {
            const value: unknown = raw ? JSON.parse(raw) : null;
            memory = value && typeof value === "object" && "version" in value && value.version === 1 ? normalizeCompanionCare(value) : { ...DEFAULT_COMPANION_CARE };
          } catch { memory = { ...DEFAULT_COMPANION_CARE }; }
          dirty = false;
        }
        rawSeen = raw;
      } catch { /* Inaccessible storage keeps this tab's current needs. */ }
      return { ...memory };
    },
    save(care: CompanionCare, force = false): CompanionCare {
      if (rawSeen === undefined) {
        try { rawSeen = storage?.getItem(COMPANION_CARE_KEY) ?? null; } catch { /* Reads may be blocked too. */ }
      }
      memory = normalizeCompanionCare(care);
      dirty = true;
      const now = clock();
      if (!force && now - lastWrite < 5000) return { ...memory };
      // Failed writes also consume the ordinary 5s budget. A quota-limited
      // browser must not retry at the actor's 12–30Hz paint rate.
      lastWrite = now;
      try {
        const raw = JSON.stringify({ version: 1, hunger: memory.hunger, affection: memory.affection, energy: memory.energy, curiosity: memory.curiosity });
        if (storage) { storage.setItem(COMPANION_CARE_KEY, raw); rawSeen = raw; dirty = false; }
      } catch { /* A later save retries; never force the pet back to stale care. */ }
      return { ...memory };
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
export function loadCompanionCare(): CompanionCare { return store()?.load() ?? { ...DEFAULT_COMPANION_CARE }; }
/** Call while visible, and force after feeding or on cleanup. No background
 * timers or server writes; ordinary active-time saves flush at most every 5s. */
export function saveCompanionCare(care: CompanionCare, force = false): CompanionCare { return store()?.save(care, force) ?? normalizeCompanionCare(care); }

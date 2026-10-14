/** Device-local companion preferences. No account, schedule data or server calls. */
export type CompanionPreferences = {
  enabled: boolean;
  roam: boolean;
  jump: boolean;
  sleep: boolean;
  heartPrank: boolean;
  ambientPrank: boolean;
  drag: boolean;
  petting: boolean;
  feeding: boolean;
  animalMode: "default" | "cat" | "dog";
  speed: "relaxed" | "normal" | "lively";
  size: "small" | "normal" | "large";
  personality: "curious" | "affectionate" | "sleepy";
};

export const COMPANION_PREFERENCES_KEY = "vic.viewerCompanion";
export const COMPANION_PREFERENCES_EVENT = "vic:viewer-companion";
export const DEFAULT_COMPANION_PREFERENCES: Readonly<CompanionPreferences> = Object.freeze({
  enabled: false,
  roam: true,
  jump: true,
  sleep: true,
  heartPrank: true,
  ambientPrank: true,
  drag: true,
  petting: true,
  feeding: true,
  animalMode: "default",
  speed: "normal",
  size: "normal",
  personality: "curious"
});

const booleanKeys = ["enabled", "roam", "jump", "sleep", "heartPrank", "ambientPrank", "drag", "petting", "feeding"] as const;
let volatilePreferences: CompanionPreferences | undefined;
let lastReadableRaw: string | null | undefined;
let unwritten: { raw: string | null | undefined; owner: Window } | undefined;

/** Explicit allowlist: malformed values never turn the optional companion on. */
export function normalizeCompanionPreferences(value: unknown, base: Readonly<CompanionPreferences> = DEFAULT_COMPANION_PREFERENCES): CompanionPreferences {
  const next = { ...base };
  if (!value || typeof value !== "object" || Array.isArray(value)) return next;
  const source = value as Record<string, unknown>;
  for (const key of booleanKeys) if (typeof source[key] === "boolean") next[key] = source[key];
  if (source.speed === "relaxed" || source.speed === "normal" || source.speed === "lively") next.speed = source.speed;
  if (source.size === "small" || source.size === "normal" || source.size === "large") next.size = source.size;
  if (source.personality === "curious" || source.personality === "affectionate" || source.personality === "sleepy") next.personality = source.personality;
  if (source.animalMode === "default" || source.animalMode === "cat" || source.animalMode === "dog") next.animalMode = source.animalMode;
  return next;
}

function parseStoredPreferences(raw: string | null): CompanionPreferences {
  try {
    const stored: unknown = raw ? JSON.parse(raw) : null;
    return stored && typeof stored === "object" && "version" in stored && stored.version === 1
      ? normalizeCompanionPreferences(stored) : { ...DEFAULT_COMPANION_PREFERENCES };
  } catch { return { ...DEFAULT_COMPANION_PREFERENCES }; }
}

export function getCompanionPreferences(): CompanionPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_COMPANION_PREFERENCES };
  let raw: string | null;
  try { raw = window.localStorage.getItem(COMPANION_PREFERENCES_KEY); }
  catch { return { ...(volatilePreferences ?? DEFAULT_COMPANION_PREFERENCES) }; }
  lastReadableRaw = raw;
  // A quota failure can leave readable but stale bytes behind. Keep this tab's
  // latest choices until a write succeeds or the stored bytes actually change.
  if (unwritten?.owner === window && (unwritten.raw === undefined || unwritten.raw === raw)) return { ...(volatilePreferences ?? DEFAULT_COMPANION_PREFERENCES) };
  unwritten = undefined;
  volatilePreferences = parseStoredPreferences(raw);
  return { ...volatilePreferences };
}

/** A master OFF only changes enabled; every detailed choice survives. */
export function setCompanionPreferences(patch: Partial<CompanionPreferences>): CompanionPreferences {
  const next = normalizeCompanionPreferences(patch, getCompanionPreferences());
  if (typeof window === "undefined") return next;
  volatilePreferences = next;
  try {
    const raw = JSON.stringify({ version: 1, ...next });
    window.localStorage.setItem(COMPANION_PREFERENCES_KEY, raw);
    lastReadableRaw = raw;
    unwritten = undefined;
  } catch {
    unwritten = { raw: lastReadableRaw, owner: window };
  }
  window.dispatchEvent(new CustomEvent<CompanionPreferences>(COMPANION_PREFERENCES_EVENT, { detail: { ...next } }));
  return { ...next };
}

/** Same tab, studio preview and other tabs all observe the same preference. */
export function subscribeCompanionPreferences(listener: (preferences: CompanionPreferences) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const changed = (event: Event) => listener(normalizeCompanionPreferences((event as CustomEvent<unknown>).detail));
  const stored = (event: StorageEvent) => {
    if (event.key === COMPANION_PREFERENCES_KEY || event.key === null) {
      // An explicit change/reset in another tab wins over an unwritten local
      // override, even if its new serialized value equals the previous bytes.
      unwritten = undefined;
      // If reads are blocked as well, the browser-provided newValue still lets
      // the other tab's explicit choice/reset replace our volatile fallback.
      if (event.key === null || event.newValue === null || typeof event.newValue === "string") {
        lastReadableRaw = event.key === null ? null : event.newValue;
        volatilePreferences = parseStoredPreferences(lastReadableRaw);
      }
      listener(getCompanionPreferences());
    }
  };
  window.addEventListener(COMPANION_PREFERENCES_EVENT, changed);
  window.addEventListener("storage", stored);
  return () => {
    window.removeEventListener(COMPANION_PREFERENCES_EVENT, changed);
    window.removeEventListener("storage", stored);
  };
}

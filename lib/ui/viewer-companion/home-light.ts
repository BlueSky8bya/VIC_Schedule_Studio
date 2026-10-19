/** Device-local room choice shared by every home presentation and future
 * companion actions. Only a boolean is retained; no identity or behavior log. */
export const COMPANION_HOME_LIGHT_KEY = "vic.companionHomeLight.v1";
type LightStorage = Pick<Storage, "getItem" | "setItem">;
export function parseCompanionHomeLight(raw: string | null): boolean | undefined {
  try {
    const value = raw && JSON.parse(raw);
    return value?.version === 1 && typeof value.lit === "boolean" ? value.lit : undefined;
  } catch { return undefined; }
}
export function createCompanionHomeLightStore(storage: LightStorage | undefined, dark: () => boolean) {
  let loaded = false, lastRaw: string | null | undefined, value: boolean | undefined, valid = false;
  const listeners = new Set<() => void>();
  const read = () => {
    try {
      const raw = storage?.getItem(COMPANION_HOME_LIGHT_KEY) ?? null;
      if (!loaded || raw !== lastRaw) {
        const saved = parseCompanionHomeLight(raw);
        valid = saved !== undefined; value = saved ?? value ?? !dark(); lastRaw = raw; loaded = true;
      }
    } catch { value ??= !dark(); loaded = true; }
    return value ?? !dark();
  };
  const set = (lit: boolean) => {
    // Retain the readable old raw on a failed write, so a subsequent read
    // cannot resurrect an older choice over this tab's latest decision.
    read(); value = lit; loaded = valid = true;
    const raw = JSON.stringify({ version: 1, lit });
    try { storage?.setItem(COMPANION_HOME_LIGHT_KEY, raw); if (storage) lastRaw = raw; } catch { /* Session choice survives quota/security errors. */ }
    listeners.forEach(listener => listener()); return lit;
  };
  return {
    read, set,
    initialize() { const lit = read(); if (!valid) set(lit); return lit; },
    externalChange() { loaded = valid = false; value = undefined; lastRaw = undefined; listeners.forEach(listener => listener()); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
let device: ReturnType<typeof createCompanionHomeLightStore> | undefined;
function deviceStore() {
  if (!device) {
    let storage: LightStorage | undefined;
    try { storage = window.localStorage; } catch { /* Optional local memory. */ }
    device = createCompanionHomeLightStore(storage, () => document.documentElement.dataset.theme === "dark");
  }
  return device;
}
export const getCompanionHomeLight = () => typeof window === "undefined" ? false : deviceStore().read();
export const getServerCompanionHomeLight = () => false;
export function initializeCompanionHomeLight() { if (typeof window !== "undefined") deviceStore().initialize(); }
let humanPriorityUntil = -Infinity;
export function canCompanionSetHomeLight() { return typeof window !== "undefined" && performance.now() >= humanPriorityUntil; }
export function setCompanionHomeLight(lit: boolean, options: { source?: "human" | "companion" } = {}) {
  if (typeof window === "undefined") return false;
  const at = performance.now();
  if (options.source === "companion" && at < humanPriorityUntil) return false;
  if (options.source !== "companion") humanPriorityUntil = at + 15000;
  deviceStore().set(lit);
  // Existing geometry delivery also synchronizes the sofa's foreground
  // material after React commits. No new observer, clock or animation loop.
  window.dispatchEvent(new Event("vic:companion-home"));
  return true;
}
export function subscribeCompanionHomeLight(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const store = deviceStore(), off = store.subscribe(listener);
  const changed = (event: StorageEvent) => { if (event.key === null || event.key === COMPANION_HOME_LIGHT_KEY) { store.externalChange(); window.dispatchEvent(new Event("vic:companion-home")); } };
  window.addEventListener("storage", changed);
  return () => { off(); window.removeEventListener("storage", changed); };
}

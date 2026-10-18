import { COMPANION_RADIO_TRACKS, type CompanionRadioMood } from "./radio-catalog";
export type CompanionRadioPreferences = { enabled: boolean; volume: number; react: boolean; moods: Record<CompanionRadioMood, boolean>; excludedIds: string[] };
export const COMPANION_RADIO_PREFERENCES_KEY = "vic.companionRadio.v1";
const EVENT = "vic:companion-radio-preferences";
const defaults = (): CompanionRadioPreferences => ({ enabled: true, volume: 35, react: true, moods: { lively: true, graceful: true, calm: true }, excludedIds: [] });
let fallback: CompanionRadioPreferences | undefined;
let unsavedRaw: string | null | undefined;
export function normalizeCompanionRadioPreferences(raw: unknown): CompanionRadioPreferences {
  const value = raw && typeof raw === "object" ? raw as Partial<CompanionRadioPreferences> : {};
  const base = defaults();
  for (const key of ["enabled", "react"] as const) if (typeof value[key] === "boolean") base[key] = value[key];
  if (typeof value.volume === "number" && Number.isFinite(value.volume)) base.volume = Math.round(Math.max(0, Math.min(100, value.volume)));
  for (const key of ["lively", "graceful", "calm"] as const) if (typeof value.moods?.[key] === "boolean") base.moods[key] = value.moods[key];
  if (Array.isArray(value.excludedIds)) base.excludedIds = [...new Set(value.excludedIds.filter(id => typeof id === "string" && COMPANION_RADIO_TRACKS.some(track => track.id === id)))];
  return base;
}
export function getCompanionRadioPreferences(): CompanionRadioPreferences {
  if (typeof window === "undefined") return defaults();
  try { const raw = window.localStorage.getItem(COMPANION_RADIO_PREFERENCES_KEY); if (fallback && unsavedRaw !== undefined && raw === unsavedRaw) return normalizeCompanionRadioPreferences(fallback); unsavedRaw = undefined; return raw ? normalizeCompanionRadioPreferences(JSON.parse(raw)) : defaults(); } catch { return fallback ? normalizeCompanionRadioPreferences(fallback) : defaults(); }
}
export function setCompanionRadioPreferences(patch: Partial<CompanionRadioPreferences>): CompanionRadioPreferences {
  const before = getCompanionRadioPreferences();
  const next = normalizeCompanionRadioPreferences({ ...before, ...patch, moods: { ...before.moods, ...patch.moods } });
  fallback = next;
  if (typeof window !== "undefined") { try { unsavedRaw = window.localStorage.getItem(COMPANION_RADIO_PREFERENCES_KEY); window.localStorage.setItem(COMPANION_RADIO_PREFERENCES_KEY, JSON.stringify(next)); unsavedRaw = undefined; } catch { /* Session-only choice preserves the current mix. */ } window.dispatchEvent(new Event(EVENT)); }
  return next;
}
export function subscribeCompanionRadioPreferences(listener: () => void): () => void {
  const storage = (event: StorageEvent) => { if (event.key === null || event.key === COMPANION_RADIO_PREFERENCES_KEY) { fallback = undefined; unsavedRaw = undefined; listener(); } };
  window.addEventListener(EVENT, listener); window.addEventListener("storage", storage);
  return () => { window.removeEventListener(EVENT, listener); window.removeEventListener("storage", storage); };
}
export function companionRadioPool(preferences = getCompanionRadioPreferences()) { return COMPANION_RADIO_TRACKS.filter(track => preferences.moods[track.mood] && !preferences.excludedIds.includes(track.id)); }

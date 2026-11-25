/** Device-local companion preferences. No account, schedule data or server calls. */
import { normalizeCompanionSoundMuted, type CompanionSoundMoment } from "./sound-moments";
import { companionIndividualityStore, COMPANION_INDIVIDUAL_KEY } from "./individuality-store";

export const COMPANION_PERSONALITIES = ["performer", "curious", "affectionate", "sleepy", "tidy", "mischievous", "gourmet", "homebody", "balanced"] as const;
export type CompanionPersonality = typeof COMPANION_PERSONALITIES[number];
export const COMPANION_PERSONALITY_NAMES: Readonly<Record<CompanionPersonality, string>> = Object.freeze({ curious: "탐험둥이", affectionate: "애교쟁이", sleepy: "잠꾸러기", tidy: "깔끔이", mischievous: "사고뭉치", gourmet: "먹보", performer: "재롱둥이", homebody: "집돌이", balanced: "동글이" });
export const COMPANION_PERSONALITY_SUMMARIES: Readonly<Record<CompanionPersonality, string>> = Object.freeze({
  performer: "소품으로 재롱을 부리고, 일하는 곁에서 응원해요.", curious: "새 장난감과 간식을 살피고, 창밖과 TV를 비교해요.",
  affectionate: "마우스를 따라와 인사하고, 손길을 받으면 행복해해요.", sleepy: "쿠션을 꾹꾹 누르고 하품해요. 밥과 반납은 먼저 마쳐요.",
  tidy: "흩어진 실물을 직접 주워 정리하고, 패드에서 몸을 단장해요.", mischievous: "공을 굴리고 장난감을 쫓아다녀요. 한 번의 소동을 끝까지 즐겨요.",
  gourmet: "실제 간식을 찾아 먹고, 배부르면 아끼는 음식을 집에 옮겨 둬요.", homebody: "집으로 돌아와 커튼·불·TV를 고르고, 놀던 소품도 반납해요.",
  balanced: "탐험·놀이·정리·교감을 골고루 즐기며, 다음 재미로 이어가요.",
});
export type CompanionPreferences = {
  enabled: boolean;
  activeWhileVisible: boolean;
  /** Keep living behind an ordinary in-site window (schedule detail, search,
   * records, settings) instead of resting quietly until it closes. */
  playBehindWindows: boolean;
  roam: boolean;
  jump: boolean;
  sleep: boolean;
  heartPrank: boolean;
  cardPrank: boolean;
  ambientPrank: boolean;
  panelPrank: boolean;
  rarePrank: boolean;
  drag: boolean;
  petting: boolean;
  feeding: boolean;
  /** Direct shared experiences slowly adjust motivation around these choices. */
  learnFromYou: boolean;
  /** Local companion mix; the shared sound master remains authoritative. */
  sound: boolean;
  soundVolume: number;
  soundCare: boolean;
  soundMotion: boolean;
  soundKeepsakes: boolean;
  /** Sounds switched off one by one, under the level (owner 2026-11-20). A
   * record that lacks it reads as none off. */
  soundMuted: readonly CompanionSoundMoment[];
  /** Habits, motivation and gait are independent; no combination replaces the
   * character design, turns another switch on or changes device capability. */
  animalMode: "default" | "cat" | "dog";
  speed: "relaxed" | "normal" | "lively";
  /** Legacy values remain readable; normalization always selects the 92px size. */
  size: "small" | "normal" | "large";
  personality: CompanionPersonality;
};

export const COMPANION_PREFERENCES_KEY = "vic.viewerCompanion";
export const COMPANION_PREFERENCES_EVENT = "vic:viewer-companion";
export const DEFAULT_COMPANION_PREFERENCES: Readonly<CompanionPreferences> = Object.freeze({
  enabled: true,
  // Owner 2026-11-20 (revised): on by default — it only matters while the
  // calendar stays visible on screen and another program has focus. A device
  // that saved a choice keeps it.
  activeWhileVisible: true,
  // Owner 2026-11-20: new, off by default. A record that lacks it reads as off.
  playBehindWindows: false,
  roam: true,
  jump: true,
  sleep: true,
  heartPrank: true,
  cardPrank: true,
  ambientPrank: true,
  panelPrank: true,
  rarePrank: true,
  drag: true,
  petting: true,
  feeding: true,
  learnFromYou: true,
  sound: true,
  soundVolume: 60,
  soundCare: true,
  soundMotion: true,
  soundKeepsakes: true,
  // Owner 2026-11-20: new. Nothing is switched off until the user does it.
  soundMuted: Object.freeze([]) as readonly CompanionSoundMoment[],
  animalMode: "default",
  speed: "normal",
  size: "large",
  personality: "curious"
});

const booleanKeys = ["enabled", "activeWhileVisible", "playBehindWindows", "roam", "jump", "sleep", "heartPrank", "cardPrank", "ambientPrank", "panelPrank", "rarePrank", "drag", "petting", "feeding", "learnFromYou", "sound", "soundCare", "soundMotion", "soundKeepsakes"] as const;
const soundKeys = ["sound", "soundVolume", "soundCare", "soundMotion", "soundKeepsakes", "soundMuted"] as const;
/** A live mix change never restarts the creature's movement/interaction world. */
export function companionWorldPreferencesKey(preferences: Readonly<CompanionPreferences>): string {
  const world: Partial<CompanionPreferences> = { ...preferences };
  for (const key of soundKeys) delete world[key];
  // Read live from a ref by the creature; switching it never restarts its world.
  delete world.playBehindWindows;
  return JSON.stringify(world);
}
let volatilePreferences: CompanionPreferences | undefined;
let lastReadableRaw: string | null | undefined;
let unwritten: { raw: string | null | undefined; owner: Window } | undefined;
type PersonalityChoice = Readonly<{ personality: CompanionPersonality; manual: boolean }>;
type StoredPreferences = Readonly<{ preferences: CompanionPreferences; manualPersonality?: CompanionPersonality }>;
const documentPersonalities = new WeakMap<Window, PersonalityChoice>();
const validPersonality = (value: unknown): value is CompanionPersonality => COMPANION_PERSONALITIES.some(personality => personality === value);

/** Unselected documents draw once; a direct choice stays local until written.
 * Reading alone never writes storage or emits a human action. */
function withDocumentPersonality(preferences: Readonly<CompanionPreferences>): CompanionPreferences {
  let choice = documentPersonalities.get(window);
  const settled = choice?.manual ? undefined : companionIndividualityStore()?.personality();
  if (settled) { choice = { personality: settled, manual: false }; documentPersonalities.set(window, choice); }
  if (!choice) {
    const draw = Math.random(), index = Number.isFinite(draw) ? Math.max(0, Math.min(COMPANION_PERSONALITIES.length - 1, Math.floor(draw * COMPANION_PERSONALITIES.length))) : 0;
    choice = { personality: COMPANION_PERSONALITIES[index], manual: false }; documentPersonalities.set(window, choice);
  }
  return { ...preferences, personality: choice.personality };
}

/** Settle only when an enabled client actually mounts, never during SSR/read. */
export function activateCompanionPersonality(): CompanionPreferences {
  const current = getCompanionPreferences();
  if (typeof window === "undefined" || !current.enabled) return current;
  const chosen = companionIndividualityStore()?.settle(current.personality) ?? current.personality;
  if (!documentPersonalities.get(window)?.manual && chosen !== current.personality) {
    documentPersonalities.set(window, { personality: chosen, manual: false });
    const next = { ...current, personality: chosen };
    window.dispatchEvent(new CustomEvent(COMPANION_PREFERENCES_EVENT, { detail: next }));
    return next;
  }
  return current;
}

/** Explicit manual provenance wins over the separately settled automatic
 * child. Ordinary settings writes never turn an automatic choice into manual. */
function adoptStoredPreferences(stored: StoredPreferences): CompanionPreferences {
  if (stored.manualPersonality) documentPersonalities.set(window, { personality: stored.manualPersonality, manual: true });
  else if (documentPersonalities.get(window)?.manual) documentPersonalities.delete(window);
  return withDocumentPersonality(stored.preferences);
}

/** Explicit allowlist: malformed patches keep the current/default choices.
 * Saved malformed configuration has its own conservative OFF fallback below. */
export function normalizeCompanionPreferences(value: unknown, base: Readonly<CompanionPreferences> = DEFAULT_COMPANION_PREFERENCES): CompanionPreferences {
  const next: CompanionPreferences = { ...base, size: "large" };
  if (!value || typeof value !== "object" || Array.isArray(value)) return next;
  const source = value as Record<string, unknown>;
  for (const key of booleanKeys) if (typeof source[key] === "boolean") next[key] = source[key];
  if (typeof source.soundVolume === "number" && Number.isFinite(source.soundVolume)) next.soundVolume = Math.min(100, Math.max(0, Math.round(source.soundVolume)));
  const muted = normalizeCompanionSoundMuted(source.soundMuted);
  if (muted) next.soundMuted = muted;
  if (source.speed === "relaxed" || source.speed === "normal" || source.speed === "lively") next.speed = source.speed;
  if (validPersonality(source.personality)) next.personality = source.personality;
  if (source.animalMode === "default" || source.animalMode === "cat" || source.animalMode === "dog") next.animalMode = source.animalMode;
  return next;
}

function parseStoredPreferences(raw: string | null): StoredPreferences {
  if (raw === null) return { preferences: { ...DEFAULT_COMPANION_PREFERENCES } };
  try {
    const stored: unknown = JSON.parse(raw);
    if (!stored || typeof stored !== "object" || Array.isArray(stored) || !("version" in stored) || stored.version !== 1) return { preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: false } };
    const next = normalizeCompanionPreferences(stored);
    // A missing field in an otherwise valid old preference record adopts the
    // new default. Explicit ON/OFF remains the user's choice; an invalid master
    // field cannot accidentally turn a corrupt saved record into an opt-in.
    if ("enabled" in stored && typeof stored.enabled !== "boolean") next.enabled = false;
    const source = stored as Record<string, unknown>;
    return { preferences: next, ...(source.personalitySource === "manual" && validPersonality(source.personality) ? { manualPersonality: source.personality } : {}) };
  } catch { return { preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: false } }; }
}

export function getCompanionPreferences(): CompanionPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_COMPANION_PREFERENCES };
  let raw: string | null;
  try { raw = window.localStorage.getItem(COMPANION_PREFERENCES_KEY); }
  catch { return withDocumentPersonality(volatilePreferences ?? DEFAULT_COMPANION_PREFERENCES); }
  lastReadableRaw = raw;
  // A quota failure can leave readable but stale bytes behind. Keep this tab's
  // latest choices until a write succeeds or the stored bytes actually change.
  if (unwritten?.owner === window && (unwritten.raw === undefined || unwritten.raw === raw)) return withDocumentPersonality(volatilePreferences ?? DEFAULT_COMPANION_PREFERENCES);
  unwritten = undefined;
  // The saved record owns every ordinary switch, including master OFF. Only
  // an explicit saved manual choice also owns the next document's personality.
  volatilePreferences = adoptStoredPreferences(parseStoredPreferences(raw));
  return { ...volatilePreferences };
}

/** A master OFF only changes enabled; every detailed choice survives. */
export function setCompanionPreferences(patch: Partial<CompanionPreferences>): CompanionPreferences {
  const current = getCompanionPreferences(), next = normalizeCompanionPreferences(patch, current);
  if (typeof window === "undefined") return next;
  const selected = patch && typeof patch === "object" && !Array.isArray(patch) && Object.prototype.hasOwnProperty.call(patch, "personality") && validPersonality(patch.personality);
  // Unrelated/invalid patches cannot silently turn an automatic draw into a
  // permanent selection. A direct re-selection is deliberately still manual.
  if (selected) documentPersonalities.set(window, { personality: next.personality, manual: true });
  else next.personality = current.personality;
  volatilePreferences = next;
  try {
    const raw = JSON.stringify({ version: 1, ...next, ...(documentPersonalities.get(window)?.manual ? { personalitySource: "manual" } : {}) });
    window.localStorage.setItem(COMPANION_PREFERENCES_KEY, raw);
    lastReadableRaw = raw;
    unwritten = undefined;
  } catch {
    unwritten = { raw: lastReadableRaw, owner: window };
  }
  window.dispatchEvent(new CustomEvent<CompanionPreferences>(COMPANION_PREFERENCES_EVENT, { detail: { ...next } }));
  return { ...next };
}

/** Same-page consumers share the live choice. Saved manual selections and
 * ordinary settings also synchronize across documents, including reset. */
/** Whether this document's character was picked by hand (then it survives a reload). */
export function companionPersonalityIsManual(): boolean {
  if (typeof window === "undefined") return false;
  getCompanionPreferences();
  return documentPersonalities.get(window)?.manual === true;
}
/** Explicit random selection draws once and settles that same child. Ordinary
 * reloads no longer reroll it. All other choices and earned records survive. */
export function releaseCompanionPersonalityChoice(): CompanionPreferences {
  const previous = getCompanionPreferences();
  if (typeof window === "undefined") return previous;
  const draw = Math.random(), index = Number.isFinite(draw) ? Math.max(0, Math.min(COMPANION_PERSONALITIES.length - 1, Math.floor(draw * COMPANION_PERSONALITIES.length))) : 0;
  const current = { ...previous, personality: COMPANION_PERSONALITIES[index] };
  companionIndividualityStore()?.settle(current.personality, true);
  documentPersonalities.set(window, { personality: current.personality, manual: false });
  volatilePreferences = current;
  try {
    const raw = JSON.stringify({ version: 1, ...current });
    window.localStorage.setItem(COMPANION_PREFERENCES_KEY, raw);
    lastReadableRaw = raw; unwritten = undefined;
  } catch { unwritten = { raw: lastReadableRaw, owner: window }; }
  window.dispatchEvent(new CustomEvent<CompanionPreferences>(COMPANION_PREFERENCES_EVENT, { detail: { ...current } }));
  return { ...current };
}
export function subscribeCompanionPreferences(listener: (preferences: CompanionPreferences) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const changed = (event: Event) => listener(withDocumentPersonality(normalizeCompanionPreferences((event as CustomEvent<unknown>).detail)));
  const stored = (event: StorageEvent) => {
    if (event.key === COMPANION_INDIVIDUAL_KEY) {
      companionIndividualityStore()?.synchronize();
      listener(getCompanionPreferences()); return;
    }
    if (event.key === COMPANION_PREFERENCES_KEY || event.key === null) {
      // An explicit change/reset in another tab wins over an unwritten local
      // override, even if its new serialized value equals the previous bytes.
      unwritten = undefined;
      // If reads are blocked as well, the browser-provided newValue still lets
      // the other tab's explicit choice/reset replace our volatile fallback.
      if (event.key === null || event.newValue === null || typeof event.newValue === "string") {
        lastReadableRaw = event.key === null ? null : event.newValue;
        volatilePreferences = adoptStoredPreferences(parseStoredPreferences(lastReadableRaw));
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

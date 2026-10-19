/** Finite local room pictures. This store never starts audio, timers, learning
 * or human activity events; direct and autonomous callers share one state. */
export const COMPANION_HOME_TV_CHANNELS = ["nature", "music", "cooking", "toys", "moon"] as const;
export type CompanionHomeTvChannel = typeof COMPANION_HOME_TV_CHANNELS[number];
export type CompanionHomeTvState = CompanionHomeTvChannel | "off";
export type CompanionHomeTvSource = "human" | "companion";
export const COMPANION_HOME_TV_HUMAN_PRIORITY_MS = 15_000;

const validState = (value: unknown): value is CompanionHomeTvState => value === "off"
  || typeof value === "string" && (COMPANION_HOME_TV_CHANNELS as readonly string[]).includes(value);

/** Session-only state survives room/presentation remounts. A direct selection,
 * including OFF or selecting the same picture, owns the next fifteen seconds.
 * Only calls to this finite store sample the supplied monotonic clock. */
export function createCompanionHomeTvStore(now: () => number = () => performance.now()) {
  let value: CompanionHomeTvState = "off", humanUntil = -Infinity, lastNow = 0;
  const listeners = new Set<() => void>();
  const sample = () => { const at = now(); if (Number.isFinite(at)) lastNow = Math.max(lastNow, at); return lastNow; };
  return {
    read: () => value,
    canChange(source: CompanionHomeTvSource = "companion") { return source === "human" || source === "companion" && sample() >= humanUntil; },
    set(next: CompanionHomeTvState, options: { source?: CompanionHomeTvSource } = {}) {
      const source = options.source ?? "human";
      if (!validState(next) || source !== "human" && source !== "companion") return false;
      const at = sample();
      if (source === "companion" && at < humanUntil) return false;
      if (source === "human") humanUntil = at + COMPANION_HOME_TV_HUMAN_PRIORITY_MS;
      if (next !== value) { value = next; listeners.forEach(listener => listener()); }
      return true;
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}

let session: ReturnType<typeof createCompanionHomeTvStore> | undefined;
const sessionStore = () => session ??= createCompanionHomeTvStore();
export const getCompanionHomeTv = (): CompanionHomeTvState => typeof window === "undefined" ? "off" : sessionStore().read();
export const getServerCompanionHomeTv = (): CompanionHomeTvState => "off";
export const canCompanionSetHomeTv = () => typeof window !== "undefined" && sessionStore().canChange("companion");
export function setCompanionHomeTv(next: CompanionHomeTvState, options: { source?: CompanionHomeTvSource } = {}) {
  if (typeof window === "undefined") return false;
  const store = sessionStore(), previous = store.read(), accepted = store.set(next, options);
  if (accepted && store.read() !== previous) window.dispatchEvent(new Event("vic:companion-home"));
  return accepted;
}
export function subscribeCompanionHomeTv(listener: () => void) {
  return typeof window === "undefined" ? () => undefined : sessionStore().subscribe(listener);
}

const NAMES: Readonly<Record<CompanionHomeTvChannel, string>> = {
  nature: "자연", music: "음악", cooking: "요리", toys: "장난감", moon: "달과 별",
};
/** The option describes the next click before mutation, for one G22 event. */
export function companionHomeTvControl(state: CompanionHomeTvState) {
  const index = state === "off" ? -1 : COMPANION_HOME_TV_CHANNELS.indexOf(state);
  const next: CompanionHomeTvState = index === COMPANION_HOME_TV_CHANNELS.length - 1 ? "off" : COMPANION_HOME_TV_CHANNELS[index + 1];
  const option = state === "off" ? "on" : next === "off" ? "off" : "next";
  const currentName = state === "off" ? "꺼짐" : NAMES[state];
  const label = next === "off" ? `TV ${currentName} · 누르면 끄기`
    : state === "off" ? "TV 꺼짐 · 누르면 자연 채널 켜기" : `TV ${currentName} · 누르면 ${NAMES[next]} 채널`;
  return { next, option, label } as const;
}

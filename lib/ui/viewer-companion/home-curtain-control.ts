export type CompanionCurtainPhase = "open" | "shade" | "closed";
const phases: readonly CompanionCurtainPhase[] = ["open", "shade", "closed"];

/** Session choice, shared by both home presentations. No timer or new local
 * history. Automatic use must wait for the human's fifteen-second lease. */
export function createCompanionCurtainControl(now: () => number = () => performance.now()) {
  let phase: CompanionCurtainPhase = "open", humanUntil = -Infinity, last = 0;
  const listeners = new Set<() => void>();
  const time = () => { const at = now(); if (Number.isFinite(at)) last = Math.max(last, at); return last; };
  return {
    read: () => phase,
    canChange: () => time() >= humanUntil,
    set(next: CompanionCurtainPhase, source: "human" | "companion" = "human") {
      if (!phases.includes(next) || source !== "human" && source !== "companion") return false;
      const at = time();
      if (source === "companion" && at < humanUntil) return false;
      if (source === "human") humanUntil = at + 15000;
      if (next !== phase) { phase = next; listeners.forEach(listener => listener()); }
      return true;
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
let session: ReturnType<typeof createCompanionCurtainControl> | undefined;
const store = () => session ??= createCompanionCurtainControl();
export const getCompanionCurtainChoice = (): CompanionCurtainPhase => typeof window === "undefined" ? "open" : store().read();
export const canCompanionSetCurtain = () => typeof window !== "undefined" && store().canChange();
export function setCompanionCurtainChoice(phase: CompanionCurtainPhase, source: "human" | "companion" = "human") {
  if (typeof window === "undefined") return false;
  const accepted = store().set(phase, source);
  if (accepted) window.dispatchEvent(new Event("vic:companion-home"));
  return accepted;
}
export const subscribeCompanionCurtainChoice = (listener: () => void) => typeof window === "undefined" ? () => undefined : store().subscribe(listener);
export function companionCurtainControl(phase: CompanionCurtainPhase) {
  const next = phases[(phases.indexOf(phase) + 1) % phases.length];
  const names = { open: "열림", shade: "반쯤", closed: "닫힘" };
  return { next, label: `커튼 ${names[phase]} · 누르면 ${next === "open" ? "열기" : next === "shade" ? "반쯤 닫기" : "닫기"}` };
}

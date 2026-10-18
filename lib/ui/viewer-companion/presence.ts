import { COMPANION_TIMING } from "./timing";

/** Visibility and the user's visible-activity choice decide active presence.
 * No clock, timer or DOM ownership here: quiet mode still parks its renderer. */
export type CompanionPresence = "active" | "finishing" | "resting" | "yawning" | "parked" | "waking";
export function companionPresenceActive(input: { focused: boolean; visible: boolean; activeWhileVisible: boolean; blocked?: boolean }) {
  return input.visible && !input.blocked && (input.focused || input.activeWhileVisible);
}
export function createCompanionPresence(focused: boolean, now: number, { autoSleep = true }: { autoSleep?: boolean } = {}) {
  let phase: CompanionPresence = focused ? "active" : "finishing";
  let entered = now;
  return {
    get phase() { return phase; },
    get dreaming() { return autoSleep && phase === "parked"; },
    get pose(): { row: 0 | 10 | 11 | 12; status: "idle" | "yawn" | "sleep" | "wake" } {
      if (!autoSleep) return { row: 0, status: "idle" };
      return phase === "yawning" ? { row: 10, status: "yawn" } : phase === "parked" ? { row: 11, status: "sleep" } : phase === "waking" ? { row: 12, status: "wake" } : { row: 0, status: "idle" };
    },
    elapsed(time: number) { return Math.max(0, time - entered); },
    focus(next: boolean, time: number, directInput = false) {
      if (next) {
        if (directInput) { phase = "active"; entered = time; }
        else if (phase === "parked" || phase === "yawning") { phase = "waking"; entered = time; }
        else if (phase !== "active" && phase !== "waking") { phase = "active"; entered = time; }
      } else if (phase === "active" || phase === "waking") { phase = "finishing"; entered = time; }
    },
    step(time: number, busy: boolean): CompanionPresence {
      if (phase === "finishing" && !busy) { phase = "resting"; entered = time; }
      else if (phase === "resting" && time - entered >= COMPANION_TIMING.presenceRest) { phase = "yawning"; entered = time; }
      else if (phase === "yawning" && time - entered >= COMPANION_TIMING.presenceYawn) { phase = "parked"; entered = time; }
      else if (phase === "waking" && time - entered >= COMPANION_TIMING.presenceWake) { phase = "active"; entered = time; }
      return phase;
    },
  };
}

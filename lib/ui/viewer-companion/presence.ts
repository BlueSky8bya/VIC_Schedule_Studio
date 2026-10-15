/** Visible but unfocused is a quiet companion, not a hidden tab. No clock,
 * timer or DOM ownership here: the renderer stops itself when parked. */
export type CompanionPresence = "active" | "finishing" | "resting" | "yawning" | "parked" | "waking";
export function createCompanionPresence(focused: boolean, now: number) {
  let phase: CompanionPresence = focused ? "active" : "finishing";
  let entered = now;
  return {
    get phase() { return phase; },
    elapsed(time: number) { return Math.max(0, time - entered); },
    focus(next: boolean, time: number) {
      if (next) {
        if (phase === "parked" || phase === "yawning") { phase = "waking"; entered = time; }
        else if (phase !== "active" && phase !== "waking") { phase = "active"; entered = time; }
      } else if (phase === "active" || phase === "waking") { phase = "finishing"; entered = time; }
    },
    step(time: number, busy: boolean): CompanionPresence {
      if (phase === "finishing" && !busy) { phase = "resting"; entered = time; }
      else if (phase === "resting" && time - entered >= 700) { phase = "yawning"; entered = time; }
      else if (phase === "yawning" && time - entered >= 900) { phase = "parked"; entered = time; }
      else if (phase === "waking" && time - entered >= 800) { phase = "active"; entered = time; }
      return phase;
    },
  };
}

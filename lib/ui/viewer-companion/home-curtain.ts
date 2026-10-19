import type { CompanionHomeEnvironment } from "./home-environment";
import type { CompanionPersonality } from "./preferences";

export type CompanionHomeRest = "awake" | "settling" | "asleep" | "waking";
export type CompanionHomeCurtain = Readonly<{
  phase: "open" | "shade" | "closed";
  reason: "awake" | "sun" | "rest";
  rest: CompanionHomeRest;
  panelScale: number;
  active: boolean;
  animate: boolean;
}>;
export const INITIAL_COMPANION_HOME_CURTAIN: CompanionHomeCurtain = Object.freeze({ phase: "open", reason: "awake", rest: "awake", panelScale: .08, active: false, animate: false });

/** Only an actual grounded home rest owns the curtains. Needs, personality,
 * a journey toward home and an unrelated sleeper never constitute a nap. */
export function companionHomeRest(input: { atHome: boolean; grounded: boolean; sleepAllowed: boolean; held: boolean; resting: boolean; dreaming: boolean; waking: boolean }): CompanionHomeRest {
  if (!input.atHome || !input.grounded || !input.sleepAllowed || input.held) return "awake";
  if (input.waking) return "waking";
  if (!input.resting) return "awake";
  return input.dreaming ? "asleep" : "settling";
}

type Input = { environment?: CompanionHomeEnvironment; personality: CompanionPersonality; rest: CompanionHomeRest; lookingOut: boolean; visible: boolean; blocked: boolean; reduced: boolean; intent?: CompanionHomeCurtain["phase"] };
const shade: Readonly<Record<CompanionPersonality, number>> = { curious: .18, affectionate: .26, sleepy: .42, tidy: .28, mischievous: .22, gourmet: .26, performer: .22, homebody: .36, balanced: .26 };

/** Presentation only, sampled by existing paint/context boundaries. No clock,
 * randomness, gameplay action, storage or human activity event is owned here. */
export function reduceCompanionHomeCurtain(previous: CompanionHomeCurtain, input: Input): CompanionHomeCurtain {
  if (!input.visible || input.blocked) return !previous.active && !previous.animate ? previous : { ...previous, active: false, animate: false };
  let phase: CompanionHomeCurtain["phase"] = "open", reason: CompanionHomeCurtain["reason"] = "awake", panelScale = .08;
  const environment = input.environment;
  // The shared solar band owns night even if legacy hour/night fields differ.
  const night = environment?.band === "evening" || environment?.band === "night";
  const sunlight = Number.isFinite(environment?.sunlight) ? environment!.sunlight! : 0;
  if (input.rest === "settling" || input.rest === "asleep") { phase = "closed"; reason = "rest"; panelScale = 1; }
  else if (input.rest !== "waking" && !input.lookingOut && !night && environment?.weather === "clear" && sunlight >= (previous.reason === "sun" ? 2 : 3)) {
    phase = "shade"; reason = "sun"; panelScale = shade[input.personality];
  }
  // An actual user/companion control owns the cloth, including while asleep.
  // Needs/weather alone may suggest a choice but cannot undo that contact.
  if (input.intent) { phase = input.intent; reason = phase === "closed" ? "rest" : phase === "shade" ? "sun" : "awake"; panelScale = phase === "closed" ? 1 : phase === "shade" ? shade[input.personality] : .08; }
  const changed = previous.phase !== phase || previous.panelScale !== panelScale;
  const animate = changed ? previous.active && !input.reduced : previous.active && !input.reduced && previous.animate;
  if (previous.phase === phase && previous.reason === reason && previous.rest === input.rest && previous.panelScale === panelScale && previous.active && previous.animate === animate) return previous;
  return { phase, reason, rest: input.rest, panelScale, active: true, animate };
}

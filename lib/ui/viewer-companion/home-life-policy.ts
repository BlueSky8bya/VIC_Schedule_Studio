import { COMPANION_PERSONALITIES, type CompanionPersonality } from "./preferences";
import { COMPANION_HOME_TV_CHANNELS, normalizeCompanionHomeTv, type CompanionHomeTvState } from "./home-room-media";
import type { CompanionAction, CompanionWorld } from "./brain";
import type { CompanionPreferences } from "./preferences";
import type { SceneBeat } from "./personality-scene-catalog";
import { findCompanionToyRoute } from "./toys";
import { companionPlayDuration } from "./timing";

/** Intent of the original life action, retained while walking to a control.
 * `outside` is requested BEFORE departure while the resident is still inside.
 * Control approach/interaction jobs must not replace that original phase. */
export type CompanionHomeLifePhase = "awake" | "watch" | "nap" | "sleep" | "outside";
export type CompanionHomeLifeCommand = Readonly<
  | { kind: "light"; lit: boolean; required: boolean }
  | { kind: "tv"; state: "off" | "tori"; required: boolean }
>;
export type CompanionHomeLifePlan = Readonly<{
  serial: number;
  phase: CompanionHomeLifePhase;
  personality: CompanionPersonality;
  night: boolean;
  commands: readonly CompanionHomeLifeCommand[];
  exception?: "dark-homebody-tv" | "tori-sleep" | "tori-outside";
}>;
export type CompanionHomeLifeInput = {
  phase: CompanionHomeLifePhase;
  personality: CompanionPersonality;
  night: boolean;
  inside: boolean;
  enabled: boolean;
  active: boolean;
  /** Captured/manual/airborne actions and actual food/toy transport own motion. */
  owned?: boolean;
  lightLit: boolean;
  tv: CompanionHomeTvState;
  /** Existing stores' fifteen-second manual priority remains authoritative. */
  canLight?: boolean;
  canTv?: boolean;
  /** Optional leisure only, never a prerequisite for a meal or urgent care. */
  allowBackground?: boolean;
};
export type CompanionHomeLifeDecision = Readonly<{
  status: "ready" | "command" | "blocked";
  plan?: CompanionHomeLifePlan;
  command?: CompanionHomeLifeCommand;
  reason?: "off" | "inactive" | "ownership" | "outside" | "invalid" | "manual-light" | "manual-tv";
}>;

export const COMPANION_HOME_LIFE_POLICY = Object.freeze({
  darkHomebodyTvChance: .12,
  sleepToriChance: .015,
  outsideToriChance: .01,
  backgroundTvChance: .25,
  darkNapChance: .55,
});

export type CompanionHomeLifeAction = CompanionAction & {
  homeLife: Readonly<{ serial: number; command: CompanionHomeLifeCommand; travel?: true; returning?: true; interactionContact?: { x: number; y: number } }>;
};

/** Normalize before the director compares state or plans physical contact.
 * Looking ahead stops at actual work: a later sleep cannot darken a meal. */
export function companionHomeLifePhaseFor(input: {
  action: Pick<CompanionAction, "kind" | "target">; inside: boolean; night: boolean;
  scene?: { id: string; beat: number; command: SceneBeat; steps?: readonly SceneBeat[] };
}): CompanionHomeLifePhase {
  const { action, scene } = input;
  if (scene?.id === "routine-sleep") return "sleep";
  if (scene?.id === "routine-nap") return "nap";
  if (scene?.id === "routine-outing") return "outside";
  if (input.inside && ["walk", "jump"].includes(action.kind) && action.target.platformId
    && !/^companion-home(?:-floor)?(?:-\d+)?$/.test(action.target.platformId)) return "outside";
  if (action.kind === "sleep") return input.night ? "sleep" : "nap";
  if (scene && (["tv", "light", "radio", "curtain"].includes(scene.command.kind)
    || scene.command.kind === "go" && scene.command.target === "sofa")) {
    const later = scene.steps?.slice(scene.beat + 1).find(step => step.kind === "sleep" || step.kind === "watch" || step.kind === "food"
      || step.kind === "toy" || step.kind === "wash" || step.kind === "go" && step.target === "outside");
    if (later?.kind === "sleep") return input.night ? "sleep" : "nap";
    if (later?.kind === "go" && later.target === "outside") return "outside";
    if (later?.kind === "watch" || !later && scene.command.kind === "tv") return "watch";
  }
  return scene?.command.kind === "watch" ? "watch" : "awake";
}

/** Reuse the authored room route/gait and contact gesture. The caller supplies
 * measured stance/handle coordinates; no DOM or distant control write here. */
export function planCompanionHomeLifeControl(input: {
  decision: CompanionHomeLifeDecision; world: CompanionWorld;
  preferences: Pick<CompanionPreferences, "enabled" | "roam" | "jump" | "speed" | "personality">;
  stance?: { x: number; y: number; platformId?: string }; contact?: { x: number; y: number };
}): CompanionHomeLifeAction | undefined {
  const { decision, world, preferences: p, stance, contact } = input;
  if (decision.status !== "command" || !decision.command || !decision.plan || !p.enabled || !p.roam || world.paused || !world.animated
    || !stance?.platformId || !contact || ![world.x, world.y, stance.x, stance.y, contact.x, contact.y].every(Number.isFinite)) return;
  const source = world.platforms.find(platform => platform.id === world.platformId), target = world.platforms.find(platform => platform.id === stance.platformId);
  const home = (id?: string) => /^companion-home(?:-floor)?(?:-\d+)?$/.test(id ?? "");
  if (!source || !target || !home(source.id) || !/^companion-home-floor(?:-\d+)?$/.test(target.id) || target.bodyOnly
    || Math.abs(world.y - source.y) > 2 || world.x < source.x || world.x > source.x + source.width
    || Math.abs(stance.y - target.y) > 2 || stance.x < target.x || stance.x > target.x + target.width) return;
  const homeLife = { serial: decision.plan.serial, command: decision.command };
  if (world.platformId !== stance.platformId || Math.hypot(world.x - stance.x, world.y - stance.y) > 24) {
    const step = findCompanionToyRoute(world, stance, world.platforms, p.jump)?.[0];
    if (!step) return;
    const speed = p.speed === "relaxed" ? 65 : p.speed === "lively" ? 135 : 100;
    return { ...step, pace: p.personality === "sleepy" ? "amble" : "scoot", duration: step.kind === "jump" ? 850 : Math.max(220, Math.abs(step.target.x - world.x) / speed * 1000), homeLife: { ...homeLife, travel: true } };
  }
  return { kind: "play", play: decision.command.kind === "light" && p.jump ? "pounce" : "bow", target: { x: world.x, y: world.y, platformId: world.platformId },
    duration: decision.command.kind === "light" && p.jump ? companionPlayDuration("pounce") : 900, homeLife: { ...homeLife, interactionContact: { ...contact } } };
}
const phases: readonly CompanionHomeLifePhase[] = ["awake", "watch", "nap", "sleep", "outside"];
const chance = (rng: () => number, probability: number) => {
  try { const value = rng(); return Number.isFinite(value) && value >= 0 && value < probability; }
  catch { return false; }
};
const valid = (input: CompanionHomeLifeInput) => phases.includes(input.phase)
  && COMPANION_PERSONALITIES.includes(input.personality) && typeof input.night === "boolean" && typeof input.lightLit === "boolean"
  && (input.tv === "off" || input.tv === "music" || (COMPANION_HOME_TV_CHANNELS as readonly string[]).includes(input.tv));

/** Ephemeral policy only: no DOM, storage, geometry, timer, wall clock, item
 * mutation, collection ACK or actual control write. The caller routes each
 * command through the existing measured approach/contact and store guards.
 * Only observing the real resulting state satisfies a command. */
export function createCompanionHomeLifePolicy(rng: () => number = Math.random) {
  let serial = 0, signature: string | undefined, plan: CompanionHomeLifePlan | undefined;
  const clear = () => { signature = undefined; plan = undefined; };
  const build = (input: CompanionHomeLifeInput): CompanionHomeLifePlan => {
    const commands: CompanionHomeLifeCommand[] = [];
    let exception: CompanionHomeLifePlan["exception"];
    if (input.phase === "sleep" || input.phase === "outside") {
      const retainedTori = chance(rng, input.phase === "sleep" ? COMPANION_HOME_LIFE_POLICY.sleepToriChance : COMPANION_HOME_LIFE_POLICY.outsideToriChance);
      if (retainedTori) exception = input.phase === "sleep" ? "tori-sleep" : "tori-outside";
      commands.push({ kind: "tv", state: retainedTori ? "tori" : "off", required: true }, { kind: "light", lit: false, required: true });
    } else if (input.phase === "nap") {
      if (chance(rng, COMPANION_HOME_LIFE_POLICY.darkNapChance)) commands.push({ kind: "light", lit: false, required: false });
      // A short nap may keep an existing background picture. It never starts
      // a TV just to construct a nap exception.
    } else {
      const darkTv = input.phase === "watch" && input.personality === "homebody"
        && chance(rng, COMPANION_HOME_LIFE_POLICY.darkHomebodyTvChance);
      if (darkTv) exception = "dark-homebody-tv";
      commands.push({ kind: "light", lit: !darkTv, required: input.night && !darkTv });
      // An already playing channel is welcome background. This optional
      // initial choice never changes it or keeps drawing on every idle tick.
      if (input.phase === "awake" && input.allowBackground && normalizeCompanionHomeTv(input.tv) === "off"
        && chance(rng, COMPANION_HOME_LIFE_POLICY.backgroundTvChance)) commands.push({ kind: "tv", state: "tori", required: false });
    }
    return Object.freeze({ serial: ++serial, phase: input.phase, personality: input.personality, night: input.night,
      commands: Object.freeze(commands.map(command => Object.freeze(command))), ...(exception ? { exception } : {}) });
  };
  return {
    next(input: CompanionHomeLifeInput): CompanionHomeLifeDecision {
      if (input.enabled !== true) { clear(); return { status: "blocked", reason: "off" }; }
      if (!valid(input)) return { status: "blocked", reason: "invalid" };
      if (input.active !== true) return { status: "blocked", plan, reason: "inactive" };
      if (input.owned) return { status: "blocked", plan, reason: "ownership" };
      // This policy cannot reach into a private room from the calendar or
      // turn a required departure check into a forced return after leaving.
      if (input.inside !== true) return { status: "blocked", plan, reason: "outside" };
      const nextSignature = `${input.phase}:${input.personality}:${input.night}`;
      if (!plan || signature !== nextSignature) { plan = build(input); signature = nextSignature; }
      const currentTv = normalizeCompanionHomeTv(input.tv);
      const missing = plan.commands.filter(command => {
        if (command.kind === "tv" && !command.required && !input.allowBackground) return false;
        return command.kind === "light" ? input.lightLit !== command.lit : currentTv !== command.state;
      });
      if (!missing.length) return { status: "ready", plan };
      // Available independent controls may proceed while another store is
      // manually protected. Optional entertainment cannot outrank a blocked
      // required night light or a departure/sleep prerequisite.
      const required = missing.filter(command => command.required), priority = required.length ? required : missing;
      const command = priority.find(candidate => candidate.kind === "light" ? input.canLight !== false : input.canTv !== false);
      if (command) return { status: "command", plan, command };
      return { status: "blocked", plan, reason: priority[0].kind === "light" ? "manual-light" : "manual-tv" };
    },
    current: () => plan,
    clear,
  };
}

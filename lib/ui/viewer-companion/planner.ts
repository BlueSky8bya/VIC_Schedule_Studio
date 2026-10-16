import type { CompanionAction, CompanionBehaviorPreferences, CompanionBrain, CompanionRouteStep, CompanionWorld, Platform } from "./brain";
import { getCompanionBehaviorProfile } from "./behavior-profile";

export type CompanionIntention = {
  kind: "explore" | "rest" | "feed";
  targetId: string;
  /** Normalized support location follows real geometry rather than stale px. */
  offset: number;
  remaining: number;
  stage: "travel" | "observe";
  foodId?: string;
};
/** One offered-food identity survives a temporary occlusion or another need.
 * The live food source owns coordinates/existence; this is not a second map. */
export type CompanionFeedGoal = { foodId: string; remaining: number; retryAfter: number };
export const COMPANION_FEED_ACTION_BUDGET = 32;
export const COMPANION_FEED_RETRY_MS = 4000;
export type CompanionOutcome = { targetId: string; result: "completed" | "blocked" | "lost" };
export type CompanionPlaceMemory = { id: string; visits: number; failures: number; retryAfter: number };
type Ports = {
  route: (origin: { x: number; y: number; platformId?: string }, target: { x: number; y: number; platformId?: string }, platforms: readonly Platform[], allowJump: boolean) => CompanionRouteStep[] | null;
  landingX: (platform: Platform, x: number) => number;
  reachable: (origin: { x: number; y: number }, platforms: readonly Platform[]) => Platform[];
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const safe = (p: Platform) => !p.manualOnly && p.kind !== "hide" && Boolean(p.id) && [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0;

/** Outcomes contain only anonymous geometry ids; never text, accounts, time of
 * absence or schedule ids. Failed places become briefly less attractive. */
export function rememberCompanionOutcomes(memory: readonly CompanionPlaceMemory[], outcomes: readonly CompanionOutcome[], activeMs: number): CompanionPlaceMemory[] {
  let next = memory.slice(-12).map(place => ({ ...place }));
  for (const outcome of outcomes.slice(0, 3)) {
    if (!outcome.targetId) continue;
    const old = next.find(place => place.id === outcome.targetId) ?? { id: outcome.targetId, visits: 0, failures: 0, retryAfter: 0 };
    const completed = outcome.result === "completed";
    const place = { id: old.id, visits: Math.min(15, old.visits + Number(completed)), failures: completed ? Math.max(0, old.failures - 1) : Math.min(3, old.failures + 1), retryAfter: completed ? 0 : activeMs + 8000 };
    next = [...next.filter(item => item.id !== old.id), place].slice(-12);
  }
  return next;
}

/** Bounded goal arbitration above the existing finite action renderer. A goal
 * survives intermediate landings, but each next step is replanned against the
 * current affordances. This is authored goal planning, not learned language or
 * unrestricted action generation. No observation occurs here on a timer. */
export function planCompanionGoal(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionBehaviorPreferences, ports: Ports): { action?: CompanionAction; outcomes: CompanionOutcome[] } {
  const outcomes: CompanionOutcome[] = [];
  if (!prefs.enabled || world.paused || !prefs.roam) return { outcomes };
  const platforms = world.platforms.slice(0, 200), current = platforms.find(p => p.id === world.platformId);
  if (!current || Math.abs(current.y - world.y) > 18) return { outcomes };
  const memories = brain.places ?? [], activeMs = brain.activeMs ?? 0;
  const profile = getCompanionBehaviorProfile(prefs), speed = profile.walkSpeed;
  const pursue = (intention: CompanionIntention, proven?: CompanionRouteStep[]): CompanionAction | undefined => {
    const target = platforms.find(p => p.id === intention.targetId && safe(p));
    if (!target || intention.remaining <= 0) { outcomes.push({ targetId: intention.targetId, result: target ? "blocked" : "lost" }); return; }
    const x = ports.landingX(target, target.x + target.width * clamp(intention.offset, 0, 1));
    const route = proven ?? ports.route(world, { x, y: target.y, platformId: target.id }, platforms, prefs.jump);
    if (!route || route.length > 10) { outcomes.push({ targetId: target.id, result: "blocked" }); return; }
    if (!route.length) {
      outcomes.push({ targetId: target.id, result: "completed" });
      return { kind: intention.kind === "rest" ? "sleep" : "look", target: { x: world.x, y: world.y, platformId: current.id }, duration: intention.kind === "rest" ? 9000 * profile.pauseScale : 1050 * profile.lookScale, intention: { ...intention, stage: "observe" } };
    }
    const step = route[0];
    const pace = brain.energy >= .5 && profile.scootChance >= .5 ? "scoot" as const : "amble" as const;
    return { kind: step.kind, target: step.target, duration: step.kind === "walk" ? Math.max(500, Math.abs(step.target.x - world.x) / speed * (pace === "scoot" ? 850 : profile.walkScale * 1000)) : 950, direction: step.target.x < world.x ? -1 : 1, ...(step.kind === "walk" ? { pace } : {}), intention };
  };
  const previous = brain.intention;
  const rested = previous?.kind === "rest" && (!prefs.sleep || brain.energy >= profile.restedEnergy);
  const exhausted = previous?.kind === "explore" && brain.energy < .28;
  if (previous && previous.kind !== "feed" && previous.stage === "travel" && !rested && !exhausted) {
    const action = pursue(previous);
    if (action) return { action, outcomes };
  }
  // An expedition's final observation yields one local choice. Otherwise a
  // sequence of new multi-ledge goals could permanently starve species habits
  // (grooming/play invitations) and personality recovery behind this planner.
  if (previous?.stage === "observe") return { outcomes };
  const home = platforms.find(p => p.id === "companion-home" && safe(p));
  if (prefs.sleep && brain.energy < profile.restEnergy && home) {
    const action = pursue({ kind: "rest", targetId: home.id, offset: .5, remaining: 12, stage: "travel" });
    if (action) return { action, outcomes };
  }
  if (!prefs.jump || brain.energy < profile.exploreEnergy || brain.curiosity < profile.exploreCuriosity) return { outcomes };
  // Keep a proven expedition, but do not launch a new one over a social cue.
  // The local utility can approach/sniff/invite play on the real current ledge.
  const pointer = world.pointer;
  if (profile.socialPull >= 1 && pointer && [pointer.x, pointer.y].every(Number.isFinite)
    && Math.abs(pointer.y - world.y) < 160 && Math.abs(pointer.x - world.x) < 600) return { outcomes };
  // Keep the existing short one-hop/walk utility for ordinary local play. The
  // planner adds previously missing multi-ledge expeditions, not another random
  // target every landing. Rank at most six, prove at most two actual routes.
  const rejected = new Set(outcomes.map(item => item.targetId));
  const direct = new Set(ports.reachable(world, platforms).map(p => p.id));
  const ranked = platforms.filter(p => safe(p) && p.kind !== "floor" && p.id !== current.id && p.id !== home?.id && !direct.has(p.id) && !rejected.has(p.id))
    .map(platform => {
      const memory = memories.find(item => item.id === platform.id);
      const distance = Math.hypot(ports.landingX(platform, world.x) - world.x, platform.y - world.y);
      const visited = memory?.visits ?? Number(brain.visited.includes(platform.id));
      const heightTaste = platform.y < world.y ? profile.highPlaceWeight : 0;
      return { platform, available: !memory || memory.retryAfter <= activeMs, score: profile.noveltyWeight / (1 + visited) + heightTaste - distance / 1600 - (memory?.failures ?? 0) * .35 };
    }).filter(item => item.available).sort((a, b) => b.score - a.score).slice(0, 6);
  let proofs = 0;
  for (const { platform } of ranked) {
    // A single transfer remains the original utility's affordance. Checking it
    // through the real route also accounts for a necessary takeoff walk.
    const route = ports.route(world, { x: ports.landingX(platform, platform.x + platform.width / 2), y: platform.y, platformId: platform.id }, platforms, prefs.jump);
    proofs++;
    if (route && route.filter(step => step.kind === "jump").length < 2) { if (proofs >= 2) break; continue; }
    if (route && route.length <= 10) {
      const action = pursue({ kind: "explore", targetId: platform.id, offset: .5, remaining: 12, stage: "travel" }, route);
      if (action) return { action, outcomes };
    } else outcomes.push({ targetId: platform.id, result: "blocked" });
    if (proofs >= 2) break;
  }
  return { outcomes };
}

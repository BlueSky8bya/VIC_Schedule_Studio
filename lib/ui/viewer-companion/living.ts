import type { CompanionAction, CompanionBehaviorPreferences, CompanionBrain, CompanionPlay, CompanionWorld } from "./brain";
import { companionPlayDuration } from "./timing";
import { DEFAULT_COMPANION_LIFE } from "./life";

export type CompanionLivingKind = "social" | "cozy" | "cheer";
export const COMPANION_LIVING_COOLDOWN = 120000;
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

/** An actual recent failure can soften a committed meal's walk without
 * changing its food, route or remaining action budget. Never penalize a new
 * meal, disabled learning, expired memory or an unrelated support. */
export function companionFoodApproachScale(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionBehaviorPreferences, foodId: string, targetSupportId?: string): number {
  if (!world.animated || prefs.learnFromYou === false || foodId !== (brain.foodGoal?.foodId ?? brain.intention?.foodId)) return 1;
  return brain.places?.some(place => place.failures > 0 && place.retryAfter > (brain.activeMs ?? 0) && (place.id === world.platformId || place.id === targetSupportId)) ? .8 : 1;
}

/** Finite invitations on an actual occupied safe span. This never grants a
 * care reward, moves food, presses controls or stores a schedule identity. */
export function getLivingAction(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionBehaviorPreferences, now: number, rng: () => number = Math.random): CompanionAction | undefined {
  if (!world.animated || !prefs.enabled || world.paused || ![world.x, world.y, now].every(Number.isFinite)
    || brain.foodGoal || brain.intention || brain.episode && brain.episode.remaining > 0 && brain.episode.phase !== "finish") return;
  const support = world.platforms.find(platform => platform.id === world.platformId);
  if (!support || ![support.x, support.y, support.width].every(Number.isFinite) || support.width <= 0
    || Math.abs(support.y - world.y) > 2 || world.x < support.x || world.x > support.x + support.width || support.kind === "control" || support.kind === "hide") return;
  const home = support.id === "companion-home" || /^companion-home-floor(?:-\d+)?$/.test(support.id);
  if (support.manualOnly && !home) return;
  const here = { x: world.x, y: world.y, platformId: support.id }, life = prefs.learnFromYou === false ? DEFAULT_COMPANION_LIFE : brain.life ?? DEFAULT_COMPANION_LIFE;
  const pointer = world.pointer && [world.pointer.x, world.pointer.y, world.pointer.stableMs].every(Number.isFinite) && world.pointer.stableMs! >= 900 ? world.pointer : undefined;
  const play = (kind: CompanionPlay, living: CompanionLivingKind): CompanionAction => ({ kind: "play", play: kind, living, target: here, duration: companionPlayDuration(kind), ...(living === "social" && pointer ? { attention: { kind: "social", point: { x: pointer.x, y: pointer.y } } } : {}) });
  const social = Boolean(prefs.petting && prefs.roam && brain.energy >= .28 && pointer && !home && Math.abs(pointer.y - world.y) < 150 && Math.abs(pointer.x - world.x) <= 220);
  const pending = brain.pendingLiving;
  if (pending?.supportId === support.id) {
    if (pending.kind === "social" && social) return play(brain.affection >= .6 ? "lean-nuzzle" : "ask-petting", "social");
    if (pending.kind === "cozy" && home && prefs.sleep && brain.energy < .28) return { kind: "sleep", living: "cozy", cozySettled: true, target: here, duration: 9000 };
  }
  // Reuse the existing short-lived failed-place memory to visibly inspect an
  // uncertain nearby spot even while ordinary living stories cool down. Only
  // its remaining <=8s memory window extends the existing look cooldown.
  const uncertainUntil = prefs.learnFromYou === false ? 0 : (brain.places ?? []).reduce((until, place) => place.failures > 0 && place.retryAfter > brain.activeMs && world.platforms.some(platform => platform.id === place.id && Math.abs(platform.y - world.y) <= 18 && world.x >= platform.x - 50 && world.x <= platform.x + platform.width + 50) ? Math.max(until, place.retryAfter) : until, 0);
  if (uncertainUntil && (brain.cooldowns.look ?? -Infinity) <= now) return { kind: "look", target: here, duration: 1100, placeCheckMs: Math.min(8000, uncertainUntil - brain.activeMs) };
  if ((brain.cooldowns.living ?? -Infinity) > now) return;
  if (home && prefs.sleep && brain.activeMs >= 30000 && (brain.energy < .42 || life.comfort >= .6)) return play(brain.energy < .28 ? "doze-curl" : "cozy-nest", "cozy");
  if (brain.activeMs < 45000 || !prefs.roam) return;
  if (social && life.social >= .4 && brain.affection < .8) {
    const distance = Math.abs(pointer!.x - world.x);
    if (distance > 84 && support.width >= 100) {
      const desired = pointer!.x + (world.x < pointer!.x ? -52 : 52);
      const x = clamp(desired, Math.max(support.x + 12, world.x - 96), Math.min(support.x + support.width - 12, world.x + 96));
      if (Math.abs(x - world.x) >= 20) return { kind: "walk", living: "social", pace: "amble", direction: x < world.x ? -1 : 1, target: { ...here, x }, duration: Math.max(700, Math.abs(x - world.x) / 60 * 1000) };
    }
    return play(brain.affection >= .6 ? "lean-nuzzle" : "ask-petting", "social");
  }
  // An occasional local rehearsal is one authored finite clip, never an
  // unbounded autonomous story, and never displaces a real meal or command.
  if (!home && support.width >= 140 && brain.activeMs >= 90000 && brain.energy >= .45 && life.play >= .45 && life.curiosity >= .4) {
    // One missed first novelty gets a bounded active-time opportunity. This
    // uses the existing decision boundary and cooldown, never another timer.
    const firstDue = brain.activeMs >= 150000 && !brain.recentLiving?.includes("cheer");
    const draw = firstDue ? 0 : rng();
    if (Number.isFinite(draw) && draw >= 0 && draw < .08) return play("cheer-rehearsal", "cheer");
  }
  return;
}

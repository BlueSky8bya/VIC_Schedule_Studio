import { COMPANION_TIMING, companionPlayDuration } from "./timing";
import type { CompanionPreferences } from "./preferences";
import { COMPANION_FULL_THRESHOLD, type CompanionCare } from "./care";
import { isCompanionFoodKind, type CompanionFoodKind } from "./snacks";
import { advanceCompanionAffect, appraiseCompanionEvent, companionMood, createCompanionAffect, type CompanionAffect } from "./affect";
import { COMPANION_FEED_ACTION_BUDGET, COMPANION_FEED_RETRY_MS, planCompanionGoal, rememberCompanionOutcomes, type CompanionFeedGoal, type CompanionIntention, type CompanionOutcome, type CompanionPlaceMemory } from "./planner";
import { MAX_COMPANION_FOOD } from "./food-capacity";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionAttention } from "./deliberation";
import { advanceCompanionHabits, DEFAULT_COMPANION_HABITS, type CompanionHabits } from "./habits";
import { createCompanionContext, pendingCompanionMealId, planCompanionEpisode, type CompanionEpisode } from "./episodes";

/** Local, renderer-independent companion. Coordinates are CSS viewport pixels:
 * x is the character's centre, y its feet; platform y is the walkable top.
 * The brain only proposes visual actions. It never casts a real heart or changes
 * stored ambient settings, and receives no schedule text or identity data. */
export type Platform = {
  id: string;
  x: number;
  y: number;
  width: number;
  kind: "card" | "date" | "floor" | "hide" | "control";
  /** Only the measured shared panel arrows expose this local affordance. */
  panelSide?: "left" | "right";
  /** A user-chosen top never attracts aimless play; actual food may explicitly
   * invite one proved terminal jump. It cannot be a walking/intermediate node. */
  manualOnly?: boolean;
  heart?: { x: number; y: number; blocked?: boolean };
};

export type CompanionBehaviorPreferences = CompanionPreferences;

export type CompanionFood = { id: string; x: number; y: number; platformId?: string; kind: CompanionFoodKind };
export type Food = CompanionFood;
export type CompanionActionKind = "idle" | "look" | "walk" | "jump" | "sleep" | "heart" | "hide" | "sniff" | "eat" | "stretch" | "shake" | "play" | "panel";
export type CompanionPlay = "tumble" | "slip-tumble" | "bump" | "slip" | "bonk-sad" | "bonk-tears" | "celebrate" | "groom" | "pounce" | "bow" | "dizzy";
export type CompanionAction = {
  kind: CompanionActionKind;
  target: { x: number; y: number; platformId?: string };
  /** Milliseconds, including the whole finite pose/action. */
  duration: number;
  effectPoint?: { x: number; y: number };
  foodId?: string;
  pace?: "amble" | "scoot";
  /** Finite local performance; its target remains the occupied real support. */
  play?: CompanionPlay;
  panelSide?: "left" | "right";
  /** Small same-support hops use a lower impulse than a platform transfer. */
  jumpHeight?: number;
  /** CSS pixels/second carried only from a completed run into its proved jump. */
  runUp?: number;
  /** Actual support-bounded drift during a contextual rolling beat. */
  rolling?: boolean;
  episode?: CompanionEpisode;
  /** A scene owner revoked future beats while this finite movement finishes. */
  episodeCancelled?: boolean;
  /** Retained wander heading, not an instruction to mirror the renderer. */
  direction?: -1 | 1;
  intention?: CompanionIntention;
  attention?: CompanionAttention;
  outcomes?: CompanionOutcome[];
};
export type CompanionWorld = {
  x: number;
  y: number;
  platformId?: string;
  platforms: readonly Platform[];
  width: number;
  height: number;
  paused?: boolean;
  /** Supplied only by an active animated renderer; pure route callers stay pure. */
  animated?: boolean;
  /** Renderer proved an ordinary public card at the occupied support. */
  hideAvailable?: boolean;
  foods?: readonly CompanionFood[];
  pointer?: { x: number; y: number };
};
export type CompanionBrain = CompanionCare & {
  habits?: CompanionHabits;
  createdAt: number;
  recent: CompanionActionKind[];
  visited: string[];
  cooldowns: Partial<Record<CompanionActionKind, number>> & { mishap?: number; episode?: number };
  episode?: CompanionEpisode;
  heading: -1 | 1;
  activeMs: number;
  affect: CompanionAffect;
  intention?: CompanionIntention;
  foodGoal?: CompanionFeedGoal;
  places: CompanionPlaceMemory[];
  /** Current consecutive movement burst only; no wall-clock/absence history. */
  movementMs?: number;
  lastPace?: "amble" | "scoot";
};

export const COMPANION_JUMP_LIMITS = Object.freeze({
  maxDistance: 260,
  maxRise: 140,
  maxDrop: 240,
  horizontalSpeed: 260,
  gravity: 1100,
  landingInset: 12,
});
export const COMPANION_ROUTE_LIMITS = Object.freeze({ maxNodes: 200, maxHops: 12 });
type JumpLimits = { [K in keyof typeof COMPANION_JUMP_LIMITS]: number };
type Point = { x: number; y: number };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const unit = (n: number) => clamp(Number.isFinite(n) ? n : 0, 0, 1);
const random = (rng: () => number) => Math.min(.999999999, unit(rng()));
const valid = (p: Platform) => Boolean(p.id) && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.width) && p.width > 0;

/** Keep the centre on the support even when a small date rail is narrower than
 * the normal landing inset. Oversized sprites may overhang, never their feet. */
export function platformLandingX(platform: Platform, x: number, inset: number = COMPANION_JUMP_LIMITS.landingInset) {
  const margin = Math.min(Math.max(0, inset), platform.width / 2);
  return clamp(x, platform.x + margin, platform.x + platform.width - margin);
}

export function nearestPlatform(point: Point, platforms: readonly Platform[]): Platform | undefined {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;
  let closest: Platform | undefined;
  let best = Infinity;
  for (const platform of platforms) {
    if (!valid(platform)) continue;
    const distance = Math.hypot(platformLandingX(platform, point.x) - point.x, platform.y - point.y);
    if (distance < best) { best = distance; closest = platform; }
  }
  return closest;
}

/** Fixed-impulse ballistic feasibility, rather than a rectangular range test.
 * At the maximum rise, only the apex's shorter horizontal range is available.
 * Platforms are one-way support surfaces, not solid ceiling rectangles. */
export function reachablePlatforms(point: Point, platforms: readonly Platform[], overrides: Partial<JumpLimits> = {}): Platform[] {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
  const limits = { ...COMPANION_JUMP_LIMITS, ...overrides };
  if (![limits.maxDistance, limits.maxRise, limits.maxDrop, limits.horizontalSpeed, limits.gravity, limits.landingInset].every(Number.isFinite)
    || limits.gravity <= 0 || limits.horizontalSpeed <= 0 || limits.maxRise < 0 || limits.maxDrop < 0 || limits.maxDistance < 0) return [];
  const impulse = Math.sqrt(2 * limits.gravity * limits.maxRise);
  return platforms.filter(platform => {
    if (!valid(platform)) return false;
    const dy = platform.y - point.y;
    if (dy < -limits.maxRise || dy > limits.maxDrop) return false;
    const dx = Math.abs(platformLandingX(platform, point.x, limits.landingInset) - point.x);
    if (dx > limits.maxDistance) return false;
    const discriminant = impulse * impulse + 2 * limits.gravity * dy;
    if (discriminant < -1e-7) return false;
    const landingTime = (impulse + Math.sqrt(Math.max(0, discriminant))) / limits.gravity;
    return dx <= limits.horizontalSpeed * landingTime + 1e-7;
  });
}

export type CompanionRouteStep = { kind: "walk" | "jump"; target: { x: number; y: number; platformId: string } };
type SupportedPoint = Point & { platformId?: string };

/** Directed BFS over real ledges. Walking to a takeoff point is explicit, so
 * a long floor can bridge a gap without pretending a 500px jump is possible.
 * Each returned jump is checked with the same ballistic test as wandering. */
export function findPlatformRoute(origin: SupportedPoint, target: SupportedPoint, platforms: readonly Platform[], allowJump = true, foodTargetId?: string): CompanionRouteStep[] | null {
  const available = platforms.filter(p => valid(p) && p.kind !== "hide" && !p.manualOnly).slice(0, COMPANION_ROUTE_LIMITS.maxNodes);
  const start = platforms.find(p => p.id === origin.platformId && valid(p)) ?? nearestPlatform(origin, available);
  const namedGoal = target.platformId ? platforms.find(p => p.id === target.platformId) : undefined;
  if (namedGoal?.manualOnly && foodTargetId !== namedGoal.id) return null;
  const manualFoodGoal = namedGoal?.manualOnly && foodTargetId === namedGoal.id && valid(namedGoal) && namedGoal.kind !== "hide" ? namedGoal : undefined;
  // A named food/support cannot silently become a nearby different ledge,
  // including one excluded by the bounded graph or a fresh visibility scan.
  const goal = manualFoodGoal ?? (target.platformId ? available.find(p => p.id === target.platformId) : nearestPlatform(target, available));
  if (!start || !goal || ![origin.x, origin.y, target.x, target.y].every(Number.isFinite)
    || Math.abs(start.y - origin.y) > 18 || Math.abs(goal.y - target.y) > 18) return null;
  const finalX = platformLandingX(goal, target.x);
  const finish = (x: number, steps: CompanionRouteStep[]): CompanionRouteStep[] | null => goal.manualOnly ? Math.abs(finalX - x) <= 36 ? steps : null : Math.abs(finalX - x) > 1
    ? [...steps, { kind: "walk" as const, target: { x: finalX, y: goal.y, platformId: goal.id } }] : steps;
  if (start.id === goal.id) return finish(origin.x, []);
  if (!allowJump) return null;
  const queue = [{ platform: start, x: origin.x, steps: [] as CompanionRouteStep[], hops: 0 }];
  const visited = new Set([start.id]);
  for (let index = 0; index < queue.length && index < COMPANION_ROUTE_LIMITS.maxNodes; index++) {
    const node = queue[index];
    if (node.hops >= COMPANION_ROUTE_LIMITS.maxHops) continue;
    // Favor promising neighbours; route progress is measured by remaining BFS
    // edges, not by a random new destination after every intermediate landing.
    const choices = (manualFoodGoal ? [...available, manualFoodGoal] : available).filter(p => !visited.has(p.id)).sort((a, b) =>
      Math.hypot(platformLandingX(a, target.x) - target.x, a.y - target.y)
      - Math.hypot(platformLandingX(b, target.x) - target.x, b.y - target.y));
    for (const platform of choices) {
      const takeoffX = node.platform.manualOnly ? node.x : platformLandingX(node.platform, platformLandingX(platform, target.x));
      // An offered snack is the only manual destination. Prove a landing at
      // its actual x so no traversal across that otherwise unsafe top follows.
      const landingX = platform.manualOnly ? finalX : platformLandingX(platform, takeoffX);
      const collision = platform.manualOnly ? { ...platform, x: landingX - 12, width: 24 } : platform;
      if (!reachablePlatforms({ x: takeoffX, y: node.platform.y }, [collision]).length) continue;
      const steps = [...node.steps];
      if (Math.abs(takeoffX - node.x) > 1) steps.push({ kind: "walk", target: { x: takeoffX, y: node.platform.y, platformId: node.platform.id } });
      steps.push({ kind: "jump", target: { x: landingX, y: platform.y, platformId: platform.id } });
      if (platform.id === goal.id) return finish(landingX, steps);
      visited.add(platform.id);
      queue.push({ platform, x: landingX, steps, hops: node.hops + 1 });
    }
  }
  return null;
}

export function createBrain(now = 0, rng: () => number = Math.random): CompanionBrain {
  return {
    createdAt: Number.isFinite(now) ? now : 0,
    energy: .72 + random(rng) * .16,
    affection: .3,
    curiosity: .6 + random(rng) * .2,
    hunger: .58,
    recent: [], visited: [], cooldowns: {}, heading: 1,
    activeMs: 0, affect: createCompanionAffect(), places: [], habits: { ...DEFAULT_COMPANION_HABITS },
  };
}

/** Call only for visible, active elapsed time. A long tab sleep cannot make the
 * character exhausted or force a catch-up action on return. */
export function advanceBrain(brain: CompanionBrain, elapsedMs: number, learning = true): CompanionBrain {
  const seconds = clamp(Number.isFinite(elapsedMs) ? elapsedMs / 1000 : 0, 0, 30);
  return {
    ...brain,
    energy: unit(brain.energy - seconds / 1400),
    affection: unit(brain.affection - seconds / 2400),
    curiosity: unit(brain.curiosity + seconds / 650),
    hunger: unit(brain.hunger + seconds / 900),
    activeMs: (brain.activeMs ?? 0) + seconds * 1000,
    affect: advanceCompanionAffect(brain.affect ?? createCompanionAffect(), seconds * 1000),
    habits: advanceCompanionHabits(brain.habits, seconds * 1000, learning),
  };
}

export type CompanionEvent = "petted" | "dragged" | "landed" | "rested" | "woke" | "ate" | "heart-blocked" | "food-lost" | "handled";
export function getCompanionMood(brain: CompanionBrain) { return companionMood(brain.affect ?? createCompanionAffect()); }
/** A new user/scene owner revokes exploration without discarding an offered
 * meal, rest need or care. The renderer may still finish its safe finite leg. */
export function cancelCompanionTravelGoal(brain: CompanionBrain): CompanionBrain {
  return brain.intention?.kind === "explore" ? { ...brain, intention: undefined } : brain;
}
export function recordCompanionEvent(brain: CompanionBrain, event: CompanionEvent): CompanionBrain {
  if (event === "ate" && brain.hunger < COMPANION_FULL_THRESHOLD) return { ...brain };
  if (event === "woke") return { ...brain, curiosity: unit(brain.curiosity + .05), episode: createCompanionContext("wake") };
  if (event === "landed") return { ...brain, energy: unit(brain.energy - .008) };
  const state = { ...brain, affect: appraiseCompanionEvent(brain.affect ?? createCompanionAffect(), event === "dragged" ? "handled" : event) };
  if (event === "ate") return { ...state, hunger: unit(brain.hunger - .36), affection: unit(brain.affection + .1), energy: unit(brain.energy + .07), curiosity: unit(brain.curiosity - .04), intention: undefined, foodGoal: undefined, episode: brain.episode?.kind === "meal" && brain.episode.phase === "meal" ? { ...brain.episode, phase: "ate" } : { kind: "meal", phase: "ate", variant: "careful", remaining: 1, foodId: brain.foodGoal?.foodId ?? brain.intention?.foodId, mishapUsed: true, legs: 0 }, places: brain.intention?.kind === "feed" ? rememberCompanionOutcomes(brain.places, [{ targetId: brain.intention.targetId, result: "completed" }], brain.activeMs) : brain.places };
  if (event === "petted") return { ...state, affection: unit(brain.affection + .08), energy: unit(brain.energy + .015), curiosity: unit(brain.curiosity - .025), episode: createCompanionContext("social") };
  if (event === "dragged" || event === "handled") return { ...state, curiosity: unit(brain.curiosity + .08), intention: undefined, episode: undefined };
  if (event === "rested") return { ...state, energy: unit(brain.energy + .24), curiosity: unit(brain.curiosity + .08), intention: undefined, episode: createCompanionContext("wake") };
  if (event === "food-lost") return { ...state, intention: brain.intention?.kind === "feed" ? undefined : brain.intention, foodGoal: undefined, episode: brain.episode?.kind === "meal" ? undefined : brain.episode, places: brain.intention?.kind === "feed" ? rememberCompanionOutcomes(brain.places, [{ targetId: brain.intention.targetId, result: "lost" }], brain.activeMs) : brain.places };
  if (event === "heart-blocked") return state;
  return state;
}

const cooldownMs: Record<CompanionActionKind, number> = {
  idle: 0, look: 700, walk: 350, jump: 1400, sleep: 25000, heart: 45000, hide: 90000, sniff: 5000, eat: 1500, stretch: 18000, shake: 14000, play: 20000, panel: 90000,
};

/** Commit once when an action begins, not every animation frame. */
export function commitAction(brain: CompanionBrain, action: CompanionAction, now: number): CompanionBrain {
  const moving = action.kind === "jump" || action.kind === "walk";
  const mishap = action.kind === "play" && (action.play === "tumble" || action.play === "slip-tumble" || action.play === "bump" || action.play === "slip");
  const novel = Boolean(action.target.platformId && !brain.visited.includes(action.target.platformId));
  const remaining = action.foodId && action.intention?.kind === "feed" ? Math.max(0, Math.min(COMPANION_FEED_ACTION_BUDGET, action.intention.remaining) - 1) : undefined;
  return {
    ...brain,
    // A few curious steps should not exhaust an initially healthy creature.
    // Rest remains useful over minutes, while exploration has a short rhythm.
    energy: unit(brain.energy - (action.kind === "jump" ? action.jumpHeight ? .005 : .009 : action.kind === "walk" ? .004 : 0)),
    curiosity: unit(brain.curiosity - (moving ? .018 : .008) + (moving && novel ? .025 : 0)),
    heading: action.direction ?? brain.heading,
    movementMs: moving ? Math.min(12000, (brain.movementMs ?? 0) + Math.max(0, action.duration)) : 0,
    lastPace: moving ? action.pace ?? brain.lastPace : undefined,
    episode: action.episode ? { ...action.episode, remaining: Math.max(0, Math.min(24, action.episode.remaining) - 1) } : undefined,
    recent: [...brain.recent, action.kind].slice(-8),
    visited: action.target.platformId ? [...brain.visited.filter(id => id !== action.target.platformId), action.target.platformId].slice(-8) : [...brain.visited],
    cooldowns: { ...brain.cooldowns, [action.kind]: now + action.duration + (action.foodId && ["walk", "jump"].includes(action.kind) ? 300 : cooldownMs[action.kind]), ...(mishap ? { mishap: now + action.duration + cooldownMs.play } : {}), ...(action.episode?.phase === "notice" ? { episode: now + 45000 } : {}) },
    intention: action.intention ? { ...action.intention, remaining: Math.max(0, action.intention.remaining - 1) } : undefined,
    foodGoal: action.foodId && remaining !== undefined ? { foodId: action.foodId, remaining, retryAfter: remaining === 0 ? (brain.activeMs ?? 0) + COMPANION_FEED_RETRY_MS : 0 } : brain.foodGoal,
    places: rememberCompanionOutcomes(brain.places ?? [], action.outcomes ?? [], brain.activeMs ?? 0),
  };
}

/** A hungry pet pursues one reachable food via concrete route steps. Eating
 * waits until the mouth is nearby; neither food nor disabled movement teleports
 * the creature. Full pets simply retain their ordinary idle/play choices. */
export function getFoodAction(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionBehaviorPreferences, now: number): CompanionAction | undefined {
  if (!prefs.enabled || world.paused || ![world.x, world.y, now].every(Number.isFinite)
    || !prefs.feeding || brain.hunger < COMPANION_FULL_THRESHOLD || !world.foods?.length) return undefined;
  const supported = { x: world.x, y: world.y, platformId: world.platformId };
  const remembered = brain.foodGoal, activeMs = brain.activeMs ?? 0;
  const mealId = world.animated && prefs.roam ? pendingCompanionMealId(brain) : undefined;
  const foods = world.foods.slice(0, MAX_COMPANION_FOOD).filter(food => Boolean(food.id) && [food.x, food.y].every(Number.isFinite) && isCompanionFoodKind(food.kind))
    .filter(food => !mealId || food.id === mealId)
    .sort((a, b) => Number(b.id === (remembered?.foodId ?? brain.intention?.foodId)) - Number(a.id === (remembered?.foodId ?? brain.intention?.foodId)) || Math.hypot(a.x - world.x, a.y - world.y) - Math.hypot(b.x - world.x, b.y - world.y));
  for (const food of foods) {
    if (remembered?.foodId === food.id && remembered.remaining <= 0 && remembered.retryAfter > activeMs) continue;
    const platform = world.platforms.find(p => p.id === food.platformId);
    const budget = remembered?.foodId === food.id && remembered.remaining > 0 ? remembered.remaining : COMPANION_FEED_ACTION_BUDGET;
    const intention: CompanionIntention = { kind: "feed", targetId: food.platformId ?? "", offset: platform ? unit((food.x - platform.x) / platform.width) : .5, remaining: budget, stage: "travel", foodId: food.id };
    const route = findPlatformRoute(supported, food, world.platforms, prefs.jump, platform?.manualOnly ? platform.id : undefined);
    if (!route) continue;
    const sameSupport = !route.some(step => step.kind === "jump");
    if (sameSupport && Math.abs(world.y - food.y) <= 18 && Math.abs(world.x - food.x) <= 36) {
      if ((brain.cooldowns.eat ?? -Infinity) > now) continue;
      return { kind: "eat", target: supported, duration: COMPANION_TIMING.eat, foodId: food.id, effectPoint: { x: food.x, y: food.y }, intention: { ...intention, stage: "observe" } };
    }
    if (!prefs.roam || !route.length) continue;
    const first = route[0];
    // A measured clear interval is one walk, not a chain of180px restarts.
    // Only a selected, physically proved meal hop needs a takeoff endpoint.
    let step = first;
    const profile = getCompanionBehaviorProfile(prefs, brain.habits), speed = profile.walkSpeed;
    const episode = brain.episode, current = world.platforms.find(p => p.id === world.platformId);
    if (first.kind === "walk" && sameSupport && current && !current.manualOnly && current.kind !== "control" && current.kind !== "hide" && !current.id.startsWith("companion-home")
      && food.platformId === current.id && Math.abs(food.y - current.y) <= 4 && world.animated && prefs.jump && prefs.animalMode !== "cat" && brain.energy >= .35
      && episode?.kind === "meal" && episode.foodId === food.id && !episode.mishapUsed && episode.legs === 0 && ["bound", "bound-slip"].includes(episode.variant)) {
      const direction = food.x < world.x ? -1 : 1, runSpeed = speed * 1.3, height = Math.min(105, profile.hopHeight + 40);
      const flight = 2 * Math.sqrt(2 * COMPANION_JUMP_LIMITS.gravity * height) / COMPANION_JUMP_LIMITS.gravity;
      // Leave a real approach after the possible56px landing roll; recovery
      // must not stand inside the36px mouth radius and skip that continuation.
      const landingX = food.x - direction * 112, takeoffX = landingX - direction * runSpeed * flight;
      const runDistance = (takeoffX - world.x) * direction;
      if (runDistance >= Math.max(48, runSpeed * .5) && takeoffX >= current.x + 12 && takeoffX <= current.x + current.width - 12
        && landingX >= current.x + 12 && landingX <= current.x + current.width - 12
        && reachablePlatforms({ x: takeoffX, y: current.y }, [{ ...current, x: landingX - 1, width: 2 }], { maxRise: height, landingInset: 0 }).length) {
        step = { ...first, target: { ...first.target, x: takeoffX } };
      }
    }
    const duration = step.kind === "walk" ? Math.max(500, Math.abs(step.target.x - world.x) / speed * 1000) : 950;
    if (!Number.isFinite(duration)) continue;
    return { kind: step.kind, target: step.target, duration, foodId: food.id, intention, ...(step.kind === "walk" ? { pace: "amble" as const } : {}), direction: step.target.x < world.x ? -1 : 1 };
  }
  return undefined;
}

/** Weighted utility with authored affordances: curiosity explores new ledges,
 * fatigue encourages rest, affection encourages a small local heart joke.
 * Inject a seeded RNG in fixtures/replays; all decisions stay on the device. */
export function getAction(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionBehaviorPreferences, now: number, rng: () => number = Math.random): CompanionAction {
  const stationary = { x: world.x, y: world.y, platformId: world.platformId };
  const idle: CompanionAction = { kind: "idle", target: stationary, duration: 900 };
  if (!prefs.enabled || world.paused || !Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(now)) return idle;
  const foodAction = getFoodAction(brain, world, prefs, now);
  const episode = planCompanionEpisode(brain, world, prefs, now, foodAction, rng, reachablePlatforms);
  if (episode) return episode;
  if (foodAction) return foodAction;
  const profile = getCompanionBehaviorProfile(prefs, brain.habits);
  const current = world.platforms.find(p => p.id === world.platformId && valid(p)) ?? nearestPlatform(world, world.platforms);
  // A rare toe-tap starts only on the actual occupied arrow. The renderer
  // rechecks its exact live control at impact; no remote button targeting.
  if (prefs.roam && prefs.panelPrank && current?.kind === "control" && current.panelSide
    && current.id === world.platformId && !current.manualOnly && Math.abs(current.y - world.y) <= 4
    && world.x >= current.x && world.x <= current.x + current.width
    && brain.activeMs >= 90000 && (brain.cooldowns.panel ?? -Infinity) <= now && random(rng) < .055) {
    return { kind: "panel", panelSide: current.panelSide, target: stationary, duration: COMPANION_TIMING.panelPress };
  }
  let movingStreak = 0;
  for (let i = brain.recent.length - 1; i >= 0 && ["walk", "jump"].includes(brain.recent[i]); i--) movingStreak++;
  const planned = planCompanionGoal(brain, world, prefs, { route: findPlatformRoute, landingX: platformLandingX, reachable: reachablePlatforms });
  if (planned.action) return { ...planned.action, ...(planned.outcomes.length ? { outcomes: planned.outcomes } : {}) };
  const candidates: { action: CompanionAction; utility: number }[] = [];
  const add = (kind: CompanionActionKind, utility: number, duration: number, target = stationary, effectPoint?: Point, movement: Pick<CompanionAction, "pace" | "jumpHeight" | "direction" | "play" | "intention"> = {}) => {
    if ((brain.cooldowns[kind] ?? -Infinity) > now) return;
    const repeats = brain.recent.slice(-4).filter(item => item === kind).length;
    const lastPenalty = brain.recent.at(-1) === kind ? .35 : 1;
    candidates.push({ action: { kind, target, duration, ...(effectPoint ? { effectPoint } : {}), ...movement }, utility: Math.max(0, utility) * lastPenalty / (1 + repeats * .65) });
  };
  const curious = prefs.personality === "curious" ? .35 : 0;
  const affectionate = prefs.personality === "affectionate" ? .3 : 0;
  const sleepy = prefs.personality === "sleepy" ? .45 : 0;
  const cat = prefs.animalMode === "cat", dog = prefs.animalMode === "dog";
  const recovery = movingStreak >= 3;
  const tired = brain.energy < .28;
  const mobility = (recovery ? .16 : 1) * (tired ? .38 : 1) * profile.movementWeight;
  const pointer = world.pointer && [world.pointer.x, world.pointer.y].every(Number.isFinite) ? world.pointer : undefined;
  const follows = pointer && profile.socialPull > 0 && Math.abs(pointer.y - world.y) < 160;
  add("idle", .14 + (1 - brain.energy) * .25 + sleepy + (recovery ? 1.15 : 0), ((recovery ? 1000 : 550) + random(rng) * (recovery ? 700 : 650)) * profile.pauseScale);
  add("look", (.2 + brain.curiosity * .25 + curious * .45 + (recovery ? .45 : 0)) * profile.lookWeight, (COMPANION_TIMING.lookMin + random(rng) * COMPANION_TIMING.lookRange) * profile.lookScale);
  add("stretch", .12 + (1 - brain.energy) * .2 + (recovery ? .3 : 0), COMPANION_TIMING.stretchMin + random(rng) * COMPANION_TIMING.stretchRange);
  add("shake", .13 + brain.energy * .1 + (dog ? .18 : 0), COMPANION_TIMING.shakeMin + random(rng) * COMPANION_TIMING.shakeRange);
  if (cat || dog) add("sniff", .25 + brain.curiosity * .25 + (dog ? .15 : 0), cat ? COMPANION_TIMING.sniffCat : COMPANION_TIMING.sniffDog);
  if (prefs.sleep && brain.energy < profile.sleepEnergy) add("sleep", (1 - brain.energy) ** 2 * 1.7 + sleepy, (8000 + random(rng) * 7000) * (sleepy ? 1.25 : 1));
  // Social contact remains visible with heart jokes disabled. Cats groom,
  // dogs invite play, and an affectionate mascot responds near the pointer.
  if (current && current.id === world.platformId && Math.abs(current.y - world.y) <= 18) {
    if (cat) add("play", profile.playWeight, companionPlayDuration("groom"), stationary, undefined, { play: "groom" });
    else if (dog) add("play", profile.playWeight * (follows ? 1.7 : 1), companionPlayDuration("bow"), stationary, undefined, { play: "bow" });
    else if ((brain.affect?.joy ?? 0) >= .18 || affectionate && follows) add("play", profile.playWeight * 1.5, companionPlayDuration("celebrate"), stationary, undefined, { play: "celebrate" });
    if (cat && prefs.roam && prefs.jump && !current.manualOnly && current.width >= 100 && follows && !tired) add("play", profile.playWeight * .8, companionPlayDuration("pounce"), stationary, undefined, { play: "pounce" });
  }
  if (prefs.roam && current && Math.abs(current.y - world.y) <= 18) {
    const speed = profile.walkSpeed;
    // Coherent excursions follow one actual safe span. Reverse only at an edge
    // or after an occasional observation; the movement streak supplies rests.
    let direction = brain.heading ?? 1;
    if (world.x < current.x + 35) direction = 1;
    else if (world.x > current.x + current.width - 35) direction = -1;
    else if (brain.recent.at(-1) === "look" && random(rng) < .22) direction = direction === 1 ? -1 : 1;
    const pace = !tired && random(rng) < profile.scootChance ? "scoot" : "amble";
    // A finite run may cross more of this already-safe span. Social approaches,
    // controls and the cushion retain their short reach; walking keeps its gait.
    const variableRun = pace === "scoot" && !follows && !current.manualOnly && current.kind !== "control" && current.kind !== "hide" && !current.id.startsWith("companion-home");
    const scootSpeed = variableRun ? speed * (1 + random(rng) * .5) : speed;
    const forwardEdge = platformLandingX(current, direction > 0 ? current.x + current.width : current.x);
    const available = Math.max(0, (forwardEdge - world.x) * direction);
    // Pick one real destination across this clear span. A twelve-second
    // distance budget bounds the action without manufacturing intermediate
    // stops at180/520px; other species/social/small-support choices stay local.
    const destinationFraction = variableRun ? random(rng) < .85 ? 1 : .45 + random(rng) * .3 : 1;
    const distance = follows ? 0 : variableRun ? Math.min(available * destinationFraction, scootSpeed / .85 * 12) : Math.min(180, profile.stepMin + random(rng) * profile.stepRange);
    const desiredX = follows ? clamp(pointer.x + (world.x < pointer.x ? -1 : 1) * profile.pointerGap, world.x - profile.pointerStep, world.x + profile.pointerStep) : world.x + direction * distance;
    const walkX = platformLandingX(current, desiredX);
    if (!current.manualOnly && Math.abs(walkX - world.x) > 20) {
      const duration = Math.max(500, Math.abs(walkX - world.x) / (pace === "scoot" ? scootSpeed : speed) * (pace === "scoot" ? 850 : profile.walkScale * 1000));
      add("walk", (1 + brain.curiosity * .7 + (follows ? profile.socialPull : 0)) * mobility, variableRun ? Math.min(12000, duration) : duration, { x: walkX, y: current.y, platformId: current.id }, undefined, { pace, direction: walkX < world.x ? -1 : 1,
        ...(variableRun ? { intention: { kind: "explore", targetId: current.id, offset: unit((walkX - current.x) / current.width), remaining: 12, stage: "travel", pace, travelSpeed: Math.abs(walkX - world.x) / Math.min(12000, duration) * 1000 } } : {}) });
    }
    if (prefs.jump) {
      const reachable = reachablePlatforms(world, world.platforms).filter(p => p.id !== current.id && p.kind !== "hide" && !p.manualOnly
        && !brain.places?.some(place => place.id === p.id && place.retryAfter > (brain.activeMs ?? 0)));
      if (reachable.length) {
        const unvisited = reachable.filter(p => !brain.visited.includes(p.id));
        let choices = unvisited.length ? unvisited : reachable;
        if (cat) {
          const high = choices.filter(p => p.y < world.y - 30);
          if (high.length && random(rng) < .8) choices = high;
        }
        const platform = choices[Math.floor(random(rng) * choices.length)];
        // Reachability was proved for this nearest landing. A wide floor's
        // centre may be hundreds of pixels farther away and outside that arc.
        const nearX = platformLandingX(platform, world.x);
        const aimedX = platformLandingX(platform, nearX + direction * (28 + random(rng) * 48));
        const exactTarget = { ...platform, x: aimedX - 12, width: 24 };
        const x = reachablePlatforms(world, [exactTarget]).length ? aimedX : nearX;
        add("jump", (1 + brain.curiosity * .8 + curious + (!brain.visited.includes(platform.id) ? .45 : 0)) * mobility, 950, { x, y: platform.y, platformId: platform.id }, undefined, { direction: x < world.x ? -1 : 1 });
      }
      const hopX = platformLandingX(current, world.x + direction * (24 + random(rng) * 28));
      if (!current.manualOnly && !tired && Math.abs(hopX - world.x) > 18) add("jump", (.22 + brain.energy * .23 + (dog ? .15 : 0)) * mobility * (cat ? .25 : 1), 650, { x: hopX, y: current.y, platformId: current.id }, undefined, { jumpHeight: profile.hopHeight + random(rng) * 16, direction: hopX < world.x ? -1 : 1 });
    }
    // A prank is a local gesture on the support already occupied; navigation
    // remains a separate walk/jump, so disabled jumping cannot teleport a pet.
    if (!current.manualOnly && prefs.heartPrank && current.heart && now - brain.createdAt >= 18000) {
      add("heart", .12 + brain.affection * .2 + affectionate, COMPANION_TIMING.heart, { x: platformLandingX(current, current.heart.x), y: current.y, platformId: current.id }, current.heart);
    }
    if (prefs.ambientPrank && world.hideAvailable && current.kind === "card" && now - brain.createdAt >= 45000 && random(rng) < .08) {
      // Enter the actual occupied schedule locally. The renderer owns its
      // matched public detail and the user-driven finding session afterward.
      add("hide", .2 + brain.curiosity * .2, 700, { x: world.x, y: world.y, platformId: current.id });
    }
  }
  const total = candidates.reduce((sum, candidate) => sum + candidate.utility, 0);
  let draw = random(rng) * total;
  const decided = (action: CompanionAction) => planned.outcomes.length ? { ...action, outcomes: planned.outcomes } : action;
  for (const candidate of candidates) {
    draw -= candidate.utility;
    if (draw < 0) return decided(candidate.action);
  }
  return decided(candidates.at(-1)?.action ?? idle);
}

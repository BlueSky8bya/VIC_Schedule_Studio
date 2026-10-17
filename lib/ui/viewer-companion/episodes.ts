import type { CompanionAction, CompanionBrain, CompanionFood, CompanionWorld, Platform } from "./brain";
import type { CompanionPreferences } from "./preferences";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import { companionPlayDuration, COMPANION_TIMING } from "./timing";
import { companionRunTripContact, validCompanionRunHop, type CompanionRunTrip } from "./romp";
import { COMPANION_FULL_THRESHOLD } from "./care";
import { COMPANION_FEED_ACTION_BUDGET } from "./planner";

export type CompanionEpisode = {
  kind: "meal" | "social" | "wake";
  phase: "start" | "notice" | "greet" | "approach" | "mishap" | "meal" | "ate" | "finish";
  variant: "careful" | "dash" | "bound" | "rush-trip" | "bound-slip";
  remaining: number;
  foodId?: string;
  mishapUsed: boolean;
  legs: number;
};
type Reachable = (from: { x: number; y: number }, platforms: readonly Platform[], overrides?: { maxRise?: number; landingInset?: number }) => Platform[];
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const stationary = (world: CompanionWorld) => ({ x: world.x, y: world.y, platformId: world.platformId });
const ordinary = (p: Platform | undefined) => Boolean(p && !p.manualOnly && !p.id.startsWith("companion-home") && p.kind !== "control" && p.kind !== "hide");
const supported = (world: CompanionWorld, p: Platform | undefined) => Boolean(p && [world.x, world.y, p.x, p.y, p.width].every(Number.isFinite) && Math.abs(world.y - p.y) <= 2 && world.x >= p.x && world.x <= p.x + p.width);
export const createCompanionContext = (kind: "social" | "wake"): CompanionEpisode => ({ kind, phase: "start", variant: "careful", remaining: 2, mishapUsed: false, legs: 0 });

/** A live encounter owns one snack until consume, cancellation or its budget. */
export function pendingCompanionMealId(brain: CompanionBrain): string | undefined {
  const episode = brain.episode;
  if (!episode || episode.kind !== "meal" || !episode.foodId || episode.remaining <= 0 || episode.phase === "ate" || episode.phase === "finish"
    || brain.foodGoal?.foodId === episode.foodId && brain.foodGoal.remaining <= 0
    || brain.intention?.kind === "feed" && brain.intention.foodId === episode.foodId && brain.intention.remaining <= 0) return;
  return episode.foodId;
}

/** Revoke future beats without changing the current real landing/flight. */
export function cancelCompanionEpisode(brain: CompanionBrain, action: CompanionAction | null): { brain: CompanionBrain; action: CompanionAction | null } {
  return { brain: { ...brain, episode: undefined }, action: action ? { ...action, episode: undefined, episodeCancelled: true } : null };
}

/** One draw for a whole encounter, not a fresh gag after each route leg. */
function chooseVariant(prefs: CompanionPreferences, brain: CompanionBrain, now: number, rng: () => number): CompanionEpisode["variant"] {
  const profile = getCompanionBehaviorProfile(prefs, brain.habits), cat = prefs.animalMode === "cat", dog = prefs.animalMode === "dog";
  const sleepy = prefs.personality === "sleepy", mishap = (brain.cooldowns.mishap ?? -Infinity) <= now && brain.energy >= .4;
  const choices: [CompanionEpisode["variant"], number][] = [
    ["careful", (cat ? 3 : 1) * (sleepy ? 3 : 1)],
    ["dash", cat ? 0 : (dog ? 3 : 2) * (sleepy ? .35 : 1)],
    ["bound", prefs.jump ? (cat ? 2 : dog ? 2.5 : 1.5) * (sleepy ? .35 : 1) : 0],
    ["rush-trip", !cat && mishap ? profile.accidentChance * 10 : 0],
    ["bound-slip", prefs.jump && mishap ? profile.accidentChance * 7 : 0],
  ];
  const value = rng();
  let draw = clamp(Number.isFinite(value) ? value : 0, 0, .999999999) * choices.reduce((sum, choice) => sum + choice[1], 0);
  for (const [variant, weight] of choices) { draw -= weight; if (draw < 0) return variant; }
  return "careful";
}

/** Current coordinates and the normal food planner remain authoritative.
 * The episode remembers identity/intent only, never an array of old actions. */
export function planCompanionEpisode(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionPreferences, now: number, foodAction: CompanionAction | undefined, rng: () => number, reachable: Reachable): CompanionAction | undefined {
  const p = world.platforms.find(item => item.id === world.platformId);
  let episode = brain.episode;
  if (!world.animated || !prefs.enabled || !prefs.roam || world.paused || !supported(world, p) || brain.hunger >= .85 && episode?.kind !== "meal") return;
  const here = stationary(world);
  const step = (action: CompanionAction, phase: CompanionEpisode["phase"], state = episode!): CompanionAction => ({ ...action, episode: { ...state, phase } });
  if (episode && (episode.remaining <= 0 || episode.phase === "finish")) return;
  if (episode?.kind === "wake" || episode?.kind === "social") {
    if (episode.phase === "start") {
      if (episode.kind === "wake" || prefs.personality === "sleepy") return step({ kind: "stretch", target: here, duration: 1000 }, "greet");
      const play = prefs.animalMode === "cat" ? "groom" : prefs.animalMode === "dog" || !prefs.jump ? "bow" : "celebrate";
      return step({ kind: "play", play, target: here, duration: companionPlayDuration(play) }, "greet");
    }
    return step(episode.kind === "wake" ? { kind: "shake", target: here, duration: 550 }
      : { kind: "look", target: here, duration: 350, ...(world.pointer ? { attention: { kind: "social", point: { ...world.pointer } } as const } : {}) }, "finish");
  }
  if (episode?.kind === "meal" && episode.phase === "ate") {
    // The actual consume event alone reaches this phase. Never carry foodId
    // on a finish action: the successfully eaten entity no longer exists.
    if (prefs.personality === "sleepy") return step({ kind: "stretch", target: here, duration: 1000 }, "finish");
    if (prefs.animalMode === "cat" || prefs.animalMode === "dog") {
      const play = prefs.animalMode === "cat" ? "groom" : "bow";
      return step({ kind: "play", play, target: here, duration: companionPlayDuration(play) }, "finish");
    }
    return step({ kind: "shake", target: here, duration: 550 }, "finish");
  }
  if (!ordinary(p) || !prefs.feeding || brain.energy < .28) return;
  if (episode?.kind === "meal" && (brain.hunger < COMPANION_FULL_THRESHOLD || !pendingCompanionMealId(brain))) return;
  if (!episode) {
    const food = world.foods?.find(item => item.id === foodAction?.foodId);
    if (brain.hunger >= .85 || !food || !foodAction || !["walk", "jump"].includes(foodAction.kind) || Math.hypot(food.x - world.x, food.y - world.y) < 96
      || (brain.cooldowns.episode ?? -Infinity) > now || (brain.foodGoal?.remaining ?? 32) < 6) return;
    episode = { kind: "meal", phase: "start", variant: chooseVariant(prefs, brain, now, rng), remaining: 24, foodId: food.id, mishapUsed: false, legs: 0 };
  }
  const food = world.foods?.find(item => item.id === episode!.foodId);
  if (!food || ![food.x, food.y].every(Number.isFinite)) {
    // Missing/held/hidden targets still cancel instead of becoming another meal.
    return { kind: "look", target: here, duration: 300 };
  }
  if (!foodAction || foodAction.foodId !== episode.foodId || !foodAction.intention) {
    // A real snack can briefly lack a route or wait for the eating cooldown.
    // Commit this finite recheck normally so neither action budget is renewed.
    const target = world.platforms.find(item => item.id === food.platformId);
    const previous = brain.intention?.kind === "feed" && brain.intention.foodId === food.id ? brain.intention : undefined;
    const remaining = Math.min(COMPANION_FEED_ACTION_BUDGET, brain.foodGoal?.foodId === food.id ? brain.foodGoal.remaining : COMPANION_FEED_ACTION_BUDGET, previous?.remaining ?? COMPANION_FEED_ACTION_BUDGET);
    const fraction = target && Number.isFinite(target.x) && Number.isFinite(target.width) && target.width > 0 ? (food.x - target.x) / target.width : previous?.offset;
    const offset = fraction !== undefined && Number.isFinite(fraction) ? clamp(fraction, 0, 1) : .5;
    return step({ kind: "look", target: here, duration: 300, foodId: food.id, direction: food.x < world.x ? -1 : 1,
      intention: { kind: "feed", targetId: food.platformId ?? "", offset, remaining, stage: "consider", foodId: food.id } }, episode.phase);
  }
  const identity = { foodId: food.id, intention: { ...foodAction.intention } };
  if (episode.phase === "start") return step({ kind: "look", target: here, duration: prefs.animalMode === "cat" ? 320 : 220,
    ...identity, attention: { kind: "inspect", goal: { ...foodAction.intention, stage: "consider" } }, direction: food.x < world.x ? -1 : 1 }, "notice");
  if (episode.phase === "notice") {
    if (episode.variant === "careful") return step({ kind: "sniff", target: here, duration: prefs.animalMode === "cat" ? 500 : 340, ...identity, direction: food.x < world.x ? -1 : 1 }, "greet");
    const play = prefs.animalMode === "cat" ? "pounce" : prefs.animalMode === "dog" || !prefs.jump ? "bow" : "celebrate";
    return step({ kind: "play", play, target: here, duration: companionPlayDuration(play), ...identity, direction: food.x < world.x ? -1 : 1 }, "greet");
  }
  if (episode.phase === "meal") return { ...foodAction }; // no consume success: no invented afterglow
  if (foodAction.kind === "eat") return step(foodAction, "meal");
  const state = { ...episode, legs: episode.legs + 1 };
  if (foodAction.kind !== "walk") return step(foodAction, "approach", state);
  const profile = getCompanionBehaviorProfile(prefs, brain.habits), distance = Math.abs(foodAction.target.x - world.x);
  const lively = !episode.mishapUsed && episode.variant !== "careful" && prefs.animalMode !== "cat" && brain.energy >= .35;
  const action: CompanionAction = { ...foodAction, pace: lively ? "scoot" : "amble",
    duration: Math.max(500, distance / (profile.walkSpeed * (lively ? 1.3 : 1)) * 1000) };
  if (prefs.jump && !episode.mishapUsed && episode.legs > 0 && ["bound", "bound-slip"].includes(episode.variant) && p && !p.manualOnly && p.width >= 100
    && foodAction.target.platformId === p.id && distance >= 48 && distance <= 200) {
    const height = Math.min(105, profile.hopHeight + 40);
    if (reachable(world, [{ ...p, x: foodAction.target.x - 1, width: 2 }], { maxRise: height, landingInset: 0 }).length) {
      const flight = 2 * Math.sqrt(2 * 1100 * height) / 1100;
      return step({ ...action, kind: "jump", jumpHeight: height, duration: flight * 1000 + COMPANION_TIMING.jumpLanding }, "approach", state);
    }
  }
  return step(action, "approach", state);
}

/** The final derivative of sampleCompanionRunUp is the walk's mean speed.
 * Prove the next finite hop at that speed before choosing that walk curve. */
export function companionEpisodeRunHop(action: CompanionAction, from: { x: number; y: number }, p: Platform | undefined, foods: readonly CompanionFood[], brain: CompanionBrain, prefs: CompanionPreferences): CompanionAction | undefined {
  const episode = brain.episode;
  if (!action.episode || !episode || episode.kind !== "meal" || episode.phase !== "approach" || episode.foodId !== action.foodId || episode.mishapUsed
    || !["bound", "bound-slip"].includes(episode.variant) || !prefs.jump || !prefs.roam || !prefs.enabled || action.kind !== "walk" || action.pace !== "scoot"
    || !p || !ordinary(p) || action.target.platformId !== p.id || !supported({ ...from, platforms: [p], width: 0, height: 0 }, p)
    || action.duration < 350 || Math.abs(action.target.x - from.x) < 48) return;
  const direction = action.target.x < from.x ? -1 : 1;
  const height = Math.min(105, getCompanionBehaviorProfile(prefs, brain.habits).hopHeight + 40);
  const flight = 2 * Math.sqrt(2 * 1100 * height) / 1100;
  const speed = Math.abs(action.target.x - from.x) / action.duration * 1000;
  const hop: CompanionAction = { kind: "jump", target: { x: action.target.x + direction * speed * flight, y: p.y, platformId: p.id },
    duration: flight * 1000 + COMPANION_TIMING.jumpLanding, direction, runUp: speed, jumpHeight: height, foodId: episode.foodId,
    ...(action.intention ? { intention: { ...action.intention, remaining: Math.min(action.intention.remaining, brain.foodGoal?.remaining ?? action.intention.remaining) } } : {}),
    episode: { ...episode, legs: episode.legs + 1 } };
  return validCompanionRunHop(hop, action.target, p) && companionEpisodeHopAvailable(hop, p, foods) ? hop : undefined;
}

export function companionEpisodeHopAvailable(hop: CompanionAction, p: Platform | undefined, foods: readonly CompanionFood[]): boolean {
  const food = foods.find(item => item.id === hop.foodId);
  return Boolean(food && p && Math.abs(food.y - p.y) <= 4 && food.x >= p.x && food.x <= p.x + p.width && (food.x - hop.target.x) * (hop.direction ?? 1) >= 8);
}

/** Only the selected snack can trigger the one authored running accident. */
export function companionEpisodeRunTrip(action: CompanionAction, from: { x: number; y: number }, p: Platform | undefined, foods: readonly CompanionFood[], brain: CompanionBrain, now: number, prefs: CompanionPreferences): CompanionRunTrip | undefined {
  const episode = action.episode;
  if (!episode || episode.kind !== "meal" || episode.phase !== "approach" || episode.variant !== "rush-trip" || episode.mishapUsed
    || action.kind !== "walk" || action.pace !== "scoot" || !ordinary(p) || !p || (brain.cooldowns.mishap ?? -Infinity) > now) return;
  const food = foods.find(item => item.id === episode.foodId);
  if (!food || Math.abs(food.y - p.y) > 4 || Math.abs(food.x - from.x) < 64) return;
  const direction = action.target.x < from.x ? -1 : 1;
  const trip: CompanionRunTrip = { cause: "food", foodId: food.id, x: food.x - direction * 10, play: prefs.jump && Math.min(food.x - p.x, p.x + p.width - food.x) >= 40 ? "tumble" : "bump" };
  return companionRunTripContact(trip, from, action.target, p, foods) === null ? undefined : trip;
}

/** Actual completed landing/contact owns this finite reaction. A subsequent
 * approach replans the same snack; it can never roll again in this episode. */
export function companionEpisodeMishap(action: CompanionAction, point: { x: number; y: number }, p: Platform | undefined, brain: CompanionBrain, now: number, prefs: CompanionPreferences, landing = false): CompanionAction | undefined {
  const episode = action.episode && brain.episode?.foodId === action.episode.foodId ? brain.episode : undefined;
  if (!episode || episode.kind !== "meal" || episode.mishapUsed || episode.phase !== "approach" || !ordinary(p) || !p
    || (brain.cooldowns.mishap ?? -Infinity) > now || !supported({ ...point, platformId: p.id, platforms: [p], width: 0, height: 0 }, p)
    || landing && (action.kind !== "jump" || episode.variant !== "bound-slip")) return;
  const direction = action.direction ?? brain.heading;
  const clearance = Math.min(point.x - p.x, p.x + p.width - point.x);
  const rolling = prefs.jump && p.width >= 100 && clearance >= 28;
  const play = rolling ? landing ? "slip-tumble" : "tumble" : landing ? "slip" : "bump";
  const x = rolling ? clamp(point.x + direction * 56, p.x + 12, p.x + p.width - 12) : point.x;
  return { kind: "play", play, target: { x, y: p.y, platformId: p.id }, duration: companionPlayDuration(play),
    ...(rolling ? { rolling: true } : {}), foodId: episode.foodId, ...(action.intention ? { intention: { ...action.intention, remaining: Math.min(action.intention.remaining, brain.foodGoal?.remaining ?? action.intention.remaining) } } : {}),
    episode: { ...episode, phase: "mishap", mishapUsed: true }, direction };
}

/** World momentum only during the authored rolling beat; no return-to-origin
 * sinusoid and no final snap. The normal animation clock samples this curve. */
export function companionRollProgress(kind: CompanionAction["play"], elapsed: number): number {
  const begin = kind === "slip-tumble" ? 180 : 0, t = clamp((elapsed - begin) / 620, 0, 1);
  return 1 - (1 - t) ** 2;
}

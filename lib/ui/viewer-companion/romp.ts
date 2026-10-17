import { COMPANION_JUMP_LIMITS, platformLandingX, reachablePlatforms, type CompanionAction, type CompanionFood, type Platform } from "./brain";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionPreferences } from "./preferences";

export type CompanionRunTrip = { x: number; play: "tumble" | "bump"; cause: "food" | "stumble"; foodId?: string };
export type CompanionRomp = { trip?: CompanionRunTrip; walk?: CompanionAction; hop?: CompanionAction };
type Point = { x: number; y: number };
type Input = { action: CompanionAction; from: Point; platform?: Platform; foods: readonly CompanionFood[]; energy: number; cooldownReady: boolean };
const unit = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 1));
const home = (p: Platform) => p.id.startsWith("companion-home");

/** One bounded decision for one real autonomous run. No frame probability,
 * hidden stone, food mutation, route graph or independent timer lives here. */
export function planCompanionRomp(input: Input, prefs: CompanionPreferences, rng: () => number = Math.random): CompanionRomp {
  const { action, from, platform: p, energy } = input;
  if (!prefs.enabled || !prefs.roam || action.kind !== "walk" || action.pace !== "scoot" || action.foodId || action.intention && action.intention.kind !== "explore" || !p || p.manualOnly || home(p)
    || p.kind === "control" || p.kind === "hide" || p.width < 64 || action.target.platformId !== p.id
    || ![from.x, from.y, p.x, p.y, p.width, action.target.x, action.target.y, action.duration, energy].every(Number.isFinite)
    || action.duration < 350 || energy < .28 || Math.abs(from.y - p.y) > 2 || Math.abs(action.target.y - p.y) > 2
    || from.x < p.x || from.x > p.x + p.width || action.target.x < p.x || action.target.x > p.x + p.width) return {};
  const distance = Math.abs(action.target.x - from.x), direction = action.target.x < from.x ? -1 : 1;
  if (distance < 48) return {};
  const profile = getCompanionBehaviorProfile(prefs);
  const trip = (x: number, cause: CompanionRunTrip["cause"], foodId?: string): CompanionRomp => ({ trip: {
    x, cause, ...(foodId ? { foodId } : {}),
    play: prefs.jump && Math.min(x - p.x, p.x + p.width - x) >= 28 ? "tumble" : "bump",
  } });
  if (input.cooldownReady) {
    // foods() already excludes lifted, falling, hidden and consumed items.
    // Different pet/food floor IDs may name the same measured physical plane.
    const food = input.foods.slice(0, 8).filter(food => [food.x, food.y].every(Number.isFinite) && Math.abs(food.y - p.y) <= 4
      && (food.x - from.x) * direction >= 34 && (action.target.x - food.x) * direction >= 12 && food.x >= p.x + 12 && food.x <= p.x + p.width - 12)
      .sort((a, b) => (a.x - b.x) * direction)[0];
    if (food && unit(rng()) < Math.min(1, profile.accidentChance * 6)) return trip(food.x - direction * 10, "food", food.id);
    if (unit(rng()) < profile.accidentChance) return trip(from.x + direction * distance * (.35 + unit(rng()) * .3), "stumble");
  }
  if (!prefs.jump || energy < .4 || unit(rng()) >= .35 + profile.scootChance * .25) return {};
  const height = Math.min(110, (profile.hopHeight + 24) * (1 + unit(rng()) * .5));
  const flight = 2 * Math.sqrt(2 * COMPANION_JUMP_LIMITS.gravity * height) / COMPANION_JUMP_LIMITS.gravity;
  const speed = distance / action.duration * 1000, goal = action.intention;
  if (goal && (!Number.isFinite(goal.remaining) || goal.remaining <= 1)) return {};
  let takeoff = action.target, walk: CompanionAction | undefined;
  let targetX = platformLandingX(p, action.target.x + direction * speed * flight);
  if (goal?.targetId === p.id) {
    if (!Number.isFinite(goal.offset) || goal.stage !== "travel") return {};
    const goalX = platformLandingX(p, p.x + p.width * Math.max(0, Math.min(1, goal.offset)));
    // A hop belongs inside the retained journey, never beyond its destination.
    // Keep a small final approach after the landing rather than reversing.
    targetX = goalX - direction * 64;
    takeoff = { ...action.target, x: targetX - direction * speed * flight };
    const runDistance = (takeoff.x - from.x) * direction, duration = runDistance / speed * 1000;
    if (Math.abs(goalX - action.target.x) > 1 || runDistance < 48 || duration < 350
      || takeoff.x < p.x + 12 || takeoff.x > p.x + p.width - 12) return {};
    walk = { ...action, target: takeoff, duration, intention: { ...goal } };
  }
  const hop: CompanionAction = { kind: "jump", target: { x: targetX, y: p.y, platformId: p.id }, direction, jumpHeight: height, runUp: speed, duration: flight * 1000 + 180,
    ...(goal ? { intention: { ...goal, remaining: goal.remaining - 1 } } : {}) };
  return validCompanionRunHop(hop, takeoff, p) ? { ...(walk ? { walk } : {}), hop } : {};
}

/** Reprove after scrolling/reflow, against the actual current support. */
export function validCompanionRunHop(hop: CompanionAction, from: Point, p?: Platform): boolean {
  if (!p || p.manualOnly || home(p) || p.kind === "control" || p.kind === "hide" || hop.kind !== "jump" || !hop.runUp || !hop.jumpHeight
    || ![p.x, p.y, p.width, from.x, from.y, hop.target.x, hop.target.y, hop.runUp, hop.jumpHeight].every(Number.isFinite)
    || hop.target.platformId !== p.id || Math.abs(from.y - p.y) > 2 || Math.abs(hop.target.y - p.y) > 2
    || Math.abs(hop.target.x - from.x) < 48 || Math.abs(hop.target.x - from.x) > COMPANION_JUMP_LIMITS.maxDistance
    || hop.runUp <= 0 || hop.runUp > COMPANION_JUMP_LIMITS.horizontalSpeed || hop.jumpHeight <= 0 || hop.jumpHeight > 110
    || from.x < p.x || from.x > p.x + p.width || hop.target.x < p.x + 12 || hop.target.x > p.x + p.width - 12) return false;
  const flight = 2 * Math.sqrt(2 * COMPANION_JUMP_LIMITS.gravity * hop.jumpHeight) / COMPANION_JUMP_LIMITS.gravity;
  // A clamped landing must not silently turn a running takeoff into a slow hop.
  if (Math.abs(Math.abs(hop.target.x - from.x) / flight - hop.runUp) > Math.max(.5, hop.runUp * .015)) return false;
  return reachablePlatforms(from, [{ ...p, x: hop.target.x - 1, width: 2 }], { maxRise: hop.jumpHeight, landingInset: 0 }).length === 1;
}

/** A moved/lifted snack cancels its contact; it cannot trip the pet remotely. */
export function companionRunTripContact(trip: CompanionRunTrip, from: Point, target: Point, p: Platform | undefined, foods: readonly CompanionFood[]): number | null {
  if (!p || p.manualOnly || home(p) || Math.abs(from.y - p.y) > 2 || Math.abs(target.y - p.y) > 2) return null;
  const direction = target.x < from.x ? -1 : 1;
  const food = trip.foodId ? foods.find(food => food.id === trip.foodId && Math.abs(food.y - p.y) <= 4) : undefined;
  if (trip.foodId && !food) return null;
  const x = food ? food.x - direction * 10 : trip.x;
  return Number.isFinite(x) && x >= p.x + 8 && x <= p.x + p.width - 8 && (x - from.x) * direction >= 24 && (target.x - x) * direction >= 8 ? x : null;
}

/** End speed stays nonzero for a proved run-up; ordinary walks still stop. */
export function sampleCompanionRunUp(progress: number): number {
  const p = unit(progress);
  return p * p * (2 - p);
}

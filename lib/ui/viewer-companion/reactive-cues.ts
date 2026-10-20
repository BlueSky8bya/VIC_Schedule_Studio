import { findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionWorld } from "./brain";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import { COMPANION_FULL_THRESHOLD } from "./care";
import { MAX_COMPANION_FOOD } from "./food-capacity";
import { companionPrivateHomeSupport } from "./life-space";
import type { CompanionPreferences } from "./preferences";

/** Four ranked real supports, one proved leg; no cursor or geometry ownership. */
export function findCompanionPointerRoute(world: CompanionWorld, preferences: CompanionPreferences, gap: number, outsideOnly = false) {
  const pointer = world.pointer;
  if (!pointer || ![pointer.x, pointer.y, world.x, world.y, gap].every(Number.isFinite)) return;
  const platforms = world.platforms.slice(0, 200);
  const candidates = platforms.filter(platform => !platform.manualOnly && !platform.bodyOnly && (!outsideOnly || !companionPrivateHomeSupport(platform.id)) && !["hide", "control"].includes(platform.kind)
    && [platform.x, platform.y, platform.width].every(Number.isFinite) && platform.width > 0)
    .map(platform => {
      const x = platformLandingX(platform, pointer.x + (world.x <= pointer.x ? -gap : gap));
      return { target: { x, y: platform.y, platformId: platform.id }, distance: Math.hypot(x - pointer.x, platform.y - pointer.y) };
    }).sort((a, b) => a.distance - b.distance).slice(0, 4);
  for (const candidate of candidates) {
    const route = findPlatformRoute(world, candidate.target, platforms, preferences.jump);
    if (route) return { target: candidate.target, step: route[0] };
  }
}

type ReactiveAction = CompanionAction & { scene?: { id: number }; toy?: unknown; household?: unknown; radio?: unknown };
export type CompanionReactiveInput = {
  world: CompanionWorld; brain: CompanionBrain; preferences: CompanionPreferences;
  action: ReactiveAction | null; now: number;
  active: boolean; grounded: boolean; held?: boolean; commanded?: boolean; busy?: boolean;
};

/** The existing host tick asks for a safe ground replan. No new loop/timer,
 * state injection, care reward or repeated interruption of an unchanged run. */
export function createCompanionReactiveCues() {
  let nextProbeAt = 0, pointerX = NaN, pointerY = NaN, pointerAttempts = 0, pointerRetryAt = 0;
  let profilePreferences: CompanionPreferences | undefined;
  let profile: ReturnType<typeof getCompanionBehaviorProfile> | undefined;
  const foods = new Map<string, { remaining: number; retryAt: number }>();
  return {
    notice(input: CompanionReactiveInput): "pointer" | "food" | undefined {
      const { world, brain, preferences: p, action, now } = input;
      if (!input.active || !input.grounded || input.held || input.commanded || input.busy || !p.enabled || !p.roam || !world.animated || world.paused
        || !Number.isFinite(now) || now < nextProbeAt || ![world.x, world.y].every(Number.isFinite) || brain.energy < .28
        || !action || !["walk", "idle", "look"].includes(action.kind) || action.living || action.accessory || action.radio || action.scene && ![31, 32, 33, 35].includes(action.scene.id) || action.toy || action.household
        || brain.foodGoal || brain.intention && brain.intention.kind !== "explore" || brain.episode && brain.episode.remaining > 0) return;
      if (p !== profilePreferences) { profilePreferences = p; profile = getCompanionBehaviorProfile(p); }
      const rhythm = profile!;
      nextProbeAt = now + Math.min(250, rhythm.noticeMs);
      if (p.feeding && brain.hunger >= COMPANION_FULL_THRESHOLD && world.foods?.length) {
        let proofs = 0;
        for (const food of world.foods.slice(0, MAX_COMPANION_FOOD)) {
          if (!food.id || ![food.x, food.y].every(Number.isFinite)) continue;
          let record = foods.get(food.id);
          if (!record) { record = { remaining: 2, retryAt: 0 }; foods.set(food.id, record); if (foods.size > 16) foods.delete(foods.keys().next().value!); }
          if (!record.remaining || record.retryAt > now || proofs >= 4) continue;
          proofs++; record.remaining--; record.retryAt = now + rhythm.activityCadenceMs;
          if (findPlatformRoute(world, food, world.platforms, p.jump, food.platformId)) { record.remaining = 0; return "food"; }
        }
        // A real meal keeps priority even when the first route is blocked.
        return;
      }
      const pointer = world.pointer;
      if (!p.petting || p.animalMode !== "dog" && p.personality !== "affectionate" || !pointer
        || ![pointer.x, pointer.y, pointer.stableMs].every(Number.isFinite) || pointer.stableMs! < rhythm.noticeMs
        || Math.hypot(pointer.x - world.x, pointer.y - world.y) < 96) return;
      if (!Number.isFinite(pointerX) || Math.hypot(pointer.x - pointerX, pointer.y - pointerY) >= 40) {
        pointerX = pointer.x; pointerY = pointer.y; pointerAttempts = 0; pointerRetryAt = now;
      }
      if (pointerAttempts >= 2 || now < pointerRetryAt) return;
      const route = findCompanionPointerRoute(world, p, rhythm.pointerGap);
      pointerAttempts++; pointerRetryAt = now + rhythm.activityCadenceMs;
      if (route?.step) return "pointer";
    },
  };
}

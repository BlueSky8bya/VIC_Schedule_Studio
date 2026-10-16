import type { CompanionAction, CompanionBehaviorPreferences, CompanionBrain, CompanionFood, CompanionWorld, Platform } from "./brain";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionIntention } from "./planner";

/** Attention refers to the current local world, never a saved next action or
 * schedule text. The renderer resolves this point without planning a route. */
export type CompanionAttention = {
  kind: "inspect" | "reconsider" | "social";
  goal?: CompanionIntention;
  point?: { x: number; y: number };
};

const finitePoint = (point: { x: number; y: number } | undefined): point is { x: number; y: number } => Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.y));
const unit = (value: number) => Math.max(0, Math.min(1, value));
const sameGoal = (a: CompanionIntention, b: CompanionIntention) => a.kind === b.kind && (a.kind === "feed"
  ? Boolean(a.foodId && a.foodId === b.foodId)
  : a.targetId === b.targetId);

/** Resolve on existing geometry/food deliveries. A missing offered snack must
 * not silently turn into the old platform position or a different snack. */
export function companionAttentionPoint(attention: CompanionAttention | undefined, platforms: readonly Platform[], foods: readonly CompanionFood[] = []): { x: number; y: number } | undefined {
  if (!attention) return;
  if (attention.goal) {
    const goal = attention.goal;
    if (goal.foodId) {
      const food = foods.find(item => item.id === goal.foodId);
      return finitePoint(food) ? { x: food.x, y: food.y } : undefined;
    }
    const platform = platforms.find(item => item.id === goal.targetId && item.kind !== "hide" && Number.isFinite(item.x) && Number.isFinite(item.y) && Number.isFinite(item.width) && item.width > 0);
    if (!platform || !Number.isFinite(goal.offset)) return;
    const point = { x: platform.x + platform.width * unit(goal.offset), y: platform.y };
    return finitePoint(point) ? point : undefined;
  }
  return finitePoint(attention.point) ? { ...attention.point } : undefined;
}

/** One short, deterministic observation at a genuine decision boundary.
 * Existing goal/route code remains the authority on the following decision;
 * no candidate action or old absolute destination is queued for later. */
export function deliberateCompanionAction(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionBehaviorPreferences, candidate: CompanionAction, animated = true): CompanionAction {
  if (!animated || !prefs.enabled || !prefs.roam || world.paused || !finitePoint(world) || candidate.attention || candidate.kind === "eat" || brain.hunger >= .85) return candidate;

  const previous = brain.intention;
  const failedGoal = previous && (previous.stage === "consider" || previous.stage === "travel") && candidate.outcomes?.some(outcome => outcome.targetId === previous.targetId && (outcome.result === "lost" || outcome.result === "blocked"));
  if (failedGoal) {
    return {
      kind: "look", target: { x: world.x, y: world.y, platformId: world.platformId }, duration: 480,
      attention: { kind: "reconsider", goal: { ...previous } }, outcomes: candidate.outcomes,
    };
  }

  const moving = candidate.kind === "walk" || candidate.kind === "jump";
  if (moving && finitePoint(candidate.target) && (candidate.kind !== "jump" || prefs.jump)) {
    const support = world.platforms.find(platform => platform.id === candidate.target.platformId && platform.kind !== "hide" && Number.isFinite(platform.x) && Number.isFinite(platform.y) && Number.isFinite(platform.width) && platform.width > 0);
    const newSupport = support && support.id !== world.platformId && !support.manualOnly;
    const goal = candidate.intention ?? (newSupport ? {
      kind: "explore" as const, targetId: support.id, offset: unit((candidate.target.x - support.x) / support.width), remaining: 12, stage: "travel" as const,
    } : undefined);
    if (goal && Number.isFinite(goal.offset) && goal.remaining > 0) {
      const retained = previous && (previous.stage === "consider" || previous.stage === "travel") && sameGoal(previous, goal);
      const point = companionAttentionPoint({ kind: "inspect", goal }, world.platforms, world.foods);
      if (!retained && point) {
        const speciesMs = prefs.animalMode === "cat" ? 410 : prefs.animalMode === "dog" ? 250 : 330;
        const gaitScale = prefs.speed === "relaxed" ? 1.2 : prefs.speed === "lively" ? .8 : 1;
        const duration = Math.max(180, Math.min(520, Math.round(speciesMs * gaitScale)));
        const intention: CompanionIntention = { ...goal, stage: "consider" };
        return {
          kind: "look", target: { x: world.x, y: world.y, platformId: world.platformId }, duration,
          direction: point.x === world.x ? brain.heading : point.x < world.x ? -1 : 1,
          intention, attention: { kind: "inspect", goal: { ...intention } },
          ...(candidate.foodId ? { foodId: candidate.foodId } : {}),
          ...(candidate.outcomes?.length ? { outcomes: candidate.outcomes } : {}),
        };
      }
    }
  }

  // Existing local social choices gain a real gaze cue, not an additional
  // action. Cats without the affectionate personality keep their own distance.
  const pointer = world.pointer;
  if ((candidate.kind === "look" || candidate.kind === "sniff") && !candidate.intention && getCompanionBehaviorProfile(prefs).socialPull >= 1
    && finitePoint(pointer) && Math.abs(pointer.x - world.x) < 600 && Math.abs(pointer.y - world.y) < 160) {
    return { ...candidate, direction: pointer.x === world.x ? brain.heading : pointer.x < world.x ? -1 : 1, attention: { kind: "social", point: { ...pointer } } };
  }
  return candidate;
}

import { findPlatformRoute, type CompanionAction, type CompanionBrain, type CompanionPlay, type CompanionWorld } from "./brain";
import type { CompanionPreferences } from "./preferences";
import { companionPlayDuration } from "./timing";
import { shouldDeclineCompanionFood, type CompanionTastes } from "./toy-tastes";
import type { CompanionFoodKind } from "./snacks";

type PersonalityAction = CompanionAction & { foodRefusal?: { foodId: string; kind: CompanionFoodKind }; personalitySignature?: CompanionPreferences["personality"] };
type Activity = PersonalityAction & { scene?: { id: number }; toy?: unknown; household?: unknown; radio?: unknown };
/** Reserve a due fitting expression before creating a new secondary job.
 * The caller may still choose real radio/direct care first; only launch
 * records this candidate. Existing owned goals keep their current action. */
export function preflightCompanionPersonalityActivity(activity: { due: (now: number) => boolean; choose: (brain: CompanionBrain, world: CompanionWorld, preferences: CompanionPreferences, now: number) => PersonalityAction | undefined }, brain: CompanionBrain, world: CompanionWorld, preferences: CompanionPreferences, now: number, owners: { scene: boolean; household: boolean; toy: boolean; home: boolean; blocked: boolean }, candidate?: PersonalityAction) {
  if (owners.scene || owners.household || owners.toy || owners.home || owners.blocked
    || brain.foodGoal || brain.episode || brain.intention && brain.intention.kind !== "explore") return;
  // A same-tick cue already selected this expression. Keep its one draw and
  // object identity; merely considering it still cannot reset the budget.
  return activity.due(now) ? candidate ?? activity.choose(brain, world, preferences, now) : undefined;
}
/** A decision-boundary fallback, never a periodic cancellation or extra clock.
 * Empty look/idle loops cannot reset this budget. Real travel, care and a
 * finite authored performance keep their current owner until they finish. */
export function createCompanionPersonalityActivity(rng: () => number = Math.random) {
  let lastMeaningfulAt = -8000;
  let previousPlay: CompanionPlay | undefined;
  let blockedKey = "", blockedAt = 0, blockedX = 0, blockedY = 0;
  const explored = new Set<string>();
  let refuseAt = 0;
  const meals = new Map<string, { support?: string; target?: string; jump: boolean; until: number; reachable: boolean }>();
  const hasReachableMeal = (brain: CompanionBrain, world: CompanionWorld, preferences: CompanionPreferences, now: number) => {
    if (!preferences.feeding || brain.hunger < .35) return false;
    let proofs = 0, pending = false;
    for (const food of (world.foods ?? []).slice(0, 8)) {
      let cached = meals.get(food.id);
      if (!cached || cached.support !== world.platformId || cached.target !== food.platformId || cached.jump !== preferences.jump || cached.until <= now) {
        if (proofs >= 4) { pending = true; continue; }
        proofs++;
        cached = { support: world.platformId, target: food.platformId, jump: preferences.jump, until: now + 6000, reachable: Boolean(findPlatformRoute(world, food, world.platforms, preferences.jump, food.platformId)) };
        meals.set(food.id, cached); if (meals.size > 8) meals.delete(meals.keys().next().value!);
      }
      if (cached.reachable) return true;
    }
    return pending;
  };
  const clips: Record<CompanionPreferences["personality"], readonly CompanionPlay[]> = {
    curious: ["pounce", "bow", "celebrate"], affectionate: ["ask-petting", "lean-nuzzle", "bow"], sleepy: ["groom", "ask-petting", "lean-nuzzle"],
    tidy: ["groom", "bow", "ask-petting"], mischievous: ["bow", "pounce", "celebrate"], gourmet: ["ask-petting", "bow", "groom"],
    performer: ["cheer-rehearsal", "celebrate", "bow"], homebody: ["lean-nuzzle", "groom", "ask-petting"], balanced: ["bow", "groom", "celebrate", "ask-petting"],
  };
  return {
    due(now: number) { return Number.isFinite(now) && now - lastMeaningfulAt >= 8000; },
    boundWander<T extends Activity>(action: T, world: CompanionWorld, preferences: CompanionPreferences, now: number): T {
      if (action.kind !== "walk" || action.target.platformId !== world.platformId || action.foodId || action.foodRefusal || action.living || action.scene || action.toy || action.household || action.radio || action.accessory
        || preferences.personality === "curious" && action.intention?.kind === "explore" && !explored.has(action.intention.targetId)) return action;
      // Choose a shorter same-support destination before the walk starts.
      // Existing real goals are never cut off by a periodic interruption.
      const budget = Math.max(350, 7700 - (now - lastMeaningfulAt));
      if (action.duration <= budget) return action;
      return { ...action, duration: budget, intention: undefined, target: { ...action.target, x: world.x + (action.target.x - world.x) * budget / action.duration } };
    },
    record(action: Activity, from: { x: number; y: number }, now: number, personality: CompanionPreferences["personality"] = "curious") {
      const travel = ["walk", "jump"].includes(action.kind) && Math.hypot(action.target.x - from.x, action.target.y - from.y) >= 24;
      const destination = action.intention?.kind === "explore" ? action.intention.targetId : undefined;
      const newExploration = personality === "curious" && travel && destination && !explored.has(destination);
      if (newExploration) { explored.add(destination); if (explored.size > 32) explored.delete(explored.values().next().value!); }
      const directed = travel && (action.foodId || action.foodRefusal || action.living || action.toy || action.household || action.scene && action.scene.id <= 30 || action.intention?.kind === "feed");
      const purpose = action.personalitySignature || action.living || action.foodId || action.foodRefusal || action.episode
        || action.scene && action.scene.id <= 30 || action.toy || action.household || action.radio || action.accessory || action.attention?.kind === "social";
      if (Number.isFinite(now) && (directed || newExploration || ["eat", "sleep", "heart", "hide"].includes(action.kind) || purpose)) { lastMeaningfulAt = now; if (action.play) previousPlay = action.play; }
    },
    choose(brain: CompanionBrain, world: CompanionWorld, preferences: CompanionPreferences, now: number): PersonalityAction | undefined {
      if (!preferences.enabled || !preferences.roam || !world.animated || world.paused || !Number.isFinite(now) || now - lastMeaningfulAt < 8000
        || hasReachableMeal(brain, world, preferences, now)) return;
      // Exhausted/absent goals cannot suppress personality indefinitely. A
      // still-owned care goal gets a finite no-progress window; actual food
      // above remains first, and an executing action never calls this chooser.
      const goal = brain.foodGoal?.remaining ? `food:${brain.foodGoal.foodId}`
        : brain.intention && brain.intention.kind !== "explore" && brain.intention.remaining > 0 ? `${brain.intention.kind}:${brain.intention.targetId}`
          : brain.episode && brain.episode.remaining > 0 ? `episode:${brain.episode.kind}:${brain.episode.foodId ?? ""}` : "";
      if (goal) {
        if (goal !== blockedKey || Math.hypot(world.x - blockedX, world.y - blockedY) > 4) { blockedKey = goal; blockedAt = now; blockedX = world.x; blockedY = world.y; }
        if (now - blockedAt < 9000) return;
      } else blockedKey = "";
      const support = world.platforms.find(platform => platform.id === world.platformId);
      if (!support || ["control", "hide"].includes(support.kind) || ![world.x, world.y, support.x, support.y, support.width].every(Number.isFinite)
        || Math.abs(world.y - support.y) > 2 || world.x < support.x || world.x > support.x + support.width) return;
      const choices = clips[preferences.personality].filter(play => play !== previousPlay && (preferences.jump || play !== "pounce")), draw = rng();
      const play = choices[Math.min(choices.length - 1, Math.max(0, Math.floor((Number.isFinite(draw) ? draw : 0) * choices.length)))];
      return { kind: "play", play, personalitySignature: preferences.personality, target: { x: world.x, y: world.y, platformId: support.id }, duration: companionPlayDuration(play) };
    },
    refuseFood(brain: CompanionBrain, world: CompanionWorld, preferences: CompanionPreferences, tastes: CompanionTastes | null, known: readonly CompanionFoodKind[], now: number): PersonalityAction | undefined {
      if (!preferences.enabled || !preferences.roam || !preferences.feeding || !world.animated || world.paused || !Number.isFinite(now) || now < refuseAt || brain.hunger >= .35
        || brain.foodGoal && brain.foodGoal.remaining > 0 || brain.intention && brain.intention.kind !== "explore" && brain.intention.remaining > 0 || brain.episode && brain.episode.remaining > 0) return;
      const food = (world.foods ?? []).slice(0, 8).find(item => item.platformId === world.platformId && Math.hypot(item.x - world.x, item.y - world.y) <= 140
        && shouldDeclineCompanionFood(item.kind, tastes, preferences, brain, known));
      if (!food || !findPlatformRoute(world, food, world.platforms, preferences.jump, food.platformId)) return;
      const refusal = { foodId: food.id, kind: food.kind };
      if (Math.hypot(food.x - world.x, food.y - world.y) > 24)
        return { kind: "walk", pace: "amble", target: { x: food.x, y: food.y, platformId: food.platformId }, duration: Math.max(400, Math.abs(food.x - world.x) / 70 * 1000), foodRefusal: refusal };
      refuseAt = now + 30000;
      return { kind: "play", play: "bonk-sad", target: { x: world.x, y: world.y, platformId: world.platformId }, duration: companionPlayDuration("bonk-sad"), foodRefusal: refusal };
    },
  };
}

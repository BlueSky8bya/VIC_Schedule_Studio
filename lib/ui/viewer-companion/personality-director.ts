import { findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionPlay, type CompanionWorld } from "./brain";
import { findCompanionPointerRoute } from "./reactive-cues";
import { companionMealRouteAvailable, companionToyFoodPriority, findCompanionToyRoute, MAX_COMPANION_TOYS, type CompanionToy } from "./toys";
import { findCompanionHomeItemRoute, selectCompanionHomeFoodDestination } from "./home-pantry";
import { companionPlayDuration } from "./timing";
import { COMPANION_FULL_THRESHOLD } from "./care";
import { COMPANION_FOOD_CATEGORY } from "./snacks";
import type { CompanionToyKind } from "./toy-catalog";
import type { CompanionPreferences } from "./preferences";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionHomeEnvironment } from "./home-environment";
import { normalizeCompanionHomeTv, randomCompanionHomeTvChannel, type CompanionHomeTvState } from "./home-room-media";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe, type SceneBeat, type SceneTrigger } from "./personality-scene-catalog";
import { companionPersonalityPlayAllowed } from "./personality-activity";
import type { CompanionRadioMood } from "./radio-reaction";
import type { CompanionAgentExperience, CompanionExperienceFamily } from "./agent-experience";
import { companionAudiencePlay, companionEntryPreparation, companionMayAddressAudience, companionOutsidePlatforms, companionOutsideSupport, companionOutsideItem } from "./life-space";
import { companionWashSteps } from "./wash-journey";

import { planCompanionOutsideRoute, companionOutsideRouteFact, boundedCompanionOutsideObserver, type CompanionOutsideGoal, type CompanionOutsideObserver } from "./outside-route";
import { companionLocalFloorStep, companionOrdinaryRoomFloor } from "./safe-room-floor";
import { createCompanionExplorationMemory, type CompanionToyObservation } from "./exploration-memory";

type Point = { x: number; y: number; platformId?: string };
export type PersonalityHome = Partial<Record<"sofa" | "floor" | "window" | "pad" | "box" | "dispenser" | "tv" | "light" | "curtain" | "radio", Point>> & {
  /** Actual painted handle/button/cord, independent of the body's floor slot. */
  contacts?: Partial<Record<"tv" | "light" | "curtain" | "radio", { x: number; y: number }>>;
};
export type PersonalitySceneInput = {
  world: CompanionWorld; brain: CompanionBrain; preferences: CompanionPreferences; now: number;
  /** Same actual gravity owners only; held/carried/hidden objects are excluded. */
  flyingToyIds?: readonly string[];
  home: PersonalityHome; toys: readonly CompanionToy[]; tv: CompanionHomeTvState;
  environment?: CompanionHomeEnvironment; favoriteFood?: string | null; learnedSocial?: boolean;
  busy?: boolean; canTv?: boolean; canCurtain?: boolean; radioAllowed?: boolean; equipped?: boolean; hasExperience?: boolean;
  yieldedItem?: boolean; yieldedItemId?: string; storedFoodIds?: readonly string[]; favoriteToy?: string | null;
  toyPlayCounts?: Partial<Record<CompanionToyKind, number>>; toyCount?: number; curtainPhase?: "open" | "shade" | "closed"; lightLit?: boolean; familiarHour?: boolean; learnedMorning?: boolean; carriedToyId?: string; carriedFoodId?: string; deferredToyId?: string; interruptedItemId?: string;
  music?: { mood?: CompanionRadioMood; familiar: boolean }; radioPlaying?: boolean;
  experience?: Pick<CompanionAgentExperience, "score">;
  /** Normalize autonomous light/TV intent before its state comparison and
   * actual route. Human stores and curtain/radio choices stay independent. */
  homeLifeControl?: (command: Extract<SceneBeat, { kind: "light" | "tv" }>, context: Readonly<{ id: string; beat: number; steps: readonly SceneBeat[] }>) => Extract<SceneBeat, { kind: "light" | "tv" }>;
};
/** Runtime-owned completion of a decoded finite TV look, never a physical ACK. */
export type PersonalityTvWatchCompletion = {
  at: number; success: boolean; active: boolean; tv: CompanionHomeTvState;
  point: Point; duration: number; elapsedMs: number; paintedMs: number;
};
export type PersonalityProgressObservation = {
  now: number; active: boolean; point?: Point; carriedToyId?: string; carriedFoodId?: string;
  controls?: { tv?: CompanionHomeTvState; light?: boolean; curtain?: "open" | "shade" | "closed"; radio?: boolean };
};
export type PersonalitySceneBeat = { id: string; serial: number; beat: number; command: SceneBeat; itemId?: string; comparisonItemId?: string; travel?: true; routine?: true; manual?: true; homeFloorEntry?: true; interactionContact?: { x: number; y: number }; propShow?: true; /** Exact proved destination, distinct from this route's next actual leg. */ goal?: Point };
export type PersonalitySceneAction = CompanionAction & { personalityScene: PersonalitySceneBeat; personalitySignature: CompanionPreferences["personality"] };
export type PersonalitySceneProposal = { meta: PersonalitySceneBeat; action?: PersonalitySceneAction; delegate?: Extract<SceneBeat, { kind: "toy" | "food" }> };
export type CompanionToyAdmissionObserver = (fact: Readonly<Record<string, unknown>>) => void;
const safe = (point: Point | undefined): point is Point => Boolean(point && [point.x, point.y].every(Number.isFinite));
const arrived = (point: Point | undefined, world: CompanionWorld, range = 24) => safe(point)
  && point.platformId === world.platformId && Math.hypot(point.x-world.x, point.y-world.y) < range;
const atHome = (id?: string) => /^companion-home(?:-floor)?(?:-\d+)?$/.test(id ?? "");
const ACTUAL_PROGRESS_BUDGET_MS = 8000;
// Admission and execution share the same real authored-sleep condition.
// Needs-selected routines retain their separately proved nap/night threshold.
const authoredSleepNeeded = (input: PersonalitySceneInput) => input.preferences.sleep
  && input.brain.energy <= getCompanionBehaviorProfile(input.preferences).sleepEnergy;
const restExpression = (step: SceneBeat) => step.kind === "sleep"
  || step.kind === "pose" && ["cozy-nest", "doze-curl"].includes(step.pose);

/** One finite intention on the existing world clock. No DOM, timer, storage,
 * audio, learning, analytics or speculative object mutation happens here. */
export function createCompanionPersonalityDirector(recipes: readonly PersonalitySceneRecipe[] = COMPANION_PERSONALITY_SCENES, rng: () => number = Math.random, outsideObserver?:CompanionOutsideObserver, toyAdmissionObserver?: CompanionToyAdmissionObserver, onCompleted?: (receipt: { id: string; success: true; abbreviated: false }) => void) {
  const outsideDiagnostic=boundedCompanionOutsideObserver(outsideObserver);
  const explorationMemory = createCompanionExplorationMemory();
  const approvedRecipes = recipes.filter(recipe => recipe.id.startsWith("D157-")).slice(0, 9);
  const toyAdmissionSeen = toyAdmissionObserver ? new Set<string>() : undefined;
  const admission = (recipe: PersonalitySceneRecipe, input: PersonalitySceneInput, reason: string, admitted = false) => {
    if (!toyAdmissionObserver || !toyAdmissionSeen || toyAdmissionSeen.size >= 8 || !["C01", "C07", "C09"].includes(recipe.id)) return admitted;
    const key = `${recipe.id}:${reason}:${input.world.platformId}:${input.toys.slice(0,4).map(toy => `${toy.id}:${toy.kind}:${toy.platformId}:${Number(toy.held)}${Number(toy.carried)}${Number(toy.hidden)}`).join("|")}`;
    if (toyAdmissionSeen.has(key)) return admitted;
    toyAdmissionSeen.add(key);
    const point = (value: Point) => Object.freeze({ x: value.x, y: value.y, platformId: value.platformId });
    const requiredReturn = recipe.steps.some(step => step.kind === "toy" && step.mode === "return" && !step.optional);
    const { world, home, preferences: p } = input;
    const facts = Object.freeze({ recipe: recipe.id, reason, admitted, from: point(world), hunger: input.brain.hunger, energy: input.brain.energy,
      missingTriggers: Object.freeze(recipe.triggers.filter(value => !trigger(value,input))), requiredReturn,
      returnRouteAvailable: requiredReturn ? returnRouteAvailable(recipe,input) : null,
      mayAddressAudience: companionMayAddressAudience(world),
      toys: Object.freeze(input.toys.slice(0,4).map(toy => {
        const stance = toy.stance ?? toy;
        return Object.freeze({ id: toy.id, kind: toy.kind, platformId: toy.platformId, held: toy.held, carried: toy.carried, hidden: Boolean(toy.hidden), stance: point(stance),
          pickRouteLength: findCompanionToyRoute(world,stance,world.platforms,p.jump,true)?.length ?? null,
          returnRouteLength: safe(home.box) ? findCompanionToyRoute(stance,home.box,world.platforms,p.jump,true)?.length ?? null : null });
      })) });
    try { toyAdmissionObserver(facts); } catch { /* A diagnostic sink cannot own admission, routes or goals. */ }
    return admitted;
  };
  let serial = 0, selected: CompanionPreferences["personality"] | undefined, first = true, cursor = 0;
  let active: { recipe: PersonalitySceneRecipe; serial: number; beat: number; started: number; progressed: number; attempts: number; itemId?: string; comparisonItemId?: string; lastX: number; lastY: number; count: number; routine?: true; manual?: true; abbreviated?: true; waking?: true; closureAt?: number; goal?: { beat: number; id: string; fraction?: number }; explorationGoals?: Map<number, CompanionOutsideGoal>; inspection?: CompanionToyObservation; quietHome?: true; quietMaterial?: true; quietControls?: PersonalityProgressObservation["controls"]; tvChoice?: {beat:number;state:CompanionHomeTvState}; tvWatch?: { beat: number; started: number; duration: number; point: Point }; settlingToy?: { id: string; until: number } } | undefined;
  let suspendedExploration: NonNullable<typeof active> | undefined;
  let entrySerial: number | undefined, entryFinished = false, lastPosition: Point | undefined;
  // Existing active time only, including the initial personal preparation.
  // A completed entry/observation/pose/scene never refills this shared budget.
  let actualProgressAt: number | undefined, actualPoint: Point | undefined, progressActive = false;
  let initialProgressDeadline: number | undefined;
  let carried: string | undefined, carriedFood: string | undefined;
  let controls: PersonalityProgressObservation["controls"];
  let lastCompleted = "", lastPerformance = -Infinity;
  // One ephemeral completion cooldown, across home supports/families only.
  let quietHomeUntil = -Infinity;
  let lastCleanupAt = -Infinity, lastOutsideAt = -Infinity, selectedAt = 0;
  let outsideVisitAt: number | undefined;
  const events = new Map<SceneTrigger, number>(), completed: string[] = [], failures = new Map<string, number>();
  const introducedIdeas = new Set<string>();
  // Remember currently feasible, unowned physical chores across choices.
  // Repeated major leisure cannot indefinitely starve a real return trip.
  const waitingReturns = new Map<string, number>();
  const purposes: string[] = [];
  let attention: Point | undefined, lastToyKind: CompanionToyKind | undefined;
  const heldBack = new Map<SceneTrigger, number>();
  const recentPurposes = new Map<string, { point: Point; until: number }>();
  const family = (recipe: PersonalitySceneRecipe): CompanionExperienceFamily | undefined => {
    const work = recipe.steps.find(step => ["toy", "food", "wash", "sleep", "tv", "light", "curtain", "radio"].includes(step.kind));
    if (work?.kind === "toy") return work.mode === "return" ? "cleanup" : "play";
    if (work?.kind === "food") return work.mode === "tidy" ? "cleanup" : "meal";
    if (work?.kind === "wash") return "cleanup";
    if (work?.kind === "sleep") return "rest";
    if (work) return "home";
    const travel = recipe.steps.find(step => step.kind === "go");
    return travel?.kind === "go" ? travel.target === "pointer" ? "social" : "explore" : undefined;
  };
  const repeatFamily = (recipe: PersonalitySceneRecipe) => {
    const purpose = family(recipe);
    // Real remaining meals/chores are separate objects, not repeat poses.
    if (purpose === "cleanup" || purpose === "meal" || recipe.steps.some(step => step.kind === "toy" && step.mode === "return" && !step.optional)) return;
    if (recipe.steps.some(restExpression)) return "rest-expression";
    const firstPose = recipe.steps.find(step => step.kind === "pose");
    return !purpose && firstPose?.kind === "pose" ? `expression:${firstPose.pose}` : purpose;
  };
  // Only freely chosen home comfort/expression itineraries. Actual objects,
  // care, outside exploration and event/selection entries are never gated.
  const quietHomeRecipe = (recipe: PersonalitySceneRecipe) => recipe.personality === "homebody"
    && recipe.triggers.length > 0 && recipe.triggers.every(trigger => trigger === "free")
    && recipe.steps.some(step => step.kind === "go")
    && recipe.steps.every(step => step.kind !== "go" || ["sofa", "floor", "window"].includes(step.target))
    && !recipe.steps.some(step => ["toy", "food", "wash", "sleep", "hide"].includes(step.kind))
    && ["pose", "watch"].includes(recipe.steps.at(-1)?.kind ?? "");
  const quietHomeControlChange = (recipe: PersonalitySceneRecipe, input: PersonalitySceneInput) => recipe.steps
    .filter(step => ["tv", "light", "curtain", "radio"].includes(step.kind)).slice(0, 4).some(step => {
      if (step.kind !== "tv" && step.kind !== "light" && step.kind !== "curtain" && step.kind !== "radio") return false;
      const point = step.kind === "curtain" ? input.home.curtain ?? input.home.window : input.home[step.kind];
      const plane = point && input.world.platforms.find(plane => plane.id === point.platformId);
      if (!safe(point) || !safe(input.home.contacts?.[step.kind]) || !plane || plane.bodyOnly || ["control", "hide"].includes(plane.kind)
        || ![plane.x, plane.y, plane.width].every(Number.isFinite) || plane.width <= 0
        || Math.abs(point.y-plane.y) > 2 || point.x < plane.x || point.x > plane.x+plane.width) return false;
      const changes = step.kind === "tv" ? input.canTv !== false && (step.state === "next" || input.tv !== step.state)
        : step.kind === "light" ? typeof input.lightLit === "boolean" && input.lightLit !== step.lit
        : step.kind === "curtain" ? input.canCurtain !== false && input.curtainPhase !== undefined && input.curtainPhase !== step.phase
        : input.radioAllowed === true && (!step.playing || input.preferences.sound) && typeof input.radioPlaying === "boolean" && input.radioPlaying !== step.playing;
      return changes && Boolean(findCompanionToyRoute(input.world, point, input.world.platforms, input.preferences.jump));
    });
  let now = 0;
  const observeProgress = (input: PersonalityProgressObservation) => {
    if (!Number.isFinite(input.now) || input.now < now) return;
    now = input.now; progressActive = input.active;
    const point = safe(input.point) ? input.point : undefined, next = input.controls;
    const changedControl = Boolean(controls && next && (
      next.tv !== undefined && next.tv !== controls.tv || next.light !== undefined && next.light !== controls.light
      || next.curtain !== undefined && next.curtain !== controls.curtain || next.radio !== undefined && next.radio !== controls.radio));
    const moved = Boolean(point && actualPoint && Math.hypot(point.x-actualPoint.x,point.y-actualPoint.y) >= 8);
    const changedCarry = "carriedToyId" in input && carried !== input.carriedToyId || "carriedFoodId" in input && carriedFood !== input.carriedFoodId;
    const quietChangedControl = Boolean(active?.quietHome && next && active.quietControls && (
      next.tv !== undefined && active.quietControls.tv !== undefined && next.tv !== active.quietControls.tv
      || next.light !== undefined && active.quietControls.light !== undefined && next.light !== active.quietControls.light
      || next.curtain !== undefined && active.quietControls.curtain !== undefined && next.curtain !== active.quietControls.curtain
      || next.radio !== undefined && active.quietControls.radio !== undefined && next.radio !== active.quietControls.radio));
    if (active?.quietHome) {
      if (quietChangedControl || changedCarry) active.quietMaterial = true;
      if (next) active.quietControls = { ...active.quietControls, ...next };
    }
    const physical = moved || changedControl || changedCarry;
    if (entryFinished && input.active && (actualProgressAt === undefined || physical)) {
      actualProgressAt = now;
      if (physical) initialProgressDeadline = undefined;
    }
    if (point) {
      lastPosition = { ...point };
      if (!input.active || !actualPoint || physical) actualPoint = { ...point };
    }
    if (next) controls = { ...controls, ...next };
    if ("carriedToyId" in input) carried = input.carriedToyId;
    if ("carriedFoodId" in input) carriedFood = input.carriedFoodId;
  };
  const observeEffect = (effect: "toy" | "food" | "wash", at: number) => {
    if (!entryFinished || !progressActive || !Number.isFinite(at) || at < now || !["toy", "food", "wash"].includes(effect)) return;
    now = at; actualProgressAt = at; initialProgressDeadline = undefined;
    if (active?.quietHome) active.quietMaterial = true;
    if (lastPosition) actualPoint = { ...lastPosition };
  };
  const rememberExpression = (key: string) => {
    if (!lastPosition) return;
    recentPurposes.delete(key); recentPurposes.set(key, { point: { ...lastPosition }, until: now + 12000 });
    if (recentPurposes.size > 12) recentPurposes.delete(recentPurposes.keys().next().value!);
  };
  const finish = (success: boolean, reason?: "progress-timeout"|"duration-timeout"|"outside-unavailable") => {
    if (active?.recipe.id === "curious-interest" && suspendedExploration) {
      // A borrowed inspection has no whole-scene/learning receipt. Restore
      // the exact owner, beat and destination, even when its real toy vanished.
      // Ordinary cancellation explicitly clears this slot before reaching here.
      const spent = Math.max(0, now-active.started);
      active = suspendedExploration; suspendedExploration = undefined;
      active.started += spent; active.progressed = now;
      if (lastPosition) { active.lastX = lastPosition.x; active.lastY = lastPosition.y; }
      return;
    }
    if (active) {
      if(active.recipe.id==="routine-outing")outsideDiagnostic?.({stage:"routine-finished",outcome:success,beat:active.beat,reason:reason??(success?"completed":"cancelled")});
      if (success) {
        lastCompleted = active.recipe.id;
        // Real chores may finish after an unneeded decorative tail is omitted.
        // Such a partial scene is not a completion of every authored beat.
        if (!active.abbreviated) { completed.push(lastCompleted); if (completed.length > 12) completed.shift(); if (lastCompleted.startsWith("D157-")) introducedIdeas.add(lastCompleted); onCompleted?.({ id: lastCompleted, success: true, abbreviated: false }); }
        const work = active.recipe.steps.find(step => ["toy", "food", "tv", "wash", "sleep", "hide"].includes(step.kind));
        const purpose = work ? work.kind === "toy" ? `${work.kind}:${work.mode}` : work.kind === "food" ? `${work.kind}:${work.mode}` : work.kind : active.recipe.personality === "affectionate" ? "social" : "expression";
        purposes.push(purpose); if (purposes.length > 4) purposes.shift();
        if (active.quietHome && !active.abbreviated && !active.quietMaterial) quietHomeUntil = now + 12000;
        const repeated = repeatFamily(active.recipe);
        if (repeated) rememberExpression(repeated);
        if (active.recipe.personality === "performer" && !active.abbreviated) lastPerformance = now;
      }
      else failures.set(active.recipe.id, now + 8000);
      for (const trigger of active.recipe.triggers) if (events.has(trigger)) heldBack.set(trigger, events.get(trigger)!);
    }
    active = undefined;
  };
  const advance = () => { if (!active) return; active.tvWatch = undefined; active.beat++; active.progressed = now; active.attempts = active.count = 0; if (active.beat >= active.recipe.steps.length) finish(true); };
  const trigger = (key: SceneTrigger, input: PersonalitySceneInput) => {
    const { preferences: p, world, home, environment } = input;
    switch (key) {
      case "free": return true;
      case "toy": return input.toys.some(toy => !toy.held && !toy.carried && !toy.hidden && toy.platformId);
      case "food": return p.feeding && Boolean(world.foods?.length);
      case "tv": return Boolean(home.tv && (input.tv !== "off" || input.canTv));
      case "rain": return environment?.weather === "rain";
      case "summer": return environment?.season === "summer" && (environment.sunlight ?? 0) >= 2;
      case "night": return Boolean(environment?.night || ["night", "evening"].includes(environment?.band ?? ""));
      case "experience": return Boolean(input.yieldedItem || input.storedFoodIds?.length || p.learnFromYou && (input.hasExperience || input.learnedSocial || input.music?.familiar));
      case "outfit": return Boolean(input.equipped) && (events.get(key) ?? -Infinity) > now - 15000;
      case "pet": return p.petting && (events.get(key) ?? -Infinity) > now - 12000 && (events.get(key) ?? -Infinity) > (heldBack.get(key) ?? -Infinity);
      case "music": return Boolean(input.music) && (events.get(key) ?? -Infinity) > now - 9000 && (events.get(key) ?? -Infinity) > (heldBack.get(key) ?? -Infinity);
      default: return (events.get(key) ?? -Infinity) > now - 15000 && (events.get(key) ?? -Infinity) > (heldBack.get(key) ?? -Infinity);
    }
  };
  const freshFamiliarFood = (input: PersonalitySceneInput) => input.preferences.learnFromYou ? input.world.foods?.find(food =>
    !input.brain.life?.tastedFoods.includes(food.kind) && input.brain.life?.tastedFoods.some(known => COMPANION_FOOD_CATEGORY[known] === COMPANION_FOOD_CATEGORY[food.kind])) : undefined;
  // Admission and first binding use the same actual recipe constraints. A
  // reachable unrelated snack cannot justify an unreachable favorite meal.
  const foodCandidates = (recipe: PersonalitySceneRecipe, input: PersonalitySceneInput, boundId?: string) => {
    const { world, brain } = input, foods = world.foods ?? [], id = recipe.id;
    const favoriteOnly = ["G01", "T02", "G02", "H08"].includes(id), fresh = id === "G04" ? freshFamiliarFood(input) : undefined;
    const eligible = foods.filter(food => (recipe.foodScope !== "outside" || companionOutsideItem(world, food) || boundId === food.id)
      && (id !== "G04" || food.id === fresh?.id) && (id !== "C02" || !brain.life?.tastedFoods.includes(food.kind))
      && (id !== "T06" || foods.some(other => other.id !== food.id && other.platformId === food.platformId && Math.hypot(other.x-food.x, other.y-food.y) < 36))
      && (!favoriteOnly || food.kind === input.favoriteFood) && (id !== "T03" || food.kind !== input.favoriteFood)
      && (id !== "G03" || input.storedFoodIds?.includes(food.id)));
    if (id === "B03") eligible.sort((a, b) => {
      const distance = Math.hypot(a.x-world.x, a.y-world.y) - Math.hypot(b.x-world.x, b.y-world.y);
      if (brain.hunger >= .65 || !input.preferences.learnFromYou) return distance;
      return (Number(Boolean(brain.life?.tastedFoods.includes(a.kind))) - Number(Boolean(brain.life?.tastedFoods.includes(b.kind)))) * 10000 + distance;
    });
    if (input.preferences.personality === "gourmet" && id !== "G04") eligible.sort((a, b) => Math.hypot(a.x-world.x, a.y-world.y) - Math.hypot(b.x-world.x, b.y-world.y));
    return eligible;
  };
  const requiredMealIndex = (recipe: PersonalitySceneRecipe) => recipe.steps.findIndex(step => step.kind === "food" && step.mode === "eat" && !step.optional);
  const fittingMusic = (id: string, input: PersonalitySceneInput) => Boolean(input.music)
    && (id !== "X-S-music" || input.music?.mood === "calm") && (id !== "X-M-music" || input.music?.mood === "lively")
    && (!["H10", "X-H-music"].includes(id) || input.preferences.learnFromYou && input.music?.familiar);
  const hasCleanupWork = (input: PersonalitySceneInput) => {
    const { world, brain, preferences: p, home } = input;
    if (companionToyFoodPriority(brain, world, p)) return true;
    if (brain.hunger >= .8 || brain.energy < .25) return false;
    if (safe(home.box) && input.toys.slice(0, 4).some(toy => !toy.held && !toy.carried && !toy.hidden && toy.platformId
      && findCompanionToyRoute(world, toy.stance ?? toy, world.platforms, p.jump, true)
      && findCompanionToyRoute(toy.stance ?? toy, home.box!, world.platforms, p.jump, true))) return true;
    return Boolean(p.feeding && safe(home.floor) && world.foods?.slice(0, 8).some(food => {
      const support = world.platforms.find(platform => platform.id === food.platformId);
      if (!support) return false;
      const source = { x: platformLandingX(support, food.x), y: support.y, platformId: support.id };
      // Match the real household's already-separated indoor storage rule.
      if (/^companion-home-floor(?:-\d+)?$/.test(source.platformId)
        && !world.foods!.some(other => other.id !== food.id && Math.hypot(other.x-food.x, other.y-food.y) < 44)
        && !input.toys.slice(0, 4).some(toy => Math.hypot(toy.x-food.x, toy.y-food.y) < 44)) return false;
      return findCompanionHomeItemRoute(world, source, world.platforms, p.jump) && selectCompanionHomeFoodDestination({
        pantry: home.floor, platforms: world.platforms, visibleFoods: world.foods!, occupied: input.toys,
        allowJump: p.jump, brain, preferences: p,
      }, source, food);
    }));
  };
  const watchTargetsTv = (recipe: PersonalitySceneRecipe, beat: number) =>
    !recipe.steps.slice(0, beat).some(step => step.kind === "go" && (step.target === "pointer" || step.target === "outside"))
    && (recipe.triggers.includes("tv") || recipe.steps.some(step => step.kind === "tv"));
  const available = (recipe: PersonalitySceneRecipe, input: PersonalitySceneInput) => {
    if ((failures.get(recipe.id) ?? -Infinity) > now || !recipe.triggers.every(key => trigger(key, input))) return admission(recipe,input,(failures.get(recipe.id) ?? -Infinity) > now ? "failure-cooldown" : "missing-trigger");
    const { world: w, brain: b, preferences: p, home } = input, id = recipe.id;
    // The local-floor prelude is preparation for leaving the private room,
    // never a72px backwards ritual at each calendar stop. Public exploration
    // earns its pauses through an actual new place, not a free-choice timer.
    if (id === "D157-C" && !atHome(w.platformId)) return false;
    if (exploratoryRecipe(recipe) && !explorationPlans(recipe, input)) return false;
    // Give a newly arrived public visitor its existing personality cadence
    // before choosing optional indoor viewing. A later visit may choose TV;
    // this never cancels an existing owner, direct event or required chore.
    const optionalTvPrelude = recipe.triggers.every(key => ["free", "tv", "night", "summer", "rain"].includes(key))
      && !recipe.steps.some(step => !step.optional && ["toy", "food", "wash", "sleep", "hide"].includes(step.kind))
      && recipe.steps.some((step, beat) => step.kind === "watch" && !step.optional && watchTargetsTv(recipe, beat));
    if (p.personality !== "homebody" && b.energy >= (p.personality === "sleepy" ? .62 : .4)
      && actualOutside(w) && now-(outsideVisitAt ?? now) < getCompanionBehaviorProfile(p,b.habits).outsideCadenceMs
      && optionalTvPrelude) return admission(recipe, input, "outside-tv-prelude");
    // New optional room entertainment must not repeatedly reset an awake
    // visitor to its sofa. Real meals, remaining objects, hygiene, fatigue
    // and a direct touch remain eligible; the common arbiter owns departure.
    const optionalRoom = recipe.triggers.every(key => ["free", "tv", "night", "summer", "rain"].includes(key))
      && recipe.steps.some(step => ["tv", "light", "curtain", "radio"].includes(step.kind)
        || step.kind === "go" && ["sofa", "floor", "window"].includes(step.target))
      && !recipe.steps.some(step => ["toy", "food", "wash", "sleep", "hide"].includes(step.kind)
        || step.kind === "go" && ["outside", "pointer", "novel-place"].includes(step.target));
    if (p.personality !== "homebody" && b.energy >= (p.personality === "sleepy" ? .62 : .4)
      && atHome(w.platformId) && input.now - Math.max(selectedAt,lastOutsideAt,lastCleanupAt) >= (p.personality === "sleepy" ? 45000 : 8000)
      && optionalRoom && outsidePoint(input)) return false;
    // A new toy script must pass the same real meal/owner gate as its executor.
    if(recipe.steps.some(step=>step.kind==="toy"&&!step.optional) && !input.carriedToyId && companionToyFoodPriority(b,w,p))return admission(recipe,input,"food-priority");
    const returnIndex = recipe.steps.findIndex(step => step.kind === "toy" && step.mode === "return" && !step.optional);
    const spawnFloor = home.box && w.platforms.find(plane => plane.id === home.box!.platformId);
    const createsBeforeReturn = returnIndex >= 0 && recipe.steps.slice(0,returnIndex).some(step => step.kind === "toy" && step.mode === "spawn" && !step.optional)
      && safe(home.box) && spawnFloor?.kind === "floor" && !spawnFloor.bodyOnly && /^companion-home-floor(?:-\d+)?$/.test(spawnFloor.id)
      && Math.abs(home.box.y-spawnFloor.y) <= 2 && home.box.x >= spawnFloor.x && home.box.x <= spawnFloor.x+spawnFloor.width
      && Boolean(findCompanionToyRoute(w,home.box,w.platforms,p.jump,true));
    // Prove a required same-object return before its preparatory expression.
    // A preceding take-out creates its own future object under existing gates.
    if (returnIndex >= 0 && !createsBeforeReturn && !returnRouteAvailable(recipe,input)) return admission(recipe,input,"return-route-unavailable");
    const voluntaryAudience=!recipe.triggers.includes("pet") && recipe.steps.some(step=>step.kind==="pose" && (step.audience || companionAudiencePlay(step.pose)));
    if (voluntaryAudience && !companionMayAddressAudience(w) && !outsidePoint(input,false,returnIndex>=0)) return admission(recipe,input,"audience-outside-unavailable");
    if(recipe.steps.some(step=>step.kind==="go"&&step.target==="outside"&&!step.optional) && !outsidePoint(input,false,returnIndex>=0)
      && !(singleOutside(recipe)&&actualOutside(w))) return false;
    // New ideas are concrete source goals, not fresh free-pose aliases.
    if(id.startsWith("D143-") && (b.foodGoal || b.intention?.kind==="feed" || b.episode && b.episode.remaining>0 && b.episode.phase!=="finish"
      || input.carriedFoodId || input.carriedToyId || id!=="D143-G" && (b.hunger>=.78 || b.energy<=.18))) return false;
    if (["D143-P","D143-C","D143-B"].includes(id) && !outsidePair(input)) return false;
    if (id === "D143-S" && b.energy < .45) return false;
    if (id === "D143-T" && ((input.toyCount??input.toys.length)>0 || input.carriedToyId)) return false;
    if (id === "D143-B" && b.energy < .55) return false;
    if (id === "D143-H" && (!safe(home.tv) || !safe(home.window) || input.canTv === false || input.canCurtain === false)) return false;
    if (id.startsWith("D157-")) {
      if (b.foodGoal || b.intention?.kind === "feed" || b.episode && b.episode.remaining > 0 && b.episode.phase !== "finish"
        || input.carriedFoodId || input.carriedToyId || b.energy <= .18 || id !== "D157-G" && b.hunger >= .78) return false;
      if (id === "D157-P" && !outsidePair(input)) return false;
      if (id === "D157-S" && b.energy < .62) return false;
      if (id === "D157-T" && (input.toyCount !== 0 || input.toys.length || input.carriedToyId)) return false;
      if (id === "D157-H" && !atHome(w.platformId)) return false;
      if (["D157-C", "D157-S", "D157-M", "D157-G", "D157-H", "D157-B"].includes(id)
        && !localFloorPoint(input)) return false;
    }
    if (recipe.toyScope === "outside" && !toyCandidates(recipe,input).length) return false;
    if (recipe.foodScope === "outside" && !w.foods?.some(food=>companionOutsideItem(w,food))) return false;
    const requiredSleep = recipe.steps.some(step => step.kind === "sleep" && !step.optional);
    const actualChore = recipe.steps.some(step => !step.optional && (step.kind === "toy" || step.kind === "food" || step.kind === "wash"));
    if (requiredSleep && !actualChore && !authoredSleepNeeded(input)) return false;
    if (recipe.steps.some(step => step.kind === "food" && step.mode === "eat" && !step.optional)
      && (!p.feeding || b.hunger < COMPANION_FULL_THRESHOLD)) return false;
    const mealIndex = requiredMealIndex(recipe);
    // Reject impossible existing meals before preparatory poses. A mandatory
    // earlier spawn owns its future object; optional/later spawns cannot prove
    // this meal. Existing active jobs and real cooldowns remain untouched.
    if (mealIndex >= 0 && !recipe.steps.slice(0, mealIndex).some(step => step.kind === "food" && step.mode === "spawn" && !step.optional)
      && !companionMealRouteAvailable({ ...w, foods: foodCandidates(recipe, input) }, p, b.activeMs ?? 0)) return false;
    // A real need never loses admission to expression repetition memory.
    const repeated = requiredSleep && authoredSleepNeeded(input) ? undefined : repeatFamily(recipe), recent = repeated && recentPurposes.get(repeated);
    if (recent && recent.until > now && recent.point.platformId === w.platformId && Math.hypot(recent.point.x - w.x, recent.point.y - w.y) < 96) return admission(recipe,input,"recent-family");
    if (quietHomeUntil > now && atHome(w.platformId) && quietHomeRecipe(recipe) && !quietHomeControlChange(recipe, input)) return false;
    if (id === "C01" && !input.toys.some(toy => !(input.toyPlayCounts?.[toy.kind] ?? 0))) return admission(recipe,input,"no-unplayed-toy");
    if (id === "C02" && !w.foods?.some(food => !b.life?.tastedFoods.includes(food.kind))) return false;
    if (id === "G04" && !freshFamiliarFood(input)) return false;
    if (id === "P05" && now - lastPerformance > 15000) return false;
    if (recipe.triggers.includes("music") && !fittingMusic(id, input)) return false;
    if (id === "T04" && (!input.yieldedItem || !input.yieldedItemId)) return false;
    if (id === "T07" && hasCleanupWork(input)) return false;
    if (id === "B10" && (!p.learnFromYou || !input.learnedSocial)) return false;
    if (id === "G03" && (!w.foods?.some(food => input.storedFoodIds?.includes(food.id)) || b.hunger < COMPANION_FULL_THRESHOLD)) return false;
    if (id === "H02" && !input.toys.some(toy => toy.kind === input.favoriteToy && !atHome(toy.platformId))) return false;
    if (recipe.steps.some(step => step.kind === "go" && step.target === "pointer")
      && (!p.petting || !w.pointer || (w.pointer.stableMs ?? 0) < 200)) return false;
    if (id === "A12" && p.petting) return false;
    if (["T02", "T03", "G02", "H08"].includes(id) && b.hunger >= COMPANION_FULL_THRESHOLD) return false;
    if (["T02", "G02", "H08"].includes(id) && !w.foods?.some(food => food.kind === input.favoriteFood)) return false;
    if (id === "T03" && !w.foods?.some(food => food.kind !== input.favoriteFood)) return false;
    if (["C09", "G04", "B03", "B09"].includes(id) && (id.startsWith("G") || id === "B03" ? (w.foods?.length ?? 0) < 2 : input.toys.length < 2)) return admission(recipe,input,"insufficient-comparison-items");
    if (id === "B02" && (purposes.length < 2 || purposes.at(-1) !== purposes.at(-2))) return false;
    if (id === "M05" && b.energy > .7 || id === "H03" && !trigger("summer", input)) return false;
    if (["X-P-house", "A11", "X-A-house", "M05", "X-M-house", "X-B-house"].includes(id) && input.tv === "off") return false;
    if (id === "X-P-house" && normalizeCompanionHomeTv(input.tv) !== "tori") return false;
    if (id === "X-M-return-time" && !trigger("night", input)) return false;
    if (id === "P12" && (input.tv === "off" || !input.lightLit)) return false;
    if (id === "G01" && (!input.favoriteFood || !w.foods?.some(food => food.kind === input.favoriteFood) || b.hunger < COMPANION_FULL_THRESHOLD)) return false;
    if (["B11", "X-B-return-time"].includes(id) && input.environment?.season !== "autumn") return false;
    if (id === "X-C-return-time" && (input.environment?.season !== "spring" || input.environment.band !== "dawn")) return false;
    if (id === "X-S-return-time" && (input.environment?.season !== "winter" || !input.environment.night)) return false;
    if (["G10", "X-G-return-time"].includes(id) && (input.environment?.band !== "morning" || b.hunger < COMPANION_FULL_THRESHOLD)) return false;
    if (id === "G10" && (!p.learnFromYou || !input.learnedMorning)) return false;
    if (id === "X-P-return-time" && (input.environment?.band !== "evening" || !p.learnFromYou || !input.familiarHour)) return false;
    if (id === "T09" && !input.deferredToyId) return false;
    if (["T10", "B05"].includes(id) && !input.interruptedItemId) return false;
    if (["T05", "X-T-house"].includes(id) && ((input.toyCount ?? input.toys.length) || input.carriedToyId)) return false;
    if (id === "T06" && !w.foods?.some((food, i, foods) => foods.some((other, j) => i !== j && food.platformId === other.platformId && Math.hypot(food.x - other.x, food.y - other.y) < 36))) return false;
    if (recipe.steps.some(step => step.kind === "hide") && (!p.ambientPrank || !w.hideAvailable)) return false;
    if (recipe.steps.some(step => step.kind === "wash") && !home.pad) return false;
    if (recipe.steps.some(step => step.kind === "toy" && step.mode === "spawn" && !step.optional)
      && (!p.ambientPrank || Math.max(input.toyCount ?? 0, input.toys.length) >= MAX_COMPANION_TOYS)) return false;
    let mayCreateToy = false;
    for (const step of recipe.steps) {
      if (step.kind === "toy" && step.mode === "spawn") mayCreateToy = true;
      if (step.kind === "toy" && step.kinds?.length && !step.optional && !mayCreateToy && !input.toys.some(toy => !toy.held && !toy.carried && !toy.hidden && step.kinds!.includes(toy.kind))) return admission(recipe,input,"typed-toy-unavailable");
    }
    return admission(recipe,input,"admitted",true);
  };
  const selectionChoices = (pool: readonly PersonalitySceneRecipe[], input: PersonalitySceneInput) => {
    const eligible = pool.filter(recipe => recipe.id !== lastCompleted && !completed.slice(-3).includes(recipe.id));
    const different = eligible.length ? eligible : pool.filter(recipe => recipe.id !== lastCompleted);
    // Keep the original anti-repeat/real-return policy identical for both
    // readiness and actual selection. An available but unchoosable goal
    // cannot hold leisure while the director would return no proposal.
    return different.length ? different : pool.filter(recipe => recipe.id === lastCompleted && unfinishedReturn(recipe, input));
  };
  // A real meal can be followed by necessary care before the next free
  // choice. Keep the existing15s event/one-consumer contract; only a proved
  // concrete after-meal TV goal may briefly defer leisure departure.
  const mealFollowupCandidate = (input: PersonalitySceneInput, choices?: readonly PersonalitySceneRecipe[]) => {
    const {world,brain,preferences:p,home}=input, at=events.get("meal");
    if (active || !entryFinished || selected!==p.personality || !p.enabled || !p.roam || !world.animated || world.paused || input.busy
      || !Number.isFinite(input.now) || input.now<now || at===undefined || at>input.now || at<=input.now-15000 || at<=(heldBack.get("meal")??-Infinity)
      || ![brain.hunger,brain.energy].every(Number.isFinite) || brain.hunger>=COMPANION_FULL_THRESHOLD || brain.energy<=.18 || brain.foodGoal || brain.intention?.kind==="feed"
      || brain.episode && brain.episode.remaining>0 && brain.episode.phase!=="finish" || input.carriedFoodId || input.carriedToyId || input.canTv===false) return;
    const connected=(point:Point|undefined)=>{
      const plane=point && world.platforms.find(value=>value.id===point.platformId);
      return safe(point) && Boolean(plane && !plane.bodyOnly && !["control","hide"].includes(plane.kind)
        && [plane.x,plane.y,plane.width].every(Number.isFinite) && plane.width>0
        && Math.abs(point.y-plane.y)<=2 && point.x>=plane.x && point.x<=plane.x+plane.width);
    };
    if (!connected({x:world.x,y:world.y,platformId:world.platformId}) || !connected(home.sofa) || !connected(home.tv) || !safe(home.contacts?.tv)) return;
    return (choices ?? selectionChoices(recipes.filter(recipe=>recipe.personality===p.personality && available(recipe,input)),input)).find(recipe=>{
      const tvIndex=recipe.steps.findIndex(step=>step.kind==="tv"&&!step.optional);
      const watchIndex=recipe.steps.findIndex((step,index)=>index>tvIndex && step.kind==="watch"&&!step.optional && Number.isFinite(step.ms)&&step.ms>0);
      const television=recipe.steps[tvIndex];
      if (recipe.personality!==p.personality || !recipe.major || recipe.triggers.length!==1 || recipe.triggers[0]!=="meal" || tvIndex<0 || watchIndex<0
        || television.kind!=="tv"
        || !recipe.steps.slice(0,watchIndex).every(step=>step.optional || step.kind==="tv" || step.kind==="pose" && !step.audience && !companionAudiencePlay(step.pose)
          || step.kind==="go" && ["sofa","floor","window"].includes(step.target))) return false;
      // The query never binds a route/ID. Execution must re-prove each hop;
      // invalid geometry cannot suppress a real departure with a phantom TV.
      return Boolean(findCompanionToyRoute(world,home.sofa!,world.platforms,p.jump)
        && findCompanionToyRoute(home.sofa!,home.tv!,world.platforms,p.jump)
        && findCompanionToyRoute(home.tv!,home.sofa!,world.platforms,p.jump));
    });
  };
  // Final physical cleanup has one short, feasible hygiene follow-up before
  // optional departure. Remaining objects and urgent/basic owners keep their
  // own priorities; a missing pad never reserves the pet inside its room.
  const cleanupFollowupCandidate = (input:PersonalitySceneInput,choices?:readonly PersonalitySceneRecipe[]) => {
    const {world,brain,preferences:p,home}=input,at=events.get("toy-returned");
    if (active || !entryFinished || selected!=="tidy" || p.personality!=="tidy" || !p.enabled || !p.roam
      || !world.animated || world.paused || input.busy || !Number.isFinite(input.now) || input.now<now
      || at===undefined || at!==lastCleanupAt || at>input.now || at<=input.now-15000 || at<=(heldBack.get("toy-returned")??-Infinity)
      || input.toyCount!==0 || input.toys.length || input.carriedToyId || input.carriedFoodId
      || ![brain.hunger,brain.energy].every(Number.isFinite) || brain.hunger>=.78 || brain.energy<=.18
      || brain.foodGoal || brain.intention && brain.intention.kind!=="explore"
      || brain.episode && brain.episode.remaining>0 && brain.episode.phase!=="finish") return;
    const pad=home.pad,plane=pad&&world.platforms.find(value=>value.id===pad.platformId);
    const source=world.platforms.find(value=>value.id===world.platformId);
    if (!safe(pad) || pad.platformId!=="companion-home-floor-400" || !plane?.bodyOnly || plane.kind!=="floor"
      || ![plane.x,plane.y,plane.width].every(Number.isFinite) || plane.width<=0 || Math.abs(pad.y-plane.y)>.5
      || pad.x<plane.x || pad.x>plane.x+plane.width || !source || source.bodyOnly || ["control","hide"].includes(source.kind)
      || ![world.x,world.y,source.x,source.y,source.width].every(Number.isFinite) || source.width<=0
      || Math.abs(world.y-source.y)>2 || world.x<source.x || world.x>source.x+source.width
      || !findCompanionToyRoute(world,pad,world.platforms,p.jump)) return;
    const eligible=choices??selectionChoices(recipes.filter(recipe=>recipe.personality==="tidy"&&available(recipe,input)),input);
    return eligible.find(recipe=>recipe.id==="T05")??eligible.find(recipe=>recipe.id==="X-T-house");
  };
  const meta = (command: SceneBeat): PersonalitySceneBeat => ({ id: active!.recipe.id, serial: active!.serial, beat: active!.beat, command,
    ...(active!.routine ? { routine: true } : {}), ...(active!.manual ? { manual: true as const } : {}), ...(active!.recipe.propShow ? {propShow:true as const} : {}), ...(active!.recipe.steps.slice(active!.beat).some(step => step.kind === "toy" && step.mode === "return" && !step.optional) ? { homeFloorEntry: true as const } : {}), ...(active!.itemId ? { itemId: active!.itemId } : {}), ...(active!.comparisonItemId ? { comparisonItemId: active!.comparisonItemId } : {}) });
  const action = (command: SceneBeat, value: CompanionAction, input: PersonalitySceneInput): PersonalitySceneProposal => ({ meta: meta(command), action: { ...value, personalityScene: meta(command), personalitySignature: input.preferences.personality } });
  const toyCandidates = (recipe: PersonalitySceneRecipe | undefined, input: PersonalitySceneInput) => {
    const typed = recipe?.steps.find(step => step.kind === "toy" && step.kinds), kinds = typed?.kind === "toy" ? typed.kinds : undefined;
    const preferred = recipe?.id === "H02" ? input.favoriteToy : undefined;
    return input.toys.slice(0, 4).filter(toy => (!preferred || toy.kind === preferred && !atHome(toy.platformId))
      && !toy.held && !toy.carried && !toy.hidden && toy.platformId && (!kinds?.length || kinds.includes(toy.kind))
      && (recipe?.toyScope!=="outside" || companionOutsideItem(input.world,toy.stance??toy) || active?.recipe.id===recipe.id && active.itemId===toy.id)
      && (recipe?.id !== "C01" || !(input.toyPlayCounts?.[toy.kind] ?? 0)));
  };
  // A successful toss owns its same real object through one short gravity
  // interval. Missing, held, hidden and substituted IDs never enter this wait.
  const waitingForOwnToy = (input: PersonalitySceneInput) => Boolean(active?.settlingToy
    && active.itemId === active.settlingToy.id && Number.isFinite(input.now) && input.now >= now && input.now < active.settlingToy.until
    && input.flyingToyIds?.slice(0, 4).includes(active.settlingToy.id));
  const returnRouteAvailable = (recipe: PersonalitySceneRecipe, input: PersonalitySceneInput) => {
    const { world, preferences: p, home } = input;
    if (!recipe.steps.some(step => step.kind === "toy" && step.mode === "return" && !step.optional)
      || recipe.steps.find(step => step.kind === "toy")?.mode === "spawn"
      || !safe(home.box)) return false;
    const fixed = recipe.id === "T09" ? input.deferredToyId : ["T10", "B05"].includes(recipe.id) ? input.interruptedItemId : undefined;
    return toyCandidates(recipe, input).some(toy => (!fixed || toy.id === fixed)
      && recipe.steps.every(step => step.kind !== "toy" || step.optional || !step.kinds?.length || step.kinds.includes(toy.kind))
      && findCompanionToyRoute(world, toy.stance ?? toy, world.platforms, p.jump, true)
      && findCompanionToyRoute(toy.stance ?? toy, home.box!, world.platforms, p.jump, true));
  };
  const unfinishedReturn = (recipe: PersonalitySceneRecipe, input: PersonalitySceneInput) => input.brain.hunger < .8 && input.brain.energy >= .25
    && !companionToyFoodPriority(input.brain,input.world,input.preferences) && returnRouteAvailable(recipe,input);
  // A single outside destination is a physical place condition. Merely
  // being there does not claim movement or earn a progress/learning ACK.
  // Explicit two-place143 ideas keep their distinct actual journeys.
  const singleOutside = (recipe:PersonalitySceneRecipe) => recipe.steps.filter(step=>step.kind==="go"&&step.target==="outside").length===1;
  const actualOutside = (world:CompanionWorld) => {
    const plane=world.platforms.find(p=>p.id===world.platformId);
    return Boolean(plane && companionOutsideSupport(plane) && [world.x,world.y].every(Number.isFinite)
      && Math.abs(world.y-plane.y)<=2 && world.x>=plane.x && world.x<=plane.x+plane.width);
  };
  const outsidePoint = (input: PersonalitySceneInput, pointer = false, returning = false): Point | undefined => {
    if(returning&&!safe(input.home.box))return;
    return planCompanionOutsideRoute(input.world,input.preferences.jump,input.brain.visited,
      {pointer,...(returning?{returnTo:input.home.box}:{}),...(active?.recipe.id==="routine-outing"?{observe:outsideDiagnostic}:{})})?.target;
  };
  const outsidePair = (input:PersonalitySceneInput) => {
    const candidates=companionOutsidePlatforms(input.world,input.brain.visited).slice(0,8);
    // At most8 first proofs and8 second proofs; no fresh graph or clock.
    const first=candidates.map(plane=>({x:platformLandingX(plane,plane.x+plane.width/2),y:plane.y,platformId:plane.id}))
      .find(point=>findCompanionToyRoute(input.world,point,input.world.platforms,input.preferences.jump));
    return Boolean(first && candidates.some(plane=>plane.id!==first.platformId && findCompanionToyRoute(first,{x:platformLandingX(plane,plane.x+plane.width/2),y:plane.y,platformId:plane.id},input.world.platforms,input.preferences.jump)));
  };
  const exploratoryRecipe = (recipe: PersonalitySceneRecipe) => recipe.personality === "curious"
    && ["D157-C", "D143-C", "C05", "C10"].includes(recipe.id);
  const explorationPlans = (recipe: PersonalitySceneRecipe, input: PersonalitySceneInput) => {
    const goals = new Map<number, CompanionOutsideGoal>(), chosen = new Set<string>();
    let source = input.world;
    for (const [beat, step] of recipe.steps.entries()) {
      if (step.kind !== "go" || !["outside", "novel-place"].includes(step.target)) continue;
      const candidates = companionOutsidePlatforms({ ...source, platforms: input.world.platforms.filter(plane => explorationMemory.novel(plane) && !chosen.has(plane.id)) }, input.brain.visited);
      const point = candidates.map(plane => ({ x: platformLandingX(plane, plane.x+plane.width/2), y: plane.y, platformId: plane.id }))
        .find(point => findCompanionToyRoute(source, point, input.world.platforms, input.preferences.jump));
      const plane = point && input.world.platforms.find(plane => plane.id === point.platformId);
      if (!point || !plane) return;
      chosen.add(plane.id); goals.set(beat, { id: plane.id, fraction: (point.x-plane.x)/plane.width });
      source = { ...source, ...point };
    }
    return goals.size ? goals : undefined;
  };
  const investigateChangedToy = (input: PersonalitySceneInput) => {
    const owner = active, { world, brain, preferences: p } = input, step = owner?.recipe.steps[owner.beat];
    const settledAt = events.get("toy-settled");
    if (!owner || suspendedExploration || owner.routine || owner.manual || owner.itemId || owner.comparisonItemId
      || !exploratoryRecipe(owner.recipe) || p.personality !== "curious" || !p.enabled || !p.roam
      || !world.animated || world.paused || input.busy || !actualOutside(world)
      || step?.kind !== "go" || !["outside", "novel-place"].includes(step.target)
      || input.carriedToyId || input.carriedFoodId || brain.foodGoal || brain.intention && brain.intention.kind !== "explore"
      || brain.episode && brain.episode.remaining > 0 && brain.episode.phase !== "finish"
      || brain.hunger >= .78 || brain.energy <= .25 || settledAt === undefined || settledAt > now || now-settledAt >= 15000) return;
    const destination = targetFor(step.target, input);
    // A landed go has already fulfilled its purpose. Borrowing it here would
    // manufacture a return trip solely to finish a stale arrival condition.
    if (!safe(destination) || arrived(destination, world)) return;
    const toy = input.toys.slice(0, 4).filter(toy => !input.flyingToyIds?.includes(toy.id) && explorationMemory.novelToy(toy, world)
      && Math.hypot(toy.x-world.x, toy.y-world.y) <= 160)
      .sort((a, b) => Math.hypot(a.x-world.x, a.y-world.y)-Math.hypot(b.x-world.x, b.y-world.y))
      .find(toy => {
        const point = toy.stance ?? toy, approach = findCompanionToyRoute(world, point, world.platforms, p.jump);
        return approach && approach.length <= 2 && findCompanionToyRoute(point, destination, world.platforms, p.jump);
      });
    if (!toy) return;
    explorationMemory.inspectToy(toy, world);
    suspendedExploration = owner;
    active = { recipe: { id: "curious-interest", label: "새로 멈춘 물건을 확인하고 탐험 이어가기", personality: "curious", major: false,
      triggers: [], steps: [{ kind: "toy", mode: "inspect", limit: 1 }] }, serial: ++serial, beat: 0, started: now, progressed: now,
      attempts: 0, count: 0, itemId: toy.id, lastX: world.x, lastY: world.y };
  };
  const localFloorPoint = (input: PersonalitySceneInput): Point | undefined => {
    const direction = active?.recipe.id === "D157-M" ? -(input.brain.heading ?? 1) : input.brain.heading;
    const local = companionLocalFloorStep(input.world, direction);
    if (local) return local;
    // Food/sleep/bath stances are deliberate owners, not ordinary roaming
    // floors. Leave through a measured body-safe span before the next step.
    for (const plane of input.world.platforms.filter(companionOrdinaryRoomFloor).slice(0, 8)) {
      const source = { ...input.world, x: platformLandingX(plane, input.world.x), y: plane.y, platformId: plane.id };
      const point = companionLocalFloorStep(source, direction);
      if (point && findCompanionToyRoute(input.world, point, input.world.platforms, input.preferences.jump)) return point;
    }
  };
  const targetFor = (target: Extract<SceneBeat, { kind: "go" }>["target"], input: PersonalitySceneInput): Point | undefined => {
    const { world, home } = input;
    const exploration = active?.explorationGoals?.get(active.beat);
    if (exploration && (target === "outside" || target === "novel-place")) {
      const plane = world.platforms.find(plane => plane.id === exploration.id);
      // A scroll reprojects the same goal. A removed/unsafe support cannot be
      // silently replaced by another curiosity target or credited as arrival.
      return plane && companionOutsideSupport(plane)
        ? { x: platformLandingX(plane, plane.x+plane.width*exploration.fraction), y: plane.y, platformId: plane.id } : undefined;
    }
    if (target === "local-floor") {
      if (active && active.goal?.beat === active.beat && active.goal.fraction !== undefined) {
        const plane = world.platforms.find(value => value.id === active!.goal!.id);
        return plane && !plane.bodyOnly && (!plane.manualOnly || companionOrdinaryRoomFloor(plane))
          ? { x: plane.x + plane.width * active.goal.fraction, y: plane.y, platformId: plane.id } : undefined;
      }
      const point = localFloorPoint(input), plane = point && world.platforms.find(value => value.id === point.platformId);
      if (active && point && plane) active.goal = { beat: active.beat, id: plane.id, fraction: (point.x-plane.x)/plane.width };
      return point;
    }
    if (target === "outside") {
      const previous=active?.goal;
      if (active && previous?.beat===active.beat) {
        const plane=world.platforms.find(plane => plane.id===previous.id);
        return plane && companionOutsideSupport(plane) ? {x:platformLandingX(plane,plane.x+plane.width*(previous.fraction??.5)),y:plane.y,platformId:plane.id} : undefined;
      }
      if(active && singleOutside(active.recipe) && actualOutside(world)) {
        const plane=world.platforms.find(p=>p.id===world.platformId)!;
        active.goal={beat:active.beat,id:plane.id,fraction:(world.x-plane.x)/plane.width};
        return {x:world.x,y:world.y,platformId:world.platformId};
      }
      const returning=Boolean(active?.recipe.steps.slice(active.beat).some(step=>step.kind==="toy"&&step.mode==="return"&&!step.optional));
      const point=outsidePoint(input,false,returning);
      const plane=point && world.platforms.find(plane=>plane.id===point.platformId);
      if (active && point && plane) active.goal={beat:active.beat,id:plane.id,fraction:(point.x-plane.x)/plane.width};
      return point;
    }
    if (target === "toy") {
      const toys = toyCandidates(active?.recipe, input);
      const novelty = active && ["C01", "C09", "B09"].includes(active.recipe.id);
      const requiresReturn = active?.recipe.steps.slice(active.beat).some(step => step.kind === "toy" && step.mode === "return" && !step.optional);
      const reachable = (toy: CompanionToy) => {
        const point = toy.stance ?? toy;
        return findCompanionToyRoute(world, point, world.platforms, input.preferences.jump, Boolean(requiresReturn))
          && (!requiresReturn || safe(home.box) && findCompanionToyRoute(point, home.box, world.platforms, input.preferences.jump, true));
      };
      // Prove both legs before reserving a new ID. Once reserved, a missing or
      // invalid object cancels this intention rather than substituting another.
      const toy = active?.itemId ? toys.find(item => item.id === active!.itemId) : toys.sort((a, b) =>
        (novelty ? ((input.toyPlayCounts?.[a.kind] ?? 0) - (input.toyPlayCounts?.[b.kind] ?? 0)) * 10000 + Number(a.kind === lastToyKind) * 1000 - Number(b.kind === lastToyKind) * 1000 : 0)
        + Math.hypot(a.x - world.x, a.y - world.y) - Math.hypot(b.x - world.x, b.y - world.y)).find(reachable);
      if (toy) lastToyKind = toy.kind;
      if (toy && active) active.itemId = toy.id;
      return toy?.stance ?? toy;
    }
    if (target === "food") {
      const eligible = active ? foodCandidates(active.recipe, input, active.itemId) : [...world.foods ?? []];
      const food = active?.itemId ? eligible.find(food => food.id === active!.itemId)
        : eligible.find(food => !active || requiredMealIndex(active.recipe) < 0
          || findPlatformRoute(world, food, world.platforms, input.preferences.jump, food.platformId));
      if (food && active) active.itemId = food.id;
      return food;
    }
    if (target === "toy-other-side") {
      if (!active) return;
      if (active.goal?.beat === active.beat && active.goal.fraction !== undefined) {
        const plane = world.platforms.find(p => p.id === active!.goal!.id);
        return plane && { x: plane.x + plane.width * active.goal.fraction, y: plane.y, platformId: plane.id };
      }
      if (!active.itemId) targetFor("toy", input);
      const toy = input.toys.find(item => item.id === active!.itemId);
      if (!toy || toy.held || toy.carried || toy.hidden) return;
      const y = toy.stance?.y ?? toy.y, wanted = toy.x + (world.x <= toy.x ? 32 : -32);
      const plane = world.platforms.find(p => p.kind === "floor" && !p.bodyOnly && Math.abs(p.y-y) < 2 && wanted >= p.x && wanted <= p.x+p.width);
      if (!plane) return;
      const x = platformLandingX(plane,wanted);
      active.goal = { beat:active.beat,id:plane.id,fraction:(x-plane.x)/plane.width };
      return { x,y:plane.y,platformId:plane.id };
    }
    if (target === "pointer") {
      // Voluntary meetings happen outside. Direct pet follow-ups may remain
      // where the person really touched this pet, including its private room.
      if (!active?.recipe.triggers.includes("pet") || active.recipe.id === "D157-A") {
        const owner=active, oneApproach=owner && ["A07","B07"].includes(owner.recipe.id);
        if (owner && oneApproach && owner.goal?.beat===owner.beat && owner.goal.fraction!==undefined) {
          const plane=world.platforms.find(plane=>plane.id===owner.goal!.id);
          return plane && companionOutsideSupport(plane) ? {x:platformLandingX(plane,plane.x+plane.width*owner.goal.fraction),y:plane.y,platformId:plane.id} : undefined;
        }
        const point=outsidePoint(input,true,Boolean(owner?.recipe.steps.slice(owner.beat).some(step=>step.kind==="toy"&&step.mode==="return"&&!step.optional)));
        const plane=point && world.platforms.find(plane=>plane.id===point.platformId);
        if(owner&&oneApproach&&point&&plane) owner.goal={beat:owner.beat,id:plane.id,fraction:(point.x-plane.x)/plane.width};
        return point;
      }
      const owner = active, oneApproach = owner && ["A07", "B07"].includes(owner.recipe.id);
      if (owner && oneApproach && owner.goal?.beat === owner.beat && owner.goal.fraction !== undefined) {
        const plane = world.platforms.find(platform => platform.id === owner.goal!.id);
        return plane && { x: platformLandingX(plane, plane.x + plane.width * owner.goal.fraction), y: plane.y, platformId: plane.id };
      }
      // Scene travel can use the room's measured body-safe spans, just like
      // toy errands. Generic pointer roaming still excludes manual supports.
      const roomFloors = world.platforms.filter(p => /^companion-home-floor(?:-\d+)?$/.test(p.id) && p.kind === "floor" && !p.bodyOnly);
      const source = world.platforms.find(p => p.id === world.platformId);
      const pointerPlatforms = [...new Map([...(source ? [source] : []), ...roomFloors, ...world.platforms].map(p => [p.id, p])).values()]
        .map(p => roomFloors.includes(p) && p.manualOnly ? { ...p, manualOnly: false } : p);
      const point = findCompanionPointerRoute({ ...world, platforms: pointerPlatforms }, input.preferences, input.preferences.personality === "affectionate" ? 24 : 50)?.target;
      if (owner && oneApproach && point?.platformId) {
        const plane = world.platforms.find(platform => platform.id === point.platformId);
        if (plane?.width) owner.goal = { beat: owner.beat, id: plane.id, fraction: (point.x - plane.x) / plane.width };
      }
      return point;
    }
    if (target === "novel-place") {
      if (active && active.goal?.beat === active.beat) {
        const platform = world.platforms.find(p => p.id === active!.goal!.id);
        return platform && { x: platformLandingX(platform, platform.x + platform.width / 2), y: platform.y, platformId: platform.id };
      }
      const outing = active?.recipe.id === "routine-outing";
      const point = world.platforms.filter(p => !p.manualOnly && !p.bodyOnly && !["control", "hide"].includes(p.kind) && p.id !== world.platformId && (!outing || !atHome(p.id)))
        .sort((a, b) => Number(input.brain.visited.includes(a.id)) - Number(input.brain.visited.includes(b.id)) || Math.hypot(a.x - world.x, a.y - world.y) - Math.hypot(b.x - world.x, b.y - world.y))
        .map(p => ({ x: platformLandingX(p, p.x + p.width / 2), y: p.y, platformId: p.id })).find(point => outing ? findCompanionToyRoute(world, point, world.platforms, input.preferences.jump) : findPlatformRoute(world, point, world.platforms, input.preferences.jump, point.platformId));
      if (point && active) active.goal = { beat: active.beat, id: point.platformId };
      return point;
    }
    if (target === "floor" && active?.recipe.id === "routine-wash") {
      // Leaving a body-only hygiene stance needs the measured room floor.
      // A hidden/removed room must never turn the pad itself into "floor".
      const point = home.floor, floor = point && world.platforms.find(platform => platform.id === point.platformId);
      return safe(point) && floor?.kind === "floor" && !floor.bodyOnly && /^companion-home-floor(?:-\d+)?$/.test(floor.id)
        && Math.abs(point.y-floor.y) <= .5 && point.x >= floor.x && point.x <= floor.x+floor.width ? point : undefined;
    }
    if (target === "floor" && !home.floor) {
      const floor = world.platforms.find(p => p.id === world.platformId && p.kind === "floor") ?? world.platforms.find(p => p.kind === "floor" && !p.manualOnly);
      return floor && { x: platformLandingX(floor, world.x + 55), y: floor.y, platformId: floor.id };
    }
    return home[target];
  };
  const go = (point: Point, command: SceneBeat, input: PersonalitySceneInput): PersonalitySceneProposal | undefined => {
    const returning = active?.recipe.steps.slice(active.beat).some(step => step.kind === "toy" && step.mode === "return" && !step.optional);
    const route = findCompanionToyRoute(input.world, point, input.world.platforms, input.preferences.jump, Boolean(returning));
    if(active?.recipe.id==="routine-outing")outsideDiagnostic?.(companionOutsideRouteFact("go",input.world,point,route));
    if (!route) return;
    const step = route[0];
    if (!step) return;
    const speed = input.preferences.speed === "relaxed" ? 65 : input.preferences.speed === "lively" ? 135 : 100;
    const offered = action(command, { ...step, pace: input.preferences.personality === "sleepy" ? "amble" : "scoot", duration: step.kind === "jump" ? 850 : Math.max(220, Math.abs(step.target.x - input.world.x) / speed * 1000) }, input);
    if (command.kind === "go") { offered.meta.goal = { ...point }; offered.action!.personalityScene.goal = { ...point }; }
    // Bind only an actually issued post-return floor route. Its arrival
    // may retain short required grooming without a fake ACK or clock refill.
    const tail = active?.recipe.steps.slice(active.beat + 1) ?? [];
    if (active && command.kind === "go" && command.target === "floor" && active.closureAt !== undefined
      && active.recipe.steps.slice(0,active.beat).some(step=>step.kind==="toy"&&step.mode==="return"&&!step.optional)
      && tail.some(step=>step.kind==="pose"&&step.pose==="groom"&&!step.optional)
      && tail.every(step=>step.kind==="pose"||step.kind==="watch")
      && tail.reduce((ms,step)=>ms+pureDuration(step,input),0)<=3500) {
      const floor=input.world.platforms.find(plane=>plane.id===point.platformId&&companionOrdinaryRoomFloor(plane));
      if(floor&&floor.width>0&&point.x>=floor.x&&point.x<=floor.x+floor.width&&Math.abs(point.y-floor.y)<=2)
        active.goal={beat:active.beat,id:floor.id,fraction:(point.x-floor.x)/floor.width};
    }
    offered.meta.travel = true; offered.action!.personalityScene.travel = true; return offered;
  };
  const remainingRequiredWork = (input: PersonalitySceneInput) => Boolean(active?.recipe.steps.slice(active.beat).some(step => {
    if (step.optional) return false;
    if (step.kind === "toy" || step.kind === "food" || step.kind === "wash") return true;
    if (step.kind === "sleep") return Boolean(active?.routine || authoredSleepNeeded(input));
    if (step.kind === "tv") return step.state === "next" || input.tv !== step.state;
    if (step.kind === "light") return input.lightLit !== step.lit;
    if (step.kind === "curtain") return input.curtainPhase !== step.phase;
    if (step.kind === "radio") return input.radioPlaying !== step.playing;
    if (step.kind !== "go") return false;
    // This test never reserves a future object/route or mutates its owner.
    // Unknown dynamic destinations keep their one bounded real route attempt.
    const point = step.target in input.home ? input.home[step.target as keyof Omit<PersonalityHome, "contacts">] : undefined;
    return !safe(point) || point.platformId !== input.world.platformId || Math.hypot(point.x-input.world.x, point.y-input.world.y) >= 24;
  }));
  const pureDuration = (command: SceneBeat, input: PersonalitySceneInput) => {
    if (command.kind === "watch") return Math.min(3500, Math.max(650, command.ms));
    // These delegated steps are finite observations, not object effects.
    // Counting them as zero let entry + several recipes + an inspection
    // exceed the stationary budget before any real pickup or movement.
    if (command.kind === "toy" && command.mode === "inspect") return 900;
    if (command.kind === "food" && command.mode === "inspect") return 750;
    if (command.kind === "food" && command.mode === "compare") return 650;
    if (command.kind !== "pose") return 0;
    if (["look", "sniff", "stretch", "shake"].includes(command.pose)) return Math.min(2500, command.ms ?? 900);
    const play = companionPersonalityPlayAllowed(command.pose as CompanionPlay, input.preferences) ? command.pose as CompanionPlay : "bow";
    return companionPlayDuration(play);
  };
  // Only the current required TV observation owns its already-authored
  // approach and finite playback. Optional future objects do not erase it,
  // and an elapsed control-ACK closure is not a substitute for the watch.
  const requiredTvWatch = (input: PersonalitySceneInput) => {
    const owner = active, command = owner?.recipe.steps[owner.beat];
    if (!owner || command?.kind !== "watch" || command.optional || !Number.isFinite(command.ms) || command.ms <= 0 || input.tv === "off") return false;
    const before = owner.recipe.steps.slice(0,owner.beat);
    if (before.some(step => step.kind === "go" && (step.target === "pointer" || step.target === "outside"))
      || !before.some(step => step.kind === "tv") && !owner.recipe.triggers.includes("tv")) return false;
    return [input.home.sofa,input.home.tv].every(point => {
      const plane = point && input.world.platforms.find(platform => platform.id === point.platformId);
      return safe(point) && Boolean(plane && !plane.bodyOnly && !["control","hide"].includes(plane.kind)
        && [plane.x,plane.y,plane.width].every(Number.isFinite) && plane.width > 0
        && Math.abs(point.y-plane.y) <= 2 && point.x >= plane.x && point.x <= plane.x+plane.width);
    });
  };
  // A physical return may finish short grooming after its actually issued
  // floor route arrives. Queries grant no ACK/progress/reward and retain the
  // enclosing7.5s no-progress/60s total owner limits.
  const postReturnFloorClosure = (input: PersonalitySceneInput) => {
    const owner=active,goal=owner?.goal,{world}=input;
    if(!owner||owner.routine||owner.closureAt===undefined||input.now<owner.closureAt||!goal||goal.fraction===undefined
      ||goal.beat>owner.beat||input.carriedToyId||input.carriedFoodId||input.brain.foodGoal||input.brain.intention?.kind==="feed")return false;
    const step=owner.recipe.steps[goal.beat],tail=owner.recipe.steps.slice(goal.beat+1);
    if(step?.kind!=="go"||step.target!=="floor"
      ||!owner.recipe.steps.slice(0,goal.beat).some(beat=>beat.kind==="toy"&&beat.mode==="return"&&!beat.optional)
      ||!tail.some(beat=>beat.kind==="pose"&&beat.pose==="groom"&&!beat.optional)
      ||!tail.every(beat=>beat.kind==="pose"||beat.kind==="watch")
      ||tail.reduce((ms,beat)=>ms+pureDuration(beat,input),0)>3500)return false;
    const floor=world.platforms.find(plane=>plane.id===goal.id&&companionOrdinaryRoomFloor(plane));
    if(!floor||world.platformId!==floor.id||goal.fraction<0||goal.fraction>1)return false;
    const destination={x:floor.x+floor.width*goal.fraction,y:floor.y};
    return Math.hypot(world.x-destination.x,world.y-destination.y)<24;
  };
  const routineReserved = (input: PersonalitySceneInput) => {
    const owner = active, { preferences: p, world, brain, home } = input, at = input.now;
    if (!owner || owner.routine || selected !== p.personality || owner.recipe.personality !== p.personality
      || !p.enabled || !p.roam || !world.animated || world.paused || input.busy || !Number.isFinite(at)
      || at < now || at-owner.started > 60000 || at-owner.progressed > 7500 && Math.hypot(world.x-owner.lastX,world.y-owner.lastY) <= 4) return false;
    const connected = (point: Point | undefined, allowBody = false) => {
      const plane = point && world.platforms.find(platform => platform.id === point.platformId);
      return Boolean(safe(point) && plane && (allowBody || !plane.bodyOnly) && !["control", "hide"].includes(plane.kind)
        && Math.abs(point.y-plane.y) <= 2 && point.x >= plane.x && point.x <= plane.x+plane.width);
    };
    if (!connected({x:world.x,y:world.y,platformId:world.platformId},true)) return false;
    const tail = owner.recipe.steps.slice(owner.beat);
    if(tail.some(step=>step.kind==="toy"&&!step.optional) && !input.carriedToyId && companionToyFoodPriority(brain,world,p))return false;
    if (!authoredSleepNeeded(input) && owner.recipe.steps.slice(0,owner.beat).some(step => step.kind === "toy" && step.mode === "return" && !step.optional)
      && tail.some(step => step.kind === "sleep") && tail.every(step => step.kind === "pose" || step.kind === "sleep" || step.kind === "go" && step.target === "sofa")) return false;
    const toyReady = (step: Extract<SceneBeat,{kind:"toy"}>) => (step.mode !== "return" || connected(home.box))
      && input.toys.slice(0,4).some(toy => (!owner.itemId || toy.id === owner.itemId) && !toy.held && !toy.hidden && !toy.carried
        && (!step.kinds?.length || step.kinds.includes(toy.kind)) && connected(toy.stance ?? toy));
    const head = tail[0];
    if (head && waitingForOwnToy(input)) {
      if (head.kind === "go" && ["toy", "toy-other-side"].includes(head.target)
        || head.kind === "toy" && head.mode !== "spawn") return true;
      // The same successful play can release its object before a short
      // preparation pose. Keep only that existing gravity lease before its
      // mandatory return; a pose never extends the lease or proves delivery.
      const returning = tail.findIndex(step => step.kind === "toy" && step.mode === "return" && !step.optional);
      const preparation = tail.slice(0, returning);
      if (head.kind === "pose" && returning > 0 && connected(home.box)
        && preparation.every(step => step.kind === "pose" && !step.optional)
        && preparation.reduce((ms, step) => ms + pureDuration(step, input), 0) <= 1500) return true;
    }
    // A later rest cannot reserve a currently lost mandatory object. Let the
    // director fail that exact job and let real care arbitrate next normally.
    if (head && !head.optional && (head.kind === "toy" && head.mode !== "spawn" && !toyReady(head)
      || head.kind === "food" && (!p.feeding || head.mode !== "spawn" && !world.foods?.some(food => (!owner.itemId || food.id === owner.itemId) && connected(food))))) return false;
    if (requiredTvWatch(input)) return true;
    const work = tail.some(step => {
      if (step.optional) return false;
      if (step.kind === "toy") {
        if (step.mode === "spawn") return p.ambientPrank && (input.toyCount ?? input.toys.length) < 4 && connected(home.box);
        return toyReady(step);
      }
      if (step.kind === "food") {
        if (!p.feeding || step.mode === "eat" && brain.hunger < COMPANION_FULL_THRESHOLD || step.mode === "tidy" && brain.hunger >= COMPANION_FULL_THRESHOLD) return false;
        if (step.mode === "spawn") return brain.hunger >= COMPANION_FULL_THRESHOLD && (world.foods?.length ?? 0) < 8 && connected(home.dispenser);
        return Boolean(world.foods?.slice(0,8).some(food => (!owner.itemId || food.id === owner.itemId) && connected(food)));
      }
      if (step.kind === "wash") return home.pad?.platformId === "companion-home-floor-400"
        && Boolean(world.platforms.find(plane => plane.id === home.pad!.platformId)?.bodyOnly) && connected(home.pad,true);
      if (step.kind === "sleep") return authoredSleepNeeded(input) && connected(home.sofa);
      if (step.kind === "tv" || step.kind === "light" || step.kind === "curtain" || step.kind === "radio") {
        const point = step.kind === "curtain" ? home.curtain ?? home.window : home[step.kind];
        if (!connected(point) || !safe(home.contacts?.[step.kind])) return false;
        return step.kind === "tv" ? input.canTv !== false && (step.state === "next" || input.tv !== step.state)
          : step.kind === "light" ? input.lightLit !== step.lit
          : step.kind === "curtain" ? input.canCurtain !== false && input.curtainPhase !== step.phase
          : input.radioAllowed !== false && (!step.playing || p.sound) && input.radioPlaying !== step.playing;
      }
      if (step.kind !== "go") return false;
      // No targetFor call here: this observer never reserves another item or
      // mutates a route. The normal director still proves the next real hop.
      if (step.target === "pointer") return p.petting && Boolean(world.pointer && (world.pointer.stableMs ?? 0) >= 200);
      if (step.target === "toy" || step.target === "toy-other-side") return input.toys.some(toy => (!owner.itemId || toy.id === owner.itemId) && !toy.held && !toy.hidden && !toy.carried && connected(toy.stance ?? toy));
      if (step.target === "food") return p.feeding && Boolean(world.foods?.some(food => (!owner.itemId || food.id === owner.itemId) && connected(food)));
      if (step.target === "outside") return Boolean(owner.goal && world.platforms.some(plane=>plane.id===owner.goal!.id&&companionOutsideSupport(plane))) || companionOutsidePlatforms(world).length>0;
      if (step.target === "local-floor") return Boolean(localFloorPoint(input));
      if (step.target === "novel-place") return Boolean(owner.goal && world.platforms.some(plane => plane.id === owner.goal!.id && !plane.bodyOnly && !plane.manualOnly && !["control","hide"].includes(plane.kind)));
      const point = home[step.target];
      return connected(point,step.target === "pad") && Boolean(point && (point.platformId !== world.platformId || Math.hypot(point.x-world.x,point.y-world.y) >= 24));
    });
    if (work || postReturnFloorClosure(input)) return true;
    // A successful same-serial primitive may finish its short authored
    // gesture. This is ownership only: it never refills physical progress,
    // learning reward or an already exhausted8s decorative budget.
    return owner.closureAt !== undefined && at-owner.closureAt <= 3500 && tail.some(step=>!step.optional)
      && tail.every(step => step.kind === "pose" || step.kind === "watch")
      && tail.reduce((ms,step) => ms+pureDuration(step,input),0) <= 3500;
  };
  const routineOwnership = (input:PersonalitySceneInput):"work"|"leisure"|undefined => {
    if(!routineReserved(input))return;
    const owner=active!;
    if (requiredTvWatch(input)) return "work";
    const tail=owner.recipe.steps.slice(owner.beat), closure=owner.closureAt!==undefined && input.now-owner.closureAt<=3500
      && tail.some(step=>!step.optional) && tail.every(step=>step.kind==="pose"||step.kind==="watch") && tail.reduce((ms,step)=>ms+pureDuration(step,input),0)<=3500;
    // A safe decision boundary may yield optional TV/radio entertainment.
    // Real objects, necessary rest/wash and the completed job's short closure
    // remain authored work. In-flight gestures are owned by the renderer.
    const leisure=!owner.routine && input.preferences.personality!=="homebody" && !closure
      && owner.recipe.steps.some(step=>step.kind==="tv"||step.kind==="radio")
      && owner.recipe.steps.every(step=>step.kind==="pose"||step.kind==="watch"||["tv","light","curtain","radio"].includes(step.kind)
        || step.kind==="go"&&["sofa","floor","window"].includes(step.target));
    return leisure?"leisure":"work";
  };
  return {
    /** Reuse the existing paint/active clock, including moves during legacy
     * ownership. Pose frames and inactive/manual observations grant no credit. */
    observeProgress,
    /** Caller certifies an actual accepted primitive, independently of learning. */
    observeEffect,
    progressDeadline: () => actualProgressAt === undefined ? undefined
      : Math.min(actualProgressAt + ACTUAL_PROGRESS_BUDGET_MS, initialProgressDeadline ?? Infinity),
    event(key: SceneTrigger, at: number) { if (Number.isFinite(at)) { events.set(key, at); if (key === "layout") explorationMemory.layoutChanged(); } },
    /** Moving an unrelated real toy may change what is interesting, but need
     * not erase this unowned public trip. The human still owns the held toy;
     * runtime finishes only its current physical movement before re-proving. */
    retainExplorationForToyInput() {
      const step = active?.recipe.steps[active.beat];
      return Boolean(active && !active.routine && !active.manual && !active.itemId && !active.comparisonItemId
        && !carried && !carriedFood && exploratoryRecipe(active.recipe)
        && step?.kind === "go" && ["outside", "novel-place"].includes(step.target)
        && active.explorationGoals?.has(active.beat));
    },
    cancel() {
      // An interrupted issued greeting is dismissed, not completed. It must
      // not lock common needs forever; no scene/reward/progress ACK is made.
      if (entrySerial !== undefined && !entryFinished) { entryFinished = true; entrySerial = undefined; }
      suspendedExploration = undefined; finish(false);
    },
    /** Only an acknowledged direct touch may dismiss an interrupted voluntary
     * itinerary. Real item/care/control owners survive; dismissal grants no
     * completion, failed-task cooldown, progress, event or learning credit. */
    interruptForPetting(input: Pick<PersonalitySceneInput, "brain" | "preferences" | "carriedToyId" | "carriedFoodId">) {
      const {brain,preferences:p}=input;
      if (active?.recipe.id === "curious-interest" && p.enabled && p.petting && !input.carriedToyId && !input.carriedFoodId
        && !carried && !carriedFood) { active = undefined; suspendedExploration = undefined; return true; }
      if(!active||active.routine||active.itemId||active.comparisonItemId||carried||carriedFood||input.carriedToyId||input.carriedFoodId
        ||!p.enabled||!p.petting||![brain.hunger,brain.energy].every(Number.isFinite)||brain.hunger>=.78||brain.energy<=.18
        ||brain.foodGoal||brain.intention&&brain.intention.kind!=="explore"||brain.episode&&brain.episode.remaining>0&&brain.episode.phase!=="finish")return false;
      const tail=active.recipe.steps.slice(active.beat);
      if(!tail.length||!tail.every(step=>step.kind==="go"||step.kind==="pose"||step.kind==="watch"))return false;
      active=undefined;return true;
    },
    active: () => Boolean(active),
    entryReady: () => entryFinished,
    /** Read-only lookahead at the same safe decision boundary. This reserves
     * no ID/route, starts no owner and grants no progress or completion. It
     * merely keeps an already-feasible approved continuation from losing its
     * first real meal/recovery event to an unneeded generic leisure routine.
     * The common arbiter still admits urgent hunger and exhausted sleep. */
    pendingApprovedContinuationReady(input: PersonalitySceneInput) {
      const { preferences: p, world, brain } = input;
      if (active || first || !entryFinished || selected !== p.personality || !p.enabled || !p.roam || !world.animated || world.paused || input.busy
        || !Number.isFinite(input.now) || input.now < now || ![world.x, world.y, brain.hunger, brain.energy].every(Number.isFinite)
        || input.carriedToyId || input.carriedFoodId || brain.foodGoal || brain.intention && brain.intention.kind !== "explore"
        || brain.episode && brain.episode.remaining > 0 && brain.episode.phase !== "finish") return false;
      const support = world.platforms.find(plane => plane.id === world.platformId);
      if (!support || ["control", "hide"].includes(support.kind) || ![support.x, support.y, support.width].every(Number.isFinite)
        || support.width <= 0 || Math.abs(world.y-support.y)>2 || world.x<support.x || world.x>support.x+support.width) return false;
      const candidates = approvedRecipes.filter(recipe => recipe.personality === p.personality
        && !introducedIdeas.has(recipe.id) && recipe.triggers.every(key => !["pet", "rested", "recovered", "washed", "toy-returned"].includes(key)
          || (events.get(key) ?? -Infinity) <= input.now && (events.get(key) ?? -Infinity) > input.now-(key==="pet"?12000:15000))
        && available(recipe, input));
      return selectionChoices(candidates, input).length > 0;
    },
    /** Caller admits only at a safe checkpoint outside manual/object owners. */
    startRoutine(recipe: PersonalitySceneRecipe, at: number, itemId?: string, outsideGoal?:CompanionOutsideGoal) {
      if (!entryFinished || !lastPosition || recipe.personality !== selected || !/^routine-(meal|wash|sleep|nap|outing|music)$/.test(recipe.id)
        || !Number.isFinite(at) || at < now || !recipe.steps.length || recipe.steps.length > 24 || active?.routine) return false;
      const firstOutside=recipe.steps.findIndex(step=>step.kind==="go"&&step.target==="outside");
      if(recipe.id==="routine-outing"&&firstOutside>=0&&(!outsideGoal?.id||!Number.isFinite(outsideGoal.fraction)||outsideGoal.fraction<0||outsideGoal.fraction>1))return false;
      finish(false); now = at;
      active = { recipe, serial: ++serial, beat: 0, started: at, progressed: at, attempts: 0, count: 0, routine: true,
        lastX: lastPosition.x, lastY: lastPosition.y, ...(itemId ? { itemId } : {}),
        ...(firstOutside>=0&&outsideGoal?{goal:{beat:firstOutside,id:outsideGoal.id,fraction:outsideGoal.fraction}}:{}) };
      if(recipe.id==="routine-outing")outsideDiagnostic?.({stage:"routine-admitted",plannedGoal:Boolean(outsideGoal)});
      return true;
    },
    /** Explicit human request may run with automatic roaming off. The caller
     * owns the current visible mat and waits outside real meal/carry owners. */
    startManualWash(input: PersonalitySceneInput) {
      const { world, preferences: p, home } = input;
      const pad = home.pad, plane = pad && world.platforms.find(value => value.id === pad.platformId);
      const source = world.platforms.find(value => value.id === world.platformId);
      if (!p.enabled || !world.animated || world.paused || input.busy || input.carriedFoodId || input.carriedToyId || active?.manual
        || !Number.isFinite(input.now) || input.now < now || !safe(pad) || pad.platformId !== "companion-home-floor-400"
        || !plane?.bodyOnly || plane.kind !== "floor" || Math.abs(plane.y-pad.y) > .5 || pad.x < plane.x || pad.x > plane.x+plane.width
        || !source || !Number.isFinite(source.width) || source.width <= 0 || ["control","hide"].includes(source.kind)
        || ![world.x,world.y].every(Number.isFinite) || Math.abs(world.y-source.y)>2 || world.x<source.x || world.x>source.x+source.width
        || !findCompanionToyRoute(world,pad,world.platforms,p.jump)) return false;
      finish(false); now = input.now;
      // Dismiss an unissued autonomous greeting, never acknowledge it or grant
      // collection/learning credit for a manual button.
      selected = p.personality; first = false; entryFinished = true; entrySerial = undefined;
      lastPosition = { x: world.x, y: world.y, platformId: world.platformId };
      active = { recipe: { id: "routine-wash", label: "샤워패드에서 씻기", personality: p.personality, major: true, triggers: [], steps: companionWashSteps(p.personality) },
        serial: ++serial, beat: 0, started: now, progressed: now, attempts: 0, count: 0, routine: true, manual: true, lastX: world.x, lastY: world.y };
      return true;
    },
    manualWash: () => Boolean(active?.manual),
    plansMeal: () => Boolean(active?.recipe.steps.slice(active.beat).some(step => step.kind === "food" && ["inspect", "compare", "eat"].includes(step.mode))),
    /** Soft goal ownership at a routine checkpoint, never a physical ACK. */
    routineReserved,
    routineOwnership,
    /** Read-only existing meal cue; only leisure outing may wait for this goal. */
    mealFollowupReady: (input:PersonalitySceneInput) => Boolean(mealFollowupCandidate(input)),
    /** Eligibility only: inspection does not consume the actual return cue. */
    cleanupFollowupReady: (input:PersonalitySceneInput) => Boolean(cleanupFollowupCandidate(input)),
    /** Real unfinished tidy returns defer leisure only; common care and
     * physical/manual owners keep their independent existing priorities. */
    cleanupPending(input: PersonalitySceneInput) {
      if (selected !== input.preferences.personality || selected !== "tidy" || !input.preferences.enabled || !input.preferences.roam
        || !input.world.animated || input.world.paused || input.busy) return false;
      const cleanup = recipes.find(recipe => recipe.id === "T01" && recipe.personality === "tidy");
      return Boolean(cleanup && unfinishedReturn(cleanup,input));
    },
    current: () => active ? { id: active.recipe.id, beat: active.beat, itemId: active.itemId, ...(active.routine ? { routine: true as const } : {}) } : undefined,
    owns: (beat: PersonalitySceneBeat) => Boolean(active && active.recipe.id === beat.id && active.serial === beat.serial && active.beat === beat.beat),
    /** Advisory only: a cold first play packet can transfer during its real
     * preceding route. Never advance the scene, reserve pixels or cross an
     * optional/effect barrier to warm a speculative later performance. */
    imminentPlay(beat: PersonalitySceneBeat, kind: CompanionAction["kind"], p: CompanionPreferences, at: number): CompanionPlay | undefined {
      const command = active?.recipe.steps[active.beat];
      if (!active || active.routine || active.manual || beat.routine || beat.manual || !beat.travel
        || active.recipe.id !== beat.id || active.serial !== beat.serial || active.beat !== beat.beat
        || active.recipe.steps.length > 24 || command?.kind !== "go" || command.optional
        || beat.command.kind !== "go" || beat.command.target !== command.target || beat.command.optional !== command.optional
        || beat.command.audience !== command.audience
        || kind !== "walk" && kind !== "jump" || !p.enabled || !p.roam || selected !== p.personality
        || !Number.isFinite(at) || at < now || at > active.progressed+7500 || at > active.started+60000) return;
      let index = active.beat+1;
      while (active.recipe.steps[index]?.kind === "go" && !active.recipe.steps[index].optional) index++;
      const next = active.recipe.steps[index];
      if (next?.kind !== "pose" || next.optional || next.audience || companionAudiencePlay(next.pose)
        || ["look", "sniff", "stretch", "shake"].includes(next.pose)) return;
      const play = next.pose as CompanionPlay;
      return companionPersonalityPlayAllowed(play,p) ? play : "bow";
    },
    /** Current required source subject only, never an ACK or clock reset.
     * Existing tvWatch is produced only for a real required TV observation;
     * required basic pose rows are matched to this exact command and action. */
    finitePosePresentation(beat: PersonalitySceneBeat, kind: CompanionAction["kind"]): { row: number; expiresAt: number } | undefined {
      const command = active?.recipe.steps[active.beat];
      // An actual automatic wash closes with a required floor exit and one
      // finite recovery. Its source preparation must not spend that recovery
      // before the first packet is usable. Manual care keeps its own clock.
      const washExit = active?.recipe.steps[(active?.beat ?? 0)-1];
      const automaticWashRecovery = Boolean(active?.routine && active.recipe.id === "routine-wash"
        && active.beat === active.recipe.steps.length-1 && active.closureAt !== undefined && active.closureAt <= now
        && washExit?.kind === "go" && washExit.target === "floor" && !washExit.optional
        && active.recipe.steps.slice(0,active.beat-1).some(step => step.kind === "wash" && !step.optional));
      if (!active || beat.id !== active.recipe.id || beat.serial !== active.serial || beat.beat !== active.beat || beat.travel
        || !command || command.optional || beat.command.optional !== command.optional
        || active.manual || beat.manual || Boolean(active.routine) !== Boolean(beat.routine)
        || active.routine && !automaticWashRecovery) return;
      const expiresAt = Math.min(active.progressed + 7500, active.started + 60000);
      const subject = (row: number) => ({ row, expiresAt });
      if (command.kind === "watch" && beat.command.kind === "watch" && kind === "look"
        && command.ms === beat.command.ms && active.tvWatch?.beat === active.beat) return subject(1);
      if (command.kind !== "pose" || beat.command.kind !== "pose" || command.pose !== beat.command.pose
        || command.ms !== beat.command.ms || kind !== command.pose) return;
      if (command.pose === "stretch") return subject(16);
      if (command.pose === "shake") return subject(17);
      if (command.pose === "look" || command.pose === "sniff") return subject(1);
    },
    /** Current same-serial intent for the room-policy handoff. Never expose
     * a cancelled/next recipe or writable catalog objects to the renderer. */
    homeLifeScene(beat: PersonalitySceneBeat) {
      if (!active || active.recipe.id !== beat.id || active.serial !== beat.serial || active.beat !== beat.beat
        || !active.recipe.steps[active.beat] || active.recipe.steps.length > 24) return;
      const steps = Object.freeze(active.recipe.steps.map(step => Object.freeze({ ...step,
        ...(step.kind === "toy" && step.kinds ? { kinds: Object.freeze([...step.kinds]) } : {}) })));
      return Object.freeze({ id: active.recipe.id, beat: active.beat, command: steps[active.beat], steps });
    },
    bind(beat: PersonalitySceneBeat, itemId: string) { if (active?.serial === beat.serial && active.beat === beat.beat && !active.itemId) active.itemId = itemId; },
    completed: () => [...completed],
    /** Called only after a real native effect acknowledges success. */
    resolve(beat: PersonalitySceneBeat, success: boolean, itemId?: string, at?: number) {
      if (!active || beat.serial !== active.serial || beat.beat !== active.beat || beat.travel) return;
      const acknowledgedAt = at === undefined ? now : at;
      const timely = Number.isFinite(acknowledgedAt) && acknowledgedAt >= now;
      if (Number.isFinite(acknowledgedAt) && acknowledgedAt >= now) now = acknowledgedAt;
      if (!success) { if (beat.command.optional) advance(); else finish(false); return; }
      if (timely && beat.command.kind === "toy" && beat.command.mode === "inspect" && itemId
        && active.itemId === itemId && active.inspection?.id === itemId) explorationMemory.confirmToyInspection(active.inspection);
      const ownPlayRelease = beat.command.kind === "toy" && beat.command.mode === "play" && Boolean(itemId) && active.itemId === itemId;
      if (itemId) active.itemId = itemId;
      if (timely && ["toy", "food", "wash", "tv", "light", "curtain", "radio"].includes(beat.command.kind)) active.closureAt = acknowledgedAt;
      // These ACKs certify real physical effects. Inspect/compare are finite
      // observations; they must not masquerade as manipulative progress.
      if (beat.command.kind === "toy" && beat.command.mode !== "inspect") observeEffect("toy", acknowledgedAt);
      if (beat.command.kind === "food" && !["inspect", "compare"].includes(beat.command.mode)) observeEffect("food", acknowledgedAt);
      if (beat.command.kind === "wash") {
        observeEffect("wash", acknowledgedAt);
        if (timely) events.set("washed", acknowledgedAt);
        // Consume this actual aftercare opportunity at the wash ACK itself.
        // An interrupted decorative tail cannot wash twice for one return.
        if (timely && active.recipe.triggers.includes("toy-returned")) {
          const returned=events.get("toy-returned");if(returned!==undefined)heldBack.set("toy-returned",returned);
        }
      }
      if (timely && beat.command.kind === "toy" && beat.command.mode === "return") lastCleanupAt = acknowledgedAt;
      if (beat.command.kind === "toy" && beat.command.mode === "return" && ++active.count < Math.min(2, beat.command.limit ?? 1)) { active.itemId = undefined; active.progressed = now; return; }
      // A typed play may physically toss its subject too. Only the existing
      // same-ID flying observation grants this bounded gravity wait.
      const settling = timely && itemId && beat.command.kind === "toy" && (["toss", "nudge"].includes(beat.command.mode) || ownPlayRelease)
        ? { id: itemId, until: acknowledgedAt + 1500 } : undefined;
      advance();
      if (active && settling) active.settlingToy = settling;
    },
    complete(beat: PersonalitySceneBeat, watch?: PersonalityTvWatchCompletion) {
      if (beat.serial === entrySerial && beat.id === `entry-${selected}` && !beat.travel) { entryFinished = true; return; }
      if (!active || beat.serial !== active.serial || beat.beat !== active.beat || beat.travel) return;
      // Travel is re-proved at the next decision. Delegated ownership and
      // furniture effects need actual ACK, never merely an elapsed pose.
      if (["go", "toy", "food", "wash", "tv", "light", "curtain", "radio"].includes(beat.command.kind)) return;
      const offeredWatch = active.tvWatch;
      // A completed, actually decoded required TV observation may close its
      // same-owner short tail. Merely offering/advancing a watch cannot do so.
      // Reuse the native required-stage coverage rule; full elapsed playback
      // remains separate. Each actual painted interval already caps at100ms.
      // No playback/ownership duration, physical progress or learning credit.
      if (beat.id === active.recipe.id && beat.command.kind === "watch" && !beat.command.optional && offeredWatch?.beat === active.beat
        && watch?.success && watch.active && watch.tv !== "off" && progressActive
        && Number.isFinite(watch.at) && watch.at >= now && watch.at >= offeredWatch.started
        && Number.isFinite(watch.elapsedMs) && watch.elapsedMs >= offeredWatch.duration
        && watch.duration === offeredWatch.duration && Number.isFinite(watch.paintedMs)
        && watch.paintedMs >= offeredWatch.duration*.8-80 && watch.paintedMs <= watch.elapsedMs
        && safe(watch.point) && watch.point.platformId === offeredWatch.point.platformId
        && Math.hypot(watch.point.x-offeredWatch.point.x,watch.point.y-offeredWatch.point.y) <= 2) {
        now = watch.at; active.closureAt = watch.at;
      }
      // Sleep is a legitimate need, not a physical-progress ACK: only the
      // runtime proves painted sleep. Preserve its one finite wake stretch.
      if (beat.command.kind === "sleep") active.waking = true;
      else active.waking = undefined;
      if (restExpression(beat.command)) rememberExpression("rest-expression");
      advance();
    },
    next(input: PersonalitySceneInput): PersonalitySceneProposal | undefined {
      now = Math.max(now, Number.isFinite(input.now) ? input.now : now);
      const { world, preferences: p, brain } = input;
      if (selected !== p.personality) {
        selected = p.personality; quietHomeUntil = -Infinity; first = true; entryFinished = false; entrySerial = undefined; suspendedExploration = undefined; finish(false); cursor = 0;
        selectedAt = now; lastOutsideAt = lastCleanupAt = -Infinity; outsideVisitAt = undefined; waitingReturns.clear();
        actualProgressAt = undefined; actualPoint = undefined; progressActive = false; controls = undefined; carried = carriedFood = undefined; initialProgressDeadline = undefined;
      }
      if (!p.enabled || (!p.roam && !active?.manual) || !world.animated || world.paused || input.busy || !world.platformId) return;
      const support = world.platforms.find(platform => platform.id === world.platformId);
      if (!support && active && (active.goal && !world.platforms.some(plane => plane.id === active!.goal!.id)
        || [...active.explorationGoals?.values() ?? []].some(goal => !world.platforms.some(plane => plane.id === goal.id)))) finish(false);
      if (!support || Math.abs(support.y - world.y) > 2 || world.x < support.x || world.x > support.x + support.width || ["control", "hide"].includes(support.kind)) return;
      const here = { x: world.x, y: world.y, platformId: world.platformId };
      explorationMemory.observe(world, brain.visited);
      if (actualOutside(world)) { lastOutsideAt = now; outsideVisitAt ??= now; }
      else if (atHome(world.platformId)) outsideVisitAt = undefined;
      lastPosition = here;
      if (first) {
        first = false; actualProgressAt = now; initialProgressDeadline = now + ACTUAL_PROGRESS_BUDGET_MS; actualPoint = { ...here };
        controls = { tv: input.tv, light: input.lightLit, curtain: input.curtainPhase, radio: input.radioPlaying }; carried = input.carriedToyId; carriedFood = input.carriedFoodId;
        const preparation=companionEntryPreparation(p.personality,world,p.jump,p.sleep);
        const command: SceneBeat = {kind:"pose",pose:preparation.kind==="play" ? preparation.play : preparation.kind};
        const entryMeta = { id: `entry-${p.personality}`, serial: ++serial, beat: 0, command }; entrySerial = entryMeta.serial;
        return {meta:entryMeta,action:{...preparation,personalityScene:entryMeta,personalitySignature:p.personality}};
      }
      observeProgress({ now, active: true, point: here, carriedToyId: input.carriedToyId, carriedFoodId: input.carriedFoodId,
        controls: { tv: input.tv, light: input.lightLit, curtain: input.curtainPhase, radio: input.radioPlaying } });
      if (active?.routine && (!p.feeding && active.recipe.id === "routine-meal" || !p.sleep && ["routine-sleep", "routine-nap"].includes(active.recipe.id))) finish(false);
      if (active?.recipe.triggers.includes("music") && !fittingMusic(active.recipe.id, input)) finish(false);
      if (active) {
        if (Math.hypot(world.x - active.lastX, world.y - active.lastY) > 4) { active.progressed = now; active.lastX = world.x; active.lastY = world.y; }
        if (now - active.progressed > 7500 || now - active.started > 60000) finish(false,now-active.started>60000?"duration-timeout":"progress-timeout");
      }
      // A remaining chore is re-proved at each safe decision. A person can
      // grab/remove it after the previous delivery; momentum cannot keep a
      // stale return or its preparation alive when that actual work is gone.
      if (active?.recipe.id === "T01" && !input.carriedToyId
        && active.recipe.steps.find(step=>step.kind==="toy")?.mode === "return"
        && active.recipe.steps.slice(active.beat).some(step=>step.kind==="toy"&&step.mode==="return"&&!step.optional)
        && !unfinishedReturn(active.recipe,input)) finish(false);
      investigateChangedToy(input);
      if (!active) {
        const pool = recipes.filter(recipe => recipe.personality === p.personality && available(recipe, input));
        const choices = selectionChoices(pool,input);
        const major = choices.filter(recipe => recipe.major), event = choices.filter(recipe => recipe.triggers.some(key => !["free", "toy", "food", "tv", "night", "summer", "rain", "experience"].includes(key)));
        const mealFollowup=mealFollowupCandidate(input,choices);
        const cleanupFollowup=cleanupFollowupCandidate(input,choices);
        // Introduce each owner-approved continuation once at its first real
        // eligible opportunity. This is selection only, never a completion or
        // a timer that cancels an existing chore/meal/touch/sleep owner.
        const introduction = choices.find(recipe => recipe.id.startsWith("D157-") && !introducedIdeas.has(recipe.id));
        const returns = choices.filter(recipe => recipe.steps.some(step => step.kind === "toy" && step.mode === "return" && !step.optional));
        for (const id of waitingReturns.keys()) if (!returns.some(recipe => recipe.id === id)) waitingReturns.delete(id);
        for (const recipe of returns) if (!waitingReturns.has(recipe.id)) waitingReturns.set(recipe.id, cursor);
        const dueReturn = !event.some(recipe => recipe.triggers.includes("pet"))
          ? returns.find(recipe => cursor - waitingReturns.get(recipe.id)! >= 2) : undefined;
        const group = cleanupFollowup ? [cleanupFollowup] : introduction ? [introduction] : mealFollowup && choices.includes(mealFollowup) ? [mealFollowup] : dueReturn ? [dueReturn] : event.length ? event : major.length && cursor % 4 !== 3 ? major : choices;
        // Prefer a whole currently executable goal within this same priority
        // group. Keep a real chore with an unneeded rest tail when it is the
        // only option; never discard the physical return for script variety.
        const whole = group.filter(recipe => authoredSleepNeeded(input) || !recipe.steps.some(step => step.kind === "sleep" && !step.optional));
        const candidates = whole.length ? whole : group;
        // A tidying session resumes the real remaining chore before script
        // variety. The renderer still owns carried/manual work and urgent
        // care; route, identity, held, hunger and energy proofs stay intact.
        const preferred = cursor++ % Math.max(1, candidates.length);
        const ordinary = candidates[preferred];
        const cleanup = p.personality === "tidy" && !input.yieldedItem && brain.hunger < .78
          ? ordinary && unfinishedReturn(ordinary,input) ? ordinary : pool.find(recipe => recipe.id === "T01" && unfinishedReturn(recipe, input)) : undefined;
        let recipe = cleanup ?? ordinary;
        if (!cleanup && p.learnFromYou && input.experience && candidates.length > 1) {
          const context = atHome(world.platformId) ? "home" : "outside";
          const ranked = candidates.map((candidate, index) => {
            const purpose = family(candidate), value = purpose ? input.experience!.score({ personality: p.personality, context, family: purpose, learn: true }) : 0;
            return { candidate, score: Number.isFinite(value) ? Math.max(-.1,Math.min(.2,value)) : 0, index };
          });
          if (ranked.some(item => item.score !== 0)) recipe = ranked.sort((a,b) => (b.score + Number(b.index === preferred) * .04) - (a.score + Number(a.index === preferred) * .04))[0].candidate;
        }
        if (recipe) waitingReturns.delete(recipe.id);
        if (recipe) active = { recipe, serial: ++serial, beat: 0, started: now, progressed: now, attempts: 0, lastX: world.x, lastY: world.y, count: 0,
          ...(exploratoryRecipe(recipe) ? { explorationGoals: explorationPlans(recipe, input) } : {}),
          ...(atHome(world.platformId) && quietHomeRecipe(recipe) ? { quietHome: true as const, quietControls: { tv: input.tv, light: input.lightLit, curtain: input.curtainPhase, radio: input.radioPlaying } } : {}) };
        else return;
      }
      // At most four zero-duration transitions per existing decision.
      for (let transitions = 0; active && transitions < 4; transitions++) {
        let command = active.recipe.steps[active.beat];
        if (active.recipe.id === "C01" && active.beat === 0) {
          // A prior successful same-object inspection already supplied this
          // introduction. Keep the real play/pick/return, omitting only the
          // repeated sniff/side-peek prefix. This shortened plan earns no
          // fictitious full-C01 completion or played/collection credit.
          if (!active.itemId) targetFor("toy", input);
          const toy = input.toys.find(toy => toy.id === active!.itemId);
          const playAt = active.recipe.steps.findIndex(step => step.kind === "toy" && step.mode === "play");
          if (toy && playAt > active.beat && explorationMemory.inspectedToy(toy, world)) {
            active.abbreviated = true; active.beat = playAt; active.attempts = active.count = 0; active.goal = undefined;
            command = active.recipe.steps[active.beat];
          }
        }
        // The next real object is the continuation of the same chore. Omit
        // repeated preparation/celebration between returns, while keeping
        // each native same-ID delivery and its own completion unchanged.
        if (p.personality === "tidy" && active.recipe.id === "T01" && command?.kind === "pose"
          && active.recipe.steps.find(step=>step.kind==="toy")?.mode === "return"
          && now-lastCleanupAt < 8000 && !input.yieldedItem && unfinishedReturn(active.recipe,input)) {
          advance(); continue;
        }
        if(command?.kind==="tv" && command.state==="next" && input.canTv!==false) {
          const choice=active.tvChoice?.beat===active.beat ? active.tvChoice : {beat:active.beat,state:randomCompanionHomeTvChannel(rng)};
          active.tvChoice=choice;command={...command,state:choice.state};
        }
        if (!command) { finish(true); return; }
        if (input.homeLifeControl && (command.kind === "light" || command.kind === "tv")) {
          const normalized = input.homeLifeControl(command, { id: active.recipe.id, beat: active.beat, steps: active.recipe.steps });
          if (normalized.kind === command.kind) command = normalized;
        }
        // S03's same-ID return still happens at high energy. Only its now
        // unnecessary cushion/sleep tail is omitted after the actual ACK.
        if (!active.routine && !authoredSleepNeeded(input)
          && active.recipe.steps.slice(0, active.beat).some(step => step.kind === "toy" && step.mode === "return" && !step.optional)
          && active.recipe.steps.slice(active.beat).some(step => step.kind === "sleep")
          && active.recipe.steps.slice(active.beat).every(step => step.kind === "pose" || step.kind === "sleep" || step.kind === "go" && step.target === "sofa")) {
          active.abbreviated = true; advance(); continue;
        }
        // Check the upcoming duration, not just elapsed age: starting a3.2s
        // pose at7.8s would otherwise create an11s stationary interval.
        // A yielded decorative plan is cancelled, never resumed elsewhere.
        const duration = pureDuration(command, input);
        const waking = active.waking && command.kind === "pose" && command.pose === "stretch";
        const directTouch = active.recipe.triggers.includes("pet") && trigger("pet",input);
        if (duration > 0 && !waking && !directTouch && !input.carriedToyId && actualProgressAt !== undefined
          && now + duration > Math.min(actualProgressAt + ACTUAL_PROGRESS_BUDGET_MS, initialProgressDeadline ?? Infinity)) {
          // An inspection's CURRENT far target can already prove real travel.
          // Offer that actual first leg before charging its later stationary
          // sniff. Near/missing/unreachable targets keep the shared8s limit.
          if ((command.kind === "toy" || command.kind === "food" && p.feeding) && command.mode === "inspect") {
            const point = targetFor(command.kind, input);
            const approach = safe(point) && Math.hypot(point.x-world.x, point.y-world.y) >= 48 ? go(point, command, input) : undefined;
            if (approach?.action && Math.hypot(approach.action.target.x-world.x, approach.action.target.y-world.y) >= 24) return approach;
          }
          if (remainingRequiredWork(input)) {
            // Future real work does not excuse a stationary pose chain. Keep
            // that same-ID goal, but move past the decoration into real work.
            active.abbreviated = true; advance(); continue;
          }
          finish(false); return;
        }
        if (command.kind === "go") {
          const point = targetFor(command.target, input);
          if (safe(point)) attention = point;
          const arrivalRange = command.target === "toy" && active.recipe.id === "D157-M" ? 8 : command.target === "toy" || command.target === "food" ? 34 : 24;
          if (arrived(point, world, arrivalRange)) { advance(); continue; }
          const offered = safe(point) ? go(point, command, input) : undefined;
          if (offered) return offered;
          if (!point && ["toy", "toy-other-side"].includes(command.target) && waitingForOwnToy(input)) {
            const waiting = action(command, { kind: "look", target: here, duration: 250 }, input);
            waiting.meta.travel = true; waiting.action!.personalityScene.travel = true; return waiting;
          }
          if(active.recipe.id==="routine-outing"&&command.target==="outside")outsideDiagnostic?.(companionOutsideRouteFact("outside-unavailable",world,point,undefined));
          if (command.optional) { advance(); continue; } finish(false,active.recipe.id==="routine-outing"&&command.target==="outside"?"outside-unavailable":undefined); return;
        }
        if (command.kind === "toy" || command.kind === "food") {
          if (command.mode !== "spawn" && !active.itemId) {
            if (["T10", "B05"].includes(active.recipe.id)) active.itemId = input.interruptedItemId;
            else if (active.recipe.id === "T09") active.itemId = input.deferredToyId;
            else targetFor(command.kind, input);
            if (!active.itemId) {
              // B04 returns up to two real toys. A completed first return may
              // continue to the window when no second reachable toy exists.
              // A reserved ID never enters this branch, so losing that item
              // still fails instead of being counted as another return.
              if (active.recipe.id === "B04" && command.kind === "toy" && command.mode === "return" && active.count > 0) { advance(); continue; }
              if (command.optional) { advance(); continue; }
              finish(false); return;
            }
          }
          if (command.kind === "food" && command.mode === "compare") {
            const main = world.foods?.find(food => food.id === active!.itemId);
            const partner = active.comparisonItemId ? world.foods?.find(food => food.id === active!.comparisonItemId)
              : main && world.foods?.filter(food => food.id !== main.id && Math.hypot(food.x-main.x,food.y-main.y) <= 160
                && food.platformId === world.platformId && Math.hypot(food.x-world.x,food.y-world.y) <= 72
                && findCompanionToyRoute(world,food,world.platforms,p.jump))
                .sort((a,b) => Math.hypot(a.x-main.x,a.y-main.y)-Math.hypot(b.x-main.x,b.y-main.y))[0];
            // A comparison is a nearby glance, never a cross-screen detour.
            // Losing its secondary object does not replace the chosen meal.
            if (!main || !partner || brain.hunger >= .65 || Math.hypot(partner.x-main.x,partner.y-main.y) > 160
              || partner.platformId !== world.platformId || Math.hypot(partner.x-world.x,partner.y-world.y) > 72) { advance(); continue; }
            active.comparisonItemId = partner.id;
          }
          // The existing full toy jobs also make the object familiar. A later
          // unrelated settle event must not rediscover that unchanged toy.
          if (command.kind === "toy" && command.mode !== "spawn") {
            const toy = input.toys.find(toy => toy.id === active!.itemId);
            if (toy) {
              const observation = explorationMemory.inspectToy(toy, world);
              if (command.mode === "inspect") active.inspection = observation;
            }
          }
          return { meta: meta(command), delegate: command };
        }
        if (command.kind === "tv" || command.kind === "light" || command.kind === "curtain" || command.kind === "radio") {
          if (command.kind === "light" && input.lightLit === command.lit || command.kind === "tv" && command.state !== "next" && input.tv === command.state
            || command.kind === "curtain" && input.curtainPhase === command.phase || command.kind === "radio" && input.radioPlaying === command.playing) { advance(); continue; }
          if (command.kind === "curtain" && input.canCurtain === false || command.kind === "radio" && (input.radioAllowed === false || command.playing && !p.sound)
            || command.kind === "tv" && input.canTv === false) { if (command.optional) { advance(); continue; } finish(false); return; }
          const point = command.kind === "curtain" ? input.home.curtain ?? input.home.window : input.home[command.kind];
          const contact = input.home.contacts?.[command.kind];
          if (!safe(point) || !safe(contact)) { if (command.optional) { advance(); continue; } finish(false); return; }
          const cord = command.kind === "light" || command.kind === "curtain";
          const needsAlignment = cord ? Math.abs(point.x - world.x) > 1
            : Math.hypot(point.x - world.x, point.y - world.y) > 24;
          if (needsAlignment || point.platformId !== world.platformId) {
            const offered = go(point, command, input); if (offered) return offered;
            if (command.optional) { advance(); continue; } finish(false); return;
          }
          const offered = action(command, { kind: "play", play: cord && p.jump ? "pounce" : "bow", target: here, duration: cord && p.jump ? companionPlayDuration("pounce") : 900 }, input);
          offered.meta.interactionContact = { ...contact }; offered.action!.personalityScene.interactionContact = { ...contact };
          return offered;
        }
        if (command.kind === "sleep" && (!p.sleep || !atHome(world.platformId) || !active.routine && !authoredSleepNeeded(input))) {
          if (!command.optional) active.abbreviated = true;
          advance(); continue;
        }
        if (command.kind === "sleep") return action(command, { kind: "sleep", living: "cozy", target: here, duration: Math.min(7000, Math.max(2000, command.ms)) }, input);
        if (command.kind === "hide") return action(command, { kind: "hide", target: here, duration: Math.min(3000, command.ms) }, input);
        if (command.kind === "watch") {
          // A person-facing departure changes the watch's real subject.
          // Do not silently reset an outside meeting back to the TV sofa.
          const watchesTv = watchTargetsTv(active.recipe, active.beat);
          active.tvWatch = undefined;
          if (watchesTv && input.tv !== "off" && input.home.sofa && world.platformId !== input.home.sofa.platformId) { const offered = go(input.home.sofa, command, input); if (offered) return offered; }
          if (watchesTv && input.home.tv) attention = input.home.tv;
          const duration = Math.min(3500, Math.max(650, command.ms));
          if (requiredTvWatch(input) && input.canTv !== false && world.platformId === input.home.sofa?.platformId)
            active.tvWatch = { beat: active.beat, started: now, duration, point: { ...here } };
          return action(command, { kind: "look", direction: (attention?.x ?? input.home.tv?.x ?? world.x) < world.x ? -1 : 1, target: here, duration, ...(attention ? { attention: { kind: "social", point: attention } } : {}) }, input);
        }
        if (command.kind === "wash") {
          const pad = input.home.pad;
          const support = pad && world.platforms.find(platform => platform.id === pad.platformId);
          if (!pad || pad.platformId !== "companion-home-floor-400" || !support?.bodyOnly || Math.abs(pad.y - support.y) > .5 || pad.x < support.x || pad.x > support.x + support.width) { finish(false); return; }
          if (Math.hypot(pad.x - world.x, pad.y - world.y) > 1 || pad.platformId !== world.platformId) { const offered = go(pad, command, input); if (offered) return offered; finish(false); return; }
          return action(command, { kind: "play", play: "groom", target: here, duration: Math.min(4000, Math.max(1500, command.ms)) }, input);
        }
        if (command.kind === "pose") {
          const pose = command.pose;
          if ((command.audience || companionAudiencePlay(pose)) && !companionMayAddressAudience(world,active.recipe.triggers.includes("pet"))) {
            const point=targetFor("outside",input), offered=point && go(point,command,input);
            if(offered) return offered;
            finish(false); return;
          }
          if (["look", "sniff", "stretch", "shake"].includes(pose)) return action(command, { kind: pose as "look" | "sniff" | "stretch" | "shake", ...(pose === "sniff" && active.itemId ? { direction: (input.toys.find(toy => toy.id === active!.itemId)?.x ?? world.foods?.find(food => food.id === active!.itemId)?.x ?? world.x) < world.x ? -1 as const : 1 as const } : {}), target: here, duration: Math.min(2500, command.ms ?? 900) }, input);
          const play = companionPersonalityPlayAllowed(pose as CompanionPlay, p) ? pose as CompanionPlay : "bow";
          return action(command, { kind: "play", play, target: here, duration: companionPlayDuration(play) }, input);
        }
      }
    },
  };
}

/** A reached final waypoint can finish without returning an action. Keep
 * this decision with the authored director, instead of admitting a legacy
 * toy/household job in that transition gap. One bounded retry also consumes
 * a finite group of already-satisfied room controls; no clock advances here. */
export function nextCompanionPersonalityScene(director: ReturnType<typeof createCompanionPersonalityDirector>, input: PersonalitySceneInput): PersonalitySceneProposal | undefined {
  const owned = director.active(), proposal = director.next(input);
  return proposal ?? (owned || director.active() ? director.next(input) : undefined);
}

import { findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionPlay, type CompanionWorld } from "./brain";
import { findCompanionPointerRoute } from "./reactive-cues";
import { companionToyFoodPriority, findCompanionToyRoute, MAX_COMPANION_TOYS, type CompanionToy } from "./toys";
import { findCompanionHomeItemRoute, selectCompanionHomeFoodDestination } from "./home-pantry";
import { companionPlayDuration } from "./timing";
import { COMPANION_FULL_THRESHOLD } from "./care";
import { COMPANION_FOOD_CATEGORY } from "./snacks";
import type { CompanionToyKind } from "./toy-catalog";
import type { CompanionPreferences } from "./preferences";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionHomeEnvironment } from "./home-environment";
import type { CompanionHomeTvState } from "./home-room-media";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe, type SceneBeat, type SceneTrigger } from "./personality-scene-catalog";
import { companionPersonalityPlayAllowed } from "./personality-activity";
import type { CompanionRadioMood } from "./radio-reaction";
import type { CompanionAgentExperience, CompanionExperienceFamily } from "./agent-experience";

type Point = { x: number; y: number; platformId?: string };
export type PersonalityHome = Partial<Record<"sofa" | "floor" | "window" | "pad" | "box" | "dispenser" | "tv" | "light" | "curtain" | "radio", Point>> & {
  /** Actual painted handle/button/cord, independent of the body's floor slot. */
  contacts?: Partial<Record<"tv" | "light" | "curtain" | "radio", { x: number; y: number }>>;
};
export type PersonalitySceneInput = {
  world: CompanionWorld; brain: CompanionBrain; preferences: CompanionPreferences; now: number;
  home: PersonalityHome; toys: readonly CompanionToy[]; tv: CompanionHomeTvState;
  environment?: CompanionHomeEnvironment; favoriteFood?: string | null; learnedSocial?: boolean;
  busy?: boolean; canTv?: boolean; canCurtain?: boolean; radioAllowed?: boolean; equipped?: boolean; hasExperience?: boolean;
  yieldedItem?: boolean; yieldedItemId?: string; storedFoodIds?: readonly string[]; favoriteToy?: string | null;
  toyPlayCounts?: Partial<Record<CompanionToyKind, number>>; toyCount?: number; curtainPhase?: "open" | "shade" | "closed"; lightLit?: boolean; familiarHour?: boolean; learnedMorning?: boolean; carriedToyId?: string; carriedFoodId?: string; deferredToyId?: string; interruptedItemId?: string;
  music?: { mood?: CompanionRadioMood; familiar: boolean }; radioPlaying?: boolean;
  experience?: Pick<CompanionAgentExperience, "score">;
};
export type PersonalityProgressObservation = {
  now: number; active: boolean; point?: Point; carriedToyId?: string; carriedFoodId?: string;
  controls?: { tv?: CompanionHomeTvState; light?: boolean; curtain?: "open" | "shade" | "closed"; radio?: boolean };
};
export type PersonalitySceneBeat = { id: string; serial: number; beat: number; command: SceneBeat; itemId?: string; comparisonItemId?: string; travel?: true; routine?: true; homeFloorEntry?: true; interactionContact?: { x: number; y: number } };
export type PersonalitySceneAction = CompanionAction & { personalityScene: PersonalitySceneBeat; personalitySignature: CompanionPreferences["personality"] };
export type PersonalitySceneProposal = { meta: PersonalitySceneBeat; action?: PersonalitySceneAction; delegate?: Extract<SceneBeat, { kind: "toy" | "food" }> };
const entry: Readonly<Record<CompanionPreferences["personality"], readonly CompanionPlay[]>> = {
  performer: ["cheer-rehearsal", "bow", "celebrate"], curious: ["bow", "pounce", "groom"], affectionate: ["ask-petting", "lean-nuzzle", "bow"],
  sleepy: ["cozy-nest", "doze-curl", "groom"], tidy: ["groom", "bow"],
  mischievous: ["pounce", "tumble", "celebrate"], gourmet: ["bow", "groom", "celebrate"], homebody: ["cozy-nest", "lean-nuzzle", "groom"], balanced: ["bow", "celebrate", "groom", "ask-petting"],
};
const safe = (point: Point | undefined): point is Point => Boolean(point && [point.x, point.y].every(Number.isFinite));
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
export function createCompanionPersonalityDirector(recipes: readonly PersonalitySceneRecipe[] = COMPANION_PERSONALITY_SCENES) {
  let serial = 0, selected: CompanionPreferences["personality"] | undefined, first = true, cursor = 0;
  let active: { recipe: PersonalitySceneRecipe; serial: number; beat: number; started: number; progressed: number; attempts: number; itemId?: string; comparisonItemId?: string; lastX: number; lastY: number; count: number; routine?: true; abbreviated?: true; waking?: true; closureAt?: number; goal?: { beat: number; id: string; fraction?: number }; quietHome?: true; quietMaterial?: true; quietControls?: PersonalityProgressObservation["controls"] } | undefined;
  let entrySerial: number | undefined, entryFinished = false, lastPosition: Point | undefined;
  // Existing active time only. A completed pose/beat/scene never refills this.
  // Initial entry receives one finite startup grace before this clock begins.
  let actualProgressAt: number | undefined, actualPoint: Point | undefined, progressActive = false;
  let initialProgressDeadline: number | undefined;
  let carried: string | undefined, carriedFood: string | undefined;
  let controls: PersonalityProgressObservation["controls"];
  let lastCompleted = "", lastPerformance = -Infinity;
  // One ephemeral completion cooldown, across home supports/families only.
  let quietHomeUntil = -Infinity;
  const events = new Map<SceneTrigger, number>(), completed: string[] = [], failures = new Map<string, number>();
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
  const finish = (success: boolean) => {
    if (active) {
      if (success) {
        lastCompleted = active.recipe.id;
        // Real chores may finish after an unneeded decorative tail is omitted.
        // Such a partial scene is not a completion of every authored beat.
        if (!active.abbreviated) { completed.push(lastCompleted); if (completed.length > 12) completed.shift(); }
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
  const advance = () => { if (!active) return; active.beat++; active.progressed = now; active.attempts = active.count = 0; if (active.beat >= active.recipe.steps.length) finish(true); };
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
  const available = (recipe: PersonalitySceneRecipe, input: PersonalitySceneInput) => {
    if ((failures.get(recipe.id) ?? -Infinity) > now || !recipe.triggers.every(key => trigger(key, input))) return false;
    const { world: w, brain: b, preferences: p, home } = input, id = recipe.id;
    const returnIndex = recipe.steps.findIndex(step => step.kind === "toy" && step.mode === "return" && !step.optional);
    const spawnFloor = home.box && w.platforms.find(plane => plane.id === home.box!.platformId);
    const createsBeforeReturn = returnIndex >= 0 && recipe.steps.slice(0,returnIndex).some(step => step.kind === "toy" && step.mode === "spawn" && !step.optional)
      && safe(home.box) && spawnFloor?.kind === "floor" && !spawnFloor.bodyOnly && /^companion-home-floor(?:-\d+)?$/.test(spawnFloor.id)
      && Math.abs(home.box.y-spawnFloor.y) <= 2 && home.box.x >= spawnFloor.x && home.box.x <= spawnFloor.x+spawnFloor.width
      && Boolean(findCompanionToyRoute(w,home.box,w.platforms,p.jump,true));
    // Prove a required same-object return before its preparatory expression.
    // A preceding take-out creates its own future object under existing gates.
    if (returnIndex >= 0 && !createsBeforeReturn && !returnRouteAvailable(recipe,input)) return false;
    const requiredSleep = recipe.steps.some(step => step.kind === "sleep" && !step.optional);
    const actualChore = recipe.steps.some(step => !step.optional && (step.kind === "toy" || step.kind === "food" || step.kind === "wash"));
    if (requiredSleep && !actualChore && !authoredSleepNeeded(input)) return false;
    if (recipe.steps.some(step => step.kind === "food" && step.mode === "eat" && !step.optional)
      && (!p.feeding || b.hunger < COMPANION_FULL_THRESHOLD)) return false;
    // A real need never loses admission to expression repetition memory.
    const repeated = requiredSleep && authoredSleepNeeded(input) ? undefined : repeatFamily(recipe), recent = repeated && recentPurposes.get(repeated);
    if (recent && recent.until > now && recent.point.platformId === w.platformId && Math.hypot(recent.point.x - w.x, recent.point.y - w.y) < 96) return false;
    if (quietHomeUntil > now && atHome(w.platformId) && quietHomeRecipe(recipe) && !quietHomeControlChange(recipe, input)) return false;
    if (id === "C01" && !input.toys.some(toy => !(input.toyPlayCounts?.[toy.kind] ?? 0))) return false;
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
    if (["C09", "G04", "B03", "B09"].includes(id) && (id.startsWith("G") || id === "B03" ? (w.foods?.length ?? 0) < 2 : input.toys.length < 2)) return false;
    if (id === "B02" && (purposes.length < 2 || purposes.at(-1) !== purposes.at(-2))) return false;
    if (id === "M05" && b.energy > .7 || id === "H03" && !trigger("summer", input)) return false;
    if (["X-P-house", "A11", "X-A-house", "M05", "X-M-house", "X-B-house"].includes(id) && input.tv === "off") return false;
    if (id === "X-P-house" && input.tv !== "music") return false;
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
      if (step.kind === "toy" && step.kinds?.length && !step.optional && !mayCreateToy && !input.toys.some(toy => !toy.held && !toy.carried && !toy.hidden && step.kinds!.includes(toy.kind))) return false;
    }
    return true;
  };
  const meta = (command: SceneBeat): PersonalitySceneBeat => ({ id: active!.recipe.id, serial: active!.serial, beat: active!.beat, command,
    ...(active!.routine ? { routine: true } : {}), ...(active!.recipe.steps.slice(active!.beat).some(step => step.kind === "toy" && step.mode === "return" && !step.optional) ? { homeFloorEntry: true as const } : {}), ...(active!.itemId ? { itemId: active!.itemId } : {}), ...(active!.comparisonItemId ? { comparisonItemId: active!.comparisonItemId } : {}) });
  const action = (command: SceneBeat, value: CompanionAction, input: PersonalitySceneInput): PersonalitySceneProposal => ({ meta: meta(command), action: { ...value, personalityScene: meta(command), personalitySignature: input.preferences.personality } });
  const toyCandidates = (recipe: PersonalitySceneRecipe | undefined, input: PersonalitySceneInput) => {
    const typed = recipe?.steps.find(step => step.kind === "toy" && step.kinds), kinds = typed?.kind === "toy" ? typed.kinds : undefined;
    const preferred = recipe?.id === "H02" ? input.favoriteToy : undefined;
    return input.toys.slice(0, 4).filter(toy => (!preferred || toy.kind === preferred && !atHome(toy.platformId))
      && !toy.held && !toy.carried && !toy.hidden && toy.platformId && (!kinds?.length || kinds.includes(toy.kind))
      && (recipe?.id !== "C01" || !(input.toyPlayCounts?.[toy.kind] ?? 0)));
  };
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
  const targetFor = (target: Extract<SceneBeat, { kind: "go" }>["target"], input: PersonalitySceneInput): Point | undefined => {
    const { world, home } = input;
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
      const foods = world.foods ?? [], favoriteOnly = active && ["G01", "T02", "G02", "H08"].includes(active.recipe.id), discardOnly = active?.recipe.id === "T03";
      const fresh = active?.recipe.id === "G04" ? freshFamiliarFood(input) : undefined;
      const eligible = foods.filter(food => (active?.recipe.id !== "G04" || food.id === fresh?.id) && (active?.recipe.id !== "C02" || !input.brain.life?.tastedFoods.includes(food.kind)) && (active?.recipe.id !== "T06" || foods.some(other => other.id !== food.id && other.platformId === food.platformId && Math.hypot(other.x-food.x,other.y-food.y) < 36)) && (!favoriteOnly || food.kind === input.favoriteFood) && (!discardOnly || food.kind !== input.favoriteFood) && (active?.recipe.id !== "G03" || input.storedFoodIds?.includes(food.id)));
      if (active?.recipe.id === "B03") eligible.sort((a,b) => {
        const dist = Math.hypot(a.x-world.x,a.y-world.y) - Math.hypot(b.x-world.x,b.y-world.y);
        if (input.brain.hunger >= .65 || !input.preferences.learnFromYou) return dist;
        return (Number(Boolean(input.brain.life?.tastedFoods.includes(a.kind))) - Number(Boolean(input.brain.life?.tastedFoods.includes(b.kind)))) * 10000 + dist;
      });
      if (input.preferences.personality === "gourmet" && active?.recipe.id !== "G04") eligible.sort((a,b) => Math.hypot(a.x-world.x,a.y-world.y) - Math.hypot(b.x-world.x,b.y-world.y));
      const food = active?.itemId ? eligible.find(food => food.id === active!.itemId) : eligible[0]; if (food && active) active.itemId = food.id; return food;
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
    if (!route) return;
    const step = route[0];
    if (!step) return;
    const speed = input.preferences.speed === "relaxed" ? 65 : input.preferences.speed === "lively" ? 135 : 100;
    const offered = action(command, { ...step, pace: input.preferences.personality === "sleepy" ? "amble" : "scoot", duration: step.kind === "jump" ? 850 : Math.max(220, Math.abs(step.target.x - input.world.x) / speed * 1000) }, input);
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
    if (command.kind !== "pose") return 0;
    if (["look", "sniff", "stretch", "shake"].includes(command.pose)) return Math.min(2500, command.ms ?? 900);
    const play = companionPersonalityPlayAllowed(command.pose as CompanionPlay, input.preferences) ? command.pose as CompanionPlay : "bow";
    return companionPlayDuration(play);
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
    if (!authoredSleepNeeded(input) && owner.recipe.steps.slice(0,owner.beat).some(step => step.kind === "toy" && step.mode === "return" && !step.optional)
      && tail.some(step => step.kind === "sleep") && tail.every(step => step.kind === "pose" || step.kind === "sleep" || step.kind === "go" && step.target === "sofa")) return false;
    const toyReady = (step: Extract<SceneBeat,{kind:"toy"}>) => (step.mode !== "return" || connected(home.box))
      && input.toys.slice(0,4).some(toy => (!owner.itemId || toy.id === owner.itemId) && !toy.held && !toy.hidden && !toy.carried
        && (!step.kinds?.length || step.kinds.includes(toy.kind)) && connected(toy.stance ?? toy));
    const head = tail[0];
    // A later rest cannot reserve a currently lost mandatory object. Let the
    // director fail that exact job and let real care arbitrate next normally.
    if (head && !head.optional && (head.kind === "toy" && head.mode !== "spawn" && !toyReady(head)
      || head.kind === "food" && (!p.feeding || head.mode !== "spawn" && !world.foods?.some(food => (!owner.itemId || food.id === owner.itemId) && connected(food))))) return false;
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
      if (step.target === "novel-place") return Boolean(owner.goal && world.platforms.some(plane => plane.id === owner.goal!.id && !plane.bodyOnly && !plane.manualOnly && !["control","hide"].includes(plane.kind)));
      const point = home[step.target];
      return connected(point,step.target === "pad") && Boolean(point && (point.platformId !== world.platformId || Math.hypot(point.x-world.x,point.y-world.y) >= 24));
    });
    if (work) return true;
    // A successful same-serial primitive may finish its short authored
    // gesture. This is ownership only: it never refills physical progress,
    // learning reward or an already exhausted8s decorative budget.
    return owner.closureAt !== undefined && at-owner.closureAt <= 3500 && tail.length > 0
      && tail.every(step => step.kind === "pose" || step.kind === "watch")
      && tail.reduce((ms,step) => ms+pureDuration(step,input),0) <= 3500;
  };
  return {
    /** Reuse the existing paint/active clock, including moves during legacy
     * ownership. Pose frames and inactive/manual observations grant no credit. */
    observeProgress,
    /** Caller certifies an actual accepted primitive, independently of learning. */
    observeEffect,
    progressDeadline: () => actualProgressAt === undefined ? undefined
      : Math.min(actualProgressAt + ACTUAL_PROGRESS_BUDGET_MS, initialProgressDeadline ?? Infinity),
    event(key: SceneTrigger, at: number) { if (Number.isFinite(at)) events.set(key, at); },
    cancel() {
      // An interrupted issued greeting is dismissed, not completed. It must
      // not lock common needs forever; no scene/reward/progress ACK is made.
      if (entrySerial !== undefined && !entryFinished) { entryFinished = true; entrySerial = undefined; }
      finish(false);
    },
    active: () => Boolean(active),
    entryReady: () => entryFinished,
    /** Caller admits only at a safe checkpoint outside manual/object owners. */
    startRoutine(recipe: PersonalitySceneRecipe, at: number, itemId?: string) {
      if (!entryFinished || !lastPosition || recipe.personality !== selected || !/^routine-(meal|wash|sleep|nap|outing|music)$/.test(recipe.id)
        || !Number.isFinite(at) || at < now || !recipe.steps.length || recipe.steps.length > 24 || active?.routine) return false;
      finish(false); now = at;
      active = { recipe, serial: ++serial, beat: 0, started: at, progressed: at, attempts: 0, count: 0, routine: true,
        lastX: lastPosition.x, lastY: lastPosition.y, ...(itemId ? { itemId } : {}) };
      return true;
    },
    plansMeal: () => Boolean(active?.recipe.steps.slice(active.beat).some(step => step.kind === "food" && ["inspect", "compare", "eat"].includes(step.mode))),
    /** Soft goal ownership at a routine checkpoint, never a physical ACK. */
    routineReserved,
    /** Real unfinished tidy returns defer leisure only; common care and
     * physical/manual owners keep their independent existing priorities. */
    cleanupPending(input: PersonalitySceneInput) {
      if (selected !== input.preferences.personality || selected !== "tidy" || !input.preferences.enabled || !input.preferences.roam
        || !input.world.animated || input.world.paused || input.busy) return false;
      const cleanup = recipes.find(recipe => recipe.id === "T01" && recipe.personality === "tidy");
      return Boolean(cleanup && unfinishedReturn(cleanup,input));
    },
    current: () => active ? { id: active.recipe.id, beat: active.beat, itemId: active.itemId, ...(active.routine ? { routine: true as const } : {}) } : undefined,
    bind(beat: PersonalitySceneBeat, itemId: string) { if (active?.serial === beat.serial && active.beat === beat.beat && !active.itemId) active.itemId = itemId; },
    completed: () => [...completed],
    /** Called only after a real native effect acknowledges success. */
    resolve(beat: PersonalitySceneBeat, success: boolean, itemId?: string, at?: number) {
      if (!active || beat.serial !== active.serial || beat.beat !== active.beat || beat.travel) return;
      const acknowledgedAt = at === undefined ? now : at;
      const timely = Number.isFinite(acknowledgedAt) && acknowledgedAt >= now;
      if (Number.isFinite(acknowledgedAt) && acknowledgedAt >= now) now = acknowledgedAt;
      if (!success) { if (beat.command.optional) advance(); else finish(false); return; }
      if (itemId) active.itemId = itemId;
      if (timely && ["toy", "food", "wash", "tv", "light", "curtain", "radio"].includes(beat.command.kind)) active.closureAt = acknowledgedAt;
      // These ACKs certify real physical effects. Inspect/compare are finite
      // observations; they must not masquerade as manipulative progress.
      if (beat.command.kind === "toy" && beat.command.mode !== "inspect") observeEffect("toy", acknowledgedAt);
      if (beat.command.kind === "food" && !["inspect", "compare"].includes(beat.command.mode)) observeEffect("food", acknowledgedAt);
      if (beat.command.kind === "wash") observeEffect("wash", acknowledgedAt);
      if (beat.command.kind === "toy" && beat.command.mode === "return" && ++active.count < Math.min(2, beat.command.limit ?? 1)) { active.itemId = undefined; active.progressed = now; return; }
      advance();
    },
    complete(beat: PersonalitySceneBeat) {
      if (beat.serial === entrySerial && beat.id === `entry-${selected}` && !beat.travel) { entryFinished = true; return; }
      if (!active || beat.serial !== active.serial || beat.beat !== active.beat || beat.travel) return;
      // Travel is re-proved at the next decision. Delegated ownership and
      // furniture effects need actual ACK, never merely an elapsed pose.
      if (["go", "toy", "food", "tv", "light", "curtain", "radio"].includes(beat.command.kind)) return;
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
        selected = p.personality; quietHomeUntil = -Infinity; first = true; entryFinished = false; entrySerial = undefined; finish(false); cursor = 0;
        actualProgressAt = undefined; actualPoint = undefined; progressActive = false; controls = undefined; carried = carriedFood = undefined; initialProgressDeadline = undefined;
      }
      if (!p.enabled || !p.roam || !world.animated || world.paused || input.busy || !world.platformId) return;
      const support = world.platforms.find(platform => platform.id === world.platformId);
      if (!support || Math.abs(support.y - world.y) > 2 || world.x < support.x || world.x > support.x + support.width || ["control", "hide"].includes(support.kind)) return;
      const here = { x: world.x, y: world.y, platformId: world.platformId };
      lastPosition = here;
      if (first) {
        first = false; initialProgressDeadline = now + 10000; actualPoint = { ...here };
        controls = { tv: input.tv, light: input.lightLit, curtain: input.curtainPhase, radio: input.radioPlaying }; carried = input.carriedToyId; carriedFood = input.carriedFoodId;
        const play = companionPersonalityPlayAllowed(entry[p.personality][0], p) ? entry[p.personality][0] : "bow";
        const command: SceneBeat = { kind: "pose", pose: play };
        const entryMeta = { id: `entry-${p.personality}`, serial: ++serial, beat: 0, command }; entrySerial = entryMeta.serial;
        return { meta: entryMeta, action: { kind: "play", play, target: here, duration: companionPlayDuration(play), personalityScene: entryMeta, personalitySignature: p.personality } };
      }
      observeProgress({ now, active: true, point: here, carriedToyId: input.carriedToyId, carriedFoodId: input.carriedFoodId,
        controls: { tv: input.tv, light: input.lightLit, curtain: input.curtainPhase, radio: input.radioPlaying } });
      if (active?.routine && (!p.feeding && active.recipe.id === "routine-meal" || !p.sleep && ["routine-sleep", "routine-nap"].includes(active.recipe.id))) finish(false);
      if (active?.recipe.triggers.includes("music") && !fittingMusic(active.recipe.id, input)) finish(false);
      if (active) {
        if (Math.hypot(world.x - active.lastX, world.y - active.lastY) > 4) { active.progressed = now; active.lastX = world.x; active.lastY = world.y; }
        if (now - active.progressed > 7500 || now - active.started > 60000) finish(false);
      }
      if (!active) {
        const pool = recipes.filter(recipe => recipe.personality === p.personality && available(recipe, input));
        const eligible = pool.filter(recipe => recipe.id !== lastCompleted && !completed.slice(-3).includes(recipe.id));
        const different = eligible.length ? eligible : pool.filter(recipe => recipe.id !== lastCompleted);
        // Anti-repeat protects expressions, not unfinished physical chores.
        // Only when no different scene is available may another real object
        // justify the same authored return; absent/blocked objects never do.
        const choices = different.length ? different : pool.filter(recipe => recipe.id === lastCompleted && unfinishedReturn(recipe, input));
        const major = choices.filter(recipe => recipe.major), event = choices.filter(recipe => recipe.triggers.some(key => !["free", "toy", "food", "tv", "night", "summer", "rain", "experience"].includes(key)));
        const group = event.length ? event : major.length && cursor % 4 !== 3 ? major : choices;
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
        if (recipe) active = { recipe, serial: ++serial, beat: 0, started: now, progressed: now, attempts: 0, lastX: world.x, lastY: world.y, count: 0,
          ...(atHome(world.platformId) && quietHomeRecipe(recipe) ? { quietHome: true as const, quietControls: { tv: input.tv, light: input.lightLit, curtain: input.curtainPhase, radio: input.radioPlaying } } : {}) };
        else return;
      }
      // At most four zero-duration transitions per existing decision.
      for (let transitions = 0; active && transitions < 4; transitions++) {
        const command = active.recipe.steps[active.beat];
        if (!command) { finish(true); return; }
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
        if (duration > 0 && !waking && !input.carriedToyId && actualProgressAt !== undefined
          && now + duration > Math.min(actualProgressAt + ACTUAL_PROGRESS_BUDGET_MS, initialProgressDeadline ?? Infinity)) {
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
          if (safe(point) && point.platformId === world.platformId && Math.hypot(point.x - world.x, point.y - world.y) < (command.target === "toy" || command.target === "food" ? 34 : 24)) { advance(); continue; }
          const offered = safe(point) ? go(point, command, input) : undefined;
          if (offered) return offered;
          if (command.optional) { advance(); continue; } finish(false); return;
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
                && findCompanionToyRoute(world,food,world.platforms,p.jump))
                .sort((a,b) => Math.hypot(a.x-main.x,a.y-main.y)-Math.hypot(b.x-main.x,b.y-main.y))[0];
            // A comparison is a nearby glance, never a cross-screen detour.
            // Losing its secondary object does not replace the chosen meal.
            if (!main || !partner || Math.hypot(partner.x-main.x,partner.y-main.y) > 160) { advance(); continue; }
            active.comparisonItemId = partner.id;
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
          if (Math.hypot(point.x - world.x, point.y - world.y) > 24 || point.platformId !== world.platformId) {
            const offered = go(point, command, input); if (offered) return offered;
            if (command.optional) { advance(); continue; } finish(false); return;
          }
          const offered = action(command, { kind: "play", play: command.kind === "light" && p.jump ? "pounce" : "bow", target: here, duration: command.kind === "light" && p.jump ? companionPlayDuration("pounce") : 900 }, input);
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
          const watchesTv = active.recipe.steps.some(step => step.kind === "tv") || active.recipe.triggers.includes("tv");
          if (watchesTv && input.tv !== "off" && input.home.sofa && world.platformId !== input.home.sofa.platformId) { const offered = go(input.home.sofa, command, input); if (offered) return offered; }
          if (watchesTv && input.home.tv) attention = input.home.tv;
          return action(command, { kind: "look", direction: (attention?.x ?? input.home.tv?.x ?? world.x) < world.x ? -1 : 1, target: here, duration: Math.min(3500, Math.max(650, command.ms)), ...(attention ? { attention: { kind: "social", point: attention } } : {}) }, input);
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

import { platformLandingX, type CompanionAction, type CompanionBrain, type CompanionFood, type CompanionWorld, type Platform } from "./brain";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionPreferences } from "./preferences";
import { MAX_COMPANION_FOOD } from "./food-capacity";
import type { CompanionItemPoint } from "./item-landing";
import { findCompanionHomeItemRoute, selectCompanionHomeFoodDestination } from "./home-pantry";

type Point = { x: number; y: number; platformId?: string };
export type CompanionHouseholdBeat = { serial: number; kind: "tidy" | "mischief"; effect?: "pick" | "put" | "discard" | "spawn" | "scatter"; foodId?: string; point?: Point };
export type CompanionHouseholdAction = CompanionAction & { household: CompanionHouseholdBeat };
export type CompanionHouseholdHome = { dispenser?: Point; bin?: Point; pantry?: Point };
type Input = { brain: CompanionBrain; world: CompanionWorld; preferences: CompanionPreferences; now: number; home: CompanionHouseholdHome; count: number; carried?: string; occupied?: readonly CompanionItemPoint[]; visibleFoods?: readonly CompanionFood[]; intent?: "tidy" | "feed"; foodId?: string };
type Job = { feedOnly?: boolean; serial: number; kind: "tidy" | "mischief"; stage: "seek" | "deliver" | "dispenser" | "waiting"; foodId?: string; foodKind?: CompanionFood["kind"]; destination?: Point; discard?: boolean; deadline: number; budget: number };

/** One bounded local errand, driven by the existing decision/paint clock. A
 * successful effect is acknowledged by the real food owner. This planner
 * never creates snacks, collection rewards, human logs or imaginary ledges. */
export function createCompanionHousehold(rng: () => number = Math.random) {
  let job: Job | undefined, serial = 0, retryAt = 0, lastNow = 0, cooldownMs = 35000;
  const handled = new Map<string, number>();
  const finish = (now: number) => { job = undefined; retryAt = now + cooldownMs; };
  const route = (input: Input, target: Point) => findCompanionHomeItemRoute(input.world, target, input.world.platforms, input.preferences.jump);
  const pointFor = (food: CompanionFood, platforms: readonly Platform[]): Point | undefined => {
    const support = platforms.find(p => p.id === food.platformId);
    return support && { x: platformLandingX(support, food.x), y: support.y, platformId: support.id };
  };
  // Reachability controls routes, never whether an existing snack occupies
  // space. Keep the same bounded eight foods/four toys; no new world scan.
  const visibleFoods = (input: Input) => (input.visibleFoods ?? input.world.foods ?? []).slice(0, MAX_COMPANION_FOOD);
  const destinationFor = (input: Input, from: Point, food: Pick<CompanionFood, "id" | "kind">) => selectCompanionHomeFoodDestination({
    ...input.home, platforms: input.world.platforms, visibleFoods: visibleFoods(input), occupied: input.occupied,
    allowJump: input.preferences.jump, brain: input.brain, preferences: input.preferences,
  }, from, food);
  const eligible = ({ brain, world, preferences, intent }: Input) => preferences.enabled && preferences.roam && preferences.feeding && world.animated
    && !world.paused && brain.energy > (intent ? .08 : .3) && (intent === "feed" ? brain.hunger >= .35 : brain.hunger < (intent ? .8 : .65)) && !brain.foodGoal && !brain.episode
    && (!brain.intention || brain.intention.kind === "explore" && (brain.intention.stage !== "travel" || brain.intention.remaining <= 0));
  const begin = (input: Input) => {
    if (input.now < retryAt || !eligible(input)) return;
    const profile = getCompanionBehaviorProfile(input.preferences, input.brain.habits);
    retryAt = input.now + profile.householdRetryMs;
    if (input.intent === "feed") {
      if (input.count < MAX_COMPANION_FOOD && input.home.dispenser) job = { feedOnly: true, serial: ++serial, kind: "mischief", stage: "dispenser", destination: input.home.dispenser, deadline: input.now + 20000, budget: 20 };
      return;
    }
    const foods = (input.world.foods ?? []).filter(food => (!input.foodId || food.id === input.foodId) && (handled.get(food.id) ?? -Infinity) < input.now);
    const ordered = foods.slice().sort((a, b) => Math.hypot(a.x - input.world.x, a.y - input.world.y) - Math.hypot(b.x - input.world.x, b.y - input.world.y));
    if (foods.length >= (input.preferences.personality === "tidy" || input.intent === "tidy" ? 1 : 2) && (input.intent === "tidy" || rng() < profile.tidyWeight * .8)) {
      const candidates = ordered.flatMap(food => {
        const source = pointFor(food, input.world.platforms);
        return source && route(input, source) ? [{ food, source }] : [];
      });
      for (const { food, source } of candidates) {
        const destination = destinationFor(input, source, food);
        if (!destination) continue;
        // A separated snack already stored inside the room needs no second
        // pantry move. Fullness-driven real-bin cleanup remains independent.
        if (!destination.discard && /^companion-home-floor(?:-\d+)?$/.test(source.platformId ?? "")
          && !visibleFoods(input).some(other => other.id !== food.id && Math.hypot(other.x - food.x, other.y - food.y) < 44)
          && !(input.occupied ?? []).slice(0, 4).some(other => Math.hypot(other.x - food.x, other.y - food.y) < 44)) continue;
        job = { serial: ++serial, kind: "tidy", stage: "seek", foodId: food.id, foodKind: food.kind, ...destination, deadline: input.now + 45000, budget: 32 };
        return;
      }
      // A selected tidy attempt with already good placements must not fall
      // through into an unrelated scatter that undoes that arrangement.
      return;
    }
    if (!input.preferences.ambientPrank || input.brain.energy < .58 || rng() >= profile.mischiefWeight * .65) return;
    const dispenser = input.home.dispenser;
    if (dispenser && input.count < Math.min(MAX_COMPANION_FOOD, 5) && route(input, dispenser)) {
      job = { serial: ++serial, kind: "mischief", stage: "dispenser", destination: dispenser, deadline: input.now + 40000, budget: 28 };
      return;
    }
    const food = ordered.find(item => { const point = pointFor(item, input.world.platforms); return point && route(input, point); });
    if (food) job = { serial: ++serial, kind: "mischief", stage: "seek", foodId: food.id, deadline: input.now + 30000, budget: 24 };
  };
  const next = (input: Input): CompanionHouseholdAction | undefined => {
    lastNow = input.now;
    cooldownMs = getCompanionBehaviorProfile(input.preferences, input.brain.habits).householdCooldownMs;
    if (job && (!eligible(job.feedOnly ? { ...input, intent: "feed" } : input) || input.now >= job.deadline || --job.budget < 0)) finish(input.now);
    if (!job) begin(input);
    if (!job) return;
    const active = job;
    const meta = (effect?: CompanionHouseholdBeat["effect"], point?: Point): CompanionHouseholdBeat => ({ serial: active.serial, kind: active.kind, ...(effect ? { effect } : {}), ...(active.foodId ? { foodId: active.foodId } : {}), ...(point ? { point } : {}) });
    const still = (effect?: CompanionHouseholdBeat["effect"], point?: Point, duration = 700): CompanionHouseholdAction => ({ kind: effect === "pick" ? "sniff" : "look", target: { x: input.world.x, y: input.world.y, platformId: input.world.platformId }, duration, household: meta(effect, point) });
    const food = input.world.foods?.find(item => item.id === active.foodId);
    if (active.stage === "waiting") {
      if (!food) return still(undefined, undefined, 350);
      active.stage = "seek";
    }
    if (active.stage === "deliver" && active.destination && active.foodId && active.foodKind) {
      // Fullness, preference, real room geometry and sibling occupancy can
      // change during the walk. Never complete an obsolete trash decision or
      // replace a missing home with an arbitrary outside collection point.
      const destination = destinationFor(input, input.world, { id: active.foodId, kind: active.foodKind });
      if (!destination) { finish(input.now); return; }
      active.destination = destination.destination; active.discard = destination.discard;
    }
    let target: Point | undefined;
    if (active.stage === "seek") target = food && pointFor(food, input.world.platforms);
    else target = active.destination;
    if (!target || active.stage === "deliver" && input.carried !== active.foodId) { finish(input.now); return; }
    const steps = route(input, target);
    if (!steps) { finish(input.now); return; }
    const step = steps[0];
    if (step) {
      const speed = active.kind === "mischief" ? Math.max(140, getCompanionBehaviorProfile(input.preferences).walkSpeed * 1.8) : getCompanionBehaviorProfile(input.preferences).walkSpeed;
      const runningContact = active.kind === "mischief" && active.stage === "seek" && steps.length === 1 && step.kind === "walk";
      return { ...step, duration: step.kind === "jump" ? 950 : Math.max(180, Math.abs(step.target.x - input.world.x) / speed * 1000), pace: active.kind === "mischief" ? "scoot" : "amble", household: runningContact ? meta("scatter", target) : meta() };
    }
    if (active.stage === "dispenser") return still("spawn", target, 850);
    if (active.stage === "deliver") return still(active.discard ? "discard" : "put", target, 850);
    return active.kind === "tidy" ? still("pick", target, 650) : still("scatter", target, 750);
  };
  return {
    next,
    wake(now: number) { if (!job) retryAt = Math.min(retryAt, now); },
    active: () => Boolean(job),
    currentCleanup: () => job?.kind === "tidy" && job.foodId ? { foodId: job.foodId, point: job.destination ? { ...job.destination } : undefined, discard: job.discard } : undefined,
    cancel: () => { if (job) finish(lastNow); },
    resolve(beat: CompanionHouseholdBeat, result: boolean | string, now: number) {
      if (!job || beat.serial !== job.serial || !beat.effect) return;
      if (!result) { finish(now); return; }
      if (beat.effect === "pick") { job.stage = "deliver"; return; }
      if (beat.effect === "spawn" && typeof result === "string") { if (job.feedOnly) { finish(now); return; } job.foodId = result; job.stage = "waiting"; return; }
      if (job.foodId) { handled.set(job.foodId, now + (job.kind === "mischief" ? 8000 : 180000)); if (handled.size > 24) handled.delete(handled.keys().next().value!); }
      finish(now);
    },
  };
}

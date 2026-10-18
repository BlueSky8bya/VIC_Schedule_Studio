import { findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionFood, type CompanionWorld, type Platform } from "./brain";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionPreferences } from "./preferences";
import { MAX_COMPANION_FOOD } from "./food-capacity";

type Point = { x: number; y: number; platformId?: string };
export type CompanionHouseholdBeat = { serial: number; kind: "tidy" | "mischief"; effect?: "pick" | "put" | "discard" | "spawn" | "scatter"; foodId?: string; point?: Point };
export type CompanionHouseholdAction = CompanionAction & { household: CompanionHouseholdBeat };
export type CompanionHouseholdHome = { dispenser?: Point; bin?: Point };
type Input = { brain: CompanionBrain; world: CompanionWorld; preferences: CompanionPreferences; now: number; home: CompanionHouseholdHome; count: number; carried?: string };
type Job = { serial: number; kind: "tidy" | "mischief"; stage: "seek" | "deliver" | "dispenser" | "waiting"; foodId?: string; destination?: Point; discard?: boolean; deadline: number; budget: number };

/** One bounded local errand, driven by the existing decision/paint clock. A
 * successful effect is acknowledged by the real food owner. This planner
 * never creates snacks, collection rewards, human logs or imaginary ledges. */
export function createCompanionHousehold(rng: () => number = Math.random) {
  let job: Job | undefined, serial = 0, retryAt = 0, lastNow = 0, cooldownMs = 35000;
  const handled = new Map<string, number>();
  const finish = (now: number) => { job = undefined; retryAt = now + cooldownMs; };
  const routeBetween = (origin: Point, target: Point, platforms: readonly Platform[], allowJump: boolean) => {
    const plane = platforms.find(p => p.id === origin.platformId && p.id === target.platformId);
    // Manual room floors exclude ordinary wandering, but their measured spans
    // already exclude complete controls at the92px tier. This one errand may
    // traverse that same continuous safe span; no gap/control becomes a path.
    if (plane?.manualOnly && plane.kind === "floor" && /^companion-home-floor(?:-\d+)?$/.test(plane.id)
      && [plane.x, plane.y, plane.width, plane.x + plane.width].every(Number.isFinite) && plane.width > 0
      && Math.abs(origin.y - plane.y) < 2 && Math.abs(target.y - plane.y) < 2
      && [origin.x, target.x].every(x => Number.isFinite(x) && x >= plane.x && x <= plane.x + plane.width)) {
      return Math.abs(origin.x - target.x) > 1 ? [{ kind: "walk" as const, target: { ...target, platformId: plane.id } }] : [];
    }
    return findPlatformRoute(origin, target, platforms, allowJump, target.platformId);
  };
  const route = (input: Input, target: Point) => routeBetween(input.world, target, input.world.platforms, input.preferences.jump);
  const pointFor = (food: CompanionFood, platforms: readonly Platform[]): Point | undefined => {
    const support = platforms.find(p => p.id === food.platformId);
    return support && { x: platformLandingX(support, food.x), y: support.y, platformId: support.id };
  };
  const eligible = ({ brain, world, preferences }: Input, continuing = false) => preferences.enabled && preferences.roam && preferences.feeding && world.animated
    && !world.paused && brain.energy > .3 && brain.hunger < (continuing ? .65 : .35) && !brain.foodGoal && !brain.episode
    && (!brain.intention || brain.intention.kind === "explore" && (brain.intention.stage !== "travel" || brain.intention.remaining <= 0));
  const begin = (input: Input) => {
    if (input.now < retryAt || !eligible(input)) return;
    const profile = getCompanionBehaviorProfile(input.preferences, input.brain.habits);
    retryAt = input.now + profile.householdRetryMs;
    const foods = (input.world.foods ?? []).filter(food => (handled.get(food.id) ?? -Infinity) < input.now);
    const ordered = foods.slice().sort((a, b) => Math.hypot(a.x - input.world.x, a.y - input.world.y) - Math.hypot(b.x - input.world.x, b.y - input.world.y));
    if (input.brain.hunger < .35 && foods.length >= (input.preferences.personality === "tidy" ? 1 : 2) && rng() < profile.tidyWeight * .8) {
      for (const food of ordered) {
        const source = pointFor(food, input.world.platforms);
        if (!source || !route(input, source)) continue;
        // Prefer the actual bin only when both legs are proved. Otherwise
        // collect on the snack's real, sufficiently wide support.
        const bin = input.home.bin;
        let destination = bin && routeBetween(source, bin, input.world.platforms, input.preferences.jump) ? bin : undefined;
        const discard = Boolean(destination);
        if (!destination) {
          const support = input.world.platforms.find(p => p.id === source.platformId);
          if (!support || support.width < 120) continue;
          const pileX = platformLandingX(support, support.x + support.width * .25, 26);
          const siblings = foods.filter(item => item.platformId === food.platformId && item.id !== food.id);
          if (!siblings.length || Math.abs(food.x - pileX) < 40) continue;
          destination = { x: pileX, y: support.y, platformId: support.id };
        }
        job = { serial: ++serial, kind: "tidy", stage: "seek", foodId: food.id, destination, discard, deadline: input.now + 45000, budget: 32 };
        return;
      }
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
    if (job && (!eligible(input, true) || input.now >= job.deadline || --job.budget < 0)) finish(input.now);
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
    active: () => Boolean(job),
    currentCleanup: () => job?.kind === "tidy" && job.foodId ? { foodId: job.foodId, point: job.destination ? { ...job.destination } : undefined, discard: job.discard } : undefined,
    cancel: () => { if (job) finish(lastNow); },
    resolve(beat: CompanionHouseholdBeat, result: boolean | string, now: number) {
      if (!job || beat.serial !== job.serial || !beat.effect) return;
      if (!result) { finish(now); return; }
      if (beat.effect === "pick") { job.stage = "deliver"; return; }
      if (beat.effect === "spawn" && typeof result === "string") { job.foodId = result; job.stage = "waiting"; return; }
      if (job.foodId) { handled.set(job.foodId, now + (job.kind === "mischief" ? 8000 : 180000)); if (handled.size > 24) handled.delete(handled.keys().next().value!); }
      finish(now);
    },
  };
}

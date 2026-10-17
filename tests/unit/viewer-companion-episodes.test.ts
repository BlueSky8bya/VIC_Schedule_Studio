import { describe, expect, it } from "vitest";
import {
  advanceBrain, commitAction, createBrain, getAction, getFoodAction, reachablePlatforms, recordCompanionEvent,
  type CompanionAction, type CompanionBrain, type CompanionFood, type CompanionWorld, type Platform,
} from "@/lib/ui/viewer-companion/brain";
import {
  cancelCompanionEpisode, companionEpisodeHopAvailable, companionEpisodeMishap, companionEpisodeRunHop, companionEpisodeRunTrip, companionRollProgress, planCompanionEpisode, type CompanionEpisode,
} from "@/lib/ui/viewer-companion/episodes";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

const prefs: CompanionPreferences = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, speed: "lively", sleep: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false };
const floor: Platform = { id: "floor", x: 0, y: 700, width: 1000, kind: "floor" };
const snack: CompanionFood = { id: "chosen-apple", x: 750, y: 700, platformId: floor.id, kind: "apple" };
const healthy = (): CompanionBrain => ({ ...createBrain(0, () => .5), energy: .9, hunger: .6 });
const world = (): CompanionWorld => ({ x: 100, y: floor.y, platformId: floor.id, platforms: [floor], foods: [{ ...snack }], width: 1000, height: 900, animated: true });
type Session = { brain: CompanionBrain; world: CompanionWorld; prefs: CompanionPreferences; now: number; draws: number; rng: () => number; actions: CompanionAction[] };
const variantDraws: [CompanionEpisode["variant"], number][] = [["careful", 0], ["dash", .2], ["bound", .45], ["rush-trip", .65], ["bound-slip", .95]];

function session(draw = 0, changes: Partial<CompanionPreferences> = {}): Session {
  const result: Session = { brain: healthy(), world: world(), prefs: { ...prefs, ...changes }, now: 100000, draws: 0, rng: () => 0, actions: [] };
  result.rng = () => { result.draws++; return draw; };
  return result;
}
function decide(s: Session) { return getAction(s.brain, s.world, s.prefs, s.now, s.rng); }
function complete(s: Session, action: CompanionAction, target = action.target, elapsed = action.duration) {
  const before = s.brain;
  s.brain = commitAction(before, action, s.now);
  const runHop = companionEpisodeRunHop(action, s.world, floor, s.world.foods ?? [], s.brain, s.prefs);
  if (action.episode) {
    if (before.episode) expect(action.episode.remaining).toBe(before.episode.remaining);
    expect(s.brain.episode?.remaining).toBe(Math.max(0, action.episode.remaining - 1));
  }
  if (action.foodId && action.intention?.kind === "feed") {
    if (before.foodGoal?.foodId === action.foodId) expect(action.intention.remaining).toBeLessThanOrEqual(before.foodGoal.remaining);
    expect(s.brain.foodGoal?.remaining).toBe(action.intention.remaining - 1);
  }
  s.actions.push(action);
  s.world = { ...s.world, x: target.x, y: target.y, platformId: target.platformId };
  s.brain = advanceBrain(s.brain, elapsed);
  if (action.kind === "jump") s.brain = recordCompanionEvent(s.brain, "landed");
  s.now += elapsed + 1;
  return runHop;
}
function greeted(draw: number, changes: Partial<CompanionPreferences> = {}) {
  const s = session(draw, changes);
  const notice = decide(s);
  expect(notice.episode?.phase).toBe("notice"); complete(s, notice);
  const greet = decide(s);
  expect(greet.episode?.phase).toBe("greet"); complete(s, greet);
  return s;
}
function runningContact() {
  const s = greeted(.65);
  for (let step = 0; step < 8; step++) {
    const action = decide(s);
    const trip = companionEpisodeRunTrip(action, s.world, floor, s.world.foods ?? [], s.brain, s.now, s.prefs);
    if (trip) return { s, action, trip };
    expect(action.kind).toBe("walk"); complete(s, action);
  }
  throw new Error("The selected real food was never crossed by the rush approach");
}
function landedBound() {
  const s = greeted(.95);
  const walk = decide(s); expect(walk.kind).toBe("walk");
  const jump = complete(s, walk)!; expect(jump.kind).toBe("jump"); complete(s, jump);
  return { s, jump };
}

function recoveredMishap(variant: "rush-trip" | "bound-slip" = "rush-trip") {
  if (variant === "bound-slip") {
    const { s, jump } = landedBound();
    const reaction = companionEpisodeMishap(jump, s.world, floor, s.brain, s.now, s.prefs, true)!;
    expect(reaction.play).toBe("slip-tumble"); complete(s, reaction); return s;
  }
  const { s, action, trip } = runningContact();
  complete(s, action, { x: trip.x, y: floor.y, platformId: floor.id });
  const reaction = companionEpisodeMishap(action, s.world, floor, s.brain, s.now, s.prefs)!;
  expect(reaction.play).toBe("tumble"); complete(s, reaction); return s;
}

describe("finite contextual companion encounters", () => {
  it("keeps plain route callers and inactive renderers free of episode decisions", () => {
    for (const animated of [undefined, false]) {
      const point = { ...world(), animated }, brain = healthy();
      const route = getFoodAction(brain, point, prefs, 100000);
      expect(route).toMatchObject({ kind: "walk", foodId: snack.id });
      expect(route?.episode).toBeUndefined();
      expect(getAction(brain, point, prefs, 100000, () => { throw new Error("A plain route must not draw a scene"); })).toEqual(route);
    }
    const s = session();
    expect(getFoodAction(s.brain, s.world, s.prefs, s.now)?.episode).toBeUndefined();
    expect(decide(s).episode?.phase).toBe("notice");
  });

  it.each(variantDraws)("%s carries one chosen meal through real movement and successful consumption", (variant, draw) => {
    const s = session(draw), phases: CompanionEpisode["phase"][] = [];
    let consumed = 0, mishaps = 0, finished = false;
    for (let decision = 0; decision < 24; decision++) {
      const action = decide(s), from = { ...s.world };
      expect(action.episode?.variant).toBe(variant);
      phases.push(action.episode!.phase);
      if (action.episode?.phase === "finish") {
        expect(consumed).toBe(1); expect(s.world.foods).toHaveLength(0);
        expect(action.foodId).toBeUndefined(); expect(action.intention).toBeUndefined();
        expect(action.target).toEqual({ x: s.world.x, y: s.world.y, platformId: s.world.platformId });
        complete(s, action); finished = true; break;
      }
      expect(action.foodId).toBe(snack.id);
      const trip = companionEpisodeRunTrip(action, from, floor, s.world.foods ?? [], s.brain, s.now, s.prefs);
      const target = trip ? { x: trip.x, y: floor.y, platformId: floor.id } : action.target;
      const elapsed = trip ? action.duration * Math.abs(target.x - from.x) / Math.abs(action.target.x - from.x) : action.duration;
      const runHop = complete(s, action, target, elapsed);
      let completed = action;
      if (!trip && runHop) {
        expect(companionEpisodeHopAvailable(runHop, floor, s.world.foods ?? [])).toBe(true);
        complete(s, runHop); completed = runHop;
      }
      const reaction = trip || completed.kind === "jump" && variant === "bound-slip"
        ? companionEpisodeMishap(completed, s.world, floor, s.brain, s.now, s.prefs, completed.kind === "jump") : undefined;
      if (reaction) {
        expect(reaction.foodId).toBe(snack.id); expect(reaction.episode?.mishapUsed).toBe(true);
        expect(reaction.episode?.remaining).toBe(s.brain.episode?.remaining);
        expect(reaction.intention?.remaining).toBe(s.brain.foodGoal?.remaining);
        complete(s, reaction); phases.push("mishap"); mishaps++;
        expect(companionEpisodeMishap(completed, s.world, floor, s.brain, s.now + 60000, s.prefs, completed.kind === "jump")).toBeUndefined();
      }
      if (action.kind === "eat") {
        expect(Math.abs(s.world.x - snack.x)).toBeLessThanOrEqual(36);
        expect(s.world.y).toBe(snack.y);
        const hunger = s.brain.hunger;
        s.brain = recordCompanionEvent(s.brain, "ate");
        expect(s.brain.hunger).toBeCloseTo(hunger - .36);
        expect(s.brain.episode?.phase).toBe("ate");
        s.world = { ...s.world, foods: [] }; consumed++;
      }
      expect(s.world.x).toBeGreaterThanOrEqual(floor.x);
      expect(s.world.x).toBeLessThanOrEqual(floor.x + floor.width);
    }
    expect(finished).toBe(true); expect(consumed).toBe(1); expect(s.draws).toBe(1);
    expect(phases.slice(0, 3)).toEqual(["notice", "greet", "approach"]);
    expect(phases.slice(-2)).toEqual(["meal", "finish"]);
    expect(mishaps).toBe(variant === "rush-trip" || variant === "bound-slip" ? 1 : 0);
    const firstMishap = s.actions.findIndex(action => action.episode?.phase === "mishap");
    if (firstMishap >= 0) expect(s.actions.slice(firstMishap + 1).some(action => ["walk", "jump"].includes(action.kind) && action.foodId === snack.id)).toBe(true);
    if (variant === "bound" || variant === "bound-slip") expect(s.actions.some(action => action.kind === "jump" && (action.runUp ?? 0) > 0)).toBe(true);
    expect(getAction(s.brain, s.world, s.prefs, s.now, () => .5).episode).toBeUndefined();
  });

  it("keeps the same target and variant when food moves or a closer snack appears", () => {
    const s = greeted(.45), retained = s.brain.episode;
    const moved = { ...snack, x: 900 }, closer = { ...snack, id: "new-near", x: s.world.x + 10 };
    s.world = { ...s.world, foods: [closer, moved] };
    const action = decide(s);
    expect(action.foodId).toBe(snack.id);
    expect(action.episode).toMatchObject({ variant: retained?.variant, remaining: retained?.remaining });
    expect(action.target.x).toBeGreaterThan(s.world.x + 100);
    complete(s, action);
    expect(s.brain.foodGoal?.foodId).toBe(snack.id); expect(s.draws).toBe(1);
  });

  it.each(["rush-trip", "bound-slip"] as const)("%s resumes its same meal after recovery, a missing route and an eating cooldown", variant => {
    const s = recoveredMishap(variant), episode = s.brain.episode!;
    const closer = { ...snack, id: "closer-snack", x: s.world.x + 5 };
    const raised = { ...floor, id: "temporarily-unreachable-plane", y: floor.y - 400 };
    const moved = { ...snack, x: s.world.x + 100, y: raised.y, platformId: raised.id };
    s.brain = { ...s.brain, hunger: .9 };
    s.world = { ...s.world, platforms: [floor, raised], foods: [closer, moved] };
    expect(getFoodAction(s.brain, s.world, s.prefs, s.now)).toBeUndefined();
    for (let retry = 0; retry < 3; retry++) {
      const remaining = s.brain.foodGoal!.remaining, episodeRemaining = s.brain.episode!.remaining;
      const wait = decide(s);
      expect(wait).toMatchObject({ kind: "look", duration: 300, foodId: snack.id, target: { x: s.world.x, y: s.world.y },
        intention: { kind: "feed", foodId: snack.id, targetId: moved.platformId, remaining },
        episode: { variant, phase: "mishap", mishapUsed: true, remaining: episodeRemaining } });
      complete(s, wait);
      expect(s.brain.foodGoal?.remaining).toBe(remaining - 1);
      expect(s.brain.episode?.remaining).toBe(episodeRemaining - 1);
    }
    s.world = { ...s.world, foods: [closer, { ...snack, x: s.world.x + 18 }] };
    const readyAt = s.now + 650; s.brain = { ...s.brain, cooldowns: { ...s.brain.cooldowns, eat: readyAt } };
    while (s.now < readyAt) {
      const wait = decide(s);
      expect(wait).toMatchObject({ kind: "look", duration: 300, foodId: snack.id, episode: { variant, phase: "mishap", mishapUsed: true } });
      complete(s, wait);
    }
    const meal = decide(s);
    expect(meal).toMatchObject({ kind: "eat", foodId: snack.id, episode: { variant, phase: "meal", mishapUsed: true, legs: episode.legs } });
    complete(s, meal);
    const beforeMeal = s.brain.hunger, affection = s.brain.affection;
    s.brain = recordCompanionEvent(s.brain, "ate"); s.world = { ...s.world, foods: [closer] };
    expect(s.brain.hunger).toBeCloseTo(beforeMeal - .36);
    expect(s.brain.affection).toBeCloseTo(Math.min(1, affection + .1));
    const finish = decide(s);
    expect(finish.episode?.phase).toBe("finish"); expect(finish.foodId).toBeUndefined(); complete(s, finish);
    expect(s.actions.filter(action => action.episode?.phase === "notice")).toHaveLength(1);
    expect(s.actions.filter(action => action.episode?.phase === "mishap" && action.kind === "play")).toHaveLength(1);
    expect(s.actions.filter(action => action.kind === "eat")).toHaveLength(1); expect(s.draws).toBe(1);
  });

  it.each([{ width: 0 }, { width: NaN }, { width: -20 }, { x: NaN }])("keeps a recovery wait finite when a target support is temporarily invalid: %j", invalid => {
    const s = recoveredMishap(), expected = s.brain.intention!.offset;
    const target = { ...floor, id: "unmeasured-target", y: floor.y - 400, ...invalid };
    s.world = { ...s.world, platforms: [floor, target], foods: [{ ...snack, x: s.world.x + 100, y: target.y, platformId: target.id }] };
    const action = decide(s);
    expect(action).toMatchObject({ kind: "look", foodId: snack.id, intention: { offset: expected }, episode: { phase: "mishap" } });
    expect(Number.isFinite(action.intention!.offset)).toBe(true);
  });

  it("bounds unavailable-route rechecks by the original episode and feed action budgets", () => {
    const s = recoveredMishap(), episodeBudget = s.brain.episode!.remaining, feedBudget = s.brain.foodGoal!.remaining;
    const raised = { ...floor, id: "temporarily-unreachable-plane", y: floor.y - 400 };
    s.world = { ...s.world, platforms: [floor, raised], foods: [{ ...snack, y: raised.y, platformId: raised.id }] };
    let retries = 0;
    for (; retries <= 24; retries++) {
      const action = decide(s);
      if (!action.episode) { expect(action.foodId).toBeUndefined(); complete(s, action); break; }
      expect(action).toMatchObject({ kind: "look", duration: 300, foodId: snack.id }); complete(s, action);
      expect(s.brain.foodGoal?.remaining).toBe(feedBudget - retries - 1);
    }
    expect(retries).toBe(episodeBudget); expect(retries).toBeLessThanOrEqual(24);
    expect(s.brain.episode).toBeUndefined();
  });

  it.each(["food", "intention"] as const)("does not renew an exhausted %s budget through a recovery wait", budget => {
    const s = recoveredMishap();
    if (budget === "food") s.brain = { ...s.brain, foodGoal: { ...s.brain.foodGoal!, remaining: 1 } };
    else s.brain = { ...s.brain, intention: { ...s.brain.intention!, remaining: 1 } };
    const raised = { ...floor, id: "temporarily-unreachable-plane", y: floor.y - 400 };
    s.world = { ...s.world, platforms: [floor, raised], foods: [{ ...snack, y: raised.y, platformId: raised.id }] };
    const lastWait = decide(s); expect(lastWait.intention?.remaining).toBe(1); complete(s, lastWait);
    expect(s.brain.foodGoal?.remaining).toBe(0);
    const expired = decide(s); expect(expired.episode).toBeUndefined(); expect(expired.foodId).toBeUndefined(); complete(s, expired);
    expect(s.brain.episode).toBeUndefined();
  });

  it("cancels a withdrawn recovered meal without substituting a closer snack or reviving its accident", () => {
    const s = recoveredMishap(), remembered = s.brain.foodGoal;
    const closer = { ...snack, id: "closer-snack", x: s.world.x + 5 };
    s.world = { ...s.world, foods: [closer] };
    const cancelled = decide(s);
    expect(cancelled).toMatchObject({ kind: "look", duration: 300 });
    expect(cancelled.foodId).toBeUndefined(); expect(cancelled.episode).toBeUndefined(); complete(s, cancelled);
    expect(s.brain.episode).toBeUndefined(); expect(s.brain.foodGoal).toEqual(remembered);
    s.world = { ...s.world, foods: [closer, { ...snack, x: s.world.x + 20 }] };
    const resumed = decide(s); expect(resumed).toMatchObject({ kind: "eat", foodId: snack.id }); expect(resumed.episode).toBeUndefined();
    const removed = recordCompanionEvent(s.brain, "food-lost");
    expect(removed.episode).toBeUndefined(); expect(removed.foodGoal).toBeUndefined(); expect(removed.hunger).toBe(s.brain.hunger);
  });

  it.each([{ enabled: false }, { feeding: false }, { roam: false }])("revokes a recovered encounter when authority changes to %j", changes => {
    const s = recoveredMishap(); s.prefs = { ...s.prefs, ...changes };
    const action = decide(s); expect(action.episode).toBeUndefined(); complete(s, action);
    expect(s.brain.episode).toBeUndefined();
  });

  it("does not preserve a recovered food encounter after the companion becomes full", () => {
    const s = recoveredMishap(); s.brain = { ...s.brain, hunger: .1 };
    const action = decide(s); expect(action.foodId).toBeUndefined(); expect(action.episode).toBeUndefined(); complete(s, action);
    expect(s.brain.episode).toBeUndefined();
  });

  it("varies eligible scenes by species, personality and gait without inventing cat dashes", () => {
    const counts = (changes: Partial<CompanionPreferences>) => {
      const values: Record<CompanionEpisode["variant"], number> = { careful: 0, dash: 0, bound: 0, "rush-trip": 0, "bound-slip": 0 };
      for (let i = 0; i < 400; i++) {
        const s = session((i + .5) / 400, changes), action = decide(s);
        expect(action.episode?.phase).toBe("notice"); values[action.episode!.variant]++;
        expect(s.draws).toBe(1);
      }
      return values;
    };
    const mascot = counts({}), cat = counts({ animalMode: "cat" }), dog = counts({ animalMode: "dog" });
    const sleepy = counts({ personality: "sleepy" }), relaxed = counts({ speed: "relaxed" });
    expect(Object.values(mascot).every(count => count > 0)).toBe(true);
    expect(cat.dash).toBe(0); expect(cat["rush-trip"]).toBe(0); expect(cat.careful).toBeGreaterThan(mascot.careful);
    expect(dog.dash).toBeGreaterThan(mascot.dash); expect(sleepy.careful).toBeGreaterThan(mascot.careful);
    expect(mascot["rush-trip"] + mascot["bound-slip"]).toBeGreaterThan(relaxed["rush-trip"] + relaxed["bound-slip"]);
  });

  it("yields to master, feeding, roaming and pause authorities before starting a scene", () => {
    for (const changes of [{ enabled: false }, { feeding: false }, { roam: false }]) {
      const s = session(.95, changes);
      expect(decide(s).episode).toBeUndefined();
    }
    const s = session(.95); s.world = { ...s.world, paused: true };
    expect(decide(s)).toMatchObject({ kind: "idle", target: { x: s.world.x, y: s.world.y } });
    expect(s.draws).toBe(0);
  });

  it("allows only grounded greetings and walks when jumping is disabled", () => {
    for (const draw of [0, .2, .45, .65, .95]) {
      const s = greeted(draw, { jump: false });
      expect(["careful", "dash", "rush-trip"]).toContain(s.brain.episode?.variant);
      expect(s.actions.every(action => action.play !== "celebrate" && action.play !== "pounce")).toBe(true);
      for (let leg = 0; leg < 6; leg++) {
        const action = decide(s); expect(action.kind).not.toBe("jump");
        complete(s, action); if (action.kind === "eat") break;
      }
    }
  });

  it("does not decorate urgent or nearby eating, exhausted budgets, low energy or cooldown waits", () => {
    const point = world(), brain = healthy();
    const cases: CompanionBrain[] = [
      { ...brain, hunger: .85 }, { ...brain, hunger: .99 }, { ...brain, energy: .27 },
      { ...brain, foodGoal: { foodId: snack.id, remaining: 5, retryAfter: 0 } },
      { ...brain, cooldowns: { episode: 100001 } },
    ];
    for (const state of cases) {
      const candidate = getFoodAction(state, point, prefs, 100000);
      expect(candidate).toBeDefined();
      expect(planCompanionEpisode(state, point, prefs, 100000, candidate, () => .95, reachablePlatforms)).toBeUndefined();
    }
    const near = { ...point, foods: [{ ...snack, x: point.x + 20 }] };
    expect(getAction(brain, near, prefs, 100000, () => .95)).toMatchObject({ kind: "eat", foodId: snack.id });
    expect(getAction(brain, near, prefs, 100000, () => .95).episode).toBeUndefined();
  });

  it("requires the actual supported ordinary plane and excludes home, controls, hiding and manual tops", () => {
    const state = healthy(), point = world(), candidate = getFoodAction(state, point, prefs, 100000);
    const supports: Platform[] = [{ ...floor, id: "companion-home" }, { ...floor, kind: "control" }, { ...floor, kind: "hide" }, { ...floor, manualOnly: true }];
    for (const support of supports) {
      const context = { ...point, platformId: support.id, platforms: [support] };
      expect(planCompanionEpisode(state, context, prefs, 100000, candidate, () => .95, reachablePlatforms)).toBeUndefined();
    }
    for (const patch of [{ y: floor.y - 10 }, { x: -10 }, { x: 1010 }, { x: NaN }, { platforms: [] }]) {
      expect(planCompanionEpisode(state, { ...point, ...patch }, prefs, 100000, candidate, () => .95, reachablePlatforms)).toBeUndefined();
    }
  });

  it("drops the scene on a missing held target without swapping snacks or awarding a meal", () => {
    const s = greeted(.65), hunger = s.brain.hunger, remembered = s.brain.foodGoal;
    s.world = { ...s.world, foods: [{ ...snack, id: "other-food", x: s.world.x + 20 }] };
    const action = decide(s);
    expect(action).toMatchObject({ kind: "look", duration: 300 });
    expect(action.episode).toBeUndefined(); expect(action.foodId).toBeUndefined();
    complete(s, action);
    expect(s.brain.episode).toBeUndefined(); expect(s.brain.foodGoal).toEqual(remembered);
    expect(s.brain.hunger).toBeGreaterThanOrEqual(hunger);
    const lost = recordCompanionEvent(s.brain, "food-lost");
    expect(lost.foodGoal).toBeUndefined(); expect(lost.episode).toBeUndefined();
  });

  it("requires a real consume event rather than treating a completed eating timer as success", () => {
    const s = greeted(0);
    for (let step = 0; step < 8; step++) {
      const action = decide(s); complete(s, action);
      if (action.kind === "eat") break;
    }
    expect(s.brain.episode?.phase).toBe("meal");
    const hunger = s.brain.hunger;
    s.world = { ...s.world, foods: [] };
    const failed = decide(s);
    expect(failed.episode?.phase).not.toBe("finish"); expect(failed.kind).toBe("look");
    complete(s, failed);
    expect(s.brain.episode).toBeUndefined(); expect(s.brain.hunger).toBeGreaterThanOrEqual(hunger);
  });

  it("adds one stationary afterglow to an actually consumed plain meal at home without retaining the removed food", () => {
    for (const [changes, kind, play] of [
      [{ animalMode: "default" }, "shake", undefined],
      [{ animalMode: "cat" }, "play", "groom"],
      [{ animalMode: "dog" }, "play", "bow"],
      [{ personality: "sleepy" }, "stretch", undefined],
    ] as const) {
      const s = session(0, changes), home = { ...floor, id: "companion-home" };
      s.world = { ...s.world, platformId: home.id, platforms: [home], foods: [{ ...snack, x: s.world.x + 10, platformId: home.id }] };
      const meal = decide(s);
      expect(meal).toMatchObject({ kind: "eat", foodId: snack.id }); expect(meal.episode).toBeUndefined();
      complete(s, meal);
      const unsuccessful = { ...s.brain };
      s.brain = recordCompanionEvent(s.brain, "ate");
      expect(s.brain.episode).toMatchObject({ kind: "meal", phase: "ate", variant: "careful", remaining: 1, mishapUsed: true });
      s.world = { ...s.world, foods: [] };
      const finish = decide(s);
      expect(finish).toMatchObject({ kind, episode: { phase: "finish" }, target: { x: s.world.x, y: s.world.y, platformId: home.id } });
      expect(finish.play).toBe(play); expect(finish.foodId).toBeUndefined(); expect(finish.intention).toBeUndefined();
      complete(s, finish); expect(s.brain.episode?.remaining).toBe(0);
      expect(getAction(unsuccessful, s.world, s.prefs, s.now, () => .5).episode?.phase).not.toBe("finish");
    }
  });

  it("terminates exhausted scenes and keeps direct handling and food loss authoritative", () => {
    const s = greeted(.65);
    s.brain = { ...s.brain, episode: { ...s.brain.episode!, remaining: 0 } };
    const next = decide(s); expect(next.episode).toBeUndefined(); complete(s, next);
    expect(s.brain.episode).toBeUndefined();
    for (const event of ["handled", "dragged", "food-lost"] as const) {
      const active = greeted(.65);
      const stopped = recordCompanionEvent(active.brain, event);
      expect(stopped.episode).toBeUndefined(); expect(stopped.intention).toBeUndefined();
      expect(stopped.hunger).toBe(active.brain.hunger);
    }
  });

  it("cancels a live approach, running hop or rolling contact while preserving the current physical action", () => {
    const bound = greeted(.45), walk = decide(bound), hop = complete(bound, walk)!;
    const flight = { brain: commitAction(bound.brain, hop, bound.now), action: hop, now: bound.now };
    const contact = runningContact();
    const approach = { brain: commitAction(contact.s.brain, contact.action, contact.s.now), action: contact.action, now: contact.s.now };
    expect(companionEpisodeRunTrip(approach.action, contact.s.world, floor, contact.s.world.foods!, approach.brain, approach.now, contact.s.prefs)).toEqual(contact.trip);
    const cancelledApproach = cancelCompanionEpisode(approach.brain, approach.action);
    expect(companionEpisodeRunTrip(cancelledApproach.action!, contact.s.world, floor, contact.s.world.foods!, cancelledApproach.brain, approach.now, contact.s.prefs)).toBeUndefined();
    complete(contact.s, contact.action, { x: contact.trip.x, y: floor.y, platformId: floor.id });
    const roll = companionEpisodeMishap(contact.action, contact.s.world, floor, contact.s.brain, contact.s.now, contact.s.prefs)!;
    const rolling = { brain: commitAction(contact.s.brain, roll, contact.s.now), action: roll, now: contact.s.now };
    expect(flight.action.runUp).toBeGreaterThan(0); expect(rolling.action.rolling).toBe(true);
    for (const current of [approach, flight, rolling]) {
      const before = JSON.stringify(current), preferenceBytes = JSON.stringify(prefs);
      const cancelled = cancelCompanionEpisode(current.brain, current.action);
      expect(cancelled.brain.episode).toBeUndefined();
      expect(cancelled.action?.episode).toBeUndefined(); expect(cancelled.action?.episodeCancelled).toBe(true);
      for (const field of ["kind", "duration", "target", "foodId", "runUp", "jumpHeight", "rolling", "direction", "intention"] as const) {
        expect(cancelled.action?.[field]).toEqual(current.action[field]);
      }
      for (const field of ["foodGoal", "intention", "energy", "hunger", "affection", "curiosity", "cooldowns", "activeMs"] as const) {
        expect(cancelled.brain[field]).toEqual(current.brain[field]);
      }
      expect(commitAction(cancelled.brain, cancelled.action!, current.now + 1).episode).toBeUndefined();
      expect(JSON.stringify(current)).toBe(before); expect(JSON.stringify(prefs)).toBe(preferenceBytes);
    }
  });

  it("quick resume finishes the current walk without its pending hop and pursues the same meal without another greeting", () => {
    const s = greeted(.45), from = { ...s.world }, current = decide(s);
    s.brain = commitAction(s.brain, current, s.now);
    expect(companionEpisodeRunHop(current, from, floor, s.world.foods!, s.brain, s.prefs)).toBeDefined();
    const cancelled = cancelCompanionEpisode(s.brain, current);
    expect(companionEpisodeRunHop(cancelled.action!, from, floor, s.world.foods!, cancelled.brain, s.prefs)).toBeUndefined();
    s.brain = advanceBrain(cancelled.brain, current.duration);
    s.world = { ...s.world, ...current.target }; s.now += current.duration + 1;
    expect(s.now).toBeLessThan(s.brain.cooldowns.episode!);
    let consumed = false;
    for (let leg = 0; leg < 8; leg++) {
      const action = decide(s);
      expect(action).toEqual(getFoodAction(s.brain, s.world, s.prefs, s.now));
      expect(action.episode).toBeUndefined(); expect(action.attention).toBeUndefined(); expect(action.foodId).toBe(snack.id);
      complete(s, action);
      if (action.kind === "eat") {
        s.brain = recordCompanionEvent(s.brain, "ate"); s.world = { ...s.world, foods: [] }; consumed = true; break;
      }
    }
    expect(consumed).toBe(true); expect(s.draws).toBe(1);
    const finish = decide(s);
    expect(finish.episode?.phase).toBe("finish"); expect(finish.foodId).toBeUndefined();
    complete(s, finish); expect(s.brain.episode?.remaining).toBe(0);
  });

  it("discards waiting wake, social and cancelled-meal afterglow contexts even with no action to finish", () => {
    for (const event of ["petted", "woke", "rested"] as const) {
      const s = session(); s.world = { ...s.world, foods: [] };
      const waiting = recordCompanionEvent({ ...s.brain, hunger: .1 }, event), before = JSON.stringify(waiting);
      expect(waiting.episode).toBeDefined();
      const cancelled = cancelCompanionEpisode(waiting, null);
      expect(cancelled.action).toBeNull(); expect(cancelled.brain.episode).toBeUndefined();
      expect(cancelled.brain.foodGoal).toEqual(waiting.foodGoal);
      expect(cancelled.brain.hunger).toBe(waiting.hunger); expect(cancelled.brain.energy).toBe(waiting.energy);
      expect(getAction(cancelled.brain, s.world, s.prefs, s.now, () => .5).episode).toBeUndefined();
      expect(JSON.stringify(waiting)).toBe(before);
    }
    const s = session(), nearby = { ...s.world, foods: [{ ...snack, x: s.world.x + 10 }] };
    const meal = getAction(s.brain, nearby, s.prefs, s.now, s.rng);
    expect(meal.kind).toBe("eat");
    const cancelled = cancelCompanionEpisode(commitAction(s.brain, meal, s.now), meal);
    const consumed = recordCompanionEvent(cancelled.brain, "ate");
    expect(consumed.episode?.phase).toBe("ate"); expect(cancelled.action?.episodeCancelled).toBe(true);
    const discarded = cancelCompanionEpisode(consumed, cancelled.action);
    expect(discarded.brain.episode).toBeUndefined(); expect(discarded.brain.hunger).toBe(consumed.hunger);
    expect(getAction(discarded.brain, { ...nearby, foods: [] }, s.prefs, s.now + meal.duration, () => .5).episode?.phase).not.toBe("finish");
  });

  it("uses finite species-specific social and wake contexts without inventing a food identity", () => {
    for (const animalMode of ["default", "cat", "dog"] as const) {
      for (const event of ["petted", "woke"] as const) {
        for (const support of [floor, { ...floor, id: "companion-home" }]) {
          const s = session(0, { animalMode }); s.world = { ...s.world, platformId: support.id, platforms: [support], foods: [] };
          s.brain = recordCompanionEvent({ ...s.brain, hunger: .1 }, event);
          const first = decide(s);
          expect(first.episode).toMatchObject({ kind: event === "woke" ? "wake" : "social", remaining: 2, phase: "greet" });
          expect(first.foodId).toBeUndefined();
          expect(first.target).toEqual({ x: s.world.x, y: s.world.y, platformId: support.id });
          if (event === "woke") expect(first.kind).toBe("stretch");
          else expect(first.play).toBe(animalMode === "cat" ? "groom" : animalMode === "dog" ? "bow" : "celebrate");
          complete(s, first);
          const last = decide(s); expect(last.episode).toMatchObject({ phase: "finish", remaining: 1 });
          expect(last.kind).toBe(event === "woke" ? "shake" : "look"); expect(last.foodId).toBeUndefined();
          complete(s, last); expect(s.brain.episode?.remaining).toBe(0);
        }
      }
    }
  });

  it("reproves a running trip against only the selected currently present food and live plane", () => {
    const { s, action, trip } = runningContact(), before = JSON.stringify(s.world.foods);
    expect(trip).toMatchObject({ cause: "food", foodId: snack.id, x: snack.x - 10, play: "tumble" });
    for (const foods of [[], [{ ...snack, id: "unselected" }], [{ ...snack, x: 950 }], [{ ...snack, y: 600 }], [{ ...snack, x: s.world.x - 40 }]]) {
      expect(companionEpisodeRunTrip(action, s.world, floor, foods, s.brain, s.now, s.prefs)).toBeUndefined();
    }
    expect(companionEpisodeRunTrip(action, { ...s.world, y: floor.y - 30 }, floor, s.world.foods!, s.brain, s.now, s.prefs)).toBeUndefined();
    for (const p of [undefined, { ...floor, manualOnly: true }, { ...floor, kind: "control" as const }, { ...floor, id: "companion-home" }]) {
      expect(companionEpisodeRunTrip(action, s.world, p, s.world.foods!, s.brain, s.now, s.prefs)).toBeUndefined();
    }
    expect(JSON.stringify(s.world.foods)).toBe(before);
  });

  it("starts a landing slip only after a real supported bound and never during interrupted flight", () => {
    const { s, jump } = landedBound();
    const reaction = companionEpisodeMishap(jump, s.world, floor, s.brain, s.now, s.prefs, true);
    expect(reaction).toMatchObject({ kind: "play", play: "slip-tumble", rolling: true, foodId: snack.id, episode: { phase: "mishap", mishapUsed: true } });
    expect(reaction?.target).toEqual({ x: s.world.x + 56, y: floor.y, platformId: floor.id });
    for (const point of [{ x: s.world.x, y: floor.y - 20 }, { x: -1, y: floor.y }, { x: Infinity, y: floor.y }]) {
      expect(companionEpisodeMishap(jump, point, floor, s.brain, s.now, s.prefs, true)).toBeUndefined();
    }
    expect(companionEpisodeMishap({ ...jump, kind: "walk" }, s.world, floor, s.brain, s.now, s.prefs, true)).toBeUndefined();
    expect(companionEpisodeMishap(jump, s.world, floor, { ...s.brain, cooldowns: { mishap: s.now + 1 } }, s.now, s.prefs, true)).toBeUndefined();
    expect(companionEpisodeMishap(jump, s.world, floor, { ...s.brain, episode: { ...s.brain.episode!, foodId: "another" } }, s.now, s.prefs, true)).toBeUndefined();
  });

  it("proves a running handoff at the actual walk speed and rechecks the still-offered snack before takeoff", () => {
    const s = greeted(.45), from = { ...s.world }, walk = decide(s), hop = complete(s, walk)!;
    expect(hop).toMatchObject({ kind: "jump", foodId: snack.id, episode: { variant: "bound", phase: "approach" } });
    expect(hop.runUp).toBeCloseTo(Math.abs(walk.target.x - from.x) / walk.duration * 1000);
    const flight = 2 * Math.sqrt(2 * 1100 * hop.jumpHeight!) / 1100;
    expect(hop.target.x - s.world.x).toBeCloseTo(hop.runUp! * flight);
    expect(hop.target.x).toBeLessThan(snack.x - 8);
    expect(companionEpisodeHopAvailable(hop, floor, s.world.foods!)).toBe(true);
    for (const foods of [[], [{ ...snack, id: "other" }], [{ ...snack, x: hop.target.x - 1 }], [{ ...snack, y: 600 }]]) {
      expect(companionEpisodeHopAvailable(hop, floor, foods)).toBe(false);
      expect(companionEpisodeRunHop(walk, from, floor, foods, s.brain, s.prefs)).toBeUndefined();
    }
    for (const changes of [{ jump: false }, { roam: false }, { enabled: false }]) {
      expect(companionEpisodeRunHop(walk, from, floor, s.world.foods!, s.brain, { ...s.prefs, ...changes })).toBeUndefined();
    }
    expect(companionEpisodeRunHop(walk, { ...from, y: floor.y - 10 }, floor, s.world.foods!, s.brain, s.prefs)).toBeUndefined();
    expect(companionEpisodeRunHop(walk, from, { ...floor, width: 300 }, s.world.foods!, s.brain, s.prefs)).toBeUndefined();
  });

  it("uses a stationary bump or slip when a support becomes narrow or jumping is disabled", () => {
    const { s, jump } = landedBound(), narrow = { ...floor, x: s.world.x - 20, width: 40 };
    for (const [p, options] of [[narrow, s.prefs], [floor, { ...s.prefs, jump: false }]] as const) {
      const slip = companionEpisodeMishap(jump, s.world, p, s.brain, s.now, options, true);
      expect(slip).toMatchObject({ play: "slip", target: { x: s.world.x, y: floor.y } }); expect(slip?.rolling).toBeUndefined();
      const bump = companionEpisodeMishap({ ...jump, kind: "walk" }, s.world, p, s.brain, s.now, options);
      expect(bump).toMatchObject({ play: "bump", target: { x: s.world.x, y: floor.y } }); expect(bump?.rolling).toBeUndefined();
    }
  });

  it("moves a rolling body monotonically only through its authored roll and settles at the exact target", () => {
    for (const kind of ["tumble", "slip-tumble"] as const) {
      const begin = kind === "slip-tumble" ? 180 : 0, end = begin + 620;
      for (const direction of [-1, 1]) {
        const start = 500, target = start + direction * 56;
        let prior = 0;
        for (let elapsed = -50; elapsed <= 2300; elapsed += 5) {
          const progress = companionRollProgress(kind, elapsed), x = start + (target - start) * progress;
          expect(Number.isFinite(progress)).toBe(true); expect(progress).toBeGreaterThanOrEqual(prior); expect(progress).toBeLessThanOrEqual(1);
          expect(x).toBeGreaterThanOrEqual(Math.min(start, target)); expect(x).toBeLessThanOrEqual(Math.max(start, target));
          if (elapsed <= begin) expect(x).toBe(start);
          if (elapsed >= end) expect(x).toBe(target);
          prior = progress;
        }
        expect(companionRollProgress(kind, end - .01)).toBeCloseTo(1, 7);
        expect(companionRollProgress(kind, end)).toBe(1);
      }
    }
  });

  it("keeps decisions, live food, preferences and prior committed memory immutable", () => {
    const s = greeted(.65), before = JSON.stringify({ brain: s.brain, world: s.world, prefs: s.prefs });
    const first = decide(s), replay = getAction(s.brain, s.world, s.prefs, s.now, () => .01);
    expect(replay).toEqual(first);
    const committed = commitAction(s.brain, first, s.now);
    expect(committed.episode).not.toBe(first.episode); expect(committed.foodGoal).not.toBe(s.brain.foodGoal);
    expect(JSON.stringify({ brain: s.brain, world: s.world, prefs: s.prefs })).toBe(before);
  });
});

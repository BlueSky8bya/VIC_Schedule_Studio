import type { CompanionPreferences } from "./preferences";
import { COMPANION_FULL_THRESHOLD, type CompanionCare } from "./care";

/** Local, renderer-independent companion. Coordinates are CSS viewport pixels:
 * x is the character's centre, y its feet; platform y is the walkable top.
 * The brain only proposes visual actions. It never casts a real heart or changes
 * stored ambient settings, and receives no schedule text or identity data. */
export type Platform = {
  id: string;
  x: number;
  y: number;
  width: number;
  kind: "card" | "date" | "floor" | "hide";
  heart?: { x: number; y: number; blocked?: boolean };
};

export type CompanionBehaviorPreferences = CompanionPreferences;

export type CompanionFood = { id: string; x: number; y: number; platformId?: string; kind: "apple" | "lemon" };
export type Food = CompanionFood;
export type CompanionActionKind = "idle" | "look" | "walk" | "jump" | "sleep" | "heart" | "hide" | "sniff" | "eat";
export type CompanionAction = {
  kind: CompanionActionKind;
  target: { x: number; y: number; platformId?: string };
  /** Milliseconds, including the whole finite pose/action. */
  duration: number;
  effectPoint?: { x: number; y: number };
  foodId?: string;
};
export type CompanionWorld = {
  x: number;
  y: number;
  platformId?: string;
  platforms: readonly Platform[];
  width: number;
  height: number;
  paused?: boolean;
  ambientAvailable?: boolean;
  foods?: readonly CompanionFood[];
  pointer?: { x: number; y: number };
};
export type CompanionBrain = CompanionCare & {
  createdAt: number;
  recent: CompanionActionKind[];
  visited: string[];
  cooldowns: Partial<Record<CompanionActionKind, number>>;
};

export const COMPANION_JUMP_LIMITS = Object.freeze({
  maxDistance: 260,
  maxRise: 140,
  maxDrop: 240,
  horizontalSpeed: 260,
  gravity: 1100,
  landingInset: 12,
});
type JumpLimits = { [K in keyof typeof COMPANION_JUMP_LIMITS]: number };
type Point = { x: number; y: number };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const unit = (n: number) => clamp(Number.isFinite(n) ? n : 0, 0, 1);
const random = (rng: () => number) => Math.min(.999999999, unit(rng()));
const valid = (p: Platform) => Boolean(p.id) && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.width) && p.width > 0;

/** Keep the centre on the support even when a small date rail is narrower than
 * the normal landing inset. Oversized sprites may overhang, never their feet. */
export function platformLandingX(platform: Platform, x: number, inset: number = COMPANION_JUMP_LIMITS.landingInset) {
  const margin = Math.min(Math.max(0, inset), platform.width / 2);
  return clamp(x, platform.x + margin, platform.x + platform.width - margin);
}

export function nearestPlatform(point: Point, platforms: readonly Platform[]): Platform | undefined {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return undefined;
  let closest: Platform | undefined;
  let best = Infinity;
  for (const platform of platforms) {
    if (!valid(platform)) continue;
    const distance = Math.hypot(platformLandingX(platform, point.x) - point.x, platform.y - point.y);
    if (distance < best) { best = distance; closest = platform; }
  }
  return closest;
}

/** Fixed-impulse ballistic feasibility, rather than a rectangular range test.
 * At the maximum rise, only the apex's shorter horizontal range is available.
 * Platforms are one-way support surfaces, not solid ceiling rectangles. */
export function reachablePlatforms(point: Point, platforms: readonly Platform[], overrides: Partial<JumpLimits> = {}): Platform[] {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return [];
  const limits = { ...COMPANION_JUMP_LIMITS, ...overrides };
  if (![limits.maxDistance, limits.maxRise, limits.maxDrop, limits.horizontalSpeed, limits.gravity, limits.landingInset].every(Number.isFinite)
    || limits.gravity <= 0 || limits.horizontalSpeed <= 0 || limits.maxRise < 0 || limits.maxDrop < 0 || limits.maxDistance < 0) return [];
  const impulse = Math.sqrt(2 * limits.gravity * limits.maxRise);
  return platforms.filter(platform => {
    if (!valid(platform)) return false;
    const dy = platform.y - point.y;
    if (dy < -limits.maxRise || dy > limits.maxDrop) return false;
    const dx = Math.abs(platformLandingX(platform, point.x, limits.landingInset) - point.x);
    if (dx > limits.maxDistance) return false;
    const discriminant = impulse * impulse + 2 * limits.gravity * dy;
    if (discriminant < -1e-7) return false;
    const landingTime = (impulse + Math.sqrt(Math.max(0, discriminant))) / limits.gravity;
    return dx <= limits.horizontalSpeed * landingTime + 1e-7;
  });
}

export type CompanionRouteStep = { kind: "walk" | "jump"; target: { x: number; y: number; platformId: string } };
type SupportedPoint = Point & { platformId?: string };

/** Directed BFS over real ledges. Walking to a takeoff point is explicit, so
 * a long floor can bridge a gap without pretending a 500px jump is possible.
 * Each returned jump is checked with the same ballistic test as wandering. */
export function findPlatformRoute(origin: SupportedPoint, target: SupportedPoint, platforms: readonly Platform[], allowJump = true): CompanionRouteStep[] | null {
  const available = platforms.filter(p => valid(p) && p.kind !== "hide").slice(0, 200);
  const start = available.find(p => p.id === origin.platformId) ?? nearestPlatform(origin, available);
  const goal = available.find(p => p.id === target.platformId) ?? nearestPlatform(target, available);
  if (!start || !goal || ![origin.x, origin.y, target.x, target.y].every(Number.isFinite)
    || Math.abs(start.y - origin.y) > 18 || Math.abs(goal.y - target.y) > 18) return null;
  const finalX = platformLandingX(goal, target.x);
  const finish = (x: number, steps: CompanionRouteStep[]) => Math.abs(finalX - x) > 1
    ? [...steps, { kind: "walk" as const, target: { x: finalX, y: goal.y, platformId: goal.id } }] : steps;
  if (start.id === goal.id) return finish(origin.x, []);
  if (!allowJump) return null;
  const queue = [{ platform: start, x: origin.x, steps: [] as CompanionRouteStep[] }];
  const visited = new Set([start.id]);
  for (let index = 0; index < queue.length && index < 200; index++) {
    const node = queue[index];
    // Favor promising neighbours; route progress is measured by remaining BFS
    // edges, not by a random new destination after every intermediate landing.
    const choices = available.filter(p => !visited.has(p.id)).sort((a, b) =>
      Math.hypot(platformLandingX(a, target.x) - target.x, a.y - target.y)
      - Math.hypot(platformLandingX(b, target.x) - target.x, b.y - target.y));
    for (const platform of choices) {
      const takeoffX = platformLandingX(node.platform, platformLandingX(platform, target.x));
      if (!reachablePlatforms({ x: takeoffX, y: node.platform.y }, [platform]).length) continue;
      const landingX = platformLandingX(platform, takeoffX);
      const steps = [...node.steps];
      if (Math.abs(takeoffX - node.x) > 1) steps.push({ kind: "walk", target: { x: takeoffX, y: node.platform.y, platformId: node.platform.id } });
      steps.push({ kind: "jump", target: { x: landingX, y: platform.y, platformId: platform.id } });
      if (platform.id === goal.id) return finish(landingX, steps);
      visited.add(platform.id);
      queue.push({ platform, x: landingX, steps });
    }
  }
  return null;
}

export function createBrain(now = 0, rng: () => number = Math.random): CompanionBrain {
  return {
    createdAt: Number.isFinite(now) ? now : 0,
    energy: .72 + random(rng) * .16,
    affection: .3,
    curiosity: .6 + random(rng) * .2,
    hunger: .58,
    recent: [], visited: [], cooldowns: {},
  };
}

/** Call only for visible, active elapsed time. A long tab sleep cannot make the
 * character exhausted or force a catch-up action on return. */
export function advanceBrain(brain: CompanionBrain, elapsedMs: number): CompanionBrain {
  const seconds = clamp(Number.isFinite(elapsedMs) ? elapsedMs / 1000 : 0, 0, 30);
  return {
    ...brain,
    energy: unit(brain.energy - seconds / 1400),
    affection: unit(brain.affection - seconds / 2400),
    curiosity: unit(brain.curiosity + seconds / 650),
    hunger: unit(brain.hunger + seconds / 900),
  };
}

export type CompanionEvent = "petted" | "dragged" | "landed" | "rested" | "woke" | "ate";
export function recordCompanionEvent(brain: CompanionBrain, event: CompanionEvent): CompanionBrain {
  if (event === "ate") return brain.hunger < COMPANION_FULL_THRESHOLD ? { ...brain } : { ...brain, hunger: unit(brain.hunger - .36), affection: unit(brain.affection + .1), energy: unit(brain.energy + .07), curiosity: unit(brain.curiosity - .04) };
  if (event === "petted") return { ...brain, affection: unit(brain.affection + .08), energy: unit(brain.energy + .015), curiosity: unit(brain.curiosity - .025) };
  if (event === "dragged") return { ...brain, curiosity: unit(brain.curiosity + .08) };
  if (event === "rested") return { ...brain, energy: unit(brain.energy + .24), curiosity: unit(brain.curiosity + .08) };
  if (event === "woke") return { ...brain, curiosity: unit(brain.curiosity + .05) };
  return { ...brain, energy: unit(brain.energy - .008) };
}

const cooldownMs: Record<CompanionActionKind, number> = {
  idle: 0, look: 2500, walk: 1600, jump: 4000, sleep: 25000, heart: 45000, hide: 90000, sniff: 8000, eat: 1500,
};

/** Commit once when an action begins, not every animation frame. */
export function commitAction(brain: CompanionBrain, action: CompanionAction, now: number): CompanionBrain {
  return {
    ...brain,
    energy: unit(brain.energy - (action.kind === "jump" ? .035 : action.kind === "walk" ? .012 : 0)),
    curiosity: unit(brain.curiosity - (["jump", "walk", "heart", "hide"].includes(action.kind) ? .09 : .015)),
    recent: [...brain.recent, action.kind].slice(-8),
    visited: action.target.platformId ? [...brain.visited.filter(id => id !== action.target.platformId), action.target.platformId].slice(-8) : [...brain.visited],
    cooldowns: { ...brain.cooldowns, [action.kind]: now + action.duration + (action.foodId && ["walk", "jump"].includes(action.kind) ? 300 : cooldownMs[action.kind]) },
  };
}

/** A hungry pet pursues one reachable food via concrete route steps. Eating
 * waits until the mouth is nearby; neither food nor disabled movement teleports
 * the creature. Full pets simply retain their ordinary idle/play choices. */
export function getFoodAction(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionBehaviorPreferences, now: number): CompanionAction | undefined {
  if (!prefs.enabled || world.paused || ![world.x, world.y, now].every(Number.isFinite)
    || !prefs.feeding || brain.hunger < COMPANION_FULL_THRESHOLD || !world.foods?.length) return undefined;
  const supported = { x: world.x, y: world.y, platformId: world.platformId };
  const foods = world.foods.filter(food => Boolean(food.id) && [food.x, food.y].every(Number.isFinite) && (food.kind === "apple" || food.kind === "lemon"))
    .sort((a, b) => Math.hypot(a.x - world.x, a.y - world.y) - Math.hypot(b.x - world.x, b.y - world.y));
  for (const food of foods) {
    const route = findPlatformRoute(supported, food, world.platforms, prefs.jump);
    if (!route) continue;
    const sameSupport = !route.some(step => step.kind === "jump");
    if (sameSupport && Math.abs(world.y - food.y) <= 18 && Math.abs(world.x - food.x) <= 36) {
      if ((brain.cooldowns.eat ?? -Infinity) > now) continue;
      return { kind: "eat", target: supported, duration: 2600, foodId: food.id, effectPoint: { x: food.x, y: food.y } };
    }
    if (!prefs.roam || !route.length) continue;
    const step = route[0];
    const speed = prefs.speed === "relaxed" ? 45 : prefs.speed === "lively" ? 100 : 70;
    return { kind: step.kind, target: step.target, duration: step.kind === "walk" ? Math.max(500, Math.abs(step.target.x - world.x) / speed * 1000) : 950, foodId: food.id };
  }
  return undefined;
}

/** Weighted utility with authored affordances: curiosity explores new ledges,
 * fatigue encourages rest, affection encourages a small local heart joke.
 * Inject a seeded RNG in fixtures/replays; all decisions stay on the device. */
export function getAction(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionBehaviorPreferences, now: number, rng: () => number = Math.random): CompanionAction {
  const stationary = { x: world.x, y: world.y, platformId: world.platformId };
  const idle: CompanionAction = { kind: "idle", target: stationary, duration: 1800 };
  if (!prefs.enabled || world.paused || !Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(now)) return idle;
  const foodAction = getFoodAction(brain, world, prefs, now);
  if (foodAction) return foodAction;
  const current = world.platforms.find(p => p.id === world.platformId && valid(p)) ?? nearestPlatform(world, world.platforms);
  const candidates: { action: CompanionAction; utility: number }[] = [];
  const add = (kind: CompanionActionKind, utility: number, duration: number, target = stationary, effectPoint?: Point) => {
    if ((brain.cooldowns[kind] ?? -Infinity) > now) return;
    const repeats = brain.recent.slice(-4).filter(item => item === kind).length;
    const lastPenalty = brain.recent.at(-1) === kind ? .35 : 1;
    candidates.push({ action: { kind, target, duration, ...(effectPoint ? { effectPoint } : {}) }, utility: Math.max(0, utility) * lastPenalty / (1 + repeats * .65) });
  };
  const curious = prefs.personality === "curious" ? .35 : 0;
  const affectionate = prefs.personality === "affectionate" ? .3 : 0;
  const sleepy = prefs.personality === "sleepy" ? .45 : 0;
  const cat = prefs.animalMode === "cat", dog = prefs.animalMode === "dog";
  add("idle", .3 + (1 - brain.energy) * .3, 1700 + random(rng) * 2300);
  add("look", .25 + brain.curiosity * .35 + curious + (cat ? .3 : 0), (cat ? 800 : 1200) + random(rng) * (cat ? 700 : 1300));
  if (cat || dog) add("sniff", .4 + brain.curiosity * .3 + (dog ? .2 : 0), cat ? 950 : 1400);
  if (prefs.sleep && brain.energy < .74) add("sleep", (1 - brain.energy) ** 2 * 2 + sleepy, 9000 + random(rng) * 10000);
  if (prefs.roam && current && Math.abs(current.y - world.y) <= 18) {
    const speed = prefs.speed === "relaxed" ? 45 : prefs.speed === "lively" ? 100 : 70;
    const pointer = world.pointer && [world.pointer.x, world.pointer.y].every(Number.isFinite) ? world.pointer : undefined;
    const follows = pointer && (cat || dog) && Math.abs(pointer.y - world.y) < 160;
    const desiredX = follows ? pointer.x + (world.x < pointer.x ? -1 : 1) * (cat ? 75 : 28) : current.x + current.width * (.1 + random(rng) * .8);
    const walkX = platformLandingX(current, desiredX);
    if (Math.abs(walkX - world.x) > 25) add("walk", .6 + brain.curiosity * .5 + (follows && dog ? .8 : follows && cat ? .25 : 0), Math.max(500, Math.abs(walkX - world.x) / speed * (cat ? 1350 : 1000)), { x: walkX, y: current.y, platformId: current.id });
    if (prefs.jump) {
      const reachable = reachablePlatforms(world, world.platforms).filter(p => p.id !== current.id && p.kind !== "hide");
      if (reachable.length) {
        const unvisited = reachable.filter(p => !brain.visited.includes(p.id));
        let choices = unvisited.length ? unvisited : reachable;
        if (cat) {
          const high = choices.filter(p => p.y < world.y - 30);
          if (high.length && random(rng) < .8) choices = high;
        }
        const platform = choices[Math.floor(random(rng) * choices.length)];
        // Reachability was proved for this nearest landing. A wide floor's
        // centre may be hundreds of pixels farther away and outside that arc.
        const x = platformLandingX(platform, world.x);
        add("jump", .5 + brain.curiosity * .65 + curious, 950, { x, y: platform.y, platformId: platform.id });
      }
    }
    // A prank is a local gesture on the support already occupied; navigation
    // remains a separate walk/jump, so disabled jumping cannot teleport a pet.
    if (prefs.heartPrank && current.heart && now - brain.createdAt >= 18000) {
      add("heart", .12 + brain.affection * .2 + affectionate, 2200, { x: platformLandingX(current, current.heart.x), y: current.y, platformId: current.id }, current.heart);
    }
    const hideSupport = current.kind === "hide" || current.kind === "floor";
    if (prefs.ambientPrank && world.ambientAvailable && hideSupport && now - brain.createdAt >= 45000 && random(rng) < .08) {
      const x = platformLandingX(current, world.x < world.width / 2 ? 12 : world.width - 12);
      add("hide", .2 + brain.curiosity * .2, 7000 + random(rng) * 6000, { x, y: current.y, platformId: current.id });
    }
  }
  const total = candidates.reduce((sum, candidate) => sum + candidate.utility, 0);
  let draw = random(rng) * total;
  for (const candidate of candidates) {
    draw -= candidate.utility;
    if (draw < 0) return candidate.action;
  }
  return candidates.at(-1)?.action ?? idle;
}

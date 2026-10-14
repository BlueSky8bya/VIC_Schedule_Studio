import type { CompanionPreferences } from "./preferences";

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
  heart?: { x: number; y: number };
};

export type CompanionBehaviorPreferences = CompanionPreferences;

export type CompanionActionKind = "idle" | "look" | "walk" | "jump" | "sleep" | "heart" | "hide";
export type CompanionAction = {
  kind: CompanionActionKind;
  target: { x: number; y: number; platformId?: string };
  /** Milliseconds, including the whole finite pose/action. */
  duration: number;
  effectPoint?: { x: number; y: number };
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
};
export type CompanionBrain = {
  createdAt: number;
  energy: number;
  affection: number;
  curiosity: number;
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

export function createBrain(now = 0, rng: () => number = Math.random): CompanionBrain {
  return {
    createdAt: Number.isFinite(now) ? now : 0,
    energy: .72 + random(rng) * .16,
    affection: .3,
    curiosity: .6 + random(rng) * .2,
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
  };
}

export type CompanionEvent = "petted" | "dragged" | "landed" | "rested" | "woke";
export function recordCompanionEvent(brain: CompanionBrain, event: CompanionEvent): CompanionBrain {
  if (event === "petted") return { ...brain, affection: unit(brain.affection + .08), energy: unit(brain.energy + .015), curiosity: unit(brain.curiosity - .025) };
  if (event === "dragged") return { ...brain, curiosity: unit(brain.curiosity + .08) };
  if (event === "rested") return { ...brain, energy: unit(brain.energy + .24), curiosity: unit(brain.curiosity + .08) };
  if (event === "woke") return { ...brain, curiosity: unit(brain.curiosity + .05) };
  return { ...brain, energy: unit(brain.energy - .008) };
}

const cooldownMs: Record<CompanionActionKind, number> = {
  idle: 0, look: 2500, walk: 1600, jump: 4000, sleep: 25000, heart: 45000, hide: 90000,
};

/** Commit once when an action begins, not every animation frame. */
export function commitAction(brain: CompanionBrain, action: CompanionAction, now: number): CompanionBrain {
  return {
    ...brain,
    energy: unit(brain.energy - (action.kind === "jump" ? .035 : action.kind === "walk" ? .012 : 0)),
    curiosity: unit(brain.curiosity - (["jump", "walk", "heart", "hide"].includes(action.kind) ? .09 : .015)),
    recent: [...brain.recent, action.kind].slice(-8),
    visited: action.target.platformId ? [...brain.visited.filter(id => id !== action.target.platformId), action.target.platformId].slice(-8) : [...brain.visited],
    cooldowns: { ...brain.cooldowns, [action.kind]: now + action.duration + cooldownMs[action.kind] },
  };
}

/** Weighted utility with authored affordances: curiosity explores new ledges,
 * fatigue encourages rest, affection encourages a small local heart joke.
 * Inject a seeded RNG in fixtures/replays; all decisions stay on the device. */
export function getAction(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionBehaviorPreferences, now: number, rng: () => number = Math.random): CompanionAction {
  const stationary = { x: world.x, y: world.y, platformId: world.platformId };
  const idle: CompanionAction = { kind: "idle", target: stationary, duration: 1800 };
  if (!prefs.enabled || world.paused || !Number.isFinite(world.x) || !Number.isFinite(world.y) || !Number.isFinite(now)) return idle;
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
  add("idle", .3 + (1 - brain.energy) * .3, 1700 + random(rng) * 2300);
  add("look", .25 + brain.curiosity * .35 + curious, 1200 + random(rng) * 1300);
  if (prefs.sleep && brain.energy < .74) add("sleep", (1 - brain.energy) ** 2 * 2 + sleepy, 9000 + random(rng) * 10000);
  if (prefs.roam && current && Math.abs(current.y - world.y) <= 18) {
    const speed = prefs.speed === "relaxed" ? 45 : prefs.speed === "lively" ? 100 : 70;
    const walkX = platformLandingX(current, current.x + current.width * (.1 + random(rng) * .8));
    if (Math.abs(walkX - world.x) > 25) add("walk", .6 + brain.curiosity * .5, Math.max(500, Math.abs(walkX - world.x) / speed * 1000), { x: walkX, y: current.y, platformId: current.id });
    if (prefs.jump) {
      const reachable = reachablePlatforms(world, world.platforms).filter(p => p.id !== current.id && p.kind !== "hide");
      if (reachable.length) {
        const unvisited = reachable.filter(p => !brain.visited.includes(p.id));
        const choices = unvisited.length ? unvisited : reachable;
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

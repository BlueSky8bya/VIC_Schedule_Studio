import { COMPANION_JUMP_LIMITS, COMPANION_ROUTE_LIMITS, platformLandingX, reachablePlatforms, type CompanionAction, type CompanionBrain, type CompanionRouteStep, type CompanionWorld, type Platform } from "./brain";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import type { CompanionPreferences } from "./preferences";

type Point = { x: number; y: number; platformId?: string };
type HomeRouteStep = CompanionRouteStep & { jumpHeight?: number };
const homeFloor = (p: Platform) => /^companion-home-floor(?:-\d+)?$/.test(p.id);
const geometryValid = (p: Platform) => [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0 && p.kind !== "hide";
const valid = (p: Platform) => geometryValid(p) && (!p.manualOnly || homeFloor(p));

/** A bounded, distance-weighted graph of real ledges. Endpoints and the
 * current/goal projections let a wide floor be crossed by walking. A* compares
 * the whole journey, including takeoff walks; a distant one-hop detour does
 * not beat two nearby hops merely because it visits fewer platforms.
 * These are planning points on measured supports, never new platforms. */
export function shortestCompanionHomeRoute(origin: Point, target: Point, platforms: readonly Platform[], allowJump: boolean, allowSpring = false): HomeRouteStep[] | null {
  const start = platforms.find(p => p.id === origin.platformId && geometryValid(p));
  const goal = platforms.find(p => p.id === target.platformId && valid(p));
  if (!start || !goal || ![origin.x, origin.y, target.x, target.y].every(Number.isFinite)
    || Math.abs(start.y - origin.y) > 18 || Math.abs(goal.y - target.y) > 18) return null;
  const available = [...new Map([start, goal, ...platforms.filter(valid)].map(p => [p.id, p])).values()].slice(0, COMPANION_ROUTE_LIMITS.maxNodes);
  const springTargets = new Set(available.filter(homeFloor).map(p => p.id));
  if (!springTargets.size) springTargets.add(goal.id);
  const nodes = available.flatMap(platform => [...new Set(platform.manualOnly && !homeFloor(platform) ? [origin.x] : [
    platformLandingX(platform, origin.x), platformLandingX(platform, target.x),
    platformLandingX(platform, platform.x), platformLandingX(platform, platform.x + platform.width),
  ])].map(x => ({ x, y: platform.y, platformId: platform.id })));
  // Keep the actual occupied point rather than silently walking to a projection.
  nodes.unshift({ x: origin.x, y: origin.y, platformId: start.id });
  const finalX = platformLandingX(goal, target.x), count = nodes.length;
  const distance = Array<number>(count).fill(Infinity), parent = Array<number>(count).fill(-1), hops = Array<number>(count).fill(0);
  const spring = Array<number>(count).fill(0);
  const closed = new Uint8Array(count); distance[0] = 0;
  for (let visited = 0; visited < count; visited++) {
    let current = -1, best = Infinity;
    for (let i = 0; i < count; i++) {
      const score = distance[i] + Math.hypot(nodes[i].x - finalX, nodes[i].y - goal.y);
      if (!closed[i] && score < best) { best = score; current = i; }
    }
    if (current < 0) break;
    const from = nodes[current]; closed[current] = 1;
    if (from.platformId === goal.id && Math.abs(from.x - finalX) < 1) {
      const route: HomeRouteStep[] = [];
      for (let at = current; parent[at] >= 0; at = parent[at]) {
        const previous = nodes[parent[at]], point = nodes[at];
        route.push({ kind: previous.platformId === point.platformId ? "walk" : "jump", target: point, ...(spring[at] ? { jumpHeight: spring[at] } : {}) });
      }
      return route.reverse();
    }
    for (let next = 0; next < count; next++) {
      if (closed[next]) continue;
      const to = nodes[next], walk = from.platformId === to.platformId;
      const dx = to.x - from.x, dy = to.y - from.y;
      let height = 0;
      if (walk && Math.abs(dx) < 1) continue;
      if (!walk) {
        if (to.platformId === start.id && start.manualOnly && !homeFloor(start)) continue;
        if (!allowJump || hops[current] >= COMPANION_ROUTE_LIMITS.maxHops || Math.abs(dx) > COMPANION_JUMP_LIMITS.maxDistance || dy > COMPANION_JUMP_LIMITS.maxDrop) continue;
        const landing: Platform = { id: to.platformId, x: to.x - 12, y: to.y, width: 24, kind: "date" };
        if (!reachablePlatforms(from, [landing]).length) {
          height = Math.max(140, -dy + 24);
          if (!allowSpring || !springTargets.has(to.platformId) || dy >= 0 || Math.abs(dx) > 120 || height > from.y - 100
            || !reachablePlatforms(from, [landing], { maxRise: height }).length) continue;
        }
      }
      // A small takeoff/landing cost breaks near-equal ties toward fewer jumps.
      const cost = distance[current] + (walk ? Math.abs(dx) : Math.hypot(dx, dy) + 60 + (height ? 100 : 0));
      if (cost < distance[next]) { distance[next] = cost; parent[next] = current; hops[next] = hops[current] + Number(!walk); spring[next] = height; }
    }
  }
  return null;
}

export type CompanionHomePlan = { state: "travel"; action: CompanionAction } | { state: "arrived" | "blocked" | "missing" };

/** One coalesced geometry confirmation is enough for an unsolicited recovery.
 * A direct command keeps its destination; an automatic idea must yield to
 * ordinary life if the real route remains disconnected. No timer retries. */
export function companionHomeBlockedResponse(journey: "called" | "automatic", revalidated: boolean): "revalidate" | "wait" | "resume" {
  return !revalidated ? "revalidate" : journey === "called" ? "wait" : "resume";
}

/** A blocked command may sleep its scheduler only after acknowledged input
 * and finite motion have finished. The command itself remains accepted. */
export function canParkCompanionHomeWait(now: number, petUntil: number, inputUntil: number, busy: boolean): boolean {
  return !busy && [now, petUntil, inputUntil].every(Number.isFinite) && now >= petUntil && now >= inputUntil;
}

/** Replan at action boundaries; walk segments stay finite for live reflow.
 * Only an otherwise stranded creature gets a stronger crouch/spring, landing
 * on a real measured room support. No extra timer, DOM read or fake support. */
export function planCompanionHomeReturn(brain: CompanionBrain, world: CompanionWorld, prefs: CompanionPreferences): CompanionHomePlan {
  if (!prefs.enabled || world.paused) return { state: "blocked" };
  const home = world.platforms.find(p => p.id === "companion-home" && valid(p));
  if (!home) return { state: "missing" };
  const profile = getCompanionBehaviorProfile(prefs, brain.habits);
  const dog = prefs.animalMode === "dog", cat = prefs.animalMode === "cat";
  const speed = profile.walkSpeed * (dog ? 1.8 : cat ? 1 : 1.2);
  const move = (step: HomeRouteStep): CompanionHomePlan => ({ state: "travel", action: {
    // Each measured interval is already clear for the complete body. Finish
    // that one span continuously; layout delivery still revalidates its ends.
    kind: step.kind, target: step.target,
    duration: step.kind === "walk" ? Math.max(280, Math.abs(step.target.x - world.x) / speed * 1000) : 950,
    ...(step.kind === "walk" ? { pace: dog ? "scoot" as const : "amble" as const } : step.jumpHeight ? { jumpHeight: step.jumpHeight } : {}), direction: step.target.x < world.x ? -1 : 1,
  } });
  const target = { x: platformLandingX(home, home.x + home.width / 2), y: home.y, platformId: home.id };
  const route = shortestCompanionHomeRoute(world, target, world.platforms, prefs.jump);
  if (route) return route.length ? move(route[0]) : { state: "arrived" };
  // Retry the same real graph with one stronger house-entry edge. This also
  // finds normal hops between floor fragments before approaching the room.
  // A disconnected current floor must not be treated as the only takeoff.
  const escape = prefs.jump ? shortestCompanionHomeRoute(world, target, world.platforms, true, true) : null;
  return escape?.length ? move(escape[0]) : { state: "blocked" };
}

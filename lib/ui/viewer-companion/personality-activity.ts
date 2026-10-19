import { findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionPlay, type CompanionWorld } from "./brain";
import type { CompanionPreferences } from "./preferences";
import { findCompanionToyRoute } from "./toys";
import { companionPlayDuration } from "./timing";
import { shouldDeclineCompanionFood, type CompanionTastes } from "./toy-tastes";
import type { CompanionFoodKind } from "./snacks";
import { getCompanionBehaviorProfile } from "./behavior-profile";

type PersonalityAction = CompanionAction & { foodRefusal?: { foodId: string; kind: CompanionFoodKind }; personalitySignature?: CompanionPreferences["personality"] };
type Activity = PersonalityAction & { scene?: { id: number }; toy?: unknown; household?: unknown; radio?: unknown; personalityScene?: unknown };
export type CompanionProgressBoundary = { deadline: number; nextDuration: number };
export type CompanionLifePurpose = "ordinary" | "explore" | "food" | "toy" | "care" | "social" | "authored";
/** Coarse painted-action provenance only. No target or learned identity is
 * exposed, and this label never earns progress/reward or owns an action. */
export function companionLifePurpose(action: Activity): CompanionLifePurpose {
  if (action.personalityScene || action.scene) return "authored";
  if (action.kind === "eat" || action.foodId || action.foodRefusal || action.foodCuriosity || action.household || action.intention?.kind === "feed" || action.episode?.kind === "meal") return "food";
  if (action.toy) return "toy";
  if (action.kind === "sleep" || action.intention?.kind === "rest" || action.living === "cozy" || action.episode) return "care";
  if (action.kind === "heart" || action.living || action.radio || action.accessory || action.attention?.kind === "social") return "social";
  return action.intention?.kind === "explore" ? "explore" : "ordinary";
}
/** Only a next ordinary idle/look is replaceable. The renderer keeps every
 * actual owner and current action. This never stamps progress on launch. */
export function boundCompanionStationaryProgress<T extends Activity>(action: T, brain: CompanionBrain, world: CompanionWorld, preferences: CompanionPreferences,
  now: number, deadline: number | undefined, choose: (boundary: CompanionProgressBoundary) => PersonalityAction | undefined, owned = false): T | PersonalityAction {
  if (owned || !preferences.enabled || !preferences.roam || !world.animated || world.paused || !["idle", "look"].includes(action.kind)
    || !Number.isFinite(now) || !Number.isFinite(deadline) || !Number.isFinite(action.duration) || action.duration <= 0 || now + action.duration <= deadline!
    || action.personalityScene || action.foodId || action.foodRefusal || action.toy || action.household || action.scene || action.radio || action.accessory || action.living || action.episode
    || brain.foodGoal || brain.episode || brain.intention && brain.intention.kind !== "explore") return action;
  const next = choose({ deadline: deadline!, nextDuration: action.duration });
  const target = next && world.platforms.find(platform => platform.id === next.target.platformId);
  if (next && ["walk", "jump"].includes(next.kind) && (next.kind !== "jump" || preferences.jump) && target && !target.bodyOnly
    && Math.abs(next.target.y-target.y) <= 2 && next.target.x >= target.x && next.target.x <= target.x+target.width
    && Math.hypot(next.target.x-world.x,next.target.y-world.y) >= 24) return next;
  // A temporarily impossible move stays honest and finite. No pose/object
  // reward or synthetic route is invented; the actual detector still applies.
  return { ...action, duration: Math.max(220, Math.min(action.duration, deadline!-now)) };
}
/** Preparation and legacy fallbacks obey the same explicit interaction flags. */
export function companionPersonalityPlayAllowed(play: CompanionPlay, preferences: Pick<CompanionPreferences, "petting" | "jump">): boolean {
  return (preferences.petting || !["ask-petting", "lean-nuzzle"].includes(play)) && (preferences.jump || play !== "pounce");
}
/** Reserve a due real excursion before creating a new secondary job.
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
  let blockedKey = "", blockedAt = 0, blockedX = 0, blockedY = 0;
  const explored = new Set<string>();
  let refuseAt = 0;
  // Foreground-only, geometry-local travel memory. A proposed route, launch,
  // pose or interrupted leg never enters this six-arrival window.
  type ArrivalPoint = { x: number; y: number; platformId?: string };
  const arrivals: { from: ArrivalPoint; to: ArrivalPoint; at: number }[] = [];
  const ordinaryTravel = (action: Activity) => ["walk", "jump"].includes(action.kind) && !action.foodId && !action.foodRefusal
    && !action.toy && !action.household && !action.scene && !action.personalityScene && !action.radio && !action.accessory && !action.living && !action.episode
    && !action.intention && !action.attention;
  const recentReverse = (from: ArrivalPoint, to: ArrivalPoint, now: number) => Boolean(from.platformId && to.platformId
    && arrivals.some(arrival => arrival.from.platformId === to.platformId && arrival.to.platformId === from.platformId
      && now >= arrival.at && now-arrival.at < 20000
      // Distinct supports keep their existing reverse-route preference. On
      // one floor, remember actual endpoints instead of flagging every walk
      // as a reversal merely because its support ID is unchanged.
      && (from.platformId !== to.platformId
        || Math.hypot(from.x-arrival.to.x,from.y-arrival.to.y) <= 24 && Math.hypot(to.x-arrival.from.x,to.y-arrival.from.y) <= 24)));
  const realOrdinarySupport = (platform: CompanionWorld["platforms"][number] | undefined) => Boolean(platform && !platform.bodyOnly
    && !["control","hide"].includes(platform.kind) && (!platform.manualOnly || platform.id === "companion-home-floor" && platform.kind === "floor")
    && [platform.x,platform.y,platform.width].every(Number.isFinite) && platform.width > 0);
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
  return {
    recordArrival(action: Activity, from: {x:number;y:number;platformId?:string}, world: CompanionWorld, preferences: CompanionPreferences, now: number) {
      const source=world.platforms.find(platform=>platform.id===from.platformId),target=world.platforms.find(platform=>platform.id===world.platformId);
      if (!ordinaryTravel(action) || !preferences.enabled || !preferences.roam || !world.animated || world.paused || action.kind === "jump" && !preferences.jump
        || !Number.isFinite(now) || now < 0 || now < (arrivals.at(-1)?.at ?? 0) || ![from.x,from.y,world.x,world.y,action.target.x,action.target.y].every(Number.isFinite)
        || !realOrdinarySupport(source) || !realOrdinarySupport(target) || world.platformId !== action.target.platformId
        || Math.abs(from.y-source!.y)>2 || from.x<source!.x || from.x>source!.x+source!.width
        || Math.abs(world.y-target!.y)>2 || world.x<target!.x || world.x>target!.x+target!.width
        || Math.hypot(world.x-action.target.x,world.y-action.target.y)>2 || Math.hypot(world.x-from.x,world.y-from.y)<24) return false;
      while (arrivals.length && now-arrivals[0].at>=20000) arrivals.shift();
      arrivals.push({from:{x:from.x,y:from.y,platformId:source!.id},to:{x:world.x,y:world.y,platformId:target!.id},at:now});if(arrivals.length>6) arrivals.shift();return true;
    },
    /** Only an unowned ordinary proposal is replaceable. A failed alternate
     * keeps the original proved escape; care and retained goals stay intact. */
    diversifyTravel<T extends Activity>(action:T,brain:CompanionBrain,world:CompanionWorld,preferences:CompanionPreferences,now:number,choose:()=>PersonalityAction|undefined,owned=false):T|PersonalityAction {
      if (owned || !ordinaryTravel(action) || !preferences.enabled || !preferences.roam || !world.animated || world.paused || !Number.isFinite(now)
        || brain.foodGoal || brain.episode || brain.intention || !recentReverse(world,action.target,now)) return action;
      return choose() ?? action;
    },
    due(now: number) { return Number.isFinite(now) && now - lastMeaningfulAt >= 8000; },
    boundWander<T extends Activity>(action: T, world: CompanionWorld, preferences: CompanionPreferences, now: number): T {
      if (action.kind !== "walk" || action.target.platformId !== world.platformId || action.foodId || action.foodRefusal || action.living || action.scene || action.toy || action.household || action.radio || action.accessory || action.personalitySignature
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
      const purpose = action.living || action.foodId || action.foodRefusal || action.episode
        || action.scene && action.scene.id <= 30 || action.toy || action.household || action.radio || action.accessory || action.attention?.kind === "social";
      if (Number.isFinite(now) && (travel || directed || newExploration || ["eat", "sleep", "heart", "hide"].includes(action.kind) || purpose)) lastMeaningfulAt = now;
    },
    choose(brain: CompanionBrain, world: CompanionWorld, preferences: CompanionPreferences, now: number, boundary?: CompanionProgressBoundary): PersonalityAction | undefined {
      const crossesDeadline = boundary && Number.isFinite(boundary.deadline) && Number.isFinite(boundary.nextDuration)
        && boundary.nextDuration > 0 && now + boundary.nextDuration > boundary.deadline;
      if (!preferences.enabled || !preferences.roam || !world.animated || world.paused || !Number.isFinite(now) || now - lastMeaningfulAt < 8000 && !crossesDeadline
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
      if (!support || support.bodyOnly || support.manualOnly && (support.id !== "companion-home-floor" || support.kind !== "floor") || ["control", "hide"].includes(support.kind)
        || ![world.x, world.y, support.x, support.y, support.width].every(Number.isFinite)
        || Math.abs(world.y - support.y) > 2 || world.x < support.x || world.x > support.x + support.width) return;
      const profile = getCompanionBehaviorProfile(preferences, brain.habits), draw = rng();
      // Callers pass brain.activeMs, the same foreground clock used when
      // commitAction records a failed place. No wall time or saved debt.
      const blockedTarget = (id?: string) => Boolean(id && brain.places?.some(place => place.id === id && place.failures > 0 && place.retryAfter > now));
      const targets = world.platforms.filter(platform => platform.id !== support.id && (!platform.manualOnly || platform.id === "companion-home-floor" && platform.kind === "floor")
        && !platform.bodyOnly && !["control", "hide"].includes(platform.kind) && !blockedTarget(platform.id))
        .sort((a,b) => Number(brain.visited.includes(a.id))-Number(brain.visited.includes(b.id)) || Math.hypot(a.x-world.x,a.y-world.y)-Math.hypot(b.x-world.x,b.y-world.y));
      // A dense calendar can leave every nearby public glyph unreachable
      // from the cushion. Keep its real visited floor inside the same eight
      // proofs, after the first seven novel choices, so an escape is tried.
      const floorEscape = support.id === "companion-home" ? targets.find(platform => platform.id === "companion-home-floor" && platform.kind === "floor" && realOrdinarySupport(platform)) : undefined;
      const candidates = targets.slice(0, 8);
      if (floorEscape && !candidates.includes(floorEscape)) candidates.splice(7, 1, floorEscape);
      const alternatives: PersonalityAction[]=[];
      for (const platform of candidates) {
        const point = { x: platformLandingX(platform, platform.x+platform.width/2), y: platform.y, platformId: platform.id };
        const routePlatforms = world.platforms.filter(plane => !plane.manualOnly || plane.id === support.id || plane.id === "companion-home-floor");
        const route = platform.id === "companion-home-floor" ? findCompanionToyRoute(world, point, routePlatforms, preferences.jump)
          : findPlatformRoute(world, point, world.platforms, preferences.jump), step = route?.[0];
        if (step && !blockedTarget(step.target.platformId) && Math.hypot(step.target.x-world.x,step.target.y-world.y) >= 24) {
          const offered:PersonalityAction={...step,personalitySignature:preferences.personality,
            duration:step.kind === "jump" ? 900 : Math.max(350,Math.abs(step.target.x-world.x)/profile.walkSpeed*1000)};
          // A nominal new destination may still reuse the same reverse first
          // hop. Defer it too, then try another proved route or real floor walk.
          if (recentReverse(world,point,now) || recentReverse(world,step.target,now)) alternatives.push(offered);
          else return offered;
        }
      }
      // Empty scenes yield to the normal planner rather than manufacturing a
      // new pose. On a real ordinary span, a finite purposeful walk is enough.
      if (support.bodyOnly || support.manualOnly && (support.id !== "companion-home-floor" || support.kind !== "floor")) return;
      const direction = brain.heading ?? (Number.isFinite(draw) && draw < .5 ? -1 : 1);
      // Keep the heading's usual step first. If it retraces a completed
      // A->B leg, try continuing beyond B or another real distance on this
      // same measured span. Clamping never invents a new floor or teleport.
      const walkXs = [direction*100,-direction*100,direction*180,-direction*180,direction*48,-direction*48]
        .map(distance => platformLandingX(support,world.x+distance))
        .filter((x,index,points) => Math.abs(x-world.x) >= 48 && points.findIndex(other=>Math.abs(other-x)<1) === index);
      const novelX = walkXs.find(x=>!recentReverse(world,{x,y:support.y,platformId:support.id},now));
      // After a real local arrival, prefer a proved route over retracing the
      // same cushion forever. A sole local reverse still remains available
      // when no other real escape exists.
      if (novelX === undefined && alternatives.length) return alternatives[0];
      const x = novelX ?? walkXs[0];
      if (x === undefined) return;
      return { kind:"walk", pace: preferences.personality === "sleepy" ? "amble" : "scoot", personalitySignature:preferences.personality,
        target:{x,y:support.y,platformId:support.id},duration:Math.max(350,Math.abs(x-world.x)/profile.walkSpeed*1000),direction:x<world.x?-1:1 };
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

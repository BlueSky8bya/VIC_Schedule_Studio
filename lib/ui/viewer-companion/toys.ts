import { findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionPlay, type CompanionWorld, type Platform } from "./brain";
import type { CompanionPreferences } from "./preferences";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import { COMPANION_FULL_THRESHOLD } from "./care";
import { COMPANION_TOY_KINDS, type CompanionToyKind } from "./toy-catalog";
import { shouldDeclineCompanionToy, type CompanionTastes } from "./toy-tastes";
import { isCompanionHomeFloorFoodSupport } from "./food";
export { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, type CompanionToyKind } from "./toy-catalog";

export const MAX_COMPANION_TOYS = 4;
type Point = { x: number; y: number; platformId?: string };
export type CompanionToy = Point & { id: string; kind: CompanionToyKind; angle: number; held: boolean; carried: boolean; fraction?: number; hidden?: boolean; stance?: Point };
type Flight = { at: number; lastAt: number; x: number; y: number; vx: number; vy: number; previous: Point; remaining: number };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const valid = (point: Point) => [point.x, point.y].every(Number.isFinite);
const floor = (platform: Platform) => !["control", "hide"].includes(platform.kind);
const roomFloor = (platform: Platform) => platform.kind === "floor" && /^companion-home-floor(?:-\d+)?$/.test(platform.id);
const roomContact = (platform: Platform) => roomFloor(platform) || platform.kind === "floor" && isCompanionHomeFloorFoodSupport(platform.id);

/** Keep a small object's actual source/coordinates. Only the pet's separate
 * body-safe approach stance is projected within its existing48px pick reach. */
export function accessibleCompanionToys(toys: readonly CompanionToy[], supports: readonly Platform[]): CompanionToy[] {
  return toys.slice(0, MAX_COMPANION_TOYS).flatMap(toy => {
    if (!isCompanionHomeFloorFoodSupport(toy.platformId)) return [toy];
    const stance = supports.slice(0, 400).filter(p => roomFloor(p) && Math.abs(p.y - toy.y) <= .5 && Math.abs(platformLandingX(p, toy.x) - toy.x) <= 48)
      .sort((a, b) => Math.abs(platformLandingX(a, toy.x) - toy.x) - Math.abs(platformLandingX(b, toy.x) - toy.x))[0];
    return stance ? [{ ...toy, stance: { x: platformLandingX(stance, toy.x), y: stance.y, platformId: stance.id } }] : [];
  });
}

/** A toy errand may traverse the room's measured body-safe floor spans. The
 * ordinary roaming graph still excludes these manual supports. Keep the real
 * endpoints inside the bounded graph even in a dense calendar snapshot. */
export function findCompanionToyRoute(from: Point, target: Point, platforms: readonly Platform[], allowJump: boolean) {
  const source = platforms.find(p => p.id === from.platformId), goal = platforms.find(p => p.id === target.platformId);
  const sameFloor = source?.id === goal?.id && source?.kind === "floor" ? source.id : undefined;
  const ordered = [...new Map([...(source ? [source] : []), ...(goal ? [goal] : []), ...platforms.filter(roomFloor), ...platforms].map(p => [p.id, p])).values()];
  const traversable = ordered.map(p => p.manualOnly && (roomFloor(p) || p.id === sameFloor) ? { ...p, manualOnly: false } : p);
  return findPlatformRoute(from, target, traversable, allowJump, target.platformId);
}

/** Four small real objects. Driven only by the host's existing active/finite
 * layout clock. There is no timer, DOM scan, food/discovery or save side effect. */
export function createCompanionToys() {
  let serial = 0, width = 0, height = 0;
  let pausedAt: number | undefined;
  let platforms: readonly Platform[] = [];
  const objects = new Map<string, CompanionToy>(), flights = new Map<string, Flight>();
  const missing = new Map<string, number>();
  const bind = (toy: CompanionToy, support: Platform, x: number) => {
    toy.x = platformLandingX(support, x, 9); toy.y = support.y; toy.platformId = support.id;
    toy.fraction = support.width > 0 ? clamp((toy.x - support.x) / support.width, 0, 1) : .5;
    toy.hidden = false; missing.delete(toy.id);
  };
  const release = (toy: CompanionToy, at: number, velocity = { x: 0, y: 0 }) => {
    toy.held = toy.carried = false; toy.platformId = undefined; toy.fraction = undefined; toy.hidden = false; missing.delete(toy.id);
    const began = pausedAt ?? at;
    flights.set(toy.id, { at: began, lastAt: began, x: toy.x, y: toy.y, vx: Number.isFinite(velocity.x) ? clamp(velocity.x, -260, 260) : 0, vy: Number.isFinite(velocity.y) ? clamp(velocity.y, -220, 140) : 0, previous: { x: toy.x, y: toy.y }, remaining: 2 });
  };
  const remove = (id: string) => { flights.delete(id); missing.delete(id); return objects.delete(id); };
  const reconcile = (at: number) => {
    for (const toy of objects.values()) {
      if (toy.held || toy.carried || flights.has(toy.id)) continue;
      const support = platforms.find(p => p.id === toy.platformId && floor(p));
      if (support) bind(toy, support, support.x + support.width * (toy.fraction ?? .5));
      else if (toy.platformId?.startsWith("companion-panel-floor")) {
        if (!missing.has(toy.id)) missing.set(toy.id, at);
        toy.hidden = true;
      } else release(toy, at);
    }
  };
  return {
    sync(next: readonly Platform[], bounds: { width: number; height: number }, at: number, smallHomeFloors: readonly Platform[] = []) {
      if (![bounds.width, bounds.height, at].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return;
      const measured = [...new Map([...smallHomeFloors.filter(p => p.kind === "floor" && isCompanionHomeFloorFoodSupport(p.id)).slice(0, 8), ...next.slice(0, 400)].filter(p => Boolean(p.id) && [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0).map(p => [p.id, p])).values()];
      const occupied = new Set([...objects.values()].map(toy => toy.platformId).filter(Boolean));
      const retained = (p: Platform) => occupied.has(p.id) || roomContact(p);
      // Ordinary and manual snapshots are independently bounded. Keep the
      // four real toy anchors and room floor before applying our200-node cap.
      platforms = [...measured.filter(retained), ...measured.filter(p => !retained(p))].slice(0, 200); width = bounds.width; height = bounds.height;
      if (pausedAt === undefined) reconcile(at);
    },
    spawn(point: Point, at: number) {
      if (pausedAt !== undefined || objects.size >= MAX_COMPANION_TOYS || !valid(point) || !Number.isFinite(at) || width <= 0 || height <= 0) return;
      const id = "toy-" + ++serial, kind = COMPANION_TOY_KINDS[(serial - 1) % COMPANION_TOY_KINDS.length];
      const toy: CompanionToy = { id, kind, x: point.x, y: point.y, angle: 0, held: false, carried: false };
      objects.set(id, toy);
      // The outlet is the actual source point. A support hint must not move a
      // toy to that floor before its first swept physical contact.
      let vx = serial % 2 ? -80 : 80;
      const recipient = platforms.find(p => p.id === point.platformId && roomContact(p));
      if (recipient && recipient.y > point.y) {
        // A chest ejection aims into its measured room. The ordinary native
        // drop/toss remains unchanged, and the same sweep still owns contact.
        const seconds = (120 + Math.sqrt(120 * 120 + 1800 * (recipient.y - point.y))) / 900;
        const targetX = platformLandingX(recipient, point.x + vx, 9), aimed = (targetX - point.x) / seconds;
        if (Number.isFinite(aimed) && Math.abs(aimed) <= 260) vx = aimed;
      }
      release(toy, at, { x: vx, y: -120 });
      return id;
    },
    tick(at: number) {
      if (pausedAt !== undefined || !Number.isFinite(at)) return;
      for (const [id, since] of missing) if (at - since >= 1500) {
        const toy = objects.get(id); if (toy) release(toy, at); else missing.delete(id);
      }
      for (const [id, flight] of flights) {
        const toy = objects.get(id); if (!toy) { flights.delete(id); continue; }
        if (at < flight.lastAt) continue;
        const age = clamp((at - flight.at) / 1000, 0, 2);
        const next = { x: flight.x + flight.vx * age, y: flight.y + flight.vy * age + 450 * age * age };
        const falling = next.y >= flight.previous.y, dy = next.y - flight.previous.y;
        const landing = falling ? platforms.filter(p => floor(p) && p.y >= flight.previous.y - .1 && p.y <= next.y + .1)
          .map(p => ({ p, t: dy > .01 ? clamp((p.y - flight.previous.y) / dy, 0, 1) : 0 }))
          .filter(({ p, t }) => { const x = flight.previous.x + (next.x - flight.previous.x) * t; return x >= p.x && x <= p.x + p.width; })
          .sort((a, b) => a.t - b.t)[0] : undefined;
        if (landing) { bind(toy, landing.p, flight.previous.x + (next.x - flight.previous.x) * landing.t); toy.angle = 0; flights.delete(id); }
        else {
          toy.x = clamp(next.x, 10, Math.max(10, width - 10)); toy.y = next.y; toy.angle = Math.sin(age * 5) * 30;
          flight.previous = { x: toy.x, y: toy.y };
          flight.lastAt = at;
          if (age >= 2 || toy.y > height + 40) {
            const safe = platforms.filter(p => floor(p) && p.y >= 20 && p.y <= height && p.x <= toy.x && p.x + p.width >= toy.x).sort((a, b) => Math.abs(a.y - toy.y) - Math.abs(b.y - toy.y))[0];
            if (safe) { bind(toy, safe, toy.x); toy.angle = 0; flights.delete(id); }
            else if (--flight.remaining <= 0) remove(id);
            else { flight.at = flight.lastAt = at; flight.x = toy.x; flight.y = clamp(toy.y, 20, Math.max(20, height - 20)); flight.previous = { x: flight.x, y: flight.y }; flight.vx = flight.vy = 0; }
          }
        }
      }
    },
    grab(id: string) { const toy = objects.get(id); if (pausedAt !== undefined || !toy || toy.hidden) return false; flights.delete(id); toy.held = true; toy.carried = false; toy.platformId = undefined; toy.fraction = undefined; return true; },
    drag(id: string, point: Point) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.held || !valid(point)) return false; toy.x = clamp(point.x, 10, Math.max(10, width - 10)); toy.y = clamp(point.y, 20, Math.max(20, height - 10)); return true; },
    drop(id: string, at: number, velocity?: { x: number; y: number }) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.held || !Number.isFinite(at)) return false; release(toy, at, velocity); return true; },
    pick(id: string, point: Point) { const toy = objects.get(id); if (pausedAt !== undefined || !toy || toy.hidden || !valid(point) || toy.held || toy.carried || flights.has(id) || Math.hypot(toy.x - point.x, toy.y - point.y) > 48) return false; toy.carried = true; toy.platformId = undefined; return true; },
    carry(id: string, point: Point) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.carried || !valid(point)) return false; toy.x = point.x; toy.y = point.y; return true; },
    put(id: string, point: Point, at: number, toss = false) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.carried || !valid(point) || !Number.isFinite(at)) return false; toy.x = point.x; toy.y = point.y; if (toss) release(toy, at, { x: serial % 2 ? 160 : -160, y: -160 }); else { toy.carried = false; const support = platforms.find(p => p.id === point.platformId && floor(p)); if (support) bind(toy, support, point.x); else release(toy, at); } return true; },
    nudge(id: string, point: Point, at: number) { const toy = objects.get(id); if (pausedAt !== undefined || !toy || toy.hidden || toy.held || toy.carried || flights.has(id) || !valid(point) || !Number.isFinite(at) || Math.hypot(toy.x - point.x, toy.y - point.y) > 48) return false; release(toy, at, { x: toy.x < point.x ? -120 : 120, y: -80 }); return true; },
    stash(id: string) { const toy = objects.get(id); return Boolean(pausedAt === undefined && toy?.carried && !toy.held && remove(id)); },
    returnHeld(id: string) { return pausedAt === undefined && objects.get(id)?.held ? remove(id) : false; },
    releaseCarry(at: number) { if (Number.isFinite(at)) for (const toy of objects.values()) if (toy.carried) release(toy, at); },
    pause(at: number) {
      if (pausedAt !== undefined || !Number.isFinite(at)) return;
      for (const toy of objects.values()) if (toy.held || toy.carried) release(toy, at);
      for (const flight of flights.values()) { flight.at += Math.max(0, at - flight.lastAt); flight.lastAt = at; }
      pausedAt = at;
    },
    resume(at: number) {
      if (pausedAt === undefined || !Number.isFinite(at) || at < pausedAt) return;
      const gap = at - pausedAt;
      for (const flight of flights.values()) { flight.at += gap; flight.lastAt += gap; }
      for (const [id, since] of missing) missing.set(id, since + gap);
      pausedAt = undefined; reconcile(at);
    },
    items: () => [...objects.values()].map(toy => ({ ...toy })),
    ids: () => [...objects.keys()],
    count: () => objects.size,
    visit: (visitor: (toy: Readonly<CompanionToy>) => void) => objects.forEach(visitor),
    available: () => [...objects.values()].filter(toy => !toy.hidden && !toy.held && !toy.carried && !flights.has(toy.id)).map(toy => ({ ...toy })),
    carried: () => [...objects.values()].find(toy => toy.carried)?.id,
    moving: () => pausedAt === undefined && (flights.size > 0 || missing.size > 0),
    clear: () => { objects.clear(); flights.clear(); missing.clear(); },
  };
}
export type CompanionToyBeat = { serial: number; kind: "tidy" | "play"; effect?: "pick" | "stash" | "toss" | "put" | "decline" | "spawn"; toyId?: string; point?: Point };
export type CompanionToyAction = CompanionAction & { toy: CompanionToyBeat };
/** A real meal or committed care intention always keeps ownership. Shared by
 * both planning and the carried-toy continuation so neither can cut in. */
export function companionToyFoodPriority(brain: CompanionBrain, world: CompanionWorld, preferences: CompanionPreferences) {
  return Boolean(brain.foodGoal || brain.intention && brain.intention.kind !== "explore" || brain.episode && brain.episode.remaining > 0
    || preferences.feeding && brain.hunger >= COMPANION_FULL_THRESHOLD && world.foods?.length);
}
export function companionToyMotivation(p: CompanionPreferences, brain: CompanionBrain, world: CompanionWorld) {
  const social = p.personality === "affectionate" && p.petting && world.pointer && (world.pointer.stableMs ?? 0) >= 900
    && Math.hypot(world.pointer.x - world.x, world.pointer.y - world.y) <= 220;
  const home = /^companion-home(?:-floor)?(?:-\d+)?$/.test(world.platformId ?? "");
  const values: Record<CompanionPreferences["personality"], { spawn: boolean; cooldown: number; play: CompanionPlay; gentle: boolean; interested: boolean }> = {
    curious: { spawn: true, cooldown: 14000, play: "pounce", gentle: false, interested: true },
    affectionate: { spawn: false, cooldown: 20000, play: "lean-nuzzle", gentle: true, interested: !social },
    sleepy: { spawn: false, cooldown: 24000, play: "groom", gentle: true, interested: brain.energy >= .55 },
    tidy: { spawn: false, cooldown: 1200, play: "groom", gentle: true, interested: brain.hunger < COMPANION_FULL_THRESHOLD },
    mischievous: { spawn: true, cooldown: 5000, play: "pounce", gentle: false, interested: true },
    gourmet: { spawn: false, cooldown: 30000, play: "bow", gentle: true, interested: brain.hunger < .2 },
    performer: { spawn: true, cooldown: 12000, play: "celebrate", gentle: false, interested: true },
    homebody: { spawn: false, cooldown: 22000, play: "lean-nuzzle", gentle: true, interested: home },
  };
  return values[p.personality];
}
export function createCompanionToyPlanner() {
  let serial = 0, readyAt = 1200;
  const failed = new Map<string, number>(), noticed = new Map<string, number>();
  let job: { serial: number; kind: "tidy" | "play"; stage: "seek" | "box" | "deliver" | "decline"; toyId?: string; deadline: number; budget: number; play: CompanionPlay; gentle: boolean; cooldown: number } | undefined;
  const stop = (now: number, delay = 6000) => { job = undefined; readyAt = now + delay; };
  const rememberFailure = (id: string, now: number) => { failed.set(id, now + 6000); if (failed.size > 8) failed.delete(failed.keys().next().value!); };
  const fail = (now: number) => {
    if (job?.toyId) rememberFailure(job.toyId, now);
    stop(now, 500);
  };
  type Input = { world: CompanionWorld; brain: CompanionBrain; preferences: CompanionPreferences; now: number; toys: readonly CompanionToy[]; existingIds?: readonly string[]; carriedId?: string; count: number; box?: Point; tastes?: CompanionTastes };
  const eligible = ({ world, brain, preferences: p, now }: Input) => p.enabled && p.roam && world.animated && !world.paused && Number.isFinite(now)
    && brain.energy >= .25 && brain.hunger < .8 && !companionToyFoodPriority(brain, world, p) && companionToyMotivation(p, brain, world).interested;
  const routeBetween = (input: Input, from: Point, target: Point) => {
    return findCompanionToyRoute(from, target, input.world.platforms, input.preferences.jump);
  };
  const preference = (input: Input, toy: CompanionToy) => {
    if (input.preferences.personality === "tidy") return 0;
    const favorites: Record<CompanionPreferences["personality"], readonly CompanionToyKind[]> = { curious: ["paper-plane", "pinwheel", "feather"], affectionate: ["spool", "bell"], sleepy: ["spool", "feather"], tidy: [], mischievous: ["ball", "blocks", "hoop"], gourmet: ["bell", "spool"], performer: ["pinwheel", "bell", "hoop"], homebody: ["blocks", "spool"] };
    const species = input.preferences.animalMode === "dog" && toy.kind === "ball" || input.preferences.animalMode === "cat" && ["feather", "spool"].includes(toy.kind);
    const learned = input.preferences.learnFromYou !== false ? clamp(input.tastes?.toyTastes[toy.kind]?.score ?? 0, -1, 1) : 0;
    return (Number(favorites[input.preferences.personality].includes(toy.kind)) * .4 + Number(species) * .2 + learned * .6) * 120;
  };
  const candidates = (input: Input) => input.toys.filter(toy => toy.platformId && !toy.hidden && !toy.held && !toy.carried && valid(toy)
    && (failed.get(toy.id) ?? -Infinity) <= input.now).slice(0, MAX_COMPANION_TOYS)
    .sort((a, b) => Math.hypot(a.x - input.world.x, a.y - input.world.y) - preference(input, a) - Math.hypot(b.x - input.world.x, b.y - input.world.y) + preference(input, b));
  return {
    // Ordinary action replacement also calls cancel. An inactive planner must
    // not postpone its first admission on every short idle/look forever.
    cancel(now: number) { if (job) stop(now, 1500); },
    wake(now: number) { noticed.clear(); readyAt = Math.min(readyAt, now + 250); },
    notice(input: Input & { action: (CompanionAction & { scene?: { id: number }; toy?: unknown; household?: unknown; radio?: unknown }) | null; active: boolean; grounded: boolean; held?: boolean; commanded?: boolean; busy?: boolean }) {
      const { action, now, preferences: p } = input;
      if (job || !eligible(input) || !input.active || !input.grounded || input.held || input.commanded || input.busy
        || !action || !["idle", "look", "walk"].includes(action.kind) || action.toy || action.household || action.radio || action.accessory || action.living
        || action.scene && ![31, 32, 33, 35].includes(action.scene.id) || p.personality === "tidy" && (!input.box || input.brain.hunger >= COMPANION_FULL_THRESHOLD)) return false;
      for (const toy of candidates(input)) {
        if ((noticed.get(toy.id) ?? -Infinity) > now) continue;
        // Failed route proofs consume this cue too. Pixel motion does not
        // create new identities or repeat graph search on every host frame.
        noticed.set(toy.id, now + 6000); if (noticed.size > 8) noticed.delete(noticed.keys().next().value!);
        const approach = routeBetween(input, input.world, toy.stance ?? toy);
        if (!approach || p.personality === "tidy" && !routeBetween(input, toy.stance ?? toy, input.box!)) continue;
        noticed.set(toy.id, Infinity); readyAt = Math.min(readyAt, now); return true;
      }
      return false;
    },
    next(input: Input): CompanionToyAction | undefined {
      const { world, brain, preferences: p, now, box } = input;
      if (!eligible(input) || p.personality === "tidy" && (!box || brain.hunger >= COMPANION_FULL_THRESHOLD)) { if (job) stop(now, 1000); return; }
      const here = { x: world.x, y: world.y, platformId: world.platformId };
      const routeTo = (target: Point) => routeBetween(input, here, target);
      let preparedRoute: ReturnType<typeof findPlatformRoute> | undefined;
      if (job && (now >= job.deadline || job.budget <= 0 || job.stage === "deliver" && "carriedId" in input && input.carriedId !== job.toyId)) fail(now);
      const continuation = job?.kind === "tidy" && job.stage === "seek" && !job.toyId;
      if (!job || continuation) {
        if (!continuation && now < readyAt) return;
        const tidy = p.personality === "tidy", motivation = companionToyMotivation(p, brain, world);
        // At most four real objects: an unreachable nearest toy cannot hide
        // another reachable one. Reuse its proved first route in this beat.
        const target = candidates(input).find(toy => { const route = routeTo(toy.stance ?? toy); if (!route || tidy && !routeBetween(input, toy.stance ?? toy, box!)) { rememberFailure(toy.id, now); return false; } preparedRoute = route; return true; });
        if (target) job = { serial: ++serial, kind: tidy ? "tidy" : "play", stage: input.tastes && shouldDeclineCompanionToy(target.kind, input.tastes, p, brain) ? "decline" : "seek", toyId: target.id, deadline: now + 30_000, budget: 18, ...motivation };
        else if (motivation.spawn && box && input.count < MAX_COMPANION_TOYS && p.ambientPrank) job = { serial: ++serial, kind: "play", stage: "box", deadline: now + 25_000, budget: 16, ...motivation };
        else { stop(now, 1000); return; }
      }
      const current = job, toy = input.toys.find(item => item.id === current.toyId);
      const target = current.stage === "seek" || current.stage === "decline" ? toy?.stance ?? toy : box;
      if (!target && current.stage === "seek" && current.toyId && input.existingIds?.includes(current.toyId)) {
        current.budget--;
        return { kind: "look", target: here, duration: 250, toy: { serial: current.serial, kind: current.kind } };
      }
      if (!target || !valid(target)) { fail(now); return; }
      const route = preparedRoute ?? routeTo(target);
      if (!route) { fail(now); return; }
      if (route.length) { current.budget--; const step = route[0], speed = getCompanionBehaviorProfile(p, brain.habits).walkSpeed; return { ...step, duration: step.kind === "jump" ? 900 : Math.max(220, Math.abs(step.target.x - world.x) / speed * 1000), pace: current.kind === "play" ? "scoot" : "amble", toy: { serial: current.serial, kind: current.kind } }; }
      if (current.stage === "decline") return { kind: "play", play: "bonk-sad", target: here, duration: 1200, toy: { serial: current.serial, kind: current.kind, effect: "decline", toyId: current.toyId, point: here } };
      return { kind: "sniff", target: here, duration: 600, toy: { serial: current.serial, kind: current.kind, effect: current.stage === "box" ? "spawn" : current.stage === "deliver" ? "stash" : "pick", toyId: current.toyId, point: here } };
    },
    resolve(beat: CompanionToyBeat, ok: boolean | string, now: number) {
      if (!job || beat.serial !== job.serial || !beat.effect) return;
      if (!ok) { fail(now); return; }
      if (beat.effect === "pick") { job.stage = "deliver"; return; }
      if (beat.effect === "spawn" && typeof ok === "string") { job.stage = "seek"; job.toyId = ok; return; }
      // Preserve this actual cleanup owner until the next bounded decision
      // proves another real toy's approach and return. No remaining/reachable
      // candidate clears it there, before any unrelated job is considered.
      if (beat.effect === "stash" && job.kind === "tidy") { job = { ...job, serial: ++serial, stage: "seek", toyId: undefined }; return; }
      stop(now, beat.effect === "decline" ? 20000 : job.cooldown);
    },
    active: () => Boolean(job),
    playfulCarry(input: { x: number; y: number; platformId?: string }): CompanionToyAction | undefined {
      if (job?.stage !== "deliver" || job.kind !== "play" || !job.toyId) return;
      return { kind: "play", play: job.play, target: input, duration: 1100, toy: { serial: job.serial, kind: job.kind, effect: job.gentle ? "put" : "toss", toyId: job.toyId, point: input } };
    },
  };
}

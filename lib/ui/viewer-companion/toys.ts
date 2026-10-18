import { findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionWorld, type Platform } from "./brain";
import type { CompanionPreferences } from "./preferences";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import { COMPANION_FULL_THRESHOLD } from "./care";

export type CompanionToyKind = "ball" | "blocks" | "paper-plane" | "spool";
export const COMPANION_TOY_KINDS: readonly CompanionToyKind[] = Object.freeze(["ball", "blocks", "paper-plane", "spool"]);
export const COMPANION_TOY_NAMES: Readonly<Record<CompanionToyKind, string>> = Object.freeze({ ball: "통통 공", blocks: "알록 블록", "paper-plane": "종이비행기", spool: "실타래" });
export const MAX_COMPANION_TOYS = 4;
type Point = { x: number; y: number; platformId?: string };
export type CompanionToy = Point & { id: string; kind: CompanionToyKind; angle: number; held: boolean; carried: boolean; fraction?: number; hidden?: boolean };
type Flight = { at: number; lastAt: number; x: number; y: number; vx: number; vy: number; previous: Point; remaining: number };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const valid = (point: Point) => [point.x, point.y].every(Number.isFinite);
const floor = (platform: Platform) => !["control", "hide"].includes(platform.kind);

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
    sync(next: readonly Platform[], bounds: { width: number; height: number }, at: number) {
      if (![bounds.width, bounds.height, at].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return;
      platforms = next.filter(p => Boolean(p.id) && [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0).slice(0, 200); width = bounds.width; height = bounds.height;
      if (pausedAt === undefined) reconcile(at);
    },
    spawn(point: Point, at: number) {
      if (pausedAt !== undefined || objects.size >= MAX_COMPANION_TOYS || !valid(point) || !Number.isFinite(at) || width <= 0 || height <= 0) return;
      const id = "toy-" + ++serial, kind = COMPANION_TOY_KINDS[(serial - 1) % COMPANION_TOY_KINDS.length];
      const toy: CompanionToy = { id, kind, x: point.x, y: point.y, angle: 0, held: false, carried: false };
      objects.set(id, toy);
      const support = platforms.find(p => p.id === point.platformId && floor(p));
      if (support) bind(toy, support, point.x);
      release(toy, at, { x: serial % 2 ? -80 : 80, y: -120 });
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
    grab(id: string) { const toy = objects.get(id); if (pausedAt !== undefined || !toy || toy.hidden || toy.carried) return false; flights.delete(id); toy.held = true; toy.platformId = undefined; return true; },
    drag(id: string, point: Point) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.held || !valid(point)) return false; toy.x = clamp(point.x, 10, Math.max(10, width - 10)); toy.y = clamp(point.y, 20, Math.max(20, height - 10)); return true; },
    drop(id: string, at: number, velocity?: { x: number; y: number }) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.held || !Number.isFinite(at)) return false; release(toy, at, velocity); return true; },
    pick(id: string, point: Point) { const toy = objects.get(id); if (pausedAt !== undefined || !toy || toy.hidden || !valid(point) || toy.held || toy.carried || flights.has(id) || Math.hypot(toy.x - point.x, toy.y - point.y) > 48) return false; toy.carried = true; toy.platformId = undefined; return true; },
    carry(id: string, point: Point) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.carried || !valid(point)) return false; toy.x = point.x; toy.y = point.y; return true; },
    put(id: string, point: Point, at: number, toss = false) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.carried || !valid(point) || !Number.isFinite(at)) return false; toy.x = point.x; toy.y = point.y; if (toss) release(toy, at, { x: serial % 2 ? 160 : -160, y: -160 }); else { toy.carried = false; const support = platforms.find(p => p.id === point.platformId && floor(p)); if (support) bind(toy, support, point.x); else release(toy, at); } return true; },
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
export type CompanionToyBeat = { serial: number; kind: "tidy" | "play"; effect?: "pick" | "stash" | "toss" | "spawn"; toyId?: string; point?: Point };
export type CompanionToyAction = CompanionAction & { toy: CompanionToyBeat };
/** A real meal or committed care intention always keeps ownership. Shared by
 * both planning and the carried-toy continuation so neither can cut in. */
export function companionToyFoodPriority(brain: CompanionBrain, world: CompanionWorld, preferences: CompanionPreferences) {
  return Boolean(brain.foodGoal || brain.intention && brain.intention.kind !== "explore" || brain.episode && brain.episode.remaining > 0
    || preferences.feeding && brain.hunger >= COMPANION_FULL_THRESHOLD && world.foods?.length);
}
export function createCompanionToyPlanner() {
  let serial = 0, readyAt = 1200;
  let job: { serial: number; kind: "tidy" | "play"; stage: "seek" | "box" | "deliver"; toyId?: string; deadline: number; budget: number } | undefined;
  const stop = (now: number, delay = 6000) => { job = undefined; readyAt = now + delay; };
  return {
    cancel(now: number) { stop(now, 1500); },
    next(input: { world: CompanionWorld; brain: CompanionBrain; preferences: CompanionPreferences; now: number; toys: readonly CompanionToy[]; existingIds?: readonly string[]; count: number; box?: Point }): CompanionToyAction | undefined {
      const { world, brain, preferences: p, now, box } = input;
      if (!p.enabled || !p.roam || !world.animated || world.paused || companionToyFoodPriority(brain, world, p) || !box) { stop(now, 1000); return; }
      const here = { x: world.x, y: world.y, platformId: world.platformId };
      const routeTo = (target: Point) => {
        const plane = world.platforms.find(item => item.id === target.platformId && item.id === world.platformId && item.kind === "floor");
        const platforms = plane ? world.platforms.map(item => item.id === plane.id ? { ...item, manualOnly: false } : item) : world.platforms;
        return findPlatformRoute(here, target, platforms, p.jump, target.platformId);
      };
      let preparedRoute: ReturnType<typeof findPlatformRoute> | undefined;
      if (job && (now >= job.deadline || job.budget <= 0)) stop(now);
      if (!job) {
        if (now < readyAt) return;
        const tidy = p.personality === "tidy", lively = ["mischievous", "performer", "curious"].includes(p.personality) || p.animalMode === "dog" || p.animalMode === "cat";
        // At most four real objects: an unreachable nearest toy cannot hide
        // another reachable one. Reuse its proved first route in this beat.
        const target = input.toys.filter(toy => toy.platformId && !toy.held && !toy.carried && valid(toy)).slice(0, MAX_COMPANION_TOYS)
          .sort((a, b) => Math.hypot(a.x - world.x, a.y - world.y) - Math.hypot(b.x - world.x, b.y - world.y))
          .find(toy => { const route = routeTo(toy); if (route === null) return false; preparedRoute = route; return true; });
        if (target && (tidy || lively)) job = { serial: ++serial, kind: tidy ? "tidy" : "play", stage: "seek", toyId: target.id, deadline: now + 30_000, budget: 18 };
        else if (lively && input.count < MAX_COMPANION_TOYS && p.ambientPrank) job = { serial: ++serial, kind: "play", stage: "box", deadline: now + 25_000, budget: 16 };
        else { readyAt = now + 6000; return; }
      }
      const current = job, toy = input.toys.find(item => item.id === current.toyId);
      const target = current.stage === "seek" ? toy : box;
      if (!target && current.stage === "seek" && current.toyId && input.existingIds?.includes(current.toyId)) {
        current.budget--;
        return { kind: "look", target: here, duration: 250, toy: { serial: current.serial, kind: current.kind } };
      }
      if (!target || !valid(target)) { stop(now); return; }
      const route = preparedRoute ?? routeTo(target);
      if (!route) { stop(now, 2500); return; }
      if (route.length) { current.budget--; const step = route[0], speed = getCompanionBehaviorProfile(p, brain.habits).walkSpeed; return { ...step, duration: step.kind === "jump" ? 900 : Math.max(220, Math.abs(step.target.x - world.x) / speed * 1000), pace: current.kind === "play" ? "scoot" : "amble", toy: { serial: current.serial, kind: current.kind } }; }
      return { kind: "sniff", target: here, duration: 600, toy: { serial: current.serial, kind: current.kind, effect: current.stage === "box" ? "spawn" : current.stage === "deliver" ? "stash" : "pick", toyId: current.toyId, point: here } };
    },
    resolve(beat: CompanionToyBeat, ok: boolean | string, now: number) {
      if (!job || beat.serial !== job.serial || !beat.effect) return;
      if (!ok) { stop(now, 2500); return; }
      if (beat.effect === "pick") { job.stage = "deliver"; return; }
      if (beat.effect === "spawn" && typeof ok === "string") { job.stage = "seek"; job.toyId = ok; return; }
      stop(now, job.kind === "tidy" ? 1200 : 5000);
    },
    active: () => Boolean(job),
    playfulCarry(input: { x: number; y: number; platformId?: string }): CompanionToyAction | undefined {
      if (job?.stage !== "deliver" || job.kind !== "play" || !job.toyId) return;
      return { kind: "play", play: "pounce", target: input, duration: 1100, toy: { serial: job.serial, kind: job.kind, effect: "toss", toyId: job.toyId, point: input } };
    },
  };
}

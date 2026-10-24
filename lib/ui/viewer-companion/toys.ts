import { COMPANION_JUMP_LIMITS, COMPANION_ROUTE_LIMITS, findPlatformRoute, platformLandingX, type CompanionAction, type CompanionBrain, type CompanionPlay, type CompanionWorld, type Platform } from "./brain";
import type { CompanionPreferences } from "./preferences";
import { getCompanionBehaviorProfile } from "./behavior-profile";
import { COMPANION_FULL_THRESHOLD } from "./care";
import { randomCompanionToy, type CompanionToyKind } from "./toy-catalog";
import { shouldDeclineCompanionToy, type CompanionTastes } from "./toy-tastes";
import { isCompanionHomeFloorFoodSupport } from "./food";
import { createCompanionFoodGravity } from "./food-gravity";
import { compareCompanionItemLandings, rankCompanionItemLandings, type CompanionItemLanding, type CompanionItemPoint } from "./item-landing";
import { COMPANION_TIMING } from "./timing";
import { shortestCompanionHomeRoute } from "./home-route";
export { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, type CompanionToyKind } from "./toy-catalog";

export const MAX_COMPANION_TOYS = 4;
/** The captured pointer and final return share one measured box predicate. */
export function companionToyBoxDropReady(rect: { left: number; right: number; top: number; bottom: number }, point: { x: number; y: number }) {
  return [rect.left, rect.right, rect.top, rect.bottom, point.x, point.y].every(Number.isFinite) && rect.right > rect.left && rect.bottom > rect.top
    && point.x >= rect.left - 8 && point.x <= rect.right + 8 && point.y >= rect.top - 8 && point.y <= rect.bottom + 8;
}
type Point = { x: number; y: number; platformId?: string };
export type CompanionToy = Point & { id: string; kind: CompanionToyKind; angle: number; held: boolean; carried: boolean; fraction?: number; hidden?: boolean; stance?: Point };
/** An already resting object's same physical DOM source may scroll out of
 * the safe landing snapshot. This is its attachment, never a new ledge. */
export type CompanionToyAttachment = Readonly<Point & { id: string; platformId: string; hidden?: boolean }>;
type Flight = { at: number; lastAt: number; x: number; y: number; vx: number; vy: number; previous: Point; homeEmission?: boolean; autonomousToss?: boolean; target?: Point; targetFraction?: number; recovery?: ReturnType<typeof createCompanionFoodGravity> };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
const valid = (point: Point) => [point.x, point.y].every(Number.isFinite);
// The pet's transparent panel support is an attachment, not an object ledge.
const panelFloor = (platform: Platform) => /^companion-panel-floor(?:-food)?(?:-\d+)?$/.test(platform.id);
const floor = (platform: Platform) => !platform.bodyOnly && !["control", "hide"].includes(platform.kind) && !panelFloor(platform);
const roomFloor = (platform: Platform) => !platform.bodyOnly && platform.kind === "floor" && /^companion-home-floor(?:-\d+)?$/.test(platform.id);
const roomContact = (platform: Platform) => roomFloor(platform) || platform.kind === "floor" && isCompanionHomeFloorFoodSupport(platform.id);
const viewportFloor = (platform: Platform) => platform.kind === "floor" && /^viewport-floor(?:-food)?(?:-\d+)?$/.test(platform.id);
const homeContacts = (platforms: readonly Platform[]) => platforms.filter(p => roomContact(p)
  && (!roomFloor(p) || !platforms.some(small => isCompanionHomeFloorFoodSupport(small.id) && Math.abs(small.y - p.y) <= .5)));
/** Source ejections use the exact descending crossing, so a coarse host tick
 * cannot change the reserved first contact. Human throws keep their sweep. */
function firstHomeContact(source: Point, vx: number, vy: number, contacts: readonly Platform[], until: number, since = 0) {
  let first: { p: Platform; x: number; t: number } | undefined;
  for (const p of contacts) {
    const discriminant = vy * vy + 1800 * (p.y - source.y);
    if (discriminant < 0) continue;
    const t = (-vy + Math.sqrt(discriminant)) / 900, x = source.x + vx * t;
    if (t <= 0 || t < since - 1e-8 || t > until + 1e-8 || x < p.x || x > p.x + p.width) continue;
    if (!first || t < first.t) first = { p, x, t };
  }
  return first;
}

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
export function findCompanionToyRoute(from: Point, target: Point, platforms: readonly Platform[], allowJump: boolean, allowHomeFloorEntry = false) {
  const source = platforms.find(p => p.id === from.platformId), goal = platforms.find(p => p.id === target.platformId);
  const sameFloor = source?.id === goal?.id && source?.kind === "floor" ? source.id : undefined;
  const ordered = [...new Map([...(source ? [source] : []), ...(goal ? [goal] : []), ...platforms.filter(roomFloor), ...platforms].map(p => [p.id, p])).values()];
  const traversable = ordered.map(p => p.manualOnly && (roomFloor(p) || p.id === sameFloor) ? { ...p, manualOnly: false } : p);
  const normal = findPlatformRoute(from, target, traversable, allowJump, target.platformId);
  if (normal || !allowHomeFloorEntry || !allowJump || !source || !goal || !roomFloor(goal) || !goal.manualOnly
    || source.bodyOnly || ["control", "hide"].includes(source.kind) || panelFloor(source) || roomFloor(source) || source.id === "companion-home"
    || !valid(from) || !valid(target) || Math.abs(target.y-goal.y) > .5 || target.x < goal.x || target.x > goal.x+goal.width) return normal;
  // Explicit real returns alone reuse the existing bounded house-entry
  // crouch/spring. Ordinary roaming never gains a stronger jump or a fake
  // platform. Preserve the real requested room floor and every proved hop.
  return shortestCompanionHomeRoute(from, target, ordered.filter(p => !p.bodyOnly && !["control", "hide"].includes(p.kind) && !panelFloor(p)), true, true);
}

/** Four small real objects. Driven only by the host's existing active/finite
 * layout clock. There is no timer, DOM scan, food/discovery or save side effect. */
export function createCompanionToys(rng: () => number = Math.random) {
  let serial = 0, width = 0, height = 0;
  let previousKind: CompanionToyKind | undefined;
  //143 replaces the uniform24-item bag with the published60-item rarity
  // distribution. Invalid/capped spawns still return before consuming RNG.
  const nextKind = () => { previousKind = randomCompanionToy(previousKind, rng); return previousKind; };
  let pausedAt: number | undefined;
  let platforms: readonly Platform[] = [];
  let emissionContacts: readonly Platform[] = [];
  const objects = new Map<string, CompanionToy>(), flights = new Map<string, Flight>(), waiting = new Set<string>();
  const bind = (toy: CompanionToy, support: Platform, x: number) => {
    toy.x = platformLandingX(support, x, 9); toy.y = support.y; toy.platformId = support.id;
    toy.fraction = support.width > 0 ? clamp((toy.x - support.x) / support.width, 0, 1) : .5;
    toy.hidden = false;
  };
  const release = (toy: CompanionToy, at: number, velocity = { x: 0, y: 0 }) => {
    toy.held = toy.carried = false; toy.platformId = undefined; toy.fraction = undefined; toy.hidden = false;
    const began = pausedAt ?? at;
    waiting.delete(toy.id);
    flights.set(toy.id, { at: began, lastAt: began, x: toy.x, y: toy.y, vx: Number.isFinite(velocity.x) ? clamp(velocity.x, -260, 260) : 0, vy: Number.isFinite(velocity.y) ? clamp(velocity.y, -220, 140) : 0, previous: { x: toy.x, y: toy.y } });
  };
  const safeToss = (point: Point, support: Platform, impulse = { vy: -160, dx: serial % 2 ? 48 : -48, speed: 160 }) => {
    const contacts = roomContact(support) ? homeContacts(platforms).filter(p => Math.abs(p.y - support.y) <= .5).slice(0, 8) : [support];
    const body = roomFloor(support) ? support : roomContact(support) ? platforms.filter(p => roomFloor(p) && Math.abs(p.y - support.y) <= .5 && Math.abs(platformLandingX(p, point.x) - point.x) <= 48)
      .sort((a, b) => Math.abs(platformLandingX(a, point.x) - point.x) - Math.abs(platformLandingX(b, point.x) - point.x))[0] : support;
    if (!body) return;
    const physical = platforms.filter(floor), { vy, speed } = impulse, desired = point.x + impulse.dx;
    for (const contact of contacts) {
      const discriminant = vy * vy + 1800 * (contact.y - point.y);
      if (discriminant < 0) continue;
      const seconds = (-vy + Math.sqrt(discriminant)) / 900;
      if (seconds <= 0 || seconds > .75) continue;
      const low = Math.max(platformLandingX(contact, contact.x, 9), roomFloor(body) ? platformLandingX(body, body.x) - 48 : body.x + Math.min(9, body.width / 2), point.x - speed * seconds);
      const high = Math.min(platformLandingX(contact, contact.x + contact.width, 9), roomFloor(body) ? platformLandingX(body, body.x + body.width) + 48 : body.x + body.width - Math.min(9, body.width / 2), point.x + speed * seconds);
      if (low > high) continue;
      const x = clamp(desired, low, high), vx = (x - point.x) / seconds;
      if (!Number.isFinite(vx)) continue;
      const first = firstHomeContact(point, vx, vy, physical, seconds);
      if (!first || first.p.id !== contact.id || Math.abs(first.x - x) > 1e-6) continue;
      return { vx, vy, target: { x: first.x, y: first.p.y, platformId: first.p.id } };
    }
  };
  const tossOntoSupport = (toy: CompanionToy, point: Point, support: Platform, at: number, impulse?: { vy: number; dx: number; speed: number }) => {
    const arc = safeToss(point, support, impulse);
    if (arc) {
      release(toy, at, { x: arc.vx, y: arc.vy });
      const flight = flights.get(toy.id)!, target = platforms.find(p => p.id === arc.target.platformId)!;
      flight.autonomousToss = true; flight.target = arc.target; flight.targetFraction = (arc.target.x - target.x) / target.width;
    } else {
      // A blocked/narrow arc keeps the same object on its actual support.
      toy.carried = false; bind(toy, support, point.x);
    }
  };
  const remove = (id: string) => { waiting.delete(id); flights.delete(id); return objects.delete(id); };
  const recover = (toy: CompanionToy, at: number) => {
    // A protected button can leave a hole in the floor below a captured grip.
    // Recover only onto a current measured viewport span, never onto a missed
    // card, transparent panel, guessed full-width ledge or deletion boundary.
    toy.x = clamp(toy.x, 24, Math.max(24, width - 24)); toy.y = clamp(toy.y, 44, Math.max(44, height - 10));
    toy.platformId = undefined; toy.fraction = undefined; toy.angle = 0; toy.hidden = false;
    const candidate = platforms.filter(p => viewportFloor(p) && p.y >= height * .65 - 8 && p.y <= height - 12
      && Math.max(24, p.x) <= Math.min(width - 24, p.x + p.width))
      .map(p => ({ p, x: clamp(toy.x, Math.max(24, p.x), Math.min(width - 24, p.x + p.width)) }))
      .sort((a, b) => Math.abs(a.x - toy.x) - Math.abs(b.x - toy.x) || a.p.y - b.p.y || a.p.id.localeCompare(b.p.id))[0];
    if (!candidate) { flights.delete(toy.id); waiting.add(toy.id); return; }
    const target = { x: platformLandingX(candidate.p, candidate.x, 9), y: candidate.p.y, platformId: candidate.p.id };
    const recovery = createCompanionFoodGravity(toy, target, 0, { recoverAboveFloor: true });
    waiting.delete(toy.id);
    if (!recovery.duration) { bind(toy, candidate.p, target.x); flights.delete(toy.id); return; }
    flights.set(toy.id, { at, lastAt: at, x: toy.x, y: toy.y, vx: 0, vy: 0, previous: { x: toy.x, y: toy.y }, target,
      targetFraction: clamp((target.x - candidate.p.x) / candidate.p.width, 0, 1), recovery });
  };
  const reconcile = (at: number, attachments: readonly CompanionToyAttachment[] = []) => {
    for (const toy of objects.values()) {
      if (toy.held || toy.carried || flights.has(toy.id) || waiting.has(toy.id)) continue;
      if (/^viewport-floor(?:-food)?(?:-\d+)?$/.test(toy.platformId ?? "")) {
        // Scroll can split/re-number the screen floor around calendar ink.
        // Those spans are safe intervals, not a physical source that scales
        // an object's horizontal fraction. Keep its actual screen X whenever
        // safe; a newly covered point moves only to the closest real landing.
        let nearest: Platform | undefined, distance = Infinity;
        for (const candidate of platforms) {
          if (!floor(candidate) || !viewportFloor(candidate)) continue;
          const delta = Math.abs(platformLandingX(candidate, toy.x, 9) - toy.x);
          if (delta < distance || delta === distance && candidate.id === toy.platformId) { nearest = candidate; distance = delta; }
        }
        if (nearest) { bind(toy, nearest, toy.x); continue; }
      }
      const support = platforms.find(p => p.id === toy.platformId && floor(p));
      if (support) bind(toy, support, support.x + support.width * (toy.fraction ?? .5));
      else {
        const attached = attachments.find(item => item.id === toy.id && item.platformId === toy.platformId && valid(item));
        if (attached) { toy.x = attached.x; toy.y = attached.y; toy.hidden = Boolean(attached.hidden); }
        else release(toy, at);
      }
    }
  };
  return {
    sync(next: readonly Platform[], bounds: { width: number; height: number }, at: number, smallHomeFloors: readonly Platform[] = [], attachments: readonly CompanionToyAttachment[] = []) {
      if (![bounds.width, bounds.height, at].every(Number.isFinite) || bounds.width <= 0 || bounds.height <= 0) return;
      const measuredById = new Map<string, Platform>();
      // The host supplies current followed geometry before its cached full-
      // scan landing twins. Keep that first sample paired with the display
      // anchor; a later stale twin must not undo the scroll translation.
      for (const p of [...smallHomeFloors.filter(p => p.kind === "floor" && isCompanionHomeFloorFoodSupport(p.id)).slice(0, 8), ...next.slice(0, 400)]) {
        if (p.id && !p.bodyOnly && !panelFloor(p) && [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0 && !measuredById.has(p.id)) measuredById.set(p.id, p);
      }
      const measured = [...measuredById.values()];
      const occupied = new Set([...objects.values()].map(toy => toy.platformId).filter(Boolean));
      const retained = (p: Platform) => occupied.has(p.id) || roomContact(p);
      // Ordinary and manual snapshots are independently bounded. Keep the
      // four real toy anchors and room floor before applying our200-node cap.
      platforms = [...measured.filter(retained), ...measured.filter(p => !retained(p))].slice(0, 200); width = bounds.width; height = bounds.height;
      emissionContacts = [...homeContacts(platforms), ...platforms.filter(viewportFloor)];
      // A source-bound chest flight follows its same moving floor without
      // restarting gravity. Native user throws have no such destination.
      for (const [id, flight] of flights) {
        if (!flight.target || flight.targetFraction === undefined) continue;
        const support = platforms.find(p => p.id === flight.target!.platformId && (flight.recovery ? viewportFloor(p) : flight.autonomousToss ? floor(p) : roomContact(p)));
        const toy = objects.get(id);
        if (!support || !toy) { if (toy && flight.recovery) recover(toy, at); else { flight.target = undefined; flight.targetFraction = undefined; } continue; }
        const x = platformLandingX(support, support.x + support.width * flight.targetFraction, 9), y = support.y;
        const dx = x - flight.target.x, dy = y - flight.target.y;
        flight.x += dx; flight.y += dy; flight.previous.x += dx; flight.previous.y += dy;
        toy.x += dx; toy.y += dy; flight.target = { x, y, platformId: support.id };
      }
      if (pausedAt === undefined) {
        for (const id of waiting) { const toy = objects.get(id); if (toy) recover(toy, at); else waiting.delete(id); }
      }
      // Pausing freezes a throw's clock, not the real floor under a resting
      // object. Keep its logical coordinates paired with that moving floor.
      reconcile(at, attachments.slice(0, MAX_COMPANION_TOYS));
    },
    spawn(point: Point, at: number, occupied: readonly CompanionItemPoint[] = []) {
      if (pausedAt !== undefined || objects.size >= MAX_COMPANION_TOYS || !valid(point) || !Number.isFinite(at) || width <= 0 || height <= 0) return;
      const id = "toy-" + ++serial, kind = nextKind();
      const toy: CompanionToy = { id, kind, x: point.x, y: point.y, angle: 0, held: false, carried: false };
      objects.set(id, toy);
      // The outlet is the actual source point. A support hint must not move a
      // toy to that floor before its first swept physical contact.
      let vx = serial % 2 ? -80 : 80, vy = -120, reservation: Point | undefined;
      const recipient = platforms.find(p => p.id === point.platformId && roomContact(p));
      if (recipient && recipient.y > point.y) {
        const desired = point.x + vx;
        const contacts = emissionContacts.filter(p => roomContact(p) && Math.abs(p.y - recipient.y) <= .5).slice(0, 8);
        const reservations = [...objects.values()].filter(item => item.id !== id && !item.hidden && !item.held && !item.carried)
          .map(item => flights.get(item.id)?.target ?? item);
        const occupiedPoints = [...reservations, ...occupied];
        let best: { landing: CompanionItemLanding; vx: number; vy: number; point: Point } | undefined;
        // All candidates stay inside release's existing velocity limits. The
        // longer source arc can reach real free space that -120 alone misses.
        for (const launchY of [-120, -220, -40, 60, 140]) for (const contact of contacts) {
          const seconds = (-launchY + Math.sqrt(launchY * launchY + 1800 * (contact.y - point.y))) / 900;
          if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 2) continue;
          for (const body of platforms) {
            if (!roomFloor(body) || Math.abs(body.y - contact.y) > .5) continue;
            const reach = Math.sqrt(48 * 48 - (body.y - contact.y) ** 2);
            const low = Math.max(platformLandingX(body, body.x) - reach, platformLandingX(contact, contact.x, 9), point.x - 260 * seconds, 10);
            const high = Math.min(platformLandingX(body, body.x + body.width) + reach, platformLandingX(contact, contact.x + contact.width, 9), point.x + 260 * seconds, width - 10);
            if (low > high) continue;
            for (const packed of rankCompanionItemLandings([{ id: contact.id, x: low, y: contact.y, width: high - low }], desired, occupiedPoints)) {
              const aimed = (packed.x - point.x) / seconds;
              if (!Number.isFinite(aimed) || Math.abs(aimed) > 260) continue;
              const first = firstHomeContact(point, aimed, launchY, emissionContacts, seconds);
              if (!first || Math.abs(first.p.y - contact.y) > 1e-6 || Math.abs(first.x - packed.x) > 1e-6
                || Math.abs(platformLandingX(first.p, first.x, 9) - first.x) > 1e-6
                || Math.hypot(first.x - platformLandingX(body, first.x), first.p.y - body.y) > 48) continue;
              if (!best || compareCompanionItemLandings(packed, best.landing) < 0) best = {
                landing: packed, vx: aimed, vy: launchY, point: { x: first.x, y: first.p.y, platformId: first.p.id },
              };
            }
          }
        }
        if (best) { vx = best.vx; vy = best.vy; reservation = best.point; }
      }
      release(toy, at, { x: vx, y: vy });
      if (recipient) flights.get(id)!.homeEmission = true;
      if (reservation) {
        const flight = flights.get(id)!, support = platforms.find(p => p.id === reservation.platformId)!;
        flight.target = reservation;
        flight.targetFraction = support ? clamp((reservation.x - support.x) / support.width, 0, 1) : undefined;
      }
      return id;
    },
    settleHomeEmissions() {
      // A closing room keeps a newly dispensed object inside. Finish only
      // its already measured home arc; human throws keep their ownership.
      let settled = 0;
      for (const [id, flight] of flights) {
        if (!flight.homeEmission) continue;
        const toy = objects.get(id), contact = firstHomeContact(flight, flight.vx, flight.vy, emissionContacts.filter(roomContact), 2);
        if (!toy || !contact) continue;
        bind(toy, contact.p, contact.x); flights.delete(id); settled++;
      }
      return settled;
    },
    tick(at: number) {
      if (pausedAt !== undefined || !Number.isFinite(at)) return;
      for (const [id, flight] of flights) {
        const toy = objects.get(id); if (!toy) { flights.delete(id); continue; }
        if (at < flight.lastAt) continue;
        if (flight.recovery && flight.target) {
          // The original finite sampler owns this clock through layout moves.
          const pose = flight.recovery.sample(at - flight.at, flight.target);
          toy.x = pose.x; toy.y = pose.y; toy.angle = pose.rotation; flight.lastAt = at;
          if (!pose.active) { const p = platforms.find(p => p.id === flight.target!.platformId && viewportFloor(p)); if (p) { bind(toy, p, flight.target.x); flights.delete(id); } else recover(toy, at); }
          continue;
        }
        const age = clamp((at - flight.at) / 1000, 0, 2);
        const next = { x: flight.x + flight.vx * age, y: flight.y + flight.vy * age + 450 * age * age };
        const falling = next.y >= flight.previous.y, dy = next.y - flight.previous.y;
        // A chest emission is in front of the sofa and calendar, on the same
        // measured floor plane as food. Human throws retain every real ledge.
        const physical = floor;
        const swept = !flight.homeEmission && !flight.autonomousToss && falling ? platforms.filter(p => physical(p) && p.y >= flight.previous.y - .1 && p.y <= next.y + .1)
          .map(p => ({ p, t: dy > .01 ? clamp((p.y - flight.previous.y) / dy, 0, 1) : 0 }))
          .filter(({ p, t }) => { const x = flight.previous.x + (next.x - flight.previous.x) * t; return x >= p.x && x <= p.x + p.width; })
          .sort((a, b) => a.t - b.t)[0] : undefined;
        const exactContacts = flight.homeEmission ? emissionContacts : flight.autonomousToss ? platforms.filter(floor) : undefined;
        const homeLanding = exactContacts ? firstHomeContact(flight, flight.vx, flight.vy, exactContacts, age, Math.max(0, (flight.lastAt - flight.at) / 1000)) : undefined;
        const landing = homeLanding ?? (swept && { p: swept.p, x: flight.previous.x + (next.x - flight.previous.x) * swept.t });
        if (landing) { bind(toy, landing.p, landing.x); toy.angle = 0; flights.delete(id); }
        else {
          toy.x = clamp(next.x, 10, Math.max(10, width - 10)); toy.y = next.y; toy.angle = Math.sin(age * 5) * 30;
          flight.previous = { x: toy.x, y: toy.y };
          flight.lastAt = at;
          if (age >= 2 || toy.y > height - 10) recover(toy, at);
        }
      }
    },
    grab(id: string) { const toy = objects.get(id); if (pausedAt !== undefined || !toy || toy.hidden) return false; waiting.delete(id); flights.delete(id); toy.held = true; toy.carried = false; toy.platformId = undefined; toy.fraction = undefined; return true; },
    drag(id: string, point: Point) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.held || !valid(point)) return false; toy.x = clamp(point.x, 10, Math.max(10, width - 10)); toy.y = clamp(point.y, 20, Math.max(20, height - 10)); return true; },
    drop(id: string, at: number, velocity?: { x: number; y: number }) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.held || !Number.isFinite(at)) return false; release(toy, at, velocity); return true; },
    pick(id: string, point: Point) { const toy = objects.get(id); if (pausedAt !== undefined || !toy || toy.hidden || !valid(point) || toy.held || toy.carried || flights.has(id) || waiting.has(id) || Math.hypot(toy.x - point.x, toy.y - point.y) > 48) return false; toy.carried = true; toy.platformId = undefined; return true; },
    carry(id: string, point: Point) { const toy = objects.get(id); if (pausedAt !== undefined || !toy?.carried || !valid(point)) return false; toy.x = point.x; toy.y = point.y; return true; },
    put(id: string, point: Point, at: number, toss = false) {
      const toy = objects.get(id);
      if (pausedAt !== undefined || !toy?.carried || !valid(point) || !Number.isFinite(at)) return false;
      const support = platforms.find(p => p.id === point.platformId && floor(p)) ?? (toss && !point.platformId
        ? platforms.filter(p => floor(p) && point.x >= p.x && point.x <= p.x + p.width && p.y >= point.y - 2 && p.y - point.y <= 64)
          .sort((a, b) => Math.abs(a.y - point.y) - Math.abs(b.y - point.y))[0] : undefined);
      // This is the creature's placement API. Human drop/throw retains its
      // original free sweep. Reserve a short real landing before releasing a
      // carried toy, rather than throwing it from a high room to the viewport.
      if (toss && (!support || point.x < support.x || point.x > support.x + support.width || point.y > support.y + 2 || support.y - point.y > 64)) return false;
      toy.x = point.x; toy.y = point.y;
      if (toss && support) tossOntoSupport(toy, point, support, at);
      else {
        toy.carried = false;
        if (support) bind(toy, support, point.x); else release(toy, at);
      }
      return true;
    },
    nudge(id: string, point: Point, at: number) {
      const toy = objects.get(id);
      if (pausedAt !== undefined || !toy || toy.hidden || toy.held || toy.carried || flights.has(id) || waiting.has(id) || !valid(point) || !Number.isFinite(at) || Math.hypot(toy.x - point.x, toy.y - point.y) > 48) return false;
      const support = platforms.find(p => p.id === toy.platformId && floor(p));
      if (!support) return false;
      tossOntoSupport(toy, { x: toy.x, y: toy.y, platformId: support.id }, support, at, { vy: -80, dx: toy.x < point.x ? -24 : 24, speed: 120 });
      return true;
    },
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
      pausedAt = undefined; reconcile(at);
    },
    items: () => [...objects.values()].map(toy => ({ ...toy })),
    occupied: () => [...objects.values()].filter(toy => !toy.hidden && !toy.held && !toy.carried).map(toy => {
      const point = flights.get(toy.id)?.target ?? toy;
      return { x: point.x, y: point.y };
    }),
    ids: () => [...objects.keys()],
    // A route/month departure retires only the objects owned by its temporary
    // outdoor lease. It is neither a collection nor a tidying experience.
    forget: (id: string) => remove(id),
    count: () => objects.size,
    visit: (visitor: (toy: Readonly<CompanionToy>) => void) => objects.forEach(visitor),
    available: () => [...objects.values()].filter(toy => !toy.hidden && !toy.held && !toy.carried && !flights.has(toy.id) && !waiting.has(toy.id)).map(toy => ({ ...toy })),
    carried: () => [...objects.values()].find(toy => toy.carried)?.id,
    /** Read-only bounded ownership signal, never a usable landing candidate. */
    flyingIds: () => [...flights.keys()].filter(id => {
      const toy = objects.get(id); return toy && !toy.held && !toy.carried && !toy.hidden;
    }).slice(0, MAX_COMPANION_TOYS),
    moving: () => pausedAt === undefined && flights.size > 0,
    clear: () => { objects.clear(); flights.clear(); waiting.clear(); },
  };
}
export type CompanionToyBeat = { serial: number; kind: "tidy" | "play"; effect?: "pick" | "stash" | "toss" | "put" | "decline" | "spawn" | "nudge"; toyId?: string; point?: Point };
export type CompanionToyAction = CompanionAction & { toy: CompanionToyBeat };
const mealRouteProofs = new Map<string, { at: number; until: number; reachable: boolean }>();
/** Only a bounded geometric fact. It never claims ownership, ignores a real
 * cooldown or reserves an object; callers retain their own care predicates. */
export function companionMealRouteAvailable(world: CompanionWorld, preferences: CompanionPreferences, activeMs: number) {
  if (!world.foods?.length) return false;
  // New world wrappers need not re-run8 graph searches on each notice. The
  // exact source,8 food positions and current geometry invalidate immediately;
  // only route facts are cached, never hunger/permissions/owned work. Eight
  // entries expire on the existing active clock, without a timer or polling.
  const foods = world.foods.slice(0, 8), at = Number.isFinite(activeMs) ? activeMs : 0;
  const key = JSON.stringify([world.x, world.y, world.platformId, preferences.jump,
    foods.map(food => [food.id, food.kind, food.x, food.y, food.platformId]),
    world.platforms.map(p => [p.id, p.x, p.y, p.width, p.kind, p.manualOnly, p.bodyOnly])]);
  const cached = mealRouteProofs.get(key);
  if (cached && cached.at <= at && at <= cached.until) return cached.reachable;
  // A visible but unreachable snack cannot starve every real toy errand.
  const reachable = foods.some(food => food.id && valid(food) && findPlatformRoute(world, food, world.platforms, preferences.jump, food.platformId)) === true;
  mealRouteProofs.delete(key); mealRouteProofs.set(key, { at, until: at + 6000, reachable });
  if (mealRouteProofs.size > 8) mealRouteProofs.delete(mealRouteProofs.keys().next().value!);
  return reachable;
}
/** A real meal or committed care intention always keeps ownership. Shared by
 * both planning and the carried-toy continuation so neither can cut in. */
export function companionToyFoodPriority(brain: CompanionBrain, world: CompanionWorld, preferences: CompanionPreferences) {
  if (brain.foodGoal && brain.foodGoal.remaining > 0 || brain.intention && brain.intention.kind !== "explore" && brain.intention.remaining > 0
    || brain.episode && brain.episode.remaining > 0) return true;
  if (!preferences.feeding || brain.hunger < COMPANION_FULL_THRESHOLD || !world.foods?.length) return false;
  return companionMealRouteAvailable(world, preferences, brain.activeMs ?? 0);
}
export function companionToyMotivation(p: CompanionPreferences, brain: CompanionBrain, world: CompanionWorld) {
  const social = p.personality === "affectionate" && p.petting && world.pointer && (world.pointer.stableMs ?? 0) >= 900
    && Math.hypot(world.pointer.x - world.x, world.pointer.y - world.y) <= 220;
  const home = /^companion-home(?:-floor)?(?:-\d+)?$/.test(world.platformId ?? "");
  const values: Record<CompanionPreferences["personality"], { spawn: boolean; cooldown: number; play: CompanionPlay; gentle: boolean; interested: boolean }> = {
    curious: { spawn: true, cooldown: 14000, play: "pounce", gentle: false, interested: true },
    affectionate: { spawn: false, cooldown: 20000, play: "lean-nuzzle", gentle: true, interested: !social },
    sleepy: { spawn: false, cooldown: 24000, play: "groom", gentle: true, interested: brain.energy >= .55 },
    tidy: { spawn: false, cooldown: 1200, play: "groom", gentle: true, interested: true },
    mischievous: { spawn: true, cooldown: 5000, play: "pounce", gentle: false, interested: true },
    gourmet: { spawn: false, cooldown: 30000, play: "bow", gentle: true, interested: brain.hunger < .2 },
    performer: { spawn: true, cooldown: 12000, play: "celebrate", gentle: false, interested: true },
    homebody: { spawn: false, cooldown: 6000, play: "lean-nuzzle", gentle: true, interested: home },
    balanced: { spawn: true, cooldown: 6000, play: "bow", gentle: true, interested: true },
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
  type Input = { world: CompanionWorld; brain: CompanionBrain; preferences: CompanionPreferences; now: number; toys: readonly CompanionToy[]; existingIds?: readonly string[]; carriedId?: string; count: number; box?: Point; tastes?: CompanionTastes; intent?: { mode: "play" | "return" | "spawn"; targetId?: string; kinds?: readonly CompanionToyKind[]; homeFloorEntry?: boolean } };
  const eligible = (input: Input) => {
    const { world, brain, preferences: p, now } = input;
    // A picked same-ID object is already physical work, not a new leisure
    // admission. Crossing.25 during its finite return must not drop the toy
    // and repeat pickup/look loops. Emergency fatigue and all human/meal/
    // ownership guards still win; the original route budget/deadline stay.
    const carryingReturn = job?.kind === "tidy" && job.stage === "deliver" && job.toyId
      && input.carriedId === job.toyId && (!input.existingIds || input.existingIds.includes(job.toyId))
      && now < job.deadline && job.budget > 0;
    return p.enabled && p.roam && world.animated && !world.paused && Number.isFinite(now)
      && (brain.energy >= .25 || carryingReturn && brain.energy > .18) && brain.hunger < .8
      && !companionToyFoodPriority(brain, world, p) && companionToyMotivation(p, brain, world).interested;
  };
  const routeBetween = (input: Input, from: Point, target: Point) => {
    return findCompanionToyRoute(from, target, input.world.platforms, input.preferences.jump, input.intent?.homeFloorEntry === true || input.intent?.mode === "return" || input.preferences.personality === "tidy");
  };
  const returnAllowance = (input: Input, approach: NonNullable<ReturnType<typeof findPlatformRoute>>, back: NonNullable<ReturnType<typeof findPlatformRoute>>, point: Point) => {
    // A proved leg has at most12 jumps,12 takeoff walks and one final walk.
    // Reserve both real legs once; remaining budget never grows on replan.
    const steps = [...approach, ...back], maximum = (COMPANION_ROUTE_LIMITS.maxHops * 2 + 1) * 2;
    const speed = getCompanionBehaviorProfile(input.preferences, input.brain.habits).walkSpeed;
    let previous = input.world, elapsed = 0;
    for (let index = 0; index < steps.length; index++) {
      if (index === approach.length) previous = { ...input.world, ...point };
      const step = steps[index], dy = step.target.y - previous.y;
      // The renderer replaces a jump's placeholder900ms with this existing
      // physical flight plus anticipation/landing. Include its decision gap.
      const { gravity, maxRise } = COMPANION_JUMP_LIMITS;
      const rise = "jumpHeight" in step && typeof step.jumpHeight === "number" ? step.jumpHeight : maxRise, impulse = Math.sqrt(2 * gravity * rise);
      elapsed += step.kind === "jump" ? COMPANION_TIMING.jumpAnticipation + COMPANION_TIMING.jumpLanding
        + (impulse + Math.sqrt(Math.max(0, impulse * impulse + 2 * gravity * dy))) / gravity * 1000
        : Math.max(220, Math.abs(step.target.x - previous.x) / speed * 1000);
      elapsed += 350; previous = { ...input.world, ...step.target };
    }
    return { budget: Math.max(18, Math.min(maximum + 4, steps.length + 4)), deadline: input.now + Math.min(60000, Math.max(30000, elapsed * 1.25 + 3000)) };
  };
  const preference = (input: Input, toy: CompanionToy) => {
    if (input.preferences.personality === "tidy") return 0;
    const favorites: Record<CompanionPreferences["personality"], readonly CompanionToyKind[]> = { curious: ["paper-plane", "pinwheel", "feather", "spinning-top", "kaleidoscope", "toy-rocket"], affectionate: ["spool", "bell", "duck", "plush-fish", "ribbon-ball"], sleepy: ["spool", "feather", "plush-fish", "rocking-horse"], tidy: [], mischievous: ["ball", "blocks", "hoop", "toy-car", "dice", "squeaky-carrot", "ribbon-ball"], gourmet: ["bell", "spool", "duck", "squeaky-carrot"], performer: ["pinwheel", "bell", "hoop", "star-wand", "tambourine", "maraca", "yo-yo", "toy-rocket"], homebody: ["blocks", "spool", "train", "rocking-horse", "stacking-rings", "kaleidoscope"], balanced: [] };
    const species = input.preferences.animalMode === "dog" && ["ball", "squeaky-carrot", "plush-fish"].includes(toy.kind) || input.preferences.animalMode === "cat" && ["feather", "spool", "ribbon-ball", "plush-fish"].includes(toy.kind);
    const learned = input.preferences.learnFromYou !== false ? clamp(input.tastes?.toyTastes[toy.kind]?.score ?? 0, -1, 1) : 0;
    return (Number(favorites[input.preferences.personality].includes(toy.kind)) * .4 + Number(species) * .2 + learned * .6) * 120;
  };
  const candidates = (input: Input) => input.toys.filter(toy => toy.platformId && !toy.hidden && !toy.held && !toy.carried && valid(toy)
    && (!input.intent?.targetId || toy.id === input.intent.targetId) && (!input.intent?.kinds?.length || input.intent.kinds.includes(toy.kind))
    && (failed.get(toy.id) ?? -Infinity) <= input.now).slice(0, MAX_COMPANION_TOYS)
    .sort((a, b) => Math.hypot(a.x - input.world.x, a.y - input.world.y) - preference(input, a) - Math.hypot(b.x - input.world.x, b.y - input.world.y) + preference(input, b));
  return {
    // Ordinary action replacement also calls cancel. An inactive planner must
    // not postpone its first admission on every short idle/look forever.
    cancel(now: number) { if (job) stop(now, 1500); },
    wake(now: number, immediate = false) { noticed.clear(); readyAt = Math.min(readyAt, now + (immediate ? 0 : 250)); },
    returnCarried(toyId: string, now: number) {
      job = { serial: ++serial, kind: "tidy", stage: "deliver", toyId, deadline: now + 30000, budget: 24, play: "groom", gentle: true, cooldown: 1000 };
      readyAt = now;
    },
    notice(input: Input & { action: (CompanionAction & { scene?: { id: number }; toy?: unknown; household?: unknown; radio?: unknown }) | null; active: boolean; grounded: boolean; held?: boolean; commanded?: boolean; busy?: boolean }) {
      const { action, now, preferences: p } = input;
      if (job || !input.active || !input.grounded || input.held || input.commanded || input.busy
        || !action || !["idle", "look", "walk"].includes(action.kind) || action.toy || action.household || action.radio || action.accessory || action.living
        || action.scene && ![31, 32, 33, 35].includes(action.scene.id) || p.personality === "tidy" && !input.box || !eligible(input)) return false;
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
      if (!eligible(input) || p.personality === "tidy" && !box) { if (job) stop(now, 1000); return; }
      const here = { x: world.x, y: world.y, platformId: world.platformId };
      const routeTo = (target: Point) => routeBetween(input, here, target);
      let preparedRoute: ReturnType<typeof findPlatformRoute> | undefined;
      let preparedReturn: ReturnType<typeof findPlatformRoute> | undefined;
      if (job && (now >= job.deadline || job.budget <= 0 || job.stage === "deliver" && "carriedId" in input && input.carriedId !== job.toyId)) fail(now);
      const continuation = job?.kind === "tidy" && job.stage === "seek" && !job.toyId;
      if (!job || continuation) {
        if (!continuation && now < readyAt) return;
        const tidy = p.personality === "tidy", motivation = companionToyMotivation(p, brain, world);
        // At most four real objects: an unreachable nearest toy cannot hide
        // another reachable one. Reuse its proved first route in this beat.
        const target = input.intent?.mode === "spawn" ? undefined : candidates(input).find(toy => {
          const route = routeTo(toy.stance ?? toy), back = tidy ? routeBetween(input, toy.stance ?? toy, box!) : undefined;
          if (!route || tidy && !back) { rememberFailure(toy.id, now); return false; }
          preparedRoute = route; preparedReturn = back; return true;
        });
        if (target) job = { serial: ++serial, kind: tidy ? "tidy" : "play", stage: input.tastes && shouldDeclineCompanionToy(target.kind, input.tastes, p, brain) ? "decline" : "seek", toyId: target.id,
          ...(tidy && preparedRoute && preparedReturn ? returnAllowance(input, preparedRoute, preparedReturn, target.stance ?? target) : { deadline: now + 30_000, budget: 18 }), ...motivation };
        else if ((!input.intent || input.intent.mode === "spawn") && motivation.spawn && box && input.count < MAX_COMPANION_TOYS && p.ambientPrank) job = { serial: ++serial, kind: "play", stage: "box", deadline: now + 25_000, budget: 16, ...motivation };
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
      return { kind: "sniff", target: here, duration: current.stage === "box" ? 900 : 600, toy: { serial: current.serial, kind: current.kind, effect: current.stage === "box" ? "spawn" : current.stage === "deliver" ? "stash" : "pick", toyId: current.toyId, point: here } };
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

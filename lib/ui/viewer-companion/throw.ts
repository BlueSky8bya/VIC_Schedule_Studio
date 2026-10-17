import type { Platform } from "./brain";

export type CompanionThrowPoint = Readonly<{ x: number; y: number }>;
export type CompanionThrowVelocity = Readonly<{ vx: number; vy: number }>;
/** Horizontal character-centre and vertical foot bounds, in CSS pixels. */
export type CompanionThrowBounds = Readonly<{ left: number; right: number; top: number; bottom: number }>;
export type CompanionThrowState = Readonly<CompanionThrowPoint & CompanionThrowVelocity & {
  elapsedMs: number;
  done: boolean;
  expired: boolean;
}>;
export type CompanionThrowContact = Readonly<CompanionThrowPoint & { platformId: string }>;
export type CompanionThrowStep = Readonly<{ state: CompanionThrowState; contact?: CompanionThrowContact }>;

export const COMPANION_THROW_LIMITS = Object.freeze({
  gravity: 1100, maxVelocityX: 1100, maxVelocityY: 950, maxFlightMs: 3000,
  velocityWindowMs: 80, staleInputMs: 80, minSampleSpanMs: 24, minSpeed: 120,
  maxSamples: 64, maxPlatforms: 200,
});

type TimedPoint = { x: number; y: number; at: number };
const zero = (): CompanionThrowVelocity => ({ vx: 0, vy: 0 });
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const validPoint = (x: number, y: number, at: number) => [x, y, at].every(Number.isFinite) && at >= 0;
const epsilon = 1e-8;

/** Only actual clamped body points enter this bounded, input-owned history.
 * A still release includes the real stationary tail; stale, same-time and
 * insufficient observations cannot manufacture an impulse. Release consumes
 * the history, so cancellation/new input cannot reuse an earlier throw. */
export function createCompanionThrowVelocity() {
  let points: TimedPoint[] = [];
  const reset = () => { points = []; };
  return {
    begin(x: number, y: number, now: number): void {
      reset();
      if (validPoint(x, y, now)) points.push({ x, y, at: now });
    },
    push(x: number, y: number, now: number): void {
      if (!validPoint(x, y, now)) { reset(); return; }
      const last = points.at(-1);
      if (last && now <= last.at) return;
      if (last && now - last.at > COMPANION_THROW_LIMITS.staleInputMs) reset();
      points.push({ x, y, at: now });
      const cutoff = now - COMPANION_THROW_LIMITS.velocityWindowMs;
      // Retain one point before the window for exact boundary interpolation.
      while (points.length > 2 && points[1].at <= cutoff) points.shift();
      if (points.length > COMPANION_THROW_LIMITS.maxSamples) points.shift();
    },
    release(now: number): CompanionThrowVelocity {
      const history = points; reset();
      const last = history.at(-1), first = history[0];
      if (!last || !first || !Number.isFinite(now) || now < last.at || now - last.at > COMPANION_THROW_LIMITS.staleInputMs) return zero();
      const cutoff = Math.max(first.at, now - COMPANION_THROW_LIMITS.velocityWindowMs);
      const span = now - cutoff;
      if (span < COMPANION_THROW_LIMITS.minSampleSpanMs) return zero();
      let start = first;
      for (let i = 1; i < history.length; i++) {
        const next = history[i];
        if (next.at >= cutoff) {
          const p = (cutoff - start.at) / (next.at - start.at);
          start = { x: start.x + (next.x - start.x) * p, y: start.y + (next.y - start.y) * p, at: cutoff };
          break;
        }
        start = next;
      }
      const vx = (last.x - start.x) / span * 1000, vy = (last.y - start.y) / span * 1000;
      if (![vx, vy].every(Number.isFinite) || Math.hypot(vx, vy) < COMPANION_THROW_LIMITS.minSpeed) return zero();
      return { vx: clamp(vx, -COMPANION_THROW_LIMITS.maxVelocityX, COMPANION_THROW_LIMITS.maxVelocityX), vy: clamp(vy, -COMPANION_THROW_LIMITS.maxVelocityY, COMPANION_THROW_LIMITS.maxVelocityY) };
    },
    reset,
  };
}

function validBounds(bounds: CompanionThrowBounds): boolean {
  return [bounds.left, bounds.right, bounds.top, bounds.bottom].every(Number.isFinite)
    && bounds.right > bounds.left && bounds.bottom > bounds.top;
}

function within(point: CompanionThrowPoint, bounds: CompanionThrowBounds): boolean {
  return point.x >= bounds.left && point.x <= bounds.right && point.y >= bounds.top && point.y <= bounds.bottom;
}

export function createCompanionThrow(point: CompanionThrowPoint, velocity: CompanionThrowVelocity, bounds: CompanionThrowBounds): CompanionThrowState | undefined {
  if (![point.x, point.y, velocity.vx, velocity.vy].every(Number.isFinite) || !validBounds(bounds) || !within(point, bounds)) return;
  return { x: point.x, y: point.y, vx: clamp(velocity.vx, -COMPANION_THROW_LIMITS.maxVelocityX, COMPANION_THROW_LIMITS.maxVelocityX), vy: clamp(velocity.vy, -COMPANION_THROW_LIMITS.maxVelocityY, COMPANION_THROW_LIMITS.maxVelocityY), elapsedMs: 0, done: false, expired: false };
}

/** Time of the downward crossing of a horizontal line. The other root is an
 * upward passage and must never land on a ledge's underside. */
function downTime(y: number, vy: number, line: number): number | undefined {
  const discriminant = vy * vy + 2 * COMPANION_THROW_LIMITS.gravity * (line - y);
  if (!Number.isFinite(discriminant) || discriminant < 0) return;
  const time = (-vy + Math.sqrt(discriminant)) / COMPANION_THROW_LIMITS.gravity;
  return Number.isFinite(time) && time >= -epsilon ? Math.max(0, time) : undefined;
}

/** Numeric events only; no DOM, clock, timer or second animation owner. Each
 * segment solves every descending support intersection before advancing.
 * Walls/ceiling consume their exact collision time and cancel only that axis;
 * the remaining interval then follows a new parabola. At most one horizontal
 * wall and one ceiling can stop a non-bouncing flight. The bottom bound expires
 * a missed drop; it is never promoted to an invented landing platform. */
export function stepCompanionThrow(previous: CompanionThrowState, deltaMs: number, platforms: readonly Platform[], bounds: CompanionThrowBounds): CompanionThrowStep {
  if (previous.done) return { state: previous };
  const finite = [previous.x, previous.y, previous.vx, previous.vy, previous.elapsedMs].every(Number.isFinite);
  if (!finite || !validBounds(bounds) || !within(previous, bounds) || previous.elapsedMs < 0 || platforms.length > COMPANION_THROW_LIMITS.maxPlatforms) {
    return { state: { x: Number.isFinite(previous.x) ? previous.x : 0, y: Number.isFinite(previous.y) ? previous.y : 0, vx: 0, vy: 0, elapsedMs: Number.isFinite(previous.elapsedMs) ? previous.elapsedMs : 0, done: true, expired: true } };
  }
  if (!Number.isFinite(deltaMs) || deltaMs <= 0) return { state: previous };
  const lifetime = Math.max(0, COMPANION_THROW_LIMITS.maxFlightMs - previous.elapsedMs);
  let remaining = Math.min(deltaMs, lifetime) / 1000;
  let { x, y, elapsedMs } = previous;
  let vx = clamp(previous.vx, -COMPANION_THROW_LIMITS.maxVelocityX, COMPANION_THROW_LIMITS.maxVelocityX), vy = previous.vy;
  if (!remaining) return { state: { x, y, vx: 0, vy: 0, elapsedMs, done: true, expired: true } };
  type Event = { kind: "end" | "wall" | "ceiling" | "bottom"; at: number; value?: number } | { kind: "support"; at: number; platform: Platform };
  // This fixed event bound is independent of frame duration/input frequency.
  for (let events = 0; events < 4 && remaining > 0; events++) {
    let event: Event = { kind: "end", at: remaining };
    for (const platform of platforms) {
      const right = platform.x + platform.width;
      if (!platform.id || ![platform.x, platform.y, platform.width, right].every(Number.isFinite) || platform.width <= 0
        || platform.y < bounds.top || platform.y > bounds.bottom) continue;
      const at = downTime(y, vy, platform.y);
      if (at === undefined || at > remaining + epsilon) continue;
      const hitX = x + vx * at;
      if (!Number.isFinite(hitX) || hitX < platform.x - epsilon || hitX > right + epsilon || hitX < bounds.left - epsilon || hitX > bounds.right + epsilon) continue;
      const earlier = at < event.at - epsilon;
      const tied = Math.abs(at - event.at) <= epsilon;
      const preferred = event.kind !== "support" || platform.kind !== "floor" && event.platform.kind === "floor"
        || (platform.kind === "floor") === (event.platform.kind === "floor") && platform.id < event.platform.id;
      if (earlier || tied && preferred) event = { kind: "support", at, platform };
    }
    const wall = vx < 0 ? { at: (bounds.left - x) / vx, value: bounds.left } : vx > 0 ? { at: (bounds.right - x) / vx, value: bounds.right } : undefined;
    if (wall && wall.at >= -epsilon && (wall.at < event.at - epsilon || event.kind === "end" && wall.at <= event.at + epsilon)) event = { kind: "wall", at: Math.max(0, wall.at), value: wall.value };
    let ceiling: number | undefined;
    if (vy < 0) {
      const discriminant = vy * vy + 2 * COMPANION_THROW_LIMITS.gravity * (bounds.top - y);
      if (discriminant >= 0) {
        const at = (-vy - Math.sqrt(discriminant)) / COMPANION_THROW_LIMITS.gravity;
        if (at >= -epsilon) ceiling = Math.max(0, at);
        if (at >= -epsilon && (at < event.at - epsilon || event.kind === "end" && at <= event.at + epsilon)) event = { kind: "ceiling", at: Math.max(0, at), value: bounds.top };
      }
    }
    const bottom = downTime(y, vy, bounds.bottom);
    if (bottom !== undefined && (bottom < event.at - epsilon || event.kind === "end" && bottom <= event.at + epsilon)) event = { kind: "bottom", at: bottom };
    // A support within epsilon of this interval's end is still the same
    // contact; never advance farther than the caller's actual elapsed time.
    const time = Math.min(remaining, event.at);
    x += vx * time; y += vy * time + .5 * COMPANION_THROW_LIMITS.gravity * time * time;
    vy += COMPANION_THROW_LIMITS.gravity * time; elapsedMs += time * 1000; remaining = Math.max(0, remaining - time);
    if (event.kind === "support") {
      const contact = { x, y: event.platform.y, platformId: event.platform.id };
      return { state: { x, y: contact.y, vx: 0, vy: 0, elapsedMs, done: true, expired: false }, contact };
    }
    // Resolve every boundary at this instant, including an exact frame-end
    // corner. Zero remaining time must not postpone the second axis/expiry.
    if (bottom !== undefined && Math.abs(bottom - time) <= epsilon) return { state: { x, y: bounds.bottom, vx: 0, vy: 0, elapsedMs, done: true, expired: true } };
    const hitWall = wall && Math.abs(wall.at - time) <= epsilon;
    const hitCeiling = ceiling !== undefined && Math.abs(ceiling - time) <= epsilon;
    if (hitWall) { x = wall.value; vx = 0; }
    if (hitCeiling) { y = bounds.top; vy = 0; }
    if (!hitWall && !hitCeiling) break;
  }
  const expired = previous.elapsedMs + deltaMs >= COMPANION_THROW_LIMITS.maxFlightMs || remaining > epsilon;
  return { state: { x, y, vx: expired ? 0 : vx, vy: expired ? 0 : vy, elapsedMs: Math.min(elapsedMs, COMPANION_THROW_LIMITS.maxFlightMs), done: expired, expired } };
}

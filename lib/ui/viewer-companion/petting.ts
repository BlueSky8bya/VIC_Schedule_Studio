/** A mouse resting on the head is not a stroke. One deliberate out-and-back
 * establishes intent; rewards require a reversal and retain their own budget. */
export function createCompanionPettingGesture() {
  let lastAt = -Infinity, movedAt = -Infinity, anchor = { x: 0, y: 0 }, axis: "x" | "y" | undefined, direction = 0, reversals = 0, lastReward = -Infinity;
  const reset = () => { lastAt = movedAt = -Infinity; anchor = { x: 0, y: 0 }; axis = undefined; direction = 0; reversals = 0; };
  return {
    reset,
    sample(x: number, now: number, y = 0) {
      if (![x, y, now].every(Number.isFinite)) { reset(); return { stroking: false, reward: false }; }
      if (now < lastAt || now - movedAt >= 900) { reset(); anchor = { x, y }; movedAt = lastAt = now; return { stroking: false, reward: false }; }
      lastAt = now;
      const point = { x, y }, dx = x - anchor.x, dy = y - anchor.y;
      // A vertical or diagonal pass can establish intent too. Retain its first
      // meaningful axis, so turning a corner is not mistaken for a reversal.
      if (!axis && Math.max(Math.abs(dx), Math.abs(dy)) + Number.EPSILON >= .10) axis = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      const delta = axis ? point[axis] - anchor[axis] : 0;
      const moved = Math.abs(delta) + Number.EPSILON >= .10;
      let reversed = false;
      if (moved) {
        const next = Math.sign(delta);
        if (direction && direction !== next) { reversals++; reversed = true; }
        direction = next; anchor = point; movedAt = now;
      }
      const stroking = moved && reversals >= 1, reward = stroking && reversed && now - lastReward >= 4000;
      if (reward) lastReward = now;
      return { stroking, reward };
    },
  };
}

export type CompanionPettingPoint = { x: number; y: number };
export type CompanionPettingRect = { left: number; right: number; top: number; bottom: number };

/** Coordinates use one displayed body size as a unit. The caller owns the
 * base rectangle and all control/focus/pause gates. This passive retention
 * never enlarges a hitbox and never creates a clock or an animation loop. */
export function createCompanionPettingWindow() {
  const margin = .30, threshold = .076, idle = 900;
  let anchor: CompanionPettingPoint | undefined, armed = false, movedAt = -Infinity, lastAt = -Infinity;
  const reset = () => { anchor = undefined; armed = false; movedAt = lastAt = -Infinity; };
  const valid = (p: CompanionPettingPoint, base: CompanionPettingRect, now: number) => [p.x, p.y, base.left, base.right, base.top, base.bottom, now].every(Number.isFinite) && base.left < base.right && base.top < base.bottom;
  const inside = (p: CompanionPettingPoint, base: CompanionPettingRect, extra = 0) => p.x >= base.left - extra && p.x <= base.right + extra && p.y >= base.top - extra && p.y <= base.bottom + extra;
  return {
    reset,
    /** Read-only, including repeated paints at an identical timestamp. Base
     * membership allows a fresh hover; only real movement arms the extension. */
    contains(p: CompanionPettingPoint, base: CompanionPettingRect, now: number) {
      return valid(p, base, now) && now >= lastAt && (inside(p, base) || Boolean(anchor && armed && now - movedAt < idle && inside(p, base, margin)));
    },
    move(p: CompanionPettingPoint, base: CompanionPettingRect, now: number) {
      if (!valid(p, base, now) || now < lastAt) { reset(); return false; }
      const inBase = inside(p, base);
      if (!anchor) {
        if (!inBase) return false;
        anchor = { ...p }; lastAt = now; return true;
      }
      // An expired excursion cannot revive itself from outside. Re-entering
      // the base starts a new pass; stationary/jitter samples never renew it.
      if (armed && now - movedAt >= idle) {
        reset();
        if (!inBase) return false;
        anchor = { ...p }; lastAt = now; return true;
      }
      if (!inside(p, base, margin)) { reset(); return false; }
      const moved = Math.hypot(p.x - anchor.x, p.y - anchor.y) + Number.EPSILON >= threshold;
      if (moved) { armed = true; movedAt = now; anchor = { ...p }; }
      if (!inBase && !armed) { reset(); return false; }
      lastAt = now; return true;
    },
  };
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
/** A tiny visual contact response, separate from intent/affection rewards.
 * The first real pass responds; release decays analytically with no own loop.
 * Only the pose changes: calendar coordinates, heading and support stay owned
 * by the existing renderer. Values are normalized to the displayed body. */
export function createCompanionPettingContact() {
  let previousX = .5, previousAt = -Infinity, movedAt = -Infinity, direction = 0, force = 0, at = .5;
  const reset = () => { previousAt = movedAt = -Infinity; direction = force = 0; at = .5; };
  return {
    reset,
    move(position: number, now: number) {
      if (!Number.isFinite(position) || !Number.isFinite(now) || now < previousAt) { reset(); return false; }
      const x = clamp(position, 0, 1), delta = x - previousX;
      if (now - previousAt > 550) { previousX = x; previousAt = now; return false; }
      const elapsed = Math.max(8, now - previousAt);
      previousX = x; previousAt = now;
      if (Math.abs(delta) < .008) return false;
      direction = Math.sign(delta); at = x;
      force = clamp(Math.abs(delta) / elapsed * 180, .12, 1);
      movedAt = now;
      return true;
    },
    sample(now: number, reduced = false) {
      const age = now - movedAt;
      const envelope = Number.isFinite(now) && age >= 0 && age < 550 ? (1 - age / 550) ** 2 : 0;
      const pressure = force * envelope * (reduced ? .2 : 1);
      if (!pressure) return { x: 0, y: 0, tilt: 0, squash: 0, pressure: 0 };
      return { x: reduced ? 0 : (at - .5) * pressure * 1.6, y: pressure * 1.6, tilt: reduced ? 0 : direction * pressure * 2.4, squash: pressure * .035, pressure };
    },
  };
}

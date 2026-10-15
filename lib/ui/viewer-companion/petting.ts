/** A mouse resting on the head is not a stroke. Two deliberate horizontal
 * reversals establish intent; rewards are bounded independently of animation. */
export function createCompanionPettingGesture() {
  let lastAt = -Infinity, movedAt = -Infinity, anchor = 0, direction = 0, reversals = 0, lastReward = -Infinity;
  const reset = () => { lastAt = movedAt = -Infinity; anchor = 0; direction = 0; reversals = 0; };
  return {
    reset,
    sample(x: number, now: number) {
      if (!Number.isFinite(x) || !Number.isFinite(now)) { reset(); return { stroking: false, reward: false }; }
      if (now < lastAt || now - movedAt > 550) { reset(); anchor = x; movedAt = lastAt = now; return { stroking: false, reward: false }; }
      lastAt = now;
      const delta = x - anchor;
      const moved = Math.abs(delta) >= .16;
      if (moved) {
        const next = Math.sign(delta);
        if (direction && direction !== next) reversals++;
        direction = next; anchor = x; movedAt = now;
      }
      const stroking = moved && reversals >= 2, reward = stroking && now - lastReward >= 4000;
      if (reward) lastReward = now;
      return { stroking, reward };
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
      const envelope = Number.isFinite(now) && age >= 0 && age < 420 ? (1 - age / 420) ** 2 : 0;
      const pressure = force * envelope * (reduced ? .2 : 1);
      if (!pressure) return { x: 0, y: 0, tilt: 0, squash: 0, pressure: 0 };
      return { x: reduced ? 0 : (at - .5) * pressure * 1.6, y: pressure * 1.6, tilt: reduced ? 0 : direction * pressure * 2.4, squash: pressure * .035, pressure };
    },
  };
}

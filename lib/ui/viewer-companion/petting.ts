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

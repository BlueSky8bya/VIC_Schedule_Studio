import { describe, expect, it } from "vitest";
import { boundCompanionHeldPose, createCompanionHeldInertia } from "@/lib/ui/viewer-companion/held-inertia";

describe("captured companion inertia", () => {
  it("lags a rightward impulse, crosses back, then becomes exactly still", () => {
    const motion = createCompanionHeldInertia();
    motion.push(40, 0, 100);
    expect(motion.sample(100).tilt).toBe(0);
    const lag = motion.sample(160).tilt;
    expect(lag).toBeGreaterThan(3);
    // A body point below the grip must stay behind a right-moving hand in
    // CSS's downward-y coordinates, not merely have a nonzero angle.
    expect(-20 * Math.sin(lag * Math.PI / 180)).toBeLessThan(0);
    expect(motion.sample(420).tilt).toBeLessThan(-.5);
    expect(motion.sample(1600)).toEqual({ tilt: 0, stretch: 0, active: false });
  });
  it("stretches on an upward tug and compresses on a downward tug", () => {
    const up = createCompanionHeldInertia(), down = createCompanionHeldInertia();
    up.push(0, -40, 0); down.push(0, 40, 0);
    expect(up.sample(70).stretch).toBeGreaterThan(.01);
    expect(down.sample(70).stretch).toBeLessThan(-.01);
  });
  it("preserves current position on reversal, including an interrupted fade", () => {
    const motion = createCompanionHeldInertia();
    motion.push(40, -20, 0);
    const before = motion.sample(1070);
    motion.push(-40, 20, 1070);
    expect(motion.sample(1070)).toEqual(before);
    expect(motion.sample(1130).tilt).toBeLessThan(-3);
  });
  it("gives the same trajectory at60Hz/120Hz and never advances at the same timestamp", () => {
    const atRate = (rate: number) => {
      const motion = createCompanionHeldInertia(), results: unknown[] = [];
      for (let tick = 0; tick <= rate * 2; tick++) {
        const now = tick / rate * 1000;
        if (tick % (rate / 10) === 0 && now <= 500) motion.push(tick % (rate / 5) === 0 ? 25 : -25, -4, now);
        const result = motion.sample(now);
        expect(motion.sample(now)).toEqual(result);
        if (tick % (rate / 10) === 0) results.push(result);
      }
      return results;
    };
    expect(atRate(60)).toEqual(atRate(120));
  });
  it("bounds bursts, ignores invalid input, and cannot prolong a tail with zero input", () => {
    const motion = createCompanionHeldInertia();
    motion.push(NaN, 10, 0); motion.push(10, 10, NaN);
    expect(motion.sample(0).active).toBe(false);
    for (let i = 0; i < 100; i++) motion.push(1e9, -1e9, 10);
    const pose = motion.sample(80);
    expect(Math.abs(pose.tilt)).toBeLessThanOrEqual(18);
    expect(Math.abs(pose.stretch)).toBeLessThanOrEqual(.085);
    expect(motion.sample(0)).toEqual(pose);
    motion.push(0, 0, 1499);
    expect(motion.sample(1510)).toEqual({ tilt: 0, stretch: 0, active: false });
    motion.push(20, 20, 1600); motion.reset();
    expect(motion.sample(1601)).toEqual({ tilt: 0, stretch: 0, active: false });
  });
  it("leaves a central grip unchanged and bounds all four corners at every edge", () => {
    const pose = { tilt: 18, stretch: .085, active: true }, viewport = { width: 390, height: 844 }, size = 92;
    expect(boundCompanionHeldPose(pose, { x: 150, y: 250 }, { x: 46, y: 35 }, size, viewport)).toEqual(pose);
    for (const x of [4, 294]) for (const y of [8, 740]) for (const gx of [8, 78]) for (const tilt of [-18, 18]) {
      const grip = { x: gx, y: 20 }, origin = { x, y };
      const bound = boundCompanionHeldPose({ ...pose, tilt }, origin, grip, size, viewport);
      const a = bound.tilt * Math.PI / 180, sy = 1 + bound.stretch, sx = 1 / sy;
      expect(sx * sy).toBeCloseTo(1, 12);
      for (const cx of [0, size]) for (const cy of [0, size]) {
        const dx = (cx - grip.x) * sx, dy = (cy - grip.y) * sy;
        const px = x + grip.x + dx * Math.cos(a) - dy * Math.sin(a), py = y + grip.y + dx * Math.sin(a) + dy * Math.cos(a);
        expect(px).toBeGreaterThanOrEqual(2); expect(px).toBeLessThanOrEqual(viewport.width - 2);
        expect(py).toBeGreaterThanOrEqual(2); expect(py).toBeLessThanOrEqual(viewport.height - 2);
      }
    }
  });
});

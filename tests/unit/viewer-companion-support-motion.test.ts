import { describe, expect, it } from "vitest";
import { createCompanionSupportMotion, type CompanionSupportPose } from "@/lib/ui/viewer-companion/support-motion";

const quiet: CompanionSupportPose = { lift: 0, squash: 0, active: false };
const expectBounded = (pose: CompanionSupportPose) => {
  expect(Number.isFinite(pose.lift)).toBe(true);
  expect(Number.isFinite(pose.squash)).toBe(true);
  expect(pose.lift).toBeGreaterThanOrEqual(-14);
  expect(pose.lift).toBeLessThanOrEqual(0);
  expect(pose.squash).toBeGreaterThanOrEqual(0);
  expect(pose.squash).toBeLessThanOrEqual(.1);
};

describe("companion decorative support motion", () => {
  it("stays quiet without a nonzero scroll delta", () => {
    const motion = createCompanionSupportMotion();
    motion.push(0, 0); motion.push(-0, 100);
    expect(motion.sample(0)).toEqual(quiet);
    expect(motion.sample(1000)).toEqual(quiet);
  });

  it("lifts for an upward-moving anchor and compresses for a downward-moving anchor", () => {
    const lift = createCompanionSupportMotion(), squash = createCompanionSupportMotion();
    lift.push(-24, 0); squash.push(24, 0);
    expect(lift.sample(0)).toEqual({ ...quiet, active: true });
    expect(lift.sample(80).lift).toBeLessThan(-4);
    expect(lift.sample(80).squash).toBe(0);
    expect(squash.sample(80).lift).toBe(0);
    expect(squash.sample(80).squash).toBeGreaterThan(.02);
  });

  it("bounds extreme and repeated impulses in either direction", () => {
    const motion = createCompanionSupportMotion();
    for (let now = 0; now < 3000; now += 8) {
      motion.push(now % 16 ? Number.MAX_VALUE : -Number.MAX_VALUE, now);
      expectBounded(motion.sample(now)); expectBounded(motion.sample(now + 4));
    }
    expect(motion.sample(4000)).toEqual(quiet);
  });

  it("interrupts at the current position instead of restarting from rest", () => {
    const motion = createCompanionSupportMotion();
    motion.push(-30, 0);
    const before = motion.sample(120);
    motion.push(-12, 120);
    expect(motion.sample(120)).toEqual(before);
    expect(motion.sample(140).lift).toBeLessThan(before.lift);
    const lifted = motion.sample(160);
    motion.push(18, 160);
    expect(motion.sample(160)).toEqual(lifted);
    const both = motion.sample(190);
    expect(both.lift).toBeLessThan(0); expect(both.squash).toBeGreaterThan(0);
  });

  it("carries the other channel's velocity through interruption, including during the finite fade", () => {
    for (const at of [120, 650, 820]) {
      const motion = createCompanionSupportMotion(), reference = createCompanionSupportMotion();
      motion.push(-32, 0); reference.push(-32, 0);
      const before = motion.sample(at);
      motion.push(12, at);
      expect(motion.sample(at).lift).toBeCloseTo(before.lift, 12);
      // The new compression must not alter the lift's instantaneous velocity.
      const dt = .001;
      const velocity = (motion.sample(at + dt).lift - before.lift) / dt;
      const referenceBefore = reference.sample(at).lift;
      const expected = (reference.sample(at + dt).lift - referenceBefore) / dt;
      expect(velocity).toBeCloseTo(expected, 6);
    }
  });

  it("does not integrate twice when push and sample share a timestamp", () => {
    const motion = createCompanionSupportMotion(), reference = createCompanionSupportMotion();
    motion.push(-20, 0); reference.push(-20, 0);
    const first = motion.sample(80);
    for (let i = 0; i < 10; i++) expect(motion.sample(80)).toEqual(first);
    motion.push(6, 80); reference.push(6, 80);
    expect(motion.sample(80)).toEqual(first);
    expect(motion.sample(140)).toEqual(reference.sample(140));
  });

  it("adds separate same-clock impulses without consuming another time step", () => {
    const split = createCompanionSupportMotion(), whole = createCompanionSupportMotion();
    split.push(-20, 0); whole.push(-20, 0);
    split.sample(120);
    split.push(-6, 120); split.sample(120); split.push(-6, 120);
    whole.push(-12, 120);
    expect(split.sample(120)).toEqual(whole.sample(120));
    expect(split.sample(240)).toEqual(whole.sample(240));
  });

  it("produces the same trajectory at60Hz,120Hz and sparse sampling", () => {
    const run = (hz: number) => {
      const motion = createCompanionSupportMotion();
      motion.push(-28, 0);
      for (let i = 1; i < hz / 2; i++) motion.sample(i * 1000 / hz);
      motion.push(20, 500);
      for (let i = 1; i < hz / 2; i++) motion.sample(500 + i * 1000 / hz);
      return motion.sample(1000);
    };
    const sparse = createCompanionSupportMotion(); sparse.push(-28, 0); sparse.push(20, 500);
    expect(run(60)).toEqual(run(120));
    expect(run(60)).toEqual(sparse.sample(1000));
  });

  it("reaches exact rest by900ms after the last nonzero input", () => {
    const motion = createCompanionSupportMotion();
    motion.push(-120, 0); motion.push(80, 100);
    expect(motion.sample(950).active).toBe(true);
    const nearEnd = motion.sample(999);
    expect(Math.abs(nearEnd.lift)).toBeLessThan(.000001);
    expect(nearEnd.squash).toBeLessThan(.000001);
    expect(motion.sample(1000)).toEqual(quiet);
    expect(motion.sample(10000)).toEqual(quiet);
  });

  it("does not extend an existing tail for zero or invalid input", () => {
    const motion = createCompanionSupportMotion(); motion.push(-20, 0);
    motion.push(0, 800); motion.push(NaN, 850); motion.push(Infinity, 860); motion.push(-Infinity, 870);
    expect(motion.sample(900)).toEqual(quiet);
  });

  it("discards a hidden-tab time gap and accepts a fresh input without replay", () => {
    const motion = createCompanionSupportMotion(); motion.push(-30, 100);
    expect(motion.sample(10_000_000)).toEqual(quiet);
    motion.push(20, 10_000_000);
    expect(motion.sample(10_000_000)).toEqual({ ...quiet, active: true });
    expect(motion.sample(10_000_080).squash).toBeGreaterThan(0);
    expect(motion.sample(10_000_080).lift).toBe(0);
  });

  it("ignores invalid clocks, clamps backwards clocks, and can explicitly rebase on reset", () => {
    const motion = createCompanionSupportMotion();
    motion.push(-20, NaN); motion.push(20, Infinity);
    expect(motion.sample(0)).toEqual(quiet);
    motion.push(-20, 0);
    const before = motion.sample(100);
    expect(motion.sample(NaN)).toEqual(quiet); expect(motion.sample(Infinity)).toEqual(quiet);
    expect(motion.sample(90)).toEqual(before);
    motion.reset(0); expect(motion.sample(0)).toEqual(quiet);
    motion.push(20, 0); expect(motion.sample(60).squash).toBeGreaterThan(0);
    motion.reset(); expect(motion.sample(0)).toEqual(quiet);
    motion.reset(NaN); expect(motion.sample(0)).toEqual(quiet);
  });
});

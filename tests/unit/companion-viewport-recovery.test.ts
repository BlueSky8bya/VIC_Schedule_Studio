import { describe, expect, it } from "vitest";
import { createCompanionViewportRecovery } from "@/lib/ui/viewer-companion/viewport-recovery";

const large = { width: 1920, height: 1100 }, small = { width: 1920, height: 700 };
const full = { validationOnly: false, hasSafePlatforms: true };

describe("actual viewport recovery ownership", () => {
  it("preserves a resize through cached validation and empty geometry, then grants exactly one fresh landing", () => {
    const policy = createCompanionViewportRecovery(large);
    policy.observe(small);
    expect(policy.take({ validationOnly: true, hasSafePlatforms: false })).toBe(false);
    policy.observe(small);
    expect(policy.take({ validationOnly: true, hasSafePlatforms: true })).toBe(false);
    expect(policy.take({ validationOnly: false, hasSafePlatforms: false })).toBe(false);
    expect(policy.take(full)).toBe(true);
    expect(policy.take(full)).toBe(false);
  });

  it("does not give quiet layout, scroll or another validation new resize authority", () => {
    const policy = createCompanionViewportRecovery(large);
    policy.observe(large);
    expect(policy.take(full)).toBe(false);
    policy.observe(small); expect(policy.take(full)).toBe(true);
    for (const validationOnly of [false, true, false]) {
      policy.observe(small);
      expect(policy.take({ ...full, validationOnly })).toBe(false);
    }
  });

  it("coalesces multiple real sizes before geometry arrives without banking repeated recoveries", () => {
    const policy = createCompanionViewportRecovery(large);
    policy.observe(small); policy.observe({ width: 1600, height: 720 }); policy.observe({ width: 1600, height: 740 });
    expect(policy.take(full)).toBe(true); expect(policy.take(full)).toBe(false);
    policy.observe({ width: 1600, height: 740 }); expect(policy.take(full)).toBe(false);
    policy.observe(large); expect(policy.take(full)).toBe(true);
  });

  it("revokes queued recovery when a native drag or placement owns the delivery", () => {
    const policy = createCompanionViewportRecovery(large);
    policy.observe(small);
    expect(policy.take({ validationOnly: true, hasSafePlatforms: false, inputOwned: true })).toBe(false);
    policy.observe(small);
    expect(policy.take(full)).toBe(false);
    policy.observe({ width: 1800, height: 700 });
    expect(policy.take({ ...full, inputOwned: true })).toBe(false);
    expect(policy.take(full)).toBe(false);
  });

  it("does not revive an explicitly cancelled episode until another actual viewport change", () => {
    const policy = createCompanionViewportRecovery(large);
    policy.observe(small); policy.revoke();
    expect(policy.take(full)).toBe(false);
    policy.observe(small); expect(policy.take(full)).toBe(false);
    policy.observe(large); expect(policy.take(full)).toBe(true);
  });

  it("ignores invalid dimensions without changing the baseline or creating authority", () => {
    const policy = createCompanionViewportRecovery(large);
    for (const viewport of [{ width: NaN, height: 700 }, { width: 1920, height: 0 }, { width: -1, height: 700 }, { width: Infinity, height: 700 }]) policy.observe(viewport);
    expect(policy.take(full)).toBe(false);
    policy.observe(small); expect(policy.take(full)).toBe(true);
    const unknownBaseline = createCompanionViewportRecovery({ width: 0, height: 0 });
    unknownBaseline.observe(small); expect(unknownBaseline.take(full)).toBe(false);
  });
});

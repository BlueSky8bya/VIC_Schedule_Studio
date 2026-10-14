import { describe, expect, it } from "vitest";
import { premiereCompany, premiereScore } from "@/lib/ui/premiere/company";

describe("premiere company and original score", () => {
  it("seats the cheering company before retiring everything at the ten-second boundary", () => {
    expect(premiereCompany(40000).retire).toBe(0);
    expect(premiereCompany(21000).settle).toBe(0);
    expect(premiereCompany(14000).settle).toBe(1);
    for (const ms of [10500, 10000, 9000, 0, -1000]) {
      const company = premiereCompany(ms);
      expect(company.retire).toBe(1); expect(company.strength).toBe(0);
      expect(premiereScore(ms)).toBeNull();
    }
  });
  it("bounds every original note and its release before silence, including a late arrival", () => {
    for (let ms = 68000; ms > 10500; ms -= 137) {
      const score = premiereScore(ms)!;
      expect(score.duration).toBeGreaterThan(0);
      expect(score.duration * 1000).toBeLessThanOrEqual(ms - 10500 + .001);
      expect(score.level).toBeGreaterThanOrEqual(0); expect(score.level).toBeLessThanOrEqual(.13);
      expect(score.beat).toBeGreaterThanOrEqual(0);
    }
    expect(premiereScore(Infinity)).toBeNull(); expect(premiereScore(NaN)).toBeNull();
    expect(premiereScore(68001)).toBeNull();
    expect(premiereScore(30000)!.beat).toBeGreaterThan(premiereScore(40000)!.beat);
  });
});

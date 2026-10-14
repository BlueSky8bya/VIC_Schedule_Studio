import { describe, expect, it } from "vitest";
import { premiereAudienceFrame, premiereCompany, premiereScore } from "@/lib/ui/premiere/company";

describe("premiere company and original score", () => {
  it("retires host/controls and silences music before the ten-second boundary", () => {
    expect(premiereCompany(40000).retire).toBe(0);
    expect(premiereCompany(21000).settle).toBe(0);
    expect(premiereCompany(14000).settle).toBe(1);
    for (const ms of [10500, 10000, 9000, 0, -1000]) {
      const company = premiereCompany(ms);
      expect(company.retire).toBe(1); expect(company.strength).toBe(0);
      expect(premiereScore(ms)).toBeNull();
    }
  });
  it("plays actual cheer frames, omits reversed ears, then settles to an immutable watching pose", () => {
    const frames = new Set<number>();
    for (let ms = 60000; ms > 13000; ms -= 100) frames.add(premiereAudienceFrame(ms, 1.7));
    expect(frames.size).toBe(10); expect(frames.has(9)).toBe(false); expect(frames.has(10)).toBe(false);
    expect([12500, 12000, 11500, 11000, 10500, 9000, 0].map(ms => premiereAudienceFrame(ms, 2))).toEqual([12, 13, 14, 15, 15, 15, 15]);
    expect(premiereAudienceFrame(9000, 2, 300)).toBe(15);
    expect(premiereAudienceFrame(40000, 0, 0)).toBe(0);
    expect(premiereAudienceFrame(40000, 0, 400)).toBe(4);
    expect(premiereAudienceFrame(NaN, 0)).toBe(15);
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

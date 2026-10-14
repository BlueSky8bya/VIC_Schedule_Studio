import { describe, expect, it } from "vitest";
import { lateCardDeparture, passage, planCardDepartures, REGION_WINDOWS } from "@/lib/ui/premiere/choreography";

describe("continuous public premiere choreography", () => {
  it("orders every panel region and finishes them before the screen handover", () => {
    for (const [start, end] of Object.values(REGION_WINDOWS)) {
      expect(start).toBeGreaterThan(end);
      expect(end).toBeGreaterThan(68);
      expect(passage(start, start, end)).toBe(0);
      expect(passage(end, start, end)).toBe(1);
      expect(passage((start + end) / 2, start, end)).toBeCloseTo(.5);
    }
  });
  it("is continuous, bounded and reversible after postponement/dismissal", () => {
    expect(passage(140, 154, 138)).toBeGreaterThan(.9);
    expect(passage(165, 154, 138)).toBe(0);
    expect(passage(Infinity, 154, 138)).toBe(0);
    expect(passage(-5, 154, 138)).toBe(1);
    expect(Math.abs(passage(145, 154, 138) - passage(144.99, 154, 138))).toBeLessThan(.002);
  });
  it("shuffles unique schedules, not dates or DOM segments, and finishes every departure by T−75", () => {
    const ids = Array.from({ length: 80 }, (_, i) => `event:${i}`);
    const plan = planCardDepartures([...ids, ids[0]], "generation-A");
    expect(plan.size).toBe(80);
    expect(plan).toEqual(planCardDepartures([...ids].reverse(), "generation-A"));
    expect([...plan.keys()]).not.toEqual(ids);
    expect([...plan.keys()]).not.toEqual([...planCardDepartures(ids, "generation-B").keys()]);
    const scores = [...plan.values()];
    expect(new Set(scores.map(score => score.variant)).size).toBe(4);
    scores.forEach((score, i) => {
      expect(score.end).toBeGreaterThanOrEqual(75);
      expect(passage(75, score.start, score.end)).toBe(1);
      expect(passage(127, score.start, score.end)).toBe(0);
      if (i) expect(score.start).toBeLessThan(scores[i - 1].end);
    });
  });
  it("keeps a late arrival deterministic and within the deadline, including tiny calendars", () => {
    expect(planCardDepartures([], "A").size).toBe(0);
    const only = [...planCardDepartures(["one"], "A").values()][0];
    expect(passage(75, only.start, only.end)).toBe(1);
    const late = lateCardDeparture("new", "A");
    expect(late).toEqual(lateCardDeparture("new", "A"));
    expect(late.end).toBeGreaterThanOrEqual(75);
    expect(passage(75, late.start, late.end)).toBe(1);
    expect(passage(Infinity, late.start, late.end)).toBe(0);
  });
});

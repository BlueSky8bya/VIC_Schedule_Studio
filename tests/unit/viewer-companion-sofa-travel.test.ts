import { describe, expect, it } from "vitest";
import { sampleCompanionSofaTravel } from "@/lib/ui/viewer-companion/sofa-travel";

describe("measured sofa rim passage", () => {
  it("clears the rim before lateral movement and lands only after arriving", () => {
    const from = { x: 280, y: 460 }, to = { x: 160, y: 420 }, crest = 350;
    for (let frame = 0; frame <= 120; frame++) {
      const point = sampleCompanionSofaTravel(from, to, frame / 120, crest);
      if (point.x < from.x && point.x > to.x) expect(point.y).toBeLessThanOrEqual(crest);
      if (point.y > crest) expect([from.x, to.x]).toContain(point.x);
    }
    expect(sampleCompanionSofaTravel(from, to, 0, crest)).toMatchObject(from);
    expect(sampleCompanionSofaTravel(from, to, 1, crest)).toMatchObject(to);
  });
  it("reverses without crossing a sidewall and never lowers an already clear endpoint", () => {
    const from = { x: 160, y: 260 }, to = { x: 280, y: 420 };
    for (const p of [.28, .4, .6, .72]) expect(sampleCompanionSofaTravel(from, to, p, 350).y).toBe(260);
    expect(sampleCompanionSofaTravel(from, to, -1, 350)).toMatchObject(from);
    expect(sampleCompanionSofaTravel(from, to, 2, 350)).toMatchObject(to);
  });
});

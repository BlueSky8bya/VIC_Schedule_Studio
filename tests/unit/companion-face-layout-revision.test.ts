import { describe, expect, it } from "vitest";
import anchors from "@/lib/ui/viewer-companion/expression-anchors-161.json";
import { companionFaceLayout } from "@/lib/ui/viewer-companion/face-layout";
import { COMPANION_MOUTH_SHAPE as M, sampleCompanionExpression } from "@/lib/ui/viewer-companion/expressions";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

describe("owner face-axis correction", () => {
  it("has a measured mouth in every source cell of the three reviewed transition rows", () => {
    for (const row of [0, 1, 9]) for (const physicalIndex of companionSpriteMetadata.rows[row]) {
      expect(anchors.frames.find(pose => pose.physicalIndex === physicalIndex)?.mouth, `source pose ${physicalIndex}`).toBeTruthy();
    }
  });
  it("places the mouth below the eyes on the pose's own centre axis in every registered pose", () => {
    for (const pose of anchors.frames) {
      const layout = companionFaceLayout(pose), dx = layout.mouthX - layout.x, dy = layout.mouthY - layout.y;
      expect(dx * Math.cos(layout.angle) + dy * Math.sin(layout.angle)).toBeCloseTo(0, 8);
      expect(-dx * Math.sin(layout.angle) + dy * Math.cos(layout.angle)).toBeGreaterThanOrEqual(4 - 1e-8);
      expect(Number.isFinite(layout.angle)).toBe(true);
    }
  });
  it("keeps the first-bite mouth below the downward gaze rather than on the pupil line", () => {
    const pose = anchors.frames.find(pose => pose.physicalIndex === 0)!;
    const layout = companionFaceLayout(pose), face = sampleCompanionExpression("first-bite", .55);
    // Painter bounds the eye's downward displacement to one quarter of its height.
    const maximumGaze = 5 * .25;
    expect(layout.mouthY - layout.y - Math.min(maximumGaze, face.gazeY * .8)).toBeGreaterThan(2.5);
  });
  it("gives sour its own continuous wave and keeps TV/resolve free of unintended slant", () => {
    expect(sampleCompanionExpression("sour", .55).mouth).toBe(M.wave);
    for (const id of ["tv", "resolve"] as const) {
      const face = sampleCompanionExpression(id, .55);
      expect(face.left).toBe(face.right); expect(face.slant).toBe(0); expect(face.gazeX).toBe(0);
    }
  });
  it("separates the search and innocent hold and keeps innocent's later glance fixed", () => {
    const search = sampleCompanionExpression("search", .55), innocent = sampleCompanionExpression("innocent", .55);
    expect(search.mouth).not.toBe(innocent.mouth); expect(search.leftShape).not.toBe(innocent.leftShape);
    expect(innocent.gazeY).toBeLessThan(-1);
    expect(sampleCompanionExpression("innocent", .4).gazeX).toBe(sampleCompanionExpression("innocent", .7).gazeX);
    expect(sampleCompanionExpression("search", .4).gazeX).not.toBe(sampleCompanionExpression("search", .7).gazeX);
  });
});

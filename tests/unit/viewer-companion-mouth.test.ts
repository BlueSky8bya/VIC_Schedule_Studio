import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import metadata from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import calibration from "@/lib/ui/viewer-companion/mouth-anchors.json";
import { advanceCompanionMealWait, projectCompanionMouth, type CompanionMouthProjectionInput } from "@/lib/ui/viewer-companion/mouth";
import { selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";

const neutral = (): CompanionMouthProjectionInput => ({
  size: 80, display: { x: 40, y: 80, scale: 1 }, shape: { bob: 0, tilt: 0, scaleX: 1, scaleY: 1 },
  pressure: { x: 0, y: 0, tilt: 0, squash: 0 }, response: { lift: 0, squash: 0 }, facing: 1,
  sway: { tilt: 0, stretch: 0 },
});

describe("current authored eating mouth registration", () => {
  it("starts a new meal after a delayed frame without charging the preceding stall", () => {
    const start = advanceCompanionMealWait(1500, 1500, 1500, 0);
    expect(start).toEqual({ began: 1500, waited: 0, expired: false });
    const next = advanceCompanionMealWait(1516, start.began, 16, start.waited);
    expect(next).toEqual({ began: 1516, waited: 16, expired: false });
    const paused = advanceCompanionMealWait(11516, next.began, 0, next.waited);
    expect(paused.waited).toBe(16); expect(paused.expired).toBe(false);
    expect(advanceCompanionMealWait(2716, 1516, 1200, 16).expired).toBe(true);
  });
  it("covers every actual look and happy eating cell against the exact rendered atlas bytes", async () => {
    expect(calibration.frames.map(frame => frame.index)).toEqual([...metadata.rows[1], ...metadata.rows[9]]);
    for (const atlas of calibration.atlases) {
      const bytes = readFileSync(`public${atlas.src}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(atlas.sha256);
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const frame of calibration.frames.filter(frame => calibration.atlases[frame.atlas].src === atlas.src)) {
        const selected = selectCompanionSprite(frame.index);
        const registered = projectCompanionMouth(selected, neutral());
        expect(registered).not.toBeNull();
        // Inspect the recorded mouth arc itself, not transparent padding, an
        // eye or cheek. All32 distinct cells retain authored mouth ink here.
        const [left, top, right, bottom] = frame.bounds, ink: Array<{ x: number; y: number }> = [];
        for (let y = top - 1; y <= bottom; y++) {
          for (let x = left - 1; x <= right; x++) {
            const p = ((Math.floor(frame.cell / 8) * 192 + y) * info.width + frame.cell % 8 * 192 + x) * 4;
            if (data[p + 3] > 200 && data[p] < 240 && data[p + 1] < 170 && data[p + 2] < 150) ink.push({ x, y });
          }
        }
        expect(ink.length).toBeGreaterThanOrEqual(10);
        expect([Math.min(...ink.map(point => point.x)), Math.min(...ink.map(point => point.y)), Math.max(...ink.map(point => point.x)) + 1, Math.max(...ink.map(point => point.y)) + 1]).toEqual(frame.bounds);
        expect(frame.x).toBe((left + right) / 2); expect(frame.y).toBe((top + bottom) / 2);
        expect(registered!.x).toBeGreaterThan(42);
        expect(registered!.x).toBeLessThan(47);
        expect(registered!.y).toBeGreaterThan(58);
        expect(registered!.y).toBeLessThan(62.5);
      }
    }
  });

  it("follows the adopted happy drawing rather than keeping the observing pose's mouth", () => {
    const observe = projectCompanionMouth(selectCompanionSprite(16), neutral())!;
    const chew = projectCompanionMouth(selectCompanionSprite(144), neutral())!;
    //115 registers the same authored mouths against the opaque body's foot,
    //rather than tiny export residue. The measured ink still owns the bite.
    expect(observe.x).toBeCloseTo(42.5, 5); expect(observe.y).toBeCloseTo(60.625, 5);
    expect(chew.x).toBeCloseTo(45.208333, 5); expect(chew.y).toBeCloseTo(61.666667, 5);
    expect(chew.x).not.toBe(observe.x); expect(chew.y).not.toBe(observe.y);
  });

  it("mirrors the mouth about the real body centre and follows viewport size and travel once", () => {
    const selected = selectCompanionSprite(144), right = projectCompanionMouth(selected, neutral())!;
    const left = projectCompanionMouth(selected, { ...neutral(), facing: -1 })!;
    expect(left.x + right.x).toBeCloseTo(80, 8); expect(left.y).toBeCloseTo(right.y, 8);
    const larger = projectCompanionMouth(selected, { ...neutral(), size: 160, display: { x: 500, y: 700, scale: 1 } })!;
    expect(larger.x).toBeCloseTo(420 + right.x * 2, 8);
    expect(larger.y).toBeCloseTo(540 + right.y * 2, 8);
  });

  it("shares chew, body rotation, contact and landing response with the actually painted creature", () => {
    const selected = selectCompanionSprite(144), first = projectCompanionMouth(selected, neutral())!;
    const chew = projectCompanionMouth(selected, { ...neutral(), chew: .01 })!;
    expect(chew.x).toBeCloseTo(40 + (first.x - 40) * 1.01, 8);
    expect(chew.y).toBeCloseTo(80 + (first.y - 80) * .992, 8);
    const landed = projectCompanionMouth(selected, { ...neutral(), shape: { bob: 2, tilt: 90, scaleX: 1, scaleY: 1 },
      pressure: { x: 3, y: 4, tilt: 0, squash: 0 }, response: { lift: -5, squash: 0 } })!;
    expect(landed.x).toBeCloseTo(40 - (first.y - 80) + 3, 8);
    expect(landed.y).toBeCloseTo(80 + (first.x - 40) + 2 + 4 - 5, 8);
  });

  it("does not apply calibration to a different drawing or malformed transform", () => {
    const selected = selectCompanionSprite(144);
    expect(projectCompanionMouth({ ...selected, src: `${selected.src}-future` }, neutral())).toBeNull();
    expect(projectCompanionMouth({ ...selected, src: selected.src.replace("-motion-115-v1", "-unified-114-v1") }, neutral())).toBeNull();
    expect(projectCompanionMouth({ ...selected, index: 1 }, neutral())).toBeNull();
    expect(projectCompanionMouth(selectCompanionSprite(304), neutral())).toBeNull();
    expect(projectCompanionMouth(selected, { ...neutral(), size: NaN })).toBeNull();
  });
});

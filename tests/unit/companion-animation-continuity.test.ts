import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { createCompanionMotion, sampleCompanionBlink } from "@/lib/ui/viewer-companion/motion";
import { sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import { companionMotionClips, companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";

const motion = () => createCompanionMotion({
  clips: companionMotionClips,
  rowCount: companionSpriteMetadata.rows.length,
  loopRows: [0, 2, 8, 9, 11, 20],
});

describe("companion animation continuity", () => {
  it("closes and reopens both idle lids once per cycle with intermediate poses", () => {
    const samples = Array.from({ length: 251 }, (_, ms) => sampleCompanionBlink(3000 + ms));
    expect(samples[0]).toBe(0);
    expect(samples.at(-1)).toBe(0);
    expect(samples[100]).toBe(1);
    expect(samples[45]).toBeCloseTo(.5);
    expect(samples[190]).toBeCloseTo(.5);
    expect(samples.slice(0, 91).every((v, i) => !i || v >= samples[i - 1])).toBe(true);
    expect(samples.slice(130).every((v, i) => !i || v <= samples[129 + i])).toBe(true);
    expect(sampleCompanionBlink(4800 + 3045)).toBeCloseTo(samples[45]);
  });

  it("accumulates short idle beats, interrupts a blink on travel and keeps reduced poses open", () => {
    const actor = motion();
    const sample = (row: number, now: number, reduced = false) => actor.sample({ row, now, reduced, status: row ? "walk" : "idle", x: 100, y: 100, phase: 0 });
    for (let now = 0; now < 3040; now += 20) {
      const pose = sample(now % 1020 === 1000 ? 2 : 0, now);
      if (pose.row === 0) expect([9, 10]).not.toContain(pose.column);
    }
    let sawBlink = false;
    for (let now = 3040; now < 3250; now += 20) {
      sample(0, now);
      if (actor.blink() > .1) {
        sawBlink = true;
        sample(2, now + 1);
        expect(actor.blink()).toBe(0);
        expect(sample(0, now + 2, true).column).toBe(0);
        expect(actor.blink()).toBe(0);
        break;
      }
    }
    expect(sawBlink).toBe(true);
  });

  it("requests the existing fast paint cadence before the lids begin moving", () => {
    const actor = motion();
    for (let now = 0; now <= 2940; now += 20) actor.sample({ row: 0, now, status: "idle", x: 0, y: 0, phase: 0 });
    expect(actor.blink()).toBe(0);
    expect(actor.blinkImminent()).toBe(true);
    actor.sample({ row: 2, now: 2960, status: "walk", x: 0, y: 0, phase: 0 });
    expect(actor.blinkImminent()).toBe(false);
  });

  it("returns a rolling cycle to its original outline while keeping both rear poses", () => {
    const clip = companionMotionClips[21];
    expect(clip.at(-1)).toBe(clip[0]);
    expect(clip).toEqual(expect.arrayContaining([6, 8]));
  });

  it("keeps the slip on one source contour while smoothly compressing it around the support", () => {
    const actor = motion();
    const frames = Array.from({ length: 61 }, (_, i) =>
      actor.sample({ row: 24, phase: i / 60, now: i * 3, status: "play", x: 100, y: 100 }));
    expect(new Set(frames.map(f => f.column))).toEqual(new Set([0]));
    expect(frames[0].scaleY).toBe(1);
    expect(frames[30].scaleY).toBeCloseTo(.87);
    expect(frames[60].scaleY).toBe(1);
    for (const [i, frame] of frames.entries()) {
      expect(frame.scaleX * frame.scaleY).toBeCloseTo(1, 5);
      if (i) expect(Math.abs(frame.scaleY - frames[i - 1].scaleY)).toBeLessThan(.008);
    }
  });

  it("keeps one centered strained drawing during recovery and only changes it as the shake settles", () => {
    const actor = motion();
    const active = Array.from({ length: 80 }, (_, i) => {
      const now = i * 10, { row, phase } = sampleCompanionPlay("dizzy", (520 + now) / 1320);
      return actor.sample({ row, phase, now, status: "play", x: 100, y: 100 }).column;
    });
    expect(new Set(active.slice(0, 56))).toEqual(new Set([0]));
    expect(new Set(active.slice(56))).toEqual(new Set([15]));
  });

  it.each([0, 18, 20, 24, 25, 26, 29, 30, 31])("bounds each adjacent registered sprite silhouette in corrected row %i", async row => {
    const cells = companionMotionClips[row].map(column => selectCompanionSprite(companionSpriteMetadata.rows[row][column]));
    const src = cells[0].src;
    expect(cells.every(c => c.src === src)).toBe(true);
    const { data, info } = await sharp("public" + src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const side = info.width / cells[0].grid, stride = side + 48;
    const masks = cells.map(({ index, grid, frame }) => {
      const mask = new Uint8Array(stride * stride);
      const left = index % grid * side, top = Math.floor(index / grid) * side;
      const dx = 24 + Math.round(frame.x * side / 80), dy = 24 + Math.round(frame.y * side / 80);
      for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
        const alpha = data[((y + top) * info.width + x + left) * 4 + 3];
        if (alpha >= 200) mask[(y + dy) * stride + x + dx] = 1;
      }
      return mask;
    });
    if ([0, 20, 30, 31].includes(row)) masks.push(masks[0]);
    for (let i = 1; i < masks.length; i++) {
      let union = 0, changed = 0;
      for (let n = 0; n < masks[i].length; n++) {
        union += masks[i - 1][n] | masks[i][n];
        changed += masks[i - 1][n] ^ masks[i][n];
      }
      expect(union).toBeGreaterThan(0);
      expect(changed / union).toBeLessThan(.045);
    }
  });
});

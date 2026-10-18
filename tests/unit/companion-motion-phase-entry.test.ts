import { describe, expect, it } from "vitest";
import { createCompanionMotion } from "@/lib/ui/viewer-companion/motion";
import { COMPANION_CLIP_TIMING } from "@/lib/ui/viewer-companion/timing";

const phaseRows = COMPANION_CLIP_TIMING.filter(clip => clip.playback === "phase" || clip.playback === "hold" && !clip.frameRate).map(clip => clip.row);
const input = (row: number, phase: number, now = 200) => ({ row, phase, now, status: "play", x: 100, y: 300 });
describe("115 phase-owned first drawing", () => {
  it.each(phaseRows)("row%s does not rewind a late entry to its opening frame", row => {
    const clips = Object.fromEntries(COMPANION_CLIP_TIMING.map(clip => [clip.row, [1, 4, 8, 15]]));
    const motion = createCompanionMotion({ clips, rowCount: 41, loopRows: [0, 2, 8, 9, 11, 20] });
    motion.sample(input(0, 0, 100));
    expect(motion.sample(input(row, .8)).column).toBe(15);
    expect(motion.sample(input(row, .8, 216)).column).toBe(15);
    expect(motion.sample(input(row, .4, 216)).column).toBe(4);
    expect(clips[row]).toEqual([1, 4, 8, 15]);
  });
  it("keeps genuine loop and distance entries at their own beginning", () => {
    for (const row of [0, 2, 8, 9, 11, 20, 40]) {
      const motion = createCompanionMotion({ rowCount: 41, loopRows: [0, 2, 8, 9, 11, 20] });
      motion.sample(input(1, .5, 100));
      expect(motion.sample(input(row, 1)).column).toBe(0);
    }
  });
  it("keeps reduced finite poses quiet and recovery's explicit terminal face", () => {
    const motion = createCompanionMotion({ rowCount: 41 });
    for (const row of [3, 6, 12, 18, 27, 37]) expect(motion.sample({ ...input(row, 1), reduced: true }).column).toBe(0);
    expect(motion.sample({ ...input(23, 0), reduced: true }).column).toBe(15);
    expect(motion.sample({ ...input(32, 0), status: "jump", reduced: true }).column).toBe(15);
  });
});

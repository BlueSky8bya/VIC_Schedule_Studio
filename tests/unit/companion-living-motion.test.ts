import { describe, expect, it } from "vitest";
import { sampleCompanionCozySleep, sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";

describe("connected living performances", () => {
  it("keeps the calibrated happy face through a finite stronger cheer and settles on its support", () => {
    const kind = "cheer-rehearsal", duration = COMPANION_PLAY_TIMING[kind].duration;
    const seen = Array.from({ length: 401 }, (_, index) => sampleCompanionPlay(kind, index / 400));
    const rows = seen.map(pose => pose.row).filter((row, index, all) => index === 0 || row !== all[index - 1]);
    expect(rows).toEqual([9]);
    expect(duration).toBeGreaterThan(3000);
    expect(duration).toBeLessThan(6000);
    expect(seen.every(pose => pose.shift === 0 && Math.abs(pose.lean) <= 6 && Math.abs(pose.lift) <= 24.001)).toBe(true);
    expect(Math.max(...seen.map(pose => Math.abs(pose.lift)))).toBeGreaterThan(23);
    expect(seen.at(-1)).toMatchObject({ lift: 0, lean: 0, compression: 0 });
  });

  it("settles on the same support, curls into a quiet hold and wakes with the existing clip", () => {
    const rows = Array.from({ length: 241 }, (_, index) => sampleCompanionCozySleep(index * 50, 12000));
    const sequence = rows.map(pose => pose.row).filter((row, index, all) => index === 0 || row !== all[index - 1]);
    expect(sequence).toEqual([35, 36, 40, 12]);
    expect(rows.every(pose => pose.shift === 0)).toBe(true);
    expect(sampleCompanionCozySleep(6000, 12000)).toMatchObject({ row: 40, dreaming: true, lift: 0, lean: 0, compression: 0 });
    expect(sampleCompanionCozySleep(12000, 12000)).toMatchObject({ row: 12, phase: 1, dreaming: false });
  });

  it("does not knead again after an already completed settling action", () => {
    expect(sampleCompanionCozySleep(0, 9000, true)).toMatchObject({ row: 40, dreaming: true });
    expect(sampleCompanionCozySleep(1000, 9000, false, true)).toMatchObject({ row: 11, dreaming: true, compression: 0 });
  });

  it("keeps the end of each new gesture in its last authored expression", () => {
    for (const kind of ["ask-petting", "lean-nuzzle", "cozy-nest", "cheer-rehearsal", "doze-curl"] as const) {
      expect(sampleCompanionPlay(kind, 1).row).toBe(COMPANION_PLAY_TIMING[kind].beats.at(-1)!.row);
      const quiet = sampleCompanionPlay(kind, .4, true);
      expect([quiet.lift, quiet.lean, quiet.shift, quiet.compression]).toEqual([0, 0, 0, 0]);
    }
  });
});

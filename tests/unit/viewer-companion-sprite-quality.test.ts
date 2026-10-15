import { describe, expect, it } from "vitest";
import { selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import keyposes from "@/lib/ui/viewer-companion/keypose-sprite.json";

describe("native sprite quality without reducing authored movement", () => {
  it("keeps the decoded fluid sheet until the sharper source is ready", () => {
    expect(selectCompanionSprite(9, 0, 9, true, false)).toEqual({ atlas: "fluid", index: 9 });
    expect(selectCompanionSprite(267, 11, 0, true, false)).toEqual({ atlas: "fluid", index: 267 });
  });
  it("uses real high-resolution rest/contact poses and preserves movement", () => {
    expect(selectCompanionSprite(9, 0, 9, true, true)).toEqual({ atlas: "keypose", index: 1 });
    expect(selectCompanionSprite(144, 9, 0, false, true)).toEqual({ atlas: "keypose", index: 9 });
    expect(selectCompanionSprite(267, 11, 0, false, true)).toEqual({ atlas: "keypose", index: 11 });
    for (const row of [2, 3, 4, 5, 6, 8, 13, 14, 16, 17]) for (let column = 0; column < 16; column++) {
      const index = Math.min(255, row * 16 + column);
      expect(selectCompanionSprite(index, row, column, true, true)).toEqual({ atlas: "fluid", index });
    }
  });
  it("does not replace normal/small idle clips with static poses", () => {
    for (let column = 0; column < 16; column++) expect(selectCompanionSprite(column, 0, column, false, true)).toEqual({ atlas: "fluid", index: column });
  });
  it("registers the 16 denser frames in the same logical 80px cell", () => {
    expect(keyposes).toMatchObject({ grid: 4, cell: 160, logicalCell: 80 });
    expect(keyposes.frames).toHaveLength(16);
    for (const frame of keyposes.frames) {
      expect([frame.x, frame.y, ...frame.clip].every(Number.isFinite)).toBe(true);
      expect(frame.clip.every(value => value >= 0)).toBe(true);
      expect(frame.clip[0] + frame.clip[2]).toBeLessThan(80);
      expect(frame.clip[1] + frame.clip[3]).toBeLessThan(80);
      expect((frame.clip[3] + 2 + 80 - frame.clip[1] - 2) / 2 + frame.x).toBeCloseTo(40, 6);
      expect(80 - frame.clip[2] - 2 + frame.y).toBeCloseTo(80, 6);
    }
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import base from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import play from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import { companionSpriteMetadata, companionSpriteSources, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";

describe("additional native play packets share the established HD pipeline", () => {
  it("preserves every original HD index and appends twelve complete packets", () => {
    expect(play).toMatchObject({ cell: 192, logicalCell: 80, grid: 8, gridRows: 2, rowOffset: base.rows.length });
    expect(play.rows).toHaveLength(12); expect(play.frames).toHaveLength(192); expect(play.atlases).toHaveLength(12);
    expect(companionSpriteMetadata.rows.slice(0, base.rows.length)).toEqual(base.rows);
    expect(companionSpriteMetadata.frames.slice(0, base.frames.length)).toEqual(base.frames);
    expect(companionSpriteMetadata.atlases.slice(0, base.atlases.length)).toEqual(base.atlases);
    for (let row = 20; row < 32; row++) {
      const indices = companionSpriteMetadata.rows[row]; expect(indices).toHaveLength(16);
      const source = play.atlases[row - 20].src;
      expect(companionSpriteSources(row)).toEqual([source]);
      for (const [column, index] of indices.entries()) {
        const selected = selectCompanionSprite(index, row, column);
        expect(selected).toMatchObject({ atlas: "hd", physicalIndex: base.frames.length + (row - 20) * 16 + column, index: column, grid: 8, gridRows: 2 });
        expect(selected.src).toBe(source);
      }
    }
  });
  it("keeps whole bodies inside the existing footprint with a common centre and foot", () => {
    for (const frame of play.frames) {
      expect([frame.x, frame.y, ...frame.clip].every(Number.isFinite)).toBe(true);
      expect(Math.min(...frame.clip)).toBeGreaterThanOrEqual(0);
      const left = frame.clip[3] + 2, right = 80 - frame.clip[1] - 2;
      const top = frame.clip[0] + 2, bottom = 80 - frame.clip[2] - 2;
      expect((left + right) / 2 + frame.x).toBeCloseTo(40, 5);
      expect(bottom + frame.y).toBeCloseTo(80, 5);
      expect(right - left).toBeLessThanOrEqual(80 * .76);
      expect(bottom - top).toBeLessThanOrEqual(80 * .82);
      expect(right - left).toBeGreaterThan(35); expect(bottom - top).toBeGreaterThan(20);
    }
  });
  it("pins actual packet bytes and protects complete native bodies crossing nominal grid lines", () => {
    for (const atlas of play.atlases) {
      const bytes = readFileSync(`public${atlas.src}`);
      expect(bytes.length).toBe(atlas.bytes); expect(atlas.width).toBe(1536); expect(atlas.height).toBe(384);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(atlas.sha256);
    }
    const record = JSON.parse(readFileSync("art-src/빅타민/동행/작업회차/20261016-덤벙놀이/패킹파생기록.json", "utf8"));
    expect(record.newlyGeneratedKeys).toBe(36); expect(record.generationCallsByThisScript).toBe(0);
    expect(record.nativeCells).toHaveLength(36); expect(record.nativeCells.some((cell: { nominalCellCrossing: boolean }) => cell.nominalCellCrossing)).toBe(true);
    for (const cell of record.nativeCells) {
      expect(cell.body.width).toBe(cell.sourceBody.width); expect(cell.body.height).toBe(cell.sourceBody.height); expect(cell.body.pixels).toBe(cell.sourceBody.pixels);
    }
    for (const cell of record.derivedCells) {
      expect(cell.uniformScale).toBeGreaterThan(0); expect(cell.uniformScale).toBeLessThanOrEqual(1);
      expect(cell.resizedCell / record.method.nativeCropCell).toBe(cell.uniformScale);
    }
    expect(record.output.logicalBody.minWidth).toBeGreaterThan(48);
  });
});

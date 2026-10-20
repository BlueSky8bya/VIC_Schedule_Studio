import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import base from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import play from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import anchors from "@/lib/ui/viewer-companion/accessory-anchors.json";
import edition from "../fixtures/companion-eye-scale-143.json";
import { companionSpriteMetadata, companionSpriteSources, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import bodyRegistration from "@/art-src/빅타민/동행/작업회차/20261018-동작연결정리115/패킹파생기록.json";
import expression119 from "@/art-src/빅타민/동행/작업회차/20261019-표정체적교정119/패킹파생기록.json";

// Match the documented opaque-body registration threshold, measuring the
// actual new packet independently of its recorded frame coordinates.
function opaqueBody(rgba: Buffer) {
  const seen = new Uint8Array(192 * 192), queue = new Int32Array(seen.length);
  let largest = { left: 192, top: 192, right: 0, bottom: 0, pixels: 0 };
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || rgba[start * 4 + 3] < 200) continue;
    let head = 0, count = 1, left = 192, top = 192, right = 0, bottom = 0;
    queue[0] = start; seen[start] = 1;
    while (head < count) {
      const point = queue[head++], x = point % 192, y = Math.floor(point / 192);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(191, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(191, x + 1); xx++) {
        const next = yy * 192 + xx;
        if (!seen[next] && rgba[next * 4 + 3] >= 200) { seen[next] = 1; queue[count++] = next; }
      }
    }
    if (count > largest.pixels) largest = { left, top, right, bottom, pixels: count };
  }
  return largest;
}

describe("additional native play packets share the established HD pipeline", () => {
  it("preserves every original HD/play index and appends the complete throw packet", () => {
    expect(play).toMatchObject({ cell: 192, logicalCell: 80, grid: 8, gridRows: 2, rowOffset: base.rows.length });
    expect(play.rows).toHaveLength(13); expect(play.frames).toHaveLength(208); expect(play.atlases).toHaveLength(13);
    expect(companionSpriteMetadata.rows.slice(0, base.rows.length)).toEqual(base.rows);
    expect(companionSpriteMetadata.frames.slice(0, base.frames.length)).toEqual(base.frames);
    expect([...base.atlases, ...play.atlases].map(({ src, sha256, bytes }) => ({ src, sha256, bytes }))).toEqual(anchors.sources.slice(0, base.atlases.length + play.atlases.length));
    for (let row = 20; row < 32; row++) {
      const indices = companionSpriteMetadata.rows[row]; expect(indices).toHaveLength(16);
      for (const [column, index] of indices.entries()) {
        const selected = selectCompanionSprite(index, row, column);
        expect(selected).toMatchObject({ atlas: "hd", physicalIndex: base.frames.length + (row - 20) * 16 + column, index: column, grid: 8, gridRows: 2 });
        const parentFrame = play.frames[(row - 20) * 16 + column];
        expect(selected.frame).toEqual({ ...parentFrame, atlas: parentFrame.atlas + base.atlases.length });
      }
    }
    const throwRow = companionSpriteMetadata.rows[32];
    expect(throwRow).toEqual(Array.from({ length: 16 }, (_, column) => base.frames.length + 192 + column));
    expect(play.atlases[3].src).toBe("/companion/hd/vitamin-play-03-expression-119-v1.webp");
    expect(play.atlases[12].src).toBe("/companion/hd/vitamin-play-12-expression-119-v1.webp");
    expect(companionSpriteSources(32)).toEqual([play.atlases[12].src]);
    for (const [column, index] of throwRow.entries()) expect(selectCompanionSprite(index, 32, column)).toMatchObject({ atlas: "hd", physicalIndex: index, index: column, grid: 8, gridRows: 2, src: play.atlases[12].src });
  });
  it("preloads the exact active play edition while preserving its thirteen parent packets", () => {
    for (let row = 20; row < 33; row++) {
      const parent = play.atlases[row - 20], sourceIndex = row - 20 + base.atlases.length;
      const patch = edition.packets.find(p => p.atlas === sourceIndex);
      if (patch) { expect(parent.src).toBe(patch.parentSrc); expect(parent.sha256).toBe(patch.parentSha256); }
      const expected = patch?.src ?? parent.src;
      expect(companionSpriteSources(row)).toEqual([expected]);
      for (const index of companionSpriteMetadata.rows[row]) expect(selectCompanionSprite(index).src).toBe(expected);
    }
  });
  it("keeps whole bodies inside the existing footprint with a common centre and actual opaque foot", async () => {
    expect(expression119.registrationChanges).toEqual([496, 497, 498, 499]);
    const packet = expression119.packets.find(item => item.atlas === 31)!;
    expect(play.atlases[12]).toEqual(packet.packet);
    const bytes = readFileSync(`public${packet.packet.src}`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(packet.packet.sha256);
    for (const [index, frame] of play.frames.entries()) {
      expect([frame.x, frame.y, ...frame.clip].every(Number.isFinite)).toBe(true);
      expect(Math.min(...frame.clip)).toBeGreaterThanOrEqual(0);
      const left = frame.clip[3] + 2, right = 80 - frame.clip[1] - 2;
      const top = frame.clip[0] + 2, bottom = 80 - frame.clip[2] - 2;
      const physical = base.frames.length + index, legacy = bodyRegistration.slots[physical];
      let body = { left: legacy.body.left, top: legacy.body.top, right: legacy.body.right, bottom: legacy.body.bottom };
      if (physical >= 496 && physical <= 499) {
        const corrected = expression119.frames.find(item => item.physicalIndex === physical)!;
        expect(corrected.nativeCell).toBe(67); expect(corrected.registrationChanged).toBe(true);
        expect(corrected.parentFrame).toEqual({ ...legacy.frame, atlas: 12 });
        expect(frame).toEqual(corrected.frame);
        const rgba = await sharp(bytes).extract({ left: frame.index % 8 * 192, top: Math.floor(frame.index / 8) * 192, width: 192, height: 192 }).ensureAlpha().raw().toBuffer();
        const measured = opaqueBody(rgba); expect(measured.pixels).toBeGreaterThan(3000);
        body = measured;
      } else expect(frame).toEqual({ ...legacy.frame, atlas: legacy.frame.atlas - base.atlases.length });
      expect((body.left + body.right) / 2 / 2.4 + frame.x).toBeCloseTo(40, 5);
      expect(body.bottom / 2.4 + frame.y).toBeCloseTo(80, 5);
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

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import current from "@/lib/ui/viewer-companion/play-motion-sprite.json";

type Frame = { atlas: number; index: number; x: number; y: number; clip: number[] };
type Atlas = { src: string; sha256: string; bytes: number; width: number; height: number };
type Original = {
  source: string; sourceSha256: string;
  packets: Array<{ row: number; nativeIndicesByColumn: number[] }>;
  derivedCells: Array<{ sourceIndex: number; frame: Omit<Frame, "atlas" | "index"> }>;
  output: { metadataSha256: string; atlases: Atlas[] };
};
type Repair = {
  source: string; sourceSha256: string; originalMetadataSha256: string;
  replacementIndices: number[]; affectedRows: number[]; untouchedRows: number[];
  protectedOriginalPacketCount: number; generationCallsByThisScript: number;
  automaticPostRepairArtReviews: number; encoding: { lossless: boolean; exact: boolean };
  physicalCell: number; logicalCell: number; foot: number;
  derived: Array<{ sourceIndex: number; cropCell: number; resizedCell: number; uniformScale: number; completeBodyPreserved: boolean; registeredBounds: { left: number; top: number; right: number; bottom: number }; frame: Omit<Frame, "atlas" | "index"> }>;
  packets: Array<{ row: number; changedColumns: number[]; original: Atlas; replacement: Atlas; alphaChangedByEncoding: number; visibleRgbChangedByEncoding: number; transparentRgbChangedPixels: number }>;
};
const sourceRun = "art-src/빅타민/동행/작업회차/20261016-덤벙놀이";
const repairRun = "art-src/빅타민/동행/작업회차/20261016-귀두개교정";
const original = JSON.parse(readFileSync(`${sourceRun}/패킹파생기록.json`, "utf8")) as Original;
const repair = JSON.parse(readFileSync(`${repairRun}/패킹파생기록.json`, "utf8")) as Repair;
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
const baseline = {
  version: 1, cell: 192, logicalCell: 80, grid: 8, gridRows: 2, rowOffset: 20,
  atlases: original.output.atlases,
  frames: original.packets.flatMap((packet, atlas) => packet.nativeIndicesByColumn.map((sourceIndex, index) => ({ atlas, index, ...original.derivedCells.find(item => item.sourceIndex === sourceIndex)!.frame }))),
  rows: original.packets.map((_, packet) => Array.from({ length: 16 }, (_, index) => packet * 16 + index)),
};

describe("four requested ear corrections preserve all other native poses", () => {
  it("binds the actual correction while preserving the historical source and exact baseline", () => {
    expect(repair.replacementIndices).toEqual([10, 19, 25, 27]);
    expect(repair.affectedRows).toEqual([21, 24, 27, 28]);
    expect(repair.untouchedRows).toEqual([20, 22, 23, 25, 26, 29, 30, 31]);
    expect(hash(readFileSync(original.source))).toBe(original.sourceSha256);
    expect(hash(`${JSON.stringify(baseline, null, 2)}\n`)).toBe(original.output.metadataSha256);
    expect(repair.originalMetadataSha256).toBe(original.output.metadataSha256);
    const registered = JSON.parse(readFileSync(`${repairRun}/생성등록.json`, "utf8"));
    expect(hash(readFileSync(repair.source))).toBe(repair.sourceSha256);
    expect(registered.sha256.toLowerCase()).toBe(repair.sourceSha256);
    expect(registered.status).toBe("DRAFT_DELIVERED_FOR_USER_REVIEW");
    expect(repair.generationCallsByThisScript).toBe(0);
    expect(repair.automaticPostRepairArtReviews).toBe(0);
  });

  it("keeps all twelve original packet files and eight unaffected runtime atlases byte-exact", () => {
    expect(repair.protectedOriginalPacketCount).toBe(12);
    for (const [index, atlas] of original.output.atlases.entries()) {
      expect(hash(readFileSync(`public${atlas.src}`))).toBe(atlas.sha256);
      if (!repair.affectedRows.includes(index + 20)) expect(current.atlases[index]).toEqual(atlas);
    }
    for (const packet of repair.packets) {
      expect(packet.replacement.src).toBe(`/companion/hd/victamin-play-${packet.row}-ear-v2.webp`);
      expect(hash(readFileSync(`public${packet.replacement.src}`))).toBe(packet.replacement.sha256);
      expect(current.atlases[packet.row - 20]).toEqual(packet.replacement);
    }
  });

  it("changes registration only for the four requested source indices, without changing row/column indexing", () => {
    expect(current.rows).toEqual(baseline.rows);
    for (const [packet, definition] of original.packets.entries()) {
      for (const [column, sourceIndex] of definition.nativeIndicesByColumn.entries()) {
        const frameIndex = packet * 16 + column;
        if (!repair.replacementIndices.includes(sourceIndex)) expect(current.frames[frameIndex]).toEqual(baseline.frames[frameIndex]);
        else expect(current.frames[frameIndex]).toEqual({ atlas: packet, index: column, ...repair.derived.find(item => item.sourceIndex === sourceIndex)!.frame });
      }
    }
  });

  it("retains complete crops and the established physical/logical footprint without stretching separate body parts", () => {
    expect(repair).toMatchObject({ physicalCell: 192, logicalCell: 80, foot: 180, encoding: { lossless: true, exact: true } });
    expect(repair.derived).toHaveLength(4);
    for (const pose of repair.derived) {
      expect(pose.completeBodyPreserved).toBe(true);
      expect(pose.uniformScale).toBe(pose.resizedCell / pose.cropCell);
      expect(pose.uniformScale).toBeGreaterThan(0); expect(pose.uniformScale).toBeLessThanOrEqual(1);
      expect(pose.registeredBounds.bottom).toBe(180);
      expect(pose.registeredBounds.left).toBeGreaterThanOrEqual(5);
      expect(pose.registeredBounds.right).toBeLessThanOrEqual(187);
      expect(pose.registeredBounds.top).toBeGreaterThanOrEqual(5);
      expect(Math.min(...pose.frame.clip)).toBeGreaterThanOrEqual(0);
    }
  });

  it("preserves every unaffected decoded RGBA pixel even inside the four updated packets", async () => {
    for (const packet of repair.packets) {
      const before = await sharp(readFileSync(`public${packet.original.src}`)).ensureAlpha().raw().toBuffer();
      const after = await sharp(readFileSync(`public${packet.replacement.src}`)).ensureAlpha().raw().toBuffer();
      expect(after.length).toBe(before.length);
      expect(packet).toMatchObject({ alphaChangedByEncoding: 0, visibleRgbChangedByEncoding: 0, transparentRgbChangedPixels: 0 });
      for (let column = 0; column < 16; column++) {
        let equal = true;
        for (let y = 0; y < 192; y++) {
          const start = ((Math.floor(column / 8) * 192 + y) * packet.original.width + column % 8 * 192) * 4;
          if (!before.subarray(start, start + 192 * 4).equals(after.subarray(start, start + 192 * 4))) equal = false;
        }
        expect(equal, `row${packet.row}/column${column}`).toBe(!packet.changedColumns.includes(column));
      }
    }
  });
});

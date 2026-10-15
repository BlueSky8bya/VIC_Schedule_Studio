import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import sprites from "@/lib/ui/viewer-companion/hd-motion-sprite.json";

const run = "art-src/빅타민/동행/작업회차/20261015-전동작고해상도";
const receipt = JSON.parse(fs.readFileSync(path.join(process.cwd(), run, "파생기록.json"), "utf8"));
const sha256 = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");

describe("delivered high-resolution companion packets", () => {
  it("ships every declared packet byte-for-byte and preserves all native source bytes", () => {
    for (const atlas of sprites.atlases) {
      const bytes = fs.readFileSync(path.join(process.cwd(), "public", atlas.src));
      expect(bytes.length).toBe(atlas.bytes); expect(sha256(bytes)).toBe(atlas.sha256);
      expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
    }
    for (const source of receipt.sources) {
      const bytes = fs.readFileSync(path.join(process.cwd(), source.path));
      expect(sha256(bytes)).toBe(source.sha256); expect(bytes.length).toBe(source.bytes);
    }
  });
  it("uses genuinely detailed source bodies for every phase including new moods", () => {
    expect(receipt.cells).toHaveLength(304);
    expect(receipt.generation).toMatchObject({ calls: 1, nativeMoodKeyposes: 16, approval: "NONE", independentReviews: 0 });
    expect(receipt.method).toMatchObject({ rgbFromLowResolutionPhaseSource: false, independentEyeWarp: false, resizeSamplingPasses: 1 });
    for (const cell of receipt.cells) {
      expect(["clean", "mood"]).toContain(cell.texture.sourceId);
      expect(cell.texture.genuineNativeBodyWidth).toBeGreaterThanOrEqual(140);
      expect(cell.texture.nativeFace.features.length).toBeGreaterThanOrEqual(2);
      expect(cell.faceProtection.sampledPixels).toBeGreaterThan(10);
      expect(cell.faceProtection.minimumRigidWeight).toBe(1);
      expect(cell.faceProtection.maximumFeatureDeviationNativePixels).toBeLessThanOrEqual(1e-10);
      const displayedBodyPixelsAtDpr2 = cell.body.width / sprites.cell * 92 * 2;
      expect(cell.texture.genuineNativeBodyWidth).toBeGreaterThan(displayedBodyPixelsAtDpr2);
      expect(cell.body.width).toBeGreaterThanOrEqual(displayedBodyPixelsAtDpr2);
      expect(cell.rgbaSha256).toMatch(/^[a-f0-9]{64}$/);
    }
    for (const row of [2, 4, 8, 9, 18, 19]) {
      const cells = sprites.rows[row].map(index => receipt.cells[index]);
      expect(new Set(cells.map(cell => cell.rgbaSha256)).size).toBeGreaterThan(4);
    }
    expect(receipt.output).toMatchObject({ frames: 304, alphaChangedPixelsDuringEncoding: 0, sourceBytesUnchanged: true, decodedBytesPerStrip: 2359296, threeStripWorkingSetMiB: 6.75, allNineteenDecodedMiB: 42.75 });
  });
});

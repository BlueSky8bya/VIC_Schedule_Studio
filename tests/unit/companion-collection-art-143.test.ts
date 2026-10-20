import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import fixture from "../fixtures/companion-collection-143-runtime.json";
import { COMPANION_COLLECTION_ATLASES, COMPANION_COLLECTION_FRAMES } from "@/lib/ui/viewer-companion/collection-art";
import { getCompanionFoodArtFrame } from "@/lib/ui/viewer-companion/food-art";
import { COMPANION_SNACK_EXPANSION_143 } from "@/lib/ui/viewer-companion/snack-expansion-143";
import { COMPANION_TOY_EXPANSION_143 } from "@/lib/ui/viewer-companion/toy-expansion-143";
import { COMPANION_TOY_VISUALS, getCompanionToyArt, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

/** This suite reads public runtime assets and a public-safe fingerprint fixture
 * only. Full native RGBA attribution belongs to the explicit art CLI --check,
 * outside the credential-free daily factory's source-archive boundary. */
describe("143 public runtime collection art", () => {
  it("registers the exact60 food cells and36 toy files using only public technical fingerprints", () => {
    expect(Object.keys(COMPANION_COLLECTION_FRAMES.food)).toHaveLength(240);
    expect(Object.keys(COMPANION_COLLECTION_FRAMES["food-stamp"])).toHaveLength(240);
    expect(fixture.foods.map(x => x.id)).toEqual(COMPANION_SNACK_EXPANSION_143.map(x => x.id));
    expect(fixture.toys.map(x => x.id)).toEqual(COMPANION_TOY_EXPANSION_143.map(x => x.id));
    expect(fixture.runtimeFiles).toHaveLength(41); expect(new Set(fixture.runtimeFiles.map(x => x.src)).size).toBe(41);
    expect(fixture.sourceArtifactFingerprints).toHaveLength(8);
    for (const source of fixture.sourceArtifactFingerprints) { expect(source.sheet).toMatch(/^(food-[1-5]|toy-[1-3])$/); expect(source.sha256).toMatch(/^[a-f0-9]{64}$/); }
    for (const item of COMPANION_SNACK_EXPANSION_143) {
      const frame = COMPANION_COLLECTION_FRAMES.food[item.id], runtime = getCompanionFoodArtFrame(item.id)!;
      expect(COMPANION_COLLECTION_FRAMES["food-stamp"][item.id]).toEqual(frame);
      expect(frame).toMatchObject({ index: COMPANION_SNACK_EXPANSION_143.indexOf(item) % 12, width: 128, height: 128 });
      expect(runtime).toMatchObject({ src: COMPANION_COLLECTION_ATLASES[frame.atlas]!.src, atlasWidth: 512, atlasHeight: 384, x: frame.x, y: frame.y, width: 128, height: 128 });
    }
  });
  it("verifies all41 actual runtime bytes, dimensions and full decoded RGBA fingerprints", async () => {
    for (const record of fixture.runtimeFiles) {
      expect(record.src).toMatch(/^\/companion\/(collection\/foods-143-[1-5]-v1|home\/143\/toy-[a-z-]+)\.webp$/);
      const bytes = readFileSync(`public${record.src}`); expect(sha(bytes)).toBe(record.sha256); expect(bytes.length).toBe(record.bytes);
      const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([decoded.info.width, decoded.info.height]).toEqual(record.size); expect(sha(decoded.data)).toBe(record.decodedRgbaSha256);
    }
    for (const cell of fixture.foods) {
      const frame = COMPANION_COLLECTION_FRAMES.food[cell.id], atlas = COMPANION_COLLECTION_ATLASES[frame.atlas]!;
      expect(frame).toMatchObject({ atlas: cell.atlasId, x: cell.x, y: cell.y, width: cell.width, height: cell.height });
      const bytes = readFileSync(`public${atlas.src}`); expect(sha(bytes)).toBe(atlas.sha256);
      const actual = await sharp(bytes).extract({ left: frame.x, top: frame.y, width: 128, height: 128 }).ensureAlpha().raw().toBuffer(); expect(sha(actual), cell.id).toBe(cell.decodedRgbaSha256);
      let edgeAlpha = 0; for (let i = 0; i < 128; i++) edgeAlpha += actual[(i * 128) * 4 + 3] + actual[(i * 128 + 127) * 4 + 3] + actual[i * 4 + 3] + actual[(127 * 128 + i) * 4 + 3]; expect(edgeAlpha).toBe(0);
    }
  });
  it("keeps whole sprites inside44px while correcting the six tiny contained silhouettes", () => {
    const corrected = new Set(["bubble-wand", "boomerang", "flying-disc", "harmonica", "cup-and-ball", "paddle-ball"]);
    for (const item of fixture.toys) {
      const id = item.id as CompanionToyKind, visual = COMPANION_TOY_VISUALS[id], scale = Math.min(visual.width / item.size[0], visual.height / item.size[1]);
      expect(getCompanionToyArt(id)).toBe(item.src);
      expect(visual.width).toBeLessThanOrEqual(44); expect(visual.height).toBeLessThanOrEqual(44);
      expect(item.size[0] * scale).toBeLessThanOrEqual(44); expect(item.size[1] * scale).toBeLessThanOrEqual(44);
      if (corrected.has(id)) expect(Math.max(item.content.width * scale, item.content.height * scale), id).toBeGreaterThanOrEqual(26);
    }
  });
});

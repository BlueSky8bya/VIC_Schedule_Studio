import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import { resolveCompanionWindowScene, type CompanionWindowPhase } from "@/lib/ui/viewer-companion/home-window-scene";

type FileProof = { path: string; sha256: string; bytes: number };
type Asset = { season: SeasonKey; phase: CompanionWindowPhase; source_crop: number[]; png: FileProof; runtime: FileProof & { url: string }; runtime_size: number[]; native_crop_size: number[]; png_webp_decoded_rgba_equal: boolean; native_png_crop_rgba_equal: boolean };
const run = "art-src/빅타민/동행/작업회차/20261020-창밖사계절141";
const manifest = JSON.parse(readFileSync(`${run}/공개납품명세.json`, "utf8")) as {
  native: FileProof; assets: Asset[]; generation: { builtin_calls: number; automatic_retries: number; user_visual_approval: boolean };
  compression: { runtime_total_bytes: number; prior125_pack_bytes: number; runtime_source_pixel_identity: boolean; source_crop_pixel_identity: boolean };
};
const phases = { dawn: "dawn", day: "noon", dusk: "dusk", night: "night" } as const;
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex").toUpperCase();

describe("141 seasonal window delivery boundary", () => {
  it("ships one unique complete, opaque and bounded static file for every shared season/phase", async () => {
    expect(manifest.assets).toHaveLength(16);
    expect(new Set(manifest.assets.map(asset => `${asset.season}:${asset.phase}`)).size).toBe(16);
    expect(new Set(manifest.assets.map(asset => asset.runtime.sha256)).size).toBe(16);
    let bytes = 0;
    for (const asset of manifest.assets) {
      const scene = resolveCompanionWindowScene({ season: asset.season, band: phases[asset.phase], date: { y: 2026, m: 1, d: 1 }, hour: 12, night: false, weather: "clear" });
      expect(scene.landscapeSrc).toBe(asset.runtime.url);
      expect(`public${scene.landscapeSrc}`).toBe(asset.runtime.path);
      const file = readFileSync(asset.runtime.path), metadata = await sharp(file).metadata();
      expect(hash(file)).toBe(asset.runtime.sha256); expect(file.length).toBe(asset.runtime.bytes);
      expect(metadata.format).toBe("webp"); expect(metadata.width).toBe(256); expect(metadata.height).toBe(192);
      expect(metadata.hasAlpha).toBe(false); expect(metadata.pages ?? 1).toBe(1);
      expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined(); expect(metadata.xmp).toBeUndefined();
      bytes += file.length;
    }
    expect(bytes).toBe(manifest.compression.runtime_total_bytes);
    expect(bytes).toBeLessThan(manifest.compression.prior125_pack_bytes);
    expect(bytes).toBeLessThan(256_000);
  });

  it("preserves every native crop exactly and distinguishes source parity from lossy runtime compression", async () => {
    const nativeFile = readFileSync(manifest.native.path);
    expect(hash(nativeFile)).toBe(manifest.native.sha256);
    const native = await sharp(nativeFile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const asset of manifest.assets) {
      const [left, top, right, bottom] = asset.source_crop;
      const file = readFileSync(asset.png.path), crop = await sharp(file).ensureAlpha().raw().toBuffer();
      expect(hash(file)).toBe(asset.png.sha256);
      const expected = await sharp(native.data, { raw: native.info }).extract({ left, top, width: right - left, height: bottom - top }).raw().toBuffer();
      expect(crop.equals(expected)).toBe(true);
      expect(asset.native_crop_size).toEqual([356, 267]); expect(asset.runtime_size).toEqual([256, 192]);
      expect(asset.native_png_crop_rgba_equal).toBe(true); expect(asset.png_webp_decoded_rgba_equal).toBe(false);
      // A bounded codec-difference check catches a wrong/blank phase image.
      // It does not certify style or replace actual small-window inspection.
      const resized = await sharp(file).resize(256, 192, { kernel: "lanczos3" }).removeAlpha().raw().toBuffer();
      const actual = await sharp(asset.runtime.path).removeAlpha().raw().toBuffer();
      expect(actual.length).toBe(resized.length);
      const error = actual.reduce((sum, value, index) => sum + Math.abs(value - resized[index]), 0) / actual.length;
      expect(error).toBeLessThan(8);
    }
    expect(manifest.compression.source_crop_pixel_identity).toBe(true);
    expect(manifest.compression.runtime_source_pixel_identity).toBe(false);
    expect(manifest.generation).toMatchObject({ builtin_calls: 1, automatic_retries: 0, user_visual_approval: false });
  });
});

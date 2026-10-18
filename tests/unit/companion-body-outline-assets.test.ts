import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import hd from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import play from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

const run = "art-src/빅타민/동행/작업회차/20261018-체형외곽선통일";
const canonical = { clean: [0, 41, 148, 300, 317], mood: [0, 36, 125, 309, 320], play: [18, 35, 710, 213, 819], ear: [2, 98, 795, 578, 1161], recovery: [3, 668, 818, 1195, 1200], throw: [2, 82, 764, 603, 1152], audience: [0, 55, 142, 275, 316] } as const;
type Family = keyof typeof canonical;
type FileProof = { path: string; sha256: string };
type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Frame = { atlas: number; index: number; x: number; y: number; clip: number[] };
type Atlas = { src: string; sha256: string; bytes: number; width: number; height: number };
type Profile = { key: number; sourceSha256: string; bodyBounds: Pick<Box, "left" | "top" | "right" | "bottom">; targetBodyWidth: number; requestedScale: number };
type Fit = { requestedScale: number; scale: number; safetyCapped: boolean; protectedBounds: Pick<Box, "left" | "top" | "right" | "bottom"> };
type Source = FileProof & { width: number; height: number; grid: number; count: number; provenance: string; provenanceSha256: string; keys: Array<{ key: number; box: Pick<Box, "left" | "top" | "width" | "height">; rgbaSha256: string; completeBodyPreserved: boolean }> };
type Slot = { index: number; family: Exclude<Family, "audience">; key: number; activeLive: boolean; source: string; sourceSha256: string; cropRgbaSha256: string; alphaSha256: string; frame: Frame; familyRegistration: Fit; uniformScale?: number; textureScale?: number; anchor: { centerX: number; footY: number } };
type Packet = Atlas & { index: number; previous: Atlas; alphaSha256: string; alphaChangedPixels: number };
type Receipt = {
  manifest: string; manifestSha256: string; generationCallsByThisScript: number; ownerVisualApproval: string; sources: Record<Family, Source>; protectedSources: FileProof[]; protectedPackets: FileProof[];
  familyBodyRegistration: { version: number; mode: string; bodyWidth: number; audienceBodyWidth: number; families: Record<Family, Profile> };
  coverage: { physicalSlots: number; actualActionReferencedSlots: number; liveKeyCount: number; allSlotsHaveNewSource: boolean; fallbackOldRgbSlots: number };
  slots: Slot[]; packets: Packet[]; stagedMetadata: Record<"hd" | "play", string>; baseline: Record<"hd" | "play", FileProof>;
  audience: { output: string; sha256: string; bytes: number; runtimeExclusionsPreserved: number[]; frames: Array<{ key: number; commonScale: number; alphaSha256: string; visibleAlphaPixelsClipped: number; familyRegistration: Fit }> };
};
const json = <T,>(name: string): T => JSON.parse(readFileSync(name, "utf8")) as T;
const receipt = json<Receipt>(`${run}/패킹파생기록.json`);
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function alphaHash(bytes: Buffer) { const alpha = Buffer.alloc(bytes.length / 4); for (let i = 0; i < alpha.length; i++) alpha[i] = bytes[i * 4 + 3]; return hash(alpha); }
function crop(bytes: Buffer, width: number, height: number, box: Source["keys"][number]["box"]) {
  const out = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const yy = box.top + y, left = Math.max(0, box.left), right = Math.min(width, box.left + box.width);
    if (yy < 0 || yy >= height || left >= right) continue;
    bytes.copy(out, (y * box.width + left - box.left) * 4, (yy * width + left) * 4, (yy * width + right) * 4);
  }
  return out;
}

describe("101 complete body/outline style activation", () => {
  it("pins all seven actual source sheets and preserves the chosen eye-size reference bytes", async () => {
    const manifestBytes = readFileSync(`${run}/패킹입력.json`), manifest = JSON.parse(manifestBytes.toString("utf8")) as { protectedInputs: FileProof[]; selectedEyeSizeOnly: FileProof & { scope: string }; bodyProfile: { anatomicalCertification: string } };
    expect(hash(manifestBytes)).toBe(receipt.manifestSha256); expect(receipt.manifest).toBe(`${run}/패킹입력.json`);
    expect(receipt.generationCallsByThisScript).toBe(0); expect(receipt.ownerVisualApproval).toBe("NOT_ESTABLISHED_BY_PACKING");
    expect(manifest.bodyProfile.anatomicalCertification).toBe("NOT_ESTABLISHED_BY_REGISTRATION");
    expect(manifest.selectedEyeSizeOnly).toMatchObject({ sha256: "83fd71b3bafdc72587f786bdba800ffb52d7034fc6e66aa1205ecf8b3e5eea68", scope: "mascot_eye_size_clean_key0_only" });
    for (const file of [...manifest.protectedInputs, ...receipt.protectedSources, ...receipt.protectedPackets]) expect(hash(readFileSync(file.path)), file.path).toBe(file.sha256);
    expect(Object.keys(receipt.sources).sort()).toEqual(Object.keys(canonical).sort());
    const previous = new Set(receipt.protectedSources.map(source => source.sha256)); let count = 0;
    for (const [family, source] of Object.entries(receipt.sources) as Array<[Family, Source]>) {
      const native = readFileSync(source.path), provenanceBytes = readFileSync(source.provenance), provenance = JSON.parse(provenanceBytes.toString("utf8")) as { sha256: string };
      expect(source.path.startsWith(`${run}/`)).toBe(true); expect(hash(native)).toBe(source.sha256); expect(previous.has(source.sha256)).toBe(false);
      expect(hash(provenanceBytes)).toBe(source.provenanceSha256); expect(provenance.sha256.toLowerCase()).toBe(source.sha256);
      const decoded = await sharp(native).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([decoded.info.width, decoded.info.height]).toEqual([source.width, source.height]);
      expect(source.keys).toHaveLength(family === "play" ? 36 : ["ear", "recovery", "throw"].includes(family) ? 4 : 16);
      for (const key of source.keys) { expect(key.completeBodyPreserved).toBe(true); expect(hash(crop(decoded.data, source.width, source.height, key.box))).toBe(key.rgbaSha256); count++; }
    }
    expect(count).toBe(96);
  }, 30_000);

  it("activates the new packets on every runtime slot and the premiere consumer with unchanged logical actions", () => {
    for (const family of ["hd", "play"] as const) expect(readFileSync(`lib/ui/viewer-companion/${family}-motion-sprite.json`).equals(readFileSync(receipt.stagedMetadata[family]))).toBe(true);
    const beforeHd = json<{ rows: number[][] }>(receipt.baseline.hd.path), beforePlay = json<{ rows: number[][] }>(receipt.baseline.play.path);
    expect(hd.rows).toEqual(beforeHd.rows); expect(play.rows).toEqual(beforePlay.rows);
    expect(companionSpriteMetadata.frames).toHaveLength(512); expect(companionSpriteMetadata.rows).toHaveLength(33);
    expect(receipt.coverage).toMatchObject({ physicalSlots: 512, actualActionReferencedSlots: 450, liveKeyCount: 71, allSlotsHaveNewSource: true, fallbackOldRgbSlots: 0 });
    expect(receipt.slots).toHaveLength(512); expect(receipt.slots.filter(slot => slot.activeLive)).toHaveLength(450);
    for (const slot of receipt.slots) {
      const source = receipt.sources[slot.family]; expect(slot.source).toBe(source.path); expect(slot.sourceSha256).toBe(source.sha256); expect(slot.cropRgbaSha256).toBe(source.keys[slot.key].rgbaSha256);
      expect(slot.frame).toEqual((slot.index < 304 ? hd : play).frames[slot.index < 304 ? slot.index : slot.index - 304]);
      expect(slot.anchor).toEqual({ centerX: 40, footY: 80 });
    }
    const css = readFileSync("components/poster/premiere/premiere-stage.css", "utf8");
    expect(css).toContain("url('/premiere/victamin-audience-body-outline-v1.webp')"); expect(css).not.toContain("url('/premiere/victamin-audience-big-eyes-v1.webp')");
    expect(receipt.audience.runtimeExclusionsPreserved).toEqual([9, 10]);
  });

  it("uses one measured isotropic body scale per family, with whole-pose safety caps as its only per-frame exception", () => {
    const profile = receipt.familyBodyRegistration;
    expect(profile).toMatchObject({ version: 1, mode: "family-body-isotropic", bodyWidth: 130, audienceBodyWidth: 166 });
    for (const family of Object.keys(canonical) as Family[]) {
      const [key, left, top, right, bottom] = canonical[family], selected = profile.families[family];
      expect(selected).toMatchObject({ key, sourceSha256: receipt.sources[family].sha256, bodyBounds: { left, top, right, bottom }, targetBodyWidth: family === "audience" ? 166 : 130 });
      expect(selected.requestedScale).toBe((family === "audience" ? 166 : 130) / (right - left));
    }
    for (const slot of receipt.slots) {
      const fit = slot.familyRegistration, bounds = fit.protectedBounds;
      expect(fit.requestedScale).toBe(profile.families[slot.family].requestedScale); expect(fit.scale).toBe(slot.uniformScale ?? slot.textureScale);
      expect(fit.scale).toBeGreaterThan(0); expect(fit.scale).toBeLessThanOrEqual(fit.requestedScale); expect(fit.safetyCapped).toBe(fit.scale < fit.requestedScale);
      expect(bounds.left).toBeGreaterThanOrEqual(5); expect(bounds.top).toBeGreaterThanOrEqual(5); expect(bounds.right).toBeLessThanOrEqual(187); expect(bounds.bottom).toBeLessThanOrEqual(187);
    }
  });

  it("pins all 512+16 decoded alpha planes while retaining the same 32-packet decode budget", async () => {
    const active = [...hd.atlases, ...play.atlases]; expect(active).toHaveLength(32); expect(receipt.packets).toHaveLength(32);
    for (const packet of receipt.packets) {
      expect(active[packet.index]).toEqual({ src: packet.src, sha256: packet.sha256, bytes: packet.bytes, width: 1536, height: 384 });
      expect(packet.src).toBe(packet.previous.src.replace(/\.webp$/, "-body-outline-v1.webp")); expect(packet.alphaChangedPixels).toBe(0);
      const bytes = readFileSync(`public${packet.src}`); expect(hash(bytes)).toBe(packet.sha256); expect(bytes.length).toBe(packet.bytes);
      const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([decoded.info.width, decoded.info.height]).toEqual([1536, 384]); expect(alphaHash(decoded.data)).toBe(packet.alphaSha256);
      for (let index = 0; index < 16; index++) expect(alphaHash(crop(decoded.data, 1536, 384, { left: index % 8 * 192, top: Math.floor(index / 8) * 192, width: 192, height: 192 }))).toBe(receipt.slots[packet.index * 16 + index].alphaSha256);
    }
    expect(1536 * 384 * 4 * 3 / 1024 ** 2).toBe(6.75);
    const audience = receipt.audience, bytes = readFileSync(audience.output); expect(audience.output).toBe("public/premiere/victamin-audience-body-outline-v1.webp"); expect(hash(bytes)).toBe(audience.sha256); expect(bytes.length).toBe(audience.bytes);
    const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); expect([decoded.info.width, decoded.info.height]).toEqual([1024, 1024]);
    expect(audience.frames).toHaveLength(16); expect(new Set(audience.frames.map(frame => frame.commonScale)).size).toBe(1);
    for (const [index, frame] of audience.frames.entries()) { expect(frame.visibleAlphaPixelsClipped).toBe(0); expect(frame.familyRegistration.requestedScale).toBe(receipt.familyBodyRegistration.families.audience.requestedScale); expect(alphaHash(crop(decoded.data, 1024, 1024, { left: index % 4 * 256, top: Math.floor(index / 4) * 256, width: 256, height: 256 }))).toBe(frame.alphaSha256); }
  }, 30_000);
});

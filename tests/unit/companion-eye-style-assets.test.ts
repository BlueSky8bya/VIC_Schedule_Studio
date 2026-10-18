import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

const run = "art-src/빅타민/동행/작업회차/20261018-큰눈통일";
const families = { clean: [4, 16], mood: [4, 16], play: [6, 36], ear: [2, 4], recovery: [2, 4], throw: [2, 4], audience: [4, 16] } as const;
type Family = keyof typeof families;
type FileProof = { path: string; sha256: string };
type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Frame = { atlas: number; index: number; x: number; y: number; clip: number[] };
type Atlas = { src: string; sha256: string; bytes: number; width: number; height: number };
type SourceKey = { key: number; box: Pick<Box, "left" | "top" | "width" | "height">; rgbaSha256: string; completeBodyPreserved: boolean };
type Source = FileProof & { bytes: number; width: number; height: number; grid: number; count: number; provenance: string; provenanceSha256: string; registrationStatus: string; approvalAtPacking: string; artReviewAtPacking: string; keys: SourceKey[] };
type Slot = {
  index: number; family: Exclude<Family, "audience">; key: number; live: boolean; activeLive: boolean;
  source: string; sourceSha256: string; cropRgbaSha256: string; rgbaSha256: string; alphaSha256: string;
  frame: Frame; body: Box; visibleBounds: Box; anchor: { centerX: number; footY: number };
  rig?: unknown; textureScale?: number; uniformScale?: number;
  faceProtection?: { sampled: number; minimumRigidWeight: number; maximumFeatureDeviation: number };
};
type Packet = Atlas & { index: number; previous: Atlas; slots: number[]; rgbaSha256: string; alphaSha256: string; alphaChangedPixels: number };
type Receipt = {
  version: number; manifest: string; manifestSha256: string; generationCallsByThisScript: number; automaticArtReviews: number; ownerVisualApproval: string;
  cell: number; logicalCell: number; physicalFoot: number;
  lineage: Record<string, FileProof>; baseline: Record<"hd" | "play" | "audience", FileProof>;
  protectedSources: FileProof[]; protectedPackets: FileProof[]; sources: Record<Family, Source>;
  coverage: { physicalSlots: number; logicalRows: number; packetCount: number; rawLogicalReferencedSlots: number; actualActionReferencedSlots: number; compatibilityOnlySlots: number[]; liveKeyCount: number; liveKeys: string[]; deadSlots: number[]; allSlotsHaveNewSource: boolean; fallbackOldRgbSlots: number };
  slots: Slot[]; packets: Packet[]; stagedMetadata: Record<"hd" | "play", string>;
  audience: { source: string; sourceSha256: string; output: string; sha256: string; bytes: number; width: number; height: number; grid: number; keys: number; runtimeExclusionsPreserved: number[]; frames: Array<{ key: number; alphaSha256: string; commonScale: number; transparentPaddingOnlyTrimmed: boolean; visibleAlphaPixelsClipped: number; alphaBounds: Box }> };
};
const json = <T,>(name: string): T => JSON.parse(readFileSync(name, "utf8")) as T;
const receipt = json<Receipt>(`${run}/패킹파생기록.json`);
// 098 remains immutable release evidence after later styles are activated.
const hd = json<{ rows: number[][]; frames: Frame[]; atlases: Atlas[] }>(receipt.stagedMetadata.hd);
const play = json<{ rows: number[][]; frames: Frame[]; atlases: Atlas[] }>(receipt.stagedMetadata.play);
//098's receipt covers the immutable33-row/512-slot prefix. Later living keys
// append their own registration and receipts; they do not alter this coverage.
const protectedRows = companionSpriteMetadata.rows.slice(0, 33);
const protectedFrames = companionSpriteMetadata.frames.slice(0, 512);
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const alpha = (rgba: Buffer) => {
  const bytes = Buffer.alloc(rgba.length / 4);
  for (let i = 0; i < bytes.length; i++) bytes[i] = rgba[i * 4 + 3];
  return bytes;
};
function crop(rgba: Buffer, width: number, height: number, box: SourceKey["box"]): Buffer {
  const output = Buffer.alloc(box.width * box.height * 4);
  for (let y = 0; y < box.height; y++) {
    const fromY = y + box.top, left = Math.max(0, box.left), right = Math.min(width, box.left + box.width);
    if (fromY < 0 || fromY >= height || right <= left) continue;
    rgba.copy(output, (y * box.width + left - box.left) * 4, (fromY * width + left) * 4, (fromY * width + right) * 4);
  }
  return output;
}

describe("098 whole-source eye-style delivery, independently bound to actual files", () => {
  it("binds all96 new native keys to seven byte-identical draft generation receipts", async () => {
    const manifestBytes = readFileSync(`${run}/패킹입력.json`);
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as { sources: Record<Family, FileProof> };
    expect(receipt.manifest).toBe(`${run}/패킹입력.json`); expect(sha(manifestBytes)).toBe(receipt.manifestSha256);
    expect(receipt).toMatchObject({ version: 1, generationCallsByThisScript: 0, automaticArtReviews: 0, ownerVisualApproval: "NOT_ESTABLISHED_BY_PACKING", cell: 192, logicalCell: 80, physicalFoot: 180 });
    expect(Object.keys(receipt.sources).sort()).toEqual(Object.keys(families).sort());
    expect(new Set(Object.values(receipt.sources).map(source => source.sha256)).size).toBe(7);
    let keys = 0;
    for (const family of Object.keys(families) as Family[]) {
      const source = receipt.sources[family], native = readFileSync(source.path), registrationBytes = readFileSync(source.provenance);
      const registration = JSON.parse(registrationBytes.toString("utf8")) as { sha256: string; status: string; approval: string; full_review: string };
      expect(source.path).toBe(manifest.sources[family].path); expect(source.path.startsWith(`${run}/`)).toBe(true);
      expect(sha(native)).toBe(source.sha256); expect(source.sha256).toBe(manifest.sources[family].sha256); expect(native.length).toBe(source.bytes);
      expect(sha(registrationBytes)).toBe(source.provenanceSha256); expect(registration.sha256.toLowerCase()).toBe(source.sha256);
      expect(registration).toMatchObject({ status: "DRAFT_DELIVERED_FOR_USER_REVIEW", approval: "NONE", full_review: "NOT_REQUESTED" });
      expect(source).toMatchObject({ grid: families[family][0], count: families[family][1], registrationStatus: registration.status, approvalAtPacking: registration.approval, artReviewAtPacking: registration.full_review });
      expect(source.keys).toHaveLength(families[family][1]); expect(source.keys.map(key => key.key)).toEqual(Array.from({ length: source.count }, (_, i) => i));
      const decoded = await sharp(native).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([decoded.info.width, decoded.info.height, decoded.info.channels]).toEqual([source.width, source.height, 4]);
      for (const key of source.keys) {
        expect(key.completeBodyPreserved).toBe(true);
        expect(sha(crop(decoded.data, source.width, source.height, key.box))).toBe(key.rgbaSha256);
      }
      keys += source.keys.length;
    }
    expect(keys).toBe(96);
  }, 30_000);

  it("preserves historical originals and the separately staged33-row metadata", () => {
    expect(receipt.protectedSources).toHaveLength(8); expect(receipt.protectedPackets).toHaveLength(33);
    const beforeHdSources = json<{ sources: FileProof[] }>(receipt.lineage.hd.path).sources;
    const otherSources = ["play", "ear", "recovery", "throw"].map(id => {
      const original = json<{ source: string; sourceSha256: string }>(receipt.lineage[id].path);
      return { path: original.source, sha256: original.sourceSha256 };
    });
    const beforeAudience = json<{ native: string; sha256: string }>(receipt.lineage.audience.path);
    expect(receipt.protectedSources).toEqual([...beforeHdSources.map(source => ({ path: source.path, sha256: source.sha256 })), ...otherSources, { path: beforeAudience.native, sha256: beforeAudience.sha256 }]);
    const oldHashes = new Set(receipt.protectedSources.map(file => file.sha256));
    for (const file of [...receipt.protectedSources, ...receipt.protectedPackets, ...Object.values(receipt.lineage), ...Object.values(receipt.baseline)]) expect(sha(readFileSync(file.path)), file.path).toBe(file.sha256);
    for (const source of Object.values(receipt.sources)) expect(oldHashes.has(source.sha256)).toBe(false);
    for (const family of ["hd", "play"] as const) {
      expect(receipt.baseline[family].path).toBe(`${run}/고정입력/기존등록/${family}-motion-sprite.json`);
      expect(receipt.stagedMetadata[family]).toBe(`${run}/정리본/${family}-motion-sprite.json`);
      expect(json<{ frames: Frame[] }>(receipt.stagedMetadata[family]).frames).toEqual(receipt.slots.slice(family === "hd" ? 0 : 304, family === "hd" ? 304 : 512).map(slot => slot.frame));
    }
    const beforeHd = json<{ rows: number[][] }>(receipt.baseline.hd.path), beforePlay = json<{ rows: number[][] }>(receipt.baseline.play.path);
    expect(hd.rows).toEqual(beforeHd.rows); expect(play.rows).toEqual(beforePlay.rows);
    expect(protectedRows).toEqual([...beforeHd.rows, ...beforePlay.rows.map(row => row.map(index => index + 304))]);
    expect(protectedRows).toHaveLength(33); expect(protectedFrames).toHaveLength(512);
    for (const row of companionSpriteMetadata.rows.slice(33)) {
      expect(row.length).toBeGreaterThan(0);
      expect(row.every(index => Number.isInteger(index) && index >= 512 && index < companionSpriteMetadata.frames.length)).toBe(true);
    }
    expect(receipt.audience.runtimeExclusionsPreserved).toEqual([9, 10]);
  });

  it("maps every512 slot to new source bytes, preserving450 active slots and compatibility127", () => {
    expect(receipt.coverage).toMatchObject({ physicalSlots: 512, logicalRows: 33, packetCount: 32, rawLogicalReferencedSlots: 451, actualActionReferencedSlots: 450, compatibilityOnlySlots: [127], liveKeyCount: 71, allSlotsHaveNewSource: true, fallbackOldRgbSlots: 0 });
    expect(receipt.slots).toHaveLength(512); expect(receipt.slots.map(slot => slot.index)).toEqual(Array.from({ length: 512 }, (_, i) => i));
    const logical = new Set(protectedRows.flat()), active = new Set(protectedRows.flatMap((row, index) => index === 7 ? [] : row));
    expect(logical.size).toBe(451); expect(active.size).toBe(450);
    expect([...logical].filter(index => !active.has(index))).toEqual([127]);
    expect(receipt.coverage.deadSlots).toEqual(Array.from({ length: 512 }, (_, i) => i).filter(index => !logical.has(index)));
    expect(receipt.coverage.deadSlots).toHaveLength(61);
    const oldHd = json<{ cells: Array<{ rig: { sourceId: string; sourceIndex: number } }> }>(receipt.lineage.hd.path);
    const oldPlay = json<{ packets: Array<{ nativeIndicesByColumn: number[] }> }>(receipt.lineage.play.path);
    const ears = json<{ replacementIndices: number[] }>(receipt.lineage.ear.path), recovery = json<{ columns: number[] }>(receipt.lineage.recovery.path), airborne = json<{ columns: number[] }>(receipt.lineage.throw.path);
    for (const slot of receipt.slots) {
      const source = receipt.sources[slot.family], key = source.keys[slot.key];
      expect(slot.source).toBe(source.path); expect(slot.sourceSha256).toBe(source.sha256); expect(slot.cropRgbaSha256).toBe(key.rgbaSha256);
      expect(slot.live).toBe(logical.has(slot.index)); expect(slot.activeLive).toBe(active.has(slot.index));
      const localIndex = slot.index < 304 ? slot.index : slot.index - 304, metadata = slot.index < 304 ? hd : play;
      expect(slot.frame).toEqual(metadata.frames[localIndex]);
      if (slot.index < 304) {
        expect(slot.family).toBe(oldHd.cells[slot.index].rig.sourceId); expect(slot.key).toBe(oldHd.cells[slot.index].rig.sourceIndex); expect(slot.rig).toEqual(oldHd.cells[slot.index].rig);
        expect(slot.faceProtection?.sampled).toBeGreaterThan(10); expect(slot.faceProtection?.minimumRigidWeight).toBe(1); expect(slot.faceProtection?.maximumFeatureDeviation).toBeLessThanOrEqual(1e-10);
        expect(slot.textureScale).toBeGreaterThan(0);
      } else {
        const packet = Math.floor(localIndex / 16), column = localIndex % 16, originalKey = oldPlay.packets[packet]?.nativeIndicesByColumn[column], replacement = ears.replacementIndices.indexOf(originalKey);
        const expected = packet === 12 ? ["throw", airborne.columns[column]] : packet === 3 ? ["recovery", recovery.columns[column]] : replacement >= 0 ? ["ear", replacement] : ["play", originalKey];
        expect([slot.family, slot.key]).toEqual(expected); expect(slot.uniformScale).toBeGreaterThan(0); expect(slot.uniformScale).toBeLessThanOrEqual(1); expect(slot.rig).toBeUndefined();
      }
      expect(slot.anchor).toEqual({ centerX: 40, footY: 80 });
      expect(slot.visibleBounds.left).toBeGreaterThanOrEqual(5); expect(slot.visibleBounds.top).toBeGreaterThanOrEqual(5);
      expect(slot.visibleBounds.right).toBeLessThanOrEqual(187); expect(slot.visibleBounds.bottom).toBeLessThanOrEqual(187);
      expect(slot.visibleBounds.width).toBeLessThanOrEqual(192 * .76); expect(slot.visibleBounds.height).toBeLessThanOrEqual(192 * .82);
      expect([slot.frame.x, slot.frame.y, ...slot.frame.clip].every(Number.isFinite)).toBe(true); expect(Math.min(...slot.frame.clip)).toBeGreaterThanOrEqual(0);
    }
    const keys = [...new Set(receipt.slots.filter(slot => slot.live).map(slot => `${slot.family}:${slot.key}`))].sort();
    expect(keys).toHaveLength(71); expect(keys).toEqual(receipt.coverage.liveKeys);
  });

  it("ships exactly33 new public assets and preserves all512+16 decoded alpha planes within the32-packet budget", async () => {
    expect(receipt.packets).toHaveLength(32); expect(receipt.packets.map(packet => packet.index)).toEqual(Array.from({ length: 32 }, (_, i) => i));
    const currentAtlases = [...hd.atlases, ...play.atlases], newFiles = new Set<string>();
    const previousAtlases = [...json<{ atlases: Atlas[] }>(receipt.baseline.hd.path).atlases, ...json<{ atlases: Atlas[] }>(receipt.baseline.play.path).atlases];
    for (const packet of receipt.packets) {
      expect(packet.previous).toEqual(previousAtlases[packet.index]);
      expect(packet.src).toBe(packet.previous.src.replace(/\.webp$/, "-big-eyes-v1.webp"));
      expect(currentAtlases[packet.index]).toEqual({ src: packet.src, sha256: packet.sha256, bytes: packet.bytes, width: 1536, height: 384 });
      expect(packet.alphaChangedPixels).toBe(0); expect(packet.slots).toEqual(Array.from({ length: 16 }, (_, i) => packet.index * 16 + i));
      expect(receipt.protectedPackets.some(file => file.path === `public${packet.src}`)).toBe(false);
      const bytes = readFileSync(`public${packet.src}`); newFiles.add(packet.src);
      expect(sha(bytes)).toBe(packet.sha256); expect(bytes.length).toBe(packet.bytes); expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
      const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([decoded.info.width, decoded.info.height, decoded.info.channels]).toEqual([1536, 384, 4]);
      expect(sha(alpha(decoded.data))).toBe(packet.alphaSha256);
      for (let index = 0; index < 16; index++) {
        const rgba = crop(decoded.data, 1536, 384, { left: index % 8 * 192, top: Math.floor(index / 8) * 192, width: 192, height: 192 });
        expect(sha(alpha(rgba)), `slot${packet.index * 16 + index}`).toBe(receipt.slots[packet.index * 16 + index].alphaSha256);
      }
    }
    expect(currentAtlases).toHaveLength(32); expect(1536 * 384 * 4).toBe(2_359_296); expect(1536 * 384 * 4 * 3 / 1024 ** 2).toBe(6.75);
    const audience = receipt.audience, bytes = readFileSync(audience.output); newFiles.add(audience.output);
    expect(audience).toMatchObject({ output: "public/premiere/victamin-audience-big-eyes-v1.webp", source: receipt.sources.audience.path, sourceSha256: receipt.sources.audience.sha256, width: 1024, height: 1024, grid: 4, keys: 16 });
    expect(sha(bytes)).toBe(audience.sha256); expect(bytes.length).toBe(audience.bytes); expect(audience.frames).toHaveLength(16);
    const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([decoded.info.width, decoded.info.height, decoded.info.channels]).toEqual([1024, 1024, 4]);
    expect(new Set(audience.frames.map(frame => frame.commonScale)).size).toBe(1);
    for (const [index, frame] of audience.frames.entries()) {
      expect(frame).toMatchObject({ key: index, transparentPaddingOnlyTrimmed: true, visibleAlphaPixelsClipped: 0 });
      expect(frame.commonScale).toBeGreaterThan(0); expect(frame.commonScale).toBeLessThanOrEqual(1);
      expect(frame.alphaBounds.left).toBeGreaterThanOrEqual(4); expect(frame.alphaBounds.top).toBeGreaterThanOrEqual(4); expect(frame.alphaBounds.right).toBeLessThanOrEqual(252); expect(frame.alphaBounds.bottom).toBeLessThanOrEqual(252);
      expect(sha(alpha(crop(decoded.data, 1024, 1024, { left: index % 4 * 256, top: Math.floor(index / 4) * 256, width: 256, height: 256 })))).toBe(frame.alphaSha256);
    }
    expect(newFiles.size).toBe(33);
  }, 30_000);
});

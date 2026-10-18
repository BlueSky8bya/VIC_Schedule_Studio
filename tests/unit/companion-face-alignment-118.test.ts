import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import metadata from "../../art-src/빅타민/동행/작업회차/20261019-얼굴정렬교정118/정리본/hd-motion-sprite.json";
import anchors from "../../art-src/빅타민/동행/작업회차/20261019-얼굴정렬교정118/정리본/accessory-anchors.json";
import historicalPlay from "../../art-src/빅타민/동행/작업회차/20261018-동작연결정리115/정리본/play-motion-sprite.json";
import historicalLiving from "../../art-src/빅타민/동행/작업회차/20261018-동작연결정리115/정리본/living-motion-sprite.json";
import receipt from "../../art-src/빅타민/동행/작업회차/20261019-얼굴정렬교정118/패킹파생기록.json";
import composite from "../../art-src/빅타민/동행/작업회차/20261019-얼굴정렬교정118/합성범위.json";
import parentMetadata from "../../art-src/빅타민/동행/작업회차/20261019-얼굴정렬교정118/고정입력/hd-motion-sprite.json";
import parentAnchors from "../../art-src/빅타민/동행/작업회차/20261019-얼굴정렬교정118/고정입력/accessory-anchors.json";
import jump117 from "../../art-src/빅타민/동행/작업회차/20261018-점프노란조각교정117/패킹파생기록.json";

const run = "art-src/빅타민/동행/작업회차/20261019-얼굴정렬교정118";
const native114Sha = "8cfa1fd98c63eff8b06dba9d0950391509e60d194c878b5881a16176be245ba4";
const parentCropSha = "10eae4c5d8608498f7124468796187900222c8a079268b1bd33ffa91335a9e5e";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const readJson = <T,>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const cellOffset = (cell: number, x: number, y: number) => ((Math.floor(cell / 8) * 192 + y) * 1536 + cell % 8 * 192 + x) * 4;

// This measures the pinned raster components; it does not certify artwork.
function darkComponents(data: Buffer) {
  const seen = new Uint8Array(192 * 192), queue = new Int32Array(seen.length);
  const parts: Array<{ count: number; center: number[]; bounds: number[] }> = [];
  const dark = (p: number) => data[p * 4 + 3] > 160 && data[p * 4] < 120 && data[p * 4 + 1] < 100 && data[p * 4 + 2] < 90;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || !dark(start)) continue;
    let head = 0, count = 1, sx = 0, sy = 0, left = 192, top = 192, right = 0, bottom = 0;
    queue[0] = start; seen[start] = 1;
    while (head < count) {
      const p = queue[head++], x = p % 192, y = Math.floor(p / 192);
      sx += x + .5; sy += y + .5;
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (let yy = Math.max(0, y - 1); yy <= Math.min(191, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(191, x + 1); xx++) {
        const next = yy * 192 + xx;
        if (!seen[next] && dark(next)) { seen[next] = 1; queue[count++] = next; }
      }
    }
    parts.push({ count, center: [sx / count, sy / count], bounds: [left, top, right, bottom] });
  }
  return parts;
}

describe("118 source-bound yawn face conservation", () => {
  it("retains immutable native114 and the exact parent crop with one generation and one pre-correction review", async () => {
    expect(hash(readFileSync(receipt.parentNative.path))).toBe(native114Sha);
    expect(receipt.parentNative.sha256).toBe(native114Sha);
    expect(hash(readFileSync(`${run}/고정입력/현재114전체80키.png`))).toBe(native114Sha);
    const parent = readFileSync(`${run}/고정입력/하품키11_원본RGBA.png`);
    expect(hash(parent)).toBe(parentCropSha);
    const original = await sharp(receipt.parentNative.path).extract({ left: 301, top: 153, width: 108, height: 100 }).ensureAlpha().raw().toBuffer();
    const parentRaw = await sharp(parent).ensureAlpha().raw().toBuffer();
    expect(parentRaw.equals(original)).toBe(true);
    expect(hash(parentRaw)).toBe(composite.parentRgbaSha256);
    expect(hash(readFileSync(receipt.generatedNative.path))).toBe(receipt.generatedNative.sha256);
    expect(receipt).toMatchObject({ generationCalls: 1, independentArtReviews: 1, postGenerationArtReviews: 0, ownerApproval: false });
    expect(composite.generationCalls).toBe(1);
    const contract = readJson<{ requested_face_review: { review_calls: number }; generation_budget: { automatic_retry_calls: number; post_generation_art_review_calls: number } }>(`${run}/생성계약.json`);
    expect(contract.requested_face_review.review_calls).toBe(1);
    expect(contract.generation_budget).toMatchObject({ automatic_retry_calls: 0, post_generation_art_review_calls: 0 });
    const review = readJson<{ final_sha256: string; status: string }>(`${run}/검수/얼굴담당보고서.json`);
    expect(review.final_sha256.toLowerCase()).toBe(native114Sha);
    expect(review.status).toBe("FAIL");
  });

  it("changes source RGB only inside the explicit eyes/mouth mask minus protected cheeks, preserving every alpha byte", async () => {
    const before = await sharp(`${run}/고정입력/하품키11_원본RGBA.png`).ensureAlpha().raw().toBuffer();
    const { data: after, info } = await sharp(receipt.correctedKey.path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([108, 100, 4]);
    expect(hash(readFileSync(receipt.correctedKey.path))).toBe(receipt.correctedKey.sha256);
    const maskBytes = readFileSync(composite.mask);
    expect(hash(maskBytes)).toBe("629d4319919ae6006857538955f7e05e8819e4de63ed81ff559dd7f97d4d1cd2");
    expect(hash(maskBytes)).toBe(composite.maskSha256);
    const mask = await sharp(maskBytes).greyscale().raw().toBuffer();
    expect(mask).toHaveLength(108 * 100);
    expect(receipt.scope).toEqual([43, 49, 86, 74]);
    expect(composite.protectedCheekBoxes).toEqual([[31, 56, 46, 79], [82, 55, 99, 79]]);
    let changed = 0, changedChannels = 0, escaped = 0, alphaChanged = 0;
    for (let y = 0; y < 100; y++) for (let x = 0; x < 108; x++) {
      const p = (y * 108 + x) * 4;
      if (before[p + 3] !== after[p + 3]) alphaChanged++;
      if (before.subarray(p, p + 4).equals(after.subarray(p, p + 4))) continue;
      changed++;
      for (let c = 0; c < 4; c++) if (before[p + c] !== after[p + c]) changedChannels++;
      const cheek = composite.protectedCheekBoxes.some(([l, t, r, b]) => x >= l && x < r && y >= t && y < b);
      if (!mask[y * 108 + x] || x < 43 || x >= 86 || y < 49 || y >= 74 || cheek) escaped++;
    }
    expect(alphaChanged).toBe(0); expect(escaped).toBe(0);
    expect(changed).toBeGreaterThan(0); expect(changed).toBe(receipt.sourceChangedPixels);
    expect(changedChannels).toBe(receipt.sourceChangedChannels);
  });

  it("preserves old atlas16, every new alpha byte, all15 other cells and visible pixels outside the yawn change bounds", async () => {
    const oldBytes = readFileSync(`public${receipt.parentPacket.src}`), newBytes = readFileSync(`public${receipt.packet.src}`);
    expect(hash(oldBytes)).toBe("7ccd9be9d284d81c0b0b9c73f7ddd64c3dc23d23a334fe0f740d7d386831a088");
    expect(hash(oldBytes)).toBe(receipt.parentPacket.sha256); expect(oldBytes.length).toBe(receipt.parentPacket.bytes);
    expect(hash(newBytes)).toBe(receipt.packet.sha256); expect(newBytes.length).toBe(receipt.packet.bytes);
    const before = await sharp(oldBytes).ensureAlpha().raw().toBuffer();
    const { data: after, info } = await sharp(newBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([1536, 384]);
    let alphaChanges = 0, protectedVisibleChanges = 0, yawnChanges = 0;
    const otherCellChanges = Array<number>(16).fill(0), bounds = receipt.changedBounds;
    for (let cell = 0; cell < 16; cell++) for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
      const p = cellOffset(cell, x, y);
      if (before[p + 3] !== after[p + 3]) alphaChanges++;
      // Lossless encoding may normalize invisible RGB; alpha and every
      // visible channel outside the requested face must remain exact.
      const visibleDiff = Boolean(before[p + 3] || after[p + 3]) && [0, 1, 2].some(c => before[p + c] !== after[p + c]);
      if (cell !== 10) { if (visibleDiff || before[p + 3] !== after[p + 3]) otherCellChanges[cell]++; }
      else if (visibleDiff) {
        yawnChanges++;
        if (x < bounds.left || x >= bounds.right || y < bounds.top || y >= bounds.bottom) protectedVisibleChanges++;
      }
    }
    expect(alphaChanges).toBe(0); expect(protectedVisibleChanges).toBe(0);
    expect(otherCellChanges).toEqual(Array(16).fill(0));
    // The receipt counts1604 pre-encoding bake changes. Two new values
    // already match the old lossy decoded packet, leaving1602 visible diffs.
    expect(yawnChanges).toBe(1602); expect(yawnChanges).toBeLessThanOrEqual(receipt.changedPixels);
  });

  it("keeps all rows/frames and the other32 atlas references from the frozen117 parent", () => {
    // These are the exact post118 artifacts. Later119 changes have their own
    // conservation tests and cannot rewrite the historical118 contract.
    const historicalAtlases = [...metadata.atlases, ...historicalPlay.atlases, ...historicalLiving.atlases];
    const historicalRows = [...metadata.rows, ...historicalPlay.rows.map(row => row.map(index => index + metadata.frames.length)), ...historicalLiving.rows.map(row => row.map(index => index + metadata.frames.length + historicalPlay.frames.length))];
    expect({ ...metadata, atlases: parentMetadata.atlases }).toEqual(parentMetadata);
    expect(metadata.atlases[16]).toEqual(receipt.packet);
    expect(historicalRows).toEqual(parentAnchors.rows);
    expect(historicalAtlases).toHaveLength(33);
    expect(anchors.sources).toEqual(historicalAtlases.map(({ src, sha256, bytes }) => ({ src, sha256, bytes })));
    for (const [index, atlas] of historicalAtlases.entries()) {
      const source = { src: atlas.src, sha256: atlas.sha256, bytes: atlas.bytes };
      expect(source).toEqual(index === 16 ? { src: receipt.packet.src, sha256: receipt.packet.sha256, bytes: receipt.packet.bytes } : parentAnchors.sources[index]);
    }
    expect(metadata.frames[266]).toEqual(receipt.parentFrame);
    expect(metadata.atlases[4]).toEqual(jump117.packet);
    expect(hash(readFileSync(`public${jump117.packet.src}`))).toBe(jump117.packet.sha256);
    expect(new Set(metadata.rows[10])).toEqual(new Set([266]));
  });

  it("preserves the other519 anchor records and binds yawn eyes to the two closed arcs instead of the separate mouth", async () => {
    const frozen = readFileSync(`${run}/정리본/accessory-anchors.json`);
    expect(hash(frozen)).toBe("e66bc660db56d4e6bafacffc915341e05d81b6a1e9a5eb2e04a12a7074ad6f3a");
    expect(frozen.equals(readFileSync("art-src/빅타민/동행/작업회차/20261019-표정체적교정119/고정입력/accessory-anchors.json"))).toBe(true);
    expect(anchors.frames).toHaveLength(520);
    expect(anchors.rows).toEqual(parentAnchors.rows);
    for (let index = 0; index < anchors.frames.length; index++) if (index !== 266) expect(anchors.frames[index]).toEqual(parentAnchors.frames[index]);
    const face = anchors.frames[266];
    expect(face).toMatchObject({ physicalIndex: 266, atlas: 16, index: 10, bodyBounds: parentAnchors.frames[266].bodyBounds });
    const raw = await sharp(`public${receipt.packet.src}`).extract({ left: 384, top: 192, width: 192, height: 192 }).ensureAlpha().raw().toBuffer();
    const features = darkComponents(raw).filter(p => p.center[0] > 80 && p.center[0] < 140 && p.center[1] > 114 && p.center[1] < 147);
    const eyes = [18, 25].map(count => features.find(p => p.count === count)!);
    const mouth = features.find(p => p.count === 28)!;
    expect(eyes.every(Boolean)).toBe(true); expect(mouth).toBeDefined(); expect(face.eyes).toHaveLength(2);
    for (const [index, eye] of eyes.entries()) {
      for (let axis = 0; axis < 2; axis++) expect(face.eyes[index].center[axis]).toBeCloseTo(eye.center[axis] / 2.4, 5);
      for (let edge = 0; edge < 4; edge++) expect(face.eyes[index].bounds[edge]).toBeCloseTo(eye.bounds[edge] / 2.4, 5);
      expect(Math.hypot(...eye.center.map((value, axis) => value - mouth.center[axis]))).toBeGreaterThan(12);
    }
    expect(eyes[0].center[0]).toBeCloseTo(91.166667, 5); expect(eyes[0].center[1]).toBe(124.5);
    expect(eyes[1].center).toEqual([123.26, 123.46]);
    expect(mouth.center[0]).toBeGreaterThan(eyes[0].center[0]); expect(mouth.center[0]).toBeLessThan(eyes[1].center[0]);
    expect(mouth.center[1]).toBeGreaterThan(Math.max(...eyes.map(eye => eye.center[1])));
  });

  it("reproduces the scoped118 packet, receipt and metadata without writing", () => {
    const report = JSON.parse(execFileSync(process.execPath, ["scripts/prepare-companion-face-alignment-118.mjs", "--check", "--artifacts-only"], { encoding: "utf8" }));
    expect(report).toMatchObject({ check: true, artifactsOnly: true, physicalIndex: 266, sourceChangedPixels: receipt.sourceChangedPixels, changedPixels: receipt.changedPixels, registrationPreserved: true, packet: receipt.packet.src });
  }, 15_000);

  it("rejects artifact-only mode without the read-only check flag", () => {
    expect(() => execFileSync(process.execPath, ["scripts/prepare-companion-face-alignment-118.mjs", "--artifacts-only"], { encoding: "utf8", stdio: "pipe" })).toThrow("--artifacts-only requires --check");
  });

  it("allows only the frozen118 parent or intended output in the shared metadata ownership guard", () => {
    const metadataPath = "lib/ui/viewer-companion/hd-motion-sprite.json", before = hash(readFileSync(metadataPath));
    const result = execFileSync(process.execPath, ["--input-type=module", "-e", `
      import fs from 'node:fs';
      import { assertCompanionMetadataOwnership as guard } from './scripts/prepare-companion-jump-tuft-117.mjs';
      const parent=JSON.parse(fs.readFileSync('${run}/고정입력/hd-motion-sprite.json','utf8'));
      const receipt=JSON.parse(fs.readFileSync('${run}/패킹파생기록.json','utf8'));
      const intended=structuredClone(parent);intended.atlases[16]=receipt.packet;
      guard(structuredClone(parent),parent,intended);guard(structuredClone(intended),parent,intended);
      const unrelated=structuredClone(intended);unrelated.atlases[0].src='/companion/unrelated-later-packet.webp';
      let rejected=false;try{guard(unrelated,parent,intended);}catch(error){rejected=error.message.includes('unrelated active metadata');}
      console.log(JSON.stringify({parentAccepted:true,intendedAccepted:true,unrelatedRejected:rejected}));
    `], { encoding: "utf8" });
    expect(JSON.parse(result)).toEqual({ parentAccepted: true, intendedAccepted: true, unrelatedRejected: true });
    expect(hash(readFileSync(metadataPath))).toBe(before);
  });
});

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import hd from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import play from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import living from "@/lib/ui/viewer-companion/living-motion-sprite.json";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";

const run = "art-src/빅타민/동행/작업회차/20261018-포즈통일114";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const json = <T,>(name: string): T => JSON.parse(readFileSync(name, "utf8")) as T;
type Frame = { atlas: number; index: number; x: number; y: number; clip: number[] };
type Atlas = { src: string; sha256: string; bytes: number; width: number; height: number };
type Key = { cell: number; box: { left: number; top: number; width: number; height: number }; cropRgbaSha256: string; completeHighAlphaBodyPreserved: boolean; rgbaPixelsRepainted: number };
type Receipt = { native: { path: string; sha256: string }; generationCallsForRun: number; generationCallsByThisScript: number; ownerVisualApproval: string; coverage: { physicalSlots: number; logicalRows: number; distinctWholeKeysUsed: number; fallbackOldRgbSlots: number; audiencePreserved: boolean }; keys: Key[]; slots: Array<{ index: number; family: string; key: number; nativeCell: number; frame: Frame; sourceSha256: string; cropRgbaSha256: string; alphaSha256: string; faceProtection?: { minimumRigidWeight: number; maximumFeatureDeviation: number } }>; packets: Array<Atlas & { index: number; alphaSha256: string }>; stagedMetadata: Record<string, string> };
const receipt = json<Receipt>(`${run}/패킹파생기록.json`);
const names = ["hd-motion-sprite", "play-motion-sprite", "living-motion-sprite"];
const alphaHash = (rgba: Buffer) => { const alpha = Buffer.alloc(rgba.length / 4); for (let n = 0; n < alpha.length; n++) alpha[n] = rgba[n * 4 + 3]; return hash(alpha); };
function crop(rgba: Buffer, width: number, box: Key["box"]) { const bytes = Buffer.alloc(box.width * box.height * 4); for (let y = 0; y < box.height; y++) rgba.copy(bytes, y * box.width * 4, ((box.top + y) * width + box.left) * 4, ((box.top + y) * width + box.left + box.width) * 4); return bytes; }

describe("114 single-native whole-pose replacement", () => {
  it("pins the one actual native and every unchanged whole-key crop without claiming owner approval", async () => {
    const bytes = readFileSync(receipt.native.path); expect(hash(bytes)).toBe("8cfa1fd98c63eff8b06dba9d0950391509e60d194c878b5881a16176be245ba4");
    expect(receipt.native.sha256).toBe(hash(bytes)); expect(receipt.generationCallsForRun).toBe(1); expect(receipt.generationCallsByThisScript).toBe(0); expect(receipt.ownerVisualApproval).toBe("NOT_ESTABLISHED");
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); expect([info.width, info.height]).toEqual([1122, 1402]);
    expect(receipt.keys).toHaveLength(80);
    for (const key of receipt.keys) { expect(key.completeHighAlphaBodyPreserved).toBe(true); expect(key.rgbaPixelsRepainted).toBe(0); expect(hash(crop(data, info.width, key.box))).toBe(key.cropRgbaSha256); }
  });

  it("replaces all520 physical slots while preserving all41 logical action rows and bounded packet dimensions", () => {
    expect(receipt.coverage).toEqual({ originalNativeKeys: 80, requestedUsedWorldKeys: 79, distinctWholeKeysUsed: 61, physicalSlots: 520, logicalRows: 41, fallbackOldRgbSlots: 0, audiencePreserved: true });
    expect(companionSpriteMetadata.rows).toHaveLength(41); expect(companionSpriteMetadata.frames).toHaveLength(520); expect(companionSpriteMetadata.atlases).toHaveLength(33);
    for (const [index, name] of names.entries()) {
      const pack = [hd, play, living][index], frozen = json<{ rows: number[][] }>(`${run}/고정입력/${name}.json`);
      expect(pack.rows).toEqual(frozen.rows); expect(readFileSync(`lib/ui/viewer-companion/${name}.json`).equals(readFileSync(receipt.stagedMetadata[name]))).toBe(true);
    }
    for (const slot of receipt.slots) {
      expect(slot.sourceSha256).toBe(receipt.native.sha256); expect(slot.cropRgbaSha256).toBe(receipt.keys[slot.nativeCell].cropRgbaSha256);
      expect(companionSpriteMetadata.frames[slot.index]).toEqual(slot.frame);
      if (slot.faceProtection) expect(slot.faceProtection).toMatchObject({ minimumRigidWeight: 1, maximumFeatureDeviation: 0 });
    }
    expect(1536 * 384 * 4 * 3 / 1024 ** 2).toBe(6.75);
  });

  it("uses actual whole pouts, visible tears and braced airborne keys instead of rejected smiling emotion cells", () => {
    for (const slot of receipt.slots) {
      if (slot.family === "mood") expect(slot.nativeCell).toBe(slot.key < 8 ? 27 + slot.key % 2 : 62);
      if (slot.family === "play" && [24, 26].includes(slot.key) || slot.family === "ear" && slot.key === 2) expect(slot.nativeCell).toBe(51);
      if (slot.family === "throw" && slot.key === 2) expect(slot.nativeCell).toBe(68);
    }
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", `import {sourceCellFor114,fitUnifiedKey114} from './scripts/prepare-companion-unified-poses.mjs'; let rejected=0; for(const scale of [NaN,Infinity,0,-1,3])try{fitUnifiedKey114({},scale)}catch{rejected++}try{sourceCellFor114({family:'absent',key:999},[])}catch{rejected++}console.log(rejected);`], { encoding: "utf8" });
    expect(Number(output.trim())).toBe(6);
  });

  it("pins exact public packet bytes and decoded alpha for all520 cells, with the final8 padding cells empty", async () => {
    for (const packet of receipt.packets) {
      const bytes = readFileSync(`public${packet.src}`); expect(hash(bytes)).toBe(packet.sha256); expect(bytes.length).toBe(packet.bytes); expect(packet.src).toContain("unified-114-v1");
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); expect([info.width, info.height]).toEqual([1536, 384]); expect(alphaHash(data)).toBe(packet.alphaSha256);
      for (let index = 0; index < 16; index++) { const rgba = crop(data, info.width, { left: index % 8 * 192, top: Math.floor(index / 8) * 192, width: 192, height: 192 }), slot = receipt.slots[packet.index * 16 + index]; if (slot) expect(alphaHash(rgba)).toBe(slot.alphaSha256); else expect(rgba.every((byte, position) => position % 4 !== 3 || byte === 0)).toBe(true); }
    }
  }, 30_000);
});

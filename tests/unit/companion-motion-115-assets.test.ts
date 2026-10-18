import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import expression119 from "../../art-src/빅타민/동행/작업회차/20261019-표정체적교정119/패킹파생기록.json";
import jump117 from "../../art-src/빅타민/동행/작업회차/20261018-점프노란조각교정117/패킹파생기록.json";

const run = "art-src/빅타민/동행/작업회차/20261018-동작연결정리115";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const json = <T,>(name: string): T => JSON.parse(readFileSync(name, "utf8")) as T;
type Box = { left: number; top: number; right: number; bottom: number };
type Atlas = { src: string; sha256: string; bytes: number };
type Frame = { atlas: number; index: number; x: number; y: number; clip: number[] };
type Key = { cell: number; box: { left: number; top: number; width: number; height: number }; originalCropRgbaSha256: string; cropRgbaSha256: string; opacity1NoiseCleared: number; allRgbBytesPreserved: boolean; strongerAlphaBytesPreserved: boolean; completeHighAlphaBodyPreserved: boolean };
type Receipt = { generationCallsForRun: number; native: { path: string; sha256: string }; coverage: { distinctWholeKeysUsed: number }; keys: Key[]; slots: Array<{ index: number; nativeCell: number; frame: Frame; body: Box; alphaSha256: string }>; packets: Array<Atlas & { index: number; alphaSha256: string }>; stagedMetadata: Record<string, string> };
const receipt = json<Receipt>(`${run}/패킹파생기록.json`), prior114 = json<{ packets: Atlas[] }>("art-src/빅타민/동행/작업회차/20261018-포즈통일114/패킹파생기록.json");
const alphaHash = (rgba: Buffer) => { const alpha = Buffer.alloc(rgba.length / 4); for (let n = 0; n < alpha.length; n++) alpha[n] = rgba[n * 4 + 3]; return hash(alpha); };
function crop(rgba: Buffer, width: number, box: Key["box"]) { const bytes = Buffer.alloc(box.width * box.height * 4); for (let y = 0; y < box.height; y++) rgba.copy(bytes, y * box.width * 4, ((box.top + y) * width + box.left) * 4, ((box.top + y) * width + box.left + box.width) * 4); return bytes; }

describe("115 whole-pose continuity derivatives", () => {
  it("preserves original native and114 packets, clearing only1/255 alpha while retaining every RGB and stronger alpha byte", async () => {
    expect(receipt.generationCallsForRun).toBe(0);
    const native = readFileSync(receipt.native.path); expect(hash(native)).toBe(receipt.native.sha256); expect(receipt.native.sha256).toBe("8cfa1fd98c63eff8b06dba9d0950391509e60d194c878b5881a16176be245ba4");
    for (const packet of prior114.packets) expect(hash(readFileSync(`public${packet.src}`))).toBe(packet.sha256);
    const { data, info } = await sharp(native).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let cleared = 0;
    for (const key of receipt.keys) {
      const original = crop(data, info.width, key.box); expect(hash(original)).toBe(key.originalCropRgbaSha256);
      const normalized = Buffer.from(original); let count = 0;
      for (let n = 3; n < normalized.length; n += 4) if (normalized[n] === 1) { normalized[n] = 0; count++; }
      expect(hash(normalized)).toBe(key.cropRgbaSha256); expect(count).toBe(key.opacity1NoiseCleared); cleared += count;
      expect(key.allRgbBytesPreserved && key.strongerAlphaBytesPreserved && key.completeHighAlphaBodyPreserved).toBe(true);
    }
    expect(cleared).toBeGreaterThan(0);
    const result = execFileSync(process.execPath, ["--input-type=module", "-e", `import {clearCompanionExportResidue115} from './scripts/prepare-companion-motion-115.mjs';const a=Buffer.from([255,0,0,1,0,255,0,2,0,0,255,200]);const b=clearCompanionExportResidue115(a);console.log(JSON.stringify({before:[...a],after:[...b.rgba],cleared:b.cleared}));`], { encoding: "utf8" });
    expect(JSON.parse(result)).toEqual({ before: [255, 0, 0, 1, 0, 255, 0, 2, 0, 0, 255, 200], after: [255, 0, 0, 0, 0, 255, 0, 2, 0, 0, 255, 200], cleared: 1 });
  });

  it("keeps every logical action and the bounded3-packet decoder while removing the forced half-stride wink", () => {
    const eye120 = json<typeof expression119>("art-src/빅타민/동행/작업회차/20261019-눈매윤곽교정120/패킹파생기록.json");
    expect(receipt.slots).toHaveLength(520); expect(companionSpriteMetadata.rows).toHaveLength(41); expect(receipt.coverage.distinctWholeKeysUsed).toBe(60);
    expect(expression119.packets.map(({ atlas, family, localAtlas, packet }) => ({ atlas, family, localAtlas, src: packet.src }))).toEqual([
      { atlas: 0, family: "hd-motion-sprite", localAtlas: 0, src: "/companion/hd/vitamin-action-00-expression-119-v1.webp" },
      { atlas: 16, family: "hd-motion-sprite", localAtlas: 16, src: "/companion/hd/vitamin-action-16-expression-119-v1.webp" },
      { atlas: 22, family: "play-motion-sprite", localAtlas: 3, src: "/companion/hd/vitamin-play-03-expression-119-v1.webp" },
      { atlas: 31, family: "play-motion-sprite", localAtlas: 12, src: "/companion/hd/vitamin-play-12-expression-119-v1.webp" },
      { atlas: 32, family: "living-motion-sprite", localAtlas: 0, src: "/companion/hd/vitamin-episodes-00-expression-119-v1.webp" },
    ]);
    expect(expression119.registrationChanges).toEqual([496, 497, 498, 499]);
    expect(eye120.packets.map(({ atlas, family, localAtlas, packet }) => ({ atlas, family, localAtlas, src: packet.src }))).toEqual([
      { atlas: 0, family: "hd-motion-sprite", localAtlas: 0, src: "/companion/hd/vitamin-action-00-eye-contour-120-v1.webp" },
      { atlas: 16, family: "hd-motion-sprite", localAtlas: 16, src: "/companion/hd/vitamin-action-16-eye-contour-120-v1.webp" },
      { atlas: 32, family: "living-motion-sprite", localAtlas: 0, src: "/companion/hd/vitamin-episodes-00-eye-contour-120-v1.webp" },
    ]);
    expect(eye120.registrationChanges).toEqual([]);
    const names = ["hd-motion-sprite", "play-motion-sprite", "living-motion-sprite"] as const;
    for (const [family, name] of names.entries()) {
      const before = json<{ rows: number[][] }>(`${run}/고정입력/${name}.json`), current = json<{ rows: number[][] }>(`lib/ui/viewer-companion/${name}.json`);
      expect(current.rows).toEqual(before.rows);
      const frozen = json<{ rows: number[][]; frames: Frame[]; atlases: Atlas[] }>(receipt.stagedMetadata[name]);
      const active = json<typeof frozen>(`lib/ui/viewer-companion/${name}.json`);
      // The immutable115 evidence below still checks every historical pixel.
      // Current120 replaces only three119 packets, keeping the four119 body
      // fits and every immutable115 source/packet assertion below intact.
      expect(readFileSync(`lib/ui/viewer-companion/${name}.json`).equals(readFileSync(eye120.stagedMetadata[name]))).toBe(true);
      expect({ ...active, atlases: frozen.atlases, frames: frozen.frames }).toEqual(frozen);
      expect(active.atlases).toHaveLength(frozen.atlases.length); expect(active.frames).toHaveLength(frozen.frames.length);
      for (const [index, atlas] of active.atlases.entries()) {
        const replacement = eye120.packets.find(packet => packet.family === name && packet.localAtlas === index) ?? expression119.packets.find(packet => packet.family === name && packet.localAtlas === index);
        expect(atlas).toEqual(replacement?.packet ?? (name === "hd-motion-sprite" && index === 4 ? jump117.packet : frozen.atlases[index]));
      }
      for (const [index, frame] of active.frames.entries()) {
        const physical = [0, 304, 512][family] + index;
        if (physical >= 496 && physical <= 499) {
          const replacement = expression119.frames.find(item => item.physicalIndex === physical)!;
          expect(replacement.registrationChanged).toBe(true);
          expect(replacement.parentFrame).toEqual(frozen.frames[index]);
          expect(frame).toEqual(replacement.frame);
        } else expect(frame).toEqual(frozen.frames[index]);
      }
    }
    for (const index of companionSpriteMetadata.rows[2]) expect(receipt.slots[index].nativeCell).toBe(2);
    expect(new Set(companionSpriteMetadata.rows[0].map(index => receipt.slots[index].nativeCell))).toEqual(new Set([0, 1]));
    expect(1536 * 384 * 4 * 3 / 1024 ** 2).toBe(6.75);
  });

  it("binds real decoded body centres and feet to40/80 instead of transparent export residue on all520 cells", async () => {
    for (const packet of receipt.packets) {
      const bytes = readFileSync(`public${packet.src}`); expect(hash(bytes)).toBe(packet.sha256); expect(bytes.length).toBe(packet.bytes); expect(packet.src).toContain("motion-115-v1");
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); expect([info.width, info.height]).toEqual([1536, 384]); expect(alphaHash(data)).toBe(packet.alphaSha256);
      for (const slot of receipt.slots.slice(packet.index * 16, packet.index * 16 + 16)) {
        const rgba = crop(data, info.width, { left: slot.frame.index % 8 * 192, top: Math.floor(slot.frame.index / 8) * 192, width: 192, height: 192 }); expect(alphaHash(rgba)).toBe(slot.alphaSha256);
        let left = 192, top = 192, right = 0, bottom = 0;
        for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) if (rgba[(y * 192 + x) * 4 + 3] >= 200) { left = Math.min(left, x); right = Math.max(right, x + 1); top = Math.min(top, y); bottom = Math.max(bottom, y + 1); }
        expect({ left, top, right, bottom }).toEqual({ left: slot.body.left, top: slot.body.top, right: slot.body.right, bottom: slot.body.bottom });
        expect((left + right) / 2 / 2.4 + slot.frame.x).toBeCloseTo(40, 5); expect(bottom / 2.4 + slot.frame.y).toBeCloseTo(80, 5);
        let clippedAlphaPixels = 0;
        for (let n = 3; n < rgba.length; n += 4) if (rgba[n]) { const x = (n - 3) / 4 % 192, y = Math.floor((n - 3) / 4 / 192); if (x < slot.frame.clip[3] * 2.4 || x >= 192 - slot.frame.clip[1] * 2.4 || y < slot.frame.clip[0] * 2.4 || y >= 192 - slot.frame.clip[2] * 2.4) clippedAlphaPixels++; }
        expect(clippedAlphaPixels, `physical${slot.index}`).toBe(0);
      }
    }
  }, 30_000);
});

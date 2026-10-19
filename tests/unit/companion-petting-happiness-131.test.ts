import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const run = "art-src/빅타민/동행/작업회차/20261019-쓰다듬기행복131";
const names = ["hd-motion-sprite", "play-motion-sprite", "living-motion-sprite"];
const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
const read = <T,>(name: string): T => JSON.parse(readFileSync(name, "utf8")) as T;
type Atlas = { src: string; sha256: string; bytes: number; width: number; height: number };
type Frame = { atlas: number; index: number; x: number; y: number; clip: number[] };
type Metadata = { atlases: Atlas[]; frames: Frame[]; rows: number[][] };
type Mouth = { evidence: string; atlases: Array<{ src: string; sha256: string }>; frames: Array<{ index: number; atlas: number; cell: number; x: number; y: number; bounds: number[] }> };
type Anchors = { metadata: Array<{ path: string; sha256: string }>; sources: Atlas[]; frames: Array<{ physicalIndex: number }>; rows: number[][] };
const receipt = read<{ native: { path: string; sha256: string }; packet: Atlas; frames: Array<{ physicalIndex: number; frame: Frame; body: { left: number; right: number; bottom: number } }>; physicalIndices: number[]; normalizedRgbaSha256: string; alphaCleanup: boolean; faceCompositing: boolean; generationCalls: number; generationCallsByThisScript: number; immutableParentPackets: Atlas[] }>(`${run}/패킹파생기록.json`);

describe("131 single-generation happy-petting source and registration", () => {
  it("derives the packet by one uniform whole-grid resize, retaining every normalized alpha and visible RGB byte", async () => {
    const native = readFileSync(receipt.native.path);
    expect(hash(native)).toBe("41ea00d7053dbbc9532c728d9710ada2f51e37b7be698b3efd304bebeace29f9");
    expect(hash(native)).toBe(receipt.native.sha256);
    expect(receipt.generationCalls).toBe(1); expect(receipt.generationCallsByThisScript).toBe(0);
    expect(receipt.alphaCleanup).toBe(false); expect(receipt.faceCompositing).toBe(false);
    const normalized = await sharp(native).extract({ left: 0, top: 91, width: 2172, height: 543 }).resize(1536, 384, { kernel: "lanczos3" }).ensureAlpha().raw().toBuffer();
    expect(hash(normalized)).toBe(receipt.normalizedRgbaSha256);
    const bytes = readFileSync(`public${receipt.packet.src}`);
    expect(hash(bytes)).toBe(receipt.packet.sha256); expect(bytes.length).toBe(receipt.packet.bytes);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([1536, 384]);
    for (let at = 0; at < normalized.length; at += 4) {
      if (normalized[at + 3] !== data[at + 3]) throw Error(`Normalized alpha changed at${at / 4}`);
      if (normalized[at + 3]) for (let c = 0; c < 3; c++) if (normalized[at + c] !== data[at + c]) throw Error(`Visible RGB changed at${at / 4}`);
    }
    expect(execFileSync(process.execPath, ["scripts/prepare-companion-petting-happiness-131.mjs", "--check"], { encoding: "utf8" })).toContain("CHECK_PASS");
  });

  it("changes only row9's packet and16 registrations while preserving all33 old packets and504 other frames", () => {
    expect(receipt.physicalIndices).toEqual(Array.from({ length: 16 }, (_, i) => 144 + i));
    let unchangedFrames = 0, unchangedPackets = 0;
    for (const [family, name] of names.entries()) {
      const before = read<Metadata>(`${run}/고정입력/${name}.json`), active = read<Metadata>(`lib/ui/viewer-companion/${name}.json`);
      expect(active.rows).toEqual(before.rows);
      for (const [index, frame] of active.frames.entries()) {
        if (family === 0 && index >= 144 && index <= 159) expect(frame).toEqual(receipt.frames[index - 144].frame);
        else { expect(frame).toEqual(before.frames[index]); unchangedFrames++; }
      }
      for (const [index, packet] of active.atlases.entries()) {
        if (family === 0 && index === 9) expect(packet).toEqual(receipt.packet);
        else { expect(packet).toEqual(before.atlases[index]); unchangedPackets++; }
      }
      expect({ ...active, frames: before.frames, atlases: before.atlases }).toEqual(before);
    }
    expect(unchangedFrames).toBe(504); expect(unchangedPackets).toBe(32);
    for (const packet of receipt.immutableParentPackets) expect(hash(readFileSync(`public${packet.src}`))).toBe(packet.sha256);
  });

  it("registers each visible body at40/80 and keeps every alpha>=8 pixel within its measured clip", async () => {
    const { data } = await sharp(readFileSync(`public${receipt.packet.src}`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const entry of receipt.frames) {
      const { frame, body } = entry;
      expect((body.left + body.right) / 2 / 2.4 + frame.x).toBeCloseTo(40, 5);
      expect(body.bottom / 2.4 + frame.y).toBeCloseTo(80, 5);
      let clipped = 0;
      for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
        const alpha = data[((Math.floor(frame.index / 8) * 192 + y) * 1536 + frame.index % 8 * 192 + x) * 4 + 3];
        if (alpha >= 8 && (x < frame.clip[3] * 2.4 || x >= 192 - frame.clip[1] * 2.4 || y < frame.clip[0] * 2.4 || y >= 192 - frame.clip[2] * 2.4)) clipped++;
      }
      expect(clipped).toBe(0);
    }
  });

  it("updates only16 source-bound mouth/accessory anchors and preserves the other504 accessory rigs", () => {
    const oldMouth = read<Mouth>(`${run}/고정입력/mouth-anchors.json`), current = read<Mouth>("lib/ui/viewer-companion/mouth-anchors.json");
    expect(current.frames.filter(f => f.index < 144 || f.index > 159)).toEqual(oldMouth.frames.filter(f => f.index < 144 || f.index > 159));
    expect(current.atlases[0]).toEqual(oldMouth.atlases[0]);
    expect(current.atlases[1]).toEqual({ src: receipt.packet.src, sha256: receipt.packet.sha256 });
    expect(current.frames.filter(f => f.index >= 144 && f.index <= 159)).toHaveLength(16);
    const old = read<Anchors>(`${run}/고정입력/accessory-anchors.json`), anchors = read<Anchors>("lib/ui/viewer-companion/accessory-anchors.json");
    expect(anchors.rows).toEqual(old.rows); expect(anchors.frames).toHaveLength(520);
    for (const [index, anchor] of anchors.frames.entries()) if (index < 144 || index > 159) expect(anchor).toEqual(old.frames[index]);
    for (const [index, source] of anchors.sources.entries()) if (index !== 9) expect(source).toEqual(old.sources[index]);
    for (const item of anchors.metadata) expect(hash(readFileSync(item.path))).toBe(item.sha256);
  });
});

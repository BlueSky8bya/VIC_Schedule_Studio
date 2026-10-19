import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const run = "art-src/빅타민/동행/작업회차/20261019-쓰다듬기눈선133";
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const read = <T,>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
type Atlas = { src: string; sha256: string; bytes: number; width: number; height: number };
type Pack = { atlases: Atlas[]; frames: unknown[]; rows: number[][] };
const receipt = read<{ native: { path: string; sha256: string }; parent: Atlas; packet: Atlas; changedPixels: number; generationCalls: number; callsByThisScript: number; independentArtReviews: number; ownerApproval: boolean }>(`${run}/패킹파생기록.json`);
const eyes = [[81, 117, 99, 134], [113, 115, 132, 132]];

describe("133 source-bound happy-eye stroke correction", () => {
  it("preserves every alpha and every outside-eye RGBA byte, including the unchanged mouth", async () => {
    expect(hash(readFileSync(receipt.native.path))).toBe("2e58c84c2530bbb41e640a8f8db0148b5269dc3ac3d5d34c4fb5c808db424a2d");
    expect(receipt.generationCalls).toBe(1); expect(receipt.callsByThisScript).toBe(0);
    expect(receipt.independentArtReviews).toBe(0); expect(receipt.ownerApproval).toBe(false);
    const before = await sharp(readFileSync(`public${receipt.parent.src}`)).ensureAlpha().raw().toBuffer();
    const after = await sharp(readFileSync(`public${receipt.packet.src}`)).ensureAlpha().raw().toBuffer();
    expect(hash(readFileSync(`public${receipt.packet.src}`))).toBe(receipt.packet.sha256);
    let changed = 0;
    for (let at = 0; at < before.length; at += 4) {
      const p = at / 4, x = p % 1536 % 192, y = Math.floor(p / 1536) % 192;
      const allowed = eyes.some(([left, top, right, bottom]) => x >= left && x < right && y >= top && y < bottom);
      if (after[at + 3] !== before[at + 3]) throw Error(`Alpha changed at${p}`);
      const different = before.subarray(at, at + 4).compare(after.subarray(at, at + 4)) !== 0;
      if (different) { if (!allowed) throw Error(`Outside-eye pixel changed at${p}`); changed++; }
      if (x >= 99 && x < 113 && y >= 128 && y < 141 && different) throw Error(`Mouth changed at${p}`);
    }
    expect(changed).toBe(4309); expect(changed).toBe(receipt.changedPixels);
    const mouths = read<{ frames: Array<{ index: number; bounds: number[] }> }>(`${run}/고정입력/mouth-anchors.json`).frames.filter(f => f.index >= 144 && f.index <= 159);
    const allowed = await sharp(`${run}/정리본/눈선133_최종허용영역.png`).greyscale().raw().toBuffer();
    expect(mouths).toHaveLength(16);
    for (const mouth of mouths) {
      const cell = mouth.index - 144, [left, top, right, bottom] = mouth.bounds;
      for (let y = top - 1; y <= bottom; y++) for (let x = left - 1; x <= right; x++) {
        const pixel = (Math.floor(cell / 8) * 192 + y) * 1536 + cell % 8 * 192 + x, at = pixel * 4;
        expect(allowed[pixel]).toBe(0);
        expect(after.subarray(at, at + 4)).toEqual(before.subarray(at, at + 4));
      }
    }
  });

  it("makes both actual happy-eye strokes fuller in every one of the16 cells", async () => {
    const before = await sharp(readFileSync(`public${receipt.parent.src}`)).ensureAlpha().raw().toBuffer();
    const after = await sharp(readFileSync(`public${receipt.packet.src}`)).ensureAlpha().raw().toBuffer();
    const inkRun = (packet: Buffer, cell: number, box: number[]) => {
      const columns = new Set<number>(); let count = 0;
      for (let y = box[1]; y < box[3]; y++) for (let x = box[0]; x < box[2]; x++) {
        const at = ((Math.floor(cell / 8) * 192 + y) * 1536 + cell % 8 * 192 + x) * 4;
        if (packet[at + 3] > 200 && packet[at] < 180 && packet[at + 1] < 140 && packet[at + 2] < 120) { count++; columns.add(x); }
      }
      expect(columns.size).toBeGreaterThan(8);
      return count / columns.size;
    };
    for (let cell = 0; cell < 16; cell++) for (const box of eyes) expect(inkRun(after, cell, box)).toBeGreaterThan(inkRun(before, cell, box));
  });

  it("changes only one packet binding while retaining520 registrations, all mouth/attachment geometry and the33 immutable parent packets", () => {
    for (const [family, name] of ["hd-motion-sprite", "play-motion-sprite", "living-motion-sprite"].entries()) {
      const before = read<Pack>(`${run}/고정입력/${name}.json`), after = read<Pack>(`lib/ui/viewer-companion/${name}.json`);
      expect(after.frames).toEqual(before.frames); expect(after.rows).toEqual(before.rows);
      for (const [index, source] of after.atlases.entries()) expect(source).toEqual(family === 0 && index === 9 ? receipt.packet : before.atlases[index]);
      for (const source of before.atlases) expect(hash(readFileSync(`public${source.src}`))).toBe(source.sha256);
    }
    const mouthBefore = read<{ atlases: unknown[]; frames: unknown[] }>(`${run}/고정입력/mouth-anchors.json`), mouth = read<typeof mouthBefore>("lib/ui/viewer-companion/mouth-anchors.json");
    expect({ ...mouth, atlases: mouthBefore.atlases }).toEqual(mouthBefore);
    expect(mouth.atlases[1]).toEqual({ src: receipt.packet.src, sha256: receipt.packet.sha256 });
    const oldRig = read<{ metadata: unknown[]; sources: unknown[]; frames: unknown[] }>(`${run}/고정입력/accessory-anchors.json`), rig = read<typeof oldRig>("lib/ui/viewer-companion/accessory-anchors.json");
    expect({ ...rig, metadata: oldRig.metadata, sources: oldRig.sources }).toEqual(oldRig);
    expect(rig.frames).toHaveLength(520);
    for (const file of ["scripts/prepare-companion-petting-eye-weight-133.mjs", "scripts/prepare-companion-accessory-anchors.mjs"]) expect(execFileSync(process.execPath, [file, "--check"], { encoding: "utf8" })).toMatch(/CHECK_PASS|"check":true/);
  });
});

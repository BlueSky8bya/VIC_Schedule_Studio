import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import base from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import play from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import living from "@/lib/ui/viewer-companion/living-motion-sprite.json";
import frozen104 from "../../art-src/빅타민/동행/작업회차/20261018-포즈통일114/고정입력/living-motion-sprite.json";
import { sampleCompanionCozySleep, sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import { companionSpriteMetadata, companionSpriteSources, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";

const run = "art-src/빅타민/동행/작업회차/20261018-교감살림응원";
const keys = ["ask-petting", "lean-nuzzle", "paper-knead-left", "paper-nest-right", "cheer-tangled", "cheer-peek", "cheer-tidy", "doze-curl"] as const;
const kinds = ["ask-petting", "lean-nuzzle", "cozy-nest", "cheer-rehearsal", "doze-curl"] as const;
type Box = { left: number; top: number; right: number; bottom: number; width: number; height: number; pixels: number };
type Frame = { index: number; x: number; y: number; clip: number[] };
type Atlas = { src: string; sha256: string; bytes: number; width: number; height: number };
type Registration = { cell: number; logicalCell: number; grid: number; gridRows: number; authoredKeys: number; unusedTransparentSlots: number; atlas: Atlas; frames: Array<Frame & { key: string }>; proposedLogicalRows: Record<string, number> };
type Packing = { source: string; sourceSha256: string; native: { width: number; height: number }; generationCallsByThisScript: number; newGeneratedKeys: number; frames: Array<{ name: string; index: number; scale: number; body: Box; visibleBounds: Omit<Box, "width" | "height" | "pixels">; frame: Frame }>; atlas: Atlas; approval: string };
const json = <T,>(name: string): T => JSON.parse(readFileSync(name, "utf8")) as T;
const registration = json<Registration>(`${run}/정리본/동작등록.json`);
const packing = json<Packing>(`${run}/패킹파생기록.json`);
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

function cropCell(bytes: Buffer, width: number, index: number) {
  const cell = Buffer.alloc(192 * 192 * 4), left = index % 8 * 192, top = Math.floor(index / 8) * 192;
  for (let y = 0; y < 192; y++) bytes.copy(cell, y * 192 * 4, ((top + y) * width + left) * 4, ((top + y) * width + left + 192) * 4);
  return cell;
}

/** A registration footprint, not an ear count or anatomical/visual verdict. */
function largestAlphaComponent(bytes: Buffer): Box {
  const seen = new Uint8Array(192 * 192), queue = new Int32Array(192 * 192);
  let best: Box | undefined;
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || bytes[start * 4 + 3] <= 160) continue;
    let head = 0, tail = 1, left = 192, top = 192, right = 0, bottom = 0;
    seen[start] = 1; queue[0] = start;
    while (head < tail) {
      const at = queue[head++], x = at % 192, y = Math.floor(at / 192);
      left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
      for (const next of [x > 0 ? at - 1 : -1, x < 191 ? at + 1 : -1, y > 0 ? at - 192 : -1, y < 191 ? at + 192 : -1]) {
        if (next >= 0 && !seen[next] && bytes[next * 4 + 3] > 160) { seen[next] = 1; queue[tail++] = next; }
      }
    }
    if (!best || tail > best.pixels) best = { left, top, right, bottom, width: right - left, height: bottom - top, pixels: tail };
  }
  if (!best) throw new Error("Missing visible registered alpha component");
  return best;
}

describe("104 additive living-pose asset integrity", () => {
  it("pins the actual native, registration and public packet bytes without treating provenance as visual approval", async () => {
    const source = readFileSync(packing.source), staged = readFileSync(`${run}/정리본/동작등록.json`), atlas = readFileSync(`public${registration.atlas.src}`);
    expect(packing.source).toBe(`${run}/원본/빅타민_교감살림응원_8키포즈.png`);
    expect(source.length).toBe(1_386_885); expect(hash(source)).toBe("3153807b4b72b56c158d434eaf538d3e3c18ceacb10dab333401776656826a70"); expect(hash(source)).toBe(packing.sourceSha256);
    expect(staged.length).toBe(2012); expect(hash(staged)).toBe("967c04a30dfcd4d237c9810e485a3fdee7457c2672cd5c85d7040799b1c2dcc9");
    expect(registration.atlas).toEqual({ src: "/companion/hd/victamin-episodes-104-v1.webp", sha256: "c8a66edbb01cc423ecebe0bf37b5a8ac3233fa7ae22c9a6735a8b85854771d6c", bytes: 89_414, width: 1536, height: 384 });
    expect(atlas.length).toBe(registration.atlas.bytes); expect(hash(atlas)).toBe(registration.atlas.sha256); expect(packing.atlas).toEqual(registration.atlas);
    const native = await sharp(source).metadata(); expect([native.width, native.height, native.hasAlpha]).toEqual([1774, 887, true]);
    expect(packing.native).toMatchObject({ width: 1774, height: 887 }); expect(packing.generationCallsByThisScript).toBe(0); expect(packing.newGeneratedKeys).toBe(8);
    expect(packing.approval).toBe("GENERATOR_OBSERVED_NOT_NEW_OWNER_VISUAL_APPROVAL_OR_SPECIALIST_PASS");
  });

  it("appends exactly eight authored keys at logical rows33–40 through the shared selector", () => {
    expect(registration).toMatchObject({ cell: 192, logicalCell: 80, grid: 8, gridRows: 2, authoredKeys: 8, unusedTransparentSlots: 8 });
    expect(living).toMatchObject({ cell: 192, logicalCell: 80, grid: 8, gridRows: 2, rowOffset: 33 });
    expect(frozen104.atlases).toEqual([registration.atlas]); expect(living.frames).toHaveLength(8); expect(living.rows).toEqual(keys.map((_, index) => [index]));
    expect(registration.frames.map(frame => frame.key)).toEqual(keys); expect(registration.proposedLogicalRows).toEqual(Object.fromEntries(keys.map((key, index) => [key, 33 + index])));
    const frameOffset = base.frames.length + play.frames.length, atlasOffset = base.atlases.length + play.atlases.length;
    expect(companionSpriteMetadata.rows).toHaveLength(41); expect(frameOffset).toBe(512);
    for (const [index, key] of keys.entries()) {
      const row = 33 + index, authored = registration.frames[index], { key: authoredKey, ...frame } = authored;
      expect(authoredKey).toBe(key); expect(frame.index).toBe(index); expect(frozen104.frames[index]).toEqual({ atlas: 0, ...frame });
      expect(companionSpriteMetadata.rows[row]).toEqual([frameOffset + index]); expect(companionSpriteMetadata.frames[frameOffset + index]).toEqual({ ...living.frames[index], atlas: atlasOffset });
      expect(companionSpriteSources(row)).toEqual([living.atlases[0].src]);
      for (const column of [0, 7, 15]) expect(selectCompanionSprite(-1, row, column)).toMatchObject({ atlas: "hd", physicalIndex: frameOffset + index, index, src: living.atlases[0].src, grid: 8, gridRows: 2, frame: { ...living.frames[index], atlas: atlasOffset } });
    }
  });

  it("measures actual decoded footprints at foot180 and leaves all eight unused cells transparent", async () => {
    const decoded = await sharp(readFileSync(`public${registration.atlas.src}`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([decoded.info.width, decoded.info.height, decoded.info.channels]).toEqual([1536, 384, 4]);
    const ratio = registration.cell / registration.logicalCell;
    expect(packing.frames).toHaveLength(8); expect(new Set(packing.frames.map(frame => frame.scale))).toEqual(new Set([130 / 367]));
    for (const [index, record] of packing.frames.entries()) {
      const cell = cropCell(decoded.data, 1536, index), footprint = largestAlphaComponent(cell), frame = frozen104.frames[index];
      expect(record.name).toBe(keys[index]); expect(record.index).toBe(index); expect(record.frame).toEqual({ index, x: frame.x, y: frame.y, clip: frame.clip });
      expect(footprint).toEqual(record.body); expect(footprint.bottom).toBe(180); expect(frame.y).toBe(5);
      expect((footprint.left + footprint.right) / 2 + frame.x * ratio).toBeCloseTo(96, 5); expect(footprint.bottom / ratio + frame.y).toBe(80);
      expect([frame.x, frame.y, ...frame.clip].every(Number.isFinite)).toBe(true); expect(Math.min(...frame.clip)).toBeGreaterThanOrEqual(0);
      let clippedVisiblePixels = 0;
      for (let at = 3; at < cell.length; at += 4) {
        if (cell[at] <= 160) continue;
        const x = (at - 3) / 4 % 192, y = Math.floor((at - 3) / 4 / 192);
        if (x < frame.clip[3] * ratio || x >= 192 - frame.clip[1] * ratio || y < frame.clip[0] * ratio || y >= 192 - frame.clip[2] * ratio) clippedVisiblePixels++;
      }
      expect(clippedVisiblePixels, record.name).toBe(0);
    }
    let unusedAlphaPixels = 0;
    for (let at = 1536 * 192 * 4 + 3; at < decoded.data.length; at += 4) if (decoded.data[at] !== 0) unusedAlphaPixels++;
    expect(unusedAlphaPixels).toBe(0);
  });

  it("reaches every new authored key from its finite play or cozy-sleep path", () => {
    const reached = new Set<number>();
    for (const kind of kinds) {
      const timing = COMPANION_PLAY_TIMING[kind]; let entered = 0;
      for (const beat of timing.beats) {
        const pose = sampleCompanionPlay(kind, (entered + beat.duration / 2) / timing.duration);
        expect(pose.row).toBe(beat.row); entered += beat.duration;
        if (pose.row < 33) continue;
        reached.add(pose.row);
        const selected = selectCompanionSprite(-1, pose.row, pose.phase * 15);
        expect(selected.src).toBe(living.atlases[0].src); expect(selected.index).toBe(pose.row - 33);
      }
    }
    expect([...reached].sort((a, b) => a - b)).toEqual(keys.map((_, index) => 33 + index));
    const quiet = sampleCompanionCozySleep(6000, 12000); expect(quiet).toMatchObject({ row: 40, dreaming: true });
    expect(selectCompanionSprite(-1, quiet.row, 0)).toMatchObject({ src: living.atlases[0].src, index: 7 });
  });
});

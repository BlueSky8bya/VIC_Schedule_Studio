import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import legacyAnchors from "@/lib/ui/viewer-companion/accessory-anchors.json";
import legacyBase from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import legacyPlay from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import legacyLiving from "@/lib/ui/viewer-companion/living-motion-sprite.json";
import legacyMouths from "@/lib/ui/viewer-companion/mouth-anchors.json";
import { companionEyeScale143Eyes, companionEyeScale143Packets, companionEyeScale143Source } from "@/lib/ui/viewer-companion/eye-scale-143";
import { companionCarryAnchor, companionAccessoryPlacement } from "@/lib/ui/viewer-companion/accessory";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { projectCompanionMouth, type CompanionMouthProjectionInput } from "@/lib/ui/viewer-companion/mouth";
import proof from "../fixtures/companion-eye-scale-143.json";

const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const expectedFrames = [...Array.from({ length: 16 }, (_, i) => 144 + i), ...Array.from({ length: 8 }, (_, i) => 376 + i)];
const neutral = (): CompanionMouthProjectionInput => ({
  size: 80, display: { x: 40, y: 80, scale: 1 }, shape: { bob: 0, tilt: 0, scaleX: 1, scaleY: 1 },
  pressure: { x: 0, y: 0, tilt: 0, squash: 0 }, response: { lift: 0, squash: 0 }, facing: 1, sway: { tilt: 0, stretch: 0 },
});

describe("143 exact-source eye edition without changing the audited legacy JSON", () => {
  it("changes exactly two source entries while preserving every520 registration and41 playback rows", () => {
    const old = [...legacyBase.atlases, ...legacyPlay.atlases, ...legacyLiving.atlases];
    expect(companionSpriteMetadata.atlases.filter((v, i) => v.src !== old[i].src).map((_, i) => i)).toHaveLength(2);
    for (let i = 0; i < old.length; i++) {
      const patch = companionEyeScale143Packets.find(p => p.atlas === i);
      expect(companionSpriteMetadata.atlases[i]).toEqual(patch ? { ...old[i], src: patch.src, sha256: patch.sha256, bytes: patch.bytes } : old[i]);
    }
    expect(companionSpriteMetadata.frames).toEqual([...legacyBase.frames,
      ...legacyPlay.frames.map(f => ({ ...f, atlas: f.atlas + legacyBase.atlases.length })),
      ...legacyLiving.frames.map(f => ({ ...f, atlas: f.atlas + legacyBase.atlases.length + legacyPlay.atlases.length }))]);
    expect(companionSpriteMetadata.rows).toEqual(legacyAnchors.rows);
    expect(companionSpriteMetadata.frames).toHaveLength(520);
    expect(companionSpriteMetadata.rows).toHaveLength(41);
  });

  it("requires an exact predecessor path and SHA, without mutating or widening unknown sources", () => {
    for (const patch of companionEyeScale143Packets) {
      const original = { src: patch.parentSrc, sha256: patch.parentSha256, bytes: 1, width: 1536, height: 384 };
      expect(companionEyeScale143Source(original)).toEqual({ ...original, src: patch.src, sha256: patch.sha256, bytes: patch.bytes });
      expect(original.bytes).toBe(1);
      for (const wrong of [{ ...original, sha256: "changed" }, { ...original, src: `${patch.parentSrc}?other` }]) expect(companionEyeScale143Source(wrong)).toBe(wrong);
      const mouthSource = { src: patch.parentSrc, sha256: patch.parentSha256 };
      expect(companionEyeScale143Source(mouthSource)).toEqual({ src: patch.src, sha256: patch.sha256 });
    }
  });

  it("measures only24 source-matched eye boxes and keeps all other496 frames and their pivots", () => {
    const changed: number[] = [];
    for (const pose of legacyAnchors.frames) {
      const source = legacyAnchors.sources[pose.atlas];
      const eyes = companionEyeScale143Eyes(pose, source);
      if (eyes !== pose.eyes) {
        changed.push(pose.physicalIndex);
        expect(eyes).toHaveLength(2);
        expect(Math.hypot(eyes[1].center[0] - eyes[0].center[0], eyes[1].center[1] - eyes[0].center[1])).toBeGreaterThan(13.7);
        expect(companionEyeScale143Eyes(pose, { ...source, sha256: "wrong" })).toBe(pose.eyes);
        expect(companionEyeScale143Eyes({ ...pose, index: 99 }, source)).toBe(pose.eyes);
        expect(companionEyeScale143Eyes({ ...pose, atlas: 0 }, source)).toBe(pose.eyes);
      }
      const selected = selectCompanionSprite(pose.physicalIndex);
      expect(companionCarryAnchor(selected)).toEqual(pose.chest);
      if (pose.orientation !== "back") expect(companionAccessoryPlacement(selected, "round-glasses")).not.toBeNull();
    }
    expect(changed).toEqual(expectedFrames);
  });

  it("projects the unchanged actual mouths for every16 adopted happy cells and rejects a forged source", () => {
    for (const frame of legacyMouths.frames.filter(f => f.index >= 144)) {
      const selected = selectCompanionSprite(frame.index);
      expect(selected.src).toBe(companionEyeScale143Packets[0].src);
      const projected = projectCompanionMouth(selected, neutral());
      expect(projected?.x).toBeCloseTo(frame.x / 192 * 80 + selected.frame.x, 8);
      expect(projected?.y).toBeCloseTo(frame.y / 192 * 80 + selected.frame.y, 8);
      expect(projectCompanionMouth({ ...selected, src: legacyMouths.atlases[frame.atlas].src }, neutral())).toBeNull();
    }
  });

  it("proves decoded packet RGBA, not just declared source hashes, against the explicit24 masks", async () => {
    for (const [file, expected] of Object.entries(proof.legacyJSON)) expect(hash(readFileSync(file))).toBe(expected);
    let changed = 0;
    for (const patch of companionEyeScale143Packets) {
      const beforeBytes = readFileSync(`public${patch.parentSrc}`), afterBytes = readFileSync(`public${patch.src}`);
      expect(hash(beforeBytes)).toBe(patch.parentSha256); expect(hash(afterBytes)).toBe(patch.sha256);
      const before = await sharp(beforeBytes).ensureAlpha().raw().toBuffer();
      const after = await sharp(afterBytes).ensureAlpha().raw().toBuffer();
      expect(hash(after)).toBe(proof.packets.find(p => p.atlas === patch.atlas)!.decodedRgbaSha256);
      let alphaChanges = 0, outsideChanges = 0, mouthChanges = 0;
      for (let cell = 0; cell < 16; cell++) {
        const mapping = proof.frames.find(m => m.atlas === patch.atlas && m.index === cell);
        const allowedMask = new Uint8Array(192 * 192);
        if (mapping) for (const [start, length] of mapping.maskRuns) {
          expect(start).toBeGreaterThanOrEqual(0); expect(start + length).toBeLessThanOrEqual(192 * 192);
          allowedMask.fill(1, start, start + length);
        }
        for (let y = 0; y < 192; y++) for (let x = 0; x < 192; x++) {
          const pixel = ((Math.floor(cell / 8) * 192 + y) * 1536 + cell % 8 * 192 + x) * 4;
          const differs = !before.subarray(pixel, pixel + 4).equals(after.subarray(pixel, pixel + 4));
          const allowed = allowedMask[y * 192 + x] === 1;
          if (allowed && mapping) expect(mapping.declaredEyeBoxes.some(([left, top, right, bottom]) => x >= left && x < right && y >= top && y < bottom)).toBe(true);
          if (before[pixel + 3] !== after[pixel + 3]) alphaChanges++;
          if (differs && !allowed) outsideChanges++;
          if (mapping && x >= mapping.mouthGuard[0] && x < mapping.mouthGuard[2] && y >= mapping.mouthGuard[1] && y < mapping.mouthGuard[3]) {
            expect(allowed).toBe(false);
            if (differs) mouthChanges++;
          }
          if (differs) changed++;
        }
      }
      expect({ alphaChanges, outsideChanges, mouthChanges }).toEqual({ alphaChanges: 0, outsideChanges: 0, mouthChanges: 0 });
    }
    expect(changed).toBeGreaterThan(5000);
    expect(expectedFrames).not.toContain(368);
    expect(expectedFrames).not.toContain(352);
  });
});

import { resolveCompanionAppearanceSource as activeSource } from "@/lib/ui/viewer-companion/appearance";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import anchors from "@/lib/ui/viewer-companion/accessory-anchors.json";
import base from "@/lib/ui/viewer-companion/hd-motion-sprite.json";
import play from "@/lib/ui/viewer-companion/play-motion-sprite.json";
import living from "@/lib/ui/viewer-companion/living-motion-sprite.json";
import edition from "../fixtures/companion-eye-scale-143.json";
import appearanceEdition from "@/lib/ui/viewer-companion/appearance-edition.json";
import homeContactAnchors from "@/lib/ui/viewer-companion/home-contact-anchors-157.json";
import expressionAnchors from "@/lib/ui/viewer-companion/expression-anchors-161.json";
import expressionOverrides from "@/lib/ui/viewer-companion/expression-pose-overrides.json";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionAccessoryPlacement, companionCarryAnchor, companionGiftAnchor, companionHomeContactAnchor } from "@/lib/ui/viewer-companion/accessory";
import { COMPANION_ACCESSORY_IDS } from "@/lib/ui/viewer-companion/gifts";

const root = process.cwd();
const sha256 = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");
const landmarkNames = ["face", "head", "chest", "sideChest", "sideBody"] as const;
const mappedPoint = <T extends { x: number; y: number }>(index: number, point: T) => {
  const { scale, pivot } = appearanceEdition.frames.find(frame => frame.physicalIndex === index)!.material;
  return { ...point, x: pivot.x + (point.x - pivot.x) * scale, y: pivot.y + (point.y - pivot.y) * scale };
};
const mappedLandmark = <T extends { x: number; y: number; width: number }>(index: number, point: T) => ({ ...mappedPoint(index, point),
  width: point.width * appearanceEdition.frames.find(frame => frame.physicalIndex === index)!.material.scale });
const mappedFace = (frame: typeof anchors.frames[number]) => {
  const face = mappedLandmark(frame.physicalIndex, frame.face), expression = [...expressionAnchors.frames, ...expressionOverrides.frames].find(pose => pose.physicalIndex === frame.physicalIndex);
  if (!expression) return face;
  const [a, b] = expression.eyes.map(eye => mappedPoint(frame.physicalIndex, { x: eye.center[0], y: eye.center[1] }));
  return { ...face, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, roll: Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI };
};

describe("source-bound all-pose accessory anchors", () => {
  it("covers the exact520 adopted physical frames and41 logical rows without a generic missing-pose fallback", () => {
    expect(anchors.version).toBe(1); expect(anchors.logicalCell).toBe(80); expect(anchors.textureCell).toBe(192);
    expect(anchors.frameCount).toBe(520); expect(anchors.frames).toHaveLength(companionSpriteMetadata.frames.length);
    expect(anchors.rows).toHaveLength(41); expect(anchors.rows).toEqual(companionSpriteMetadata.rows);
    expect(anchors.frames.map(frame => frame.physicalIndex)).toEqual(Array.from({ length: 520 }, (_, index) => index));
    expect(new Set(anchors.frames.map(frame => `${frame.atlas}:${frame.index}`)).size).toBe(520);
    for (const frame of anchors.frames) {
      const registered = companionSpriteMetadata.frames[frame.physicalIndex];
      expect(frame.atlas).toBe(registered.atlas); expect(frame.index).toBe(registered.index);
      expect(["front", "quarter", "side", "back"]).toContain(frame.orientation);
      const [left, top, right, bottom] = frame.bodyBounds;
      expect(left).toBeLessThan(right); expect(top).toBeLessThan(bottom);
      for (const name of landmarkNames) {
        const landmark = frame[name];
        expect(Object.values(landmark).every(Number.isFinite)).toBe(true);
        expect(landmark.x).toBeGreaterThanOrEqual(0); expect(landmark.x).toBeLessThanOrEqual(80);
        expect(landmark.y).toBeGreaterThanOrEqual(0); expect(landmark.y).toBeLessThanOrEqual(80);
        expect(landmark.width).toBeGreaterThan(0); expect(landmark.width).toBeLessThan(80);
        expect(Math.abs(landmark.roll)).toBeLessThanOrEqual(180);
      }
    }
    // A fixed box shared by every pose cannot satisfy this source-derived
    // variety check. Repeated native hold cells may correctly share numbers.
    for (const name of landmarkNames) expect(new Set(anchors.frames.map(frame => `${frame[name].x}:${frame[name].y}`)).size).toBeGreaterThan(200);
  });

  it("binds all33 exact public packet bytes and the three aggregate mapping inputs", () => {
    expect(anchors.sources).toHaveLength(33); expect(anchors.metadata).toHaveLength(3);
    const historical = [...base.atlases, ...play.atlases, ...living.atlases];
    for (const [index, source] of anchors.sources.entries()) {
      const bytes = fs.readFileSync(path.join(root, "public", source.src));
      expect(sha256(bytes)).toBe(source.sha256); expect(bytes.length).toBe(source.bytes);
      expect(source.src).toBe(historical[index].src);
      expect(source.sha256).toBe(historical[index].sha256);
    }
    for (const source of anchors.metadata) expect(sha256(fs.readFileSync(path.join(root, source.path)))).toBe(source.sha256);
  });

  it("binds the active143 sources separately from the immutable33-packet history", () => {
    for (const [index, parent] of anchors.sources.entries()) {
      const patch = edition.packets.find(p => p.atlas === index);
      if (patch) { expect(parent.src).toBe(patch.parentSrc); expect(parent.sha256).toBe(patch.parentSha256); }
      const expected = activeSource(patch ? { src: patch.src, sha256: patch.sha256, bytes: patch.bytes } : parent);
      expect(companionSpriteMetadata.atlases[index]).toMatchObject(expected);
      const actual = fs.readFileSync(path.join(root, "public", expected.src));
      expect(sha256(actual)).toBe(expected.sha256); expect(actual.length).toBe(expected.bytes);
    }
  });

  it("distinguishes an authored body roll from yaw and explicitly maps the actual rear drawings", () => {
    expect(anchors.frames[323].orientation).toBe("quarter"); expect(anchors.frames[323].face.roll).toBeGreaterThan(80);
    expect(anchors.frames.filter(frame => frame.orientation === "back").map(frame => frame.physicalIndex)).toEqual([326, 327, 328, 329, 330]);
    expect(anchors.frames[326].head.roll).toBeLessThan(-90); expect(anchors.frames[328].head.roll).toBeGreaterThan(90);
    expect(anchors.frames[519].head.y).toBeLessThan(anchors.frames[519].face.y);
    expect(anchors.frames[513].face.roll).toBeLessThan(-15);
    // The folded sad ears are above the face. A yellow forehead square must
    // not replace the far ear and turn an upright hat sideways.
    for (const index of [296, 297]) { expect(Math.abs(anchors.frames[index].head.roll)).toBeLessThan(15); expect(anchors.frames[index].head.width).toBeGreaterThan(6); }
  });

  it("uses only the adopted frame/source pair for every accessory and hides mismatched retained textures", () => {
    for (const frame of anchors.frames) {
      const selected = selectCompanionSprite(frame.physicalIndex);
      expect(companionGiftAnchor(selected)).not.toBeNull();
      for (const id of COMPANION_ACCESSORY_IDS) {
        const placement = companionAccessoryPlacement(selected, id);
        expect(placement).not.toBeNull(); expect(placement!.width).toBeGreaterThan(0);
        expect([placement!.x, placement!.y, placement!.rotation].every(Number.isFinite)).toBe(true);
        if (frame.orientation === "back" && (id === "bow" || id === "star-pin")) expect(placement!.layer).toBe("back");
        if (id === "beret" || id === "flower-crown") expect(placement!.layer).toBe("headwear");
      }
      expect(companionAccessoryPlacement({ ...selected, src: "/companion/hd/unregistered-packet.webp" }, "sunglasses")).toBeNull();
      expect(companionAccessoryPlacement({ ...selected, index: -1 }, "beret")).toBeNull();
      expect(companionGiftAnchor({ ...selected, src: "/companion/hd/unregistered-packet.webp" })).toBeNull();
    }
    // A requested nuzzle can retain the real idle image while its packet
    // decodes. Its accessory must stay on that adopted idle registration.
    const retained = selectCompanionSprite(0), requested = selectCompanionSprite(513);
    expect(companionAccessoryPlacement(retained, "sunglasses")!.x).toBe(mappedFace(anchors.frames[0]).x);
    expect(companionAccessoryPlacement(retained, "sunglasses")!.x).not.toBe(companionAccessoryPlacement(requested, "sunglasses")!.x);
  });

  it("projects all worn-face, carry, gift and overhead anchors through the same measured uniform correction", () => {
    expect(expressionOverrides.frames.map(frame => frame.physicalIndex)).toEqual([323, 324, 325, 331, 332, 333]);
    expect(expressionOverrides.frames.every(frame => ![326, 327, 328, 329, 330].includes(frame.physicalIndex))).toBe(true);
    let corrected = 0;
    for (const frame of anchors.frames) {
      const id = frame.physicalIndex, selected = selectCompanionSprite(id);
      const face = mappedFace(frame), chest = mappedLandmark(id, frame.chest), head = mappedLandmark(id, frame.head);
      const glasses = companionAccessoryPlacement(selected, "sunglasses")!;
      expect({ x: glasses.x, y: glasses.y }).toEqual({ x: face.x, y: face.y });
      expect(companionCarryAnchor(selected)).toEqual(chest);
      expect(companionGiftAnchor(selected)).toEqual({ ...chest, y: chest.y + chest.width * .1,
        width: chest.width * .43, behind: frame.orientation === "back" });
      const contact = homeContactAnchors.frames.find(point => point.physicalIndex === id);
      const expectedContact = contact ? { ...head, ...mappedPoint(id, { x: contact.x, y: contact.y }) } : head;
      expect(companionHomeContactAnchor(selected, true)).toEqual(expectedContact);
      if (appearanceEdition.frames.find(pose => pose.physicalIndex === id)!.material.scale !== 1) corrected++;
    }
    expect(corrected).toBeGreaterThan(200);
  });

  it("recomputes the same registration in check-only mode without modifying the table", () => {
    const target = path.join(root, "lib/ui/viewer-companion/accessory-anchors.json"), before = fs.readFileSync(target);
    // Recompute every source/frame, including decode and pixel components.
    // Bound the child below Vitest's limit so a loaded full-suite run reports
    // its real process error before the test deadline (not the default5s).
    const report = execFileSync(process.execPath, ["scripts/prepare-companion-accessory-anchors.mjs", "--check"], { cwd: root, encoding: "utf8", timeout: 15000 });
    expect(JSON.parse(report)).toMatchObject({ check: true, frames: 520, rows: 41, sources: 33, sourcePixelsUnchanged: true, visualApproval: false });
    expect(fs.readFileSync(target)).toEqual(before);
  }, 20000);
});

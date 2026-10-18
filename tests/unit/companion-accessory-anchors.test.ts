import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import anchors from "@/lib/ui/viewer-companion/accessory-anchors.json";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionAccessoryPlacement, companionGiftAnchor } from "@/lib/ui/viewer-companion/accessory";
import { COMPANION_ACCESSORY_IDS } from "@/lib/ui/viewer-companion/gifts";

const root = process.cwd();
const sha256 = (bytes: Buffer) => crypto.createHash("sha256").update(bytes).digest("hex");
const landmarkNames = ["face", "head", "chest", "sideChest", "sideBody"] as const;

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
    for (const [index, source] of anchors.sources.entries()) {
      const bytes = fs.readFileSync(path.join(root, "public", source.src));
      expect(sha256(bytes)).toBe(source.sha256); expect(bytes.length).toBe(source.bytes);
      expect(source.src).toBe(companionSpriteMetadata.atlases[index].src);
      expect(source.sha256).toBe(companionSpriteMetadata.atlases[index].sha256);
    }
    for (const source of anchors.metadata) expect(sha256(fs.readFileSync(path.join(root, source.path)))).toBe(source.sha256);
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
    expect(companionAccessoryPlacement(retained, "sunglasses")!.x).toBe(anchors.frames[0].face.x);
    expect(companionAccessoryPlacement(retained, "sunglasses")!.x).not.toBe(companionAccessoryPlacement(requested, "sunglasses")!.x);
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

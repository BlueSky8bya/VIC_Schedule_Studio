import { describe, expect, it } from "vitest";
import { companionEyeFaceBounds } from "@/lib/ui/viewer-companion/accessory-eye-fit";
import { companionAccessoryPlacement } from "@/lib/ui/viewer-companion/accessory";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";

describe("worn eye fit is measured in the face axis once", () => {
  it("keeps a rolled eye drawing at its own size instead of re-projecting its rotated envelope", () => {
    for (const roll of [-35, -20, -2, 0, 14, 20, 35]) {
      const angle = roll * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      // An eye drawing of half size 3x2 sits 7 units along the rolled eye line.
      const center = [40 + 7 * c, 50 + 7 * s], tight = [center[0] - .5, center[1] - .5, center[0] + .5, center[1] + .5];
      const [u0, v0, u1, v1] = companionEyeFaceBounds({ center, bounds: tight, drawn: [3, 2] }, { x: 40, y: 50, roll });
      expect(u0).toBeCloseTo(4, 6); expect(u1).toBeCloseTo(10, 6);
      expect(v0).toBeCloseTo(-2, 6); expect(v1).toBeCloseTo(2, 6);
    }
  });
  it("still contains every corner of the measured pixel box", () => {
    const eye = { center: [47, 49], bounds: [45.8, 47.9, 50.8, 51.7], drawn: [1, 1] };
    const face = { x: 42, y: 52, roll: -20 }, angle = face.roll * Math.PI / 180;
    const [u0, v0, u1, v1] = companionEyeFaceBounds(eye, face);
    for (const x of [eye.bounds[0], eye.bounds[2]]) for (const y of [eye.bounds[1], eye.bounds[3]]) {
      const u = (x - face.x) * Math.cos(angle) + (y - face.y) * Math.sin(angle), v = -(x - face.x) * Math.sin(angle) + (y - face.y) * Math.cos(angle);
      expect(u).toBeGreaterThanOrEqual(u0 - 1e-9); expect(u).toBeLessThanOrEqual(u1 + 1e-9);
      expect(v).toBeGreaterThanOrEqual(v0 - 1e-9); expect(v).toBeLessThanOrEqual(v1 + 1e-9);
    }
  });
  it("does not inflate sleep masks or the monocle on rolled gestures (lean-nuzzle, tumble, cheer, row 38)", () => {
    const width = (physical: number, id: "sleep-mask-smile" | "monocle") => companionAccessoryPlacement(selectCompanionSprite(physical), id)!.width;
    for (const id of ["sleep-mask-smile", "monocle"] as const) {
      const rest = width(0, id);
      // Previously 1.24x..1.64x the standing size: the "suddenly huge" mask.
      for (const physical of [128, 140, 320, 331, 513, 517]) expect(width(physical, id) / rest, `${id}:${physical}`).toBeLessThan(1.06);
    }
  });
  it("keeps every face-visible gesture frame within the eye drawings' real growth", () => {
    // The dizzy spiral eyes (row 22, cells 0..15) are drawn larger than the
    // standing eyes, but a worn cover keeps its standing size there (owner
    // 2026-11-19: spirals may peek out); every other frame stays near it too.
    const rest = { mask: companionAccessoryPlacement(selectCompanionSprite(0), "sleep-mask-smile")!.width, monocle: companionAccessoryPlacement(selectCompanionSprite(0), "monocle")!.width };
    companionSpriteMetadata.rows.forEach((row, r) => row.forEach((physical, column) => {
      const selected = selectCompanionSprite(physical, r, column), spiral = physical >= 336 && physical <= 351;
      for (const [id, base] of [["sleep-mask-smile", rest.mask], ["monocle", rest.monocle]] as const) {
        const placed = companionAccessoryPlacement(selected, id);
        if (!placed || placed.layer === "back") continue;
        expect(placed.width / base, `${id}:${physical}`).toBeLessThan(spiral ? 1.06 : 1.15);
      }
    }));
  });
});

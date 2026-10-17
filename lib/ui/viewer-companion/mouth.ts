import metadata from "./hd-motion-sprite.json";
import calibration from "./mouth-anchors.json";
import { projectCompanionSpritePoint, type CompanionSofaPoseInput } from "./sofa-pose";
import type { CompanionSpriteSelection } from "./sprite-quality";

const anchors = new Map(calibration.frames.map(frame => [frame.index, frame]));
export type CompanionMouthProjectionInput = Omit<CompanionSofaPoseInput, "cell">;

/** Count only time owned by this meal. A long preceding frame can launch a
 * new eat action now; that earlier time is not a failed texture wait. */
export function advanceCompanionMealWait(now: number, began: number, delta: number, waited: number) {
  const elapsed = Math.max(0, Math.min(delta, now - began));
  const next = waited + elapsed;
  return { began: began + elapsed, waited: next, expired: next >= 1200 };
}

/** Only the image actually adopted by the renderer may supply a bite anchor.
 * Measurements bind the current native atlas SHA and cell; a future art pack
 * must register its own mouth instead of silently inheriting old proportions.
 * No pixel analysis, DOM measurement, model or extra clock runs in the app. */
export function projectCompanionMouth(selected: CompanionSpriteSelection, input: CompanionMouthProjectionInput): { x: number; y: number } | null {
  const anchor = anchors.get(selected.physicalIndex);
  if (!anchor) return null;
  const frame = metadata.frames[selected.physicalIndex];
  const atlas = frame && metadata.atlases[frame.atlas];
  const source = calibration.atlases[anchor.atlas];
  if (!atlas || !source || atlas.src !== selected.src || atlas.src !== source.src || atlas.sha256 !== source.sha256
    || selected.index !== anchor.cell || frame.index !== anchor.cell || calibration.cell <= 0) return null;
  return projectCompanionSpritePoint({ ...input, cell: selected.frame }, { x: anchor.x / calibration.cell * 80, y: anchor.y / calibration.cell * 80 });
}

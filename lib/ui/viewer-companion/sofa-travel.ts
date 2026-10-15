import { sampleCompanionTravel } from "./motion";

type Point = Readonly<{ x: number; y: number }>;

/** Crossing a solid sofa rim is a finite lift, passage and landing, rather
 * than a straight line through its side. All coordinates come from the same
 * measured room; the caller keeps the existing action clock and scheduler. */
export function sampleCompanionSofaTravel(from: Point, to: Point, progress: number, clearanceY: number) {
  const p = Math.max(0, Math.min(1, progress));
  const lift = Math.min(from.y, to.y, clearanceY);
  const horizontal = sampleCompanionTravel(Math.max(0, Math.min(1, (p - .28) / .44)));
  const y = p < .28 ? from.y + (lift - from.y) * sampleCompanionTravel(p / .28)
    : p <= .72 ? lift : lift + (to.y - lift) * sampleCompanionTravel((p - .72) / .28);
  return { x: from.x + (to.x - from.x) * horizontal, y, horizontal };
}

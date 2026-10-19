import { companionToyReturnDelivered, sampleCompanionToyReturn } from "./toy-return";

type Point = Readonly<{ x: number; y: number }>;
type Rect = Readonly<{ left: number; top: number; width: number; height: number }>;

/** The real bin's upper opening, using its current native control frame. */
export function companionFoodDisposalTarget(rect: Rect, available = true): Point | undefined {
  if (!available || ![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height * .35 };
}

/** Reuse the finite item arc, allowing the small snack60% of this action to
 * reach the bin. The world clock and actual painted food still own delivery. */
export function sampleCompanionFoodDisposal(from: Point, target: Point, progress: number): Point {
  return sampleCompanionToyReturn(from, target, progress * .28 / .6);
}
export const companionFoodDisposalDelivered = companionToyReturnDelivered;

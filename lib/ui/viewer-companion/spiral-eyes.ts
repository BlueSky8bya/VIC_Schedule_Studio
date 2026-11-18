import { companionAppearanceBounds, companionAppearanceFrames } from "./appearance";

// Outer rings measured in the immutable 192px cells336..351, not the inner
// dark component returned by the general pupil detector. Include2px AA.
// These are same-pose source windows; no other face/skin is transplanted.
const nativeRings: Readonly<Record<number, readonly (readonly number[])[]>> = {
  43: [[88, 102, 112, 126], [122, 110, 144, 134]],
  44: [[73, 113, 95, 134], [107, 121, 128, 143]],
};

export function companionSpiralEyeBounds(index: number): number[][] {
  const frame = companionAppearanceFrames.get(index);
  if (frame?.eyeState !== "spiral") return [];
  return (nativeRings[frame.nativeCell] ?? []).map(box =>
    companionAppearanceBounds(index, box.map(value => value / 2.4)).map(value => Math.round(value * 2.4)));
}

/** Native bake only: keep the source's complete concentric dizzy eyes after
 * the old mouth corridor has been removed. That corridor can touch a ring.
 * Runtime expressions already yield to authored spiral cells. */
export function restoreCompanionSpiralEyes(target: Uint8ClampedArray, source: Uint8ClampedArray, index: number) {
  for (const [left, top, right, bottom] of companionSpiralEyeBounds(index)) {
    for (let y = top; y <= bottom; y++) {
      const start = (y * 192 + left) * 4;
      target.set(source.subarray(start, (y * 192 + right + 1) * 4), start);
    }
  }
}

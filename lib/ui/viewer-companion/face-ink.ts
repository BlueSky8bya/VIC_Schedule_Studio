/** Facial ink sits above the authored cheek decorations. Background repair
 * still owns its old bounded mask; it must not clip a newly drawn mouth/lid.
 * Keep the source alpha exactly, including intentionally translucent253. */
export function compositeCompanionFaceInk(target: Uint8ClampedArray, source: Uint8ClampedArray, ink: Uint8ClampedArray, weight: number) {
  for (let i = 0; i < target.length; i += 4) {
    const opacity = source[i + 3] >= 245 ? ink[i + 3] / 255 * weight : 0;
    if (opacity) for (let channel = 0; channel < 3; channel++) target[i + channel] = Math.round(target[i + channel] * (1 - opacity) + ink[i + channel] * opacity);
    target[i + 3] = source[i + 3];
  }
}

/** Same-source tear colour, not a new drawing or copied skin. Eye-background
 * repair can cross the upper part of the native tear and must not erase it. */
export function restoreCompanionTearInk(target: Uint8ClampedArray, source: Uint8ClampedArray) {
  for (let i = 0; i < target.length; i += 4) {
    if (source[i + 3] >= 245 && source[i + 2] > source[i] + 25 && source[i + 1] > source[i] + 15) target.set(source.subarray(i, i + 4), i);
  }
}

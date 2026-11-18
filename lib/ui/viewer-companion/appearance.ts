import edition from "./appearance-edition.json";
import { companionEyeScale143Source } from "./eye-scale-143";
type Source = { src: string; sha256: string; bytes?: number };
export function companionAppearanceSource<T extends Source>(source: T): T {
  const patch = edition.packets.find(packet => packet.parentSrc === source.src && packet.parentSha256 === source.sha256);
  return patch ? { ...source, src: patch.src, sha256: patch.sha256, bytes: patch.bytes, width: patch.width, height: patch.height, gridRows: patch.gridRows } : source;
}
export const resolveCompanionAppearanceSource = <T extends Source>(source: T): T => companionAppearanceSource(companionEyeScale143Source(source));
export const companionAppearanceFrames = new Map(edition.frames.map(frame => [frame.physicalIndex, frame]));
export const companionAppearanceGridRows = (src: string) => edition.packets.find(packet => packet.src === src)?.gridRows;

/** The same offline uniform material correction owns every local landmark.
 * Registration x/y is unchanged; clip follows the newly sampled whole pose. */
export function companionAppearancePoint<T extends { x: number; y: number }>(index: number, point: T): T {
  const material = companionAppearanceFrames.get(index)?.material;
  if (!material) return point;
  return { ...point, x: material.pivot.x + (point.x - material.pivot.x) * material.scale,
    y: material.pivot.y + (point.y - material.pivot.y) * material.scale };
}
export function companionAppearanceBounds(index: number, bounds: readonly number[]) {
  const a = companionAppearancePoint(index, { x: bounds[0], y: bounds[1] }), b = companionAppearancePoint(index, { x: bounds[2], y: bounds[3] });
  return [a.x, a.y, b.x, b.y];
}
export function companionAppearanceEyes<T extends { center: readonly number[]; bounds: readonly number[]; skinSamples?: readonly (readonly number[])[] }>(index: number, eyes: readonly T[]): T[] {
  const pair = (point: readonly number[]) => { const p = companionAppearancePoint(index, { x: point[0], y: point[1] }); return [p.x, p.y]; };
  return eyes.map(eye => ({ ...eye, center: pair(eye.center), bounds: companionAppearanceBounds(index, eye.bounds),
    ...(eye.skinSamples ? { skinSamples: eye.skinSamples.map(pair) } : {}) }));
}
export function companionAppearanceLandmark<T extends { x: number; y: number; width: number }>(index: number, point: T): T {
  return { ...companionAppearancePoint(index, point), width: point.width * (companionAppearanceFrames.get(index)?.material.scale ?? 1) };
}
export function companionAppearanceFrame<T extends { clip: readonly number[] }>(index: number, frame: T): T {
  return { ...frame, clip: companionAppearanceFrames.get(index)?.clip ?? frame.clip };
}

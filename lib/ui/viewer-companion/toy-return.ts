type Point = Readonly<{ x: number; y: number }>;
type Rect = Readonly<{ left: number; top: number; width: number; height: number }>;
const finite = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);

/** The caller measures the same native opening only during its existing finite
 * layout follow. Keep absolute coordinates: body and box reflow independently. */
export function companionToyReturnTarget(rect: Rect, available = true): Point | undefined {
  if (!available || ![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height };
}

/** Preserve the authored28% approach and18px lift, using the current projected
 * carry point and cached native opening without another paint-time DOM read. */
export function sampleCompanionToyReturn(from: Point, target: Point, progress: number): Point {
  const phase = Math.max(0, Math.min(1, progress / .28)), ease = phase * phase * (3 - 2 * phase);
  return { x: from.x + (target.x - from.x) * ease, y: from.y + (target.y - from.y) * ease - Math.sin(phase * Math.PI) * 18 };
}

/** An ACK needs the last actually painted foot, not a planned body-relative aim. */
export function companionToyReturnDelivered(painted: Point | undefined, target: Point | undefined) {
  return Boolean(painted && target && finite(painted) && finite(target) && Math.hypot(painted.x - target.x, painted.y - target.y) < 20);
}

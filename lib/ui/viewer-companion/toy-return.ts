import { COMPANION_JUMP_LIMITS, type Platform } from "./brain";

type Point = Readonly<{ x: number; y: number }>;
type Rect = Readonly<{ left: number; top: number; width: number; height: number }>;
type SupportedPoint = Point & Readonly<{ platformId?: string }>;
const finite = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);
const validRect = (rect: Rect) => [rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) && rect.width > 0 && rect.height > 0;

/** The existing physical box gate, without enlarging either axis. */
export function companionToyBoxClose(point: Point, rect: Rect, size: number) {
  return finite(point) && validRect(rect) && Number.isFinite(size) && size > 0
    && Math.abs(point.x - rect.left - rect.width / 2) <= size + rect.width / 2 && Math.abs(point.y - rect.top - rect.height) <= 140;
}

const onBodyFloor = (point: SupportedPoint, floor: Platform | undefined) => Boolean(floor && floor.kind === "floor" && floor.manualOnly
  && /^companion-home-floor(?:-\d+)?$/.test(floor.id) && point.platformId === floor.id && finite(point)
  && [floor.x, floor.y, floor.width].every(Number.isFinite) && floor.width > 0
  && point.x >= floor.x && point.x <= floor.x + floor.width && Math.abs(point.y - floor.y) <= 2);

/** Only the last grounded box interaction may use the already body-safe span
 * beyond the normal jump-landing inset. Never cross a gap or extend that span. */
export function planCompanionToyBoxApproach(from: SupportedPoint, floor: Platform | undefined, rect: Rect, size: number, available = true):
  { kind: "ready" } | { kind: "walk"; target: Point & { platformId: string } } | undefined {
  if (!available || !onBodyFloor(from, floor) || !validRect(rect) || !Number.isFinite(size) || size <= 0
    || Math.abs(from.y - rect.top - rect.height) > 140) return;
  if (companionToyBoxClose(from, rect, size)) return { kind: "ready" };
  const left = Math.max(floor!.x, rect.left - size), right = Math.min(floor!.x + floor!.width, rect.left + rect.width + size);
  if (right < left) return;
  const inset = Math.min(1, (right - left) / 2), x = Math.max(left + inset, Math.min(right - inset, from.x));
  const target = { x, y: floor!.y, platformId: floor!.id };
  if (!validCompanionToyBoxApproach(from, target, floor, rect, size, available)) return;
  return { kind: "walk", target };
}

/** Layout validation keeps the same target and clock. Cancellation, a replaced
 * source, or a lost safe intersection cannot become an ordinary clamped walk. */
export function validCompanionToyBoxApproach(from: SupportedPoint, target: SupportedPoint, floor: Platform | undefined, rect: Rect, size: number, available = true) {
  return Boolean(available && onBodyFloor(from, floor) && onBodyFloor(target, floor) && Math.abs(target.y - floor!.y) <= .01
    && Math.abs(target.x - from.x) <= COMPANION_JUMP_LIMITS.landingInset + 1e-7 && companionToyBoxClose(target, rect, size));
}

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

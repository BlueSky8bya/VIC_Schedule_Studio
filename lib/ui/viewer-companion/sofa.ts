import type { Platform } from "./brain";

type Rect = { left: number; right: number; top: number; bottom: number };
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

/** A seat interval contains the registered opaque body, not just its feet.
 * Other ledges deliberately permit overhang; the solid sofa sidewalls do not. */
export function companionSofaSeat(rect: Pick<Rect, "left" | "right" | "top">, size: number) {
  if (![rect.left, rect.right, rect.top, size].every(Number.isFinite) || size <= 0) return null;
  const margin = size * .76 / 2 + 3, left = rect.left + margin, right = rect.right - margin;
  return right - left >= 1 ? { x: left, y: rect.top, width: right - left } : null;
}

/** Only a deliberate release over the actual sofa uses this collider. An
 * inner-rim touch settles into its contained seat; the outer/front rim slides
 * to a genuine room floor. No invented support, timer or food seat is added. */
export function companionSofaRelease(point: { x: number; y: number }, bed: Rect, seat: Platform | undefined, floors: readonly Platform[], size: number) {
  if (![point.x, point.y, bed.left, bed.right, bed.top, bed.bottom, size].every(Number.isFinite) || size <= 0
    || point.x + size * .38 < bed.left || point.x - size * .38 > bed.right || point.y < bed.top || point.y > bed.bottom + 4) return null;
  if (seat && point.y <= seat.y + 4) {
    const x = clamp(point.x, seat.x, seat.x + seat.width);
    if (Math.abs(x - point.x) <= size * .24) return { x, y: seat.y, platformId: seat.id };
  }
  let selected: Platform | undefined, distance = Infinity;
  for (const floor of floors) {
    if (!/^companion-home-floor(?:-\d+)?$/.test(floor.id) || floor.y < bed.top || floor.width <= 0) continue;
    const dx = Math.abs(clamp(point.x, floor.x, floor.x + floor.width) - point.x);
    if (dx < distance) { selected = floor; distance = dx; }
  }
  return selected ? { x: clamp(point.x, selected.x, selected.x + selected.width), y: selected.y, platformId: selected.id } : null;
}

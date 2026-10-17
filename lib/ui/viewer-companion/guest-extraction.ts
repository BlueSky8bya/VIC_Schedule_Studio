export type CompanionGuestBounds = { left: number; top: number; right: number; bottom: number };

/** A finite, reversible visual ramp. The caller captures the sheet once at
 * pickup; pointer samples never remeasure the editor or inspect its content. */
export function companionGuestExtractionScale(
  initialScale: number,
  point: { x: number; y: number },
  bounds: CompanionGuestBounds | undefined,
  size: number,
  reduced = false,
): number {
  const initial = Number.isFinite(initialScale) && initialScale > 0 ? Math.min(1, initialScale) : 1;
  if (!bounds || ![point.x, point.y, bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite)
    || bounds.right <= bounds.left || bounds.bottom <= bounds.top) return initial;
  const outside = Math.hypot(Math.max(bounds.left - point.x, point.x - bounds.right, 0), Math.max(bounds.top - point.y, point.y - bounds.bottom, 0));
  if (reduced) return outside > 0 ? 1 : initial;
  const distance = Math.max(1, Number.isFinite(size) && size > 0 ? size : 92);
  const t = Math.min(1, outside / distance);
  const ease = t * t * (3 - 2 * t);
  return initial + (1 - initial) * ease;
}

export type CompanionOverlayPoint = { x: number; y: number; scale?: number };
export type CompanionOverlayViewport = { width: number; height: number };
export type CompanionOverlayRect = { left: number; top: number; right: number; bottom: number };
export type CompanionOverlayPerch = { x: number; y: number; scale: number; overlap: boolean };

// The registered opaque body occupies roughly the bottom 76% of the sprite.
// Transparent ear/cell margins may cross a window; the body gets a 6px gutter.
const BODY = .76;
const GUTTER = 6;
const EPSILON = 1e-7;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const positive = (value: number, fallback: number) => Number.isFinite(value) && value > 0 ? Math.min(value, 1_000_000) : fallback;

/** Display-only perch. Does not replace the pet's world position or DOM support. */
export function placeCompanionOverlayPerch(
  last: CompanionOverlayPoint,
  size: number,
  viewport: CompanionOverlayViewport,
  exclusions: readonly CompanionOverlayRect[],
): CompanionOverlayPerch {
  const width = Math.max(1, positive(viewport.width, 1));
  const height = Math.max(1, positive(viewport.height, 1));
  const base = positive(size, 76);
  const margin = Math.min(4, (Math.min(width, height) - 1) / 2);
  const capacity = Math.min(width - margin * 2, height - margin * 2);
  const sizes = [...new Set([base, Math.min(base, 60), Math.min(base, 44)].map(value => Math.min(value, capacity)))];
  const origin = {
    x: Number.isFinite(last.x) ? clamp(last.x, 0, width) : width / 2,
    y: Number.isFinite(last.y) ? clamp(last.y, 0, height) : height,
  };
  const windows = exclusions.flatMap(rect => {
    if (![rect.left, rect.top, rect.right, rect.bottom].every(Number.isFinite)) return [];
    const left = clamp(rect.left, 0, width), right = clamp(rect.right, 0, width);
    const top = clamp(rect.top, 0, height), bottom = clamp(rect.bottom, 0, height);
    return right > left && bottom > top ? [{ left: left - GUTTER, right: right + GUTTER, top: top - GUTTER, bottom: bottom + GUTTER }] : [];
  });
  const bounds = (cell: number) => ({ left: margin + cell / 2, right: width - margin - cell / 2, top: margin + cell, bottom: height - margin });
  const body = (point: { x: number; y: number }, cell: number) => ({ left: point.x - cell * BODY / 2, right: point.x + cell * BODY / 2, top: point.y - cell * BODY, bottom: point.y });
  const collision = (point: { x: number; y: number }, cell: number) => {
    const b = body(point, cell);
    return windows.some(rect => b.right > rect.left + EPSILON && b.left < rect.right - EPSILON && b.bottom > rect.top + EPSILON && b.top < rect.bottom - EPSILON);
  };
  const inside = (point: { x: number; y: number }, cell: number) => {
    const b = bounds(cell);
    return point.x >= b.left - EPSILON && point.x <= b.right + EPSILON && point.y >= b.top - EPSILON && point.y <= b.bottom + EPSILON;
  };
  const result = (point: { x: number; y: number }, cell: number, overlap = false): CompanionOverlayPerch => ({ ...point, scale: cell / base, overlap });

  // A caller may feed the last display result back in after a resize. Keep a
  // valid perch rather than jumping between equally good edges on every scan.
  const previous = Number.isFinite(last.scale) && last.scale! > 0
    ? clamp(base * Math.min(1, last.scale!), sizes[sizes.length - 1], sizes[0])
    : sizes[0];
  if (inside(origin, previous) && !collision(origin, previous)) return result(origin, previous);

  for (const cell of sizes) {
    const b = bounds(cell);
    const xs = [clamp(origin.x, b.left, b.right), b.left, b.right];
    const ys = [clamp(origin.y, b.top, b.bottom), b.top, b.bottom];
    for (const rect of windows) {
      xs.push(clamp(rect.left - cell * BODY / 2, b.left, b.right), clamp(rect.right + cell * BODY / 2, b.left, b.right));
      ys.push(clamp(rect.top, b.top, b.bottom), clamp(rect.bottom + cell * BODY, b.top, b.bottom));
    }
    let nearest: { x: number; y: number } | undefined;
    let distance = Infinity;
    for (const x of new Set(xs)) for (const y of new Set(ys)) {
      const point = { x, y };
      if (collision(point, cell)) continue;
      const next = Math.hypot(x - origin.x, y - origin.y);
      if (next < distance) { nearest = point; distance = next; }
    }
    // Prefer the full-size pet; shrink only when that tier has no clear space.
    if (nearest) return result(nearest, cell);
  }

  // No body-sized gap exists (e.g. a fullscreen dialog). Stay visibly bounded
  // in a corner; the caller disables all pet hit targets while overlaying UI.
  const cell = sizes[sizes.length - 1];
  const b = bounds(cell);
  const corners = [{ x: b.left, y: b.top }, { x: b.right, y: b.top }, { x: b.left, y: b.bottom }, { x: b.right, y: b.bottom }];
  const area = (point: { x: number; y: number }) => {
    const opaque = body(point, cell);
    return windows.reduce((sum, rect) => sum + Math.max(0, Math.min(opaque.right, rect.right) - Math.max(opaque.left, rect.left)) * Math.max(0, Math.min(opaque.bottom, rect.bottom) - Math.max(opaque.top, rect.top)), 0);
  };
  corners.sort((a, c) => {
    const difference = area(a) - area(c);
    return Math.abs(difference) > EPSILON ? difference : Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(c.x - origin.x, c.y - origin.y);
  });
  return result(corners[0], cell, true);
}

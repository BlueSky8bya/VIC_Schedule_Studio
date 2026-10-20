import type { Platform } from "./brain";

export type CompanionSofaPoint = Readonly<{ x: number; y: number }>;
export type CompanionSofaRect = Readonly<{ left: number; right: number; top: number; bottom: number }>;
export type CompanionSofaDepth = "clear" | "back" | "seat" | "front";
type Rect = CompanionSofaRect;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const finiteRect = (rect: Rect) => [rect.left, rect.right, rect.top, rect.bottom].every(Number.isFinite) && rect.right > rect.left && rect.bottom > rect.top;
const opening = (bed: Rect) => ({ left: bed.left + (bed.right - bed.left) * 31 / 180, right: bed.right - (bed.right - bed.left) * 31 / 180 });
const bodyBounds = (points: readonly CompanionSofaPoint[]): Rect | null => {
  if (points.length < 3 || !points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) return null;
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const rect = { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
  return finiteRect(rect) ? rect : null;
};
const intersects = (a: Rect, b: Rect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

/** A local smile/rocking pose cannot move a grounded resident in front of its
 * cushion. Actual captured movement, flight and pickup recovery keep using
 * the full current polygon. The real safe seat owns this narrow exception. */
export function companionSofaResident(input: { point: CompanionSofaPoint; seat?: Platform; connected: boolean; held: boolean; placing: boolean; airborne: boolean; pickupTail: boolean }) {
  const { point, seat } = input;
  return Boolean(input.connected && !input.held && !input.placing && !input.airborne && !input.pickupTail
    && seat?.id === "companion-home" && seat.kind === "date" && [point.x, point.y, seat.x, seat.y, seat.width].every(Number.isFinite)
    && seat.width > 0 && point.x >= seat.x && point.x <= seat.x + seat.width && Math.abs(point.y - seat.y) <= .5);
}

/** The same rendered body can be on either side of the furniture while its
 * old support ID remains unchanged. The caller supplies the current opaque
 * polygon AFTER registration, local pose/contact/reaction, facing and inertia;
 * this helper never reads DOM or moves the captured hand/world position.
 *
 * The shared180x100 art opens between31..149, with side tips at19 and its
 * upper opening at31. The actual CSS seat plane is a separate measured input;
 * the visible front crest at54 is not the creature's landing plane. */
export function companionSofaDepth({ point, body, bed, seatY, previous, resident = false, groundY }: {
  point: CompanionSofaPoint;
  body: readonly CompanionSofaPoint[];
  bed: Rect;
  seatY: number;
  previous?: CompanionSofaDepth;
  /** Only companionSofaResident's current grounded seat proof may set this. */
  resident?: boolean;
  /** Ground-plane travel depth during a jump. Raising the actual body does
   * not move its ground path behind furniture; body/side clearance stays real. */
  groundY?: number;
}): CompanionSofaDepth {
  const bounds = bodyBounds(body);
  if (!bounds || !finiteRect(bed) || ![point.x, point.y, seatY].every(Number.isFinite) || !intersects(bounds, bed)) return "clear";
  const height = bed.bottom - bed.top;
  // Only the complete deformed body clearing the tallest side tip is enough
  // to pass above the sofa. A foot or neutral92px box cannot establish this.
  if (bounds.bottom <= bed.top + height * .19) return "clear";
  const inner = opening(bed);
  const depthY = Number.isFinite(groundY) ? groundY! : point.y;
  const seated = Math.abs(depthY - seatY) <= .5;
  // Whole-body containment wins over history: an ear-grip lean or outside
  // lateral lift must never leave the U painted through part of the creature.
  if ((bounds.left < inner.left - 1e-7 || bounds.right > inner.right + 1e-7) && !(resident && seated)) return "front";
  const depthLimit = seatY + (previous === "seat" || previous === "back" ? 2 : previous === "front" ? -2 : 0);
  if (!seated && depthY > depthLimit) return "front";
  // Hysteresis is bounded to the depth plane, never a permit to cross either
  // sidewall. A real settled seat always restores its proper back/front order.
  const backLimit = bed.top + height * .31 + (previous === "back" ? 2 : previous === "seat" ? -2 : 0);
  return depthY < backLimit ? "back" : "seat";
}

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
export function companionSofaRelease(point: { x: number; y: number }, bed: Rect, seat: Platform | undefined, floors: readonly Platform[], size: number, options?: { body?: readonly CompanionSofaPoint[]; depth?: CompanionSofaDepth }) {
  if (![point.x, point.y, size].every(Number.isFinite) || size <= 0 || !finiteRect(bed)) return null;
  const bounds = options?.body ? bodyBounds(options.body) : null;
  if (options?.body) {
    if (!bounds || !intersects(bounds, bed)) return null;
  } else if (point.x + size * .38 < bed.left || point.x - size * .38 > bed.right || point.y < bed.top || point.y > bed.bottom + 4) return null;
  const depth = bounds ? options?.depth ?? companionSofaDepth({ point, body: options!.body!, bed, seatY: seat?.y ?? bed.bottom }) : undefined;
  if (depth === "clear") return null;
  if (seat && point.y <= seat.y + 4 && depth !== "front") {
    const inner = opening(bed);
    // A posed ear/body grip can be wider or translated relative to its feet.
    // Its complete current silhouette must fit after the same landing delta.
    const left = Math.max(seat.x, bounds ? point.x + inner.left - bounds.left : seat.x);
    const right = Math.min(seat.x + seat.width, bounds ? point.x + inner.right - bounds.right : seat.x + seat.width);
    const x = clamp(point.x, left, right);
    if (right >= left && Math.abs(x - point.x) <= size * .24) return { x, y: seat.y, platformId: seat.id };
  }
  let selected: Platform | undefined, distance = Infinity;
  for (const floor of floors) {
    if (!/^companion-home-floor(?:-\d+)?$/.test(floor.id) || floor.y < bed.top || floor.width <= 0) continue;
    const dx = Math.abs(clamp(point.x, floor.x, floor.x + floor.width) - point.x);
    if (dx < distance) { selected = floor; distance = dx; }
  }
  return selected ? { x: clamp(point.x, selected.x, selected.x + selected.width), y: selected.y, platformId: selected.id } : null;
}

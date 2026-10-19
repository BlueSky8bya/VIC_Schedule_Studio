import { platformLandingX, type CompanionFood, type Platform } from "./brain";
import { firstCompanionSupportBelow } from "./support-landing";
import { attachCompanionElementPoint, followCompanionElementPoint, type CompanionElementPoint } from "./element-anchor";

export { MAX_COMPANION_FOOD } from "./food-capacity";
/** Retired attachment id, recognized only to reject stale seat targets. */
export const COMPANION_HOME_BED_FOOD = "companion-home-bed-food";
export const COMPANION_HOME_FLOOR_FOOD = "companion-home-floor-food";
export const COMPANION_HOME_FLOOR_INSET = 6;
/** Geometry may split the real floor around controls. Its separate anonymous
 * spans all retain the same home attachment after a physical falling contact. */
export function isCompanionHomeFloorFoodSupport(id?: string): boolean {
  return /^companion-home-floor-food(?:-\d+)?$/.test(id ?? "");
}
export function isCompanionViewportFloorFoodSupport(id?: string): boolean {
  return /^viewport-floor-food(?:-\d+)?$/.test(id ?? "");
}
/** The creature keeps its sofa support; every food path excludes that seat,
 * including old food-only snapshots and their anonymous split segments. */
export function isCompanionFoodBedSupport(id?: string): boolean {
  return /^companion-home(?:-(?:food|bed-food))?(?:-\d+)?$/.test(id ?? "");
}
export const COMPANION_TRASH_DWELL_MS = 320;
export const COMPANION_TRASH_DISCARD_MS = 180;
export type CompanionFoodPresentation = { x: number; y: number; scale: number; rotation: number; scaleX?: number; scaleY?: number };
export type CompanionFoodAttachment = { documentX: number; documentY: number; offsetX: number; offsetY: number; elementPoint?: CompanionElementPoint };
/** Food-only manual collision bounds. The safe centre span can be split around
 * nearby controls while its actual card still occupies the intervening gap.
 * Pet routing and anonymous shared Platform objects do not use this metadata. */
export type CompanionFoodDropSupport = Platform & { dropSurface?: Readonly<{ x: number; width: number }> };
type Point = { x: number; y: number };
type AnchorRect = { left: number; top: number; width?: number; height?: number };
type HomeFoodRect = { left: number; top: number; width: number; height: number };

/** Pair a cached food span and its card bounds with one current DOM origin at
 * deliberate release. Scrolling applies the same delta once to both, including
 * before the coalesced full geometry scan has delivered its next snapshot. */
export function rebaseCompanionFoodSupport(support: CompanionFoodDropSupport, source: AnchorRect, rect: AnchorRect & { width: number }): CompanionFoodDropSupport | undefined {
  if (![support.x, support.y, support.width, source.left, source.top, rect.left, rect.top, rect.width].every(Number.isFinite) || support.width <= 0 || rect.width <= 0) return;
  if (source.width !== undefined && (!Number.isFinite(source.width) || source.width <= 0) || source.height !== undefined && (!Number.isFinite(source.height) || source.height <= 0) || rect.height !== undefined && (!Number.isFinite(rect.height) || rect.height <= 0)) return;
  const dy = rect.top - source.top;
  const scale = source.width && source.width > 0 ? rect.width / source.width : 1;
  const mappedX = rect.left + (support.x - source.left) * scale;
  // Native floor/control positions resize; the snack's44px hit plane does
  // not. Restore its fixed half-width at every safe-fragment edge, including
  // gaps beside internal controls, before clipping to the new native floor.
  const inset = support.kind === "floor" ? 22 : 0;
  const insetDelta = inset * (1 - scale);
  const x = Math.max(rect.left + inset, mappedX + insetDelta), right = Math.min(rect.left + rect.width - inset, mappedX + support.width * scale - insetDelta);
  if (right <= x) return;
  const elementPoint = source.width && source.height && rect.height ? attachCompanionElementPoint(support, { ...source, width: source.width, height: source.height }) : undefined;
  const mapped = elementPoint && rect.height ? followCompanionElementPoint(elementPoint, { ...rect, height: rect.height }) : undefined;
  const result = { ...support, x, y: mapped?.y ?? support.y + dy, width: right - x };
  if (support.dropSurface) {
    const left = Math.max(rect.left, rect.left + (support.dropSurface.x - source.left) * scale), end = Math.min(rect.left + rect.width, rect.left + (support.dropSurface.x + support.dropSurface.width - source.left) * scale);
    result.dropSurface = { x: left, width: end - left };
  }
  return result;
}

/** System emission needs the original body baseline. Food's fixed22px resize
 * clearance cannot certify the larger pet footprint during a shrinking panel.
 * Translate matching frames only; a resize waits for the next full safe scan. */
export function rebaseCompanionFoodBodySupport(support: Platform, source: AnchorRect, rect: AnchorRect & { width: number }): Platform | undefined {
  if (source.width === undefined || source.height === undefined || rect.height === undefined
    || Math.abs(source.width - rect.width) > .001 || Math.abs(source.height - rect.height) > .001) return;
  if (![support.x, support.y, support.width, source.left, source.top, source.width, source.height, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
    || support.width <= 0 || source.width <= 0 || source.height <= 0 || rect.width <= 0 || rect.height <= 0) return;
  return { ...support, x: support.x + rect.left - source.left, y: support.y + rect.top - source.top };
}

/** Validate a real floor recipient and a bounded native grab offset. This is
 * intentionally private: a generic rectangle must not re-enable sofa drops. */
function receivesFoodRect(point: Point, release: Point, rect: HomeFoodRect): boolean {
  if (![point.x, point.y, release.x, release.y, rect.left, rect.top, rect.width, rect.height].every(Number.isFinite) || rect.width <= 0 || rect.height <= 0) return false;
  const right = rect.left + rect.width, bottom = rect.top + rect.height;
  if (release.x < rect.left || release.x > right || release.y < rect.top || release.y > bottom) return false;
  // A stale or unrelated logical position must not bind invisibly across the
  // screen. The native44px snack has at most a44px pointer-to-foot offset.
  return Math.abs(point.x - release.x) <= 44 && Math.abs(point.y - release.y) <= 44;
}

/** The room floor is a different physical receiving surface from its bed.
 * Choose a nearby44px input-safe centre on its real plane, leaving actual
 * controls usable. The sofa is a furnishing above this floor, not a recipient.
 * Direct put-down and retained floor reflow use the same current foot plane;
 * a studio shell's zoom can differ from the compact home's body portal. */
export function receiveCompanionHomeFloorFood(point: Point, release: Point, floor: HomeFoodRect, controls: readonly HomeFoodRect[], reflow = false): Point | undefined {
  if (!receivesFoodRect(point, release, floor) || floor.width < 44 || floor.height <= COMPANION_HOME_FLOOR_INSET) return;
  const y = floor.top + floor.height - COMPANION_HOME_FLOOR_INSET;
  let spans: [number, number][] = [[floor.left + 22, floor.left + floor.width - 22]];
  for (const control of controls) {
    if (![control.left, control.top, control.width, control.height].every(Number.isFinite) || control.width <= 0 || control.height <= 0
      || control.top >= y + 6 || control.top + control.height <= y - 38) continue;
    const left = control.left - 22, right = control.left + control.width + 22;
    spans = spans.flatMap(([a, b]) => right <= a || left >= b ? [[a, b] as [number, number]] : [[a, Math.min(b, left)], [Math.max(a, right), b]].filter(([start, end]) => end >= start) as [number, number][]);
  }
  const candidates = spans.map(([left, right]) => Math.max(left, Math.min(right, point.x))).sort((a, b) => Math.abs(a - point.x) - Math.abs(b - point.x));
  const x = candidates[0];
  if (x === undefined || !reflow && (Math.abs(x - point.x) > 22 || Math.hypot(x - point.x, y - point.y) > 44)) return;
  return { x, y };
}

/** A local attachment contains only coordinates. DOM identity stays with the
 * presentation layer; visibility never chooses a replacement support. */
export function attachCompanionFood(point: Point, scroll: Point, origin?: Point & { width?: number; height?: number }): CompanionFoodAttachment {
  const elementPoint = origin?.width && origin.height ? attachCompanionElementPoint(point, { left: origin.x, top: origin.y, width: origin.width, height: origin.height }) : undefined;
  return { documentX: point.x + scroll.x, documentY: point.y + scroll.y, offsetX: origin ? point.x - origin.x : 0, offsetY: origin ? point.y - origin.y : 0, ...(elementPoint ? { elementPoint } : {}) };
}

export function followCompanionFood(attachment: CompanionFoodAttachment, scroll: Point, rect?: AnchorRect, clampToSource: boolean | "floor" = true): { point: Point; attachment: CompanionFoodAttachment } {
  // Width/height change is an actual reflow: keep the same source and clamp
  // only to its new local bounds. Scrolling alone never changes either offset.
  // A dispenser tray deliberately sits outside the tiny outlet rectangle.
  // Its local home offset survives topology changes without a glyph clamp.
  let localX = attachment.offsetX, localY = attachment.offsetY;
  const projected = attachment.elementPoint && rect?.width && rect.height ? followCompanionElementPoint(attachment.elementPoint, { ...rect, width: rect.width, height: rect.height }) : undefined;
  if (projected && rect) { localX = projected.x - rect.left; localY = projected.y - rect.top; }
  if (clampToSource && rect) {
    if (rect.width !== undefined) localX = Math.min(localX, Math.max(0, rect.width));
    if (rect.height !== undefined) localY = Math.min(localY, clampToSource === "floor" ? rect.height : Math.max(-3, rect.height - 3));
    if (clampToSource === "floor") { localX = Math.max(0, localX); localY = Math.max(0, localY); }
  }
  const point = rect ? { x: rect.left + localX, y: rect.top + localY } : { x: attachment.documentX - scroll.x, y: attachment.documentY - scroll.y };
  return { point, attachment: { ...attachment, documentX: point.x + scroll.x, documentY: point.y + scroll.y } };
}

/** Reflow can move a control across a retained native fraction. Stay on that
 * same measured source/plane and keep the intended fraction for regrowth. */
export function safeCompanionAttachedFood(point: Point, supports: readonly CompanionFoodDropSupport[]): Point | undefined {
  let best: Point | undefined, distance = Infinity;
  for (const support of supports) {
    if (![support.x, support.y, support.width, point.x, point.y].every(Number.isFinite) || support.width <= 0 || Math.abs(support.y - point.y) > 2) continue;
    const x = Math.max(support.x, Math.min(support.x + support.width, point.x)), delta = Math.abs(x - point.x);
    if (delta < distance) { best = { x, y: support.y }; distance = delta; }
  }
  return best;
}

/** Logical support coordinates stay unchanged while the separate presentation
 * approaches the mouth. Mouth coordinates describe its viewport centre; the
 * 44px food button's art centre is 16px above its foot anchor. Eating art
 * scales/rotates around that centre, so the final bite stays at the mouth. */
export function presentCompanionFood(food: { x: number; y: number }, progress: number, mouth?: { x: number; y: number }, facing: -1 | 1 = 1, reduced = false): CompanionFoodPresentation {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (!mouth || ![mouth.x, mouth.y].every(Number.isFinite)) return { x: food.x, y: food.y, scale: reduced ? 1 : Math.max(.25, 1 - p * .72), rotation: 0 };
  const direction = facing === -1 ? -1 : 1;
  const target = { x: mouth.x + direction * 4, y: mouth.y + 16 };
  if (reduced) return { ...target, scale: 1, rotation: 0 };
  const lift = Math.min(1, p / .24), eased = lift * lift * (3 - 2 * lift);
  const chewing = Math.max(0, (p - .24) / .76), nibble = Math.sin(chewing * Math.PI * 14);
  const remaining = 1 - chewing;
  return {
    // Arrive from the facing side, then take the last bite into the actual
    // mouth centre as the remaining fruit disappears.
    x: food.x + (target.x - food.x) * eased - direction * 4 * chewing * eased,
    y: food.y + (target.y - food.y) * eased - Math.sin(lift * Math.PI) * 12 + (chewing > 0 ? nibble * .8 : 0),
    scale: remaining * (1 + (chewing > 0 ? nibble * .018 : 0)),
    rotation: -direction * Math.sin(lift * Math.PI) * 16 + (chewing > 0 ? nibble * 4 * direction : 0),
  };
}

export function companionTrashProgress(elapsedMs: number): number {
  return Number.isFinite(elapsedMs) ? Math.max(0, Math.min(1, elapsedMs / COMPANION_TRASH_DWELL_MS)) : 0;
}

/** A physical card catches the vertical ray even where a nearby control cut
 * its safe centre span. Select the first crossed card, then its nearest safe
 * centre on that same card. This never attracts a ray outside its real bounds
 * to another column, and a completely covered card still has no safe recipient. */
function firstFoodSupportBelow(point: Point, platforms: readonly CompanionFoodDropSupport[]): CompanionFoodDropSupport | undefined {
  let first: CompanionFoodDropSupport | undefined, distance = Infinity;
  for (const support of platforms) {
    const end = support.x + support.width, surface = support.kind === "card" ? support.dropSurface : undefined;
    const bounds = surface && [surface.x, surface.width, surface.x + surface.width].every(Number.isFinite)
      && surface.width > 0 && support.x >= surface.x - .5 && end <= surface.x + surface.width + .5 ? surface : support;
    if (!support.id || ![support.x, support.y, support.width, end, bounds.x, bounds.width, bounds.x + bounds.width].every(Number.isFinite)
      || support.width <= 0 || bounds.width <= 0 || support.y < point.y - .5 || point.x < bounds.x || point.x > bounds.x + bounds.width) continue;
    const delta = Math.max(support.x - point.x, point.x - end, 0);
    if (!first || support.y < first.y || support.y === first.y && (support.kind !== "floor" && first.kind === "floor"
      || (support.kind === "floor") === (first.kind === "floor") && (delta < distance || delta === distance && support.id < first.id))) {
      first = support; distance = delta;
    }
  }
  return first ?? firstCompanionSupportBelow(point, platforms, 22);
}

/** Deliberate placement first falls onto a real lower ledge. Only the optional
 * final screen-floor fallback may attract farther to an already protected
 * floor span. A native grip below that plane recovers onto the same safe
 * floor; it never pulls food upward to a card or invents a control-crossing
 * floor. The presentation owns the finite return from that released point. */
export function placeCompanionFood(food: CompanionFood, point: { x: number; y: number }, platforms: readonly CompanionFoodDropSupport[], fallbackViewport?: Readonly<{ width: number; height: number }>): CompanionFood {
  if (![point.x, point.y].every(Number.isFinite)) return { id: food.id, kind: food.kind, x: food.x, y: food.y };
  const support = firstFoodSupportBelow(point, platforms.filter(platform => !isCompanionFoodBedSupport(platform.id)));
  if (support) return { id: food.id, kind: food.kind, x: Math.max(support.x, Math.min(support.x + support.width, point.x)), y: support.y, platformId: support.id };
  if (fallbackViewport && [fallbackViewport.width, fallbackViewport.height].every(Number.isFinite) && fallbackViewport.width >= 48 && fallbackViewport.height > 0) {
    // The geometry's food32 tier already protects the whole44px native input
    // against visible controls and text. Reuse those exact floor spans rather
    // than manufacturing a full-width ledge across a bottom toolbar. This
    // wider attraction is only a final floor fallback, never a distant card.
    const nativeGrip = point.x >= -44 && point.x <= fallbackViewport.width + 44 && point.y >= -44 && point.y <= fallbackViewport.height + 44;
    let floor: Platform | undefined, floorX = point.x, distance = Infinity;
    for (const candidate of platforms) {
      if (candidate.kind !== "floor" || !isCompanionViewportFloorFoodSupport(candidate.id)
        || ![candidate.x, candidate.y, candidate.width, candidate.x + candidate.width].every(Number.isFinite)
        || candidate.width <= 0 || candidate.x < 0 || candidate.x + candidate.width > fallbackViewport.width
        || candidate.y < 0 || candidate.y > fallbackViewport.height) continue;
      const above = candidate.y < point.y - .5;
      // Shared geometry may raise the floor above a fixed bottom bar only
      // when that bar starts in the bottom35% of this viewport. A stale floor
      // cached before viewport growth cannot pull a snack up to an old edge.
      if (above && (!nativeGrip || candidate.y < fallbackViewport.height * .65 - 8)) continue;
      const x = Math.max(candidate.x, Math.min(candidate.x + candidate.width, point.x)), delta = Math.abs(x - point.x);
      const previousAbove = floor ? floor.y < point.y - .5 : false;
      // Preserve every ordinary downward fallback before considering a return
      // from below the screen's protected input plane.
      if (!floor || !above && previousAbove || above === previousAbove && (delta < distance
        || delta === distance && (candidate.y < floor.y || candidate.y === floor.y && candidate.id < floor.id))) {
        floor = candidate; floorX = x; distance = delta;
      }
    }
    if (floor) return { id: food.id, kind: food.kind, x: floorX, y: floor.y, platformId: floor.id };
    // A missing safe span is not a disposal request. Keep the native item
    // visible and unsupported until the next actual geometry delivery proves
    // a viewport recipient; no imaginary platform or endless fall is added.
    return { id: food.id, kind: food.kind, x: Math.max(24, Math.min(fallbackViewport.width - 24, point.x)), y: Math.max(44, Math.min(fallbackViewport.height - 24, point.y)) };
  }
  return { id: food.id, kind: food.kind, x: point.x, y: point.y };
}

/** A screen floor is fixed viewport geometry, unlike a card or room's DOM
 * attachment. Reuse only its measured safe intervals after scrolling/reflow;
 * retain the intended x separately so a temporary narrow width can regrow. */
export function followCompanionViewportFloorFood(food: CompanionFood, intendedX: number, platforms: readonly CompanionFoodDropSupport[], viewport: Readonly<{ width: number; height: number }>): CompanionFood | undefined {
  if (![intendedX, viewport.width, viewport.height].every(Number.isFinite) || viewport.width < 48 || viewport.height <= 0) return;
  const point = { x: Math.max(24, Math.min(viewport.width - 24, intendedX)), y: viewport.height };
  const current = platforms.filter(platform => isCompanionViewportFloorFoodSupport(platform.id) && platform.kind === "floor"
    && [platform.x, platform.y, platform.width, platform.x + platform.width].every(Number.isFinite) && platform.width > 0
    && platform.x >= 0 && platform.x + platform.width <= viewport.width
    && platform.y >= viewport.height * .65 - 8 && platform.y <= viewport.height - 12);
  const placed = placeCompanionFood(food, point, current, viewport);
  return isCompanionViewportFloorFoodSupport(placed.platformId) ? placed : undefined;
}

/** Cosmetic arc only. It never changes the snack's support, held state or
 * planner coordinates; stronger authored play reuses the same finite effect. */
export function companionFoodJostle(distance: number, radius: number, direction: -1 | 1, strength = 1): { height: number; duration: number; rotation: number } | undefined {
  if (![distance, radius].every(Number.isFinite) || radius <= 0 || distance < 0 || distance > radius) return;
  const force = Number.isFinite(strength) ? Math.max(1, Math.min(3, strength)) : 1;
  return { height: (12 + 12 * (1 - distance / radius)) * force, duration: force > 1 ? 650 : 420, rotation: direction * 6 };
}

export function reconcileCompanionFood(food: CompanionFood, platforms: readonly Platform[]): CompanionFood {
  if (isCompanionFoodBedSupport(food.platformId)) return { ...food, platformId: undefined };
  const support = platforms.find(p => p.id === food.platformId && !isCompanionFoodBedSupport(p.id));
  return support ? { ...food, x: platformLandingX(support, food.x), y: support.y } : { ...food };
}

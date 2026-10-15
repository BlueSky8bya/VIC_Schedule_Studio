import { platformLandingX, type CompanionFood, type Platform } from "./brain";
import { firstCompanionSupportBelow } from "./support-landing";

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
/** The creature keeps its sofa support; every food path excludes that seat,
 * including old food-only snapshots and their anonymous split segments. */
export function isCompanionFoodBedSupport(id?: string): boolean {
  return /^companion-home(?:-(?:food|bed-food))?(?:-\d+)?$/.test(id ?? "");
}
export const COMPANION_TRASH_DWELL_MS = 320;
export const COMPANION_TRASH_DISCARD_MS = 180;
export type CompanionFoodPresentation = { x: number; y: number; scale: number; rotation: number; scaleX?: number; scaleY?: number };
export type CompanionFoodAttachment = { documentX: number; documentY: number; offsetX: number; offsetY: number };
type Point = { x: number; y: number };
type AnchorRect = { left: number; top: number; width?: number; height?: number };
type HomeFoodRect = { left: number; top: number; width: number; height: number };

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
 * This runs only for an explicit drag or keyboard put-down. */
export function receiveCompanionHomeFloorFood(point: Point, release: Point, floor: HomeFoodRect, controls: readonly HomeFoodRect[], reflow = false): Point | undefined {
  if (!receivesFoodRect(point, release, floor) || floor.width < 44 || floor.height <= COMPANION_HOME_FLOOR_INSET) return;
  const y = reflow ? point.y : floor.top + floor.height - COMPANION_HOME_FLOOR_INSET;
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
export function attachCompanionFood(point: Point, scroll: Point, origin?: Point): CompanionFoodAttachment {
  return { documentX: point.x + scroll.x, documentY: point.y + scroll.y, offsetX: origin ? point.x - origin.x : 0, offsetY: origin ? point.y - origin.y : 0 };
}

export function followCompanionFood(attachment: CompanionFoodAttachment, scroll: Point, rect?: AnchorRect, clampToSource: boolean | "floor" = true): { point: Point; attachment: CompanionFoodAttachment } {
  // Width/height change is an actual reflow: keep the same source and clamp
  // only to its new local bounds. Scrolling alone never changes either offset.
  // A dispenser tray deliberately sits outside the tiny outlet rectangle.
  // Its local home offset survives topology changes without a glyph clamp.
  let localX = attachment.offsetX, localY = attachment.offsetY;
  if (clampToSource && rect) {
    if (rect.width !== undefined) localX = Math.min(localX, Math.max(0, rect.width));
    if (rect.height !== undefined) localY = Math.min(localY, clampToSource === "floor" ? rect.height : Math.max(-3, rect.height - 3));
    if (clampToSource === "floor") { localX = Math.max(0, localX); localY = Math.max(0, localY); }
  }
  const point = rect ? { x: rect.left + localX, y: rect.top + localY } : { x: attachment.documentX - scroll.x, y: attachment.documentY - scroll.y };
  return { point, attachment: { ...attachment, documentX: point.x + scroll.x, documentY: point.y + scroll.y } };
}

/** Logical support coordinates stay unchanged while the separate presentation
 * approaches the mouth. Mouth coordinates describe its viewport centre; the
 * 44px food button's art centre is 16px above its foot anchor. */
export function presentCompanionFood(food: { x: number; y: number }, progress: number, mouth?: { x: number; y: number }, facing: -1 | 1 = 1, reduced = false): CompanionFoodPresentation {
  const p = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  if (!mouth || ![mouth.x, mouth.y].every(Number.isFinite)) return { x: food.x, y: food.y, scale: reduced ? 1 : Math.max(.25, 1 - p * .72), rotation: 0 };
  const direction = facing === -1 ? -1 : 1;
  const target = { x: mouth.x + direction * 4, y: mouth.y + 16 };
  if (reduced) return { ...target, scale: 1, rotation: 0 };
  const lift = Math.min(1, p / .24), eased = lift * lift * (3 - 2 * lift);
  const chewing = Math.max(0, (p - .24) / .76), nibble = Math.sin(chewing * Math.PI * 14);
  return {
    x: food.x + (target.x - food.x) * eased,
    y: food.y + (target.y - food.y) * eased - Math.sin(lift * Math.PI) * 12 + (chewing > 0 ? nibble * .8 : 0),
    scale: Math.max(.25, 1 - chewing * .72 + (chewing > 0 ? nibble * .018 : 0)),
    rotation: -direction * Math.sin(lift * Math.PI) * 16 + (chewing > 0 ? nibble * 4 * direction : 0),
  };
}

export function companionTrashProgress(elapsedMs: number): number {
  return Number.isFinite(elapsedMs) ? Math.max(0, Math.min(1, elapsedMs / COMPANION_TRASH_DWELL_MS)) : 0;
}

/** Deliberate placement falls onto a real lower ledge. Prefer the same x;
 * only a nearby edge may attract a fruit. No upper/distant fallback invents
 * a floor or teleports a dropped fruit to a different calendar column. */
export function placeCompanionFood(food: CompanionFood, point: { x: number; y: number }, platforms: readonly Platform[]): CompanionFood {
  if (![point.x, point.y].every(Number.isFinite)) return { id: food.id, kind: food.kind, x: food.x, y: food.y };
  const support = firstCompanionSupportBelow(point, platforms.filter(platform => !isCompanionFoodBedSupport(platform.id)), 22);
  return support ? { id: food.id, kind: food.kind, x: Math.max(support.x, Math.min(support.x + support.width, point.x)), y: support.y, platformId: support.id }
    : { id: food.id, kind: food.kind, x: point.x, y: point.y };
}

export function reconcileCompanionFood(food: CompanionFood, platforms: readonly Platform[]): CompanionFood {
  if (isCompanionFoodBedSupport(food.platformId)) return { ...food, platformId: undefined };
  const support = platforms.find(p => p.id === food.platformId && !isCompanionFoodBedSupport(p.id));
  return support ? { ...food, x: platformLandingX(support, food.x), y: support.y } : { ...food };
}

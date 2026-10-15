import { platformLandingX, type CompanionFood, type Platform } from "./brain";
import { firstCompanionSupportBelow } from "./support-landing";

export const MAX_COMPANION_FOOD = 3;
export const COMPANION_TRASH_DWELL_MS = 320;
export const COMPANION_TRASH_DISCARD_MS = 180;
export type CompanionFoodPresentation = { x: number; y: number; scale: number; rotation: number; scaleX?: number; scaleY?: number };
export type CompanionFoodAttachment = { documentX: number; documentY: number; offsetX: number; offsetY: number };
type Point = { x: number; y: number };
type AnchorRect = { left: number; top: number; width?: number; height?: number };

/** A local attachment contains only coordinates. DOM identity stays with the
 * presentation layer; visibility never chooses a replacement support. */
export function attachCompanionFood(point: Point, scroll: Point, origin?: Point): CompanionFoodAttachment {
  return { documentX: point.x + scroll.x, documentY: point.y + scroll.y, offsetX: origin ? point.x - origin.x : 0, offsetY: origin ? point.y - origin.y : 0 };
}

export function followCompanionFood(attachment: CompanionFoodAttachment, scroll: Point, rect?: AnchorRect, clampToSource = true): { point: Point; attachment: CompanionFoodAttachment } {
  // Width/height change is an actual reflow: keep the same source and clamp
  // only to its new local bounds. Scrolling alone never changes either offset.
  // A dispenser tray deliberately sits outside the tiny outlet rectangle.
  // Its local home offset survives topology changes without a glyph clamp.
  const localX = clampToSource && rect?.width !== undefined ? Math.min(attachment.offsetX, Math.max(0, rect.width)) : attachment.offsetX;
  const localY = clampToSource && rect?.height !== undefined ? Math.min(attachment.offsetY, Math.max(-3, rect.height - 3)) : attachment.offsetY;
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
  const support = firstCompanionSupportBelow(point, platforms, 22);
  return support ? { id: food.id, kind: food.kind, x: Math.max(support.x, Math.min(support.x + support.width, point.x)), y: support.y, platformId: support.id }
    : { id: food.id, kind: food.kind, x: point.x, y: point.y };
}

export function reconcileCompanionFood(food: CompanionFood, platforms: readonly Platform[]): CompanionFood {
  const support = platforms.find(p => p.id === food.platformId);
  return support ? { ...food, x: platformLandingX(support, food.x), y: support.y } : { ...food };
}

import { nearestPlatform, platformLandingX, type CompanionFood, type Platform } from "./brain";

export const MAX_COMPANION_FOOD = 3;
export const COMPANION_TRASH_DWELL_MS = 320;
export const COMPANION_TRASH_DISCARD_MS = 180;
export type CompanionFoodPresentation = { x: number; y: number; scale: number; rotation: number };

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

/** Fruit rests on a visible ledge, never over schedule text. A removed ledge
 * drops it onto the next visible support/floor; it does not become a floating
 * unreachable target after scrolling or changing calendar layout. */
export function placeCompanionFood(food: CompanionFood, point: { x: number; y: number }, platforms: readonly Platform[]): CompanionFood {
  const below = platforms.filter(p => p.y >= point.y - 12 && point.x >= p.x - 12 && point.x <= p.x + p.width + 12);
  const support = nearestPlatform(point, below) ?? platforms.find(p => p.kind === "floor") ?? nearestPlatform(point, platforms);
  return support ? { id: food.id, kind: food.kind, x: platformLandingX(support, point.x), y: support.y, platformId: support.id }
    : { id: food.id, kind: food.kind, x: point.x, y: point.y };
}

export function reconcileCompanionFood(food: CompanionFood, platforms: readonly Platform[]): CompanionFood {
  const support = platforms.find(p => p.id === food.platformId);
  return support ? { ...food, x: platformLandingX(support, food.x), y: support.y } : placeCompanionFood(food, food, platforms);
}

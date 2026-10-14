import { nearestPlatform, platformLandingX, type CompanionFood, type Platform } from "./brain";

export const MAX_COMPANION_FOOD = 3;

/** Fruit rests on a visible ledge, never over schedule text. A removed ledge
 * drops it onto the next visible support/floor; it does not become a floating
 * unreachable target after scrolling or changing calendar layout. */
export function placeCompanionFood(food: CompanionFood, point: { x: number; y: number }, platforms: readonly Platform[]): CompanionFood {
  const below = platforms.filter(p => p.y >= point.y - 12 && point.x >= p.x - 12 && point.x <= p.x + p.width + 12);
  const support = nearestPlatform(point, below) ?? platforms.find(p => p.kind === "floor");
  return support ? { id: food.id, kind: food.kind, x: platformLandingX(support, point.x), y: support.y, platformId: support.id }
    : { id: food.id, kind: food.kind, x: point.x, y: point.y };
}

export function reconcileCompanionFood(food: CompanionFood, platforms: readonly Platform[]): CompanionFood {
  const support = platforms.find(p => p.id === food.platformId);
  return support ? { ...food, x: platformLandingX(support, food.x), y: support.y } : placeCompanionFood(food, food, platforms);
}

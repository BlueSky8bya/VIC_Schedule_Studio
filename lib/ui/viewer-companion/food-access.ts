import type { CompanionFood, Platform } from "./brain";
import { COMPANION_HOME_FLOOR_FOOD, isCompanionFoodBedSupport } from "./food";
import { MAX_COMPANION_FOOD } from "./food-capacity";

/** The snack's own32px collision can fit where a92px creature cannot. Preserve
 * that visible placement and expose it to the brain only when a separately
 * measured pet support covers the same x/top. No nearest-column fallback. */
export function accessibleCompanionFoods(foods: readonly CompanionFood[], petSupports: readonly Platform[]): CompanionFood[] {
  const supports = petSupports.slice(0, 400).filter(p => p.id && [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0);
  return foods.slice(0, MAX_COMPANION_FOOD).flatMap(food => {
    if (!food.platformId || isCompanionFoodBedSupport(food.platformId) || ![food.x, food.y].every(Number.isFinite)) return [];
    const card = /^(card-\d+)-food-top(?:-\d+)?$/.exec(food.platformId);
    const houseFloor = food.platformId === COMPANION_HOME_FLOOR_FOOD;
    const floor = /^viewport-floor-food(?:-\d+)?$/.test(food.platformId);
    const matches = (p: Platform) => houseFloor ? p.kind === "floor" && p.manualOnly === true && /^companion-home-floor(?:-\d+)?$/.test(p.id)
      : card ? p.kind === "card" && (p.id === `${card[1]}-top` || p.id.startsWith(`${card[1]}-top-`) && /^\d+$/.test(p.id.slice(`${card[1]}-top-`.length)))
      : floor ? p.kind === "floor" && /^viewport-floor(?:-\d+)?$/.test(p.id)
      : p.id === food.platformId;
    const support = supports.find(p => matches(p) && food.x >= p.x && food.x <= p.x + p.width && Math.abs(food.y - p.y) <= .5);
    return support ? [{ ...food, platformId: support.id }] : [];
  });
}

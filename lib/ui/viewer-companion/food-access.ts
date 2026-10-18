import { platformLandingX, type CompanionFood, type Platform } from "./brain";
import { COMPANION_HOME_FLOOR_FOOD, isCompanionFoodBedSupport, isCompanionViewportFloorFoodSupport } from "./food";
import { MAX_COMPANION_FOOD } from "./food-capacity";

/** The snack's own32px collision can fit where a92px creature cannot. Preserve
 * that visible placement. The pet can eat from a separately measured safe
 * stance within its36px mouth range on that exact source/plane; it need not
 * stand on top of the smaller snack. Never substitute another card/column. */
export function accessibleCompanionFoods(foods: readonly CompanionFood[], petSupports: readonly Platform[]): CompanionFood[] {
  const supports = petSupports.slice(0, 400).filter(p => p.id && [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0);
  return foods.slice(0, MAX_COMPANION_FOOD).flatMap(food => {
    if (!food.platformId || isCompanionFoodBedSupport(food.platformId) || ![food.x, food.y].every(Number.isFinite)) return [];
    const card = /^(card-\d+(?:-band)?)-food-top(?:-\d+)?$/.exec(food.platformId);
    const prefix = card ? card[1].endsWith("-band") ? card[1] : `${card[1]}-top` : undefined;
    const houseFloor = food.platformId === COMPANION_HOME_FLOOR_FOOD;
    const floor = isCompanionViewportFloorFoodSupport(food.platformId);
    const matches = (p: Platform) => houseFloor ? p.kind === "floor" && p.manualOnly === true && /^companion-home-floor(?:-\d+)?$/.test(p.id)
      : prefix ? p.kind === "card" && (p.id === prefix || p.id.startsWith(`${prefix}-`) && /^\d+$/.test(p.id.slice(`${prefix}-`.length)))
      : floor ? p.kind === "floor" && /^viewport-floor(?:-\d+)?$/.test(p.id)
      : p.id === food.platformId;
    const distance = (p: Platform) => Math.abs(platformLandingX(p, food.x) - food.x);
    const support = supports.filter(p => matches(p) && Math.abs(food.y - p.y) <= .5 && distance(p) <= 36)
      .sort((a, b) => distance(a) - distance(b) || a.id.localeCompare(b.id))[0];
    return support ? [{ ...food, platformId: support.id }] : [];
  });
}

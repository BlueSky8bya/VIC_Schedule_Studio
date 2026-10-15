import { platformLandingX, type CompanionFood, type Platform } from "./brain";
import { COMPANION_HOME_BED_FOOD } from "./food";

/** The snack's own32px collision can fit where a92px creature cannot. Preserve
 * that visible placement and expose it to the brain only when a separately
 * measured pet support covers the same x/top. No nearest-column fallback. */
export function accessibleCompanionFoods(foods: readonly CompanionFood[], petSupports: readonly Platform[]): CompanionFood[] {
  const supports = petSupports.slice(0, 400).filter(p => p.id && [p.x, p.y, p.width].every(Number.isFinite) && p.width > 0);
  return foods.slice(0, 3).flatMap(food => {
    if (!food.platformId || ![food.x, food.y].every(Number.isFinite)) return [];
    if (food.platformId === COMPANION_HOME_BED_FOOD) {
      // A manually offered snack keeps its exact bed position. The planner
      // receives a separate safe standing point only within the existing
      //36x18 mouth reach; the rendered fruit is neither lifted nor relocated.
      const home = supports.find(p => p.id === "companion-home");
      if (!home) return [];
      const x = platformLandingX(home, food.x);
      return Math.abs(food.x - x) <= 36 && Math.abs(food.y - home.y) <= 18 ? [{ ...food, x, y: home.y, platformId: home.id }] : [];
    }
    const card = /^(card-\d+)-food-top(?:-\d+)?$/.exec(food.platformId);
    const home = /^companion-home-food(?:-\d+)?$/.test(food.platformId);
    const floor = /^viewport-floor-food(?:-\d+)?$/.test(food.platformId);
    const matches = (p: Platform) => card ? p.kind === "card" && (p.id === `${card[1]}-top` || p.id.startsWith(`${card[1]}-top-`) && /^\d+$/.test(p.id.slice(`${card[1]}-top-`.length)))
      : home ? p.id === "companion-home"
      : floor ? p.kind === "floor" && /^viewport-floor(?:-\d+)?$/.test(p.id)
      : p.id === food.platformId;
    const support = supports.find(p => matches(p) && food.x >= p.x && food.x <= p.x + p.width && Math.abs(food.y - p.y) <= .5);
    return support ? [{ ...food, platformId: support.id }] : [];
  });
}

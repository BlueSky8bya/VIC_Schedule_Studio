/** Physical mouth/carry reach stays36px. Painted food positions use three
 * decimal places while measured supports retain fractional CSS pixels. This
 * allowance covers that display precision only; it is not a wider hit area. */
export const COMPANION_FOOD_REACH_PX = 36;
const FOOD_PAINT_PRECISION_PX = .001;

export function withinCompanionFoodReach(distance: number): boolean {
  return Number.isFinite(distance) && distance >= 0 && distance <= COMPANION_FOOD_REACH_PX + FOOD_PAINT_PRECISION_PX;
}

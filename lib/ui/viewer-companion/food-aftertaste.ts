import { isCompanionFoodKind, type CompanionFoodKind } from "./snacks";

/** Deliberate owner-provided unusual recipes. A homemade soup, ordinary
 * Pepero or a frozen leftover does not acquire an invented vomiting reaction. */
export const COMPANION_FOOD_AFTERTASTES = Object.freeze({
  "cricket-pepero": "retch", "blue-marshmallow-tteokguk": "retch", "herb-avocado-milk": "retch", "mint-choco-brisket-stew": "retch", durian: "cough",
} satisfies Partial<Record<CompanionFoodKind, "cough" | "retch">>);
export type CompanionFoodAftertasteKind = typeof COMPANION_FOOD_AFTERTASTES[keyof typeof COMPANION_FOOD_AFTERTASTES];
export const companionFoodAftertasteDuration = (kind: CompanionFoodAftertasteKind) => kind === "retch" ? 2250 : 1750;
export type CompanionFoodAftertaste = { foodId: string; food: CompanionFoodKind; kind: CompanionFoodAftertasteKind; duration: number };

/** Call only beside the real consume ACK. An uneaten sighting, sniff,
 * declined meal, failed consume or old collection entry cannot admit it.
 * Quiet-time meals are consumed once and never replayed when motion resumes. */
export function createCompanionFoodAftertaste() {
  const consumed = new Set<string>();
  return {
    consume(receipt: { foodId: string; food: unknown; consumed: boolean }, animate: boolean): CompanionFoodAftertaste | undefined {
      if (!receipt.consumed || !receipt.foodId.trim() || !isCompanionFoodKind(receipt.food) || consumed.has(receipt.foodId)) return;
      consumed.add(receipt.foodId); if (consumed.size > 32) consumed.delete(consumed.values().next().value!);
      const kind = (COMPANION_FOOD_AFTERTASTES as Partial<Record<CompanionFoodKind, CompanionFoodAftertasteKind>>)[receipt.food];
      return animate && kind ? { foodId: receipt.foodId, food: receipt.food, kind, duration: companionFoodAftertasteDuration(kind) } : undefined;
    },
    clear() { consumed.clear(); },
  };
}
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** Non-graphic pretend retching: the existing strained/recover packet owns
 * the face. Two/three short body contractions then calm down on this support.
 * No bodily-fluid sprite, body-part addition, food spawn or collection write. */
export function sampleCompanionFoodAftertaste(kind: CompanionFoodAftertasteKind, progress: number, reduced = false) {
  const p = clamp(progress), neutral = { row: 0, phase: 0, lift: 0, lean: 0, shift: 0, compression: 0, puff: 0, beat: "recover" as "cough" | "retch" | "recover" };
  if (reduced || p <= 0 || p >= 1) return neutral;
  if (p >= .76) return { ...neutral, row: 23, phase: .76 + (p - .76), beat: "recover" as const };
  const local = clamp((p - .08) / .68), envelope = Math.sin(local * Math.PI) ** 2;
  const contractions = Math.sin(local * Math.PI * (kind === "retch" ? 6 : 4)), pulse = Math.max(0, contractions) * envelope;
  return { row: 23, phase: contractions < -.15 ? .35 : contractions > .15 ? .65 : .5, lift: -pulse * (kind === "retch" ? 1.8 : 1), lean: envelope * (kind === "retch" ? 9 : 4) + contractions * envelope * 3,
    shift: pulse * (kind === "retch" ? 2.5 : 1), compression: pulse * (kind === "retch" ? .055 : .025), puff: pulse, beat: kind };
}

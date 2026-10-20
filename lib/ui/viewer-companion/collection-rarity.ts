export type CompanionCollectionRarity = "common" | "uncommon" | "rare" | "ultra-rare" | "mythic";
export const COMPANION_COLLECTION_RARITY_NAMES: Readonly<Record<CompanionCollectionRarity, string>> = Object.freeze({
  common: "흔한", uncommon: "가끔", rare: "귀한", "ultra-rare": "아주 귀한", mythic: "전설",
});
/** Base probability, never rounded down to a misleading0.0% for rare items. */
export function formatCompanionCollectionChance(chance: number): string {
  if (!Number.isFinite(chance) || chance <= 0) return "0%";
  const percent = Math.min(1, chance) * 100;
  return `${Number(percent.toPrecision(3))}%`;
}

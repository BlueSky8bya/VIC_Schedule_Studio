/** A mounting family owns the pose anchor and shared gesture. Items supply
 * only their small ornament, fit and drop weight; never another body atlas. */
export const COMPANION_ACCESSORY_IDS = Object.freeze(["sunglasses", "beret", "bow", "star-pin", "flower-crown", "satchel", "pixel-sunglasses", "baseball-cap", "party-hat", "scarf", "bell-pendant", "leaf-umbrella", "bell-badge", "heart-badge", "lemon-badge", "eyepatch", "propeller-hat", "magic-pocket", "bandage", "tiny-crown", "mushroom-hat", "star-patch"] as const);
export type CompanionAccessoryId = typeof COMPANION_ACCESSORY_IDS[number];
export type CompanionAccessoryFamily = "head" | "eyes" | "chest-badge" | "front-bow" | "front-pocket" | "side-prop";
type Item = Readonly<{ name: string; family: CompanionAccessoryFamily; scale: number; weight: number; retired?: true }>;
export const COMPANION_ACCESSORIES: Readonly<Record<CompanionAccessoryId, Item>> = Object.freeze({
  sunglasses: { name: "선글라스", family: "eyes", scale: 1.32, weight: 10 },
  beret: { name: "베레모", family: "head", scale: 1.2, weight: 10 },
  bow: { name: "나비 리본", family: "front-bow", scale: .28, weight: 10 },
  "star-pin": { name: "별 핀", family: "chest-badge", scale: .22, weight: 10 },
  "flower-crown": { name: "꽃 화관", family: "head", scale: 1.3, weight: 8 },
  satchel: { name: "작은 가방", family: "side-prop", scale: .4, weight: 8 },
  "pixel-sunglasses": { name: "픽셀 선글라스", family: "eyes", scale: 1.3, weight: 6 },
  "baseball-cap": { name: "야구 모자", family: "head", scale: 1.2, weight: 10 },
  "party-hat": { name: "고깔 모자", family: "head", scale: .95, weight: 8 },
  scarf: { name: "목도리", family: "front-bow", scale: .28, weight: 0, retired: true },
  "bell-pendant": { name: "방울 목걸이", family: "chest-badge", scale: .24, weight: 0, retired: true },
  "leaf-umbrella": { name: "잎사귀 우산", family: "side-prop", scale: .7, weight: 6 },
  "bell-badge": { name: "딸랑 방울", family: "chest-badge", scale: .25, weight: 10 },
  "heart-badge": { name: "하트 배지", family: "chest-badge", scale: .25, weight: 10 },
  "lemon-badge": { name: "레몬 배지", family: "chest-badge", scale: .26, weight: 10 },
  eyepatch: { name: "애꾸 안대", family: "eyes", scale: 1.14, weight: 5 },
  "propeller-hat": { name: "빙글 프로펠러", family: "head", scale: 1.28, weight: .08 },
  "magic-pocket": { name: "요술 주머니", family: "front-pocket", scale: .44, weight: .08 },
  bandage: { name: "별 반창고", family: "chest-badge", scale: .32, weight: 10 },
  "tiny-crown": { name: "꼬마 왕관", family: "head", scale: .9, weight: 5 },
  "mushroom-hat": { name: "버섯 모자", family: "head", scale: 1.25, weight: 6 },
  "star-patch": { name: "별 안대", family: "eyes", scale: 1.12, weight: 6 },
});
/** Retired IDs remain valid saved-history keys, never fresh rewards/UI slots. */
export const COMPANION_WEARABLE_IDS: readonly CompanionAccessoryId[] = Object.freeze(COMPANION_ACCESSORY_IDS.filter(id => !COMPANION_ACCESSORIES[id].retired));
export const COMPANION_ACCESSORY_NAMES: Readonly<Record<CompanionAccessoryId, string>> = Object.freeze(Object.fromEntries(COMPANION_ACCESSORY_IDS.map(id => [id, COMPANION_ACCESSORIES[id].name])) as Record<CompanionAccessoryId, string>);
export function currentCompanionAccessory(id: CompanionAccessoryId): CompanionAccessoryId { return id === "scarf" ? "bow" : id === "bell-pendant" ? "bell-badge" : id; }

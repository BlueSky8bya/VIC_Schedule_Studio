/** A mounting family owns the pose anchor and shared gesture. Items supply
 * only their small ornament, fit and drop weight; never another body atlas. */
export const COMPANION_ACCESSORY_IDS = Object.freeze(["sunglasses", "beret", "bow", "star-pin", "flower-crown", "satchel", "pixel-sunglasses", "baseball-cap", "party-hat", "scarf", "bell-pendant", "leaf-umbrella", "bell-badge", "heart-badge", "lemon-badge", "eyepatch", "propeller-hat", "magic-pocket", "bandage", "tiny-crown", "mushroom-hat", "star-patch", "round-glasses", "wire-glasses", "browline-glasses", "heart-glasses", "cat-eye-glasses", "monocle", "top-hat", "magician-hat", "retro-cap", "detective-hat", "wizard-hat", "bucket-hat", "square-glasses", "sleep-mask-smile", "sleep-mask-drowsy", "sleep-mask-wide", "sleep-mask-tori"] as const);
export type CompanionAccessoryId = typeof COMPANION_ACCESSORY_IDS[number];
export type CompanionAccessoryFamily = "head" | "eyes" | "eye-cover" | "eye-mask" | "chest-badge" | "front-bow" | "front-pocket" | "side-prop";
type Item = Readonly<{ name: string; family: CompanionAccessoryFamily; scale: number; weight: number; retired?: true }>;
export const COMPANION_ACCESSORIES: Readonly<Record<CompanionAccessoryId, Item>> = Object.freeze({
  sunglasses: { name: "선글라스", family: "eyes", scale: 1.32, weight: 10 },
  beret: { name: "베레모", family: "head", scale: 1.2, weight: 10 },
  bow: { name: "나비 리본", family: "front-bow", scale: .28, weight: 10 },
  "star-pin": { name: "별 핀", family: "chest-badge", scale: .22, weight: 0, retired: true },
  "flower-crown": { name: "꽃 화관", family: "head", scale: 1.3, weight: 8 },
  satchel: { name: "작은 가방", family: "side-prop", scale: .4, weight: 0, retired: true },
  "pixel-sunglasses": { name: "픽셀 선글라스", family: "eyes", scale: 1.3, weight: 6 },
  "baseball-cap": { name: "야구 모자", family: "head", scale: 1.2, weight: 10 },
  "party-hat": { name: "고깔 모자", family: "head", scale: .95, weight: 8 },
  scarf: { name: "목도리", family: "front-bow", scale: .28, weight: 0, retired: true },
  "bell-pendant": { name: "방울 목걸이", family: "chest-badge", scale: .24, weight: 0, retired: true },
  "leaf-umbrella": { name: "잎사귀 우산", family: "side-prop", scale: .7, weight: 0, retired: true },
  "bell-badge": { name: "딸랑 방울", family: "front-bow", scale: .28, weight: 10 },
  "heart-badge": { name: "하트 배지", family: "chest-badge", scale: .25, weight: 0, retired: true },
  "lemon-badge": { name: "레몬 배지", family: "chest-badge", scale: .26, weight: 0, retired: true },
  eyepatch: { name: "한쪽 안대", family: "eye-cover", scale: 1, weight: 0, retired: true },
  "propeller-hat": { name: "빙글 프로펠러", family: "head", scale: 1.28, weight: .08 },
  "magic-pocket": { name: "요술 주머니", family: "front-pocket", scale: .44, weight: .08 },
  bandage: { name: "별 반창고", family: "chest-badge", scale: .32, weight: 0, retired: true },
  "tiny-crown": { name: "꼬마 왕관", family: "head", scale: .9, weight: 5 },
  "mushroom-hat": { name: "버섯 모자", family: "head", scale: 1.25, weight: 0, retired: true },
  "star-patch": { name: "별 안대", family: "eye-cover", scale: 1, weight: 0, retired: true },
  "round-glasses": { name: "동글 안경", family: "eyes", scale: 1, weight: 10 },
  "wire-glasses": { name: "금테 안경", family: "eyes", scale: 1, weight: 8 },
  "browline-glasses": { name: "뿔테 안경", family: "eyes", scale: 1, weight: 8 },
  "heart-glasses": { name: "하트 안경", family: "eyes", scale: 1, weight: 7 },
  "cat-eye-glasses": { name: "캣아이 안경", family: "eyes", scale: 1, weight: 0, retired: true },
  monocle: { name: "단안경", family: "eye-cover", scale: 1, weight: 4 },
  "top-hat": { name: "신사 모자", family: "head", scale: 1.15, weight: 6 },
  "magician-hat": { name: "마술사 모자", family: "head", scale: 1.2, weight: 3 },
  "retro-cap": { name: "빵 모자", family: "head", scale: 1.25, weight: 8 },
  "detective-hat": { name: "탐정 모자", family: "head", scale: 1.25, weight: 5 },
  "wizard-hat": { name: "마법사 모자", family: "head", scale: 1.25, weight: 4 },
  "bucket-hat": { name: "벙거지 모자", family: "head", scale: 1.2, weight: 8 },
  "square-glasses": { name: "사각 안경", family: "eyes", scale: 1, weight: 8 },
  "sleep-mask-smile": { name: "방긋 수면 안대", family: "eye-mask", scale: 1, weight: 8 },
  "sleep-mask-drowsy": { name: "졸린눈 수면 안대", family: "eye-mask", scale: 1, weight: 8 },
  "sleep-mask-wide": { name: "동그란눈 수면 안대", family: "eye-mask", scale: 1, weight: 6 },
  "sleep-mask-tori": { name: "토리님 수면 안대", family: "eye-mask", scale: 1, weight: .01 },
});
/** Retired IDs remain valid saved-history keys, never fresh rewards/UI slots. */
export const COMPANION_WEARABLE_IDS: readonly CompanionAccessoryId[] = Object.freeze(COMPANION_ACCESSORY_IDS.filter(id => !COMPANION_ACCESSORIES[id].retired));
export const COMPANION_ACCESSORY_NAMES: Readonly<Record<CompanionAccessoryId, string>> = Object.freeze(Object.fromEntries(COMPANION_ACCESSORY_IDS.map(id => [id, COMPANION_ACCESSORIES[id].name])) as Record<CompanionAccessoryId, string>);
/** One ordinary counterpart per retired keepsake; the original ID remains in
 * the local ledger. No lottery or rare-prop upgrade runs during migration. */
export const COMPANION_ACCESSORY_REPLACEMENTS: Readonly<Partial<Record<CompanionAccessoryId, CompanionAccessoryId>>> = Object.freeze({ scarf: "bow", "bell-pendant": "bell-badge", "star-pin": "monocle", satchel: "retro-cap", "leaf-umbrella": "bucket-hat", "heart-badge": "heart-glasses", "lemon-badge": "round-glasses", bandage: "browline-glasses", "mushroom-hat": "detective-hat", eyepatch: "sleep-mask-smile", "star-patch": "sleep-mask-drowsy", "cat-eye-glasses": "square-glasses" });
export function currentCompanionAccessory(id: CompanionAccessoryId): CompanionAccessoryId { return COMPANION_ACCESSORY_REPLACEMENTS[id] ?? id; }

/** Local keepsakes only. No currency, account, purchase or absence clock. */
export const COMPANION_ACCESSORY_IDS = Object.freeze(["sunglasses", "beret", "bow", "star-pin", "flower-crown", "satchel"] as const);
export type CompanionAccessoryId = typeof COMPANION_ACCESSORY_IDS[number];
export const COMPANION_ACCESSORY_NAMES: Readonly<Record<CompanionAccessoryId, string>> = Object.freeze({ sunglasses: "선글라스", beret: "베레모", bow: "리본", "star-pin": "별 핀", "flower-crown": "꽃 화관", satchel: "작은 가방" });
export const COMPANION_ACCESSORY_HINTS = Object.freeze(Object.fromEntries(COMPANION_ACCESSORY_IDS.map(id => [id, "다정하게 함께 지내면 빅타민이 선물로 가져와요."])) as Record<CompanionAccessoryId, string>);
export const COMPANION_GIFT_ACTIVE_MS = 5 * 60 * 1000;
export type CompanionGiftState = { pending: CompanionAccessoryId | null; unlocked: CompanionAccessoryId[]; equipped: CompanionAccessoryId | null; activeMs: number; interactionCredit: number };
export const isCompanionAccessoryId = (value: unknown): value is CompanionAccessoryId => typeof value === "string" && COMPANION_ACCESSORY_IDS.some(id => id === value);
export function normalizeCompanionGifts(value: unknown): CompanionGiftState {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const unlocked = COMPANION_ACCESSORY_IDS.filter(id => Array.isArray(source.unlocked) && source.unlocked.includes(id));
  const pending = isCompanionAccessoryId(source.pending) && !unlocked.includes(source.pending) ? source.pending : null;
  const equipped = isCompanionAccessoryId(source.equipped) && unlocked.includes(source.equipped) ? source.equipped : null;
  const activeMs = typeof source.activeMs === "number" && Number.isFinite(source.activeMs) ? Math.max(0, Math.min(COMPANION_GIFT_ACTIVE_MS, source.activeMs)) : 0;
  return { pending, unlocked, equipped, activeMs, interactionCredit: source.interactionCredit === 1 ? 1 : 0 };
}
/** Existing visible needs ticks advance this one bounded scalar. Delivery is
 * offered only at a safe ordinary decision; opening never auto-equips it. */
export function advanceCompanionGifts(value: CompanionGiftState, elapsedMs: number, affection: number, safe: boolean): CompanionGiftState {
  if (value.pending || value.unlocked.length >= COMPANION_ACCESSORY_IDS.length || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return value;
  const activeMs = Math.min(COMPANION_GIFT_ACTIVE_MS, value.activeMs + Math.min(30000, elapsedMs));
  const pending = safe && Number.isFinite(affection) && affection >= .65 && value.interactionCredit === 1 && activeMs >= COMPANION_GIFT_ACTIVE_MS ? COMPANION_ACCESSORY_IDS.find(id => !value.unlocked.includes(id)) ?? null : null;
  return activeMs === value.activeMs && pending === value.pending ? value : { ...value, activeMs, pending };
}

/** Local keepsakes only. No currency, account, purchase or absence clock. */
import { COMPANION_ACCESSORIES, COMPANION_ACCESSORY_IDS, COMPANION_WEARABLE_IDS, currentCompanionAccessory, type CompanionAccessoryId } from "./accessory-catalog";
export { COMPANION_ACCESSORY_IDS, COMPANION_ACCESSORY_NAMES, COMPANION_WEARABLE_IDS } from "./accessory-catalog";
export type { CompanionAccessoryId } from "./accessory-catalog";
export const COMPANION_ACCESSORY_HINTS = Object.freeze(Object.fromEntries(COMPANION_ACCESSORY_IDS.map(id => [id, "다정하게 함께 지내면 빅타민이 선물로 가져와요."])) as Record<CompanionAccessoryId, string>);
export const COMPANION_GIFT_ACTIVE_MS = 5 * 60 * 1000;
/** One chance per five active minutes AND a new real care interaction, never
 * per frame/decision. No pity counter, absence catch-up or guaranteed drop. */
export function companionGiftChance(affection: number): number {
  return Number.isFinite(affection) ? .0005 + .0065 * Math.max(0, Math.min(1, affection)) : 0;
}
export type CompanionGiftState = { pending: CompanionAccessoryId | null; unlocked: CompanionAccessoryId[]; equipped: CompanionAccessoryId | null; activeMs: number; interactionCredit: number };
export const isCompanionAccessoryId = (value: unknown): value is CompanionAccessoryId => typeof value === "string" && COMPANION_ACCESSORY_IDS.some(id => id === value);
export function normalizeCompanionGifts(value: unknown): CompanionGiftState {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const saved = COMPANION_ACCESSORY_IDS.filter(id => Array.isArray(source.unlocked) && source.unlocked.includes(id));
  // Preserve earned legacy ledger entries, while making their body-appropriate
  // replacement usable immediately. Reloading this migration is idempotent.
  const replacements = saved.map(currentCompanionAccessory);
  const unlocked = COMPANION_ACCESSORY_IDS.filter(id => saved.includes(id) || replacements.includes(id));
  const wasPending = isCompanionAccessoryId(source.pending) && !saved.includes(source.pending) ? source.pending : null;
  const mappedPending = wasPending && currentCompanionAccessory(wasPending);
  const pending = mappedPending ? !unlocked.includes(mappedPending) ? mappedPending : wasPending !== mappedPending ? COMPANION_WEARABLE_IDS.find(id => !unlocked.includes(id)) ?? null : null : null;
  const equipped = isCompanionAccessoryId(source.equipped) && saved.includes(source.equipped) ? currentCompanionAccessory(source.equipped) : null;
  const activeMs = typeof source.activeMs === "number" && Number.isFinite(source.activeMs) ? Math.max(0, Math.min(COMPANION_GIFT_ACTIVE_MS, source.activeMs)) : 0;
  return { pending, unlocked, equipped, activeMs, interactionCredit: source.interactionCredit === 1 ? 1 : 0 };
}
/** Existing visible needs ticks advance this one bounded scalar. Delivery is
 * offered only at a safe ordinary decision; opening never auto-equips it. */
export function advanceCompanionGifts(value: CompanionGiftState, elapsedMs: number, affection: number, safe: boolean, random: () => number = Math.random): CompanionGiftState {
  if (value.pending || COMPANION_WEARABLE_IDS.every(id => value.unlocked.includes(id)) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return value;
  const activeMs = Math.min(COMPANION_GIFT_ACTIVE_MS, value.activeMs + Math.min(30000, elapsedMs));
  if (!safe || !Number.isFinite(affection) || value.interactionCredit !== 1 || activeMs < COMPANION_GIFT_ACTIVE_MS) return activeMs === value.activeMs ? value : { ...value, activeMs };
  const sample = random(), won = Number.isFinite(sample) && sample >= 0 && sample < companionGiftChance(affection);
  const pool = COMPANION_WEARABLE_IDS.filter(id => !value.unlocked.includes(id));
  let pending: CompanionAccessoryId | null = null;
  if (won && pool.length) {
    const draw = random(), total = pool.reduce((sum, id) => sum + COMPANION_ACCESSORIES[id].weight, 0);
    // A separate bounded draw selects among unowned items. Very rare props
    // keep their low relative weight instead of a guaranteed catalogue order.
    if (Number.isFinite(draw) && draw >= 0 && draw < 1) {
      let remaining = draw * total;
      pending = pool.find(id => (remaining -= COMPANION_ACCESSORIES[id].weight) < 0) ?? pool[pool.length - 1];
    }
  }
  // Even a miss spends the opportunity. Staying at a safe perch or reloading
  // cannot turn the next needs tick into another lottery.
  return { ...value, activeMs: 0, interactionCredit: 0, pending };
}

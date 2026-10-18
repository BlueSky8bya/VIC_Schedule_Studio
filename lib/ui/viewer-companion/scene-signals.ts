import { COMPANION_BEHAVIOR_IDS, type CompanionBehaviorId } from "./collection";
import { COMPANION_SITUATION_IDS, type CompanionSituationId } from "./moments";
import { COMPANION_WEARABLE_IDS, type CompanionAccessoryId } from "./accessory-catalog";

export const COMPANION_SCENE_SIGNAL = "vic:companion-scene-signal";
export const COMPANION_WARDROBE_PREFERENCE = "vic:companion-wardrobe-preference";
export type CompanionSceneSignal = { kind: "memory-inspected"; behavior?: CompanionBehaviorId; situation?: CompanionSituationId } | { kind: "wardrobe-opened" };
/** Internal local presentation signal. It is intentionally not an activity event. */
export function emitCompanionSceneSignal(signal: CompanionSceneSignal) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMPANION_SCENE_SIGNAL, { detail: signal }));
}
export function validCompanionSceneSignal(value: unknown): value is CompanionSceneSignal {
  if (!value || typeof value !== "object") return false;
  const signal = value as CompanionSceneSignal;
  return signal.kind === "wardrobe-opened" || signal.kind === "memory-inspected" && (Boolean(signal.behavior && COMPANION_BEHAVIOR_IDS.includes(signal.behavior)) || Boolean(signal.situation && COMPANION_SITUATION_IDS.includes(signal.situation)));
}

/** Runtime reply proposes a portrait selection only. The wardrobe validates
 * ownership again and never invokes equip or discovery from this signal. */
export function emitCompanionWardrobePreference(accessory: CompanionAccessoryId | null) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COMPANION_WARDROBE_PREFERENCE, { detail: accessory }));
}
export function validCompanionWardrobePreference(value: unknown): value is CompanionAccessoryId {
  return typeof value === "string" && (COMPANION_WEARABLE_IDS as readonly string[]).includes(value);
}

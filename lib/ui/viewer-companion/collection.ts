import { COMPANION_MEMORY_ENCOUNTER_HINTS as hints } from "./memory-encounter-hints";
import { COMPANION_FOOD_KINDS, isCompanionFoodKind, type CompanionFoodKind } from "./snacks";
import { advanceCompanionGifts, COMPANION_WEARABLE_IDS, isCompanionAccessoryId, normalizeCompanionGifts, type CompanionAccessoryId, type CompanionGiftState } from "./gifts";
import { currentCompanionAccessory, COMPANION_ACCESSORY_IDS } from "./accessory-catalog";
import { COMPANION_NEW_MEMORIES, COMPANION_NEW_MEMORY_NAMES, COMPANION_NEW_MEMORY_HINTS, companionActivityMemory, companionNewMemory, type CompanionNewMemoryId } from "./memory-catalog";
import { companionMemoryPainted } from "./memory-witness";
import type { CompanionExpressionId } from "./expressions";
import { COMPANION_SITUATION_IDS, observedCompanionSituation, type CompanionSituationId, type CompanionSituationObservation } from "./moments";
export { COMPANION_SITUATION_IDS, COMPANION_SITUATION_NAMES, COMPANION_SITUATION_HINTS, type CompanionSituationId } from "./moments";

export const COMPANION_COLLECTION_KEY = "vic.viewerCompanionCollection";
export const COMPANION_COLLECTION_EVENT = "vic:companion-collection";
export const COMPANION_CONSUMED_FOOD_EVENT = "vic:companion-consumed-food";
export type CompanionConsumedFood = Readonly<{ kind: CompanionFoodKind; serial: number; newDiscovery: boolean }>;
export const COMPANION_LEGACY_BEHAVIOR_IDS = Object.freeze(["ask-petting", "lean-nuzzle", "paper-knead", "paper-nest", "cheer-rehearsal", "doze-curl", "groom", "bow", "pounce", "tumble", "dizzy", "stretch", "odd-food-reaction"] as const);
export const COMPANION_BEHAVIOR_IDS = Object.freeze([...COMPANION_LEGACY_BEHAVIOR_IDS, ...COMPANION_NEW_MEMORIES.map(memory => memory.id)]);
export type CompanionBehaviorId = typeof COMPANION_BEHAVIOR_IDS[number];
export const COMPANION_BEHAVIOR_NAMES: Readonly<Record<CompanionBehaviorId, string>> = Object.freeze({ ...COMPANION_NEW_MEMORY_NAMES, "ask-petting": "쓰담해 줘", "lean-nuzzle": "부비부비", "paper-knead": "꾹꾹이", "paper-nest": "자리 만들기", "cheer-rehearsal": "으쌰으쌰", "doze-curl": "꾸벅꾸벅", groom: "몸단장", bow: "꾸벅 인사", pounce: "폴짝!", tumble: "데굴데굴", dizzy: "빙글빙글", stretch: "쭉쭉", "odd-food-reaction": "이 맛은…!" });
export const COMPANION_BEHAVIOR_HINTS: Readonly<Record<CompanionBehaviorId, string>> = Object.freeze({ ...COMPANION_NEW_MEMORY_HINTS, "ask-petting": hints["ask-petting"], "lean-nuzzle": hints["lean-nuzzle"], "paper-knead": hints["paper-knead"], "paper-nest": hints["paper-nest"], "cheer-rehearsal": hints["cheer-rehearsal"], "doze-curl": hints["doze-curl"], "groom": hints["groom"], "bow": hints["bow"], "pounce": hints["pounce"], "tumble": hints["tumble"], "dizzy": hints["dizzy"], "stretch": hints["stretch"], "odd-food-reaction": hints["odd-food-reaction"] });
export type CompanionCollectionSeen = { foods: CompanionFoodKind[]; behaviors: CompanionBehaviorId[]; situations: CompanionSituationId[]; accessories: CompanionAccessoryId[] };
export type CompanionCollectionKind = "food" | "behavior" | "moment" | "accessory";
export type CompanionCollection = { version: 1; foods: CompanionFoodKind[]; behaviors: CompanionBehaviorId[]; situations: CompanionSituationId[]; gifts: CompanionGiftState; seen?: CompanionCollectionSeen };
/** Missing seen state acknowledges history without a migration write. The
 * first new discovery freezes that baseline before adding the new item. */
const collectionSeen = (value: CompanionCollection): CompanionCollectionSeen => value.seen ?? { foods: value.foods, behaviors: value.behaviors, situations: value.situations, accessories: value.gifts.unlocked };
const seenKey = { food: "foods", behavior: "behaviors", moment: "situations", accessory: "accessories" } as const;
const collectedIds = (value: CompanionCollection, kind: CompanionCollectionKind): readonly string[] => kind === "accessory" ? COMPANION_WEARABLE_IDS.filter(id => value.gifts.unlocked.includes(id)) : value[seenKey[kind]];
export function isCompanionCollectionUnread(value: CompanionCollection | null | undefined, kind: CompanionCollectionKind, id: string): boolean {
  return Boolean(value && Object.hasOwn(seenKey, kind) && collectedIds(value, kind).includes(id) && !(collectionSeen(value)[seenKey[kind]] as readonly string[]).includes(id));
}
export function getCompanionUnreadCounts(value: CompanionCollection | null | undefined) {
  if (!value) return { foods: 0, memories: 0, accessories: 0, total: 0 };
  const seen = collectionSeen(value);
  const count = (owned: readonly string[], acknowledged: readonly string[]) => { const read = new Set(acknowledged); return owned.filter(id => !read.has(id)).length; };
  const foods = count(value.foods, seen.foods);
  const memories = count(value.behaviors, seen.behaviors) + count(value.situations, seen.situations);
  const accessories = count(COMPANION_WEARABLE_IDS.filter(id => value.gifts.unlocked.includes(id)), seen.accessories);
  return { foods, memories, accessories, total: foods + memories + accessories };
}
const behaviorRows: Readonly<Record<number, CompanionBehaviorId>> = Object.freeze({ 33: "ask-petting", 34: "lean-nuzzle", 35: "paper-knead", 36: "paper-nest", 39: "cheer-rehearsal", 40: "doze-curl", 30: "groom", 29: "bow", 31: "pounce", 21: "tumble", 22: "dizzy", 16: "stretch" });
export type CompanionBehaviorObservation = { requestedRow: number; requestedIndex: number; adoptedIndex?: number; requestedSrc: string; adoptedSrc?: string; decoded: boolean; visible: boolean; /** Only a witnessed sequence of airborne body cheers on the calibrated happy drawing. */ cheerBounce?: boolean; /** Actual consumed-food receipt and a legible finite reaction, never ordinary recovery. */ foodAftertaste?: boolean };
/** A requested semantic row cannot stamp an old retained fallback image. */
export function observedCompanionBehavior(observation: CompanionBehaviorObservation): CompanionBehaviorId | undefined {
  if (!observation.visible || !observation.decoded || !Number.isInteger(observation.requestedIndex) || observation.requestedIndex < 0 || observation.adoptedIndex !== observation.requestedIndex || !observation.requestedSrc || observation.adoptedSrc !== observation.requestedSrc) return;
  if (observation.requestedRow === 9 && observation.cheerBounce === true) return "cheer-rehearsal";
  if (observation.requestedRow === 23 && observation.foodAftertaste === true) return "odd-food-reaction";
  return behaviorRows[observation.requestedRow];
}
export function normalizeCompanionCollection(value: unknown): CompanionCollection {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  // First installation and old care versions do not invent past discoveries.
  if (source.version !== 1) return { version: 1, foods: [], behaviors: [], situations: [], gifts: normalizeCompanionGifts(undefined) };
  const collection: CompanionCollection = { version: 1, foods: COMPANION_FOOD_KINDS.filter(id => Array.isArray(source.foods) && source.foods.includes(id)), behaviors: COMPANION_BEHAVIOR_IDS.filter(id => Array.isArray(source.behaviors) && source.behaviors.includes(id)), situations: COMPANION_SITUATION_IDS.filter(id => Array.isArray(source.situations) && source.situations.includes(id)), gifts: normalizeCompanionGifts(source.gifts) };
  if (source.seen && typeof source.seen === "object" && !Array.isArray(source.seen)) {
    const seen = source.seen as Record<string, unknown>;
    collection.seen = {
      foods: collection.foods.filter(id => !Array.isArray(seen.foods) || seen.foods.includes(id)),
      behaviors: collection.behaviors.filter(id => !Array.isArray(seen.behaviors) || seen.behaviors.includes(id)),
      situations: collection.situations.filter(id => !Array.isArray(seen.situations) || seen.situations.includes(id)),
      // An ordinary replacement inherits its predecessor's acknowledgment.
      // Preserve legacy seen keys too, so this translation is idempotent and
      // never turns retired, already-inspected history into a new discovery.
      accessories: COMPANION_ACCESSORY_IDS.filter(id => collection.gifts.unlocked.includes(id) && (!Array.isArray(seen.accessories) || seen.accessories.includes(id) || seen.accessories.some(old => isCompanionAccessoryId(old) && currentCompanionAccessory(old) === id))),
    };
  }
  return collection;
}
type CollectionStorage = Pick<Storage, "getItem" | "setItem">;
const semanticSignature = (value: CompanionCollection) => JSON.stringify([value.foods, value.behaviors, value.situations, value.gifts.pending, value.gifts.unlocked, value.gifts.equipped, collectionSeen(value)]);
const copy = (value: CompanionCollection): CompanionCollection => ({ version: 1, foods: [...value.foods], behaviors: [...value.behaviors], situations: [...value.situations], gifts: { ...value.gifts, unlocked: [...value.gifts.unlocked] }, ...(value.seen ? { seen: { foods: [...value.seen.foods], behaviors: [...value.seen.behaviors], situations: [...value.seen.situations], accessories: [...value.seen.accessories] } } : {}) });

/** One cached local store. Active ticks never read storage or notify React;
 * only first discoveries, gift arrival/opening and explicit equipment do. */
export function createCompanionCollectionStore(storage?: CollectionStorage, clock: () => number = () => performance.now(), onChange?: (value: CompanionCollection) => void, onConsumed?: (value: CompanionConsumedFood) => void) {
  let memory = normalizeCompanionCollection(undefined), initialized = false, rawSeen: string | null | undefined, dirty = false, lastWrite = -Infinity;
  let recentFood: CompanionConsumedFood | null = null, consumptionSerial = 0;
  const synchronize = (raw: string | null, notify = true) => {
    const previous = semanticSignature(memory);
    let parsed: unknown;
    try { parsed = raw ? JSON.parse(raw) : undefined; } catch { parsed = undefined; }
    memory = normalizeCompanionCollection(parsed); initialized = true; rawSeen = raw; dirty = false;
    if (recentFood && !memory.foods.includes(recentFood.kind)) recentFood = null;
    if (notify && semanticSignature(memory) !== previous) onChange?.(copy(memory));
    return copy(memory);
  };
  const refresh = (notify = true) => {
    try { const raw = storage?.getItem(COMPANION_COLLECTION_KEY) ?? null; if (!initialized || raw !== rawSeen) synchronize(raw, notify); }
    catch { if (!initialized) { initialized = true; rawSeen = null; } }
  };
  const ensure = () => { if (!initialized) refresh(); };
  const flush = (force = false, notify = true) => {
    ensure();
    if (!dirty || !force && clock() - lastWrite < 5000) return;
    // Actual storage boundaries observe another tab's newer selection/clear.
    refresh(notify); if (!dirty) return;
    lastWrite = clock();
    try { const raw = JSON.stringify(memory); storage?.setItem(COMPANION_COLLECTION_KEY, raw); rawSeen = storage ? raw : rawSeen; dirty = Boolean(!storage); }
    catch { /* Keep volatile progress/discoveries and the existing5s budget. */ }
  };
  const commit = (next: CompanionCollection, force: boolean) => {
    if (next === memory) return false;
    const previous = semanticSignature(memory);
    memory = next; dirty = true; if (force) flush(true, false);
    const changed = semanticSignature(memory) !== previous;
    if (changed) onChange?.(copy(memory));
    return changed;
  };
  const recordMemory = (id: CompanionBehaviorId | undefined) => {
    ensure(); if (!id || memory.behaviors.includes(id)) return false;
    refresh(); if (memory.behaviors.includes(id)) return false;
    return commit({ ...memory, seen: collectionSeen(memory), behaviors: COMPANION_BEHAVIOR_IDS.filter(item => item === id || memory.behaviors.includes(item)) }, true);
  };
  return {
    load() { refresh(); return copy(memory); },
    recentFood() { ensure(); return recentFood ? { ...recentFood } : null; },
    synchronize: (raw: string | null) => synchronize(raw),
    flush: (force = false) => flush(force),
    /** Called only after the real food entity was successfully consumed. */
    recordFood(kind: CompanionFoodKind, consumed: boolean) {
      ensure(); if (!consumed || !isCompanionFoodKind(kind)) return false;
      refresh();
      const discovered = !memory.foods.includes(kind) && commit({ ...memory, seen: collectionSeen(memory), foods: COMPANION_FOOD_KINDS.filter(id => id === kind || memory.foods.includes(id)) }, true);
      // This local transient witness follows a completed meal, including a
      // familiar taste. It is not inferred from a spawn, save or remote tab.
      if (memory.foods.includes(kind)) {
        recentFood = { kind, serial: ++consumptionSerial, newDiscovery: discovered };
        onConsumed?.({ ...recentFood });
      }
      return discovered;
    },
    recordBehavior(observation: CompanionBehaviorObservation) {
      return recordMemory(observedCompanionBehavior(observation));
    },
    recordExpression(observation: CompanionBehaviorObservation, face: { id: CompanionExpressionId; progress: number; painted: boolean }) {
      return recordMemory(face.painted && Number.isFinite(face.progress) && face.progress >= .25 && face.progress <= .85 && companionMemoryPainted(observation)
        ? companionNewMemory(`expression:${face.id}`)?.id : undefined);
    },
    recordPose(id: CompanionNewMemoryId | undefined) {
      // Only the renderer's finite visible-pose witness supplies this ID.
      return recordMemory(id && companionNewMemory(id)?.family === "pose" ? id : undefined);
    },
    recordActivity(receipt: { id: string; success: boolean; abbreviated: boolean }) {
      return recordMemory(receipt.success && !receipt.abbreviated ? companionActivityMemory(receipt.id) : undefined);
    },
    recordSituation(observation: CompanionSituationObservation) {
      ensure(); const id = observedCompanionSituation(observation); if (!id || memory.situations.includes(id)) return false;
      refresh(); if (memory.situations.includes(id)) return false;
      return commit({ ...memory, seen: collectionSeen(memory), situations: COMPANION_SITUATION_IDS.filter(item => item === id || memory.situations.includes(item)) }, true);
    },
    acknowledge(kind: CompanionCollectionKind, id: string) {
      refresh();
      if (!Object.hasOwn(seenKey, kind) || !isCompanionCollectionUnread(memory, kind, id)) return false;
      const key = seenKey[kind], seen = collectionSeen(memory);
      // Refresh before this synchronous read/write so a stale settings tab
      // cannot replace another tab's discoveries, equipment or acknowledgments.
      const owned = kind === "accessory" ? memory.gifts.unlocked : collectedIds(memory, kind);
      return commit({ ...memory, seen: { ...seen, [key]: owned.filter(item => item === id || (seen[key] as readonly string[]).includes(item)) } as CompanionCollectionSeen }, true);
    },
    interaction() {
      refresh(); if (memory.gifts.interactionCredit === 1) return;
      commit({ ...memory, gifts: { ...memory.gifts, interactionCredit: 1 } }, true);
    },
    advance(elapsedMs: number, affection: number, safe: boolean) {
      ensure(); const gifts = advanceCompanionGifts(memory.gifts, elapsedMs, affection, safe);
      const arrived = Boolean(gifts.pending && gifts.pending !== memory.gifts.pending);
      const opportunityConsumed = gifts.interactionCredit === 0 && memory.gifts.interactionCredit === 1;
      if (gifts !== memory.gifts) commit({ ...memory, gifts }, arrived || opportunityConsumed);
      return arrived && memory.gifts.pending === gifts.pending;
    },
    openGift(): CompanionAccessoryId | null {
      refresh(); const parcel = memory.gifts.pending; if (!parcel) return null;
      const id = currentCompanionAccessory(parcel);
      // Opening is itself the explicit witnessed outcome, including inside
      // settings while the world is paused. Saved ownership never infers it.
      commit({ ...memory, seen: collectionSeen(memory), situations: COMPANION_SITUATION_IDS.filter(item => item === "gift-opened" || memory.situations.includes(item)), gifts: { ...memory.gifts, pending: null, unlocked: COMPANION_ACCESSORY_IDS.filter(item => item === parcel || item === id || memory.gifts.unlocked.includes(item)), activeMs: 0, interactionCredit: 0 } }, true);
      return id;
    },
    equip(id: CompanionAccessoryId | null) {
      refresh(); if (id !== null && (!isCompanionAccessoryId(id) || !COMPANION_WEARABLE_IDS.includes(id) || !memory.gifts.unlocked.includes(id)) || memory.gifts.equipped === id) return false;
      return commit({ ...memory, gifts: { ...memory.gifts, equipped: id } }, true);
    },
  };
}
let owner: Window | undefined, deviceStore: ReturnType<typeof createCompanionCollectionStore> | undefined;
const synchronizedEvents = new WeakSet<Event>();
function store() {
  if (typeof window === "undefined") return undefined;
  if (owner !== window || !deviceStore) {
    owner = window; let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Volatile local collection. */ }
    deviceStore = createCompanionCollectionStore(storage, undefined, value => window.dispatchEvent(new CustomEvent<CompanionCollection>(COMPANION_COLLECTION_EVENT, { detail: value })), value => window.dispatchEvent(new CustomEvent<CompanionConsumedFood>(COMPANION_CONSUMED_FOOD_EVENT, { detail: value })));
  }
  return deviceStore;
}
export const loadCompanionCollection = (): CompanionCollection => store()?.load() ?? normalizeCompanionCollection(undefined);
export const openCompanionGift = (): CompanionAccessoryId | null => store()?.openGift() ?? null;
export const equipCompanionAccessory = (id: CompanionAccessoryId | null): boolean => store()?.equip(id) ?? false;
export const acknowledgeCompanionCollection = (kind: CompanionCollectionKind, id: string): boolean => store()?.acknowledge(kind, id) ?? false;
export const recordCompanionConsumedFood = (kind: CompanionFoodKind, consumed: boolean) => store()?.recordFood(kind, consumed) ?? false;
export const getCompanionRecentFood = (): CompanionConsumedFood | null => store()?.recentFood() ?? null;
export function subscribeCompanionConsumedFood(listener: (value: CompanionConsumedFood) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const consumed = (event: Event) => {
    const value = (event as CustomEvent<CompanionConsumedFood>).detail;
    const actual = getCompanionRecentFood();
    if (actual && value?.serial === actual.serial && value.kind === actual.kind) listener(actual);
  };
  window.addEventListener(COMPANION_CONSUMED_FOOD_EVENT, consumed);
  return () => window.removeEventListener(COMPANION_CONSUMED_FOOD_EVENT, consumed);
}
export const recordCompanionObservedBehavior = (observation: CompanionBehaviorObservation) => store()?.recordBehavior(observation) ?? false;
export const recordCompanionObservedExpression = (observation: CompanionBehaviorObservation, face: { id: CompanionExpressionId; progress: number; painted: boolean }) => store()?.recordExpression(observation, face) ?? false;
export const recordCompanionObservedPose = (id: CompanionNewMemoryId | undefined) => id ? store()?.recordPose(id) ?? false : false;
export const recordCompanionCompletedActivity = (receipt: { id: string; success: boolean; abbreviated: boolean }) => store()?.recordActivity(receipt) ?? false;
export const recordCompanionObservedSituation = (observation: CompanionSituationObservation) => store()?.recordSituation(observation) ?? false;
export const recordCompanionGiftInteraction = () => store()?.interaction();
export const advanceCompanionCollection = (elapsedMs: number, affection: number, safe: boolean) => store()?.advance(elapsedMs, affection, safe);
export const flushCompanionCollection = (force = false) => store()?.flush(force);
export function subscribeCompanionCollection(listener: (value: CompanionCollection) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const changed = (event: Event) => listener(normalizeCompanionCollection((event as CustomEvent<unknown>).detail));
  // synchronize publishes the one semantic event for every subscriber. Calling
  // listener again here would notify twice for the same cross-tab change.
  const stored = (event: StorageEvent) => {
    if ((event.key === COMPANION_COLLECTION_KEY || event.key === null) && !synchronizedEvents.has(event)) {
      synchronizedEvents.add(event); store()?.synchronize(event.key === null ? null : event.newValue);
    }
  };
  window.addEventListener(COMPANION_COLLECTION_EVENT, changed); window.addEventListener("storage", stored);
  return () => { window.removeEventListener(COMPANION_COLLECTION_EVENT, changed); window.removeEventListener("storage", stored); };
}

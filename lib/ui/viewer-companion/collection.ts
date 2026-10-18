import { COMPANION_FOOD_KINDS, isCompanionFoodKind, type CompanionFoodKind } from "./snacks";
import { advanceCompanionGifts, isCompanionAccessoryId, normalizeCompanionGifts, type CompanionAccessoryId, type CompanionGiftState } from "./gifts";

export const COMPANION_COLLECTION_KEY = "vic.viewerCompanionCollection";
export const COMPANION_COLLECTION_EVENT = "vic:companion-collection";
export const COMPANION_BEHAVIOR_IDS = Object.freeze(["ask-petting", "lean-nuzzle", "paper-knead", "paper-nest", "cheer-rehearsal", "doze-curl", "groom", "bow", "pounce", "tumble", "dizzy", "stretch"] as const);
export type CompanionBehaviorId = typeof COMPANION_BEHAVIOR_IDS[number];
export const COMPANION_BEHAVIOR_NAMES: Readonly<Record<CompanionBehaviorId, string>> = Object.freeze({ "ask-petting": "쓰다듬어 주세요", "lean-nuzzle": "다정하게 기대기", "paper-knead": "종이 몸 꾹꾹이", "paper-nest": "포근한 자리 만들기", "cheer-rehearsal": "응원 연습", "doze-curl": "웅크려 졸기", groom: "몸단장", bow: "꾸벅 인사", pounce: "폴짝 놀이", tumble: "데굴데굴", dizzy: "빙글빙글", stretch: "쭉 기지개" });
export const COMPANION_BEHAVIOR_HINTS: Readonly<Record<CompanionBehaviorId, string>> = Object.freeze({ "ask-petting": "안전한 곳에서 가까이 머물러 보세요.", "lean-nuzzle": "쓰다듬으며 다정해진 빅타민 곁에 머물러 보세요.", "paper-knead": "쿠션으로 돌아가 편히 쉬게 해 주세요.", "paper-nest": "쿠션에서 자리를 고르는 모습을 지켜보세요.", "cheer-rehearsal": "활기찬 빅타민과 오래 함께 지내 보세요.", "doze-curl": "피곤한 빅타민이 집에서 쉬는 모습을 지켜보세요.", groom: "고양이 모드의 편안한 모습을 지켜보세요.", bow: "강아지 모드로 함께 지내 보세요.", pounce: "고양이 모드에서 다가와 놀 때를 기다려 보세요.", tumble: "활기차게 이동하는 모습을 지켜보세요.", dizzy: "장난을 마치고 어지럼을 가라앉히는 모습을 지켜보세요.", stretch: "쉬고 일어난 빅타민을 지켜보세요." });
export type CompanionCollection = { version: 1; foods: CompanionFoodKind[]; behaviors: CompanionBehaviorId[]; gifts: CompanionGiftState };
const behaviorRows: Readonly<Record<number, CompanionBehaviorId>> = Object.freeze({ 33: "ask-petting", 34: "lean-nuzzle", 35: "paper-knead", 36: "paper-nest", 39: "cheer-rehearsal", 40: "doze-curl", 30: "groom", 29: "bow", 31: "pounce", 21: "tumble", 22: "dizzy", 16: "stretch" });
export type CompanionBehaviorObservation = { requestedRow: number; requestedIndex: number; adoptedIndex?: number; requestedSrc: string; adoptedSrc?: string; decoded: boolean; visible: boolean };
/** A requested semantic row cannot stamp an old retained fallback image. */
export function observedCompanionBehavior(observation: CompanionBehaviorObservation): CompanionBehaviorId | undefined {
  if (!observation.visible || !observation.decoded || !Number.isInteger(observation.requestedIndex) || observation.requestedIndex < 0 || observation.adoptedIndex !== observation.requestedIndex || !observation.requestedSrc || observation.adoptedSrc !== observation.requestedSrc) return;
  return behaviorRows[observation.requestedRow];
}
export function normalizeCompanionCollection(value: unknown): CompanionCollection {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  // First installation and old care versions do not invent past discoveries.
  if (source.version !== 1) return { version: 1, foods: [], behaviors: [], gifts: normalizeCompanionGifts(undefined) };
  return { version: 1, foods: COMPANION_FOOD_KINDS.filter(id => Array.isArray(source.foods) && source.foods.includes(id)), behaviors: COMPANION_BEHAVIOR_IDS.filter(id => Array.isArray(source.behaviors) && source.behaviors.includes(id)), gifts: normalizeCompanionGifts(source.gifts) };
}
type CollectionStorage = Pick<Storage, "getItem" | "setItem">;
const semanticSignature = (value: CompanionCollection) => JSON.stringify([value.foods, value.behaviors, value.gifts.pending, value.gifts.unlocked, value.gifts.equipped]);
const copy = (value: CompanionCollection): CompanionCollection => ({ version: 1, foods: [...value.foods], behaviors: [...value.behaviors], gifts: { ...value.gifts, unlocked: [...value.gifts.unlocked] } });

/** One cached local store. Active ticks never read storage or notify React;
 * only first discoveries, gift arrival/opening and explicit equipment do. */
export function createCompanionCollectionStore(storage?: CollectionStorage, clock: () => number = () => performance.now(), onChange?: (value: CompanionCollection) => void) {
  let memory = normalizeCompanionCollection(undefined), initialized = false, rawSeen: string | null | undefined, dirty = false, lastWrite = -Infinity;
  const synchronize = (raw: string | null, notify = true) => {
    const previous = semanticSignature(memory);
    let parsed: unknown;
    try { parsed = raw ? JSON.parse(raw) : undefined; } catch { parsed = undefined; }
    memory = normalizeCompanionCollection(parsed); initialized = true; rawSeen = raw; dirty = false;
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
  return {
    load() { refresh(); return copy(memory); },
    synchronize: (raw: string | null) => synchronize(raw),
    flush: (force = false) => flush(force),
    /** Called only after the real food entity was successfully consumed. */
    recordFood(kind: CompanionFoodKind, consumed: boolean) {
      ensure(); if (!consumed || !isCompanionFoodKind(kind)) return false;
      refresh(); if (memory.foods.includes(kind)) return false;
      return commit({ ...memory, foods: COMPANION_FOOD_KINDS.filter(id => id === kind || memory.foods.includes(id)) }, true);
    },
    recordBehavior(observation: CompanionBehaviorObservation) {
      ensure(); const id = observedCompanionBehavior(observation); if (!id || memory.behaviors.includes(id)) return false;
      refresh(); if (memory.behaviors.includes(id)) return false;
      return commit({ ...memory, behaviors: COMPANION_BEHAVIOR_IDS.filter(item => item === id || memory.behaviors.includes(item)) }, true);
    },
    interaction() {
      refresh(); if (memory.gifts.interactionCredit === 1) return;
      commit({ ...memory, gifts: { ...memory.gifts, interactionCredit: 1 } }, true);
    },
    advance(elapsedMs: number, affection: number, safe: boolean) {
      ensure(); const gifts = advanceCompanionGifts(memory.gifts, elapsedMs, affection, safe);
      const arrived = Boolean(gifts.pending && gifts.pending !== memory.gifts.pending);
      if (gifts !== memory.gifts) commit({ ...memory, gifts }, arrived);
      return arrived && memory.gifts.pending === gifts.pending;
    },
    openGift(): CompanionAccessoryId | null {
      refresh(); const id = memory.gifts.pending; if (!id) return null;
      commit({ ...memory, gifts: { ...memory.gifts, pending: null, unlocked: [...memory.gifts.unlocked, id], activeMs: 0, interactionCredit: 0 } }, true);
      return id;
    },
    equip(id: CompanionAccessoryId | null) {
      refresh(); if (id !== null && (!isCompanionAccessoryId(id) || !memory.gifts.unlocked.includes(id)) || memory.gifts.equipped === id) return false;
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
    deviceStore = createCompanionCollectionStore(storage, undefined, value => window.dispatchEvent(new CustomEvent<CompanionCollection>(COMPANION_COLLECTION_EVENT, { detail: value })));
  }
  return deviceStore;
}
export const loadCompanionCollection = (): CompanionCollection => store()?.load() ?? normalizeCompanionCollection(undefined);
export const openCompanionGift = (): CompanionAccessoryId | null => store()?.openGift() ?? null;
export const equipCompanionAccessory = (id: CompanionAccessoryId | null): boolean => store()?.equip(id) ?? false;
export const recordCompanionConsumedFood = (kind: CompanionFoodKind, consumed: boolean) => store()?.recordFood(kind, consumed) ?? false;
export const recordCompanionObservedBehavior = (observation: CompanionBehaviorObservation) => store()?.recordBehavior(observation) ?? false;
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

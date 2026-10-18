import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPANION_BEHAVIOR_IDS, COMPANION_COLLECTION_KEY, createCompanionCollectionStore, equipCompanionAccessory, loadCompanionCollection, normalizeCompanionCollection, observedCompanionBehavior, openCompanionGift, recordCompanionConsumedFood, subscribeCompanionCollection, type CompanionBehaviorObservation } from "@/lib/ui/viewer-companion/collection";
import { advanceCompanionGifts, COMPANION_ACCESSORY_IDS, COMPANION_GIFT_ACTIVE_MS, normalizeCompanionGifts } from "@/lib/ui/viewer-companion/gifts";
import { resetCompanionHabits } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";

afterEach(() => vi.unstubAllGlobals());
const observation = (patch: Partial<CompanionBehaviorObservation> = {}): CompanionBehaviorObservation => ({ requestedRow: 34, requestedIndex: 513, adoptedIndex: 513, requestedSrc: "/companion/hd/victamin-episodes-104-v1.webp", adoptedSrc: "/companion/hd/victamin-episodes-104-v1.webp", decoded: true, visible: true, ...patch });
function storageFixture(initial: unknown = null) {
  let raw: string | null = initial === null ? null : JSON.stringify(initial);
  return { getItem: vi.fn(() => raw), setItem: vi.fn((_key: string, value: string) => { raw = value; }), read: () => raw, replace: (value: unknown) => { raw = value === null ? null : JSON.stringify(value); } };
}

describe("bounded local discoveries", () => {
  it("does not infer discoveries from legacy care and retains only explicit allowlisted fields", () => {
    expect(normalizeCompanionCollection({ version: 3, life: { favoriteFood: "apple" }, foods: ["apple"] }).foods).toEqual([]);
    const source = { version: 1, foods: [...COMPANION_FOOD_KINDS, ...COMPANION_FOOD_KINDS, "identity-canary"], behaviors: [...COMPANION_BEHAVIOR_IDS, "schedule-canary"], gifts: { pending: "identity-canary", unlocked: [...COMPANION_ACCESSORY_IDS, "unknown"], equipped: "satchel", activeMs: Infinity, interactionCredit: 8, account: "identity-canary" }, email: "identity-canary" };
    const normalized = normalizeCompanionCollection(source);
    expect(normalized.foods).toEqual(COMPANION_FOOD_KINDS); expect(normalized.behaviors).toEqual(COMPANION_BEHAVIOR_IDS);
    expect(normalized.gifts.unlocked).toEqual(COMPANION_ACCESSORY_IDS); expect(normalized.gifts.equipped).toBe("satchel"); expect(normalized.gifts.pending).toBeNull();
    expect(normalized.gifts.activeMs).toBe(0); expect(normalized.gifts.interactionCredit).toBe(0);
    expect(JSON.stringify(normalized)).not.toContain("canary"); expect(source.foods).toHaveLength(73);
  });

  it("records food only after actual consumption, once per known food", () => {
    const storage = storageFixture(), listener = vi.fn(), store = createCompanionCollectionStore(storage, () => 0, listener);
    expect(store.recordFood("carrot", false)).toBe(false); expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.recordFood("carrot", true)).toBe(true); expect(store.recordFood("carrot", true)).toBe(false);
    expect(store.recordFood("identity-canary" as "apple", true)).toBe(false);
    expect(store.load().foods).toEqual(["carrot"]); expect(storage.setItem).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenCalledTimes(1);
    const reopened = createCompanionCollectionStore(storage).load(); expect(reopened.foods).toEqual(["carrot"]);
    const copy = store.load(); copy.foods.push("apple"); copy.gifts.unlocked.push("beret"); expect(store.load()).toEqual(reopened);
  });

  it("requires a visible decoded adoption of the requested frame and exact packet", () => {
    expect(observedCompanionBehavior(observation())).toBe("lean-nuzzle");
    for (const patch of [{ visible: false }, { decoded: false }, { adoptedIndex: 1 }, { adoptedSrc: "/companion/hd/idle.webp" }, { requestedSrc: "", adoptedSrc: "" }, { requestedIndex: -1, adoptedIndex: -1 }, { requestedIndex: .5, adoptedIndex: .5 }, { requestedRow: 0 }]) expect(observedCompanionBehavior(observation(patch))).toBeUndefined();
    const storage = storageFixture(), listener = vi.fn(), store = createCompanionCollectionStore(storage, () => 0, listener);
    expect(store.recordBehavior(observation({ adoptedIndex: 1 }))).toBe(false); expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.recordBehavior(observation())).toBe(true); storage.getItem.mockClear();
    for (let frame = 0; frame < 200; frame++) expect(store.recordBehavior(observation())).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenCalledTimes(1);
    expect(store.load().behaviors).toEqual(["lean-nuzzle"]);
  });

  it("stamps all twelve allowed actions and waits for the visible cheer finish", () => {
    const store = createCompanionCollectionStore();
    for (const requestedRow of [33, 34, 35, 36, 40, 30, 29, 31, 21, 22, 16]) expect(store.recordBehavior(observation({ requestedRow }))).toBe(true);
    expect(store.recordBehavior(observation({ requestedRow: 37 }))).toBe(false); expect(store.recordBehavior(observation({ requestedRow: 38 }))).toBe(false);
    expect(store.load().behaviors).not.toContain("cheer-rehearsal");
    expect(store.recordBehavior(observation({ requestedRow: 39 }))).toBe(true); expect(store.load().behaviors).toEqual(COMPANION_BEHAVIOR_IDS);
  });
});

describe("earned gifts and explicit equipment", () => {
  it("needs five active minutes, actual interaction, affection and a safe delivery beat", () => {
    const initial = normalizeCompanionGifts(undefined);
    let state = initial;
    for (let step = 0; step < 10; step++) state = advanceCompanionGifts(state, 30000, .9, true);
    expect(state.activeMs).toBe(COMPANION_GIFT_ACTIVE_MS); expect(state.pending).toBeNull();
    state = { ...state, interactionCredit: 1 };
    expect(advanceCompanionGifts(state, 250, .64, true)).toBe(state);
    expect(advanceCompanionGifts(state, 250, .9, false)).toBe(state);
    expect(advanceCompanionGifts(state, 250, NaN, true)).toBe(state);
    const arrived = advanceCompanionGifts(state, 250, .65, true);
    expect(arrived.pending).toBe("sunglasses"); expect(arrived.unlocked).toEqual([]); expect(arrived.equipped).toBeNull();
    expect(advanceCompanionGifts(arrived, 30000, .9, true)).toBe(arrived);
    expect(advanceCompanionGifts(initial, 99 * 86400000, .9, true).activeMs).toBe(30000);
    for (const invalid of [0, -1, NaN, Infinity]) expect(advanceCompanionGifts(initial, invalid, .9, true)).toBe(initial);
    expect(normalizeCompanionGifts({ activeMs: -4, equipped: "beret", pending: "sunglasses", unlocked: ["sunglasses"] })).toEqual({ activeMs: 0, interactionCredit: 0, equipped: null, pending: null, unlocked: ["sunglasses"] });
  });

  it("unlocks each of six keepsakes only on opening and never auto-equips", () => {
    const store = createCompanionCollectionStore();
    expect(store.openGift()).toBeNull(); expect(store.equip("sunglasses")).toBe(false);
    for (const id of COMPANION_ACCESSORY_IDS) {
      store.interaction();
      for (let step = 0; step < 9; step++) expect(store.advance(30000, .9, true)).toBe(false);
      expect(store.advance(30000, .9, false)).toBe(false); expect(store.load().gifts.pending).toBeNull();
      expect(store.advance(250, .9, true)).toBe(true); expect(store.load().gifts.pending).toBe(id);
      expect(store.load().gifts.unlocked).not.toContain(id); expect(store.equip(id)).toBe(false);
      expect(store.openGift()).toBe(id); expect(store.openGift()).toBeNull(); expect(store.load().gifts.equipped).toBeNull();
      expect(store.load().gifts.interactionCredit).toBe(0); expect(store.load().gifts.activeMs).toBe(0);
    }
    expect(store.load().gifts.unlocked).toEqual(COMPANION_ACCESSORY_IDS);
    store.interaction(); for (let step = 0; step < 20; step++) expect(store.advance(30000, .9, true)).toBe(false);
    expect(store.load().gifts.pending).toBeNull(); expect(store.equip("satchel")).toBe(true); expect(store.equip("satchel")).toBe(false);
    expect(store.equip("identity-canary" as "satchel")).toBe(false); expect(store.equip(null)).toBe(true); expect(store.load().gifts.equipped).toBeNull();
  });

  it("uses the existing five-second flush boundary without per-tick storage or semantic updates", () => {
    let now = 0;
    const storage = storageFixture(), listener = vi.fn(), store = createCompanionCollectionStore(storage, () => now, listener);
    store.interaction(); storage.getItem.mockClear(); listener.mockClear();
    for (now = 250; now < 5000; now += 250) { store.advance(250, .9, true); store.flush(); }
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).toHaveBeenCalledTimes(1); expect(listener).not.toHaveBeenCalled();
    store.advance(250, .9, true); store.flush(); expect(storage.setItem).toHaveBeenCalledTimes(2);
    expect(JSON.parse(storage.read()!).gifts.activeMs).toBe(5000); expect(listener).not.toHaveBeenCalled();
    const reads = storage.getItem.mock.calls.length;
    for (let step = 0; step < 19; step++) store.advance(250, .9, true);
    expect(storage.getItem).toHaveBeenCalledTimes(reads); expect(storage.setItem).toHaveBeenCalledTimes(2);
  });

  it("retains discoveries through denied storage and applies the same retry budget", () => {
    let now = 0;
    const storage = { getItem: vi.fn(() => { throw new Error("blocked"); }), setItem: vi.fn(() => { throw new Error("quota"); }) }, listener = vi.fn();
    const store = createCompanionCollectionStore(storage, () => now, listener);
    store.recordFood("peas", true); expect(store.load().foods).toEqual(["peas"]);
    for (now = 250; now < 5000; now += 250) { store.advance(250, .9, true); store.flush(); }
    expect(storage.setItem).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenCalledTimes(1);
    store.flush(); expect(storage.setItem).toHaveBeenCalledTimes(2); expect(store.load().foods).toEqual(["peas"]);
  });

  it("adopts another tab's clear/equipment before flushing stale progress", () => {
    const storage = storageFixture({ version: 1, foods: ["apple"], behaviors: [], gifts: { unlocked: ["sunglasses", "beret"], equipped: "sunglasses" } });
    const store = createCompanionCollectionStore(storage); store.load(); store.advance(250, .9, false);
    storage.replace({ version: 1, foods: ["apple"], behaviors: [], gifts: { unlocked: ["sunglasses", "beret"], equipped: "beret" } });
    store.flush(true); expect(store.load().gifts.equipped).toBe("beret"); expect(storage.setItem).not.toHaveBeenCalled();
    store.advance(250, .9, false); storage.replace(null); store.flush(true);
    expect(store.load()).toEqual(normalizeCompanionCollection(undefined)); expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("does not announce a gift arrival canceled by a newer external clear at its write boundary", () => {
    const storage = storageFixture({ version: 1, foods: ["apple"], behaviors: [], gifts: { activeMs: COMPANION_GIFT_ACTIVE_MS, interactionCredit: 1 } }), listener = vi.fn();
    const store = createCompanionCollectionStore(storage, () => 0, listener); store.load(); listener.mockClear();
    storage.replace(null);
    expect(store.advance(250, .9, true)).toBe(false); expect(store.load().gifts.pending).toBeNull();
    expect(storage.setItem).not.toHaveBeenCalled(); expect(listener).toHaveBeenCalledTimes(1);
  });

  it("shares one semantic update per same-tab or external action and keeps collection on learning reset", () => {
    const entries = new Map<string, string>();
    entries.set(COMPANION_COLLECTION_KEY, JSON.stringify({ version: 1, foods: ["apple"], behaviors: ["bow"], gifts: { pending: "beret", unlocked: ["sunglasses"], equipped: "sunglasses" } }));
    const target = Object.assign(new EventTarget(), { localStorage: { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } } });
    vi.stubGlobal("window", target);
    const initial = loadCompanionCollection(), one = vi.fn(), two = vi.fn(), stopOne = subscribeCompanionCollection(one), stopTwo = subscribeCompanionCollection(two);
    resetCompanionHabits(); expect(loadCompanionCollection()).toEqual(initial); expect(one).not.toHaveBeenCalled();
    expect(openCompanionGift()).toBe("beret"); expect(loadCompanionCollection().gifts.equipped).toBe("sunglasses");
    expect(equipCompanionAccessory("beret")).toBe(true); expect(recordCompanionConsumedFood("carrot", true)).toBe(true);
    expect(one).toHaveBeenCalledTimes(3); expect(two).toHaveBeenCalledTimes(3);
    const external = JSON.stringify({ ...loadCompanionCollection(), gifts: { ...loadCompanionCollection().gifts, equipped: null } });
    entries.set(COMPANION_COLLECTION_KEY, external); target.dispatchEvent(Object.assign(new Event("storage"), { key: COMPANION_COLLECTION_KEY, newValue: external }));
    expect(one).toHaveBeenCalledTimes(4); expect(two).toHaveBeenCalledTimes(4); expect(loadCompanionCollection().gifts.equipped).toBeNull();
    entries.clear(); target.dispatchEvent(Object.assign(new Event("storage"), { key: null, newValue: null }));
    expect(one).toHaveBeenCalledTimes(5); expect(two).toHaveBeenCalledTimes(5); expect(loadCompanionCollection().foods).toEqual([]);
    stopOne(); stopTwo(); recordCompanionConsumedFood("apple", true); expect(one).toHaveBeenCalledTimes(5); expect(two).toHaveBeenCalledTimes(5);
  });
});

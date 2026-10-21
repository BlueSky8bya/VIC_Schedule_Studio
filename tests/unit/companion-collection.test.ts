import { afterEach, describe, expect, it, vi } from "vitest";
import { COMPANION_BEHAVIOR_IDS, COMPANION_LEGACY_BEHAVIOR_IDS, COMPANION_COLLECTION_KEY, createCompanionCollectionStore, equipCompanionAccessory, getCompanionRecentFood, loadCompanionCollection, normalizeCompanionCollection, observedCompanionBehavior, openCompanionGift, recordCompanionConsumedFood, subscribeCompanionCollection, subscribeCompanionConsumedFood, type CompanionBehaviorObservation } from "@/lib/ui/viewer-companion/collection";
import { advanceCompanionGifts, companionGiftChance, COMPANION_ACCESSORY_IDS, COMPANION_WEARABLE_IDS, COMPANION_GIFT_ACTIVE_MS, normalizeCompanionGifts } from "@/lib/ui/viewer-companion/gifts";
import { COMPANION_ACCESSORIES } from "@/lib/ui/viewer-companion/accessory-catalog";
import { resetCompanionHabits } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_SITUATION_IDS, companionRunContactSituation, observedCompanionSituation, type CompanionSituationObservation } from "@/lib/ui/viewer-companion/moments";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
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
    expect(normalized.gifts.unlocked).toEqual(COMPANION_ACCESSORY_IDS); expect(normalized.gifts.equipped).toBe("retro-cap"); expect(normalized.gifts.pending).toBeNull();
    expect(normalized.gifts.activeMs).toBe(0); expect(normalized.gifts.interactionCredit).toBe(0);
    expect(JSON.stringify(normalized)).not.toContain("canary"); expect(source.foods).toHaveLength(COMPANION_FOOD_KINDS.length * 2 + 1);
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

  it("publishes a transient recent meal only after actual consumption is registered, including familiar meals without another write", () => {
    const storage = storageFixture(), order: string[] = [], consumed = vi.fn(() => order.push("consumed"));
    const store = createCompanionCollectionStore(storage, () => 0, () => order.push("collection"), consumed);
    expect(store.recentFood()).toBeNull();
    store.recordFood("peach", false); store.recordFood("identity-canary" as "apple", true);
    expect(consumed).not.toHaveBeenCalled(); expect(store.recentFood()).toBeNull();
    expect(store.recordFood("peach", true)).toBe(true);
    expect(order).toEqual(["collection", "consumed"]);
    expect(store.recentFood()).toEqual({ kind: "peach", serial: 1, newDiscovery: true });
    expect(store.recordFood("peach", true)).toBe(false);
    expect(store.recentFood()).toEqual({ kind: "peach", serial: 2, newDiscovery: false });
    expect(consumed).toHaveBeenCalledTimes(2); expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(createCompanionCollectionStore(storage).recentFood()).toBeNull();
    store.synchronize(JSON.stringify({ ...store.load(), foods: ["apple"] }));
    expect(store.recentFood()).toBeNull(); expect(consumed).toHaveBeenCalledTimes(2);
    expect(storage.read()).not.toContain("serial"); expect(storage.read()).not.toContain("newDiscovery");
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

  it("stamps the allowed actions and requires the hidden consumed-food witness", () => {
    const store = createCompanionCollectionStore();
    for (const requestedRow of [33, 34, 35, 36, 40, 30, 29, 31, 21, 22, 16]) expect(store.recordBehavior(observation({ requestedRow }))).toBe(true);
    expect(store.recordBehavior(observation({ requestedRow: 37 }))).toBe(false); expect(store.recordBehavior(observation({ requestedRow: 38 }))).toBe(false);
    expect(store.load().behaviors).not.toContain("cheer-rehearsal");
    expect(store.recordBehavior(observation({ requestedRow: 39 }))).toBe(true);
    expect(store.recordBehavior(observation({ requestedRow: 23 }))).toBe(false);
    expect(store.recordBehavior(observation({ requestedRow: 23, foodAftertaste: true, decoded: false }))).toBe(false);
    expect(store.recordBehavior(observation({ requestedRow: 23, foodAftertaste: true }))).toBe(true);
    expect(store.load().behaviors).toEqual(COMPANION_LEGACY_BEHAVIOR_IDS);
  });

  it("does not turn an ordinary happy face or cold fallback into the body cheer discovery", () => {
    const cheer = observation({ requestedRow: 9, cheerBounce: true });
    expect(observedCompanionBehavior(cheer)).toBe("cheer-rehearsal");
    for (const patch of [{ cheerBounce: false }, { cheerBounce: undefined }, { visible: false }, { decoded: false }, { adoptedIndex: 144 }, { adoptedSrc: "/cold.webp" }, { requestedRow: 0 }])
      expect(observedCompanionBehavior({ ...cheer, ...patch })).toBeUndefined();
    const store = createCompanionCollectionStore();
    expect(store.recordBehavior({ ...cheer, cheerBounce: false })).toBe(false);
    expect(store.recordBehavior(cheer)).toBe(true);
    expect(store.recordBehavior(cheer)).toBe(false);
  });
});

describe("earned gifts and explicit equipment", () => {
  it("draws only after five active minutes, actual interaction and a safe delivery beat", () => {
    const initial = normalizeCompanionGifts(undefined);
    let state = initial;
    for (let step = 0; step < 10; step++) state = advanceCompanionGifts(state, 30000, .9, true);
    expect(state.activeMs).toBe(COMPANION_GIFT_ACTIVE_MS); expect(state.pending).toBeNull();
    state = { ...state, interactionCredit: 1 };
    expect(advanceCompanionGifts(state, 250, .9, false)).toBe(state);
    expect(advanceCompanionGifts(state, 250, NaN, true)).toBe(state);
    const arrived = advanceCompanionGifts(state, 250, .65, true, () => 0);
    expect(arrived.pending).toBe("sunglasses"); expect(arrived.unlocked).toEqual([]); expect(arrived.equipped).toBeNull();
    expect(arrived.activeMs).toBe(0); expect(arrived.interactionCredit).toBe(0);
    expect(advanceCompanionGifts(arrived, 30000, .9, true)).toBe(arrived);
    expect(advanceCompanionGifts(initial, 99 * 86400000, .9, true).activeMs).toBe(30000);
    for (const invalid of [0, -1, NaN, Infinity]) expect(advanceCompanionGifts(initial, invalid, .9, true)).toBe(initial);
    expect(normalizeCompanionGifts({ activeMs: -4, equipped: "beret", pending: "sunglasses", unlocked: ["sunglasses"] })).toEqual({ activeMs: 0, interactionCredit: 0, equipped: null, pending: null, unlocked: ["sunglasses"] });
  });

  it("offers exactly 0.05%–0.7% per consumed opportunity, never a tick or reload lottery", () => {
    expect(companionGiftChance(0)).toBe(.0005); expect(companionGiftChance(1)).toBeCloseTo(.007, 12);
    expect(companionGiftChance(-10)).toBe(.0005); expect(companionGiftChance(10)).toBeCloseTo(.007, 12);
    expect(companionGiftChance(NaN)).toBe(0);
    const ready = { ...normalizeCompanionGifts(undefined), activeMs: COMPANION_GIFT_ACTIVE_MS, interactionCredit: 1 };
    // An exhaustive uniform 2000-point grid tests exact boundary density,
    // without statistical flakes or weakening a runtime RNG.
    for (const [affection, expected] of [[0, 1], [1, 14]]) {
      let delivered = 0;
      for (let sample = 0; sample < 2000; sample++) if (advanceCompanionGifts(ready, 1, affection, true, () => sample / 2000).pending) delivered++;
      expect(delivered).toBe(expected);
    }
    const random = vi.fn(() => .007), missed = advanceCompanionGifts(ready, 1, 1, true, random);
    expect(missed).toMatchObject({ pending: null, activeMs: 0, interactionCredit: 0 });
    let next = normalizeCompanionGifts(missed);
    for (let tick = 0; tick < 5000; tick++) next = advanceCompanionGifts(next, 250, 1, true, random);
    expect(random).toHaveBeenCalledTimes(1); expect(next.pending).toBeNull();
    for (const invalid of [-1, NaN, Infinity, 1]) expect(advanceCompanionGifts(ready, 1, 1, true, () => invalid).pending).toBeNull();
    const untouched = vi.fn(() => 0);
    advanceCompanionGifts(ready, 250, 1, false, untouched);
    advanceCompanionGifts({ ...ready, interactionCredit: 0 }, 250, 1, true, untouched);
    expect(untouched).not.toHaveBeenCalled();
  });

  it("persists a failed opportunity immediately without a semantic discovery or reload retry", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(.5), listener = vi.fn();
    const storage = storageFixture({ version: 1, foods: [], behaviors: [], gifts: { activeMs: COMPANION_GIFT_ACTIVE_MS, interactionCredit: 1 } });
    const store = createCompanionCollectionStore(storage, () => 100, listener);
    store.load(); listener.mockClear(); expect(store.advance(250, 1, true)).toBe(false);
    expect(JSON.parse(storage.read()!).gifts).toMatchObject({ activeMs: 0, interactionCredit: 0, pending: null });
    expect(listener).not.toHaveBeenCalled();
    const reopened = createCompanionCollectionStore(storage);
    for (let tick = 0; tick < 20; tick++) reopened.advance(30000, 1, true);
    expect(random).toHaveBeenCalledTimes(1); expect(reopened.load().gifts.pending).toBeNull();
  });

  it("unlocks every active keepsake only on opening and never auto-equips", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const store = createCompanionCollectionStore();
    expect(store.openGift()).toBeNull(); expect(store.equip("sunglasses")).toBe(false);
    for (const id of COMPANION_WEARABLE_IDS) {
      store.interaction();
      for (let step = 0; step < 9; step++) expect(store.advance(30000, .9, true)).toBe(false);
      expect(store.advance(30000, .9, false)).toBe(false); expect(store.load().gifts.pending).toBeNull();
      expect(store.advance(250, .9, true)).toBe(true); expect(store.load().gifts.pending).toBe(id);
      expect(store.load().gifts.unlocked).not.toContain(id); expect(store.equip(id)).toBe(false);
      expect(store.openGift()).toBe(id); expect(store.openGift()).toBeNull(); expect(store.load().gifts.equipped).toBeNull();
      expect(store.load().gifts.interactionCredit).toBe(0); expect(store.load().gifts.activeMs).toBe(0);
    }
    expect(store.load().gifts.unlocked).toEqual(COMPANION_WEARABLE_IDS);
    store.interaction(); for (let step = 0; step < 20; step++) expect(store.advance(30000, .9, true)).toBe(false);
    expect(store.load().gifts.pending).toBeNull(); expect(store.equip("retro-cap")).toBe(true); expect(store.equip("retro-cap")).toBe(false); expect(store.equip("satchel")).toBe(false);
    expect(store.equip("identity-canary" as "satchel")).toBe(false); expect(store.equip(null)).toBe(true); expect(store.load().gifts.equipped).toBeNull();
  });
  it("preserves retired ownership while fitting replacements, without redrawing a neck on this body", () => {
    const old = { unlocked: ["scarf", "bell-pendant"], equipped: "bell-pendant", pending: "beret", activeMs: 450, interactionCredit: 1 };
    const migrated = normalizeCompanionGifts(old);
    expect(migrated.unlocked).toEqual(["bow", "scarf", "bell-pendant", "bell-badge"]);
    expect(migrated.equipped).toBe("bell-badge"); expect(migrated.pending).toBe("beret");
    expect(migrated.activeMs).toBe(450); expect(migrated.interactionCredit).toBe(1);
    expect(normalizeCompanionGifts(migrated)).toEqual(migrated);
    expect(normalizeCompanionGifts({ unlocked: [], pending: "scarf" }).pending).toBe("bow");
    expect(normalizeCompanionGifts({ unlocked: ["bow"], pending: "scarf" }).pending).toBe("sunglasses");
    expect(COMPANION_WEARABLE_IDS).not.toContain("scarf"); expect(COMPANION_WEARABLE_IDS).not.toContain("bell-pendant");
  });
  it("draws weighted unowned rewards independently of the box chance and never reoffers retired or owned props", () => {
    const ready = { ...normalizeCompanionGifts(undefined), activeMs: COMPANION_GIFT_ACTIVE_MS, interactionCredit: 1 };
    const counts = new Map<string, number>();
    for (let index = 0; index < 10000; index++) {
      let call = 0; const result = advanceCompanionGifts(ready, 1, 1, true, () => call++ === 0 ? 0 : index / 10000);
      expect(result.pending).not.toBeNull(); counts.set(result.pending!, (counts.get(result.pending!) ?? 0) + 1);
    }
    const totalWeight = COMPANION_WEARABLE_IDS.reduce((sum, id) => sum + COMPANION_ACCESSORIES[id].weight, 0);
    expect([...counts.keys()].sort()).toEqual([...COMPANION_WEARABLE_IDS.filter(id => COMPANION_ACCESSORIES[id].weight >= totalWeight / 10000)].sort());
    // The rare literal eye print's interval is narrower than this coarse
    // grid. Its actual interval midpoint still has to select that item.
    let edge = 0;
    for (const id of COMPANION_WEARABLE_IDS) {
      const draw = (edge + COMPANION_ACCESSORIES[id].weight / 2) / totalWeight; let call = 0;
      expect(advanceCompanionGifts(ready, 1, 1, true, () => call++ === 0 ? 0 : draw).pending).toBe(id);
      edge += COMPANION_ACCESSORIES[id].weight;
    }
    expect(counts.get("propeller-hat")!).toBeLessThan(10); expect(counts.get("magic-pocket")!).toBeLessThan(10);
    expect(counts.get("beret")!).toBeGreaterThan(500);
    for (const id of COMPANION_WEARABLE_IDS) {
      const onlyOne = { ...ready, unlocked: COMPANION_WEARABLE_IDS.filter(other => other !== id) };
      let call = 0; expect(advanceCompanionGifts(onlyOne, 1, 1, true, () => call++ === 0 ? 0 : .9).pending).toBe(id);
    }
    expect(COMPANION_ACCESSORIES.scarf.weight).toBe(0); expect(COMPANION_ACCESSORIES["bell-pendant"].weight).toBe(0);
    const allOwned = { ...ready, unlocked: [...COMPANION_WEARABLE_IDS] }, untouched = vi.fn(() => 0);
    expect(advanceCompanionGifts(allOwned, 1, 1, true, untouched)).toBe(allOwned); expect(untouched).not.toHaveBeenCalled();
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
    vi.spyOn(Math, "random").mockReturnValue(0);
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

  it("keeps recent-meal notifications local and separate from semantic collection updates", () => {
    const entries = new Map<string, string>();
    const target = Object.assign(new EventTarget(), { localStorage: { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); } } });
    vi.stubGlobal("window", target);
    const changed = vi.fn(), consumed = vi.fn(), stopChanged = subscribeCompanionCollection(changed), stopConsumed = subscribeCompanionConsumedFood(consumed);
    expect(getCompanionRecentFood()).toBeNull(); recordCompanionConsumedFood("peach", false);
    expect(consumed).not.toHaveBeenCalled();
    recordCompanionConsumedFood("peach", true); recordCompanionConsumedFood("peach", true);
    expect(changed).toHaveBeenCalledTimes(1); expect(consumed).toHaveBeenCalledTimes(2);
    expect(consumed.mock.calls[1][0]).toEqual({ kind: "peach", serial: 2, newDiscovery: false });
    const external = JSON.stringify({ ...loadCompanionCollection(), foods: ["apple", "peach"] });
    entries.set(COMPANION_COLLECTION_KEY, external); target.dispatchEvent(Object.assign(new Event("storage"), { key: COMPANION_COLLECTION_KEY, newValue: external }));
    expect(consumed).toHaveBeenCalledTimes(2); expect(getCompanionRecentFood()?.kind).toBe("peach");
    stopChanged(); stopConsumed(); recordCompanionConsumedFood("apple", true); expect(consumed).toHaveBeenCalledTimes(2);
  });
});

describe("separate witnessed situations and additive107 migration", () => {
  const seen = (patch: Partial<CompanionSituationObservation> = {}): CompanionSituationObservation => ({ id: "food-trip", occurred: true, visible: true, decoded: true, requestedIndex: 320, adoptedIndex: 320, requestedSrc: "/actual.webp", adoptedSrc: "/actual.webp", ...patch });
  it("preserves the actual food contact and requires running for the running-specific stamp", () => {
    expect(companionRunContactSituation({ cause: "food", foodPresent: true, running: true })).toBe("food-trip");
    expect(companionRunContactSituation({ cause: "food", foodPresent: false, running: true })).toBeUndefined();
    expect(companionRunContactSituation({ cause: "stumble", foodPresent: false, running: true })).toBe("run-tumble");
    expect(companionRunContactSituation({ cause: "stumble", foodPresent: true, running: false })).toBeUndefined();
  });
  it("keeps the original food/behavior/first six ownership choices without inventing history", () => {
    const old = { version: 1, foods: ["sweet-potato", "potato", "dragon-fruit"], behaviors: ["tumble"], gifts: { pending: "satchel", unlocked: ["sunglasses", "beret", "bow", "star-pin", "flower-crown"], equipped: "beret", activeMs: 12345, interactionCredit: 1 } };
    const normalized = normalizeCompanionCollection(old);
    expect(normalized.foods).toEqual(["dragon-fruit", "sweet-potato", "potato"]); expect(normalized.behaviors).toEqual(["tumble"]); expect(normalized.situations).toEqual([]); expect(normalized.gifts).toEqual({ ...old.gifts, pending: "retro-cap", unlocked: [...old.gifts.unlocked, "monocle"] });
    const next = normalizeCompanionCollection({ ...old, situations: [...COMPANION_SITUATION_IDS, "private-canary", ...COMPANION_SITUATION_IDS] });
    expect(next.situations).toEqual(COMPANION_SITUATION_IDS); expect(JSON.stringify(next)).not.toContain("canary");
    expect(COMPANION_ACCESSORY_IDS.slice(0, 6)).toEqual(["sunglasses", "beret", "bow", "star-pin", "flower-crown", "satchel"]);
    expect(COMPANION_ACCESSORY_IDS).toHaveLength(39); expect(COMPANION_WEARABLE_IDS).toHaveLength(27);
  });
  it("records an explicit gift opening even while the world is paused, never from seeded ownership alone", () => {
    const store = createCompanionCollectionStore(storageFixture({ version: 1, foods: [], behaviors: [], gifts: { pending: "pixel-sunglasses", unlocked: ["sunglasses"], equipped: "sunglasses" } }));
    expect(store.load().situations).toEqual([]); expect(store.openGift()).toBe("pixel-sunglasses");
    expect(store.load().situations).toEqual(["gift-opened"]); expect(store.load().gifts.equipped).toBe("sunglasses");
    expect(store.openGift()).toBeNull(); expect(store.load().situations).toEqual(["gift-opened"]);
  });
  it("requires the actual occurrence and a visible exact decoded adoption, never a requested fallback", () => {
    expect(observedCompanionSituation(seen())).toBe("food-trip");
    for (const patch of [{ occurred: false }, { visible: false }, { decoded: false }, { adoptedIndex: 0 }, { adoptedSrc: "/idle.webp" }, { requestedSrc: "", adoptedSrc: "" }, { requestedIndex: -1, adoptedIndex: -1 }, { id: "private-canary" as "food-trip" }]) expect(observedCompanionSituation(seen(patch))).toBeUndefined();
    const storage = storageFixture(), listener = vi.fn(), store = createCompanionCollectionStore(storage, () => 0, listener);
    expect(store.recordSituation(seen({ occurred: false }))).toBe(false); expect(storage.setItem).not.toHaveBeenCalled();
    expect(store.recordSituation(seen())).toBe(true); storage.getItem.mockClear();
    for (let sample = 0; sample < 500; sample++) expect(store.recordSituation(seen())).toBe(false);
    expect(storage.getItem).not.toHaveBeenCalled(); expect(storage.setItem).toHaveBeenCalledTimes(1); expect(listener).toHaveBeenCalledTimes(1);
    expect(store.load().foods).toEqual([]); expect(store.load().behaviors).toEqual([]); expect(store.load().situations).toEqual(["food-trip"]);
    expect(JSON.parse(storage.read()!).situations).toEqual(["food-trip"]);
    for (const id of COMPANION_SITUATION_IDS) store.recordSituation(seen({ id }));
    expect(store.load().situations).toEqual(COMPANION_SITUATION_IDS);
  });
});

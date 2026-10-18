import { describe, expect, it, vi } from "vitest";
import { COMPANION_COLLECTION_KEY, createCompanionCollectionStore, getCompanionUnreadCounts, isCompanionCollectionUnread, normalizeCompanionCollection, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";

const emptySeen = () => ({ foods: [], behaviors: [], situations: [], accessories: [] });
const historical = (): CompanionCollection => ({ version: 1, foods: ["apple"], behaviors: ["groom"], situations: ["meal-finished"], gifts: { pending: "beret", unlocked: ["sunglasses"], equipped: "sunglasses", activeMs: 120, interactionCredit: 1 } });
const observed = { requestedRow: 34, requestedIndex: 513, adoptedIndex: 513, requestedSrc: "/companion/hd/test.webp", adoptedSrc: "/companion/hd/test.webp", decoded: true, visible: true };
function storage(initial: unknown = null) {
  let raw: string | null = initial === null ? null : JSON.stringify(initial);
  return { getItem: vi.fn(() => raw), setItem: vi.fn((key: string, value: string) => { expect(key).toBe(COMPANION_COLLECTION_KEY); raw = value; }), read: () => raw, replace: (value: unknown) => { raw = value === null ? null : JSON.stringify(value); } };
}

describe("local per-item discovery acknowledgment", () => {
  it("acknowledges historical ownership lazily and freezes that baseline before a new discovery", () => {
    const disk = storage(historical()), store = createCompanionCollectionStore(disk);
    expect(getCompanionUnreadCounts(store.load())).toEqual({ foods: 0, memories: 0, accessories: 0, total: 0 });
    expect(store.load().seen).toBeUndefined(); expect(store.acknowledge("food", "apple")).toBe(false);
    expect(disk.setItem).not.toHaveBeenCalled();
    expect(store.recordFood("peach", true)).toBe(true);
    expect(store.load().seen).toEqual({ foods: ["apple"], behaviors: ["groom"], situations: ["meal-finished"], accessories: ["sunglasses"] });
    expect(getCompanionUnreadCounts(store.load())).toEqual({ foods: 1, memories: 0, accessories: 0, total: 1 });
    expect(createCompanionCollectionStore(disk).load().seen).toEqual(store.load().seen);
    expect(isCompanionCollectionUnread(store.load(), "food", "peach")).toBe(true);
  });

  it("never creates unread food from spawns or familiar meals, and keeps a new food unread through automatic recent-meal reads", () => {
    const disk = storage(), consumed = vi.fn(), store = createCompanionCollectionStore(disk, () => 0, undefined, consumed);
    store.recordFood("peach", false); expect(getCompanionUnreadCounts(store.load()).total).toBe(0);
    expect(disk.setItem).not.toHaveBeenCalled();
    store.recordFood("peach", true); const saved = disk.read();
    expect(store.recentFood()).toEqual({ kind: "peach", serial: 1, newDiscovery: true });
    expect(isCompanionCollectionUnread(store.load(), "food", "peach")).toBe(true);
    expect(disk.read()).toBe(saved); expect(store.acknowledge("food", "peach")).toBe(true);
    store.recordFood("peach", true);
    expect(store.recentFood()).toEqual({ kind: "peach", serial: 2, newDiscovery: false });
    expect(getCompanionUnreadCounts(store.load()).total).toBe(0); expect(consumed).toHaveBeenCalledTimes(2);
  });

  it("tracks actual adopted behaviors, witnessed situations and opened accessories independently", () => {
    const disk = storage(historical()), store = createCompanionCollectionStore(disk);
    expect(store.recordBehavior({ ...observed, visible: false })).toBe(false);
    expect(store.recordBehavior(observed)).toBe(true);
    expect(store.openGift()).toBe("beret");
    expect(getCompanionUnreadCounts(store.load())).toEqual({ foods: 0, memories: 2, accessories: 1, total: 3 });
    expect(isCompanionCollectionUnread(store.load(), "moment", "gift-opened")).toBe(true);
    expect(isCompanionCollectionUnread(store.load(), "accessory", "beret")).toBe(true);
    expect(isCompanionCollectionUnread(store.load(), "accessory", "sunglasses")).toBe(false);
    expect(store.acknowledge("behavior", "lean-nuzzle")).toBe(true);
    expect(getCompanionUnreadCounts(store.load()).memories).toBe(1);
    expect(store.acknowledge("accessory", "beret")).toBe(true);
    expect(isCompanionCollectionUnread(store.load(), "moment", "gift-opened")).toBe(true);
    expect(store.acknowledge("moment", "gift-opened")).toBe(true);
    expect(getCompanionUnreadCounts(createCompanionCollectionStore(disk).load()).total).toBe(0);
  });

  it("keeps unopened gifts and unknown or malformed acknowledgment identities outside unread ownership", () => {
    const disk = storage(historical()), store = createCompanionCollectionStore(disk);
    expect(isCompanionCollectionUnread(store.load(), "accessory", "beret")).toBe(false);
    for (const [kind, id] of [["food", "peach"], ["accessory", "beret"], ["food", "private-canary"], ["__proto__", "apple"]] as const) expect(store.acknowledge(kind as "food", id)).toBe(false);
    expect(isCompanionCollectionUnread(store.load(), "__proto__" as "food", "apple")).toBe(false);
    expect(disk.setItem).not.toHaveBeenCalled();
  });

  it("marks only a genuinely occurred, visible, adopted situation unread without acknowledging another new memory", () => {
    const disk = storage(historical()), store = createCompanionCollectionStore(disk);
    const situation = { ...observed, id: "food-trip" as const, occurred: true };
    expect(store.recordSituation({ ...situation, occurred: false })).toBe(false);
    expect(store.recordSituation({ ...situation, adoptedIndex: 0 })).toBe(false);
    expect(disk.setItem).not.toHaveBeenCalled();
    expect(store.recordSituation(situation)).toBe(true); expect(store.recordBehavior(observed)).toBe(true);
    expect(getCompanionUnreadCounts(store.load()).memories).toBe(2);
    expect(store.acknowledge("moment", "food-trip")).toBe(true);
    expect(getCompanionUnreadCounts(store.load()).memories).toBe(1);
    expect(isCompanionCollectionUnread(store.load(), "behavior", "lean-nuzzle")).toBe(true);
    const reloaded = createCompanionCollectionStore(disk); expect(reloaded.recordSituation(situation)).toBe(false);
    expect(isCompanionCollectionUnread(reloaded.load(), "moment", "food-trip")).toBe(false);
  });

  it("bounds malformed/duplicate seen data to discovered allowlisted IDs and does not invent unread history from missing fields", () => {
    const normalized = normalizeCompanionCollection({ ...historical(), seen: { foods: ["apple", "apple", "peach", "private-canary"], behaviors: "private-canary", situations: null, accessories: ["sunglasses", "sunglasses", "beret", "scarf", "private-canary"], identity: "private-canary" } });
    expect(normalized.seen).toEqual({ foods: ["apple"], behaviors: ["groom"], situations: ["meal-finished"], accessories: ["sunglasses"] });
    expect(JSON.stringify(normalized)).not.toContain("canary"); expect(getCompanionUnreadCounts(normalized).total).toBe(0);
    for (const seen of [null, [], "identity", 5, {}]) expect(getCompanionUnreadCounts(normalizeCompanionCollection({ ...historical(), seen })).total).toBe(0);
    const bounded = normalizeCompanionCollection({ ...historical(), foods: [...COMPANION_FOOD_KINDS], gifts: { ...historical().gifts, unlocked: [...COMPANION_WEARABLE_IDS] }, seen: { foods: [...COMPANION_FOOD_KINDS, ...COMPANION_FOOD_KINDS], accessories: [...COMPANION_WEARABLE_IDS, ...COMPANION_WEARABLE_IDS] } });
    expect(bounded.seen?.foods).toHaveLength(COMPANION_FOOD_KINDS.length); expect(bounded.seen?.accessories).toHaveLength(COMPANION_WEARABLE_IDS.length);
  });

  it("publishes one semantic acknowledgment, deep-copies seen, and avoids duplicate writes", () => {
    const disk = storage({ ...historical(), seen: emptySeen() }), changed = vi.fn(), store = createCompanionCollectionStore(disk, () => 0, changed);
    store.load(); changed.mockClear(); expect(store.acknowledge("food", "apple")).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1); expect(disk.setItem).toHaveBeenCalledTimes(1);
    const copy = store.load(); copy.seen!.foods.length = 0; changed.mock.calls[0][0].seen.foods.length = 0;
    expect(isCompanionCollectionUnread(store.load(), "food", "apple")).toBe(false);
    expect(store.acknowledge("food", "apple")).toBe(false); expect(disk.setItem).toHaveBeenCalledTimes(1);
  });

  it("refreshes a stale tab before ack and retains sibling discoveries, equipment and previous acknowledgments", () => {
    const disk = storage({ ...historical(), seen: emptySeen() }), changedA = vi.fn(), a = createCompanionCollectionStore(disk, () => 0, changedA), b = createCompanionCollectionStore(disk, () => 0);
    a.load(); b.load(); b.recordFood("peach", true); b.equip(null); b.acknowledge("behavior", "groom");
    expect(a.acknowledge("food", "apple")).toBe(true);
    expect(a.load().foods).toEqual(["apple", "peach"]); expect(a.load().gifts.equipped).toBeNull();
    expect(isCompanionCollectionUnread(a.load(), "behavior", "groom")).toBe(false);
    expect(isCompanionCollectionUnread(a.load(), "food", "peach")).toBe(true);
    expect(b.acknowledge("food", "peach")).toBe(true);
    a.synchronize(disk.read()); expect(getCompanionUnreadCounts(a.load()).foods).toBe(0);
    expect(changedA.mock.calls.at(-1)?.[0].seen.foods).toEqual(["apple", "peach"]);
    disk.replace(null); a.synchronize(null); expect(getCompanionUnreadCounts(a.load()).total).toBe(0);
  });
});

import { describe, expect, it, vi } from "vitest";
import { COMPANION_ACCESSORIES, COMPANION_ACCESSORY_REPLACEMENTS, COMPANION_WEARABLE_IDS, currentCompanionAccessory } from "@/lib/ui/viewer-companion/accessory-catalog";
import { normalizeCompanionGifts } from "@/lib/ui/viewer-companion/gifts";
import { createCompanionCollectionStore, getCompanionUnreadCounts, normalizeCompanionCollection } from "@/lib/ui/viewer-companion/collection";

const retired = ["star-pin", "satchel", "leaf-umbrella", "heart-badge", "lemon-badge", "bandage", "mushroom-hat"] as const;
describe("focused wardrobe migration114", () => {
  it("keeps original earned keys, gives exactly their ordinary counterpart and preserves equipped fit", () => {
    expect(COMPANION_WEARABLE_IDS).toHaveLength(27);
    for (const id of retired) {
      expect(COMPANION_WEARABLE_IDS).not.toContain(id); expect(COMPANION_ACCESSORIES[id]).toMatchObject({ retired: true, weight: 0 });
      const mapped = currentCompanionAccessory(id), result = normalizeCompanionGifts({ unlocked: [id], equipped: id });
      expect(mapped).not.toBe(id); expect(COMPANION_ACCESSORIES[mapped].weight).toBeGreaterThanOrEqual(4);
      expect(result.unlocked).toHaveLength(2); expect(result.unlocked).toEqual(expect.arrayContaining([id, mapped])); expect(result.equipped).toBe(mapped);
      expect(normalizeCompanionGifts(result)).toEqual(result);
    }
    expect(new Set(COMPANION_WEARABLE_IDS.map(id => COMPANION_ACCESSORIES[id].family))).toEqual(new Set(["head", "eyes", "eye-cover", "eye-mask", "front-bow", "front-pocket"]));
    expect(COMPANION_ACCESSORIES["bell-badge"].family).toBe("front-bow");
  });
  it("inherits seen and unseen history without a migration write or fake discovery", () => {
    for (const id of Object.keys(COMPANION_ACCESSORY_REPLACEMENTS) as (keyof typeof COMPANION_ACCESSORIES)[]) {
      const baseline = { version: 1, foods: [], behaviors: [], situations: [], gifts: { unlocked: [id], equipped: id } };
      const read = normalizeCompanionCollection({ ...baseline, seen: { accessories: [id] } });
      expect(read.seen?.accessories).toContain(id); expect(read.seen?.accessories).toContain(currentCompanionAccessory(id));
      expect(getCompanionUnreadCounts(read).total).toBe(0); expect(normalizeCompanionCollection(read)).toEqual(read);
      const unread = normalizeCompanionCollection({ ...baseline, seen: { accessories: [] } });
      expect(getCompanionUnreadCounts(unread).accessories).toBe(1); expect(normalizeCompanionCollection(unread)).toEqual(unread);
      const disk = { getItem: vi.fn(() => JSON.stringify(baseline)), setItem: vi.fn() }, store = createCompanionCollectionStore(disk);
      expect(getCompanionUnreadCounts(store.load()).total).toBe(0); expect(disk.setItem).not.toHaveBeenCalled();
    }
  });
  it("maps wrapped legacy parcels deterministically without forced rare upgrades or silent loss", () => {
    for (const id of retired) {
      expect(normalizeCompanionGifts({ pending: id }).pending).toBe(currentCompanionAccessory(id));
      const mappedOwned = normalizeCompanionGifts({ pending: id, unlocked: [currentCompanionAccessory(id)] });
      expect(COMPANION_ACCESSORIES[mappedOwned.pending!].weight).toBeGreaterThanOrEqual(5);
      const ordinary = COMPANION_WEARABLE_IDS.filter(item => COMPANION_ACCESSORIES[item].weight >= 5 || item === currentCompanionAccessory(id));
      const full = normalizeCompanionGifts({ pending: id, unlocked: ordinary });
      expect(full.pending).toBe(id); expect(normalizeCompanionGifts(full)).toEqual(full);
      let raw = JSON.stringify({ version: 1, gifts: full });
      const disk = { getItem: () => raw, setItem: vi.fn((_key: string, value: string) => { raw = value; }) };
      const store = createCompanionCollectionStore(disk);
      expect(store.openGift()).toBe(currentCompanionAccessory(id));
      expect(store.load().gifts.pending).toBeNull(); expect(store.load().gifts.unlocked).toContain(id);
      expect(store.load().gifts.unlocked).not.toContain("propeller-hat"); expect(store.load().gifts.unlocked).not.toContain("magic-pocket");
      expect(getCompanionUnreadCounts(store.load()).accessories).toBe(0);
    }
  });
  it("keeps acknowledged retired keys when another active discovery is inspected and reloaded", () => {
    let raw = JSON.stringify({ version: 1, gifts: { unlocked: ["heart-badge", "heart-glasses", "round-glasses"] }, seen: { accessories: ["heart-badge", "heart-glasses"] } });
    const disk = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value; } }, store = createCompanionCollectionStore(disk);
    expect(getCompanionUnreadCounts(store.load()).accessories).toBe(1);
    expect(store.acknowledge("accessory", "round-glasses")).toBe(true);
    expect(store.load().seen?.accessories).toEqual(["heart-badge", "round-glasses", "heart-glasses"]);
    expect(createCompanionCollectionStore(disk).load().seen?.accessories).toEqual(store.load().seen?.accessories);
    expect(getCompanionUnreadCounts(store.load()).accessories).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { COMPANION_MEMORY_BOOK, companionMemoryKey, filterCompanionMemories } from "@/lib/ui/viewer-companion/memory-book-order";
import { COMPANION_LEGACY_BEHAVIOR_IDS, isCompanionCollectionUnread, normalizeCompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";
import { COMPANION_MEMORY_ENCOUNTER_HINTS } from "@/lib/ui/viewer-companion/memory-encounter-hints";

describe("memory family projections preserve witnessed identities and unread state", () => {
  it("partitions106 entries without moving the original25 or changing storage kind", () => {
    const all = filterCompanionMemories("all"), groups = [filterCompanionMemories("expression"), filterCompanionMemories("pose"), filterCompanionMemories("life")];
    expect(all).toEqual(COMPANION_MEMORY_BOOK);
    expect(groups.map(group => group.length)).toEqual([36, 21, 49]);
    expect(new Set(groups.flat().map(companionMemoryKey)).size).toBe(106);
    expect(all.slice(0, 25).map(m => m.id)).toEqual([...COMPANION_LEGACY_BEHAVIOR_IDS, ...COMPANION_SITUATION_IDS]);
    expect(groups[2].slice(0, 25)).toEqual(all.slice(0, 25));
  });
  it("keeps a legacy moment and new face unread across filtering without writing the collection", () => {
    const collection = normalizeCompanionCollection({ version: 1, behaviors: ["expression:sour"], situations: ["hide-found"], seen: { foods: [], behaviors: [], situations: [], accessories: [] } });
    const before = JSON.stringify(collection);
    for (const filter of ["life", "expression", "pose", "all"] as const) for (const item of filterCompanionMemories(filter))
      expect(isCompanionCollectionUnread(collection, item.kind, item.id)).toBe(["expression:sour", "hide-found"].includes(item.id));
    expect(JSON.stringify(collection)).toBe(before);
  });
  it("gives every registered memory a short concrete opportunity with no animal-mode exclusions", () => {
    expect(Object.keys(COMPANION_MEMORY_ENCOUNTER_HINTS).sort()).toEqual(COMPANION_MEMORY_BOOK.map(m => m.id).sort());
    for (const item of COMPANION_MEMORY_BOOK) { expect(item.hint).toBe(COMPANION_MEMORY_ENCOUNTER_HINTS[item.id]); expect(item.hint.length).toBeLessThan(55); }
    for (const id of ["groom", "bow", "pounce"]) expect(COMPANION_MEMORY_ENCOUNTER_HINTS[id]).not.toMatch(/고양이|강아지/);
  });
});

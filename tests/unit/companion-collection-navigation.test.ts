import { describe, expect, it } from "vitest";
import { companionCollectionLayout, companionCollectionPage } from "@/components/shared/companion-collection-navigation";

describe("finite responsive collection pages", () => {
  it("fits fewer tiles on a shorter sheet and bounds wide tall sheets to24", () => {
    expect(companionCollectionLayout(480, 330)).toEqual({ columns: 4, rows: 2, size: 8 });
    expect(companionCollectionLayout(480, 160).size).toBe(4);
    expect(companionCollectionLayout(300, 220).size).toBe(3);
    expect(companionCollectionLayout(2400, 2000).size).toBe(24);
    expect(companionCollectionLayout(NaN, Infinity).size).toBe(2);
  });
  it("reserves room for full food rarity rows and two-line memory names", () => {
    for (const kind of ["default", "memory"] as const) for (const height of [140, 247, 270, 280, 420, 600]) {
      const { rows } = companionCollectionLayout(400, height, kind);
      expect((height - 4 - (rows - 1) * 8) / rows).toBeGreaterThanOrEqual(116);
    }
    expect(companionCollectionLayout(640, 247)).toEqual({ columns: 6, rows: 2, size: 12 });
    expect(companionCollectionLayout(640, 247, "memory")).toEqual({ columns: 5, rows: 2, size: 10 });
  });
  it("preserves the selected identity across resize, final partial pages and each collection type", () => {
    for (const length of [180, 24, 20]) for (const size of [2, 4, 6, 12, 24]) {
      const seen: number[] = [];
      for (let index = 0; index < length; index += size) {
        const page = companionCollectionPage(index, length, size);
        for (let item = page.offset; item < page.end; item++) seen.push(item);
      }
      expect(seen).toEqual(Array.from({ length }, (_, index) => index));
      const selected = length - 1, page = companionCollectionPage(selected, length, size);
      expect(page.offset).toBeLessThanOrEqual(selected); expect(page.end).toBeGreaterThan(selected);
      expect(page.page + 1).toBe(page.count);
    }
  });
  it("keeps larger memories legible and the wardrobe in exactly one measured row", () => {
    expect(companionCollectionLayout(640, 280, "memory")).toEqual({ columns: 5, rows: 2, size: 10 });
    expect(companionCollectionLayout(640, 1000, "wardrobe")).toEqual({ columns: 6, rows: 1, size: 6 });
    expect(companionCollectionLayout(300, 1000, "wardrobe")).toEqual({ columns: 3, rows: 1, size: 3 });
    for (const [width, height] of [[300, 114], [640, 114], [900, 104]]) {
      const { size } = companionCollectionLayout(width, height, "wardrobe");
      const selected = companionCollectionPage(26, 27, size);
      expect(selected.end).toBe(27); expect(selected.offset).toBeLessThanOrEqual(26);
    }
  });
});

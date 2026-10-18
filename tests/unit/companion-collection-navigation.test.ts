import { describe, expect, it } from "vitest";
import { companionCollectionLayout, companionCollectionPage } from "@/components/shared/companion-collection-navigation";

describe("finite responsive collection pages", () => {
  it("fits fewer tiles on a shorter sheet and bounds wide tall sheets to24", () => {
    expect(companionCollectionLayout(480, 330)).toEqual({ columns: 4, rows: 3, size: 12 });
    expect(companionCollectionLayout(480, 160).size).toBe(4);
    expect(companionCollectionLayout(300, 220).size).toBe(6);
    expect(companionCollectionLayout(2400, 2000).size).toBe(24);
    expect(companionCollectionLayout(NaN, Infinity).size).toBe(2);
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
});

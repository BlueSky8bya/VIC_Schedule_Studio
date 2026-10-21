import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/activity/client", () => ({ logActivity: vi.fn() }));
import { logActivity } from "@/lib/activity/client";
import { companionCollectionLayout, companionCollectionPage, nextCompanionCollectionUnread, onCollectionPageKey } from "@/components/shared/companion-collection-navigation";

describe("finite responsive collection pages", () => {
  it("fits fewer tiles on a shorter sheet and bounds wide tall sheets to24", () => {
    expect(companionCollectionLayout(480, 330)).toEqual({ columns: 4, rows: 2, size: 8 });
    expect(companionCollectionLayout(480, 160).size).toBe(4);
    expect(companionCollectionLayout(300, 220).size).toBe(3);
    expect(companionCollectionLayout(2400, 2000).size).toBe(24);
    expect(companionCollectionLayout(NaN, Infinity).size).toBe(2);
  });
  it("reserves room for full food rarity rows and two-line memory names", () => {
    for (const kind of ["default", "memory"] as const) for (const height of [247, 270, 280, 420, 600]) {
      const { rows } = companionCollectionLayout(400, height, kind);
      expect((height - 4 - (rows - 1) * 8) / rows).toBeGreaterThanOrEqual(kind === "default" ? 108 : 116);
    }
    expect(companionCollectionLayout(640, 247)).toEqual({ columns: 6, rows: 2, size: 12 });
    expect(companionCollectionLayout(640, 247, "memory")).toEqual({ columns: 5, rows: 2, size: 10 });
  });
  it("uses one readable row on short food and toy pages and adds rows only when they fit", () => {
    for (const kind of ["default", "toy"] as const) for (const height of [140, 160, 196, 240]) {
      const layout = companionCollectionLayout(320, height, kind);
      expect(layout.rows).toBe(height < (kind === "default" ? 228 : 244) ? 1 : 2);
      expect(companionCollectionLayout(320, height, kind).size).toBeLessThanOrEqual(24);
    }
  });
  it("finds every missing unread item across pages, wraps once and stops when exhausted", () => {
    for (const length of [180, 24, 68, 27]) {
      const unread = new Set([0, 3, length - 1]), visited: number[] = [];
      let selected = 1;
      while (unread.size) {
        const next = nextCompanionCollectionUnread(selected, length, index => unread.has(index));
        expect(next).not.toBeNull(); selected = next!; visited.push(selected); unread.delete(selected);
      }
      expect(visited).toEqual([3, length - 1, 0]);
      expect(nextCompanionCollectionUnread(selected, length, index => unread.has(index))).toBeNull();
    }
    expect(nextCompanionCollectionUnread(0, 0, () => true)).toBeNull();
    expect(nextCompanionCollectionUnread(4, 8, index => index === 4)).toBe(4);
  });
  it("keeps manual PageDown/PageUp navigation separate from the footer's horizontal buttons", () => {
    const select = vi.fn(), preventDefault = vi.fn(), stopPropagation = vi.fn();
    const event = (key: string) => ({ key, preventDefault, stopPropagation }) as unknown as KeyboardEvent<HTMLElement>;
    vi.mocked(logActivity).mockClear();
    onCollectionPageKey(event("PageDown"), 0, 4, 8, select);
    expect(select.mock.calls).toEqual([[8, true]]);
    expect(logActivity).toHaveBeenCalledExactlyOnceWith("ui.click", { target: "companion-collection-page#next" });
    onCollectionPageKey(event("End"), 3, 4, 8, select);
    expect(select).toHaveBeenCalledTimes(1); expect(logActivity).toHaveBeenCalledTimes(1);
    onCollectionPageKey(event("PageUp"), 2, 4, 8, select);
    expect(select.mock.calls.at(-1)).toEqual([8, true]);
    expect(logActivity).toHaveBeenLastCalledWith("ui.click", { target: "companion-collection-page#prev" });
    onCollectionPageKey(event("Enter"), 0, 4, 8, select);
    onCollectionPageKey(event("ArrowLeft"), 2, 4, 8, select);
    onCollectionPageKey(event("ArrowRight"), 2, 4, 8, select);
    expect(select).toHaveBeenCalledTimes(2); expect(logActivity).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledTimes(3); expect(stopPropagation).toHaveBeenCalledTimes(3);
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

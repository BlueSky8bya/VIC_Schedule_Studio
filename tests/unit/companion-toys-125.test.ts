import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { COMPANION_TOY_HINTS, COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, COMPANION_TOY_VISUALS, getCompanionToyArt, isCompanionToyKind, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { companionToyBoxDropReady, createCompanionToys, MAX_COMPANION_TOYS } from "@/lib/ui/viewer-companion/toys";
import { companionToyUnread, createCompanionTastesStore, normalizeCompanionTastes, summarizeCompanionToyTastes } from "@/lib/ui/viewer-companion/toy-tastes";
import { sanitizeMeta, sanitizeTarget } from "@/lib/activity/kinds";

describe("125 twenty-four shared toy identities", () => {
  it("covers the exact new objects, with varied live art sizes inside the unchanged native target", () => {
    expect(COMPANION_TOY_KINDS).toEqual(["ball", "blocks", "paper-plane", "spool", "hoop", "pinwheel", "bell", "feather", "duck", "spinning-top", "toy-car", "train", "dice", "rocking-horse", "squeaky-carrot", "star-wand", "kaleidoscope", "tambourine", "maraca", "yo-yo", "plush-fish", "ribbon-ball", "stacking-rings", "toy-rocket"]);
    const dimensions = new Set<string>();
    for (const kind of COMPANION_TOY_KINDS) {
      expect(isCompanionToyKind(kind)).toBe(true); expect(COMPANION_TOY_NAMES[kind]).toBeTruthy(); expect(COMPANION_TOY_HINTS[kind]).toBeTruthy();
      expect(getCompanionToyArt(kind)).toBe(`/companion/home/125/toy-${kind}.webp`);
      const visual = COMPANION_TOY_VISUALS[kind];
      for (const extent of [visual.width, visual.height]) { expect(extent).toBeGreaterThanOrEqual(18); expect(extent).toBeLessThanOrEqual(42); }
      dimensions.add(`${visual.width}x${visual.height}`);
    }
    expect(dimensions.size).toBeGreaterThan(12); expect(COMPANION_TOY_VISUALS.train.width).toBeGreaterThan(COMPANION_TOY_VISUALS.dice.width);
  });
  it("keeps the actual contained silhouettes readable inside the native target", () => {
    const art = JSON.parse(readFileSync("art-src/빅타민/동행/작업회차/20261019-밝은장난감24종125/제작기록/공개자료/납품명세.json", "utf8")) as { assets: { id: CompanionToyKind; runtime: { size: [number, number] }; runtime_core_bbox: [number, number, number, number] }[] };
    expect(art.assets.map(asset => asset.id)).toEqual(COMPANION_TOY_KINDS);
    // The frozen asset bounds catch diagonal art shrinking inside a tall,
    // narrow box; checking only that box's height missed the tiny live toys.
    for (const asset of art.assets) {
      const visual = COMPANION_TOY_VISUALS[asset.id], [width, height] = asset.runtime.size, [left, top, right, bottom] = asset.runtime_core_bbox;
      const scale = Math.min(visual.width / width, visual.height / height);
      const paintWidth = (right - left) * scale, paintHeight = (bottom - top) * scale;
      expect(Math.max(paintWidth, paintHeight), asset.id).toBeGreaterThanOrEqual(asset.id === "dice" ? 21 : 26);
      expect(paintWidth * paintHeight, asset.id).toBeGreaterThanOrEqual(420);
      expect(width * scale, asset.id).toBeLessThanOrEqual(44);
      expect(height * scale, asset.id).toBeLessThanOrEqual(44);
    }
  });
  it("cycles every kind through actual capacity and physical pickup/removal without consuming failed spawn serials", () => {
    const model = createCompanionToys(() => 0), kinds: string[] = [];
    model.sync([{ id: "viewport-floor", x: 0, y: 600, width: 1000, kind: "floor" }], { width: 1000, height: 800 }, 0);
    for (let batch = 0; batch < 6; batch++) {
      const began = batch * 3000;
      for (let i = 0; i < MAX_COMPANION_TOYS; i++) expect(model.spawn({ x: 500, y: 400 }, began)).toBeTruthy();
      expect(model.spawn({ x: 500, y: 400 }, began)).toBeUndefined();
      for (let age = 16; age <= 1800; age += 16) model.tick(began + age);
      expect(model.available()).toHaveLength(4);
      for (const toy of model.available()) { kinds.push(toy.kind); expect(model.pick(toy.id, toy)).toBe(true); expect(model.stash(toy.id)).toBe(true); }
      expect(model.count()).toBe(0);
    }
    expect(kinds).toEqual(COMPANION_TOY_KINDS);
    expect(model.spawn({ x: 500, y: 400 }, 20000)).toBeTruthy(); expect(model.items()[0].kind).toBe("ball");
  });
  it("shuffles only successful take-outs, covers all24 before repeating and prevents an immediate refill repeat", () => {
    const rng = vi.fn().mockReturnValue(.999); for (let i = 0; i < 23; i++) rng.mockReturnValueOnce(0);
    const model = createCompanionToys(rng), kinds: CompanionToyKind[] = [];
    expect(model.spawn({ x: 500, y: 400 }, 0)).toBeUndefined(); expect(rng).not.toHaveBeenCalled();
    model.sync([{ id: "viewport-floor", x: 0, y: 600, width: 1000, kind: "floor" }], { width: 1000, height: 800 }, 0);
    for (let i = 0; i < 72; i++) {
      const id = model.spawn({ x: 500, y: 400 }, i)!; expect(id).toBe(`toy-${i + 1}`);
      kinds.push(model.items()[0].kind); expect(model.grab(id)).toBe(true); expect(model.returnHeld(id)).toBe(true);
    }
    for (let i = 0; i < 72; i += 24) expect(new Set(kinds.slice(i, i + 24))).toEqual(new Set(COMPANION_TOY_KINDS));
    expect(kinds.every((kind, i) => !i || kind !== kinds[i - 1])).toBe(true); expect(rng).toHaveBeenCalledTimes(69);
    const other = createCompanionToys(() => .999); other.sync([], { width: 1000, height: 800 }, 0); other.spawn({ x: 500, y: 400 }, 0);
    expect(other.items()[0].kind).not.toBe(kinds[0]);
  });
  it("retains every legacy discovery, acknowledgment and learned score without discovering the new sixteen", () => {
    const old = COMPANION_TOY_KINDS.slice(0, 8), snapshot = { version: 1, toys: old, seen: old.slice(0, 3), toyTastes: { feather: { accepted: 3, declined: 0, score: .6 } }, foodTastes: {} };
    const value = normalizeCompanionTastes(snapshot);
    expect(value.toys).toEqual(old); expect(value.seen).toEqual(old.slice(0, 3)); expect(value.toyTastes).toEqual(snapshot.toyTastes);
    expect(companionToyUnread(value)).toBe(5); expect(summarizeCompanionToyTastes(value)).toEqual({ favorite: "feather", disliked: null });
  });
  it("learns and acknowledges a late new kind only after actual experiences, while OFF still discovers without a score", () => {
    const store = createCompanionTastesStore();
    expect(store.acknowledge("toy-rocket")).toBe(false); expect(store.load().toys).toEqual([]);
    store.recordToy("toy-rocket", "taken-out"); expect(companionToyUnread(store.load())).toBe(1); expect(store.load().toyTastes).toEqual({});
    store.recordToy("toy-rocket", "played"); store.recordToy("toy-rocket", "played");
    expect(summarizeCompanionToyTastes(store.load()).favorite).toBe("toy-rocket");
    expect(store.acknowledge("toy-rocket")).toBe(true); expect(companionToyUnread(store.load())).toBe(0);
    store.recordToy("train", "played", false); expect(store.load().toys).toContain("train"); expect(store.load().toyTastes.train).toBeUndefined();
    for (let i = 0; i < 200; i++) store.recordToy("toy-rocket", "declined");
    expect(store.load().toyTastes["toy-rocket"]?.declined).toBe(0); expect(summarizeCompanionToyTastes(store.load()).disliked).toBeNull();
    for (let i = 0; i < 200; i++) store.recordToy("toy-rocket", "tripped");
    expect(store.load().toyTastes["toy-rocket"]?.tripped).toBe(31); expect(summarizeCompanionToyTastes(store.load()).disliked).toBe("toy-rocket");
    expect(store.load().seen).toEqual(["toy-rocket"]);
  });
  it("rejects unknown contents and keeps toy-specific identity out of fixed activity capture", () => {
    const value = normalizeCompanionTastes({ version: 1, toys: ["train", "private-canary"], seen: ["private-canary"], toyTastes: { train: { accepted: 2, score: .5 }, "private-canary": { accepted: 3, score: 1 } } });
    expect(value.toys).toEqual(["train"]); expect(value.seen).toEqual([]); expect(Object.keys(value.toyTastes)).toEqual(["train"]);
    for (const kind of COMPANION_TOY_KINDS) { expect(sanitizeTarget(`companion-collection-inspect#${kind}`)).toBe("companion-collection-inspect"); expect(sanitizeMeta({ toy: kind, width: 44 })).toBeNull(); }
    expect(sanitizeTarget("companion-collection-inspect#toy")).toBe("companion-collection-inspect#toy");
  });
});

describe("125 captured-pointer box target", () => {
  const box = { left: 100, right: 160, top: 200, bottom: 250 };
  it("uses the same inclusive eight-pixel edge tolerance before and on release", () => {
    for (const point of [{ x: 92, y: 200 }, { x: 168, y: 250 }, { x: 100, y: 192 }, { x: 160, y: 258 }]) expect(companionToyBoxDropReady(box, point)).toBe(true);
    for (const point of [{ x: 91.99, y: 200 }, { x: 168.01, y: 250 }, { x: 100, y: 191.99 }, { x: 160, y: 258.01 }]) expect(companionToyBoxDropReady(box, point)).toBe(false);
  });
  it("does not offer a collapsed, inverted or nonfinite native target", () => {
    for (const rect of [{ ...box, right: box.left }, { ...box, bottom: box.top }, { ...box, left: 200 }, { ...box, top: NaN }]) expect(companionToyBoxDropReady(rect, { x: 120, y: 220 })).toBe(false);
    expect(companionToyBoxDropReady(box, { x: NaN, y: 220 })).toBe(false);
  });
});

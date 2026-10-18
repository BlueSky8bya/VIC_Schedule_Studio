import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CompanionCollectionArt } from "@/components/poster/viewer-companion/companion-collection-art";
import { CompanionFruit } from "@/components/poster/viewer-companion/companion-fruit";
import { COMPANION_FOOD_KINDS, LEGACY_COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_COLLECTION_ATLASES, COMPANION_COLLECTION_FRAMES, getCompanionCollectionArtFrame } from "@/lib/ui/viewer-companion/collection-art";
import { COMPANION_BEHAVIOR_IDS } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_ACCESSORY_IDS } from "@/lib/ui/viewer-companion/gifts";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/accessory-catalog";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";

const V106_FOODS = ["apple", "lemon", "strawberry", "raspberry", "watermelon", "tomato", "grapefruit", "peach", "plum", "orange", "persimmon", "apricot", "pear", "banana", "grape", "cherry", "blueberry", "mango", "kiwi", "pineapple", "coconut", "fig", "dragon-fruit", "melon", "carrot", "cucumber", "broccoli", "pumpkin", "corn", "sweet-potato", "potato", "cabbage", "eggplant", "bell-pepper", "radish", "peas"] as const;
const V106_ACCESSORIES = ["sunglasses", "beret", "bow", "star-pin", "flower-crown", "satchel"] as const;

const directory = join(process.cwd(), "public/companion/food");
const manifest = JSON.parse(readFileSync(join(directory, "sources.json"), "utf8")) as {
  upstreamCommit: string; license: string;
  files: { kind: string; url: string; sha256: string }[];
  derivatives: Record<string, { basedOn: string; changes: string; replacesSha256?: string; previousRoundSha256?: string; previousOvalSha256?: string; originalBasisSha256?: string; reproduction?: string }>;
  delivered: { kind: string; sha256: string }[];
};

describe("local companion food vectors", () => {
  it("covers thirteen fruits with checked local SVG bytes and no external executable content", () => {
    expect(manifest.delivered.map(item => item.kind).sort()).toEqual([...LEGACY_COMPANION_FOOD_KINDS].sort());
    for (const item of manifest.delivered) {
      const svg = readFileSync(join(directory, `${item.kind}.svg`), "utf8");
      expect(createHash("sha256").update(svg).digest("hex")).toBe(item.sha256);
      expect(svg).toMatch(/viewBox="0 0 128 128"/);
      expect(svg).not.toMatch(/<script|<image|(?:xlink:)?href\s*=\s*["']https?:|\son\w+\s*=/i);
    }
  });
  it("distinguishes eight unchanged originals from five clearly marked derivatives", () => {
    expect(manifest.files).toHaveLength(8); expect(Object.keys(manifest.derivatives)).toHaveLength(5);
    for (const item of manifest.files) {
      expect(item.url).toContain(`/googlefonts/noto-emoji/${manifest.upstreamCommit}/2D/svg/`);
      expect(manifest.delivered.find(delivered => delivered.kind === item.kind)?.sha256).toBe(item.sha256);
    }
    for (const kind of Object.keys(manifest.derivatives)) expect(readFileSync(join(directory, `${kind}.svg`), "utf8")).toContain("Modified for VIC Schedule Studio");
  });
  it("redistributes the graphics license, upstream copyright and modification record", () => {
    expect(manifest.license).toBe("Apache-2.0");
    expect(readFileSync(join(directory, "LICENSE.txt"), "utf8")).toContain("Version 2.0, January 2004");
    expect(readFileSync(join(directory, "UPSTREAM_NOTICE.txt"), "utf8")).toContain("Copyright 2013 Google, Inc.");
    expect(readFileSync(join(directory, "SOURCES.md"), "utf8")).toContain("Five files are VIC Schedule Studio derivatives");
  });
  it("records the plum correction separately from its unchanged apple source", () => {
    const plum = manifest.derivatives.plum;
    expect(plum.replacesSha256).toBe("fa6913b2ec7de27b806e8e2d2708f9f6c4764c624e1ed668a994303072a2d234");
    expect(plum.previousRoundSha256).toBe("02176fce14522c20ba86fabd8e5edb581e233f8f908f32ef5a6bed8baf9772c2");
    expect(plum.previousOvalSha256).toBe("20f95f69573988fdc3dbb5a4b664ca9cbc16d389534367d3d5dbe63a09772851");
    expect(plum.originalBasisSha256).toBe(manifest.files.find(item => item.kind === "apple")?.sha256);
    expect(plum.changes).toContain("short bare stem");
    expect(plum.changes).toContain("No apple shoulder/waist or leaf");
    expect(plum.reproduction).toBe("node scripts/prepare-companion-plum.mjs --check");
    expect(manifest.delivered.find(item => item.kind === "plum")?.sha256).not.toBe(plum.replacesSha256);
    const svg = readFileSync(join(directory, "plum.svg"), "utf8");
    expect(svg).not.toContain("#986CC1"); expect(svg).not.toContain("#68468E");
    expect(svg).toContain("code-native red plum contour");
  });
});

describe("native106 paired food collection art", () => {
  it("preserves the protected36 food entries and their separate matching stamp atlas", () => {
    expect(COMPANION_FOOD_KINDS.slice(0, 36)).toEqual([...V106_FOODS]);
    expect(Object.keys(COMPANION_COLLECTION_FRAMES.food).slice(0, 36)).toEqual([...V106_FOODS]);
    expect(Object.keys(COMPANION_COLLECTION_FRAMES["food-stamp"]).slice(0, 36)).toEqual([...V106_FOODS]);
    for (const [index, kind] of V106_FOODS.entries()) {
      const food = getCompanionCollectionArtFrame("food", kind)!;
      const stamp = getCompanionCollectionArtFrame("food-stamp", kind)!;
      expect(food.index).toBe(index); expect(stamp.index).toBe(index);
      expect(food.src).toBe("/companion/collection/foods-106-v1.webp");
      expect(stamp.src).toBe("/companion/collection/food-stamps-106-v1.webp");
      expect(food.width).toBe(96); expect(stamp.width).toBe(128);
      expect(getCompanionCollectionArtFrame("food", kind)).toBe(food);
    }
    expect(getCompanionCollectionArtFrame("food", "unknown-food")).toBeUndefined();
  });

  it("ships checked lossless food/stamp atlases with transparent independent cell gutters", async () => {
    for (const kind of ["food", "food-stamp"] as const) {
      const atlas = COMPANION_COLLECTION_ATLASES[kind]!;
      const bytes = readFileSync(join(process.cwd(), "public", atlas.src));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(atlas.sha256);
      const image = sharp(bytes), metadata = await image.metadata();
      expect(metadata.width).toBe(atlas.cell * 8); expect(metadata.height).toBe(atlas.cell * 5); expect(metadata.hasAlpha).toBe(true);
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (const frame of Object.values(COMPANION_COLLECTION_FRAMES[kind]).filter(frame => frame.atlas === kind)) {
        expect(frame.content.width).toBeGreaterThan(20); expect(frame.content.height).toBeGreaterThan(20);
        expect(frame.content.x).toBeGreaterThanOrEqual(8); expect(frame.content.y).toBeGreaterThanOrEqual(8);
        expect(frame.content.x + frame.content.width).toBeLessThanOrEqual(frame.width - 8);
        expect(frame.content.y + frame.content.height).toBeLessThanOrEqual(frame.height - 8);
        for (let offset = 0; offset < atlas.cell; offset++) {
          for (const [x, y] of [[frame.x + offset, frame.y], [frame.x + offset, frame.y + atlas.cell - 1], [frame.x, frame.y + offset], [frame.x + atlas.cell - 1, frame.y + offset]]) {
            expect(data[(y * info.width + x) * 4 + 3]).toBe(0);
          }
        }
      }
    }
  });

  it("registers every observed behavior, four accessory views and six whole book/gift cells", async () => {
    expect(Object.keys(COMPANION_COLLECTION_FRAMES["behavior-stamp"])).toEqual([...COMPANION_BEHAVIOR_IDS]);
    const views = ["front", "quarter", "side", "back"] as const;
    expect(COMPANION_ACCESSORY_IDS.slice(0, 6)).toEqual([...V106_ACCESSORIES]);
    expect(Object.values(COMPANION_COLLECTION_FRAMES.accessory).filter(frame => frame.atlas === "accessory").map(frame => frame.id)).toEqual(views.flatMap(view => V106_ACCESSORIES.map(id => `${id}:${view}`)));
    for (const [row, view] of views.entries()) for (const [column, id] of V106_ACCESSORIES.entries()) {
      const frame = getCompanionCollectionArtFrame("accessory", id, view)!;
      expect(frame.id).toBe(`${id}:${view}`); expect(frame.x).toBe(column * 128); expect(frame.y).toBe(row * 128);
    }
    expect(Object.keys(COMPANION_COLLECTION_FRAMES.book)).toEqual(["book-closed", "book-open"]);
    expect(Object.keys(COMPANION_COLLECTION_FRAMES.gift)).toEqual(["gift-wrapped", "gift-open", "gift-bag", "discovery-seal"]);
    expect(getCompanionCollectionArtFrame("book")?.id).toBe("book-closed");
    expect(getCompanionCollectionArtFrame("gift")?.id).toBe("gift-wrapped");
    expect(getCompanionCollectionArtFrame("accessory", "missing")).toBeUndefined();
    for (const atlasId of ["behavior-stamp", "accessory", "book-gift"] as const) {
      const atlas = COMPANION_COLLECTION_ATLASES[atlasId]!;
      const bytes = readFileSync(join(process.cwd(), "public", atlas.src));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(atlas.sha256);
      expect(bytes.includes(Buffer.from("VP8L"))).toBe(true);
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(atlas.width); expect(info.height).toBe(atlas.height);
      const frames = Object.values(COMPANION_COLLECTION_FRAMES).flatMap(entries => Object.values(entries)).filter(frame => frame.atlas === atlasId);
      expect(frames).toHaveLength(atlas.columns * atlas.rows);
      for (const frame of frames) {
        expect(frame.content.width).toBeGreaterThan(10); expect(frame.content.height).toBeGreaterThan(10);
        for (let offset = 0; offset < atlas.cell; offset++) for (const [x, y] of [[frame.x + offset, frame.y], [frame.x + offset, frame.y + atlas.cell - 1], [frame.x, frame.y + offset], [frame.x + atlas.cell - 1, frame.y + offset]]) {
          expect(data[(y * info.width + x) * 4 + 3]).toBe(0);
        }
      }
    }
  });

  it("keeps all six native source hashes and attributes overlapping book/gift cutouts without losing alpha pixels", async () => {
    const receiptBytes = readFileSync(join(process.cwd(), "art-src/빅타민/수집/작업회차/20261018-도감과선물/정리본/패킹기록.json"));
    expect(createHash("sha256").update(receiptBytes).digest("hex")).toBe("c4788d426874b1209295ada280c02875858843307a52c3d042e28cce9865c423");
    const receipt = JSON.parse(receiptBytes.toString("utf8")) as {
      sources: { path: string; sha256: string; sourceBytesUnchanged: boolean; sourceNontransparentPixels?: number; copiedNontransparentPixels?: number }[];
      cells: { atlas: string; index: number; source: string; sourceIndex: number }[];
    };
    expect(receipt.sources).toHaveLength(6); expect(receipt.cells).toHaveLength(114);
    expect(new Set(receipt.cells.map(cell => `${cell.atlas}:${cell.index}`)).size).toBe(114);
    for (const source of receipt.sources) {
      const bytes = readFileSync(join(process.cwd(), source.path));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256); expect(source.sourceBytesUnchanged).toBe(true);
      expect(receipt.cells.some(cell => cell.source === source.path)).toBe(true);
      if (source.sourceNontransparentPixels !== undefined) {
        const { data } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        let visible = 0;
        for (let at = 3; at < data.length; at += 4) if (data[at] > 0) visible++;
        expect(source.sourceNontransparentPixels).toBe(visible); expect(source.copiedNontransparentPixels).toBe(visible);
      }
    }
    expect(receipt.sources.filter(source => source.copiedNontransparentPixels !== undefined)).toHaveLength(1);
  });
});

describe("code-native107 pixel sunglasses", () => {
  it("maps four original flat SVG views to the first column without copying the attached photograph", () => {
    for (const [row, [view, label]] of ([['front', '정면'], ['quarter', '사선'], ['side', '옆면'], ['back', '뒷면']] as const).entries()) {
      const svg = readFileSync(join(process.cwd(), `art-src/빅타민/수집/작업회차/20261018-먹거리와추억/원본/픽셀선글라스_${label}.svg`), "utf8");
      expect(svg).toContain('shape-rendering="crispEdges"'); expect(svg).toContain('viewBox="0 0 128 64"');
      expect(svg).not.toMatch(/<image|<filter|<script|href\s*=|rx\s*=|ry\s*=/i);
      const frame = getCompanionCollectionArtFrame("accessory", "pixel-sunglasses", view)!;
      expect(frame.src).toBe("/companion/collection/accessories-107-v1.webp"); expect(frame.x).toBe(0); expect(frame.y).toBe(row * 128);
      expect(getCompanionCollectionArtFrame("accessory", "pixel-sunglasses", view)).toBe(frame);
    }
  });

  it("keeps pixel edges exactly black/white with transparent independent gutters", async () => {
    const atlas = COMPANION_COLLECTION_ATLASES["accessory-107"]!;
    const { data, info } = await sharp(readFileSync(join(process.cwd(), "public", atlas.src))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let black = 0, white = 0;
    for (let row = 0; row < 4; row++) for (let y = row * 128; y < (row + 1) * 128; y++) for (let x = 0; x < 128; x++) {
      const at = (y * info.width + x) * 4;
      if (data[at + 3] === 0) continue;
      expect(data[at + 3]).toBe(255); expect([0, 255]).toContain(data[at]);
      expect(data[at + 1]).toBe(data[at]); expect(data[at + 2]).toBe(data[at]);
      if (data[at] === 0) black++; else white++;
      expect(x).toBeGreaterThanOrEqual(8); expect(x).toBeLessThanOrEqual(119);
      expect(y % 128).toBeGreaterThanOrEqual(8); expect(y % 128).toBeLessThanOrEqual(119);
    }
    expect(black).toBeGreaterThan(1000); expect(white).toBeGreaterThan(100);
  });
});

describe("additive107 native collection assets", () => {
  it("preserves four native PNGs and four authored SVGs in an84-cell source receipt", async () => {
    const receiptBytes = readFileSync(join(process.cwd(), "art-src/빅타민/수집/작업회차/20261018-먹거리와추억/정리본/패킹기록.json"));
    expect(createHash("sha256").update(receiptBytes).digest("hex")).toBe("afa505cbddb19e0882428bbcae4f51fe28bb1be7ab18a09dc10cf4a30c404ef7");
    const receipt = JSON.parse(receiptBytes.toString("utf8")) as {
      sources: { path: string; sha256: string; sourceBytesUnchanged: boolean; format?: string; columns?: number; rows?: number }[];
      cells: { atlas: string; index: number; source: string; sourceIndex: number }[];
    };
    expect(receipt.sources).toHaveLength(8); expect(receipt.cells).toHaveLength(84);
    expect(new Set(receipt.cells.map(cell => `${cell.atlas}:${cell.index}`)).size).toBe(84);
    expect(receipt.sources.filter(source => source.format === "svg")).toHaveLength(4);
    for (const source of receipt.sources) {
      const bytes = readFileSync(join(process.cwd(), source.path));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256); expect(source.sourceBytesUnchanged).toBe(true);
      const used = receipt.cells.filter(cell => cell.source === source.path);
      expect(used).toHaveLength(source.format === "svg" ? 1 : source.columns! * source.rows!);
      expect(new Set(used.map(cell => cell.sourceIndex)).size).toBe(used.length);
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(info.channels).toBe(4);
      let transparent = 0, opaque = 0;
      for (let at = 3; at < data.length; at += 4) { if (data[at] === 0) transparent++; if (data[at] > 160) opaque++; }
      expect(transparent).toBeGreaterThan(0); expect(opaque).toBeGreaterThan(200);
    }
  });

  it("keeps requested food order while mapping the actual native waffle pair from the final source cell", () => {
    const run = join(process.cwd(), "art-src/빅타민/수집/작업회차/20261018-먹거리와추억");
    const request = JSON.parse(readFileSync(join(run, "먹거리4요청.json"), "utf8")) as { requestedFoodIds: string[]; observedCellFoodIds: string[]; orderedFoodIds: string[] };
    expect(request.requestedFoodIds).toEqual(COMPANION_FOOD_KINDS.slice(36, 48));
    expect(request.observedCellFoodIds).toEqual(["bread", "croissant", "baguette", "bagel", "pretzel", "sandwich", "toast", "pancake", "doughnut", "muffin", "cupcake", "waffle"]);
    expect(request.orderedFoodIds).toEqual(request.observedCellFoodIds);
    const receipt = JSON.parse(readFileSync(join(run, "정리본/패킹기록.json"), "utf8")) as { cells: { atlas: string; id: string; index: number; sourceIndex: number }[] };
    for (const [id, target, source] of [["waffle", 8, 22], ["doughnut", 9, 16], ["muffin", 10, 18], ["cupcake", 11, 20]] as const) {
      expect(receipt.cells.find(cell => cell.atlas === "food-107" && cell.id === id)).toMatchObject({ index: target, sourceIndex: source });
      expect(receipt.cells.find(cell => cell.atlas === "food-stamp-107" && cell.id === id)).toMatchObject({ index: target, sourceIndex: source + 1 });
    }
  });

  it("preserves60 native pairs among180 foods, legacy12 accessory views and12 situation stamps alongside27 active accessories", () => {
    expect(COMPANION_FOOD_KINDS).toHaveLength(180); expect(COMPANION_ACCESSORY_IDS).toHaveLength(39); expect(COMPANION_WEARABLE_IDS).toHaveLength(27);
    expect(Object.keys(COMPANION_COLLECTION_FRAMES.food)).toEqual([...COMPANION_FOOD_KINDS]);
    expect(Object.keys(COMPANION_COLLECTION_FRAMES["food-stamp"])).toEqual([...COMPANION_FOOD_KINDS]);
    expect(Object.keys(COMPANION_COLLECTION_FRAMES["situation-stamp"])).toEqual([...COMPANION_SITUATION_IDS]);
    expect(Object.keys(COMPANION_COLLECTION_FRAMES["behavior-stamp"])).toEqual([...COMPANION_BEHAVIOR_IDS]);
    for (const [index, id] of COMPANION_FOOD_KINDS.slice(36, 60).entries()) {
      const food = getCompanionCollectionArtFrame("food", id)!, stamp = getCompanionCollectionArtFrame("food-stamp", id)!;
      expect(stamp.index).toBe(index); expect(stamp.src).toBe("/companion/collection/food-stamps-107-v1.webp");
      // The108 owner request replaces only the live rice-ball drawing. The
      // complete original107 atlas and source receipt remain checked below.
      expect(food.index).toBe(id === "rice-ball" ? 0 : index);
      expect(food.src).toBe(id === "rice-ball" ? "/companion/collection/rice-ball-108-v1.webp" : "/companion/collection/foods-107-v1.webp");
    }
    for (const [row, view] of (["front", "quarter", "side", "back"] as const).entries()) for (const [column, id] of COMPANION_ACCESSORY_IDS.slice(6, 12).entries()) {
      const frame = getCompanionCollectionArtFrame("accessory", id, view)!;
      expect(frame.atlas).toBe("accessory-107"); expect(frame.x).toBe(column * 128); expect(frame.y).toBe(row * 128);
    }
    expect(getCompanionCollectionArtFrame("situation-stamp", "unknown-moment")).toBeUndefined();
  });

  it("ships the four independently checked107 atlases with complete transparent cell gutters", async () => {
    const receipt = JSON.parse(readFileSync(join(process.cwd(), "art-src/빅타민/수집/작업회차/20261018-먹거리와추억/정리본/패킹기록.json"), "utf8")) as { cells: { atlas: string; x: number; y: number; content: { width: number; height: number } }[] };
    for (const [id, count] of [["food-107", 24], ["food-stamp-107", 24], ["accessory-107", 24], ["situation-stamp", 12]] as const) {
      const atlas = COMPANION_COLLECTION_ATLASES[id]!;
      const bytes = readFileSync(join(process.cwd(), "public", atlas.src));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(atlas.sha256); expect(bytes.includes(Buffer.from("VP8L"))).toBe(true);
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(atlas.cell * atlas.columns); expect(info.height).toBe(atlas.cell * atlas.rows);
      const frames = receipt.cells.filter(frame => frame.atlas === id);
      expect(frames).toHaveLength(count);
      for (const frame of frames) {
        expect(frame.content.width).toBeGreaterThan(10); expect(frame.content.height).toBeGreaterThan(10);
        for (let offset = 0; offset < atlas.cell; offset++) for (const [x, y] of [[frame.x + offset, frame.y], [frame.x + offset, frame.y + atlas.cell - 1], [frame.x, frame.y + offset], [frame.x + atlas.cell - 1, frame.y + offset]]) expect(data[(y * info.width + x) * 4 + 3]).toBe(0);
      }
    }
  });
});

describe("same-source108 food stamps", () => {
  beforeEach(() => vi.stubGlobal("React", React));
  afterEach(() => vi.unstubAllGlobals());
  it("renders all180 stamps from the exact live food crop with square meet geometry and no independently drawn stamp food", () => {
    for (const id of COMPANION_FOOD_KINDS) {
      const frame = getCompanionCollectionArtFrame("food", id)!;
      const stamp = renderToStaticMarkup(createElement(CompanionCollectionArt, { kind: "food-stamp", id }));
      const live = renderToStaticMarkup(createElement(CompanionFruit, { kind: id }));
      expect(frame.width).toBe(frame.height);
      expect(stamp).toContain('data-collection-art="food-stamp"'); expect(stamp).toContain('viewBox="0 0 128 128"');
      expect(stamp).toContain(`x="16" y="16" width="96" height="96" viewBox="${frame.x} ${frame.y} ${frame.width} ${frame.height}" preserveAspectRatio="xMidYMid meet"`);
      expect(stamp.match(/<image\s[^>]*>/g)).toEqual(live.match(/<image\s[^>]*>/g));
      expect(stamp).not.toContain("food-stamps-"); expect(stamp).not.toMatch(/scale\(|preserveAspectRatio="none"/);
    }
    expect(renderToStaticMarkup(createElement(CompanionCollectionArt, { kind: "food-stamp", id: "unknown-food" }))).toBe("");
  });

  it("registers one explicit packaged rice-ball replacement while retaining its stable collection ID and previous sources", async () => {
    const frame = getCompanionCollectionArtFrame("food", "rice-ball")!;
    expect(frame.atlas).toBe("food-108"); expect(frame.index).toBe(0);
    expect(COMPANION_FOOD_KINDS.filter(id => id === "rice-ball")).toHaveLength(1);
    const receipt = JSON.parse(readFileSync(join(process.cwd(), "art-src/빅타민/수집/작업회차/20261018-먹거리일치와삼각김밥/정리본/패킹기록.json"), "utf8")) as { sources: { path: string; sha256: string; sourceBytesUnchanged: boolean }[]; cells: { id: string; atlas: string }[]; overrides: { kind: string; id: string; previousAtlas: string; atlas: string }[] };
    expect(receipt.sources).toHaveLength(1); expect(receipt.cells).toHaveLength(1);
    expect(receipt.cells[0]).toMatchObject({ id: "rice-ball", atlas: "food-108" });
    expect(receipt.overrides).toHaveLength(1); expect(receipt.overrides[0]).toMatchObject({ kind: "food", id: "rice-ball", previousAtlas: "food-107", atlas: "food-108" });
    const source = receipt.sources[0], bytes = readFileSync(join(process.cwd(), source.path));
    expect(source.sha256).toBe("f45788da7beba1517ae81c1ed72181b7989482a7e76fbe376ef20b7ee50116c1");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sha256); expect(source.sourceBytesUnchanged).toBe(true);
    const atlas = COMPANION_COLLECTION_ATLASES["food-108"]!, packed = readFileSync(join(process.cwd(), "public", atlas.src));
    expect(createHash("sha256").update(packed).digest("hex")).toBe(atlas.sha256);
    const info = await sharp(packed).metadata(); expect(info.width).toBe(96); expect(info.height).toBe(96); expect(info.hasAlpha).toBe(true);
    const rgba = await sharp(packed).ensureAlpha().raw().toBuffer();
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) if (x < 8 || x >= 88 || y < 8 || y >= 88) expect(rgba[(y * 96 + x) * 4 + 3]).toBe(0);
    expect(getCompanionCollectionArtFrame("food-stamp", "rice-ball")?.src).toBe("/companion/collection/food-stamps-107-v1.webp");
  });
});

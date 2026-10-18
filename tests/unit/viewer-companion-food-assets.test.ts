import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { COMPANION_FOOD_KINDS, LEGACY_COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_COLLECTION_ATLASES, COMPANION_COLLECTION_FRAMES, getCompanionCollectionArtFrame } from "@/lib/ui/viewer-companion/collection-art";
import { COMPANION_BEHAVIOR_IDS } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_ACCESSORY_IDS } from "@/lib/ui/viewer-companion/gifts";

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
  it("maps every actual food to a separate food-only atlas and its matching stamp", () => {
    expect(Object.keys(COMPANION_COLLECTION_FRAMES.food)).toEqual([...COMPANION_FOOD_KINDS]);
    expect(Object.keys(COMPANION_COLLECTION_FRAMES["food-stamp"])).toEqual([...COMPANION_FOOD_KINDS]);
    for (const [index, kind] of COMPANION_FOOD_KINDS.entries()) {
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
      for (const frame of Object.values(COMPANION_COLLECTION_FRAMES[kind])) {
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
    expect(Object.keys(COMPANION_COLLECTION_FRAMES.accessory)).toEqual(views.flatMap(view => COMPANION_ACCESSORY_IDS.map(id => `${id}:${view}`)));
    for (const [row, view] of views.entries()) for (const [column, id] of COMPANION_ACCESSORY_IDS.entries()) {
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
    const receipt = JSON.parse(readFileSync(join(process.cwd(), "art-src/빅타민/수집/작업회차/20261018-도감과선물/정리본/패킹기록.json"), "utf8")) as {
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

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionFruit } from "@/components/poster/viewer-companion/companion-fruit";
import { CompanionCollectionArt } from "@/components/poster/viewer-companion/companion-collection-art";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_SNACK_EXPANSION } from "@/lib/ui/viewer-companion/snack-expansion";
import { COMPANION_COLLECTION_ATLASES, getCompanionCollectionArtFrame } from "@/lib/ui/viewer-companion/collection-art";

const run = join(process.cwd(), "art-src/빅타민/수집/작업회차/20261018-간식백스무종");
const digest = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
type Receipt = { sources: { path: string; sha256: string; columns: number; rows: number; sourceBytesUnchanged: boolean; sourceNontransparentPixels?: number; copiedNontransparentPixels?: number }[]; cells: { id: string; source: string; sourceIndex: number; width: number; height: number; alphaTrim: { width: number; height: number }; resized: { width: number; height: number } }[] };
const receipt = JSON.parse(readFileSync(join(run, "정리본/패킹기록.json"), "utf8")) as Receipt;

describe("additive109 small-food delivery", () => {
  beforeEach(() => vi.stubGlobal("React", React));
  afterEach(() => vi.unstubAllGlobals());
  it("maps exactly120 distinct new observed native cells without altering the existing60 IDs", () => {
    expect(COMPANION_SNACK_EXPANSION).toHaveLength(120);
    const ids = COMPANION_SNACK_EXPANSION.map(item => item.id);
    expect(COMPANION_FOOD_KINDS.slice(60, 180)).toEqual(ids);
    expect(receipt.cells.map(item => item.id)).toEqual(ids);
    expect(new Set(receipt.cells.map(item => `${item.source}:${item.sourceIndex}`)).size).toBe(120);
    expect(receipt.sources).toHaveLength(6);
    for (const source of receipt.sources) {
      expect(digest(readFileSync(join(process.cwd(), source.path)))).toBe(source.sha256);
      expect(source.sourceBytesUnchanged).toBe(true); expect(source.columns * source.rows).toBe(20);
      if (source.sourceNontransparentPixels !== undefined) expect(source.copiedNontransparentPixels).toBe(source.sourceNontransparentPixels);
    }
    for (const cell of receipt.cells) {
      expect(cell.width).toBe(80); expect(cell.height).toBe(80);
      expect(Math.max(cell.resized.width, cell.resized.height)).toBe(64);
      expect(Math.abs(cell.resized.width / cell.alphaTrim.width - cell.resized.height / cell.alphaTrim.height)).toBeLessThanOrEqual(1 / Math.min(cell.alphaTrim.width, cell.alphaTrim.height));
      const food = getCompanionCollectionArtFrame("food", cell.id)!, seal = getCompanionCollectionArtFrame("food-stamp", cell.id)!;
      expect({ ...seal }).toEqual({ ...food });
    }
  });

  it("keeps six compact80px atlases under300KB with real transparent gutters", async () => {
    let total = 0, decodedBytes = 0;
    for (let index = 1; index <= 6; index++) {
      const atlas = COMPANION_COLLECTION_ATLASES[`food-109-${index}` as "food-109-1"]!;
      expect(atlas).toBeDefined(); expect(atlas.cell).toBe(80); expect(atlas.columns).toBe(5); expect(atlas.rows).toBe(4);
      const bytes = readFileSync(join(process.cwd(), "public", atlas.src)); total += bytes.length;
      expect(digest(bytes)).toBe(atlas.sha256);
      const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect(info.width).toBe(400); expect(info.height).toBe(320); decodedBytes += data.length;
      for (let row = 0; row < 4; row++) for (let column = 0; column < 5; column++) for (let edge = 0; edge < 80; edge++) {
        for (const [x, y] of [[column * 80 + edge, row * 80], [column * 80 + edge, row * 80 + 79], [column * 80, row * 80 + edge], [column * 80 + 79, row * 80 + edge]]) expect(data[(y * info.width + x) * 4 + 3]).toBe(0);
      }
    }
    expect(total).toBeLessThan(300_000); expect(decodedBytes).toBe(3_072_000);
  });

  it("renders every new food/seal from the same actual SVG source and optionally exports inspection sheets", async () => {
    const tiles: { input: Buffer; left: number; top: number }[][] = Array.from({ length: 6 }, () => []);
    const dataUrls = new Map<string, string>();
    const exportSheets = process.env.COMPANION_FOOD_CONTACTS === "1";
    for (const [index, item] of COMPANION_SNACK_EXPANSION.entries()) {
      const live = renderToStaticMarkup(React.createElement(CompanionFruit, { kind: item.id }));
      const stamp = renderToStaticMarkup(React.createElement(CompanionCollectionArt, { kind: "food-stamp", id: item.id }));
      const specimen=stamp.match(/<span class="vc-collection-seal-picture">([\s\S]+?)<\/span>/)?.[1];
      expect(specimen).toBeDefined();
      expect(live.match(/<image\s[^>]*>/g)).toEqual(specimen!.match(/<image\s[^>]*>/g));
      expect(stamp).toContain('preserveAspectRatio="xMidYMid meet"');
      if (!exportSheets) continue;
      const frame = getCompanionCollectionArtFrame("food", item.id)!;
      // librsvg cannot decode an embedded WebP reliably. This inspection-only
      // PNG conversion preserves the actual delivered decoded RGBA exactly.
      if (!dataUrls.has(frame.src)) dataUrls.set(frame.src, `data:image/png;base64,${(await sharp(readFileSync(join(process.cwd(), "public", frame.src))).png().toBuffer()).toString("base64")}`);
      const dataUrl = dataUrls.get(frame.src)!;
      const embed = (svg: string) => Buffer.from(svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" ').replaceAll(frame.src, dataUrl));
      const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="176" height="22"><text x="88" y="15" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#4c392b">${item.id}</text></svg>`);
      const x = index % 20 % 5 * 176, y = Math.floor(index % 20 / 5) * 110;
      const livePng = await sharp(embed(live)).png().toBuffer();
      const actual = await sharp(livePng).stats(); expect(actual.channels[3].max).toBeGreaterThan(16);
      tiles[Math.floor(index / 20)].push({ input: livePng, left: x + 4, top: y + 3 }, { input: await sharp(embed(stamp)).png().toBuffer(), left: x + 90, top: y + 3 }, { input: label, left: x, top: y + 83 });
    }
    if (exportSheets) {
      const directory = join(process.cwd(), ".scratch-pw/companion-109/food-pairs"); mkdirSync(directory, { recursive: true });
      for (const [index, images] of tiles.entries()) writeFileSync(join(directory, `foods-${index + 1}.png`), await sharp({ create: { width: 880, height: 440, channels: 4, background: "#fff7e9" } }).composite(images).png().toBuffer());
    }
  });
});

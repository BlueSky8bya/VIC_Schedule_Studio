import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { COMPANION_ACCESSORIES, COMPANION_WEARABLE_IDS, currentCompanionAccessory } from "@/lib/ui/viewer-companion/accessory-catalog";
import { companionAccessoryPlacement, companionCarryAnchor } from "@/lib/ui/viewer-companion/accessory";
import { normalizeCompanionGifts, companionGiftChance } from "@/lib/ui/viewer-companion/gifts";
import { createCompanionCollectionStore, getCompanionUnreadCounts, normalizeCompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import anchors from "@/lib/ui/viewer-companion/accessory-anchors.json";

const masks = ["sleep-mask-smile", "sleep-mask-drowsy", "sleep-mask-wide", "sleep-mask-tori"] as const;
const retired = ["eyepatch", "star-patch", "cat-eye-glasses"] as const;
const folder = "art-src/빅타민/동행/작업회차/20261018-수면안대115";
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

describe("printed sleep masks115", () => {
  it("carries from each adopted source-bound body point, including walking/jumping without inventing an eating mouth", () => {
    for (const pose of anchors.frames) {
      const selected = selectCompanionSprite(pose.physicalIndex);
      expect(companionCarryAnchor(selected), `carry ${pose.physicalIndex}`).toEqual(pose.chest);
      expect(companionCarryAnchor({ ...selected, src: "/another-body.webp" })).toBeNull();
      expect(companionCarryAnchor({ ...selected, index: selected.index + 16 })).toBeNull();
    }
    expect(companionCarryAnchor({ ...selectCompanionSprite(0), physicalIndex: -1 })).toBeNull();
    for (const index of [32, 40, 64, 80, 304]) expect(companionCarryAnchor(selectCompanionSprite(index))).not.toBeNull();
  });
  it("makes all four masks opaque over both measured eyes, including rolled and quarter poses; rear views stay behind the body", () => {
    for (const pose of anchors.frames) for (const id of masks) {
      const placed = companionAccessoryPlacement(selectCompanionSprite(pose.physicalIndex), id)!;
      expect(placed).not.toBeNull();
      if (pose.orientation === "back") { expect(placed.layer).toBe("back"); continue; }
      expect(pose.eyes).toHaveLength(2); expect(placed.layer).toBe("front");
      const angle = placed.rotation * Math.PI / 180, scale = placed.width / placed.art.content.width;
      for (const eye of pose.eyes) for (const x of [eye.bounds[0], eye.bounds[2]]) for (const y of [eye.bounds[1], eye.bounds[3]]) {
        const dx = x - placed.x, dy = y - placed.y;
        const u = (dx * Math.cos(angle) + dy * Math.sin(angle)) / (scale * placed.art.viewScale!);
        const v = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / scale;
        // The shared authored opaque core is x24..104,y52..76. Neither a
        // transparent print nor the bridge can expose either original eye.
        expect(Math.abs(u), `${id}:${pose.physicalIndex} eye X`).toBeLessThan(40);
        expect(Math.abs(v), `${id}:${pose.physicalIndex} eye Y`).toBeLessThan(12);
      }
    }
  });

  it("preserves exact original eye RGB and embeds one authorized print, reused by all four views with no remote or executable references", async () => {
    const receipt = JSON.parse(readFileSync(`${folder}/원본프린트_출처기록.json`, "utf8"));
    const source = readFileSync(receipt.source.path), print = readFileSync(receipt.print.path);
    expect(hash(source)).toBe("4ef27d4b570013701f34d7db0e55628b29defc1b8cd548ecbfb6bb9d76f3f87e");
    expect(hash(print)).toBe(receipt.print.sha256); expect(receipt.bodyArtworkChanged).toBe(false); expect(receipt.imagegenCalls).toBe(0);
    const native = await sharp(source).extract(receipt.crop).ensureAlpha().raw().toBuffer();
    const clipped = await sharp(print).ensureAlpha().raw().toBuffer();
    expect(clipped.length).toBe(native.length);
    let visible = 0, removed = 0;
    for (let i = 0; i < native.length; i += 4) {
      expect(clipped.subarray(i, i + 3).equals(native.subarray(i, i + 3))).toBe(true);
      if (clipped[i + 3]) visible++; else removed++;
    }
    expect(visible).toBeGreaterThan(10000); expect(removed).toBeGreaterThan(10000);
    const svg = readFileSync("public/companion/collection/accessories-115-v1.svg", "utf8");
    expect(svg.match(/<image\b/g)).toHaveLength(1); expect(svg.match(/<use href="#tori-eye-print"/g)).toHaveLength(4);
    expect(svg).not.toMatch(/<(?:script|foreignObject)\b|(?:href|src)="(?:https?:|file:|javascript:)|onload=/i);
    expect(svg.match(/href="data:image\/png;base64,([^"]+)"/)?.[1]).toBe(print.toString("base64"));
    expect(execFileSync(process.execPath, ["scripts/prepare-companion-sleep-mask-print.mjs", "--check"], { encoding: "utf8" })).toContain("source RGB preserved; imagegen0");
  });

  it("makes the literal Tori mask the lowest weighted unowned gift, without changing the eligible five-minute gift chance", () => {
    const rare = COMPANION_ACCESSORIES["sleep-mask-tori"].weight;
    expect(rare).toBe(.01);
    for (const id of COMPANION_WEARABLE_IDS.filter(id => id !== "sleep-mask-tori")) expect(COMPANION_ACCESSORIES[id].weight).toBeGreaterThan(rare);
    expect(companionGiftChance(0)).toBe(.0005); expect(companionGiftChance(1)).toBeCloseTo(.007, 10);
  });

  it("maps retired fittings only to ordinary equivalents, preserving earned/unread history and never freely granting the Tori print", () => {
    for (const id of retired) {
      const mapped = currentCompanionAccessory(id);
      expect(COMPANION_WEARABLE_IDS).not.toContain(id); expect(COMPANION_ACCESSORIES[id].weight).toBe(0);
      expect(["sleep-mask-smile", "sleep-mask-drowsy", "square-glasses"]).toContain(mapped);
      const base = { version: 1, gifts: { unlocked: [id], equipped: id }, seen: { accessories: [id] } };
      const normalized = normalizeCompanionCollection(base);
      expect(normalized.gifts.unlocked).toEqual(expect.arrayContaining([id, mapped])); expect(normalized.gifts.equipped).toBe(mapped);
      expect(normalized.gifts.unlocked).not.toContain("sleep-mask-tori"); expect(getCompanionUnreadCounts(normalized).accessories).toBe(0);
      expect(getCompanionUnreadCounts(normalizeCompanionCollection({ ...base, seen: { accessories: [] } })).accessories).toBe(1);
      expect(normalizeCompanionCollection(normalized)).toEqual(normalized);
      const ordinary = COMPANION_WEARABLE_IDS.filter(item => COMPANION_ACCESSORIES[item].weight >= 5);
      const pending = normalizeCompanionGifts({ unlocked: ordinary, pending: id });
      expect(pending.pending).toBe(id); expect(pending.unlocked).not.toContain("sleep-mask-tori");
      let raw = JSON.stringify({ version: 1, gifts: pending });
      const store = createCompanionCollectionStore({ getItem: () => raw, setItem: (_key, value) => { raw = value; } });
      expect(store.openGift()).toBe(mapped); expect(store.load().gifts.pending).toBeNull();
      expect(store.load().gifts.unlocked).not.toContain("sleep-mask-tori"); expect(getCompanionUnreadCounts(store.load()).accessories).toBe(0);
    }
  });
});

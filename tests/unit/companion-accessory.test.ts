import { describe, expect, it } from "vitest";
import { companionAccessoryPlacement, companionGiftAnchor, createCompanionAccessoryPainter } from "@/lib/ui/viewer-companion/accessory";
import { COMPANION_ACCESSORY_IDS } from "@/lib/ui/viewer-companion/gifts";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";

describe("adopted pose wardrobe", () => {
  it("maps every current physical frame to each owned accessory and actual gift anchor", () => {
    expect(companionSpriteMetadata.frames).toHaveLength(520);
    for (let index = 0; index < companionSpriteMetadata.frames.length; index++) {
      const selected = selectCompanionSprite(index), gift = companionGiftAnchor(selected);
      expect(gift, `gift ${index}`).not.toBeNull();
      for (const id of COMPANION_ACCESSORY_IDS) {
        const placed = companionAccessoryPlacement(selected, id);
        expect(placed, `${index}:${id}`).not.toBeNull();
        expect(placed!.art.id).toMatch(new RegExp(`^${id}:`));
        expect([placed!.x, placed!.y, placed!.width, placed!.rotation].every(Number.isFinite)).toBe(true);
        expect(placed!.width).toBeGreaterThan(0);
        expect(placed!.width).toBeLessThan(80);
      }
    }
  });
  it("fails closed for a different decoded source/cell instead of using requested-row anchors", () => {
    const adopted = selectCompanionSprite(16);
    for (const changed of [{ ...adopted, src: "/different.webp" }, { ...adopted, index: adopted.index + 100 }, { ...adopted, physicalIndex: -1 }]) {
      expect(companionAccessoryPlacement(changed, "sunglasses")).toBeNull();
      expect(companionGiftAnchor(changed)).toBeNull();
    }
  });
  it("keeps headwear recognizable at the actual92px idle size", () => {
    for (const index of [0, 6, 32]) for (const id of ["beret", "flower-crown"] as const) {
      const placed = companionAccessoryPlacement(selectCompanionSprite(index), id)!;
      const renderedWidth = placed.width * 92 / 80;
      expect(renderedWidth).toBeGreaterThanOrEqual(24);
      expect(renderedWidth).toBeLessThan(40);
      expect(placed.layer).toBe("headwear");
    }
  });
  it("rear views occlude face/chest belongings instead of inventing a face on the back", () => {
    const rear = selectCompanionSprite(326);
    expect(companionAccessoryPlacement(rear, "sunglasses")?.layer).toBe("back");
    expect(companionAccessoryPlacement(rear, "bow")?.layer).toBe("back");
    expect(companionAccessoryPlacement(rear, "star-pin")?.layer).toBe("back");
    expect(companionGiftAnchor(rear)?.behind).toBe(true);
  });
  it("permanent ownership does not imply an image request; unchanged held poses do no repeated CSS writes", () => {
    const calls: Array<[string, string]> = [];
    const host = () => ({ hidden: true, style: { setProperty: (key: string, value: string) => { calls.push([key, value]); } } }) as unknown as HTMLElement;
    const back = host(), front = host(), gift = host(), painter = createCompanionAccessoryPainter({ back, front, gift });
    const selected = selectCompanionSprite(16);
    painter.paint(selected, null, false);
    expect(calls).toEqual([]);
    painter.paint(selected, "sunglasses", false);
    expect(front.hidden).toBe(false); expect(back.hidden).toBe(true); expect(gift.hidden).toBe(true);
    const count = calls.length;
    for (let frame = 0; frame < 120; frame++) painter.paint(selected, "sunglasses", false);
    expect(calls).toHaveLength(count);
    painter.paint(selected, "beret", false);
    expect(back.hidden).toBe(true); expect(front.hidden).toBe(false);
    expect(calls.filter(([key]) => key === "clip-path").at(-1)).toEqual(["clip-path", "none"]);
    painter.paint(selected, null, true);
    expect(front.hidden).toBe(true); expect(gift.hidden).toBe(false);
    painter.clear(); expect([back.hidden, front.hidden, gift.hidden]).toEqual([true, true, true]);
  });
});

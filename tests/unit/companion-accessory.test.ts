import { describe, expect, it } from "vitest";
import { companionAccessoryPlacement, companionGiftAnchor, createCompanionAccessoryPainter } from "@/lib/ui/viewer-companion/accessory";
import { COMPANION_ACCESSORY_IDS } from "@/lib/ui/viewer-companion/gifts";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import anchors from "@/lib/ui/viewer-companion/accessory-anchors.json";
import mouths from "@/lib/ui/viewer-companion/mouth-anchors.json";
import { sampleCompanionAccessoryMotion } from "@/lib/ui/viewer-companion/accessory-motion";

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
    expect(companionAccessoryPlacement(rear, "pixel-sunglasses")?.layer).toBe("back");
    expect(companionAccessoryPlacement(rear, "scarf")?.layer).toBe("back");
    expect(companionAccessoryPlacement(rear, "bell-pendant")?.layer).toBe("back");
    expect(companionAccessoryPlacement(rear, "bow")?.layer).toBe("back");
    expect(companionAccessoryPlacement(rear, "star-pin")?.layer).toBe("back");
    expect(companionGiftAnchor(rear)?.behind).toBe(true);
  });
  it("aligns both authored quarter directions before the shared travel mirror, rather than flipping every atlas alike", () => {
    // Actual native running faces right; the recovery/look-left sources face
    // left. Source106 eyewear/headwear and source107 cap art have opposite yaw.
    for (const index of [304, 320, 323, 331, 336, 500]) {
      expect(companionAccessoryPlacement(selectCompanionSprite(index), "sunglasses")?.mirror, `run ${index}`).toBe(-1);
      expect(companionAccessoryPlacement(selectCompanionSprite(index), "baseball-cap")?.mirror, `cap ${index}`).toBe(1);
    }
    for (const index of [404, 412, 464]) {
      expect(companionAccessoryPlacement(selectCompanionSprite(index), "sunglasses")?.mirror, `left ${index}`).toBe(1);
      expect(companionAccessoryPlacement(selectCompanionSprite(index), "baseball-cap")?.mirror, `cap left ${index}`).toBe(-1);
    }
    for (const id of COMPANION_ACCESSORY_IDS) expect(companionAccessoryPlacement(selectCompanionSprite(0), id)?.mirror).toBe(1);
  });
  it("registers quarter lenses to the eyes instead of the open temple bounds, and shares the native pose roll", () => {
    for (const index of [304, 323, 404, 464, 500]) {
      const placed = companionAccessoryPlacement(selectCompanionSprite(index), "sunglasses")!;
      expect(placed.pivot).toEqual({ x: 49, y: 68 });
      expect(placed.rotation + 12.5 * placed.mirror!).toBeCloseTo(anchors.frames[index].face.roll);
      const moving = companionAccessoryPlacement(selectCompanionSprite(index), "sunglasses", { lift: 8, shift: 0, roll: 0, scale: 1 })!;
      const radians = anchors.frames[index].face.roll * Math.PI / 180;
      expect(moving.x - placed.x).toBeCloseTo(Math.sin(radians) * 8);
      expect(moving.y - placed.y).toBeCloseTo(-Math.cos(radians) * 8);
    }
  });
  it("puts the far open temple and satchel shoulder strap behind the adopted body with the same source pixels", () => {
    const host = () => { const values = new Map<string, string>(); return { hidden: true, values, style: { setProperty: (key: string, value: string) => { values.set(key, value); } } }; };
    const back = host(), front = host(), gift = host(), painter = createCompanionAccessoryPainter({ back: back as unknown as HTMLElement, front: front as unknown as HTMLElement, gift: gift as unknown as HTMLElement });
    const selected = selectCompanionSprite(304);
    for (const id of ["sunglasses", "satchel"] as const) {
      painter.paint(selected, id, false);
      expect(back.hidden).toBe(false); expect(front.hidden).toBe(false); expect(gift.hidden).toBe(true);
      expect(back.values.get("background-image")).toBe(front.values.get("background-image"));
      expect(back.values.get("transform")).toBe(front.values.get("transform"));
      expect(back.values.get("clip-path")).not.toBe("none");
      expect(front.values.get("clip-path")).not.toBe("none");
      expect(back.values.get("clip-path")).not.toBe(front.values.get("clip-path"));
    }
    painter.paint(selected, "pixel-sunglasses", false);
    expect(back.hidden).toBe(true); expect(front.values.get("clip-path")).toBe("none");
    painter.paint(selectCompanionSprite(0), "sunglasses", false);
    expect(back.hidden).toBe(true); expect(front.values.get("clip-path")).toBe("none");
  });
  it("keeps an umbrella above its side-body attachment and animates only the equipped item relative to its gift", () => {
    const selected = selectCompanionSprite(0), umbrella = companionAccessoryPlacement(selected, "leaf-umbrella")!, giftPoint = companionGiftAnchor(selected)!;
    expect(umbrella.y).toBeLessThan(giftPoint.y); expect(umbrella.x).toBeGreaterThan(giftPoint.x);
    const host = () => { const values = new Map<string, string>(); return { hidden: true, values, style: { setProperty: (key: string, value: string) => { values.set(key, value); } } }; };
    const back = host(), front = host(), gift = host(), painter = createCompanionAccessoryPainter({ back: back as unknown as HTMLElement, front: front as unknown as HTMLElement, gift: gift as unknown as HTMLElement });
    painter.paint(selected, "baseball-cap", true);
    const atRest = new Map(front.values), giftAtRest = new Map(gift.values);
    painter.paint(selected, "baseball-cap", true, { lift: 8, shift: 0, roll: -7, scale: 1 });
    expect(front.values.get("top")).not.toBe(atRest.get("top")); expect(front.values.get("transform")).not.toBe(atRest.get("transform")); expect(gift.values).toEqual(giftAtRest);
    painter.paint(selected, "baseball-cap", true); expect(front.values).toEqual(atRest);
  });
  it("keeps registered mouth boxes and the measured face band above all three neck props throughout their finite motions", () => {
    const calibrated = new Map(mouths.frames.map(frame => [frame.index, frame]));
    for (const pose of anchors.frames) {
      if (pose.orientation === "back") continue;
      const selected = selectCompanionSprite(pose.physicalIndex), angle = pose.face.roll * Math.PI / 180, nx = -Math.sin(angle), ny = Math.cos(angle), depth = (x: number, y: number) => (x - pose.face.x) * nx + (y - pose.face.y) * ny;
      const mouth = calibrated.get(pose.physicalIndex), mouthSource = mouth && mouths.atlases[mouth.atlas];
      const mouthBottom = mouth && mouthSource?.src === selected.src && mouthSource.sha256 === anchors.sources[pose.atlas].sha256 ? Math.max(...[0, 2].flatMap(x => [1, 3].map(y => depth(mouth.bounds[x] / mouths.cell * 80, mouth.bounds[y] / mouths.cell * 80)))) : undefined;
      for (const id of ["bow", "scarf", "bell-pendant"] as const) for (const age of [0, 300, 600, 900, 1200, 1500, 1800, 2100, 2600]) {
        const placed = companionAccessoryPlacement(selected, id, sampleCompanionAccessoryMotion(id, age).accessory)!, rotation = placed.rotation * Math.PI / 180, height = placed.width * placed.art.content.height / placed.art.content.width;
        const corners = [-1, 1].flatMap(sx => [-1, 1].map(sy => {
          const x = sx * placed.width / 2, y = sy * height / 2;
          return depth(placed.x + x * Math.cos(rotation) - y * Math.sin(rotation), placed.y + x * Math.sin(rotation) + y * Math.cos(rotation));
        }));
        const top = Math.min(...corners);
        expect(top, `${pose.physicalIndex}:${id}:${age} face band`).toBeGreaterThanOrEqual(7 - 1e-5);
        if (mouthBottom !== undefined) expect(top, `${pose.physicalIndex}:${id}:${age} calibrated mouth`).toBeGreaterThanOrEqual(mouthBottom + 1 - 1e-5);
      }
    }
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

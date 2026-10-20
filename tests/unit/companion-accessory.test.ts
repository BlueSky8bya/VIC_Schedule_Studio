import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import edition from "../fixtures/companion-eye-scale-143.json";
import { companionAccessoryAnchor, companionAccessoryPlacement, companionGiftAnchor, createCompanionAccessoryPainter } from "@/lib/ui/viewer-companion/accessory";
import { COMPANION_ACCESSORIES, currentCompanionAccessory } from "@/lib/ui/viewer-companion/accessory-catalog";
import { COMPANION_ACCESSORY_IDS } from "@/lib/ui/viewer-companion/gifts";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import anchors from "@/lib/ui/viewer-companion/accessory-anchors.json";
import mouths from "@/lib/ui/viewer-companion/mouth-anchors.json";
import { sampleCompanionAccessoryMotion } from "@/lib/ui/viewer-companion/accessory-motion";

// Measure the adopted eye ink independently of the runtime overlay numbers.
// Parent registrations still own the496 unchanged cells and the approved
// standing lens size; only the24 source-bound eye edits need new centres.
async function measuredActiveEyes() {
  type Eye = { center: number[]; bounds: number[] };
  const measured = new Map<number, Eye[]>();
  for (const packet of edition.packets) {
    const bytes = readFileSync(`public${packet.src}`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(packet.sha256);
    expect(anchors.sources[packet.atlas]).toMatchObject({ src: packet.parentSrc, sha256: packet.parentSha256 });
    for (const cell of edition.frames.filter(frame => frame.atlas === packet.atlas)) {
      const rgba = await sharp(bytes).extract({ left: cell.index % 8 * 192, top: Math.floor(cell.index / 8) * 192, width: 192, height: 192 }).ensureAlpha().raw().toBuffer();
      const ink = (point: number) => rgba[point * 4] < 120 && rgba[point * 4 + 1] < 100 && rgba[point * 4 + 2] < 90 && rgba[point * 4 + 3] > 160;
      const seen = new Uint8Array(192 * 192), queue = new Int32Array(seen.length), parts: Eye[] = [];
      for (let start = 0; start < seen.length; start++) {
        if (seen[start] || !ink(start)) continue;
        let head = 0, count = 1, left = 192, top = 192, right = 0, bottom = 0, sumX = 0, sumY = 0;
        queue[0] = start; seen[start] = 1;
        while (head < count) {
          const point = queue[head++], x = point % 192, y = Math.floor(point / 192);
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1); sumX += x + .5; sumY += y + .5;
          for (let yy = Math.max(0, y - 1); yy <= Math.min(191, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(191, x + 1); xx++) {
            const next = yy * 192 + xx;
            if (!seen[next] && ink(next)) { seen[next] = 1; queue[count++] = next; }
          }
        }
        if (count >= 8 && right - left < 25 && bottom - top < 26) parts.push({ center: [sumX / count / 2.4, sumY / count / 2.4], bounds: [left / 2.4, top / 2.4, right / 2.4, bottom / 2.4] });
      }
      const eyes = anchors.frames[cell.physical].eyes.map(parent => {
        const distance = (part: Eye) => Math.hypot(part.center[0] - parent.center[0], part.center[1] - parent.center[1]);
        const nearest = [...parts].sort((a, b) => distance(a) - distance(b))[0];
        expect(nearest, `actual eye${cell.physical}`).toBeDefined(); expect(distance(nearest)).toBeLessThanOrEqual(7 / 2.4);
        return nearest;
      });
      expect(eyes).toHaveLength(2); expect(eyes[0]).not.toBe(eyes[1]); measured.set(cell.physical, eyes);
    }
  }
  expect(measured.size).toBe(24);
  return measured;
}

describe("adopted pose wardrobe", () => {
  it("maps every current physical frame to each owned accessory and actual gift anchor", () => {
    expect(companionSpriteMetadata.frames).toHaveLength(520);
    for (let index = 0; index < companionSpriteMetadata.frames.length; index++) {
      const selected = selectCompanionSprite(index), gift = companionGiftAnchor(selected);
      expect(gift, `gift ${index}`).not.toBeNull();
      for (const id of COMPANION_ACCESSORY_IDS) {
        const placed = companionAccessoryPlacement(selected, id);
        expect(placed, `${index}:${id}`).not.toBeNull();
        expect(placed!.art.id).toMatch(new RegExp(`^${currentCompanionAccessory(id)}:`));
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
  it("covers every measured eye while keeping the approved standing lens size across expressions", async () => {
    const activeEyes = await measuredActiveEyes();
    const measured = anchors.frames as unknown as Array<typeof anchors.frames[number] & { eyes: { center: number[]; bounds: number[] }[] }>;
    for (const pose of measured) {
      if (pose.orientation === "back") continue;
      expect(pose.eyes, `eyes ${pose.physicalIndex}`).toHaveLength(2);
      const eyes = activeEyes.get(pose.physicalIndex) ?? pose.eyes;
      const selected = selectCompanionSprite(pose.physicalIndex), eye = eyes[1];
      for (const id of ["monocle"] as const) {
        const placed = companionAccessoryPlacement(selected, id)!;
        expect(placed.x, `${id}:${pose.physicalIndex}`).toBeCloseTo(eye.center[0]); expect(placed.y).toBeCloseTo(eye.center[1]);
        const coreRadius = 22 * (placed.art.viewScale ?? 1) * placed.width / placed.art.content.width;
        for (const x of [eye.bounds[0], eye.bounds[2]]) for (const y of [eye.bounds[1], eye.bounds[3]]) expect(Math.hypot(x - placed.x, y - placed.y), `${id}:${pose.physicalIndex} lens interior`).toBeLessThan(coreRadius);
        expect(placed.layer).toBe("front");
      }
      for (const id of ["round-glasses", "wire-glasses", "browline-glasses", "heart-glasses", "square-glasses"] as const) {
        const placed = companionAccessoryPlacement(selected, id)!, span = Math.hypot(eyes[1].center[0] - eyes[0].center[0], eyes[1].center[1] - eyes[0].center[1]);
        const standing = measured[0].eyes, standingSpan = Math.hypot(standing[1].center[0] - standing[0].center[0], standing[1].center[1] - standing[0].center[1]);
        const viewScale = pose.orientation === "quarter" ? .83 : pose.orientation === "side" ? .56 : 1;
        expect(placed.width / placed.art.content.width * 48 * placed.art.viewScale!, `${id}:${pose.physicalIndex} standing lens span`).toBeCloseTo(standingSpan * viewScale);
        expect(span).toBeGreaterThan(0);
        expect(placed.rotation).toBeCloseTo(pose.face.roll); expect(placed.pivot).toEqual({ x: 64, y: 64 });
      }
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
    expect(companionAccessoryPlacement(rear, "monocle")?.layer).toBe("back");
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
  it("puts the approved far temple behind the adopted body, while retired bags use the active head fitting", () => {
    const host = () => { const values = new Map<string, string>(); return { hidden: true, values, style: { setProperty: (key: string, value: string) => { values.set(key, value); } } }; };
    const back = host(), front = host(), gift = host(), painter = createCompanionAccessoryPainter({ back: back as unknown as HTMLElement, front: front as unknown as HTMLElement, gift: gift as unknown as HTMLElement });
    const selected = selectCompanionSprite(304);
    for (const id of ["sunglasses"] as const) {
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
    expect(companionAccessoryPlacement(selected, "satchel")).toEqual(companionAccessoryPlacement(selected, "retro-cap"));
  });
  it("keeps the retired umbrella's equivalent on the head and animates only the equipped item relative to its gift", () => {
    const selected = selectCompanionSprite(0), umbrella = companionAccessoryPlacement(selected, "leaf-umbrella")!, giftPoint = companionGiftAnchor(selected)!;
    expect(umbrella.y).toBeLessThan(giftPoint.y); expect(umbrella.layer).toBe("headwear");
    expect(umbrella).toEqual(companionAccessoryPlacement(selected, "bucket-hat"));
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
      const mouthBottom = mouth && mouthSource?.src === anchors.sources[pose.atlas].src && mouthSource.sha256 === anchors.sources[pose.atlas].sha256 ? Math.max(...[0, 2].flatMap(x => [1, 3].map(y => depth(mouth.bounds[x] / mouths.cell * 80, mouth.bounds[y] / mouths.cell * 80)))) : undefined;
      for (const id of COMPANION_ACCESSORY_IDS.filter(id => ["chest-badge", "front-bow", "front-pocket"].includes(COMPANION_ACCESSORIES[currentCompanionAccessory(id)].family))) for (const age of [0, 300, 600, 900, 1200, 1500, 1800, 2100, 2600]) {
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
  it("projects rare prop endpoints from every adopted frame and spins only the rotor plane", () => {
    const calls = new Map<string, string>(), rearCalls = new Map<string, string>();
    const host = (values: Map<string, string>) => ({ hidden: true, style: { setProperty: (key: string, value: string) => values.set(key, value) } }) as unknown as HTMLElement;
    const front = host(calls), back = host(rearCalls), gift = host(new Map()), painter = createCompanionAccessoryPainter({ front, back, gift });
    for (let index = 0; index < 520; index++) {
      const selected = selectCompanionSprite(index);
      for (const [id, part] of [["magic-pocket", "opening"], ["propeller-hat", "rotor"]] as const) {
        const endpoint = companionAccessoryAnchor(selected, id, part);
        expect(endpoint, `${index}:${part}`).not.toBeNull(); expect(Object.values(endpoint!).every(Number.isFinite)).toBe(true);
        expect(companionAccessoryAnchor({ ...selected, src: "/unadopted.webp" }, id, part)).toBeNull();
      }
    }
    expect(companionAccessoryAnchor(selectCompanionSprite(0), "bow", "opening")).toBeNull();
    const selected = selectCompanionSprite(304);
    painter.paint(selected, "propeller-hat", false);
    const cap = calls.get("transform"), rotor = rearCalls.get("transform");
    painter.paint(selected, "propeller-hat", false, { lift: 0, shift: 0, roll: 0, scale: 1, rotor: 90 });
    expect(calls.get("transform")).toBe(cap); expect(rearCalls.get("transform")).not.toBe(rotor);
    expect(back.hidden).toBe(false); expect(front.hidden).toBe(false);
    painter.paint(selected, "bow", false); expect(back.hidden).toBe(true);
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

import { describe, expect, it } from "vitest";
import { companionSofaDepth, companionSofaRelease, companionSofaSeat } from "@/lib/ui/viewer-companion/sofa";
import type { Platform } from "@/lib/ui/viewer-companion/brain";

describe("sofa solid opening", () => {
  const seat: Platform = { id: "companion-home", x: 180, y: 300, width: 12, kind: "date" };
  const floor: Platform = { id: "companion-home-floor", x: 130, y: 326, width: 65, kind: "floor", manualOnly: true };
  const bed = { left: 130, right: 260, top: 240, bottom: 324 };
  it("keeps the whole opaque body within both seat walls at every permitted centre", () => {
    const rect = { left: 140, right: 238, top: 300 }, result = companionSofaSeat(rect, 92)!;
    expect(result.width).toBeGreaterThan(1);
    for (const x of [result.x, result.x + result.width / 2, result.x + result.width]) {
      expect(x - 92 * .38).toBeGreaterThanOrEqual(rect.left + 3 - 1e-8);
      expect(x + 92 * .38).toBeLessThanOrEqual(rect.right - 3 + 1e-8);
    }
    expect(companionSofaSeat({ left: 0, right: 70, top: 300 }, 92)).toBeNull();
  });
  it("slides an inner rim to the actual safe seat and a front rim onto the actual floor", () => {
    expect(companionSofaRelease({ x: 168, y: 290 }, bed, seat, [floor], 92)).toEqual({ x: 180, y: 300, platformId: seat.id });
    expect(companionSofaRelease({ x: 210, y: 314 }, bed, seat, [floor], 92)).toEqual({ x: 195, y: 326, platformId: floor.id });
    expect(companionSofaRelease({ x: 210, y: 314 }, bed, seat, [], 92)).toBeNull();
    // A thrown body may penetrate a few pixels into the front rim before
    // release. Its genuine room floor still repairs that collision.
    expect(companionSofaRelease({ x: 210, y: 328 }, bed, seat, [floor], 92)).toEqual({ x: 195, y: 326, platformId: floor.id });
  });
  it("does not capture a normal calendar/floor drop or invent a replacement support", () => {
    expect(companionSofaRelease({ x: 430, y: 300 }, bed, seat, [floor], 92)).toBeNull();
    expect(companionSofaRelease({ x: 180, y: 340 }, bed, seat, [floor], 92)).toBeNull();
    expect(companionSofaRelease({ x: 210, y: 314 }, bed, seat, [{ ...floor, id: "viewport-floor" }], 92)).toBeNull();
  });
});

describe("complete rendered body sofa depth", () => {
  const bed = { left: 100, right: 280, top: 200, bottom: 300 }, seatY = 274;
  const rectangle = (left: number, top: number, right: number, bottom: number) => [{ x: left, y: top }, { x: right, y: top }, { x: right, y: bottom }, { x: left, y: bottom }];
  const body = rectangle(156, 194, 224, 276), point = { x: 190, y: seatY };
  it("orders a contained resident behind the U and every outside body in front, regardless of old support/history", () => {
    expect(companionSofaDepth({ point, body, bed, seatY, previous: "front" })).toBe("seat");
    expect(companionSofaDepth({ point: { x: 124, y: seatY }, body: rectangle(90, 194, 158, 276), bed, seatY, previous: "seat" })).toBe("front");
    expect(companionSofaDepth({ point: { x: 256, y: seatY }, body: rectangle(222, 194, 290, 276), bed, seatY, previous: "seat" })).toBe("front");
    expect(companionSofaDepth({ point: { x: 190, y: 298 }, body: rectangle(156, 218, 224, 300), bed, seatY })).toBe("front");
  });
  it("uses the current deformed polygon, not equal feet or a neutral size estimate", () => {
    const hanging = [{ x: 135, y: 192 }, { x: 210, y: 204 }, { x: 239, y: 289 }, { x: 123, y: 271 }];
    expect(companionSofaDepth({ point, body, bed, seatY })).toBe("seat");
    expect(companionSofaDepth({ point, body: hanging, bed, seatY, previous: "seat" })).toBe("front");
  });
  it("allows overhead passage only after the complete hanging body clears both tall side tips", () => {
    expect(companionSofaDepth({ point: { x: 190, y: 216 }, body: rectangle(156, 138, 224, 218), bed, seatY })).toBe("clear");
    expect(companionSofaDepth({ point: { x: 190, y: 216 }, body: rectangle(156, 138, 224, 225), bed, seatY })).toBe("back");
    expect(companionSofaDepth({ point: { x: 400, y: 274 }, body: rectangle(366, 194, 434, 276), bed, seatY })).toBe("clear");
  });
  it("keeps a finite depth deadband but immediately rejects a body crossing either wall", () => {
    const justFront = { ...point, y: seatY + 1 };
    expect(companionSofaDepth({ point: justFront, body, bed, seatY, previous: "seat" })).toBe("seat");
    expect(companionSofaDepth({ point: { ...point, y: seatY + 3 }, body, bed, seatY, previous: "seat" })).toBe("front");
    expect(companionSofaDepth({ point: justFront, body: rectangle(130, 194, 224, 276), bed, seatY, previous: "seat" })).toBe("front");
    expect(companionSofaDepth({ point, body, bed, seatY, previous: "front" })).toBe("seat");
  });
  it("uses actual translated/scaled viewport geometry, including studio zoom", () => {
    const transform = (p: { x: number; y: number }) => ({ x: p.x * .72 + 411, y: p.y * .72 - 92 });
    const tl = transform({ x: bed.left, y: bed.top }), br = transform({ x: bed.right, y: bed.bottom });
    expect(companionSofaDepth({ point: transform(point), body: body.map(transform), bed: { left: tl.x, top: tl.y, right: br.x, bottom: br.y }, seatY: seatY * .72 - 92 })).toBe("seat");
    expect(companionSofaDepth({ point, body: [], bed, seatY })).toBe("clear");
    expect(companionSofaDepth({ point, body: [...body, { x: NaN, y: 0 }], bed, seatY })).toBe("clear");
  });
  it("repairs an actual hanging-body intersection even when its neutral feet are below the old release box", () => {
    const floor: Platform = { id: "companion-home-floor", x: 140, y: 302, width: 100, kind: "floor", manualOnly: true };
    const below = { x: 190, y: 312 }, hanging = rectangle(155, 230, 225, 320);
    expect(companionSofaRelease(below, bed, undefined, [floor], 92)).toBeNull();
    expect(companionSofaRelease(below, bed, undefined, [floor], 92, { body: hanging, depth: "front" })).toEqual({ x: 190, y: 302, platformId: floor.id });
  });
  it("never forces an outside or oversized posed body through the interior seat", () => {
    const seat: Platform = { id: "companion-home", x: 175, y: seatY, width: 30, kind: "date" };
    const floor: Platform = { id: "companion-home-floor", x: 140, y: 302, width: 100, kind: "floor", manualOnly: true };
    expect(companionSofaRelease(point, bed, seat, [floor], 92, { body, depth: "front" })?.platformId).toBe(floor.id);
    expect(companionSofaRelease(point, bed, seat, [floor], 92, { body: rectangle(126, 194, 254, 276), depth: "seat" })?.platformId).toBe(floor.id);
    expect(companionSofaRelease(point, bed, seat, [floor], 92, { body, depth: "seat" })).toEqual({ x: 190, y: seatY, platformId: seat.id });
    expect(companionSofaRelease({ x: 400, y: 274 }, bed, seat, [floor], 92, { body: rectangle(366, 194, 434, 276), depth: "front" })).toBeNull();
  });
});

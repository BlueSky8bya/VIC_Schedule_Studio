import { describe, expect, it } from "vitest";
import { companionSofaRelease, companionSofaSeat } from "@/lib/ui/viewer-companion/sofa";
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

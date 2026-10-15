import { describe, expect, it } from "vitest";
import { safeCompanionSurfaces, unoccludedCompanionRects, type CompanionSurface, type CompanionTextRect } from "@/lib/ui/viewer-companion/geometry";

const viewport = { width: 1000, height: 800 };
const text = (left: number, top: number, right: number, bottom: number): CompanionTextRect => ({ left, top, right, bottom });
const safe = (surface: CompanionSurface, obstacles: CompanionTextRect[], size = 76) => safeCompanionSurfaces(surface, obstacles, size, viewport);

function expectClear(surfaces: CompanionSurface[], obstacles: CompanionTextRect[], size: number) {
  for (const surface of surfaces) for (let step = 0; step <= 10; step++) {
    const centre = surface.x + surface.width * step / 10;
    const body = { left: centre - size / 2, right: centre + size / 2, top: surface.y - size, bottom: surface.y };
    for (const rect of obstacles) {
      const overlaps = body.left < rect.right && body.right > rect.left && body.top < rect.bottom && body.bottom > rect.top;
      expect(overlaps, `body at ${centre},${surface.y} overlaps a text rectangle`).toBe(false);
    }
  }
}

describe("companion text platforms", () => {
  it("uses the registered opaque body while retaining full-cell viewport bounds", () => {
    const obstacles = [text(20, 500, 40, 516), text(85, 530, 330, 548)];
    const surfaces = safeCompanionSurfaces({ x: 42, y: 580, width: 300 }, obstacles, 76, viewport, { width: 57.76, height: 57.76 });
    expect(surfaces).toHaveLength(1);
    expect(surfaces[0]).toMatchObject({ x: 42, y: 580 });
    expect(surfaces[0].width).toBeCloseTo(11.12);
    for (const surface of surfaces) {
      expect(surface.x).toBeGreaterThanOrEqual(42);
      for (const centre of [surface.x, surface.x + surface.width]) for (const rect of obstacles) {
        expect(centre - 28.88 < rect.right && centre + 28.88 > rect.left && surface.y - 57.76 < rect.bottom && surface.y > rect.top).toBe(false);
      }
    }
    expect(safeCompanionSurfaces({ x: 42, y: 580, width: 300 }, obstacles, 76, viewport)).toEqual([]);
  });

  it("ignores calendar ink hidden behind the opaque house while retaining its own labels", () => {
    const house = text(60, 400, 365, 800);
    const coveredCalendar = text(75, 486, 205, 503);
    const ownLabel = text(250, 490, 290, 510);
    const obstacles = [...unoccludedCompanionRects(coveredCalendar, house), ...unoccludedCompanionRects(ownLabel)];
    const surfaces = safe({ x: 108, y: 535, width: 118 }, obstacles);
    expect(surfaces).toEqual([{ x: 108, y: 535, width: 101 }]);
    expectClear(surfaces, [ownLabel], 76);
  });

  it("preserves the visible part of a calendar line outside the house", () => {
    const fragments = unoccludedCompanionRects(text(40, 480, 120, 500), text(60, 400, 365, 800));
    expect(fragments).toEqual([text(40, 480, 60, 500)]);
    const surfaces = safe({ x: 80, y: 535, width: 150 }, fragments);
    expect(surfaces).toEqual([{ x: 101, y: 535, width: 129 }]);
    expectClear(surfaces, fragments, 76);
  });

  it("clips all four exposed sides without counting the hidden centre", () => {
    const parts = unoccludedCompanionRects(text(100, 100, 300, 300), text(150, 150, 250, 250));
    expect(parts).toEqual([text(100, 100, 300, 150), text(100, 250, 300, 300), text(100, 150, 150, 250), text(250, 150, 300, 250)]);
    expect(parts.reduce((area, rect) => area + (rect.right - rect.left) * (rect.bottom - rect.top), 0)).toBe(30000);
    expect(unoccludedCompanionRects(text(100, 100, 150, 150), text(150, 100, 200, 200))).toEqual([text(100, 100, 150, 150)]);
  });

  it("protects a full icon-only hit target, including its empty padding", () => {
    const control = text(400, 700, 448, 748);
    const surfaces = safe({ x: 200, y: 760, width: 500 }, [control]);
    expect(surfaces).toEqual([{ x: 200, y: 760, width: 159 }, { x: 489, y: 760, width: 211 }]);
    expectClear(surfaces, [control], 76);
  });

  it("stands above the actual supporting line, without using a padded card top", () => {
    const supporting = text(200, 300, 420, 320);
    const surfaces = safe({ x: supporting.left, y: supporting.top - 3, width: supporting.right - supporting.left }, [supporting]);
    expect(surfaces).toEqual([{ x: 200, y: 297, width: 220 }]);
    expectClear(surfaces, [supporting], 76);
  });

  it("removes the part of a title ledge whose body would cover the date above", () => {
    const date = text(180, 225, 210, 250);
    const title = text(180, 300, 450, 322);
    const surfaces = safe({ x: 180, y: 297, width: 270 }, [date, title]);
    expect(surfaces).toEqual([{ x: 251, y: 297, width: 199 }]);
    expectClear(surfaces, [date, title], 76);
  });

  it("splits a wide ledge around text in the neighbouring date cell", () => {
    const obstacles = [text(410, 400, 480, 422), text(680, 380, 740, 405)];
    const surfaces = safe({ x: 150, y: 450, width: 730 }, obstacles);
    expect(surfaces).toEqual([{ x: 150, y: 450, width: 219 }, { x: 521, y: 450, width: 118 }, { x: 781, y: 450, width: 99 }]);
    expectClear(surfaces, obstacles, 76);
  });

  it("rejects a subtitle when the title above fills every possible centre", () => {
    const title = text(200, 250, 450, 276);
    expect(safe({ x: 220, y: 290, width: 180 }, [title])).toEqual([]);
  });

  it("keeps a narrow date number as a valid ledge when its full body has room", () => {
    const date = text(500, 210, 511, 233);
    const surfaces = safe({ x: 500, y: 207, width: 11 }, [date]);
    expect(surfaces).toEqual([{ x: 500, y: 207, width: 11 }]);
    expectClear(surfaces, [date], 76);
  });

  it("uses the current sprite size and viewport pixels after scaling or resizing", () => {
    const obstacle = text(400, 300, 460, 320);
    const surface = { x: 300, y: 350, width: 300 };
    for (const size of [60, 76, 92]) {
      const surfaces = safe(surface, [obstacle], size);
      expectClear(surfaces, [obstacle], size);
      expect(surfaces[0].width).toBe(400 - size / 2 - 3 - 300);
    }
    const scaled = safeCompanionSurfaces({ x: 150, y: 175, width: 150 }, [text(200, 150, 230, 160)], 76, { width: 500, height: 400 });
    expectClear(scaled, [text(200, 150, 230, 160)], 76);
    expect(scaled).toEqual([{ x: 150, y: 175, width: 9 }, { x: 271, y: 175, width: 29 }]);
  });

  it("keeps body bounds inside the viewport, including the floor", () => {
    expect(safe({ x: 0, y: 782, width: 1000 }, [])).toEqual([{ x: 42, y: 782, width: 916 }]);
    expect(safe({ x: 0, y: 60, width: 1000 }, [])).toEqual([]);
    expect(safe({ x: 0, y: 795, width: 1000 }, [])).toEqual([]);
    expect(safeCompanionSurfaces({ x: 0, y: 200, width: 50 }, [], 76, { width: 50, height: 300 })).toEqual([]);
  });

  it("removes a floor segment beneath visible controls instead of obscuring their labels", () => {
    const controls = [text(430, 730, 570, 751)];
    const surfaces = safe({ x: 12, y: 782, width: 976 }, controls);
    expect(surfaces).toEqual([{ x: 42, y: 782, width: 347 }, { x: 611, y: 782, width: 347 }]);
    expectClear(surfaces, controls, 76);
  });

  it("allows a cushion only where the pet clears the house's own labels", () => {
    const labels = [text(200, 300, 290, 323)];
    const surfaces = safe({ x: 200, y: 370, width: 240 }, labels);
    expect(surfaces).toEqual([{ x: 331, y: 370, width: 109 }]);
    expectClear(surfaces, labels, 76);
  });

  it("is independent of obstacle order and safely ignores invalid rectangles", () => {
    const surface = { x: 100, y: 500, width: 800 };
    const obstacles = [text(300, 450, 360, 480), text(500, 440, 550, 460), text(0, 100, 900, 120)];
    expect(safe(surface, obstacles)).toEqual(safe(surface, [...obstacles].reverse()));
    expect(safe(surface, [text(NaN, 400, 500, 430), text(200, 400, 200, 430)])).toEqual(safe(surface, []));
    expect(safe({ x: NaN, y: 400, width: 300 }, [])).toEqual([]);
    expect(safe(surface, [], NaN)).toEqual([]);
  });
});

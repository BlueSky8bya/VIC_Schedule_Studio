import { describe, expect, it } from "vitest";
import { placeCompanionOverlayPerch, type CompanionOverlayPerch, type CompanionOverlayRect } from "@/lib/ui/viewer-companion/overlay-perch";

const viewport = { width: 1440, height: 900 };
const dialog = { left: 420, top: 180, right: 1020, bottom: 760 };
function expectClear(perch: CompanionOverlayPerch, size: number, view: { width: number; height: number }, rects: readonly CompanionOverlayRect[]) {
  const cell = size * perch.scale;
  expect(perch.overlap).toBe(false);
  expect(perch.x - cell / 2).toBeGreaterThanOrEqual(4 - 1e-6);
  expect(perch.x + cell / 2).toBeLessThanOrEqual(view.width - 4 + 1e-6);
  expect(perch.y - cell).toBeGreaterThanOrEqual(4 - 1e-6);
  expect(perch.y).toBeLessThanOrEqual(view.height - 4 + 1e-6);
  const body = { left: perch.x - cell * .38, right: perch.x + cell * .38, top: perch.y - cell * .76, bottom: perch.y };
  for (const rect of rects) {
    const clear = body.right <= rect.left - 6 + 1e-6 || body.left >= rect.right + 6 - 1e-6 || body.bottom <= rect.top - 6 + 1e-6 || body.top >= rect.bottom + 6 - 1e-6;
    expect(clear).toBe(true);
  }
}

describe("companion ordinary-overlay perch", () => {
  it("keeps a moving window's already small guest nearby without growing it again", () => {
    const previous = { x: 390, y: 450, scale: 44 / 92 };
    const moved = { ...dialog, left: 395 };
    const next = placeCompanionOverlayPerch(previous, 92, viewport, [moved], { preferNearby: true });
    expectClear(next, 92, viewport, [moved]);
    expect(next.scale).toBe(previous.scale);
    expect(Math.hypot(next.x - previous.x, next.y - previous.y)).toBeLessThan(25);
    expect(placeCompanionOverlayPerch(next, 92, viewport, [moved], { preferNearby: true })).toEqual(next);
  });

  it("chooses a nearby smaller gap when the full-size alternative would fling across the window", () => {
    const view = { width: 390, height: 844 }, rect = { left: 0, top: 0, right: 300, bottom: 700 };
    const previous = { x: 328, y: 430, scale: 1 };
    const full = placeCompanionOverlayPerch(previous, 92, view, [rect]);
    const next = placeCompanionOverlayPerch(previous, 92, view, [rect], { preferNearby: true });
    expectClear(next, 92, view, [rect]);
    expect(Math.hypot(next.x - previous.x, next.y - previous.y)).toBeLessThan(Math.hypot(full.x - previous.x, full.y - previous.y));
    expect(next.scale).toBeLessThan(1);
  });
  it("preserves a clear world point and never mutates its inputs", () => {
    const point = Object.freeze({ x: 220, y: 380 });
    const rects = Object.freeze([Object.freeze({ ...dialog })]);
    const perch = placeCompanionOverlayPerch(point, 76, Object.freeze(viewport), rects);
    expect(perch).toEqual({ ...point, scale: 1, overlap: false });
    expectClear(perch, 76, viewport, rects);
    expect(point).toEqual({ x: 220, y: 380 });
  });

  it("moves an occluded pet to the nearest clear edge at full size", () => {
    const perch = placeCompanionOverlayPerch({ x: 720, y: 450 }, 76, viewport, [dialog]);
    expectClear(perch, 76, viewport, [dialog]);
    expect(perch.scale).toBe(1);
    expect(perch).toEqual({ x: 720, y: 174, scale: 1, overlap: false });
  });

  it("fits a 390px settings sheet's small bottom gap without hiding or covering its body", () => {
    const mobile = { width: 390, height: 844 };
    const settings = { left: 16, top: 50.64, right: 374, bottom: 793.36 };
    for (const size of [60, 76, 92]) {
      const perch = placeCompanionOverlayPerch({ x: 195, y: 420 }, size, mobile, [settings]);
      expectClear(perch, size, mobile, [settings]);
      expect(size * perch.scale).toBeCloseTo(44);
      expect(perch.y).toBeGreaterThan(settings.bottom);
    }
  });

  it("uses the existing small 60px tier before shrinking further", () => {
    const rect = { left: 0, right: 1440, top: 0, bottom: 838 };
    const perch = placeCompanionOverlayPerch({ x: 720, y: 450 }, 92, viewport, [rect]);
    expectClear(perch, 92, viewport, [rect]);
    expect(perch.scale * 92).toBe(60);
  });

  it("avoids several windows together rather than moving into another window", () => {
    const rects = [dialog, { left: 0, top: 0, right: 420, bottom: 900 }, { left: 1020, top: 0, right: 1440, bottom: 900 }, { left: 420, top: 0, right: 1020, bottom: 180 }];
    const perch = placeCompanionOverlayPerch({ x: 720, y: 450 }, 76, viewport, rects);
    expectClear(perch, 76, viewport, rects);
    expect(perch.y).toBeGreaterThan(dialog.bottom);
  });

  it("keeps an already valid small perch stable, then repositions after a resize", () => {
    const mobile = { width: 390, height: 844 };
    const sheet = { left: 16, top: 50.64, right: 374, bottom: 793.36 };
    const previous = placeCompanionOverlayPerch({ x: 195, y: 420 }, 92, mobile, [sheet]);
    expect(placeCompanionOverlayPerch(previous, 92, mobile, [sheet])).toEqual(previous);
    expect(placeCompanionOverlayPerch(previous, 92, viewport, [])).toEqual(previous);
    const resized = { width: 320, height: 540 };
    const next = placeCompanionOverlayPerch(previous, 92, resized, []);
    expectClear(next, 92, resized, []);
    expect(next.y).toBeLessThanOrEqual(536);
  });

  it("marks the bounded noninteractive corner fallback when a fullscreen window has no free space", () => {
    const full = { left: 0, top: 0, right: viewport.width, bottom: viewport.height };
    const perch = placeCompanionOverlayPerch({ x: 1200, y: 800 }, 92, viewport, [full]);
    expect(perch.overlap).toBe(true);
    expect(perch.scale * 92).toBe(44);
    expect(perch.x).toBe(viewport.width - 4 - 22);
    expect(perch.y).toBe(viewport.height - 4);
  });

  it("ignores malformed/offscreen exclusions and returns finite bounded values for bad or tiny inputs", () => {
    const ignored = [{ left: NaN, top: 0, right: 500, bottom: 500 }, { left: -200, top: 0, right: -1, bottom: 500 }, { left: 300, top: 400, right: 200, bottom: 300 }];
    expect(placeCompanionOverlayPerch({ x: 200, y: 200 }, 76, viewport, ignored)).toEqual({ x: 200, y: 200, scale: 1, overlap: false });
    for (const view of [{ width: .01, height: .01 }, { width: 1, height: 1 }, { width: NaN, height: Infinity }, { width: 32, height: 24 }]) {
      const result = placeCompanionOverlayPerch({ x: Infinity, y: NaN, scale: -1 }, -20, view, []);
      expect([result.x, result.y, result.scale].every(Number.isFinite)).toBe(true);
      expect(result.scale).toBeGreaterThan(0);
      expect(result.scale).toBeLessThanOrEqual(1);
      expect(result.overlap).toBe(false);
    }
    const extreme = placeCompanionOverlayPerch({ x: Number.MAX_VALUE, y: Number.MAX_VALUE }, 76, viewport, []);
    expectClear(extreme, 76, viewport, []);
  });
});

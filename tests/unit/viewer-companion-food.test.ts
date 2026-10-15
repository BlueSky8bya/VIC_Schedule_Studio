import { describe, expect, it } from "vitest";
import { COMPANION_TRASH_DISCARD_MS, COMPANION_TRASH_DWELL_MS, attachCompanionFood, companionTrashProgress, followCompanionFood, placeCompanionFood, presentCompanionFood, reconcileCompanionFood } from "@/lib/ui/viewer-companion/food";
import type { CompanionFood, Platform } from "@/lib/ui/viewer-companion/brain";

const floor: Platform = { id: "floor", x: 12, y: 782, width: 976, kind: "floor" };
const card: Platform = { id: "card", x: 100, y: 350, width: 200, kind: "card" };
const apple: CompanionFood = { id: "apple", x: 200, y: 340, kind: "apple" };

describe("companion food support", () => {
  it("lands on a ledge instead of covering its text and keeps only explicit snack fields", () => {
    const placed = placeCompanionFood(apple, apple, [floor, card]);
    expect(placed).toEqual({ id: "apple", kind: "apple", x: 200, y: 350, platformId: "card" });
    expect(placeCompanionFood(apple, { x: 200, y: 400 }, [floor, card]).platformId).toBe("floor");
  });
  it("never picks another visible support when its card leaves the landing list", () => {
    const placed = placeCompanionFood(apple, apple, [floor, card]);
    expect(reconcileCompanionFood(placed, [floor])).toEqual(placed);
    expect(reconcileCompanionFood(placed, [floor, { ...card, x: 250, y: 420 }])).toEqual({ ...placed, x: 262, y: 420 });
  });
  it("keeps x at real safe edges without the creature's walking inset", () => {
    expect(placeCompanionFood({ ...apple, kind: "lemon" }, { x: 12, y: 700 }, [floor]).x).toBe(12);
    expect(placeCompanionFood(apple, { x: 988, y: 700 }, [floor]).x).toBe(988);
    expect(placeCompanionFood(apple, { x: 0, y: 700 }, [floor]).x).toBe(12);
  });
  it("retains a document point when every real ledge is above or horizontally distant", () => {
    expect(placeCompanionFood(apple, { x: 200, y: 800 }, [card, floor])).toEqual({ id: "apple", kind: "apple", x: 200, y: 800 });
    expect(placeCompanionFood(apple, { x: 9999, y: 700 }, [floor])).toEqual({ id: "apple", kind: "apple", x: 9999, y: 700 });
  });
  it("chooses the nearest lower height at the current x before considering small edge attraction", () => {
    const close = { ...card, id: "close", y: 400 }, far = { ...card, id: "far", y: 600 };
    expect(placeCompanionFood(apple, { x: 200, y: 370 }, [floor, far, close])).toEqual({ ...apple, y: 400, platformId: "close" });
    expect(placeCompanionFood(apple, { x: 90, y: 300 }, [card])).toEqual({ ...apple, x: 100, y: 350, platformId: "card" });
    expect(placeCompanionFood(apple, { x: 77, y: 300 }, [card]).platformId).toBeUndefined();
  });
  it("does not mutate the platform ordering and skips malformed lower surfaces", () => {
    const invalid = [{ ...card, id: "", y: 360 }, { ...card, x: NaN }, { ...card, width: -2 }, { ...card, y: Infinity }];
    const platforms = Object.freeze([Object.freeze(floor), ...invalid, Object.freeze(card)]);
    expect(placeCompanionFood(apple, apple, platforms).platformId).toBe("card");
    expect(platforms[0]).toBe(floor);
    expect(placeCompanionFood(apple, { x: NaN, y: 5 }, platforms)).toEqual(apple);
  });
  it("keeps a subpixel contact on its actual ledge without choosing an upper day", () => {
    expect(placeCompanionFood(apple, { x: 200, y: card.y + .000366 }, [floor, card])).toEqual({ ...apple, y: card.y, platformId: "card" });
    expect(placeCompanionFood(apple, { x: 200, y: card.y + .49 }, [floor, card]).platformId).toBe("card");
    expect(placeCompanionFood(apple, { x: 200, y: card.y + .51 }, [floor, card]).platformId).toBe(floor.id);
  });
});

describe("companion food attachments", () => {
  it("keeps a home tray outside its tiny dispenser origin without the glyph reflow clamp", () => {
    const attached = attachCompanionFood({ x: 460, y: 509 }, { x: 0, y: 0 }, { x: 500, y: 500 });
    const moved = followCompanionFood(attached, { x: 0, y: 100 }, { left: 200, top: 350, width: 18, height: 5 }, false);
    expect(moved.point).toEqual({ x: 160, y: 359 });
    expect(moved.attachment.offsetX).toBe(-40); expect(moved.attachment.offsetY).toBe(9);
    // The same local origin can bind a remounted home after a fold/portal move.
    expect(followCompanionFood(moved.attachment, { x: 0, y: 0 }, { left: 700, top: 500, width: 24, height: 5 }, false).point).toEqual({ x: 660, y: 509 });
    // Ordinary text attachment keeps its existing height-clamp contract.
    expect(followCompanionFood(attached, { x: 0, y: 0 }, { left: 500, top: 500, width: 18, height: 5 }).point.y).toBe(502);
  });
  it("keeps a document point through scrolling and restores it at the original place", () => {
    const attached = attachCompanionFood({ x: 200, y: 350 }, { x: 0, y: 200 });
    const away = followCompanionFood(attached, { x: 40, y: 900 });
    expect(away.point).toEqual({ x: 160, y: -350 });
    expect(followCompanionFood(away.attachment, { x: 0, y: 200 }).point).toEqual({ x: 200, y: 350 });
    expect(away.attachment.documentY).toBe(550);
  });
  it("follows the same DOM origin even outside the viewport and across nested scrolling", () => {
    const attached = attachCompanionFood({ x: 180, y: 347 }, { x: 0, y: 200 }, { x: 100, y: 350 });
    const away = followCompanionFood(attached, { x: 0, y: 900 }, { left: 90, top: -350, width: 200, height: 30 });
    expect(away.point).toEqual({ x: 170, y: -353 });
    const returned = followCompanionFood(away.attachment, { x: 0, y: 200 }, { left: 100, top: 350, width: 200, height: 30 });
    expect(returned.point).toEqual({ x: 180, y: 347 });
    // A nested scroller changes only the actual origin, not window.scrollY.
    expect(followCompanionFood(returned.attachment, { x: 0, y: 200 }, { left: 100, top: 310 }).point.y).toBe(307);
  });
  it("uses the same source during reflow, and detachment keeps the last document point", () => {
    const attached = attachCompanionFood({ x: 280, y: 380 }, { x: 0, y: 100 }, { x: 100, y: 350 });
    const narrowed = followCompanionFood(attached, { x: 0, y: 100 }, { left: 80, top: 400, width: 90, height: 20 });
    expect(narrowed.point).toEqual({ x: 170, y: 417 });
    // Restore original local offsets when that same source grows again.
    expect(followCompanionFood(narrowed.attachment, { x: 0, y: 100 }, { left: 100, top: 350, width: 250, height: 40 }).point).toEqual({ x: 280, y: 380 });
    expect(followCompanionFood(narrowed.attachment, { x: 0, y: 300 }).point).toEqual({ x: 170, y: 217 });
  });
});

describe("companion food presentation", () => {
  const mouth = { x: 420, y: 260 };
  it("lifts the presentation to the mouth without moving its logical support", () => {
    const food = Object.freeze({ ...apple, platformId: "card" });
    expect(presentCompanionFood(food, 0, mouth)).toEqual({ x: 200, y: 340, scale: 1, rotation: 0 });
    const halfway = presentCompanionFood(food, .12, mouth);
    expect(halfway.x).toBeGreaterThan(food.x);
    expect(halfway.x).toBeLessThan(mouth.x);
    expect(halfway.y).toBeLessThan((food.y + mouth.y + 16) / 2);
    const arrived = presentCompanionFood(food, .24, mouth);
    expect(arrived.x).toBe(424); expect(arrived.y).toBeCloseTo(276);
    expect(food).toEqual({ ...apple, platformId: "card" });
  });
  it("chews and shrinks after arrival while keeping the fruit inside the mouth area", () => {
    const poses = Array.from({ length: 77 }, (_, i) => presentCompanionFood(apple, .24 + i / 100, mouth));
    expect(new Set(poses.map(pose => pose.rotation.toFixed(2))).size).toBeGreaterThan(20);
    expect(poses.every(pose => Math.abs(pose.x - 424) < .001 && Math.abs(pose.y - 276) <= .801)).toBe(true);
    expect(poses.at(-1)!.scale).toBeCloseTo(.28);
    expect(poses.every(pose => pose.scale >= .25 && pose.scale <= 1.02)).toBe(true);
  });
  it("mirrors the small approach offset, freezes reduced motion, and safely clamps bad progress", () => {
    expect(presentCompanionFood(apple, .24, mouth, -1).x).toBe(416);
    expect(presentCompanionFood(apple, .7, mouth, -1, true)).toEqual({ x: 416, y: 276, scale: 1, rotation: 0 });
    expect(presentCompanionFood(apple, NaN, mouth)).toEqual(presentCompanionFood(apple, 0, mouth));
    expect(presentCompanionFood(apple, -8, mouth)).toEqual(presentCompanionFood(apple, 0, mouth));
    expect(presentCompanionFood(apple, 8, mouth)).toEqual(presentCompanionFood(apple, 1, mouth));
    expect(presentCompanionFood(apple, 1, { x: NaN, y: 3 })).toEqual({ x: apple.x, y: apple.y, scale: .28, rotation: 0 });
    expect(presentCompanionFood(apple, .5).scale).toBeCloseTo(.64);
  });
  it("requires a deliberate trash dwell, with a separate finite discard", () => {
    expect(COMPANION_TRASH_DWELL_MS).toBe(320); expect(COMPANION_TRASH_DISCARD_MS).toBe(180);
    expect(companionTrashProgress(-1)).toBe(0); expect(companionTrashProgress(NaN)).toBe(0);
    expect(companionTrashProgress(160)).toBe(.5); expect(companionTrashProgress(319)).toBeLessThan(1);
    expect(companionTrashProgress(320)).toBe(1); expect(companionTrashProgress(900)).toBe(1);
  });
});

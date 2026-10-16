import { describe, expect, it } from "vitest";
import type { Platform } from "@/lib/ui/viewer-companion/brain";
import { companionPositionPoint, resolveCompanionPosition, type CompanionPositionContext, type CompanionPositionSnapshot } from "@/lib/ui/viewer-companion/position-memory";

const snapshot = (): CompanionPositionSnapshot => ({ point: { x: 600, y: 500 }, viewport: { width: 1200, height: 900 }, monthKey: "2026-10", seeded: true });
const span = (id: string, x: number, y: number, width: number, kind: Platform["kind"] = "card"): Platform => ({ id, x, y, width, kind });
const context = (): CompanionPositionContext => ({ monthKey: "2026-10", platforms: [], landings: [], viewport: { width: 1200, height: 900 }, size: 92 });

describe("transient companion viewport search origin", () => {
  it("scales both coordinates against the actual next viewport", () => {
    expect(companionPositionPoint(snapshot(), { width: 1920, height: 1080 }, 92)).toEqual({ x: 960, y: 600 });
  });
  it("clamps the whole cell, including extreme legacy points after a coarse resize", () => {
    const remembered = snapshot(); remembered.point = { x: -500, y: 5000 };
    expect(companionPositionPoint(remembered, { width: 1440, height: 800 }, 92)).toEqual({ x: 50, y: 788 });
    remembered.point = { x: 5000, y: -500 };
    expect(companionPositionPoint(remembered, { width: 1440, height: 800 }, 92)).toEqual({ x: 1390, y: 100 });
  });
  it("does not manufacture coordinates from an invalid source or an unusable viewport", () => {
    expect(companionPositionPoint(null, { width: 1200, height: 900 }, 92)).toBeNull();
    expect(companionPositionPoint({ ...snapshot(), point: { x: NaN, y: 20 } }, { width: 1200, height: 900 }, 92)).toBeNull();
    expect(companionPositionPoint({ ...snapshot(), viewport: { width: 0, height: 900 } }, { width: 1200, height: 900 }, 92)).toBeNull();
    expect(companionPositionPoint(snapshot(), { width: 80, height: 90 }, 92)).toBeNull();
    expect(companionPositionPoint(snapshot(), { width: Infinity, height: 900 }, 92)).toBeNull();
  });
});

describe("real anchor position reconnection", () => {
  it("uses actual cushion range fraction, then clamps into its narrower body-safe seat", () => {
    const remembered = snapshot(); remembered.anchor = { kind: "home", u: .25 };
    const next = context(); next.platforms = [span("companion-home", 180, 680, 40, "date")]; next.homeRange = { x: 100, width: 200 };
    expect(resolveCompanionPosition(remembered, next)).toEqual({ point: { x: 180, y: 680 }, platformId: "companion-home", kind: "home" });
  });
  it("reconnects only canonical floor fragments and never places into a newly occluded gap", () => {
    const remembered = snapshot(); remembered.anchor = { kind: "home-floor", u: .35 };
    const next = context(); next.homeFloorRange = { x: 80, width: 200 };
    next.landings = [span("companion-home-floor-2", 180, 780, 70, "floor"), span("viewport-floor", 50, 780, 1000, "floor"), span("companion-home-floor", 100, 780, 30, "floor"), span("companion-home-floor-food", 140, 780, 30, "floor")];
    expect(resolveCompanionPosition(remembered, next)).toEqual({ point: { x: 130, y: 780 }, platformId: "companion-home-floor", kind: "home-floor" });
    next.landings = next.landings.filter(platform => !/^companion-home-floor(?:-\d+)?$/.test(platform.id));
    expect(resolveCompanionPosition(remembered, next)).toBeNull();
  });
  it("uses the current explicitly matched public card rather than an old temporary ID", () => {
    const remembered = snapshot(); remembered.anchor = { kind: "public-card", eventId: "public-A", u: .5, manualTop: false };
    const next = context(); next.publicCard = { eventId: "public-A", range: { x: 100, width: 200 }, platforms: [span("card-99-line-1", 180, 450, 70)], landings: [] };
    expect(resolveCompanionPosition(remembered, next)).toEqual({ point: { x: 200, y: 450 }, platformId: "card-99-line-1", kind: "public-card" });
    // Reusing the same temporary geometry ID on a different event cannot
    // restore a deleted or newly private target.
    next.publicCard.eventId = "public-B";
    expect(resolveCompanionPosition(remembered, next)).toBeNull();
    next.publicCard = undefined; next.platforms = [span("card-99-line-1", 180, 450, 70)];
    expect(resolveCompanionPosition(remembered, next)).toBeNull();
  });
  it("keeps the actual card fraction when viewport clipping changes its visible safe span", () => {
    const remembered = snapshot(); remembered.point = { x: 100, y: 450 };
    // The old actual card spans -100..300. Its left edge is clipped, but
    // x100 remains halfway across the full card, not its visible fragment.
    remembered.anchor = { kind: "public-card", eventId: "public-A", u: .5, manualTop: false };
    const next = context(); next.publicCard = { eventId: "public-A", range: { x: -100, width: 400 }, platforms: [span("card-2-line-1", 50, 450, 120)], landings: [] };
    expect(resolveCompanionPosition(remembered, next)?.point).toEqual({ x: 100, y: 450 });
    // Reflow exposes the whole card elsewhere. The same actual-card
    // fraction is resolved before clamping into its measured safe span.
    next.publicCard.range = { x: 200, width: 400 };
    next.publicCard.platforms = [span("card-18-line-1", 330, 450, 120)];
    expect(resolveCompanionPosition(remembered, next)?.point).toEqual({ x: 400, y: 450 });
  });
  it("keeps manual card tops separate from autonomous safe text ledges", () => {
    const remembered = snapshot(); remembered.anchor = { kind: "public-card", eventId: "public-A", u: .5, manualTop: true };
    const next = context(); next.publicCard = { eventId: "public-A", range: { x: 100, width: 200 }, platforms: [span("card-7", 100, 480, 200)], landings: [{ ...span("card-7-top", 160, 430, 80), manualOnly: true }] };
    expect(resolveCompanionPosition(remembered, next)?.platformId).toBe("card-7-top");
    remembered.anchor.manualTop = false;
    expect(resolveCompanionPosition(remembered, next)?.platformId).toBe("card-7");
    next.publicCard.platforms = next.publicCard.landings;
    expect(resolveCompanionPosition(remembered, next)).toBeNull();
    remembered.anchor.manualTop = true; next.publicCard.landings = [];
    expect(resolveCompanionPosition(remembered, next)).toBeNull();
  });
  it("rejects mismatched months, never-seeded memory and an anchor with no genuine support", () => {
    const remembered = snapshot(); remembered.anchor = { kind: "home", u: .5 };
    const next = context(); next.platforms = [span("companion-home", 180, 680, 40, "date")];
    expect(resolveCompanionPosition({ ...remembered, monthKey: "2026-09" }, next)).toBeNull();
    expect(resolveCompanionPosition({ ...remembered, seeded: false }, next)).toBeNull();
    expect(resolveCompanionPosition({ ...remembered, anchor: undefined }, next)).toBeNull();
    next.platforms = [span("viewport-floor", 50, 880, 1100, "floor")];
    expect(resolveCompanionPosition(remembered, next)).toBeNull();
  });
  it("chooses a real visible span and rejects invalid or offscreen geometry without changing its y", () => {
    const remembered = snapshot(); remembered.anchor = { kind: "home-floor", u: .5 };
    const next = context(); next.homeFloorRange = { x: 0, width: 1200 };
    next.landings = [span("companion-home-floor", 0, 40, 1200, "floor"), span("companion-home-floor-1", NaN, 700, 200, "floor"), span("companion-home-floor-2", 580, 700, 0, "floor"), span("companion-home-floor-3", 580, 700, 50, "floor")];
    expect(resolveCompanionPosition(remembered, next)).toEqual({ point: { x: 600, y: 700 }, platformId: "companion-home-floor-3", kind: "home-floor" });
    next.landings = next.landings.slice(0, 3);
    expect(resolveCompanionPosition(remembered, next)).toBeNull();
  });
  it("clamps finite range fractions while rejecting a corrupt explicit range", () => {
    const remembered = snapshot(); remembered.anchor = { kind: "home", u: 2 };
    const next = context(); next.homeRange = { x: 100, width: 200 }; next.platforms = [span("companion-home", 180, 680, 40, "date")];
    expect(resolveCompanionPosition(remembered, next)?.point.x).toBe(220);
    next.homeRange = { x: NaN, width: 200 }; expect(resolveCompanionPosition(remembered, next)).toBeNull();
    next.homeRange = undefined; expect(resolveCompanionPosition(remembered, next)?.point.x).toBe(220);
    remembered.anchor.u = Infinity; expect(resolveCompanionPosition(remembered, next)).toBeNull();
  });
  it("preserves all caller snapshots and candidate records", () => {
    const remembered = snapshot(); remembered.anchor = { kind: "home", u: .5 };
    const next = context(); next.platforms = Object.freeze([Object.freeze(span("companion-home", 180, 680, 40, "date"))]);
    const before = JSON.stringify({ remembered, next });
    expect(resolveCompanionPosition(remembered, next)?.point).toEqual({ x: 200, y: 680 });
    expect(JSON.stringify({ remembered, next })).toBe(before);
  });
});

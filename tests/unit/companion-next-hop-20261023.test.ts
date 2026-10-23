import { describe, expect, it } from "vitest";
import { findPlatformRoute, reachablePlatforms, type Platform } from "@/lib/ui/viewer-companion/brain";

const source: Platform = { id: "occupied-date-floor", kind: "floor", x: 170, y: 590, width: 180 };
const next: Platform = { id: "next-card", kind: "card", x: 290, y: 641, width: 44 };
const from = { x: 333.433, y: source.y, platformId: source.id };
const target = { x: 321.219, y: next.y, platformId: next.id };

describe("next-hop planning uses the actual occupied launch point", () => {
  it("omits a short reverse alignment before the same physically reachable landing", () => {
    const route = findPlatformRoute(from, target, [source, next]);
    expect(route).toEqual([{ kind: "jump", target }]);
    expect(reachablePlatforms(from, [{ ...next, x: target.x - 12, width: 24 }])).toHaveLength(1);
  });

  it.each([-1, 1] as const)("does not manufacture a six-pixel pre-hop adjustment in direction %s", direction => {
    const floor = { ...source, x: 100, width: 220 };
    const landing = { ...next, x: 170, width: 60 };
    const origin = { x: 200 + direction * 6, y: floor.y, platformId: floor.id };
    const destination = { x: 200, y: landing.y, platformId: landing.id };
    expect(findPlatformRoute(origin, destination, [floor, landing])).toEqual([{ kind: "jump", target: destination }]);
  });

  it("keeps the necessary takeoff walk when a distant floor cannot be jumped from here", () => {
    const broad = { ...source, x: 0, width: 900 };
    const remote = { ...next, x: 500, y: 500, width: 80 };
    const origin = { x: 40, y: broad.y, platformId: broad.id };
    const destination = { x: 540, y: remote.y, platformId: remote.id };
    const route = findPlatformRoute(origin, destination, [broad, remote])!;
    expect(route.map(step => step.kind)).toEqual(["walk", "jump"]);
    expect(route[0].target).toEqual({ x: 540, y: broad.y, platformId: broad.id });
    expect(reachablePlatforms(origin, [{ ...remote, x: 528, width: 24 }])).toEqual([]);
    expect(reachablePlatforms(route[0].target, [{ ...remote, x: 528, width: 24 }])).toHaveLength(1);
  });

  it("does not substitute wide-ledger reachability for proof of the exact high landing", () => {
    const broad = { ...source, x: 0, width: 600 };
    const high = { ...next, x: 100, y: 450, width: 300 };
    const origin = { x: 100, y: broad.y, platformId: broad.id };
    const destination = { x: 300, y: high.y, platformId: high.id };
    expect(reachablePlatforms(origin, [high])).toHaveLength(1);
    expect(reachablePlatforms(origin, [{ ...high, x: 288, width: 24 }])).toEqual([]);
    expect(findPlatformRoute(origin, destination, [broad, high])?.[0]).toEqual({ kind: "walk", target: { x: 300, y: broad.y, platformId: broad.id } });
  });

  it("retains a nearby real meal's exact manual landing while denying unrelated manual traversal", () => {
    const offered = { ...next, manualOnly: true, width: 80 };
    const destination = { x: 321.219, y: offered.y, platformId: offered.id };
    expect(findPlatformRoute(from, destination, [source, offered])).toBeNull();
    expect(findPlatformRoute(from, destination, [source, offered], true, offered.id)).toEqual([{ kind: "jump", target: destination }]);
    expect(findPlatformRoute(from, destination, [source, offered], false, offered.id)).toBeNull();
    const manualSource = { ...source, manualOnly: true };
    expect(findPlatformRoute(from, target, [manualSource, next])).toEqual([{ kind: "jump", target: { ...target, x: 322 } }]);
  });

  it("reproves changed supports and never turns missing or impossible geometry into a direct jump", () => {
    expect(findPlatformRoute(from, target, [next])).toBeNull();
    expect(findPlatformRoute(from, target, [{ ...source, x: 500 }, next])).toBeNull();
    expect(findPlatformRoute(from, { ...target, y: 150 }, [source, { ...next, y: 150 }])).toBeNull();
    expect(findPlatformRoute(from, target, [source, { ...next, x: NaN }])).toBeNull();
  });

  it("does not remove a real same-floor approach to a contact or destination", () => {
    const destination = { x: 290, y: source.y, platformId: source.id };
    expect(findPlatformRoute(from, destination, [source])).toEqual([{ kind: "walk", target: destination }]);
  });

  it("retains the actual room-floor alignment before entering the cushion's special rim path", () => {
    const floor: Platform = { id: "companion-home-floor", kind: "floor", x: 40, y: 620.1875, width: 260 };
    const sofa: Platform = { id: "companion-home", kind: "date", x: 96.7890625, y: 579.453125, width: 12 };
    const origin = { x: 227.875, y: floor.y, platformId: floor.id };
    const destination = { x: 102.7890625, y: sofa.y, platformId: sofa.id };
    expect(reachablePlatforms(origin, [sofa])).toHaveLength(1);
    expect(findPlatformRoute(origin, destination, [floor, sofa])).toEqual([
      { kind: "walk", target: { x: destination.x, y: floor.y, platformId: floor.id } },
      { kind: "jump", target: destination },
    ]);
  });

  it("preserves a wider cushion's original rim alignment when leaving for another support", () => {
    const sofa: Platform = { id: "companion-home", kind: "date", x: 62.28125, y: 579.453125, width: 81.015625 };
    const floor: Platform = { id: "companion-home-floor", kind: "floor", x: 40, y: 620.1875, width: 260 };
    const origin = { x: 102.7890625, y: sofa.y, platformId: sofa.id };
    const destination = { x: 227.875, y: floor.y, platformId: floor.id }, alignedX = sofa.x + sofa.width - 12;
    expect(findPlatformRoute(origin, destination, [sofa, floor])).toEqual([
      { kind: "walk", target: { x: alignedX, y: sofa.y, platformId: sofa.id } },
      { kind: "jump", target: { x: alignedX, y: floor.y, platformId: floor.id } },
      { kind: "walk", target: destination },
    ]);
  });
});

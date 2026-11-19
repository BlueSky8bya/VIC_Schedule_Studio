import { describe, expect, it } from "vitest";
import { planCompanionFoodThrow } from "@/lib/ui/viewer-companion/food-toss";
import { createCompanionFoodGravity, createCompanionFoodToss } from "@/lib/ui/viewer-companion/food-gravity";
import { placeCompanionFood, type CompanionFoodDropSupport } from "@/lib/ui/viewer-companion/food";

const viewport = { width: 1000, height: 800 };
const food = { id: "actual-food", kind: "bread" as const, x: 300, y: 300 };
const floor: CompanionFoodDropSupport = { id: "viewport-floor-food", kind: "floor", x: 24, y: 770, width: 952 };

describe("131 native food release physics", () => {
  it("retains the direction of an actual throw and catches the first descending physical card", () => {
    const first: CompanionFoodDropSupport = { id: "first", kind: "card", x: 300, y: 350, width: 250 };
    const lower = { ...first, id: "lower", y: 500 };
    const plan = planCompanionFoodThrow(food, { x: 240, y: -200 }, [floor, lower, first], viewport)!;
    expect(plan.food.platformId).toBe(first.id); expect(plan.velocityY).toBe(-200);
    const flight = createCompanionFoodToss(food, plan.food, 100, { ...plan, flutter: true }), contact = flight.duration - 240;
    expect(flight.sample(100)).toMatchObject({ x: food.x, y: food.y, rotation: 0, active: true });
    expect(flight.sample(130).y).toBeLessThan(food.y); expect(flight.sample(130).x).toBeGreaterThan(food.x);
    expect(flight.sample(100 + contact)).toMatchObject({ x: plan.contactX, y: first.y });
    expect(flight.sample(100 + flight.duration)).toMatchObject({ x: plan.food.x, y: plan.food.y, active: false });
  });
  it("supports downward and horizontal releases without inventing an upward kick", () => {
    for (const velocity of [{ x: 200, y: 0 }, { x: -220, y: 120 }]) {
      const plan = planCompanionFoodThrow(food, velocity, [floor], viewport)!;
      const flight = createCompanionFoodToss(food, plan.food, 0, plan);
      expect(flight.duration).toBeGreaterThan(0); expect(flight.sample(1).y).toBeGreaterThan(food.y);
      expect(Math.sign(flight.sample(100).x - food.x)).toBe(Math.sign(velocity.x));
      expect(flight.sample(flight.duration)).toMatchObject({ x: plan.food.x, y: floor.y, active: false });
    }
  });
  it("leaves a snack let go on its support line to ordinary placement instead of falling through to a lower edge", () => {
    const below: CompanionFoodDropSupport = { id: "date-37-floor-food", kind: "floor", x: 24, y: 790 - 30, width: 952 };
    const line = { ...floor, y: 730 }, onLine = { ...food, x: 500, y: 730 };
    for (const velocity of [{ x: -200, y: 0 }, { x: -180, y: 120 }, { x: 150, y: 60 }]) {
      expect(planCompanionFoodThrow(onLine, velocity, [line, below], viewport)).toBeUndefined();
      expect(planCompanionFoodThrow({ ...onLine, y: 730.4 }, velocity, [line, below], viewport)).toBeUndefined();
    }
    // An upward flick from the line still flies and comes back down onto it.
    expect(planCompanionFoodThrow(onLine, { x: 150, y: -200 }, [line, below], viewport)!.food.platformId).toBe(line.id);
    // Off the support's span, or clearly above it, it is an ordinary throw.
    expect(planCompanionFoodThrow({ ...onLine, y: 700 }, { x: 150, y: 60 }, [line, below], viewport)!.food.platformId).toBe(line.id);
    // Same support test as placement: a body-only stance or the sofa bed at that height never holds the
    // snack, and a card holds it across its whole drop surface, not only its safe centre span.
    expect(planCompanionFoodThrow(onLine, { x: -200, y: 0 }, [{ ...line, id: "companion-home-bed-food" }, below], viewport)!.food.platformId).toBe(below.id);
    expect(planCompanionFoodThrow(onLine, { x: -200, y: 0 }, [{ ...line, bodyOnly: true }, below], viewport)!.food.platformId).toBe(below.id);
    const card: CompanionFoodDropSupport = { id: "card-3-food-top", kind: "card", x: 520, y: 730, width: 60, dropSurface: { x: 480, width: 140 } };
    expect(planCompanionFoodThrow(onLine, { x: -200, y: 0 }, [card, below], viewport)).toBeUndefined();
    expect(placeCompanionFood(onLine, onLine, [card, below]).platformId).toBe(card.id);
    expect(planCompanionFoodThrow({ ...onLine, x: 470 }, { x: -200, y: 0 }, [card, below], viewport)!.food.platformId).toBe(below.id);
  });
  it("clamps extreme native velocity and ceiling/wall crossings while retaining a real target", () => {
    for (const x of [24, 25, 975, 976]) for (const y of [8, 48, 300]) for (const direction of [-1, 1]) {
      const start = { ...food, x, y }, plan = planCompanionFoodThrow(start, { x: direction * 1e9, y: -1e9 }, [floor], viewport)!;
      const flight = createCompanionFoodToss(start, plan.food, 0, plan);
      for (let at = 0; at <= flight.duration; at += 4) {
        const point = flight.sample(at); expect(point.x).toBeGreaterThanOrEqual(24 - 1e-7); expect(point.x).toBeLessThanOrEqual(976 + 1e-7); expect(point.y).toBeGreaterThanOrEqual(8 - 1e-7);
      }
    }
  });
  it("rejects fabricated seats, transparent panels, slow/stale velocities and malformed release data", () => {
    const protectedSupports = ["companion-home", "companion-home-bed-food", "companion-panel-floor-food-1"].map(id => ({ ...floor, id }));
    expect(planCompanionFoodThrow(food, { x: 100, y: -100 }, protectedSupports, viewport)).toBeUndefined();
    for (const velocity of [{ x: 0, y: 0 }, { x: 20, y: 10 }, { x: NaN, y: -100 }]) expect(planCompanionFoodThrow(food, velocity, [floor], viewport)).toBeUndefined();
    expect(planCompanionFoodThrow({ ...food, x: Infinity }, { x: 100, y: 0 }, [floor], viewport)).toBeUndefined();
    expect(planCompanionFoodThrow(food, { x: 100, y: 0 }, [], viewport)).toBeUndefined();
  });
  it("keeps flutter cosmetic, continuous at contact and sampling-rate independent through source movement", () => {
    const plain = createCompanionFoodGravity(food, { ...food, y: 770 }, 0), flutter = createCompanionFoodGravity(food, { ...food, y: 770 }, 0, { flutter: true });
    let rotation = 0;
    for (let at = 0; at <= flutter.duration; at += 8) {
      const a = plain.sample(at), b = flutter.sample(at); expect(b.x).toBe(a.x); expect(b.y).toBe(a.y); rotation = Math.max(rotation, Math.abs(b.rotation));
      expect(flutter.sample(at)).toEqual(b);
    }
    expect(rotation).toBeGreaterThan(2); expect(rotation).toBeLessThanOrEqual(7);
    expect(flutter.sample(0).rotation).toBe(0); expect(flutter.sample(flutter.duration).rotation).toBe(0);
    const plan = planCompanionFoodThrow(food, { x: 200, y: -200 }, [floor], viewport)!;
    const a = createCompanionFoodToss(food, plan.food, 0, { ...plan, flutter: true });
    const b = createCompanionFoodToss(food, plan.food, 0, { ...plan, flutter: true });
    b.sample(50); expect(b.sample(100)).toEqual(a.sample(100));
    const point = a.sample(100), moved = a.sample(100, { x: plan.food.x - 12, y: plan.food.y - 90 });
    expect(moved.x).toBeCloseTo(point.x - 12); expect(moved.y).toBeCloseTo(point.y - 90); expect(moved.rotation).toBe(point.rotation);
  });
});

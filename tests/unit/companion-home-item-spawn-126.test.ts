import { describe, expect, it } from "vitest";
import { rankCompanionItemLandings } from "@/lib/ui/viewer-companion/item-landing";
import { planCompanionHomeFoodEjection } from "@/lib/ui/viewer-companion/food-toss";
import { createCompanionFoodToss } from "@/lib/ui/viewer-companion/food-gravity";
import { rebaseCompanionFoodBodySupport } from "@/lib/ui/viewer-companion/food";
import { accessibleCompanionToys, createCompanionToys } from "@/lib/ui/viewer-companion/toys";
import type { Platform } from "@/lib/ui/viewer-companion/brain";

const floor: Platform = { id: "companion-home-floor-food", kind: "floor", x: 100, y: 500, width: 300, manualOnly: true };
const body: Platform = { ...floor, id: "companion-home-floor", x: 90, width: 330 };
const bounds = { width: 1000, height: 800 };
const outlet = { id: "snack", kind: "apple" as const, x: 250, y: 478 };

describe("126 source-bound mixed item landings", () => {
  it("reserves exact native44px free footprints before using a crowded centre", () => {
    const occupied = [{ x: 144, y: 500 }, { x: 232, y: 500 }];
    const chosen = rankCompanionItemLandings([floor], 232, occupied)[0];
    expect(chosen.x).toBe(188); expect(chosen.overlap).toBe(0);
    expect(occupied.every(p => Math.abs(chosen.x - p.x) >= 44)).toBe(true);
  });
  it("honestly minimizes overlap on the real narrow span without adding a lane", () => {
    const narrow = { ...floor, x: 30, width: 90 }, occupied = [{ x: 30, y: 500 }, { x: 120, y: 500 }];
    const chosen = rankCompanionItemLandings([narrow], 75, occupied)[0];
    expect(chosen).toMatchObject({ x: 75, y: 500, overlap: 0 });
    const packed = rankCompanionItemLandings([narrow], 75, [...occupied, chosen])[0];
    expect(packed.overlap).toBeGreaterThan(0); expect(packed.x).toBeGreaterThanOrEqual(30); expect(packed.x).toBeLessThanOrEqual(120); expect(packed.y).toBe(500);
    expect(packed.clearance).toBeGreaterThan(20);
  });
  it("maximizes the closest clearance for eight mixed items on a saturated62px floor", () => {
    const small = { ...floor, x: 132, y: 306, width: 62 }, occupied: { x: number; y: number }[] = [];
    const toys = createCompanionToys(() => 0), foods: { x: number; y: number }[] = [];
    toys.sync([{ ...body, x: 120, y: 306, width: 120 }], bounds, 0, [small]);
    const foodXs: number[] = [], toyXs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const plan = planCompanionHomeFoodEjection({ ...outlet, x: 247, y: 290 }, [small], bounds, occupied)!;
      expect(plan).toBeDefined(); occupied.push(plan.food); foods.push(plan.food); foodXs.push(plan.food.x);
      expect(toys.spawn({ x: 260, y: 230, platformId: small.id }, 0, foods)).toBeTruthy();
      const toy = toys.occupied().at(-1)!;
      occupied.push(toy); toyXs.push(toy.x);
      expect(Math.abs(plan.contactX - 247) / plan.seconds).toBeLessThanOrEqual(225.00001);
      expect(Math.abs(plan.contactX - 247)).toBeLessThanOrEqual(140.00001);
    }
    for (const xs of [foodXs, toyXs]) expect(new Set(xs.map(x => Math.round(x * 10))).size).toBe(4);
    expect(occupied.every(p => p.x >= 132 && p.x <= 194 && p.y === 306)).toBe(true);
    const next = rankCompanionItemLandings([small], 194, occupied);
    expect(next[0].overlap).toBeGreaterThan(0);
    expect(next.every(p => p.clearance <= next[0].clearance)).toBe(true);
    for (let at = 16; at < 1800; at += 16) toys.tick(at);
    expect(new Set(toys.available().map(p => Math.round(p.x * 10))).size).toBe(4);
    expect(toys.available().every(p => p.y === small.y && p.platformId === small.id)).toBe(true);
  });
  it("rejects invalid geometry and ignores remote vertical occupancy", () => {
    expect(rankCompanionItemLandings([{ ...floor, x: NaN }], 200, [])).toEqual([]);
    expect(rankCompanionItemLandings([floor], Infinity, [])).toEqual([]);
    expect(rankCompanionItemLandings([floor], 250, [{ x: 250, y: 400 }])[0]).toMatchObject({ x: 250, overlap: 0 });
  });
  it("emits from the outlet through the existing finite parabola and lands on the measured floor", () => {
    const plan = planCompanionHomeFoodEjection(outlet, [floor], bounds)!;
    expect(plan.food).toMatchObject({ platformId: floor.id, x: 250, y: 500 });
    const motion = createCompanionFoodToss(outlet, plan.food, 100, plan);
    expect(motion.sample(100)).toMatchObject({ x: outlet.x, y: outlet.y, active: true });
    expect(motion.sample(160).y).toBeLessThan(outlet.y);
    expect(motion.sample(1800)).toMatchObject({ x: plan.food.x, y: 500, active: false });
    expect(planCompanionHomeFoodEjection(outlet, [], bounds)).toBeUndefined();
    expect(planCompanionHomeFoodEjection(outlet, [{ ...floor, id: "companion-panel-floor-food" }], bounds)).toBeUndefined();
  });
  it("retains first-contact protection instead of throwing through a real covering ledge", () => {
    const ledge: Platform = { id: "real-card-top", kind: "card", x: 0, y: 490, width: 1000 };
    expect(planCompanionHomeFoodEjection(outlet, [ledge, floor], bounds)).toBeUndefined();
  });
  it("rejects an isolated small floor gap and keeps system goals within the same-plane36px mouth range", () => {
    const isolated = { ...floor, x: 200, width: 40 }, remote = { ...body, x: 80, width: 40 };
    expect(planCompanionHomeFoodEjection({ ...outlet, x: 220 }, [isolated], bounds, [], [remote])).toBeUndefined();
    expect(planCompanionHomeFoodEjection({ ...outlet, x: 500 }, [floor], bounds, [], [remote])).toBeUndefined();
    expect(planCompanionHomeFoodEjection(outlet, [floor], bounds, [], [])).toBeUndefined();
    const near = { ...body, x: 160, width: 60 };
    const plan = planCompanionHomeFoodEjection(outlet, [floor], bounds, [{ x: 250, y: 500 }], [near])!;
    expect(plan).toBeDefined(); expect(plan.food.x).toBeGreaterThanOrEqual(136); expect(plan.food.x).toBeLessThanOrEqual(244);
    expect(planCompanionHomeFoodEjection(outlet, [floor], bounds, [], [{ ...near, y: 501 }])).toBeUndefined();
  });
  it("shares food destinations and still-flying toy reservations while preserving actual pickup", () => {
    const toys = createCompanionToys(() => 0); toys.sync([body], bounds, 0, [floor]);
    const foodPlan = planCompanionHomeFoodEjection(outlet, [floor], bounds)!;
    const foods = [foodPlan.food];
    for (let i = 0; i < 4; i++) expect(toys.spawn({ x: 350, y: 430, platformId: floor.id }, 0, foods)).toBeTruthy();
    const reserved = toys.occupied(); expect(reserved).toHaveLength(4);
    expect(reserved.every(p => p.y === 500)).toBe(true);
    expect(new Set(reserved.map(p => p.x)).size).toBe(4);
    const nextFood = planCompanionHomeFoodEjection(outlet, [floor], bounds, [...foods, ...reserved])!;
    // Known room contact uses its actual flight horizon, while keeping the
    // existing force/225px/s and140px travel caps. It can reach the free gap.
    expect(nextFood.food.x).toBeLessThan(180);
    expect([...foods, ...reserved].every(p => Math.abs(p.x - nextFood.food.x) >= 43.99)).toBe(true);
    for (let at = 16; at < 1800; at += 16) toys.tick(at);
    const actual = accessibleCompanionToys(toys.available(), [body]); expect(actual).toHaveLength(4);
    for (const toy of actual) { expect(toy.platformId).toBe(floor.id); expect(toys.pick(toy.id, toy.stance!)).toBe(true); expect(toys.stash(toy.id)).toBe(true); }
  });
  it("carries an in-flight chest reservation with the same floor without replaying its clock", () => {
    const toys = createCompanionToys(() => 0); toys.sync([body], bounds, 0, [floor]);
    toys.spawn({ x: 350, y: 430, platformId: floor.id }, 0); toys.tick(50);
    const before = toys.items()[0], reserved = toys.occupied()[0];
    const move = (p: Platform) => ({ ...p, x: p.x + 80, y: p.y + 30 });
    toys.sync([move(body)], bounds, 50, [move(floor)]);
    expect(toys.items()[0]).toMatchObject({ x: before.x + 80, y: before.y + 30 });
    expect(toys.occupied()[0]).toEqual({ x: reserved.x + 80, y: reserved.y + 30 });
    for (let at = 66; at < 1800; at += 16) toys.tick(at);
    expect(toys.available()[0]).toMatchObject({ platformId: floor.id, y: 530 });
    expect(Math.abs(toys.available()[0].x - (reserved.x + 80))).toBeLessThan(.5);
  });
  it("uses the immutable scan baseline once and waits for a fresh body proof during shrink", () => {
    const baseline = Object.freeze({ ...body, x: 100, y: 474, width: 200 });
    const source = { left: 0, top: 400, width: 600, height: 80 }, translated = { left: 80, top: 430, width: 600, height: 80 };
    expect(rebaseCompanionFoodBodySupport(baseline, source, translated)).toMatchObject({ x: 180, y: 504 });
    expect(baseline.x).toBe(100);
    // Body centres may occupy a short native fragment. Food's22px floor
    // clipping must never move that body's already-proved narrow interval.
    expect(rebaseCompanionFoodBodySupport({ ...baseline, x: 10, width: 20 }, source, translated)).toMatchObject({ x: 90, width: 20, y: 504 });
    expect(rebaseCompanionFoodBodySupport(baseline, source, { ...translated, width: 420 })).toBeUndefined();
    const fresh = { ...baseline, x: 150, y: 504, width: 120 }, frame = { ...translated, width: 420 };
    expect(rebaseCompanionFoodBodySupport(fresh, frame, frame)).toMatchObject(fresh);
  });
  it("uses near-floor air time without increasing force speed or total travel limits", () => {
    const local = { ...floor, x: 100, y: 306, width: 94 }, source = { ...outlet, x: 247, y: 290 };
    const plan = planCompanionHomeFoodEjection(source, [local], bounds, [{ x: 194, y: 306 }, { x: 175, y: 306 }])!;
    expect(plan.food.x).toBeLessThan(150);
    expect(Math.abs(plan.contactX - source.x) / plan.seconds).toBeLessThanOrEqual(225.00001);
    expect(Math.abs(plan.contactX - source.x)).toBeLessThanOrEqual(140.00001);
    expect(planCompanionHomeFoodEjection({ ...source, x: 700 }, [local], bounds)).toBeUndefined();
  });
});

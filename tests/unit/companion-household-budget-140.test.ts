import { describe, expect, it } from "vitest";
import { COMPANION_ROUTE_LIMITS, createBrain, reachablePlatforms, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { findCompanionHomeItemRoute } from "@/lib/ui/viewer-companion/home-pantry";

function fixture() {
  // Each real gap is reachable after walking across its occupied span, but
  // the next landing is>260px from the preceding landing. These are required
  // approaches, not the alignment walks removed by the next-hop planner.
  const platforms: Platform[] = Array.from({ length: 10 }, (_, i) => ({ id: i ? `real-floor-${i}` : "companion-home-floor", x: 50 + i * 360, y: 600, width: 135, kind: "floor", ...(i ? {} : { manualOnly: true }) }));
  const home = platforms[0], away = platforms.at(-1)!, brain = createBrain(0, () => .5);
  brain.hunger = .05; brain.energy = .9; brain.life = createCompanionLife(() => .5); brain.life.favoriteFood = "apple"; brain.life.foodScores.apple = .9;
  const world: CompanionWorld = { x: home.x + 30, y: home.y, platformId: home.id, platforms, width: 3800, height: 720, animated: true,
    foods: [{ id: "one-real-apple", kind: "apple", x: away.x + 100, y: away.y, platformId: away.id }] };
  return { brain, world, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "tidy" as const }, home: { pantry: { x: home.x + 70, y: home.y, platformId: home.id } },
    now: 1000, count: 1, carried: undefined as string | undefined, intent: "tidy" as const };
}

describe("140 food approach cannot spend the carried delivery budget", () => {
  it("finishes both proved legs of one same-ID pantry return exceeding32 decisions", () => {
    const input = fixture(), planner = createCompanionHousehold(() => 0), effects: string[] = [];
    const actual = input.world.foods![0];
    const approach = findCompanionHomeItemRoute(input.world, actual, input.world.platforms, true)!;
    const back = findCompanionHomeItemRoute(actual, input.home.pantry, input.world.platforms, true)!;
    expect(approach.length + back.length).toBeGreaterThan(32);
    let requiredWalks = 0;
    for (const [origin, route] of [[input.world, approach], [actual, back]] as const) {
      expect(route.filter(step => step.kind === "jump").length).toBeLessThanOrEqual(COMPANION_ROUTE_LIMITS.maxHops);
      let previous = { x: origin.x, y: origin.y };
      for (let index = 0; index < route.length; index++) {
        const step = route[index], hop = route[index + 1];
        if (step.kind === "walk" && hop?.kind === "jump") {
          const landing = input.world.platforms.find(platform => platform.id === hop.target.platformId)!;
          expect(reachablePlatforms(previous, [{ ...landing, x: hop.target.x - 12, width: 24 }])).toEqual([]);
          requiredWalks++;
        }
        previous = step.target;
      }
    }
    expect(requiredWalks).toBeGreaterThanOrEqual(16);
    let moves = 0;
    for (let n = 0; n < 80 && effects.at(-1) !== "put"; n++) {
      const action = planner.next(input); expect(action, `decision${n}, effects${effects.join(",")}`).toBeDefined();
      if (!action) break;
      if (["walk", "jump"].includes(action.kind)) {
        const support = input.world.platforms.find(p => p.id === action.target.platformId)!;
        expect(support).toBeTruthy(); expect(action.target.y).toBe(support.y);
        expect(action.target.x).toBeGreaterThanOrEqual(support.x); expect(action.target.x).toBeLessThanOrEqual(support.x + support.width);
        input.world = { ...input.world, ...action.target }; moves++;
      }
      input.now += action.duration + 220;
      if (action.household.effect) {
        expect(action.household.foodId).toBe("one-real-apple"); effects.push(action.household.effect);
        if (action.household.effect === "pick") { input.carried = "one-real-apple"; input.world.foods = []; }
        if (action.household.effect === "put") { expect(input.carried).toBe("one-real-apple"); input.carried = undefined; }
        planner.resolve(action.household, true, input.now); // Real route protocol ACK; not a DOM/food-physics claim.
      }
    }
    expect(moves).toBeGreaterThan(32); expect(effects).toEqual(["pick", "put"]); expect(planner.active()).toBe(false);
  });

  it.each(["deadline", "feeding-off", "removed-home"])("does not extend the owner through %s after the actual pick ACK", reason => {
    const input = fixture(), planner = createCompanionHousehold(() => 0);
    input.world = { ...input.world, ...input.world.foods![0] };
    const pick = planner.next(input)!; expect(pick.household.effect).toBe("pick");
    input.carried = "one-real-apple"; input.world.foods = []; planner.resolve(pick.household, true, input.now);
    if (reason === "deadline") input.now += 45001;
    if (reason === "feeding-off") input.preferences.feeding = false;
    if (reason === "removed-home") input.home = { pantry: { ...input.home.pantry, platformId: "removed-home" } };
    expect(planner.next(input)).toBeUndefined(); expect(planner.active()).toBe(false); expect(input.carried).toBe("one-real-apple");
  });

  it("ignores duplicate pickup ACKs instead of renewing the carried deadline", () => {
    const input = fixture(), planner = createCompanionHousehold(() => 0);
    input.world = { ...input.world, ...input.world.foods![0] };
    const pick = planner.next(input)!; input.carried = "one-real-apple"; input.world.foods = [];
    planner.resolve(pick.household, true, input.now);
    planner.resolve(pick.household, true, input.now + 44000);
    planner.resolve(pick.household, false, input.now + 44000);
    expect(planner.active()).toBe(true);
    input.now += 45001; expect(planner.next(input)).toBeUndefined(); expect(planner.active()).toBe(false);
  });
});

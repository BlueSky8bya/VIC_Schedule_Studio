import { describe, expect, it } from "vitest";
import { createBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const floor: Platform = { id: "outside-panel-ground", x: 0, y: 600, width: 1000, kind: "floor" };
const loft: Platform = { id: "isolated-food-loft", x: 100, y: 80, width: 200, kind: "date" };
function start(recipe: PersonalitySceneRecipe, reachable = false) {
  const world: CompanionWorld = { x: 100, y: 600, platformId: floor.id, platforms: [floor, loft], width: 1000, height: 720, animated: true,
    foods: [{ id: "unreachable-first", kind: "apple", x: 150, y: loft.y, platformId: loft.id },
      { id: "second-meal", kind: "bread", x: 900, y: reachable ? floor.y : loft.y, platformId: reachable ? floor.id : loft.id }] };
  const input: PersonalitySceneInput = { world, brain: { ...createBrain(0, () => .5), activeMs: 120000, hunger: .38, energy: .65 },
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: recipe.personality }, now: 120000, home: {}, toys: [], tv: "off" };
  const director = createCompanionPersonalityDirector([recipe], () => .5), entry = director.next(input)!;
  director.complete(entry.meta); input.now += entry.action!.duration + 10;
  const delegate = () => {
    for (let step = 0; step < 12; step++) {
      const proposal = director.next(input);
      if (!proposal || proposal.delegate) return proposal;
      if (proposal.action && ["walk", "jump"].includes(proposal.action.kind)) input.world = { ...input.world, ...proposal.action.target };
      director.complete(proposal.meta); input.now += proposal.action?.duration ?? 1;
    }
    throw Error("No finite food delegation");
  };
  return { director, input, delegate };
}

describe("dense meals admit actual reachable work before preparatory poses", () => {
  it.each(["G06", "G07", "D157-G"])("%s cannot repeatedly reserve an unreachable meal", id => {
    const host = start(COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === id)!);
    for (let turn = 0; turn < 18; turn++) {
      expect(host.director.next(host.input)).toBeUndefined();
      host.input.now += 1000;
    }
    expect(host.director.active()).toBe(false); expect(host.director.completed()).toEqual([]);
  });
  it("selects the reachable alternative and re-proves changed geometry with the same IDs", () => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === "G07")!, host = start(recipe);
    expect(host.director.next(host.input)).toBeUndefined();
    host.input.world = { ...host.input.world, platforms: [floor, { ...loft, y: floor.y }], foods: host.input.world.foods!.map(food => ({ ...food, y: floor.y })) };
    expect(host.delegate()?.delegate).toEqual({ kind: "food", mode: "eat" });
    const alternate = start(recipe, true);
    expect(alternate.delegate()?.meta.itemId).toBe("second-meal");
  });
  it("does not confuse a future eat cooldown with geometric unavailability or steal an existing bound ID", () => {
    const host = start(COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === "G07")!, true);
    host.input.brain.cooldowns.eat = 999999;
    const proposal = host.delegate()!;
    expect(proposal.meta.itemId).toBe("second-meal");
    host.input.world = { ...host.input.world, foods: [{ id: "replacement", kind: "bread", x: 650, y: floor.y, platformId: floor.id }] };
    expect(host.director.next(host.input)?.meta.itemId).toBe("second-meal");
    expect(host.director.completed()).toEqual([]);
  });
  it("allows a recipe to create its future meal under the existing object owner", () => {
    const recipe: PersonalitySceneRecipe = { id: "future-meal-owner", label: "future meal", personality: "gourmet", major: false,
      triggers: ["free"], steps: [{ kind: "food", mode: "spawn" }, { kind: "food", mode: "eat" }] };
    const host = start(recipe); host.input.world.foods = [];
    expect(host.delegate()?.delegate).toEqual({ kind: "food", mode: "spawn" });
    expect(host.director.completed()).toEqual([]);
  });
  it("proves a reachable candidate that actually satisfies the recipe's favorite condition", () => {
    const host = start(COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === "G01")!, true);
    host.input.favoriteFood = "apple";
    expect(host.director.next(host.input)).toBeUndefined();
    host.input.world = { ...host.input.world, foods: host.input.world.foods!.map(food => food.id === "second-meal" ? { ...food, kind: "apple" } : food) };
    expect(host.delegate()?.meta.itemId).toBe("second-meal");
  });
  it.each(["optional", "later"] as const)("a %s spawn cannot excuse an unreachable required meal", placement => {
    const eat = { kind: "food", mode: "eat" } as const, spawn = { kind: "food", mode: "spawn" } as const;
    const recipe: PersonalitySceneRecipe = { id: "unguaranteed-spawn-" + placement, label: "bounded meal", personality: "gourmet", major: false,
      triggers: ["free"], steps: placement === "optional" ? [{ ...spawn, optional: true }, eat] : [eat, spawn] };
    const host = start(recipe);
    expect(host.director.next(host.input)).toBeUndefined();
    expect(host.director.active()).toBe(false); expect(host.director.completed()).toEqual([]);
  });
});

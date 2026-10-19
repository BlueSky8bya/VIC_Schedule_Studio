import { describe, expect, it } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { getCompanionPersonalityMeal } from "@/lib/ui/viewer-companion/personality-jobs";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";

const floor: Platform = { id: "actual-floor", x: 0, y: 600, width: 1000, kind: "floor" };
function input(personality: CompanionPersonality = "tidy"): PersonalitySceneInput {
  return { world: { x: 100, y: 600, platformId: floor.id, platforms: [floor], width: 1000, height: 720, animated: true,
    foods: [{ id: "actual-apple", kind: "apple", x: 300, y: 600, platformId: floor.id }], pointer: { x: 500, y: 600, stableMs: 1000 } },
    brain: { ...createBrain(0, () => .5), hunger: .5, energy: .9 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality },
    now: 1000, home: {}, toys: [], tv: "off", favoriteFood: "apple" };
}

describe("140 real basic meals cannot be starved by personality fallback", () => {
  it.each(COMPANION_PERSONALITIES)("%s leaves an empty scene unowned so a proved middle-hunger meal proceeds without object mutation", personality => {
    const scene = input(personality), director = createCompanionPersonalityDirector([]);
    const entry = director.next(scene)!;
    expect(getCompanionPersonalityMeal(director, entry, scene)).toBeUndefined();
    const ready = director.next(scene); expect(ready).toBeUndefined();
    const before = JSON.stringify(scene), meal = getCompanionPersonalityMeal(director, ready, scene);
    expect(meal).toMatchObject({ kind: "walk", foodId: "actual-apple", target: { x: 300, y: 600, platformId: floor.id } });
    expect(JSON.stringify(scene)).toBe(before); expect(director.completed()).toEqual([]);
  });

  it.each(["G01", "C02", "A08", "B03"])("preserves %s inspection/greeting and its authored actual meal instead of skipping its personality", id => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === id)!, scene = input(recipe.personality);
    scene.world.foods = [...scene.world.foods!, { id: "actual-bread", kind: "bread", x: 500, y: 600, platformId: floor.id }];
    const director = createCompanionPersonalityDirector([recipe]); director.next(scene);
    const offer = director.next(scene)!; expect(offer.meta.id).toBe(id); expect(director.plansMeal()).toBe(true);
    expect(getCompanionPersonalityMeal(director, offer, scene)).toBeUndefined();
  });

  it.each(["feeding", "roam", "enabled", "paused", "animated", "full", "unreachable", "owned", "carried-toy", "carried-food"])("does not steal care or bypass %s", flag => {
    const scene = input(), director = createCompanionPersonalityDirector([]); director.next(scene); const ready = director.next(scene)!;
    if (["feeding", "roam", "enabled"].includes(flag)) scene.preferences = { ...scene.preferences, [flag]: false };
    if (flag === "paused") scene.world.paused = true;
    if (flag === "animated") scene.world.animated = false;
    if (flag === "full") scene.brain.hunger = .34;
    if (flag === "unreachable") scene.world.foods = [{ ...scene.world.foods![0], x: 200, y: 100, platformId: "missing-loft" }];
    expect(getCompanionPersonalityMeal(director, ready, { ...scene, ownedJob: flag === "owned", carriedToy: flag === "carried-toy" ? "real-toy" : undefined,
      carriedFood: flag === "carried-food" ? "real-food" : undefined })).toBeUndefined();
  });
});

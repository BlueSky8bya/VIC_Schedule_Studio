import { describe, expect, it } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe, type SceneBeat } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { MAX_COMPANION_TOYS } from "@/lib/ui/viewer-companion/toys";

const floor: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 700, kind: "floor", manualOnly: true };
const toy = { id: "same-real-ball", kind: "ball" as const, x: 240, y: floor.y, platformId: floor.id, angle: 0, held: false, carried: false };
const input = (recipe: PersonalitySceneRecipe): PersonalitySceneInput => ({
  world: { x: 250, y: floor.y, platformId: floor.id, platforms: [floor], width: 1000, height: 700, animated: true, foods: [] },
  brain: { ...createBrain(0, () => .5), hunger: .05, energy: .9 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: recipe.personality },
  now: 0, home: { box: { x: 250, y: floor.y, platformId: floor.id } }, toys: [], toyCount: 0, tv: "off",
});
const prepare = (recipe: PersonalitySceneRecipe) => {
  const scene = input(recipe), director = createCompanionPersonalityDirector([recipe]); director.complete(director.next(scene)!.meta);
  return { scene, director };
};
const required = COMPANION_PERSONALITY_SCENES.filter(recipe => recipe.steps.some(step => step.kind === "toy" && step.mode === "spawn" && !step.optional));

describe("141 authored toy takeout shares the physical spawn admission", () => {
  it.each(required)("does not start $id when ambient interaction is explicitly OFF", recipe => {
    const { scene, director } = prepare(recipe); scene.preferences.ambientPrank = false;
    for (let tick = 0; tick < 5; tick++) {
      scene.now = tick * 9000; const proposal = director.next(scene);
      expect(proposal?.meta.id).not.toBe(recipe.id); expect(proposal?.delegate).toBeUndefined();
      if (proposal) director.complete(proposal.meta);
    }
    expect(director.completed()).toEqual([]); expect(scene.toys).toEqual([]);
  });

  it.each(required)("does not start $id when four actual objects include held or hidden toys", recipe => {
    const { scene, director } = prepare(recipe); scene.toys = [{ ...toy, held: true }]; scene.toyCount = MAX_COMPANION_TOYS;
    expect(director.next(scene)?.meta.id).not.toBe(recipe.id); expect(director.active()).toBe(false);
    expect(director.completed()).toEqual([]); expect(scene.toys[0].held).toBe(true);
  });

  it.each(required)("still counts its visible actual four even if a supplied subset count is smaller: $id", recipe => {
    const { scene, director } = prepare(recipe); scene.toys = Array.from({ length: MAX_COMPANION_TOYS }, (_, i) => ({ ...toy, id: `real-${i}`, x: 240 + i * 30 }));
    scene.toyCount = 0; expect(director.next(scene)?.meta.id).not.toBe(recipe.id);
  });

  it.each(required)("offers $id with permission and a real free slot without inventing any spawned ID", recipe => {
    const { scene, director } = prepare(recipe), proposal = director.next(scene)!;
    expect(proposal).toMatchObject({ meta: { id: recipe.id }, delegate: { kind: "toy", mode: "spawn" } });
    expect(proposal.meta.itemId).toBeUndefined(); expect(scene.toys).toEqual([]); expect(director.completed()).toEqual([]);
    director.complete(proposal.meta); expect(director.current()?.beat).toBe(proposal.meta.beat);
  });

  it.each(["inspect", "play", "return"] as const)("keeps real existing toy %s available when takeout is OFF and capacity is full", mode => {
    const recipe: PersonalitySceneRecipe = { id: `existing-${mode}`, label: "Existing real object", personality: "curious", major: true, triggers: ["free"], steps: [{ kind: "toy", mode }] };
    const { scene, director } = prepare(recipe); scene.preferences.ambientPrank = false; scene.toys = [toy]; scene.toyCount = 4;
    expect(director.next(scene)).toMatchObject({ meta: { id: recipe.id, itemId: toy.id }, delegate: { kind: "toy", mode } });
    expect(scene.toys).toEqual([toy]);
  });

  it("does not exclude an otherwise useful recipe merely for an optional takeout", () => {
    const steps: readonly SceneBeat[] = [{ kind: "toy", mode: "spawn", optional: true }, { kind: "pose", pose: "bow" }];
    const recipe: PersonalitySceneRecipe = { id: "optional-takeout", label: "Optional extra", personality: "curious", major: false, triggers: ["free"], steps };
    const { scene, director } = prepare(recipe); scene.preferences.ambientPrank = false; scene.toyCount = 4;
    const proposal = director.next(scene)!; expect(proposal.meta.id).toBe(recipe.id); director.resolve(proposal.meta, false);
    expect(director.next(scene)).toMatchObject({ meta: { id: recipe.id, beat: 1 }, action: { play: "bow" } });
    expect(director.completed()).toEqual([]);
  });
});

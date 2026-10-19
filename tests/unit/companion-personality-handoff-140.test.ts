import { describe, expect, it, vi } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, nextCompanionPersonalityScene, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const floor: Platform = { id: "companion-home-floor", x: 50, y: 600, width: 740, kind: "floor", manualOnly: true };
function fixture() {
  const scene: PersonalitySceneInput = {
    world: { x: 120, y: 600, platformId: floor.id, platforms: [floor], width: 900, height: 720, animated: true, foods: [] },
    brain: { ...createBrain(0, () => .5), energy: .9, hunger: .5 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "performer" }, now: 0,
    home: { floor: { x: 300, y: 600, platformId: floor.id }, box: { x: 680, y: 600, platformId: floor.id } }, tv: "off",
    toys: [{ id: "same-native-maraca", kind: "maraca", x: 340, y: 600, platformId: floor.id, angle: 0, held: false, carried: false }],
  };
  const director = createCompanionPersonalityDirector(COMPANION_PERSONALITY_SCENES.filter(recipe => ["P01", "P02", "P11"].includes(recipe.id)));
  director.next(scene); director.event("arrival", 0);
  return { scene, director };
}

describe("140 authored scene ownership across actionless transitions", () => {
  it("lets an affectionate resident approach a real blank pointer on its measured room floor while other manual surfaces remain excluded", () => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === "A01")!;
    const { scene } = fixture(); scene.preferences.personality = "affectionate";
    scene.world.pointer = { x: 500, y: 600, stableMs: 1000 };
    const director = createCompanionPersonalityDirector([recipe]); director.next(scene);
    const approach = nextCompanionPersonalityScene(director, scene)!;
    expect(approach.meta.id).toBe("A01"); expect(approach.action).toMatchObject({ kind: "walk", target: { x: 476, y: 600, platformId: floor.id } });
    for (const surface of [{ ...floor, bodyOnly: true }, { ...floor, id: "unrelated-manual-platform" }]) {
      const blocked = createCompanionPersonalityDirector([recipe]);
      const input = { ...scene, world: { ...scene.world, platformId: surface.id, platforms: [surface] } };
      blocked.next(input); expect(nextCompanionPersonalityScene(blocked, input)?.meta.id).not.toBe("A01");
    }
  });

  it("hands the reached final P01 waypoint directly to P02 with its same maraca, leaving no gap for a generic toss", () => {
    const { scene, director } = fixture();
    for (let n = 0; n < 10; n++) {
      const proposal = nextCompanionPersonalityScene(director, scene)!;
      if (proposal.meta.id === "P02") {
        expect(director.completed()).toContain("P01");
        expect(proposal.delegate).toMatchObject({ kind: "toy", mode: "inspect" });
        expect(proposal.meta.itemId).toBe("same-native-maraca");
        expect(scene.toys).toHaveLength(1); expect(scene.toys[0].carried).toBe(false);
        return;
      }
      expect(proposal.meta.id).toBe("P01");
      const action = proposal.action!;
      if (action.kind === "walk" || action.kind === "jump") scene.world = { ...scene.world, ...action.target };
      scene.now += action.duration; director.complete(proposal.meta);
    }
    throw new Error("P01 failed to hand ownership to its actual available P02");
  });

  it("retries at most once and preserves OFF without advancing any clock or inventing a completion", () => {
    const { scene, director } = fixture();
    const started = director.next(scene)!; expect(started.meta.id).toBe("P01");
    const call = vi.spyOn(director, "next"); scene.preferences.roam = false;
    const before = JSON.stringify(scene);
    expect(nextCompanionPersonalityScene(director, scene)).toBeUndefined(); expect(call).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(scene)).toBe(before); expect(director.completed()).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const floor: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 1000, kind: "floor", manualOnly: true };
function fixture(id: string, music: PersonalitySceneInput["music"]) {
  const recipe = COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === id)!;
  const director = createCompanionPersonalityDirector([recipe]);
  const scene: PersonalitySceneInput = {
    world: { x: 150, y: 600, platformId: floor.id, platforms: [floor], width: 1000, height: 720, animated: true, foods: [] },
    brain: { ...createBrain(0, () => .5), energy: .9, hunger: .1 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: recipe.personality },
    now: 0, home: { sofa: { x: 150, y: 600, platformId: floor.id }, box: { x: 800, y: 600, platformId: floor.id } },
    toys: [{ id: "real-ball", kind: "ball", x: 400, y: 600, platformId: floor.id, angle: 0, held: false, carried: false }], tv: "off", music,
  };
  director.next(scene); for (const trigger of recipe.triggers) director.event(trigger, 0);
  return { director, scene };
}

describe("140 actual music source, mood and familiarity admission", () => {
  it.each(["X-S-music", "X-M-music", "H10", "X-H-music"])("%s rejects an old music signal without a currently audible source", id => {
    const { director, scene } = fixture(id, undefined);
    scene.hasExperience = true; expect(director.next(scene)?.meta.id).not.toBe(id);
  });

  it.each([["X-S-music", "calm", "lively"], ["X-M-music", "lively", "calm"]] as const)("%s starts only for %s and cancels if the source changes to %s", (id, fitting, wrong) => {
    const rejected = fixture(id, { mood: wrong, familiar: false }); expect(rejected.director.next(rejected.scene)?.meta.id).not.toBe(id);
    const { director, scene } = fixture(id, { mood: fitting, familiar: false });
    const first = director.next(scene)!; expect(first.meta.id).toBe(id); director.complete(first.meta);
    scene.music = { mood: wrong, familiar: false }; scene.now += first.action!.duration;
    expect(director.next(scene)?.meta.id).not.toBe(id); expect(director.completed()).not.toContain(id);
  });

  it.each(["H10", "X-H-music"])("%s requires actual listening familiarity instead of unrelated discoveries", id => {
    const unrelated = fixture(id, { mood: "calm", familiar: false }); unrelated.scene.hasExperience = true;
    expect(unrelated.director.next(unrelated.scene)?.meta.id).not.toBe(id);
    const familiar = fixture(id, { mood: "calm", familiar: true });
    expect(familiar.director.next(familiar.scene)?.meta.id).toBe(id);
    const off = fixture(id, { mood: "calm", familiar: true }); off.scene.preferences.learnFromYou = false;
    expect(off.director.next(off.scene)?.meta.id).not.toBe(id);
  });

  it("stopping or muting the real source cancels an in-flight music sequence without success ACK", () => {
    const { director, scene } = fixture("H10", { mood: "calm", familiar: true });
    const first = director.next(scene)!; expect(first.meta.id).toBe("H10");
    director.complete(first.meta); scene.music = undefined; scene.now += first.action!.duration;
    expect(director.next(scene)?.meta.id).not.toBe("H10"); expect(director.completed()).toEqual([]);
  });
});

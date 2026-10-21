import { describe, expect, it } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_TOY_USES, companionToyPlayDuration } from "@/lib/ui/viewer-companion/toy-play";

const recipe = COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === "M02")!;
const floor: Platform = { id: "ordinary-floor", x: 0, y: 600, width: 1000, kind: "floor" };
const car = { id: "actual-car-1", kind: "toy-car" as const, x: 180, y: 600, platformId: floor.id, angle: 0, held: false, carried: false };
function start() {
  const scene: PersonalitySceneInput = { world: { x: 180, y: 600, platformId: floor.id, platforms: [floor], width: 1000, height: 700, animated: true },
    brain: { ...createBrain(0, () => .5), hunger: .1, energy: .95, activeMs: 0 },
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "mischievous", roam: true, sleep: false },
    now: 0, home: { box: { x: 400, y: 600, platformId: floor.id } }, toys: [{ ...car }], tv: "off" };
  const director = createCompanionPersonalityDirector([recipe]);
  const entry = director.next(scene)!; expect(entry.meta.id).toBe("entry-mischievous");
  director.complete(entry.meta); scene.now += entry.action!.duration; director.event("toy", scene.now);
  return { scene, director };
}
/** Pure director/ACK protocol. Actual source paint,2800ms animation and
 * collection remain mandatory in the existing149 and added200 native case. */
describe("157 car use before mischievous cleanup", () => {
  it("keeps required wheel-push first and preserves nudge, chase, pounce and return", () => {
    expect(recipe.steps[0]).toMatchObject({ kind: "toy", mode: "play", kinds: ["toy-car"] });
    expect(recipe.steps.every(step => !step.optional)).toBe(true);
    expect(recipe.steps.filter(step => step.kind === "toy").map(step => step.mode)).toEqual(["play", "nudge", "return"]);
    expect(recipe.steps[2]).toEqual({ kind: "go", target: "toy" });
    expect(recipe.steps[3]).toEqual({ kind: "pose", pose: "pounce" });
    expect(COMPANION_TOY_USES[car.kind]).toBe("wheel-push"); expect(companionToyPlayDuration(car.kind)).toBe(2800);
  });
  it("elapsed time and a generic completed pose cannot skip the required real play ACK", () => {
    const { director, scene } = start(), first = director.next(scene)!;
    expect(first.delegate).toMatchObject({ kind: "toy", mode: "play" });
    director.bind(first.meta, car.id); scene.now += 10000; director.complete(first.meta);
    expect(director.completed()).not.toContain("M02"); expect(director.current()?.beat).toBe(0);
  });
  it("retains one same-ID owner through play, actual nudge, chase, pounce and removal", () => {
    const { director, scene } = start(), operations: string[] = [], serials = new Set<number>();
    for (let n = 0; n < 80 && !director.completed().includes("M02"); n++) {
      const proposal = director.next(scene); if (!proposal) { scene.now += 10; continue; }
      expect(proposal.meta.id).toBe("M02"); serials.add(proposal.meta.serial);
      if (proposal.action?.personalityScene.travel) {
        scene.world = { ...scene.world, ...proposal.action.target }; scene.now += proposal.action.duration;
        director.complete(proposal.meta); continue;
      }
      if (proposal.delegate?.kind === "toy") {
        expect(proposal.meta.itemId).toBe(car.id); director.bind(proposal.meta, car.id);
        const mode = proposal.delegate.mode; operations.push(mode);
        if (mode === "play") { expect(scene.toys[0].id).toBe(car.id); scene.now += companionToyPlayDuration(car.kind); }
        if (mode === "nudge") scene.toys = scene.toys.map(toy => ({ ...toy, x: toy.x + 32 }));
        if (mode === "return") scene.toys = [];
        director.resolve(proposal.meta, true, car.id); scene.now += 600;
      } else {
        expect(proposal.meta.command).toMatchObject({ kind: "pose", pose: "pounce" });
        operations.push("pounce"); scene.now += proposal.action!.duration; director.complete(proposal.meta);
      }
    }
    expect(operations).toEqual(["play", "nudge", "pounce", "return"]); expect(serials.size).toBe(1);
    expect(scene.toys).toEqual([]); expect(director.completed()).toContain("M02");
  });
  it.each(["missing", "wrong-kind", "held", "hidden"] as const)("does not admit a%s car as a completed typed-use opportunity", defect => {
    const { director, scene } = start();
    if (defect === "missing") scene.toys = [];
    if (defect === "wrong-kind") scene.toys = [{ ...car, kind: "ball" }];
    if (defect === "held") scene.toys = [{ ...car, held: true }];
    if (defect === "hidden") scene.toys = [{ ...car, hidden: true }];
    expect(director.next(scene)).toBeUndefined(); expect(director.completed()).not.toContain("M02");
  });
  it("losing the bound real car cannot silently substitute a second same-kind object", () => {
    const { director, scene } = start(), first = director.next(scene)!;
    expect(first.delegate).toMatchObject({ kind: "toy", mode: "play" }); director.bind(first.meta, car.id);
    director.resolve(first.meta, true, car.id); scene.now += 2800;
    scene.toys = [{ ...car, id: "unrelated-car-2" }];
    const next = director.next(scene);
    expect(next?.meta.itemId).not.toBe("unrelated-car-2"); expect(director.completed()).not.toContain("M02");
  });
});

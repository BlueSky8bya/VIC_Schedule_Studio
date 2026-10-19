import { describe, expect, it } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionRoutineArbiter, type CompanionRoutineInput } from "@/lib/ui/viewer-companion/routine-arbiter";

const floor: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 650, kind: "floor", manualOnly: true };
const sofa: Platform = { id: "companion-home", x: 20, y: 570, width: 150, kind: "floor" };
const outside: Platform = { id: "ordinary-date", x: 700, y: 600, width: 150, kind: "date" };
const input = (personality: CompanionPersonality = "balanced"): CompanionRoutineInput => ({
  world: { x: 200, y: floor.y, platformId: floor.id, platforms: [floor, sofa], width: 1000, height: 700, animated: true },
  brain: { ...createBrain(0, () => .5), hunger: .2, energy: .9 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality },
  now: 0, active: true, entryReady: true, home: { radio: { x: 250, y: floor.y, platformId: floor.id }, contacts: { radio: { x: 252, y: 550 } }, sofa: { x: 80, y: sofa.y, platformId: sofa.id } },
  toys: [], tv: "off", radioAllowed: true, radioPlaying: false,
});

describe("141 common music is subordinate real leisure", () => {
  it.each(COMPANION_PERSONALITIES)("%s waits35 active seconds, then actually turns on radio before going to the sofa", personality => {
    const arbiter = createCompanionRoutineArbiter(), scene = input(personality);
    expect(arbiter.next(scene)).toBeUndefined(); scene.now = 34999; expect(arbiter.next(scene)).toBeUndefined(); scene.now = 35000;
    const requested = arbiter.next(scene)!;
    expect(requested).toMatchObject({ kind: "music", reason: "music", recipe: { id: "routine-music", personality } });
    expect(requested.recipe.steps).toEqual([{ kind: "radio", playing: true }, { kind: "go", target: "sofa" }, { kind: "watch", ms: 1800 }]);
  });

  it("requires explicit actual radio permission, a supported approach and a measured contact", () => {
    for (const state of ["sound-off", "lease", "no-permission", "playing", "unknown-state", "no-radio", "no-contact", "invalid-contact", "no-platform", "off-support", "no-sofa"] as const) {
      const arbiter = createCompanionRoutineArbiter(), scene = input(); arbiter.next(scene); scene.now = 35000;
      if (state === "sound-off") scene.preferences.sound = false;
      if (state === "lease") scene.radioAllowed = false;
      if (state === "no-permission") scene.radioAllowed = undefined;
      if (state === "playing") scene.radioPlaying = true;
      if (state === "unknown-state") scene.radioPlaying = undefined;
      if (state === "no-radio") delete scene.home.radio;
      if (state === "no-contact") delete scene.home.contacts;
      if (state === "invalid-contact") scene.home.contacts!.radio!.y = Number.NaN;
      if (state === "no-platform") scene.home.radio!.platformId = "missing-support";
      if (state === "off-support") scene.home.radio!.y = 500;
      if (state === "no-sofa") delete scene.home.sofa;
      expect(arbiter.next(scene), state).toBeUndefined();
    }
  });

  it("never preempts real hunger, low energy, hygiene or an overdue outside walk", () => {
    for (const state of ["meal", "energy", "wash", "outing"] as const) {
      const arbiter = createCompanionRoutineArbiter(), scene = input(); arbiter.next(scene); scene.now = 35000;
      if (state === "meal") { scene.brain.hunger = .5; scene.world.foods = [{ id: "real", kind: "carrot", x: 200, y: floor.y, platformId: floor.id }]; scene.meal = { foodId: "real" }; }
      if (state === "energy") scene.brain.energy = .3;
      if (state === "wash") { const pad: Platform = { id: "companion-home-floor-400", kind: "floor", bodyOnly: true, manualOnly: true, x: 400, width: 40, y: 600 }; scene.world.platforms = [floor, sofa, pad]; scene.home.pad = { x: 420, y: 600, platformId: pad.id }; arbiter.observe("ate", 1); }
      if (state === "outing") scene.world.platforms = [floor, sofa, outside];
      const selected = arbiter.next(scene); expect(selected?.kind, state).not.toBe("music");
      if (state !== "energy") expect(selected, state).toBeTruthy();
    }
  });

  it.each(COMPANION_PERSONALITIES)("%s cadence starts from actual player acknowledgement and stays75–90seconds", personality => {
    const arbiter = createCompanionRoutineArbiter(), scene = input(personality); arbiter.next(scene); scene.now = 35000;
    expect(arbiter.next(scene)?.kind).toBe("music"); arbiter.observe("played", 36000); expect(arbiter.current()).toBe("music");
    arbiter.observe("music-started", 36000); expect(arbiter.current()).toBeUndefined();
    const cadence = personality === "homebody" || personality === "performer" ? 75000 : 90000;
    scene.now = 36000 + cadence - 1; expect(arbiter.next(scene)).toBeUndefined(); scene.now++;
    expect(arbiter.next(scene)?.kind).toBe("music");
  });

  it("does not acknowledge elapsed radio gestures; after the actual ON acknowledgement it walks and rests on sofa", () => {
    const scene = input(), arbiter = createCompanionRoutineArbiter(), director = createCompanionPersonalityDirector([]);
    director.complete(director.next(scene)!.meta); arbiter.next(scene); scene.now = 35000;
    const requested = arbiter.next(scene)!; expect(director.startRoutine(requested.recipe, scene.now)).toBe(true);
    const approach = director.next(scene)!; expect(approach.meta.travel).toBe(true); expect(approach.action?.kind).toBe("walk");
    scene.world = { ...scene.world, ...approach.action!.target }; scene.now += approach.action!.duration;
    const contact = director.next(scene)!; expect(contact.meta.command).toEqual({ kind: "radio", playing: true }); expect(contact.meta.interactionContact).toEqual(scene.home.contacts!.radio);
    director.complete(contact.meta); expect(director.current()?.beat).toBe(0); expect(arbiter.current()).toBe("music");
    scene.radioPlaying = true; director.resolve(contact.meta, true); arbiter.observe("music-started", scene.now);
    let resting = false;
    for (let n = 0; n < 8 && director.active(); n++) {
      const proposal = director.next(scene); if (!proposal) continue;
      if (proposal.meta.travel) { scene.world = { ...scene.world, ...proposal.action!.target }; scene.now += proposal.action!.duration; }
      else { expect(proposal.action?.kind).toBe("look"); expect(proposal.action?.duration).toBe(1800); expect(scene.world.platformId).toBe(sofa.id); resting = true; director.complete(proposal.meta); }
    }
    expect(resting).toBe(true); expect(director.completed()).toContain("routine-music");
  });
});

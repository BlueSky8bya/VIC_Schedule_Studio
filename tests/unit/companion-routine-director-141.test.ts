import { describe, expect, it } from "vitest";
import { createBrain, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import type { PersonalitySceneRecipe, SceneBeat } from "@/lib/ui/viewer-companion/personality-scene-catalog";

const floor: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 650, kind: "floor", manualOnly: true };
const pad: Platform = { id: "companion-home-floor-400", x: 450, y: 600, width: 60, kind: "floor", manualOnly: true, bodyOnly: true };
const sofa: Platform = { id: "companion-home", x: 0, y: 570, width: 150, kind: "floor" };
const outside: Platform = { id: "actual-date", x: 700, y: 600, width: 300, kind: "date" };
const input = (): PersonalitySceneInput => ({
  world: { x: 200, y: floor.y, platformId: floor.id, platforms: [floor, pad, sofa, outside], width: 1000, height: 700, animated: true, foods: [{ id: "actual-carrot", kind: "carrot", x: 260, y: floor.y, platformId: floor.id }] },
  brain: { ...createBrain(0, () => .5), hunger: .5, energy: .45 }, preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "balanced" },
  now: 0, home: { floor: { x: 320, y: floor.y, platformId: floor.id }, pad: { x: 480, y: pad.y, platformId: pad.id }, sofa: { x: 80, y: sofa.y, platformId: sofa.id }, window: { x: 240, y: floor.y, platformId: floor.id }, tv: { x: 240, y: floor.y, platformId: floor.id }, light: { x: 240, y: floor.y, platformId: floor.id }, radio: { x: 240, y: floor.y, platformId: floor.id }, contacts: { tv: { x: 245, y: 560 }, light: { x: 240, y: 520 }, curtain: { x: 245, y: 550 }, radio: { x: 240, y: 540 } } },
  toys: [], tv: "off", canTv: true, canCurtain: true, radioAllowed: true, curtainPhase: "open", radioPlaying: false, lightLit: true,
});
const recipe = (steps: readonly SceneBeat[], id = "routine-meal"): PersonalitySceneRecipe => ({ id, personality: "balanced", label: "Actual common routine", major: true, triggers: ["free"], steps });
const ready = (scene = input()) => {
  const director = createCompanionPersonalityDirector([]), entry = director.next(scene)!; director.complete(entry.meta);
  return { director, scene };
};

describe("141 common routines execute through the existing physical director", () => {
  it("requires the actual current entry completion, rejecting travel and stale entry acknowledgements", () => {
    const director = createCompanionPersonalityDirector([]), scene = input();
    const request = recipe([{ kind: "food", mode: "eat" }]);
    expect(director.startRoutine(request, 0)).toBe(false);
    const entry = director.next(scene)!; expect(director.entryReady()).toBe(false);
    director.resolve(entry.meta, true); director.complete({ ...entry.meta, serial: entry.meta.serial - 1 }); director.complete({ ...entry.meta, travel: true });
    expect(director.entryReady()).toBe(false); expect(director.startRoutine(request, 0)).toBe(false);
    director.complete(entry.meta); expect(director.entryReady()).toBe(true); expect(director.startRoutine(request, 0, "actual-carrot")).toBe(true);
    expect(director.current()).toEqual({ id: "routine-meal", beat: 0, routine: true, itemId: "actual-carrot" });
    expect(director.startRoutine(request, 1)).toBe(false); // Existing routine owns its work.
  });

  it("binds the exact proved meal and does not treat elapsed time or travel as eating", () => {
    const { director, scene } = ready();
    expect(director.startRoutine(recipe([{ kind: "food", mode: "inspect" }, { kind: "food", mode: "eat" }]), 0, "actual-carrot")).toBe(true);
    const inspect = director.next(scene)!; expect(inspect).toMatchObject({ meta: { routine: true, itemId: "actual-carrot" }, delegate: { kind: "food", mode: "inspect" } });
    director.complete(inspect.meta); expect(director.current()?.beat).toBe(0);
    director.resolve({ ...inspect.meta, travel: true }, true, "actual-carrot"); expect(director.current()?.beat).toBe(0);
    director.resolve(inspect.meta, true, "actual-carrot");
    const eating = director.next(scene)!; expect(eating).toMatchObject({ meta: { routine: true, itemId: "actual-carrot" }, delegate: { kind: "food", mode: "eat" } });
    director.complete(eating.meta); expect(director.completed()).toEqual([]);
    director.resolve(eating.meta, true, "actual-carrot"); expect(director.completed()).toEqual(["routine-meal"]);
  });

  it.each(["tv", "light", "curtain", "radio"] as const)("approaches %s on a real support, then exposes the measured handle and waits for its actual effect", kind => {
    const { director, scene } = ready();
    const command: SceneBeat = kind === "tv" ? { kind, state: "nature" } : kind === "light" ? { kind, lit: false } : kind === "curtain" ? { kind, phase: "closed" } : { kind, playing: true };
    director.startRoutine(recipe([command]), 0); scene.world.x = 215;
    const travel = director.next(scene)!; expect(travel.meta.travel).toBe(true); expect(travel.action?.kind).toBe("walk");
    director.complete(travel.meta); director.resolve(travel.meta, true); expect(director.current()?.beat).toBe(0);
    // The two pull cords require their measured floor stance; TV/radio
    // retain their ordinary furniture approach tolerance.
    scene.world.x = kind === "light" ? scene.home.light!.x : kind === "curtain" ? scene.home.window!.x : 216; scene.now += 100;
    const interaction = director.next(scene)!; expect(interaction.meta.travel).toBeUndefined();
    expect(interaction.action?.kind).toBe("play"); expect(interaction.meta.interactionContact).toEqual(scene.home.contacts![kind]);
    expect(interaction.action?.personalityScene.interactionContact).toEqual(scene.home.contacts![kind]);
    director.complete(interaction.meta); expect(director.current()?.beat).toBe(0);
    director.resolve(interaction.meta, true); expect(director.completed()).toEqual(["routine-meal"]);
  });

  it.each(["tv", "light", "curtain", "radio"] as const)("fails closed when %s has no actual handle, even though its body slot exists", kind => {
    const { director, scene } = ready(); scene.world.x = 240; delete scene.home.contacts![kind];
    const command: SceneBeat = kind === "tv" ? { kind, state: "nature" } : kind === "light" ? { kind, lit: false } : kind === "curtain" ? { kind, phase: "closed" } : { kind, playing: true };
    director.startRoutine(recipe([command]), 0); expect(director.next(scene)).toBeUndefined(); expect(director.active()).toBe(false); expect(director.completed()).toEqual([]);
  });

  it("requires the same support even if a different shelf is spatially within24px", () => {
    const { director, scene } = ready(); scene.world.x = 240;
    scene.home.radio = { x: 240, y: 570, platformId: sofa.id }; director.startRoutine(recipe([{ kind: "radio", playing: true }]), 0);
    const proposed = director.next(scene); expect(proposed?.meta.travel || !proposed).toBe(true); expect(proposed?.meta.interactionContact).toBeUndefined();
  });

  it("approaches the actual edge curtain cord stance instead of the distant window centre", () => {
    const { director, scene } = ready(), size = 76;
    scene.home.window = { x: 110, y: floor.y, platformId: floor.id };
    scene.home.curtain = { x: 390, y: floor.y, platformId: floor.id };
    scene.home.contacts!.curtain = { x: 390, y: floor.y - 45 };
    expect(Math.abs(scene.home.contacts!.curtain.x - scene.home.window.x)).toBeGreaterThan(size * .48);
    director.startRoutine(recipe([{ kind: "curtain", phase: "closed" }], "routine-sleep"), 0);
    const approach = director.next(scene)!;
    expect(approach.meta.travel).toBe(true); expect(approach.action?.target).toEqual(scene.home.curtain);
    director.complete(approach.meta); director.resolve(approach.meta, true); expect(director.current()?.beat).toBe(0);
    scene.world = { ...scene.world, ...approach.action!.target }; scene.now += approach.action!.duration;
    const contact = director.next(scene)!;
    expect(contact.meta.travel).toBeUndefined(); expect(contact.meta.interactionContact).toEqual(scene.home.contacts!.curtain);
    expect(contact.action?.target.x).toBe(scene.home.curtain.x); director.complete(contact.meta); expect(director.completed()).toEqual([]);
    director.resolve(contact.meta, true); expect(director.completed()).toEqual(["routine-sleep"]);
  });

  it.each(["tv", "curtain", "radio"] as const)("honors manual %s priority before approaching or changing it, but consumes already-satisfied steps", kind => {
    for (const satisfied of [false, true]) {
      const { director, scene } = ready(); scene.canTv = scene.canCurtain = scene.radioAllowed = false;
      const command: SceneBeat = kind === "tv" ? { kind, state: "nature" } : kind === "curtain" ? { kind, phase: "closed" } : { kind, playing: true };
      if (satisfied) { scene.tv = "nature"; scene.curtainPhase = "closed"; scene.radioPlaying = true; }
      director.startRoutine(recipe([command]), 0); expect(director.next(scene)).toBeUndefined();
      expect(director.completed()).toEqual(satisfied ? ["routine-meal"] : []);
    }
  });

  it("keeps sound OFF authoritative and does not turn on the radio", () => {
    const { director, scene } = ready(); scene.preferences.sound = false; scene.world.x = 240;
    director.startRoutine(recipe([{ kind: "radio", playing: true }]), 0); expect(director.next(scene)).toBeUndefined(); expect(director.completed()).toEqual([]);
  });

  it("admits only the exact pad400 body stance and preserves its last approach until feet touch", () => {
    const { director, scene } = ready(); scene.world.x = 479; scene.world.platformId = pad.id;
    director.startRoutine(recipe([{ kind: "wash", ms: 2500 }], "routine-wash"), 0);
    const washing = director.next(scene)!; expect(washing).toMatchObject({ action: { kind: "play", play: "groom", target: { platformId: pad.id } }, meta: { routine: true, command: { kind: "wash" } } });
    expect(washing.action!.duration).toBe(2500);
    director.complete(washing.meta); expect(director.completed()).toEqual([]);
    director.resolve(washing.meta, true, undefined, scene.now + washing.action!.duration);
    expect(director.completed()).toEqual(["routine-wash"]);
    const approaching = ready(); approaching.scene.world.x = 476; approaching.scene.world.platformId = pad.id;
    approaching.director.startRoutine(recipe([{ kind: "wash", ms: 2500 }], "routine-wash"), 0);
    const last = approaching.director.next(approaching.scene)!;
    expect(last.meta.travel).toBe(true); expect(last.action?.target).toMatchObject({ x: 480, y: pad.y, platformId: pad.id });
  });

  it("never washes on the trash/front floor or a vanished/not-body-only pad", () => {
    for (const state of ["ordinary", "wrong-y", "missing", "not-body"] as const) {
      const { director, scene } = ready();
      if (state === "ordinary") scene.home.pad = { x: 480, y: floor.y, platformId: floor.id };
      if (state === "wrong-y") scene.home.pad = { x: 480, y: floor.y - 4, platformId: pad.id };
      if (state === "missing") scene.world.platforms = [floor, sofa, outside];
      if (state === "not-body") scene.world.platforms = [floor, { ...pad, bodyOnly: false }, sofa, outside];
      director.startRoutine(recipe([{ kind: "wash", ms: 2500 }], "routine-wash"), 0);
      expect(director.next(scene), state).toBeUndefined(); expect(director.completed(), state).toEqual([]);
    }
  });

  it("performs a selected real sleep need despite the signature's lower legacy threshold; sleep OFF cancels it", () => {
    for (const off of [false, true]) {
      const { director, scene } = ready(); scene.world.x = 80; scene.world.y = sofa.y; scene.world.platformId = sofa.id; scene.preferences.sleep = !off;
      director.startRoutine(recipe([{ kind: "sleep", ms: 3000 }], "routine-sleep"), 0);
      const proposed = director.next(scene); expect(proposed?.action?.kind === "sleep").toBe(!off);
      expect(director.completed()).toEqual([]);
      if (!off) { expect(proposed?.action?.duration).toBe(3000); director.complete(proposed!.meta); expect(director.completed()).toEqual(["routine-sleep"]); }
    }
  });

  it("cancels a pending meal if feeding is disabled without issuing a delegated food action", () => {
    const { director, scene } = ready(); director.startRoutine(recipe([{ kind: "food", mode: "eat" }]), 0, "actual-carrot"); scene.preferences.feeding = false;
    expect(director.next(scene)?.delegate).toBeUndefined(); expect(director.current()?.id).not.toBe("routine-meal"); expect(director.completed()).toEqual([]);
  });

  it("routes an outing to a real outside support instead of counting another room span as leaving home", () => {
    const { director, scene } = ready(); director.startRoutine(recipe([{ kind: "go", target: "novel-place" }], "routine-outing"), 0);
    for (let step = 0; step < 8 && director.active(); step++) {
      const proposed = director.next(scene); if (!proposed) continue;
      expect(proposed.meta.travel).toBe(true); expect(proposed.action).toBeTruthy();
      scene.world = { ...scene.world, ...proposed.action!.target }; scene.now += proposed.action!.duration;
    }
    expect(scene.world.platformId).toBe(outside.id); expect(director.completed()).toEqual(["routine-outing"]);
    const invalid = ready(); invalid.scene.world.platforms = [floor, sofa, pad];
    invalid.director.startRoutine(recipe([{ kind: "go", target: "novel-place" }], "routine-outing"), 0);
    expect(invalid.director.next(invalid.scene)).toBeUndefined(); expect(invalid.director.completed()).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { createBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionExplorationMemory } from "@/lib/ui/viewer-companion/exploration-memory";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionPersonalityJobs } from "@/lib/ui/viewer-companion/personality-jobs";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { createCompanionToyPlanner } from "@/lib/ui/viewer-companion/toys";

const room: Platform = { id: "companion-home-floor-2", x: 0, y: 600, width: 220, kind: "floor", manualOnly: true };
const one: Platform = { id: "public-first", x: 240, y: 600, width: 160, kind: "date" };
const two: Platform = { id: "public-second", x: 440, y: 600, width: 160, kind: "date" };
const three: Platform = { id: "public-third", x: 640, y: 600, width: 160, kind: "date" };
const recipe = (id: string) => COMPANION_PERSONALITY_SCENES.find(recipe => recipe.id === id)!;
const scene = (atHome = false): PersonalitySceneInput => ({
  world: { x: atHome ? 130 : 320, y: 600, platformId: atHome ? room.id : one.id, platforms: [room, one, two, three], width: 1000, height: 800, animated: true },
  brain: { ...createBrain(0, () => .5), hunger: .05, energy: .95, heading: -1 },
  preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "curious" }, now: 0, home: {}, toys: [], tv: "off",
});
const prepare = (d: ReturnType<typeof createCompanionPersonalityDirector>, s: PersonalitySceneInput) => {
  const entry = d.next(s)!; s.now += entry.action!.duration; d.complete(entry.meta);
};
const perform = (d: ReturnType<typeof createCompanionPersonalityDirector>, s: PersonalitySceneInput) => {
  const offer = d.next(s); if (!offer?.action) return offer;
  s.now += offer.action.duration;
  if (offer.meta.travel) s.world = { ...s.world, ...offer.action.target };
  d.complete(offer.meta); s.now += 80; return offer;
};

describe("approved exploration intent follows actual novelty instead of a local ritual", () => {
  it("does not restart the home departure's backwards72px/sniff/stretch routine on a public stop", () => {
    const s = scene(), d = createCompanionPersonalityDirector([recipe("D157-C")]); prepare(d, s);
    for (const at of [1000, 14000, 28000, 56000]) { s.now = at; expect(d.next(s)).toBeUndefined(); }
    expect(d.completed()).toEqual([]); expect(d.active()).toBe(false);
  });

  it("keeps the real room prelude and its already chosen outside goal through new choices", () => {
    const s = scene(true), d = createCompanionPersonalityDirector([recipe("D157-C")]); prepare(d, s);
    const first = perform(d, s)!;
    expect(first.meta.command).toMatchObject({ kind: "go", target: "local-floor" });
    expect(first.action?.target.platformId).toBe(room.id);
    // Changed ranking and a late new platform must not replace this trip's goal.
    s.brain.visited = [one.id];
    s.world.platforms = [...s.world.platforms, { id: "late-interest", x: 225, y: 580, width: 80, kind: "date" }];
    const reached: string[] = [];
    for (let i = 0; i < 20 && !d.completed().includes("D157-C"); i++) {
      const offer = perform(d, s); if (offer?.meta.travel) reached.push(offer.action!.target.platformId!);
    }
    expect(d.completed()).toEqual(["D157-C"]);
    expect(s.world.platformId).toBe(one.id); expect(reached).not.toContain("late-interest");
  });

  it("reserves two real new places once and does not exchange the goal after an intermediate landing", () => {
    const s = scene(), d = createCompanionPersonalityDirector([recipe("D143-C")]); prepare(d, s);
    const first = perform(d, s)!; expect(first.meta.travel).toBe(true);
    s.brain.visited = [three.id, two.id];
    const places = new Set<string>();
    for (let i = 0; i < 30 && !d.completed().includes("D143-C"); i++) {
      const offer = perform(d, s); if (offer?.meta.command.kind === "pose") places.add(s.world.platformId!);
    }
    expect(d.completed()).toEqual(["D143-C"]); expect(places).toEqual(new Set([two.id, three.id]));
  });

  it("a removed destination cancels instead of fabricating an arrival or choosing a distracting replacement", () => {
    const s = scene(true), d = createCompanionPersonalityDirector([recipe("D157-C")]); prepare(d, s);
    perform(d, s); perform(d, s); // Actual local step and finite sniff.
    s.world.platforms = s.world.platforms.filter(plane => plane.id !== one.id);
    expect(d.next(s)).toBeUndefined(); expect(d.active()).toBe(false); expect(d.completed()).toEqual([]);
  });

  it("actually approaches one changed real toy, inspects it, then resumes the same original serial/beat/destination", () => {
    const s = scene(), d = createCompanionPersonalityDirector([recipe("D143-C")]); prepare(d, s);
    const original = d.next(s)!; expect(original.meta.travel).toBe(true); expect(d.retainExplorationForToyInput()).toBe(true);
    expect(original.meta.goal).toEqual({ x: 520, y: 600, platformId: two.id });
    s.toys = [{ id: "human-settled-ball", kind: "ball", x: 365, y: 600, platformId: one.id, angle: 0, held: false, carried: false }];
    d.event("toy-settled", s.now);
    const jobs = createCompanionPersonalityJobs(d, createCompanionHousehold(), createCompanionToyPlanner());
    const offered = d.next(s)!;
    expect(offered.meta).toMatchObject({ id: "curious-interest", itemId: "human-settled-ball" });
    expect(d.retainExplorationForToyInput()).toBe(false);
    const jobInput = () => ({ ...s, now: s.now, box: undefined, home: {}, toys: s.toys, toyIds: s.toys.map(toy => toy.id), toyCount: 1, foodCount: 0 });
    const approach = jobs.next(offered, jobInput(), s.now)!;
    expect(approach.kind).toBe("walk"); expect(approach.target.x).toBe(365);
    s.world = { ...s.world, ...approach.target }; s.now += approach.duration;
    d.complete(approach.personalityScene);
    const inspection = jobs.next(d.next(s)!, jobInput(), s.now)!;
    expect(inspection).toMatchObject({ kind: "sniff", personalityJobEnd: true, personalityScene: { id: "curious-interest", itemId: "human-settled-ball" } });
    s.now += inspection.duration; d.resolve(inspection.personalityScene, true, "human-settled-ball", s.now);
    const resumed = d.next(s)!;
    expect(resumed.meta).toMatchObject({ id: original.meta.id, serial: original.meta.serial, beat: original.meta.beat });
    expect(resumed.action?.target).toEqual(original.action!.target);
    expect(resumed.meta.goal).toEqual(original.meta.goal);
    expect(d.completed()).toEqual([]); expect(s.toys.map(toy => toy.id)).toEqual(["human-settled-ball"]);
    d.event("toy-settled", s.now+1); s.now += 1;
    expect(d.next(s)?.meta.id).toBe("D143-C"); // Same unchanged ball is familiar.
  });

  it.each([0, 23.9])("does not borrow an already achieved exploration go with%dpx remaining and manufacture a return", remaining => {
    const s = scene(), d = createCompanionPersonalityDirector([recipe("D143-C")]); prepare(d, s);
    const original = perform(d, s)!; expect(original.meta.travel).toBe(true);
    const destination = { x: two.x+two.width/2, y: two.y, platformId: two.id };
    for (let i = 0; i < 10 && Math.hypot(s.world.x-destination.x, s.world.y-destination.y) >= 24; i++) perform(d, s);
    s.world.x += remaining;
    s.toys = [{ id: "actual-new-ball", kind: "ball", x: 580, y: 600, platformId: two.id, angle: 0, held: false, carried: false }];
    d.event("toy-settled", s.now);
    const next = d.next(s)!;
    expect(next.meta).toMatchObject({ id: "D143-C", serial: original.meta.serial, beat: 1 });
    expect(next.action?.kind).toBe("sniff"); expect(d.current()?.id).not.toBe("curious-interest");
    expect(s.world.x).toBe(destination.x+remaining);
  });

  it.each(["confirmed", "failed", "foreign-id", "moved"])("C01 keeps real play but suppresses only the %s inspection when warranted", outcome => {
    const s = scene(), d = createCompanionPersonalityDirector([recipe("D143-C"), recipe("C01")]); prepare(d, s);
    const original = d.next(s)!; expect(original.meta.id).toBe("D143-C");
    s.toys = [{ id: "same-real-ball", kind: "ball", x: 365, y: 600, platformId: one.id, angle: 0, held: false, carried: false }];
    d.event("toy-settled", s.now);
    const inspect = d.next(s)!; expect(inspect.meta.id).toBe("curious-interest");
    // Explicit finite protocol ACK, not native animation evidence. The
    // separate jobs test above proves the real approach/sniff bridge.
    s.now += 900; d.resolve(inspect.meta, outcome !== "failed", outcome === "foreign-id" ? "unrelated-id" : "same-real-ball", s.now);
    for (let i = 0; i < 30 && !d.completed().includes("D143-C"); i++) perform(d, s);
    expect(d.completed()).toEqual(["D143-C"]);
    if (outcome === "moved") s.toys = [{ ...s.toys[0], x: 395 }];
    s.home.box = { x: 130, y: room.y, platformId: room.id };
    d.event("toy-settled", s.now);
    const next = d.next(s)!;
    expect(next.meta.id).toBe("C01");
    if (outcome === "confirmed") {
      expect(next.meta.beat).toBe(6); expect(next.meta.itemId).toBe("same-real-ball"); expect(next.delegate).toMatchObject({ kind: "toy", mode: "play" });
      expect(d.completed()).not.toContain("C01"); // A skipped prefix is not a completed registered scene.
      expect(s.toys[0].id).toBe("same-real-ball"); expect(s.toyPlayCounts).toBeUndefined();
    } else {
      expect(next.meta.beat).toBe(0); expect(next.action?.kind).toBe("sniff");
    }
  });

  it.each(["held", "flying", "missing", "far", "food-owner", "urgent-hunger", "carry"])("a %s stimulus cannot borrow an active trip", condition => {
    const s = scene(), d = createCompanionPersonalityDirector([recipe("D143-C")]); prepare(d, s);
    const original = d.next(s)!;
    s.toys = [{ id: "real-interest", kind: "ball", x: 365, y: 600, platformId: one.id, angle: 0, held: condition === "held", carried: false }];
    if (condition === "flying") s.flyingToyIds = ["real-interest"];
    if (condition === "missing") s.toys = [];
    if (condition === "far") s.toys = [{ ...s.toys[0], x: 760, platformId: three.id }];
    if (condition === "food-owner") s.brain.foodGoal = { foodId: "real-meal", remaining: 2, retryAfter: 0 };
    if (condition === "urgent-hunger") s.brain.hunger = .8;
    if (condition === "carry") s.carriedFoodId = "actual-food";
    d.event("toy-settled", s.now);
    expect(d.next(s)?.meta).toMatchObject({ id: original.meta.id, serial: original.meta.serial, beat: original.meta.beat });
  });

  it("an invalidated inspection resumes the previous trip, but direct cancellation clears both owners", () => {
    const s = scene(), d = createCompanionPersonalityDirector([recipe("D143-C")]); prepare(d, s);
    const original = d.next(s)!;
    s.toys = [{ id: "same-real-toy", kind: "ball", x: 365, y: 600, platformId: one.id, angle: 0, held: false, carried: false }]; d.event("toy-settled", s.now);
    const inspect = d.next(s)!; expect(inspect.meta.id).toBe("curious-interest");
    d.resolve(inspect.meta, false);
    expect(d.next(s)?.meta).toMatchObject({ id: original.meta.id, serial: original.meta.serial });
    s.toys = [{ ...s.toys[0], x: 390 }]; d.event("toy-settled", ++s.now);
    expect(d.next(s)?.meta.id).toBe("curious-interest");
    d.cancel(); expect(d.active()).toBe(false); expect(d.completed()).toEqual([]);
  });

  it.each(["OFF", "roamOFF", "busy", "paused", "food-owner", "carry", "exhausted"])("new exploration still respects %s", condition => {
    const s = scene(), d = createCompanionPersonalityDirector([recipe("D143-C")]); prepare(d, s);
    if (condition === "OFF") s.preferences.enabled = false;
    if (condition === "roamOFF") s.preferences.roam = false;
    if (condition === "busy") s.busy = true;
    if (condition === "paused") s.world.paused = true;
    if (condition === "food-owner") s.brain.foodGoal = { foodId: "same-meal", remaining: 3, retryAfter: 0 };
    if (condition === "carry") s.carriedToyId = "actual-carried-toy";
    if (condition === "exhausted") s.brain.energy = .1;
    expect(d.next(s)).toBeUndefined(); expect(d.completed()).toEqual([]);
  });

  it("familiarity suppresses another inspection, while real changed layout can earn one again", () => {
    const memory = createCompanionExplorationMemory(), s = scene(); memory.observe(s.world, [two.id]);
    expect(memory.novel(one)).toBe(false); expect(memory.novel(two)).toBe(false); expect(memory.novel(three)).toBe(true);
    memory.observe({ ...s.world, x: 720, platformId: three.id }); expect(memory.novel(three)).toBe(false);
    memory.layoutChanged();
    const scrolled: CompanionWorld = { ...s.world, y: 1100, platforms: s.world.platforms.map(plane => ({ ...plane, y: plane.y+500 })) };
    memory.observe(scrolled);
    expect(memory.novel(two)).toBe(false); expect(memory.novel(three)).toBe(false);
    memory.layoutChanged(); memory.observe({ ...scrolled, platforms: scrolled.platforms.map(plane => plane.id === two.id ? { ...plane, width: plane.width+80 } : plane) });
    expect(memory.novel(two)).toBe(true); expect(memory.novel(one)).toBe(false); expect(memory.novel(three)).toBe(false);
  });

  it("retains an actual width or relative-place change even when it accompanies a common scroll", () => {
    const memory = createCompanionExplorationMemory(), s = scene(); memory.observe(s.world, [two.id, three.id]);
    memory.layoutChanged();
    const updated = { ...s.world, y: 1100, platforms: s.world.platforms.map(plane => ({ ...plane, y: plane.y+500,
      ...(plane.id === two.id ? { width: plane.width+80 } : {}), ...(plane.id === three.id ? { x: plane.x+24 } : {}) })) };
    memory.observe(updated);
    expect(memory.novel(two)).toBe(true); expect(memory.novel(three)).toBe(true); expect(memory.novel(one)).toBe(false);
  });

  it.each([false, true])("keeps a fixed measured header familiar across scroll unless its width really changed (%s)", resized => {
    const header: Platform = { id: "date-1-header", kind: "date", x: 400, y: 120, width: 600 };
    const dates: Platform[] = [0, 1, 2].map(i => ({ id: `date-${20+i}-floor`, kind: "date", x: 400+i*160, y: 500, width: 140 }));
    const supports = [header, ...dates], memory = createCompanionExplorationMemory();
    const world = (support: Platform, platforms: Platform[]): CompanionWorld => ({ x: support.x+support.width/2, y: support.y,
      platformId: support.id, platforms, width: 1440, height: 1100, animated: true });
    for (const support of supports) memory.observe(world(support, supports));
    const updated = [{ ...header, width: header.width+(resized ? 80 : 0) }, ...dates.map(plane => ({ ...plane, y: plane.y+500 }))];
    memory.layoutChanged(); memory.observe(world(updated[1], updated));
    expect(memory.novel(updated[0])).toBe(resized); expect(memory.novel(updated[2])).toBe(false);
  });

  it("toy novelty follows the actual support fraction, not scroll pixels, and returns only after a meaningful physical move", () => {
    const memory = createCompanionExplorationMemory(), s = scene();
    const toy = { id: "same-ball", kind: "ball" as const, x: 365, y: 600, platformId: one.id, angle: 0, held: false, carried: false };
    expect(memory.novelToy(toy, s.world)).toBe(true);
    const offered = memory.inspectToy(toy, s.world)!; expect(memory.novelToy(toy, s.world)).toBe(false); expect(memory.inspectedToy(toy, s.world)).toBe(false);
    memory.confirmToyInspection(offered); expect(memory.inspectedToy(toy, s.world)).toBe(true);
    const scrolled = { ...s.world, y: 1100, platforms: s.world.platforms.map(plane => ({ ...plane, y: plane.y+500 })) };
    expect(memory.novelToy({ ...toy, y: 1100 }, scrolled)).toBe(false);
    expect(memory.inspectedToy({ ...toy, y: 1100 }, scrolled)).toBe(true);
    expect(memory.novelToy({ ...toy, x: 389 }, s.world)).toBe(true);
    expect(memory.inspectedToy({ ...toy, x: 389 }, s.world)).toBe(false);
    const itemOnly = { ...one, id: "actual-public-item-ledge", manualOnly: true };
    expect(memory.novel(itemOnly)).toBe(false);
    expect(memory.novelToy({ ...toy, platformId: itemOnly.id }, { ...s.world, platforms: [...s.world.platforms, itemOnly] })).toBe(true);
  });
});

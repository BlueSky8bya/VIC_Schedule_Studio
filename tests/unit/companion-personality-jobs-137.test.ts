import { randomCompanionToy } from "@/lib/ui/viewer-companion/toy-catalog";
import { describe, expect, it } from "vitest";
import { createBrain, type CompanionFood, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { createCompanionPersonalityJobs, type PersonalityJobAction } from "@/lib/ui/viewer-companion/personality-jobs";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { accessibleCompanionToys, createCompanionToyPlanner, createCompanionToys, type CompanionToyKind } from "@/lib/ui/viewer-companion/toys";
import { companionToyReturnDelivered, companionToyReturnTarget, sampleCompanionToyReturn } from "@/lib/ui/viewer-companion/toy-return";

const floor: Platform = { id: "companion-home-floor", x: 50, y: 600, width: 740, kind: "floor", manualOnly: true };
const contact: Platform = { ...floor, id: "companion-home-floor-food", x: 30, width: 780 };
const outside: Platform = { id: "actual-calendar-floor", x: 50, y: 600, width: 740, kind: "floor" };
const opening = { left: 650, top: 525, width: 60, height: 25 };
const box = { x: 680, y: floor.y, platformId: floor.id };
type Trace = { kind: string; id?: string; scene: string; beat: number; count: number; platform?:string };

/** Real toy model + planners, with a small synchronous host. Body moves only
 * along returned route endpoints; effects receive ACK only after the real toy
 * owner (or the existing food fixture's checked ownership) accepts them. The
 * unit clock advances finite actions, without DOM/art/native visibility claims. */
function fixture(id: string, count = 1, firstKind: CompanionToyKind = "star-wand") {
  const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === id)!;
  let first = true;
  const toys = createCompanionToys(() => first ? (first = false, toyRoll(firstKind)) : 0);
  toys.sync([floor], { width: 900, height: 720 }, 0, [contact]);
  for (let i = 0; i < count; i++) expect(toys.spawn({ x: 340 + i * 45, y: 530, platformId: contact.id }, 0)).toBeTruthy();
  for (let at = 0; at <= 3000; at += 16) toys.tick(at);
  expect(toys.available()).toHaveLength(count);
  const director = createCompanionPersonalityDirector([recipe]), household = createCompanionHousehold(() => 0), toyPlanner = createCompanionToyPlanner();
  const jobs = createCompanionPersonalityJobs(director, household, toyPlanner);
  const world: CompanionWorld = { x: 120, y: floor.y, platformId: floor.id, platforms: [floor, outside], width: 900, height: 720, animated: true, foods: [] };
  const scene: PersonalitySceneInput = {
    world, brain: { ...createBrain(0, () => .5), life: createCompanionLife(() => 0), hunger: .1, energy: .9 },
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: recipe.personality }, now: 3000,
    home: { floor: { x: 280, y: floor.y, platformId: floor.id }, sofa: { x: 180, y: floor.y, platformId: floor.id }, window: { x: 500, y: floor.y, platformId: floor.id }, contacts: { curtain: { x: 500, y: floor.y - 45 } }, box, dispenser: { x: 600, y: floor.y, platformId: floor.id } },
    toys: [], tv: "off", favoriteFood: "apple",
  };
  const trace: Trace[] = [], originalIds = toys.ids(), pantry = { x: 500, y: floor.y, platformId: floor.id };
  let carriedFood: CompanionFood | undefined;
  const refresh = () => {
    scene.toys = accessibleCompanionToys(toys.available(), scene.world.platforms);
    scene.carriedToyId = toys.carried();
    scene.brain.activeMs = scene.now;
  };
  refresh();
  const entry = director.next(scene)!; expect(entry.meta.id).toBe(`entry-${recipe.personality}`); director.complete(entry.meta); scene.now += entry.action!.duration;
  const offer = () => {
    refresh();
    const proposal = director.next(scene);
    if (!proposal || proposal.meta.id !== id) return;
    return jobs.next(proposal, {
      world: scene.world, brain: scene.brain, preferences: scene.preferences, now: scene.now,
      home: { pantry, bin: box, dispenser: scene.home.dispenser }, box,
      toys: scene.toys, toyIds: toys.ids(), carriedToy: toys.carried(), carriedFood: carriedFood?.id,
      toyCount: toys.count(), foodCount: (scene.world.foods?.length ?? 0) + Number(Boolean(carriedFood)), occupied: toys.occupied(),
    }, scene.now);
  };
  const apply = (action: PersonalityJobAction) => {
    const meta = action.personalityScene;
    if (action.kind === "walk" || action.kind === "jump") {
      const support = scene.world.platforms.find(platform => platform.id === action.target.platformId);
      expect(support).toBeTruthy(); expect(action.target.y).toBe(support!.y);
      expect(action.target.x).toBeGreaterThanOrEqual(support!.x); expect(action.target.x).toBeLessThanOrEqual(support!.x + support!.width);
      scene.world = { ...scene.world, ...action.target };
      const carried = toys.carried(); if (carried) expect(toys.carry(carried, { x: scene.world.x, y: scene.world.y - 30 })).toBe(true);
    }
    scene.now += action.duration;
    const toy = action.toy;
    if (toy?.effect) {
      let ok = false;
      if (toy.effect === "pick" && toy.toyId) ok = toys.pick(toy.toyId, scene.world);
      else if (toy.effect === "nudge" && toy.toyId) ok = toys.nudge(toy.toyId, scene.world, scene.now - action.duration / 2);
      else if (toy.effect === "stash" && toy.toyId) {
        const real = toys.items().find(item => item.id === toy.toyId), target = companionToyReturnTarget(opening)!;
        expect(real?.carried).toBe(true); expect(scene.world.platformId).toBe(floor.id);
        expect(Math.abs(scene.world.x - box.x)).toBeLessThan(55);
        const painted = sampleCompanionToyReturn(real!, target, 1);
        expect(toys.carry(toy.toyId, painted)).toBe(true);
        expect(companionToyReturnDelivered(toys.items().find(item => item.id === toy.toyId), target)).toBe(true);
        ok = toys.stash(toy.toyId);
      } else if ((toy.effect === "put" || toy.effect === "toss") && toy.toyId) {
        // The renderer releases at the halfway effect threshold. Let the
        // real gravity consume the rest of this same finite action's clock.
        ok = toys.put(toy.toyId, { ...scene.world, y: scene.world.y - (toy.effect === "toss" ? 22 : 0) }, scene.now - action.duration / 2, toy.effect === "toss");
      }
      if (ok && ["nudge", "put", "toss"].includes(toy.effect)) for (let at = scene.now - action.duration / 2 + 16; at < scene.now; at += 16) toys.tick(at);
      // These cases deliberately do not implement spawn. None of these
      // source scenes author it; a planner fallback would be an actual defect.
      expect(toy.effect).not.toBe("spawn");
      trace.push({ kind: `toy:${toy.effect}`, id: toy.toyId, scene: meta.id, beat: meta.beat, count: toys.count(), platform:scene.world.platformId });
      toyPlanner.resolve(toy, ok, scene.now);
      if (toy.effect !== "pick" && toy.effect !== "decline") {
        director.resolve(meta, ok, toy.toyId);
        if (!director.current() || director.current()!.beat !== meta.beat) toyPlanner.cancel(scene.now);
      }
      expect(ok, `${id}: actual ${toy.effect} accepts the physical object`).toBe(true);
    }
    const food = action.household;
    if (food?.effect) {
      let ok = false;
      if (food.effect === "pick") {
        const source = scene.world.foods?.find(item => item.id === food.foodId);
        if (source && Math.hypot(source.x - scene.world.x, source.y - scene.world.y) <= 48 && !carriedFood) {
          carriedFood = source; scene.world.foods = scene.world.foods!.filter(item => item.id !== source.id); ok = true;
        }
      } else if (food.effect === "put" && carriedFood && carriedFood.id === food.foodId && food.point?.platformId === floor.id
        && scene.world.platformId === floor.id && Math.hypot(scene.world.x - food.point.x, scene.world.y - food.point.y) <= 48) {
        scene.world.foods = [...scene.world.foods ?? [], { ...carriedFood, ...food.point }]; carriedFood = undefined; ok = true;
      }
      trace.push({ kind: `food:${food.effect}`, id: food.foodId, scene: meta.id, beat: meta.beat, count: scene.world.foods?.length ?? 0 });
      household.resolve(food, ok, scene.now);
      if (food.effect !== "pick" && food.effect !== "scatter") {
        director.resolve(meta, ok, food.foodId);
        if (!director.current() || director.current()!.beat !== meta.beat) household.cancel();
      }
      expect(ok, `${id}: actual food ownership and current support permit ${food.effect}`).toBe(true);
    }
    if (action.personalityJobEnd) director.resolve(meta, true, meta.itemId ?? toys.carried());
    else if (meta.command.kind === "curtain") { scene.curtainPhase = meta.command.phase; director.resolve(meta, true); }
    else director.complete(meta);
    trace.push({ kind: action.kind, id: toys.carried(), scene: meta.id, beat: meta.beat, count: toys.count(), platform:scene.world.platformId });
    toys.tick(scene.now);
  };
  const run = (limit = 60) => {
    for (let n = 0; n < limit && !director.completed().includes(id); n++) {
      const action = offer();
      if (action) apply(action); else scene.now += 250;
    }
    expect(director.completed()).toContain(id);
  };
  return { toys, director, toyPlanner, household, scene, trace, originalIds, refresh, offer, apply, run };
}

describe("137 authored jobs use the physical owners", () => {
  it.each([
    ["P08", "star-wand"], ["C07", "kaleidoscope"], ["A03", "duck"],
    ["S03", "ball"], ["T01", "ball"], ["M02", "toy-car"],
    ["G12", "ball"], ["H07", "stacking-rings"], ["B01", "ball"],
  ] as const)("140 %s completes its actual toy owner and return at middle hunger, without deleting or substituting its item", (scene, kind) => {
    const host = fixture(scene, 1, kind), id = host.originalIds[0];
    host.scene.brain.hunger = .5;
    // This full S03 positive includes real rest; the142 high-energy case
    // separately proves same-ID return without claiming the omitted sleep.
    if (scene === "S03") host.scene.brain.energy = .4;
    host.scene.world.pointer = { x: 440, y: floor.y, stableMs: 1000 };
    host.run();
    expect(host.trace.some(event => event.kind === "toy:pick" && event.id === id)).toBe(true);
    expect(host.trace.filter(event => event.kind === "toy:stash").map(event => event.id)).toEqual([id]);
    expect(host.toys.count()).toBe(0);
    expect(host.toys.carried()).toBeUndefined();
  });

  it.each(["P07", "H06"])("140 %s nudges its actual train and follows it instead of throwing it", scene => {
    const host = fixture(scene, 1, "train"), id = host.originalIds[0];
    host.scene.brain.hunger = .5; host.run();
    expect(host.trace.filter(event => event.kind === "toy:nudge").map(event => event.id)).toEqual([id]);
    expect(host.trace.some(event => event.kind === "toy:toss")).toBe(false);
    if (scene === "H06") expect(host.trace.filter(event => event.kind === "toy:stash").map(event => event.id)).toEqual([id]);
    else expect(host.toys.ids()).toEqual([id]);
  });

  it("143 P02 admits from its sole actual outside, enters for its same maraca, then truly carries it outside before returning",()=>{
    const host=fixture("P02",1,"maraca"),id=host.originalIds[0];
    host.scene.world.platformId=outside.id;host.scene.world.x=500;
    host.run(100);
    expect(host.trace.filter(e=>e.kind==="toy:pick").map(e=>[e.id,e.platform])).toEqual([[id,floor.id]]);
    expect(host.trace.some(e=>["walk","jump"].includes(e.kind)&&e.beat===1&&e.id===id&&e.platform===outside.id)).toBe(true);
    expect(host.trace.filter(e=>e.kind==="toy:stash").map(e=>e.id)).toEqual([id]);expect(host.toys.ids()).toEqual([]);
  });

  it("P08 actually picks its star wand, carries the same ID through the performance and paints it into the real box before stash ACK", () => {
    const host = fixture("P08", 2), wand = host.toys.items().find(toy => toy.kind === "star-wand")!;
    expect(wand).toBeTruthy();
    host.run();
    expect(host.trace.filter(event => event.kind === "toy:pick").map(event => event.id)).toEqual([wand.id]);
    expect(host.trace.filter(event => event.kind === "toy:stash").map(event => event.id)).toEqual([wand.id]);
    expect(host.trace.filter(event => event.kind === "play" && event.scene === "P08")).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: wand.id, beat: 1 }), expect.objectContaining({ id: wand.id, beat: 2 }),
    ]));
    expect(host.toys.ids()).toEqual(host.originalIds.filter(id => id !== wand.id));
    expect(host.toys.carried()).toBeUndefined();
  });

  it("T01 returns exactly one of four real toys, preserves the other three IDs and stops the planner continuation", () => {
    const host = fixture("T01", 4, "ball"); host.run();
    const stash = host.trace.filter(event => event.kind === "toy:stash"); expect(stash).toHaveLength(1);
    expect(host.toys.count()).toBe(3); expect(host.toys.ids()).toEqual(host.originalIds.filter(id => id !== stash[0].id));
    expect(host.toyPlanner.active()).toBe(false);
    expect(host.trace.every(event => event.count <= 4)).toBe(true);
    expect(host.trace.filter(event => event.kind === "toy:pick")).toHaveLength(1);
  });

  it("B04 finishes two actual returns before switching to its separate window observation", () => {
    const host = fixture("B04", 4, "ball"); host.run();
    const returned = host.trace.filter(event => event.kind === "toy:stash").map(event => event.id);
    expect(returned).toHaveLength(2); expect(new Set(returned).size).toBe(2);
    expect(host.toys.ids()).toEqual(host.originalIds.filter(id => !returned.includes(id)));
    expect(host.toys.count()).toBe(2); expect(host.toyPlanner.active()).toBe(false);
    expect(host.scene.curtainPhase).toBe("open");
    expect(host.trace.some(event => event.scene === "B04" && event.beat === 3 && event.kind === "look")).toBe(true);
  });

  it("M01 tosses, actually lands, retrieves and finally returns one same ball without creating a substitute", () => {
    const host = fixture("M01", 1, "ball"), id = host.originalIds[0]; host.run();
    expect(host.trace.filter(event => event.kind === "toy:toss").map(event => event.id)).toEqual([id, id]);
    expect(host.trace.filter(event => event.kind === "toy:pick").map(event => event.id)).toEqual([id, id, id]);
    expect(host.trace.filter(event => event.kind === "toy:stash").map(event => event.id)).toEqual([id]);
    expect(host.toys.count()).toBe(0);
  });

  it("M02 completes the same car's typed play, nudges it along its support, catches it after gravity and returns it", () => {
    const host = fixture("M02", 1, "toy-car"), id = host.originalIds[0];
    let nudge = host.offer()!;
    for (let step = 0; step < 16 && nudge?.toy?.effect !== "nudge"; step++) { host.apply(nudge); nudge = host.offer()!; }
    // This model runs the physical planner's finite typed-use/release protocol;
    // the actual wheel animation and discovery are checked by native200.
    expect(host.trace.some(event => ["toy:put", "toy:toss"].includes(event.kind) && event.id === id && event.beat === 0)).toBe(true);
    expect(host.trace.filter(event => event.kind === "toy:pick").map(event => event.id)).toEqual([id]);
    const initial = host.toys.items()[0];
    expect(nudge.toy).toMatchObject({ effect: "nudge", toyId: id }); host.apply(nudge);
    const moved = host.toys.items()[0]; expect(moved.id).toBe(id); expect(moved.carried).toBe(false);
    expect(Math.abs(moved.x - initial.x)).toBeGreaterThan(8);
    host.run();
    expect(host.trace.filter(event => event.kind === "toy:nudge").map(event => event.id)).toEqual([id]);
    expect(host.trace.filter(event => event.kind === "toy:pick").map(event => event.id)).toEqual([id, id]);
    expect(host.trace.filter(event => event.kind === "toy:toss" && event.beat > 0)).toEqual([]);
    expect(host.trace.filter(event => event.kind === "toy:stash").map(event => event.id)).toEqual([id]);
  });

  it("G04 compares another real food then inspects its selected new meal without losing or rebinding the main ID", () => {
    const host = fixture("G04", 0), known: CompanionFood = { id: "known-apple", kind: "apple", x: 160, y: floor.y, platformId: outside.id };
    const fresh: CompanionFood = { id: "new-same-family-lemon", kind: "lemon", x: 290, y: floor.y, platformId: outside.id };
    host.scene.preferences.learnFromYou = true; host.scene.brain.hunger = .5; host.scene.brain.life!.tastedFoods = ["apple"];
    host.scene.world = { ...host.scene.world, platformId: outside.id, foods: [known, fresh] };
    const observed: { x: number; id?: string; beat: number }[] = [];
    for (let n = 0; n < 12 && host.director.current()?.beat !== 2; n++) {
      const action = host.offer()!; expect(action).toBeTruthy();
      expect(action.personalityScene.itemId).toBe(fresh.id);
      if (action.personalityJobEnd) observed.push({ x: host.scene.world.x, id: action.personalityScene.itemId, beat: action.personalityScene.beat });
      host.apply(action);
      expect(host.director.current()?.itemId).toBe(fresh.id);
    }
    // The nearby alternative is observed from the occupied place. Comparing
    // does not send the pet to a second meal before its committed destination.
    expect(observed).toEqual([{ x: 120, id: fresh.id, beat: 0 }, { x: fresh.x, id: fresh.id, beat: 1 }]);
    expect(host.scene.world.foods).toEqual([known, fresh]); expect(host.director.current()?.beat).toBe(2);
  });

  it("T02 ignores a nearer nonfavorite food and brings the actual favorite into a free indoor pantry position", () => {
    const host = fixture("T02", 0), apple: CompanionFood = { id: "actual-favorite", kind: "apple", x: 350, y: floor.y, platformId: outside.id };
    const bread: CompanionFood = { id: "nearer-other", kind: "bread", x: 150, y: floor.y, platformId: outside.id };
    host.scene.world = { ...host.scene.world, platformId: outside.id, foods: [bread, apple] };
    host.scene.brain.life!.favoriteFood = "apple";
    host.run();
    expect(host.trace.filter(event => event.kind.startsWith("food:")).map(event => [event.kind, event.id])).toEqual([
      ["food:pick", apple.id], ["food:put", apple.id],
    ]);
    expect(host.scene.world.foods).toContainEqual(bread);
    expect(host.scene.world.foods?.find(food => food.id === apple.id)).toMatchObject({ kind: "apple", platformId: floor.id, y: floor.y });
    expect(host.scene.world.foods).toHaveLength(2);
  });

  it.each(["held", "removed"] as const)("a %s fixed target is neither replaced nor spawned and cancels within the finite job budget", takeover => {
    const host = fixture("P08", 2), first = host.offer()!;
    expect(first.personalityScene.itemId).toBeTruthy(); const locked = host.director.current()!.itemId!;
    expect(host.toys.grab(locked)).toBe(true);
    if (takeover === "removed") expect(host.toys.returnHeld(locked)).toBe(true);
    const count = host.toys.count(), ids = host.toys.ids(), effects: string[] = [];
    for (let n = 0; n < 48 && host.director.active(); n++) {
      const action = host.offer();
      if (action) { if (action.toy?.effect) effects.push(action.toy.effect); host.apply(action); }
      else host.scene.now += 250;
    }
    expect(host.director.active()).toBe(false); expect(host.director.completed()).not.toContain("P08");
    expect(effects).toEqual([]); expect(host.toys.count()).toBe(count); expect(host.toys.ids()).toEqual(ids);
    expect(host.trace.filter(event => event.kind === "toy:pick" || event.kind === "toy:spawn")).toHaveLength(0);
    expect(host.scene.now).toBeLessThan(15_000);
  });

  it("a hungry basic feed owner spawns once, finishes on the real new-ID ACK and never turns that meal into a scatter job", () => {
    const household = createCompanionHousehold(() => 0), context = {
      brain: { ...createBrain(0, () => .5), hunger: .8, energy: .9 },
      world: { x: 120, y: floor.y, platformId: floor.id, platforms: [floor], width: 900, height: 720, animated: true, foods: [] as CompanionFood[] },
      preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: "gourmet" as const }, now: 1000,
      home: { dispenser: { x: 550, y: floor.y, platformId: floor.id } }, count: 0,
    };
    const approach = household.next({ ...context, intent: "feed" })!;
    expect(approach.kind).toBe("walk"); expect(approach.household.effect).toBeUndefined();
    context.world = { ...context.world, ...approach.target }; context.now += approach.duration;
    // The owner survives the following ordinary decision without re-supplying
    // the intent. Its true hunger remains valid for this supply-only job.
    const spawn = household.next(context)!; expect(spawn.household.effect).toBe("spawn");
    expect(household.active()).toBe(true);
    const actualSpawned: CompanionFood = { id: "real-one-meal-ack", kind: "apple", x: 500, y: floor.y, platformId: floor.id };
    context.world.foods = [actualSpawned]; context.count = 1;
    household.resolve(spawn.household, actualSpawned.id, context.now + spawn.duration);
    expect(household.active()).toBe(false);
    for (let turn = 0; turn < 5; turn++) { context.now += 500; expect(household.next(context)).toBeUndefined(); }
    expect(context.world.foods).toEqual([actualSpawned]);
    const full = { ...context, brain: { ...context.brain, hunger: .1 }, count: 0, world: { ...context.world, foods: [] } };
    expect(createCompanionHousehold(() => 0).next({ ...full, intent: "feed" })).toBeUndefined();
    expect(createCompanionHousehold(() => 0).next({ ...context, preferences: { ...context.preferences, feeding: false }, intent: "feed" })).toBeUndefined();
  });
});

/** Select a real weighted catalog interval in this pure model fixture. */
function toyRoll(kind: CompanionToyKind) {
  const roll=Array.from({length:4096},(_,i)=>i/4096).find(value=>randomCompanionToy(undefined,()=>value)===kind);
  expect(roll,`actual weighted interval for ${kind}`).toBeDefined(); return roll!;
}

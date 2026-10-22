import { describe, expect, it } from "vitest";
import { createBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { createCompanionPersonalityJobs } from "@/lib/ui/viewer-companion/personality-jobs";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { createCompanionPersonalityActivity } from "@/lib/ui/viewer-companion/personality-activity";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { createCompanionToys, createCompanionToyPlanner } from "@/lib/ui/viewer-companion/toys";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionFoodAftertaste } from "@/lib/ui/viewer-companion/food-aftertaste";
import { companionLocalFloorStep } from "@/lib/ui/viewer-companion/safe-room-floor";
import { createCompanionRoutineArbiter } from "@/lib/ui/viewer-companion/routine-arbiter";

const floor: Platform = { id: "companion-home-floor-2", x: 30, y: 600, width: 430, kind: "floor", manualOnly: true };
const pad: Platform = { id: "companion-home-floor-400", x: 290, y: 560, width: 30, kind: "floor", bodyOnly: true, manualOnly: true };
const outside: Platform = { id: "actual-calendar-one", x: 460, y: 600, width: 180, kind: "date" };
const further: Platform = { id: "actual-calendar-two", x: 670, y: 570, width: 180, kind: "date" };
const ids = ["D157-P", "D157-C", "D157-A", "D157-S", "D157-T", "D157-M", "D157-G", "D157-H", "D157-B"];

function protocol(id: string) {
  const recipe = COMPANION_PERSONALITY_SCENES.find(value => value.id === id)!;
  const s: PersonalitySceneInput = {
    world: { x: 130, y: 600, platformId: floor.id, platforms: [floor, pad, outside, further], width: 1100, height: 800, animated: true,
      pointer: { x: 590, y: 600, stableMs: 1000 }, foods: id === "D157-G" ? [{ id: "same-actual-meal", kind: "cricket-pepero", x: 190, y: 600, platformId: floor.id }] : [] },
    brain: { ...createBrain(0, () => .5), energy: .95, hunger: id === "D157-G" ? .55 : .05 },
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality: recipe.personality, sleep: true }, now: 0, toys: [], toyCount: 0, tv: "off",
    home: { floor: { x: 210, y: 600, platformId: floor.id }, box: { x: 300, y: 600, platformId: floor.id }, pad: { x: 305, y: 560, platformId: pad.id } },
  };
  const model = createCompanionToys(() => 0), planner = createCompanionToyPlanner(), d = createCompanionPersonalityDirector([recipe]);
  model.sync([floor, outside, further], { width: 1100, height: 800 }, 0);
  if (id === "D157-M") { expect(model.spawn({ x: 200, y: 530, platformId: floor.id }, 0)).toBeTruthy(); for (let at = 16; at <= 3000; at += 16) model.tick(at); }
  s.now = 3000;
  const entry = d.next(s)!; s.now += entry.action!.duration; d.complete(entry.meta);
  const jobs = createCompanionPersonalityJobs(d, createCompanionHousehold(() => 0), planner), effects: string[] = [], travel: string[] = [];
  const aftertaste = createCompanionFoodAftertaste();
  const step = () => {
    s.toys = model.available(); s.toyCount = model.count(); s.carriedToyId = model.carried(); s.brain.activeMs = s.now;
    const proposal = d.next(s); if (!proposal) { s.now += 100; return; }
    const action = jobs.next(proposal, { world: s.world, brain: s.brain, preferences: s.preferences, now: s.now, home: { pantry: s.home.floor }, box: s.home.box,
      toys: s.toys, toyIds: model.ids(), carriedToy: model.carried(), toyCount: model.count(), foodCount: s.world.foods?.length ?? 0 }, s.now);
    if (!action) { s.now += 50; return; }
    const meta = action.personalityScene; s.now += action.duration;
    if (action.kind === "walk" || action.kind === "jump") {
      const plane = s.world.platforms.find(value => value.id === action.target.platformId)!;
      expect(plane).toBeDefined(); expect(action.target.y).toBe(plane.y); expect(action.target.x).toBeGreaterThanOrEqual(plane.x); expect(action.target.x).toBeLessThanOrEqual(plane.x + plane.width);
      s.world = { ...s.world, ...action.target }; s.brain.visited = [...new Set([...s.brain.visited, plane.id])]; travel.push(plane.id);
      d.observeProgress({ now: s.now, active: true, point: s.world });
    }
    if (action.toy?.effect) {
      const toy = action.toy; expect(toy.effect).toBe("nudge"); expect(toy.toyId).toBe(model.ids()[0]);
      expect(model.nudge(toy.toyId!, s.world, s.now - action.duration / 2)).toBe(true); effects.push(`nudge:${toy.toyId}`);
      planner.resolve(toy, true, s.now); d.resolve(meta, true, toy.toyId, s.now);
      for (let at = s.now - action.duration / 2 + 16; at <= s.now + 1200; at += 16) model.tick(at);
      s.now += 1200;
    } else if (action.kind === "eat") {
      const food = (s.world.foods ?? []).find(value => value.id === action.foodId)!;
      expect(food).toBeDefined(); expect(Math.hypot(food.x - s.world.x, food.y - s.world.y)).toBeLessThan(48);
      s.world.foods = s.world.foods!.filter(value => value.id !== food.id); s.brain.hunger = .1;
      const reaction = aftertaste.consume({ foodId: food.id, food: food.kind, consumed: true }, true)!;
      expect(reaction.kind).toBe("retch"); effects.push(`eat:${food.id}`, "finite-aftertaste");
      d.resolve(meta, true, food.id, s.now); s.now += reaction.duration;
    } else if (action.personalityJobEnd) d.resolve(meta, true, meta.itemId, s.now);
    else if (meta.command.kind === "wash" && !meta.travel) { expect(s.world.platformId).toBe(pad.id); effects.push("washed"); d.resolve(meta, true, undefined, s.now); }
    else { if (action.kind === "sleep") effects.push("rested"); d.complete(meta); }
    s.now += 80; model.tick(s.now);
  };
  return { recipe, s, d, model, effects, travel, step };
}

describe("157 approved situational continuations retain actual goals and next work", () => {
  it.each(ids)("%s completes its registered pure protocol and then a real next walk", id => {
    const h = protocol(id);
    // These are synthetic protocol signals, never claims of native petting,
    // sleep or box delivery. Separate real native tests retain those preludes.
    if (id === "D157-A") h.d.event("pet", h.s.now);
    if (id === "D157-B") h.d.event("toy-returned", h.s.now);
    if (id === "D157-H") h.d.event("rested", h.s.now);
    if (id === "D157-T") {
      expect(h.d.startRoutine({ id: "routine-wash", label: "actual model wash", personality: "tidy", major: false, triggers: ["free"],
        steps: [{ kind: "go", target: "pad" }, { kind: "wash", ms: 2000 }, { kind: "go", target: "floor" }] }, h.s.now)).toBe(true);
    }
    for (let n = 0; n < 100 && !h.d.completed().includes(id); n++) h.step();
    expect(h.d.completed(), JSON.stringify({ id, current: h.d.current(), effects: h.effects, travel: h.travel })).toContain(id);
    expect(h.travel.length).toBeGreaterThan(0);
    if (id === "D157-P") expect(new Set(h.travel.filter(value => !value.startsWith("companion-home"))).size).toBeGreaterThanOrEqual(2);
    if (id === "D157-T") expect(h.effects.filter(value => value === "washed")).toHaveLength(1);
    if (id === "D157-M") { expect(h.effects).toEqual([`nudge:${h.model.ids()[0]}`]); expect(h.model.count()).toBe(1); }
    if (id === "D157-G") expect(h.effects).toEqual(["eat:same-actual-meal", "finite-aftertaste"]);
    expect(h.d.next(h.s)?.meta.id).not.toBe(id);
    const activity = createCompanionPersonalityActivity(() => .5), next = activity.choose(h.s.brain, h.s.world, h.s.preferences, h.s.now + 9000)!;
    expect(["walk", "jump"]).toContain(next.kind); expect(Math.hypot(next.target.x - h.s.world.x, next.target.y - h.s.world.y)).toBeGreaterThanOrEqual(24);
  });
  it.each(["pet", "toy-returned", "rested", "washed"] as const)("does not invent a missing actual %s trigger", trigger => {
    const id = ({ pet: "D157-A", "toy-returned": "D157-B", rested: "D157-H", washed: "D157-T" })[trigger], h = protocol(id);
    expect(h.d.next(h.s)).toBeUndefined(); expect(h.d.completed()).not.toContain(id);
  });
  it.each(["D157-C", "D157-S", "D157-B"])("%s keeps a finite measured numbered-floor waypoint instead of chasing a new target", id => {
    const h = protocol(id); if (id === "D157-B") h.d.event("toy-returned", h.s.now);
    const one = h.d.next(h.s)!; expect(one.action?.target.platformId).toBe(floor.id);
    const endpoint = one.action!.target; h.s.world.x += 18; h.s.now += 100;
    const two = h.d.next(h.s)!; expect(two.action?.target).toEqual(endpoint);
  });
  it.each(["D157-S", "D157-T", "D157-G"])("%s respects OFF, real carries and urgent needs", id => {
    for (const condition of ["off", "carry", "energy"]) {
      const h = protocol(id); h.d.event("washed", h.s.now);
      if (condition === "off") h.s.preferences.enabled = false;
      if (condition === "carry") h.s.carriedFoodId = "real-carried-food";
      if (condition === "energy") h.s.brain.energy = .15;
      expect(h.d.next(h.s)).toBeUndefined(); expect(h.d.completed()).not.toContain(id);
    }
  });
  it("local-floor never invents a bath or food-only walking span", () => {
    for (const support of [pad, { ...floor, id: "companion-home-floor-food" }]) {
      const world: CompanionWorld = { x: support.x + 12, y: support.y, platformId: support.id, platforms: [support], width: 1000, height: 800, animated: true };
      expect(companionLocalFloorStep(world)).toBeUndefined();
    }
  });
  it("generic tumble/manual-landing recovery cannot forge the homebody's actual completed rest",()=>{
    const h=protocol("D157-H");h.d.event("recovered",h.s.now);
    expect(h.d.pendingApprovedContinuationReady(h.s)).toBe(false);expect(h.d.next(h.s)).toBeUndefined();expect(h.d.completed()).not.toContain("D157-H");
    h.d.event("rested",h.s.now);expect(h.d.pendingApprovedContinuationReady(h.s)).toBe(true);expect(h.d.next(h.s)?.meta.id).toBe("D157-H");
  });
  it("queries a feasible approved meal continuation without starting an owner, reserving an ID or refilling progress",()=>{
    const h=protocol("D157-G"),before={input:JSON.stringify(h.s),current:h.d.current(),completed:h.d.completed(),deadline:h.d.progressDeadline()};
    for(let i=0;i<30;i++)expect(h.d.pendingApprovedContinuationReady(h.s)).toBe(true);
    expect({input:JSON.stringify(h.s),current:h.d.current(),completed:h.d.completed(),deadline:h.d.progressDeadline()}).toEqual(before);
    expect(h.d.active()).toBe(false);
    const routine=createCompanionRoutineArbiter().next({...h.s,active:true,entryReady:true,authoredReserved:true,authoredLeisure:false,meal:{foodId:"same-actual-meal"}});
    expect(routine).toBeUndefined();expect(h.d.next(h.s)?.meta.id).toBe("D157-G");
  });
  it("the pending approved meal still yields to actual urgent hunger in the common arbiter",()=>{
    const h=protocol("D157-G");h.s.brain.hunger=.8;const ready=h.d.pendingApprovedContinuationReady(h.s);expect(ready).toBe(true);
    expect(createCompanionRoutineArbiter().next({...h.s,active:true,entryReady:true,authoredReserved:ready,authoredLeisure:false,meal:{foodId:"same-actual-meal"}})).toMatchObject({kind:"meal",itemId:"same-actual-meal"});
  });
  it("exhausted actual sleep remains admissible rather than launching the new sleepy outing",()=>{
    const h=protocol("D157-S");h.s.brain.energy=.15;
    const sofa:Platform={id:"companion-home",x:30,y:560,width:160,kind:"date"};h.s.world.platforms=[...h.s.world.platforms,sofa];h.s.home.sofa={x:110,y:560,platformId:sofa.id};
    const ready=h.d.pendingApprovedContinuationReady(h.s);expect(ready).toBe(false);
    expect(createCompanionRoutineArbiter().next({...h.s,active:true,entryReady:true,authoredReserved:ready,authoredLeisure:false})).toMatchObject({kind:"nap"});
  });
  it.each(["OFF","roamOFF","paused","quiet","busy","carry-food","carry-toy","real-food-goal","missing-support"])("pending approved continuation respects %s",condition=>{
    const h=protocol("D157-G");
    if(condition==="OFF")h.s.preferences.enabled=false;if(condition==="roamOFF")h.s.preferences.roam=false;if(condition==="paused")h.s.world.paused=true;
    if(condition==="quiet")h.s.world.animated=false;if(condition==="busy")h.s.busy=true;if(condition==="carry-food")h.s.carriedFoodId="owned-food";if(condition==="carry-toy")h.s.carriedToyId="owned-toy";
    if(condition==="real-food-goal")h.s.brain.foodGoal={foodId:"same-actual-meal",remaining:3,retryAfter:0};if(condition==="missing-support")h.s.world.platforms=[];
    const before=JSON.stringify(h.s);expect(h.d.pendingApprovedContinuationReady(h.s)).toBe(false);expect(JSON.stringify(h.s)).toBe(before);expect(h.d.active()).toBe(false);
  });
  it("a current actual owner stays untouched by readiness queries",()=>{
    const h=protocol("D157-C");const action=h.d.next(h.s)!;const before={current:h.d.current(),deadline:h.d.progressDeadline()};
    for(let i=0;i<20;i++)expect(h.d.pendingApprovedContinuationReady(h.s)).toBe(false);
    expect({current:h.d.current(),deadline:h.d.progressDeadline()}).toEqual(before);expect(h.d.owns(action.meta)).toBe(true);
  });
});

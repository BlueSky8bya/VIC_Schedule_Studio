import { describe, expect, it } from "vitest";
import { createBrain, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { companionHomeTvControl } from "@/lib/ui/viewer-companion/home-room-media";
import { getCompanionPersonalityMeal } from "@/lib/ui/viewer-companion/personality-jobs";
import type { CompanionToy } from "@/lib/ui/viewer-companion/toys";

const floor: Platform = { id: "ordinary-floor", x: 0, y: 600, width: 1000, kind: "floor" };
const world = (): CompanionWorld => ({ x: 100, y: 600, platformId: floor.id, platforms: [floor], width: 1000, height: 700, animated: true });
const input = (personality: CompanionPersonality, patch: Partial<PersonalitySceneInput> = {}): PersonalitySceneInput => ({
  world: world(), brain: { ...createBrain(0, () => .5), hunger: .2, energy: .9, activeMs: 0 },
  preferences: { ...DEFAULT_COMPANION_PREFERENCES, personality }, now: 0, home: {}, toys: [], tv: "off", ...patch,
});
const ready = (personality: CompanionPersonality, patch: Partial<PersonalitySceneInput> = {}) => {
  const director = createCompanionPersonalityDirector(), scene = input(personality, patch);
  const first = director.next(scene)!;
  expect(first.meta.id).toBe(`entry-${personality}`);
  director.complete(first.meta);
  return { director, scene };
};
const ball = { id: "same-real-ball", kind: "ball" as const, x: 150, y: 600, platformId: floor.id, angle: 0, held: false, carried: false };
const requiredToyWork = (recipe: PersonalitySceneRecipe) => recipe.steps.some(step => step.kind === "toy" && !step.optional);
const requiredFoodWork = (recipe: PersonalitySceneRecipe) => recipe.steps.some(step => step.kind === "food" && !step.optional);
const toyOnlyRecipes = COMPANION_PERSONALITY_SCENES.filter(recipe => requiredToyWork(recipe) && !requiredFoodWork(recipe));

/** Pure host fixture: each requested physical operation receives an explicit
 * result, with actual current object IDs preserved. Travel only moves to the
 * director's proved route endpoint and never acknowledges a final effect.
 * This tests the full recipe/director protocol, not browser art or physics. */
const matrixInput = (recipe: PersonalitySceneRecipe): PersonalitySceneInput => {
  const room: Platform = { id: "companion-home-floor", x: 0, y: 600, width: 650, kind: "floor", manualOnly: true };
  const sofa: Platform = { id: "companion-home", x: 0, y: 560, width: 160, kind: "floor" };
  const pad: Platform = { id: "companion-home-floor-400", x: 500, y: 600, width: 40, kind: "floor", manualOnly: true, bodyOnly: true };
  const novel: Platform = { id: "actual-new-date", x: 700, y: 570, width: 180, kind: "date" };
  const point = (x: number) => ({ x, y: 600, platformId: room.id });
  const kinds = [...new Set(recipe.steps.flatMap(step => step.kind === "toy" ? step.kinds ?? [] : []))];
  if (!kinds.length) kinds.push("ball", "feather");
  if (kinds.length === 1) kinds.push(kinds[0] === "ball" ? "feather" : "ball");
  const scene = input(recipe.personality, {
    world: { ...world(), platforms: [floor, room, sofa, pad, novel, {id:"actual-second-outside",x:600,y:600,width:100,kind:"date"}], pointer: { x: 200, y: 600, stableMs: 1000 }, hideAvailable: true,
      foods: [{ id: "real-carrot", kind: "carrot", x: 185, y: 600, platformId: floor.id }, { id: "real-bagel", kind: "bagel", x: 220, y: 600, platformId: floor.id }] },
    home: { sofa: { x: 80, y: 560, platformId: sofa.id }, floor: point(300), window: point(260), pad: { x: 520, y: pad.y, platformId: pad.id }, box: point(470), dispenser: point(400), tv: point(210), light: point(400), curtain: point(260), radio: point(420),
      contacts: { tv: { x: 210, y: 570 }, light: { x: 400, y: 520 }, curtain: { x: 260, y: 545 }, radio: { x: 420, y: 550 } } },
    toys: kinds.slice(0, 3).map((kind, i) => ({ ...ball, id: `real-${kind}-${i}`, kind, x: 140 + i * 45 })),
    tv: recipe.id === "X-P-house" ? "music" : "nature", canTv: true, lightLit: true, familiarHour: true, learnedMorning: true, equipped: true, hasExperience: true, learnedSocial: true,
    music: { mood: recipe.id === "X-S-music" ? "calm" : "lively", familiar: true },
    favoriteFood: "carrot", favoriteToy: kinds[0], storedFoodIds: ["real-carrot"], yieldedItem: true, yieldedItemId: "real-yielded-toy",
    environment: { date: { y: 2026, m: 10, d: 19 }, season: "autumn", hour: 22, band: "night", night: true, weather: "rain", sunlight: 0 },
  });
  scene.brain.life = { ...createCompanionLife(() => 0), tastedFoods: ["bread"] };
  // A positive toy protocol requires no currently competing actual meal.
  // Keep both real reachable foods and feeding ON; only this current need
  // differs. Food rituals retain their hungry/cleanup source conditions.
  scene.brain.hunger = ["T02", "T03", "G02", "H08"].includes(recipe.id) ? .1
    : requiredToyWork(recipe) && !requiredFoodWork(recipe) ? .2 : .5;
  scene.brain.energy = recipe.personality === "sleepy" || recipe.id === "M05" ? .1 : .6;
  if(recipe.id==="D143-S")scene.brain.energy=.6;
  if(recipe.id==="D143-T")scene.toys=[];
  if (recipe.id === "T06") scene.world.foods = scene.world.foods!.map((food, i) => i === 1 ? { ...food, x: 205 } : food);
  if (["T05", "X-T-house"].includes(recipe.id)) scene.toys = [];
  if (recipe.id === "T07") { scene.toys = []; scene.world.foods = []; }
  if (recipe.id === "G04") { scene.preferences.learnFromYou = true; scene.brain.life!.tastedFoods = ["potato"]; }
  if (recipe.id === "X-P-house") scene.tv = "music";
  if (recipe.id === "T09") scene.deferredToyId = scene.toys[0]?.id;
  if (["T10", "B05"].includes(recipe.id)) scene.interruptedItemId = scene.toys[0]?.id;
  if (recipe.id === "G10") scene.environment = { ...scene.environment!, hour: 8, band: "morning", night: false };
  if (recipe.id === "A12") scene.preferences.petting = false;
  if (recipe.triggers.includes("summer")) scene.environment = { ...scene.environment!, season: "summer", hour: 14, band: "noon", night: false, weather: "clear", sunlight: 4 };
  if (recipe.id === "X-C-return-time") scene.environment = { ...scene.environment!, season: "spring", hour: 6, band: "dawn", night: false, weather: "clear" };
  if (recipe.id === "X-S-return-time") scene.environment = { ...scene.environment!, season: "winter" };
  if (recipe.id === "X-G-return-time") scene.environment = { ...scene.environment!, hour: 8, band: "morning", night: false };
  if (recipe.id === "X-P-return-time") scene.environment = { ...scene.environment!, hour: 19, band: "evening" };
  return scene;
};

const runRecipe = (director: ReturnType<typeof createCompanionPersonalityDirector>, scene: PersonalitySceneInput, expected: PersonalitySceneRecipe) => {
  for (const trigger of expected.triggers) director.event(trigger, scene.now);
  const effects: string[] = [];
  for (let step = 0; step < 200; step++) {
    if (director.completed().includes(expected.id)) return effects;
    const proposal = director.next(scene);
    if (!proposal) { scene.now += 1; continue; }
    expect(proposal.meta.id, `${expected.id}: step ${step}`).toBe(expected.id);
    const command = proposal.meta.command;
    if (proposal.action?.personalityScene.travel) {
      const beat = director.current()?.beat;
      director.complete(proposal.meta); director.resolve(proposal.meta, true);
      expect(director.current()?.beat, `${expected.id}: travel is not effect ACK`).toBe(beat);
      scene.world = { ...scene.world, ...proposal.action.target };
      const support = scene.world.platforms.find(platform => platform.id === scene.world.platformId)!;
      expect(support, `${expected.id}: route ends on a real support`).toBeTruthy();
      expect(scene.world.x).toBeGreaterThanOrEqual(support.x);
      expect(scene.world.x).toBeLessThanOrEqual(support.x + support.width);
      expect(scene.world.y).toBe(support.y);
      scene.now += proposal.action.duration;
    } else if (proposal.delegate?.kind === "toy") {
      const request = proposal.delegate;
      let toy: CompanionToy | undefined;
      if (request.mode === "spawn") {
        expect(scene.toys.length).toBeLessThan(4);
        toy = { ...ball, id: `spawned-${expected.id}`, kind: request.kinds?.[0] ?? "ball", x: scene.world.x, y: scene.world.y, platformId: scene.world.platformId };
        scene.toys = [...scene.toys, toy];
      } else toy = scene.toys.find(toy => (!proposal.meta.itemId || toy.id === proposal.meta.itemId) && (!request.kinds || request.kinds.includes(toy.kind)) && !toy.held && (!toy.carried || toy.id===scene.carriedToyId));
      if (!toy) {
        expect(command.optional, `${expected.id}: missing required real toy at beat ${proposal.meta.beat}`).toBe(true);
        director.resolve(proposal.meta, false); scene.now += 10; continue;
      }
      director.bind(proposal.meta, toy.id);
      effects.push(`toy:${request.mode}:${toy.id}`);
      if(request.mode==="inspect" && expected.propShow) {scene.carriedToyId=toy.id;scene.toys=scene.toys.map(item=>item.id===toy!.id?{...item,carried:true}:item);}
      if (request.mode === "toss") scene.toys = scene.toys.map(item => item.id === toy!.id ? { ...item, x: Math.min(600, item.x + 40) } : item);
      if (request.mode === "return") {scene.toys = scene.toys.filter(item => item.id !== toy!.id);if(scene.carriedToyId===toy.id)scene.carriedToyId=undefined;}
      director.resolve(proposal.meta, true, toy.id); scene.now += 600;
    } else if (proposal.delegate?.kind === "food") {
      const foods = scene.world.foods ?? [], favorite = ["T02", "G02", "H08"].includes(expected.id), discard = expected.id === "T03";
      const food = foods.find(food => (!proposal.meta.itemId || food.id === proposal.meta.itemId) && (!favorite || food.kind === scene.favoriteFood) && (!discard || food.kind !== scene.favoriteFood));
      if (!food) {
        expect(command.optional, `${expected.id}: missing required real food at beat ${proposal.meta.beat}`).toBe(true);
        director.resolve(proposal.meta, false); scene.now += 10; continue;
      }
      director.bind(proposal.meta, food.id); effects.push(`food:${proposal.delegate.mode}:${food.id}`);
      if (proposal.delegate.mode === "eat" || discard) scene.world.foods = foods.filter(item => item.id !== food.id);
      else if (proposal.delegate.mode === "tidy") scene.world.foods = foods.map(item => item.id === food.id ? { ...item, x: 340, platformId: "companion-home-floor" } : item);
      director.resolve(proposal.meta, true, food.id); scene.now += 600;
    } else if (command.kind === "tv" || command.kind === "light" || command.kind === "curtain" || command.kind === "wash") {
      if (command.kind === "wash") {
        expect(scene.world.platformId).toBe("companion-home-floor-400");
        expect(Math.hypot(scene.world.x - scene.home.pad!.x, scene.world.y - scene.home.pad!.y)).toBeLessThanOrEqual(1);
      }
      if (command.kind === "tv") scene.tv = command.state === "next" ? companionHomeTvControl(scene.tv).next : command.state;
      effects.push(command.kind);
      director.complete(proposal.meta); // Elapsed furniture gesture is not ACK.
      expect(director.current()?.beat).toBe(proposal.meta.beat);
      director.resolve(proposal.meta, true); scene.now += proposal.action?.duration ?? 1;
    } else {
      effects.push(command.kind);
      scene.now += proposal.action?.duration ?? 1;
      director.complete(proposal.meta);
    }
  }
  expect(director.completed(), `${expected.id}: must finish from actual acknowledgements`).toContain(expected.id);
  return effects;
};

describe("137 one personality scene director", () => {
  it.each(COMPANION_PERSONALITIES)("offers %s preparation on its first safe choice, separate from scene success", personality => {
    const director = createCompanionPersonalityDirector(), scene = input(personality);
    const proposal = director.next(scene)!;
    const preparation:Record<CompanionPersonality,{kind:string;play?:string}>={performer:{kind:"stretch"},curious:{kind:"sniff"},affectionate:{kind:"play",play:"groom"},sleepy:{kind:"play",play:"cozy-nest"},tidy:{kind:"play",play:"groom"},mischievous:{kind:"play",play:"pounce"},gourmet:{kind:"sniff"},homebody:{kind:"play",play:"cozy-nest"},balanced:{kind:"stretch"}};
    expect(proposal.action).toMatchObject({ ...preparation[personality], target: { x: 100, y: 600, platformId: floor.id }, personalitySignature: personality });
    expect(proposal.action!.duration).toBeGreaterThan(0);
    expect(proposal.action!.duration).toBeLessThan(10_000);
    expect(proposal.meta.id).toBe(`entry-${personality}`);
    expect(director.active()).toBe(false);
    director.complete(proposal.meta); director.resolve(proposal.meta, true);
    expect(director.completed()).toEqual([]);
  });

  it("starts the newly selected personality on its very next safe choice", () => {
    const director = createCompanionPersonalityDirector(), scene = input("curious");
    const previous = director.next(scene)!;
    scene.preferences = { ...scene.preferences, personality: "performer" }; scene.now = 1;
    const changed = director.next(scene)!;
    expect(changed.meta.id).toBe("entry-performer");
    expect(changed.action?.kind).toBe("stretch"); expect(changed.action?.play).toBeUndefined();
    expect(changed.meta.serial).toBeGreaterThan(previous.meta.serial);
    expect(director.completed()).toEqual([]);
  });

  it("143 a single outside condition accepts a real grounded public point without inventing a second trip or progress",()=>{
    const recipe=COMPANION_PERSONALITY_SCENES.find(r=>r.id==="P01")!,scene=input("performer"),d=createCompanionPersonalityDirector([recipe]);
    const entry=d.next(scene)!;d.complete(entry.meta);scene.now+=entry.action!.duration;d.event("arrival",scene.now);
    const kinds:string[]=[];let deadline:number|undefined;
    for(let n=0;n<6&&!d.completed().includes(recipe.id);n++) {const p=d.next(scene);if(!p)continue;kinds.push(p.action!.kind);deadline??=d.progressDeadline();scene.now+=p.action!.duration;d.complete(p.meta);}
    expect(d.completed()).toEqual(["P01"]);expect(kinds).toEqual(["play","play","play"]);expect(d.progressDeadline()).toBe(deadline);
  });

  it.each(["air","outside-x","missing","manual","body-only","control","hide"] as const)("143 single outside never accepts %s as an observed public place",state=>{
    const recipe:PersonalitySceneRecipe={id:"single-outside",label:"actual place",personality:"performer",major:false,triggers:["free"],steps:[{kind:"go",target:"outside"},{kind:"pose",pose:"groom"}]};
    const scene=input("performer"),d=createCompanionPersonalityDirector([recipe]),entry=d.next(scene)!;d.complete(entry.meta);scene.now+=entry.action!.duration;
    if(state==="air")scene.world.y-=20;if(state==="outside-x")scene.world.x=-1;
    if(state==="missing")scene.world.platforms=[];
    if(state==="manual")scene.world.platforms=[{...floor,manualOnly:true}];
    if(state==="body-only")scene.world.platforms=[{...floor,bodyOnly:true}];
    if(state==="control"||state==="hide")scene.world.platforms=[{...floor,kind:state}];
    expect(d.next(scene)).toBeUndefined();expect(d.completed()).toEqual([]);
  });

  it("143 an already bound outside goal survives an intermediate public support",()=>{
    const room:Platform={id:"companion-home-floor",kind:"floor",manualOnly:true,x:0,y:600,width:220};
    const transit:Platform={id:"transit",kind:"date",x:260,y:600,width:120},destination:Platform={id:"destination",kind:"date",x:520,y:580,width:180};
    const recipe:PersonalitySceneRecipe={id:"bound-outside",label:"one actual destination",personality:"performer",major:false,triggers:["free"],steps:[{kind:"go",target:"outside"},{kind:"pose",pose:"groom"}]};
    const scene=input("performer",{world:{...world(),platformId:room.id,platforms:[room,transit,destination]}});scene.brain.visited=[transit.id];
    const d=createCompanionPersonalityDirector([recipe]),entry=d.next(scene)!;d.complete(entry.meta);scene.now+=entry.action!.duration;
    let sawTransit=false,reached=false;
    for(let n=0;n<12&&!reached;n++) {const p=d.next(scene)!;expect(p).toBeTruthy();
      if(p.meta.beat===1){expect(scene.world.platformId).toBe(destination.id);reached=true;break;}
      expect(p.meta.travel).toBe(true);scene.world={...scene.world,...p.action!.target};scene.now+=p.action!.duration;d.complete(p.meta);
      if(scene.world.platformId===transit.id)sawTransit=true;
    }
    expect(sawTransit).toBe(true);expect(reached).toBe(true);
  });

  it("reserves entry while disabled/paused/busy and does not mutate care, foods, toys or switches", () => {
    for (const state of ["enabled", "roam", "paused", "animated", "busy"] as const) {
      const director = createCompanionPersonalityDirector(), scene = input("tidy", { toys: [ball] });
      scene.world.foods = [{ id: "real-carrot", kind: "carrot", x: 120, y: 600, platformId: floor.id }];
      if (state === "enabled" || state === "roam") scene.preferences = { ...scene.preferences, [state]: false };
      else if (state === "paused") scene.world.paused = true;
      else if (state === "animated") scene.world.animated = false;
      else scene.busy = true;
      const before = JSON.stringify(scene);
      expect(director.next(scene), state).toBeUndefined();
      expect(JSON.stringify(scene), state).toBe(before);
      scene.preferences = { ...scene.preferences, enabled: true, roam: true }; scene.world.paused = false; scene.world.animated = true; scene.busy = false;
      expect(director.next(scene)?.meta.id, state).toBe("entry-tidy");
    }
  });

  it("honors jump and petting OFF during the very first preparation", () => {
    const director = createCompanionPersonalityDirector(), scene = input("mischievous");
    scene.preferences = { ...scene.preferences, jump: false };
    expect(director.next(scene)?.action?.play).not.toBe("pounce");
    const off = createCompanionPersonalityDirector(), affectionate = input("affectionate");
    affectionate.preferences = { ...affectionate.preferences, petting: false };
    expect(off.next(affectionate)?.action?.play).toBe("groom");
  });

  it("cannot stand beside a support or in midair to launch a preparation", () => {
    for (const point of [{ x: -1, y: 600 }, { x: 1001, y: 600 }, { x: 100, y: 500 }]) {
      const director = createCompanionPersonalityDirector(), scene = input("performer"); Object.assign(scene.world, point);
      expect(director.next(scene), JSON.stringify(point)).toBeUndefined();
    }
  });

  it("responds to a genuine work event once and never treats travel/elapsed effects as ACK", () => {
    const room:Platform={...floor,id:"companion-home-floor",manualOnly:true};
    const {director,scene}=ready("performer",{world:{...world(),platformId:room.id,platforms:[room,{id:"actual-outside",x:200,y:600,width:250,kind:"floor"}]},home:{floor:{x:100,y:600,platformId:room.id}}});
    director.event("work",0);scene.now=1;
    let travel=0,performed=0;
    for(let n=0;n<12&&!director.completed().includes("P04");n++) {
      const proposal=director.next(scene);if(!proposal)continue;
      if(director.completed().includes("P04"))break;
      expect(proposal.meta.id).toBe("P04");
      if(proposal.meta.travel){
        travel++;expect(["walk","jump"]).toContain(proposal.action?.kind);const beat=director.current()?.beat;
        director.complete(proposal.meta);director.resolve(proposal.meta,true);expect(director.current()?.beat).toBe(beat);expect(director.completed()).toEqual([]);
        scene.world={...scene.world,...proposal.action!.target};
      }else {expect(scene.world.platformId).toBe("actual-outside");performed++;director.complete(proposal.meta);}
      scene.now+=proposal.action!.duration;
    }
    expect(travel).toBeGreaterThan(0);expect(performed).toBe(3);
    expect(scene.world.platformId).toBe("actual-outside");expect(director.completed()).toEqual(["P04"]);
    for (let i = 0; i < 5; i++) {
      scene.now += 500;
      const next = director.next(scene);
      expect(next?.meta.id).not.toBe("P04");
      expect(next?.meta.id).not.toBe("X-P-editor");
      if (next) director.complete(next.meta);
    }
  });

  it("holds the same real toy through toss, route and the next effect; unrelated/stale ACKs do nothing", () => {
    const { director, scene } = ready("mischievous", { toys: [{ ...ball }], home: { box: { x: 500, y: floor.y, platformId: floor.id } } }); scene.now = 1;
    let proposal = director.next(scene)!;
    expect(proposal.meta.id).toBe("M01"); expect(proposal.delegate).toMatchObject({ kind: "toy", mode: "toss", kinds: ["ball"] });
    director.complete(proposal.meta);
    director.resolve({ ...proposal.meta, serial: proposal.meta.serial + 1 }, true, "foreign-ball");
    expect(director.current()?.beat).toBe(0);
    director.resolve(proposal.meta, true, ball.id); expect(director.current()).toMatchObject({ id: "M01", beat: 1, itemId: ball.id });
    scene.now = 100; proposal = director.next(scene)!;
    expect(proposal.meta).toMatchObject({ id: "M01", beat: 1, itemId: ball.id, travel: true });
    expect(proposal.action).toMatchObject({ kind: "walk", target: { x: ball.x, y: ball.y, platformId: floor.id } });
    director.complete(proposal.meta); expect(director.current()?.beat).toBe(1);
    scene.world = { ...scene.world, ...proposal.action!.target }; scene.now = 500;
    proposal = director.next(scene)!;
    expect(proposal.meta).toMatchObject({ id: "M01", beat: 2, itemId: ball.id });
    expect(proposal.delegate).toMatchObject({ kind: "toy", mode: "toss", kinds: ["ball"] });
  });

  it("cancels instead of substituting another toy after the user takes the locked object", () => {
    const { director, scene } = ready("mischievous", { toys: [{ ...ball }, { ...ball, id: "other-real-ball", x: 240 }], home: { box: { x: 500, y: floor.y, platformId: floor.id } } });
    scene.now = 1; const proposal = director.next(scene)!; director.resolve(proposal.meta, true, ball.id);
    scene.toys = [{ ...ball, held: true }, { ...ball, id: "other-real-ball", x: 240 }]; scene.now = 500;
    const yielded = director.next(scene);
    expect(yielded?.meta.itemId).not.toBe("other-real-ball");
    expect(director.completed()).not.toContain("M01");
    expect(director.current()?.id).not.toBe("M01");
  });

  it("abandons an effect with no actual progress after7.5 active seconds without marking success", () => {
    const { director, scene } = ready("mischievous", { toys: [{ ...ball }], home: { box: { x: 500, y: floor.y, platformId: floor.id } } }); scene.now = 1;
    const effect = director.next(scene)!; expect(effect.meta.id).toBe("M01");
    scene.now = 7400; expect(director.next(scene)?.meta.id).toBe("M01");
    scene.now = 7602; const retried = director.next(scene);
    expect(director.completed()).not.toContain("M01");
    expect(retried?.meta.id).not.toBe("M01");
  });

  it("finishes pointer approach at the actual safe destination instead of failing when route.step becomes empty", () => {
    const { director, scene } = ready("affectionate");
    scene.world.pointer = { x: 200, y: 600, stableMs: 1000 }; scene.now = 1;
    const travel = director.next(scene)!;
    expect(travel.meta.id).toBe("A01"); expect(travel.action?.kind).toBe("walk");
    scene.world = { ...scene.world, ...travel.action!.target }; scene.now = 1000;
    const request = director.next(scene);
    expect(request?.meta.id).toBe("A01");
    expect(request?.action?.play).toBe("ask-petting");
    expect(director.current()?.beat).toBe(1);
  });

  it("requires every combined trigger and only proposes sleep with the saved permission", () => {
    const { director, scene } = ready("affectionate"); director.event("arrival", 0);
    scene.world.pointer = { x: 124, y: 600, stableMs: 1000 }; scene.now = 1;
    expect(director.next(scene)?.meta.id).not.toBe("A04");
    const sleepy = input("sleepy", { home: { sofa: { x: 100, y: 600, platformId: floor.id } } });
    sleepy.brain.energy = .1; sleepy.preferences.sleep = false;
    const awake = createCompanionPersonalityDirector(); awake.next(sleepy);
    const before = JSON.stringify(sleepy);
    for (let i = 0; i < 12; i++) {
      sleepy.now = i * 100;
      const proposal = awake.next(sleepy);
      expect(proposal?.action?.kind).not.toBe("sleep");
      if (proposal?.action) awake.complete(proposal.meta);
      else if (proposal?.delegate) awake.resolve(proposal.meta, false);
    }
    sleepy.now = 0; expect(JSON.stringify(sleepy)).toBe(before);
  });

  it.each([
    ["P05", "no completed previous performance", (): void => undefined],
    ["T04", "no actual user takeover", (scene: PersonalitySceneInput) => { scene.yieldedItem = false; }],
    ["G03", "no retained stored object ID", (scene: PersonalitySceneInput) => { scene.storedFoodIds = []; }],
    ["H02", "favorite toy is already at home", (scene: PersonalitySceneInput) => { scene.toys = scene.toys.map(toy => ({ ...toy, platformId: "companion-home-floor" })); }],
    ["B10", "no actual positive social experience", (scene: PersonalitySceneInput) => { scene.learnedSocial = false; }],
    ["T02", "favorite food is absent", (scene: PersonalitySceneInput) => { scene.favoriteFood = "durian"; }],
    ["T03", "only the favorite remains", (scene: PersonalitySceneInput) => { scene.world.foods = scene.world.foods!.filter(food => food.kind === scene.favoriteFood); }],
    ["P12", "TV is off", (scene: PersonalitySceneInput) => { scene.tv = "off"; }],
    ["X-P-house", "music picture is not actually playing", (scene: PersonalitySceneInput) => { scene.tv = "nature"; }],
    ["A11", "no actual TV to turn away from", (scene: PersonalitySceneInput) => { scene.tv = "off"; }],
    ["X-A-house", "no actual TV to turn away from", (scene: PersonalitySceneInput) => { scene.tv = "off"; }],
    ["M05", "no actual channel to change", (scene: PersonalitySceneInput) => { scene.tv = "off"; }],
    ["X-M-house", "no actual channel to change", (scene: PersonalitySceneInput) => { scene.tv = "off"; }],
    ["X-B-house", "no actual viewing segment", (scene: PersonalitySceneInput) => { scene.tv = "off"; }],
    ["G04", "taste learning is off", (scene: PersonalitySceneInput) => { scene.preferences.learnFromYou = false; }],
    ["G04", "no same-category experience exists", (scene: PersonalitySceneInput) => { scene.brain.life!.tastedFoods = []; }],
    ["T05", "an unavailable real toy remains held or in flight", (scene: PersonalitySceneInput) => { scene.toyCount = 1; }],
    ["X-T-house", "an unavailable real toy remains held or in flight", (scene: PersonalitySceneInput) => { scene.toyCount = 1; }],
    ["X-M-return-time", "arrival is outside the actual night band", (scene: PersonalitySceneInput) => { scene.environment = { ...scene.environment!, hour: 12, band: "noon", night: false }; }],
    ["M02", "no real toy car", (scene: PersonalitySceneInput) => { scene.toys = [{ ...ball }]; }],
    ["G01", "no learned favorite at all", (scene: PersonalitySceneInput) => { scene.favoriteFood = null; }],
    ["G01", "learned favorite is absent", (scene: PersonalitySceneInput) => { scene.favoriteFood = "durian"; }],
    ["B11", "rain is outside autumn", (scene: PersonalitySceneInput) => { scene.environment = { ...scene.environment!, season: "winter" }; }],
    ["X-C-return-time", "arrival is outside spring dawn", (scene: PersonalitySceneInput) => { scene.environment = { ...scene.environment!, season: "summer", hour: 14, band: "noon" }; }],
    ["X-S-return-time", "night arrival is outside winter", (scene: PersonalitySceneInput) => { scene.environment = { ...scene.environment!, season: "summer" }; }],
    ["X-G-return-time", "food arrival is outside morning band", (scene: PersonalitySceneInput) => { scene.environment = { ...scene.environment!, hour: 19, band: "evening" }; }],
  ] as const)("does not fabricate $0 source context: $1", (id, _reason, change) => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === id)!, director = createCompanionPersonalityDirector([recipe]);
    const scene = matrixInput(recipe); director.next(scene); change(scene);
    for (const trigger of recipe.triggers) director.event(trigger, scene.now);
    const proposal = director.next(scene);
    expect(proposal?.meta.id).not.toBe(id);
    expect(director.completed()).not.toContain(id);
  });

  it("C09 chooses the less-played real kind even when an experienced toy is much nearer", () => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "C09")!, scene = matrixInput(recipe), director = createCompanionPersonalityDirector([recipe]);
    scene.toys = [{ ...ball, x: 120 }, { ...ball, id: "less-played-feather", kind: "feather", x: 500 }];
    scene.toyPlayCounts = { ball: 8, feather: 0 }; director.next(scene);
    expect(director.next(scene)?.meta.itemId).toBe("less-played-feather");
  });

  it.each(toyOnlyRecipes)("yields $id before any toy preparation when a currently needed real meal is reachable", recipe => {
    const scene = matrixInput(recipe), director = createCompanionPersonalityDirector([recipe]);
    scene.brain.hunger = .5;
    expect(scene.preferences.feeding).toBe(true);
    expect(scene.world.foods).toHaveLength(2);
    const toyIds = scene.toys.map(toy => toy.id);
    const entry = director.next(scene)!; director.complete(entry.meta);
    for (const trigger of recipe.triggers) director.event(trigger, scene.now);
    const proposal = director.next(scene);
    expect(proposal).toBeUndefined();
    expect(director.active()).toBe(false);
    expect(director.routineReserved(scene)).toBe(false);
    expect(director.completed()).toEqual([]);
    expect(scene.toys.map(toy => toy.id)).toEqual(toyIds);
    const meal = getCompanionPersonalityMeal(director, proposal, { ...scene, authoredReserved: director.routineReserved(scene) });
    expect(meal).toBeDefined();
    expect(["walk", "jump", "eat"]).toContain(meal!.kind);
    expect(scene.world.foods!.some(food => food.id === meal!.foodId)).toBe(true);
  });

  it.each(["feeding-off", "full", "unreachable-food"] as const)("still completes the same real T01 return when meal priority is absent: %s", gate => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(item => item.id === "T01")!, scene = matrixInput(recipe), director = createCompanionPersonalityDirector([recipe]);
    scene.brain.hunger = gate === "full" ? .2 : .5;
    if (gate === "feeding-off") scene.preferences.feeding = false;
    if (gate === "unreachable-food") scene.world.foods = scene.world.foods!.map(food => ({ ...food, x: 5000, y: 100, platformId: "missing-food-support" }));
    const ids = scene.toys.map(toy => toy.id);
    const entry = director.next(scene)!; director.complete(entry.meta);
    const effects = runRecipe(director, scene, recipe);
    expect(effects.filter(effect => effect.startsWith("toy:return:"))).toHaveLength(1);
    const returned = effects.find(effect => effect.startsWith("toy:return:"))!.slice("toy:return:".length);
    expect(ids).toContain(returned);
    expect(scene.toys.some(toy => toy.id === returned)).toBe(false);
    expect(director.completed()).toEqual(["T01"]);
  });

  it("C01 crosses to the opposite safe side of its same toy and follows that one side's fraction through layout movement", () => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "C01")!, director = createCompanionPersonalityDirector([recipe]), scene = input("curious", { toys: [{ ...ball }], home: { box: { x: 500, y: floor.y, platformId: floor.id } } });
    director.next(scene); director.event("toy-settled", 0);
    const firstLook = director.next(scene)!; director.complete(firstLook.meta); scene.now += firstLook.action!.duration;
    const approach = director.next(scene)!; scene.world = { ...scene.world, ...approach.action!.target }; scene.now += approach.action!.duration;
    const inspect = director.next(scene)!; expect(inspect.delegate).toMatchObject({ kind: "toy", mode: "inspect" }); director.resolve(inspect.meta, true, ball.id);
    const other = director.next(scene)!; expect(other.action?.target.x).toBeGreaterThan(ball.x); expect(other.meta.itemId).toBe(ball.id);
    const originalTarget = other.action!.target.x;
    scene.world = { ...scene.world, x: scene.world.x + 80, platforms: scene.world.platforms.map(platform => ({ ...platform, x: platform.x + 80 })) };
    scene.toys = [{ ...ball, x: ball.x + 80 }]; scene.now += 100;
    const afterLayout = director.next(scene)!;
    expect(afterLayout.meta.itemId).toBe(ball.id); expect(afterLayout.action!.target.x).toBeCloseTo(originalTarget + 80);
    expect(afterLayout.action!.target.platformId).toBe(floor.id);
    expect(director.completed()).not.toContain("C01");
  });

  it("B09 avoids the last selected real kind when equally experienced choices remain", () => {
    const before = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "B06")!, recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "B09")!;
    const director = createCompanionPersonalityDirector([before, recipe]), scene = matrixInput(recipe);
    scene.toys = [{ ...ball, x: 120 }, { ...ball, id: "different-feather", kind: "feather", x: 500 }]; scene.toyPlayCounts = { ball: 0, feather: 0 };
    director.next(scene); runRecipe(director, scene, before);
    // A new physical ball of the same recent kind is available after the
    // completed return. A different actual kind is still preferred now.
    scene.toys = [{ ...ball, id: "later-real-ball", x: scene.world.x + 5 }, { ...ball, id: "different-feather", kind: "feather", x: 500 }];
    expect(director.next(scene)?.meta.itemId).toBe("different-feather");
  });

  it.each([{ hunger: .7, expected: "near-known" }, { hunger: .5, expected: "far-new" }])("B03 uses current hunger $hunger to choose $expected without ignoring actual experience", ({ hunger, expected }) => {
    const recipe = COMPANION_PERSONALITY_SCENES.find(scene => scene.id === "B03")!, director = createCompanionPersonalityDirector([recipe]), scene = matrixInput(recipe);
    scene.preferences.learnFromYou = true; scene.brain.hunger = hunger; scene.brain.life!.tastedFoods = ["carrot"];
    scene.world.foods = [{ id: "near-known", kind: "carrot", x: 130, y: 600, platformId: floor.id }, { id: "far-new", kind: "bagel", x: 500, y: 600, platformId: floor.id }];
    director.next(scene); expect(director.next(scene)?.meta.itemId).toBe(expected);
  });

  it("draws every actual scene from the153 registered recipes and never immediately repeats a completed scene", () => {
    const { director, scene } = ready("performer");
    let lastCompleted = "";
    for (let i = 0; i < 30; i++) {
      scene.now += 200;
      const proposal = director.next(scene);
      if (!proposal) continue;
      if (!proposal.meta.id.startsWith("ready-")) expect(COMPANION_PERSONALITY_SCENES.some(recipe => recipe.id === proposal.meta.id)).toBe(true);
      expect(proposal.meta.id).not.toBe(lastCompleted);
      if (proposal.action) director.complete(proposal.meta);
      const nextCompleted = director.completed().at(-1) ?? "";
      if (nextCompleted !== lastCompleted) lastCompleted = nextCompleted;
    }
  });

  it.each(COMPANION_PERSONALITY_SCENES)("executes $id with actual source context, proved route endpoints and explicit effect ACKs", recipe => {
    const predecessors = recipe.id === "P05" ? ["P11"] : recipe.id === "B02" ? ["B07", "B12"] : [];
    const recipes = [...predecessors.map(id => COMPANION_PERSONALITY_SCENES.find(item => item.id === id)!), recipe];
    const director = createCompanionPersonalityDirector(recipes), scene = matrixInput(recipe);
    const entry = director.next(scene)!; expect(entry.meta.id).toBe(`entry-${recipe.personality}`); director.complete(entry.meta);
    scene.now += entry.action!.duration;
    // This positive protocol host starts after a real modeled preparation
    // displacement. Separate142 regressions keep the stationary entry path
    // and prove that pose/beat completion cannot refresh physical progress.
    scene.world.x += 24;
    for (const id of predecessors) runRecipe(director, scene, COMPANION_PERSONALITY_SCENES.find(item => item.id === id)!);
    if (predecessors.length) scene.world.x += 24;
    const before = new Set(director.completed());
    const effects = runRecipe(director, scene, recipe);
    expect(before.has(recipe.id)).toBe(false);
    expect(director.completed()).toContain(recipe.id);
    expect(effects.length).toBeGreaterThan(0);
  });
});

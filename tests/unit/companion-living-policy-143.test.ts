import { accessibleCompanionToys,createCompanionToys,createCompanionToyPlanner,type CompanionToyKind } from "../../lib/ui/viewer-companion/toys";
import { randomCompanionToy } from "../../lib/ui/viewer-companion/toy-catalog";
import { createCompanionHousehold } from "../../lib/ui/viewer-companion/household";
import { createCompanionPersonalityJobs } from "../../lib/ui/viewer-companion/personality-jobs";
import { companionToyReturnTarget,companionToyReturnDelivered,sampleCompanionToyReturn } from "../../lib/ui/viewer-companion/toy-return";
import { createCompanionHomeTvStore } from "../../lib/ui/viewer-companion/home-room-media";
import { describe, expect, it } from "vitest";
import { createBrain, type Platform } from "../../lib/ui/viewer-companion/brain";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "../../lib/ui/viewer-companion/preferences";
import { companionAudienceAtOutside, companionAudiencePlay, companionEntryPreparation, companionMayAddressAudience, companionOutsidePlatforms, companionPrivateHomeSupport } from "../../lib/ui/viewer-companion/life-space";
import { createCompanionPersonalityDirector, type PersonalitySceneInput, type PersonalitySceneProposal } from "../../lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe } from "../../lib/ui/viewer-companion/personality-scene-catalog";
import { createCompanionRoutineArbiter, type CompanionRoutineInput } from "../../lib/ui/viewer-companion/routine-arbiter";
import { companionPettingResponse, createCompanionPettingGesture } from "../../lib/ui/viewer-companion/petting";
import { getCompanionBehaviorProfile } from "../../lib/ui/viewer-companion/behavior-profile";
import { createCompanionScenes, type CompanionSceneInput } from "../../lib/ui/viewer-companion/scenes";
import { newCompanionSceneMemory } from "../../lib/ui/viewer-companion/scene-memory";
import { getLivingAction } from "../../lib/ui/viewer-companion/living";

const floor: Platform = {id:"companion-home-floor",x:0,y:600,width:300,kind:"floor",manualOnly:true};
const sofa: Platform = {id:"companion-home",x:30,y:560,width:70,kind:"date"};
const outside: Platform = {id:"actual-calendar-one",x:280,y:600,width:170,kind:"date"};
const further: Platform = {id:"actual-calendar-two",x:460,y:570,width:170,kind:"date"};
const input=(personality:CompanionPersonality="performer"):PersonalitySceneInput=>({
  world:{x:120,y:600,platformId:floor.id,platforms:[floor,sofa,outside,further],width:800,height:700,animated:true,foods:[]},
  brain:{...createBrain(0,()=>.5),hunger:.2,energy:.9},preferences:{...DEFAULT_COMPANION_PREFERENCES,personality},now:0,
  home:{floor:{x:160,y:600,platformId:floor.id},sofa:{x:65,y:560,platformId:sofa.id},box:{x:100,y:600,platformId:floor.id}},toys:[],tv:"off",
});
function entry(d:ReturnType<typeof createCompanionPersonalityDirector>,scene:PersonalitySceneInput) {
  const offered=d.next(scene)!;expect(offered.meta.id).toBe(`entry-${scene.preferences.personality}`);
  expect(offered.action).toBeDefined();scene.now+=offered.action!.duration;d.complete(offered.meta);return offered;
}
function apply(d:ReturnType<typeof createCompanionPersonalityDirector>,scene:PersonalitySceneInput,offered:PersonalitySceneProposal) {
  const action=offered.action!;expect(action).toBeDefined();scene.now+=action.duration;
  if(offered.meta.travel){
    const plane=scene.world.platforms.find(p=>p.id===action.target.platformId)!;expect(plane).toBeDefined();
    expect(action.target.y).toBe(plane.y);expect(action.target.x).toBeGreaterThanOrEqual(plane.x);expect(action.target.x).toBeLessThanOrEqual(plane.x+plane.width);
    scene.world={...scene.world,...action.target};scene.brain.visited=[...new Set([...scene.brain.visited,plane.id])];
    d.observeProgress({now:scene.now,active:true,point:action.target});
  }
  d.complete(offered.meta);
}
const playRecipe=(personality:CompanionPersonality,pet=false):PersonalitySceneRecipe=>({id:"actual-audience",label:"test",personality,major:true,triggers:[pet?"pet":"free"],steps:[{kind:"pose",pose:pet?"lean-nuzzle":"cheer-rehearsal"}]});

describe("143 private space and real outside goals",()=>{
  it.each(COMPANION_PERSONALITIES)("%s immediately prepares with an actual typed action, without an indoor audience",personality=>{
    const scene=input(personality),d=createCompanionPersonalityDirector([]),offered=entry(d,scene);
    expect(companionAudiencePlay(offered.action!.play)).toBe(false);
    expect(["play","stretch","sniff"]).toContain(offered.action!.kind);expect(d.entryReady()).toBe(true);
    const jumpOff=companionEntryPreparation(personality,scene.world,false);expect(jumpOff.play).not.toBe("pounce");
    expect(JSON.stringify(offered)).not.toContain("learn");
  });
  it.each(COMPANION_PERSONALITIES)("%s reaches a real outside support before voluntary cheer",personality=>{
    const scene=input(personality),d=createCompanionPersonalityDirector([playRecipe(personality)]);entry(d,scene);
    let moved=0,cheered=false;
    for(let n=0;n<18;n++){
      const offered=d.next(scene);if(!offered)break;
      if(offered.action?.play==="cheer-rehearsal") {expect(companionAudienceAtOutside(scene.world)).toBe(true);cheered=true;break;}
      expect(offered.meta.travel).toBe(true);expect(["walk","jump"]).toContain(offered.action?.kind);moved++;apply(d,scene,offered);
    }
    expect(moved).toBeGreaterThan(0);expect(cheered).toBe(true);
  });
  it.each(COMPANION_PERSONALITIES)("%s retains a real direct pet follow-up in its private house",personality=>{
    const scene=input(personality),d=createCompanionPersonalityDirector([playRecipe(personality,true)]);entry(d,scene);d.event("pet",scene.now);
    const offered=d.next(scene)!;expect(offered.action?.play).toBe("lean-nuzzle");expect(offered.meta.travel).toBeUndefined();expect(scene.world.platformId).toBe(floor.id);
  });
  it.each(["companion-home","companion-home-floor","companion-home-floor-400","companion-home-floor-food"])("classifies %s as private without treating ID changes as outside",id=>{
    const scene=input();scene.world={...scene.world,platformId:id,platforms:[{...floor,id}]};
    expect(companionPrivateHomeSupport(id)).toBe(true);expect(companionMayAddressAudience(scene.world)).toBe(false);expect(companionMayAddressAudience(scene.world,true)).toBe(true);
  });
  it.each(["no-outside","jump-off","body-only","manual-card","control","paused","roam-off","enabled-off"])("fails closed for outside audience when %s",condition=>{
    const scene=input(),d=createCompanionPersonalityDirector([playRecipe("performer")]);entry(d,scene);
    if(condition==="no-outside")scene.world.platforms=[floor,sofa];
    if(condition==="jump-off")scene.preferences.jump=false;
    if(condition==="body-only")scene.world.platforms=[floor,sofa,{...outside,bodyOnly:true},{...further,bodyOnly:true}];
    if(condition==="manual-card")scene.world.platforms=[floor,sofa,{...outside,manualOnly:true},{...further,manualOnly:true}];
    if(condition==="control")scene.world.platforms=[floor,sofa,{...outside,kind:"control"},{...further,kind:"control"}];
    if(condition==="paused")scene.world.paused=true;
    if(condition==="roam-off")scene.preferences.roam=false;
    if(condition==="enabled-off")scene.preferences.enabled=false;
    expect(d.next(scene)).toBeUndefined();
  });
  it("bounds candidate work to8 actual outside supports and never includes a private/body/control node",()=>{
    const scene=input();
    scene.world.platforms=[floor,sofa,...Array.from({length:30},(_,i)=>({...outside,id:`actual-${i}`,x:280+i*30})),{...outside,id:"hidden",kind:"hide"},{...outside,id:"pad",bodyOnly:true}];
    const candidates=companionOutsidePlatforms(scene.world);expect(candidates).toHaveLength(8);expect(candidates.every(p=>p.id.startsWith("actual-"))).toBe(true);
    const frozen=JSON.stringify(scene.world);companionOutsidePlatforms(scene.world);expect(JSON.stringify(scene.world)).toBe(frozen);
  });
  it("executes C05 through two distinct actual outside destinations without a sofa reset",()=>{
    const scene=input("curious"),recipe=COMPANION_PERSONALITY_SCENES.find(r=>r.id==="C05")!,d=createCompanionPersonalityDirector([recipe]);entry(d,scene);d.event("layout",scene.now);
    const arrivals=new Map<number,string>();let terminal=false;
    for(let n=0;n<28;n++){
      const offered=d.next(scene);if(!offered)break;
      if(offered.action?.play==="bow"){terminal=true;break;}
      apply(d,scene,offered);
      if(offered.meta.command.kind==="go"&&offered.meta.command.target==="outside"&&companionAudienceAtOutside(scene.world))arrivals.set(offered.meta.beat,scene.world.platformId!);
    }
    expect(terminal).toBe(true);expect(new Set(arrivals.values()).size).toBe(2);
    expect(scene.world.platformId).not.toBe(sofa.id);
  });
  it("keeps the last audience watch outside rather than silently returning to the TV sofa",()=>{
    const scene=input("affectionate");scene.tv="nature";scene.home.tv={x:200,y:600,platformId:floor.id};scene.world.pointer={x:400,y:600,stableMs:1200};
    const recipe=COMPANION_PERSONALITY_SCENES.find(r=>r.id==="A11")!,d=createCompanionPersonalityDirector([recipe]);entry(d,scene);
    let meeting=false,watch=false;
    for(let n=0;n<24;n++){
      const offered=d.next(scene);if(!offered)break;
      if(offered.meta.beat===2&&offered.action?.play==="bow")meeting=true;
      if(meeting&&offered.meta.beat===3){expect(offered.action?.kind).toBe("look");expect(offered.meta.travel).toBeUndefined();expect(companionAudienceAtOutside(scene.world)).toBe(true);watch=true;break;}
      apply(d,scene,offered);
    }
    expect(meeting).toBe(true);expect(watch).toBe(true);
  });
  it("does not replace an outside goal with another support when its reserved source disappears",()=>{
    const scene=input(),recipe:PersonalitySceneRecipe={...playRecipe("performer"),steps:[{kind:"go",target:"outside"},{kind:"pose",pose:"bow"}]},d=createCompanionPersonalityDirector([recipe]);entry(d,scene);
    const offered=d.next(scene)!;apply(d,scene,offered);
    scene.world.platforms=[floor,sofa];expect(d.next(scene)).toBeUndefined();expect(d.active()).toBe(false);
  });
  it("leaves post-cleanup floor continuation distinct from necessary TV/sleep/homebody sofa goals",()=>{
    for(const id of ["T05","X-T-return-time","A11"])expect(COMPANION_PERSONALITY_SCENES.find(r=>r.id===id)!.steps.some(s=>s.kind==="go"&&s.target==="sofa")).toBe(false);
    for(const id of ["S01","S03","C04","G05","H01"])expect(COMPANION_PERSONALITY_SCENES.find(r=>r.id===id)!.steps.some(s=>s.kind==="go"&&s.target==="sofa")).toBe(true);
    expect(COMPANION_PERSONALITY_SCENES).toHaveLength(153);
  });
});

describe("143 awake outside routines retain care ownership",()=>{
  const active=["performer","curious","affectionate","tidy","mischievous","gourmet","balanced"] as const;
  it.each(active)("%s admits actual day and night outings while awake",personality=>{
    for(const night of [false,true]){
      const arbiter=createCompanionRoutineArbiter(),scene={...input(personality),active:true,entryReady:true,environment:{date:{y:2026,m:10,d:20},season:"autumn",weather:"clear",band:night?"night":"noon",night,hour:night?23:13}} as CompanionRoutineInput;
      expect(arbiter.next(scene)).toBeUndefined();scene.now=9000;const offered=arbiter.next(scene)!;expect(offered.kind).toBe("outing");
      const steps=offered.recipe.steps.filter(s=>s.kind==="go");expect(steps.every(s=>s.target==="outside")).toBe(true);expect(steps).toHaveLength(personality==="curious"?2:1);
    }
  });
  it.each(["homebody","sleepy"] as const)("%s retains a slower optional first departure",personality=>{
    const a=createCompanionRoutineArbiter(),scene={...input(personality),active:true,entryReady:true};a.next(scene);scene.now=9000;expect(a.next(scene)).toBeUndefined();
  });
  it.each(["owned","reserved","carried","busy","roam","paused","canOuting"])("does not steal a real owner or explicit gate: %s",gate=>{
    const a=createCompanionRoutineArbiter(),scene:CompanionRoutineInput={...input(),active:true,entryReady:true};a.next(scene);scene.now=9000;
    if(gate==="owned")scene.owned=true;if(gate==="reserved")scene.authoredReserved=true;if(gate==="carried")scene.carriedToyId="actual-kept-id";if(gate==="busy")scene.busy=true;
    if(gate==="roam")scene.preferences.roam=false;if(gate==="paused")scene.world.paused=true;if(gate==="canOuting")scene.canOuting=false;
    expect(a.next(scene)).toBeUndefined();
  });
  it("keeps actual urgent feeding and needed sleep ahead of optional movement, preserving OFF",()=>{
    for(const need of ["hunger","sleep"] as const){
      const a=createCompanionRoutineArbiter(),scene:CompanionRoutineInput={...input(),active:true,entryReady:true,authoredReserved:true};
      if(need==="hunger"){scene.brain.hunger=.8;scene.meal={canSupply:true};scene.home.dispenser={x:180,y:600,platformId:floor.id};}
      else scene.brain.energy=.15;
      const offered=a.next(scene)!;expect(offered.kind).toBe(need==="hunger"?"meal":"nap");
      if(need==="hunger")scene.preferences.feeding=false;else scene.preferences.sleep=false;
      expect(createCompanionRoutineArbiter().next(scene)).toBeUndefined();
    }
  });
});

describe("143 real petting remains manual and personality-specific",()=>{
  it.each(COMPANION_PERSONALITIES)("%s has a finite response without inventing a gesture reward",personality=>{
    const original=JSON.stringify(DEFAULT_COMPANION_PREFERENCES),response=companionPettingResponse(personality,{petting:true,jump:true,sleep:true});
    expect(response).toHaveLength(2);expect(companionPettingResponse(personality,{petting:false,jump:true,sleep:true})).toEqual([]);
    expect(companionPettingResponse(personality,{petting:true,jump:false,sleep:true})).not.toContain("pounce");expect(JSON.stringify(DEFAULT_COMPANION_PREFERENCES)).toBe(original);
    const gesture=createCompanionPettingGesture();expect(gesture.sample(.3,0).reward).toBe(false);expect(gesture.sample(.3,100).reward).toBe(false);expect(gesture.sample(.3,600).reward).toBe(false);
  });
  it.each(COMPANION_PERSONALITIES)("%s respects sleep OFF in preparation and direct touch responses",personality=>{
    const scene=input(personality);scene.preferences.sleep=false;
    const d=createCompanionPersonalityDirector([]),offered=d.next(scene)!;
    expect(["cozy-nest","doze-curl"]).not.toContain(offered.action?.play);
    const response=companionPettingResponse(personality,{petting:true,jump:true,sleep:false});
    expect(response).toHaveLength(2);expect(response).not.toContain("cozy-nest");expect(response).not.toContain("doze-curl");
    if(personality==="sleepy")expect(response[0]).toBe("stretch");
    if(personality==="homebody")expect(response[0]).toBe("groom");
  });
  it("retains the actual reversal and4second reward budget",()=>{
    const g=createCompanionPettingGesture();g.sample(.2,0);g.sample(.5,100);expect(g.sample(.2,200).reward).toBe(true);g.sample(.5,300);expect(g.sample(.2,400).reward).toBe(false);
    g.sample(.2,4300);g.sample(.5,4400);expect(g.sample(.2,4500).reward).toBe(true);
  });
  it("does not issue an affectionate invitation from inside before the actual approach",()=>{
    const scene=input("affectionate");scene.world.pointer={x:420,y:600,stableMs:1200};scene.brain.activeMs=10000;
    const action=getLivingAction(scene.brain,scene.world,scene.preferences,10000,()=>0);
    expect(action?.living).toBe("social");expect(["walk","jump"]).toContain(action?.kind);expect(action?.play).toBeUndefined();
  });
  it("gives the explorer the most frequent outside cadence without changing rest thresholds",()=>{
    const curious=getCompanionBehaviorProfile({...DEFAULT_COMPANION_PREFERENCES,personality:"curious"});
    expect(curious.outsideStops).toBe(2);for(const p of COMPANION_PERSONALITIES.filter(p=>p!=="curious"))expect(curious.outsideCadenceMs).toBeLessThan(getCompanionBehaviorProfile({...DEFAULT_COMPANION_PREFERENCES,personality:p}).outsideCadenceMs);
    expect(curious.sleepEnergy).toBe(.32);expect(curious.restEnergy).toBe(.22);
  });
});

describe("143 legacy audience preserves its actual unfinished command",()=>{
  it("moves outside without completing the original cheer on its first travel step",()=>{
    const model=input("performer"),memory=newCompanionSceneMemory();memory.unfinished="performance";
    const controller=createCompanionScenes(memory),scene:CompanionSceneInput={world:model.world,brain:model.brain,preferences:model.preferences,now:0,knownFoods:[],owned:[],equipped:null};
    controller.event({kind:"encounter",wallTime:Date.parse("2026-10-20T12:00:00+09:00")},0,true);
    let moved=0,played=false;
    for(let n=0;n<20;n++){
      const offered=controller.next(scene);if(!offered)break;
      if(offered.play==="cheer-rehearsal"){expect(companionAudienceAtOutside(scene.world)).toBe(true);played=true;break;}
      const before=controller.current();scene.now+=offered.duration;
      if(["walk","jump"].includes(offered.kind)){scene.world={...scene.world,...offered.target};moved++;}
      controller.complete(offered);
      if(offered.scene.travel)expect(controller.current()).toEqual(before);
    }
    expect(moved).toBeGreaterThan(0);expect(played).toBe(true);
  });
  it("allows a genuinely reassured legacy pet response inside",()=>{
    const model=input("affectionate"),controller=createCompanionScenes(newCompanionSceneMemory()),scene:CompanionSceneInput={world:model.world,brain:model.brain,preferences:model.preferences,now:0,knownFoods:[],owned:[],equipped:null};
    controller.event({kind:"rough"},0,true);for(let i=0;i<3;i++)controller.event({kind:"petted",place:"home"},0,true);
    const response=controller.next(scene)!;expect(response.scene.id).toBe(8);
    // Its first go(pointer) may be satisfied by the same actual private spot.
    if(response.kind==="play"){expect(response.scene.travel).toBeUndefined();expect(response.play).toBe("ask-petting");}
    expect(scene.world.platformId).toBe(floor.id);
  });
});

//143 stage2 uses the real object model/planners. Only the unit host acknowledges
// checked model effects; no DOM, displayed playback or native completion claim.
describe("143 nine situational goals and fixed physical bindings",()=>{
  const freshIds=["D143-P","D143-C","D143-A","D143-S","D143-T","D143-M","D143-G","D143-H","D143-B"] as const;
  it("keeps the original144 IDs and adds exactly one executable goal per personality",()=>{
    const added=COMPANION_PERSONALITY_SCENES.filter(r=>r.id.startsWith("D143-"));
    expect(added.map(r=>r.id)).toEqual(freshIds);expect(new Set(added.map(r=>r.personality)).size).toBe(9);
    expect(new Set(COMPANION_PERSONALITY_SCENES.map(r=>r.id)).size).toBe(153);
    expect(COMPANION_PERSONALITY_SCENES.filter(r=>!r.id.startsWith("D143-")).length).toBe(144);
    for(const personality of COMPANION_PERSONALITIES){
      const group=COMPANION_PERSONALITY_SCENES.filter(r=>r.personality===personality);
      expect(group.filter(r=>r.major)).toHaveLength(5);expect(group.filter(r=>!r.major)).toHaveLength(12);
    }
  });
  it.each(["A12","B12","X-B-editor","X-P-editor","P10","P09"])("the explicit audience meaning of %s also applies to bow/celebrate",id=>{
    const recipe=COMPANION_PERSONALITY_SCENES.find(r=>r.id===id)!;
    expect(recipe.steps.some(s=>s.kind==="pose"&&s.audience)).toBe(true);
    const scene=input(recipe.personality);scene.preferences.petting=id!=="A12";const d=createCompanionPersonalityDirector([recipe]);entry(d,scene);
    for(const signal of recipe.triggers)if(signal!=="free")d.event(signal,scene.now);
    if(recipe.triggers.includes("outfit"))scene.equipped=true;
    const first=d.next(scene)!;expect(first).toBeDefined();
    if(first.meta.command.kind==="pose"&&first.meta.command.audience){expect(first.meta.travel).toBe(true);expect(["walk","jump"]).toContain(first.action?.kind);}
  });

  function host(id:typeof freshIds[number]){
    const recipe=COMPANION_PERSONALITY_SCENES.find(r=>r.id===id)!,scene=input(recipe.personality);
    const contact:Platform={...floor,id:"companion-home-floor-food"};
    const pad:Platform={id:"companion-home-floor-400",x:210,y:600,width:30,kind:"floor",manualOnly:true,bodyOnly:true};
    scene.world.platforms=[floor,sofa,outside,further,pad];
    scene.home={...scene.home,pad:{x:225,y:600,platformId:pad.id},window:{x:200,y:600,platformId:floor.id},curtain:{x:200,y:600,platformId:floor.id},tv:{x:160,y:600,platformId:floor.id},contacts:{curtain:{x:200,y:550},tv:{x:160,y:550}}};
    scene.canTv=scene.canCurtain=true;scene.curtainPhase="closed";scene.brain.hunger=id==="D143-G"?.5:.2;
    scene.world.pointer={x:400,y:600,stableMs:1500};
    const kind:CompanionToyKind|undefined=id==="D143-P"?"star-wand":id==="D143-A"?"duck":id==="D143-S"?"feather":id==="D143-M"?"toy-car":undefined;
    let roll=0;
    if(kind){const index=Array.from({length:1024},(_,i)=>i).find(i=>randomCompanionToy(undefined,()=>i/1024)===kind);expect(index).toBeDefined();roll=index!/1024;}
    const model=createCompanionToys(()=>roll),physical=[floor,sofa,outside,further];model.sync(physical,{width:800,height:700},0,[contact]);
    if(kind){const external=["D143-S","D143-M"].includes(id);expect(model.spawn({x:external?380:160,y:530,platformId:external?outside.id:contact.id},0)).toBeTruthy();}
    for(let t=0;t<=3000;t+=16)model.tick(t);
    const ids=model.ids();if(kind){expect(ids).toHaveLength(1);expect(model.items()[0].kind).toBe(kind);}
    if(id==="D143-G")scene.world.foods=[{id:"inside-nearer",kind:"apple",x:130,y:600,platformId:floor.id},{id:"outside-meal",kind:"apple",x:380,y:600,platformId:outside.id}];
    const d=createCompanionPersonalityDirector([recipe]),planner=createCompanionToyPlanner(),household=createCompanionHousehold(()=>0),jobs=createCompanionPersonalityJobs(d,household,planner),tv=createCompanionHomeTvStore(()=>scene.now);
    scene.now=3000;entry(d,scene);for(const signal of recipe.triggers)if(signal!=="free"&&signal!=="toy"&&signal!=="food")d.event(signal,scene.now);
    const refresh=()=>{scene.toys=accessibleCompanionToys(model.available(),scene.world.platforms);scene.carriedToyId=model.carried();scene.toyCount=model.count();scene.brain.activeMs=scene.now;scene.tv=tv.read();};refresh();
    const effects:{effect:string;id?:string;at:number;point:{x:number;y:number;platformId?:string}}[]=[],travel:{id?:string;carried?:string;point:{x:number;y:number;platformId?:string}}[]=[];
    const step=()=>{
      refresh();const proposal=d.next(scene);if(!proposal)return false;
      const action=jobs.next(proposal,{world:scene.world,brain:scene.brain,preferences:scene.preferences,now:scene.now,home:{pantry:scene.home.floor},box:scene.home.box,toys:scene.toys,toyIds:model.ids(),carriedToy:model.carried(),toyCount:model.count(),foodCount:scene.world.foods?.length??0,occupied:model.occupied()});
      if(!action){scene.now+=50;return true;}
      const meta=action.personalityScene;scene.now+=action.duration;
      if(action.kind==="walk"||action.kind==="jump"){
        const plane=scene.world.platforms.find(p=>p.id===action.target.platformId)!;expect(plane).toBeDefined();expect(action.target.y).toBe(plane.y);expect(action.target.x).toBeGreaterThanOrEqual(plane.x);expect(action.target.x).toBeLessThanOrEqual(plane.x+plane.width);
        scene.world={...scene.world,...action.target};scene.brain.visited=[...new Set([...scene.brain.visited,plane.id])];
        if(model.carried())expect(model.carry(model.carried()!,{x:scene.world.x,y:scene.world.y-30})).toBe(true);
        travel.push({id:meta.itemId,carried:model.carried(),point:{...action.target}});d.observeProgress({now:scene.now,active:true,point:action.target,carriedToyId:model.carried()});
      }
      const toy=action.toy;
      if(toy?.effect){
        let accepted=false;
        if(toy.effect==="pick"&&toy.toyId)accepted=model.pick(toy.toyId,scene.world);
        else if(toy.effect==="nudge"&&toy.toyId)accepted=model.nudge(toy.toyId,scene.world,scene.now-action.duration/2);
        else if((toy.effect==="put"||toy.effect==="toss")&&toy.toyId)accepted=model.put(toy.toyId,{...scene.world,y:scene.world.y-(toy.effect==="toss"?22:0)},scene.now-action.duration/2,toy.effect==="toss");
        else if(toy.effect==="stash"&&toy.toyId){
          const target=companionToyReturnTarget({left:70,top:525,width:60,height:25})!,current=model.items().find(t=>t.id===toy.toyId)!;
          expect(current.carried).toBe(true);expect(scene.world.platformId).toBe(floor.id);expect(Math.abs(scene.world.x-100)).toBeLessThan(55);
          expect(model.carry(toy.toyId,sampleCompanionToyReturn(current,target,1))).toBe(true);
          expect(companionToyReturnDelivered(model.items().find(t=>t.id===toy.toyId),target)).toBe(true);accepted=model.stash(toy.toyId);
        }
        expect(toy.effect).not.toBe("spawn");expect(accepted,`${id}:${toy.effect}:${toy.toyId}`).toBe(true);
        effects.push({effect:toy.effect,id:toy.toyId,at:scene.now,point:{x:scene.world.x,y:scene.world.y,platformId:scene.world.platformId}});planner.resolve(toy,accepted,scene.now);
        if(toy.effect!=="pick"&&toy.effect!=="decline"){d.resolve(meta,accepted,toy.toyId,scene.now);if(d.current()?.beat!==meta.beat)planner.cancel(scene.now);}
        if(["nudge","put","toss"].includes(toy.effect))for(let t=scene.now-action.duration/2+16;t<=scene.now;t+=16)model.tick(t);
      }
      if(action.kind==="eat"){
        const meal=scene.world.foods?.find(f=>f.id===action.foodId);expect(meal).toBeDefined();expect(meal!.id).toBe("outside-meal");expect(meal!.platformId).toBe(scene.world.platformId);expect(Math.hypot(meal!.x-scene.world.x,meal!.y-scene.world.y)).toBeLessThan(48);
        scene.world.foods=scene.world.foods!.filter(f=>f.id!==meal!.id);effects.push({effect:"eat",id:meal!.id,at:scene.now,point:{x:scene.world.x,y:scene.world.y,platformId:scene.world.platformId}});d.resolve(meta,true,meal!.id,scene.now);
      }else if(action.personalityJobEnd)d.resolve(meta,true,meta.itemId??model.carried(),scene.now);
      else if(meta.command.kind==="tv"&&!meta.travel){expect(meta.command.state).not.toBe("next");expect(tv.set(meta.command.state==="next"?"off":meta.command.state,{source:"companion"})).toBe(true);scene.tv=tv.read();d.resolve(meta,true,undefined,scene.now);}
      else if(meta.command.kind==="curtain"&&!meta.travel){scene.curtainPhase=meta.command.phase;d.resolve(meta,true,undefined,scene.now);}
      else if(meta.command.kind==="wash"&&!meta.travel){expect(scene.world.platformId).toBe(pad.id);expect(scene.world.x).toBe(225);d.resolve(meta,true,undefined,scene.now);}
      else d.complete(meta);
      model.tick(scene.now);return true;
    };
    return {scene,recipe,d,model,jobs,planner,household,ids,effects,travel,step,refresh};
  }
  it.each(freshIds)("%s finishes its model goal with required physical/route ACKs",id=>{
    const h=host(id);for(let n=0;n<100&&!h.d.completed().includes(id);n++){if(!h.step())h.scene.now+=50;}
    expect(h.d.completed(),JSON.stringify({id,current:h.d.current(),effects:h.effects,travel:h.travel})).toContain(id);
    if(h.ids.length){expect(h.model.ids()).toEqual([]);expect(h.effects.filter(e=>e.effect==="stash").map(e=>e.id)).toEqual(h.ids);expect(h.effects.filter(e=>e.id).every(e=>h.ids.includes(e.id!))).toBe(true);}
    if(id==="D143-P"||id==="D143-A"){
      const journeys=h.travel.filter(t=>t.carried===h.ids[0]);expect(journeys.length).toBeGreaterThan(0);expect(journeys.some(t=>!companionPrivateHomeSupport(t.point.platformId))).toBe(true);
      if(id==="D143-P")expect(new Set(journeys.filter(t=>!companionPrivateHomeSupport(t.point.platformId)).map(t=>t.point.platformId)).size).toBeGreaterThanOrEqual(2);
    }
    if(id==="D143-G"){expect(h.effects.filter(e=>e.effect==="eat").map(e=>e.id)).toEqual(["outside-meal"]);expect(h.scene.world.foods?.map(f=>f.id)).toEqual(["inside-nearer"]);}
    if(id==="D143-H"){expect(h.scene.tv).toBe("tori");expect(h.scene.curtainPhase).toBe("open");}
    if(id==="D143-C"||id==="D143-B")expect(new Set(h.travel.filter(t=>!companionPrivateHomeSupport(t.point.platformId)).map(t=>t.point.platformId)).size).toBeGreaterThanOrEqual(2);
  });
  it.each(["no-item","private-item","air-item","held-item"])("the outside meal cannot bind a different/private/invalid source: %s",mode=>{
    const h=host("D143-G");h.scene.world.foods=mode==="no-item"?[]:[{id:"only-meal",kind:"apple",x:mode==="private-item"?130:380,y:mode==="air-item"?500:600,platformId:mode==="air-item"?undefined:mode==="private-item"?floor.id:outside.id}];
    if(mode==="held-item")h.scene.carriedFoodId="only-meal";
    expect(h.d.next(h.scene)).toBeUndefined();expect(h.effects).toEqual([]);
  });
  it("does not offer the post-cleanup stroll while any actual original toy remains",()=>{
    const h=host("D143-T");h.scene.toyCount=4;expect(h.d.next(h.scene)).toBeUndefined();expect(h.effects).toEqual([]);
  });
  it.each(["food-owner","carried","urgent-hunger","exhausted","OFF"])("does not let a new leisure idea replace %s",kind=>{
    const h=host("D143-C");
    if(kind==="food-owner")h.scene.brain.foodGoal={foodId:"kept-food",remaining:3,retryAfter:0};if(kind==="carried")h.scene.carriedToyId="kept-toy";if(kind==="urgent-hunger")h.scene.brain.hunger=.8;if(kind==="exhausted")h.scene.brain.energy=.15;if(kind==="OFF")h.scene.preferences.roam=false;
    const before=JSON.stringify(h.scene);expect(h.d.next(h.scene)).toBeUndefined();expect(JSON.stringify(h.scene)).toBe(before);
  });
  it("never claims a prop performance if a manual action took the fixed original ID",()=>{
    const h=host("D143-P");for(let n=0;n<40&&!h.model.carried();n++)h.step();expect(h.model.carried()).toBe(h.ids[0]);
    const stolen=h.ids[0];expect(h.model.grab(stolen)).toBeTruthy();h.refresh();
    for(let n=0;n<12;n++){if(!h.step())h.scene.now+=250;}
    expect(h.d.completed()).not.toContain("D143-P");expect(h.model.ids()).toEqual([stolen]);expect(h.effects.some(e=>e.effect==="stash")).toBe(false);
  });
});

describe("143 autonomous TV choices are fixed per real contact beat",()=>{
  it("uses the shared weighted picker once while retaining the actual TV journey",()=>{
    let draws=0;const scene=input("curious");scene.home.tv={x:250,y:600,platformId:floor.id};scene.home.contacts={tv:{x:250,y:550}};scene.canTv=true;
    const recipe:PersonalitySceneRecipe={id:"contact-tv",label:"unit",personality:"curious",major:true,triggers:["free"],steps:[{kind:"tv",state:"next"},{kind:"watch",ms:900}]};
    const d=createCompanionPersonalityDirector([recipe],()=>{draws++;return .72;});entry(d,scene);
    let contact:PersonalitySceneProposal|undefined;
    for(let n=0;n<8;n++){const offered=d.next(scene)!;expect(offered.meta.command).toMatchObject({kind:"tv",state:"cooking"});if(!offered.meta.travel){contact=offered;break;}apply(d,scene,offered);}
    expect(contact?.meta.interactionContact).toEqual({x:250,y:550});expect(draws).toBe(1);
    expect(Math.hypot(scene.world.x-250,scene.world.y-600)).toBeLessThanOrEqual(24);
  });
  it("does not consume a free channel draw during a human priority lease",()=>{
    let draws=0;const scene=input("homebody");scene.home.tv={x:250,y:600,platformId:floor.id};scene.canTv=false;
    const recipe:PersonalitySceneRecipe={id:"leased-tv",label:"unit",personality:"homebody",major:true,triggers:["free"],steps:[{kind:"tv",state:"next"}]};
    const d=createCompanionPersonalityDirector([recipe],()=>{draws++;return 0;});entry(d,scene);expect(d.next(scene)).toBeUndefined();expect(draws).toBe(0);
  });
});

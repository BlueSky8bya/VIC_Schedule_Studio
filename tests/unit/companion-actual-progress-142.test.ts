import { describe, expect, it, vi } from "vitest";
import { commitAction, createBrain, findPlatformRoute, type CompanionAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { createCompanionRoutineArbiter } from "@/lib/ui/viewer-companion/routine-arbiter";
import { getCompanionBehaviorProfile } from "@/lib/ui/viewer-companion/behavior-profile";
import { boundCompanionStationaryProgress, createCompanionPersonalityActivity } from "@/lib/ui/viewer-companion/personality-activity";
import { createCompanionPersonalityJobs, getCompanionPersonalityMeal } from "@/lib/ui/viewer-companion/personality-jobs";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { accessibleCompanionToys, createCompanionToyPlanner, createCompanionToys } from "@/lib/ui/viewer-companion/toys";
import { companionToyReturnDelivered, companionToyReturnTarget, sampleCompanionToyReturn } from "@/lib/ui/viewer-companion/toy-return";

const floor:Platform={id:"companion-home-floor",x:0,y:600,width:1000,kind:"floor",manualOnly:true};
const source=(id:string)=>COMPANION_PERSONALITY_SCENES.find(recipe=>recipe.id===id)!;
function scene():PersonalitySceneInput {
  return { world:{x:100,y:600,platformId:floor.id,platforms:[floor],width:1100,height:720,animated:true,foods:[]},
    brain:{...createBrain(0,()=>.5),hunger:.1,energy:.9,activeMs:0}, preferences:{...DEFAULT_COMPANION_PREFERENCES,personality:"sleepy"},
    now:0, home:{sofa:{x:100,y:600,platformId:floor.id},box:{x:500,y:600,platformId:floor.id}},toys:[],tv:"off"};
}
const enter=(director:ReturnType<typeof createCompanionPersonalityDirector>,input:PersonalitySceneInput)=>{
  const proposal=director.next(input)!;expect(proposal.meta.id).toBe("entry-sleepy");
  input.now+=proposal.action!.duration;director.complete(proposal.meta);
};
const playAndFinish=(director:ReturnType<typeof createCompanionPersonalityDirector>,input:PersonalitySceneInput)=>{
  const proposal=director.next(input)!;expect(proposal.action).toBeTruthy();
  input.now+=proposal.action!.duration;director.complete(proposal.meta);return proposal;
};
const realToy={id:"same-real-toy",kind:"ball" as const,x:180,y:600,platformId:floor.id,angle:0,held:false,carried:false};

describe("142 real progress, finite rest and mandatory meal admission",()=>{
  it("does not turn high-energy S01 into doze/cozy/stretch masquerading as sleep",()=>{
    const input=scene(),director=createCompanionPersonalityDirector([source("S01")]);enter(director,input);
    expect(director.next(input)).toBeUndefined();expect(director.completed()).toEqual([]);
  });
  it("uses exactly the handler energy threshold on either side, with explicit sleep OFF",()=>{
    const at=scene();at.brain.energy=getCompanionBehaviorProfile(at.preferences).sleepEnergy;
    const yes=createCompanionPersonalityDirector([source("S01")]);enter(yes,at);expect(yes.next(at)?.action?.play).toBe("doze-curl");
    const above=scene();above.brain.energy=getCompanionBehaviorProfile(above.preferences).sleepEnergy+.001;
    const no=createCompanionPersonalityDirector([source("S01")]);enter(no,above);expect(no.next(above)).toBeUndefined();
    const off=scene();off.brain.energy=.05;off.preferences.sleep=false;
    const disabled=createCompanionPersonalityDirector([source("S01")]);enter(disabled,off);expect(disabled.next(off)).toBeUndefined();
  });
  it("keeps high-energy S03 same-ID return and skips only its unnecessary rest tail after actual ACK",()=>{
    const input=scene();input.toys=[realToy];const director=createCompanionPersonalityDirector([source("S03")]);enter(director,input);
    const actual=director.next(input)!;expect(actual.meta.itemId).toBe(realToy.id);expect(actual.delegate).toMatchObject({kind:"toy",mode:"return"});
    input.toys=[];director.resolve(actual.meta,true,realToy.id);input.now+=600;
    expect(director.next(input)).toBeUndefined();expect(director.completed()).not.toContain("S03");
    expect(input.world.x).toBe(100);expect(input.world.platformId).toBe(floor.id);
  });
  it("never counts missing/failed same-ID return as completed S03",()=>{
    const input=scene();input.toys=[realToy];const director=createCompanionPersonalityDirector([source("S03")]);enter(director,input);
    const actual=director.next(input)!;director.resolve(actual.meta,false,realToy.id);
    expect(director.completed()).toEqual([]);expect(director.current()).toBeUndefined();
  });
  it("preserves S03 real return then actual needed finite sleep, without fake stretch",()=>{
    const input=scene();input.brain.energy=.1;input.toys=[realToy];const director=createCompanionPersonalityDirector([source("S03")]);enter(director,input);
    const actual=director.next(input)!;input.toys=[];director.resolve(actual.meta,true,realToy.id);input.now+=600;
    expect(playAndFinish(director,input).action?.play).toBe("cozy-nest");
    expect(director.next(input)?.action).toMatchObject({kind:"sleep",duration:5500});
  });
  it("does not refresh actual progress with pose/watch/beat completion, and includes upcoming duration",()=>{
    const input=scene(),recipe:PersonalitySceneRecipe={id:"test-stationary",label:"finite decorations",personality:"sleepy",major:false,triggers:["free"],
      steps:[{kind:"watch",ms:3500},{kind:"watch",ms:3500},{kind:"pose",pose:"cozy-nest"}]};
    const director=createCompanionPersonalityDirector([recipe]);enter(director,input);
    input.world.x+=24; // Actual modeled preparation displacement, not a pose reward.
    playAndFinish(director,input);playAndFinish(director,input);
    // Only7s elapsed after real movement; the upcoming3.2s pose must not start.
    expect(director.next(input)).toBeUndefined();expect(director.current()).toBeUndefined();expect(director.completed()).toEqual([]);
  });
  it("does not reset an exhausted window just by switching scene IDs",()=>{
    const input=scene(),recipes:PersonalitySceneRecipe[]=["one","two"].map(id=>({id,label:id,personality:"sleepy",major:false,triggers:["free"],steps:[{kind:"watch",ms:3500},{kind:"watch",ms:3500}]}));
    const director=createCompanionPersonalityDirector(recipes);enter(director,input);
    input.world.x+=24; // Isolate the shared8s budget from the initial10s cap.
    playAndFinish(director,input);playAndFinish(director,input);
    expect(director.completed()).toContain("one");expect(director.next(input)).toBeUndefined();
    expect(director.completed()).not.toContain("two");
  });
  it("shares completed cozy/doze repetition memory without giving a pose physical-progress credit",()=>{
    const input=scene(),recipes:PersonalitySceneRecipe[]=["cozy-nest","doze-curl"].map((pose,index)=>({id:`rest-${index}`,label:pose,personality:"sleepy",major:false,triggers:["free"],steps:[{kind:"pose",pose:pose as "cozy-nest"|"doze-curl"}]}));
    const director=createCompanionPersonalityDirector(recipes);enter(director,input);playAndFinish(director,input);
    expect(director.next(input)).toBeUndefined();input.world.x+=120;
    expect(director.next(input)?.meta.id).toBe("rest-1");
  });
  it.each([false,true])("required eat respects feeding=%s and exact hunger boundary; inspection-only stays available",feeding=>{
    const input=scene();input.preferences.feeding=feeding;input.world.foods=[{id:"food",kind:"carrot",x:150,y:600,platformId:floor.id}];
    const recipe:PersonalitySceneRecipe={id:"test-eat",label:"actual meal",personality:"sleepy",major:true,triggers:["food"],steps:[{kind:"food",mode:"eat"}]};
    const director=createCompanionPersonalityDirector([recipe]);enter(director,input);expect(director.next(input)).toBeUndefined();
    input.brain.hunger=.35;expect(Boolean(director.next(input)?.delegate)).toBe(feeding);
  });

  it("bounds initial preparation plus stationary decorations within10s",()=>{
    const input=scene(),recipe:PersonalitySceneRecipe={id:"initial",label:"stationary",personality:"sleepy",major:false,triggers:["free"],steps:[{kind:"watch",ms:3500},{kind:"watch",ms:3500}]};
    const director=createCompanionPersonalityDirector([recipe]);enter(director,input);
    const first=playAndFinish(director,input);expect(first.action?.duration).toBe(3500);
    expect(input.now).toBeLessThan(10000);expect(director.next(input)).toBeUndefined();
    expect(director.completed()).toEqual([]);
  });

  it("does not let a future required destination exempt an over-budget decorative chain",()=>{
    const input=scene();input.home.floor={x:450,y:600,platformId:floor.id};
    const recipe:PersonalitySceneRecipe={id:"future-route",label:"same real destination",personality:"sleepy",major:true,triggers:["free"],
      steps:[{kind:"watch",ms:3500},{kind:"watch",ms:3500},{kind:"pose",pose:"cozy-nest"},{kind:"go",target:"floor"}]};
    const director=createCompanionPersonalityDirector([recipe]);enter(director,input);input.world.x+=24;
    playAndFinish(director,input);playAndFinish(director,input);input.now+=800;
    const travel=director.next(input)!;expect(travel.action?.kind).toBe("walk");expect(travel.meta.beat).toBe(3);
    expect(travel.action?.target.x).toBe(450);input.world={...input.world,...travel.action!.target};input.now+=travel.action!.duration;
    director.next(input);expect(director.current()).toBeUndefined();expect(director.completed()).not.toContain(recipe.id);
  });

  it.each([false,true])("requires an observed room-state change rather than a successful no-op ACK: changed=%s",changed=>{
    const input=scene();input.home.tv={x:124,y:600,platformId:floor.id};input.home.contacts={tv:{x:124,y:550}};
    const recipe:PersonalitySceneRecipe={id:"state-proof",label:"actual TV",personality:"sleepy",major:true,triggers:["free"],
      steps:[{kind:"watch",ms:3500},{kind:"watch",ms:3500},{kind:"pose",pose:"cozy-nest"},{kind:"tv",state:"nature"},{kind:"pose",pose:"bow"}]};
    const director=createCompanionPersonalityDirector([recipe]);enter(director,input);input.world.x+=24;
    playAndFinish(director,input);playAndFinish(director,input);
    const control=director.next(input)!;expect(control.meta.command.kind).toBe("tv");expect(control.meta.beat).toBe(3);
    director.resolve(control.meta,true);input.now+=control.action!.duration;if(changed)input.tv="nature";
    const next=director.next(input);expect(next?.action?.play).toBe(changed?"bow":undefined);
    if(!changed)expect(director.current()).toBeUndefined();
    expect(director.completed()).toEqual([]); // Omitted cozy is never a full original scene.
  });

  it("does not grant physical-progress credit for an elapsed sleep, but keeps one finite wake stretch",()=>{
    const input=scene();input.brain.energy=.4;
    const recipe:PersonalitySceneRecipe={id:"sleep-wake",label:"needed sleep",personality:"sleepy",major:true,triggers:["free"],
      steps:[{kind:"watch",ms:2000},{kind:"sleep",ms:7000},{kind:"pose",pose:"stretch"},{kind:"pose",pose:"cozy-nest"}]};
    const director=createCompanionPersonalityDirector([recipe]);enter(director,input);input.world.x+=24;
    playAndFinish(director,input);const sleep=playAndFinish(director,input);expect(sleep.action?.kind).toBe("sleep");
    expect(playAndFinish(director,input).action?.kind).toBe("stretch");
    expect(director.next(input)).toBeUndefined();expect(director.completed()).toEqual([]);
  });

  it("does not count inspection completion as physical progress",()=>{
    const input=scene();input.toys=[realToy];
    const recipe:PersonalitySceneRecipe={id:"inspection",label:"finite observation",personality:"sleepy",major:true,triggers:["toy"],
      steps:[{kind:"watch",ms:3500},{kind:"watch",ms:3500},{kind:"toy",mode:"inspect"},{kind:"pose",pose:"cozy-nest"}]};
    const director=createCompanionPersonalityDirector([recipe]);enter(director,input);input.world.x+=24;
    playAndFinish(director,input);playAndFinish(director,input);const inspect=director.next(input)!;
    expect(inspect.delegate?.mode).toBe("inspect");director.resolve(inspect.meta,true,realToy.id);input.now+=900;
    expect(director.next(input)).toBeUndefined();expect(director.completed()).toEqual([]);
  });

  it("keeps a real carried owner's finite beat instead of replacing it with ordinary wandering",()=>{
    const input=scene(),recipe:PersonalitySceneRecipe={id:"owned",label:"carried prop",personality:"sleepy",major:true,triggers:["free"],steps:[{kind:"watch",ms:3500},{kind:"watch",ms:3500},{kind:"pose",pose:"cozy-nest"}]};
    input.carriedToyId=realToy.id;const director=createCompanionPersonalityDirector([recipe]);enter(director,input);
    playAndFinish(director,input);playAndFinish(director,input);expect(director.next(input)?.action?.play).toBe("cozy-nest");
  });

  it.each([.9,.4])("keeps actual same-ID S03 pick/carry/box-contact/stash, with needed rest only at energy%s",energy=>{
    const input=scene();input.brain.energy=energy;input.home.sofa={x:100,y:600,platformId:floor.id};
    const contact={...floor,id:"companion-home-floor-food"},model=createCompanionToys(()=>0),planner=createCompanionToyPlanner();
    model.sync([floor],{width:1100,height:720},0,[contact]);expect(model.spawn({x:250,y:530,platformId:contact.id},0)).toBeTruthy();
    for(let at=0;at<=3000;at+=16)model.tick(at);const id=model.ids()[0];input.now=3000;
    const director=createCompanionPersonalityDirector([source("S03")]),jobs=createCompanionPersonalityJobs(director,createCompanionHousehold(()=>0),planner);enter(director,input);
    const effects:string[]=[];
    for(let decision=0;decision<60&&model.count();decision++) {
      input.toys=accessibleCompanionToys(model.available(),input.world.platforms);input.toyCount=model.count();input.carriedToyId=model.carried();
      const proposal=director.next(input)!;expect(proposal.meta.id).toBe("S03");
      const action=jobs.next(proposal,{world:input.world,brain:input.brain,preferences:input.preferences,now:input.now,home:{},box:input.home.box,toys:input.toys,toyIds:model.ids(),carriedToy:model.carried(),toyCount:model.count(),foodCount:0})!;
      expect(action).toBeTruthy();
      if(action.kind==="walk"||action.kind==="jump") {input.world={...input.world,...action.target};if(model.carried())expect(model.carry(id,{x:input.world.x,y:input.world.y-30})).toBe(true);}
      input.now+=action.duration;
      if(action.toy?.effect) {
        const beat=action.toy;expect(beat.toyId).toBe(id);let success=false;
        if(beat.effect==="pick") {success=model.pick(id,input.world);effects.push("pick");}
        if(beat.effect==="stash") {
          const target=companionToyReturnTarget({left:470,top:525,width:60,height:25})!,toy=model.items().find(toy=>toy.id===id)!;
          expect(toy.carried).toBe(true);expect(Math.abs(input.world.x-input.home.box!.x)).toBeLessThan(55);
          expect(model.carry(id,sampleCompanionToyReturn(toy,target,1))).toBe(true);
          expect(companionToyReturnDelivered(model.items().find(toy=>toy.id===id),target)).toBe(true);
          effects.push("contact");success=model.stash(id);effects.push("stash");
        }
        expect(success).toBe(true);planner.resolve(beat,success,input.now);
        if(beat.effect!=="pick")director.resolve(action.personalityScene,success,id);
      }
      director.complete(action.personalityScene);input.now+=220;model.tick(input.now);
    }
    expect(model.count()).toBe(0);expect(effects).toEqual(["pick","contact","stash"]);input.toys=[];input.carriedToyId=undefined;input.toyCount=0;
    if(energy>.55) {expect(director.next(input)).toBeUndefined();expect(director.completed()).not.toContain("S03");}
    else {
      for(let step=0;step<12&&!director.completed().includes("S03");step++) {
        const proposal=director.next(input)!;expect(proposal.action).toBeTruthy();
        if(proposal.meta.travel)input.world={...input.world,...proposal.action!.target};
        input.now+=proposal.action!.duration;director.complete(proposal.meta);effects.push(proposal.action!.kind);
      }
      expect(effects).toContain("sleep");expect(director.completed()).toContain("S03");
    }
  });

  it.each([false,true])("prefers a complete currently executable alternative to an unneeded rest tail, sleep=%s",sleep=>{
    const input=scene();input.preferences.sleep=sleep;input.toys=[{...realToy,kind:"feather"}];
    const director=createCompanionPersonalityDirector([source("S03"),source("S05")]);enter(director,input);
    expect(director.next(input)?.meta.id).toBe("S05");
  });

  it("keeps the original priority when rest is needed, and actual chore fallback when it is the sole option",()=>{
    const low=scene();low.brain.energy=.4;low.toys=[{...realToy,kind:"feather"}];
    const needed=createCompanionPersonalityDirector([source("S03"),source("S05")]);enter(needed,low);expect(needed.next(low)?.meta.id).toBe("S03");
    const high=scene();high.toys=[realToy];const sole=createCompanionPersonalityDirector([source("S03"),source("S05")]);enter(sole,high);expect(sole.next(high)?.meta.id).toBe("S03");
  });
});


const main:Platform={id:"companion-home-floor",x:20,y:600,width:420,kind:"floor",manualOnly:true};
function fixture() {
  const input:PersonalitySceneInput={world:{x:160,y:600,platformId:main.id,platforms:[main],width:900,height:720,animated:true,foods:[]},
    brain:{...createBrain(0,()=>.5),hunger:.05,energy:.9,activeMs:0},preferences:{...DEFAULT_COMPANION_PREFERENCES,personality:"performer"},
    now:0,home:{},toys:[],tv:"off",lightLit:true,curtainPhase:"open",radioPlaying:false};
  const director=createCompanionPersonalityDirector([]),entry=director.next(input)!;
  input.now=entry.action!.duration;director.complete(entry.meta);
  const observe=(at:number,x=input.world.x,active=true)=>director.observeProgress({now:at,active,point:{x,y:600,platformId:main.id},carriedToyId:input.carriedToyId,carriedFoodId:input.carriedFoodId});
  observe(input.now);
  return {input,director,observe};
}
const look=(input:PersonalitySceneInput,duration=4750):CompanionAction=>({kind:"look",target:{x:input.world.x,y:input.world.y,platformId:input.world.platformId},duration});

describe("142 shared measured progress across authored and ordinary owners",()=>{
  it.each([15000,NaN,Infinity])("does not promote late/invalid same-beat physical ACK time%s to a newer observation",at=>{
    const input=scene();input.toys=[realToy];input.brain.energy=.9;
    const director=createCompanionPersonalityDirector([source("S03")]);enter(director,input);
    const actual=director.next(input)!;
    director.observeProgress({now:10000,active:true,point:{x:124,y:600,platformId:floor.id}});
    director.observeProgress({now:20000,active:true,point:{x:124,y:600,platformId:floor.id}});
    expect(director.progressDeadline()).toBe(18000);
    director.resolve(actual.meta,true,realToy.id,at);
    expect(director.progressDeadline()).toBe(18000);
  });
  it("does not restamp a legacy movement at the later director decision",()=>{
    const {input,director,observe}=fixture();observe(22000,184);input.world.x=184;
    expect(director.progressDeadline()).toBe(30000);input.now=24900;director.next(input);
    expect(director.progressDeadline()).toBe(30000);
    input.now=31100;director.next(input);expect(director.progressDeadline()).toBe(30000);
  });
  it("accumulates actual subframe displacement until8px, without counting pose or inactive/manual motion",()=>{
    const {director,observe}=fixture();observe(10000,184);expect(director.progressDeadline()).toBe(18000);
    observe(11000,188);expect(director.progressDeadline()).toBe(18000);
    observe(12000,192);expect(director.progressDeadline()).toBe(20000);
    observe(15000,300,false);observe(16000,300,true);expect(director.progressDeadline()).toBe(20000);
  });
  it("stamps real carried-food and control changes at their observation, with no delayed replay or no-op credit",()=>{
    const {input,director,observe}=fixture();observe(10000,184);input.world.x=184;
    director.observeProgress({now:12000,active:true,carriedFoodId:"same-real-food"});expect(director.progressDeadline()).toBe(20000);
    director.observeProgress({now:13000,active:true,controls:{tv:"nature"}});expect(director.progressDeadline()).toBe(21000);
    // Partial controls do not pretend that the real carried food was released.
    director.observeProgress({now:14000,active:true,controls:{tv:"nature"}});expect(director.progressDeadline()).toBe(21000);
    input.now=15000;input.carriedFoodId="same-real-food";input.tv="nature";director.next(input);expect(director.progressDeadline()).toBe(21000);
  });
  it("supports a real model nudge followed by the finite P11 performance without launching a long look",()=>{
    const {input,director,observe}=fixture(),contact={...main,id:"companion-home-floor-food"},model=createCompanionToys(()=>0);
    model.sync([main],{width:900,height:720},0,[contact]);expect(model.spawn({x:180,y:530,platformId:contact.id},0)).toBeTruthy();
    for(let at=0;at<=3000;at+=16)model.tick(at);const id=model.ids()[0];
    expect(model.pick(id,model.items()[0])).toBe(true);expect(model.put(id,{x:180,y:600,platformId:contact.id},4000)).toBe(true);
    const before=model.items()[0].x;
    observe(22000,136);observe(22600,160);expect(model.nudge(id,input.world,23300)).toBe(true);
    for(let at=23316;at<=24500;at+=16)model.tick(at);
    expect(model.ids()).toEqual([id]);expect(model.items()[0].x).not.toBe(before);
    director.observeEffect("toy",23300);expect(director.progressDeadline()).toBe(31300);
    // P11's completed poses are intentionally not physical observations.
    observe(25400,160);observe(29300,160);observe(31000,160);
    const activity=createCompanionPersonalityActivity(()=>0);
    activity.record({kind:"look",target:look(input).target,duration:1000,attention:{kind:"social",point:look(input).target}},input.world,30000,"performer");
    const action=boundCompanionStationaryProgress(look(input),input.brain,input.world,input.preferences,31100,director.progressDeadline(),
      boundary=>activity.choose(input.brain,input.world,input.preferences,31100,boundary));
    expect(action.kind).toBe("walk");expect(Math.abs(action.target.x-input.world.x)).toBeGreaterThanOrEqual(48);
    expect(action.target.platformId).toBe(main.id);expect(director.progressDeadline()).toBe(31300); // No launch reward.
  });
  it("retains a look that fits; replaces only a next ordinary idle/look that would cross the shared deadline",()=>{
    const {input}=fixture(),activity=createCompanionPersonalityActivity(()=>0),choose=vi.fn((boundary:{deadline:number;nextDuration:number})=>activity.choose(input.brain,input.world,input.preferences,12000,boundary));
    const fits=look(input,500);expect(boundCompanionStationaryProgress(fits,input.brain,input.world,input.preferences,12000,13000,choose)).toBe(fits);expect(choose).not.toHaveBeenCalled();
    const long=look(input,4750),next=boundCompanionStationaryProgress(long,input.brain,input.world,input.preferences,12000,13000,choose);
    expect(next.kind).toBe("walk");expect(choose).toHaveBeenCalledWith({deadline:13000,nextDuration:4750});
  });
  it("uses the measured main floor to leave a narrow sofa, while jump OFF cannot fabricate that transfer",()=>{
    const {input}=fixture(),sofa:Platform={id:"companion-home",x:30,y:560,width:112,kind:"date"};
    input.world={...input.world,x:86,y:560,platformId:sofa.id,platforms:[sofa,main]};
    const activity=createCompanionPersonalityActivity(()=>0),boundary={deadline:10000,nextDuration:4750};
    const kinds:string[]=[];
    for(let step=0;step<5&&input.world.platformId!==main.id;step++) {
      const next=activity.choose(input.brain,input.world,input.preferences,12000+step*1000,boundary)!;
      expect(next).toBeTruthy();expect([sofa.id,main.id]).toContain(next.target.platformId);kinds.push(next.kind);
      input.world={...input.world,...next.target};
    }
    expect(kinds).toContain("jump");expect(input.world.platformId).toBe(main.id);
    input.world={...input.world,x:86,y:560,platformId:sofa.id};input.preferences.jump=false;
    const off=activity.choose(input.brain,input.world,input.preferences,20000,boundary);
    expect(off?.kind).not.toBe("jump");if(off)expect(off.target.platformId).toBe(sofa.id);
  });
  it.each(["companion-home-floor-400","companion-home-floor-200","arbitrary-manual-furniture"])("does not turn%s into a fallback walking span",id=>{
    const {input}=fixture();input.world={...input.world,platformId:id,platforms:[{...main,id,bodyOnly:id.endsWith("400")},main]};
    expect(createCompanionPersonalityActivity(()=>0).choose(input.brain,input.world,input.preferences,12000,{deadline:10000,nextDuration:4750})).toBeUndefined();
  });
  it("never invents movement on an invalid/small span when its finite look must be shortened",()=>{
    const {input}=fixture();input.world={...input.world,x:30,platforms:[{...main,x:20,width:20}]};const original=look(input);
    const next=boundCompanionStationaryProgress(original,input.brain,input.world,input.preferences,12000,12500,()=>undefined);
    expect(next.kind).toBe("look");expect(next.duration).toBe(500);expect(next.target).toEqual(original.target);
  });
  it.each(["owned","food","episode","roam","enabled","paused","animated"])("preserves%s instead of forcing a fallback walk",kind=>{
    const {input}=fixture(),original=look(input),choose=vi.fn(()=>undefined);
    if(kind==="food")input.brain.foodGoal={foodId:"actual-food",remaining:4,retryAfter:0};
    if(kind==="episode")input.brain.episode={kind:"wake",phase:"notice",variant:"careful",remaining:1,mishapUsed:false,legs:0};
    if(kind==="roam")input.preferences.roam=false;if(kind==="enabled")input.preferences.enabled=false;
    if(kind==="paused")input.world.paused=true;if(kind==="animated")input.world.animated=false;
    expect(boundCompanionStationaryProgress(original,input.brain,input.world,input.preferences,12000,12500,choose,kind==="owned")).toBe(original);
    expect(choose).not.toHaveBeenCalled();
  });
  it("does not exempt an unowned generic look solely because energy is low",()=>{
    const {input}=fixture();input.brain.energy=.15;input.preferences.sleep=true;
    const activity=createCompanionPersonalityActivity(()=>0);
    const next=boundCompanionStationaryProgress(look(input),input.brain,input.world,input.preferences,12000,12500,
      boundary=>activity.choose(input.brain,input.world,input.preferences,12000,boundary));
    expect(next.kind).toBe("walk");expect(Math.abs(next.target.x-input.world.x)).toBeGreaterThanOrEqual(48);
  });
  it.each(["eat","sleep","walk","jump","play","sniff","stretch","shake"] as const)("does not replace a next actual/finite%s action",kind=>{
    const {input}=fixture(),original:CompanionAction={...look(input),kind},choose=vi.fn(()=>undefined);
    expect(boundCompanionStationaryProgress(original,input.brain,input.world,input.preferences,12000,12500,choose)).toBe(original);expect(choose).not.toHaveBeenCalled();
  });
});


describe("142 actual post-wash exit before the next personality performance",()=>{
  it.each(COMPANION_PERSONALITIES)("%s leaves the exact body-only pad through a proved route after real wash ACK",personality=>{
    const input=scene();input.preferences.personality=personality;input.brain.energy=.9;input.brain.hunger=.05;
    const mat:Platform={id:"companion-home-floor-400",x:450,y:530,width:2,kind:"floor",manualOnly:true,bodyOnly:true};
    input.world.platforms=[floor,mat];input.home.pad={x:451,y:530,platformId:mat.id};input.home.floor={x:220,y:600,platformId:floor.id};
    const director=createCompanionPersonalityDirector([]),entry=director.next(input)!;
    input.now+=entry.action!.duration;director.complete(entry.meta);
    const arbiter=createCompanionRoutineArbiter();arbiter.observe("ate",input.now-1);
    const request=arbiter.next({...input,active:true,entryReady:true})!;
    expect(request.kind).toBe("wash");expect(director.startRoutine(request.recipe,input.now)).toBe(true);
    const next=()=>director.next(input);
    const travel=(target:string)=>{
      for(let leg=0;leg<12;leg++){
        const proposal=next()!;expect(proposal).toBeTruthy();
        if(!proposal.meta.travel)return proposal;
        expect(["walk","jump"]).toContain(proposal.action!.kind);
        // A travel metadata ACK cannot skip physical movement or the owner.
        director.complete(proposal.meta);expect(director.active()).toBe(true);
        input.world={...input.world,...proposal.action!.target};input.now+=proposal.action!.duration;
        director.observeProgress({now:input.now,active:true,point:input.world});
      }
      throw new Error(`finite measured route never reached ${target}`);
    };
    const washing=travel(mat.id);expect(washing.meta.command.kind).toBe("wash");
    expect(input.world.platformId).toBe(mat.id);expect(input.world.y).toBe(mat.y);
    input.now+=washing.action!.duration;director.resolve(washing.meta,true,undefined,input.now);arbiter.observe("washed",input.now);
    const exiting=next()!;expect(exiting.meta.command).toEqual({kind:"go",target:"floor"});expect(exiting.meta.travel).toBe(true);
    expect(["walk","jump"]).toContain(exiting.action!.kind);expect(director.completed()).not.toContain("routine-wash");
    director.complete(exiting.meta);expect(input.world.platformId).toBe(mat.id); // No elapsed-travel success.
    input.world={...input.world,...exiting.action!.target};input.now+=exiting.action!.duration;
    director.observeProgress({now:input.now,active:true,point:input.world});
    const finishing=travel(floor.id);expect(finishing.meta.command.kind).toBe("pose");
    expect(input.world.platformId).toBe(floor.id);expect(input.world.y).toBe(floor.y);
    expect(input.world.platforms.find(plane=>plane.id===input.world.platformId)?.bodyOnly).not.toBe(true);
    input.now+=finishing.action!.duration;director.complete(finishing.meta);expect(director.completed()).toContain("routine-wash");
  });
  it.each(["missing-point","removed-support","body-only-replacement","wrong-height"])("does not substitute the washing pad when the actual exit floor is%s",state=>{
    const input=scene();input.brain.energy=.9;
    const mat:Platform={id:"companion-home-floor-400",x:450,y:530,width:2,kind:"floor",manualOnly:true,bodyOnly:true};
    input.world={...input.world,x:451,y:530,platformId:mat.id,platforms:[floor,mat]};
    input.home.floor={x:220,y:600,platformId:floor.id};input.home.pad={x:451,y:530,platformId:mat.id};
    const director=createCompanionPersonalityDirector([]);enter(director,input);
    expect(director.startRoutine({id:"routine-wash",label:"real wash then exit",personality:"sleepy",major:true,triggers:["free"],
      steps:[{kind:"wash",ms:2400},{kind:"go",target:"floor"},{kind:"pose",pose:"bow"}]},input.now)).toBe(true);
    const washing=director.next(input)!;expect(washing.meta.command.kind).toBe("wash");
    input.now+=washing.action!.duration;director.resolve(washing.meta,true,undefined,input.now);
    if(state==="missing-point")delete input.home.floor;
    if(state==="removed-support")input.world.platforms=[mat];
    if(state==="body-only-replacement")input.home.floor={...input.home.pad!};
    if(state==="wrong-height")input.home.floor!.y-=20;
    expect(director.next(input)).toBeUndefined();expect(director.active()).toBe(false);
    expect(director.completed()).not.toContain("routine-wash");
    expect(input.world.platformId).toBe(mat.id);expect(input.world.y).toBe(mat.y); // Never a fake teleport.
  });
});


describe("142 fallback routes consume actual renderer rejection memory",()=>{
  it("does not repeat the same sofa jump after the real rejected-route outcome",()=>{
    const {input}=fixture(),sofa:Platform={id:"companion-home",x:30,y:560,width:112,kind:"date"};
    input.world.platforms=[main,sofa];input.brain.activeMs=12000;
    const activity=createCompanionPersonalityActivity(()=>0);
    const first=activity.choose(input.brain,input.world,input.preferences,12000)!;
    expect(first.kind).toBe("jump");expect(first.target.platformId).toBe(sofa.id);
    // The existing runtime's actual sofa-flight guard retains neither the
    // attempted jump nor a physical progress credit. It records this result.
    input.brain=commitAction(input.brain,{kind:"look",duration:480,target:look(input).target,
      attention:{kind:"reconsider",point:first.target},outcomes:[{targetId:sofa.id,result:"blocked"}]},12000);
    expect(input.brain.places).toContainEqual({id:sofa.id,visits:0,failures:1,retryAfter:20000});
    const next=activity.choose(input.brain,input.world,input.preferences,12481,{deadline:11000,nextDuration:480})!;
    expect(next.kind).toBe("walk");expect(next.target.platformId).toBe(main.id);
    expect(Math.abs(next.target.x-input.world.x)).toBeGreaterThanOrEqual(48);
    expect(input.brain.intention).toBeUndefined(); // No unrelated goal is erased by the chooser.
    const retry=activity.choose(input.brain,input.world,input.preferences,20001)!;
    expect(retry.target.platformId).toBe(sofa.id); // Existing finite retry TTL, never a permanent ban.
  });
  it("does not blacklist a target from unrelated, expired or successful outcomes",()=>{
    const {input}=fixture(),sofa:Platform={id:"companion-home",x:30,y:560,width:112,kind:"date"};
    input.world.platforms=[main,sofa];
    for(const place of [{id:"unrelated",visits:0,failures:1,retryAfter:20000},{id:sofa.id,visits:0,failures:1,retryAfter:12000},{id:sofa.id,visits:1,failures:0,retryAfter:20000}]){
      input.brain.places=[place];
      expect(createCompanionPersonalityActivity(()=>0).choose(input.brain,input.world,input.preferences,12000)?.target.platformId).toBe(sofa.id);
    }
  });
  it("does not enter the same rejected sofa as another destination's first hop",()=>{
    const {input}=fixture(),sofa:Platform={id:"companion-home",x:30,y:500,width:112,kind:"date"},upper:Platform={id:"actual-upper-date",x:30,y:400,width:112,kind:"date"};
    input.world={...input.world,x:86,platforms:[main,sofa,upper]};input.brain.activeMs=12000;
    const nominal=findPlatformRoute(input.world,{x:86,y:upper.y,platformId:upper.id},input.world.platforms,true);
    expect(nominal?.[0].target.platformId).toBe(sofa.id); // This route really uses the rejected rim first.
    input.brain.places=[{id:sofa.id,visits:0,failures:1,retryAfter:20000}];
    const before=JSON.stringify(input.brain),activity=createCompanionPersonalityActivity(()=>0);
    const next=activity.choose(input.brain,input.world,input.preferences,12000)!;
    expect(next.kind).toBe("walk");expect(next.target.platformId).toBe(main.id);
    expect(Math.abs(next.target.x-input.world.x)).toBeGreaterThanOrEqual(48);expect(JSON.stringify(input.brain)).toBe(before);
    const ownedLook=look(input),choose=vi.fn(()=>next);
    expect(boundCompanionStationaryProgress(ownedLook,input.brain,input.world,input.preferences,12000,11000,choose,true)).toBe(ownedLook);
    expect(choose).not.toHaveBeenCalled();expect(JSON.stringify(input.brain)).toBe(before);
  });
});

describe("142 routine checkpoints retain real authored work and bounded closure",()=>{
  it("credits the actual short S10 movement at its observed time instead of losing its terminal bow",()=>{
    const input=scene();input.world.x=212.165;input.toys=[{...realToy,x:199.828}];
    const director=createCompanionPersonalityDirector([source("S10")]);enter(director,input);
    director.observeProgress({now:29730,active:true,point:input.world});director.observeEffect("toy",29730);
    director.event("toy-settled",29730);input.now=35180;
    const stretch=director.next(input)!;expect(stretch.meta.id).toBe("S10");expect(stretch.action?.kind).toBe("stretch");
    input.now=36130;director.complete(stretch.meta);input.now=36380;
    const inspected=director.next(input)!;expect(inspected.delegate).toMatchObject({kind:"toy",mode:"inspect"});
    input.world.x=205.22;director.observeProgress({now:36480,active:true,point:input.world});
    input.world.x=199.828;director.observeProgress({now:36597,active:true,point:input.world});
    expect(director.progressDeadline()).toBe(44597);
    input.now=37783;director.resolve(inspected.meta,true,realToy.id,input.now);input.now=38080;
    const bow=director.next(input)!;expect(bow.meta).toMatchObject({id:"S10",beat:2});expect(bow.action?.play).toBe("bow");
    input.now+=bow.action!.duration;director.complete(bow.meta);expect(director.completed()).toContain("S10");
  });
  const restOwner=()=>{
    const input=scene();input.brain.energy=.4;input.toys=[realToy];
    const outside:Platform={id:"actual-outside",x:1100,y:600,width:200,kind:"date"};input.world.platforms=[floor,outside];
    const director=createCompanionPersonalityDirector([source("S03")]);enter(director,input);
    const returned=director.next(input)!;input.toys=[];director.resolve(returned.meta,true,realToy.id,input.now);
    playAndFinish(director,input); // Same recipe's needed cushion preparation.
    return {input,director};
  };
  it("does not let a wake outing erase S03's still-needed required sleep after the same-ID return",()=>{
    const {input,director}=restOwner(),arbiter=createCompanionRoutineArbiter();
    arbiter.observe("slept",input.now-1);const before=JSON.stringify(director.current());
    expect(director.routineReserved(input)).toBe(true);
    expect(arbiter.next({...input,active:true,entryReady:true,authoredReserved:director.routineReserved(input)})).toBeUndefined();
    expect(JSON.stringify(director.current())).toBe(before);
    expect(director.next(input)?.action?.kind).toBe("sleep");expect(director.completed()).not.toContain("S03");
    expect(arbiter.next({...input,active:true,entryReady:true,authoredReserved:false})?.kind).toBe("outing");
  });
  it.each(["hunger","energy"] as const)("allows actual urgent%s care through soft reservation while hard ownership remains absolute",need=>{
    const {input,director}=restOwner();input.world.foods=[{id:"actual-meal",kind:"carrot",x:180,y:600,platformId:floor.id}];
    if(need==="hunger")input.brain.hunger=.78;else input.brain.energy=.18;
    const request={...input,active:true,entryReady:true,authoredReserved:director.routineReserved(input),meal:{foodId:"actual-meal"}};
    expect(request.authoredReserved).toBe(true);
    expect(createCompanionRoutineArbiter().next(request)?.kind).toBe(need==="hunger"?"meal":"nap");
    expect(createCompanionRoutineArbiter().next({...request,owned:true})).toBeUndefined();
  });
  it.each([.5,.77,.78])("applies the same soft reservation to the actual basic meal route at hunger%s",hunger=>{
    const {input,director}=restOwner();input.brain.hunger=hunger;
    input.world.foods=[{id:"actual-meal",kind:"carrot",x:180,y:600,platformId:floor.id}];
    const request={...input,authoredReserved:director.routineReserved(input)};expect(request.authoredReserved).toBe(true);
    const before=JSON.stringify(director.current()),meal=getCompanionPersonalityMeal(director,undefined,request);
    if(hunger<.78)expect(meal).toBeUndefined();else expect(meal).toMatchObject({kind:"walk",foodId:"actual-meal",target:{x:180,y:600,platformId:floor.id}});
    expect(JSON.stringify(director.current())).toBe(before);
    expect(getCompanionPersonalityMeal(director,undefined,{...request,ownedJob:true})).toBeUndefined();
    input.preferences.feeding=false;expect(getCompanionPersonalityMeal(director,undefined,request)).toBeUndefined();
  });
  it.each([.65,.77,.78])("a real empty-food dispenser stays behind soft ownership except urgent hunger%s",hunger=>{
    const {input,director}=restOwner();input.brain.hunger=hunger;input.world.foods=[];input.home.dispenser={x:380,y:600,platformId:floor.id};
    const before=JSON.stringify(director.current()),request=createCompanionRoutineArbiter().next({...input,active:true,entryReady:true,
      authoredReserved:director.routineReserved(input),meal:{canSupply:true}});
    if(hunger<.78)expect(request).toBeUndefined();else {
      expect(request?.kind).toBe("meal");expect(request?.recipe.steps[0]).toEqual({kind:"food",mode:"spawn"});
      const household=createCompanionHousehold();const action=household.next({brain:input.brain,world:input.world,preferences:input.preferences,now:input.now,
        home:{dispenser:input.home.dispenser},count:0,intent:"feed"});
      expect(action).toMatchObject({kind:"walk",target:input.home.dispenser});
      expect(action?.household?.effect).not.toBe("spawn"); // Actual approach precedes supply; feedOnly shares the existing dispenser job.
    }
    expect(JSON.stringify(director.current())).toBe(before);
  });
  it("yields a pure performance to ordinary real care instead of reserving expression alone",()=>{
    const input=scene();input.preferences.personality="performer";input.brain.hunger=.5;
    input.world.foods=[{id:"actual-meal",kind:"carrot",x:180,y:600,platformId:floor.id}];
    const director=createCompanionPersonalityDirector([source("P11")]),entry=director.next(input)!;
    input.now+=entry.action!.duration;director.complete(entry.meta);expect(director.next(input)?.meta.id).toBe("P11");
    expect(director.routineReserved(input)).toBe(false);
    expect(createCompanionRoutineArbiter().next({...input,active:true,entryReady:true,authoredReserved:false,meal:{foodId:"actual-meal"}})?.kind).toBe("meal");
  });
  it.each(["enabled","roam","personality","sleep","need","sofa","expired"] as const)("does not reserve S03 rest with invalid%s context",state=>{
    const {input,director}=restOwner();
    if(state==="enabled"||state==="roam"||state==="sleep")input.preferences[state]=false;
    if(state==="personality")input.preferences.personality="tidy";
    if(state==="need")input.brain.energy=.9;
    if(state==="sofa")delete input.home.sofa;
    if(state==="expired")input.now+=60001;
    expect(director.routineReserved(input)).toBe(false);
  });
  it.each(["removed","held","hidden","unsupported"] as const)("does not let later sleep hide a currently%s mandatory toy",state=>{
    const input=scene();input.brain.energy=.4;input.toys=[{...realToy}];
    const director=createCompanionPersonalityDirector([source("S03")]);enter(director,input);director.next(input);
    if(state==="removed")input.toys=[];
    if(state==="held")input.toys=[{...realToy,held:true}];
    if(state==="hidden")input.toys=[{...realToy,hidden:true}];
    if(state==="unsupported")input.toys=[{...realToy,platformId:"removed-floor"}];
    expect(director.routineReserved(input)).toBe(false);
  });
  it.each(["ok","failed","old","nan","infinity"] as const)("reserves only a timely actual primitive's short closure:%s",result=>{
    const input=scene();input.toys=[realToy];
    const recipe:PersonalitySceneRecipe={id:"actual-inspection",label:"inspect then greet",personality:"sleepy",major:false,triggers:["toy"],steps:[{kind:"toy",mode:"inspect"},{kind:"pose",pose:"bow"}]};
    const director=createCompanionPersonalityDirector([recipe]);enter(director,input);const inspected=director.next(input)!;
    director.observeProgress({now:5000,active:true,point:{x:124,y:600,platformId:floor.id}});
    director.observeProgress({now:6000,active:true,point:{x:124,y:600,platformId:floor.id}});input.now=6000;input.world.x=124;
    const deadline=director.progressDeadline();
    const at=result==="old"?5500:result==="nan"?NaN:result==="infinity"?Infinity:6000;
    director.resolve(inspected.meta,result!=="failed",realToy.id,at);
    expect(director.routineReserved(input)).toBe(result==="ok");
    expect(director.progressDeadline()).toBe(deadline);expect(director.completed()).toEqual([]);
    input.now+=3501;expect(director.routineReserved(input)).toBe(false);
  });
});

describe("142 an interrupted greeting cannot permanently block common living",()=>{
  const prepared=(personality:typeof COMPANION_PERSONALITIES[number])=>{
    const input=scene();input.preferences={...input.preferences,personality,ambientPrank:false,sleep:false,learnFromYou:false};input.brain.hunger=.5;
    input.home.dispenser={x:380,y:600,platformId:floor.id};
    const pad:Platform={id:"companion-home-floor-400",x:700,y:530,width:2,kind:"floor",manualOnly:true,bodyOnly:true};
    input.world.platforms=[floor,pad];input.home.pad={x:701,y:530,platformId:pad.id};input.home.floor={x:100,y:600,platformId:floor.id};
    const director=createCompanionPersonalityDirector([]),greeting=director.next(input)!;
    expect(greeting.meta.id).toBe(`entry-${personality}`);expect(director.entryReady()).toBe(false);
    return {input,director,greeting};
  };
  it.each(COMPANION_PERSONALITIES)("dismisses %s's actually issued entry without completion/reward, then admits real dispenser approach and common wash",personality=>{
    const {input,director}=prepared(personality),before=director.progressDeadline();director.cancel();
    expect(director.entryReady()).toBe(true);expect(director.completed()).toEqual([]);expect(director.progressDeadline()).toBe(before);
    const arbiter=createCompanionRoutineArbiter(),request=arbiter.next({...input,active:true,entryReady:director.entryReady(),canOuting:false,meal:{canSupply:true}})!;
    expect(request.kind).toBe("meal");expect(request.recipe.steps[0]).toEqual({kind:"food",mode:"spawn"});
    expect(director.startRoutine(request.recipe,input.now)).toBe(true);
    const proposal=director.next(input)!;expect(proposal.meta.id).toBe("routine-meal");expect(proposal.delegate).toEqual({kind:"food",mode:"spawn"});
    const job=createCompanionPersonalityJobs(director,createCompanionHousehold(),createCompanionToyPlanner()).next(proposal,{
      world:input.world,brain:input.brain,preferences:input.preferences,now:input.now,home:{dispenser:input.home.dispenser},
      toys:[],toyIds:[],toyCount:0,foodCount:0});
    expect(job).toMatchObject({kind:"walk",target:input.home.dispenser,personalityScene:{id:"routine-meal"}});
    expect(job?.household?.effect).not.toBe("spawn");expect(director.completed()).toEqual([]);
    // This pure host models the real meal ACK. Only the native renderer test
    // can prove actual eating/discovery; dismissal itself supplies no ACK.
    director.cancel();input.brain.hunger=.1;input.now+=1;arbiter.observe("ate",input.now);
    const wash=arbiter.next({...input,active:true,entryReady:director.entryReady(),canOuting:false})!;
    expect(wash.kind).toBe("wash");expect(director.startRoutine(wash.recipe,input.now)).toBe(true);
    let washing:ReturnType<typeof director.next>;
    for(let leg=0;leg<12;leg++){
      const approached=director.next(input)!;expect(approached.meta.id).toBe("routine-wash");
      if(!approached.meta.travel){washing=approached;break;}
      expect(["walk","jump"]).toContain(approached.action?.kind);
      // The actual first hop may walk on the main floor before jumping onto
      // the measured pad. Follow every proved leg instead of assuming a
      // direct teleport or treating an elapsed travel ACK as arrival.
      director.complete(approached.meta);expect(director.active()).toBe(true);
      input.world={...input.world,...approached.action!.target};input.now+=approached.action!.duration;
      director.observeProgress({now:input.now,active:true,point:input.world});
    }
    expect(washing?.meta.command.kind).toBe("wash");expect(input.world.platformId).toBe("companion-home-floor-400");expect(input.world.y).toBe(530);
    expect(director.completed()).toEqual([]);
  });
  it("does not dismiss an entry which has never been issued",()=>{
    const input=scene(),director=createCompanionPersonalityDirector([]);director.cancel();director.cancel();
    expect(director.entryReady()).toBe(false);expect(director.progressDeadline()).toBeUndefined();
    expect(director.next(input)?.meta.id).toBe("entry-sleepy");expect(director.entryReady()).toBe(false);
  });
  it("invalidates the dismissed entry serial so an old completion/resolve cannot advance the new real meal",()=>{
    const {input,director,greeting}=prepared("mischievous");director.cancel();
    const request=createCompanionRoutineArbiter().next({...input,active:true,entryReady:director.entryReady(),meal:{canSupply:true}})!;
    expect(director.startRoutine(request.recipe,input.now)).toBe(true);const before=director.current();
    director.complete(greeting.meta);director.resolve(greeting.meta,true,undefined,input.now);
    expect(director.current()).toEqual(before);expect(director.completed()).toEqual([]);
  });
  it("still issues a newly selected personality's actual greeting and ignores the old serial",()=>{
    const {input,director,greeting}=prepared("mischievous");director.cancel();input.preferences.personality="balanced";
    const selected=director.next(input)!;expect(selected.meta.id).toBe("entry-balanced");expect(director.entryReady()).toBe(false);
    director.complete(greeting.meta);expect(director.entryReady()).toBe(false);expect(director.completed()).toEqual([]);
    director.complete(selected.meta);expect(director.entryReady()).toBe(true);
  });
  it.each(["enabled","roam"] as const)("preserves explicit %s OFF after the greeting is dismissed",toggle=>{
    const {input,director}=prepared("mischievous");director.cancel();input.preferences[toggle]=false;
    expect(director.next(input)).toBeUndefined();
    expect(createCompanionRoutineArbiter().next({...input,active:true,entryReady:director.entryReady(),meal:{canSupply:true}})).toBeUndefined();
    expect(director.completed()).toEqual([]);
  });
  it("never reissues the dismissed greeting or refills the physical progress deadline on repeated cancellation",()=>{
    const {input,director}=prepared("mischievous");director.cancel();input.now=50;
    expect(director.next(input)).toBeUndefined();const deadline=director.progressDeadline();expect(deadline).toBe(8050);
    input.now=500;director.cancel();expect(director.next(input)).toBeUndefined();expect(director.progressDeadline()).toBe(deadline);
    expect(director.completed()).toEqual([]);
  });
});

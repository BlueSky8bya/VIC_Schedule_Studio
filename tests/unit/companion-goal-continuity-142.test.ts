import { describe, expect, it, vi } from "vitest";
import { createBrain, getFoodAction, commitAction, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, nextCompanionPersonalityScene, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { createCompanionPersonalityJobs } from "@/lib/ui/viewer-companion/personality-jobs";
import { createCompanionPersonalityActivity } from "@/lib/ui/viewer-companion/personality-activity";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { accessibleCompanionToys, createCompanionToys, createCompanionToyPlanner } from "@/lib/ui/viewer-companion/toys";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { companionToyReturnDelivered, companionToyReturnTarget, sampleCompanionToyReturn } from "@/lib/ui/viewer-companion/toy-return";
import { createCompanionAgentExperience } from "@/lib/ui/viewer-companion/agent-experience";

const floor:Platform={id:"ordinary-floor",x:0,y:600,width:1000,kind:"floor"};
const source=(id:string)=>COMPANION_PERSONALITY_SCENES.find(recipe=>recipe.id===id)!;
function scene(personality:PersonalitySceneInput["preferences"]["personality"]):PersonalitySceneInput {
  return {world:{x:100,y:600,platformId:floor.id,platforms:[floor],width:1100,height:720,animated:true,foods:[]},
    brain:{...createBrain(0,()=>.5),energy:.9,hunger:.1,activeMs:0},preferences:{...DEFAULT_COMPANION_PREFERENCES,personality,ambientPrank:false},now:0,home:{},toys:[],tv:"off"};
}
const enter=(director:ReturnType<typeof createCompanionPersonalityDirector>,input:PersonalitySceneInput)=>{
  const entry=director.next(input)!;expect(entry.meta.id).toBe(`entry-${input.preferences.personality}`);director.complete(entry.meta);input.now+=entry.action!.duration;
};
describe("142 goals survive scene variety and empty scenes yield to real behavior",()=>{
  it("never substitutes endless ready/tumble poses for an available ordinary floor",()=>{
    const input=scene("mischievous"),director=createCompanionPersonalityDirector();enter(director,input);
    const activity=createCompanionPersonalityActivity(()=>0);
    const positions:number[]=[];
    for(let index=0;index<8;index++) {
      expect(director.next(input)).toBeUndefined();
      const action=activity.choose(input.brain,input.world,input.preferences,input.now+10000)!;
      expect(action.kind).toBe("walk");expect(action.play).toBeUndefined();expect(Math.abs(action.target.x-input.world.x)).toBeGreaterThanOrEqual(48);
      activity.record(action,input.world,input.now+10000,"mischievous");input.world={...input.world,...action.target};positions.push(input.world.x);input.now+=action.duration+11000;
    }
    expect(new Set(positions).size).toBeGreaterThan(3);expect(director.completed()).toEqual([]);
  });
  it("does not invent movement/poses on a support too small for a real excursion",()=>{
    const input=scene("tidy");input.world={...input.world,x:20,platforms:[{...floor,width:40}]};
    expect(createCompanionPersonalityActivity(()=>0).choose(input.brain,input.world,input.preferences,10000)).toBeUndefined();
  });
  it("returns all four same real IDs before an unrelated available expression, with actual pick/box-contact/stash ACKs",()=>{
    const room:Platform={...floor,id:"companion-home-floor",manualOnly:true},contact={...room,id:"companion-home-floor-food"};
    const input=scene("tidy");input.world={...input.world,platformId:room.id,platforms:[room]};input.home.box={x:850,y:600,platformId:room.id};
    const distract:PersonalitySceneRecipe={id:"test-social",label:"unrelated expression",personality:"tidy",major:true,triggers:["free"],steps:[{kind:"pose",pose:"ask-petting"}]};
    const director=createCompanionPersonalityDirector([source("T01"),distract]),model=createCompanionToys(()=>0),planner=createCompanionToyPlanner();
    const jobs=createCompanionPersonalityJobs(director,createCompanionHousehold(()=>0),planner);
    model.sync([room],{width:1100,height:720},0,[contact]);
    for(let i=0;i<4;i++)expect(model.spawn({x:250+i*100,y:530,platformId:contact.id},0)).toBeTruthy();
    for(let at=0;at<=3000;at+=16)model.tick(at);input.now=3000;const original=model.ids();enter(director,input);
    const picked:string[]=[],returned:string[]=[];
    for(let decision=0;decision<150&&model.count();decision++) {
      input.toys=accessibleCompanionToys(model.available(),input.world.platforms);input.toyCount=model.count();input.carriedToyId=model.carried();input.brain.activeMs=input.now;
      const proposal=nextCompanionPersonalityScene(director,input)!;expect(proposal.meta.id).toBe("T01");
      const action=jobs.next(proposal,{world:input.world,brain:input.brain,preferences:input.preferences,now:input.now,home:{},box:input.home.box,toys:input.toys,toyIds:model.ids(),carriedToy:model.carried(),toyCount:model.count(),foodCount:0})!;
      expect(action).toBeTruthy();const meta=action.personalityScene;
      if(action.kind==="walk"||action.kind==="jump") {
        input.world={...input.world,...action.target};expect(input.world.y).toBe(room.y);
        if(model.carried())expect(model.carry(model.carried()!,{x:input.world.x,y:input.world.y-30})).toBe(true);
      }
      input.now+=action.duration;
      if(action.toy?.effect) {
        const beat=action.toy;let success=false;
        if(beat.effect==="pick") {success=model.pick(beat.toyId!,input.world);picked.push(beat.toyId!);}
        if(beat.effect==="stash") {
          const target=companionToyReturnTarget({left:820,top:525,width:60,height:25})!,item=model.items().find(toy=>toy.id===beat.toyId)!;
          expect(item.carried).toBe(true);expect(Math.abs(input.world.x-input.home.box!.x)).toBeLessThan(55);
          expect(model.carry(item.id,sampleCompanionToyReturn(item,target,1))).toBe(true);
          expect(companionToyReturnDelivered(model.items().find(toy=>toy.id===item.id),target)).toBe(true);
          success=model.stash(item.id);returned.push(item.id);
        }
        expect(success).toBe(true);planner.resolve(beat,success,input.now);
        if(beat.effect!=="pick") {director.resolve(meta,success,beat.toyId);if(director.current()?.beat!==meta.beat)planner.cancel(input.now);}
      }
      director.complete(meta);input.now+=220;model.tick(input.now);
    }
    expect(model.count()).toBe(0);expect(picked.sort()).toEqual([...original].sort());expect(returned.sort()).toEqual([...original].sort());
    expect(director.completed()).not.toContain(distract.id);
  });
  it("preserves ordinary food identity even when another snack becomes nearer",()=>{
    const input=scene("gourmet");input.brain.hunger=.5;input.world.foods=[{id:"selected",kind:"carrot",x:400,y:600,platformId:floor.id},{id:"other",kind:"bagel",x:600,y:600,platformId:floor.id}];
    const first=getFoodAction(input.brain,input.world,input.preferences,0)!;input.brain=commitAction(input.brain,first,0);input.world.x=550;
    expect(getFoodAction(input.brain,input.world,input.preferences,2000)?.foodId).toBe(first.foodId);
  });
  it("G07 chooses a nearby actual meal independently of array order",()=>{
    const input=scene("gourmet");input.brain.hunger=.5;input.world.foods=[{id:"far",kind:"carrot",x:850,y:600,platformId:floor.id},{id:"near",kind:"bagel",x:140,y:600,platformId:floor.id}];
    const director=createCompanionPersonalityDirector([source("G07")]);enter(director,input);expect(director.next(input)?.meta.itemId).toBe("near");
  });
  it("G04 skips a remote comparison and retains its actual meal",()=>{
    const input=scene("gourmet");input.brain.hunger=.5;input.brain.life={...input.brain.life!,tastedFoods:["potato"]};
    input.world.foods=[{id:"main",kind:"carrot",x:180,y:600,platformId:floor.id},{id:"remote",kind:"bagel",x:850,y:600,platformId:floor.id}];
    const director=createCompanionPersonalityDirector([source("G04")]);enter(director,input);
    expect(director.next(input)).toMatchObject({meta:{itemId:"main",beat:1},delegate:{kind:"food",mode:"inspect"}});
  });
  it("G04 holds both real IDs through reorder and feeds the original, not its comparison partner",()=>{
    const input=scene("gourmet");input.brain.hunger=.5;input.brain.life={...input.brain.life!,tastedFoods:["potato"]};
    input.world.foods=[{id:"main",kind:"carrot",x:180,y:600,platformId:floor.id},{id:"peer",kind:"bagel",x:240,y:600,platformId:floor.id},{id:"other",kind:"bread",x:270,y:600,platformId:floor.id}];
    const director=createCompanionPersonalityDirector([source("G04")]),jobs=createCompanionPersonalityJobs(director,createCompanionHousehold(()=>0),createCompanionToyPlanner());enter(director,input);
    const offer=()=>{const p=director.next(input)!;return {p,a:jobs.next(p,{world:input.world,brain:input.brain,preferences:input.preferences,now:input.now,home:{},toys:[],toyCount:0,foodCount:3})!};};
    const first=offer();expect(first.p.meta).toMatchObject({itemId:"main",comparisonItemId:"peer"});expect(first.a.target.x).toBe(240);
    input.world.foods=[input.world.foods![0],input.world.foods![2],input.world.foods![1]];input.world.x=150;input.now+=400;
    const again=offer();expect(again.a.target.x).toBe(240);input.world.x=240;input.now+=900;
    const sniff=offer();expect(sniff.a.kind).toBe("sniff");director.resolve(sniff.a.personalityScene,true);
    expect(director.current()).toMatchObject({itemId:"main",beat:1});expect(offer().a.target.x).toBe(180);
  });
  it("never reads learned scores with learning OFF or lets them replace entry/actual cleanup",()=>{
    const input=scene("tidy"),score=vi.fn(()=>.2);input.preferences.learnFromYou=false;input.experience={score};
    input.home.box={x:900,y:600,platformId:floor.id};input.toys=[{id:"real",kind:"ball",x:300,y:600,platformId:floor.id,angle:0,held:false,carried:false}];
    const director=createCompanionPersonalityDirector();enter(director,input);expect(director.next(input)?.meta.id).toBe("T01");expect(score).not.toHaveBeenCalled();
  });
  it("uses actual experience only between feasible peer goals and retains the selected real owner after scores change",()=>{
    const input=scene("curious"),policy=createCompanionAgentExperience();input.experience=policy;
    input.world.platforms=[floor,{id:"new-date",x:700,y:550,width:160,kind:"date"}];
    input.toys=[{id:"same-real-toy",kind:"ball",x:300,y:600,platformId:floor.id,angle:0,held:false,carried:false}];
    const recipes:PersonalitySceneRecipe[]=[{id:"test-explore",label:"real route",personality:"curious",major:true,triggers:["free"],steps:[{kind:"go",target:"novel-place"}]},
      {id:"test-play",label:"real toy",personality:"curious",major:true,triggers:["toy"],steps:[{kind:"toy",mode:"inspect"}]}];
    const prior=createCompanionPersonalityDirector(recipes);enter(prior,input);expect(prior.next(input)?.meta.id).toBe("test-explore");
    policy.observe({personality:"curious",context:"outside",effect:"toy-played",learn:true});
    const learned=createCompanionPersonalityDirector(recipes);enter(learned,input);
    expect(learned.next(input)?.meta).toMatchObject({id:"test-play",itemId:"same-real-toy"});
    input.experience={score:()=>-.1};expect(learned.next(input)?.meta).toMatchObject({id:"test-play",itemId:"same-real-toy"});
    input.preferences.learnFromYou=false;const off=createCompanionPersonalityDirector(recipes);enter(off,input);expect(off.next(input)?.meta.id).toBe("test-explore");
  });
  it("does not exchange one same-place expression for another identical family until time or a real destination changes",()=>{
    const input=scene("balanced"),recipes:PersonalitySceneRecipe[]=["one","two"].map(id=>({id,label:id,personality:"balanced",major:false,triggers:["free"],steps:[{kind:"pose",pose:"bow"}]}));
    const director=createCompanionPersonalityDirector(recipes);enter(director,input);const first=director.next(input)!;director.complete(first.meta);
    expect(director.next(input)).toBeUndefined();
    input.world.x+=120;input.now+=500;expect(director.next(input)?.meta.id).toBe("two");
  });
});

import {describe,it,expect} from "vitest";
import {createBrain,type Platform} from "@/lib/ui/viewer-companion/brain";
import {createCompanionPersonalityDirector,nextCompanionPersonalityScene,type PersonalitySceneInput} from "@/lib/ui/viewer-companion/personality-director";
import {createCompanionPersonalityJobs} from "@/lib/ui/viewer-companion/personality-jobs";
import {createCompanionHousehold} from "@/lib/ui/viewer-companion/household";
import {createCompanionRoutineArbiter} from "@/lib/ui/viewer-companion/routine-arbiter";
import {createCompanionToys,createCompanionToyPlanner} from "@/lib/ui/viewer-companion/toys";
import {companionToyReturnDelivered,companionToyReturnTarget,sampleCompanionToyReturn} from "@/lib/ui/viewer-companion/toy-return";
import {COMPANION_PERSONALITY_SCENES} from "@/lib/ui/viewer-companion/personality-scene-catalog";
import {DEFAULT_COMPANION_PREFERENCES} from "@/lib/ui/viewer-companion/preferences";

const floor:Platform={id:"companion-home-floor",x:40,y:600,width:620,kind:"floor",manualOnly:true};
const pad:Platform={id:"companion-home-floor-400",x:440,y:530,width:40,kind:"floor",bodyOnly:true};
const outside:Platform={id:"real-public-date",x:700,y:580,width:180,kind:"date"};
function scene():PersonalitySceneInput {
 return {world:{x:200,y:600,platformId:floor.id,platforms:[floor,pad,outside],width:1100,height:800,animated:true,foods:[]},
  brain:{...createBrain(0,()=>.5),hunger:.05,energy:.9},preferences:{...DEFAULT_COMPANION_PREFERENCES,personality:"tidy",ambientPrank:false},now:0,
  home:{floor:{x:300,y:600,platformId:floor.id},box:{x:560,y:600,platformId:floor.id},sofa:{x:200,y:600,platformId:floor.id},pad:{x:460,y:530,platformId:pad.id}},toys:[],toyCount:0,tv:"off"};
}
function enter(d:ReturnType<typeof createCompanionPersonalityDirector>,s:PersonalitySceneInput){const e=d.next(s)!;s.now+=e.action!.duration;d.complete(e.meta);s.now+=220;}
/** Director protocol fixture: the broad continuity case below separately
 * performs every pickup/carry/box delivery against the real object model. */
function ready(recipes=COMPANION_PERSONALITY_SCENES){
 const s=scene(),d=createCompanionPersonalityDirector(recipes);s.toys=[{id:"acknowledged-real-return",kind:"ball",x:250,y:600,platformId:floor.id,angle:0,held:false,carried:false}];s.toyCount=1;enter(d,s);
 let returnedAt=-1;
 for(let n=0;n<10;n++){
  const p=d.next(s)!;expect(p).toBeTruthy();
  if(p.delegate?.kind==="toy"&&p.delegate.mode==="return"){
   s.now+=600;d.observeProgress({now:s.now,active:true,point:s.world});d.resolve(p.meta,true,p.meta.itemId,s.now);returnedAt=s.now;
   s.toys=[];s.toyCount=0;d.event("toy-returned",returnedAt);
  }else{const action=p.action!;s.now+=action.duration;if(action.kind==="walk"||action.kind==="jump")s.world={...s.world,...action.target};d.complete(p.meta);}
  s.now+=220;if(returnedAt>=0&&!d.active())break;
 }
 expect(returnedAt).toBeGreaterThan(0);s.brain.activeMs=s.now;return{s,d,returnedAt};
}
const owners=(s:PersonalitySceneInput,d:ReturnType<typeof createCompanionPersonalityDirector>)=>({...s,active:true,entryReady:d.entryReady(),authoredReserved:d.routineReserved(s),authoredLeisure:d.routineOwnership(s)==="leisure",canOuting:!d.cleanupPending(s)&&!d.cleanupFollowupReady(s)&&!d.mealFollowupReady(s)});

describe("146 one feasible hygiene follow-up survives optional outside admission",()=>{
 it("returns four actual physical IDs, washes once on mat400, then permits the ordinary public outing",()=>{
  const s=scene(),d=createCompanionPersonalityDirector(),a=createCompanionRoutineArbiter(),model=createCompanionToys(()=>0),planner=createCompanionToyPlanner();
  const jobs=createCompanionPersonalityJobs(d,createCompanionHousehold(()=>0),planner);
  model.sync([floor,outside],{width:1100,height:800},0);for(let i=0;i<4;i++)expect(model.spawn({x:250+i*60,y:570,platformId:floor.id},0)).toBeTruthy();
  for(let at=16;at<=3000;at+=16)model.tick(at);const ids=model.ids(),returned:string[]=[];s.now=3000;enter(d,s);d.event("arrival",s.now);
  let washed=0,departed=false;const opening=companionToyReturnTarget({left:530,top:525,width:60,height:25})!;
  for(let n=0;n<150&&!washed;n++){
   s.toys=model.available();s.toyCount=model.count();s.carriedToyId=model.carried();s.brain.activeMs=s.now;
   if(!planner.active()&&!model.carried()&&!d.current()?.routine){const request=a.next(owners(s,d));if(request){expect(request.kind).not.toBe("outing");expect(d.startRoutine(request.recipe,s.now,request.itemId,request.outsideGoal)).toBe(true);}}
   const p=nextCompanionPersonalityScene(d,s);if(!p){s.now+=220;continue;}
   const action=jobs.next(p,{world:s.world,brain:s.brain,preferences:s.preferences,now:s.now,home:{},box:s.home.box,toys:s.toys,toyIds:model.ids(),carriedToy:model.carried(),toyCount:model.count(),foodCount:0});
   if(!action){s.now+=220;continue;}s.now+=action.duration;
   if(action.kind==="walk"||action.kind==="jump"){s.world={...s.world,...action.target};if(model.carried())expect(model.carry(model.carried()!,{x:s.world.x,y:s.world.y-30})).toBe(true);}
   if(action.toy?.effect){const beat=action.toy;let ok=false;
    if(beat.effect==="pick")ok=model.pick(beat.toyId!,s.world);
    if(beat.effect==="stash"){const toy=model.items().find(t=>t.id===beat.toyId)!;expect(toy.carried).toBe(true);expect(model.carry(toy.id,sampleCompanionToyReturn(toy,opening,1))).toBe(true);expect(companionToyReturnDelivered(model.items().find(t=>t.id===toy.id),opening)).toBe(true);ok=model.stash(toy.id);returned.push(toy.id);}
    expect(ok).toBe(true);planner.resolve(beat,ok,s.now);if(beat.effect!=="pick"){d.resolve(action.personalityScene,ok,beat.toyId,s.now);if(d.current()?.beat!==action.personalityScene.beat)planner.cancel(s.now);}
    if(beat.effect==="stash")d.event("toy-returned",s.now);
   }
   d.observeProgress({now:s.now,active:true,point:s.world,carriedToyId:model.carried()});
   if(action.personalityScene.command.kind==="wash"&&!action.personalityScene.travel){
    expect(model.count()).toBe(0);expect(s.world.platformId).toBe(pad.id);expect(s.world.x).toBe(460);expect(s.world.y).toBe(pad.y);expect(action.duration).toBeGreaterThanOrEqual(500);
    d.resolve(action.personalityScene,true,undefined,s.now);a.observe("washed",s.now);washed++;
   }else d.complete(action.personalityScene);
   s.now+=220;model.tick(s.now);
  }
  expect(returned.sort()).toEqual([...ids].sort());expect(washed).toBe(1);expect(model.ids()).toEqual([]);
  // Complete the same aftercare's real floor/outside route and finite tail.
  for(let n=0;n<20&&d.active();n++){const p=d.next(s);if(!p)continue;const action=p.action!;expect(p.meta.command.kind).not.toBe("wash");s.now+=action.duration;if(action.kind==="walk"||action.kind==="jump")s.world={...s.world,...action.target};d.observeProgress({now:s.now,active:true,point:s.world});d.complete(p.meta);}
  expect(d.cleanupFollowupReady({...s,toys:[],toyCount:0})).toBe(false);
  const request=a.next(owners({...s,toys:[],toyCount:0},d));departed=request?.kind==="outing";
  expect(departed||!s.world.platformId?.startsWith("companion-home")).toBe(true);
 });
 it("queries are pure and prefer the major T05 for the actual return receipt",()=>{
  const {s,d}=ready();const before={current:d.current(),completed:d.completed(),deadline:d.progressDeadline()};
  for(let i=0;i<25;i++)expect(d.cleanupFollowupReady(s)).toBe(true);
  expect({current:d.current(),completed:d.completed(),deadline:d.progressDeadline()}).toEqual(before);
  expect(d.next(s)?.meta.id).toBe("T05");
 });
 it("the eligible minor alias can perform aftercare when its major alias is absent",()=>{
  const {s,d}=ready(COMPANION_PERSONALITY_SCENES.filter(r=>["T01","X-T-house"].includes(r.id)));
  expect(d.cleanupFollowupReady(s)).toBe(true);expect(d.next(s)?.meta.id).toBe("X-T-house");
 });
 it("a return event without an actual successful return ACK cannot reserve aftercare",()=>{
  const s=scene(),d=createCompanionPersonalityDirector();enter(d,s);d.event("toy-returned",s.now);expect(d.cleanupFollowupReady(s)).toBe(false);
 });
 it.each(["remaining-count","unknown-count","settled-toy","carried-toy","carried-food","no-cue","expired-cue","no-pad","wrong-pad","not-body","off-pad","unreachable","jump-off","urgent-meal","exhausted","food-owner","episode","disabled","roam-off","paused","busy","other-personality","invalid-needs"])("does not reserve optional departure for %s aftercare",gate=>{
  const {s,d,returnedAt}=ready();if(gate==="remaining-count")s.toyCount=1;if(gate==="unknown-count")s.toyCount=undefined;
  if(gate==="settled-toy")s.toys=[{id:"actual-left",kind:"ball",x:250,y:600,platformId:floor.id,angle:0,held:false,carried:false}];
  if(gate==="carried-toy")s.carriedToyId="physical-left";if(gate==="carried-food")s.carriedFoodId="physical-food";
  if(gate==="no-cue")d.event("toy-returned",-10000);if(gate==="expired-cue")s.now=returnedAt+15000;
  if(gate==="no-pad")s.home.pad=undefined;if(gate==="wrong-pad")s.home.pad={x:460,y:530,platformId:"other-pad"};
  if(gate==="not-body")s.world.platforms=s.world.platforms.map(p=>p.id===pad.id?{...p,bodyOnly:false}:p);
  if(gate==="off-pad")s.home.pad!.x=900;if(gate==="unreachable"){s.home.pad!.y=100;s.world.platforms=s.world.platforms.map(p=>p.id===pad.id?{...p,y:100}:p);}
  if(gate==="jump-off")s.preferences.jump=false;if(gate==="urgent-meal")s.brain.hunger=.78;if(gate==="exhausted")s.brain.energy=.18;
  if(gate==="food-owner")s.brain.foodGoal={foodId:"actual-meal",remaining:3,retryAfter:s.now};
  if(gate==="episode")s.brain.episode={kind:"meal",phase:"meal",variant:"careful",remaining:1,foodId:"actual-meal",mishapUsed:false,legs:0};
  if(gate==="disabled")s.preferences.enabled=false;if(gate==="roam-off")s.preferences.roam=false;if(gate==="paused")s.world.paused=true;if(gate==="busy")s.busy=true;
  if(gate==="other-personality")s.preferences.personality="balanced";if(gate==="invalid-needs")s.brain.energy=NaN;
  expect(d.cleanupFollowupReady(s)).toBe(false);
 });
});

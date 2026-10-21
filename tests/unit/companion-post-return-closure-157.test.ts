import {describe,expect,it} from "vitest";
import {createBrain,type Platform} from "@/lib/ui/viewer-companion/brain";
import {createCompanionPersonalityDirector,type PersonalitySceneInput} from "@/lib/ui/viewer-companion/personality-director";
import {COMPANION_PERSONALITY_SCENES} from "@/lib/ui/viewer-companion/personality-scene-catalog";
import {DEFAULT_COMPANION_PREFERENCES} from "@/lib/ui/viewer-companion/preferences";
import {createCompanionRoutineArbiter} from "@/lib/ui/viewer-companion/routine-arbiter";

const floor:Platform={id:"companion-home-floor",x:30,y:600,width:900,kind:"floor",manualOnly:true};
const sofa:Platform={id:"companion-home",x:40,y:560,width:150,kind:"date"};
const recipe=COMPANION_PERSONALITY_SCENES.find(x=>x.id==="X-T-return-time")!;
/** Model host: return ACK is explicit, never a claim of native object/paint
 * proof. Native same-ID delivery and full final grooming remain mandatory. */
function chore(long=false,future=false){
 const start=long?620:220;
 const s:PersonalitySceneInput={world:{x:start,y:600,platformId:floor.id,platforms:[floor,sofa],width:1440,height:900,animated:true,foods:[]},
  brain:{...createBrain(0,()=>.5),hunger:.5,energy:.9},preferences:{...DEFAULT_COMPANION_PREFERENCES,personality:"tidy",sleep:true},now:0,
  home:{box:{x:start,y:600,platformId:floor.id},floor:{x:140,y:600,platformId:floor.id},sofa:{x:110,y:560,platformId:sofa.id}},tv:"off",
  toys:[{id:"same-model-ball",kind:"ball",x:start,y:600,platformId:floor.id,angle:0,held:false,carried:false}],toyCount:1};
 const chosen=future?{...recipe,steps:[...recipe.steps,{kind:"go" as const,target:"outside" as const,optional:true}]}:recipe;
 const d=createCompanionPersonalityDirector([chosen]),entry=d.next(s)!;d.complete(entry.meta);s.now=100;d.event("arrival",s.now);
 const giveBack=d.next(s)!;expect(giveBack.delegate).toMatchObject({kind:"toy",mode:"return"});expect(giveBack.meta.itemId).toBe("same-model-ball");
 d.resolve(giveBack.meta,true,"same-model-ball",2000);s.now=2050;s.toys=[];s.toyCount=0;
 const go=d.next(s)!;expect(go.meta.command).toEqual({kind:"go",target:"floor"});expect(go.meta.travel).toBe(true);
 const arrive=()=>{
  const action=go.action!,from={...s.world},began=s.now;
  for(let n=1;n<=20;n++){
   const u=n/20;s.now=began+action.duration*u;s.world={...s.world,x:from.x+(action.target.x-from.x)*u,y:from.y+(action.target.y-from.y)*u,...(u===1?{platformId:action.target.platformId}:{})};
   d.observeProgress({now:s.now,active:true,point:s.world});
  }
  s.world.foods=[{id:"next-real-meal",kind:"carrot",x:160,y:600,platformId:floor.id}];
 };
 const arbitrate=()=>{const owner=d.routineOwnership(s);return{owner,request:createCompanionRoutineArbiter().next({...s,active:true,entryReady:d.entryReady(),authoredReserved:Boolean(owner),authoredLeisure:owner==="leisure",meal:{foodId:"next-real-meal"}})};};
 return{s,d,go,arrive,arbitrate};
}
describe("157 post-return floor arrival keeps the actual short grooming before nonurgent routines",()=>{
 it.each([false,true])("preserves same-owner arrival BEFORE next advances go, including long route=%s",long=>{
  const h=chore(long);h.arrive();if(long)expect(h.s.now-2000).toBeGreaterThan(3500);
  expect(h.d.current()?.beat).toBe(1);expect(h.d.owns(h.go.meta)).toBe(true);const deadline=h.d.progressDeadline();
  expect(h.arbitrate()).toEqual({owner:"work",request:undefined});expect(h.d.current()?.beat).toBe(1);expect(h.d.progressDeadline()).toBe(deadline);
  const grooming=h.d.next(h.s)!;expect(grooming.meta.id).toBe(recipe.id);expect(grooming.meta.serial).toBe(h.go.meta.serial);expect(grooming.meta.command).toMatchObject({kind:"pose",pose:"groom"});
  expect(h.d.completed()).toEqual([]);
 });
 it("does not pretend the offered route arrived or completed before actual model movement",()=>{
  const h=chore();const again=h.d.next(h.s)!;expect(again.meta.command).toEqual({kind:"go",target:"floor"});expect(again.meta.travel).toBe(true);
  expect(h.d.current()?.beat).toBe(1);expect(h.d.completed()).toEqual([]);expect(h.s.world.x).not.toBe(again.action!.target.x);
 });
 it("releases the reservation only after the full required model grooming completes",()=>{
  const h=chore(true);h.arrive();expect(h.arbitrate().request).toBeUndefined();const grooming=h.d.next(h.s)!;
  expect(grooming.action?.kind).toBe("play");expect(grooming.action?.play).toBe("groom");h.s.now+=grooming.action!.duration;
  h.d.observeProgress({now:h.s.now,active:true,point:h.s.world});h.d.complete(grooming.meta);
  expect(h.d.completed()).toContain(recipe.id);expect(h.arbitrate().owner).toBeUndefined();expect(h.arbitrate().request?.kind).toBe("meal");
 });
 it("read-only reservation queries grant no completion, new goal, progress or reward",()=>{
  const h=chore(true);h.arrive();const before={owner:h.d.current(),deadline:h.d.progressDeadline(),completed:h.d.completed(),input:JSON.stringify(h.s)};
  for(let i=0;i<20;i++)expect(h.d.routineOwnership(h.s)).toBe("work");
  expect({owner:h.d.current(),deadline:h.d.progressDeadline(),completed:h.d.completed(),input:JSON.stringify(h.s)}).toEqual(before);
 });
 it.each(["OFF","roamOFF","paused","busy","carried-food","carried-toy","real-food-goal","real-feed-intent"])("respects %s instead of retaining decorative ownership",condition=>{
  const h=chore();h.arrive();if(condition==="OFF")h.s.preferences.enabled=false;if(condition==="roamOFF")h.s.preferences.roam=false;if(condition==="paused")h.s.world.paused=true;if(condition==="busy")h.s.busy=true;
  if(condition==="carried-food")h.s.carriedFoodId="other-real-food";if(condition==="carried-toy")h.s.carriedToyId="other-real-toy";
  if(condition==="real-food-goal")h.s.brain.foodGoal={foodId:"next-real-meal",remaining:1,retryAfter:0};
  if(condition==="real-feed-intent")h.s.brain.intention={kind:"feed",targetId:floor.id,offset:.2,remaining:1,stage:"travel",foodId:"next-real-meal"};
  expect(h.d.routineOwnership(h.s)).toBeUndefined();expect(h.d.completed()).toEqual([]);
 });
 it.each(["urgent-hunger","exhausted"])("still allows %s to preempt at the same real arrival checkpoint",need=>{
  const h=chore(true);h.arrive();if(need==="urgent-hunger")h.s.brain.hunger=.8;else h.s.brain.energy=.15;
  const result=h.arbitrate();expect(result.owner).toBe("work");expect(result.request?.kind).toBe(need==="urgent-hunger"?"meal":"nap");expect(h.d.completed()).toEqual([]);
 });
 it("a later explicit manual interruption revokes the old serial without certifying grooming",()=>{
  const h=chore();h.arrive();h.d.cancel();expect(h.d.owns(h.go.meta)).toBe(false);expect(h.d.routineOwnership(h.s)).toBeUndefined();expect(h.d.completed()).toEqual([]);
 });
 it("retains the existing60s owner lifetime bound",()=>{
  const h=chore(true);h.arrive();h.s.now=60101;expect(h.d.routineOwnership(h.s)).toBeUndefined();expect(h.d.completed()).toEqual([]);
 });
 it("retains the original7.5s no-progress bound after arrival",()=>{
  const h=chore(true);h.arrive();h.d.next(h.s);h.s.now+=7501;
  expect(h.d.routineOwnership(h.s)).toBeUndefined();expect(h.d.completed()).toEqual([]);
 });
 it("does not turn an optional future outing into a post-return closure",()=>{
  const h=chore(true,true);h.arrive();expect(h.d.routineOwnership(h.s)).toBeUndefined();expect(h.d.completed()).toEqual([]);
 });
 it("a vanished actual floor cannot masquerade as arrival",()=>{
  const h=chore();h.arrive();h.s.world.platforms=[sofa];expect(h.d.routineOwnership(h.s)).toBeUndefined();expect(h.d.completed()).toEqual([]);
 });
});

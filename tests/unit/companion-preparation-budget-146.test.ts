import {describe,it,expect} from "vitest";
import {createBrain,type Platform} from "@/lib/ui/viewer-companion/brain";
import {createCompanionPersonalityDirector,nextCompanionPersonalityScene,type PersonalitySceneInput} from "@/lib/ui/viewer-companion/personality-director";
import {createCompanionPersonalityJobs} from "@/lib/ui/viewer-companion/personality-jobs";
import {createCompanionHousehold} from "@/lib/ui/viewer-companion/household";
import {createCompanionToyPlanner,createCompanionToys} from "@/lib/ui/viewer-companion/toys";
import {COMPANION_PERSONALITY_SCENES,type PersonalitySceneRecipe} from "@/lib/ui/viewer-companion/personality-scene-catalog";
import {COMPANION_PERSONALITIES,DEFAULT_COMPANION_PREFERENCES} from "@/lib/ui/viewer-companion/preferences";

const floor:Platform={id:"companion-home-floor",x:50,y:600,width:600,kind:"floor",manualOnly:true};
function input(personality:PersonalitySceneInput["preferences"]["personality"]="sleepy"):PersonalitySceneInput {
 return {world:{x:200,y:600,platformId:floor.id,platforms:[floor],width:1000,height:800,animated:true,foods:[]},
  brain:{...createBrain(0,()=>.5),hunger:.05,energy:.9,activeMs:3000},preferences:{...DEFAULT_COMPANION_PREFERENCES,personality,sleep:true,ambientPrank:false},
  now:3000,home:{floor:{x:300,y:600,platformId:floor.id},sofa:{x:200,y:600,platformId:floor.id},box:{x:500,y:600,platformId:floor.id}},toys:[],tv:"off"};
}
describe("146 stationary preparation shares a real progress budget across entry and recipes",()=>{
 it.each(COMPANION_PERSONALITIES)("%s entry is included before any pose/scene completion",personality=>{
  const s=input(personality),d=createCompanionPersonalityDirector([]),at=s.now,entry=d.next(s)!;
  expect(d.progressDeadline()).toBe(at+8000);
  s.now+=entry.action!.duration;d.observeProgress({now:s.now,active:true,point:s.world});d.complete(entry.meta);
  s.now+=220;d.next(s);expect(d.progressDeadline()).toBe(at+8000);
 });
 it("well-rested sleepy's real entry→arrival→toy inspection chain reaches physical work before ten stationary seconds",()=>{
  const s=input(),model=createCompanionToys(()=>0);model.sync([floor],{width:1000,height:800},0);
  const id=model.spawn({x:200,y:530,platformId:floor.id},0)!;for(let at=16;at<=3000;at+=16)model.tick(at);
  expect(model.available()).toHaveLength(1);s.world.x=model.available()[0].x;
  const recipes=COMPANION_PERSONALITY_SCENES.filter(r=>["S06","S10","S03"].includes(r.id));
  const d=createCompanionPersonalityDirector(recipes),planner=createCompanionToyPlanner(),jobs=createCompanionPersonalityJobs(d,createCompanionHousehold(()=>0),planner);
  const began=s.now,entry=d.next(s)!;s.now+=entry.action!.duration;d.observeProgress({now:s.now,active:true,point:s.world});d.complete(entry.meta);s.now+=220;
  d.event("arrival",s.now);d.event("toy-settled",s.now);const initialDeadline=d.progressDeadline();
  let workedAt:number|undefined;const log:string[]=[];
  for(let n=0;n<30&&workedAt===undefined;n++) {
   s.toys=model.available();s.toyCount=model.count();s.carriedToyId=model.carried();s.brain.activeMs=s.now;
   const p=nextCompanionPersonalityScene(d,s);if(!p){s.now+=220;continue;}
   const a=jobs.next(p,{world:s.world,brain:s.brain,preferences:s.preferences,now:s.now,home:{},box:s.home.box,toys:s.toys,toyIds:model.ids(),carriedToy:model.carried(),toyCount:model.count(),foodCount:0});
   if(!a){s.now+=220;continue;}log.push(`${Math.round(s.now-began)}:${p.meta.id}:${a.kind}:${p.meta.command.kind}`);
   s.now+=a.duration;
   if(a.kind==="walk"||a.kind==="jump"){s.world={...s.world,...a.target};workedAt=s.now;}
   if(a.toy?.effect==="pick") {
    expect(a.toy.toyId).toBe(id);expect(model.pick(id,s.world)).toBe(true);planner.resolve(a.toy,true,s.now);s.carriedToyId=id;workedAt=s.now;
   }
   d.observeProgress({now:s.now,active:true,point:s.world,carriedToyId:model.carried()});
   if(a.personalityJobEnd)d.resolve(a.personalityScene,true,a.personalityScene.itemId,s.now);else d.complete(a.personalityScene);
   if(workedAt===undefined)expect(d.progressDeadline()).toBe(initialDeadline);
   s.now+=220;
  }
  expect(workedAt,log.join("\n")).toBeDefined();expect(workedAt!-began,log.join("\n")).toBeLessThan(10000);
  expect(s.brain.energy).toBe(.9);expect(s.brain.hunger).toBe(.05);
 });
 it("a finite directly acknowledged pet follow-up stays available without forging physical progress",()=>{
  const s=input(),recipe:PersonalitySceneRecipe={id:"real-pet",label:"real touch",personality:"sleepy",major:false,triggers:["pet"],steps:[{kind:"pose",pose:"doze-curl"},{kind:"pose",pose:"stretch"}]};
  const d=createCompanionPersonalityDirector([recipe]),entry=d.next(s)!;d.complete(entry.meta);s.now+=11000;
  d.observeProgress({now:s.now,active:true,point:s.world});const deadline=d.progressDeadline();d.event("pet",s.now);
  const p=d.next(s)!;expect(p.meta.id).toBe(recipe.id);expect(p.action?.play).toBe("doze-curl");expect(d.progressDeadline()).toBe(deadline);
 });
 it("actual needed sleep and one wake stretch remain legitimate after a spent preparation budget",()=>{
  const s=input(),d=createCompanionPersonalityDirector([]),entry=d.next(s)!;d.complete(entry.meta);s.now+=11000;s.brain.energy=.2;d.observeProgress({now:s.now,active:true,point:s.world});
  const deadline=d.progressDeadline(),recipe:PersonalitySceneRecipe={id:"routine-nap",label:"necessary nap",personality:"sleepy",major:true,triggers:["free"],steps:[{kind:"sleep",ms:5500},{kind:"pose",pose:"stretch"}]};
  expect(d.startRoutine(recipe,s.now)).toBe(true);const sleep=d.next(s)!;expect(sleep.action?.kind).toBe("sleep");s.now+=sleep.action!.duration;d.complete(sleep.meta);
  expect(d.next(s)?.action?.kind).toBe("stretch");expect(d.progressDeadline()).toBe(deadline);
 });
});

import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { createBrain,type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector,type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { COMPANION_PERSONALITY_SCENES } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { companionPettingResponse } from "@/lib/ui/viewer-companion/petting";
import { COMPANION_TIMING,companionPlayDuration } from "@/lib/ui/viewer-companion/timing";

const room:Platform={id:"companion-home-floor",x:30,y:600,width:430,kind:"floor",manualOnly:true};
const sofa:Platform={id:"companion-home",x:40,y:560,width:150,kind:"date"};
const outside:Platform={id:"actual-calendar-one",x:460,y:600,width:180,kind:"date"};
function boot(id="A01",withFreshGoal=true){
 const recipe=COMPANION_PERSONALITY_SCENES.find(x=>x.id===id)!;
 const recipes=[recipe,...(withFreshGoal?[COMPANION_PERSONALITY_SCENES.find(x=>x.id==="D157-A")!]:[])];
 const s:PersonalitySceneInput={world:{x:130,y:600,platformId:room.id,platforms:[room,sofa,outside],width:1100,height:800,animated:true,
   pointer:{x:590,y:600,stableMs:1000},foods:id==="G01"?[{id:"actual-meal",kind:"carrot",x:190,y:600,platformId:room.id}]:[]},
   brain:{...createBrain(0,()=>.5),energy:id==="S01"?.1:.95,hunger:id==="G01"?.55:.05},
   preferences:{...DEFAULT_COMPANION_PREFERENCES,personality:recipe.personality},now:0,toyCount:id==="C07"?1:0,
   toys:id==="C07"?[{id:"same-kaleidoscope",kind:"kaleidoscope",x:190,y:600,platformId:room.id,held:false,carried:false,angle:0}]:[],
   tv:"off",canTv:true,favoriteFood:"carrot",lightLit:true,
   home:{floor:{x:210,y:600,platformId:room.id},sofa:{x:110,y:560,platformId:sofa.id},box:{x:300,y:600,platformId:room.id},tv:{x:210,y:600,platformId:room.id},contacts:{tv:{x:210,y:570}}}};
 const d=createCompanionPersonalityDirector(recipes),entry=d.next(s)!;expect(entry.meta.id).toBe(`entry-${recipe.personality}`);d.complete(entry.meta);
 s.now=100;const issued=d.next(s)!;expect(issued.meta.id).toBe(id);return{d,s,issued};
}
describe("157 accepted petting dismisses only interrupted voluntary ownership",()=>{
 it("revokes actual issued A01 before the real accepted pet cue admits D157-A",()=>{
  const {d,s,issued}=boot(),deadline=d.progressDeadline();expect(d.owns(issued.meta)).toBe(true);
  expect(d.interruptForPetting(s)).toBe(true);expect(d.current()).toBeUndefined();expect(d.owns(issued.meta)).toBe(false);
  expect(d.completed()).toEqual([]);expect(d.progressDeadline()).toBe(deadline);expect(d.pendingApprovedContinuationReady(s)).toBe(false);
  d.event("pet",s.now);expect(d.pendingApprovedContinuationReady(s)).toBe(true);
  const next=d.next(s)!;expect(next.meta.id).toBe("D157-A");expect(next.meta.command).toMatchObject({kind:"go",target:"outside"});
 });
 it("dismissal has no failure penalty, fabricated completion or progress credit",()=>{
  const {d,s}=boot("A01",false),before=d.progressDeadline();expect(d.interruptForPetting(s)).toBe(true);
  expect(d.completed()).toEqual([]);expect(d.progressDeadline()).toBe(before);expect(d.next(s)?.meta.id).toBe("A01");
 });
 it("retains the original expired progress deadline through the actual finite accepted pet response before admitting real travel",()=>{
  const {d,s}=boot(),deadline=d.progressDeadline()!;s.now=5600;
  d.observeProgress({now:s.now,active:true,point:s.world});expect(d.interruptForPetting(s)).toBe(true);d.event("pet",s.now);
  const acknowledgedAt=s.now;
  // The host's real acknowledged reward and response durations; ordinary
  // stationary paint observations are not credited as physical progress.
  const periods=[COMPANION_TIMING.petReward,500,...companionPettingResponse("affectionate",s.preferences).flatMap(clip=>[
    clip==="sniff"||clip==="stretch"||clip==="look"?900:companionPlayDuration(clip),220])];
  for(const duration of periods){s.now+=duration;d.observeProgress({now:s.now,active:true,point:s.world});expect(d.progressDeadline()).toBe(deadline);}
  expect(s.now).toBeGreaterThan(deadline);expect(s.now-acknowledgedAt).toBeGreaterThanOrEqual(5800);
  expect(d.pendingApprovedContinuationReady(s)).toBe(true);
  const offered=d.next(s)!;expect(offered.meta.id).toBe("D157-A");expect(offered.meta.command).toMatchObject({kind:"go",target:"outside"});
  expect(["walk","jump"]).toContain(offered.action?.kind);expect(d.progressDeadline()).toBe(deadline);
 });
 it.each(["C07","G01","S01","C04"])("retains %s actual item/meal/rest/control work instead of cancelling it",id=>{
  const {d,s,issued}=boot(id,false),before={owner:d.current(),deadline:d.progressDeadline(),completed:d.completed()};
  expect(d.interruptForPetting(s)).toBe(false);expect(d.owns(issued.meta)).toBe(true);
  expect({owner:d.current(),deadline:d.progressDeadline(),completed:d.completed()}).toEqual(before);
 });
 it.each(["reserved-item","carry-toy","carry-food","hungry","exhausted","food-goal","OFF","pettingOFF"])("preserves %s ownership at acknowledged interaction",condition=>{
  const {d,s,issued}=boot();
  if(condition==="reserved-item")d.bind(issued.meta,"reserved-real-item");if(condition==="carry-toy")s.carriedToyId="actual-toy";if(condition==="carry-food")s.carriedFoodId="actual-food";
  if(condition==="hungry")s.brain.hunger=.8;if(condition==="exhausted")s.brain.energy=.15;
  if(condition==="food-goal")s.brain.foodGoal={foodId:"actual-food",remaining:1,retryAfter:0};if(condition==="OFF")s.preferences.enabled=false;if(condition==="pettingOFF")s.preferences.petting=false;
  const before=JSON.stringify(s);expect(d.interruptForPetting(s)).toBe(false);expect(d.owns(issued.meta)).toBe(true);expect(JSON.stringify(s)).toBe(before);
 });
 it("does not cancel the active needs-selected routine even if its current command is a pose",()=>{
  const {d,s}=boot();expect(d.startRoutine({id:"routine-nap",label:"actual needs rest",personality:"affectionate",major:false,triggers:["free"],steps:[{kind:"pose",pose:"stretch"},{kind:"sleep",ms:4000}]},s.now)).toBe(true);
  const before=d.current();expect(d.interruptForPetting(s)).toBe(false);expect(d.current()).toEqual(before);expect(d.completed()).toEqual([]);
 });
 it("unaccepted passive hover never invokes the accepted-owner cancellation",()=>{
  const host=readFileSync("components/poster/viewer-companion/viewer-companion.tsx","utf8");
  const affection=host.slice(host.indexOf("    const affection = () => {"),host.indexOf("    const isOtherControl"));
  const hover=host.slice(host.indexOf("    const hover = (event:"),host.indexOf("    const leave ="));
  expect(affection.indexOf("clearForPetting(); personalityDirector.interruptForPetting(petOwnership)")).toBeGreaterThan(0);
  expect(affection.indexOf("interruptForPetting")).toBeLessThan(affection.indexOf('experience(invited ? "reassured" : "petted")'));
  expect(hover).not.toContain("interruptForPetting");
  expect(host).toContain("homeLifeInput(phase, !next.petResponse &&");expect(host).toContain("homeLifeInput(pending.phase, !pending.original.petResponse &&");
  expect(host).toContain("target, petResponse: true");
 });
});

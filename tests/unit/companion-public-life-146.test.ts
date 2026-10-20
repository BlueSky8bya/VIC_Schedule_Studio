import {describe,it,expect} from "vitest";
import {commitAction,createBrain,type CompanionAction,type Platform} from "@/lib/ui/viewer-companion/brain";
import {createCompanionPublicLife} from "@/lib/ui/viewer-companion/public-life";
import {createCompanionPersonalityDirector,type PersonalitySceneInput} from "@/lib/ui/viewer-companion/personality-director";
import {DEFAULT_COMPANION_PREFERENCES,COMPANION_PERSONALITIES} from "@/lib/ui/viewer-companion/preferences";

const room:Platform={id:"companion-home-floor",x:40,y:600,width:360,kind:"floor",manualOnly:true};
const dates:Platform[]=[{id:"public-one",x:450,y:600,width:180,kind:"date"},
  {id:"public-two",x:690,y:555,width:180,kind:"date"},{id:"public-three",x:930,y:600,width:180,kind:"date"}];
function input(personality:PersonalitySceneInput["preferences"]["personality"]="balanced"):PersonalitySceneInput {
 return {world:{x:490,y:600,platformId:dates[0].id,platforms:[room,...dates],width:1400,height:800,animated:true,foods:[]},
  brain:{...createBrain(0,()=>.5),hunger:.1,energy:.95,activeMs:0},
  preferences:{...DEFAULT_COMPANION_PREFERENCES,personality,feeding:true,roam:true,jump:true},now:1000,home:{},toys:[],tv:"off"};
}
function enter(s:ReturnType<typeof input>,life:ReturnType<typeof createCompanionPublicLife>) {
 const arrival:CompanionAction={kind:"jump",target:{x:s.world.x,y:s.world.y,platformId:s.world.platformId},duration:900};
 life.arrive(arrival,{x:350,y:600,platformId:room.id},s);
}

describe("146 a public outing continues as physical daily life",()=>{
 it.each(COMPANION_PERSONALITIES.filter(p=>!["homebody","sleepy"].includes(p)))("%s keeps several proved calendar legs before another optional sofa script",personality=>{
  const s=input(personality),life=createCompanionPublicLife(),actions:CompanionAction[]=[],places=new Set<string>();enter(s,life);
  for(let n=0;n<30;n++) {
   const action=life.next(s);if(!action)break;
   expect(["walk","jump"]).toContain(action.kind);expect(action.target.platformId).not.toMatch(/^companion-home/);
   const plane=s.world.platforms.find(p=>p.id===action.target.platformId)!;
   expect(plane).toBeTruthy();expect(action.target.x).toBeGreaterThanOrEqual(plane.x);expect(action.target.x).toBeLessThanOrEqual(plane.x+plane.width);
   expect(action.target.y).toBe(plane.y);const from={x:s.world.x,y:s.world.y,platformId:s.world.platformId};
   s.brain=commitAction(s.brain,action,s.now);s.now+=action.duration+220;s.brain.activeMs=s.now;
   s.world={...s.world,...action.target};life.arrive(action,from,s);actions.push(action);places.add(s.world.platformId!);
  }
  expect(actions.length).toBeGreaterThanOrEqual(3);expect(places.size).toBeGreaterThanOrEqual(2);
  expect(actions.some(a=>a.kind==="jump")).toBe(true);expect(actions.some(a=>a.kind==="walk")).toBe(true);
  expect(s.now).toBeGreaterThanOrEqual(13000);expect(s.now).toBeLessThan(30000);
  expect(actions.every(a=>!a.play&&!a.living&&!a.foodId)).toBe(true);
 });
 it("balances walking and brisk running on real calendar routes",()=>{
  const s=input(),life=createCompanionPublicLife(),paces=new Set<string>();enter(s,life);
  for(let n=0;n<20;n++){const a=life.next(s);if(!a)break;paces.add(a.pace!);const from={...s.world};s.now+=a.duration+220;s.world={...s.world,...a.target};life.arrive(a,from,s);}
  expect(paces).toEqual(new Set(["amble","scoot"]));
 });
 it("an affectionate outing yields to the person actually reached outside",()=>{
  const s=input("affectionate"),life=createCompanionPublicLife();s.world.pointer={x:s.world.x,y:s.world.y,stableMs:1000};enter(s,life);
  expect(life.next(s)).toBeUndefined();expect(life.next(s)).toBeUndefined();
 });
 it("an upset pet takes the safe path gently instead of demonstrating a run",()=>{
  const s=input("mischievous"),life=createCompanionPublicLife();s.brain.affect={joy:0,frustration:.8,handling:0,handlingQuietMs:0};enter(s,life);
  expect(life.next(s)?.pace).toBe("amble");
 });
 it("jump OFF keeps an actual local walk rather than taking a calendar gap",()=>{
  const s=input(),life=createCompanionPublicLife();s.preferences.jump=false;enter(s,life);
  const a=life.next(s)!;expect(a.kind).toBe("walk");expect(a.target.platformId).toBe(dates[0].id);
 });
 it("does not turn homebody rest into a forced running demonstration",()=>{
  const s=input("homebody"),life=createCompanionPublicLife();enter(s,life);expect(life.next(s)).toBeUndefined();
 });
 it("an awake well-rested sleepy pet has a short gentle public walk",()=>{
  const s=input("sleepy"),life=createCompanionPublicLife();enter(s,life);const a=life.next(s)!;
  expect(["walk","jump"]).toContain(a.kind);expect(a.pace).toBe("amble");expect(a.target.platformId).not.toMatch(/^companion-home/);
 });
 it("sleepy's real fatigue yields to common rest rather than a personality-wide movement quota",()=>{
  const s=input("sleepy"),life=createCompanionPublicLife();s.brain.energy=.5;enter(s,life);expect(life.next(s)).toBeUndefined();
 });
 it.each(["owned","roam-off","disabled","paused","unanimated","hungry","tired","care-goal","episode"])("preserves %s instead of stealing an actual owner",gate=>{
  const s=input(),life=createCompanionPublicLife();enter(s,life);
  if(gate==="roam-off")s.preferences.roam=false;if(gate==="disabled")s.preferences.enabled=false;if(gate==="paused")s.world.paused=true;
  if(gate==="unanimated")s.world.animated=false;if(gate==="hungry")s.brain.hunger=.8;if(gate==="tired")s.brain.energy=.2;
  if(gate==="care-goal")s.brain.foodGoal={foodId:"physical-meal",remaining:3,retryAfter:0};
  if(gate==="episode")s.brain.episode={kind:"meal",phase:"meal",variant:"careful",remaining:1,foodId:"physical-meal",mishapUsed:false,legs:0};
  expect(life.next({...s,owned:gate==="owned"})).toBeUndefined();
 });
 it("does not give a merely proposed or incomplete landing a public-life episode",()=>{
  const s=input(),life=createCompanionPublicLife();expect(life.next(s)).toBeUndefined();
  life.arrive({kind:"jump",target:{x:s.world.x+40,y:s.world.y,platformId:s.world.platformId},duration:900},{x:350,y:600,platformId:room.id},s);
  expect(life.next(s)).toBeUndefined();
 });
 it("uses one real broad calendar ledge when other destinations are unreachable",()=>{
  const s=input(),life=createCompanionPublicLife();s.world.platforms=[room,{...dates[0],width:500}];enter(s,life);
  const a=life.next(s)!;expect(a.kind).toBe("walk");expect(a.target.platformId).toBe(dates[0].id);expect(Math.abs(a.target.x-s.world.x)).toBeGreaterThanOrEqual(48);
  s.now+=24000;expect(life.next(s)).toBeUndefined();
 });
 it("stops admitting optional room-only entertainment once an awake nonhomebody needs a real departure",()=>{
  const s=input("curious");s.now=0;s.world={...s.world,x:150,y:600,platformId:room.id};
  const d=createCompanionPersonalityDirector([{id:"room-only",label:"TV leisure",personality:"curious",major:true,triggers:["free"],steps:[{kind:"go",target:"sofa"},{kind:"watch",ms:1800}]}]);
  s.home.sofa={x:180,y:600,platformId:room.id};const entry=d.next(s)!;d.complete(entry.meta);s.now=8001;s.brain.activeMs=s.now;
  expect(d.next(s)).toBeUndefined();expect(d.active()).toBe(false);
 });
});

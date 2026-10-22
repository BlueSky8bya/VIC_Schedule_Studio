import {describe,it,expect} from "vitest";
import {createBrain,platformLandingX,type Platform} from "@/lib/ui/viewer-companion/brain";
import {createCompanionPersonalityDirector,type PersonalitySceneInput} from "@/lib/ui/viewer-companion/personality-director";
import {createCompanionRoutineArbiter,type CompanionRoutineInput} from "@/lib/ui/viewer-companion/routine-arbiter";
import {planCompanionOutsideRoute,boundedCompanionOutsideObserver,type CompanionOutsideDiagnostic} from "@/lib/ui/viewer-companion/outside-route";
import {COMPANION_PERSONALITY_SCENES,type PersonalitySceneRecipe} from "@/lib/ui/viewer-companion/personality-scene-catalog";
import {DEFAULT_COMPANION_PREFERENCES,COMPANION_PERSONALITIES} from "@/lib/ui/viewer-companion/preferences";
import {getCompanionPersonalityMeal} from "@/lib/ui/viewer-companion/personality-jobs";
import {createCompanionToyPlanner,companionToyFoodPriority} from "@/lib/ui/viewer-companion/toys";
import {createCompanionPersonalityActivity} from "@/lib/ui/viewer-companion/personality-activity";
const floor:Platform={id:"companion-home-floor",x:40,y:600,width:360,kind:"floor",manualOnly:true};
const outside:Platform={id:"actual-public-date",x:450,y:570,width:140,kind:"date"};
function scene(personality:PersonalitySceneInput["preferences"]["personality"]="curious"):CompanionRoutineInput {
 return {world:{x:150,y:floor.y,platformId:floor.id,platforms:[floor,outside],width:1100,height:800,animated:true,foods:[]},
 brain:{...createBrain(0,()=>.5),hunger:.1,energy:.9,activeMs:0,foodGoal:undefined,intention:undefined,episode:undefined},
 preferences:{...DEFAULT_COMPANION_PREFERENCES,personality,roam:true,jump:true,feeding:true,sleep:true,ambientPrank:false},
 now:0,active:true,entryReady:true,home:{floor:{x:180,y:floor.y,platformId:floor.id},box:{x:250,y:floor.y,platformId:floor.id}},toys:[],tv:"off",curtainPhase:"open",
 environment:{date:{y:2026,m:10,d:20},season:"autumn",band:"noon",hour:12,night:false,weather:"clear"}};
}
function enter(d:ReturnType<typeof createCompanionPersonalityDirector>,s:PersonalitySceneInput){const e=d.next(s)!;expect(e.meta.id).toMatch(/^entry-/);d.complete(e.meta);s.now+=e.action!.duration;s.brain.activeMs=s.now;}
function advance(s:PersonalitySceneInput,proposal:NonNullable<ReturnType<ReturnType<typeof createCompanionPersonalityDirector>["next"]>>,d:ReturnType<typeof createCompanionPersonalityDirector>){
 const a=proposal.action!;expect(a).toBeTruthy();s.now+=a.duration;s.brain.activeMs=s.now;
 if(a.kind==="walk"||a.kind==="jump"){s.world={...s.world,...a.target};d.observeProgress({now:s.now,active:true,point:s.world});}
 d.complete(proposal.meta);
}
const source=(id:string)=>COMPANION_PERSONALITY_SCENES.find(r=>r.id===id)!;

describe("143 actual route before departure controls",()=>{
 it("does not admit a lamp-only outing when visible outside supports have no real route",()=>{
  const s=scene();s.world.platforms=[floor,{...outside,x:2500,y:100}];s.environment={...s.environment!,night:true,band:"night"};
  const a=createCompanionRoutineArbiter();expect(a.next(s)).toBeUndefined();s.now=10000;
  expect(a.next(s)).toBeUndefined();expect(a.current()).toBeUndefined();expect(s.tv).toBe("off");
 });
 it.each(["manual","body","control","hide","jump-off"])("rejects an invalid outside %s without inventing a surface",gate=>{
  const s=scene();const target={...outside};if(gate==="manual")target.manualOnly=true;if(gate==="body")target.bodyOnly=true;
  if(gate==="control"||gate==="hide")target.kind=gate;if(gate==="jump-off")s.preferences.jump=false;s.world.platforms=[floor,target];
  expect(planCompanionOutsideRoute(s.world,s.preferences.jump)).toBeUndefined();
 });
 it("preserves the actual pointer projection on a wide outside surface instead of its distant center",()=>{
  const s=scene();const wide={...outside,width:400};s.world.platforms=[floor,wide];s.world.pointer={x:500,y:wide.y,stableMs:500};
  const plan=planCompanionOutsideRoute(s.world,true,[],{pointer:true})!;
  expect(plan.target).toEqual({x:platformLandingX(wide,500),y:wide.y,platformId:wide.id});expect(plan.target.x).not.toBe(wide.x+wide.width/2);expect(plan.route.length).toBeGreaterThan(0);
 });
 it("keeps the pointer's current actual outside support eligible for a same-support approach",()=>{
  const s=scene();s.world={...s.world,x:480,y:outside.y,platformId:outside.id,pointer:{x:550,y:outside.y,stableMs:500}};
  const plan=planCompanionOutsideRoute(s.world,true,[outside.id],{pointer:true})!;
  expect(plan.target.platformId).toBe(outside.id);expect(plan.target.x).toBe(platformLandingX(outside,550));expect(plan.route[0].kind).toBe("walk");
 });
 it("keeps the eight-candidate bound and never logs identities or duplicates a route to diagnose it",()=>{
  const s=scene();s.world.platforms=[floor,...Array.from({length:12},(_,i)=>({...outside,id:`opaque-${i}`,x:2200+i*160,y:100}))];
  const facts:CompanionOutsideDiagnostic[]=[];const tap=boundedCompanionOutsideObserver(f=>facts.push(f))!;
  for(let i=0;i<30;i++)expect(planCompanionOutsideRoute(s.world,true,[],{observe:tap})).toBeUndefined();
  expect(facts).toHaveLength(24);expect(facts.every(f=>f.stage==="proof"&&f.routeLength===null&&f.candidates?.length===8)).toBe(true);
  expect(JSON.stringify(facts)).not.toMatch(/opaque-|platformId|calendar|eventId/);
  expect(()=>planCompanionOutsideRoute(scene().world,true,[],{observe:boundedCompanionOutsideObserver(()=>{throw Error("sink");})})).not.toThrow();
 });
 it("binds the admitted actual goal through a new closer support and all actual route hops",()=>{
  const s=scene("balanced"),a=createCompanionRoutineArbiter(),d=createCompanionPersonalityDirector([]);enter(d,s);a.next(s);s.now+=8000;s.brain.activeMs=s.now;
  const request=a.next(s)!;expect(request.kind).toBe("outing");expect(request.outsideGoal?.id).toBe(outside.id);
  expect(d.startRoutine(request.recipe,s.now,undefined,request.outsideGoal)).toBe(true);
  const closer:Platform={...outside,id:"new-closer",x:405,y:590,width:20};s.world.platforms=[floor,closer,outside];
  const arrivals:string[]=[];
  for(let i=0;i<10&&d.active();i++){const p=d.next(s);if(!p)continue;advance(s,p,d);if(s.world.platformId!==floor.id)arrivals.push(s.world.platformId!);}
  expect(arrivals).not.toHaveLength(0);expect(new Set(arrivals)).toEqual(new Set([outside.id]));expect(d.completed()).toEqual(["routine-outing"]);
 });
 it("missing bound support cancels instead of substituting another outside target or completion",()=>{
  const s=scene("balanced"),a=createCompanionRoutineArbiter(),d=createCompanionPersonalityDirector([]);enter(d,s);a.next(s);s.now+=8000;
  const request=a.next(s)!;expect(d.startRoutine(request.recipe,s.now,undefined,request.outsideGoal)).toBe(true);
  s.world.platforms=[floor,{...outside,id:"other"}];expect(d.next(s)).toBeUndefined();expect(d.active()).toBe(false);expect(d.completed()).toEqual([]);
 });
 it("records a bounded static cancellation from the existing result without exposing the goal identity",()=>{
  const s=scene("balanced"),facts:CompanionOutsideDiagnostic[]=[],a=createCompanionRoutineArbiter(),d=createCompanionPersonalityDirector([],()=>.5,f=>facts.push(f));enter(d,s);a.next(s);s.now+=8000;
  const request=a.next(s)!;expect(d.startRoutine(request.recipe,s.now,undefined,request.outsideGoal)).toBe(true);
  s.world.platforms=[floor];expect(d.next(s)).toBeUndefined();expect(facts.at(-1)).toMatchObject({stage:"routine-finished",outcome:false,reason:"outside-unavailable"});
  expect(JSON.stringify(facts)).not.toContain(outside.id);expect(d.completed()).toEqual([]);
 });
 it("a throwing optional observation sink cannot cancel or prevent an actual outing",()=>{
  const s=scene("balanced"),a=createCompanionRoutineArbiter(),d=createCompanionPersonalityDirector([],()=>.5,()=>{throw Error("observer");});enter(d,s);a.next(s);s.now+=8000;
  const request=a.next(s)!;expect(()=>d.startRoutine(request.recipe,s.now,undefined,request.outsideGoal)).not.toThrow();
  for(let i=0;i<10&&d.active();i++){const p=d.next(s);if(p)advance(s,p,d);}
  expect(d.completed()).toEqual(["routine-outing"]);expect(s.world.platformId).toBe(outside.id);
 });
 it("a rejected departure leaves no owner and a genuine ordinary48px room-floor walk remains available",()=>{
  const s=scene();s.world.platforms=[floor,{...outside,x:3000,y:100}];const a=createCompanionRoutineArbiter(),d=createCompanionPersonalityDirector([]);enter(d,s);a.next(s);s.now+=10000;s.brain.activeMs=s.now;
  expect(a.next(s)).toBeUndefined();expect(a.current()).toBeUndefined();expect(d.next(s)).toBeUndefined();
  const actual=createCompanionPersonalityActivity(()=>0).choose(s.brain,s.world,s.preferences,s.now)!;
  expect(actual.kind).toBe("walk");expect(actual.target.platformId).toBe(floor.id);expect(Math.abs(actual.target.x-s.world.x)).toBeGreaterThanOrEqual(48);expect(actual.target.x).toBeGreaterThanOrEqual(floor.x);expect(actual.target.x).toBeLessThanOrEqual(floor.x+floor.width);
 });
 it("a mandatory outside common routine cannot start without its proven goal",()=>{
  const s=scene(),a=createCompanionRoutineArbiter(),d=createCompanionPersonalityDirector([]);enter(d,s);a.next(s);s.now+=8000;
  const request=a.next(s)!;expect(d.startRoutine(request.recipe,s.now)).toBe(false);expect(d.active()).toBe(false);
 });
});

describe("143 overdue outside choice does not erase real authored work",()=>{
 const tv:PersonalitySceneRecipe={id:"real-tv",label:"optional entertainment",personality:"curious",major:true,triggers:["free"],steps:[{kind:"tv",state:"nature"},{kind:"watch",ms:3000}]};
 function ready(){const s=scene();s.home.tv={x:180,y:600,platformId:floor.id};s.home.contacts={tv:{x:180,y:570}};s.canTv=true;
 const d=createCompanionPersonalityDirector([tv]),a=createCompanionRoutineArbiter();enter(d,s);a.next(s);const p=d.next(s)!;expect(p.meta.id).toBe(tv.id);return{s,d,a};}
 it("a due proved outside route takes one safe checkpoint from TV leisure",()=>{
  const{s,d,a}=ready();s.now+=8000;s.brain.activeMs=s.now;d.observeProgress({now:s.now,active:true,point:{...s.world,x:s.world.x+10}});s.world.x+=10;
  expect(d.routineReserved(s)).toBe(true);expect(d.routineOwnership(s)).toBe("leisure");
  const request=a.next({...s,authoredReserved:true,authoredLeisure:true})!;expect(request.kind).toBe("outing");expect(request.outsideGoal).toBeTruthy();
  expect(d.startRoutine(request.recipe,s.now,undefined,request.outsideGoal)).toBe(true);expect(d.completed()).not.toContain(tv.id);
 });
 it.each(["hard-owner","busy","off","roam-off","not-active","no-route"])("leisure never bypasses %s",gate=>{
  const{s,d,a}=ready();s.now+=8000;s.brain.activeMs=s.now;
  const request={...s,authoredReserved:true,authoredLeisure:true};
  if(gate==="hard-owner")request.owned=true;if(gate==="busy")request.busy=true;if(gate==="off")request.preferences.enabled=false;if(gate==="roam-off")request.preferences.roam=false;if(gate==="not-active")request.active=false;if(gate==="no-route")request.world.platforms=[floor,{...outside,x:3000,y:100}];
  expect(a.next(request)).toBeUndefined();expect(d.current()?.id).toBe(tv.id);
 });
 it.each(["meal","sleep"])("urgent %s remains ahead of due leisure outing",need=>{
  const{s,a}=ready();s.now+=8000;
  if(need==="meal"){s.brain.hunger=.78;s.world.foods=[{id:"actual-meal",kind:"carrot",x:180,y:600,platformId:floor.id}];s.meal={foodId:"actual-meal"};}
  else{s.brain.energy=.18;s.home.sofa={x:100,y:600,platformId:floor.id};}
  expect(a.next({...s,authoredReserved:true,authoredLeisure:true})?.kind).toBe(need==="meal"?"meal":"nap");
 });
 it("real toy work and its same-ID continuation never become leisure",()=>{
  const s=scene("curious");s.toys=[{id:"same",kind:"kaleidoscope",x:180,y:600,platformId:floor.id,held:false,carried:false,angle:0}];
  const d=createCompanionPersonalityDirector([source("C07")]);enter(d,s);expect(d.next(s)?.meta.id).toBe("C07");expect(d.routineOwnership(s)).toBe("work");
 });
});

describe("143 toy admission shares actual executor meal priority",()=>{
 function prepared(){const s=scene("mischievous");s.brain.hunger=.46;s.world.foods=[{id:"real-meal",kind:"carrot",x:180,y:600,platformId:floor.id}];
 s.toys=[{id:"real-ball",kind:"ball",x:200,y:600,platformId:floor.id,held:false,carried:false,angle:0}];
 const d=createCompanionPersonalityDirector([source("M03")]);enter(d,s);d.event("toy-settled",s.now);return{s,d};}
 it("reachable real meal prevents M03's otherwise unexecutable first pounce and admits that actual food",()=>{
  const{s,d}=prepared();expect(companionToyFoodPriority(s.brain,s.world,s.preferences)).toBe(true);expect(d.next(s)).toBeUndefined();expect(d.routineReserved(s)).toBe(false);
  const meal=getCompanionPersonalityMeal(d,undefined,{...s,authoredReserved:false}, s.now);expect(meal).toMatchObject({kind:"eat",foodId:"real-meal"});expect(d.completed()).toEqual([]);
 });
 it.each(["feeding-off","full","blocked-food"])("preserves a valid actual M03 toy goal when %s",gate=>{
  const{s,d}=prepared();if(gate==="feeding-off")s.preferences.feeding=false;if(gate==="full")s.brain.hunger=.2;if(gate==="blocked-food")s.world.foods=[{id:"real-meal",kind:"carrot",x:2000,y:100,platformId:"missing"}];
  expect(companionToyFoodPriority(s.brain,s.world,s.preferences)).toBe(false);expect(d.next(s)?.action?.play).toBe("pounce");expect(d.routineReserved(s)).toBe(true);
 });
 it("new actual food during a preparatory pose releases soft reservation before any delegated retry looks",()=>{
  const{s,d}=prepared();s.world.foods=[];const prep=d.next(s)!;expect(prep.action?.play).toBe("pounce");advance(s,prep,d);
  s.world.foods=[{id:"new-meal",kind:"carrot",x:180,y:600,platformId:floor.id}];expect(d.routineReserved(s)).toBe(false);
  const proposal=d.next(s);expect(getCompanionPersonalityMeal(d,proposal,{...s,authoredReserved:false}, s.now)).toMatchObject({kind:"eat",foodId:"new-meal"});
 });
 it("actual owned carry still keeps a basic meal from replacing its same-ID return",()=>{
  const{s,d}=prepared();const planner=createCompanionToyPlanner();planner.returnCarried("real-ball",s.now);
  expect(getCompanionPersonalityMeal(d,undefined,{...s,carriedToy:"real-ball",ownedJob:true,authoredReserved:false}, s.now)).toBeUndefined();
  expect(planner.active()).toBe(true);
 });
 it.each(COMPANION_PERSONALITIES)("does not weaken %s immediate typed entry for a real meal",personality=>{
  const s=scene(personality);s.brain.hunger=.8;s.world.foods=[{id:"real-meal",kind:"carrot",x:180,y:600,platformId:floor.id}];
  const d=createCompanionPersonalityDirector([source("M03")]);const entry=d.next(s)!;expect(entry.meta.id).toBe(`entry-${personality}`);
  expect(getCompanionPersonalityMeal(d,entry,{...s}, s.now)).toBeUndefined();expect(d.completed()).toEqual([]);
 });
});


describe("143 night departure uses the real lamp without changing its admitted outside goal",()=>{
 function departure(night:boolean,lit:boolean){
  const s=scene("balanced");s.lightLit=lit;s.environment={...s.environment!,night,band:night?"night":"noon"};
  s.home.light={x:s.world.x,y:floor.y,platformId:floor.id};s.home.contacts={light:{x:s.world.x,y:floor.y-60}};
  const a=createCompanionRoutineArbiter(),d=createCompanionPersonalityDirector([]);enter(d,s);a.next(s);s.now+=8000;s.brain.activeMs=s.now;
  const request=a.next(s)!;expect(request.kind).toBe("outing");expect(request.outsideGoal?.id).toBe(outside.id);
  expect(d.startRoutine(request.recipe,s.now,undefined,request.outsideGoal)).toBe(true);
  return{s,d,request};
 }
 it("requests real lamp-OFF contact before departure and waits for its explicit effect ACK",()=>{
  const{s,d,request}=departure(true,true);
  expect(request.recipe.steps).toContainEqual({kind:"light",lit:false,optional:true});
  const lamp=d.next(s)!;expect(lamp.meta.command).toEqual({kind:"light",lit:false,optional:true});
  expect(lamp.meta.interactionContact).toEqual(s.home.contacts!.light);expect(lamp.action?.kind).toBe("play");
  d.complete(lamp.meta);expect(d.current()?.beat).toBe(lamp.meta.beat);expect(d.completed()).toEqual([]);expect(s.lightLit).toBe(true);
  s.now+=lamp.action!.duration;s.brain.activeMs=s.now;s.lightLit=false;d.resolve(lamp.meta,true,undefined,s.now);
  s.world.platforms=[floor,{...outside,id:"new-closer-lamp-after-ACK",x:405,y:590,width:20},outside];
  const targets:string[]=[];
  for(let i=0;i<12&&d.active();i++){const p=d.next(s);if(!p)continue;expect(p.meta.command.kind).not.toBe("light");advance(s,p,d);if(s.world.platformId!==floor.id)targets.push(s.world.platformId!);}
  expect(targets.length).toBeGreaterThan(0);expect(new Set(targets)).toEqual(new Set([request.outsideGoal!.id]));
  expect(d.completed()).toEqual(["routine-outing"]);expect(s.lightLit).toBe(false);
 });
 it("an already-dark room skips lamp work without pretending to acknowledge a control change",()=>{
  const{s,d,request}=departure(true,false);expect(request.recipe.steps).toContainEqual({kind:"light",lit:false,optional:true});
  const first=d.next(s)!;expect(first.meta.command).toEqual({kind:"go",target:"outside"});expect(first.action).toBeTruthy();
  expect(first.meta.interactionContact).toBeUndefined();expect(d.completed()).toEqual([]);expect(s.lightLit).toBe(false);
  for(let i=0,p=first;i<12&&d.active();i++) {expect(p.meta.command.kind).not.toBe("light");advance(s,p,d);const next=d.next(s);if(!next)break;p=next;}
  expect(s.world.platformId).toBe(request.outsideGoal!.id);expect(d.completed()).toEqual(["routine-outing"]);expect(s.lightLit).toBe(false);
 });
 it.each([true,false])("daytime departure preserves its current lamp state %s and contains no lamp request",lit=>{
  const{s,d,request}=departure(false,lit);expect(request.recipe.steps.some(step=>step.kind==="light")).toBe(false);
  const first=d.next(s)!;expect(first.meta.command).toEqual({kind:"go",target:"outside"});expect(first.meta.interactionContact).toBeUndefined();expect(s.lightLit).toBe(lit);
 });
 it("a missing optional actual lamp contact cannot forge an OFF effect or replace the outside goal",()=>{
  const{s,d,request}=departure(true,true);s.home.contacts={};
  const first=d.next(s)!;expect(first.meta.command).toEqual({kind:"go",target:"outside"});expect(first.meta.interactionContact).toBeUndefined();
  expect(s.lightLit).toBe(true);expect(d.completed()).toEqual([]);
  for(let i=0,p=first;i<12&&d.active();i++){advance(s,p,d);const next=d.next(s);if(!next)break;p=next;}
  expect(s.world.platformId).toBe(request.outsideGoal!.id);expect(d.completed()).toEqual(["routine-outing"]);expect(s.lightLit).toBe(true);
 });
});

describe("143 the current required TV watch finishes before optional routine arbitration",()=>{
 function watchReady(recipe:PersonalitySceneRecipe=source("G05")){
  const s=scene("gourmet"),room={...floor,width:720},sofa:Platform={id:"companion-home",x:90,y:560,width:160,kind:"date"};
  s.world={...s.world,platforms:[room,sofa,{...outside,x:850}],x:150};
  s.home.sofa={x:170,y:sofa.y,platformId:sofa.id};s.home.tv={x:650,y:room.y,platformId:room.id};s.home.contacts={tv:{x:650,y:570}};s.canTv=true;
  const d=createCompanionPersonalityDirector([recipe]),a=createCompanionRoutineArbiter();enter(d,s);a.next(s);d.event("meal",s.now);
  for(let i=0;i<20;i++){
   const p=d.next(s);expect(p,`control approach ${i}`).toBeTruthy();
   if(p!.meta.command.kind==="tv"&&!p!.meta.travel){
    expect(p!.action?.kind).toBe("play");expect(p!.meta.interactionContact).toEqual(s.home.contacts.tv);
    s.now+=p!.action!.duration;s.brain.activeMs=s.now;s.tv="cooking";
    d.observeProgress({now:s.now,active:true,point:s.world,controls:{tv:s.tv}});d.resolve(p!.meta,true,undefined,s.now);
    expect(d.current()?.beat).toBe(3);return{s,d,a,tvAckAt:s.now,recipe};
   }
   advance(s,p!,d);
  }
  throw Error("actual TV approach/ACK was not reached");
 }
 const ownership=(s:CompanionRoutineInput,d:ReturnType<typeof createCompanionPersonalityDirector>)=>({...s,authoredReserved:d.routineReserved(s),authoredLeisure:d.routineOwnership(s)==="leisure"});
 it("actual G05 keeps its measured return-to-sofa and full finite watch despite a proved overdue outing and optional toy tail",()=>{
  const{s,d,a,tvAckAt}=watchReady();let travelMs=0,watchMs=0;const hops:string[]=[];
  for(let i=0;i<12&&d.current()?.beat===3;i++){
   expect(d.routineReserved(s)).toBe(true);expect(d.routineOwnership(s)).toBe("work");
   expect(planCompanionOutsideRoute(s.world,s.preferences.jump)).toBeTruthy();expect(a.next(ownership(s,d))).toBeUndefined();
   const p=d.next(s)!;expect(p.meta.id).toBe("G05");expect(p.meta.command).toEqual({kind:"watch",ms:3000});
   if(p.meta.travel){expect(["walk","jump"]).toContain(p.action!.kind);travelMs+=p.action!.duration;hops.push(p.action!.target.platformId!);advance(s,p,d);}
   else{expect(s.world.platformId).toBe(s.home.sofa!.platformId);expect(p.action).toMatchObject({kind:"look",duration:3000});watchMs=p.action!.duration;advance(s,p,d);}
  }
  expect(travelMs).toBeGreaterThan(3500);expect(hops).toContain(s.home.sofa!.platformId);expect(watchMs).toBe(3000);
  expect(s.now-tvAckAt).toBeGreaterThan(6500);expect(d.current()?.beat).toBe(4);
  // The optional absent toy tail neither delays departure nor fabricates a toy effect.
  expect(d.routineReserved(s)).toBe(false);expect(d.routineOwnership(s)).toBeUndefined();
  expect(a.next(ownership(s,d))?.kind).toBe("outing");expect(s.toys).toEqual([]);expect(s.world.foods).toEqual([]);
 });
 it("watch ownership and an elapsed look completion grant no actual-progress clock credit",()=>{
  const{s,d}=watchReady();
  for(let i=0;i<10;i++){
   const p=d.next(s)!;
   if(p.meta.travel){advance(s,p,d);continue;}
   const before=d.progressDeadline();expect(p.action?.kind).toBe("look");expect(d.routineOwnership(s)).toBe("work");
   expect(d.progressDeadline()).toBe(before);advance(s,p,d);expect(d.progressDeadline()).toBe(before);return;
  }
  throw Error("actual sofa watch was not reached");
 });
 it.each(["tv-off","missing-sofa","missing-tv","removed-sofa","removed-tv","body-sofa","control-tv","nonfinite-sofa","outside-span","off","roam-off","paused","busy","selected-changed"])("does not reserve an invalid current TV watch: %s",gate=>{
  const{s,d}=watchReady();
  if(gate==="tv-off")s.tv="off";if(gate==="missing-sofa")s.home.sofa=undefined;if(gate==="missing-tv")s.home.tv=undefined;
  if(gate==="removed-sofa")s.world.platforms=s.world.platforms.filter(p=>p.id!==s.home.sofa!.platformId);
  if(gate==="removed-tv"){s.home.tv={x:650,y:600,platformId:"removed-real-tv"};}
  if(gate==="body-sofa")s.world.platforms=s.world.platforms.map(p=>p.id===s.home.sofa!.platformId?{...p,bodyOnly:true}:p);
  if(gate==="control-tv")s.world.platforms=s.world.platforms.map(p=>p.id===s.home.tv!.platformId?{...p,kind:"control"}:p);
  if(gate==="nonfinite-sofa")s.home.sofa!.x=NaN;if(gate==="outside-span")s.home.sofa!.x=500;
  if(gate==="off")s.preferences.enabled=false;if(gate==="roam-off")s.preferences.roam=false;if(gate==="paused")s.world.paused=true;if(gate==="busy")s.busy=true;if(gate==="selected-changed")s.preferences.personality="curious";
  expect(d.routineReserved(s)).toBe(false);expect(d.routineOwnership(s)).toBeUndefined();expect(d.completed()).toEqual([]);
 });
 it.each(["optional-watch","departed-for-audience"])("does not upgrade %s into mandatory TV work",variant=>{
  const original=source("G05");
  const recipe:PersonalitySceneRecipe={...original,steps:original.steps.map((step,i)=>i===3?{...step,optional:variant==="optional-watch"}:step)};
  if(variant==="departed-for-audience")recipe.steps=[{kind:"go",target:"outside"},{kind:"go",target:"sofa"},...original.steps.slice(2)];
  const{s,d}=watchReady(recipe);
  // Pass the existing3.5s accepted-control closure without granting fresh credit.
  s.now+=3501;s.brain.activeMs=s.now;expect(d.routineReserved(s)).toBe(false);expect(d.routineOwnership(s)).toBeUndefined();
 });
 it.each(["stall","absolute"])("existing %s expiry remains a hard bound on TV observation ownership",limit=>{
  const{s,d}=watchReady();s.now+=limit==="stall"?7501:60001;s.brain.activeMs=s.now;
  // A newly observed real move defeats the stall predicate; it must still
  // never renew the separate absolute scene budget.
  if(limit==="absolute"){s.world.x+=8;d.observeProgress({now:s.now,active:true,point:s.world});}
  expect(d.routineReserved(s)).toBe(false);expect(d.routineOwnership(s)).toBeUndefined();expect(d.completed()).toEqual([]);
 });
 it("a reservation never bypasses the existing upcoming-watch physical-progress deadline",()=>{
  const{s,d}=watchReady();
  for(let i=0;i<10;i++){
   const p=d.next(s)!;
   if(p.meta.travel){advance(s,p,d);continue;}
   expect(p.action?.kind).toBe("look");const deadline=d.progressDeadline();
   s.now+=5001;s.brain.activeMs=s.now;expect(d.routineOwnership(s)).toBe("work");
   expect(d.next(s)).toBeUndefined();expect(d.active()).toBe(false);expect(d.completed()).toEqual([]);expect(d.progressDeadline()).toBe(deadline);return;
  }
  throw Error("actual sofa watch was not reached");
 });
 it.each(["meal","sleep"])("genuine urgent %s can supersede the current watch at its existing safe checkpoint",need=>{
  const{s,d,a}=watchReady();
  if(need==="meal"){s.brain.hunger=.78;s.world.foods=[{id:"urgent-existing-food",kind:"carrot",x:650,y:600,platformId:floor.id}];s.meal={foodId:"urgent-existing-food"};}
  else s.brain.energy=.18;
  expect(d.routineOwnership(s)).toBe("work");const request=a.next(ownership(s,d))!;expect(request.kind).toBe(need==="meal"?"meal":"nap");
  expect(d.startRoutine(request.recipe,s.now,request.itemId,request.outsideGoal)).toBe(true);expect(d.current()?.id).toBe(`routine-${request.kind}`);expect(d.completed()).toEqual([]);
 });
 it.each(["hard-owner","carried-toy","sleep-off"])("no watch reservation bypasses %s authority",gate=>{
  const{s,d,a}=watchReady();s.brain.energy=.18;const input=ownership(s,d);
  if(gate==="hard-owner")input.owned=true;if(gate==="carried-toy")input.carriedToyId="actual-carried";if(gate==="sleep-off")input.preferences.sleep=false;
  expect(a.next(input)).toBeUndefined();expect(d.current()?.id).toBe("G05");expect(d.completed()).toEqual([]);
 });
});

describe("143 a real meal's existing cue survives necessary wash before one reachable after-meal goal",()=>{
 function context(recipes:readonly PersonalitySceneRecipe[]=[source("G05"),source("X-G-house"),source("G12")],rng=()=>.5,priorMinor=false){
  const s=scene("gourmet"),room={...floor,width:720},sofa:Platform={id:"companion-home",x:90,y:560,width:160,kind:"date"};
  const pad:Platform={id:"companion-home-floor-400",x:286,y:530,width:28,kind:"floor",bodyOnly:true};
  s.world={...s.world,platforms:[room,sofa,pad,{...outside,x:850}],x:205,foods:[{id:"same-real-meal",kind:"carrot",x:205,y:600,platformId:room.id}]};
  s.home={...s.home,sofa:{x:170,y:560,platformId:sofa.id},pad:{x:300,y:530,platformId:pad.id},tv:{x:650,y:600,platformId:room.id},contacts:{tv:{x:650,y:570}}};
  s.canTv=true;s.brain.hunger=.6;s.meal={foodId:"same-real-meal"};
  const d=createCompanionPersonalityDirector(recipes,rng),a=createCompanionRoutineArbiter();enter(d,s);let mealAt=-1,washed=0;
  if(priorMinor){
   const actualFood=s.world.foods;s.world.foods=[];s.brain.hunger=.1;
   for(let i=0;i<6;i++){const p=d.next(s);if(!p)break;expect(p.meta.id).toBe("G12");advance(s,p,d);if(!d.active())break;}
   expect(d.completed()).toEqual(["G12"]);s.world.foods=actualFood;s.brain.hunger=.6;
  }
  const request=a.next(s)!;expect(request.kind).toBe("meal");expect(request.itemId).toBe("same-real-meal");expect(d.startRoutine(request.recipe,s.now,request.itemId)).toBe(true);
  function actualRoutine(){
   for(let i=0;i<28&&d.active();i++){
    const p=d.next(s);if(!p)continue;
    if(p.delegate){
     expect(p.meta.itemId).toBe("same-real-meal");expect(s.world.foods?.map(food=>food.id)).toEqual(["same-real-meal"]);
     s.now+=p.delegate.mode==="eat"?3000:900;s.brain.activeMs=s.now;
     if(p.delegate.mode==="eat"){s.world.foods=[];s.brain.hunger=.1;mealAt=s.now;a.observe("ate",s.now);d.event("meal",s.now);}
     d.resolve(p.meta,true,"same-real-meal",s.now);
    }else if(p.meta.command.kind==="wash"&&!p.meta.travel){
     expect(s.world.platformId).toBe(pad.id);expect(p.action?.duration).toBeGreaterThanOrEqual(500);
     s.now+=p.action!.duration;s.brain.activeMs=s.now;d.resolve(p.meta,true,undefined,s.now);a.observe("washed",s.now);washed++;
    }else advance(s,p,d);
   }
   expect(d.active()).toBe(false);
  }
  actualRoutine();s.meal=undefined;const wash=a.next(s)!;expect(wash.kind).toBe("wash");expect(d.startRoutine(wash.recipe,s.now)).toBe(true);actualRoutine();
  expect(washed).toBe(1);expect(mealAt).toBeGreaterThan(0);expect(s.now-mealAt).toBeGreaterThan(8000);expect(s.now-mealAt).toBeLessThan(15000);
  expect(d.completed()).toEqual([...(priorMinor?["G12"]:[]),"routine-meal","routine-wash"]);return{s,d,a,mealAt};
 }
 const requestInput=(s:CompanionRoutineInput,d:ReturnType<typeof createCompanionPersonalityDirector>)=>({...s,authoredReserved:d.routineReserved(s),authoredLeisure:d.routineOwnership(s)==="leisure",canOuting:!d.cleanupPending(s)&&!d.mealFollowupReady(s)});
 it("the original runtime order would depart and expire the cue, while the new shared eligibility admits actual G05 first",()=>{
  const{s,d,a,mealAt}=context();expect(d.mealFollowupReady(s)).toBe(true);
  expect(planCompanionOutsideRoute(s.world,true)).toBeTruthy();expect(a.next(requestInput(s,d))).toBeUndefined();
  const first=d.next(s)!;expect(first.meta.id).toBe("G05");expect(first.action?.play).toBe("groom");expect(first.meta.id).not.toBe("X-G-house");
  let watched=0,control=0;
  for(let i=0,p=first;i<24&&d.active();i++){
   if(p.meta.command.kind==="tv"&&!p.meta.travel){s.now+=p.action!.duration;s.brain.activeMs=s.now;s.tv="cooking";d.observeProgress({now:s.now,active:true,point:s.world,controls:{tv:s.tv}});d.resolve(p.meta,true,undefined,s.now);control++;}
   else{if(p.meta.command.kind==="watch"&&!p.meta.travel){expect(p.action).toMatchObject({kind:"look",duration:3000});watched+=p.action!.duration;}advance(s,p,d);}
   const next=d.next(s);if(!next)break;p=next;
  }
  expect(control).toBe(1);expect(watched).toBe(3000);expect(d.completed()).toContain("G05");expect(d.mealFollowupReady(s)).toBe(false);
  expect(s.now-mealAt).toBeGreaterThan(15000);expect(s.world.foods).toEqual([]);expect(a.next(requestInput(s,d))?.kind).toBe("outing");
 });
 it("the unchanged15s cue genuinely expires if no valid after-meal claim occurs",()=>{
  const{s,d,a,mealAt}=context();s.now=mealAt+15000;s.brain.activeMs=s.now;d.observeProgress({now:s.now,active:true,point:s.world});
  expect(d.mealFollowupReady(s)).toBe(false);expect(a.next(requestInput(s,d))?.kind).toBe("outing");expect(d.completed()).not.toContain("G05");
 });
 it("a prior real minor choice cannot let the shared minor alias consume this meal before its eligible major follow-up",()=>{
  const{s,d}=context(undefined,undefined,true);expect(d.mealFollowupReady(s)).toBe(true);
  expect(d.next(s)?.meta.id).toBe("G05");
 });
 it("already-cooking TV still permits a genuine sofa watch, without any new control effect or fabricated ACK",()=>{
  const{s,d}=context();s.tv="cooking";expect(d.mealFollowupReady(s)).toBe(true);let watchMs=0,controlOffers=0;
  for(let i=0;i<14;i++){
   const p=d.next(s);if(!p)break;expect(p.meta.id).toBe("G05");
   if(p.meta.command.kind==="tv"&&!p.meta.travel)controlOffers++;
   expect(p.meta.command.kind).not.toBe("tv");
   if(p.meta.command.kind==="watch"&&!p.meta.travel){expect(s.world.platformId).toBe(s.home.sofa!.platformId);watchMs+=p.action!.duration;}
   advance(s,p,d);
  }
  expect(controlOffers).toBe(0);expect(watchMs).toBe(3000);expect(d.completed()).toContain("G05");expect(s.tv).toBe("cooking");
 });
 it("repeated readiness queries leave event consumption, selection, serial, cursor, IDs, progress and random draws unchanged",()=>{
  let drawsA=0,drawsB=0;const one=context(undefined,()=>{drawsA++;return .5;}),two=context(undefined,()=>{drawsB++;return .5;});
  const before={current:one.d.current(),completed:one.d.completed(),deadline:one.d.progressDeadline(),draws:drawsA};
  for(let i=0;i<30;i++)expect(one.d.mealFollowupReady(one.s)).toBe(true);
  expect({current:one.d.current(),completed:one.d.completed(),deadline:one.d.progressDeadline(),draws:drawsA}).toEqual(before);
  expect(one.d.next(one.s)).toEqual(two.d.next(two.s));expect(drawsA).toBe(drawsB);
 });
 it.each(["can-tv-off","missing-contact","missing-sofa","no-roundtrip","not-full","exhausted","food-owner","carried-food","carried-toy","off","roam-off","paused","busy","changed-personality","invalid-needs"])("does not defer real outside life for an invalid after-meal promise: %s",gate=>{
  const{s,d}=context();
  if(gate==="can-tv-off")s.canTv=false;if(gate==="missing-contact")s.home.contacts={};if(gate==="missing-sofa")s.home.sofa=undefined;
  if(gate==="no-roundtrip"){const lost:Platform={id:"isolated-real-tv-floor",x:2500,y:100,width:100,kind:"floor"};s.world.platforms=[...s.world.platforms,lost];s.home.tv={x:2550,y:100,platformId:lost.id};}
  if(gate==="not-full")s.brain.hunger=.35;if(gate==="exhausted")s.brain.energy=.18;if(gate==="food-owner")s.brain.foodGoal={foodId:"other-real-food",remaining:4,retryAfter:s.now};
  if(gate==="carried-food")s.carriedFoodId="physical-food";if(gate==="carried-toy")s.carriedToyId="physical-toy";
  if(gate==="off")s.preferences.enabled=false;if(gate==="roam-off")s.preferences.roam=false;if(gate==="paused")s.world.paused=true;if(gate==="busy")s.busy=true;if(gate==="changed-personality")s.preferences.personality="balanced";if(gate==="invalid-needs")s.brain.hunger=NaN;
  expect(d.mealFollowupReady(s)).toBe(false);expect(d.current()).toBeUndefined();expect(d.completed()).toEqual(["routine-meal","routine-wash"]);
 });
 it("an unrouteable major promise cannot suppress a valid minor event or actual departure",()=>{
  const minor:PersonalitySceneRecipe={id:"minor-meal-context",label:"finite private follow-up",personality:"gourmet",major:false,triggers:["meal"],steps:[{kind:"pose",pose:"stretch"}]};
  const{s,d,a}=context([minor,source("G05")]);
  const isolated:Platform={id:"isolated-tv",x:2500,y:100,width:100,kind:"floor"};s.world.platforms=[...s.world.platforms,isolated];s.home.tv={x:2550,y:100,platformId:isolated.id};
  expect(d.mealFollowupReady(s)).toBe(false);expect(d.next(s)?.meta.id).toBe(minor.id);
  expect(a.next({...s,canOuting:true,authoredReserved:false})?.kind).toBe("outing");
 });
 it.each(["meal","sleep"])("after-meal readiness never supersedes genuinely urgent %s",need=>{
  const{s,d,a}=context();
  if(need==="meal"){s.brain.hunger=.78;s.world.foods=[{id:"new-urgent-real-food",kind:"carrot",x:s.world.x,y:s.world.y,platformId:s.world.platformId}];s.meal={foodId:"new-urgent-real-food"};}
  else s.brain.energy=.18;
  expect(d.mealFollowupReady(s)).toBe(false);expect(a.next(requestInput(s,d))?.kind).toBe(need==="meal"?"meal":"nap");
 });
 it("hard work remains absolute while a valid fresh meal context is merely pending",()=>{
  const{s,d,a}=context();expect(d.mealFollowupReady(s)).toBe(true);expect(a.next({...requestInput(s,d),owned:true})).toBeUndefined();expect(d.current()).toBeUndefined();
 });
 it("one same cue cannot be consumed twice even when both after-meal goals still fit within15s",()=>{
  const short:PersonalitySceneRecipe={id:"short-required-tv-observation",label:"one real control and watch",personality:"gourmet",major:true,triggers:["meal"],steps:[{kind:"tv",state:"cooking"},{kind:"watch",ms:650}]};
  const s=scene("gourmet");s.home.sofa={x:s.world.x,y:s.world.y,platformId:floor.id};s.home.tv={...s.home.sofa};s.home.contacts={tv:{x:s.world.x,y:s.world.y-30}};s.canTv=true;
  const d=createCompanionPersonalityDirector([short,{...short,id:"same-cue-second-goal"}]);enter(d,s);d.event("meal",s.now);const at=s.now;
  expect(d.mealFollowupReady(s)).toBe(true);const tv=d.next(s)!;s.now+=tv.action!.duration;s.brain.activeMs=s.now;s.tv="cooking";d.resolve(tv.meta,true,undefined,s.now);
  const watch=d.next(s)!;expect(watch.meta.command.kind).toBe("watch");advance(s,watch,d);s.tv="off";
  expect(s.now-at).toBeLessThan(15000);expect(d.completed()).toEqual([short.id]);expect(d.mealFollowupReady(s)).toBe(false);expect(d.next(s)).toBeUndefined();
 });
 function completedGoalThenRealNewMeal(minors=0,intermediateMinor=false){
  const extras:PersonalitySceneRecipe[]=Array.from({length:minors},(_,i)=>({id:`actual-other-minor-${i}`,label:"different private observation",personality:"gourmet",major:false,triggers:["free"],steps:[{kind:"pose",pose:i%2?"stretch":"sniff"}]}));
  const{s,d,a}=context([source("G05"),...extras]);
  for(let i=0;i<24;i++){
   const p=d.next(s);if(!p)break;expect(p.meta.id).toBe("G05");
   if(p.meta.command.kind==="tv"&&!p.meta.travel){s.now+=p.action!.duration;s.brain.activeMs=s.now;s.tv="cooking";d.observeProgress({now:s.now,active:true,point:s.world,controls:{tv:s.tv}});d.resolve(p.meta,true,undefined,s.now);}
   else advance(s,p,d);
  }
  expect(d.active()).toBe(false);expect(d.completed().at(-1)).toBe("G05");
  if(intermediateMinor){const p=d.next(s)!;expect(p.meta.id).toMatch(/^actual-other-minor-/);advance(s,p,d);expect(d.active()).toBe(false);}
  // Let the independent existing12s same-place family cooldown expire;
  // the completed-ID filter must be the remaining admission boundary.
  s.now+=12001;s.brain.activeMs=s.now;d.observeProgress({now:s.now,active:true,point:s.world});
  // This is a later basic same-ID meal, not another authored scene that
  // would overwrite lastCompleted. It is the real caller shape in question.
  s.brain.hunger=.6;s.world.foods=[{id:"later-same-id-meal",kind:"carrot",x:s.world.x,y:s.world.y,platformId:s.world.platformId}];
  const meal=getCompanionPersonalityMeal(d,undefined,{world:s.world,brain:s.brain,preferences:s.preferences,now:s.now,authoredReserved:false}, s.now)!;
  expect(meal).toMatchObject({kind:"eat",foodId:"later-same-id-meal"});s.now+=meal.duration;s.brain.activeMs=s.now;s.world.foods=[];s.brain.hunger=.1;
  d.observeEffect("food",s.now);d.event("meal",s.now);a.observe("ate",s.now);
  return{s,d,a};
 }
 it("an available last-completed goal with no choosable alternative cannot create a phantom15s outing hold",()=>{
  const{s,d,a}=completedGoalThenRealNewMeal();expect(d.mealFollowupReady(s)).toBe(false);expect(d.next(s)).toBeUndefined();
  expect(a.next(requestInput(s,d))?.kind).toBe("outing");expect(d.completed().filter(id=>id==="G05")).toHaveLength(1);
 });
 it("last-completed anti-repeat and an eligible minor remain identical between readiness and actual selection",()=>{
  const{s,d}=completedGoalThenRealNewMeal(1);expect(d.mealFollowupReady(s)).toBe(false);expect(d.next(s)?.meta.id).toBe("actual-other-minor-0");
 });
 it("recent-completed filtering also prevents a phantom reservation when a different eligible minor exists",()=>{
  const{s,d}=completedGoalThenRealNewMeal(2,true);expect(d.mealFollowupReady(s)).toBe(false);expect(d.next(s)?.meta.id).toMatch(/^actual-other-minor-/);
 });
});

describe("143 a genuinely completed required TV observation closes its same-owner finite tail",()=>{
 type ClosureDirector143=ReturnType<typeof createCompanionPersonalityDirector>;
 function closureReady143(recipe:PersonalitySceneRecipe=source("C04"),requiredTail=true){
  // Generic required-tail safety regression. Actual C04/X-C-house bows are
  // optional by the user's145 instruction; keep the old ownership negatives
  // against an explicit required fixture instead of forcing product gestures.
  if(requiredTail)recipe={...recipe,steps:recipe.steps.map((step,index)=>index===recipe.steps.length-1?{...step,optional:false}:step)};
  const s=scene("curious"),room={...floor,width:720},sofa:Platform={id:"companion-home",x:90,y:560,width:160,kind:"date"};
  s.world={...s.world,platforms:[room,sofa,{...outside,x:850}],x:150};
  s.home.sofa={x:170,y:sofa.y,platformId:sofa.id};s.home.tv={x:650,y:room.y,platformId:room.id};s.home.contacts={tv:{x:650,y:570}};s.canTv=true;
  const d=createCompanionPersonalityDirector([recipe],()=>.5),a=createCompanionRoutineArbiter();enter(d,s);a.next(s);
  let controls=0,watchOne=0,lastControlAt=0;
  const lastWatch=recipe.steps.reduce((last,step,index)=>step.kind==="watch"?index:last,-1);
  for(let i=0;i<40;i++){
   const p=d.next(s);expect(p,`required source scene step ${i}`).toBeTruthy();
   if(p!.meta.beat===lastWatch&&!p!.meta.travel)return{s,d,a,p:p!,controls,watchOne,lastControlAt,recipe};
   if(p!.meta.command.kind==="tv"&&!p!.meta.travel){
    s.now+=p!.action!.duration;s.brain.activeMs=s.now;s.tv=p!.meta.command.state==="next"?"toys":p!.meta.command.state;
    d.observeProgress({now:s.now,active:true,point:s.world,controls:{tv:s.tv}});d.resolve(p!.meta,true,undefined,s.now);controls++;lastControlAt=s.now;
   }else{if(p!.meta.command.kind==="watch"&&!p!.meta.travel)watchOne+=p!.action!.duration;advance(s,p!,d);}
  }
  throw Error("second actual TV observation was not reached");
 }
 function closureFinish143(c:ReturnType<typeof closureReady143>,change:Partial<NonNullable<Parameters<ClosureDirector143["complete"]>[1]>>={}){
  const{s,d,p}=c,duration=p.action!.duration;
  s.now+=duration;s.brain.activeMs=s.now;d.observeProgress({now:s.now,active:true,point:s.world});
  const witness={at:s.now,success:true,active:true,tv:s.tv,point:{x:s.world.x,y:s.world.y,platformId:s.world.platformId},duration,elapsedMs:duration,paintedMs:duration-50,...change};
  d.complete(p.meta,witness);return witness;
 }
 function closureOwnership143(c:ReturnType<typeof closureReady143>){return{...c.s,authoredReserved:c.d.routineReserved(c.s),authoredLeisure:c.d.routineOwnership(c.s)==="leisure"};}
 it.each(["C04","X-C-house"])("keeps an explicitly required %s test tail after real controls, both finite watches and a long sofa approach",id=>{
  const c=closureReady143(source(id)),{s,d,a}=c;expect(c.controls).toBe(2);expect(c.watchOne).toBe(1400);
  expect(s.now-c.lastControlAt).toBeGreaterThan(3500);expect(c.p.action).toMatchObject({kind:"look",duration:id==="C04"?3000:2600});
  const deadline=d.progressDeadline();closureFinish143(c);
  expect(d.current()?.beat).toBe(5);expect(d.routineReserved(s)).toBe(true);expect(d.routineOwnership(s)).toBe("work");
  expect(a.next(closureOwnership143(c))).toBeUndefined();expect(d.progressDeadline()).toBe(deadline);
  const bow=d.next(s)!;expect(bow.meta.command).toMatchObject({kind:"pose",pose:"bow"});expect(bow.action).toMatchObject({kind:"play",play:"bow"});
  advance(s,bow,d);expect(d.completed()).toEqual([id]);expect(d.progressDeadline()).toBe(deadline);
 });
 it.each(["C04","X-C-house"])("actual %s leaves its decorative bow optional after required TV work",id=>{
  const recipe=source(id);expect(recipe.steps.at(-1)).toMatchObject({kind:"pose",pose:"bow",optional:true});
  expect(recipe.steps.filter(step=>step.kind==="tv"||step.kind==="watch").every(step=>!step.optional)).toBe(true);
  const c=closureReady143(recipe,false);expect(c.controls).toBe(2);expect(c.watchOne).toBe(1400);closureFinish143(c);
  // A due outing may replace optional leisure; no greeting is required first.
  expect(c.d.routineReserved(c.s)).toBe(false);expect(c.a.next(closureOwnership143(c))?.kind).toBe("outing");
 });
 it("uses the actual required-TV work contract rather than an authored recipe ID",()=>{
  const c=closureReady143({...source("C04"),id:"another-real-two-channel-observation"});closureFinish143(c);
  expect(c.d.routineOwnership(c.s)).toBe("work");expect(c.a.next(closureOwnership143(c))).toBeUndefined();
 });
 it("keeps the real C04 cold first paint separate from its completed3000ms playback",()=>{
  const c=closureReady143(),deadline=c.d.progressDeadline();closureFinish143(c,{paintedMs:2883.2});
  expect(c.d.routineOwnership(c.s)).toBe("work");expect(c.a.next(closureOwnership143(c))).toBeUndefined();expect(c.d.progressDeadline()).toBe(deadline);
 });
 it("an elapsed offer without the runtime decoded-paint completion still yields to a due real outing",()=>{
  const c=closureReady143(),{s,d,a,p}=c;s.now+=p.action!.duration;s.brain.activeMs=s.now;d.observeProgress({now:s.now,active:true,point:s.world});
  const deadline=d.progressDeadline();d.complete(p.meta);expect(d.routineReserved(s)).toBe(false);expect(d.progressDeadline()).toBe(deadline);
  expect(a.next(closureOwnership143(c))?.kind).toBe("outing");expect(d.completed()).toEqual([]);
 });
 it("uses the existing presentation playback witness while closure time remains on the250ms batched active clock",()=>{
  const c=closureReady143(),{s,d,p}=c,duration=p.action!.duration;
  s.now+=duration-150;s.brain.activeMs=s.now;d.observeProgress({now:s.now,active:true,point:s.world});
  const deadline=d.progressDeadline();d.complete(p.meta,{at:s.now,success:true,active:true,tv:s.tv,point:s.world,duration,elapsedMs:duration,paintedMs:duration-50});
  expect(d.routineOwnership(s)).toBe("work");expect(d.progressDeadline()).toBe(deadline);
 });
 it.each(["no-paint","short-paint","invalid-paint","wrong-duration","failed","inactive","tv-off","point-drift","wrong-support","old","nan","infinity"])("does not recharge closure from %s completion evidence",gate=>{
  const c=closureReady143(),duration=c.p.action!.duration,at=c.s.now+duration;
  const change:Partial<NonNullable<Parameters<ClosureDirector143["complete"]>[1]>>={};
  if(gate==="no-paint")change.paintedMs=0;if(gate==="short-paint")change.paintedMs=duration*.8-81;if(gate==="invalid-paint")change.paintedMs=NaN;
  if(gate==="wrong-duration")change.duration=duration+1;if(gate==="failed")change.success=false;if(gate==="inactive")change.active=false;if(gate==="tv-off")change.tv="off";
  if(gate==="point-drift")change.point={...c.s.world,x:c.s.world.x+3};if(gate==="wrong-support")change.point={...c.s.world,platformId:floor.id};
  if(gate==="old")change.at=at-1;if(gate==="nan")change.at=NaN;if(gate==="infinity")change.at=Infinity;
  const deadline=c.d.progressDeadline();closureFinish143(c,change);
  expect(c.d.current()?.beat).toBe(5);expect(c.d.routineReserved(c.s)).toBe(false);expect(c.d.progressDeadline()).toBe(deadline);expect(c.d.completed()).toEqual([]);
 });
 it("does not accept even a claimed full paint before the offered finite observation has elapsed",()=>{
  const c=closureReady143(),{s,d,p}=c,duration=p.action!.duration;s.now+=duration-1;s.brain.activeMs=s.now;d.observeProgress({now:s.now,active:true,point:s.world});
  d.complete(p.meta,{at:s.now,success:true,active:true,tv:s.tv,point:s.world,duration,elapsedMs:duration-1,paintedMs:duration-1});expect(d.routineReserved(s)).toBe(false);
 });
 it.each(["wrong-serial","wrong-beat","travel"])("does not advance or retain a %s callback as a real watch closure",gate=>{
  const c=closureReady143(),{s,d,p}=c,duration=p.action!.duration;s.now+=duration;s.brain.activeMs=s.now;d.observeProgress({now:s.now,active:true,point:s.world});
  const meta={...p.meta};if(gate==="wrong-serial")meta.serial++;if(gate==="wrong-beat")meta.beat++;if(gate==="travel")meta.travel=true;
  d.complete(meta,{at:s.now,success:true,active:true,tv:s.tv,point:s.world,duration,elapsedMs:duration,paintedMs:duration-50});expect(d.current()?.beat).toBe(4);
  d.complete(p.meta);expect(d.routineReserved(s)).toBe(false);expect(d.completed()).toEqual([]);
 });
 it("does not grant another recipe the completed watch's same-serial closure",()=>{
  const c=closureReady143(),{s,d,p}=c,duration=p.action!.duration;s.now+=duration;s.brain.activeMs=s.now;d.observeProgress({now:s.now,active:true,point:s.world});
  d.complete({...p.meta,id:"another-recipe"},{at:s.now,success:true,active:true,tv:s.tv,point:s.world,duration,elapsedMs:duration,paintedMs:duration-50});
  expect(d.routineReserved(s)).toBe(false);expect(d.completed()).toEqual([]);
 });
 it.each(["optional","manual-tv-lease"])("does not upgrade %s observation into a required-TV completion",gate=>{
  const recipe=source("C04");const changed=gate==="optional"?{...recipe,steps:recipe.steps.map((step,index)=>index===4?{...step,optional:true}:step)}:recipe;
  const c=closureReady143(changed);
  if(gate==="manual-tv-lease"){c.s.canTv=false;c.p=c.d.next(c.s)!;}
  closureFinish143(c);expect(c.d.routineReserved(c.s)).toBe(false);expect(c.d.completed()).toEqual([]);
 });
 it("a prior watch callback cannot recharge the owner after a real urgent routine replaces it",()=>{
  const c=closureReady143(),{s,d,a,p}=c;s.brain.energy=.18;
  const request=a.next(closureOwnership143(c))!;expect(request.kind).toBe("nap");expect(d.startRoutine(request.recipe,s.now,request.itemId,request.outsideGoal)).toBe(true);
  closureFinish143(c);expect(d.current()?.id).toBe("routine-nap");expect(d.current()?.beat).toBe(0);expect(d.completed()).toEqual([]);expect(p.meta.id).toBe("C04");
 });
 it("does not extend the existing3500ms tail ownership window or the physical-progress deadline",()=>{
  const c=closureReady143(),deadline=c.d.progressDeadline();closureFinish143(c);expect(c.d.routineReserved(c.s)).toBe(true);
  c.s.now+=3501;c.s.brain.activeMs=c.s.now;expect(c.d.routineReserved(c.s)).toBe(false);expect(c.d.progressDeadline()).toBe(deadline);
 });
 it("a repeated callback for the completed previous beat cannot renew its original short closure",()=>{
  const c=closureReady143(),witness=closureFinish143(c);c.s.now+=3000;c.s.brain.activeMs=c.s.now;
  c.d.observeProgress({now:c.s.now,active:true,point:c.s.world});c.d.complete(c.p.meta,{...witness,at:c.s.now});
  c.s.now+=501;c.s.brain.activeMs=c.s.now;expect(c.d.routineReserved(c.s)).toBe(false);expect(c.d.completed()).toEqual([]);
 });
 it.each(["meal","sleep"])("genuine urgent %s still preempts the completed watch's short closing gesture",need=>{
  const c=closureReady143(),{s,d,a}=c;closureFinish143(c);expect(d.routineOwnership(s)).toBe("work");
  if(need==="meal"){s.brain.hunger=.78;s.world.foods=[{id:"actual-urgent-carrot",kind:"carrot",x:s.world.x,y:s.world.y,platformId:s.world.platformId}];s.meal={foodId:"actual-urgent-carrot"};}
  else s.brain.energy=.18;
  const request=a.next(closureOwnership143(c))!;expect(request.kind).toBe(need==="meal"?"meal":"nap");
  expect(d.startRoutine(request.recipe,s.now,request.itemId,request.outsideGoal)).toBe(true);expect(d.current()?.id).toBe(`routine-${request.kind}`);expect(d.completed()).toEqual([]);
 });
 it("manual OFF rejects the completion and leaves no latent closure on re-enable",()=>{
  const c=closureReady143();c.s.preferences.enabled=false;closureFinish143(c,{active:false});c.s.preferences.enabled=true;
  expect(c.d.routineReserved(c.s)).toBe(false);expect(c.a.next(closureOwnership143(c))?.kind).toBe("outing");expect(c.d.completed()).toEqual([]);
 });
 it("does not turn the new ownership closure into an exception to the unchanged upcoming-pose8s budget",()=>{
  const c=closureReady143();closureFinish143(c);const deadline=c.d.progressDeadline()!;
  c.s.now=deadline-100;c.s.brain.activeMs=c.s.now;c.d.observeProgress({now:c.s.now,active:true,point:c.s.world});
  expect(c.d.next(c.s)).toBeUndefined();expect(c.d.active()).toBe(false);expect(c.d.completed()).toEqual([]);expect(c.d.progressDeadline()).toBe(deadline);
 });
});

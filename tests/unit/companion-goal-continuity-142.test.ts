import { planCompanionGoal } from "@/lib/ui/viewer-companion/planner";
import { captureCompanionRestartSupport, deferCompanionRestartSupport, resolveCompanionRestartSupport } from "@/lib/ui/viewer-companion/support-landing";
import { createCompanionRoutineArbiter } from "@/lib/ui/viewer-companion/routine-arbiter";
import { describe, expect, it, vi } from "vitest";
import { createBrain, getAction, getFoodAction, commitAction, recordCompanionEvent, findPlatformRoute, platformLandingX, reachablePlatforms, type CompanionWorld, type Platform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector, nextCompanionPersonalityScene, type PersonalitySceneInput } from "@/lib/ui/viewer-companion/personality-director";
import { createCompanionPersonalityJobs } from "@/lib/ui/viewer-companion/personality-jobs";
import { createCompanionPersonalityActivity } from "@/lib/ui/viewer-companion/personality-activity";
import { createCompanionHousehold } from "@/lib/ui/viewer-companion/household";
import { accessibleCompanionToys, createCompanionToys, createCompanionToyPlanner, findCompanionToyRoute, COMPANION_TOY_KINDS, type CompanionToyKind } from "@/lib/ui/viewer-companion/toys";
import { COMPANION_PERSONALITY_SCENES, type PersonalitySceneRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";
import { DEFAULT_COMPANION_PREFERENCES, COMPANION_PERSONALITIES } from "@/lib/ui/viewer-companion/preferences";
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

describe("142 floating-room cleanup source and ownership regressions",()=>{
const floor:Platform={id:'companion-home-floor',kind:'floor',manualOnly:true,x:117.95999526977539,y:425.671875,width:353.2279968261719-117.95999526977539};
const foodFloor:Platform={...floor,id:'companion-home-floor-food',x:190,width:175};
const outside:Platform={id:'card-141',kind:'card',x:114.01599502563477,y:656.4990234375,width:2};
const sofa:Platform={id:'companion-home',kind:'date',x:156,y:376.578125,width:2};
const outsidePoint={x:115.01599502563477,y:outside.y,platformId:outside.id};
const box={x:330,y:floor.y,platformId:floor.id},opening={left:392.515625,top:268.203125,width:68.84375,height:4.578125};
function fixture(startOutside=false, recipes=COMPANION_PERSONALITY_SCENES.filter(r=>['T01','X-T-return-time'].includes(r.id)),firstKind?:CompanionToyKind) {
 const director=createCompanionPersonalityDirector(recipes),planner=createCompanionToyPlanner(),household=createCompanionHousehold(()=>0);
 let first=true;const jobs=createCompanionPersonalityJobs(director,household,planner),toys=createCompanionToys(()=>first&&firstKind?(first=false,(COMPANION_TOY_KINDS.indexOf(firstKind)+.01)/COMPANION_TOY_KINDS.length):0);
 const planes=[outside,floor,sofa];toys.sync(planes,{width:1440,height:1050},0,[foodFloor]);
 for(const x of [346.93798828125,302.93798828125,258.93798828125,214.93800354003906])expect(toys.spawn({x,y:opening.top+opening.height,platformId:foodFloor.id},0)).toBeTruthy();
 for(let at=0;at<=4000;at+=16)toys.tick(at);
 const world:CompanionWorld={...(startOutside?outsidePoint:{x:157,y:floor.y,platformId:floor.id}),platforms:planes,width:1440,height:1050,animated:true,foods:[]};
 const input:PersonalitySceneInput={world,brain:{...createBrain(0,()=>.5),hunger:.60,energy:.76,activeMs:4000},preferences:{...DEFAULT_COMPANION_PREFERENCES,personality:recipes[0]?.personality??'tidy'},now:4000,home:{floor:{x:200,y:floor.y,platformId:floor.id},box,sofa:{x:157,y:sofa.y,platformId:sofa.id}},toys:[],tv:'off',environment:{band:'morning'} as never};
 const ids=toys.ids(),events:{kind:string;id?:string;jumpHeight?:number;from:string|undefined;to:string|undefined}[]=[];
 const refresh=()=>{input.toys=accessibleCompanionToys(toys.available(),planes);input.toyCount=toys.count();input.carriedToyId=toys.carried();input.brain.activeMs=input.now;};
 refresh();const entry=director.next(input)!;expect(entry.meta.id).toBe('entry-'+input.preferences.personality);director.complete(entry.meta);input.now+=entry.action!.duration;
 function step() {
  refresh();const proposal=director.next(input);if(!proposal){input.now+=250;return false;}
  const action=jobs.next(proposal,{world:input.world,brain:input.brain,preferences:input.preferences,now:input.now,home:{pantry:input.home.floor},box,toys:input.toys,toyIds:toys.ids(),carriedToy:toys.carried(),toyCount:toys.count(),foodCount:0,occupied:toys.occupied()});
  if(!action){input.now+=250;return false;}
  const from=input.world.platformId;
  if(action.kind==='walk'||action.kind==='jump'){
   const support=planes.find(p=>p.id===action.target.platformId)!;expect(support).toBeTruthy();expect(action.target.x).toBeGreaterThanOrEqual(support.x);expect(action.target.x).toBeLessThanOrEqual(support.x+support.width);expect(action.target.y).toBe(support.y);
   if(action.kind==='jump')expect(reachablePlatforms(input.world,[{...support,x:action.target.x-12,width:24}],action.jumpHeight?{maxRise:action.jumpHeight}:undefined)).toHaveLength(1);
   Object.assign(input.world,action.target);if(toys.carried())expect(toys.carry(toys.carried()!,{x:input.world.x,y:input.world.y-30})).toBe(true);
  }
  input.now+=action.duration;input.brain.activeMs=input.now;director.observeProgress({now:input.now,active:true,point:input.world,carriedToyId:toys.carried()});
  if(action.toy?.effect){
   const beat=action.toy;let success=false;
   if(beat.effect==='pick')success=Boolean(beat.toyId&&toys.pick(beat.toyId,input.world));
   if(beat.effect==='stash'&&beat.toyId){const real=toys.items().find(t=>t.id===beat.toyId)!;expect(real.carried).toBe(true);const target=companionToyReturnTarget(opening)!;expect(toys.carry(real.id,sampleCompanionToyReturn(real,target,1))).toBe(true);expect(companionToyReturnDelivered(toys.items().find(t=>t.id===real.id),target)).toBe(true);success=toys.stash(real.id);}
   if((beat.effect==='put'||beat.effect==='toss')&&beat.toyId){success=toys.put(beat.toyId,{...input.world,y:input.world.y-(beat.effect==='toss'?22:0)},input.now-action.duration/2,beat.effect==='toss');for(let at=input.now-action.duration/2+16;at<input.now;at+=16)toys.tick(at);}
   expect(['pick','stash','put','toss']).toContain(beat.effect);expect(success).toBe(true);planner.resolve(beat,success,input.now);
   if(beat.effect!=='pick'){director.resolve(action.personalityScene,success,beat.toyId,input.now);if(director.current()?.beat!==action.personalityScene.beat)planner.cancel(input.now);}
   events.push({kind:beat.effect!,id:beat.toyId,from,to:input.world.platformId});
  }else if(action.personalityJobEnd)director.resolve(action.personalityScene,true,action.personalityScene.itemId??toys.carried(),input.now);else director.complete(action.personalityScene);
  events.push({kind:action.kind,id:toys.carried(),jumpHeight:action.jumpHeight,from,to:input.world.platformId});toys.tick(input.now);return true;
 }
 return {director,planner,toys,input,ids,events,refresh,step};
}
describe('production recovery proposal model; no DOM/native completion claim',()=>{
 it('ordinary routing stays bounded while opt-in house-entry retains the existing real floor and jumpHeight',()=>{
  const target={x:258.93798828125,y:floor.y,platformId:floor.id};
  expect(findCompanionToyRoute(outsidePoint,target,[outside,floor],true)).toBeNull();
  const path=findCompanionToyRoute(outsidePoint,target,[outside,floor],true,true)!;
  expect(path.some(step=>'jumpHeight'in step&&Number(step.jumpHeight)>140)).toBe(true);expect(path.at(-1)!.target).toEqual(target);
 });
 it('actualmodel outside→entry spring→same-ID pick/carry/painted-return/removal completes all4',()=>{
  const host=fixture(true);
  for(let i=0;i<100&&host.toys.count();i++)host.step();
  expect(host.toys.count()).toBe(0);expect(host.toys.carried()).toBeUndefined();
  expect(host.events.filter(e=>e.kind==='pick').map(e=>e.id).sort()).toEqual([...host.ids].sort());
  expect(host.events.filter(e=>e.kind==='stash').map(e=>e.id).sort()).toEqual([...host.ids].sort());
  expect(host.events.some(e=>e.kind==='jump'&&Number(e.jumpHeight)>140&&e.from===outside.id&&e.to===floor.id)).toBe(true);
 });
 it('unfinished3 real returns defer only leisure outing at the observed post-first-return boundary',()=>{
  const host=fixture();host.director.event('arrival',host.input.now);
  for(let i=0;i<50&&!(host.toys.count()===3&&host.input.world.platformId===sofa.id);i++)host.step();
  expect(host.toys.count()).toBe(3);expect(host.input.world.platformId).toBe(sofa.id);host.refresh();
  expect(host.director.routineReserved(host.input)).toBe(false);expect(host.director.cleanupPending(host.input)).toBe(true);
  const init={...host.input,now:0,active:true,entryReady:true};
  const old=createCompanionRoutineArbiter();old.next({...init,active:false});
  expect(old.next({...init,now:host.input.now})).toMatchObject({kind:'outing'});
  const revised=createCompanionRoutineArbiter();revised.next({...init,active:false});
  expect(revised.next({...init,now:host.input.now,canOuting:!host.director.cleanupPending(host.input)})).toBeUndefined();
  for(let i=0;i<100&&host.toys.count();i++)host.step();
  host.refresh();expect(host.toys.count()).toBe(0);expect(host.director.cleanupPending(host.input)).toBe(false);
  expect(revised.next({...init,...host.input,now:host.input.now,canOuting:!host.director.cleanupPending(host.input)})).toMatchObject({kind:'outing'});
 });
 it('a required later return carries its capability into an earlier inspect/play planner, without changing the reserved star-wand ID',()=>{
  const recipe=COMPANION_PERSONALITY_SCENES.find(r=>r.id==='P08')!,host=fixture(true,[recipe],'star-wand'),id=host.toys.items().find(t=>t.kind==='star-wand')!.id;
  for(let i=0;i<100&&host.toys.ids().includes(id);i++)host.step();
  expect(host.events.some(e=>e.kind==='jump'&&Number(e.jumpHeight)>140)).toBe(true);
  expect(host.events.filter(e=>e.kind==='pick'||e.kind==='stash').map(e=>e.id)).toEqual([id,id]);
  expect(host.toys.ids()).toEqual(host.ids.filter(x=>x!==id));
 });
 it('a non-carrying B01 inspect uses the same explicit-return entry and finishes its original chosen object',()=>{
  const recipe=COMPANION_PERSONALITY_SCENES.find(r=>r.id==='B01')!,host=fixture(true,[recipe],'ball');host.step();const id=host.director.current()!.itemId!;expect(id).toBeTruthy();
  for(let i=0;i<120&&!host.events.some(e=>e.kind==='stash');i++)host.step();
  expect(host.events.some(e=>e.kind==='jump'&&Number(e.jumpHeight)>140)).toBe(true);
  expect(host.events.filter(e=>e.kind==='stash').map(e=>e.id)).toEqual([id]);expect(host.toys.ids()).toEqual(host.ids.filter(x=>x!==id));
 });
 it.each([.60,.78])('leisure-only deferral preserves an actual meal at hunger%s',hunger=>{
  const host=fixture();host.input.brain.hunger=hunger;const arbiter=createCompanionRoutineArbiter();arbiter.next({...host.input,active:false,entryReady:true,canOuting:false});
  expect(arbiter.next({...host.input,active:true,entryReady:true,canOuting:false,meal:{canSupply:true},home:{...host.input.home,dispenser:box},now:host.input.now+12000})).toMatchObject({kind:'meal'});
 });
 it('keeps real wash and necessary sleep eligible while leisure is deferred',()=>{
  const host=fixture(),pad={id:'companion-home-floor-400',kind:'floor' as const,bodyOnly:true,manualOnly:true,x:295,y:355,width:2};
  host.input.world.platforms=[...host.input.world.platforms,pad];host.input.home.pad={x:296,y:355,platformId:pad.id};
  const wash=createCompanionRoutineArbiter();wash.observe('ate',host.input.now);
  expect(wash.next({...host.input,active:true,entryReady:true,canOuting:false})).toMatchObject({kind:'wash'});
  host.input.brain.energy=.1;expect(createCompanionRoutineArbiter().next({...host.input,active:true,entryReady:true,canOuting:false})).toMatchObject({kind:'nap'});
 });
 it.each(COMPANION_PERSONALITIES)('unreachable required-return %s does not emit its preparatory expression',personality=>{
  const recipe:PersonalitySceneRecipe={id:'blocked-required-return',personality,label:'required-return admission diagnostic',major:true,triggers:['toy'],steps:[{kind:'pose',pose:'groom'},{kind:'toy',mode:'return'}]};
  const host=fixture(true,[{...recipe,personality:'tidy'}]);host.input.preferences.personality=personality;host.input.home.box={...box,y:100};host.input.world.platforms=host.input.world.platforms.map(p=>p.id===floor.id?{...p,y:100}:p);host.input.toys=host.input.toys.map(t=>({...t,y:100,stance:{...t.stance!,y:100}}));
  const updated=createCompanionPersonalityDirector([recipe]);const entry=updated.next(host.input)!;updated.complete(entry.meta);
  expect(updated.next(host.input)).toBeUndefined();expect(updated.completed()).toEqual([]);
 });
 it.each(['held','hidden','missing','off','paused','busy','too-high','jumpOFF'] as const)('does not reserve unavailable pending cleanup %s',type=>{
  const h=fixture(true);h.refresh();
  if(type==='held'||type==='hidden')h.input.toys=h.input.toys.map(t=>({...t,[type]:true}));
  if(type==='missing')h.input.toys=[];
  if(type==='off')h.input.preferences.enabled=false;
  if(type==='paused')h.input.world.paused=true;
  if(type==='busy')h.input.busy=true;
  if(type==='too-high'){h.input.world.platforms=h.input.world.platforms.map(p=>p.id===floor.id?{...p,y:100}:p);h.input.toys=h.input.toys.map(t=>({...t,y:100,stance:{...t.stance!,y:100}}));h.input.home.box={...box,y:100};}
  if(type==='jumpOFF')h.input.preferences.jump=false;
  expect(h.director.cleanupPending(h.input)).toBe(false);
 });
 it.each(['bodyOnly','control','otherManual'] as const)('stronger entry rejects %s targets',type=>{
  const p={...floor,...(type==='bodyOnly'?{bodyOnly:true}:type==='control'?{kind:'control' as const}:{id:'other-manual'})};
  expect(findCompanionToyRoute(outsidePoint,{...box,platformId:p.id},[outside,p],true,true)).toBeNull();
 });
 it.each(['M07','H01'])('a real currently possible required take-out %s may supply its own later return object',id=>{
  const recipe=COMPANION_PERSONALITY_SCENES.find(r=>r.id===id)!,host=fixture(false,[recipe]);host.input.toys=[];host.input.toyCount=0;
  expect(host.director.next(host.input)?.meta.command).toMatchObject({kind:'go',target:'box'});
 });
 it.each(['optional-spawn','cap4','no-box','body-box'] as const)('a nonexistent future toy cannot justify required-return preparation: %s',mode=>{
  const base=COMPANION_PERSONALITY_SCENES.find(r=>r.id==='M07')!,recipe=mode==='optional-spawn'?{...base,id:'optional-spawn-required-return',steps:[{kind:'pose' as const,pose:'groom' as const},{kind:'toy' as const,mode:'spawn' as const,optional:true},{kind:'toy' as const,mode:'return' as const}]}:base;
  const host=fixture(false,[recipe]);host.input.toys=[];host.input.toyCount=mode==='cap4'?4:0;
  if(mode==='no-box')host.input.home.box=undefined;
  if(mode==='body-box')host.input.world.platforms=host.input.world.platforms.map(p=>p.id===floor.id?{...p,bodyOnly:true}:p);
  expect(host.director.next(host.input)).toBeUndefined();
 });
 it('retains an ordinary valid140-rise route instead of opting into a stronger spring',()=>{
  const p={...floor,y:outside.y-80};const route=findCompanionToyRoute(outsidePoint,{...box,y:p.y},[outside,p],true,true)!;
  expect(route.length).toBeGreaterThan(0);expect(route.every(step=>!('jumpHeight'in step))).toBe(true);
 });
});

});


describe("preference-effect restart preserves an existing actual manual card ledge, never an action", () => {
  const fixture = () => {
    const root = { isConnected: true }, source = { isConnected: true };
    const platform: Platform = { id: "card-105-top", x: 270, y: 586.757, width: 110, kind: "card", manualOnly: true };
    const context = { point: { x: 320.383, y: 586.757 }, monthKey: "2026-10", root, platform,
      anchor: { element: source, left: 236, top: 589.757, width: 178, height: 72, identity: "2026-10-20" },
      viewport: { width: 1920, height: 720 }, size: 92,
      state: { enabled: true, visible: true, blocked: false, reduced: false, held: false, airborne: false, carrying: false, owned: false, resting: false } };
    return { context, root, source, platform };
  };
  it("retains the exact card-top point through two successive preference restarts even when a nearer date exists", () => {
    const { context, platform } = fixture();
    const nearerDate: Platform = { id: "date-75", x: 230, y: 564.183, width: 9, kind: "date" };
    for (let restart = 0; restart < 2; restart++) {
      const snapshot = captureCompanionRestartSupport(context)!; expect(snapshot).toBeTruthy();
      const ordinary = [nearerDate], landings = [{ ...platform }];
      const candidate = [...ordinary, ...landings].find(p => p.id === snapshot.platform.id);
      const restored = resolveCompanionRestartSupport(snapshot, { ...context, platform: candidate });
      expect(restored).toEqual(platform); expect(context.point).toEqual({ x: 320.383, y: 586.757 });
      expect(restored?.id).not.toBe(nearerDate.id);
    }
  });
  it("does not confuse the renderer's temporary modal hide with missing physical geometry", () => {
    const { context, platform } = fixture(); const actor = { hidden: true, presence: "finishing" };
    expect(actor.hidden).toBe(true); const snapshot = captureCompanionRestartSupport(context)!;
    expect(resolveCompanionRestartSupport(snapshot, context)).toBe(platform);
    expect(resolveCompanionRestartSupport(snapshot, { ...context, platform: undefined, anchor: undefined })).toBeUndefined();
  });
  it.each(["enabled", "visible", "blocked", "reduced", "held", "airborne", "carrying", "owned", "resting"] as const)("never restores an unsafe controller state: %s", key => {
    const { context } = fixture(); const snapshot = captureCompanionRestartSupport(context)!;
    const state = { ...context.state, [key]: !context.state[key] };
    expect(captureCompanionRestartSupport({ ...context, state })).toBeUndefined();
    expect(resolveCompanionRestartSupport(snapshot, { ...context, state })).toBeUndefined();
  });
  it.each(["month", "root", "source", "source-disconnected", "root-disconnected", "calendar-identity", "no-source", "no-platform"] as const)("rejects stale or different physical identity: %s", key => {
    const { context, root, source } = fixture(); const snapshot = captureCompanionRestartSupport(context)!;
    const next = { ...context, anchor: { ...context.anchor } };
    if (key === "month") next.monthKey = "2026-11";
    if (key === "root") next.root = { isConnected: true };
    if (key === "source") next.anchor.element = { isConnected: true };
    if (key === "source-disconnected") source.isConnected = false;
    if (key === "root-disconnected") root.isConnected = false;
    if (key === "calendar-identity") next.anchor.identity = "2026-10-21";
    expect(resolveCompanionRestartSupport(snapshot, key === "no-source" ? { ...next, anchor: undefined } : key === "no-platform" ? { ...next, platform: undefined } : next)).toBeUndefined();
  });
  it.each(["x", "y", "width", "kind", "manualOnly", "bodyOnly", "id"] as const)("rejects changed or unsafe measured support without clamping the old point: %s", key => {
    const { context } = fixture(); const snapshot = captureCompanionRestartSupport(context)!;
    const platform = { ...context.platform };
    if (key === "x" || key === "y" || key === "width") platform[key] += 1;
    if (key === "kind") platform.kind = "control";
    if (key === "manualOnly") platform.manualOnly = false;
    if (key === "bodyOnly") platform.bodyOnly = true;
    if (key === "id") platform.id = "card-106-top";
    expect(resolveCompanionRestartSupport(snapshot, { ...context, platform })).toBeUndefined();
  });
  it.each(["left", "top", "width", "height"] as const)("rejects a changed cached DOM frame: %s", key => {
    const { context } = fixture(); const snapshot = captureCompanionRestartSupport(context)!;
    expect(resolveCompanionRestartSupport(snapshot, { ...context, anchor: { ...context.anchor, [key]: context.anchor[key] + 1 } })).toBeUndefined();
  });
  it.each(["point", "viewport", "size", "nan", "outside-span", "floating", "body-only", "home", "panel", "no-width"] as const)("preserves existing recovery for invalid geometry: %s", key => {
    const { context } = fixture(); const snapshot = captureCompanionRestartSupport(context)!;
    const next = { ...context, point: { ...context.point }, platform: { ...context.platform }, viewport: { ...context.viewport }, anchor: { ...context.anchor } };
    if (key === "point") next.point.x += 1;
    if (key === "viewport") next.viewport.width -= 1;
    if (key === "size") next.size = 76;
    if (key === "nan") next.point.x = NaN;
    if (key === "outside-span") next.point.x = next.platform.x - 1;
    if (key === "floating") next.point.y -= 3;
    if (key === "body-only") next.platform.bodyOnly = true;
    if (key === "home") next.platform.id = "companion-home";
    if (key === "panel") next.platform.id = "companion-panel-floor";
    if (key === "no-width") next.anchor.width = 0;
    expect(resolveCompanionRestartSupport(snapshot, next)).toBeUndefined();
  });
  it("copies only the physical checkpoint and cannot restore or advance the cancelled action/owner", () => {
    const { context } = fixture(); const snapshot = captureCompanionRestartSupport(context)!;
    context.platform.x += 2; context.anchor.left += 2;
    expect(snapshot.platform.x).toBe(270); expect(snapshot.frame.left).toBe(236);
    expect(Object.keys(snapshot).sort()).toEqual(["frame", "monthKey", "platform", "point", "root", "size", "source", "viewport"]);
    expect(resolveCompanionRestartSupport(snapshot, context)).toBeUndefined();
  });
});


describe("ordinary-modal clipping defers a checkpoint, never restores unsafe support", () => {
  const fixture = () => {
    const root = { isConnected: true }, source = { isConnected: true };
    const platform: Platform = { id: "card-91-top", x: 224.78477478027344, y: 586.7565307617188, width: 191.1967315673828, kind: "card", manualOnly: true };
    const context = { point: { x: 320.3831481933594, y: 586.7565307617188 }, monthKey: "2026-10", root, platform,
      anchor: { element: source, left: 224.78477478027344, top: 589.7565307617188, width: 191.1967315673828, height: 44.41845703125, identity: "synthetic-public-card" },
      viewport: { width: 1440, height: 1050 }, size: 92,
      state: { enabled: true, visible: true, blocked: false, reduced: false, held: false, airborne: false, carrying: false, owned: false, resting: false } };
    const clipped = { ...context, platform: { ...platform, width: 90.25522521972658 } };
    return { root, source, platform, context, clipped, snapshot: captureCompanionRestartSupport(context)! };
  };
  it("retains the measured old point through three unadopted preference restarts, then strictly restores it only after the modal closes", () => {
    const { context, clipped, platform } = fixture(); let pending = captureCompanionRestartSupport(context)!;
    const nearerDate: Platform = { id: "date-63", x: 225.54998779296875, y: 564.1826171875, width: Number("17.743484497070312"), kind: "date" };
    const originalPoint = { ...context.point }, original = pending;
    for (let restart = 0; restart < 3; restart++) {
      expect(resolveCompanionRestartSupport(pending, clipped)).toBeUndefined();
      expect(captureCompanionRestartSupport(clipped)).toBeUndefined();
      const support = "", action = undefined;
      const lookup = [nearerDate, clipped.platform].find(value => value.id === (support || pending.platform.id));
      const kept = deferCompanionRestartSupport(pending, { ...clipped, platform: action ? undefined : lookup }, true);
      expect(kept).toBe(original); pending = kept!;
      expect(pending.point).toEqual(originalPoint); expect(pending.platform).toEqual(platform);
      expect(pending.platform.id).not.toBe(nearerDate.id);
    }
    expect(deferCompanionRestartSupport(pending, clipped, false)).toBeUndefined();
    expect(resolveCompanionRestartSupport(pending, clipped)).toBeUndefined();
    expect(resolveCompanionRestartSupport(pending, context)).toBe(platform);
    expect(context.point).toEqual(originalPoint);
  });
  it.each(["left", "right", "both", "unchanged"] as const)("defers only a same-source positive subset, clipped from %s", side => {
    const { context, snapshot } = fixture(); const platform = { ...context.platform };
    if (side === "left" || side === "both") { platform.x += 104; platform.width -= 104; }
    if (side === "right" || side === "both") platform.width -= side === "both" ? 40 : 104;
    expect(deferCompanionRestartSupport(snapshot, { ...context, platform }, true)).toBe(snapshot);
    if (side !== "unchanged") expect(resolveCompanionRestartSupport(snapshot, { ...context, platform })).toBeUndefined();
  });
  it.each(["enabled", "visible", "blocked", "reduced", "held", "airborne", "carrying", "owned", "resting"] as const)("does not defer unsafe controller state %s", key => {
    const { clipped, snapshot } = fixture();
    expect(deferCompanionRestartSupport(snapshot, { ...clipped, state: { ...clipped.state, [key]: !clipped.state[key] } }, true)).toBeUndefined();
  });
  it.each(["month", "root", "source", "root-disconnected", "source-disconnected", "identity", "frame-left", "frame-top", "frame-width", "frame-height", "missing-platform", "missing-anchor"] as const)("does not defer stale/missing physical proof %s", key => {
    const { clipped, snapshot, root, source } = fixture();
    const next = { ...clipped, anchor: { ...clipped.anchor } };
    if (key === "month") next.monthKey = "2026-11";
    if (key === "root") next.root = { isConnected: true };
    if (key === "source") next.anchor.element = { isConnected: true };
    if (key === "root-disconnected") root.isConnected = false;
    if (key === "source-disconnected") source.isConnected = false;
    if (key === "identity") next.anchor.identity = "different-synthetic-card";
    if (key === "frame-left") next.anchor.left += 1;
    if (key === "frame-top") next.anchor.top += 1;
    if (key === "frame-width") next.anchor.width += 1;
    if (key === "frame-height") next.anchor.height += 1;
    const context = key === "missing-platform" ? { ...next, platform: undefined } : key === "missing-anchor" ? { ...next, anchor: undefined } : next;
    expect(deferCompanionRestartSupport(snapshot, context, true)).toBeUndefined();
  });
  it.each(["point", "viewport", "size", "nan", "zero-width", "expanded-left", "expanded-right", "different-id", "different-y", "kind", "manual-only", "body-only", "home", "panel"] as const)("preserves existing recovery for invalid or expanded geometry %s", key => {
    const { clipped, snapshot } = fixture();
    const next = { ...clipped, point: { ...clipped.point }, viewport: { ...clipped.viewport }, platform: { ...clipped.platform } };
    if (key === "point") next.point.x += 1;
    if (key === "viewport") next.viewport.width -= 1;
    if (key === "size") next.size = 76;
    if (key === "nan") next.platform.width = NaN;
    if (key === "zero-width") next.platform.width = 0;
    if (key === "expanded-left") next.platform.x -= 1;
    if (key === "expanded-right") next.platform.width = snapshot.platform.width + 1;
    if (key === "different-id") next.platform.id = "card-92-top";
    if (key === "different-y") next.platform.y += 1;
    if (key === "kind") next.platform.kind = "control";
    if (key === "manual-only") next.platform.manualOnly = false;
    if (key === "body-only") next.platform.bodyOnly = true;
    if (key === "home") next.platform.id = "companion-home";
    if (key === "panel") next.platform.id = "companion-panel-floor";
    expect(deferCompanionRestartSupport(snapshot, next, true)).toBeUndefined();
  });
  it("does not create a snapshot, expose it outside an ordinary modal or turn a deferred clip into a restored support", () => {
    const { clipped, snapshot } = fixture();
    expect(deferCompanionRestartSupport(undefined, clipped, true)).toBeUndefined();
    expect(deferCompanionRestartSupport(snapshot, clipped, false)).toBeUndefined();
    const kept = deferCompanionRestartSupport(snapshot, clipped, true)!;
    expect(Object.keys(kept).sort()).toEqual(["frame", "monthKey", "platform", "point", "root", "size", "source", "viewport"]);
    expect(resolveCompanionRestartSupport(kept, clipped)).toBeUndefined();
  });
});


describe("fully missing modal geometry keeps only an unadopted checkpoint until fresh close", () => {
  const fixture = () => {
    const root = { isConnected: true }, source = { isConnected: true };
    const platform: Platform = { id: "card-91-top", x: 224.78477478027344, y: 586.7565307617188, width: 191.1967315673828, kind: "card", manualOnly: true };
    const context = { point: { x: 320.3831481933594, y: 586.7565307617188 }, monthKey: "2026-10", root, platform,
      anchor: { element: source, left: 224.78477478027344, top: 589.7565307617188, width: 191.1967315673828, height: 44.41845703125, identity: "synthetic-public-card" },
      viewport: { width: 1440, height: 1050 }, size: 92,
      state: { enabled: true, visible: true, blocked: false, reduced: false, held: false, airborne: false, carrying: false, owned: false, resting: false } };
    return { root, source, platform, context, missing: { ...context, platform: undefined, anchor: undefined }, snapshot: captureCompanionRestartSupport(context)! };
  };
  it("survives three modal preference cleanups with both proofs absent, then adopts only the new closed actual support", () => {
    const { context, missing, platform, snapshot } = fixture(); let pending = snapshot;
    for (let restart = 0; restart < 3; restart++) {
      expect(captureCompanionRestartSupport(missing)).toBeUndefined();
      expect(resolveCompanionRestartSupport(pending, missing)).toBeUndefined();
      const kept = deferCompanionRestartSupport(pending, missing, true);
      expect(kept).toBe(snapshot); pending = kept!;
      expect(pending.point).toEqual({ x: 320.3831481933594, y: 586.7565307617188 });
    }
    expect(deferCompanionRestartSupport(pending, missing, false)).toBeUndefined();
    expect(resolveCompanionRestartSupport(pending, missing)).toBeUndefined();
    expect(resolveCompanionRestartSupport(pending, context)).toBe(platform);
    expect(resolveCompanionRestartSupport(pending, { ...context, anchor: { ...context.anchor, top: context.anchor.top + 1 } })).toBeUndefined();
    expect(resolveCompanionRestartSupport(pending, { ...context, anchor: { ...context.anchor, element: { isConnected: true } } })).toBeUndefined();
  });
  it.each(["enabled", "visible", "blocked", "reduced", "held", "airborne", "carrying", "owned", "resting"] as const)("revokes even a hidden missing-geometry checkpoint for %s", key => {
    const { missing, snapshot } = fixture();
    expect(deferCompanionRestartSupport(snapshot, { ...missing, state: { ...missing.state, [key]: !missing.state[key] } }, true)).toBeUndefined();
  });
  it.each(["month", "root", "root-disconnected", "source-disconnected", "point", "viewport", "size", "nan", "invalid-prior"] as const)("revokes a missing-geometry checkpoint with stale context %s", key => {
    const { missing, snapshot, root, source } = fixture(); const next = { ...missing, point: { ...missing.point }, viewport: { ...missing.viewport } };
    if (key === "month") next.monthKey = "2026-11";
    if (key === "root") next.root = { isConnected: true };
    if (key === "root-disconnected") root.isConnected = false;
    if (key === "source-disconnected") source.isConnected = false;
    if (key === "point") next.point.x += 1;
    if (key === "viewport") next.viewport.height -= 1;
    if (key === "size") next.size = 76;
    if (key === "nan") next.point.x = NaN;
    const previous = key === "invalid-prior" ? { ...snapshot, platform: { ...snapshot.platform, bodyOnly: true } } : snapshot;
    expect(deferCompanionRestartSupport(previous, next, true)).toBeUndefined();
  });
  it("cannot synthesize proof outside the modal or turn one missing half into total absence", () => {
    const { context, missing, snapshot } = fixture();
    expect(deferCompanionRestartSupport(undefined, missing, true)).toBeUndefined();
    expect(deferCompanionRestartSupport(snapshot, missing, false)).toBeUndefined();
    expect(deferCompanionRestartSupport(snapshot, { ...context, platform: undefined }, true)).toBeUndefined();
    expect(deferCompanionRestartSupport(snapshot, { ...context, anchor: undefined }, true)).toBeUndefined();
  });
});


describe("new foreign rest-home admissions respect actual failure TTL without discarding fatigue", () => {
  const ports = { route: findPlatformRoute, landingX: platformLandingX, reachable: reachablePlatforms };
  const fixture = (personality: typeof COMPANION_PERSONALITIES[number] = "balanced") => {
    const main: Platform = { id: "companion-home-floor", x: 62, y: 558.859, width: 150, kind: "floor" };
    const sofa: Platform = { id: "companion-home", x: 74, y: 520.344, width: 25, kind: "date" };
    const world: CompanionWorld = { x: 137.082, y: main.y, platformId: main.id, platforms: [main, sofa], width: 1920, height: 1100, animated: true, foods: [] };
    const brain = { ...createBrain(0, () => .5), energy: .15, hunger: .05, curiosity: .1, activeMs: 70000,
      places: [{ id: sofa.id, visits: 0, failures: 1, retryAfter: 78000 }] };
    const preferences = { ...DEFAULT_COMPANION_PREFERENCES, personality, sleep: true, roam: true, feeding: true, learnFromYou: false };
    return { main, sofa, world, brain, preferences };
  };
  const finishRealRestRoute = (initial: ReturnType<typeof createBrain>, initialWorld: CompanionWorld, preferences: ReturnType<typeof fixture>["preferences"]) => {
    let state = initial, live = { ...initialWorld }, now = initial.activeMs;
    const actions: ReturnType<typeof getAction>[] = [];
    for (let hops = 0; hops < 10; hops++) {
      const next = planCompanionGoal(state, live, preferences, ports);
      expect(next.outcomes.every(outcome => outcome.result === "completed")).toBe(true);
      expect(next.action).toBeDefined(); const action = next.action!; actions.push(action);
      if (action.kind === "sleep") return actions;
      expect(["walk", "jump"]).toContain(action.kind);
      const sofa = live.platforms.find(platform => platform.id === "companion-home")!;
      const route = findPlatformRoute(live, { x: platformLandingX(sofa,sofa.x+sofa.width/2), y: sofa.y, platformId: sofa.id }, live.platforms, preferences.jump);
      expect(route?.length).toBeGreaterThan(0);
      expect(action).toMatchObject({ kind: route![0].kind, target: route![0].target });
      state = { ...commitAction(state, action, now), activeMs: state.activeMs+action.duration };
      live = { ...live, ...action.target }; now += action.duration;
    }
    throw new Error("existing bounded rest route did not reach finite sleep");
  };
  it.each(COMPANION_PERSONALITIES)("%s completes needed finite rest here rather than reissuing the blocked new sofa route", personality => {
    const { world, brain, preferences, main } = fixture(personality);
    const planned = planCompanionGoal(brain, world, preferences, ports);
    expect(planned.action).toMatchObject({ kind: "sleep", target: { x: world.x, y: world.y, platformId: main.id }, intention: { kind: "rest", stage: "observe" } });
    expect(planned.action!.duration).toBeGreaterThan(0); expect(planned.action!.duration).toBeLessThanOrEqual(15000);
    expect(planned.outcomes).toEqual([]);
    // Preserve the existing actual living prelude, which legitimately precedes
    // the planner. It creates one finite pending cozy sleep, not another trip.
    const prelude = getAction(brain, world, preferences, 70000, () => .5);
    expect(prelude).toMatchObject({ kind: "play", play: "doze-curl", living: "cozy" });
    const prepared = commitAction(brain, prelude, 70000);
    expect(prepared.energy).toBe(brain.energy);
    const actual = getAction({ ...prepared, activeMs: brain.activeMs + prelude.duration }, world, preferences, 70000 + prelude.duration, () => .5);
    expect(actual).toMatchObject({ kind: "sleep", target: { platformId: main.id } });
    const committed = commitAction(prepared, actual, 70000 + prelude.duration); expect(committed.energy).toBe(brain.energy);
    // Existing model completion ACK, not a DOM/painted-sleep claim.
    const completed = recordCompanionEvent(committed, "rested");
    expect(completed.energy).toBeGreaterThan(brain.energy); expect(completed.energy).toBeCloseTo(brain.energy + .24);
    expect(completed.intention).toBeUndefined();
  });
  it("does not extend the active-time failure TTL just by considering a deferred new admission", () => {
    const { world, brain, preferences } = fixture();
    for (let elapsed = 0; elapsed < 8000; elapsed += 1000) {
      const planned = planCompanionGoal({ ...brain, activeMs: brain.activeMs + elapsed }, world, preferences, ports);
      expect(planned.action?.kind).toBe("sleep"); expect(planned.outcomes).toEqual([]);
      expect(brain.places[0].retryAfter).toBe(78000);
    }
  });
  it("also permits the actual manual main house floor while rejecting manual card ownership", () => {
    const { world, brain, preferences, main } = fixture(); main.manualOnly = true;
    expect(planCompanionGoal(brain, world, preferences, ports).action).toMatchObject({ kind: "sleep", target: { platformId: main.id } });
  });
  it("backs off a new optional homebody home visit without minting another failed outcome", () => {
    const { world, brain, preferences } = fixture("homebody"); brain.energy = .9;
    const plan = planCompanionGoal(brain, world, preferences, ports);
    expect(plan.action).toBeUndefined(); expect(plan.outcomes).toEqual([]); expect(brain.places[0].retryAfter).toBe(78000);
  });
  it("keeps an unfinished episode outside the new local-rest fallback", () => {
    const { world, brain, preferences } = fixture();
    const episode = { kind: "meal" as const, phase: "ate" as const, variant: "careful" as const, remaining: 1, mishapUsed: true, legs: 0 };
    expect(planCompanionGoal({ ...brain, episode }, world, preferences, ports).action?.kind).not.toBe("sleep");
  });
  it("admits the original real sofa route after its existing TTL expires", () => {
    const { world, brain, preferences, sofa } = fixture();
    const actions = finishRealRestRoute({ ...brain, activeMs: 78000 }, world, preferences);
    expect(actions[0].kind).toBe("walk"); expect(actions.some(action => action.kind === "jump")).toBe(true);
    expect(actions.at(-1)).toMatchObject({ kind: "sleep", target: { platformId: sofa.id } });
  });
  it("preserves a previously owned rest route even while a new admission would be backed off", () => {
    const { world, brain, preferences, sofa } = fixture();
    const intention = { kind: "rest" as const, targetId: sofa.id, offset: .5, remaining: 8, stage: "travel" as const };
    const actions = finishRealRestRoute({ ...brain, intention }, world, preferences);
    expect(actions[0].kind).toBe("walk"); expect(actions.every(action => action.intention?.targetId === sofa.id)).toBe(true);
    expect(actions.some(action => action.kind === "jump")).toBe(true);
    expect(actions.at(-1)).toMatchObject({ kind: "sleep", target: { platformId: sofa.id } });
  });
  it("never blocks actual sofa-arrival evidence from resting at its current support", () => {
    const { world, brain, preferences, sofa } = fixture();
    const here = { ...world, x: sofa.x+sofa.width/2, y: sofa.y, platformId: sofa.id };
    const planned = planCompanionGoal(brain, here, preferences, ports);
    expect(planned.action).toMatchObject({ kind: "sleep", target: { platformId: sofa.id } });
  });
  it.each(["sleep-off", "disabled", "roam-off", "paused", "unanimated", "body-only", "manual-card", "outside-x", "airborne", "nan"] as const)("does not synthesize rest-here on unsafe/off context %s", key => {
    const { world, brain, preferences, main } = fixture();
    if (key === "sleep-off") preferences.sleep = false;
    if (key === "disabled") preferences.enabled = false;
    if (key === "roam-off") preferences.roam = false;
    if (key === "paused") world.paused = true;
    if (key === "unanimated") world.animated = false;
    if (key === "body-only") main.bodyOnly = true;
    if (key === "manual-card") { main.kind = "card"; main.manualOnly = true; }
    if (key === "outside-x") world.x = main.x+main.width+1;
    if (key === "airborne") world.y -= 3;
    if (key === "nan") main.width = NaN;
    expect(planCompanionGoal(brain, world, preferences, ports).action?.kind).not.toBe("sleep");
  });
  it("keeps the same actual food identity ahead of the optional alternate rest place", () => {
    const { world, brain, preferences, main } = fixture(); brain.hunger = .8;
    world.foods = [{ id: "actual-food", kind: "carrot", x: world.x, y: world.y, platformId: main.id }];
    const selected = getAction(brain, world, preferences, 70000, () => .5);
    expect(selected.foodId).toBe("actual-food"); expect(selected.kind).toBe("eat");
  });
  it("does not force a new local rest over a retained feed goal", () => {
    const { world, brain, preferences } = fixture();
    const owned = { ...brain, foodGoal: { foodId: "held-meal", remaining: 12, retryAfter: 0 } };
    expect(planCompanionGoal(owned, world, preferences, ports).action?.kind).not.toBe("sleep");
  });
});

// Standalone proposal snippet; original goal-continuity file is unchanged.
// Synthetic pure host acknowledges offered travel/control output. No native claim.
import { describe as quietDescribe, expect as quietExpect, it as quietIt } from "vitest";
import { createBrain as quietCreateBrain, type Platform as QuietPlatform } from "@/lib/ui/viewer-companion/brain";
import { createCompanionPersonalityDirector as quietCreateDirector, type PersonalitySceneInput as QuietInput } from "@/lib/ui/viewer-companion/personality-director";
import { DEFAULT_COMPANION_PREFERENCES as quietDefaults } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_PERSONALITY_SCENES as quietCatalog, type PersonalitySceneRecipe as QuietRecipe } from "@/lib/ui/viewer-companion/personality-scene-catalog";

const quietFloor: QuietPlatform = { id: "companion-home-floor", kind: "floor", manualOnly: true, x: 0, width: 400, y: 500 };
const quietSofa: QuietPlatform = { id: "companion-home", kind: "date", manualOnly: true, x: 40, width: 180, y: 460 };
const quietSource = (id: string) => quietCatalog.find(recipe => recipe.id === id)!;
const quietFixture = (recipes: QuietRecipe[] = []) => {
  const input: QuietInput = {
    world: { x: 100, y: 500, platformId: quietFloor.id, platforms: [quietFloor, quietSofa], width: 1100, height: 720, animated: true, foods: [] },
    brain: { ...quietCreateBrain(0, () => .5), energy: .9, hunger: .1, activeMs: 0 },
    preferences: { ...quietDefaults, enabled: true, roam: true, jump: true, personality: "homebody", learnFromYou: false }, now: 0,
    home: { floor: { x: 180, y: 500, platformId: quietFloor.id }, sofa: { x: 100, y: 460, platformId: quietSofa.id },
      window: { x: 260, y: 500, platformId: quietFloor.id }, curtain: { x: 260, y: 500, platformId: quietFloor.id },
      box: { x: 340, y: 500, platformId: quietFloor.id }, contacts: { curtain: { x: 260, y: 410 } } },
    toys: [], tv: "off", canCurtain: true, curtainPhase: "open", lightLit: true, radioPlaying: false,
  };
  const director = quietCreateDirector(recipes);
  const entry = director.next(input)!;
  quietExpect(entry.meta.id).toBe("entry-homebody"); director.complete(entry.meta); input.now += entry.action!.duration;
  const observe = () => director.observeProgress({ now: input.now, active: true,
    point: { x: input.world.x, y: input.world.y, platformId: input.world.platformId },
    carriedToyId: input.carriedToyId, carriedFoodId: input.carriedFoodId,
    controls: { tv: input.tv, light: input.lightLit, curtain: input.curtainPhase, radio: input.radioPlaying } });
  observe();
  const move = (platform: QuietPlatform, x = 100) => { input.world = { ...input.world, x, y: platform.y, platformId: platform.id }; observe(); };
  const drain = (id: string, applyControl = true, whole = true) => {
    let started = false; const kinds: string[] = [];
    for (let budget = 0; budget < 80; budget++) {
      const proposal = director.next(input);
      if (!proposal) { if (started && !director.active()) break; input.now += 10; continue; }
      started = true; quietExpect(proposal.meta.id).toBe(id); kinds.push(proposal.meta.command.kind);
      if (proposal.action) {
        if (["walk", "jump"].includes(proposal.action.kind)) input.world = { ...input.world, ...proposal.action.target };
        input.now += proposal.action.duration; input.brain.activeMs = input.now; observe();
      }
      const command = proposal.meta.command;
      if (proposal.meta.travel) { director.complete(proposal.meta); continue; }
      if (["tv", "light", "curtain", "radio"].includes(command.kind)) {
        if (applyControl) {
          if (command.kind === "curtain") input.curtainPhase = command.phase;
          if (command.kind === "light") input.lightLit = command.lit;
          if (command.kind === "radio") input.radioPlaying = command.playing;
          if (command.kind === "tv" && command.state !== "next") input.tv = command.state;
          observe();
        }
        director.resolve(proposal.meta, true, undefined, input.now);
      } else if (proposal.delegate) throw new Error("Pure comfort fixture must not invent object ACKs");
      else director.complete(proposal.meta);
      if (!director.active()) break;
    }
    quietExpect(started).toBe(true); quietExpect(director.active()).toBe(false);
    if (whole) quietExpect(director.completed()).toContain(id); else quietExpect(director.completed()).not.toContain(id);
    return { at: input.now, kinds };
  };
  return { input, director, recipes, move, observe, drain };
};
const quietSimple = (id: string, pose: "stretch" | "cozy-nest" = "stretch"): QuietRecipe => ({
  id, label: id, personality: "homebody", major: false, triggers: ["free"], steps: [{ kind: "go", target: "sofa" }, { kind: "pose", pose }],
});

quietDescribe("142 global quiet home cooldown preserves real work and selection", () => {
  quietIt("finishing actual H05 defers actual H12 across its different home support/family", () => {
    const f = quietFixture([quietSource("H05")]); const done = f.drain("H05");
    f.recipes.push(quietSource("H12")); f.move(quietSofa); f.input.now = done.at + 100;
    quietExpect(f.director.next(f.input)).toBeUndefined(); quietExpect(f.director.active()).toBe(false);
  });
  quietIt("finishing actual H12 defers actual H05 despite changing to the floor", () => {
    const f = quietFixture([quietSource("H12")]); const done = f.drain("H12");
    f.recipes.push(quietSource("H05")); f.input.now = done.at + 100; f.move(quietFloor, 300);
    quietExpect(f.director.next(f.input)).toBeUndefined();
  });
  quietIt("neither a world position/support change nor a new decision refills or clears the exact 12-second deadline", () => {
    const f = quietFixture([quietSimple("quiet-one")]); const done = f.drain("quiet-one");
    f.recipes.push(quietSimple("quiet-two")); f.input.now = done.at + 11999; f.move(quietFloor, 300);
    quietExpect(f.director.next(f.input)).toBeUndefined();
    f.input.now = done.at + 12000; quietExpect(f.director.next(f.input)?.meta.id).toBe("quiet-two");
  });
  quietIt("an abbreviated comfort itinerary does not refill global completion cooldown", () => {
    const recipe: QuietRecipe = { ...quietSimple("quiet-abbreviated"), steps: [{ kind: "go", target: "sofa" }, { kind: "pose", pose: "stretch" }, { kind: "go", target: "floor" }, { kind: "watch", ms: 650 }] };
    const f = quietFixture([recipe]); f.move(quietSofa, 100); f.input.now += 7500;
    const done = f.drain(recipe.id, true, false); quietExpect(done.kinds).not.toContain("pose");
    f.recipes.push(quietSimple("quiet-after-abbreviated")); f.move(quietSofa, 100); f.input.now = done.at + 100;
    quietExpect(f.director.next(f.input)?.meta.id).toBe("quiet-after-abbreviated");
  });
  quietIt.each(["pointer", "novel-place"] as const)("a nonlocal %s itinerary never arms home comfort cooldown", target => {
    const recipe: QuietRecipe = { ...quietSimple(`quiet-nonlocal-${target}`), steps: [{ kind: "go", target: "window" }, { kind: "go", target, optional: true }, { kind: "watch", ms: 650 }] };
    const f = quietFixture([recipe]); f.input.preferences.petting = true;
    f.input.world.pointer = { x: 260, y: 500, stableMs: 400 };
    if (target === "novel-place") {
      const ledge: QuietPlatform = { id: "real-new-card", kind: "card", x: 240, width: 100, y: 480 };
      f.input.world.platforms = [...f.input.world.platforms, ledge];
    }
    f.drain(recipe.id); f.recipes.push(quietSimple(`quiet-after-${target}`)); f.move(quietSofa, 100); f.input.now += 100;
    quietExpect(f.director.next(f.input)?.meta.id).toBe(`quiet-after-${target}`);
  });
  quietIt("cancelled/failed comfort never arms a success cooldown", () => {
    const f = quietFixture([quietSimple("quiet-cancel")]); quietExpect(f.director.next(f.input)).toBeTruthy(); f.director.cancel();
    f.recipes.push(quietSimple("quiet-after-cancel")); f.move(quietFloor, 300); f.input.now += 100;
    quietExpect(f.director.next(f.input)?.meta.id).toBe("quiet-after-cancel");
  });
  quietIt("a newly selected personality still issues its first greeting immediately", () => {
    const f = quietFixture([quietSimple("quiet-one")]); f.drain("quiet-one"); f.input.preferences.personality = "tidy";
    quietExpect(f.director.next(f.input)?.meta.id).toBe("entry-tidy");
  });
  quietIt("a real outside home visit remains eligible while the indoor comfort cooldown is live", () => {
    const f = quietFixture([quietSimple("quiet-one")]); f.drain("quiet-one"); f.recipes.push(quietSimple("quiet-visit"));
    const outside: QuietPlatform = { id: "real-card", kind: "card", x: 250, width: 120, y: 540 };
    f.input.world.platforms = [...f.input.world.platforms, outside]; f.move(outside, 300); f.input.now += 100;
    quietExpect(f.director.next(f.input)?.meta.id).toBe("quiet-visit");
  });
  quietIt("a differing reachable actual curtain state exempts the global guard", () => {
    const f = quietFixture([quietSimple("quiet-one")]); f.drain("quiet-one"); f.recipes.push(quietSource("H05"));
    f.input.curtainPhase = "closed"; f.move(quietFloor, 300); f.input.now += 100;
    quietExpect(f.director.next(f.input)?.meta.id).toBe("H05");
  });
  quietIt.each(["off", "missing-contact", "bad-platform", "unknown-state"] as const)("%s cannot fabricate a control-change exemption", mode => {
    const f = quietFixture([quietSimple("quiet-one")]); f.drain("quiet-one"); f.recipes.push(quietSource("H05"));
    f.input.curtainPhase = "closed"; f.move(quietFloor, 300); f.input.now += 100;
    if (mode === "off") f.input.canCurtain = false;
    if (mode === "missing-contact") f.input.home.contacts = {};
    if (mode === "bad-platform") f.input.home.curtain = { x: 260, y: 500, platformId: "not-a-real-support" };
    if (mode === "unknown-state") f.input.curtainPhase = undefined;
    quietExpect(f.director.next(f.input)).toBeUndefined();
  });
  quietIt("a real observed control change prevents the completed itinerary from arming quiet backoff", () => {
    const recipe: QuietRecipe = { ...quietSimple("quiet-control"), steps: [{ kind: "go", target: "window" }, { kind: "curtain", phase: "open" }, { kind: "watch", ms: 650 }] };
    const f = quietFixture([recipe]); f.input.curtainPhase = "closed"; f.drain(recipe.id); f.recipes.push(quietSimple("quiet-after-control"));
    f.move(quietSofa, 100); f.input.now += 100; quietExpect(f.director.next(f.input)?.meta.id).toBe("quiet-after-control");
  });
  quietIt("an unchanged already-open control plus travel is still quiet work", () => {
    const recipe: QuietRecipe = { ...quietSimple("quiet-unchanged"), steps: [{ kind: "go", target: "window" }, { kind: "curtain", phase: "open" }, { kind: "watch", ms: 650 }] };
    const f = quietFixture([recipe]); f.drain(recipe.id); f.recipes.push(quietSimple("quiet-after-unchanged")); f.move(quietSofa, 100); f.input.now += 100;
    quietExpect(f.director.next(f.input)).toBeUndefined();
  });
  quietIt("a positive setter ACK without an observed control change cannot erase quiet backoff", () => {
    const recipe: QuietRecipe = { ...quietSimple("quiet-unpainted-control"), steps: [{ kind: "go", target: "window" }, { kind: "curtain", phase: "open" }, { kind: "watch", ms: 650 }] };
    const f = quietFixture([recipe]); f.input.curtainPhase = "closed"; f.drain(recipe.id, false);
    f.recipes.push(quietSimple("quiet-after-unpainted-control")); f.move(quietSofa, 100); f.input.now += 100;
    quietExpect(f.input.curtainPhase).toBe("closed"); quietExpect(f.director.next(f.input)).toBeUndefined();
  });
  quietIt("a newly available real same-ID required return is never gated", () => {
    const f = quietFixture([quietSimple("quiet-one")]); f.drain("quiet-one"); f.move(quietFloor, 300);
    const recipe: QuietRecipe = { id: "quiet-real-return", label: "actual return", personality: "homebody", major: true, triggers: ["toy"], steps: [{ kind: "toy", mode: "return" }, { kind: "go", target: "sofa" }] };
    f.recipes.push(recipe); f.input.toys = [{ id: "actual-one", kind: "ball", x: 280, y: 500, platformId: quietFloor.id, angle: 0, held: false, carried: false }];
    quietExpect(f.director.next(f.input)).toMatchObject({ meta: { id: recipe.id, itemId: "actual-one" }, delegate: { kind: "toy", mode: "return" } });
  });
  quietIt("real newly available food inspection/eating bypasses the quiet guard", () => {
    const f = quietFixture([quietSimple("quiet-one")]); f.drain("quiet-one"); f.move(quietFloor, 300); f.input.brain.hunger = .7;
    f.input.world.foods = [{ id: "actual-food", kind: "carrot", x: 300, y: 500, platformId: quietFloor.id }];
    f.recipes.push({ id: "quiet-real-meal", label: "real meal", personality: "homebody", major: true, triggers: ["food"], steps: [{ kind: "food", mode: "eat" }, { kind: "go", target: "sofa" }] });
    quietExpect(f.director.next(f.input)).toMatchObject({ meta: { id: "quiet-real-meal", itemId: "actual-food" }, delegate: { kind: "food", mode: "eat" } });
  });
  quietIt.each(["meal", "wash", "sleep"] as const)("common urgent %s routine remains caller-owned, never blocked by quiet backoff", mode => {
    const f = quietFixture([quietSimple("quiet-one")]); f.drain("quiet-one");
    const recipe: QuietRecipe = { id: `routine-${mode}`, label: mode, personality: "homebody", major: true, triggers: ["free"], steps: [{ kind: "go", target: "floor" }, { kind: "watch", ms: 650 }] };
    quietExpect(f.director.startRoutine(recipe, f.input.now)).toBe(true); quietExpect(f.director.current()).toMatchObject({ id: recipe.id, routine: true });
  });
  quietIt("keeps the older platform-local family guard intact even after an actual control effect", () => {
    const recipe: QuietRecipe = { ...quietSimple("quiet-control-one"), steps: [{ kind: "go", target: "window" }, { kind: "curtain", phase: "open" }, { kind: "watch", ms: 650 }] };
    const f = quietFixture([recipe]); f.input.curtainPhase = "closed"; f.drain(recipe.id);
    f.recipes.push({ ...recipe, id: "quiet-control-two", steps: [{ kind: "go", target: "window" }, { kind: "curtain", phase: "shade" }, { kind: "watch", ms: 650 }] });
    f.input.now += 100; quietExpect(f.director.next(f.input)).toBeUndefined();
  });
});

import { describe,expect,it,vi } from 'vitest';
import { createBrain,commitAction,type CompanionAction,type CompanionWorld,type Platform } from '@/lib/ui/viewer-companion/brain';
import { createCompanionPersonalityActivity,companionLifePurpose } from '@/lib/ui/viewer-companion/personality-activity';
import { COMPANION_PERSONALITIES,DEFAULT_COMPANION_PREFERENCES,type CompanionPreferences } from '@/lib/ui/viewer-companion/preferences';
import { findCompanionToyRoute } from '@/lib/ui/viewer-companion/toys';
import { companionSofaSeat } from '@/lib/ui/viewer-companion/sofa';
import { sampleCompanionSofaTravel } from '@/lib/ui/viewer-companion/sofa-travel';
const floor:Platform={id:'companion-home-floor',kind:'floor',manualOnly:true,x:40,y:558.859,width:260};
const sofa:Platform={id:'companion-home',kind:'date',x:82,y:520.344,width:12};
const prefs={...DEFAULT_COMPANION_PREFERENCES,personality:'gourmet' as const,learnFromYou:false,feeding:false,sleep:true};
function host(){return{activity:createCompanionPersonalityActivity(()=>.5),world:{x:86.289,y:floor.y,platformId:floor.id,platforms:[floor,sofa],width:1920,height:1100,animated:true,foods:[]} as CompanionWorld,
 brain:{...createBrain(0,()=>.5),hunger:.05,energy:.53,activeMs:10000,visited:[floor.id,sofa.id]}};}
function finish(h:ReturnType<typeof host>,action:CompanionAction,at:number,preferences:CompanionPreferences=prefs){
 const from={x:h.world.x,y:h.world.y,platformId:h.world.platformId};
 h.activity.record(action,h.world,at,preferences.personality);h.brain=commitAction(h.brain,action,at);
 Object.assign(h.world,{x:action.target.x,y:action.target.y,platformId:action.target.platformId});
 expect(h.activity.recordArrival(action,from,h.world,preferences,at+action.duration)).toBe(true);
}
function returned(){const h=host();finish(h,h.activity.choose(h.brain,h.world,prefs,10000)!,10000);finish(h,h.activity.choose(h.brain,h.world,prefs,20000)!,20000);return h;}
const force=(h:ReturnType<typeof host>,at:number)=>h.activity.choose(h.brain,h.world,prefs,at,{deadline:at,nextDuration:1});
describe('142 actual arrived ordinary travel avoids empty two-surface loops',()=>{
 it.each(COMPANION_PERSONALITIES)('%s keeps real route arrivals then replaces the next reverse with an available48px floor walk',personality=>{
  const h=host(),p={...prefs,personality};
  finish(h,h.activity.choose(h.brain,h.world,p,10000)!,10000,p);
  // The narrow sofa has no safe48px walk. Returning to its actual floor is
  // still allowed as the only physically proved escape.
  finish(h,h.activity.choose(h.brain,h.world,p,20000)!,20000,p);
  const next=h.activity.choose(h.brain,h.world,p,30000)!;
  expect(next.kind).toBe('walk');expect(next.target.platformId).toBe(floor.id);expect(Math.abs(next.target.x-h.world.x)).toBeGreaterThanOrEqual(48);
  expect(findCompanionToyRoute(h.world,next.target,h.world.platforms,true)?.[0]).toMatchObject({kind:'walk',target:{platformId:floor.id}});
 });
 it('applies the same real alternative to an unowned getAction-like reverse jump even before8s activity cadence',()=>{
  const h=returned(),proven=findCompanionToyRoute(h.world,{x:88,y:sofa.y,platformId:sofa.id},h.world.platforms,true)![0];
  const raw={...proven,duration:950};
  expect(h.activity.due(22000)).toBe(false);
  const selected=h.activity.diversifyTravel(raw,h.brain,h.world,prefs,22000,()=>force(h,22000));
  expect(selected).toMatchObject({kind:'walk',target:{platformId:floor.id}});expect(Math.abs(selected.target.x-h.world.x)).toBeGreaterThanOrEqual(48);
 });
 it('never remembers a proposed or merely launched jump as a completed arrival',()=>{
  const h=host(),offered=h.activity.choose(h.brain,h.world,prefs,10000)!;h.activity.record(offered,h.world,10000,'gourmet');
  expect(h.activity.recordArrival(offered,{...h.world},h.world,prefs,11000)).toBe(false);
  const fresh=host();Object.assign(fresh.world,{x:88,y:sofa.y,platformId:sofa.id});
  const down=fresh.activity.choose(fresh.brain,fresh.world,prefs,20000)!;
  expect(down.target.platformId).toBe(floor.id); // No fictitious success history.
 });
 it('expires only the transient reverse preference after20foreground seconds',()=>{
  const h=returned();const later=h.activity.choose(h.brain,h.world,prefs,42000)!;
  expect(later.target.platformId).toBe(sofa.id);
 });
 it('tries another proved non-reverse destination before reusing the same first hop',()=>{
  const h=returned();h.world.platforms=[floor,sofa,{id:'safe-third',kind:'date',x:170,y:490,width:18}];
  const selected=force(h,22000)!;expect(selected.target.platformId).not.toBe(sofa.id);expect(Math.hypot(selected.target.x-h.world.x,selected.target.y-h.world.y)).toBeGreaterThanOrEqual(24);
 });
 it('respects blocked destination/first-hop TTL and uses the actual floor walk instead',()=>{
  const h=returned();h.world.platforms=[floor,sofa,{id:'blocked-third',kind:'date',x:170,y:490,width:18}];
  h.brain.places=[{id:'blocked-third',visits:0,failures:1,retryAfter:30000}];
  expect(force(h,22000)).toMatchObject({kind:'walk',target:{platformId:floor.id}});
 });
 it.each(['authored','food','toy','household','sleep','rest-goal','explore-goal','episode','social','owned','OFF','roam-OFF','paused'] as const)('preserves %s and never draws an ordinary alternative',owner=>{
  const h=returned(),raw:CompanionAction&{personalityScene?:unknown;toy?:unknown;household?:unknown}={kind:'jump',duration:950,target:{x:88,y:sofa.y,platformId:sofa.id}};
  const p={...prefs};
  if(owner==='authored')raw.personalityScene={id:'kept'};
  if(owner==='food')raw.foodId='same-real-food';if(owner==='toy')raw.toy={};if(owner==='household')raw.household={};if(owner==='sleep')raw.kind='sleep';
  if(owner==='rest-goal'||owner==='explore-goal')raw.intention={kind:owner==='rest-goal'?'rest':'explore',remaining:5,targetId:sofa.id,offset:.5,stage:'travel'};
  if(owner==='episode')raw.episode={kind:'wake',phase:'start',remaining:1,variant:'careful',mishapUsed:true,legs:0};
  if(owner==='social')raw.attention={kind:'social',point:{x:88,y:520}};
  if(owner==='OFF')p.enabled=false;if(owner==='roam-OFF')p.roam=false;if(owner==='paused')h.world.paused=true;
  const alternate=vi.fn(()=>force(h,22000));expect(h.activity.diversifyTravel(raw,h.brain,h.world,p,22000,alternate,owner==='owned')).toBe(raw);expect(alternate).not.toHaveBeenCalled();
 });
 it.each(['missing','bodyOnly','other-manual','off-surface','not-arrived','zero-distance','old-at','invalid-at'] as const)('rejects %s arrival without manufacturing a success',defect=>{
  const h=host(),raw=h.activity.choose(h.brain,h.world,prefs,10000)!,from={x:h.world.x,y:h.world.y,platformId:h.world.platformId};
  Object.assign(h.world,{x:raw.target.x,y:raw.target.y,platformId:raw.target.platformId});let at=11000;
  if(defect==='missing')h.world.platforms=[floor];if(defect==='bodyOnly')h.world.platforms=[floor,{...sofa,bodyOnly:true}];if(defect==='other-manual')h.world.platforms=[floor,{...sofa,manualOnly:true}];
  if(defect==='off-surface')h.world.y+=8;if(defect==='not-arrived')h.world.x+=8;if(defect==='zero-distance')Object.assign(from,{x:h.world.x,y:h.world.y,platformId:sofa.id});
  if(defect==='old-at'){expect(h.activity.recordArrival(raw,from,h.world,prefs,11000)).toBe(true);at=10999;}if(defect==='invalid-at')at=NaN;
  expect(h.activity.recordArrival(raw,from,h.world,prefs,at)).toBe(false);
 });
 it('stores at most six real arrivals without persisting or retaining an older reverse forever',()=>{
  const h=host(),planes=Array.from({length:8},(_,index)=>({id:`plane-${index}`,kind:'floor' as const,x:0,y:550,width:1000}));h.world.platforms=planes;
  for(let index=0;index<7;index++){
   const from={x:70+index*30,y:550,platformId:planes[index].id},action:CompanionAction={kind:'jump',target:{x:100+index*30,y:550,platformId:planes[index+1].id},duration:1};
   Object.assign(h.world,action.target);expect(h.activity.recordArrival(action,from,h.world,prefs,100+index*100)).toBe(true);
  }
  const expiredDraw=vi.fn(()=>undefined);Object.assign(h.world,{x:100,y:550,platformId:planes[1].id});
  h.activity.diversifyTravel({kind:'jump',target:{x:70,y:550,platformId:planes[0].id},duration:1},h.brain,h.world,prefs,800,expiredDraw);expect(expiredDraw).not.toHaveBeenCalled();
  Object.assign(h.world,{x:280,y:550,platformId:planes[7].id});const recentDraw=vi.fn(()=>undefined);
  h.activity.diversifyTravel({kind:'jump',target:{x:250,y:550,platformId:planes[6].id},duration:1},h.brain,h.world,prefs,800,recentDraw);expect(recentDraw).toHaveBeenCalledOnce();
 });
 it('keeps a proved original escape when no valid floor span or alternative remains',()=>{
  const h=returned(),raw:CompanionAction={kind:'jump',duration:950,target:{x:88,y:sofa.y,platformId:sofa.id}};
  h.world.platforms=[sofa];const draw=vi.fn(()=>force(h,22000));expect(h.activity.diversifyTravel(raw,h.brain,h.world,prefs,22000,draw)).toBe(raw);
 });
});

describe('142 coarse painted purpose has fixed vocabulary and no success semantics',()=>{
 const base:CompanionAction={kind:'walk',duration:900,target:{x:100,y:600,platformId:'synthetic-private-target-canary'}};
 it.each([
  [{...base},'ordinary'],[{...base,personalitySignature:'gourmet'},'ordinary'],[{...base,intention:{kind:'explore',targetId:'id',stage:'travel',remaining:3,offset:.5}},'explore'],
  [{...base,foodId:'id'},'food'],[{...base,kind:'eat'},'food'],[{...base,foodCuriosity:'inspect'},'food'],[{...base,kind:'heart'},'social'],[{...base,toy:{id:'id'}},'toy'],[{...base,kind:'sleep'},'care'],
  [{...base,intention:{kind:'rest',targetId:'id',stage:'travel',remaining:3,offset:.5}},'care'],[{...base,attention:{kind:'social',point:{x:1,y:2}}},'social'],
  [{...base,personalityScene:{id:'id'}},'authored'],[{...base,scene:{id:13}},'authored'],[{...base,household:{}},'food'],
 ] as const)('classifies action metadata as %s without copying its identity', (action,expected)=>{
  const value=companionLifePurpose(action as CompanionAction);expect(value).toBe(expected);expect(value).not.toContain('canary');expect(['ordinary','explore','food','toy','care','social','authored']).toContain(value);
 });
});


describe('142 actual same-floor endpoints avoid repeated ordinary A-to-B walks',()=>{
 function horizontal(personality:CompanionPreferences['personality']='gourmet') {
  const h=host(),p={...prefs,personality};h.world.platforms=[floor];h.brain.heading=1;
  const first=h.activity.choose(h.brain,h.world,p,10000)!;
  expect(first).toMatchObject({kind:'walk',target:{x:186.289,platformId:floor.id}});
  finish(h,first,10000,p);return{h,p,first};
 }
 function provedReverse(h:ReturnType<typeof host>,x=86.289):CompanionAction {
  const step=findCompanionToyRoute(h.world,{x,y:floor.y,platformId:floor.id},h.world.platforms,true)?.[0];
  expect(step?.kind).toBe('walk');return{...step!,duration:1500,direction:x<h.world.x?-1:1};
 }
 it.each(COMPANION_PERSONALITIES)('%s commits A-to-B and chooses an actual safe C instead of retracing B-to-A',personality=>{
  const {h,p}=horizontal(personality),raw=provedReverse(h),fromB=h.world.x;
  // getAction may offer the opposite heading. No memory is recorded until
  // its replacement actually arrives through the existing commit boundary.
  h.brain.heading=-1;
  const chosen=h.activity.diversifyTravel(raw,h.brain,h.world,p,20000,()=>h.activity.choose(h.brain,h.world,p,20000,{deadline:20000,nextDuration:1}))!;
  expect(chosen.kind).toBe('walk');expect(chosen.target.platformId).toBe(floor.id);
  expect(chosen.target.x).toBeGreaterThanOrEqual(fromB+48);expect(chosen.target.x).toBeLessThanOrEqual(floor.x+floor.width);
  expect(findCompanionToyRoute(h.world,chosen.target,h.world.platforms,true)?.[0]?.target).toEqual(chosen.target);
  finish(h,chosen,20000,p);expect(h.brain.heading).toBe(1);
  // At the far edge, another distance is preferable to the just-completed
  // 100px reverse. A local same-support route remains physically provable.
  const next=h.activity.choose(h.brain,h.world,p,30000,{deadline:30000,nextDuration:1})!;
  expect(next.kind).toBe('walk');expect(next.target.platformId).toBe(floor.id);
  expect(Math.abs(next.target.x-fromB)).toBeGreaterThan(24);
  expect(Math.abs(next.target.x-h.world.x)).toBeGreaterThanOrEqual(48);
 });
 it('uses a proved48px intermediate point when a narrow real floor cannot continue another100px',()=>{
  const h=host(),span={...floor,x:62,width:150.16};h.world.platforms=[span];
  const first=findCompanionToyRoute(h.world,{x:186.289,y:span.y,platformId:span.id},h.world.platforms,true)?.[0];
  expect(first?.kind).toBe('walk');finish(h,{...first!,duration:1500,direction:1},10000);h.brain.heading=-1;
  const raw=provedReverse(h),chosen=h.activity.diversifyTravel(raw,h.brain,h.world,prefs,20000,()=>h.activity.choose(h.brain,h.world,prefs,20000,{deadline:20000,nextDuration:1}));
  expect(chosen).toMatchObject({kind:'walk',target:{x:138.289,y:span.y,platformId:span.id}});
  expect(Math.abs(chosen.target.x-h.world.x)).toBeGreaterThanOrEqual(48);
  expect(findCompanionToyRoute(h.world,chosen.target,h.world.platforms,true)?.[0]?.target).toEqual(chosen.target);
 });
 it('also defers an actual reverse first hop toward a different nominal platform',()=>{
  const h=host(),broad={...floor,id:'ordinary-floor',manualOnly:false,width:600};h.world.platforms=[broad];h.world.platformId=broad.id;
  // A genuine takeoff walk remains necessary beyond the exact hop's range.
  finish(h,{kind:'walk',target:{x:386.289,y:broad.y,platformId:broad.id},duration:1500,direction:1},10000);
  const left:Platform={id:'left-landing',kind:'date',x:70,y:broad.y-70,width:40};h.world.platforms=[...h.world.platforms,left];
  const route=findCompanionToyRoute(h.world,{x:90,y:left.y,platformId:left.id},h.world.platforms,true);
  expect(route?.[0]).toMatchObject({kind:'walk',target:{x:90,platformId:broad.id}});
  const chosen=h.activity.choose(h.brain,h.world,prefs,20000,{deadline:20000,nextDuration:1})!;
  expect(chosen.kind).toBe('walk');expect(chosen.target.platformId).toBe(broad.id);expect(chosen.target.x).toBeGreaterThanOrEqual(h.world.x+48);
 });
 it('keeps actual same-floor alternatives available with automatic jumping OFF',()=>{
  const {h}=horizontal(),p={...prefs,jump:false},raw=provedReverse(h);
  const chosen=h.activity.diversifyTravel(raw,h.brain,h.world,p,20000,()=>h.activity.choose(h.brain,h.world,p,20000,{deadline:20000,nextDuration:1}));
  expect(chosen.kind).toBe('walk');expect(chosen.target.x).toBeGreaterThanOrEqual(h.world.x+48);
  expect(findCompanionToyRoute(h.world,chosen.target,h.world.platforms,false)?.[0]?.target).toEqual(chosen.target);
 });
 it('uses endpoint coordinates, so a different ordinary walk on that floor is not globally suppressed',()=>{
  const {h}=horizontal(),raw=provedReverse(h,246.289),draw=vi.fn(()=>undefined);
  expect(h.activity.diversifyTravel(raw,h.brain,h.world,prefs,20000,draw)).toBe(raw);expect(draw).not.toHaveBeenCalled();
 });
 it.each([0,24])('recognizes a reverse ending within the actual endpoint tolerance(%ipx)',offset=>{
  const {h}=horizontal(),raw=provedReverse(h,86.289+offset),draw=vi.fn(()=>undefined);
  expect(h.activity.diversifyTravel(raw,h.brain,h.world,prefs,20000,draw)).toBe(raw);expect(draw).toHaveBeenCalledOnce();
 });
 it('does not treat a target more than24px beyond the prior origin as that same reverse endpoint',()=>{
  const {h}=horizontal(),raw=provedReverse(h,111.29),draw=vi.fn(()=>undefined);
  expect(h.activity.diversifyTravel(raw,h.brain,h.world,prefs,20000,draw)).toBe(raw);expect(draw).not.toHaveBeenCalled();
 });
 it('requires the current starting point to match the actual prior arrival as well',()=>{
  const {h}=horizontal();h.world.x=260;const raw=provedReverse(h),draw=vi.fn(()=>undefined);
  expect(h.activity.diversifyTravel(raw,h.brain,h.world,prefs,20000,draw)).toBe(raw);expect(draw).not.toHaveBeenCalled();
 });
 it('expires a completed same-floor preference after20active seconds without changing the original action',()=>{
  const {h,first}=horizontal(),raw=provedReverse(h),draw=vi.fn(()=>undefined),expiredAt=10000+first.duration+20000;
  expect(h.activity.diversifyTravel(raw,h.brain,h.world,prefs,expiredAt,draw)).toBe(raw);expect(draw).not.toHaveBeenCalled();
 });
 it('does not count a same-floor route proposal or launch as an actual arrival',()=>{
  const h=host();h.world.platforms=[floor];const raw=provedReverse(h,186.289),from={...h.world};
  h.activity.record(raw,from,10000,'gourmet');h.brain=commitAction(h.brain,raw,10000);
  expect(h.activity.recordArrival(raw,from,h.world,prefs,11500)).toBe(false);
  Object.assign(h.world,{x:raw.target.x,y:raw.target.y,platformId:floor.id});const back=provedReverse(h),draw=vi.fn(()=>undefined);
  expect(h.activity.diversifyTravel(back,h.brain,h.world,prefs,12000,draw)).toBe(back);expect(draw).not.toHaveBeenCalled();
 });
 it('keeps a sole safe same-floor escape when every alternative is the same clamped reverse',()=>{
  const h=host(),narrow={...floor,width:80};h.world.platforms=[narrow];h.world.x=52;
  const first:CompanionAction={kind:'walk',target:{x:108,y:narrow.y,platformId:narrow.id},duration:1500,direction:1};finish(h,first,10000);
  const raw=provedReverse(h,52),selected=h.activity.diversifyTravel(raw,h.brain,h.world,prefs,20000,()=>h.activity.choose(h.brain,h.world,prefs,20000,{deadline:20000,nextDuration:1}));
  expect(selected).toMatchObject({kind:'walk',target:{x:52,y:narrow.y,platformId:narrow.id}});
  expect(findCompanionToyRoute(h.world,selected.target,h.world.platforms,true)?.[0]?.target).toEqual(selected.target);
 });
 it.each(['explore','food','care','authored','toy','owned','OFF','roam-OFF','paused'] as const)('keeps %s ownership on the same-floor reverse',owner=>{
  const {h}=horizontal(),raw:CompanionAction&{personalityScene?:unknown;toy?:unknown}=provedReverse(h),p={...prefs};
  if(owner==='explore'||owner==='care')raw.intention={kind:owner==='explore'?'explore':'rest',remaining:4,targetId:floor.id,offset:.2,stage:'travel'};
  if(owner==='food')raw.foodId='actual-meal';if(owner==='authored')raw.personalityScene={id:'same-work'};if(owner==='toy')raw.toy={};
  if(owner==='OFF')p.enabled=false;if(owner==='roam-OFF')p.roam=false;if(owner==='paused')h.world.paused=true;
  const draw=vi.fn(()=>undefined);expect(h.activity.diversifyTravel(raw,h.brain,h.world,p,20000,draw,owner==='owned')).toBe(raw);expect(draw).not.toHaveBeenCalled();
 });
});


describe('142 a dense calendar cannot starve the real cushion-to-floor exit',()=>{
 const seatDom={left:62.28125,right:143.296875,top:554.453125};
 // The observed81px DOM opening is not the physical support. Geometry uses
 // the same body margin as every real sofa, leaving this5.095625px interval.
 const actualSeat:Platform={id:'companion-home',kind:'date',...companionSofaSeat(seatDom,92)!};
 const roomFloor:Platform={id:'companion-home-floor',kind:'floor',manualOnly:true,x:62.28125,y:595.1875,width:178.165};
 const farDates:Platform[]=Array.from({length:12},(_,index)=>({id:`dense-unvisited-${index}`,kind:'date',x:400+index*140,y:590.424,width:20}));
 function dense(personality:CompanionPreferences['personality']='gourmet',seat=actualSeat){
  const h=host(),p={...prefs,personality,feeding:true,sleep:false};
  Object.assign(h.world,{x:102.7890625,y:seat.y,platformId:seat.id,platforms:[seat,...farDates,roomFloor]});
  h.brain={...h.brain,energy:.9,hunger:.05,activeMs:10000,heading:1,visited:[roomFloor.id,seat.id]};
  const prior:CompanionAction={kind:'jump',target:{x:h.world.x,y:h.world.y,platformId:seat.id},duration:2000};
  expect(h.activity.recordArrival(prior,{x:228.165,y:roomFloor.y,platformId:roomFloor.id},h.world,p,8000)).toBe(true);
  return{h,p};
 }
 it.each(COMPANION_PERSONALITIES)('%s admits its visited measured floor within the existing eight proofs and actually arrives',personality=>{
  const {h,p}=dense(personality);expect(actualSeat.width).toBeCloseTo(5.095625,7);
  const action=h.activity.choose(h.brain,h.world,p,10000,{deadline:10000,nextDuration:1})!;
  expect(action).toMatchObject({kind:'jump',target:{x:h.world.x,y:roomFloor.y,platformId:roomFloor.id}});
  expect(findCompanionToyRoute(h.world,action.target,h.world.platforms,p.jump)?.[0]).toMatchObject({kind:action.kind,target:action.target});
  finish(h,action,10000,p);expect(h.world.platformId).toBe(roomFloor.id);
 });
 it('keeps the floor passage safe under the same body containment and SVG rim contract',()=>{
  const {h,p}=dense(),action=h.activity.choose(h.brain,h.world,p,10000,{deadline:10000,nextDuration:1})!;
  // Reconstruct the fixed CSS17.75% opening/model SVG180:100 bounds. This
  // is a pure passage model, not an additional captured native bed DOMRect.
  const width=(seatDom.right-seatDom.left)/.645,left=seatDom.left-width*.1775,bottom=seatDom.top+2+20.28,height=width*100/180,top=bottom-height;
  const passage=sampleCompanionSofaTravel(h.world,action.target,.5,Math.max(100,top+height*.19-92*.24-8),{left,right:left+width,bodyHalfWidth:92*.38+3,ceiling:100});
  expect(passage.safe).toBe(true);expect(passage.x).toBe(h.world.x);
 });
 it('finishes a proved multi-hop escape from a wider safe seat instead of endlessly reversing its local walk',()=>{
  // A separate wider-support model covers the cushion's required alignment. It is
  // intentionally distinct from the observed native81px DOM opening above.
  const {h,p}=dense('gourmet',{...actualSeat,x:62.28125,width:81.015625});let now=10000;
  const legs:{kind:string;support:string|undefined;from:number;to:number}[]=[];
  for(let step=0;step<6&&h.world.platformId!==roomFloor.id;step++){
   const action=h.activity.choose(h.brain,h.world,p,now,{deadline:now,nextDuration:1})!;expect(action).toBeDefined();
   expect(findCompanionToyRoute(h.world,action.target,h.world.platforms,p.jump)?.[0]).toMatchObject({kind:action.kind,target:action.target});
   const from=h.world.x;finish(h,action,now,p);legs.push({kind:action.kind,support:h.world.platformId,from,to:h.world.x});now+=action.duration+250;
  }
  expect(h.world.platformId).toBe(roomFloor.id);expect(legs.length).toBeLessThanOrEqual(4);
  expect(legs[0].kind).toBe('walk');expect(legs.at(-1)).toMatchObject({kind:'jump',support:roomFloor.id});
 });
 it('retains novel reachable destination priority before the reserved floor',()=>{
  const {h,p}=dense(),near:Platform={id:'novel-reachable',kind:'date',x:240,y:590.424,width:20};
  h.world.platforms=[...h.world.platforms,near];
  const selected=h.activity.choose(h.brain,h.world,p,10000,{deadline:10000,nextDuration:1})!;
  expect(selected.target.platformId).toBe(near.id);
  expect(findCompanionToyRoute(h.world,selected.target,h.world.platforms,true)?.[0]).toMatchObject({kind:selected.kind,target:selected.target});
 });
 it.each(['missing-floor','body-only-floor','other-manual-floor','blocked-floor','jump-OFF','roam-OFF','disabled','paused','not-animated'] as const)('rejects %s rather than manufacturing a cushion exit',defect=>{
  const {h,p}=dense();
  if(defect==='missing-floor')h.world.platforms=h.world.platforms.filter(platform=>platform.id!==roomFloor.id);
  if(defect==='body-only-floor')h.world.platforms=h.world.platforms.map(platform=>platform.id===roomFloor.id?{...platform,bodyOnly:true}:platform);
  if(defect==='other-manual-floor')h.world.platforms=h.world.platforms.map(platform=>platform.id===roomFloor.id?{...platform,id:'other-private-manual'}:platform);
  if(defect==='blocked-floor')h.brain.places=[{id:roomFloor.id,visits:0,failures:1,retryAfter:30000}];
  if(defect==='jump-OFF')p.jump=false;if(defect==='roam-OFF')p.roam=false;if(defect==='disabled')p.enabled=false;
  if(defect==='paused')h.world.paused=true;if(defect==='not-animated')h.world.animated=false;
  expect(h.activity.choose(h.brain,h.world,p,10000,{deadline:10000,nextDuration:1})).toBeUndefined();
 });
 it('restores admission only after the existing actual failed-place TTL expires',()=>{
  const {h,p}=dense();h.brain.places=[{id:roomFloor.id,visits:0,failures:1,retryAfter:30000}];
  expect(h.activity.choose(h.brain,h.world,p,29999,{deadline:29999,nextDuration:1})).toBeUndefined();
  expect(h.activity.choose(h.brain,h.world,p,30000,{deadline:30000,nextDuration:1})).toMatchObject({kind:'jump',target:{platformId:roomFloor.id}});
 });
});

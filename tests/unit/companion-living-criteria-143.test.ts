import { describe, it, expect } from "vitest";
import { inspectLivingContext, traceLivingContextComplete, measuredPersonalToyPlay } from "../../scripts/companion-qa/living-criteria.mjs";
import type { QaFrame } from "../../scripts/companion-qa/trace-checks.mjs";
const frame = (at: number, extra: Partial<QaFrame> = {}): QaFrame => ({at,x:120,y:400,visible:true,decoded:true,state:"look",enabled:true,eligible:true,roam:true,blocked:false,owned:false,platform:"companion-home-floor",personality:"curious",hunger:.1,energy:.9,outsideVisible:true,items:"",carried:"",controls:"",command:"",playPaint:"other",...extra});
const sequence = (seconds: number, extra: Partial<QaFrame> = {}) => Array.from({length:seconds*10+1},(_,i)=>frame(i*100,extra));
describe("143 living context uses observed place and actual contact",()=>{
  it("does not promote older traces missing place, care or source context",()=>{
    expect(traceLivingContextComplete([])).toBe(false);expect(traceLivingContextComplete(sequence(1))).toBe(false);
    const frames=sequence(1).map(f=>({...f,play:"",jumpSource:false}));expect(traceLivingContextComplete(frames)).toBe(true);
    expect(traceLivingContextComplete(frames.map(f=>({...f,hunger:NaN})))).toBe(false);
  });
  it("finds an awake explorer confined inside despite changing poses",()=>{
    const frames=sequence(36).map((f,i)=>({...f,pose:i%16,beat:String(i)}));
    expect(inspectLivingContext(frames).findings.map(f=>f.rule)).toContain("awake-confined-home");
  });
  it.each(["homebody","sleepy"])("allows %s to stay home",personality=>{
    expect(inspectLivingContext(sequence(90,{personality})).findings).toEqual([]);
  });
  it.each([{hunger:.9},{energy:.1},{outsideVisible:false},{owned:true},{blocked:true},{hunger:undefined}])("does not invent an outing opportunity during %j",extra=>{
    expect(inspectLivingContext(sequence(90,extra)).findings).toEqual([]);
  });
  it("real outside travel resets the confinement window",()=>{
    const frames=sequence(60).map(f=>f.at===30000?{...f,platform:"date-1",state:"walk",walkSource:true,x:180}:f);
    expect(inspectLivingContext(frames).findings).toEqual([]);
  });
  it("flags voluntary house cheering but allows an actual recent pet",()=>{
    const cheer=frame(1200,{play:"cheer-rehearsal",state:"play",playPaint:"matching"});
    expect(inspectLivingContext([cheer]).findings.map(f=>f.rule)).toContain("voluntary-audience-inside-home");
    expect(inspectLivingContext([frame(0,{state:"petted"}),...sequence(2).map(f=>({...f,at:f.at+100,play:"lean-nuzzle",state:"play",playPaint:"matching" as const}))]).findings).toEqual([]);
  });
  it("flags three purposeless sofa resets while allowing TV or rest",()=>{
    const frames=sequence(8).map((f,i)=>({...f,platform:[10,30,50].includes(i)?"companion-home":"companion-home-floor"}));
    expect(inspectLivingContext(frames).findings.map(f=>f.rule)).toContain("repeated-sofa-reset");
    expect(inspectLivingContext(frames.map(f=>({...f,command:"watch"}))).findings).toEqual([]);
  });
  it("credits decoded actual outside movement, not labels at a fixed point",()=>{
    const moving=sequence(1,{platform:"date-1",state:"walk",walkSource:true}).map((f,i)=>({...f,x:120+i}));
    expect(inspectLivingContext(moving).positiveWitnesses.map(f=>f.rule)).toContain("decoded-outside-walk");
    expect(inspectLivingContext(sequence(1,{platform:"date-1",state:"jump",jumpSource:true})).positiveWitnesses).toEqual([]);
  });
});


describe("143 actual private toy hug context",()=>{
  const body={x:74,y:308,width:92,height:92};
  const toy=(carried=true)=>({id:"toy-actual",carried,held:false,falling:!carried,visible:true,decoded:true,rect:{x:109,y:354,width:24,height:28},imageRect:{x:109,y:354,width:24,height:28}});
  const measured=(at:number,carried=true):QaFrame=>frame(at,{personality:"affectionate",state:"play",play:"lean-nuzzle",playPaint:"matching",humanEpoch:2,layoutEpoch:0,carried:carried?"toy-actual":"",toyPlay:{body,source:true,toys:[toy(carried)]}});
  const hug=()=>[{...measured(0),state:"sniff",play:""},measured(80),measured(160),measured(240,false),measured(400,false),measured(640,false),measured(800,false)];
  it("accepts actual same-ID carried close painted toy and only its finite release tail",()=>{
    const frames=hug();expect(measuredPersonalToyPlay(frames)).toHaveLength(6);
    expect(inspectLivingContext(frames).findings).toEqual([]);
    expect(inspectLivingContext(frames).positiveWitnesses.map(f=>f.rule)).toContain("private-toy-play");
    const expired=measured(881,false);expect(measuredPersonalToyPlay([...frames,expired]).map(f=>f.at)).not.toContain(881);
    expect(inspectLivingContext([...frames,expired]).findings.map(f=>f.rule)).toContain("voluntary-audience-inside-home");
  });
  it("requires a pair of actual carry samples before accepting a lean",()=>{
    expect(measuredPersonalToyPlay([measured(0)])).toEqual([]);
    expect(measuredPersonalToyPlay([measured(0),measured(20)])).toEqual([]);
  });
  it.each(["missing","hidden","undecoded","far","image-far","held","wrong-id","raw-label-only","wrong-source","invalid-body","human","layout"])("does not exempt %s",kind=>{
    const frames=hug().map(f=>{const q=structuredClone(f);if(kind==="missing")delete q.toyPlay;
      else if(kind==="hidden")q.toyPlay!.toys[0].visible=false;
      else if(kind==="undecoded")q.toyPlay!.toys[0].decoded=false;
      else if(kind==="far")q.toyPlay!.toys[0].rect!.x=900;
      else if(kind==="image-far")q.toyPlay!.toys[0].imageRect!.x=900;
      else if(kind==="held")q.toyPlay!.toys[0].held=true;
      else if(kind==="wrong-id")q.toyPlay!.toys[0].id="different";
      else if(kind==="raw-label-only")q.carried="";
      else if(kind==="wrong-source")q.toyPlay!.source=false;
      else if(kind==="invalid-body")q.toyPlay!.body!.x=NaN;
      else if(kind==="human")q.humanEpoch=f.at;
      else if(kind==="layout")q.layoutEpoch=f.at;
      return q;});
    expect(measuredPersonalToyPlay(frames)).toEqual([]);
    expect(inspectLivingContext(frames).findings.map(f=>f.rule)).toContain("voluntary-audience-inside-home");
  });
  it.each(["ask-petting","cheer-rehearsal"])("actual held toy never excuses user-directed %s",play=>{
    const frames=hug().map(f=>({...f,play}));expect(measuredPersonalToyPlay(frames)).toEqual([]);
    expect(inspectLivingContext(frames).findings.map(f=>f.rule)).toContain("voluntary-audience-inside-home");
  });
  it("does not let another object's presence extend an old release",()=>{
    const frames=hug();const wrong=measured(880,false);wrong.toyPlay!.toys[0].id="toy-other";
    expect(measuredPersonalToyPlay([...frames,wrong]).map(f=>f.at)).not.toContain(880);
  });
  it("does not promote old raw merely carrying a label or same-ID token",()=>{
    const frames=hug().map(f=>({...f,toyPlay:undefined,lifePurpose:"toy"}));
    expect(measuredPersonalToyPlay(frames)).toEqual([]);expect(inspectLivingContext(frames).findings.length).toBeGreaterThan(0);
  });
});

it("a physically carried toy never excuses an explicit user-directed cheer command",()=>{
 const body={x:74,y:308,width:92,height:92},toy={id:"actual",carried:true,held:false,falling:false,visible:true,decoded:true,rect:{x:109,y:354,width:24,height:28},imageRect:{x:109,y:354,width:24,height:28}};
 const frames=[0,80,160].map(at=>frame(at,{state:"play",play:"lean-nuzzle",playPaint:"matching",command:"cheer",humanEpoch:1,layoutEpoch:0,carried:"actual",toyPlay:{body,source:true,toys:[toy]}}));
 expect(measuredPersonalToyPlay(frames)).toEqual([]);expect(inspectLivingContext(frames).findings.map(f=>f.rule)).toContain("voluntary-audience-inside-home");
});

describe("143 a cold lean label is distinct from its actually painted source",()=>{
 const body={x:74,y:308,width:92,height:92};
 const toy={id:"actual-same-toy",carried:true,held:false,falling:false,visible:true,decoded:true,rect:{x:109,y:354,width:24,height:28},imageRect:{x:109,y:354,width:24,height:28}};
 const observed=(at:number,paint:NonNullable<QaFrame["playPaint"]>,pose:number):QaFrame=>frame(at,{personality:"affectionate",state:"play",play:"lean-nuzzle",playPaint:paint,pose,humanEpoch:5,layoutEpoch:0,carried:toy.id,toyPlay:{body,source:paint==="matching",toys:[{...toy}]}});
 it("does not turn the observed idle-row cold frame into either audience or private-toy progress",()=>{
  const first={...observed(0,"other",1),state:"sniff",play:""},cold=observed(80,"other",1),warm=observed(160,"matching",513);
  const samples=[first,cold,warm],witnesses=measuredPersonalToyPlay(samples);
  expect(witnesses.map(w=>w.at)).toEqual([160]);expect(inspectLivingContext(samples).findings).toEqual([]);
  expect(inspectLivingContext([first,cold]).positiveWitnesses).toEqual([]);
 });
 it("actual matching lean without a proved same-ID visible toy is still user-directed inside",()=>{
  const actual={...observed(160,"matching",513),carried:"",toyPlay:{body,source:true,toys:[]}};
  expect(inspectLivingContext([actual]).findings.map(f=>f.rule)).toContain("voluntary-audience-inside-home");
 });
 it.each(["unmeasured","missing"])("does not let %s source erase a lean audience candidate",kind=>{
  const sample=observed(80,"unmeasured",513);if(kind==="missing")delete sample.playPaint;
  expect(inspectLivingContext([sample]).findings.map(f=>f.rule)).toContain("voluntary-audience-inside-home");
 });
 it.each(["command-cheer","ask-petting","cheer-rehearsal"])("retains the explicit %s criterion even with a cold row and actual carried object",kind=>{
  const cold=observed(80,"other",1);
  if(kind==="command-cheer")cold.command="cheer";else cold.play=kind;
  expect(inspectLivingContext([cold]).findings.map(f=>f.rule)).toContain("voluntary-audience-inside-home");
 });
 it("requires the new tri-state source measurement and never promotes older missing raw context",()=>{
  const fresh={...observed(80,"other",1),jumpSource:false};expect(traceLivingContextComplete([fresh])).toBe(true);
  const missing={...fresh};delete missing.playPaint;expect(traceLivingContextComplete([missing])).toBe(false);
  expect(traceLivingContextComplete([{...fresh,playPaint:"unmeasured"}])).toBe(true);
 });
 it("does not award outside-audience evidence to a label without a matching source",()=>{
  const other={...observed(80,"other",1),platform:"date-actual"};
  expect(inspectLivingContext([other]).positiveWitnesses.map(w=>w.rule)).not.toContain("outside-audience");
  expect(inspectLivingContext([{...other,playPaint:"unmeasured"}]).positiveWitnesses.map(w=>w.rule)).not.toContain("outside-audience");
  expect(inspectLivingContext([{...other,playPaint:"matching",toyPlay:{...other.toyPlay!,source:true}}]).positiveWitnesses.map(w=>w.rule)).toContain("outside-audience");
 });
});

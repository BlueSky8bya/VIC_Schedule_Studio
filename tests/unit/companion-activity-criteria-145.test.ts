import { describe, expect, it } from "vitest";
import { activityProgressTimes, stationaryActivityRepetitions, type ActivityFrame } from "../../scripts/companion-qa/activity-criteria.mjs";
import { inspectTrace } from "../../scripts/companion-qa/trace-checks.mjs";

const frame=(at:number,x=100,y=600):ActivityFrame=>({at,x,y,state:"walk",pose:Math.floor(at/80)%5,visible:true,decoded:true,enabled:true,roam:true,
  activity:{source:true,manual:false,epoch:0,jumpAllowed:true,width:60,height:60,anchor:{x:0,y:0,width:1200,height:900},action:"walk",context:""}});
const walk=()=>Array.from({length:20},(_,i)=>frame(i*80,100+i*6));
describe("145 actual activity is independent of precise destination receipts",()=>{
  it("credits a genuine walk before any landing/support/destination observation exists",()=>{
    const trace=walk();expect(activityProgressTimes(trace).size).toBeGreaterThan(10);
    expect(activityProgressTimes(trace.slice(0,2)).size).toBe(0);
  });
  it("credits a vertical jump still in flight, without a completed arc or landing",()=>{
    const trace=walk().slice(0,8).map((f,i)=>({...f,state:"jump",x:100,y:600-i*10,activity:{...f.activity!,action:"jump"}}));
    expect(activityProgressTimes(trace).size).toBeGreaterThan(2);
  });
  it.each(["hidden","undecoded","off","held","blocked","manual","roam-off","jump-off","source","wrong-row","frozen-pose","stationary","nan","one-coordinate-teleport","epoch","anchor","size","gap"])("rejects %s as a movement witness",gate=>{
    const trace=walk().map((f,i)=>{
      if(gate==="hidden")f.visible=false;if(gate==="undecoded")f.decoded=false;if(gate==="off")f.enabled=false;
      if(gate==="held")f.owned=true;if(gate==="blocked")f.blocked=true;if(gate==="manual")f.activity!.manual=true;
      if(gate==="roam-off")f.roam=false;
      if(gate==="jump-off"){f.state="jump";f.y-=i*8;f.activity!.action="jump";f.activity!.jumpAllowed=false;}
      if(gate==="source")f.activity!.source=false;if(gate==="wrong-row")f.activity!.action="";
      if(gate==="frozen-pose")f.pose=0;if(gate==="stationary")f.x=100;if(gate==="nan")f.y=NaN;
      if(gate==="one-coordinate-teleport"){f.x=i<10?100:1000;f.pose=i<10?0:1;}
      if(gate==="epoch")f.activity!.epoch=i;
      if(gate==="anchor")f.activity!.anchor!.y=i*6;
      if(gate==="size")f.activity!.width=60+i*3;
      if(gate==="gap")f.at=i*300;
      return f;
    });expect(activityProgressTimes(trace).size).toBe(0);
  });
  it("records small-jump activity while separately flagging endless repetition in one area",()=>{
    const trace=Array.from({length:220},(_,i)=>({...frame(i*80,100,600+Math.sin(i*Math.PI/4)*6),state:"jump",activity:{...frame(0).activity!,action:"jump"}}));
    const credit=[...activityProgressTimes(trace)];expect(credit.length).toBeGreaterThan(0);
    expect(credit.some(at=>at>10000)).toBe(true);
    expect(stationaryActivityRepetitions(trace).map(f=>f.rule)).toContain("stationary-action-repetition");
    expect(inspectTrace(trace.map(f=>({...f,eligible:true}))).findings.map(f=>f.rule)).not.toContain("no-visible-progress-10s");
  });
  it("stops motion credit at the last actual displacement instead of reusing old coordinates",()=>{
    const trace=Array.from({length:80},(_,i)=>frame(i*80,100+Math.min(i,10)*6));
    expect(Math.max(...activityProgressTimes(trace))).toBe(800);
  });
  it("cannot borrow a later nonmoving endpoint or cross separate motions",()=>{
    const trace=walk().map((f,i)=>({...f,x:i<10?100:500,state:i===10?"idle":"walk",pose:i<10?0:1}));
    expect(activityProgressTimes(trace).size).toBe(0);
  });
  it("rejects a moderate single snap followed by changing poses at one location",()=>{
    const trace=walk().map((f,i)=>({...f,x:i?200:100}));
    expect(activityProgressTimes(trace).size).toBe(0);
  });
  it("cannot use future observations to manufacture timestamps before a cutoff",()=>{
    const trace=walk();const cutoff=80;
    expect(activityProgressTimes(trace.filter(f=>f.at<=cutoff)).size).toBe(0);
    expect([...activityProgressTimes(trace)].some(at=>at<=cutoff)).toBe(false);
  });
  it("credits varied finite body actions while an endless same-place roll expires",()=>{
    const trace=Array.from({length:220},(_,i)=>({...frame(i*80),state:"play",activity:{...frame(i*80).activity!,action:"play:roll"}}));
    const credited=activityProgressTimes(trace);expect(credited.size).toBeGreaterThan(0);expect(Math.max(...credited)).toBeLessThanOrEqual(1500);
    expect(inspectTrace(trace.map(f=>({...f,eligible:true}))).findings.map(f=>f.rule)).toContain("no-visible-progress-10s");
    const varied=trace.map(f=>({...f,activity:{...f.activity!,action:f.at<8000?"play:roll":"play:stretch"}}));
    expect([...activityProgressTimes(varied)].some(at=>at>8000)).toBe(true);
  });
  it("preserves real pacing movement while the independent ordinary-loop detector flags repetition",()=>{
    const trace=Array.from({length:500},(_,i)=>{
      const phase=i%40,x=100+(phase<=20?phase:40-phase)*6;return frame(i*80,x);
    });
    const credited=activityProgressTimes(trace);
    expect([...credited].some(at=>at>1600&&at<3200)).toBe(true);
    expect([...credited].some(at=>at>15000&&at<28000)).toBe(true);
    const observed=trace.map(f=>({...f,sourceClipMeasured:true,walkSource:true,platform:"date-1-floor",lifePurpose:"ordinary",humanEpoch:0,layoutEpoch:0,eligible:true,items:"|",controls:"off|true|open|false",carried:"",scene:"",goal:""}));
    expect(inspectTrace(observed).findings.map(f=>f.rule)).toContain("ordinary-walk-pacing");
    expect(inspectTrace(observed).findings.map(f=>f.rule)).not.toContain("no-visible-progress-10s");
  });
  it.each(["input-layout","real-object-effect"])("does not infer a continuous repetition across real %s changes",gate=>{
    const trace=Array.from({length:300},(_,i)=>{
      const f={...frame(i*80,100,600+Math.sin(i*Math.PI/4)*6),state:"jump"};f.activity!.action="jump";
      if(gate==="input-layout")f.activity!.epoch=Math.floor(i/100);else f.activity!.context=String(Math.floor(i/100));
      return f;
    });expect(stationaryActivityRepetitions(trace)).toEqual([]);
  });
  it("detects intermittent same-place hops without deleting their actual activity",()=>{
    const trace=Array.from({length:220},(_,i)=>{
      const moving=i%30<20;const f={...frame(i*80,100,moving?600+Math.sin(i*Math.PI/4)*6:600),state:moving?"jump":"idle"};f.activity!.action=moving?"jump":"";return f;
    });
    expect([...activityProgressTimes(trace)].some(at=>at>10000)).toBe(true);
    expect(stationaryActivityRepetitions(trace)[0]?.rule).toBe("stationary-action-repetition");
  });
  it("records a later body action at another place despite a repeated action name",()=>{
    const trace=Array.from({length:100},(_,i)=>{
      const f=frame(i*80,i<50?100:400);const active=i<20||i>=50&&i<70;f.state=active?"play":"idle";f.activity!.action=active?"play:groom":"";return f;
    });expect([...activityProgressTimes(trace)].some(at=>at>4000)).toBe(true);expect(stationaryActivityRepetitions(trace)).toEqual([]);
  });
  it("keeps finite real different actions distinct from repeated stationary cycles",()=>{
    const trace=Array.from({length:250},(_,i)=>{
      const f=frame(i*80);f.state="play";f.activity!.action=Math.floor(i/20)%2?"play:groom":"play:roll";return f;
    });expect([...activityProgressTimes(trace)].some(at=>at>10000)).toBe(true);expect(stationaryActivityRepetitions(trace)[0]?.rule).toBe("stationary-action-repetition");
  });
  it("uses the same in-progress activity in daily ten-second checks",()=>{
    const trace=Array.from({length:160},(_,i)=>({...frame(i*80,100+i*3),eligible:true}));
    expect(inspectTrace(trace).findings.map(f=>f.rule)).not.toContain("no-visible-progress-10s");
    expect(inspectTrace(trace.map(f=>({...f,activity:{...f.activity!,source:false}}))).findings.map(f=>f.rule)).toContain("no-visible-progress-10s");
  });
});

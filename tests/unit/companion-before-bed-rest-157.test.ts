import { describe, expect, it } from "vitest";
import { companionSpriteMetadata as metadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { beforeBedRestPreparation157, type BeforeBedRestFrame157 as Frame } from "../visual/helpers/companion-before-bed-rest-157";
import type { CuriousTextureCellMeasurement } from "../visual/helpers/companion-curious-completion-144";
import type { ContactPaint, ContactRect } from "../visual/helpers/companion-home-contact-156";

const opening={x:200,y:172}, serial="7";
const matrix=(x:number,y:number)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,0,1];
function cell(pose:number):CuriousTextureCellMeasurement {
  const frame=metadata.frames[pose],atlas=metadata.atlases[frame.atlas],size=92;
  return {currentPath:atlas.src,connectedToSprite:true,naturalWidth:atlas.width,naturalHeight:atlas.height,
    textureWidth:size*metadata.grid,textureHeight:size*metadata.gridRows,spriteWidth:size,spriteHeight:size,textureLeft:0,textureTop:0,
    textureMatrix:matrix(-(frame.index%metadata.grid)*size,-Math.floor(frame.index/metadata.grid)*size),
    spriteMatrix:matrix(frame.x/80*size,frame.y/80*size),spriteClipPath:`inset(${frame.clip.map(value=>`${value/80*100}%`).join(" ")})`,textureClipPath:"none"};
}
const paint=(rect:ContactRect,visible=true):ContactPaint=>({rect,visible});
function frame(at:number,patch:Partial<Frame>={}):Frame {
  const state=patch.state??"walk",play=patch.play??"",row=state==="walk"?2:state==="jump"?4:play==="cozy-nest"?35:state==="play"?31:1;
  const pose=metadata.rows[row][Math.floor(at/40)%Math.min(4,metadata.rows[row].length)],x=patch.x??200,y=patch.y??172;
  const result:Frame={at,state,play,scene:"S03",serial,beat:"0",command:"toy",pose,x,y,platform:"companion-home-floor",visible:true,decoded:true,
    activity:{source:true,manual:false},sourcePaint:true,cell:cell(pose),tv:"off",lit:true,toys:[],homeSofa:{left:30,right:140,top:140,visible:true},...patch};
  const touch=Boolean(result.homeLife?.lampTouch),height=touch?73:70,art={x:100,y:20,width:52,height},lampState=result.lit?"on":"off";
  result.restControl={actor:{...paint({x:x-46,y:y-92,width:92,height:92}),decoded:true,pose,src:metadata.atlases[metadata.frames[pose].atlas].src,platform:result.platform,reach:result.homeLife?.reaching??""},
    tool:paint({x:0,y:0,width:18,height:18},false),lamp:{button:paint({x:100,y:20,width:52,height:72}),paint:paint(art),
      handle:paint({x:100+52*(.5+334/1024),y:20+height-52*(18+132)/1024,width:52*80/1024,height:52*132/1024}),touch,state:lampState,requestedPull:touch?3:0,cssWidth:52,
      art:{...paint(art),source:`/companion/home/155/lamp-${lampState}.webp`},feedback:{...paint(art,touch),source:`/companion/home/155/lamp-${lampState}.webp`,opacity:touch?1:0,clip:"polygon(84% 11px,94% 11px,94% 100%,81% 100%)"}},
    tv:{...paint({x:130,y:110,width:60,height:60}),decoded:true,src:"/companion/home/136/tv-body.webp"}};
  return result;
}
function fixture():Frame[] {
  const owner={phase:"nap",scene:"S03",serial,beat:"1",reaching:"",lampTouch:false};
  const life=(at:number,x:number,patch:Partial<Frame>={})=>frame(at,{scene:"",serial:"",beat:"",command:"",x,homeLife:{...owner},...patch});
  const original={id:"actual-toy-7",carried:true,held:false,x:200,y:172};
  return [frame(0,{toys:[{...original}]}),frame(40,{toys:[{...original}]}),frame(80),
    life(120,190),life(160,170),life(200,146,{state:"play",play:"pounce"}),
    life(240,146,{state:"play",play:"pounce",homeLife:{...owner,reaching:"light",lampTouch:true}}),
    life(280,146,{state:"play",play:"pounce",lit:false,homeLife:{...owner,reaching:"light",lampTouch:true}}),
    life(320,130,{lit:false}),life(360,110,{lit:false}),
    frame(400,{state:"jump",beat:"1",command:"go",x:120,y:160,lit:false}),
    frame(440,{state:"jump",beat:"1",command:"go",x:100,y:145,lit:false}),
    frame(480,{state:"look",beat:"1",command:"go",x:80,y:140,platform:"companion-home",lit:false}),
    frame(520,{state:"play",play:"cozy-nest",beat:"2",command:"pose",x:80,y:140,platform:"companion-home",lit:false}),
    frame(560,{state:"play",play:"cozy-nest",beat:"2",command:"pose",x:80,y:140,platform:"companion-home",lit:false})];
}
const inspect=(trace:Frame[])=>beforeBedRestPreparation157(trace,"S03",opening);
describe("157 actual same-owner pre-bed physical prerequisite witness",()=>{
  it("bridges only the pre-bed control trip after a real same-ID return and before actual sofa preparation",()=>{
    const trace=fixture(),original=structuredClone(trace),result=inspect(trace);
    expect([...result.indices]).toEqual([3,4,5,6,7,8,9]);
    expect(result.witnesses).toEqual([{recipe:"S03",serial,beat:"1",first:3,after:10,returnedToyId:"actual-toy-7",lastCarriedAt:40,absentAt:80,
      changedAt:280,contactAt:280,measuredPull:3,maxGapMs:40,resumedAt:400,sofaPreparationAt:520,actualCellSamples:13}]);
    expect(trace).toEqual(original);
    expect([...beforeBedRestPreparation157(trace,"S05",opening).indices]).toEqual([]);
    expect([...beforeBedRestPreparation157(trace,"S03",{x:NaN,y:172}).indices]).toEqual([]);
    // The returned indices include neither the prior real return, its resumed
    // go-sofa command, the two observed cozy cells nor any fictional sleep.
    expect([...result.indices].every(index=>trace[index].homeLife&&trace[index].scene==="")).toBe(true);
    expect(trace.some(value=>value.state==="sleep")).toBe(false);
  });
  it("recognizes the same physical prerequisite for true night sleep",()=>{
    const trace=fixture();for(const value of trace)if(value.homeLife)value.homeLife.phase="sleep";
    expect(inspect(trace).witnesses).toHaveLength(1);
  });
  it("preserves the inclusive160ms observed-gap boundary",()=>{
    const trace=fixture();for(let i=5;i<trace.length;i++)trace[i].at+=120;
    expect(inspect(trace).witnesses[0]?.maxGapMs).toBe(160);
    for(let i=5;i<trace.length;i++)trace[i].at+=.001;
    expect(inspect(trace).witnesses).toEqual([]);
  });
  const failures=["wrong-head-recipe","wrong-owner-serial","wrong-owner-beat","awake-phase","missing-owner","changed-owner-midtrip","no-source","wrong-cell","unpainted","manual",
    "nonfinite","duplicate-time","long-gap","sofa-before-bed","pad-as-floor","wrong-before-beat","missing-return","single-carried","held-item","remote-return","item-reappears",
    "no-movement","no-OFF","double-toggle","tv-change","no-control-pixels","wrong-reach","no-contact-marker","hover-only","no-actual-pull","wrong-handle","hidden-feedback","foreign-packet",
    "remote-actor","actor-point-mismatch","missing-resume","foreign-resume-serial","wrong-resume-command","resumed-lit","no-cozy","cozy-on-floor","hidden-sofa","wrong-sofa-height",
    "wrong-cozy-cell","foreign-cozy-serial","post-resume-errand","manual-tail","tail-gap","single-cozy-sample","prior-cozy"] as const;
  it.each(failures)("rejects %s without completing any required rest/pose",failure=>{
    const trace=fixture();
    if(failure==="wrong-head-recipe")trace[3].homeLife!.scene="S01";
    if(failure==="wrong-owner-serial")trace[3].homeLife!.serial="99";
    if(failure==="wrong-owner-beat")trace[3].homeLife!.beat="3";
    if(failure==="awake-phase")for(const value of trace)if(value.homeLife)value.homeLife.phase="awake";
    if(failure==="missing-owner")delete trace[6].homeLife;
    if(failure==="changed-owner-midtrip")trace[6].homeLife!.serial="99";
    if(failure==="no-source")trace[6].activity.source=false;
    if(failure==="wrong-cell")trace[6].cell=cell(metadata.rows[0][0]);
    if(failure==="unpainted")trace[6].sourcePaint=false;
    if(failure==="manual")trace[6].activity.manual=true;
    if(failure==="nonfinite")trace[6].x=NaN;
    if(failure==="duplicate-time")trace[6].at=trace[5].at;
    if(failure==="long-gap")for(let i=6;i<trace.length;i++)trace[i].at+=121;
    if(failure==="sofa-before-bed")trace[5].platform="companion-home";
    if(failure==="pad-as-floor")trace[5].platform="companion-home-floor-400";
    if(failure==="wrong-before-beat")trace[2].beat="2";
    if(failure==="missing-return")for(const value of trace)value.toys=[];
    if(failure==="single-carried")trace[0].toys=[];
    if(failure==="held-item")for(const value of trace)for(const toy of value.toys)toy.held=true;
    if(failure==="remote-return")for(const value of trace)for(const toy of value.toys)toy.x+=100;
    if(failure==="item-reappears")trace[8].toys=[{id:"actual-toy-7",carried:false,held:false,x:130,y:172}];
    if(failure==="no-movement")for(const value of trace.slice(3,10))value.x=146;
    if(failure==="no-OFF")for(const value of trace)value.lit=true;
    if(failure==="double-toggle")trace[8].lit=true;
    if(failure==="tv-change")trace[7].tv="tori";
    if(failure==="no-control-pixels")for(const value of trace)delete value.restControl;
    if(failure==="wrong-reach")for(const value of trace)if(value.restControl)value.restControl.actor.reach="tv";
    if(failure==="no-contact-marker")for(const value of trace)if(value.homeLife)value.homeLife.lampTouch=false;
    if(failure==="hover-only")for(const value of trace)if(value.restControl)value.restControl.lamp.requestedPull=1.5;
    if(failure==="no-actual-pull")for(const value of trace)if(value.restControl){value.restControl.lamp.paint.rect!.height=70;value.restControl.lamp.art.rect!.height=70;value.restControl.lamp.feedback.rect!.height=70;}
    if(failure==="wrong-handle")for(const value of trace)if(value.restControl)value.restControl.lamp.handle.rect!.x+=100;
    if(failure==="hidden-feedback")for(const value of trace)if(value.restControl)value.restControl.lamp.feedback.visible=false;
    if(failure==="foreign-packet")for(const value of trace)if(value.restControl)value.restControl.actor.src="/wrong.webp";
    if(failure==="remote-actor")for(const value of trace)if(value.restControl)value.restControl.actor.rect!.x+=1000;
    if(failure==="actor-point-mismatch")for(const value of trace)if(value.restControl)value.restControl.actor.rect!.x+=10;
    if(failure==="missing-resume")trace[10].scene="";
    if(failure==="foreign-resume-serial")trace[10].serial="8";
    if(failure==="wrong-resume-command")trace[10].command="pose";
    if(failure==="resumed-lit")trace[10].lit=true;
    if(failure==="no-cozy")for(const value of trace.slice(13))value.play="groom";
    if(failure==="cozy-on-floor")for(const value of trace.slice(13))value.platform="companion-home-floor";
    if(failure==="hidden-sofa")for(const value of trace.slice(13))value.homeSofa!.visible=false;
    if(failure==="wrong-sofa-height")for(const value of trace.slice(13))value.homeSofa!.top+=10;
    if(failure==="wrong-cozy-cell")for(const value of trace.slice(13))value.cell=cell(metadata.rows[0][0]);
    if(failure==="foreign-cozy-serial")for(const value of trace.slice(13))value.serial="99";
    if(failure==="post-resume-errand")trace[11].homeLife={...trace[3].homeLife!};
    if(failure==="manual-tail")trace[11].activity.manual=true;
    if(failure==="tail-gap")for(let i=12;i<trace.length;i++)trace[i].at+=121;
    if(failure==="single-cozy-sample")trace.pop();
    if(failure==="prior-cozy"){trace[0].beat="2";trace[0].state="play";trace[0].play="cozy-nest";}
    expect([...inspect(trace).indices]).toEqual([]);
  });
});

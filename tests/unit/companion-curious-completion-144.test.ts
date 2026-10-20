import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { completedCuriousDailyIdeas, curiousTextureCellMatches, CURIOUS_COMPLETION_SCOPE, type CuriousCompletionFrame, type CuriousTextureCellMeasurement } from "../visual/helpers/companion-curious-completion-144";

const source=(row:number,column:number)=>companionSpriteMetadata.rows[row][column];
const translation=(x:number,y:number)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,0,1];
function measuredCell(pose:number,size=92):CuriousTextureCellMeasurement{
  const frame=companionSpriteMetadata.frames[pose],atlas=companionSpriteMetadata.atlases[frame.atlas];
  return {currentPath:atlas.src,connectedToSprite:true,naturalWidth:atlas.width,naturalHeight:atlas.height,
    textureWidth:size*companionSpriteMetadata.grid,textureHeight:size*companionSpriteMetadata.gridRows,spriteWidth:size,spriteHeight:size,textureLeft:0,textureTop:0,
    textureMatrix:translation(-(frame.index%companionSpriteMetadata.grid)*size,-Math.floor(frame.index/companionSpriteMetadata.grid)*size),
    spriteMatrix:translation(frame.x/80*size,frame.y/80*size),spriteClipPath:`inset(${frame.clip.map(value=>`${value/80*100}%`).join(" ")})`,textureClipPath:"none"};
}
const syncCells=(trace:CuriousCompletionFrame[],size=92)=>trace.forEach(f=>{if(f.curiousCompletion)f.curiousCompletion.cell=measuredCell(f.pose,size);});
function sample(at:number,scene:string,beat:string,state:string,row:number,column:number,x:number,platform:string):CuriousCompletionFrame{
  const left=platform==="date-15-floor"?0:platform==="date-8-floor"?50:100;
  return {at,x,y:600,visible:true,decoded:true,enabled:true,roam:true,eligible:true,owned:false,blocked:false,personality:"curious",hunger:.15,energy:.8,
    humanEpoch:0,layoutEpoch:0,lifePurpose:scene==="D143-C"?"authored":"ordinary",state,pose:source(row,column),play:"",scene,beat,
    command:beat==="0"||beat==="2"?"go":"pose",platform,sourceClipMeasured:true,goal:"",carried:"",
    curiousCompletion:{version:2,source:true,cell:measuredCell(source(row,column)),body:{x:x-30,y:540,width:60,height:60},day:{rect:{x:left,y:400,width:80,height:203},footY:600},
      guards:{preferencesObserved:true,jumpAllowed:true,foodGoalAbsent:true,feedIntentAbsent:true,episodeInactive:true,handsFree:true}}};
}
function complete(){
  const trace:CuriousCompletionFrame[]=[sample(0,"","","idle",0,0,20,"date-15-floor"),sample(100,"","","idle",0,1,20,"date-15-floor")];
  let at=100;
  for(let i=0;i<5;i++)trace.push(sample(at+=100,"D143-C","0","walk",2,i,20+i*10,"date-15-floor"));
  for(let i=0;i<11;i++)trace.push(sample(at+=100,"D143-C","1","sniff",1,Math.floor(i*1.5),70,"date-8-floor"));
  for(let i=0;i<5;i++)trace.push(sample(at+=100,"D143-C","2","walk",2,i,70+i*10,"date-8-floor"));
  for(let i=0;i<10;i++)trace.push(sample(at+=100,"D143-C","3","stretch",16,Math.floor(i*7/9),120,"date-1-floor"));
  for(let i=0;i<3;i++)trace.push(sample(at+=100,"X-C-house","0","look",1,i,120,"date-1-floor"));
  return trace;
}
const stage=(trace:CuriousCompletionFrame[],beat:string)=>trace.filter(f=>f.scene==="D143-C"&&f.beat===beat);
const move=(f:CuriousCompletionFrame,x:number,y=600)=>{f.x=x;f.y=y;f.curiousCompletion!.body!.x=x-30;f.curiousCompletion!.body!.y=y-60;};

describe("144 C-only native completion with independent observed evidence",()=>{
  it("accepts two real routes, distinct measured DAY arrivals, whole sniff/stretch and a new painted action",()=>{
    const trace=complete(),untouched=structuredClone(trace),result=completedCuriousDailyIdeas(trace);
    expect(result).toHaveLength(1);expect(result[0]).toMatchObject({id:"D143-C",finalBeat:3,observer:"curious-native-v3",subsequentAt:3300,completedAt:3400});
    expect(result[0].arrivals.map(x=>x.platform)).toEqual(["date-8-floor","date-1-floor"]);expect(trace).toEqual(untouched);
  });
  it("accepts actual two-sample settled tails within a go without duplicating their timestamps",()=>{
    const trace=complete(),insert=stage(trace,"1").slice(0,2).map(f=>({...structuredClone(f),beat:"0",command:"go",state:"idle",pose:source(0,0)}));
    const index=trace.findIndex(f=>f.scene==="D143-C"&&f.beat==="1");
    trace.splice(index,2,...insert);syncCells(trace);expect(completedCuriousDailyIdeas(trace)).toHaveLength(1);
  });
  it("accepts a decoded multi-row physical jump with an independently settled landing",()=>{
    const trace=complete();stage(trace,"0").forEach((f,i)=>{f.state="jump";f.pose=source([3,4,5,6,6][i],i===4?1:0);move(f,20+i*10,[600,590,580,590,600][i]);});
    syncCells(trace);expect(completedCuriousDailyIdeas(trace)).toHaveLength(1);
    stage(trace,"0").forEach(f=>{f.curiousCompletion!.guards.jumpAllowed=false;});expect(completedCuriousDailyIdeas(trace)).toEqual([]);
  });
  it("uses local computed cell dimensions independently of a scaled ancestor bounding box",()=>{
    const trace=complete();syncCells(trace,96.375);trace.forEach(f=>{f.curiousCompletion!.body={x:f.x-42,y:f.y-84,width:84,height:84};});
    expect(completedCuriousDailyIdeas(trace)).toHaveLength(1);
  });
  it("checks exact current atlas cells across column/row and atlas boundaries",()=>{
    for(const pose of [23,24,31,32])expect(curiousTextureCellMatches(pose,measuredCell(pose))).toBe(true);
    expect(curiousTextureCellMatches(24,measuredCell(23))).toBe(false);expect(curiousTextureCellMatches(32,measuredCell(31))).toBe(false);
    const clip=measuredCell(0),values=companionSpriteMetadata.frames[0].clip.map(value=>value/80*100);
    clip.spriteClipPath=`inset(${values[0]}% ${values[1]}% ${values[2]}%)`;expect(curiousTextureCellMatches(0,clip)).toBe(true);
  });
  const wrongCells:[string,(cell:CuriousTextureCellMeasurement)=>void][]=[
    ["wrong public atlas path",c=>{c.currentPath=companionSpriteMetadata.atlases[0].src;}],
    ["only a suffix match to the expected public atlas",c=>{c.currentPath="/wrong-prefix"+c.currentPath;}],
    ["atlas query/fragment rather than its exact public path",c=>{c.currentPath+="?stale=1";}],
    ["texture detached from its actual sprite",c=>{c.connectedToSprite=false;}],
    ["wrong decoded natural width",c=>{c.naturalWidth++;}],
    ["wrong decoded natural height",c=>{c.naturalHeight++;}],
    ["computed texture scale dimensions disagree with grid",c=>{c.textureWidth*=.5;}],
    ["computed texture height disagrees with grid rows",c=>{c.textureHeight++;}],
    ["viewport bounding width mixed with local CSS dimensions",c=>{c.spriteWidth*=1.4;}],
    ["zero local cell dimensions",c=>{c.spriteWidth=0;}],
    ["non-finite computed CSS dimension",c=>{c.textureWidth=Number.NaN;}],
    ["non-finite serialized dimension",c=>{c.spriteHeight=null as unknown as number;}],
    ["offset left used in addition to texture translation",c=>{c.textureLeft=10;}],
    ["offset top used in addition to texture translation",c=>{c.textureTop=10;}],
    ["texture matrix scale",c=>{c.textureMatrix![0]=.95;}],
    ["texture matrix skew",c=>{c.textureMatrix![4]=.2;}],
    ["texture matrix perspective",c=>{c.textureMatrix![11]=.01;}],
    ["texture matrix Z translation",c=>{c.textureMatrix![14]=1;}],
    ["texture matrix non-finite component",c=>{c.textureMatrix![12]=Number.NaN;}],
    ["texture matrix non-finite homogeneous component",c=>{c.textureMatrix![15]=Number.POSITIVE_INFINITY;}],
    ["missing texture matrix",c=>{c.textureMatrix=null;}],
    ["unsupported short matrix recording",c=>{c.textureMatrix=[1,0,0,1,0,0];}],
    ["sparse missing matrix components",c=>{c.textureMatrix=Array<number>(16);}],
    ["one-cell-lag texture translation",c=>{c.textureMatrix![12]+=c.spriteWidth;}],
    ["sprite registration offset differs from actual frame",c=>{c.spriteMatrix![13]+=5;}],
    ["sprite own scale instead of its registered translation",c=>{c.spriteMatrix![5]=1.1;}],
    ["missing sprite registration matrix",c=>{c.spriteMatrix=null;}],
    ["wrong current clip",c=>{c.spriteClipPath="inset(0% 0% 0% 0%)";}],
    ["unmeasured clip expression",c=>{c.spriteClipPath="none";}],
    ["unexpected child texture clipping",c=>{c.textureClipPath="inset(5%)";}],
  ];
  it.each(wrongCells)("withholds C completion for %s despite advancing pose labels",(_,change)=>{
    const trace=complete(),f=stage(trace,"1")[4];change(f.curiousCompletion!.cell!);expect(completedCuriousDailyIdeas(trace)).toEqual([]);
  });
  it("rejects a frozen first atlas cell while data-pose advances across a complete sniff packet",()=>{
    const trace=complete(),first=structuredClone(stage(trace,"1")[0].curiousCompletion!.cell!);
    stage(trace,"1").forEach(f=>{f.curiousCompletion!.cell=structuredClone(first);});expect(completedCuriousDailyIdeas(trace)).toEqual([]);
  });
  it("rejects source labels one frame ahead of the actual same-atlas texture",()=>{
    const trace=complete(),sniff=stage(trace,"1");for(let i=sniff.length-1;i>0;i--)sniff[i].curiousCompletion!.cell=structuredClone(sniff[i-1].curiousCompletion!.cell);
    expect(completedCuriousDailyIdeas(trace)).toEqual([]);
  });
  it("does not permit a stale cell at a required beat or next-action boundary",()=>{
    const trace=complete(),firstStretch=stage(trace,"3")[0],previous=trace[trace.indexOf(firstStretch)-1];
    firstStretch.curiousCompletion!.cell=structuredClone(previous.curiousCompletion!.cell);expect(completedCuriousDailyIdeas(trace)).toEqual([]);
    const next=complete();next[next.length-3].curiousCompletion!.cell=structuredClone(stage(next,"3").at(-1)!.curiousCompletion!.cell);
    expect(completedCuriousDailyIdeas(next)).toEqual([]);
  });
  it("fails closed when raw cell measurements are absent",()=>{
    const trace=complete();trace.forEach(f=>{f.curiousCompletion!.cell=null;});expect(completedCuriousDailyIdeas(trace)).toEqual([]);
  });
  const changes:[string,(trace:CuriousCompletionFrame[])=>void][]=[
    ["missing pre-attempt settled departure",t=>t.splice(0,2)],
    ["missing first go",t=>t.splice(2,5)],
    ["missing second go",t=>{for(let i=t.length-1;i>=0;i--)if(t[i].scene==="D143-C"&&t[i].beat==="2")t.splice(i,1);} ],
    ["stationary walk poses then a later landing coordinate",t=>stage(t,"0").forEach(f=>move(f,20))],
    ["motion has only two distinct positions",t=>stage(t,"0").forEach((f,i)=>move(f,i<3?20:30))],
    ["teleport from last moving source to first settled sample",t=>stage(t,"0").forEach((f,i)=>move(f,5+i*2))],
    ["teleport inside a labelled motion interval",t=>move(stage(t,"0")[2],400)],
    ["delayed landing without continuous samples",t=>t.slice(7).forEach(f=>{f.at+=400;})],
    ["unobserved source pose during travel",t=>{stage(t,"0")[2].curiousCompletion!.source=false;}],
    ["jump labels without a vertical physical journey",t=>stage(t,"0").forEach((f,i)=>{f.state="jump";f.pose=source([3,4,5,6,6][i],0);})],
    ["jumping body with one repeated anticipation row",t=>stage(t,"0").forEach((f,i)=>{f.state="jump";f.pose=source(3,i);move(f,20+i*10,[600,590,580,590,600][i]);})],
    ["same first and second outside platform",t=>stage(t,"3").forEach(f=>{f.platform="date-8-floor";})],
    ["same physical DAY rectangle under different IDs",t=>stage(t,"3").forEach(f=>{f.curiousCompletion!.day!.rect.x=50;})],
    ["covered or unpainted destination border",t=>stage(t,"3").forEach(f=>{f.curiousCompletion!.day=null;})],
    ["unknown support geometry",t=>stage(t,"1").forEach(f=>{f.platform="text-unmeasured";})],
    ["actor misses the actual support foot",t=>stage(t,"1").forEach(f=>move(f,70,580))],
    ["one arrival sample only",t=>{stage(t,"1").slice(1).forEach(f=>{f.curiousCompletion!.day=null;});}],
    ["required sniff stage absent",t=>{for(let i=t.length-1;i>=0;i--)if(t[i].scene==="D143-C"&&t[i].beat==="1")t.splice(i,1);} ],
    ["truncated final stretch",t=>{const kept=stage(t,"3").slice(0,4);t.splice(t.findIndex(f=>f.scene==="D143-C"&&f.beat==="3"),10,...kept);} ],
    ["frozen source pose held for the whole sniff duration",t=>stage(t,"1").forEach(f=>{f.pose=source(1,0);})],
    ["a pair of row members repeated for the whole stretch duration",t=>stage(t,"3").forEach((f,i)=>{f.pose=source(16,i%2);})],
    ["only terminal row member held long enough",t=>stage(t,"3").forEach(f=>{f.pose=source(16,7);})],
    ["registered source sequence plays backwards",t=>stage(t,"3").forEach((f,i)=>{f.pose=source(16,7-Math.floor(i*7/9));})],
    ["stretch label with sniff pixels",t=>stage(t,"3").forEach((f,i)=>{f.pose=source(1,i);})],
    ["required command label mismatch",t=>{stage(t,"1")[4].command="watch";}],
    ["no subsequent action",t=>t.splice(-3)],
    ["idle labels alone after final stage",t=>t.slice(-3).forEach(f=>{f.scene="";f.state="idle";f.pose=source(0,0);})],
    ["new labels but unchanged final painted source",t=>t.slice(-3).forEach(f=>{f.state="stretch";f.pose=source(16,7);})],
    ["two subsequent frames with no actual source or body change",t=>t.slice(-3).forEach(f=>{f.pose=source(1,0);})],
    ["same-attempt final beat omitted by a restart",t=>{stage(t,"3")[0].beat="0";}],
    ["OFF",t=>{stage(t,"1")[3].enabled=false;}],
    ["roaming OFF",t=>{stage(t,"1")[3].roam=false;}],
    ["manual ownership",t=>{stage(t,"1")[3].owned=true;}],
    ["paused or quiet observation",t=>{stage(t,"1")[3].eligible=false;}],
    ["workspace owner",t=>{stage(t,"1")[3].blocked=true;}],
    ["trusted input changes",t=>t.slice(8).forEach(f=>{f.humanEpoch=1;})],
    ["layout changes",t=>t.slice(8).forEach(f=>{f.layoutEpoch=1;})],
    ["urgent hunger at exact source boundary",t=>{stage(t,"0")[0].hunger=.78;}],
    ["urgent exhaustion at exact source boundary",t=>{stage(t,"0")[0].energy=.18;}],
    ["urgent need becomes due during the attempt",t=>{stage(t,"3")[3].hunger=.95;stage(t,"3")[3].energy=.1;}],
    ["missing observed need",t=>{delete stage(t,"0")[0].energy;}],
    ["missing actual preferences projection",t=>{stage(t,"0")[0].curiousCompletion!.guards.preferencesObserved=false;}],
    ["food goal owner",t=>{stage(t,"0")[0].goal="actual-food-id";}],
    ["feed intention projection",t=>{stage(t,"0")[0].curiousCompletion!.guards.feedIntentAbsent=false;}],
    ["unfinished physical episode",t=>{stage(t,"0")[0].curiousCompletion!.guards.episodeInactive=false;}],
    ["carried physical object",t=>{stage(t,"1")[3].carried="toy-actual";}],
    ["hand ownership projection",t=>{stage(t,"1")[3].curiousCompletion!.guards.handsFree=false;}],
    ["legacy raw without new frozen measurements",t=>t.forEach(f=>{delete f.curiousCompletion;})],
  ];
  it.each(changes)("withholds a note for %s",(_,change)=>{const trace=complete();change(trace);syncCells(trace);expect(completedCuriousDailyIdeas(trace)).toEqual([]);});
  it("cannot stitch a missing sniff from an earlier interrupted attempt",()=>{
    const a=complete().slice(0,18),b=complete().filter(f=>!(f.scene==="D143-C"&&f.beat==="1"));
    b.forEach(f=>{f.at+=2000;});expect(completedCuriousDailyIdeas([...a,...b])).toEqual([]);
  });
  const unsupported=[
    ["D143-P","performer","lost prop during both outside routes and incomplete cheer rows"],
    ["D143-A","affectionate","unmeasured pointer approach"],
    ["D143-S","sleepy","replaced same-ID return"],
    ["D143-T","tidy","only500ms washing instead of required2000ms"],
    ["D143-M","mischievous","nudge labels without actual same-item movement"],
    ["D143-G","gourmet","different food IDs joined into a meal"],
    ["D143-H","homebody","missing window/sofa go, dataset-only controls and missing recovery rows"],
    ["D143-B","balanced","energy below.55 and unproved earlier meal"],
  ] as const;
  it.each(unsupported)("declares %s unsupported, retaining v1 counterexample: %s %s",(id,personality)=>{
    const trace=complete();trace.forEach(f=>{if(f.scene==="D143-C")f.scene=id;f.personality=personality;});
    expect(CURIOUS_COMPLETION_SCOPE.unsupported).toContain(id);expect(completedCuriousDailyIdeas(trace)).toEqual([]);
  });
  it("keeps only C supported and registers this suite as a mandatory finite factory gate",()=>{
    expect(CURIOUS_COMPLETION_SCOPE.supported).toEqual(["D143-C"]);expect(new Set(CURIOUS_COMPLETION_SCOPE.unsupported).size).toBe(8);
    expect(readFileSync("scripts/companion-qa/catalog.mjs","utf8")).toContain("'tests/unit/companion-curious-completion-144.test.ts'");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { companionSpriteMetadata as metadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { activityProgressTimes, type ActivityFrame, type ActivityObservation } from "../../scripts/companion-qa/activity-criteria.mjs";

// Run the real native observer's two AST declarations and its serialized
// function, rather than maintaining a second implementation of this gate.
// These are synthetic authenticated-adapter inputs, not native paint evidence.
const source=readFileSync("tests/visual/companion-personality-scenes-137.spec.ts","utf8");
const ast=ts.createSourceFile("companion-personality-scenes-137.spec.ts",source,ts.ScriptTarget.Latest,true);
const names=["meaningful","physicalEntryContinuation137"] as const;
const declarations=names.map(name=>{
  const matches=ast.statements.filter((node):node is ts.FunctionDeclaration=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
  if(matches.length!==1)throw Error(`Expected one actual ${name} observer declaration`);
  return ts.createPrinter().printNode(ts.EmitHint.Unspecified,matches[0],ast);
});
const compiled=ts.transpileModule(declarations.join("\n")+"\n({inspect:physicalEntryContinuation137,meaningful});",{
  reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},
});
if(compiled.diagnostics?.some(value=>value.category===ts.DiagnosticCategory.Error))throw Error("Actual entry observer did not serialize");
type Frame=ActivityFrame & { pose:number;enabled:boolean;roam:boolean;activity:ActivityObservation;scene:string;serial:string;sourcePaint:boolean;
  travel:{id:number;enabled:boolean};foods:string[];toys:{id:string;carried:boolean}[] };
type Witness={releasedAt:number;releasedScene:string;releasedSerial:string;kind:string;runId:number;firstAt:number;lastAt:number;followingDelay:number;pointCount:number;distance:number;
  points:{at:number;x:number;y:number;pose:number;source:boolean}[]};
type Inspect=(frames:readonly Frame[],first:Frame)=>Witness|undefined;
const actual=vm.runInNewContext(compiled.outputText,{activityProgressTimes,companionSpriteMetadata:metadata},{timeout:1000}) as {
  inspect:Inspect;meaningful:(frames:readonly Frame[],index:number,progress:ReadonlySet<number>)=>boolean;
};
const serialized=vm.runInNewContext(`(${actual.inspect.toString()})`,{activityProgressTimes,meaningful:actual.meaningful},{timeout:1000}) as Inspect;
const inspect=(frames:Frame[],first=frames[0])=>{
  const measured=actual.inspect(frames,first);
  expect(serialized(frames,first)).toEqual(measured);
  return measured;
};
function frame(at:number,patch:Partial<Frame>={}):Frame {
  return {at,x:100,y:600,state:"idle",pose:metadata.rows[0][0],visible:true,decoded:true,enabled:true,roam:true,
    scene:"",serial:"",sourcePaint:true,travel:{id:0,enabled:true},foods:[],toys:[],
    activity:{source:true,manual:false,epoch:0,jumpAllowed:true,width:60,height:60,anchor:{x:0,y:0,width:1920,height:1100},action:"",context:"same physical room"},...patch};
}
function fixture():Frame[] {
  return [frame(0,{scene:"entry-balanced",serial:"1",state:"stretch",pose:metadata.rows[16][0]}),
    frame(500,{scene:"entry-balanced",serial:"1",state:"stretch",pose:metadata.rows[16][1]}),
    frame(1000,{scene:"entry-balanced",serial:"1"}),frame(1200),
    ...Array.from({length:16},(_,index)=>{
      const value=frame(1300+index*50,{x:100+index*6,state:"walk",pose:metadata.rows[2][index%metadata.rows[2].length],travel:{id:1,enabled:true}});
      value.activity.action="walk";return value;
    })];
}
const mutations={
  "stuck entry scene and owner":(frames:Frame[])=>frames.forEach(value=>{value.scene="entry-balanced";value.serial="1";}),
  "released label with static coordinates":(frames:Frame[])=>frames.forEach(value=>{value.x=0;value.y=0;}),
  "unauthenticated source":(frames:Frame[])=>frames.forEach(value=>{value.activity.source=false;value.sourcePaint=false;}),
  "manual motion":(frames:Frame[])=>frames.forEach(value=>{value.activity.manual=true;}),
  "disabled companion":(frames:Frame[])=>frames.forEach(value=>{value.enabled=false;value.travel.enabled=false;}),
  "hidden body":(frames:Frame[])=>frames.forEach(value=>{value.visible=false;}),
  "undecoded body":(frames:Frame[])=>frames.forEach(value=>{value.decoded=false;}),
  "one stale pose":(frames:Frame[])=>frames.forEach(value=>{value.pose=metadata.rows[0][0];}),
  "layout epoch changes every frame":(frames:Frame[])=>frames.forEach((value,index)=>{value.activity.epoch=index;}),
  "continuation only after ten seconds":(frames:Frame[])=>frames.filter(value=>value.at>1200).forEach(value=>{value.at+=11000;}),
  "roam disabled":(frames:Frame[])=>frames.forEach(value=>{value.roam=false;}),
  "held body":(frames:Frame[])=>frames.forEach(value=>{value.state="held";}),
} satisfies Record<string,(frames:Frame[])=>void>;

describe("157 actual released entry continues as physical life without forced scene labels",()=>{
  it("executes the actual AST source and toString roundtrip for a real path after entry release",()=>{
    const frames=fixture(),result=inspect(frames);
    expect(new Set(frames.map(value=>value.scene).filter(Boolean))).toEqual(new Set(["entry-balanced"]));
    expect(result).toMatchObject({releasedAt:1200,releasedScene:"",releasedSerial:"",kind:"walk",runId:1,firstAt:1400,lastAt:2050,followingDelay:200,pointCount:14,distance:78});
    expect(result!.points.every(value=>value.source)).toBe(true);
    expect(result!.points.at(-1)!.x-result!.points[0].x).toBe(78);
  });
  it.each(Object.entries(mutations))("rejects %s without borrowing a label or ownership",(_name,mutate)=>{
    const frames=fixture();mutate(frames);expect(inspect(frames)).toBeUndefined();
  });
  it("requires the original entry owner to release as well as changing its label",()=>{
    const frames=fixture();frames.forEach(value=>{value.serial="1";});expect(inspect(frames)).toBeUndefined();
  });
  it("rejects a changed serial while the entry scene remains stuck",()=>{
    const frames=fixture();frames.forEach(value=>{value.scene="entry-balanced";});expect(inspect(frames)).toBeUndefined();
  });
  it("rejects fewer than three consecutive actually credited movement points",()=>{
    const frames=fixture();expect(inspect(frames.slice(0,8))).toBeUndefined();
  });
  it("rejects a falsely named walking row",()=>{
    const frames=fixture();frames.forEach(value=>{value.activity.action="";});expect(inspect(frames)).toBeUndefined();
  });
  it("rejects a per-frame moving anchor rather than treating scrolling as pet motion",()=>{
    const frames=fixture();frames.forEach((value,index)=>{value.activity.anchor!.y=index*5;});expect(inspect(frames)).toBeUndefined();
  });
  it("rejects observations separated beyond the actual activity coherence window",()=>{
    const frames=fixture();frames.filter(value=>value.at>=1300).forEach((value,index)=>{value.at=1300+index*300;});expect(inspect(frames)).toBeUndefined();
  });
  it("keeps the exact ten-second first meaningful followup boundary",()=>{
    const exact=fixture();exact.filter(value=>value.at>=1300).forEach(value=>{value.at+=9800;});expect(inspect(exact)?.followingDelay).toBe(10000);
    const late=fixture();late.filter(value=>value.at>=1300).forEach(value=>{value.at+=9800.01;});expect(inspect(late)).toBeUndefined();
  });
  it("credits a genuinely moving jump without inventing a precise landing requirement",()=>{
    const frames=fixture();frames.filter(value=>value.at>=1300).forEach((value,index)=>{value.state="jump";value.y=600-index*5;value.activity.action="jump";value.pose=metadata.rows[4][index%metadata.rows[4].length];});
    expect(inspect(frames)).toMatchObject({kind:"jump",followingDelay:200});
  });
  it("rejects jump activity when the actual jump setting is disabled",()=>{
    const frames=fixture();frames.filter(value=>value.at>=1300).forEach((value,index)=>{value.state="jump";value.y=600-index*5;value.activity.action="jump";value.activity.jumpAllowed=false;});expect(inspect(frames)).toBeUndefined();
  });
});

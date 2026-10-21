import { describe, expect, it } from "vitest";
import { companionSpriteMetadata as metadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { completedDailyIdeas157, daily157WashPrelude, daily157RestPrelude } from "../visual/helpers/companion-daily-ideas-157";
import type { QaObservation } from "../visual/helpers/companion-qa";
const translation=(x:number,y:number)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,0,1];
function sample(at:number,beat:string,state:string,row:number,column:number,x:number,scene="D157-C",serial="1"):QaObservation {
  const pose=metadata.rows[row][column%metadata.rows[row].length],frame=metadata.frames[pose],atlas=metadata.atlases[frame.atlas],size=92;
  return {at,x,y:600,visible:true,decoded:true,enabled:true,roam:true,eligible:true,owned:false,blocked:false,personality:"curious",state,scene,serial,beat,pose,frame:pose,play:"",foodAftertaste:"",platform:x>=120?"date-public":"companion-home-floor-2",sourceClipMeasured:true,
    curiousCompletion:{version:2,source:true,body:{x:x-46,y:508,width:92,height:92},day:null,
      guards:{preferencesObserved:true,jumpAllowed:true,foodGoalAbsent:true,feedIntentAbsent:true,episodeInactive:true,handsFree:true},
      cell:{currentPath:atlas.src,connectedToSprite:true,naturalWidth:atlas.width,naturalHeight:atlas.height,textureWidth:size*metadata.grid,textureHeight:size*metadata.gridRows,spriteWidth:size,spriteHeight:size,textureLeft:0,textureTop:0,
        textureMatrix:translation(-(frame.index%metadata.grid)*size,-Math.floor(frame.index/metadata.grid)*size),spriteMatrix:translation(frame.x/80*size,frame.y/80*size),spriteClipPath:`inset(${frame.clip.map(value=>`${value/80*100}%`).join(" ")})`,textureClipPath:"none"}}};
}
function complete(){
  const f:QaObservation[]=[sample(0,"","idle",0,0,20,""),sample(100,"","idle",0,1,20,"")];let at=100;
  for(let i=0;i<7;i++)f.push(sample(at+=100,"0","walk",2,i,20+i*10));
  for(let i=0;i<10;i++)f.push(sample(at+=100,"1","sniff",1,i,80));
  for(let i=0;i<12;i++)f.push(sample(at+=100,"2","walk",2,i,80+i*10));
  for(let i=0;i<10;i++)f.push(sample(at+=100,"3","stretch",16,i,190));
  for(let i=0;i<8;i++)f.push(sample(at+=100,"0","walk",2,i,190+i*10,"next-actual-task","2"));
  return f;
}
describe("157 native witness fails closed on labels, stitching and unfinished next work",()=>{
 it("recognizes source-authenticated local walk/sniff/outside/stretch and next different work without mutation",()=>{
  const frames=complete(),before=structuredClone(frames),r=completedDailyIdeas157(frames,"D157-C",{toyIds:[],foodIds:[]});
  expect(r).toHaveLength(1);expect(r[0]).toMatchObject({id:"D157-C",serial:"1",finalBeat:3,nextState:"walk"});expect(r[0].completedAt).toBeLessThan(r[0].subsequentAt);expect(r[0].subsequentAt-r[0].completedAt).toBeLessThanOrEqual(10000);expect(frames).toEqual(before);
 });
 it("accepts actual canonical-floor activity without claiming nonexistent numeric-floor evidence",()=>{
  const frames=complete();frames.filter(x=>x.scene==="D157-C"&&x.beat==="0").forEach(x=>x.platform="companion-home-floor");
  const witnesses=completedDailyIdeas157(frames,"D157-C",{toyIds:[],foodIds:[]});
  expect(witnesses).toHaveLength(1);expect(witnesses[0].preludes).not.toContain("actual-secondary");
 });
 const invalid:[string,(frames:QaObservation[])=>void][]=[
  ["missing same-execution serial",f=>f.forEach(x=>x.serial="")],
  ["mixed execution serials",f=>f.filter(x=>x.beat==="3").forEach(x=>x.serial="2")],
  ["labels with stale texture",f=>f.filter(x=>x.scene==="D157-C").forEach(x=>x.curiousCompletion.cell!.textureMatrix![12]+=92)],
  ["wrong decoded source path",f=>f.filter(x=>x.scene==="D157-C").forEach(x=>x.curiousCompletion.cell!.currentPath="/wrong.webp")],
  ["detached source texture",f=>f.forEach(x=>x.curiousCompletion.cell!.connectedToSprite=false)],
  ["invisible actor",f=>f.forEach(x=>x.visible=false)],
  ["disabled actor",f=>f.forEach(x=>x.enabled=false)],
  ["unobserved enabled preference",f=>f.forEach(x=>x.enabled=undefined)],
  ["CSS-hidden/unpainted source sprite",f=>f.forEach(x=>x.curiousCompletion.source=false)],
  ["unmeasured actual source crop",f=>f.forEach(x=>x.sourceClipMeasured=false)],
  ["wrong personality",f=>f.forEach(x=>x.personality="balanced")],
  ["next expression without movement",f=>f.filter(x=>x.scene==="next-actual-task").forEach(x=>{x.state="idle";x.x=190;})],
  ["same old scene replay is not a new activity",f=>f.filter(x=>x.scene==="next-actual-task").forEach(x=>x.scene="D157-C")],
  ["go label with no actual first step",f=>f.filter(x=>x.beat==="0"&&x.scene==="D157-C").forEach(x=>{x.state="idle";x.x=20;})],
  ["bath-pad stance is not ordinary local-floor activity",f=>f.filter(x=>x.beat==="0"&&x.scene==="D157-C").forEach(x=>x.platform="companion-home-floor-400")],
  ["food-only support is not ordinary local-floor activity",f=>f.filter(x=>x.beat==="0"&&x.scene==="D157-C").forEach(x=>x.platform="companion-home-floor-food")],
  ["stitched different room supports are not a same-span actual24px walk",f=>f.filter(x=>x.beat==="0"&&x.scene==="D157-C").forEach((x,i)=>x.platform=`companion-home-floor-${i+1}`)],
  ["private scene cannot pretend to reach outside",f=>f.filter(x=>x.scene==="D157-C").forEach(x=>x.platform="companion-home-floor-2")],
  ["required final pose omitted",f=>{for(let i=f.length-1;i>=0;i--)if(f[i].scene==="D157-C"&&f[i].beat==="3")f.splice(i,1);}],
  ["single frozen final cell",f=>{const last=f.filter(x=>x.scene==="D157-C"&&x.beat==="3");last.forEach(x=>{x.pose=last[0].pose;x.curiousCompletion.cell=structuredClone(last[0].curiousCompletion.cell);});}],
  ["reordered timestamps",f=>{f[4].at=f[3].at;}],
  ["next work more than ten seconds later",f=>f.filter(x=>x.scene==="next-actual-task").forEach(x=>x.at+=10000)],
 ];
 it.each(invalid)("rejects %s",(_name,mutate)=>{const f=complete();mutate(f);expect(completedDailyIdeas157(f,"D157-C",{toyIds:[],foodIds:[]})).toEqual([]);});
 it("does not apply this collector to unproved legacy goals",()=>expect(completedDailyIdeas157(complete(),"D143-C",{toyIds:[],foodIds:[]})).toEqual([]));
 const wash=()=>Array.from({length:15},(_,i)=>{
  const f=sample(i*100,"1","play",9,i,125,"T05");f.platform="companion-home-floor-400";f.command="wash";
  f.wash={signaled:true,command:"wash",row9:true,body:{x:79,y:508,width:92,height:92},pad:{x:100,y:560,width:50,height:40/.72,visible:true,decoded:true},
   brush:{x:100+i*.8,y:560+i*.3,width:10,height:20,visible:true,angle:i*6}};return f;
 });
 it("requires the existing actual500ms moving brush/pad/body contact before final-cleanup continuation",()=>expect(daily157WashPrelude(wash())).toBe(true));
 it.each(["stationary","missing","too-short","wrong-pad","not-contacting"])("rejects %s wash prelude despite its source/label",kind=>{
  const f=wash();if(kind==="too-short")f.splice(4);
  f.forEach(x=>{if(kind==="stationary")Object.assign(x.wash!.brush!,{x:100,y:560,angle:0});if(kind==="missing")x.wash!.brush=null;if(kind==="wrong-pad")x.platform="companion-home-floor-2";if(kind==="not-contacting")x.wash!.brush!.x=900;});
  expect(daily157WashPrelude(f)).toBe(false);
 });
 const rest=()=>Array.from({length:36},(_,i)=>{const f=sample(i*100,"3","sleep",40,i,125,"routine-nap","7");f.personality="homebody";f.platform="companion-home";return f;});
 it("requires one contiguous same-owner actual decoded home rest bout before homebody continuation",()=>expect(daily157RestPrelude(rest())).toBe(true));
 it.each(["two-short-bouts","owner-switch","observation-gap","latest-short-bout","outside","missing-owner","unpainted","expired"])("rejects %s rather than adding historical sleep samples",kind=>{
  let f=rest();
  if(kind==="two-short-bouts")f[17]={...f[17],state:"idle"};
  if(kind==="owner-switch")f.slice(17).forEach(x=>x.serial="8");
  if(kind==="observation-gap")f.slice(17).forEach(x=>x.at+=181);
  if(kind==="latest-short-bout")f=[...f,{...f.at(-1)!,at:3600,state:"idle"},...rest().slice(0,12).map(x=>({...x,at:x.at+3700,serial:"8"}))];
  if(kind==="outside")f.forEach(x=>x.platform="date-public");
  if(kind==="missing-owner")f.forEach(x=>x.serial="");
  if(kind==="unpainted")f.forEach(x=>x.curiousCompletion.source=false);
  if(kind==="expired")f.push({...f.at(-1)!,at:19000,state:"idle"});
  expect(daily157RestPrelude(f)).toBe(false);
 });
});

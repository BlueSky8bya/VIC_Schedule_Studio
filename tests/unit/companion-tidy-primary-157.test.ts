import { describe, expect, it } from "vitest";
import { companionSpriteMetadata as metadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { completedTidyReturnGoal157, type TidyPrimaryFrame157 as Frame } from "../visual/helpers/companion-tidy-primary-157";
import type { CuriousTextureCellMeasurement } from "../visual/helpers/companion-curious-completion-144";

const id="actual-toy-7",box={x:200,y:172},scene="X-T-return-time",serial="2";
const matrix=(x:number,y:number)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,0,1];
function cell(pose:number):CuriousTextureCellMeasurement {
  const f=metadata.frames[pose],atlas=metadata.atlases[f.atlas],size=92;
  return {currentPath:atlas.src,connectedToSprite:true,naturalWidth:atlas.width,naturalHeight:atlas.height,
    textureWidth:size*metadata.grid,textureHeight:size*metadata.gridRows,spriteWidth:size,spriteHeight:size,
    textureLeft:0,textureTop:0,textureMatrix:matrix(-(f.index%metadata.grid)*size,-Math.floor(f.index/metadata.grid)*size),
    spriteMatrix:matrix(f.x/80*size,f.y/80*size),spriteClipPath:`inset(${f.clip.map(value=>`${value/80*100}%`).join(" ")})`,textureClipPath:"none"};
}
function frame(at:number,patch:Partial<Frame>={}):Frame {
  const state=patch.state??"walk",row=state==="play"?30:state==="look"?1:2;
  const pose=metadata.rows[row][Math.floor(at/50)%Math.min(4,metadata.rows[row].length)];
  return {at,scene,serial,beat:"0",state,play:"",pose,x:200,y:172,platform:"companion-home-floor",
    visible:true,decoded:true,sourcePaint:true,cell:cell(pose),toys:[],...patch};
}
function fixture():Frame[] {
  const carried={id,carried:true,held:false,...box};
  return [frame(0,{toys:[carried]}),frame(50,{toys:[carried]}),
    frame(100,{beat:"1",x:195}),frame(150,{beat:"1",x:180}),
    ...Array.from({length:31},(_,i)=>frame(200+i*50,{beat:"2",state:"play",play:"groom",x:175})),
    frame(1750,{scene:"T07",serial:"3",state:"look",x:175}),frame(1800,{scene:"T07",serial:"3",state:"look",x:175})];
}
const inspect=(frames:Frame[])=>completedTidyReturnGoal157(frames,id,box);
describe("157 complete alternate tidy physical primary, without literal T01 relabelling",()=>{
  it("requires the same physical return, real floor travel, full finite groom and actual next action",()=>{
    expect(inspect(fixture())).toEqual([{id:scene,serial,samePhysicalId:id,catalogMajor:false,role:"equivalent-physical-primary"}]);
  });
  it.each(["no final groom","short groom","borrowed groom","wrong source","wrong cell","no movement","no next action",
    "wrong toy","held toy","no removal","far box","missing serial","observation gap","nonmonotonic"])("rejects %s",reason=>{
    let f=fixture();
    if(reason==="no final groom")f=f.filter(value=>value.beat!=="2");
    if(reason==="short groom")f=f.filter(value=>value.beat!=="2"||value.at<800);
    if(reason==="borrowed groom")f=f.map(value=>value.beat==="2"?{...value,serial:"6"}:value);
    if(reason==="wrong source")f=f.map(value=>({...value,sourcePaint:false}));
    if(reason==="wrong cell")f=f.map(value=>({...value,cell:{...value.cell!,connectedToSprite:false}}));
    if(reason==="no movement")f=f.map(value=>({...value,x:200}));
    if(reason==="no next action")f=f.filter(value=>value.scene===scene);
    if(reason==="wrong toy")f=f.map(value=>({...value,toys:value.toys.map(toy=>({...toy,id:"other"}))}));
    if(reason==="held toy")f=f.map(value=>({...value,toys:value.toys.map(toy=>({...toy,held:true}))}));
    if(reason==="no removal")f=f.map(value=>({...value,toys:[{id,carried:true,held:false,...box}]}));
    if(reason==="far box")f=f.map(value=>({...value,toys:value.toys.map(toy=>({...toy,x:500}))}));
    if(reason==="missing serial")f=f.map(value=>({...value,serial:""}));
    if(reason==="observation gap")f=f.filter(value=>value.at<600||value.at>900);
    if(reason==="nonmonotonic")f=[f[1],f[0],...f.slice(2)];
    expect(inspect(f)).toEqual([]);
  });
});

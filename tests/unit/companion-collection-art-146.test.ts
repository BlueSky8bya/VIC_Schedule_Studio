import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import sharp from "sharp";
import {describe,expect,it} from "vitest";
import fixture from "../fixtures/companion-collection-146-runtime.json";
import {COMPANION_SNACK_EXPANSION_146} from "@/lib/ui/viewer-companion/snack-expansion-146";
import {COMPANION_TOY_EXPANSION_146} from "@/lib/ui/viewer-companion/toy-expansion-146";
import {COMPANION_COLLECTION_ATLASES,COMPANION_COLLECTION_FRAMES} from "@/lib/ui/viewer-companion/collection-art";
import {getCompanionFoodArtFrame} from "@/lib/ui/viewer-companion/food-art";
import {getCompanionToyArt,COMPANION_TOY_VISUALS} from "@/lib/ui/viewer-companion/toy-catalog";
const sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
describe("146 actual broadcast-homage sprites",()=>{
 it("covers all append-only food and toy identities with unique local art",()=>{
  expect(fixture.foods.map(x=>x.id)).toEqual(COMPANION_SNACK_EXPANSION_146.map(x=>x.id));
  expect(fixture.toys.map(x=>x.id)).toEqual(COMPANION_TOY_EXPANSION_146.map(x=>x.id));
  expect(fixture.runtimeFiles).toHaveLength(25);
  expect(new Set(fixture.runtimeFiles.map(x=>x.sha256)).size).toBe(25);
  for(const item of COMPANION_SNACK_EXPANSION_146){
   const f=COMPANION_COLLECTION_FRAMES.food[item.id],runtime=getCompanionFoodArtFrame(item.id)!;
   expect(COMPANION_COLLECTION_FRAMES["food-stamp"][item.id]).toEqual(f);
   expect(runtime).toMatchObject({src:COMPANION_COLLECTION_ATLASES[f.atlas]!.src,x:f.x,y:f.y,width:128,height:128});
  }
  for(const item of COMPANION_TOY_EXPANSION_146){
   expect(getCompanionToyArt(item.id)).toBe(`/companion/home/146/toy-${item.id}.webp`);
   expect(Math.max(COMPANION_TOY_VISUALS[item.id].width,COMPANION_TOY_VISUALS[item.id].height)).toBeLessThanOrEqual(44);
  }
 });
 it("verifies delivered bytes, transparent margins, and distinct nonempty decoded pictures",async()=>{
  const decoded=new Set<string>();
  for(const file of fixture.runtimeFiles){
   const bytes=readFileSync(`public${file.src}`);expect(sha(bytes)).toBe(file.sha256);expect(bytes.length).toBe(file.bytes);
   const {data,info}=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   const foodAtlas=file.src.includes("collection/");
   expect([info.width,info.height]).toEqual(foodAtlas?[512,384]:fixture.toys.find(t=>t.src===file.src)!.size);
   const width=foodAtlas?128:info.width,height=foodAtlas?128:info.height;
   for(let top=0;top<info.height;top+=height)for(let left=0;left<info.width;left+=width){
    const cell=await sharp(bytes).extract({left,top,width,height}).ensureAlpha().raw().toBuffer();
    const hash=sha(cell);expect(decoded.has(hash)).toBe(false);decoded.add(hash);
    let visible=0;for(let y=0;y<height;y++)for(let x=0;x<width;x++){
     const alpha=cell[(y*width+x)*4+3];if(alpha>0)visible++;
     if(x===0||y===0||x===width-1||y===height-1)expect(alpha).toBe(0);
    }
    expect(visible).toBeGreaterThan(200);
   }
   expect(data.length).toBe(info.width*info.height*4);
  }
  expect(decoded.size).toBe(36);
 });
 it("retains readable narrow toy silhouettes from decoded opaque pixels in their actual contain box",async()=>{
  for(const item of COMPANION_TOY_EXPANSION_146){
   const t=fixture.toys.find(t=>t.id===item.id)!,scale=Math.min(item.width/t.size[0],item.height/t.size[1]);
   const {data,info}=await sharp(readFileSync(`public${t.src}`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let left=info.width,top=info.height,right=-1,bottom=-1;
   for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
   expect(Math.max((right-left+1)*scale,(bottom-top+1)*scale),item.id).toBeGreaterThanOrEqual(26);
  }
 });
});

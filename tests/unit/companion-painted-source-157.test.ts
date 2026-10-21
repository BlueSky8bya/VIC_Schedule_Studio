import { describe, expect, it } from "vitest";
import { createCompanionExpressionPixelVerifier157 } from "../visual/helpers/companion-painted-source-157";
import anchors from "@/lib/ui/viewer-companion/expression-anchors-161.json";
import { companionSpriteMetadata as metadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { curiousTextureCellMatches, type CuriousTextureCellMeasurement } from "../visual/helpers/companion-curious-completion-144";

const direct=createCompanionExpressionPixelVerifier157();
// Exercise the same trusted serialization/newFunction boundary used by the
// real browser. No imported closure/helper may accidentally be required.
const serialized=(new Function("return ("+createCompanionExpressionPixelVerifier157.toString()+")")() as typeof createCompanionExpressionPixelVerifier157)();
const compare:typeof direct.compare=(...args)=>{const actual=direct.compare(...args);expect(serialized.compare(...args)).toEqual(actual);return actual;};
const samePlane:typeof direct.samePlane=(...args)=>{const actual=direct.samePlane(...args);expect(serialized.samePlane(...args)).toBe(actual);return actual;};
const mask=direct.mask;
const pose=anchors.frames.find(f=>f.physicalIndex===anchors.reference)!;
const original=()=>{const p=new Uint8ClampedArray(192*192*4);for(let i=0;i<p.length;i+=4)p.set([241,221,178,253],i);return p;};
function fixture(){const source=original(),permitted=mask(source,pose,pose)!;
  const pixel=permitted.findIndex((v,i)=>v===1&&permitted[i-1]===1&&permitted[i+1]===1),painted=source.slice();
  painted.set([70,50,30],pixel*4);return {source,painted,pixel,permitted};}
const matrix=(x:number,y:number)=>[1,0,0,0,0,1,0,0,0,0,1,0,x,y,0,1];
function cell(index=0):CuriousTextureCellMeasurement {
  const f=metadata.frames[index],a=metadata.atlases[f.atlas],s=92;
  return {currentPath:a.src,connectedToSprite:true,naturalWidth:a.width,naturalHeight:a.height,
    textureWidth:s*metadata.grid,textureHeight:s*metadata.gridRows,spriteWidth:s,spriteHeight:s,textureLeft:0,textureTop:0,
    textureMatrix:matrix(-(f.index%metadata.grid)*s,-Math.floor(f.index/metadata.grid)*s),spriteMatrix:matrix(f.x/80*s,f.y/80*s),
    spriteClipPath:`inset(${f.clip.map(n=>`${n/80*100}%`).join(" ")})`,textureClipPath:"none"};
}
describe("157 actual current-cell canvas comparison shared verbatim with browser",()=>{
  it("serializes the actual calibrated mask without a module closure",()=>{
    const p=original();expect(serialized.mask(p,pose,pose)).toEqual(mask(p,pose,pose));
  });
  it("compares all36864 alpha bytes and every non-face RGB pixel, preserving source alpha253",()=>{
    const f=fixture(),p=compare(f.source,f.painted,pose,pose);
    expect(p.valid).toBe(true);expect(p.alphaCompared).toBe(36864);expect(p.alphaMismatch).toBe(0);
    expect(p.protectedRgbCompared+p.maskPixels).toBe(36864);expect(p.protectedRgbMismatch).toBe(0);expect(p.changedFacePixels).toBe(1);
  });
  it("rejects stale identical source instead of inventing a visible changed expression",()=>{
    const p=original();expect(compare(p,p.slice(),pose,pose).valid).toBe(false);
  });
  it.each([0,1,191,192,12001,36863])("detects exact alpha mismatch at pixel%s",index=>{
    const f=fixture();f.painted[index*4+3]--;const p=compare(f.source,f.painted,pose,pose);
    expect(p.alphaMismatch).toBe(1);expect(p.valid).toBe(false);
  });
  it("checks every alpha position rather than a face sample",()=>{
    const f=fixture();for(let i=3;i<f.painted.length;i+=4)f.painted[i]--;
    expect(compare(f.source,f.painted,pose,pose).alphaMismatch).toBe(36864);
  });
  it("checks every protected RGB pixel, including the whole body and transparent margin",()=>{
    const f=fixture();for(let i=0;i<36864;i++)if(!f.permitted[i])f.painted[i*4]--;
    const p=compare(f.source,f.painted,pose,pose);expect(p.protectedRgbMismatch).toBe(p.protectedRgbCompared);expect(p.valid).toBe(false);
  });
  it("preserves orange cheeks even inside a calibrated rectangle",()=>{
    const f=fixture();f.source.set([240,170,100],f.pixel*4);f.painted=f.source.slice();f.painted[f.pixel*4]--;
    const p=compare(f.source,f.painted,pose,pose);expect(p.protectedRgbMismatch).toBe(1);expect(p.valid).toBe(false);
  });
  it("cannot use a neutral reference body for a different current source cell",()=>{
    const f=fixture(),body=f.permitted.findIndex(v=>!v);f.source[body*4]=100;
    expect(compare(f.source,f.painted,pose,pose).valid).toBe(false);
  });
  it("does not admit patches over source alpha below245",()=>{
    const f=fixture();for(let i=3;i<f.source.length;i+=4)f.source[i]=244;f.painted=f.source.slice();f.painted[f.pixel*4]--;
    expect(compare(f.source,f.painted,pose,pose).valid).toBe(false);
  });
  it.each([0,4,192*192*4-1,192*192*4+4])("rejects blank/truncated/wrong-size painted buffer%s",length=>{
    expect(compare(original(),new Uint8ClampedArray(length),pose,pose).valid).toBe(false);
  });
  it("requires two calibrated eyes",()=>{
    const f=fixture();expect(compare(f.source,f.painted,{...pose,eyes:[]},pose).valid).toBe(false);
  });
});
describe("157 current immutable registration and actual canvas plane",()=>{
  it("matches the same measured translated plane",()=>expect(samePlane([92,92],[92,92],matrix(2,3),matrix(2,3),[0,0,0,0])).toBe(true));
  it.each([[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1],[NaN,0,0,0],[]].map(offset=>({offset})))("rejects out-of-plane/missing actual bounds $offset",({offset})=>{
    expect(samePlane([92,92],[92,92],matrix(2,3),matrix(2,3),offset)).toBe(false);
  });
  it.each([[91,92],[92,91],[192,192],[0,0],[NaN,92]].map(size=>({size})))("rejects wrong CSS canvas size $size",({size})=>{
    expect(samePlane([92,92],size,matrix(2,3),matrix(2,3),[0,0,0,0])).toBe(false);
  });
  it("rejects a differently translated or scaled canvas",()=>{
    const scaled=matrix(2,3);scaled[0]=.9;
    for(const m of [matrix(3,3),scaled,[]])expect(samePlane([92,92],[92,92],matrix(2,3),m,[0,0,0,0])).toBe(false);
  });
  it("retains the independent exact atlas/cell gate",()=>expect(curiousTextureCellMatches(0,cell())).toBe(true));
  it.each([-1,NaN,Infinity,metadata.frames.length])("rejects unregistered current pose%s",pose=>expect(curiousTextureCellMatches(pose,cell())).toBe(false));
  it.each(["currentPath","naturalWidth","naturalHeight","spriteClipPath","textureMatrix","connectedToSprite"])("rejects wrong current source registration%s",field=>{
    const f=cell();const wrong={currentPath:"/wrong-atlas.webp",naturalWidth:1,naturalHeight:1,spriteClipPath:"inset(0%)",textureMatrix:matrix(99,99),connectedToSprite:false};
    expect(curiousTextureCellMatches(0,{...f,[field]:wrong[field as keyof typeof wrong]})).toBe(false);
  });
});

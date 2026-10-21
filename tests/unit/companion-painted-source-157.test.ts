import { describe, expect, it } from "vitest";
import { createCompanionExpressionPixelVerifier157 } from "../visual/helpers/companion-painted-source-157";
import anchors from "@/lib/ui/viewer-companion/expression-anchors-161.json";
import { companionSpriteMetadata as metadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { curiousTextureCellMatches, type CuriousTextureCellMeasurement } from "../visual/helpers/companion-curious-completion-144";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { companionFaceLayout } from "@/lib/ui/viewer-companion/face-layout";

const direct=createCompanionExpressionPixelVerifier157();
// Exercise the same trusted serialization/newFunction boundary used by the
// real browser. No imported closure/helper may accidentally be required.
const serialized=(new Function("return ("+createCompanionExpressionPixelVerifier157.toString()+")")() as typeof createCompanionExpressionPixelVerifier157)();
const compare:typeof direct.compare=(...args)=>{const actual=direct.compare(...args);expect(serialized.compare(...args)).toEqual(actual);return actual;};
const samePlane:typeof direct.samePlane=(...args)=>{const actual=direct.samePlane(...args);expect(serialized.samePlane(...args)).toBe(actual);return actual;};
const mask=direct.mask;
const pose=anchors.frames.find(f=>f.physicalIndex===anchors.reference)!;
// Compile the actual163 painter's opaque-background and patch geometry.
// Repeating a second hand-written box formula here could miss future drift.
const painterSource=readFileSync("lib/ui/viewer-companion/expression-painter.ts","utf8");
const painterAst=ts.createSourceFile("expression-painter.ts",painterSource,ts.ScriptTarget.Latest,true);
const painterNodes:ts.Node[]=[];const visit=(node:ts.Node)=>{painterNodes.push(node);ts.forEachChild(node,visit);};visit(painterAst);
const background=painterNodes.find((node):node is ts.VariableDeclaration=>ts.isVariableDeclaration(node)&&node.name.getText(painterAst)==="background")!;
const declaration=(name:string)=>painterNodes.find((node):node is ts.VariableDeclaration=>ts.isVariableDeclaration(node)&&node.name.getText(painterAst)===name);
const eyePatches=declaration("eyePatches"),mouthCenter=declaration("m"),mouthBox=declaration("mouthBox"),mouthFill=declaration("mouthFill");
if(!background||!eyePatches||!mouthCenter||!mouthBox||!mouthFill||!eyePatches.initializer||!ts.isCallExpression(eyePatches.initializer)
  ||eyePatches.initializer.expression.getText(painterAst)!=="pose.eyes.map")throw Error("Actual163 painter mask declarations are missing");
const print=(node:ts.Node)=>ts.createPrinter().printNode(ts.EmitHint.Unspecified,node,painterAst);
const actualMaskCode=ts.transpileModule(`
const PIXELS=192,SCALE=PIXELS/80,allowed=new Uint8Array(PIXELS*PIXELS);
const mix=(a,b,p)=>a+(b-a)*p;
const face={gazeX:0,gazeY:0,weight:1,smile:.7,open:1,tremble:.3};
const layout=companionFaceLayout(pose);
const pixels={getImageData(left,top,width,height){const data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)data.set(source.subarray(((top+y)*PIXELS+left+x)*4,((top+y)*PIXELS+left+x)*4+4),(y*width+x)*4);
  return {data,width,height};}};
const ${print(background)};
const ${print(eyePatches)};
const ${print(mouthCenter)};
const ${print(mouthBox)};
const ${print(mouthFill)};
return {allowed,eyePatches,mouthBox,mouthFill};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const compilePainterPatches=new Function("source","pose","reference","companionFaceLayout",actualMaskCode);
const actualPainterPatches=((source,current,reference)=>compilePainterPatches(source,current,reference,companionFaceLayout)) as (source:Uint8ClampedArray,current:typeof pose,reference:typeof pose)=>{
  allowed:NonNullable<ReturnType<typeof direct.mask>>;eyePatches:{box:number[];fill:string|undefined}[];mouthBox:number[]|undefined;mouthFill:string|undefined;
};
const actualPainterMask:typeof direct.mask=(source,current,reference)=>actualPainterPatches(source,current,reference).allowed;
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
  it("admits the measured pose156 eye from cream samples while retaining the opaque-source guard",()=>{
    const current=anchors.frames.find(p=>p.physicalIndex===156)!,source=original();
    const primary=actualPainterPatches(source,current,pose).eyePatches[1].box;
    const [left,,right,bottom]=primary.map(n=>Math.round(n*192/80));
    for(const x of [left,right])source.set([170,110,80],(bottom*192+x)*4);
    const admitted=actualPainterPatches(source,current,pose);
    expect(admitted.eyePatches[1].box).toEqual(primary);expect(admitted.eyePatches[1].fill).toBeTruthy();
    expect(mask(source,current,pose)).toEqual(admitted.allowed);
    const eye=current.eyes[1];if(!("skinSamples" in eye)||!eye.skinSamples)throw Error("Measured skin samples missing");
    const sample=eye.skinSamples[1],index=Math.round(sample[1]*2.4)*192+Math.round(sample[0]*2.4);
    source[index*4+3]=244;
    const denied=actualPainterPatches(source,current,pose);
    expect(denied.eyePatches[1].box).not.toEqual(primary);expect(denied.allowed[index]).toBe(0);
    expect(mask(source,current,pose)).toEqual(denied.allowed);
  });
  it("matches actual163 eye/brow, mouth and fallback geometry for every compiled front/quarter pose",()=>{
    for(const anchor of anchors.frames){
      const source=original();
      expect(Buffer.compare(Buffer.from(mask(source,anchor,pose)!),Buffer.from(actualPainterMask(source,anchor,pose)!))).toBe(0);
    }
  });
  it("matches the actual painter's opacity/corner admission as well as its boxes",()=>{
    for(const anchor of anchors.frames.filter((_,i)=>i%7===0)){
      const source=original();for(let i=3;i<source.length;i+=324)source[i]=244;
      expect(Buffer.compare(Buffer.from(mask(source,anchor,pose)!),Buffer.from(actualPainterMask(source,anchor,pose)!))).toBe(0);
    }
  });
  it.each(["alpha","corners"] as const)("uses only the actual authored-eye fallback after a failed primary%s patch",failure=>{
    const source=original(),primary=actualPainterPatches(source,pose,pose).eyePatches[0].box;
    const [left,top,right]=primary.map(n=>Math.round(n*192/80));
    const denied=top*192+left;
    if(failure==="alpha")source[denied*4+3]=244;
    else for(const x of [left,right])source.set([170,100,70],(top*192+x)*4);
    const actual=actualPainterPatches(source,pose,pose),permitted=mask(source,pose,pose)!;
    expect(actual.eyePatches[0].fill).toBeTruthy();expect(actual.eyePatches[0].box).not.toEqual(primary);
    expect(Buffer.compare(Buffer.from(permitted),Buffer.from(actual.allowed))).toBe(0);
    expect(permitted[denied]).toBe(0);
    const changed=permitted.findIndex(value=>value===1),painted=source.slice();painted[changed*4]--;
    expect(compare(source,painted,pose,pose).valid).toBe(true);
    painted[denied*4]--;
    const rejected=compare(source,painted,pose,pose);expect(rejected.protectedRgbMismatch).toBe(1);expect(rejected.valid).toBe(false);
  });
  it("protects pixels immediately outside each actual163 eye and mouth patch",()=>{
    const source=original(),actual=actualPainterPatches(source,pose,pose),permitted=mask(source,pose,pose)!;
    expect(actual.mouthFill).toBeTruthy();
    const boxes=[...actual.eyePatches.map(p=>p.box),actual.mouthBox!],changed=permitted.findIndex(value=>value===1);
    for(const box of boxes){
      const [left,top,right,bottom]=box.map(n=>Math.round(n*192/80));
      const candidates=[[left-1,Math.round((top+bottom)/2)],[right+1,Math.round((top+bottom)/2)],
        [Math.round((left+right)/2),top-1],[Math.round((left+right)/2),bottom+1]];
      const outside=candidates.map(([x,y])=>y*192+x).find(index=>index>=0&&index<36864&&!permitted[index]);
      expect(outside).toBeDefined();
      const painted=source.slice();painted[changed*4]--;painted[outside!*4]--;
      const proof=compare(source,painted,pose,pose);expect(proof.alphaCompared).toBe(36864);
      expect(proof.protectedRgbMismatch).toBe(1);expect(proof.valid).toBe(false);
    }
  });
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
  it("can replace a red native mouth while preserving orange pixels in the surrounding mouth patch",()=>{
    const source=original(),permitted=mask(source,pose,pose)!,m=pose.mouth!;
    const inMouth=(p:number)=>{const x=p%192/2.4,y=Math.floor(p/192)/2.4;return x>=m.bounds[0]-.6&&x<=m.bounds[2]+.6&&y>=m.bounds[1]-.6&&y<=m.bounds[3]+.6;};
    const mouth=permitted.findIndex((v,p)=>v===2&&inMouth(p)),cheek=permitted.findIndex((v,p)=>v===2&&!inMouth(p));
    expect(mouth).toBeGreaterThanOrEqual(0);expect(cheek).toBeGreaterThanOrEqual(0);
    source.set([240,150,100],mouth*4);source.set([240,150,100],cheek*4);
    const painted=source.slice();painted[mouth*4]--;
    expect(compare(source,painted,pose,pose).valid).toBe(true);
    painted[cheek*4]--;
    const rejected=compare(source,painted,pose,pose);expect(rejected.protectedRgbMismatch).toBe(1);expect(rejected.valid).toBe(false);
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
  it.each([NaN,Infinity])("rejects a nonfinite calibrated eye center%s instead of falling back to a wider permission",value=>{
    const f=fixture(),invalid={...pose,eyes:[{...pose.eyes[0],center:[value,pose.eyes[0].center[1]]},pose.eyes[1]]};
    expect(compare(f.source,f.painted,invalid,pose).valid).toBe(false);
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

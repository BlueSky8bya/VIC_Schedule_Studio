import type { Page } from "@playwright/test";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import expressionAnchors from "@/lib/ui/viewer-companion/expression-anchors-161.json";

export type PaintedSource157Proof = {
  version: 1; passed: boolean; mode: "atlas" | "expression" | "unmeasured"; pose: number; source: string;
  reason: string; cell?: { index: number; grid: number; rows: number; natural: number[] };
  geometry?: { sameParent: boolean; sprite: number[]; canvas?: number[]; matrix: number[]; canvasMatrix?: number[];
    clip: string; canvasClip?: string; offset?: number[] };
  pixels?: { total: number; alphaCompared: number; alphaMismatch: number; protectedRgbCompared: number;
    protectedRgbMismatch: number; changedFacePixels: number; maskPixels: number; valid: boolean };
};
export type PaintedSource157Window = Window & { companionPaintedSource157?: { inspect(actor?: Element | null): PaintedSource157Proof } };

type ExpressionAnchor157 = typeof expressionAnchors.frames[number];
/** Pure comparator serialized verbatim into the browser observer. Tests call
 * this same exported factory, including the exact calibrated mask operation.
 *162 draws clipped reference eyes even for a narrow blink. Its permitted
 * geometry still uses the reference eye bounds; no wider face mask is needed. */
export function createCompanionExpressionPixelVerifier157() {
  function maskExpressionPixels157(source: Uint8ClampedArray, pose: ExpressionAnchor157, reference: ExpressionAnchor157) {
    const size=192,total=size*size,scale=size/80,mask=new Uint8Array(total);
    if(source.length!==total*4||pose.eyes.length!==2||reference.eyes.length!==2)return null;
      const permit=(box:number[])=>{
        if(box.length!==4||!box.every(Number.isFinite))return;
        const [left,top,right,bottom]=box.map(n=>Math.round(n*scale));
        if(left<0||top<0||right>=size||bottom>=size||right<=left||bottom<=top)return;
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(source[(y*size+x)*4+3]<245)return;
        let corners=0;for(const [x,y]of[[left,top],[right,top],[left,bottom],[right,bottom]]){
          const i=(y*size+x)*4;if(source[i]>=190&&source[i+1]>=175&&source[i+2]>=130)corners++;
        }
        if(corners<3)return;
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)mask[y*size+x]=1;
      };
      for(let i=0;i<2;i++){
        const eye=pose.eyes[i],original=reference.eyes[i],view=pose.orientation==="quarter"?.83:1;
        if(eye.center.length!==2||eye.bounds.length!==4||original.bounds.length!==4) return null;
        const [x,y]=eye.center,width=(original.bounds[2]-original.bounds[0])*view,height=(original.bounds[3]-original.bounds[1])*view;
        permit([Math.min(eye.bounds[0],x-width/2-.5)-.65,Math.min(eye.bounds[1],y-height/2-.5)-.65,
          Math.max(eye.bounds[2],x+width/2+.5)+.65,Math.max(eye.bounds[3],y+height/2+.5)+.65]);
      }
      if(pose.mouth){const m=pose.mouth;permit([m.bounds[0]-.8,m.bounds[1]-1.7,m.bounds[2]+.8,m.bounds[3]+1.8]);}
    return mask;
  }
  function compareExpressionPixels157(source: Uint8ClampedArray, current: Uint8ClampedArray, pose: ExpressionAnchor157, reference: ExpressionAnchor157) {
    const total=192*192;
    const result={total,alphaCompared:0,alphaMismatch:0,protectedRgbCompared:0,protectedRgbMismatch:0,changedFacePixels:0,maskPixels:0,valid:false};
    if(source.length!==total*4||current.length!==source.length)return result;
    const mask=maskExpressionPixels157(source,pose,reference);if(!mask)return result;
      for(let p=0;p<total;p++){
        const i=p*4,orange=source[i]>210&&source[i+1]<190&&source[i+2]<135;
        result.alphaCompared++;if(source[i+3]!==current[i+3])result.alphaMismatch++;
        const changed=source[i]!==current[i]||source[i+1]!==current[i+1]||source[i+2]!==current[i+2];
        if(mask[p])result.maskPixels++;
        if(!mask[p]||orange){result.protectedRgbCompared++;if(changed)result.protectedRgbMismatch++;}
        else if(changed)result.changedFacePixels++;
      }
      result.valid=result.alphaCompared===total&&result.alphaMismatch===0&&result.protectedRgbMismatch===0&&result.changedFacePixels>0;
      return result;
    }

  function samePlane157(sprite:number[],canvas:number[],sourceMatrix:number[],canvasMatrix:number[],offset:number[]) {
    const close=(a:number,b:number,tolerance=.05)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;
    return [sprite,canvas,sourceMatrix,canvasMatrix,offset].every(Array.isArray)
      &&sprite.length===2&&canvas.length===2&&sprite.every(n=>Number.isFinite(n)&&n>0)
      &&canvas.every((n,i)=>close(n,sprite[i]))&&sourceMatrix.length===16&&canvasMatrix.length===16
      &&sourceMatrix.every((n,i)=>close(n,canvasMatrix[i],i===12||i===13?.05:.000001))
      &&offset.length===4&&offset.every(n=>close(n,0));
  }
  return { compare: compareExpressionPixels157, mask:maskExpressionPixels157, samePlane:samePlane157 };
}

/** Install only a read-only DOM/canvas verifier. No actor, painter, source
 * image, timer, RNG, clock, ownership or rendering callback is modified. */
export async function installCompanionPaintedSource157(page: Page) {
  await page.evaluate(({ metadata, anchors, comparisonFactory }) => {
    const scope=window as PaintedSource157Window;if(scope.companionPaintedSource157)return;
    // Inject only this trusted, self-contained pure QA factory. Its closure
    // contains no renderer/module hook and receives only observed pixel data.
    const createComparison = new Function("return ("+comparisonFactory+")")() as typeof createCompanionExpressionPixelVerifier157;
    const {compare:compareExpressionPixels157,samePlane}=createComparison();
    const scratch=document.createElement("canvas");scratch.width=scratch.height=192;
    const context=scratch.getContext("2d",{willReadFrequently:true}),cache=new Map<string,Uint8ClampedArray>();
    const close=(a:number,b:number,tolerance=.05)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;
    const translation=(matrix:number[],x:number,y:number)=>matrix.length===16&&matrix.every((n,i)=>close(n,i===12?x:i===13?y:[0,5,10,15].includes(i)?1:0,i===12||i===13?.05:.000001));
    const matrix=(value:string)=>Array.from(new DOMMatrixReadOnly(value).toFloat64Array());
    const clip=(value:string)=>{
      const tokens=/^inset\(([^)]+)\)$/.exec(value)?.[1].trim().split(/\s+/);
      if(!tokens||tokens.length<1||tokens.length>4||!tokens.every(x=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)%$/.test(x)))return;
      const v=tokens.map(Number.parseFloat);return v.length===1?[v[0],v[0],v[0],v[0]]:v.length===2?[v[0],v[1],v[0],v[1]]:v.length===3?[v[0],v[1],v[2],v[1]]:v;
    };
    const visible=(node:Element|null|undefined)=>{
      if(!node||!node.isConnected||document.hidden||node.closest("[hidden],[inert]"))return false;
      const r=node.getBoundingClientRect(),s=getComputedStyle(node);
      return r.width>0&&r.height>0&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight&&s.display!=="none"&&s.visibility==="visible"
        &&Number(s.opacity)>.05&&node.checkVisibility({checkOpacity:true,checkVisibilityCSS:true});
    };
    scope.companionPaintedSource157={inspect(actor){
      const pose=Number((actor as HTMLElement|undefined)?.dataset.pose??-1),frame=Number.isInteger(pose)?metadata.frames[pose]:undefined;
      const atlas=frame&&metadata.atlases[frame.atlas];
      const proof:PaintedSource157Proof={version:1,passed:false,mode:"unmeasured",pose,source:atlas?.src??"",reason:"missing-current-source"};
      try{
        const sprite=actor?.querySelector<HTMLElement>(".vc-sprite"),image=sprite?.querySelector<HTMLImageElement>(".vc-texture"),canvas=actor?.querySelector<HTMLCanvasElement>(".vc-expression-face");
        if(!visible(actor)||!frame||!atlas||!sprite||!image?.complete||!image.naturalWidth||image.parentElement!==sprite||!sprite.isConnected)return proof;
        const url=new URL(image.currentSrc,location.href),s=getComputedStyle(sprite),t=getComputedStyle(image);
        const w=parseFloat(s.width),h=parseFloat(s.height),m=matrix(s.transform),tm=matrix(t.transform),crop=clip(s.clipPath);
        proof.cell={index:frame.index,grid:metadata.grid,rows:metadata.gridRows,natural:[image.naturalWidth,image.naturalHeight]};
        proof.geometry={sameParent:Boolean(canvas&&canvas.parentElement===sprite.parentElement),sprite:[w,h],matrix:m,clip:s.clipPath};
        const sourceGeometry=url.origin===location.origin&&!url.search&&!url.hash&&url.pathname===atlas.src&&image.naturalWidth===atlas.width&&image.naturalHeight===atlas.height
          &&w>0&&close(w,h)&&close(parseFloat(t.width),w*metadata.grid)&&close(parseFloat(t.height),h*metadata.gridRows)
          &&close(parseFloat(t.left),0)&&close(parseFloat(t.top),0)&&t.clipPath==="none"
          &&translation(tm,-(frame.index%metadata.grid)*w,-Math.floor(frame.index/metadata.grid)*h)
          &&translation(m,frame.x/80*w,frame.y/80*h)&&Boolean(crop&&crop.every((n,i)=>close(n,frame.clip[i]/80*100,.002)));
        if(!sourceGeometry){proof.reason="source-cell-geometry";return proof;}
        if(visible(sprite)&&visible(image)&&!visible(canvas)&&!(actor as HTMLElement).dataset.expression){proof.passed=true;proof.mode="atlas";proof.reason="actual-visible-current-atlas";return proof;}
        proof.mode="expression";proof.reason="unproved-expression-plane";
        if(!canvas||!visible(canvas)||visible(sprite)||!(actor as HTMLElement).dataset.expression||canvas.width!==192||canvas.height!==192||canvas.parentElement!==sprite.parentElement)return proof;
        const cs=getComputedStyle(canvas),cw=parseFloat(cs.width),ch=parseFloat(cs.height),cm=matrix(cs.transform),cc=clip(cs.clipPath),cr=canvas.getBoundingClientRect(),sr=sprite.getBoundingClientRect();
        proof.geometry.canvas=[cw,ch];proof.geometry.canvasMatrix=cm;proof.geometry.canvasClip=cs.clipPath;
        proof.geometry.offset=[cr.x-sr.x,cr.y-sr.y,cr.width-sr.width,cr.height-sr.height];
        if(canvas.parentElement?.classList.contains("vc-pose")!==true||!close(cw,w)||!close(ch,h)||!close(parseFloat(cs.left),0)||!close(parseFloat(cs.top),0)
          ||cs.zIndex!==s.zIndex||!translation(cm,frame.x/80*w,frame.y/80*h)||!cc||!cc.every((n,i)=>close(n,frame.clip[i]/80*100,.002))
          ||!samePlane([w,h],[cw,ch],m,cm,proof.geometry.offset)){proof.reason="expression-plane-geometry";return proof;}
        const anchor=anchors.frames.find(a=>a.physicalIndex===pose),reference=anchors.frames.find(a=>a.physicalIndex===anchors.reference);
        if(!anchor||!reference||anchor.index!==frame.index||anchors.sources[anchor.source]?.src!==atlas.src||!context){proof.reason="missing-calibrated-current-cell";return proof;}
        const key=`${atlas.src}:${frame.index}`;
        if(!cache.has(key)){
          context.clearRect(0,0,192,192);const cell=image.naturalWidth/metadata.grid;
          context.drawImage(image,frame.index%metadata.grid*cell,Math.floor(frame.index/metadata.grid)*cell,cell,cell,0,0,192,192);
          cache.set(key,context.getImageData(0,0,192,192).data);
          if(cache.size>24)cache.delete(cache.keys().next().value!);
        }
        const actual=canvas.getContext("2d")?.getImageData(0,0,192,192).data;
        if(!actual){proof.reason="unreadable-painted-canvas";return proof;}
        proof.pixels=compareExpressionPixels157(cache.get(key)!,actual,anchor,reference);
        proof.passed=proof.pixels.valid;proof.reason=proof.passed?"exact-current-cell-with-calibrated-face-change":"painted-pixel-mismatch";
      }catch{proof.reason="unmeasured-canvas-or-css";}
      return proof;
    }};
  },{metadata:companionSpriteMetadata,anchors:expressionAnchors,comparisonFactory:createCompanionExpressionPixelVerifier157.toString()});
}

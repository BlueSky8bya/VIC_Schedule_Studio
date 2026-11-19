import type { Page } from "@playwright/test";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionAppearanceEyes, companionAppearancePoint, companionAppearanceBounds, resolveCompanionAppearanceSource } from "@/lib/ui/viewer-companion/appearance";
import expressionAnchors from "@/lib/ui/viewer-companion/expression-anchors-161.json";

export type PaintedSource157Proof = {
  version: 1; passed: boolean; mode: "atlas" | "expression" | "blink" | "sleep-mouth" | "composite" | "unmeasured"; pose: number; source: string;
  reason: string; cell?: { index: number; grid: number; rows: number; natural: number[] };
  geometry?: { sameParent: boolean; sprite: number[]; canvas?: number[]; matrix: number[]; canvasMatrix?: number[];
    clip: string; canvasClip?: string; offset?: number[] };
  pixels?: { total: number; alphaCompared: number; alphaMismatch: number; protectedRgbCompared: number;
    protectedRgbMismatch: number; changedFacePixels: number; maskPixels: number; valid: boolean };
  /** Composite mode only: alpha masks (alpha >= 128) of the registered atlas cell drawn offscreen and of the
   * composite's registered centre 192px. coverage = overlap / atlas, precision = overlap / painted. */
  composite?: { atlasOpaque: number; paintedOpaque: number; overlap: number; coverage: number; precision: number; hatted: boolean };
};
export type PaintedSource157Window = Window & { companionPaintedSource157?: { inspect(actor?: Element | null): PaintedSource157Proof } };

type ExpressionAnchor157 = typeof expressionAnchors.frames[number];
/** Pure comparator serialized verbatim into the browser observer. Tests call
 * this same exported factory, including the exact calibrated mask operation.
 *163's calibrated eye/brow and mouth patches keep their exact opaque-source
 * admission, including the narrower authored-eye fallback near an ear. */
export function createCompanionExpressionPixelVerifier157() {
  function maskExpressionPixels157(source: Uint8ClampedArray, pose: ExpressionAnchor157, reference: ExpressionAnchor157, blinkOnly = false) {
    const size=192,total=size*size,scale=size/80,mask=new Uint8Array(total);
    if(source.length!==total*4||pose.eyes.length!==2||reference.eyes.length!==2)return null;
      const permit=(box:number[],feature=1,skinSamples?:readonly (readonly number[])[])=>{
        if(box.length!==4||!box.every(Number.isFinite))return false;
        const [left,top,right,bottom]=box.map(n=>Math.round(n*scale));
        if(left<0||top<0||right>=size||bottom>=size||right<=left||bottom<=top)return false;
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(source[(y*size+x)*4+3]<245)return false;
        const samples=skinSamples?.map(([x,y])=>[Math.round(x*scale),Math.round(y*scale)])??[[left,top],[right,top],[left,bottom],[right,bottom]];
        let corners=0;for(const [x,y]of samples){
          if(x<left||y<top||x>right||y>bottom)return false;
          const i=(y*size+x)*4;if(source[i]>=190&&source[i+1]>=175&&source[i+2]>=130)corners++;
        }
        if(corners<3)return false;
        for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)mask[y*size+x]=feature;
        return true;
      };
      for(let i=0;i<2;i++){
        const eye=pose.eyes[i],original=reference.eyes[i],view=pose.orientation==="quarter"?(original.bounds[2]-original.bounds[0])/Math.max(...reference.eyes.map(e=>e.bounds[2]-e.bounds[0])):1;
        if(eye.center.length!==2||eye.bounds.length!==4||original.bounds.length!==4
          ||![...eye.center,...eye.bounds,...original.bounds].every(Number.isFinite)) return null;
        const sharedWidth=Math.max(...reference.eyes.map(eye=>eye.bounds[2]-eye.bounds[0]));
        const sharedHeight=Math.max(...reference.eyes.map(eye=>eye.bounds[3]-eye.bounds[1]));
        const [x,y]=eye.center,width=Math.max(original.bounds[2]-original.bounds[0],sharedWidth)*view,height=sharedHeight;
        const permitted=permit([Math.min(eye.bounds[0],x-width/2-1)-.65,Math.min(eye.bounds[1],y-height/2-1.6)-.65,
          Math.max(eye.bounds[2],x+width/2+1)+.65,Math.max(eye.bounds[3],y+height/2+1.2)+.65],1,"skinSamples" in eye?eye.skinSamples:undefined);
        if(!permitted)permit([eye.bounds[0]-.4,eye.bounds[1]-.4,eye.bounds[2]+.4,eye.bounds[3]+.4]);
      }
      if(pose.mouth&&!blinkOnly){const m=pose.mouth,[left,right]=pose.eyes.map(eye=>eye.center),x=(left[0]+right[0])/2,y=(left[1]+right[1])/2;
        const angle=Math.atan2(right[1]-left[1],right[0]-left[0]);
        const depth=Math.max(4,(m.x-x)*-Math.sin(angle)+(m.y-y)*Math.cos(angle));
        const mouthX=x-Math.sin(angle)*depth,mouthY=y+Math.cos(angle)*depth;
        const fringe=pose.source===9?2:.5;
        permit([Math.min(m.bounds[0]-fringe,mouthX-3.4),Math.min(m.bounds[1]-fringe,mouthY-2),
          Math.max(m.bounds[2]+fringe,mouthX+3.4),Math.max(m.bounds[3]+fringe,mouthY+3.6)],2);}
    return mask;
  }
  function compareExpressionPixels157(source: Uint8ClampedArray, current: Uint8ClampedArray, pose: ExpressionAnchor157, reference: ExpressionAnchor157, blinkOnly = false) {
    const total=192*192;
    const result={total,alphaCompared:0,alphaMismatch:0,protectedRgbCompared:0,protectedRgbMismatch:0,changedFacePixels:0,maskPixels:0,valid:false};
    if(source.length!==total*4||current.length!==source.length)return result;
    const mask=maskExpressionPixels157(source,pose,reference,blinkOnly);if(!mask)return result;
      for(let p=0;p<total;p++){
        const i=p*4,x=p%192/2.4,y=Math.floor(p/192)/2.4,m=blinkOnly?null:pose.mouth;
        let sourceMouth=false;
        if(m&&mask[p]===2){const [a,b]=pose.eyes.map(eye=>eye.center),cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,angle=Math.atan2(b[1]-a[1],b[0]-a[0]),depth=Math.max(4,(m.x-cx)*-Math.sin(angle)+(m.y-cy)*Math.cos(angle)),mx=cx-Math.sin(angle)*depth,my=cy+Math.cos(angle)*depth;
          sourceMouth=x>=mx-3.4&&x<=mx+3.4&&y>=my-2&&y<=my+3.6;}
        let blinkMouth=false;
        if(blinkOnly&&pose.mouth){const [a,b]=pose.eyes.map(eye=>eye.center),cx=(a[0]+b[0])/2,cy=(a[1]+b[1])/2,angle=Math.atan2(b[1]-a[1],b[0]-a[0]),depth=Math.max(4,(pose.mouth.x-cx)*-Math.sin(angle)+(pose.mouth.y-cy)*Math.cos(angle)),mx=cx-Math.sin(angle)*depth,my=cy+Math.cos(angle)*depth;
          blinkMouth=x>=mx-3.4&&x<=mx+3.4&&y>=my-2&&y<=my+3.6;}
        const orange=!sourceMouth&&source[i]>210&&source[i+1]<190&&source[i+2]<135;
        result.alphaCompared++;if(source[i+3]!==current[i+3])result.alphaMismatch++;
        const changed=source[i]!==current[i]||source[i+1]!==current[i+1]||source[i+2]!==current[i+2];
        if(mask[p])result.maskPixels++;
        if(!mask[p]||orange||blinkMouth){result.protectedRgbCompared++;if(changed)result.protectedRgbMismatch++;}
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
        const rows=("gridRows" in atlas?atlas.gridRows:metadata.gridRows) as number;
        proof.cell={index:frame.index,grid:metadata.grid,rows,natural:[image.naturalWidth,image.naturalHeight]};
        proof.geometry={sameParent:Boolean(canvas&&canvas.parentElement===sprite.parentElement),sprite:[w,h],matrix:m,clip:s.clipPath};
        const sourceGeometry=url.origin===location.origin&&!url.search&&!url.hash&&url.pathname===atlas.src&&image.naturalWidth===atlas.width&&image.naturalHeight===atlas.height
          &&w>0&&close(w,h)&&close(parseFloat(t.width),w*metadata.grid)&&close(parseFloat(t.height),h*rows)
          &&close(parseFloat(t.left),0)&&close(parseFloat(t.top),0)&&t.clipPath==="none"
          &&translation(tm,-(frame.index%metadata.grid)*w,-Math.floor(frame.index/metadata.grid)*h)
          &&translation(m,frame.x/80*w,frame.y/80*h)&&Boolean(crop&&crop.every((n,i)=>close(n,frame.clip[i]/80*100,.002)));
        if(!sourceGeometry){proof.reason="source-cell-geometry";return proof;}
        // 68b46f11 (2026-11-18) worn hats and b91b3078 (2026-11-19) the pompom's flight response: a layered pose
        // hides both the sprite and the face canvas and paints the same registered cell on one native-resolution
        // composite canvas (ear-painter.ts). Without this branch every such frame, including most of a jump's
        // flight, read as "unproved-expression-plane" and was never credited as actual movement.
        const composite=actor?.querySelector<HTMLCanvasElement>(".vc-pose[data-layered] > .vc-ear-layers:not([hidden]) > canvas.vc-character-composite");
        if(composite&&!visible(sprite)&&!visible(canvas)){
          proof.mode="composite";proof.reason="unproved-composite-plane";
          const ks=getComputedStyle(composite),kw=parseFloat(ks.width),kh=parseFloat(ks.height),km=matrix(ks.transform);
          proof.geometry.canvas=[kw,kh];proof.geometry.canvasMatrix=km;
          if(!visible(composite)||composite.dataset.pose!==String(pose)||composite.width!==384||composite.height!==384||!close(kw,w*2)||!close(kh,h*2)
            ||!close(parseFloat(ks.left),-w/2)||!close(parseFloat(ks.top),-h/2)||!translation(km,frame.x/80*w,frame.y/80*h)){proof.reason="composite-plane-geometry";return proof;}
          // The registered 80-unit cell is the centre 192px of the 384px canvas (ear-painter.ts translate(96,96)
          // scale(2.4)). Compare its pixel content with the registered atlas cell drawn offscreen: the creature's
          // alpha mask must cover >= 90% of the atlas cell's mask, and without a worn hat (data-body-only) the
          // painted mask must also lie >= 90% inside it. A blank, wrong-cell or shifted plane fails.
          if(!context){proof.reason="missing-calibrated-current-cell";return proof;}
          const key=`${atlas.src}:${frame.index}`;
          if(!cache.has(key)){
            context.clearRect(0,0,192,192);const cell=image.naturalWidth/metadata.grid;
            context.drawImage(image,frame.index%metadata.grid*cell,Math.floor(frame.index/metadata.grid)*cell,cell,cell,0,0,192,192);
            cache.set(key,context.getImageData(0,0,192,192).data);
            if(cache.size>24)cache.delete(cache.keys().next().value!);
          }
          const reference=cache.get(key)!,body=composite.getContext("2d")?.getImageData(96,96,192,192).data;
          if(!body){proof.reason="unreadable-painted-canvas";return proof;}
          let atlasOpaque=0,paintedOpaque=0,overlap=0;
          for(let i=3;i<body.length;i+=4){const a=reference[i]>=128,b=body[i]>=128;if(a)atlasOpaque++;if(b)paintedOpaque++;if(a&&b)overlap++;}
          const hatted=!composite.hasAttribute("data-body-only"),coverage=atlasOpaque?overlap/atlasOpaque:0,precision=paintedOpaque?overlap/paintedOpaque:0;
          proof.composite={atlasOpaque,paintedOpaque,overlap,coverage,precision,hatted};
          proof.passed=atlasOpaque>=1000&&coverage>=.9&&(hatted||precision>=.9);
          proof.reason=proof.passed?"actual-visible-current-composite":atlasOpaque<1000||paintedOpaque<1000?"blank-composite-plane":"composite-pixel-mismatch";return proof;
        }
        if(visible(sprite)&&visible(image)&&!visible(canvas)&&!(actor as HTMLElement).dataset.expression){proof.passed=true;proof.mode="atlas";proof.reason="actual-visible-current-atlas";return proof;}
        const blinkOnly=actor?.hasAttribute("data-blink")??false;
        // cc29e224 (2026-11-20) the sleeping mouth: during deep sleep (rows 11/40, data-dreaming) the face canvas
        // repaints only the mouth on the breath clock, with neither data-expression nor data-blink. It is checked
        // like a full expression plane (only face-mask pixels may change) but reported as its own mode, so it
        // never counts as an expression witness. The sprite stays visible under it (viewer-companion.css hides the
        // sprite only for [data-expression]/[data-blink]); the canvas repaints the whole cell on top of it.
        const sleepMouth=!blinkOnly&&!(actor as HTMLElement).dataset.expression&&(actor?.hasAttribute("data-dreaming")??false);
        proof.mode=blinkOnly?"blink":sleepMouth?"sleep-mouth":"expression";proof.reason="unproved-expression-plane";
        if(!canvas||!visible(canvas)||visible(sprite)&&!sleepMouth||(!blinkOnly&&!sleepMouth&&!(actor as HTMLElement).dataset.expression)||canvas.width!==192||canvas.height!==192||canvas.parentElement!==sprite.parentElement)return proof;
        const cs=getComputedStyle(canvas),cw=parseFloat(cs.width),ch=parseFloat(cs.height),cm=matrix(cs.transform),cc=clip(cs.clipPath),cr=canvas.getBoundingClientRect(),sr=sprite.getBoundingClientRect();
        proof.geometry.canvas=[cw,ch];proof.geometry.canvasMatrix=cm;proof.geometry.canvasClip=cs.clipPath;
        proof.geometry.offset=[cr.x-sr.x,cr.y-sr.y,cr.width-sr.width,cr.height-sr.height];
        if(canvas.parentElement?.classList.contains("vc-pose")!==true||!close(cw,w)||!close(ch,h)||!close(parseFloat(cs.left),0)||!close(parseFloat(cs.top),0)
          ||cs.zIndex!==s.zIndex||!translation(cm,frame.x/80*w,frame.y/80*h)||!cc||!cc.every((n,i)=>close(n,frame.clip[i]/80*100,.002))
          ||!samePlane([w,h],[cw,ch],m,cm,proof.geometry.offset)){proof.reason="expression-plane-geometry";return proof;}
        const anchor=anchors.frames.find(a=>a.physicalIndex===pose),reference=anchors.frames.find(a=>a.physicalIndex===304);
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
        proof.pixels=compareExpressionPixels157(cache.get(key)!,actual,anchor,reference,blinkOnly);
        proof.passed=proof.pixels.valid;proof.reason=proof.passed?(sleepMouth?"exact-current-cell-with-sleep-mouth":"exact-current-cell-with-calibrated-face-change"):"painted-pixel-mismatch";
      }catch{proof.reason="unmeasured-canvas-or-css";}
      return proof;
    }};
  },{metadata:companionSpriteMetadata,anchors:{...expressionAnchors,sources:expressionAnchors.sources.map(resolveCompanionAppearanceSource),frames:expressionAnchors.frames.map(a=>({...a,eyes:companionAppearanceEyes(a.physicalIndex,a.eyes),mouth:a.mouth?{...companionAppearancePoint(a.physicalIndex,a.mouth),bounds:companionAppearanceBounds(a.physicalIndex,a.mouth.bounds)}:null}))},comparisonFactory:createCompanionExpressionPixelVerifier157.toString()});
}

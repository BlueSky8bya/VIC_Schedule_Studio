import type { Frame } from '../scene-engine';
import type { SeasonKey } from '../registry';
import { beginLoad, endLoad } from '../loading';
import { hillCutRows, hillViewport } from './hill-geometry';
import { HILL_DEPTH_CONTOURS, compileTerrainField } from '../world/terrain-perspective';

/** One continuous terrain source sampled into depth bands by drawDepthGround.
 * Its skyline, slopes and foreground therefore cannot open cracks between layers.
 * Sky/clouds remain the shared live sky; no per-frame pixel processing or blur. */
export class HillBackdrop {
  private source?: HTMLCanvasElement;
  private skyline?: Uint16Array;
  private field?: ReturnType<typeof compileTerrainField>;
  private image?: HTMLImageElement;
  private disposed=false;
  private loading=true;
  private layout?: ReturnType<typeof hillViewport> & {w:number;h:number};
  private skyLine=0;
  version=0;
  bakes=0;
  constructor(private season:SeasonKey){
    beginLoad();
    const image=this.image=new Image();image.decoding='async';
    image.src=`/ambient/art/backdrop-hill-${season}-v2.png`;
    void image.decode().then(async()=>{
      await new Promise<void>(resolve=>setTimeout(resolve,0));
      if(this.disposed)return;
      if(image.naturalWidth>4096||image.naturalHeight>1200)throw new Error('Hill source too large');
      const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
      const g=c.getContext('2d',{willReadFrequently:true})!;g.drawImage(image,0,0);
      const pixels=g.getImageData(0,0,c.width,c.height),rows=hillCutRows(pixels.data,c.width,c.height,false);
      // Change only alpha above the exterior contour. Snow/grass interiors stay opaque.
      for(let x=0;x<c.width;x++)for(let y=0;y<=rows[x]+1;y++)pixels.data[(y*c.width+x)*4+3]=y<rows[x]?0:y===rows[x]?85:170;
      g.putImageData(pixels,0,0);this.source=c;this.skyline=rows;
      this.field=compileTerrainField(u=>rows[Math.min(rows.length-1,Math.round(u*(rows.length-1)))]/c.height,HILL_DEPTH_CONTOURS);
    }).catch(()=>{
      // Autumn's plain seasonal fallback is usable if a source cannot be decoded.
    }).finally(()=>{
      image.removeAttribute('src');this.image=undefined;
      if(!this.disposed){this.loading=false;this.version++;window.dispatchEvent(new Event('vic:ambient-art-ready'));}
      endLoad();
    });
  }
  get pending(){return this.loading;}
  get ready(){return !this.loading&&!!this.source;}
  private viewport(w:number,h:number){
    if(!this.layout||this.layout.w!==w||this.layout.h!==h){
      this.layout={...hillViewport(w,h,this.source!.width,this.source!.height),w,h};
      const p=this.layout;
      const start=Math.max(0,Math.floor(-p.x/p.scale)),end=Math.min(this.source!.width-1,Math.ceil((w-p.x)/p.scale));
      let lowest=0;
      for(let x=start;x<=end;x++)lowest=Math.max(lowest,this.skyline![x]);
      // Elevated hills obscure the astronomical horizon. Its extinction must
      // finish behind even the lowest visible saddle, not in open sky above it.
      this.skyLine=p.y+lowest*p.scale+h*.10;
    }
    return this.layout;
  }
  drawPending(g:CanvasRenderingContext2D,f:Frame){
    if(!this.pending)return false;
    g.fillStyle=f.time.band==='night'?'#26333d':'#b3c7ba';g.fillRect(0,0,f.w,f.h);return true;
  }
  drawGround(g:CanvasRenderingContext2D,w:number,h:number){
    if(!this.source)return;
    const src=this.source,p=this.viewport(w,h);
    // Original generated panoramic continuation, no repeated ridge or blend seam.
    g.save();g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.drawImage(src,p.x,p.y,p.width,p.height);
    g.restore();this.bakes++;
  }
  drawFar(){return true;}
  skyHorizon(w:number,h:number){if(!this.source||!this.skyline)return undefined;this.viewport(w,h);return this.skyLine;}
  drawForeground(){return true;}
  activityAlpha(x:number,y:number,w:number,h:number){
    if(!this.source||!this.skyline)return 1;
    const p=this.viewport(w,h);
    const sx=Math.max(0,Math.min(this.source.width-1,Math.round((x-p.x)/p.scale)));
    const top=p.y+this.skyline[sx]*p.scale;
    const t=Math.max(0,Math.min(1,(y-top)/Math.max(12,h*.035)));
    return t*t*(3-2*t);
  }
  distance(x:number,y:number,w:number,h:number){
    if(!this.source||!this.field)return undefined;
    const p=this.viewport(w,h),sx=Math.max(0,Math.min(this.source.width-1,(x-p.x)/p.scale));
    return this.field.sample(sx/this.source.width,(y-p.y)/p.scale/this.source.height);
  }
  debug(){return {biome:'hill',season:this.season,ready:this.ready,version:this.version,bakes:this.bakes,continuousDepth:true,fieldBytes:this.field?.bytes??0,sourceBytes:this.source?this.source.width*this.source.height*4:0};}
  dispose(){this.disposed=true;this.image?.removeAttribute('src');this.image=undefined;if(this.source)this.source.width=this.source.height=1;this.source=undefined;this.skyline=undefined;this.field=undefined;this.layout=undefined;}
}

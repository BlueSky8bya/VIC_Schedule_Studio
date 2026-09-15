import { DEPTH_PAD, type DepthTier } from './depth';
import { reliefLayerCount, reliefMask, reliefMotion } from './terrain-perspective';

type Layer={c:HTMLCanvasElement;top:number;height:number};
const pool=new Set<ReliefLayers>();
/** Contour-shaped crossfades, never rectangular moving strips. Only two
 * neighbouring layers blend at a point. No canvas readback/blur during motion. */
export class ReliefLayers {
  private layers:Layer[]=[];
  private source?:HTMLCanvasElement;
  private key='';
  bakes=0;
  private release(){for(const {c} of this.layers)c.width=c.height=1;this.layers=[];this.source=undefined;this.key='';pool.delete(this);}
  draw(g:CanvasRenderingContext2D,source:HTMLCanvasElement,w:number,h:number,off:{x:number;y:number},tier:DepthTier,distance:(x:number,y:number)=>number){
    const count=reliefLayerCount(tier),pad=DEPTH_PAD,ww=w+pad*2,key=`${w}:${h}:${tier}`;
    if(count===1){if(this.layers.length)this.release();g.drawImage(source,0,0,w,h);return;}
    if(source!==this.source||key!==this.key){
      this.release();
      // Conservative source-space support bounds save empty sky/upper slopes.
      const tops:number[]=[];
      for(let i=0;i<count;i++){
        let top=-pad;
        if(i>0){
          top=h;
          for(let y=0;y<=h;y+=4)for(let x=-pad;x<=w+pad;x+=8){
            if(distance(x,y)>(i-1)/(count-1)){top=Math.min(top,y-8);break;}
            if(top<h)break;
          }
        }
        tops.push(Math.max(-pad,top));
      }
      const area=tops.reduce((sum,top)=>sum+ww*(h+pad-top),0);
      const budget=(tier==='lite'?3:12)*1024*1024;
      const scale=Math.min(tier==='lite'?.5:1,Math.sqrt(budget/(4*area))*.98);
      const mask=document.createElement('canvas');mask.width=192;mask.height=128;
      const mg=mask.getContext('2d')!,pixels=mg.createImageData(mask.width,mask.height);
      for(let i=0;i<count;i++){
        const top=tops[i],height=h+pad-top,c=document.createElement('canvas');
        // Preserve the former far sampling. Spend extra pixels only toward
        // the viewer; contour masks crossfade the quality along actual relief.
        const near=i/(count-1),detailScale=Math.min(tier==='lite'?.75:1,scale*(1+.35*near*near));
        c.width=Math.ceil(ww*detailScale);c.height=Math.ceil(height*detailScale);
        const cg=c.getContext('2d')!;
        cg.scale(c.width/ww,c.height/height);cg.translate(pad,-top);
        cg.drawImage(source,0,0,w,h);
        // Mirror only outer edges; all masks use the same sampled coordinates.
        const edge=Math.min(source.width,pad*source.width/w);
        cg.save();cg.scale(-1,1);cg.drawImage(source,0,0,edge,source.height,0,0,pad,h);cg.restore();
        cg.save();cg.translate(w,0);cg.scale(-1,1);cg.drawImage(source,source.width-edge,0,edge,source.height,-pad,0,pad,h);cg.restore();
        cg.drawImage(source,0,source.height-1,source.width,1,-pad,h-1,ww,pad+1);
        if(i>0){
          // Only the low-frequency opacity field is small. Terrain pixels retain
          // their own resolution; avoid megapixel readbacks and JS alpha loops.
          for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){
            pixels.data[(y*mask.width+x)*4+3]=255*reliefMask(distance((x+.5)/mask.width*ww-pad,top+(y+.5)/mask.height*height),i,count);
          }
          mg.putImageData(pixels,0,0);
          cg.save();cg.setTransform(1,0,0,1,0,0);cg.globalCompositeOperation='destination-in';cg.imageSmoothingEnabled=true;
          cg.drawImage(mask,0,0,c.width,c.height);cg.restore();
        }
        this.layers.push({c,top,height});
      }
      mask.width=mask.height=1;
      this.source=source;this.key=key;this.bakes++;
    }
    pool.delete(this);pool.add(this);
    // Only current and travelling destination retain textures, regardless of
    // how many future biomes exist. Evicted scenes recreate on next visit.
    while(pool.size>2)pool.values().next().value!.release();
    g.save();g.imageSmoothingEnabled=true;
    for(let i=0;i<this.layers.length;i++){
      const {c,top,height}=this.layers[i],k=reliefMotion(i/(count-1),count);
      g.drawImage(c,-pad+off.x*k,top+off.y*k,ww,height);
    }
    g.restore();
  }
  debug(){return {bakes:this.bakes,layers:this.layers.length,bytes:this.layers.reduce((sum,{c})=>sum+c.width*c.height*4,0)};}
  dispose(){this.release();}
}

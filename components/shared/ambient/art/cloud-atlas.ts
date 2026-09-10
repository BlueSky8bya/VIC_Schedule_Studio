import { beginLoad, endLoad } from '../loading';
import type { CloudGenus } from '../world/cloud-field';
import layout from './cloud-atlas-layout.json';

const GENERA:CloudGenus[]=['cirrus','cirrocumulus','cirrostratus','altocumulus','altostratus','stratus','stratocumulus','nimbostratus','cumulus','cumulonimbus'];
/** Measured original bounds, including intentional detached wisps. */
export function cloudAspect(genus:CloudGenus,variant:number){
  const [, , width,height]=layout.sprites[genus][variant].bounds;
  return width/height;
}

/** Immutable generated atlas; 30 selected forms, three per genus. */
export class CloudAtlas {
  version=0;
  private sprites=new Map<string,HTMLCanvasElement>();
  constructor(){
    if(typeof Image==='undefined')return;
    beginLoad();const image=new Image();
    image.onload=()=>{
      try{
        const {width,height}=layout;
        if(image.naturalWidth!==width||image.naturalHeight!==height)return;
        const source=document.createElement('canvas');source.width=width;source.height=height;
        const g=source.getContext('2d')!;g.drawImage(image,0,0);
        const raw=g.getImageData(0,0,width,height),data=raw.data;
        const solid=(x:number,y:number)=>{
          if(x<0||x>=width||y<0||y>=height)return false;
          const i=(y*width+x)*4;return data[i+1]>=Math.min(data[i],data[i+2])-8;
        };
        for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(!solid(x,y)||!solid(x-1,y)||!solid(x+1,y)||!solid(x,y-1)||!solid(x,y+1))data[(y*width+x)*4+3]=0;
        g.putImageData(raw,0,0);
        for(let n=0;n<10;n++)for(let variant=0;variant<3;variant++){
          // Actual output has seven uneven rows; never infer nominal grid cells.
          const [x0,y0,sw,sh]=layout.sprites[GENERA[n]][variant].bounds;
          const c=document.createElement('canvas');c.width=sw;c.height=sh;
          c.getContext('2d')!.drawImage(source,x0,y0,c.width,c.height,0,0,c.width,c.height);
          this.sprites.set(`${GENERA[n]}:${variant}`,c);
        }
        source.width=source.height=1;this.version++;window.dispatchEvent(new Event('vic:ambient-art-ready'));
      }finally{endLoad();}
    };
    image.onerror=()=>endLoad();image.src=layout.src;
  }
  get(genus:CloudGenus,variant:number){return this.sprites.get(`${genus}:${variant}`);}
}

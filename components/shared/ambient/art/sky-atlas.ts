import { beginLoad, endLoad } from "../loading";
import { artSlot } from "./manifest";
import type { ArtSprite } from "./load";

const IDS = ["sun-disc", "moon-phase", "cloud-low", "cloud-mid", "cloud-high", "cloud-wisp", "cloud-storm", "shooting-star", "comet"];
/** One immutable RGB atlas. Exclude the declared chroma matte once on load;
 * retain old individual files as source history, not mixed style fallbacks. */
export class SkyAtlas {
  version = 0;
  private sprites = new Map<string, ArtSprite>();
  private mirrored = new Map<string, ArtSprite>();
  constructor() {
    if (typeof Image === "undefined") return;
    beginLoad();
    const im = new Image();
    im.onload = () => {
      try {
        if (im.naturalWidth !== 1254 || im.naturalHeight !== 1254) return;
        const source = document.createElement("canvas"); source.width = source.height = 1254;
        const g = source.getContext("2d")!; g.drawImage(im, 0, 0);
        const raw = g.getImageData(0, 0, 1254, 1254), d = raw.data;
        const solid = (x: number, y: number) => {
          if (x < 0 || y < 0 || x >= 1254 || y >= 1254) return false;
          const i = (y * 1254 + x) * 4;
          return d[i + 1] >= Math.min(d[i], d[i + 2]) - 8;
        };
        for (let y = 0; y < 1254; y++) for (let x = 0; x < 1254; x++) {
          // One-pixel inset excludes mixed matte colors from downsampling.
          if (!solid(x,y) || !solid(x-1,y) || !solid(x+1,y) || !solid(x,y-1) || !solid(x,y+1)) d[(y*1254+x)*4+3]=0;
        }
        g.putImageData(raw, 0, 0);
        IDS.forEach((id, n) => {
          let left = n % 3 * 418, right = left + 418;
          const top = Math.floor(n / 3) * 418, bottom = top + 418;
          // The generated storm extends 11px beyond its nominal cell; the
          // event to its right starts after x500, so these ROIs stay disjoint.
          if (id === "cloud-storm") right = 450;
          if (id === "shooting-star") left = 450;
          let x0=right,y0=bottom,x1=left,y1=top;
          for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(d[(y*1254+x)*4+3]){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);}
          if(x1<=x0||y1<=y0)return;
          const slot=artSlot(id)!;
          const fit=Math.min(slot.px[0]/(x1-x0),slot.px[1]/(y1-y0));
          const w=(x1-x0)*fit,h=(y1-y0)*fit,c=document.createElement("canvas");
          c.width=Math.ceil(w*2);c.height=Math.ceil(h*2);
          const cg=c.getContext("2d")!;cg.imageSmoothingEnabled=false;
          cg.drawImage(source,x0,y0,x1-x0,y1-y0,0,0,c.width,c.height);
          this.sprites.set(id,{c,w,h,ax:.5,ay:.5,id});
        });
        source.width=source.height=1;
        this.version++; window.dispatchEvent(new Event("vic:ambient-art-ready"));
      } finally { endLoad(); }
    };
    im.onerror=()=>endLoad();im.src="/ambient/art/sky-atlas-v2.png";
  }
  has(id:string){return this.sprites.has(id);}
  get(id:string){return this.sprites.get(id)??null;}
  pick(id:string,r:number){
    const base=this.get(id);
    if(!base||!id.startsWith("cloud-")||r<.5)return base;
    let result=this.mirrored.get(id);
    if(!result){
      const c=document.createElement("canvas");c.width=base.c.width;c.height=base.c.height;
      const g=c.getContext("2d")!;g.translate(c.width,0);g.scale(-1,1);g.drawImage(base.c,0,0);
      result={...base,c};this.mirrored.set(id,result);
    }
    return result;
  }
}

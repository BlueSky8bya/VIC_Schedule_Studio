import type {SeasonKey} from '../registry';
import type {HillBackdrop} from './hill-backdrop';
import {beginLoad,endLoad} from '../loading';
import {FOREST_TREES,keyForestMatte} from '../world/forest-geometry';
import {anchorToSurface} from '../world/depth-render';
import type {DepthTier} from '../world/depth';
import {forestDetailPitch,forestDetailBudget} from '../world/forest-detail';

type Sprite={c:HTMLCanvasElement;alpha:Uint8Array;rootX:number;rootY:number};
export type RootedTree={x:number;y:number;left:number;top:number;width:number;height:number;variant:number};
/** Standing objects are independent of terrain masks. All pixels share their
 * root's transform. Cached alpha supports gaps and hidden-object interaction. */
export class ForestTrees {
  private sprites:Sprite[]=[];
  private loading=true;
  private disposed=false;
  private image?:HTMLImageElement;
  private layout:RootedTree[]=[];
  private key='';
  private contacts=new Map<RootedTree,{c:HTMLCanvasElement;x:number;y:number}>();
  private details=new Map<RootedTree,{c:HTMLCanvasElement;alpha:Uint8Array}>();
  private detailBakes=0;
  constructor(season:SeasonKey){
    beginLoad();const image=this.image=new Image();image.decoding='async';image.src=`/ambient/art/forest-trees-${season}-v1.png`;
    void image.decode().then(()=>{
      if(this.disposed)return;
      if(image.width>1600||image.height>1600)throw new Error('Forest atlas exceeds budget');
      // Actual generated cells have a slightly wider left crown, with clear gutters.
      const cells=[[0,0,.54,.5],[.55,0,.45,.5],[0,.51,.54,.49],[.55,.51,.45,.49]];
      for(const [x,y,w,h]of cells){
        const c=document.createElement('canvas');c.width=Math.ceil(w*image.width);c.height=Math.ceil(h*image.height);
        const g=c.getContext('2d',{willReadFrequently:true})!;g.drawImage(image,x*image.width,y*image.height,w*image.width,h*image.height,0,0,c.width,c.height);
        const pixels=g.getImageData(0,0,c.width,c.height);keyForestMatte(pixels.data);g.putImageData(pixels,0,0);
        const alpha=new Uint8Array(c.width*c.height);let bottom=0;
        for(let i=0;i<alpha.length;i++){alpha[i]=pixels.data[i*4+3];if(alpha[i]>128)bottom=Math.max(bottom,Math.floor(i/c.width));}
        // Find trunk center just above the root flare/snow skirt.
        const row=Math.max(0,bottom-Math.round(c.height*.06));let sum=0,n=0;
        for(let xx=0;xx<c.width;xx++)if(alpha[row*c.width+xx]>128){sum+=xx;n++;}
        this.sprites.push({c,alpha,rootX:n?sum/n:c.width/2,rootY:bottom});
      }
    }).catch(()=>{this.release();}).finally(()=>{
      image.removeAttribute('src');this.image=undefined;this.loading=false;endLoad();
      if(!this.disposed)window.dispatchEvent(new Event('vic:ambient-art-ready'));
    });
  }
  get pending(){return this.loading;}
  entries(backdrop:HillBackdrop,w:number,h:number,tier:DepthTier='full'){
    if(!backdrop.ready||this.sprites.length!==4)return [];
    const key=`${w}:${h}:${backdrop.version}:${tier}`;if(key===this.key)return this.layout;
    this.clearContacts();this.key=key;const a=backdrop.screenPoint(0,0,w,h)!,b=backdrop.screenPoint(1,1,w,h)!;
    this.layout=FOREST_TREES.map(t=>{
      const root=backdrop.screenPoint(t.u,t.v,w,h)!,s=this.sprites[t.variant];
      if('edge'in t)root.x=t.edge<0?Math.max(w*.08,root.x):Math.min(w*.92,root.x);
      const height=t.height*(b.y-a.y),scale=height/Math.max(1,s.rootY),width=s.c.width*scale;
      return {x:root.x,y:root.y,left:root.x-s.rootX*scale,top:root.y-s.rootY*scale,width,height:s.c.height*scale,variant:t.variant};
    }).sort((a,b)=>a.y-b.y);
    const sizes=this.layout.map(t=>{
      const s=this.sprites[t.variant],pitch=forestDetailPitch(backdrop.distance(t.x,t.y,w,h)??1,tier);
      const scale=Math.min(1,t.width/(pitch*s.c.width));
      return {w:s.c.width*scale,h:s.c.height*scale};
    });
    const total=sizes.reduce((n,s)=>n+Math.ceil(s.w)*Math.ceil(s.h)*5,0);
    const cap=Math.min(1,Math.sqrt(forestDetailBudget(tier)/Math.max(1,total))*.99);
    for(let i=0;i<this.layout.length;i++){
      const t=this.layout[i],size=sizes[i],c=document.createElement('canvas');
      c.width=Math.max(1,Math.floor(size.w*cap));c.height=Math.max(1,Math.floor(size.h*cap));
      const cg=c.getContext('2d',{willReadFrequently:true})!;cg.imageSmoothingEnabled=true;cg.imageSmoothingQuality='high';
      cg.drawImage(this.sprites[t.variant].c,0,0,c.width,c.height);
      const rgba=cg.getImageData(0,0,c.width,c.height).data,alpha=new Uint8Array(c.width*c.height);
      for(let j=0;j<alpha.length;j++)alpha[j]=rgba[j*4+3];
      this.details.set(t,{c,alpha});
    }
    this.detailBakes++;
    for(const t of this.layout){
      const c=document.createElement('canvas');c.width=Math.min(256,Math.ceil(t.width*.32));c.height=Math.min(64,Math.max(8,Math.ceil(t.height*.045)));
      const x=t.x-c.width/2,y=t.y-c.height*.65,cg=c.getContext('2d')!;
      backdrop.drawGroundPatch(cg,x,y,c.width,c.height,w,h);
      const mask=document.createElement('canvas');mask.width=c.width;mask.height=c.height;const mg=mask.getContext('2d')!;
      // Uneven, feathered grass/snow lip from the actual ground artwork.
      // Cached with layout; it follows the same root transform as the trunk.
      for(let px=0;px<c.width;px++){
        const top=c.height*(.16+.1*Math.sin(px*.41+t.x)+.07*Math.sin(px*.93));
        const fade=mg.createLinearGradient(0,top,0,c.height*.88);
        fade.addColorStop(0,'transparent');fade.addColorStop(1,'#000');mg.fillStyle=fade;mg.fillRect(px,0,1,c.height);
      }
      cg.globalCompositeOperation='destination-in';cg.drawImage(mask,0,0);mask.width=mask.height=1;
      // Replace only root pixels, never cover surrounding leaves with a tile.
      // Thus the existing sprite-alpha picking mask stays exact.
      cg.drawImage(this.details.get(t)!.c,t.left-x,t.top-y,t.width,t.height);
      this.contacts.set(t,{c,x,y});
    }
    return this.layout;
  }
  draw(g:CanvasRenderingContext2D,t:RootedTree){
    const s=this.sprites[t.variant];if(!s)return;
    g.save();anchorToSurface(g,t.y,t.x);
    // Contact shadow and tree share the exact root transform, no baked displaced shadow.
    g.save();g.translate(t.x,t.y+1);g.scale(t.width*.14,Math.max(3,t.height*.021));
    const shadow=g.createRadialGradient(0,0,0,0,0,1);shadow.addColorStop(0,'rgba(35,37,23,.25)');shadow.addColorStop(1,'rgba(35,37,23,0)');
    g.fillStyle=shadow;g.fillRect(-1,-1,2,2);g.restore();
    g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
    g.drawImage(this.details.get(t)?.c??s.c,t.left,t.top,t.width,t.height);
    const contact=this.contacts.get(t);if(contact)g.drawImage(contact.c,contact.x,contact.y);
    g.restore();
  }
  occludes(t:RootedTree,x:number,y:number,footY:number){
    if(t.y<=footY)return false;
    const s=this.details.get(t)??this.sprites[t.variant],u=(x-t.left)/t.width,v=(y-t.top)/t.height;
    return u>=0&&u<1&&v>=0&&v<1&&s.alpha[Math.floor(v*s.c.height)*s.c.width+Math.floor(u*s.c.width)]>128;
  }
  debug(){const detailBytes=[...this.details.values()].reduce((n,s)=>n+s.c.width*s.c.height*5,0);return {ready:!this.loading&&this.sprites.length===4,trees:this.layout,detailBytes,detailBakes:this.detailBakes,bytes:detailBytes+this.sprites.reduce((n,s)=>n+s.c.width*s.c.height*5,0)+[...this.contacts.values()].reduce((n,p)=>n+p.c.width*p.c.height*4,0)};}
  private clearContacts(){for(const p of this.contacts.values())p.c.width=p.c.height=1;this.contacts.clear();for(const p of this.details.values())p.c.width=p.c.height=1;this.details.clear();}
  private release(){this.clearContacts();for(const s of this.sprites)s.c.width=s.c.height=1;this.sprites=[];this.layout=[];this.key='';}
  dispose(){this.disposed=true;this.image?.removeAttribute('src');this.release();}
}

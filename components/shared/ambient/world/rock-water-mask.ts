import {beginLoad,endLoad} from '../loading';
import {hillViewport} from '../art/hill-geometry';

/** Flood only water/foam connected to known sea/pool seeds. Use the neutral
 * summer geography for every season, so blue winter shadows cannot become sea. */
export function rockWaterField(data:Uint8ClampedArray,w:number,h:number){
 const allowed=new Uint8Array(w*h),labels=new Uint8Array(w*h),queue=new Int32Array(w*h);
 for(let y=Math.ceil(h*.38);y<h;y++)for(let x=0;x<w;x++){
  const i=y*w+x,k=i*4,r=data[k],g=data[k+1],b=data[k+2];
  allowed[i]=data[k+3]>200&&((b-r>18&&g-r>8)||(Math.min(r,g,b)>205&&b>=r-5&&g>=r-5))?1:0;
 }
 const flood=(sx:number,sy:number,label:number)=>{
  const start=Math.floor(sy*h)*w+Math.floor(sx*w);
  if(!allowed[start]||labels[start])return;
  let head=0,tail=0;queue[tail++]=start;labels[start]=label;
  while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);
   const add=(n:number)=>{if(allowed[n]&&!labels[n]){labels[n]=label;queue[tail++]=n;}};
   if(x>0)add(i-1);if(x<w-1)add(i+1);if(y>0)add(i-w);if(y<h-1)add(i+w);
  }
 };
 // Many seeds allow painted foam to divide a strip without losing that water.
 for(let x=.02;x<1;x+=.04)for(const y of [.42,.46,.49])flood(x,y,255);
 for(const [x,y] of [[.10,.78],[.15,.765],[.88,.845],[.93,.87],[.77,.75]])flood(x,y,64);
 const distance=new Float32Array(w*h);
 for(let i=0;i<distance.length;i++)distance[i]=labels[i]?10000:0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(x)distance[i]=Math.min(distance[i],distance[i-1]+1);if(y)distance[i]=Math.min(distance[i],distance[i-w]+1);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(x<w-1)distance[i]=Math.min(distance[i],distance[i+1]+1);if(y<h-1)distance[i]=Math.min(distance[i],distance[i+w]+1);}
 const out=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<labels.length;i++){
  // Erode a narrow rim; displacement tends to zero before touching a rock.
  const t=Math.max(0,Math.min(1,(distance[i]-1.5)/7));
  out[i*4]=out[i*4+1]=out[i*4+2]=labels[i]*t*t*(3-2*t);out[i*4+3]=255;
 }
 return out;
}

export class RockWaterMask {
 private source?:HTMLCanvasElement;
 private image?:HTMLImageElement;
 private disposed=false;
 pending=true;
 constructor(){
  beginLoad();const image=this.image=new Image();image.decoding='async';image.src='/ambient/art/backdrop-rocky-summer-v1.png';
  void image.decode().then(()=>{
   if(this.disposed)return;
   const c=document.createElement('canvas');c.width=836;c.height=Math.round(image.naturalHeight/image.naturalWidth*836);
   const g=c.getContext('2d',{willReadFrequently:true})!;g.drawImage(image,0,0,c.width,c.height);
   const pixels=g.getImageData(0,0,c.width,c.height);pixels.data.set(rockWaterField(pixels.data,c.width,c.height));g.putImageData(pixels,0,0);this.source=c;
  }).catch(()=>{/* Mask failure means still rocks/water, never unconstrained waves. */}).finally(()=>{
   image.removeAttribute('src');this.image=undefined;this.pending=false;endLoad();
   if(!this.disposed)window.dispatchEvent(new Event('vic:ambient-art-ready'));
  });
 }
 bake(w:number,h:number){
  const c=document.createElement('canvas');const scale=Math.min(1,1024/w);c.width=Math.ceil(w*scale);c.height=Math.ceil(h*scale);
  const g=c.getContext('2d')!;g.fillStyle='#000';g.fillRect(0,0,c.width,c.height);
  if(this.source){const p=hillViewport(w,h,this.source.width,this.source.height);g.scale(scale,scale);g.drawImage(this.source,p.x,p.y,p.width,p.height);}
  return c;
 }
 dispose(){this.disposed=true;this.image?.removeAttribute('src');if(this.source)this.source.width=this.source.height=1;this.source=undefined;}
}

import type {Scene} from '../scene-engine';
import {beginLoad,endLoad} from '../loading';

/** Composition preview only. Seasonal layers and water motion follow approval. */
export function createMarineConcept(biome:'shallow'|'sea'|'deep'):Scene {
 const image=new Image();let pending=true,loaded=false,disposed=false;
 const source={shallow:'shallow',sea:'open-sea',deep:'deep-sea'}[biome];
 beginLoad();image.src=`/ambient/art/concept-${source}-v1.png`;
 void image.decode().then(()=>{loaded=true;}).catch(()=>{}).finally(()=>{
  pending=false;endLoad();
  if(!disposed)window.dispatchEvent(new Event('vic:ambient-art-ready'));
 });
 return {
  resize(){},step(){},ready:()=>!pending,
  sealed:()=>true,ownsWeather:()=>true,drawForeground:()=>true,
  draw(g,f){
   g.fillStyle=biome==='deep'?'#071526':biome==='sea'?'#18517e':'#65b7cf';g.fillRect(0,0,f.w,f.h);
   if(loaded){
    const scale=Math.max(f.w/image.naturalWidth,f.h/image.naturalHeight);
    const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
    g.drawImage(image,(f.w-w)/2,(f.h-h)/2,w,h);
   }
  },
  debug:()=>({biome,concept:true,pending,imageReady:loaded}),
  dispose(){disposed=true;image.removeAttribute('src');}
 };
}

export const createShallow=()=>createMarineConcept('shallow');

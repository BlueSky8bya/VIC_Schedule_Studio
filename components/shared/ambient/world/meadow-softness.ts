import { drawFacing, type Sprite } from '../assets';
import { meadowDistance } from './meadow-activity';

const cache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function soft(source:HTMLCanvasElement){
  let c=cache.get(source);
  if(!c){c=document.createElement('canvas');c.width=source.width;c.height=source.height;const g=c.getContext('2d')!;g.filter='blur(3px)';g.drawImage(source,0,0);cache.set(source,c);}
  return c;
}
/** Blur is baked once per sprite; only blend weights change with distance. */
function blend(g:CanvasRenderingContext2D,source:HTMLCanvasElement,y:number,h:number,paint:(c:HTMLCanvasElement)=>void){
  const amount=Math.max(0,1-meadowDistance(y,h)/.65)*.85,alpha=g.globalAlpha;
  g.save();g.globalAlpha=alpha*(1-amount);paint(source);
  if(amount){g.globalAlpha=alpha*amount;paint(soft(source));}g.restore();
}
export function drawMeadowImage(g:CanvasRenderingContext2D,source:HTMLCanvasElement,x:number,y:number,w:number,h:number,groundY:number,screenH:number){
  blend(g,source,groundY,screenH,c=>g.drawImage(c,x,y,w,h));
}
export function drawMeadowFacing(g:CanvasRenderingContext2D,s:Sprite,x:number,y:number,dir:number,k:number,tilt:number,groundY:number,screenH:number){
  blend(g,s.c,groundY,screenH,c=>drawFacing(g,{...s,c},x,y,dir,k,tilt));
}

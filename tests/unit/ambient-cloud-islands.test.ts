import {describe,it,expect} from 'vitest';
import {detachedCloudIslands,wispLife} from '../../components/shared/ambient/world/cloud-islands';
describe('detached small cloud islands',()=>{
 it('separates small blobs from the large body instead of treating the bitmap as one cloud',()=>{
  const w=80,h=40,data=new Uint8ClampedArray(w*h*4);
  const rect=(x:number,y:number,ww:number,hh:number)=>{for(let yy=y;yy<y+hh;yy++)for(let xx=x;xx<x+ww;xx++)data[(yy*w+xx)*4+3]=255;};
  rect(20,10,40,25);rect(3,2,4,3);rect(68,3,5,4);
  const islands=detachedCloudIslands(data,w,h);
  expect(islands.map(i=>i.pixels.length)).toEqual([20,12]);
  expect(islands.every(i=>i.w<6)).toBe(true);
 });
 it('moves faint edges with their detached cloud so no ghost remains',()=>{
  const w=40,h=20,data=new Uint8ClampedArray(w*h*4);
  for(let y=5;y<18;y++)for(let x=15;x<38;x++)data[(y*w+x)*4+3]=255;
  for(let y=1;y<4;y++)for(let x=1;x<4;x++)data[(y*w+x)*4+3]=255;
  data[(2*w+4)*4+3]=10;
  expect(detachedCloudIslands(data,w,h)[0].pixels).toContain(2*w+4);
 });
 it('tiny clouds fully disappear sooner while the fade stays continuous',()=>{
  expect(wispLife(8,0,0,.7).period).toBeLessThan(wispLife(60,0,0,.7).period*.5);
  const p=wispLife(8,0,0,.7).period;
  expect(wispLife(8,p*.95,0,.7).alpha).toBe(0);
  expect(wispLife(8,p*.3,0,.7).alpha).toBe(1);
  for(let t=0;t<20;t+=.02)expect(Math.abs(wispLife(8,t,0,.7).alpha-wispLife(8,t+.016,0,.7).alpha)).toBeLessThan(.03);
 });
});

it('never reforms a dissipated puff within the same transit',()=>{
 for(const width of [5,20,60,120])for(const phase of [0,.3,.9]){
  let previous=1;
  for(let t=0;t<300;t+=.25){const a=wispLife(width,t,phase,.7).alpha;expect(a).toBeLessThanOrEqual(previous);previous=a;}
  for(const t of [300,600,3600])expect(wispLife(width,t,phase,.7).alpha).toBe(0);
 }
});

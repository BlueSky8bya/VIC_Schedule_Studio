import {describe,it,expect} from 'vitest';
import {seasonRidge} from '@/components/shared/ambient/world/ridge-season';
describe('ridge seasonal palette',()=>{
  it('changes blue ridge into autumn foliage while preserving snow, sky and foreground water',()=>{
    const w=3,h=100,rows=new Uint16Array([20,20,20]),data=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)data.set(x===1?[220,230,240,255]:[55,130,165,y<20?0:255],(y*w+x)*4);
    const old=data.slice();seasonRidge(data,w,h,rows,'autumn');
    const ridge=(22*w)*4;expect(data[ridge]).toBeGreaterThan(data[ridge+2]);
    expect(data.slice((22*w+1)*4,(22*w+1)*4+4)).toEqual(old.slice((22*w+1)*4,(22*w+1)*4+4));
    expect(data.slice(60*w*4)).toEqual(old.slice(60*w*4));
    expect(data.slice(0,20*w*4)).toEqual(old.slice(0,20*w*4));
  });
  it('winter ridge loses cyan foliage without changing alpha or silhouette',()=>{
    const data=new Uint8ClampedArray(100*4);for(let y=0;y<100;y++)data.set([55,130,165,y<20?0:255],y*4);
    const alpha=Array.from(data).filter((_,i)=>i%4===3);seasonRidge(data,1,100,new Uint16Array([20]),'winter');
    expect(data[22*4+2]-data[22*4]).toBeLessThan(15);
    expect(Array.from(data).filter((_,i)=>i%4===3)).toEqual(alpha);
  });
  it('does not recolor the distant pond water at its authored shore',()=>{
    const data=new Uint8ClampedArray(100*4);for(let y=0;y<100;y++)data.set([55,130,165,255],y*4);
    const before=data.slice();seasonRidge(data,1,100,new Uint16Array([30]),'autumn','pond');
    expect(data.slice(43*4)).toEqual(before.slice(43*4));
  });
  it('includes pale teal ridge highlights so foliage does not leave cyan freckles',()=>{
    const data=new Uint8ClampedArray(100*4);data.set([150,174,168,255],22*4);
    seasonRidge(data,1,100,new Uint16Array([20]),'autumn');
    expect(data[22*4]).toBeGreaterThan(data[22*4+1]);
  });
});

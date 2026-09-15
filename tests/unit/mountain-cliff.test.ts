import {describe,it,expect} from 'vitest';
import {containCliff,mountainCliff} from '../../components/shared/ambient/world/mountain-geometry';
import {hillViewport} from '../../components/shared/ambient/art/hill-geometry';
describe('mountain cliff material boundary',()=>{
 it('contains a whole sprite after wind, dragging and collision on varied viewports',()=>{
  for(const [w,h] of [[1400,860],[2560,1080],[900,1200]]){
   const v=hillViewport(w,h,1672,941),edge=(x:number)=>v.y+mountainCliff((x-v.x)/v.width)*v.height;
   for(let x=0;x<=w;x+=17){
    const p={x,y:0,vx:70,vy:-1200};const top=containCliff(p,edge,25,1/60);
    expect(p.y).toBeGreaterThanOrEqual(top);expect(p.vy).toBe(0);
    expect(p.y-25+1e-9).toBeGreaterThanOrEqual(Math.max(edge(x-25),edge(x),edge(x+25)));
   }
  }
 });
 it('slows outward motion near the edge and preserves movement safely inside',()=>{
  const near={x:50,y:115,vx:30,vy:-100};containCliff(near,()=>100,5,.1);expect(near.vy).toBeGreaterThan(-100);
  const inside={x:50,y:220,vx:30,vy:-100};containCliff(inside,()=>100,5,.1);expect(inside).toEqual({x:50,y:220,vx:30,vy:-100});
 });
});

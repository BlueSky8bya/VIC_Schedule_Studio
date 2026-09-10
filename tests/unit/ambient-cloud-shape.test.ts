import {describe,it,expect} from 'vitest';
import {cloudLobeShape} from '../../components/shared/ambient/world/cloud-shape';
describe('slow local cloud shape evolution',()=>{
 it('changes upper and lower outlines independently without rapid frame jumps',()=>{
  const a=cloudLobeShape(0,1,1,0,.7),b=cloudLobeShape(15,1,1,0,.7),lower=cloudLobeShape(0,1,1,1,.7);
  expect(Math.abs(a.sy-b.sy)).toBeGreaterThan(.06);expect(a).not.toEqual(lower);
  for(let t=0;t<180;t+=.5){const p=cloudLobeShape(t,1,2,1,.7),q=cloudLobeShape(t+.016,1,2,1,.7);expect(Math.abs(p.sy-q.sy)).toBeLessThan(.001);expect(p.sx).toBeGreaterThan(.8);expect(p.sy).toBeGreaterThan(.7);}
 });
});

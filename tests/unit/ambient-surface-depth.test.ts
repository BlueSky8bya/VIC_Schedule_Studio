import {describe,it,expect} from 'vitest';
import {surfaceMotionFactor,surfaceLocalPoint} from '../../components/shared/ambient/world/depth-render';
describe('meadow surface parallax',()=>{
 it('keeps horizon nearly fixed and changes depth smoothly',()=>{
  expect(surfaceMotionFactor(0)).toBe(.04);
  expect(surfaceMotionFactor(1)).toBeCloseTo(.7);
  expect(surfaceMotionFactor(.2)).toBeLessThan(surfaceMotionFactor(.8)/4);
  for(let i=1;i<=100;i++){const d=surfaceMotionFactor(i/100)-surfaceMotionFactor((i-1)/100);expect(d).toBeGreaterThan(0);expect(d).toBeLessThan(.011);}
 });
});

it('inverts surface projection for interaction at every depth',()=>{
 for(const off of [{x:-8,y:-2},{x:8,y:2}])for(let y=250;y<=860;y+=10){const k=surfaceMotionFactor((y-301)/559),p=surfaceLocalPoint(500+off.x*k,y+off.y*k,off,301,860);expect(p.x).toBeCloseTo(500,7);expect(p.y).toBeCloseTo(y,7);}
});

import {describe,expect,it} from 'vitest';
import {companionGuestExtractionScale as scale} from '@/lib/ui/viewer-companion/guest-extraction';

const bounds={left:300,top:200,right:700,bottom:600};
const initial=44/92;
describe('a hidden guest grows across the actual sheet boundary',()=>{
  it('starts exactly at its measured small size and grows continuously outside',()=>{
    expect(scale(initial,{x:650,y:400},bounds,92)).toBe(initial);
    expect(scale(initial,{x:700,y:400},bounds,92)).toBe(initial);
    let previous=initial;
    for(let distance=0;distance<=92;distance++){
      const next=scale(initial,{x:700+distance,y:400},bounds,92);
      expect(next).toBeGreaterThanOrEqual(previous);
      expect(next-previous).toBeLessThan(.01);
      previous=next;
    }
    expect(previous).toBe(1);
  });
  it('reverses through the same values when returned inside, including corners',()=>{
    for(const distance of [0,1,12,46,80,92,300]){
      expect(scale(initial,{x:700+distance,y:400},bounds,92)).toBe(scale(initial,{x:300-distance,y:400},bounds,92));
      expect(scale(initial,{x:500,y:600+distance},bounds,92)).toBe(scale(initial,{x:500,y:200-distance},bounds,92));
    }
    expect(scale(initial,{x:746,y:646},bounds,92)).toBeGreaterThan(scale(initial,{x:746,y:400},bounds,92));
    expect(scale(initial,{x:500,y:400},bounds,92)).toBe(initial);
  });
  it('keeps full-size guests full size and reduced motion immediate',()=>{
    expect(scale(1,{x:720,y:400},bounds,92)).toBe(1);
    expect(scale(initial,{x:700,y:400},bounds,92,true)).toBe(initial);
    expect(scale(initial,{x:701,y:400},bounds,92,true)).toBe(1);
  });
  it('does not propagate invalid measurements or an absent editor',()=>{
    expect(scale(initial,{x:NaN,y:400},bounds,92)).toBe(initial);
    expect(scale(initial,{x:800,y:400},undefined,92)).toBe(initial);
    expect(scale(initial,{x:800,y:400},{...bounds,right:200},92)).toBe(initial);
    expect(scale(NaN,{x:720,y:400},bounds,92)).toBe(1);
    expect(scale(initial,{x:792,y:400},bounds,0)).toBe(1);
  });
});

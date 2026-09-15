import {describe,it,expect} from 'vitest';
import {pondWaterBounds,pondWaterAlpha,POND_DEPTH_CONTOURS} from '../../components/shared/ambient/world/pond-geometry';
import {compileTerrainField} from '../../components/shared/ambient/world/terrain-perspective';
import {hillViewport} from '../../components/shared/ambient/art/hill-geometry';

describe('freshwater terrain contract',()=>{
  it('keeps waves inside water and off distant land, the near shore and left peninsula',()=>{
    for(let u=0;u<=1;u+=.01){
      const {far,near}=pondWaterBounds(u);
      expect(near-far).toBeGreaterThan(.07);
      expect(pondWaterAlpha(u,far-.01)).toBe(0);
      expect(pondWaterAlpha(u,near+.01)).toBe(0);
      expect(pondWaterAlpha(u,(far+near)/2)).toBe(1);
    }
    expect(pondWaterAlpha(.05,.60)).toBe(0);
    expect(pondWaterAlpha(.5,.97)).toBe(0);
    expect(pondWaterAlpha(.5,.6)).toBe(1);
  });
  it('preserves the same shoreline under all PC crops and softens its interior edge',()=>{
    for(const [w,h]of [[900,1100],[1400,860],[2560,1080],[3840,1080]]){
      const p=hillViewport(w,h,2172,724);
      for(const u of [.05,.3,.5,.9]){
        const {near}=pondWaterBounds(u),x=p.x+u*p.width,y=p.y+(near-.009)*p.height;
        expect(pondWaterAlpha((x-p.x)/p.width,(y-p.y)/p.height)).toBeCloseTo(.5,8);
      }
    }
  });
  it('gives an open far lake less motion/scale depth than the nearby curved shore',()=>{
    const field=compileTerrainField(()=>.35,POND_DEPTH_CONTOURS);
    expect(field.sample(.5,.50)).toBeLessThan(field.sample(.5,.8));
    expect(field.sample(.08,.65)).toBeGreaterThan(field.sample(.5,.65));
    expect(field.bytes).toBeLessThan(200*1024);
  });
});

import {describe,it,expect} from 'vitest';
import {VALLEY_DEPTH_CONTOURS} from '../../components/shared/ambient/world/valley-geometry';
import {compileTerrainField,contourHeight} from '../../components/shared/ambient/world/terrain-perspective';

describe('valley terrain distance',()=>{
  const field=compileTerrainField(()=>.30,VALLEY_DEPTH_CONTOURS);
  it('places elevated banks nearer than the channel at the same screen height',()=>{
    expect(field.sample(.9,.65)).toBeGreaterThan(field.sample(.5,.65));
    expect(field.sample(.1,.65)).toBeGreaterThan(field.sample(.5,.65));
  });
  it('keeps ordered contours and continuous depth through stream bends',()=>{
    for(let x=0;x<=100;x++){
      const u=x/100,rows=VALLEY_DEPTH_CONTOURS.map(c=>contourHeight(c.points,u));
      rows.slice(1).forEach((y,i)=>expect(y).toBeGreaterThan(rows[i]));
      let last=0;
      for(let y=30;y<=100;y++){
        const d=field.sample(u,y/100);expect(d).toBeGreaterThanOrEqual(last-1e-6);
        expect(d-last).toBeLessThan(.08);last=d;
      }
    }
    expect(field.bytes).toBe(198404);
  });
});

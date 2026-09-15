import {describe,it,expect} from 'vitest';
import {sampleMaterialSurface,applyMaterialSurface,type MaterialSurface} from '../../components/shared/ambient/world/terrain-material';
const surface=():MaterialSurface=>({slopeX:0,slopeY:0,flowX:0,flowY:0,water:0});
describe('shared terrain material physics',()=>{
  it('follows opposite valley bends rather than a fixed flow direction',()=>{
    const a=sampleMaterialSurface('valley',.63,.845,'summer',surface());
    const b=sampleMaterialSurface('valley',.58,.94,'summer',surface());
    expect(a.flowX).toBeGreaterThan(0);expect(b.flowX).toBeLessThan(0);
    expect(a.flowY).toBeGreaterThan(0);expect(b.flowY).toBeGreaterThan(0);
    const t=(.94-.88)/(1-.88);
    expect(b.flowX/b.flowY).toBeCloseTo(3*(.57-.70)*6*t*(1-t)/(1-.88));
  });
  it('settles opposite banks toward the channel without current on land',()=>{
    const left=sampleMaterialSurface('valley',.1,.81,'summer',surface());
    const right=sampleMaterialSurface('valley',.95,.81,'summer',surface());
    expect(left.slopeX).toBeGreaterThan(0);expect(right.slopeX).toBeLessThan(0);
    expect(left.water).toBe(0);expect(right.water).toBe(0);
  });
  it('keeps winter pond frozen and narrows valley current away from ice',()=>{
    expect(sampleMaterialSurface('pond',.5,.65,'winter',surface()).water).toBe(0);
    const summer=sampleMaterialSurface('valley',.724,.81,'summer',surface());
    const winter=sampleMaterialSurface('valley',.724,.81,'winter',surface());
    expect(summer.water).toBeGreaterThan(winter.water);
  });
  it('does not apply ground forces to lifted or held leaves; zero dt is inert',()=>{
    const s=sampleMaterialSurface('valley',.69,.81,'summer',surface());
    const air={vx:12,vy:4,lift:1};applyMaterialSurface(air,s,1,1,1);expect(air).toEqual({vx:12,vy:4,lift:1});
    const rest={vx:0,vy:0,lift:0};applyMaterialSurface(rest,s,0,1,1);expect(rest.vy).toBe(0);
    applyMaterialSurface(rest,s,1,1,1);expect(rest.vy).toBeGreaterThan(0);
  });
  it('unknown biomes reset reused output to neutral instead of inheriting valley forces',()=>{
    const s=sampleMaterialSurface('valley',.69,.81,'summer',surface());
    sampleMaterialSurface('future-biome',.69,.81,'summer',s);
    expect(s).toEqual(surface());
  });
  it('carries settled material through two bends within the water across viewport scales',()=>{
    for(const scale of [.7,1,1.5]){
      let x=.59*2580*scale,y=.60*860*scale;
      const body={vx:0,vy:0,lift:0},s=surface(),dt=1/60;
      let minWater=1;
      for(let i=0;i<60000&&y<.85*860*scale;i++){
        sampleMaterialSurface('valley',x/(2580*scale),y/(860*scale),'summer',s);
        minWater=Math.min(minWater,s.water);
        const wet=applyMaterialSurface(body,s,dt,scale,scale)??0;
        const drag=Math.pow(.02+.55*wet,dt);body.vx*=drag;body.vy*=drag;
        x+=body.vx*dt*.5;y+=body.vy*dt*.5;
      }
      expect(y/(860*scale)).toBeGreaterThanOrEqual(.85);
      expect(minWater).toBeGreaterThan(.5);
    }
  });
});

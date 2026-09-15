import {describe,it,expect} from 'vitest';
import {keyForestMatte,FOREST_TREES} from '../../components/shared/ambient/world/forest-geometry';
import {rootedPass} from '../../components/shared/ambient/world/rooted-order';
import {forestDetailPitch,forestDetailBudget} from '../../components/shared/ambient/world/forest-detail';
describe('forest separated layers',()=>{
  it('retains near detail with continuous distance reduction and bounded quality tiers',()=>{
    const pitches=Array.from({length:101},(_,i)=>forestDetailPitch(i/100));
    expect(pitches[0]).toBeGreaterThan(pitches[100]*3);
    for(let i=1;i<pitches.length;i++){expect(pitches[i]).toBeLessThanOrEqual(pitches[i-1]);expect(pitches[i-1]-pitches[i]).toBeLessThan(.05);}
    expect(forestDetailPitch(1)).toBeLessThanOrEqual(1);
    expect(forestDetailPitch(.5,'lite')).toBeGreaterThan(forestDetailPitch(.5,'full'));
    expect(forestDetailBudget('lite')).toBeLessThan(forestDetailBudget('full'));
  });
  it('keys canopy holes while preserving opaque snow, bark and foliage',()=>{
    const p=new Uint8ClampedArray([255,0,255,255,240,244,250,255,92,78,60,255,80,130,65,255,230,20,231,255]);
    keyForestMatte(p);expect([p[3],p[7],p[11],p[15],p[19]]).toEqual([0,255,255,255,0]);
  });
  it('draws a behind actor before tree, front actor after tree, and flushes only once',()=>{
    const events:string[]=[],flush=rootedPass([{y:60,id:'far'},{y:90,id:'near'}],t=>events.push(t.id));
    flush(55);events.push('behind');flush(65);events.push('between');flush(95);events.push('front');flush(Infinity);
    expect(events).toEqual(['behind','far','between','near','front']);
  });
  it('occupies the forest interior at multiple depths instead of reserving a corridor',()=>{
    const central=FOREST_TREES.filter(t=>t.u>.44&&t.u<.57);
    expect(central.some(t=>t.v<.65)).toBe(true);
    expect(central.some(t=>t.v>.65&&t.v<.8)).toBe(true);
    expect(central.some(t=>t.v>.8)).toBe(true);
  });
});

import {describe,it,expect} from 'vitest';
import {meadowGardenLayout} from '../../components/shared/ambient/art/meadow-garden';
describe('seasonal meadow vegetation',()=>{
  it('keeps a stable open walking corridor and roots every plant below the horizon',()=>{
    const plants=meadowGardenLayout(1920,1080,'spring');
    expect(plants).toEqual(meadowGardenLayout(1920,1080,'spring'));
    expect(plants.length).toBeGreaterThan(50);
    expect(plants.every(p=>p.y>1080*.5&&p.y<1080&&p.x>=0&&p.x<=1920)).toBe(true);
    expect(plants.some(p=>p.x>1920*.39&&p.x<1920*.61)).toBe(false);
    expect(new Set(plants.map(p=>p.kind)).size).toBeGreaterThanOrEqual(5);
  });
  it('replaces summer flowers and ferns with sparse winter stems',()=>{
    const summer=meadowGardenLayout(1920,1080,'summer'),winter=meadowGardenLayout(1920,1080,'winter');
    expect(summer.some(p=>p.kind==='fern')).toBe(true);
    expect(winter.every(p=>p.kind==='seed'||p.kind==='grass')).toBe(true);
    expect(winter.length).toBeLessThan(summer.length/2);
  });
});

import {describe,it,expect} from 'vitest';
import {nearDetailOpacity} from '../../components/shared/ambient/world/ground-detail';
describe('near-only ground improvement',()=>{
  it('preserves the distant half and introduces detail near the viewer',()=>{
    for(let i=-100;i<=50;i++) expect(nearDetailOpacity(i/100)).toBe(0);
    expect(nearDetailOpacity(.85)).toBe(1); expect(nearDetailOpacity(2)).toBe(1);
  });
  it('has no abrupt boundary',()=>{
    for(let i=501;i<=1000;i++) {
      const delta=nearDetailOpacity(i/1000)-nearDetailOpacity((i-1)/1000);
      expect(delta).toBeGreaterThanOrEqual(0); expect(delta).toBeLessThan(.005);
    }
  });
});

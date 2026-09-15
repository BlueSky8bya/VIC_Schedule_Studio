import {expect,it} from 'vitest';
import {sandyMotion,sandyWaterMask} from '@/components/shared/ambient/world/sandy-geometry';
it('keeps distant islands and dry sand outside wave deformation',()=>{
 for(const v of [0,.2,.36,.385,.705,.8,1])expect(sandyWaterMask(v)).toBe(0);
 expect(sandyWaterMask(.54)).toBe(1);
 for(let v=0;v<=1;v+=.001){expect(sandyWaterMask(v)).toBeGreaterThanOrEqual(0);expect(sandyWaterMask(v)).toBeLessThanOrEqual(1);}
});
it('increases parallax continuously from horizon to nearby sand',()=>{
 let previous=sandyMotion(0);
 for(let v=.001;v<=1;v+=.001){const next=sandyMotion(v);expect(next).toBeGreaterThanOrEqual(previous);expect(next-previous).toBeLessThan(.004);previous=next;}
 expect(sandyMotion(1)).toBeGreaterThan(sandyMotion(.4)*10);
});

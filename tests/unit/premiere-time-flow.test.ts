import {expect,it} from 'vitest';
import {parseTimePart,timePartComplete} from '@/lib/ui/time-entry';
it('advances only a valid complete two-digit part, preserving partial and invalid edits',()=>{
 for(const [value,max,expected]of [['00',23,0],['23',23,23],['59',59,59],['9',23,9]] as const)expect(parseTimePart(value,max)).toBe(expected);
 for(const value of ['','24','-1','２１','1e','123'])expect(parseTimePart(value,23)).toBeNull();
 for(const value of ['0','2','9','','24','99','2x'])expect(timePartComplete(value,23)).toBe(false);
 for(const value of ['00','09','21','23'])expect(timePartComplete(value,23)).toBe(true);
 expect(timePartComplete('60',59)).toBe(false);expect(timePartComplete('59',59)).toBe(true);
});

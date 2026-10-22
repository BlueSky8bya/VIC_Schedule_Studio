import {describe,it,expect}from'vitest';
import{sampleCompanionHomeReach,companionHomeCordTouches}from'@/lib/ui/viewer-companion/home-interaction';
const input=()=>({hand:{x:242.7279,y:857.0521},contact:{x:238.6545,y:765.0521,width:4.0625,height:6.7014},footY:927.8542,ceiling:667.8542,size:92,progress:.5,jump:true,cord:true,horizontal:{bodyX:238.6545,left:200,right:280}});
describe('170 finite physical cord alignment at the recorded full-renderer gap',()=>{
 it('brings the actual shifted hand onto the narrow knob without widening contact',()=>{const next=sampleCompanionHomeReach(input())!;expect(next.shiftX).toBeCloseTo(-4.0734);expect(companionHomeCordTouches(next.from,input().contact,92)).toBe(true);expect(next.touching).toBe(true);});
 it.each([0,1])('returns to the same stance at phase%s',progress=>{const next=sampleCompanionHomeReach({...input(),progress})!;expect(next.shiftX).toBe(0);expect(next.lift).toBe(0);expect(next.touching).toBe(false);});
 it('keeps jump OFF completely still',()=>{const next=sampleCompanionHomeReach({...input(),jump:false})!;expect(next.shiftX).toBe(0);expect(next.lift).toBe(0);expect(next.touching).toBe(false);});
 it('cannot bridge a distant horizontal gap',()=>{const next=sampleCompanionHomeReach({...input(),hand:{x:300,y:857.0521}})!;expect(Math.abs(next.shiftX)).toBeLessThanOrEqual(92*.12);expect(next.touching).toBe(false);});
 it('stays inside the measured safe support span instead of reaching through an obstacle',()=>{const value=input();value.horizontal.left=238;const next=sampleCompanionHomeReach(value)!;expect(value.horizontal.bodyX+next.shiftX).toBeGreaterThanOrEqual(238);expect(next.touching).toBe(false);});
 it('requires finite valid bounds and an already safe body',()=>{for(const horizontal of [undefined,{bodyX:238.6545,left:NaN,right:280},{bodyX:199,left:200,right:280},{bodyX:238.6545,left:280,right:200}])expect(sampleCompanionHomeReach({...input(),horizontal})!.shiftX).toBe(0);});
 it('does not alter other controls horizontal motion',()=>{expect(sampleCompanionHomeReach({...input(),cord:false})!.shiftX).toBe(0);});
 it('eases the approach rather than snapping at launch',()=>{const early=sampleCompanionHomeReach({...input(),progress:.07})!,later=sampleCompanionHomeReach({...input(),progress:.14})!;expect(early.shiftX).toBeLessThan(0);expect(Math.abs(early.shiftX)).toBeLessThan(Math.abs(later.shiftX));expect(Math.abs(later.shiftX)).toBeLessThan(4.0734);});
});

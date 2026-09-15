import {it,expect} from 'vitest';
import {meadowRidgeTop} from '../../components/shared/ambient/art/meadow-ridge';
it('keeps the ridge continuous across old tile edges and large world coordinates',()=>{
  for(let x=-6000;x<6000;x++){
    const y=meadowRidgeTop(x);
    expect(y).toBeGreaterThanOrEqual(12);expect(y).toBeLessThan(74);
    expect(Math.abs(meadowRidgeTop(x+.5)-y)).toBeLessThan(.8);
    expect(meadowRidgeTop(x)).toBe(y);
  }
});
it('does not repeat the crest at the former 645px tile spacing',()=>{
  let difference=0;
  for(let x=-1400;x<1400;x+=10)difference+=Math.abs(meadowRidgeTop(x)-meadowRidgeTop(x+645));
  expect(difference/280).toBeGreaterThan(3);
});

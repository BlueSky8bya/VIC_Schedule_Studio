import {expect,it} from 'vitest';
import {rockWaterField} from '@/components/shared/ambient/world/rock-water-mask';
it('isolates sea and sheltered pools while excluding dry rock and sky',()=>{
 const w=400,h=300,data=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const sea=y>h*.39&&y<h*.55,pool=x<90&&x>10&&y>210&&y<260;
  const c=sea||pool?[60,165,210]:[165,155,145],i=(y*w+x)*4;data.set([...c,255],i);
 }
 const mask=rockWaterField(data,w,h),sample=(x:number,y:number)=>mask[(y*w+x)*4];
 expect(sample(200,140)).toBe(255);
 expect(sample(40,235)).toBe(64);
 expect(sample(200,240)).toBe(0);
 expect(sample(200,50)).toBe(0);
 expect(sample(11,235)).toBe(0); // protected rock rim
 expect(sample(20,235)).toBeGreaterThan(0);
});

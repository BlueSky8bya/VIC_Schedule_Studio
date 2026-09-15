import {describe,it,expect,vi} from 'vitest';
import {fogSkyEnvelope,fogDepth,bakeFogField} from '../../components/shared/ambient/world/fog';
describe('fog sky boundary',()=>{
  it('bakes adjacent horizon rows without the old opacity step',()=>{
    let pixels:Uint8ClampedArray=new Uint8ClampedArray();
    vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>({
      createImageData:(w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4)}),
      putImageData:(im:{data:Uint8ClampedArray})=>{pixels=im.data;},
    })})});
    try {
      const c=bakeFogField(1400,860,.8,'220 225 230',null,'boundary-unit');
      const row=Math.floor(860*.26/8);
      const mean=(y:number)=>{let a=0;for(let x=0;x<c.width;x++)a+=pixels[(y*c.width+x)*4+3];return a/c.width;};
      expect(Math.abs(mean(row)-mean(row-1))).toBeLessThan(6);
    } finally {vi.unstubAllGlobals();}
  });
  it('has no density jump across the horizon for all scene horizon heights',()=>{
    for(const h of [720,860,1080,1440])for(const ratio of [.26,.35,.42]){
      const hz=h*ratio,eps=.001;
      const above=fogDepth(0)*fogSkyEnvelope(hz-eps,h,hz);
      const below=fogDepth(eps/(h-hz));
      expect(Math.abs(above-below)).toBeLessThan(.00001);
      expect(fogSkyEnvelope(hz-h*.12,h,hz)).toBeCloseTo(0,10);
      expect(fogSkyEnvelope(hz,h,hz)).toBe(1);
    }
  });
  it('fades monotonically without a sharp onset in the sky',()=>{
    const h=1000,hz=420;
    let prev=0;
    for(let y=290;y<=430;y++){
      const a=fogSkyEnvelope(y,h,hz);expect(a).toBeGreaterThanOrEqual(prev);
      expect(a-prev).toBeLessThan(.013);prev=a;
    }
  });
});



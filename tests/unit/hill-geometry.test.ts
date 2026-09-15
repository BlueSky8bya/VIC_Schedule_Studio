import { describe, expect, it } from 'vitest';
import { hillCutRows, hillViewport } from '../../components/shared/ambient/art/hill-geometry';

describe('hill terrain framing',()=>{
  it('preserves grass aspect ratio from narrow PC through ultrawide without empty edges',()=>{
    for(const [w,h] of [[900,1100],[1400,860],[2560,1080],[3840,1080]]){
      const p=hillViewport(w,h,2172,724);
      expect(p.scale).toBe(Math.max(h/724,w/2172));
      expect(p.width/2172).toBeCloseTo(p.height/724);
      expect(p.x).toBeLessThanOrEqual(0);
      expect(p.x+p.width).toBeGreaterThanOrEqual(w);
      expect(p.y+p.height).toBeGreaterThanOrEqual(h);
    }
  });
  it('cuts exterior matte without treating white winter snow as a hole',()=>{
    const w=6,h=100,p=new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)p.set(y<35+x?[255,0,255,255]:[245,246,250,255],(y*w+x)*4);
    expect([...hillCutRows(p,w,h,false)]).toEqual([37,38,39,40,41,42]);
  });
  it('rejects missing terrain instead of returning a matte-filled backdrop',()=>{
    const p=new Uint8ClampedArray(4*100*4);
    for(let i=0;i<p.length;i+=4)p.set([255,0,255,255],i);
    expect(()=>hillCutRows(p,4,100,false)).toThrow('Invalid hill skyline');
  });
});

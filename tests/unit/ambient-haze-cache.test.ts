import {describe,it,expect,vi} from 'vitest';
import {drawDepthHaze,withViewHorizon,horizonY,hazeEndY} from '../../components/shared/ambient/world/view';

describe('depth haze cache across biome travel',()=>{
  it('uses the current horizon geometry after visiting a different biome',()=>{
    const createLinearGradient=vi.fn((x0:number,y0:number,x1:number,y1:number)=>({x0,y0,x1,y1,addColorStop:vi.fn()}));
    const g={createLinearGradient,save:vi.fn(),restore:vi.fn(),fillRect:vi.fn(),fillStyle:null} as unknown as CanvasRenderingContext2D;
    // Same season, viewport and weather; only the biome horizon changes.
    for(const ratio of [.35,.42,.26,.42,.35])withViewHorizon(ratio,()=>{
      drawDepthHaze(g,'autumn',1379,863);
      expect(g.fillStyle).toMatchObject({y0:horizonY(863)*.85,y1:hazeEndY(863)});
      expect(g.fillRect).toHaveBeenLastCalledWith(-0,horizonY(863)*.85,1379,hazeEndY(863)-horizonY(863)*.85+2);
    });
    // Returning to the same geometry still reuses its gradient.
    expect(createLinearGradient).toHaveBeenCalledTimes(3);
  });
});


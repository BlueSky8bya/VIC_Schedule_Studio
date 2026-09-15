import {describe,it,expect} from 'vitest';
import {HILL_DEPTH_CONTOURS,contourHeight,terrainDistance,compileTerrainField,reliefMask,reliefMotion} from '../../components/shared/ambient/world/terrain-perspective';
import {surfaceLocalPoint} from '../../components/shared/ambient/world/depth-render';
import {hillViewport} from '../../components/shared/ambient/art/hill-geometry';
import {meadowSize,meadowSpeed,meadowActivityAlpha} from '../../components/shared/ambient/world/meadow-activity';
import {withViewHorizon} from '../../components/shared/ambient/world/view';

describe('terrain-relative material distance',()=>{
  const distance=(x:number,y:number)=>terrainDistance(x,y,.36,HILL_DEPTH_CONTOURS);
  it('compiles a bounded field without losing terrain relief',()=>{
    const field=compileTerrainField(()=>.36,HILL_DEPTH_CONTOURS);
    expect(field.bytes).toBeLessThan(200*1024);
    for(let x=0;x<=1;x+=.037)for(let y=.3;y<=1;y+=.013)expect(Math.abs(field.sample(x,y)-distance(x,y))).toBeLessThan(.003);
  });
  it('matches source-over contour mask motion and inverts both axes at all quality tiers',()=>{
    for(const count of [3,5])for(let d=0;d<=1;d+=.007){
      let actual=.04;
      for(let i=1;i<count;i++){
        const a=reliefMask(d,i,count),v=i/(count-1),k=.04+.66*v*v*(3-2*v);
        actual=actual*(1-a)+k*a;
      }
      expect(reliefMotion(d,count)).toBeCloseTo(actual,12);
    }
    for(const [w,h]of [[900,1100],[1400,860],[3840,1080]])for(const count of [3,5])for(const sign of [-1,1]){
      const p=hillViewport(w,h,2172,724),off={x:8*sign,y:2*sign};
      const motion=(x:number,y:number)=>reliefMotion(distance((x-p.x)/p.width,(y-p.y)/p.height),count);
      for(let x=0;x<w;x+=143)for(let y=h*.4;y<h;y+=71){
        const k=motion(x,y),back=surfaceLocalPoint(x+off.x*k,y+off.y*k,off,h*.42,h,motion);
        expect(Math.hypot(back.x-x,back.y-y)).toBeLessThan(.01);
      }
    }
  });
  it('distinguishes a nearer side slope from the receding central saddle at identical screen height',()=>{
    const side=distance(.16,.55),saddle=distance(.55,.55);
    expect(side-saddle).toBeGreaterThan(.15);
    withViewHorizon(.42,()=>{
      const row=(d:number)=>428+d*(1000-428);
      expect(meadowSize(row(side),1000)).toBeGreaterThan(meadowSize(row(saddle),1000));
      expect(meadowSpeed(row(side),1000)).toBeGreaterThan(meadowSpeed(row(saddle),1000));
      expect(meadowActivityAlpha(row(side),1000)).toBeGreaterThan(meadowActivityAlpha(row(saddle),1000));
    });
  });
  it('has continuous, finite and monotonic distance through ridges and along contour joins',()=>{
    for(let x=0;x<=1;x+=.025){
      let last=0;
      for(let y=.30;y<=1.1;y+=.001){
        const d=distance(x,y);expect(Number.isFinite(d)).toBe(true);expect(d).toBeGreaterThanOrEqual(last-1e-9);expect(d).toBeLessThanOrEqual(1);expect(d-last).toBeLessThan(.02);last=d;
      }
      for(const c of HILL_DEPTH_CONTOURS){
        const y=contourHeight(c.points,x);
        expect(Math.abs(distance(x,y-.00001)-distance(x,y+.00001))).toBeLessThan(.001);
      }
    }
    for(const c of HILL_DEPTH_CONTOURS)for(const [x,y]of c.points){
      expect(Math.abs(distance(x-.00001,y)-distance(x+.00001,y))).toBeLessThan(.001);
    }
  });
  it('keeps a source landmark at the same distance under narrow, wide and cover crops',()=>{
    for(const [w,h]of [[900,1100],[1400,860],[2560,1080],[3840,1080]]){
      const p=hillViewport(w,h,2172,724),u=.55,v=.65;
      const screenX=p.x+u*p.width,screenY=p.y+v*p.height;
      expect(distance((screenX-p.x)/p.width,(screenY-p.y)/p.height)).toBeCloseTo(distance(u,v),10);
    }
  });
  it('uses each silhouette as the exterior boundary, never classifies sky as nearby ground',()=>{
    for(const top of [.3,.36,.44,.51]){
      expect(terrainDistance(.5,top,top,HILL_DEPTH_CONTOURS)).toBe(0);
      expect(terrainDistance(.5,top-.05,top,HILL_DEPTH_CONTOURS)).toBe(0);
      expect(terrainDistance(.5,1.1,top,HILL_DEPTH_CONTOURS)).toBe(1);
    }
  });
});

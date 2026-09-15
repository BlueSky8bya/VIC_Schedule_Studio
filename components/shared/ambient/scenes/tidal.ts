import type {Frame,Scene} from '../scene-engine';
import type {SeasonKey} from '../registry';
import {HillBackdrop} from '../art/hill-backdrop';
import {ReliefLayers} from '../world/relief-render';
import {reliefLayerCount,reliefMotion} from '../world/terrain-perspective';
import {scopedDepthTier,withDepthLayer,withReliefSurface} from '../world/depth-render';
import {bakeSky,bakeClouds,drawSky,drawSkyLive,skyKey} from '../world/sky';
import {horizonY,hillCrestY} from '../world/view';

/** Scenery-only coast: no seasonal-material simulation or creature asset loads. */
export function createTidal(seed:number,season:SeasonKey):Scene{
 const backdrop=new HillBackdrop(season,'tidal'),relief=new ReliefLayers();
 let terrain:HTMLCanvasElement|undefined,terrainKey='',w=0,h=0;
 let sky:HTMLCanvasElement|undefined,clouds:ReturnType<typeof bakeClouds>|null=null,skyCacheKey='';
 const distance=(x:number,y:number)=>backdrop.distance(x,y,w,h)??0;
 const bake=(f:Frame)=>{
  w=f.w;h=f.h;
  if(!backdrop.ready)return;
  const dpr=Math.min(f.dpr,1.5),key=`${w}:${h}:${dpr}:${backdrop.version}`;
  if(terrain&&key===terrainKey)return;
  if(terrain)terrain.width=terrain.height=1;
  terrain=document.createElement('canvas');terrain.width=Math.ceil(w*dpr);terrain.height=Math.ceil(h*dpr);
  const g=terrain.getContext('2d')!;g.scale(dpr,dpr);backdrop.drawGround(g,w,h);terrainKey=key;
 };
 return {
  resize:bake,step:bake,
  ready:()=>!backdrop.pending,
  draw(g,f){
   if(backdrop.drawPending(g,f))return;
   const key=skyKey(season,f.weather.now,f.time.band,f.w,f.h);
   if(!sky||key!==skyCacheKey){
    if(sky)sky.width=sky.height=1;
    sky=bakeSky(season,f.weather.now,f.time.band,f.w,f.h,seed);
    clouds=bakeClouds(season,f.weather.now,f.time.band,f.w,f.h,seed);skyCacheKey=key;
   }
   withDepthLayer(g,'sky',()=>{
    g.drawImage(sky!,0,Math.max(0,Math.floor(horizonY(f.h))-2),sky!.width,1,0,0,f.w,f.h);
    drawSky(g,sky!,clouds,f.w,f.t,f.weather.now,()=>drawSkyLive(g,f.w,f,seed,Math.min(horizonY(f.h)*.92,hillCrestY(f.h)-4),{
     solarPath:true,solarHorizon:f.solarHorizon??horizonY(f.h),terrainOccludes:true,
    }));
   });
   if(terrain){
    const count=reliefLayerCount(scopedDepthTier(g));
    withReliefSurface(g,(x,y)=>reliefMotion(distance(x,y),count),(off,tier)=>relief.draw(g,terrain!,w,h,off,tier,distance));
   }else{
    // Decode failure stays usable, with a quiet coastal-colored ground.
    g.fillStyle=season==='winter'?'#929eaa':'#969c97';g.fillRect(0,horizonY(h),w,h-horizonY(h));
   }
  },
  drawForeground:()=>true,
  skyHorizon:(ww,hh)=>backdrop.skyHorizon(ww,hh),
  surfaceMotion:(x,y,tier)=>reliefMotion(distance(x,y),reliefLayerCount(tier)),
  debug:()=>({biome:'tidal',season,backdrop:backdrop.debug(),relief:relief.debug(),leaves:0,creatures:0,terrainBytes:terrain?terrain.width*terrain.height*4:0}),
  dispose(){backdrop.dispose();relief.dispose();if(terrain)terrain.width=terrain.height=1;if(sky)sky.width=sky.height=1;terrain=sky=undefined;clouds=null;},
 };
}

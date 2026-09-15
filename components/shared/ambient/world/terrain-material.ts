import type {SeasonKey} from '../registry';
import {pondWaterAlpha} from './pond-geometry';

export type MaterialSurface={slopeX:number;slopeY:number;flowX:number;flowY:number;water:number};
export type MaterialProfile=(u:number,v:number,season:SeasonKey,out:MaterialSurface)=>void;
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
// [source y, channel center x, half-width], traced from valley-v1 bends.
const channel= [[.53,.51,.009],[.58,.59,.018],[.63,.59,.025],[.69,.47,.035],[.74,.55,.044],[.81,.69,.057],[.88,.70,.092],[1,.57,.13]] as const;
function valley(u:number,v:number,season:SeasonKey,out:MaterialSurface){
  if(v<channel[0][0]||v>1)return;
  let i=1;while(i<channel.length-1&&v>channel[i][0])i++;
  const a=channel[i-1],b=channel[i],t=(v-a[0])/(b[0]-a[0]),s=smooth(t);
  const center=a[1]+(b[1]-a[1])*s,width=a[2]+(b[2]-a[2])*s;
  const offset=u-center;
  // Conservative inner channel; snow/ice margins never inherit summer current.
  const wetWidth=width*(season==='winter'?.42:.80);
  out.water=1-smooth((Math.abs(offset)-wetWidth*.55)/Math.max(.004,wetWidth*.45));
  const near=smooth((v-.50)/.45);
  out.slopeX=-Math.tanh(offset*10)*near*(1-out.water);
  out.slopeY=.12*near*(1-out.water);
  // Smooth centerline tangent (dx/dy), not a global horizontal drift.
  // UV has a 3:1 aspect: a unit in u spans three times the pixels of v.
  const tangent=3*(b[1]-a[1])*6*t*(1-t)/(b[0]-a[0]);
  const length=Math.hypot(tangent,1);
  out.flowX=tangent/length;out.flowY=1/length;
}

/** One extension point for every biome. New art supplies geography here; the
 * solver never infers slopes/water from colors or repeats another biome's map. */
const profiles:Readonly<Record<string,MaterialProfile>>={
  valley,
  forest:(u,v,_season,out)=>{const near=smooth((v-.50)/.5);out.slopeX=(.5-u)*near*.35;out.slopeY=.10*near;},
  hill:(u,v,_season,out)=>{const near=smooth((v-.45)/.5);out.slopeX=(.7-u)*near*.55;out.slopeY=.22*near;},
  pond:(u,v,season,out)=>{out.water=season==='winter'?0:pondWaterAlpha(u,v);out.flowX=.12;out.flowY=.03;},
};
export function sampleMaterialSurface(biome:string,u:number,v:number,season:SeasonKey,out:MaterialSurface){
  out.slopeX=out.slopeY=out.flowX=out.flowY=out.water=0;
  if(u>=0&&u<=1&&v>=0&&v<=1)profiles[biome]?.(u,v,season,out);
  return out;
}

/** Velocities are unprojected screen units; the shared integrator applies the
 * existing distance speed once. Airborne leaves feel wind, not surface flow. */
export function applyMaterialSurface(body:{vx:number;vy:number;lift:number},surface:MaterialSurface,dt:number,scaleX:number,scaleY:number){
  if(dt<=0)return;
  const contact=1-smooth(body.lift/.65),wet=surface.water*contact;
  body.vx+=surface.slopeX*18*scaleX*contact*dt;
  body.vy+=surface.slopeY*18*scaleY*contact*dt;
  const follow=1-Math.exp(-1.2*wet*dt);
  body.vx+=(surface.flowX*34*scaleX-body.vx)*follow;
  body.vy+=(surface.flowY*34*scaleY-body.vy)*follow;
  return wet;
}

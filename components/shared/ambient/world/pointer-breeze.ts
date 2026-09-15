import type { Frame } from '../scene-engine';
import { meadowSpeed } from './meadow-activity';
import { clamp } from '../scenes/util';

/** Autumn's radial push and tangential wake, shared by all seasonal material.
 * Mutates velocity without allocating per-particle objects; returns lift/spin weight.
 */
export function pointerBreeze(body:{x:number;y:number;vx:number;vy:number},f:Frame,size:number,perspective=meadowSpeed(body.y,f.h)):number {
  const p=f.p,sp=Math.min(2600,Math.hypot(p.vx,p.vy));
  if(f.dt<=0||!p.inside||sp<=30)return 0;
  const dx=body.x-p.x,dy=body.y-p.y,d=Math.hypot(dx,dy),radius=(110+60*f.load+size*.6)*(.45+.55*perspective);
  if(d<=.001||d>=radius)return 0;
  const k=(1-d/radius)*(.35+.65*f.load)*perspective,nx=dx/d,ny=dy/d;
  body.vx+=(nx*sp*1.05+clamp(p.vx,-2600,2600)*.45-ny*sp*.18)*k*f.dt;
  body.vy+=(ny*sp*1.05+clamp(p.vy,-2600,2600)*.45+nx*sp*.18)*k*f.dt;
  return k;
}

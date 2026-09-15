import type {DepthContour} from './terrain-perspective';
export const SANDY_DEPTH_CONTOURS:readonly DepthContour[]=[
 {depth:.12,points:[[0,.43],[1,.43]]},
 {depth:.34,points:[[0,.65],[.4,.66],[1,.65]]},
 {depth:.68,points:[[0,.81],[1,.81]]},
 {depth:1,points:[[0,1.02],[1,1.02]]},
];
export const SANDY_WATER={start:.385,full:.46,fade:.635,end:.705};
const smooth=(a:number,b:number,v:number)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
/** Same smooth mapping as the shoreline shader; no slice boundaries. */
export function sandyMotion(v:number){return .035+.18*smooth(.36,.66,v)+.66*smooth(.66,1,v);}
export function sandyWaterMask(v:number){const p=SANDY_WATER;return smooth(p.start,p.full,v)*(1-smooth(p.fade,p.end,v));}

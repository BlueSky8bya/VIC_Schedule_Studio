import {contourHeight,type DepthContour} from './terrain-perspective';

/** Source-space shoreline of the approved 3:1 lake. Conservative water interior
 * excludes the left peninsula/inlet and shallow grassy margins, in all seasons. */
export const POND_FAR_SHORE:DepthContour['points']=[[0,.43],[.25,.425],[.5,.429],[.75,.432],[1,.449]];
export const POND_NEAR_SHORE:DepthContour['points']=[[0,.525],[.065,.562],[.105,.61],[.16,.755],[.30,.838],[.45,.895],[.62,.918],[.78,.913],[.90,.887],[1,.825]];
export const POND_DEPTH_CONTOURS:readonly DepthContour[]=[
  {depth:.12,points:POND_FAR_SHORE},
  {depth:.40,points:[[0,.55],[.2,.58],[.5,.61],[.8,.60],[1,.57]]},
  {depth:.76,points:POND_NEAR_SHORE},
  {depth:1,points:[[0,1.03],[1,1.03]]},
];
export function pondWaterBounds(u:number){return {far:contourHeight(POND_FAR_SHORE,u),near:contourHeight(POND_NEAR_SHORE,u)};}
export function pondWaterAlpha(u:number,v:number){
  if(u<0||u>1)return 0;
  const {far,near}=pondWaterBounds(u),d=Math.min(v-far,near-v);
  const t=Math.max(0,Math.min(1,d/.018));return t*t*(3-2*t);
}

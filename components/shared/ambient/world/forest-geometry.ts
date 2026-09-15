import type {DepthContour} from './terrain-perspective';
export const FOREST_DEPTH_CONTOURS:readonly DepthContour[]=[
  {depth:.14,points:[[0,.49],[.3,.54],[.5,.57],[.7,.54],[1,.49]]},
  {depth:.43,points:[[0,.62],[.3,.68],[.5,.72],[.7,.68],[1,.62]]},
  {depth:.74,points:[[0,.80],[.3,.84],[.5,.88],[.7,.84],[1,.80]]},
  {depth:1,points:[[0,1.02],[1,1.02]]},
];
/** Root positions and full-tree heights, in source-space. Roots occupy litter openings in the composed ground artwork.
 * Keep source-space anchors across seasons and crops; never clamp onto shrubs. */
export const FOREST_TREES=[
  // Authored clumps and uneven openings, not paired rows or a regular grid.
  {u:0.286,v:0.610,height:0.22,variant:1},{u:0.355,v:0.640,height:0.37,variant:3},
  {u:0.410,v:0.602,height:0.27,variant:2},{u:0.453,v:0.628,height:0.17,variant:0},
  {u:0.539,v:0.550,height:0.39,variant:3},{u:0.633,v:0.586,height:0.2,variant:1},
  {u:0.701,v:0.614,height:0.49,variant:2},{u:0.738,v:0.595,height:0.25,variant:0},
  {u:0.264,v:0.691,height:0.65,variant:0},{u:0.291,v:0.734,height:0.28,variant:2},
  {u:0.384,v:0.714,height:0.57,variant:1},{u:0.415,v:0.765,height:0.24,variant:3},
  {u:0.200,v:0.864,height:0.94,variant:1},{u:0.750,v:0.712,height:0.67,variant:2},
  {u:0.659,v:0.807,height:0.78,variant:2},{u:0.673,v:0.846,height:0.31,variant:1},
  // Forest interior: overlapping central clumps break the former straight
  // clearing. Keep sky above the canopy, not an empty corridor through it.
  {u:0.488,v:0.550,height:0.3,variant:0},{u:0.503,v:0.658,height:0.44,variant:2},
  {u:0.423,v:0.707,height:0.22,variant:3},{u:0.526,v:0.737,height:0.59,variant:1},
  {u:0.465,v:0.795,height:0.72,variant:0},{u:0.442,v:0.833,height:0.32,variant:2},
  {u:0.544,v:0.936,height:0.96,variant:3},
  {u:0.269,v:0.923,height:1.12,variant:0},{u:0.772,v:0.968,height:0.89,variant:3},
] as const;

/** Removes key color everywhere, including canopy interiors. Snow stays solid. */
export function keyForestMatte(data:Uint8ClampedArray,width=0){
  for(let i=0;i<data.length;i+=4){
    const r=data[i],g=data[i+1],b=data[i+2];
    const spill=Math.min(r,b)-g;
    if(spill>32)data[i+3]=0;
    else if(spill>0){
      // Mixed edge pixels retain matte tint after a hard key. Neutralize the
      // magenta spill and taper coverage instead of leaving a pink outline.
      data[i]=r-spill;data[i+2]=b-spill;
      if(spill>8)data[i+3]=Math.round(data[i+3]*(32-spill)/24);
    }
  }
  // Key blended with warm foliage can leave red-dominant mauve rather than
  // pure magenta. Despill only exposed edge RGB; never cut new canopy holes.
  if(width>0)for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const x=(i/4)%width;
    const edge=(x>0&&data[i-1]<16)||(x<width-1&&data[i+7]<16)||
      (i>=width*4&&data[i-width*4+3]<16)||(i+width*4<data.length&&data[i+width*4+3]<16);
    if(edge&&data[i]>data[i+1]+8&&data[i+2]>data[i+1]*.8){
      data[i]-=(data[i]-data[i+1])*.75;
    }
  }

}

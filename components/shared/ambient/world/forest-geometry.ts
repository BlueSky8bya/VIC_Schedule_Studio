import type {DepthContour} from './terrain-perspective';
export const FOREST_DEPTH_CONTOURS:readonly DepthContour[]=[
  {depth:.14,points:[[0,.49],[.3,.54],[.5,.57],[.7,.54],[1,.49]]},
  {depth:.43,points:[[0,.62],[.3,.68],[.5,.72],[.7,.68],[1,.62]]},
  {depth:.74,points:[[0,.80],[.3,.84],[.5,.88],[.7,.84],[1,.80]]},
  {depth:1,points:[[0,1.02],[1,1.02]]},
];
/** Root positions and full-tree heights, in source-space. Two edge trees stay
 * in view on narrow desktop crops, without stretching the tree artwork. */
export const FOREST_TREES=[
  // Authored clumps and uneven openings, not paired rows or a regular grid.
  {u:.32,v:.572,height:.16,variant:1},{u:.347,v:.61,height:.25,variant:3},
  {u:.411,v:.59,height:.20,variant:2},{u:.436,v:.634,height:.14,variant:0},
  {u:.579,v:.568,height:.23,variant:3},{u:.622,v:.604,height:.15,variant:1},
  {u:.69,v:.64,height:.30,variant:2},{u:.727,v:.613,height:.19,variant:0},
  {u:.259,v:.685,height:.34,variant:0},{u:.292,v:.736,height:.23,variant:2},
  {u:.397,v:.716,height:.36,variant:1},{u:.416,v:.767,height:.20,variant:3},
  {u:.18,v:.826,height:.46,variant:1},{u:.79,v:.754,height:.36,variant:2},
  {u:.639,v:.793,height:.46,variant:2},{u:.677,v:.852,height:.26,variant:1},
  // Forest interior: overlapping central clumps break the former straight
  // clearing. Keep sky above the canopy, not an empty corridor through it.
  {u:.489,v:.582,height:.21,variant:0},{u:.531,v:.628,height:.27,variant:2},
  {u:.463,v:.665,height:.18,variant:3},{u:.566,v:.731,height:.34,variant:1},
  {u:.487,v:.757,height:.39,variant:0},{u:.452,v:.831,height:.24,variant:2},
  {u:.548,v:.894,height:.47,variant:3},
  {u:.255,v:.921,height:.54,variant:0,edge:-1},{u:.785,v:.966,height:.45,variant:3,edge:1},
] as const;

/** Removes key color everywhere, including canopy interiors. Snow stays solid. */
export function keyForestMatte(data:Uint8ClampedArray){
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
}

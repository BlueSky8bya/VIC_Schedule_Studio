import type {DepthContour} from './terrain-perspective';

/** Approved valley v1 panorama: rock shelves on both banks rise above the
 * receding central channel. Contours follow shelf shoulders and stream bends,
 * independent of summer green/winter snow. This is visual 2D depth, not water flow. */
export const VALLEY_DEPTH_CONTOURS:readonly DepthContour[]=[
  {depth:.14,points:[[0,.39],[.18,.45],[.35,.50],[.50,.55],[.60,.56],[.72,.48],[.86,.39],[1,.35]]},
  {depth:.43,points:[[0,.53],[.18,.56],[.34,.63],[.46,.68],[.54,.66],[.64,.70],[.76,.60],[.88,.53],[1,.48]]},
  {depth:.74,points:[[0,.71],[.18,.74],[.34,.81],[.45,.88],[.56,.85],[.67,.88],[.79,.80],[.90,.74],[1,.68]]},
  {depth:1,points:[[0,1.02],[1,1.02]]},
];

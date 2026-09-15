import type {DepthContour} from './terrain-perspective';
// Low relief: channels are recessed, not a cliff or a bank of grass.
export const TIDAL_DEPTH_CONTOURS:readonly DepthContour[]=[
 {depth:.16,points:[[0,.43],[.25,.44],[.5,.44],[.75,.43],[1,.43]]},
 {depth:.42,points:[[0,.57],[.25,.58],[.45,.61],[.62,.58],[.8,.60],[1,.57]]},
 {depth:.72,points:[[0,.75],[.23,.76],[.44,.80],[.58,.78],[.78,.81],[1,.76]]},
 {depth:1,points:[[0,1.02],[1,1.02]]},
];

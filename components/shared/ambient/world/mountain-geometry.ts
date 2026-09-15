import {contourHeight,type DepthContour} from './terrain-perspective';
// Conservative inner edge traced from mountain-summer-v1; UV moves with terrain.
export const MOUNTAIN_CLIFF = [[0,.64],[.12,.70],[.25,.72],[.39,.78],[.50,.79],[.62,.80],[.72,.85],[.84,.89],[1,.94]] as const;
export const mountainCliff=(u:number)=>contourHeight(MOUNTAIN_CLIFF,u);
export const MOUNTAIN_DEPTH_CONTOURS:readonly DepthContour[]=[
 {depth:.20,points:[[0,.44],[.25,.48],[.50,.55],[.75,.47],[1,.41]]},
 {depth:.55,points:MOUNTAIN_CLIFF},
 {depth:1,points:[[0,1.02],[1,1.02]]},
];
/** Keep the whole sprite over land, dissipating outward momentum before contact. */
export function containCliff(p:{x:number;y:number;vx:number;vy:number},edge:(x:number)=>number,radius:number,dt:number){
 const top=Math.max(edge(p.x-radius),edge(p.x),edge(p.x+radius))+radius;
 const gap=p.y-top;
 if(gap<36&&p.vy<0)p.vy*=Math.exp(-Math.max(0,dt)*12*(1-Math.max(0,gap)/36));
 if(p.y<top){p.y=top;p.vy=Math.max(0,p.vy);}
 return top;
}

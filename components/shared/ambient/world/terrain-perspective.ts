/** A biome's source-space contours represent equal visual distance. They follow
 * its ridges/shore/folds, not horizontal screen rows. No runtime pixel inspection. */
export type DepthContour = { depth:number; points:readonly (readonly [number,number])[] };
const clamp01=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>n*n*(3-2*n);

export function contourHeight(points:DepthContour['points'],u:number){
  const x=clamp01(u);
  for(let i=1;i<points.length;i++)if(x<=points[i][0]){
    const [x0,y0]=points[i-1],[x1,y1]=points[i];
    return y0+(y1-y0)*smooth(clamp01((x-x0)/Math.max(.0001,x1-x0)));
  }
  return points[points.length-1][1];
}

/** 0 = far skyline; 1 = nearest surface. Adjacent contours blend continuously
 * along both axes, so crossing a crest never causes a size/blur step. */
export function terrainDistance(u:number,v:number,skyline:number,contours:readonly DepthContour[]){
  let y0=skyline,d0=0;
  if(v<=y0)return 0;
  for(const band of contours){
    const y1=Math.max(y0+.008,contourHeight(band.points,u));
    if(v<=y1)return d0+(band.depth-d0)*smooth(clamp01((v-y0)/(y1-y0)));
    y0=y1;d0=band.depth;
  }
  return 1;
}

/** Approved hill panorama v2 (all seasons share geographic identity). The
 * near diagonal shoulder descends to the right; the central saddle recedes.
 * Independent from color so snow, shadows and patches cannot invert depth. */
export const HILL_DEPTH_CONTOURS:readonly DepthContour[]=[
  {depth:.14,points:[[0,.40],[.16,.47],[.35,.51],[.55,.49],[.72,.49],[.9,.43],[1,.41]]},
  {depth:.43,points:[[0,.53],[.16,.55],[.35,.61],[.55,.67],[.72,.63],[.9,.55],[1,.52]]},
  {depth:.74,points:[[0,.65],[.2,.69],[.4,.74],[.6,.81],[.8,.88],[1,.94]]},
  {depth:1,points:[[0,1.02],[1,1.02]]},
];

/** Small source-space lookup, built once per accepted terrain. Bilinear sampling
 * replaces contour searches in every particle, pointer and cached-mask pixel. */
export function compileTerrainField(skyline:(u:number)=>number,contours:readonly DepthContour[],cols=257,rows=193){
  const data=new Float32Array(cols*rows);
  for(let x=0;x<cols;x++)for(let y=0;y<rows;y++)data[y*cols+x]=terrainDistance(x/(cols-1),y/(rows-1),skyline(x/(cols-1)),contours);
  return {bytes:data.byteLength,sample(u:number,v:number){
    const xx=clamp01(u)*(cols-1),yy=clamp01(v)*(rows-1),x=Math.floor(xx),y=Math.floor(yy),tx=xx-x,ty=yy-y;
    const x1=Math.min(cols-1,x+1),y1=Math.min(rows-1,y+1);
    return (data[y*cols+x]*(1-tx)+data[y*cols+x1]*tx)*(1-ty)+(data[y1*cols+x]*(1-tx)+data[y1*cols+x1]*tx)*ty;
  }};
}

export const reliefLayerCount=(tier:string)=>tier==='still'?1:tier==='lite'?3:5;
export const reliefMask=(distance:number,layer:number,count:number)=>smooth(clamp01(distance*(count-1)-(layer-1)));
const motion=(d:number)=>.04+.66*smooth(d);
/** Only adjacent masks crossfade; all higher masks are zero. */
export function reliefMotion(distance:number,count:number){
  if(count<=1)return .04;
  const d=clamp01(distance)*(count-1),lo=Math.min(count-2,Math.floor(d)),t=smooth(d-lo);
  return motion(lo/(count-1))*(1-t)+motion((lo+1)/(count-1))*t;
}

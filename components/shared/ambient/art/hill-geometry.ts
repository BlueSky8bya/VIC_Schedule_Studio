/** Source mattes are excluded before any interpolation, never alpha-key snow. */
export function hillCutRows(data: Uint8ClampedArray, width: number, height: number, checker: boolean) {
  const rows = new Uint16Array(width);
  const matte = (x: number, y: number) => {
    const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2];
    return checker ? Math.max(r,g,b)-Math.min(r,g,b)<38 : r-g>32 && b-g>32;
  };
  for(let x=0;x<width;x++){
    let y=0;
    for(;y<height*.56;y++)if(!matte(x,y)&&!matte(x,y+1)&&!matte(x,y+2)&&!matte(x,y+3))break;
    if(y>=height*.56)throw new Error('Invalid hill skyline');
    rows[x]=y+2; // exclude mixed matte edge, not the interior snow/blue ridge
  }
  return rows;
}

/** Reveal the panorama at height-derived scale. Beyond 3:1, uniform cover crop
 * preserves grass proportions; never repeat hills or stretch only one axis. */
export function hillViewport(w:number,h:number,sw:number,sh:number){
  const scale=Math.max(h/sh,w/sw),width=sw*scale,height=sh*scale;
  return {scale,width,height,x:(w-width)/2,y:(h-height)*.42};
}

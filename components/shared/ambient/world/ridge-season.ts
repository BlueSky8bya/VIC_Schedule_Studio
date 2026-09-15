import type {SeasonKey} from '../registry';
import {pondWaterBounds} from './pond-geometry';
const smooth=(v:number)=>{const t=Math.max(0,Math.min(1,v));return t*t*(3-2*t);};
/** Seasonal palette for the distant blue-coded ridge, applied once on decode.
 * Spatial limits follow the silhouette; river/foreground and neutral snow stay intact. */
export function seasonRidge(data:Uint8ClampedArray,w:number,h:number,rows:Uint16Array,season:SeasonKey,biome='hill'){
  const tone:Record<SeasonKey,readonly[number,number,number]>={spring:[.89,1.03,.81],summer:[.76,.99,.87],autumn:[1.22,.93,.69],winter:[.94,.96,1.01]};
  const target=tone[season];
  for(let x=0;x<w;x++)for(let y=rows[x];y<Math.min(h*.53,rows[x]+h*.30);y++){
    const i=(y*w+x)*4;if(!data[i+3])continue;
    const r=data[i],g=data[i+1],b=data[i+2];
    const blue=smooth((Math.min(g,b)-r-4)/10)*(1-smooth((Math.min(r,g,b)-195)/20));
    const shore=biome==='pond'?1-smooth((y/h-(pondWaterBounds(x/Math.max(1,w-1)).far-.025))/.025):1;
    const coverage=(1-smooth(((y-rows[x])/h-.22)/.08))*(1-smooth((y/h-.49)/.04))*blue*shore;
    if(coverage<=0)continue;
    const lum=.2126*r+.7152*g+.0722*b;
    for(let ch=0;ch<3;ch++)data[i+ch]=Math.round(data[i+ch]+(Math.min(255,lum*target[ch])-data[i+ch])*coverage);
  }
}

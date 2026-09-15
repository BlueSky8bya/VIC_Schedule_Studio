/** Stable world-space value noise: no equal mountain tiles or animated randomness. */
function noise(x: number, span: number, salt: number) {
  const i=Math.floor(x/span),t=x/span-i;
  const hash=(n:number)=>{let v=Math.imul(n^salt,0x45d9f3b);v=Math.imul(v^(v>>>16),0x45d9f3b);return ((v^(v>>>16))>>>0)/4294967295;};
  const u=t*t*t*(t*(t*6-15)+10);
  return hash(i)*(1-u)+hash(i+1)*u;
}

/** Unevenly spaced shoulders with mostly straight erosion-like slopes. Unlike
 * smooth value noise, not every control point becomes a rounded dome/flat saddle. */
function relief(x:number,span:number,salt:number){
  const hash=(n:number)=>{let v=Math.imul(n^salt,0x45d9f3b);v=Math.imul(v^(v>>>16),0x45d9f3b);return ((v^(v>>>16))>>>0)/4294967295;};
  const at=(i:number)=>(i+.65*hash(i+917))*span;
  let i=Math.floor(x/span);
  if(x<at(i))i--;
  const t=(x-at(i))/(at(i+1)-at(i));
  const u=.85*t+.15*t*t*(3-2*t);
  return hash(i)*(1-u)+hash(i+1)*u;
}

/** Broad asymmetric summits, subsidiary shoulders and small angular outcrops.
 * Coordinates stay continuous and fixed, without vertical cutout notches. */
export function meadowRidgeTop(worldX: number) {
  return 12+44*relief(worldX,239,173)+13*relief(worldX,83,811)+5*relief(worldX,27,317);
}

/** Keep accepted source colour/texture, discard cutout gaps and edge stair steps.
 * Input is already matte-free. Every output column is opaque, sampled only from
 * valid source pixels; no magenta or inferred painting enters the texture. */
export function ridgeTexture(source: HTMLCanvasElement) {
  const data=source.getContext('2d')!.getImageData(0,0,source.width,source.height).data;
  const c=document.createElement('canvas');c.width=source.width;c.height=64;
  const g=c.getContext('2d')!,out=g.createImageData(c.width,c.height);
  for(let x=0;x<c.width;x++){
    const rows:number[]=[];
    for(let y=0;y<source.height;y++)if(data[(y*source.width+x)*4+3]===255)rows.push(y);
    if(!rows.length)throw new Error('Meadow ridge must cover every source column');
    for(let y=0;y<c.height;y++){
      const from=(rows[Math.min(rows.length-1,Math.floor((y+.5)*rows.length/c.height))]*c.width+x)*4,to=(y*c.width+x)*4;
      out.data[to]=data[from];out.data[to+1]=data[from+1];out.data[to+2]=data[from+2];out.data[to+3]=255;
    }
  }
  g.putImageData(out,0,0);return c;
}

export function paintMeadowRidge(g:CanvasRenderingContext2D,texture:HTMLCanvasElement,width:number,scale:number,viewportWidth:number,k:number){
  const pixel=1/scale;
  for(let i=0;i<Math.ceil(width*scale);i++){
    const x=i*pixel,worldX=x-32-viewportWidth/2;
    const top=meadowRidgeTop(worldX);
    const raw=worldX/(k*.9)+noise(worldX,347,977)*180;
    const stride=texture.width-96,u=((raw%stride)+stride)%stride;
    g.globalAlpha=1;
    g.drawImage(texture,u,0,1,texture.height,x,top,pixel+.01,94-top);
    // Crossfade source colours at wrap; geometry never has a tile boundary.
    if(u<96){const t=u/96;g.globalAlpha=1-t*t*(3-2*t);g.drawImage(texture,u+stride,0,1,texture.height,x,top,pixel+.01,94-top);}
  }
  g.globalAlpha=1;
}

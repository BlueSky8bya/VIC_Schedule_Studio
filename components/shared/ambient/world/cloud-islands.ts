/** Connected alpha islands before blur: bitmap bounds are not cloud size. */
export function detachedCloudIslands(alpha:Uint8ClampedArray,w:number,h:number){
  const seen=new Uint8Array(w*h),queue=new Int32Array(w*h);
  const islands:{pixels:number[];x:number;y:number;w:number;h:number}[]=[];
  for(let start=0;start<w*h;start++){
    if(seen[start]||alpha[start*4+3]<32)continue;
    let head=0,tail=1;queue[0]=start;seen[start]=1;
    let x0=w,y0=h,x1=0,y1=0;const pixels:number[]=[];
    while(head<tail){const i=queue[head++],x=i%w,y=Math.floor(i/w);pixels.push(i);x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy;if(nx<0||nx>=w||ny<0||ny>=h)continue;
        const j=ny*w+nx;if(!seen[j]&&alpha[j*4+3]>0){seen[j]=1;queue[tail++]=j;}
      }
    }
    islands.push({pixels,x:x0,y:y0,w:x1-x0+1,h:y1-y0+1});
  }
  islands.sort((a,b)=>b.pixels.length-a.pixels.length);
  const largest=islands[0]?.pixels.length??0;
  return islands.slice(1).filter(i=>i.pixels.length>=3&&i.pixels.length<largest*.2&&i.w<w*.4).slice(0,24);
}
export function wispLife(width:number,t:number,phase:number,strength:number){
  const period=(5+Math.min(1,width/60)*13)/(.8+strength*.4);
  // One life per transit. Never wrap back to a newly formed cloud.
  const age=Math.max(0,Math.min(1,Math.max(0,t)/period+phase*.2));
  const smooth=(x:number)=>{const v=Math.max(0,Math.min(1,x));return v*v*(3-2*v);};
  return {period,age,alpha:1-smooth((age-.38)/.5),spread:smooth((age-.3)/.65)};
}

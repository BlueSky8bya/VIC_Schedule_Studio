// Read-only pixel geometry measurement. Original generated PNG bytes stay intact.
// RGB delivery mattes are excluded by runtime clip spans, never passed as alpha PNGs.
import fs from 'node:fs';
import sharp from 'sharp';
const root='public/ambient/art';
const season=process.argv.find(a=>a.startsWith('--season='))?.split('=')[1]??'spring';
if(!['spring','summer','autumn','winter'].includes(season))throw Error('Invalid season');
const result={};
for(const layer of ['far','ground','frame']) {
  const version=season==='spring'?(layer==='ground'?5:2):1;
  const {data,info}=await sharp(`${root}/backdrop-meadow-${season}-${layer}-v${version}.png`).removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(info.width!==1536||info.height!==1024)throw Error('Unexpected layer size');
  const terrain=(x,y)=>{const i=(Math.max(0,Math.min(info.height-1,y))*info.width+Math.max(0,Math.min(info.width-1,x)))*3;return data[i+1]>=Math.min(data[i],data[i+2])-6;};
  const spans=[]; let minX=1536,minY=1024,maxX=0,maxY=0,pixels=0;
  if(layer!=='ground') for(let y=0;y<info.height;y++){
    let start=-1;
    for(let x=0;x<=info.width;x++){
      const i=(y*info.width+x)*3;
      // Winter's pale matte mixtures need a two-pixel inset at fractional scales.
      const neighbors=season==='winter'?[-2,-1,0,1,2]:[-1,0,1];
      // Exclude magenta mixtures too, then inset source pixels so scaled
      // clipping cannot sample a neighboring matte pixel at the silhouette.
      const green=x<info.width&&(season==='spring' ? data[i+1]>data[i]+8&&data[i+1]>data[i+2]+16 : neighbors.every(dy=>neighbors.every(dx=>terrain(x+dx,y+dy))));
      if(green&&start<0)start=x;
      if(!green&&start>=0){spans.push([start,y,x-start]);pixels+=x-start;minX=Math.min(minX,start);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y+1);start=-1;}
    }
  }
  if(layer==='far'&&(minX!==0||maxX!==1536||maxY-minY>180))throw Error('Far ridge must span width and stay low');
  if(layer==='frame'&&(minY<850||spans.some(([x,,n])=>x<1100&&x+n>440)))throw Error('Foreground must leave center and upper field empty');
  result[layer]={width:info.width,height:info.height,spans,bounds:layer==='ground'?[0,0,1536,1024]:[minX,minY,maxX,maxY]};
  console.log(layer,JSON.stringify({hasAlpha:info.channels===4,bounds:result[layer].bounds,spans:spans.length,pixels}));
}
const target=`components/shared/ambient/art/meadow-${season==='spring'?'layer':season+'-layer'}-geometry.json`;
if(process.argv.includes('--write'))fs.writeFileSync(target,JSON.stringify(result)+'\n');
else if(JSON.stringify(JSON.parse(fs.readFileSync(target)))!==JSON.stringify(result))throw Error('Geometry drift');

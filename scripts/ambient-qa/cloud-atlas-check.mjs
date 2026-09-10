// Inspect exact generated pixels against extraction metadata; never edit art.
import fs from 'node:fs';
import sharp from 'sharp';
const layout=JSON.parse(fs.readFileSync('components/shared/ambient/art/cloud-atlas-layout.json','utf8'));
const {data:d,info}=await sharp(`public${layout.src}`).raw().toBuffer({resolveWithObject:true});
if(info.width!==layout.width||info.height!==layout.height)throw Error('Unexpected atlas dimensions');
const rows=[],cells=new Set();
for(const [genus,variants] of Object.entries(layout.sprites))for(const [variant,sprite] of variants.entries()){
 const [left,top,w,h]=sprite.region,right=left+w,bottom=top+h;
 let x0=right,y0=bottom,x1=0,y1=0,count=0;
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
  const i=(y*info.width+x)*info.channels;if(d[i+1]<Math.min(d[i],d[i+2])-8)continue;
  count++;x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x+1);y1=Math.max(y1,y+1);
 }
 const margin=Math.min(x0-left,y0-top,right-x1,bottom-y1),bounds=[x0,y0,x1-x0,y1-y0];
 if(count<20||margin<5)throw Error(`${genus}:${variant} clipped or empty: count ${count}, margin ${margin}`);
 if(JSON.stringify(bounds)!==JSON.stringify(sprite.bounds))throw Error(`${genus}:${variant} bounds drift`);
 if(cells.has(String(sprite.cell)))throw Error('Duplicate source form');cells.add(String(sprite.cell));
 rows.push({genus,variant,cell:sprite.cell,bounds,count,margin});
}
if(rows.length!==30||Object.keys(layout.sprites).length!==10)throw Error('Incomplete genus selection');
fs.mkdirSync('.scratch-pw/qa/r26',{recursive:true});fs.writeFileSync('.scratch-pw/qa/r26/atlas-layout.json',JSON.stringify(rows,null,2));
console.log(`PASS ${rows.length} unique nonempty forms with measured bounds and blank gutters`);

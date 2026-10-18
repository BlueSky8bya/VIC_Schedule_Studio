import fs from 'node:fs/promises';
import sharp from 'sharp';
import crypto from 'node:crypto';
const run='art-src/빅타민/동행/작업회차/20261018-동작연결정리115';
await fs.mkdir('.scratch-pw/companion-115/motion',{recursive:true});
const metadata=JSON.parse(await fs.readFile('lib/ui/viewer-companion/hd-motion-sprite.json'));
const cache=new Map(),frames=[],inputs=[];
for(const[n,index]of [...metadata.rows[1],...metadata.rows[9]].entries()){
 const frame=metadata.frames[index],atlas=metadata.atlases[frame.atlas];
 if(!cache.has(atlas.src))cache.set(atlas.src,await sharp('public'+atlas.src).ensureAlpha().raw().toBuffer({resolveWithObject:true}));
 const {data,info}=cache.get(atlas.src),ox=frame.index%8*192,oy=Math.floor(frame.index/8)*192;
 inputs.push({input:await sharp(data,{raw:info}).extract({left:ox,top:oy,width:192,height:192}).png().toBuffer(),left:n%8*210,top:Math.floor(n/8)*220});
 inputs.push({input:Buffer.from(`<svg width="210" height="25"><text x="100" y="18" text-anchor="middle">${index}</text></svg>`),left:n%8*210,top:Math.floor(n/8)*220+193});
 const dark=(x,y)=>{const p=((oy+y)*info.width+ox+x)*4;return data[p+3]>200&&data[p]<240&&data[p+1]<170&&data[p+2]<150;};
 const seen=new Set(),parts=[];
 const roi=index<144?{left:94,top:127,right:111,bottom:136}:{left:101,top:130,right:115,bottom:139};
 for(let y=roi.top;y<roi.bottom;y++)for(let x=roi.left;x<roi.right;x++){
  const k=y*192+x;if(seen.has(k)||!dark(x,y))continue;
  const queue=[[x,y]],pixels=[];seen.add(k);
  while(queue.length){const[xx,yy]=queue.pop();pixels.push([xx,yy]);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=xx+dx,ny=yy+dy,key=ny*192+nx;if(nx>=roi.left&&nx<roi.right&&ny>=roi.top&&ny<roi.bottom&&!seen.has(key)&&dark(nx,ny)){seen.add(key);queue.push([nx,ny]);}}}
  const xs=pixels.map(p=>p[0]),ys=pixels.map(p=>p[1]);parts.push({pixels:pixels.length,left:Math.min(...xs),right:Math.max(...xs)+1,top:Math.min(...ys),bottom:Math.max(...ys)+1});
 }
 frames.push({index,src:atlas.src,sha256:atlas.sha256,frame,parts,roi});
}
await sharp({create:{width:1680,height:880,channels:4,background:'#efede8'}}).composite(inputs).png().toFile('.scratch-pw/companion-115/motion/mouth-32-cells.png');
await fs.writeFile('.scratch-pw/companion-115/motion/mouth-components.json',JSON.stringify(frames,null,2));
console.log(JSON.stringify(frames.map(({index,parts})=>({index,parts}))));
if(process.argv.includes('--apply')){
 const atlases=[...new Set(frames.map(frame=>frame.src))].map(src=>({src,sha256:frames.find(frame=>frame.src===src).sha256}));
 const measured=frames.map(frame=>{
  const candidates=frame.parts.filter(p=>p.pixels>=2);
  if(!candidates.length)throw Error(`Missing authored mouth ${frame.index}`);
  const p={left:Math.min(...candidates.map(p=>p.left)),right:Math.max(...candidates.map(p=>p.right)),top:Math.min(...candidates.map(p=>p.top)),bottom:Math.max(...candidates.map(p=>p.bottom)),pixels:candidates.reduce((n,p)=>n+p.pixels,0)},x=(p.left+p.right)/2,y=(p.top+p.bottom)/2;
  return{index:frame.index,atlas:atlases.findIndex(a=>a.src===frame.src),cell:frame.frame.index,x,y,bounds:[p.left,p.top,p.right,p.bottom],component:p,logicalAfterRegistration:{x:x/192*80+frame.frame.x,y:y/192*80+frame.frame.y}};
 });
 const evidence={version:1,method:'Actual115 output32-cell contact visually inspected. Entire authored small central mouth ink union in separate inspected look/happy ROI, including lighter orange smile. Technical registration only; no source pixel changes, independent art review or owner approval.',cell:192,roiByAction:{look:{left:94,top:127,right:111,bottom:136},happy:{left:101,top:130,right:115,bottom:139}},darkPixel:{alphaGreaterThan:200,redLessThan:240,greenLessThan:170,blueLessThan:150},packingReceipt:`${run}/패킹파생기록.json`,contactSheet:`${run}/정리본/검토/식사32키.png`,atlases,frames:measured};
 await fs.writeFile(`${run}/식사입계측.json`,JSON.stringify(evidence,null,2)+'\n');
 await fs.copyFile('.scratch-pw/companion-115/motion/mouth-32-cells.png',`${run}/정리본/검토/식사32키.png`);
 await fs.writeFile('lib/ui/viewer-companion/mouth-anchors.json',JSON.stringify({version:1,cell:192,evidence:`${run}/식사입계측.json`,atlases,frames:measured.map(({index,atlas,cell,x,y,bounds})=>({index,atlas,cell,x,y,bounds}))},null,2)+'\n');
 console.log(JSON.stringify({applied:true,registered:measured.length,sha256:crypto.createHash('sha256').update(await fs.readFile('lib/ui/viewer-companion/mouth-anchors.json')).digest('hex')}));
}

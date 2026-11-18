import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { bakeEyeStyleKey, prepareFamilyKey } from '../prepare-companion-eye-style.mjs';

const size=192, count=size*size;
function mainComponent(key) {
  const seen=new Uint8Array(key.width*key.height);let largest=[];
  for(let i=0;i<seen.length;i++)if(!seen[i]&&key.rgba[i*4+3]>=64){const queue=[i];seen[i]=1;
    for(let q=0;q<queue.length;q++){const x=queue[q]%key.width,y=Math.floor(queue[q]/key.width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const xx=x+dx,yy=y+dy,j=yy*key.width+xx;if(xx>=0&&yy>=0&&xx<key.width&&yy<key.height&&!seen[j]&&key.rgba[j*4+3]>=64){seen[j]=1;queue.push(j);}}}
    if(queue.length>largest.length)largest=queue;
  }
  const labels=new Uint8Array(seen.length);for(const i of largest)labels[i]=1;return labels;
}

/** Offline only. Measure body alpha excluding the four native ear regions and
 * detached marks, then normalize repetitions of that SAME native drawing.
 * Different source poses/perspective never share a target area. */
export async function prepareMaterialSources(metadata,receipt,keys,nativeOwners) {
  const main=keys.map(mainComponent), bases=new Map();
  for(let atlas=0;atlas<metadata.atlases.length;atlas++){
    const source=metadata.atlases[atlas],bytes=await fs.readFile('public'+source.src);
    if(createHash('sha256').update(bytes).digest('hex')!==source.sha256)throw Error('Immutable input changed: '+source.src);
    const raw=await sharp(bytes).ensureAlpha().raw().toBuffer();
    for(let id=0;id<metadata.frames.length;id++){const frame=metadata.frames[id];if(frame.atlas!==atlas)continue;
      const slot=receipt.slots[id],key=keys[slot.nativeCell],owners=new Uint8Array(count),body=new Uint8Array(count),data=Buffer.alloc(count*4);
      const sample=(x,y,px,py)=>{const ix=Math.max(0,Math.min(key.width-1,Math.round(px))),iy=Math.max(0,Math.min(key.height-1,Math.round(py))),j=iy*key.width+ix;
        owners[y*size+x]=nativeOwners[slot.nativeCell][j];body[y*size+x]=main[slot.nativeCell][j];};
      if(slot.rig)bakeEyeStyleKey(key,slot.rig,slot.fit.scale,slot.fit.offset,sample);else await prepareFamilyKey(key,slot.fit,sample);
      const ox=frame.index%8*size,oy=Math.floor(frame.index/8)*size;
      for(let y=0;y<size;y++)raw.copy(data,y*size*4,((oy+y)*1536+ox)*4,((oy+y)*1536+ox+size)*4);
      let area=0;for(let i=0;i<count;i++)if(body[i]&&!owners[i])area+=data[i*4+3]/255;
      bases.set(id,{data,owners,body,area,slot});
    }
  }
  const references=new Map();for(const [id,base]of bases){const old=references.get(base.slot.nativeCell);if(old===undefined||bases.get(old).slot.rig&&!base.slot.rig)references.set(base.slot.nativeCell,id);}
  for(const [id,base]of bases){const reference=references.get(base.slot.nativeCell),targetArea=bases.get(reference).area,scale=Math.sqrt(targetArea/base.area);
    const pivot={x:(base.slot.body.left+base.slot.body.right)/2/2.4,y:base.slot.body.bottom/2.4};
    const data=Buffer.alloc(count*4),owners=new Uint8Array(count),body=new Uint8Array(count);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const px=(x+.5-pivot.x*2.4)/scale+pivot.x*2.4-.5,py=(y+.5-pivot.y*2.4)/scale+pivot.y*2.4-.5;
      const ix=Math.floor(px),iy=Math.floor(py);if(ix<0||iy<0||ix>=size-1||iy>=size-1)continue;
      const fx=px-ix,fy=py-iy,at=[iy*size+ix,iy*size+ix+1,(iy+1)*size+ix,(iy+1)*size+ix+1],weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];
      let alpha=0;const rgb=[0,0,0];for(let k=0;k<4;k++){const a=base.data[at[k]*4+3]*weights[k];alpha+=a;for(let c=0;c<3;c++)rgb[c]+=base.data[at[k]*4+c]*a;}
      const i=y*size+x;if(alpha){for(let c=0;c<3;c++)data[i*4+c]=Math.round(rgb[c]/alpha);data[i*4+3]=Math.round(alpha);}
      const nearest=Math.round(py)*size+Math.round(px);owners[i]=base.owners[nearest];body[i]=base.body[nearest];
    }
    let measured=0;for(let i=0;i<count;i++)if(body[i]&&!owners[i])measured+=data[i*4+3]/255;
    bases.set(id,{...base,data,owners,body,material:{scale,pivot,reference,sourceArea:base.area,targetArea,measuredArea:measured}});
  }
  return bases;
}

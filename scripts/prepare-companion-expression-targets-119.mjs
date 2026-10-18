import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
const run='art-src/빅타민/동행/작업회차/20261019-표정체적교정119';
const check=process.argv.includes('--check');
if(process.argv.slice(2).some(arg=>arg!=='--check'))throw Error('Usage: --check');
const repoPath=p=>p.replaceAll('\\','/').replace(/^C:\/Projects\/VIC Schedule studio\//i,'');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const emit=async(p,b)=>{if(check){if(!(await fs.readFile(p)).equals(b))throw Error(`Derived output differs: ${p}`);}else await fs.writeFile(p,b);};
const mapping=JSON.parse(await fs.readFile(`${run}/원화배치계보.json`,'utf8')).mapping;
const nativeRaw=`${run}/원본/표정체적6키_생성원본.png`;
if(hash(await fs.readFile(nativeRaw))!=='ec389e3364a77ddb4f6999a8b94087544b9543a731d0b4af04947f84ed638682')throw Error('Wrong single generated119 native');
const all=await sharp(nativeRaw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const fullMask=await sharp(`${run}/고정입력/검수반영_최종편집영역.png`).greyscale().raw().toBuffer();
function parts(data,w,h,accept){
 const seen=new Uint8Array(w*h),out=[];
 for(let s=0;s<w*h;s++){
  if(seen[s]||!accept(data,s*4))continue;
  const q=[s];seen[s]=1;let at=0,l=w,t=h,r=0,b=0,sx=0,sy=0;
  while(at<q.length){const p=q[at++],x=p%w,y=Math.floor(p/w);l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x+1);b=Math.max(b,y+1);sx+=x+.5;sy+=y+.5;
   for(let yy=Math.max(0,y-1);yy<=Math.min(h-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(w-1,x+1);xx++){const n=yy*w+xx;if(!seen[n]&&accept(data,n*4)){seen[n]=1;q.push(n);}}
  }
  out.push({count:q.length,center:[sx/q.length,sy/q.length],box:[l,t,r,b],pixels:q});
 }return out;
}
function cheeks(data,w,h,body67=false){
 const c=parts(data,w,h,(d,p)=>d[p+3]>150&&d[p]>200&&d[p+1]>85&&d[p+1]<195&&d[p]-d[p+1]>45&&d[p+1]-d[p+2]>15&&d[p+2]<165).filter(p=>p.count>w*h*(w>200||body67?.001:.003)&&p.box[2]-p.box[0]<w*.22&&p.box[3]-p.box[1]<h*.23&&p.center[1]>h*.42&&p.center[1]<h*.74&&(!body67||p.center[0]>w*.35));
 let best;
 for(const a of c)for(const b of c){if(a.center[0]>=b.center[0])continue;const span=b.center[0]-a.center[0];if(span<w*.22||span>w*.65||Math.abs(a.center[1]-b.center[1])>h*.13)continue;
  if(w>200&&(a.center[0]<w*.3||b.center[0]>w*.85))continue;
  if([a,b].some(p=>(p.box[2]-p.box[0])/(p.box[3]-p.box[1])<.6||(p.box[2]-p.box[0])/(p.box[3]-p.box[1])>1.7))continue;
  const score=Math.abs(a.count-b.count)/Math.max(a.count,b.count)+Math.abs((a.center[0]+b.center[0])/2-w*.52)/w+Math.abs((a.center[1]+b.center[1])/2-h*.65)/h;
  if(!best||score<best.score)best={score,a,b};
 }if(!best)throw Error(`No two measured cheeks in ${w}x${h}`);return [best.a,best.b];
}
function eyes(data,w,h,pair){
 const [a,b]=pair,dx=b.center[0]-a.center[0],dy=b.center[1]-a.center[1],span=Math.hypot(dx,dy),axis=[dx/span,dy/span],normal=[-axis[1],axis[0]];
 const targets=[a,b].map((p,i)=>[p.center[0]+axis[0]*span*(i?-.2:.2)-normal[0]*span*.13,p.center[1]+axis[1]*span*(i?-.2:.2)-normal[1]*span*.13]);
 const c=parts(data,w,h,(d,p)=>d[p+3]>150&&d[p]<150&&d[p+1]<125&&d[p+2]<105).filter(p=>p.count>=3&&p.box[2]-p.box[0]<w*.22&&p.box[3]-p.box[1]<h*.19);
 const found=targets.map(target=>c.reduce((best,p)=>Math.hypot(p.center[0]-target[0],p.center[1]-target[1])<(best?.d??Infinity)?{p,d:Math.hypot(p.center[0]-target[0],p.center[1]-target[1])}:best,undefined));
 if(found.some(x=>!x||x.d>span*.38)||found[0].p===found[1].p)throw Error('Uncertain two eye components '+JSON.stringify({w,h,pair,targets,c,found}));return found.map(x=>x.p);
}
function register(data,w,h,targetW,targetH,sourcePair,targetPair){
 const [s0,s1]=sourcePair.map(p=>p.center),[t0,t1]=targetPair.map(p=>p.center),sv=[s1[0]-s0[0],s1[1]-s0[1]],tv=[t1[0]-t0[0],t1[1]-t0[1]];
 const scale=Math.hypot(...tv)/Math.hypot(...sv),angle=Math.atan2(tv[1],tv[0])-Math.atan2(sv[1],sv[0]),a=Math.cos(angle)*scale,b=Math.sin(angle)*scale;
 const out=Buffer.alloc(targetW*targetH*4);
 for(let y=0;y<targetH;y++)for(let x=0;x<targetW;x++){
  const vx=x+.5-t0[0],vy=y+.5-t0[1],px=(a*vx+b*vy)/(scale*scale)+s0[0]-.5,py=(-b*vx+a*vy)/(scale*scale)+s0[1]-.5,ix=Math.floor(px),iy=Math.floor(py),fx=px-ix,fy=py-iy,p=(y*targetW+x)*4;
  let alpha=0;const rgb=[0,0,0];
  for(let yy=0;yy<2;yy++)for(let xx=0;xx<2;xx++){const sx=ix+xx,sy=iy+yy;if(sx<0||sy<0||sx>=w||sy>=h)continue;const q=(sy*w+sx)*4,g=(xx?fx:1-fx)*(yy?fy:1-fy),aa=data[q+3]/255*g;alpha+=aa;for(let c=0;c<3;c++)rgb[c]+=data[q+c]*aa;}
  for(let c=0;c<3;c++)out[p+c]=alpha?Math.round(rgb[c]/alpha):0;out[p+3]=Math.round(alpha*255);
 }return {data:out,transform:{scale,angle,sourceCheeks:sourcePair.map(p=>p.center),targetCheeks:targetPair.map(p=>p.center),kind:'uniform_similarity_no_nonuniform_face_warp'}};
}
const records=[],beforeInputs=[],afterInputs=[];
for(const m of mapping){
 const [width,height]=m.crop_size,parentPath=repoPath(m.crop_path),parentPng=await fs.readFile(parentPath),parent=await sharp(parentPng).ensureAlpha().raw().toBuffer();
 const tileW=all.info.width/3,tileH=all.info.height/2;
 const provider=await sharp(all.data,{raw:all.info}).extract({left:m.grid_col*tileW,top:m.grid_row*tileH,width:tileW,height:tileH}).raw().toBuffer();
 const targetPair=cheeks(parent,width,height,m.native===67),sourcePair=cheeks(provider,tileW,tileH),registered=register(provider,tileW,tileH,width,height,sourcePair,targetPair);
 if(m.native===67){
  // Match the generated paper body's lateral footprint to the original
  // character while keeping the parent face/ears outside the adoption mask.
  // This is uniform body-only registration, never a whole-sprite stretch.
  const centre=targetPair[0].center.map((v,i)=>(v+targetPair[1].center[i])/2);
  const expanded=targetPair.map(p=>({...p,center:p.center.map((v,i)=>centre[i]+(v-centre[i])*1.1)}));
  const bodyRegistered=register(registered.data,width,height,width,height,targetPair,expanded);
  registered.data=bodyRegistered.data;registered.transform.bodyOnlyUniformFit={scale:1.1,origin:centre,faceAndEarsRemainParentPixels:true};
 }
 const candidate=Buffer.from(parent),effective=Buffer.alloc(width*height),faceBoxes=[],mouthProtected=new Uint8Array(width*height);
 if(m.kind==='face'){
  const oldEyes=eyes(parent,width,height,targetPair),newEyes=eyes(registered.data,width,height,targetPair);
  const mouthTarget=targetPair[0].center.map((v,i)=>(v+targetPair[1].center[i])/2);
  const mouths=parts(parent,width,height,(d,p)=>d[p+3]>150&&(d[p]<150&&d[p+1]<125&&d[p+2]<105||d[p]>150&&d[p+1]<170&&d[p]-d[p+1]>40&&d[p+2]<140)).filter(p=>p.count>=2&&p.count<200&&p.box[2]-p.box[0]<20&&p.box[3]-p.box[1]<20);
  const mouth=mouths.sort((a,b)=>Math.hypot(a.center[0]-mouthTarget[0],a.center[1]-mouthTarget[1])-Math.hypot(b.center[0]-mouthTarget[0],b.center[1]-mouthTarget[1]))[0];
  if(!mouth||Math.hypot(mouth.center[0]-mouthTarget[0],mouth.center[1]-mouthTarget[1])>8)throw Error(`Uncertain original mouth ${m.native}`);
  for(const p of mouth.pixels){const x=p%width,y=Math.floor(p/width);for(let yy=Math.max(0,y-1);yy<=Math.min(height-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(width-1,x+1);xx++)mouthProtected[yy*width+xx]=1;}
  for(let i=0;i<2;i++){const boxes=[oldEyes[i].box,newEyes[i].box];let l=Math.max(0,Math.min(...boxes.map(b=>b[0]))-3),t=Math.max(0,Math.min(...boxes.map(b=>b[1]))-3),r=Math.min(width,Math.max(...boxes.map(b=>b[2]))+3),b=Math.min(height,Math.max(...boxes.map(b=>b[3]))+3);if(m.native===10&&i===0){l=Math.min(l,43);t=Math.min(t,55);r=Math.max(r,50);b=Math.max(b,62);}faceBoxes.push([l,t,r,b]);}
 }else{
  // Keep only the generated paper body and its immediate dark contour, not
  // the provider's low-alpha background glow. No replacement art is painted.
  const core=new Uint8Array(width*height),dilated=new Uint8Array(width*height);
  for(let p=0;p<core.length;p++){const q=p*4;core[p]=registered.data[q+3]>150&&registered.data[q]>170&&registered.data[q+1]>110?1:0;}
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(core[y*width+x])for(let yy=Math.max(0,y-2);yy<=Math.min(height-1,y+2);yy++)for(let xx=Math.max(0,x-2);xx<=Math.min(width-1,x+2);xx++)dilated[yy*width+xx]=1;
  for(let p=0;p<core.length;p++)if(!dilated[p]||registered.data[p*4+3]<150)registered.data[p*4+3]=0;
 }
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const mask=fullMask[(m.sheet_native_offset[1]+y)*432+m.sheet_native_offset[0]+x];if(!mask||mouthProtected[y*width+x])continue;
  let gain=1;
  if(m.kind==='face'){
   const box=faceBoxes.find(([l,t,r,b])=>x>=l&&x<r&&y>=t&&y<b);if(!box)continue;const[l,t,r,b]=box;gain=Math.min(1,(x-l)/2,(r-1-x)/2,(y-t)/2,(b-1-y)/2);if(gain<=0)continue;
  }else{
   // Upper join fades within the body-only mask; the silhouette below it
   // follows the generated body instead of retaining old hanging scraps.
   gain=Math.min(1,(y-64)/6);if(gain<=0)continue;
  }
  const p=(y*width+x)*4;
  if(m.kind==='face'){for(let c=0;c<3;c++)candidate[p+c]=Math.round(parent[p+c]*(1-gain)+registered.data[p+c]*gain);}
  else{const oldA=parent[p+3]/255,newA=registered.data[p+3]/255,alpha=oldA*(1-gain)+newA*gain;for(let c=0;c<3;c++)candidate[p+c]=alpha?Math.round((parent[p+c]*oldA*(1-gain)+registered.data[p+c]*newA*gain)/alpha):parent[p+c];candidate[p+3]=Math.round(alpha*255);}
  effective[y*width+x]=255;
 }
 let changed=0;for(let p=0;p<width*height;p++)if(!candidate.subarray(p*4,p*4+4).equals(parent.subarray(p*4,p*4+4)))changed++;
 const correctedPath=`${run}/정리본/빅타민_119_키${m.native}.png`,maskPath=`${run}/정리본/키${m.native}_실효편집영역.png`;
 await emit(correctedPath,await sharp(candidate,{raw:{width,height,channels:4}}).png().toBuffer());await emit(maskPath,await sharp(effective,{raw:{width,height,channels:1}}).png().toBuffer());
 const physicalIndices=m.native===1?[9,10]:m.native===64?[356,357,358,359]:m.native===65?[360,361,362,363]:m.native===73?[514]:m.native===67?[496,497,498,499]:[266];
 records.push({nativeCell:m.native,parentPath,parentSha256:hash(parentPng),correctedPath,correctedSha256:hash(await fs.readFile(correctedPath)),maskPath,maskSha256:hash(await fs.readFile(maskPath)),width,height,physicalIndices,sourceChangedPixels:changed,faceBoxes,protectedMouthPixels:mouthProtected.reduce((n,v)=>n+v,0),registration:registered.transform,alphaPreserved:m.kind==='face',providerGlowNotAdopted:true});
 beforeInputs.push({input:parentPng,left:m.sheet_native_offset[0],top:m.sheet_native_offset[1]});afterInputs.push({input:await fs.readFile(correctedPath),left:m.sheet_native_offset[0],top:m.sheet_native_offset[1]});
}
for(const[name,inputs]of[['before',beforeInputs],['after',afterInputs]]){
 // Copy RGBA rows directly. Alpha compositing onto transparent black would
 // round partially transparent edge RGB and change protected source pixels.
 const sheet=Buffer.alloc(432*288*4);
 for(const{input,left,top}of inputs){
  const decoded=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let y=0;y<decoded.info.height;y++)decoded.data.copy(sheet,((top+y)*432+left)*4,y*decoded.info.width*4,(y+1)*decoded.info.width*4);
 }
 await emit(`${run}/정리본/${name==='after'?'빅타민_표정체적119':'교정부모_보존'}.png`,await sharp(sheet,{raw:{width:432,height:288,channels:4}}).png().toBuffer());
}
await emit(`${run}/합성파생기록.json`,Buffer.from(JSON.stringify({version:1,generationCalls:1,nativeRaw,rawSha256:hash(await fs.readFile(nativeRaw)),independentArtReviews:2,postGenerationArtReviews:0,ownerApproval:false,keys:records},null,2)+'\n'));
console.log(JSON.stringify({check,keys:records.map(r=>({native:r.nativeCell,changed:r.sourceChangedPixels})),generationCalls:1}));

//118 replaces only the source-bound yawn face. Keep every other displayed
// pixel, silhouette, runtime registration, curated clip and117 jump packet.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { bakeEyeStyleKey } from './prepare-companion-eye-style.mjs';
import { clearCompanionExportResidue115 } from './prepare-companion-motion-115.mjs';
import { assertCompanionMetadataOwnership } from './prepare-companion-jump-tuft-117.mjs';

const run='art-src/빅타민/동행/작업회차/20261019-얼굴정렬교정118';
const prior='art-src/빅타민/동행/작업회차/20261018-동작연결정리115';
const check=process.argv.includes('--check');
const artifactsOnly=process.argv.includes('--artifacts-only');
if(artifactsOnly&&!check)throw Error('--artifacts-only requires --check');
if(process.argv.slice(2).some(arg=>!['--check','--artifacts-only'].includes(arg)))throw Error('Usage: --check [--artifacts-only]');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const proof=await read(`${prior}/패킹파생기록.json`),key=proof.keys[10],slot=proof.slots[266];
const meta=await read(`${run}/고정입력/hd-motion-sprite.json`);
const frozenParentMetadata=structuredClone(meta);
if(slot.nativeCell!==10||slot.frame.atlas!==16||slot.frame.index!==10)throw Error('Wrong source-bound yawn');
const parentPng=await fs.readFile(`${run}/고정입력/하품키11_원본RGBA.png`);
const parentRaw=await sharp(parentPng).ensureAlpha().raw().toBuffer();
if(hash(parentRaw)!==key.originalCropRgbaSha256)throw Error('Immutable parent key changed');
const composite=await read(`${run}/합성범위.json`);
const nativeBytes=await fs.readFile(composite.nativeRaw);
if(hash(nativeBytes)!==composite.rawSha256||composite.generationCalls!==1)throw Error('Unbound generated native');
const maskBytes=await fs.readFile(composite.mask);
if(hash(maskBytes)!==composite.maskSha256)throw Error('Explicit face mask changed');
const mask=await sharp(maskBytes).greyscale().raw().toBuffer();
const correctedPng=await fs.readFile(composite.correctedKey);
const correctedRaw=await sharp(correctedPng).ensureAlpha().raw().toBuffer();
if(correctedRaw.length!==parentRaw.length)throw Error('Parent canvas changed');
// Reproduce the masked derivative from the one preserved provider result.
// No painted fallback or unrecorded replacement may enter the corrected key.
const {l:gl,t:gt,r:gr,b:gb}=composite.generatorOpaqueBounds;
const normalized=await sharp(nativeBytes).extract({left:gl,top:gt,width:gr-gl,height:gb-gt}).resize(102,94).extend({left:3,right:3,top:3,bottom:3,background:'#0000'}).ensureAlpha().raw().toBuffer();
const faceRegistered=await sharp(normalized,{raw:{width:108,height:100,channels:4}}).resize(130,100,{fit:'fill'}).extract({left:10,top:0,width:108,height:100}).raw().toBuffer();
const reproduced=Buffer.from(parentRaw);
for(let y=0;y<100;y++)for(let x=0;x<108;x++){
 const gain=Math.min(mask[y*108+x]/255,(x-43)/3,(86-x)/3,(y-49)/3,(74-y)/4);
 if(gain<=0)continue;const p=(y*108+x)*4;
 for(let c=0;c<3;c++)reproduced[p+c]=Math.round(parentRaw[p+c]*(1-gain)+faceRegistered[p+c]*gain);
}
if(!reproduced.equals(correctedRaw))throw Error('Corrected key differs from recorded masked generation derivative');
let sourceChangedPixels=0,sourceChangedChannels=0;
for(let y=0;y<100;y++)for(let x=0;x<108;x++){
 const p=(y*108+x)*4;
 if(parentRaw[p+3]!==correctedRaw[p+3])throw Error('Source silhouette/alpha changed');
 if(parentRaw.subarray(p,p+4).equals(correctedRaw.subarray(p,p+4)))continue;
 const cheek=composite.protectedCheekBoxes.some(([l,t,r,b])=>x>=l&&x<r&&y>=t&&y<b);
 if(!mask[y*108+x]||x<43||x>=86||y<49||y>=74||cheek)throw Error('Correction escaped requested eyes/mouth');
 sourceChangedPixels++;for(let c=0;c<4;c++)if(parentRaw[p+c]!==correctedRaw[p+c])sourceChangedChannels++;
}
if(!sourceChangedPixels)throw Error('No facial correction');
const parent=clearCompanionExportResidue115(parentRaw).rgba,corrected=clearCompanionExportResidue115(correctedRaw).rgba;
const body={...key.body,left:key.body.left-key.box.left,right:key.body.right-key.box.left,top:key.body.top-key.box.top,bottom:key.body.bottom-key.box.top};
let left=108,top=100,right=0,bottom=0;
for(let y=0;y<100;y++)for(let x=0;x<108;x++)if(parent[(y*108+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
const featureBounds={left:body.left+body.width*.2,right:body.right-body.width*.15,top:body.top+body.height*.35,bottom:body.bottom-body.height*.1};
const shape={width:108,height:100,body,alpha:{left,top,right,bottom,width:right-left,height:bottom-top},face:{featureBounds,protected:{left:featureBounds.left-5,right:featureBounds.right+5,top:featureBounds.top-5,bottom:featureBounds.bottom+5},fade:2}};
const original=meta.atlases[16],oldBytes=await fs.readFile(`public${original.src}`);
if(hash(oldBytes)!==original.sha256)throw Error('Parent packet changed');
const decoded=await sharp(oldBytes).ensureAlpha().raw().toBuffer(),output=Buffer.from(decoded);
const before=bakeEyeStyleKey({...shape,rgba:parent},slot.rig,slot.fit.scale,slot.fit.offset).data;
if(hash(before)!==slot.rgbaSha256)throw Error('Parent yawn rig cannot be reproduced');
const after=bakeEyeStyleKey({...shape,rgba:corrected},slot.rig,slot.fit.scale,slot.fit.offset).data;
let changedPixels=0,l=192,t=192,r=0,b=0;
for(let y=0;y<192;y++)for(let x=0;x<192;x++){
 const p=(y*192+x)*4;if(before.subarray(p,p+4).equals(after.subarray(p,p+4)))continue;
 if(before[p+3]!==after[p+3])throw Error('Runtime yawn alpha changed');
 if(!before[p+3])continue;
 const target=((192+y)*1536+384+x)*4;
 after.copy(output,target,p,p+4);changedPixels++;l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);
}
const bytes=await sharp(output,{raw:{width:1536,height:384,channels:4}}).webp({lossless:true,effort:6}).toBuffer();
const roundtrip=await sharp(bytes).ensureAlpha().raw().toBuffer();let invisibleRgbChannelsNormalized=0,decodedChangedVisiblePixels=0;
for(let p=0;p<output.length;p+=4){
 if(roundtrip[p+3]!==output[p+3])throw Error('Lossless packet alpha changed');
 for(let c=0;c<3;c++)if(roundtrip[p+c]!==output[p+c]){
  if(output[p+3])throw Error('Lossless visible RGB changed');invisibleRgbChannelsNormalized++;
 }
 if(roundtrip[p+3]&&[0,1,2].some(c=>roundtrip[p+c]!==decoded[p+c]))decodedChangedVisiblePixels++;
}
const packet={src:'/companion/hd/vitamin-action-16-face-118-v1.webp',sha256:hash(bytes),bytes:bytes.length,width:1536,height:384};
meta.atlases[16]=packet;
const receipt={version:1,generationCalls:1,independentArtReviews:1,postGenerationArtReviews:0,ownerApproval:false,parentNative:proof.native,parentPacket:original,generatedNative:{path:composite.nativeRaw,sha256:hash(nativeBytes)},correctedKey:{path:composite.correctedKey,sha256:hash(correctedPng)},scope:composite.effectiveContext,maskedGenerationDerivativeReproduced:true,sourceChangedPixels,sourceChangedChannels,packet,physicalIndex:266,parentFrame:slot.frame,changedPixels,decodedChangedVisiblePixels,changedBounds:{left:l,top:t,right:r,bottom:b},unchangedVisibleDecodedPixelsAndAlphaPreserved:true,invisibleRgbChannelsNormalized,allRuntimeRegistrationPreserved:true,allOther519FramesPreserved:true,prior117PacketPreserved:meta.atlases[4]};
// Check ownership before writing even the packet: later unrelated atlas
// changes require their own run rather than a frozen metadata rollback.
if(!check)assertCompanionMetadataOwnership(await read('lib/ui/viewer-companion/hd-motion-sprite.json'),frozenParentMetadata,meta);
for(const[p,data]of[[`public${packet.src}`,bytes],['lib/ui/viewer-companion/hd-motion-sprite.json',json(meta)],[`${run}/정리본/hd-motion-sprite.json`,json(meta)],[`${run}/패킹파생기록.json`,json(receipt)]]){
 // Historical118 artifacts remain reproducible after a later scoped repair.
 // Only the active global metadata comparison belongs to that later run.
 if(artifactsOnly&&p==='lib/ui/viewer-companion/hd-motion-sprite.json')continue;
 if(check){if(!(await fs.readFile(p)).equals(data))throw Error(`Derived output differs: ${p}`);}else await fs.writeFile(p,data);
}
console.log(JSON.stringify({check,...(artifactsOnly?{artifactsOnly:true}:{}),physicalIndex:266,sourceChangedPixels,changedPixels,oldBytes:oldBytes.length,newBytes:bytes.length,registrationPreserved:true,packet:packet.src}));

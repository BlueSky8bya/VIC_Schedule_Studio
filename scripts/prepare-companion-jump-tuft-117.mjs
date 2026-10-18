//117: one generated corner correction; retain all other decoded packet pixels,
// the parent registration, face/ear geometry and every historical packet.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { bakeEyeStyleKey } from './prepare-companion-eye-style.mjs';
import { clearCompanionExportResidue115 } from './prepare-companion-motion-115.mjs';

const run='art-src/빅타민/동행/작업회차/20261018-점프노란조각교정117';
const prior='art-src/빅타민/동행/작업회차/20261018-동작연결정리115';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const json=v=>Buffer.from(JSON.stringify(v,null,2)+'\n');
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const check=process.argv.includes('--check');
const proof=await read(`${prior}/패킹파생기록.json`), keyProof=proof.keys[5];
const meta=await read(`${run}/고정입력/hd-motion-sprite.json`);
const parentPng=await fs.readFile(`${run}/고정입력/점프키6_원본RGBA.png`);
const parentRaw=await sharp(parentPng).ensureAlpha().raw().toBuffer();
if(hash(parentRaw)!==keyProof.originalCropRgbaSha256)throw Error('Wrong immutable parent key');
const composite=await read(`${run}/합성범위.json`);
const rawBytes=await fs.readFile(composite.nativeRaw);
if(hash(rawBytes)!==composite.rawSha256||composite.generationCalls!==1)throw Error('Unbound generated native');
const correctedPng=await fs.readFile(`${run}/정리본/빅타민_점프조각교정.png`);
const correctedRaw=await sharp(correctedPng).ensureAlpha().raw().toBuffer();
if(correctedRaw.length!==parentRaw.length)throw Error('Parent canvas changed');
let sourceChanged=0;
for(let y=0;y<105;y++)for(let x=0;x<104;x++)for(let c=0;c<4;c++){
 const p=(y*104+x)*4+c;if(parentRaw[p]===correctedRaw[p])continue;
 if(x>=29||y<76)throw Error('Correction escaped its small corner');sourceChanged++;
}
if(!sourceChanged)throw Error('No actual correction');
const parent=clearCompanionExportResidue115(parentRaw).rgba, corrected=clearCompanionExportResidue115(correctedRaw).rgba;
const body={...keyProof.body,left:keyProof.body.left-keyProof.box.left,right:keyProof.body.right-keyProof.box.left,top:keyProof.body.top-keyProof.box.top,bottom:keyProof.body.bottom-keyProof.box.top};
let left=104,top=105,right=0,bottom=0;
for(let y=0;y<105;y++)for(let x=0;x<104;x++)if(parent[(y*104+x)*4+3]){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
const featureBounds={left:body.left+body.width*.2,right:body.right-body.width*.15,top:body.top+body.height*.35,bottom:body.bottom-body.height*.1};
const shape={width:104,height:105,body,alpha:{left,top,right,bottom,width:right-left,height:bottom-top},face:{featureBounds,protected:{left:featureBounds.left-5,right:featureBounds.right+5,top:featureBounds.top-5,bottom:featureBounds.bottom+5},fade:2}};
const original=meta.atlases[4], oldBytes=await fs.readFile(`public${original.src}`);
if(hash(oldBytes)!==original.sha256)throw Error('Parent packet changed');
const decoded=await sharp(oldBytes).ensureAlpha().raw().toBuffer(), output=Buffer.from(decoded), frames=[];
for(const slot of proof.slots.slice(64,80)){
 if(slot.nativeCell!==5||slot.index<64||slot.index>79)throw Error('Wrong jump slot');
 const before=bakeEyeStyleKey({...shape,rgba:parent},slot.rig,slot.fit.scale,slot.fit.offset).data;
 if(hash(before)!==slot.rgbaSha256)throw Error(`Parent rig cannot be reproduced: ${slot.index}`);
 const after=bakeEyeStyleKey({...shape,rgba:corrected},slot.rig,slot.fit.scale,slot.fit.offset).data;
 let changedPixels=0,l=192,t=192,r=0,b=0;
 for(let y=0;y<192;y++)for(let x=0;x<192;x++){
  const p=(y*192+x)*4;if(before.subarray(p,p+4).equals(after.subarray(p,p+4)))continue;
  if(!before[p+3]&&!after[p+3])continue;
  if(x>=82||y<125)throw Error(`Changed face/ear or opposite side: ${slot.index}:${x},${y}`);
  const target=((Math.floor(slot.frame.index/8)*192+y)*1536+slot.frame.index%8*192+x)*4;
  after.copy(output,target,p,p+4);changedPixels++;l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);
 }
 frames.push({physicalIndex:slot.index,changedPixels,changedBounds:{left:l,top:t,right:r,bottom:b},parentFrame:slot.frame});
}
const bytes=await sharp(output,{raw:{width:1536,height:384,channels:4}}).webp({lossless:true,effort:6}).toBuffer();
const roundtrip=await sharp(bytes).ensureAlpha().raw().toBuffer();
let invisibleRgbChannelsNormalized=0;
for(let p=0;p<output.length;p+=4){
 if(roundtrip[p+3]!==output[p+3])throw Error('Lossless packet changed alpha');
 for(let c=0;c<3;c++)if(roundtrip[p+c]!==output[p+c]){
  if(output[p+3])throw Error('Lossless packet changed visible RGB');
  invisibleRgbChannelsNormalized++;
 }
}
const packet={src:'/companion/hd/vitamin-action-04-tuft-117-v1.webp',sha256:hash(bytes),bytes:bytes.length,width:1536,height:384};
meta.atlases[4]=packet;
const receipt={version:1,generationCalls:1,independentArtReviews:0,ownerApproval:false,parentNative:proof.native,parentPacket:original,generatedNative:{path:composite.nativeRaw,sha256:hash(rawBytes)},correctedKey:{path:`${run}/정리본/빅타민_점프조각교정.png`,sha256:hash(correctedPng)},scope:composite.effectiveContext,sourceChangedChannels:sourceChanged,packet,frames,unchangedVisibleDecodedPixelsAndAlphaPreserved:true,invisibleRgbChannelsNormalized,allRuntimeRegistrationPreserved:true,unusedPhysical261Preserved:true};
const outputs=[[`public${packet.src}`,bytes],['lib/ui/viewer-companion/hd-motion-sprite.json',json(meta)],[`${run}/정리본/hd-motion-sprite.json`,json(meta)],[`${run}/패킹파생기록.json`,json(receipt)]];
for(const[p,b]of outputs)if(check){if(!(await fs.readFile(p)).equals(b))throw Error(`Derived output differs: ${p}`);}else await fs.writeFile(p,b);
console.log(JSON.stringify({check,frames:frames.length,sourceChangedChannels:sourceChanged,oldBytes:oldBytes.length,newBytes:bytes.length,registrationPreserved:true,packet:packet.src}));

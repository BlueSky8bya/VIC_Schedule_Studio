import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import ts from "typescript";

//143: deterministic source attribution/packing only. No art generation,
// repaint, recoloring, alpha threshold deletion, network or runtime work.
const root = process.cwd(), run = "art-src/빅타민/수집/작업회차/20261020-생활과희귀수집143";
const check = process.argv.includes("--check"), apply = process.argv.includes("--apply");
if (check === apply) throw new Error("Choose exactly --apply or --check");
const outArgument = process.argv.find(x => x.startsWith("--registry-out="));
if (!outArgument) throw new Error("An explicit proposal --registry-out=directory is required");
const registryOut = path.resolve(root, outArgument.slice("--registry-out=".length));
if (!registryOut.startsWith(path.resolve(root, ".scratch-pw") + path.sep)) throw new Error("Registry output must stay in ignored proposal storage");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const read = relative => fs.readFile(path.join(root, relative));
const expectedSources = {
  "간식143-1.png": "e24adede1aa87705a4186d2bffa05e95be0cccc2a619cd2d5294aa80b5e4857a",
  "간식143-2.png": "1f70f5a12ce6ed6bb7423be8b464f275074c2e94e0e717d0c41330926cb6130e",
  "간식143-3.png": "5a428e8ad6ee4c742803ea5cf68213f9c9448b7d8eac844fbb4abedd8feda8a6",
  "간식143-4.png": "2e708d60a5a6110b622cfc6707be8df535bf6da41c1455e647b4e634bbb19c57",
  "간식143-5.png": "f9067033c2d558d8892855d74c9db1fd904ea288ee9fd28d5774af6a80a7365d",
  "장난감143-1.png": "823fa5a44843fa420f124957536caafce27907b68d71578cfd82e1c436550796",
  "장난감143-2.png": "7f85fa9243ddd1761342c50c5aee5ad877bd20ae1f7088ea8d171080d978678c",
  "장난감143-3.png": "117629c9d5cdf1e269a68d9f7a8c8cb3616dd469bc84c30a660bcab9415d8558"
};
const sourceCollectionSha = "c2c9fb56a30f33114ee7fc2ed663cfc5d7c4afae5d972917ea74e359f461463c";
const sourceFoodSha = "dac7af7bd023a21f74bf9437ed258119d71991ffe6d27a61c07da944e61b96ee";
const registeredCollectionSha = "72d4f04f9dc2e511aeeb6f3f47186aa2ee71a4a5e00067c6e223ab1396b916ea";
const registeredStampAliasCollectionSha = "9ca28f7449ae9dfdf38d8bef50533580a626b6e112aff16a149dded0283aa606";
const registeredFoodSha = "752ecabd0d3a08f381484064fb6c5262785888984085742c3a725baa62bd0e2e";
const catalogBytes = await read(`${run}/고정입력/수집목록.json`);
if (hash(catalogBytes) !== "1349b2347279bea40180e25a61ee1c0c4a811a70cd086ca7614c1591d8ead2f2") throw new Error("Frozen143 catalogue changed");
const catalog = JSON.parse(catalogBytes);
if (catalog.foods.length !== 60 || catalog.toys.length !== 36) throw new Error("Unexpected143 catalogue count");
const registryInputArgument=process.argv.find(x=>x.startsWith("--registry-input="));
const registryInput=registryInputArgument?path.resolve(root,registryInputArgument.slice("--registry-input=".length)):root;
if(registryInput!==root&&!registryInput.startsWith(path.resolve(root,".scratch-pw")+path.sep))throw new Error("Optional registration input must be an ignored proposal");
const collectionBytes = await fs.readFile(path.join(registryInput,"lib/ui/viewer-companion/collection-art.ts")), foodBytes = await fs.readFile(path.join(registryInput,"lib/ui/viewer-companion/food-art.ts"));
if (![sourceCollectionSha,registeredCollectionSha,registeredStampAliasCollectionSha].includes(hash(collectionBytes)) || ![sourceFoodSha,registeredFoodSha].includes(hash(foodBytes))) throw new Error("Baseline or exact143 art registration changed; prepare a new reviewed packing revision");
const sourceCollection = collectionBytes.toString("utf8").replace(" | `food-143-${1 | 2 | 3 | 4 | 5}`;",";");
const compiled = ts.transpileModule(sourceCollection, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const loaded = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const legacyAtlases=structuredClone(loaded.COMPANION_COLLECTION_ATLASES),legacyFrames=structuredClone(loaded.COMPANION_COLLECTION_FRAMES);
for(let i=1;i<=5;i++)delete legacyAtlases[`food-143-${i}`];
for(const item of catalog.foods){delete legacyFrames.food[item.id];delete legacyFrames["food-stamp"][item.id];}
if(Object.keys(legacyFrames.food).length!==180)throw new Error("Pre143 registration is not exactly180 foods");
const baseline={COMPANION_COLLECTION_ATLASES:legacyAtlases,COMPANION_COLLECTION_FRAMES:legacyFrames};
const atlases = structuredClone(baseline.COMPANION_COLLECTION_ATLASES), frames = structuredClone(baseline.COMPANION_COLLECTION_FRAMES);
const receipt = { version: 1, edition: 143, generationCallsByThisScript: 0, artApproval: "NOT_ESTABLISHED_BY_TECHNICAL_PACKING", method: "Alpha>=32 connected components locate complete objects. All alpha>0 source pixels, including faint wisps, are attributed exactly once and copied unchanged into separate raw cutouts. Only alpha0 canvas is trimmed. Isotropic Lanczos resize; transparent centering; lossless WebP. No recoloring, source alpha deletion, component repair or generated pixels.", catalogSha256: hash(catalogBytes), baselineCollectionSha256: sourceCollectionSha, baselineFoodRuntimeSha256: sourceFoodSha, sources: [], items: [], atlases: [], runtimeFiles: [] };
const publicSafe = [];
async function save(relative, bytes) {
  const target = path.join(root, relative);
  if (check) { if (!(await fs.readFile(target)).equals(bytes)) throw new Error(`Reproduction differs: ${relative}`); }
  else {
    await fs.mkdir(path.dirname(target), { recursive: true });
    try { await fs.writeFile(target, bytes, { flag: "wx" }); }
    catch (error) { if (error.code !== "EEXIST" || !(await fs.readFile(target)).equals(bytes)) throw error; }
  }
  publicSafe.push(relative);
  return { path: relative, sha256: hash(bytes), bytes: bytes.length };
}
async function saveProposal(relative, bytes) {
  const target = path.join(registryOut, relative); await fs.mkdir(path.dirname(target), { recursive: true });
  if (check) { if (!(await fs.readFile(target)).equals(Buffer.from(bytes))) throw new Error(`Proposal reproduction differs: ${relative}`); }
  else await fs.writeFile(target, bytes, { flag: "wx" });
}
function bounds(data, width, height, threshold = 0) {
  let left = width, top = height, right = 0, bottom = 0, pixels = 0;
  for (let y=0;y<height;y++) for(let x=0;x<width;x++) if(data[(y*width+x)*4+3]>threshold) { left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);pixels++; }
  if (!pixels) throw new Error("Empty attributed cutout");
  return { x:left,y:top,width:right-left,height:bottom-top,pixels };
}
//The lossless WebP codec canonicalizes invisible RGB when alpha is exactly0.
//Do that only on resized derivatives, before their PNG parity reference.
//Every alpha>0 native RGBA pixel remains intact in its raw source partition.
function transparentRgbZero(data) { for(let p=0;p<data.length;p+=4)if(data[p+3]===0)data[p]=data[p+1]=data[p+2]=0;return data; }
function assertVisibleRgba(expected,actual) {
  if(expected.length!==actual.length)throw new Error("Decoded runtime dimensions changed");
  let invisibleRgbChannels=0;
  for(let p=0;p<expected.length;p+=4){if(expected[p+3]!==actual[p+3])throw new Error("Lossless runtime alpha changed");for(let c=0;c<3;c++)if(expected[p+c]!==actual[p+c]){if(expected[p+3]>0)throw new Error("Lossless visible RGB changed");invisibleRgbChannels++;}}
  return invisibleRgbChannels;
}
function attribute(data,width,height,name) {
  const length=width*height,seen=new Uint8Array(length),owner=new Int16Array(length).fill(-1),component=new Int32Array(length),flood=new Int32Array(length);
  const groups=Array.from({length:12},()=>({left:width,top:height,right:0,bottom:0,strong:0})),tiny=[];
  let components=0;
  for(let start=0;start<length;start++) {
    if(seen[start]||data[start*4+3]<32)continue;
    let head=0,tail=1,left=width,top=height,right=0,bottom=0;seen[start]=1;component[0]=start;
    while(head<tail) {
      const p=component[head++],x=p%width,y=Math.floor(p/width);left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);
      for(let yy=Math.max(0,y-1);yy<=Math.min(height-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(width-1,x+1);xx++){const q=yy*width+xx;if(!seen[q]&&data[q*4+3]>=32){seen[q]=1;component[tail++]=q;}}
    }
    components++;
    if(tail<200){tiny.push(component.slice(0,tail));continue;}
    const nominal=Math.min(2,Math.floor((top+bottom)/2/(height/3)))*4+Math.min(3,Math.floor((left+right)/2/(width/4)));
    for(let i=0;i<tail;i++) {
      const p=component[i],x=p%width,y=Math.floor(p/width);
      //The two native food2 plates genuinely touch. This frozen vertical
      //ownership seam lies at their narrow dark join, not at nominal x362.
      //Each original pixel still belongs to exactly one of the two plates.
      const label=name==="간식143-2.png"&&left<40&&right>700&&top<100&&bottom<400?(x<397?0:1):nominal;
      owner[p]=label;const b=groups[label];b.left=Math.min(b.left,x);b.top=Math.min(b.top,y);b.right=Math.max(b.right,x+1);b.bottom=Math.max(b.bottom,y+1);b.strong++;
    }
  }
  if(groups.some(g=>g.strong<200))throw new Error(`Missing complete object in ${name}`);
  const nearest=(x,y)=>{let label=0,distance=Infinity;groups.forEach((g,i)=>{const d=Math.hypot(Math.max(g.left-x,0,x-g.right),Math.max(g.top-y,0,y-g.bottom));if(d<distance){distance=d;label=i;}});return label;};
  for(const points of tiny){let sx=0,sy=0;for(const p of points){sx+=p%width;sy+=Math.floor(p/width);}const label=nearest(sx/points.length,sy/points.length);for(const p of points)owner[p]=label;}
  let head=0,tail=0;
  for(let p=0;p<length;p++)if(owner[p]>=0)flood[tail++]=p;
  while(head<tail){const p=flood[head++],x=p%width,y=Math.floor(p/width);for(let yy=Math.max(0,y-1);yy<=Math.min(height-1,y+1);yy++)for(let xx=Math.max(0,x-1);xx<=Math.min(width-1,x+1);xx++){const q=yy*width+xx;if(owner[q]<0&&data[q*4+3]>0){owner[q]=owner[p];flood[tail++]=q;}}}
  const boxes=Array.from({length:12},()=>({left:width,top:height,right:0,bottom:0,pixels:0}));let sourcePixels=0;
  for(let p=0;p<length;p++)if(data[p*4+3]>0){sourcePixels++;const x=p%width,y=Math.floor(p/width);if(owner[p]<0)owner[p]=nearest(x,y);const b=boxes[owner[p]];b.left=Math.min(b.left,x);b.top=Math.min(b.top,y);b.right=Math.max(b.right,x+1);b.bottom=Math.max(b.bottom,y+1);b.pixels++;}
  const cuts=boxes.map(b=>({crop:{left:b.left,top:b.top,width:b.right-b.left,height:b.bottom-b.top},raw:Buffer.alloc((b.right-b.left)*(b.bottom-b.top)*4),pixels:b.pixels}));
  const map=Buffer.alloc(length),reconstructed=Buffer.alloc(data.length);let copied=0,mismatch=0;
  for(let p=0;p<length;p++)if(data[p*4+3]>0){const cut=cuts[owner[p]],target=((Math.floor(p/width)-cut.crop.top)*cut.crop.width+p%width-cut.crop.left)*4;data.copy(cut.raw,target,p*4,p*4+4);cut.raw.copy(reconstructed,p*4,target,target+4);map[p]=owner[p]+1;copied++;for(let c=0;c<4;c++)if(reconstructed[p*4+c]!==data[p*4+c])mismatch++;}
  if(copied!==sourcePixels||mismatch||cuts.reduce((s,c)=>s+c.pixels,0)!==sourcePixels)throw new Error(`Incomplete RGBA partition: ${name}`);
  return {cuts,map,components,sourcePixels,copied,mismatch,sourceVisibleRgbaSha256:hash(reconstructed),ownershipSeam:name==="간식143-2.png"?{type:"vertical-native-contact",x:397,scope:"only connected top-left plate pair; a source ambiguity, not repaired artwork"}:null};
}
async function normalized(cut, limit, canvas) {
  const resized=await sharp(cut.raw,{raw:{width:cut.crop.width,height:cut.crop.height,channels:4}}).resize({width:limit,height:limit,fit:"inside",kernel:sharp.kernel.lanczos3}).raw().toBuffer({resolveWithObject:true});
  if(!canvas)return {data:transparentRgbZero(resized.data),width:resized.info.width,height:resized.info.height};
  const data=await sharp({create:{width:canvas,height:canvas,channels:4,background:"#0000"}}).composite([{input:resized.data,raw:{width:resized.info.width,height:resized.info.height,channels:4},left:Math.floor((canvas-resized.info.width)/2),top:Math.floor((canvas-resized.info.height)/2)}]).raw().toBuffer();
  return {data:transparentRgbZero(data),width:canvas,height:canvas};
}
for(const name of Object.keys(expectedSources)) {
  const relative=`${run}/원본/${name}`,native=await read(relative);
  if(hash(native)!==expectedSources[name])throw new Error(`Native changed: ${name}`);
  const decoded=await sharp(native).ensureAlpha().raw().toBuffer({resolveWithObject:true});const {width,height,channels}=decoded.info;
  if(channels!==4)throw new Error("Non-RGBA source");
  const separated=attribute(decoded.data,width,height,name),isFood=name.startsWith("간식"),sheet=Number(name.match(/-(\d)\.png$/)[1]),items=(isFood?catalog.foods:catalog.toys).filter(x=>x.sheet===`${isFood?"food":"toy"}-${sheet}`).sort((a,b)=>a.cell-b.cell);
  if(items.length!==12||items.some((x,i)=>x.cell!==i))throw new Error("Frozen row-major catalogue mismatch");
  const mapBytes=await sharp(separated.map,{raw:{width,height,channels:1}}).png().toBuffer();
  const mapRecord=await save(`${run}/정리본/분할맵-${name}`,mapBytes);
  const atlasParts=[];
  receipt.sources.push({path:relative,sha256:hash(native),bytes:native.length,width,height,columns:4,rows:3,sourceBytesUnchanged:true,components:separated.components,sourceNontransparentPixels:separated.sourcePixels,attributedNontransparentPixels:separated.copied,missingPixels:0,duplicatedPixels:0,rgbaMismatch:separated.mismatch,partitionMap:mapRecord,partitionCounts:separated.cuts.map(x=>x.pixels),visibleRgbaReconstructionSha256:separated.sourceVisibleRgbaSha256,ownershipSeam:separated.ownershipSeam});
  for(let index=0;index<12;index++) {
    const rawItem=items[index],sizeOverrides={"bubble-wand":[36,40],"boomerang":[38,34],"flying-disc":[36,30],"harmonica":[40,32],"cup-and-ball":[36,36],"paddle-ball":[34,38]},visual=sizeOverrides[rawItem.id],item=visual?{...rawItem,width:visual[0],height:visual[1]}:rawItem,cut=separated.cuts[index],prefix=isFood?"간식":"장난감";
    const cutPng=await sharp(cut.raw,{raw:{width:cut.crop.width,height:cut.crop.height,channels:4}}).png().toBuffer();
    const rawRecord=await save(`${run}/정리본/원본분리/${prefix}-${item.id}.png`,cutPng);
    const packed=await normalized(cut,isFood?112:192,isFood?128:undefined);
    const content=bounds(packed.data,packed.width,packed.height,16),solid=bounds(packed.data,packed.width,packed.height,249);
    const record={id:item.id,kind:isFood?"food":"toy",name:item.name,source:relative,sourceIndex:index,sourceCrop:cut.crop,sourcePixels:cut.pixels,sourceRgbaSha256:hash(cut.raw),sourceRgbaUnchangedBeforeResize:true,rawCutout:rawRecord,normalizedSize:[packed.width,packed.height],preCodecResizedRgbaSha256:hash(packed.data),content,solid,resizeKernel:"lanczos3",resizeIsotropic:true,sourceAlphaDeleted:0,worldDisplay:isFood?{width:28,height:28,bodyWidth:content.width*28/128,bodyHeight:content.height*28/128}:{width:item.width,height:item.height,bodyWidth:content.width*Math.min(item.width/packed.width,item.height/packed.height),bodyHeight:content.height*Math.min(item.width/packed.width,item.height/packed.height)}};
    if(isFood) {
      const atlasId=`food-143-${sheet}`,x=index%4*128,y=Math.floor(index/4)*128;
      if(frames.food[item.id])throw new Error("Existing food identity would be overwritten");
      frames.food[item.id]={id:item.id,atlas:atlasId,index,x,y,width:128,height:128,content:{x:content.x,y:content.y,width:content.width,height:content.height}};
      atlasParts.push({input:packed.data,raw:{width:128,height:128,channels:4},left:x,top:y});
      frames["food-stamp"][item.id]={...frames.food[item.id]}; //Metadata alias only, no new stamp image.
      record.frame=frames.food[item.id];
    } else {
      const webp=await sharp(packed.data,{raw:{width:packed.width,height:packed.height,channels:4}}).webp({lossless:true,effort:6}).toBuffer();
      const decodedRuntime=await sharp(webp).ensureAlpha().raw().toBuffer();record.codecInvisibleRgbChannelDifferences=assertVisibleRgba(packed.data,decodedRuntime);
      const png=await sharp(decodedRuntime,{raw:{width:packed.width,height:packed.height,channels:4}}).png().toBuffer();record.normalized=await save(`${run}/정리본/${prefix}-${item.id}-192-v3.png`,png);record.normalizedRgbaSha256=hash(decodedRuntime);
      record.runtime=await save(`public/companion/home/143/toy-${item.id}.webp`,webp);record.runtimeRgbaMatchesNormalizedPng=true;receipt.runtimeFiles.push(record.runtime);
    }
    receipt.items.push(record);
  }
  if(isFood) {
    const atlasRaw=transparentRgbZero(await sharp({create:{width:512,height:384,channels:4,background:"#0000"}}).composite(atlasParts).raw().toBuffer());
    const webp=await sharp(atlasRaw,{raw:{width:512,height:384,channels:4}}).webp({lossless:true,effort:6}).toBuffer();
    const decodedRuntime=await sharp(webp).ensureAlpha().raw().toBuffer(),invisibleRgbDifferences=assertVisibleRgba(atlasRaw,decodedRuntime);
    const png=await sharp(decodedRuntime,{raw:{width:512,height:384,channels:4}}).png().toBuffer();
    const runtime=await save(`public/companion/collection/foods-143-${sheet}-v1.webp`,webp);
    const normalizedPng=await save(`${run}/정리본/간식143-${sheet}-128아틀라스.png`,png);
    const id=`food-143-${sheet}`;atlases[id]={src:runtime.path.replace(/^public/,""),width:512,height:384,cell:128,columns:4,rows:3,sha256:runtime.sha256};
    for(const record of receipt.items.filter(x=>x.kind==="food"&&x.source===relative)){
      const cell=Buffer.alloc(128*128*4),x=record.frame.x,y=record.frame.y;
      for(let row=0;row<128;row++)decodedRuntime.copy(cell,row*128*4,((y+row)*512+x)*4,((y+row)*512+x+128)*4);
      const cellPng=await sharp(cell,{raw:{width:128,height:128,channels:4}}).png().toBuffer();record.normalized=await save(`${run}/정리본/간식-${record.id}-128-v3.png`,cellPng);record.normalizedRgbaSha256=hash(cell);record.runtimeRgbaMatchesNormalizedPng=true;
    }
    receipt.atlases.push({id,...runtime,normalizedPng,rgbaSha256:hash(decodedRuntime),codecInvisibleRgbChannelDifferences:invisibleRgbDifferences,runtimeRgbaMatchesNormalizedPng:true});receipt.runtimeFiles.push(runtime);
  }
  if(hash(await read(relative))!==expectedSources[name])throw new Error("Source preservation failed");
}
//Strictly preserve every registered pre143 object, frame and stamp.
for(const [key,value]of Object.entries(baseline.COMPANION_COLLECTION_ATLASES))if(JSON.stringify(atlases[key])!==JSON.stringify(value))throw new Error("Legacy atlas changed");
for(const [kind,entries]of Object.entries(baseline.COMPANION_COLLECTION_FRAMES))for(const[id,frame]of Object.entries(entries))if(JSON.stringify(frames[kind][id])!==JSON.stringify(frame))throw new Error("Legacy frame changed");
if(Object.keys(frames.food).length!==240||receipt.items.length!==96||receipt.runtimeFiles.length!==41)throw new Error("Incomplete143 delivery");
const prefix=sourceCollection.slice(0,sourceCollection.indexOf("export const COMPANION_COLLECTION_ATLASES:")).replace("`food-109-${1 | 2 | 3 | 4 | 5 | 6}`;","`food-109-${1 | 2 | 3 | 4 | 5 | 6}` | `food-143-${1 | 2 | 3 | 4 | 5}`;");
if(!prefix.includes("food-143-"))throw new Error("Atlas type registration failed");
const suffix=sourceCollection.slice(sourceCollection.indexOf("const presented:"));
const registry=`${prefix}export const COMPANION_COLLECTION_ATLASES: Readonly<Partial<Record<AtlasId, CompanionCollectionAtlas>>> = ${JSON.stringify(atlases,null,2)};\nexport const COMPANION_COLLECTION_FRAMES: Readonly<Record<CompanionCollectionArtKind, Readonly<Record<string, CompanionCollectionFrame>>>> = ${JSON.stringify(frames,null,2)};\n${suffix}`;
await saveProposal("lib/ui/viewer-companion/collection-art.ts",registry);
const used=[...new Set(Object.values(frames.food).map(x=>x.atlas))],sources=used.map(id=>{const a=atlases[id];return[a.src,a.width,a.height];}),cells=Object.fromEntries(Object.entries(frames.food).map(([id,f])=>[id,[used.indexOf(f.atlas),f.x,f.y,f.width,f.height]]));
const foodRuntime=`// Generated by scripts/prepare-companion-collection-143.mjs; observed food cells, old180 unchanged.\nimport type { CompanionFoodKind } from "./snacks";\ntype FoodArt = { src: string; atlasWidth: number; atlasHeight: number; x: number; y: number; width: number; height: number };\nconst atlases: readonly (readonly [string, number, number])[] = ${JSON.stringify(sources)};\nconst cells: Readonly<Record<CompanionFoodKind, readonly [number, number, number, number, number]>> = ${JSON.stringify(cells)};\nexport function getCompanionFoodArtFrame(kind: CompanionFoodKind): FoodArt | undefined {\n  const cell = cells[kind]; if (!cell) return;\n  const [src, atlasWidth, atlasHeight] = atlases[cell[0]];\n  return { src, atlasWidth, atlasHeight, x: cell[1], y: cell[2], width: cell[3], height: cell[4] };\n}\n`;
await saveProposal("lib/ui/viewer-companion/food-art.ts",foodRuntime);
receipt.registration={foodCount:240,foodAtlasCount:used.length,old180FramesUnchanged:true,allPre143AtlasAndStampMetadataUnchanged:true,collectionCandidateSha256:hash(registry),foodRuntimeCandidateSha256:hash(foodRuntime),productSourceWrites:0};
receipt.delivery={newFoodCount:60,newToyCount:36,foodAtlases:5,foodCell:128,foodLimit:112,toyLongEdge:192,codec:"lossless WebP",resizedDerivativeTransparentRgb:"WebP may repredict invisible alpha0 RGB. All visible RGB and every alpha byte are verified exact against resized input; final normalized PNGs are actual runtime decodes for exact full-RGBA parity. Native alpha>0 pixels remain unchanged in raw partitions.",sameFoodFrameSharedByLiveAndBook:true,newFoodStampImages:0,newFoodStampMetadataAliases:60,newCharacterImages:0};
const receiptBytes=Buffer.from(JSON.stringify(receipt,null,2)+"\n");await save(`${run}/제작기록/공개자료/패킹명세-v2.json`,receiptBytes);
await save(`${run}/제작기록/공개자료/스테이지목록-v2.json`,Buffer.from(JSON.stringify({version:1,scope:"explicit public-safe technical outputs only; raw feedback/contracts/screenshots excluded",paths:publicSafe},null,2)+"\n"));
process.stdout.write(JSON.stringify({mode:check?"check":"apply-new-only",foods:60,toys:36,runtimeFiles:41,totalRuntimeBytes:receipt.runtimeFiles.reduce((n,x)=>n+x.bytes,0),receiptSha256:hash(receiptBytes),sourceOriginalsPreserved:8,originalRegistrationWrites:0})+"\n");

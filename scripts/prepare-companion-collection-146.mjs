// Deterministic derivative packing only. Originals and prompts remain local.
// No generation, recoloring, background segmentation, or alpha thresholding.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import ts from 'typescript';

const run='art-src/빅타민/수집/작업회차/20261020-방송오마주146';
const apply=process.argv.includes('--apply'),check=process.argv.includes('--check');
if(apply===check)throw Error('Choose --apply or --check');
const foodsOnly=process.argv.includes('--foods-only');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const loadTs=async file=>{
 const code=ts.transpileModule(await fs.readFile(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
 return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
};
const {COMPANION_SNACK_EXPANSION_146:foods}=await loadTs('lib/ui/viewer-companion/snack-expansion-146.ts');
const {COMPANION_TOY_EXPANSION_146:toys}=await loadTs('lib/ui/viewer-companion/toy-expansion-146.ts');
if(foods.length!==12||toys.length!==24)throw Error('Expected twelve food and twenty-four toy identities');
const receipt={edition:146,method:'Only alpha0 canvas trimming, isotropic Lanczos resizing, transparent centering, lossless WebP. Source native PNGs unchanged. No art generation or pixel repaint by this script.',foods:[],toys:[],runtimeFiles:[]};
async function save(file,bytes){
 if(check){if(!(await fs.readFile(file)).equals(Buffer.from(bytes)))throw Error(`Reproduction differs: ${file}`);}
 else {await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
}
function bounds(data,w,h){let x=w,y=h,r=0,b=0;for(let j=0;j<h;j++)for(let i=0;i<w;i++)if(data[(j*w+i)*4+3]>0){x=Math.min(x,i);y=Math.min(y,j);r=Math.max(r,i+1);b=Math.max(b,j+1);}if(!r)throw Error('Empty sprite');return {x,y,width:r-x,height:b-y};}
async function tile(id,kind,size){
 const sourcePath=`${run}/원본/${kind}-${id}.png`,bytes=await fs.readFile(sourcePath);
 const raw=await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true}),box=bounds(raw.data,raw.info.width,raw.info.height);
 const inset=kind==='food'?6:8;
 const scaled=await sharp(bytes).extract({left:box.x,top:box.y,width:box.width,height:box.height}).resize(size-inset*2,size-inset*2,{fit:'inside',kernel:'lanczos3'}).png().toBuffer({resolveWithObject:true});
 // Foods use fixed atlas cells; toys keep their own aspect ratio so contain
 // inside the physical toy's narrow/tall box does not shrink them twice.
 const width=kind==='food'?size:scaled.info.width+inset*2,height=kind==='food'?size:scaled.info.height+inset*2;
 const left=Math.floor((width-scaled.info.width)/2),top=Math.floor((height-scaled.info.height)/2);
 const png=await sharp({create:{width,height,channels:4,background:'#00000000'}}).composite([{input:scaled.data,left,top}]).png().toBuffer();
 return {png,width,height,record:{id,sourceSha256:sha(bytes),sourceSize:[raw.info.width,raw.info.height],sourceAlphaBounds:box,content:{x:left,y:top,width:scaled.info.width,height:scaled.info.height}}};
}
const foodTiles=[];
for(let i=0;i<foods.length;i++){
 const item=foods[i],t=await tile(item.id,'food',128);foodTiles.push({input:t.png,left:(i%4)*128,top:Math.floor(i/4)*128});
 receipt.foods.push({...t.record,index:i,x:(i%4)*128,y:Math.floor(i/4)*128});
}
const atlas=await sharp({create:{width:512,height:384,channels:4,background:'#00000000'}}).composite(foodTiles).webp({lossless:true,effort:6}).toBuffer();
const foodSrc='/companion/collection/foods-146-v1.webp';
await save(`public${foodSrc}`,atlas);receipt.runtimeFiles.push({src:foodSrc,sha256:sha(atlas),bytes:atlas.length});

// Append registry entries; all historical atlas/frame values are retained.
const registryPath='lib/ui/viewer-companion/collection-art.ts';
let registry=await fs.readFile(registryPath,'utf8');
const loaded=await loadTs(registryPath),atlases=structuredClone(loaded.COMPANION_COLLECTION_ATLASES),frames=structuredClone(loaded.COMPANION_COLLECTION_FRAMES);
atlases['food-146']={src:foodSrc,width:512,height:384,cell:128,columns:4,rows:3,sha256:sha(atlas)};
for(const item of receipt.foods){const frame={id:item.id,atlas:'food-146',index:item.index,x:item.x,y:item.y,width:128,height:128,content:item.content};frames.food[item.id]=frame;frames['food-stamp'][item.id]=frame;}
if(!registry.includes(' | "food-146";'))registry=registry.replace(' | `food-143-${1 | 2 | 3 | 4 | 5}`;',' | `food-143-${1 | 2 | 3 | 4 | 5}` | "food-146";');
registry=registry.replace(/(export const COMPANION_COLLECTION_ATLASES:[^=]+= )\{[\s\S]*?\n\};/,(_,prefix)=>prefix+JSON.stringify(atlases,null,2)+';');
registry=registry.replace(/(export const COMPANION_COLLECTION_FRAMES:[^=]+= )\{[\s\S]*?\n\};/,(_,prefix)=>prefix+JSON.stringify(frames,null,2)+';');
await save(registryPath,registry);
const foodArtPath='lib/ui/viewer-companion/food-art.ts';let runtime=await fs.readFile(foodArtPath,'utf8');
const atlasMatch=runtime.match(/const atlases:[^=]+= (\[[^\n]+\]);/),cellMatch=runtime.match(/const cells:[^=]+= (\{[^\n]+\});/);
if(!atlasMatch||!cellMatch)throw Error('Unrecognized food registry');
const runtimeAtlases=JSON.parse(atlasMatch[1]),cells=JSON.parse(cellMatch[1]);let atlasIndex=runtimeAtlases.findIndex(a=>a[0]===foodSrc);if(atlasIndex<0){atlasIndex=runtimeAtlases.length;runtimeAtlases.push([foodSrc,512,384]);}
for(const item of receipt.foods)cells[item.id]=[atlasIndex,item.x,item.y,128,128];
runtime=runtime.replace(atlasMatch[1],JSON.stringify(runtimeAtlases)).replace(cellMatch[1],JSON.stringify(cells));await save(foodArtPath,runtime);

if(!foodsOnly)for(const item of toys){
 const t=await tile(item.id,'toy',192),bytes=await sharp(t.png).webp({lossless:true,effort:6}).toBuffer(),src=`/companion/home/146/toy-${item.id}.webp`;
 await save(`public${src}`,bytes);receipt.toys.push({...t.record,src,size:[t.width,t.height]});receipt.runtimeFiles.push({src,sha256:sha(bytes),bytes:bytes.length});
}
const fixturePath='tests/fixtures/companion-collection-146-runtime.json';
if(!foodsOnly){const safe={edition:146,foods:receipt.foods.map(({sourceSize,sourceSha256,sourceAlphaBounds,...item})=>{void sourceSize;void sourceSha256;void sourceAlphaBounds;return item;}),toys:receipt.toys.map(({sourceSize,sourceSha256,sourceAlphaBounds,...item})=>{void sourceSize;void sourceSha256;void sourceAlphaBounds;return item;}),runtimeFiles:receipt.runtimeFiles};await save(fixturePath,JSON.stringify(safe,null,2)+'\n');}
await save(`.scratch-pw/companion-146/packing${foodsOnly?'-foods':''}.json`,JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({foods:receipt.foods.length,toys:receipt.toys.length,artCallsByPacking:0,files:receipt.runtimeFiles.length,mode:check?'checked':'applied'}));

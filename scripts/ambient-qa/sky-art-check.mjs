import fs from 'node:fs';
import {launch,newPage,openFixture,fixtureUrl,forceWorld,advance,captureCanvas} from './lib.mjs';
const phase=process.argv[2]??'after',out=`.scratch-pw/qa/r24/${phase}`;fs.mkdirSync(out,{recursive:true});
const browser=await launch(),checks=[],shots=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}`);};
try{
 const {ctx,page,errors}=await newPage(browser),requests=[];
 page.on('request',r=>{if(r.url().includes('/ambient/art/'))requests.push(r.url());});
 const scenarios=[
  ...[3,7,11,15,17,19,21,23,26,30].map(day=>({name:`moon-jan-${day}`,season:'winter',band:'night',weather:'clear',day,t:2500})),
  ...['clear','cloud','rain','wind','fog','snow'].map(weather=>({name:`weather-${weather}`,season:'winter',band:'noon',weather,day:15,t:2500})),
  {name:'summer-sun',season:'summer',band:'noon',weather:'clear',day:15,t:2500},
  ...['shooting-star','comet'].map(skyEvent=>({name:skyEvent,season:'winter',band:'night',weather:'clear',day:19,t:skyEvent==='comet'?10000:350,skyEvent})),
 ];
 for(const sc of scenarios){
  await openFixture(page,fixtureUrl({biome:'meadow',...sc},{gfx:'max',y:2026,day:sc.day}));
  await forceWorld(page,{band:sc.band,weather:sc.weather,day:sc.day,skyEvent:sc.skyEvent});await advance(page,sc.t);
  const shot=await captureCanvas(page);fs.writeFileSync(`${out}/${sc.name}.png`,shot.png);
  const pixels=await page.evaluate(()=>{
   const c=document.querySelector('canvas.gs-season'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   let matte=0;for(let y=0;y<c.height*.35;y++)for(let x=0;x<c.width;x++){const i=(y*c.width+x)*4;if(d[i]-d[i+1]>35&&d[i+2]-d[i+1]>35)matte++;}
   return {matte,world:window.__vicAmbient.world()};
  });
  shots.push({name:sc.name,hash:shot.hash,...pixels});check(`${sc.name} sky has no magenta`,pixels.matte===0,pixels.matte);
 }
 check('no page exceptions',errors.length===0,errors);
 if(phase!=='before')check('new atlas loaded',requests.some(u=>u.endsWith('/sky-atlas-v2.png')));
 await ctx.close();
}finally{await browser.close();}
fs.writeFileSync(`${out}/results.json`,JSON.stringify({build:fs.readFileSync('.next/BUILD_ID','utf8').trim(),shots,checks},null,2));
if(checks.some(c=>!c.ok))process.exitCode=1;

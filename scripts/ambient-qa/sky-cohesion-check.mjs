import fs from 'node:fs';
import {launch,newPage,openFixture,fixtureUrl,advance,captureCanvas} from './lib.mjs';
const phase=process.argv[2]??'after',out=`.scratch-pw/qa/r27/${phase}`;fs.mkdirSync(out,{recursive:true});
const browser=await launch(),shots=[],checks=[];
try{
 const {ctx,page,errors}=await newPage(browser);
 const scenes=[
  ...['spring','summer','autumn','winter'].flatMap(season=>['plain','showcase'].map(camera=>({name:`ridge-${season}-${camera}`,season,camera,band:'noon',weather:'clear',t:1500}))),
  ...['clear','wind','cloud','rain','fog'].map(weather=>({name:`cloud-${weather}`,season:'summer',band:'noon',weather,t:1500})),
  ...[13,21,29].map(day=>({name:`night-${day}`,season:'summer',band:'night',hour:23,day,weather:'clear',t:1500})),
  ...['shooting-star','comet'].map(skyEvent=>({name:skyEvent,season:'summer',band:'night',hour:23,day:13,weather:'clear',skyEvent,t:skyEvent==='comet'?10000:350})),
 ];
 for(const sc of scenes){
  await openFixture(page,fixtureUrl({biome:'meadow',...sc},{gfx:'max',y:2026,day:sc.day??13,hour:sc.hour,camera:sc.camera??'showcase',skyBearing:'south',skyEvent:sc.skyEvent}));
  await advance(page,sc.t);const shot=await captureCanvas(page);fs.writeFileSync(`${out}/${sc.name}.png`,shot.png);shots.push({name:sc.name,hash:shot.hash});
 }
 for(const season of ['spring','summer','autumn','winter'])for(const role of ['poster','studio','preview']){
  const url=role==='poster'?`/visual-fixture/poster?ambient=${season}`:`/visual-fixture/studio?ambient=${season}&hour=12&weather=clear&viewer=${role==='preview'?1:0}`;
  await page.goto(`http://127.0.0.1:3100${url}`,{waitUntil:'networkidle'});
  await page.waitForSelector('canvas.gs-season');
  await page.waitForTimeout(1200);
  const name=`${role}-${season}`;await page.screenshot({path:`${out}/${name}-ui.png`});
  const meta=await page.evaluate(()=>{const c=document.querySelector('canvas.gs-season');return {width:c.width,height:c.height,opacity:getComputedStyle(c).opacity,filter:getComputedStyle(c).filter,gfx:document.documentElement.dataset.gfx};});
  const bytes=await page.locator('canvas.gs-season').first().evaluate(c=>c.toDataURL().split(',')[1]);fs.writeFileSync(`${out}/${name}.png`,Buffer.from(bytes,'base64'));shots.push({name,...meta});
 }
 checks.push({name:'browser exceptions',ok:errors.length===0,errors});await ctx.close();
}finally{await browser.close();}
fs.writeFileSync(`${out}/results.json`,JSON.stringify({build:fs.readFileSync('.next/BUILD_ID','utf8').trim(),shots,checks},null,2));
console.log(JSON.stringify({shots:shots.length,checks}));if(checks.some(c=>!c.ok))process.exitCode=1;

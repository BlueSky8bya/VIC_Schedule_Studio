import fs from 'node:fs';
import {launch,newPage,openFixture,fixtureUrl,forceWorld,advance,captureCanvas} from './lib.mjs';
const phase=process.argv[2]??'after',out=`.scratch-pw/qa/r25/${phase}`;fs.mkdirSync(out,{recursive:true});
const browser=await launch(),checks=[],shots=[];
const check=(name,ok,detail)=>{checks.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}`);};
try{
 const {ctx,page,errors}=await newPage(browser);
 for(const season of ['spring','summer','autumn','winter'])for(const skyBearing of ['north','south']){
  const sc={biome:'meadow',season,weather:'clear',hour:21,day:15};
  await openFixture(page,fixtureUrl(sc,{gfx:'max',y:2026,day:15,hour:21,skyBearing}));
  await forceWorld(page,{band:undefined,hour:21,day:15,weather:'clear',skyBearing});await advance(page,1500);
  const shot=await captureCanvas(page);const name=`${season}-${skyBearing}`;fs.writeFileSync(`${out}/${name}.png`,shot.png);shots.push({name,hash:shot.hash});
 }
 for(const weather of ['clear','cloud','wind','rain','snow','fog']){
  await openFixture(page,fixtureUrl({biome:'meadow',season:'summer',band:'noon',weather},{gfx:'max',y:2026,day:15,skyBearing:'south'}));
  await advance(page,1500);const shot=await captureCanvas(page);const name=`cloud-${weather}`;fs.writeFileSync(`${out}/${name}.png`,shot.png);shots.push({name,hash:shot.hash});
 }
 if(phase==='verified')for(const biome of ['pond','forest','mountain','sandy','sea']){
  await openFixture(page,fixtureUrl({biome,season:'summer',band:'night',weather:'cloud'},{gfx:'max',y:2026,day:15,skyBearing:'south'}));
  await advance(page,1500);const shot=await captureCanvas(page);const name=`occlusion-${biome}`;fs.writeFileSync(`${out}/${name}.png`,shot.png);shots.push({name,hash:shot.hash});
 }
 await openFixture(page,fixtureUrl({biome:'meadow',season:'summer',band:'noon',weather:'cloud'},{gfx:'max',y:2026,day:15,live:1}));
 if(phase!=='before'){
  await page.getByLabel('하늘 방향',{exact:true}).selectOption('north');
  await page.getByLabel('날씨',{exact:true}).selectOption('rain');
  await page.getByLabel('날짜',{exact:true}).fill('19');await page.getByLabel('시각',{exact:true}).fill('22');
  const world=await page.evaluate(()=>window.__vicAmbient.world());
  check('actual preview controls preserve choices',world?.date==='2026-8-19'&&world?.hour===22&&world?.weather==='rain',world);
 }
 if(phase!=='before')check('north/south views differ',shots.filter(s=>s.name.endsWith('-north')).every(s=>s.hash!==shots.find(v=>v.name===s.name.replace('-north','-south')).hash));
 check('no browser exceptions',errors.length===0,errors);await ctx.close();
}finally{await browser.close();}
fs.writeFileSync(`${out}/results.json`,JSON.stringify({build:fs.readFileSync('.next/BUILD_ID','utf8').trim(),shots,checks},null,2));
if(checks.some(c=>!c.ok))process.exitCode=1;

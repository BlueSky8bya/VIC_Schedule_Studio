// Actual noon sun pixels, calendar date and seasonal altitude on one build.
import fs from 'node:fs';
import {launch,newPage,openFixture,fixtureUrl,forceWorld,advance,captureCanvas} from './lib.mjs';
const out=process.argv[2]??'.scratch-pw/qa/r23/sun';
fs.mkdirSync(out,{recursive:true});
const browser=await launch(), records=[],checks=[];
const check=(name,ok)=>{checks.push({name,ok});console.log(`${ok?'PASS':'FAIL'} ${name}`);};
try {
 for(const season of ['spring','summer','autumn','winter']) {
  const {ctx,page,errors}=await newPage(browser);
  await openFixture(page,fixtureUrl({biome:'meadow',season,band:'noon',weather:'clear'},{gfx:'max',y:2026,day:15}));
  await forceWorld(page,{hour:12,day:15,weather:'clear'}); await advance(page,4000);
  const evidence=await page.evaluate(()=>{
   const c=document.querySelector('canvas.gs-season'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
   const points=[];
   // At this noon fixture the disc is central; allow the spring blue sky to
   // tint its translucent white pixels instead of assuming a yellow disc.
   for(let y=0;y<c.height*.30;y++)for(let x=c.width*.49|0;x<c.width*.51;x++){
    const i=(y*c.width+x)*4;
    if(d[i]>220&&d[i+1]>225&&d[i+2]>225)points.push([x,y]);
   }
   return {world:window.__vicAmbient.world(),pixels:points.length,y:points.length?points.reduce((n,p)=>n+p[1],0)/points.length:null};
  });
  const shot=await captureCanvas(page);fs.writeFileSync(`${out}/${season}-12.png`,shot.png);
  records.push({season,...evidence});
  check(`${season} actual 12 KST has a visible sun`,evidence.world.hour===12&&evidence.pixels>20);
  check(`${season} no page errors`,errors.length===0);
  if(season==='winter')for(const band of ['dawn','morning','dusk','night']){
   await forceWorld(page,{band,day:15,weather:'clear'});await advance(page,4000);
   fs.writeFileSync(`${out}/winter-${band}.png`,(await captureCanvas(page)).png);
  }
  await ctx.close();
 }
 const summer=records.find(r=>r.season==='summer'),winter=records.find(r=>r.season==='winter');
 check('summer noon altitude exceeds winter',summer.world.sunAlt>winter.world.sunAlt);
 check('summer rendered sun is higher than winter',summer.y!==null&&winter.y!==null&&summer.y<winter.y-60);
} finally {await browser.close();}
fs.writeFileSync(`${out}/results.json`,JSON.stringify({build:fs.readFileSync('.next/BUILD_ID','utf8').trim(),records,checks},null,2));
if(checks.some(c=>!c.ok))process.exitCode=1;

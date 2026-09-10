// Current-season source isolation and failed-load bake regression.
import fs from 'node:fs';
import {launch,newPage,openFixture,fixtureUrl,advance,captureCanvas} from './lib.mjs';
const out=process.argv[2]??'.scratch-pw/qa/r22-meadow';fs.mkdirSync(out,{recursive:true});
const checks=[];const check=(name,ok,detail)=>{checks.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}`);};
const browser=await launch();
try{
 for(const season of ['spring','summer','autumn','winter']){
  const {ctx,page,errors}=await newPage(browser),requests=[];
  page.on('request',r=>{if(r.url().includes('backdrop-meadow-'))requests.push(r.url());});
  await openFixture(page,fixtureUrl({biome:'meadow',season,band:'noon',weather:'clear'},{gfx:'max'}));
  const state=await page.evaluate(()=>window.__vicAmbient.scene());
  check(`${season} loads only its own three layers`,requests.length===3&&requests.every(u=>u.includes(`meadow-${season}-`))&&state.backdrop?.season===season&&state.backdrop?.ready,[...requests]);
  const magenta=await page.evaluate(()=>{const c=document.querySelector('canvas.gs-season'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<70&&d[i+2]>200)n++;return n;});
  check(`${season} no magenta matte`,magenta===0,magenta);
  fs.mkdirSync(`${out}/final/${season}`,{recursive:true});
  for(const [w,h]of [[1400,860],[3440,860],[5120,1440],[1080,1920]]){
   await page.setViewportSize({width:w,height:h});
   await openFixture(page,fixtureUrl({biome:'meadow',season,band:'noon',weather:'clear'},{gfx:'max'}));
   await advance(page,1000);
   const shot=await captureCanvas(page);fs.writeFileSync(`${out}/final/${season}/${w}x${h}.png`,shot.png);
   const fringe=await page.evaluate(()=>{const c=document.querySelector('canvas.gs-season'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){if(!(y>c.height*.30&&y<c.height*.36)&&!(y>c.height*.91&&(x<c.width*.12||x>c.width*.88)))continue;const i=(y*c.width+x)*4;if(d[i]-d[i+1]>18&&d[i+2]-d[i+1]>18)n++;}return n;});
   // Spring has pre-existing pink living flowers; chroma-matte sources are the other seasons.
   if(season!=='spring')check(`${season} ${w}x${h} no tinted matte fringe`,fringe===0,fringe);
  }
  check(`${season} no exceptions`,errors.length===0,errors);
  await ctx.close();
 }
 for(const season of ['autumn','winter']){
  const {ctx,page}=await newPage(browser);
  await page.addInitScript(()=>{window.__qaCanvasCount=0;const original=document.createElement.bind(document);document.createElement=function(name,...args){if(name==='canvas')window.__qaCanvasCount++;return original(name,...args);};});
  await page.route('**/backdrop-meadow-*',r=>r.abort());
  await openFixture(page,fixtureUrl({biome:'meadow',season,band:'noon',weather:'clear'},{gfx:'max'}));
  await advance(page,100);
  const before=await page.evaluate(()=>window.__qaCanvasCount);
  await advance(page,500);
  const after=await page.evaluate(()=>window.__qaCanvasCount);
  check(`${season} failed image does not rebake each frame`,after-before<5,{before,after});
  await ctx.close();
 }
}finally{await browser.close();}
fs.writeFileSync(`${out}/season-check.json`,JSON.stringify({build:fs.readFileSync('.next/BUILD_ID','utf8').trim(),checks},null,2));
if(checks.some(c=>!c.ok))process.exitCode=1;

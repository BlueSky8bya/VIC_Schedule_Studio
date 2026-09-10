// Three-source loading, scoped ground interaction, foreground movement and night sky.
// Production fixture server only; no schedule writes or real accounts.
import fs from 'node:fs';
import { launch,newPage,openFixture,fixtureUrl,captureCanvas,advance } from './lib.mjs';
const out=process.argv[2]??'.scratch-pw/qa/r21-layers/layer-check';
fs.mkdirSync(out,{recursive:true});
const report={build:fs.readFileSync('.next/BUILD_ID','utf8').trim(),checks:[],errors:[]};
const check=(name,ok,detail)=>{report.checks.push({name,ok:!!ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}`);};
const url=(extra={})=>fixtureUrl({biome:'meadow',season:'spring',band:'noon',weather:'clear',seed:42},{gfx:'max',reduced:0,y:2026,day:15,...extra});
const browser=await launch();
try {
 const {ctx,page,errors}=await newPage(browser);
 const requests=[];page.on('request',r=>{if(r.url().includes('backdrop-meadow-spring'))requests.push(r.url());});
 await openFixture(page,url());
 let d=await page.evaluate(()=>window.__vicAmbient.scene());
 check('three new sources only, no concept or v1 source',requests.length===3&&requests.every(u=>/-far-v2|-ground-v5|-frame-v2/.test(u)),[...requests]);
 check('three independently cached layers ready',d.backdrop?.ready&&d.backdrop.layers.join(',')==='far,ground,frame'&&d.backdrop.bakes===2,d.backdrop);
 await page.evaluate(()=>window.__vicAmbient.forcePointer({x:1400,y:860}));await advance(page,1000);
 d=await page.evaluate(()=>window.__vicAmbient.scene());
 check('far < ground < near pointer displacement',Math.abs(d.depth.far.x)<Math.abs(d.depth.ground.x)&&Math.abs(d.depth.ground.x)<Math.abs(d.depth.frame.x),d.depth);
 await page.evaluate(()=>{window.__vicAmbient.forcePointer(null);window.__vicAmbient.freeze(false);});
 await page.waitForFunction(()=>window.__vicAmbient.running);
 const before=await page.evaluate(()=>window.__vicAmbient.scene().presses);
 await page.mouse.click(700,860*.30);
 check('sky below old .26 boundary rejects grass click',await page.evaluate(()=>window.__vicAmbient.scene().presses)===before);
 await page.mouse.click(700,860*.75);
 check('new ground consumes grass click',await page.evaluate(()=>window.__vicAmbient.scene().presses)>before);
 for(const event of ['shooting-star','comet']) {
   const t=event==='comet'?13000:1000; // Comet enters from outside the frame over 26 seconds.
   await openFixture(page,url({band:'night',t,load:1}));
   const nightBase=await captureCanvas(page);
   await openFixture(page,url({band:'night',skyEvent:event,t,load:1}));
   const image=await captureCanvas(page);fs.writeFileSync(`${out}/${event}.png`,image.png);
   check(`night ${event} changes sky frame`,(await page.evaluate(()=>window.__vicAmbient.scene())).backdrop.ready&&image.hash!==nightBase.hash);
 }
 report.errors.push(...errors);check('no browser exceptions',errors.length===0,errors);
 await ctx.close();
} finally {await browser.close();}
fs.writeFileSync(`${out}/result.json`,JSON.stringify(report,null,2));
if(report.checks.some(c=>!c.ok))process.exitCode=1;

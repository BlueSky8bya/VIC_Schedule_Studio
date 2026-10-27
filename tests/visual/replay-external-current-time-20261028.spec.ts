import {test,expect,type Page,type BrowserContext,type TestInfo} from '@playwright/test';
import {readFileSync}from'node:fs';import{resolve}from'node:path';
import {guardCompanionQa}from'./helpers/companion-qa';import{settlePanelLayout}from'./helpers/panel-layout';import{companionTraceMode}from'./helpers/companion-evidence-policy';
test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode(),actionTimeout:15000});
async function setup(page:Page,context:BrowserContext,base:string,width:number){
 const proof=await guardCompanionQa(page,context,base),actions=JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR??'.next','server/server-reference-manifest.json'),'utf8')).node as Record<string,{exportedName?:string;filename?:string}>;
 const readIds=new Set(Object.entries(actions).filter(([,v])=>v.exportedName==='getAnonHeartIdsAction').map(([id])=>id)),fixtureIds=new Set(Object.entries(actions).filter(([,v])=>v.exportedName==='$$RSC_SERVER_ACTION_0'&&v.filename?.replaceAll('\\','/').endsWith('/app/visual-fixture/poster/page.tsx')).map(([id])=>id));
 await context.route('**/visual-fixture/poster?**',r=>{const q=r.request(),u=new URL(q.url()),id=q.headers()['next-action'];if(q.method()!=='POST'||u.origin!==base||u.pathname!=='/visual-fixture/poster'||!readIds.has(id)&&!fixtureIds.has(id))return r.fallback();proof.syntheticReads.push(readIds.has(id)?'exact-anonymous-heart-empty-read':'exact-nonpersistent-fixture-heart-control');return r.fulfill({contentType:'text/x-component',body:'0:{"a":"$@1","f":[],"b":"fixture"}\n1:'+JSON.stringify(readIds.has(id)?[]:{ok:true,count:1})+'\n'});});
 await page.setViewportSize({width,height:1000});await page.addInitScript(({dark})=>{localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));localStorage.setItem('vic.ambient','off');localStorage.setItem('vic.sound','off');localStorage.setItem('vic.dark',dark?'on':'off');localStorage.setItem('vic_panel_collapsed','0');},{dark:width===1920});return proof;
}
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof guardCompanionQa>>,facts:unknown){
 await settlePanelLayout(page);await Promise.all(proof.pending);for(const k of ['errors','rejected','mutations','liveReads']as const)expect(proof[k],k).toEqual([]);expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);
 await info.attach('current-ui',{body:await page.screenshot(),contentType:'image/png'});await info.attach('observation',{body:JSON.stringify({facts,proof:{...proof,pending:undefined},kind:'adopted-replay-type-verification',syntheticFixture:true,actualUsageStatistics:false,unadoptedIdeasImplemented:0,operatingWrites:0,fullCertification:false}),contentType:'application/json'});
}




for(const width of [1440,1920])test('Existing external arrow uses current playhead '+width,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);
 await context.route('**/api/public/fixture/vod-timeline?*',r=>{proof.syntheticReads.push('fixture-timeline');return r.fulfill({json:{authorNick:'합성',entries:[{sec:0,label:'시작',section:null},{sec:125,label:'이야기',section:null},{sec:300,label:'다음 주제',section:null}],variants:[]}});});
 await context.route('**/api/public/fixture/vod-chat?*',r=>{proof.syntheticReads.push('fixture-chat');return r.fulfill({json:{binSec:30,bins:[]}});});
 await context.route(new RegExp('^https://vod[.]sooplive[.]co[.]kr/player/4[23]/embed'),r=>{proof.syntheticReads.push('local-player');return r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><body style="background:#25231f;color:#eee;display:grid;place-items:center;height:95vh">로컬 테스트 플레이어</body>'});});
 await page.addInitScript(()=>{for(const name of['click','auxclick','contextmenu'])document.addEventListener(name,e=>{const a=(e.target as Element)?.closest('a');if(a?.href.startsWith('https://vod.sooplive.co.kr/player/'))e.preventDefault();},true);});
 await page.goto('/visual-fixture/vod-seek?access=public&variant=modal');
 const arrow=page.locator('.dvm-ext'),time=page.locator('.vch-now-time');await expect(arrow).toHaveCount(1);await expect(arrow).toHaveAttribute('href','https://vod.sooplive.co.kr/player/42?change_second=125');
 await arrow.evaluate(e=>(e as HTMLElement).dataset.qaOriginal='1');await expect.poll(()=>arrow.boundingBox().then(b=>b?.width)).toBe(28);const beforeBox=await arrow.boundingBox(),beforeInputs=await page.locator('input').count();
 async function tick(sec:number){await expect.poll(async()=>{const h=await page.locator('iframe:not(.is-standby)').first().elementHandle(),f=await h?.contentFrame();if(f)await f.evaluate(({origin,sec})=>parent.postMessage({cmd:'PupdateMediaEvent',id:'42',event:{type:'timeUpdate',currentTime:sec}},origin),{origin:baseURL!,sec});return (await time.textContent())?.trim();}).toMatch(new RegExp('0?'+Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0')));}
 await tick(345);await arrow.hover();await expect(arrow).toHaveAttribute('href','https://vod.sooplive.co.kr/player/42?change_second=345');
 await tick(401);await arrow.focus();await page.keyboard.press('Enter');await expect(arrow).toHaveAttribute('href','https://vod.sooplive.co.kr/player/42?change_second=401');
 await tick(466);await arrow.click({button:'middle'});await expect(arrow).toHaveAttribute('href','https://vod.sooplive.co.kr/player/42?change_second=466');
 await tick(512);await arrow.click();await expect(arrow).toHaveAttribute('href','https://vod.sooplive.co.kr/player/42?change_second=512');
 await expect(arrow).toHaveAttribute('data-qa-original','1');expect(await arrow.boundingBox()).toEqual(beforeBox);expect(await page.locator('input').count()).toBe(beforeInputs);await expect(arrow).toHaveAttribute('data-act','vod-replay');await expect(arrow).toHaveAttribute('target','_blank');await expect(arrow).toHaveAttribute('rel','noopener noreferrer');
 await finish(page,info,proof,{width,currentSeconds:512,initialSeconds:125,pointerHoverMiddleAndEnter:true,sameExistingArrow:true,newControls:0,newInputs:0,beforeBox,afterBox:await arrow.boundingBox(),providerPlayback:false});
});

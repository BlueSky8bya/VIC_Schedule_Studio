import {test,expect,type Page,type BrowserContext,type TestInfo} from '@playwright/test';
import {guardCompanionQa} from './helpers/companion-qa';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode()});
test.setTimeout(60000);
async function setup(page:Page,context:BrowserContext,base:string){
 const proof=await guardCompanionQa(page,context,base);
 await context.addInitScript(()=>{localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));for(const key of ['vic.ambient','vic.sound','vic.gfxPref'])localStorage.setItem(key,'off');});return proof;
}
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof setup>>,facts:unknown){
 await Promise.all(proof.pending);expect(proof.errors).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.mutations).toEqual([]);expect(proof.liveReads).toEqual([]);expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);
 await info.attach('actual-ui',{body:await page.screenshot(),contentType:'image/png'});await info.attach('observation',{body:JSON.stringify({at:new Date().toISOString(),facts,syntheticFixture:true,fullCertification:false}),contentType:'application/json'});
}
async function openSettings(page:Page){
 let button=page.getByRole('button',{name:'설정',exact:true}).filter({visible:true}).first();
 if(!await button.count()){await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();await settlePanelLayout(page);button=page.getByRole('button',{name:'설정',exact:true}).filter({visible:true}).first();}
 await button.click();
}
for(const [surface,width] of [['viewer',1440],['viewer',1920],['owner',1440],['developer',1440],['preview',1440]] as const)
test(`Text reset ${surface} ${width}: existing button restores all three only on this surface`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1100});const proof=await setup(page,context,baseURL!);
 await context.addInitScript(()=>{if(sessionStorage.getItem('qa.text-reset.seeded'))return;sessionStorage.setItem('qa.text-reset.seeded','1');localStorage.setItem('vic.prefSplit','1');for(const suffix of ['','.studio']){localStorage.setItem('vic.font'+suffix,suffix?'nanumgothic':'noto');localStorage.setItem('vic.calWeight'+suffix,'100');localStorage.setItem('vic.calText'+suffix,'18');}localStorage.setItem('qa.keep-other-setting','unchanged');});
 const url=surface==='viewer'?'/visual-fixture/poster?y=2026&m=6':`/visual-fixture/studio?role=${surface==='developer'?'developer':'owner'}&viewer=${surface==='preview'?1:0}&y=2026&m=6`;
 await page.goto(url);await settlePanelLayout(page);const suffix=surface==='owner'||surface==='developer'?'.studio':'',other=suffix?'':'.studio';
 const prefs=(s:string)=>page.evaluate(s=>({font:localStorage.getItem('vic.font'+s),weight:localStorage.getItem('vic.calWeight'+s),size:localStorage.getItem('vic.calText'+s),ambient:localStorage.getItem('vic.ambient'),sound:localStorage.getItem('vic.sound'),canary:localStorage.getItem('qa.keep-other-setting')}),s);
 const untouched=await prefs(other);await openSettings(page);const dialog=page.getByRole('dialog').filter({visible:true}),reset=dialog.getByRole('button',{name:'글자 설정 기본으로',exact:true});
 await expect(reset).toBeEnabled();await expect(reset).toHaveText('기본');await reset.click();await expect.poll(()=>prefs(suffix)).toMatchObject({font:'base',weight:'0',size:'14'});await expect(reset).toBeDisabled();expect(await prefs(other)).toEqual(untouched);
 await dialog.getByRole('radio',{name:'본고딕',exact:true}).click();await expect(reset).toBeEnabled();await reset.focus();await page.keyboard.press('Enter');await expect.poll(()=>prefs(suffix)).toMatchObject({font:'base',weight:'0',size:'14'});
 await dialog.getByRole('radio',{name:'굵게',exact:true}).click();await expect(reset).toBeEnabled();await reset.focus();await page.keyboard.press('Space');await expect.poll(()=>prefs(suffix)).toMatchObject({font:'base',weight:'0',size:'14'});await expect(reset).toBeDisabled();await expect(dialog.getByRole('radio',{name:'기본',exact:true})).toHaveAttribute('aria-checked','true');await expect(dialog.getByRole('radio',{name:'보통',exact:true})).toHaveAttribute('aria-checked','true');expect(await prefs(other)).toEqual(untouched);
 await page.reload();await settlePanelLayout(page);expect(await prefs(suffix)).toMatchObject({font:'base',weight:'0',size:'14'});expect(await prefs(other)).toEqual(untouched);await openSettings(page);await expect(page.getByRole('button',{name:'글자 설정 기본으로',exact:true})).toBeDisabled();
 await finish(page,info,proof,{surface,width,resetWithPointerEnterSpace:true,fontOnlyAndWeightOnlyEnable:true,untouchedOtherSurface:untouched,persisted:await prefs(suffix),limits:'Credential-free shared shell/preview; no genuine login or physical device.'});
});
// The fixture video is 600s; every chapter must fit its actual duration.
const entries=Array.from({length:96},(_,i)=>({sec:i*5,label:`합성 장면 ${i+1}`,section:`코너 ${Math.floor(i/12)+1}`}));
for(const [width,reduce] of [[1440,false],[1920,true],[2400,false]] as const)
test(`Timeline current ${width} reduce=${reduce}: reveal only without seek and respect search folds`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1000});const proof=await setup(page,context,baseURL!);let embeds=0;
 await context.route('**/api/public/fixture/vod-timeline?*',route=>route.fulfill({json:{authorNick:'합성',entries,variants:[]}}));await context.route('**/api/public/fixture/vod-chat?*',route=>route.fulfill({json:{binSec:30,bins:[]}}));
 await context.route(/^https:\/\/vod\.sooplive\.co\.kr\/player\/4[23]\/embed\??.*$/,route=>{embeds++;return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local media stub; playback not executed</title>'});});
 await page.goto('/visual-fixture/vod-seek?access=public');if(reduce)await page.evaluate(()=>document.documentElement.setAttribute('data-reduce-motion',''));
 const zoom=width>=2400?0.8:width>=1700?0.9:1;await page.locator('.day-vod-backdrop').evaluate((e,z)=>(e as HTMLElement).style.zoom=String(z),zoom);
 const rail=page.locator('.vch-scroll'),item=page.locator('.vch-item[data-idx="66"]'),reveal=page.getByRole('button',{name:'타임라인에서 현재 장면 보기',exact:true});await expect(page.locator('.vch-item')).toHaveCount(96);await item.click();await expect(item).toHaveAttribute('aria-current','true');await expect(reveal).toContainText('합성 장면 67');await expect(reveal).not.toContainText('현재 장면으로');await expect(reveal.locator('svg')).toHaveCount(1);
 const href=await page.locator('.dvm-ext').getAttribute('href'),clock=await page.locator('.vch-now-time').textContent(),frameUrls=await page.locator('iframe').evaluateAll(nodes=>nodes.map(n=>(n as HTMLIFrameElement).src)),embedCount=embeds;
 const visible=(idx=66)=>page.locator(`.vch-item[data-idx="${idx}"]`).evaluate(e=>{const r=e.getBoundingClientRect(),rail=e.closest('.vch-scroll') as HTMLElement,s=rail.getBoundingClientRect(),scale=s.height/rail.offsetHeight,h=e.closest('.vch-group')!.querySelector('.vch-sec')?.getBoundingClientRect().height??0;return r.top>=s.top+h+7*scale&&r.bottom<=s.bottom-27*scale;});
 const r=await rail.boundingBox();await page.mouse.move(r!.x+r!.width/2,r!.y+r!.height/2);await page.mouse.wheel(0,3800);await expect.poll(visible).toBe(false);const before=await rail.evaluate(e=>e.scrollTop);await reveal.click();await expect.poll(visible).toBe(true);expect(await rail.evaluate(e=>e.scrollTop)).toBeLessThan(before);await expect(page.locator('.dvm-ext')).toHaveAttribute('href',href!);expect(await page.locator('.vch-now-time').textContent()).toBe(clock);expect(await page.locator('iframe').evaluateAll(nodes=>nodes.map(n=>(n as HTMLIFrameElement).src))).toEqual(frameUrls);expect(embeds).toBe(embedCount);await expect(reveal).toBeFocused();
 await rail.evaluate(e=>e.scrollTop=0);await expect.poll(visible).toBe(false);await reveal.click();await expect.poll(visible).toBe(true);
 const otherGroup=page.locator('.vch-group').first();await otherGroup.locator('[data-act="vod-section-fold"]').click();await expect(otherGroup).toHaveAttribute('data-folded','');
 const group=page.locator('.vch-group').nth(5);await group.locator('[data-act="vod-section-fold"]').click();await expect(item).toHaveCount(0);await reveal.focus();await page.keyboard.press('Enter');await expect(item).toHaveAttribute('aria-current','true');await expect.poll(visible).toBe(true);await expect(otherGroup).toHaveAttribute('data-folded','');
 const field=page.getByRole('searchbox',{name:'이 영상 타임라인에서 찾기'});await field.fill('없는장면');await expect(reveal).toBeDisabled();await expect(field).toHaveValue('없는장면');await page.getByRole('button',{name:'타임라인 찾기 지우기'}).click();await expect(reveal).toBeEnabled();await reveal.focus();await page.keyboard.press('Space');await expect.poll(visible).toBe(true);await expect(page.locator('.dvm-ext')).toHaveAttribute('href',href!);
 const last=page.locator('.vch-item[data-idx="95"]');await last.click();await expect(last).toHaveAttribute('aria-current','true');const lastHref=await page.locator('.dvm-ext').getAttribute('href');await rail.evaluate(e=>e.scrollTop=0);await expect.poll(()=>visible(95)).toBe(false);await reveal.click();await expect.poll(async()=>JSON.stringify({readable:await visible(95),...await rail.evaluate(e=>{const r=e.getBoundingClientRect(),last=e.querySelector('[data-idx="95"]')!.getBoundingClientRect(),list=e.querySelector('.vch-list')!;return{top:e.scrollTop,height:e.clientHeight,total:e.scrollHeight,railTop:r.top,railBottom:r.bottom,itemTop:last.top,itemBottom:last.bottom,padding:getComputedStyle(list).paddingBottom,active:e.querySelector('.is-active')?.getAttribute('data-idx')};})})).toContain('"readable":true');await expect(page.locator('.dvm-ext')).toHaveAttribute('href',lastHref!);
 await info.attach('current-revealed',{body:await page.screenshot(),contentType:'image/png'});
 await page.locator('.vch-toggle').click();await expect(reveal).toBeDisabled();
 await finish(page,info,proof,{width,reduce,zoom,iconInExistingLabel:true,listOnlyReveal:true,bothDirectionsAboveBottomFade:true,unfoldCurrentOnly:true,searchNotCleared:true,closedListDisabled:true,mediaUrlsUnchanged:true,embeds,limits:'Actual shared production UI with studio CSS zoom model; synthetic public chapters and blocked external playback. No real media/account validation.'});
});

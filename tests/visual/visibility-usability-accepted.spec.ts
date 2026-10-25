import {test, expect, type Page, type BrowserContext, type TestInfo, type Route} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {guardCompanionQa} from './helpers/companion-qa';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
import {darkInsightsResponses} from './fixtures/dark-insights';

test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode()});
test.setTimeout(60000);
async function setup(page:Page,context:BrowserContext,base:string){
 const proof=await guardCompanionQa(page,context,base);
 await context.addInitScript(()=>{localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));for(const k of ['vic.ambient','vic.sound','vic.gfxPref'])localStorage.setItem(k,'off');});
 return proof;
}
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof setup>>,facts:unknown){
 await settlePanelLayout(page);await Promise.all(proof.pending);
 expect(proof.errors).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.mutations).toEqual([]);expect(proof.liveReads).toEqual([]);
 expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(x=>x.local===x.served)).toBe(true);
 await info.attach('actual-ui',{body:await page.screenshot(),contentType:'image/png'});
 await info.attach('observation',{body:JSON.stringify({at:new Date().toISOString(),facts,proof:{...proof,pending:undefined},syntheticFixture:true,fullCertification:false}),contentType:'application/json'});
}
async function openSearch(page:Page,width:number){
 const button=page.getByRole('button',{name:'검색',exact:true}).first();
 const b=await button.isVisible()?await button.boundingBox():null;
 if((!b||b.x+b.width<=0||b.x>=width)&&await page.getByRole('button',{name:'패널 펼치기',exact:true}).isVisible()){
  await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();await settlePanelLayout(page);
 }
 await button.click();return page.getByRole('dialog',{name:'검색',exact:true});
}
for(const [surface,width] of [['viewer',1440],['viewer',390],['studio',1440],['preview',1440]] as const)
test(`Visibility search ${surface} ${width}: applied query editing pending failure empty clear restore`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1000});const proof=await setup(page,context,baseURL!);
 const queries:string[]=[];let pending:Route|undefined;
 const response=(q:string)=>({query:q,hits:q==='빈결과'?[]:[1,2,3].map(i=>({kind:'event',eventId:`synthetic-${i}`,dateKey:`2026-06-0${i}`,title:`${q} 합성 일정 ${i}`,snippet:`${q} 공개 내용`,startTime:'20:00',score:10,exact:true,popularity:0}))});
 await context.route('**/api/public/*/search**',route=>{
  const u=new URL(route.request().url()),q=u.searchParams.get('q')??'';
  if(u.origin!==baseURL||route.request().method()!=='GET')return route.fallback();
  if(u.pathname.endsWith('/trending'))return route.fulfill({json:{trends:[]}});
  if(u.pathname.endsWith('/suggest'))return route.fulfill({json:{items:[]}});
  queries.push(q);if(q==='노래'){pending=route;return;}if(q==='실패')return route.fulfill({status:503,json:{error:'Synthetic unavailable'}});
  return route.fulfill({json:response(q)});
 });
 await page.goto(surface==='viewer'?'/visual-fixture/poster':`/visual-fixture/studio?role=owner&y=2026&m=6${surface==='preview'?'&viewer=1':''}`);await settlePanelLayout(page);
 let sheet=await openSearch(page,width);let input=sheet.getByRole('searchbox',{name:'검색어',exact:true});
 await input.fill('마크');await input.press('Enter');await expect(sheet.locator('.ps-event')).toHaveCount(3);await expect(sheet.locator('.ps-results mark')).toHaveCount(6);
 await input.fill('노래');await expect(sheet.locator('.ps-applied-query')).toHaveText('마크 결과 · Enter로 새 검색');await expect(sheet.locator('.ps-results mark')).toHaveText(Array(6).fill('마크'));expect(queries).toEqual(['마크']);
 await info.attach('actual-edited-query',{body:await page.screenshot(),contentType:'image/png'});
 await input.press('Enter');await expect.poll(()=>Boolean(pending)).toBe(true);await expect(sheet.locator('.ps-applied-query')).toHaveText('마크 결과 · 새 검색 중…');await expect(sheet.locator('.ps-results mark')).toHaveText(Array(6).fill('마크'));
 await pending!.fulfill({json:response('노래')});await expect(sheet.locator('.ps-event').first()).toContainText('노래');await expect(sheet.locator('.ps-applied-query')).toHaveCount(0);
 await input.fill('실패');await input.press('Enter');await expect(sheet.locator('.ps-fail')).toBeVisible();await expect(sheet.locator('.ps-applied-query')).toContainText('노래 결과');await expect(sheet.locator('.ps-results mark')).toHaveText(Array(6).fill('노래'));
 await input.fill('빈결과');await input.press('Enter');await expect(sheet.locator('.ps-hint').filter({hasText:'없음'})).toContainText('빈결과');await input.fill('새입력');await expect(sheet.locator('.ps-hint').filter({hasText:'없음'})).toContainText('빈결과');await expect(sheet.locator('.ps-applied-query')).toContainText('빈결과 결과');
 await sheet.getByRole('button',{name:'지우기',exact:true}).click();await expect(input).toHaveValue('');await expect(sheet.locator('.ps-applied-query')).toHaveCount(0);await expect(sheet.locator('.ps-event')).toHaveCount(0);
 await input.fill('복귀');await input.press('Enter');await expect(sheet.locator('.ps-event')).toHaveCount(3);await input.fill('입력중');const count=queries.length;
 await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,bubbles:true});await page.waitForTimeout(180);expect(queries).toHaveLength(count);await expect(sheet.locator('.ps-applied-query')).toContainText('복귀 결과');
 await page.keyboard.press('Escape');await expect(sheet).toHaveCount(0);sheet=await openSearch(page,width);input=sheet.getByRole('searchbox',{name:'검색어',exact:true});await expect(input).toHaveValue('입력중');await expect(sheet.locator('.ps-applied-query')).toContainText('복귀 결과');await expect(sheet.locator('.ps-results mark')).toHaveText(Array(6).fill('복귀'));expect(queries).toHaveLength(count);
 await sheet.getByRole('button',{name:'최신',exact:true}).click();await expect(sheet.locator('.ps-applied-query')).toContainText('복귀 결과');expect(queries).toHaveLength(count);
 await finish(page,info,proof,{surface,width,queries,appliedQueryBoundToSuccessfulResponse:true,originalMarksPreserved:true,zeroResultQueryCorrect:true,syntheticCompositionGuard:true,restoreNoFetch:true,limits:'Synthetic query/results; no OS IME, actual login or real-user statistics.'});
});

const entries=Array.from({length:72},(_,i)=>({sec:i*8,label:i===66?'보스전 시작':`합성 구간 ${i+1}`,section:`코너 ${Math.floor(i/12)+1}`}));
for(const access of ['sub','plus','public'] as const)for(const width of [1440,390])
test(`Visibility timeline ${access} ${width}: local find original time keyboard clear and folds`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1000});const proof=await setup(page,context,baseURL!);let reads=0;const embeds:string[]=[];
 await context.route('**/api/public/fixture/vod-timeline?*',route=>{reads++;return route.fulfill({json:{authorNick:'합성 작성자',entries,variants:[]}});});
 await context.route('**/api/public/fixture/vod-chat?*',route=>route.fulfill({json:{binSec:30,bins:[]}}));
 await context.route(/^https:\/\/vod\.sooplive\.co\.kr\/player\/4[23]\/embed\??.*$/,route=>{embeds.push(route.request().url());return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic media endpoint — no playback</title>'});});
 await context.addInitScript(()=>{const w=window as Window & {opens?:string[]};w.opens=[];window.open=url=>{w.opens!.push(String(url));return null;};});
 await page.goto(`/visual-fixture/vod-seek?access=${access}`);await expect(page.locator('.vch-item')).toHaveCount(72);const field=page.getByRole('searchbox',{name:'이 영상 타임라인에서 찾기'});
 const first=page.locator('.vch-group').first();await first.locator('[data-act="vod-section-fold"]').click();await expect(first).toHaveAttribute('data-folded','');
 await field.fill('보스 전');await expect(page.locator('.vch-item')).toHaveCount(1);const match=page.locator('.vch-item');await expect(match).toHaveAttribute('data-idx','66');await expect(match).toHaveAttribute('href','https://vod.sooplive.co.kr/player/42?change_second=528');await expect(page.locator('.vch-group')).toContainText('코너 6');await expect(page.locator('.vch-find-count')).toHaveText('1 / 72');
 const oldHref=await page.locator('.dvm-ext').getAttribute('href');await field.press('ArrowDown');await field.press('ArrowUp');await field.press(']');await field.press('c');await field.press('Space');await expect(page.locator('.vod-chapters')).toHaveAttribute('data-open','');expect(await page.locator('.dvm-ext').getAttribute('href')).toBe(oldHref);expect(await page.evaluate(()=>(window as Window & {opens?:string[]}).opens)).toEqual([]);
 await field.fill('보스전');await info.attach('actual-timeline-find',{body:await page.screenshot(),contentType:'image/png'});await match.click();await expect(page.locator('.dvm-ext')).toHaveAttribute('href','https://vod.sooplive.co.kr/player/42?change_second=528');
 if(access==='public'){await expect(page.locator('iframe')).not.toHaveCount(0);expect(await page.evaluate(()=>(window as Window & {opens?:string[]}).opens)).toEqual([]);}else{await expect(page.locator('iframe')).toHaveCount(0);expect(await page.evaluate(()=>(window as Window & {opens?:string[]}).opens)).toEqual(['https://vod.sooplive.co.kr/player/42?change_second=528']);}
 await page.getByRole('button',{name:'타임라인 찾기 지우기'}).focus();await page.keyboard.press('Enter');await expect(field).toHaveValue('');await expect(field).toBeFocused();await expect(page.locator('.vch-item')).toHaveCount(60);await expect(page.locator('.vch-group').first()).toHaveAttribute('data-folded','');await expect(page.locator('.vch-item[data-idx="66"]')).toHaveAttribute('aria-current','true');
 await expect.poll(()=>page.locator('.vch-item[data-idx="66"]').evaluate(e=>{const r=e.getBoundingClientRect(),s=e.closest('.vch-scroll')!.getBoundingClientRect();return r.top>=s.top&&r.bottom<=s.bottom;})).toBe(true);
 await field.fill('코너 1');await expect(page.locator('.vch-item')).toHaveCount(12);await expect(page.locator('.vch-item').first()).toHaveAttribute('data-idx','0');await field.fill('없는장면');await expect(page.locator('.vch-item')).toHaveCount(0);await expect(page.locator('.vch-note')).toContainText('일치하는 타임라인이 없어요');await page.getByRole('button',{name:'타임라인 찾기 지우기'}).click();expect(reads).toBe(1);
 const stored=await page.evaluate(()=>JSON.stringify({local:{...localStorage},session:{...sessionStorage},url:location.href}));expect(stored).not.toMatch(/보스|없는장면/);
 await finish(page,info,proof,{access,width,timelineReads:reads,originalIndex:66,originalSeconds:528,foldRestored:true,inputKeysDoNotSeek:true,findTermsNotPersisted:true,embedsLocallyFulfilled:embeds.length,limits:'Actual shared controls with synthetic public chapters; external opening intercepted, ordinary embed locally fulfilled; no SOOP playback/subscription authentication/real device.'});
});
test('Visibility timeline variant: short list hides find and switching clears transient query',async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!);let reads=0;
 const variants=[{id:'long',authorNick:'합성 긴 목록',entries},{id:'short',authorNick:'합성 짧은 목록',entries:entries.slice(0,4)}];
 await context.route('**/api/public/fixture/vod-timeline?*',route=>{reads++;return route.fulfill({json:{authorNick:'합성 긴 목록',entries,variants}});});await context.route('**/api/public/fixture/vod-chat?*',route=>route.fulfill({json:{binSec:30,bins:[]}}));
 await page.goto('/visual-fixture/vod-seek?access=sub');const field=page.getByRole('searchbox',{name:'이 영상 타임라인에서 찾기'});await field.fill('보스전');await expect(page.locator('.vch-item')).toHaveCount(1);
 await page.getByRole('button',{name:'타임라인 선택'}).click();await page.getByRole('option',{name:/다른 타임라인 1/}).click();await expect(field).toHaveCount(0);await expect(page.locator('.vch-item')).toHaveCount(4);
 await page.getByRole('button',{name:'타임라인 선택'}).click();await page.getByRole('option',{name:/대표/}).click();await expect(field).toHaveValue('');await expect(page.locator('.vch-item')).toHaveCount(72);expect(reads).toBe(1);await finish(page,info,proof,{shortList:4,longList:72,variantSwitchClearsQuery:true,reads});
});

async function mockInsights(context:BrowserContext,base:string){
 const manifest=JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR??'.next','server/server-reference-manifest.json'),'utf8')).node as Record<string,{exportedName?:string}>;
 const baseline=darkInsightsResponses.getInsightsAction.data,trend={...darkInsightsResponses.getTrendAction.data,months:['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06']};
 const responses:Record<string,unknown>={...darkInsightsResponses,getTrendAction:{ok:true,data:trend},getOwnerSecurityAction:{ok:false,error:'Synthetic scope excludes security data'},getMemberInsightsAction:{ok:true,data:{month:{year:2026,month:6},content:{...baseline.content,tags:[]},engagement:{...baseline.engagement,topTitles:[]},trend:{...trend,hearts:[1,2,3,4,5,6]}}}};
 const reads:string[]=[];await context.route('**/api/developer/presence',route=>route.fulfill({status:404,body:'Synthetic excluded operating presence'}));
 await context.route('**/visual-fixture/studio?**',route=>{const req=route.request(),u=new URL(req.url()),name=manifest[req.headers()['next-action']]?.exportedName;if(u.origin!==base||req.method()!=='POST'||!name||!(name in responses))return route.fallback();reads.push(name);return route.fulfill({contentType:'text/x-component',body:`0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(responses[name])}\n`});});return reads;
}
for(const role of ['owner','developer'] as const)for(const width of [1440,390])
test(`Visibility insights ${role} ${width}: filled rows all tabs native keyboard and no highlight`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1000});const proof=await setup(page,context,baseURL!),reads=await mockInsights(context,baseURL!);
 await page.goto(`/visual-fixture/studio?role=${role}&y=2026&m=6`);await settlePanelLayout(page);const open=width<=640?page.locator('[data-act="m-rail-insights"]'):page.locator('[data-act="manage-insights"]');const box=await open.isVisible()?await open.boundingBox():null;if(width>640&&(!box||box.x+box.width<=0||box.x>=width)){await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();await settlePanelLayout(page);}await open.click();await expect(page.locator('.bcast-daily')).toBeVisible();await settlePanelLayout(page);
 const list=page.getByRole('tablist',{name:'인사이트 영역'}),tabs=list.getByRole('tab'),labels=role==='owner'?['트렌드','일정','참여','보안']:['트렌드','일정','참여','실시간','방문','보안','시스템'];await expect(tabs).toHaveText(labels);
 const rows=await list.locator('.insights-tab-row').evaluateAll(rs=>rs.map(r=>{const box=r.getBoundingClientRect(),buttons=[...r.querySelectorAll('button')].map(b=>{const x=b.getBoundingClientRect();return {left:x.left,right:x.right,width:x.width,text:b.textContent,overflow:b.scrollWidth>b.clientWidth+1};});return {left:box.left,right:box.right,buttons};}));
 expect(rows.map(r=>r.buttons.length)).toEqual(role==='owner'?[4]:[3,4]);for(const row of rows){expect(Math.abs(row.buttons[0].left-row.left)).toBeLessThan(1);expect(Math.abs(row.buttons.at(-1)!.right-row.right)).toBeLessThan(1);expect(Math.max(...row.buttons.map(b=>b.width))-Math.min(...row.buttons.map(b=>b.width))).toBeLessThan(1);expect(row.buttons.every(b=>!b.overflow)).toBe(true);}
 for(let i=0;i<labels.length;i++){await tabs.nth(i).click();await expect(page.locator('.insights-track')).toHaveAttribute('data-active',String(i));}
 await tabs.first().focus();await page.keyboard.press('Home');await expect(tabs.first()).toBeFocused();await expect(tabs.first()).toHaveAttribute('aria-selected','true');await page.keyboard.press('End');await expect(tabs.last()).toBeFocused();await expect(tabs.last()).toHaveAttribute('aria-selected','true');await page.keyboard.press('ArrowLeft');await expect(tabs.nth(labels.length-2)).toBeFocused();
 if(role==='developer'){await page.keyboard.press('Home');await page.keyboard.press('ArrowDown');await expect(tabs.nth(3)).toBeFocused();await page.keyboard.press('ArrowUp');await expect(tabs.first()).toBeFocused();}
 expect(await tabs.evaluateAll(bs=>bs.filter(b=>(b as HTMLElement).tabIndex===0).length)).toBe(1);await expect(page.getByRole('tab',{name:'하이라이트',exact:true})).toHaveCount(0);await expect(page.locator('.highlight-card,.highlight-grid')).toHaveCount(0);
 await finish(page,info,proof,{role,width,labels,rows,readActions:reads,nativeHomeEndArrows:true,oneTabStop:true,noPlaceholderSlots:true,limits:'Synthetic role/data fixture; no actual login/RLS or production analytics.'});
});

test('Visibility public records preview: remaining content without redundant tab rail',async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!);await context.route('**/api/public/*/broadcast?*',route=>route.fulfill({json:{months:[],daily:[]}}));await page.goto('/visual-fixture/studio?role=owner&viewer=1&y=2026&m=6');await settlePanelLayout(page);await page.locator('.viewer-fullscreen').getByRole('button',{name:'기록',exact:true}).click();const sheet=page.getByRole('dialog',{name:'6월 기록'});await expect(sheet).toBeVisible();await expect(sheet.getByRole('tablist')).toHaveCount(0);await expect(sheet.locator('.highlight-card,.highlight-grid')).toHaveCount(0);await expect(sheet).toContainText('방송 시간');await finish(page,info,proof,{surface:'actual embedded preview',recordsRetainContent:true,noSingleOptionTabOrHighlight:true});
});

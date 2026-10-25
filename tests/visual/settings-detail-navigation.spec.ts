import {test,expect,type Page,type BrowserContext,type TestInfo} from '@playwright/test';
import {guardCompanionQa} from './helpers/companion-qa';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode()});
test.setTimeout(70000);
async function setup(page:Page,context:BrowserContext,base:string,width:number){
 await page.setViewportSize({width,height:1000});const proof=await guardCompanionQa(page,context,base);
 await context.addInitScript(()=>{
  localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));for(const k of ['vic.ambient','vic.sound','vic.gfxPref'])localStorage.setItem(k,'off');
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as Window & {copied?:string[]}).copied=[text];}}});
 });
 // Existing developer links may prefetch when their pane becomes visible.
 // Fulfill only these two read-only destinations locally; never execute a
 // studio loader or broaden the shared network guard.
 await context.route('**/studio/**',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base&&request.method()==='GET'&&['/studio/ambient-art','/studio/search-dictionary','/studio/timelines'].includes(url.pathname)){
   proof.syntheticReads.push('excluded-developer-prefetch:'+url.pathname);
   return route.fulfill({status:404,contentType:'text/plain',body:'Synthetic excluded developer destination; request not delivered.'});
  }
  return route.fallback();
 });
 await context.route('**/api/visual-fixture/premiere?*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base&&request.method()==='GET'&&url.pathname==='/api/visual-fixture/premiere'){
   proof.syntheticReads.push('/api/visual-fixture/premiere');return route.continue();
  }
  return route.fallback();
 });return proof;
}
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof setup>>,facts:unknown){
 await settlePanelLayout(page);await Promise.all(proof.pending);
 expect(proof.errors).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.mutations).toEqual([]);expect(proof.liveReads).toEqual([]);
 expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);
 await info.attach('actual-ui',{body:await page.screenshot(),contentType:'image/png'});
 await info.attach('observation',{body:JSON.stringify({at:new Date().toISOString(),facts,syntheticFixture:true,fullCertification:false,proof:{...proof,pending:undefined}}),contentType:'application/json'});
}
async function openSettings(page:Page,width:number){
 let button=page.getByRole('button',{name:'설정',exact:true}).filter({visible:true}).first();
 const box=await button.count()?await button.boundingBox():null;
 if(width>640&&(!box||box.x+box.width<=0||box.x>=width)){
  await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();await settlePanelLayout(page);button=page.getByRole('button',{name:'설정',exact:true}).filter({visible:true}).first();
 }
 await button.click();const dialog=page.getByRole('dialog',{name:'설정',exact:true});await expect(dialog).toBeVisible();await settlePanelLayout(page);return dialog;
}
async function compactSettingsPane(page:Page){
 const measured=await page.locator('.rhh-panes > .rhh-group.is-active').evaluate(group=>{
  const heading=group.querySelector('.rhh-group-title')!.getBoundingClientRect();
  const firstContent=group.children[1].getBoundingClientRect();
  return {headingGap:firstContent.top-heading.bottom,switchRowHeights:[...group.querySelectorAll('.rhh-group-card > .role-help-haptics:has([role="switch"])')].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height)};
 });
 expect(measured.headingGap).toBeGreaterThanOrEqual(0);expect(measured.headingGap).toBeLessThan(24);
 for(const height of measured.switchRowHeights)expect(height).toBeLessThan(120);
 return measured;
}
for(const surface of ['viewer','owner','developer','preview'] as const)for(const width of [1440,390])
test(`Navigation settings ${surface} ${width}: categories keys persistence and stable geometry`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);await page.goto(surface==='viewer'?'/visual-fixture/poster':`/visual-fixture/studio?role=${surface==='developer'?'developer':'owner'}&y=2026&m=6${surface==='preview'?'&viewer=1':''}`);await settlePanelLayout(page);
 let dialog=await openSettings(page,width);let nav=dialog.getByRole('tablist',{name:'설정 묶음'});await expect(nav).toHaveAttribute('aria-orientation',width===390?'horizontal':'vertical');
 const labels=await nav.getByRole('tab').filter({visible:true}).allTextContents();for(const label of ['글자','소리','화면','움직임'])expect(labels).toContain(label);
 if(width===390){expect(labels).not.toContain('배경');expect(labels).not.toContain('개발자');expect(labels).not.toContain('빅타민');}
 const start=await dialog.boundingBox();await nav.getByRole('tab',{name:'움직임',exact:true}).click();await settlePanelLayout(page);
 await expect(dialog.locator('.rhh-panes > [role="tabpanel"]:visible')).toHaveCount(1);await expect(dialog.locator('[data-act="생동감 있는 동작 켜기/끄기"]')).toBeInViewport();
 const compactMotion=await compactSettingsPane(page);
 const end=await dialog.boundingBox();expect(Math.abs(end!.height-start!.height)).toBeLessThan(1);expect(Math.abs(end!.y-start!.y)).toBeLessThan(1);
 await info.attach('settings-categories',{body:await page.screenshot(),contentType:'image/png'});
 await nav.getByRole('tab',{name:'움직임',exact:true}).focus();await page.keyboard.press(width===390?'ArrowLeft':'ArrowUp');await expect(nav.getByRole('tab',{name:'화면',exact:true})).toBeFocused();
 await page.keyboard.press('Home');await expect(nav.getByRole('tab',{name:'글자',exact:true})).toBeFocused();await page.keyboard.press('End');
 expect(await nav.getByRole('tab').evaluateAll(bs=>bs.filter(b=>(b as HTMLElement).tabIndex===0&&b.getClientRects().length).length)).toBe(1);
 await page.keyboard.press('Tab');expect(await nav.evaluate(e=>e.contains(document.activeElement))).toBe(false);
 await nav.getByRole('tab',{name:'화면',exact:true}).click();await dialog.getByRole('radio',{name:'어둡게',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);await expect(page.getByRole('button',{name:'설정',exact:true}).filter({visible:true}).first()).toBeFocused();
 dialog=await openSettings(page,width);nav=dialog.getByRole('tablist',{name:'설정 묶음'});await nav.getByRole('tab',{name:'화면',exact:true}).click();await expect(dialog.getByRole('radio',{name:'어둡게',exact:true})).toHaveAttribute('aria-checked','true');
 const compactScreen=await compactSettingsPane(page);
 await finish(page,info,proof,{surface,width,labels,onePanel:true,horizontalOrVerticalNativeKeys:true,persistedTheme:true,stableHeight:true,compactMotion,compactScreen,limit:'Browser viewport/synthetic role; no physical device/login/RLS.'});
});

test('Navigation settings resize 320: hidden desktop category falls back without blank content',async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,1440);await page.goto('/visual-fixture/poster');const dialog=await openSettings(page,1440),nav=dialog.getByRole('tablist',{name:'설정 묶음'});await nav.getByRole('tab',{name:'배경',exact:true}).click();
 await page.setViewportSize({width:320,height:740});await settlePanelLayout(page);await expect(nav).toHaveAttribute('aria-orientation','horizontal');await expect(nav.getByRole('tab',{name:'글자',exact:true})).toHaveAttribute('aria-selected','true');
 await expect(dialog.locator('.rhh-panes > [role="tabpanel"]:visible')).toHaveCount(1);await nav.getByRole('tab',{name:'움직임',exact:true}).click();await expect(dialog.locator('[data-act="생동감 있는 동작 켜기/끄기"]')).toBeInViewport();
 const panels=[];for(const label of ['글자','소리','화면','움직임']){await nav.getByRole('tab',{name:label,exact:true}).click();await settlePanelLayout(page);panels.push({label,...await compactSettingsPane(page)});}
 await page.setViewportSize({width:320,height:568});await settlePanelLayout(page);await expect(dialog.locator('[data-act="생동감 있는 동작 켜기/끄기"]')).toBeInViewport();const shortMotion=await compactSettingsPane(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await finish(page,info,proof,{width:320,shortHeight:568,resizeFallback:true,noBlankPane:true,noPageOverflow:true,panels,shortMotion});
});

const detail=(page:Page)=>page.getByRole('dialog',{name:'일정 상세',exact:true});
for(const width of [1440,390])test(`Navigation history ${width}: incoming link steps reload back forward and outside card`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width),clean='/visual-fixture/poster?monthLink=1&month=2026-06';
 await page.goto(clean);await settlePanelLayout(page);await page.goto(clean+'&event=evt-001');await expect(detail(page)).toContainText('픽크타 1일차');
 await detail(page).getByRole('button',{name:'다음 일정',exact:true}).click();await expect(detail(page)).toContainText('픽크타 4일차');await page.reload();await expect(detail(page)).toContainText('픽크타 4일차');
 await page.goBack();await expect(detail(page)).toHaveCount(0);expect(new URL(page.url()).searchParams.get('month')).toBe('2026-06');await page.goForward();await expect(detail(page)).toContainText('픽크타 4일차');
 if(width===1440){await page.locator('.public-event[data-eventid="evt-001"]').first().click();await expect(detail(page)).toContainText('픽크타 1일차');}
 await page.keyboard.press('Escape');await expect(detail(page)).toHaveCount(0);expect(new URL(page.url()).searchParams.has('event')).toBe(false);
 await finish(page,info,proof,{width,incomingStepsReloadBackForward:true,outsideCardDirectReplacement:width===1440,closeRemovesIncomingAddress:true});
});
for(const width of [1440,390])test(`Navigation spanning ${width}: previous month event is reachable once and keeps current month`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);await page.goto('/visual-fixture/poster?navSpan=1&monthLink=1&month=2026-06&event=fixture-nav-span');await expect(detail(page)).toContainText('전월에서 이어진 공개 일정');await settlePanelLayout(page);
 await expect(detail(page).locator('.agenda-detail-date')).toContainText('6.1');await expect(detail(page).getByRole('button',{name:'이전 일정',exact:true})).toBeDisabled();
 await detail(page).getByRole('button',{name:'다음 일정',exact:true}).click();await expect(detail(page)).toContainText('픽크타 1일차');await detail(page).getByRole('button',{name:'이전 일정',exact:true}).click();await expect(detail(page)).toContainText('전월에서 이어진 공개 일정');
 expect(new URL(page.url()).searchParams.get('month')).toBe('2026-06');await page.reload();await expect(detail(page)).toContainText('전월에서 이어진 공개 일정');await page.keyboard.press('Escape');
 const card=page.locator(`${width===390?'.agenda-day[data-flip-key="2026-06-01"]':'.public-day[data-date="2026-06-01"]'} [data-eventid="fixture-nav-span"]`).first();await expect(card).toBeFocused();
 await finish(page,info,proof,{width,monthSpanningEventReachable:true,firstIntersectingDay:'2026-06-01',shareReloadAndFocus:true,noDuplicateNavigationTarget:true});
});
for(const surface of ['viewer','preview'] as const)for(const width of [1440,390])
test(`Navigation details ${surface} ${width}: same window boundaries link focus and no extra read`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);await page.goto(surface==='viewer'?'/visual-fixture/poster?monthLink=1&month=2026-06':'/visual-fixture/studio?role=owner&viewer=1&y=2026&m=6');await settlePanelLayout(page);
 const root=surface==='preview'?page.locator('.viewer-fullscreen'):page.locator('body'),card=(id:string)=>root.locator(`${width===390?'.agenda-event':'.public-event'}[data-eventid="${id}"]`).first();
 const originalUrl=page.url();await card('evt-001').click();await expect(detail(page)).toContainText('픽크타 1일차');
 await detail(page).evaluate(e=>(window as Window & {originalDetail?:Element}).originalDetail=e);
 const nav=detail(page).getByRole('navigation',{name:'일정 이동'}),previous=nav.getByRole('button',{name:'이전 일정',exact:true}),next=nav.getByRole('button',{name:'다음 일정',exact:true});
 await expect(previous).toBeDisabled();await next.focus();await page.keyboard.press('Enter');await expect(detail(page)).toContainText('픽크타 4일차');
 expect(await detail(page).evaluate(e=>(window as Window & {originalDetail?:Element}).originalDetail===e)).toBe(true);await expect(card('evt-002')).toHaveClass(/detail-current/);
 if(surface==='viewer')expect(new URL(page.url()).searchParams.get('event')).toBe('evt-002');else expect(page.url()).toBe(originalUrl);
 await detail(page).locator('[data-act="share-public-event"]').click();const href=await page.evaluate(()=>(window as Window & {copied?:string[]}).copied?.[0]);expect(new URL(href!).searchParams.get('event')).toBe('evt-002');
 await info.attach('detail-next',{body:await page.screenshot(),contentType:'image/png'});
 let steps=1;while(await next.isEnabled()&&steps<12){await next.click();steps++;}await expect(next).toBeDisabled();await expect(previous).toBeFocused();expect(steps).toBe(6);
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');expect(await detail(page).evaluate(e=>e.contains(document.activeElement))).toBe(true);}
 while(await previous.isEnabled()){await previous.click();}await expect(previous).toBeDisabled();await expect(next).toBeFocused();
 await page.keyboard.press('Escape');await expect(detail(page)).toHaveCount(0);await expect(card('evt-001')).toBeFocused();
 if(surface==='viewer')expect(new URL(page.url()).searchParams.has('event')).toBe(false);
 await finish(page,info,proof,{surface,width,sameDom:true,boundarySteps:steps,shareFollowsCurrent:true,tabContained:true,escapeReturnsToSelectedCard:true,previewAddressUntouched:surface==='preview',limit:'Synthetic public events; no actual role authentication.'});
});

for(const width of [1440,390])test(`Navigation detail single filter ${width}: one ordinary item omits controls`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);await page.goto('/visual-fixture/poster?avatar=1&monthLink=1&month=2026-06');await settlePanelLayout(page);
 const tags=page.locator('[data-act="legend-item"]:visible,[data-act="agenda-legend-tag"]:visible');let rest=tags.filter({hasText:'휴뱅'}).first();
 if(width>640&&!await rest.count()){await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();await settlePanelLayout(page);rest=tags.filter({hasText:'휴뱅'}).first();}
 await rest.click();if(width>640){await page.getByRole('button',{name:'패널 접기',exact:true}).click();await settlePanelLayout(page);}await page.locator(`${width===390?'.agenda-event':'.public-event'}[data-eventid="evt-003"]`).first().click();await expect(detail(page)).toContainText('휴뱅');await expect(detail(page).getByRole('navigation',{name:'일정 이동'})).toHaveCount(0);
 await finish(page,info,proof,{width,selectedTag:'synthetic rest',singleMatchingEvent:true,noRedundantNavigation:true});
});

for(const width of [1440,390])test(`Navigation detail teaser ${width}: unrevealed item has no next previous controls`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);await page.goto('/visual-fixture/poster?teaser=600');await settlePanelLayout(page);await page.locator('[data-eventid="00000000-0000-4000-8000-000000000001"]').first().click();await expect(detail(page)).toBeVisible();await expect(detail(page)).toHaveClass(/is-teaser/);await expect(detail(page).getByRole('navigation',{name:'일정 이동'})).toHaveCount(0);
 await finish(page,info,proof,{width,unrevealedExcluded:true,noNavigationFromTeaser:true});
});

for(const width of [1440,390])test(`Navigation focus transfer ${width}: opening search or settings wins over detail return`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);
 await context.route('**/api/public/*/search/trending',route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===baseURL&&request.method()==='GET')return route.fulfill({json:{trends:[]}});
  return route.fallback();
 });
 await page.goto('/visual-fixture/poster');await settlePanelLayout(page);
 const card=page.locator(`${width===390?'.agenda-event':'.public-event'}[data-eventid="evt-001"]`).first();await card.click();await expect(detail(page)).toBeVisible();await page.keyboard.press('/');const search=page.getByRole('dialog',{name:'검색',exact:true});await expect(search).toBeVisible();await expect(search.getByRole('searchbox',{name:'검색어',exact:true})).toBeFocused();await expect(detail(page)).toHaveCount(0);await page.keyboard.press('Escape');
 await card.click();await expect(detail(page)).toBeVisible();if(width===390)await page.keyboard.press('Escape');const settings=await openSettings(page,width);expect(await settings.evaluate(e=>e.contains(document.activeElement))).toBe(true);
 await finish(page,info,proof,{width,searchFocusPreserved:true,settingsFocusPreserved:true,settingsOpenedDirectlyFromDetail:width===1440});
});

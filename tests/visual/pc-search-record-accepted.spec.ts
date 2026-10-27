import {test,expect,type Page,type BrowserContext,type TestInfo} from '@playwright/test';
import {guardCompanionQa} from './helpers/companion-qa';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';

test.use({viewport:{width:1440,height:1100},serviceWorkers:'block',video:'on',trace:companionTraceMode()});
test.setTimeout(60000);
type Surface='viewer'|'studio'|'preview';
async function setup(page:Page,context:BrowserContext,base:string){
 const proof=await guardCompanionQa(page,context,base),requests:string[]=[];let fail=false,slow=false;
 await page.addInitScript(()=>{localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));for(const k of ['vic.ambient','vic.sound','vic.gfxPref'])localStorage.setItem(k,'off');});
 await context.route('**/api/public/*/search**',r=>{
  const u=new URL(r.request().url());if(r.request().method()!=='GET'||u.origin!==base)return r.fallback();
  if(u.pathname.endsWith('/trending'))return r.fulfill({json:{trends:[]}});if(u.pathname.endsWith('/suggest'))return r.fulfill({json:{items:[]}});if(!u.pathname.endsWith('/search'))return r.fallback();
  const q=u.searchParams.get('q')??'',common={dateKey:'2026-06-16',score:1,exact:true,popularity:.5},event={...common,kind:'event',eventId:'evt-001',title:q+' 일정',snippet:'합성 공개 일정',startTime:'20:00'};
  const hits=q==='한도'?Array.from({length:200},(_,i)=>({...event,eventId:'bounded-'+i})):q==='일정만'?[event]:[event,{...common,kind:'vod',titleNo:90000001,title:q+' 다시보기',snippet:'',durationMs:3600000},{...common,kind:'chapter',titleNo:90000001,sec:120,title:q+' 챕터',snippet:q+' 다시보기',durationMs:3600000}];
  return r.fulfill({json:{query:q,hits}});
 });
 await context.route('**/api/public/*/broadcast?**',async r=>{
  const u=new URL(r.request().url());if(r.request().method()!=='GET'||u.origin!==base)return r.fallback();
  requests.push(u.search);const month=Number(u.searchParams.get('month')),ym=u.searchParams.get('year')+'-'+String(month).padStart(2,'0');
  if(slow&&month===5)await new Promise(resolve=>setTimeout(resolve,350));
  return fail?r.fulfill({status:503,json:{}}):r.fulfill({json:{months:[{ym,hours:month,days:1,sessions:1}],daily:Array.from({length:31},(_,i)=>i===17?month:0)}});
 });
 await context.route('**/api/visual-fixture/premiere?*',r=>{const u=new URL(r.request().url());if(r.request().method()==='GET'&&u.origin===base){proof.syntheticReads.push('/api/visual-fixture/premiere');return r.continue();}return r.fallback();});
 await page.addInitScript(()=>{
  const target=window as Window & {pcControlAudit?:{target:string;keyboard:boolean}[]};target.pcControlAudit=[];
  document.addEventListener('click',event=>{const el=(event.target as Element|null)?.closest('[data-act]');const action=el?.getAttribute('data-act');if(!action||!['search-kind','record-month','record-summary','record-event-open'].includes(action))return;const opt=el?.getAttribute('data-act-opt');target.pcControlAudit!.push({target:action+(opt?'#'+opt:''),keyboard:event.detail===0});},true);
 });
 return {proof,requests,setFail:(v:boolean)=>{fail=v;},setSlow:(v:boolean)=>{slow=v;}};
}
async function finish(page:Page,info:TestInfo,s:Awaited<ReturnType<typeof setup>>,facts:unknown){
 await settlePanelLayout(page);await Promise.all(s.proof.pending);expect(s.proof.errors).toEqual([]);expect(s.proof.rejected).toEqual([]);expect(s.proof.mutations).toEqual([]);expect(s.proof.liveReads).toEqual([]);expect(s.proof.chunks.length).toBeGreaterThan(0);expect(s.proof.chunks.every(c=>c.served===c.local)).toBe(true);
 const activity=await page.evaluate(()=>(window as Window & {pcControlAudit?:unknown[]}).pcControlAudit??[]);
 await info.attach('control-audit',{body:JSON.stringify({readOnlyDomAudit:true,productionTelemetrySuppressed:true,events:activity}),contentType:'application/json'});
 await info.attach('actual-ui',{body:await page.screenshot(),contentType:'image/png'});await info.attach('observation',{body:JSON.stringify({at:new Date().toISOString(),facts,syntheticFixture:true,fullCertification:false,proof:{...s.proof,pending:undefined}}),contentType:'application/json'});
}
async function goto(page:Page,surface:Surface,month=6){await page.goto(surface==='viewer'?`/visual-fixture/poster?monthLink=1&month=2026-${String(month).padStart(2,'0')}`:`/visual-fixture/studio?role=owner&y=2026&m=${month}${surface==='preview'?'&viewer=1':''}`);await settlePanelLayout(page);}
async function openSearch(page:Page){let b=page.getByRole('button',{name:'검색',exact:true}).filter({visible:true}).first();const box=await b.count()?await b.boundingBox():null;if(!box||box.x<0){await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();await settlePanelLayout(page);b=page.getByRole('button',{name:'검색',exact:true}).filter({visible:true}).first();}await b.click();const sheet=page.getByRole('dialog',{name:'검색',exact:true});await expect(sheet).toBeVisible();return sheet;}
async function openRecord(page:Page){await page.getByRole('button',{name:/^(이 달 )?기록$/}).first().click();const sheet=page.locator('.pi-sheet').filter({has:page.locator('.pi-record-month')});await expect(sheet).toBeVisible();return sheet;}

for(const surface of ['viewer','studio','preview'] as const)test(`Accepted PC search kinds ${surface}: choose sort return empty cap and clear`,async({page,context,baseURL},info)=>{
 const s=await setup(page,context,baseURL!);await goto(page,surface);let sheet=await openSearch(page);let input=sheet.getByRole('searchbox',{name:'검색어',exact:true});await input.fill('갈틱쇼');await input.press('Enter');await expect(sheet.locator('[data-act="search-hit-chapter"]')).toHaveCount(1);
 const kind=(v:string)=>sheet.locator(`[data-act="search-kind"][data-act-opt="${v}"]`);
 await kind('event').click();await expect(sheet.locator('.ps-event')).toHaveCount(1);await expect(sheet.locator('.ps-vod')).toHaveCount(0);await sheet.locator('[data-sort="newest"]').click();await sheet.locator('.ps-event').click();await expect(sheet).toHaveCount(0);sheet=await openSearch(page);await expect(kind('event')).toHaveAttribute('aria-pressed','true');await expect(sheet.locator('[data-sort="newest"]')).toHaveAttribute('aria-pressed','true');
 await kind('timeline').focus();await page.keyboard.press('Space');await expect(kind('timeline')).toHaveAttribute('aria-pressed','true');await expect(sheet.locator('.ps-event')).toHaveCount(0);await expect(sheet.locator('[data-act="search-hit-chapter"]')).toHaveCount(1);await expect(sheet.locator('[data-act="search-hit-vod"]')).toHaveCount(1);await expect(sheet.locator('.ps-count')).toHaveText('1');
 input=sheet.getByRole('searchbox',{name:'검색어',exact:true});await input.fill('일정만');await input.press('Enter');await expect(sheet).toContainText('현재 불러온 결과에 챕터 적중은 없어요');await expect(kind('all')).toBeVisible();await kind('all').click();await expect(sheet.locator('.ps-event')).toHaveCount(1);
 await input.fill('한도');await input.press('Enter');await expect(sheet.locator('.ps-count')).toHaveText('200+');await expect(sheet).toContainText('현재 불러온 최대200개');await kind('timeline').click();await expect(sheet.locator('.ps-count')).toHaveText('0');await expect(kind('all')).toBeVisible();await sheet.getByRole('button',{name:'지우기',exact:true}).click();await input.fill('갈틱쇼');await input.press('Enter');await expect(kind('all')).toHaveAttribute('aria-pressed','true');
 const audit=await page.evaluate(()=>(window as Window & {pcControlAudit?:{target:string;keyboard:boolean}[]}).pcControlAudit??[]);expect(audit.filter(e=>e.target==='search-kind#timeline'&&e.keyboard)).toHaveLength(1);expect(audit.filter(e=>e.target==='search-kind#event'&&!e.keyboard)).toHaveLength(1);
 const storage=await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));expect(storage).not.toContain('갈틱쇼');expect(storage).not.toContain('search-kind');
 await finish(page,info,s,{surface,memoryReturn:true,chapterParentContext:true,capIsReturnedSetOnly:true,explicitClearResets:true});
});

for(const surface of ['viewer','preview'] as const)test(`Accepted PC record ${surface}: independent month slow response error retry and close reset`,async({page,context,baseURL},info)=>{
 const s=await setup(page,context,baseURL!);await goto(page,surface);const background=page.locator('[data-act="month-title"]').filter({visible:true}).first(),original=await background.innerText(),url=page.url();let sheet=await openRecord(page);await expect(sheet.locator('.pi-broadcast')).toContainText('6시간');
 s.setSlow(true);await sheet.getByRole('button',{name:'이전 달 기록',exact:true}).click();await sheet.getByRole('button',{name:'이전 달 기록',exact:true}).click();await expect(sheet.locator('.pi-head strong')).toHaveText('2026년 04월 기록');await expect(sheet.locator('.pi-broadcast')).toContainText('4시간');await page.waitForTimeout(400);await expect(sheet.locator('.pi-broadcast')).toContainText('4시간');await expect(background).toHaveText(original);expect(page.url()).toBe(url);
 s.setFail(true);await sheet.getByRole('button',{name:'다음 달 기록',exact:true}).click();await expect(sheet.locator('.pi-broadcast')).toContainText('방송 기록을 못 불러왔어요');s.setFail(false);await sheet.locator('[data-act="pi-retry"]').click();await expect(sheet.locator('.pi-broadcast')).toContainText('5시간');
 await page.keyboard.press('Escape');await expect(sheet).toHaveCount(0);sheet=await openRecord(page);await expect(sheet.locator('.pi-head strong')).toHaveText('2026년 06월 기록');await finish(page,info,s,{surface,backgroundUnchanged:true,lateMayIgnored:true,errorNotZero:true,closeResets:true,requests:s.requests});
});

for(const surface of ['viewer','preview'] as const)test(`Accepted PC record detail ${surface}: off-month Escape Back focus and summary return`,async({page,context,baseURL},info)=>{
 const s=await setup(page,context,baseURL!);await goto(page,surface,5);const background=page.locator('[data-act="month-title"]').filter({visible:true}).first(),original=await background.innerText();let sheet=await openRecord(page);await sheet.getByRole('button',{name:'다음 달 기록',exact:true}).click();await expect(sheet.locator('.pi-head strong')).toHaveText('2026년 06월 기록');const rest=sheet.locator('[data-act="record-summary"][data-act-opt="rest"]');await rest.focus();await page.keyboard.press('Space');await expect(rest).toHaveAttribute('aria-expanded','true');await expect(sheet.locator('.pi-record-event')).toHaveCount(1);const row=sheet.locator('.pi-record-event');await row.scrollIntoViewIfNeeded();const top=await sheet.locator('.pi-body').evaluate(e=>e.scrollTop);await row.click();const detail=page.getByRole('dialog',{name:'일정 상세',exact:true});await expect(detail).toContainText('휴뱅');await expect(page.locator('.pi-record-month')).toHaveCount(0);
 await page.keyboard.press('Escape');sheet=page.locator('.pi-sheet').filter({has:page.locator('.pi-record-month')});await expect(sheet).toBeVisible();await expect(sheet.locator('.pi-head strong')).toHaveText('2026년 06월 기록');await expect(background).toHaveText(original);await expect(sheet.locator('.pi-record-event')).toBeFocused();expect(Math.abs((await sheet.locator('.pi-body').evaluate(e=>e.scrollTop))-top)).toBeLessThan(2);
 await sheet.locator('.pi-record-event').press('Enter');await expect(detail).toBeVisible();await page.goBack();await expect(sheet).toBeVisible();await expect(detail).toHaveCount(0);await expect(sheet.locator('.pi-record-event')).toBeFocused();await expect(background).toHaveText(original);
 await sheet.locator('.pi-record-event').click();await expect(detail).toBeVisible();await detail.getByRole('button',{name:'닫기',exact:true}).click();await expect(sheet).toBeVisible();await expect(sheet.locator('.pi-record-event')).toBeFocused();await expect(background).toHaveText(original);
 await page.goBack();await expect(sheet).toHaveCount(0);sheet=await openRecord(page);await expect(sheet.locator('.pi-head strong')).toHaveText('2026년 05월 기록');await expect(sheet.locator('.pi-record-event')).toHaveCount(0);
 await finish(page,info,s,{surface,offMonthRoundTrip:true,escapeBackAndXReturn:true,normalBackCloseResets:true,focusRestored:true,originalBodyScroll:top});
});

for(const width of [1440,390])test(`Accepted record bounds and masked list ${width}`,async({page,context,baseURL},info)=>{
 const s=await setup(page,context,baseURL!);await page.setViewportSize({width,height:1000});await page.goto('/visual-fixture/poster?monthLink=1&month=2001-01');await settlePanelLayout(page);let sheet=await openRecord(page);await expect(sheet.getByRole('button',{name:'이전 달 기록',exact:true})).toBeDisabled();await sheet.getByRole('button',{name:'다음 달 기록',exact:true}).click();await expect(sheet.locator('.pi-head strong')).toHaveText('2001년 02월 기록');expect(await sheet.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);await page.keyboard.press('Escape');await page.goto('/visual-fixture/poster?teaser=600');await settlePanelLayout(page);sheet=await openRecord(page);await sheet.locator('[data-act="record-summary"][data-act-opt="content"]').click();await expect(sheet.locator('.pi-record-event').filter({hasText:'공개 예정 일정'})).toHaveCount(1);expect(await sheet.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
 await finish(page,info,s,{width,lowerBound:true,responsiveNoOverflow:true,stubMasked:true});
});

for(const surface of ['viewer','preview'] as const)test(`Accepted PC record deliberate replacement ${surface}: search settings card and month own Back`,async({page,context,baseURL},info)=>{
 const s=await setup(page,context,baseURL!);await goto(page,surface);
 const openDetail=async()=>{const sheet=await openRecord(page);await sheet.locator('[data-act="record-summary"][data-act-opt="content"]').click();await sheet.locator('.pi-record-event').first().click();await expect(page.getByRole('dialog',{name:'일정 상세',exact:true})).toBeVisible();};
 await openDetail();let search=await openSearch(page);await page.waitForTimeout(200);await expect(search).toBeVisible();await expect(page.locator('.pi-record-month')).toHaveCount(0);await page.goBack();await expect(search).toHaveCount(0);expect(page.url()).toContain('/visual-fixture/');
 await openDetail();await page.locator('[data-act="open-settings"]').filter({visible:true}).first().click();const settings=page.getByRole('dialog',{name:'설정',exact:true});await expect(settings).toBeVisible();await page.waitForTimeout(200);await expect(settings).toBeVisible();await page.goBack();await expect(settings).toHaveCount(0);expect(page.url()).toContain('/visual-fixture/');
 await openDetail();await page.locator('.public-event.is-clickable').filter({visible:true}).last().click();await expect(page.getByRole('dialog',{name:'일정 상세',exact:true})).toBeVisible();await page.waitForTimeout(200);await expect(page.locator('.pi-record-month')).toHaveCount(0);await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'일정 상세',exact:true})).toHaveCount(0);
 await openDetail();await page.locator('[data-act="month-title"]').filter({visible:true}).first().click();const picker=page.getByRole('dialog',{name:'월 선택',exact:true});await expect(picker).toBeVisible();await page.waitForTimeout(250);expect(await picker.evaluate(e=>e.contains(document.activeElement))).toBe(true);await page.keyboard.press('Escape');await expect(picker).toHaveCount(0);await page.waitForTimeout(200);await expect(page.locator('.pi-record-month')).toHaveCount(0);await expect(page.getByRole('dialog',{name:'일정 상세',exact:true})).toHaveCount(0);
 search=await openSearch(page);await page.goBack();await expect(search).toHaveCount(0);expect(page.url()).toContain('/visual-fixture/');await finish(page,info,s,{surface,deliberateNewIntentWins:true,historySequential:true});
});

for(const surface of ['viewer','preview'] as const)test(`Accepted PC record nonzero scroll ${surface}: last content row restores body and focus`,async({page,context,baseURL},info)=>{
 const s=await setup(page,context,baseURL!);await goto(page,surface,5);const sheet=await openRecord(page);await sheet.getByRole('button',{name:'다음 달 기록',exact:true}).click();await sheet.locator('[data-act="record-summary"][data-act-opt="content"]').click();const row=sheet.locator('.pi-record-event').last();await row.scrollIntoViewIfNeeded();const top=await sheet.locator('.pi-body').evaluate(e=>e.scrollTop);expect(top).toBeGreaterThan(100);await row.click();const detail=page.getByRole('dialog',{name:'일정 상세',exact:true});await expect(detail).toBeVisible();await detail.getByRole('button',{name:'닫기',exact:true}).click();await expect(sheet).toBeVisible();await expect(row).toBeFocused();expect(Math.abs((await sheet.locator('.pi-body').evaluate(e=>e.scrollTop))-top)).toBeLessThan(2);await finish(page,info,s,{surface,nonzeroBodyScroll:top,restoredAfterX:true,focusRestored:true});
});

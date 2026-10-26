import {test,expect,type Page,type BrowserContext,type TestInfo} from '@playwright/test';
import {guardCompanionQa} from './helpers/companion-qa';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
test.use({serviceWorkers:'block',trace:companionTraceMode(),video:'on'});
test.setTimeout(60000);
async function setup(page:Page,context:BrowserContext,base:string){const proof=await guardCompanionQa(page,context,base);await context.addInitScript(()=>{localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));for(const k of ['vic.ambient','vic.sound','vic.gfxPref'])localStorage.setItem(k,'off');Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{(window as Window & {copied?:string}).copied=text;}}});});return proof;}
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof setup>>,facts:unknown){await settlePanelLayout(page);await Promise.all(proof.pending);expect(proof.errors).toEqual([]);expect(proof.mutations).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);await info.attach('actual-ui',{body:await page.screenshot(),contentType:'image/png'});await info.attach('observation',{body:JSON.stringify({at:new Date().toISOString(),facts,proof:{...proof,pending:undefined},syntheticFixture:true,fullCertification:false}),contentType:'application/json'});}
const detail=(page:Page)=>page.getByRole('dialog',{name:'일정 상세',exact:true});
test('Incoming detail and keyboard search: dismissed detail stays closed after overlay pop echo',async({page,context,baseURL},info)=>{
 await page.setViewportSize({width:1440,height:1100});const proof=await setup(page,context,baseURL!);
 await context.route('**/api/public/*/search**',route=>{const u=new URL(route.request().url());if(u.origin!==baseURL||route.request().method()!=='GET')return route.fallback();return route.fulfill({json:u.pathname.endsWith('/search/trending')?{trends:[]}:u.pathname.endsWith('/search/suggest')?{items:[]}:{query:'',hits:[]}});});
 await page.goto('/visual-fixture/poster?monthLink=1&month=2026-06&event=evt-001');await expect(detail(page)).toContainText('픽크타 1일차');await settlePanelLayout(page);
 // Move focus out of a text control so the real '/' shortcut owns the key.
 await detail(page).getByRole('button',{name:'닫기',exact:true}).focus();await page.keyboard.press('/');const search=page.getByRole('dialog',{name:'검색',exact:true});await expect(search).toBeVisible();await settlePanelLayout(page);
 await expect(detail(page)).toHaveCount(0);await expect.poll(()=>new URL(page.url()).searchParams.has('event')).toBe(false);
 await page.keyboard.press('Escape');await expect(search).toHaveCount(0);await settlePanelLayout(page);await page.waitForTimeout(250);
 await expect(detail(page)).toHaveCount(0);expect(new URL(page.url()).searchParams.has('event')).toBe(false);
 await finish(page,info,proof,{flow:'incoming-search-escape-echo',actualShortcutAndEscape:true,noReopenedDetail:true});
});
for(const width of [1440,390])test(`Event incoming history ${width}: native back forward overlay echo and wrong month`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1100});const proof=await setup(page,context,baseURL!);
 await page.goto('/visual-fixture/poster?monthLink=1&month=2026-06');await settlePanelLayout(page);
 const link='/visual-fixture/poster?monthLink=1&month=2026-06&event=evt-001';await page.goto(link);await expect(detail(page)).toContainText('픽크타 1일차');
 await page.goBack();await expect(detail(page)).toHaveCount(0);await page.goForward();await expect(detail(page)).toContainText('픽크타 1일차');
 await page.keyboard.press('Escape');await expect(detail(page)).toHaveCount(0);
 await page.getByRole('button',{name:/기록/}).first().click();await expect(page.locator('.pi-sheet')).toBeVisible();await page.goBack();await expect(page.locator('.pi-sheet')).toHaveCount(0);await expect(detail(page)).toHaveCount(0);expect(new URL(page.url()).searchParams.has('event')).toBe(false);
 await page.getByRole('button',{name:/기록/}).first().click();await expect(page.locator('.pi-sheet')).toBeVisible();await page.locator('[data-act="close-public-insights"]').click();await expect(page.locator('.pi-sheet')).toHaveCount(0);await page.getByRole('button',{name:'다음 달',exact:true}).first().click();await expect(page.locator('h1').first()).toContainText(/2026년\s*0?7월/);await expect(detail(page)).toHaveCount(0);
 await page.goto('/visual-fixture/poster?monthLink=1&month=2026-07&event=evt-001');await settlePanelLayout(page);await expect(detail(page)).toHaveCount(0);
 await page.goto('/visual-fixture/poster?monthLink=1&month=2026-06&teaser=3600&event=fixture-teaser');await settlePanelLayout(page);await expect(detail(page)).toHaveCount(0);await expect(page.locator('[data-act="share-public-event"]')).toHaveCount(0);
 await finish(page,info,proof,{width,backForward:true,overlayBackAndX:true,wrongMonthFailClosed:true,maskedTeaserFailClosed:true});
});
for(const width of [1440,390])test(`Studio embedded preview calendar ${width}: canonical public destination and return`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1100});const proof=await setup(page,context,baseURL!);
 await page.goto('/visual-fixture/studio?role=developer&y=2026&m=6&viewer=1');await settlePanelLayout(page);await expect(page.locator('.viewer-fullscreen .poster-page')).toBeVisible();const before=page.url();
 const root=page.locator('.viewer-fullscreen');await root.locator(width===390?'.agenda-event[data-eventid="evt-001"]':'.public-event[data-eventid="evt-001"]').first().click();await expect(detail(page)).toContainText('픽크타 1일차');
 await expect(detail(page).locator('[data-act="share-public-event"]')).toHaveCount(0);expect(new URL((await detail(page).locator('[data-act="add-google-calendar"]').getAttribute('href'))!).origin).toBe('https://calendar.google.com');expect(page.url()).toBe(before);await page.keyboard.press('Escape');await expect(detail(page)).toHaveCount(0);await expect(page.locator('.viewer-fullscreen')).toBeVisible();
 await finish(page,info,proof,{width,actualEmbeddedPreview:true,urlUnchanged:true,publicGoogleCalendarLink:true,escapedDetailPreservesPreview:true});
});

import {test,expect,type Page,type BrowserContext,type TestInfo} from '@playwright/test';
import {guardCompanionQa} from './helpers/companion-qa';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode()});
test.setTimeout(60000);
async function setup(page:Page,context:BrowserContext,base:string){
 const proof=await guardCompanionQa(page,context,base);
 await context.addInitScript(()=>{localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));for(const key of ['vic.ambient','vic.sound','vic.gfxPref'])localStorage.setItem(key,'off');});
 return proof;
}
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof setup>>,facts:unknown){
 await settlePanelLayout(page);await Promise.all(proof.pending);expect(proof.errors).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.mutations).toEqual([]);expect(proof.liveReads).toEqual([]);expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);
 await info.attach('actual-ui',{body:await page.screenshot(),contentType:'image/png'});await info.attach('observation',{body:JSON.stringify({at:new Date().toISOString(),facts,proof:{...proof,pending:undefined},syntheticFixture:true,fullCertification:false}),contentType:'application/json'});
}
for(const surface of ['viewer','preview'] as const)for(const width of [1440,390])test(`Adopted Google Calendar ${surface} ${width}: native handoff with public fields and original detail retained`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1100});const proof=await setup(page,context,baseURL!);const destinations:string[]=[];
 // Exact synthetic Google destination. No external request, login, calendar write or broad guard bypass.
 await context.route('https://calendar.google.com/**',route=>{expect(route.request().method()).toBe('GET');destinations.push(route.request().url());return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><title>합성 Google 캘린더 도착</title><p>실제 Google 로그인·저장은 실행하지 않은 이동 검증</p></html>'});});
 await page.goto(surface==='viewer'?'/visual-fixture/poster?monthLink=1&month=2026-06':'/visual-fixture/studio?role=owner&viewer=1&y=2026&m=6');await settlePanelLayout(page);
 const original=page.url(),card=page.locator(`${surface==='preview'?'.viewer-fullscreen ':''}${width===390?'.agenda-event':'.public-event'}[data-eventid="evt-001"]`).first();await card.click();const dialog=page.getByRole('dialog',{name:'일정 상세',exact:true});await expect(dialog).toContainText('픽크타 1일차');
 const action=dialog.getByRole('link',{name:'Google 캘린더에 추가',exact:true});await expect(action).toHaveAttribute('target','_blank');await expect(action).toHaveAttribute('rel','noopener noreferrer');
 await expect(dialog.locator('[data-act="share-public-event"],.agenda-detail-navigation')).toHaveCount(0);await action.focus();const opened=page.waitForEvent('popup');if(width===390)await action.click();else await page.keyboard.press('Enter');const popup=await opened;await popup.waitForLoadState('domcontentloaded');expect(destinations).toHaveLength(1);const url=new URL(destinations[0]);expect(url.searchParams.get('text')).toBe('픽크타 1일차');expect(url.searchParams.get('action')).toBe('TEMPLATE');expect(url.searchParams.get('stz')).toBe('Asia/Seoul');expect(url.searchParams.get('dates')).toBe('20260601T110000Z/20260601T140000Z');expect([...url.searchParams.keys()]).not.toContain('authuser');await popup.close();
 await expect(dialog).toBeVisible();expect(page.url()).toBe(original);expect(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1)).toBe(true);await finish(page,info,proof,{surface,width,nativeAnchorInput:width===390?'pointer':'keyboard',syntheticGoogleDestination:destinations,accountSelectionOwnedByGoogle:true,actualGoogleLoginOrSave:false,existingDetailAndAddressRetained:true});
});
for(const role of ['owner','developer'] as const)for(const width of [1440,390])test(`Adopted draft tags ${role} ${width}: six to zero then one explicit synthetic save`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1100});const proof=await setup(page,context,baseURL!);const writes:Array<{op:string;payload:{id?:string;publicTitle?:string;tagIds?:string[];primaryTagIds?:string[];visibilityScope?:string}}> = [];
 await context.route('**/api/studio-write',route=>{const req=route.request(),u=new URL(req.url());if(req.method()!=='POST'||u.origin!==baseURL)return route.fallback();const body=req.postDataJSON();expect(body.op).toBe('save');expect(body.payload.publicTitle).toBe('합성 태그 비우기');expect(body.payload.visibilityScope).toBe('public');writes.push(body);return route.fulfill({json:{ok:true,id:body.payload.id??'synthetic-tags-saved'}});});
 await page.goto(`/visual-fixture/studio?role=${role}&y=2026&m=6`);await settlePanelLayout(page);
 if(width===1440)await page.locator('[data-act="calendar-cell"]').nth(10).dblclick();else await page.locator('.agenda-event[data-eventid="evt-001"]').first().click();
 const title=page.locator(width===1440?'[data-act="title-input"]:visible':'.m-edit-sheet .me-title');await expect(title).toBeVisible();await title.fill('합성 태그 비우기');const clear=page.locator('[data-act="editor-tags-clear"]:visible');
 if(await clear.isEnabled())await clear.click();const chips=page.locator('.tp-chip:visible');for(let i=0;i<6;i++)await chips.nth(i).click();await expect(page.locator('.tp-chip.selected:visible')).toHaveCount(6);await expect(clear).toBeEnabled();await info.attach('six-tags-before',{body:await page.screenshot(),contentType:'image/png'});
 await clear.focus();await page.keyboard.press('Enter');await expect(page.locator('.tp-chip.selected:visible')).toHaveCount(0);await expect(clear).toBeDisabled();if(width===1440)await expect(title).toHaveText('합성 태그 비우기');else await expect(title).toHaveValue('합성 태그 비우기');expect(writes).toHaveLength(0);await info.attach('tags-cleared-after',{body:await page.screenshot(),contentType:'image/png'});
 await title.fill('합성 태그 비우기');await page.waitForTimeout(150);await expect(page.locator('.tp-chip.selected:visible')).toHaveCount(0);
 if(width===1440)await page.keyboard.press('Control+Enter');else await page.locator('[data-act="m-save"]:visible').click();await expect.poll(()=>writes.length).toBe(1);expect(writes[0].payload.tagIds).toEqual([]);expect(writes[0].payload.primaryTagIds).toEqual([]);
 await finish(page,info,proof,{role,width,selectedBefore:6,selectedAfter:0,titleRetained:true,noWriteUntilSave:true,syntheticSaveOnly:true,savedTagIds:[],savedPrimaryTagIds:[],realLogin:false});
});

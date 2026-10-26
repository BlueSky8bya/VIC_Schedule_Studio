import {test,expect,type Page,type BrowserContext,type TestInfo} from '@playwright/test';
import {guardCompanionQa} from './helpers/companion-qa';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode()});
test.setTimeout(90000);
async function setup(page:Page,context:BrowserContext,base:string){
 const proof=await guardCompanionQa(page,context,base);
 await context.addInitScript(()=>{localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));for(const key of ['vic.ambient','vic.sound','vic.gfxPref'])localStorage.setItem(key,'off');});
 return proof;
}
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof setup>>,facts:unknown){
 await Promise.all(proof.pending);expect(proof.errors).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.mutations).toEqual([]);expect(proof.liveReads).toEqual([]);expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);
 await info.attach('actual-ui',{body:await page.screenshot(),contentType:'image/png'});await info.attach('observation',{body:JSON.stringify({at:new Date().toISOString(),facts,proof:{...proof,pending:undefined},syntheticFixture:true,fullCertification:false}),contentType:'application/json'});
}
for(const surface of ['viewer','preview'] as const)for(const width of [1440,390])test(`Calendar format ${surface} ${width}: title outline and description reach separate Google fields`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1100});const proof=await setup(page,context,baseURL!);const destinations:string[]=[];
 await context.route('https://calendar.google.com/**',route=>{expect(route.request().method()).toBe('GET');destinations.push(route.request().url());return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="ko"><title>합성 Google 이동</title><p>실제 Google 계정과 저장을 사용하지 않는 목적지 확인</p></html>'});});
 await page.goto(surface==='viewer'?'/visual-fixture/poster?monthLink=1&month=2026-06':'/visual-fixture/studio?role=owner&viewer=1&y=2026&m=6');await settlePanelLayout(page);
 const original=page.url();const cases=[{id:'evt-001',text:'픽크타 1일차',details:'6월 첫 방송'},{id:'evt-002',text:'픽크타 4일차',details:'• 고멤 오버워치 CK'},{id:'evt-005',text:'시참의날',details:'• 발발랭킹\n• 갈틱쇼\n• 버블파이터 조금'}];
 for(const item of cases){
  const card=page.locator(`${surface==='preview'?'.viewer-fullscreen ':''}${width===390?'.agenda-event':'.public-event'}[data-eventid="${item.id}"]`).first();await card.click();const dialog=page.getByRole('dialog',{name:'일정 상세',exact:true});await expect(dialog).toContainText(item.text);
  const action=dialog.getByRole('link',{name:'Google 캘린더에 추가',exact:true});await action.focus();const opened=page.waitForEvent('popup');if(width===390)await action.click();else await page.keyboard.press('Enter');const popup=await opened;await popup.waitForLoadState('domcontentloaded');const url=new URL(destinations.at(-1)!);
  expect(url.searchParams.get('text')).toBe(item.text);expect(url.searchParams.get('details')).toBe(item.details);expect(url.searchParams.get('stz')).toBe('Asia/Seoul');expect(url.searchParams.get('action')).toBe('TEMPLATE');expect(url.searchParams.has('authuser')).toBe(false);await popup.close();expect(page.url()).toBe(original);await expect(dialog).toBeVisible();await dialog.getByRole('button',{name:'닫기',exact:true}).click();await expect(dialog).toHaveCount(0);
 }
 expect(destinations).toHaveLength(3);await finish(page,info,proof,{surface,width,examples:cases,syntheticGoogleDestination:true,actualGoogleLoginOrSave:false,originalDetailRetained:true});
});
const panelOf=(page:Page)=>page.locator('.event-editor-panel:visible');
async function openDate(page:Page,date:string){await page.locator(`.studio-day[data-isodate="${date}"]`).dblclick();await expect(panelOf(page)).toBeVisible();await settlePanelLayout(page);}
async function point(page:Page){const box=await panelOf(page).boundingBox();expect(box).not.toBeNull();return box!;}
async function anchorMatches(page:Page,selector:string){
 const target=await page.locator(selector).first().boundingBox(),dot=await page.locator('.editor-anchor-link circle').boundingBox();expect(target).not.toBeNull();expect(dot).not.toBeNull();
 expect(Math.abs(dot!.x+dot!.width/2-target!.x-target!.width/2)).toBeLessThan(2);expect(Math.abs(dot!.y+dot!.height/2-target!.y-target!.height/2)).toBeLessThan(2);
 expect(await panelOf(page).evaluate(el=>(el as HTMLElement).style.transformOrigin)).not.toBe('');
 const panel=await point(page),line=page.locator('.editor-anchor-link line'),cx=dot!.x+dot!.width/2,cy=dot!.y+dot!.height/2;
 if(cx>=panel.x&&cx<=panel.x+panel.width&&cy>=panel.y&&cy<=panel.y+panel.height){await expect(line).toHaveCount(0);return;}
 const ends=await line.evaluate(el=>{const line=el as SVGLineElement,matrix=line.getScreenCTM()!;return [new DOMPoint(line.x1.baseVal.value,line.y1.baseVal.value).matrixTransform(matrix),new DOMPoint(line.x2.baseVal.value,line.y2.baseVal.value).matrixTransform(matrix)].map(p=>({x:p.x,y:p.y}));});
 expect(Math.abs(ends[0].x-cx)).toBeLessThan(2);expect(Math.abs(ends[0].y-cy)).toBeLessThan(2);const end=ends[1];expect(end.x).toBeGreaterThanOrEqual(panel.x-2);expect(end.x).toBeLessThanOrEqual(panel.x+panel.width+2);expect(end.y).toBeGreaterThanOrEqual(panel.y-2);expect(end.y).toBeLessThanOrEqual(panel.y+panel.height+2);expect(Math.min(Math.abs(end.x-panel.x),Math.abs(end.x-panel.x-panel.width),Math.abs(end.y-panel.y),Math.abs(end.y-panel.y-panel.height))).toBeLessThan(2);
}
async function close(page:Page,how:'x'|'escape'){if(how==='x')await panelOf(page).getByRole('button',{name:'편집 카드 닫기',exact:true}).click();else await page.keyboard.press('Escape');await expect(panelOf(page)).toHaveCount(0);}
for(const role of ['owner','developer'] as const)for(const width of [1440,1920])test(`Editor memory ${role} ${width}: drag survives close and target changes until reload`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width,height:1100});const proof=await setup(page,context,baseURL!);await page.goto(`/visual-fixture/studio?role=${role}&y=2026&m=6`);await settlePanelLayout(page);await openDate(page,'2026-06-03');const automatic=await point(page),handle=await panelOf(page).locator('.editor-grab').boundingBox();expect(handle).not.toBeNull();
 const targetX=width-automatic.width-100,targetY=190;
 await page.mouse.move(handle!.x+handle!.width/2,handle!.y+handle!.height/2);await page.mouse.down();await page.mouse.move(handle!.x+handle!.width/2+targetX-automatic.x,handle!.y+handle!.height/2+targetY-automatic.y,{steps:12});await page.mouse.up();await settlePanelLayout(page);const moved=await point(page);expect(Math.abs(moved.x-automatic.x)).toBeGreaterThan(60);await info.attach('manual-position',{body:await page.screenshot(),contentType:'image/png'});
 const reopened=[];
 for(const [date,how] of [['2026-06-03','x'],['2026-06-05','escape']] as const){await close(page,how);await openDate(page,date);const next=await point(page);expect(Math.abs(next.x-moved.x)).toBeLessThan(1.5);expect(Math.abs(next.y-moved.y)).toBeLessThan(1.5);await anchorMatches(page,`.studio-day[data-isodate="${date}"] .studio-day-head`);reopened.push({date,how,box:next});}
 await close(page,'x');await page.locator('.studio-event-pill[data-eventid="evt-002"] .pill-main strong').dblclick();await expect(panelOf(page)).toBeVisible();await settlePanelLayout(page);const existing=await point(page);expect(Math.abs(existing.x-moved.x)).toBeLessThan(1.5);expect(Math.abs(existing.y-moved.y)).toBeLessThan(1.5);await expect(panelOf(page).locator('[data-act="title-input"]')).toContainText('픽크타 4일차');await anchorMatches(page,'.studio-event-pill[data-eventid="evt-002"]');
 await page.setViewportSize({width:1200,height:900});await settlePanelLayout(page);const resized=await point(page);expect(resized.x).toBeGreaterThanOrEqual(0);expect(resized.x+resized.width).toBeLessThanOrEqual(1201);expect(resized.y).toBeGreaterThanOrEqual(0);expect(resized.y+resized.height).toBeLessThanOrEqual(901);await anchorMatches(page,'.studio-event-pill[data-eventid="evt-002"]');await info.attach('remembered-position-resized',{body:await page.screenshot(),contentType:'image/png'});
 await page.setViewportSize({width,height:1100});await page.reload();await settlePanelLayout(page);await openDate(page,'2026-06-03');const refreshed=await point(page);expect(Math.abs(refreshed.x-automatic.x)).toBeLessThan(1.5);expect(Math.abs(refreshed.y-automatic.y)).toBeLessThan(1.5);
 await finish(page,info,proof,{role,width,automatic,moved,reopened,existing,resized,refreshed,refreshClearsMemory:true,positionStorage:'component state only',noScheduleWrites:true});
});
for(const role of ['owner','developer'] as const)test(`Editor auto ${role}: un-dragged editor still follows the selected date`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width:1440,height:1100});const proof=await setup(page,context,baseURL!);await page.goto(`/visual-fixture/studio?role=${role}&y=2026&m=6`);await settlePanelLayout(page);await openDate(page,'2026-06-03');const first=await point(page);await close(page,'x');await openDate(page,'2026-06-05');const next=await point(page);expect(Math.abs(first.x-next.x)).toBeGreaterThan(40);await finish(page,info,proof,{role,first,next,manualDrag:false,automaticPlacementRetained:true});
});

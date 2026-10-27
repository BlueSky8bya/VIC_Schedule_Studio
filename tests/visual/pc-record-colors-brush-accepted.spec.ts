import { test, expect, type Page, type BrowserContext, type TestInfo } from '@playwright/test';
import { guardCompanionQa } from './helpers/companion-qa';
import { settlePanelLayout } from './helpers/panel-layout';
import { companionTraceMode } from './helpers/companion-evidence-policy';
test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode(),actionTimeout:15000});
async function setup(page:Page,context:BrowserContext,base:string,width:number,dark=false){
 const proof=await guardCompanionQa(page,context,base);await page.setViewportSize({width,height:1000});
 await page.addInitScript(({dark})=>{localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));localStorage.setItem('vic.ambient','off');localStorage.setItem('vic.sound','off');localStorage.setItem('vic.dark',dark?'on':'off');}, {dark});
 await context.route('**/api/public/*/broadcast?**',r=>{if(r.request().method()!=='GET'||new URL(r.request().url()).origin!==base)return r.fallback();proof.syntheticReads.push('aggregate-broadcast');return r.fulfill({json:{months:[],daily:[]}});});
 await page.addInitScript(()=>{const w=window as Window&{adoptedControlAudit?:string[]};w.adoptedControlAudit=[];document.addEventListener('click',e=>{const action=(e.target as Element)?.closest('[data-act]')?.getAttribute('data-act');if(action==='record-event-open'||action==='bp-recent-color')w.adoptedControlAudit!.push(action);},true);});
 return proof;
}
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof guardCompanionQa>>,facts:unknown){
 await settlePanelLayout(page);await Promise.all(proof.pending);
 expect(proof.errors).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.mutations).toEqual([]);expect(proof.liveReads).toEqual([]);expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.served===c.local)).toBe(true);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await info.attach('actual-ui',{body:await page.screenshot(),contentType:'image/png'});
 const controls=await page.evaluate(()=>(window as Window&{adoptedControlAudit?:string[]}).adoptedControlAudit??[]);
 await info.attach('observation',{body:JSON.stringify({facts,controls,proof:{...proof,pending:undefined},syntheticFixture:true,realLogin:false,physicalStylus:false,fullCertification:false}),contentType:'application/json'});
}
const detail=(page:Page)=>page.getByRole('dialog',{name:'일정 상세',exact:true});
for(const c of [{width:1440,dark:false},{width:1920,dark:true},{width:390,dark:false}])test(`Accepted popular ${c.width}: existing detail outside X Escape Back`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,c.width,c.dark);await page.goto('/visual-fixture/poster?hearts=1');await settlePanelLayout(page);
 await page.getByRole('button',{name:/^(기록|이 달 기록)$/}).first().click();const sheet=page.locator('.pi-sheet');await expect(sheet).toBeVisible();
 const row=sheet.locator('.pi-popular-event').first();await row.scrollIntoViewIfNeeded();
 const rowBox=(await row.boundingBox())!,barBox=(await row.locator('.pi-bar').boundingBox())!;expect(rowBox.width).toBeGreaterThan(230);expect(barBox.width).toBeGreaterThan(25);
 for(const how of ['outside','X','Escape','Back']){
   await row.scrollIntoViewIfNeeded();const top=await sheet.locator('.pi-body').evaluate(e=>e.scrollTop);const month=await sheet.locator('.pi-record-month strong').innerText();
   if(how==='X'){await row.focus();await row.press('Enter');}else await row.click();
   await expect(detail(page)).toBeVisible();await expect(detail(page).getByRole('button',{name:'기록으로',exact:true})).toHaveCount(0);
   await settlePanelLayout(page);
   await expect.poll(()=>detail(page).evaluate(e=>Number(getComputedStyle(e).opacity))).toBeGreaterThan(.99);
   await info.attach('detail-'+how,{body:await page.screenshot(),contentType:'image/png'});
   if(how==='outside')await page.mouse.click(10,10);else if(how==='X')await detail(page).getByRole('button',{name:'닫기',exact:true}).last().click();else if(how==='Escape')await page.keyboard.press('Escape');else await page.goBack();
   await expect(detail(page)).toHaveCount(0);await expect(sheet).toBeVisible();
   try{await expect(row).toBeFocused();}catch(error){await info.attach('return-focus-diagnostic',{body:JSON.stringify(await row.evaluate(e=>({active:document.activeElement?.outerHTML,connected:e.isConnected,inert:e.closest('[inert]')?.outerHTML.slice(0,250),rect:e.getBoundingClientRect().toJSON()}))),contentType:'application/json'});throw error;}
   await expect(sheet.locator('.pi-record-month strong')).toHaveText(month);
   expect(Math.abs((await sheet.locator('.pi-body').evaluate(e=>e.scrollTop))-top)).toBeLessThan(2);
 }
 await finish(page,info,proof,{...c,existingPopover:true,noReturnButton:true,closeMethods:4,rowBox,barBox});
});
test('Accepted preview record: shared detail outside return and empty popularity',async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,1440);await page.goto('/visual-fixture/studio?viewer=1&role=owner&y=2026&m=6');await settlePanelLayout(page);
 await page.getByRole('button',{name:'기록',exact:true}).first().click();const sheet=page.locator('.pi-sheet');await expect(sheet).toBeVisible();
 await expect(sheet.locator('.pi-popular-event')).toHaveCount(0);await sheet.locator('[data-act="record-summary"][data-act-opt="content"]').click();
 const row=sheet.locator('.pi-record-event').first();await row.click();await expect(detail(page)).toBeVisible();await page.mouse.click(10,10);await expect(sheet).toBeVisible();await expect(row).toBeFocused();
 await finish(page,info,proof,{preview:true,popularFixtureEmpty:true,sharedDetailRouteVerifiedBySummaryEntry:true,notClaimingPopulatedPreviewPopularObservation:true});
});
async function openBoard(page:Page,role:string){await page.goto(`/visual-fixture/studio?viewer=1&role=${role}&y=2026&m=6`);await settlePanelLayout(page);await page.locator('[data-act="open-drawing-board"]').click();await expect(page.locator('.broadcast-panel')).toBeVisible();await settlePanelLayout(page);}
const picker=(page:Page)=>page.getByRole('dialog',{name:'색 고르기',exact:true});
async function choose(page:Page,color:string){await page.locator('[data-act="색 직접 고르기"]').click();await picker(page).getByRole('textbox',{name:'hex 코드',exact:true}).fill(color);await picker(page).getByRole('button',{name:'완료',exact:true}).click();await expect(picker(page)).toHaveCount(0);await expect(page.locator('[data-act="색 직접 고르기"]')).toHaveAttribute('aria-label',`현재 색 ${color}, 색 직접 고르기`);}
for(const c of [{width:1440,dark:false,role:'owner'},{width:1920,dark:true,role:'developer'}])test(`Accepted exact recent colors ${c.width}: cap order cancel symmetry`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,c.width,c.dark);await openBoard(page,c.role);
 await page.locator('[data-act="색 직접 고르기"]').click();const initial=(await picker(page).boundingBox())!;await picker(page).getByRole('button',{name:'완료',exact:true}).click();
 for(const color of ['#23695f','#c56885','#112233','#223344','#334455','#445566'])await choose(page,color);
 await page.locator('[data-act="색 직접 고르기"]').click();const recent=picker(page).getByRole('group',{name:'최근 확정한 색',exact:true});await expect(recent.getByRole('button')).toHaveCount(5);
 expect(await recent.getByRole('button').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')))).toEqual(['#445566','#334455','#223344','#112233','#c56885'].map(v=>'최근 색 '+v));
 const geometry=await recent.evaluate(e=>{const b=e.getBoundingClientRect(),a=e.firstElementChild!.getBoundingClientRect(),z=e.lastElementChild!.getBoundingClientRect();return {centerError:Math.abs((a.left+z.right)/2-(b.left+b.right)/2),overflow:e.scrollWidth>e.clientWidth};});expect(geometry.centerError).toBeLessThan(1);expect(geometry.overflow).toBe(false);
 const full=(await picker(page).boundingBox())!;expect(full.height-initial.height).toBeLessThanOrEqual(12);
 await info.attach('recent-five',{body:await page.screenshot(),contentType:'image/png'});
 await picker(page).getByRole('textbox',{name:'hex 코드',exact:true}).fill('#abcdee');await page.keyboard.press('Escape');await expect(page.locator('.broadcast-panel')).toBeVisible();await expect(page.locator('[data-act="색 직접 고르기"]')).toHaveAttribute('aria-label','현재 색 #445566, 색 직접 고르기');
 await page.locator('[data-act="색 직접 고르기"]').click();await expect(picker(page).getByRole('button',{name:'최근 색 #abcdee',exact:true})).toHaveCount(0);
 const old=picker(page).getByRole('button',{name:'최근 색 #c56885',exact:true});await old.focus();await old.press('Space');await picker(page).getByRole('button',{name:'완료',exact:true}).click();
 await page.locator('[data-act="색 직접 고르기"]').click();await expect(picker(page).getByRole('textbox',{name:'hex 코드',exact:true})).toHaveValue('#c56885');await expect(picker(page).locator('.cpop-recent button').first()).toHaveAttribute('aria-label','최근 색 #c56885');await page.keyboard.press('Escape');
 const storage=await page.evaluate(()=>JSON.stringify([Object.entries(localStorage),Object.entries(sessionStorage)]));expect(storage).not.toMatch(/23695f|c56885|445566|recentCustom/);
 await page.getByRole('button',{name:'일정 그림판 닫기',exact:true}).click();await expect(page.locator('.broadcast-panel')).toHaveCount(0);await page.locator('[data-act="open-drawing-board"]').click();await page.locator('[data-act="색 직접 고르기"]').click();await expect(picker(page).locator('.cpop-recent')).toHaveCount(0);
 await finish(page,info,proof,{...c,initial,full,geometry,exactHex:true,confirmedOnly:true,fiveBounded:true,memoryOnly:true});
});
async function cursor(page:Page){return page.locator('.bp-draw-surface').evaluate(e=>{const value=getComputedStyle(e).cursor;const encoded=value.match(/data:image\/svg\+xml,([^"\s]+)/)?.[1];const svg=encoded?decodeURIComponent(encoded):'';const r=svg.match(/ r='([\d.]+)'/);return {value,svg,diameter:r?Number(r[1])*2:null,inline:(e as HTMLElement).style.cursor};});}
const ink=(page:Page)=>page.locator('.bp-board canvas').evaluateAll(es=>es.reduce((sum,e)=>{const c=e as HTMLCanvasElement,p=c.getContext('2d')?.getImageData(0,0,c.width,c.height).data;if(p)for(let i=3;i<p.length;i+=4)if(p[i])sum++;return sum;},0));
for(const c of [{width:1440,dark:false},{width:1920,dark:true}])test(`Accepted mouse footprint ${c.width}: width live ink undo tools`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,c.width,c.dark);await openBoard(page,'owner');await page.getByRole('button',{name:'펜',exact:true}).click();
 const surface=page.locator('.bp-draw-surface'),box=(await surface.boundingBox())!,facts=[];
 for(const width of [2,18]){await page.getByRole('button',{name:`굵기 ${width}px`,exact:true}).click();await page.mouse.move(box.x+120,box.y+130);const q=await cursor(page);expect(Math.abs(q.diameter!-width*1.13)).toBeLessThanOrEqual(.125);facts.push({width,...q});}
 await page.mouse.down();await page.mouse.move(box.x+250,box.y+132,{steps:14});const live=await cursor(page);expect(live.diameter!).toBeGreaterThanOrEqual(18*.705-.125);expect(live.diameter!).toBeLessThanOrEqual(18*1.3+.125);await page.mouse.up();expect((await cursor(page)).diameter).toBe(20.25);
 await expect.poll(()=>ink(page)).toBeGreaterThan(10);await page.getByRole('button',{name:'실행 취소',exact:true}).click();await expect.poll(()=>ink(page)).toBe(0);await page.getByRole('button',{name:'다시 실행',exact:true}).click();await expect.poll(()=>ink(page)).toBeGreaterThan(10);
 await page.getByRole('button',{name:'형광펜',exact:true}).click();await page.getByRole('button',{name:'굵기 18px',exact:true}).click();const hl=await cursor(page);expect(hl.diameter).toBe(63);
 await page.getByRole('button',{name:'지우개',exact:true}).click();expect((await cursor(page)).value).not.toBe(hl.value);await page.getByRole('button',{name:'스포이드로 색 집기',exact:true}).click();expect((await cursor(page)).inline).toBe('');await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'직선',exact:true}).click();expect((await cursor(page)).inline).toBe('');await page.getByRole('button',{name:'펜',exact:true}).click();
 await surface.dispatchEvent('pointermove',{pointerType:'pen',pointerId:71,clientX:box.x+120,clientY:box.y+130,pressure:0,buttons:0});await expect(page.locator('.bp-stylus-cursor.visible')).toHaveCount(1);expect((await cursor(page)).value).toBe('none');
 await page.mouse.move(box.x+125,box.y+135);await expect(page.locator('.bp-stylus-cursor.visible')).toHaveCount(0);expect((await cursor(page)).diameter).toBe(20.25);
 await info.attach('native-cursor-svg',{body:Buffer.from(facts[1].svg),contentType:'image/svg+xml'});
 await finish(page,info,proof,{...c,facts,live,hl,realInkAndHistory:true,syntheticStylusBoundaryOnly:true});
});
test('Accepted shared tag picker: exact HEX and narrow popup no board history',async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,1440);await page.goto('/visual-fixture/studio?role=owner&y=2026&m=6');await settlePanelLayout(page);const fold=page.getByRole('button',{name:'패널 펼치기',exact:true});if(await fold.count()){await fold.click();await settlePanelLayout(page);}
 await page.locator('[data-act="manage-tags"]').click();await page.locator('button[data-act="태그 색 바꾸기"]:enabled').first().click();await expect(picker(page)).toBeVisible();await expect(picker(page).locator('.cpop-recent')).toHaveCount(0);
 await picker(page).getByRole('textbox',{name:'hex 코드',exact:true}).fill('#c56885');await expect(picker(page).getByRole('textbox',{name:'hex 코드',exact:true})).toHaveValue('#c56885');await picker(page).getByRole('button',{name:'완료',exact:true}).click();
 await page.locator('button[data-act="태그 색 바꾸기"]:enabled').first().click();await expect(picker(page).getByRole('textbox',{name:'hex 코드',exact:true})).toHaveValue('#c56885');
 await page.setViewportSize({width:390,height:844});await settlePanelLayout(page);const b=(await picker(page).boundingBox())!;expect(b.x).toBeGreaterThanOrEqual(7);expect(b.x+b.width).toBeLessThanOrEqual(383);expect(b.y+b.height).toBeLessThanOrEqual(844);
 await finish(page,info,proof,{sharedTagPicker:true,exactHex:true,noBoardHistory:true,narrowBounds:b,noServerSave:true});
});

import { test, expect, type Page, type BrowserContext, type TestInfo } from '@playwright/test';
import { guardCompanionQa } from './helpers/companion-qa';
import { settlePanelLayout } from './helpers/panel-layout';
import { companionTraceMode } from './helpers/companion-evidence-policy';

test.use({ serviceWorkers: 'block', video: 'on', trace: companionTraceMode() });
test.setTimeout(60000);
async function setup(page: Page, context: BrowserContext, base: string) {
  const proof = await guardCompanionQa(page, context, base);
  await context.addInitScript(() => {
    localStorage.setItem('vic.settingsEpoch', '2026-09-04');
    localStorage.setItem('vic.viewerCompanion', JSON.stringify({version:1,enabled:false}));
    for (const k of ['vic.ambient','vic.sound','vic.gfxPref']) localStorage.setItem(k,'off');
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async(text:string)=>{
      const w=window as Window & { copied?:string[]; denyCopy?:boolean }; (w.copied??=[]).push(text);
      if(w.denyCopy) throw new DOMException('Synthetic denied copy','NotAllowedError');
    }}});
  });
  return proof;
}
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof setup>>,facts:unknown) {
  await settlePanelLayout(page); await Promise.all(proof.pending);
  expect(proof.errors).toEqual([]); expect(proof.mutations).toEqual([]); expect(proof.rejected).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0); expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);
  await info.attach('actual-ui',{body:await page.screenshot(),contentType:'image/png'});
  await info.attach('observation',{body:JSON.stringify({at:new Date().toISOString(),facts,proof:{...proof,pending:undefined},syntheticFixture:true,fullCertification:false}),contentType:'application/json'});
}
const copied = (page:Page)=>page.evaluate(()=>(window as Window & {copied?:string[]}).copied??[]);
const detail = (page:Page)=>page.getByRole('dialog',{name:'일정 상세',exact:true});

for(const width of [1440,390]) test(`Accepted event link ${width}: existing recipient link reload close month and invalid ids`,async({page,context,browser,baseURL},info)=>{
  await page.setViewportSize({width,height:1100}); const proof=await setup(page,context,baseURL!);
  await page.goto('/visual-fixture/poster?monthLink=1&month=2026-06'); await settlePanelLayout(page);
  await page.locator(width===390?'.agenda-event[data-eventid="evt-001"]':'.public-event[data-eventid="evt-001"]').first().click();
  await expect(detail(page)).toContainText('픽크타 1일차'); await settlePanelLayout(page);
  await expect(detail(page).locator('[data-act="share-public-event"]')).toHaveCount(0);
  const link=new URL('/?month=2026-06&event=evt-001',baseURL!);
  const recipient=await browser.newContext({viewport:{width,height:1100},timezoneId:'Asia/Seoul',serviceWorkers:'block'});
  const other=await recipient.newPage(), otherProof=await setup(other,recipient,baseURL!);
  try {
    // Existing public-address contract, carried to the credential-free public fixture after human retirement of the copy control.
    const fixture='/visual-fixture/poster?monthLink=1&'+link.searchParams.toString();
    await other.goto(fixture); await expect(detail(other)).toContainText('픽크타 1일차'); await settlePanelLayout(other);
    await other.reload(); await expect(detail(other)).toContainText('픽크타 1일차');
    await other.keyboard.press('Escape'); await expect(detail(other)).toHaveCount(0);
    await expect.poll(()=>new URL(other.url()).searchParams.has('event')).toBe(false);
    await other.reload(); await expect(detail(other)).toHaveCount(0);
    await other.goto(fixture); await expect(detail(other)).toBeVisible(); await other.keyboard.press('Escape');
    await other.getByRole('button',{name:'다음 달',exact:true}).first().click(); await expect(other.locator('h1').first()).toContainText(/2026년\s*0?7월/); await expect(detail(other)).toHaveCount(0);
    for(const query of ['event=deleted-canary','event=evt-001&event=evt-002','event=%3Cscript%3E','event=evt-001&month=2026-07']) {
      await other.goto('/visual-fixture/poster?monthLink=1&month=2026-06&'+query); await settlePanelLayout(other); await expect(detail(other)).toHaveCount(0);
    }
    await finish(other,info,otherProof,{flow:'fresh-recipient',width,canonicalQuery:link.search,actualRootRoute:false,reason:'credential-free fixture; actual anonymous root checked after deployment',reloadOpened:true,closeRemovedEvent:true,invalidIdsFailClosed:true});
  } finally { await recipient.close(); }
  await expect(detail(page).getByRole('textbox',{name:'수동 복사용 일정 주소'})).toHaveCount(0);
  await finish(page,info,proof,{flow:'incoming-event-link',width,canonicalQuery:link.search,copyAndManualControlsRetired:true});
});

for(const width of [1440,390]) test(`Accepted event preview ${width}: Google Calendar without consuming preview address`,async({page,context,baseURL},info)=>{
  await page.setViewportSize({width,height:1100}); const proof=await setup(page,context,baseURL!);
  await page.goto('/visual-fixture/poster?event=evt-002'); await settlePanelLayout(page); await expect(detail(page)).toHaveCount(0); const before=page.url();
  await page.locator(width===390?'.agenda-event[data-eventid="evt-001"]':'.public-event[data-eventid="evt-001"]').first().click(); await expect(detail(page)).toContainText('픽크타 1일차');
  await expect(detail(page).locator('[data-act="share-public-event"]')).toHaveCount(0);const destination=new URL((await detail(page).locator('[data-act="add-google-calendar"]').getAttribute('href'))!);expect(destination.origin).toBe('https://calendar.google.com');expect(destination.searchParams.get('text')).toBe('픽크타 1일차');expect(page.url()).toBe(before);
  await page.keyboard.press('Escape'); await expect(detail(page)).toHaveCount(0); await finish(page,info,proof,{flow:'preview-calendar-link',width,urlUnchanged:true});
});

for(const surface of ['viewer','studio','preview'] as const) test(`Accepted settings ${surface}: native arrows wrap Tab pointer and Space`,async({page,context,baseURL},info)=>{
  await page.setViewportSize({width:1440,height:1100}); const proof=await setup(page,context,baseURL!);
  await page.goto(surface==='studio'?'/visual-fixture/studio?role=owner&y=2026&m=6':surface==='viewer'?'/visual-fixture/poster?monthLink=1':'/visual-fixture/poster'); await settlePanelLayout(page);
  const settings=page.getByRole('button',{name:'설정',exact:true}).first(), box=await settings.isVisible()?await settings.boundingBox():null, expand=page.getByRole('button',{name:'패널 펼치기',exact:true});
  if((!box||box.x+box.width<=0||box.x>=1440)&&await expand.isVisible()){await expand.click();await settlePanelLayout(page);} await settings.click();
  await page.evaluate(()=>document.fonts.ready); await page.waitForLoadState('networkidle'); const tab=page.getByRole('tab',{name:'화면',exact:true}); if(await tab.isVisible())await tab.click();
  const group=page.getByRole('radiogroup',{name:'화면 모드 고르기',exact:true}), light=group.getByRole('radio',{name:'밝게',exact:true}), dark=group.getByRole('radio',{name:'어둡게',exact:true}), auto=group.getByRole('radio',{name:'자동',exact:true});
  await light.click(); await light.focus();
  for(const [key,choice] of [['ArrowRight',dark],['ArrowDown',auto],['ArrowRight',light],['ArrowLeft',auto],['ArrowUp',dark],['Home',light],['End',auto]] as const){await page.keyboard.press(key);await expect(choice).toBeFocused();await expect(choice).toHaveAttribute('aria-checked','true');}
  expect(await group.getByRole('radio').evaluateAll(nodes=>nodes.filter(n=>(n as HTMLElement).tabIndex===0).length)).toBe(1);
  await page.keyboard.press('Tab'); expect(await group.evaluate(e=>e.contains(document.activeElement))).toBe(false);
  await light.click(); await dark.focus(); await page.keyboard.press('Space'); await expect(dark).toHaveAttribute('aria-checked','true');
  await finish(page,info,proof,{flow:'settings-single-row',surface,nativeKeys:9,oneTabStop:true,pointerAndSpace:true});
});

for(const deny of [true,false]) test(`Accepted login clipboard ${deny?'denied':'success'}: safe normalized entry without OAuth`,async({browser,baseURL},info)=>{
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Seoul',serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 KAKAOTALK',recordVideo:{dir:info.outputPath('login-video')}}),page=await context.newPage();
  try {const proof=await setup(page,context,baseURL!); await context.route('**/login**',route=>{const r=route.request(),u=new URL(r.url());return u.origin===baseURL&&u.pathname==='/login'&&r.method()==='GET'?route.continue():route.fallback();});
    await context.addInitScript(value=>{(window as Window & {denyCopy?:boolean}).denyCopy=value;},deny);
    await page.goto('/login?next=%2Fstudio%3Fcode%3Dsecret&code=secret#access_token=secret'); const button=page.locator('[data-act="copy-app-link"]'); await button.click(); await expect.poll(()=>copied(page)).toHaveLength(1);
    const expected=baseURL+'/login?next=%2Fstudio'; expect((await copied(page))[0]).toBe(expected);
    if(deny){const input=page.getByRole('textbox',{name:'수동 복사용 로그인 주소'});await expect(input).toHaveValue(expected);await input.focus();expect(await input.evaluate(e=>(e as HTMLInputElement).selectionEnd)).toBe(expected.length);await expect(page.locator('.inapp-notice [role="status"]')).toContainText('자동 복사가 차단됐어요');}
    else {await expect(button).toHaveText('복사됨');await expect(page.locator('.inapp-manual-link')).toHaveCount(0);}
    await finish(page,info,proof,{flow:'login-copy',denied:deny,sanitized:true,copyAttempts:1,oauthSubmitted:false,actualIOS:false});
  }finally{await context.close();}
});

import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {setup} from './helpers/typography-harmony';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
import {hexToHsv,hsvToHex} from '@/lib/tags/color-tone';
import {COMPANION_RADIO_TRACKS} from '@/lib/ui/viewer-companion/radio-catalog';

test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode(),actionTimeout:15000});test.setTimeout(60000);
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof setup>>,facts:unknown){
  await settlePanelLayout(page);await Promise.all(proof.pending);
  for(const key of ['errors','rejected','mutations','liveReads'] as const)expect(proof[key],key).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);
  await info.attach('current-ui',{body:await page.screenshot(),contentType:'image/png'});
  await info.attach('observation',{body:JSON.stringify({kind:'adopted-radio-position-hue',facts,proof:{...proof,pending:undefined},syntheticFixture:true,operatingWrites:0,lifeAiChanges:0,fullCertification:false}),contentType:'application/json'});
}
async function openRadio(page:Page){
  let b=page.getByRole('button',{name:'설정',exact:true}).filter({visible:true}).first();
  if(!await b.count()){await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();b=page.getByRole('button',{name:'설정',exact:true}).filter({visible:true}).first();}await b.click();
  const d=page.getByRole('dialog',{name:'설정',exact:true});await d.locator('[data-tab="companion"]:visible').click();await d.locator('[data-profile-page="settings"]:visible').click();await d.locator('[data-companion-tab="sound"]:visible').click();
  return d.locator('.rhh-companion-radio:visible');
}
const reasons=[['master-off','전체 소리가 꺼져 있어요'],['master-zero','전체 음량이 0이에요'],['pet-off','빅타민이 꺼져 있어요'],['pet-sound-off','빅타민 소리가 꺼져 있어요'],['pet-zero','빅타민 음량이 0이에요'],['radio-off','라디오가 꺼져 있어요'],['radio-zero','라디오 음량이 0이에요'],['empty','선택한 곡이 없어요.']] as const;
for(const [index,[kind,message]] of reasons.entries())test(`Adopted radio reason ${kind}`,async({page,context,baseURL},info)=>{
  const width=index%2?1920:1440,proof=await setup(page,context,baseURL!,width),surface=index===4?'preview':index%2?'owner':'viewer';
  await page.addInitScript(({kind,ids})=>{
    localStorage.setItem('vic.sound',kind==='master-off'?'off':'on');localStorage.setItem('vic.soundVol',kind==='master-zero'?'0':'60');
    localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:kind!=='pet-off',sound:kind!=='pet-sound-off',soundVolume:kind==='pet-zero'?0:60,roam:false,jump:false,sleep:false,panelPrank:false,cardPrank:false,heartPrank:false,rarePrank:false,ambientPrank:false}));
    localStorage.setItem('vic.companionRadio.v1',JSON.stringify({enabled:kind!=='radio-off',volume:kind==='radio-zero'?0:35,react:false,excludedIds:kind==='empty'?ids:[]}));
  },{kind,ids:COMPANION_RADIO_TRACKS.map(t=>t.id)});
  await page.goto(surface==='viewer'?'/visual-fixture/poster?y=2026&m=6':`/visual-fixture/studio?role=owner&viewer=${surface==='preview'?1:0}&y=2026&m=6`);await settlePanelLayout(page);
  const radio=await openRadio(page),status=radio.locator('.rhh-radio-now > p'),play=radio.locator('[data-act="companion-radio-play"]').first();await expect(status).toHaveText(message);await expect(play).toBeDisabled();
  await info.attach('radio-status',{body:await radio.screenshot(),contentType:'image/png'});
  if(kind==='master-off'){
    const d=page.getByRole('dialog',{name:'설정',exact:true});await d.locator('[data-tab="sound"]:visible').click();await d.getByRole('switch',{name:'효과음 켜기/끄기',exact:true}).click();await d.locator('[data-tab="companion"]:visible').click();await expect(status).toHaveText('재생 대기');await expect(play).toBeEnabled();
  }
  await finish(page,info,proof,{kind,surface,width,message,disabled:true,recoveredWithoutAutoplay:kind==='master-off',mediaPlayNotInvoked:true});
});

for(const s of [{role:'owner',width:1440},{role:'developer',width:1920},{role:'developer',width:2400}] as const)test(`Adopted hue keyboard ${s.role} ${s.width}`,async({page,context,baseURL},info)=>{
  const proof=await setup(page,context,baseURL!,s.width);await page.goto(`/visual-fixture/studio?role=${s.role}&y=2026&m=6`);await settlePanelLayout(page);
  const entry=page.getByRole('button',{name:'태그 편집',exact:true});if(!await entry.isVisible())await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();await entry.click();
  const swatch=page.locator('button[aria-label="태그 색 바꾸기"]:not(:disabled)').first();await swatch.click();const popup=page.getByRole('dialog',{name:'색 고르기',exact:true}),input=popup.getByRole('textbox',{name:'hex 코드',exact:true}),hue=popup.getByRole('slider',{name:'색조',exact:true});
  await input.fill('#8CD4A5');await input.press('Shift+Tab');await expect(hue).toBeFocused();const initial=Number(await hue.getAttribute('aria-valuenow')),sv=await popup.locator('.cpop-sv').evaluate(e=>getComputedStyle(e).backgroundImage);
  await hue.press('ArrowRight');await expect(hue).toHaveAttribute('aria-valuenow',String(initial+1));const original=hexToHsv('#8CD4A5');await expect(input).toHaveValue(hsvToHex(initial+1,original.s,original.v));
  await popup.getByRole('button',{name:'실행취소(직전 색으로)',exact:true}).click();await expect(input).toHaveValue(/^#8cd4a5$/i);
  await hue.focus();await hue.press('End');await expect(hue).toHaveAttribute('aria-valuenow','360');await hue.press('ArrowRight');await expect(hue).toHaveAttribute('aria-valuenow','360');await hue.press('Home');await expect(hue).toHaveAttribute('aria-valuenow','0');await hue.press('ArrowLeft');await expect(hue).toHaveAttribute('aria-valuenow','0');await hue.press('ArrowUp');await expect(hue).toHaveAttribute('aria-valuenow','1');await hue.press('ArrowDown');await expect(hue).toHaveAttribute('aria-valuenow','0');
  await input.fill('#8CD4A5');await hue.focus();await info.attach('hue-focused',{body:await popup.screenshot(),contentType:'image/png'});await hue.press('Escape');await expect(popup).not.toBeVisible();await expect(page.locator('.tag-editor-scroll:visible')).toBeVisible();await expect(swatch).toBeFocused();
  await swatch.click();await expect(popup).toBeVisible();await expect(hue).toHaveAttribute('aria-valuemin','0');await expect(hue).toHaveAttribute('aria-valuemax','360');await expect(popup.locator('.cpop-sv')).not.toHaveAttribute('role','slider');
  const rect=(await hue.boundingBox())!;await page.mouse.click(rect.x+rect.width/3,rect.y+rect.height/2);expect(Number(await hue.getAttribute('aria-valuenow'))).toBeGreaterThan(110);expect(Number(await hue.getAttribute('aria-valuenow'))).toBeLessThan(130);await popup.locator('[data-act="cpop-done"]').click();await expect(popup).not.toBeVisible();
  await swatch.click();const second=page.locator('button[aria-label="태그 색 바꾸기"]:not(:disabled)').nth(1);await second.click();await expect(hue).toBeFocused();await hue.press('Escape');await expect(popup).not.toBeVisible();await expect(second).toBeFocused();
  await finish(page,info,proof,{...s,initial,sv,arrowsAndBounds:true,undo:true,escapeCancelsInnerOnly:true,pointerAndCommit:true,tagsNotServerSaved:true});
});

for(const s of [{surface:'viewer',width:1440},{surface:'owner',width:1920},{surface:'developer',width:2400},{surface:'preview',width:1920}] as const)test(`Adopted position return ${s.surface} ${s.width}`,async({page,context,baseURL},info)=>{
  const proof=await setup(page,context,baseURL!,s.width),publicView=s.surface==='viewer'||s.surface==='preview';
  await page.goto(s.surface==='viewer'?'/visual-fixture/poster?detailUX=1':`/visual-fixture/studio?role=${s.surface==='developer'?'developer':'owner'}&viewer=${s.surface==='preview'?1:0}&y=2026&m=6`);await settlePanelLayout(page);
  const opener=s.surface==='viewer'?page.locator('[data-eventid="fixture-detail-layout"]:visible').first():page.locator(`${publicView?'.public-event':'.studio-event-pill'}[data-eventid="evt-001"]:visible`).first();
  const open=async()=>{if(publicView)await opener.click();else await opener.dblclick();await settlePanelLayout(page);};await open();
  const panel=publicView?page.getByRole('dialog',{name:'일정 상세',exact:true}):page.locator('.event-editor-panel:visible'),grip=panel.getByRole('button',{name:'창 위치 복원',exact:true});await expect(grip).toBeVisible();
  const textBefore=await panel.innerText(),draft=publicView?null:panel.locator('textarea,[contenteditable="true"],input[type="text"]').first();if(draft)await draft.fill('위치 복귀 보존용 합성 초안');
  const start=(await panel.boundingBox())!,handle=(await grip.boundingBox())!,dx=start.x+start.width+170<s.width?140:-140;
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+dx,handle.y+handle.height/2+60,{steps:15});await page.mouse.up();await grip.dblclick();await settlePanelLayout(page);const moved=(await panel.boundingBox())!;expect(Math.hypot(moved.x-start.x,moved.y-start.y)).toBeGreaterThan(35);
  if(publicView){await page.keyboard.press('Escape');await expect(panel).not.toBeVisible();await open();const reopened=(await panel.boundingBox())!;expect(Math.abs(reopened.x-moved.x)).toBeLessThan(3);expect(Math.abs(reopened.y-moved.y)).toBeLessThan(3);}
  // Quiescence wait exceeds the explicit trailing-drag guard; no animation/time manipulation.
  await page.waitForTimeout(700);await grip.dblclick();await settlePanelLayout(page);const restored=(await panel.boundingBox())!;expect(Math.abs(restored.x-start.x)).toBeLessThan(3);expect(Math.abs(restored.y-start.y)).toBeLessThan(3);
  if(draft){if(await draft.getAttribute('contenteditable')==='true')await expect(draft).toHaveText('위치 복귀 보존용 합성 초안');else await expect(draft).toHaveValue('위치 복귀 보존용 합성 초안');}else expect(await panel.innerText()).toBe(textBefore);
  await expect(grip).toBeFocused();
  for(const key of ['Enter','Space']){const h=(await grip.boundingBox())!;await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+dx,h.y+h.height/2+40,{steps:12});await page.mouse.up();await settlePanelLayout(page);expect(Math.abs((await panel.boundingBox())!.x-start.x)).toBeGreaterThan(30);await grip.press(key);await settlePanelLayout(page);expect(Math.abs((await panel.boundingBox())!.x-start.x)).toBeLessThan(3);await expect(panel).toBeVisible();}
  await info.attach('popover-restored',{body:await panel.screenshot(),contentType:'image/png'});await finish(page,info,proof,{...s,start,moved,restored,normalMemoryPreserved:true,dragDblclickSuppressed:true,enterSpace:true,draftPreserved:!publicView,noSave:true});
});

for(const surface of ['viewer','owner'] as const)test(`Adopted mobile grip unchanged ${surface}`,async({page,context,baseURL},info)=>{
  const proof=await setup(page,context,baseURL!,390);await page.goto(surface==='viewer'?'/visual-fixture/poster?detailUX=1':'/visual-fixture/studio?role=owner&y=2026&m=6');await settlePanelLayout(page);
  if(surface==='viewer')await page.locator('[data-eventid="fixture-detail-layout"]:visible').first().click();else await page.locator('[data-eventid="evt-001"]:visible').first().click();await settlePanelLayout(page);
  await expect(page.getByRole('button',{name:'창 위치 복원',exact:true})).not.toBeVisible();
  const grip=page.locator(surface==='viewer'?'.agenda-detail-grab:visible':'.mobile-editor-grab:visible').first();if(surface==='viewer'){await expect(grip).toBeVisible();const h=(await grip.boundingBox())!;await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2,h.y+h.height/2+160,{steps:15});await page.mouse.up();await expect(page.getByRole('dialog',{name:'일정 상세',exact:true})).not.toBeVisible();await page.locator('[data-eventid="fixture-detail-layout"]:visible').first().click();await grip.click();await expect(page.getByRole('dialog',{name:'일정 상세',exact:true})).not.toBeVisible();}else {await page.keyboard.press('Escape');await expect(page.locator('.event-editor-panel:visible')).toHaveCount(0);}
  await finish(page,info,proof,{surface,width:390,desktopReturnAbsent:true,mobileClosePreserved:true});
});

import { test, expect } from '@playwright/test';
import { guardCompanionQa } from './helpers/companion-qa';
import { companionTraceMode } from './helpers/companion-evidence-policy';
test.use({ serviceWorkers: 'block', video: 'on', trace: companionTraceMode() });
for (const [width, parts, access, variant, theme] of [
  [1440,12,'public','page','light'],[1920,12,'public','modal','dark'],
  [390,12,'public','page','light'],[1440,1,'public','page','light'],
  [1440,3,'mixed','page','light'],[390,3,'mixed','page','dark'],[1440,2,'sub','page','dark'],[390,2,'plus','page','dark']
] as const) test(`Part picker ${width} ${parts} ${access} ${variant} ${theme}: count title selection and keyboard`, async ({page,context,baseURL},info) => {
  await page.setViewportSize({width,height:1000});
  const proof=await guardCompanionQa(page,context,baseURL!);
  await context.addInitScript(dark=>{
    localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.dark',dark?'on':'off');
    localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));
    for(const key of ['vic.ambient','vic.sound','vic.gfxPref'])localStorage.setItem(key,'off');
    localStorage.setItem('vic.vod.keysSeen','3');
  },theme==='dark');
  await context.route('**/api/public/fixture/vod-timeline?*',route=>route.fulfill({json:{authorNick:'합성',entries:[{sec:0,label:'처음',section:null},{sec:300,label:'합성 챕터',section:null}],variants:[]}}));
  await context.route('**/api/public/fixture/vod-chat?*',route=>route.fulfill({json:{binSec:30,bins:[]}}));
  await context.route(/^https:\/\/vod\.sooplive\.co\.kr\/player\/\d+\/embed\??.*$/,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local blocked-media fixture</title>'}));
  await page.goto(`/visual-fixture/vod-seek?access=${access}&parts=${parts}&variant=${variant}`);
  await expect(page.locator('.vch-item')).toHaveCount(2);
  await page.evaluate(()=>document.fonts.ready);
  const picker=page.getByRole('combobox',{name:'이 날의 영상 선택'}),counter=page.locator('.dvm-part-counter'),title=page.locator('.dvm-head .dvm-title');
  await expect(page.locator('.dvm-tabs,.dvm-tab')).toHaveCount(0);
  await expect(title).toHaveText('합성 첫 영상');
  await expect(counter).toHaveText(access==='sub'?'영상 1 / 2':`1 / ${access==='mixed'?2:parts}부`);
  const bounds=()=>page.locator('.dvm-head').evaluate(head=>{
    const r=head.getBoundingClientRect();
    return{height:r.height,overflow:head.scrollWidth>head.clientWidth+1,items:[...head.children].filter(e=>getComputedStyle(e).position!=='absolute').map(e=>{const b=e.getBoundingClientRect();return{left:b.left-r.left,right:b.right-r.left,width:b.width};}),width:r.width};
  });
  const before=await bounds();expect(before.overflow).toBe(false);
  if(parts===1){await expect(picker).toHaveCount(0);await expect(page.locator('.dvm-part-counter svg')).toHaveCount(0);}
  else{
    await expect(picker.locator('option')).toHaveCount(parts);
    await expect(picker.locator('option').first()).toContainText('합성 첫 영상');
    await expect(picker.locator('option').first()).toContainText('10분');
    if(access==='mixed'){
      await picker.selectOption('43');await expect(counter).toHaveText('영상 1 / 1');
      await expect(page.locator('.dvm-head .vod-access-badge')).toHaveAttribute('aria-label','구독');
      await picker.selectOption('44');await expect(counter).toHaveText('2 / 2부');
      await expect(page.locator('.dvm-head .vod-access-badge')).toHaveAttribute('aria-label','구독+');
      await expect(page.locator('.dvm-head .dvm-host')).toBeVisible();
      expect(Math.abs((await bounds()).height-before.height)).toBeLessThan(0.5);
    }else{
      await picker.focus();await page.keyboard.press('ArrowDown');
      await expect(picker).toHaveValue('43');await expect(title).toHaveText('합성 다른 영상');await expect(picker).toBeFocused();
      const count=await counter.textContent();await page.keyboard.press('Shift+ArrowRight');await expect(counter).toHaveText(count!);
      await picker.selectOption(String(41+parts));
      if(parts>2)await expect(title).toHaveText(`합성 ${parts}부 · 제목이 길어도 상단 높이가 바뀌지 않는지 확인하는 영상`);
      // Opening spring can leave a <0.02px transform during the first read.
      // Half a CSS pixel still detects an added line without treating it as a jump.
      expect(Math.abs((await bounds()).height-before.height)).toBeLessThan(0.5);
    }
    await picker.selectOption('42');await picker.focus();
    await expect(picker).toBeFocused();
    // Native popup cancellation must not dismiss the containing modal.
    if(variant==='modal'){
      await picker.click();await page.keyboard.press('Escape');await expect(page.getByRole('dialog',{name:'다시보기',exact:true})).toBeVisible();
    }
    await page.locator('.day-vod-modal').focus();await page.keyboard.press('Shift+ArrowRight');
    await expect(picker).toHaveValue('43');await expect(title).toHaveText('합성 다른 영상');
    await page.keyboard.press('Shift+ArrowLeft');await expect(picker).toHaveValue('42');
  }
  const after=await bounds();expect(after.overflow).toBe(false);
  for(const item of after.items){expect(item.left).toBeGreaterThanOrEqual(-1);expect(item.right).toBeLessThanOrEqual(after.width+1);}
  await info.attach('parts-header',{body:await page.screenshot(),contentType:'image/png'});
  if(variant==='modal'){
    await page.locator('.day-vod-modal').focus();await page.keyboard.press('Escape');await expect(page.getByText('테스트 창 닫힘')).toBeVisible();
  }
  await Promise.all(proof.pending);
  expect(proof.errors).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.mutations).toEqual([]);expect(proof.liveReads).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);
  await info.attach('observation',{body:JSON.stringify({at:new Date().toISOString(),facts:{width,parts,access,variant,theme,before,after,buildId:proof.build,nativeInput:true,playback:'Blocked local media fixture; no real external playback or login'},fullCertification:false}),contentType:'application/json'});
});

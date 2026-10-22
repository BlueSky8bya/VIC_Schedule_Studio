import {expect,test,type Page,type BrowserContext} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {DEFAULT_COMPANION_PREFERENCES} from '@/lib/ui/viewer-companion/preferences';
import {DEFAULT_COMPANION_MEMORY} from '@/lib/ui/viewer-companion/care';
import {SETTINGS_EPOCH,SETTINGS_EPOCH_KEY} from '@/lib/ui/motion';
import {openCompanionHome,placeCompanionOnHomeFloor} from './helpers/companion-home';
import {settlePanelLayout} from './helpers/panel-layout';
import {fulfillReadOnlyFont} from './helpers/readonly-font';

test.use({storageState:{cookies:[],origins:[]},serviceWorkers:'block'});
async function guard(page:Page,context:BrowserContext,baseURL:string) {
  const errors:string[]=[],denied:string[]=[];
  const origin=new URL(baseURL).origin;
  const fonts=new Set([...readFileSync(resolve('app/fonts.css'),'utf8').matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match=>match[1]));
  page.on('pageerror',error=>errors.push(error.message));
  await context.route('**/*',route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin!==origin){if(request.resourceType()==='font')return fulfillReadOnlyFont(route,fonts,denied);denied.push(request.method()+' '+url.pathname);return route.abort();}
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:{ok:true,skipped:true,live:false}});
    if(!['GET','HEAD'].includes(request.method())){denied.push(request.method()+' '+url.pathname);return route.abort();}
    return route.continue();
  });
  return {errors,denied};
}
for(const surface of ['viewer','studio']as const)test(surface==='viewer'?'168 opt-in local lamp trace downloads sanitized actual paint without preference writes':'169 owner studio local lamp trace survives actor reconstruction and downloads',async({page,context,baseURL})=>{
  const {errors,denied}=await guard(page,context,baseURL!);
  await page.addInitScript(({prefs,memory,epoch,key})=>{
    localStorage.setItem(key,epoch);
    localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,...prefs,personality:'balanced',personalitySource:'manual',speed:'lively',roam:false}));
    localStorage.setItem('vic.viewerCompanionCare',JSON.stringify({version:3,...memory,energy:.9,hunger:.05}));
    for(const [key,value]of Object.entries({'vic.gfxPref':'auto','vic.reduceMotion':'off','vic.ambient':'off','vic.premiereStage':'on','vic.calText':'18','vic.font':'maple','vic.calWeight':'0','vic.eyeComfort':'on','vic.prefSplit':'1','private-test-identity':'PRIVATE_CANARY_168','vic.companionHomeLight.v1':JSON.stringify({version:1,lit:true})}))localStorage.setItem(key,value);
    for(const key of ['vic.calText','vic.font','vic.calWeight'])localStorage.setItem(key+'.studio',localStorage.getItem(key)!);
  },{prefs:DEFAULT_COMPANION_PREFERENCES,memory:DEFAULT_COMPANION_MEMORY,epoch:SETTINGS_EPOCH,key:SETTINGS_EPOCH_KEY});
  await page.setViewportSize({width:1494,height:937});
  await page.goto(surface==='viewer'?'/visual-fixture/poster?hour=0&lampTrace=1':'/visual-fixture/studio?role=owner&hour=0&lampTrace=1');await page.bringToFront();await settlePanelLayout(page);
  const panel=page.getByRole('region',{name:'전등 진단',exact:true});await expect(panel).toBeVisible();await expect(panel).toHaveCount(1);
  const house=await openCompanionHome(page);
  const fold=house.locator('[data-home-action="fold"]');if(await fold.count()&&await fold.getAttribute('aria-expanded')==='false')await fold.click();
  await house.locator('[data-home-action="personality"]').click();
  const book=page.getByRole('dialog',{name:'빅타민 수첩',exact:true});await book.getByRole('tab',{name:'움직임',exact:true}).click();await book.locator('[data-act="companion-roam"]').setChecked(true);await book.getByRole('button',{name:'닫기',exact:true}).click();
  await placeCompanionOnHomeFloor(page);
  const before=await page.evaluate(()=>localStorage.getItem('vic.viewerCompanion'));
  await expect(panel).toHaveCount(1);expect(await page.evaluate(()=>getComputedStyle(document.body).fontFamily)).toContain('VIC Maplestory');
  const button=page.getByRole('button',{name:'전등 진단 저장',exact:true});await expect(button).toBeVisible();await expect(button).not.toHaveAttribute('data-act');await expect(button).toHaveAttribute('data-activity-manual','');
  const downloaded=page.waitForEvent('download',{timeout:30000});
  await page.locator('.vc-companion').getByRole('button',{name:'빅타민 · 쓰다듬고 옮기기',exact:true}).press('n');
  const file=await downloaded;expect(file.suggestedFilename()).toMatch(/^VIC-lamp-diagnostic-\d+\.json$/);
  const content=readFileSync((await file.path())!,'utf8');const trace=JSON.parse(content);
  expect(trace.kind).toBe('local-lamp-diagnostic');expect(trace.context).toMatchObject({personality:'balanced',speed:'lively',textPx:18,font:'maple',controllerConnected:true});
  expect(trace.frames.length).toBeGreaterThan(0);expect(trace.frames.length).toBeLessThanOrEqual(720);expect(trace.frames.some((frame:{stage:string})=>frame.stage==='paint')).toBe(true);
  expect(content).not.toContain('PRIVATE_CANARY_168');expect(content).not.toContain('vic.viewerCompanionCare');
  expect(await page.evaluate(()=>localStorage.getItem('vic.viewerCompanion'))).toBe(before);
  const manual=page.waitForEvent('download');await button.click();expect((await manual).suggestedFilename()).toMatch(/^VIC-lamp-diagnostic-\d+\.json$/);
  expect(errors).toEqual([]);expect(denied).toEqual([]);
  const output=process.env.COMPANION164_OUTPUT??'.scratch-pw/lamp-live-trace-20261022';mkdirSync(output,{recursive:true});writeFileSync(resolve(output,surface==='viewer'?'local-export.json':'studio-export.json'),JSON.stringify({scope:'Synthetic guarded fixture; exporter only, not actual-user lamp success',trace,errors,denied,preferencesUnchanged:true},null,2));
});
test('169 diagnostic controls remain visible with the companion disabled',async({page,context,baseURL})=>{
  const {errors,denied}=await guard(page,context,baseURL!);
  await page.addInitScript(({prefs,epoch,key})=>{localStorage.setItem(key,epoch);localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,...prefs,enabled:false}));},{prefs:DEFAULT_COMPANION_PREFERENCES,epoch:SETTINGS_EPOCH,key:SETTINGS_EPOCH_KEY});
  await page.goto('/visual-fixture/poster?lampTrace=1');await page.bringToFront();
  const panel=page.getByRole('region',{name:'전등 진단',exact:true});await expect(panel).toBeVisible();await expect(panel).toHaveCount(1);await expect(page.locator('.vc-companion')).toHaveCount(0);
  await expect(panel).toContainText('빅타민 동작 연결 대기');
  const before=await page.evaluate(()=>localStorage.getItem('vic.viewerCompanion')),download=page.waitForEvent('download');await panel.getByRole('button',{name:'전등 진단 저장',exact:true}).click();
  const file=await download,trace=JSON.parse(readFileSync((await file.path())!,'utf8'));expect(trace.context.controllerConnected).toBe(false);expect(trace.frames).toEqual([]);expect(await page.evaluate(()=>localStorage.getItem('vic.viewerCompanion'))).toBe(before);
  const output=process.env.COMPANION164_OUTPUT??'.scratch-pw/lamp-live-trace-20261022';mkdirSync(output,{recursive:true});await page.screenshot({path:resolve(output,'diagnostic-visible-actor-disabled.png')});
  expect(errors).toEqual([]);expect(denied).toEqual([]);
});

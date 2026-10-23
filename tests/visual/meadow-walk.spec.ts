import {test,expect,type Page} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {DEFAULT_COMPANION_PREFERENCES} from '@/lib/ui/viewer-companion/preferences';
import {SETTINGS_EPOCH,SETTINGS_EPOCH_KEY} from '@/lib/ui/motion';
import {fulfillReadOnlyFont} from './helpers/readonly-font';

const out=process.env.MEADOW_WALK_OUTPUT??'.scratch-pw/meadow-walk-proof';
const fonts=new Set([...readFileSync('app/fonts.css','utf8').matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m=>m[1]));
test.use({storageState:{cookies:[],origins:[]},serviceWorkers:'block',video:{mode:'on',size:{width:1920,height:1080}},trace:'retain-on-failure'});
test.setTimeout(100000);
test.beforeEach(async({page,context,baseURL},info)=>{
  mkdirSync(out,{recursive:true});
  const origin=new URL(baseURL!).origin;
  await context.route('**/*',route=>{
    const r=route.request(),u=new URL(r.url());
    if(r.method()==='GET'&&r.resourceType()==='font'&&fonts.has(u.href))return fulfillReadOnlyFont(route,fonts,[]);
    if(u.origin!==origin||!['GET','HEAD'].includes(r.method()))return route.abort();
    if(u.pathname.startsWith('/api/'))return route.fulfill({status:404,body:'No real service in credential-free meadow fixture'});
    return route.continue();
  });
  await page.addInitScript(({defaults,epoch,epochKey,enabled})=>{
    const values={[epochKey]:epoch,'vic.gfxPref':'max','vic.gfx':JSON.stringify({mode:'full',v:3,at:Date.now()}),'vic.ambient':'on','vic.reduceMotion':'off','vic.sound':'off','vic.premiereStage':'off','vic_avatar_side':'left','vic.viewerCompanion':JSON.stringify({version:1,...defaults,enabled,roam:true,jump:true,sleep:false,feeding:false,sound:false,activeWhileVisible:true,personality:'curious',personalitySource:'manual'})};
    for(const [k,v]of Object.entries(values))localStorage.setItem(k,v);
  },{defaults:DEFAULT_COMPANION_PREFERENCES,epoch:SETTINGS_EPOCH,epochKey:SETTINGS_EPOCH_KEY,enabled:!info.title.includes('cold sprite')});
});

async function enterMeadow(page:Page){
  await page.waitForFunction(()=>Boolean(window.__vicAmbient));
  const section=page.locator('[data-panel-section-toggle="season"]:visible').first();
  if(await section.getAttribute('aria-expanded')==='false')await section.click();
  const trigger=page.locator('[data-act="ambient-showcase"]:visible').first();
  await expect(trigger).toBeVisible();await trigger.click();return trigger;
}

async function setEnabled(page:Page,enabled:boolean){
  await page.evaluate(value=>{const p=JSON.parse(localStorage.getItem('vic.viewerCompanion')!);p.enabled=value;localStorage.setItem('vic.viewerCompanion',JSON.stringify(p));window.dispatchEvent(new CustomEvent('vic:viewer-companion',{detail:p}));},enabled);
}

async function expectPaintedMeadow(page:Page){
  await page.waitForFunction(()=>window.__vicAmbient?.pending()===0);
  await expect.poll(()=>page.evaluate(()=>{
    const canvas=document.querySelector<HTMLCanvasElement>('canvas.gs-season');if(!canvas)return false;
    for(let el:HTMLElement|null=canvas;el;el=el.parentElement){const css=getComputedStyle(el);if(css.display==='none'||css.visibility==='hidden'||Number(css.opacity)===0)return false;}
    const g=canvas.getContext('2d');return Boolean(g&&g.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height*.7),1,1).data[3]>0);
  })).toBe(true);
}

async function traceWalk(page:Page,duration:number){
  return page.evaluate(async ms=>{
    const start=performance.now(),samples:{at:number;x:number;y:number;bottom:number;ground:number;leg:number;row:number;state:string;paint:string}[]=[];
    let previous=0;
    await new Promise<void>(resolve=>{const next=()=>{const at=performance.now(),el=document.querySelector<HTMLElement>('.vc-meadow-walk'),body=el?.querySelector<HTMLElement>('.vc-meadow-walk-body');if(el&&body&&at-previous>=100){const box=body.getBoundingClientRect();samples.push({at,x:box.x,y:box.y,bottom:box.bottom,ground:Number(el.dataset.groundY),leg:Number(el.dataset.leg),row:Number(el.dataset.row),state:el.dataset.state??'',paint:el.dataset.paintedAt??''});previous=at;}if(at-start>=ms)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);});
    const canvas=document.querySelector<HTMLCanvasElement>('.vc-meadow-walk canvas');
    const pixels=canvas?.getContext('2d')?.getImageData(0,0,canvas.width,canvas.height).data;
    return {samples,paintedPixels:pixels?Array.from(pixels).filter((n,i)=>i%4===3&&n>0).length:0,width:innerWidth,height:innerHeight};
  },duration);
}

for(const surface of ['viewer','owner','preview']as const){
  test(`meadow walk ${surface}: painted continuous stroll and safe calendar return`,async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(surface==='viewer'?'/visual-fixture/poster?ambient=spring':`/visual-fixture/studio?role=owner&y=2026&m=4${surface==='preview'?'&viewer=1':''}`);
    await page.bringToFront();
    const trigger=await enterMeadow(page);
    const pet=page.locator('.vc-meadow-walk');await expect(pet).toBeVisible({timeout:15000});
    await expectPaintedMeadow(page);
    await expect(page.locator('.biome-map,.biome-chev,.biome-pill')).toHaveCount(0);
    const observed=await traceWalk(page,25000);
    mkdirSync(out,{recursive:true});writeFileSync(`${out}/${surface}-painted-walk.json`,JSON.stringify({test:info.title,...observed,scope:'Native painted post-render boxes and decoded alpha; no engine/RNG/clock/position patch. Three shared surfaces, not all personalities/full200.'},null,2));
    const xs=observed.samples.map(r=>r.x);
    expect(observed.paintedPixels).toBeGreaterThan(500);
    expect(Math.max(...xs)-Math.min(...xs)).toBeGreaterThan(90);
    expect(new Set(observed.samples.map(r=>r.leg)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(observed.samples.map(r=>r.paint)).size).toBeGreaterThan(80);
    expect(observed.samples.every(r=>r.ground>observed.height*.5&&r.ground<observed.height*.95)).toBe(true);
    const jumps=observed.samples.slice(1).map((r,i)=>Math.hypot(r.x-observed.samples[i].x,r.y-observed.samples[i].y));
    expect(Math.max(...jumps)).toBeLessThan(60);
    await page.screenshot({path:`${out}/${surface}-meadow.png`});
    if(surface==='viewer'){
      // Use the real preference subscription, without resetting the controller.
      const update=async(roam:boolean)=>page.evaluate(value=>{const p=JSON.parse(localStorage.getItem('vic.viewerCompanion')!);p.roam=value;localStorage.setItem('vic.viewerCompanion',JSON.stringify(p));window.dispatchEvent(new CustomEvent('vic:viewer-companion',{detail:p}));},roam);
      await update(false);await expect(pet).toHaveAttribute('data-state','idle');
      const stopped=Number(await pet.getAttribute('data-x'));await page.waitForTimeout(800);expect(Math.abs(Number(await pet.getAttribute('data-x'))-stopped)).toBeLessThan(1);
      await update(true);await expect.poll(async()=>Math.abs(Number(await pet.getAttribute('data-x'))-stopped)).toBeGreaterThan(15);
      await page.getByRole('button',{name:'배경 설정',exact:true}).click();
      const z=await page.evaluate(()=>({pet:Number(getComputedStyle(document.querySelector('.vc-meadow-walk')!).zIndex),panel:Number(getComputedStyle(document.querySelector('.showcase-set')!).zIndex)}));
      expect(z.pet).toBeLessThan(z.panel);
      await page.keyboard.press('Escape');
    }
    await page.keyboard.press('Escape');await expect(pet).toHaveCount(0);await expect(trigger).toBeFocused();
    await expect(page.locator('.vc-companion')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('meadow four seasons retain distinct flora and only two viewing controls',async({page})=>{
  await page.goto('/visual-fixture/poster?ambient=spring');await enterMeadow(page);
  await page.getByRole('button',{name:'배경 설정',exact:true}).click();await page.locator('.sc-set-more summary').click();
  for(const [key,label]of [['spring','봄'],['summer','여름'],['autumn','가을'],['winter','겨울']]as const){
    await page.getByRole('radiogroup',{name:'계절',exact:true}).getByRole('radio',{name:label,exact:true}).click();
    await page.waitForFunction(s=>window.__vicAmbient?.season===s&&window.__vicAmbient.pending()===0,key);
    await page.keyboard.press('Escape');
    await expectPaintedMeadow(page);
    await page.screenshot({path:`${out}/season-${key}.png`});
    await page.getByRole('button',{name:'배경 설정',exact:true}).click();await page.locator('.sc-set-more summary').click();
  }
  for(const [band,label]of [['night','밤'],['noon','점심']]as const){
    await page.getByRole('radiogroup',{name:'시간대',exact:true}).getByRole('radio',{name:label,exact:true}).click();
    await page.waitForFunction(value=>window.__vicAmbient?.world().band===value,band);
    if(band==='night')await expect(page.locator('.vc-meadow-walk')).toHaveAttribute('data-night','1');
    else await expect(page.locator('.vc-meadow-walk')).not.toHaveAttribute('data-night');
    await page.keyboard.press('Escape');await page.screenshot({path:`${out}/winter-${band}.png`});
    await page.getByRole('button',{name:'배경 설정',exact:true}).click();await page.locator('.sc-set-more summary').click();
  }
});

test('meadow cold sprite failure recovers and reduced motion and OFF stay effective',async({page})=>{
  await page.goto('/visual-fixture/poster?ambient=autumn');await enterMeadow(page);
  let rejected=false;
  await page.route('**/companion/hd/**',route=>{if(!rejected&&/\.webp(?:\?|$)/.test(route.request().url())){rejected=true;return route.abort();}return route.fallback();});
  await page.evaluate(()=>{const states:string[]=[];Object.assign(window,{__meadowLoadStates:states});new MutationObserver(()=>{const state=document.querySelector<HTMLElement>('.vc-meadow-walk')?.dataset.loadState;if(state&&states.at(-1)!==state)states.push(state);}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-load-state']});});
  await setEnabled(page,true);
  const pet=page.locator('.vc-meadow-walk');await expect(pet).toBeVisible();
  expect(rejected).toBe(true);
  await expect(pet).toHaveAttribute('data-load-state','ready');
  const states=await page.evaluate(()=>(window as unknown as {__meadowLoadStates:string[]}).__meadowLoadStates);
  expect(states).toContain('waiting');expect(states.at(-1)).toBe('ready');
  writeFileSync(`${out}/cold-sprite-recovery.json`,JSON.stringify({states,rejected,scope:'Image failure installed after showcase entry with companion OFF; then real preference enabled.'},null,2));
  const before=Number(await pet.getAttribute('data-x'));
  await expect.poll(async()=>Math.abs(Number(await pet.getAttribute('data-x'))-before)).toBeGreaterThan(15);
  await page.evaluate(()=>document.documentElement.setAttribute('data-reduce-motion','1'));
  await expect(pet).toHaveAttribute('data-state','idle');
  const still=Number(await pet.getAttribute('data-x'));await page.waitForTimeout(1000);expect(Number(await pet.getAttribute('data-x'))).toBe(still);
  await page.keyboard.press('Escape');
  await setEnabled(page,false);
  await enterMeadow(page);await expect(pet).toHaveCount(0);
  await page.keyboard.press('Escape');await setEnabled(page,true);
  await expect(page.locator('.vc-companion')).toBeVisible();
  await page.setViewportSize({width:390,height:844});await expect(pet).toHaveCount(0);
  await expect(page.locator('.vc-companion')).toHaveCount(0);
});

import {test,expect,type Page} from '@playwright/test';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {DEFAULT_COMPANION_PREFERENCES} from '@/lib/ui/viewer-companion/preferences';
import {SETTINGS_EPOCH,SETTINGS_EPOCH_KEY} from '@/lib/ui/motion';
import {fulfillReadOnlyFont} from './helpers/readonly-font';
import {placeCompanionOnExposedBackground,enterCompanionMeadow} from './helpers/companion-outdoor';

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
    // Window is the event target. Register this read-only listener before
    // product effects so the actual resident has not yet been hidden.
    window.addEventListener('vic:showcase-transition',event=>{
      const detail=(event as CustomEvent<{phase:string;active:boolean}>).detail;
      const probe=window as Window&{__meadowAdmissionProbe?:()=>unknown;__meadowAdmissionWitness?:{transition?:unknown}};
      if(detail?.phase==='before'&&detail.active&&probe.__meadowAdmissionWitness&&probe.__meadowAdmissionProbe)probe.__meadowAdmissionWitness.transition=probe.__meadowAdmissionProbe();
    },true);
    const values={[epochKey]:epoch,'vic.gfxPref':'max','vic.gfx':JSON.stringify({mode:'full',v:3,at:Date.now()}),'vic.ambient':'on','vic.reduceMotion':'off','vic.sound':'off','vic.premiereStage':'off','vic_avatar_side':'left','vic.viewerCompanion':JSON.stringify({version:1,...defaults,enabled,roam:true,jump:true,sleep:false,feeding:false,sound:false,activeWhileVisible:true,personality:'curious',personalitySource:'manual'})};
    for(const [k,v]of Object.entries(values))localStorage.setItem(k,v);
  },{defaults:DEFAULT_COMPANION_PREFERENCES,epoch:SETTINGS_EPOCH,epochKey:SETTINGS_EPOCH_KEY,enabled:!info.title.includes('cold sprite')});
});

const enterMeadow=enterCompanionMeadow;

async function enterWithExposedResident(page:Page,label:string){
  // The editor's real version-copy control occupies x16..56 at the floor.
  // x90 put part of the 92px creature over that control, so it correctly did
  // not qualify. Open/settle the real section first, then prove its full box.
  await page.waitForFunction(()=>Boolean(window.__vicAmbient));
  const section=page.locator('[data-panel-section-toggle="season"]:visible').first();
  if(await section.getAttribute('aria-expanded')==='false')await section.click();
  await placeCompanionOnExposedBackground(page,180);
  await page.evaluate(()=>{
    const witness=()=>{
      const actor=document.querySelector<HTMLElement>('.vc-companion'),rect=actor?.getBoundingClientRect();
      const selector='.public-calendar-area,.public-calendar-header,.studio-calendar-panel,.studio-topbar,.studio-titlebar,.weekday-row,.studio-weekdays,.panel-section,.rail-info-card,.soop-live-beacon,.vc-home,.event-editor-panel,[role=dialog],button,a[href],input,select,textarea';
      const visible=(node:HTMLElement)=>{
        if(node.closest('[hidden],[aria-hidden=true],.vc-companion,.vc-meadow-walk,.vc-food-layer,.vc-toys,.gs-season,.gs-tide,.showcase-surface'))return false;
        for(let parent:HTMLElement|null=node;parent;parent=parent.parentElement){const s=getComputedStyle(parent);if(s.display==='none'||s.visibility==='hidden'||Number(s.opacity||1)<=.05)return false;}return true;
      };
      const covers=[...document.querySelectorAll<HTMLElement>(selector)].filter(visible).map(node=>({className:node.className,label:node.getAttribute('aria-label'),rect:node.getBoundingClientRect().toJSON()})).filter(cover=>cover.rect.width>0&&cover.rect.height>0);
      const collisions=rect?covers.filter(cover=>Math.min(rect.right,cover.rect.right)-Math.max(rect.left,cover.rect.left)>.5&&Math.min(rect.bottom,cover.rect.bottom)-Math.max(rect.top,cover.rect.top)>.5):[];
      const focused=document.activeElement as HTMLElement|null;
      return {viewport:{width:innerWidth,height:innerHeight},activeElement:focused?{tag:focused.tagName,className:focused.className,act:focused.dataset.act}:null,actor:rect?.toJSON(),attrs:actor?Object.fromEntries([...actor.attributes].map(a=>[a.name,a.value])):null,collisions,exposed:Boolean(rect&&rect.width>0&&rect.height>0&&rect.left>=0&&rect.top>=0&&rect.right<=innerWidth&&rect.bottom<=innerHeight&&!collisions.length),covers};
    };
    const record:{before:ReturnType<typeof witness>;transition?:ReturnType<typeof witness>;initialPaint?:{x:number;ground:number;box:{x:number;y:number;width:number;height:number}}}={before:witness()};
    (window as Window&{__meadowAdmissionWitness?:typeof record}).__meadowAdmissionWitness=record;
    (window as Window&{__meadowAdmissionProbe?:typeof witness}).__meadowAdmissionProbe=witness;
    const capture=(event:Event)=>{const detail=(event as CustomEvent<{phase:string;active:boolean}>).detail;if(detail?.phase==='before'&&detail.active){
      window.removeEventListener('vic:showcase-transition',capture,true);
      const firstPaint=()=>{const host=document.querySelector<HTMLElement>('.vc-meadow-walk'),body=host?.querySelector<HTMLElement>('.vc-meadow-walk-body');if(!host||host.hidden||!body||host.dataset.loadState!=='ready'||!host.dataset.paintedAt)return;const box=body.getBoundingClientRect();record.initialPaint={x:Number(host.dataset.x),ground:Number(host.dataset.groundY),box:{x:box.x,y:box.y,width:box.width,height:box.height}};observer.disconnect();clearTimeout(timer);};
      // Read the first actual drawing locally, independent of the latency of
      // subsequent Node/driver round trips. This observer never moves it.
      const observer=new MutationObserver(firstPaint),timer=setTimeout(()=>observer.disconnect(),15000);
      observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','data-painted-at','data-load-state']});firstPaint();
    }};
    window.addEventListener('vic:showcase-transition',capture,true);
    const focusLog:{at:number;type:string;tag:string;className:string;act?:string}[]=[];
    (window as Window&{__meadowFocusLog?:typeof focusLog}).__meadowFocusLog=focusLog;
    for(const type of ['focusin','focusout'])window.addEventListener(type,event=>{
      const target=event.target;if(target instanceof HTMLElement)focusLog.push({at:performance.now(),type,tag:target.tagName,className:target.className,act:target.dataset.act});
    },true);
    const pointerLog:{at:number;x:number;y:number;hitPet:boolean;tag:string;className:string;petBox?:{left:number;right:number;top:number;bottom:number}}[]=[];
    (window as Window&{__meadowPointerLog?:typeof pointerLog}).__meadowPointerLog=pointerLog;
    window.addEventListener('pointerdown',event=>{
      const target=event.target;if(!(target instanceof Element))return;const body=document.querySelector<HTMLElement>('.vc-meadow-walk-body'),box=body?.getBoundingClientRect();
      pointerLog.push({at:performance.now(),x:event.clientX,y:event.clientY,hitPet:Boolean(target.closest('.vc-meadow-walk-body')),tag:target.tagName,className:target.getAttribute('class')??'',petBox:box?{left:box.left,right:box.right,top:box.top,bottom:box.bottom}:undefined});
    },true);
  });
  const before=await page.evaluate(()=>(window as Window&{__meadowAdmissionWitness?:{before:{exposed:boolean}}}).__meadowAdmissionWitness!.before);
  expect(before.exposed).toBe(true);
  const trigger=await enterMeadow(page);
  await expect.poll(()=>page.evaluate(()=>Boolean((window as Window&{__meadowAdmissionWitness?:{initialPaint?:unknown}}).__meadowAdmissionWitness?.initialPaint)),{timeout:15000}).toBe(true);
  const admission=await page.evaluate(()=>(window as Window&{__meadowAdmissionWitness?:{transition?:{exposed:boolean;actor?:{x:number;y:number;width:number;height:number;bottom:number}};initialPaint?:{x:number;ground:number}}}).__meadowAdmissionWitness!);
  writeFileSync(`${out}/${label}-admission.json`,JSON.stringify(admission,null,2));
  expect(admission.transition?.exposed).toBe(true);
  const original=admission.transition!.actor!,first=admission.initialPaint!;
  expect(Math.hypot(first.x-(original.x+original.width/2),first.ground-original.bottom)).toBeLessThan(2);
  return trigger;
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
    const start=performance.now(),samples:{at:number;x:number;y:number;width:number;height:number;bottom:number;ground:number;leg:number;row:number;state:string;paint:string}[]=[];
    let previous=0;
    await new Promise<void>(resolve=>{const next=()=>{const at=performance.now(),el=document.querySelector<HTMLElement>('.vc-meadow-walk'),body=el?.querySelector<HTMLElement>('.vc-meadow-walk-body');if(el&&body&&at-previous>=100){const box=body.getBoundingClientRect();samples.push({at,x:box.x,y:box.y,width:box.width,height:box.height,bottom:box.bottom,ground:Number(el.dataset.groundY),leg:Number(el.dataset.leg),row:Number(el.dataset.row),state:el.dataset.state??'',paint:el.dataset.paintedAt??''});previous=at;}if(at-start>=ms)resolve();else requestAnimationFrame(next);};requestAnimationFrame(next);});
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
    const trigger=await enterWithExposedResident(page,surface);
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
    // Entry preserves the real screen-floor foot (~98% vh), rather than
    // teleporting to the former spawn band. Every sample stays on screen;
    // after that first leg, all later walking retains the strict grass band.
    expect(observed.samples.every(r=>r.ground>observed.height*.5&&r.ground<=observed.height-8&&r.x>=0&&r.y>=0&&r.x+r.width<=observed.width&&r.bottom<=observed.height)).toBe(true);
    const subsequentLegs=observed.samples.filter(r=>r.leg>=2);
    expect(subsequentLegs.length).toBeGreaterThan(20);
    expect(subsequentLegs.every(r=>r.ground>observed.height*.5&&r.ground<observed.height*.95)).toBe(true);
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
    // A visible background return must hand the last physical foot back to
    // ordinary living. Covered placement retention has its own shared cases.
    const finalBody=pet.locator('.vc-meadow-walk-body'),acquisition:unknown[]=[];
    let acquired=false;
    for(let attempt=0;attempt<4&&!acquired;attempt++){
      // A cached moving box can leave the pointer before the next driver
      // command arrives. Use the native locator's bounded stability/hit test.
      await finalBody.hover({timeout:5000});await page.mouse.down();
      const actual=await page.evaluate(()=>{
        const body=document.querySelector<HTMLElement>('.vc-meadow-walk-body'),log=(window as Window&{__meadowPointerLog?:{hitPet:boolean}[]}).__meadowPointerLog;
        return {pointer:log?.at(-1),held:Boolean(body?.hasAttribute('data-showcase-held'))};
      });
      acquisition.push(actual);
      writeFileSync(`${out}/${surface}-pointer-acquisition.json`,JSON.stringify(acquisition,null,2));
      if(actual.pointer?.hitPet){expect(actual.held).toBe(true);acquired=true;}
      else await page.mouse.up();
    }
    expect(acquired).toBe(true);
    await expect(finalBody).toHaveAttribute('data-showcase-held','');
    await page.mouse.move(180,page.viewportSize()!.height-65,{steps:16});await page.waitForTimeout(150);await page.mouse.up();
    await expect(finalBody).not.toHaveAttribute('data-showcase-held');
    const focusBeforeExit=await drawingFocus(page);
    expect(focusBeforeExit.className).toBe('vc-meadow-walk-body');
    await page.keyboard.press('Escape');await expect(pet).toHaveCount(0);await expect(trigger).toBeFocused();
    await expect(page.locator('.vc-companion')).toBeVisible();
    const focusAfterExit=await drawingFocus(page);
    writeFileSync(`${out}/${surface}-focus-return.json`,JSON.stringify({beforeExit:focusBeforeExit,afterExit:focusAfterExit,log:await page.evaluate(()=>(window as Window&{__meadowFocusLog?:unknown[]}).__meadowFocusLog)},null,2));
    expect(errors).toEqual([]);
  });
}

async function drawingFocus(page:Page){return page.evaluate(()=>{const node=document.activeElement as HTMLElement|null;return {tag:node?.tagName,className:node?.className,act:node?.dataset.act,connected:node?.isConnected,inert:Boolean(node?.closest('[inert]'))};});}

test('meadow four seasons retain distinct flora and only two viewing controls',async({page})=>{
  await page.goto('/visual-fixture/poster?ambient=spring');await enterWithExposedResident(page,'seasons');
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

test('meadow requires an exposed resident and reduced motion and OFF stay effective',async({page})=>{
  await page.goto('/visual-fixture/poster?ambient=autumn');
  await setEnabled(page,false);await enterMeadow(page);
  const pet=page.locator('.vc-meadow-walk');await expect(pet).toHaveCount(0);
  // Enabling inside does not invent a new outdoor resident. Admission belongs
  // to the actual pre-entry scene, including an explicit OFF choice.
  await setEnabled(page,true);await expect(pet).toHaveCount(0);
  await page.keyboard.press('Escape');await enterWithExposedResident(page,'reduced-motion');
  await expect(pet).toBeVisible();await expect(pet).toHaveAttribute('data-load-state','ready');
  const before=Number(await pet.getAttribute('data-x'));
  await expect.poll(async()=>Math.abs(Number(await pet.getAttribute('data-x'))-before)).toBeGreaterThan(15);
  await page.evaluate(()=>document.documentElement.setAttribute('data-reduce-motion','1'));
  await expect(pet).toHaveAttribute('data-state','idle');
  const still=Number(await pet.getAttribute('data-x'));await page.waitForTimeout(1000);expect(Number(await pet.getAttribute('data-x'))).toBe(still);
  await page.keyboard.press('Escape');await setEnabled(page,false);
  await enterMeadow(page);await expect(pet).toHaveCount(0);
  await page.keyboard.press('Escape');await setEnabled(page,true);
  await expect(page.locator('.vc-companion')).toBeVisible();
  await page.setViewportSize({width:390,height:844});await expect(pet).toHaveCount(0);
  await expect(page.locator('.vc-companion')).toHaveCount(0);
});

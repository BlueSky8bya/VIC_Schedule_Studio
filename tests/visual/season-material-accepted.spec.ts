import {test,expect,type Page,type Locator,type BrowserContext,type TestInfo} from '@playwright/test';
import {guardCompanionQa} from './helpers/companion-qa';
import {companionTraceMode} from './helpers/companion-evidence-policy';
import {openCompanionHome,placeCompanionOnHomeFloor} from './helpers/companion-home';
import {placeCompanionOnExposedBackground,enterCompanionMeadow} from './helpers/companion-outdoor';
import {DEFAULT_COMPANION_PREFERENCES} from '@/lib/ui/viewer-companion/preferences';
import {DEFAULT_COMPANION_CARE} from '@/lib/ui/viewer-companion/care';
import {settlePanelLayout} from './helpers/panel-layout';
import {ART_SLOTS} from '@/components/shared/ambient/art/manifest';
import {existsSync} from 'node:fs';
import {resolve,sep} from 'node:path';

type EntryFrame={state:string;x:number;y:number;groundY:number;width:number;at:number};
test.use({viewport:{width:1920,height:1100},video:'on',trace:companionTraceMode(),serviceWorkers:'block'});
test.setTimeout(90000);
async function setup(page:Page,context:BrowserContext,base:string){
 const proof=await guardCompanionQa(page,context,base);
 const missingOptionalArt:string[]=[],slots=new Map(ART_SLOTS.map(slot=>[slot.id,slot.variants]));
 // Declared optional variants absent from the checkout normally return404
 // and use ArtSet's existing fallback. Never fetch or synthesize new artwork.
 await context.route('**/ambient/art/**',async route=>{const req=route.request(),url=new URL(req.url()),match=url.pathname.match(/^\/ambient\/art\/([a-z0-9-]+)-(\d+)\.png$/),file=resolve('public','.'+url.pathname),root=resolve('public')+sep;if(url.origin!==base||req.method()!=='GET'||url.search||!file.startsWith(root)||existsSync(file)||!match||Number(match[2])<1||Number(match[2])>(slots.get(match[1])??0))return route.fallback();missingOptionalArt.push(url.pathname);return route.fulfill({status:404,body:'Declared optional local art variant absent; existing fallback preserved'});});
 Object.assign(proof,{missingOptionalArt});
 await page.addInitScript(({prefs,care})=>{if(window.top!==window)return;
  localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.gfxPref','max');localStorage.setItem('vic.gfx',JSON.stringify({mode:'full',v:3,at:Date.now()}));localStorage.setItem('vic.ambient','on');localStorage.setItem('vic.reduceMotion','off');localStorage.setItem('vic.dark','off');localStorage.setItem('vic.sound','off');localStorage.setItem('vic.premiereStage','off');localStorage.setItem('vic_avatar_side','left');
  localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,...prefs,enabled:true,roam:false,jump:false,sleep:false,feeding:true,activeWhileVisible:true,heartPrank:false,ambientPrank:false,personality:'balanced',personalitySource:'manual'}));localStorage.setItem('vic.viewerCompanionCare',JSON.stringify({version:1,...care,fullness:.99,energy:.95}));
 },{prefs:DEFAULT_COMPANION_PREFERENCES,care:DEFAULT_COMPANION_CARE});return proof;
}
async function finish(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof guardCompanionQa>>,facts:unknown){await Promise.all(proof.pending);expect(proof.errors).toEqual([]);expect(proof.mutations).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.liveReads).toEqual([]);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);await info.attach('actual-ui',{body:await page.screenshot(),contentType:'image/png'});await info.attach('observation',{body:JSON.stringify({facts,proof:{...proof,pending:undefined},synthetic:true,fullCertification:false}),contentType:'application/json'});}
async function move(page:Page,item:Locator,x:number,y:number){const b=(await item.boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(x,y,{steps:18});await page.waitForTimeout(180);await page.mouse.up();await page.mouse.move(2,2);}
async function mode(page:Page,name:string){const toggle=page.getByRole('radiogroup',{name:'계절 배경 상태',exact:true}).first();if(!await toggle.isVisible()){const section=page.locator('[data-panel-section-toggle="season"]:visible').first();if(await section.count()&&await section.getAttribute('aria-expanded')==='false')await section.click();}await toggle.getByRole('radio',{name,exact:true}).click();}

test('night month title remains readable while shared month chooser keeps neutral panel ink',async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!);let release!:()=>void,held=0;const pending=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/ambient/art/backdrop-meadow-autumn-ground-v1.png',async route=>{held++;await pending;await route.fallback();});
 let normal:{color:string;shadow:string};
 try{await page.goto('/visual-fixture/poster?ambient=autumn&hour=0&monthLink=1&month=2026-10',{waitUntil:'domcontentloaded'});await expect(page.locator('html')).toHaveAttribute('data-ambient-night','');await expect.poll(()=>held).toBeGreaterThan(0);const title=page.locator('.poster-chrome-title');normal=await title.evaluate(n=>({color:getComputedStyle(n).color,shadow:getComputedStyle(n).textShadow}));expect(normal.color).toBe('rgb(244, 247, 255)');await info.attach('night-title-during-art-loading',{body:await page.screenshot(),contentType:'image/png'});}finally{release();}
 await page.evaluate(async()=>{const ready=await window.__vicAmbient?.ready(20000);if(!ready?.ok)throw Error('actual-scene-not-ready');});await expect(page.locator('html')).toHaveAttribute('data-ambient-night','');await settlePanelLayout(page);await info.attach('night-title',{body:await page.screenshot(),contentType:'image/png'});
 await page.locator('[data-act="month-title"]').first().click();const panel=page.getByRole('dialog',{name:'월 선택',exact:true});await expect(panel).toBeVisible();const pickerColor=await panel.evaluate(n=>getComputedStyle(n).color);expect(pickerColor).not.toBe(normal.color);await page.keyboard.press('Escape');await expect(panel).toHaveCount(0);await finish(page,info,proof,{normal,pickerColor,actualNightFixture:true});
});

test('exposed resident food and toy share spatial scene material and lose it when background is off',async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!);await page.goto('/visual-fixture/poster?ambient=autumn&hour=0');await page.bringToFront();const home=await openCompanionHome(page);await placeCompanionOnHomeFloor(page);
 await home.getByRole('button',{name:'밥 꺼내기',exact:true}).click();const food=page.locator('.vc-food').last();await expect(food).not.toHaveAttribute('data-falling');await move(page,food,90,990);await expect(food).toHaveAttribute('data-platform',/^viewport-floor/);
 await home.getByRole('button',{name:'장난감 상자 열기',exact:true}).click();const toy=page.locator('.vc-toy').last();await expect(toy).toHaveAttribute('data-falling','false');await move(page,toy,170,990);await expect(toy).toHaveAttribute('data-platform',/^viewport-floor/);
 await placeCompanionOnExposedBackground(page,270);const body=page.locator('.vc-inertia');for(const item of [body,food,toy])await expect(item).toHaveAttribute('data-scene-lit','');await page.waitForTimeout(400);
 const ids={food:await food.getAttribute('data-food'),toy:await toy.getAttribute('data-toy-id')};
 const rendered=await page.evaluate(()=>[...document.querySelectorAll<HTMLElement>('.vc-inertia[data-scene-lit],.vc-food[data-scene-lit],.vc-toy[data-scene-lit]')].map(n=>{const filter=getComputedStyle(n).filter,id=n.style.getPropertyValue('--vc-scene-light-filter').match(/#([^")]+)/)?.[1],matrix=id?document.getElementById(id)?.querySelector('feColorMatrix')?.getAttribute('values'):null;return{className:n.className,filter,matrix,rect:n.getBoundingClientRect().toJSON()};}));
 expect(rendered).toHaveLength(3);expect(rendered.every(r=>r.matrix?.split(' ').slice(-5).join(' ')==='0.00000 0.00000 0.00000 1.00000 0.00000')).toBe(true);await info.attach('night-shared-material',{body:await page.screenshot(),contentType:'image/png'});
 await mode(page,'끄기');for(const item of [body,food,toy])await expect(item).not.toHaveAttribute('data-scene-lit');expect(await food.getAttribute('data-food')).toBe(ids.food);expect(await toy.getAttribute('data-toy-id')).toBe(ids.toy);await page.waitForTimeout(500);await info.attach('same-original-objects-background-off',{body:await page.screenshot(),contentType:'image/png'});await finish(page,info,proof,{ids,rendered,actualNativePlacement:true,offRestoresNeutral:true});
});

for(const surface of ['viewer','preview','studio'])test(`already exposed ${surface} resident enters appreciation without a new jump`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!);await page.goto(surface==='viewer'?'/visual-fixture/poster?ambient=spring&hour=12':`/visual-fixture/studio?role=owner&y=2026&m=3&ambient=spring&hour=12${surface==='preview'?'&viewer=1':''}`);await page.bringToFront();await openCompanionHome(page);const pet=await placeCompanionOnExposedBackground(page,surface==='studio'?180:90);await expect(page.locator('.vc-inertia')).toHaveAttribute('data-scene-lit','');const before=await pet.boundingBox();await info.attach('before-entry-exposed-position',{body:await page.screenshot(),contentType:'image/png'});
 await page.evaluate(()=>{const frames:EntryFrame[]=[];const started=performance.now();(window as Window & {__entryFrames?:EntryFrame[]}).__entryFrames=frames;const read=()=>{const n=document.querySelector<HTMLElement>('.vc-meadow-walk');if(n&&!n.hidden){const b=n.querySelector('.vc-meadow-walk-body')?.getBoundingClientRect();frames.push({state:n.dataset.state??"",x:Number(n.dataset.x),y:Number(n.dataset.y),groundY:Number(n.dataset.groundY),width:b?.width??0,at:performance.now()-started});}if(performance.now()-started<2500)requestAnimationFrame(read);};requestAnimationFrame(read);});
 await enterCompanionMeadow(page);await expect(page.locator('.vc-meadow-walk')).toBeVisible();await page.waitForTimeout(1000);const frames=await page.evaluate(()=>(window as Window & {__entryFrames?:EntryFrame[]}).__entryFrames as EntryFrame[]);expect(frames.length).toBeGreaterThan(5);expect(frames.every(f=>f.state!=='jump'&&Math.abs(f.groundY-f.y)<.05)).toBe(true);expect(Math.abs(frames[0].x-(before!.x+before!.width/2))).toBeLessThan(3);expect(Math.abs(frames[0].width-before!.width)).toBeLessThan(5);await info.attach('entry-frames',{body:JSON.stringify(frames),contentType:'application/json'});
 await page.keyboard.press('Escape');await expect(page.locator('.vc-meadow-walk')).toHaveCount(0);await expect(pet).toBeVisible();await expect(pet).toHaveAttribute('data-platform','companion-home-floor-400',{timeout:7000});await finish(page,info,proof,{surface,before,frames,actualEntryNoJump:true,homecomingPreserved:true});
});

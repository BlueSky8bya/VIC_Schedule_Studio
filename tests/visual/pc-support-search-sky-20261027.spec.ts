import {test,expect,type Page,type BrowserContext,type TestInfo} from '@playwright/test';
import {guardCompanionQa} from './helpers/companion-qa';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode(),actionTimeout:15000});
async function setup(page:Page,context:BrowserContext,base:string,width:number,dark=false,reduced=false){
  const proof=await guardCompanionQa(page,context,base);
  const actions=JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR??'.next','server/server-reference-manifest.json'),'utf8')).node as Record<string,{exportedName?:string}>;
  const heartReads=new Set(Object.entries(actions).filter(([,v])=>v.exportedName==='getAnonHeartIdsAction').map(([id])=>id));
  const sky=JSON.parse(readFileSync(resolve('tests/fixtures/ambient-sky-catalog-v1.json'),'utf8')) as {id:string}[];
  const prefetchPaths=new Set(['/','/studio/ambient-art',...sky.map(s=>'/studio/ambient-art/'+s.id)]);
  await context.route('**/*',r=>{
    const q=r.request(),u=new URL(q.url()),h=q.headers();
    if(q.method()!=='GET'||u.origin!==base||h['next-router-prefetch']!=='1'||h.rsc!=='1'||!prefetchPaths.has(u.pathname)||[...u.searchParams.keys()].some(k=>k!=='_rsc'))return r.fallback();
    proof.syntheticReads.push('known-studio-art-or-home-prefetch-suppressed');
    return r.fulfill({status:204,body:''});
  });
  await context.route('**/visual-fixture/poster?**',r=>{
    const q=r.request(),u=new URL(q.url());
    if(q.method()!=='POST'||u.origin!==base||u.pathname!=='/visual-fixture/poster'||!heartReads.has(q.headers()['next-action']))return r.fallback();
    proof.syntheticReads.push('known-anonymous-heart-read-empty');
    return r.fulfill({contentType:'text/x-component',body:'0:{"a":"$@1","f":[],"b":"fixture"}\n1:[]\n'});
  });
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(({dark,reduced})=>{
    localStorage.setItem('vic.settingsEpoch','2026-09-04');
    localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));
    localStorage.setItem('vic.ambient','off');localStorage.setItem('vic.sound','off');
    localStorage.setItem('vic.calText','14');localStorage.setItem('vic.calText.studio','14');
    localStorage.setItem('vic.dark',dark?'on':'off');
    localStorage.setItem('vic.reduceMotion',reduced?'on':'off');
  },{dark,reduced});return proof;
}
async function done(page:Page,info:TestInfo,proof:Awaited<ReturnType<typeof guardCompanionQa>>,facts:unknown){
  await settlePanelLayout(page);await Promise.all(proof.pending);
  for(const key of ['errors','rejected','mutations','liveReads'] as const)expect(proof[key],key).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);
  await info.attach('ui-after',{body:await page.screenshot(),contentType:'image/png'});
  await info.attach('observation',{body:JSON.stringify({facts,proof:{...proof,pending:undefined},syntheticFixture:true,operatingWrites:0,fullCertification:false}),contentType:'application/json'});
}
for(const surface of ['viewer','studio'] as const)for(const width of [1440,1920])test(`Ribbon scale and today ${surface} ${width}`,async({page,context,baseURL},info)=>{
  const studio=surface==='studio',proof=await setup(page,context,baseURL!,width,width===1920,studio&&width===1440);
  await page.goto(studio?`/visual-fixture/studio?role=${width===1920?'developer':'owner'}&supportUX=cozy`:`/visual-fixture/poster?supportUX=cozy${width===1920?'&rehearsal=1':''}`);
  await settlePanelLayout(page);
  const head=page.locator('.support-bar.sb-head[data-supportid="cozy-period-goods"]'),label=head.locator(':scope > span');
  await expect(head).toBeVisible();const before=await label.evaluate(e=>Number.parseFloat(getComputedStyle(e).fontSize));
  const settings=page.getByRole('button',{name:'설정',exact:true}).first();
  if(!await settings.isVisible())await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();
  await settings.click();
  const slider=page.getByRole('slider',{name:'달력 글씨 크기(px)',exact:true});await expect(slider).toBeVisible();
  await slider.focus();await slider.press('Home');await expect(slider).toHaveValue('12');
  const small=await label.evaluate(e=>Number.parseFloat(getComputedStyle(e).fontSize));
  await slider.press('End');await expect(slider).toHaveValue('20');
  const large=await label.evaluate(e=>Number.parseFloat(getComputedStyle(e).fontSize));
  expect(large/before).toBeCloseTo(20/14,2);expect(large/small).toBeCloseTo(20/12,2);
  await page.keyboard.press('Escape');await expect(slider).toHaveCount(0);await page.mouse.move(1,1);await settlePanelLayout(page);
  if(studio&&await page.locator('.panel-scrim').isVisible()){
    await page.getByRole('button',{name:'패널 접기',exact:true}).click();await settlePanelLayout(page);
  }
  const today=page.locator(studio?'.studio-day.today':'.public-day.today');await expect(today).toHaveCount(1);
  const geometry=await page.evaluate(({studio})=>{
    const cell=document.querySelector(studio?'.studio-day.today':'.public-day.today')!,ring=getComputedStyle(cell,'::after'),r=cell.getBoundingClientRect();
    return [...document.querySelectorAll<HTMLElement>('.support-bar.sb-head[data-supportid="cozy-period-goods"],.support-bar.sb-head[data-supportid="cozy-support"]')].map(bar=>{
      const span=bar.querySelector('span')!,box=span.getBoundingClientRect(),b=bar.getBoundingClientRect();
      const text=[...span.childNodes].find(n=>n.nodeType===Node.TEXT_NODE&&n.textContent?.trim());
      const range=document.createRange();if(text)range.selectNodeContents(text);const s=text?range.getBoundingClientRect():box;
      const crossings=[r.left,r.right].filter(x=>s.left<x&&s.right>x);
      const visibleCrossings=crossings.map(x=>{const top=document.elementFromPoint(x,box.top+box.height/2);return Boolean(top&&(top===span||span.contains(top)));});
      return{id:bar.dataset.supportid,font:Number.parseFloat(getComputedStyle(span).fontSize),line:Number.parseFloat(getComputedStyle(span).lineHeight),barHeight:b.height,labelHeight:box.height,ringZ:Number(ring.zIndex),barZ:Number(getComputedStyle(bar).zIndex),today:{left:r.left,right:r.right},label:{left:s.left,right:s.right},crossesToday:crossings.length>0,visibleCrossings};
    });
  },{studio});
  expect(geometry).toHaveLength(2);expect(geometry.every(g=>g.barZ>g.ringZ&&g.labelHeight<=g.barHeight+1)).toBe(true);
  expect(geometry.some(g=>g.crossesToday)).toBe(true);
  expect(geometry.flatMap(g=>g.visibleCrossings).every(Boolean),'crossing label is actually above adjacent day surfaces').toBe(true);
  await info.attach('large-ribbons-cross-today',{body:await page.screenshot(),contentType:'image/png'});
  const ringFacts={surface,width,before,small,large,geometry,actualSettingsKeyboard:true,reducedMotion:await page.evaluate(()=>document.documentElement.hasAttribute('data-reduce-motion'))};
  if(studio){
    await head.dblclick();const fold=page.locator('[data-act="fold-head"]');
    const field=page.locator('.support-link-input:visible');if(!await field.isVisible())await fold.click();await expect(field).toBeVisible();
    const preview=page.locator('[data-act="support-visit"]:visible'),invalid=page.locator('.support-link-invalid:visible');
    const heights:number[]=[];
    for(const value of ['not-a-url','http://example.com/a','javascript:alert(1)','https://']){
      await field.fill(value);await expect(field).toHaveAttribute('aria-invalid','true');await expect(preview).toHaveCount(0);await expect(invalid).toBeVisible();heights.push((await invalid.boundingBox())!.height);
    }
    await field.fill('https://example.com/notice');await expect(preview).toHaveAttribute('href','https://example.com/notice');await expect(invalid).toHaveCount(0);expect((await preview.boundingBox())!.height).toBeCloseTo(heights[0],0);
    await field.fill('');await expect(preview).toHaveCount(0);await expect(invalid).toHaveCount(0);
    await done(page,info,proof,{...ringFacts,previewValidation:true,externalPreviewNotOpened:true,existingServerValidationReused:true});
  }else await done(page,info,proof,ringFacts);
});

for(const surface of ['viewer','studio'])test(`Search four source filters ${surface}`,async({page,context,baseURL},info)=>{
  const proof=await setup(page,context,baseURL!,1440);
  await context.route('**/api/public/*/search**',r=>{
    const q=r.request(),u=new URL(q.url());if(q.method()!=='GET'||u.origin!==baseURL)return r.fallback();
    if(u.pathname.endsWith('/suggest'))return r.fulfill({json:{items:[]}});
    if(u.pathname.endsWith('/trending'))return r.fulfill({json:{trends:[]}});
    if(!u.pathname.endsWith('/search'))return r.fallback();
    const common={dateKey:'2026-06-16',score:1,exact:true,popularity:.5};proof.syntheticReads.push('four-existing-hit-kinds');
    return r.fulfill({json:{query:u.searchParams.get('q'),hits:[
      {...common,kind:'event',eventId:'evt-001',title:'합성 일정',snippet:''},
      {...common,kind:'vod',titleNo:90000001,title:'합성 다시보기',snippet:'',durationMs:3600000},
      {...common,kind:'chapter',titleNo:90000001,sec:120,title:'합성 타임라인',snippet:'합성 다시보기',matchedOn:'label'},
      {...common,kind:'chapter',titleNo:90000001,sec:240,title:'합성 채팅 반응',snippet:'합성 다시보기',matchedOn:'chat'}
    ]}});
  });
  await page.goto(surface==='studio'?'/visual-fixture/studio?role=owner&y=2026&m=6':'/visual-fixture/poster');
  await settlePanelLayout(page);
  const search=page.getByRole('button',{name:'검색',exact:true}).first();
  if(!await search.isVisible())await page.getByRole('button',{name:'패널 펼치기',exact:true}).click();
  await expect(search).toBeVisible();await search.click();const sheet=page.getByRole('dialog',{name:'검색',exact:true}),input=sheet.getByRole('searchbox',{name:'검색어',exact:true});
  await input.fill('합성');await input.press('Enter');const filter=sheet.getByRole('group',{name:'검색 결과 종류'});await expect(filter.getByRole('button')).toHaveCount(5);
  await expect(filter).toContainText('채팅');await expect(filter).toContainText('타임라인');await expect(filter).not.toContainText('챕터');
  const choose=(kind:string)=>filter.locator(`[data-act-opt="${kind}"]`);
  for(const kind of ['event','vod','chat','timeline']){
    await choose(kind).click();await expect(choose(kind)).toHaveAttribute('aria-pressed','true');await expect(sheet.locator('.ps-count')).toHaveText('1');
    if(kind==='chat'||kind==='timeline'){await expect(sheet.locator('.ps-chapter')).toHaveCount(1);await expect(sheet.locator('.ps-chapter')).toContainText(kind==='chat'?'합성 채팅 반응':'합성 타임라인');}
  }
  await sheet.getByRole('button',{name:'닫기',exact:true}).click();await search.click();await expect(choose('timeline')).toHaveAttribute('aria-pressed','true');
  await choose('all').click();await expect(sheet.locator('.ps-count')).toHaveText('4');
  await done(page,info,proof,{surface,fourFilters:true,kindChapterWireDtoUnchanged:true,chatViaExistingMatchedOn:true,noNewCollection:true,parentVodContextNotCountedAsExtraHit:true,reopenSelectionPreserved:true});
});

test('Sky only art catalogue and current meadow',async({page,context,baseURL},info)=>{
  const proof=await setup(page,context,baseURL!,1440),requests:string[]=[];
  page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/ambient/art/'))requests.push(new URL(r.url()).pathname);});
  await page.addInitScript(()=>{const copies:string[]=[];(window as typeof window&{__skyCopies:string[]}).__skyCopies=copies;Object.defineProperty(navigator,'clipboard',{value:{writeText:async(text:string)=>{copies.push(text);}},configurable:true});});
  await page.goto('/visual-fixture/ambient-art');await expect(page.locator('.art-card')).toHaveCount(9);
  await expect(page.locator('[data-act="art-view-codex"],[data-act="art-prompt-copy-1"],[data-act="art-prompt-copy-2"]')).toHaveCount(0);
  expect(await page.getByRole('combobox',{name:'갈래',exact:true}).locator('option').allTextContents()).toEqual(['갈래 전부','하늘·천체']);
  await page.getByText('다른 프롬프트',{exact:true}).click();await page.locator('[data-act="art-prompt-copy-all"]').click();
  const copies=await page.evaluate(()=>(window as typeof window&{__skyCopies:string[]}).__skyCopies);expect(copies).toHaveLength(1);expect(copies[0]).toContain('moon-phase');expect(copies[0]).not.toMatch(/tree-pine|fish-palechub|bug-firefly/);
  await info.attach('sky-catalogue',{body:await page.screenshot(),contentType:'image/png'});
  await page.goto('/visual-fixture/ambient-art?slot=sun-disc');await expect(page.getByRole('heading',{name:/해/}).first()).toBeVisible();
  await page.goto('/visual-fixture/ambient-art?slot=tree-pine');await expect(page.getByRole('heading',{name:'페이지를 찾을 수 없어요',exact:true})).toBeVisible();await expect(page.locator('.art-card')).toHaveCount(0);
  const worlds=[],paintHashes:string[]=[];
  for(const [season,hour,event] of [['spring',12,''],['winter',23,'comet']] as const){
    await page.goto(`/visual-fixture/biome?biome=meadow&season=${season}&hour=${hour}&weather=clear&gfx=max&t=1700${event?'&skyEvent='+event:''}`);
    const canvas=page.locator('canvas').first();await expect(canvas).toBeVisible();
    await page.waitForFunction(()=>Math.abs((window.__vicAmbient?.settledT??-1)-1.7)<0.02,undefined,{timeout:30000});
    const paint=await canvas.evaluate(c=>{const e=c as HTMLCanvasElement,ctx=e.getContext('2d')!,colors=new Set<string>();let opaque=0;for(let y=0;y<e.height;y+=Math.max(1,Math.floor(e.height/32)))for(let x=0;x<e.width;x+=Math.max(1,Math.floor(e.width/32))){const p=ctx.getImageData(x,y,1,1).data;colors.add([...p].join(','));if(p[3]>240)opaque++;}return{colors:colors.size,opaque,image:e.toDataURL()};});
    expect(paint.colors,'painted world differs from a blank canvas').toBeGreaterThan(20);expect(paint.opaque).toBeGreaterThan(800);paintHashes.push(paint.image);
    const settledT=await page.evaluate(()=>window.__vicAmbient?.settledT);
    await info.attach(`meadow-${season}`,{body:await page.screenshot(),contentType:'image/png'});worlds.push({season,hour,event,frozenFrame:true,settledT,paintedColors:paint.colors,opaqueSamples:paint.opaque});
  }
  expect(paintHashes[0],'spring noon and winter night render different worlds').not.toBe(paintHashes[1]);
  expect(requests.some(p=>/\/(tree-|fish-|bug-|animal-|mushroom|twig|pebble)/.test(p))).toBe(false);
  await done(page,info,proof,{activeSlots:9,retiredSpeciesRoutes404:true,clipboardLocallyStubbed:true,realOsClipboardUnverified:true,worlds,noEcologyArtRequests:true,companionCollectionNotChanged:true,notLivingAiObservation:true});
});

import {test,expect,type Page} from '@playwright/test';
import {readFileSync}from'node:fs';
import {CALENDAR_PREVIEW_TITLE} from '@/lib/ui/calendar-preview-sample';import{resolve}from'node:path';
import{setup,finish,openSettings}from'./helpers/typography-harmony';
import{settlePanelLayout}from'./helpers/panel-layout';
import{companionTraceMode}from'./helpers/companion-evidence-policy';

test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode(),actionTimeout:15000});
const scenarios=[['viewer',1440,1000,'base',0],['owner',1920,1100,'base',0],['preview',1440,1000,'base',0],['viewer',320,640,'base',0],['viewer',390,844,'base',0],['owner',390,844,'base',0],['preview',390,844,'base',0],['viewer',900,700,'base',0],['viewer',1440,1000,'noto',100],['viewer',390,844,'noto',100],['owner',1280,900,'base',0]]as const;

async function compare(page:Page,surface:string){return page.evaluate(({surface,sampleTitle})=>{
 const host=document.querySelector<HTMLElement>(surface==='owner'?'.studio-shell':'.poster-page')!;
 const candidates=[...host.querySelectorAll<HTMLElement>('.agenda-title-text,.pill-main strong:not(.span-cont),.public-event .event-main p:not(.span-cont)')];
 const title=candidates.find(e=>e.textContent?.trim()===sampleTitle&&e.getBoundingClientRect().width>0&&getComputedStyle(e).visibility!=='hidden')!;
 const card=title?.closest<HTMLElement>('.agenda-event,.studio-event-pill,.public-event'),cell=title?.closest<HTMLElement>('.agenda-day,.studio-day,.public-day');
 const stage=document.querySelector<HTMLElement>('.rhh-text-stage')!,pv=document.querySelector<HTMLElement>('.pv-title-text')!,pc=pv.closest<HTMLElement>('.pv-card')!,pd=pv.closest<HTMLElement>('.rhh-text-preview')!,slider=document.querySelector<HTMLInputElement>('[data-act="text-size"]')!;
 const visible=(e:Element)=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
 function metrics(e:HTMLElement){const s=getComputedStyle(e),r=e.getBoundingClientRect();let scale=1;for(let node:HTMLElement|null=e;node;node=node.parentElement){const style=getComputedStyle(node),zoom=parseFloat(style.zoom);if(Number.isFinite(zoom))scale*=zoom;if(style.transform!=='none'){const matrix=new DOMMatrixReadOnly(style.transform);scale*=Math.hypot(matrix.a,matrix.b);}}const range=document.createRange();range.selectNodeContents(e);const ink=[...range.getClientRects()].filter(visibleRect=>visibleRect.width>0&&visibleRect.height>0);const lines=[...new Set(ink.map(b=>Math.round(b.top*10)/10))];return{width:r.width,font:parseFloat(s.fontSize)*scale,line:s.lineHeight==='normal'?null:parseFloat(s.lineHeight)*scale,weight:s.fontWeight,family:s.fontFamily,spacing:s.letterSpacing,wrap:s.overflowWrap,whiteSpace:s.whiteSpace,lines:lines.length,ink:ink.map(b=>({x:b.x,y:b.y,width:b.width,height:b.height})),rect:r.toJSON()};}
 if(!title||!card||!cell||!pv||!pc||!pd||!visible(title))return{found:false,measured:stage?.hasAttribute('data-preview-measured')};
 return{found:true,measured:stage.hasAttribute('data-preview-measured'),kind:stage.dataset.previewTopology,actual:metrics(title),preview:metrics(pv),actualCard:card.getBoundingClientRect().toJSON(),previewCard:pc.getBoundingClientRect().toJSON(),actualCell:cell.getBoundingClientRect().toJSON(),previewCell:pd.getBoundingClientRect().toJSON(),slider:slider.getBoundingClientRect().toJSON(),sample:pv.textContent};
 },{surface,sampleTitle:CALENDAR_PREVIEW_TITLE});}

for(const[surface,width,height,font,weight]of scenarios)test(`Settings specimen parity ${surface} ${width} ${font} ${weight}`,async({page,context,baseURL},info)=>{
 test.setTimeout(180000);const proof=await setup(page,context,baseURL!,width);await page.setViewportSize({width,height});
 await page.addInitScript(({font,weight})=>{localStorage.setItem('vic.prefSplit','1');for(const suffix of['','.studio']){localStorage.setItem('vic.calText'+suffix,'14');localStorage.setItem('vic.font'+suffix,font);localStorage.setItem('vic.calWeight'+suffix,String(weight));}},{font,weight});
 if(surface==='preview'){const m=JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR??'.next','server/server-reference-manifest.json'),'utf8')).node as Record<string,{exportedName?:string}>,ids=new Set(Object.entries(m).filter(([,v])=>v.exportedName==='getPublicPreviewAction').map(([id])=>id));await context.route('**/visual-fixture/studio?**',r=>{const q=r.request();if(q.method()!=='POST'||!ids.has(q.headers()['next-action']))return r.fallback();proof.syntheticReads.push('exact-public-preview-null-keeps-sanitized-fixture');return r.fulfill({contentType:'text/x-component',body:'0:{"a":"$@1","f":[],"b":"fixture"}\n1:null\n'});});}
 await page.goto(surface==='viewer'?'/visual-fixture/poster?y=2026&m=6&supportUX=preview-text':'/visual-fixture/studio?role=owner&viewer='+(surface==='preview'?1:0)+'&y=2026&m=6&supportUX=preview-text');await settlePanelLayout(page);await openSettings(page);await expect(page.locator('.rhh-text-stage')).toHaveAttribute('data-preview-measured','');
 const slider=page.getByRole('slider',{name:'달력 글씨 크기(px)',exact:true});const rows=[];let original:Awaited<ReturnType<typeof compare>>|null=null;
 for(const value of[12,14,20,20.5,24,30]){
  await slider.focus();await slider.press('Home');for(let i=12;i<value;i+=.5)await slider.press('ArrowRight');await expect(slider).toHaveValue(String(value));await page.evaluate(()=>document.fonts.ready);await settlePanelLayout(page);
  const row=await compare(page,surface);expect(row.found).toBe(true);expect(row.measured).toBe(true);if(!row.found||!row.actual||!row.preview)throw Error('actual source unavailable');
  expect(Math.abs(row.actual.font-row.preview.font),'same painted text size').toBeLessThan(.25);expect(row.preview.weight).toBe(row.actual.weight);expect(row.preview.family).toBe(row.actual.family);expect(row.preview.whiteSpace).toBe(row.actual.whiteSpace);expect(row.preview.wrap).toBe(row.actual.wrap);expect(row.preview.lines,'same fixed text wraps identically').toBe(row.actual.lines);
    expect(Math.abs(row.previewCard!.width-row.actualCard!.width),'same actual card width').toBeLessThan(.5);expect(Math.abs(row.previewCell!.width-row.actualCell!.width),'same actual date cell width').toBeLessThan(.5);
    expect(Math.abs(row.previewCard!.height-row.actualCard!.height),'same content has the same event height').toBeLessThan(.75);
  if(row.actual.line!==null&&row.preview.line!==null)expect(Math.abs(row.actual.line-row.preview.line)).toBeLessThan(.25);
  if(original?.slider&&row.slider)for(const key of['x','y','width','height']as const)expect(Math.abs(original.slider[key]-row.slider[key]),'stable slider '+key).toBeLessThan(.75);else original=row;
  rows.push({value,...row});if([14,20.5,30].includes(value))await info.attach('parity-'+value,{body:await page.screenshot(),contentType:'image/png'});
 }
 await page.keyboard.press('Escape');await settlePanelLayout(page);const host=page.locator(surface==='owner'?'.studio-shell':'.poster-page');await expect(host.locator('.agenda-title-text,.pill-main strong,.public-event .event-main p').filter({hasText:CALENDAR_PREVIEW_TITLE}).filter({visible:true}).first()).toBeVisible();
 await finish(page,info,proof,{surface,width,height,font,weight,rows,sameFixedSyntheticTitle:CALENDAR_PREVIEW_TITLE,metricSource:'actual visible page and independently read specimen',actualSourcePreservedAfterClose:true,geometryOrSourceMutation:false,fullCertification:false,physicalDevice:false});
});

for(const[surface,width,variant]of[['viewer',390,'title-only'],['owner',1920,'title-only'],['viewer',1440,'span-only'],['owner',390,'span-only']]as const)test(`Settings specimen ${variant} ${surface} ${width}`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);await page.setViewportSize({width,height:1000});await page.goto(surface==='viewer'?'/visual-fixture/poster?supportUX='+variant:'/visual-fixture/studio?role=owner&supportUX='+variant);await settlePanelLayout(page);await openSettings(page);await expect(page.locator('.rhh-text-stage')).toHaveAttribute('data-preview-has-card','true');await expect(page.locator('.rhh-text-stage')).toHaveAttribute('data-preview-has-sub','false');
 const slider=page.getByRole('slider',{name:'달력 글씨 크기(px)',exact:true});await slider.focus();await slider.press('End');await settlePanelLayout(page);const row=await compare(page,surface);expect(row.found).toBe(true);if(!row.actual||!row.preview)throw Error('no source');expect(Math.abs(row.actual.font-row.preview.font)).toBeLessThan(.25);expect(row.actual.lines).toBe(row.preview.lines);expect(Math.abs(row.actualCard!.width-row.previewCard!.width)).toBeLessThan(.5);await finish(page,info,proof,{surface,width,variant,row,actualNativeTitleOnlyOrSpanOnlyFixture:true,operatingWrites:0});
});

for(const[surface,width]of[['viewer',390],['owner',1920]]as const)test(`Settings specimen empty ${surface} ${width}`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);await page.goto(surface==='viewer'?'/visual-fixture/poster?monthLink=1&month=2026-04':'/visual-fixture/studio?role=owner&y=2026&m=4');await settlePanelLayout(page);await expect(page.locator('[data-act="month-title"]:visible').first()).toContainText(/0?4월/);await openSettings(page);await expect(page.locator('.rhh-text-stage')).toHaveAttribute('data-preview-has-card','false');await expect(page.locator('.rhh-text-stage')).toHaveAttribute('data-preview-measured','');await expect(page.locator('.pv-card')).toHaveCount(0);
 // Visibility starts before the real opening scale animation has finished.
 // Read final geometry only after that animation and its observer delivery.
 await settlePanelLayout(page);
 const facts=await page.evaluate(({surface})=>{const root=document.querySelector(surface==='owner'?'.studio-shell':'.poster-page')!,day=[...root.querySelectorAll<HTMLElement>('.agenda-day,.agenda-gap,.studio-day,.public-day')].find(e=>e.getBoundingClientRect().width>0)!,sample=document.querySelector('.pv-empty-preview')!;return{actualDay:day.getBoundingClientRect().toJSON(),specimen:sample.getBoundingClientRect().toJSON(),noFabricatedScheduleCard:document.querySelectorAll('.pv-card').length===0};},{surface});expect(Math.abs(facts.actualDay.width-facts.specimen.width)).toBeLessThan(.5);await finish(page,info,proof,{surface,width,emptyApril:true,...facts});
});

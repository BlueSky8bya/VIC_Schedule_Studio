import {test,expect,type Page,type ElementHandle} from '@playwright/test';
import {guardCompanionQa} from './helpers/companion-qa';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';

test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode()});

async function openBoard(page:Page,role:string,theme:string){
 await page.addInitScript(({theme})=>{localStorage.setItem('vic.settingsEpoch','2026-09-04');localStorage.setItem('vic.viewerCompanion',JSON.stringify({version:1,enabled:false}));for(const k of ['vic.ambient','vic.sound','vic.gfxPref'])localStorage.setItem(k,'off');localStorage.setItem('vic.dark',theme==='dark'?'on':'off');localStorage.setItem('vic.eyeComfort','on');}, {theme});
 await page.goto(`/visual-fixture/studio?viewer=1&role=${role}&y=2026&m=6`);await page.bringToFront();await page.locator('[data-act="open-drawing-board"]').click();await page.locator('.bp-draw-surface').waitFor();await settlePanelLayout(page);
 if(theme==='dark')await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 else await expect(page.locator('html')).not.toHaveAttribute('data-theme','dark');
}
const tool=(page:Page,name:string)=>page.getByRole('button',{name,exact:true});
const width=(page:Page,n:number)=>tool(page,`굵기 ${n}px`);
const row=(page:Page,id:string)=>page.locator(`.bp-layer-item[data-layer-id="${id}"]`);

async function stroke(page:Page,y:number){
 const b=await page.locator('.bp-draw-surface').boundingBox();if(!b)throw Error('draw surface missing');
 await page.mouse.move(b.x+120,b.y+y);await page.mouse.down();await page.mouse.move(b.x+320,b.y+y,{steps:24});await page.mouse.up();
 await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 return {x:b.x+220,y:b.y+y};
}
async function widthWitnessDot(page:Page,y:number){
 const b=(await page.locator('.bp-draw-surface').boundingBox())!,point={x:b.x+360,y:b.y+y};await page.mouse.click(point.x,point.y);await settlePanelLayout(page);return point;
}
async function inkThickness(page:Page,point:{x:number;y:number}){
 return page.locator('.bp-board').evaluate((board,p)=>{let count=0;for(let yy=Math.round(p.y)-20;yy<=Math.round(p.y)+20;yy++){let painted=false;for(const c of board.querySelectorAll('canvas')){const r=c.getBoundingClientRect();if(p.x<r.left||p.x>=r.right||yy<r.top||yy>=r.bottom)continue;const x=Math.floor((p.x-r.left)*c.width/r.width),y=Math.floor((yy-r.top)*c.height/r.height);if((c.getContext('2d')?.getImageData(x,y,1,1).data[3]??0)>32)painted=true;}if(painted)count++;}return count;},point);
}
async function nameContrast(page:Page,id:string){
 return row(page,id).locator('.bp-layer-meta em').evaluate(e=>{
  // Chromium can serialize color-mix as color(srgb ...), whose channels are
  // normalized rather than 0..255. Let its colour engine resolve each paint.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true})!;
  const rgba=(s:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=s;ctx.fillRect(0,0,1,1);const n=ctx.getImageData(0,0,1,1).data;return [n[0],n[1],n[2],n[3]/255];};
  const parents:Element[]=[];for(let p:Element|null=e;p;p=p.parentElement)parents.push(p);
  let bg=[255,255,255];for(const p of parents.reverse()){const c=rgba(getComputedStyle(p).backgroundColor);bg=bg.map((v,i)=>c[i]*c[3]+v*(1-c[3]));}
  const fg=rgba(getComputedStyle(e).color),lum=(c:number[])=>c.slice(0,3).map(v=>{const n=v/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
  const a=lum(fg),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
 });
}
for(const config of [{width:1440,theme:'light',role:'owner'},{width:1920,theme:'dark',role:'developer'}])for(const flow of ['widths','names'])test(`broadcast adopted ${flow} ${config.width} ${config.theme}`,async({page,context,baseURL},info)=>{
 await page.setViewportSize({width:config.width,height:1000});const proof=await guardCompanionQa(page,context,baseURL!);await openBoard(page,config.role,config.theme);const facts:unknown[]=[];
 const capture=async(name:string)=>{await settlePanelLayout(page);await info.attach(name,{body:await page.screenshot(),contentType:'image/png'});};
 if(flow==='widths'){
  await width(page,2).click();await expect(width(page,2)).toHaveAttribute('aria-pressed','true');await settlePanelLayout(page);const first=await stroke(page,140),firstDot=await widthWitnessDot(page,140);const before=await inkThickness(page,firstDot);expect(before).toBeGreaterThan(0);
  await tool(page,'지우개').click();await width(page,18).click();await tool(page,'형광펜').click();await width(page,8).click();await tool(page,'펜').click();await expect(width(page,2)).toHaveAttribute('aria-pressed','true');
  // Moving mouse strokes deliberately vary with speed-derived pressure.
  // Compare constant initial-contact dots, and retain the actual line samples.
  await settlePanelLayout(page);const second=await stroke(page,220),secondDot=await widthWitnessDot(page,220);const after=await inkThickness(page,secondDot);expect(Math.abs(after-before),JSON.stringify({before,after})).toBeLessThanOrEqual(1);facts.push({movingStrokePressureWidths:[await inkThickness(page,first),await inkThickness(page,second)],widthOracle:'same-initial-contact-pressure-dots'});await capture('pen-return-actual-strokes');
  await page.keyboard.press(']');await expect(width(page,3)).toHaveAttribute('aria-pressed','true');await page.keyboard.press('e');await expect(width(page,18)).toHaveAttribute('aria-pressed','true');await page.keyboard.press('[');await expect(width(page,12)).toHaveAttribute('aria-pressed','true');await page.keyboard.press('h');await expect(width(page,8)).toHaveAttribute('aria-pressed','true');await page.keyboard.press('p');await expect(width(page,3)).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('r');await expect(width(page,3)).toHaveAttribute('aria-pressed','true');await page.keyboard.press(']');await page.keyboard.press('p');await expect(width(page,5)).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('h');await settlePanelLayout(page);const highlighted=await stroke(page,300),highlighterThickness=await inkThickness(page,highlighted);expect(highlighterThickness).toBeGreaterThan(before*2);
  await page.keyboard.press('e');await expect(width(page,12)).toHaveAttribute('aria-pressed','true');await settlePanelLayout(page);await page.mouse.move(highlighted.x,highlighted.y-25);await page.mouse.down();await page.mouse.move(highlighted.x,highlighted.y+25,{steps:18});await page.mouse.up();await settlePanelLayout(page);expect(await inkThickness(page,highlighted)).toBe(0);expect(await inkThickness(page,{x:highlighted.x-80,y:highlighted.y})).toBeGreaterThan(0);
  const colorEntry=page.locator('[data-act="색 직접 고르기"]'),colorPicker=page.getByRole('dialog',{name:'색 고르기',exact:true});
  await colorEntry.click();await expect(colorEntry).toHaveAttribute('aria-expanded','true');await expect(colorPicker).toBeVisible();await page.keyboard.press('Escape');await expect(colorPicker).toHaveCount(0);await expect(page.getByRole('alertdialog')).toHaveCount(0);await expect(tool(page,'지우개')).toHaveAttribute('aria-pressed','true');
  await colorEntry.click();await expect(colorPicker).toBeVisible();await colorPicker.locator('input').fill('#f43f5e');await colorPicker.locator('input').press('Escape');await expect(colorPicker).toHaveCount(0);await expect(page.getByRole('alertdialog')).toHaveCount(0);await expect(colorEntry).toHaveAttribute('aria-expanded','false');await settlePanelLayout(page);await expect(tool(page,'지우개')).toHaveAttribute('aria-pressed','true');await expect(width(page,12)).toHaveAttribute('aria-pressed','true');await page.keyboard.press('p');await expect(width(page,5)).toHaveAttribute('aria-pressed','true');
  facts.push({beforeInkThickness:before,afterInkThickness:after,highlighterThickness,eraserRemovedCentrePreservedEdge:true,penFinal:5,eraserFinal:12,highlighterFinal:8,realMouseStrokes:true});await capture('widths-final');
 }else{
  await stroke(page,140);const initial=row(page,'layer-1'),canvas=await initial.locator('.bp-layer-thumb canvas').elementHandle() as ElementHandle<HTMLCanvasElement>|null;if(!canvas)throw Error('thumbnail missing');
  await expect.poll(()=>canvas.evaluate(c=>Array.from(c.getContext('2d')!.getImageData(0,0,c.width,c.height).data).some((v,i)=>i%4===3&&v>0))).toBe(true);
  const beforeHeight=(await initial.boundingBox())!.height,thumbnail=await canvas.evaluate(c=>c.toDataURL());await capture('layers-before');
  await initial.locator('.bp-layer-meta em').dblclick();const input=page.getByRole('textbox',{name:'레이어 이름',exact:true});await expect(input).toBeFocused();expect(Math.abs((await initial.boundingBox())!.height-beforeHeight)).toBeLessThanOrEqual(1);expect(await page.locator('button input').count()).toBe(0);
  await input.fill('밑그림');await capture('name-input-open');await input.press('Enter');await expect(initial.locator('.bp-layer-meta')).toHaveText('밑그림');await expect(initial.locator('.bp-layer-select')).toBeFocused();expect(await canvas.evaluate(c=>c.isConnected)).toBe(true);expect(await canvas.evaluate(c=>c.toDataURL())).toBe(thumbnail);
  await tool(page,'새 그림 레이어').click();const second=row(page,'layer-2');await second.locator('.bp-layer-select').focus();await page.keyboard.press('F2');await input.fill('취소할 이름');await input.press('Escape');await expect(second.locator('.bp-layer-meta')).toHaveText('2');await expect(page.getByRole('dialog',{name:'일정 그림판',exact:true})).toBeVisible();
  await second.locator('.bp-layer-select').focus();await page.keyboard.press('F2');await input.fill('조합중');await input.dispatchEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:229,bubbles:true});await expect(input).toBeVisible();await input.press('Escape');await expect(input).toHaveCount(0);await expect(second.locator('.bp-layer-select')).toBeFocused();
  await initial.locator('.bp-layer-select').focus();await page.keyboard.press('F2');await input.fill('메모');await second.locator('.bp-layer-select').click();await expect(initial.locator('.bp-layer-meta')).toHaveText('메모');await expect(second.locator('.bp-layer-select')).toHaveAttribute('aria-pressed','true');
  await page.keyboard.press('Control+z');await expect(initial.locator('.bp-layer-meta')).toHaveText('밑그림');await page.keyboard.press('Control+Shift+z');await expect(initial.locator('.bp-layer-meta')).toHaveText('메모');
  await initial.locator('.bp-layer-select').focus();await page.keyboard.press('F2');await input.fill('아주 긴 레이어 이름을 쓰더라도 줄은 하나로 유지');await input.press('Enter');await expect(initial.locator('.bp-layer-meta em')).toHaveCSS('text-overflow','ellipsis');expect(await initial.evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);const contrast=await nameContrast(page,'layer-1');expect(contrast).toBeGreaterThanOrEqual(4.5);await capture('long-name-collapsed');
  const name=await initial.locator('.bp-layer-meta').innerText();await initial.locator('.bp-layer-select').focus();await page.keyboard.press('F2');await input.fill('   ');await input.press('Enter');await expect(initial.locator('.bp-layer-meta')).toHaveText(name);
  await initial.getByRole('button',{name:`${name} 표시`,exact:true}).click();await expect(initial).toHaveClass(/off/);
  await page.keyboard.press('Control+z');await expect(initial.locator('.bp-layer-meta')).toHaveText('메모');await expect(initial).toHaveClass(/off/);
  await page.keyboard.press('Control+Shift+z');await expect(initial.locator('.bp-layer-meta')).toHaveText(name);await expect(initial).toHaveClass(/off/);
  await initial.getByRole('button',{name:`${name} 표시`,exact:true}).click();
  await second.locator('.bp-layer-select').focus();await page.keyboard.press('F2');await input.fill('강조');const grip=(await initial.locator('.bp-layer-grip').boundingBox())!,target=(await second.boundingBox())!;await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+grip.width/2,target.y+3,{steps:16});await page.mouse.up();await expect(second.locator('.bp-layer-meta')).toHaveText('강조');await expect(input).toHaveCount(0);await expect(page.locator('.bp-layer-item[data-layer-id]').first()).toHaveAttribute('data-layer-id','layer-1');
  await initial.locator('.bp-layer-select').focus();await page.keyboard.press('Alt+ArrowDown');await expect(page.locator('.bp-layer-item[data-layer-id]').first()).toHaveAttribute('data-layer-id','layer-2');await page.keyboard.press('Alt+ArrowUp');await expect(page.locator('.bp-layer-item[data-layer-id]').first()).toHaveAttribute('data-layer-id','layer-1');
  await initial.getByRole('button',{name:`${name} 삭제`,exact:true}).click();await expect(initial).toHaveCount(0);await page.keyboard.press('Control+z');await expect(initial.locator('.bp-layer-meta')).toHaveText(name);
  facts.push({beforeHeight,afterHeight:(await initial.boundingBox())!.height,nameContrastRatio:contrast,thumbnailRetained:true,enterEscapeBlurHistory:true,syntheticImeGuard:true,pointerDragDuringNameEdit:true,visibilityOrderDeletionUndo:true,longName:name,storedOutsidePanel:false});await capture('layers-after');
 }
 await Promise.all(proof.pending);expect(proof.errors).toEqual([]);expect(proof.rejected).toEqual([]);expect(proof.mutations).toEqual([]);expect(proof.liveReads).toEqual([]);expect(proof.chunks.length).toBeGreaterThan(0);expect(proof.chunks.every(c=>c.local===c.served)).toBe(true);
 await info.attach('observation',{body:JSON.stringify({config,flow,facts,proof:{...proof,pending:undefined},syntheticFixture:true,operatingWrites:0,realOsIme:false,fullCertification:false}),contentType:'application/json'});
});

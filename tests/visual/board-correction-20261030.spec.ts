import {test,expect} from '@playwright/test';
import {setup,finish} from './helpers/typography-harmony';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';

test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode(),actionTimeout:15000});
for(const [role,width] of [['owner',1440],['developer',1920]] as const)test(`correction Oct30 board ${role} ${width}`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);
 await page.goto(`/visual-fixture/studio?viewer=1&role=${role}&y=2026&m=6`);
 await page.locator('[data-act="open-drawing-board"]').click();
 const board=page.getByRole('dialog',{name:'일정 그림판',exact:true});await settlePanelLayout(page);
 const first=board.getByRole('checkbox',{name:/^6월 1일/}),second=board.getByRole('checkbox',{name:/^6월 2일/}),ninth=board.getByRole('checkbox',{name:/^6월 9일/});
 const selected=()=>board.locator('.bp-mini-cell[aria-checked="true"]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label')));
 await first.click();await board.locator('[data-act="bp-send"]').click();
 const card=board.locator('.bp-day-col');await expect(card).toHaveCount(1);
 await board.locator('[data-layer-id="__schedule__"] .bp-layer-select').click();await card.locator('.bp-day-head').click();await expect(card).toHaveClass(/\bsel\b/);
 const coordinates=()=>card.evaluate(e=>({left:(e as HTMLElement).style.left,top:(e as HTMLElement).style.top}));
 const original=await coordinates();
 // Actual pointer -> keyboard handoff: never force .focus() to mask a missing focus owner.
 await first.click();await expect(first).toBeFocused();await expect(first).toHaveAttribute('aria-checked','true');
 const before=await selected();await page.keyboard.press('ArrowRight');await expect(second).toBeFocused();expect(await selected()).toEqual(before);expect(await coordinates()).toEqual(original);
 const appearance=await second.evaluate(e=>({outline:getComputedStyle(e).outlineStyle,outlineOffset:getComputedStyle(e).outlineOffset,focusVisible:e.matches(':focus-visible')}));
 expect(appearance).toEqual({outline:'dashed',outlineOffset:'-4px',focusVisible:true});
 await info.attach('P-20261030-02-card-focus',{body:await page.screenshot(),contentType:'image/png'});
 await page.keyboard.press('Space');await expect(second).toHaveAttribute('aria-checked','true');await expect(first).toHaveAttribute('aria-checked','true');expect((await selected()).sort()).toEqual([...before,await second.getAttribute('aria-label')].sort());expect(await coordinates()).toEqual(original);
 await info.attach('P-20261030-02-card-space',{body:await page.screenshot(),contentType:'image/png'});
 await page.keyboard.press('Space');await expect(second).toHaveAttribute('aria-checked','false');expect(await selected()).toEqual(before);
 await page.keyboard.press('ArrowDown');await expect(ninth).toBeFocused();await page.keyboard.press('Enter');await expect(ninth).toHaveAttribute('aria-checked','true');expect((await selected()).sort()).toEqual([...before,await ninth.getAttribute('aria-label')].sort());
 expect(await coordinates()).toEqual(original);await board.getByRole('button',{name:'실행 취소',exact:true}).click();await expect(card).toHaveCount(0);
 await finish(page,info,proof,{proposalId:'P-20261030-02',role,width,forcedFocus:false,originalCardCoordinates:original,pointerThenArrowsSpace:true,arrowsDoNotSelect:true,spaceChangesOnlyFocusedDate:true,existingIntentionalSelectionRetained:true,oneUndoRemovesOriginalCard:true,appearance,actualAuthenticatedProduction:false});
});

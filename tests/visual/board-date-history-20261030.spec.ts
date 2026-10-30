import {test,expect} from '@playwright/test';
import {setup,finish} from './helpers/typography-harmony';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode(),actionTimeout:15000});
for(const [role,width]of [['owner',1440],['developer',1920]] as const)test(`date focus preserves card and undo ${role} ${width}`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);await page.goto(`/visual-fixture/studio?viewer=1&role=${role}&y=2026&m=6`);await page.locator('[data-act="open-drawing-board"]').click();const board=page.getByRole('dialog',{name:'일정 그림판',exact:true});await settlePanelLayout(page);
 const date=board.getByRole('checkbox',{name:/^6월 1일/});await date.focus();await page.keyboard.press('Space');await board.locator('[data-act="bp-send"]').click();const card=board.locator('.bp-day-col');await expect(card).toHaveCount(1);await board.locator('[data-layer-id="__schedule__"] .bp-layer-select').click();await card.locator('.bp-day-head').click();await expect(card).toHaveClass(/\bsel\b/);
 const before=await card.evaluate(e=>({left:(e as HTMLElement).style.left,top:(e as HTMLElement).style.top}));await date.focus();
 for(const key of ['ArrowRight','ArrowDown','Shift+ArrowRight','Shift+ArrowDown','Control+ArrowRight','Control+ArrowDown','Meta+ArrowRight','Meta+ArrowDown','Alt+ArrowRight','Alt+ArrowDown'])await page.keyboard.press(key);
 expect(await card.evaluate(e=>({left:(e as HTMLElement).style.left,top:(e as HTMLElement).style.top}))).toEqual(before);
 await board.getByRole('button',{name:'실행 취소',exact:true}).click();await expect(card).toHaveCount(0);
 await finish(page,info,proof,{proposalId:'P-20261030-02',role,width,coordinatesUnchanged:before,oneUndoRevertsOriginalSend:true,allArrowModifierCombinations:true});
});

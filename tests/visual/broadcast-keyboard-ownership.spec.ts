import {test,expect} from '@playwright/test';
import {setup,finish} from './helpers/typography-harmony';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode(),actionTimeout:15000});

for(const role of ['owner','developer'])for(const width of [1440,1920])test(`board owns calendar keys ${role} ${width}`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);
 await page.goto(`/visual-fixture/studio?viewer=1&role=${role}&y=2026&m=6`);await settlePanelLayout(page);
 const month=page.locator('.poster-chrome-title'),opener=page.locator('[data-act="open-drawing-board"]'),board=page.getByRole('dialog',{name:'일정 그림판',exact:true});
 const original=await month.textContent()??'';await opener.click();await expect(board).toBeVisible();await settlePanelLayout(page);
 const day=board.getByRole('checkbox',{name:/^6월 1일/});await day.focus();const focusBefore=await day.getAttribute('aria-label');
 for(const key of ['ArrowRight','ArrowLeft','t']){await page.keyboard.press(key);await settlePanelLayout(page);await expect(month).toHaveText(original);await expect(day).toBeFocused();await expect(board.locator('.bp-picker-toggle')).toHaveText('2026년 6월');}
 await info.attach('after-P-20261029-04',{body:await page.screenshot(),contentType:'image/png'});
 await board.getByRole('button',{name:'다음 달',exact:true}).click();await expect(board.locator('.bp-picker-toggle')).toHaveText('2026년 7월');await expect(month).toHaveText(original);await board.getByRole('button',{name:'이전 달',exact:true}).click();await expect(day).toBeVisible();
 await board.getByRole('button',{name:'일정 그림판 닫기',exact:true}).click();await expect(board).toHaveCount(0);await expect(opener).toBeFocused();await page.keyboard.press('ArrowRight');await expect(month).not.toHaveText(original);await page.keyboard.press('ArrowLeft');await expect(month).toHaveText(original);
 await opener.click();await expect(board).toBeVisible();await settlePanelLayout(page);await page.keyboard.press('e');await expect(board.getByRole('button',{name:'지우개',exact:true})).toHaveAttribute('aria-pressed','true');await page.keyboard.press('p');await expect(board.getByRole('button',{name:'펜',exact:true})).toHaveAttribute('aria-pressed','true');
 await day.focus();await page.keyboard.press('Space');await expect(day).toHaveAttribute('aria-checked','true');await board.locator('[data-act="bp-send"]').click();const card=board.locator('.bp-day-col').first();await expect(card).toBeVisible();await board.locator('[data-layer-id="__schedule__"] .bp-layer-select').click();await card.locator('.bp-day-head').click();await expect(card).toHaveClass(/\bsel\b/);const left=await card.evaluate(e=>parseFloat((e as HTMLElement).style.left));await page.keyboard.press('ArrowRight');await expect.poll(()=>card.evaluate(e=>parseFloat((e as HTMLElement).style.left))).toBe(left+1);await page.keyboard.press('Shift+ArrowRight');await expect.poll(()=>card.evaluate(e=>parseFloat((e as HTMLElement).style.left))).toBe(left+11);await expect(month).toHaveText(original);
 await info.attach('board-card-key-movement',{body:await page.screenshot(),contentType:'image/png'});
 await finish(page,info,proof,{proposalId:'P-20261029-04',role,width,backgroundAndBoardMonthStayedJune:true,focusBefore,calendarKeysRestoredAfterClose:true,explicitBoardMonthButtonsWork:true,toolShortcutsWork:true,cardNudgeLogicalPixels:[1,10],noOperatingWrites:true});
});
for(const width of [1440,1920])test(`standalone public calendar retains keys ${width}`,async({page,context,baseURL},info)=>{
 const proof=await setup(page,context,baseURL!,width);await page.goto('/visual-fixture/poster?y=2026&m=6&monthLink=1&month=2026-06&signedIn=0');await settlePanelLayout(page);const month=page.locator('.poster-chrome-title'),original=await month.textContent()??'';await page.locator('body').click({position:{x:5,y:500}});await page.keyboard.press('ArrowRight');await expect(month).not.toHaveText(original);await page.keyboard.press('ArrowLeft');await expect(month).toHaveText(original);await expect(page.locator('[data-act="open-drawing-board"]')).toHaveCount(0);await finish(page,info,proof,{proposalId:'P-20261029-04',surface:'standalone-public-anonymous',width,calendarKeysUnchanged:true,boardEntryAbsent:true});
});

import {test,expect} from '@playwright/test';
import {setup,finish} from './helpers/typography-harmony';
import {settlePanelLayout} from './helpers/panel-layout';
import {companionTraceMode} from './helpers/companion-evidence-policy';
test.use({serviceWorkers:'block',video:'on',trace:companionTraceMode(),actionTimeout:15000});
test('Adopted return preserves a different event manual position',async({page,context,baseURL},info)=>{
  const proof=await setup(page,context,baseURL!,1440);await page.goto('/visual-fixture/poster?y=2026&m=6');await settlePanelLayout(page);
  const ids=await page.locator('.public-event.is-clickable:visible').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.getAttribute('data-eventid')).filter(Boolean))]);expect(ids.length).toBeGreaterThanOrEqual(2);
  const panel=page.getByRole('dialog',{name:'일정 상세',exact:true}),grip=panel.getByRole('button',{name:'창 위치 복원',exact:true});
  const open=async(index:number)=>{await page.locator(`.public-event.is-clickable[data-eventid="${ids[index]}"]:visible`).first().click();await expect(panel).toBeVisible();await settlePanelLayout(page);};
  const saved=[];
  for(let i=0;i<2;i++){await open(i);const start=(await panel.boundingBox())!,h=(await grip.boundingBox())!,dx=start.x+start.width+130<1440?100:-100;await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+dx,h.y+h.height/2+35,{steps:15});await page.mouse.up();await settlePanelLayout(page);const moved=(await panel.boundingBox())!;expect(Math.abs(moved.x-start.x)).toBeGreaterThan(30);saved.push({start,moved});await page.keyboard.press('Escape');await expect(panel).not.toBeVisible();}
  await open(0);await grip.press('Enter');await settlePanelLayout(page);const reset=(await panel.boundingBox())!;expect(Math.abs(reset.x-saved[0].start.x)).toBeLessThan(3);expect(Math.abs(reset.y-saved[0].start.y)).toBeLessThan(3);await page.keyboard.press('Escape');
  await open(1);const other=(await panel.boundingBox())!;expect(Math.abs(other.x-saved[1].moved.x)).toBeLessThan(3);expect(Math.abs(other.y-saved[1].moved.y)).toBeLessThan(3);
  await finish(page,info,proof,{adoptedKey:'detail-position:explicit-return-to-anchor',twoDistinctEvents:true,currentWindowResetOnly:true,otherManualPositionPreserved:true,saved,reset,other,noSave:true});
});

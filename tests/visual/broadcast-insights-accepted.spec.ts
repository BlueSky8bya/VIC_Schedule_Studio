import { test, expect, type Page, type BrowserContext, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { guardCompanionQa } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";
import { companionTraceMode } from "./helpers/companion-evidence-policy";
import { darkInsightsResponses } from "./fixtures/dark-insights";
import { kstDay, kstYm } from "@/lib/insights/month-progress";

test.use({ viewport: { width: 1440, height: 1100 }, serviceWorkers: "block", video: "on", trace: companionTraceMode() });
test.setTimeout(45000);
const board = (page: Page) => page.locator(".broadcast-panel");
const ask = (page: Page) => page.getByRole("alertdialog", { name: "그림판 내용을 지우고 닫을까요?" });
const chart = (page: Page) => page.getByRole("slider", { name: "이 달 일별 방송 시간 조회 날짜" });
async function setup(page: Page, context: BrowserContext, base: string) {
  const proof = await guardCompanionQa(page, context, base);
  await page.addInitScript(() => {
    if (window.top !== window) return;
    localStorage.setItem("vic.settingsEpoch", "2026-09-04");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: false }));
    for (const key of ["vic.ambient", "vic.sound", "vic.gfxPref"]) localStorage.setItem(key, "off");
  });
  const policy = { ym: "2026-06", length: 30 };
  await context.route("**/api/public/*/broadcast?**", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base || request.method() !== "GET") return route.fallback();
    return route.fulfill({ json: { months: [{ ym: policy.ym, hours: 3.5, days: 1, sessions: 1 }], daily: Array.from({ length: policy.length }, (_, i) => i === 17 ? 3.5 : 0) } });
  });
  return { proof, policy };
}
async function finish(page: Page, info: TestInfo, proof: Awaited<ReturnType<typeof guardCompanionQa>>, facts: unknown) {
  await Promise.all(proof.pending);
  expect(proof.errors).toEqual([]); expect(proof.mutations).toEqual([]); expect(proof.rejected).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0); expect(proof.chunks.every(c => c.served === c.local)).toBe(true);
  await info.attach("actual-ui", { body: await page.screenshot(), contentType: "image/png" });
  await info.attach("observation", { body: JSON.stringify({ facts, proof: { ...proof, pending: undefined }, synthetic: true, fullCertification: false }), contentType: "application/json" });
}
async function openBoard(page: Page, role = "owner") {
  await page.goto(`/visual-fixture/studio?viewer=1&role=${role}&y=2026&m=6`);
  await settlePanelLayout(page);
  await page.locator('[data-act="open-drawing-board"]').click();
  await page.locator(".bp-draw-surface").waitFor(); await settlePanelLayout(page);
}
async function draw(page: Page, tool = "펜") {
  await page.getByRole("button", { name: tool, exact: true }).first().click();
  const b = (await page.locator(".bp-draw-surface").boundingBox())!;
  await page.mouse.move(b.x+b.width*.32, b.y+b.height*.45); await page.mouse.down();
  await page.mouse.move(b.x+b.width*.6,b.y+b.height*.5,{ steps: 22 }); await page.mouse.up();
}
const ink = (page: Page) => page.locator(".bp-board canvas").evaluateAll(nodes => nodes.reduce((count, el) => {
  const c=el as HTMLCanvasElement, p=c.getContext("2d")?.getImageData(0,0,c.width,c.height).data;
  if(p)for(let i=3;i<p.length;i+=4)if(p[i])count++;return count;
},0));

test("drawing empty tool layer and eraser-only boards close immediately", async ({page,context,baseURL},info) => {
  const s=await setup(page,context,baseURL!);await openBoard(page);
  await page.getByRole("button",{name:"새 그림 레이어",exact:true}).click();
  await draw(page,"지우개");await page.keyboard.press("Escape");
  await expect(board(page)).toHaveCount(0);await expect(ask(page)).toHaveCount(0);
  await page.locator('[data-act="open-drawing-board"]').click();await page.locator(".bp-draw-surface").waitFor();
  await page.getByRole("button",{name:"일정 그림판 닫기",exact:true}).click();await expect(board(page)).toHaveCount(0);
  await finish(page,info,s.proof,{emptyToolLayerEraserClose:true});
});
test("drawing cancel preserves ink focus and undo then confirmed close starts empty",async({page,context,baseURL},info)=>{
  const s=await setup(page,context,baseURL!);await openBoard(page);await draw(page);const pixels=await ink(page);expect(pixels).toBeGreaterThan(0);
  await page.getByRole("button",{name:"일정 그림판 닫기",exact:true}).click();await expect(ask(page)).toBeVisible();
  await expect(page.getByRole("button",{name:"계속 그리기",exact:true})).toBeFocused();
  await page.keyboard.press("Tab");await expect(page.getByRole("button",{name:"지우고 닫기",exact:true})).toBeFocused();
  await page.keyboard.press("Tab");await expect(page.getByRole("button",{name:"계속 그리기",exact:true})).toBeFocused();
  const toolBefore=await page.locator('.bp-tool[aria-pressed="true"]').getAttribute("aria-label");
  const widthBefore=await page.locator('.bp-width[aria-pressed="true"]').getAttribute("aria-label");
  for(const key of ["e","?", "]", "i", "Control+z"])await page.keyboard.press(key);
  const blockedPaste=await page.evaluate(()=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array([1,2,3])],"blocked.png",{type:"image/png"}));const event=new ClipboardEvent("paste",{clipboardData:d,bubbles:true,cancelable:true});const dispatched=document.dispatchEvent(event);return{dispatched,prevented:event.defaultPrevented};});
  expect(blockedPaste).toEqual({dispatched:false,prevented:true});
  await expect(ask(page)).toBeVisible();expect(await ink(page)).toBe(pixels);
  expect(await page.locator('.bp-tool[aria-pressed="true"]').getAttribute("aria-label")).toBe(toolBefore);
  expect(await page.locator('.bp-width[aria-pressed="true"]').getAttribute("aria-label")).toBe(widthBefore);
  await page.keyboard.press("Escape");await expect(ask(page)).toHaveCount(0);expect(await ink(page)).toBe(pixels);
  await expect(page.getByRole("button",{name:"일정 그림판 닫기",exact:true})).toBeFocused();
  await page.keyboard.press("Control+z");await expect.poll(()=>ink(page)).toBe(0);
  await page.keyboard.press("Escape");await expect(ask(page)).toBeVisible();
  await page.getByRole("button",{name:"계속 그리기",exact:true}).click();await page.keyboard.press("Control+y");await expect.poll(()=>ink(page)).toBe(pixels);
  await page.keyboard.press("Escape");await expect(ask(page)).toBeVisible();await page.keyboard.press("Tab");await page.keyboard.press("Enter");await expect(board(page)).toHaveCount(0);
  await page.locator('[data-act="open-drawing-board"]').click();await page.locator(".bp-draw-surface").waitFor();expect(await ink(page)).toBe(0);await page.keyboard.press("Control+z");expect(await ink(page)).toBe(0);
  await finish(page,info,s.proof,{pixels,cancelPreservedInkAndFocus:true,redoProtected:true,confirmedReopenEmpty:true});
});
test("drawing developer back cancellation restores only its overlay entry",async({page,context,baseURL},info)=>{
  const s=await setup(page,context,baseURL!);await openBoard(page,"developer");await draw(page);
  for(let i=0;i<2;i++){
    await page.goBack();await expect(ask(page)).toBeVisible();
    await page.goBack();await expect(ask(page)).toHaveCount(0);await expect(board(page)).toBeVisible();
    expect(await board(page).evaluate(el=>el.contains(document.activeElement))).toBe(true);
  }
  await page.goBack();await expect(ask(page)).toBeVisible();await page.getByRole("button",{name:"지우고 닫기",exact:true}).click();await expect(board(page)).toHaveCount(0);
  await expect(page.locator('[data-act="open-drawing-board"]')).toBeVisible();
  await page.locator('[data-act="open-drawing-board"]').click();await page.locator(".bp-draw-surface").waitFor();await page.keyboard.press("Escape");await expect(board(page)).toHaveCount(0);
  await page.goBack();await expect(page.locator('[data-act="open-drawing-board"]')).toHaveCount(0);
  await finish(page,info,s.proof,{repeatedBackKeep:true,confirmedCloseRetainsPreview:true,nextEmptyCloseAndPreviewBack:true});
});
test("drawing selection Escape and color portal keep their close priorities",async({page,context,baseURL},info)=>{
  const s=await setup(page,context,baseURL!);await openBoard(page);await draw(page);
  await page.getByRole("button",{name:"선택",exact:true}).first().click();
  const b=(await page.locator(".bp-draw-surface").boundingBox())!;
  await page.mouse.move(b.x+b.width*.28,b.y+b.height*.4);await page.mouse.down();await page.mouse.move(b.x+b.width*.65,b.y+b.height*.55,{steps:20});await page.mouse.up();
  await expect(page.getByRole("group",{name:/선택된 필기/})).toBeVisible();
  await page.keyboard.press("Escape");await expect(page.getByRole("group",{name:/선택된 필기/})).toHaveCount(0);await expect(ask(page)).toHaveCount(0);
  await page.keyboard.press("Escape");await expect(ask(page)).toBeVisible();await page.keyboard.press("Escape");
  expect(await board(page).evaluate(el=>el.contains(document.activeElement))).toBe(true);
  const picker=page.locator(".bp-current-color"),color=await picker.getAttribute("aria-label");
  await picker.click();await expect(picker).toHaveAttribute("aria-expanded","true");
  await page.goBack();await expect(ask(page)).toBeVisible();await expect(picker).toHaveAttribute("aria-expanded","false");
  await page.keyboard.press("Escape");await expect(ask(page)).toHaveCount(0);await expect(picker).toHaveAttribute("aria-label",color!);
  expect(await board(page).evaluate(el=>el.contains(document.activeElement))).toBe(true);
  await finish(page,info,s.proof,{nativeSelectionEscapePriority:true,colorPortalDismissedBeforeConfirm:true,colorContextPreserved:true,cancelFocusInside:true});
});
test("drawing sent card selection clears before close and removed card history stays protected",async({page,context,baseURL},info)=>{
  const s=await setup(page,context,baseURL!);await openBoard(page);
  await page.getByRole("checkbox",{name:/^6월 1일(?:,| \(|$)/}).first().click();await page.locator('[data-act="bp-send"]').click();
  await expect(page.getByRole("button",{name:"6월 1일 그림판에서 빼기",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"6월 1일 그림판에서 빼기",exact:true}).click();
  await page.keyboard.press("Escape");if(!await ask(page).count())await page.keyboard.press("Escape");await expect(ask(page)).toBeVisible();
  await page.getByRole("button",{name:"계속 그리기",exact:true}).click();await page.keyboard.press("Control+z");await expect(page.getByRole("button",{name:"6월 1일 그림판에서 빼기",exact:true})).toBeVisible();
  await finish(page,info,s.proof,{removedCardRecoverable:true});
});
test("drawing hidden ink and full-clear history boundaries remain intact",async({page,context,baseURL},info)=>{
  const s=await setup(page,context,baseURL!);await openBoard(page);await draw(page);
  await page.getByRole("button",{name:"레이어 1 표시",exact:true}).click();
  await page.getByRole("button",{name:"일정 그림판 닫기",exact:true}).click();await expect(ask(page)).toBeVisible();
  await page.getByRole("button",{name:"계속 그리기",exact:true}).click();
  await page.getByRole("button",{name:"전체 지우기",exact:true}).click();await page.getByRole("button",{name:"한 번 더 누르면 전체 지우기",exact:true}).click();
  await page.keyboard.press("Escape");await expect(board(page)).toHaveCount(0);
  await finish(page,info,s.proof,{hiddenInkProtected:true,existingClearAllClearsHistory:true});
});
test("drawing controlled image drop is protected by native close and cancel",async({page,context,baseURL},info)=>{
  const s=await setup(page,context,baseURL!);await openBoard(page);
  // File transfer is a controlled DOM drop input, not an OS clipboard/device claim.
  const transfer=await page.evaluateHandle(async()=>{const d=new DataTransfer(),c=document.createElement("canvas");c.width=c.height=32;c.getContext("2d")!.fillRect(0,0,32,32);const blob=await new Promise<Blob>(resolve=>c.toBlob(b=>resolve(b!)));d.items.add(new File([blob],"synthetic.png",{type:"image/png"}));return d;});
  const at=(await page.locator(".bp-draw-surface").boundingBox())!;
  await page.locator(".bp-board-inner").dispatchEvent("drop",{dataTransfer:transfer,clientX:at.x+at.width*.4,clientY:at.y+at.height*.4});await expect.poll(()=>ink(page)).toBeGreaterThan(0);
  await page.getByRole("button",{name:"일정 그림판 닫기",exact:true}).click();await expect(ask(page)).toBeVisible();await page.getByRole("button",{name:"계속 그리기",exact:true}).click();expect(await ink(page)).toBeGreaterThan(0);
  await finish(page,info,s.proof,{controlledFileDrop:true,nativeCloseAndCancel:true});
});
async function publicChart(page:Page,s:Awaited<ReturnType<typeof setup>>,ym="2026-06",length=30){s.policy.ym=ym;s.policy.length=length;await page.goto(`/visual-fixture/poster?monthLink=1&month=${ym}`);await settlePanelLayout(page);await page.getByRole("button",{name:/^(?:이 달 )?기록$/}).first().click();await expect(chart(page)).toBeVisible();}
async function inspectKeys(page:Page,length:number){const c=chart(page);await c.focus();await expect(c).toHaveAttribute("aria-valuenow","1");await page.keyboard.press("End");await expect(c).toHaveAttribute("aria-valuenow",String(length));await page.keyboard.press("ArrowRight");await expect(c).toHaveAttribute("aria-valuenow",String(length));await page.keyboard.press("Home");await page.keyboard.press("ArrowLeft");await expect(c).toHaveAttribute("aria-valuenow","1");for(let i=0;i<17;i++)await page.keyboard.press("ArrowRight");await expect(c).toHaveAttribute("aria-valuenow","18");await expect(page.locator(".bcast-tip")).toHaveText("18일 · 3시간 30분");}
for(const [ym,length] of [["2026-02",28],["2024-02",29],["2026-04",30],["2026-07",31]] as const){
  test(`shared public chart keyboard inspects ${ym} ${length} days without moving calendar`,async({page,context,baseURL},info)=>{
    const s=await setup(page,context,baseURL!);await publicChart(page,s,ym,length);const url=page.url();await inspectKeys(page,length);expect(page.url()).toBe(url);
    const c=chart(page);await page.mouse.move(1,1);await expect(page.locator(".bcast-tip")).toBeVisible();await expect(c).toBeFocused();await page.keyboard.press("Tab");await expect(c).not.toBeFocused();await page.keyboard.press("Shift+Tab");await expect(c).toBeFocused();
    const before=await c.getAttribute("aria-valuenow");await page.keyboard.press("Control+ArrowRight");await expect(c).toHaveAttribute("aria-valuenow",before!);
    await finish(page,info,s.proof,{ym,length,oneTabStop:true,keyboardBoundsAndPointerLeave:true,calendarUnchanged:true});
  });
}
test("studio preview public chart shares keyboard inspection",async({page,context,baseURL},info)=>{
  const s=await setup(page,context,baseURL!);await page.goto("/visual-fixture/studio?role=developer&viewer=1&y=2026&m=6");await settlePanelLayout(page);await page.getByRole("button",{name:"기록",exact:true}).first().click();await expect(chart(page)).toBeVisible();await inspectKeys(page,30);
  await finish(page,info,s.proof,{surface:"studio-public-preview",sharedChartNativeKeys:true});
});
test("shared public chart preserves pointer hover and labels future and missing days honestly",async({page,context,baseURL},info)=>{
  const s=await setup(page,context,baseURL!);await publicChart(page,s);await page.locator(".bcast-dcol").nth(17).hover();await expect(page.locator(".bcast-tip")).toHaveText("18일 · 3시간 30분");await page.mouse.move(1,1);await expect(page.locator(".bcast-tip")).toHaveCount(0);
  const nowYm=kstYm();await publicChart(page,s,nowYm,31);await chart(page).focus();await page.keyboard.press("End");if(Number(kstDay().slice(-2))<31)await expect(chart(page)).toHaveAttribute("aria-valuetext",/아직 오지 않은 날/);
  await publicChart(page,s,"2099-01",31);await chart(page).focus();await expect(chart(page)).toHaveAttribute("aria-valuetext",/아직 오지 않은 날/);
  s.policy.length=0;await page.reload();await settlePanelLayout(page);if(!await page.locator(".pi-sheet").count())await page.getByRole("button",{name:"기록",exact:true}).first().click();await expect(page.locator(".bcast-daily")).toBeVisible();await expect(chart(page)).toHaveCount(0);await expect(page.locator(".bcast-daily")).not.toHaveAttribute("tabindex");
  await finish(page,info,s.proof,{pointerHoverAndLeave:true,futureLabels:true,missingDailyNoInventedDay:true});
});
for(const role of ["owner","developer"]){test(`shared ${role} insights chart keyboard keeps trend tab and shared values`,async({page,context,baseURL},info)=>{
  const s=await setup(page,context,baseURL!);
  const manifest=JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR??".next","server/server-reference-manifest.json"),"utf8")).node as Record<string,{exportedName?:string}>;
  const baseline=darkInsightsResponses.getInsightsAction.data,trend={...darkInsightsResponses.getTrendAction.data,months:["2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"],broadcastDaily:Array.from({length:30},(_,i)=>i===17?3.5:0)};
  const responses:Record<string,unknown>={...darkInsightsResponses,getOwnerSecurityAction:{ok:false,error:"Synthetic scope excludes security data"},getTrendAction:{ok:true,data:trend},getMemberInsightsAction:{ok:true,data:{month:{year:2026,month:6},content:{...baseline.content,tags:[]},engagement:{...baseline.engagement,topTitles:[]},trend:{...trend,hearts:[1,2,3,4,5,6]},highlight:{peakDay:null,peakHour:null,topTitle:null,busiestWeekday:null}}}};
  const reads:string[]=[];
  await context.route("**/visual-fixture/studio?**",async route=>{const req=route.request(),url=new URL(req.url()),name=manifest[req.headers()["next-action"]]?.exportedName;if(url.origin!==baseURL||req.method()!=="POST"||!name||!(name in responses))return route.fallback();reads.push(name);return route.fulfill({contentType:"text/x-component",body:`0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(responses[name])}\n`});});
  await page.goto(`/visual-fixture/studio?role=${role}&y=2026&m=6`);await settlePanelLayout(page);const open=page.locator('[data-act="manage-insights"]');if(!await open.isVisible())await page.locator('[data-act="panel-toggle"]').click();await open.click();await expect(chart(page)).toBeVisible();await inspectKeys(page,30);await expect(page.locator('.insights-tab[aria-selected="true"]')).toContainText("트렌드");
  await finish(page,info,s.proof,{role,syntheticReadActions:reads,sharedChartNativeKeys:true,trendTabPreserved:true});
});}
test.describe("touch",()=>{test.use({viewport:{width:390,height:844},hasTouch:true});test("shared daily chart touch timer cannot erase keyboard inspection",async({page,context,baseURL},info)=>{
  const s=await setup(page,context,baseURL!);await publicChart(page,s);await page.locator(".bcast-dcol").nth(17).tap();await expect(page.locator(".bcast-tip")).toHaveText("18일 · 3시간 30분");await chart(page).focus();await page.keyboard.press("Home");await page.keyboard.press("ArrowRight");await page.waitForTimeout(2300);await expect(page.locator(".bcast-tip")).toHaveText("2일 · 0분");await expect(chart(page)).toHaveAttribute("aria-valuenow","2");await finish(page,info,s.proof,{nativeTouch:true,timerWaitMs:2300,keyboardOwnsTooltip:true,physicalDevice:false});
});});

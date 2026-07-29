// P1-FLOW-1 검증: 모바일 시트에서 공개범위·옵션 카드가 접혀 있고, 탭하면 펼쳐지는지.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const shot = (n) => `${process.env.SHOT_DIR ?? "."}/${n}.png`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
page.on("console", (m) => { if (m.type() === "error") console.log("[console]", m.text()); });

await page.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
// 모바일 스튜디오 = 아젠다 레이아웃(month grid 없음). '일정 추가' 버튼으로 시트 오픈.
await page.waitForSelector(".m-add-event", { timeout: 15000 });
await page.locator(".m-add-event").first().tap();
await page.waitForSelector(".m-edit-sheet", { timeout: 8000 });
await page.waitForTimeout(400);

const foldHead = page.locator(".me-fold-head");
const headCount = await foldHead.count();
const bodyVisibleBefore = await page.locator(".me-fold-body").count();
const summary = headCount ? await page.locator(".me-fold-summary").innerText() : "(없음)";
console.log(`fold 헤더: ${headCount}개 · 접힘 시 body: ${bodyVisibleBefore}개(0 기대) · 요약: "${summary}"`);
await page.screenshot({ path: shot("qa1-collapsed") });

// 펼치기
await foldHead.first().tap();
await page.waitForTimeout(350);
const bodyAfter = await page.locator(".me-fold-body").count();
const scopeSeg = await page.locator(".me-fold-body .me-seg").count();
console.log(`펼침 후 body: ${bodyAfter}개(1 기대) · scope seg: ${scopeSeg}개(1 기대)`);
await page.screenshot({ path: shot("qa2-expanded") });

// 다시 접기 + 태그/저장 여전히 보이는지
await foldHead.first().tap();
await page.waitForTimeout(350);
const tagGroup = await page.locator(".me-tag-group").isVisible();
const saveBtn = await page.locator(".m-save").isVisible();
console.log(`재접힘 body: ${await page.locator(".me-fold-body").count()}개(0 기대) · 태그 카드: ${tagGroup} · 저장 바: ${saveBtn}`);

// 데스크톱 회귀: fold-field 그대로인지
const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desk.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
await desk.waitForSelector(".studio-month-grid", { timeout: 15000 });
await desk.locator('.studio-month-grid [data-isodate]').filter({ hasNot: desk.locator(".studio-event") }).first().click();
await desk.waitForSelector(".event-editor-panel form", { timeout: 8000 });
const deskFold = await desk.locator(".fold-field .fold-head").count();
console.log(`데스크톱 fold-head: ${deskFold}개(1 기대)`);
await desk.screenshot({ path: shot("qa3-desktop") });

await browser.close();

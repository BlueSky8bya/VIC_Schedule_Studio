// P1-STICKER-0 + P1-TITLE-1 검증.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const shot = (n) => `${process.env.SHOT_DIR ?? "."}/${n}.png`;
const browser = await chromium.launch();

// TITLE-1 데스크톱: 편집 패널 helper + 긴 제목 카운터
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
  await page.waitForSelector(".studio-month-grid", { timeout: 15000 });
  await page.locator('.studio-month-grid [data-isodate]').filter({ hasNot: page.locator(".studio-event-pill") }).first().click();
  await page.waitForSelector(".event-editor-panel form", { timeout: 8000 });
  const helper = await page.locator(".event-editor-panel .title-helper").innerText();
  console.log(`데스크톱 helper: "${helper.replace(/\n/g, " / ")}"`);
  await page.locator(".event-editor-panel textarea").first().fill("아주아주아주아주 긴 제목 스물두자까지 가보자");
  await page.waitForTimeout(200);
  const helper2 = await page.locator(".event-editor-panel .title-helper").innerText();
  const warn = await page.locator(".title-helper em.warn").count();
  console.log(`긴 제목 후: "${helper2.replace(/\n/g, " / ")}" · warn=${warn}(1 기대)`);
  await page.screenshot({ path: shot("title-helper-desktop"), clip: { x: 1000, y: 80, width: 440, height: 400 } });
  await page.close();
}

// TITLE-1 모바일: 시트에도 helper
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
  await page.waitForSelector(".m-add-event", { timeout: 15000 });
  await page.locator(".m-add-event").first().tap();
  await page.waitForSelector(".m-edit-sheet", { timeout: 8000 });
  const c = await page.locator(".m-edit-sheet .title-helper").count();
  console.log(`모바일 시트 helper: ${c}개(1 기대)`);
  await page.close();
}

// STICKER-0: 꾸미기에서 Tab으로 스티커 포커스→선택→화살표 이동
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/visual-fixture/poster?mode=decorate`, { waitUntil: "networkidle" });
  await page.waitForSelector(".sticker-layer.editable", { timeout: 15000 });
  const items = await page.locator(".sticker-item").count();
  if (items === 0) {
    console.log("스티커 0개 — fixture에 스티커 없음, 포커스 선택만 스킵");
  } else {
    await page.locator(".sticker-item").first().focus();
    await page.waitForTimeout(200);
    const selected = await page.locator(".sticker-item.selected").count();
    const before = await page.locator(".sticker-item").first().evaluate((el) => el.style.left);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(200);
    const after = await page.locator(".sticker-item").first().evaluate((el) => el.style.left);
    console.log(`스티커 ${items}개 · 포커스 후 선택=${selected}(≥1 기대) · 좌표 ${before} → ${after} (변화 기대)`);
  }
  await page.close();
}

await browser.close();

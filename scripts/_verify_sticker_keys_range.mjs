// P2-STICKER-1(키보드 크기/회전) + 범위선택 복원 검증.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();

// 1) 꾸미기: 스티커 선택 → +/-/[/] 로 크기·회전 변경
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/visual-fixture/poster?mode=decorate`, { waitUntil: "networkidle" });
  await page.waitForSelector(".sticker-layer.editable .sticker-item", { timeout: 15000 });
  const item = page.locator(".sticker-item").first();
  await item.focus();
  await page.waitForTimeout(200);
  const before = await item.evaluate((el) => ({ w: el.style.fontSize, t: el.style.transform }));
  await page.keyboard.press("+");
  await page.keyboard.press("]");
  await page.waitForTimeout(300);
  const after = await item.evaluate((el) => ({ w: el.style.fontSize, t: el.style.transform }));
  console.log(`크기: ${before.w} -> ${after.w} (증가 기대)`);
  console.log(`회전: ${(before.t.match(/rotate\([^)]+\)/) ?? [])[0]} -> ${(after.t.match(/rotate\([^)]+\)/) ?? [])[0]} (+5deg 기대)`);
  await page.close();
}

// 2) 편집실 달력: 드래그 범위선택 보라 강조 복원
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
  await page.waitForSelector(".studio-month-grid", { timeout: 15000 });
  const box = await page.locator(".studio-month-grid").boundingBox();
  await page.mouse.move(box.x + 60, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + 320, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  console.log(`편집실 범위 강조 칸: ${await page.locator(".studio-day.cell-range-selected").count()}개 (>0 기대)`);
  await page.close();
}

// 3) 시청자 포스터(데스크톱 표면): 같은 드래그 강조
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/visual-fixture/poster`, { waitUntil: "networkidle" });
  await page.waitForSelector(".public-month-grid", { timeout: 15000 });
  const box = await page.locator(".public-month-grid").boundingBox();
  await page.mouse.move(box.x + 60, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + 320, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  console.log(`시청자 범위 강조 칸: ${await page.locator(".public-day.cell-range-selected").count()}개 (>0 기대)`);
  await page.close();
}

await browser.close();

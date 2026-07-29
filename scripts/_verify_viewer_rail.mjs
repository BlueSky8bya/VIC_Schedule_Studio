// P1-VIEWER-1 검증: 태그 0개 달에서도 모바일 레일('이 달 기록' 진입)이 남는지.
// + P1-MULTI-0: 데스크톱 달력 드래그로 범위 강조가 더는 안 생기는지.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();

// 모바일 시청자 — 6월(태그 있음) / 다음 달로 넘겨 태그 없는 달에서 레일 확인
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await page.goto(`${BASE}/visual-fixture/poster`, { waitUntil: "networkidle" });
await page.waitForSelector(".agenda", { timeout: 15000 });
const check = async (label) => {
  const rail = await page.locator(".agenda-legend-rail").count();
  const legend = await page.locator(".agenda-legend").count();
  const insights = await page.locator(".agenda-legend-insights").count();
  console.log(`${label}: 레일=${rail} · 태그박스=${legend} · 이달기록=${insights}`);
};
await check("6월(태그 있는 달)");
// 다음 달 두 번 이동(태그·일정 없는 달 찾기)
for (let i = 0; i < 2; i++) {
  await page.locator(".agenda-monthbar .mb-step").last().tap();
  await page.waitForTimeout(500);
}
const month = await page.locator(".agenda-monthbar").innerText();
await check(`이동 후(${month.replace(/\s+/g, " ").trim()})`);

// 데스크톱 — 달력 위 드래그해도 cell-range-selected 안 생김
const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await desk.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
await desk.waitForSelector(".studio-month-grid", { timeout: 15000 });
const grid = desk.locator(".studio-month-grid");
const box = await grid.boundingBox();
await desk.mouse.move(box.x + 50, box.y + 80);
await desk.mouse.down();
await desk.mouse.move(box.x + 400, box.y + 300, { steps: 10 });
await desk.mouse.up();
await desk.waitForTimeout(200);
const sel = await desk.locator(".cell-range-selected").count();
console.log(`드래그 후 범위 강조 칸: ${sel}개 (0 기대)`);

await browser.close();

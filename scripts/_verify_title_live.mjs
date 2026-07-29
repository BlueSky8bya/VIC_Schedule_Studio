// P1-TITLE-1 라이브 미러 검증: 첫 줄/나머지 색 분리 렌더 + 커서 정렬(미러-텍스트영역 좌표 일치).
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const shot = (n) => `${process.env.SHOT_DIR ?? "."}/${n}.png`;
const browser = await chromium.launch();

// 데스크톱
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
  await page.waitForSelector(".studio-month-grid", { timeout: 15000 });
  await page.locator('.studio-month-grid [data-isodate]').filter({ hasNot: page.locator(".studio-event-pill") }).first().click();
  await page.waitForSelector(".event-editor-panel .title-live-web", { timeout: 8000 });
  await page.locator(".event-editor-panel .title-live-web textarea").fill("풀트뱅 정기 방송\n10시 시작\n시참은 디코로");
  await page.waitForTimeout(200);
  const first = await page.locator(".title-live-web .tt-first").innerText();
  const firstColor = await page.locator(".title-live-web .tt-first").evaluate((el) => getComputedStyle(el).color);
  const restColor = await page.locator(".title-live-web .tt-rest").evaluate((el) => getComputedStyle(el).color);
  // 치수 일치: 미러와 textarea의 박스·패딩 비교
  const geom = await page.evaluate(() => {
    const wrap = document.querySelector(".title-live-web");
    const m = wrap.querySelector(".title-live-mirror").getBoundingClientRect();
    const t = wrap.querySelector("textarea").getBoundingClientRect();
    return { dx: Math.abs(m.x - t.x), dy: Math.abs(m.y - t.y), dw: Math.abs(m.width - t.width) };
  });
  console.log(`웹: 첫 줄="${first}" · 첫줄색=${firstColor} · 나머지색=${restColor} (달라야 함)`);
  console.log(`웹 미러-입력 박스 오차: dx=${geom.dx} dy=${geom.dy} dw=${geom.dw} (전부 0 기대)`);
  await page.screenshot({ path: shot("title-live-web"), clip: { x: 1000, y: 80, width: 440, height: 420 } });
  await page.close();
}

// 모바일 시트
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
  await page.waitForSelector(".m-add-event", { timeout: 15000 });
  await page.locator(".m-add-event").first().tap();
  await page.waitForSelector(".m-edit-sheet .title-live-m", { timeout: 8000 });
  await page.locator(".m-edit-sheet .me-title").fill("합방 스페셜\n게스트 공개는 저녁에");
  await page.waitForTimeout(300);
  const colors = await page.evaluate(() => {
    const f = document.querySelector(".title-live-m .tt-first");
    const r = document.querySelector(".title-live-m .tt-rest");
    return { f: f && getComputedStyle(f).color, r: r && getComputedStyle(r).color };
  });
  console.log(`모바일: 첫줄색=${colors.f} · 나머지색=${colors.r} (달라야 함)`);
  await page.screenshot({ path: shot("title-live-m") });
  await page.close();
}

await browser.close();

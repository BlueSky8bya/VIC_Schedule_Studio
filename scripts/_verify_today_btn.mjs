// 모바일 편집실 '오늘' 버튼 검증: 레일에 표시(역할별) + 다른 달에서 누르면 오늘 달로 복귀.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const shot = (n) => `${process.env.SHOT_DIR ?? "."}/${n}.png`;
const browser = await chromium.launch();

for (const role of ["", "?role=manager", "?role=worker"]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await page.goto(`${BASE}/visual-fixture/studio${role}`, { waitUntil: "networkidle" });
  await page.waitForSelector(".m-actionrail", { timeout: 15000 });
  const todayBtn = page.locator(".m-io-today");
  const rail = await page.locator(".m-actionrail > *").allInnerTexts();
  console.log(`[${role || "dev"}] 오늘 버튼: ${await todayBtn.count()}개 · 레일: ${rail.map((t) => t.replace(/\n/g, "")).join(" | ")}`);
  if (!role) {
    // 다른 달로 두 번 이동 후 '오늘' → 오늘 달 복귀 확인
    const monthLabel = () => page.locator(".m-month-nav strong").innerText();
    const start = await monthLabel();
    await page.locator(".m-month-btn").first().tap();
    await page.waitForTimeout(450);
    await page.locator(".m-month-btn").first().tap();
    await page.waitForTimeout(450);
    const moved = await monthLabel();
    await todayBtn.tap();
    await page.waitForTimeout(900);
    const back = await monthLabel();
    console.log(`월 복귀: ${start} → ${moved} → (오늘) → ${back} (시작=복귀 기대... 단 fixture 오늘이 표시 달과 다르면 오늘 달)`);
    await page.screenshot({ path: shot("today-rail") });
  }
  await page.close();
}
await browser.close();

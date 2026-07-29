// P1-IPAD-1 검증: 768×1024(아이패드 세로)=아젠다 토폴로지, 1024×768(가로)=데스크톱 2패널 유지,
// 390(폰)·1440(데스크톱) 회귀 없음. 시트/레일 등 핵심 요소 존재 확인 + 스크린샷.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const shot = (n) => `${process.env.SHOT_DIR ?? "."}/${n}.png`;
const browser = await chromium.launch();

const cases = [
  { name: "ipad-portrait-768", w: 768, h: 1024, touch: true, expect: "agenda" },
  { name: "ipad-landscape-1024", w: 1024, h: 768, touch: true, expect: "desktop" },
  { name: "phone-390", w: 390, h: 844, touch: true, expect: "agenda" },
  { name: "desktop-1440", w: 1440, h: 900, touch: false, expect: "desktop" }
];

for (const c of cases) {
  const page = await browser.newPage({
    viewport: { width: c.w, height: c.h },
    hasTouch: c.touch
  });
  await page.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const agenda = await page.locator(".studio-mobile").count();
  const grid = await page.locator(".studio-month-grid").count();
  const got = agenda ? "agenda" : grid ? "desktop" : "???";
  console.log(`${c.name}: ${got} (기대 ${c.expect}) ${got === c.expect ? "PASS" : "FAIL"}`);
  await page.screenshot({ path: shot(`ipad-${c.name}`), fullPage: false });
  // 아이패드 세로: 편집 시트 열어 접힘 카드·저장바 확인
  if (c.name === "ipad-portrait-768" && agenda) {
    await page.locator(".m-add-event").first().tap();
    await page.waitForTimeout(500);
    const sheet = await page.locator(".m-edit-sheet").count();
    const fold = await page.locator(".me-fold-head").count();
    console.log(`  시트: ${sheet} · 접힘 카드: ${fold} (각 1 기대)`);
    await page.screenshot({ path: shot("ipad-portrait-sheet") });
  }
  await page.close();
}
await browser.close();

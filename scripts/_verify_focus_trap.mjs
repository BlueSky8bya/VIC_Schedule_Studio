// P1-DIALOG-1 검증: 모달 열면 포커스가 카드 안으로, Tab 20번 눌러도 카드 밖으로 안 나감,
// Shift+Tab 역순환, Esc 닫으면 열기 전 버튼으로 복원(기존 B2).
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/visual-fixture/studio`, { waitUntil: "networkidle" });
await page.waitForSelector(".studio-month-grid", { timeout: 15000 });

const opener = page.locator("button", { hasText: "태그 편집" }).first();
await opener.click();
await page.waitForSelector(".modal-card", { timeout: 8000 });
await page.waitForTimeout(300);

const inCard = () =>
  page.evaluate(() => {
    const card = document.querySelector(".modal-card");
    return card ? card.contains(document.activeElement) : false;
  });

console.log(`열림 직후 포커스 카드 안: ${await inCard()} (true 기대)`);

let escaped = 0;
for (let i = 0; i < 20; i++) {
  await page.keyboard.press("Tab");
  if (!(await inCard())) escaped++;
}
console.log(`Tab x20 중 카드 밖 이탈: ${escaped}회 (0 기대)`);

for (let i = 0; i < 5; i++) {
  await page.keyboard.press("Shift+Tab");
}
console.log(`Shift+Tab x5 후 카드 안: ${await inCard()} (true 기대)`);

await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const modalGone = (await page.locator(".modal-card").count()) === 0;
const focusRestored = await page.evaluate(() => document.activeElement?.textContent?.includes("태그 편집") ?? false);
console.log(`Esc 닫힘: ${modalGone} · 포커스 복원(태그 편집 버튼): ${focusRestored} (둘 다 true 기대)`);

await browser.close();

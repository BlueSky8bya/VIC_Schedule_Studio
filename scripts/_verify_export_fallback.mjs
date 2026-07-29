// P1-EXPORT-1 검증: 클립보드 허용=복사됨 / 차단=PNG 다운로드 폴백.
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const browser = await chromium.launch();

// 1) 클립보드 허용 컨텍스트 → "복사됨!"
{
  const ctx = await browser.newContext({ permissions: ["clipboard-write", "clipboard-read"] });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/visual-fixture/poster?mode=decorate`, { waitUntil: "networkidle" });
  await page.locator(".poster-actions .button.primary").click();
  // 성공 라벨은 1.8초 뒤 idle로 복귀 — 폴링으로 순간 라벨을 잡는다.
  let seen = "(못 봄)";
  for (let i = 0; i < 60; i++) {
    const t = (await page.locator(".poster-actions .button.primary").innerText()).trim();
    if (t.includes("복사됨") || t.includes("저장됨")) { seen = t; break; }
    await page.waitForTimeout(150);
  }
  console.log(`허용: 순간 라벨="${seen}" ("복사됨!" 기대)`);
  await ctx.close();
}

// 2) 클립보드 차단(권한 없음 + write 강제 실패) → 다운로드 폴백
{
  const ctx = await browser.newContext(); // 권한 미부여
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    // headless에서 permissions prompt 없이 확실히 실패시키기
    if (navigator.clipboard) {
      navigator.clipboard.write = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    }
  });
  await page.goto(`${BASE}/visual-fixture/poster?mode=decorate`, { waitUntil: "networkidle" });
  const dl = page.waitForEvent("download", { timeout: 20000 });
  await page.locator(".poster-actions .button.primary").click();
  const download = await dl;
  const label = await page.locator(".poster-actions .button.primary").innerText();
  console.log(`차단: 다운로드 파일="${download.suggestedFilename()}" · 버튼="${label.trim()}" ("이미지로 저장됨!" 기대)`);
  await ctx.close();
}

await browser.close();

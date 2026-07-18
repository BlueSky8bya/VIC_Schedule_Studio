import { expect, test } from "@playwright/test";

// 공개 포스터(시청자) 표면의 픽셀·지오메트리 기준선. 색·글자 scrim 작업(0B)에서 스티커·칸이
// 조용히 밀리는 걸 이 스냅샷이 잡는다. 표면([data-export-surface])만 찍어 바깥 크롬(계정·라이브
// 비콘)의 흔들림을 배제한다.
test.describe("public poster — visual baseline", () => {
  test("viewer surface (2026-06) is pixel-stable", async ({ page }) => {
    await page.goto("/visual-fixture/poster");
    const surface = page.locator("[data-export-surface]").first();
    await surface.waitFor({ state: "visible" });
    // 웹폰트가 다 뜬 뒤 찍어야 글자 폭이 안정된다.
    await page.evaluate(() => document.fonts.ready);
    await expect(surface).toHaveScreenshot("viewer-surface-2026-06.png");
  });
});

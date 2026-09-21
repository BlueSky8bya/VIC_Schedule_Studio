import { expect, test } from "@playwright/test";

for (const width of [1440, 390]) test(`late chat density appears without reopening or fan timeline at ${width}px`, async ({ page }) => {
  test.setTimeout(50_000);
  await page.setViewportSize({ width, height: 1000 });
  await page.route("**/api/activity", r => r.fulfill({ json: { ok: true } }));
  await page.route("**/api/developer/presence", r => r.fulfill({ status: 403, json: { error: "forbidden" } }));
  await page.route("**/api/public/fixture/vod-timeline?*", r => r.fulfill({ json: { entries: [], variants: [] } }));
  let reads = 0;
  await page.route("**/api/public/fixture/vod-chat?*", r => {
    reads++;
    return r.fulfill({ json: { binSec: 30, laughTier: null, bins: reads === 1 ? [] :
      Array.from({ length: 20 }, (_, i) => ({ i, h: (i % 5) / 4, d: (i % 4) / 3, l: (i % 3) / 2, t: [] })) } });
  });
  await page.goto("/visual-fixture/timelines");
  const strip = page.getByRole("region", { name: "채팅 반응 띠" });
  await expect.poll(() => reads).toBe(1);
  await expect(strip.locator(".vch-wave svg")).toHaveCount(0);
  await expect(strip.locator(".vch-wave svg")).toBeVisible({ timeout: 35_000 });
  expect(reads).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await strip.screenshot({ path: `.scratch-pw/chat-recovery-${width}.png` });
});

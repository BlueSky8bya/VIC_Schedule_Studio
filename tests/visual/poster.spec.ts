import { expect, test } from "@playwright/test";

test("public poster is screenshot stable", async ({ page }) => {
  await page.goto("/vic");
  await expect(page.locator("[data-export-surface]")).toHaveScreenshot(
    "vic-public-poster.png"
  );
});

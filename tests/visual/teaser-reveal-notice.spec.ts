import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

for (const width of [1440, 390]) {
  test(`185 to 180 seconds folds the caption and reclaims its actual row at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let postpone = false;
    await page.route("**/api/visual-fixture/premiere**", async route => {
      const response = await route.fetch(), snapshot = await response.json();
      if (postpone) for (const entry of snapshot.entries) {
        entry.revealAt = new Date(Date.parse(entry.revealAt) + 30000).toISOString();
        entry.event.teaserRevealAt = entry.revealAt;
      }
      await route.fulfill({ json: snapshot });
    });
    await page.goto("/visual-fixture/poster?premiere=190");
    const card = page.locator('[data-eventid="00000000-0000-4000-8000-000000000001"]').first();
    if (width === 390) await expect(page.locator(".poster-agenda")).toBeVisible();
    await card.click();
    const notice = page.locator(".dt-reveal-notice");
    await expect(notice).toHaveCSS("opacity", "1");
    await expect.poll(() => page.locator(".agenda-detail-sheet").evaluate(el => el.getAnimations().some(animation => animation.playState === "running"))).toBe(false);
    const height = (await notice.boundingBox())!.height;
    expect(height).toBeGreaterThan(20);
    const gap = () => page.locator(".detail-teaser").evaluate(el => el.querySelector(".dt-hope")!.getBoundingClientRect().top - el.querySelector(".tg-countdown")!.getBoundingClientRect().bottom);
    const before = await gap();
    await expect.poll(() => notice.evaluate(el => Number(getComputedStyle(el).opacity)), { timeout: 10000 }).toBeLessThan(.8);
    expect((await notice.boundingBox())!.height).toBeGreaterThan(0);
    await expect(notice).toHaveCSS("opacity", "0", { timeout: 7000 });
    expect((await notice.boundingBox())!.height).toBeLessThan(.1);
    expect(before - await gap()).toBeGreaterThan(height - 1);
    await expect(notice).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("timer")).toHaveCount(1);
    postpone = true;
    await expect(notice).toHaveCSS("opacity", "1");
    await expect(notice).not.toHaveAttribute("aria-hidden");
    expect((await notice.boundingBox())!.height).toBeCloseTo(height, 0);
  });
}

test("late-open detail starts without a caption and the final-minute ring does not bring it back", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/visual-fixture/poster?premiere=170");
  await page.locator("[data-pm-target]").click();
  await expect(page.locator(".dt-reveal-notice")).toHaveCSS("opacity", "0");
  expect((await page.locator(".dt-reveal-notice").boundingBox())!.height).toBe(0);
  await page.goto("/visual-fixture/poster?premiere=50");
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  await page.locator('[data-eventid="00000000-0000-4000-8000-000000000001"]').first().click();
  await expect(page.locator(".detail-teaser .dt-count")).toBeVisible();
  await expect(page.locator(".dt-count-when,.dt-reveal-notice")).toHaveCount(0);
});

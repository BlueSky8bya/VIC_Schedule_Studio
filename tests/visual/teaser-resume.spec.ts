import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

test("preparation X leaves a keyboard-accessible way back without resetting time", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=170");
  await expect(page.locator(".pm-banner")).toContainText("최초공개 준비 중");
  const target = await page.locator("[data-pm-target]").getAttribute("data-teaser-at");
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  const resume = page.getByRole("button", { name: "최초공개 다시 보기", exact: true });
  await expect(resume).toBeVisible();
  await expect(page.locator(".pm-stage")).toHaveCount(0);
  await expect(page.locator(".poster-page")).not.toHaveAttribute("data-premiere");
  await page.waitForTimeout(1500);
  await expect(page.locator(".pm-stage")).toHaveCount(0);
  await resume.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".pm-stage:not(.pm-focused)")).toBeVisible();
  await expect(page.locator("[data-pm-target]")).toHaveAttribute("data-teaser-at", target!);
  await expect(resume).toHaveCount(0);
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  await expect(resume).toBeVisible();
  await expect(resume).toBeFocused();
});

for (const width of [1440, 390]) {
  test(`dismissed screen resumes the live countdown at ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/visual-fixture/poster?premiere=45");
    const stage = page.getByRole("dialog", { name: "최초공개 무대", exact: true });
    await expect(stage).toBeVisible();
    const target = await stage.getAttribute("data-teaser-at");
    const before = Number(await page.locator(".pm-count strong").textContent());
    await page.keyboard.press("Escape");
    const resume = page.getByRole("button", { name: "최초공개 다시 보기", exact: true });
    await expect(resume).toBeInViewport();
    await expect(stage).toHaveCount(0);
    await expect(page.locator(".poster-page")).not.toHaveAttribute("inert");
    expect(await resume.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await resume.evaluate(el => Boolean(el.closest("[data-export-surface]")))).toBe(false);
    await expect(page.locator(".pm-resume")).toHaveScreenshot(`premiere-resume-${width}.png`, { animations: "disabled" });
    await page.waitForTimeout(1500);
    await expect(stage).toHaveCount(0);
    await resume.click();
    await expect(stage).toBeVisible();
    await expect(stage).toHaveAttribute("data-teaser-at", target!);
    await expect.poll(async () => Number(await page.locator(".pm-count strong").textContent())).toBeLessThan(before);
    await expect(page.getByRole("timer")).toHaveCount(1);
    await expect(resume).toHaveCount(0);
    expect(await page.content()).not.toContain("합성 공개 제목");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) expect(await page.locator("[data-export-surface]").evaluate(el => (el as HTMLElement).offsetWidth)).toBe(1840);
    await page.keyboard.press("Escape");
    await expect(resume).toBeVisible();
    await expect(resume).toBeFocused();
    await expect(page.locator(".poster-page")).not.toHaveAttribute("data-premiere");
    expect(errors).toEqual([]);
  });
}

test("resume yields to settings and reduced motion and never overrides OFF", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=45");
  await expect(page.locator(".pm-focused")).toBeVisible();
  await page.keyboard.press("Escape");
  const resume = page.getByRole("button", { name: "최초공개 다시 보기", exact: true });
  await expect(resume).toBeVisible();
  await page.evaluate(() => document.documentElement.setAttribute("data-reduce-motion", "1"));
  await expect(resume).toHaveCount(0);
  await page.evaluate(() => document.documentElement.removeAttribute("data-reduce-motion"));
  await expect(resume).toBeVisible();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "설정", exact: true })).toBeVisible();
  await expect(resume).toHaveCount(0);
  const tab = page.getByRole("tab", { name: "움직임", exact: true });
  if (await tab.isVisible()) await tab.click();
  const toggle = page.getByRole("switch", { name: "최초공개 무대 켜기/끄기", exact: true });
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(resume).toHaveCount(0);
  await expect(page.locator(".pm-stage")).toHaveCount(0);
});

for (const scenario of ["delete", "immediate"]) {
  test(`a dismissed ${scenario} premiere loses its resume action`, async ({ page }) => {
    await page.goto(`/visual-fixture/poster?premiere=7&scenario=${scenario}`);
    await expect(page.locator(".pm-focused")).toBeVisible();
    await page.keyboard.press("Escape");
    const resume = page.getByRole("button", { name: "최초공개 다시 보기", exact: true });
    await expect(resume).toBeVisible();
    await expect(resume).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator(".pm-stage")).toHaveCount(0);
    if (scenario === "delete") await expect(page.locator('[data-eventid="00000000-0000-4000-8000-000000000001"]')).toHaveCount(0);
    else await expect(page.locator(".public-event").filter({ hasText: "별빛 우체국" })).toHaveCount(1);
  });
}

test("resuming a chain joins only the still-pending premiere", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=6&count=2&gap=10");
  await expect(page.locator(".pm-film.masked")).toHaveCount(2);
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  const resume = page.getByRole("button", { name: "최초공개 다시 보기", exact: true });
  await expect(resume).toBeVisible();
  await expect(page.locator(".public-event").filter({ hasText: "별빛 우체국" })).toHaveCount(1, { timeout: 10000 });
  await resume.click();
  await expect(page.locator(".pm-film.masked")).toHaveCount(1);
  await expect(page.locator(".pm-film.released")).toHaveCount(0);
  await expect(page.locator(".pm-film.masked")).toHaveAttribute("data-pm-event", "00000000-0000-4000-8000-000000000002");
});

import { expect, test } from "@playwright/test";
import type { TeaserStateSnapshot } from "@/lib/schedules/teaser-state";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

for (const width of [1440, 390]) {
  test(`tag-colored reading stays until its visible exit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto("/visual-fixture/poster?premiere=4&scenario=tagged");
    const stage = page.getByRole("dialog", { name: "최초공개 무대", exact: true });
    await expect(stage).toBeVisible();
    expect(await page.content()).not.toContain("합성 공개 제목");
    await expect(page.locator(".pm-complete")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".pm-tags span")).toHaveCount(3);
    const colors = await page.locator(".pm-tags span").evaluateAll(els => els.map(el => getComputedStyle(el).backgroundColor));
    expect(new Set(colors).size).toBe(3);
    for (const theme of ["dark", "light"]) {
      await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
      const contrast = await page.locator(".pm-tags span").evaluateAll(els => els.map(el => {
        const context = document.createElement("canvas").getContext("2d")!;
        const luminance = (color: string) => {
          context.fillStyle = color; context.fillRect(0, 0, 1, 1);
          const rgb = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
          return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
        };
        const style = getComputedStyle(el), foreground = luminance(style.color), background = luminance(style.backgroundColor);
        return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
      }));
      expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
    }
    const accents = await page.locator(".pm-film.released").evaluate(el => ({ first: getComputedStyle(el).getPropertyValue("--pm-accent"), second: getComputedStyle(el).getPropertyValue("--pm-accent-two") }));
    expect(accents.first).not.toBe(accents.second);
    await expect(page.locator(".pm-keepsake")).toHaveCount(0);
    await expect(page.getByRole("timer")).toHaveCount(0);
    await expect(page.locator(".pm-invitation")).toHaveCount(0);
    const exit = page.getByRole("button", { name: "일정표 보기", exact: true });
    await expect(exit).toBeInViewport();
    await page.waitForTimeout(7500); // Exceeds the retired six-second reading budget.
    await expect(stage).toBeVisible();
    await expect(page.locator(".pm-screen")).toHaveScreenshot(`premiere-reading-${width}.png`, { animations: "disabled" });
    if (width === 1440) expect(await page.locator("[data-export-surface]").evaluate(el => (el as HTMLElement).offsetWidth)).toBe(1840);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await exit.click();
    await expect(stage).toHaveCount(0);
    await expect(page.locator(".poster-page")).not.toHaveAttribute("inert");
    expect(errors).toEqual([]);
  });
}

test("held reading follows public body edits and authoritative re-gating", async ({ page }) => {
  let edit = false, regateAt = 0;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(), data = await response.json() as TeaserStateSnapshot;
    for (const item of data.entries) {
      if (regateAt) {
        item.state = "masked"; item.revealAt = new Date(regateAt).toISOString();
        item.event = { ...item.event, publicTitle: "", publicDescription: undefined, startsAt: `${item.dateKey}T00:00:00+09:00`, isAllDay: true, tagIds: [], primaryTagIds: [], teaser: true, teaserRevealAt: item.revealAt };
      } else if (edit && item.state === "released") item.event.publicDescription = "공개 후 수정된 설명";
    }
    await route.fulfill({ response, json: data });
  });
  await page.goto("/visual-fixture/poster?premiere=4&scenario=tagged");
  await expect(page.locator(".pm-complete")).toBeVisible({ timeout: 10000 });
  edit = true;
  await expect(page.locator(".pm-details")).toContainText("공개 후 수정된 설명", { timeout: 17000 });
  regateAt = Date.now() + 40000;
  await expect(page.locator(".pm-film.masked")).toHaveCount(1, { timeout: 17000 });
  expect(await page.content()).not.toContain("합성 공개 제목");
  await expect(page.locator(".pm-tags span")).toHaveCount(0);
  await expect(page.getByRole("timer")).toHaveCount(1);
});

test("deleting the held cohort returns the calendar without a ghost story", async ({ page }) => {
  let deleted = false;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(), data = await response.json() as TeaserStateSnapshot;
    if (deleted) data.entries = [];
    await route.fulfill({ response, json: data });
  });
  await page.goto("/visual-fixture/poster?premiere=4");
  await expect(page.locator(".pm-complete")).toBeVisible({ timeout: 10000 });
  deleted = true;
  await expect(page.locator(".pm-phase-return")).toBeVisible({ timeout: 17000 });
  expect(await page.content()).not.toContain("합성 공개 제목");
  await expect(page.locator(".pm-stage")).toHaveCount(0, { timeout: 18000 });
  await expect(page.locator('[data-eventid="00000000-0000-4000-8000-000000000001"]')).toHaveCount(0);
});

test("the panel yields before the preparation badge occupies its measured slot", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=139");
  const panel = page.locator(".poster-panel-ctl"), badge = page.locator(".pm-stage .pm-banner");
  await expect(badge).toBeVisible();
  await expect(panel).toHaveAttribute("inert");
  await expect.poll(() => panel.evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.01);
  await expect.poll(() => badge.evaluate(el => el.getBoundingClientRect().bottom)).toBeGreaterThan(1160);
  const geometry = await panel.evaluate(el => {
    const style = getComputedStyle(el), zoom = parseFloat(style.getPropertyValue("zoom")) || 1;
    const desired = innerHeight - (parseFloat(style.bottom) + (el as HTMLElement).offsetHeight / 2) * zoom;
    const rect = document.querySelector(".pm-stage .pm-banner")!.getBoundingClientRect();
    return { desired, actual: rect.top + rect.height / 2 };
  });
  expect(Math.abs(geometry.desired - geometry.actual)).toBeLessThan(2);
  await page.keyboard.press("Escape");
  await expect(panel).not.toHaveAttribute("inert");
  await expect.poll(() => panel.evaluate(el => Number(getComputedStyle(el).opacity))).toBe(1);
});

test("headings share bounded tension and settle with the numeral", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=30");
  const heading = page.locator(".pm-kicker");
  await expect(heading).toBeVisible();
  await expect.poll(() => heading.evaluate(el => getComputedStyle(el).translate)).not.toBe("none");
  const before = await heading.evaluate(el => getComputedStyle(el).translate);
  await expect.poll(() => heading.evaluate(el => getComputedStyle(el).translate)).not.toBe(before);
  await page.goto("/visual-fixture/poster?premiere=9");
  await expect(page.locator(".pm-count")).toBeVisible();
  await expect.poll(() => heading.evaluate(el => getComputedStyle(el).translate)).toMatch(/^0px(?: 0px)?$/);
});

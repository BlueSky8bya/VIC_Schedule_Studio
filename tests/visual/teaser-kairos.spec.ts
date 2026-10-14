import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

for (const width of [1440, 390]) {
  test(`one familiar host frames one truthful clock at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/visual-fixture/poster?premiere=40");
    const portrait = page.locator(".pm-host > div > img");
    await expect(portrait).toBeVisible();
    await expect.poll(() => portrait.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(640);
    await expect(page.getByRole("timer")).toHaveCount(1);
    await expect(page.locator(".pm-light-field, .pm-count canvas")).toHaveCount(0);
    await expect(page.locator(".pm-scene")).toHaveAttribute("aria-hidden", "true");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.evaluate(() => document.fonts.ready);
    // Freeze decorative drift as well: the live numeral's transformed mask
    // otherwise swaps 440×441 / 441×440 bounds between real clock ticks.
    await page.addStyleTag({ content: ".pm-stage { --pm-gather: .4!important; --pm-fold-drift: 0px!important; --pm-digit-x: 0px!important; --pm-digit-y: 0px!important; --pm-digit-tilt: 0deg!important; } .pm-fan { --fan-hop: 0px!important; --fan-frame-x: 0%!important; --fan-frame-y: 0%!important; }" });
    // Numeric time remains live. Mask its ink, not the surrounding composition.
    await expect(page.locator(".pm-screen")).toHaveScreenshot(`premiere-invitation-${width}.png`, { mask: [page.locator(".dt-count-core")], animations: "disabled" });
  });

  test(`continue reading hands off to the shared public detail at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.goto("/visual-fixture/poster?premiere=5&scenario=outline");
    await expect(page.locator(".pm-story h2")).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("button", { name: "계속 읽기", exact: true })).toBeInViewport();
    const contrast = () => page.locator(".pm-read").evaluate(el => {
      const luminance = (color: string) => {
        const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
        return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
      };
      const text = luminance(getComputedStyle(el).color), surface = luminance(getComputedStyle(el.closest(".pm-screen")!).backgroundColor);
      return (Math.max(text, surface) + .05) / (Math.min(text, surface) + .05);
    });
    expect(await contrast()).toBeGreaterThanOrEqual(4.5);
    await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
    expect(await contrast()).toBeGreaterThanOrEqual(4.5);
    await page.getByRole("button", { name: "계속 읽기", exact: true }).click();
    await expect(page.locator(".pm-stage")).toHaveCount(0);
    const detail = page.locator(".agenda-detail-sheet:not(.is-teaser)");
    await expect(detail).toBeVisible();
    if (width === 390) await expect(page.locator(".agenda-detail-backdrop")).not.toHaveClass(/is-pop/);
    else await expect(page.locator(".agenda-detail-backdrop")).toHaveClass(/is-pop/);
    await expect(detail).toContainText("첫 번째 편지");
    await page.waitForTimeout(6500);
    await expect(detail).toBeVisible();
    await expect(page.locator(".pm-stage")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(detail).toHaveCount(0);
    await expect(page.locator(".poster-page")).not.toHaveAttribute("inert");
  });
}

test("a voluntary hope has a short local response without moving the clock", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=45");
  const clock = page.getByRole("timer");
  await expect(clock).toBeVisible();
  await expect.poll(() => page.locator(".pm-screen").evaluate(el => el.getAnimations().some(a => a.playState === "running"))).toBe(false);
  const before = await clock.boundingBox();
  await page.getByRole("button", { name: "기대돼요", exact: true }).click();
  await expect(page.locator(".pm-wish")).toHaveCount(1);
  await expect(page.locator(".pm-host-response")).toBeVisible();
  const after = await clock.boundingBox();
  expect(Math.abs(after!.width - before!.width)).toBeLessThan(1);
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(6); // bounded existing digit texture
  await expect.poll(() => page.locator(".pm-wish span").evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.01);
});

test("the last seconds retire the host and stop the folds while the clock stays alive", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=10");
  const stage = page.locator(".pm-stage");
  await expect.poll(() => stage.evaluate(el => (el as HTMLElement).style.getPropertyValue("--pm-fold-drift"))).toBe("0px");
  await expect.poll(() => page.locator(".pm-host").evaluate(el => Number(getComputedStyle(el).opacity)), { timeout: 9000 }).toBeLessThan(.05);
  await expect(page.locator(".pm-heading")).toHaveAttribute("inert");
  const before = await page.getByRole("timer").textContent();
  await expect.poll(() => page.getByRole("timer").textContent(), { timeout: 2200 }).not.toBe(before);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeFocused();
});

test("zero without server publication never starts the opening celebration", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=6&scenario=delay");
  await expect(page.locator(".pm-phase-waiting")).toBeVisible({ timeout: 10000 });
  await expect(page.locator(".pm-count")).toContainText("공개 확인 중");
  await expect(page.locator(".pm-count .dt-count-label")).toBeVisible();
  await expect(page.locator(".pm-bang, .pm-screen.is-released")).toHaveCount(0);
  expect(await page.locator(".pm-host").evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.01);
});

test("a forward server-clock correction cannot compress actual visible flash intervals", async ({ page }) => {
  let shift = false;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch();
    const snapshot = await response.json();
    return route.fulfill({ json: { ...snapshot, clockSkewMs: shift ? 700 : 0, clockUncertaintyMs: 1 } });
  });
  await page.goto("/visual-fixture/poster?premiere=7&count=3&gap=1");
  await expect(page.locator(".pm-focused")).toBeVisible();
  await page.evaluate(() => {
    const stage = document.querySelector(".pm-stage")!;
    const times: number[] = [];
    (window as typeof window & { kairosFlashes: number[] }).kairosFlashes = times;
    let active = false;
    new MutationObserver(() => {
      const next = stage.classList.contains("pm-bang");
      if (next && !active) times.push(performance.now());
      active = next;
    }).observe(stage, { attributes: true, attributeFilter: ["class"] });
  });
  const times = () => page.evaluate(() => (window as typeof window & { kairosFlashes: number[] }).kairosFlashes);
  await expect.poll(async () => (await times()).length, { timeout: 11000 }).toBeGreaterThan(0);
  shift = true; // Real public-clock response correction; never fake page time.
  await expect(page.locator(".pm-film.released")).toHaveCount(3, { timeout: 7000 });
  const observed = await times();
  for (let index = 1; index < observed.length; index++) expect(observed[index] - observed[index - 1]).toBeGreaterThanOrEqual(1400);
});

test("dismissal fades the scene before restoring the calendar", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=40");
  const dark = page.locator(".pm-dark");
  await expect(dark).toBeVisible();
  await expect.poll(() => dark.evaluate(el => el.getAnimations().some(animation => animation.playState === "running"))).toBe(false);
  await page.keyboard.press("Escape");
  await expect.poll(() => dark.evaluate(el => Number(getComputedStyle(el).opacity)), { timeout: 650, intervals: [50, 100] }).toBeLessThan(.8);
  await expect(page.locator(".pm-stage")).toHaveCount(0);
  await expect(page.locator(".poster-page")).not.toHaveAttribute("inert");
});

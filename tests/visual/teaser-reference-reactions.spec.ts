import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
const photo = (page: Page) => page.locator(".pm-photo-content");
const ready = async (page: Page) => expect.poll(() => page.locator(".pm-photo-layer").evaluateAll(images => images.every(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth === 320))).toBe(true);

for (const [width, height] of [[1100, 780], [390, 844], [844, 390]]) {
  test(`original whole-photo reactions remain unobstructed at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/visual-fixture/poster?premiere=40"); await ready(page);
    const hope = page.locator(".pm-hope").first(), host = page.locator(".pm-host");
    const h = (await host.boundingBox())!, button = (await hope.boundingBox())!;
    expect(h.y).toBeGreaterThanOrEqual(button.y + button.height);
    await expect(host).toBeInViewport({ ratio: 1 });
    await hope.click();
    await expect(photo(page)).toHaveAttribute("data-expression", "delighted");
    await expect(photo(page)).not.toHaveAttribute("data-switching");
    await expect(host).toHaveScreenshot(`reference-smile-${width}.png`);
    await hope.click();
    await expect(photo(page)).toHaveAttribute("data-expression", "unimpressed");
    await expect(photo(page)).not.toHaveAttribute("data-switching");
    await expect(host).toHaveScreenshot(`reference-contempt-${width}.png`);
    await expect(page.locator('.pm-expression,img[src*="victory-delighted"],img[src*="victory-unimpressed"]')).toHaveCount(0);
    await expect(page.getByRole("timer")).toHaveCount(1);
  });
}

test("multiple hopes retain happiness; rapid changes coalesce below two blinks per second", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=40&count=2"); await ready(page);
  await photo(page).evaluate(el => {
    const trace: number[] = []; (window as typeof window & { __photoBlinks: number[] }).__photoBlinks = trace;
    new MutationObserver(changes => { for (const change of changes) if (change.attributeName === "data-switching" && el.hasAttribute("data-switching")) trace.push(performance.now()); }).observe(el, { attributes: true, attributeFilter: ["data-switching"] });
  });
  const hopes = page.locator(".pm-hope");
  await hopes.first().click(); await expect(photo(page)).toHaveAttribute("data-expression", "delighted");
  await hopes.last().click(); await hopes.first().click();
  await expect(photo(page)).toHaveAttribute("data-expression", "delighted");
  await hopes.last().click(); await expect(photo(page)).toHaveAttribute("data-expression", "unimpressed");
  for (let n = 0; n < 5; n++) await hopes.first().click();
  await expect(hopes.first()).toHaveAttribute("aria-pressed", "true");
  await expect(photo(page)).toHaveAttribute("data-expression", "delighted");
  await page.waitForTimeout(2300);
  await expect(photo(page)).toHaveAttribute("data-expression", "delighted");
  await expect(photo(page)).not.toHaveAttribute("data-switching");
  const times = await page.evaluate(() => (window as typeof window & { __photoBlinks: number[] }).__photoBlinks);
  expect(times.length).toBeGreaterThan(0);
  for (let n = 1; n < times.length; n++) expect(times[n] - times[n - 1]).toBeGreaterThanOrEqual(680);
});

test("a delayed picture stays on the loaded original until its own pixels arrive", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/premiere/tori-photo-delighted.webp", async route => { await gate; await route.continue(); });
  await page.goto("/visual-fixture/poster?premiere=40", { waitUntil: "domcontentloaded" });
  await page.locator(".pm-hope").first().click();
  await page.waitForTimeout(500);
  await expect(photo(page)).toHaveAttribute("data-expression", "neutral");
  await expect(photo(page)).not.toHaveAttribute("data-switching");
  release();
  await expect(photo(page)).toHaveAttribute("data-expression", "delighted");
});

test("calm graphics and hidden-tab changes land on the latest original without a blink replay", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=40"); await ready(page);
  await page.evaluate(() => { localStorage.setItem("vic.gfxPref", "auto"); localStorage.setItem("vic.gfx", JSON.stringify({ mode: "soft", at: Date.now(), v: 3 })); document.documentElement.dataset.gfx = "soft"; });
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-gfx", "soft");
  await page.locator(".pm-hope").first().click();
  await expect(photo(page)).toHaveAttribute("data-expression", "delighted");
  expect(await photo(page).evaluate(el => el.getAnimations().length)).toBe(0);
  await page.evaluate(() => { localStorage.setItem("vic.gfxPref", "max"); document.documentElement.dataset.gfx = "full"; Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.locator(".pm-hope").first().click();
  await expect(photo(page)).toHaveAttribute("data-expression", "unimpressed");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(photo(page)).not.toHaveAttribute("data-switching");
  await page.keyboard.press("Escape");
  await expect(page.locator(".pm-stage")).toHaveCount(0);
});

test("a changed generation resets contempt while preserving the focused audience button", async ({ page }) => {
  let postpone = false;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(), snapshot = await response.json();
    if (postpone) for (const entry of snapshot.entries) if (entry.revealAt) { entry.revealAt = new Date(Date.parse(entry.revealAt) + 15000).toISOString(); entry.event.teaserRevealAt = entry.revealAt; }
    await route.fulfill({ json: snapshot });
  });
  await page.goto("/visual-fixture/poster?premiere=40"); await ready(page);
  const hope = page.locator(".pm-hope").first(); await hope.click(); await hope.click();
  await expect(photo(page)).toHaveAttribute("data-expression", "unimpressed");
  const fan = page.getByRole("button", { name: "빅타민 1 응원하기", exact: true });
  await fan.focus();
  await fan.evaluate(el => { (window as typeof window & { __sameFan: Element }).__sameFan = el; });
  const target = await page.locator(".pm-stage").getAttribute("data-teaser-at"); postpone = true;
  await expect(page.locator(".pm-stage")).not.toHaveAttribute("data-teaser-at", target!);
  await expect(photo(page)).toHaveAttribute("data-expression", "neutral");
  await expect(fan).toBeFocused();
  expect(await fan.evaluate(el => el === (window as typeof window & { __sameFan: Element }).__sameFan)).toBe(true);
});

test("agenda spectators gather below the clock and hidden return after eight snaps to their seats", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/visual-fixture/poster?premiere=12");
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-quiet", "");
  const first = page.locator(".pm-fan").first(), start = (await first.boundingBox())!;
  await expect.poll(() => first.evaluate(el => el.getBoundingClientRect().x)).toBeGreaterThan(start.x + 3);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(3100);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-seated", "");
  for (const fan of await page.locator(".pm-fan:visible").all()) {
    await expect(fan).toHaveAttribute("inert");
    expect(await fan.evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0s");
    expect(await fan.locator(".pm-fan-art").evaluate(el => getComputedStyle(el).transitionDuration)).toBe("0s");
    const box = (await fan.boundingBox())!, clock = (await page.getByRole("timer").boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(clock.y + clock.height);
  }
  const rect = await first.boundingBox(); await page.waitForTimeout(400);
  expect(await first.boundingBox()).toEqual(rect);
  await expect(page.getByRole("timer")).toHaveCount(1);
});

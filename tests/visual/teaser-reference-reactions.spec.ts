import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
const photo = (page: Page) => page.locator(".pm-wish-photo");
const ready = async (page: Page) => expect.poll(() => photo(page).evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(1536);

for (const [width, height] of [[1100, 780], [390, 844], [844, 390]]) {
  test(`original wish background preserves a clear clock and audience at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/visual-fixture/poster?premiere=40"); await ready(page);
    await expect(page.locator(".pm-host,.pm-photo-content")).toHaveCount(0);
    const hope = page.locator(".pm-hope").first();
    await expect(photo(page)).toHaveCSS("opacity", "0");
    await hope.click(); await expect(photo(page)).toHaveCSS("opacity", "0.18");
    const plane = (await page.locator(".pm-screen").boundingBox())!, picture = (await photo(page).boundingBox())!;
    // Measure original nose/mouth against the actual dialog, not image-box
    // symmetry. Their original two-pixel offsets remain below two screen px.
    for (const x of [794, 798]) expect(Math.abs(picture.x + picture.width * x / 1536 - (plane.x + plane.width / 2))).toBeLessThan(2);
    expect(Math.abs(picture.y + picture.height / 2 - (plane.y + plane.height / 2))).toBeLessThan(1);
    const h = (await hope.boundingBox())!;
    await expect(page.locator(".pm-fan")).toHaveCount(width <= 1040 ? 0 : 6);
    for (const fan of await page.locator(".pm-fan:visible").all()) {
      const f = (await fan.boundingBox())!;
      expect(f.y).toBeGreaterThanOrEqual(h.y + h.height);
      await expect(fan).toBeInViewport({ ratio: 1 });
    }
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: ".pm-stage { --pm-gather:.4!important;--pm-fold-drift:0px!important;--pm-digit-x:0px!important;--pm-digit-y:0px!important;--pm-digit-tilt:0deg!important; } .pm-fan { --fan-hop:0px!important;--fan-frame-x:0%!important;--fan-frame-y:0%!important; } .pm-wish {display:none}" });
    await expect(page.locator(".pm-screen")).toHaveScreenshot(`wish-background-${width}.png`, { mask: [page.locator(".dt-count-core")] });
    await hope.click(); await expect(photo(page)).toHaveCSS("opacity", "0");
    await expect(page.getByRole("timer")).toHaveCount(1);
    expect(await photo(page).evaluate(el => getComputedStyle(el).pointerEvents)).toBe("none");
  });
}

test("multiple hopes and rapid reversals follow the current selection with no blink queue", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=40&count=2"); await ready(page);
  const hopes = page.locator(".pm-hope");
  await hopes.first().click(); await hopes.last().click(); await hopes.first().click();
  await expect(photo(page)).toHaveCSS("opacity", "0.18");
  await hopes.last().click(); await expect(photo(page)).toHaveCSS("opacity", "0");
  for (let n = 0; n < 5; n++) await hopes.first().click();
  await expect(hopes.first()).toHaveAttribute("aria-pressed", "true");
  await expect(photo(page)).toHaveCSS("opacity", "0.18");
  await page.waitForTimeout(1500);
  await expect(photo(page)).toHaveCSS("opacity", "0.18");
  expect(await photo(page).evaluate(el => el.getAnimations().length)).toBe(0);
});

test("delayed pixels cannot replay a cancelled hope; failed images leave the countdown usable", async ({ page }) => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/premiere/victory-wish.webp", async route => { await gate; await route.continue(); });
  await page.goto("/visual-fixture/poster?premiere=40", { waitUntil: "domcontentloaded" });
  const hope = page.locator(".pm-hope").first();
  await hope.click(); await expect(photo(page)).not.toHaveAttribute("data-visible");
  await hope.click(); release(); await ready(page);
  await expect(photo(page)).toHaveCSS("opacity", "0");
  await hope.click(); await expect(photo(page)).toHaveCSS("opacity", "0.18");
  await page.unroute("**/premiere/victory-wish.webp");
  await page.route("**/premiere/victory-wish.webp", route => route.abort());
  await page.reload(); await page.locator(".pm-hope").first().click();
  await expect(photo(page)).toHaveCSS("opacity", "0");
  await expect(page.getByRole("timer")).toHaveCount(1);
});

test("calm graphics keep a still picture; lite reduces the audience; quiet removes the picture", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=22"); await ready(page);
  await page.evaluate(() => { localStorage.setItem("vic.gfxPref", "auto"); localStorage.setItem("vic.gfx", JSON.stringify({ mode: "soft", at: Date.now(), v: 3 })); document.documentElement.dataset.gfx = "soft"; });
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-gfx", "soft");
  await page.locator(".pm-hope").first().click(); await expect(photo(page)).toHaveCSS("opacity", "0.18");
  expect(await photo(page).evaluate(el => el.getAnimations().length)).toBe(0);
  await page.evaluate(() => { localStorage.setItem("vic.gfx", JSON.stringify({ mode: "lite", at: Date.now(), v: 3 })); document.documentElement.dataset.gfx = "lite"; });
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-gfx", "lite");
  await expect(page.locator(".pm-fan:visible")).toHaveCount(3);
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-quiet", "", { timeout: 14000 });
  await expect(photo(page)).not.toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(1);
});

test("a changed deadline keeps the selection and the identical focused audience button", async ({ page }) => {
  let postpone = false;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(), snapshot = await response.json();
    if (postpone) for (const entry of snapshot.entries) if (entry.revealAt) { entry.revealAt = new Date(Date.parse(entry.revealAt) + 15000).toISOString(); entry.event.teaserRevealAt = entry.revealAt; }
    await route.fulfill({ json: snapshot });
  });
  await page.goto("/visual-fixture/poster?premiere=40"); await ready(page);
  await page.locator(".pm-hope").first().click(); await expect(photo(page)).toHaveCSS("opacity", "0.18");
  const fan = page.getByRole("button", { name: "빅타민 1 응원하기", exact: true }); await fan.focus();
  await fan.evaluate(el => { (window as typeof window & { __sameFan: Element }).__sameFan = el; });
  const target = await page.locator(".pm-stage").getAttribute("data-teaser-at"); postpone = true;
  await expect(page.locator(".pm-stage")).not.toHaveAttribute("data-teaser-at", target!);
  await expect(photo(page)).toHaveCSS("opacity", "0.18"); await expect(fan).toBeFocused();
  expect(await fan.evaluate(el => el === (window as typeof window & { __sameFan: Element }).__sameFan)).toBe(true);
});

test("desktop spectators gather below the clock and hidden return after eight snaps to their seats", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 780 });
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

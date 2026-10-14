import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

async function open(page: Page, seconds: number, options = "") {
  await page.goto(`/visual-fixture/poster?premiere=${seconds}${options}`);
  await expect(page.locator(".pm-stage")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator(".pm-screen").count()) {
    await expect.poll(() => page.locator(".pm-screen").evaluate(el => el.getAnimations().some(animation => animation.playState === "running"))).toBe(false);
  }
}

async function softGfx(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem("vic.gfxPref", "auto");
    localStorage.setItem("vic.gfx", JSON.stringify({ mode: "soft", at: Date.now(), v: 3 }));
    document.documentElement.setAttribute("data-gfx", "soft");
  });
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-gfx", "soft");
}

test("the prelude has a running countdown and the debut/season/filter all leave", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, 170);
  const readout = page.locator(".pm-readout");
  const before = await readout.textContent();
  await expect.poll(() => readout.textContent(), { timeout: 2000 }).not.toBe(before);
  await expect.poll(() => page.locator(".rail-info-card").evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.01);
  await expect(page.locator(".rail-info-card")).toHaveAttribute("inert");
  await open(page, 137);
  for (const selector of [".rail-info-card", ".viewer-ambient-ctl", ".slot-legend"]) {
    await expect.poll(() => page.locator(selector).evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.01);
    await expect(page.locator(selector)).toHaveAttribute("inert");
    expect(await page.locator(selector).evaluate(el => getComputedStyle(el).animationName)).toBe("none");
  }
});

test("panel space becomes calendar space continuously and dismissal restores its geometry/preferences", async ({ page }) => {
  test.setTimeout(40000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.addInitScript(() => localStorage.removeItem("vic_panel_collapsed"));
  await open(page, 141);
  const canvas = page.locator(".poster-stage"), surface = page.locator("[data-export-surface]");
  const before = await canvas.boundingBox();
  const geometry = await surface.evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }));
  await expect.poll(async () => (await canvas.boundingBox())!.width / before!.width, { timeout: 19000 }).toBeGreaterThan(1.15);
  expect(await surface.evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }))).toEqual(geometry);
  expect(geometry.width).toBe(1840);
  await page.keyboard.press("Escape");
  await expect(page.locator(".poster-page")).not.toHaveAttribute("data-premiere");
  await expect.poll(async () => Math.abs((await canvas.boundingBox())!.width - before!.width)).toBeLessThan(1);
  expect(await page.evaluate(() => localStorage.getItem("vic_panel_collapsed"))).toBeNull();
  await expect(page.locator(".rail-info-card")).not.toHaveAttribute("inert");
});

test("calendar emphasis is spatial and gradual before other days withdraw", async ({ page }) => {
  await open(page, 100);
  await expect.poll(() => page.locator(".public-day").first().evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.8);
  const values = await page.locator(".public-day:not(:has([data-pm-target]))").evaluateAll(els => els.map(el => Number(getComputedStyle(el).opacity)));
  expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(.02);
  expect(Math.min(...values)).toBeGreaterThan(.15);
  await expect(page.locator("[data-pm-target]")).toHaveCount(1);
  expect(await page.locator("[data-pm-target]").evaluate(el => getComputedStyle(el).visibility)).toBe("visible");
});

test("an asynchronously arriving live card inherits the current exit score", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await open(page, 140);
  await page.locator(".avatar-top-cards").evaluate(el => { const card = document.createElement("div"); card.className = "soop-live-card synthetic-live"; card.textContent = "합성 LIVE"; el.append(card); });
  await expect(page.locator(".synthetic-live")).toHaveAttribute("inert");
  await expect.poll(() => page.locator(".synthetic-live").evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.01);
  await page.keyboard.press("Escape");
  await expect(page.locator(".synthetic-live")).not.toHaveAttribute("inert");
  await expect(page.locator(".synthetic-live")).not.toHaveAttribute("data-pm-exit");
});

test("seasonal canvases keep their viewport containing block while exiting", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vic.ambient", "on"));
  await open(page, 94, "&ambient=autumn");
  await expect.poll(() => page.locator(".pm-ambient-shell canvas").count()).toBeGreaterThan(0);
  expect(await page.locator(".pm-ambient-shell").evaluate(el => getComputedStyle(el).transform)).toBe("none");
  const readout = await page.locator(".pm-readout").textContent();
  await expect.poll(() => page.locator(".pm-readout").textContent(), { timeout: 2000 }).not.toBe(readout);
  const viewport = await page.locator(".pm-ambient-shell canvas").first().boundingBox();
  expect(viewport!.width).toBeGreaterThan(1000);
  expect(viewport!.height).toBeGreaterThan(500);
  await page.keyboard.press("Escape");
  await expect(page.locator(".poster-page")).not.toHaveAttribute("data-premiere");
});

test("large countdown, hope feedback and final calm keep conveying progress", async ({ page }) => {
  await open(page, 35);
  expect((await page.locator(".pm-screen").boundingBox())!.width).toBeGreaterThan(1000);
  expect(await page.locator(".dt-count-core").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(100);
  const before = Number(await page.locator(".dt-count-core strong").textContent());
  await page.getByRole("button", { name: "기대돼요", exact: true }).click();
  await expect(page.getByRole("button", { name: "함께 기다리는 중", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".pm-hope-bloom")).toHaveCount(1);
  await expect(page.locator(".pm-stage")).toHaveClass(/pm-hoped/);
  await expect.poll(async () => Number(await page.locator(".dt-count-core strong").textContent())).toBeLessThan(before);
  await expect(page.locator(".pm-particle,.pm-orbit,.pm-lightstick")).toHaveCount(0);
  await expect(page.getByText("공개 전까지 비밀이에요", { exact: true })).toHaveCount(0);
  await open(page, 9);
  await expect.poll(() => page.locator(".pm-light-field").evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.01);
  expect(await page.locator(".pm-light-field i").first().evaluate(el => getComputedStyle(el).animationPlayState)).toBe("paused");
  const calm = await page.locator(".dt-count-core strong").textContent();
  await expect.poll(() => page.locator(".dt-count-core strong").textContent(), { timeout: 2000 }).not.toBe(calm);
});

test("the first screen seconds never inherit the detail emerge mask or clip large digits", async ({ page }) => {
  await open(page, 65);
  await expect(page.locator(".pm-screen")).toHaveCount(1);
  const clock = page.locator(".pm-count .dt-count");
  const bounds = await clock.evaluate(el => {
    const style = getComputedStyle(el), box = el.getBoundingClientRect();
    const number = el.querySelector("strong")!.getBoundingClientRect();
    const label = el.querySelector(".dt-count-label")!.getBoundingClientRect();
    return { opacity: style.opacity, mask: style.maskImage, height: box.height, numberTop: number.top, numberBottom: number.bottom, top: box.top, labelBottom: label.bottom, bottom: box.bottom };
  });
  expect(bounds.opacity).toBe("1"); expect(bounds.mask).toBe("none");
  expect(bounds.height).toBeGreaterThan(300);
  expect(bounds.numberTop).toBeGreaterThanOrEqual(bounds.top);
  expect(bounds.numberBottom).toBeLessThanOrEqual(bounds.bottom);
  expect(bounds.labelBottom).toBeLessThanOrEqual(bounds.bottom + 1);
  const before = await clock.locator("strong").textContent();
  await expect.poll(() => clock.locator("strong").textContent(), { timeout: 2000 }).not.toBe(before);
});

test("zero seconds clearly indicates an in-progress confirmation", async ({ page }) => {
  await open(page, 4, "&scenario=delay");
  await expect(page.locator(".pm-loading")).toBeVisible({ timeout: 7000 });
  await expect(page.locator(".dt-count-label")).toContainText("공개 확인 중");
  expect(await page.locator(".dt-count-core strong").textContent()).toBe("0");
  expect(await page.locator(".pm-loading").evaluate(el => getComputedStyle(el).animationName)).toBe("pm-loading");
});

test("a sparse release is legible at editorial scale without invented content", async ({ page }) => {
  await open(page, 5, "&scenario=sparse");
  await expect(page.locator(".pm-story h2")).toHaveText("새로운 시작", { timeout: 10000 });
  expect(await page.locator(".pm-story h2").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThan(60);
  await expect(page.locator(".pm-details time")).toContainText("8:30");
  await expect(page.locator(".pm-details p,.pm-tags")).toHaveCount(0);
});

test("long revealed text scrolls within the screen without hiding the escape control", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 5, "&scenario=long");
  await expect(page.locator(".pm-story h2")).toContainText("별빛 우체국", { timeout: 10000 });
  await expect(page.locator(".poster-page .reveal-shock")).toHaveCount(0);
  expect(await page.locator(".pm-screen").evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.locator(".pm-details p").evaluate(el => el.scrollIntoView({ block: "end" }));
  await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeInViewport();
  const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: innerWidth, outside: [...document.querySelectorAll("body *")].flatMap(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1) ? [{ tag: el.tagName, cls: el.getAttribute("class"), left: r.left, right: r.right, overflow: getComputedStyle(el).overflow }] : []; }).slice(0, 20) }));
  expect(overflow.width, JSON.stringify(overflow)).toBeLessThanOrEqual(overflow.viewport);
});

test("gfx fallback removes decorative fields while the countdown stays live", async ({ page }) => {
  await open(page, 35);
  await softGfx(page);
  await expect(page.locator(".pm-light-field")).not.toBeVisible();
  const before = await page.locator(".dt-count-core strong").textContent();
  await expect.poll(() => page.locator(".dt-count-core strong").textContent(), { timeout: 2000 }).not.toBe(before);
});

test.describe("landscape touch", () => {
  test.use({ hasTouch: true, viewport: { width: 844, height: 390 } });
  test("keeps the shared stage usable without horizontal overflow", async ({ page }) => {
    await open(page, 35, "&count=4");
    await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeInViewport();
    await page.getByRole("button", { name: "기대돼요", exact: true }).last().scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "기대돼요", exact: true }).last()).toBeInViewport();
    expect(await page.locator("canvas").count()).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(page.locator(".poster-page")).not.toHaveAttribute("inert");
  });
});

for (const width of [1440, 390]) {
  test(`fluid countdown visual at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await open(page, 45);
    // Stable geometry baseline. Real time/motion remain covered by the tests
    // above; don't replace the clock or freeze server/client time.
    await softGfx(page);
    await page.addStyleTag({ content: ".pm-count .dt-ring-progress{stroke-dashoffset:.4!important}.pm-count .dt-ring-ticks line{opacity:.1!important}.pm-screen{animation:none!important}" });
    await expect(page.locator(".pm-screen")).toHaveScreenshot(`premiere-fluid-${width}.png`, { mask: [page.locator(".dt-count-core")], animations: "disabled" });
  });
}

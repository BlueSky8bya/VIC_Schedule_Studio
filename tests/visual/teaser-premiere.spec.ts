import { expect, test, type Page } from "@playwright/test";

async function openMotionSettings(page: Page) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const tab = page.getByRole("tab", { name: "움직임", exact: true });
  if (await tab.isVisible()) await tab.click();
  return page.getByRole("switch", { name: "최초공개 무대 켜기/끄기", exact: true });
}

test.beforeEach(async ({ page }) => {
  // All premiere transport is synthetic; block unrelated actions and live data.
  await page.route("**/api/public/vic/live**", route => route.fulfill({ json: { live: false } }));
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.route("**/visual-fixture/poster**", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await page.route("**/api/activity", route => route.fulfill({ status: 204 }));
  await page.route("**/api/presence", route => route.fulfill({ status: 204 }));
});

test("one shared stage reveals simultaneous content and returns without changing 1840px geometry", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/visual-fixture/poster?premiere=9&count=2");
  const surface = page.locator("[data-export-surface]");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  expect(await page.content()).not.toContain("합성 공개 제목");
  expect(await surface.evaluate(el => (el as HTMLElement).offsetWidth)).toBe(1840);
  await expect(page.locator(".pm-film.released")).toHaveCount(2, { timeout: 16000 });
  await expect(page.locator(".pm-film.released").first()).toContainText("별빛 우체국", { timeout: 3000 });
  await expect(page.locator(".pm-stage")).toHaveCount(0, { timeout: 12000 });
  expect(await surface.evaluate(el => (el as HTMLElement).offsetWidth)).toBe(1840);
  expect(await page.locator(".poster-page").getAttribute("inert")).toBeNull();
  expect(errors).toEqual([]);
});

test("Escape restores controls and does not reenter the same premiere", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=50");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pm-stage")).toHaveCount(0);
  await expect(page.locator(".poster-page")).not.toHaveAttribute("data-premiere");
  await page.waitForTimeout(1200);
  await expect(page.locator(".pm-stage")).toHaveCount(0);
});

test("mobile uses the same stage, keeps safe controls visible and has no canvas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/visual-fixture/poster?premiere=45&count=4");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  await expect(page.getByRole("button", { name: /일정표 보기/ })).toBeVisible();
  expect(await page.locator("canvas").count()).toBe(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("reduced motion prevents automatic occupancy, including a mid-show preference change", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=45");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  await page.evaluate(() => { document.documentElement.setAttribute("data-reduce-motion", "1"); });
  await expect(page.locator(".pm-stage")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "최초공개 다시 보기", exact: true })).toHaveCount(0);
  expect(await page.locator(".poster-page").getAttribute("inert")).toBeNull();
});

test("postponement updates the existing screen without revealing title", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=5&scenario=postpone");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  await expect.poll(async () => Number(await page.locator(".pm-count strong").textContent()), { timeout: 10000 }).toBeGreaterThan(20);
  expect(await page.content()).not.toContain("합성 공개 제목");
});

test("data delay returns the calendar after five seconds and later confirms quietly", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=6&scenario=delay");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  await expect(page.locator(".pm-stage")).toHaveCount(0, { timeout: 14000 });
  await expect(page.locator(".public-event").filter({ hasText: "별빛 우체국" })).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator(".pm-stage")).toHaveCount(0);
});

test("deletion is confirmed and leaves no ghost card or celebration", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=7&scenario=delete");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  await expect(page.locator(".pm-stage")).toHaveCount(0, { timeout: 11000 });
  await expect(page.locator('[data-eventid="00000000-0000-4000-8000-000000000001"]')).toHaveCount(0);
  expect(await page.content()).not.toContain("합성 공개 제목");
});

test("instant publication confirms actual content without waiting for the old T", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=8&scenario=immediate");
  await expect(page.locator(".pm-film.released")).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator(".pm-film.released")).toContainText("별빛 우체국", { timeout: 3000 });
});

test("nearby distinct releases share one stage and each wait for their own T", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=7&count=2&gap=3");
  await expect(page.locator(".pm-film.released")).toHaveCount(1, { timeout: 10000 });
  await expect(page.locator(".pm-film.masked")).toHaveCount(1);
  await expect(page.locator(".pm-film.released")).toHaveCount(2, { timeout: 6000 });
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toHaveCount(1);
});

test("a hidden tab resynchronizes and never replays a missed premiere", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=7");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.waitForTimeout(8500);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".public-event").filter({ hasText: "별빛 우체국" })).toHaveCount(1, { timeout: 6000 });
  await expect(page.locator(".pm-stage")).toHaveCount(0);
});

test("deletion during the reading beat removes the newly released card", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=6&scenario=remove-after");
  await expect(page.locator(".pm-film.released")).toHaveCount(1, { timeout: 9000 });
  await expect(page.locator(".pm-stage")).toHaveCount(0, { timeout: 6000 });
  await expect(page.locator('[data-eventid="00000000-0000-4000-8000-000000000001"]')).toHaveCount(0);
});

test("the actual shared presenter keeps its label below the ring", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=45");
  await expect(page.locator(".pm-count .dt-count-ringbox")).toBeVisible();
  await expect.poll(async () => page.locator(".pm-count").evaluate(el => {
    const ring = el.querySelector(".dt-count-ringbox")!.getBoundingClientRect();
    const label = el.querySelector(".dt-count-label")!.getBoundingClientRect();
    return label.top >= ring.bottom;
  })).toBe(true);
  await expect(page.locator(".pm-count .dt-ring-ticks line")).toHaveCount(12);
});

test("an initial PC clock five minutes ahead still joins after server calibration", async ({ page }) => {
  await page.addInitScript(() => { const original = Date.now; Date.now = () => original() + 300_000; });
  await page.goto("/visual-fixture/poster?premiere=45");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  await expect.poll(async () => Number(await page.locator(".pm-count strong").textContent())).toBeGreaterThan(30);
  expect(await page.content()).not.toContain("합성 공개 제목");
});

test("advancing a distant premiere updates the live screen and reveals at the new T", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=160&scenario=advance");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible({ timeout: 9000 });
  await expect(page.locator(".pm-film.released")).toHaveCount(1, { timeout: 8000 });
});

test("an open settings modal keeps its focus when the schedule is advanced", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=160&scenario=advance");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "설정", exact: true })).toBeVisible();
  await page.waitForTimeout(6000);
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "설정", exact: true })).toBeVisible();
});

test("authoritative re-gating removes the title and allows a new release cycle", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=6&scenario=regate");
  await expect(page.locator(".pm-film.released")).toHaveCount(1, { timeout: 9000 });
  await expect(page.locator(".pm-film.masked")).toHaveCount(1, { timeout: 5000 });
  expect(await page.content()).not.toContain("합성 공개 제목");
  await expect(page.locator(".pm-film.released")).toHaveCount(1, { timeout: 7000 });
});

test("the same rehearsal can be restarted immediately after closing without writes", async ({ page }) => {
  // Explicit rehearsal remains available even when automatic stages are off.
  await page.addInitScript(() => localStorage.setItem("vic.premiereStage", "off"));
  const writes: string[] = []; page.on("request", request => { if (request.method() === "POST") writes.push(request.url()); });
  await page.goto("/visual-fixture/poster?rehearsal=1");
  await page.getByRole("button", { name: "무대 리허설" }).click();
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pm-stage")).toHaveCount(0);
  await page.getByRole("button", { name: "무대 리허설" }).click();
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  expect(writes).toEqual([]);
});

for (const viewport of [{ width: 1440, height: 1200 }, { width: 390, height: 844 }]) {
  test(`developer rehearsal stays below calendar content at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    // Real shared studio-to-viewer wiring; no authenticated session or server writes.
    await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
    await page.route("**/api/public/*/teaser-state**", route => route.fulfill({ json: { ok: true, schemaVersion: 1, sampledAtDbMs: Date.now(), entries: [] } }));
    await page.goto("/visual-fixture/studio?viewer=1&role=developer");
    const button = page.getByRole("button", { name: "무대 리허설", exact: true });
    await expect(button).toBeVisible();
    await button.scrollIntoViewIfNeeded();
    const geometry = await button.evaluate(el => {
      const shell = document.querySelector(".public-calendar-shell")!.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return { top: rect.top, height: rect.height, bottom: shell.bottom, position: style.position, background: style.backgroundColor, inSurface: Boolean(el.closest("[data-export-surface]")) };
    });
    expect(geometry.top).toBeGreaterThanOrEqual(geometry.bottom);
    expect(geometry.height).toBeGreaterThanOrEqual(44);
    expect(["static", "relative"]).toContain(geometry.position);
    expect(geometry.background).toBe("rgba(0, 0, 0, 0)");
    expect(geometry.inSurface).toBe(false);
    if (viewport.width > 1000) expect(await page.locator("[data-export-surface]").evaluate(el => (el as HTMLElement).offsetWidth)).toBe(1840);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.mouse.move(0, 0);
    await page.screenshot({ path: testInfo.outputPath("developer-rehearsal.png"), fullPage: true });
  });
}

test("owner preview and ordinary viewers never receive a rehearsal control", async ({ page }) => {
  await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  for (const path of ["/visual-fixture/studio?viewer=1&role=owner", "/visual-fixture/poster?signedIn=1", "/visual-fixture/poster?signedIn=0"]) {
    await page.goto(path);
    await expect(page.locator(".public-calendar-shell")).toBeVisible();
    await expect(page.getByRole("button", { name: "무대 리허설", exact: true })).toHaveCount(0);
    await expect(page.locator(".pm-rehearsal-tools")).toHaveCount(0);
  }
});

test("the stage preference defaults ON, persists OFF and preserves basic publication", async ({ page }) => {
  await page.goto("/visual-fixture/poster");
  const toggle = await openMotionSettings(page);
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(await openMotionSettings(page)).not.toBeChecked();
  await page.goto("/visual-fixture/poster?premiere=6");
  await expect(page.locator(".public-event").filter({ hasText: "별빛 우체국" })).toHaveCount(1, { timeout: 11000 });
  await expect(page.locator(".pm-stage")).toHaveCount(0);
  await (await openMotionSettings(page)).click();
  await page.goto("/visual-fixture/poster?premiere=45");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
});

test("mobile and preview share the same default-ON stage switch", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/visual-fixture/poster?rehearsal=1");
  const toggle = await openMotionSettings(page);
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  expect(await page.evaluate(() => localStorage.getItem("vic.premiereStage"))).toBe("off");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("turning the stage off in another tab safely returns an active viewer to the calendar", async ({ page, context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await page.goto("/visual-fixture/poster?premiere=45");
  await expect(page.getByRole("dialog", { name: "최초공개 무대" })).toBeVisible();
  const settingsPage = await context.newPage();
  await settingsPage.goto("/visual-fixture/poster");
  await (await openMotionSettings(settingsPage)).click();
  await expect(page.locator(".pm-stage")).toHaveCount(0);
  await expect(page.locator(".poster-page")).not.toHaveAttribute("inert");
  await expect(page.locator(".poster-page")).not.toHaveAttribute("data-premiere");
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});

test("one-second release chains share the large-flash budget in the actual stage", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=7&count=3&gap=1");
  await expect(page.locator(".pm-focused")).toBeVisible();
  await page.evaluate(() => {
    const times: number[] = [];
    (window as typeof window & { premiereFlashTimes: number[] }).premiereFlashTimes = times;
    const stage = document.querySelector(".pm-stage")!;
    let active = false;
    new MutationObserver(() => { const next = stage.classList.contains("pm-bang"); if (next && !active) times.push(performance.now()); active = next; }).observe(stage, { attributes: true, attributeFilter: ["class"] });
  });
  await expect(page.locator(".pm-film.released")).toHaveCount(3, { timeout: 13000 });
  const times = await page.evaluate(() => (window as typeof window & { premiereFlashTimes: number[] }).premiereFlashTimes);
  expect(times.length).toBeGreaterThan(0);
  expect(times.length).toBeLessThanOrEqual(2);
  for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(1400);
});

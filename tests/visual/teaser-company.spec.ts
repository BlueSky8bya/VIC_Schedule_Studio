import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await context.addInitScript(() => {
    (window as typeof window & { __sfxTrace: string[] }).__sfxTrace = [];
    localStorage.setItem("vic.sound", "on"); localStorage.setItem("vic.soundCats", "{}");
  });
});
const trace = (page: import("@playwright/test").Page) => page.evaluate(() => (window as typeof window & { __sfxTrace: string[] }).__sfxTrace.filter(name => name === "premiere-music").length);

for (const width of [1440, 390]) {
  test(`company has distinct live poses and a bounded hope reaction at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/visual-fixture/poster?premiere=40");
    const fans = page.locator(".pm-fan:visible");
    await expect(fans).toHaveCount(width === 390 ? 3 : 6);
    const first = fans.first(); const before = await first.getAttribute("style");
    await expect.poll(() => first.getAttribute("style")).not.toBe(before);
    await expect(page.getByRole("timer")).toHaveCount(1);
    await page.getByRole("button", { name: "기대돼요", exact: true }).click();
    await expect(page.locator('.pm-host[data-reaction="delighted"]')).toBeVisible();
    await expect.poll(() => page.locator(".pm-delighted").evaluate(el => Number(getComputedStyle(el).opacity))).toBe(1);
    await expect(page.locator('.pm-company[data-reaction="delighted"]')).toBeVisible();
    await expect(page.locator(".pm-host")).not.toHaveAttribute("data-reaction", /.+/, { timeout: 3500 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("hope undo shows a brief comic glance without another click or countdown", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=40");
  // A wholly synthetic fixture; all server writes remain intercepted.
  await page.getByRole("button", { name: "기대돼요", exact: true }).click();
  const undo = page.getByRole("button", { name: "함께 기다리는 중", exact: true });
  await expect(undo).toBeVisible(); await undo.click();
  await expect(page.locator('.pm-host[data-reaction="unimpressed"]')).toBeVisible();
  await expect.poll(() => page.locator(".pm-unimpressed").evaluate(el => Number(getComputedStyle(el).opacity))).toBe(1);
  await expect(page.getByRole("timer")).toHaveCount(1);
  await expect(page.locator(".pm-host")).not.toHaveAttribute("data-reaction", /.+/, { timeout: 2500 });
});

test("music requires its own gesture, follows master mute, and cannot leak after exit", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=40");
  await expect(page.getByRole("button", { name: "음악 켜기", exact: true })).toBeVisible();
  expect(await trace(page)).toBe(0);
  await page.getByRole("button", { name: "음악 켜기", exact: true }).click();
  await expect(page.getByRole("button", { name: "음악 끄기", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => trace(page)).toBeGreaterThan(1);
  await page.evaluate(() => { localStorage.setItem("vic.sound", "off"); window.dispatchEvent(new Event("vic:sound")); });
  await expect(page.getByRole("button", { name: "음악 켜기", exact: true })).toBeDisabled();
  const muted = await trace(page); await page.waitForTimeout(1100); expect(await trace(page)).toBe(muted);
  await page.evaluate(() => { localStorage.setItem("vic.sound", "on"); window.dispatchEvent(new Event("vic:sound")); });
  await page.getByRole("button", { name: "음악 켜기", exact: true }).click();
  await expect.poll(() => trace(page)).toBeGreaterThan(muted);
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  await expect(page.locator(".pm-focused")).toHaveCount(0);
  const closed = await trace(page); await page.waitForTimeout(1100); expect(await trace(page)).toBe(closed);
});

test("the audience takes its seat and the final ten seconds retire every auxiliary control and music", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=18");
  await expect.poll(() => page.locator(".pm-stage").evaluate(el => parseFloat((el as HTMLElement).style.getPropertyValue("--pm-settle")))) .toBeGreaterThan(0);
  await page.getByRole("button", { name: "음악 켜기", exact: true }).click();
  await expect.poll(() => trace(page)).toBeGreaterThan(0);
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-quiet", "", { timeout: 10000 });
  await expect(page.locator(".pm-company")).not.toBeVisible();
  await expect(page.locator(".pm-host")).not.toBeVisible();
  await expect(page.locator(".pm-heading")).toHaveAttribute("inert");
  await expect(page.getByRole("button", { name: /음악|기대돼요|응원봉/ })).toHaveCount(0);
  const quiet = await trace(page); await page.waitForTimeout(1250); expect(await trace(page)).toBe(quiet);
  await expect(page.getByRole("timer")).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeFocused();
});

test("graphics off keeps the new crowd out while preserving the real countdown", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=40");
  await page.evaluate(() => { localStorage.setItem("vic.gfxPref", "off"); document.documentElement.dataset.gfx = "off"; });
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-gfx", "off");
  await expect(page.locator(".pm-company")).not.toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(1);
});

test("hidden-tab return and a changed deadline require a fresh music gesture", async ({ page }) => {
  let postpone = false;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(); const snapshot = await response.json();
    if (postpone) for (const item of snapshot.entries) {
      if (item.revealAt) { item.revealAt = new Date(Date.parse(item.revealAt) + 15000).toISOString(); item.event.teaserRevealAt = item.revealAt; }
    }
    await route.fulfill({ json: snapshot });
  });
  await page.goto("/visual-fixture/poster?premiere=35");
  await page.getByRole("button", { name: "음악 켜기", exact: true }).click();
  await expect.poll(() => trace(page)).toBeGreaterThan(0);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  const hidden = await trace(page); await page.waitForTimeout(1000); expect(await trace(page)).toBe(hidden);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.getByRole("button", { name: "음악 켜기", exact: true })).toBeVisible();
  await page.waitForTimeout(900); expect(await trace(page)).toBe(hidden);
  await page.getByRole("button", { name: "음악 켜기", exact: true }).click();
  await expect.poll(() => trace(page)).toBeGreaterThan(hidden);
  postpone = true;
  await expect(page.getByRole("button", { name: "음악 켜기", exact: true })).toBeVisible({ timeout: 3500 });
  const changed = await trace(page); await page.waitForTimeout(1000); expect(await trace(page)).toBe(changed);
});

test("the cheer button plays a local wave without changing hope or sending a write", async ({ page }) => {
  let actions = 0;
  await page.route("**/api/studio-write**", route => { actions++; return route.fulfill({ status: 500 }); });
  await page.goto("/visual-fixture/poster?premiere=40");
  const button = page.getByRole("button", { name: "응원봉 흔들기", exact: true });
  await button.click();
  await expect(page.locator(".pm-company")).toHaveAttribute("data-cheer", "");
  await expect(page.getByRole("button", { name: "기대돼요", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __sfxTrace: string[] }).__sfxTrace.filter(x => x === "sparkle").length)).toBe(1);
  expect(actions).toBe(0);
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  await page.getByRole("button", { name: "최초공개 다시 보기", exact: true }).click();
  await expect(page.locator(".pm-company")).not.toHaveAttribute("data-cheer");
});

test("a blocked AudioContext never reports music playing or retries on its own", async ({ context, page }) => {
  await context.addInitScript(() => {
    Object.defineProperty(AudioContext.prototype, "state", { configurable: true, get: () => "suspended" });
    AudioContext.prototype.resume = () => Promise.reject(new DOMException("Synthetic autoplay block", "NotAllowedError"));
  });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/visual-fixture/poster?premiere=40");
  await page.getByRole("button", { name: "음악 켜기", exact: true }).click();
  await page.waitForTimeout(1400);
  await expect(page.getByRole("button", { name: "음악 켜기", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(await trace(page)).toBe(0); expect(errors).toEqual([]);
});

test("a chained story yields to the next final countdown and becomes readable again", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=5&count=2&gap=4");
  const stories = page.locator(".pm-film.released");
  await expect(stories).toHaveCount(1, { timeout: 8500 });
  await expect(stories.first()).not.toBeVisible();
  await expect(stories.first()).toHaveAttribute("inert");
  await expect(page.getByRole("timer")).toHaveCount(1);
  await expect(page.locator(".pm-stage").getByRole("button")).toHaveCount(1);
  await expect(stories).toHaveCount(2, { timeout: 6500 });
  await expect(stories.first()).toBeVisible();
  await expect(stories.first()).not.toHaveAttribute("inert");
  await expect(stories.first()).not.toHaveAttribute("aria-hidden");
});

test("a quietly held story re-gated into a future countdown regains its hope control", async ({ page }) => {
  let retarget = 0;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(); const data = await response.json();
    if (retarget) data.entries.forEach((item: { state: string; revealAt: string; dateKey: string; event: Record<string, unknown> }, index: number) => {
      item.state = "masked"; item.revealAt = new Date(retarget + index * 6000).toISOString();
      item.event = { ...item.event, publicTitle: "", publicDescription: undefined, startsAt: `${item.dateKey}T00:00:00+09:00`, isAllDay: true, tagIds: [], primaryTagIds: [], teaser: true, teaserRevealAt: item.revealAt };
    });
    await route.fulfill({ response, json: data });
  });
  await page.goto("/visual-fixture/poster?premiere=4&count=2&gap=7");
  await expect(page.locator(".pm-film.released")).toHaveCount(1, { timeout: 8500 });
  await expect(page.locator(".pm-film.released")).toHaveAttribute("inert");
  retarget = Date.now() + 25000;
  await expect(page.locator(".pm-film.masked")).toHaveCount(2, { timeout: 5000 });
  await expect(page.locator(".pm-film.masked").first()).not.toHaveAttribute("inert");
  await expect(page.locator(".pm-film.masked").first()).not.toHaveAttribute("aria-hidden");
  await expect(page.getByRole("button", { name: "기대돼요", exact: true })).toHaveCount(2);
});

test.describe("short touch landscape", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  test("compact cheer/music controls keep their names and clear the numeral", async ({ page }) => {
    await page.goto("/visual-fixture/poster?premiere=40");
    const controls = [page.getByRole("button", { name: "응원봉 흔들기", exact: true }), page.getByRole("button", { name: "음악 켜기", exact: true })];
    const numeral = await page.locator(".dt-count-core").boundingBox();
    for (const control of controls) {
      await expect(control).toBeVisible(); const box = await control.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
      const overlap = box!.x < numeral!.x + numeral!.width && box!.x + box!.width > numeral!.x && box!.y < numeral!.y + numeral!.height && box!.y + box!.height > numeral!.y;
      expect(overlap).toBe(false);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

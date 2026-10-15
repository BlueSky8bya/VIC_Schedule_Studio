import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await context.addInitScript(() => {
    (window as typeof window & { __sfxTrace: string[] }).__sfxTrace = [];
    localStorage.setItem("vic.sound", "on"); localStorage.setItem("vic.soundCats", "{}");
  });
});
const trace = (page: Page) => page.evaluate(() => (window as typeof window & { __sfxTrace: string[] }).__sfxTrace.filter(name => name === "premiere-music").length);
const unlock = (page: Page) => page.locator(".pm-count").click();
const tracks = (page: Page) => page.evaluate(() => (window as typeof window & { __sfxTrace: string[] }).__sfxTrace.filter(name => name.startsWith("premiere-track:")));

test("each new opening picks a different score without adding music controls", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=50"); await unlock(page);
  await expect.poll(async () => (await tracks(page)).length).toBe(1);
  const first = (await tracks(page))[0];
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  await page.getByRole("button", { name: "최초공개 다시 보기", exact: true }).click();
  await expect.poll(async () => (await tracks(page)).length).toBe(2);
  expect((await tracks(page))[1]).not.toBe(first);
  await expect(page.getByRole("button", { name: /음악/ })).toHaveCount(0);
});

for (const width of [1440, 390]) {
  test(`drawn audience animates without covering hope controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/visual-fixture/poster?premiere=40");
    const fans = page.locator(".pm-fan:visible");
    await expect(fans).toHaveCount(6);
    const first = fans.first(); const before = await first.getAttribute("data-frame");
    await expect.poll(() => first.getAttribute("data-frame")).not.toBe(before);
    await expect.poll(() => first.evaluate(el => Boolean(el.closest("[aria-hidden='true']")))).toBe(false);
    expect(await page.locator(".pm-screen").evaluate(el => el.getAnimations().some(a => a instanceof CSSAnimation && a.animationName === "pm-screen-in" && a.playState === "running"))).toBe(false);
    await expect(page.getByRole("button", { name: /음악|응원봉 흔들기/ })).toHaveCount(0);
    const hope = page.getByRole("button", { name: "기대돼요", exact: true });
    const box = (await hope.boundingBox())!;
    for (const fan of await fans.all()) {
      const f = (await fan.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(f.y);
      expect(f.width).toBeGreaterThanOrEqual(44); expect(f.height).toBeGreaterThanOrEqual(44);
    }
    await hope.click();
    await expect(page.locator(".pm-wish-photo")).toHaveAttribute("data-visible", "");
    await expect(page.locator(".pm-wish-photo")).toHaveAttribute("data-visible", "");
    await expect(page.locator(".pm-wish-photo")).toHaveAttribute("src", "/premiere/victory-wish.webp");
    await page.waitForTimeout(2300);
    await expect(page.locator(".pm-wish-photo")).toHaveAttribute("data-visible", "");
    await expect(page.getByRole("timer")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("hope undo quietly removes the original backdrop and keeps one countdown", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=40");
  await page.getByRole("button", { name: "기대돼요", exact: true }).click();
  await page.getByRole("button", { name: "함께 기다리는 중", exact: true }).click();
  await expect(page.locator(".pm-wish-photo")).not.toHaveAttribute("data-visible");
  await expect(page.locator(".pm-wish-photo")).not.toHaveAttribute("data-visible");
  await page.waitForTimeout(1800);
  await expect(page.locator(".pm-wish-photo")).toHaveCSS("opacity", "0");
  await expect(page.getByRole("timer")).toHaveCount(1);
});

test("an unlocked viewer starts music when the stage opens without a music button", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=74");
  await page.locator(".pm-banner").click({ position: { x: 30, y: 20 } });
  await expect(page.locator(".pm-focused")).toHaveCount(1, { timeout: 12000 });
  await expect.poll(() => trace(page)).toBeGreaterThan(1);
  await expect(page.getByRole("button", { name: /음악/ })).toHaveCount(0);
});

test("default music follows master volume, mute/category and exit", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("vic.soundVol", "25");
    const values: number[] = []; (window as typeof window & { __gainValues: number[] }).__gainValues = values;
    const original = AudioParam.prototype.setTargetAtTime;
    AudioParam.prototype.setTargetAtTime = function(value, start, constant) { values.push(value); return original.call(this, value, start, constant); };
  });
  await page.goto("/visual-fixture/poster?premiere=40"); await unlock(page);
  await expect.poll(() => trace(page)).toBeGreaterThan(1);
  expect(await page.evaluate(() => (window as typeof window & { __gainValues: number[] }).__gainValues.some(value => Math.abs(value - Math.pow(.25, 1.6) * .55) < .00001))).toBe(true);
  for (const setting of ["mute", "zero", "category"]) {
    await page.evaluate(key => {
      localStorage.setItem("vic.sound", key === "mute" ? "off" : "on");
      localStorage.setItem("vic.soundVol", key === "zero" ? "0" : "25");
      localStorage.setItem("vic.soundCats", JSON.stringify({ celebrate: key !== "category" }));
      window.dispatchEvent(new Event("vic:sound"));
    }, setting);
    const muted = await trace(page); await page.waitForTimeout(800); expect(await trace(page)).toBe(muted);
  }
  await page.evaluate(() => { localStorage.setItem("vic.soundCats", "{}"); window.dispatchEvent(new Event("vic:sound")); });
  const before = await trace(page); await expect.poll(() => trace(page)).toBeGreaterThan(before);
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  const closed = await trace(page); await page.waitForTimeout(1000); expect(await trace(page)).toBe(closed);
});

test("turned spectators quietly gather after ten, then stay still before eight without controls or music", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=18");
  await page.getByRole("button", { name: "빅타민 1 응원하기", exact: true }).click();
  await expect.poll(() => trace(page)).toBeGreaterThan(0);
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-quiet", "", { timeout: 10000 });
  await expect(page.locator(".pm-company")).toBeVisible();
  await expect(page.locator(".pm-host")).not.toBeVisible();
  await expect(page.getByRole("button", { name: /빅타민|기대돼요|음악/ })).toHaveCount(0);
  const first = page.locator(".pm-fan").first();
  await expect(first).toHaveAttribute("data-frame", "15");
  await expect(first).toHaveAttribute("inert");
  const quiet = await trace(page), startX = await first.evaluate(el => el.getBoundingClientRect().x);
  await expect.poll(() => first.evaluate(el => el.getBoundingClientRect().x)).toBeGreaterThan(startX + 5);
  await expect.poll(() => first.evaluate(el => parseFloat(el.style.getPropertyValue("--fan-depth")))) .toBe(.86);
  await page.waitForTimeout(400);
  const style = await first.getAttribute("style");
  await page.waitForTimeout(1000); expect(await trace(page)).toBe(quiet);
  expect(await first.getAttribute("style")).toBe(style);
  await expect(page.getByRole("timer")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeFocused();
});

test("graphics lite reduces actors and graphics off hides them", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=40");
  await page.evaluate(() => { localStorage.setItem("vic.gfxPref", "lite"); document.documentElement.dataset.gfx = "lite"; });
  await expect(page.locator(".pm-fan:visible")).toHaveCount(3);
  await page.evaluate(() => { localStorage.setItem("vic.gfxPref", "off"); document.documentElement.dataset.gfx = "off"; });
  await expect(page.locator(".pm-company")).not.toBeVisible();
  await expect(page.getByRole("timer")).toHaveCount(1);
});

test("hidden return and a changed deadline start fresh default sessions", async ({ page }) => {
  let postpone = false;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(); const snapshot = await response.json();
    if (postpone) for (const item of snapshot.entries) {
      if (item.revealAt) { item.revealAt = new Date(Date.parse(item.revealAt) + 15000).toISOString(); item.event.teaserRevealAt = item.revealAt; }
    }
    await route.fulfill({ json: snapshot });
  });
  await page.goto("/visual-fixture/poster?premiere=35"); await unlock(page);
  await expect.poll(() => trace(page)).toBeGreaterThan(0);
  const firstTrack = (await tracks(page))[0];
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  const hidden = await trace(page); await page.waitForTimeout(900); expect(await trace(page)).toBe(hidden);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect.poll(() => trace(page)).toBeGreaterThan(hidden);
  expect(new Set(await tracks(page))).toEqual(new Set([firstTrack]));
  const oldTarget = await page.locator(".pm-stage").getAttribute("data-teaser-at");
  postpone = true;
  await expect.poll(() => page.locator(".pm-stage").getAttribute("data-teaser-at")).not.toBe(oldTarget);
  const changed = await trace(page); await expect.poll(() => trace(page)).toBeGreaterThan(changed);
});

test("clicking/keyboard cheering keeps its node/focus and never writes hope", async ({ page }) => {
  let actions = 0;
  await page.route("**/api/studio-write*", route => { actions++; return route.fulfill({ status: 500 }); });
  await page.goto("/visual-fixture/poster?premiere=40");
  const fan = page.getByRole("button", { name: "빅타민 1 응원하기", exact: true });
  await expect(page.locator(".pm-stage")).not.toHaveAttribute("data-pm-entering");
  await fan.evaluate(el => el.setAttribute("data-node-probe", "kept"));
  await fan.focus(); await page.keyboard.press("Enter");
  await expect(fan).toBeFocused(); await expect(fan).toHaveAttribute("data-node-probe", "kept");
  await expect(page.locator(".pm-company")).toHaveAttribute("data-cheer", "");
  await expect(page.getByRole("button", { name: "기대돼요", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(actions).toBe(0);
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  await page.getByRole("button", { name: "최초공개 다시 보기", exact: true }).click();
  await expect(page.locator(".pm-company")).not.toHaveAttribute("data-cheer");
});

test("blocked autoplay waits without retry storms and cannot start on an exit gesture", async ({ context, page }) => {
  await context.addInitScript(() => {
    (window as typeof window & { __resumeCount: number }).__resumeCount = 0;
    Object.defineProperty(AudioContext.prototype, "state", { configurable: true, get: () => "suspended" });
    AudioContext.prototype.resume = () => { (window as typeof window & { __resumeCount: number }).__resumeCount++; return Promise.reject(new DOMException("Synthetic autoplay block", "NotAllowedError")); };
  });
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  await page.goto("/visual-fixture/poster?premiere=40");
  await page.waitForTimeout(1400);
  const attempts = await page.evaluate(() => (window as typeof window & { __resumeCount: number }).__resumeCount);
  expect(attempts).toBeGreaterThan(0);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => (window as typeof window & { __resumeCount: number }).__resumeCount)).toBe(attempts);
  await unlock(page); await page.waitForTimeout(1200);
  expect(await page.evaluate(() => (window as typeof window & { __resumeCount: number }).__resumeCount)).toBe(attempts + 1);
  await page.keyboard.down("a"); await page.keyboard.down("a"); await page.keyboard.down("a"); await page.keyboard.up("a");
  expect(await page.evaluate(() => (window as typeof window & { __resumeCount: number }).__resumeCount)).toBe(attempts + 2);
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
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
  test("direct audience targets keep44px and clear every hope control", async ({ page }) => {
    await page.goto("/visual-fixture/poster?premiere=40&count=3");
    const controls = page.getByRole("button", { name: "기대돼요", exact: true });
    const fans = page.locator(".pm-fan:visible");
    await expect(fans).toHaveCount(6);
    for (const fan of await fans.all()) {
      await expect(fan).toBeInViewport();
      const f = (await fan.boundingBox())!;
      expect(f.width).toBeGreaterThanOrEqual(44); expect(f.height).toBeGreaterThanOrEqual(44);
      for (const control of await controls.all()) {
        const c = (await control.boundingBox())!;
        expect(c.y + c.height).toBeLessThanOrEqual(f.y);
      }
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});

import { expect, test, type Page } from "@playwright/test";
import { premiereAudienceTiming } from "@/lib/ui/premiere/company";

const audienceAssets = new WeakMap<Page, string[]>();
test.beforeEach(async ({ context, page }) => {
  const assets: string[] = []; audienceAssets.set(page, assets);
  page.on("request", request => { const path = new URL(request.url()).pathname; if (/^\/premiere\/victamin-audience(?:-[a-z0-9-]+)?\.webp$/.test(path) || path.startsWith("/companion/")) assets.push(path); });
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await context.addInitScript(() => {
    const win = window as typeof window & { audienceMounted: boolean; __sfxTrace: string[] };
    win.audienceMounted = false; win.__sfxTrace = []; localStorage.setItem("vic.sound", "on");
    new MutationObserver(records => { if (records.some(record => [...record.addedNodes].some(node => node instanceof Element && (node.matches(".pm-cast-row,.pm-company,.pm-fan") || node.querySelector(".pm-cast-row,.pm-company,.pm-fan"))))) win.audienceMounted = true; }).observe(document, { childList: true, subtree: true });
  });
});
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "wait" }); });

async function opened(page: Page, count = 1, seconds = 40, gap = 0) {
  await page.goto(`/visual-fixture/poster?premiere=${seconds}&count=${count}&gap=${gap}`);
  await expect(page.locator(".pm-focused")).toBeVisible();
  if (seconds > 22) await expect(page.locator(".pm-screen")).toHaveAttribute("data-pm-entered", "", { timeout: 8000 });
  await expect(page.locator(".pm-stage")).not.toHaveAttribute("data-pm-entering");
}

async function noMobileAudience(page: Page) {
  await expect(page.locator(".pm-cast-row,.pm-company,.pm-fan")).toHaveCount(0);
  expect(await page.evaluate(() => (window as typeof window & { audienceMounted: boolean }).audienceMounted)).toBe(false);
  expect(audienceAssets.get(page)).toEqual([]);
}

async function layout(page: Page) {
  return page.locator(".pm-stage").evaluate(el => {
    const viewport = { width: Math.min(document.documentElement.clientWidth, visualViewport?.width ?? innerWidth), height: Math.min(document.documentElement.clientHeight, visualViewport?.height ?? innerHeight) };
    const box = (node: Element) => { const rect = node.getBoundingClientRect(); return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }; };
    const screen = el.querySelector<HTMLElement>(".pm-screen")!;
    return { viewport, screen: box(screen), scroll: screen.scrollHeight - screen.clientHeight, width: document.documentElement.scrollWidth,
      fans: [...el.querySelectorAll<HTMLElement>(".pm-fan")].filter(node => getComputedStyle(node).display !== "none").map(node => ({ ...box(node), artWidth: node.querySelector(".pm-fan-art")!.getBoundingClientRect().width })),
      clock: box(el.querySelector(".pm-count")!), controls: [...el.querySelectorAll(".pm-hope")].map(box), header: box(el.querySelector(".pm-heading")!), exit: box(el.querySelector(".pm-banner-focused")!) };
  });
}

test.describe("native agenda without audience", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  for (const count of [1, 2, 3, 5]) {
    test(`${count} pending events keep their clock and controls without mounting spectators`, async ({ page }) => {
      await opened(page, count);
      await noMobileAudience(page);
      const metrics = await layout(page);
      expect(metrics.viewport).toEqual({ width: 390, height: 844 });
      expect(metrics.width).toBeLessThanOrEqual(390); expect(metrics.scroll).toBeLessThanOrEqual(2);
      expect(metrics.fans).toHaveLength(0);
      expect(metrics.clock.top).toBeGreaterThanOrEqual(metrics.header.bottom); expect(metrics.clock.bottom).toBeLessThanOrEqual(metrics.viewport.height);
      expect(metrics.header.top).toBeGreaterThanOrEqual(0); expect(metrics.exit.bottom).toBeLessThanOrEqual(metrics.screen.top);
      for (const control of await page.locator(".pm-hope").all()) await expect(control).toBeInViewport({ ratio: 1 });
      await page.locator(".pm-hope").last().tap();
      await expect(page.locator(".pm-hope").last()).toHaveAttribute("aria-pressed", "true");
      if (count === 1) {
        const before = await page.getByRole("timer").textContent();
        await expect.poll(() => page.getByRole("timer").textContent()).not.toBe(before);
        await expect.poll(() => page.evaluate(() => (window as typeof window & { __sfxTrace: string[] }).__sfxTrace.filter(name => name === "premiere-music").length)).toBeGreaterThan(0);
      }
      await noMobileAudience(page);
      await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: `.scratch-pw/companion-063-audience-390-${count}.png` });
      console.log("audience-native-layout", JSON.stringify({ count, ...metrics }));
    });
  }
  test("a partial release keeps its reading scroller while the next clock stays visible", async ({ page }) => {
    const tagIds = ["tag-worldcup", "tag-collab", "tag-big-server", "tag-full-track", "tag-calm", "tag-variety-game", "tag-song", "tag-ck"];
    const publicBody = "공개된 본문은 다음 일정을 기다리는 동안에도 보존됩니다.";
    await page.route("**/api/visual-fixture/premiere**", async route => {
      const response = await route.fetch(), snapshot = await response.json();
      for (const item of snapshot.entries) if (item.state === "released") { item.event.publicDescription = publicBody; item.event.tagIds = tagIds; }
      await route.fulfill({ response, json: snapshot });
    });
    await opened(page, 2, 5, 5);
    expect(await page.content()).not.toContain(publicBody);
    // The fixture supports real5s chain spacing; preserve the existing final
    // numeral priority while the released story remains complete in the DOM.
    await expect(page.locator(".pm-film.released")).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator(".pm-film.masked")).toHaveCount(1);
    await expect(page.locator(".pm-film.released .pm-tags span")).toHaveCount(8);
    await expect(page.locator(".pm-film.released .pm-details")).toHaveText(publicBody);
    await expect(page.locator(".pm-count")).toBeInViewport({ ratio: 1 });
    expect(await page.locator(".pm-screen").evaluate(el => getComputedStyle(el).overflowY)).toBe("auto");
    await noMobileAudience(page);
    await expect(page.locator(".pm-complete")).toBeVisible({ timeout: 10000 });
    await expect(page.locator(".pm-tags span")).toHaveCount(16);
    for (const tag of await page.locator(".pm-tags span").all()) { await tag.scrollIntoViewIfNeeded(); await expect(tag).toBeInViewport({ ratio: 1 }); }
    await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await noMobileAudience(page);
    await page.screenshot({ path: ".scratch-pw/companion-063-audience-mixed-390.png" });
  });
});

test.describe("short native landscape without audience", () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  test("the clock and all five controls stay reachable without spectator DOM or assets", async ({ page }) => {
    await opened(page, 5);
    await noMobileAudience(page);
    const metrics = await layout(page);
    expect(metrics.viewport).toEqual({ width: 844, height: 390 });
    expect(metrics.width).toBeLessThanOrEqual(844); expect(metrics.fans).toHaveLength(0);
    expect(metrics.clock.top).toBeGreaterThanOrEqual(0); expect(metrics.clock.bottom).toBeLessThanOrEqual(390);
    const controls = page.locator(".pm-hope");
    for (const control of await controls.all()) {
      await control.scrollIntoViewIfNeeded(); await expect(control).toBeInViewport({ ratio: 1 }); await control.tap();
      await expect(control).toHaveAttribute("aria-pressed", "true");
    }
    await noMobileAudience(page);
    await page.screenshot({ path: ".scratch-pw/companion-063-audience-844-5.png" });
    console.log("audience-landscape-layout", JSON.stringify(metrics));
  });
});

test("an opening keeps independent scores, body size and native focus through hope renders", async ({ page }) => {
  await opened(page, 2);
  const company = page.locator(".pm-company"), fans = page.locator(".pm-fan"), first = fans.first();
  const opening = await company.getAttribute("data-opening");
  const seeds = await fans.evaluateAll(els => els.map(el => (el as HTMLElement).style.getPropertyValue("--fan-seed")));
  expect(new Set(seeds).size).toBe(6);
  await first.evaluate(el => { (window as typeof window & { audienceButton: Element }).audienceButton = el; });
  const frames = await fans.evaluateAll(els => els.map(el => el.getAttribute("data-frame")));
  await expect.poll(() => fans.evaluateAll(els => els.map(el => el.getAttribute("data-frame")))).not.toEqual(frames);
  await page.locator(".pm-hope").first().click(); await first.focus();
  await expect(first).toBeFocused(); await expect(company).toHaveAttribute("data-opening", opening!);
  expect(await fans.evaluateAll(els => els.map(el => (el as HTMLElement).style.getPropertyValue("--fan-seed")))).toEqual(seeds);
  expect(await first.evaluate(el => el === (window as typeof window & { audienceButton: Element }).audienceButton)).toBe(true);
  const widths = await fans.locator(".pm-fan-art").evaluateAll(els => els.map(el => el.getBoundingClientRect().width));
  expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(.05);
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  await page.getByRole("button", { name: "최초공개 다시 보기", exact: true }).click();
  await expect(company).not.toHaveAttribute("data-opening", opening!);
  console.log("audience-opening", JSON.stringify({ opening, seeds, widths }));
});

test("individual turns finish before quiet, seats stop beforeeight and backs vanish byone", async ({ page }) => {
  test.setTimeout(30000);
  await opened(page, 1, 18);
  const stage = page.locator(".pm-stage"), fans = page.locator(".pm-fan"), company = page.locator(".pm-company");
  await fans.first().focus();
  const turnStarts = (await fans.evaluateAll(els => els.map(el => Number((el as HTMLElement).style.getPropertyValue("--fan-seed"))))).map(seed => premiereAudienceTiming(seed).turnStart * 1000);
  const turnTimes = await page.evaluate(() => new Promise<number[]>(resolve => {
    const fans = [...document.querySelectorAll<HTMLElement>(".pm-fan")], times = fans.map(() => 0);
    const sample = () => {
      fans.forEach((fan, index) => { if (!times[index] && Number(fan.dataset.frame) >= 12) times[index] = performance.now(); });
      if (times.every(Boolean)) resolve(times); else requestAnimationFrame(sample);
    };
    sample();
  }));
  // A legitimate random draw can put two starts close together. Compare the
  // actual spread with its own fixed score, allowing two100ms clock samples.
  expect(Math.abs((Math.max(...turnTimes) - Math.min(...turnTimes)) - (Math.max(...turnStarts) - Math.min(...turnStarts)))).toBeLessThan(250);
  await expect(stage).toHaveAttribute("data-pm-quiet", "");
  for (const fan of await fans.all()) { await expect(fan).toHaveAttribute("data-frame", "15"); await expect(fan).toHaveAttribute("inert"); }
  await expect(page.getByRole("button", { name: "일정표 보기", exact: true })).toBeFocused();
  await expect(stage).toHaveAttribute("data-pm-seated", "", { timeout: 5000 });
  const seated = await fans.evaluateAll(els => els.map(el => ({ rect: el.getBoundingClientRect().toJSON(), frame: el.getAttribute("data-frame") })));
  await page.waitForTimeout(500);
  expect(await fans.evaluateAll(els => els.map(el => ({ rect: el.getBoundingClientRect().toJSON(), frame: el.getAttribute("data-frame") })))).toEqual(seated);
  await expect(company).toHaveCSS("opacity", "0", { timeout: 10000 });
  const remaining = await stage.getAttribute("data-teaser-at");
  expect(Date.parse(remaining!) - Date.now()).toBeGreaterThan(1000);
  await expect(page.getByRole("timer")).toHaveCount(1);
  await page.screenshot({ path: ".scratch-pw/companion-063-audience-quiet.png" });
  console.log("audience-quiet", JSON.stringify({ turnTimes, turnStarts, seated, remaining }));
});

import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await context.addInitScript(() => { localStorage.setItem("vic.gfxPref", "max"); });
});

for (const width of [1440, 390]) for (const count of [1, 3]) {
  test(`${count} source cards meet before a single screen grows at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(`/visual-fixture/poster?premiere=40&count=${count}`);
    await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-entry", "gather");
    await expect(page.locator(".pm-card-transfer[data-active]")).toHaveCount(count);
    await page.evaluate(() => {
      const stage = document.querySelector<HTMLElement>(".pm-stage")!;
      const samples: { phase?: string; centers: number[]; sizes: number[]; planeArea: number; ink: number }[] = [];
      (window as typeof window & { entrySamples: typeof samples }).entrySamples = samples;
      const read = () => {
        const cards = [...document.querySelectorAll<HTMLElement>(".pm-card-transfer[data-active]")].map(el => el.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
        const plane = document.querySelector(".pm-entry-plane")!.getBoundingClientRect();
        samples.push({ phase: stage.dataset.pmEntry, centers: cards.map(r => Math.hypot(r.x + r.width / 2 - innerWidth / 2, r.y + r.height / 2 - innerHeight / 2)), sizes: cards.map(r => r.width * r.height), planeArea: plane.width * plane.height, ink: Number(getComputedStyle(document.querySelector(".pm-composition")!).opacity) });
      };
      read(); new MutationObserver(read).observe(stage, { attributes: true, attributeFilter: ["data-pm-entry"] });
    });
    await expect(page.locator(".pm-stage")).not.toHaveAttribute("data-pm-entering", "", { timeout: 5000 });
    const samples = await page.evaluate(() => (window as typeof window & { entrySamples: { phase?: string; centers: number[]; sizes: number[]; planeArea: number; ink: number }[] }).entrySamples);
    const merged = samples.find(sample => sample.phase === "merge")!;
    expect(merged).toBeTruthy(); expect(Math.max(...merged.centers)).toBeLessThan(60);
    expect(merged.planeArea).toBe(0); expect(merged.ink).toBe(0);
    const unfolded = samples.find(sample => sample.phase === "unfold")!;
    expect(Math.max(...unfolded.centers)).toBeLessThan(2);
    expect(unfolded.planeArea).toBeGreaterThan(0);
    expect(unfolded.planeArea).toBeLessThan(merged.sizes[0] * 1.25);
    await expect(page.getByRole("timer")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "기대돼요", exact: true })).toHaveCount(count);
    if (width === 1440) expect(await page.locator("[data-export-surface]").evaluate(el => (el as HTMLElement).offsetWidth)).toBe(1840);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
  });
}

test("publication during convergence cancels the journey and keeps confirmed reading", async ({ page }) => {
  let release = false;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(), data = await response.json();
    if (release) for (const item of data.entries) { item.state = "released"; item.event = { ...item.event, publicTitle: "합성 진입 중 공개", teaser: undefined, teaserRevealAt: undefined }; }
    await route.fulfill({ response, json: data });
  });
  await page.goto("/visual-fixture/poster?premiere=40");
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-entry", "gather");
  release = true;
  await expect(page.locator(".pm-story h2")).toHaveText("합성 진입 중 공개", { timeout: 3000 });
  await expect(page.locator(".pm-entry")).not.toHaveAttribute("data-active");
  await expect(page.locator(".pm-complete")).toBeVisible();
  await expect(page.getByRole("button", { name: "계속 읽기", exact: true })).toBeEnabled();
});

test("a changed deadline, hidden tab and resize clear transient entry state", async ({ page }) => {
  let target = 0;
  await page.route("**/api/visual-fixture/premiere**", async route => {
    const response = await route.fetch(), data = await response.json();
    if (target) for (const item of data.entries) { item.revealAt = new Date(target).toISOString(); item.event.teaserRevealAt = item.revealAt; }
    await route.fulfill({ response, json: data });
  });
  await page.goto("/visual-fixture/poster?premiere=40");
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-entry", "gather");
  target = Date.now() + 50000;
  await expect(page.locator(".pm-stage")).not.toHaveAttribute("data-pm-entering", "", { timeout: 2500 });
  await page.goto("/visual-fixture/poster?premiere=40");
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-entry", "gather");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".pm-entry")).not.toHaveAttribute("data-active");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await page.goto("/visual-fixture/poster?premiere=40");
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-entry", "gather");
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator(".pm-entry")).not.toHaveAttribute("data-active");
  await expect(page.getByRole("timer")).toHaveCount(1);
});

test("late arrival skips travel and graphics downgrade cancels it", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=19");
  await expect(page.getByRole("timer")).toHaveCount(1);
  await expect(page.locator(".pm-screen")).not.toHaveAttribute("data-pm-morph");
  await page.goto("/visual-fixture/poster?premiere=40");
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-entry", "gather");
  await page.evaluate(() => { localStorage.setItem("vic.gfxPref", "off"); document.documentElement.dataset.gfx = "off"; });
  await expect(page.locator(".pm-entry")).not.toHaveAttribute("data-active");
  await expect(page.getByRole("timer")).toHaveCount(1);
});

test("Escape during the journey restores the calendar and allows a fresh opening", async ({ page }) => {
  await page.goto("/visual-fixture/poster?premiere=40");
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-entry", "gather");
  await page.keyboard.press("Escape");
  await expect(page.locator(".poster-page")).not.toHaveAttribute("inert");
  await page.getByRole("button", { name: "최초공개 다시 보기", exact: true }).click();
  await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-entry", "gather");
  await expect(page.locator(".pm-stage")).not.toHaveAttribute("data-pm-entering", "", { timeout: 5000 });
  await expect(page.getByRole("timer")).toHaveCount(1);
});

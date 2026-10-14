import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page, context }) => {
  await context.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

async function open(page: Page, seconds: number, options = "") {
  await page.goto(`/visual-fixture/poster?premiere=${seconds}${options}`);
  await expect(page.locator(".pm-stage")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  if (await page.locator(".pm-screen").count()) {
    await expect(page.locator(".pm-stage")).not.toHaveAttribute("data-pm-entering", "", { timeout: 6000 });
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
  const readout = page.locator("[data-pm-target] .teaser-count");
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

test("cards leave in shuffled individual slots while date cells stay still", async ({ page }) => {
  await open(page, 100, "&links=1");
  const cards = page.locator("[data-pm-depart]");
  await expect.poll(() => cards.count()).toBeGreaterThan(5);
  await expect.poll(() => cards.evaluateAll(els => els.some(el => Number(getComputedStyle(el).opacity) < .01))).toBe(true);
  const values = await cards.evaluateAll(els => els.map(el => ({ opacity: Number(getComputedStyle(el).opacity), kind: el.getAttribute("data-pm-depart"), id: el.getAttribute("data-eventid") ?? el.getAttribute("data-supportid") })));
  expect(values.some(item => item.opacity < .01)).toBe(true);
  expect(values.some(item => item.opacity > .99)).toBe(true);
  expect(new Set(values.map(item => item.kind)).size).toBe(4);
  for (const item of values) expect(values.filter(other => other.id === item.id).every(other => other.kind === item.kind && Math.abs(other.opacity - item.opacity) < .01)).toBe(true);
  expect(await page.locator(".public-day").evaluateAll(els => els.every(el => getComputedStyle(el).opacity === "1" && getComputedStyle(el).transform === "none"))).toBe(true);
  await expect(page.locator("[data-pm-target]")).toHaveCount(1);
  expect(await page.locator("[data-pm-target]").evaluate(el => getComputedStyle(el).visibility)).toBe("visible");
});

for (const width of [1440, 390]) {
  test(`only the premiere remains by T−75 and its visible card becomes the screen at ${width}px`, async ({ page }) => {
    test.setTimeout(20000);
    await page.setViewportSize({ width, height: 1000 });
    await open(page, 76, "&links=1");
    const target = page.locator("[data-pm-target]");
    await target.evaluate(el => el.scrollIntoView({ block: "center" }));
    await expect.poll(() => page.locator("[data-pm-depart]").evaluateAll(els => els.every(el => Number(getComputedStyle(el).opacity) < .01)), { timeout: 3000 }).toBe(true);
    expect(await target.evaluate(el => getComputedStyle(el).visibility)).toBe("visible");
    await expect(page.locator(".pm-screen")).toHaveAttribute("data-pm-morph", "card", { timeout: 10000 });
    await page.locator(".pm-count .dt-ring").evaluate(el => el.dispatchEvent(new TransitionEvent("transitionend", { bubbles: true, propertyName: "stroke-dashoffset" })));
    await expect(page.locator(".pm-stage")).toHaveAttribute("data-pm-entry", "gather");
    expect(await page.locator(".pm-card-transfer[data-active]").first().evaluate(el => (el as HTMLElement).style.transition)).toContain("1700ms");
    const matrix = await page.locator(".pm-screen").evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
    expect(matrix).toBeGreaterThan(.95); expect(matrix).toBeLessThanOrEqual(1);
    await expect(page.locator(".pm-count .dt-count-core")).toBeVisible();
    await expect.poll(() => page.locator(".pm-screen").evaluate(el => getComputedStyle(el).transform)).toBe("none");
    await page.keyboard.press("Escape");
    await expect(page.locator(".poster-page")).not.toHaveAttribute("inert");
    await expect(page.locator("[data-pm-depart]")).toHaveCount(0);
  });

  test(`ON locks unrelated cards, hearts, support links and day navigation; dismissal restores them at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await open(page, 170, "&links=1");
    const card = page.locator('[data-eventid="evt-001"]').first();
    await expect(card).toHaveAttribute("inert");
    // Programmatic activation bypasses hit testing; capture also guards day
    // backgrounds and delegated React handlers. No detail/navigation may open.
    const activated = await page.locator(".public-day,.agenda-day").evaluateAll(days => {
      let blocked = 0;
      for (const day of days) {
        const e = new MouseEvent("click", { bubbles: true, cancelable: true });
        if (!day.dispatchEvent(e)) blocked++;
      }
      return blocked;
    });
    expect(activated).toBeGreaterThan(0);
    await card.evaluate(el => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })); });
    await expect(page.locator(".agenda-detail-backdrop")).toHaveCount(0);
    expect(await card.evaluate(el => { (el as HTMLElement).focus(); return document.activeElement === el; })).toBe(false);
    await expect(page.locator("[data-pm-target]")).not.toHaveAttribute("inert");
    await expect(page.getByRole("button", { name: "설정", exact: true })).toBeEnabled();
    await expect(page.locator('[data-act="다음 달"]')).toHaveAttribute("inert");
    await page.keyboard.press("ArrowRight");
    await expect(page.locator(".pm-stage")).toBeVisible();
    await expect(page.locator("[data-pm-target]")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.locator(".pm-stage")).toHaveCount(0);
    await expect(card).not.toHaveAttribute("inert");
    await expect(page.locator('[data-act="다음 달"]')).not.toHaveAttribute("inert");
    await card.click();
    await expect(page.locator(".agenda-detail-backdrop")).toHaveCount(1);
  });
}

test("OFF and reduced motion release every calendar interaction gate during preparation", async ({ page, context }) => {
  await open(page, 170, "&links=1");
  await expect(page.locator('[data-eventid="evt-001"]')).toHaveAttribute("inert");
  await page.evaluate(() => document.documentElement.setAttribute("data-reduce-motion", "1"));
  await expect(page.locator(".pm-stage")).toHaveCount(0);
  await expect(page.locator('[data-eventid="evt-001"]')).not.toHaveAttribute("inert");
  await page.evaluate(() => document.documentElement.removeAttribute("data-reduce-motion"));
  // Reduced motion intentionally enters the existing cooldown. A new page
  // observes a fresh fixture rather than asserting an unwanted auto-reentry.
  await open(page, 170, "&links=1");
  const other = await context.newPage();
  await other.goto("/visual-fixture/poster");
  await other.getByRole("button", { name: "설정", exact: true }).click();
  const motion = other.getByRole("tab", { name: "움직임", exact: true });
  if (await motion.isVisible()) await motion.click();
  await other.getByRole("switch", { name: "최초공개 무대 켜기/끄기", exact: true }).click();
  await expect(page.locator(".pm-stage")).toHaveCount(0);
  await expect(page.locator('[data-eventid="evt-001"]')).not.toHaveAttribute("inert");
  await expect(page.locator("[data-pm-depart]")).toHaveCount(0);
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

test("late calendar segments keep their event's slot and new schedules inherit the current deadline", async ({ page }) => {
  await open(page, 74, "&links=1");
  await page.locator('[data-eventid="evt-001"]').evaluate(el => {
    const otherDay = document.querySelectorAll(".day-events")[3];
    const segment = el.cloneNode(true) as HTMLElement;
    segment.classList.add("synthetic-segment");
    segment.removeAttribute("inert"); segment.removeAttribute("data-pm-depart");
    otherDay.append(segment);
    const fresh = el.cloneNode(true) as HTMLElement;
    fresh.dataset.eventid = "synthetic-late";
    fresh.removeAttribute("inert"); fresh.removeAttribute("data-pm-depart");
    otherDay.append(fresh);
  });
  await expect(page.locator(".synthetic-segment")).toHaveAttribute("inert");
  const original = page.locator('[data-eventid="evt-001"]').first();
  expect(await page.locator(".synthetic-segment").getAttribute("data-pm-depart")).toBe(await original.getAttribute("data-pm-depart"));
  await expect.poll(() => page.locator('[data-eventid="synthetic-late"]').evaluate(el => Number(getComputedStyle(el).opacity))).toBeLessThan(.01);
  await expect(page.locator('[data-eventid="synthetic-late"]')).toHaveAttribute("inert");
  await page.keyboard.press("Escape");
  await expect(page.locator(".synthetic-segment")).not.toHaveAttribute("inert");
  await expect(page.locator('[data-eventid="synthetic-late"]')).not.toHaveAttribute("inert");
});

test("seasonal canvases keep their viewport containing block while exiting", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vic.ambient", "on"));
  await open(page, 94, "&ambient=autumn");
  await expect.poll(() => page.locator(".pm-ambient-shell canvas").count()).toBeGreaterThan(0);
  expect(await page.locator(".pm-ambient-shell").evaluate(el => getComputedStyle(el).transform)).toBe("none");
  const readout = await page.locator("[data-pm-target] .teaser-count").textContent();
  await expect.poll(() => page.locator("[data-pm-target] .teaser-count").textContent(), { timeout: 2000 }).not.toBe(readout);
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
  await expect(page.locator(".pm-wish")).toHaveCount(1);
  await expect(page.locator(".pm-photo-content")).toHaveAttribute("data-expression", "delighted");
  await expect(page.locator(".pm-stage")).toHaveClass(/pm-hoped/);
  await expect.poll(async () => Number(await page.locator(".dt-count-core strong").textContent())).toBeLessThan(before);
  await expect(page.locator(".pm-particle,.pm-orbit,.pm-lightstick")).toHaveCount(0);
  await expect(page.getByText("공개 전까지 비밀이에요", { exact: true })).toHaveCount(0);
  await open(page, 9);
  await expect.poll(() => page.locator(".pm-stage").evaluate(el => (el as HTMLElement).style.getPropertyValue("--pm-fold-drift"))).toBe("0px");
  await expect.poll(() => page.locator(".pm-folds").evaluate(el => Number(getComputedStyle(el).opacity)), { timeout: 9000 }).toBeLessThan(.01);
  await expect(page.locator(".pm-light-field")).toHaveCount(0);
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
  await expect(page.locator(".pm-start-time")).toContainText("8:30");
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
  await expect(page.locator(".pm-folds")).not.toBeVisible();
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
    await page.addStyleTag({ content: ".pm-stage{--pm-gather:.4!important;--pm-digit-x:0px!important;--pm-digit-y:0px!important;--pm-digit-tilt:0deg!important}.pm-count .dt-ring-progress{stroke-dashoffset:.4!important}.pm-count .dt-ring-ticks line{opacity:.1!important}.pm-screen{animation:none!important}" });
    await expect(page.locator(".pm-screen")).toHaveScreenshot(`premiere-fluid-${width}.png`, { mask: [page.locator(".dt-count-core")], animations: "disabled" });
  });
}

import { expect, test, type Page, type TestInfo } from "@playwright/test";

// Exercise the shipped theme, not a synthetic set of inline token overrides.
// API writes and external media are intercepted: local config may use production.
async function prepare(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem("vic-autologin", "1");
    for (const [key, value] of Object.entries({
      "vic.settingsEpoch": "2026-09-04", "vic.dark": "on", "vic.eyeComfort": "on",
      "vic.reduceMotion": "on", "vic.ambient": "off", "vic.gfxPref": "max"
    })) if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
  });
  await page.route("**/*", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (!["localhost", "127.0.0.1"].includes(url.hostname)) return route.abort();
    if (req.method() !== "GET") return route.fulfill({ json: { ok: false, error: "Fixture only" } });
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname.endsWith("/vod-timeline")) return route.fulfill({ json: {
      authorNick: "샘플 팬", entries: Array.from({ length: 6 }, (_, i) => ({
        sec: i * 600, label: ["오늘의 이야기", "함께 웃는 시간", "여름 노래"][i % 3],
        section: i < 3 ? "소통" : "노래", depth: i === 1 ? 1 : 0
      }))
    } });
    if (url.pathname.endsWith("/vod-chat")) return route.fulfill({ json: {
      binSec: 120, laughTier: "high", bins: Array.from({ length: 60 }, (_, i) => ({
        i, h: .2 + (i % 7) / 10, d: .4, l: .3, t: ["샘플"]
      }))
    } });
    if (url.pathname.endsWith("/search")) return route.fulfill({ json: {
      query: "노래", hits: [
        { kind: "event", eventId: "sample", dateKey: "2026-06-15", title: "여름 노래 방송", snippet: "함께하는 저녁", score: 2, exact: true, popularity: .8 },
        { kind: "chapter", titleNo: 900000001, dateKey: "2026-06-15", title: "여름 노래", snippet: "샘플 방송", sec: 600, durationMs: 7200000, section: "노래", score: 1, exact: true, popularity: .7 }
      ]
    } });
    if (url.pathname.endsWith("/broadcast")) return route.fulfill({ json: {
      months: [{ ym: "2026-06", hours: 60, days: 20 }], daily: Array.from({ length: 30 }, (_, i) => i % 4 ? 3 : 0)
    } });
    return route.fulfill({ json: { isLive: false, hits: [], terms: [], suggestions: [], months: [], daily: [] } });
  });
}
async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500); // Let layout springs and portal transitions finish.
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true, animations: "disabled" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function darkSurface(page: Page, selector: string) {
  const rgb = await page.locator(selector).first().evaluate(el => {
    const layers: number[][] = [];
    for (let node: Element | null = el; node; node = node.parentElement) {
      const rgba = getComputedStyle(node).backgroundColor.match(/[\d.]+/g)!.map(Number);
      layers.push([...rgba.slice(0, 3), rgba[3] ?? 1]);
    }
    return layers.reverse().reduce((base, [r, g, b, a]) =>
      [r, g, b].map((v, i) => v * a + base[i] * (1 - a)), [255, 255, 255]);
  });
  expect(Math.max(...rgb), `${selector}: ${rgb}`).toBeLessThan(100);
}
test.beforeEach(async ({ page }) => { await prepare(page); });

test("insights loading shimmer stays dark during a delayed request", async ({ page }, info) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/visual-fixture/studio?role=developer", async route => {
    if (route.request().method() !== "POST") return route.fallback();
    await held;
    return route.fulfill({ contentType: "text/x-component", body: '0:{"a":"$@1","f":"","b":"fixture"}\n1:{"ok":false,"error":"Fixture only"}\n' });
  });
  try {
    await page.setViewportSize({ width: 1840, height: 1000 });
    await page.goto("/visual-fixture/studio?role=developer");
    if (!await page.locator("[data-act=manage-insights]").isVisible()) await page.locator("[data-act=panel-toggle]").click();
    await page.locator("[data-act=manage-insights]").click();
    await page.locator(".insight-skel span").first().waitFor();
    const gradient = await page.locator(".insight-skel span").first().evaluate(el => getComputedStyle(el).backgroundImage);
    expect(gradient).toContain("rgb(44, 41, 37)");
    expect(gradient).not.toContain("255, 255, 255");
    await capture(page, info, "insights-loading");
  } finally { release(); }
});

test("dark popularity has four static levels and ambient entry has readable ink", async ({ page }, info) => {
  await page.setViewportSize({ width: 1840, height: 1000 });
  await page.goto("/visual-fixture/poster?hearts=1");
  for (const [tier, count] of Object.entries({ warm: 1, hot: 2, blaze: 3, top: 4 })) {
    const card = page.locator(`.public-event[data-tier=${tier}]`).first();
    await expect(card.locator(".tier-signal i")).toHaveCount(count);
    await expect(card.locator(".tier-signal")).toBeVisible();
  }
  await capture(page, info, "popularity-four-levels");
  await page.evaluate(() => localStorage.setItem("vic.ambient", "on"));
  // Viewing mode is intentionally developer-only until the ambient world ships.
  await page.goto("/visual-fixture/studio?role=developer");
  const button = page.locator(".showcase-btn").first();
  await expect(button).toBeVisible();
  await darkSurface(page, ".showcase-btn");
  const ink = await button.evaluate(el => getComputedStyle(el).color.match(/\d+/g)!.map(Number));
  expect(Math.min(...ink)).toBeGreaterThan(160);
  await capture(page, info, "ambient-entry");
  await button.click();
  await expect(page.locator(".showcase-exit")).toBeVisible();
  await capture(page, info, "ambient-viewing");
  await page.locator(".showcase-gear").click();
  await page.locator(".sc-set-date-trigger").click();
  await capture(page, info, "ambient-date-picker");
  await page.locator(".sc-date-select").first().click();
  await capture(page, info, "ambient-year-picker");
  await page.locator("[data-act=biome-map-fold]").click();
  await capture(page, info, "ambient-map-expanded");
});

test("developer setting toggles real theme, persists and restores light", async ({ page }, info) => {
  await page.setViewportSize({ width: 1840, height: 1000 });
  await page.goto("/visual-fixture/studio?role=developer");
  await page.locator("[data-act=studio-settings]").click();
  const toggle = page.getByRole("switch", { name: "다크 모드 켜기/끄기" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await darkSurface(page, ".modal-card-settings");
  await capture(page, info, "developer-settings");
  await page.locator(".rhh-select:not(:disabled)").first().click();
  await capture(page, info, "settings-dropdown");
  await page.keyboard.press("Escape");
  // Dropdown Esc may close the parent too; reopen if needed.
  if (!await toggle.isVisible()) await page.locator("[data-act=studio-settings]").click();
  await toggle.click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
  await page.locator("[data-act=studio-settings]").click();
  await toggle.click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

for (const mobile of [false, true]) {
  test(`viewer, detail, search and records ${mobile ? "mobile" : "desktop"}`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1840, height: 1000 });
    await page.goto("/visual-fixture/poster?avatar=1&hearts=1");
    await page.locator(mobile ? ".agenda" : ".public-month-grid").first().waitFor();
    await capture(page, info, "viewer");
    await darkSurface(page, ".poster-page");
    await page.locator(mobile ? ".agenda-event" : ".public-event").first().click();
    await page.locator(".agenda-detail-sheet").waitFor();
    await capture(page, info, "event-detail");
    await page.goto("/visual-fixture/poster?avatar=1&hearts=1");
    await page.locator(mobile ? "[data-act=mb-search]" : "[data-act=open-search]").filter({ visible: true }).first().click();
    await page.locator(".ps-field input").fill("노래");
    await page.locator(".ps-field input").press("Enter");
    await page.locator(".ps-row").first().waitFor();
    await capture(page, info, "search-results");
    for (const button of await page.locator("[data-act=search-sort]").all()) {
      await button.click();
      await capture(page, info, `search-sort-${await button.textContent()}`);
    }
    await page.goto("/visual-fixture/poster?avatar=1&hearts=1");
    await page.locator(mobile ? "[data-act='이 달 기록 보기']" : "[data-act=open-insights]").filter({ visible: true }).first().click();
    await page.locator(".pi-sheet").waitFor();
    await capture(page, info, "public-records");
    await darkSurface(page, ".pi-sheet");
  });
  test(`editor with date picker ${mobile ? "mobile" : "desktop"}`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1840, height: 1000 });
    await page.goto("/visual-fixture/studio?role=owner");
    if (mobile) await page.locator("[data-act=agenda-event]").first().click();
    else await page.locator(".studio-event-pill").first().dblclick();
    await page.locator(mobile ? ".m-edit-sheet" : ".editor-title-ce").waitFor();
    await capture(page, info, "editor");
    await page.locator(mobile ? "[data-act=me-fold-head]" : "[data-act=fold-head]").click();
    await page.locator(".opt-chip.teaser").click();
    await page.locator(".dtp-trigger").click();
    await page.locator(".dtp-panel").waitFor();
    await capture(page, info, "date-time-picker");
    await darkSurface(page, ".dtp-panel");
  });
  test(`replay parts and help ${mobile ? "mobile" : "desktop"}`, async ({ page }, info) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1840, height: 1000 });
    await page.goto("/visual-fixture/theme?surface=replay");
    await page.locator(".vch-item").first().waitFor();
    const stage = page.locator(".dvm-thumb");
    if (mobile) {
      expect((await stage.boundingBox())!.width).toBeGreaterThan(300);
      expect((await page.locator(".dvm-strip").boundingBox())!.width).toBeGreaterThan(300);
    }
    for (let i = 0; i < 2; i++) {
      await page.locator(".dvm-tab").nth(i).click();
      await capture(page, info, `replay-part-${i + 1}`);
    }
    await page.keyboard.press("?");
    await capture(page, info, "replay-help");
    await darkSurface(page, ".replay-page");
    if (mobile) {
      await page.evaluate(() => localStorage.setItem("vic.dark", "off"));
      await page.reload();
      await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
      await page.locator(".vch-item").first().waitFor();
      for (const side of await page.locator(".dvm-railside-btn").all()) {
        await side.click();
        expect((await stage.boundingBox())!.width).toBeGreaterThan(300);
      }
      await page.keyboard.press("c");
      expect((await stage.boundingBox())!.width).toBeGreaterThan(300);
      await page.screenshot({ path: info.outputPath("replay-mobile-light.png") });
    }
  });
}
test("utility pages use the shared palette", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const [route, selector, name] of [
    ["/visual-fixture/theme?surface=dictionary", ".dict-board", "dictionary"],
    ["/visual-fixture/ambient-art", ".art-board", "art-board"],
    ["/login", ".auth-panel", "login"],
    ["/visual-fixture/missing", ".system-state-card", "not-found"]
  ]) {
    await page.goto(route);
    await page.locator(selector).waitFor();
    await capture(page, info, name);
    await darkSurface(page, selector);
  }
});

test("drawing tools, layers and shortcuts", async ({ page }, info) => {
  await page.setViewportSize({ width: 1840, height: 1000 });
  await page.goto("/visual-fixture/studio?viewer=1&role=developer");
  await page.locator(".public-month-grid").waitFor();
  await page.locator("[data-act=open-drawing-board]").click();
  await page.locator(".broadcast-panel").waitFor();
  await capture(page, info, "drawing");
  await page.getByRole("button", { name: "단축키", exact: true }).click();
  await capture(page, info, "drawing-shortcuts");
  await darkSurface(page, ".broadcast-panel");
});

test("teaser, art detail and narrow settings", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/visual-fixture/poster?teaser=3600");
  await page.locator(".public-event.teaser").first().click();
  await page.locator(".agenda-detail-sheet").waitFor();
  await capture(page, info, "teaser-detail");
  await page.goto("/visual-fixture/ambient-art");
  const href = await page.locator('a[href*="/ambient-art/"]').first().getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!.replace("/studio/", "/visual-fixture/"));
  await page.locator(".artslot").waitFor();
  await capture(page, info, "art-detail");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/visual-fixture/studio?role=developer");
  await page.locator(".role-help-q").click();
  await page.locator(".role-help-pop").waitFor();
  await capture(page, info, "mobile-settings");
});



test("background and eye-comfort combinations keep the shared glass boundary", async ({ page }, info) => {
  await page.setViewportSize({ width: 1840, height: 1000 });
  await page.goto("/visual-fixture/poster");
  for (const ambient of ["on", "dim", "off"]) {
    for (const eye of ["on", "off"]) {
      await page.evaluate(({ ambient, eye }) => {
        localStorage.setItem("vic.ambient", ambient);
        localStorage.setItem("vic.eyeComfort", eye);
      }, { ambient, eye });
      await page.reload();
      await page.locator(".public-month-grid").waitFor();
      await capture(page, info, `ambient-${ambient}-eye-${eye}`);
      const state = await page.evaluate(() => ({
        filter: getComputedStyle(document.documentElement).filter,
        surface: getComputedStyle(document.querySelector(".poster-surface")!).backgroundColor,
        cell: getComputedStyle(document.querySelector(".public-day.outside")!).backgroundColor
      }));
      expect(state.filter).toBe("none");
      if (ambient !== "off") {
        expect(state.surface).toBe("rgba(0, 0, 0, 0)");
        expect(state.cell).toContain("0.32");
      }
    }
  }
  await page.evaluate(() => {
    localStorage.setItem("vic.gfxPref", "auto");
    localStorage.setItem("vic.gfx", JSON.stringify({mode:"soft",at:Date.now(),v:3}));
    localStorage.setItem("vic.ambient", "on");
    localStorage.setItem("vic.eyeComfort", "on");
  });
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-gfx", "soft");
  await expect(page.locator("html")).toHaveAttribute("data-eye-comfort", "lite");
  await darkSurface(page, ".poster-page");
  await capture(page, info, "software-graphics");
});

test("search empty and failure states stay readable", async ({ page }, info) => {
  await page.goto("/visual-fixture/poster");
  await page.locator("[data-act=open-search]").click();
  await capture(page, info, "search-empty");
  await page.route("**/api/public/**/search?**", route => route.fulfill({status:500,json:{error:"Fixture failure"}}));
  await page.locator(".ps-field input").fill("검색 오류");
  await page.locator(".ps-field input").press("Enter");
  await expect(page.locator(".ps-sheet")).toContainText(/실패|오류|다시/);
  await capture(page, info, "search-error");
});

test("preview and landscape share dark materials", async ({ page }, info) => {
  await page.setViewportSize({ width: 1840, height: 1000 });
  await page.goto("/visual-fixture/studio?viewer=1&role=developer");
  await page.locator(".public-month-grid").waitFor();
  await capture(page, info, "studio-viewer-preview");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/visual-fixture/poster?avatar=1");
  await capture(page, info, "landscape-viewer");
});

test("art board filters and dictionary editing surfaces", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/visual-fixture/ambient-art");
  await page.locator(".art-more summary").filter({ hasText: "필터 더" }).click();
  for (const label of ["납품 상태", "계절", "생성 차수", "지금 화면"]) {
    const group = page.getByRole("group", { name: label, exact: true });
    await expect(group).toBeVisible();
    for (const button of await group.locator("button").all()) {
      await button.click();
      await capture(page, info, `art-${label}-${await button.textContent()}`);
    }
    if (await group.locator("button").count()) await group.locator("button").first().click();
  }
  await page.locator(".art-more summary").filter({ hasText: "필터 더" }).click();
  await page.locator("[data-act=art-view-codex]").click();
  await capture(page, info, "art-codex-view");
  await page.goto("/visual-fixture/theme?surface=dictionary");
  await page.locator("input").last().fill("샘플 의미");
  await capture(page, info, "dictionary-edit");
});

test("theme toggles preserve calendar geometry and exact light colors", async ({ page }) => {
  await page.setViewportSize({ width: 1840, height: 1000 });
  for (const route of ["/visual-fixture/poster", "/visual-fixture/studio?role=owner", "/visual-fixture/studio?role=developer"]) {
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600); // Hydration measures the shared panel and grid.
    const measure = () => page.evaluate(() => [...document.querySelectorAll(".public-month-grid,.public-day,.studio-month-grid,.studio-day")].map(el => {
      const node = el as HTMLElement;
      return {w:node.offsetWidth,h:node.offsetHeight,x:node.offsetLeft,y:node.offsetTop};
    }));
    const before = await measure();
    expect(before.length).toBeGreaterThan(27);
    await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
    expect(await measure()).toEqual(before);
    const light = await page.locator("body").evaluate(el => getComputedStyle(el).color);
    await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
    expect(await measure()).toEqual(before);
    await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
    expect(await page.locator("body").evaluate(el => getComputedStyle(el).color)).toBe(light);
  }
});

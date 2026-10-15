import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES, COMPANION_PREFERENCES_EVENT, COMPANION_PREFERENCES_KEY } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

const pet = (page: Page) => page.locator(".vc-companion");
const posts = new WeakMap<Page, string[]>();
const preferences = { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, heartPrank: false, ambientPrank: false, feeding: false };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ preferences, care, epoch, epochKey, prefKey }) => {
    localStorage.setItem(epochKey, epoch);
    localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem(prefKey, JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
  }, { preferences, care: DEFAULT_COMPANION_CARE, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, prefKey: COMPANION_PREFERENCES_KEY });
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

/** Independent rendered oracle: Range ink and complete control hit targets,
 * clipped to visible overflow. Only the opaque house can hide calendar ink.
 * It checks the registered opaque-body proxy (.vc-actor), never the transparent
 * atlas cell, and deliberately makes no assertion about a flying jump arc. */
async function safety(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(".vc-companion");
    const actor = element?.querySelector<HTMLElement>(".vc-actor");
    if (!element || !actor || element.hidden) return { visible: false, state: "", platform: "", collisions: [], glyphs: 0, controls: 0, body: null, cell: null, supportError: null };
    const body = actor.getBoundingClientRect(), cell = element.getBoundingClientRect();
    const root = document.querySelector<HTMLElement>(".poster-page")!;
    const house = document.querySelector<HTMLElement>(".vc-home");
    const cover = house?.getBoundingClientRect();
    const cache = new Map<Element, boolean>();
    const visible = (node: Element | null): boolean => {
      if (!node) return true;
      const known = cache.get(node); if (known !== undefined) return known;
      const style = getComputedStyle(node);
      const result = !node.hasAttribute("hidden") && style.display !== "none" && !["hidden", "collapse"].includes(style.visibility) && Number(style.opacity || 1) > .05 && visible(node.parentElement);
      cache.set(node, result); return result;
    };
    type Rect = { left: number; right: number; top: number; bottom: number };
    const clip = (rect: Rect, parent: Element | null) => {
      const result = { left: Math.max(0, rect.left), right: Math.min(innerWidth, rect.right), top: Math.max(0, rect.top), bottom: Math.min(innerHeight, rect.bottom) };
      for (let node = parent; node; node = node.parentElement) {
        const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
        if (/^(auto|scroll|clip|hidden)$/.test(style.overflowX)) { result.left = Math.max(result.left, bounds.left); result.right = Math.min(result.right, bounds.right); }
        if (/^(auto|scroll|clip|hidden)$/.test(style.overflowY)) { result.top = Math.max(result.top, bounds.top); result.bottom = Math.min(result.bottom, bounds.bottom); }
      }
      return result;
    };
    const collisions: { kind: string; source: string; width: number; height: number }[] = [];
    const inspect = (rect: Rect, node: Element, kind: string) => {
      const overlap = { left: Math.max(body.left, rect.left), right: Math.min(body.right, rect.right), top: Math.max(body.top, rect.top), bottom: Math.min(body.bottom, rect.bottom) };
      if (overlap.right - overlap.left <= .25 || overlap.bottom - overlap.top <= .25) return;
      if (cover && !house!.contains(node) && overlap.left >= cover.left && overlap.right <= cover.right && overlap.top >= cover.top && overlap.bottom <= cover.bottom) return;
      collisions.push({ kind, source: `${node.tagName}.${node.className}`, width: overlap.right - overlap.left, height: overlap.bottom - overlap.top });
    };
    const scopes = [root];
    if (house && !root.contains(house)) scopes.push(house);
    const launcher = document.querySelector<HTMLElement>(".vc-home-launcher");
    if (launcher && !root.contains(launcher)) scopes.push(launcher);
    let glyphs = 0, controls = 0;
    const supportErrors: number[] = [];
    const seen = new Set<Node>();
    for (const scope of scopes) {
      const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT), range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (seen.has(node)) continue; seen.add(node);
        const parent = node.parentElement;
        if (!parent || !visible(parent) || parent.closest("script,style,svg,.sr-only,.vc-companion")) continue;
        range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          const bounds = clip(rect, parent);
          if (bounds.right - bounds.left < .5 || bounds.bottom - bounds.top < .5) continue;
          glyphs++; inspect(bounds, parent, "text");
          const support = parent.closest(".public-day .day-strip > strong,.agenda-day .agenda-when > strong,.public-event .event-main p,.public-event .event-subs li,.agenda-event .agenda-title-text,.agenda-event .agenda-subs li,.agenda-item .agenda-title-text,.agenda-item .agenda-title,.agenda-item .agenda-subs li");
          const centre = (body.left + body.right) / 2;
          if (support && !support.closest(".dimmed,[inert],[aria-hidden='true']") && centre >= bounds.left - .5 && centre <= bounds.right + .5) supportErrors.push(Math.abs(body.bottom - bounds.top + 3));
        }
      }
      range.detach();
    }
    const targets = new Set(root.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role='button']"));
    for (const node of document.querySelectorAll<HTMLElement>(".vc-home button,.vc-home-launcher")) targets.add(node);
    for (const node of targets) {
      if (!visible(node) || node.matches(".public-event,.agenda-event,.agenda-item,.public-day,.agenda-day") || node.closest(".vc-companion,.vc-cushion-button")) continue;
      const bounds = clip(node.getBoundingClientRect(), node.parentElement);
      if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) continue;
      controls++; inspect(bounds, node, "control");
    }
    const platform = element.dataset.platform ?? "";
    let floorY = innerHeight - 18;
    for (const bar of root.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const rect = bar.getBoundingClientRect();
      if (visible(bar) && getComputedStyle(bar).position === "fixed" && rect.width > 0 && rect.height > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) floorY = Math.min(floorY, rect.top - 8);
    }
    const cushion = document.querySelector(".vc-home-cushion")?.getBoundingClientRect();
    const supportError = platform.startsWith("viewport-floor") ? Math.abs(body.bottom - floorY) : platform === "companion-home" && cushion ? Math.abs(body.bottom - cushion.top) : Math.min(...supportErrors);
    return { visible: true, state: element.dataset.state ?? "", platform, collisions, glyphs, controls, supportError,
      body: { left: body.left, top: body.top, right: body.right, bottom: body.bottom, width: body.width, height: body.height },
      cell: { left: cell.left, top: cell.top, width: cell.width, height: cell.height },
    };
  });
}

async function settled(page: Page) {
  await expect(pet(page)).toHaveCount(1);
  // Check rest after the calendar/panel's finite entrance or FLIP finishes.
  // Ambient loops and sprite poses do not block this; no animation is stopped.
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)));
    await Promise.allSettled(finite.map(animation => animation.finished));
  });
  let result = await safety(page);
  await expect.poll(async () => {
    result = await safety(page);
    return result.visible && ["idle", "look", "sleep", "sniff"].includes(result.state) && Boolean(result.platform) && !result.collisions.length && result.supportError !== null && result.supportError < 2;
  }, { timeout: 8000, message: "stationary opaque body must avoid visible text and complete controls" }).toBe(true);
  expect(result.glyphs).toBeGreaterThan(20); expect(result.controls).toBeGreaterThan(3);
  expect(result.collisions).toEqual([]);
  expect(result.supportError).toBeLessThan(2);
  expect(result.body!.width).toBeCloseTo(result.cell!.width * .76, 1);
  expect(result.body!.height).toBeCloseTo(result.cell!.height * .76, 1);
  expect(result.body!.left).toBeGreaterThanOrEqual(0); expect(result.body!.top).toBeGreaterThanOrEqual(0);
  const viewport = page.viewportSize()!;
  expect(result.body!.right).toBeLessThanOrEqual(viewport.width); expect(result.body!.bottom).toBeLessThanOrEqual(viewport.height);
  await expect(page.locator("[data-export-surface] .vc-companion,[data-export-surface] .vc-home,[data-export-surface] .vc-compact-home")).toHaveCount(0);
  return result;
}

test("PC stationary safety follows viewport resize and poster zoom without changing the1840 canvas", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
  const initial = await settled(page);
  expect(await page.locator("[data-export-surface]").evaluate(node => (node as HTMLElement).offsetWidth)).toBe(1840);
  // Change only fixture CSS: actual client rectangles move under the same
  // fixed poster canvas, as they do when its responsive scale changes.
  await page.locator(".poster-scaler").evaluate(node => {
    const scaler = node as HTMLElement;
    const scale = new DOMMatrixReadOnly(getComputedStyle(scaler).transform).a;
    scaler.style.setProperty("--poster-scale", String(scale * .91));
  });
  await expect.poll(async () => Math.abs((await safety(page)).body!.bottom - initial.body!.bottom), { timeout: 5000 }).toBeGreaterThan(5);
  const zoomed = await settled(page);
  await page.screenshot({ path: ".scratch-pw/companion-presence-pc1920.png" });
  await page.setViewportSize({ width: 1280, height: 1000 });
  const resized = await settled(page);
  expect(await page.locator("[data-export-surface]").evaluate(node => (node as HTMLElement).offsetWidth)).toBe(1840);
  await page.screenshot({ path: ".scratch-pw/companion-presence-pc1280.png" });
  console.log(JSON.stringify({ check: "presence-PC", initial, zoomed, resized }));
});

test("legacy small, normal and large preferences all render the single92 default safely", async ({ page }) => {
  // PLAN-063: keep preference migration coverage on a supported compact desktop.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
  await settled(page); // wait for preference hydration before changing settings
  const results = [];
  for (const size of ["normal", "small", "large"] as const) {
    await page.evaluate(({ size, key, event }) => {
      const current = JSON.parse(localStorage.getItem(key)!);
      const next = { ...current, size };
      localStorage.setItem(key, JSON.stringify(next)); dispatchEvent(new CustomEvent(event, { detail: next }));
    }, { size, key: COMPANION_PREFERENCES_KEY, event: COMPANION_PREFERENCES_EVENT });
    const result = await settled(page);
    expect(result.cell!.width).toBeCloseTo(92, 3);
    await expect(page.locator(".vc-home")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "빅타민 집 열기", exact: true })).toBeVisible();
    await page.screenshot({ path: `.scratch-pw/companion-presence-compact-desktop-${size}.png` });
    results.push({ size, ...result });
  }
  console.log(JSON.stringify({ check: "presence-compact-desktop", results }));
});

test("reflowed calendar and an opaque compact home both retain readable text and usable controls", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
  await settled(page);
  // A real font/layout change, not a fake clock or synthetic platform API.
  await page.locator(".public-event .event-main p").first().evaluate(node => {
    const line = node as HTMLElement; line.style.fontFamily = "Georgia,serif"; line.style.fontSize = "22px"; line.style.lineHeight = "1.5";
  });
  await settled(page);
  // PLAN-063: compact desktop retains the same local creature; mobile absence
  // and restoration are exercised in mobile-companion-disabled.spec.ts.
  await page.setViewportSize({ width: 1280, height: 1000 });
  await settled(page);
  await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).click();
  await expect(page.getByRole("region", { name: "빅타민 집", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 8000 });
  const result = await settled(page);
  const cushionY = await page.locator(".vc-home-cushion").evaluate(node => node.getBoundingClientRect().top);
  expect(Math.abs(result.body!.bottom - cushionY)).toBeLessThan(2);
  await page.screenshot({ path: ".scratch-pw/companion-presence-compact-desktop-home.png" });
  console.log(JSON.stringify({ check: "presence-compact-desktop-home", ...result, cushionY }));
});

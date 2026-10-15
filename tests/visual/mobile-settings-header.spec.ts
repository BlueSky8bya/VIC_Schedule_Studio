import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

const posts = new WeakMap<Page, string[]>(), errors = new WeakMap<Page, string[]>();
const windowOf = (page: Page) => page.getByRole("dialog", { name: "설정", exact: true });
const gearOf = (page: Page) => page.locator(".agenda-header > .viewer-settings-open");

test.beforeEach(async ({ page }) => {
  const attempted: string[] = [], failures: string[] = [];
  posts.set(page, attempted); errors.set(page, failures);
  page.on("pageerror", error => failures.push(error.message));
  await page.route("**/*", route => {
    if (route.request().method() === "POST") {
      attempted.push(new URL(route.request().url()).pathname);
      return route.fulfill({ status: 500, body: "" });
    }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => {
  expect(posts.get(page)).toEqual([]);
  expect(errors.get(page)).toEqual([]);
});

async function seed(page: Page, dark: boolean) {
  await page.addInitScript(({ key, epoch, preferences, dark }) => {
    localStorage.setItem(key, epoch);
    localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.dark", dark ? "on" : "off");
    // A remembered desktop preference must survive using mobile settings.
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, dark });
}

async function headerMetrics(page: Page) {
  return gearOf(page).evaluate(node => {
    const gear = node.getBoundingClientRect();
    const header = node.parentElement!;
    const title = header.querySelector("h1")!.getBoundingClientRect();
    const account = header.querySelector<HTMLElement>(".agenda-account button,.m-head-logout button,a.m-head-logout")!;
    const accountRect = account.getBoundingClientRect();
    const hit = document.elementFromPoint(gear.x + gear.width / 2, gear.y + gear.height / 2);
    const accountHit = document.elementFromPoint(accountRect.x + accountRect.width / 2, accountRect.y + accountRect.height / 2);
    return {
      x: gear.x, y: gear.y, width: gear.width, height: gear.height,
      right: document.documentElement.clientWidth - gear.right,
      titleGap: gear.left - title.right,
      accountGap: accountRect.top - gear.bottom,
      nativeHit: Boolean(hit?.closest(".viewer-settings-open") === node),
      accountHit: Boolean(accountHit && (account === accountHit || account.contains(accountHit))),
      scrollWidth: document.documentElement.scrollWidth,
      widthOfPage: document.documentElement.clientWidth,
    };
  });
}

for (const topology of [
  { name: "native390", width: 390, height: 844, dark: false },
  // Wider than both agenda width cutoffs: the coarse/short-height clause,
  // rather than a narrow desktop viewport, must supply this same header.
  { name: "coarse-landscape", width: 1120, height: 600, dark: true },
]) test.describe(topology.name, () => {
  test.use({ viewport: { width: topology.width, height: topology.height }, isMobile: true, hasTouch: true });

  test("viewer and studio share one upper-right gear with native X, Back and focus restoration", async ({ page }) => {
    await seed(page, topology.dark);
    const measured: Record<string, Awaited<ReturnType<typeof headerMetrics>>> = {};
    for (const route of [
      { name: "viewer", path: "/visual-fixture/poster?avatar=1&signedIn=0", surface: ".poster-agenda" },
      { name: "studio", path: "/visual-fixture/studio?role=owner", surface: ".studio-mobile" },
    ]) {
      await page.goto(route.path);
      await expect(page.locator(route.surface)).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      const gear = gearOf(page);
      await expect(gear).toHaveCount(1);
      await expect(gear).toBeVisible();
      await expect(gear).toHaveAccessibleName("설정");
      await expect(page.locator(".agenda-rail .viewer-settings-open")).toHaveCount(0);
      const metric = measured[route.name] = await headerMetrics(page);
      expect(metric.width).toBe(44); expect(metric.height).toBe(44);
      expect(metric.y).toBeGreaterThanOrEqual(0);
      expect(metric.right).toBeCloseTo(14, 1);
      expect(metric.titleGap).toBeGreaterThanOrEqual(0);
      expect(metric.accountGap).toBeGreaterThanOrEqual(0);
      expect(metric.nativeHit).toBe(true); expect(metric.accountHit).toBe(true);
      expect(metric.scrollWidth).toBeLessThanOrEqual(metric.widthOfPage + 1);

      await page.screenshot({ path: `.scratch-pw/companion-063-settings-${route.name}-${topology.name}.png` });
      await gear.tap(); await expect(windowOf(page)).toBeVisible();
      await expect(gear).toHaveAttribute("aria-expanded", "true");
      await windowOf(page).locator(".modal-head .modal-close").tap();
      await expect(windowOf(page)).toHaveCount(0); await expect(gear).toBeFocused();
      await expect(gear).toHaveAttribute("aria-expanded", "false");
      await gear.tap(); await expect(windowOf(page)).toBeVisible();
      await page.goBack(); await expect(windowOf(page)).toHaveCount(0);
      await expect(page.locator(route.surface)).toBeVisible(); await expect(gear).toBeFocused();
      expect(new URL(page.url()).pathname).toBe(new URL(route.path, "http://fixture").pathname);
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).enabled)).toBe(true);
    }
    // Absolute viewport placement is shared even though studio wraps its
    // sticky header in a separate topstick and shows editor save information.
    expect(Math.abs(measured.viewer.x - measured.studio.x)).toBeLessThan(.5);
    expect(Math.abs(measured.viewer.y - measured.studio.y)).toBeLessThan(.5);
    writeFileSync(`.scratch-pw/companion-063-settings-${topology.name}.json`, JSON.stringify(measured, null, 2));
  });
});

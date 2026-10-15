import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const pet = (page: Page) => page.locator(".vc-companion");
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const settings = (page: Page) => page.getByRole("dialog", { name: "설정", exact: true });
const posts = new WeakMap<Page, string[]>(), errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const attempted: string[] = [], failures: string[] = []; posts.set(page, attempted); errors.set(page, failures);
  page.on("pageerror", error => failures.push(error.message));
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { attempted.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); expect(errors.get(page)).toEqual([]); });

async function seed(page: Page, enabled: boolean, dark = false) {
  await page.addInitScript(({ key, epoch, preferences, care, dark }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.dark", dark ? "on" : "off");
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed");
    // Reload and a second shared surface retain choices made by native UI.
    if (!localStorage.getItem("vic.viewerCompanion")) localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    if (!localStorage.getItem("vic.viewerCompanionCare")) localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, dark, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled, roam: false, jump: false, sleep: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
}
async function studio(page: Page, role = "owner") {
  await page.goto(`/visual-fixture/studio?role=${role}`);
  await expect(page.locator(".studio-shell")).toBeVisible(); await page.evaluate(() => document.fonts.ready);
}
async function sharedLayout(page: Page) {
  expect(await pet(page).count()).toBeLessThanOrEqual(1);
  expect(await page.locator("[data-export-surface] .vc-companion,[data-export-surface] .vc-home").count()).toBe(0);
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
}

test.describe("shared companion in the studio", () => {
  test.use({ viewport: { width: 1920, height: 1100 } });
  test("owner master switch mounts one local companion and the same rail house", async ({ page }) => {
    const atlases: string[] = []; page.on("request", request => { if (/\/companion\/.*\.webp(?:\?|$)/.test(request.url())) atlases.push(request.url()); });
    await seed(page, false); await studio(page);
    await expect(pet(page)).toHaveCount(0); expect(atlases).toEqual([]);
    await page.locator('[data-act="studio-settings"]').click(); await expect(settings(page)).toBeVisible();
    await settings(page).locator('[data-tab="companion"]').click();
    const master = settings(page).getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true });
    await expect(master).toHaveAttribute("aria-checked", "false"); await master.click();
    await expect(master).toHaveAttribute("aria-checked", "true"); await expect(pet(page)).toHaveCount(1);
    await settings(page).locator(".modal-head .modal-close").click();
    await expect(settings(page)).toHaveCount(0); await expect(pet(page)).toBeVisible(); await expect(home(page)).toBeVisible();
    await expect(page.locator(".avatar-rail .vc-home")).toHaveCount(1); expect(atlases.length).toBeGreaterThan(0);
    const unsafe = await page.locator('[data-companion-event="ordinary"]').evaluateAll(nodes => nodes.some(node => node.matches(".teaser,.is-support") || !node.getAttribute("data-eventid")));
    expect(unsafe).toBe(false); await sharedLayout(page);
    await page.screenshot({ path: ".scratch-pw/companion-062-studio-owner.png" });
    await page.locator('.studio-event-pill[data-companion-event="ordinary"] .pill-main strong').first().dblclick();
    await expect(page.locator(".event-editor-panel.is-edit")).toBeVisible(); await expect(pet(page)).toBeVisible();
    await expect(pet(page)).toHaveAttribute("data-overlay", "quiet");
    await expect.poll(() => page.evaluate(() => {
      const body = document.querySelector(".vc-actor")!.getBoundingClientRect(), editor = document.querySelector(".event-editor-panel")!.getBoundingClientRect();
      return Math.max(0, Math.min(body.right, editor.right) - Math.max(body.left, editor.left)) * Math.max(0, Math.min(body.bottom, editor.bottom) - Math.max(body.top, editor.top));
    })).toBeLessThan(.25);
    // Double-click opens the editor; text focus is an explicit native input
    // action, rather than an unsupported assumption about editor autofocus.
    await page.locator(".event-editor-panel .editor-title-ce").click();
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest(".event-editor-panel")))).toBe(true);
    await page.keyboard.press("Tab");
    expect(await pet(page).locator(".vc-actor").evaluate(node => node === document.activeElement)).toBe(false);
  });
  test("developer filter and season disclosures persist across studio reload and public viewer", async ({ page }) => {
    await seed(page, true); await studio(page, "developer");
    for (const key of ["tag-filter", "season"]) {
      const toggle = page.locator(`[data-panel-section="${key}"] > .panel-section-heading .panel-section-toggle`).first();
      await expect(toggle).toHaveAttribute("aria-expanded", "true"); await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "false");
    }
    await page.reload(); await expect(page.locator(".studio-shell")).toBeVisible();
    for (const key of ["tag-filter", "season"]) await expect(page.locator(`[data-panel-section="${key}"]`).first()).toHaveAttribute("data-panel-collapsed", "");
    await expect(home(page)).toBeVisible(); await sharedLayout(page);
    await page.goto("/visual-fixture/poster?avatar=1"); await expect(page.locator(".poster-page")).toBeVisible();
    for (const key of ["tag-filter", "season"]) await expect(page.locator(`[data-panel-section="${key}"]`).first()).toHaveAttribute("data-panel-collapsed", "");
    await expect(pet(page)).toHaveCount(1); await sharedLayout(page);
  });
});

for (const topology of [{ name: "native390", width: 390, height: 844 }, { name: "coarse-landscape", width: 900, height: 600 }]) test.describe(topology.name, () => {
  test.use({ viewport: { width: topology.width, height: topology.height }, isMobile: true, hasTouch: true });
  test("mobile settings X and browser Back return to studio; dark rail and local house stay shared", async ({ page }) => {
    await seed(page, true, true); await studio(page);
    const opener = page.locator('.agenda-rail .viewer-settings-open');
    await expect(opener).toHaveAccessibleName("설정");
    await opener.tap(); await expect(settings(page)).toBeVisible(); await expect(page.locator(".role-help-pop")).toHaveCount(0);
    await settings(page).locator(".modal-head .modal-close").tap(); await expect(settings(page)).toHaveCount(0);
    await expect(page.locator(".studio-shell")).toBeVisible(); await expect(opener).toBeFocused();
    await opener.tap(); await expect(settings(page)).toBeVisible(); await page.goBack(); await expect(settings(page)).toHaveCount(0);
    await expect(page.locator(".studio-shell")).toBeVisible(); expect(new URL(page.url()).pathname).toBe("/visual-fixture/studio");
    const palette = await page.locator(".agenda-rail").evaluate(node => ({ background: getComputedStyle(node).backgroundColor, text: getComputedStyle(node.querySelector(".agenda-legend")!).color }));
    expect(palette.background).toBe("rgba(0, 0, 0, 0)"); expect(palette.text).not.toBe("rgb(0, 0, 0)");
    await openCompanionHome(page, "touch"); await expect(home(page)).toHaveCount(1);
    await home(page).getByRole("button", { name: "밥 꺼내기", exact: true }).tap(); await expect(page.locator(".vc-food")).toHaveCount(1);
    await home(page).getByRole("button", { name: "음식 버리기", exact: true }).tap(); await expect(page.locator(".vc-food")).toHaveCount(0);
    await sharedLayout(page); await page.screenshot({ path: `.scratch-pw/companion-062-studio-${topology.name}-dark.png` });
  });
});

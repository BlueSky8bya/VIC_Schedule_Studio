import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { openCompanionHome } from "./helpers/companion-home";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";

const companionNodes = ".vc-companion,.vc-home,.vc-food,.vc-food-layer,.vc-compact-home,.vc-bed-foreground,.pm-fan,.pm-cast-row";
const companionAssets = /\/(?:companion\/|premiere\/victamin-audience(?:-[a-z0-9-]+)?\.webp)/;
const attempted = new WeakMap<Page, string[]>(), failures = new WeakMap<Page, string[]>();
const pets = new WeakMap<Page, string[]>();
const previewReads = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const posts: string[] = [], errors: string[] = [], assets: string[] = [];
  attempted.set(page, posts); failures.set(page, errors); pets.set(page, assets);
  const reads: string[] = []; previewReads.set(page, reads);
  const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const publicPreviewIds = new Set(Object.entries(actions).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  expect(publicPreviewIds.size).toBe(1); expect(samplePublicScheduleData.events.length).toBeGreaterThan(0);
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (companionAssets.test(new URL(request.url()).pathname)) assets.push(new URL(request.url()).pathname); });
  await page.route("**/*", route => {
    // Cold preview entry has one established read-only Server Action (POST
    // transport). Stub only its exact build-manifest id with a public fixture;
    // every mutation or unknown action remains blocked and fails the test.
    if (route.request().method() === "POST" && new URL(route.request().url()).pathname === "/visual-fixture/studio" && publicPreviewIds.has(route.request().headers()["next-action"])) {
      reads.push("getPublicPreviewAction");
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (route.request().method() === "POST") { posts.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ epoch, key, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed"); localStorage.removeItem("vic.panelSections");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: true, heartPrank: false, ambientPrank: false },
    care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
});
test.afterEach(async ({ page }) => {
  expect(attempted.get(page)).toEqual([]); expect(failures.get(page)).toEqual([]);
  expect(previewReads.get(page)).toEqual(new URL(page.url()).searchParams.get("viewer") === "1" ? ["getPublicPreviewAction"] : []);
});

const routes = [
  { name: "public", path: "/visual-fixture/poster?avatar=1", surface: ".poster-page" },
  { name: "studio", path: "/visual-fixture/studio", surface: ".studio-shell" },
  { name: "preview", path: "/visual-fixture/studio?viewer=1", surface: ".poster-page" },
];
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished));
  });
}
async function preferences(page: Page) { return page.evaluate(() => localStorage.getItem("vic.viewerCompanion")); }
async function absent(page: Page) {
  await expect(page.locator(companionNodes)).toHaveCount(0);
  await expect(page.locator('[data-companion-hearted],[data-companion-hide-hint],[data-companion-launcher-space]')).toHaveCount(0);
}

for (const view of [{ name: "native390", width: 390, height: 844 }, { name: "coarse-landscape", width: 1120, height: 600 }]) test.describe(view.name, () => {
  test.use({ viewport: { width: view.width, height: view.height }, isMobile: true, hasTouch: true });
  for (const route of routes) test(`${route.name} ignores stored master ON without loading any pet and keeps the rest of settings usable`, async ({ page }) => {
    await page.goto(route.path); await expect(page.locator(route.surface)).toBeVisible(); await settle(page);
    await absent(page); const saved = await preferences(page); expect(JSON.parse(saved!).enabled).toBe(true);
    const gear = page.locator(".agenda-header > .viewer-settings-open,.m-month-nav > .viewer-settings-open"); await gear.tap();
    const modal = page.getByRole("dialog", { name: "설정", exact: true }); await expect(modal).toBeVisible();
    await expect(modal.locator('[data-tab="companion"]')).toHaveCount(0);
    await expect(modal.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true })).toHaveCount(0);
    // Narrow settings stack their sections; the sidebar tabs are intentionally
    // hidden. Exercise the real visible control instead of a hidden tab.
    const textSize = modal.getByRole("slider", { name: "달력 글씨 크기(px)", exact: true });
    await textSize.scrollIntoViewIfNeeded(); await expect(textSize).toBeVisible();
    const beforeSize = Number(await textSize.inputValue());
    await textSize.focus(); await textSize.press("ArrowRight"); await expect(textSize).toHaveValue(String(beforeSize + .5));
    await textSize.press("ArrowLeft"); await expect(textSize).toHaveValue(String(beforeSize));
    await modal.locator(".modal-head .modal-close").tap(); await expect(modal).toHaveCount(0);
    await absent(page); expect(await preferences(page)).toBe(saved); expect(pets.get(page)).toEqual([]);
    await page.screenshot({ path: `.scratch-pw/companion-064-disabled-${route.name}-${view.name}.png` });
  });
});

test.describe("desktop capability survives a narrow resize", () => {
  test.use({ viewport: { width: 1920, height: 1100 } });
  for (const route of routes.slice(0, 2)) test(`${route.name} unmounts pet and food on mobile, then restores the desktop choice`, async ({ page }) => {
    await page.goto(route.path); await settle(page);
    await expect(page.locator(".vc-companion")).toBeVisible(); await expect(page.locator(".vc-companion")).toHaveAttribute("data-atlas", "hd");
    const saved = await preferences(page); await openCompanionHome(page);
    await page.getByRole("region", { name: "빅타민 집", exact: true }).getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    await expect(page.locator(".vc-food")).toHaveCount(1);
    await page.setViewportSize({ width: 390, height: 844 }); await settle(page); await absent(page);
    expect(await preferences(page)).toBe(saved);
    const requests = pets.get(page)!.length; await page.waitForTimeout(350); expect(pets.get(page)!.length).toBe(requests);
    await page.setViewportSize({ width: 1920, height: 1100 }); await settle(page);
    await expect(page.locator(".vc-companion")).toHaveCount(1); await expect(page.locator(".vc-companion")).toBeVisible();
    expect(await preferences(page)).toBe(saved);
    if (route.name === "public") await expect(page.locator("[data-export-surface]")).toHaveJSProperty("offsetWidth", 1840);
  });
});

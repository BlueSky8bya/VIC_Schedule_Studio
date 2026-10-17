import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { settlePanelLayout } from "./helpers/panel-layout";

const proof = new WeakMap<Page, { writes: string[]; errors: string[] }>();
test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  proof.set(page, { writes: [], errors: [] });
  page.on("pageerror", error => proof.get(page)!.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      proof.get(page)!.writes.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 503, body: "fixture forbids writes" });
    }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const build = readFileSync(resolve(".next/BUILD_ID"), "utf8").trim(), folder = `.scratch-pw/companion-100/${build}`;
  mkdirSync(folder, { recursive: true });
  const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  writeFileSync(`${folder}/${name}.json`, JSON.stringify({ build, status: info.status, ...proof.get(page) }, null, 2));
  await page.screenshot({ path: `${folder}/${name}.png`, fullPage: true });
  expect(proof.get(page)!.writes).toEqual([]); expect(proof.get(page)!.errors).toEqual([]);
});

async function seed(page: Page, enabled: boolean) {
  await page.addInitScript(({ enabled, preferences, key, epoch }) => {
    if (sessionStorage.getItem("companion-100-default-seed")) return;
    sessionStorage.setItem("companion-100-default-seed", "1");
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic.reduceMotion": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled, roam: false, jump: false, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { enabled, preferences: DEFAULT_COMPANION_PREFERENCES, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH });
}
const panel = (page: Page, key: string) => page.locator(`[data-panel-section="${key}"]:visible`);
async function disclosure(page: Page, key: string, expanded: boolean) {
  const target = panel(page, key);
  await expect(target.locator("[data-panel-section-toggle]")).toHaveAttribute("aria-expanded", String(expanded));
  if (expanded) await expect(target.locator(".panel-section-body")).toBeVisible();
  else await expect(target.locator(".panel-section-body")).toBeHidden();
}
for (const surface of ["viewer", "studio"] as const) {
  const url = surface === "studio" ? "/visual-fixture/studio?role=owner" : "/visual-fixture/poster?avatar=1";
  test(`${surface} first enabled visit folds untouched panels and preserves native choices across reload and route changes`, async ({ page }) => {
    await seed(page, true); await page.goto(url); await expect(page.locator(".vc-home")).toHaveCount(1);
    await disclosure(page, "tag-filter", false); await disclosure(page, "season", false); await disclosure(page, "companion-home", true);
    expect(await page.evaluate(() => localStorage.getItem("vic.panelSections"))).toBeNull();
    await settlePanelLayout(page);
    const clip = await page.evaluate(() => {
      const rects = ["tag-filter", "season", "companion-home"].map(key => document.querySelector(`[data-panel-section="${key}"]`)!.getBoundingClientRect());
      const x = Math.min(...rects.map(rect => rect.left)), y = Math.min(...rects.map(rect => rect.top));
      return { x, y, width: Math.max(...rects.map(rect => rect.right)) - x, height: Math.max(...rects.map(rect => rect.bottom)) - y };
    });
    // Static default chrome only. Creature behavior is measured by the other
    // native witnesses; its moving body is not a panel-layout baseline.
    await expect(await page.screenshot({ clip, animations: "disabled", style: ".vc-companion,.vc-food-layer,.vc-bed-foreground{visibility:hidden!important}" })).toMatchSnapshot(`${surface}-companion-default-panels.png`);
    await panel(page, "tag-filter").getByRole("button", { name: "태그 필터", exact: true }).click();
    await disclosure(page, "tag-filter", true); await disclosure(page, "season", false);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.panelSections")!))).toEqual({ version: 1, "tag-filter": true });
    await page.reload(); await expect(page.locator(".vc-home")).toHaveCount(1);
    await disclosure(page, "tag-filter", true); await disclosure(page, "season", false); await disclosure(page, "companion-home", true);
    await panel(page, "companion-home").getByRole("button", { name: "빅타민 집", exact: true }).click();
    await disclosure(page, "companion-home", false);
    await page.goto(surface === "studio" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
    await disclosure(page, "tag-filter", true); await disclosure(page, "season", false); await disclosure(page, "companion-home", false);
    await page.goto(url); await disclosure(page, "tag-filter", true); await disclosure(page, "season", false); await disclosure(page, "companion-home", false);
  });
  test(`${surface} explicit companion OFF keeps first-visit ordinary panels open`, async ({ page }) => {
    await seed(page, false); await page.goto(url);
    await disclosure(page, "tag-filter", true); await disclosure(page, "season", true);
    await expect(page.locator(".vc-companion,.vc-home")).toHaveCount(0);
  });
}

import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

type Surface = "viewer" | "studio";
type Evidence = { errors: string[]; mutations: string[]; assets: string[]; checkpoints: unknown[] };
const evidence = new WeakMap<Page, Evidence>();
const prefix = process.env.VIC_COMPANION_APPEARANCE_PREFIX ?? ".scratch-pw/companion-077-appearance";
const pet = (page: Page) => page.locator(".vc-companion");
const routeFor = (surface: Surface) => surface === "viewer" ? "/visual-fixture/poster?avatar=1&signedIn=0" : "/visual-fixture/studio?role=developer";

test.beforeEach(async ({ page }) => {
  const proof: Evidence = { errors: [], mutations: [], assets: [], checkpoints: [] };
  evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  page.on("request", request => { const path = new URL(request.url()).pathname; if (/\/(?:companion\/|premiere\/vitamin-audience\.webp)/.test(path)) proof.assets.push(path); });
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      proof.mutations.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 500, body: "fixture mutation blocked" });
    }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
  await page.addInitScript(({ epochKey, epoch, preferences, care }) => {
    localStorage.setItem(epochKey, epoch);
    for (const [key, value] of Object.entries({ "vic.dark": "on", "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
    // These four appearance cases explicitly opt in. The global layout
    // fixture's saved OFF is intentionally not mistaken for a user choice.
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic_panel_collapsed"); localStorage.removeItem("vic.panelSections");
  }, { epochKey: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false },
    care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
});

test.afterEach(async ({ page }, info) => {
  await mkdir(".scratch-pw", { recursive: true });
  await writeFile(`${prefix}-${info.title.replace(/[^a-z0-9]+/gi, "-")}.json`, JSON.stringify(evidence.get(page), null, 2));
  expect(evidence.get(page)!.mutations).toEqual([]);
  expect(evidence.get(page)!.errors).toEqual([]);
});

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

async function snapshot(page: Page, label: string) {
  const metrics = await page.evaluate(() => {
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const visible = (node: Element) => { const css = getComputedStyle(node), r = node.getBoundingClientRect(); return r.width > 0 && r.height > 0 && css.display !== "none" && css.visibility !== "hidden"; };
    const image = document.querySelector<HTMLImageElement>(".vc-texture");
    return { viewport: { width: innerWidth, height: innerHeight, clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }, theme: document.documentElement.dataset.theme,
      pet: [...document.querySelectorAll(".vc-companion")].map(node => ({ ...rect(node), hidden: (node as HTMLElement).hidden, state: (node as HTMLElement).dataset.state, support: (node as HTMLElement).dataset.platform })),
      rooms: [...document.querySelectorAll(".vc-home")].filter(visible).map(rect),
      texture: image ? { loaded: image.complete, width: image.naturalWidth, height: image.naturalHeight } : null,
      dialogs: [...document.querySelectorAll('[role="dialog"]')].filter(visible).map(rect) };
  });
  evidence.get(page)!.checkpoints.push({ label, metrics });
  expect(metrics.theme).toBe("dark");
  expect(metrics.viewport.scrollWidth).toBeLessThanOrEqual(metrics.viewport.clientWidth + 1);
  await page.screenshot({ path: `${prefix}-${label}.png` });
}

/** Contrast uses computed foreground and the ancestor background stack.
 * No text/identity is retained, and this is not a whole-page WCAG audit. */
async function contrast(node: Locator) {
  return node.evaluate(element => {
    const rgb = (value: string) => {
      const context = document.createElement("canvas").getContext("2d")!;
      context.fillStyle = value; context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data].map((v, index) => index === 3 ? v / 255 : v);
    };
    let background = [255, 255, 255, 1];
    const ancestors: Element[] = [];
    for (let parent: Element | null = element; parent; parent = parent.parentElement) ancestors.unshift(parent);
    for (const parent of ancestors) {
      const color = rgb(getComputedStyle(parent).backgroundColor), alpha = color[3];
      background = color.slice(0, 3).map((v, index) => v * alpha + background[index] * (1 - alpha));
    }
    const css = getComputedStyle(element), foreground = rgb(css.color);
    const displayed = foreground.slice(0, 3).map((v, index) => v * foreground[3] + background[index] * (1 - foreground[3]));
    const luminance = (channels: number[]) => channels.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, index) => sum + v * [.2126, .7152, .0722][index], 0);
    const a = luminance(displayed), b = luminance(background);
    return { ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), color: css.color, background, fontSize: Number.parseFloat(css.fontSize) };
  });
}

test.describe("desktop dark appearance", () => {
  test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
  for (const surface of ["viewer", "studio"] as const) test(`${surface} dark room and every companion pane remain readable in wide and compact desktop`, async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto(routeFor(surface)); await page.bringToFront(); await settle(page);
    await expect(pet(page)).toBeVisible(); await expect(pet(page).locator(".vc-texture")).toHaveCount(1);
    const home = await openCompanionHome(page);
    await home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 6000 });
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    await expect(page.locator(".vc-bed-foreground")).toBeVisible();
    const homeTitle = home.locator(".panel-section-toggle > span");
    const titleContrast = await contrast(homeTitle); evidence.get(page)!.checkpoints.push({ label: "home-title-contrast", value: titleContrast });
    expect(titleContrast.ratio).toBeGreaterThanOrEqual(4.5);
    await snapshot(page, `${surface}-wide-room`);
    await page.getByRole("button", { name: "설정", exact: true }).click();
    const settings = page.getByRole("dialog", { name: "설정", exact: true }); await waitForOverlayEntrance(settings);
    await settings.getByRole("tab", { name: "빅타민", exact: true }).click();
    const pane = settings.locator("#rhh-tab-companion-panel");
    for (const name of ["움직임", "장난", "교감", "프로필"]) {
      await pane.getByRole("tab", { name, exact: true }).click(); await settle(page);
      const content = pane.getByRole("tabpanel"); await expect(content).toHaveCount(1); await expect(content).toBeVisible();
      const labels = content.locator(".rhh-label"); expect(await labels.count()).toBeGreaterThan(0);
      const values = [];
      for (let index = 0; index < await labels.count(); index++) { const value = await contrast(labels.nth(index)); values.push(value); expect(value.ratio).toBeGreaterThanOrEqual(4.5); }
      evidence.get(page)!.checkpoints.push({ label: `settings-${name}-contrast`, values });
      // Unselected choices still need to be readable. Their inactive state
      // is not permission to make radio/tab text blend into the dark track.
      // Selected cells have a separate sibling thumb, so this computation
      // deliberately measures only the unselected cells' ancestor stack.
      const inactive = [];
      for (const option of await pane.locator(".rhh-seg button:not(.on)").all()) {
        if (!await option.isVisible()) continue;
        inactive.push(await contrast(option));
      }
      evidence.get(page)!.checkpoints.push({ label: `settings-${name}-inactive-contrast`, values: inactive });
      for (const value of inactive) expect(value.ratio).toBeGreaterThanOrEqual(4.5);
      const bounds = (await settings.boundingBox())!;
      for (const control of await content.locator("button").all()) {
        if (!await control.isVisible()) continue;
        const r = (await control.boundingBox())!;
        expect(r.x).toBeGreaterThanOrEqual(bounds.x - 1); expect(r.x + r.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
      }
      await snapshot(page, `${surface}-wide-settings-${name}`);
    }
    await settings.locator(".modal-head .modal-close").click(); await expect(settings).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 900 }); await settle(page);
    await openCompanionHome(page); await settle(page);
    await expect(pet(page)).toHaveCount(1);
    const compact = page.getByRole("region", { name: "빅타민 집", exact: true });
    const r = (await compact.boundingBox())!;
    expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(1281); expect(r.y + r.height).toBeLessThanOrEqual(901);
    await snapshot(page, `${surface}-compact-room`);
  });
});

test.describe("native390 dark appearance", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  for (const surface of ["viewer", "studio"] as const) test(`${surface} dark mobile keeps the left gear and right account readable without mounting any pet`, async ({ page }) => {
    await page.goto(routeFor(surface)); await settle(page);
    await expect(page.locator(".vc-companion,.vc-home,.vc-food,.vc-food-layer,.vc-compact-home,.vc-bed-foreground,.pm-fan,.pm-cast-row")).toHaveCount(0);
    const gear = page.locator(surface === "viewer" ? ".agenda-header > .viewer-settings-open" : ".m-month-nav > .viewer-settings-open");
    const account = page.locator(surface === "viewer" ? ".agenda-account button" : ".m-head-logout button");
    const month = page.locator(surface === "viewer" ? ".agenda-title .month-title-text" : ".m-month-switch .month-title-text strong");
    await expect(gear).toBeVisible(); await expect(account).toBeVisible(); await expect(month).toBeVisible();
    const g = (await gear.boundingBox())!, a = (await account.boundingBox())!, m = (await month.boundingBox())!;
    expect(g.width).toBeGreaterThanOrEqual(43.9); expect(g.height).toBeGreaterThanOrEqual(43.9);
    expect(a.height).toBeGreaterThanOrEqual(43.9);
    expect(g.x + g.width).toBeLessThan(m.x); expect(a.x).toBeGreaterThan(390 / 2);
    expect(a.x + a.width).toBeLessThanOrEqual(391); expect(a.x).toBeGreaterThan(g.x + g.width);
    const value = await contrast(month); evidence.get(page)!.checkpoints.push({ label: "mobile-header", gear: g, account: a, month: m, contrast: value });
    expect(value.ratio).toBeGreaterThanOrEqual(4.5);
    await snapshot(page, `${surface}-mobile-header`);
    await gear.tap(); const settings = page.getByRole("dialog", { name: "설정", exact: true }); await waitForOverlayEntrance(settings);
    await expect(settings.getByRole("tab", { name: "빅타민", exact: true })).toHaveCount(0);
    await expect(settings.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true })).toHaveCount(0);
    await expect(settings.locator(".modal-head .modal-close")).toBeVisible();
    await snapshot(page, `${surface}-mobile-settings`);
    await settings.locator(".modal-head .modal-close").tap(); await expect(settings).toHaveCount(0); await expect(gear).toBeFocused();
    expect(evidence.get(page)!.assets).toEqual([]);
  });
});

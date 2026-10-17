import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

type Departure = { at: number; remaining: number; progress: number; opacity: number; transform: string; inert: boolean; ariaHidden: string | null; launcherRegion: boolean; headerRegion: boolean };
type Evidence = { writes: string[]; errors: string[]; target: number | null; samples: Departure[]; saved?: Record<string, string | null> };
const evidence = new WeakMap<Page, Evidence>();
const savedKeys = ["vic.viewerCompanion", "vic.panelSections", "vic.premiereStage", "vic_avatar_side", "vic_panel_collapsed", "vic.reduceMotion", "vic.gfxPref"];
const pet = (page: Page) => page.locator(".vc-companion");
const launcher = (page: Page) => page.locator(".vc-home-launcher");
const compact = (page: Page) => page.locator(".vc-home-shelf-slot > .vc-compact-home");
const house = (page: Page) => compact(page).locator(".vc-home");

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const proof: Evidence = { writes: [], errors: [], target: null, samples: [] }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" });
    }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
  await page.addInitScript(({ epoch, epochKey, preferences, care }) => {
    // Saved device preferences only. Native focus/input, the real fixture
    // deadline and both browser clocks remain untouched.
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.premiereStage": "on", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: false, feeding: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: 1 }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE });
});
test.afterEach(async ({ page }, info) => {
  const diagnostic = await page.evaluate(keys => ({
    actualFocus: document.hasFocus(), visibility: document.visibilityState, scrollX, scrollY,
    preferences: Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])),
    nodes: [...document.querySelectorAll<HTMLElement>(".vc-home-launcher,.vc-compact-home,.vc-home,.vc-companion,.public-calendar-header,.pm-stage")].map(node => {
      const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
      return { className: node.className, hidden: node.hidden, inert: node.inert, ariaHidden: node.getAttribute("aria-hidden"), region: node.hasAttribute("data-pm-region-active"), exit: node.getAttribute("data-pm-exit"), progress: node.style.getPropertyValue("--pm-region"), opacity: style.opacity, transform: style.transform, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }),
  }), savedKeys).catch(error => ({ observationError: String(error) }));
  await writeFile(info.outputPath("premiere-home-shelf.json"), JSON.stringify({ title: info.title, status: info.status, ...evidence.get(page), diagnostic }, null, 2));
  await page.screenshot({ path: info.outputPath("premiere-home-shelf.png"), fullPage: true }).catch(() => {});
  expect(evidence.get(page)?.writes).toEqual([]); expect(evidence.get(page)?.errors).toEqual([]);
});

test("compact viewer house withdraws once with group5 and its real controls recover after Escape", async ({ page }) => {
  test.setTimeout(35_000);
  await page.goto("/visual-fixture/poster?avatar=1&premiere=170", { waitUntil: "domcontentloaded" });
  await page.bringToFront();
  // Open immediately through the actual launcher before group5 starts at
  // T-166. Keep four real seconds for hydration without changing either clock.
  await expect(launcher(page)).toBeVisible(); await launcher(page).click();
  await expect(compact(page)).toBeVisible(); await expect(house(page)).toHaveCount(1);
  await expect(pet(page)).toHaveCount(1);
  const targetText = await page.locator("[data-eventid='00000000-0000-4000-8000-000000000001'][data-teaser-at]").first().getAttribute("data-teaser-at");
  const target = Date.parse(targetText ?? ""); expect(Number.isFinite(target)).toBe(true); evidence.get(page)!.target = target;
  const initial = await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), savedKeys);
  evidence.get(page)!.saved = initial;
  const roomIdentity = (await compact(page).elementHandle())!, launcherIdentity = (await launcher(page).elementHandle())!, petIdentity = (await pet(page).elementHandle())!;
  const roomId = await compact(page).getAttribute("id"); expect(roomId).toBeTruthy();
  await expect(launcher(page)).toHaveAttribute("aria-controls", roomId!);
  await expect(compact(page)).toHaveAttribute("data-pm-exit", "5");
  await expect(compact(page)).toHaveAttribute("data-pm-region-active", "");
  // The header owns its launcher presentation. A second region on the
  // nested button would compound the departure transform and opacity.
  await expect(launcher(page)).not.toHaveAttribute("data-pm-region-active");
  await expect(house(page)).not.toHaveAttribute("data-pm-region-active");
  await expect(page.locator(".public-calendar-header")).toHaveAttribute("data-pm-region-active", "");

  for (let index = 0; index < 90; index++) {
    const sample = await compact(page).evaluate((node, target): Departure => {
      const element = node as HTMLElement;
      return {
        at: performance.now(), remaining: target - Date.now(), progress: Number(element.style.getPropertyValue("--pm-region")),
        opacity: Number(getComputedStyle(element).opacity), transform: getComputedStyle(element).transform, inert: element.inert, ariaHidden: element.getAttribute("aria-hidden"),
        launcherRegion: Boolean(document.querySelector(".vc-home-launcher[data-pm-region-active]")), headerRegion: Boolean(document.querySelector(".public-calendar-header[data-pm-region-active]")),
      };
    }, target);
    evidence.get(page)!.samples.push(sample);
    if (sample.progress > .99 && sample.opacity < .02) break;
    await page.waitForTimeout(100);
  }
  const samples = evidence.get(page)!.samples;
  expect(samples.some(sample => sample.progress > .1 && sample.progress < .9)).toBe(true);
  expect(samples.at(-1)!.progress).toBeGreaterThan(.99); expect(samples.at(-1)!.opacity).toBeLessThan(.02);
  expect(samples.every(sample => !sample.launcherRegion && sample.headerRegion)).toBe(true);
  for (const node of [compact(page), house(page), launcher(page)]) {
    await expect(node).toHaveAttribute("inert"); await expect(node).toHaveAttribute("aria-hidden", "true");
  }
  await page.screenshot({ path: test.info().outputPath("group5-departed.png"), fullPage: true });

  await page.keyboard.press("Escape"); await expect(page.locator(".pm-stage")).not.toBeVisible();
  for (const node of [compact(page), house(page), launcher(page)]) {
    await expect(node).not.toHaveAttribute("inert"); await expect(node).not.toHaveAttribute("aria-hidden", "true");
  }
  await expect(compact(page)).toBeVisible(); await expect(house(page)).toBeVisible(); await expect(launcher(page)).toBeVisible();
  await expect.poll(() => compact(page).evaluate(node => (node as HTMLElement).style.getPropertyValue("--pm-region"))).toBe("");
  await expect.poll(() => compact(page).evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(.95);
  expect(await roomIdentity.evaluate(node => node.isConnected && node === document.querySelector(".vc-compact-home"))).toBe(true);
  expect(await launcherIdentity.evaluate(node => node.isConnected && node === document.querySelector(".vc-home-launcher"))).toBe(true);
  expect(await petIdentity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);

  // Real clicks exercise both React ownership and inherited inert cleanup;
  // an enabled attribute alone cannot prove that the controls work again.
  await launcher(page).click(); await expect(compact(page)).toBeHidden(); await expect(house(page)).toHaveCount(0);
  await expect(launcher(page)).toHaveAttribute("aria-expanded", "false");
  await launcher(page).click(); await expect(house(page)).toBeVisible();
  await expect(page.locator(".vc-home")).toHaveCount(1); await expect(pet(page)).toHaveCount(1);
  await house(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  await expect(page.locator(".vc-food")).toHaveCount(1);
  expect(await page.evaluate(keys => Object.fromEntries(keys.map(key => [key, localStorage.getItem(key)])), savedKeys)).toEqual(initial);
  await expect(launcher(page)).toHaveAttribute("aria-controls", roomId!);
  await expect(compact(page)).toHaveAttribute("id", roomId!);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

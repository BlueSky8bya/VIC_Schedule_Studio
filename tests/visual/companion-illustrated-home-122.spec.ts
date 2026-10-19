import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { COMPANION_SCENE_MEMORY_KEY, type CompanionSceneMemory } from "@/lib/ui/viewer-companion/scene-memory";
import { openCompanionHome } from "./helpers/companion-home";

const out = process.env.COMPANION_HOME_UI_OUTPUT ?? ".scratch-pw/companion-122/rendered";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
async function fixture(page: Page, options: { personality?: CompanionPreferences["personality"]; roam?: boolean; sleep?: boolean; energy?: number; hunger?: number; theme?: string; surface?: string; season?: string; animal?: CompanionPreferences["animalMode"]; sceneMemory?: CompanionSceneMemory; reduce?: boolean; graphics?: "off" | "soft"; weather?: string } = {}) {
  const posts: string[] = [], foreign: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      foreign.push(url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { posts.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "No fixture writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live API in fixture" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, memory, epoch, epochKey, options, sceneKey }) => {
    if (options.sceneMemory) localStorage.setItem(sceneKey, JSON.stringify(options.sceneMemory));
    const saved = { version: 1, ...prefs, enabled: true, activeWhileVisible: true, sleep: options.sleep ?? false, roam: options.roam ?? false, personality: options.personality ?? "curious", animalMode: options.animal ?? "default", sound: false, ambientPrank: true };
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify(saved), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: options.energy ?? .8, hunger: options.hunger ?? .1 }), "vic.gfx": JSON.stringify({ mode: options.graphics ?? "full", at: Date.now(), v: 3 }), "vic.gfxPref": options.graphics === "off" ? "off" : options.graphics === "soft" ? "auto" : "max", "vic.reduceMotion": options.reduce ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": options.theme === "dark" ? "on" : "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, options, sceneKey: COMPANION_SCENE_MEMORY_KEY });
  await page.goto(options.surface === "studio" ? "/visual-fixture/studio?role=owner&y=2025&m=11&ambient=" + (options.season ?? "autumn") + "&weather=" + (options.weather ?? "clear") : "/visual-fixture/poster?avatar=1&ambient=" + (options.season ?? "autumn"));
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => await page.getByRole("region", { name: "빅타민 집", exact: true }).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  await openCompanionHome(page);
  const room = page.getByRole("region", { name: "빅타민 집", exact: true });
  await expect(room).toBeVisible();
  // Opening uses the shared finite spring on ancestors. Measure real stable
  // hit planes after it finishes; hover must not be blamed for that entrance.
  await expect.poll(() => room.evaluate(node => {
    for (let parent: Element | null = node; parent; parent = parent.parentElement)
      if (parent.getAnimations().some(animation => animation.playState === 'running' && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))) return false;
    return true;
  })).toBe(true);
  return { room, posts, foreign, errors, async verify() { expect(errors).toEqual([]); expect(posts).toEqual([]); expect(foreign).toEqual([]); } };
}

async function decodedArt(page: Page) {
  const images = page.locator('.vc-home-room img');
  const result = await images.evaluateAll(async nodes => Promise.all(nodes.map(async node => {
    const image = node as HTMLImageElement;
    await image.decode();
    return { src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight };
  })));
  expect(result.every(image => image.width > 0 && image.height > 0)).toBe(true);
  expect(result.filter(image => image.src?.includes('/furniture-'))).toHaveLength(5);
  return result;
}

for (const [surface, width, theme] of [["viewer", 1440, "light"], ["studio", 1920, "dark"], ["studio", 2400, "light"]] as const) test(`122 illustrated home real furniture and separate hit planes: ${surface} ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  const state = await fixture(page, { surface, theme });
  const art = await decodedArt(page), targets: { action: string; x: number; y: number; width: number; height: number }[] = [];
  for (const action of ['book', 'radio', 'home', 'toys', 'feed', 'clearFood']) {
    const button = state.room.locator(`[data-home-action="${action}"]`), rect = (await button.boundingBox())!;
    expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(await button.evaluate(node => {
      const r = node.getBoundingClientRect();
      // Rounded corners deliberately exclude their transparent corner pixels.
      // Check the center and each actual edge rather than the cut-out corners.
      return [[r.x + 3, r.y + r.height / 2], [r.right - 3, r.y + r.height / 2], [r.x + r.width / 2, r.y + 3], [r.x + r.width / 2, r.bottom - 3], [r.x + r.width / 2, r.y + r.height / 2]].every(([x, y]) => { const hit = document.elementFromPoint(x, y); return hit === node || node.contains(hit); });
    }), action + ' owns every part of its native target').toBe(true);
    targets.push({ action, ...rect });
  }
  const get = (action: string) => targets.find(target => target.action === action)!;
  expect(get('toys').x - get('feed').x - get('feed').width).toBeGreaterThanOrEqual(7);
  expect(get('clearFood').y - get('toys').y - get('toys').height).toBeGreaterThanOrEqual(7);
  const glass = (await state.room.locator('.vc-window-glass').boundingBox())!;
  const sofa = (await state.room.locator('.vc-plush-bed').boundingBox())!;
  // The shorter room may place the sill behind the transparent top of the
  // sofa target. Its unchanged outer path starts at y7/100; visible glass
  // stays clear. The124 suite also rasterizes actual alpha intersections.
  expect(glass.y + glass.height).toBeLessThanOrEqual(sofa.y + sofa.height * .07 + .5);
  mkdirSync(out, { recursive: true }); writeFileSync(`${out}/home-${surface}-${width}.json`, JSON.stringify({ art, targets }, null, 2));
  await state.room.screenshot({ path: `${out}/home-${surface}-${width}.png` });
  await state.verify();
});

test('122 whole-object hover visibly lifts and presses without moving actual anchors', async ({ page }) => {
  const state = await fixture(page);
  for (const action of ['book', 'radio', 'toys', 'feed', 'clearFood']) {
    const button = state.room.locator(`[data-home-action="${action}"]`), art = button.locator('.vc-object-paint');
    await page.mouse.move(2, 2);
    await expect(art).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    const hitBefore = (await button.boundingBox())!, before = (await art.boundingBox())!;
    const outlet = state.room.locator('.vc-dispenser-slot'), slotBefore = (await outlet.boundingBox())!;
    await button.hover();
    await expect.poll(async () => (await art.boundingBox())!.width / before.width).toBeGreaterThan(1.045);
    const hitHover = (await button.boundingBox())!, slotHover = (await outlet.boundingBox())!;
    expect(hitHover).toEqual(hitBefore); expect(slotHover).toEqual(slotBefore);
    await page.mouse.down(); await expect(art).toHaveCSS('filter', 'brightness(0.94)');
    await page.mouse.move(2, 2); await page.mouse.up();
    await expect(art).toHaveCSS('filter', 'none');
    await expect(art).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  }
  await state.verify();
});

for (const mode of ['reduced', 'off', 'soft'] as const) test('122 furniture retains static affordance in quiet mode: ' + mode, async ({ page }) => {
  const state = await fixture(page, mode === 'reduced' ? { reduce: true } : { graphics: mode });
  await decodedArt(page);
  for (const action of ['book', 'radio', 'toys', 'feed', 'clearFood']) {
    const button = state.room.locator(`[data-home-action="${action}"]`), art = button.locator('.vc-object-paint');
    await button.hover(); await expect(art).toHaveCSS('filter', 'brightness(1.08)'); await expect(art).toHaveCSS('transform', 'none');
    await page.mouse.down(); await expect(art).toHaveCSS('filter', 'brightness(0.94)');
    await page.mouse.move(2, 2); await page.mouse.up(); await page.locator('.vc-actor').focus();
    await expect(art).toHaveCSS('filter', 'none');
    await button.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    await expect(button).toBeFocused(); await expect(art).toHaveCSS('filter', 'brightness(1.08)');
  }
  await state.verify();
});

for (const [season, weather] of [['spring', 'rain'], ['summer', 'clear'], ['autumn', 'fog'], ['winter', 'snow']] as const) test(`122 generated landscape follows viewed season and shared weather: ${season} ${weather}`, async ({ page }) => {
  const state = await fixture(page, { surface: 'studio', season, weather });
  const window = state.room.locator('.vc-home-window');
  await expect(window).toHaveAttribute('data-season', season); await expect(window).toHaveAttribute('data-weather', weather);
  const phase = await window.getAttribute('data-phase');
  expect(['dawn', 'day', 'dusk', 'night']).toContain(phase);
  await expect(window.locator('.vc-window-landscape')).toHaveAttribute('src', `/companion/home/125/window-${season}-${phase}.webp`);
  expect(await window.locator('svg').count()).toBe(0);
  await decodedArt(page);
  if (weather === 'rain' || weather === 'snow') await expect(window.locator('.vc-window-weather')).toHaveAttribute('src', `/companion/home/124/window-${weather}-overlay.webp`);
  else if (weather === 'fog') {
    await expect(window.locator('.vc-window-weather')).toHaveCount(1);
    await expect(window.locator('.vc-window-weather')).toHaveAttribute('src', '/companion/home/124/window-fog-overlay.webp');
  }
  else await expect(window.locator('.vc-window-weather')).toHaveCount(0);
  mkdirSync(out, { recursive: true }); await state.room.screenshot({ path: `${out}/landscape-${season}-${weather}.png` });
  await state.verify();
});

import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

// Settings redesign stage 2-가: a sound carries who started it. Real presses on
// the home must arrive at the sound gate marked as the user's, and a snack the
// user took out must still be theirs when it lands. Nothing sounds differently.
test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

const origins = (page: Page) => page.evaluate(() => (window as Window & { __companionSfxOrigins?: string[] }).__companionSfxOrigins ?? []);
const sounds = (page: Page) => page.evaluate(() => (window as Window & { __companionSfxTrace?: string[] }).__companionSfxTrace ?? []);

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 204 }) : route.continue());
  await page.route("**/api/**", route => route.fulfill({ status: 503, body: "fixture" }));
  await page.addInitScript(({ companion }) => {
    // Passive witnesses only: no clock, audio engine or input is replaced.
    const view = window as Window & { __companionSfxOrigins?: string[]; __companionSfxTrace?: string[] };
    view.__companionSfxOrigins = []; view.__companionSfxTrace = [];
    if (localStorage.getItem("fixture.origin")) return;
    localStorage.setItem("fixture.origin", "1");
    for (const [key, value] of Object.entries({ "vic.sound": "on", "vic.soundVol": "45", "vic.reduceMotion": "off", "vic.ambient": "off", "vic.soundCats": JSON.stringify({ tap: false, ui: false, celebrate: false, edit: false, alert: false }) })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify(companion));
  }, { companion: { version: 1, ...DEFAULT_COMPANION_PREFERENCES, roam: false, jump: false, sleep: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false } });
});

test("pressing the dispenser: the snack comes out and lands as the user's", async ({ page }) => {
  await page.goto("/visual-fixture/poster");
  const slot = page.locator(".vc-home .vc-dispenser-slot");
  await expect(slot).toBeVisible();
  await slot.click();
  // The companion may make a sound of its own meanwhile (a first-seen pose is a discovery); only this snack's sounds are checked.
  const snack = async () => (await origins(page)).filter(entry => /^(feed|land):/.test(entry));
  await expect.poll(snack, { timeout: 15000 }).toEqual(["feed:direct", "land:direct"]);
  // The sounds themselves are the ones that played before this stage, and anything else was not the user's.
  expect((await sounds(page)).filter(moment => moment === "feed" || moment === "land")).toEqual(["feed", "land"]);
  for (const entry of (await origins(page)).filter(entry => !/^(feed|land):/.test(entry))) expect(entry).toMatch(/:auto$/);
});

test("calling it home on the cushion is the user's", async ({ page }) => {
  await page.goto("/visual-fixture/poster");
  const cushion = page.locator(".vc-home .vc-cushion-button");
  await expect(cushion).toBeVisible();
  // The companion often sits right on the cushion; a real key press reaches the button either way.
  await cushion.focus(); await page.keyboard.press("Enter");
  await expect.poll(() => origins(page), { timeout: 10000 }).toContain("cushion:direct");
  // Whatever it does after arriving is its own: no later sound may borrow the user's mark.
  await page.waitForTimeout(6000);
  for (const entry of (await origins(page)).filter(entry => !entry.startsWith("cushion:"))) expect(entry).toMatch(/:auto$/);
});

test("picking it up and throwing it: the lift and the landing are the user's", async ({ page }) => {
  await page.goto("/visual-fixture/poster");
  const pet = page.locator(".vc-companion button").first();
  await expect(pet).toBeVisible({ timeout: 15000 });
  const box = (await pet.boundingBox())!;
  const from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  // A real drag with speed at release: most releases are throws, whose landing leg is a new action.
  for (let step = 1; step <= 12; step += 1) await page.mouse.move(from.x - step * 22, from.y - step * 14);
  await page.mouse.up();
  await expect.poll(() => origins(page), { timeout: 15000 }).toEqual(expect.arrayContaining(["lift:direct", "land:direct"]));
  expect((await origins(page)).filter(entry => entry.startsWith("land:"))).toEqual(["land:direct"]);
});

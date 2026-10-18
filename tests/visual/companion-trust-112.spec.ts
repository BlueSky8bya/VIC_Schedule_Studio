import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

for (const surface of ["viewer", "studio"] as const) for (const gesture of ["circle", "fling"] as const) test(`112 ${surface}: native ${gesture} rough handling loses affection once and learns caution`, async ({ page }) => {
  test.setTimeout(45000);
  const errors: string[] = [], writes: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method())) { writes.push(url.pathname); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live reads" });
    return route.continue();
  });
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript(({ prefs, care, epoch, key }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, sleep: false, feeding: false, drag: true, petting: true, learnFromYou: true }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .1, affection: .8, energy: .9 }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.bringToFront();
  const actor = page.locator(".vc-actor"), pet = page.locator(".vc-companion");
  await expect(actor).toBeVisible();
  const box = (await actor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(900, 500, { steps: 8 });
  if (gesture === "circle") {
    for (let i = 0; i <= 40; i++) {
      const angle = i / 12 * Math.PI * 2;
      await page.mouse.move(900 + Math.cos(angle) * 105, 500 + Math.sin(angle) * 105);
      await page.waitForTimeout(32);
    }
    await expect(pet).toHaveAttribute("data-held-dizzy", "");
  }
  const held = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!));
  expect(held.affection).toBeCloseTo(gesture === "circle" ? .64 : .8, 2);
  if (gesture === "circle") await page.waitForTimeout(120);
  else for (let index = 1; index <= 5; index++) { await page.waitForTimeout(16); await page.mouse.move(900 + index * 70, 500 - index * 25); }
  await page.mouse.up();
  if (gesture === "fling") await expect(pet).toHaveAttribute("data-throw-phase", /launch|rise|apex|fall|landing/);
  await expect(pet).not.toHaveAttribute("data-state", "held");
  await expect.poll(() => pet.getAttribute("data-state"), { timeout: 6000 }).not.toBe("jump");
  const released = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!));
  expect(released.affection).toBeCloseTo(.64, 2); expect(released.habits.confidence).toBeLessThan(-.12);
  if (gesture === "circle") expect(released.habits.confidence).toBe(held.habits.confidence);
  expect(errors).toEqual([]); expect(writes).toEqual([]); await expect(pet).toHaveCount(1);
  const build = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const directory = `.scratch-pw/companion-112/trust/${build}`; mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/${surface}-${gesture}.json`, JSON.stringify({ build, gesture, held, released, errors, writes }, null, 2));
  await page.screenshot({ path: `${directory}/${surface}-${gesture}.png` });
});

import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { COMPANION_PANEL_PREVIEW_MS, COMPANION_PANEL_SIDE_EVENT } from "@/lib/ui/viewer-companion/panel-play";

const prefix = process.env.COMPANION_PANEL_PREFIX ?? ".scratch-pw/companion-069-panel";
const observations = new WeakMap<Page, { posts: string[]; errors: string[] }>();
test.use({ viewport: { width: 1920, height: 1100 }, hasTouch: false, isMobile: false });
test.beforeEach(async ({ page }) => {
  const observed = { posts: [] as string[], errors: [] as string[] }; observations.set(page, observed);
  page.on("pageerror", error => observed.errors.push(error.message));
  await page.route("**/*", route => ["POST", "PUT", "PATCH", "DELETE"].includes(route.request().method()) ? (observed.posts.push(route.request().method() + " " + new URL(route.request().url()).pathname), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(observations.get(page)).toEqual({ posts: [], errors: [] }); });

for (const surface of ["viewer", "studio"] as const) test(`${surface} actual arrow perch, reversible local side and a human choice superseding play`, async ({ page }) => {
  test.setTimeout(35000);
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.removeItem("vic_panel_collapsed");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  const pet = page.locator(".vc-companion"), actor = pet.locator(".vc-actor"), left = page.getByRole("button", { name: "패널을 왼쪽에 두기", exact: true }), right = page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true });
  await expect(actor).toBeVisible(); await expect(pet).toHaveAttribute("data-atlas", "hd");
  await expect(left).toHaveAttribute("aria-pressed", "true"); await expect(right).toBeVisible();
  // Native pointer input places the foot just above the actual measured arrow.
  const body = (await actor.boundingBox())!, carrier = (await pet.boundingBox())!, arrow = (await right.boundingBox())!;
  const start = { x: body.x + body.width / 2, y: body.y + body.height / 2 };
  const footOffset = carrier.y + carrier.height - start.y;
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(arrow.x + arrow.width / 2, arrow.y - 4 - footOffset, { steps: 18 }); await page.mouse.up();
  await expect(pet).toHaveAttribute("data-platform", "panel-side-right");
  const perch = await pet.evaluate(node => {
    const control = document.querySelector("[data-companion-panel-side='right']")!, body = node.getBoundingClientRect(), arrow = control.getBoundingClientRect();
    const hit = document.elementFromPoint(arrow.left + arrow.width / 2, arrow.top + arrow.height / 2);
    return { foot: body.bottom, top: arrow.top, controlReachable: hit === control || control.contains(hit) };
  });
  expect(Math.abs(perch.foot - (perch.top - 3))).toBeLessThan(2); expect(perch.controlReachable).toBe(true);
  // This controlled capability invocation verifies the shared callback's
  // lifetime; the 90s/5.5% natural decision and gates have seeded unit coverage.
  const request = () => right.evaluate((node, name) => !node.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable: true, detail: { side: "right" } })), COMPANION_PANEL_SIDE_EVENT);
  expect(await request()).toBe(true); await expect(right).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("vic_avatar_side"))).toBe("left");
  await expect(left).toHaveAttribute("aria-pressed", "true", { timeout: COMPANION_PANEL_PREVIEW_MS + 1500 });
  expect(await request()).toBe(true); await expect(right).toHaveAttribute("aria-pressed", "true");
  await right.click();
  expect(await page.evaluate(() => localStorage.getItem("vic_avatar_side"))).toBe("right");
  await page.waitForTimeout(COMPANION_PANEL_PREVIEW_MS + 150);
  await expect(right).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ path: `${prefix}-${surface}.png` });
  await writeFile(`${prefix}-${surface}.json`, JSON.stringify({ surface, perch, savedSide: await page.evaluate(() => localStorage.getItem("vic_avatar_side")), ...observations.get(page) }, null, 2));
});

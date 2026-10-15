import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const cases = [
  { name: "pc-light", width: 1920, height: 1100, touch: false, dark: false },
  { name: "pc-dark", width: 1920, height: 1100, touch: false, dark: true },
  { name: "native390-light", width: 390, height: 844, touch: true, dark: false },
  { name: "landscape-touch-dark", width: 844, height: 390, touch: true, dark: true },
] as const;
const captureLabel = process.env.VIC_PLUSH_BASELINE === "1" ? "before" : "after";
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const foods = (page: Page) => page.locator(".vc-food");
const press = async (node: Locator, touch: boolean) => { if (touch) await node.tap(); else await node.click(); };

/** Real native input. A short stationary tail before touchEnd models a finger
 * stopping at the bin and preserves the first subsequent native control tap. */
async function discardByDrag(page: Page, item: Locator, bin: Locator, touch: boolean) {
  const initial = await foods(page).count();
  const r = (await item.boundingBox())!, b = (await bin.boundingBox())!;
  const start = { x: r.x + r.width / 2, y: r.y + r.height / 2 }, end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  try {
    if (cdp) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 31 }] });
      for (let step = 1; step <= 12; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (end.x - start.x) * step / 12, y: start.y + (end.y - start.y) * step / 12, id: 31 }] });
    } else { await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 12 }); }
    await expect(bin).toHaveAttribute("data-food-over", "");
    await expect.poll(() => bin.evaluate(node => Number((node as HTMLElement).style.getPropertyValue("--vc-trash-progress")))).toBeGreaterThan(0);
    await expect(foods(page)).toHaveCount(initial - 1, { timeout: 2000 });
    await expect(bin).not.toHaveAttribute("data-food-over");
    if (cdp) {
      for (let sample = 0; sample < 4; sample++) {
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
        await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...end, id: 31 }] });
      }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else await page.mouse.up();
  } finally { await cdp?.detach(); }
}

async function liftFromBed(page: Page, touch: boolean, label: string) {
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), pet = page.locator(".vc-companion"), foreground = page.locator(".vc-bed-foreground");
  const r = (await actor.boundingBox())!, start = { x: r.x + r.width / 2, y: r.y + r.height * .4 }, end = { x: start.x, y: start.y - 70 };
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  try {
    if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 41 }] });
    else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    await page.waitForTimeout(450); // Real hold gesture; time has not been mocked.
    if (cdp) for (let step = 1; step <= 12; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x, y: start.y + (end.y - start.y) * step / 12, id: 41 }] });
    else await page.mouse.move(end.x, end.y, { steps: 12 });
    await expect(pet).toHaveAttribute("data-state", "held");
    // The front/side bolsters stay put. Depth comes from lifting the real
    // hanging drawing clear of the central rim, never fading the sofa away.
    await expect(foreground).toBeVisible();
    await expect.poll(() => foreground.evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(.9);
    const rim = (await foreground.boundingBox())!, rimTop = rim.y + rim.height * .54;
    await expect.poll(async () => { const pose = (await pet.locator(".vc-pose").boundingBox())!; return pose.y + pose.height; }).toBeLessThan(rimTop);
    expect(await actor.evaluate(node => { const r = node.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".vc-actor") === node; })).toBe(true);
    await home(page).screenshot({ path: `.scratch-pw/companion-plush-home-${captureLabel}-${label}-lift.png` });
    if (cdp) {
      for (let sample = 0; sample < 4; sample++) { await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...end, id: 41 }] }); }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else await page.mouse.up();
  } finally { await cdp?.detach(); }
  await expect(pet).not.toHaveAttribute("data-state", "held");
}

for (const view of cases) test.describe(view.name, () => {
  test.use({ viewport: { width: view.width, height: view.height }, hasTouch: view.touch, isMobile: view.touch });
  test("the shared warm room preserves its physical anchors and native food controls", async ({ page, context }) => {
    const posts: string[] = [], errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", route => route.request().method() === "POST" ? (posts.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
    await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
    await page.addInitScript(({ key, epoch, dark, prefs, care }) => {
      localStorage.setItem(key, epoch); localStorage.setItem("vic.dark", dark ? "on" : "off");
      localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs })); localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
      localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
      Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
    }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, dark: view.dark, prefs: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: true, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: .9 } });
    await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
    await expect.poll(async () => await home(page).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
    await openCompanionHome(page, view.touch ? "touch" : "pointer");
    await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
    if (view.dark) await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    else await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
    await expect(home(page)).toHaveCount(1);
    const room = home(page).locator(".vc-home-room"); await expect(room).toHaveCSS("height", "132px");
    const metrics = await home(page).evaluate(node => {
      const rect = (selector: string) => { const element = node.querySelector<HTMLElement>(selector)!; const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, filter: getComputedStyle(element).filter }; };
      const room = rect(".vc-home-room"), button = rect(".vc-cushion-button"), cushion = rect(".vc-home-cushion");
      return { room, window: rect(".vc-home-window"), shelf: rect(".vc-home-shelf"), pot: rect(".vc-shelf-pot"), button, cushion, floor: rect(".vc-home-floor"), feed: rect(".vc-dispenser"), slot: rect(".vc-dispenser-slot"), trash: rect(".vc-home-trash"), trashArt: rect(".vc-home-trash > svg"), viewport: { width: innerWidth, height: innerHeight } };
    });
    expect(metrics.room.height).toBeCloseTo(132, 3); expect(metrics.floor.height).toBeCloseTo(36, 3); expect(metrics.floor.bottom).toBeCloseTo(metrics.room.bottom, 3);
    expect(metrics.window.width).toBeCloseTo(64, 3); expect(metrics.window.height).toBeCloseTo(56, 3);
    expect(metrics.window.left - metrics.room.left).toBeCloseTo(20, 3); expect(metrics.window.top - metrics.room.top).toBeCloseTo(14, 3);
    expect(metrics.shelf.height).toBeCloseTo(55, 3); expect(metrics.shelf.top - metrics.room.top).toBeCloseTo(9, 3);
    expect(metrics.button.height).toBeCloseTo(78, 3); expect(metrics.button.width / metrics.room.width).toBeCloseTo(.49, 3); expect(metrics.room.bottom - metrics.button.bottom).toBeCloseTo(5, 3);
    expect(metrics.cushion.height).toBeCloseTo(2, 3); expect(metrics.cushion.width / metrics.button.width).toBeCloseTo(.56, 3);
    // Chromium lays out percentage offsets on its1/64px grid (20.28→20.265625).
    expect(Math.abs(metrics.button.bottom - metrics.cushion.bottom - metrics.button.height * .26)).toBeLessThan(.02);
    expect(metrics.feed.width).toBeCloseTo(48, 3); expect(metrics.feed.height).toBeCloseTo(62, 3); expect(metrics.room.right - metrics.feed.right).toBeCloseTo(61, 3);
    // Latest owner deliberately enlarged this one target; every other room,
    // outlet and support rectangle retains its recorded geometry.
    expect(metrics.trash.width).toBeCloseTo(52, 3); expect(metrics.trash.height).toBeCloseTo(64, 3);
    expect(metrics.room.right - metrics.trash.right).toBeCloseTo(5, 3); expect(metrics.trash.left - metrics.feed.right).toBeGreaterThanOrEqual(4 - .001);
    expect(metrics.trashArt.width).toBeCloseTo(36, 3); expect(metrics.trashArt.height).toBeCloseTo(44, 3);
    expect(metrics.slot.height).toBeCloseTo(5, 3); expect(metrics.slot.left).toBeGreaterThan(metrics.feed.left); expect(metrics.slot.right).toBeLessThan(metrics.feed.right);
    for (const part of [metrics.window, metrics.shelf, metrics.pot, metrics.button, metrics.feed, metrics.trash]) {
      expect(part.width).toBeGreaterThan(2); expect(part.height).toBeGreaterThan(2); expect(part.filter).toBe("none");
      expect(part.left).toBeGreaterThanOrEqual(metrics.room.left - 1); expect(part.right).toBeLessThanOrEqual(metrics.room.right + 1);
      expect(part.top).toBeGreaterThanOrEqual(metrics.room.top - 1); expect(part.bottom).toBeLessThanOrEqual(metrics.room.bottom + 1);
    }
    const visibleRoom = (await room.boundingBox())!; expect(visibleRoom.y).toBeGreaterThanOrEqual(0); expect(visibleRoom.y + visibleRoom.height).toBeLessThanOrEqual(view.height);
    for (const selector of [".vc-home-window", ".vc-home-shelf", ".vc-shelf-pot", ".vc-plush-bed"]) await expect(home(page).locator(selector)).toBeVisible();
    expect(await home(page).evaluate(node => node.getAnimations({ subtree: true }).filter(a => a.playState === "running").length)).toBe(0);
    await home(page).screenshot({ path: `.scratch-pw/companion-plush-home-${captureLabel}-${view.name}.png` });
    await writeFile(`.scratch-pw/companion-plush-home-${captureLabel}-${view.name}.json`, JSON.stringify(metrics, null, 2));

    const feed = home(page).getByRole("button", { name: "밥 꺼내기", exact: true }), bin = home(page).getByRole("button", { name: "음식 버리기", exact: true });
    await bin.evaluate(node => { node.setAttribute("data-test-clicks", "0"); node.addEventListener("click", () => node.setAttribute("data-test-clicks", String(Number(node.getAttribute("data-test-clicks")) + 1))); });
    await press(feed, view.touch); await expect(foods(page)).toHaveCount(1); await expect(feed).toBeFocused();
    await press(feed, view.touch); await expect(foods(page)).toHaveCount(2); await expect(feed).toBeFocused();
    await expect(page.locator(".vc-food[data-selected]")).toHaveCount(0);
    await discardByDrag(page, foods(page).last(), bin, view.touch); await expect(foods(page)).toHaveCount(1); await expect(bin).toHaveAttribute("data-test-clicks", "0");
    await press(bin, view.touch); await expect(foods(page)).toHaveCount(0); await expect(bin).toHaveAttribute("data-test-clicks", "1");
    // Actual feed/clear interactions cannot move the physical room surfaces.
    const after = await home(page).locator(".vc-home-cushion").boundingBox(); expect(after!.y).toBeCloseTo(metrics.cushion.top, 2); expect(after!.height).toBeCloseTo(2, 3);
    const cushion = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }), pet = page.locator(".vc-companion");
    await press(cushion, view.touch); await expect(pet).toHaveAttribute("data-platform", "companion-home", { timeout: 6000 });
    await expect(pet).toHaveAttribute("data-state", "sleep", { timeout: 6000 });
    const foreground = page.locator(".vc-bed-foreground"); await expect(foreground).toBeVisible();
    await expect(foreground).toHaveCSS("pointer-events", "none");
    await expect.poll(() => foreground.evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(.9);
    const layer = await foreground.evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height, z: Number(getComputedStyle(node).zIndex) }; });
    const originalBed = (await home(page).locator(".vc-plush-bed").boundingBox())!;
    for (const [actual, expected] of [[layer.left, originalBed.x], [layer.top, originalBed.y], [layer.width, originalBed.width], [layer.height, originalBed.height]]) expect(Math.abs(actual - expected)).toBeLessThanOrEqual(.1);
    expect(layer.z).toBeGreaterThan(await pet.evaluate(node => Number(getComputedStyle(node).zIndex)));
    await home(page).screenshot({ path: `.scratch-pw/companion-plush-home-${captureLabel}-${view.name}-cuddled.png` });
    await liftFromBed(page, view.touch, view.name);
    await expect(page.locator("[data-export-surface] .vc-home,[data-export-surface] .vc-food,[data-export-surface] .vc-companion")).toHaveCount(0);
    if (!view.touch) expect(await page.locator("[data-export-surface]").evaluate(node => getComputedStyle(node).width)).toBe("1840px");
    expect(posts).toEqual([]); expect(errors).toEqual([]);
  });
});

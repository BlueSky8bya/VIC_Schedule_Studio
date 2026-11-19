import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const cases = [
  { name: "pc-light", width: 1920, height: 1100, touch: false, dark: false },
  { name: "pc-dark", width: 1920, height: 1100, touch: false, dark: true },
  // PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
] as const;
const captureLabel = process.env.VIC_PLUSH_BASELINE === "1" ? "before" : "after";
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const foods = (page: Page) => page.locator(".vc-food");
const press = async (node: Locator, touch: boolean) => { if (touch) await node.tap(); else await node.click(); };

/** Real native input. A short stationary tail before touchEnd models a finger
 * stopping at the bin and preserves the first subsequent native control tap. */
async function discardByDrag(page: Page, item: Locator, bin: Locator, touch: boolean) {
  const initial = await foods(page).count();
  await expect(item).not.toHaveAttribute("data-falling"); // a dispensed snack falls first; a grab during the fall does not take
  const r = (await item.boundingBox())!, b = (await bin.boundingBox())!;
  const start = { x: r.x + r.width / 2, y: r.y + r.height / 2 }, end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  try {
    if (cdp) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 31 }] });
      for (let step = 1; step <= 12; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (end.x - start.x) * step / 12, y: start.y + (end.y - start.y) * step / 12, id: 31 }] });
    } else { await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(end.x, end.y, { steps: 12 }); }
    // The bin acknowledges a snack held over it with the shared object lift (`data-food-over`); the old
    // `--vc-trash-progress` fill went away with the unified room furniture (a0c44ea7).
    await expect(bin).toHaveAttribute("data-food-over", "");
    await expect.poll(() => bin.locator(".vc-object-paint").evaluate(node => getComputedStyle(node).getPropertyValue("--vc-object-feedback-scale").trim())).toBe("1.085");
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
  const original = await pet.elementHandle(), bed = home(page).locator(".vc-plush-bed"), localFront = bed.locator(".vc-bed-local-front");
  const originalBed = (await bed.boundingBox())!;
  const r = (await actor.boundingBox())!, start = { x: r.x + r.width / 2, y: r.y + r.height * .4 }, end = { x: start.x, y: start.y - 70 };
  const cdp = touch ? await page.context().newCDPSession(page) : null;
  try {
    if (cdp) await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 41 }] });
    else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
    await page.waitForTimeout(450); // Real hold gesture; time has not been mocked.
    if (cdp) for (let step = 1; step <= 12; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x, y: start.y + (end.y - start.y) * step / 12, id: 41 }] });
    else await page.mouse.move(end.x, end.y, { steps: 12 });
    await expect(pet).toHaveAttribute("data-state", "held");
    // The complete local sofa keeps its bolsters. Once the real hanging body
    // clears the crest, it no longer needs a second fixed foreground cloth.
    await expect(pet).toHaveAttribute("data-sofa-depth", "clear");
    await expect(foreground).toBeHidden(); await expect(localFront).toHaveCount(1);
    await expect(localFront.locator(".vc-bed-front-shape")).toBeVisible();
    await expect.poll(() => localFront.evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(.99);
    const rim = (await bed.boundingBox())!, rimTop = rim.y + rim.height * .54;
    for (const key of ["x", "y", "width", "height"] as const) expect(Math.abs(rim[key] - originalBed[key])).toBeLessThanOrEqual(.1);
    await expect.poll(async () => { const pose = (await pet.locator(".vc-pose").boundingBox())!; return pose.y + pose.height; }).toBeLessThan(rimTop);
    expect(await pet.evaluate((node, original) => node === original && node.isConnected, original)).toBe(true);
    expect(await actor.evaluate(node => { const r = node.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".vc-actor") === node; })).toBe(true);
    await home(page).screenshot({ path: `.scratch-pw/companion-plush-home-${captureLabel}-${label}-lift.png` });
    if (cdp) {
      for (let sample = 0; sample < 4; sample++) { await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...end, id: 41 }] }); }
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } else { await page.waitForTimeout(120); await page.mouse.up(); }
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
    // A fixed daytime hour: the room material (room-lighting.ts) dims at evening/night, so the wall clock decided this grade.
    await page.goto("/visual-fixture/poster?hour=12"); await page.evaluate(() => document.fonts.ready);
    await expect.poll(async () => await home(page).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
    await openCompanionHome(page, view.touch ? "touch" : "pointer");
    await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
    if (view.dark) await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    else await expect(page.locator("html")).not.toHaveAttribute("data-theme", "dark");
    await expect(home(page)).toHaveCount(1);
    const room = home(page).locator(".vc-home-room"); await expect(room).toBeVisible();
    // The room paints in stages on first load (floor, wall, furniture, props); measure the finished room.
    await expect(room).not.toHaveAttribute("data-home-reveal"); await expect(page.locator("html")).not.toHaveAttribute("data-companion-home-reveal");
    const metrics = await home(page).evaluate(node => {
      const rect = (selector: string) => { const element = node.querySelector<HTMLElement>(selector)!; const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height, filter: getComputedStyle(element).filter }; };
      const room = rect(".vc-home-room"), button = rect(".vc-cushion-button"), cushion = rect(".vc-home-cushion");
      return { room, window: rect(".vc-home-window"), shelf: rect(".vc-home-shelf"), button, cushion, floor: rect(".vc-home-floor"), feed: rect(".vc-dispenser"), slot: rect(".vc-dispenser-slot"), box: rect(".vc-toy-box"), trash: rect(".vc-home-trash"), trashArt: rect(".vc-home-trash > .vc-object-paint"), grade: getComputedStyle(node.querySelector(".vc-home-room")!).getPropertyValue("--vc-room-art-grade").trim(), viewport: { width: innerWidth, height: innerHeight } };
    });
    // The room was rebuilt as one responsive scene (companion-home.css `.vc-home-room`): its height and every
    // anchor follow the room's own width (`cqw`), no longer the fixed 132px strip. `unit` is one cqw.
    const unit = metrics.room.width / 100;
    expect(Number(metrics.grade)).toBeGreaterThan(.8); expect(Number(metrics.grade)).toBeLessThanOrEqual(1); if (!view.dark) expect(Number(metrics.grade)).toBe(1);
    expect(metrics.room.height).toBeCloseTo(Math.max(74 * unit, 260), 1); // max(74cqw, 130px + 130px / zoom), viewer zoom 1
    expect(metrics.floor.height).toBeCloseTo(metrics.room.height * .42, 1); expect(metrics.floor.bottom).toBeCloseTo(metrics.room.bottom, 3);
    expect(metrics.window.width).toBeCloseTo(Math.min(52 * unit, 100 * unit - metrics.shelf.width - 28) * .9, 1);
    expect(metrics.window.width / metrics.window.height).toBeCloseTo(38 / 23, 2);
    expect(metrics.window.top - metrics.room.top).toBeCloseTo(metrics.room.height * 50 / 683 + 8, 1); expect(metrics.window.bottom).toBeLessThan(metrics.floor.top);
    expect(metrics.shelf.height).toBeCloseTo(61, 1); expect(metrics.shelf.top - metrics.room.top).toBeCloseTo(48, 1); expect(metrics.room.right - metrics.shelf.right).toBeCloseTo(8, 1);
    expect(metrics.button.height).toBeCloseTo(78, 3); expect(metrics.button.width).toBeCloseTo(Math.max(120, Math.min(39 * unit, 150)), 1);
    expect(metrics.button.left - metrics.room.left).toBeCloseTo(5, 1); expect(metrics.room.bottom - metrics.button.bottom).toBeCloseTo(7.6 * unit, 1);
    expect(metrics.cushion.height).toBeCloseTo(2, 3); expect(metrics.cushion.width / metrics.button.width).toBeCloseTo(.645, 3);
    // Chromium lays out percentage offsets on its1/64px grid (20.28→20.265625).
    expect(Math.abs(metrics.button.bottom - metrics.cushion.bottom - metrics.button.height * .26)).toBeLessThan(.02);
    // Every furniture control keeps a real pointer target; the outlet stays inside its dispenser.
    for (const control of [metrics.feed, metrics.box, metrics.trash]) { expect(control.width).toBeGreaterThanOrEqual(44); expect(control.height).toBeGreaterThanOrEqual(44); }
    expect(metrics.feed.width).toBeCloseTo(metrics.feed.height, 3); expect(metrics.box.left - metrics.feed.right).toBeGreaterThanOrEqual(0); // the two storage targets never overlap
    expect(metrics.room.right - metrics.trash.right).toBeCloseTo(2 * unit, 1); expect(metrics.room.bottom - metrics.trash.bottom).toBeCloseTo(2 * unit, 1);
    expect(metrics.trashArt.width).toBeGreaterThan(30); expect(metrics.trashArt.width).toBeCloseTo(23 * unit, 1); // the painted bin is wider than its target and centred on it
    expect(Math.abs((metrics.trashArt.left + metrics.trashArt.right) / 2 - (metrics.trash.left + metrics.trash.right) / 2)).toBeLessThan(1); expect(metrics.trashArt.right).toBeLessThanOrEqual(metrics.room.right + .5);
    expect(metrics.slot.height).toBeGreaterThan(1); expect(metrics.slot.left).toBeGreaterThan(metrics.feed.left); expect(metrics.slot.right).toBeLessThan(metrics.feed.right);
    expect(metrics.slot.top).toBeGreaterThan(metrics.feed.top); expect(metrics.slot.bottom).toBeLessThan(metrics.feed.bottom);
    for (const part of [metrics.window, metrics.shelf, metrics.button, metrics.feed, metrics.box, metrics.trash]) {
      // Painted furniture carries exactly the room's own light grade (1 in the light theme) and no other filter.
      expect(part.width).toBeGreaterThan(2); expect(part.height).toBeGreaterThan(2); expect(part.filter).toMatch(/^(?:none|brightness\([0-9.]+\))$/);
      if (part.filter !== "none") expect(Number(part.filter.slice(11, -1))).toBeCloseTo(Number(metrics.grade), 6);
      expect(part.left).toBeGreaterThanOrEqual(metrics.room.left - 1); expect(part.right).toBeLessThanOrEqual(metrics.room.right + 1);
      expect(part.top).toBeGreaterThanOrEqual(metrics.room.top - 1); expect(part.bottom).toBeLessThanOrEqual(metrics.room.bottom + 1);
    }
    const visibleRoom = (await room.boundingBox())!; expect(visibleRoom.y).toBeGreaterThanOrEqual(0); expect(visibleRoom.y + visibleRoom.height).toBeLessThanOrEqual(view.height);
    for (const selector of [".vc-home-window", ".vc-home-shelf", ".vc-toy-box", ".vc-plush-bed"]) await expect(home(page).locator(selector)).toBeVisible();
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
    await placeCompanionOnHomeFloor(page);
    // The floor resident overlaps the sofa's centre. Recall through its native
    // keyboard control, then retain the original finite arrival/rest checks.
    await cushion.focus(); await cushion.press("Enter"); await expect(pet).toHaveAttribute("data-platform", "companion-home", { timeout: 6000 });
    await expect(pet).toHaveAttribute("data-state", "sleep", { timeout: 6000 });
    const foreground = page.locator(".vc-bed-foreground"); await expect(foreground).toBeVisible();
    await expect(pet).toHaveAttribute("data-sofa-depth", /^(seat|back)$/);
    await expect(home(page).locator(".vc-bed-local-front")).toHaveCount(1);
    await expect(home(page).locator(".vc-bed-local-front .vc-bed-front-shape")).toHaveCSS("visibility", "hidden");
    await expect(foreground).toHaveCSS("pointer-events", "none");
    await expect.poll(() => foreground.evaluate(node => Number(getComputedStyle(node).opacity))).toBeGreaterThan(.99);
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

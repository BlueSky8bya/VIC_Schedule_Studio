import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.locator(".vc-actor");
const posts = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });
async function setup(page: Page, enabled = true, reduced = false) {
  await page.addInitScript(({ epoch, epochKey, prefs, care, reduced }) => {
    localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
    Math.random = () => 0;
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, reduced, prefs: { ...DEFAULT_COMPANION_PREFERENCES, enabled, size: "small", roam: false, jump: false, sleep: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05 } });
  await page.goto("/visual-fixture/poster?avatar=1"); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  if (enabled) { await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd"); }
}
async function point(page: Page) {
  return pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom, width: r.width, platform: (node as HTMLElement).dataset.platform }; });
}

test("OFF requests no sprite; legacy size becomes the single92 default and the settings size row is retired", async ({ page }) => {
  const images: string[] = []; page.on("request", request => { if (/\/companion\/.*\.webp/.test(request.url())) images.push(request.url()); });
  await setup(page, false); await expect(pet(page)).toHaveCount(0); expect(images).toEqual([]);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  const tab = dialog.getByRole("tab", { name: "빅타민", exact: true }); if (await tab.isVisible()) await tab.click();
  await dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  expect((await point(page)).width).toBeLessThanOrEqual(92); // narrow windows may temporarily scale the display perch
  await expect(dialog.getByRole("radiogroup", { name: "빅타민 크기", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).size)).toBe("large");
  expect(images.every(src => src.includes("/hd/"))).toBe(true);
});

for (const mobile of [false, true]) test.describe(mobile ? "touch sleeping lift" : "desktop sleeping lift", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: mobile, isMobile: mobile });
  test("the sleeping display moves while its world and modal stay intact; Z cues keep running with no parked writes", async ({ page }) => {
    test.setTimeout(35000); await setup(page); const world = await point(page);
    const open = page.getByRole("button", { name: "설정", exact: true }); if (mobile) await open.tap(); else await open.click();
    const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await expect(dialog).toBeVisible();
    await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 10000 }); await page.waitForTimeout(650);
    await expect(pet(page)).toHaveAttribute("data-dreaming", "");
    const z = pet(page).locator(".vc-dream i").first(); const beforeTime = await z.evaluate(node => node.getAnimations()[0]?.currentTime);
    await page.waitForTimeout(180); const afterTime = await z.evaluate(node => node.getAnimations()[0]?.currentTime);
    expect(Number(afterTime)).toBeGreaterThan(Number(beforeTime));
    const before = await point(page), focus = await page.evaluate(() => document.activeElement?.outerHTML);
    const box = (await actor(page).boundingBox())!, start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const delta = before.y > 240 ? -95 : 95;
    if (mobile) {
      const client = await page.context().newCDPSession(page);
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 42 }] });
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x, y: start.y + delta, id: 42 }] });
      await expect(pet(page)).toHaveAttribute("data-overlay-drag", "");
      expect(Math.abs((await point(page)).y - before.y)).toBeGreaterThan(40);
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await client.detach();
    } else {
      await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x, start.y + delta, { steps: 12 });
      await expect(pet(page)).toHaveAttribute("data-overlay-drag", ""); expect(Math.abs((await point(page)).y - before.y)).toBeGreaterThan(40); await page.mouse.up();
    }
    await expect(dialog).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-presence", "parked"); await expect(pet(page)).toHaveAttribute("data-dreaming", "");
    expect(await page.evaluate(() => document.activeElement?.outerHTML)).toBe(focus);
    expect(await pet(page).getAttribute("data-platform")).toBe(world.platform);
    await page.waitForTimeout(800);
    const writes = await pet(page).evaluate(async node => { let count = 0; const observer = new MutationObserver(records => { count += records.length; }); observer.observe(node, { attributes: true, subtree: true }); await new Promise(resolve => setTimeout(resolve, 350)); observer.disconnect(); return count; });
    expect(writes).toBe(0);
    await page.screenshot({ path: `.scratch-pw/companion-052-sleep-${mobile ? "touch" : "pc"}.png` });
    const close = dialog.locator("[data-act=close-settings]"); if (mobile) await close.tap(); else await close.click();
    await expect(pet(page)).not.toHaveAttribute("data-returning", { timeout: 6000 });
    const restored = await point(page); expect(Math.hypot(restored.x - world.x, restored.y - world.y)).toBeLessThan(3);
  });
});

for (const area of [
  { name: "ear-height", height: .82, offset: 0, stroke: 10 },
  { name: "lower-body", height: .12, offset: 0, stroke: 10 },
  { name: "left-margin", height: .42, offset: -.60, stroke: 5 },
  { name: "right-margin", height: .42, offset: .60, stroke: 5 },
]) test(`a gentle ${area.name} round trip has immediate contact, a happy HD pose and pink hearts`, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  const p = await point(page); expect(p.width).toBe(92);
  const y = p.y - 92 * area.height, x = p.x + 92 * area.offset;
  await page.mouse.move(x - area.stroke, y); await page.mouse.move(x + area.stroke, y, { steps: 6 });
  await expect(pet(page).locator(".vc-petting-hand")).toBeVisible();
  await page.mouse.move(x - area.stroke, y, { steps: 6 });
  await expect(pet(page)).toHaveAttribute("data-state", "petted"); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  const palette = await pet(page).locator(".vc-affection-hearts").evaluate(node => ({ color: getComputedStyle(node).color, teaser: getComputedStyle(node).getPropertyValue("--teaser"), visible: getComputedStyle(node).display }));
  expect(palette.visible).not.toBe("none"); expect(palette.color).toBe("rgb(237, 133, 154)");
  await page.screenshot({ path: `.scratch-pw/companion-053-petting-${area.name}.png` });
});

test("a stroke can cross the drag button edge without losing intent, and leaving the body clears contact", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  const p = await point(page), y = p.y - 92 * .42;
  await page.mouse.move(p.x + 28, y); await page.mouse.move(p.x + 50, y);
  await expect(pet(page).locator(".vc-petting-hand")).toBeVisible();
  await page.mouse.move(p.x + 28, y);
  await expect(pet(page)).toHaveAttribute("data-state", "petted");
  await page.mouse.move(p.x + 92 * .8, y);
  await expect(pet(page)).not.toHaveAttribute("data-petting");
  await expect(pet(page).locator(".vc-petting-hand")).not.toBeVisible();
});

test("leaving the drag button for another control cannot award affection or consume its click", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  const p = await point(page), y = p.y - 92 * .42;
  await page.evaluate(({ x, y }) => {
    const button = document.createElement("button"); button.textContent = "인접 조작 테스트";
    button.id = "companion-contact-neighbour";
    Object.assign(button.style, { position: "fixed", left: `${x + 42}px`, top: `${y - 12}px`, width: "24px", height: "24px", zIndex: "80" });
    button.addEventListener("click", () => { button.dataset.clicked = "true"; }); document.body.append(button);
  }, { x: p.x, y });
  // The last leg reverses direction exactly when pointerleave targets another
  // control. Its native ownership must win before any affection is awarded.
  await page.mouse.move(p.x + 50, y); await page.mouse.move(p.x + 28, y); await page.mouse.move(p.x + 50, y);
  await expect(pet(page)).not.toHaveAttribute("data-state", "petted");
  await expect(pet(page)).not.toHaveAttribute("data-petting");
  const neighbour = page.locator("#companion-contact-neighbour"); await neighbour.click();
  await expect(neighbour).toHaveAttribute("data-clicked", "true");
});

test("sleeping two-tap placement keeps a detail window open and changes only the display perch", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page); const world = await point(page);
  const originalScroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  await page.locator(".public-event:visible").first().click();
  const dialog = page.getByRole("dialog", { name: "일정 상세", exact: true }); await expect(dialog).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 10000 }); await page.waitForTimeout(600);
  await actor(page).dblclick(); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(1760, 480); await expect(dialog).toBeVisible(); await expect(pet(page)).not.toHaveAttribute("data-placing");
  const placed = await point(page); expect(Math.hypot(placed.x - 1760, placed.y - 480)).toBeLessThan(1);
  expect(placed.platform).toBe(world.platform); await expect(pet(page)).toHaveAttribute("data-presence", "parked");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(pet(page)).not.toHaveAttribute("data-returning", { timeout: 6000 });
  const restored = await point(page), scroll = await page.evaluate(() => ({ x: scrollX, y: scrollY }));
  // Native card focus may scroll16px before opening. The retained DOM world
  // follows that scroll; the decorative perch must not change its document point.
  expect(restored.platform).toBe(world.platform);
  expect(Math.hypot(restored.x + scroll.x - world.x - originalScroll.x, restored.y + scroll.y - world.y - originalScroll.y)).toBeLessThan(3);
});

test("repeated distinct pickups show the sulky HD action briefly, then friendly input immediately wins", async ({ page }) => {
  test.setTimeout(30000); await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript(() => {
    const original = HTMLImageElement.prototype.decode;
    const probe = window as Window & { companionDecodes?: string[] }; probe.companionDecodes = [];
    HTMLImageElement.prototype.decode = function () { if (this.src.includes("/companion/hd/")) probe.companionDecodes!.push(this.src); return original.call(this); };
  });
  await setup(page);
  for (let i = 0; i < 4; i++) {
    const b = (await actor(page).boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 8, b.y + b.height / 2 - 15, { steps: 4 }); await page.mouse.up();
    await expect(pet(page)).toHaveAttribute("data-state", "jump");
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 3000 }); await page.waitForTimeout(60);
  }
  await expect(pet(page)).toHaveAttribute("data-mood", "sulky");
  await expect.poll(async () => Number(await pet(page).getAttribute("data-pose"))).toBeGreaterThanOrEqual(288);
  // More than three actual action packets evict idle. Returning to it must
  // perform a fresh real decode, not trust an immortal ready boolean.
  expect(await page.evaluate(() => (window as unknown as Window & { companionDecodes: string[] }).companionDecodes.filter(src => src.endsWith("victamin-action-00.webp")).length)).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: ".scratch-pw/companion-052-sulky.png" });
  await actor(page).click(); await expect(pet(page)).toHaveAttribute("data-state", "petted"); await expect(pet(page)).toHaveAttribute("data-mood", "happy");
});

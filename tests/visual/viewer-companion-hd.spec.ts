import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

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

async function placeExposedSleeper(page: Page) {
  // A real command puts the creature outside the later ordinary detail.
  // PLAN-069 lets windows cover pets, so blindly clicking an old BCR beneath
  // a dialog/backdrop would exercise that window's text instead of the pet.
  await actor(page).focus(); await actor(page).press("p");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(1760, 280);
  await expect.poll(async () => Math.abs((await point(page)).x - 1760)).toBeLessThan(1);
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 6000 });
  await expect(pet(page)).toHaveAttribute("data-platform", /\S+/);
}

async function exposedGrip(page: Page) {
  const grip = await actor(page).evaluate(node => {
    const r = node.getBoundingClientRect();
    for (const fy of [.5, .3, .7]) for (const fx of [.5, .3, .7]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (document.elementFromPoint(x, y)?.closest(".vc-actor") === node) return { x, y };
    }
    return null;
  });
  expect(grip, "an exposed native actor point, not a covered window target").not.toBeNull();
  return grip!;
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

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const mobile of [false]) test.describe(mobile ? "touch sleeping lift" : "desktop sleeping lift", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: mobile, isMobile: mobile });
  test("an exposed sleeper accepts a native world move while its detail and Z cues stay intact with no parked writes", async ({ page }) => {
    test.setTimeout(35000); await setup(page); await placeExposedSleeper(page); const world = await point(page);
    await page.locator(".public-event:visible").first().click();
    const dialog = page.getByRole("dialog", { name: "일정 상세", exact: true }); await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
    await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 10000 }); await page.waitForTimeout(650);
    await expect(pet(page)).toHaveAttribute("data-dreaming", "");
    const z = pet(page).locator(".vc-dream i").first(); const beforeTime = await z.evaluate(node => node.getAnimations()[0]?.currentTime);
    await page.waitForTimeout(180); const afterTime = await z.evaluate(node => node.getAnimations()[0]?.currentTime);
    expect(Number(afterTime)).toBeGreaterThan(Number(beforeTime));
    const before = await point(page), focus = await page.evaluate(() => document.activeElement?.outerHTML);
    const start = await exposedGrip(page);
    const delta = before.y > 240 ? -95 : 95, deltaX = -120;
    if (mobile) {
      const client = await page.context().newCDPSession(page);
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 42 }] });
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + deltaX, y: start.y + delta, id: 42 }] });
      await expect(pet(page)).toHaveAttribute("data-overlay-drag", "");
      expect(Math.abs((await point(page)).y - before.y)).toBeGreaterThan(40);
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await client.detach();
    } else {
      await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(start.x + deltaX, start.y + delta, { steps: 12 });
      await expect(pet(page)).toHaveAttribute("data-overlay-drag", ""); expect(Math.abs((await point(page)).y - before.y)).toBeGreaterThan(40); await page.mouse.up();
    }
    await expect(pet(page)).toHaveAttribute("data-state", "jump");
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 6000 });
    await expect(dialog).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-presence", "parked"); await expect(pet(page)).toHaveAttribute("data-dreaming", "");
    expect(await page.evaluate(() => document.activeElement?.outerHTML)).toBe(focus);
    await expect(pet(page)).toHaveAttribute("data-platform", /\S+/);
    const moved = await point(page); expect(Math.abs(moved.x - world.x - deltaX)).toBeLessThan(1);
    await page.waitForTimeout(800);
    const writes = await pet(page).evaluate(async node => { let count = 0; const observer = new MutationObserver(records => { count += records.length; }); observer.observe(node, { attributes: true, subtree: true }); await new Promise(resolve => setTimeout(resolve, 350)); observer.disconnect(); return count; });
    expect(writes).toBe(0);
    await page.screenshot({ path: `.scratch-pw/companion-077-sleep-${mobile ? "touch" : "pc"}.png` });
    const close = dialog.getByRole("button", { name: "닫기", exact: true }); if (mobile) await close.tap(); else await close.click();
    await expect(pet(page)).not.toHaveAttribute("data-returning", { timeout: 6000 });
    const restored = await point(page); expect(restored.platform).toBe(moved.platform);
    expect(Math.hypot(restored.x - moved.x, restored.y - moved.y)).toBeLessThan(3);
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

test("a sleeping double-click keeps position before native drag lands on the first lower real card without closing the detail", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page); await placeExposedSleeper(page);
  await page.locator(".public-event:visible").first().click();
  const dialog = page.getByRole("dialog", { name: "일정 상세", exact: true }); await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 10000 }); await page.waitForTimeout(600);
  const before = await point(page), focus = await page.evaluateHandle(() => document.activeElement), grip = await exposedGrip(page);
  await page.mouse.dblclick(grip.x, grip.y); await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).not.toHaveAttribute("data-overlay-drag");
  expect(await actor(page).evaluate(node => getComputedStyle(node).cursor)).not.toBe("crosshair");
  expect(await page.evaluate(focus => document.activeElement === focus, focus)).toBe(true);
  await expect.poll(async () => { const p = await point(page); return Math.hypot(p.x - before.x, p.y - before.y); }).toBeLessThan(2);
  const target = await dialog.evaluate(sheet => {
    const pane = sheet.getBoundingClientRect();
    const cards = [...document.querySelectorAll<HTMLElement>(".public-event:not(.teaser):not(.dimmed):not(.is-support)")].map(node => ({ node, r: node.getBoundingClientRect() })).filter(({ r }) => r.width > 100 && r.height > 0);
    for (const { node, r } of cards) {
      const x = r.left + r.width / 2, y = r.top - 40;
      if (y < 240 || r.top > innerHeight - 120 || x > pane.left - 60 && x < pane.right + 60 || x < 50 || x > innerWidth - 50) continue;
      const first = cards.filter(card => x >= card.r.left && x <= card.r.right && card.r.top - 3 >= y).sort((a, b) => a.r.top - b.r.top)[0];
      if (first?.node === node && !document.elementFromPoint(x, y)?.closest("button,a,input,select,textarea,[role='button']")) return { id: node.dataset.eventid!, x, y, plane: r.top - 3 };
    }
    return null;
  });
  expect(target, "a genuine first lower card outside the ordinary detail").not.toBeNull();
  type PlacementWindow = Window & { hdPlacement?: { frames: { x: number; y: number; hidden: boolean }[]; raf: number } };
  await pet(page).evaluate(node => {
    const witness = { frames: [] as { x: number; y: number; hidden: boolean }[], raf: 0 };
    const sample = () => { const r = node.getBoundingClientRect(); witness.frames.push({ x: r.left + r.width / 2, y: r.bottom, hidden: (node as HTMLElement).hidden }); witness.raf = requestAnimationFrame(sample); };
    (window as PlacementWindow).hdPlacement = witness; witness.raf = requestAnimationFrame(sample);
  });
  const offset = { x: grip.x - before.x, y: grip.y - before.y };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down(); await expect(pet(page)).toHaveAttribute("data-overlay-drag", "");
  await page.mouse.move(target!.x + offset.x, target!.y + offset.y, { steps: 12 });
  await expect.poll(async () => { const p = await point(page); return Math.hypot(p.x - target!.x, p.y - target!.y); }).toBeLessThan(2);
  await page.mouse.up(); await page.mouse.move(4, 4);
  await expect(dialog).toBeVisible(); await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 6000 });
  const frames = await page.evaluate(() => { const witness = (window as PlacementWindow).hdPlacement!; cancelAnimationFrame(witness.raf); return witness.frames; });
  await writeFile(".scratch-pw/companion-077-sleeping-placement.json", JSON.stringify({ target, frames }, null, 2));
  // Hidden frames have a zero BCR and must not disappear from the x-filtered flight.
  expect(frames.every(frame => !frame.hidden), "the entire native drag and fall stay unhidden, including their first and last frames").toBe(true);
  const flight = frames.filter(frame => Math.abs(frame.x - target!.x) < 1 && frame.y < target!.plane - 4);
  expect(flight.length).toBeGreaterThan(2); expect(Math.max(...flight.map(frame => frame.y)) - Math.min(...flight.map(frame => frame.y))).toBeGreaterThan(10);
  expect(flight.every(frame => !frame.hidden && frame.y >= target!.y - 3)).toBe(true);
  const placed = await point(page); expect(Math.abs(placed.x - target!.x)).toBeLessThan(1); expect(Math.abs(placed.y - target!.plane)).toBeLessThan(3);
  await expect(pet(page)).toHaveAttribute("data-presence", "parked");
  expect(await page.evaluate(focus => document.activeElement === focus, focus)).toBe(true);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(pet(page)).not.toHaveAttribute("data-returning", { timeout: 6000 });
  const actualCard = page.locator(`.public-event[data-eventid="${target!.id}"]`);
  await expect.poll(async () => Math.abs((await point(page)).y - await actualCard.evaluate(node => node.getBoundingClientRect().top) + 3)).toBeLessThan(3);
  expect(Math.abs((await point(page)).x - target!.x)).toBeLessThan(1);
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
  expect(await page.evaluate(() => (window as unknown as Window & { companionDecodes: string[] }).companionDecodes.filter(src => src.endsWith("victamin-action-00-big-eyes-v1-body-outline-v1.webp")).length)).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: ".scratch-pw/companion-052-sulky.png" });
  // PLAN-068 assigns short clicks to bonking. Native keyboard affection is
  // still friendly input and must supersede the sulky pose immediately.
  await actor(page).focus(); await actor(page).press("Enter"); await expect(pet(page)).toHaveAttribute("data-state", "petted"); await expect(pet(page)).toHaveAttribute("data-mood", "happy");
});

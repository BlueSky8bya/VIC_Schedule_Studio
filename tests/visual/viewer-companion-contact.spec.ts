import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const bond = (page: Page) => page.getByRole("meter", { name: "빅타민 친밀도", exact: true });
const textSurfaces = ".public-day .day-strip > strong,.public-event .event-main p,.public-event .event-subs li,.agenda-day .agenda-when > strong,.agenda-item .agenda-title-text,.agenda-item .agenda-title,.agenda-item .agenda-subs li";
const posts = new WeakMap<Page, string[]>();
type ContactFrame = { x: number; y: number; hidden: boolean; platform: string };
type ContactProbe = Window & { contactClicks?: number; contactCaptures?: number; contactFrames?: ContactFrame[]; contactRaf?: number; contactNode?: Element };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, options: { home?: boolean; reduced?: boolean } = {}) {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript(({ epoch, key, preferences, care, reduced }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
    Math.random = () => 0;
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: options.home ?? false, feeding: false, heartPrank: false, ambientPrank: false }, care: DEFAULT_COMPANION_CARE, reduced: options.reduced ?? false });
  await page.goto(`/visual-fixture/poster${options.home ? "?avatar=1" : ""}`);
  await page.bringToFront(); await expect(actor(page)).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  await expect(pet(page)).toHaveAttribute("data-presence", "active");
  if (options.home) await openCompanionHome(page);
}

async function world(page: Page) {
  return pet(page).evaluate(node => {
    // Inline world coordinates survive display:none. BCR=0 while hidden must
    // not masquerade as a horizontal teleport or a successful recovery.
    const size = parseFloat((node as HTMLElement).style.getPropertyValue("--vc-size"));
    const matrix = new DOMMatrixReadOnly((node as HTMLElement).style.transform);
    return { x: matrix.m41 + size / 2, y: matrix.m42 + size, size };
  });
}
async function head(page: Page) {
  const point = await world(page);
  const value = { left: point.x - point.size * .22, right: point.x + point.size * .22, y: point.y - point.size * .49 };
  expect(await page.evaluate(({ left, right, y }) => [left, right].every(x => document.elementFromPoint(x, y)?.closest(".vc-actor")), value)).toBe(true);
  return value;
}
async function stroke(page: Page) {
  const point = await head(page);
  for (const x of [point.left, point.right, point.left, point.right]) await page.mouse.move(x, point.y, { steps: 4 });
  return point;
}
const affection = (page: Page) => bond(page).evaluate(node => (node as HTMLMeterElement).value);

for (const reduced of [false, true]) test(`native head strokes are finite and leave focus, capture and calendar clicks alone (${reduced ? "reduced" : "full"})`, async ({ page }) => {
  await setup(page, { home: true, reduced });
  const focus = page.locator('[data-panel-section-toggle="tag-filter"]');
  await focus.focus(); await expect(focus).toBeFocused();
  const before = await world(page), initialBond = await affection(page), url = page.url();
  await page.evaluate(() => {
    const probe = window as ContactProbe; probe.contactClicks = 0; probe.contactCaptures = 0;
    for (const type of ["pointerdown", "pointerup", "click"]) document.addEventListener(type, () => probe.contactClicks!++, true);
    document.addEventListener("gotpointercapture", () => probe.contactCaptures!++, true);
  });
  await stroke(page);
  await expect(pet(page)).toHaveAttribute("data-petting", "hover");
  await expect(pet(page)).toHaveAttribute("data-state", "petted");
  await expect(page.locator(".vc-petting-hand")).toBeVisible();
  if (!reduced) await page.screenshot({ path: ".scratch-pw/companion-contact-hand.png" });
  await expect.poll(async () => await affection(page) - initialBond).toBeGreaterThan(.07);
  expect(await affection(page) - initialBond).toBeLessThan(.09);
  await expect(focus).toBeFocused(); expect(page.url()).toBe(url);
  expect(await page.evaluate(() => ({ clicks: (window as ContactProbe).contactClicks, captures: (window as ContactProbe).contactCaptures }))).toEqual({ clicks: 0, captures: 0 });
  const after = await world(page);
  expect(Math.abs(after.x - before.x)).toBeLessThan(.01); expect(Math.abs(after.y - before.y)).toBeLessThan(.01);
  if (reduced) expect(await page.locator(".vc-petting-hand").evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).b)).toBe(0);
  // No further pointer input: the hand and happy reaction have a real end.
  await expect(pet(page)).not.toHaveAttribute("data-petting", "hover", { timeout: 2000 });
  await expect(page.locator(".vc-petting-hand")).toBeHidden();
  await expect(pet(page)).not.toHaveAttribute("data-state", "petted", { timeout: 2000 });
  await expect(pet(page)).toHaveCount(1);
});

test("one pass and jitter never award affection, including jitter after a genuine stroke", async ({ page }) => {
  await setup(page, { home: true });
  const initialBond = await affection(page), point = await head(page);
  await page.mouse.move(point.left, point.y); await page.mouse.move(point.right, point.y, { steps: 8 });
  for (let i = 0; i < 12; i++) { await page.mouse.move(point.right + (i % 2) * .5, point.y); await page.waitForTimeout(35); }
  await expect(pet(page)).not.toHaveAttribute("data-petting", "hover");
  expect(await affection(page)).toBeLessThanOrEqual(initialBond + .001);
  const end = await stroke(page);
  await expect(pet(page)).toHaveAttribute("data-petting", "hover");
  await expect.poll(async () => await affection(page) - initialBond).toBeGreaterThan(.07);
  const awarded = await affection(page);
  // Real events beyond the 4s reward budget: subpixel noise must neither keep
  // the hand alive nor manufacture another reward from old direction changes.
  for (let i = 0; i < 80; i++) { await page.mouse.move(end.right + (i % 2) * .5, end.y); await page.waitForTimeout(55); }
  await expect(pet(page)).not.toHaveAttribute("data-petting", "hover");
  await expect(page.locator(".vc-petting-hand")).toBeHidden();
  expect(await affection(page)).toBeLessThanOrEqual(awarded + .001);
  expect(await affection(page)).toBeGreaterThan(awarded - .02);
});

test("hover yields immediately to native dragging and keeps keyboard pickup", async ({ page }) => {
  await setup(page); const point = await stroke(page);
  await expect(pet(page)).toHaveAttribute("data-petting", "hover");
  const before = await world(page);
  await page.mouse.down(); await page.mouse.move(point.right + 7, point.y);
  // The native pointermove itself owns the transition, before any hold timer.
  expect(await pet(page).getAttribute("data-state")).toBe("held");
  expect((await world(page)).x - before.x).toBeGreaterThan(6);
  await expect(pet(page)).not.toHaveAttribute("data-petting", "hover");
  await page.mouse.up();
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 4000 });
  await actor(page).focus(); await actor(page).press("Space"); await actor(page).press("ArrowRight");
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  await expect(actor(page)).toBeFocused();
  await actor(page).press("Space");
  await expect(pet(page)).not.toHaveAttribute("data-state", "held", { timeout: 3000 });
  await expect(pet(page)).toHaveCount(1);
});

async function actualContact(page: Page) {
  return page.evaluate(selector => {
    const node = document.querySelector<HTMLElement>(".vc-companion")!;
    if (node.hidden) return null;
    const feet = node.getBoundingClientRect(), x = feet.left + feet.width / 2;
    let floor = innerHeight - 18;
    // The native month controls can raise the actual bottom ledge. Measure
    // their rendered fixed bounds, not the anonymous product platform id.
    for (const bar of document.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const rect = bar.getBoundingClientRect();
      if (getComputedStyle(bar).position === "fixed" && rect.width > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) floor = Math.min(floor, rect.top - 8);
    }
    let error = Math.abs(feet.bottom - floor);
    for (const text of document.querySelectorAll(selector)) {
      const range = document.createRange(); range.selectNodeContents(text);
      for (const line of range.getClientRects()) if (line.width > .5 && x >= line.left - .5 && x <= line.right + .5) error = Math.min(error, Math.abs(feet.bottom - line.top + 3));
      range.detach();
    }
    return error;
  }, textSurfaces);
}

test("a real text support leaving the viewport preserves x through landing or safe waiting", async ({ page }) => {
  await setup(page); await expect(pet(page)).toHaveAttribute("data-platform", /^(?:card|date)-\d+/);
  await expect.poll(() => actualContact(page)).toBeLessThan(1.5);
  const anchorTop = await page.evaluate(selector => {
    const feet = document.querySelector(".vc-companion")!.getBoundingClientRect(), x = feet.left + feet.width / 2;
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      const range = document.createRange(); range.selectNodeContents(node);
      for (const line of range.getClientRects()) if (x >= line.left && x <= line.right && Math.abs(feet.bottom - line.top + 3) < 1.5) { node.dataset.contactAnchor = ""; range.detach(); return line.top; }
      range.detach();
    }
    throw new Error("No actual rendered text under the feet");
  }, textSurfaces);
  await page.evaluate(() => {
    document.documentElement.style.overflowY = "auto"; document.documentElement.style.scrollBehavior = "auto"; document.body.style.overflowY = "visible";
    const spacer = document.createElement("div"); spacer.setAttribute("aria-hidden", "true"); spacer.style.cssText = "height:1600px;pointer-events:none"; document.body.append(spacer);
    const probe = window as ContactProbe, node = document.querySelector<HTMLElement>(".vc-companion")!; probe.contactNode = node; probe.contactFrames = [];
    const sample = () => {
      const size = parseFloat(node.style.getPropertyValue("--vc-size")), matrix = new DOMMatrixReadOnly(node.style.transform);
      probe.contactFrames!.push({ x: matrix.m41 + size / 2, y: matrix.m42 + size, hidden: node.hidden, platform: node.dataset.platform ?? "" });
      probe.contactRaf = requestAnimationFrame(sample);
    };
    probe.contactRaf = requestAnimationFrame(sample);
  });
  const before = await world(page);
  await page.evaluate(top => scrollTo({ top, behavior: "instant" }), anchorTop + 150);
  await expect.poll(() => page.locator("[data-contact-anchor]").evaluate(node => node.getBoundingClientRect().bottom)).toBeLessThan(0);
  await page.waitForTimeout(1300);
  const observed = await page.evaluate(() => {
    const probe = window as ContactProbe; cancelAnimationFrame(probe.contactRaf!);
    return { frames: probe.contactFrames!, sameNode: probe.contactNode === document.querySelector(".vc-companion") };
  });
  expect(observed.sameNode).toBe(true); expect(observed.frames.length).toBeGreaterThan(5);
  expect(Math.max(...observed.frames.map(frame => Math.abs(frame.x - before.x)))).toBeLessThan(.02);
  if (await actor(page).isVisible()) expect(await actualContact(page)).toBeLessThan(1.5);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(actor(page)).toBeVisible();
  await expect.poll(() => actualContact(page)).toBeLessThan(1.5);
  expect(Math.abs((await world(page)).x - before.x)).toBeLessThan(.02);
  await expect(pet(page)).toHaveCount(1);
});

test("folding the real home body hides its resident until the same cushion returns", async ({ page }) => {
  await setup(page, { home: true });
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  const before = await world(page), toggle = page.locator('[data-panel-section-toggle="companion-home"]');
  await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".vc-home .panel-section-body")).toBeHidden(); await expect(pet(page)).toBeHidden();
  await page.waitForTimeout(400); await expect(pet(page)).toBeHidden();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top))).toBeLessThan(1);
  expect(Math.abs((await world(page)).x - before.x)).toBeLessThan(.02);
  await expect(toggle).toBeFocused(); await expect(pet(page)).toHaveCount(1);
});

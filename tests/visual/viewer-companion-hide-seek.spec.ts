import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

const CARD = ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const sheet = (page: Page) => page.locator(".agenda-detail-sheet");
const posts = new WeakMap<Page, string[]>();
type Point = { x: number; y: number };
type HideWitness = Window & { hideSeekNode?: Element; hideSeekPhases?: (string | null)[]; hideSeekObserver?: MutationObserver; hideSeekQuietWrites?: number; hideSeekQuietObserver?: MutationObserver };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, mobile: boolean) {
  // This suite explicitly controls browser time to age the45s ambient grace
  // and12..28s wait. It does not claim real-time or OS-background delivery.
  // Native placement/card input, the real planner, rendered geometry and the
  // local detail bridge remain intact; no action/state/bridge is injected.
  await page.clock.install();
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    // A deterministic three-step RNG stream exercises the low-probability
    // eligibility/weighted draw. The real brain still owns every decision.
    let seed = 0; Math.random = () => (++seed % 3 ? 0 : .999999);
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: true }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1, curiosity: .9 } });
  await page.goto("/visual-fixture/poster?avatar=1"); await page.bringToFront();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await page.waitForTimeout(200); // Existing finite geometry coalescing.
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  const target = await page.locator(CARD).evaluateAll(nodes => {
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")]
      .filter(node => !node.matches(".public-event,.agenda-event,.agenda-item,.public-day,.agenda-day") && !node.closest(".vc-companion,.vc-home"))
      .map(node => node.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    const cards = nodes.filter(node => !node.closest(".teaser,.teaser-revealing,.dimmed,[hidden],[inert]"))
      .map(node => ({ node, r: node.getBoundingClientRect() })).filter(({ r }) => r.width > 90 && r.height > 0 && r.top > 180 && r.top < innerHeight - 110).sort((a, b) => a.r.top - b.r.top);
    for (const { node, r } of cards) for (const fraction of [.5, .8, .2]) {
      const x = r.left + r.width * fraction, y = r.top - 3;
      if (x < 51 || x > innerWidth - 51) continue;
      const body = { left: x - 38, right: x + 38, top: y - 73, bottom: y + 3 };
      if (controls.some(c => c.left < body.right && c.right > body.left && c.top < body.bottom && c.bottom > body.top)) continue;
      if (cards.some(other => other.node !== node && x >= other.r.left && x <= other.r.right && other.r.top - 3 >= y - 20 && other.r.top < r.top)) continue;
      return { x, y, eventId: (node as HTMLElement).dataset.eventid!, cardIndex: nodes.indexOf(node) };
    }
    return null;
  });
  expect(target, "native placement needs a real clear ordinary card top").not.toBeNull();
  if (mobile) await page.touchscreen.tap(target!.x, target!.y - 20); else await page.mouse.click(target!.x, target!.y - 20);
  await page.clock.runFor(1200);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top/);
  await pet(page).evaluate(node => { const win = window as HideWitness; win.hideSeekNode = node; win.hideSeekPhases = []; win.hideSeekObserver = new MutationObserver(records => {
    const phases = records.filter(record => record.attributeName === "data-hide-phase");
    phases.forEach((_, index) => win.hideSeekPhases!.push(index + 1 < phases.length ? phases[index + 1].oldValue : node.getAttribute("data-hide-phase")));
  }); win.hideSeekObserver.observe(node, { attributes: true, attributeFilter: ["data-hide-phase"], attributeOldValue: true }); });
  await page.clock.fastForward(45_000);
  for (let step = 0; step < 30 && await pet(page).getAttribute("data-hide-phase") !== "hidden"; step++) await page.clock.runFor(1000);
  await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden");
  await expect(pet(page)).toHaveAttribute("data-hide-event", target!.eventId); await expect(pet(page)).toBeHidden();
  return target!;
}

/** Pick a genuine native card point, avoiding its nested vote/link controls. */
async function cardPoint(page: Page, eventId: string, matching: boolean): Promise<Point> {
  const point = await page.locator(CARD).evaluateAll((nodes, { eventId, matching }) => {
    for (const node of nodes) {
      if (((node as HTMLElement).dataset.eventid === eventId) !== matching || node.closest(".teaser,.teaser-revealing,.dimmed,[hidden],[inert]")) continue;
      const r = node.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) continue;
      for (const fy of [.5, .75, .25]) for (const fx of [.5, .2, .8]) {
        const p = { x: r.left + r.width * fx, y: r.top + r.height * fy };
        if (p.x < 0 || p.x > innerWidth || p.y < 0 || p.y > innerHeight) continue;
        const hit = document.elementFromPoint(p.x, p.y);
        if (hit?.closest(".public-event,.agenda-event,.agenda-item") !== node) continue;
        const control = hit.closest("button,a,input,select,textarea,[role=button]"); if (control && control !== node) continue;
        return p;
      }
    }
    return null;
  }, { eventId, matching });
  expect(point, matching ? "the hidden schedule must still have a native click point" : "a different ordinary schedule must have a native click point").not.toBeNull();
  return point!;
}
async function nativeClick(page: Page, point: Point, mobile: boolean) { if (mobile) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y); }
async function evidence(page: Page, label: string) {
  const result = await page.evaluate(() => { const win = window as HideWitness; win.hideSeekObserver?.disconnect(); return { clockControlled: true, sameDom: document.querySelector(".vc-companion") === win.hideSeekNode, phases: win.hideSeekPhases }; });
  expect(result.sameDom).toBe(true); await writeFile(`.scratch-pw/companion-057-hide-${label}.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify({ check: "hide-seek", label, ...result })); return result;
}

for (const mobile of [false, true]) test.describe(mobile ? "native touch finding" : "native pointer finding", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1400 }, hasTouch: mobile, isMobile: mobile });
  test("wrong detail pauses the controlled wait; only the matching schedule finds the guest and closes through the shared return", async ({ page }) => {
    test.setTimeout(60_000);
    const target = await setup(page, mobile);
    await nativeClick(page, await cardPoint(page, target.eventId, false), mobile); await expect(sheet(page)).toBeVisible();
    await expect(sheet(page)).not.toHaveAttribute("data-companion-detail-event", target.eventId);
    await page.clock.runFor(32_000); await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden"); await expect(pet(page)).toBeHidden();
    await page.keyboard.press("Escape"); await expect(sheet(page)).toHaveCount(0); await page.clock.runFor(1000);
    await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden");
    await nativeClick(page, await cardPoint(page, target.eventId, true), mobile);
    await expect(sheet(page)).toHaveAttribute("data-companion-detail-event", target.eventId); await expect(pet(page)).toHaveAttribute("data-hide-phase", "found");
    await page.clock.runFor(1200); await expect(pet(page)).toHaveAttribute("data-hide-phase", "settled"); await expect(pet(page)).toBeVisible();
    await expect(pet(page)).toHaveAttribute("data-hide-perch", /^(inside|outside)$/); await expect(actor(page)).toHaveAttribute("tabindex", "-1");
    expect(await actor(page).evaluate(node => getComputedStyle(node).pointerEvents)).toBe("none"); await expect(actor(page)).not.toBeFocused();
    await page.screenshot({ path: `.scratch-pw/companion-057-hide-found-${mobile ? "390" : "1920"}.png` });
    await page.keyboard.press("Escape"); await expect(sheet(page)).toHaveCount(0); await page.clock.runFor(2500);
    await expect(pet(page)).not.toHaveAttribute("data-hide-phase"); await expect(pet(page)).not.toHaveAttribute("data-returning"); await expect(pet(page)).toBeVisible();
    const result = await evidence(page, mobile ? "found-390" : "found-1920"); expect(result.phases).toEqual(expect.arrayContaining(["entering", "hidden", "found", "settled", null]));
  });
});

test("unfound guest is quiescent, then emerges on the bounded controlled deadline without clicking or replacing its world", async ({ page }) => {
  test.setTimeout(60_000); await page.setViewportSize({ width: 1920, height: 1000 }); const target = await setup(page, false);
  const source = page.locator(CARD).nth(target.cardIndex), originalPlatform = (await pet(page).getAttribute("data-platform"))!;
  const before = await source.evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, bottom: r.bottom }; });
  await pet(page).evaluate(node => { const win = window as HideWitness; win.hideSeekQuietWrites = 0; win.hideSeekQuietObserver = new MutationObserver(records => { win.hideSeekQuietWrites! += records.length; }); win.hideSeekQuietObserver.observe(node, { attributes: true, attributeFilter: ["style", "data-state", "data-hide-phase", "hidden"] }); });
  await page.clock.runFor(1000); expect(await page.evaluate(() => (window as HideWitness).hideSeekQuietWrites)).toBe(0); await page.evaluate(() => (window as HideWitness).hideSeekQuietObserver?.disconnect());
  // The sparse fixture has only16px native page overflow. A genuine delta>8
  // still detects double carry against the unchanged3px endpoint tolerance.
  const scroll = await page.evaluate(() => ({ top: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
  const direction = scroll.max - scroll.top >= scroll.top ? 1 : -1;
  await page.mouse.move(target.x, before.top + 10); await page.mouse.wheel(0, direction * 16); await page.waitForTimeout(120); await page.clock.runFor(300);
  const after = await source.evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, bottom: r.bottom }; });
  expect(Math.abs(before.top - after.top)).toBeGreaterThan(8); expect(Math.abs(before.top - after.top)).toBeLessThanOrEqual(80); expect(after.top).toBeGreaterThan(110); expect(after.bottom).toBeLessThan(1000);
  await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden"); await expect(pet(page)).toHaveAttribute("data-hide-event", target.eventId);
  await page.clock.runFor(9700); await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden");
  for (let step = 0; step < 20 && await pet(page).getAttribute("data-hide-phase"); step++) await page.clock.runFor(1000);
  await expect(pet(page)).not.toHaveAttribute("data-hide-phase"); await page.clock.runFor(2500); await expect(pet(page)).not.toHaveAttribute("data-returning"); await expect(pet(page)).toBeVisible(); await expect(sheet(page)).toHaveCount(0);
  const landed = await pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom, left: r.left, top: r.top, right: r.right, bottom: r.bottom, platform: (node as HTMLElement).dataset.platform! }; });
  const finalSource = await source.evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top }; });
  const footError = Math.abs(landed.y - (finalSource.top - 3)), xError = Math.abs(landed.x - (target.x + finalSource.left - before.left));
  expect(landed.platform.match(/^card-\d+/)?.[0]).toBe(originalPlatform.match(/^card-\d+/)?.[0]); expect(footError).toBeLessThan(3); expect(xError).toBeLessThan(3);
  expect(landed.left).toBeGreaterThanOrEqual(4); expect(landed.right).toBeLessThanOrEqual(1916); expect(landed.top).toBeGreaterThanOrEqual(8); expect(landed.bottom).toBeLessThanOrEqual(988);
  expect(await page.evaluate(({ x, y }) => {
    const body = { left: x - 92 * .38, right: x + 92 * .38, top: y - 92 * .76, bottom: y };
    const intersects = (r: DOMRect) => r.width > 0 && r.height > 0 && r.left < body.right && r.right > body.left && r.top < body.bottom && r.bottom > body.top;
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")].filter(node => !node.matches(".public-event,.agenda-event,.agenda-item,.public-day,.agenda-day") && !node.closest(".vc-companion"));
    if (controls.some(node => intersects(node.getBoundingClientRect()))) return false;
    const range = document.createRange();
    try { for (const node of document.querySelectorAll(".public-day .day-strip>strong,.public-event .event-main p,.public-event .event-subs li,.support-bar,.weekday-row")) { range.selectNodeContents(node); if ([...range.getClientRects()].some(intersects)) return false; } }
    finally { range.detach(); }
    return true;
  }, landed), "the real opaque footprint must keep native controls and calendar text clear").toBe(true);
  console.log(JSON.stringify({ check: "hide-native-scroll", clockControlled: true, originalPlatform, before, after, finalSource, landed, sourceDelta: after.top - before.top, footError, xError }));
  const result = await evidence(page, "auto-1920"); expect(result.phases).toEqual(expect.arrayContaining(["entering", "hidden", "emerging", null])); expect(result.phases).not.toContain("found");
  await page.screenshot({ path: ".scratch-pw/companion-057-hide-auto-1920.png" });
});

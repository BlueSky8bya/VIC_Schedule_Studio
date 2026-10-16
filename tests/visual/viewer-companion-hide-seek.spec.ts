import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { COMPANION_DETAIL_EVENT } from "@/lib/ui/viewer-companion/hide-targets";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

const CARD = ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const sheet = (page: Page) => page.locator(".agenda-detail-sheet");
const posts = new WeakMap<Page, string[]>();
type Point = { x: number; y: number };
type HideWitness = Window & { hideSeekNode?: Element; hideSeekPhases?: (string | null)[]; hideSeekObserver?: MutationObserver; hideSeekQuietWrites?: number; hideSeekQuietObserver?: MutationObserver };
type FoundFrame = { at: number; visible: boolean; x: number; y: number; width: number; height: number; ready: boolean; sheet: { left: number; top: number; right: number; bottom: number } | null };
type FoundProbe = { node: Element; frames: FoundFrame[]; ready: boolean; readyAt: number | null; captures: number; clicks: number; raf: number; detail: EventListener; capture: EventListener; click: EventListener };
type FoundWindow = Window & { foundProbe?: FoundProbe };
type DropClosingFrame = { at: number; x: number; y: number; width: number; hidden: boolean; same: boolean; returning: string | null; platform: string };
type DropClosingWindow = Window & { guestDropClosing?: { frames: DropClosingFrame[]; raf: number } };
const hint = (page: Page) => page.locator("[data-companion-hide-hint]");

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, mobile: boolean, gfx: "max" | "off" = "max") {
  // This suite explicitly controls browser time to age the45s ambient grace
  // and12..28s wait. It does not claim real-time or OS-background delivery.
  // Native placement/card input, the real planner, rendered geometry and the
  // local detail bridge remain intact; no action/state/bridge is injected.
  await page.clock.install();
  await page.addInitScript(({ key, epoch, preferences, care, gfx }) => {
    localStorage.setItem(key, epoch);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic.reduceMotion", "off"); localStorage.setItem("vic.gfxPref", gfx);
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    // A deterministic three-step RNG stream exercises the low-probability
    // eligibility/weighted draw. The real brain still owns every decision.
    let seed = 0; Math.random = () => (++seed % 3 ? 0 : .999999);
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, gfx, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: true }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1, curiosity: .9 } });
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

async function startFoundProbe(page: Page) {
  await pet(page).evaluate((node, eventName) => {
    const began = performance.now(), p: FoundProbe = { node, frames: [], ready: false, readyAt: null, captures: 0, clicks: 0, raf: 0,
      detail: event => { const detail = (event as CustomEvent<{ ready?: boolean; sheet?: HTMLElement | null }>).detail; if (detail?.sheet && detail.ready) { p.ready = true; p.readyAt = performance.now() - began; } },
      capture: event => { if (node.contains(event.target as Node)) p.captures++; },
      click: event => { if (node.contains(event.target as Node)) p.clicks++; },
    };
    window.addEventListener(eventName, p.detail); document.addEventListener("gotpointercapture", p.capture, true); document.addEventListener("click", p.click, true);
    const sample = () => {
      const r = node.getBoundingClientRect(), css = getComputedStyle(node), pane = document.querySelector(".agenda-detail-sheet")?.getBoundingClientRect();
      p.frames.push({ at: performance.now() - began, visible: !(node as HTMLElement).hidden && css.display !== "none" && css.visibility !== "hidden" && Number(css.opacity) > .01, x: r.left, y: r.top, width: r.width, height: r.height, ready: p.ready,
        sheet: pane ? { left: pane.left, top: pane.top, right: pane.right, bottom: pane.bottom } : null });
      p.raf = requestAnimationFrame(sample);
    };
    (window as FoundWindow).foundProbe = p; p.raf = requestAnimationFrame(sample);
  }, COMPANION_DETAIL_EVENT);
}
async function finishFoundProbe(page: Page, label: string) {
  const result = await page.evaluate(eventName => {
    const p = (window as FoundWindow).foundProbe!; cancelAnimationFrame(p.raf); window.removeEventListener(eventName, p.detail); document.removeEventListener("gotpointercapture", p.capture, true); document.removeEventListener("click", p.click, true);
    return { frames: p.frames, readyAt: p.readyAt, captures: p.captures, clicks: p.clicks, sameDom: document.querySelector(".vc-companion") === p.node };
  }, COMPANION_DETAIL_EVENT);
  await writeFile(`.scratch-pw/companion-060-found-${label}.json`, JSON.stringify({ agingClockControlled: true, interactionsRealTime: true, ...result }, null, 2));
  expect(result.sameDom).toBe(true); return result;
}
async function point(page: Page) {
  return pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom, width: r.width, height: r.height }; });
}
async function quietFound(page: Page) {
  // No input/resize runs during this probe. PC's existing popover separately
  // follows its source card every frame, so bound reads count only the guest
  // and actual detail room; all Range reads and guest drawing writes count.
  const result = await pet(page).evaluate(async node => {
    let writes = 0, ranges = 0, bounds = 0;
    const room = document.querySelector(".agenda-detail-sheet");
    const getBounds = Element.prototype.getBoundingClientRect, getRange = Range.prototype.getClientRects;
    const observer = new MutationObserver(records => { writes += records.length; }); observer.observe(node, { subtree: true, attributes: true, attributeFilter: ["style", "hidden", "data-state", "data-hide-phase", "data-petting"] });
    Element.prototype.getBoundingClientRect = function () { if (this === room || room?.contains(this) || node.contains(this)) bounds++; return getBounds.call(this); };
    Range.prototype.getClientRects = function () { ranges++; return getRange.call(this); };
    await new Promise(resolve => setTimeout(resolve, 400)); observer.disconnect(); Element.prototype.getBoundingClientRect = getBounds; Range.prototype.getClientRects = getRange;
    return { writes, ranges, bounds };
  });
  expect(result).toEqual({ writes: 0, ranges: 0, bounds: 0 }); return result;
}
async function dragGuest(page: Page, to: Point, mobile: boolean, cancel = false) {
  const from = await actor(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * .4 }; });
  const distance = Math.hypot(to.x - from.x, to.y - from.y), along = (pixels: number) => ({ x: from.x + (to.x - from.x) / distance * pixels, y: from.y + (to.y - from.y) / distance * pixels });
  expect(distance).toBeGreaterThan(7);
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, ...from }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, ...along(5) }] }); await expect(pet(page)).not.toHaveAttribute("data-overlay-drag");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, ...along(7) }] }); await expect(pet(page)).toHaveAttribute("data-overlay-drag", "");
    for (let step = 1; step <= 12; step++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: from.x + (to.x - from.x) * step / 12, y: from.y + (to.y - from.y) * step / 12 }] }); await page.waitForTimeout(16); }
    await expect(pet(page)).toHaveAttribute("data-overlay-drag", "");
    await page.waitForTimeout(240);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await cdp.send("Input.dispatchTouchEvent", { type: cancel ? "touchCancel" : "touchEnd", touchPoints: [] }); await cdp.detach();
  } else {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    const five = along(5), seven = along(7); await page.mouse.move(five.x, five.y); await expect(pet(page)).not.toHaveAttribute("data-overlay-drag");
    await page.mouse.move(seven.x, seven.y); await expect(pet(page)).toHaveAttribute("data-overlay-drag", "");
    await page.mouse.move(to.x, to.y, { steps: 12 }); await expect(pet(page)).toHaveAttribute("data-overlay-drag", "");
    await page.waitForTimeout(240);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    if (cancel) await actor(page).evaluate(node => { const button = node as HTMLButtonElement; for (let id = 1; id < 10; id++) if (button.hasPointerCapture(id)) button.releasePointerCapture(id); });
    await page.mouse.up();
  }
  await expect(pet(page)).not.toHaveAttribute("data-overlay-drag");
}

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const mobile of [false]) test.describe(mobile ? "native touch finding" : "native pointer finding", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1400 }, hasTouch: mobile, isMobile: mobile });
  test("wrong detail pauses hiding; the ready matching window reveals one interactive guest which can be taken outside", async ({ page }) => {
    test.setTimeout(60_000);
    const target = await setup(page, mobile);
    await expect(hint(page)).toHaveCount(1); await expect(hint(page)).toHaveAttribute("data-eventid", target.eventId);
    const originalCardTransform = await hint(page).evaluate(node => getComputedStyle(node).transform);
    await page.screenshot({ path: `.scratch-pw/companion-060-hide-hint-${mobile ? "390" : "1920"}.png` });
    await nativeClick(page, await cardPoint(page, target.eventId, false), mobile); await expect(sheet(page)).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
    await expect(sheet(page)).not.toHaveAttribute("data-companion-detail-event", target.eventId);
    await page.clock.runFor(32_000); await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden"); await expect(pet(page)).toBeHidden();
    await page.keyboard.press("Escape"); await expect(sheet(page)).toHaveCount(0); await page.clock.runFor(1000);
    await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden");
    await expect(hint(page)).toHaveCount(1); expect(await hint(page).evaluate(node => getComputedStyle(node).transform)).toBe(originalCardTransform);
    // Only rare hide selection/aging above is clock-controlled. Window
    // entrance, first paint and every interaction below use the real clock.
    await page.clock.resume(); await startFoundProbe(page);
    await nativeClick(page, await cardPoint(page, target.eventId, true), mobile);
    await expect(sheet(page)).toHaveAttribute("data-companion-detail-event", target.eventId); await expect(pet(page)).toHaveAttribute("data-hide-phase", "found");
    await expect(pet(page)).toHaveAttribute("data-hide-phase", "settled"); await expect(pet(page)).toBeVisible(); await expect(hint(page)).toHaveCount(0);
    await expect(pet(page)).toHaveAttribute("data-detail-guest", ""); await expect(pet(page)).toHaveAttribute("data-hide-perch", /^(inside|outside)$/);
    expect(await actor(page).evaluate(node => getComputedStyle(node).pointerEvents)).toBe("auto"); await expect(actor(page)).not.toBeFocused();
    const finalPerch = await point(page);
    const first = await page.evaluate(() => { const p = (window as FoundWindow).foundProbe!; cancelAnimationFrame(p.raf); return p.frames.find(f => f.visible); });
    expect(first, "the guest has a real first visible frame").toBeDefined(); expect(first!.ready).toBe(true);
    expect(Math.abs(first!.x + first!.width / 2 - finalPerch.x)).toBeLessThan(2); expect(Math.abs(first!.y + first!.height - finalPerch.y)).toBeLessThan(2);
    expect(Math.abs(first!.width - finalPerch.width)).toBeLessThan(.1);
    await quietFound(page);
    const focusBefore = await page.evaluate(() => document.activeElement?.className);
    if (mobile) await actor(page).tap();
    else {
      const y = finalPerch.y - finalPerch.height * .45;
      await page.mouse.move(finalPerch.x - finalPerch.width * .24, y);
      for (const direction of [1, -1, 1]) { await page.mouse.move(finalPerch.x + direction * finalPerch.width * .24, y, { steps: 12 }); await page.waitForTimeout(40); }
      await expect(pet(page).locator(".vc-petting-hand")).toBeVisible();
    }
    await expect(pet(page)).toHaveAttribute("data-state", "petted"); await expect(pet(page).locator(".vc-affection-hearts")).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.className)).toBe(focusBefore); await expect(sheet(page)).toHaveAttribute("data-companion-detail-event", target.eventId);
    await page.screenshot({ path: `.scratch-pw/companion-060-hide-found-${mobile ? "390" : "1920"}.png` });
    if (!mobile) {
      const close = sheet(page).locator(".agenda-detail-close"), r = (await close.boundingBox())!;
      await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
      await expect(pet(page)).not.toHaveAttribute("data-petting"); await expect(page.locator("[data-vc-petting-cursor]")).toHaveCount(0);
      expect(await close.evaluate(node => getComputedStyle(node).cursor)).not.toBe("none");
      await page.mouse.move(0, 0);
    }
    // Native keyboard pickup uses the same guest capability and keeps the
    // already-open detail. No synthetic key/capture is dispatched.
    await actor(page).focus(); const beforeKey = await point(page); await actor(page).press("Space"); await actor(page).press(beforeKey.x > page.viewportSize()!.width / 2 ? "ArrowLeft" : "ArrowRight");
    expect(Math.abs((await point(page)).x - beforeKey.x)).toBeGreaterThan(1);
    await actor(page).press("Escape");
    await expect(sheet(page)).toHaveAttribute("data-companion-detail-event", target.eventId); await expect(pet(page)).not.toHaveAttribute("data-overlay-drag");
    const afterKey = await point(page); expect(Math.hypot(afterKey.x - beforeKey.x, afterKey.y - beforeKey.y)).toBeLessThan(2);
    await waitForOverlayEntrance(sheet(page));
    const beforeCancel = await point(page);
    await dragGuest(page, { x: beforeCancel.x - 18, y: beforeCancel.y - beforeCancel.height * .4 }, mobile, true);
    await page.waitForTimeout(250);
    const cancelledShape = await pet(page).locator(".vc-pose").evaluate(node => { const css = getComputedStyle(node), m = new DOMMatrixReadOnly(css.transform); return { scaleX: Math.hypot(m.a, m.b), scaleY: Math.hypot(m.c, m.d), origin: css.transformOrigin, originY: parseFloat(css.transformOrigin.split(" ")[1]), height: parseFloat(css.height) }; });
    console.log(JSON.stringify({ check: "found-cancel-release-shape", mobile, cancelledShape }));
    expect(cancelledShape.scaleY, "the finite held release must settle before the guest sleeps").toBeLessThan(1.05);
    expect(Math.abs(cancelledShape.originY - cancelledShape.height), "the released drawing restores its support pivot").toBeLessThan(.5);
    await expect(pet(page)).toHaveAttribute("data-hide-phase", "settled"); await expect(pet(page)).toHaveAttribute("data-detail-guest", ""); await expect(sheet(page)).toHaveAttribute("data-companion-detail-event", target.eventId);
    expect(await actor(page).evaluate(node => { const b = node as HTMLButtonElement; return [...Array(10).keys()].some(id => b.hasPointerCapture(id)); })).toBe(false);
    const outside = await sheet(page).evaluate(node => { const r = node.getBoundingClientRect(); return r.left > 100 ? { x: r.left - 65, y: Math.max(80, Math.min(innerHeight - 70, r.top + 100)) } : { x: innerWidth / 2, y: Math.max(3, r.top - 18) }; });
    await dragGuest(page, outside, mobile);
    await expect(sheet(page)).toHaveAttribute("data-companion-detail-event", target.eventId); await expect(pet(page)).toHaveAttribute("data-hide-perch", "outside");
    await expect(pet(page)).not.toHaveAttribute("data-hide-phase"); await expect(pet(page)).toBeVisible();
    const released = await point(page); await page.waitForTimeout(500); const still = await point(page);
    expect(Math.hypot(still.x - released.x, still.y - released.y)).toBeLessThan(2);
    await page.screenshot({ path: `.scratch-pw/companion-060-hide-outside-${mobile ? "390" : "1920"}.png` });
    await pet(page).evaluate(node => {
      const witness = { frames: [] as DropClosingFrame[], raf: 0 }, began = performance.now();
      const sample = (now: number) => { const r = node.getBoundingClientRect(), el = node as HTMLElement; witness.frames.push({ at: now - began, x: r.left + r.width / 2, y: r.bottom, width: r.width, hidden: el.hidden, same: node.isConnected && node === document.querySelector(".vc-companion"), returning: el.getAttribute("data-returning"), platform: el.dataset.platform ?? "" }); witness.raf = requestAnimationFrame(sample); };
      (window as DropClosingWindow).guestDropClosing = witness; witness.raf = requestAnimationFrame(sample);
    });
    await page.keyboard.press("Escape"); await expect(sheet(page)).toHaveCount(0);
    await expect(pet(page)).not.toHaveAttribute("data-returning", /./, { timeout: 4000 }); await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", /\S+/);
    await expect(pet(page)).not.toHaveAttribute("data-detail-guest"); await expect(hint(page)).toHaveCount(0);
    const landed = await point(page);
    const closing = await page.evaluate(() => { const witness = (window as DropClosingWindow).guestDropClosing!; cancelAnimationFrame(witness.raf); return witness.frames; });
    // Preserve the raw witness before assertions on success and failure. Only
    // hide aging above is controlled; this close/landing uses real frame time.
    await writeFile(`.scratch-pw/companion-069-guest-close-${mobile ? "390" : "1920"}.json`, JSON.stringify({ agingClockControlled: true, closeFramesRealTime: true, released, still, landed, frames: closing }, null, 2));
    expect(Math.abs(landed.x - released.x)).toBeLessThan(3);
    expect(closing.length).toBeGreaterThan(5); expect(closing.every(frame => frame.same && !frame.hidden)).toBe(true);
    expect(Math.max(...closing.map(frame => Math.abs(frame.x - released.x)))).toBeLessThan(3);
    const found = await finishFoundProbe(page, mobile ? "390" : "1920"); expect(found.captures).toBeGreaterThan(0);
    console.log(JSON.stringify({ check: "found-guest-real-input", mobile, first, finalPerch, released, still, landed, captures: found.captures }));
    const result = await evidence(page, mobile ? "found-390" : "found-1920"); expect(result.phases).toEqual(expect.arrayContaining(["entering", "hidden", "found", "settled", null]));
  });
});

test("unfound guest is quiescent, then emerges on the bounded controlled deadline without clicking or replacing its world", async ({ page }) => {
  test.setTimeout(60_000); await page.setViewportSize({ width: 1920, height: 1000 }); const target = await setup(page, false);
  const source = page.locator(CARD).nth(target.cardIndex), originalPlatform = (await pet(page).getAttribute("data-platform"))!;
  await expect(hint(page)).toHaveCount(1); await expect(hint(page)).toHaveAttribute("data-eventid", target.eventId);
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
  await expect(hint(page)).toHaveCount(0);
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

test("gfx-off has no animated hiding hint and a found guest still supports native keyboard interaction", async ({ page }) => {
  test.setTimeout(60_000); await page.setViewportSize({ width: 1920, height: 1400 }); const target = await setup(page, false, "off");
  await expect(page.locator("html")).toHaveAttribute("data-gfx", "off");
  const animations = await page.locator(CARD).evaluateAll(nodes => nodes.flatMap(node => node.getAnimations({ subtree: true })).filter(a => a.playState === "running").map(a => a instanceof CSSAnimation ? a.animationName : ""));
  expect(animations.filter(name => /hide|hint|wiggle/.test(name))).toEqual([]);
  await page.clock.resume(); await startFoundProbe(page); await nativeClick(page, await cardPoint(page, target.eventId, true), false);
  await expect(pet(page)).toHaveAttribute("data-hide-phase", "settled"); await expect(pet(page)).toBeVisible();
  const first = await page.evaluate(() => { const p = (window as FoundWindow).foundProbe!; cancelAnimationFrame(p.raf); return p.frames.find(f => f.visible); });
  expect(first?.ready).toBe(true); await quietFound(page);
  await actor(page).focus(); await actor(page).press("Enter"); await expect(pet(page)).toHaveAttribute("data-state", "petted");
  expect(await pet(page).locator(".vc-affection-hearts i").evaluateAll(nodes => nodes.map(node => getComputedStyle(node).animationName))).toEqual(["none", "none", "none"]);
  await page.keyboard.press("Escape"); await expect(sheet(page)).toHaveCount(0); await expect(pet(page)).not.toHaveAttribute("data-detail-guest");
  await finishFoundProbe(page, "gfx-off");
});

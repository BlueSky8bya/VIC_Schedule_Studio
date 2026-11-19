import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionCare, openCompanionHome, placeCompanionAt } from "./helpers/companion-home";
import { installCompanionPointReader, type CompanionPointWindow } from "./helpers/companion-point";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const posts = new WeakMap<Page, string[]>();

type ScrollFrame = { at: number; scrollY: number; x: number; y: number; anchorY: number | null; error: number; state: string; platform: string; journey: string; presence: string; hidden: boolean };
type ScrollProbe = Window & { companionScrollRanges?: number; companionScrollWrites?: number };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, walking = false, allowHomeRest = false, parkOnBlur = false) {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript(({ epoch, epochKey, preferences, care, walking }) => {
    localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    Math.random = () => walking ? .9999 : 0;
    // Focus-event branch fixture, not a claim about native OS focus throttling.
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: walking, animalMode: "dog", speed: "relaxed", jump: false, sleep: allowHomeRest, activeWhileVisible: !parkOnBlur, feeding: false, heartPrank: false, ambientPrank: false }, care: DEFAULT_COMPANION_CARE, walking });
  await page.goto("/visual-fixture/poster");
  await expect(actor(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
    // The fixture normally fits one screen. Extend only its document flow so
    // real window scroll events move the existing calendar DOM and anchors.
    document.documentElement.style.overflowY = "auto";
    document.documentElement.style.scrollBehavior = "auto";
    document.body.style.overflowY = "visible";
    const spacer = document.createElement("div");
    spacer.dataset.companionScrollSpacer = ""; spacer.setAttribute("aria-hidden", "true");
    spacer.style.cssText = "height:1000px;pointer-events:none"; document.body.append(spacer);
  });
  await expect(pet(page)).toHaveAttribute("data-presence", "active");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(200);
  await expect(page.locator("[data-export-surface]")).toHaveJSProperty("offsetWidth", 1840);
  await expect(pet(page)).toHaveCount(1);
}

/** A fresh companion begins inside its home now (a44f46a2), and a person can only put it on a card's top edge
 * (text lines are autonomous-only ledges). So the calendar support under test is a real card top: the companion is
 * placed there with the keyboard placement, and the oracle keeps that card element and the measured foot offset. */
async function standOnCalendarCard(page: Page, band: { minTop?: number; maxTop?: number } = {}) {
  const target = await page.evaluate(({ minTop, maxTop }) => {
    const pet = document.querySelector(".vc-companion")!.getBoundingClientRect(), size = pet.width, half = size * .38 + 4, height = size * .76 + 4;
    const shown = (node: Element) => { const r = node.getBoundingClientRect(), css = getComputedStyle(node); return r.width > 0 && r.height > 0 && css.visibility === "visible" && css.display !== "none"; };
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button],.vc-home,.vc-home-launcher")]
      .filter(node => shown(node) && !node.matches(".public-event,.public-day") && !node.closest(".vc-companion")).map(node => node.getBoundingClientRect());
    for (const node of document.querySelectorAll<HTMLElement>(".public-event[data-eventid]:not(.teaser):not(.is-support)")) {
      const rect = node.getBoundingClientRect();
      if (!shown(node) || rect.width < size || rect.top < Math.max(size + 60, minTop) || rect.top > Math.min(innerHeight - 120, maxTop)) continue;
      for (const fraction of [.5, .25, .75]) {
        const x = rect.left + rect.width * fraction;
        if (controls.some(control => control.left < x + half && control.right > x - half && control.top < rect.top && control.bottom > rect.top - height)) continue;
        if (document.elementFromPoint(x, rect.top + Math.min(4, rect.height / 2))?.closest(".public-event") !== node) continue;
        node.dataset.companionScrollAnchor = ""; return { x, y: rect.top - 18 };
      }
    }
    return null;
  }, { minTop: band.minTop ?? 0, maxTop: band.maxTop ?? Infinity });
  expect(target, "the fixture must show an ordinary card with a body-clear top in the wanted band").not.toBeNull();
  await placeCompanionAt(page, target!, /^card-\d+-top(?:-\d+)?$/);
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - document.querySelector("[data-companion-scroll-anchor]")!.getBoundingClientRect().top + 3))).toBeLessThan(2);
  return page.evaluate(() => {
    const rect = document.querySelector(".vc-companion")!.getBoundingClientRect();
    const anchor = document.querySelector("[data-companion-scroll-anchor]")!.getBoundingClientRect();
    return { offset: rect.bottom - anchor.top, y: rect.bottom, platform: (document.querySelector(".vc-companion") as HTMLElement).dataset.platform! };
  });
}

/** Real elapsed-time rAF samples; no page.clock, CSS transform stand-in or
 * product debug hook. Read before the next native scroll write. */
async function scrollFrames(page: Page, offset: number | null, distance = 96, duration = 1200, tail = 80): Promise<ScrollFrame[]> {
  return page.evaluate(({ offset, distance, duration, tail }) => new Promise<ScrollFrame[]>(resolve => {
    const element = document.querySelector<HTMLElement>(".vc-companion")!;
    const anchor = document.querySelector("[data-companion-scroll-anchor]");
    const startY = scrollY, frames: ScrollFrame[] = [];
    let began = 0;
    function frame(now: number) {
      began ||= now;
      const rect = element.getBoundingClientRect(), anchorY = anchor?.getBoundingClientRect().top ?? null;
      frames.push({ at: now - began, scrollY, x: rect.left + rect.width / 2, y: rect.bottom, anchorY,
        error: offset !== null && anchorY !== null ? Math.abs(rect.bottom - anchorY - offset) : 0,
        state: element.dataset.state ?? "", platform: element.dataset.platform ?? "", journey: element.dataset.journey ?? "", presence: element.dataset.presence ?? "", hidden: element.hidden });
      const elapsed = now - began;
      if (elapsed > duration + tail) { resolve(frames); return; }
      window.scrollTo({ top: startY + distance * Math.min(elapsed / duration, 1), behavior: "instant" });
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }), { offset, distance, duration, tail });
}

function expectSmoothTextContact(frames: ScrollFrame[]) {
  expect(frames.length).toBeGreaterThan(25);
  expect(frames.at(-1)!.scrollY - frames[0].scrollY).toBeGreaterThanOrEqual(90);
  expect(frames.every(frame => !frame.hidden)).toBe(true);
  const errors = frames.map(frame => frame.error).sort((a, b) => a - b);
  expect(errors[Math.floor(errors.length * .95)]).toBeLessThanOrEqual(4.5);
  expect(errors.at(-1)).toBeLessThanOrEqual(8);
  return { samples: frames.length, scroll: frames.at(-1)!.scrollY - frames[0].scrollY, p95FootError: errors[Math.floor(errors.length * .95)], maxFootError: errors.at(-1) };
}

test("resting calendar support follows native document scroll between full geometry scans", async ({ page }) => {
  await setup(page);
  const support = await standOnCalendarCard(page);
  const frames = await scrollFrames(page, support.offset);
  const summary = expectSmoothTextContact(frames);
  expect(new Set(frames.map(frame => frame.platform))).toEqual(new Set([support.platform]));
  expect(frames.every(frame => frame.state !== "jump" && frame.presence === "active")).toBe(true);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveCount(1);
  await expect(page.locator("[data-export-surface]")).toHaveJSProperty("offsetWidth", 1840);
  await page.screenshot({ path: ".scratch-pw/companion-scroll-active.png" });
  console.log(JSON.stringify({ check: "companion-calendar-scroll", ...summary, platform: support.platform }));
});

test("a floor walk keeps its action clock and fixed feet while the document scrolls", async ({ page }) => {
  await setup(page, true);
  const route = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".poster-page")!;
    const cell = document.querySelector(".vc-companion")!.getBoundingClientRect();
    let floorY = innerHeight - 18;
    for (const bar of root.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const rect = bar.getBoundingClientRect();
      if (getComputedStyle(bar).position === "fixed" && rect.width > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) floorY = Math.min(floorY, rect.top - 8);
    }
    const forbidden: { left: number; right: number }[] = [];
    const inspect = (rect: DOMRect, element: Element) => {
      let fixed = false;
      for (let node: Element | null = element; node; node = node.parentElement) if (getComputedStyle(node).position === "fixed") { fixed = true; break; }
      // Protect the actual opaque body throughout this 96px native scroll.
      if (rect.bottom > floorY - cell.height * .76 - 3 && rect.top - (fixed ? 0 : 96) < floorY + 3) forbidden.push({ left: rect.left - cell.width * .38 - 4, right: rect.right + cell.width * .38 + 4 });
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || parent.closest("script,style,svg,.sr-only,.vc-companion")) continue;
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") continue;
      range.selectNodeContents(node); for (const rect of range.getClientRects()) if (rect.width > .5 && rect.height > .5) inspect(rect, parent);
    }
    range.detach();
    for (const control of root.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role='button']")) {
      if (control.matches(".public-event,.agenda-event,.agenda-item,.public-day,.agenda-day") || control.closest(".vc-companion")) continue;
      const rect = control.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) inspect(rect, control);
    }
    let spans = [{ left: 420, right: innerWidth - 70 }];
    for (const blocked of forbidden) spans = spans.flatMap(span => blocked.right <= span.left || blocked.left >= span.right ? [span] : [{ left: span.left, right: Math.min(span.right, blocked.left) }, { left: Math.max(span.left, blocked.right), right: span.right }].filter(next => next.right > next.left));
    const free = spans.find(span => span.right - span.left >= 155);
    return free ? { from: free.left + 12, pointer: free.left + 140, floorY } : null;
  });
  expect(route, "fixture must contain a real, clear floor corridor for a 100px walk").not.toBeNull();
  await openCompanionHome(page); await chooseCompanionCare(page, "옮길 곳 고르기");
  await page.mouse.click(route!.from, page.viewportSize()!.height - 20);
  // Set the dog's destination during the user-command landing, before its
  // next decision can choose a shorter walk towards the placement click.
  await page.mouse.move(route!.pointer, route!.floorY);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect(pet(page)).toHaveAttribute("data-state", "walk", { timeout: 8000 });
  // A walk's clock is set once more when the stride really starts (about 0.1s after the state appears), so the
  // clock under test is read once the feet have moved. The whole walk lasts about 1.5s: scroll within it.
  const walkFrom = (await pet(page).boundingBox())!.x;
  await expect.poll(async () => (await pet(page).boundingBox())!.x - walkFrom, { intervals: [30] }).toBeGreaterThan(2);
  const journey = await pet(page).getAttribute("data-journey"); expect(journey).toBeTruthy();
  const frames = await scrollFrames(page, null, 96, 800);
  expect(frames.length).toBeGreaterThan(25);
  expect(frames.at(-1)!.scrollY - frames[0].scrollY).toBeGreaterThanOrEqual(90);
  expect(frames.every(frame => frame.state === "walk" && frame.journey === journey && !frame.hidden)).toBe(true);
  expect(frames.every(frame => frame.platform.startsWith("viewport-floor"))).toBe(true);
  expect(Math.max(...frames.map(frame => Math.abs(frame.y - route!.floorY)))).toBeLessThan(2);
  expect(frames.at(-1)!.x - frames[0].x).toBeGreaterThan(25);
  expect(frames.every((frame, index) => !index || frame.x >= frames[index - 1].x - .1)).toBe(true);
  await page.screenshot({ path: ".scratch-pw/companion-scroll-floor-walk.png" });
  console.log(JSON.stringify({ check: "companion-floor-scroll", samples: frames.length, journey, travel: frames.at(-1)!.x - frames[0].x, maxFloorError: Math.max(...frames.map(frame => Math.abs(frame.y - route!.floorY))) }));
});

test("parked calendar support follows scrolling, then releases geometry and DOM writes again", async ({ page }) => {
  // Automatic sleep stays on here: with it off a parked companion poses awake (1f2cb9eb), and this test is about
  // the quiet, sleeping park. "다른 창 쓸 때도 놀기" is on by default now, so it is turned off for the blur to park.
  await setup(page, false, true, true);
  const support = await standOnCalendarCard(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false });
    window.dispatchEvent(new FocusEvent("blur"));
  });
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
  await page.evaluate(() => {
    const probe = window as ScrollProbe; probe.companionScrollRanges = 0; probe.companionScrollWrites = 0;
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { probe.companionScrollRanges!++; return original.call(this); };
    new MutationObserver(records => { probe.companionScrollWrites! += records.length; }).observe(document.querySelector(".vc-companion")!, { subtree: true, attributes: true });
  });
  const frames = await scrollFrames(page, support.offset);
  const summary = expectSmoothTextContact(frames);
  expect(frames.every(frame => frame.presence === "parked" && frame.state === "sleep")).toBe(true);
  expect(new Set(frames.map(frame => frame.platform))).toEqual(new Set([support.platform]));
  // The explicit scroll response now owns a finite900ms settling tail. Measure
  // autonomous quiet only after that requested response has actually ended.
  await page.waitForTimeout(1000);
  await page.evaluate(() => { const probe = window as ScrollProbe; probe.companionScrollRanges = 0; probe.companionScrollWrites = 0; });
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => ({ ranges: (window as ScrollProbe).companionScrollRanges, writes: (window as ScrollProbe).companionScrollWrites, hidden: document.hidden, focused: document.hasFocus() }))).toEqual({ ranges: 0, writes: 0, hidden: false, focused: false });
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveCount(1);
  await page.screenshot({ path: ".scratch-pw/companion-scroll-parked.png" });
  console.log(JSON.stringify({ check: "companion-parked-scroll", ...summary, quietRanges: 0, quietWrites: 0 }));
});

// The recall is a route of short legs now (card top, a day edge, the home floor, the sofa: about 4.4s standing
// still), each leg with its own clock, and a leg is anchored to the page. Since 9e346ecc (owner call 2026-11-20:
// "no hiding") a scroll that carries the departure card out of the top no longer hides the companion: the recovery
// fall starts from the visible edge and stops following the old support. What must hold: the leg under way is
// untouched while it is on screen, the companion is never hidden during the recall, never drops out of its flight,
// and the recall still ends asleep on the sofa.
// Bounds: hidden time 0. Landing: within 10 s of the click. After the scroll the route itself is longer (measured
// 6.7-8.5 s on 9e346ecc); the owner asked only for "no hiding", not for a landing time.
type RecallFrame = { at: number; hidden: boolean; reason: string; platform: string; box: { left: number; top: number; right: number; bottom: number }; rect: { left: number; top: number; right: number; bottom: number } | null };
type RecallProbe = Window & { recallFrames?: RecallFrame[]; recallStop?: boolean };
test("a home recall whose departure card scrolls out of view is recovered and still reaches the sofa", async ({ page }) => {
  test.setTimeout(60000);
  await installCompanionPointReader(page);
  await setup(page, false, true);
  await openCompanionHome(page);
  const destination = await page.locator(".vc-home-cushion").evaluate(node => node.getBoundingClientRect().top);
  // The departure card must scroll out above the safe clip while the sofa stays a visible ledge below it.
  const support = await standOnCalendarCard(page, { minTop: 445, maxTop: destination - 55 });
  const distance = await page.evaluate(() => document.querySelector("[data-companion-scroll-anchor]")!.getBoundingClientRect().top - 40);
  expect(distance).toBeGreaterThan(400);
  expect(destination - distance, "the real destination must remain a valid visible ledge").toBeGreaterThan(90);
  // One sample per painted frame from the click to the landing. While the node is hidden it has no layout box, so its
  // box is read from the same inline transform and size the renderer paints with (the reader is checked against the
  // real box on every visible frame below).
  await page.evaluate(() => {
    const probe = window as RecallProbe, frames: RecallFrame[] = []; probe.recallFrames = frames; probe.recallStop = false;
    const began = performance.now();
    const sample = (now: number) => {
      if (probe.recallStop) return;
      const el = document.querySelector<HTMLElement>(".vc-companion")!, size = parseFloat(el.style.getPropertyValue("--vc-size"));
      const p = (window as unknown as CompanionPointWindow).vcPoint(el, el.style.transform), r = el.hidden ? null : el.getBoundingClientRect();
      frames.push({ at: now - began, hidden: el.hidden, reason: el.dataset.hiddenReason ?? "", platform: el.dataset.platform ?? "",
        box: { left: p.x, top: p.y, right: p.x + size, bottom: p.y + size }, rect: r && { left: r.left, top: r.top, right: r.right, bottom: r.bottom } });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  const clickedAt = Date.now();
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  const journey = await pet(page).getAttribute("data-journey"); expect(journey).toBeTruthy();
  // Keep observing beyond the 120ms full-scan coalescing window after the
  // source leaves safe clipping.
  const frames = await scrollFrames(page, support.offset, distance, 700, 260);
  const clipped = frames.filter(frame => frame.anchorY !== null && frame.anchorY < 84);
  expect(clipped.length).toBeGreaterThan(4);
  expect(clipped.at(-1)!.at - clipped[0].at).toBeGreaterThan(200);
  const firstLeg = frames.filter(frame => frame.journey === journey);
  expect(firstLeg.length).toBeGreaterThan(10);
  expect(firstLeg.every(frame => frame.state === "jump" && !frame.hidden && frame.y > 0)).toBe(true);
  expect(frames.slice(0, firstLeg.length).every(frame => frame.journey === journey), "the leg under way is not restarted while it is on screen").toBe(true);
  expect(frames.every(frame => frame.state === "jump" && frame.presence === "active")).toBe(true);
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: Math.max(1, 10000 - (Date.now() - clickedAt)) });
  const recall = await page.evaluate(() => { const probe = window as RecallProbe; probe.recallStop = true; return probe.recallFrames!; });
  const landedAt = recall.find(frame => frame.platform === "companion-home")!.at, untilLanding = recall.filter(frame => frame.at <= landedAt);
  expect(landedAt, "the recall lands on the sofa within 10 s (longer route after the scroll, 9e346ecc)").toBeLessThanOrEqual(10000);
  const visibleFrames = untilLanding.filter(frame => frame.rect);
  expect(visibleFrames.length).toBeGreaterThan(20);
  expect(Math.max(...visibleFrames.map(frame => Math.max(...(["left", "top", "right", "bottom"] as const).map(side => Math.abs(frame.box[side] - frame.rect![side]))))), "the transform reader matches the painted box").toBeLessThan(2);
  const hiddenMs = untilLanding.reduce((sum, frame, index) => sum + (index && untilLanding[index - 1].hidden ? frame.at - untilLanding[index - 1].at : 0), 0);
  expect(hiddenMs, "total time hidden during the recall (no hiding since 9e346ecc)").toBe(0);
  const onScreen = (b: RecallFrame["box"]) => b.right > 0 && b.left < 1920 && b.bottom > 0 && b.top < 1100;
  expect(untilLanding.filter(frame => frame.hidden), "never hidden during the recall").toEqual([]);
  expect(untilLanding.filter(frame => frame.hidden && onScreen(frame.box)), "never hidden while the body box is on screen").toEqual([]);
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top))).toBeLessThan(2);
  await expect(actor(page)).toBeVisible();
  console.log(JSON.stringify({ check: "companion-clipped-recall", departure: support.platform, journey, firstLegSamples: firstLeg.length, hiddenSamples: frames.filter(frame => frame.hidden).length, clippedSamples: clipped.length, clippedDuration: clipped.at(-1)!.at - clipped[0].at, landing: "companion-home" }));
});

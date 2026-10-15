import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionCare, openCompanionHome } from "./helpers/companion-home";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const posts = new WeakMap<Page, string[]>();
const TEXT_SURFACES = ".public-day .day-strip > strong,.agenda-day .agenda-when > strong,.public-event .event-main p,.public-event .event-subs li,.agenda-event .agenda-title-text,.agenda-event .agenda-subs li,.agenda-item .agenda-title-text,.agenda-item .agenda-title,.agenda-item .agenda-subs li";

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

async function setup(page: Page, walking = false, allowHomeRest = false) {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript(({ epoch, epochKey, preferences, care, walking }) => {
    localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    Math.random = () => walking ? .9999 : 0;
    // Focus-event branch fixture, not a claim about native OS focus throttling.
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: walking, animalMode: "dog", speed: "relaxed", jump: false, sleep: allowHomeRest, feeding: false, heartPrank: false, ambientPrank: false }, care: DEFAULT_COMPANION_CARE, walking });
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

/** Independent support oracle: match the real visible text line beneath the
 * resting feet, then retain its element and measured offset, never its text. */
async function identifyTextSupport(page: Page) {
  await expect(pet(page)).toHaveAttribute("data-platform", /^(?:date|card)-\d+/);
  await expect.poll(() => page.evaluate(selector => {
    const element = document.querySelector<HTMLElement>(".vc-companion")!, feet = element.getBoundingClientRect();
    const x = feet.left + feet.width / 2;
    const matches: { node: HTMLElement; error: number }[] = [];
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      const range = document.createRange(); range.selectNodeContents(node);
      for (const line of range.getClientRects()) {
        if (x >= line.left - .5 && x <= line.right + .5 && line.width > .5 && line.height > .5) matches.push({ node, error: Math.abs(feet.bottom - line.top + 3) });
      }
      range.detach();
    }
    const nearest = matches.sort((a, b) => a.error - b.error)[0];
    if (nearest && nearest.error < 2) nearest.node.dataset.companionScrollAnchor = "";
    return nearest?.error ?? Infinity;
  }, TEXT_SURFACES)).toBeLessThan(2);
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

test("resting text support follows native document scroll between full geometry scans", async ({ page }) => {
  await setup(page);
  const support = await identifyTextSupport(page);
  const frames = await scrollFrames(page, support.offset);
  const summary = expectSmoothTextContact(frames);
  expect(new Set(frames.map(frame => frame.platform))).toEqual(new Set([support.platform]));
  expect(frames.every(frame => frame.state !== "jump" && frame.presence === "active")).toBe(true);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveCount(1);
  await expect(page.locator("[data-export-surface]")).toHaveJSProperty("offsetWidth", 1840);
  await page.screenshot({ path: ".scratch-pw/companion-scroll-active.png" });
  console.log(JSON.stringify({ check: "companion-text-scroll", ...summary, platform: support.platform }));
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
  const journey = await pet(page).getAttribute("data-journey"); expect(journey).toBeTruthy();
  const frames = await scrollFrames(page, null);
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

test("parked text support follows scrolling, then releases geometry and DOM writes again", async ({ page }) => {
  await setup(page);
  const support = await identifyTextSupport(page);
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

test("a home flight keeps its journey when the departure text scrolls outside safe clipping", async ({ page }) => {
  await setup(page, false, true);
  const support = await identifyTextSupport(page);
  const distance = await page.evaluate(() => document.querySelector("[data-companion-scroll-anchor]")!.getBoundingClientRect().top - 40);
  const destination = await page.locator(".vc-home-cushion").evaluate(node => node.getBoundingClientRect().top);
  expect(distance).toBeGreaterThan(400);
  expect(destination - distance, "the real destination must remain a valid visible ledge").toBeGreaterThan(90);
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  const journey = await pet(page).getAttribute("data-journey"); expect(journey).toBeTruthy();
  // Keep observing beyond the 120ms full-scan coalescing window after the
  // source leaves safe clipping, while the original flight is still active.
  const frames = await scrollFrames(page, support.offset, distance, 700, 260);
  const clipped = frames.filter(frame => frame.anchorY !== null && frame.anchorY < 84);
  expect(clipped.length).toBeGreaterThan(4);
  expect(clipped.at(-1)!.at - clipped[0].at).toBeGreaterThan(200);
  expect(frames.every(frame => frame.state === "jump" && frame.journey === journey)).toBe(true);
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 3000 });
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top))).toBeLessThan(2);
  await expect(actor(page)).toBeVisible();
  console.log(JSON.stringify({ check: "companion-clipped-flight", departure: support.platform, journey, clippedSamples: clipped.length, clippedDuration: clipped.at(-1)!.at - clipped[0].at, landing: "companion-home" }));
});

import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { COMPANION_TIMING as T } from "@/lib/ui/viewer-companion/timing";
import { chooseCompanionCare, companionNodeOrigin } from "./helpers/companion-home";
import { expectQuietCompanionVisible } from "./helpers/companion-overlay";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const posts = new WeakMap<Page, string[]>();
type Trace = { at: number; state: string; phase: string; hidden: boolean; y: number; platform: string };
type ProbeWindow = Window & { passiveTrace?: Trace[]; passiveRanges?: number; passiveWrites?: number };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, options: { feeding?: boolean; reduced?: boolean } = {}) {
  await page.addInitScript(({ epoch, epochKey, preferences, care, reduced }) => {
    localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    // "다른 창 쓸 때도 놀기" ships on (1f2cb9eb, 2026-10-19) and keeps a blurred visible page active. Every case
    // here is about the blur that parks, so the seed turns that one switch off.
    // An explicit focus-event branch fixture. This is not proof of native OS
    // focus/visibility throttling, and no virtual/fake animation clock is used.
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, activeWhileVisible: false, roam: false, jump: false, sleep: false, feeding: options.feeding ?? false, heartPrank: false, ambientPrank: false }, care: DEFAULT_COMPANION_CARE, reduced: options.reduced ?? false });
  await page.goto("/visual-fixture/poster");
  await expect(actor(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  await expect(pet(page)).toHaveAttribute("data-presence", "active");
}

async function focus(page: Page, focused: boolean) {
  await page.evaluate(focused => {
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => focused });
    window.dispatchEvent(new FocusEvent(focused ? "focus" : "blur"));
  }, focused);
}

async function trace(page: Page) {
  await pet(page).evaluate(node => {
    const el = node as HTMLElement, probe = window as ProbeWindow;
    probe.passiveTrace = [];
    const record = () => {
      const next = { at: performance.now(), state: el.dataset.state ?? "", phase: el.dataset.presence ?? "", hidden: el.hidden, y: el.getBoundingClientRect().bottom, platform: el.dataset.platform ?? "" };
      const previous = probe.passiveTrace!.at(-1);
      if (!previous || next.state !== previous.state || next.phase !== previous.phase || next.hidden !== previous.hidden) probe.passiveTrace!.push(next);
    };
    record();
    new MutationObserver(record).observe(el, { attributes: true, attributeFilter: ["data-state", "data-presence", "hidden"] });
  });
}

async function openHome(page: Page) {
  const home = page.getByRole("region", { name: "빅타민 집", exact: true });
  if (!await home.isVisible()) await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).click();
  await expect(home).toBeVisible();
}

async function placeOnFloor(page: Page) {
  await openHome(page);
  await chooseCompanionCare(page, "옮길 곳 고르기");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(650, page.viewportSize()!.height - 20);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
}

async function expectFloorContact(page: Page) {
  await expect.poll(() => pet(page).evaluate(el => {
    let y = innerHeight - 18;
    for (const bar of document.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const rect = bar.getBoundingClientRect(), style = getComputedStyle(bar);
      if (style.position === "fixed" && style.display !== "none" && rect.width > 0 && rect.height > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) y = Math.min(y, rect.top - 8);
    }
    return Math.abs(el.getBoundingClientRect().bottom - y);
  })).toBeLessThan(2);
}

test("visible blur finishes a landing, parks with CSS breathing, and disconnects geometry until focus", async ({ page }) => {
  await setup(page); await placeOnFloor(page);
  await actor(page).focus(); await page.keyboard.press("Space");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  await trace(page); await focus(page, false);
  await expect(pet(page)).toHaveAttribute("data-presence", "finishing");
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
  await expect(actor(page)).toBeVisible(); await expectFloorContact(page);
  const events = await page.evaluate(() => (window as ProbeWindow).passiveTrace!);
  expect(events.some(event => event.phase === "finishing" && event.state === "jump")).toBe(true);
  expect(events.some(event => event.phase === "resting")).toBe(true);
  expect(events.some(event => event.phase === "yawning")).toBe(true);
  expect(events.every(event => !event.hidden)).toBe(true);
  const restedAt = events.find(event => event.phase === "resting")!.at;
  const yawnedAt = events.find(event => event.phase === "yawning")!.at;
  const parkedAt = events.find(event => event.phase === "parked")!.at;
  // The unit test pins each exact monotonic700ms boundary. These browser
  // samples run later in MutationObserver microtasks, so allow only1ms of
  // observation resolution per beat, rather than asserting a render cadence.
  const observerResolutionMs = 1;
  expect(yawnedAt - restedAt + observerResolutionMs).toBeGreaterThanOrEqual(T.presenceRest);
  expect(parkedAt - yawnedAt + observerResolutionMs).toBeGreaterThanOrEqual(T.presenceYawn);
  await page.evaluate(() => {
    const probe = window as ProbeWindow; probe.passiveRanges = 0; probe.passiveWrites = 0;
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { probe.passiveRanges!++; return original.call(this); };
    new MutationObserver(records => { probe.passiveWrites! += records.length; }).observe(document.querySelector(".vc-companion")!, { subtree: true, attributes: true, attributeFilter: ["style", "data-state", "data-presence", "data-platform", "data-dreaming", "hidden"] });
  });
  const before = await pet(page).locator(".vc-pose").evaluate(el => ({ transform: getComputedStyle(el).transform, animation: getComputedStyle(el).animationName }));
  expect(before.animation).not.toBe("none");
  for (const spacing of [".02em", ".04em", ".01em"]) {
    await page.locator(".public-event .event-main p").first().evaluate((node, spacing) => { (node as HTMLElement).style.letterSpacing = spacing; }, spacing);
    await page.waitForTimeout(250);
  }
  const after = await pet(page).locator(".vc-pose").evaluate(el => getComputedStyle(el).transform);
  expect(after).not.toBe(before.transform);
  expect(await page.evaluate(() => ({ ranges: (window as ProbeWindow).passiveRanges, writes: (window as ProbeWindow).passiveWrites, hidden: document.hidden, focused: document.hasFocus() }))).toEqual({ ranges: 0, writes: 0, hidden: false, focused: false });
  await page.screenshot({ path: ".scratch-pw/companion-passive-sleep.png" });
  await focus(page, true);
  await expect(pet(page)).toHaveAttribute("data-presence", "waking");
  await expect.poll(() => page.evaluate(() => (window as ProbeWindow).passiveRanges!)).toBeGreaterThan(0);
  await expect(pet(page)).toHaveAttribute("data-presence", "active");
  await expectFloorContact(page); await expect(actor(page)).toBeVisible();
  console.log(JSON.stringify({ check: "passive-landing", events, geometryReadsAfterFocus: await page.evaluate(() => (window as ProbeWindow).passiveRanges) }));
});

test("a meal already in progress completes once before passive sleep", async ({ page }) => {
  await setup(page, { feeding: true }); await placeOnFloor(page);
  await openHome(page); await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  await expect(page.locator(".vc-food")).toHaveCount(1);
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!));
  const point = await pet(page).evaluate(el => { const rect = el.getBoundingClientRect(); return { x: rect.left + rect.width / 2 + 18, y: rect.bottom }; });
  // A dispensed snack falls for about a second and cannot be grabbed until it lands; on the home floor its
  // position is an anchored left/top plus the transform (a3e9a288, 2026-10-25), so read both.
  const snack = page.locator(".vc-food"); await expect(snack).not.toHaveAttribute("data-falling");
  const start = (await snack.boundingBox())!, foot = await companionNodeOrigin(snack);
  const from = { x: start.x + start.width / 2, y: start.y + start.height / 2 };
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(point.x + from.x - foot.x, point.y + from.y - foot.y, { steps: 8 }); await page.mouse.up();
  await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 10000 });
  await trace(page); await focus(page, false);
  await expect(pet(page)).toHaveAttribute("data-presence", "finishing");
  await expect(page.locator(".vc-food")).toHaveCount(0, { timeout: 6000 });
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
  await expect(actor(page)).toBeVisible();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!));
  expect(after.hunger).toBeLessThan(before.hunger - .3); expect(after.affection).toBeGreaterThan(before.affection + .08);
  const events = await page.evaluate(() => (window as ProbeWindow).passiveTrace!);
  expect(events.some(event => event.phase === "finishing" && event.state === "eat")).toBe(true);
  expect(events.every(event => !event.hidden)).toBe(true);
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanionCare"))).toBe(JSON.stringify(after));
  console.log(JSON.stringify({ check: "passive-meal", before, after, events }));
});

test("quick refocus cancels parking while hidden tabs and ordinary overlay quieting keep their own behavior", async ({ page }) => {
  // A fresh creature now starts inside its house (a44f46a2, 2026-10-19). These checks are about one standing
  // outside it, as it did when they were written; the house resident has its own case below.
  await setup(page); await placeOnFloor(page);
  for (let i = 0; i < 5; i++) { await focus(page, false); await page.waitForTimeout(80); await focus(page, true); }
  await expect(pet(page)).toHaveAttribute("data-presence", "active");
  await page.waitForTimeout(1800);
  await expect(pet(page)).toHaveAttribute("data-presence", "active"); await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveCount(1);
  await focus(page, false); await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(pet(page)).toBeHidden();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-presence", "parked");
  await focus(page, true); await expect(pet(page)).toHaveAttribute("data-presence", "active");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expectQuietCompanionVisible(page);
  await page.keyboard.press("Escape"); await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveCount(1);
});

// Regression guard (fixed in 63ecc14a): with the same simulated visibility change as the case above, a creature
// standing in its house (where every fresh one starts) once stayed hidden for good: the house came back closed and
// the resident kept data-hidden-reason="home" until someone reopened it.
test("a house resident is shown again after the tab was hidden and returns", async ({ page }) => {
  await setup(page);
  await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home/);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(pet(page)).toBeHidden();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home/);
});

test("empty measured geometry stays hidden and idle through a blur and hard resume, then recovers on a safe surface", async ({ page }) => {
  // Compact desktop keeps the house closed, so a separate cushion cannot supply
  // a safe ledge behind this deliberately viewport-sized control obstacle.
  await page.setViewportSize({ width: 1280, height: 900 });
  // The fresh creature opens its house and starts inside it (a44f46a2, 2026-10-19). Put it outside and close the
  // house through its own launcher, which restores the "no cushion to stand on" premise of this case.
  await setup(page); await placeOnFloor(page);
  await page.locator('.vc-home-launcher[aria-label="빅타민 집 닫기"]').click();
  // A closed compact house keeps its room in the DOM, undisplayed: no cushion box is left to stand on.
  await expect(page.locator(".vc-home-launcher")).toHaveAttribute("aria-expanded", "false"); await expect(page.locator(".vc-home-cushion")).toBeHidden();
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await page.evaluate(() => {
    const obstacle = document.createElement("button");
    obstacle.type = "button"; obstacle.tabIndex = -1;
    obstacle.dataset.companionEmptyObstacle = "";
    obstacle.setAttribute("aria-label", "Synthetic geometry obstacle");
    // A real measured hit rectangle, not a mocked platform list or animation
    // clock. It excludes every centre interval while leaving app pause OFF.
    obstacle.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;margin:0;padding:0;border:0;background:transparent;pointer-events:none";
    document.querySelector(".poster-page")!.append(obstacle);
  });
  await expect(pet(page)).toBeHidden();
  await expect(pet(page)).toHaveAttribute("data-presence", "active");
  expect(await page.evaluate(() => ({ hidden: document.hidden, inert: (document.querySelector(".poster-page") as HTMLElement).inert }))).toEqual({ hidden: false, inert: false });
  await page.evaluate(() => {
    const probe = window as ProbeWindow; probe.passiveRanges = 0;
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { probe.passiveRanges!++; return original.call(this); };
  });
  // The one final validation of the missing support runs on its own short timer; start counting once it is over.
  let settledReads = -1, quietSamples = 0;
  await expect.poll(async () => {
    const reads = await page.evaluate(() => (window as ProbeWindow).passiveRanges!);
    quietSamples = reads === settledReads ? quietSamples + 1 : 0; settledReads = reads; return quietSamples;
  }, { intervals: [250], timeout: 6000 }).toBeGreaterThanOrEqual(3);
  await page.evaluate(() => { (window as ProbeWindow).passiveRanges = 0; });
  await trace(page); await focus(page, false);
  // f6281fd0 (2026-10-18): while no support exists nothing runs at all - no brain, frame, timer or geometry read -
  // so the hidden creature no longer steps through resting/yawning into a parked sleep. Wait past both beats.
  await page.waitForTimeout(T.presenceRest + T.presenceYawn + 800);
  await expect(pet(page)).toBeHidden();
  const events = await page.evaluate(() => (window as ProbeWindow).passiveTrace!);
  expect(events, JSON.stringify(events)).toHaveLength(1); expect(events[0]).toMatchObject({ phase: "active", hidden: true });
  expect(await page.evaluate(() => (window as ProbeWindow).passiveRanges)).toBe(0);

  // A real DOM change is what the waiting observer listens for: it may validate once, and must not start polling.
  await page.evaluate(() => { document.querySelector<HTMLElement>("[data-companion-empty-obstacle]")!.style.padding = "1px"; });
  await page.waitForTimeout(400);
  const validated = await page.evaluate(() => (window as ProbeWindow).passiveRanges!);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => (window as ProbeWindow).passiveRanges)).toBe(validated);
  await page.evaluate(() => document.documentElement.setAttribute("data-ambient-pause", ""));
  await expect(pet(page)).toBeHidden();
  await page.evaluate(() => document.documentElement.removeAttribute("data-ambient-pause"));
  await page.waitForTimeout(300);
  await expect(pet(page)).toBeHidden();
  const quiet = await page.evaluate(() => (window as ProbeWindow).passiveRanges!);

  await focus(page, true);
  await expect(pet(page)).toHaveAttribute("data-presence", "active");
  await expect(pet(page)).toBeHidden();
  await expect.poll(() => page.evaluate(() => (window as ProbeWindow).passiveRanges!)).toBeGreaterThan(quiet);
  expect((await page.evaluate(() => (window as ProbeWindow).passiveTrace!)).every(event => event.hidden)).toBe(true);
  await page.locator("[data-companion-empty-obstacle]").evaluate(node => node.remove());
  await expect(actor(page)).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-presence", "active");
  await expect(pet(page)).toHaveCount(1);
});

test("a parked floor sleeper remeasures hidden viewport changes without focus and then releases geometry again", async ({ page }) => {
  await setup(page); await placeOnFloor(page);
  await focus(page, false);
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
  await expectFloorContact(page);
  const before = await pet(page).evaluate(el => el.getBoundingClientRect().bottom);
  const care = await page.evaluate(() => localStorage.getItem("vic.viewerCompanionCare"));
  await trace(page);
  await page.evaluate(() => {
    const probe = window as ProbeWindow; probe.passiveRanges = 0;
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { probe.passiveRanges!++; return original.call(this); };
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(pet(page)).toBeHidden();
  // Keep the web topology: this exercises the same runtime's cached support,
  // rather than obtaining fresh geometry by remounting at an agenda breakpoint.
  await page.setViewportSize({ width: 1440, height: 850 });
  await expect(pet(page)).toBeHidden();
  expect(await page.evaluate(() => (window as ProbeWindow).passiveRanges)).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(actor(page)).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-presence", "parked");
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await expectFloorContact(page);
  const bounds = await pet(page).evaluate(el => {
    const rect = el.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight, focused: document.hasFocus() };
  });
  expect(bounds.focused).toBe(false);
  expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width); expect(bounds.bottom).toBeLessThanOrEqual(bounds.height);
  expect(bounds.bottom).toBeLessThan(before - 200);
  await expect.poll(() => page.evaluate(() => (window as ProbeWindow).passiveRanges!)).toBeGreaterThan(0);
  expect((await page.evaluate(() => (window as ProbeWindow).passiveTrace!)).every(event => event.phase === "parked")).toBe(true);

  // Home remounts can send one coalesced layout event after visibility returns.
  // Once that event settles, unrelated text mutations must not restart polling.
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    (window as ProbeWindow).passiveRanges = 0;
    document.querySelector<HTMLElement>(".public-event .event-main p")!.style.letterSpacing = ".03em";
  });
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as ProbeWindow).passiveRanges)).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanionCare"))).toBe(care);
  await expect(pet(page)).toHaveAttribute("data-presence", "parked");
  await expect(pet(page)).toHaveCount(1);
  await page.screenshot({ path: ".scratch-pw/companion-passive-resize.png" });
});

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.

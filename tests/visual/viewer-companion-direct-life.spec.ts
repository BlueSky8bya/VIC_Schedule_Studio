import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const textSurfaces = ".public-day .day-strip > strong,.agenda-day .agenda-when > strong,.public-event .event-main p,.public-event .event-subs li,.agenda-event .agenda-title-text,.agenda-event .agenda-subs li,.agenda-item .agenda-title-text,.agenda-item .agenda-title,.agenda-item .agenda-subs li";
const posts = new WeakMap<Page, string[]>();
type Frame = { at: number; x: number; y: number; hidden: boolean; state: string; platform: string; journey: string; lift: number; scaleY: number };
type DragFrame = { state: string; elapsed: number; captured: boolean; deltaX: number };
type Probe = Window & { directFrames?: Frame[]; directRaf?: number; directNode?: Element; directRanges?: number; directWrites?: number; directPointer?: number; directDrag?: DragFrame; directDragFrames?: DragFrame[] };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, options: { mobile?: boolean; home?: boolean; reduced?: boolean } = {}) {
  await page.setViewportSize(options.mobile ? { width: 390, height: 844 } : { width: 1920, height: 1100 });
  await page.addInitScript(({ epoch, key, preferences, care, reduced }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
    Math.random = () => 0; // An idle local brain leaves the support oracle stationary.
    // Explicit focus-event fixture, not a claim about native OS/OBS throttling.
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: options.home ?? false, feeding: false, heartPrank: false, ambientPrank: false }, care: DEFAULT_COMPANION_CARE, reduced: options.reduced ?? false });
  await page.goto(`/visual-fixture/poster${options.home ? "?avatar=1" : ""}`);
  await expect(actor(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  await expect(pet(page)).toHaveAttribute("data-presence", "active");
  await expect(pet(page)).toHaveCount(1);
}

async function pose(page: Page) {
  return pet(page).evaluate(node => {
    const rect = node.getBoundingClientRect();
    const matrix = new DOMMatrixReadOnly(getComputedStyle(node.querySelector(".vc-reaction")!).transform);
    return { x: rect.left + rect.width / 2, y: rect.bottom, lift: matrix.m42, scaleY: matrix.m22, hidden: (node as HTMLElement).hidden };
  });
}

async function record(page: Page) {
  await page.evaluate(() => {
    const probe = window as Probe, node = document.querySelector<HTMLElement>(".vc-companion")!;
    probe.directNode = node; probe.directFrames = [];
    const sample = () => {
      const rect = node.getBoundingClientRect(), matrix = new DOMMatrixReadOnly(getComputedStyle(node.querySelector(".vc-reaction")!).transform);
      probe.directFrames!.push({ at: performance.now(), x: rect.left + rect.width / 2, y: rect.bottom, hidden: node.hidden, state: node.dataset.state ?? "", platform: node.dataset.platform ?? "", journey: node.dataset.journey ?? "", lift: matrix.m42, scaleY: matrix.m22 });
      probe.directRaf = requestAnimationFrame(sample);
    };
    probe.directRaf = requestAnimationFrame(sample);
  });
}

async function stopRecord(page: Page) {
  return page.evaluate(() => {
    const probe = window as Probe; cancelAnimationFrame(probe.directRaf!);
    return { frames: probe.directFrames!, sameNode: probe.directNode === document.querySelector(".vc-companion") };
  });
}

/** Independent text oracle: find the actual rendered line under the feet.
 * The anonymous product platform id is only a witness, never the oracle. */
async function markTextSupport(page: Page) {
  await expect(pet(page)).toHaveAttribute("data-platform", /^(?:card|date)-\d+/);
  await expect.poll(() => page.evaluate(selector => {
    const feet = document.querySelector(".vc-companion")!.getBoundingClientRect(), x = feet.left + feet.width / 2;
    const matches: { node: HTMLElement; error: number }[] = [];
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      const range = document.createRange(); range.selectNodeContents(node);
      for (const line of range.getClientRects()) if (line.width > .5 && line.height > .5 && x >= line.left - .5 && x <= line.right + .5) matches.push({ node, error: Math.abs(feet.bottom - line.top + 3) });
      range.detach();
    }
    const nearest = matches.sort((a, b) => a.error - b.error)[0];
    if (nearest && nearest.error < 1.5) nearest.node.dataset.directAnchor = "";
    return nearest?.error ?? Infinity;
  }, textSurfaces)).toBeLessThan(1.5);
  return page.evaluate(() => {
    const feet = document.querySelector(".vc-companion")!.getBoundingClientRect(), anchor = document.querySelector("[data-direct-anchor]")!.getBoundingClientRect();
    return { offset: feet.bottom - anchor.top, documentTop: anchor.top + scrollY, width: anchor.width };
  });
}

async function expectActualContact(page: Page) {
  await expect.poll(() => page.evaluate(selector => {
    const feet = document.querySelector(".vc-companion")!.getBoundingClientRect(), x = feet.left + feet.width / 2;
    let floor = innerHeight - 18;
    for (const bar of document.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const rect = bar.getBoundingClientRect();
      if (getComputedStyle(bar).position === "fixed" && rect.width > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) floor = Math.min(floor, rect.top - 8);
    }
    let error = Math.abs(feet.bottom - floor);
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      const range = document.createRange(); range.selectNodeContents(node);
      for (const line of range.getClientRects()) if (line.width > .5 && line.height > .5 && x >= line.left - .5 && x <= line.right + .5) error = Math.min(error, Math.abs(feet.bottom - line.top + 3));
      range.detach();
    }
    return error;
  }, textSurfaces)).toBeLessThan(1.5);
}

async function enableNativeScroll(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.overflowY = "auto"; document.documentElement.style.scrollBehavior = "auto";
    document.body.style.overflowY = "visible";
    const spacer = document.createElement("div"); spacer.setAttribute("aria-hidden", "true");
    spacer.style.cssText = "height:1600px;pointer-events:none"; document.body.append(spacer);
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(1000);
}

/** Real native scroll, followed by two actual rAF boundaries for delivery and
 * paint. This compares settled logical coordinates, not one-frame scroll lag. */
async function scrollSteps(page: Page, distance: number, home = false) {
  return page.evaluate(async ({ distance, home }) => {
    const node = document.querySelector<HTMLElement>(".vc-companion")!, anchor = document.querySelector(home ? ".vc-home-cushion" : "[data-direct-anchor]")!;
    const start = scrollY, frames: { y: number; anchorY: number; documentTop: number; width: number; lift: number; scaleY: number; hidden: boolean; platform: string }[] = [];
    for (let step = 1; step <= 10; step++) {
      scrollTo({ top: start + distance * step / 10, behavior: "instant" });
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const feet = node.getBoundingClientRect(), rect = anchor.getBoundingClientRect();
      const matrix = new DOMMatrixReadOnly(getComputedStyle(node.querySelector(".vc-reaction")!).transform);
      frames.push({ y: feet.bottom, anchorY: rect.top, documentTop: rect.top + scrollY, width: rect.width, lift: matrix.m42, scaleY: matrix.m22, hidden: node.hidden, platform: node.dataset.platform ?? "" });
    }
    return frames;
  }, { distance, home });
}

async function expectNeutral(page: Page) {
  await expect.poll(async () => { const current = await pose(page); return { lift: current.lift, scaleY: current.scaleY }; }, { timeout: 2500 }).toEqual({ lift: 0, scaleY: 1 });
}

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const mobile of [false]) test(`month change preserves the same viewport creature before a nearby landing (${mobile ? "agenda safe-gap recovery" : "desktop"})`, async ({ page }) => {
  await setup(page, { mobile });
  if (mobile) {
    // The native initial viewport has one genuine floor interval. Scrolling
    // 400px leaves no safe interval at this same x; PLAN-048 correctly waits
    // there instead of warping to another column. Start this month-specific
    // regression on the actual initial ledge, without manufacturing a surface.
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 6000 });
    await expect(actor(page)).toBeVisible(); await expectActualContact(page);
  } else await markTextSupport(page);
  const before = await pose(page);
  await record(page); const started = await page.evaluate(() => performance.now());
  await page.locator('[data-act="다음 달"]').click();
  if (mobile) {
    // At390x844 this fixture's empty July has zero safe ledges: folded empty
    // ranges, text, fixed controls and the launcher cover them all. Hiding is
    // correct. Return through the real month control to populated June; this
    // does not claim mobile visible-to-visible month coverage.
    await expect(page.locator("h1.agenda-title")).toContainText("2026년 07월");
    await expect(pet(page)).toBeHidden(); await expect(pet(page)).toHaveAttribute("data-platform", "");
    await page.waitForTimeout(300); await expect(pet(page)).toBeHidden();
    const returning = await page.evaluate(() => performance.now());
    await page.locator('[data-act="이전 달"]').click();
    await expect(page.locator("h1.agenda-title")).toContainText("2026년 06월");
    await expect(actor(page)).toBeVisible();
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 6000 });
    await expectActualContact(page);
    const { frames, sameNode } = await stopRecord(page);
    expect(sameNode).toBe(true);
    const initial = frames.filter(frame => !frame.hidden && frame.state === "jump" && frame.at >= returning && frame.at - returning < 300);
    expect(initial.length).toBeGreaterThan(2);
    expect(Math.max(...initial.map(frame => Math.abs(frame.x - before.x)))).toBeLessThan(2);
    expect(Math.max(...initial.map(frame => Math.abs(frame.y - before.y)))).toBeLessThanOrEqual(26);
    const after = await pose(page);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(320);
    await expectNeutral(page); await expect(pet(page)).toHaveCount(1);
    return;
  }
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 6000 });
  await expect(actor(page)).toBeVisible(); await expectActualContact(page);
  const { frames, sameNode } = await stopRecord(page);
  expect(sameNode).toBe(true);
  const initial = frames.filter(frame => !frame.hidden && frame.state === "jump" && frame.at - started < 280);
  expect(initial.length).toBeGreaterThan(2);
  expect(Math.max(...initial.map(frame => Math.abs(frame.x - before.x)))).toBeLessThan(2);
  expect(Math.max(...initial.map(frame => Math.abs(frame.y - before.y)))).toBeLessThanOrEqual(16);
  const after = await pose(page);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(320);
  await expect(pet(page)).toHaveCount(1); await expectNeutral(page);
});

test("another month during the actual landing starts from its current airborne viewport position", async ({ page }) => {
  await setup(page); await markTextSupport(page);
  await page.locator('[data-act="다음 달"]').click();
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  await expect(pet(page)).toHaveAttribute("data-journey", /.+/); // after the initial grid wait
  const firstJourney = await pet(page).getAttribute("data-journey");
  await record(page);
  await page.evaluate(() => {
    const probe = window as Probe; probe.directRanges = 0;
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { probe.directRanges!++; return original.call(this); };
  });
  // A real window resize guarantees a fresh full geometry scan while support
  // is still absent. Initial spawning must not snap this active month flight.
  await page.setViewportSize({ width: 1918, height: 1100 });
  await expect.poll(() => page.evaluate(() => (window as Probe).directRanges)).toBeGreaterThan(0);
  await expect(pet(page)).toHaveAttribute("data-journey", firstJourney!);
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  // A fast resize/scan can finish within two actual display frames. Observe
  // the required native frames before stopping, retaining the original
  // frame-count, journey and speed assertions instead of loosening them.
  await expect.poll(() => page.evaluate(() => ((window as Probe).directFrames ?? []).filter(frame => !frame.hidden).length), { intervals: [16], timeout: 500 }).toBeGreaterThan(2);
  const resized = await stopRecord(page);
  expect(resized.sameNode).toBe(true);
  const visible = resized.frames.filter(frame => !frame.hidden);
  expect(visible.length).toBeGreaterThan(2);
  for (let index = 1; index < visible.length; index++) {
    const previous = visible[index - 1], current = visible[index], elapsed = current.at - previous.at;
    if (elapsed > 0) expect(Math.hypot(current.x - previous.x, current.y - previous.y) / elapsed).toBeLessThan(2);
    expect(current.journey).toBe(firstJourney);
  }
  const airborne = await pose(page);
  await record(page); const started = await page.evaluate(() => performance.now());
  await page.locator('[data-act="이전 달"]').click();
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 6000 });
  const { frames, sameNode } = await stopRecord(page);
  expect(sameNode).toBe(true);
  const initial = frames.filter(frame => !frame.hidden && frame.state === "jump" && frame.at - started < 250);
  expect(initial.length).toBeGreaterThan(2);
  expect(Math.max(...initial.map(frame => Math.abs(frame.x - airborne.x)))).toBeLessThan(8);
  expect(Math.max(...initial.map(frame => Math.abs(frame.y - airborne.y)))).toBeLessThan(22);
  await expectActualContact(page); await expectNeutral(page); await expect(pet(page)).toHaveCount(1);
});

test("a house resident follows its real cushion through scrolling, another month and offscreen return", async ({ page }) => {
  await setup(page, { home: true }); await openCompanionHome(page);
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top))).toBeLessThan(1);
  await enableNativeScroll(page);
  const initialY = await page.locator(".vc-home-cushion").evaluate(node => node.getBoundingClientRect().top);
  const frames = await scrollSteps(page, 60, true);
  expect(initialY - frames.at(-1)!.anchorY).toBeGreaterThan(40); // a fixed unmoving house cannot falsely pass
  expect(frames.every(frame => !frame.hidden && frame.platform === "companion-home")).toBe(true);
  expect(Math.max(...frames.map(frame => Math.abs(frame.y - frame.anchorY)))).toBeLessThan(1);
  expect(frames.every(frame => frame.lift === 0 && frame.scaleY === 1)).toBe(true);
  await page.locator('[data-act="다음 달"]').click();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top))).toBeLessThan(1);
  await page.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
  await expect.poll(() => page.locator(".vc-home-cushion").evaluate(node => node.getBoundingClientRect().top)).toBeLessThan(84);
  await expect(pet(page)).toBeHidden(); await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  await page.waitForTimeout(250); await expect(pet(page)).toBeHidden();
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  await expect.poll(() => page.evaluate(() => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top))).toBeLessThan(1);
  await expectNeutral(page);
});

test("holding a house resident owns its viewport position during a real scroll geometry rescan", async ({ page }) => {
  await setup(page, { home: true }); await openCompanionHome(page);
  await page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  await enableNativeScroll(page);
  await actor(page).focus(); await actor(page).press("Space"); await actor(page).press("ArrowUp");
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  const held = await pose(page);
  await page.evaluate(() => {
    const probe = window as Probe; probe.directRanges = 0;
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { probe.directRanges!++; return original.call(this); };
    scrollTo({ top: 60, behavior: "instant" });
  });
  await expect.poll(() => page.evaluate(() => (window as Probe).directRanges)).toBeGreaterThan(0);
  await page.waitForTimeout(180); // include the completed full scan, not only the cheap anchor follow
  const after = await pose(page);
  expect(after.hidden).toBe(false);
  expect(Math.abs(after.x - held.x)).toBeLessThan(.02); expect(Math.abs(after.y - held.y)).toBeLessThan(.02);
  await expect(pet(page)).toHaveAttribute("data-state", "held"); await expect(actor(page)).toBeFocused();
  await actor(page).press("Space");
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 6000 });
});

test("both scroll directions affect only the reaction wrapper while logical feet and text stay registered", async ({ page }) => {
  await setup(page); const support = await markTextSupport(page); await enableNativeScroll(page);
  const down = await scrollSteps(page, 60);
  expect(down.every(frame => !frame.hidden)).toBe(true);
  expect(Math.max(...down.map(frame => Math.abs(frame.y - frame.anchorY - support.offset)))).toBeLessThan(.02);
  expect(Math.min(...down.map(frame => frame.lift))).toBeLessThan(-.1);
  expect(down.every(frame => frame.scaleY === 1)).toBe(true);
  await expectNeutral(page);
  const up = await scrollSteps(page, -60);
  expect(up.every(frame => !frame.hidden)).toBe(true);
  expect(Math.max(...up.map(frame => Math.abs(frame.y - frame.anchorY - support.offset)))).toBeLessThan(.02);
  expect(Math.min(...up.map(frame => frame.scaleY))).toBeLessThan(.999);
  for (const frame of [...down, ...up]) {
    expect(Math.abs(frame.documentTop - support.documentTop)).toBeLessThan(.02);
    expect(Math.abs(frame.width - support.width)).toBeLessThan(.02);
  }
  await expectNeutral(page);
  await expect(page.locator("[data-export-surface]")).toHaveJSProperty("offsetWidth", 1840);
});

test("parked scrolling completes its neutral frame and returns to zero autonomous geometry and DOM writes", async ({ page }) => {
  await setup(page); const support = await markTextSupport(page); await enableNativeScroll(page);
  await page.evaluate(() => {
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false }); window.dispatchEvent(new FocusEvent("blur"));
  });
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
  const frames = await scrollSteps(page, 60);
  expect(Math.min(...frames.map(frame => frame.lift))).toBeLessThan(-.1);
  expect(Math.max(...frames.map(frame => Math.abs(frame.y - frame.anchorY - support.offset)))).toBeLessThan(.02);
  await expectNeutral(page); await page.waitForTimeout(350);
  await expect(pet(page)).toHaveAttribute("data-presence", "parked");
  await page.evaluate(() => {
    const probe = window as Probe; probe.directRanges = 0; probe.directWrites = 0;
    const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { probe.directRanges!++; return original.call(this); };
    new MutationObserver(records => { probe.directWrites! += records.length; }).observe(document.querySelector(".vc-companion")!, { subtree: true, attributes: true });
  });
  const care = await page.evaluate(() => localStorage.getItem("vic.viewerCompanionCare"));
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => ({ ranges: (window as Probe).directRanges, writes: (window as Probe).directWrites, focus: document.hasFocus() }))).toEqual({ ranges: 0, writes: 0, focus: false });
  expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanionCare"))).toBe(care);
});

test("reduced motion retains actual scroll contact without the decorative response", async ({ page }) => {
  await setup(page, { reduced: true }); const support = await markTextSupport(page); await enableNativeScroll(page);
  const frames = await scrollSteps(page, 60);
  expect(frames.every(frame => !frame.hidden && frame.lift === 0 && frame.scaleY === 1)).toBe(true);
  expect(Math.max(...frames.map(frame => Math.abs(frame.y - frame.anchorY - support.offset)))).toBeLessThan(.02);
});

test("a7px drag starts immediately and losing native capture cancels the hold without petting", async ({ page }) => {
  await setup(page);
  let previous: { x: number; y: number; support: string } | undefined, stable = 0;
  await expect.poll(async () => {
    const current = await pet(page).evaluate(node => { const el = node as HTMLElement, matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: matrix.m41 + 46, y: matrix.m42 + 92, support: el.dataset.platform ?? "", stationary: !el.hidden && !["jump", "held"].includes(el.dataset.state ?? "") }; });
    stable = current.stationary && current.support && previous?.support === current.support && Math.hypot(current.x - previous.x, current.y - previous.y) < .05 ? stable + 1 : 0;
    previous = current; return stable;
  }, { intervals: [80], timeout: 5000 }).toBeGreaterThanOrEqual(2);
  await actor(page).evaluate(node => {
    let started = 0, initialX = 0, worldX = 0, observing = false;
    node.addEventListener("pointerdown", event => { const probe = window as Probe; probe.directPointer = (event as PointerEvent).pointerId; probe.directDragFrames = []; started = performance.now(); initialX = (event as PointerEvent).clientX; worldX = new DOMMatrixReadOnly(getComputedStyle(document.querySelector(".vc-companion")!).transform).m41 + 46; }, { once: true });
    // The first displayed held frame must still beat the old360ms hold. Read
    // actual display frames, not an obsolete same-pointer-event DOM repaint.
    node.addEventListener("pointermove", event => {
      if (!started || observing || Math.abs((event as PointerEvent).clientX - initialX) <= 6) return;
      observing = true;
      const sample = (now: number) => {
        const body = document.querySelector<HTMLElement>(".vc-companion")!, probe = window as Probe;
        const frame: DragFrame = { state: body.dataset.state ?? "", elapsed: now - started, captured: node.hasPointerCapture(probe.directPointer!), deltaX: new DOMMatrixReadOnly(getComputedStyle(body).transform).m41 + 46 - worldX };
        probe.directDragFrames!.push(frame);
        if (frame.state === "held" || frame.elapsed >= 300 || !frame.captured) probe.directDrag = frame;
        else requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
  });
  const box = (await actor(page).boundingBox())!, x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 7, y);
  await expect.poll(() => page.evaluate(() => (window as Probe).directDrag)).toBeTruthy();
  const immediate = (await page.evaluate(() => (window as Probe).directDrag))!;
  console.log(JSON.stringify({ check: "native-seven-pixel-first-display", firstHeld: immediate, frames: await page.evaluate(() => (window as Probe).directDragFrames) }));
  expect(immediate.state).toBe("held"); expect(immediate.elapsed).toBeLessThan(300);
  expect(immediate.captured).toBe(true); expect(immediate.deltaX).toBeGreaterThan(6);
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  await actor(page).evaluate(node => { const pointer = (window as Probe).directPointer!; if (node.hasPointerCapture(pointer)) node.releasePointerCapture(pointer); });
  await page.mouse.move(x + 30, y + 30); await page.mouse.up();
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect(pet(page)).not.toHaveAttribute("data-state", "petted");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 6000 });
  // PLAN-068 assigns short clicks to bonking. Enter remains the native
  // friendly interaction and must work immediately after a cancelled lift.
  await actor(page).focus(); await actor(page).press("Enter"); await expect(pet(page)).toHaveAttribute("data-state", "petted");
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { safeCompanionSurfaces, type CompanionTextRect } from "@/lib/ui/viewer-companion/geometry";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { CAL_ZOOM_STEPS } from "@/lib/ui/calendar-zoom";
import { openCompanionHome } from "./helpers/companion-home";

type Point = { x: number; y: number };
type Frame = Point & { at: number; phase: string; falling: boolean; hidden: boolean; scroll: number };
type Probe = { frames: Frame[]; raf: number; phase: string; stopped: boolean };
type ProbeWindow = Window & { foodFallbackProbe?: Probe; foodFallbackNode?: Element };
type Surface = "viewer" | "studio";
const posts = new WeakMap<Page, string[]>(), errors = new WeakMap<Page, string[]>();
const evidence = new WeakMap<Page, Record<string, unknown>>();
const foods = (page: Page) => page.locator(".vc-food");
const calendar = (page: Page, surface: Surface) => page.locator(surface === "viewer" ? ".public-calendar-area" : ".studio-calendar-panel");
const prefix = process.env.COMPANION_FOOD_FALLBACK_ARTIFACT_PREFIX ?? "companion-068-food-fallback";

async function sourceSnapshot(page: Page) {
  return page.evaluate(() => {
    const house = document.querySelector(".vc-home"), tray = document.querySelector(".vc-dispenser-slot"), food = document.querySelector<HTMLElement>(".vc-food");
    const bounds = (node: Element | null) => { if (!node) return null; const rect = node.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; };
    const houseRect = bounds(house), trayRect = bounds(tray), foodRect = bounds(food);
    const fits = (rect: ReturnType<typeof bounds>) => Boolean(rect && rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight);
    const matrix = food ? new DOMMatrixReadOnly(food.style.transform) : null;
    return { viewport: { width: innerWidth, height: innerHeight }, scroll: scrollY, house: houseRect, tray: trayRect, food: foodRect, foodHidden: food?.hidden ?? null,
      foodTransformFoot: matrix ? { x: matrix.m41, y: matrix.m42 } : null, houseFits: fits(houseRect), trayFits: fits(trayRect), foodFits: Boolean(food && !food.hidden && fits(foodRect)) };
  });
}

test.use({ viewport: { width: 1920, height: 1000 } });
test.beforeEach(async ({ page, context }) => {
  const blocked: string[] = [], pageErrors: string[] = []; posts.set(page, blocked); errors.set(page, pageErrors);
  page.on("pageerror", error => pageErrors.push(error.message));
  await context.route("**/*", route => route.request().method() === "POST" ? (blocked.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }, info) => {
  const witness = await page.evaluate(() => {
    const probe = (window as ProbeWindow).foodFallbackProbe;
    if (probe) { probe.stopped = true; cancelAnimationFrame(probe.raf); }
    const floorBars = [...document.querySelectorAll(".agenda-monthbar")].map(node => { const rect = node.getBoundingClientRect(); return { position: getComputedStyle(node).position, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }; });
    return { frames: probe?.frames ?? [], floorBars, viewport: { width: innerWidth, height: innerHeight }, scroll: scrollY };
  }).catch(error => ({ unavailable: String(error) }));
  const surface = info.title.startsWith("viewer ") ? "viewer" : "studio", source = await sourceSnapshot(page).catch(() => null);
  const raw = JSON.stringify({ title: info.title, status: info.status, ...evidence.get(page), source, posts: posts.get(page), errors: errors.get(page), witness }, null, 2);
  await writeFile(`.scratch-pw/${prefix}-${surface}-witness.json`, raw);
  if (info.status !== info.expectedStatus) {
    await writeFile(`.scratch-pw/${prefix}-${surface}-failure-witness.json`, raw);
    await info.attach("food-fallback-failure-witness", { body: raw, contentType: "application/json" });
  }
  expect(posts.get(page)).toEqual([]); expect(errors.get(page)).toEqual([]);
});

async function setup(page: Page, surface: Surface) {
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic_avatar_side", "left");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true }); Math.random = () => 0;
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, heartPrank: false, ambientPrank: false, feeding: true }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-companion")).toHaveCount(1); await expect(page.locator(".vc-companion")).toHaveAttribute("data-atlas", "hd");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await page.waitForTimeout(180);
  await openCompanionHome(page);
  if (surface === "viewer") {
    // The food retains its real dispenser origin. Keep that source reachable
    // while the later physical viewport search exposes a lower calendar row.
    // Folding the actual panels is the public user action, not a layout patch.
    const before = await sourceSnapshot(page);
    for (const key of ["tag-filter", "season"]) {
      const toggle = page.locator(`[data-panel-section-toggle='${key}']:visible`);
      await expect(toggle).toHaveAttribute("aria-expanded", "true"); await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
    }
    await page.waitForTimeout(180);
    const after = await sourceSnapshot(page);
    await writeFile(`.scratch-pw/${prefix}-${surface}-setup-panels.json`, JSON.stringify({ before, after }, null, 2));
    expect(after.houseFits).toBe(true); expect(after.trayFits).toBe(true);
  }
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  await expect(foods(page)).toHaveCount(1); await expect(foods(page)).not.toHaveAttribute("data-selected");
  // Use the app's real enlargement control. No synthetic HTML, scroll spacer,
  // timer jump or invented platform is needed to expose a partial calendar row.
  const box = (await calendar(page, surface).boundingBox())!;
  const initialZoom = await calendar(page, surface).evaluate(node => parseFloat(getComputedStyle(node).getPropertyValue("--cal-zoom")));
  await page.mouse.move(box.x + box.width * .5, box.y + 14); await page.keyboard.down("Control");
  // Shared wheel gestures have a220ms cooldown. Distinct250ms wheel notches
  // exercise every allowed step instead of testing discarded inertia input.
  try { for (let step = 1; step < CAL_ZOOM_STEPS.length; step++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(250); } }
  finally { await page.keyboard.up("Control"); }
  // Studio can multiply its calendar zoom by the existing panel-fit ratio;
  // compare with the stable initial ratio rather than overriding that layout.
  await expect.poll(() => calendar(page, surface).evaluate(node => parseFloat(getComputedStyle(node).getPropertyValue("--cal-zoom")))).toBeCloseTo(initialZoom * CAL_ZOOM_STEPS.at(-1)! / CAL_ZOOM_STEPS[0], 3);
  await page.waitForTimeout(180);
}

/** A one-shot, read-only physical oracle. Food32 lands on card tops, the
 * house floor or the protected screen floor. Date/title ink is an obstacle,
 * never a new food support. Only rects are collected, no text or React state. */
async function findUnsupportedRelease(page: Page, surface: Surface) {
  const sourceTopologies: Awaited<ReturnType<typeof sourceSnapshot>>[] = [];
  for (const height of [1000, 900, 800, 1100]) {
    if (page.viewportSize()!.height !== height) { await page.setViewportSize({ width: 1920, height }); await page.waitForTimeout(180); }
    const source = await sourceSnapshot(page); sourceTopologies.push(source);
    await writeFile(`.scratch-pw/${prefix}-${surface}-setup-source.json`, JSON.stringify(sourceTopologies, null, 2));
    expect(source.houseFits, "The real house must stay inside every candidate viewport").toBe(true);
    expect(source.trayFits, "The real dispenser origin must stay reachable").toBe(true);
    expect(source.foodFits, "The attached native food must be visible before any deliberate release").toBe(true);
    const measured = await calendar(page, surface).evaluate(element => {
      const cardSelector = ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid],[data-companion-event='ordinary'][data-eventid]";
      const root = element.closest<HTMLElement>("main")!, viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      const visible = (node: Element | null): boolean => {
        for (let cursor = node; cursor; cursor = cursor.parentElement) {
          const style = getComputedStyle(cursor);
          if (cursor.matches("[hidden],[inert],[data-panel-collapsed]") || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity || 1) <= .05) return false;
        }
        return true;
      };
      const clip = (node: Element | null) => {
        const bounds = { ...viewport };
        for (let cursor = node; cursor; cursor = cursor.parentElement) {
          const style = getComputedStyle(cursor), rect = cursor.getBoundingClientRect();
          if (/^(hidden|clip|scroll|auto)$/.test(style.overflowX)) { bounds.left = Math.max(bounds.left, rect.left); bounds.right = Math.min(bounds.right, rect.right); }
          if (/^(hidden|clip|scroll|auto)$/.test(style.overflowY)) { bounds.top = Math.max(bounds.top, rect.top); bounds.bottom = Math.min(bounds.bottom, rect.bottom); }
        }
        return bounds;
      };
      const obstacles: CompanionTextRect[] = [], range = document.createRange(), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || !visible(parent) || parent.closest("script,style,svg,.sr-only,.vc-companion,.vc-food-layer")) continue;
        const bounds = clip(parent); range.selectNodeContents(node);
        for (const rect of range.getClientRects()) {
          const part = { left: Math.max(rect.left, bounds.left), right: Math.min(rect.right, bounds.right), top: Math.max(rect.top, bounds.top), bottom: Math.min(rect.bottom, bounds.bottom) };
          if (part.right - part.left > .5 && part.bottom - part.top > .5) obstacles.push(part);
        }
      }
      range.detach();
      const controls: CompanionTextRect[] = [];
      for (const node of root.querySelectorAll("button,a[href],input,select,textarea,[role='button']")) {
        if (!visible(node) || node.matches(`${cardSelector},.public-day,.agenda-day,.studio-day`) || node.closest(".vc-companion,.vc-food-layer,.vc-cushion-button")) continue;
        const rect = node.getBoundingClientRect(), bounds = clip(node.parentElement);
        const part = { left: Math.max(rect.left, bounds.left), right: Math.min(rect.right, bounds.right), top: Math.max(rect.top, bounds.top), bottom: Math.min(rect.bottom, bounds.bottom) };
        if (part.right > part.left && part.bottom > part.top) controls.push(part);
      }
      const house = document.querySelector(".vc-home"), houseRect = house && visible(house) ? house.getBoundingClientRect() : undefined;
      if (houseRect) obstacles.push({ left: houseRect.left, top: houseRect.top, right: houseRect.right, bottom: houseRect.bottom });
      const cards = [...root.querySelectorAll(cardSelector)].filter(visible).map(node => {
        const rect = node.getBoundingClientRect(), bounds = clip(node.parentElement);
        return { left: Math.max(rect.left, bounds.left), right: Math.min(rect.right, bounds.right), y: rect.top - 3, valid: rect.top >= bounds.top && rect.top < bounds.bottom && rect.width > 0 && rect.height > 0 };
      }).filter(rect => rect.valid && rect.right > rect.left);
      let floorY = innerHeight - 18;
      const floorBars = [...root.querySelectorAll(".agenda-monthbar")].map(node => {
        const rect = node.getBoundingClientRect(), position = getComputedStyle(node).position;
        const applied = visible(node) && position === "fixed" && rect.width > 0 && rect.height > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1;
        if (applied) floorY = Math.min(floorY, rect.top - 8);
        return { position, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, applied };
      });
      const rect = element.getBoundingClientRect();
      return { viewport: { width: innerWidth, height: innerHeight }, floorY, floorBars, calendar: { left: Math.max(28, rect.left + 28), right: Math.min(innerWidth - 28, rect.right - 28) }, obstacles: [...obstacles, ...controls], controls, cards, scroll: scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight };
    });
    const floor = safeCompanionSurfaces({ x: 12, y: measured.floorY, width: measured.viewport.width - 24 }, measured.obstacles, 32, measured.viewport, { width: 44, height: 38 });
    for (const obstacle of measured.obstacles) {
      if (obstacle.top >= measured.floorY + 3 || obstacle.bottom <= measured.floorY - 41) continue;
      for (const fraction of [.5, .25, .75]) {
        const x = Math.max(measured.calendar.left, Math.min(measured.calendar.right, obstacle.left + (obstacle.right - obstacle.left) * fraction));
        const floorDistance = floor.length ? Math.min(...floor.map(span => Math.max(span.x - x, x - span.x - span.width, 0))) : Infinity;
        if (floorDistance <= 24) continue;
        const cards = measured.cards.filter(rect => x >= rect.left - 22 && x <= rect.right + 22);
        const y = Math.max(120, measured.floorY - 110, ...cards.map(rect => rect.y + 4));
        if (measured.floorY - y < 45 || measured.maxScroll < 100) continue;
        if (measured.controls.some(rect => rect.left < x + 22 && rect.right > x - 22 && rect.top < y + 6 && rect.bottom > y - 38)) continue;
        return { release: { x, y }, ...measured, floor, floorDistance, sourceTopologies };
      }
    }
  }
  throw Error("The actual enlarged fixture must expose a blank lower card ray whose screen-floor x is protected by visible ink/control bounds");
}

const foodPoint = (item: Locator) => item.evaluate(node => { const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.bottom - 6 }; });
async function dragToFeet(page: Page, item: Locator, target: Point) {
  const box = (await item.boundingBox())!, foot = await foodPoint(item), from = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(target.x + from.x - foot.x, target.y + from.y - foot.y, { steps: 12 }); await page.mouse.up();
}
async function record(page: Page, item: Locator) {
  await item.evaluate(node => {
    const probe: Probe = { frames: [], raf: 0, phase: "release", stopped: false }, win = window as ProbeWindow;
    win.foodFallbackProbe = probe; win.foodFallbackNode = node;
    const sample = (at: number) => {
      if (probe.stopped) return;
      const rect = node.getBoundingClientRect();
      probe.frames.push({ at, phase: probe.phase, x: rect.left + rect.width / 2, y: rect.bottom - 6, falling: node.hasAttribute("data-falling"), hidden: (node as HTMLElement).hidden, scroll: scrollY });
      probe.raf = requestAnimationFrame(sample);
    };
    probe.raf = requestAnimationFrame(sample);
  });
}

for (const surface of ["viewer", "studio"] as const) {
  test(`${surface} unsupported snack falls visibly, resumes after a stationary catch and retains its document position`, async ({ page }) => {
    test.setTimeout(35000); await setup(page, surface);
    const target = await findUnsupportedRelease(page, surface), item = foods(page);
    evidence.set(page, { surface, target });
    await expect(item).toBeInViewport(); await record(page, item); await dragToFeet(page, item, target.release);
    await expect(item).toHaveAttribute("data-falling", ""); await expect(item).not.toHaveAttribute("data-eating");
    await page.waitForTimeout(65);
    const box = (await item.boundingBox())!; await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await expect(item).not.toHaveAttribute("data-falling"); const caught = await foodPoint(item);
    Object.assign(evidence.get(page)!, { caught });
    await page.evaluate(() => { (window as ProbeWindow).foodFallbackProbe!.phase = "caught"; });
    await page.waitForTimeout(75); expect(Math.hypot((await foodPoint(item)).x - caught.x, (await foodPoint(item)).y - caught.y)).toBeLessThan(1);
    await page.mouse.up(); await expect(item).toHaveAttribute("data-falling", "");
    await page.evaluate(() => { (window as ProbeWindow).foodFallbackProbe!.phase = "resumed"; });
    await expect.poll(async () => (await foodPoint(item)).y - caught.y).toBeGreaterThan(2);
    await expect(item).not.toHaveAttribute("data-falling", { timeout: 1800 });
    const end = await foodPoint(item), beforeScroll = await page.evaluate(() => scrollY), documentPoint = { x: end.x, y: end.y + beforeScroll };
    Object.assign(evidence.get(page)!, { end, documentPoint });
    expect(end.y).toBeGreaterThan(target.release.y + 40);
    if (end.y <= target.viewport.height) {
      expect(Math.abs(end.y - target.floorY)).toBeLessThan(2);
      expect(target.obstacles.some(rect => rect.left < end.x + 22 && rect.right > end.x - 22 && rect.top < end.y + 3 && rect.bottom > end.y - 41)).toBe(false);
    } else { expect(end.y).toBeGreaterThanOrEqual(target.viewport.height + 43); await expect(item).toHaveJSProperty("hidden", true); }
    await expect(foods(page)).toHaveCount(1); await expect(item).not.toHaveAttribute("data-eating");
    await page.evaluate(() => { (window as ProbeWindow).foodFallbackProbe!.phase = "scroll"; });
    await page.mouse.move(target.release.x, Math.max(150, target.release.y - 80)); await page.mouse.wheel(0, 96);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(beforeScroll + 40);
    await expect.poll(async () => { const point = await foodPoint(item), scroll = await page.evaluate(() => scrollY); return Math.hypot(point.x - documentPoint.x, point.y + scroll - documentPoint.y); }).toBeLessThan(2);
    expect(await item.evaluate(node => node === (window as ProbeWindow).foodFallbackNode)).toBe(true);
    await page.waitForTimeout(180);
    const writes = await page.locator(".vc-food-layer").evaluate(node => new Promise<number>(resolve => { let count = 0; const observer = new MutationObserver(records => { count += records.length; }); observer.observe(node, { attributes: true, subtree: true }); setTimeout(() => { observer.disconnect(); resolve(count); }, 350); }));
    expect(writes).toBe(0);
    const frames = await page.evaluate(() => { const probe = (window as ProbeWindow).foodFallbackProbe!; probe.stopped = true; cancelAnimationFrame(probe.raf); return probe.frames; });
    const airborne = frames.filter(frame => frame.falling && frame.y > target.release.y + .2 && frame.y < end.y - 6);
    expect(airborne.length).toBeGreaterThan(4); expect(airborne.some(frame => frame.phase === "resumed")).toBe(true);
    expect(airborne.filter(frame => frame.y < target.viewport.height - 6).every(frame => !frame.hidden)).toBe(true);
    await writeFile(`.scratch-pw/${prefix}-${surface}.json`, JSON.stringify({ surface, target, caught, end, documentPoint, writes, posts: posts.get(page), errors: errors.get(page), frames }, null, 2));
    await page.screenshot({ path: `.scratch-pw/${prefix}-${surface}.png` });
    await expect(page.locator("[data-export-surface] .vc-food")).toHaveCount(0);
    if (surface === "viewer") expect(await page.locator("[data-export-surface]").evaluate(node => (node as HTMLElement).offsetWidth)).toBe(1840);
    console.log(JSON.stringify({ check: "unsupported-food-actual-fall", surface, release: target.release, floorDistance: target.floorDistance, protectedFloorSpans: target.floor.length, airborne: airborne.length, caught, end, writes, posts: posts.get(page)?.length, errors: errors.get(page)?.length }));
  });
}

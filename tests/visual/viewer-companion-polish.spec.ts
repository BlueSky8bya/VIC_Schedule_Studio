import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { PANEL_SECTION_PREFERENCES_KEY } from "@/lib/ui/panel-section-preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const food = (page: Page) => page.locator(".vc-food");
const textSurfaces = ".public-day .day-strip > strong,.public-event .event-main p,.public-event .event-subs li,.agenda-day .agenda-when > strong,.agenda-item .agenda-title-text,.agenda-item .agenda-subs li";
const posts = new WeakMap<Page, string[]>();
type Frame = { at: number; x: number; y: number; falling: boolean };
type Probe = Window & { polishFrames?: Frame[]; polishRaf?: number; polishRanges?: number; polishWrites?: number; polishObserver?: MutationObserver; polishRangeOriginal?: typeof Range.prototype.getClientRects };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, options: { size?: "normal" | "large"; dark?: boolean; reduced?: boolean; gfx?: "max" | "off" } = {}) {
  await page.addInitScript(({ epoch, epochKey, preferences, care, panelKey, options }) => {
    // Once per tab: subsequent full navigations must exercise saved choices,
    // rather than an init script silently resetting the disclosure under test.
    if (!sessionStorage.getItem("vic.polish-seeded")) {
      sessionStorage.setItem("vic.polish-seeded", "1");
      localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.reduceMotion", options.reduced ? "on" : "off");
      localStorage.setItem("vic.dark", options.dark ? "on" : "off"); localStorage.setItem("vic.gfxPref", options.gfx ?? "max");
      localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
      localStorage.removeItem(panelKey); localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
    }
    Math.random = () => 0;
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, heartPrank: false, ambientPrank: false, size: options.size ?? "normal" }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05 }, panelKey: PANEL_SECTION_PREFERENCES_KEY, options });
  await page.goto("/visual-fixture/poster?avatar=1"); await page.bringToFront();
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await page.waitForTimeout(180); // one final real geometry delivery after entry
  await expect(pet(page)).toHaveCount(1);
}

async function spawn(page: Page) {
  await openCompanionHome(page);
  const count = await food(page).count();
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  await expect(food(page)).toHaveCount(count + 1);
  const item = food(page).last(); await expect(item).not.toHaveAttribute("data-selected");
  return item;
}
const foodPoint = (item: Locator) => item.evaluate(node => { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: m.m41, y: m.m42 }; });
async function dragFoodToFeet(page: Page, item: Locator, target: { x: number; y: number }) {
  const r = (await item.boundingBox())!, foot = await foodPoint(item), from = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(target.x + from.x - foot.x, target.y + from.y - foot.y, { steps: 8 }); await page.mouse.up();
}
async function world(page: Page) {
  return pet(page).evaluate(node => { const m = new DOMMatrixReadOnly((node as HTMLElement).style.transform), size = parseFloat((node as HTMLElement).style.getPropertyValue("--vc-size")); return { x: m.m41 + size / 2, y: m.m42 + size, size }; });
}
async function roomyRelease(page: Page) {
  return page.evaluate(selector => {
    const lines = [...document.querySelectorAll(selector)].flatMap(node => { const range = document.createRange(); range.selectNodeContents(node); const rects = [...range.getClientRects()].filter(rect => rect.width > .5 && rect.height > .5); range.detach(); return rects; });
    const candidates = [innerWidth - 60, innerWidth - 100, innerWidth / 2, 60, 180];
    const values = candidates.map(x => ({ x, y: 80, gap: Math.min(innerHeight - 18, ...lines.filter(rect => x >= rect.left && x <= rect.right && rect.top >= 80).map(rect => rect.top - 3)) - 80 }));
    return values.sort((a, b) => b.gap - a.gap)[0];
  }, textSurfaces);
}
async function renderedSupport(page: Page, point: { x: number; y: number }, mark = false) {
  return page.evaluate(({ selector, point, mark }) => {
    if (mark) document.querySelectorAll("[data-polish-food-anchor]").forEach(node => node.removeAttribute("data-polish-food-anchor"));
    let floor = innerHeight - 18;
    for (const node of document.querySelectorAll(".agenda-monthbar")) { const r = node.getBoundingClientRect(); if (getComputedStyle(node).position === "fixed" && r.width > 0 && r.top > innerHeight * .65 && r.bottom <= innerHeight + 1) floor = Math.min(floor, r.top - 8); }
    if (Math.abs(point.y - floor) < 2) return { kind: "floor", error: Math.abs(point.y - floor), offset: { x: point.x, y: point.y } };
    for (const node of document.querySelectorAll<HTMLElement>(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]")) {
      const r = node.getBoundingClientRect();
      if (r.width > .5 && point.x >= r.left - 1 && point.x <= r.right + 1 && Math.abs(point.y - r.top + 3) < 2) {
        if (mark) node.dataset.polishFoodAnchor = "";
        return { kind: "card", error: Math.abs(point.y - r.top + 3), offset: { x: point.x - r.left, y: point.y - r.top } };
      }
    }
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      const range = document.createRange(); range.selectNodeContents(node);
      for (const r of range.getClientRects()) if (r.width > .5 && point.x >= r.left - 1 && point.x <= r.right + 1 && Math.abs(point.y - r.top + 3) < 2) {
        if (mark) node.dataset.polishFoodAnchor = "";
        const anchor = node.getBoundingClientRect(); range.detach();
        return { kind: "text", error: Math.abs(point.y - r.top + 3), offset: { x: point.x - anchor.left, y: point.y - anchor.top } };
      }
      range.detach();
    }
    return null;
  }, { selector: textSurfaces, point, mark });
}
async function recordFall(page: Page, item: Locator) {
  const id = await item.getAttribute("data-food");
  await page.evaluate(id => {
    const probe = window as Probe; probe.polishFrames = [];
    const sample = (at: number) => {
      const node = document.querySelector<HTMLElement>(`[data-food="${id}"]`);
      if (node) { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); probe.polishFrames!.push({ at, x: m.m41, y: m.m42, falling: node.hasAttribute("data-falling") }); }
      probe.polishRaf = requestAnimationFrame(sample);
    }; probe.polishRaf = requestAnimationFrame(sample);
  }, id);
}
async function finishRecording(page: Page) {
  return page.evaluate(() => { const probe = window as Probe; cancelAnimationFrame(probe.polishRaf!); return probe.polishFrames!; });
}

test("released fruit accelerates to a real lower ledge, can be caught in flight and leaves no resting writes", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  const item = await spawn(page), release = await roomyRelease(page); expect(release.gap).toBeGreaterThan(200);
  await recordFall(page, item); await dragFoodToFeet(page, item, release);
  await expect(item).toHaveAttribute("data-falling", ""); await expect(item).not.toHaveAttribute("data-eating"); await page.waitForTimeout(1600);
  await expect(item).not.toHaveAttribute("data-falling"); await expect(item).not.toHaveAttribute("data-eating");
  const end = await foodPoint(item), frames = await finishRecording(page);
  const airborne = frames.filter(frame => frame.falling && frame.y > release.y + .2 && frame.y < end.y - 6);
  expect(airborne.length).toBeGreaterThan(5); expect(end.y).toBeGreaterThan(release.y + 40);
  const first = airborne[0], middle = airborne[Math.floor(airborne.length / 2)], last = airborne.at(-1)!;
  const early = (middle.y - first.y) / (middle.at - first.at), late = (last.y - middle.y) / (last.at - middle.at);
  expect(late).toBeGreaterThan(early * 1.3);
  expect(Math.max(...airborne.map(frame => Math.abs(frame.x - release.x)))).toBeLessThanOrEqual(22.1);
  expect(await renderedSupport(page, end)).not.toBeNull();
  console.log(JSON.stringify({ check: "food-gravity", frames: airborne.length, early, late, release, end }));
  await page.screenshot({ path: ".scratch-pw/companion-polish-gravity-landed.png" });
  await item.focus(); await item.press("Delete");
  const next = await spawn(page); await dragFoodToFeet(page, next, release); await page.waitForTimeout(70);
  await expect(next).toHaveAttribute("data-falling", "");
  const box = (await next.boundingBox())!, before = await foodPoint(next);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await expect(next).not.toHaveAttribute("data-falling");
  const caught = await foodPoint(next); expect(Math.hypot(caught.x - before.x, caught.y - before.y)).toBeLessThan(30);
  await page.mouse.up(); await next.focus(); await next.press("Delete"); await expect(food(page)).toHaveCount(0);
  await page.waitForTimeout(50);
  const writes = await page.locator(".vc-food-layer").evaluate(node => new Promise<number>(resolve => { let count = 0; const observer = new MutationObserver(records => { count += records.length; }); observer.observe(node, { subtree: true, attributes: true }); setTimeout(() => { observer.disconnect(); resolve(count); }, 350); }));
  expect(writes).toBe(0); await expect(page.locator("[data-export-surface] .vc-food")).toHaveCount(0);
  expect(await page.locator("[data-export-surface]").evaluate(node => (node as HTMLElement).offsetWidth)).toBe(1840);
});

test("fruit retains its real text attachment through scroll, interrupts for settings and respects reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", /^(?:card|date)-/);
  const point = await world(page); expect(await renderedSupport(page, point, true)).not.toBeNull();
  const anchor = page.locator("[data-polish-food-anchor]"); await expect(anchor).toHaveCount(1);
  const item = await spawn(page);
  const drop = await page.locator(".public-event[data-eventid]").evaluateAll(nodes => {
    const cards = nodes.map(node => node.getBoundingClientRect()).filter(r => r.width > 90 && r.top > 200 && r.top < innerHeight - 120);
    const r = cards[0]; if (!r) throw Error("A real lower card is required for this attachment regression");
    return { x: r.left + r.width / 2, y: r.top - 30 };
  });
  await dragFoodToFeet(page, item, drop);
  await expect(item).not.toHaveAttribute("data-selected"); await expect(item).not.toHaveAttribute("data-falling", { timeout: 1800 });
  const landed = await foodPoint(item), source = await renderedSupport(page, landed, true);
  expect(source?.kind).toBe("card");
  await page.evaluate(() => { document.documentElement.style.overflowY = "auto"; document.documentElement.style.scrollBehavior = "auto"; document.body.style.overflowY = "visible"; const spacer = document.createElement("div"); spacer.style.cssText = "height:1200px;pointer-events:none"; spacer.setAttribute("aria-hidden", "true"); document.body.append(spacer); scrollTo({ top: 64, behavior: "instant" }); });
  await expect.poll(async () => { const current = await foodPoint(item), rect = (await anchor.boundingBox())!; return Math.hypot(current.x - rect.x - source!.offset.x, current.y - rect.y - source!.offset.y); }).toBeLessThan(2);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  // Native grabbing must wait for the same retained food attachment to return
  // from the preceding scroll; a global placement click never needed to hit
  // the fruit and concealed this stale-screen-position setup race.
  await expect.poll(async () => { const current = await foodPoint(item), rect = (await anchor.boundingBox())!; return Math.hypot(current.x - rect.x - source!.offset.x, current.y - rect.y - source!.offset.y); }).toBeLessThan(2);
  const release = await roomyRelease(page);
  await dragFoodToFeet(page, item, release); await expect(item).toHaveAttribute("data-falling", "");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.locator(".vc-food-layer")).toBeHidden(); await expect(item).not.toHaveAttribute("data-falling");
  const settings = page.getByRole("dialog", { name: "설정", exact: true });
  await settings.getByRole("tablist", { name: "설정 묶음", exact: true }).getByRole("tab", { name: "움직임", exact: true }).click();
  await settings.getByRole("switch", { name: "생동감 있는 동작 켜기/끄기", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");
  await settings.locator("[data-act=close-settings]").click(); await expect(item).toBeVisible(); await expect(item).not.toHaveAttribute("data-falling");
  await item.focus(); await item.press("Delete");
  const still = await spawn(page); await dragFoodToFeet(page, still, release);
  await expect(still).not.toHaveAttribute("data-selected"); await expect(still).not.toHaveAttribute("data-falling");
  expect(await renderedSupport(page, await foodPoint(still))).not.toBeNull();
  const settled = await foodPoint(still); await page.waitForTimeout(450); expect(await foodPoint(still)).toEqual(settled);
});

test("large native keyposes and first-pass contact stay fluid, reward only real strokes and park without geometry work", async ({ page }) => {
  test.setTimeout(35_000); await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, { size: "large" });
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-size", "large");
  await expect(pet(page)).toHaveAttribute("data-quality", "sharp", { timeout: 10000 }); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  const sprite = page.locator(".vc-sprite"); await expect(sprite).toHaveCSS("image-rendering", "auto");
  const texture = sprite.locator(".vc-texture");
  expect(await texture.evaluate(node => (node as HTMLImageElement).currentSrc || (node as HTMLImageElement).src)).toContain("/hd/");
  const intrinsic = await texture.evaluate(async node => { const image = node as HTMLImageElement; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; });
  expect(intrinsic).toEqual({ width: 1536, height: 384 });
  const focus = page.locator('[data-panel-section-toggle="tag-filter"]'); await focus.focus();
  const before = await world(page), y = before.y - before.size * .49, left = before.x - before.size * .22, right = before.x + before.size * .22;
  const bond = page.getByRole("meter", { name: "빅타민 친밀도", exact: true }), initial = await bond.evaluate(node => (node as HTMLMeterElement).value);
  await page.mouse.move(left, y); await page.mouse.move(right, y, { steps: 6 });
  await expect(pet(page)).toHaveAttribute("data-petting", "touch"); await expect(pet(page)).toHaveAttribute("data-petting", /^(ready|touch|hover)$/); await expect(page.locator(".vc-petting-hand")).toHaveCount(0);
  await expect.poll(() => page.locator(".vc-contact").evaluate(node => { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return Math.abs(m.m42) + Math.abs(m.b); })).toBeGreaterThan(.01);
  expect(await bond.evaluate(node => (node as HTMLMeterElement).value)).toBeLessThanOrEqual(initial + .001);
  await expect(focus).toBeFocused();
  await page.mouse.move(left, y, { steps: 5 }); await page.mouse.move(right, y, { steps: 5 });
  await expect(pet(page)).toHaveAttribute("data-petting", "hover"); await expect(pet(page)).toHaveAttribute("data-state", "petted");
  await expect.poll(() => bond.evaluate(node => (node as HTMLMeterElement).value)).toBeGreaterThan(initial + .07);
  await page.screenshot({ path: ".scratch-pw/companion-polish-contact-large.png" });
  await page.mouse.down(); await page.mouse.move(right + 8, y);
  await expect(pet(page)).toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-petting");
  await expect(pet(page)).toHaveAttribute("data-atlas", "hd"); expect(await texture.evaluate(node => (node as HTMLImageElement).currentSrc || (node as HTMLImageElement).src)).toContain("/hd/");
  await page.mouse.up(); await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 4000 });
  // Explicit focus-event branch, not a native OS/OBS performance claim.
  await page.evaluate(() => { Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false }); dispatchEvent(new FocusEvent("blur")); });
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 }); await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await page.waitForTimeout(1100);
  const quiet = await pet(page).evaluate(node => new Promise<{ ranges: number; writes: number }>(resolve => {
    let ranges = 0, writes = 0; const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { ranges++; return original.call(this); };
    const observer = new MutationObserver(records => { writes += records.length; }); observer.observe(node, { subtree: true, attributes: true });
    setTimeout(() => { observer.disconnect(); Range.prototype.getClientRects = original; resolve({ ranges, writes }); }, 350);
  }));
  expect(quiet).toEqual({ ranges: 0, writes: 0 });
});

test("all three disclosures share saved viewer and studio state through navigation and prepaint reload", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  const keys = ["tag-filter", "season", "companion-home"];
  for (const key of keys) { const toggle = page.locator(`[data-panel-section-toggle="${key}"]`); await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "false"); }
  const saved = await page.evaluate(key => localStorage.getItem(key), PANEL_SECTION_PREFERENCES_KEY);
  expect(JSON.parse(saved!)).toEqual({ version: 1, "tag-filter": false, season: false, "companion-home": false });
  await page.goto("/visual-fixture/studio?role=owner");
  for (const key of keys) {
    const toggle = page.locator(`[data-panel-section-toggle="${key}"]`);
    const body = page.locator(`[data-panel-section="${key}"][data-panel-collapsible] > .panel-section-body`);
    await expect(toggle).toHaveAttribute("aria-expanded", "false"); await expect(body).toBeHidden();
    await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true"); await expect(body).toBeVisible();
  }
  const studioExpanded = await page.evaluate(key => localStorage.getItem(key), PANEL_SECTION_PREFERENCES_KEY);
  expect(JSON.parse(studioExpanded!)).toEqual({ version: 1, "tag-filter": true, season: true, "companion-home": true });
  for (const key of keys) {
    const toggle = page.locator(`[data-panel-section-toggle="${key}"]`);
    const body = page.locator(`[data-panel-section="${key}"][data-panel-collapsible] > .panel-section-body`);
    await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "false"); await expect(body).toBeHidden();
  }
  const studioCollapsed = await page.evaluate(key => localStorage.getItem(key), PANEL_SECTION_PREFERENCES_KEY);
  expect(JSON.parse(studioCollapsed!)).toEqual(JSON.parse(saved!));
  await page.goto("/visual-fixture/poster?avatar=1");
  for (const key of keys) await expect(page.locator(`[data-panel-section-toggle="${key}"]`)).toHaveAttribute("aria-expanded", "false");
  // Inline prepaint code still runs; block hydration chunks so React cannot
  // make an expanded server card look correct only after the first frame.
  const chunks = /\/_next\/static\/.*\.js(?:\?|$)/;
  await page.route(chunks, route => route.abort("blockedbyclient")); await page.reload({ waitUntil: "domcontentloaded" });
  for (const key of keys) {
    await expect(page.locator("html")).toHaveAttribute("data-panel-sections", new RegExp(key));
    await expect(page.locator(`[data-panel-section="${key}"][data-panel-collapsible] > .panel-section-body`)).toBeHidden();
  }
  await page.screenshot({ path: ".scratch-pw/companion-polish-prepaint-folded.png" });
  await page.unroute(chunks); await page.reload();
  for (const key of keys) { const toggle = page.locator(`[data-panel-section-toggle="${key}"]`); await expect(toggle).toHaveAttribute("aria-expanded", "false"); await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "true"); }
});

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.

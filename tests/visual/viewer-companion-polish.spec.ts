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
  const item = food(page).last(); await expect(item).toHaveAttribute("data-selected", "");
  return item;
}
const foodPoint = (item: Locator) => item.evaluate(node => { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: m.m41, y: m.m42 }; });
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
    let floor = innerHeight - 18;
    for (const node of document.querySelectorAll(".agenda-monthbar")) { const r = node.getBoundingClientRect(); if (getComputedStyle(node).position === "fixed" && r.width > 0 && r.top > innerHeight * .65 && r.bottom <= innerHeight + 1) floor = Math.min(floor, r.top - 8); }
    if (Math.abs(point.y - floor) < 2) return { kind: "floor", error: Math.abs(point.y - floor), offset: { x: point.x, y: point.y } };
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
  await page.mouse.move(release.x, release.y); await recordFall(page, item); await page.mouse.click(release.x, release.y);
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
  const next = await spawn(page); await page.mouse.click(release.x, release.y); await page.waitForTimeout(70);
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
  const item = await spawn(page); await page.mouse.click(point.x, Math.max(48, point.y - 65));
  await expect(item).not.toHaveAttribute("data-selected"); await expect(item).not.toHaveAttribute("data-falling", { timeout: 1800 });
  const landed = await foodPoint(item), source = await renderedSupport(page, landed, true);
  expect(source?.kind).toBe("text");
  await page.evaluate(() => { document.documentElement.style.overflowY = "auto"; document.documentElement.style.scrollBehavior = "auto"; document.body.style.overflowY = "visible"; const spacer = document.createElement("div"); spacer.style.cssText = "height:1200px;pointer-events:none"; spacer.setAttribute("aria-hidden", "true"); document.body.append(spacer); scrollTo({ top: 64, behavior: "instant" }); });
  await expect.poll(async () => { const current = await foodPoint(item), rect = (await anchor.boundingBox())!; return Math.hypot(current.x - rect.x - source!.offset.x, current.y - rect.y - source!.offset.y); }).toBeLessThan(2);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  const release = await roomyRelease(page);
  await item.focus(); await item.press("Enter"); await page.mouse.click(release.x, release.y); await expect(item).toHaveAttribute("data-falling", "");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.locator(".vc-food-layer")).toBeHidden(); await expect(item).not.toHaveAttribute("data-falling");
  const settings = page.getByRole("dialog", { name: "설정", exact: true });
  await settings.getByRole("tablist", { name: "설정 묶음", exact: true }).getByRole("tab", { name: "움직임", exact: true }).click();
  await settings.getByRole("switch", { name: "생동감 있는 동작 켜기/끄기", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");
  await settings.locator("[data-act=close-settings]").click(); await expect(item).toBeVisible(); await expect(item).not.toHaveAttribute("data-falling");
  await item.focus(); await item.press("Delete");
  const still = await spawn(page); await page.mouse.click(release.x, release.y);
  await expect(still).not.toHaveAttribute("data-selected"); await expect(still).not.toHaveAttribute("data-falling");
  expect(await renderedSupport(page, await foodPoint(still))).not.toBeNull();
  const settled = await foodPoint(still); await page.waitForTimeout(450); expect(await foodPoint(still)).toEqual(settled);
});

test("large native keyposes and first-pass contact stay fluid, reward only real strokes and park without geometry work", async ({ page }) => {
  test.setTimeout(35_000); await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, { size: "large" });
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-size", "large");
  await expect(pet(page)).toHaveAttribute("data-quality", "sharp", { timeout: 10000 }); await expect(pet(page)).toHaveAttribute("data-atlas", "keypose");
  const sprite = page.locator(".vc-sprite"); await expect(sprite).toHaveCSS("image-rendering", "auto");
  expect(await sprite.evaluate(node => getComputedStyle(node).backgroundImage)).toContain("vitamin-keyposes-2x.webp");
  const intrinsic = await page.evaluate(async () => { const image = new Image(); image.src = "/companion/vitamin-keyposes-2x.webp"; await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight }; });
  expect(intrinsic).toEqual({ width: 640, height: 640 });
  const focus = page.locator('[data-panel-section-toggle="tag-filter"]'); await focus.focus();
  const before = await world(page), y = before.y - before.size * .49, left = before.x - before.size * .22, right = before.x + before.size * .22;
  const bond = page.getByRole("meter", { name: "빅타민 친밀도", exact: true }), initial = await bond.evaluate(node => (node as HTMLMeterElement).value);
  await page.mouse.move(left, y); await page.mouse.move(right, y, { steps: 6 });
  await expect(pet(page)).toHaveAttribute("data-petting", "touch"); await expect(page.locator(".vc-petting-hand")).toBeVisible();
  await expect.poll(() => page.locator(".vc-contact").evaluate(node => { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return Math.abs(m.m42) + Math.abs(m.b); })).toBeGreaterThan(.01);
  expect(await bond.evaluate(node => (node as HTMLMeterElement).value)).toBeLessThanOrEqual(initial + .001);
  await expect(focus).toBeFocused();
  await page.mouse.move(left, y, { steps: 5 }); await page.mouse.move(right, y, { steps: 5 });
  await expect(pet(page)).toHaveAttribute("data-petting", "hover"); await expect(pet(page)).toHaveAttribute("data-state", "petted");
  await expect.poll(() => bond.evaluate(node => (node as HTMLMeterElement).value)).toBeGreaterThan(initial + .07);
  await page.screenshot({ path: ".scratch-pw/companion-polish-contact-large.png" });
  await page.mouse.down(); await page.mouse.move(right + 8, y);
  await expect(pet(page)).toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-petting");
  await expect(pet(page)).toHaveAttribute("data-atlas", "fluid"); expect(await sprite.evaluate(node => getComputedStyle(node).backgroundImage)).toContain("vitamin-fluid-q95.webp");
  await page.mouse.up(); await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 4000 });
  // Explicit focus-event branch, not a native OS/OBS performance claim.
  await page.evaluate(() => { Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false }); dispatchEvent(new FocusEvent("blur")); });
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 }); await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "keypose");
  await page.waitForTimeout(1100);
  const quiet = await pet(page).evaluate(node => new Promise<{ ranges: number; writes: number }>(resolve => {
    let ranges = 0, writes = 0; const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { ranges++; return original.call(this); };
    const observer = new MutationObserver(records => { writes += records.length; }); observer.observe(node, { subtree: true, attributes: true });
    setTimeout(() => { observer.disconnect(); Range.prototype.getClientRects = original; resolve({ ranges, writes }); }, 350);
  }));
  expect(quiet).toEqual({ ranges: 0, writes: 0 });
});

test("all three disclosures survive full navigation and prepaint reload while studio remains open", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  const keys = ["tag-filter", "season", "companion-home"];
  for (const key of keys) { const toggle = page.locator(`[data-panel-section-toggle="${key}"]`); await toggle.click(); await expect(toggle).toHaveAttribute("aria-expanded", "false"); }
  const saved = await page.evaluate(key => localStorage.getItem(key), PANEL_SECTION_PREFERENCES_KEY);
  expect(JSON.parse(saved!)).toEqual({ version: 1, "tag-filter": false, season: false, "companion-home": false });
  await page.goto("/visual-fixture/studio");
  const studio = page.locator('[data-panel-section="tag-filter"]'); await expect(studio.locator(".tag-legend-filter").first()).toBeVisible(); await expect(studio.locator(".panel-section-toggle")).toHaveCount(0);
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

test.describe("native coarse mobile polish", () => {
  test.use({ hasTouch: true });
  for (const viewport of [{ width: 390, height: 844 }, { width: 900, height: 600 }]) test(`dark month and house launcher share readable tokens at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport); await setup(page, { dark: true, gfx: viewport.width === 900 ? "off" : "max", reduced: true });
    expect(await page.evaluate(() => matchMedia("(pointer: coarse)").matches)).toBe(true);
    const month = page.locator(".agenda-header .month-title-text"); await expect(month).toBeVisible();
    const palette = await month.evaluate(node => {
      const header = node.closest(".agenda-header")!, root = getComputedStyle(document.documentElement), color = getComputedStyle(node).color, background = getComputedStyle(header).backgroundColor;
      const probe = document.createElement("span"); probe.style.color = "var(--accent-strong)"; document.body.append(probe); const expected = getComputedStyle(probe).color; probe.remove();
      const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
      const luminance = (values: number[]) => values.slice(0, 3).map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
      const bg = rgb(background), paper = rgb(root.getPropertyValue("--paper"));
      // Header opacity96% composites over dark paper. Resolve a hex paper
      // token through a computed probe instead of treating its digits as RGB.
      const paperProbe = document.createElement("span"); paperProbe.style.color = "var(--paper)"; document.body.append(paperProbe); const resolvedPaper = rgb(getComputedStyle(paperProbe).color); paperProbe.remove();
      const alpha = bg[3] ?? 1, composite = bg.slice(0, 3).map((v, i) => v * alpha + (resolvedPaper[i] ?? paper[i]) * (1 - alpha));
      const a = luminance(rgb(color)), b = luminance(composite);
      return { color, expected, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), size: parseFloat(getComputedStyle(node).fontSize) };
    });
    expect(palette.color).toBe(palette.expected); expect(palette.contrast).toBeGreaterThanOrEqual(4.5); expect(palette.size).toBeGreaterThanOrEqual(19);
    const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true }), records = page.locator(".agenda-legend-insights");
    await expect(launcher).toBeVisible(); await expect(launcher).toHaveClass(/\bbutton\b/);
    await page.mouse.move(0, 0); // compare resting native surfaces, not a stale hover
    const material = (node: Element) => { const s = getComputedStyle(node), r = node.getBoundingClientRect(); return { background: s.backgroundColor, radius: s.borderRadius, border: s.borderColor, color: s.color, height: r.height }; };
    const houseMaterial = await launcher.evaluate(material), recordMaterial = await records.evaluate(material);
    expect(houseMaterial.background).toBe(recordMaterial.background); expect(houseMaterial.radius).toBe(recordMaterial.radius); expect(houseMaterial.border).toBe(recordMaterial.border); expect(houseMaterial.color).toBe(recordMaterial.color);
    expect(houseMaterial.height).toBeGreaterThanOrEqual(44); expect(recordMaterial.height).toBeGreaterThanOrEqual(44);
    await launcher.tap(); await expect(page.getByRole("region", { name: "빅타민 집", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "빅타민 집 닫기", exact: true }).tap(); await expect(launcher).toBeVisible();
    await expect(page.locator(".gs-season canvas")).toHaveCount(0);
    console.log(JSON.stringify({ check: "mobile-polish", viewport, palette, houseMaterial, recordMaterial }));
    await page.screenshot({ path: `.scratch-pw/companion-polish-dark-${viewport.width}.png` });
  });
});

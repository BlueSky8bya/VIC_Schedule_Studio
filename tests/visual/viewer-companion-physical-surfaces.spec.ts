import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { findPlatformRoute, type Platform } from "@/lib/ui/viewer-companion/brain";
import { safeCompanionSurfaces, unoccludedCompanionRects } from "@/lib/ui/viewer-companion/geometry";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

type Point = { x: number; y: number };
type FallPoint = Point & { falling: boolean };
type FallWindow = Window & { surfaceFall: Promise<FallPoint[]> };
const house = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const food = (page: Page) => page.locator(".vc-food");
const observations = new WeakMap<Page, { posts: string[]; errors: string[] }>();
const position = (item: Locator) => item.evaluate(node => {
  const m = new DOMMatrixReadOnly(node.closest("[hidden]") ? (node as HTMLElement).style.transform : getComputedStyle(node).transform);
  return { x: m.m41, y: m.m42 };
});
async function press(item: Locator, touch: boolean) { if (touch) await item.tap(); else await item.click(); }
async function drag(page: Page, item: Locator, release: Point, touch: boolean, grabX = 0) {
  const rect = (await item.boundingBox())!, from = { x: rect.x + rect.width / 2 + grabX, y: rect.y + rect.height / 2 };
  if (!touch) { await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(release.x, release.y, { steps: 12 }); await page.mouse.up(); return; }
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...from, id: 31 }] });
    for (let step = 1; step <= 12; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (release.x - from.x) * step / 12, y: from.y + (release.y - from.y) * step / 12, id: 31 }] });
    for (let sample = 0; sample < 4; sample++) {
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...release, id: 31 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally { await cdp.detach(); }
}
async function setup(page: Page, touch: boolean, links = false, avatar = false) {
  const query = [links ? "links=1" : "", avatar ? "avatar=1" : ""].filter(Boolean).join("&");
  await page.goto(`/visual-fixture/poster${query ? `?${query}` : ""}`); await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => await house(page).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  await openCompanionHome(page, touch ? "touch" : "pointer");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await page.waitForTimeout(180);
}
async function floorError(page: Page, item: Locator) {
  const p = await position(item), rect = (await house(page).locator(".vc-home-floor").boundingBox())!;
  return { x: p.x - rect.x, y: p.y - rect.y, planeError: Math.abs(p.y - rect.y - rect.height + 6) };
}

test.use({ video: "on" });
test.beforeEach(async ({ page }) => {
  const observed = { posts: [] as string[], errors: [] as string[] }; observations.set(page, observed);
  page.on("pageerror", error => observed.errors.push(error.message));
  await page.route("**/*", route => route.request().method() === "POST" ? (observed.posts.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch);
    for (const [name, value] of Object.entries({ "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: true, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05 } });
});
test.afterEach(async ({ page }) => { expect(observations.get(page)).toEqual({ posts: [], errors: [] }); });

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const touch of [false]) test.describe(touch ? "native390 physical floor" : "PC1920 physical floor", () => {
  test.use({ viewport: touch ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: touch, isMobile: touch });
  test("a genuine release above the room falls onto its floor and retains that home through topology", async ({ page }) => {
    await setup(page, touch);
    await press(house(page).getByRole("button", { name: "밥 꺼내기", exact: true }), touch); await expect(food(page)).toHaveCount(1);
    const item = food(page).first(), id = await item.getAttribute("data-food");
    const target = await house(page).evaluate(node => {
      const floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(), bed = node.querySelector(".vc-cushion-button")!.getBoundingClientRect(), feed = node.querySelector(".vc-dispenser")!.getBoundingClientRect();
      const footX = feed.left - 26, release = { x: footX + 12, y: floor.top - 24 };
      const hit = document.elementsFromPoint(release.x, release.y).find(element => !element.closest(".vc-food-layer,.vc-companion"));
      return { release, footX, plane: floor.bottom - 6, floorTop: floor.top, bedRight: bed.right, nativeRoom: hit === node.querySelector(".vc-home-room") };
    });
    expect(target.release.y).toBeLessThan(target.floorTop); expect(target.release.x).toBeGreaterThan(target.bedRight); expect(target.nativeRoom).toBe(true);
    // Grab12px to the right of centre. In the compact room this leaves the
    // pointer outside the bed while the whole44px fruit stays left of the feed.
    await item.evaluate(node => {
      (window as unknown as FallWindow).surfaceFall = new Promise(resolve => node.addEventListener("pointerup", () => {
        const points: FallPoint[] = [], began = performance.now();
        const tick = () => { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); points.push({ x: m.m41, y: m.m42, falling: node.hasAttribute("data-falling") }); if (performance.now() - began < 2000 && (node.hasAttribute("data-falling") || points.length < 2)) requestAnimationFrame(tick); else resolve(points); };
        requestAnimationFrame(tick);
      }, { once: true, capture: true }));
    });
    await drag(page, item, target.release, touch, 12);
    const trajectory = await page.evaluate(() => (window as unknown as FallWindow).surfaceFall);
    expect(trajectory.length).toBeGreaterThan(2);
    expect(trajectory.some(point => point.falling)).toBe(true);
    expect(trajectory.at(-1)!.y - trajectory[0].y).toBeGreaterThan(4);
    const impact = trajectory.findIndex(point => point.y >= target.plane - .05), falling = impact < 0 ? trajectory : trajectory.slice(0, impact + 1);
    expect(falling.every((point, index) => !index || point.y >= falling[index - 1].y - .1)).toBe(true);
    expect(trajectory.every(point => point.y <= target.plane + 1)).toBe(true); // The existing small rebound rises above this plane.
    await expect(item).not.toHaveAttribute("data-falling");
    await expect.poll(async () => (await floorError(page, item)).planeError).toBeLessThan(2);
    expect(Math.abs((await position(item)).x - target.footX)).toBeLessThan(2);
    const original = await floorError(page, item), fold = house(page).getByRole("button", { name: "빅타민 집", exact: true });
    await press(fold, touch); await expect(item).toHaveJSProperty("hidden", true);
    await press(fold, touch); await expect(item).toHaveJSProperty("hidden", false);
    if (touch) { await house(page).getByRole("button", { name: "빅타민 집 닫기", exact: true }).tap(); await expect(item).toHaveJSProperty("hidden", true); await openCompanionHome(page, "touch"); }
    else { await page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true }).click(); await expect(page.locator(".avatar-right .vc-home")).toBeVisible(); }
    await expect.poll(async () => { const current = await floorError(page, item); return Math.hypot(current.x - original.x, current.y - original.y); }).toBeLessThan(2);
    expect(await item.getAttribute("data-food")).toBe(id);
    const overlaps = await item.evaluate(node => { const a = node.getBoundingClientRect(); return [...document.querySelectorAll(".vc-home button:not(.vc-cushion-button)")].filter(control => { const b = control.getBoundingClientRect(); return b.width > 0 && b.height > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; }).length; });
    expect(overlaps).toBe(0);
    await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
    await expect.poll(async () => { const current = await floorError(page, item); return Math.hypot(current.x - original.x, current.y - original.y); }).toBeLessThan(2);
    await page.screenshot({ path: `.scratch-pw/companion-physical-floor-${touch ? 390 : 1920}.png` });
    console.log(JSON.stringify({ check: "above-home-floor", width: touch ? 390 : 1920, id, target, trajectory, restoredOffset: await floorError(page, item), controlOverlaps: overlaps, postsSent: 0 }));
  });
});

test("actual band and weekday edges provide text-safe autonomous route affordances", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, false, true);
  // A read-only DOM snapshot feeds the same pure safety/route functions used by
  // the runtime. No platform, layout, clock or product debug API is injected.
  const scene = await page.locator(".poster-page").evaluate(root => {
    const rect = (r: DOMRect) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom });
    const visible = (element: Element | null): boolean => { if (!element) return true; const style = getComputedStyle(element); return !element.hasAttribute("hidden") && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > .05 && visible(element.parentElement); };
    const obstacles: ReturnType<typeof rect>[] = [], bases: ReturnType<typeof rect>[] = [];
    const range = document.createRange(), walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !visible(parent) || parent.closest("script,style,svg,.sr-only,.vc-companion,.vc-food-layer")) continue;
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) { if (r.width < .5 || r.height < .5) continue; obstacles.push(rect(r)); if (parent.closest(".public-day .day-strip>strong,.public-event .event-main p,.public-event .event-subs li")) bases.push(rect(r)); }
    }
    range.detach();
    for (const control of root.querySelectorAll("button,a[href],input,select,textarea,[role=button]")) { if (!visible(control) || control.matches(".public-event[data-eventid],.public-day") || control.closest(".vc-companion,.vc-cushion-button")) continue; const r = control.getBoundingClientRect(); if (r.width > 0 && r.height > 0) obstacles.push(rect(r)); }
    const house = document.querySelector(".vc-home"), cover = house && visible(house) ? rect(house.getBoundingClientRect()) : undefined;
    const surfaces = [...root.querySelectorAll(".support-bar[data-supportid],.weekday-row")].filter(visible).map((element, index) => { const r = element.getBoundingClientRect(), header = element.matches(".weekday-row"); return { id: `${header ? "header" : "band"}-${index}`, x: r.left, y: (header ? r.bottom : r.top) - 3, width: r.width, kind: header ? "date" as const : "card" as const, header }; });
    return { viewport: { width: innerWidth, height: innerHeight }, obstacles, bases, cover, surfaces };
  });
  const obstacles = scene.obstacles.flatMap(rect => unoccludedCompanionRects(rect, scene.cover));
  if (scene.cover) obstacles.push(scene.cover);
  const size = 92, footprint = { width: size * .76, height: size * .76 };
  const platforms: Platform[] = scene.surfaces.flatMap(surface => safeCompanionSurfaces(surface, obstacles, size, scene.viewport, footprint).map((span, i) => ({ ...span, id: `${surface.id}-${i}`, kind: surface.kind })));
  for (const [i, base] of scene.bases.entries()) platforms.push(...safeCompanionSurfaces({ x: base.left, y: base.top - 3, width: base.right - base.left }, obstacles, size, scene.viewport, footprint).map((span, split) => ({ ...span, id: `glyph-${i}-${split}`, kind: "date" as const })));
  const routes: Record<string, string[]> = {};
  for (const family of ["band", "header"]) {
    const targets = platforms.filter(p => p.id.startsWith(family)); expect(targets.length).toBeGreaterThan(0);
    for (const target of targets) {
      for (const from of platforms.filter(p => p.id !== target.id)) {
        const route = findPlatformRoute({ x: from.x + from.width / 2, y: from.y, platformId: from.id }, { x: target.x + target.width / 2, y: target.y, platformId: target.id }, platforms);
        if (route?.some(step => step.kind === "jump")) { routes[family] = route.map(step => step.target.platformId); break; }
      }
      if (routes[family]) break;
    }
    expect(routes[family]?.length).toBeGreaterThan(0);
  }
  for (const platform of platforms.filter(p => /^(band|header)/.test(p.id))) for (const x of [platform.x, platform.x + platform.width / 2, platform.x + platform.width]) {
    const body = { left: x - footprint.width / 2, right: x + footprint.width / 2, top: platform.y - footprint.height, bottom: platform.y };
    expect(obstacles.some(r => body.left < r.right && body.right > r.left && body.top < r.bottom && body.bottom > r.top)).toBe(false);
  }
  await page.screenshot({ path: ".scratch-pw/companion-physical-affordances-1920.png" });
  console.log(JSON.stringify({ check: "actual-dom-route-probe", bands: platforms.filter(p => p.id.startsWith("band")).length, headers: platforms.filter(p => p.id.startsWith("header")).length, routes, autonomousArrivalClaimed: false, postsSent: 0 }));
});

test("121 a native quiet release hits the first ribbon and follows its real scroll anchor", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, false, true);
  const target = await page.locator(".support-bar[data-supportid]").evaluateAll(nodes => {
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")].filter(node => !node.closest(".vc-companion,.vc-food-layer,.vc-toys"));
    for (const node of nodes) {
      const r = node.getBoundingClientRect(), y = r.top - 3;
      if (r.width < 80 || y < 220 || y > innerHeight - 120) continue;
      for (const fraction of [.5, .25, .75]) {
        const x = r.left + r.width * fraction;
        if (x < 50 || x > innerWidth - 50 || controls.some(control => { const b = control.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.top < y + 3 && b.bottom > y - 73 && b.left < x + 38 && b.right > x - 38; })) continue;
        node.setAttribute("data-companion-121-band", ""); return { x, pointerY: r.top - 94, planeY: y };
      }
    }
    return null;
  });
  expect(target, "a real input-safe ribbon is required").not.toBeNull();
  const pet = page.locator(".vc-companion"), actor = page.locator(".vc-actor"), from = (await actor.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(target!.x, target!.pointerY, { steps: 10 });
  await expect(pet).toHaveAttribute("data-state", "held");
  // A date's newly real bottom floor can lie above this next-row ribbon.
  // Release below that earlier floor and just above the ribbon, using the
  // actual held outer foot rather than assuming a centre-grab offset.
  const feet = await pet.evaluate(node => node.getBoundingClientRect().bottom);
  await page.mouse.move(target!.x, target!.pointerY + target!.planeY - 8 - feet, { steps: 4 });
  await page.waitForTimeout(120);
  const releaseFeet = await pet.evaluate(node => node.getBoundingClientRect().bottom);
  expect(releaseFeet).toBeLessThan(target!.planeY); expect(target!.planeY - releaseFeet).toBeLessThan(14);
  await page.mouse.up();
  await expect(pet).toHaveAttribute("data-platform", /-band-top(?:-\d+)?$/); await expect(pet).not.toHaveAttribute("data-state", "jump");
  const error = () => pet.evaluate(node => { const band = document.querySelector("[data-companion-121-band]")!.getBoundingClientRect(); return Math.abs(node.getBoundingClientRect().bottom - band.top + 3); });
  await expect.poll(error).toBeLessThan(2);
  await page.evaluate(() => {
    document.documentElement.style.overflowY = "auto"; document.documentElement.style.scrollBehavior = "auto"; document.body.style.overflowY = "visible";
    const spacer = document.createElement("div"); spacer.style.cssText = "height:800px;pointer-events:none"; spacer.setAttribute("aria-hidden", "true"); document.body.append(spacer);
    window.scrollTo({ top: 64, behavior: "instant" });
  });
  await expect.poll(error).toBeLessThan(2); await expect(pet).toBeVisible();
  await expect(pet).toHaveAttribute("data-platform", /-band-top(?:-\d+)?$/);
});

test("121 food on a real blank date floor retains its fraction through panel FLIP and scroll", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, false);
  const target = await page.locator(".public-day:not(.outside)").evaluateAll(nodes => {
    for (const node of nodes) {
      const r = node.getBoundingClientRect();
      if (node.querySelector(".public-event,.support-bar") || r.width < 70 || r.height < 100 || r.top < 150 || r.bottom > innerHeight - 32) continue;
      node.setAttribute("data-companion-121-day", ""); return { x: r.left + r.width / 2, y: r.bottom - 70 };
    }
    return null;
  });
  expect(target, "use a real empty date, never a fabricated plane").not.toBeNull();
  await house(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  const item = food(page).first(); await expect(item).toBeVisible(); const id = await item.getAttribute("data-food");
  await drag(page, item, target!, false); await expect(item).not.toHaveAttribute("data-falling");
  const error = () => item.evaluate(node => { const r = document.querySelector("[data-companion-121-day]")!.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return Math.abs(m.m42 - r.bottom + 3); });
  await expect.poll(error).toBeLessThan(2);
  const fraction = await item.evaluate(node => { const r = document.querySelector("[data-companion-121-day]")!.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return (m.m41 - r.left) / r.width; });
  const probe = item.evaluate((node, u) => new Promise<{ error: number; hidden: boolean; x: number }[]>(resolve => {
    const frames: { error: number; hidden: boolean; x: number }[] = [], start = performance.now();
    const sample = () => requestAnimationFrame(() => setTimeout(() => {
      const r = document.querySelector("[data-companion-121-day]")!.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      frames.push({ error: Math.hypot(m.m41 - r.left - r.width * u, m.m42 - r.bottom + 3), hidden: (node as HTMLElement).hidden, x: r.left });
      if (performance.now() - start < 1000) sample(); else resolve(frames);
    }, 0)); sample();
  }), fraction);
  await page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true }).click();
  const frames = await probe;
  expect(frames.length).toBeGreaterThan(15); expect(Math.max(...frames.map(frame => frame.x)) - Math.min(...frames.map(frame => frame.x))).toBeGreaterThan(80);
  expect(frames.every(frame => !frame.hidden)).toBe(true); expect(Math.max(...frames.map(frame => frame.error))).toBeLessThan(3);
  expect(await item.getAttribute("data-food")).toBe(id); await expect.poll(error).toBeLessThan(2);
  await page.evaluate(() => {
    document.documentElement.style.overflowY = "auto"; document.documentElement.style.scrollBehavior = "auto"; document.body.style.overflowY = "visible";
    const spacer = document.createElement("div"); spacer.style.cssText = "height:800px;pointer-events:none"; spacer.setAttribute("aria-hidden", "true"); document.body.append(spacer);
    window.scrollTo({ top: 64, behavior: "instant" });
  });
  await expect.poll(error).toBeLessThan(2); await expect(item).toBeVisible();
});

test("121 blank-panel pet and food keep the same real floor after native side remount", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, false, false, true);
  const panel = page.locator(".avatar-slot .avatar-dock-inner"), r = (await panel.boundingBox())!;
  expect(r.height).toBeGreaterThan(100); expect(r.y + r.height).toBeLessThan(1088);
  const pet = page.locator(".vc-companion"), actor = page.locator(".vc-actor");
  await actor.focus(); await actor.press("p"); await page.mouse.click(r.x + r.width * .25, r.y + r.height - 8);
  await expect(pet).toHaveAttribute("data-platform", /^companion-panel-floor(?:-\d+)?$/); await expect(pet).not.toHaveAttribute("data-state", "jump");
  await house(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  const item = food(page).first();
  // The real fixed month controls raise the shared viewport food floor above
  // this native panel's bottom. Release below that earlier contact to test
  // the panel floor itself, rather than asking a snack to pass through it.
  await drag(page, item, { x: r.x + r.width * .75, y: r.y + r.height - 34 }, false);
  // The release can precede the next native presentation frame. Establish
  // actual contact before reading the retained offset; absence of a transient
  // data-falling attribute alone cannot prove that the snack has landed.
  await expect.poll(() => item.evaluate(node => { const r = document.querySelector(".avatar-slot .avatar-dock-inner")!.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return Math.abs(m.m42 - r.bottom + 3); })).toBeLessThan(2);
  await expect(item).not.toHaveAttribute("data-falling");
  await expect(item).toHaveAttribute("data-platform", /^companion-panel-floor-food(?:-\d+)?$/);
  const original = await item.evaluate(node => { const r = document.querySelector(".avatar-slot .avatar-dock-inner")!.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { u: (m.m41 - r.left) / r.width, y: m.m42 - r.bottom }; });
  expect(original.y).toBeCloseTo(-3, 0);
  await page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true }).click();
  await expect.poll(() => item.evaluate((node, expected) => { const r = document.querySelector(".avatar-slot .avatar-dock-inner")!.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return Math.hypot((m.m41 - r.left) / r.width - expected.u, m.m42 - r.bottom - expected.y); }, original)).toBeLessThan(1);
  await expect(item).toBeVisible(); await expect(pet).toBeVisible();
  await expect(pet).toHaveAttribute("data-platform", /^companion-panel-floor(?:-\d+)?$/);
  await expect.poll(() => pet.evaluate(node => Math.abs(node.getBoundingClientRect().bottom - document.querySelector(".avatar-slot .avatar-dock-inner")!.getBoundingClientRect().bottom + 3))).toBeLessThan(2);
});

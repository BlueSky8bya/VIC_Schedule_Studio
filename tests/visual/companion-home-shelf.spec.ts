import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";

type Surface = "viewer" | "studio" | "preview";
type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Input = { type: string; trusted: boolean; key: string; x: number; y: number; at: number };
type Sample = {
  phase: string; at: number; scrollY: number; viewport: { width: number; height: number }; month: string[];
  launcher: Rect | null; home: Rect | null; calendar: Rect[]; dateAndEvents: Rect[]; chrome: Rect[];
  shelfCount: number; launcherSlotCount: number; houses: number; pets: number;
  pet: Rect | null; platform: string; depth: string; bed: Rect | null; foreground: Rect | null;
  frontVisible: boolean; localFrontOpacity: number; localFrontVisibility: string; food: { rect: Rect; transform: string; hidden: boolean; falling: boolean }[];
};
type ShelfProbe = { inputs: Input[]; input: (event: Event) => void; frames: Sample[]; phase: string; raf: number; stopped: boolean; sample: () => Sample };
type ProbeWindow = Window & { homeShelfProbe: ShelfProbe };
type Evidence = { writes: string[]; errors: string[]; publicReads: number; samples: Sample[] };
const observations = new WeakMap<Page, Evidence>();
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const launcher = (page: Page) => page.locator(".vc-home-launcher");
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const calendarSelector = ".public-month-grid,.studio-month-grid,.agenda-flow,.agenda-days,.agenda-list";
const output = ".scratch-pw/097-home-shelf";
const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

test.use({ viewport: { width: 1480, height: 938 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  test.setTimeout(35_000);
  const proof: Evidence = { writes: [], errors: [], publicReads: 0, samples: [] }; observations.set(page, proof);
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const reads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    // Only the exact build's public, read-only preview action is fulfilled.
    // Every mutation and unknown POST is intercepted before reaching a server.
    if (request.method() === "POST" && path === "/visual-fixture/studio" && reads.has(request.headers()["next-action"])) {
      proof.publicReads++;
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" });
    }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    if (/\/api\/public\/[^/]+\/search\/trending$/.test(path)) return route.fulfill({ json: { trends: [] } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const buildId = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const path = `${output}/${buildId}`, label = info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 125); mkdirSync(path, { recursive: true });
  const live = await page.evaluate(() => {
    const p = (window as unknown as ProbeWindow).homeShelfProbe;
    if (!p) return null;
    p.stopped = true; cancelAnimationFrame(p.raf);
    for (const type of ["pointerdown", "pointerup", "keydown", "wheel"]) document.removeEventListener(type, p.input, true);
    return { inputs: p.inputs, frames: p.frames, focused: document.hasFocus(), visibility: document.visibilityState, preferences: localStorage.getItem("vic.viewerCompanion") };
  }).catch(error => ({ observationError: String(error) }));
  writeFileSync(`${path}/${label}.json`, JSON.stringify({ buildId, title: info.title, status: info.status, ...observations.get(page), live }, null, 2));
  await page.screenshot({ path: `${path}/${label}.png`, fullPage: true }).catch(() => {});
  expect(observations.get(page)?.writes).toEqual([]); expect(observations.get(page)?.errors).toEqual([]);
  if (live && "inputs" in live) expect(live.inputs.every(input => input.trusted), "all product interactions use actual native input").toBe(true);
});

async function seed(page: Page, dark = false) {
  await page.addInitScript(({ epoch, key, preferences, care, dark }) => {
    // Saved device preferences only: no RNG, clock, focus, action, layout or
    // application callback is replaced to manufacture a successful witness.
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": dark ? "on" : "off", "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: true, feeding: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: 1 }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, dark });
}
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  await page.waitForTimeout(180); // Existing finite/coalesced geometry delivery.
}
async function setup(page: Page, surface: Surface, dark = false, signedIn = false) {
  await seed(page, dark);
  await page.goto(surface === "viewer" ? `/visual-fixture/poster?signedIn=${signedIn ? "1" : "0"}` : "/visual-fixture/studio?role=owner");
  await page.bringToFront(); await settle(page);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  if (surface === "preview") {
    await page.getByRole("button", { name: "시청자 화면 보여주기", exact: true }).click();
    await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();
    expect(observations.get(page)?.publicReads).toBe(1); await settle(page);
  }
  await installProbe(page); return snapshot(page, "ready");
}
async function installProbe(page: Page) {
  await page.evaluate(calendarSelector => {
    const rect = (node: Element): Rect => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const visible = (node: Element): boolean => {
      const r = node.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
      for (let parent: Element | null = node; parent; parent = parent.parentElement) { const style = getComputedStyle(parent); if (parent.hasAttribute("hidden") || style.display === "none" || style.visibility === "hidden" || Number(style.opacity) <= .01) return false; }
      return true;
    };
    const active = document.querySelector(".viewer-fullscreen .poster-page") ?? document.querySelector(".poster-page,.studio-shell")!;
    const probe: ShelfProbe = { inputs: [], input: () => {}, frames: [], phase: "ready", raf: 0, stopped: false, sample: () => { throw new Error("not initialized"); } };
    probe.sample = () => {
      const l = document.querySelector(".vc-home-launcher"), h = document.querySelector(".vc-home"), p = document.querySelector<HTMLElement>(".vc-companion"), bed = h?.querySelector(".vc-plush-bed"), front = document.querySelector<HTMLElement>(".vc-bed-foreground");
      const local = h?.querySelector(".vc-bed-local-front"); let localOpacity = local ? 1 : 0;
      // The SVG's presentation visibility owns this mask. Opacity1 on a
      // visibility:hidden group paints no cloth; measure actual paint state.
      for (let parent: Element | null = local ?? null; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent); localOpacity *= Number(css.opacity);
        if (parent.hasAttribute("hidden") || css.display === "none" || ["hidden", "collapse"].includes(css.visibility)) localOpacity = 0;
      }
      return { phase: probe.phase, at: performance.now(), scrollY, viewport: { width: innerWidth, height: innerHeight }, month: [...active.querySelectorAll("h1.poster-chrome-title,h1.agenda-title,.studio-month-nav")].filter(visible).map(node => node.textContent ?? ""),
        launcher: l && visible(l) ? rect(l) : null, home: h && visible(h) ? rect(h) : null,
        calendar: [...active.querySelectorAll(calendarSelector)].filter(visible).map(rect),
        dateAndEvents: [...active.querySelectorAll(".public-day,.studio-day,.agenda-day,.public-event,.studio-event-pill,.agenda-item,.agenda-event,.d-num,.studio-day-head,.agenda-when")].filter(visible).map(rect),
        chrome: [...active.querySelectorAll(".public-calendar-header :is(button,a,h1),.agenda-header :is(button,a,h1),.agenda-legend-rail > .button,.agenda-legend-nav > :is(button,a),.studio-topbar :is(button,a,h1)")].filter(node => node !== l && !node.contains(l) && !node.closest(".vc-home") && visible(node)).map(rect),
        shelfCount: active.querySelectorAll(".vc-home-shelf-slot").length, launcherSlotCount: active.querySelectorAll(".vc-home-launcher-slot").length,
        houses: document.querySelectorAll(".vc-home").length, pets: document.querySelectorAll(".vc-companion").length,
        pet: p && visible(p) ? rect(p) : null, platform: p?.dataset.platform ?? "", depth: p?.dataset.sofaDepth ?? "", bed: bed && visible(bed) ? rect(bed) : null,
        foreground: front && visible(front) ? rect(front) : null, frontVisible: Boolean(front && visible(front)), localFrontOpacity: localOpacity, localFrontVisibility: local ? getComputedStyle(local).visibility : "absent",
        food: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(node => ({ rect: rect(node), transform: node.style.transform, hidden: node.hidden, falling: node.hasAttribute("data-falling") })) };
    };
    probe.input = event => { const pointer = event as PointerEvent; probe.inputs.push({ type: event.type, trusted: event.isTrusted, key: event instanceof KeyboardEvent ? event.key : "", x: pointer.clientX ?? 0, y: pointer.clientY ?? 0, at: performance.now() }); };
    for (const type of ["pointerdown", "pointerup", "keydown", "wheel"]) document.addEventListener(type, probe.input, true);
    (window as unknown as ProbeWindow).homeShelfProbe = probe;
  }, calendarSelector);
}
async function snapshot(page: Page, phase: string) {
  const sample = await page.evaluate(phase => { const p = (window as unknown as ProbeWindow).homeShelfProbe; p.phase = phase; return p.sample(); }, phase);
  observations.get(page)!.samples.push(sample); return sample;
}
function assertLauncherClear(sample: Sample) {
  expect(sample.launcher, "one reachable house launcher").not.toBeNull();
  expect(sample.calendar.length + sample.dateAndEvents.length, "an actual rendered calendar must exist before assessing overlap").toBeGreaterThan(0);
  // Keep this physical assertion first. 096's lower-right launcher covers a
  // real calendar day, even when that particular day contains no event.
  expect([...sample.calendar, ...sample.dateAndEvents].reduce((sum, rect) => sum + area(sample.launcher!, rect), 0), "the launcher must occupy header chrome instead of any calendar/date/event area").toBe(0);
  expect(sample.chrome.reduce((sum, rect) => sum + area(sample.launcher!, rect), 0), "the launcher must also leave existing header navigation, title and account controls clear").toBe(0);
  expect(sample.launcher!.width).toBeGreaterThanOrEqual(44); expect(sample.launcher!.height).toBeGreaterThanOrEqual(44);
  expect(sample.launcher!.left).toBeGreaterThanOrEqual(0); expect(sample.launcher!.right).toBeLessThanOrEqual(sample.viewport.width);
  expect(sample.launcher!.top).toBeGreaterThanOrEqual(0); expect(sample.launcher!.bottom).toBeLessThanOrEqual(sample.viewport.height);
}
async function openShelf(page: Page, input: "pointer" | "keyboard" = "pointer") {
  const id = await launcher(page).getAttribute("aria-controls");
  expect(id, "the launcher names its actual controlled house").toBeTruthy();
  await expect(launcher(page)).toHaveAttribute("aria-expanded", "false");
  if (input === "keyboard") { await launcher(page).focus(); await launcher(page).press("Enter"); } else await launcher(page).click();
  await expect(home(page)).toBeVisible(); await expect(home(page)).toHaveCount(1); await settle(page);
  expect(await home(page).evaluate((node, id) => Boolean(document.getElementById(id!)?.contains(node)), id)).toBe(true);
  await expect(launcher(page)).toHaveAttribute("aria-expanded", "true");
  const sample = await snapshot(page, "shelf-open");
  assertLauncherClear(sample);
  expect(sample.home).not.toBeNull();
  expect([...sample.calendar, ...sample.dateAndEvents].reduce((sum, rect) => sum + area(sample.home!, rect), 0), "the expanded home reserves real document space above the calendar").toBe(0);
  expect(sample.home!.left).toBeGreaterThanOrEqual(0); expect(sample.home!.right).toBeLessThanOrEqual(sample.viewport.width + 1);
  expect(sample.home!.top).toBeGreaterThanOrEqual(-1); expect(sample.home!.bottom).toBeLessThanOrEqual(sample.viewport.height + 1);
  expect(sample.houses).toBe(1); expect(sample.pets).toBe(1);
  const dimensions = await home(page).evaluate(node => ({ room: node.querySelector(".vc-home-room")!.getBoundingClientRect().height, controls: [...node.querySelectorAll<HTMLElement>("button")].filter(button => !button.hasAttribute("data-panel-section-toggle")).map(button => { const r = button.getBoundingClientRect(); return { width: r.width, height: r.height }; }) }));
  expect(dimensions.room, "the home remains its existing132px room, not a miniaturized diorama").toBeCloseTo(132, 0);
  expect(dimensions.controls.length).toBeGreaterThanOrEqual(3);
  for (const control of dimensions.controls) { expect(control.width).toBeGreaterThanOrEqual(44); expect(control.height).toBeGreaterThanOrEqual(44); }
  return sample;
}
async function closeShelf(page: Page) {
  await home(page).getByRole("button", { name: "빅타민 집 닫기", exact: true }).click();
  await expect(home(page)).not.toBeVisible(); await expect(launcher(page)).toBeFocused(); await expect(launcher(page)).toHaveAttribute("aria-expanded", "false"); await settle(page);
}

for (const viewport of [{ width: 1480, height: 938 }, { width: 1280, height: 720 }]) test(`viewer ${viewport.width}x${viewport.height} header launcher and flow shelf leave all dates clear`, async ({ page }) => {
  await page.setViewportSize(viewport); const ready = await setup(page, "viewer", false, viewport.width === 1280);
  assertLauncherClear(ready); const before = ready.month;
  await openShelf(page); await closeShelf(page);
  const closed = await snapshot(page, "closed"); assertLauncherClear(closed); expect(closed.month).toEqual(before);
});
test("PC agenda900x760 retains the existing companion capability exclusion without loading the home", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 760 }); const assets: string[] = [];
  page.on("request", request => { const path = new URL(request.url()).pathname; if (/\/(?:companion\/|premiere\/vitamin-audience\.webp)/.test(path)) assets.push(path); });
  await seed(page); await page.goto("/visual-fixture/poster?signedIn=0"); await page.bringToFront(); await settle(page);
  await expect(page.locator(".agenda-header")).toBeVisible();
  // The shared1040px capability boundary excludes this topology even when
  // a PC has a mouse and a stored ON choice. Do not enable a retired surface
  // just to obtain a positive launcher measurement.
  await expect(page.locator(".vc-companion,.vc-home,.vc-home-launcher,.vc-compact-home,.vc-bed-foreground,.vc-food-layer,.vc-home-launcher-slot,.vc-home-shelf-slot")).toHaveCount(0);
  expect(assets).toEqual([]); expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).enabled)).toBe(true);
  await installProbe(page); await snapshot(page, "agenda-capability-excluded");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});
for (const surface of ["studio", "preview"] as const) test(`${surface}1480 shares the non-overlapping header and full-size shelf`, async ({ page }) => {
  const ready = await setup(page, surface); assertLauncherClear(ready); await openShelf(page);
  await expect(page.locator("[data-export-surface] .vc-home,[data-export-surface] .vc-home-launcher")).toHaveCount(0);
});
test("native Enter and Escape preserve launcher focus, month and the existing scroll context", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); const ready = await setup(page, "viewer"); assertLauncherClear(ready);
  const before = await snapshot(page, "before-keyboard-open"); await openShelf(page, "keyboard");
  await expect(home(page).getByRole("button", { name: "빅타민 집", exact: true })).toBeFocused();
  await page.keyboard.press("Escape"); await expect(home(page)).not.toBeVisible(); await expect(launcher(page)).toBeFocused(); await settle(page);
  const after = await snapshot(page, "keyboard-closed"); expect(after.month).toEqual(before.month); expect(Math.abs(after.scrollY - before.scrollY)).toBeLessThan(2);
  expect(after.calendar.length).toBe(before.calendar.length);
  for (let i = 0; i < before.calendar.length; i++) expect(Math.abs(after.calendar[i].top - before.calendar[i].top)).toBeLessThan(2);
});
test("wide rail side changes and collapse transfer one resident to one header shelf", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, "viewer");
  await expect(home(page)).toBeVisible(); const identity = (await pet(page).elementHandle())!;
  for (const side of ["right", "left"] as const) {
    await page.getByRole("button", { name: side === "right" ? "패널을 오른쪽에 두기" : "패널을 왼쪽에 두기", exact: true }).click(); await settle(page);
    await expect(page.locator(`.avatar-${side} .vc-home`)).toBeVisible(); await expect(home(page)).toHaveCount(1); await expect(pet(page)).toHaveCount(1);
  }
  await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settle(page);
  assertLauncherClear(await snapshot(page, "wide-panel-closed")); await openShelf(page);
  await page.getByRole("button", { name: "패널 펼치기", exact: true }).click(); await settle(page);
  await expect(page.locator(".avatar-left .vc-home")).toBeVisible(); await expect(home(page)).toHaveCount(1);
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
});
test("studio native calendar zoom keeps the house physical size and controls unchanged", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); assertLauncherClear(await setup(page, "studio")); await openShelf(page);
  const before = await page.locator(".studio-calendar-panel").evaluate(node => getComputedStyle(node).getPropertyValue("--cal-zoom"));
  const grid = (await page.locator(".studio-month-grid").boundingBox())!;
  await page.mouse.move(grid.x + grid.width / 2, Math.max(300, Math.min(650, grid.y + 60))); await page.keyboard.down("Control");
  await page.mouse.wheel(0, -180); await page.keyboard.up("Control"); await settle(page);
  const after = await page.locator(".studio-calendar-panel").evaluate(node => getComputedStyle(node).getPropertyValue("--cal-zoom")); expect(after).not.toBe(before);
  const sample = await snapshot(page, "calendar-zoomed"); expect(sample.home).not.toBeNull();
  expect([...sample.calendar, ...sample.dateAndEvents].reduce((sum, rect) => sum + area(sample.home!, rect), 0)).toBe(0);
  expect(await home(page).locator(".vc-home-room").evaluate(node => node.getBoundingClientRect().height)).toBeCloseTo(132, 0);
  for (const button of await home(page).locator("button:not([data-panel-section-toggle])").all()) { const r = (await button.boundingBox())!; expect(r.width).toBeGreaterThanOrEqual(44); expect(r.height).toBeGreaterThanOrEqual(44); }
});
test("studio2560 shell zoom0.8 retains the same132px room and44px controls after the rail closes", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 }); await setup(page, "studio");
  await expect(page.locator(".studio-shell")).toHaveCSS("zoom", "0.8"); await expect(home(page)).toBeVisible();
  await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settle(page);
  assertLauncherClear(await snapshot(page, "scaled-shell-panel-closed")); await openShelf(page);
  await expect(page.locator(".vc-home-shelf-slot")).toHaveCount(1);
  expect(await page.locator(".vc-home-shelf-slot").evaluate(node => getComputedStyle(node).zoom)).toBe("1.25");
});

async function dragFood(page: Page, item: Locator) {
  const source = (await item.boundingBox())!;
  const target = await home(page).evaluate(node => { const bed = node.querySelector(".vc-plush-bed")!.getBoundingClientRect(), floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(); return { x: bed.left + bed.width / 2, y: floor.bottom - 3 }; });
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 16 }); await page.waitForTimeout(100); await page.mouse.up(); await page.mouse.move(1, 1);
  await expect(item).not.toHaveAttribute("data-falling"); await expect(item).not.toHaveJSProperty("hidden", true);
}
async function assertResident(page: Page, item: Locator) {
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(async () => { const sample = await snapshot(page, "resident-contact"); return sample.pet && sample.bed && sample.foreground ? Math.max(Math.abs(sample.bed.left - sample.foreground.left), Math.abs(sample.bed.top - sample.foreground.top), Math.abs(sample.bed.width - sample.foreground.width), Math.abs(sample.bed.height - sample.foreground.height)) : Infinity; }).toBeLessThan(1);
  const sample = await snapshot(page, "resident-stable"); expect(sample.frontVisible).toBe(true); expect(["seat", "back"]).toContain(sample.depth); expect(sample.localFrontOpacity).toBe(0); expect(sample.pets).toBe(1);
  expect(await home(page).locator(".vc-home-room").evaluate(node => node.getBoundingClientRect().height)).toBeCloseTo(132, 0);
  await expect.poll(async () => {
    const floor = await home(page).locator(".vc-home-floor").boundingBox();
    const y = await item.evaluate(node => new DOMMatrixReadOnly((node as HTMLElement).style.transform).m42);
    return floor ? Math.abs(y - (floor.y + floor.height - COMPANION_HOME_FLOOR_INSET)) : Infinity;
  }).toBeLessThan(2);
}
for (const surface of ["viewer", "studio"] as const) test(`${surface} shelf resident, floor snack and sofa foreground follow native resize and scroll together`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); assertLauncherClear(await setup(page, surface)); await openShelf(page);
  const identity = (await pet(page).elementHandle())!;
  await home(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click(); const food = page.locator(".vc-food"); await expect(food).toHaveCount(1); await dragFood(page, food);
  // Place on the actual nearby floor before recall, rather than waiting for
  // an unrelated random starting position to cross the entire calendar.
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  // Native focus may scroll an offscreen actor into view. Return using the
  // browser's own key and only then measure the actual placement destination.
  await page.keyboard.press("Control+Home"); await settle(page); await expect(home(page)).toBeVisible();
  const point = await home(page).evaluate((node, inset) => { const bed = node.querySelector(".vc-plush-bed")!.getBoundingClientRect(), floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(); return { x: bed.left + bed.width / 2, y: floor.bottom - inset - 8 }; }, COMPANION_HOME_FLOOR_INSET);
  await page.mouse.click(point.x, point.y);
  await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  // Placement retains the actor's keyboard focus. Finish that preparation at
  // the real page top, then hit the exposed sofa directly: locator.click's
  // auto-scroll must not become an unintended part of the resident scenario.
  await snapshot(page, "floor-placement-complete"); await page.keyboard.press("Control+Home"); await settle(page);
  const sofa = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  const recallPoint = await sofa.evaluate(node => {
    const r = node.getBoundingClientRect(), room = node.closest(".vc-home")!.getBoundingClientRect();
    // The real92px resident covers the centre of this138px sofa. Use its
    // exposed edge, just as a pointer user can, without clicking through it.
    const exposed = [.1, .5, .9].flatMap(v => [.05, .15, .5, .85, .95].map(u => ({ x: r.left + r.width * u, y: r.top + r.height * v })))
      .find(point => { const hit = document.elementFromPoint(point.x, point.y); return hit === node || node.contains(hit); });
    return { exposed, top: room.top, bottom: room.bottom, viewportHeight: innerHeight };
  });
  await snapshot(page, "before-native-sofa-recall");
  expect(recallPoint.top).toBeGreaterThanOrEqual(0); expect(recallPoint.bottom).toBeLessThanOrEqual(recallPoint.viewportHeight);
  expect(recallPoint.exposed, "an actual exposed sofa point must exist before the native recall").toBeDefined();
  await page.mouse.click(recallPoint.exposed!.x, recallPoint.exposed!.y); await assertResident(page, food);
  await page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).homeShelfProbe;
    // Scroll registers the product's coalesced follower after this observer's
    // already-pending rAF. Read in the following task, after all callbacks in
    // that rendering update, rather than midway through its DOM commits.
    const tick = () => { if (probe.stopped) return; setTimeout(() => { if (!probe.stopped) probe.frames.push(probe.sample()); }, 0); probe.raf = requestAnimationFrame(tick); };
    probe.raf = requestAnimationFrame(tick);
  });
  await page.setViewportSize({ width: 1480, height: 760 }); await settle(page); await assertResident(page, food);
  const before = await snapshot(page, "before-native-scroll");
  await page.mouse.move(1000, 650); await page.mouse.wheel(0, 96); await settle(page);
  const scrolled = await snapshot(page, "after-native-scroll");
  expect(scrolled.scrollY, "the real document, not an injected spacer, must actually scroll").toBeGreaterThan(before.scrollY + 20);
  await assertResident(page, food); expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
  await page.mouse.wheel(0, -120); await settle(page); await assertResident(page, food);
  const frames = await page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).homeShelfProbe; cancelAnimationFrame(probe.raf); return probe.frames;
  });
  expect(frames.length).toBeGreaterThan(10); expect(frames.every(frame => frame.pets === 1 && frame.houses === 1)).toBe(true);
  const registered = frames.filter(frame => frame.bed && ["back", "seat"].includes(frame.depth));
  expect(registered.length).toBeGreaterThan(10);
  expect(registered.every(frame => frame.foreground && frame.frontVisible && frame.localFrontOpacity === 0 && Math.max(Math.abs(frame.bed!.left - frame.foreground.left), Math.abs(frame.bed!.top - frame.foreground.top), Math.abs(frame.bed!.width - frame.foreground.width), Math.abs(frame.bed!.height - frame.foreground.height)) < 1), "the resident has exactly one aligned foreground throughout actual resize/scroll frames").toBe(true);
});
test("an ordinary settings modal makes the shelf inert without reopening a closed house", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); assertLauncherClear(await setup(page, "viewer", true)); await openShelf(page);
  await page.locator("[data-act='viewer-settings']:visible,[data-act='open-settings']:visible").click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await expect(dialog).toBeVisible();
  expect(await page.locator(".vc-home").evaluate(node => Boolean(node.closest("[inert]")) || node.hasAttribute("inert"))).toBe(true);
  const feed = page.locator(".vc-home .vc-dispenser");
  expect(await feed.evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit === node || node.contains(hit); })).toBe(false);
  await dialog.locator(".modal-head .modal-close").click(); await expect(dialog).toHaveCount(0); await settle(page); await expect(home(page)).toBeVisible();
  await closeShelf(page); await page.locator("[data-act='viewer-settings']:visible,[data-act='open-settings']:visible").click(); await expect(dialog).toBeVisible();
  await dialog.locator(".modal-head .modal-close").click(); await expect(dialog).toHaveCount(0); await settle(page);
  await expect(home(page)).not.toBeVisible(); assertLauncherClear(await snapshot(page, "closed-after-modal"));
});

test("studio deep-scroll visits restore their original position on X and Escape, while a later native wheel wins", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 }); await setup(page, "studio");
  // Real200% calendar zoom creates a naturally long document in this compact
  // PC viewport. No spacer, page style or synthetic scroll position is added.
  const grid = (await page.locator(".studio-month-grid").boundingBox())!;
  await page.mouse.move(grid.x + grid.width / 2, grid.y + 70); await page.keyboard.down("Control");
  for (let step = 0; step < 4; step++) { await page.mouse.wheel(0, -180); await page.waitForTimeout(260); }
  await page.keyboard.up("Control"); await settle(page);
  expect(await page.locator(".studio-calendar-panel").evaluate(node => Number(getComputedStyle(node).getPropertyValue("--cal-zoom")))).toBe(2);
  await page.mouse.move(640, 620); await page.mouse.wheel(0, 900); await settle(page);
  const departure = await snapshot(page, "deep-studio-departure"); expect(departure.scrollY).toBeGreaterThan(300);
  // Scrolling naturally takes calendar content behind the opaque sticky
  // header. Its launcher must remain an actual exposed native hit target.
  expect(await launcher(page).evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit === node || node.contains(hit); })).toBe(true);
  const monthLabel = page.locator(".studio-month-label .month-title-btn"), month = await monthLabel.textContent();
  for (const close of ["X", "Escape"] as const) {
    const before = await snapshot(page, `before-${close}-visit`); await openShelf(page, close === "Escape" ? "keyboard" : "pointer");
    const arrived = await snapshot(page, `arrived-${close}-visit`);
    expect(before.scrollY - arrived.scrollY, "visiting the real in-flow shelf must have actually scrolled away from the deep calendar").toBeGreaterThan(200);
    if (close === "X") await closeShelf(page);
    else { await page.keyboard.press("Escape"); await expect(home(page)).not.toBeVisible(); await expect(launcher(page)).toBeFocused(); await settle(page); }
    const restored = await snapshot(page, `restored-${close}-visit`); expect(Math.abs(restored.scrollY - before.scrollY)).toBeLessThan(2);
    expect(await monthLabel.textContent()).toBe(month);
  }
  const beforeWheelVisit = await snapshot(page, "before-user-wheel-visit"); await openShelf(page);
  const arrived = await snapshot(page, "before-user-wheel");
  await page.mouse.move(640, 500); await page.mouse.wheel(0, 72); await settle(page);
  const chosen = await snapshot(page, "user-wheel-position"); expect(chosen.scrollY - arrived.scrollY).toBeGreaterThan(20);
  await closeShelf(page); const after = await snapshot(page, "closed-after-user-wheel");
  expect(beforeWheelVisit.scrollY - after.scrollY, "a user's later wheel cancels the temporary visit's automatic return").toBeGreaterThan(150);
  expect(await monthLabel.textContent()).toBe(month);
});

test("a saved house disclosure survives shelf visits and rail sides while a closed wrapper reserves zero layout", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, "viewer"); await expect(home(page)).toBeVisible();
  const heading = () => home(page).getByRole("button", { name: "빅타민 집", exact: true });
  await heading().click(); await expect(heading()).toHaveAttribute("aria-expanded", "false"); await expect(home(page).locator(".vc-home-room")).not.toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem("vic.panelSections"));
  expect(JSON.parse(saved!)["companion-home"]).toBe(false);
  await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settle(page);
  const hiddenWrapper = page.locator(".vc-compact-home"), shelf = page.locator(".vc-home-shelf-slot");
  const empty = async (phase: string) => {
    await expect(hiddenWrapper).toHaveAttribute("hidden", "");
    expect(await hiddenWrapper.evaluate(node => { const r = node.getBoundingClientRect(); return { width: r.width, height: r.height }; })).toEqual({ width: 0, height: 0 });
    expect(await shelf.evaluate(node => node.getBoundingClientRect().height)).toBe(0);
    await snapshot(page, phase);
  };
  await empty("folded-house-closed-wrapper");
  for (const visit of [1, 2]) {
    await launcher(page).click(); await expect(home(page)).toBeVisible(); await settle(page);
    await expect(heading()).toHaveAttribute("aria-expanded", "false"); await expect(home(page).locator(".vc-home-room")).not.toBeVisible();
    expect((await home(page).boundingBox())!.height).toBeLessThan(100);
    expect(await page.evaluate(() => localStorage.getItem("vic.panelSections"))).toBe(saved);
    await closeShelf(page); await empty(`folded-house-visit-${visit}-closed`);
  }
  await page.getByRole("button", { name: "패널 펼치기", exact: true }).click(); await settle(page);
  for (const side of ["right", "left"] as const) {
    await page.getByRole("button", { name: side === "right" ? "패널을 오른쪽에 두기" : "패널을 왼쪽에 두기", exact: true }).click(); await settle(page);
    await expect(page.locator(`.avatar-${side} .vc-home`)).toBeVisible(); await expect(heading()).toHaveAttribute("aria-expanded", "false");
    expect(await page.evaluate(() => localStorage.getItem("vic.panelSections"))).toBe(saved);
    await expect(home(page)).toHaveCount(1); await expect(pet(page)).toHaveCount(1);
  }
  await heading().click(); await expect(heading()).toHaveAttribute("aria-expanded", "true"); await expect(home(page).locator(".vc-home-room")).toBeVisible();
  expect(await home(page).locator(".vc-home-room").evaluate(node => node.getBoundingClientRect().height)).toBeCloseTo(132, 0);
});

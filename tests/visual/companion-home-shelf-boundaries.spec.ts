import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Input = { type: string; trusted: boolean; key: string; x: number; y: number };
type Sample = {
  phase: string; at: number; viewport: { width: number; height: number }; scrollY: number;
  launcher: Rect | null; house: Rect | null; room: Rect | null; controls: Rect[]; calendars: Rect[];
  houses: number; pets: number; originalPet: boolean; inRail: boolean; inShelf: boolean;
  panelOpen: boolean; panelCollapsedChoice: string | null;
};
type Probe = { inputs: Input[]; frames: Sample[]; phase: string; stopped: boolean; frame: number; sample: () => Sample; input: (event: Event) => void };
type ProbeWindow = Window & { homeBoundaryProbe: Probe };
type Evidence = { writes: string[]; errors: string[]; samples: Sample[] };
const evidence = new WeakMap<Page, Evidence>();
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const launcher = (page: Page) => page.locator(".vc-home-launcher");
const area = (a: Rect, b: Rect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

test.use({ isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  test.setTimeout(35_000);
  const proof: Evidence = { writes: [], errors: [], samples: [] }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    // Public fixture GETs only. Every mutation is stopped before reaching an
    // application server; these two cases never require a studio action.
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      proof.writes.push(`${request.method()} ${path}`);
      return route.fulfill({ status: 503, body: "fixture forbids writes" });
    }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    if (/\/api\/public\/[^/]+\/search\/trending$/.test(path)) return route.fulfill({ json: { trends: [] } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const build = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const folder = `.scratch-pw/097-home-shelf-boundaries/${build}`;
  const label = info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 125); mkdirSync(folder, { recursive: true });
  const live = await page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).homeBoundaryProbe;
    if (!probe) return null;
    probe.stopped = true; cancelAnimationFrame(probe.frame);
    for (const type of ["pointerdown", "pointerup", "keydown", "wheel"]) document.removeEventListener(type, probe.input, true);
    return { inputs: probe.inputs, frames: probe.frames, focus: document.hasFocus(), visibility: document.visibilityState };
  }).catch(error => ({ observationError: String(error) }));
  writeFileSync(`${folder}/${label}.json`, JSON.stringify({ build, title: info.title, status: info.status, ...evidence.get(page), live }, null, 2));
  await page.screenshot({ path: `${folder}/${label}.png`, fullPage: true }).catch(() => {});
  expect(evidence.get(page)?.writes).toEqual([]); expect(evidence.get(page)?.errors).toEqual([]);
  if (live && "inputs" in live) expect(live.inputs.every(input => input.trusted), "all product interactions must use native trusted input").toBe(true);
});

async function setup(page: Page, quietDark: boolean) {
  await page.addInitScript(({ epoch, key, preferences, care, quietDark }) => {
    // Seed saved preferences/care only. No focus, clock, RNG, application
    // callback, geometry or animation-state replacement is allowed.
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": quietDark ? "on" : "off", "vic.gfxPref": "max", "vic.reduceMotion": quietDark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: true, feeding: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: 1 }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, quietDark });
  await page.goto("/visual-fixture/poster?avatar=1&signedIn=0"); await page.bringToFront();
  await expect(page.locator(".vc-companion .vc-actor")).toBeVisible();
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-atlas", "hd");
  await settle(page);
  await page.evaluate(() => {
    const originalPet = document.querySelector(".vc-companion");
    const rect = (node: Element): Rect => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const visible = (node: Element) => {
      const r = node.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
      for (let parent: Element | null = node; parent; parent = parent.parentElement) {
        const css = getComputedStyle(parent);
        if (parent.hasAttribute("hidden") || css.display === "none" || css.visibility === "hidden" || Number(css.opacity) <= .01) return false;
      }
      return true;
    };
    const probe: Probe = { inputs: [], frames: [], phase: "ready", stopped: false, frame: 0, sample: () => { throw new Error("probe not initialized"); }, input: () => {} };
    probe.sample = () => {
      const l = document.querySelector(".vc-home-launcher"), h = document.querySelector(".vc-home"), room = h?.querySelector(".vc-home-room");
      return {
        phase: probe.phase, at: performance.now(), viewport: { width: innerWidth, height: innerHeight }, scrollY,
        launcher: l && visible(l) ? rect(l) : null, house: h && visible(h) ? rect(h) : null, room: room && visible(room) ? rect(room) : null,
        controls: h ? [...h.querySelectorAll("button:not([data-panel-section-toggle])")].filter(visible).map(rect) : [],
        calendars: [...document.querySelectorAll(".public-month-grid,.public-day,.public-event,.d-num")].filter(visible).map(rect),
        houses: document.querySelectorAll(".vc-home").length, pets: document.querySelectorAll(".vc-companion").length,
        originalPet: originalPet === document.querySelector(".vc-companion") && Boolean(originalPet?.isConnected),
        inRail: Boolean(h?.closest(".avatar-slot")), inShelf: Boolean(h?.closest(".vc-home-shelf-slot")),
        panelOpen: Boolean(document.querySelector(".poster-page.panel-open")), panelCollapsedChoice: localStorage.getItem("vic_panel_collapsed")
      };
    };
    probe.input = event => { const pointer = event as PointerEvent; probe.inputs.push({ type: event.type, trusted: event.isTrusted, key: event instanceof KeyboardEvent ? event.key : "", x: pointer.clientX ?? 0, y: pointer.clientY ?? 0 }); };
    for (const type of ["pointerdown", "pointerup", "keydown", "wheel"]) document.addEventListener(type, probe.input, true);
    const tick = () => { if (probe.stopped) return; if (probe.frames.length < 2400) probe.frames.push(probe.sample()); probe.frame = requestAnimationFrame(tick); };
    (window as unknown as ProbeWindow).homeBoundaryProbe = probe; probe.frame = requestAnimationFrame(tick);
  });
}
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  await page.waitForTimeout(180); // Existing finite geometry delivery, never a mocked clock.
}
async function sample(page: Page, phase: string) {
  const result = await page.evaluate(phase => { const p = (window as unknown as ProbeWindow).homeBoundaryProbe; p.phase = phase; return p.sample(); }, phase);
  evidence.get(page)!.samples.push(result); return result;
}
function assertClear(sample: Sample, opened: boolean) {
  expect(sample.calendars.length, "an actual rendered calendar is required for physical overlap checks").toBeGreaterThan(0);
  expect(sample.launcher).not.toBeNull();
  expect(sample.calendars.reduce((sum, rect) => sum + area(sample.launcher!, rect), 0), "the launcher must remain outside every calendar/date/event rectangle").toBe(0);
  expect(sample.launcher!.width).toBeGreaterThanOrEqual(44); expect(sample.launcher!.height).toBeGreaterThanOrEqual(44);
  expect(sample.launcher!.left).toBeGreaterThanOrEqual(0); expect(sample.launcher!.right).toBeLessThanOrEqual(sample.viewport.width);
  expect(sample.launcher!.top).toBeGreaterThanOrEqual(0); expect(sample.launcher!.bottom).toBeLessThanOrEqual(sample.viewport.height);
  if (opened) {
    expect(sample.house).not.toBeNull(); expect(sample.room).not.toBeNull();
    expect(sample.calendars.reduce((sum, rect) => sum + area(sample.house!, rect), 0), "the open shelf must reserve document space instead of covering a date").toBe(0);
    expect(sample.room!.height).toBeCloseTo(132, 0);
    expect(sample.house!.left).toBeGreaterThanOrEqual(0); expect(sample.house!.right).toBeLessThanOrEqual(sample.viewport.width + 1);
    expect(sample.house!.top).toBeGreaterThanOrEqual(0); expect(sample.house!.bottom).toBeLessThanOrEqual(sample.viewport.height + 1);
    expect(sample.controls.length).toBeGreaterThanOrEqual(3);
    for (const rect of sample.controls) {
      expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
      expect(rect.left).toBeGreaterThanOrEqual(0); expect(rect.right).toBeLessThanOrEqual(sample.viewport.width + 1);
      expect(rect.top).toBeGreaterThanOrEqual(0); expect(rect.bottom).toBeLessThanOrEqual(sample.viewport.height + 1);
    }
    expect(sample.houses).toBe(1); expect(sample.inShelf).toBe(true);
  }
  expect(sample.pets).toBe(1); expect(sample.originalPet).toBe(true);
}

test("viewer1060x480 dark reduced-motion keeps a full-size clear shelf and native close target", async ({ page }) => {
  await page.setViewportSize({ width: 1060, height: 480 }); await setup(page, true);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");
  assertClear(await sample(page, "short-quiet-closed"), false);
  await launcher(page).click(); await expect(home(page)).toBeVisible(); await settle(page);
  assertClear(await sample(page, "short-quiet-open"), true);
  await home(page).getByRole("button", { name: "빅타민 집 닫기", exact: true }).click();
  await expect(home(page)).toHaveCount(0); await expect(launcher(page)).toBeFocused(); await settle(page);
  await expect(launcher(page)).toHaveAttribute("aria-expanded", "false"); assertClear(await sample(page, "short-quiet-native-x-closed"), false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("viewer1679 to1680 to1679 transfers one house and preserves the same pet without saving a collapse", async ({ page }) => {
  await page.setViewportSize({ width: 1679, height: 1000 }); await setup(page, false);
  assertClear(await sample(page, "boundary1679-closed"), false);
  await launcher(page).click(); await expect(home(page)).toBeVisible(); await settle(page);
  assertClear(await sample(page, "boundary1679-open"), true);
  await page.setViewportSize({ width: 1680, height: 1000 });
  await expect(page.locator(".poster-page")).toHaveClass(/panel-open/); await expect(page.locator(".avatar-slot .vc-home")).toBeVisible(); await settle(page);
  const rail = await sample(page, "boundary1680-rail");
  expect(rail.inRail).toBe(true); expect(rail.inShelf).toBe(false); expect(rail.houses).toBe(1); expect(rail.pets).toBe(1); expect(rail.originalPet).toBe(true);
  expect(rail.panelCollapsedChoice).toBeNull(); await expect(launcher(page)).toHaveCount(0);
  await page.setViewportSize({ width: 1679, height: 1000 });
  await expect(page.locator(".poster-page")).toHaveClass(/panel-closed/); await expect(page.locator(".vc-home-shelf-slot .vc-home")).toBeVisible(); await settle(page);
  const returned = await sample(page, "boundary1679-returned"); assertClear(returned, true); expect(returned.panelCollapsedChoice).toBeNull();
  const frames = await page.evaluate(() => (window as unknown as ProbeWindow).homeBoundaryProbe.frames);
  expect(frames.length).toBeGreaterThan(4);
  expect(frames.every(frame => frame.pets === 1 && frame.originalPet && frame.houses <= 1), "native breakpoint changes may not duplicate the pet or room, or replace the pet DOM").toBe(true);
});

import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

type Surface = "viewer" | "studio" | "preview";
type Rect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
type Input = { type: string; trusted: boolean; key: string; x: number; y: number; at: number };
type Frame = {
  phase: string; at: number; scrollY: number; viewport: { width: number; height: number };
  calendar: Rect; launcher: Rect | null; room: Rect | null; bed: Rect | null; front: Rect | null;
  pet: Rect | null; platform: string; depth: string; localClothPaint: number; count: number; homes: number;
  foods: { x: number; y: number; hidden: boolean; falling: boolean }[];
  diagnostic?: { hidden: boolean; reason: string; presence: string; state: string; transform: string; atlas: string; focused: boolean; documentHidden: boolean; hiddenPoint: string; spans: string; lost: string; seeded: string; images: { src: string; complete: boolean; width: number }[] } | null;
};
type Probe = { phase: string; frames: Frame[]; inputs: Input[]; input: (event: Event) => void; sample: () => Frame; stopped: boolean; running: boolean; raf: number; task: number };
type ProbeWindow = Window & { compactContinuity: Probe };
type Proof = { writes: string[]; errors: string[]; reads: number; samples: Frame[]; entryChecks: unknown[] };
const evidence = new WeakMap<Page, Proof>();
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const launcher = (page: Page) => page.locator(".vc-home-launcher");
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const wrapper = (page: Page) => page.locator(".vc-compact-home");
const delta = (a: Rect, b: Rect) => Math.max(...(["left", "top", "width", "height"] as const).map(key => Math.abs(a[key] - b[key])));
const prefix = ".scratch-pw/098-compact-continuity";

test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  test.setTimeout(35_000);
  const proof: Proof = { writes: [], errors: [], reads: 0, samples: [], entryChecks: [] }; evidence.set(page, proof);
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const reads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/visual-fixture/studio" && reads.has(request.headers()["next-action"])) {
      proof.reads++; return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const buildId = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), path = `${prefix}/${buildId}`;
  mkdirSync(path, { recursive: true }); const label = info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 132);
  const probe = await page.evaluate(() => {
    const p = (window as unknown as ProbeWindow).compactContinuity; if (!p) return null;
    p.stopped = true; cancelAnimationFrame(p.raf); clearTimeout(p.task);
    for (const type of ["pointerdown", "pointerup", "keydown", "wheel"]) document.removeEventListener(type, p.input, true);
    return { frames: p.frames, inputs: p.inputs, final: p.sample(), lostGeometry: document.querySelector<HTMLElement>(".vc-companion")?.dataset.lostGeometry ?? "", preferences: localStorage.getItem("vic.viewerCompanion"), focused: document.hasFocus(), visibility: document.visibilityState };
  }).catch(error => ({ error: String(error) }));
  writeFileSync(`${path}/${label}.json`, JSON.stringify({ buildId, title: info.title, status: info.status, ...evidence.get(page), probe }, null, 2));
  await page.screenshot({ path: `${path}/${label}.png`, fullPage: true }).catch(() => {});
  expect(evidence.get(page)?.writes).toEqual([]); expect(evidence.get(page)?.errors).toEqual([]);
  if (probe && "inputs" in probe) expect(probe.inputs.every(input => input.trusted)).toBe(true);
});

async function seed(page: Page, dark = false, reduced = false) {
  await page.addInitScript(({ epoch, key, preferences, care, dark, reduced }) => {
    // Existing device choices only. No random source, clock, native focus,
    // geometry, application callback or action state is supplied by this test.
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": dark ? "on" : "off", "vic.reduceMotion": reduced ? "on" : "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: true, feeding: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: 1 }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, dark, reduced });
}
async function settle(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await page.waitForTimeout(180);
}
async function setup(page: Page, surface: Surface, options: { signedIn?: boolean; dark?: boolean; reduced?: boolean } = {}) {
  await seed(page, options.dark, options.reduced);
  await page.goto(surface === "viewer" ? `/visual-fixture/poster?signedIn=${options.signedIn ? "1" : "0"}` : "/visual-fixture/studio?role=owner");
  await page.bringToFront(); await settle(page); await installProbe(page);
  await sample(page, "before-initial-visible");
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  if (surface === "preview") { await page.getByRole("button", { name: "시청자 화면 보여주기", exact: true }).click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); expect(evidence.get(page)?.reads).toBe(1); await settle(page); }
  await installProbe(page);
  await waitForCalendarStability(page);
  if (await launcher(page).isVisible() && !await home(page).isVisible()) await assertClosedEntry(page);
  return sample(page, "ready");
}
async function installProbe(page: Page) {
  await page.evaluate(() => {
    const rect = (node: Element): Rect => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const visible = (node: Element | null): boolean => {
      if (!node) return false; const r = node.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false;
      for (let p: Element | null = node; p; p = p.parentElement) { const s = getComputedStyle(p); if (p.hasAttribute("hidden") || s.display === "none" || ["hidden", "collapse"].includes(s.visibility) || Number(s.opacity) <= .01) return false; } return true;
    };
    const active = document.querySelector(".viewer-fullscreen .poster-page") ?? document.querySelector(".poster-page,.studio-shell")!, calendar = active.querySelector(".public-month-grid,.studio-month-grid")!;
    const p: Probe = { phase: "ready", frames: [], inputs: [], input: () => {}, sample: () => { throw new Error("uninitialized"); }, stopped: false, running: false, raf: 0, task: 0 };
    p.sample = () => {
      const l = document.querySelector(".vc-home-launcher"), h = document.querySelector(".vc-home"), b = h?.querySelector(".vc-plush-bed") ?? null, f = document.querySelector(".vc-bed-foreground"), pet = document.querySelector<HTMLElement>(".vc-companion");
      let paint = 1; const local = h?.querySelector(".vc-bed-local-front"); if (!local) paint = 0;
      for (let node: Element | null = local ?? null; node; node = node.parentElement) { const s = getComputedStyle(node); paint *= Number(s.opacity); if (node.hasAttribute("hidden") || s.display === "none" || ["hidden", "collapse"].includes(s.visibility)) paint = 0; }
      return { phase: p.phase, at: performance.now(), scrollY, viewport: { width: innerWidth, height: innerHeight }, calendar: rect(calendar), launcher: l && visible(l) ? rect(l) : null, room: h && visible(h) ? rect(h) : null,
        bed: b && visible(b) ? rect(b) : null, front: f && visible(f) ? rect(f) : null, pet: pet && visible(pet) ? rect(pet) : null,
        platform: pet?.dataset.platform ?? "", depth: pet?.dataset.sofaDepth ?? "", localClothPaint: paint, count: document.querySelectorAll(".vc-companion").length, homes: document.querySelectorAll(".vc-home").length,
        foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(node => { const m = new DOMMatrixReadOnly(node.style.transform); return { x: m.m41, y: m.m42, hidden: node.hidden, falling: node.hasAttribute("data-falling") }; }),
        diagnostic: pet ? { hidden: pet.hidden, reason: pet.dataset.hiddenReason ?? "", presence: pet.dataset.presence ?? "", state: pet.dataset.state ?? "", transform: pet.style.transform, atlas: pet.dataset.atlas ?? "", focused: document.hasFocus(), documentHidden: document.hidden, hiddenPoint: pet.dataset.hiddenPoint ?? "", spans: pet.dataset.hiddenSpans ?? "", lost: pet.dataset.lostSupport ?? "", seeded: pet.dataset.seeded ?? "", images: [...pet.querySelectorAll("img")].map(n => ({ src: n.getAttribute("src") ?? "", complete: n.complete, width: n.naturalWidth })) } : null };
    };
    p.input = event => { const e = event as PointerEvent; p.inputs.push({ type: e.type, trusted: e.isTrusted, key: event instanceof KeyboardEvent ? event.key : "", x: e.clientX ?? 0, y: e.clientY ?? 0, at: performance.now() }); };
    for (const type of ["pointerdown", "pointerup", "keydown", "wheel"]) document.addEventListener(type, p.input, true);
    (window as unknown as ProbeWindow).compactContinuity = p;
  });
}
async function sample(page: Page, phase: string) {
  const frame = await page.evaluate(async phase => {
    const p = (window as unknown as ProbeWindow).compactContinuity; p.phase = phase;
    // Read after the frame's callbacks AND their following task, not from an
    // earlier rAF observer that races the runtime's foreground writer.
    return new Promise<Frame>(resolve => requestAnimationFrame(() => setTimeout(() => resolve(p.sample()), 0)));
  }, phase); evidence.get(page)!.samples.push(frame); return frame;
}
async function waitForCalendarStability(page: Page) {
  let baseline: Frame | undefined;
  // Fonts/WAAPI completion does not establish that the calendar's JS intro
  // fit has settled. Prove one real300ms window before the home input; keep
  // the subsequent1px calendar/scroll outcome assertions unchanged.
  await expect.poll(async () => {
    const frame = await sample(page, "calendar-stability-precondition");
    if (!baseline || delta(baseline.calendar, frame.calendar) > .05 || Math.abs(baseline.scrollY - frame.scrollY) > .05) baseline = frame;
    return frame.at - baseline.at;
  }, { timeout: 6000, intervals: [50], message: "PRECONDITION: actual calendar bounds and scroll must remain within0.05px for300ms before opening" }).toBeGreaterThanOrEqual(300);
}
async function assertClosedEntry(page: Page) {
  const proof = await launcher(page).evaluate(node => {
    const rect = (element: Element): Rect => { const r = element.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const shown = (element: Element) => {
      for (let p: Element | null = element; p; p = p.parentElement) { const s = getComputedStyle(p); if (p.hasAttribute("hidden") || s.display === "none" || ["hidden", "collapse"].includes(s.visibility) || Number(s.opacity) <= .01) return false; }
      const r = element.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    };
    const root = document.querySelector(".viewer-fullscreen .poster-page") ?? document.querySelector(".poster-page,.studio-shell")!, header = node.closest(".studio-topbar,.public-calendar-header,.agenda-header");
    // A sticky header owns its opaque chrome region while real calendar
    // content scrolls behind it. Compare against the visible calendar below
    // that header, rather than treating the entire scrolled grid BCR as ink.
    const headerRect = header?.getBoundingClientRect(), position = header ? getComputedStyle(header).position : "";
    const clipTop = headerRect && ["sticky", "fixed"].includes(position) && headerRect.top <= 1 ? Math.max(0, headerRect.bottom) : 0;
    const clip = (r: Rect): Rect => ({ ...r, left: Math.max(0, r.left), right: Math.min(innerWidth, r.right), top: Math.max(clipTop, r.top), bottom: Math.min(innerHeight, r.bottom) });
    const calendars = [...root.querySelectorAll(".public-month-grid,.studio-month-grid,.public-day,.studio-day,.public-event,.studio-event-pill,.d-num,.studio-day-head")].filter(shown).map(rect).map(clip).filter(r => r.right > r.left && r.bottom > r.top);
    const chrome = [...root.querySelectorAll(".public-calendar-header :is(button,a,h1),.studio-topbar :is(button,a,h1),.agenda-header :is(button,a,h1)")].filter(element => element !== node && !element.contains(node) && shown(element)).map(rect);
    const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const own = rect(node), id = node.getAttribute("aria-controls"), targets = id ? [...document.querySelectorAll(`#${CSS.escape(id)}`)] : [], target = targets[0];
    return { launcher: own, viewport: { width: innerWidth, height: innerHeight }, clipTop, calendars, chrome, calendarOverlap: calendars.reduce((sum, r) => sum + overlap(own, r), 0), chromeOverlap: chrome.reduce((sum, r) => sum + overlap(own, r), 0),
      id, count: targets.length, targetIsRoom: Boolean(target?.classList.contains("vc-compact-home")), targetHidden: target instanceof HTMLElement && target.hidden, expanded: node.getAttribute("aria-expanded") };
  });
  evidence.get(page)!.entryChecks.push(proof);
  expect(proof.calendars.length, "the closed entry check requires an actual visible calendar").toBeGreaterThan(0);
  expect(proof.calendarOverlap, "the closed home launcher leaves dates and schedules clear").toBe(0);
  expect(proof.chromeOverlap, "the closed home launcher leaves other real header controls and titles clear").toBe(0);
  expect(proof.launcher.width).toBeGreaterThanOrEqual(44); expect(proof.launcher.height).toBeGreaterThanOrEqual(44);
  expect(proof.launcher.left).toBeGreaterThanOrEqual(0); expect(proof.launcher.right).toBeLessThanOrEqual(proof.viewport.width);
  expect(proof.launcher.top).toBeGreaterThanOrEqual(0); expect(proof.launcher.bottom).toBeLessThanOrEqual(proof.viewport.height);
  expect(proof.id).toBeTruthy(); expect(proof.count, "aria-controls resolves to exactly one retained wrapper").toBe(1);
  expect(proof.targetIsRoom).toBe(true); expect(proof.targetHidden).toBe(true); expect(proof.expanded).toBe("false");
}
async function open(page: Page, keyboard = false) {
  await waitForCalendarStability(page);
  await assertClosedEntry(page);
  const before = await sample(page, "before-open");
  if (keyboard) { await launcher(page).focus(); await launcher(page).press("Enter"); } else await launcher(page).click();
  await expect(home(page)).toBeVisible(); await settle(page); const after = await sample(page, "opened");
  // First physical assertion deliberately precedes every new fixed/portal
  // marker:097's198px page-flow row must fail here on the actual calendar.
  expect(delta(before.calendar, after.calendar), "opening the home must not move or resize the real calendar").toBeLessThan(1);
  expect(Math.abs(before.scrollY - after.scrollY), "opening the home never scrolls its reader").toBeLessThan(1);
  await assertCompact(page, after); return after;
}
async function assertCompact(page: Page, frame: Frame) {
  expect(frame.room).not.toBeNull(); const room = frame.room!;
  expect(room.left).toBeGreaterThanOrEqual(11); expect(room.right).toBeLessThanOrEqual(frame.viewport.width - 11);
  expect(room.top).toBeGreaterThanOrEqual(11); expect(room.bottom).toBeLessThanOrEqual(frame.viewport.height - 11);
  expect(frame.homes).toBe(1); expect(frame.count).toBe(1);
  expect(room.width).toBeGreaterThanOrEqual(299); expect(room.width).toBeLessThanOrEqual(381); expect(room.height).toBeCloseTo(186, 0);
  if (frame.launcher && frame.launcher.bottom > 0 && frame.launcher.top < frame.viewport.height) {
    const expectedX = Math.max(12, Math.min(frame.launcher.left, frame.viewport.width - 12 - room.width));
    const below = frame.launcher.bottom + 8, above = frame.launcher.top - room.height - 8;
    const preferredY = below + room.height > frame.viewport.height - 12 && above >= 12 ? above : below;
    const expectedY = Math.max(12, Math.min(preferredY, frame.viewport.height - 12 - room.height));
    expect(Math.abs(room.left - expectedX)).toBeLessThan(1); expect(Math.abs(room.top - expectedY)).toBeLessThan(1);
  }
  expect(await wrapper(page).evaluate(node => node.parentElement === document.body)).toBe(true); await expect(wrapper(page)).toHaveCSS("position", "fixed");
  expect(await page.locator(".vc-home-shelf-slot").evaluate(node => node.getBoundingClientRect().height)).toBe(0);
  await expect(launcher(page)).toHaveAttribute("aria-expanded", "true");
  expect(await launcher(page).evaluate(node => { const id = node.getAttribute("aria-controls"), target = id ? document.getElementById(id) : null; return Boolean(target && !target.hidden && target.contains(document.querySelector(".vc-home"))); })).toBe(true);
  const controls = await home(page).evaluate(node => ({ roomHeight: node.querySelector(".vc-home-room")!.getBoundingClientRect().height, controls: [...node.querySelectorAll<HTMLElement>("button:not([data-panel-section-toggle])")].map(button => { const r = button.getBoundingClientRect(); return { width: r.width, height: r.height }; }) }));
  expect(controls.roomHeight).toBeCloseTo(132, 0); for (const c of controls.controls) { expect(c.width).toBeGreaterThanOrEqual(44); expect(c.height).toBeGreaterThanOrEqual(44); }
}
async function close(page: Page, keyboard = false) {
  const before = await sample(page, "before-close");
  if (keyboard) await page.keyboard.press("Escape"); else await home(page).getByRole("button", { name: "빅타민 집 닫기", exact: true }).click();
  await expect(home(page)).not.toBeVisible(); await expect(launcher(page)).toBeFocused(); await settle(page); const after = await sample(page, "closed");
  expect(delta(before.calendar, after.calendar)).toBeLessThan(1); expect(Math.abs(before.scrollY - after.scrollY)).toBeLessThan(1);
  await expect(launcher(page)).toHaveAttribute("aria-expanded", "false");
  await assertClosedEntry(page);
}

test("viewer1280 anonymous opening preserves every calendar bound and scroll position", async ({ page }) => {
  await setup(page, "viewer"); await open(page);
  const build = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  mkdirSync(`${prefix}/${build}`, { recursive: true });
  await page.screenshot({ path: `${prefix}/${build}/floating-open-viewer1280.png` });
  await close(page);
});
test("viewer1480 signed-in keyboard Enter and Escape preserve the calendar and focus", async ({ page }) => {
  await page.setViewportSize({ width: 1480, height: 938 }); await setup(page, "viewer", { signedIn: true }); await open(page, true);
  await expect(home(page).getByRole("button", { name: "빅타민 집 닫기", exact: true })).toBeFocused(); await close(page, true);
});
test("studio1280 native calendar zoom remains independent of the floating home", async ({ page }) => {
  await setup(page, "studio"); const grid = await sample(page, "before-zoom"); await page.mouse.move(grid.calendar.left + grid.calendar.width / 2, grid.calendar.top + 65);
  await page.keyboard.down("Control"); await page.mouse.wheel(0, -180); await page.keyboard.up("Control"); await settle(page);
  expect(await page.locator(".studio-calendar-panel").evaluate(node => Number(getComputedStyle(node).getPropertyValue("--cal-zoom")))).toBeGreaterThan(1);
  await open(page); await close(page);
  await page.mouse.move(900, 600); await page.mouse.wheel(0, 250); await settle(page);
  const deep = await sample(page, "native-scroll-before-keyboard-open"); expect(deep.scrollY).toBeGreaterThan(20);
  await open(page, true);
  await page.mouse.move(900, 500); await page.mouse.wheel(0, -32); await settle(page);
  const selected = await sample(page, "user-selected-scroll-with-house-open"); expect(deep.scrollY - selected.scrollY).toBeGreaterThan(10);
  await close(page, true); expect(Math.abs((await sample(page, "no-restored-scroll")).scrollY - selected.scrollY)).toBeLessThan(1);
});
test("preview1480 uses the same public snapshot and unmoving calendar bounds", async ({ page }) => {
  await page.setViewportSize({ width: 1480, height: 938 }); await setup(page, "preview"); await open(page); await close(page, true);
  await expect(page.locator("[data-export-surface] .vc-home,[data-export-surface] .vc-home-launcher")).toHaveCount(0);
});
test("short1060 dark reduced-motion keeps the full-size room inside the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1060, height: 480 }); await setup(page, "viewer", { dark: true, reduced: true });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark"); await expect(page.locator("html")).toHaveAttribute("data-reduce-motion");
  await open(page, true); await close(page, true);
});
test("studio2560 shell zoom0.8 leaves the body-portal room and its targets unscaled", async ({ page }) => {
  await page.setViewportSize({ width: 2560, height: 1440 }); await setup(page, "studio"); await expect(page.locator(".studio-shell")).toHaveCSS("zoom", "0.8");
  await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settle(page); await open(page);
  expect(await wrapper(page).evaluate(node => getComputedStyle(node).zoom)).toBe("1"); await close(page);
});

test("the1680 boundary and rail sides retain one creature and the saved disclosure", async ({ page }) => {
  await page.setViewportSize({ width: 1679, height: 900 }); await setup(page, "viewer"); await open(page);
  const identity = (await pet(page).elementHandle())!, preferences = await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"));
  await expect(home(page).locator("[data-panel-section-toggle]")).toHaveCount(0);
  await page.setViewportSize({ width: 1680, height: 900 }); await settle(page); await expect(page.locator(".avatar-left .vc-home")).toBeVisible();
  await home(page).getByRole("button", { name: "빅타민 집", exact: true }).click(); await expect(home(page)).toHaveAttribute("data-panel-collapsed", "");
  const folded = await page.evaluate(() => localStorage.getItem("vic.panelSections"));
  await expect(home(page)).toHaveAttribute("data-panel-collapsed", "");
  await page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true }).click(); await settle(page); await expect(page.locator(".avatar-right .vc-home")).toBeVisible();
  await page.setViewportSize({ width: 1679, height: 900 }); await settle(page); await expect(launcher(page)).toBeVisible();
  if (!await home(page).isVisible()) await launcher(page).click();
  await expect(home(page)).toBeVisible(); await expect(home(page)).not.toHaveAttribute("data-panel-collapsed");
  await expect(home(page).locator("[data-panel-section-toggle]")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("vic.panelSections"))).toBe(folded);
  expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"))).toBe(preferences);
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
  await expect(home(page)).toHaveCount(1); await expect(pet(page)).toHaveCount(1);
  await expect(wrapper(page)).toHaveCSS("position", "fixed");
});

async function prepareResident(page: Page) {
  await home(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click(); const food = page.locator(".vc-food"); await expect(food).toHaveCount(1);
  const source = (await food.boundingBox())!, target = await home(page).evaluate(node => { const bed = node.querySelector(".vc-plush-bed")!.getBoundingClientRect(), floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(); return { x: bed.left + bed.width / 2, y: floor.bottom - 3 }; });
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 15 }); await page.waitForTimeout(100); await page.mouse.up();
  await expect(food).not.toHaveAttribute("data-falling");
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.keyboard.press("Control+Home"); await settle(page);
  const point = await home(page).evaluate((node, inset) => { const bed = node.querySelector(".vc-plush-bed")!.getBoundingClientRect(), floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(); return { x: bed.left + bed.width / 2, y: floor.bottom - inset - 8 }; }, COMPANION_HOME_FLOOR_INSET);
  await page.mouse.click(point.x, point.y); await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await page.keyboard.press("Control+Home"); await settle(page);
  const sofa = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }); await sofa.focus(); await sofa.press("Enter");
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  return food;
}
async function assertContact(page: Page, phase: string) {
  const frame = await sample(page, phase); expect(frame.platform).toBe("companion-home"); expect(["back", "seat"]).toContain(frame.depth);
  expect(frame.front).not.toBeNull(); expect(frame.bed).not.toBeNull(); expect(delta(frame.front!, frame.bed!)).toBeLessThan(1); expect(frame.localClothPaint).toBe(0);
  const floor = await home(page).locator(".vc-home-floor").boundingBox();
  expect(frame.foods).toHaveLength(1); expect(frame.foods[0].hidden).toBe(false); expect(frame.foods[0].falling).toBe(false);
  expect(Math.abs(frame.foods[0].y - (floor!.y + floor!.height - COMPANION_HOME_FLOOR_INSET))).toBeLessThan(2);
  await assertCompact(page, frame); return frame;
}
async function capturePostFrameTasks(page: Page, running: boolean) {
  return page.evaluate(running => {
    const p = (window as unknown as ProbeWindow).compactContinuity;
    p.running = running;
    if (!running) { cancelAnimationFrame(p.raf); clearTimeout(p.task); return p.frames; }
    const tick = () => { p.raf = requestAnimationFrame(() => { p.task = window.setTimeout(() => { if (p.stopped || !p.running) return; p.frames.push(p.sample()); tick(); }, 0); }); };
    tick(); return p.frames;
  }, running);
}
for (const surface of ["viewer", "studio"] as const) test(`${surface} resident, snack and cloth share the actual fixed room through native wheel and resize`, async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 480 }); await setup(page, surface); await open(page); const identity = (await pet(page).elementHandle())!;
  await prepareResident(page); const before = await assertContact(page, "resident-before-scroll"); await capturePostFrameTasks(page, true);
  await page.mouse.move(1000, 400); await page.mouse.wheel(0, 96); await settle(page);
  const scrolled = await assertContact(page, "resident-after-native-wheel"); expect(scrolled.scrollY).toBeGreaterThan(before.scrollY + 20);
  await page.setViewportSize({ width: 1480, height: 520 }); await settle(page); await assertContact(page, "resident-after-resize");
  await page.mouse.move(1000, 430); await page.mouse.wheel(0, -120); await settle(page); await assertContact(page, "resident-after-wheel-return");
  const frames = await capturePostFrameTasks(page, false); expect(frames.length).toBeGreaterThan(10);
  expect(frames.every(frame => frame.count === 1 && frame.homes === 1 && frame.pet && frame.room)).toBe(true);
  const contacts = frames.filter(frame => ["back", "seat"].includes(frame.depth)); expect(contacts.length).toBeGreaterThan(10);
  expect(contacts.every(frame => frame.bed && frame.front && delta(frame.bed, frame.front) < 1 && frame.localClothPaint === 0), "all post-rAF task observations retain one registered cloth without a ghost copy").toBe(true);
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
});

test("settings keeps the open compact room inert and never reopens an explicitly closed one", async ({ page }) => {
  await setup(page, "viewer"); await open(page); const before = await sample(page, "before-settings");
  const gear = page.locator("[data-act='open-settings']:visible"); await gear.click(); const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await expect(dialog).toBeVisible();
  await expect(wrapper(page)).toHaveAttribute("inert", "");
  expect(await wrapper(page).locator(".vc-dispenser").evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit === node || node.contains(hit); })).toBe(false);
  await dialog.locator(".modal-head .modal-close").click(); await expect(dialog).toHaveCount(0); await settle(page);
  expect(delta(before.calendar, (await sample(page, "settings-closed")).calendar)).toBeLessThan(1); await expect(home(page)).toBeVisible(); await close(page);
  await gear.click(); await expect(dialog).toBeVisible(); await dialog.locator(".modal-head .modal-close").click(); await expect(dialog).toHaveCount(0); await settle(page); await expect(home(page)).not.toBeVisible();
});

test("compact premiere group5 ownership withdraws the room and recovers its controls after Escape", async ({ page }) => {
  test.setTimeout(40_000); await seed(page); await page.addInitScript(() => localStorage.setItem("vic.premiereStage", "on"));
  await page.goto("/visual-fixture/poster?premiere=172&count=1"); await page.bringToFront(); await expect(actor(page)).toBeVisible(); await settle(page); await installProbe(page); await open(page);
  const identity = (await wrapper(page).elementHandle())!, preferences = await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"));
  await expect(wrapper(page)).toHaveAttribute("data-pm-exit", "5");
  await expect(wrapper(page)).toHaveAttribute("inert", "", { timeout: 15_000 }); await expect(launcher(page)).toHaveAttribute("inert", "");
  await expect.poll(() => wrapper(page).evaluate(node => Number(getComputedStyle(node).opacity)), { timeout: 20_000, intervals: [250] }).toBeLessThan(.02);
  await page.keyboard.press("Escape"); await expect(page.locator(".pm-stage")).not.toBeVisible(); await settle(page);
  await expect(wrapper(page)).not.toHaveAttribute("inert"); await expect(launcher(page)).not.toHaveAttribute("inert");
  await assertCompact(page, await sample(page, "premiere-escape-return"));
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-compact-home"))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"))).toBe(preferences);
});

test("a native studio build-copy label reflow moves its open room with the launcher and back", async ({ page }) => {
  await setup(page, "studio"); await open(page);
  const copy = page.locator(".studio-left .studio-build-copy"), originalLabel = (await copy.textContent())!.trim();
  const originalWidth = (await copy.boundingBox())!.width, before = await sample(page, "before-native-build-copy");
  await copy.click();
  // Exercise the real secure-context clipboard gesture and its1.4s product
  // confirmation. A blocked clipboard is a missing native precondition;
  // never replace writeText or set the copied flag to manufacture reflow.
  await expect(copy).toHaveText("복사됨 ✓");
  expect(Math.abs((await copy.boundingBox())!.width - originalWidth), "PRECONDITION: the actual sibling label must change its rendered width").toBeGreaterThan(1);
  await expect.poll(async () => {
    const frame = await sample(page, "copied-label-anchor-follow");
    return frame.room && frame.launcher ? Math.abs(frame.room.left - Math.max(12, Math.min(frame.launcher.left, frame.viewport.width - 12 - frame.room.width))) : Infinity;
  }, { timeout: 900, intervals: [16] }).toBeLessThan(1);
  const copied = await sample(page, "copied-label-stable");
  expect(Math.abs(copied.launcher!.left - before.launcher!.left), "the launcher must really move despite retaining its own dimensions").toBeGreaterThan(1);
  expect(Math.abs(copied.launcher!.width - before.launcher!.width)).toBeLessThan(1);
  expect(delta(copied.calendar, before.calendar)).toBeLessThan(1); expect(copied.scrollY).toBe(before.scrollY);
  await expect(copy).toHaveText(originalLabel, { timeout: 2500 });
  await expect.poll(async () => {
    const frame = await sample(page, "restored-label-anchor-follow");
    // Clicking the sibling also leaves the launcher's native hover, moving
    // its top by1px. Its original x/size must return; current y must follow
    // the actual current anchor, checked below rather than the old hover.
    return frame.room && before.room ? Math.max(Math.abs(frame.room.left - before.room.left), Math.abs(frame.room.width - before.room.width), Math.abs(frame.room.height - before.room.height)) : Infinity;
  }, { timeout: 1000, intervals: [16] }).toBeLessThan(1);
  const restored = await sample(page, "restored-label-stable");
  await assertCompact(page, restored);
  expect(delta(restored.calendar, before.calendar)).toBeLessThan(1); expect(restored.scrollY).toBe(before.scrollY);
  await close(page);
});

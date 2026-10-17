import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { PANEL_SECTION_PREFERENCES_KEY } from "@/lib/ui/panel-section-preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_PREFERENCES_KEY, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

type Navigation = "entry" | "reload";
type Mode = "normal" | "reduced" | "off";
type Rect = { x: number; y: number; width: number; height: number };
type RoomSample = {
  at: number; reason: string; room: Rect; window: Rect; shelf: Rect; roomHeight: string;
  roomPosition: string; windowPosition: string; shelfPosition: string; background: string;
  skyFill: string; bedStop: string; ribFill: string; stemFill: string; warnings: string[];
};
type InputSample = { type: string; trusted: boolean; key: string; at: number };
type Probe = {
  samples: RoomSample[]; inputs: InputSample[]; seeded: boolean; raf: number; stopped: boolean;
  observer: MutationObserver; input: (event: Event) => void;
};
type ProbeWindow = Window & { homeReadinessProbe: Probe };
type Gate = { navigation: Navigation; url: string; began: number; released: number; delay: number };
type Cue = { opacity: number; background: string; cueBackground: string; transform: string; transitionDuration: string; scale: number; hover: boolean; focusVisible: boolean; active: boolean; button: Rect; bed: Rect; cushion: Rect };
const output = ".scratch-pw/094-home-readiness";
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const cushion = (page: Page) => home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });

async function installProbe(page: Page, name: string, dark: boolean, mode: Mode) {
  await page.addInitScript(({ name, dark, mode, epoch, epochKey, preferenceKey, panelKey, preferences, care }) => {
    // Seed once per tab. A real reload must retain the saved ON/open choices;
    // no random source, focus, clock, product callback or DOM is replaced.
    const marker = `test.homeReadiness.${name}`, seeded = sessionStorage.getItem(marker) !== "1";
    if (seeded) {
      for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.dark": dark ? "on" : "off", "vic.gfxPref": mode === "off" ? "off" : "max", "vic.reduceMotion": mode === "reduced" ? "on" : "off", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
      localStorage.setItem(preferenceKey, JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: false, feeding: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: .9 }));
      localStorage.setItem(panelKey, JSON.stringify({ version: 1, "companion-home": true, season: true, "tag-filter": true }));
      localStorage.removeItem("vic_panel_collapsed"); sessionStorage.setItem(marker, "1");
    }
    const probe: Probe = { samples: [], inputs: [], seeded, raf: 0, stopped: false, observer: new MutationObserver(() => {}), input: () => {} };
    (window as unknown as ProbeWindow).homeReadinessProbe = probe;
    const rect = (node: Element): Rect => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const visible = (node: HTMLElement) => {
      const r = node.getBoundingClientRect();
      if (!node.getClientRects().length || r.width <= 0 || r.height <= 0 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) return false;
      for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
      }
      return true;
    };
    const black = (value: string) => ["black", "rgb(0, 0, 0)", "rgba(0, 0, 0, 1)", "color(srgb 0 0 0)"].includes(value);
    const inspect = (reason: string) => {
      if (probe.stopped) return;
      for (const house of document.querySelectorAll<HTMLElement>(".vc-home")) {
        if (!visible(house)) continue;
        const room = house.querySelector<HTMLElement>(".vc-home-room"), windowArt = house.querySelector<SVGSVGElement>(".vc-home-window"), shelf = house.querySelector<SVGSVGElement>(".vc-home-shelf");
        if (!room || !windowArt || !shelf || !visible(room)) continue;
        const roomStyle = getComputedStyle(room), windowStyle = getComputedStyle(windowArt), shelfStyle = getComputedStyle(shelf);
        const fill = (selector: string, property = "fill") => { const node = house.querySelector(selector); return node ? getComputedStyle(node).getPropertyValue(property) : "missing"; };
        const sample: RoomSample = { at: performance.now(), reason, room: rect(room), window: rect(windowArt), shelf: rect(shelf), roomHeight: roomStyle.height, roomPosition: roomStyle.position, windowPosition: windowStyle.position, shelfPosition: shelfStyle.position, background: roomStyle.backgroundImage, skyFill: fill(".vc-window-sky"), bedStop: fill(".vc-plush-bed stop", "stop-color"), ribFill: fill(".vc-bed-back-ribs"), stemFill: fill(".vc-shelf-stem"), warnings: [] };
        const warn = (valid: boolean, detail: string) => { if (!valid) sample.warnings.push(detail); };
        warn(Math.abs(parseFloat(roomStyle.height) - 132) < .1, "room height is not132px");
        warn(roomStyle.position === "relative" && windowStyle.position === "absolute" && shelfStyle.position === "absolute", "room object positioning is unstyled");
        warn(Math.abs(parseFloat(windowStyle.width) - 64) < .1 && Math.abs(parseFloat(windowStyle.height) - 56) < .1, "window is not64x56px");
        warn(Math.abs(parseFloat(windowStyle.left) - 20) < .1 && Math.abs(parseFloat(windowStyle.top) - 14) < .1, "window anchor changed");
        warn(Math.abs(parseFloat(shelfStyle.height) - 55) < .1 && Math.abs(parseFloat(shelfStyle.top) - 9) < .1, "shelf size or anchor changed");
        // Studio CSS zoom is real. Compare both resolved CSS dimensions and
        // their common screen scale instead of assuming every surface is1:1.
        const scale = sample.room.height / 132;
        warn(scale > .7 && scale < 1.1 && Math.abs(sample.window.width / scale - 64) < .2 && Math.abs(sample.window.height / scale - 56) < .2 && Math.abs(sample.shelf.height / scale - 55) < .2, "visible SVG bounds are not the styled room geometry");
        warn(sample.background !== "none", "room background is missing");
        warn(sample.skyFill !== "missing" && sample.skyFill !== "none" && !black(sample.skyFill), "window has default black fill");
        warn(sample.bedStop !== "missing" && !black(sample.bedStop), "bed gradient has default black stop");
        warn(sample.ribFill === "none" && sample.stemFill === "none", "stroke-only room art has default fill");
        probe.samples.push(sample);
      }
    };
    probe.input = event => {
      if (!(event.target instanceof Element) || !event.target.closest(".vc-cushion-button")) return;
      probe.inputs.push({ type: event.type, trusted: event.isTrusted, key: event instanceof KeyboardEvent ? event.key : "", at: performance.now() });
    };
    for (const type of ["pointerdown", "pointerup", "keydown", "keyup", "click"]) document.addEventListener(type, probe.input, true);
    probe.observer = new MutationObserver(() => inspect("mutation"));
    probe.observer.observe(document, { childList: true, subtree: true });
    const tick = () => { inspect("raf"); if (!probe.stopped) probe.raf = requestAnimationFrame(tick); };
    probe.raf = requestAnimationFrame(tick);
  }, { name, dark, mode, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferenceKey: COMPANION_PREFERENCES_KEY, panelKey: PANEL_SECTION_PREFERENCES_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE });
}

async function settle(page: Page) {
  await expect(home(page)).toBeVisible(); await expect(home(page)).toHaveCount(1);
  await expect(home(page)).not.toHaveAttribute("data-panel-collapsed");
  await expect.poll(() => home(page).locator(".vc-home-room").evaluate(room => Math.abs(parseFloat(getComputedStyle(room).height) - 132))).toBeLessThan(.01);
  await expect(home(page).locator(".vc-home-window")).toBeVisible();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  await expect.poll(() => page.evaluate(() => (window as unknown as ProbeWindow).homeReadinessProbe.samples.length)).toBeGreaterThan(1);
}

async function readProbe(page: Page, stop = false) {
  return page.evaluate(stop => {
    const probe = (window as unknown as ProbeWindow).homeReadinessProbe;
    if (stop) {
      probe.stopped = true; cancelAnimationFrame(probe.raf); probe.observer.disconnect();
      for (const type of ["pointerdown", "pointerup", "keydown", "keyup", "click"]) document.removeEventListener(type, probe.input, true);
    }
    return { samples: probe.samples, inputs: probe.inputs, seeded: probe.seeded, preferences: localStorage.getItem("vic.viewerCompanion"), panel: localStorage.getItem("vic.panelSections"), theme: document.documentElement.dataset.theme ?? "light", reduced: document.documentElement.hasAttribute("data-reduce-motion"), gfx: document.documentElement.dataset.gfx ?? "full", stylesheets: [...document.styleSheets].map(sheet => sheet.href) };
  }, stop);
}

async function readCue(page: Page): Promise<Cue> {
  return cushion(page).evaluate(button => {
    const cue = button.querySelector<HTMLElement>(".vc-cushion-cue")!, style = getComputedStyle(cue), matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
    const rect = (node: Element): Rect => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return { opacity: Number(style.opacity), background: getComputedStyle(button).backgroundColor, cueBackground: style.backgroundColor, transform: style.transform, transitionDuration: style.transitionDuration, scale: Math.hypot(matrix.a, matrix.b), hover: button.matches(":hover"), focusVisible: button.matches(":focus-visible"), active: button.matches(":active"), button: rect(button), bed: rect(button.querySelector(".vc-plush-bed")!), cushion: rect(button.querySelector(".vc-home-cushion")!) };
  });
}

function stableGeometry(before: Cue, after: Cue) {
  for (const part of ["button", "bed", "cushion"] as const) for (const axis of ["x", "y", "width", "height"] as const) expect(Math.abs(after[part][axis] - before[part][axis]), `${part}.${axis} must not move for an input cue`).toBeLessThanOrEqual(.1);
}

async function nativeCues(page: Page, name: string, mode: Mode) {
  const states: Record<string, Cue> = {};
  const quiet = mode !== "normal";
  const remember = async (name: string) => {
    const state = await readCue(page); states[name] = state;
    if (states.idle) stableGeometry(states.idle, state);
    if (quiet) { expect(state.transform).toBe("none"); expect(state.transitionDuration.split(",").every(duration => parseFloat(duration) === 0)).toBe(true); }
    return state;
  };
  await expect(cushion(page).locator(".vc-cushion-cue")).toHaveCount(1);
  await page.mouse.move(2, 2); await expect.poll(async () => (await readCue(page)).opacity).toBe(0);
  await remember("idle");
  const bounds = (await cushion(page).boundingBox())!, point = { x: bounds.x + bounds.width * .12, y: bounds.y + bounds.height * .35 };
  await page.mouse.move(point.x, point.y);
  await expect.poll(async () => (await readCue(page)).opacity).toBe(1);
  await expect.poll(async () => (await readCue(page)).scale).toBeCloseTo(1, 3);
  expect((await remember("hover")).hover).toBe(true);
  await page.mouse.down();
  try {
    await expect.poll(async () => (await readCue(page)).background).not.toBe(states.hover.background);
    if (!quiet) await expect.poll(async () => (await readCue(page)).scale).toBeLessThan(.999);
    expect((await remember("pointerDown")).active).toBe(true);
    await home(page).screenshot({ path: `${output}/${name}-pointer-down.png` });
  } finally { await page.mouse.up(); }
  await expect.poll(async () => (await readCue(page)).scale).toBeCloseTo(1, 3);
  await expect.poll(async () => (await readCue(page)).background).toBe(states.hover.background);
  await remember("pointerUp");
  // Clicking a native button may retain focus. Tab away establishes keyboard
  // modality, then Shift+Tab returns to this exact button without DOM dispatch.
  await page.mouse.move(2, 2); await page.keyboard.press("Tab");
  await expect(cushion(page)).not.toBeFocused();
  await expect.poll(async () => (await readCue(page)).opacity).toBe(0); await remember("leave");
  await page.keyboard.press("Shift+Tab"); await expect(cushion(page)).toBeFocused();
  await expect.poll(async () => (await readCue(page)).opacity).toBe(1);
  await expect.poll(async () => (await readCue(page)).scale).toBeCloseTo(1, 3);
  expect((await remember("keyboardFocus")).focusVisible).toBe(true);
  await page.keyboard.down("Space");
  try {
    await expect.poll(async () => (await readCue(page)).background).not.toBe(states.keyboardFocus.background);
    if (!quiet) await expect.poll(async () => (await readCue(page)).scale).toBeLessThan(.999);
    expect((await remember("spaceDown")).active).toBe(true);
    await home(page).screenshot({ path: `${output}/${name}-space-down.png` });
  } finally { await page.keyboard.up("Space"); }
  await expect.poll(async () => (await readCue(page)).scale).toBeCloseTo(1, 3);
  await expect.poll(async () => (await readCue(page)).background).toBe(states.keyboardFocus.background); await remember("spaceUp");
  await page.keyboard.press("Tab"); await expect.poll(async () => (await readCue(page)).opacity).toBe(0); await remember("end");
  return states;
}

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
const cases = [
  { surface: "viewer", dark: false, mode: "normal" }, { surface: "viewer", dark: true, mode: "normal" },
  { surface: "studio", dark: false, mode: "normal" }, { surface: "studio", dark: true, mode: "normal" },
  { surface: "viewer", dark: false, mode: "reduced" }, { surface: "studio", dark: true, mode: "off" },
] as const;
for (const { surface, dark, mode } of cases) test(`${surface} ${dark ? "dark" : "light"} ${mode}: delayed home CSS is ready at first visibility and sofa cues keep its anchors`, async ({ page, context }, info) => {
  test.setTimeout(60000);
  const name = `${surface}-${dark ? "dark" : "light"}${mode === "normal" ? "" : `-${mode}`}`, gates: Gate[] = [], writes: string[] = [], errors: string[] = [];
  let navigation: Navigation = "entry", entry: Awaited<ReturnType<typeof readProbe>> | undefined, reloaded: Awaited<ReturnType<typeof readProbe>> | undefined, cues: Awaited<ReturnType<typeof nativeCues>> | undefined;
  mkdirSync(output, { recursive: true }); page.on("pageerror", error => errors.push(error.message));
  // HTTP routing disables the browser HTTP cache. Together with blocked service
  // workers, each genuine reload must fetch and gate the stylesheet again.
  await context.route("**/*", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { writes.push(`${request.method()} ${path}`); await route.fulfill({ status: 503, body: "fixture forbids writes" }); return; }
    if (path === "/api/soop-live") { await route.fulfill({ json: { live: false } }); return; }
    if (request.resourceType() !== "stylesheet") { await route.continue(); return; }
    const response = await route.fetch(), css = await response.text();
    if (css.includes(".vc-home-room") && css.includes(".vc-cushion-button")) {
      const gate: Gate = { navigation, url: request.url(), began: Date.now(), released: 0, delay: 0 }; gates.push(gate);
      await new Promise<void>(resolve => setTimeout(resolve, 1000));
      gate.released = Date.now(); gate.delay = gate.released - gate.began;
    }
    await route.fulfill({ response });
  });
  await installProbe(page, name, dark, mode);
  try {
    await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=developer&y=2025&m=11");
    await settle(page); entry = await readProbe(page, true);
    await home(page).screenshot({ path: `${output}/${name}-entry.png` });
    expect(gates.filter(gate => gate.navigation === "entry").length, "first navigation must really gate home CSS").toBeGreaterThan(0);
    const entryBad = entry.samples.filter(sample => sample.warnings.length > 0);
    expect(entryBad.length, `no visible initial home may be unstyled; first=${entryBad[0] ? `${entryBad[0].at.toFixed(1)}ms ${entryBad[0].warnings.join("; ")}` : "none"}`).toBe(0);
    expect(entry.seeded).toBe(true); expect(entry.theme).toBe(dark ? "dark" : "light");
    navigation = "reload"; await page.reload(); await settle(page);
    await home(page).screenshot({ path: `${output}/${name}-reload.png` });
    expect(gates.filter(gate => gate.navigation === "reload").length, "reload must really gate home CSS rather than reuse cache").toBeGreaterThan(0);
    cues = await nativeCues(page, name, mode); reloaded = await readProbe(page, true);
    const reloadBad = reloaded.samples.filter(sample => sample.warnings.length > 0);
    expect(reloadBad.length, `no visible reloaded home may be unstyled; first=${reloadBad[0] ? `${reloadBad[0].at.toFixed(1)}ms ${reloadBad[0].warnings.join("; ")}` : "none"}`).toBe(0);
    expect(reloaded.seeded).toBe(false); expect(reloaded.preferences).toBe(entry.preferences); expect(reloaded.panel).toBe(entry.panel);
    expect(reloaded.theme).toBe(dark ? "dark" : "light");
    expect(reloaded.reduced).toBe(mode === "reduced"); expect(reloaded.gfx).toBe(mode === "off" ? "off" : "full");
    expect(reloaded.inputs.filter(input => input.type === "click")).toHaveLength(2);
    expect(reloaded.inputs.every(input => input.trusted)).toBe(true);
    expect(gates.every(gate => gate.delay >= 1000)).toBe(true); expect(writes).toEqual([]); expect(errors).toEqual([]);
  } finally {
    if (navigation === "entry" && !entry) entry = await readProbe(page, true).catch(() => undefined);
    if (navigation === "reload" && !reloaded) reloaded = await readProbe(page, true).catch(() => undefined);
    const path = `${output}/${name}.json`;
    writeFileSync(path, JSON.stringify({ buildId: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), surface, dark, mode, stylesheetDelayMs: 1000, serviceWorkers: "block", httpCache: "disabled by routing", gates, entry, reloaded, cues, writes, errors }, null, 2));
    await info.attach("home readiness and native sofa cues", { path, contentType: "application/json" });
  }
});

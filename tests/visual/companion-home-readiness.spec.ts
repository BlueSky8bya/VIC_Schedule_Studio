import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { PANEL_SECTION_PREFERENCES_KEY } from "@/lib/ui/panel-section-preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_PREFERENCES_KEY, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { placeCompanionOnHomeFloor } from "./helpers/companion-home";

type Navigation = "entry" | "reload";
type Mode = "normal" | "reduced" | "off";
type Rect = { x: number; y: number; width: number; height: number };
type RoomSample = {
  at: number; reason: string; room: Rect; window: Rect; shelf: Rect; roomHeight: string;
  roomPosition: string; windowPosition: string; shelfPosition: string; background: string;
  skyFill: string; bedStop: string; ribFill: string; stemFill: string; warnings: string[];
};
type InputSample = { type: string; trusted: boolean; key: string; at: number };
type ForegroundArm = { at: number; hidden: boolean; hovered: boolean; localTarget: string; portalTarget: string; localScale: number; room: Rect; button: Rect; bed: Rect; cushion: Rect };
type ForegroundFrame = {
  at: number; reason: string; localTransform: string; portalTransform: string; localScale: number; portalScale: number;
  localOrigin: string; portalOrigin: string; localTarget: string; portalTarget: string; opacity: number; hovered: boolean;
  room: Rect; button: Rect; bed: Rect; cushion: Rect; portalBed: Rect;
};
type Probe = {
  samples: RoomSample[]; inputs: InputSample[]; seeded: boolean; raf: number; stopped: boolean;
  observer: MutationObserver; input: (event: Event) => void;
  foreground?: ForegroundArm; foregroundFrames: ForegroundFrame[]; foregroundActive: boolean;
  foregroundObserver?: MutationObserver; sampleForeground: (reason: string) => void;
};
type ProbeWindow = Window & { homeReadinessProbe: Probe };
type Gate = { navigation: Navigation; url: string; began: number; released: number; delay: number };
type Feedback = {
  at: number; background: string; shadow: string; outline: string; outlineWidth: number; outlineColor: string; shellZoom: string; screenScale: number; outlineScreenWidth: number; color: string;
  transform: string; portalTransform: string; transformOrigin: string; portalTransformOrigin: string;
  pivot: { x: number; y: number }; portalPivot: { x: number; y: number };
  targetScale: string; portalTargetScale: string;
  transitionDuration: string; portalTransitionDuration: string; scale: number; portalScale: number; pressScale: number;
  weltOpacity: number; portalWeltOpacity: number; portalVisible: boolean; hover: boolean; focusVisible: boolean; active: boolean;
  room: Rect; button: Rect; bed: Rect; cushion: Rect; portalBed: Rect;
};
const output = ".scratch-pw/095-home-readiness";
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const cushion = (page: Page) => home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });

async function installProbe(page: Page, name: string, dark: boolean, mode: Mode, resident: boolean) {
  await page.addInitScript(({ name, dark, mode, resident, epoch, epochKey, preferenceKey, panelKey, preferences, care }) => {
    // Seed once per tab. A real reload must retain the saved ON/open choices;
    // no random source, focus, clock, product callback or DOM is replaced.
    const marker = `test.homeReadiness.${name}`, seeded = sessionStorage.getItem(marker) !== "1";
    if (seeded) {
      for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.dark": dark ? "on" : "off", "vic.gfxPref": mode === "off" ? "off" : "max", "vic.reduceMotion": mode === "reduced" ? "on" : "off", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
      localStorage.setItem(preferenceKey, JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: resident, feeding: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: .9 }));
      localStorage.setItem(panelKey, JSON.stringify({ version: 1, "companion-home": true, season: true, "tag-filter": true }));
      localStorage.removeItem("vic_panel_collapsed"); sessionStorage.setItem(marker, "1");
    }
    const probe: Probe = { samples: [], inputs: [], seeded, raf: 0, stopped: false, observer: new MutationObserver(() => {}), input: () => {}, foregroundFrames: [], foregroundActive: false, sampleForeground: () => {} };
    (window as unknown as ProbeWindow).homeReadinessProbe = probe;
    const rect = (node: Element): Rect => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    probe.sampleForeground = reason => {
      if (!probe.foregroundActive || probe.stopped) return;
      const front = document.querySelector<HTMLElement>(".vc-bed-foreground"), button = document.querySelector<HTMLButtonElement>(".vc-home .vc-cushion-button");
      const art = button?.querySelector<SVGGElement>(".vc-sofa-feedback"), portal = front?.querySelector<SVGGElement>(".vc-sofa-feedback");
      if (!front || !button || !art || !portal || front.hidden || getComputedStyle(front).display === "none") return;
      const portalBed = rect(portal.ownerSVGElement!); if (portalBed.width <= 0 || portalBed.height <= 0) return;
      const localStyle = getComputedStyle(art), portalStyle = getComputedStyle(portal);
      const localMatrix = new DOMMatrixReadOnly(localStyle.transform === "none" ? undefined : localStyle.transform), portalMatrix = new DOMMatrixReadOnly(portalStyle.transform === "none" ? undefined : portalStyle.transform);
      probe.foregroundFrames.push({
        at: performance.now(), reason, localTransform: localStyle.transform, portalTransform: portalStyle.transform, localScale: Math.hypot(localMatrix.a, localMatrix.b), portalScale: Math.hypot(portalMatrix.a, portalMatrix.b),
        localOrigin: localStyle.transformOrigin, portalOrigin: portalStyle.transformOrigin, localTarget: localStyle.getPropertyValue("--vc-sofa-feedback-scale").trim(), portalTarget: portalStyle.getPropertyValue("--vc-sofa-feedback-scale").trim(), opacity: Number(getComputedStyle(front).opacity), hovered: button.matches(":hover"),
        room: rect(button.closest(".vc-home-room")!), button: rect(button), bed: rect(art.ownerSVGElement!), cushion: rect(button.querySelector(".vc-home-cushion")!), portalBed,
      });
    };
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
      probe.sampleForeground(reason);
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
  }, { name, dark, mode, resident, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferenceKey: COMPANION_PREFERENCES_KEY, panelKey: PANEL_SECTION_PREFERENCES_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE });
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
      probe.foregroundActive = false; probe.foregroundObserver?.disconnect();
      for (const type of ["pointerdown", "pointerup", "keydown", "keyup", "click"]) document.removeEventListener(type, probe.input, true);
    }
    return { samples: probe.samples, inputs: probe.inputs, seeded: probe.seeded, foreground: probe.foreground, foregroundFrames: probe.foregroundFrames, preferences: localStorage.getItem("vic.viewerCompanion"), panel: localStorage.getItem("vic.panelSections"), theme: document.documentElement.dataset.theme ?? "light", reduced: document.documentElement.hasAttribute("data-reduce-motion"), gfx: document.documentElement.dataset.gfx ?? "full", stylesheets: [...document.styleSheets].map(sheet => sheet.href) };
  }, stop);
}

async function readFeedback(page: Page): Promise<Feedback> {
  return cushion(page).evaluate(button => {
    const art = button.querySelector<SVGGElement>(".vc-sofa-feedback")!, portal = document.querySelector<SVGGElement>(".vc-bed-foreground .vc-sofa-feedback")!;
    const style = getComputedStyle(art), portalStyle = getComputedStyle(portal), buttonStyle = getComputedStyle(button);
    const matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform), portalMatrix = new DOMMatrixReadOnly(portalStyle.transform === "none" ? undefined : portalStyle.transform);
    const foreground = portal.closest<HTMLElement>(".vc-bed-foreground")!;
    const rect = (node: Element): Rect => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const room = button.closest(".vc-home-room")!, roomRect = rect(room), screenScale = roomRect.height / parseFloat(getComputedStyle(room).height);
    // Hidden SVG groups can retain percentages in resolved styles. Express
    // both origins in their viewBox units, independent of studio CSS zoom.
    const pivot = (node: SVGGElement, origin: string) => {
      const [x, y] = origin.trim().split(/\s+/), box = node.ownerSVGElement!.viewBox.baseVal;
      const axis = (value: string, span: number) => parseFloat(value) * (value.endsWith("%") ? span / 100 : 1);
      return { x: axis(x, box.width), y: axis(y, box.height) };
    };
    return {
      at: performance.now(), background: buttonStyle.backgroundColor, shadow: buttonStyle.boxShadow, outline: buttonStyle.outlineStyle, outlineWidth: parseFloat(buttonStyle.outlineWidth), outlineColor: buttonStyle.outlineColor, shellZoom: getComputedStyle(button.closest(".studio-shell") ?? document.documentElement).getPropertyValue("zoom"), screenScale, outlineScreenWidth: parseFloat(buttonStyle.outlineWidth) * screenScale, color: buttonStyle.color,
      transform: style.transform, portalTransform: portalStyle.transform, transformOrigin: style.transformOrigin, portalTransformOrigin: portalStyle.transformOrigin,
      pivot: pivot(art, style.transformOrigin), portalPivot: pivot(portal, portalStyle.transformOrigin),
      targetScale: style.getPropertyValue("--vc-sofa-feedback-scale").trim(), portalTargetScale: portalStyle.getPropertyValue("--vc-sofa-feedback-scale").trim(),
      transitionDuration: style.transitionDuration, portalTransitionDuration: portalStyle.transitionDuration, scale: Math.hypot(matrix.a, matrix.b), portalScale: Math.hypot(portalMatrix.a, portalMatrix.b), pressScale: parseFloat(style.getPropertyValue("--press-scale")),
      weltOpacity: Number(getComputedStyle(art.querySelector(".vc-bed-front-welt")!).opacity), portalWeltOpacity: Number(getComputedStyle(portal.querySelector(".vc-bed-front-welt")!).opacity),
      portalVisible: !foreground.hidden && getComputedStyle(foreground).display !== "none", hover: button.matches(":hover"), focusVisible: button.matches(":focus-visible"), active: button.matches(":active"),
      room: roomRect, button: rect(button), bed: rect(button.querySelector(".vc-plush-bed")!), cushion: rect(button.querySelector(".vc-home-cushion")!), portalBed: rect(portal.closest("svg")!),
    };
  });
}

async function armForegroundEntry(page: Page) {
  return page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).homeReadinessProbe, button = document.querySelector<HTMLButtonElement>(".vc-home .vc-cushion-button")!;
    const art = button.querySelector<SVGGElement>(".vc-sofa-feedback")!, front = document.querySelector<HTMLElement>(".vc-bed-foreground")!, portal = front.querySelector<SVGGElement>(".vc-sofa-feedback")!;
    const style = getComputedStyle(art), matrix = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
    const rect = (node: Element): Rect => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    probe.foreground = { at: performance.now(), hidden: front.hidden || getComputedStyle(front).display === "none", hovered: button.matches(":hover"), localTarget: style.getPropertyValue("--vc-sofa-feedback-scale").trim(), portalTarget: getComputedStyle(portal).getPropertyValue("--vc-sofa-feedback-scale").trim(), localScale: Math.hypot(matrix.a, matrix.b), room: rect(button.closest(".vc-home-room")!), button: rect(button), bed: rect(art.ownerSVGElement!), cushion: rect(button.querySelector(".vc-home-cushion")!) };
    probe.foregroundFrames = []; probe.foregroundActive = true;
    // The attribute observer sees the first unhide in its mutation microtask;
    // the existing readiness rAF then follows every subsequent visible frame.
    probe.foregroundObserver = new MutationObserver(records => probe.sampleForeground(records.some(record => record.attributeName === "hidden") ? "foreground-visibility-mutation" : "foreground-style-mutation"));
    probe.foregroundObserver.observe(front, { attributes: true, attributeFilter: ["hidden", "style"] });
    return probe.foreground;
  });
}

async function finishForegroundEntry(page: Page) {
  return page.evaluate(async () => {
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    const probe = (window as unknown as ProbeWindow).homeReadinessProbe;
    probe.foregroundActive = false; probe.foregroundObserver?.disconnect();
    return { arm: probe.foreground!, frames: probe.foregroundFrames };
  });
}

function expectForegroundEntry({ arm, frames }: Awaited<ReturnType<typeof finishForegroundEntry>>) {
  expect(arm.hidden).toBe(true); expect(arm.hovered).toBe(true); expect(arm.localTarget).toBe("1.03"); expect(arm.portalTarget).toBe(arm.localTarget); expect(arm.localScale).toBeCloseTo(1.03, 3);
  expect(frames.length, "native recall must expose a real foreground after the hidden hover").toBeGreaterThan(1);
  expect(frames.some(frame => frame.reason === "foreground-visibility-mutation"), "observe the actual first unhide, alongside rendered-frame samples").toBe(true);
  for (const frame of frames) {
    expect(frame.hovered).toBe(true); expect(frame.localTarget).toBe("1.03"); expect(frame.portalTarget).toBe(frame.localTarget);
    expect(frame.localScale).toBeCloseTo(1.03, 3); expect(frame.portalScale, `foreground cannot flash at a stale scale at ${frame.at}ms (${frame.reason})`).toBeCloseTo(frame.localScale, 3);
    expect(frame.portalOrigin).toBe(frame.localOrigin);
    for (const axis of ["x", "y", "width", "height"] as const) expect(Math.abs(frame.portalBed[axis] - frame.bed[axis]), `visible foreground ${axis} must match the local SVG from its first unhide`).toBeLessThanOrEqual(.1);
    for (const part of ["room", "button", "bed", "cushion"] as const) for (const axis of ["x", "y", "width", "height"] as const) expect(Math.abs(frame[part][axis] - arm[part][axis]), `${part}.${axis} must stay fixed through resident entry`).toBeLessThanOrEqual(.1);
  }
}

function stableGeometry(before: Feedback, after: Feedback) {
  for (const part of ["room", "button", "bed", "cushion"] as const) for (const axis of ["x", "y", "width", "height"] as const) expect(Math.abs(after[part][axis] - before[part][axis]), `${part}.${axis} must not move for sofa paint feedback`).toBeLessThanOrEqual(.1);
}

async function nativeCues(page: Page, name: string, mode: Mode, states: Record<string, Feedback>) {
  const quiet = mode !== "normal";
  const remember = async (name: string) => {
    const state = await readFeedback(page); states[name] = state;
    if (states.idle) stableGeometry(states.idle, state);
    expect(state.background).toBe("rgba(0, 0, 0, 0)"); expect(state.shadow).toBe("none");
    expect(state.portalWeltOpacity).toBe(state.weltOpacity); expect(state.portalTargetScale).toBe(state.targetScale);
    for (const axis of ["x", "y"] as const) {
      expect(Number.isFinite(state.pivot[axis])).toBe(true); expect(Number.isFinite(state.portalPivot[axis])).toBe(true);
      expect(state.portalPivot[axis], `local and portal ${axis} pivots must match, including a hidden portal`).toBeCloseTo(state.pivot[axis], 4);
    }
    // A display:none SVG has no rendered bounds and Chromium can report
    // transform:none even with a matching1.03 target. Compare actual matrices
    // whenever the foreground is visible; retain its hidden target and pivot.
    if (state.portalVisible) {
      expect(state.portalScale).toBeCloseTo(state.scale, 3);
      for (const axis of ["x", "y", "width", "height"] as const) expect(Math.abs(state.portalBed[axis] - state.bed[axis]), `resident foreground ${axis} must match the fixed local SVG`).toBeLessThanOrEqual(.1);
    }
    if (quiet) {
      expect(state.transform).toBe("none"); expect(state.portalTransform).toBe("none");
      for (const duration of [state.transitionDuration, state.portalTransitionDuration]) expect(duration.split(",").every(value => parseFloat(value) === 0)).toBe(true);
    }
    return state;
  };
  const settleScale = async (scale: number) => expect.poll(async () => (await readFeedback(page)).scale).toBeCloseTo(quiet ? 1 : scale, 3);
  await expect(cushion(page).locator(".vc-cushion-cue")).toHaveCount(0);
  await expect(cushion(page).locator(".vc-sofa-feedback")).toHaveCount(1); await expect(page.locator(".vc-bed-foreground .vc-sofa-feedback")).toHaveCount(1);
  await page.mouse.move(2, 2);
  if (await cushion(page).evaluate(button => button === document.activeElement)) await page.keyboard.press("Tab");
  await settleScale(1);
  await remember("idle");
  const bounds = (await cushion(page).boundingBox())!, point = { x: bounds.x + bounds.width * .12, y: bounds.y + bounds.height * .35 };
  await page.mouse.move(point.x, point.y);
  await settleScale(1.03);
  const hover = await remember("hover"); expect(hover.hover).toBe(true); expect(hover.outline).toBe("none"); expect(hover.weltOpacity).toBeGreaterThan(states.idle.weltOpacity);
  await page.mouse.down();
  try {
    await settleScale(states.idle.pressScale);
    const pressed = await remember("pointerDown"); expect(pressed.active).toBe(true); expect(pressed.outline).toBe("none"); expect(pressed.weltOpacity).toBeGreaterThan(hover.weltOpacity);
    await home(page).screenshot({ path: `${output}/${name}-pointer-down.png` });
  } finally { await page.mouse.up(); }
  await settleScale(1.03);
  await remember("pointerUp");
  // Clicking a native button may retain focus. Tab away establishes keyboard
  // modality, then Shift+Tab returns to this exact button without DOM dispatch.
  await page.mouse.move(2, 2); await page.keyboard.press("Tab");
  await expect(cushion(page)).not.toBeFocused();
  await settleScale(1); await remember("leave");
  await page.keyboard.press("Shift+Tab"); await expect(cushion(page)).toBeFocused();
  await settleScale(1.03);
  const focused = await remember("keyboardFocus");
  // The authored two-pixel outline is device-pixel snapped under studio zoom.
  // Verify an actual visible ring, retaining both CSS and screen widths.
  expect(focused.focusVisible).toBe(true); expect(focused.outline).toBe("solid");
  expect(focused.outlineWidth).toBeGreaterThan(0); expect(focused.outlineScreenWidth).toBeGreaterThan(0);
  expect(focused.outlineColor).not.toBe("transparent"); expect(focused.outlineColor).not.toMatch(/^(?:rgba\(.*,\s*0(?:\.0+)?\)|.*\/\s*0(?:\.0+)?\))$/);
  expect(focused.color).not.toBe("rgba(0, 0, 0, 0)");
  await page.keyboard.down("Space");
  try {
    await settleScale(states.idle.pressScale);
    expect((await remember("spaceDown")).active).toBe(true);
    await home(page).screenshot({ path: `${output}/${name}-space-down.png` });
  } finally { await page.keyboard.up("Space"); }
  await settleScale(1.03); await remember("spaceUp");
  await page.keyboard.press("Tab"); await settleScale(1); await remember("end");
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
  const resident = surface === "viewer" && !dark && mode === "normal";
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
  await installProbe(page, name, dark, mode, resident);
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
    if (resident) {
      // Hover settles while the real floor resident is outside the sofa. Keep
      // that native pointer in place as keyboard recall exposes the front.
      await placeCompanionOnHomeFloor(page); await expect(page.locator(".vc-bed-foreground")).toBeHidden();
      const bounds = (await cushion(page).boundingBox())!;
      await page.mouse.move(bounds.x + bounds.width * .12, bounds.y + bounds.height * .35);
      await expect.poll(async () => (await readFeedback(page)).scale).toBeCloseTo(1.03, 3);
      await cushion(page).locator(".vc-sofa-feedback").evaluate(async art => { await Promise.allSettled(art.getAnimations().map(animation => animation.finished)); });
      await armForegroundEntry(page); await cushion(page).focus(); await cushion(page).press("Enter");
      await expect(page.locator(".vc-companion")).toHaveAttribute("data-platform", "companion-home", { timeout: 6000 });
      await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", "sleep", { timeout: 6000 });
      await expect(page.locator(".vc-bed-foreground")).toBeVisible();
      expectForegroundEntry(await finishForegroundEntry(page));
    }
    cues = {}; await nativeCues(page, name, mode, cues); reloaded = await readProbe(page, true);
    if (resident) { expect(cues.idle.portalVisible).toBe(true); expect(cues.hover.portalVisible).toBe(true); }
    const reloadBad = reloaded.samples.filter(sample => sample.warnings.length > 0);
    expect(reloadBad.length, `no visible reloaded home may be unstyled; first=${reloadBad[0] ? `${reloadBad[0].at.toFixed(1)}ms ${reloadBad[0].warnings.join("; ")}` : "none"}`).toBe(0);
    expect(reloaded.seeded).toBe(false); expect(reloaded.preferences).toBe(entry.preferences); expect(reloaded.panel).toBe(entry.panel);
    expect(reloaded.theme).toBe(dark ? "dark" : "light");
    expect(reloaded.reduced).toBe(mode === "reduced"); expect(reloaded.gfx).toBe(mode === "off" ? "off" : "full");
    expect(reloaded.inputs.filter(input => input.type === "click" && input.at >= cues!.idle.at)).toHaveLength(2);
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

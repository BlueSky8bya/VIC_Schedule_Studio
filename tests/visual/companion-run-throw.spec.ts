import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FEED_ACTION_BUDGET } from "@/lib/ui/viewer-companion/planner";
import { companionSpriteMetadata, companionSpriteSources } from "@/lib/ui/viewer-companion/sprite-quality";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Mode = "full" | "lite" | "reduced" | "off";
type Point = { x: number; y: number };
type Plane = { left: number; right: number; y: number; kind: string };
type NativeInput = Point & { at: number; type: string; trusted: boolean; id: number; key: string };
type Frame = Point & {
  at: number; marker: string; state: string; platform: string; same: boolean; visible: boolean; decoded: boolean; src: string;
  pose: number; row: number; captured: boolean; focused: boolean; visibility: string; throwPhase: string; vx: string; vy: string;
  goal: string; targetX: number | null; remaining: string; foodGoal: string; episode: string; variant: string; trip: string; play: string; beat: string; journey: string;
  bounds: { left: number; right: number; top: number; bottom: number };
};
type Probe = {
  node: HTMLElement; frames: Frame[]; inputs: NativeInput[]; focus: { at: number; type: string; focused: boolean; visibility: string }[];
  initialSettings: { preferences: string | null; care: string | null; gfx: string; reduced: boolean };
  marker: string; pointerId: number; stopped: boolean; raf: number; observer: MutationObserver;
  input: (event: Event) => void; focusInput: (event: Event) => void;
};
type ProbeWindow = Window & { runThrowProbe?: Probe };
const rootOutput = ".scratch-pw/096-run-throw";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const evidence = new WeakMap<Page, { writes: string[]; errors: string[] }>();

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  test.setTimeout(30000);
  const proof = { writes: [] as string[], errors: [] as string[] }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    if (path === "/" || path === "/studio") return route.fulfill({ status: 200, body: "unused production navigation" });
    return route.continue();
  });
});

async function setup(page: Page, surface: Surface, mode: Mode, running: boolean, hungry: boolean) {
  await page.addInitScript(({ key, epoch, preferences, care, mode, running, hungry }) => {
    // Established saved device choices only. Never replace RNG, clocks, focus,
    // geometry, actions or an application callback to obtain a witness.
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": mode === "lite" ? "lite" : mode === "off" ? "off" : "max", "vic.reduceMotion": mode === "reduced" ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, animalMode: running ? "dog" : "default", personality: "curious", speed: "lively", roam: running, jump: false, sleep: false, feeding: hungry, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: hungry ? .65 : .05, energy: .95 }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, mode, running, hungry });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=developer&y=2025&m=11");
  const session = await page.context().newCDPSession(page);
  await session.send("Emulation.setFocusEmulationEnabled", { enabled: false });
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  await expect.poll(() => page.evaluate(() => ({ gfx: document.documentElement.getAttribute("data-gfx") ?? "full", reduced: document.documentElement.hasAttribute("data-reduce-motion") }))).toEqual({ gfx: mode === "lite" ? "lite" : mode === "off" ? "off" : "full", reduced: mode === "reduced" });
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  return session;
}

async function startProbe(page: Page) {
  await pet(page).evaluate((node, rows) => {
    const el = node as HTMLElement, probe: Probe = { node: el, frames: [], inputs: [], focus: [], initialSettings: { preferences: localStorage.getItem("vic.viewerCompanion"), care: localStorage.getItem("vic.viewerCompanionCare"), gfx: document.documentElement.getAttribute("data-gfx") ?? "full", reduced: document.documentElement.hasAttribute("data-reduce-motion") }, marker: "setup", pointerId: -1, stopped: false, raf: 0, observer: new MutationObserver(() => {}), input: () => {}, focusInput: () => {} };
    const visible = (node: Element | null): boolean => {
      for (let current = node; current; current = current.parentElement) { const css = getComputedStyle(current); if (current.hasAttribute("hidden") || css.display === "none" || ["hidden", "collapse"].includes(css.visibility) || Number(css.opacity || 1) <= .05) return false; }
      return Boolean(node);
    };
    const sample = () => {
      if (probe.stopped) return;
      const rect = el.getBoundingClientRect(), size = parseFloat(el.style.getPropertyValue("--vc-size")), world = new DOMMatrixReadOnly(el.style.transform);
      const sprite = el.querySelector<HTMLElement>(".vc-sprite")!, image = sprite.querySelector<HTMLImageElement>("img");
      const pose = Number(el.dataset.pose), layers = [sprite, ...[".vc-pose", ".vc-contact", ".vc-reaction", ".vc-facing", ".vc-inertia"].map(selector => el.querySelector<HTMLElement>(selector)!)].map(element => getComputedStyle(element));
      const project = (point: Point) => {
        let q = new DOMPoint(point.x, point.y);
        for (const layer of layers) {
          const [ox, oy] = layer.transformOrigin.split(" ").map(parseFloat), matrix = new DOMMatrixReadOnly(layer.transform === "none" ? undefined : layer.transform);
          q = matrix.transformPoint(new DOMPoint(q.x - ox, q.y - oy)); q.x += ox; q.y += oy;
        }
        const scale = rect.width / el.offsetWidth;
        return { x: rect.left + q.x * scale, y: rect.top + q.y * scale };
      };
      const inset = layers[0].clipPath.startsWith("inset(") ? layers[0].clipPath.slice(6, -1).split(/\s+/).slice(0, 4).map(value => parseFloat(value) * (value.endsWith("%") ? size / 100 : 1)) : [0];
      const [t, rr = t, b = t, l = rr] = inset, corners = [project({ x: l, y: t }), project({ x: size - rr, y: t }), project({ x: l, y: size - b }), project({ x: size - rr, y: size - b })];
      probe.frames.push({ at: performance.now(), marker: probe.marker, x: world.m41 + size / 2, y: world.m42 + size, state: el.dataset.state ?? "", platform: el.dataset.platform ?? "", same: el.isConnected && el === document.querySelector(".vc-companion"), visible: visible(image) && visible(el), decoded: Boolean(image?.complete && image.naturalWidth > 0), src: image?.getAttribute("src") ?? "", pose, row: rows.findIndex(row => row.includes(pose)), captured: el.querySelector<HTMLElement>(".vc-actor")!.hasPointerCapture(probe.pointerId), focused: document.hasFocus(), visibility: document.visibilityState, throwPhase: el.dataset.throwPhase ?? "", vx: el.dataset.throwVx ?? "", vy: el.dataset.throwVy ?? "", goal: el.dataset.travelGoal ?? "", targetX: el.dataset.travelTargetX ? Number(el.dataset.travelTargetX) : null, remaining: el.dataset.travelRemaining ?? "", foodGoal: el.dataset.foodGoal ?? "", episode: el.dataset.episodePhase ?? "", variant: el.dataset.episodeVariant ?? "", trip: el.dataset.trip ?? "", play: el.dataset.play ?? "", beat: el.dataset.playBeat ?? "", journey: el.dataset.journey ?? "", bounds: { left: Math.min(...corners.map(point => point.x)), right: Math.max(...corners.map(point => point.x)), top: Math.min(...corners.map(point => point.y)), bottom: Math.max(...corners.map(point => point.y)) } });
    };
    probe.input = event => {
      const pointer = event as PointerEvent;
      if (event.type === "pointerdown" && event.target instanceof Element && event.target.closest(".vc-actor")) probe.pointerId = pointer.pointerId;
      probe.inputs.push({ at: performance.now(), type: event.type, trusted: event.isTrusted, id: pointer.pointerId ?? -1, key: event instanceof KeyboardEvent ? event.key : "", x: pointer.clientX ?? 0, y: pointer.clientY ?? 0 });
    };
    probe.focusInput = event => probe.focus.push({ at: performance.now(), type: event.type, focused: document.hasFocus(), visibility: document.visibilityState });
    for (const type of ["pointerdown", "pointermove", "pointerup", "lostpointercapture", "keydown", "keyup"]) document.addEventListener(type, probe.input, true);
    for (const type of ["focus", "blur"]) window.addEventListener(type, probe.focusInput);
    document.addEventListener("visibilitychange", probe.focusInput);
    probe.observer = new MutationObserver(sample); probe.observer.observe(el, { attributes: true, attributeFilter: ["style", "data-state", "data-pose", "hidden"] });
    const tick = () => { sample(); if (!probe.stopped) probe.raf = requestAnimationFrame(tick); };
    (window as unknown as ProbeWindow).runThrowProbe = probe; probe.raf = requestAnimationFrame(tick);
  }, companionSpriteMetadata.rows);
}

const mark = (page: Page, marker: string) => page.evaluate(marker => { (window as unknown as ProbeWindow).runThrowProbe!.marker = marker; }, marker);
async function readProof(page: Page, stop = false) {
  return page.evaluate(stop => {
    const probe = (window as unknown as ProbeWindow).runThrowProbe;
    if (!probe) return null;
    if (stop) {
      probe.stopped = true; cancelAnimationFrame(probe.raf); probe.observer.disconnect();
      for (const type of ["pointerdown", "pointermove", "pointerup", "lostpointercapture", "keydown", "keyup"]) document.removeEventListener(type, probe.input, true);
      for (const type of ["focus", "blur"]) window.removeEventListener(type, probe.focusInput);
      document.removeEventListener("visibilitychange", probe.focusInput);
    }
    return { frames: probe.frames, inputs: probe.inputs, focus: probe.focus, viewport: { width: innerWidth, height: innerHeight }, initialSettings: probe.initialSettings, preferences: localStorage.getItem("vic.viewerCompanion"), care: localStorage.getItem("vic.viewerCompanionCare"), gfx: document.documentElement.getAttribute("data-gfx") ?? "full", reduced: document.documentElement.hasAttribute("data-reduce-motion") };
  }, stop);
}
type Proof = NonNullable<Awaited<ReturnType<typeof readProof>>>;
async function scenario(page: Page, label: string, surface: Surface, mode: Mode, running: boolean, hungry: boolean, action: (extra: Record<string, unknown>) => Promise<void>) {
  const extra: Record<string, unknown> = {}, buildId = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const output = `${rootOutput}/${buildId}`; mkdirSync(output, { recursive: true });
  let session: Awaited<ReturnType<typeof setup>> | undefined;
  try {
    session = await setup(page, surface, mode, running, hungry); await startProbe(page); await action(extra);
    const proof = (await readProof(page))!;
    expect(proof.preferences, "native interaction must preserve the actual saved companion choices").toBe(proof.initialSettings.preferences);
    expect({ gfx: proof.gfx, reduced: proof.reduced }).toEqual({ gfx: proof.initialSettings.gfx, reduced: proof.initialSettings.reduced });
  }
  finally {
    const proof = await readProof(page, true).catch(error => ({ observationError: String(error) }));
    writeFileSync(`${output}/${label}.json`, JSON.stringify({ buildId, label, surface, mode, ...extra, proof, ...evidence.get(page) }, null, 2));
    await page.screenshot({ path: `${output}/${label}.png` }).catch(() => {}); await session?.detach();
  }
  expect(evidence.get(page)).toEqual({ writes: [], errors: [] });
}

async function scene(page: Page, surface: Surface, floorOnly = false) {
  return page.evaluate(({ surface, floorOnly }) => {
    const root = document.querySelector(surface === "viewer" ? ".poster-page" : ".studio-shell")!, el = document.querySelector<HTMLElement>(".vc-companion")!, size = parseFloat(el.style.getPropertyValue("--vc-size"));
    const visible = (node: Element | null): boolean => !node || !node.hasAttribute("hidden") && getComputedStyle(node).display !== "none" && !["hidden", "collapse"].includes(getComputedStyle(node).visibility) && Number(getComputedStyle(node).opacity || 1) > .05 && visible(node.parentElement);
    const clipping = (node: Element) => {
      const clip = { left: 0, right: innerWidth, top: 0, bottom: innerHeight };
      for (let parent = node.parentElement; parent; parent = parent.parentElement) { const css = getComputedStyle(parent), rect = parent.getBoundingClientRect(); if (/(hidden|clip|auto|scroll)/.test(css.overflowX)) { clip.left = Math.max(clip.left, rect.left); clip.right = Math.min(clip.right, rect.right); } if (/(hidden|clip|auto|scroll)/.test(css.overflowY)) { clip.top = Math.max(clip.top, rect.top); clip.bottom = Math.min(clip.bottom, rect.bottom); } }
      return clip;
    };
    const controls = [...new Set([...root.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role='button']"), ...document.querySelectorAll<HTMLElement>(".vc-home,.vc-home-launcher")])].filter(node => visible(node) && !node.matches(".public-event,.agenda-event,.agenda-item,.public-day,.agenda-day,.studio-day,[data-companion-event='ordinary']") && !node.closest(".vc-companion"));
    const obstacles = controls.map(node => node.getBoundingClientRect());
    if (floorOnly) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), range = document.createRange();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) if (node.parentElement && visible(node.parentElement) && !node.parentElement.closest("script,style,svg,.sr-only,.vc-companion")) { range.selectNodeContents(node); obstacles.push(...range.getClientRects()); }
      range.detach();
    }
    const half = size * .38 + 3, height = size * .76 + 3;
    const planes: Plane[] = [];
    const add = (left: number, right: number, y: number, kind: string) => {
      if (y < size + 3 || y > innerHeight - 12) return;
      let start: number | undefined;
      for (let x = Math.max(left, size / 2 + 4); x <= Math.min(right, innerWidth - size / 2 - 4); x++) {
        const clear = obstacles.every(r => x + half <= r.left || x - half >= r.right || y + 3 <= r.top || y - height >= r.bottom);
        if (clear && start === undefined) start = x;
        if ((!clear || x + 1 > Math.min(right, innerWidth - size / 2 - 4)) && start !== undefined) { if (x - start > 2) planes.push({ left: start, right: clear ? Math.min(right, innerWidth - size / 2 - 4) : x - 1, y, kind }); start = undefined; }
      }
    };
    let floorY = innerHeight - 18;
    for (const bar of root.querySelectorAll<HTMLElement>(".agenda-monthbar")) { const r = bar.getBoundingClientRect(); if (visible(bar) && getComputedStyle(bar).position === "fixed" && r.top >= innerHeight * .65 && r.bottom <= innerHeight + 1) floorY = Math.min(floorY, r.top - 8); }
    add(12, innerWidth - 12, floorY, "floor");
    if (!floorOnly) for (const card of root.querySelectorAll<HTMLElement>(surface === "studio" ? "[data-companion-event='ordinary'][data-eventid]" : ".public-event[data-eventid]:not(.teaser):not(.is-support),.agenda-event[data-eventid]:not(.teaser),.agenda-item[data-eventid]:not(.teaser)")) {
      const r = card.getBoundingClientRect(), clip = clipping(card); if (visible(card) && r.width > 0 && r.height > 0 && r.top > size + 3 && r.top >= clip.top && r.top < clip.bottom) add(Math.max(r.left, clip.left), Math.min(r.right, clip.right), r.top - 3, "card");
    }
    return { planes, size, floorY, width: innerWidth, height: innerHeight };
  }, { surface, floorOnly });
}

async function place(page: Page, point: Point) {
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(point.x, point.y); await page.mouse.move(1870, 200);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(() => pet(page).evaluate((node, point) => { const el = node as HTMLElement, m = new DOMMatrixReadOnly(el.style.transform), size = parseFloat(el.style.getPropertyValue("--vc-size")); return Math.hypot(m.m41 + size / 2 - point.x, m.m42 + size - point.y); }, point)).toBeLessThan(2);
}
async function hold(page: Page, direction: number) {
  const r = (await actor(page).boundingBox())!, start = { x: r.x + r.width / 2, y: r.y + r.height * .4 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  const centre = { x: direction > 0 ? 670 : 1250, y: 610 };
  for (let i = 1; i <= 24; i++) { await page.mouse.move(start.x + (centre.x - start.x) * i / 24, start.y + (centre.y - start.y) * i / 24); await page.waitForTimeout(20); }
  await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.waitForTimeout(180);
  return centre;
}
async function fling(page: Page, centre: Point, direction: number) {
  await mark(page, "fling");
  // Actual native spacing bounds the horizontal/upward input at500/800px/s
  // even on a fast machine. From these central release points the full arc
  // has room before every viewport wall/ceiling; the last move has no rest.
  for (let i = 1; i <= 4; i++) { await page.waitForTimeout(40); await page.mouse.move(centre.x + direction * i * 20, centre.y - i * 32); }
  await mark(page, "release"); await page.mouse.up();
}
function distinct(frames: Frame[]) {
  const result: Frame[] = [];
  for (const frame of frames) { const last = result.at(-1); if (!last || frame.at - last.at > 2 && (Math.abs(frame.x - last.x) > .01 || Math.abs(frame.y - last.y) > .01)) result.push(frame); }
  return result;
}
function assertVisible(proof: Proof, frames: Frame[]) {
  expect(frames.length).toBeGreaterThan(5);
  expect(frames.every(frame => frame.same && frame.visible && frame.decoded)).toBe(true);
  expect(frames.every(frame => frame.focused && frame.visibility === "visible"), "a real focus/visibility loss is not motion evidence").toBe(true);
  expect(proof.inputs.every(input => input.trusted)).toBe(true);
  expect(frames.every(frame => frame.bounds.left >= -1 && frame.bounds.right <= proof.viewport.width + 1 && frame.bounds.top >= -1 && frame.bounds.bottom <= proof.viewport.height + 1), "all registered opaque-body corners remain inside the actual viewport").toBe(true);
}
function assertSupport(frame: Frame, planes: Plane[]) {
  const support = planes.find(plane => Math.abs(frame.y - plane.y) < 2 && frame.x >= plane.left - 1 && frame.x <= plane.right + 1);
  expect(support, "the resting foot must be on an independently measured centre-safe support").toBeDefined();
  expect(frame.platform).toMatch(support!.kind === "floor" ? /^viewport-floor/ : /^card-/);
}
function assertFlight(proof: Proof, planes: Plane[], direction: number, spiral = false) {
  const up = proof.inputs.filter(input => input.type === "pointerup").at(-1)!, after = proof.frames.filter(frame => frame.at >= up.at && frame.marker === "release");
  // Keep this physical assertion first: old D-Zzc drops vertically and must
  // fail for missing flight before any new marker or packet assertion.
  expect(Math.max(0, ...after.map(frame => direction * (frame.x - after[0].x))), "a vigorous native release must travel horizontally after the hand lets go").toBeGreaterThan(45);
  assertVisible(proof, after);
  const path = distinct(after), crossings = path.slice(1).flatMap((frame, i) => frame.y <= path[i].y ? [] : planes.flatMap(plane => {
    if (plane.y < path[i].y - 1 || plane.y > frame.y + 1) return [];
    const p = Math.max(0, Math.min(1, (plane.y - path[i].y) / (frame.y - path[i].y))), x = path[i].x + (frame.x - path[i].x) * p;
    return x >= plane.left && x <= plane.right ? [{ at: path[i].at + (frame.at - path[i].at) * p, x, plane }] : [];
  })).sort((a, b) => a.at - b.at);
  expect(crossings.length, "the actual downward path must hit an independently measured centre-safe plane").toBeGreaterThan(0);
  const first = crossings[0], landed = after.find(frame => frame.at >= first.at - 1 && Math.abs(frame.y - first.plane.y) < 2 && frame.platform !== "")!;
  expect(landed, "the first crossed physical support must become a real contact").toBeDefined();
  assertSupport(landed, [first.plane]);
  expect(Math.abs(landed.x - first.x)).toBeLessThan(12); expect(landed.at - first.at).toBeLessThan(100);
  const contact = after.filter(frame => frame.at >= landed.at && frame.at < landed.at + 150);
  expect(contact.at(-1)!.at - contact[0].at).toBeGreaterThan(100);
  expect(contact.every(frame => Math.abs(frame.y - first.plane.y) < 2 && Math.abs(frame.x - landed.x) < 2 && !frame.captured), "the body must hold its first real contact rather than continue through it").toBe(true);
  expect(contact.some(frame => frame.row === (spiral ? 22 : 6) && frame.throwPhase === "landing"), "real contact owns its landing beat and preserves an earned spiral expression").toBe(true);
  // Jump state also owns the180ms contact beat. Determine flight from the
  // measured contact, rather than mistaking that stationary beat for flight.
  const airborne = distinct(after.filter(frame => frame.at < landed.at && frame.state === "jump"));
  expect(airborne.length).toBeGreaterThan(7); expect(airborne.at(-1)!.at - airborne[0].at).toBeGreaterThan(180);
  const apex = airborne.reduce((best, frame, i) => frame.y < airborne[best].y ? i : best, 0);
  expect(apex).toBeGreaterThan(0); expect(apex).toBeLessThan(airborne.length - 2);
  expect(airborne[0].y - airborne[apex].y, "the throw must rise above its actual released foot before descending").toBeGreaterThan(12);
  const velocity = airborne.slice(1).map((frame, i) => ({ vx: (frame.x - airborne[i].x) / (frame.at - airborne[i].at) * 1000, vy: (frame.y - airborne[i].y) / (frame.at - airborne[i].at) * 1000 }));
  expect(velocity.every(v => direction * v.vx > 5)).toBe(true);
  expect(velocity.some(v => v.vy < -30) && velocity.some(v => v.vy > 30)).toBe(true);
  // Fit observed y(x), independently of the declared velocity/gravity and
  // elapsed-time integration. A line or canned vertical drop cannot fit this
  // positive-curvature trajectory with an interior apex.
  const [a, b, c] = [airborne[0], airborne[Math.floor(airborne.length / 2)], airborne.at(-1)!];
  const ab = b.x - a.x, ac = c.x - a.x, curvature = ((c.y - a.y) / ac - (b.y - a.y) / ab) / (ac - ab), slope = (b.y - a.y) / ab - curvature * ab;
  expect(curvature).toBeGreaterThan(0);
  expect(Math.max(...airborne.map(frame => Math.abs(frame.y - (a.y + slope * (frame.x - a.x) + curvature * (frame.x - a.x) ** 2)))), "actual native coordinates must follow one parabola before first contact").toBeLessThan(4);
  if (spiral) {
    expect(airborne.every(frame => frame.row === 22 && companionSpriteMetadata.rows[22].includes(frame.pose) && frame.pose === airborne[0].pose && frame.src.endsWith(companionSpriteSources(22)[0]) && !frame.captured), "an earned spiral keeps its last actual column throughout the physical flight").toBe(true);
  } else {
    expect(airborne.some(frame => frame.row === 32 && frame.src.endsWith(companionSpriteSources(32)[0])), "actual new airborne drawing must be decoded and adopted").toBe(true);
    expect(airborne.every(frame => frame.row === 32 && !frame.captured)).toBe(true);
    const phaseKeys = { launch: 0, rise: 1, apex: 2, fall: 3 } as const, throwFrames = companionSpriteMetadata.rows[32];
    for (const [phase, group] of Object.entries(phaseKeys)) {
      const observed = airborne.filter(frame => frame.throwPhase === phase);
      expect(observed.length, `actual decoded ${phase} drawing needs native coverage`).toBeGreaterThan(0);
      expect(observed.every(frame => Math.floor(throwFrames.indexOf(frame.pose) / 4) === group), `${phase} must adopt its authored key, rather than freeze the first packet slot`).toBe(true);
    }
  }
  expect(Math.max(...airborne.slice(1).map((frame, i) => frame.at - airborne[i].at)), "missing flight frames cannot prove a continuous arc").toBeLessThanOrEqual(100);
  const moves = proof.inputs.filter(input => input.type === "pointermove" && input.at <= up.at && input.at > up.at - 160);
  expect(moves.length).toBeGreaterThanOrEqual(3);
  const hand = moves.at(-1)!, firstMove = moves[0], span = hand.at - firstMove.at;
  expect(direction * (hand.x - firstMove.x) / span * 1000).toBeGreaterThan(200);
  expect(Math.hypot(hand.x - firstMove.x, hand.y - firstMove.y) / span * 1000, "the actual native gesture must remain vigorous").toBeGreaterThan(350);
}

const throws = [
  { surface: "viewer", mode: "full", direction: 1 }, { surface: "viewer", mode: "lite", direction: -1 },
  { surface: "studio", mode: "full", direction: -1 }, { surface: "studio", mode: "lite", direction: 1 },
] as const;
for (const { surface, mode, direction } of throws) test(`${surface} ${mode}: native timed up-${direction > 0 ? "right" : "left"} fling follows a real arc and first landing`, async ({ page }) => {
  await scenario(page, `${surface}-${mode}-${direction > 0 ? "right" : "left"}`, surface, mode, false, false, async extra => {
    const measured = await scene(page, surface); extra.scene = measured;
    const floor = measured.planes.filter(plane => plane.kind === "floor").sort((a, b) => b.right - b.left - (a.right - a.left))[0];
    expect(floor).toBeDefined(); await place(page, { x: (floor.left + floor.right) / 2, y: floor.y });
    const centre = await hold(page, direction); extra.releaseScene = await scene(page, surface);
    await fling(page, centre, direction); await page.waitForTimeout(3300);
    const proof = (await readProof(page))!; assertFlight(proof, (extra.releaseScene as typeof measured).planes, direction);
  });
});

test("viewer full: a genuinely shaken native fling carries its last spiral through flight and first landing before recovery", async ({ page }) => {
  await scenario(page, "viewer-shaken-throw", "viewer", "full", false, false, async extra => {
    const measured = await scene(page, "viewer"), floor = measured.planes.filter(plane => plane.kind === "floor").sort((a, b) => b.right - b.left - (a.right - a.left))[0]; extra.scene = measured;
    expect(floor).toBeDefined(); await place(page, { x: (floor.left + floor.right) / 2, y: floor.y });
    const centre = await hold(page, 1); let current = centre; await mark(page, "shake-throw");
    for (let stroke = 0; stroke < 4; stroke++) {
      const from = current, to = { x: centre.x + (stroke % 2 ? -90 : 90), y: centre.y };
      for (let step = 1; step <= 3; step++) { await page.mouse.move(from.x + (to.x - from.x) * step / 3, to.y); await page.waitForTimeout(30); }
      current = to;
    }
    await expect(pet(page)).toHaveAttribute("data-held-dizzy", "");
    await expect.poll(() => page.evaluate(() => (window as unknown as ProbeWindow).runThrowProbe!.frames.filter(frame => frame.marker === "shake-throw" && frame.state === "held" && frame.row === 22 && frame.captured).length)).toBeGreaterThan(0);
    extra.releaseScene = await scene(page, "viewer");
    await fling(page, current, 1);
    await expect(pet(page)).toHaveAttribute("data-play", "dizzy", { timeout: 5000 });
    await expect(pet(page)).not.toHaveAttribute("data-play", "dizzy", { timeout: 3000 }); await page.waitForTimeout(250);
    const proof = (await readProof(page))!; assertFlight(proof, (extra.releaseScene as typeof measured).planes, 1, true);
    const up = proof.inputs.filter(input => input.type === "pointerup").at(-1)!, after = proof.frames.filter(frame => frame.marker === "release" && frame.at >= up.at), recover = after.filter(frame => frame.play === "dizzy" && frame.beat === "recover"), dizzy = after.filter(frame => frame.play === "dizzy" && frame.beat === "dizzy");
    expect(dizzy.length).toBeGreaterThan(5); expect(recover.length).toBeGreaterThan(5);
    const retained = after[0].pose, spiral = after.filter(frame => frame.at < recover[0].at);
    expect(spiral.every(frame => frame.row === 22 && frame.pose === retained && frame.src.endsWith(companionSpriteSources(22)[0])), "flight, finite contact and grounded dizziness must retain the last spiral with no normal-eye flash").toBe(true);
    const closed = companionSpriteMetadata.rows[23].slice(0, 12), normal = companionSpriteMetadata.rows[23].at(-1)!;
    expect(recover.every(frame => frame.row === 23 && (closed.includes(frame.pose) || frame.pose === normal))).toBe(true);
    expect(new Set(recover.filter(frame => closed.includes(frame.pose)).map(frame => Math.floor(companionSpriteMetadata.rows[23].indexOf(frame.pose) / 4)))).toEqual(new Set([0, 1, 2]));
    expect(recover.at(-1)!.pose).toBe(normal); expect(recover.every(frame => frame.src.endsWith(companionSpriteSources(23)[0]))).toBe(true);
    expect([...dizzy, ...recover].every(frame => Math.abs(frame.x - dizzy[0].x) < 2 && Math.abs(frame.y - dizzy[0].y) < 2 && frame.platform !== "")).toBe(true);
  });
});

test("viewer full: native Escape cancels the actual airborne fling and cannot resume horizontal momentum", async ({ page }) => {
  await scenario(page, "viewer-throw-escape", "viewer", "full", false, false, async extra => {
    const measured = await scene(page, "viewer"), floor = measured.planes.filter(plane => plane.kind === "floor").sort((a, b) => b.right - b.left - (a.right - a.left))[0]; extra.scene = measured;
    expect(floor).toBeDefined(); await place(page, { x: (floor.left + floor.right) / 2, y: floor.y });
    await fling(page, await hold(page, 1), 1);
    await expect.poll(() => page.evaluate(() => {
      const frames = (window as unknown as ProbeWindow).runThrowProbe!.frames.filter(frame => frame.marker === "release" && frame.throwPhase);
      return frames.length > 1 && frames.at(-1)!.row === 32 && Math.abs(frames.at(-1)!.x - frames[0].x) > 20 && frames.at(-1)!.y < frames[0].y - 5;
    }), { intervals: [20] }).toBe(true);
    await expect(actor(page)).toBeFocused(); await mark(page, "escape"); await page.keyboard.press("Escape");
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 3000 }); await page.waitForTimeout(500);
    const proof = (await readProof(page))!, key = proof.inputs.find(input => input.type === "keydown" && input.key === "Escape")!, after = proof.frames.filter(frame => frame.marker === "escape" && frame.at >= key.at);
    assertVisible(proof, after);
    expect(after.every(frame => frame.throwPhase === "" && !frame.captured && Math.abs(frame.x - after[0].x) < 2), "native Escape must discard the flight momentum immediately").toBe(true);
    const vertical = after.find(frame => frame.row !== 32)!; expect(vertical).toBeDefined(); expect(vertical.at - key.at, "the next settled drawing must replace the cancelled throw promptly").toBeLessThan(100);
    expect(after.filter(frame => frame.at >= vertical.at).every(frame => frame.row !== 32 && frame.throwPhase === "")).toBe(true);
    assertSupport(after.at(-1)!, measured.planes);
  });
});

for (const [surface, mode] of [["viewer", "reduced"], ["studio", "off"]] as const) test(`${surface} ${mode}: direct release stays quiet and reaches a real support`, async ({ page }) => {
  await scenario(page, `${surface}-${mode}-quiet`, surface, mode, false, false, async extra => {
    const measured = await scene(page, surface); extra.scene = measured;
    const floor = measured.planes.filter(plane => plane.kind === "floor").sort((a, b) => b.right - b.left - (a.right - a.left))[0];
    await place(page, { x: (floor.left + floor.right) / 2, y: floor.y });
    await fling(page, await hold(page, 1), 1); await expect(pet(page)).not.toHaveAttribute("data-state", "held");
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 5000 }); await page.waitForTimeout(250);
    const proof = (await readProof(page))!, up = proof.inputs.filter(input => input.type === "pointerup").at(-1)!, frames = proof.frames.filter(frame => frame.marker === "release" && frame.at >= up.at);
    assertVisible(proof, frames); expect(frames.every(frame => frame.row !== 32 && frame.throwPhase === "")).toBe(true);
    expect(frames.every(frame => Math.abs(frame.x - frames[0].x) < 2), "quiet release may drop vertically but cannot carry hidden horizontal momentum").toBe(true);
    assertSupport(frames.at(-1)!, measured.planes);
  });
});

test("viewer full: native capture cancellation cannot launch a delayed throw", async ({ page }) => {
  await scenario(page, "viewer-capture-cancel", "viewer", "full", false, false, async extra => {
    const measured = await scene(page, "viewer"), floor = measured.planes.filter(plane => plane.kind === "floor").sort((a, b) => b.right - b.left - (a.right - a.left))[0]; extra.scene = measured;
    expect(floor).toBeDefined(); await place(page, { x: (floor.left + floor.right) / 2, y: floor.y }); const centre = await hold(page, 1); await mark(page, "cancel");
    await page.mouse.move(centre.x + 100, centre.y - 60); const id = await page.evaluate(() => (window as unknown as ProbeWindow).runThrowProbe!.pointerId);
    await actor(page).evaluate((button, id) => { if (!button.hasPointerCapture(id)) throw new Error("actual capture is required"); button.releasePointerCapture(id); }, id);
    await page.mouse.up(); await page.waitForTimeout(1000);
    const proof = (await readProof(page))!, lost = proof.inputs.filter(input => input.type === "lostpointercapture").at(-1), up = proof.inputs.filter(input => input.type === "pointerup").at(-1)!;
    expect(lost).toBeDefined(); const frames = proof.frames.filter(frame => frame.marker === "cancel" && frame.at >= Math.max(lost!.at, up.at));
    assertVisible(proof, frames); expect(proof.inputs.some(input => input.type === "lostpointercapture")).toBe(true);
    expect(frames.every(frame => frame.row !== 32 && frame.throwPhase === "")).toBe(true);
    expect(frames.every(frame => Math.abs(frame.x - frames[0].x) < 2), "lost capture must discard physical horizontal momentum, not only the throw marker").toBe(true);
    assertSupport(frames.at(-1)!, measured.planes);
  });
});

test("viewer full: a native regrab supersedes the live throw without stale flight resuming", async ({ page }) => {
  await scenario(page, "viewer-throw-regrab", "viewer", "full", false, false, async extra => {
    const measured = await scene(page, "viewer"), floor = measured.planes.filter(plane => plane.kind === "floor").sort((a, b) => b.right - b.left - (a.right - a.left))[0]; extra.scene = measured;
    expect(floor).toBeDefined(); await place(page, { x: (floor.left + floor.right) / 2, y: floor.y }); await fling(page, await hold(page, 1), 1);
    await expect(pet(page)).toHaveAttribute("data-state", "jump"); const r = (await actor(page).boundingBox())!;
    await page.mouse.move(r.x + r.width / 2, r.y + r.height * .4); await page.mouse.down(); await page.mouse.move(r.x + r.width / 2 + 12, r.y + r.height * .4 + 8);
    await expect(pet(page)).toHaveAttribute("data-state", "held"); await mark(page, "regrab"); await page.waitForTimeout(350);
    const proof = (await readProof(page))!, held = proof.frames.filter(frame => frame.marker === "regrab");
    assertVisible(proof, held); expect(held.every(frame => frame.state === "held" && frame.captured && frame.throwPhase === "")).toBe(true);
    await page.waitForTimeout(180); await mark(page, "regrab-release"); await page.mouse.up();
    await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 3000 }); await page.waitForTimeout(250);
    const releasedProof = (await readProof(page))!, up = releasedProof.inputs.filter(input => input.type === "pointerup").at(-1)!, released = releasedProof.frames.filter(frame => frame.marker === "regrab-release" && frame.at >= up.at);
    assertVisible(releasedProof, released);
    expect(released.every(frame => !frame.captured && frame.row !== 32 && frame.throwPhase === ""), "releasing a still second hand cannot resume the superseded flight").toBe(true);
    expect(released.every(frame => Math.abs(frame.x - released[0].x) < 2), "stale throw velocity cannot move the body after the second release").toBe(true);
    assertSupport(released.at(-1)!, measured.planes);
  });
});

async function prepareRun(page: Page, surface: Surface, food: boolean) {
  await openCompanionHome(page);
  const measured = await scene(page, surface, true), floor = measured.planes.filter(plane => plane.kind === "floor").sort((a, b) => b.right - b.left - (a.right - a.left))[0];
  expect(floor.right - floor.left, "the actual floor needs room for a sustained run").toBeGreaterThan(650);
  const start = { x: floor.left + 45, y: floor.y }, target = { x: floor.right - 45, y: floor.y };
  await place(page, start); await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  let foodId = "";
  if (food) {
    await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); const item = page.locator(".vc-food"); await expect(item).toHaveCount(1);
    const r = (await item.boundingBox())!, offset = await item.evaluate(node => { const matrix = new DOMMatrixReadOnly((node as HTMLElement).style.transform), r = node.getBoundingClientRect(); return { x: r.left + r.width / 2 - matrix.m41, y: r.top + r.height / 2 - matrix.m42 }; });
    await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.mouse.move(target.x + offset.x, target.y + offset.y, { steps: 12 }); await page.mouse.up();
    await expect(item).not.toHaveAttribute("data-falling"); foodId = (await item.getAttribute("data-food"))!;
    await expect.poll(() => item.evaluate((node, target) => { const m = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return Math.hypot(m.m41 - target.x, m.m42 - target.y); }, target), { message: "the real dragged food must settle on the measured far floor" }).toBeLessThan(2);
  }
  await mark(page, food ? "food-run" : "ordinary-run"); await actor(page).focus(); await actor(page).press("Space"); await page.mouse.move(1870, 200);
  return { floor, start, target, foodId };
}
function sustainedRuns(proof: Proof, marker: string, foodId = "") {
  const frames = proof.frames.filter(frame => frame.marker === marker), groups: Frame[][] = [];
  for (const frame of frames) {
    const prior = groups.at(-1), last = prior?.at(-1);
    // A pause is a segment boundary even if the next action reuses its goal.
    const row = foodId && frame.variant === "careful" ? 2 : 20;
    if (frame.row !== row || frame.state !== "walk" || !frame.goal) { if (last) groups.push([]); continue; }
    if (!last || last.goal !== frame.goal || frame.at - last.at > 100) groups.push([frame]); else prior!.push(frame);
  }
  return groups.filter(group => group.length && group.at(-1)!.at - group[0].at >= 2500 && Math.abs(group.at(-1)!.x - group[0].x) >= 300);
}
function completedRun(proof: Proof, marker: string, foodId = "") {
  const frames = proof.frames.filter(frame => frame.marker === marker);
  for (const run of sustainedRuns(proof, marker, foodId)) {
    const first = frames.find(frame => frame.goal === run[0].goal && frame.state === "walk")!, end = frames.find(frame => frame.at > first.at && frame.goal !== first.goal);
    if (end && first.targetX !== null && Math.abs(end.x - first.targetX) <= 40) return { first, end };
  }
}
function assertSustainedRun(proof: Proof, marker: string, foodId = "") {
  const witness = completedRun(proof, marker, foodId);
  expect(witness, "one natural actual goal must complete continuous2.5s/300px locomotion; ordinary roaming must adopt row20, and an absent witness is missing coverage").toBeDefined();
  const { first, end } = witness!, frames = proof.frames.filter(frame => frame.marker === marker), whole = frames.filter(frame => frame.at >= first.at && frame.at < end.at), direction = Math.sign(end.x - first.x);
  assertVisible(proof, whole);
  expect(whole.every(frame => frame.goal === first.goal)).toBe(true);
  if (foodId) { expect(["careful", "dash", "rush-trip"]).toContain(first.variant); expect(whole.every(frame => frame.foodGoal === foodId && frame.variant === first.variant)).toBe(true); }
  expect(whole.every(frame => frame.targetX !== null && Math.abs(frame.targetX - first.targetX!) < 1)).toBe(true);
  const interior = whole.filter(frame => Math.abs(frame.x - first.x) > 24 && Math.abs(frame.targetX! - frame.x) > 40);
  const row = foodId && first.variant === "careful" ? 2 : 20;
  expect(interior.every(frame => frame.state === "walk" && frame.row === row), "the naturally selected approach cannot stop or restart before reaching its target; a real food contact may then react").toBe(true);
  if (foodId) expect(whole.filter(frame => frame.trip).every(frame => Math.abs(frame.x - first.targetX!) <= 40), "a natural meal trip is allowed only at the real food contact, not at a distant run segment").toBe(true);
  const budgets = whole.map(frame => Number(frame.remaining));
  const limit = foodId ? COMPANION_FEED_ACTION_BUDGET : 12;
  expect(budgets.every((budget, i) => whole[i].remaining !== "" && Number.isInteger(budget) && budget >= 0 && budget <= limit && (!i || budget <= budgets[i - 1])), "remaining is the actual finite feed/explore leg budget, not a guessed countdown").toBe(true);
  for (let i = 0; i < interior.length; i++) {
    const later = interior.find(frame => frame.at >= interior[i].at + 120);
    if (later && later.at - interior[i].at <= 220) expect(direction * (later.x - interior[i].x), "the same active goal must not idle at recurring segment boundaries").toBeGreaterThan(2);
  }
  expect(Math.max(...whole.slice(1).map((frame, i) => frame.at - whole[i].at)), "missing native frames cannot prove continuity").toBeLessThanOrEqual(100);
  expect(Math.abs(end.x - first.targetX!)).toBeLessThanOrEqual(40);
}
for (const food of [true, false]) test(`viewer full: ${food ? "one far real food keeps its natural sustained approach" : "ordinary roaming keeps its actual sustained row20 run"} goal`, async ({ page }) => {
  await scenario(page, food ? "viewer-food-sustained-run" : "viewer-ordinary-sustained-run", "viewer", "full", true, food, async extra => {
    const setup = await prepareRun(page, "viewer", food); extra.run = setup;
    const marker = food ? "food-run" : "ordinary-run";
    // Observe the same finite real20s once. Repeatedly serializing the growing
    // frame array would impose pauses on the very motion under observation.
    await page.waitForTimeout(20000);
    const proof = (await readProof(page))!, seen = Boolean(completedRun(proof, marker, setup.foodId));
    extra.coverageObserved = seen; expect(seen, "the bounded native observation must actually choose a qualifying run without RNG or reload fishing").toBe(true);
    assertSustainedRun(proof, marker, setup.foodId);
  });
});

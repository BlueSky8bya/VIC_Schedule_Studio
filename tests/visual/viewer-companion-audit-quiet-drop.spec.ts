import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

type Surface = "viewer" | "studio";
type Mode = "full" | "lite" | "reduced" | "off";
type Input = "drag" | "two-tap";
type Point = { x: number; y: number };
type Target = Point & { plane: number; eventId: string; hitChain: { tag: string; className: string; role: string | null; act: string | null }[] };
type Frame = Point & { at: number; same: boolean; hidden: boolean; visible: boolean; decoded: boolean; state: string; presence: string; dreaming: boolean; platform: string; returning: string | null };
type Witness = { node: HTMLElement; frames: Frame[]; raf: number; captures: number; capture: () => void; hiddenChanges: number; observer: MutationObserver };
type GeometrySample = { node: string; stack: string; owner: "companion" | "external"; count: number };
type GeometryCounts = { companionRectReads: number; externalRectReads: number; samples: GeometrySample[]; sampleOverflow: number };
type GeometryWitness = { original: typeof Element.prototype.getBoundingClientRect; chunks: string[]; phase: "opening" | "quiet" | "idle"; counts: GeometryCounts };
type ProbeWindow = Window & { quietDropWitness?: Witness; quietDropGeometry?: GeometryWitness };
type Evidence = { writes: string[]; errors: string[]; inputs: unknown[] };
const proof = new WeakMap<Page, Evidence>();
const prefix = process.env.VIC_AUDIT_QUIET_DROP_PREFIX ?? ".scratch-pw/companion-077-quiet-drop";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const cards = (surface: Surface) => surface === "studio" ? '[data-companion-event="ordinary"][data-eventid]' : ".public-event[data-eventid]:not(.teaser):not(.is-support)";

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const observed: Evidence = { writes: [], errors: [], inputs: [] }; proof.set(page, observed);
  page.on("pageerror", error => observed.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { observed.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 500, body: "fixture mutation blocked" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const unfinished = await finishWitness(page);
  if (unfinished) proof.get(page)!.inputs.push({ unfinished });
  await page.evaluate(() => { const win = window as ProbeWindow; if (win.quietDropGeometry) { Element.prototype.getBoundingClientRect = win.quietDropGeometry.original; delete win.quietDropGeometry; } });
  await writeFile(`${prefix}-${info.title.replace(/[^a-z0-9]+/gi, "-")}.json`, JSON.stringify(proof.get(page), null, 2));
  expect(proof.get(page)!.writes).toEqual([]); expect(proof.get(page)!.errors).toEqual([]);
});

async function point(page: Page) {
  return pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom }; });
}
async function setup(page: Page, surface: Surface, mode: Mode) {
  await page.addInitScript(({ key, epoch, mode, preferences, care }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.reduceMotion": mode === "reduced" ? "on" : "off", "vic.gfxPref": mode === "off" ? "off" : mode === "lite" ? "lite" : "max", "vic.sound": "off", "vic.ambient": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    Math.random = () => 0;
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, mode,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false },
    care: { ...DEFAULT_COMPANION_CARE, energy: 1, hunger: .05 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2026&m=6");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await expect(actor(page)).toBeVisible(); await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  await expect.poll(() => pet(page).locator(".vc-texture").evaluate(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0)).toBe(true);
  // The actual far edge is exposed by both ordinary window implementations.
  // This native preparatory drop has its own independently measured floor.
  const floor = await page.evaluate(() => {
    let plane = innerHeight - 18;
    for (const node of document.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const r = node.getBoundingClientRect(), css = getComputedStyle(node);
      if (css.position === "fixed" && css.display !== "none" && css.visibility !== "hidden" && r.width > 0 && r.height > 0 && r.top >= innerHeight * .65 && r.bottom <= innerHeight + 1) plane = Math.min(plane, r.top - 8);
    }
    return { x: innerWidth - 160, y: plane - 10, plane };
  });
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(floor.x, floor.y); await page.mouse.move(4, 4);
  await expect(pet(page)).not.toHaveAttribute("data-placing"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 5000 });
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await expect.poll(async () => Math.hypot((await point(page)).x - floor.x, (await point(page)).y - floor.plane)).toBeLessThan(2);
}

async function openExposedWindow(page: Page, surface: Surface): Promise<Locator> {
  const card = page.locator(cards(surface)).filter({ visible: true }).first();
  if (surface === "studio") await card.locator(".pill-main strong").dblclick(); else await card.click();
  const dialog = page.locator(surface === "studio" ? ".event-editor-panel.is-edit" : ".agenda-detail-sheet");
  await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
  // Move the real sheet away from the creature; never make its backdrop
  // transparent or send a synthetic click through a covered actor.
  const pane = (await dialog.boundingBox())!, grip = (await dialog.locator(surface === "studio" ? ".editor-grab" : ".detail-grab").first().boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 24 - pane.x, grip.y + grip.height / 2 + 100 - pane.y, { steps: 16 }); await page.mouse.up();
  await waitForOverlayEntrance(dialog); await page.mouse.move(4, 4);
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
  await expect(pet(page)).toHaveAttribute("data-state", "sleep"); await expect(pet(page)).toHaveAttribute("data-dreaming", "");
  return dialog;
}
async function exposedGrip(page: Page) {
  const grip = await actor(page).evaluate(node => {
    const r = node.getBoundingClientRect();
    for (const fy of [.4, .6, .25]) for (const fx of [.5, .3, .7]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (document.elementFromPoint(x, y)?.closest(".vc-actor") === node) return { x, y };
    }
    return null;
  });
  expect(grip, "the ordinary window must leave an actual native actor target exposed").not.toBeNull(); return grip!;
}
async function landingTarget(page: Page, surface: Surface, dialog: Locator, excludeId?: string): Promise<Target> {
  const target = await dialog.evaluate((sheet, { selector, excludeId }) => {
    const pane = sheet.getBoundingClientRect(), nodes = [...document.querySelectorAll<HTMLElement>(selector)], size = 92;
    const physical = [...document.querySelectorAll<HTMLElement>(`${selector},.support-bar[data-supportid],[data-companion-band="public"][data-supportid]`)].map(node => ({ node, r: node.getBoundingClientRect() })).filter(item => item.r.width > 0 && item.r.height > 0);
    const controls = [...document.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role=button],.vc-home,.vc-compact-home")].filter(node => !node.matches(selector) && !node.matches(".public-day,.agenda-day,.studio-day") && !node.closest(".vc-companion")).map(node => node.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    for (const node of nodes) {
      const r = node.getBoundingClientRect(), plane = r.top - 3, y = plane - 44;
      if (!r.width || !r.height || node.dataset.eventid === excludeId || y < size + 150 || plane > innerHeight - 150) continue;
      for (const fraction of [.5, .75, .25]) {
        const x = r.left + r.width * fraction, half = size * .38 + 4, top = y - size * .76 - 4;
        if (x < 60 || x > innerWidth - 60 || x + half > pane.left && x - half < pane.right) continue;
        if (controls.some(control => control.left < x + half && control.right > x - half && control.top < plane + 1 && control.bottom > top)) continue;
        const first = physical.filter(other => x >= other.r.left && x <= other.r.right && other.r.top - 3 >= y - .5).sort((a, b) => a.r.top - b.r.top)[0];
        const hit = document.elementFromPoint(x, y), nativeControl = hit?.closest("button,a,input,select,textarea"), roleControl = hit?.closest("[role=button]");
        // A structural day is the calendar canvas, not a nested edit/vote
        // control. Retain the actual ancestry so the older runtime's broad
        // [role=button] rejection remains directly observable in studio.
        if (first?.node !== node || !hit || nativeControl || roleControl && !roleControl.matches(".public-day,.agenda-day,.studio-day")) continue;
        const hitChain: Target["hitChain"] = [];
        for (let current: Element | null = hit; current && hitChain.length < 8; current = current.parentElement) hitChain.push({ tag: current.tagName, className: current.getAttribute("class") ?? "", role: current.getAttribute("role"), act: current.getAttribute("data-act") });
        return { eventId: node.dataset.eventid!, x, y, plane, hitChain };
      }
    }
    return null;
  }, { selector: cards(surface), excludeId });
  expect(target, "an exposed real card must be the first physical support below the native release").not.toBeNull(); return target!;
}

async function beginWitness(page: Page) {
  await pet(page).evaluate(node => {
    const witness: Witness = { node: node as HTMLElement, frames: [], raf: 0, captures: 0, hiddenChanges: 0, capture: () => { witness.captures++; }, observer: new MutationObserver(records => { witness.hiddenChanges += records.length; }) };
    witness.observer.observe(node, { attributes: true, attributeFilter: ["hidden"] }); document.addEventListener("gotpointercapture", witness.capture, true);
    const began = performance.now(), sample = (now: number) => {
      const r = node.getBoundingClientRect(), el = node as HTMLElement, css = getComputedStyle(node), image = node.querySelector<HTMLImageElement>(".vc-texture");
      witness.frames.push({ at: now - began, x: r.left + r.width / 2, y: r.bottom, same: node.isConnected && node === document.querySelector(".vc-companion"), hidden: el.hidden, visible: !el.hidden && css.display !== "none" && css.visibility !== "hidden" && Number(css.opacity || 1) > 0, decoded: Boolean(image?.complete && image.naturalWidth > 0), state: el.dataset.state ?? "", presence: el.dataset.presence ?? "", dreaming: el.hasAttribute("data-dreaming"), platform: el.dataset.platform ?? "", returning: el.getAttribute("data-returning") });
      witness.raf = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).quietDropWitness = witness; witness.raf = requestAnimationFrame(sample);
  });
}
async function finishWitness(page: Page) {
  return page.evaluate(() => {
    const win = window as ProbeWindow, witness = win.quietDropWitness; if (!witness) return null;
    cancelAnimationFrame(witness.raf); witness.observer.disconnect(); document.removeEventListener("gotpointercapture", witness.capture, true); delete win.quietDropWitness;
    return { frames: witness.frames, captures: witness.captures, hiddenChanges: witness.hiddenChanges, same: witness.node.isConnected && witness.node === document.querySelector(".vc-companion") };
  });
}
async function installGeometryAttribution(page: Page) {
  // Use this build's real lazy-entry files. A stale hardcoded chunk hash could
  // silently classify every companion call as external and make zero vacuous.
  const manifest = JSON.parse(await readFile(resolve(".next/react-loadable-manifest.json"), "utf8")) as Record<string, { files: string[] }>;
  const entries = Object.entries(manifest).filter(([key]) => / -> (?:\.\/viewer-companion\/viewer-companion|@\/components\/poster\/viewer-companion\/viewer-companion)$/.test(key.replaceAll("\\", "/")));
  const chunks = [...new Set(entries.flatMap(([, value]) => value.files.filter(file => file.endsWith(".js")).map(file => `/_next/${file}`)))];
  expect(entries.length, "the actual production companion lazy entries must exist").toBeGreaterThan(0);
  expect(chunks.length, "empty attribution must fail closed").toBeGreaterThan(0);
  proof.get(page)!.inputs.push({ input: "geometry-attribution-build", manifestEntries: entries.map(([key]) => key), chunks });
  await page.evaluate(chunks => {
    const win = window as ProbeWindow;
    const witness: GeometryWitness = { original: Element.prototype.getBoundingClientRect, chunks, phase: "opening", counts: { companionRectReads: 0, externalRectReads: 0, samples: [], sampleOverflow: 0 } };
    win.quietDropGeometry = witness;
    Element.prototype.getBoundingClientRect = function () {
      if (witness.phase !== "idle" && this.matches(".agenda-detail-sheet,.event-editor-panel,.vc-home,.vc-home-cushion,.vc-home-floor,.vc-plush-bed")) {
        const stack = new Error("quiet geometry attribution").stack ?? "", owner = witness.chunks.some(chunk => stack.includes(`${chunk}:`)) ? "companion" : "external";
        if (owner === "companion") witness.counts.companionRectReads++; else witness.counts.externalRectReads++;
        const node = `${this.tagName}.${this.getAttribute("class") ?? ""}`;
        const sample = witness.counts.samples.find(sample => sample.node === node && sample.owner === owner && sample.stack === stack);
        if (sample) sample.count++;
        else if (witness.counts.samples.length < 3) witness.counts.samples.push({ node, owner, stack, count: 1 });
        else witness.counts.sampleOverflow++;
      }
      return witness.original.call(this);
    };
  }, chunks);
}
async function quietBudget(page: Page) {
  return pet(page).evaluate(async node => {
    let writes = 0, ranges = 0;
    const rangeOriginal = Range.prototype.getClientRects, geometry = (window as ProbeWindow).quietDropGeometry!;
    geometry.phase = "quiet"; geometry.counts = { companionRectReads: 0, externalRectReads: 0, samples: [], sampleOverflow: 0 };
    const observer = new MutationObserver(records => { writes += records.length; }); observer.observe(node, { attributes: true, subtree: true, childList: true });
    Range.prototype.getClientRects = function () { ranges++; return rangeOriginal.call(this); };
    const z = node.querySelector(".vc-dream i")!, animation = z.getAnimations()[0], before = Number(animation?.currentTime), began = performance.now();
    try {
      // This is the measured idle budget, not a sleep used to guess when an
      // action has ended. The real sleep/dreaming endpoint was required first.
      await new Promise(resolve => setTimeout(resolve, 400));
      // Studio's editor keeps its own anchor rAF while open. Report that cost
      // separately; this budget proves the companion's quiet geometry path.
      return { writes, ranges, rects: geometry.counts.companionRectReads, externalRectReads: geometry.counts.externalRectReads, rectSamples: geometry.counts.samples, rectSampleOverflow: geometry.counts.sampleOverflow, duration: performance.now() - began, zBefore: before, zAfter: Number(animation?.currentTime) };
    } finally { observer.disconnect(); Range.prototype.getClientRects = rangeOriginal; geometry.phase = "idle"; }
  });
}
async function expectSleepOnTarget(page: Page, surface: Surface, target: Target) {
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/);
  await expect(pet(page)).toHaveAttribute("data-state", "sleep", { timeout: 3500 });
  await expect(pet(page)).toHaveAttribute("data-presence", "parked"); await expect(pet(page)).toHaveAttribute("data-dreaming", "");
  await expect(pet(page)).not.toHaveAttribute("data-returning"); await expect(pet(page)).not.toHaveAttribute("data-journey", /.+/);
  const card = page.locator(`${cards(surface)}[data-eventid="${target.eventId}"]`);
  await expect.poll(async () => { const p = await point(page), plane = await card.evaluate(node => node.getBoundingClientRect().top - 3); return Math.hypot(p.x - target.x, p.y - plane); }).toBeLessThan(2);
}

for (const surface of ["viewer", "studio"] as const) for (const mode of ["full", "lite", "reduced", "off"] as const) test(`${surface} ${mode}: quiet parked drop restores sleep after native two-tap placement and drag`, async ({ page }) => {
  test.setTimeout(45000); await setup(page, surface, mode);
  await installGeometryAttribution(page);
  const original = await pet(page).elementHandle(), dialog = await openExposedWindow(page, surface);
  const attributionOpening = await page.evaluate(() => { const witness = (window as ProbeWindow).quietDropGeometry!; witness.phase = "idle"; return witness.counts; });
  proof.get(page)!.inputs.push({ input: "geometry-attribution-native-open", ...attributionOpening });
  expect(attributionOpening.companionRectReads, "real native window opening must positively identify this build's companion geometry calls").toBeGreaterThan(0);
  const focus = await page.evaluateHandle(() => document.activeElement);
  let previous: string | undefined;
  for (const input of ["two-tap", "drag"] as const satisfies readonly Input[]) {
    const target = await landingTarget(page, surface, dialog, previous), grip = await exposedGrip(page); previous = target.eventId;
    proof.get(page)!.inputs.push({ input, target, grip });
    await beginWitness(page);
    if (input === "drag") {
      const before = await point(page), offset = { x: grip.x - before.x, y: grip.y - before.y };
      await page.mouse.move(grip.x, grip.y); await page.mouse.down(); await expect(pet(page)).toHaveAttribute("data-overlay-drag", "");
      await page.mouse.move(target.x + offset.x, target.y + offset.y, { steps: 12 });
      await expect.poll(async () => { const p = await point(page); return Math.hypot(p.x - target.x, p.y - target.y); }).toBeLessThan(2);
      await page.mouse.up();
    } else {
      await page.mouse.dblclick(grip.x, grip.y); await expect(pet(page)).toHaveAttribute("data-placing", "");
      await page.mouse.click(target.x, target.y); await expect(pet(page)).not.toHaveAttribute("data-placing");
    }
    await page.mouse.move(4, 4); await expectSleepOnTarget(page, surface, target); await expect(dialog).toBeVisible();
    expect(await page.evaluate(focus => document.activeElement === focus, focus)).toBe(true);
    await page.screenshot({ path: `${prefix}-${surface}-${mode}-${input}.png`, animations: "allow" });
    const witness = (await finishWitness(page))!;
    proof.get(page)!.inputs.push({ input, target, witness });
    expect(witness.same).toBe(true); expect(witness.hiddenChanges).toBe(0); expect(witness.captures).toBeGreaterThan(0); expect(witness.frames.length).toBeGreaterThan(2);
    expect(witness.frames.every(frame => frame.same && !frame.hidden && frame.visible && frame.decoded && frame.returning === null && frame.presence === "parked")).toBe(true);
    const quiet = await quietBudget(page); proof.get(page)!.inputs.push({ input, quiet });
    expect({ writes: quiet.writes, ranges: quiet.ranges, rects: quiet.rects }).toEqual({ writes: 0, ranges: 0, rects: 0 });
    expect(quiet.duration).toBeGreaterThanOrEqual(390);
    if (mode === "full" || mode === "lite") expect(quiet.zAfter).toBeGreaterThan(quiet.zBefore);
  }
  const beforeClose = await point(page);
  const preferencesBeforeClose = await page.evaluate(() => localStorage.getItem("vic.viewerCompanion")), grip = await exposedGrip(page);
  await beginWitness(page); await page.mouse.dblclick(grip.x, grip.y); await expect(pet(page)).toHaveAttribute("data-placing", "");
  const close = dialog.locator(surface === "studio" ? ".editor-close" : ".agenda-detail-close");
  const nativeClose = await close.evaluate(button => {
    const r = button.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { hit: Boolean(hit && button.contains(hit)), tag: button.tagName, role: button.getAttribute("role"), act: button.getAttribute("data-act") };
  });
  proof.get(page)!.inputs.push({ input: "protected-close", beforeClose, nativeClose });
  expect(nativeClose.hit).toBe(true); expect(nativeClose.tag).toBe("BUTTON");
  // A real close control retains its native input even while ordinary-window
  // two-tap placement is armed. It must never become a new drop destination.
  await close.click(); await expect(dialog).toBeHidden(); await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).not.toHaveAttribute("data-returning");
  await expect(pet(page)).toHaveAttribute("data-presence", "active", { timeout: 5000 });
  await expect.poll(async () => { const current = await point(page); return Math.hypot(current.x - beforeClose.x, current.y - beforeClose.y); }).toBeLessThan(2);
  const closed = (await finishWitness(page))!; proof.get(page)!.inputs.push({ input: "protected-close", witness: closed });
  expect(closed.same).toBe(true); expect(closed.hiddenChanges).toBe(0);
  expect(closed.frames.every(frame => frame.same && !frame.hidden && frame.returning === null && Math.hypot(frame.x - beforeClose.x, frame.y - beforeClose.y) < 2)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"))).toBe(preferencesBeforeClose);
  expect(await original!.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
  if (surface === "viewer") expect(await page.locator("[data-export-surface]").evaluate(node => (node as HTMLElement).offsetWidth)).toBe(1840);
});

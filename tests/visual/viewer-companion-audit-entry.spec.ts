import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Surface = "viewer" | "studio";
type Mode = "full" | "lite";
type Rect = { left: number; top: number; width: number; height: number };
type Frame = { at: number; readAt: number; coherent: boolean; same: boolean; petCount: number; frontCount: number; petVisible: boolean; bedVisible: boolean; frontHidden: boolean; frontVisible: boolean; depth: string; platform: string; bed: Rect | null; front: Rect | null; bedAlpha: number; frontAlpha: number; entryAnimations: number; localFronts: number; localFrontAlpha: number; alignment: number | null };
type Witness = { frames: Frame[]; raf: number; serial: number; timers: Set<ReturnType<typeof setTimeout>>; node?: Element; stopped: boolean };
type ProbeWindow = Window & { sofaEntry?: Witness; startSofaEntry?: () => void };
type Proof = { writes: string[]; errors: string[]; stages: unknown[] };
const evidence = new WeakMap<Page, Proof>();
const prefix = process.env.VIC_AUDIT_ENTRY_PREFIX ?? ".scratch-pw/companion-077-entry";
const pet = (page: Page) => page.locator(".vc-companion");
const pathFor = (surface: Surface) => surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2026&m=6";

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const proof: Proof = { writes: [], errors: [], stages: [] }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 500, body: "fixture mutation blocked" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const unfinished = await finish(page); if (unfinished?.length) evidence.get(page)!.stages.push({ label: "unfinished", frames: unfinished });
  await writeFile(`${prefix}-${info.title.replace(/[^a-z0-9]+/gi, "-")}.json`, JSON.stringify(evidence.get(page), null, 2));
  expect(evidence.get(page)!.writes).toEqual([]); expect(evidence.get(page)!.errors).toEqual([]);
});

async function install(page: Page, mode: Mode) {
  await page.addInitScript(({ key, epoch, mode, preferences, care }) => {
    if (!sessionStorage.getItem("companion-entry-seeded")) {
      for (const [name, value] of Object.entries({ [key]: epoch, "vic.reduceMotion": "off", "vic.gfxPref": mode === "full" ? "max" : "lite", "vic.sound": "off", "vic.ambient": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
      localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); sessionStorage.setItem("companion-entry-seeded", "1");
    }
    Math.random = () => 0;
    const win = window as ProbeWindow;
    const bounds = (node?: Element | null): Rect | null => { if (!node) return null; const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
    const materialAlpha = (node?: Element | null) => {
      if (!node?.isConnected) return 0;
      let value = 1;
      for (let current: Element | null = node; current; current = current.parentElement) {
        const css = getComputedStyle(current);
        if (current.hasAttribute("hidden") || css.display === "none" || ["hidden", "collapse"].includes(css.visibility)) return 0;
        value *= Number(css.opacity || 1);
      }
      return value;
    };
    const alpha = (node?: Element | null) => {
      if (!node) return 0;
      const r = node.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0 || r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) return 0;
      return materialAlpha(node);
    };
    const sameRect = (a: Rect | null, b: Rect | null) => a === null && b === null || Boolean(a && b && Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) < .01);
    win.startSofaEntry = () => {
      if (win.sofaEntry) { win.sofaEntry.stopped = true; cancelAnimationFrame(win.sofaEntry.raf); for (const timer of win.sofaEntry.timers) clearTimeout(timer); }
      const probe: Witness = { frames: [], raf: 0, serial: 0, timers: new Set(), stopped: false }, began = performance.now(); win.sofaEntry = probe;
      const sample = (now: number) => {
        if (probe.stopped) return;
        const queuedBed = document.querySelector(".vc-home:not([data-panel-collapsed]) .vc-plush-bed"), queuedRect = bounds(queuedBed), serial = ++probe.serial;
        // Observe after the product's callbacks in the same render batch.
        // This is DOM geometry/alpha evidence, not a compositor receipt.
        const timer = setTimeout(() => {
          probe.timers.delete(timer); if (probe.stopped) return;
          const nodes = document.querySelectorAll<HTMLElement>(".vc-companion"), node = nodes[0], fronts = document.querySelectorAll<HTMLElement>(".vc-bed-foreground"), front = fronts[0];
          if (node && !probe.node) probe.node = node;
          const bed = document.querySelector(".vc-home:not([data-panel-collapsed]) .vc-plush-bed"), b = bounds(bed), f = bounds(front), bedAlpha = alpha(bed), frontAlpha = alpha(front);
          const animations = new Set<Animation>();
          for (let current = bed; current; current = current.parentElement) for (const animation of current.getAnimations()) if (animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))) animations.add(animation);
          probe.frames.push({ at: now - began, readAt: performance.now() - began, coherent: serial === probe.serial && queuedBed === bed && sameRect(queuedRect, b),
            same: !node || probe.node === node && node.isConnected, petCount: nodes.length, frontCount: fronts.length, petVisible: alpha(node) > 0, bedVisible: bedAlpha > 0,
            frontHidden: !front || front.hidden || getComputedStyle(front).display === "none", frontVisible: frontAlpha > 0,
            depth: node?.dataset.sofaDepth ?? "", platform: node?.dataset.platform ?? "", bed: b, front: f, bedAlpha, frontAlpha, entryAnimations: animations.size,
            localFronts: bed?.querySelectorAll(".vc-bed-front-shape").length ?? 0,
            // Ownership is CSS visibility/alpha, not whether the last sliver
            // of this SVG path has crossed the viewport edge during entry.
            localFrontAlpha: materialAlpha(bed?.querySelector(".vc-bed-front-shape")),
            alignment: b && f && frontAlpha > 0 && bedAlpha > 0 ? Math.max(Math.abs(b.left - f.left), Math.abs(b.top - f.top), Math.abs(b.width - f.width), Math.abs(b.height - f.height)) : null });
        }, 0); probe.timers.add(timer); probe.raf = requestAnimationFrame(sample);
      };
      probe.raf = requestAnimationFrame(sample);
    };
    win.startSofaEntry();
    // Native browser back may restore a document instead of rerunning scripts.
    // Restart only the test witness on that real lifecycle event.
    addEventListener("pageshow", event => { if (event.persisted) win.startSofaEntry?.(); });
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, mode,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false },
    care: { ...DEFAULT_COMPANION_CARE, energy: 1, hunger: .05 } });
}
async function finish(page: Page) {
  return page.evaluate(() => {
    const probe = (window as ProbeWindow).sofaEntry; if (!probe || probe.stopped) return null;
    probe.stopped = true; cancelAnimationFrame(probe.raf); for (const timer of probe.timers) clearTimeout(timer); probe.timers.clear(); return probe.frames;
  });
}
async function settled(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  let previous: Rect | null = null, stable = 0;
  await expect.poll(() => page.locator(".vc-home .vc-plush-bed").evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }).then(current => {
    stable = previous && Math.max(Math.abs(current.left - previous.left), Math.abs(current.top - previous.top), Math.abs(current.width - previous.width), Math.abs(current.height - previous.height)) < .01 ? stable + 1 : 0;
    previous = current; return stable;
  }), { intervals: [80], timeout: 5000 }).toBeGreaterThanOrEqual(2);
}
async function checkpoint(page: Page, surface: Surface, mode: Mode, label: string) {
  await page.bringToFront();
  await expect.poll(() => page.evaluate(() => (window as ProbeWindow).sofaEntry?.frames.some(frame => frame.petVisible && frame.bedVisible && frame.localFronts > 0) ?? false), { intervals: [16], timeout: 6000 }).toBe(true);
  await page.screenshot({ path: `${prefix}-${surface}-${mode}-${label}-entry.png`, animations: "allow" });
  await settled(page); await expect(pet(page)).toBeVisible(); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await page.screenshot({ path: `${prefix}-${surface}-${mode}-${label}-settled.png`, animations: "allow" });
  const frames = (await finish(page))!; evidence.get(page)!.stages.push({ label, frames }); return frames;
}

for (const surface of ["viewer", "studio"] as const) for (const mode of ["full", "lite"] as const) test(`${surface} ${mode}: entry and native reload never duplicate a sofa foreground for a calendar creature`, async ({ page }) => {
  test.setTimeout(60000); await page.bringToFront(); await install(page, mode);
  const phases: { label: string; frames: Frame[] }[] = [];
  await page.goto(pathFor(surface), { waitUntil: "domcontentloaded" }); phases.push({ label: "initial", frames: await checkpoint(page, surface, mode, "initial") });
  await page.reload({ waitUntil: "domcontentloaded" }); phases.push({ label: "reload", frames: await checkpoint(page, surface, mode, "reload") });
  const other = surface === "viewer" ? "studio" : "viewer";
  await page.goto(pathFor(other), { waitUntil: "domcontentloaded" }); phases.push({ label: "other", frames: await checkpoint(page, surface, mode, "other") });
  await page.goBack({ waitUntil: "domcontentloaded" }); await expect(page).toHaveURL(new RegExp(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio"));
  phases.push({ label: "back", frames: await checkpoint(page, surface, mode, "back") });

  // A blanket foreground removal would hide the real resident. Recall it
  // through the existing cushion control and require its actual seat contact.
  await page.evaluate(() => (window as ProbeWindow).startSofaEntry!());
  const cushion = page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }); await cushion.focus(); await cushion.press("Enter");
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 6000 });
  await expect(pet(page)).toHaveAttribute("data-sofa-depth", /^(seat|back)$/); await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  await expect.poll(() => pet(page).evaluate(node => Math.abs(node.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top))).toBeLessThan(2);
  await settled(page); await page.screenshot({ path: `${prefix}-${surface}-${mode}-resident.png`, animations: "allow" });
  const resident = (await finish(page))!; evidence.get(page)!.stages.push({ label: "resident", frames: resident });
  const residentMoves: { label: string; frames: Frame[] }[] = [];
  for (const side of ["오른쪽", "왼쪽"] as const) {
    await page.evaluate(() => (window as ProbeWindow).startSofaEntry!());
    const control = page.getByRole("button", { name: `패널을 ${side}에 두기`, exact: true }); await control.click(); await expect(control).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: `${prefix}-${surface}-${mode}-resident-${side}-entry.png`, animations: "allow" });
    await settled(page); await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
    await page.screenshot({ path: `${prefix}-${surface}-${mode}-resident-${side}-settled.png`, animations: "allow" });
    const frames = (await finish(page))!; residentMoves.push({ label: `resident-${side}`, frames }); evidence.get(page)!.stages.push({ label: `resident-${side}`, frames });
  }
  for (const phase of phases) {
    expect(phase.frames.some(frame => frame.coherent && frame.entryAnimations > 0 && frame.bedAlpha > 0 && frame.bedAlpha < .999), `${phase.label} must actually sample the native partially transparent entry`).toBe(true);
    const visible = phase.frames.filter(frame => frame.petVisible && frame.bedVisible && frame.coherent);
    expect(visible.length, `${phase.label} must capture the real calendar and room`).toBeGreaterThan(2);
    expect(visible.every(frame => frame.same && frame.petCount === 1 && frame.frontCount === 1 && frame.localFronts === 1)).toBe(true);
    const outside = visible.filter(frame => ["clear", "front"].includes(frame.depth));
    expect(outside.some(frame => /^(card|date)-/.test(frame.platform)), `${phase.label} must observe a naturally seeded calendar support`).toBe(true);
    expect(outside.filter(frame => !frame.frontHidden), `${phase.label}: the inline sofa already contains its front; a distant creature needs no fixed duplicate`).toEqual([]);
    expect(outside.every(frame => frame.localFrontAlpha > 0)).toBe(true);
  }
  const nested = resident.filter(frame => frame.coherent && frame.petVisible && frame.bedVisible && ["seat", "back"].includes(frame.depth));
  expect(nested.length, "the resident foreground positive must not be vacuous").toBeGreaterThan(2);
  expect(nested.every(frame => frame.frontVisible && !frame.frontHidden && frame.localFrontAlpha === 0 && frame.alignment !== null && frame.alignment < 2 && Math.abs(frame.frontAlpha - frame.bedAlpha) < .03)).toBe(true);
  for (const phase of residentMoves) {
    const during = phase.frames.filter(frame => frame.coherent && frame.petVisible && frame.bedVisible && ["seat", "back"].includes(frame.depth));
    const transparent = during.filter(frame => frame.entryAnimations > 0 && frame.bedAlpha > 0 && frame.bedAlpha < .999);
    expect(transparent.length, `${phase.label} must exercise a real resident inside a native fading slide`).toBeGreaterThan(2);
    expect(during.every(frame => frame.same && frame.petCount === 1 && frame.frontCount === 1 && frame.localFronts === 1)).toBe(true);
    // Exactly one front owns paint: local while outside, external while nested.
    // Both translucent copies would darken or split the same rim on entry.
    expect(during.every(frame => frame.frontVisible && !frame.frontHidden && frame.localFrontAlpha === 0 && frame.alignment !== null && frame.alignment < 2 && Math.abs(frame.frontAlpha - frame.bedAlpha) < .03)).toBe(true);
  }
});

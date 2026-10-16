import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const posts = new WeakMap<Page, string[]>();
const artifactPrefix = process.env.COMPANION_INERTIA_ARTIFACT_PREFIX ?? "companion-056-inertia";
type Point = { x: number; y: number };
type Frame = { at: number; phase: string; state: string; hidden: boolean; x: number; y: number; angle: number; sx: number; sy: number; tx: number; ty: number; bodyLagX: number; gripError: number; pivotError: number; facing: string; captured: boolean; left: number; top: number; right: number; bottom: number; poseLeft: number; poseTop: number; poseRight: number; poseBottom: number };
type Observation = {
  rafAt: number; readAt: number; phaseAtRaf: string;
  inputVersionAtRaf: number; inputVersionAtRead: number; rafSerial: number; latestRafSerial: number;
  pointerAtRaf: Point; pointerAtRead: Point; paintedAtRaf: Point;
  comparable: boolean; frame?: Frame;
};
type Commit = { at: number; inputVersion: number; rafSerial: number; pointer: Point; frame: Frame };
type Probe = {
  inputVersion: number; rafSerial: number; stopped: boolean; timers: Set<number>;
  observations: Observation[]; commits: Commit[]; observer?: MutationObserver;
  frames: Frame[]; phase: string; pointer: Point; grip?: Point; pointerId: number; raf: number;
  down: (event: PointerEvent) => void; move: (event: PointerEvent) => void;
};
type ProbeWindow = Window & { heldInertiaProbe?: Probe };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, mode: "full" | "reduced" | "off" = "full") {
  await page.addInitScript(({ epoch, key, preferences, care, mode }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", mode === "reduced" ? "on" : "off");
    localStorage.setItem("vic.gfxPref", mode === "off" ? "off" : "max"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences })); localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    Math.random = () => 0;
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, mode, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05 } });
  await page.goto("/visual-fixture/poster?avatar=1"); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd"); await expect(pet(page)).toHaveAttribute("data-presence", "active");
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  await page.waitForTimeout(180);
}

async function startProbe(page: Page) {
  await pet(page).evaluate(node => {
    const element = node as HTMLElement, button = node.querySelector<HTMLButtonElement>(".vc-actor")!, layer = node.querySelector<HTMLElement>(".vc-inertia")!;
    const world = () => { const m = new DOMMatrixReadOnly(element.style.transform), size = parseFloat(element.style.getPropertyValue("--vc-size")); return { x: m.m41 + size / 2, y: m.m42 + size }; };
    const probe: Probe = { inputVersion: 0, rafSerial: 0, stopped: false, timers: new Set(), observations: [], commits: [], frames: [], phase: "pickup", pointer: { x: 0, y: 0 }, pointerId: -1, raf: 0,
      down: event => { if (!button.contains(event.target as Node)) return; probe.inputVersion++; const p = world(); probe.pointer = { x: event.clientX, y: event.clientY }; probe.grip = { x: event.clientX - p.x, y: event.clientY - p.y }; probe.pointerId = event.pointerId; },
      move: event => { if (event.pointerId === probe.pointerId) { probe.inputVersion++; probe.pointer = { x: event.clientX, y: event.clientY }; } },
    };
    document.addEventListener("pointerdown", probe.down, true); document.addEventListener("pointermove", probe.move, { capture: true, passive: true });
    const began = performance.now();
    const readFrame = (now: number): Frame | undefined => {
      if (element.dataset.state === "held" && probe.grip) {
        const p = world(), css = getComputedStyle(layer), m = new DOMMatrixReadOnly(css.transform), r = layer.getBoundingClientRect(), shape = node.querySelector(".vc-pose")!.getBoundingClientRect();
        const [ox, oy] = css.transformOrigin.split(" ").map(parseFloat), width = parseFloat(css.width), height = parseFloat(css.height);
        // Reconstruct the untransformed plane from its actual transformed
        // AABB. This independently checks the CSS pivot against the pointer.
        const corners = [0, width].flatMap(x => [0, height].map(y => ({ x: ox + m.a * (x - ox) + m.c * (y - oy) + m.e, y: oy + m.b * (x - ox) + m.d * (y - oy) + m.f })));
        const px = r.left - Math.min(...corners.map(c => c.x)) + ox + m.e, py = r.top - Math.min(...corners.map(c => c.y)) + oy + m.f;
        return { at: now - began, phase: probe.phase, state: element.dataset.state, hidden: element.hidden || getComputedStyle(element).display === "none", x: p.x, y: p.y,
          angle: Math.atan2(m.b, m.a) * 180 / Math.PI, sx: Math.hypot(m.a, m.b), sy: Math.hypot(m.c, m.d), tx: m.e, ty: m.f,
          // The lower body is below this upper grip. Its actual local matrix
          // must carry this point left when the hand accelerates right.
          bodyLagX: ox + m.a * (46 - ox) + m.c * (76 - oy) + m.e - 46,
          gripError: Math.hypot(p.x + probe.grip.x - probe.pointer.x, p.y + probe.grip.y - probe.pointer.y), pivotError: Math.hypot(px - probe.pointer.x, py - probe.pointer.y),
          facing: element.dataset.facing ?? "", captured: button.hasPointerCapture(probe.pointerId), left: r.left, top: r.top, right: r.right, bottom: r.bottom,
          poseLeft: shape.left, poseTop: shape.top, poseRight: shape.right, poseBottom: shape.bottom };
      }
    };
    // Independent witness of the complete synchronous style commit and the
    // input available to it. This does not claim physical display presentation.
    probe.observer = new MutationObserver(() => {
      if (probe.stopped) return;
      const frame = readFrame(performance.now());
      if (frame) probe.commits.push({ at: performance.now() - began, inputVersion: probe.inputVersion, rafSerial: probe.rafSerial, pointer: { ...probe.pointer }, frame });
    });
    probe.observer.observe(element, { attributes: true, subtree: true, attributeFilter: ["style"] });
    const sample = (now: number) => {
      if (probe.stopped) return;
      const rafSerial = ++probe.rafSerial, inputVersionAtRaf = probe.inputVersion, pointerAtRaf = { ...probe.pointer }, paintedAtRaf = world(), phaseAtRaf = probe.phase;
      // This probe may run before the engine in the same rAF batch. Read after
      // that batch, retaining every raw sample. Apply alignment errors only
      // when neither input nor the next rAF has advanced during that interval.
      const task = window.setTimeout(() => {
        probe.timers.delete(task); if (probe.stopped) return;
        const inputVersionAtRead = probe.inputVersion, latestRafSerial = probe.rafSerial, pointerAtRead = { ...probe.pointer }, readAt = performance.now() - began;
        const comparable = inputVersionAtRaf === inputVersionAtRead && rafSerial === latestRafSerial;
        const frame = readFrame(now);
        probe.observations.push({ rafAt: now - began, readAt, phaseAtRaf, inputVersionAtRaf, inputVersionAtRead, rafSerial, latestRafSerial, pointerAtRaf, pointerAtRead, paintedAtRaf, comparable, frame });
        if (frame && comparable) probe.frames.push(frame);
      }, 0);
      probe.timers.add(task); probe.raf = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).heldInertiaProbe = probe; probe.raf = requestAnimationFrame(sample);
  });
}
const mark = (page: Page, phase: string) => page.evaluate(value => { (window as ProbeWindow).heldInertiaProbe!.phase = value; }, phase);
async function finishProbe(page: Page, label: string) {
  const proof = await page.evaluate(() => {
    const p = (window as ProbeWindow).heldInertiaProbe!;
    p.stopped = true; cancelAnimationFrame(p.raf);
    const cancelledTimers = p.timers.size;
    for (const timer of p.timers) clearTimeout(timer);
    p.timers.clear(); p.observer?.disconnect();
    document.removeEventListener("pointerdown", p.down, true); document.removeEventListener("pointermove", p.move, true);
    return { frames: p.frames, observations: p.observations, commits: p.commits, cancelledTimers, viewport: { width: innerWidth, height: innerHeight } };
  });
  const frames = proof.frames;
  const phases = [...new Set(proof.observations.filter(item => item.frame).map(item => item.frame!.phase))].map(phase => {
    const all = proof.observations.filter(item => item.frame?.phase === phase), kept = all.filter(item => item.comparable), mixed = all.filter(item => !item.comparable), points = kept.map(item => item.frame!), commits = proof.commits.filter(item => item.frame.phase === phase);
    return {
      phase, retained: kept.length, mixed: mixed.length,
      inputAdvanced: mixed.filter(item => item.inputVersionAtRaf !== item.inputVersionAtRead).length,
      rafAdvanced: mixed.filter(item => item.rafSerial !== item.latestRafSerial).length,
      distinctRetainedPoints: new Set(points.map(item => item.x.toFixed(3) + "," + item.y.toFixed(3))).size,
      travelX: points.length ? Math.max(...points.map(item => item.x)) - Math.min(...points.map(item => item.x)) : 0,
      travelY: points.length ? Math.max(...points.map(item => item.y)) - Math.min(...points.map(item => item.y)) : 0,
      maxGrip: points.length ? Math.max(...points.map(item => item.gripError)) : 0,
      maxPivot: points.length ? Math.max(...points.map(item => item.pivotError)) : 0,
      commitCount: commits.length,
      maxCommitGrip: commits.length ? Math.max(...commits.map(item => item.frame.gripError)) : 0,
      maxCommitPivot: commits.length ? Math.max(...commits.map(item => item.frame.pivotError)) : 0,
    };
  });
  const allFrames = [...proof.observations.flatMap(item => item.frame ? [item.frame] : []), ...proof.commits.map(item => item.frame)];
  console.log(JSON.stringify({ check: "held-inertia-observation-phase", label, phases, cancelledTimers: proof.cancelledTimers, retained: frames.length, allSamples: allFrames.length }));
  await writeFile(`.scratch-pw/${artifactPrefix}-${label}.json`, JSON.stringify({ ...proof, phases }, null, 2));
  expect(allFrames.every(f => !f.hidden && f.captured)).toBe(true);
  expect(allFrames.every(f => f.left >= 1.95 && f.top >= 1.95 && f.right <= proof.viewport.width - 1.95 && f.bottom <= proof.viewport.height - 1.95 && f.poseLeft >= 1.95 && f.poseTop >= 1.95 && f.poseRight <= proof.viewport.width - 1.95 && f.poseBottom <= proof.viewport.height - 1.95)).toBe(true);
  expect(proof.commits.length).toBeGreaterThan(12);
  expect(Math.max(...proof.commits.map(item => item.frame.gripError))).toBeLessThan(.1);
  expect(Math.max(...proof.commits.map(item => item.frame.pivotError))).toBeLessThan(.15);
  expect(frames.length).toBeGreaterThan(12); expect(frames.every(f => !f.hidden && f.captured)).toBe(true);
  expect(Math.max(...frames.map(f => f.gripError))).toBeLessThan(.1); expect(Math.max(...frames.map(f => f.pivotError))).toBeLessThan(.15);
  expect(frames.every(f => Math.abs(f.tx) < .001 && Math.abs(f.ty) < .001)).toBe(true); expect(new Set(frames.map(f => f.facing)).size).toBe(1);
  return frames;
}

async function input(page: Page, mobile: boolean) {
  const box = (await actor(page).boundingBox())!, start = { x: box.x + box.width * .5, y: box.y + box.height * .3 };
  const client: CDPSession | null = mobile ? await page.context().newCDPSession(page) : null;
  let at = start;
  if (client) await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 56 }] });
  else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
  return {
    start,
    async move(to: Point, steps = 8) {
      const from = at;
      for (let i = 1; i <= steps; i++) { const p = { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps };
        if (client) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...p, id: 56 }] }); else await page.mouse.move(p.x, p.y);
        await page.waitForTimeout(16);
      }
      at = to;
    },
    async end() { if (client) { await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await client.detach(); } else await page.mouse.up(); },
  };
}

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const mobile of [false]) test.describe(mobile ? "native touch inertia" : "pointer inertia", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: mobile, isMobile: mobile });
  test("real reversals lag and overshoot around a stable grip, then reach exact neutral while still held", async ({ page }) => {
    test.setTimeout(25000); await setup(page); await startProbe(page); const drag = await input(page, mobile);
    await drag.move({ x: drag.start.x + 10, y: drag.start.y + 8 }); await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.waitForTimeout(1600);
    await mark(page, "rightward"); await drag.move({ x: drag.start.x + 36, y: drag.start.y + 15 }, 12);
    await mark(page, "shake");
    for (const [dx, dy] of [[-24, -12], [36, 15]]) await drag.move({ x: drag.start.x + dx, y: drag.start.y + dy }, 12);
    await mark(page, "tail"); await page.waitForTimeout(1700);
    const frames = await finishProbe(page, mobile ? "touch" : "pointer"), rightward = frames.filter(f => f.phase === "rightward"), drive = frames.filter(f => ["rightward", "shake"].includes(f.phase)), tail = frames.filter(f => f.phase === "tail");
    expect(rightward.at(-1)!.x - rightward[0].x).toBeGreaterThan(15);
    expect(Math.min(...rightward.map(f => f.bodyLagX))).toBeLessThan(-.2);
    const responding = rightward.filter(f => f.x > rightward[0].x + .5 && Math.abs(f.angle) > .2);
    expect(responding.length).toBeGreaterThan(3); expect(responding.every(f => f.bodyLagX < 0)).toBe(true);
    expect(Math.max(...drive.map(f => Math.abs(f.angle)))).toBeGreaterThan(1); expect(Math.max(...drive.map(f => Math.abs(f.sy - 1)))).toBeGreaterThan(.002);
    expect(Math.max(...tail.map(f => f.angle))).toBeGreaterThan(.05); expect(Math.min(...tail.map(f => f.angle))).toBeLessThan(-.05);
    expect(Math.max(...tail.map(f => f.x)) - Math.min(...tail.map(f => f.x))).toBeLessThan(.01); expect(Math.max(...tail.map(f => f.y)) - Math.min(...tail.map(f => f.y))).toBeLessThan(.01);
    const end = tail.filter(f => f.at >= tail[0].at + 1530); expect(end.length).toBeGreaterThanOrEqual(4);
    expect(end.every(f => f.angle === 0 && f.sx === 1 && f.sy === 1)).toBe(true);
    console.log(JSON.stringify({ check: "held-inertia", input: mobile ? "touch" : "mouse", frames: frames.length, tailFrames: tail.length, maxGripError: Math.max(...frames.map(f => f.gripError)), maxPivotError: Math.max(...frames.map(f => f.pivotError)), rightwardBodyLagX: Math.min(...rightward.map(f => f.bodyLagX)), angle: [Math.min(...tail.map(f => f.angle)), Math.max(...tail.map(f => f.angle))], exactNeutralFrames: end.length }));
    await page.screenshot({ path: `.scratch-pw/${artifactPrefix}-${mobile ? "touch" : "pointer"}.png` });
    await drag.end(); await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 5000 });
  });
});

test("captured edge travel bounds the inertial plane and the complete gravity pose, keeping every corner visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await setup(page); await startProbe(page);
  const before = await pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom, size: r.width }; }), drag = await input(page, false);
  const grip = { x: drag.start.x - before.x, y: drag.start.y - before.y };
  await mark(page, "edge");
  for (const target of [{ x: before.size / 2 + 4, y: before.size + 8 }, { x: 1440 - before.size / 2 - 4, y: before.size + 8 }, { x: 1440 - before.size / 2 - 4, y: 988 }, { x: before.size / 2 + 4, y: 988 }]) await drag.move({ x: target.x + grip.x, y: target.y + grip.y }, 20);
  const frames = await finishProbe(page, "edges"); expect(frames.every(f => f.left >= 1.95 && f.top >= 1.95 && f.right <= 1438.05 && f.bottom <= 998.05)).toBe(true);
  expect(frames.every(f => f.poseLeft >= 1.95 && f.poseTop >= 1.95 && f.poseRight <= 1438.05 && f.poseBottom <= 998.05)).toBe(true);
  console.log(JSON.stringify({ check: "held-complete-shape-edges", frames: frames.length, fullPoseBounds: { left: Math.min(...frames.map(f => f.poseLeft)), top: Math.min(...frames.map(f => f.poseTop)), right: Math.max(...frames.map(f => f.poseRight)), bottom: Math.max(...frames.map(f => f.poseBottom)) }, maxGripError: Math.max(...frames.map(f => f.gripError)), maxPivotError: Math.max(...frames.map(f => f.pivotError)) }));
  await drag.end(); await expect(pet(page)).not.toHaveAttribute("data-state", "held");
});

for (const mode of ["reduced", "off"] as const) test(`real captured movement remains neutral with ${mode}`, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, mode); await startProbe(page); const drag = await input(page, false);
  for (const dx of [36, -24, 36]) await drag.move({ x: drag.start.x + dx, y: drag.start.y + 16 }, 8);
  await page.waitForTimeout(250); const frames = await finishProbe(page, mode);
  expect(frames.every(f => f.angle === 0 && f.sx === 1 && f.sy === 1)).toBe(true); await drag.end(); await expect(pet(page)).not.toHaveAttribute("data-state", "held");
});

test("an ordinary sleeping-window lift remains inertially neutral and returns to zero parked mutations", async ({ page }) => {
  test.setTimeout(25000); await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  await page.getByRole("button", { name: "설정", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await expect(dialog).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 10000 }); await page.waitForTimeout(650);
  const focus = await page.evaluate(() => document.activeElement?.outerHTML), support = await pet(page).getAttribute("data-platform"), drag = await input(page, false);
  for (const dx of [30, -30, 30]) { await drag.move({ x: drag.start.x + dx, y: drag.start.y - 30 }); expect(await pet(page).locator(".vc-inertia").evaluate(node => new DOMMatrixReadOnly(getComputedStyle(node).transform).isIdentity)).toBe(true); }
  await expect(pet(page)).toHaveAttribute("data-dreaming", ""); await expect(pet(page)).toHaveAttribute("data-overlay-drag", ""); await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.activeElement?.outerHTML)).toBe(focus); expect(await pet(page).getAttribute("data-platform")).toBe(support);
  await drag.end(); await page.waitForTimeout(800);
  const writes = await pet(page).evaluate(async node => { let count = 0; const observer = new MutationObserver(records => { count += records.length; }); observer.observe(node, { attributes: true, subtree: true }); await new Promise(resolve => setTimeout(resolve, 350)); observer.disconnect(); return count; });
  expect(writes).toBe(0); await expect(pet(page)).toHaveAttribute("data-presence", "parked");
});

import { expect, test, type CDPSession, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Point = { x: number; y: number };
type Mode = "full" | "lite" | "reduced" | "off";
type Surface = "viewer" | "studio";
type Frame = {
  at: number; phase: string; comparable: boolean; freshTransform: boolean; stableInput: boolean; state: string; platform: string;
  dizzy: boolean; play: string; beat: string; row: number; pose: string;
  hidden: boolean; same: boolean; captured: boolean; x: number; y: number;
  facing: string; gripError: number; pivotError: number; posePivotError: number; scaleY: number;
};
type NativeEvent = { at: number; type: string; id: number; x: number; y: number };
type Probe = {
  frames: Frame[]; events: NativeEvent[]; phase: string; pointer: Point; grip?: Point;
  pointerId: number; version: number; raf: number; timers: Set<number>; stopped: boolean;
  input: (event: PointerEvent) => void;
};
type ProbeWindow = Window & { heldShakeProbe: Probe };
type Evidence = { posts: string[]; errors: string[] };
const evidence = new WeakMap<Page, Evidence>();
const output = ".scratch-pw/089-held-shake";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");

test.use({ viewport: { width: 1920, height: 1100 } });
test.beforeEach(async ({ page }) => {
  const proof: Evidence = { posts: [], errors: [] }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST") { proof.posts.push(path); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (request.method() === "GET" && (path === "/" || path === "/studio")) return route.fulfill({ status: 200, body: "unused fixture navigation" });
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(evidence.get(page)).toEqual({ posts: [], errors: [] }); });

async function setup(page: Page, surface: Surface, mode: Mode) {
  await page.addInitScript(({ prefs, care, key, epoch, mode }) => {
    // Preference seeds only: no actor positions, callbacks, random source or
    // clock are replaced. Native controls below place and handle the creature.
    localStorage.setItem(key, epoch);
    localStorage.setItem("vic.gfxPref", mode === "lite" ? "lite" : mode === "off" ? "off" : "max");
    localStorage.setItem("vic.reduceMotion", mode === "reduced" ? "on" : "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, energy: .95, hunger: .05 }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed");
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, mode });
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=developer&y=2025&m=11" : "/visual-fixture/poster");
  await page.bringToFront();
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished));
  });
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  await actor(page).focus(); await actor(page).press("p"); await page.mouse.click(850, 1050); await page.mouse.move(1800, 900);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect(pet(page)).toBeVisible(); await page.waitForTimeout(200);
}

async function startProbe(page: Page) {
  await pet(page).evaluate(node => {
    const el = node as HTMLElement, button = node.querySelector<HTMLButtonElement>(".vc-actor")!;
    const began = performance.now(), probe: Probe = { frames: [], events: [], phase: "pickup", pointer: { x: 0, y: 0 }, pointerId: -1, version: 0, raf: 0, timers: new Set(), stopped: false, input: () => {} };
    const world = () => { const m = new DOMMatrixReadOnly(el.style.transform), size = parseFloat(el.style.getPropertyValue("--vc-size")); return { x: m.m41 + size / 2, y: m.m42 + size, size }; };
    probe.input = event => {
      if (event.type === "pointerdown") {
        if (!button.contains(event.target as Node)) return;
        const p = world(); probe.pointerId = event.pointerId; probe.grip = { x: event.clientX - p.x, y: event.clientY - p.y };
      } else if (event.pointerId !== probe.pointerId) return;
      probe.version++; probe.pointer = { x: event.clientX, y: event.clientY };
      if (event.type !== "pointermove") probe.events.push({ at: performance.now() - began, type: event.type, id: event.pointerId, x: event.clientX, y: event.clientY });
      if (event.type === "pointerup") probe.phase = "released";
      if (event.type === "pointercancel" || event.type === "lostpointercapture") probe.phase = "cancelled";
    };
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"]) document.addEventListener(type, probe.input as EventListener, { capture: true, passive: true });
    let previousTransform = el.style.transform;
    const sample = () => {
      if (probe.stopped) return;
      const version = probe.version;
      // Observe after the complete native rAF batch. Lite deliberately paints
      // at30Hz while input/rAF may run at60Hz. Exact alignment applies only to
      // a fresh world transform with stable input, never its held-over frame.
      const timer = window.setTimeout(() => {
        probe.timers.delete(timer); if (probe.stopped) return;
        const transform = el.style.transform, freshTransform = transform !== previousTransform, stableInput = version === probe.version;
        previousTransform = transform;
        const p = world(), css = getComputedStyle(node.querySelector<HTMLElement>(".vc-inertia")!), matrix = new DOMMatrixReadOnly(css.transform);
        const rect = node.querySelector(".vc-inertia")!.getBoundingClientRect(), [ox, oy] = css.transformOrigin.split(" ").map(parseFloat);
        const width = parseFloat(css.width), height = parseFloat(css.height);
        const corners = [0, width].flatMap(x => [0, height].map(y => ({ x: ox + matrix.a * (x - ox) + matrix.c * (y - oy) + matrix.e, y: oy + matrix.b * (x - ox) + matrix.d * (y - oy) + matrix.f })));
        const pivot = { x: rect.left - Math.min(...corners.map(c => c.x)) + ox + matrix.e, y: rect.top - Math.min(...corners.map(c => c.y)) + oy + matrix.f };
        const poseCss = getComputedStyle(node.querySelector(".vc-pose")!), poseMatrix = new DOMMatrixReadOnly(poseCss.transform), [px, py] = poseCss.transformOrigin.split(" ").map(parseFloat);
        const held = el.dataset.state === "held", facing = el.dataset.facing ?? "";
        probe.frames.push({ at: performance.now() - began, phase: probe.phase, comparable: freshTransform && stableInput, freshTransform, stableInput,
          state: el.dataset.state ?? "", platform: el.dataset.platform ?? "", dizzy: el.hasAttribute("data-held-dizzy"), play: el.dataset.play ?? "", beat: el.dataset.playBeat ?? "",
          row: Math.round(parseFloat(el.style.getPropertyValue("--vc-row")) * 31 / 100), pose: el.dataset.pose ?? "", hidden: el.hidden || getComputedStyle(el).display === "none", same: node.isConnected && node === document.querySelector(".vc-companion"), captured: button.hasPointerCapture(probe.pointerId), x: p.x, y: p.y, facing,
          gripError: held && probe.grip ? Math.hypot(p.x + probe.grip.x - probe.pointer.x, p.y + probe.grip.y - probe.pointer.y) : 0,
          pivotError: held ? Math.hypot(pivot.x - probe.pointer.x, pivot.y - probe.pointer.y) : 0,
          posePivotError: held ? Math.hypot(px - (facing === "left" ? p.size - ox : ox), py - oy) : 0,
          scaleY: Math.hypot(poseMatrix.c, poseMatrix.d) });
      }, 0);
      probe.timers.add(timer); probe.raf = requestAnimationFrame(sample);
    };
    (window as unknown as ProbeWindow).heldShakeProbe = probe; probe.raf = requestAnimationFrame(sample);
  });
}

async function finishProbe(page: Page, label: string) {
  const proof = await page.evaluate(() => {
    const p = (window as unknown as ProbeWindow).heldShakeProbe; p.stopped = true; cancelAnimationFrame(p.raf);
    for (const timer of p.timers) clearTimeout(timer);
    for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "lostpointercapture"]) document.removeEventListener(type, p.input as EventListener, true);
    return { frames: p.frames, events: p.events };
  });
  mkdirSync(output, { recursive: true });
  writeFileSync(`${output}/${label}.json`, JSON.stringify({ ...proof, ...evidence.get(page) }, null, 2));
  await page.screenshot({ path: `${output}/${label}.png` });
  return proof;
}
const mark = (page: Page, phase: string) => page.evaluate(value => { (window as unknown as ProbeWindow).heldShakeProbe.phase = value; }, phase);

async function hold(page: Page, touch = false) {
  const rect = (await actor(page).boundingBox())!, start = { x: rect.x + rect.width * .5, y: rect.y + rect.height * .3 };
  expect(await page.evaluate(p => Boolean(document.elementFromPoint(p.x, p.y)?.closest(".vc-actor")), start)).toBe(true);
  const client: CDPSession | undefined = touch ? await page.context().newCDPSession(page) : undefined;
  let point = start;
  if (client) await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 89 }] });
  else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
  const move = async (to: Point, steps = 4, stepWait = 8) => {
    const from = point;
    for (let i = 1; i <= steps; i++) {
      const next = { x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps };
      if (client) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...next, id: 89 }] }); else await page.mouse.move(next.x, next.y);
      if (stepWait) await page.waitForTimeout(stepWait);
    }
    point = to;
  };
  // Lift slowly, then let its input window expire. The actual test gesture
  // below must supply its own rapid reversals rather than the initial lift.
  await move({ x: 850, y: 600 }, 24, 20); await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.waitForTimeout(200);
  return {
    centre: { ...point }, move,
    async release() { if (client) await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); else await page.mouse.up(); },
    async cancel() { if (!client) throw new Error("Native touch cancellation needs its CDP session"); await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] }); },
    async dispose() { await client?.detach(); }
  };
}
async function shake(page: Page, drag: Awaited<ReturnType<typeof hold>>) {
  await mark(page, "shake");
  // Ten half-strokes take at least620ms (40*8+10*30), with every native
  // inter-sample gap below160ms. A single fling is a separate negative case.
  for (let i = 0; i < 10; i++) {
    await drag.move({ x: drag.centre.x + (i % 2 ? -100 : 100), y: drag.centre.y }, 4, 8);
    await page.waitForTimeout(30);
  }
}
function assertVisibleIdentity(frames: Frame[]) {
  expect(frames.length).toBeGreaterThan(20);
  expect(frames.every(frame => frame.same && !frame.hidden && Number.isFinite(frame.x) && Number.isFinite(frame.y))).toBe(true);
}

for (const [surface, mode] of [["viewer", "full"], ["studio", "full"], ["viewer", "lite"]] as const) {
  test(`${surface} ${mode}: repeated native shaking keeps the grip and recovers only after real landing`, async ({ page }) => {
    test.setTimeout(25000); await setup(page, surface, mode); await startProbe(page);
    const label = `${surface}-${mode}-positive`, saved = await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"));
    let proof: Awaited<ReturnType<typeof finishProbe>> | undefined;
    const drag = await hold(page);
    try {
      await shake(page, drag); await expect(pet(page)).toHaveAttribute("data-held-dizzy", ""); await expect(pet(page)).toHaveAttribute("data-state", "held");
      mkdirSync(output, { recursive: true }); await page.screenshot({ path: `${output}/${label}-held.png` });
      await drag.release(); await expect(pet(page)).toHaveAttribute("data-play", "dizzy", { timeout: 5000 });
      await page.screenshot({ path: `${output}/${label}-dizzy.png` });
      await expect(pet(page)).not.toHaveAttribute("data-play", "dizzy", { timeout: 5000 });
      await expect(pet(page)).not.toHaveAttribute("data-held-dizzy"); await page.waitForTimeout(200);
    } finally { await drag.dispose(); proof = await finishProbe(page, label); }
    const frames = proof.frames, displayedHeld = frames.filter(frame => frame.dizzy && frame.state === "held" && frame.captured), held = displayedHeld.filter(frame => frame.comparable);
    assertVisibleIdentity(frames); expect(held.length, "the moving creature must supply more than five fresh aligned display frames").toBeGreaterThan(5);
    expect(held.every(frame => frame.gripError < .2 && frame.pivotError < .25)).toBe(true);
    expect(displayedHeld.every(frame => frame.row === 22 && frame.posePivotError < .1 && frame.scaleY > 1.15)).toBe(true);
    expect(new Set(displayedHeld.map(frame => frame.facing)).size).toBe(1);
    const released = proof.events.find(event => event.type === "pointerup")!;
    expect(released).toBeDefined();
    const after = frames.filter(frame => frame.at >= released.at), falling = after.filter(frame => frame.state === "jump"), dizzy = after.filter(frame => frame.play === "dizzy" && frame.beat === "dizzy"), recover = after.filter(frame => frame.play === "dizzy" && frame.beat === "recover");
    expect(falling.length).toBeGreaterThan(5); expect(dizzy.length).toBeGreaterThan(5); expect(recover.length).toBeGreaterThan(3);
    expect(falling[0].at).toBeLessThan(dizzy[0].at); expect(falling.at(-1)!.at).toBeLessThan(dizzy[0].at); expect(dizzy.at(-1)!.at).toBeLessThan(recover[0].at);
    expect(Math.max(...falling.map(frame => frame.y)) - Math.min(...falling.map(frame => frame.y))).toBeGreaterThan(8);
    const landed = [...dizzy, ...recover]; expect(landed.every(frame => frame.state === "play" && frame.platform !== "" && !frame.captured)).toBe(true);
    expect(dizzy.every(frame => frame.row === 22)).toBe(true); expect(recover.every(frame => frame.row === 23)).toBe(true);
    expect(Math.max(...landed.map(frame => frame.y)) - Math.min(...landed.map(frame => frame.y))).toBeLessThan(1);
    expect(Math.max(...landed.map(frame => frame.x)) - Math.min(...landed.map(frame => frame.x))).toBeLessThan(1);
    expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanion"))).toBe(saved);
  });
}

for (const mode of ["full", "reduced", "off"] as const) {
  test(`viewer ${mode}: ${mode === "full" ? "one fast fling" : "repeated shaking"} does not trigger dizziness`, async ({ page }) => {
    await setup(page, "viewer", mode); await startProbe(page); const drag = await hold(page), label = `viewer-${mode}-negative`;
    let proof: Awaited<ReturnType<typeof finishProbe>> | undefined;
    try {
      if (mode === "full") { await mark(page, "fling"); await drag.move({ x: drag.centre.x + 550, y: drag.centre.y }, 1, 0); await page.waitForTimeout(120); }
      else await shake(page, drag);
      await expect(pet(page)).not.toHaveAttribute("data-held-dizzy"); await drag.release();
      await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 5000 }); await page.waitForTimeout(1300);
    } finally { await drag.dispose(); proof = await finishProbe(page, label); }
    assertVisibleIdentity(proof.frames); expect(proof.frames.every(frame => !frame.dizzy && frame.play !== "dizzy")).toBe(true);
  });
}

test("viewer full: native lost pointer capture cancels an armed shake without a delayed recovery", async ({ page }) => {
  await setup(page, "viewer", "full"); await startProbe(page); const drag = await hold(page);
  let proof: Awaited<ReturnType<typeof finishProbe>> | undefined;
  try {
    await shake(page, drag); await expect(pet(page)).toHaveAttribute("data-held-dizzy", "");
    // Exercise the browser's actual capture cancellation. The observed native
    // pointer id is not product state and no app handler is called directly.
    await actor(page).evaluate(button => { const id = (window as unknown as ProbeWindow).heldShakeProbe.pointerId; if (!(button as HTMLElement).hasPointerCapture(id)) throw new Error("native pointer capture missing"); (button as HTMLElement).releasePointerCapture(id); });
    await page.mouse.move(1500, 600); await drag.release();
    await expect(pet(page)).not.toHaveAttribute("data-held-dizzy"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 5000 }); await page.waitForTimeout(1300);
  } finally { await drag.dispose(); proof = await finishProbe(page, "viewer-full-lost-capture"); }
  assertVisibleIdentity(proof.frames);
  const cancel = proof.events.find(event => event.type === "lostpointercapture"); expect(cancel).toBeDefined();
  const after = proof.frames.filter(frame => frame.at > cancel!.at + 80);
  expect(after.length).toBeGreaterThan(15); expect(after.every(frame => !frame.dizzy && frame.play !== "dizzy" && frame.state !== "held")).toBe(true);
});

test.describe("native touch cancellation", () => {
  test.use({ hasTouch: true });
  test("viewer full: native touchCancel clears an armed shake without a delayed recovery", async ({ page }) => {
    await setup(page, "viewer", "full"); await startProbe(page); const drag = await hold(page, true);
    let proof: Awaited<ReturnType<typeof finishProbe>> | undefined;
    try {
      await shake(page, drag); await expect(pet(page)).toHaveAttribute("data-held-dizzy", ""); await drag.cancel();
      await expect(pet(page)).not.toHaveAttribute("data-held-dizzy"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 5000 }); await page.waitForTimeout(1300);
    } finally { await drag.dispose(); proof = await finishProbe(page, "viewer-full-touch-cancel"); }
    assertVisibleIdentity(proof.frames); const cancel = proof.events.find(event => event.type === "pointercancel"); expect(cancel).toBeDefined();
    const after = proof.frames.filter(frame => frame.at > cancel!.at + 80);
    expect(after.length).toBeGreaterThan(15); expect(after.every(frame => !frame.dizzy && frame.play !== "dizzy" && frame.state !== "held")).toBe(true);
  });
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Frame = { at: number; x: number; y: number; scale: number; matrix: number[]; hidden: boolean; state: string; presence: string; phase: string | null; overlay: string | null; platform: string; journey: string };
type WakeProbe = { frames: Frame[]; clicks: Frame[]; petFocus: number; raf: number; read: () => Frame; clicked: (event: Event) => void; focused: (event: FocusEvent) => void };
type ProbeWindow = Window & { wakeProbe: WakeProbe };
const pet = (page: Page) => page.locator(".vc-companion");
const settings = (page: Page) => page.getByRole("dialog", { name: "설정", exact: true });
const opener = (page: Page) => page.getByRole("button", { name: "설정", exact: true });
const posts = new WeakMap<Page, string[]>();
const distance = (a: Pick<Frame, "x" | "y">, b: Pick<Frame, "x" | "y">) => Math.hypot(a.x - b.x, a.y - b.y);

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function press(button: Locator, touch: boolean) { if (touch) await button.tap(); else await button.click(); }
async function setup(page: Page, reduced = false) {
  await page.addInitScript(({ epoch, epochKey, preferences, care, reduced }) => {
    localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
    // Deterministic idle before the window. Locomotion remains enabled so the
    // return's short decision guard is exercised rather than disabled in prefs.
    Math.random = () => 0;
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, reduced, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: true, sleep: false, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05 } });
  await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await page.waitForTimeout(180);
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-presence", "active");
}
async function point(page: Page) {
  return pet(page).evaluate(node => {
    const r = node.getBoundingClientRect(), size = parseFloat((node as HTMLElement).style.getPropertyValue("--vc-size"));
    return { x: r.left + r.width / 2, y: r.bottom, scale: r.width / size, platform: (node as HTMLElement).dataset.platform! };
  });
}
async function openParked(page: Page, touch = false) {
  await press(opener(page), touch); await expect(settings(page)).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-overlay", "quiet");
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 10000 });
  await page.waitForTimeout(400); // finish the finite entrance/perch spring
  // Choose the movement end of the existing utility list on the next genuine
  // decision, after the return/settle guard has completed.
  await page.evaluate(() => { Math.random = () => .999999; });
}
async function startFrames(page: Page) {
  await page.evaluate(() => {
    const node = document.querySelector<HTMLElement>(".vc-companion")!;
    const read = (): Frame => {
      const r = node.getBoundingClientRect(), size = parseFloat(node.style.getPropertyValue("--vc-size")), matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      return { at: performance.now(), x: r.left + r.width / 2, y: r.bottom, scale: r.width / size, matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f], hidden: node.hidden, state: node.dataset.state ?? "", presence: node.dataset.presence ?? "", phase: node.getAttribute("data-returning"), overlay: node.getAttribute("data-overlay"), platform: node.dataset.platform ?? "", journey: node.dataset.journey ?? "" };
    };
    const probe: WakeProbe = { frames: [], clicks: [], petFocus: 0, raf: 0, read, clicked: () => {}, focused: () => {} };
    (window as unknown as ProbeWindow).wakeProbe = probe;
    probe.clicked = event => { if ((event.target as Element | null)?.closest("[data-act=close-settings]")) probe.clicks.push(read()); };
    document.addEventListener("click", probe.clicked, true);
    probe.focused = event => { if (node.contains(event.target as Node)) probe.petFocus++; };
    document.addEventListener("focusin", probe.focused, true);
    const sample = () => { probe.frames.push(read()); probe.raf = requestAnimationFrame(sample); };
    probe.raf = requestAnimationFrame(sample);
  });
}
async function stopFrames(page: Page) {
  return page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).wakeProbe;
    cancelAnimationFrame(probe.raf); document.removeEventListener("click", probe.clicked, true); document.removeEventListener("focusin", probe.focused, true);
    const active = document.activeElement;
    return { frames: probe.frames, clicks: probe.clicks, petFocus: probe.petFocus, active: { tag: active?.tagName, action: active?.getAttribute("data-act"), inPet: Boolean(active?.closest(".vc-companion")) } };
  });
}
async function close(page: Page, touch = false) {
  await press(settings(page).locator("[data-act=close-settings]"), touch);
  await expect(settings(page)).toHaveCount(0);
  await expect(pet(page)).toHaveAttribute("data-returning", /^(wake|return|settle)$/);
}
async function complete(page: Page, awaitDecision = false) {
  await expect(pet(page)).not.toHaveAttribute("data-returning", { timeout: 6000 });
  await page.waitForTimeout(280);
  if (awaitDecision) {
    await expect.poll(() => pet(page).getAttribute("data-journey"), { timeout: 4000 }).toMatch(/\d/);
    await page.waitForTimeout(35); // include the first actual decision in the finite rAF probe
  }
  return stopFrames(page);
}
function fullReturn(result: { frames: Frame[]; clicks: Frame[] }, target: { x: number; y: number; scale: number; platform: string }, label: string, reduced = false) {
  const before = result.clicks[0]; expect(before).toBeTruthy();
  const frames = result.frames.filter(frame => frame.at >= before.at), moving = frames.filter(frame => frame.phase !== null);
  expect(frames.length).toBeGreaterThan(10); expect(frames.every(frame => !frame.hidden)).toBe(true);
  expect(moving.length).toBeGreaterThan(3);
  const phases = [...new Set(moving.map(frame => frame.phase))];
  const landed = moving.filter(frame => frame.phase === "settle"); expect(landed.length).toBeGreaterThan(2);
  expect(landed.every(frame => distance(frame, target) < 2 && Math.abs(frame.scale - target.scale) < .005 && frame.platform === target.platform)).toBe(true);
  const steps = moving.slice(1).map((frame, index) => ({ position: distance(frame, moving[index]), scale: Math.abs(frame.scale - moving[index].scale) }));
  const maxPositionStep = Math.max(...steps.map(step => step.position)), maxScaleStep = Math.max(...steps.map(step => step.scale));
  if (reduced) {
    expect(phases).not.toContain("return");
    expect(moving.every(frame => distance(frame, before) < 2 || distance(frame, target) < 2)).toBe(true);
  } else {
    expect(phases).toEqual(["wake", "return", "settle"]);
    const first = moving[0]; expect(distance(first, before)).toBeLessThan(1); expect(Math.abs(first.scale - before.scale)).toBeLessThan(.003);
    const middle = moving.filter(frame => frame.phase === "return" && distance(frame, before) > 2 && distance(frame, target) > 2);
    expect(new Set(middle.map(frame => `${frame.x.toFixed(2)},${frame.y.toFixed(2)},${frame.scale.toFixed(4)}`)).size).toBeGreaterThan(5);
    const gap = distance(before, target), scaleGap = Math.abs(before.scale - target.scale);
    expect(maxPositionStep).toBeLessThan(gap * .35 + 2);
    expect(maxScaleStep).toBeLessThan(scaleGap * .35 + .005);
    if (scaleGap > .05) expect(middle.some(frame => frame.scale > Math.min(before.scale, target.scale) + .02 && frame.scale < Math.max(before.scale, target.scale) - .02)).toBe(true);
  }
  const doneAt = frames.find(frame => frame.phase === null && frame.at > landed[0].at)?.at;
  expect(doneAt).toBeDefined();
  const stable = frames.filter(frame => frame.at >= doneAt! && frame.at <= doneAt! + 250);
  expect(stable.length).toBeGreaterThan(3);
  expect(stable.every(frame => !["walk", "jump"].includes(frame.state) && distance(frame, target) < 2)).toBe(true);
  const next = frames.find(frame => frame.at >= doneAt! && /^\d/.test(frame.journey));
  const nextDecisionGap = next ? Number(next.journey) - doneAt! : null;
  if (nextDecisionGap !== null) expect(nextDecisionGap).toBeGreaterThanOrEqual(300);
  console.log(JSON.stringify({ check: label, frames: frames.length, phases, travelFrames: moving.filter(frame => frame.phase === "return").length, scale: [before.scale, target.scale], distance: distance(before, target), firstFrameError: distance(moving[0], before), maxPositionStep, maxScaleStep, settleFrames: landed.length, initialStableFrames: stable.length, nextDecisionGap }));
}

test("desktop wake preserves its first display frame, handles reopening in flight and settles before the next decision", async ({ page }) => {
  test.setTimeout(40_000); await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  const target = await point(page), identity = (await pet(page).elementHandle())!;
  await openParked(page); const perch = await point(page); expect(distance(perch, target)).toBeGreaterThan(20);
  await startFrames(page); await close(page); await expect(pet(page)).toHaveAttribute("data-returning", "return"); await page.waitForTimeout(100);
  await press(opener(page), false); await expect(settings(page)).toBeVisible(); await expect(pet(page)).not.toHaveAttribute("data-returning");
  const partial = await stopFrames(page);
  expect(partial.frames.every(frame => !frame.hidden)).toBe(true);
  expect(partial.frames.filter(frame => frame.phase === "return").length).toBeGreaterThan(2);
  await expect(pet(page)).toHaveAttribute("data-overlay", "quiet"); await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 10000 });
  await page.waitForTimeout(400); await startFrames(page); await close(page);
  const result = await complete(page, true); fullReturn(result, target, "wake-desktop-reopen");
  expect(await identity.evaluate(node => node === document.querySelector(".vc-companion") && node.isConnected)).toBe(true);
  // This viewer settings sheet has no opener-restoration hook. Native removal
  // of its focused close button may leave BODY active; the companion must never
  // take that focus during its decorative wake/return or the next decision.
  expect(result.petFocus).toBe(0); expect(result.active.inPet).toBe(false);
  console.log(JSON.stringify({ check: "wake-desktop-focus", ...result.active, petFocus: result.petFocus }));
  await page.screenshot({ path: ".scratch-pw/companion-wake-desktop.png" }); await identity.dispose();
});

test.describe("real touch scaled return", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("the small window perch wakes and regains its real size through distinct middle frames", async ({ page }) => {
    test.setTimeout(25_000); await setup(page); const target = await point(page);
    await openParked(page, true); const perch = await point(page); expect(perch.scale).toBeLessThan(.9);
    await startFrames(page); await close(page, true); const result = await complete(page);
    fullReturn(result, target, "wake-touch-scale");
    await expect(pet(page)).toHaveAttribute("data-platform", target.platform);
    await expect(page.locator("[data-export-surface] .vc-companion")).toHaveCount(0);
    await page.evaluate(() => { Math.random = () => 0; });
    await openParked(page, true); await startFrames(page); await close(page, true);
    await expect(pet(page)).toHaveAttribute("data-returning", "wake");
    const heldFrom = await point(page), pickupAt = await page.evaluate(() => performance.now());
    expect(heldFrom.scale).toBeLessThan(.9);
    const hit = (await page.locator(".vc-actor").boundingBox())!, pointer = { x: hit.x + hit.width / 2, y: hit.y + hit.height / 2 };
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...pointer, id: 17 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: pointer.x + 14, y: pointer.y, id: 17 }] });
    await expect(pet(page)).not.toHaveAttribute("data-returning"); await expect(pet(page)).toHaveAttribute("data-state", "held");
    await page.waitForTimeout(300);
    const pickup = await stopFrames(page), adopted = pickup.frames.filter(frame => frame.at >= pickupAt && frame.phase === null);
    expect(adopted.length).toBeGreaterThan(3); expect(adopted.every(frame => !frame.hidden)).toBe(true);
    expect(distance(adopted[0], heldFrom)).toBeLessThan(24); expect(adopted[0].scale - heldFrom.scale).toBeLessThan(.12);
    expect(adopted.at(-1)!.scale).toBeGreaterThan(.98);
    expect(new Set(adopted.map(frame => frame.scale.toFixed(3))).size).toBeGreaterThan(2);
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 60, y: 700, id: 17 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await client.detach();
    await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await expect(pet(page)).toBeVisible();
    console.log(JSON.stringify({ check: "wake-touch-native-pickup", frames: adopted.length, firstPositionError: distance(adopted[0], heldFrom), initialScale: heldFrom.scale, firstScale: adopted[0].scale, finalScale: adopted.at(-1)!.scale }));
    await page.screenshot({ path: ".scratch-pw/companion-wake-touch.png" });
  });
});

test("reduced motion returns to the real support without intermediate travel", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, true); const target = await point(page);
  await openParked(page); const perch = await point(page); expect(distance(perch, target)).toBeGreaterThan(20);
  await startFrames(page); await close(page); const result = await complete(page); fullReturn(result, target, "wake-reduced", true);
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", target.platform);
});

test("blur during the finite return finishes safely and then releases geometry and DOM work", async ({ page }) => {
  test.setTimeout(25_000); await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page); const target = await point(page);
  await openParked(page); await startFrames(page); await close(page); await expect(pet(page)).toHaveAttribute("data-returning", "return");
  // This tests the app's focus-event branch, not native OS blur or OBS hardware.
  await page.evaluate(() => { Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false }); dispatchEvent(new FocusEvent("blur")); });
  await expect(pet(page)).not.toHaveAttribute("data-returning", { timeout: 6000 }); await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
  const result = await stopFrames(page); fullReturn(result, target, "wake-blur");
  await expect(pet(page)).toBeVisible(); expect(await page.evaluate(() => document.hidden)).toBe(false);
  await page.waitForTimeout(1100);
  const quiet = await pet(page).evaluate(node => new Promise<{ ranges: number; writes: number }>(resolve => {
    let ranges = 0, writes = 0; const original = Range.prototype.getClientRects;
    Range.prototype.getClientRects = function () { ranges++; return original.call(this); };
    const observer = new MutationObserver(records => { writes += records.length; }); observer.observe(node, { attributes: true, subtree: true });
    setTimeout(() => { observer.disconnect(); Range.prototype.getClientRects = original; resolve({ ranges, writes }); }, 350);
  }));
  expect(quiet).toEqual({ ranges: 0, writes: 0 }); console.log(JSON.stringify({ check: "wake-blur-quiet", ...quiet }));
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Frame = { at: number; x: number; y: number; scale: number; matrix: number[]; hidden: boolean; state: string; presence: string; phase: string | null; overlay: string | null; platform: string; journey: string };
type WakeProbe = { frames: Frame[]; clicks: Frame[]; opens: Frame[]; petFocus: number; raf: number; read: () => Frame; clicked: (event: Event) => void; focused: (event: FocusEvent) => void };
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
    // Keep autonomous choices deterministic without disabling locomotion.
    // Ordinary windows finish the current action, then wake in that same place.
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
  await expect(pet(page)).not.toHaveAttribute("data-returning");
  await expect.poll(() => page.evaluate(() => {
    const probe = (window as unknown as ProbeWindow).wakeProbe;
    return !probe || probe.frames.at(-1)?.presence === "parked";
  })).toBe(true);
}
async function startFrames(page: Page) {
  await page.evaluate(() => {
    const node = document.querySelector<HTMLElement>(".vc-companion")!;
    const read = (): Frame => {
      const r = node.getBoundingClientRect(), size = parseFloat(node.style.getPropertyValue("--vc-size")), matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      return { at: performance.now(), x: r.left + r.width / 2, y: r.bottom, scale: r.width / size, matrix: [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f], hidden: node.hidden, state: node.dataset.state ?? "", presence: node.dataset.presence ?? "", phase: node.getAttribute("data-returning"), overlay: node.getAttribute("data-overlay"), platform: node.dataset.platform ?? "", journey: node.dataset.journey ?? "" };
    };
    const probe: WakeProbe = { frames: [], clicks: [], opens: [], petFocus: 0, raf: 0, read, clicked: () => {}, focused: () => {} };
    (window as unknown as ProbeWindow).wakeProbe = probe;
    probe.clicked = event => {
      if ((event.target as Element | null)?.closest("[data-act=close-settings]")) probe.clicks.push(read());
      if ((event.target as Element | null)?.closest("[data-act=open-settings]")) probe.opens.push(read());
    };
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
    return { frames: probe.frames, clicks: probe.clicks, opens: probe.opens, petFocus: probe.petFocus, active: { tag: active?.tagName, action: active?.getAttribute("data-act"), inPet: Boolean(active?.closest(".vc-companion")) } };
  });
}
async function close(page: Page, touch = false, reduced = false) {
  await press(settings(page).locator("[data-act=close-settings]"), touch);
  await expect(settings(page)).toHaveCount(0);
  await expect(pet(page)).not.toHaveAttribute("data-returning");
  if (!reduced) await expect(pet(page)).toHaveAttribute("data-presence", "waking");
}
async function complete(page: Page) {
  await expect(pet(page)).toHaveAttribute("data-presence", "active", { timeout: 6000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as ProbeWindow).wakeProbe.frames.some(frame => frame.presence === "active"))).toBe(true);
  return stopFrames(page);
}
async function observedWake(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as unknown as ProbeWindow).wakeProbe.frames.filter(frame => frame.presence === "waking").length)).toBeGreaterThan(3);
  await expect(pet(page)).toHaveAttribute("data-presence", "waking");
}
function stationaryWake(result: { frames: Frame[]; clicks: Frame[]; petFocus: number; active: { inPet: boolean } }, target: { x: number; y: number; scale: number; platform: string }, label: string, terminal: "active" | "parked" = "active", reduced = false) {
  const before = result.clicks[0]; expect(before).toBeTruthy();
  const frames = result.frames.filter(frame => frame.at >= before.at);
  expect(frames.length).toBeGreaterThan(10); expect(frames.every(frame => !frame.hidden)).toBe(true);
  const waking = frames.filter(frame => frame.presence === "waking");
  // Reduced motion may omit the intermediate pose on its coarse display
  // cadence. Its real support, identity and absence of travel still apply.
  if (!reduced) expect(waking.length).toBeGreaterThan(3);
  const done = frames.find(frame => frame.at > (waking[0]?.at ?? before.at) && frame.presence === terminal); expect(done).toBeDefined();
  const transition = frames.filter(frame => frame.at <= done!.at);
  expect(transition.every(frame => frame.phase === null && !["walk", "jump", "return", "land"].includes(frame.state))).toBe(true);
  expect(transition.every(frame => distance(frame, target) < 2 && Math.abs(frame.scale - target.scale) < .005 && frame.platform === target.platform)).toBe(true);
  const first = frames[0]; expect(distance(first, before)).toBeLessThan(1); expect(Math.abs(first.scale - before.scale)).toBeLessThan(.003);
  expect(waking.every(frame => frame.state === "wake")).toBe(true);
  expect(result.petFocus).toBe(0); expect(result.active.inPet).toBe(false);
  console.log(JSON.stringify({ check: label, frames: transition.length, presence: [...new Set(transition.map(frame => frame.presence))], wakingFrames: waking.length, travelFrames: transition.filter(frame => frame.phase !== null).length, firstFrameError: distance(first, before), maximumDisplacement: Math.max(...transition.map(frame => distance(frame, target))), petFocus: result.petFocus }));
}

test("desktop windows finish the current action and wake in place, including reopening while waking", async ({ page }) => {
  test.setTimeout(40_000); await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  const identity = (await pet(page).elementHandle())!;
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  // Give the ordinary window a real finite action to finish. This is the
  // user's keyboard lift/release, not an invented route or renderer hook.
  await actor.focus(); await actor.press("Space");
  for (let i = 0; i < 4; i++) await actor.press("ArrowUp");
  await actor.press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "jump");
  await startFrames(page); await openParked(page);
  const entrance = await stopFrames(page), opened = entrance.opens[0]; expect(opened).toBeTruthy();
  expect(opened.state).toBe("jump"); expect(opened.journey).toMatch(/^\d/);
  const remaining = entrance.frames.filter(frame => frame.at >= opened.at && frame.journey === opened.journey);
  expect(remaining.length).toBeGreaterThan(3); expect(remaining.every(frame => !frame.hidden && frame.state === "jump" && frame.phase === null)).toBe(true);
  expect(remaining.some(frame => distance(frame, opened) > 5)).toBe(true);
  const quietFrames = entrance.frames.filter(frame => frame.at >= opened.at);
  expect(quietFrames.every(frame => !frame.hidden && frame.phase === null && (!frame.journey || frame.journey === opened.journey))).toBe(true);
  expect(quietFrames.some(frame => frame.presence === "yawning")).toBe(true);
  const target = await point(page);
  expect(entrance.frames.at(-1)?.presence).toBe("parked");
  expect(await identity.evaluate(node => node === document.querySelector(".vc-companion") && node.isConnected)).toBe(true);
  await startFrames(page); await close(page); await observedWake(page);
  await openParked(page);
  const partial = await stopFrames(page);
  expect(partial.opens[0]?.presence).toBe("waking"); stationaryWake(partial, target, "wake-desktop-interrupted", "parked");
  await startFrames(page); await close(page);
  const result = await complete(page); stationaryWake(result, target, "wake-desktop-reopen");
  expect(await identity.evaluate(node => node === document.querySelector(".vc-companion") && node.isConnected)).toBe(true);
  // This viewer settings sheet has no opener-restoration hook. Native removal
  // of its focused close button may leave BODY active; the companion must never
  // take that focus during its decorative wake or the next decision.
  expect(result.petFocus).toBe(0); expect(result.active.inPet).toBe(false);
  console.log(JSON.stringify({ check: "wake-desktop-focus", ...result.active, petFocus: result.petFocus }));
  await page.screenshot({ path: ".scratch-pw/companion-wake-desktop.png" }); await identity.dispose();
});

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.

test("reduced motion wakes on its existing support without intermediate travel", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, true); const target = await point(page);
  const identity = (await pet(page).elementHandle())!;
  await openParked(page); expect(distance(await point(page), target)).toBeLessThan(2);
  await startFrames(page); await close(page, false, true); const result = await complete(page); stationaryWake(result, target, "wake-reduced", "active", true);
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", target.platform);
  expect(await identity.evaluate(node => node === document.querySelector(".vc-companion") && node.isConnected)).toBe(true); await identity.dispose();
});

test("blur while waking rests in place and then releases geometry and DOM work", async ({ page }) => {
  test.setTimeout(25_000); await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  await openParked(page); const target = await point(page); await startFrames(page); await close(page); await observedWake(page);
  // This tests the app's focus-event branch, not native OS blur or OBS hardware.
  await page.evaluate(() => { Object.defineProperty(document, "hasFocus", { configurable: true, value: () => false }); dispatchEvent(new FocusEvent("blur")); });
  await expect(pet(page)).not.toHaveAttribute("data-returning", { timeout: 6000 }); await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 8000 });
  await expect.poll(() => page.evaluate(() => (window as unknown as ProbeWindow).wakeProbe.frames.at(-1)?.presence)).toBe("parked");
  const result = await stopFrames(page); stationaryWake(result, target, "wake-blur", "parked");
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

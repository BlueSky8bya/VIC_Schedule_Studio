import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { companionSpriteSources } from "@/lib/ui/viewer-companion/sprite-quality";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const contactOutput = process.env.COMPANION_CONTACT_OUTPUT ?? ".scratch-pw";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const hand = (page: Page) => pet(page).locator(".vc-petting-hand");
const marks = (page: Page) => page.locator("[data-vc-petting-cursor]");
const affection = (page: Page) => page.getByRole("meter", { name: "빅타민 친밀도", exact: true }).evaluate(node => (node as HTMLMeterElement).value);
const posts = new WeakMap<Page, string[]>();
type Point = { x: number; y: number };
type Body = Point & { size: number };
type Frame = { at: number; x: number; y: number; hidden: boolean; mode: string | null; handCount: number; cursor: string; poseX: number; poseY: number; bob: number; originError: number; lowerBodyY: number; state: string; facing: string; textureCell: string };
type Probe = { frames: Frame[]; pointer: Point; losses: number; hiddenChanges: number; captures: number; raf: number; observer: MutationObserver; move: (event: PointerEvent) => void; capture: () => void; node: Element };
type ProbeWindow = Window & { contactContinuityProbe?: Probe };
type FocusFixtureWindow = Window & { companionFixtureFocused?: boolean };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => { if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); } return route.continue(); });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, reduced = false, mobile = false): Promise<Body> {
  await page.addInitScript(({ key, epoch, preferences, care, reduced }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off"); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences })); localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); Math.random = () => 0;
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, reduced, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05 } });
  if (!mobile) await page.setViewportSize({ width: 1920, height: 1400 });
  await page.goto("/visual-fixture/poster?avatar=1"); await page.bringToFront(); await expect(pet(page)).toBeVisible();
  // Desktop hover assertions read the room's live care meter. Mobile pickup
  // does not need that panel; opening its compact room can cover the creature.
  if (!mobile) await openCompanionHome(page);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await page.waitForTimeout(180); await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd"); await expect(pet(page)).toHaveAttribute("data-presence", "active");
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  return pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom, size: r.width }; });
}
async function ready(page: Page, p: Point) {
  await page.mouse.move(p.x, p.y); await expect(pet(page)).toHaveAttribute("data-petting", /^(ready|touch|hover)$/); await expect(hand(page)).toHaveCount(0);
}
async function probe(page: Page, pointer: Point) {
  await pet(page).evaluate((node, pointer) => {
    const p: Probe = { frames: [], pointer, losses: 0, hiddenChanges: 0, captures: 0, raf: 0, node,
      observer: new MutationObserver(records => { const petting = records.filter(r => r.attributeName === "data-petting"); for (let i = 0; i < petting.length; i++) if ((i + 1 < petting.length ? petting[i + 1].oldValue : node.getAttribute("data-petting")) === null) p.losses++; if (records.some(r => r.attributeName === "hidden")) p.hiddenChanges++; }),
      move: e => { p.pointer = { x: e.clientX, y: e.clientY }; }, capture: () => { p.captures++; },
    };
    p.observer.observe(node, { attributes: true, attributeFilter: ["data-petting", "hidden"], attributeOldValue: true });
    document.addEventListener("pointermove", p.move, { capture: true, passive: true }); document.addEventListener("gotpointercapture", p.capture, true);
    const began = performance.now();
    const sample = (now: number) => {
      const el = node as HTMLElement, r = node.getBoundingClientRect(), pose = getComputedStyle(node.querySelector(".vc-pose")!), m = new DOMMatrixReadOnly(pose.transform), hit = document.elementFromPoint(p.pointer.x, p.pointer.y);
      const [ox, oy] = pose.transformOrigin.split(" ").map(parseFloat), [gx, gy] = getComputedStyle(node.querySelector(".vc-inertia")!).transformOrigin.split(" ").map(parseFloat), facing = new DOMMatrixReadOnly(getComputedStyle(node.querySelector(".vc-facing")!).transform).a;
      p.frames.push({ at: now - began, x: r.left + r.width / 2, y: r.bottom, hidden: el.hidden || getComputedStyle(node).display === "none", mode: el.getAttribute("data-petting"), handCount: node.querySelectorAll(".vc-petting-hand").length, cursor: hit ? getComputedStyle(hit).cursor : "", poseX: Math.hypot(m.a, m.b), poseY: Math.hypot(m.c, m.d), bob: m.f,
        originError: Math.hypot(ox - (facing < 0 ? r.width - gx : gx), oy - gy), lowerBodyY: oy + m.b * (46 - ox) + m.d * (76 - oy) + m.f - 76, state: el.dataset.state ?? "", facing: el.dataset.facing ?? "", textureCell: node.querySelector<HTMLImageElement>(".vc-texture")?.style.transform ?? "" });
      p.raf = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).contactContinuityProbe = p; p.raf = requestAnimationFrame(sample);
  }, pointer);
}
async function finish(page: Page, label: string) {
  const result = await page.evaluate(() => { const p = (window as ProbeWindow).contactContinuityProbe!; cancelAnimationFrame(p.raf); p.observer.disconnect(); document.removeEventListener("pointermove", p.move, true); document.removeEventListener("gotpointercapture", p.capture, true); return { frames: p.frames, losses: p.losses, hiddenChanges: p.hiddenChanges, captures: p.captures, sameDom: document.querySelector(".vc-companion") === p.node }; });
  await writeFile(`${contactOutput}/companion-058-contact-${label}.json`, JSON.stringify(result, null, 2)); expect(result.sameDom).toBe(true); expect(result.frames.length).toBeGreaterThan(12); expect(result.frames.every(f => !f.hidden)).toBe(true); expect(result.hiddenChanges).toBe(0); return result;
}
async function move(page: Page, p: Point, steps = 12) { await page.mouse.move(p.x, p.y, { steps }); await page.waitForTimeout(30); }

for (const axis of ["x", "y"] as const) test(`${axis}-axis round trips retain contact without hands through the fifty-percent excursion or extra affection`, async ({ page }) => {
  const p = await setup(page), center = { x: p.x, y: p.y - p.size * .45 }, initial = await affection(page);
  const route = axis === "x" ? [{ x: p.x - p.size * .2, y: center.y }, { x: p.x + p.size * .2, y: center.y }, { x: p.x + p.size * 1.13, y: center.y }, { x: p.x - p.size * 1.13, y: center.y }, center]
    : [{ x: p.x, y: p.y - p.size * .65 }, { x: p.x, y: p.y - p.size * .30 }, { x: p.x, y: p.y - p.size * 1.49 }, center];
  // The full path must be real clear calendar space. Native controls outrank
  // retention, so a fixture with a button on this route cannot prove it.
  expect(await page.evaluate(points => points.every((point, index) => {
    const from = points[Math.max(0, index - 1)], steps = Math.max(1, Math.ceil(Math.hypot(point.x - from.x, point.y - from.y) / 8));
    for (let step = 0; step <= steps; step++) {
      const hit = document.elementFromPoint(from.x + (point.x - from.x) * step / steps, from.y + (point.y - from.y) * step / steps);
      if (!hit || (hit.closest("button,a,input,select,textarea,[role=button]") && !hit.closest(".vc-companion"))) return false;
    }
    return true;
  }), route)).toBe(true);
  await ready(page, route[0]); await move(page, route[1]); await probe(page, route[1]);
  for (const point of route.slice(2)) await move(page, point, 24);
  await expect.poll(async () => await affection(page) - initial).toBeGreaterThan(.07); const awarded = await affection(page); expect(awarded - initial).toBeLessThan(.09);
  await page.waitForTimeout(650); const result = await finish(page, axis);
  expect(result.losses).toBe(0); expect(result.captures).toBe(0); expect(result.frames.every(f => f.mode && f.handCount === 0 && f.cursor !== "none")).toBe(true);
  expect(await affection(page)).toBeLessThanOrEqual(awarded + .001);
  await page.screenshot({ path: `${contactOutput}/companion-058-contact-${axis}.png` });
  await move(page, { x: p.x + p.size * 1.19, y: center.y }); await expect(pet(page)).not.toHaveAttribute("data-petting"); await expect(hand(page)).toHaveCount(0); await expect(marks(page)).toHaveCount(0);
});

test("retention yields to a native neighbouring button before reversal or click", async ({ page }) => {
  const p = await setup(page), y = p.y - p.size * .45, initial = await affection(page);
  await page.evaluate(({ x, y }) => { const b = document.createElement("button"); b.type = "button"; b.id = "contact-native-neighbour"; b.textContent = "조작"; Object.assign(b.style, { position: "fixed", left: `${x + 72}px`, top: `${y - 12}px`, width: "24px", height: "24px", padding: "0", zIndex: "80", cursor: "pointer" }); b.addEventListener("click", () => { b.dataset.clicked = "1"; }); document.body.append(b); }, { x: p.x, y });
  await ready(page, { x: p.x - 20, y }); await move(page, { x: p.x + 20, y }); await move(page, { x: p.x + 80, y });
  await expect(pet(page)).not.toHaveAttribute("data-petting"); await expect(hand(page)).toHaveCount(0); await expect(marks(page)).toHaveCount(0); const button = page.locator("#contact-native-neighbour"); expect(await button.evaluate(node => getComputedStyle(node).cursor)).toBe("pointer");
  expect(await affection(page)).toBeLessThanOrEqual(initial + .001); await button.click(); await expect(button).toHaveAttribute("data-clicked", "1");
});

test("reduced-motion retention starts only in the base and expires outside after real movement stops", async ({ page }) => {
  const p = await setup(page, true), y = p.y - p.size * .45, outside = { x: p.x + p.size * 1.10, y };
  await page.mouse.move(outside.x, outside.y); await expect(pet(page)).not.toHaveAttribute("data-petting"); await expect(hand(page)).toHaveCount(0); await expect(marks(page)).toHaveCount(0);
  await ready(page, { x: p.x, y }); await page.mouse.move(outside.x, outside.y); await expect(pet(page)).not.toHaveAttribute("data-petting"); await expect(hand(page)).toHaveCount(0);
  await ready(page, { x: p.x, y }); await move(page, { x: p.x + 12, y }); await move(page, outside);
  await expect(pet(page)).toHaveAttribute("data-petting", /^(ready|touch|hover)$/); await expect(hand(page)).toHaveCount(0); await page.waitForTimeout(350); await expect(pet(page)).toHaveAttribute("data-petting", /^(ready|touch|hover)$/); await expect(hand(page)).toHaveCount(0);
  await expect(pet(page)).not.toHaveAttribute("data-petting", /.+/, { timeout: 1300 }); await expect(hand(page)).toHaveCount(0); await expect(marks(page)).toHaveCount(0);
  await page.mouse.move(outside.x + 1, outside.y); await expect(pet(page)).not.toHaveAttribute("data-petting"); await expect(hand(page)).toHaveCount(0); await ready(page, { x: p.x, y });
});

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const mobile of [false]) test.describe(mobile ? "touch hanging tension" : "cold pointer hanging tension", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1400 }, hasTouch: mobile, isMobile: mobile });
  test("pickup retains the visible drawing, hangs below the grip and preserves keyboard focus feedback", async ({ page }) => {
    let unblock = () => {}, requested = false, heldRequests = 0; const gate = new Promise<void>(resolve => { unblock = resolve; });
    if (!mobile) for (const src of companionSpriteSources(8)) await page.route(`**${src}`, async route => { requested = true; heldRequests++; await gate; await route.continue(); });
    const p = await setup(page, false, mobile), box = (await actor(page).boundingBox())!, start = { x: box.x + box.width / 2, y: box.y + box.height * .3 }, target = { x: start.x + 18, y: start.y + 15 };
    const client = mobile ? await page.context().newCDPSession(page) : null;
    await probe(page, start);
    try {
      if (client) await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 57 }] }); else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
      for (let i = 1; i <= 8; i++) { const point = { x: start.x + (target.x - start.x) * i / 8, y: start.y + (target.y - start.y) * i / 8 }; if (client) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, id: 57 }] }); else await page.mouse.move(point.x, point.y); await page.waitForTimeout(16); }
      await expect(pet(page)).toHaveAttribute("data-state", "held");
      expect(await actor(page).evaluate(node => getComputedStyle(node).outlineStyle)).toBe("none");
      if (!mobile) {
        await expect.poll(() => requested).toBe(true);
        const retained = await pet(page).locator(".vc-texture").elementHandle(); expect(retained).not.toBeNull();
        const image = await retained!.evaluate(node => (node as HTMLImageElement).currentSrc || (node as HTMLImageElement).src);
        expect(companionSpriteSources(8).every(src => !image.includes(src))).toBe(true);
        await page.waitForTimeout(350); await expect(pet(page)).toBeVisible();
        expect(await retained!.evaluate(node => ({ same: node === document.querySelector(".vc-companion .vc-texture"), decoded: (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0, connected: node.isConnected }))).toEqual({ same: true, decoded: true, connected: true });
      }
      unblock(); await expect.poll(() => pet(page).locator(".vc-texture").evaluate(node => (node as HTMLImageElement).currentSrc || (node as HTMLImageElement).src)).toContain(companionSpriteSources(8)[0]);
      const decoded = await pet(page).locator(".vc-texture").elementHandle(); expect(decoded).not.toBeNull();
      await decoded!.evaluate(node => (node as HTMLImageElement).decode());
      await page.waitForTimeout(250); await page.waitForTimeout(650);
      const result = await finish(page, mobile ? "held-touch" : "held-cold"), settled = result.frames.filter(f => f.state === "held" && f.at > 450);
      expect(await decoded!.evaluate(node => ({ same: node === document.querySelector(".vc-companion .vc-texture"), decoded: (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0, connected: node.isConnected }))).toEqual({ same: true, decoded: true, connected: true });
      expect(new Set(settled.map(frame => frame.textureCell).filter(Boolean)).size).toBeGreaterThan(1);
      if (!mobile) expect(heldRequests).toBe(1);
      expect(settled.length).toBeGreaterThan(12); expect(settled.every(f => f.poseY >= 1.18 && f.poseY <= 1.32 && f.poseX < 1 && Math.abs(f.bob) < .001 && f.originError < .1 && f.lowerBodyY > .2)).toBe(true);
      expect(new Set(settled.map(f => f.facing)).size).toBe(1); expect(Math.max(...settled.map(f => f.x)) - Math.min(...settled.map(f => f.x))).toBeLessThan(.05); expect(Math.max(...settled.map(f => f.y)) - Math.min(...settled.map(f => f.y))).toBeLessThan(.05);
      await page.screenshot({ path: `${contactOutput}/companion-058-contact-held-${mobile ? "touch" : "cold"}.png` });
    } finally { unblock(); if (client) { await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await client.detach(); } else await page.mouse.up(); }
    await expect(pet(page)).not.toHaveAttribute("data-state", "held");
    if (!mobile) {
      await page.keyboard.press("Tab"); await actor(page).focus(); await expect(actor(page)).toBeFocused();
      // PLAN-064 replaces the circular ring with a visible neutral baseline.
      const cue = await actor(page).evaluate(node => {
        const style = getComputedStyle(node), before = getComputedStyle(node, "::before");
        return { focusVisible: node.matches(":focus-visible"), outline: style.outlineStyle, shadow: style.boxShadow, content: before.content, width: parseFloat(before.width), height: parseFloat(before.height), opacity: Number(before.opacity), rgb: before.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [] };
      });
      expect(cue.focusVisible).toBe(true); expect(cue.outline).toBe("none"); expect(cue.shadow).toBe("none");
      expect(cue.content).not.toBe("none"); expect(cue.width).toBe(24); expect(cue.height).toBe(2); expect(cue.opacity).toBeGreaterThanOrEqual(.6);
      expect(cue.rgb.length).toBeGreaterThanOrEqual(3); expect(cue.rgb[3] ?? 1).toBeGreaterThan(0); expect(Math.max(...cue.rgb.slice(0, 3)) - Math.min(...cue.rgb.slice(0, 3))).toBeLessThan(80);
    }
    expect(p.size).toBeCloseTo(92, 2);
  });
});

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const mobile of [false]) test.describe(mobile ? "controlled-focus touch pickup" : "controlled-focus pointer pickup", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1400 }, hasTouch: mobile, isMobile: mobile });
  test("native capture during the real800ms wake stays visible after leaving its old ledge (fixture focus override)", async ({ page }) => {
    test.setTimeout(25000);
    // Headless windows can both report focused. Control this one environmental
    // input explicitly, with genuine elapsed time and native pointer capture.
    // This is not an assertion about operating-system focus delivery.
    await page.addInitScript(() => { (window as FocusFixtureWindow).companionFixtureFocused = true; Object.defineProperty(document, "hasFocus", { configurable: true, value: () => (window as FocusFixtureWindow).companionFixtureFocused }); });
    await setup(page, false, mobile);
    await page.evaluate(() => { (window as FocusFixtureWindow).companionFixtureFocused = false; window.dispatchEvent(new Event("blur")); });
    await page.waitForTimeout(1800); await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 3000 });
    await page.evaluate(() => { (window as FocusFixtureWindow).companionFixtureFocused = true; window.dispatchEvent(new Event("focus")); });
    await expect(pet(page)).toHaveAttribute("data-presence", "waking");
    const box = (await actor(page).boundingBox())!, start = { x: box.x + box.width / 2, y: box.y + box.height * .3 }, client = mobile ? await page.context().newCDPSession(page) : null;
    await probe(page, start);
    try {
      if (client) await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 58 }] }); else { await page.mouse.move(start.x, start.y); await page.mouse.down(); }
      for (let i = 1; i <= 8; i++) { const point = { x: start.x + 20 * i / 8, y: start.y + 26 * i / 8 }; if (client) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...point, id: 58 }] }); else await page.mouse.move(point.x, point.y); await page.waitForTimeout(16); }
      await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.waitForTimeout(1200);
      const result = await finish(page, mobile ? "wake-touch" : "wake-pointer");
      expect(result.captures).toBe(1); expect(result.frames.filter(f => f.state === "held").length).toBeGreaterThan(20); expect(result.frames.at(-1)!.state).toBe("held");
      await expect(pet(page)).toHaveAttribute("data-presence", "active");
      console.log(JSON.stringify({ check: "controlled-focus-wake-pickup", nativeTouch: mobile, fixtureFocusOverride: true, frames: result.frames.length, hiddenFrames: result.frames.filter(f => f.hidden).length, hiddenMutations: result.hiddenChanges, sameDom: result.sameDom }));
    } finally { if (client) { await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await client.detach(); } else await page.mouse.up(); }
  });
});

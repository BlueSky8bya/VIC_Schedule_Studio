import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { openCompanionHome } from "./helpers/companion-home";

const contactOutput = process.env.COMPANION_CONTACT_OUTPUT ?? ".scratch-pw";
const pet = (page: Page) => page.locator(".vc-companion");
const hand = (page: Page) => pet(page).locator(".vc-petting-hand");
const marks = (page: Page) => page.locator("[data-vc-petting-cursor]");
const posts = new WeakMap<Page, string[]>();
type Point = { x: number; y: number; size: number };
type HoverFrame = { at: number; mode: string | null; handCount: number; cursor: string; marked: number; actor: { x: number; y: number; width: number; height: number } };
type Probe = { point: { x: number; y: number }; frames: HoverFrame[]; moves: number[]; losses: number; captures: number; raf: number; slow: boolean; observer: MutationObserver; move: (event: PointerEvent) => void; capture: () => void };
type ProbeWindow = Window & { hoverStabilityProbe?: Probe };

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function setup(page: Page, reduced: boolean) {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript(({ preferences, care, reduced }) => {
    localStorage.setItem("vic.settingsEpoch", "2026-09-04"); localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    Math.random = () => 0;
  }, { preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05 }, reduced });
  await page.goto("/visual-fixture/poster"); await page.bringToFront(); await expect(pet(page)).toBeVisible(); await openCompanionHome(page); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await page.waitForTimeout(180);
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  expect(await page.evaluate(() => document.hasFocus())).toBe(true);
  return pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom, size: r.width }; });
}
// Observe the live care meter. Device storage deliberately flushes ordinary
// active-time updates at most every5s, independently of hover feedback.
const affection = (page: Page) => page.getByRole("meter", { name: "빅타민 친밀도", exact: true }).evaluate(node => (node as HTMLMeterElement).value);
async function readyAt(page: Page, point: { x: number; y: number }) {
  await page.mouse.move(point.x, point.y);
  await expect(pet(page)).toHaveAttribute("data-petting", /^(ready|touch|hover)$/); await expect(hand(page)).toHaveCount(0);
  expect(await page.evaluate(point => { const hit = document.elementFromPoint(point.x, point.y); return hit ? getComputedStyle(hit).cursor : null; }, point)).not.toBe("none");
}
async function startProbe(page: Page, point: { x: number; y: number }) {
  await pet(page).evaluate((node, point) => {
    const probe: Probe = { point, frames: [], moves: [], losses: 0, captures: 0, raf: 0, slow: false,
      observer: new MutationObserver(records => {
        const changes = records.filter(record => record.attributeName === "data-petting");
        for (let i = 0; i < changes.length; i++) {
          const value = i + 1 < changes.length ? changes[i + 1].oldValue : node.getAttribute("data-petting");
          if (value === null) probe.losses++;
        }
      }),
      move: event => { if (probe.slow) probe.moves.push(Math.hypot(event.clientX - probe.point.x, event.clientY - probe.point.y)); probe.point = { x: event.clientX, y: event.clientY }; },
      capture: () => { probe.captures++; },
    };
    probe.observer.observe(node, { attributes: true, attributeFilter: ["data-petting"], attributeOldValue: true });
    document.addEventListener("pointermove", probe.move, { capture: true, passive: true }); document.addEventListener("gotpointercapture", probe.capture, true);
    const began = performance.now();
    const sample = (now: number) => {
      const hit = document.elementFromPoint(probe.point.x, probe.point.y), r = node.querySelector(".vc-actor")!.getBoundingClientRect();
      probe.frames.push({ at: now - began, mode: node.getAttribute("data-petting"), handCount: node.querySelectorAll(".vc-petting-hand").length, cursor: hit ? getComputedStyle(hit).cursor : "", marked: document.querySelectorAll("[data-vc-petting-cursor]").length, actor: { x: r.x, y: r.y, width: r.width, height: r.height } });
      probe.raf = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).hoverStabilityProbe = probe; probe.raf = requestAnimationFrame(sample);
  }, point);
}
async function stopProbe(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const p = (window as ProbeWindow).hoverStabilityProbe!; cancelAnimationFrame(p.raf); p.observer.disconnect(); document.removeEventListener("pointermove", p.move, true); document.removeEventListener("gotpointercapture", p.capture, true);
    return { frames: p.frames, moves: p.moves, losses: p.losses, captures: p.captures };
  });
  await writeFile(`${contactOutput}/companion-055-hover-${label}.json`, JSON.stringify(result, null, 2));
  expect(result.frames.length).toBeGreaterThan(50); expect(result.losses).toBe(0); expect(result.captures).toBe(0);
  expect(result.moves.length).toBeGreaterThan(80); expect(Math.max(...result.moves)).toBeLessThan(1);
  expect(result.frames.every(frame => frame.mode !== null && frame.handCount === 0 && frame.cursor !== "none" && frame.marked === 0)).toBe(true);
  const first = result.frames[0].actor;
  expect(result.frames.every(({ actor }) => Math.hypot(actor.x - first.x, actor.y - first.y) < .01 && Math.abs(actor.width - first.width) < .01 && Math.abs(actor.height - first.height) < .01)).toBe(true);
  console.log(JSON.stringify({ check: `hover-stability-${label}`, frames: result.frames.length, duration: result.frames.at(-1)!.at, slowEvents: result.moves.length, maxSlowStep: Math.max(...result.moves), dataLosses: result.losses, captures: result.captures }));
}

for (const reduced of [false, true]) test.describe(reduced ? "reduced hover cursor" : "full hover cursor", () => {
  test("ready, subpixel strokes, stationary rests and actor-margin crossings never swap cursors", async ({ page }) => {
    test.setTimeout(20000); const p = await setup(page, reduced), y = p.y - p.size * .42;
    const focus = page.locator('[data-panel-section-toggle="tag-filter"]'); await focus.focus();
    const initial = await affection(page), start = { x: p.x - 12, y };
    await readyAt(page, start); await startProbe(page, start);
    await page.waitForTimeout(900); await expect(pet(page)).toHaveAttribute("data-petting", "ready");
    expect(await affection(page)).toBeLessThanOrEqual(initial + .001); await expect(pet(page)).not.toHaveAttribute("data-state", "petted");
    await page.evaluate(() => { (window as ProbeWindow).hoverStabilityProbe!.slow = true; });
    for (const direction of [1, -1]) for (let i = 1; i <= 48; i++) {
      const x = direction === 1 ? start.x + i * .5 : start.x + 24 - i * .5;
      await page.mouse.move(x, y); await page.waitForTimeout(18);
    }
    await page.evaluate(() => { (window as ProbeWindow).hoverStabilityProbe!.slow = false; });
    // Cursor stability must also cover movements too slow to establish a
    // stroke. With tracing/transport overhead, fourteen .5px samples can take
    // longer than the real900ms gesture window around a reversal. Retain all
    //96 tiny samples above, then supply one clear native round trip for the
    // separate positive affection assertion; do not loosen that time window.
    expect(await affection(page)).toBeLessThanOrEqual(initial + .081);
    for (const x of [p.x - 18, p.x + 18, p.x - 18]) await page.mouse.move(x, y, { steps: 6 });
    await expect(pet(page)).toHaveAttribute("data-state", "petted"); const awarded = await affection(page);
    expect(awarded - initial).toBeGreaterThan(.06); expect(awarded - initial).toBeLessThan(.09);
    await page.waitForTimeout(900); await expect(pet(page)).toHaveAttribute("data-petting", "ready");
    expect(await affection(page)).toBeLessThanOrEqual(awarded + .001);
    // Traverse the smaller drag ellipse into passive left/right padding while
    // the authored happy pose changes. Input geometry must remain fixed.
    for (const offset of [.30, .60, .30, -.30, -.60, -.30]) await page.mouse.move(p.x + p.size * offset, y, { steps: 8 });
    await page.mouse.move(p.x + p.size * .68 + 3, y); // An established stroke retains the new50% overshoot.
    await page.waitForTimeout(120); await expect(pet(page)).toHaveAttribute("data-petting", /^(ready|touch|hover)$/); await expect(hand(page)).toHaveCount(0);
    await stopProbe(page, reduced ? "reduced" : "full"); await expect(focus).toBeFocused();
    await page.screenshot({ path: `${contactOutput}/companion-055-hover-${reduced ? "reduced" : "full"}.png` });
    await page.mouse.move(p.x + p.size * (.68 + .50) + 3, y); await expect(pet(page)).not.toHaveAttribute("data-petting"); await expect(hand(page)).toHaveCount(0); await expect(marks(page)).toHaveCount(0);
  });

  test("native neighbouring controls, document exit and an ordinary window release the cursor immediately", async ({ page }) => {
    const p: Point = await setup(page, reduced), y = p.y - p.size * .42, initial = await affection(page);
    await page.evaluate(({ x, y }) => {
      const button = document.createElement("button"); button.type = "button"; button.id = "hover-stability-neighbour"; button.textContent = "주변 조작";
      Object.assign(button.style, { position: "fixed", left: `${x + 42}px`, top: `${y - 12}px`, width: "24px", height: "24px", padding: "0", zIndex: "80", cursor: "pointer" });
      button.addEventListener("click", () => { button.dataset.clicked = String(Number(button.dataset.clicked ?? 0) + 1); }); document.body.append(button);
    }, { x: p.x, y });
    await page.mouse.move(p.x + 50, y); await readyAt(page, { x: p.x + 28, y });
    await page.mouse.move(p.x + 8, y); await page.mouse.move(p.x + 50, y);
    const control = page.locator("#hover-stability-neighbour");
    await expect(pet(page)).not.toHaveAttribute("data-petting"); await expect(hand(page)).toHaveCount(0); await expect(marks(page)).toHaveCount(0);
    expect(await control.evaluate(node => getComputedStyle(node).cursor)).toBe("pointer");
    expect(await affection(page)).toBeLessThanOrEqual(initial + .001); await expect(pet(page)).not.toHaveAttribute("data-state", "petted");
    await control.click(); await expect(control).toHaveAttribute("data-clicked", "1");
    await readyAt(page, { x: p.x - 50, y });
    await page.mouse.move(-5, -5); await expect(pet(page)).not.toHaveAttribute("data-petting"); await expect(hand(page)).toHaveCount(0); await expect(marks(page)).toHaveCount(0);
    // Keyboard opening leaves the physical mouse over the pet. Cleanup must
    // come from the actual overlay transition, not from moving to its opener.
    await readyAt(page, { x: p.x - 50, y });
    const settings = page.getByRole("button", { name: "설정", exact: true }); await settings.focus(); await expect(pet(page)).toHaveAttribute("data-petting", /^(ready|touch|hover)$/); await expect(hand(page)).toHaveCount(0); await settings.press("Enter");
    await expect(page.getByRole("dialog", { name: "설정", exact: true })).toBeVisible();
    await expect(pet(page)).toHaveAttribute("data-overlay", "quiet"); await expect(pet(page)).not.toHaveAttribute("data-petting"); await expect(hand(page)).toHaveCount(0); await expect(marks(page)).toHaveCount(0);
    await expect(pet(page).locator(".vc-actor")).not.toBeFocused();
  });
});

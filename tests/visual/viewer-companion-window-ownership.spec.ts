import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { expectCompanionBehindOverlay, waitForOverlayEntrance } from "./helpers/companion-overlay";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
type Frame = { at: number; x: number; y: number; hidden: boolean; same: boolean; returning: string | null; state: string; phase: string };
type WitnessWindow = Window & { ownershipWitness?: { frames: Frame[]; raf: number } };
const foot = (page: Page) => pet(page).evaluate(node => { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: m.m41 + 46, y: m.m42 + 92 }; });

test.use({ viewport: { width: 1920, height: 1100 } });
for (const studio of [false, true]) test(`${studio ? "studio" : "viewer"}: native detail window covers its pet without displacing or returning it`, async ({ page }) => {
  test.setTimeout(35000);
  const posts: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().method() === "POST" ? (posts.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed");
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: false, panelPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
  await page.goto(studio ? "/visual-fixture/studio?role=developer" : "/visual-fixture/poster");
  await page.evaluate(() => document.fonts.ready); await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  const cards = page.locator(studio ? '.studio-event-pill[data-companion-event="ordinary"]' : ".public-event:not(.teaser):not(.is-support)");
  const target = await cards.evaluateAll(nodes => nodes.map((node, index) => { const r = node.getBoundingClientRect(); return { index, x: r.left + r.width * .55, y: r.top - 12, top: r.top, width: r.width }; }).find(r => r.width > 100 && r.y > 290 && r.y < innerHeight - 200));
  expect(target).toBeDefined();
  await actor(page).focus(); await actor(page).press("p"); await page.mouse.click(target!.x, target!.y);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  const original = await foot(page), originalPlatform = await pet(page).getAttribute("data-platform");
  const identity = await pet(page).elementHandle();
  await pet(page).evaluate(node => {
    const witness = { frames: [] as Frame[], raf: 0 }, began = performance.now();
    const sample = (now: number) => { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform), el = node as HTMLElement; witness.frames.push({ at: now - began, x: m.m41 + 46, y: m.m42 + 92, hidden: el.hidden, same: node.isConnected && node === document.querySelector(".vc-companion"), returning: node.getAttribute("data-returning"), state: el.dataset.state ?? "", phase: el.dataset.presence ?? "" }); witness.raf = requestAnimationFrame(sample); };
    (window as WitnessWindow).ownershipWitness = witness; witness.raf = requestAnimationFrame(sample);
  });
  const card = cards.nth(target!.index);
  if (studio) await card.locator(".pill-main strong").dblclick(); else await card.click();
  const dialog = page.locator(studio ? ".event-editor-panel.is-edit" : ".agenda-detail-sheet");
  await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
  await expect.poll(async () => { const p = await foot(page); return Math.hypot(p.x - original.x, p.y - original.y); }).toBeLessThan(3);
  const before = (await dialog.boundingBox())!, grip = (await dialog.locator(studio ? ".editor-grab" : ".detail-grab").first().boundingBox())!;
  const to = { x: Math.max(12, Math.min(1920 - before.width - 12, original.x - before.width / 2)), y: Math.max(12, Math.min(1100 - before.height - 12, original.y - 46 - before.height / 2)) };
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + to.x - before.x, grip.y + grip.height / 2 + to.y - before.y, { steps: 18 }); await page.mouse.up();
  await waitForOverlayEntrance(dialog);
  const pane = (await dialog.boundingBox())!;
  expect(original.x).toBeGreaterThan(pane.x + 8); expect(original.x).toBeLessThan(pane.x + pane.width - 8);
  expect(original.y - 46).toBeGreaterThan(pane.y + 8); expect(original.y - 46).toBeLessThan(pane.y + pane.height - 8);
  await expectCompanionBehindOverlay(page, dialog);
  await expect(pet(page)).toHaveAttribute("data-presence", "parked", { timeout: 6000 });
  await expect(pet(page)).toHaveAttribute("data-dreaming", "");
  await page.screenshot({ path: `.scratch-pw/companion-069-${studio ? "studio" : "viewer"}-behind-window.png` });
  await dialog.locator(studio ? ".editor-close" : ".agenda-detail-close").click();
  // Studio retains the selected editor DOM; editorVisible closes its real
  // workspace/display state. The viewer's detail sheet is unmounted instead.
  if (studio) { await expect(page.locator(".studio-workspace")).not.toHaveClass(/editor-open/); await expect(dialog).toBeHidden(); }
  else await expect(dialog).toHaveCount(0);
  await page.waitForTimeout(1200);
  const frames = await page.evaluate(() => { const w = (window as WitnessWindow).ownershipWitness!; cancelAnimationFrame(w.raf); return w.frames; });
  await writeFile(`.scratch-pw/companion-069-${studio ? "studio" : "viewer"}-window-ownership.json`, JSON.stringify({ original, originalPlatform, frames, posts, errors }, null, 2));
  expect(frames.length).toBeGreaterThan(30); expect(frames.every(f => !f.hidden && f.same && f.returning === null)).toBe(true);
  expect(Math.max(...frames.map(f => Math.hypot(f.x - original.x, f.y - original.y)))).toBeLessThan(3);
  expect(await identity!.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
  await expect(pet(page)).toHaveAttribute("data-platform", originalPlatform!); expect(posts).toEqual([]); expect(errors).toEqual([]);
});

import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Sample = { at: number; hidden: boolean; same: boolean; busy: boolean; x: number; y: number; pointer: string };
type WitnessWindow = Window & { editorDragWitness?: { frames: Sample[]; raf: number } };
const pet = (page: Page) => page.locator(".vc-companion");
test.use({ viewport: { width: 1920, height: 1100 } });

for (const kind of ["schedule", "support", "period"] as const) test(`studio ${kind} native drag keeps the same visible creature and gates competing input`, async ({ page }) => {
  const posts: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().method() === "POST" ? (posts.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic_avatar_side", "left"); localStorage.removeItem("vic_panel_collapsed");
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: false, panelPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
  await page.goto("/visual-fixture/studio?role=owner&companionDrag=1");
  await page.evaluate(() => document.fonts.ready); await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  const source = page.locator(kind === "schedule" ? '.studio-event-pill[data-companion-event="ordinary"]' : kind === "period" ? ".support-bar.sb-period.sb-head" : '.support-bar[data-supportid="companion-drag-support"].sb-head').first();
  await expect(source).toBeVisible();
  if (kind === "schedule") {
    // Occupy the very card whose text the editor temporarily hides on pickup.
    const point = await source.evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width * .6, y: r.top - 12 }; });
    const actor = pet(page).locator(".vc-actor"); await actor.focus(); await actor.press("p"); await page.mouse.click(point.x, point.y);
    await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  }
  await pet(page).evaluate(node => {
    const witness = { frames: [] as Sample[], raf: 0 }, began = performance.now();
    const sample = (now: number) => { const el = node as HTMLElement, m = new DOMMatrixReadOnly(getComputedStyle(node).transform); witness.frames.push({ at: now - began, hidden: el.hidden, same: node.isConnected && node === document.querySelector(".vc-companion"), busy: el.hasAttribute("data-workspace-busy"), x: m.m41 + 46, y: m.m42 + 92, pointer: getComputedStyle(node.querySelector(".vc-actor")!).pointerEvents }); witness.raf = requestAnimationFrame(sample); };
    (window as WitnessWindow).editorDragWitness = witness; witness.raf = requestAnimationFrame(sample);
  });
  const r = (await source.boundingBox())!;
  await page.mouse.move(r.x + r.width * .4, r.y + r.height * .55); await page.mouse.down();
  await page.mouse.move(r.x + r.width * .4 + 35, r.y + r.height * .55 + 10, { steps: 12 });
  await expect(page.locator(".studio-shell")).toHaveAttribute("data-companion-workspace-busy", "");
  await expect(page.locator(kind === "schedule" ? ".event-drag-ghost" : ".span-drag-ghost")).toBeVisible();
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-workspace-busy", "");
  await page.waitForTimeout(450);
  // Native release outside the calendar cancels. Hold still first so this
  // deliberate cancellation cannot be mistaken for the editor's fling delete.
  await page.mouse.move(1900, 80, { steps: 18 }); await page.waitForTimeout(220); await page.mouse.up();
  await expect(page.locator(".studio-shell")).not.toHaveAttribute("data-companion-workspace-busy", "");
  await page.waitForTimeout(800);
  const frames = await page.evaluate(() => { const witness = (window as WitnessWindow).editorDragWitness!; cancelAnimationFrame(witness.raf); return witness.frames; });
  await writeFile(`.scratch-pw/companion-069-studio-drag-${kind}.json`, JSON.stringify({ frames, posts, errors }, null, 2));
  expect(frames.filter(f => f.busy).length).toBeGreaterThan(10);
  expect(frames.every(f => f.same && !f.hidden)).toBe(true);
  expect(frames.filter(f => f.busy).every(f => f.pointer === "none")).toBe(true);
  await expect(pet(page)).not.toHaveAttribute("data-workspace-busy", ""); await expect(pet(page)).toBeVisible();
  expect(posts).toEqual([]); expect(errors).toEqual([]);
  await page.screenshot({ path: `.scratch-pw/companion-069-studio-drag-${kind}.png` });
});

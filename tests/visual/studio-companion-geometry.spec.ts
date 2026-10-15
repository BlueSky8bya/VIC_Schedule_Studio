import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Sample = { at: number; scroll: number; foot: number; source: number; error: number; platform: string; state: string; hidden: boolean };
type WitnessWindow = Window & { studioFollowWitness?: { frames: Sample[]; raf: number } };
const pet = (page: Page) => page.locator(".vc-companion");

test.use({ viewport: { width: 1920, height: 900 } });
test("a real ordinary studio card carries its companion through native zoom and wheel scroll without editing", async ({ page }) => {
  test.setTimeout(30000);
  const posts: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => route.request().method() === "POST" ? (posts.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ epoch, key, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true }); Math.random = () => 0;
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
  await page.goto("/visual-fixture/studio?role=owner"); await page.evaluate(() => document.fonts.ready);
  await expect(pet(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  const target = await page.locator('.studio-event-pill[data-companion-event="ordinary"]').evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect(); return { id: (node as HTMLElement).dataset.eventid!, x: r.left + r.width / 2, y: r.top - 8 };
  }).find(point => point.y > 230 && point.y < innerHeight - 250));
  expect(target).toBeDefined();
  const card = page.locator(`.studio-event-pill[data-companion-event="ordinary"][data-eventid="${target!.id}"]`).first();
  const footError = () => card.evaluate(node => {
    const el = document.querySelector<HTMLElement>(".vc-companion")!, matrix = new DOMMatrixReadOnly(el.style.transform);
    return Math.abs(matrix.m42 + 92 - (node.getBoundingClientRect().top - 3));
  });
  // The user's explicit placement is consumed before the native editor card
  // can receive it. A viewport-floor fallback cannot satisfy this baseline.
  await pet(page).locator(".vc-actor").focus(); await pet(page).locator(".vc-actor").press("p"); await page.mouse.click(target!.x, target!.y);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump"); await expect.poll(footError).toBeLessThan(2);
  await expect(page.locator(".event-editor-panel.is-edit")).toHaveCount(0);

  const panel = page.locator(".studio-calendar-panel"), bounds = (await panel.boundingBox())!;
  // This sparse fixture genuinely overflows after the app's native200% zoom.
  // No spacer, style change, synthetic scroll or invented platform is added.
  await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + 10); await page.keyboard.down("Control");
  for (let step = 0; step < 4; step++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(250); }
  await page.keyboard.up("Control");
  await expect.poll(() => panel.evaluate(node => parseFloat(getComputedStyle(node).getPropertyValue("--cal-zoom")))).toBeGreaterThan(1.5);
  await expect.poll(footError).toBeLessThan(2); await expect(pet(page)).toBeVisible();
  const baseline = await card.evaluate(node => ({ top: node.getBoundingClientRect().top, scroll: scrollY, max: document.documentElement.scrollHeight - innerHeight }));
  expect(baseline.max).toBeGreaterThan(40);
  await card.evaluate(node => {
    const witness = { frames: [] as Sample[], raf: 0 }, began = performance.now();
    const sample = (now: number) => {
      const el = document.querySelector<HTMLElement>(".vc-companion")!, matrix = new DOMMatrixReadOnly(el.style.transform), source = node.getBoundingClientRect().top - 3, foot = matrix.m42 + 92;
      witness.frames.push({ at: now - began, scroll: scrollY, foot, source, error: Math.abs(foot - source), platform: el.dataset.platform ?? "", state: el.dataset.state ?? "", hidden: el.hidden }); witness.raf = requestAnimationFrame(sample);
    };
    (window as WitnessWindow).studioFollowWitness = witness; witness.raf = requestAnimationFrame(sample);
  });
  await page.mouse.move(bounds.x + bounds.width - 24, 700); await page.mouse.wheel(0, 240); await page.waitForTimeout(900);
  const frames = await page.evaluate(() => { const witness = (window as WitnessWindow).studioFollowWitness!; cancelAnimationFrame(witness.raf); return witness.frames; });
  await writeFile(".scratch-pw/companion-063-studio-follow.json", JSON.stringify({ target, baseline, frames }, null, 2));
  expect(frames.length).toBeGreaterThan(20); expect(Math.abs(frames.at(-1)!.source - frames[0].source)).toBeGreaterThan(40);
  const sorted = frames.map(frame => frame.error).sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * .95)];
  expect(p95).toBeLessThan(3); expect(frames.at(-1)!.error).toBeLessThan(2);
  expect(frames.every(frame => !frame.hidden && /^card-\d+-top(?:-\d+)?$/.test(frame.platform))).toBe(true);
  expect(frames.some(frame => frame.state === "jump")).toBe(false);
  await expect(page.locator(".event-editor-panel.is-edit")).toHaveCount(0);
  expect(posts).toEqual([]); expect(errors).toEqual([]);
  await page.screenshot({ path: ".scratch-pw/companion-063-studio-follow.png" });
  console.log(JSON.stringify({ check: "studio-public-card-actual-scroll", samples: frames.length, p95, finalError: frames.at(-1)!.error, sourceDelta: frames.at(-1)!.source - frames[0].source, footDelta: frames.at(-1)!.foot - frames[0].foot, posts: posts.length, errors: errors.length }));
});

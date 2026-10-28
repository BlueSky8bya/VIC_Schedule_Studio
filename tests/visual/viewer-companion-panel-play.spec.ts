import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { COMPANION_PANEL_SIDE_EVENT } from "@/lib/ui/viewer-companion/panel-play";
import { placeCompanionOnExposedBackground } from "./helpers/companion-outdoor";

type PanelFrame = { at: number; visible: boolean; same: boolean; reason?: string; platform?: string; state?: string; hidePhase?: string; hideEvent?: string; journey?: string; x: number; y: number };
async function startVisibilityProbe(page: Page) {
  await page.locator(".vc-companion").evaluate(node => {
    const frames: PanelFrame[] = [], original = node as HTMLElement;
    let raf = 0;
    const sample = () => {
      const rect = original.getBoundingClientRect();
      frames.push({ at: performance.now(), visible: !original.hidden && original.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        && rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
        same: original.isConnected && original === document.querySelector(".vc-companion"), reason: original.dataset.hiddenReason,
        platform: original.dataset.platform, state: original.dataset.state, hidePhase: original.dataset.hidePhase, hideEvent: original.dataset.hideEvent, journey: original.dataset.journey, x: rect.x, y: rect.y });
      raf = requestAnimationFrame(sample);
    };
    (window as Window & { companionPanelVisibility?: { frames: PanelFrame[]; stop: () => void } }).companionPanelVisibility = { frames, stop: () => cancelAnimationFrame(raf) };
    sample();
  });
}
async function finishVisibilityProbe(page: Page) {
  return page.evaluate(() => {
    const probe = (window as Window & { companionPanelVisibility?: { frames: PanelFrame[]; stop: () => void } }).companionPanelVisibility!;
    probe.stop(); return probe.frames;
  });
}

const RETIRED_PANEL_RETURN_MS = 7000;
const prefix = process.env.COMPANION_PANEL_PREFIX ?? ".scratch-pw/companion-069-panel";
const narrowVariant = Number(process.env.COMPANION_PANEL_WIDTH ?? 1920) < 1500;
const observations = new WeakMap<Page, { posts: string[]; errors: string[] }>();
test.use({ viewport: { width: Number(process.env.COMPANION_PANEL_WIDTH ?? 1920), height: Number(process.env.COMPANION_PANEL_HEIGHT ?? 1100) }, hasTouch: false, isMobile: false });
test.beforeEach(async ({ page }) => {
  const observed = { posts: [] as string[], errors: [] as string[] }; observations.set(page, observed);
  page.on("pageerror", error => observed.errors.push(error.message));
  await page.route("**/*", route => ["POST", "PUT", "PATCH", "DELETE"].includes(route.request().method()) ? (observed.posts.push(route.request().method() + " " + new URL(route.request().url()).pathname), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});

test("natural panel decision retains its real arrow contact through painted impact without a timed return", async ({ page }) => {
  test.skip(process.env.COMPANION_NATURAL_PANEL !== "1", "Explicit long-running native90s gate scenario");
  test.setTimeout(300_000);
  await page.addInitScript(({ key, epoch, preferences }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", v: 3, at: Date.now() }),
      "vic.reduceMotion": "off", "vic.ambient": "off", "vic.sound": "off", "vic_avatar_side": "left", "vic.premiereStage": "off",
      "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, roam: true, sleep: false, jump: false, feeding: false,
        petting: false, cardPrank: false, ambientPrank: false, heartPrank: false, panelPrank: true, rarePrank: false, learnFromYou: false, activeWhileVisible: true }) })) localStorage.setItem(name, value);
    localStorage.removeItem("vic_panel_collapsed");
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES });
  await page.goto("/visual-fixture/poster?avatar=1"); await page.bringToFront();
  const pet = page.locator(".vc-companion"), actor = pet.locator(".vc-actor"), right = page.locator('[data-companion-panel-side="right"]');
  await expect(actor).toBeVisible(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  const box = (await actor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(900, 600, { steps: 18 });
  await expect(pet).toHaveAttribute("data-state", "held");
  // Physical time and the real active brain run normally. Holding owns input,
  // preventing autonomous travel during the existing90s warmup.
  for (let part = 0; part < 3; part++) await page.waitForTimeout(31_000);
  await page.evaluate(name => {
    const events: unknown[] = [];
    (window as Window & { naturalPanelEvents?: unknown[] }).naturalPanelEvents = events;
    window.addEventListener(name, event => {
      const node = document.querySelector<HTMLElement>(".vc-companion");
      events.push({ at: performance.now(), state: node?.dataset.state, platform: node?.dataset.platform, accepted: event.defaultPrevented });
    });
  }, COMPANION_PANEL_SIDE_EVENT);
  const arrow = (await right.boundingBox())!, carrier = (await pet.boundingBox())!;
  const gripOffset = carrier.y + carrier.height - 600;
  await page.mouse.move(arrow.x + arrow.width / 2, arrow.y - 4 - gripOffset, { steps: 18 }); await page.waitForTimeout(190); await page.mouse.up();
  await startVisibilityProbe(page);
  let attempts = 0;
  const began = Date.now();
  while (Date.now() - began < 165_000 && !await page.evaluate(() => Boolean((window as Window & { naturalPanelEvents?: unknown[] }).naturalPanelEvents?.length))) {
    await page.waitForTimeout(850);
    if (await pet.getAttribute("data-state") === "panel") continue;
    if (await pet.getAttribute("data-platform") !== "panel-side-right") {
      await expect(actor).toBeVisible(); await actor.focus(); await actor.press("p");
      const arrow = (await right.boundingBox())!;
      await page.mouse.click(arrow.x + arrow.width / 2, arrow.y - 5); await page.mouse.move(2, 2); attempts++;
    }
  }
  const events = await page.evaluate(() => (window as Window & { naturalPanelEvents?: unknown[] }).naturalPanelEvents ?? []);
  if (events.length) await page.waitForTimeout(RETIRED_PANEL_RETURN_MS + 900);
  const frames = await finishVisibilityProbe(page);
  await writeFile(`${prefix}-natural.json`, JSON.stringify({ events, attempts, frames, ...observations.get(page), scope: "Native93s held warmup, actual RNG/brain/impact path; no timing/RNG/controller replacement" }, null, 2));
  expect(events, "The bounded real random decision must actually press the shared control").toHaveLength(1);
  expect(events[0]).toMatchObject({ state: "panel", accepted: true });
  expect(frames.filter(frame => !frame.same || !frame.visible)).toEqual([]);
});
test.afterEach(async ({ page }) => { expect(observations.get(page)).toEqual({ posts: [], errors: [] }); });

for (const surface of ["viewer", "studio"] as const) test(`${surface} actual arrow ${narrowVariant ? "callback with an exposed resident" : "perch"}, rejects remote requests and preserves the human choice`, async ({ page }) => {
  test.setTimeout(35000);
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.removeItem("vic_panel_collapsed");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  const expand = page.getByRole("button", { name: "패널 펼치기", exact: true });
  if (await expand.isVisible()) { await expand.click(); await page.waitForTimeout(650); }
  const pet = page.locator(".vc-companion"), actor = pet.locator(".vc-actor"), left = page.getByRole("button", { name: "패널을 왼쪽에 두기", exact: true }), right = page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true });
  await expect(actor).toBeVisible(); await expect(pet).toHaveAttribute("data-atlas", "hd");
  await expect(left).toHaveAttribute("aria-pressed", "true"); await expect(right).toBeVisible();
  const variant = { requested: process.env.COMPANION_PANEL_FOLD_SCROLL === "1", placement: narrowVariant ? "exposed-background" : "arrow-perch", homeFolded: false, beforeY: await page.evaluate(() => scrollY), afterY: 0 };
  if (narrowVariant) await placeCompanionOnExposedBackground(page, 900);
  if (variant.requested) {
    const fold = page.locator('.vc-home [data-home-action="fold"]:visible');
    if (await fold.count() && await fold.getAttribute("aria-expanded") === "true") await fold.click();
    variant.homeFolded = await fold.count() > 0 && await fold.getAttribute("aria-expanded") === "false";
    await page.evaluate(() => window.scrollTo({ top: 100, behavior: "instant" })); await page.waitForTimeout(650);
  }
  variant.afterY = await page.evaluate(() => scrollY);
  // Native controls place the foot just above the actual measured arrow.
  await expect(actor).toBeVisible();
  if (!narrowVariant) {
    const body = (await actor.boundingBox())!, carrier = (await pet.boundingBox())!, arrow = (await right.boundingBox())!;
    const start = { x: body.x + body.width / 2, y: body.y + body.height / 2 };
    const footOffset = carrier.y + carrier.height - start.y;
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(arrow.x + arrow.width / 2, arrow.y - 4 - footOffset, { steps: 18 });
    // A stationary tail makes this deliberate placement rather than a throw.
    await page.waitForTimeout(190); await page.mouse.up();
  }
  if (!narrowVariant) await expect(pet).toHaveAttribute("data-platform", "panel-side-right");
  const perch = await pet.evaluate(node => {
    const control = document.querySelector("[data-companion-panel-side='right']")!, body = node.getBoundingClientRect(), arrow = control.getBoundingClientRect();
    const hit = document.elementFromPoint(arrow.left + arrow.width / 2, arrow.top + arrow.height / 2);
    return { foot: body.bottom, top: arrow.top, controlReachable: hit === control || control.contains(hit) };
  });
  if (!narrowVariant) expect(Math.abs(perch.foot - (perch.top - 3))).toBeLessThan(2);
  expect(perch.controlReachable).toBe(true);
  // Remote custom events are not physical contact evidence and fail closed.
  const request = () => right.evaluate((node, name) => !node.dispatchEvent(new CustomEvent(name, { bubbles: true, cancelable: true, detail: { side: "right" } })), COMPANION_PANEL_SIDE_EVENT);
  expect(await request()).toBe(false); await expect(left).toHaveAttribute("aria-pressed", "true");
  await startVisibilityProbe(page);
  await right.click(); await expect(right).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => localStorage.getItem("vic_avatar_side"))).toBe("right");
  await page.waitForTimeout(RETIRED_PANEL_RETURN_MS + 150);
  await expect(right).toHaveAttribute("aria-pressed", "true");
  const transitionFrames = await finishVisibilityProbe(page);
  expect(transitionFrames.filter(frame => !frame.same || !frame.visible)).toEqual([]);
  await writeFile(`${prefix}-${surface}-transition.json`, JSON.stringify({ surface, viewport: page.viewportSize(), variant, transitionFrames, remoteRequestRejected: true, ...observations.get(page) }, null, 2));
  await page.screenshot({ path: `${prefix}-${surface}.png` });
  await writeFile(`${prefix}-${surface}.json`, JSON.stringify({ surface, perch, savedSide: await page.evaluate(() => localStorage.getItem("vic_avatar_side")), ...observations.get(page) }, null, 2));
});

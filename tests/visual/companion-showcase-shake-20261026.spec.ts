import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { enterCompanionMeadow, placeCompanionOnExposedBackground } from "./helpers/companion-outdoor";

const output = process.env.COMPANION_CONTINUITY_OUTPUT ?? ".scratch-pw/agenda-companion-detail";
type Frame = { at: number; state?: string; row?: string; pose?: string; reaction?: string; dizzy: boolean; visible: boolean; alpha: number };
type Witness = { frames: Frame[]; inputs: { type: string; at: number; receivedAt: number; x: number; y: number; buttons: number; trusted: boolean }[]; stop: () => void };
const pet = (page: Page) => page.locator(".vc-meadow-walk");
const actor = (page: Page) => pet(page).locator(".vc-meadow-walk-body");
test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block", storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method())) return route.abort();
    if (url.origin === origin && url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "synthetic fixture" });
    return route.continue();
  });
});

async function setup(page: Page, surface: string, reduced = false) {
  await page.addInitScript(({ preferences, epoch, key, reduced }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", v: 3, at: Date.now() }),
      "vic.ambient": "on", "vic.sound": "off", "vic.reduceMotion": reduced ? "on" : "off", "vic.premiereStage": "off", "vic_avatar_side": "left",
      "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, sleep: false, feeding: false, learnFromYou: false, panelPrank: false, heartPrank: false, ambientPrank: false }) })) localStorage.setItem(name, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, reduced });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?ambient=spring" : "/visual-fixture/studio?role=owner&y=2026&m=4");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  const section = page.locator('[data-panel-section-toggle="season"]:visible').first();
  if (await section.getAttribute("aria-expanded") === "false") await section.click();
  await placeCompanionOnExposedBackground(page, 180);
  await enterCompanionMeadow(page); await expect(pet(page)).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-painted-at", /\d/);
  await page.waitForTimeout(850);
}

async function observe(page: Page) {
  await pet(page).evaluate(node => {
    const host = node as HTMLElement, body = host.querySelector<HTMLElement>(".vc-meadow-walk-body")!, drawing = host.querySelector<HTMLCanvasElement>("canvas")!;
    const frames: Frame[] = [], inputs: Witness["inputs"] = []; let raf = 0, previousPose = "", alpha = 0;
    const input = (event: PointerEvent) => { if (event.target instanceof Element && event.target.closest(".vc-meadow-walk-body")) inputs.push({ type: event.type, at: event.timeStamp, receivedAt: performance.now(), x: event.clientX, y: event.clientY, buttons: event.buttons, trusted: event.isTrusted }); };
    const inputTypes = ["pointerdown", "pointermove", "pointerup", "pointercancel"];
    inputTypes.forEach(type => document.addEventListener(type, input as EventListener, true));
    const sample = () => {
      const poseKey = `${host.dataset.row}:${host.dataset.pose}`;
      if (poseKey !== previousPose) {
        const pixels = drawing.getContext("2d")!.getImageData(0, 0, drawing.width, drawing.height).data;
        alpha = 0; for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) alpha++; previousPose = poseKey;
      }
      frames.push({ at: performance.now(), state: host.dataset.state, row: host.dataset.row, pose: host.dataset.pose, reaction: host.dataset.reaction, dizzy: host.hasAttribute("data-held-dizzy"),
        visible: !host.hidden && body.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }), alpha });
      raf = requestAnimationFrame(sample);
    };
    (window as Window & { companionShowcaseWitness?: Witness }).companionShowcaseWitness = { frames, inputs, stop: () => { cancelAnimationFrame(raf); inputTypes.forEach(type => document.removeEventListener(type, input as EventListener, true)); } }; sample();
  });
}

async function flingAndRelease(page: Page) {
  const mouse = await page.context().newCDPSession(page), pending: Promise<unknown>[] = [];
  // Deliver one genuine native input stream without waiting for each painted
  // frame's protocol acknowledgement; receipts below retain its physical clock.
  for (const x of [840, 900, 960, 1020, 1080, 1140]) {
    pending.push(mouse.send("Input.dispatchMouseEvent", { type: "mouseMoved", x, y: 570, button: "left", buttons: 1, modifiers: 0 }));
    await new Promise(resolve => setTimeout(resolve, 12));
  }
  pending.push(mouse.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1140, y: 570, button: "left", buttons: 0, clickCount: 1, modifiers: 0 }));
  await Promise.all(pending); await mouse.detach();
}

async function shake(page: Page) {
  const box = (await actor(page).boundingBox())!, start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(900, 600, { steps: 18 }); await page.waitForTimeout(190);
  const mouse = await page.context().newCDPSession(page);
  for (const direction of [1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1]) {
    await mouse.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: 900 + direction * 80, y: 600, button: "left", buttons: 1, modifiers: 0 }); await new Promise(resolve => setTimeout(resolve, 45));
  }
  await page.mouse.move(820, 600);
  await mouse.detach();
}

test.afterEach(async ({ page }, info) => {
  const observation = await page.evaluate(() => { const probe = (window as Window & { companionShowcaseWitness?: Witness }).companionShowcaseWitness; probe?.stop(); return { frames: probe?.frames ?? [], inputs: probe?.inputs ?? [] }; });
  mkdirSync(output, { recursive: true });
  writeFileSync(`${output}/${info.title.replace(/[^a-z0-9]+/gi, "-")}.json`, JSON.stringify({ status: info.status, ...observation, scope: "Native pointer gestures and actual canvas alpha/row; no clock, RNG, engine or pose replacement" }, null, 2));
});

for (const surface of ["viewer", "studio"]) test(`${surface} showcase held shake and thrown landing use the existing dizzy and recovery art`, async ({ page }) => {
  test.setTimeout(45_000); await setup(page, surface); await observe(page);
  await shake(page); await expect(pet(page)).toHaveAttribute("data-held-dizzy", ""); await expect(pet(page)).toHaveAttribute("data-row", "22");
  await page.waitForTimeout(180); await page.mouse.up(); await expect(pet(page)).toHaveAttribute("data-reaction", "dizzy");
  await expect(pet(page)).toHaveAttribute("data-row", "23"); await expect(pet(page)).toHaveAttribute("data-reaction", "none", { timeout: 4000 });
  await shake(page); await expect(pet(page)).toHaveAttribute("data-held-dizzy", "");
  await flingAndRelease(page);
  await expect(pet(page)).toHaveAttribute("data-state", "jump");
  await expect(pet(page)).toHaveAttribute("data-reaction", "dizzy", { timeout: 5000 }); await expect(pet(page)).toHaveAttribute("data-row", "23");
  const frames = await page.evaluate(() => (window as Window & { companionShowcaseWitness?: Witness }).companionShowcaseWitness!.frames);
  expect(frames.every(frame => frame.visible && frame.alpha > 500)).toBe(true);
  expect(new Set(frames.filter(frame => frame.dizzy && frame.row === "22").map(frame => frame.pose)).size).toBeGreaterThan(1);
});

test("reduced showcase drag does not invent held dizziness or a throw", async ({ page }) => {
  test.setTimeout(35_000); await setup(page, "viewer", true); await observe(page);
  await shake(page); await expect(pet(page)).not.toHaveAttribute("data-held-dizzy", "");
  await page.mouse.up(); await expect(pet(page)).not.toHaveAttribute("data-reaction", "dizzy");
  const frames = await page.evaluate(() => (window as Window & { companionShowcaseWitness?: Witness }).companionShowcaseWitness!.frames);
  expect(frames.some(frame => frame.state === "held")).toBe(true); expect(frames.some(frame => frame.dizzy || frame.state === "jump")).toBe(false);
});

import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { keepCompanionStoredMotion } from "./helpers/companion-settings";

const output = process.env.COMPANION_CURTAIN_125_OUTPUT ?? ".scratch-pw/companion-125/curtains";
const buildDir = process.env.VISUAL_TEST_BUILD_DIR ?? ".next";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
test.setTimeout(45000);
test.use({ serviceWorkers: "block", storageState: { cookies: [], origins: [] } });

async function fixture(page: Page, personality: "curious" | "sleepy", hour: number, quiet = false) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      requests.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { requests.push(request.method() + " " + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No fixture APIs" });
    return route.continue();
  });
  await page.addInitScript(({ preferences, epoch, epochKey, personality, quiet }) => {
    for (const [key, value] of Object.entries({
      [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, sleep: true, sound: false, personality, personalitySource: "manual", activeWhileVisible: true }),
      "vic.gfx": JSON.stringify({ mode: quiet ? "off" : "full", at: Date.now(), v: 3 }), "vic.gfxPref": quiet ? "off" : "max", "vic.reduceMotion": quiet ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic_avatar_side": "left",
    })) localStorage.setItem(key, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, personality, quiet });
  await keepCompanionStoredMotion(page);
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto(`/visual-fixture/studio?role=owner&y=2025&m=7&ambient=summer&weather=clear&hour=${hour}`);
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-companion")).toBeVisible();
  await expect.poll(async () => await page.getByRole("region", { name: "빅타민 집", exact: true }).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  const room = await openCompanionHome(page);
  await room.locator("img").evaluateAll(nodes => Promise.all(nodes.map(node => (node as HTMLImageElement).decode())));
  await placeCompanionOnHomeFloor(page);
  return { room, async verify(name: string) {
    expect(errors).toEqual([]); expect(requests).toEqual([]); mkdirSync(output, { recursive: true });
    writeFileSync(`${output}/${name}.json`, JSON.stringify({ build: readFileSync(resolve(buildDir, "BUILD_ID"), "utf8").trim(), errors, requests, geometry: await geometry(page) }, null, 2));
    await room.screenshot({ path: `${output}/${name}.png` });
  } };
}

async function geometry(page: Page) {
  return page.locator(".vc-home-room").evaluate(room => {
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const window = room.querySelector(".vc-home-window")!;
    return { glass: rect(window.querySelector(".vc-window-glass")!), overlay: rect(window.querySelector(".vc-window-curtain-overlay")!),
      opacities: [...window.querySelectorAll(".vc-window-curtain-stage")].map(image => Number(getComputedStyle(image).opacity)),
      moving: window.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length,
      anchors: [...room.querySelectorAll("button[data-home-action],.vc-home-cushion,.vc-home-floor,.vc-dispenser-slot,.vc-toy-box-opening")].map(rect) };
  });
}

// Contract change: since a2e6bf26 (2026-10-20, home-curtain-control.ts) the
// curtain is a session control (open -> shade -> closed) whose choice is always
// the reducer's `intent`, so bright sun and a home nap no longer move the cloth
// by themselves; the two sliding `.vc-window-curtain` panels were replaced by
// five painted stages over the frame (126). These cases keep the 125 intent on
// that contract: sun/nap leave the session choice alone, a real press shades
// with the personality's own amount, the closed cloth covers the whole glass,
// nothing in the room moves, and quiet graphics change it without motion.
const curtainControl = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true }).locator('[data-home-action="curtain"]');
async function pressCurtain(page: Page) { const control = curtainControl(page); await control.focus(); await control.press("Enter"); await page.mouse.move(2, 2); }
const only = (stage: number) => Array.from({ length: 5 }, (_, index) => Number(index === stage));

for (const [personality, stage] of [["curious", 1], ["sleepy", 3]] as const) test(`125 bright sunlight leaves the choice to the control, which shades by personality for awake ${personality}`, async ({ page }) => {
  const state = await fixture(page, personality, 12);
  const window = state.room.locator(".vc-home-window");
  await expect(window).toHaveAttribute("data-curtain", "open");
  await expect(window).toHaveAttribute("data-curtain-stage", "0");
  const before = await geometry(page);
  await pressCurtain(page);
  await expect(window).toHaveAttribute("data-curtain", "shade");
  await expect(window).toHaveAttribute("data-curtain-stage", String(stage));
  await expect.poll(async () => (await geometry(page)).opacities).toEqual(only(stage));
  const shaded = await geometry(page);
  expect(shaded.anchors).toEqual(before.anchors);
  expect(await window.getAttribute("data-curtain-rest")).toBe("awake");
  await state.verify(`sun-${personality}`);
});

for (const quiet of [false, true]) test(`125 actual home nap keeps the chosen curtain and a closed cloth covers the glass${quiet ? " without motion" : " through the wake"}`, async ({ page }) => {
  const state = await fixture(page, "curious", 23, quiet);
  const window = state.room.locator(".vc-home-window");
  await expect(window).toHaveAttribute("data-curtain", "open");
  const before = await geometry(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  await actor.focus(); await actor.press("n"); await page.mouse.move(2, 2);
  await expect(window).toHaveAttribute("data-curtain-rest", /^(?:settling|asleep)$/);
  expect(await window.getAttribute("data-curtain")).toBe("open");
  await pressCurtain(page); await expect(window).toHaveAttribute("data-curtain", "shade");
  await pressCurtain(page); await expect(window).toHaveAttribute("data-curtain", "closed");
  await expect(window).toHaveAttribute("data-curtain-stage", "4");
  await expect.poll(async () => (await geometry(page)).opacities).toEqual(only(4));
  const closed = await geometry(page);
  expect(closed.anchors).toEqual(before.anchors);
  expect(closed.overlay.x).toBeLessThanOrEqual(closed.glass.x + .1);
  expect(closed.overlay.right).toBeGreaterThanOrEqual(closed.glass.right - .1);
  expect(closed.overlay.y).toBeLessThanOrEqual(closed.glass.y + .1);
  expect(closed.overlay.bottom).toBeGreaterThanOrEqual(closed.glass.bottom - .1);
  if (quiet) { expect(closed.moving).toBe(0); await expect(window).toHaveAttribute("data-curtain-motion", "off"); }
  await state.verify(quiet ? "quiet-closed" : "nap-closed");
  if (!quiet) {
    await expect(window).toHaveAttribute("data-curtain-rest", "awake", { timeout: 16000 });
    await expect(window).toHaveAttribute("data-curtain", "closed");
    expect((await geometry(page)).anchors).toEqual(before.anchors);
    await state.verify("night-awake-closed");
  }
});

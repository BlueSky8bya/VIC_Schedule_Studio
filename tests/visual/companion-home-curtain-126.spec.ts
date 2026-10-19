import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionPersonality, openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const output = process.env.COMPANION_CURTAIN_126_OUTPUT ?? ".scratch-pw/companion-126/curtains";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type Frame = { at: number; target: string | null; opacity: number[]; position: number; moving: number; sameWindow: boolean };
type Track = { duration: number; frames: { offset: number; opacity: number }[] };
type Probe = { frames: Frame[]; transitions: { at: number; target: string | null; tracks: Track[] }[]; stop: () => void };
type Proof = { errors: string[]; forbidden: string[]; checks: unknown[] };
const proofs = new WeakMap<Page, Proof>();
test.use({ viewport: { width: 1920, height: 1100 }, storageState: { cookies: [], origins: [] }, serviceWorkers: "block" });
test.setTimeout(45000);

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin; expect(["127.0.0.1", "localhost"]).toContain(new URL(origin).hostname);
  const proof: Proof = { errors: [], forbidden: [], checks: [] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (!["GET", "HEAD"].includes(request.method())) { proof.forbidden.push(request.method() + " " + url.pathname); return route.abort(); }
    if (url.origin !== origin) {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.forbidden.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (url.pathname === "/api/soop-live") return route.fulfill({ json: { live: false } });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live/private API in fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!; mkdirSync(output, { recursive: true });
  const name = info.title.replace(/[^a-z0-9]+/gi, "-"), path = resolve(output, name + ".json");
  const observations = await page.evaluate(() => { const probe = (window as unknown as { __curtain126?: Probe }).__curtain126; probe?.stop(); return { frames: probe?.frames ?? [], transitions: probe?.transitions ?? [] }; }).catch(() => ({ frames: [], transitions: [] }));
  writeFileSync(path, JSON.stringify({ build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), atUtc: new Date().toISOString(), status: info.status, ...proof, ...observations, scope: "Production-build local fixture; initial preferences/care/environment fixture only, real native inputs and successive rAF observations. No RNG, clock, product/geometry/style injection or art approval claim." }, null, 2));
  await info.attach("curtain-126", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(proof.errors).toEqual([]); expect(proof.forbidden).toEqual([]);
});

async function fixture(page: Page, personality: "curious" | "sleepy", hour: number, quiet = false, weather = "clear") {
  await page.addInitScript(({ preferences, memory, epoch, epochKey, personality, quiet }) => {
    for (const [key, value] of Object.entries({
      [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, sleep: true, feeding: false, sound: false, personality, activeWhileVisible: true }),
      "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }),
      "vic.gfx": JSON.stringify({ mode: quiet ? "off" : "full", at: Date.now(), v: 3 }), "vic.gfxPref": quiet ? "off" : "max", "vic.reduceMotion": quiet ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic_avatar_side": "left", "vic.premiereStage": "off",
    })) localStorage.setItem(key, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, personality, quiet });
  await page.goto(`/visual-fixture/studio?role=owner&y=2025&m=7&ambient=summer&weather=${weather}&hour=${hour}`);
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-companion")).toBeVisible();
  await chooseCompanionPersonality(page, personality);
  const room = await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
  await room.locator(".vc-home-window img").evaluateAll(images => Promise.all(images.map(image => (image as HTMLImageElement).decode())));
  const windowView = room.locator(".vc-home-window"), layers = windowView.locator(".vc-window-curtain-stage");
  await expect(layers).toHaveCount(5);
  expect(await layers.evaluateAll(images => images.map(image => image.getAttribute("src")))).toEqual(Array.from({ length: 5 }, (_, index) => `/companion/home/126/curtain-stage-${index}.webp`));
  expect(await windowView.locator(".vc-window-glass .vc-window-curtain-stage").count()).toBe(0);
  await expect(windowView.locator(".vc-window-crossbar,.vc-window-sill")).toHaveCount(2);
  return { room, windowView, layers, actor: page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }) };
}
async function geometry(page: Page) {
  return page.locator(".vc-home-room").evaluate(room => {
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const window = room.querySelector(".vc-home-window")!;
    return { frame: rect(window), overlay: rect(window.querySelector(".vc-window-curtain-overlay")!), glass: rect(window.querySelector(".vc-window-glass")!), anchors: [...room.querySelectorAll("button[data-home-action],.vc-home-cushion,.vc-home-floor,.vc-dispenser-slot,.vc-toy-box-opening")].map(rect), opacities: [...window.querySelectorAll(".vc-window-curtain-stage")].map(image => Number(getComputedStyle(image).opacity)), moving: window.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length };
  });
}
async function observe(page: Page) {
  await page.locator(".vc-home-window").evaluate(element => {
    const original = element, landscape = element.querySelector(".vc-window-landscape"), weather = element.querySelector(".vc-window-weather"), glass = element.querySelector(".vc-window-glass"), crossbar = element.querySelector(".vc-window-crossbar"), layers = [...element.querySelectorAll(".vc-window-curtain-stage")];
    let stopped = false, frame = 0, previous: Animation | undefined;
    const probe: Probe = { frames: [], transitions: [], stop() { stopped = true; cancelAnimationFrame(frame); } };
    const sample = (at: number) => {
      if (stopped || probe.frames.length >= 1600) return;
      const opacity = layers.map(layer => Number(getComputedStyle(layer).opacity)), total = opacity.reduce((sum, value) => sum + value, 0);
      const animation = layers[0].getAnimations()[0];
      if (animation && animation !== previous) probe.transitions.push({ at, target: element.getAttribute("data-curtain-stage"), tracks: layers.map(layer => { const effect = layer.getAnimations()[0]?.effect as KeyframeEffect | undefined; return { duration: Number(effect?.getComputedTiming().duration ?? 0), frames: effect?.getKeyframes().map(frame => ({ offset: frame.computedOffset, opacity: Number(frame.opacity) })) ?? [] }; }) });
      previous = animation;
      probe.frames.push({ at, target: element.getAttribute("data-curtain-stage"), opacity, position: opacity.reduce((sum, value, index) => sum + value * index, 0) / (total || 1), moving: element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length, sameWindow: original === document.querySelector(".vc-home-window") && landscape === original.querySelector(".vc-window-landscape") && weather === original.querySelector(".vc-window-weather") && glass === original.querySelector(".vc-window-glass") && crossbar === original.querySelector(".vc-window-crossbar") && Boolean(landscape?.isConnected) });
      frame = requestAnimationFrame(sample);
    };
    (window as unknown as { __curtain126: Probe }).__curtain126 = probe; frame = requestAnimationFrame(sample);
  });
}

for (const [personality, stage] of [["curious", 1], ["sleepy", 3]] as const) test(`126 sunny awake ${personality} uses a decoded finite curtain stage over the real frame`, async ({ page }) => {
  const state = await fixture(page, personality, 12);
  await expect(state.windowView).toHaveAttribute("data-curtain-stage", String(stage));
  await expect.poll(async () => (await geometry(page)).opacities).toEqual(Array.from({ length: 5 }, (_, index) => Number(index === stage)));
  const data = await geometry(page); expect(data.overlay.x).toBeLessThan(data.frame.x); expect(data.overlay.y).toBeLessThan(data.frame.y); expect(data.overlay.right).toBeGreaterThan(data.frame.right); expect(data.overlay.bottom).toBeGreaterThan(data.frame.bottom);
  await expect(state.windowView).toHaveAttribute("data-curtain-rest", "awake"); proofs.get(page)!.checks.push({ personality, stage, data });
});

for (const quiet of [false, true]) test(`126 real home nap closes all five stages and keeps the frame${quiet ? " with static quiet motion" : " through its actual wake"}`, async ({ page }) => {
  const state = await fixture(page, "curious", 23, quiet); await expect(state.windowView).toHaveAttribute("data-curtain-stage", "0");
  const before = await geometry(page); await observe(page); await state.actor.focus(); await state.actor.press("n"); await page.mouse.move(2, 2);
  await expect(state.windowView).toHaveAttribute("data-curtain-stage", "4");
  await expect.poll(async () => (await geometry(page)).opacities).toEqual([0, 0, 0, 0, 1]);
  const closed = await geometry(page); expect(closed.anchors).toEqual(before.anchors); expect(closed.frame).toEqual(before.frame); expect(closed.moving).toBe(0);
  if (!quiet) {
    await expect(state.windowView).toHaveAttribute("data-curtain-stage", "0", { timeout: 16000 });
    await expect.poll(async () => (await geometry(page)).opacities).toEqual([1, 0, 0, 0, 0]);
  }
  const frames = await page.evaluate(() => (window as unknown as { __curtain126: Probe }).__curtain126.frames);
  expect(frames.length).toBeGreaterThan(2); expect(frames.every(frame => frame.sameWindow)).toBe(true);
  if (quiet) expect(frames.every(frame => frame.moving === 0)).toBe(true);
  else for (const index of [1, 2, 3]) expect(frames.some(frame => frame.opacity[index] > .25), `actual intermediate generated stage${index} was painted`).toBe(true);
  proofs.get(page)!.checks.push({ quiet, before, closed, after: await geometry(page) });
});

test("126 a real touch reverses a partly closed curtain from its current blend", async ({ page }) => {
  const state = await fixture(page, "curious", 23, false, "rain"); await expect(state.windowView.locator(".vc-window-weather")).toHaveCount(1);
  await observe(page); await state.actor.focus(); await state.actor.press("n");
  await expect.poll(async () => { const data = await geometry(page); return data.opacities.reduce((sum, value, index) => sum + value * index, 0); }, { intervals: [16, 24, 32] }).toBeGreaterThan(1.4);
  await state.actor.press("Enter"); await expect(state.windowView).toHaveAttribute("data-curtain-stage", "0");
  await expect.poll(async () => (await geometry(page)).opacities).toEqual([1, 0, 0, 0, 0]);
  const reversed = await page.evaluate(() => (window as unknown as { __curtain126: Probe }).__curtain126.transitions.find(transition => transition.target === "0"));
  expect(reversed).toBeDefined(); const tracks = reversed!.tracks; expect(tracks).toHaveLength(5); expect(tracks.every(track => track.frames.length > 1)).toBe(true);
  const start = tracks.reduce((sum, track, index) => sum + track.frames[0].opacity * index, 0); expect(start).toBeGreaterThan(0); expect(start).toBeLessThan(4);
  expect(tracks[0].frames.at(-1)?.opacity).toBe(1); expect(tracks[4].frames.at(-1)?.opacity).toBe(0);
  const frames = await page.evaluate(() => (window as unknown as { __curtain126: Probe }).__curtain126.frames); expect(frames.every(frame => frame.sameWindow)).toBe(true);
  proofs.get(page)!.checks.push({ actualNativeTouchReversal: true, actualFractionalStart: start, reversed, after: await geometry(page) });
});

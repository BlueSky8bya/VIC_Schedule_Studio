import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { openCompanionHome } from "./helpers/companion-home";

const output = resolve(process.env.COMPANION_SPAWN_126_OUTPUT ?? ".scratch-pw/companion-126/spawn");
const build = () => readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m => m[1]));
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
type Point = { x: number; y: number };
type Item = Point & { id: string; kind: "food" | "toy"; platform: string; falling: boolean; width: number; height: number };
type Frame = { at: number; floor: { x: number; y: number; width: number; height: number }; slot: Point; opening: Point; items: Item[] };
type ProbeWindow = Window & { spawn126?: { frames: Frame[]; stop: () => void } };
const guards = new WeakMap<Page, { writes: string[]; foreign: string[]; errors: string[]; blockedAPI: string[] }>();
test.use({ headless: true, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.setTimeout(60000);
test.beforeEach(async ({ page }) => {
  const guard = { writes: [] as string[], foreign: [] as string[], errors: [] as string[], blockedAPI: [] as string[] }; guards.set(page, guard);
  page.on("pageerror", error => guard.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      guard.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { guard.writes.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "No fixture writes" }); }
    if (url.pathname === "/api/soop-live") return route.fulfill({ json: { live: false } });
    if (url.pathname.startsWith("/api/")) { guard.blockedAPI.push(url.pathname); return route.fulfill({ status: 404, body: "No live/private APIs" }); }
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const frames = await page.evaluate(() => { const p = (window as ProbeWindow).spawn126; p?.stop(); return p?.frames ?? []; }).catch(() => []);
  mkdirSync(output, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-"), path = resolve(output, name + ".json");
  writeFileSync(path, JSON.stringify({ build: build(), status: info.status, guard: guards.get(page), frames, scope: "Local production fixture, initial preferences only; actual pointer/viewport and read-only DOM display samples. No geometry, style, RNG, brain or clock injection; not production/OBS proof." }, null, 2));
  await info.attach("actual-source-floor-spawn-126", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(guards.get(page)!.writes).toEqual([]); expect(guards.get(page)!.foreign).toEqual([]); expect(guards.get(page)!.errors).toEqual([]);
});

async function ready(page: Page, studio: boolean) {
  await page.addInitScript(({ preferences, memory, epochKey, epoch }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, roam: false, feeding: true, sleep: false, sound: false, learnFromYou: false }), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }), "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epochKey: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH });
  await page.goto(studio ? "/visual-fixture/studio?role=owner&y=2025&m=11" : "/visual-fixture/poster?avatar=1&ambient=autumn");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-companion")).toBeVisible();
  await expect.poll(async () => await home(page).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  await openCompanionHome(page);
  await home(page).evaluate(async node => {
    await Promise.all(node.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {})));
  });
  await page.evaluate(() => {
    const frames: Frame[] = []; let stopped = false, request = 0;
    const centreBottom = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom }; };
    const sample = (at: number) => {
      if (stopped) return;
      const floor = document.querySelector(".vc-home-floor")!.getBoundingClientRect();
      frames.push({ at, floor: { x: floor.left, y: floor.top, width: floor.width, height: floor.height }, slot: centreBottom(".vc-dispenser-slot"), opening: centreBottom(".vc-toy-box-opening"), items: [...document.querySelectorAll<HTMLElement>(".vc-food,.vc-toy")].map(node => {
        const r = node.getBoundingClientRect(), food = node.matches(".vc-food"), m = new DOMMatrixReadOnly(getComputedStyle(node).transform);
        return { id: node.dataset.food ?? node.dataset.toyId ?? "", kind: food ? "food" as const : "toy" as const, x: food ? m.m41 : r.left + r.width / 2, y: food ? m.m42 : r.bottom, width: r.width, height: r.height, platform: node.dataset.platform ?? "", falling: food ? node.hasAttribute("data-falling") : node.dataset.falling === "true" };
      }) });
      if (frames.length < 2400) request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).spawn126 = { frames, stop: () => { stopped = true; cancelAnimationFrame(request); } }; request = requestAnimationFrame(sample);
  });
}
const points = (page: Page) => page.evaluate(() => (window as ProbeWindow).spawn126!.frames.at(-1)!);
async function assertFloor(page: Page, resized = false) {
  await expect.poll(async () => {
    const frame = await points(page); return frame.items.length === 8 && frame.items.every(p => !p.falling && /^companion-home-floor(?:-food)?(?:-\d+)?$/.test(p.platform) && Math.abs(p.y - (frame.floor.y + frame.floor.height - 6)) < 2);
  }, { timeout: 10000, message: "all eight real items settle on their actual home floor, not the outlet/window/panel" }).toBe(true);
  const frame = await points(page);
  for (const p of frame.items) { expect(p.x - 22).toBeGreaterThanOrEqual(frame.floor.x - .5); expect(p.x + 22).toBeLessThanOrEqual(frame.floor.x + frame.floor.width + .5); }
  for (const kind of ["food", "toy"]) {
    const distinct = new Set(frame.items.filter(p => p.kind === kind).map(p => Math.round(p.x * 10))).size;
    if (resized) expect(distinct, kind + " preserves dispersion while original fractions clip to current controls").toBeGreaterThanOrEqual(2);
    else expect(distinct, kind + " keeps four distinct initial centres even when footprints overlap").toBe(4);
  }
  // The compact floor is not wide enough for eight disjoint44px targets.
  // Require actual dispersion and retain every rectangle for overlap analysis.
  expect(Math.max(...frame.items.map(p => p.x)) - Math.min(...frame.items.map(p => p.x))).toBeGreaterThan(40);
}

for (const size of [{ width: 1440, studio: false }, { width: 1920, studio: true }, { width: 2400, studio: true }]) {
  test(`126 mixed eight clicks use real floor and reservations at ${size.width}`, async ({ page }) => {
    await page.setViewportSize({ width: size.width, height: 1100 }); await ready(page, size.studio);
    for (let i = 0; i < 4; i++) {
      await home(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click();
      await home(page).getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
    }
    await home(page).getByRole("button", { name: "밥 꺼내기", exact: true }).hover();
    await assertFloor(page);
    const frames = await page.evaluate(() => (window as ProbeWindow).spawn126!.frames), ids = (await points(page)).items.map(p => p.id);
    for (const id of ids) {
      const first = frames.find(f => f.items.some(p => p.id === id))!, item = first.items.find(p => p.id === id)!, source = item.kind === "food" ? { ...first.slot, y: first.slot.y + 2 } : first.opening;
      expect(Math.hypot(item.x - source.x, item.y - source.y), "first real display sample remains beside its measured source").toBeLessThan(28);
      expect(frames.some(f => f.items.some(p => p.id === id && p.falling))).toBe(true);
    }
    if (size.width === 2400) {
      const identities = await page.locator(".vc-food,.vc-toy").elementHandles();
      await page.setViewportSize({ width: 1920, height: 1100 }); await assertFloor(page, true);
      for (const identity of identities) expect(await identity.evaluate(node => node.isConnected)).toBe(true);
      await page.mouse.move(900, 700); await page.mouse.wheel(0, 240); await assertFloor(page, true);
      expect((await points(page)).items.map(p => p.id).sort()).toEqual(ids.sort());
    }
  });
}

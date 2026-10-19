import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { SeasonKey } from "@/components/shared/ambient/registry";
import { worldTimeOfBand, type DayBand } from "@/components/shared/ambient/world/time";
import type { Weather } from "@/components/shared/ambient/world/weather";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const out = process.env.COMPANION_WINDOW_UI_OUTPUT ?? ".scratch-pw/companion-123/window";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const month: Record<SeasonKey, number> = { spring: 4, summer: 7, autumn: 10, winter: 1 };
type Phase = "dawn" | "day" | "dusk" | "night";
const band: Record<Phase, DayBand> = { dawn: "dawn", day: "noon", dusk: "dusk", night: "night" };
const overlay: Record<Weather, string | null> = { clear: null, cloud: null, rain: "/companion/home/124/window-rain-overlay.webp", snow: "/companion/home/124/window-snow-overlay.webp", fog: "/companion/home/124/window-fog-overlay.webp", wind: "/companion/home/124/window-wind-overlay.webp" };
type Options = { surface?: "viewer" | "studio"; season?: SeasonKey; phase?: Phase; weather?: Weather; quiet?: "reduced" | "off"; dark?: boolean };
const proofs = new WeakMap<Page, { writes: string[]; foreign: string[]; errors: string[] }>();

test.use({ serviceWorkers: "block", viewport: { width: 1920, height: 1100 } });
test.setTimeout(90000);
test.beforeEach(async ({ page }) => {
  const proof = { writes: [] as string[], foreign: [] as string[], errors: [] as string[] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname);
      return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live API in fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }) => {
  const proof = proofs.get(page)!;
  expect(proof.writes).toEqual([]); expect(proof.foreign).toEqual([]); expect(proof.errors).toEqual([]);
});

async function fixture(page: Page, options: Options = {}) {
  await page.addInitScript(({ preferences, epoch, epochKey, options }) => {
    for (const [key, value] of Object.entries({
      [epochKey]: epoch,
      "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, roam: false, sleep: false, sound: false }),
      "vic.gfx": JSON.stringify({ mode: options.quiet === "off" ? "off" : "full", at: Date.now(), v: 3 }),
      "vic.gfxPref": options.quiet === "off" ? "off" : "max", "vic.reduceMotion": options.quiet === "reduced" ? "on" : "off",
      "vic.sound": "off", "vic.ambient": "off", "vic.dark": options.dark ? "on" : "off", "vic_avatar_side": "left",
    })) localStorage.setItem(key, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, options });
  const season = options.season ?? "autumn", m = month[season];
  // The existing fixture accepts an hour. Obtain it from the same solar
  // service for this past month's actual last day, never fake the clock.
  const date = { y: 2025, m, d: new Date(Date.UTC(2025, m, 0)).getUTCDate() };
  const hour = worldTimeOfBand(season, band[options.phase ?? "day"], date).hour;
  await page.goto(options.surface === "viewer" ? `/visual-fixture/poster?avatar=1&ambient=${season}`
    : `/visual-fixture/studio?role=owner&y=2025&m=${m}&ambient=${season}&hour=${hour}&weather=${options.weather ?? "clear"}`);
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => await page.getByRole("region", { name: "빅타민 집", exact: true }).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  const room = await openCompanionHome(page);
  await expect.poll(() => room.evaluate(node => {
    for (let parent: Element | null = node; parent; parent = parent.parentElement)
      if (parent.getAnimations().some(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))) return false;
    return true;
  })).toBe(true);
  const decoded = await room.locator("img").evaluateAll(async nodes => Promise.all(nodes.map(async node => {
    const image = node as HTMLImageElement; await image.decode();
    return { src: image.getAttribute("src"), width: image.naturalWidth, height: image.naturalHeight };
  })));
  expect(decoded.every(image => image.width > 0 && image.height > 0)).toBe(true);
  expect(proofs.get(page)!.errors).toEqual([]);
  return { room, window: room.locator(".vc-home-window"), decoded };
}

async function snapshot(page: Page, state: Awaited<ReturnType<typeof fixture>>, name: string) {
  mkdirSync(out, { recursive: true });
  const bounds = await state.room.evaluate(node => {
    const box = (selector: string) => { const r = node.querySelector(selector)!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const room = box(".vc-home-room"), cssWidth = parseFloat(getComputedStyle(node.querySelector(".vc-home-room")!).width);
    return { room, cssWidth, scale: room.width / cssWidth, window: box(".vc-home-window"), shelf: box(".vc-home-shelf"), feed: box(".vc-dispenser"), chest: box(".vc-toy-box"), sofa: box(".vc-cushion-button"), outlet: box(".vc-dispenser-slot"), opening: box(".vc-toy-box-opening") };
  });
  writeFileSync(`${out}/${name}.json`, JSON.stringify({ build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), decoded: state.decoded, bounds }, null, 2));
  await state.room.screenshot({ path: `${out}/${name}.png` });
  return bounds;
}

for (const [surface, width, dark] of [["viewer", 1440, false], ["studio", 1920, true], ["studio", 2400, false]] as const) test(`123 wider window keeps real shelf and physical controls clear: ${surface} ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 });
  const state = await fixture(page, { surface, dark }), bounds = await snapshot(page, state, `layout-${surface}-${width}`);
  //126 floor storage frees the wall for a wider, raised window. The shared
  // shelf alone reserves wall width; storage retains independent native hits.
  const expectedWidth = Math.min(152, bounds.cssWidth - (bounds.shelf.width / bounds.scale + 28));
  expect(bounds.window.width / bounds.scale).toBeCloseTo(expectedWidth, 1);
  expect(bounds.window.width).toBeGreaterThan(96 * bounds.scale);
  expect(bounds.shelf.x - bounds.window.x - bounds.window.width).toBeGreaterThanOrEqual(6);
  const painted = await state.room.evaluate(node => {
    const glass = node.querySelector(".vc-window-glass")!.getBoundingClientRect(), sofa = node.querySelector(".vc-plush-bed")!.getBoundingClientRect();
    return { glassBottom: glass.bottom, sofaOpaqueTop: sofa.top + sofa.height * .07 };
  });
  expect(painted.glassBottom).toBeLessThanOrEqual(painted.sofaOpaqueTop + .5);
  expect(bounds.window.x).toBeGreaterThanOrEqual(bounds.room.x);
  expect(bounds.window.x + bounds.window.width).toBeLessThan(bounds.room.x + bounds.room.width);
  expect(await state.room.locator(".vc-home-room").evaluate(node => parseFloat(getComputedStyle(node).height))).toBeCloseTo(200, 1);
  for (const action of ["book", "radio", "home", "toys", "feed", "clearFood"]) {
    const target = state.room.locator(`[data-home-action="${action}"]`), rect = (await target.boundingBox())!;
    expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(await target.evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === node || node.contains(hit); })).toBe(true);
  }
});

for (const season of ["spring", "summer", "autumn", "winter"] as const) test(`123 actual solar phases choose four distinct scene files: ${season}`, async ({ page }) => {
  const sources = new Set<string>(), anchors: { x: number; y: number; width: number; height: number }[] = [];
  for (const phase of ["dawn", "day", "dusk", "night"] as const) {
    const state = await fixture(page, { season, phase });
    await expect(state.window).toHaveAttribute("data-phase", phase);
    const expected = `/companion/home/125/window-${season}-${phase}.webp`;
    await expect(state.window.locator(".vc-window-landscape")).toHaveAttribute("src", expected); sources.add(expected);
    await expect(state.window.locator(".vc-window-weather")).toHaveCount(0);
    const bounds = await snapshot(page, state, `${season}-${phase}`);
    anchors.push({ x: bounds.sofa.x - bounds.room.x, y: bounds.sofa.y - bounds.room.y, width: bounds.sofa.width, height: bounds.sofa.height });
    if (phase === "night") await expect(state.window.locator(".vc-window-landscape")).toHaveCSS("filter", "none");
  }
  expect(sources.size).toBe(4);
  for (const rect of anchors.slice(1)) for (const key of ["x", "y", "width", "height"] as const) expect(rect[key]).toBeCloseTo(anchors[0][key], 1);
});

test("123 six shared weather states retain their scene and keep clouds behind its trees", async ({ page }) => {
  for (const weather of ["clear", "cloud", "rain", "snow", "fog", "wind"] as const) {
    const state = await fixture(page, { season: "autumn", phase: "day", weather });
    await expect(state.window).toHaveAttribute("data-weather", weather);
    await expect(state.window).toHaveAttribute("data-phase", "day");
    await expect(state.window.locator(".vc-window-landscape")).toHaveAttribute("src", "/companion/home/125/window-autumn-day.webp");
    if (overlay[weather]) await expect(state.window.locator(".vc-window-weather")).toHaveAttribute("src", overlay[weather]!);
    else await expect(state.window.locator(".vc-window-weather")).toHaveCount(0);
    expect(await state.window.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
    await snapshot(page, state, `weather-${weather}`);
  }
});

for (const quiet of ["reduced", "off"] as const) test(`123 static night and weather remain present in quiet mode: ${quiet}`, async ({ page }) => {
  const state = await fixture(page, { season: "winter", phase: "night", weather: "wind", quiet });
  await expect(state.window.locator(".vc-window-landscape")).toHaveAttribute("src", "/companion/home/125/window-winter-night.webp");
  await expect(state.window.locator(".vc-window-weather")).toHaveAttribute("src", overlay.wind!);
  await expect(state.window.locator(".vc-window-landscape")).toHaveCSS("filter", "none");
  expect(await state.window.evaluate(node => node.getAnimations({ subtree: true }).length)).toBe(0);
  await snapshot(page, state, `night-${quiet}`);
});

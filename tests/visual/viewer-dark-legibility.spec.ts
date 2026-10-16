import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

const title = "합성 생방송 · 함께 이야기하는 저녁";
const localPreviewTitle = "라이브 카드 미리보기 (테스트)";
const prefix = process.env.DARK_LEGIBILITY_PREFIX ?? ".scratch-pw/companion-068-dark-legibility";
const failures = new WeakMap<Page, { mutations: string[]; errors: string[]; reads: number }>();

test.beforeEach(async ({ page }) => {
  const receipt = { mutations: [] as string[], errors: [] as string[], reads: 0 };
  failures.set(page, receipt);
  page.on("pageerror", error => receipt.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const publicReads = new Set(Object.entries(manifest).filter(([, value]) => value.exportedName === "getPublicPreviewAction").map(([id]) => id));
  expect(publicReads.size).toBe(1);
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    // This exact public read uses POST transport; fulfil locally, never forward.
    if (request.method() === "POST" && url.pathname === "/visual-fixture/studio" && publicReads.has(request.headers()["next-action"])) {
      receipt.reads++;
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (!["GET", "HEAD"].includes(request.method())) {
      receipt.mutations.push(`${request.method()} ${url.pathname}`);
      return route.fulfill({ status: 500, body: "Fixture blocks mutations" });
    }
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) return route.abort();
    if (url.pathname === "/api/soop-live") return route.fulfill({ json: {
      isLive: true, bjNick: "합성 채널", title, category: null, bno: null, watchUrl: "https://example.com/fixture-live"
    } });
    return route.continue();
  });
});
test.afterEach(async ({ page }) => {
  expect(failures.get(page)?.mutations).toEqual([]);
  expect(failures.get(page)?.errors).toEqual([]);
});

async function prepare(page: Page, dark = true) {
  await page.addInitScript(({ key, epoch, dark }) => {
    localStorage.setItem(key, epoch);
    for (const [key, value] of Object.entries({ "vic.dark": dark ? "on" : "off", "vic.eyeComfort": "on", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic.reduceMotion": "on", vic_panel_collapsed: "0" })) localStorage.setItem(key, value);
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, dark });
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
}

/** Composite actual theme colours and ancestor opacity, including dark glass.
 * No product colour/token overrides or screenshot pixel substitutions. */
async function contrasts(elements: Locator) {
  return elements.evaluateAll(nodes => nodes.filter(node => node.getClientRects().length && getComputedStyle(node).visibility === "visible").map(node => {
    const context = document.createElement("canvas").getContext("2d")!;
    const rgba = (value: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); const pixel = context.getImageData(0, 0, 1, 1).data; return [pixel[0], pixel[1], pixel[2], pixel[3] / 255]; };
    const over = (top: number[], bottom: number[]) => { const alpha = top[3] + bottom[3] * (1 - top[3]); return [0, 1, 2].map(i => alpha ? (top[i] * top[3] + bottom[i] * bottom[3] * (1 - top[3])) / alpha : 0).concat(alpha); };
    let foreground = rgba(getComputedStyle(node).color), background = [0, 0, 0, 0];
    for (let ancestor: Element | null = node; ancestor; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor), surface = rgba(style.backgroundColor);
      foreground = over(foreground, surface); background = over(background, surface);
      foreground[3] *= Number(style.opacity); background[3] *= Number(style.opacity);
    }
    foreground = over(foreground, [255, 255, 255, 1]); background = over(background, [255, 255, 255, 1]);
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const a = luminance(foreground), b = luminance(background), rect = node.getBoundingClientRect();
    return { label: node.textContent?.trim(), className: node.className, color: getComputedStyle(node).color, foreground, background, contrast: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), width: rect.width, height: rect.height };
  }));
}

const desktop = [
  // Poster fixtures deliberately disable the remote poll via their premiere
  // fixture prop. Use the existing explicit live-preview fallback there; the
  // studio viewer exercises the real poll with our synthetic API response.
  { name: "anonymous", route: "/visual-fixture/poster?avatar=1&signedIn=0&live-preview", preview: false, title: localPreviewTitle },
  { name: "viewer", route: "/visual-fixture/poster?avatar=1&signedIn=1&live-preview", preview: false, title: localPreviewTitle },
  { name: "preview", route: "/visual-fixture/studio?role=owner&viewer=1", preview: true, title },
];
for (const surface of desktop) test(`dark ${surface.name} tag/status filters and live caption remain readable`, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await prepare(page);
  await page.goto(surface.route); await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const panel = page.locator(".public-legend-vertical"), caption = page.locator(".slc-caption");
  await expect(panel).toBeVisible(); await expect(caption).toHaveText(surface.title); await settle(page);
  const labels = panel.locator(".panel-section-title,.legend-item,.legend-tier-line,.legend-tier,.legend-tent-line"), idle = await contrasts(labels);
  const live = await contrasts(caption);
  await caption.hover(); const hover = await contrasts(caption); await page.mouse.move(1000, 15);
  await panel.locator(".legend-tier").first().click(); await settle(page);
  const selected = await contrasts(panel.locator(".legend-tier.active"));
  const dimmed = await contrasts(panel.locator(".legend-tier.dim"));
  writeFileSync(`${prefix}-${surface.name}.json`, JSON.stringify({ idle, live, hover, selected, dimmed, ...failures.get(page) }, null, 2));
  await page.screenshot({ path: `${prefix}-${surface.name}.png` });
  expect(idle.length).toBeGreaterThan(5); expect(selected).toHaveLength(1);
  for (const metric of [...idle, ...live, ...hover, ...selected, ...dimmed]) expect(metric.contrast, `${metric.className} ${metric.label}: ${metric.contrast}`).toBeGreaterThanOrEqual(4.5);
  if (surface.preview) expect(failures.get(page)?.reads).toBe(1);
});

test("dark studio filters retain the shared readable palette", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await prepare(page);
  await page.goto("/visual-fixture/studio?role=owner"); await settle(page);
  const labels = page.locator(".tag-legend-filter:visible"); await expect(labels.first()).toBeVisible();
  const measured = await contrasts(labels); writeFileSync(`${prefix}-studio.json`, JSON.stringify({ measured, ...failures.get(page) }, null, 2));
  expect(measured.length).toBeGreaterThan(5);
  for (const metric of measured) expect(metric.contrast, `${metric.label}: ${metric.contrast}`).toBeGreaterThanOrEqual(4.5);
});

test.describe("native agenda", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("dark agenda filter text remains readable without a desktop live card", async ({ page }) => {
    await prepare(page); await page.goto("/visual-fixture/poster?avatar=1&signedIn=0"); await settle(page);
    const labels = page.locator(".agenda-legend-tag,.agenda-tier-btn,.agenda-tent-help"); await expect(labels.first()).toBeVisible();
    const measured = await contrasts(labels);
    await page.locator(".agenda-legend-tag").first().tap(); await settle(page);
    const selected = await contrasts(page.locator(".agenda-legend-tag.on,.agenda-legend-tag.dim"));
    writeFileSync(`${prefix}-agenda.json`, JSON.stringify({ measured, selected, ...failures.get(page) }, null, 2));
    await page.screenshot({ path: `${prefix}-agenda.png` });
    expect(measured.length).toBeGreaterThan(5);
    expect(selected.length).toBeGreaterThan(5);
    for (const metric of [...measured, ...selected]) expect(metric.contrast, `${metric.label}: ${metric.contrast}`).toBeGreaterThanOrEqual(4.5);
    await expect(page.locator(".soop-live-card:visible")).toHaveCount(0);
  });
});

test("light viewer keeps its existing filter and caption palette", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await prepare(page, false);
  await page.goto("/visual-fixture/poster?avatar=1&signedIn=0&live-preview"); await settle(page);
  const caption = page.locator(".slc-caption"); await expect(caption).toHaveText(localPreviewTitle);
  expect(await caption.evaluate(node => getComputedStyle(node).color)).toBe("rgb(58, 36, 48)");
  expect(await page.locator(".legend-tier").first().evaluate(node => getComputedStyle(node).color)).toBe("rgb(107, 100, 80)");
});

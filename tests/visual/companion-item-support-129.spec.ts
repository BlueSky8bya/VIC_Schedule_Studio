import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const output = resolve(process.env.COMPANION_ITEMS_129_OUTPUT ?? ".scratch-pw/companion-129/native");
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(m => m[1]));
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
type Item = { id: string; food: boolean; x: number; y: number; carried: boolean; discarding: boolean; platform: string; hidden: boolean };
type Frame = { at: number; state: string; bin: { x: number; y: number } | null; opening: { x: number; y: number } | null; items: Item[] };
type ProbeWindow = Window & { items129?: { frames: Frame[]; stop: () => void } };
const proofs = new WeakMap<Page, { writes: string[]; foreign: string[]; errors: string[]; notes: unknown[] }>();
test.use({ headless: true, viewport: { width: 2400, height: 1100 }, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.setTimeout(120000);
test.beforeEach(async ({ page }) => {
  const proof = { writes: [] as string[], foreign: [] as string[], errors: [] as string[], notes: [] as unknown[] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "No fixture writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live or private APIs" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const frames = await page.evaluate(() => { const p = (window as ProbeWindow).items129; p?.stop(); return p?.frames ?? []; }).catch(() => []);
  mkdirSync(output, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-"), path = resolve(output, name + ".json");
  writeFileSync(path, JSON.stringify({ build: readFileSync(resolve(".next/BUILD_ID"), "utf8").trim(), status: info.status, proof: proofs.get(page), frames, scope: "Native production-build fixture. Initial preferences/care only; read-only displayed positions. No clock, RNG, geometry or brain injection; no real DB or OBS claim." }, null, 2));
  await info.attach("actual-items-129", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(proofs.get(page)!.writes).toEqual([]); expect(proofs.get(page)!.foreign).toEqual([]); expect(proofs.get(page)!.errors).toEqual([]);
});
async function ready(page: Page, tidy = false) {
  await page.addInitScript(({ preferences, memory, epoch, epochKey, tidy }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, roam: tidy, personality: "tidy", feeding: true, sleep: false, sound: false, learnFromYou: false }), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }), "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, tidy });
  await page.goto("/visual-fixture/studio?role=owner&y=2025&m=11"); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-companion")).toBeVisible(); const room = await openCompanionHome(page);
  await room.evaluate(async node => Promise.all(node.getAnimations({ subtree: true }).filter(a => Number.isFinite(a.effect?.getComputedTiming().endTime)).map(a => a.finished.catch(() => {}))));
}
async function probe(page: Page) {
  await page.evaluate(() => {
    const frames: Frame[] = []; let raf = 0, stopped = false, previous = -Infinity;
    const sample = (at: number) => {
      if (stopped) return;
      if (at - previous >= 16) {
        previous = at; const bin = document.querySelector(".vc-home [data-companion-trash]")?.getBoundingClientRect(), opening = document.querySelector(".vc-toy-box-opening")?.getBoundingClientRect();
        frames.push({ at, state: (document.querySelector(".vc-companion") as HTMLElement)?.dataset.state ?? "", bin: bin ? { x: bin.left + bin.width / 2, y: bin.top + bin.height * .35 } : null, opening: opening ? { x: opening.left + opening.width / 2, y: opening.bottom } : null, items: [...document.querySelectorAll<HTMLElement>(".vc-food,.vc-toy")].map(node => {
          const food = node.matches(".vc-food"), r = node.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(node).transform);
          return { id: node.dataset.food ?? node.dataset.toyId ?? "", food, x: food ? m.m41 : r.left + r.width / 2, y: food ? m.m42 : r.bottom, carried: food ? node.hasAttribute("data-carried") : node.dataset.carried === "true", discarding: node.hasAttribute("data-discarding"), platform: node.dataset.platform ?? "", hidden: node.hidden };
        }) });
      }
      if (frames.length < 6500) raf = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).items129 = { frames, stop: () => { stopped = true; cancelAnimationFrame(raf); } }; raf = requestAnimationFrame(sample);
  });
}
const frames = (page: Page) => page.evaluate(() => (window as ProbeWindow).items129?.frames ?? []);

test("129 empty studio column does not stop native food or toy on its invisible panel boundary", async ({ page }) => {
  await ready(page); await probe(page);
  await home(page).locator("[data-home-action=feed]").click(); await home(page).locator("[data-home-action=toys]").click();
  await expect(page.locator(".vc-food")).not.toHaveAttribute("data-falling"); await expect(page.locator(".vc-toy")).toHaveAttribute("data-falling", "false");
  const panel = (await page.locator(".avatar-dock-inner:visible").boundingBox())!, target = { x: panel.x + panel.width * .35, y: panel.y + panel.height - 100 };
  expect(panel.y + panel.height).toBeLessThan(900);
  for (const selector of [".vc-food", ".vc-toy"]) {
    const item = page.locator(selector).first(), rect = (await item.boundingBox())!;
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down(); await page.mouse.move(target.x, target.y - 1, { steps: 12 });
    await page.waitForTimeout(150); await page.mouse.move(target.x, target.y); await page.mouse.up(); await page.mouse.move(2, 2);
    await expect(item).toHaveAttribute("data-platform", /^viewport-floor(?:-food)?(?:-\d+)?$/);
    await expect.poll(async () => (await item.boundingBox())!.y).toBeGreaterThan(panel.y + panel.height + 20);
  }
  proofs.get(page)!.notes.push({ actualPanel: panel, actualNativeRelease: target });
  await page.setViewportSize({ width: 1920, height: 1000 });
  await expect(page.locator(".vc-food")).toHaveAttribute("data-platform", /^viewport-floor-food(?:-\d+)?$/);
  await expect(page.locator(".vc-toy")).toHaveAttribute("data-platform", /^viewport-floor(?:-food)?(?:-\d+)?$/);
});

for (const width of [1920, 2400]) test(`129 tidy physically clears four foods and four toys despite the real furniture at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 }); await ready(page, true); await placeCompanionOnHomeFloor(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }); await actor.focus(); await actor.press("Space");
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", "held");
  for (let i = 0; i < 4; i++) {
    await home(page).locator("[data-home-action=feed]").click(); await home(page).locator("[data-home-action=toys]").click();
    await expect(page.locator(".vc-food")).toHaveCount(i + 1); await expect(page.locator(".vc-toy")).toHaveCount(i + 1);
    await expect(page.locator(".vc-food").last()).not.toHaveAttribute("data-falling"); await expect(page.locator(".vc-toy").last()).toHaveAttribute("data-falling", "false");
  }
  const ids = await page.locator(".vc-food,.vc-toy").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.food ?? (node as HTMLElement).dataset.toyId!));
  await probe(page); await actor.focus(); await actor.press("Space"); await page.mouse.move(2, 2);
  await expect(page.locator(".vc-food,.vc-toy")).toHaveCount(0, { timeout: 95000 });
  await expect.poll(async () => (await frames(page)).at(-1)?.items.length, { timeout: 1000, intervals: [16, 16, 32] }).toBe(0);
  const trace = await frames(page);
  for (const id of ids) {
    const carried = trace.filter(frame => frame.items.some(item => item.id === id && item.carried && !item.discarding));
    expect(carried.length, id + " was visibly carried before clearing").toBeGreaterThanOrEqual(2);
    const delivered = carried.filter(frame => { const item = frame.items.find(item => item.id === id)!, target = item.food ? frame.bin : frame.opening; return target && Math.hypot(item.x - target.x, item.y - target.y) < 20; }).at(-1);
    expect(delivered, id + " reaches its current real opening before removal").toBeDefined();
    expect(trace.some(frame => frame.at > delivered!.at && !frame.items.some(item => item.id === id))).toBe(true);
  }
  expect(trace.some(frame => frame.state === "eat")).toBe(false);
  proofs.get(page)!.notes.push({ actualIds: ids, noInputAfterNativeRelease: true, cleared: ids.length });
});

import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { enterCompanionMeadow, placeCompanionOnExposedBackground } from "./helpers/companion-outdoor";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const fonts = new Set([...readFileSync("app/fonts.css", "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
test.use({ storageState: { cookies: [], origins: [] }, viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", video: { mode: "retain-on-failure", size: { width: 1920, height: 1080 } } });
test.setTimeout(90000);
test.beforeEach(async ({ page, context, baseURL }, info) => {
  const origin = new URL(baseURL!).origin;
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return fulfillReadOnlyFont(route, fonts, []);
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) return route.abort();
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "Credential-free seasonal transition fixture" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, care, epoch, key, reduced }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.gfx", JSON.stringify({ mode: "full", v: 3, at: Date.now() }));
    localStorage.setItem("vic.ambient", "on"); localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off"); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.premiereStage", "off"); localStorage.setItem("vic_avatar_side", "left");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, jump: false, sleep: false, feeding: true, activeWhileVisible: true, heartPrank: false, ambientPrank: false, personality: "balanced", personalitySource: "manual" }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care, fullness: .99, energy: .95 }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, reduced: info.title.includes("reduced") });
});

async function placeItem(page: Page, item: Locator, point: { x: number; y: number }) {
  await expect(item).toBeVisible();
  const rect = (await item.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 16 }); await page.waitForTimeout(180); await page.mouse.up(); await page.mouse.move(2, 2);
}

async function expectHomecoming(page: Page) {
  const pet = page.locator(".vc-companion");
  await expect(page.locator(".vc-meadow-walk")).toHaveCount(0);
  await expect(pet).toBeVisible(); await expect(pet).toHaveAttribute("data-platform", "companion-home-floor-400");
  await expect(pet).not.toHaveAttribute("data-state", "jump");
  const contact = await page.evaluate(() => {
    const body = document.querySelector(".vc-companion")!.getBoundingClientRect(), mat = document.querySelector(".vc-home-wash-stance")!.getBoundingClientRect();
    return { x: body.left + body.width / 2, y: body.bottom, mat: { left: mat.left, right: mat.right, top: mat.top, bottom: mat.bottom } };
  });
  expect(contact.x).toBeGreaterThanOrEqual(contact.mat.left - 2); expect(contact.x).toBeLessThanOrEqual(contact.mat.right + 2);
  expect(contact.y).toBeGreaterThanOrEqual(contact.mat.top - 2); expect(contact.y).toBeLessThanOrEqual(contact.mat.bottom + 2);
}

for (const surface of ["viewer", "studio", "preview"] as const) {
  test(`${surface}: home departure jumps during fade and covered physical items are removed on shower-pad return`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(surface === "viewer" ? "/visual-fixture/poster?ambient=spring" : `/visual-fixture/studio?role=developer&y=2026&m=3${surface === "preview" ? "&viewer=1" : ""}`);
    await page.bringToFront(); const home = await openCompanionHome(page);
    const fold = home.locator('[data-home-action="fold"]'); if (await fold.getAttribute("aria-expanded") === "false") await fold.click();
    await placeCompanionOnHomeFloor(page);
    const petIdentity = await page.locator(".vc-companion").elementHandle();
    for (const [kind, x] of [["food", 90], ["toy", 170], ["food", 250], ["toy", 330]] as const) {
      const items = page.locator(kind === "food" ? ".vc-food" : ".vc-toy"), before = await items.count();
      await home.getByRole("button", { name: kind === "food" ? "밥 꺼내기" : "장난감 상자 열기", exact: true }).click();
      await expect(items).toHaveCount(before + 1); const item = items.nth(before);
      if (kind === "food") await expect(item).not.toHaveAttribute("data-falling"); else await expect(item).toHaveAttribute("data-falling", "false");
      await placeItem(page, item, { x, y: 990 }); await expect(item).toHaveAttribute("data-platform", /^viewport-floor/);
    }
    const foodIds = await page.locator(".vc-food").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.food!));
    const toyIds = await page.locator(".vc-toy").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.toyId!));
    const cover = await page.locator(surface === "viewer" || surface === "preview" ? ".public-calendar-area:visible" : ".studio-calendar-panel:visible").first().boundingBox(); expect(cover).not.toBeNull();
    await page.evaluate(() => {
      const frames: { at: number; state: string; opacity: number; lift: number; x: number; y: number; ordinaryVisible: boolean }[] = [];
      let started = performance.now();
      window.addEventListener("vic:showcase-transition", event => { const detail = (event as CustomEvent<{ active: boolean; phase: string }>).detail; if (detail.active && detail.phase === "before") started = performance.now(); });
      (window as Window & { seasonFrames?: typeof frames }).seasonFrames = frames;
      const sample = () => {
        const actor = document.querySelector<HTMLElement>(".vc-meadow-walk"), ordinary = document.querySelector<HTMLElement>(".vc-companion"), layout = document.querySelector(".public-calendar-area,.studio-calendar-panel");
        let opacity = 1; for (let node = layout; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
        if (actor && !actor.hidden) frames.push({ at: performance.now() - started, state: actor.dataset.state ?? "", opacity, lift: Number(actor.dataset.groundY) - Number(actor.dataset.y), x: Number(actor.dataset.x), y: Number(actor.dataset.y), ordinaryVisible: Boolean(ordinary && !ordinary.hidden && getComputedStyle(ordinary).display !== "none") });
        if (performance.now() - started < 4000) requestAnimationFrame(sample);
      }; requestAnimationFrame(sample);
    });
    await enterCompanionMeadow(page); const meadow = page.locator(".vc-meadow-walk");
    await expect(meadow).toBeVisible(); await expect(meadow).toHaveAttribute("data-state", "idle", { timeout: 7000 });
    const frames = await page.evaluate(() => (window as Window & { seasonFrames?: { at: number; state: string; opacity: number; lift: number; ordinaryVisible: boolean }[] }).seasonFrames ?? []);
    await info.attach("departure-frames", { body: JSON.stringify(frames), contentType: "application/json" });
    expect(frames[0]?.at).toBeLessThan(200);
    expect(frames.some(frame => frame.state === "jump" && frame.lift > 30 && frame.opacity > .05 && frame.opacity < 1)).toBe(true);
    expect(frames.every(frame => !frame.ordinaryVisible)).toBe(true);
    const covered = { x: cover!.x + cover!.width / 2, y: cover!.y + cover!.height * .6 };
    await placeItem(page, page.locator(`[data-food="${foodIds[0]}"]`), covered);
    await placeItem(page, page.locator(`[data-toy-id="${toyIds[0]}"]`), { x: covered.x + 70, y: covered.y });
    await page.keyboard.press("Escape"); await expectHomecoming(page);
    await expect(page.locator(`[data-food="${foodIds[0]}"]`)).toHaveCount(0); await expect(page.locator(`[data-toy-id="${toyIds[0]}"]`)).toHaveCount(0);
    await expect(page.locator(`[data-food="${foodIds[1]}"]`)).toBeVisible(); await expect(page.locator(`[data-toy-id="${toyIds[1]}"]`)).toBeVisible();
    expect(await petIdentity!.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
    await page.screenshot({ path: info.outputPath("homecoming.png") });
    await enterCompanionMeadow(page); await expect(meadow).toHaveAttribute("data-state", "idle");
    await expect(page.locator(`[data-food="${foodIds[0]}"]`)).toHaveCount(0); await expect(page.locator(`[data-toy-id="${toyIds[0]}"]`)).toHaveCount(0);
    await page.keyboard.press("Escape"); await expectHomecoming(page); expect(errors).toEqual([]);
  });
}

test("reduced motion: quiet meadow entry and immediate shower-pad homecoming", async ({ page }) => {
  await page.goto("/visual-fixture/poster?ambient=spring"); await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
  await enterCompanionMeadow(page); const meadow = page.locator(".vc-meadow-walk");
  await expect(meadow).toBeVisible(); await expect(meadow).toHaveAttribute("data-state", "idle");
  expect(await meadow.evaluate(node => Number((node as HTMLElement).dataset.y) === Number((node as HTMLElement).dataset.groundY))).toBe(true);
  await page.keyboard.press("Escape"); await expectHomecoming(page);
});

test("folded house opens on return and compact house restores its shower pad", async ({ page }) => {
  await page.goto("/visual-fixture/poster?ambient=spring"); const home = await openCompanionHome(page);
  await placeCompanionOnExposedBackground(page, 180);
  const fold = home.locator('[data-home-action="fold"]'); if (await fold.getAttribute("aria-expanded") === "true") await fold.click();
  await enterCompanionMeadow(page); await expect(page.locator(".vc-meadow-walk")).toBeVisible();
  await page.keyboard.press("Escape"); await expect(fold).toHaveAttribute("aria-expanded", "true"); await expectHomecoming(page);
  await enterCompanionMeadow(page); await expect(page.locator(".vc-meadow-walk")).toBeVisible();
  await page.setViewportSize({ width: 1380, height: 900 });
  await expect(page.locator(".vc-meadow-walk")).toBeVisible();
  await page.keyboard.press("Escape"); await expectHomecoming(page);
  await expect(page.locator(".vc-compact-home")).toBeVisible();
});

test("slow jump packets keep the resident painted through immediate departure", async ({ page }) => {
  await page.goto("/visual-fixture/poster?ambient=spring"); await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
  let release!: () => void, requested = 0;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/companion\/hd\/vitamin-action-0[3456]-/, async route => { requested++; await pending; await route.continue(); });
  try {
    await enterCompanionMeadow(page); const meadow = page.locator(".vc-meadow-walk");
    await expect(meadow).toBeVisible({ timeout: 1000 });
    await expect(meadow).toHaveAttribute("data-state", "jump");
    const ink = await meadow.locator("canvas").evaluate(node => {
      const canvas = node as HTMLCanvasElement;
      const data = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
      return data.some((value, index) => index % 4 === 3 && value > 0);
    }); expect(ink).toBe(true);
    await expect(meadow).toHaveAttribute("data-state", "idle", { timeout: 2000 });
    expect(requested).toBeGreaterThan(0);
  } finally { release(); }
  await page.keyboard.press("Escape"); await expectHomecoming(page);
});

import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

type Mode = "full" | "lite" | "reduced" | "off";
const prefix = process.env.COMPANION_RELEASE_ARTIFACT_PREFIX ?? ".scratch-pw/companion-fast-release";
test.use({ viewport: { width: 1600, height: 1000 }, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  await mkdir(".scratch-pw", { recursive: true });
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() !== "GET" && request.method() !== "HEAD") return route.fulfill({ status: 204 });
    if (url.pathname === "/api/soop-live") return route.fulfill({ json: { live: false } });
    if (url.pathname === "/" || url.pathname === "/studio") return route.fulfill({ status: 200, contentType: "text/plain", body: "unused fixture navigation" });
    if (url.origin !== new URL(test.info().project.use.baseURL!).origin) return route.fulfill({ status: 204 });
    return route.continue();
  });
});

async function setup(page: Page, surface: "viewer" | "studio", mode: Mode) {
  await page.addInitScript(({ key, epoch, preferences, care, mode }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", mode === "reduced" ? "on" : "off");
    localStorage.setItem("vic.gfxPref", mode === "off" ? "off" : mode === "lite" ? "lite" : "max");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.premiereStage", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic_avatar_side", "left"); Math.random = () => 0;
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false },
    care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 }, mode });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-actor")).toBeVisible();
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-presence", "active");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
}

async function frames(page: Page, duration = 1000) {
  return page.locator(".vc-companion").evaluate(async (node, duration) => {
    const samples: { hidden: boolean; state?: string; platform?: string; x: number; y: number; width: number; height: number }[] = [];
    const start = performance.now();
    await new Promise<void>(resolve => { const tick = () => { const r = node.getBoundingClientRect(); samples.push({ hidden: (node as HTMLElement).hidden, state: (node as HTMLElement).dataset.state, platform: (node as HTMLElement).dataset.platform, x: r.x, y: r.y, width: r.width, height: r.height }); if (performance.now() - start < duration) requestAnimationFrame(tick); else resolve(); }; requestAnimationFrame(tick); });
    return samples;
  }, duration);
}

for (const surface of ["viewer", "studio"] as const) for (const mode of ["full", "lite", "reduced", "off"] as const) {
  test(`${surface} ${mode} double-click avoids placement and fast release remains grounded while scrolling`, async ({ page }) => {
    await setup(page, surface, mode);
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.locator(".vc-actor").dblclick();
    await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-placing");
    await expect(page.locator(".vc-actor")).not.toHaveCSS("cursor", "crosshair");
    await expect(page.locator("#vc-help")).not.toContainText("두 번");
    const rect = (await page.locator(".vc-actor").boundingBox())!;
    const home = await page.locator(".vc-home-launcher").count() ? page.locator(".vc-home-launcher") : page.locator(".vc-home");
    const control = (await home.boundingBox())!;
    const target = { x: control.x + control.width / 2, y: 997 };
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height * .45); await page.mouse.down();
    // One native movement crosses the viewport, immediately followed by up.
    await page.mouse.move(target.x, target.y); await page.mouse.up();
    await page.mouse.move(5, 5);
    const release = await frames(page, 1100);
    await page.screenshot({ path: `${prefix}-${surface}-${mode}-released.png` });
    await writeFile(`${prefix}-${surface}-${mode}.json`, JSON.stringify({ target, release, errors }, null, 2));
    await expect(page.locator(".vc-companion")).toBeVisible();
    await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-state", "held");
    await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-state", "jump");
    await expect(page.locator(".vc-companion")).toHaveAttribute("data-platform", /.+/);
    expect(release.filter(s => s.hidden)).toHaveLength(0);
    const scrolling = frames(page, 1300);
    await page.mouse.wheel(0, 500); await page.waitForTimeout(250); await page.mouse.wheel(0, -500);
    const scroll = await scrolling;
    await writeFile(`${prefix}-${surface}-${mode}.json`, JSON.stringify({ target, release, scroll, errors }, null, 2));
    expect(scroll.filter(s => s.hidden)).toHaveLength(0);
    expect(scroll.every(s => Number.isFinite(s.x) && Number.isFinite(s.y) && s.width > 0 && s.height > 0)).toBe(true);
    await expect(page.locator(".vc-companion")).toHaveCount(1); expect(errors).toEqual([]);
  });
}

for (const surface of ["viewer", "studio"] as const) test(`${surface} release consumes the native final pointer position`, async ({ page }) => {
  await setup(page, surface, "full");
  const actor = (await page.locator(".vc-actor").boundingBox())!, carrier = (await page.locator(".vc-companion").boundingBox())!;
  const start = { x: actor.x + actor.width / 2, y: actor.y + actor.height * .45 };
  const offsetX = start.x - (carrier.x + carrier.width / 2);
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(600, 450);
  const cdp = await page.context().newCDPSession(page);
  // Native browser input with no intervening mouseMoved models a newer up
  // sample. Do not synthesize DOM events or call application callbacks.
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 1250, y: 500, button: "left", buttons: 0, clickCount: 1 });
  await cdp.detach(); await page.mouse.move(5, 5);
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-state", "held");
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-state", "jump");
  const body = (await page.locator(".vc-companion").boundingBox())!;
  await writeFile(`${prefix}-${surface}-final-point.json`, JSON.stringify({ start, offsetX, releaseX: 1250, actualX: body.x + body.width / 2 }, null, 2));
  expect(Math.abs(body.x + body.width / 2 - (1250 - offsetX))).toBeLessThan(2);
});

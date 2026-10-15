import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";

async function setup(page: Page, mode: "full" | "reduced" | "off" = "full") {
  await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 500, body: "" }) : route.continue());
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ epoch, key, preferences, care, mode }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", mode === "reduced" ? "on" : "off");
    localStorage.setItem("vic.gfxPref", mode === "off" ? "off" : "max");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, mode, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05 } });
  await page.goto("/visual-fixture/poster?avatar=1"); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-companion")).toBeVisible();
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-atlas", "hd");
}

async function observeHold(page: Page) {
  return page.locator(".vc-companion").evaluate(async node => {
    const samples: { x: number; y: number; angle: number; scale: number; scaleY: number; bob: number; gripError: number; pose: string | undefined; hidden: boolean }[] = [];
    const start = performance.now();
    await new Promise<void>(resolve => {
      const tick = () => {
        const rect = node.getBoundingClientRect(), pose = getComputedStyle(node.querySelector(".vc-pose")!), matrix = new DOMMatrixReadOnly(pose.transform);
        const [ox, oy] = pose.transformOrigin.split(" ").map(parseFloat), [gx, gy] = getComputedStyle(node.querySelector(".vc-inertia")!).transformOrigin.split(" ").map(parseFloat), facing = new DOMMatrixReadOnly(getComputedStyle(node.querySelector(".vc-facing")!).transform).a;
        samples.push({ x: rect.x, y: rect.y, angle: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, scale: Math.hypot(matrix.a, matrix.b), scaleY: Math.hypot(matrix.c, matrix.d), bob: matrix.m42, gripError: Math.hypot(ox - (facing < 0 ? rect.width - gx : gx), oy - gy), pose: (node as HTMLElement).dataset.pose, hidden: (node as HTMLElement).hidden });
        if (performance.now() - start < 1500) requestAnimationFrame(tick); else resolve();
      }; requestAnimationFrame(tick);
    }); return samples;
  });
}

for (const mobile of [false, true]) test.describe(mobile ? "native touch held motion" : "pointer held motion", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: mobile, isMobile: mobile });
  test("a stationary grip stays under the pointer while the HD body wriggles, then lands on release", async ({ page }) => {
    await setup(page); const pet = page.locator(".vc-companion"), actor = page.locator(".vc-actor");
    const rect = (await actor.boundingBox())!, start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    const target = { x: Math.min(page.viewportSize()!.width - 55, start.x + 24), y: start.y + 28 };
    const client = mobile ? await page.context().newCDPSession(page) : null;
    if (client) {
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 54 }] });
      await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...target, id: 54 }] });
    } else { await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 8 }); }
    await expect(pet).toHaveAttribute("data-state", "held"); await page.waitForTimeout(220);
    const samples = await observeHold(page), span = (key: "x" | "y" | "angle" | "scale" | "scaleY" | "bob") => Math.max(...samples.map(s => s[key])) - Math.min(...samples.map(s => s[key]));
    expect(samples.length).toBeGreaterThan(15); expect(samples.every(s => !s.hidden)).toBe(true);
    expect(span("x")).toBeLessThan(1); expect(span("y")).toBeLessThan(1);
    expect(span("angle")).toBeGreaterThan(7); expect(span("scaleY")).toBeGreaterThan(.08);
    // Gravity extends below the actual grip; whole-body translation would
    // move that grip and the superseded bob/squash test allowed flattening.
    expect(samples.every(s => s.scaleY >= 1.18 && s.scaleY <= 1.32 && s.scale < 1 && Math.abs(s.bob) < .001 && s.gripError < .1)).toBe(true);
    console.log(JSON.stringify({ check: "held-gravity", nativeTouch: mobile, frames: samples.length, verticalScale: [Math.min(...samples.map(s => s.scaleY)), Math.max(...samples.map(s => s.scaleY))], verticalSpan: span("scaleY"), horizontalScale: [Math.min(...samples.map(s => s.scale)), Math.max(...samples.map(s => s.scale))], maxGripError: Math.max(...samples.map(s => s.gripError)) }));
    expect(new Set(samples.map(s => s.pose)).size).toBeGreaterThanOrEqual(10);
    await expect(pet).toHaveAttribute("data-atlas", "hd");
    await page.screenshot({ path: `.scratch-pw/companion-054-held-${mobile ? "touch" : "pc"}.png` });
    if (client) { await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await client.detach(); } else await page.mouse.up();
    await expect(pet).not.toHaveAttribute("data-state", "held");
    await expect(pet).not.toHaveAttribute("data-state", "jump", { timeout: 5000 }); await expect(pet).toBeVisible();
  });
});

for (const mode of ["reduced", "off"] as const) test(`held motion is quiet with ${mode}, while direct dragging still works`, async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page, mode);
  const pet = page.locator(".vc-companion"), rect = (await page.locator(".vc-actor").boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 24, rect.y + rect.height / 2 + 20, { steps: 6 });
  await expect(pet).toHaveAttribute("data-state", "held"); await page.waitForTimeout(220);
  const samples = await observeHold(page);
  expect(new Set(samples.map(s => s.pose)).size).toBe(1);
  expect(samples.every(s => Math.abs(s.angle) < .001 && Math.abs(s.scale - 1) < .001 && Math.abs(s.bob) < .001)).toBe(true);
  await page.mouse.up(); await expect(pet).not.toHaveAttribute("data-state", "held");
});

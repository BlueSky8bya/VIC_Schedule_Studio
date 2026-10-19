import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const output = process.env.COMPANION_CURTAIN_125_OUTPUT ?? ".scratch-pw/companion-125/curtains";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
test.setTimeout(45000);
test.use({ serviceWorkers: "block", storageState: { cookies: [], origins: [] } });

async function fixture(page: Page, personality: "curious" | "sleepy", hour: number, quiet = false) {
  const errors: string[] = [], requests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      requests.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { requests.push(request.method() + " " + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No fixture APIs" });
    return route.continue();
  });
  await page.addInitScript(({ preferences, epoch, epochKey, personality, quiet }) => {
    for (const [key, value] of Object.entries({
      [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, sleep: true, sound: false, personality, activeWhileVisible: true }),
      "vic.gfx": JSON.stringify({ mode: quiet ? "off" : "full", at: Date.now(), v: 3 }), "vic.gfxPref": quiet ? "off" : "max", "vic.reduceMotion": quiet ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic_avatar_side": "left",
    })) localStorage.setItem(key, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, personality, quiet });
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
    writeFileSync(`${output}/${name}.json`, JSON.stringify({ build: readFileSync(".next/BUILD_ID", "utf8").trim(), errors, requests, geometry: await geometry(page) }, null, 2));
    await room.screenshot({ path: `${output}/${name}.png` });
  } };
}

async function geometry(page: Page) {
  return page.locator(".vc-home-room").evaluate(room => {
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const glass = rect(room.querySelector(".vc-window-glass")!);
    const panels = [...room.querySelectorAll(".vc-window-curtain")].map(node => ({ ...rect(node), transition: getComputedStyle(node).transitionDuration }));
    return { glass, panels, anchors: [...room.querySelectorAll("button[data-home-action],.vc-home-cushion,.vc-home-floor,.vc-dispenser-slot,.vc-toy-box-opening")].map(rect) };
  });
}

for (const [personality, scale] of [["curious", .18], ["sleepy", .42]] as const) test(`125 bright sunlight shades the actual window for awake ${personality}`, async ({ page }) => {
  const state = await fixture(page, personality, 12);
  const window = state.room.locator(".vc-home-window");
  await expect(window).toHaveAttribute("data-curtain", "shade");
  await expect.poll(async () => { const data = await geometry(page); return (data.panels[0].width + data.panels[1].width) / data.glass.width; }).toBeCloseTo(scale * 1.02, 2);
  expect(await window.getAttribute("data-curtain-rest")).toBe("awake");
  await state.verify(`sun-${personality}`);
});

for (const quiet of [false, true]) test(`125 actual home nap closes and releases curtains${quiet ? " without motion" : " on wake"}`, async ({ page }) => {
  const state = await fixture(page, "curious", 23, quiet);
  const window = state.room.locator(".vc-home-window");
  await expect(window).toHaveAttribute("data-curtain", "open");
  const before = await geometry(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  await actor.focus(); await actor.press("n"); await page.mouse.move(2, 2);
  await expect(window).toHaveAttribute("data-curtain", "closed");
  await expect.poll(async () => { const data = await geometry(page); return data.panels[0].right - data.panels[1].x; }).toBeGreaterThanOrEqual(0);
  const closed = await geometry(page);
  expect(closed.anchors).toEqual(before.anchors);
  expect(closed.panels[0].x).toBeLessThanOrEqual(closed.glass.x + .1);
  expect(closed.panels[1].right).toBeGreaterThanOrEqual(closed.glass.right - .1);
  if (quiet) expect(closed.panels.every(panel => panel.transition === "0s")).toBe(true);
  await state.verify(quiet ? "quiet-closed" : "nap-closed");
  if (!quiet) {
    await expect(window).toHaveAttribute("data-curtain", "open", { timeout: 16000 });
    expect((await geometry(page)).anchors).toEqual(before.anchors);
    await state.verify("night-awake-open");
  }
});

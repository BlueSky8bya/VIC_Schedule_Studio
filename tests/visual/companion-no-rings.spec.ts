import { test, expect, type Page, type Locator } from "@playwright/test";
import { readFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { enterCompanionMeadow } from "./helpers/companion-outdoor";
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
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, reduced: info.title.includes("quiet") });
});

async function noHalo(item: Locator, shadow = true) {
  const style = await item.evaluate(node => {
    const css = getComputedStyle(node);
    return { outline: css.outlineStyle, width: parseFloat(css.outlineWidth), shadow: css.boxShadow };
  });
  expect(style.outline === "none" || style.width === 0, JSON.stringify(style)).toBe(true);
  if (shadow) expect(style.shadow).toBe("none");
}

async function keyboardFocus(page: Page, item: Locator) {
  await page.keyboard.press("Tab"); await item.focus();
  expect(await item.evaluate(node => node.matches(":focus-visible"))).toBe(true);
  await noHalo(item);
}

async function roomFocus(page: Page, home: Locator) {
  const buttons = home.locator("button:visible:enabled");
  expect(await buttons.count()).toBeGreaterThan(8);
  for (const button of await buttons.all()) await keyboardFocus(page, button);
}

async function moveOutside(page: Page, item: Locator, x: number) {
  const box = (await item.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await noHalo(item); await page.mouse.move(x, 990, { steps: 16 }); await page.waitForTimeout(180);
  await noHalo(item); await page.mouse.up(); await page.mouse.move(2, 2);
  await expect(item).toHaveAttribute("data-platform", /^viewport-floor/); await noHalo(item);
}

for (const surface of ["viewer", "studio", "preview"] as const) {
  test(`${surface}: physical objects have no rings through keyboard, pointer, meadow and return`, async ({ page }, info) => {
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(surface === "viewer" ? "/visual-fixture/poster?ambient=spring" : `/visual-fixture/studio?role=developer&y=2026&m=3${surface === "preview" ? "&viewer=1" : ""}`);
    const home = await openCompanionHome(page); await placeCompanionOnHomeFloor(page); await roomFocus(page, home);
    const actor = page.locator(".vc-actor"); await keyboardFocus(page, actor); await actor.press("Enter"); await noHalo(actor);
    const dispenser = home.getByRole("button", { name: "밥 꺼내기", exact: true }); await dispenser.focus(); await dispenser.press("Enter");
    const food = page.locator(".vc-food").last(); await expect(food).not.toHaveAttribute("data-falling");
    await keyboardFocus(page, food); await food.press("Enter"); await expect(food).toHaveAttribute("data-selected", ""); await noHalo(food);
    await page.screenshot({ path: info.outputPath("selected-food-no-ring.png") });
    await food.press("ArrowRight"); await noHalo(food); await food.press("Enter"); await moveOutside(page, food, 90);
    const box = home.getByRole("button", { name: "장난감 상자 열기", exact: true }); await box.focus(); await box.press("Enter");
    const toy = page.locator(".vc-toy").last(); await expect(toy).toHaveAttribute("data-falling", "false");
    await keyboardFocus(page, toy); await toy.press("Enter"); await expect(toy).toHaveAttribute("data-held", "true"); await noHalo(toy);
    await toy.press("ArrowRight"); await noHalo(toy); await toy.press("Escape"); await moveOutside(page, toy, 170);
    await enterCompanionMeadow(page); const meadow = page.locator(".vc-meadow-walk"); await expect(meadow).toHaveAttribute("data-state", "idle");
    const walker = page.locator(".vc-meadow-walk-body"); await keyboardFocus(page, walker); await walker.press("Enter"); await noHalo(walker);
    for (const item of [food, toy]) {
      await keyboardFocus(page, item); await item.press("Enter"); await expect(item).toHaveAttribute("data-showcase-held", "");
      await noHalo(item); await item.press("ArrowRight"); await noHalo(item); await item.press("Enter");
    }
    await page.keyboard.press("Escape"); await expect(meadow).toHaveCount(0);
    await expect(page.locator(".vc-companion")).toHaveAttribute("data-platform", "companion-home-floor-400");
    await keyboardFocus(page, food); await food.press("Enter"); await expect(food).toHaveAttribute("data-selected", "");
    await expect(food).not.toHaveAttribute("data-showcase-lease"); await noHalo(food);
    await page.screenshot({ path: info.outputPath("returned-selected-food-no-ring.png") });
    await food.press("Enter"); expect(errors).toEqual([]);
  });
}

test("quiet compact home: furniture and actor stay ring-free in dark presentation", async ({ page }) => {
  await page.setViewportSize({ width: 1380, height: 900 }); await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/visual-fixture/poster?ambient=spring");
  const launcher = page.locator(".vc-home-launcher:visible").first();
  if (await launcher.isVisible()) { await page.keyboard.press("Tab"); await launcher.focus(); await noHalo(launcher, false); }
  const home = await openCompanionHome(page); await roomFocus(page, home);
  await keyboardFocus(page, page.locator(".vc-actor"));
  const dispenser = home.getByRole("button", { name: "밥 꺼내기", exact: true }); await dispenser.focus(); await dispenser.press("Enter");
  const food = page.locator(".vc-food").last(); await keyboardFocus(page, food); await food.press("Enter");
  await expect(food).toHaveAttribute("data-selected", ""); await noHalo(food);
});


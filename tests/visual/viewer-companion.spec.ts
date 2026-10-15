import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionCare } from "./helpers/companion-home";

const requests = new WeakMap<Page, { posts: string[]; atlas: number }>();
test.beforeEach(async ({ page, context }) => {
  const seen = { posts: [] as string[], atlas: 0 };
  requests.set(page, seen);
  await context.route("**/*", route => {
    const request = route.request();
    if (request.url().includes("/companion/victamin-fluid.webp")) seen.atlas++;
    if (request.method() === "POST") { seen.posts.push(request.url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

async function seed(page: Page, patch?: Partial<CompanionPreferences>, reduced = false) {
  await page.addInitScript(({ epochKey, epoch, preferences, reduced }) => {
    localStorage.setItem(epochKey, epoch);
    localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.sound", "off");
    if (preferences) localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    else localStorage.removeItem("vic.viewerCompanion");
  }, { epochKey: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: patch ? { ...DEFAULT_COMPANION_PREFERENCES, ...patch } : undefined, reduced });
}
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const position = (page: Page) => pet(page).evaluate(el => {
  const r = el.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
async function centre(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function openHome(page: Page) {
  const home = page.getByRole("region", { name: "빅타민 집", exact: true });
  if (!(await home.isVisible())) await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).click();
  await expect(home).toBeVisible();
}
async function stationaryFixture(page: Page, reduced = false) {
  await seed(page, { enabled: true, roam: false, heartPrank: false, ambientPrank: false }, reduced);
  await page.goto("/visual-fixture/poster");
  await expect(actor(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.locator(".agenda-day,.public-day").evaluateAll(elements => elements.some(el => el.getAnimations().some(animation => animation.playState === "running" && animation.effect?.getComputedTiming().iterations !== Infinity)))).toBe(false);
  await page.waitForTimeout(180); // Observe the completed font/entrance geometry.
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect(pet(page)).toBeInViewport({ ratio: .99999 }); // Subpixel intersection-ratio precision.
}

test("default OFF downloads no sprite, and the shared settings turn it on and off", async ({ page }) => {
  await seed(page);
  await page.goto("/visual-fixture/poster");
  await expect(page.locator(".poster-page")).toBeVisible();
  await page.waitForTimeout(900);
  await expect(pet(page)).toHaveCount(0);
  expect(requests.get(page)!.atlas).toBe(0);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "설정", exact: true });
  await settings.getByRole("tab", { name: "빅타민", exact: true }).click();
  const master = settings.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true });
  await expect(master).toHaveAttribute("aria-checked", "false");
  await master.click();
  await expect(master).toHaveAttribute("aria-checked", "true");
  const month = page.locator(".poster-chrome-title:visible,.agenda-title:visible");
  const monthBefore = await month.textContent();
  const detailTabs = settings.getByRole("tablist", { name: "빅타민 설정", exact: true });
  await detailTabs.getByRole("tab", { name: "움직임", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(detailTabs.getByRole("tab", { name: "장난", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(month).toHaveText(monthBefore!);
  await settings.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(actor(page)).toBeVisible();
  await expect.poll(() => requests.get(page)!.atlas).toBeGreaterThan(0);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(pet(page)).not.toBeVisible();
  await settings.getByRole("tab", { name: "빅타민", exact: true }).click();
  await settings.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
  await settings.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(pet(page)).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).enabled)).toBe(false);
});

for (const width of [1440, 390]) {
  test(`pointer petting and dragging stay inside the viewport at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await stationaryFixture(page);
    await actor(page).click();
    await expect(pet(page)).toHaveAttribute("data-state", "petted");
    await expect(page.locator(".vc-effect")).toHaveText("♡");
    const before = await position(page), grab = await centre(actor(page));
    await page.mouse.move(grab.x, grab.y); await page.mouse.down();
    await page.waitForTimeout(420);
    await expect(pet(page)).toHaveAttribute("data-grab-ready", "");
    const targetX = grab.x < width / 2 ? Math.min(width - 55, grab.x + 110) : Math.max(55, grab.x - 110);
    await page.mouse.move(targetX, Math.max(130, grab.y - 80), { steps: 5 });
    await expect(pet(page)).toHaveAttribute("data-state", "held");
    const held = await position(page);
    expect(Math.abs(held.x - before.x)).toBeGreaterThan(30);
    await page.mouse.up();
    await expect.poll(async () => (await pet(page).getAttribute("data-state")) !== "held").toBe(true);
    await page.waitForTimeout(750);
    await expect(pet(page)).toBeInViewport({ ratio: .99999 });
    await page.screenshot({ path: `.scratch-pw/viewer-companion-${width}.png` });
    expect(requests.get(page)!.posts).toEqual([]);
  });
}

test("keyboard and the home offer non-dragging placement, plus a finite nap", async ({ page }) => {
  await stationaryFixture(page);
  await actor(page).focus();
  await page.keyboard.press("Enter");
  await expect(pet(page)).toHaveAttribute("data-state", "petted");
  const month = page.locator(".poster-chrome-title:visible,.agenda-title:visible");
  const monthBefore = await month.textContent();
  const before = await position(page);
  await page.keyboard.press("Space");
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await position(page)).x).toBeCloseTo(before.x - 24, 0);
  await expect(month).toHaveText(monthBefore!);
  // Native repeated keydowns reach both viewport edges while the pet is held.
  // A looser input clamp used to let paint hide the focused actor at an edge,
  // so subsequent arrows escaped into calendar shortcuts.
  for (const key of ["ArrowLeft", "ArrowUp"]) {
    await page.keyboard.down(key);
    for (let repeat = 0; repeat < 70; repeat++) await page.keyboard.down(key);
    await page.keyboard.up(key);
  }
  await expect(actor(page)).toBeVisible(); await expect(actor(page)).toBeFocused();
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  await expect(pet(page)).toBeInViewport({ ratio: .99999 });
  const edge = await position(page);
  expect(edge.x).toBeGreaterThanOrEqual(0); expect(edge.x).toBeLessThanOrEqual(8);
  expect(edge.y).toBeGreaterThanOrEqual(0); expect(edge.y).toBeLessThanOrEqual(12);
  await expect(month).toHaveText(monthBefore!);
  await page.keyboard.press("Space");
  await expect.poll(async () => (await pet(page).getAttribute("data-state")) !== "held").toBe(true);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 5000 });
  await expect(actor(page)).toBeVisible(); await expect(actor(page)).toBeFocused();
  await expect(pet(page)).toBeInViewport({ ratio: .99999 });
  await expect(pet(page)).toHaveAttribute("data-platform", /.+/);
  await openHome(page);
  await chooseCompanionCare(page, "옮길 곳 고르기");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(180, 800);
  await expect(pet(page)).not.toHaveAttribute("data-placing");
  await page.waitForTimeout(750);
  // Placement may snap the feet slightly inward from the nearest ledge edge.
  await expect.poll(async () => Math.abs((await position(page)).x + 76 / 2 - 180)).toBeLessThanOrEqual(22);
  // This fixture intentionally has no server heart action, hence no heart
  // buttons. A local native-button sentinel checks placement click ownership;
  // this does not claim coverage of production voting or authentication.
  await page.locator(".public-event:visible").first().evaluate(card => {
    const button = document.createElement("button");
    button.type = "button"; button.className = "event-heart"; button.id = "companion-placement-sentinel";
    button.setAttribute("aria-label", "Placement guard sentinel");
    button.setAttribute("aria-pressed", "false"); button.setAttribute("data-native-clicks", "0");
    button.textContent = "♥";
    button.style.cssText = "position:absolute;right:4px;top:4px;width:24px;height:24px;display:block;opacity:1;pointer-events:auto;z-index:5";
    button.addEventListener("click", () => { button.setAttribute("data-native-clicks", String(Number(button.getAttribute("data-native-clicks")) + 1)); button.setAttribute("aria-pressed", "true"); });
    card.appendChild(button);
  });
  const heart = page.locator("#companion-placement-sentinel");
  const heartPoint = await centre(heart);
  for (const hold of [0, 1200]) {
    await openHome(page);
    await chooseCompanionCare(page, "옮길 곳 고르기");
    await expect(pet(page)).toHaveAttribute("data-placing", "");
    await page.mouse.move(heartPoint.x, heartPoint.y);
    await expect.poll(() => heart.evaluate((el, point) => document.elementFromPoint(point.x, point.y)?.closest(".event-heart") === el, heartPoint)).toBe(true);
    await page.mouse.down();
    if (hold) await page.waitForTimeout(hold);
    await page.mouse.up();
    await expect(pet(page)).not.toHaveAttribute("data-placing");
    await expect(heart).toHaveAttribute("data-native-clicks", "0");
    await expect(heart).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator(".agenda-detail-backdrop")).toHaveCount(0);
    await page.waitForTimeout(750);
  }
  await openHome(page);
  await chooseCompanionCare(page, "옮길 곳 고르기");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.keyboard.press("Escape");
  await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(actor(page)).toBeFocused();
  await page.waitForTimeout(750);
  await openHome(page);
  await chooseCompanionCare(page, "여기서 낮잠");
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  await expect(pet(page)).toHaveAttribute("data-dreaming", "");
  await expect(page.locator(".vc-dream")).toBeVisible();
  await expect(page.locator(".vc-dream i")).toHaveText(["z", "z", "Z"]);
  await actor(page).click();
  await expect(pet(page)).toHaveAttribute("data-state", "petted");
  expect(requests.get(page)!.posts).toEqual([]);
});

test("a settings overlay pauses the companion and closing resumes it", async ({ page }) => {
  await stationaryFixture(page);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "설정", exact: true })).toBeVisible();
  await expect(pet(page)).not.toBeVisible();
  await page.getByRole("dialog", { name: "설정", exact: true }).getByRole("button", { name: "닫기", exact: true }).click();
  await expect(actor(page)).toBeVisible();
  await expect(pet(page)).toBeInViewport({ ratio: .99999 });
  // A held keypose is intentional, so clip-column churn no longer proves
  // liveness. Verify the resumed creature accepts a real direct interaction.
  await actor(page).click();
  await expect(pet(page)).toHaveAttribute("data-state", "petted");
});

test("reduce motion keeps the enabled creature stationary and direct affection usable", async ({ page }) => {
  await seed(page, { enabled: true, roam: true, jump: true, ambientPrank: true }, true);
  await page.goto("/visual-fixture/poster");
  await expect(actor(page)).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion");
  await page.waitForTimeout(800);
  const before = await position(page);
  await page.waitForTimeout(2600);
  expect(await position(page)).toEqual(before);
  await actor(page).focus(); await page.keyboard.press("Enter");
  await expect(pet(page)).toHaveAttribute("data-state", "petted");
  expect(await position(page)).toEqual(before);
  expect(requests.get(page)!.posts).toEqual([]);
});

test("autonomous exploration advances sprite poses and moves without a server request", async ({ page }) => {
  test.setTimeout(25000);
  await seed(page, { enabled: true, roam: true, jump: true, sleep: false, heartPrank: false, ambientPrank: false, speed: "lively" });
  await page.goto("/visual-fixture/poster");
  await expect(actor(page)).toBeVisible();
  const before = await position(page);
  const firstFrame = await pet(page).evaluate(el => (el as HTMLElement).style.getPropertyValue("--vc-column"));
  await expect.poll(() => pet(page).evaluate(el => (el as HTMLElement).style.getPropertyValue("--vc-column"))).not.toBe(firstFrame);
  await expect.poll(async () => {
    const p = await position(page);
    return Math.hypot(p.x - before.x, p.y - before.y);
  }, { timeout: 15000 }).toBeGreaterThan(8);
  await expect(pet(page)).toBeInViewport({ ratio: .99999 });
  expect(requests.get(page)!.posts).toEqual([]);
});

test("the premiere owns the stage while the optional roaming pet stays outside the poster surface", async ({ page }) => {
  await seed(page, { enabled: true, roam: false, heartPrank: false, ambientPrank: false });
  await page.goto("/visual-fixture/poster?premiere=20");
  await expect(page.locator(".pm-focused")).toBeVisible();
  await expect(pet(page)).not.toBeVisible();
  await expect(page.locator("[data-export-surface] .vc-companion")).toHaveCount(0);
  await page.getByRole("button", { name: "일정표 보기", exact: true }).click();
  await expect(page.locator(".pm-focused")).toHaveCount(0);
  await expect(actor(page)).toBeVisible();
  await expect(page.locator("[data-export-surface] .vc-companion")).toHaveCount(0);
  await page.getByRole("button", { name: "최초공개 다시 보기" }).click();
  await expect(page.locator(".pm-focused")).toBeVisible();
  await expect(pet(page)).not.toBeVisible();
  expect(requests.get(page)!.posts).toEqual([]);
});

test("document visibility and showcase locks pause and resume the same local creature", async ({ page }) => {
  await stationaryFixture(page);
  const before = await position(page);
  // This checks the app's visibility-event branch, not real device throttling.
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(pet(page)).not.toBeVisible();
  await page.waitForTimeout(300);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(actor(page)).toBeVisible();
  expect(await position(page)).toEqual(before);
  await page.evaluate(() => { document.documentElement.dataset.showcase = "1"; });
  await expect(pet(page)).not.toBeVisible();
  await page.evaluate(() => { delete document.documentElement.dataset.showcase; });
  await expect(actor(page)).toBeVisible();
  await actor(page).focus(); await page.keyboard.press("Enter");
  await expect(pet(page)).toHaveAttribute("data-state", "petted");
  expect(requests.get(page)!.posts).toEqual([]);
});

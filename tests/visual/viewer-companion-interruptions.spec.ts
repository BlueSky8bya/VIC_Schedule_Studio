import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";

const requests = new WeakMap<Page, string[]>();
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const pet = (page: Page) => page.locator(".vc-companion");
const menu = (page: Page) => page.getByRole("group", { name: "빅타민과 놀기", exact: true });
const feet = (page: Page) => pet(page).evaluate(element => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.bottom };
});
// Measure the actual DOM ledges, rather than duplicating the brain's weak ids.
const supportDistance = (page: Page) => pet(page).evaluate(element => {
  const box = element.getBoundingClientRect(), x = box.left + box.width / 2, y = box.bottom;
  const supports = [{ left: 12, right: innerWidth - 12, y: innerHeight - 18 }];
  const selector = ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]";
  for (const card of document.querySelectorAll<HTMLElement>(selector)) {
    const rect = card.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) supports.push({ left: rect.left, right: rect.right, y: rect.top + 1 });
  }
  for (const day of document.querySelectorAll<HTMLElement>(".public-day,.agenda-day")) {
    const rect = day.getBoundingClientRect();
    if (rect.height >= 88 && !day.querySelector(selector)) supports.push({ left: rect.left, right: rect.right, y: rect.bottom - 12 });
  }
  return Math.min(...supports.filter(support => x >= support.left - 1 && x <= support.right + 1).map(support => Math.abs(support.y - y)));
});

test.beforeEach(async ({ page }) => {
  const posts: string[] = []; requests.set(page, posts);
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { posts.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(requests.get(page)).toEqual([]); });

async function setup(page: Page, reduced: boolean, patch: Partial<CompanionPreferences> = {}) {
  await page.addInitScript(({ reduced, preferences, care }) => {
    localStorage.setItem("vic.settingsEpoch", "2026-09-04");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.setItem("vic.gfxPref", "max");
    localStorage.setItem("vic.reduceMotion", reduced ? "on" : "off");
    localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.sound", "off");
    Math.random = () => .999999;
  }, { reduced, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, heartPrank: false, ambientPrank: false, feeding: false, ...patch }, care: { ...DEFAULT_COMPANION_CARE, hunger: .1 } });
  await page.goto("/visual-fixture/poster");
  await expect(actor(page)).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => supportDistance(page)).toBeLessThan(3);
}
async function liftWithKeyboard(page: Page) {
  const before = await feet(page);
  await actor(page).focus();
  await page.keyboard.press("Space");
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect.poll(async () => before.y - (await feet(page)).y).toBeGreaterThan(20);
  return feet(page);
}
async function keyboardMenu(page: Page) {
  await actor(page).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "빅타민 메뉴", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu(page)).toBeVisible();
}

test("reduced-motion keyboard lift can enter the menu, land and nap instead of staying held", async ({ page }) => {
  await setup(page, true);
  await liftWithKeyboard(page);
  await keyboardMenu(page);
  await menu(page).getByRole("button", { name: "잠깐 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
  await expect.poll(() => supportDistance(page)).toBeLessThan(3);
  await expect(pet(page)).toBeInViewport({ ratio: .99999 }); // Subpixel intersection-ratio precision.
  await page.waitForTimeout(700);
  await expect(pet(page)).toHaveAttribute("data-state", "sleep");
});

test("a visibility-event pause releases an airborne keyboard hold and resumes on a real support", async ({ page }) => {
  await setup(page, false);
  await liftWithKeyboard(page);
  // App event-branch coverage; this does not claim real OS/tab throttling.
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(pet(page)).not.toBeVisible();
  await page.waitForTimeout(300);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(actor(page)).toBeVisible();
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect.poll(() => supportDistance(page), { timeout: 4000 }).toBeLessThan(3);
  await expect(pet(page)).toBeInViewport({ ratio: .99999 });
  // A fresh hold/release still works; the old held state cannot leak back in.
  await actor(page).focus(); await page.keyboard.press("Space");
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  await page.keyboard.press("Space");
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect.poll(() => supportDistance(page)).toBeLessThan(3);
});

test("an autonomous jump freezes for a long-open menu and finishes after closing", async ({ page }) => {
  test.setTimeout(25_000);
  await setup(page, false, { roam: true, jump: true, sleep: false, speed: "lively" });
  await expect(pet(page)).toHaveAttribute("data-state", "jump", { timeout: 15_000 });
  await expect.poll(() => supportDistance(page), { intervals: [16, 25, 50], timeout: 15_000 }).toBeGreaterThan(20);
  await keyboardMenu(page);
  const frozen = await feet(page);
  await page.waitForTimeout(1250);
  const held = await feet(page);
  expect(Math.hypot(frozen.x - held.x, frozen.y - held.y)).toBeLessThan(2);
  await menu(page).getByRole("button", { name: "닫기", exact: true }).click();
  await expect.poll(async () => { const point = await feet(page); return Math.hypot(point.x - held.x, point.y - held.y); }, { timeout: 4000 }).toBeGreaterThan(4);
  await expect.poll(() => supportDistance(page), { timeout: 5000 }).toBeLessThan(3);
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect(pet(page)).toBeInViewport({ ratio: .99999 });
});

test("pausing a dragged snack releases capture and returns it to the floor", async ({ page }) => {
  await setup(page, false, { feeding: true });
  await keyboardMenu(page);
  await menu(page).getByRole("button", { name: "사과 밥 꺼내기", exact: true }).click();
  const snack = page.locator(".vc-food");
  await expect(snack).toHaveCount(1);
  await expect(snack).toBeFocused();
  await snack.evaluate(node => node.addEventListener("pointerdown", event => { (node as HTMLElement).dataset.capturePointer = String((event as PointerEvent).pointerId); }));
  const box = (await snack.boundingBox())!, height = page.viewportSize()!.height;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(180, height - 26, { steps: 8 });
  await expect.poll(() => snack.evaluate(node => node.hasPointerCapture(Number((node as HTMLElement).dataset.capturePointer)))).toBe(true);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(page.locator(".vc-food-layer")).not.toBeVisible();
  await expect.poll(() => snack.evaluate(node => node.hasPointerCapture(Number((node as HTMLElement).dataset.capturePointer)))).toBe(false);
  await page.mouse.up();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => false }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(snack).toBeVisible();
  await expect.poll(() => snack.evaluate(node => Number.parseFloat((node as HTMLElement).style.top))).toBe(height - 18);
  await expect.poll(() => snack.evaluate(node => Number.parseFloat((node as HTMLElement).style.left))).toBe(180);
  await page.mouse.move(260, height - 80, { steps: 5 });
  await page.waitForTimeout(300);
  expect(await snack.evaluate(node => Number.parseFloat((node as HTMLElement).style.left))).toBe(180);
  await expect(snack).not.toHaveAttribute("data-selected");
  await expect(snack).toBeInViewport({ ratio: 1 });
});

import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { chooseCompanionCare } from "./helpers/companion-home";

const requests = new WeakMap<Page, string[]>();
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const pet = (page: Page) => page.locator(".vc-companion");
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const feet = (page: Page) => pet(page).evaluate(element => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.bottom };
});
const floorY = (page: Page) => page.evaluate(() => {
  let y = innerHeight - 18;
  for (const bar of document.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
    const rect = bar.getBoundingClientRect(), style = getComputedStyle(bar);
    if (style.position === "fixed" && style.display !== "none" && rect.width > 0 && rect.height > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) y = Math.min(y, rect.top - 8);
  }
  return y;
});
// Measure rendered line tops and the cushion rather than the retired card-box
// tops. Text content and the brain's anonymous platform ids are never read.
const supportDistance = (page: Page) => pet(page).evaluate(element => {
  const box = element.getBoundingClientRect(), x = box.left + box.width / 2, y = box.bottom;
  let floor = innerHeight - 18;
  for (const bar of document.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
    const rect = bar.getBoundingClientRect(), style = getComputedStyle(bar);
    if (style.position === "fixed" && style.display !== "none" && rect.width > 0 && rect.height > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) floor = Math.min(floor, rect.top - 8);
  }
  const supports = [{ left: 12, right: innerWidth - 12, y: floor }];
  const selector = ".public-day .day-strip > strong,.agenda-day .agenda-when > strong,.public-event .event-main p,.public-event .event-subs li,.agenda-event .agenda-title-text,.agenda-event .agenda-subs li,.agenda-item .agenda-title-text,.agenda-item .agenda-title,.agenda-item .agenda-subs li";
  const range = document.createRange();
  for (const scope of document.querySelectorAll<HTMLElement>(selector)) {
    range.selectNodeContents(scope);
    for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0) supports.push({ left: rect.left, right: rect.right, y: rect.top - 3 });
  }
  range.detach();
  for (const cushion of document.querySelectorAll<HTMLElement>(".vc-home-cushion")) { const rect = cushion.getBoundingClientRect(); if (rect.width > 0 && rect.height > 0) supports.push({ left: rect.left, right: rect.right, y: rect.top }); }
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
async function keyboardHome(page: Page) {
  if (!(await home(page).isVisible())) {
    const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
    await launcher.focus(); await launcher.press("Enter");
  }
  await expect(home(page)).toBeVisible();
}

test("reduced-motion keyboard lift can enter the home, land and nap instead of staying held", async ({ page }) => {
  await setup(page, true);
  await liftWithKeyboard(page);
  await keyboardHome(page);
  await chooseCompanionCare(page, "여기서 낮잠", "keyboard");
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

test("a settings overlay interrupts an airborne jump and resumes on a real support", async ({ page }) => {
  test.setTimeout(25_000);
  await setup(page, false, { roam: true, jump: true, sleep: false, speed: "lively" });
  await expect(pet(page)).toHaveAttribute("data-state", "jump", { timeout: 15_000 });
  await expect.poll(() => supportDistance(page), { intervals: [16, 25, 50], timeout: 15_000 }).toBeGreaterThan(20);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "설정", exact: true });
  await expect(settings).toBeVisible();
  await expect(pet(page)).not.toBeVisible();
  const frozen = await pet(page).evaluate(el => (el as HTMLElement).style.transform);
  await page.waitForTimeout(1250);
  expect(await pet(page).evaluate(el => (el as HTMLElement).style.transform)).toBe(frozen);
  await settings.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(actor(page)).toBeVisible();
  await expect.poll(() => supportDistance(page), { timeout: 5000 }).toBeLessThan(3);
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect(pet(page)).toBeInViewport({ ratio: .99999 });
});

test("pausing a dragged snack releases capture and returns it to the floor", async ({ page }) => {
  await setup(page, false, { feeding: true });
  await keyboardHome(page);
  await home(page).getByRole("button", { name: "사과 밥 꺼내기", exact: true }).click();
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
  await expect.poll(() => snack.evaluate(node => Number.parseFloat((node as HTMLElement).style.top))).toBe(await floorY(page));
  await expect.poll(() => snack.evaluate(node => Number.parseFloat((node as HTMLElement).style.left))).toBe(180);
  await page.mouse.move(260, height - 80, { steps: 5 });
  await page.waitForTimeout(300);
  expect(await snack.evaluate(node => Number.parseFloat((node as HTMLElement).style.left))).toBe(180);
  await expect(snack).not.toHaveAttribute("data-selected");
  await expect(snack).toBeInViewport({ ratio: 1 });
});

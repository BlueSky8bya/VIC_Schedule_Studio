import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE, type CompanionCare } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionCare } from "./helpers/companion-home";
import { COMPANION_FOOD_NAMES, isCompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";

const posts = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, context }) => {
  const blocked: string[] = [];
  posts.set(page, blocked);
  await context.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const food = (page: Page) => page.locator(".vc-food");
const month = (page: Page) => page.locator("h1.poster-chrome-title:visible,h1.agenda-title:visible");
const storedCare = (page: Page): Promise<CompanionCare & { version: number }> => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!));
const floorY = (page: Page) => page.evaluate(() => {
  let y = innerHeight - 18;
  for (const bar of document.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
    const rect = bar.getBoundingClientRect(), style = getComputedStyle(bar);
    if (style.position === "fixed" && style.display !== "none" && rect.width > 0 && rect.height > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) y = Math.min(y, rect.top - 8);
  }
  return y;
});
async function centre(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function dragFoodToFeet(page: Page, item: Locator, point: { x: number; y: number }) {
  const from = await centre(item), foot = await item.evaluate(node => { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: m.m41, y: m.m42 }; });
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(point.x + from.x - foot.x, point.y + from.y - foot.y, { steps: 8 }); await page.mouse.up();
}
async function setup(page: Page, hunger = .58, patch: Partial<CompanionPreferences> = {}) {
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch);
    localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
  }, {
    key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, heartPrank: false, ambientPrank: false, feeding: true, ...patch },
    care: { ...DEFAULT_COMPANION_CARE, hunger },
  });
  await page.goto("/visual-fixture/poster");
  await expect(actor(page)).toBeVisible();
  if (page.viewportSize()!.width < 1040) await expect(page.locator(".public-calendar-shell.agenda-mode")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // The fixture starts with desktop topology, then enters agenda. Let its
  // finite date-row entrances finish before testing a static ledge drop.
  await expect.poll(() => page.locator(".agenda-day,.public-day").evaluateAll(elements => elements.some(el => el.getAnimations().some(animation => animation.playState === "running" && animation.effect?.getComputedTiming().iterations !== Infinity)))).toBe(false);
  await page.waitForTimeout(160); // Geometry observer's 120ms coalescing window.
  // Chromium reports .99999916 for a fully visible subpixel-translated76px
  // box. The tiny tolerance is below .001px clipping; keep smooth travel.
  await expect(pet(page)).toBeInViewport({ ratio: .99999 });
  // Vending outlets and calendar ledges need not share a support. Place the
  // creature first, then put each snack on its actual settled support. Mobile
  // may reject a floor occupied by bottom navigation and choose a safe ledge.
  await openHome(page);
  await chooseCompanionCare(page, "옮길 곳 고르기");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(180, page.viewportSize()!.height - 20);
  await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  if (page.viewportSize()!.width >= 1040) {
    await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
    const supportY = await floorY(page);
    await expect.poll(() => pet(page).evaluate((el, supportY) => Math.abs(el.getBoundingClientRect().bottom - supportY), supportY)).toBeLessThan(2);
  } else await expect(pet(page)).toHaveAttribute("data-platform", /^(?:date-|card-|viewport-floor|companion-home)/);
}
async function openHome(page: Page) {
  const home = page.getByRole("region", { name: "빅타민 집", exact: true });
  if (!(await home.isVisible())) await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).click();
  await expect(home).toBeVisible();
}
async function spawn(page: Page) {
  const before = await food(page).count();
  await openHome(page);
  const feed = page.getByRole("button", { name: "밥 꺼내기", exact: true }); await feed.click();
  await expect(food(page)).toHaveCount(before + 1);
  const item = food(page).last();
  await expect(item).not.toHaveAttribute("data-selected");
  await expect(feed).toBeFocused();
  await expect(page.locator(".vc-food-hint")).toHaveCount(0);
  const kind = await item.getAttribute("data-kind");
  expect(isCompanionFoodKind(kind)).toBe(true);
  if (!isCompanionFoodKind(kind)) throw new Error("Unknown snack catalogue kind");
  await expect(item).toHaveAccessibleName(`빅타민 밥 ${COMPANION_FOOD_NAMES[kind]} · 잡아서 옮기기`);
  return item;
}
async function placeNear(page: Page, item: Locator) {
  const before = await month(page).textContent();
  // Keyboard movement still belongs to the food rather than month shortcuts.
  await item.focus(); await item.press("Enter"); await expect(item).toHaveAttribute("data-selected", "");
  const original = await item.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
  await item.press("ArrowLeft");
  await expect.poll(() => item.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)).toBeCloseTo(Math.max(24, original - 24), 1);
  await item.press("ArrowRight");
  const target = await pet(page).evaluate(el => { const rect = el.getBoundingClientRect(); return { x: rect.left + rect.width / 2 + 24, y: rect.bottom }; });
  await dragFoodToFeet(page, item, target);
  await expect(item).not.toHaveAttribute("data-selected");
  await expect(page.locator(".vc-food-hint")).toHaveCount(0);
  await expect(month(page)).toHaveText(before!);
}

for (const width of [1440, 390]) {
  for (const mode of ["cat", "dog"] as const) {
    test(`a hungry ${mode} snack is placed, nibbled and remembered at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await setup(page, .58, { animalMode: mode });
      const item = await spawn(page);
      // Dispensing leaves food stationary and unselected. Measure meal credit
      // from the current care state before deliberately offering it by drag.
      const beforeAffection = Number(await page.getByRole("meter", { name: "빅타민 친밀도", exact: true }).getAttribute("value"));
      await page.waitForTimeout(350);
      await expect(item).not.toHaveAttribute("data-selected");
      await expect(pet(page)).not.toHaveAttribute("data-state", "eat");
      await placeNear(page, item);
      await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 10000 });
      await expect.poll(() => item.evaluate(el => Number((el as HTMLElement).style.getPropertyValue("--vc-nibble")))).toBeLessThan(.99);
      await expect(page.locator("[data-export-surface] .vc-food,[data-export-surface] .vc-companion")).toHaveCount(0);
      if (mode === "cat") await page.screenshot({ path: `.scratch-pw/viewer-companion-eating-${width}.png` });
      await expect(food(page)).toHaveCount(0, { timeout: 6000 });
      await expect(actor(page)).toBeFocused();
      const care = await storedCare(page);
      expect(care.hunger).toBeGreaterThan(.18); expect(care.hunger).toBeLessThan(.28);
      expect(care.affection - beforeAffection).toBeGreaterThan(.09); expect(care.affection - beforeAffection).toBeLessThan(.105);
      expect(care.version).toBe(1);
      await expect(pet(page)).toHaveAttribute("data-state", "petted");
    });
  }
}

test("a full creature refuses more food, at most three snacks stay, and leftovers can be cleared", async ({ page }) => {
  test.setTimeout(30000);
  await setup(page, .1);
  const item = await spawn(page);
  await placeNear(page, item);
  await pet(page).evaluate(el => {
    el.setAttribute("data-test-ate", "false");
    new MutationObserver(() => { if (el.getAttribute("data-state") === "eat") el.setAttribute("data-test-ate", "true"); }).observe(el, { attributes: true, attributeFilter: ["data-state"] });
  });
  await page.waitForTimeout(9000);
  await expect(food(page)).toHaveCount(1);
  await expect(pet(page)).toHaveAttribute("data-test-ate", "false");
  expect((await storedCare(page)).hunger).toBeLessThan(.15);
  for (let i = 0; i < 2; i++) await spawn(page);
  await expect(food(page)).toHaveCount(3);
  await openHome(page); await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  await expect(food(page)).toHaveCount(3);
  await expect(page.locator(".vc-food-layer [role='status']")).toContainText("세 개까지");
  await openHome(page); await chooseCompanionCare(page, "남은 밥 치우기");
  await expect(food(page)).toHaveCount(0);
  await expect(page.locator(".vc-food-hint")).toHaveCount(0);
});

test("food dragging and a long held release consume their clicks before cards underneath", async ({ page }) => {
  await setup(page, .1);
  const item = await spawn(page);
  const from = await centre(item);
  const height = page.viewportSize()!.height;
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(180, height - 26, { steps: 8 }); await page.mouse.up();
  await expect(item).not.toHaveAttribute("data-selected");
  await expect.poll(() => item.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)).toBe(await floorY(page));
  await expect(item).toBeInViewport({ ratio: 1 });
  await page.locator(".public-event:visible").first().evaluate(card => {
    // The visual fixture has no server voting prop. A native-button sentinel
    // tests click ownership without invoking or claiming real heart coverage.
    const button = document.createElement("button");
    button.type = "button"; button.id = "food-placement-sentinel"; button.className = "event-heart";
    button.textContent = "♥"; button.setAttribute("data-native-clicks", "0");
    button.style.cssText = "position:absolute;right:4px;top:4px;width:24px;height:24px;pointer-events:auto;opacity:1;display:block;z-index:5";
    button.addEventListener("click", () => button.setAttribute("data-native-clicks", String(Number(button.getAttribute("data-native-clicks")) + 1)));
    card.appendChild(button);
  });
  const target = page.locator("#food-placement-sentinel"), point = await centre(target);
  await expect.poll(() => target.evaluate((el, p) => document.elementFromPoint(p.x, p.y)?.closest(".event-heart") === el, point)).toBe(true);
  const grab = await centre(item); await page.mouse.move(grab.x, grab.y); await page.mouse.down();
  await page.mouse.move(point.x, point.y, { steps: 8 }); await page.waitForTimeout(1200); await page.mouse.up();
  await expect(item).not.toHaveAttribute("data-selected");
  await expect(target).toHaveAttribute("data-native-clicks", "0");
  await expect(page.locator(".agenda-detail-backdrop")).toHaveCount(0);
});

test("settings pause food, feeding OFF clears it, and changing month removes temporary snacks", async ({ page }) => {
  await setup(page, .1);
  const item = await spawn(page); await item.press("Enter");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "설정", exact: true });
  await expect(settings).toBeVisible();
  await expect(page.locator(".vc-food-layer")).not.toBeVisible();
  await expect(food(page)).toHaveCount(1);
  const pausedCare = await storedCare(page);
  await page.waitForTimeout(400);
  expect(await storedCare(page)).toEqual(pausedCare);
  await settings.getByRole("tab", { name: "빅타민", exact: true }).click();
  const tabs = settings.getByRole("tablist", { name: "빅타민 설정", exact: true });
  await tabs.getByRole("tab", { name: "성격", exact: true }).click();
  await settings.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true }).getByRole("radio", { name: "강아지", exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).animalMode)).toBe("dog");
  await tabs.getByRole("tab", { name: "교감", exact: true }).click();
  const feeding = settings.getByRole("switch", { name: "빅타민 밥주기 켜기/끄기", exact: true });
  await feeding.click(); await expect(feeding).toHaveAttribute("aria-checked", "false");
  await expect(food(page)).toHaveCount(0);
  await feeding.click(); await expect(feeding).toHaveAttribute("aria-checked", "true");
  await settings.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(actor(page)).toBeVisible();
  await expect(food(page)).toHaveCount(0);
  const next = await spawn(page); await next.press("Enter");
  const before = await month(page).textContent();
  await page.locator("[data-act='다음 달']").click();
  await expect(month(page)).not.toHaveText(before!);
  await expect(food(page)).toHaveCount(0);
  await expect(actor(page)).toBeVisible();
});

test("a settings pause interrupts a meal and closing starts a fresh visible nibble", async ({ page }) => {
  await setup(page, .58);
  const item = await spawn(page);
  await placeNear(page, item);
  await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 10000 });
  await expect.poll(() => item.evaluate(el => Number((el as HTMLElement).style.getPropertyValue("--vc-nibble")))).toBeLessThan(.9);
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "설정", exact: true });
  await expect(settings).toBeVisible();
  await expect(page.locator(".vc-food-layer")).not.toBeVisible();
  await page.waitForTimeout(3100);
  await expect(food(page)).toHaveCount(1);
  expect((await storedCare(page)).hunger).toBeGreaterThan(.5);
  await settings.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-state", "eat");
  await page.waitForTimeout(1500);
  await expect(food(page)).toHaveCount(1);
  await expect(food(page)).toHaveCount(0, { timeout: 5000 });
  expect((await storedCare(page)).hunger).toBeLessThan(.3);
});

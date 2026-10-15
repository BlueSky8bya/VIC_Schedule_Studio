import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionCare, openCompanionHome } from "./helpers/companion-home";

const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const pet = (page: Page) => page.locator(".vc-companion");
const house = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const posts = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => { if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); } return route.continue(); });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ prefs, care, epoch, key }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
  }, { prefs: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, heartPrank: false, ambientPrank: false }, care: DEFAULT_COMPANION_CARE, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function showHome(page: Page) {
  await openCompanionHome(page);
  await page.waitForTimeout(180); // coalesced support measurement
}
async function expectSmallHome(page: Page) {
  const box = (await house(page).boundingBox())!;
  expect(box.height).toBeGreaterThan(150);
  expect(box.height).toBeLessThanOrEqual(200);
  const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
  expect(box.height).toBeCloseTo(coarse ? 194 : 186, 0);
  return box.height;
}
async function point(page: Page) {
  const box = (await actor(page).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function expectIconRoom(page: Page, compact: boolean) {
  await expectSmallHome(page);
  await expect(house(page).getByRole("heading", { name: "빅타민 집", exact: true })).toBeVisible();
  await expect(house(page).getByRole("button", { name: "빅타민 집", exact: true })).toHaveAttribute("aria-expanded", "true");
  await expect(house(page).getByRole("menu")).toHaveCount(0);
  await expect(house(page).getByRole("menuitem")).toHaveCount(0);
  await expect(house(page).getByRole("button")).toHaveCount(compact ? 5 : 4);
  for (const button of await house(page).getByRole("button").all()) {
    const bounds = (await button.boundingBox())!;
    const title = await button.getAttribute("data-panel-section-toggle");
    const coarse = await page.evaluate(() => matchMedia("(pointer: coarse)").matches);
    expect(bounds.width).toBeGreaterThanOrEqual(44); expect(bounds.height).toBeGreaterThanOrEqual(title && !coarse ? 36 : 44);
    expect(await button.getAttribute("aria-label")).toBeTruthy();
  }
  await expect(house(page).getByRole("meter")).toHaveCount(3);
  await expect(house(page).locator("[data-companion-trash]")).toHaveCount(1);
}

test("one home follows the shared panel and keeps the same creature and care", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible(); await showHome(page);
  await expect(page.locator(".avatar-slot .vc-home")).toHaveCount(1); await expectSmallHome(page);
  await chooseCompanionCare(page, "쓰다듬기");
  const affection = Number(await house(page).getByRole("meter", { name: "빅타민 친밀도" }).getAttribute("value"));
  expect(affection).toBeGreaterThan(.36);
  await page.evaluate(() => { localStorage.setItem("vic_avatar_side", "right"); dispatchEvent(new Event("vic:side-panel")); });
  await expect(page.locator(".avatar-right .avatar-slot .vc-home")).toHaveCount(1); await expect(pet(page)).toHaveCount(1);
  await page.setViewportSize({ width: 900, height: 900 });
  await expect(page.getByRole("button", { name: "빅타민 집 열기", exact: true })).toBeVisible();
  await showHome(page); await expect(page.locator(".vc-compact-home .vc-home")).toHaveCount(1); await expectSmallHome(page);
  expect(Number(await house(page).getByRole("meter", { name: "빅타민 친밀도" }).getAttribute("value"))).toBeGreaterThan(.36);
  await expect(page.locator("[data-export-surface] .vc-home,[data-export-surface] .vc-companion")).toHaveCount(0);
  await page.screenshot({ path: ".scratch-pw/companion-home-responsive.png" });
});

test("compact home stays reachable in landscape and transfers keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible();
  const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
  await launcher.focus(); await launcher.press("Enter"); await expect(house(page)).toBeVisible();
  const close = house(page).getByRole("button", { name: "빅타민 집 닫기", exact: true });
  await expect(house(page).getByRole("button", { name: "빅타민 집", exact: true })).toBeFocused();
  const box = (await house(page).boundingBox())!; expect(box.y).toBeGreaterThanOrEqual(10); expect(box.y + box.height).toBeLessThan(390);
  await expectSmallHome(page);
  await chooseCompanionCare(page, "옮길 곳 고르기", "keyboard");
  await expect(actor(page)).toBeFocused(); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.keyboard.press("Escape"); await expect(pet(page)).not.toHaveAttribute("data-placing");
  await showHome(page); await close.click(); await expect(launcher).toBeFocused();
});

test("the desktop icon room offers three direct controls, bounded random food and keyboard cleanup", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible(); await showHome(page);
  await page.evaluate(() => document.fonts.ready); await expectIconRoom(page, false);
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
  });
  const cushion = house(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  const cushionGeometry = () => cushion.evaluate(button => {
    const anchor = button.querySelector<HTMLElement>(".vc-home-cushion")!, fabric = anchor.querySelector("i")!;
    const rect = anchor.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height, outerTransform: getComputedStyle(button).transform, fabricScaleY: new DOMMatrixReadOnly(getComputedStyle(fabric).transform).d };
  });
  const anchorBefore = await cushionGeometry(), cushionBox = (await cushion.boundingBox())!;
  await page.mouse.move(cushionBox.x + cushionBox.width / 2, cushionBox.y + cushionBox.height / 2); await page.mouse.down();
  await expect.poll(async () => (await cushionGeometry()).fabricScaleY).toBeLessThan(.95);
  const anchorPressed = await cushionGeometry();
  expect(anchorPressed.outerTransform).toBe("none");
  for (const key of ["left", "top", "width", "height"] as const) expect(anchorPressed[key]).toBeCloseTo(anchorBefore[key], 3);
  // Release outside the button: this test checks native press feedback without
  // starting the separate, already-covered recall journey.
  await page.mouse.move(cushionBox.x + cushionBox.width / 2, cushionBox.y - 8); await page.mouse.up();
  const month = page.locator("h1.poster-chrome-title:visible,h1.agenda-title:visible"), before = await month.textContent();
  const height = await expectSmallHome(page), kinds: string[] = [];
  const feed = house(page).getByRole("button", { name: "밥 꺼내기", exact: true });
  for (let count = 1; count <= 3; count++) {
    // Keep the previous food selected: the next real mouse click must hit the
    // outlet, settle that selection, and create another snack without a menu.
    await feed.click();
    await expect(page.locator(".vc-food")).toHaveCount(count);
    const food = page.locator(".vc-food").last();
    await expect(food).toHaveAttribute("data-selected", "");
    await expect(page.locator(".vc-food[data-selected]")).toHaveCount(1);
    await expect(food.locator("svg.vc-fruit")).toHaveCount(1);
    kinds.push((await food.getAttribute("data-kind"))!);
    expect(COMPANION_FOOD_KINDS).toContain(kinds.at(-1));
  }
  expect(kinds[1]).not.toBe(kinds[0]); expect(kinds[2]).not.toBe(kinds[1]);
  await feed.click(); await expect(page.locator(".vc-food")).toHaveCount(3);
  await page.keyboard.press("Escape"); // Test whole-room keyboard cleanup separately from selected-food discard.
  const bin = house(page).getByRole("button", { name: "음식 버리기", exact: true });
  await bin.focus(); await bin.press("Enter"); await expect(page.locator(".vc-food")).toHaveCount(0);
  expect(Math.abs((await expectSmallHome(page)) - height)).toBeLessThan(.5);
  await expect(month).toHaveText(before!);
  await chooseCompanionCare(page, "쓰다듬기", "keyboard"); await expect(actor(page)).toBeFocused();
  await expect(pet(page)).toHaveAttribute("data-state", "petted"); await expect(month).toHaveText(before!);
  await page.screenshot({ path: ".scratch-pw/companion-direct-home-desktop.png" });
});

test.describe("touch direct room", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("the compact icon room has real touch targets, direct food and a reachable bin", async ({ page }) => {
    await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible();
    await openCompanionHome(page, "touch"); await page.evaluate(() => document.fonts.ready);
    await expectIconRoom(page, true); const height = await expectSmallHome(page);
    await house(page).getByRole("button", { name: "밥 꺼내기", exact: true }).tap();
    await expect(page.locator(".vc-food")).toHaveCount(1);
    expect(COMPANION_FOOD_KINDS).toContain(await page.locator(".vc-food").getAttribute("data-kind"));
    await expect(house(page)).toBeVisible();
    await page.touchscreen.tap(110, 700); // Native one-pointer placement owns its click.
    await expect(page.locator(".vc-food")).not.toHaveAttribute("data-selected");
    await house(page).getByRole("button", { name: "음식 버리기", exact: true }).tap();
    await expect(page.locator(".vc-food")).toHaveCount(0);
    expect(Math.abs((await expectSmallHome(page)) - height)).toBeLessThan(.5);
    await chooseCompanionCare(page, "쓰다듬기", "touch"); await expect(pet(page)).toHaveAttribute("data-state", "petted");
    await expect(page.locator(".vc-effect")).toHaveText("♡");
    await expect(page.locator("[data-export-surface] .vc-home,[data-export-surface] .vc-companion")).toHaveCount(0);
    await page.screenshot({ path: ".scratch-pw/companion-direct-home-touch.png" });
  });

  test("a second touch cannot move or release the first pointer's held creature", async ({ page, context }) => {
    await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible();
    const start = await point(page), cdp = await context.newCDPSession(page);
    const first = { id: 1, x: start.x, y: start.y }, second = { id: 2, x: Math.min(350, start.x + 95), y: Math.min(760, start.y + 45) };
    try {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...first, x: first.x + 18 },] });
      await expect(pet(page)).toHaveAttribute("data-state", "held");
      const before = await pet(page).boundingBox();
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...first, x: first.x + 18 }, second] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...first, x: first.x + 18 }, { ...second, x: second.x - 30 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [{ ...first, x: first.x + 18 }] });
      await expect(pet(page)).toHaveAttribute("data-state", "held");
      const after = (await pet(page).boundingBox())!;
      expect(Math.abs(after.x - before!.x)).toBeLessThan(1); expect(Math.abs(after.y - before!.y)).toBeLessThan(1);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-state", "petted");
    } finally { await cdp.detach(); }
  });
});

test("reduced-motion tap and a stationary long press both acknowledge without a hold gate", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vic.reduceMotion", "on"));
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible(); await showHome(page);
  await actor(page).click();
  expect(await actor(page).evaluate(button => ({ state: button.parentElement!.dataset.state, heart: button.parentElement!.querySelector(".vc-effect")!.textContent }))).toEqual({ state: "petted", heart: "♡" });
  const before = Number(await house(page).getByRole("meter", { name: "빅타민 친밀도" }).getAttribute("value"));
  const start = await point(page); await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.waitForTimeout(450); await expect(pet(page)).not.toHaveAttribute("data-grab-ready");
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await page.mouse.up(); await expect(pet(page)).toHaveAttribute("data-state", "petted");
  await expect.poll(async () => Number(await house(page).getByRole("meter", { name: "빅타민 친밀도" }).getAttribute("value"))).toBeGreaterThan(before + .05);
});

for (const width of [1920, 390]) test(`cushion recall and breathing dreams use the same world at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 });
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible(); await showHome(page);
  await house(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 6000 });
  await expect(pet(page)).toHaveAttribute("data-dreaming", "", { timeout: 6000 });
  const contact = await page.evaluate(() => {
    const pet = document.querySelector<HTMLElement>(".vc-companion")!.getBoundingClientRect();
    const cushion = document.querySelector<HTMLElement>(".vc-home-cushion")!.getBoundingClientRect();
    const dreams = [...document.querySelectorAll<HTMLElement>(".vc-dream i")];
    return { error: Math.abs(pet.bottom - cushion.top), animations: dreams.map(node => getComputedStyle(node).animationName), shadow: getComputedStyle(document.querySelector(".vc-contact-shadow")!).opacity };
  });
  expect(contact.error).toBeLessThan(3); expect(contact.animations).toEqual(["vc-dream", "vc-dream", "vc-dream"]); expect(Number(contact.shadow)).toBeGreaterThan(.1);
  await page.screenshot({ path: `.scratch-pw/companion-home-cushion-${width}.png` });
  await house(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  await expect(page.locator(".vc-food .vc-fruit")).toHaveCount(1); await expect(page.locator(".vc-food")).toHaveAttribute("data-selected", "");
  await expect(house(page)).toBeVisible(); await page.keyboard.press("Escape");
});

test("an immediate drag never becomes a tap after returning, and pointer cancellation never pets", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/visual-fixture/poster"); await expect(actor(page)).toBeVisible(); await showHome(page);
  await actor(page).click(); await expect(pet(page)).toHaveAttribute("data-state", "petted"); await expect(page.locator(".vc-effect")).toHaveText("♡");
  const affection = async () => Number(await house(page).getByRole("meter", { name: "빅타민 친밀도" }).getAttribute("value"));
  const before = await affection(), start = await point(page);
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  // One movement over6px, with no deliberate hold or polling delay.
  await page.mouse.move(start.x + 28, start.y - 12);
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  await page.mouse.move(start.x, start.y); await page.mouse.up();
  await expect(pet(page)).not.toHaveAttribute("data-state", "petted");
  expect(await affection()).toBeLessThan(before + .01);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 5000 });
  await actor(page).evaluate(button => button.addEventListener("pointerdown", event => { (window as Window & { companionCancelPointer?: number }).companionCancelPointer = (event as PointerEvent).pointerId; }, { capture: true, once: true }));
  const cancel = await point(page);
  await page.mouse.move(cancel.x, cancel.y); await page.mouse.down();
  // Native pointercancel branch fixture: the real active pointer's id, without
  // calling a product handler or injecting a fake animation clock.
  await actor(page).evaluate(button => {
    const id = (window as Window & { companionCancelPointer?: number }).companionCancelPointer;
    if (id === undefined) throw new Error("pointer id probe was not installed");
    button.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: id, pointerType: "mouse", button: 0 }));
  });
  await page.mouse.up(); await expect(pet(page)).not.toHaveAttribute("data-state", "petted"); expect(await affection()).toBeLessThan(before + .01);
});

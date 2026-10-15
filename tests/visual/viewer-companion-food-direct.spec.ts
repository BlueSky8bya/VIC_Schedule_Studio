import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_NAMES, isCompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionCare, openCompanionHome } from "./helpers/companion-home";

const pet = (page: Page) => page.locator(".vc-companion");
const foods = (page: Page) => page.locator(".vc-food");
const bin = (page: Page) => page.getByRole("button", { name: "음식 버리기", exact: true });
const posts = new WeakMap<Page, string[]>();
test.use({ hasTouch: true });
test.beforeEach(async ({ page, context }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await context.route("**/*", route => {
    if (route.request().method() === "POST") { blocked.push(route.request().url()); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await context.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function centre(item: Locator) { const rect = (await item.boundingBox())!; return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; }
async function setup(page: Page, hunger = .1) {
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, sleep: false, heartPrank: false, ambientPrank: false, feeding: true }, care: { ...DEFAULT_COMPANION_CARE, hunger } });
  await page.goto("/visual-fixture/poster");
  await expect(pet(page)).toBeVisible(); await page.evaluate(() => document.fonts.ready);
  await openCompanionHome(page);
  await bin(page).evaluate(node => {
    node.setAttribute("data-test-clicks", "0");
    node.addEventListener("click", () => node.setAttribute("data-test-clicks", String(Number(node.getAttribute("data-test-clicks")) + 1)));
  });
}
async function spawn(page: Page) {
  const before = await foods(page).count(), touch = page.viewportSize()!.width < 1040;
  await openCompanionHome(page, touch ? "touch" : "pointer");
  const feed = page.getByRole("button", { name: "밥 꺼내기", exact: true });
  if (touch) await feed.tap(); else await feed.click();
  await expect(foods(page)).toHaveCount(before + 1);
  const item = foods(page).last(); await expect(item).toHaveAttribute("data-selected", ""); await expect(item).toBeFocused();
  return item;
}
async function trackPointer(item: Locator) {
  await item.evaluate(node => node.addEventListener("pointerdown", event => node.setAttribute("data-test-pointer", String((event as PointerEvent).pointerId)), { capture: true }));
}
async function cancelPointer(item: Locator, different = false) {
  // Playwright has no mouse pointercancel command. Exercise the cancellation
  // branch with the browser-recorded pointer ID, separately from native drags.
  await item.evaluate((node, different) => node.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: Number(node.getAttribute("data-test-pointer")) + (different ? 99 : 0), pointerType: "mouse" })), different);
}

for (const width of [1440, 390]) {
  test(`three real dispenser clicks vary fruit; selected trash only removes one at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); await setup(page);
    const kinds: string[] = [];
    for (let i = 0; i < 3; i++) {
      const item = await spawn(page), kind = await item.getAttribute("data-kind");
      expect(isCompanionFoodKind(kind)).toBe(true); if (!isCompanionFoodKind(kind)) throw new Error("Unknown fruit");
      if (i) expect(kind).not.toBe(kinds[i - 1]); kinds.push(kind);
      await expect(item).toHaveAccessibleName(`빅타민 밥 ${COMPANION_FOOD_NAMES[kind]} · 잡아서 옮기기`);
      await expect(item.locator("svg")).toHaveCount(1);
      expect(await item.locator("svg").getAttribute("viewBox")).toBe("0 0 40 40");
    }
    await expect(page.locator(".vc-food-hint")).toHaveCount(0);
    await expect(page.locator("[data-export-surface] .vc-food")).toHaveCount(0);
    // A selected snack can cover the intended placement point, especially on
    // mobile. Tapping that snack again must place it instead of reselecting.
    const selected = foods(page).last();
    if (width === 390) await selected.tap(); else await selected.click();
    await expect(selected).not.toHaveAttribute("data-selected");
    await selected.focus(); await selected.press("Enter");
    await expect(selected).toHaveAttribute("data-selected", "");
    await foods(page).last().evaluate(node => {
      node.setAttribute("data-test-style-writes", "0");
      new MutationObserver(records => node.setAttribute("data-test-style-writes", String(Number(node.getAttribute("data-test-style-writes")) + records.length))).observe(node, { attributes: true, attributeFilter: ["style"], subtree: true });
    });
    await bin(page).focus(); await page.waitForTimeout(1300);
    await expect(bin(page)).toBeFocused(); // Parent care ticks must not steal Tab focus.
    await expect(foods(page).last()).toHaveAttribute("data-selected", "");
    await expect(foods(page).last()).toHaveAttribute("data-test-style-writes", "0");
    const lastId = await foods(page).last().getAttribute("data-food");
    const p = await centre(bin(page)); if (width === 390) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
    await expect(foods(page)).toHaveCount(2, { timeout: 2000 });
    await expect(page.locator(`[data-food="${lastId}"]`)).toHaveCount(0);
    await expect(bin(page)).toHaveAttribute("data-test-clicks", "0");
    await expect(bin(page)).not.toHaveAttribute("data-food-over");
    await foods(page).first().focus(); await foods(page).first().press("Delete");
    await expect(foods(page)).toHaveCount(1);
    await bin(page).focus(); await bin(page).press("Enter");
    await expect(foods(page)).toHaveCount(0);
    await expect(bin(page)).toHaveAttribute("data-test-clicks", "1");
  });
}

test("trash dwell can be left, canceled or blurred before one finite removal", async ({ page }) => {
  await setup(page); const item = await spawn(page); await item.press("Escape"); await trackPointer(item);
  const target = await centre(bin(page));
  const take = async () => { const p = await centre(item); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 5 }); };
  await take(); await expect(bin(page)).toHaveAttribute("data-food-over", "");
  await page.mouse.move(target.x - 100, target.y - 70, { steps: 3 });
  await expect(bin(page)).not.toHaveAttribute("data-food-over"); await page.waitForTimeout(550); await expect(item).toBeVisible(); await page.mouse.up();
  await take(); await expect(bin(page)).toHaveAttribute("data-food-over", "");
  await cancelPointer(item, true);
  expect(await item.evaluate(node => node.hasPointerCapture(Number(node.getAttribute("data-test-pointer"))))).toBe(true);
  await page.mouse.move(target.x - 30, target.y - 60);
  await expect(item).not.toHaveAttribute("data-selected"); // The original drag still owns this pointer.
  await cancelPointer(item); await page.mouse.up();
  await expect(bin(page)).not.toHaveAttribute("data-food-over"); await page.waitForTimeout(550); await expect(item).toBeVisible();
  await take();
  await item.evaluate(node => node.releasePointerCapture(Number(node.getAttribute("data-test-pointer"))));
  await page.mouse.move(target.x - 30, target.y - 60); await page.mouse.up();
  await expect(bin(page)).not.toHaveAttribute("data-food-over"); await page.waitForTimeout(550); await expect(item).toBeVisible();
  await take(); await expect(item).toHaveAttribute("data-discarding", "", { timeout: 1500 });
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.mouse.up(); await page.waitForTimeout(220);
  await expect(item).toBeVisible(); await expect(item).not.toHaveAttribute("data-discarding"); await expect(bin(page)).not.toHaveAttribute("data-food-over");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await take(); await page.mouse.up();
  await expect(foods(page)).toHaveCount(0, { timeout: 2000 });
  await expect(bin(page)).toHaveAttribute("data-test-clicks", "0");
});

test("a real mobile touch cancellation keeps its snack and a held trash drop cannot click through", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await setup(page);
  const item = await spawn(page); await item.press("Escape");
  const client = await page.context().newCDPSession(page), target = await centre(bin(page));
  const take = async () => {
    const from = await centre(item);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y, id: 11 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: target.x, y: target.y, id: 11 }] });
    await expect(bin(page)).toHaveAttribute("data-food-over", "");
  };
  await take(); await client.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
  await expect(bin(page)).not.toHaveAttribute("data-food-over"); await page.waitForTimeout(550); await expect(item).toBeVisible();
  await take(); await expect(foods(page)).toHaveCount(0, { timeout: 2000 });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(bin(page)).toHaveAttribute("data-test-clicks", "0");
  await client.detach();
});

for (const input of ["pointer", "keyboard"] as const) {
  test(`food reaches the mouth and ${input} regrabbing interrupts without care credit`, async ({ page }) => {
    await setup(page, .58);
    await chooseCompanionCare(page, "옮길 곳 고르기"); await page.mouse.click(180, page.viewportSize()!.height - 20);
    await expect(pet(page)).not.toHaveAttribute("data-placing"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    const item = await spawn(page);
    const target = await pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2 + 24, y: r.bottom }; });
    await page.mouse.click(target.x, target.y);
    await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 10000 });
    await expect(item).toHaveAttribute("data-eating", "");
    await expect.poll(() => item.evaluate(node => Number((node as HTMLElement).style.getPropertyValue("--vc-nibble")))).toBeLessThan(.92);
    const measured = await item.evaluate(node => {
      const pet = document.querySelector(".vc-companion")!.getBoundingClientRect(), fruit = node.firstElementChild!.getBoundingClientRect();
      return { distance: Math.hypot(fruit.x + fruit.width / 2 - (pet.x + pet.width / 2), fruit.y + fruit.height / 2 - (pet.bottom - pet.height * .24)), rotation: (node.firstElementChild as HTMLElement).style.transform };
    });
    expect(measured.distance).toBeLessThan(24); expect(measured.rotation).toContain("rotate(");
    await page.screenshot({ path: `.scratch-pw/companion-food-mouth-${input}.png` });
    const before = await centre(item);
    if (input === "pointer") {
      await page.mouse.move(before.x, before.y); await page.mouse.down();
      await expect(item).not.toHaveAttribute("data-eating");
      const held = await centre(item); expect(Math.hypot(held.x - before.x, held.y - before.y)).toBeLessThan(12);
      await page.mouse.move(480, page.viewportSize()!.height - 26, { steps: 8 }); await page.mouse.up();
    } else {
      await item.focus(); await item.press("Enter"); await expect(item).toHaveAttribute("data-selected", "");
      const held = await centre(item); expect(Math.hypot(held.x - before.x, held.y - before.y)).toBeLessThan(12);
      for (let i = 0; i < 8; i++) await item.press("ArrowRight");
      await page.mouse.click(480, page.viewportSize()!.height - 20);
    }
    await expect(item).not.toHaveAttribute("data-eating"); await expect(item).not.toHaveAttribute("data-selected");
    await page.waitForTimeout(2900); await expect(foods(page)).toHaveCount(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger)).toBeGreaterThan(.5);
    await item.focus(); await item.press("Delete"); await expect(foods(page)).toHaveCount(0);
  });
}

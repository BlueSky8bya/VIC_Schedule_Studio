import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

type Point = { x: number; y: number };
type FloorWitnessWindow = Window & { floorFoodWitness: { fell: boolean; observer: MutationObserver }; floorMealWitness: { jumped: boolean; floor: boolean; observer: MutationObserver } };
const house = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const food = (page: Page) => page.locator(".vc-food");
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const feed = (page: Page) => house(page).getByRole("button", { name: "밥 꺼내기", exact: true });
const fold = (page: Page) => house(page).getByRole("button", { name: "빅타민 집", exact: true });
const position = (item: Locator) => item.evaluate(node => {
  const value = node.closest("[hidden]") ? (node as HTMLElement).style.transform : getComputedStyle(node).transform;
  const m = new DOMMatrixReadOnly(value); return { x: m.m41, y: m.m42 };
});
const observations = new WeakMap<Page, { posts: string[]; errors: string[] }>();

test.use({ video: "on" });
test.beforeEach(async ({ page }) => {
  const observed = { posts: [] as string[], errors: [] as string[] }; observations.set(page, observed);
  page.on("pageerror", error => observed.errors.push(error.message));
  await page.route("**/*", route => route.request().method() === "POST" ? (observed.posts.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(observations.get(page)).toEqual({ posts: [], errors: [] }); });

async function press(item: Locator, touch: boolean) { if (touch) await item.tap(); else await item.click(); }
async function toggleFloorHome(page: Page, touch: boolean, expanded: boolean) {
  const button = fold(page);
  await press(button, touch);
  await expect(button).toHaveAttribute("aria-expanded", String(expanded));
}
async function setup(page: Page, touch: boolean, hungry = false) {
  await page.addInitScript(({ epoch, key, prefs, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
    Math.random = () => 0; Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, prefs: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: hungry, jump: hungry, sleep: hungry, feeding: true, ambientPrank: false, heartPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: hungry ? .8 : .05 } });
  await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => await house(page).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  await openCompanionHome(page, touch ? "touch" : "pointer");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await page.waitForTimeout(180); // Existing geometry's finite120ms delivery, never a fake clock.
}
async function dispense(page: Page, touch: boolean) {
  const count = await food(page).count(); await press(feed(page), touch); await expect(food(page)).toHaveCount(count + 1);
  const item = food(page).last(); await expect(item).not.toHaveAttribute("data-selected"); await expect(feed(page)).toBeFocused(); return item;
}
async function frontPoint(page: Page, nearDispenser = false) {
  return house(page).evaluate((node, near) => {
    const floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(), bed = node.querySelector(".vc-cushion-button")!.getBoundingClientRect(), dispenser = node.querySelector(".vc-dispenser")!.getBoundingClientRect();
    const x = near ? dispenser.left - 23 : bed.left + bed.width / 2, y = floor.bottom - 3;
    const hit = document.elementsFromPoint(x, y).find(element => !element.closest(".vc-food-layer,.vc-companion"));
    return { x, y, floorLeft: floor.left, floorTop: floor.top, floorBottom: floor.bottom, nativeRoom: hit === node.querySelector(".vc-home-room") || hit === node.querySelector(".vc-home-floor") };
  }, nearDispenser);
}
async function drag(page: Page, item: Locator, destination: Point, touch: boolean) {
  const r = (await item.boundingBox())!, start = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  if (!touch) { await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(destination.x, destination.y, { steps: 12 }); await page.mouse.up(); return; }
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 31 }] });
    for (let step = 1; step <= 12; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (destination.x - start.x) * step / 12, y: start.y + (destination.y - start.y) * step / 12, id: 31 }] });
    // Model a finger resting at its destination before release. Zero-duration
    // CDP moves otherwise suppress the next native tap even on plain HTML.
    // These are real input samples before touchEnd, not a retry or delay after it.
    for (let sample = 0; sample < 4; sample++) {
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...destination, id: 31 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally { await cdp.detach(); }
}
async function floorOffset(page: Page, item: Locator) {
  const p = await position(item), rect = (await house(page).locator(".vc-home-floor").boundingBox())!; return { x: p.x - rect.x, y: p.y - rect.y };
}
async function expectFloor(page: Page, item: Locator, offset?: Point) {
  await expect(item).toHaveJSProperty("hidden", false); await expect(item).not.toHaveAttribute("data-falling");
  await expect.poll(async () => {
    const p = await position(item), r = (await house(page).locator(".vc-home-floor").boundingBox())!;
    return Math.abs(p.y - (r.y + r.height - COMPANION_HOME_FLOOR_INSET));
  }).toBeLessThan(2);
  if (offset) await expect.poll(async () => { const current = await floorOffset(page, item); return Math.hypot(current.x - offset.x, current.y - offset.y); }).toBeLessThan(2);
  const overlap = await item.evaluate(node => {
    const r = node.getBoundingClientRect();
    return [...document.querySelectorAll(".vc-home button:not(.vc-cushion-button)")].filter(button => { const b = button.getBoundingClientRect(); return b.width > 0 && b.height > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top; }).length;
  });
  expect(overlap).toBe(0);
}
async function watchNoFall(item: Locator) {
  await item.evaluate(node => {
    const witness = { fell: false, observer: new MutationObserver(records => { if (records.some(record => record.oldValue !== null || node.hasAttribute("data-falling"))) witness.fell = true; }) };
    witness.observer.observe(node, { attributes: true, attributeOldValue: true, attributeFilter: ["data-falling"] }); (window as unknown as FloorWitnessWindow).floorFoodWitness = witness;
  });
}
async function stopNoFall(page: Page) {
  expect(await page.evaluate(() => { const witness = (window as unknown as FloorWitnessWindow).floorFoodWitness; witness.observer.disconnect(); return witness.fell; })).toBe(false);
}

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const touch of [false]) test.describe(touch ? "native390 house floor" : "PC1920 house floor", () => {
  test.use({ viewport: touch ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: touch, isMobile: touch });

  test("real drags, taps and keyboard moves retain a separate floor attachment through home topology", async ({ page }) => {
    test.setTimeout(35000); await setup(page, touch);
    const item = await dispense(page, touch); await watchNoFall(item);
    const target = await frontPoint(page); expect(target.nativeRoom).toBe(true); await drag(page, item, target, touch); await expectFloor(page, item);
    expect(Math.abs((await position(item)).x - target.x)).toBeLessThan(2);
    const initial = await floorOffset(page, item); await press(item, touch); await expect(item).not.toHaveAttribute("data-selected"); await expectFloor(page, item, initial);
    const next = { ...(await frontPoint(page)), x: target.x - 12 }; await drag(page, item, next, touch); await expectFloor(page, item);
    expect(Math.abs((await position(item)).x - next.x)).toBeLessThan(2);
    await item.focus(); await item.press("Enter"); await expect(item).toHaveAttribute("data-selected", ""); await item.press("ArrowLeft"); await item.press("Enter");
    await expect(item).not.toHaveAttribute("data-selected"); await expectFloor(page, item); expect(Math.abs((await position(item)).x - next.x + 24)).toBeLessThan(2);

    // Reflow a fruit beside the real outlet, where a smaller room can require
    // a display-only clamp. Returning to the wide room restores its origin.
    const near = await frontPoint(page, !touch); expect(near.nativeRoom).toBe(true); await drag(page, item, near, touch); await expectFloor(page, item);
    const offset = await floorOffset(page, item);
    await toggleFloorHome(page, touch, false); await expect(item).toHaveJSProperty("hidden", true);
    await toggleFloorHome(page, touch, true); await expectFloor(page, item, offset);
    if (touch) {
      await house(page).getByRole("button", { name: "빅타민 집 닫기", exact: true }).tap(); await expect(item).toHaveJSProperty("hidden", true);
      await openCompanionHome(page, "touch"); await expectFloor(page, item, offset);
    } else {
      await page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true }).click(); await expect(page.locator(".avatar-right .vc-home")).toBeVisible(); await expectFloor(page, item, offset);
      await page.getByRole("button", { name: "패널을 왼쪽에 두기", exact: true }).click(); await expectFloor(page, item, offset);
      // PLAN-063: retain wide-to-compact house reflow on a supported desktop.
      await page.setViewportSize({ width: 1280, height: 1000 });
      await expect.poll(async () => await page.locator(".vc-compact-home .vc-home").isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
      await openCompanionHome(page); await expectFloor(page, item);
      await page.setViewportSize({ width: 1920, height: 1100 }); await expect(page.locator(".avatar-left .vc-home")).toBeVisible(); await expectFloor(page, item, offset);
    }
    await page.evaluate(() => { document.documentElement.style.overflowY = "auto"; const gap = document.createElement("div"); gap.style.height = "1400px"; gap.setAttribute("aria-hidden", "true"); document.body.append(gap); scrollTo({ top: 64, behavior: "instant" }); });
    await expectFloor(page, item, offset); await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" })); await expectFloor(page, item, offset);
    await page.waitForTimeout(900); await stopNoFall(page);
    await page.screenshot({ path: `.scratch-pw/companion-home-floor-${touch ? 390 : 1920}.png` });
    await press(feed(page), touch); await expect(food(page)).toHaveCount(2); // The native outlet stays reachable beside the floor snack.
    await press(house(page).getByRole("button", { name: "음식 버리기", exact: true }), touch); await expect(food(page)).toHaveCount(0);
    await expect(page.locator("[data-export-surface] .vc-food,[data-export-surface] .vc-companion")).toHaveCount(0);
    if (!touch) expect(await page.locator("[data-export-surface]").evaluate(node => getComputedStyle(node).width)).toBe("1840px");
  });

  test("a hungry companion approaches the actual floor and a folded meal preserves its home resident", async ({ page }) => {
    test.setTimeout(35000); await setup(page, touch, true);
    await press(house(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }), touch);
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    await actor(page).focus(); await actor(page).press("Enter"); await expect(pet(page)).toHaveAttribute("data-state", "petted");
    const item = await dispense(page, touch), target = await frontPoint(page); expect(target.nativeRoom).toBe(true);
    await pet(page).evaluate(node => {
      const witness = { jumped: false, floor: false, observer: new MutationObserver(() => { witness.jumped ||= node.getAttribute("data-state") === "jump"; witness.floor ||= /^companion-home-floor(?:-\d+)?$/.test(node.getAttribute("data-platform") ?? ""); }) };
      witness.observer.observe(node, { attributes: true, attributeFilter: ["data-state", "data-platform"] }); (window as unknown as FloorWitnessWindow).floorMealWitness = witness;
    });
    await drag(page, item, target, touch); await expectFloor(page, item);
    const placed = await position(item); await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 10000 });
    const approached = await page.evaluate(() => { const w = (window as unknown as FloorWitnessWindow).floorMealWitness; w.observer.disconnect(); return { jumped: w.jumped, floor: w.floor }; });
    expect(approached).toEqual({ jumped: true, floor: true });
    await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
    await toggleFloorHome(page, touch, false); await expect(item).toHaveJSProperty("hidden", true); await expect(pet(page)).toBeHidden();
    await page.waitForTimeout(3000); await expect(food(page)).toHaveCount(1); await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
    await expect.poll(async () => Math.hypot((await position(item)).x - placed.x, (await position(item)).y - placed.y)).toBeLessThan(2);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger as number)).toBeGreaterThan(.7);
    await toggleFloorHome(page, touch, true); await expect(item).toHaveJSProperty("hidden", false); await expect(pet(page)).toBeVisible();
    await expect(food(page)).toHaveCount(0, { timeout: 8000 }); await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger as number)).toBeLessThan(.5);
    await page.screenshot({ path: `.scratch-pw/companion-home-floor-meal-${touch ? 390 : 1920}.png` });
  });
});

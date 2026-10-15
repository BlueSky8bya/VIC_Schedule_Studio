import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { MAX_COMPANION_FOOD } from "@/lib/ui/viewer-companion/food-capacity";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const house = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const foods = (page: Page) => page.locator(".vc-food");
const pet = (page: Page) => page.locator(".vc-companion");
const observed = new WeakMap<Page, { posts: string[]; errors: string[] }>();
type Point = { x: number; y: number };
type CapacityWindow = Window & { replacementFall?: { fell: boolean; observer: MutationObserver } };
const position = (item: Locator) => item.evaluate(node => {
  const matrix = new DOMMatrixReadOnly(node.closest("[hidden]") ? (node as HTMLElement).style.transform : getComputedStyle(node).transform);
  return { x: matrix.m41, y: matrix.m42 };
});
async function press(item: Locator, touch: boolean) { if (touch) await item.tap(); else await item.click(); }
async function pressExposed(page: Page, item: Locator, touch: boolean) {
  const point = await item.evaluate(node => {
    const r = node.getBoundingClientRect();
    for (const fy of [.5, .12, .88, .25, .75]) for (const fx of [.5, .12, .88, .25, .75]) {
      const point = { x: r.left + r.width * fx, y: r.top + r.height * fy };
      const hit = document.elementFromPoint(point.x, point.y);
      if (hit && (hit === node || node.contains(hit))) return point;
    }
    return null;
  });
  expect(point, "the native sofa control needs an exposed point beside its floor resident").not.toBeNull();
  if (touch) await page.touchscreen.tap(point!.x, point!.y); else await page.mouse.click(point!.x, point!.y);
}
async function drag(page: Page, item: Locator, target: Point, touch: boolean) {
  const rect = (await item.boundingBox())!, start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  if (!touch) { await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 12 }); await page.mouse.up(); return; }
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 31 }] });
    for (let step = 1; step <= 12; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (target.x - start.x) * step / 12, y: start.y + (target.y - start.y) * step / 12, id: 31 }] });
    // Real stationary input samples model placing the fruit before lifting the
    // finger; a CDP flick otherwise suppresses the next tap even on plain HTML.
    for (let sample = 0; sample < 4; sample++) {
      await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...target, id: 31 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally { await cdp.detach(); }
}

test.use({ video: "on" });
test.beforeEach(async ({ page }) => {
  const record = { posts: [] as string[], errors: [] as string[] }; observed.set(page, record);
  page.on("pageerror", error => record.errors.push(error.message));
  await page.route("**/*", route => route.request().method() === "POST" ? (record.posts.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch);
    for (const [name, value] of Object.entries({ "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
    Math.random = () => 0;
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: true, sleep: true, feeding: true, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .8 } });
});
test.afterEach(async ({ page }) => { expect(observed.get(page)).toEqual({ posts: [], errors: [] }); });

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const touch of [false]) test.describe(touch ? "native390 eight snacks" : "PC1920 eight snacks", () => {
  test.use({ viewport: touch ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: touch, isMobile: touch });
  test("eight local foods survive capacity refusal, eighth-food feeding, home follow and direct trash", async ({ page }) => {
    test.setTimeout(40000);
    await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
    await expect.poll(async () => await house(page).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
    await openCompanionHome(page, touch ? "touch" : "pointer");
    await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
    await page.waitForTimeout(180); // Existing finite geometry delivery.
    const feed = house(page).getByRole("button", { name: "밥 꺼내기", exact: true });
    for (let count = 1; count <= MAX_COMPANION_FOOD; count++) {
      await press(feed, touch); await expect(foods(page)).toHaveCount(count);
      await expect(feed).toBeFocused(); await expect(page.locator(".vc-food[data-selected]")).toHaveCount(0);
    }
    const ids = await foods(page).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-food")!));
    expect(new Set(ids).size).toBe(MAX_COMPANION_FOOD);
    await press(feed, touch); await expect(foods(page)).toHaveCount(MAX_COMPANION_FOOD);
    await expect(page.locator(".vc-food-layer [role=status]")).toContainText(`${MAX_COMPANION_FOOD}개까지`);
    expect(await foods(page).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-food")))).toEqual(ids);

    await press(house(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }), touch);
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
    await actor.focus(); await actor.press("Enter"); await expect(pet(page)).toHaveAttribute("data-state", "petted");
    const offered = foods(page).last(), offeredId = ids[MAX_COMPANION_FOOD - 1];
    const floorPoint = await house(page).evaluate(node => {
      const floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(), bed = node.querySelector(".vc-cushion-button")!.getBoundingClientRect();
      return { x: bed.left + bed.width / 2, y: floor.bottom - 3, plane: floor.bottom - 6 };
    });
    await drag(page, offered, floorPoint, touch);
    await expect(offered).not.toHaveAttribute("data-falling");
    await expect.poll(async () => Math.abs((await position(offered)).y - floorPoint.plane)).toBeLessThan(2);
    await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 12000 });
    await expect(offered).toHaveAttribute("data-eating", "");
    await expect(page.locator(`.vc-food[data-food="${offeredId}"]`)).toHaveCount(0, { timeout: 7000 });
    await expect(foods(page)).toHaveCount(MAX_COMPANION_FOOD - 1);
    expect(await foods(page).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-food")))).toEqual(ids.slice(0, -1));

    // One meal can leave hunger above the real feeding threshold. Request a
    // native sofa nap before testing replacement/folding/trash, so an allowed
    // second floor meal does not race this separate capacity interaction.
    await pressExposed(page, house(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }), touch);
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");

    // Consuming one item reopens exactly one slot; the remaining seven objects
    // keep their identities. A replacement released over the sofa passes
    // through its seat and attaches to the real house floor below it.
    await press(feed, touch); await expect(foods(page)).toHaveCount(MAX_COMPANION_FOOD);
    const replacement = foods(page).last(), replacementId = await replacement.getAttribute("data-food");
    expect(ids).not.toContain(replacementId);
    const bed = (await house(page).locator(".vc-cushion-button").boundingBox())!;
    await replacement.evaluate(node => { const witness = { fell: false, observer: new MutationObserver(records => { witness.fell ||= node.hasAttribute("data-falling") || records.some(record => record.oldValue !== null); }) }; witness.observer.observe(node, { attributes: true, attributeFilter: ["data-falling"], attributeOldValue: true }); (window as CapacityWindow).replacementFall = witness; });
    await drag(page, replacement, { x: bed.x + bed.width / 2, y: bed.y + 3 }, touch);
    await expect.poll(() => page.evaluate(() => Boolean((window as CapacityWindow).replacementFall?.fell))).toBe(true);
    await page.evaluate(() => (window as CapacityWindow).replacementFall?.observer.disconnect());
    await expect(replacement).not.toHaveAttribute("data-falling");
    const placed = await position(replacement);
    const floor = (await house(page).locator(".vc-home-floor").boundingBox())!;
    expect(Math.abs(placed.y - (floor.y + floor.height - COMPANION_HOME_FLOOR_INSET))).toBeLessThan(2);
    const fold = house(page).getByRole("button", { name: "빅타민 집", exact: true });
    await press(fold, touch); await expect(fold).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".vc-food:not([hidden])")).toHaveCount(0);
    await press(fold, touch); await expect(fold).toHaveAttribute("aria-expanded", "true");
    await expect(replacement).toHaveJSProperty("hidden", false);
    await expect.poll(async () => { const p = await position(replacement); return Math.hypot(p.x - placed.x, p.y - placed.y); }).toBeLessThan(2);
    await page.screenshot({ path: `.scratch-pw/companion-food-capacity-${touch ? 390 : 1920}.png` });

    const bin = house(page).getByRole("button", { name: "음식 버리기", exact: true }), binRect = (await bin.boundingBox())!;
    await drag(page, replacement, { x: binRect.x + binRect.width / 2, y: binRect.y + binRect.height / 2 }, touch);
    await expect(foods(page)).toHaveCount(MAX_COMPANION_FOOD - 1);
    expect(await foods(page).evaluateAll(nodes => nodes.map(node => node.getAttribute("data-food")))).toEqual(ids.slice(0, -1));
    await press(bin, touch); await expect(foods(page)).toHaveCount(0);
    await expect(page.locator("[data-export-surface] .vc-food,[data-export-surface] .vc-companion")).toHaveCount(0);
    if (!touch) expect(await page.locator("[data-export-surface]").evaluate(node => getComputedStyle(node).width)).toBe("1840px");
    console.log(JSON.stringify({ check: "eight-food-lifecycle", width: touch ? 390 : 1920, capacity: MAX_COMPANION_FOOD, originalIds: ids, offeredId, replacementId, fourthThroughEighthPreserved: true, consumedEighth: true, nativeTouch: touch, floorInset: COMPANION_HOME_FLOOR_INSET, postsSent: 0 }));
  });
});

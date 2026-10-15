import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const food = (page: Page) => page.locator(".vc-food");
const house = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const posts = new WeakMap<Page, string[]>();
type WatchWindow = Window & { livingFoodWatch: { fell: boolean; observer: MutationObserver } };
type LandingWindow = Window & { livingLanding: { point: { x: number; y: number } | null; observer: MutationObserver } };
test.use({ video: "on" });

test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => route.request().method() === "POST" ? (blocked.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });
async function press(button: Locator, touch: boolean) { if (touch) await button.tap(); else await button.click(); }
async function setup(page: Page, hunger = .05) {
  await page.addInitScript(({ epoch, key, prefs, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
    Math.random = () => 0; Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, prefs: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: true, ambientPrank: false, heartPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger } });
  await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await page.waitForTimeout(180); // final coalesced full geometry, never a fake clock
  await expect(pet(page)).toHaveAttribute("data-size", "large");
}
async function feet(page: Page) {
  return pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom }; });
}
async function watchFoodLanding(item: Locator) {
  await item.evaluate(node => {
    // A hungry companion may begin lifting the snack on the next paint. The
    // falling->rest mutation records the actual collision before mouth travel.
    const probe: LandingWindow["livingLanding"] = { point: null, observer: new MutationObserver(records => {
      if (!node.hasAttribute("data-falling") && records.some(record => record.oldValue !== null)) {
        const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); probe.point ??= { x: m.m41, y: m.m42 };
      }
    }) };
    probe.observer.observe(node, { attributes: true, attributeOldValue: true, attributeFilter: ["data-falling"] });
    (window as unknown as LandingWindow).livingLanding = probe;
  });
}
async function foodLanding(page: Page) {
  await expect.poll(() => page.evaluate(() => (window as unknown as LandingWindow).livingLanding.point)).not.toBeNull();
  return page.evaluate(() => { const probe = (window as unknown as LandingWindow).livingLanding; probe.observer.disconnect(); return probe.point!; });
}
async function firstCardBelowRelease(page: Page, mobile: boolean) {
  const cards = page.locator(mobile ? ".agenda-event[data-eventid]" : ".public-event[data-eventid]");
  return cards.evaluateAll(elements => {
    // Choose a real visible ray with room for the full92px cell. "First" means
    // the first physical card below this release, not the first date of month.
    const visible = elements.map((element, index) => ({ r: element.getBoundingClientRect(), index })).filter(({ r }) => r.width > 80 && r.height > 0 && r.top > 160 && r.top < innerHeight - 160);
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")].filter(node => !node.matches(".agenda-event,.public-event,.agenda-item,.agenda-day,.public-day") && !node.closest(".vc-companion,.vc-cushion-button")).map(node => node.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    // A holiday control above an agenda card can occupy its centre ray. Pick
    // an actual clear point on that same card; do not ask the product to cover
    // an unrelated control or replace the first-card assertion with "any card".
    for (const choice of visible) for (const offset of [.5, .86, .14]) {
      const x = choice.r.left + choice.r.width * offset, y = choice.r.top - 24;
      const body = { left: x - 92 * .38 - 3, right: x + 92 * .38 + 3, top: choice.r.top - 3 - 92 * .76 - 3, bottom: choice.r.top - 3 };
      if (controls.some(r => r.left < body.right && r.right > body.left && r.top < body.bottom && r.bottom > body.top)) continue;
      const first = visible.filter(item => x >= item.r.left && x <= item.r.right && item.r.top > y).sort((a, b) => a.r.top - b.r.top)[0];
      if (first.index === choice.index) return { index: first.index, x, offset, releaseY: y, cardTop: first.r.top, cardHeight: first.r.height };
    }
    return null;
  });
}
async function dispense(page: Page, touch: boolean) {
  await openCompanionHome(page, touch ? "touch" : "pointer");
  const before = await food(page).count(); await press(house(page).getByRole("button", { name: "밥 꺼내기", exact: true }), touch);
  await expect(food(page)).toHaveCount(before + 1); await expect(food(page).last()).toHaveAttribute("data-selected", "");
  return food(page).last();
}
async function startNoFallWitness(page: Page) {
  await page.evaluate(() => {
    const witness: WatchWindow["livingFoodWatch"] = { fell: false, observer: new MutationObserver(records => {
      if (records.some(r => r.attributeName === "data-falling" && (r.oldValue !== null || (r.target as Element).hasAttribute("data-falling")))) witness.fell = true;
    }) };
    witness.observer.observe(document.querySelector(".vc-food-layer")!, { subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["data-falling"] });
    (window as unknown as WatchWindow).livingFoodWatch = witness;
  });
}
async function finishNoFallWitness(page: Page) {
  expect(await page.evaluate(() => { const witness = (window as unknown as WatchWindow).livingFoodWatch; witness.observer.disconnect(); return witness.fell; })).toBe(false);
}
async function homeOffsets(page: Page) {
  return food(page).evaluateAll(nodes => {
    const slot = document.querySelector(".vc-dispenser-slot")!.getBoundingClientRect();
    return nodes.map(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { id: (node as HTMLElement).dataset.food, x: matrix.m41 - slot.left, y: matrix.m42 - slot.top, selected: node.hasAttribute("data-selected"), hidden: (node as HTMLElement).hidden }; });
  });
}
async function expectHomeOffsets(page: Page, expected: Awaited<ReturnType<typeof homeOffsets>>) {
  await expect.poll(async () => {
    const next = await homeOffsets(page);
    return next.length === expected.length && next.every((p, i) => p.id === expected[i].id && !p.hidden && p.selected === expected[i].selected && Math.hypot(p.x - expected[i].x, p.y - expected[i].y) < 2);
  }).toBe(true);
}

for (const mobile of [false, true]) test.describe(mobile ? "agenda first physical card" : "PC first physical card", () => {
  test.use({ viewport: mobile ? { width: 390, height: 844 } : { width: 1920, height: 1100 }, hasTouch: mobile, isMobile: mobile });
  test("deliberate pet and fruit releases land on the first real card and nearby offered food remains edible", async ({ page }) => {
    test.setTimeout(25000); await setup(page, .8);
    const target = await firstCardBelowRelease(page, mobile); expect(target).toBeTruthy();
    await expect(actor(page)).toBeVisible(); await actor(page).focus(); await actor(page).press("p");
    await expect(pet(page)).toHaveAttribute("data-placing", "");
    if (mobile) await page.touchscreen.tap(target!.x, target!.releaseY); else await page.mouse.click(target!.x, target!.releaseY);
    await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/);
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    const landed = await feet(page);
    console.log(JSON.stringify({ check: `living-card-drop-diagnostic-${mobile ? 390 : 1920}`, target, landed, state: await pet(page).getAttribute("data-state"), platform: await pet(page).getAttribute("data-platform"), scroll: await page.evaluate(() => scrollY), blockingControls: await page.evaluate(({ x, cardTop }) => [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")].filter(node => !node.matches(".agenda-event,.public-event,.agenda-day,.public-day") && !node.closest(".vc-companion")).flatMap(node => { const r = node.getBoundingClientRect(); return r.width > 0 && r.left < x + 38 && r.right > x - 38 && r.top < cardTop - 3 && r.bottom > cardTop - 76 ? [{ tag: node.tagName, className: node.className, aria: node.getAttribute("aria-label"), left: r.left, top: r.top, right: r.right, bottom: r.bottom }] : []; }), target!) }));
    expect(Math.abs(landed.x - target!.x)).toBeLessThan(2); expect(Math.abs(landed.y - target!.cardTop + 3)).toBeLessThan(2);
    const petPlatform = await pet(page).getAttribute("data-platform"), snack = await dispense(page, mobile);
    // Re-read actual card geometry after the home opened; this is native input
    // against the public document, never a supplied product platform list.
    const card = page.locator(mobile ? ".agenda-event[data-eventid]" : ".public-event[data-eventid]").nth(target!.index);
    const rect = (await card.boundingBox())!, release = { x: rect.x + rect.width * target!.offset, y: rect.y - 24 };
    await watchFoodLanding(snack);
    if (mobile) await page.touchscreen.tap(release.x, release.y); else await page.mouse.click(release.x, release.y);
    await expect(snack).not.toHaveAttribute("data-selected"); await expect(snack).not.toHaveAttribute("data-falling");
    const fruit = await foodLanding(page);
    expect(Math.abs(fruit.x - release.x)).toBeLessThan(2); expect(Math.abs(fruit.y - rect.y + 3)).toBeLessThan(2);
    await expect(pet(page)).toHaveAttribute("data-platform", petPlatform!);
    await expect(snack).toHaveCount(0, { timeout: 8000 });
    const care = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger as number);
    expect(care).toBeLessThan(.5);
    await expect(page.locator('[role="dialog"]')).toHaveCount(0);
    await expect(page.locator("[data-export-surface] .vc-companion,[data-export-surface] .vc-food-layer")).toHaveCount(0);
    console.log(JSON.stringify({ check: `living-card-${mobile ? 390 : 1920}`, target, landed, fruit, petPlatform, hungerAfterMeal: care }));
    await page.screenshot({ path: `.scratch-pw/companion-living-card-${mobile ? 390 : 1920}.png` });
  });
});

test("untouched selected and unselected tray food follows native folding and left-right panels without falling", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); await setup(page);
  await dispense(page, false); await dispense(page, false); const expected = await homeOffsets(page);
  expect(expected.map(p => p.selected)).toEqual([false, true]); await startNoFallWitness(page);
  const fold = house(page).getByRole("button", { name: "빅타민 집", exact: true });
  await fold.click(); await expect(fold).toHaveAttribute("aria-expanded", "false");
  for (const item of await food(page).all()) await expect(item).toHaveJSProperty("hidden", true);
  await fold.click(); await expectHomeOffsets(page, expected);
  await page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true }).click();
  await expect(page.locator(".avatar-right .vc-home")).toBeVisible(); await expectHomeOffsets(page, expected);
  await page.getByRole("button", { name: "패널을 왼쪽에 두기", exact: true }).click();
  await expect(page.locator(".avatar-left .vc-home")).toBeVisible(); await expectHomeOffsets(page, expected);
  await page.waitForTimeout(900); await finishNoFallWitness(page);
  const quiet = await food(page).evaluateAll(nodes => new Promise<number>(resolve => {
    let changes = 0; const observer = new MutationObserver(records => { changes += records.length; });
    nodes.forEach(node => observer.observe(node, { attributes: true, subtree: true }));
    setTimeout(() => { observer.disconnect(); resolve(changes); }, 350);
  }));
  expect(quiet).toBe(0); console.log(JSON.stringify({ check: "living-tray-PC", offsets: expected, foodWrites350ms: quiet }));
  await page.screenshot({ path: ".scratch-pw/companion-living-tray-PC.png" });
});

test.describe("real touch compact tray", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test("closing and reopening the same home preserves both untouched snacks and their local tray positions", async ({ page }) => {
    await setup(page); await dispense(page, true); await dispense(page, true); const expected = await homeOffsets(page); await startNoFallWitness(page);
    const fold = house(page).getByRole("button", { name: "빅타민 집", exact: true });
    await fold.tap(); for (const item of await food(page).all()) await expect(item).toHaveJSProperty("hidden", true);
    await fold.tap(); await expectHomeOffsets(page, expected);
    await house(page).getByRole("button", { name: "빅타민 집 닫기", exact: true }).tap();
    await expect(house(page)).toHaveCount(0);
    for (const item of await food(page).all()) await expect(item).toHaveJSProperty("hidden", true);
    await openCompanionHome(page, "touch"); await expectHomeOffsets(page, expected);
    await expect(food(page)).toHaveCount(2); await finishNoFallWitness(page);
    await expect(page.locator("[data-export-surface] .vc-food-layer")).toHaveCount(0);
    console.log(JSON.stringify({ check: "living-tray-touch", offsets: expected, restored: await homeOffsets(page) }));
    await page.screenshot({ path: ".scratch-pw/companion-living-tray-touch.png" });
  });
});

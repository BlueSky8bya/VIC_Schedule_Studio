import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_NAMES, isCompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

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
async function setup(page: Page, hunger = .1, open = true) {
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));

  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, sleep: false, heartPrank: false, ambientPrank: false, feeding: true }, care: { ...DEFAULT_COMPANION_CARE, hunger } });
  await page.goto("/visual-fixture/poster");
  if (open) await expect(pet(page)).toBeVisible(); else await expect(pet(page)).toHaveCount(1);
  await page.evaluate(() => document.fonts.ready);
  if (open) await openCompanionHome(page);
  if (open) await bin(page).evaluate(node => {
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
  const item = foods(page).last(); await expect(item).not.toHaveAttribute("data-selected"); await expect(feed).toBeFocused();
  return item;
}
async function dragFoodToPointer(page: Page, item: Locator, target: { x: number; y: number }, touch = false) {
  const from = await centre(item);
  if (touch) {
    const client = await page.context().newCDPSession(page);
    try {
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y, id: 31 }] });
      for (let step = 1; step <= 8; step++) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x + (target.x - from.x) * step / 8, y: from.y + (target.y - from.y) * step / 8, id: 31 }] });
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally { await client.detach(); }
  } else {
    await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 8 }); await page.mouse.up();
  }
}
async function dragFoodToFeet(page: Page, item: Locator, target: { x: number; y: number }, touch = false) {
  const from = await centre(item), foot = await foodPoint(item);
  await dragFoodToPointer(page, item, { x: target.x + from.x - foot.x, y: target.y + from.y - foot.y }, touch);
}
async function trackPointer(item: Locator) {
  await item.evaluate(node => node.addEventListener("pointerdown", event => node.setAttribute("data-test-pointer", String((event as PointerEvent).pointerId)), { capture: true }));
}
async function cancelPointer(item: Locator, different = false) {
  // Playwright has no mouse pointercancel command. Exercise the cancellation
  // branch with the browser-recorded pointer ID, separately from native drags.
  await item.evaluate((node, different) => node.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: Number(node.getAttribute("data-test-pointer")) + (different ? 99 : 0), pointerType: "mouse" })), different);
}

const CARD_SURFACES = ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]";
const foodPoint = (item: Locator) => item.evaluate(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: matrix.m41, y: matrix.m42 }; });
async function allowDocumentScroll(page: Page) {
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished));
    // The PC fixture normally fits one screen. Add inert flow, leaving the
    // real calendar DOM and its transforms/geometry untouched.
    document.documentElement.style.overflowY = "auto"; document.documentElement.style.scrollBehavior = "auto"; document.body.style.overflowY = "visible";
    const spacer = document.createElement("div"); spacer.setAttribute("aria-hidden", "true"); spacer.style.cssText = "height:1400px;pointer-events:none"; document.body.append(spacer);
  });
}
async function identifyInitialSupport(page: Page, awayFrom?: { x: number; y: number }) {
  const found = await page.evaluate(({ selector, awayFrom }) => {
    // Deliberate food/pet placement now collides with the rendered card top,
    // independently of the autonomous text ledges. Pick a real shared ray with
    // room for the92px pet body and44x38 snack hitbox above that same card.
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role='button']")]
      .filter(node => !node.matches(`${selector},.public-day,.agenda-day`) && !node.closest(".vc-companion,.vc-cushion-button"))
      .map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    const halfWidth = Math.max(92 * .76, 44) / 2 + 3, height = Math.max(92 * .76, 38) + 3;
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = node.getBoundingClientRect(), y = rect.top - 3;
      if (rect.width < 80 || rect.height <= 0 || y < 120 || rect.bottom > innerHeight - 60) continue;
      // The centre of an agenda card can sit below a holiday button. An actual
      // clear point toward either side preserves hit-target protection.
      for (const fraction of [.5, .86, .14]) {
        const x = rect.left + rect.width * fraction;
        if (awayFrom && Math.hypot(x - awayFrom.x, y - awayFrom.y) < 180) continue;
        if (x < 50 || x > innerWidth - 50 || controls.some(control => control.left < x + halfWidth && control.right > x - halfWidth && control.top < y && control.bottom > y - height)) continue;
        if (document.elementFromPoint(x, rect.top + Math.min(4, rect.height / 2))?.closest(selector) !== node) continue;
        node.setAttribute("data-test-food-anchor", "");
        return { x: x - rect.left, y: -3, point: { x, y } };
      }
    }
    return null;
  }, { selector: CARD_SURFACES, awayFrom });
  expect(found, "fixture needs a visible actual card top with a clear pet/food ray").not.toBeNull();
  return found!;
}

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const width of [1440]) {
  test(`food keeps its actual card support offscreen and returns at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); await setup(page, .1, false);
    await allowDocumentScroll(page); const offset = await identifyInitialSupport(page), anchor = page.locator("[data-test-food-anchor]");
    const item = await spawn(page);
    await page.waitForTimeout(180); // Full geometry delivery after home topology.
    const target = await anchor.evaluate((node, offset) => { const rect = node.getBoundingClientRect(); return { x: rect.left + offset.x, y: rect.top + offset.y }; }, offset);
    await dragFoodToFeet(page, item, { x: target.x, y: target.y - 20 }, width === 390);
    await expect(item).not.toHaveAttribute("data-selected");
    await expect.poll(async () => Math.abs((await foodPoint(item)).y - target.y)).toBeLessThan(3);
    // A compact home can close after an actual drag has detached the snack.
    // Its native close button cannot act as an implicit food placement.
    const close = page.getByRole("button", { name: "빅타민 집 닫기", exact: true });
    if (await close.isVisible()) { await close.click(); await expect(item).toBeVisible(); await expect(item).not.toHaveAttribute("data-selected"); }
    await page.waitForTimeout(180);
    const original = await foodPoint(item);
    let actualOffset = await anchor.evaluate((node, point) => { const rect = node.getBoundingClientRect(); return { x: point.x - rect.left, y: point.y - rect.top }; }, original);
    expect(Math.abs(original.y - target.y)).toBeLessThan(3);
    const samples = await page.evaluate(({ offset }) => new Promise<{ error: number; scroll: number; x: number; y: number; sourceX: number; sourceY: number }[]>(resolve => {
      const food = document.querySelector<HTMLElement>(".vc-food")!, source = document.querySelector("[data-test-food-anchor]")!, startY = scrollY;
      const result: { error: number; scroll: number; x: number; y: number; sourceX: number; sourceY: number }[] = []; let began = 0;
      const frame = (now: number) => {
        began ||= now; const matrix = new DOMMatrixReadOnly(getComputedStyle(food).transform), rect = source.getBoundingClientRect();
        result.push({ error: Math.hypot(matrix.m41 - rect.left - offset.x, matrix.m42 - rect.top - offset.y), scroll: scrollY - startY, x: matrix.m41, y: matrix.m42, sourceX: rect.left, sourceY: rect.top });
        if (now - began > 800) { resolve(result); return; }
        window.scrollTo({ top: startY + 96 * Math.min((now - began) / 600, 1), behavior: "instant" }); requestAnimationFrame(frame);
      }; requestAnimationFrame(frame);
    }), { offset: actualOffset });
    expect(samples.length).toBeGreaterThan(20); expect(samples.at(-1)!.scroll).toBeGreaterThan(90);
    const sorted = samples.map(sample => sample.error).sort((a, b) => a - b);
    await writeFile(`.scratch-pw/companion-food-card-scroll-${width}.json`, JSON.stringify({ width, target, original, actualOffset, samples }, null, 2));
    console.log(JSON.stringify({ check: "food-anchor-scroll-diagnostic", width, target, original, actualOffset, first: samples.slice(0, 5), last: samples.slice(-5) }));
    expect(sorted[Math.floor(sorted.length * .95)]).toBeLessThan(5); expect(sorted.at(-1)).toBeLessThan(9);
    await page.evaluate(() => window.scrollTo({ top: 1100, behavior: "instant" }));
    await expect(item).toHaveJSProperty("hidden", true); await expect(foods(page)).toHaveCount(1);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(item).toHaveJSProperty("hidden", false);
    await expect.poll(async () => { const point = await foodPoint(item); return Math.hypot(point.x - original.x, point.y - original.y); }).toBeLessThan(2);
    await expect(item).toBeInViewport();
    if (width >= 1040) {
      // Attachment returns in one rAF; the pet's full geometry scan coalesces for
      //120ms. Finish this setup scan before asking it to share the source.
      // The separate scroll40→native food release below still has no wait.
      await page.waitForTimeout(180);
      // Deliberately share this exact source with the pet. Its renderer
      // follows and mutates its own platform copy during scroll; food must
      // retain an independent baseline for the following native release.
      const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
      await expect(actor).toBeVisible(); await actor.focus(); await actor.press("p"); await page.mouse.click(original.x, original.y);
      await expect(pet(page)).not.toHaveAttribute("data-state", "jump"); await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/);
    }
    // Regrab the restored real button, scroll while it is held, then release
    // before depending on a new full scan. Binding must apply the DOM delta
    // once; later deliveries cannot drag the food a second time.
    const from = await centre(item); await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(from.x, from.y - 8, { steps: 3 });
    await page.evaluate(() => { window.scrollTo({ top: 40, behavior: "instant" }); });
    const release = await anchor.evaluate((node, offset) => { const rect = node.getBoundingClientRect(); return { x: rect.left + offset.x, y: rect.top + offset.y - 16 }; }, actualOffset);
    await page.mouse.move(release.x, release.y, { steps: 2 });
    await page.mouse.up(); await expect(item).not.toHaveAttribute("data-selected");
    await expect(item).not.toHaveAttribute("data-falling");
    await expect.poll(async () => {
      const point = await foodPoint(item), rect = (await anchor.boundingBox())!; return Math.abs(point.y - rect.y - actualOffset.y);
    }).toBeLessThan(3);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await page.waitForTimeout(180);
    const regrabbed = await foodPoint(item);
    actualOffset = await anchor.evaluate((node, point) => { const rect = node.getBoundingClientRect(); return { x: point.x - rect.left, y: point.y - rect.top }; }, regrabbed);
    await page.screenshot({ path: `.scratch-pw/companion-food-scroll-return-${width}.png` });
    // A real reflow moves that same DOM source. It does not select a different
    // visible date merely because its safe-span ID was absent while away.
    await anchor.evaluate(node => { const spacer = document.createElement("div"); spacer.dataset.testFoodReflow = ""; spacer.style.height = "28px"; node.before(spacer); });
    await expect.poll(async () => {
      const point = await foodPoint(item), rect = (await anchor.boundingBox())!;
      return Math.hypot(point.x - rect.x - actualOffset.x, point.y - rect.y - actualOffset.y);
    }).toBeLessThan(3);
    const beforeDisconnect = await foodPoint(item);
    await anchor.evaluate(node => node.remove()); await page.waitForTimeout(200);
    await expect.poll(async () => { const point = await foodPoint(item); return Math.hypot(point.x - beforeDisconnect.x, point.y - beforeDisconnect.y); }).toBeLessThan(2);
    await page.evaluate(() => window.scrollTo({ top: 80, behavior: "instant" }));
    await expect.poll(async () => { const point = await foodPoint(item); return Math.hypot(point.x - beforeDisconnect.x, point.y + 80 - beforeDisconnect.y); }).toBeLessThan(2);
    await expect(page.locator("[data-export-surface] .vc-food")).toHaveCount(0);
    console.log(JSON.stringify({ check: "food-anchor-scroll", width, samples: samples.length, p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1) }));
  });
}

test("a floor snack belongs to its document point rather than the fixed viewport floor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await setup(page); await allowDocumentScroll(page);
  const item = await spawn(page); await dragFoodToFeet(page, item, { x: 180, y: 960 }); await expect(item).not.toHaveAttribute("data-selected");
  await expect(item).not.toHaveAttribute("data-falling");
  const original = await foodPoint(item); expect(original.y).toBeGreaterThan(850);
  await page.evaluate(() => window.scrollTo({ top: 180, behavior: "instant" }));
  await expect.poll(async () => (await foodPoint(item)).y + await page.evaluate(() => scrollY)).toBeCloseTo(original.y, 1);
  expect((await foodPoint(item)).y).toBeLessThan(original.y - 170);
  await page.evaluate(() => window.scrollTo({ top: 1100, behavior: "instant" })); await expect(item).toHaveJSProperty("hidden", true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await expect(item).toHaveJSProperty("hidden", false);
  await expect.poll(async () => Math.abs((await foodPoint(item)).y - original.y)).toBeLessThan(2);
});

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const width of [1440]) {
  test(`three real dispenser clicks vary fruit; dragging one to trash preserves the others at ${width}px`, async ({ page }) => {
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
    const disclosure = page.getByRole("region", { name: "빅타민 집", exact: true }).getByRole("button", { name: "빅타민 집", exact: true });
    await disclosure.click({ position: { x: 12, y: 16 } }); await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await expect(foods(page).last()).not.toHaveAttribute("data-selected");
    // Dispensing creates stationary food rather than a global placement mode.
    await disclosure.click({ position: { x: 12, y: 16 } }); await expect(disclosure).toHaveAttribute("aria-expanded", "true");
    await expect(foods(page)).toHaveCount(3);
    await expect(foods(page).last()).toHaveCSS("outline-style", "none");
    await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)));
    await page.screenshot({ path: `.scratch-pw/companion-food-selected-${width}.png` });
    // A pointer tap only focuses food. Placement requires a genuine drag or
    // the explicit keyboard Enter/Arrow/Enter alternative.
    const selected = foods(page).last();
    const beforeTap = await foodPoint(selected);
    if (width === 390) await selected.tap(); else await selected.click();
    await expect(selected).not.toHaveAttribute("data-selected");
    expect(Math.hypot((await foodPoint(selected)).x - beforeTap.x, (await foodPoint(selected)).y - beforeTap.y)).toBeLessThan(2);
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
    const p = await centre(bin(page)); await dragFoodToPointer(page, selected, p, width === 390);
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
  const take = async () => {
    // This case tests dwell/cancel ownership from rest. A new finite fall can
    // outlast the old550ms pause; sample its hitbox only after real landing.
    await expect(item).not.toHaveAttribute("data-falling", "", { timeout: 1800 });
    const p = await centre(item); await page.mouse.move(p.x, p.y); await page.mouse.down();
    // Cancellation can correctly leave the fruit at the bin's centre. Make
    // the next interaction an actual >6px drag, rather than another still hold.
    await page.mouse.move(p.x - 12, p.y); await page.mouse.move(target.x, target.y, { steps: 5 });
  };
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

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.

for (const input of ["pointer", "keyboard"] as const) {
  test(`food reaches the mouth and ${input} regrabbing interrupts without care credit`, async ({ page }) => {
    await setup(page, .58);
    const offset = await identifyInitialSupport(page), anchor = page.locator("[data-test-food-anchor]");
    // This regression concerns mouth presentation and interruption, not an
    // assumed floor span at an authored coordinate. Place by a real command on
    // the same measured manual card top that will support the offered snack.
    const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
    await actor.focus(); await actor.press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
    const destination = await anchor.evaluate((node, offset) => { const rect = node.getBoundingClientRect(); return { x: rect.left + offset.x, y: rect.top + offset.y }; }, offset);
    await page.mouse.click(destination.x, destination.y);
    await expect(pet(page)).not.toHaveAttribute("data-placing"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/);
    const placed = await pet(page).evaluate(node => { const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.bottom }; });
    expect(Math.hypot(placed.x - destination.x, placed.y - destination.y)).toBeLessThan(2);
    const item = await spawn(page);
    const target = await pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom }; });
    await dragFoodToFeet(page, item, { x: target.x, y: target.y - 16 });
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
      // The fixed month bar can put the actual floor above height−26. Drop
      // onto another measured card, so later native Delete has a visible target.
      const putDown = (await identifyInitialSupport(page, target)).point;
      await page.mouse.move(putDown.x, putDown.y - 40, { steps: 8 }); await page.mouse.up();
    } else {
      await item.focus(); await item.press("Enter"); await expect(item).toHaveAttribute("data-selected", "");
      const held = await centre(item); expect(Math.hypot(held.x - before.x, held.y - before.y)).toBeLessThan(12);
      for (let i = 0; i < 8; i++) await item.press("ArrowRight");
      await item.press("Enter");
    }
    await expect(item).not.toHaveAttribute("data-eating"); await expect(item).not.toHaveAttribute("data-selected");
    await page.waitForTimeout(2900); await expect(foods(page)).toHaveCount(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger)).toBeGreaterThan(.5);
    await expect(item).toBeVisible(); await item.focus(); await expect(item).toBeFocused();
    await item.press("Delete"); await expect(foods(page)).toHaveCount(0);
  });
}

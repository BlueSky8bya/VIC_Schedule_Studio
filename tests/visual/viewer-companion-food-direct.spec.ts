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

const TEXT_SURFACES = ".public-day .day-strip > strong,.agenda-day .agenda-when > strong,.public-event .event-main p,.public-event .event-subs li,.agenda-event .agenda-title-text,.agenda-event .agenda-subs li,.agenda-item .agenda-title-text,.agenda-item .agenda-title,.agenda-item .agenda-subs li";
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
async function identifyInitialSupport(page: Page) {
  if (!(await pet(page).getAttribute("data-platform"))?.match(/^(?:card|date)-/)) {
    // Dense phone rows can correctly have no safe initial character landing.
    // Give one existing card inert flow space. This food-only setup uses the
    // real source line directly, without a fabricated companion pose.
    await page.locator(".agenda-title-text").first().evaluate(node => {
      const day = node.closest<HTMLElement>(".agenda-day")!; day.style.marginTop = "100px";
    });
    await page.waitForTimeout(180);
    return page.locator(".agenda-title-text").first().evaluate(node => {
      const range = document.createRange(); range.selectNodeContents(node); const line = range.getClientRects()[0]; range.detach();
      node.setAttribute("data-test-food-anchor", ""); const rect = node.getBoundingClientRect();
      return { x: line.left + line.width / 2 - rect.left, y: line.top - 3 - rect.top, error: 0 };
    });
  }
  await expect(pet(page)).toHaveAttribute("data-platform", /^(?:card|date)-/);
  const found = await page.evaluate(selector => {
    const pet = document.querySelector(".vc-companion")!.getBoundingClientRect(), x = pet.left + pet.width / 2;
    const candidates: { node: HTMLElement; error: number }[] = [];
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      const range = document.createRange(); range.selectNodeContents(node);
      for (const line of range.getClientRects()) if (x >= line.left - .5 && x <= line.right + .5 && line.width > .5 && line.height > .5) candidates.push({ node, error: Math.abs(pet.bottom - line.top + 3) });
      range.detach();
    }
    const closest = candidates.sort((a, b) => a.error - b.error)[0];
    if (!closest) return null;
    closest.node.setAttribute("data-test-food-anchor", ""); const rect = closest.node.getBoundingClientRect();
    return { x: x - rect.left, y: pet.bottom - rect.top, error: closest.error };
  }, TEXT_SURFACES);
  expect(found).not.toBeNull(); expect(found!.error).toBeLessThan(2); return found!;
}

for (const width of [1440, 390]) {
  test(`food keeps its actual text support offscreen and returns at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 }); await setup(page, .1, false);
    await allowDocumentScroll(page); const offset = await identifyInitialSupport(page), anchor = page.locator("[data-test-food-anchor]");
    const item = await spawn(page);
    // Opening/closing the compact house while carrying food is a real control
    // action, not an accidental placement click through the disclosure.
    const close = page.getByRole("button", { name: "빅타민 집 닫기", exact: true });
    if (await close.isVisible()) { await close.click(); await expect(item).toHaveAttribute("data-selected", ""); }
    await page.waitForTimeout(180); // Full geometry delivery after home topology.
    const target = await anchor.evaluate((node, offset) => { const rect = node.getBoundingClientRect(); return { x: rect.left + offset.x, y: rect.top + offset.y }; }, offset);
    await page.mouse.click(target.x, target.y); await expect(item).not.toHaveAttribute("data-selected");
    const original = await foodPoint(item);
    let actualOffset = await anchor.evaluate((node, point) => { const rect = node.getBoundingClientRect(); return { x: point.x - rect.left, y: point.y - rect.top }; }, original);
    expect(Math.abs(original.y - target.y)).toBeLessThan(3);
    const samples = await page.evaluate(({ offset }) => new Promise<{ error: number; scroll: number }[]>(resolve => {
      const food = document.querySelector<HTMLElement>(".vc-food")!, source = document.querySelector("[data-test-food-anchor]")!, startY = scrollY;
      const result: { error: number; scroll: number }[] = []; let began = 0;
      const frame = (now: number) => {
        began ||= now; const matrix = new DOMMatrixReadOnly(getComputedStyle(food).transform), rect = source.getBoundingClientRect();
        result.push({ error: Math.hypot(matrix.m41 - rect.left - offset.x, matrix.m42 - rect.top - offset.y), scroll: scrollY - startY });
        if (now - began > 800) { resolve(result); return; }
        window.scrollTo({ top: startY + 96 * Math.min((now - began) / 600, 1), behavior: "instant" }); requestAnimationFrame(frame);
      }; requestAnimationFrame(frame);
    }), { offset: actualOffset });
    expect(samples.length).toBeGreaterThan(20); expect(samples.at(-1)!.scroll).toBeGreaterThan(90);
    const sorted = samples.map(sample => sample.error).sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length * .95)]).toBeLessThan(5); expect(sorted.at(-1)).toBeLessThan(9);
    await page.evaluate(() => window.scrollTo({ top: 1100, behavior: "instant" }));
    await expect(item).toHaveJSProperty("hidden", true); await expect(foods(page)).toHaveCount(1);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await expect(item).toHaveJSProperty("hidden", false);
    await expect.poll(async () => { const point = await foodPoint(item); return Math.hypot(point.x - original.x, point.y - original.y); }).toBeLessThan(2);
    await expect(item).toBeInViewport();
    if (width >= 1040) {
      // Attachment returns in one rAF; the pet's full text scan coalesces for
      //120ms. Finish this setup scan before asking it to share the source.
      // The separate scroll40→native food release below still has no wait.
      await page.waitForTimeout(180);
      // Deliberately share this exact source with the pet. Its renderer
      // follows and mutates its own platform copy during scroll; food must
      // retain an independent baseline for the following native release.
      const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
      await expect(actor).toBeVisible(); await actor.focus(); await actor.press("p"); await page.mouse.click(original.x, original.y);
      await expect(pet(page)).not.toHaveAttribute("data-state", "jump"); await expect(pet(page)).toHaveAttribute("data-platform", /^(?:card|date)-/);
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
  const item = await spawn(page); await page.mouse.click(180, 980); await expect(item).not.toHaveAttribute("data-selected");
  const original = await foodPoint(item); expect(original.y).toBeGreaterThan(850);
  await page.evaluate(() => window.scrollTo({ top: 180, behavior: "instant" }));
  await expect.poll(async () => (await foodPoint(item)).y + await page.evaluate(() => scrollY)).toBeCloseTo(original.y, 1);
  expect((await foodPoint(item)).y).toBeLessThan(original.y - 170);
  await page.evaluate(() => window.scrollTo({ top: 1100, behavior: "instant" })); await expect(item).toHaveJSProperty("hidden", true);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await expect(item).toHaveJSProperty("hidden", false);
  await expect.poll(async () => Math.abs((await foodPoint(item)).y - original.y)).toBeLessThan(2);
});

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
    const disclosure = page.getByRole("region", { name: "빅타민 집", exact: true }).getByRole("button", { name: "빅타민 집", exact: true });
    await disclosure.click({ position: { x: 12, y: 16 } }); await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await expect(foods(page).last()).toHaveAttribute("data-selected", "");
    // The freely selected snack can overlap the folded header's centre.
    // Its exposed left edge remains a native, unforced disclosure target.
    await disclosure.click({ position: { x: 12, y: 16 } }); await expect(disclosure).toHaveAttribute("aria-expanded", "true");
    await expect(foods(page)).toHaveCount(3);
    await expect(foods(page).last()).toHaveCSS("outline-style", "none");
    await page.evaluate(() => Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)));
    await page.screenshot({ path: `.scratch-pw/companion-food-selected-${width}.png` });
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

test("a real mobile touch cancellation keeps its snack and a held trash drop cannot click through", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await setup(page);
  const item = await spawn(page); await item.press("Escape");
  const client = await page.context().newCDPSession(page), target = await centre(bin(page));
  const take = async () => {
    await expect(item).not.toHaveAttribute("data-falling", "", { timeout: 1800 });
    const from = await centre(item);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from.x, y: from.y, id: 11 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: from.x - 16, y: from.y, id: 11 }] });
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

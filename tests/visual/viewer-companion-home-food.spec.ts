import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const foods = (page: Page) => page.locator(".vc-food");
const house = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const bed = (page: Page) => house(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
const position = (item: Locator) => item.evaluate(node => {
  // Chromium computes transform:none inside the deliberately hidden food
  // layer while a dialog owns input. Its retained inline carrier is the only
  // position during that interval; visible frames still use computed style.
  const transform = node.closest("[hidden]") ? (node as HTMLElement).style.transform : getComputedStyle(node).transform;
  const m = new DOMMatrixReadOnly(transform); return { x: m.m41, y: m.m42 };
});
const posts = new WeakMap<Page, string[]>();
type FoodWitnessWindow = Window & { homeFoodWitness: { fell: boolean; observer: MutationObserver } };
type FallPoint = { x: number; y: number };
type FallFrame = FallPoint & { at: number; falling: boolean; scaleY: number };
type FallProbe = { released: FallPoint | null; onset: FallPoint | null; frames: FallFrame[]; began: number; seen: boolean; done: boolean; raf: number; observer: MutationObserver; release: (event: Event) => void; node: Element };
type FallWindow = Window & { homeFloorFall?: FallProbe };

test.use({ video: "on" });
test.beforeEach(async ({ page }) => {
  const blocked: string[] = []; posts.set(page, blocked);
  await page.route("**/*", route => route.request().method() === "POST" ? (blocked.push(route.request().url()), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); });

async function seed(page: Page, hunger = .05, sleep = false, approach = false) {
  await page.addInitScript(({ key, epoch, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.sound", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
    Object.defineProperty(document, "hasFocus", { configurable: true, value: () => true });
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: approach, jump: approach, sleep, feeding: true, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger } });
}

async function press(item: Locator, mobile: boolean) { if (mobile) await item.tap(); else await item.click(); }
async function waitForHomeMount(page: Page) {
  // Fonts can finish before the enabled companion's lazy module commits.
  // Wait for its real UI before choosing inline home versus compact launcher.
  await expect.poll(async () => await house(page).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
}
async function setup(page: Page, mobile: boolean) {
  await seed(page);
  await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
  await waitForHomeMount(page);
  await openCompanionHome(page, mobile ? "touch" : "pointer");
  await expect(bed(page)).toBeDisabled(); // Sleeping OFF does not disable food or its floor.
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await page.waitForTimeout(180);
}
async function bedPoint(page: Page, x = .5, y = .55) { const r = (await bed(page).boundingBox())!; return { x: r.x + r.width * x, y: r.y + r.height * y }; }
async function floorOffset(page: Page, item: Locator) { const p = await position(item), r = (await house(page).locator(".vc-home-floor").boundingBox())!; return { x: p.x - r.x, y: p.y - r.y }; }
async function expectOffset(page: Page, item: Locator, offset: { x: number; y: number }) {
  await expect(item).toHaveJSProperty("hidden", false);
  await expect.poll(async () => { const next = await floorOffset(page, item); return Math.hypot(next.x - offset.x, next.y - offset.y); }).toBeLessThan(2);
}
async function expectFloor(page: Page, item: Locator) {
  await expect(item).not.toHaveAttribute("data-falling"); await expect(item).not.toHaveAttribute("data-selected");
  await expect.poll(async () => { const p = await position(item), r = (await house(page).locator(".vc-home-floor").boundingBox())!; return Math.abs(p.y - (r.y + r.height - COMPANION_HOME_FLOOR_INSET)); }).toBeLessThan(2);
  const collisions = await item.evaluate(node => {
    const r = node.getBoundingClientRect();
    return [...document.querySelectorAll(".vc-home button:not(.vc-cushion-button)")].filter(button => { const b = button.getBoundingClientRect(); return b.width > 0 && b.height > 0 && r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top; }).length;
  });
  expect(collisions, "the full44px food control must keep the outlet, bin and room controls clear").toBe(0);
}
async function watchGravity(item: Locator) {
  await item.evaluate(node => {
    const read = () => { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: m.m41, y: m.m42 }; };
    const p: FallProbe = { released: null, onset: null, frames: [], began: 0, seen: false, done: false, raf: 0, node,
      observer: new MutationObserver(() => { if (node.hasAttribute("data-falling")) { p.onset ??= read(); p.seen = true; } }),
      release: event => { if (event instanceof KeyboardEvent && !["Enter", " "].includes(event.key)) return; p.released = read(); p.began = performance.now(); },
    };
    p.observer.observe(node, { attributes: true, attributeFilter: ["data-falling"] });
    node.addEventListener("pointerup", p.release, true); node.addEventListener("keydown", p.release, true);
    const sample = (now: number) => {
      if (p.released) { const falling = node.hasAttribute("data-falling"), m = new DOMMatrixReadOnly(getComputedStyle(node).transform), art = new DOMMatrixReadOnly(getComputedStyle(node.firstElementChild!).transform); p.seen ||= falling;
        p.frames.push({ at: now - p.began, x: m.m41, y: m.m42, falling, scaleY: Math.hypot(art.c, art.d) }); if (p.seen && !falling) { p.done = true; return; }
      }
      p.raf = requestAnimationFrame(sample);
    };
    (window as FallWindow).homeFloorFall = p; p.raf = requestAnimationFrame(sample);
  });
}
async function finishGravity(page: Page, item: Locator, label: string) {
  await expect.poll(() => page.evaluate(() => Boolean((window as FallWindow).homeFloorFall?.done)), { timeout: 4000 }).toBe(true);
  const proof = await page.evaluate(() => { const p = (window as FallWindow).homeFloorFall!; cancelAnimationFrame(p.raf); p.observer.disconnect(); p.node.removeEventListener("pointerup", p.release, true); p.node.removeEventListener("keydown", p.release, true); return { released: p.released!, onset: p.onset!, frames: p.frames }; });
  await expectFloor(page, item); const landed = await position(item), floor = (await house(page).locator(".vc-home-floor").boundingBox())!, plane = floor.y + floor.height - COMPANION_HOME_FLOOR_INSET;
  await writeFile(`.scratch-pw/companion-059-home-fall-raw-${label}.json`, JSON.stringify({ ...proof, plane, landed }, null, 2));
  expect(proof.onset).not.toBeNull(); expect(Math.hypot(proof.onset.x - proof.released.x, proof.onset.y - proof.released.y)).toBeLessThan(2);
  expect(plane - proof.released.y).toBeGreaterThan(12); expect(proof.frames.length).toBeGreaterThan(5);
  // data-falling also owns the finite bounce. Only frames before the first
  // physical contact describe acceleration; a long fall's bounce can rise
  // more than2px and otherwise masquerade as another airborne sample.
  const contact = proof.frames.findIndex(f => f.y >= plane - .5 || f.scaleY < .99);
  expect(contact).toBeGreaterThan(0);
  const air = proof.frames.slice(0, contact).filter(f => f.falling && f.at > 0 && f.y > proof.released.y + .5 && f.y < plane - 2);
  expect(air.length).toBeGreaterThan(2); const middle = air[Math.floor((air.length - 1) / 2)], late = air.at(-1)!;
  const earlyVelocity = (middle.y - proof.released.y) / (middle.at - 0), lateVelocity = (late.y - middle.y) / (late.at - middle.at);
  expect(lateVelocity).toBeGreaterThan(earlyVelocity * 1.1);
  expect(proof.frames.some(f => f.y > proof.released.y + 2 && f.y < plane - 2)).toBe(true);
  expect(Math.abs(landed.y - plane)).toBeLessThan(2); expect(Math.abs(landed.x - proof.released.x)).toBeLessThan(2);
  expect(proof.frames.some(f => f.scaleY < .99)).toBe(true);
  const result = { check: "sofa-pass-through-gravity", label, ...proof, plane, landed, earlyVelocity, lateVelocity, floorError: Math.abs(landed.y - plane) };
  await writeFile(`.scratch-pw/companion-059-home-fall-${label}.json`, JSON.stringify(result, null, 2)); console.log(JSON.stringify(result)); return landed;
}
async function watchNoFall(item: Locator) {
  await item.evaluate(node => {
    const witness: FoodWitnessWindow["homeFoodWitness"] = { fell: false, observer: new MutationObserver(records => {
      if (records.some(r => r.oldValue !== null || node.hasAttribute("data-falling"))) witness.fell = true;
    }) };
    witness.observer.observe(node, { attributes: true, attributeOldValue: true, attributeFilter: ["data-falling"] });
    (window as unknown as FoodWitnessWindow).homeFoodWitness = witness;
  });
}
async function stopNoFall(page: Page) {
  expect(await page.evaluate(() => { const w = (window as unknown as FoodWitnessWindow).homeFoodWitness; w.observer.disconnect(); return w.fell; })).toBe(false);
}
async function dragFood(page: Page, item: Locator, target: { x: number; y: number }, mobile: boolean) {
  const r = (await item.boundingBox())!, original = await position(item), start = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  const expectedHeld = { x: target.x - start.x + original.x, y: target.y - start.y + original.y };
  if (!mobile) {
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + 12, start.y, { steps: 2 }); await page.mouse.move(target.x, target.y, { steps: 12 });
    for (let sample = 0; sample < 4; sample++) await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    await expect.poll(async () => { const p = await position(item); return Math.hypot(p.x - expectedHeld.x, p.y - expectedHeld.y); }, { message: "captured food must follow its grip instead of snapping into the sofa" }).toBeLessThan(2);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 1 }] });
    for (let step = 1; step <= 12; step++) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (target.x - start.x) * step / 12, y: start.y + (target.y - start.y) * step / 12, id: 1 }] });
    for (let sample = 0; sample < 4; sample++) { await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve()))); await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...target, id: 1 }] }); }
    await expect.poll(async () => { const p = await position(item); return Math.hypot(p.x - expectedHeld.x, p.y - expectedHeld.y); }, { message: "captured touch food must follow its grip instead of snapping into the sofa" }).toBeLessThan(2);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally { await cdp.detach(); }
}
async function unchangedSelfPutDown(item: Locator, mobile: boolean) {
  const original = await position(item);
  await item.focus();
  if (!(await item.evaluate(node => node.hasAttribute("data-selected")))) await item.press("Enter");
  await item.press("Enter"); await expect(item).not.toHaveAttribute("data-selected");
  await press(item, mobile); await expect(item).not.toHaveAttribute("data-selected");
  await press(item, mobile); await expect(item).not.toHaveAttribute("data-selected");
  expect(Math.hypot((await position(item)).x - original.x, (await position(item)).y - original.y)).toBeLessThan(2);
  await expect(item).not.toHaveAttribute("data-falling");
}
async function cancelBedReentry(page: Page, item: Locator, target: { x: number; y: number }, mobile: boolean) {
  const r = (await item.boundingBox())!, b = (await bed(page).boundingBox())!, start = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  const outside = { x: b.x + b.width / 2, y: b.y - 50 };
  if (mobile) {
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...start, id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...outside, id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...target, id: 1 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    } finally { await cdp.detach(); }
    return;
  }
  // Playwright has no mouse cancel primitive. Record the native pointer ID,
  // then exercise its cancellation branch separately from native touchCancel.
  await item.evaluate(node => node.addEventListener("pointerdown", event => node.setAttribute("data-test-pointer", String((event as PointerEvent).pointerId)), { once: true, capture: true }));
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(outside.x, outside.y, { steps: 4 }); await page.mouse.move(target.x, target.y, { steps: 4 });
  await item.evaluate(node => node.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerId: Number(node.getAttribute("data-test-pointer")), pointerType: "mouse" })));
  await page.mouse.up();
}

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.
for (const view of [{ mobile: false, landscape: false, width: 1920, height: 1100 }]) test.describe(view.landscape ? "native landscape home food" : view.mobile ? "native touch home food" : "PC home food", () => {
  const { mobile, landscape } = view, label = landscape ? "844-landscape" : mobile ? "390" : "1920";
  test.use({ viewport: { width: view.width, height: view.height }, hasTouch: mobile, isMobile: mobile });
  test("sofa and above-sofa drops fall onto the first house floor and keep that attachment through home topology", async ({ page }) => {
    test.setTimeout(30000); await setup(page, mobile);
    await press(house(page).getByRole("button", { name: "밥 꺼내기", exact: true }), mobile);
    const item = foods(page).last(); await expect(item).not.toHaveAttribute("data-selected");
    await watchNoFall(item); await unchangedSelfPutDown(item, mobile); await stopNoFall(page);
    const first = await bedPoint(page);
    await watchGravity(item);
    await dragFood(page, item, { x: first.x, y: first.y - 16 }, mobile);
    await finishGravity(page, item, `sofa-${label}`);
    const initial = await floorOffset(page, item);
    await unchangedSelfPutDown(item, mobile);

    // A second genuine release starts above the sofa. Its footprint passes
    // through the sofa support instead of snapping into its decorative ink.
    const moved = await bedPoint(page, .66, .49), bounds = (await bed(page).boundingBox())!; await watchGravity(item);
    await dragFood(page, item, { x: moved.x, y: bounds.y - 40 }, mobile);
    await finishGravity(page, item, `above-${label}`);
    const next = await floorOffset(page, item);
    expect(Math.hypot(next.x - initial.x, next.y - initial.y)).toBeGreaterThan(10);
    await cancelBedReentry(page, item, moved, mobile); await expectFloor(page, item); await expectOffset(page, item, next);

    // Horizontal floor movement remains settled. Lifting into the sofa and
    // releasing by keyboard then uses the same finite gravity as the pointer.
    await watchNoFall(item);
    await item.focus(); await item.press("Enter"); await item.press("ArrowLeft"); await item.press("Enter");
    await expectFloor(page, item); const horizontal = await floorOffset(page, item);
    expect(Math.abs(horizontal.x - next.x + 24)).toBeLessThan(2); expect(Math.abs(horizontal.y - next.y)).toBeLessThan(2); await stopNoFall(page);
    await item.focus(); await item.press("Enter"); await item.press("ArrowUp"); await item.press("ArrowUp"); await watchGravity(item); await item.press("Enter");
    await finishGravity(page, item, `keyboard-${label}`);
    const final = await floorOffset(page, item); expect(Math.hypot(final.x - horizontal.x, final.y - horizontal.y)).toBeLessThan(2);
    await watchNoFall(item);
    const fold = house(page).getByRole("button", { name: "빅타민 집", exact: true });
    await press(fold, mobile); await expect(item).toHaveJSProperty("hidden", true);
    await press(fold, mobile); await expectOffset(page, item, final);
    if (mobile) {
      await house(page).getByRole("button", { name: "빅타민 집 닫기", exact: true }).tap(); await expect(item).toHaveJSProperty("hidden", true);
      await openCompanionHome(page, "touch"); await expectOffset(page, item, final);
    } else {
      await page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true }).click(); await expect(page.locator(".avatar-right .vc-home")).toBeVisible(); await expectOffset(page, item, final);
      await page.getByRole("button", { name: "패널을 왼쪽에 두기", exact: true }).click(); await expect(page.locator(".avatar-left .vc-home")).toBeVisible(); await expectOffset(page, item, final);
    }
    await page.evaluate(() => { document.documentElement.style.overflowY = "auto"; const spacer = document.createElement("div"); spacer.style.height = "1400px"; spacer.setAttribute("aria-hidden", "true"); document.body.append(spacer); window.scrollTo({ top: 64, behavior: "instant" }); });
    await expectOffset(page, item, final); await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" })); await expectOffset(page, item, final);
    await page.waitForTimeout(900); await stopNoFall(page);
    const quiet = await item.evaluate(node => new Promise<number>(resolve => { let writes = 0; const o = new MutationObserver(records => { writes += records.length; }); o.observe(node, { attributes: true, subtree: true }); setTimeout(() => { o.disconnect(); resolve(writes); }, 350); }));
    expect(quiet).toBe(0); await expect(foods(page)).toHaveCount(1);
    await expect(page.locator("[data-export-surface] .vc-food,[data-export-surface] .vc-companion")).toHaveCount(0);
    if (mobile) {
      await expect(page.locator(".poster-page")).toHaveClass(/poster-agenda/);
      await expect(page.locator("[data-export-surface]")).toHaveCount(0);
    } else expect(await page.locator("[data-export-surface]").evaluate(node => getComputedStyle(node).width)).toBe("1840px");
    console.log(JSON.stringify({ check: "manual-home-food-floor", width: view.width, height: view.height, nativeTouch: mobile, initial, dragged: next, keyboard: final, quietWrites350ms: quiet }));
    await page.screenshot({ path: `.scratch-pw/companion-home-food-${label}.png` });
  });

  if (!landscape) test("spawn, food taps and an explicit keyboard grab never turn calendar clicks into food placement", async ({ page }) => {
    test.setTimeout(30000); await setup(page, mobile);
    await press(house(page).getByRole("button", { name: "밥 꺼내기", exact: true }), mobile);
    const item = foods(page).last(); await expect(item).not.toHaveAttribute("data-selected");
    const identity = (await item.elementHandle())!;
    const offset = async () => { const p = await position(item), r = (await page.locator(".vc-dispenser-slot").boundingBox())!; return { x: p.x - r.x, y: p.y - r.y }; };
    const initial = await offset(), errors: number[] = []; await watchNoFall(item);
    const cards = page.locator(mobile ? ".agenda-event" : ".public-event");
    const index = await cards.evaluateAll(nodes => nodes.findIndex(node => { const r = node.getBoundingClientRect(); return r.width > 40 && r.height > 10 && r.top > 100 && r.bottom < innerHeight * .6; }));
    expect(index).toBeGreaterThanOrEqual(0);
    for (const mode of ["spawn", "tap", "keyboard"] as const) {
      if (mode === "tap") { await press(item, mobile); await expect(item).not.toHaveAttribute("data-selected"); }
      if (mode === "keyboard") { await item.focus(); await item.press("Enter"); await expect(item).toHaveAttribute("data-selected", ""); }
      await press(cards.nth(index), mobile);
      const detail = page.getByRole("dialog", { name: "일정 상세", exact: true }); await expect(detail).toBeVisible();
      await expect(page.locator(".vc-food-layer")).toBeHidden();
      const during = await offset(), duringError = Math.hypot(during.x - initial.x, during.y - initial.y); errors.push(duringError); expect(duringError, JSON.stringify({ mode, initial, during })).toBeLessThan(2);
      await press(detail.getByRole("button", { name: "닫기", exact: true }), mobile); await expect(detail).toHaveCount(0);
      await expect(item).toHaveJSProperty("hidden", false);
      const after = await offset(), afterError = Math.hypot(after.x - initial.x, after.y - initial.y); errors.push(afterError); expect(afterError).toBeLessThan(2);
      expect(await identity.evaluate(node => node === document.querySelector(".vc-food"))).toBe(true);
    }
    await item.press("Enter"); await expect(item).not.toHaveAttribute("data-selected");
    await stopNoFall(page); await expect(foods(page)).toHaveCount(1);
    console.log(JSON.stringify({ check: "food-calendar-no-teleport", width: mobile ? 390 : 1920, localOffset: initial, finalOffset: await offset(), maximumError: Math.max(...errors) }));
    await page.screenshot({ path: `.scratch-pw/companion-food-no-teleport-${mobile ? 390 : 1920}.png` });
  });
});

test("a hungry sofa resident approaches the real house floor before eating a dropped snack", async ({ page }) => {
  test.setTimeout(25000); await page.setViewportSize({ width: 1920, height: 1100 });
  await seed(page, .8, true, true);
  await page.goto("/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready); await waitForHomeMount(page); await openCompanionHome(page);
  await expect(bed(page)).toBeEnabled(); await bed(page).click();
  const creature = page.locator(".vc-companion"), actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  await expect(creature).toHaveAttribute("data-platform", "companion-home"); await expect(creature).not.toHaveAttribute("data-state", "jump");
  // A native affectionate tap finishes the requested nap before offering food.
  await actor.focus(); await actor.press("Enter"); await expect(creature).toHaveAttribute("data-state", "petted");
  await house(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  const item = foods(page).last(); await expect(item).not.toHaveAttribute("data-selected");
  const target = await bedPoint(page, .5, .55); await watchGravity(item); await dragFood(page, item, { x: target.x, y: target.y - 16 }, false);
  const placed = await finishGravity(page, item, "meal-1920");
  await expect(creature).toHaveAttribute("data-state", "eat", { timeout: 8000 });
  await expect(creature).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
  await expect(foods(page)).toHaveCount(0, { timeout: 7000 });
  const hunger = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger as number);
  expect(hunger).toBeLessThan(.5); await expect(creature).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
  console.log(JSON.stringify({ check: "manual-home-food-meal", placed, hungerAfter: hunger }));
  await page.screenshot({ path: ".scratch-pw/companion-home-food-meal.png" });
});

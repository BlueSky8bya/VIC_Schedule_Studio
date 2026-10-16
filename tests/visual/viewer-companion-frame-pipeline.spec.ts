import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { MAX_COMPANION_FOOD } from "@/lib/ui/viewer-companion/food-capacity";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { PREMIERE_STAGE_KEY, SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

type Point = { x: number; y: number };
type CarryFrame = { at: number; queuedAt: number; readAt: number; rafSerialAtQueue: number; latestSerial: number; sourceAtRAF: number; source: number; scrollAtRAF: number; scrollAtRead: number; foot: number; error: number; platform: string; hidden: boolean; state: string };
type Stall = { eventAt: number; eventStamp: number; source: number; scroll: number; endedAt: number };
type CarryWitness = { frames: CarryFrame[]; raf: number; serial: number; scrollVersion: number; onScroll: () => void; timers: Set<ReturnType<typeof setTimeout>>; stopped: boolean; stall?: Stall };
type FoodFrame = { at: number; id: string; x: number; y: number; floor: number; trayError: number; falling: boolean; hidden: boolean };
type FrameWindow = Window & { framePipelineCarry?: CarryWitness; framePipelineFood?: { frames: FoodFrame[]; raf: number; began: number } };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const food = (page: Page) => page.locator(".vc-food");
const observed = new WeakMap<Page, { posts: string[]; errors: string[] }>();
// Each rerun can keep its own raw JSON/PNGs without overwriting initial proof.
const artifactPrefix = process.env.VIC_PIPELINE_PREFIX ?? ".scratch-pw/companion-066-pipeline";

test.use({ viewport: { width: 1920, height: 1100 }, hasTouch: false, isMobile: false });
test.beforeEach(async ({ page }) => {
  const proof = { posts: [] as string[], errors: [] as string[] }; observed.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => route.request().method() === "POST" ? (proof.posts.push(new URL(route.request().url()).pathname), route.fulfill({ status: 500, body: "" })) : route.continue());
  await page.route("**/api/soop-live**", route => route.request().method() === "GET" ? route.fulfill({ json: { live: false } }) : route.fallback());
  await page.addInitScript(({ key, epoch, premiereKey, preferences, care }) => {
    localStorage.setItem(key, epoch);
    for (const [key, value] of Object.entries({ "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.sound": "off", "vic.ambient": "off", "vic_avatar_side": "left", [premiereKey]: "off" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, premiereKey: PREMIERE_STAGE_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: true, heartPrank: false, ambientPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
});
test.afterEach(async ({ page }) => { expect(observed.get(page)).toEqual({ posts: [], errors: [] }); });

async function settled(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
}
async function setup(page: Page, surface: "viewer" | "studio" = "viewer") {
  if (surface === "studio") await page.setViewportSize({ width: 1920, height: 900 });
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner" : "/visual-fixture/poster?avatar=1");
  await page.bringToFront(); await expect(pet(page)).toBeVisible(); await settled(page);
  await expect(pet(page)).toHaveAttribute("data-atlas", "hd"); await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
}
async function extendViewerFlow(page: Page) {
  // Only inert document flow is extended: all supports remain the fixture's
  // real calendar DOM. Studio uses its native calendar zoom instead.
  await page.evaluate(() => {
    document.documentElement.style.overflowY = "auto"; document.documentElement.style.scrollBehavior = "auto"; document.body.style.overflowY = "visible";
    const spacer = document.createElement("div"); spacer.setAttribute("aria-hidden", "true"); spacer.style.cssText = "height:1000px;pointer-events:none"; document.body.append(spacer);
  });
}
async function chooseActualCard(page: Page, surface: "viewer" | "studio") {
  const selector = surface === "studio" ? '.studio-event-pill[data-companion-event="ordinary"]' : ".public-event[data-eventid]:not(.teaser),.agenda-event[data-eventid]:not(.teaser),.agenda-item[data-eventid]:not(.teaser)";
  const target = await page.evaluate(selector => {
    const cell = document.querySelector(".vc-companion")!.getBoundingClientRect(), half = cell.width * .38 + 4, height = cell.height * .76 + 4;
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button]")].filter(node => !node.matches(selector) && !node.closest(".vc-companion") && !node.matches(".public-day,.agenda-day,.studio-day")).map(node => node.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0);
    for (const node of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = node.getBoundingClientRect(), y = rect.top - 3;
      if (rect.width < cell.width || rect.height <= 0 || y < cell.height + 160 || rect.bottom > innerHeight - 150) continue;
      for (const fraction of [.5, .25, .75]) {
        const x = rect.left + rect.width * fraction;
        if (controls.some(control => control.left < x + half && control.right > x - half && control.top < y && control.bottom > y - height)) continue;
        if (document.elementFromPoint(x, rect.top + Math.min(4, rect.height / 2))?.closest(selector) !== node) continue;
        node.dataset.framePipelineAnchor = ""; return { x, y };
      }
    }
    return null;
  }, selector);
  expect(target, "the real fixture must expose a public card with a clear body-sized top").not.toBeNull();
  await actor(page).focus(); await actor(page).press("p"); await page.mouse.click(target!.x, target!.y);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  const anchor = page.locator("[data-frame-pipeline-anchor]");
  await expect.poll(() => anchor.evaluate(node => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - (node.getBoundingClientRect().top - 3)))).toBeLessThan(2);
  await expect(page.locator(".event-editor-panel.is-edit,.agenda-detail-sheet")).toHaveCount(0);
  return anchor;
}
async function beginCarry(page: Page, anchor: Locator) {
  await anchor.evaluate(node => {
    const witness: CarryWitness = { frames: [], raf: 0, serial: 0, scrollVersion: 0, onScroll: () => { witness.scrollVersion++; }, timers: new Set(), stopped: false };
    window.addEventListener("scroll", witness.onScroll, { capture: true, passive: true });
    const read = (frame: Pick<CarryFrame, "at" | "queuedAt" | "rafSerialAtQueue" | "sourceAtRAF" | "scrollAtRAF">) => {
      if (witness.stopped) return;
      const el = document.querySelector<HTMLElement>(".vc-companion")!, source = node.getBoundingClientRect().top - 3, foot = el.getBoundingClientRect().bottom;
      witness.frames.push({ ...frame, readAt: performance.now(), latestSerial: witness.serial, scrollAtRead: witness.scrollVersion, source, foot, error: Math.abs(foot - source), platform: el.dataset.platform ?? "", state: el.dataset.state ?? "", hidden: el.hidden });
    };
    const sample = (now: number) => {
      const frame = { at: now, queuedAt: performance.now(), rafSerialAtQueue: ++witness.serial, sourceAtRAF: node.getBoundingClientRect().top - 3, scrollAtRAF: witness.scrollVersion };
      // Post-batch DOM observation, not a compositor presentation receipt.
      // Retain mixed reads too; the critical sample must prove that neither a
      // newer batch nor another scroll/source movement entered before reading.
      const timer = setTimeout(() => { witness.timers.delete(timer); read(frame); }, 0); witness.timers.add(timer);
      witness.raf = requestAnimationFrame(sample);
    };
    (window as FrameWindow).framePipelineCarry = witness; witness.raf = requestAnimationFrame(sample);
  });
  await expect.poll(() => page.evaluate(() => (window as FrameWindow).framePipelineCarry!.frames.length)).toBeGreaterThan(2);
}
async function finishCarry(page: Page, label: string) {
  const proof = await page.evaluate(() => { const witness = (window as FrameWindow).framePipelineCarry!; witness.stopped = true; cancelAnimationFrame(witness.raf); window.removeEventListener("scroll", witness.onScroll, true); for (const timer of witness.timers) clearTimeout(timer); return { frames: witness.frames, stall: witness.stall }; });
  await writeFile(`${artifactPrefix}-${label}.json`, JSON.stringify(proof, null, 2)); return proof;
}

for (const surface of ["viewer", "studio"] as const) test(`${surface} retains the real card in the first coherent DOM batch after a long main-thread frame`, async ({ page }) => {
  test.setTimeout(30000); await setup(page, surface);
  if (surface === "viewer") await extendViewerFlow(page);
  // Match the established native Studio scroll setup: deliberately place on
  // a real card before enlarging that calendar, then verify actual scroll room.
  const anchor = await chooseActualCard(page, surface), platform = await pet(page).getAttribute("data-platform");
  if (surface === "studio") {
    const panel = page.locator(".studio-calendar-panel"), rect = (await panel.boundingBox())!;
    await page.mouse.move(rect.x + rect.width * .4, rect.y + 10); await page.keyboard.down("Control");
    for (let step = 0; step < 4; step++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(250); }
    await page.keyboard.up("Control"); await expect.poll(() => panel.evaluate(node => parseFloat(getComputedStyle(node).getPropertyValue("--cal-zoom")))).toBeGreaterThan(1.5);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight - innerHeight - scrollY)).toBeGreaterThan(40);
    await expect.poll(() => anchor.evaluate(node => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - node.getBoundingClientRect().top + 3))).toBeLessThan(2);
  }
  const rect = (await anchor.boundingBox())!;
  const wheelTarget = surface === "viewer" ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : await page.locator(".studio-calendar-panel").evaluate(panel => {
    const rect = panel.getBoundingClientRect(), left = Math.max(0, rect.left), right = Math.min(document.documentElement.clientWidth, rect.right), top = Math.max(0, rect.top), bottom = Math.min(document.documentElement.clientHeight, rect.bottom);
    for (const fraction of [.75, .5, .25]) {
      const point = { x: right - Math.min(24, (right - left) / 4), y: top + (bottom - top) * fraction }, hit = document.elementFromPoint(point.x, point.y);
      if (hit && panel.contains(hit) && !hit.closest("button,a[href],input,select,textarea")) return point;
    }
    return null;
  });
  expect(wheelTarget, "native scrolling needs an exposed actual calendar panel point").not.toBeNull();
  await page.mouse.move(wheelTarget!.x, wheelTarget!.y);
  const layout = await page.evaluate(point => { const hit = document.elementFromPoint(point.x, point.y); return { scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight, viewport: { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight }, hitTag: hit?.tagName, hitClass: hit?.getAttribute("class") }; }, wheelTarget!);
  await writeFile(`${artifactPrefix}-${surface}-setup.json`, JSON.stringify({ surface, rect, wheelTarget, layout }, null, 2));
  await beginCarry(page, anchor);
  await anchor.evaluate(node => {
    // Registered after the mounted product's window capture handlers. Native
    // scrolling changes the real DOM and invalidates tracking first; then a
    // genuine long task delays the very first response beyond its old tail.
    window.addEventListener("scroll", event => {
      const witness = (window as FrameWindow).framePipelineCarry!, eventAt = performance.now();
      const stall: Stall = { eventAt, eventStamp: event.timeStamp, source: node.getBoundingClientRect().top - 3, scroll: scrollY, endedAt: 0 };
      witness.stall = stall;
      while (performance.now() - eventAt < 800) { /* Deliberate finite stress; no fake clock. */ }
      stall.endedAt = performance.now();
    }, { once: true, capture: true, passive: true });
  });
  let proof: Awaited<ReturnType<typeof finishCarry>> | undefined;
  try {
    await page.mouse.wheel(0, 72);
    await expect.poll(() => page.evaluate(() => (window as FrameWindow).framePipelineCarry!.stall?.endedAt ?? 0)).toBeGreaterThan(0);
    await expect.poll(() => anchor.evaluate(node => node.getBoundingClientRect().top)).toBeLessThan(rect.y - 35);
    await expect.poll(() => anchor.evaluate(node => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - node.getBoundingClientRect().top + 3))).toBeLessThan(2);
    await page.waitForTimeout(150);
  } finally { proof = await finishCarry(page, `${surface}-long-frame`); }
  const { frames, stall } = proof!;
  expect(stall).toBeDefined(); expect(stall!.endedAt - stall!.eventAt).toBeGreaterThanOrEqual(700);
  expect(Math.abs(stall!.source - frames[0].source), "the native source was already moved before the blocked response").toBeGreaterThan(2);
  const gap = frames.findIndex((frame, index) => index > 0 && frame.at - frames[index - 1].at >= 700);
  expect(gap, "the recorded browser frames must contain the real stall").toBeGreaterThan(0);
  const changed = frames.find(frame => frame.queuedAt >= stall!.endedAt && Math.abs(frame.sourceAtRAF - frames[0].sourceAtRAF) > 2);
  expect(changed, "the first post-stall DOM batch must contain the native source movement").toBeDefined();
  // Do not discard a mixed first sample and silently use a later passing one.
  expect(changed!.latestSerial).toBe(changed!.rafSerialAtQueue); expect(changed!.scrollAtRead).toBe(changed!.scrollAtRAF);
  expect(Math.abs(changed!.source - changed!.sourceAtRAF)).toBeLessThan(.1); expect(changed!.error).toBeLessThan(3);
  expect(frames.every(frame => !frame.hidden && frame.platform === platform && frame.state !== "jump")).toBe(true);
  await expect(pet(page)).toHaveCount(1); await expect(page.locator(".event-editor-panel.is-edit,.agenda-detail-sheet")).toHaveCount(0);
  await page.screenshot({ path: `${artifactPrefix}-${surface}-long-frame.png` });
});

async function changeGfx(page: Page, mode: "lite" | "max") {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tablist", { name: "설정 묶음", exact: true }).getByRole("tab", { name: "배경", exact: true }).click();
  const ambient = dialog.getByRole("radiogroup", { name: "계절 배경 상태 고르기", exact: true });
  await ambient.getByRole("radio", { name: "켜기", exact: true }).click();
  await dialog.getByRole("button", { name: "배경 효과 품질 고르기", exact: true }).click(); await page.getByRole("option", { name: mode === "max" ? "항상 최대" : "가볍게", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("data-gfx"))).toBe(mode === "max" ? null : mode);
  await dialog.locator(".modal-head .modal-close").click(); await expect(dialog).toHaveCount(0); await expect(actor(page)).toBeVisible();
}
async function pickupAndReturn(page: Page) {
  const target = await actor(page).evaluate(node => {
    const rect = node.getBoundingClientRect();
    for (const fy of [.3, .45, .6]) for (const fx of [.5, .35, .65]) { const point = { x: rect.left + rect.width * fx, y: rect.top + rect.height * fy }, hit = document.elementFromPoint(point.x, point.y); if (hit && (hit === node || node.contains(hit))) return point; }
    return null;
  });
  expect(target, "pickup needs an actual exposed native actor hit").not.toBeNull();
  await actor(page).evaluate(node => node.addEventListener("pointerdown", event => { (node as HTMLElement).dataset.framePipelinePointer = String((event as PointerEvent).pointerId); }, { capture: true, once: true }));
  await page.mouse.move(target!.x, target!.y); await page.mouse.down(); await page.waitForTimeout(430);
  await page.mouse.move(target!.x + 30, target!.y - 20, { steps: 8 }); await expect(pet(page)).toHaveAttribute("data-state", "held");
  expect(await actor(page).evaluate(node => node.hasPointerCapture(Number((node as HTMLElement).dataset.framePipelinePointer)))).toBe(true);
  await expect(pet(page)).toBeVisible(); await page.mouse.up(); await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await openCompanionHome(page); const cushion = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await cushion.focus(); await cushion.press("Enter"); await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect(page.locator(".vc-bed-foreground")).toBeVisible(); await expect(pet(page)).toBeVisible();
}
test("native background full/lite/full choices retain pickup, sofa return and real scroll support", async ({ page }) => {
  test.setTimeout(45000); await setup(page); await extendViewerFlow(page);
  // The shared native picker exposes auto/max/lite. Ambient OFF only locks its
  // displayed label, so it cannot truthfully stand in for a live gfx-off test.
  for (const mode of ["lite", "max"] as const) {
    await changeGfx(page, mode); await pickupAndReturn(page);
    const anchor = await chooseActualCard(page, "viewer"), before = (await anchor.boundingBox())!, platform = await pet(page).getAttribute("data-platform");
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2); await page.mouse.wheel(0, 32);
    await expect.poll(() => anchor.evaluate(node => node.getBoundingClientRect().top)).toBeLessThan(before.y - 15);
    await expect.poll(() => anchor.evaluate(node => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - node.getBoundingClientRect().top + 3))).toBeLessThan(2);
    await expect(pet(page)).toHaveAttribute("data-platform", platform!); await expect(pet(page)).toBeVisible();
  }
  await expect.poll(() => page.evaluate(() => localStorage.getItem("vic.gfxPref"))).toBe("max");
  await page.screenshot({ path: `${artifactPrefix}-native-gfx.png` });
});

const foodPoint = (item: Locator) => item.evaluate(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: matrix.m41, y: matrix.m42 }; });
async function dragFood(page: Page, item: Locator, pointer: Point) {
  const rect = (await item.boundingBox())!, start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(pointer.x, pointer.y, { steps: 8 }); await page.mouse.up();
}
test("eight native snacks keep their tray attachments while a falling snack follows a real house flip to its first floor", async ({ page }) => {
  test.setTimeout(30000); await setup(page); await openCompanionHome(page);
  const feed = home(page).getByRole("button", { name: "밥 꺼내기", exact: true });
  for (let count = 1; count <= MAX_COMPANION_FOOD; count++) { await feed.click(); await expect(food(page)).toHaveCount(count); }
  const ids = await food(page).evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.food!));
  await feed.click(); await expect(food(page)).toHaveCount(MAX_COMPANION_FOOD);
  const offsets = await food(page).evaluateAll(nodes => {
    const tray = document.querySelector(".vc-home .vc-dispenser-slot")!.getBoundingClientRect();
    return nodes.slice(0, -1).map(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { id: (node as HTMLElement).dataset.food!, x: matrix.m41 - tray.left, y: matrix.m42 - tray.top }; });
  });
  await page.evaluate(offsets => {
    const witness = { frames: [] as FoodFrame[], raf: 0, began: performance.now() };
    const sample = (now: number) => {
      const tray = document.querySelector(".vc-home .vc-dispenser-slot")!.getBoundingClientRect(), floor = document.querySelector(".vc-home .vc-home-floor")!.getBoundingClientRect();
      for (const node of document.querySelectorAll<HTMLElement>(".vc-food")) {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform), offset = offsets.find(item => item.id === node.dataset.food);
        witness.frames.push({ at: now - witness.began, id: node.dataset.food!, x: matrix.m41, y: matrix.m42, floor: floor.bottom, trayError: offset ? Math.hypot(matrix.m41 - tray.left - offset.x, matrix.m42 - tray.top - offset.y) : 0, falling: node.hasAttribute("data-falling"), hidden: node.hidden });
      }
      witness.raf = requestAnimationFrame(sample);
    };
    (window as FrameWindow).framePipelineFood = witness; witness.raf = requestAnimationFrame(sample);
  }, offsets);
  const falling = food(page).last(), bed = (await home(page).locator(".vc-cushion-button").boundingBox())!;
  await dragFood(page, falling, { x: bed.x + bed.width / 2, y: bed.y + 3 });
  await expect(falling).toHaveAttribute("data-falling", "");
  await page.getByRole("button", { name: "패널을 오른쪽에 두기", exact: true }).click(); await expect(page.locator(".avatar-right .vc-home")).toBeVisible();
  await expect(falling).not.toHaveAttribute("data-falling", ""); await settled(page);
  const final = await foodPoint(falling), floor = (await home(page).locator(".vc-home-floor").boundingBox())!;
  expect(Math.abs(final.y - (floor.y + floor.height - COMPANION_HOME_FLOOR_INSET))).toBeLessThan(2);
  const frames = await page.evaluate(() => { const witness = (window as FrameWindow).framePipelineFood!; cancelAnimationFrame(witness.raf); return witness.frames; });
  await writeFile(`${artifactPrefix}-eight-foods.json`, JSON.stringify({ ids, offsets, frames, final, floor }, null, 2));
  const fall = frames.filter(frame => frame.id === ids.at(-1) && frame.falling);
  expect(fall.length).toBeGreaterThan(2); expect(fall.some(frame => frame.y < frame.floor - COMPANION_HOME_FLOOR_INSET - 2)).toBe(true);
  const resting = frames.filter(frame => frame.at > frames.at(-1)!.at - 100 && offsets.some(offset => offset.id === frame.id));
  expect(new Set(resting.map(frame => frame.id)).size).toBe(MAX_COMPANION_FOOD - 1); expect(resting.every(frame => !frame.hidden && frame.trayError < 2)).toBe(true);
  expect(await food(page).evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.food))).toEqual(ids);
  await expect(page.locator("[data-export-surface] .vc-food,[data-export-surface] .vc-companion")).toHaveCount(0);
  await page.screenshot({ path: `${artifactPrefix}-eight-foods.png` });
  await home(page).getByRole("button", { name: "음식 버리기", exact: true }).click(); await expect(food(page)).toHaveCount(0);
});

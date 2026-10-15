import { expect, test, type Locator, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { openCompanionHome } from "./helpers/companion-home";
import { expectQuietCompanionTail, waitForOverlayEntrance } from "./helpers/companion-overlay";

type Point = { x: number; y: number };
type Sample = { at: number; x: number; y: number; visible: boolean; state: string | null; platform: string | null; stage: string | null; homeOpacity: number | null; pose: string; inertia: string; facing: string | null; grip: string | null; captured: boolean; corners: Point[]; gripError: number | null };
type ProbeWindow = Window & { contactWorldProbe?: { node: Element; frames: Sample[]; raf: number; pointer: number | null; point?: Point & { at: number }; capture: EventListener; track: EventListener } };
const pet = (page: Page) => page.locator(".vc-companion"), actor = (page: Page) => page.locator(".vc-actor");
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const posts = new WeakMap<Page, string[]>(), errors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
  const attempted: string[] = [], failures: string[] = []; posts.set(page, attempted); errors.set(page, failures);
  page.on("pageerror", error => failures.push(error.message));
  await page.route("**/*", route => {
    if (route.request().method() === "POST") { attempted.push(new URL(route.request().url()).pathname); return route.fulfill({ status: 500, body: "" }); }
    return route.continue();
  });
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});
test.afterEach(async ({ page }) => { expect(posts.get(page)).toEqual([]); expect(errors.get(page)).toEqual([]); });

async function seed(page: Page, sleep = false, roam = false) {
  await page.addInitScript(({ epoch, key, preferences, care }) => {
    localStorage.setItem(key, epoch); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed"); localStorage.setItem("vic_avatar_side", "left");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam, jump: roam, speed: roam ? "lively" : "normal", sleep, heartPrank: false, ambientPrank: false, feeding: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: .9, curiosity: .95 } });
}
async function ready(page: Page, route = "/visual-fixture/poster?avatar=1") {
  await page.goto(route); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
}
async function frame(page: Page) {
  const r = (await pet(page).boundingBox())!; return { x: r.x + r.width / 2, y: r.y + r.height, size: r.width };
}
async function move(page: Page, point: Point, steps = 10) {
  // Native events plus real frames keep the impulse observable.
  await page.mouse.move(point.x, point.y, { steps });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
async function startProbe(page: Page) {
  await pet(page).evaluate(node => {
    const button = node.querySelector<HTMLButtonElement>(".vc-actor")!, began = performance.now();
    const p: NonNullable<ProbeWindow["contactWorldProbe"]> = { node, frames: [], raf: 0, pointer: null, capture: event => { p.pointer = (event as PointerEvent).pointerId; }, track: event => { const pointer = event as PointerEvent; p.point = { x: pointer.clientX, y: pointer.clientY, at: performance.now() }; } };
    button.addEventListener("gotpointercapture", p.capture);
    document.addEventListener("pointermove", p.track, true);
    const sample = () => {
      const r = node.getBoundingClientRect(), style = getComputedStyle(node);
      const selectors = [".vc-pose", ".vc-contact", ".vc-reaction", ".vc-facing", ".vc-inertia"], layers = selectors.map(selector => getComputedStyle(node.querySelector(selector)!));
      // Compose the browser's actual CSS matrices/origins, independently of
      // product motion/bounds helpers. Registration clip is a conservative
      // visible sprite envelope; this is not an alpha-pixel or OBS audit.
      const project = (point: Point, source = layers) => {
        let q = new DOMPoint(point.x, point.y);
        for (const layer of source) {
          const [ox, oy] = layer.transformOrigin.split(" ").map(parseFloat), m = new DOMMatrix(layer.transform === "none" ? undefined : layer.transform);
          q = m.transformPoint(new DOMPoint(q.x - ox, q.y - oy)); q.x += ox; q.y += oy;
        }
        return { x: q.x + r.left, y: q.y + r.top };
      };
      const sprite = getComputedStyle(node.querySelector(".vc-sprite")!), values = sprite.clipPath.startsWith("inset(") ? sprite.clipPath.slice(6, -1).split(" ").map(parseFloat) : [0];
      const [t, rr = t, bb = t, ll = rr] = values, width = r.width, height = r.height;
      const corners = [project({ x: ll, y: t }, [sprite, ...layers]), project({ x: width - rr, y: t }, [sprite, ...layers]), project({ x: ll, y: height - bb }, [sprite, ...layers]), project({ x: width - rr, y: height - bb }, [sprite, ...layers])];
      const captured = p.pointer !== null && button.hasPointerCapture(p.pointer), [gx, gy] = layers.at(-1)!.transformOrigin.split(" ").map(parseFloat);
      const facing = new DOMMatrix(layers[3].transform === "none" ? undefined : layers[3].transform).a < 0;
      const grip = project({ x: facing ? width - gx : gx, y: gy });
      const gripError = captured && p.point && performance.now() - p.point.at > 24 ? Math.hypot(grip.x - p.point.x, grip.y - p.point.y) : null;
      const house = document.querySelector(".vc-home");
      p.frames.push({ at: performance.now() - began, x: r.left + r.width / 2, y: r.bottom, visible: !(node as HTMLElement).hidden && style.display !== "none" && Number(style.opacity) > .01, state: node.getAttribute("data-state"), platform: node.getAttribute("data-platform"), stage: node.getAttribute("data-premiere-companion"), homeOpacity: house ? Number(getComputedStyle(house).opacity) : null, pose: layers[0].transform, inertia: layers.at(-1)!.transform, facing: node.getAttribute("data-facing"), grip: node.getAttribute("data-grip"), captured, corners, gripError });
      p.raf = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).contactWorldProbe = p; p.raf = requestAnimationFrame(sample);
  });
}
async function finishProbe(page: Page, label: string) {
  const result = await page.evaluate(() => { const p = (window as ProbeWindow).contactWorldProbe!; cancelAnimationFrame(p.raf); p.node.querySelector(".vc-actor")!.removeEventListener("gotpointercapture", p.capture); document.removeEventListener("pointermove", p.track, true); return { sameDom: p.node === document.querySelector(".vc-companion"), frames: p.frames }; });
  expect(result.sameDom).toBe(true); await writeFile(`.scratch-pw/companion-062-${label}.json`, JSON.stringify(result, null, 2)); return result.frames;
}
async function nativeGrip(page: Page, kind: "left-ear" | "right-ear" | "body") {
  const point = await pet(page).evaluate((node, kind) => {
    const r = node.getBoundingClientRect(), button = node.querySelector(".vc-actor");
    const xs = kind === "left-ear" ? [.33, .36, .40] : kind === "right-ear" ? [.67, .64, .60] : [.5];
    for (const fy of kind === "body" ? [.62, .7] : [.29, .32, .34]) for (const fx of xs) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy;
      if (document.elementFromPoint(x, y)?.closest(".vc-actor") === button) return { x, y, localX: r.width * fx, localY: r.height * fy };
    }
    return null;
  }, kind);
  expect(point, `${kind} must have a genuine native point on the rendered actor`).not.toBeNull(); return point!;
}
async function dragFeet(page: Page, destination: Point) {
  const startFrame = await frame(page), grip = await nativeGrip(page, "body");
  await page.mouse.move(grip.x, grip.y); await page.mouse.down();
  await move(page, { x: destination.x + grip.x - startFrame.x, y: destination.y + grip.y - startFrame.y });
  await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.mouse.up();
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect(pet(page)).toBeVisible();
}
async function clickExposed(page: Page, button: Locator) {
  const point = await button.evaluate(node => {
    const r = node.getBoundingClientRect();
    for (const fy of [.2, .8, .5]) for (const fx of [.2, .8, .1, .9, .5]) {
      const x = r.left + r.width * fx, y = r.top + r.height * fy, hit = document.elementFromPoint(x, y);
      if (hit && node.contains(hit)) return { x, y };
    }
    return null;
  });
  expect(point, "the actual cushion must retain a native exposed control point").not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
}

test.describe("real pointer contact and world transitions", () => {
  test.use({ viewport: { width: 1920, height: 1100 } });
  test("left ear, right ear and body keep native capture with distinct hanging responses through reversal", async ({ page }) => {
    await seed(page); await ready(page); await dragFeet(page, { x: 1220, y: 480 });
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    const poses: string[] = [];
    for (const kind of ["left-ear", "right-ear", "body"] as const) {
      const grip = await nativeGrip(page, kind); await startProbe(page); await page.mouse.move(grip.x, grip.y); await page.mouse.down();
      for (const offset of [10, 55, 110, 60, 0, -65]) await move(page, { x: grip.x + offset, y: grip.y - 60 });
      await expect(pet(page)).toHaveAttribute("data-state", "held"); await expect(pet(page)).toHaveAttribute("data-grip", kind);
      const origins = await pet(page).evaluate(node => ({ inertia: (node.querySelector(".vc-inertia") as HTMLElement).style.transformOrigin, pose: (node.querySelector(".vc-pose") as HTMLElement).style.transformOrigin }));
      const [gx, gy] = origins.inertia.split(" ").map(parseFloat); expect(gx).toBeCloseTo(grip.localX, 1); expect(gy).toBeCloseTo(grip.localY, 1);
      poses.push(origins.pose); await page.screenshot({ path: `.scratch-pw/companion-062-grip-${kind}.png` });
      const samples = (await finishProbe(page, `grip-${kind}`)).filter(f => f.state === "held");
      expect(samples.length).toBeGreaterThan(5); expect(samples.every(f => f.visible && f.captured)).toBe(true);
      expect(new Set(samples.map(f => f.pose)).size).toBeGreaterThan(2); expect(new Set(samples.map(f => f.inertia)).size).toBeGreaterThan(2);
      const stable = samples.filter(f => f.gripError !== null); expect(stable.length).toBeGreaterThan(2); expect(Math.max(...stable.map(f => f.gripError!))).toBeLessThan(2);
      for (const corner of samples.flatMap(f => f.corners)) { expect(corner.x).toBeGreaterThanOrEqual(1); expect(corner.x).toBeLessThanOrEqual(1919); expect(corner.y).toBeGreaterThanOrEqual(1); expect(corner.y).toBeLessThanOrEqual(1099); }
      expect(new Set(samples.map(f => f.facing)).size).toBe(1);
      await page.mouse.up(); await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    }
    expect(new Set(poses).size).toBe(3);
  });

  test("deliberate inner and outer sofa drops settle into the real seat or floor; a modal preserves the sleeping sofa layers", async ({ page }) => {
    await seed(page, true); await ready(page); await openCompanionHome(page);
    const bed = home(page).locator(".vc-plush-bed"), cushion = home(page).locator(".vc-home-cushion");
    const b = (await bed.boundingBox())!, c = (await cushion.boundingBox())!;
    await startProbe(page); await dragFeet(page, { x: b.x + b.width * .5, y: c.y - 12 });
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 3000 });
    const seatFrames = await finishProbe(page, "sofa-inner"); expect(seatFrames.filter(f => f.state === "jump").length).toBeGreaterThan(3);
    const body = (await actor(page).boundingBox())!; expect(body.x).toBeGreaterThanOrEqual(b.x + 1); expect(body.x + body.width).toBeLessThanOrEqual(b.x + b.width - 1);
    await dragFeet(page, { x: b.x + b.width * .5, y: b.y + b.height - 2 });
    await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/, { timeout: 3000 });
    const floor = (await home(page).locator(".vc-home-floor").boundingBox())!; expect(Math.abs((await frame(page)).y - (floor.y + floor.height - COMPANION_HOME_FLOOR_INSET))).toBeLessThan(2);
    await clickExposed(page, home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }));
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).toHaveAttribute("data-state", "sleep");
    const initial = await frame(page), initialBed = (await bed.boundingBox())!;
    await page.getByRole("button", { name: "설정", exact: true }).click(); const modal = page.locator(".vic-settings .modal-card"); await waitForOverlayEntrance(modal);
    await expect(pet(page)).toBeVisible(); await expect(page.locator(".vc-bed-foreground")).toBeVisible();
    const layers = await page.evaluate(() => { const pet = document.querySelector(".vc-companion")!, front = document.querySelector(".vc-bed-foreground")!, backdrop = document.querySelector(".vic-settings")!; return { pet: Number(getComputedStyle(pet).zIndex), front: Number(getComputedStyle(front).zIndex), backdrop: Number(getComputedStyle(backdrop).zIndex) }; });
    expect(layers.front).toBeGreaterThan(layers.pet); expect(layers.front).toBeLessThan(layers.backdrop);
    await page.screenshot({ path: ".scratch-pw/companion-062-sofa-modal.png" });
    await page.locator(".vic-settings .modal-head .modal-close").click(); await expect(modal).toHaveCount(0);
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
    const final = await frame(page), finalBed = (await bed.boundingBox())!;
    expect(Math.abs((final.x - finalBed.x) - (initial.x - initialBed.x))).toBeLessThan(2); expect(Math.abs((final.y - finalBed.y) - (initial.y - initialBed.y))).toBeLessThan(2);
  });

  test("dragging an ordinary detail toward the quiet companion makes only a nearby finite relocation", async ({ page }) => {
    test.setTimeout(35_000); await seed(page); await ready(page);
    const card = page.locator(".public-event:not(.teaser):not(.dimmed)").filter({ visible: true }).first(); await card.click();
    const detail = page.locator(".agenda-detail-sheet"); await waitForOverlayEntrance(detail); await expect(pet(page)).toBeVisible();
    const h = detail.locator(".detail-grab");
    const reposition = async (dx: number, dy: number) => { const r = (await h.boundingBox())!; await page.mouse.move(r.x + r.width * .5, r.y + r.height * .5); await page.mouse.down(); await page.mouse.move(r.x + r.width * .5 + dx, r.y + r.height * .5 + dy, { steps: 12 }); await page.mouse.up(); await waitForOverlayEntrance(detail); };
    const p = (await actor(page).boundingBox())!, d = (await detail.boundingBox())!;
    const placeLeft = p.x > d.width + 30, targetLeft = placeLeft ? p.x - d.width - 12 : p.x + p.width + 12;
    await reposition(targetLeft - d.x, Math.max(12, Math.min(1088 - d.height, p.y + p.height / 2 - d.height / 2)) - d.y);
    const before = await frame(page); await startProbe(page); await reposition(placeLeft ? 60 : -60, 0);
    const close = detail.locator(".agenda-detail-close"); await close.focus(); await expectQuietCompanionTail(page, close);
    const samples = await finishProbe(page, "detail-nearby"), after = await frame(page);
    expect(samples.every(f => f.visible)).toBe(true); expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
    expect(Math.max(...samples.map(f => Math.hypot(f.x - before.x, f.y - before.y)))).toBeLessThan(200);
    await page.screenshot({ path: ".scratch-pw/companion-062-detail-relocation.png" });
  });

  test("a sleeping home resident wakes and hops off before the home exits, then uses the existing73second handoff", async ({ page }) => {
    test.setTimeout(40_000); await seed(page, true, true); await ready(page, "/visual-fixture/poster?avatar=1&premiere=175&count=1"); await openCompanionHome(page);
    await home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).click();
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).toHaveAttribute("data-state", "sleep");
    await startProbe(page); await expect(pet(page)).toHaveAttribute("data-state", "wake", { timeout: 9000 });
    await expect(pet(page)).toHaveAttribute("data-state", "jump", { timeout: 2000 }); await expect(pet(page)).not.toHaveAttribute("data-platform", "companion-home", { timeout: 2000 });
    const landedAt = await page.evaluate(() => (window as ProbeWindow).contactWorldProbe!.frames.at(-1)!.at);
    await expect.poll(() => page.evaluate(at => (window as ProbeWindow).contactWorldProbe!.frames.some(f => f.at > at + 200 && ["walk", "jump"].includes(f.state ?? "") && f.stage === "prelude"), landedAt), { timeout: 6500 }).toBe(true);
    const frames = await finishProbe(page, "home-premiere-departure"), hop = frames.filter(f => f.state === "jump" && f.at <= landedAt);
    expect(hop.length).toBeGreaterThan(8); expect(Math.max(...hop.map(f => f.y)) - Math.min(...hop.map(f => f.y))).toBeGreaterThan(8);
    expect(hop.every(f => f.visible)).toBe(true);
    const firstAway = frames.find(f => f.platform && f.platform !== "companion-home"); expect(firstAway).toBeDefined(); expect(firstAway!.homeOpacity).toBeGreaterThan(.05);
    // A second real-time fixture checks the existing deadline; it does not
    // pretend this short run observed all95 intervening seconds.
    await ready(page, "/visual-fixture/poster?avatar=1&premiere=76&count=1");
    await expect(pet(page)).toHaveAttribute("data-premiere-companion", "enter", { timeout: 5500 }); await expect(pet(page)).toBeVisible();
    await expect(pet(page)).toHaveAttribute("data-premiere-companion", "joined", { timeout: 5500 }); await expect(page.locator(".pm-fan[data-companion-joined]")).toHaveCount(1);
    await page.screenshot({ path: ".scratch-pw/companion-062-premiere-joined.png" });
  });
});

test.describe("native390 right rail", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("viewer and studio house launchers sit below their actual record and editor controls", async ({ page }) => {
    await seed(page);
    for (const studio of [false, true]) {
      await page.goto(studio ? "/visual-fixture/studio" : "/visual-fixture/poster"); await page.evaluate(() => document.fonts.ready);
      const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true }); await expect(launcher).toBeVisible();
      await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))); });
      const rail = page.locator(studio ? ".agenda-rail" : ".agenda-legend-rail"), controls = rail.locator(studio ? ".m-rail-insights" : ".agenda-legend-insights,.agenda-legend-nav button,.agenda-legend-nav a");
      expect(await controls.count()).toBeGreaterThan(0);
      const l = (await launcher.boundingBox())!, r = (await rail.boundingBox())!, bottom = Math.max(...await Promise.all((await controls.all()).map(async node => { const b = (await node.boundingBox())!; return b.y + b.height; })));
      expect(l.y).toBeGreaterThanOrEqual(bottom + 3); expect(l.x).toBeGreaterThanOrEqual(r.x - 1); expect(l.x + l.width).toBeLessThanOrEqual(r.x + r.width + 1); expect(l.y + l.height).toBeLessThanOrEqual(844 - 8);
      expect(await launcher.evaluate(node => { const r = node.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest(".vc-home-launcher") === node; })).toBe(true);
      await openCompanionHome(page, "touch"); await expect(home(page)).toHaveCount(1);
      await page.screenshot({ path: `.scratch-pw/companion-062-native-launcher-${studio ? "studio" : "viewer"}.png` });
    }
  });
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Point = { x: number; y: number };
type Frame = Point & { at: number; state: string; attention: string; intent: string; facing: string; foods: string[]; mood: string; pose: string; source: string; spriteTransform: string; spriteClip: string };
type TextureSnapshot = { at: number; attention: string; state: string; pose: string; source: string; pet: { x: number; y: number; width: number; height: number }; chain: { name: string; display: string; visibility: string; opacity: string; transform: string; clip: string; overflow: string; texture: string; position: string; size: string; box: { x: number; y: number; width: number; height: number } }[]; resources: { name: string; responseEnd: number; transferSize: number; decodedBodySize: number }[] };
type TextureCapture = { label: string; before: TextureSnapshot; after: TextureSnapshot; warmPixels: number; image: string };
type Witness = { frames: Frame[]; raf: number; stopped: boolean; captures: TextureCapture[] };
type ObservationWindow = Window & { companionDeliberationWitness?: Witness };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const foods = (page: Page) => page.locator(".vc-food");
const prefix = ".scratch-pw/companion-deliberation";
const proof = new WeakMap<Page, { writes: string[]; errors: string[] }>();

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const result = { writes: [] as string[], errors: [] as string[] }; proof.set(page, result);
  page.on("pageerror", error => result.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const preview = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/visual-fixture/studio" && preview.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { result.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 500, body: "blocked fixture mutation" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const observation = await page.evaluate(() => {
    const witness = (window as ObservationWindow).companionDeliberationWitness;
    if (!witness) return null;
    witness.stopped = true; cancelAnimationFrame(witness.raf);
    return { frames: witness.frames, captures: witness.captures };
  });
  await writeFile(`${prefix}-${info.title.replace(/[^a-z0-9]+/gi, "-")}.json`, JSON.stringify({ ...proof.get(page), observation: observation?.frames, captures: observation?.captures }, null, 2));
  expect(proof.get(page)).toEqual({ writes: [], errors: [] });
});

async function setup(page: Page, surface: Surface, reduced = false) {
  await page.addInitScript(({ epoch, key, preferences, care, reduced }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.reduceMotion": reduced ? "on" : "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    // Select the authored stationary idle before an offered snack exists.
    // Geometry, goal planning, care, input and the monotonic clock remain real.
    Math.random = () => 0;
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, reduced,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: true, jump: false, sleep: false, feeding: true, heartPrank: false, ambientPrank: false, panelPrank: false, animalMode: "default", speed: "lively" },
    care: { ...DEFAULT_COMPANION_CARE, hunger: .8, energy: 1 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible(); await openCompanionHome(page, "keyboard");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await page.waitForTimeout(180); // Existing finite120ms geometry delivery.
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
}

/** Find the real clear floor against rendered text/control rectangles. This
 * avoids assuming that a viewport floor can pass through the fixture's home,
 * footer or an editing control. No product graph or extra ledge is injected. */
async function corridor(page: Page) {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".poster-page,.studio-shell") ?? document.body;
    let y = innerHeight - 18;
    const styles = new Map<Element, CSSStyleDeclaration>();
    const css = (node: Element) => { const value = styles.get(node) ?? getComputedStyle(node); styles.set(node, value); return value; };
    const visible = (node: Element | null): boolean => !node || !node.hasAttribute("hidden") && css(node).display !== "none" && !["hidden", "collapse"].includes(css(node).visibility) && Number(css(node).opacity || 1) > .05 && visible(node.parentElement);
    for (const bar of root.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const rect = bar.getBoundingClientRect();
      if (visible(bar) && css(bar).position === "fixed" && rect.width > 0 && rect.height > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) y = Math.min(y, rect.top - 8);
    }
    const obstacles: { left: number; right: number; top: number; bottom: number }[] = [];
    const add = (rect: DOMRect, parent: Element | null) => {
      const clip = { left: Math.max(0, rect.left), right: Math.min(innerWidth, rect.right), top: Math.max(0, rect.top), bottom: Math.min(innerHeight, rect.bottom) };
      for (let node = parent; node; node = node.parentElement) {
        const style = css(node), x = /^(auto|scroll|hidden|clip)$/.test(style.overflowX), vertical = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
        if (!x && !vertical) continue;
        const bounds = node.getBoundingClientRect();
        if (x) { clip.left = Math.max(clip.left, bounds.left); clip.right = Math.min(clip.right, bounds.right); }
        if (vertical) { clip.top = Math.max(clip.top, bounds.top); clip.bottom = Math.min(clip.bottom, bounds.bottom); }
      }
      if (clip.right > clip.left && clip.bottom > clip.top) obstacles.push(clip);
    };
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), range = document.createRange();
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const parent = node.parentElement;
      if (!parent || !visible(parent) || parent.closest("script,style,svg,.sr-only,.vc-companion")) continue;
      range.selectNodeContents(node); for (const rect of range.getClientRects()) add(rect, parent);
    }
    range.detach();
    const controls = new Set(root.querySelectorAll<HTMLElement>("button,a[href],input,select,textarea,[role='button']"));
    for (const node of document.querySelectorAll<HTMLElement>(".vc-home,.vc-home-launcher")) controls.add(node);
    for (const node of controls) if (visible(node) && !node.matches(".public-event,.agenda-event,.agenda-item,.public-day,.agenda-day") && !node.closest(".vc-companion")) add(node.getBoundingClientRect(), node.parentElement);
    const spans: { left: number; right: number }[] = []; let start: number | undefined;
    for (let x = 52; x <= innerWidth - 52; x++) {
      const clear = obstacles.every(rect => x + 50 <= rect.left || x - 50 >= rect.right || y + 4 <= rect.top || y - 96 >= rect.bottom);
      if (clear && start === undefined) start = x;
      if ((!clear || x === innerWidth - 52) && start !== undefined) { spans.push({ left: start, right: clear ? x : x - 1 }); start = undefined; }
    }
    return { y, span: spans.sort((a, b) => b.right - b.left - (a.right - a.left))[0] };
  });
}

const point = (item: Locator) => item.evaluate(node => {
  if (node.matches(".vc-companion")) { const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.bottom }; }
  const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: matrix.m41, y: matrix.m42 };
});
async function place(page: Page, at: Point) {
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(at.x, at.y); await page.mouse.move(4, 4);
  await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await expect.poll(async () => { const actual = await point(pet(page)); return Math.hypot(actual.x - at.x, actual.y - at.y); }).toBeLessThan(2);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
}
async function startOnFloor(page: Page) {
  const floor = await corridor(page);
  expect(floor.span, "fixture needs a real clear floor corridor").toBeDefined();
  if (!floor.span) throw new Error("No real clear floor corridor");
  expect(floor.span.right - floor.span.left).toBeGreaterThan(480);
  const start = { x: floor.span.left + 12, y: floor.y }, target = { x: start.x + 440, y: floor.y };
  await place(page, start); return { start, target };
}
async function grabFood(page: Page, item: Locator) {
  const rect = (await item.boundingBox())!, at = await point(item), centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(centre.x, centre.y); await page.mouse.down();
  return { x: centre.x - at.x, y: centre.y - at.y };
}
async function moveFood(page: Page, at: Point, offset: Point) { await page.mouse.move(at.x + offset.x, at.y + offset.y, { steps: 12 }); }
async function offer(page: Page, at: Point) {
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(foods(page)).toHaveCount(1);
  const item = foods(page).first(), offset = await grabFood(page, item);
  await moveFood(page, at, offset); await page.mouse.up(); await page.mouse.move(4, 4);
  // Return immediately after the native release. Waiting for assertions here
  // would consume the short inspection that the caller must actually see.
  return item;
}
async function observe(page: Page) {
  await page.evaluate(() => {
    const node = document.querySelector<HTMLElement>(".vc-companion")!, sprite = node.querySelector<HTMLElement>(".vc-sprite")!, witness: Witness = { frames: [], raf: 0, stopped: false, captures: [] };
    const sample = () => {
      if (witness.stopped) return;
      const rect = node.getBoundingClientRect();
      const texture = sprite.querySelector<HTMLImageElement>(".vc-texture");
      witness.frames.push({ at: performance.now(), x: rect.left + rect.width / 2, y: rect.bottom, state: node.dataset.state ?? "", attention: node.dataset.attention ?? "", intent: node.dataset.intent ?? "", facing: node.dataset.facing ?? "", mood: node.dataset.mood ?? "", foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(food => food.dataset.food!), pose: node.dataset.pose ?? "", source: texture?.currentSrc || texture?.src || "", spriteTransform: sprite.style.transform, spriteClip: sprite.style.clipPath });
      if (witness.frames.length < 1800) witness.raf = requestAnimationFrame(sample);
    };
    (window as ObservationWindow).companionDeliberationWitness = witness; witness.raf = requestAnimationFrame(sample);
  });
}
async function frames(page: Page) { return page.evaluate(() => (window as ObservationWindow).companionDeliberationWitness!.frames); }
function entries(samples: Frame[], attention: string) { return samples.filter((sample, index) => sample.attention === attention && samples[index - 1]?.attention !== attention); }

async function textureSnapshot(page: Page): Promise<TextureSnapshot> {
  return page.evaluate(() => {
    const node = document.querySelector<HTMLElement>(".vc-companion")!, sprite = node.querySelector<HTMLElement>(".vc-sprite")!, texture = sprite.querySelector<HTMLImageElement>(".vc-texture"), pet = node.getBoundingClientRect();
    const chain: TextureSnapshot["chain"] = [];
    // Heavy computed-style/layout diagnostics occur at the screenshot boundary
    // only. They never preload a source or run in the production renderer.
    for (let layer: HTMLElement | null = texture ?? sprite; layer; layer = layer.parentElement) {
      const css = getComputedStyle(layer), box = layer.getBoundingClientRect();
      chain.push({ name: `${layer.tagName}.${layer.className}`, display: css.display, visibility: css.visibility, opacity: css.opacity, transform: css.transform, clip: css.clipPath, overflow: css.overflow, texture: layer instanceof HTMLImageElement ? layer.currentSrc || layer.src : "", position: css.objectPosition, size: layer instanceof HTMLImageElement ? `${layer.naturalWidth}x${layer.naturalHeight}` : "", box: { x: box.x, y: box.y, width: box.width, height: box.height } });
    }
    const source = texture?.currentSrc || texture?.src || "", resources = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter(entry => source.includes(entry.name) || source.includes(new URL(entry.name).pathname)).map(entry => ({ name: entry.name, responseEnd: entry.responseEnd, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize }));
    return { at: performance.now(), attention: node.dataset.attention ?? "", state: node.dataset.state ?? "", pose: node.dataset.pose ?? "", source, pet: { x: pet.x, y: pet.y, width: pet.width, height: pet.height }, chain, resources };
  });
}

async function captureTexture(page: Page, label: string) {
  const before = await textureSnapshot(page), viewport = page.viewportSize()!;
  const x = Math.max(0, Math.floor(before.pet.x) - 2), y = Math.max(0, Math.floor(before.pet.y) - 2);
  const clip = { x, y, width: Math.min(viewport.width - x, Math.ceil(before.pet.width) + 4), height: Math.min(viewport.height - y, Math.ceil(before.pet.height) + 4) };
  const image = `${prefix}-${label}-native.png`, buffer = await page.screenshot({ path: image, clip }), after = await textureSnapshot(page);
  // Decode the actual browser screenshot, never a recreated DOM illustration.
  // The independently proved clear floor has no warm ink. Orange ear/cheek
  // pixels distinguish the real mascot from its shadow and an empty actor box.
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let warmPixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) if (data[offset] > 160 && data[offset + 1] > 75 && data[offset + 2] < 160 && data[offset] - data[offset + 1] > 20 && data[offset] - data[offset + 2] > 45) warmPixels++;
  await page.evaluate(capture => { (window as ObservationWindow).companionDeliberationWitness!.captures.push(capture); }, { label, before, after, warmPixels, image });
  expect(warmPixels, "the native screenshot must contain the actual orange mascot texture, not only its shadow").toBeGreaterThan(20);
}

for (const surface of ["viewer", "studio"] as const) {
  test(`${surface} inspects one offered snack then pursues that same real meal`, async ({ page }) => {
    test.setTimeout(30000); await setup(page, surface); const { start, target } = await startOnFloor(page);
    await observe(page); const item = await offer(page, target), id = await item.getAttribute("data-food");
    await expect.poll(() => pet(page).getAttribute("data-attention"), { intervals: [16], timeout: 5000 }).toBe("inspect");
    await expect(pet(page)).toHaveAttribute("data-intent", "feed");
    await captureTexture(page, `${surface}-inspect`);
    await expect(pet(page)).toHaveAttribute("data-facing", "right");
    await expect(pet(page)).toHaveAttribute("data-state", "walk", { timeout: 2500 });
    await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 12000 });
    const arrived = await point(pet(page)); expect(Math.abs(arrived.x - target.x)).toBeLessThanOrEqual(36); expect(Math.abs(arrived.y - target.y)).toBeLessThan(2);
    const observed = await frames(page), inspection = observed.filter(sample => sample.attention === "inspect");
    expect(entries(observed, "inspect")).toHaveLength(1); expect(inspection.length).toBeGreaterThan(5);
    expect(inspection.every(sample => sample.state === "look" && sample.intent === "feed" && sample.foods.length === 1 && sample.foods[0] === id)).toBe(true);
    expect(Math.max(...inspection.map(sample => Math.hypot(sample.x - start.x, sample.y - start.y)))).toBeLessThan(2);
    expect(observed.findIndex(sample => sample.attention === "inspect")).toBeLessThan(observed.findIndex(sample => sample.state === "walk"));
    expect(entries(observed, "reconsider")).toHaveLength(0);
    await page.screenshot({ path: `${prefix}-${surface}-meal.png` });
    await expect(foods(page)).toHaveCount(0, { timeout: 6000 });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger as number)).toBeLessThan(.5);
    if (surface === "viewer") expect(await page.locator("[data-export-surface]").evaluate(node => getComputedStyle(node).width)).toBe("1840px");
  });

  test(`${surface} holds preserve the food goal while actual deletion causes one finite reconsideration`, async ({ page }) => {
    test.setTimeout(30000); await setup(page, surface); const { target } = await startOnFloor(page);
    await observe(page); const item = await offer(page, target), id = await item.getAttribute("data-food");
    await expect(pet(page)).toHaveAttribute("data-state", "walk", { timeout: 5000 });
    const offset = await grabFood(page, item); await moveFood(page, { x: target.x, y: target.y - 12 }, offset);
    await expect(pet(page)).not.toHaveAttribute("data-state", "walk"); await page.waitForTimeout(1000);
    await expect(item).toHaveAttribute("data-food", id!); await expect(pet(page)).not.toHaveAttribute("data-mood", /disappointed|sulky/);
    expect(entries(await frames(page), "reconsider")).toHaveLength(0);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger as number)).toBeGreaterThan(.75);
    await moveFood(page, target, offset); await page.mouse.up(); await page.mouse.move(4, 4);
    await expect(pet(page)).toHaveAttribute("data-state", "walk", { timeout: 5000 });
    // The real supported keyboard deletion is distinct from temporarily
    // holding the same local source. No DOM removal or brain state injection.
    await item.focus(); await item.press("Delete"); await expect(foods(page)).toHaveCount(0);
    await expect(pet(page)).toHaveAttribute("data-attention", "reconsider", { timeout: 2500 });
    await page.screenshot({ path: `${prefix}-${surface}-reconsider.png` });
    await expect(pet(page)).not.toHaveAttribute("data-attention", "reconsider", { timeout: 1600 });
    await page.waitForTimeout(1300);
    const observed = await frames(page), reconsider = observed.filter(sample => sample.attention === "reconsider");
    expect(entries(observed, "reconsider")).toHaveLength(1); expect(reconsider.length).toBeGreaterThan(8);
    expect(reconsider.at(-1)!.at - reconsider[0].at).toBeGreaterThan(250);
    expect(reconsider.at(-1)!.at - reconsider[0].at).toBeLessThan(800);
    expect(observed.some(sample => sample.state === "eat")).toBe(false);
  });
}

test("viewer native pickup immediately interrupts an inspection without consuming its snack", async ({ page }) => {
  await setup(page, "viewer"); const { target } = await startOnFloor(page);
  await observe(page); await offer(page, target);
  await expect.poll(() => pet(page).getAttribute("data-attention"), { intervals: [16], timeout: 5000 }).toBe("inspect");
  const rect = (await actor(page).boundingBox())!, from = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(from.x + 24, from.y - 24, { steps: 3 });
  await expect(pet(page)).toHaveAttribute("data-state", "held", { timeout: 400 });
  await expect(pet(page)).not.toHaveAttribute("data-attention"); await page.waitForTimeout(300);
  await expect(pet(page)).toHaveAttribute("data-state", "held"); await expect(foods(page)).toHaveCount(1);
  await page.screenshot({ path: `${prefix}-viewer-interrupted.png` });
  await page.mouse.up(); await page.mouse.move(4, 4);
  expect((await frames(page)).some(sample => sample.state === "held" && sample.attention === "")).toBe(true);
});

test("studio reduced motion skips attention movement and only eats a nearby offered snack", async ({ page }) => {
  await setup(page, "studio", true); const { start, target } = await startOnFloor(page);
  await observe(page); const item = await offer(page, target); await page.waitForTimeout(1200);
  expect((await frames(page)).every(sample => sample.attention === "" && sample.state !== "walk" && sample.state !== "eat")).toBe(true);
  const offset = await grabFood(page, item); await moveFood(page, { x: start.x + 20, y: start.y }, offset); await page.mouse.up(); await page.mouse.move(4, 4);
  await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 5000 });
  await expect(foods(page)).toHaveCount(0, { timeout: 6000 });
  expect((await frames(page)).every(sample => sample.attention === "" && sample.state !== "walk")).toBe(true);
});

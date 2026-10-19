import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { companionSofaSeat } from "@/lib/ui/viewer-companion/sofa";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const out = process.env.COMPANION_HOME_LAYOUT_OUTPUT ?? ".scratch-pw/companion-124/layout";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const actions = ["book", "radio", "home", "toys", "feed", "clearFood"] as const;
const proofs = new WeakMap<Page, { writes: string[]; foreign: string[]; errors: string[] }>();

test.use({ serviceWorkers: "block" });
test.setTimeout(90000);
test.beforeEach(async ({ page }) => {
  const proof = { writes: [] as string[], foreign: [] as string[], errors: [] as string[] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live API in fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }) => {
  const proof = proofs.get(page)!;
  expect(proof.writes).toEqual([]); expect(proof.foreign).toEqual([]); expect(proof.errors).toEqual([]);
});

async function fixture(page: Page, surface: "viewer" | "studio", dark: boolean, quiet = false) {
  await page.addInitScript(({ preferences, epoch, epochKey, dark, quiet }) => {
    for (const [key, value] of Object.entries({
      [epochKey]: epoch,
      "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, roam: false, sleep: false, sound: false }),
      "vic.gfx": JSON.stringify({ mode: quiet ? "off" : "full", at: Date.now(), v: 3 }), "vic.gfxPref": quiet ? "off" : "max",
      "vic.reduceMotion": quiet ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": dark ? "on" : "off", "vic_avatar_side": "left",
    })) localStorage.setItem(key, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, dark, quiet });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1&ambient=spring"
    : "/visual-fixture/studio?role=owner&y=2025&m=4&ambient=spring&hour=12&weather=clear");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => await page.getByRole("region", { name: "빅타민 집", exact: true }).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  const room = await openCompanionHome(page);
  await expect.poll(() => room.evaluate(node => {
    for (let parent: Element | null = node; parent; parent = parent.parentElement)
      if (parent.getAnimations().some(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime)))) return false;
    return true;
  })).toBe(true);
  await room.locator("img").evaluateAll(nodes => Promise.all(nodes.map(node => (node as HTMLImageElement).decode())));
  await page.mouse.move(2, 2);
  return room;
}

async function measure(page: Page) {
  return page.locator(".vc-home-room").evaluate(async room => {
    const rect = (node: Element) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const box = (selector: string) => rect(room.querySelector(selector)!);
    const controls = [...room.querySelectorAll<HTMLButtonElement>("button[data-home-action]")].map(node => {
      const r = node.getBoundingClientRect();
      const points = [[r.x + 3, r.y + r.height / 2], [r.right - 3, r.y + r.height / 2], [r.x + r.width / 2, r.y + 3], [r.x + r.width / 2, r.bottom - 3], [r.x + r.width / 2, r.y + r.height / 2]];
      return { action: node.dataset.homeAction!, ...rect(node), hit: points.every(([x, y]) => { const hit = document.elementFromPoint(x, y); return hit === node || node.contains(hit); }) };
    });
    const pictures = [...room.querySelectorAll<HTMLImageElement>(".vc-home-object-image")].map(image => {
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1, alphaPixels = 0;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (rgba[(y * canvas.width + x) * 4 + 3] > 32) {
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); alphaPixels++;
      }
      const r = image.getBoundingClientRect(), scale = Math.min(r.width / canvas.width, r.height / canvas.height);
      const content = { x: r.x + (r.width - canvas.width * scale) / 2, y: r.bottom - canvas.height * scale, scale };
      return { action: image.closest<HTMLButtonElement>("button")!.dataset.homeAction!, src: image.getAttribute("src"), naturalWidth: canvas.width, naturalHeight: canvas.height,
        fit: getComputedStyle(image).objectFit, ...rect(image), content, alphaPixels, mass: alphaPixels * scale * scale,
        visible: { x: content.x + x0 * scale, y: content.y + y0 * scale, right: content.x + (x1 + 1) * scale, bottom: content.y + (y1 + 1) * scale } };
    });
    const svg = room.querySelector<SVGSVGElement>(".vc-plush-bed")!, svgRect = svg.getBoundingClientRect(), glass = box(".vc-window-glass");
    // Rasterize the actual unchanged sofa paths with their resolved styles.
    // A button rectangle alone misses the SVG's upward aspect-ratio overflow.
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const originals = [svg, ...svg.querySelectorAll("*")], copies = [clone, ...clone.querySelectorAll("*")];
    originals.forEach((node, index) => {
      const css = getComputedStyle(node), copy = copies[index] as SVGElement;
      for (const property of ["fill", "stroke", "stroke-width", "stroke-linecap", "opacity", "stop-color", "stop-opacity"]) {
        copy.style.setProperty(property, css.getPropertyValue(property).replace(/url\(["']?[^)]*#([^"')]+)["']?\)/g, "url(#$1)"));
      }
    });
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const raster = new Image(); raster.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(clone)); await raster.decode();
    const canvas = document.createElement("canvas"), density = 4;
    canvas.width = Math.ceil(svgRect.width * density); canvas.height = Math.ceil(svgRect.height * density);
    const context = canvas.getContext("2d")!; context.drawImage(raster, 0, 0, svgRect.width * density, svgRect.height * density);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let glassOverlapSamples = 0, opaqueSamples = 0, x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (rgba[(y * canvas.width + x) * 4 + 3] > 32) {
      opaqueSamples++;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
      const px = svgRect.x + (x + .5) / density, py = svgRect.y + (y + .5) / density;
      if (px >= glass.x && px < glass.right && py >= glass.y && py < glass.bottom) glassOverlapSamples++;
    }
    const sofaHit = room.querySelector("[data-home-action='home']")!, opaqueHitPoints: { x: number; y: number; hit: boolean }[] = [];
    // Include the first opaque back-rim row, not only the button's center.
    for (let strip = 0; strip < 8; strip++) {
      const y = Math.min(y1, Math.round(y0 + 1 + (y1 - y0 - 2) * strip / 7));
      let left = canvas.width, right = -1;
      for (let x = 0; x < canvas.width; x++) if (rgba[(y * canvas.width + x) * 4 + 3] > 128) { left = Math.min(left, x); right = Math.max(right, x); }
      if (right < left) continue;
      for (const x of [left, (left + right) / 2, right]) {
        const px = svgRect.x + (x + .5) / density, py = svgRect.y + (y + .5) / density, hit = document.elementFromPoint(px, py);
        opaqueHitPoints.push({ x: px, y: py, hit: hit === sofaHit || sofaHit.contains(hit) });
      }
    }
    return { room: rect(room), cssWidth: parseFloat(getComputedStyle(room).width), cssHeight: parseFloat(getComputedStyle(room).height),
      scale: svgRect.width / parseFloat(getComputedStyle(svg).width), window: box(".vc-home-window"), glass, shelf: box(".vc-home-shelf"), sofa: rect(svg),
      seat: box(".vc-home-cushion"), floor: box(".vc-home-floor"), outlet: box(".vc-dispenser-slot"), opening: box(".vc-toy-box-opening"),
      controls, pictures, sofaRaster: { opaqueSamples, glassOverlapSamples, density, opaqueHitPoints,
        visible: { x: svgRect.x + x0 / density, y: svgRect.y + y0 / density, right: svgRect.x + (x1 + 1) / density, bottom: svgRect.y + (y1 + 1) / density } } };
  });
}

async function save(page: Page, name: string, metrics: Awaited<ReturnType<typeof measure>>) {
  mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/${name}.json`, JSON.stringify({ build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), ...metrics, proof: proofs.get(page) }, null, 2));
  await page.getByRole("region", { name: "빅타민 집", exact: true }).screenshot({ path: `${out}/${name}.png` });
}

async function actualHomeCall(page: Page, name: string) {
  await placeCompanionOnHomeFloor(page);
  // The resident intentionally stands in front of the sofa after placement.
  // Activate the same public control by keyboard instead of clicking its
  // occluded center; painted pointer targets are measured separately above.
  const sofa = page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await sofa.focus(); await sofa.press("Enter"); await page.mouse.move(2, 2);
  const pet = page.locator(".vc-companion");
  await expect(pet).toHaveAttribute("data-platform", "companion-home", { timeout: 25000 });
  await expect(pet).toHaveAttribute("data-sofa-depth", "seat");
  await expect.poll(() => pet.evaluate(node => Math.abs(node.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top))).toBeLessThan(2);
  const witness = await pet.evaluate(node => {
    const seat = document.querySelector(".vc-home-cushion")!.getBoundingClientRect(), body = node.getBoundingClientRect();
    return { platform: (node as HTMLElement).dataset.platform, depth: (node as HTMLElement).dataset.sofaDepth, seatWidth: seat.width, footError: Math.abs(body.bottom - seat.top) };
  });
  writeFileSync(`${out}/${name}-actual-home.json`, JSON.stringify({ build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), ...witness }, null, 2));
  await page.getByRole("region", { name: "빅타민 집", exact: true }).screenshot({ path: `${out}/${name}-actual-home.png` });
}

for (const [surface, width, dark] of [["viewer", 1100, false], ["viewer", 1440, false], ["studio", 1920, true], ["studio", 2400, false]] as const) test(`124 shorter shared room keeps visible art and real targets clear: ${surface} ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1100 }); await fixture(page, surface, dark);
  const data = await measure(page); await save(page, `${surface}-${width}`, data);
  const narrow = data.cssWidth <= 250;
  expect(data.cssHeight).toBeCloseTo(narrow ? 226 : 200, 1);
  expect(data.sofa.width).toBeGreaterThanOrEqual(119.99);
  expect(data.sofa.width / data.scale).toBeLessThanOrEqual(150.05);
  expect(data.sofa.width / data.sofa.height).toBeCloseTo(1.8, 2);
  //127 moves the dispenser beside the curtain. Only the shelf reserves wall width;
  // enlarging the chest no longer squeezes the window down to a tiny square.
  const expectedWindow = Math.min(narrow ? 126 : 152, data.cssWidth - (data.shelf.width / data.scale + (narrow ? 26 : 28)));
  expect(data.window.width / data.scale).toBeCloseTo(expectedWindow, 1);
  expect(data.shelf.x - data.window.right).toBeGreaterThanOrEqual(6);
  expect(data.sofaRaster.opaqueSamples).toBeGreaterThan(1000);
  expect(data.sofaRaster.glassOverlapSamples, "actual sofa paint leaves the landscape glass visible").toBe(0);
  const sofaHit = data.controls.find(control => control.action === "home")!;
  for (const key of ["x", "y"] as const) expect(data.sofaRaster.visible[key], "the resting back rim remains interactive").toBeGreaterThanOrEqual(sofaHit[key] - .1);
  for (const key of ["right", "bottom"] as const) expect(data.sofaRaster.visible[key]).toBeLessThanOrEqual(sofaHit[key] + .1);
  expect(data.sofaRaster.opaqueHitPoints.length).toBeGreaterThan(8);
  expect(data.sofaRaster.opaqueHitPoints.every(point => point.hit), "real painted back rim and body belong to the sofa control").toBe(true);
  expect(data.floor.bottom).toBeCloseTo(data.room.bottom, 2);
  expect(data.floor.y - data.window.bottom, "the frame and sill have wall space above the floor").toBeGreaterThan(8 * data.scale);
  const feeder = data.controls.find(control => control.action === "feed")!;
  expect(data.room.bottom - feeder.bottom).toBeCloseTo(Math.max(86 * data.scale, 79), 1);
  expect(data.floor.bottom - 6 - feeder.bottom, "the unscaled92px body keeps its real floor clearance").toBeGreaterThanOrEqual(72.92);
  const chest = data.controls.find(control => control.action === "toys")!;
  expect(data.room.right - chest.right).toBeCloseTo(6 * data.scale, 1);
  expect(feeder.right).toBeLessThanOrEqual(chest.x);
  expect(feeder.bottom).toBeLessThanOrEqual(sofaHit.y - 2 * data.scale);
  expect(await page.locator(".vc-dispenser").evaluate(node => getComputedStyle(node, "::before").content)).toBe("none");
  expect(data.controls.find(control => control.action === "toys")!.width / data.scale).toBeGreaterThanOrEqual(data.cssWidth >= 330 ? 130 : 104);
  expect(data.sofa.bottom - data.seat.bottom).toBeCloseTo(20.28 * data.scale, 1);
  expect(data.seat.x).toBeGreaterThan(data.sofa.x + data.sofa.width * 31 / 180);
  expect(data.seat.right).toBeLessThan(data.sofa.x + data.sofa.width * 149 / 180);
  expect(data.seat.width, "native seat retains the92px body's existing clearance").toBeGreaterThanOrEqual(76.92);
  const landing = companionSofaSeat({ left: data.seat.x, right: data.seat.right, top: data.seat.y }, 92);
  expect(landing).not.toBeNull(); expect(landing!.width).toBeGreaterThanOrEqual(1);
  for (const action of actions) {
    const target = data.controls.find(control => control.action === action)!;
    expect(target.width, action).toBeGreaterThanOrEqual(44); expect(target.height, action).toBeGreaterThanOrEqual(44);
    expect(target.hit, action + " owns its center and four real edges").toBe(true);
  }
  for (let a = 0; a < data.controls.length; a++) for (const b of data.controls.slice(a + 1)) {
    const first = data.controls[a], overlapX = Math.min(first.right, b.right) - Math.max(first.x, b.x), overlapY = Math.min(first.bottom, b.bottom) - Math.max(first.y, b.y);
    expect(overlapX > 0 && overlapY > 0, first.action + " overlaps " + b.action).toBe(false);
  }
  //125 owner explicitly replaces equal-size props with real furniture scale.
  // Measure the opaque silhouettes, rather than declaring every canvas equal.
  const pictureFor = (action: string) => data.pictures.find(picture => picture.action === action)!;
  const visibleWidth = (action: string) => { const r = pictureFor(action).visible; return r.right - r.x; };
  const visibleHeight = (action: string) => { const r = pictureFor(action).visible; return r.bottom - r.y; };
  expect(visibleWidth("toys"), "a chest is broader than a shelf radio").toBeGreaterThan(visibleWidth("radio") * 1.3);
  expect(visibleWidth("toys")).toBeGreaterThan(visibleWidth("book") * 1.8);
  expect(visibleWidth("feed") * visibleHeight("feed"), "the dispenser is larger than the book").toBeGreaterThan(visibleWidth("book") * visibleHeight("book") * 1.25);
  expect(visibleHeight("clearFood"), "the floor bin has real height").toBeGreaterThan(visibleHeight("radio") * 1.25);
  for (const picture of data.pictures) {
    expect(picture.fit).toBe("contain"); expect(picture.alphaPixels).toBeGreaterThan(10000);
    const hit = data.controls.find(control => control.action === picture.action)!;
    expect(picture.visible.x).toBeGreaterThanOrEqual(hit.x - .1); expect(picture.visible.right).toBeLessThanOrEqual(hit.right + .1);
    expect(picture.visible.y).toBeGreaterThanOrEqual(hit.y - .1); expect(picture.visible.bottom).toBeLessThanOrEqual(hit.bottom + .1);
    const overlapsGlass = picture.visible.x < data.glass.right && picture.visible.right > data.glass.x && picture.visible.y < data.glass.bottom && picture.visible.bottom > data.glass.y;
    //127 explicitly allows the feeder to sit in front of the lower curtain.
    // Other furniture retains its existing landscape clearance.
    if (picture.action !== "feed") expect(overlapsGlass, picture.action + " leaves the actual landscape glass visible").toBe(false);
  }
  //125 creator-visible landmarks in the new frontal source images. Static
  // openings must follow the same contain scale as their respective art.
  for (const [action, anchor, x, y] of [["feed", data.outlet, 131, 168], ["toys", data.opening, 128, 52]] as const) {
    const picture = data.pictures.find(item => item.action === action)!;
    expect((anchor.x + anchor.width / 2 - picture.content.x) / picture.content.scale).toBeCloseTo(x, 0);
    expect((anchor.y + anchor.height / 2 - picture.content.y) / picture.content.scale).toBeCloseTo(y, 0);
  }
  await actualHomeCall(page, `${surface}-${width}`);
});

test("124 whole-object feedback preserves the resized physical openings and seat", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1100 }); const room = await fixture(page, "studio", true, true);
  const before = await measure(page);
  for (const action of ["book", "radio", "toys", "feed", "clearFood"] as const) {
    const target = room.locator(`[data-home-action="${action}"]`), initial = (await target.boundingBox())!;
    await target.hover(); await expect(target.locator(".vc-object-paint")).toHaveCSS("filter", "brightness(1.08)");
    await expect(target.locator(".vc-object-paint")).toHaveCSS("transform", "none");
    expect(await target.boundingBox()).toEqual(initial);
    await page.mouse.move(2, 2);
  }
  const after = await measure(page);
  for (const key of ["outlet", "opening", "seat", "sofa", "floor"] as const) expect(after[key]).toEqual(before[key]);
  expect(after.sofaRaster.glassOverlapSamples).toBe(0);
  await save(page, "quiet-physical-anchors", after);
});

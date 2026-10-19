import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, COMPANION_TOY_VISUALS, isCompanionToyKind, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { openCompanionHome } from "./helpers/companion-home";

const out = resolve(process.env.COMPANION_TOYS_125_OUTPUT ?? ".scratch-pw/companion-125/toys");
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type Proof = { writes: string[]; foreign: string[]; errors: string[]; toyImages: string[]; notes: unknown[] };
const proofs = new WeakMap<Page, Proof>();
const room = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const box = (page: Page) => room(page).getByRole("button", { name: "장난감 상자 열기", exact: true });
test.use({ viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", hasTouch: false });
test.setTimeout(120000);

test.beforeEach(async ({ page }) => {
  const proof: Proof = { writes: [], foreign: [], errors: [], toyImages: [], notes: [] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.abort(); }
    if (url.pathname === "/api/soop-live") return route.fulfill({ json: { live: false } });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live/private API in fixture" });
    if (url.pathname.startsWith("/companion/home/125/toy-")) proof.toyImages.push(url.pathname);
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!; mkdirSync(out, { recursive: true });
  const path = resolve(out, info.title.replace(/[^a-z0-9]+/gi, "-") + ".json");
  writeFileSync(path, JSON.stringify({ build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), recordedAt: new Date().toISOString(), status: info.status, ...proof, scope: "Local production-build fixture. Initial preferences/care only; actual native pointer/keyboard input and DOM/pixel observations. No discovered/taste, RNG, clock, geometry, style or runtime-state injection; not production/OBS/device evidence." }, null, 2));
  await info.attach("actual-toys-125", { path, contentType: "application/json" });
  expect(proof.writes).toEqual([]); expect(proof.foreign).toEqual([]); expect(proof.errors).toEqual([]);
});
async function fixture(page: Page) {
  await page.addInitScript(({ preferences, memory, epoch, epochKey }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch,
      "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, roam: false, sleep: false, feeding: false, sound: false, learnFromYou: false }),
      "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }),
      "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off",
    })) localStorage.setItem(key, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY });
  await page.goto("/visual-fixture/studio?role=owner&y=2025&m=11"); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-companion")).toBeVisible(); await openCompanionHome(page);
  await expect.poll(() => room(page).evaluate(node => node.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).every(animation => animation.playState !== "running"))).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanionTastes"))).toBeNull();
  expect(proofs.get(page)!.toyImages).toEqual([]);
}
async function spawn(page: Page) {
  await box(page).focus(); await box(page).press("Enter");
  const toy = page.locator(".vc-toy"); await expect(toy).toHaveCount(1); await expect(toy).toBeVisible();
  await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 5000 });
  await page.mouse.move(2, 2); await expect(toy.locator("img")).toHaveCSS("transform", "none");
  await expect.poll(() => toy.locator("img").evaluate(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0)).toBe(true);
  return toy;
}
async function nativeDragToOpening(page: Page) {
  const toy = page.locator(".vc-toy"), r = (await toy.boundingBox())!, opening = (await room(page).locator(".vc-toy-box-opening").boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height - 6); await page.mouse.down();
  await expect(toy).toHaveAttribute("data-held", "true");
  await page.mouse.move(opening.x + opening.width / 2, opening.y + opening.height / 2, { steps: 10 });
  await expect(box(page)).toHaveAttribute("data-toy-over", "");
  await expect.poll(() => box(page).locator(".vc-object-paint").evaluate(node => getComputedStyle(node).filter.startsWith("brightness(1.08)"))).toBe(true);
  return { toy, opening };
}

test("125 twenty-four actual take-outs render varied art, return natively and remain independently selectable in the book", async ({ page }) => {
  await fixture(page); const observed: { kind: CompanionToyKind; paint: { width: number; height: number }; hit: { width: number; height: number } }[] = [];
  for (let draw = 0; draw < COMPANION_TOY_KINDS.length; draw++) {
    const toy = await spawn(page), rawKind = await toy.getAttribute("data-kind");
    expect(isCompanionToyKind(rawKind)).toBe(true); const kind = rawKind as CompanionToyKind;
    expect(observed.some(item => item.kind === kind), "actual shuffle bag does not repeat before all24 appear").toBe(false);
    await expect(toy.locator("img")).toHaveAttribute("src", `/companion/home/125/toy-${kind}.webp`);
    const hit = (await toy.boundingBox())!; expect(hit.width).toBeCloseTo(44, 2); expect(hit.height).toBeCloseTo(44, 2);
    const painted = await toy.locator("img").evaluate(node => {
      const image = node as HTMLImageElement, r = node.getBoundingClientRect(), canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0); const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let x0 = canvas.width, y0 = canvas.height, x1 = -1, y1 = -1;
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) if (rgba[(y * canvas.width + x) * 4 + 3] > 16) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      const scale = Math.min(r.width / canvas.width, r.height / canvas.height), left = r.x + (r.width - canvas.width * scale) / 2, top = r.y + (r.height - canvas.height * scale) / 2;
      return { box: { width: r.width, height: r.height }, x: left + x0 * scale, y: top + y0 * scale, width: (x1 - x0 + 1) * scale, height: (y1 - y0 + 1) * scale };
    });
    expect(painted.box.width).toBeCloseTo(COMPANION_TOY_VISUALS[kind].width, 1); expect(painted.box.height).toBeCloseTo(COMPANION_TOY_VISUALS[kind].height, 1);
    expect(painted.width).toBeGreaterThan(0); expect(painted.height).toBeGreaterThan(0); expect(painted.x).toBeGreaterThanOrEqual(hit.x - .1); expect(painted.y).toBeGreaterThanOrEqual(hit.y - .1);
    expect(painted.x + painted.width).toBeLessThanOrEqual(hit.x + hit.width + .1); expect(painted.y + painted.height).toBeLessThanOrEqual(hit.y + hit.height + .1);
    observed.push({ kind, paint: painted, hit });
    if (draw === 0) expect(new Set(proofs.get(page)!.toyImages).size, "unknown toys do not preload all24 pictures").toBe(1);
    await nativeDragToOpening(page); await page.mouse.up(); await expect(toy).toHaveCount(0); await expect(box(page)).not.toHaveAttribute("data-toy-over");
  }
  expect(new Set(observed.map(item => item.kind))).toEqual(new Set(COMPANION_TOY_KINDS));
  const sizes = observed.map(item => Math.max(item.paint.width, item.paint.height)); expect(Math.max(...sizes) / Math.min(...sizes), "actual opaque silhouettes have meaningful size differences").toBeGreaterThan(1.5);
  await room(page).locator('[data-home-action="book"]').click(); const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "도감", exact: true }).click(); await dialog.locator('[data-act="companion-collection-category"][data-act-opt="toy"]').click();
  const book = dialog.locator(".rhh-companion-toy-discovery"), inspected: number[] = [];
  for (let index = 0; index < COMPANION_TOY_KINDS.length; index++) {
    const tile = book.locator(`[data-collection-index="${index}"]`); await expect(tile).toBeVisible();
    if (index === 0) await tile.click();
    await expect(tile).toHaveAttribute("aria-pressed", "true"); await expect(book.locator(".rhh-collection-detail-title strong")).toHaveText(COMPANION_TOY_NAMES[COMPANION_TOY_KINDS[index]]);
    await expect(tile).not.toHaveAttribute("data-unread", "true"); inspected.push(index);
    if (index + 1 < COMPANION_TOY_KINDS.length) await tile.press("ArrowRight");
  }
  const tastes = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionTastes")!));
  expect(tastes.toys).toEqual(COMPANION_TOY_KINDS); expect(tastes.seen).toEqual(COMPANION_TOY_KINDS); expect(tastes.toyTastes).toEqual({});
  proofs.get(page)!.notes.push({ observed, actualKeyboardInspectedIndexes: inspected, actualTastes: tastes, noDiscoveredOrTasteSeeds: true });
});

test("125 captured toy highlights the real return box, clears on leave and native Escape, then returns through a normal drop", async ({ page }) => {
  await fixture(page); const toy = await spawn(page), id = (await toy.getAttribute("data-toy-id"))!;
  await nativeDragToOpening(page);
  const floor = (await room(page).locator(".vc-home-floor").boundingBox())!;
  await page.mouse.move(floor.x + 28, floor.y + floor.height - 12, { steps: 8 }); await expect(box(page)).not.toHaveAttribute("data-toy-over");
  const opening = (await room(page).locator(".vc-toy-box-opening").boundingBox())!;
  await page.mouse.move(opening.x + opening.width / 2, opening.y + opening.height / 2, { steps: 8 }); await expect(box(page)).toHaveAttribute("data-toy-over", "");
  await toy.press("Escape"); await expect(toy).toHaveAttribute("data-held", "false"); await expect(box(page)).not.toHaveAttribute("data-toy-over"); await page.mouse.up();
  await expect(toy).toHaveCount(1); await expect(toy).toHaveAttribute("data-toy-id", id); await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 5000 });
  await nativeDragToOpening(page); await page.mouse.up(); await expect(toy).toHaveCount(0); await expect(box(page)).not.toHaveAttribute("data-toy-over");
  proofs.get(page)!.notes.push({ sameActualToyId: id, realPointerCaptureDropHover: true, realNativeEscapePreservedObject: true, actualNormalReturn: true });
});

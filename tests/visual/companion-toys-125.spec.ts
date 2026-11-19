import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, COMPANION_TOY_VISUALS, getCompanionToyArt, isCompanionToyKind, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_TOY_BOOK_ORDER } from "@/lib/ui/viewer-companion/collection-book-order";
import { openCompanionHome } from "./helpers/companion-home";

const out = resolve(process.env.COMPANION_TOYS_125_OUTPUT ?? ".scratch-pw/companion-125/toys");
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type Proof = { writes: string[]; foreign: string[]; errors: string[]; toyImages: string[]; notes: unknown[] };
const proofs = new WeakMap<Page, Proof>();
const room = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const box = (page: Page) => room(page).getByRole("button", { name: "장난감 상자 열기", exact: true });
test.use({ viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", hasTouch: false });
test.setTimeout(120000);

test.beforeEach(async ({ page, baseURL }) => {
  const proof: Proof = { writes: [], foreign: [], errors: [], toyImages: [], notes: [] }; proofs.set(page, proof);
  // The fixture origin is whatever the running config serves, never a fixed port.
  const fixtureOrigin = new URL(baseURL!).origin;
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== fixtureOrigin) {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.abort(); }
    if (url.pathname === "/api/soop-live") return route.fulfill({ json: { live: false } });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live/private API in fixture" });
    if (/^\/companion\/home\/\d+\/toy-/.test(url.pathname)) proof.toyImages.push(url.pathname);
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
  // The art now always carries rotate(var(--vc-toy-art-rotation)) and the hover
  // enlargement is the separate `scale` property (companion-toys.css): a rested,
  // unhovered toy is an identity rotation at scale 1.
  await page.mouse.move(2, 2); await expect(toy.locator("img")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)"); await expect(toy.locator("img")).toHaveCSS("scale", "1");
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

// The 24-kind shuffle bag became a weighted rarity catalogue (e4f56c8f, 2026-10-20: 143/146 expansions,
// createBoundedWeightedCatalog). The draw contract is now "any catalogue kind, never the one just taken out",
// art lives under its own expansion folder, and the book lists every kind in book order with unmet ones as ???.
test("125 twenty-four actual take-outs render varied art, return natively and stay unmet but independently selectable in the book", async ({ page }) => {
  await fixture(page); const observed: { kind: CompanionToyKind; paint: { width: number; height: number }; hit: { width: number; height: number } }[] = [];
  for (let draw = 0; draw < 24; draw++) {
    const toy = await spawn(page), rawKind = await toy.getAttribute("data-kind");
    expect(isCompanionToyKind(rawKind)).toBe(true); const kind = rawKind as CompanionToyKind;
    expect(observed.at(-1)?.kind, "the actual weighted draw never repeats the toy just taken out").not.toBe(kind);
    await expect(toy.locator("img")).toHaveAttribute("src", getCompanionToyArt(kind));
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
    if (draw === 0) expect(new Set(proofs.get(page)!.toyImages).size, "unknown toys do not preload the catalogue pictures").toBe(1);
    await nativeDragToOpening(page); await page.mouse.up(); await expect(toy).toHaveCount(0); await expect(box(page)).not.toHaveAttribute("data-toy-over");
  }
  const met = new Set(observed.map(item => item.kind));
  expect(met.size, "twenty-four weighted take-outs meet many different toys").toBeGreaterThanOrEqual(8);
  // The size difference the take-outs must paint is the catalogue's own: the largest over the smallest authored
  // size among the kinds actually drawn. The painted opaque silhouettes must reproduce that ratio within +-10%.
  const sizes = observed.map(item => Math.max(item.paint.width, item.paint.height));
  const catalogue = [...met].map(kind => Math.max(COMPANION_TOY_VISUALS[kind].width, COMPANION_TOY_VISUALS[kind].height));
  const expectedRatio = Math.max(...catalogue) / Math.min(...catalogue), paintedRatio = Math.max(...sizes) / Math.min(...sizes);
  expect(expectedRatio, "the drawn kinds span different catalogue sizes").toBeGreaterThan(1);
  expect(paintedRatio / expectedRatio, `painted size ratio ${paintedRatio.toFixed(3)} follows the catalogue ratio ${expectedRatio.toFixed(3)} of the drawn kinds`).toBeGreaterThanOrEqual(.9);
  expect(paintedRatio / expectedRatio, `painted size ratio ${paintedRatio.toFixed(3)} follows the catalogue ratio ${expectedRatio.toFixed(3)} of the drawn kinds`).toBeLessThanOrEqual(1.1);
  await room(page).locator('[data-home-action="book"]').click(); const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByRole("tab", { name: "도감", exact: true }).click(); await dialog.locator('[data-act="companion-collection-category"][data-act-opt="toy"]').click();
  // Taking a toy out and putting it back collects nothing: only the pet's own completed play adds an identity
  // (toy-tastes.ts recordToy). The book therefore still lists every kind as an unmet, independently selectable ???.
  const book = dialog.locator(".rhh-companion-toy-discovery"), inspected: number[] = [];
  await expect(dialog.locator('[data-act="companion-collection-category"][data-act-opt="toy"]')).toContainText(`0/${COMPANION_TOY_KINDS.length}`);
  expect(new Set(COMPANION_TOY_BOOK_ORDER)).toEqual(new Set(COMPANION_TOY_KINDS));
  // The page size is measured from the open sheet (it starts at 4x2 and settles after the first resize reading).
  const tiles = book.locator("[data-collection-index]"); let pageSize = 0;
  await expect.poll(async () => { const count = await tiles.count(), settled = count === pageSize; pageSize = count; return settled && count >= 2; }, { intervals: [250] }).toBe(true);
  await expect(book.locator("[data-found]")).toHaveCount(0);
  for (let index = 0; index < pageSize; index++) {
    const tile = book.locator(`[data-collection-index="${index}"]`); await expect(tile).toBeVisible(); await tile.click();
    await expect(tile).toHaveAttribute("aria-pressed", "true"); await expect(book.locator('[aria-pressed="true"]')).toHaveCount(1);
    await expect(tile).toHaveAccessibleName(`??? · ${index + 1}`); await expect(book.locator(".rhh-collection-detail-title strong")).toHaveText("???");
    await expect(tile).not.toHaveAttribute("data-unread"); inspected.push(index);
  }
  // With nothing new to read, Right is the visible next-page button: the selection moves one whole page.
  await page.keyboard.press("ArrowRight");
  await expect(book.locator(`[data-collection-index="${pageSize}"]`)).toHaveAttribute("aria-pressed", "true"); await expect(book.locator("[data-found]")).toHaveCount(0);
  const tastes = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionTastes") ?? "null"));
  expect(tastes?.toys ?? []).toEqual([]); expect(tastes?.seen ?? []).toEqual([]); expect(tastes?.toyTastes ?? {}).toEqual({});
  proofs.get(page)!.notes.push({ observed, sizeRatio: paintedRatio, catalogueSizeRatio: expectedRatio, distinctKinds: met.size, actualInspectedUnknownIndexes: inspected, actualTastes: tastes, noDiscoveredOrTasteSeeds: true });
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

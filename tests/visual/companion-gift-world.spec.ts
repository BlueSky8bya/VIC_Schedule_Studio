import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_COLLECTION_KEY, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import type { CompanionAccessoryId } from "@/lib/ui/viewer-companion/gifts";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { expectCompanionBehindOverlay, waitForOverlayEntrance } from "./helpers/companion-overlay";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.setTimeout(90_000);
const output = process.env.VIC_GIFT_WORLD_OUTPUT ?? ".scratch-pw/companion-110/gift-world";
const creature = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const readCollection = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as CompanionCollection, COMPANION_COLLECTION_KEY);

async function setup(page: Page, collection: CompanionCollection, dark = false, premiereFixture = false) {
  const writes: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await page.route("**/*", route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname === "/visual-fixture/studio" && previewReads.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { writes.push(pathname); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    // These two explicit GETs are DB-free: one builds fixture entries, the
    // other returns real server time. The shipping conductor calibrates and
    // validates itself through their real responses; neither clock is patched.
    if (premiereFixture && request.method() === "GET" && ["/api/visual-fixture/premiere", "/api/public/clock"].includes(pathname)) return route.continue();
    if (pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    if (request.method() === "GET" && (pathname === "/" || pathname === "/studio")) return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    return route.continue();
  });
  await page.addInitScript(({ key, epoch, prefs, care, life, collection, collectionKey, dark }) => {
    if (localStorage.getItem("fixture.giftWorld107")) return;
    localStorage.setItem("fixture.giftWorld107", "seeded");
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": dark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, jump: false, sleep: true, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: .15, energy: .95, affection: .9, life }));
    localStorage.setItem(collectionKey, JSON.stringify(collection));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, life: createCompanionLife(() => 0), collection, collectionKey: COMPANION_COLLECTION_KEY, dark });
  await page.goto("/visual-fixture/poster"); await page.bringToFront();
  await settlePanelLayout(page);
  await expect(actor(page)).toBeVisible(); await expect(creature(page)).toHaveAttribute("data-presence", "active");
  expect(await page.evaluate(() => document.hasFocus())).toBe(true);
  await expect(creature(page)).toHaveCSS("width", "92px");
  mkdirSync(output, { recursive: true });
  return { writes, errors };
}

/** A real hit-tested native mouse click, without locator scrollIntoView. */
async function nativeClick(page: Page, target: Locator) {
  await expect(target).toBeVisible();
  await expect.poll(() => target.evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); })).toBe(true);
  const box = (await target.boundingBox())!, point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  expect(await target.evaluate((node, point) => node.contains(document.elementFromPoint(point.x, point.y)), point)).toBe(true);
  await page.mouse.click(point.x, point.y);
}

async function expectWorn(page: Page, id: CompanionAccessoryId) {
  await expect(creature(page)).toHaveAttribute("data-accessory", id);
  await expect.poll(() => creature(page).evaluate(node => {
    const element = node as HTMLElement, wearables = [...node.querySelectorAll<HTMLElement>(".vc-wearable-back,.vc-wearable-front")].filter(item => !item.hidden);
    return element.dataset.pose === element.dataset.accessoryPose && wearables.length > 0 && wearables.every(item => item.parentElement === node.querySelector(".vc-pose") && getComputedStyle(item).pointerEvents === "none" && getComputedStyle(item).backgroundImage.includes("accessories-106-v1.webp"));
  })).toBe(true);
  await expect(creature(page)).toHaveCSS("width", "92px");
}

/** Save CSS-pixel/native-size evidence, never a magnified or posed render. */
async function captureCreature(page: Page, name: string) {
  const box = (await creature(page).boundingBox())!, viewport = page.viewportSize()!;
  const left = Math.max(0, box.x - 70), top = Math.max(0, box.y - 70);
  const clip = { x: left, y: top, width: Math.min(viewport.width - left, box.width + 140), height: Math.min(viewport.height - top, box.height + 140) };
  await page.screenshot({ path: `${output}/${name}.png`, clip, scale: "css" });
  const witness = await creature(page).evaluate(node => ({ state: (node as HTMLElement).dataset.state, pose: (node as HTMLElement).dataset.pose, accessoryPose: (node as HTMLElement).dataset.accessoryPose, accessory: (node as HTMLElement).dataset.accessory, sofa: (node as HTMLElement).dataset.sofaDepth, width: getComputedStyle(node).width, scrollY, layers: [...node.querySelectorAll<HTMLElement>(".vc-wearable-back,.vc-sprite,.vc-wearable-front")].map(layer => ({ className: layer.className, hidden: layer.hidden, z: getComputedStyle(layer).zIndex, clip: getComputedStyle(layer).clipPath })) }));
  writeFileSync(`${output}/${name}.json`, JSON.stringify(witness, null, 2));
}

async function placeAtVisibleCentre(page: Page) {
  await actor(page).focus(); await actor(page).press("p");
  await expect(creature(page)).toHaveAttribute("data-placing", "");
  const viewport = page.viewportSize()!;
  await page.mouse.click(viewport.width * .55, viewport.height * .65); await page.mouse.move(viewport.width - 25, 100);
  await settlePanelLayout(page);
  await expect(creature(page)).not.toHaveAttribute("data-state", "jump", { timeout: 5000 });
  await expect(creature(page)).toBeVisible();
}

test("native petting earns a bounded rare opportunity, not a guaranteed five-minute gift", async ({ page }) => {
  const safety = await setup(page, { version: 1, situations: [], foods: [], behaviors: [], gifts: { pending: null, unlocked: [], equipped: null, activeMs: 299000, interactionCredit: 0 } });
  expect((await readCollection(page)).gifts).toMatchObject({ pending: null, unlocked: [], equipped: null, interactionCredit: 0 });
  await expect(page.getByRole("button", { name: "빅타민이 가져온 선물 열기", exact: true })).toHaveCount(0);
  // A short pointer click is only the shipped tap reaction. The native
  // keyboard alternative deliberately requests a full petting reward.
  await actor(page).focus(); await actor(page).press("Enter");
  await expect(creature(page)).toHaveAttribute("data-state", "petted");
  await expect.poll(async () => {
    const value = (await readCollection(page)).gifts;
    return value.interactionCredit === 1 || value.activeMs < 299000;
  }).toBe(true);
  // Native time and RNG stay untouched. Whether the rare roll wins or misses,
  // it must spend its opportunity; tick-by-tick delivery is unit-tested.
  await expect.poll(async () => (await readCollection(page)).gifts.activeMs, { timeout: 20_000 }).toBeLessThan(299000);
  await expect.poll(async () => (await readCollection(page)).gifts.interactionCredit).toBe(0);
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

test("an existing earned gift opens physically and explicit wearing survives reload", async ({ page }) => {
  const safety = await setup(page, { version: 1, situations: [], foods: [], behaviors: [], gifts: { pending: "sunglasses", unlocked: [], equipped: null, activeMs: 0, interactionCredit: 0 } });
  const gift = page.getByRole("button", { name: "빅타민이 가져온 선물 열기", exact: true });
  await expect(gift).toBeVisible({ timeout: 20_000 });
  expect((await readCollection(page)).gifts).toMatchObject({ pending: "sunglasses", unlocked: [], equipped: null, activeMs: 0 });
  await expect(creature(page).locator(".vc-gift-prop")).toBeVisible();
  await captureCreature(page, "earned-physical-gift");
  await nativeClick(page, gift);
  const notice = page.getByRole("complementary", { name: "받은 선물", exact: true });
  await expect(notice).toBeVisible(); await expect(notice).toContainText("선글라스 선물!");
  expect((await readCollection(page)).gifts).toMatchObject({ pending: null, unlocked: ["sunglasses"], equipped: null });
  await expect(creature(page).locator(".vc-wearable-front:not([hidden]),.vc-wearable-back:not([hidden])")).toHaveCount(0);
  await notice.screenshot({ path: `${output}/earned-open-notice.png` });
  await nativeClick(page, notice.getByRole("button", { name: "착용하기", exact: true }));
  await expect(notice).toHaveCount(0); await expect(actor(page)).toBeFocused();
  await expectWorn(page, "sunglasses"); await captureCreature(page, "earned-worn-sunglasses");
  await page.reload(); await page.bringToFront(); await settlePanelLayout(page);
  await expectWorn(page, "sunglasses");
  expect((await readCollection(page)).gifts).toMatchObject({ pending: null, unlocked: ["sunglasses"], equipped: "sunglasses" });
  await expect(page.getByRole("button", { name: "빅타민이 가져온 선물 열기", exact: true })).toHaveCount(0);
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

test("premiere blocks native pointer and keyboard gift access, then ordinary controls return", async ({ page }) => {
  const safety = await setup(page, { version: 1, situations: [], foods: [], behaviors: [], gifts: { pending: "sunglasses", unlocked: [], equipped: null, activeMs: 300000, interactionCredit: 1 } }, false, true);
  let gift = page.getByRole("button", { name: "빅타민이 가져온 선물 열기", exact: true });
  await expect(gift).toBeVisible(); await expect(gift).toBeEnabled();
  const before = (await readCollection(page)).gifts;
  // The fixture authors a real future public deadline. Wall/performance time,
  // input routing and the performance phase remain the shipping implementation.
  await page.goto("/visual-fixture/poster?avatar=1&premiere=160"); await page.bringToFront();
  await page.evaluate(() => document.fonts.ready);
  // At160s this is the actual non-focused prelude; the modal dialog begins
  // only at the later focused phase. Verify the conductor's real phase.
  await expect(page.locator(".pm-stage")).toHaveClass(/\bpm-phase-prelude\b/);
  gift = page.getByRole("button", { name: "빅타민이 가져온 선물 열기", exact: true });
  await expect(gift).toBeVisible(); await expect(gift).toBeDisabled(); await expect(gift).toHaveAttribute("tabindex", "-1");
  const box = (await gift.boundingBox())!, viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await actor(page).focus(); await page.keyboard.press("Tab");
  await expect(gift).not.toBeFocused();
  await expect(page.getByRole("complementary", { name: "받은 선물", exact: true })).toHaveCount(0);
  expect((await readCollection(page)).gifts).toEqual(before);
  await page.screenshot({ path: `${output}/premiere-gift-blocked.png`, scale: "css" });
  await page.keyboard.press("Escape");
  await expect(page.locator(".pm-stage")).not.toBeVisible();
  await expect(gift).toBeEnabled(); await expect(gift).toHaveAttribute("tabindex", "0");
  await nativeClick(page, gift);
  await expect(page.getByRole("complementary", { name: "받은 선물", exact: true })).toBeVisible();
  expect((await readCollection(page)).gifts).toMatchObject({ pending: null, unlocked: ["sunglasses"], equipped: null });
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

for (const [id, dark] of [["sunglasses", false], ["beret", true], ["flower-crown", false]] as const) {
  test(`${id}: native92px wearable follows scroll, sofa, held pose and ordinary dialog layers`, async ({ page }) => {
    // Explicit persisted wardrobe fixture, separate from the real earned-gift
    // case above. No grant, pose, frame, clock, RNG or geometry is injected.
    const safety = await setup(page, { version: 1, situations: [], foods: [], behaviors: [], gifts: { pending: null, unlocked: ["sunglasses", "beret", "flower-crown"], equipped: id, activeMs: 0, interactionCredit: 0 } }, dark);
    await placeAtVisibleCentre(page); await expectWorn(page, id);
    await captureCreature(page, `${id}-native92`);
    const scrollBefore = await page.evaluate(() => scrollY);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBeGreaterThan(0);
    await page.mouse.move(1400, 450); await page.mouse.wheel(0, 140);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(scrollBefore);
    await expectWorn(page, id); await captureCreature(page, `${id}-scrolled`);

    const home = await openCompanionHome(page);
    // Place through the real P control near the cushion. Depending on actual
    // viewport/scroll contact, the sofa itself can legitimately win over the
    // thin floor; the explicit cushion command below owns the rest assertion.
    const bed = (await home.locator(".vc-plush-bed").boundingBox())!, floor = (await home.locator(".vc-home-floor").boundingBox())!;
    await actor(page).focus(); await actor(page).press("p");
    await expect(creature(page)).toHaveAttribute("data-placing", "");
    await page.mouse.click(bed.x + bed.width / 2, floor.y + floor.height - 14); await page.mouse.move(2, 2);
    await settlePanelLayout(page);
    await expect(creature(page)).toHaveAttribute("data-platform", /^companion-home(?:-floor(?:-\d+)?)?$/, { timeout: 6000 });
    await expect(creature(page)).not.toHaveAttribute("data-state", "jump");
    const cushion = home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
    await cushion.focus(); await cushion.press("Enter");
    await expect(creature(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 6000 });
    await expect(creature(page)).toHaveAttribute("data-state", "sleep", { timeout: 6000 });
    await expectWorn(page, id);
    const foreground = page.locator(".vc-bed-foreground");
    await expect(foreground).toBeVisible();
    await expect(creature(page)).toHaveAttribute("data-sofa-depth", /^(seat|back)$/);
    const layers = await creature(page).evaluate(node => ({ petZ: Number(getComputedStyle(node).zIndex), frontZ: Number(getComputedStyle(document.querySelector(".vc-bed-foreground")!).zIndex), back: Number(getComputedStyle(node.querySelector(".vc-wearable-back")!).zIndex), body: Number(getComputedStyle(node.querySelector(".vc-sprite")!).zIndex), front: Number(getComputedStyle(node.querySelector(".vc-wearable-front")!).zIndex) }));
    expect(layers.frontZ).toBeGreaterThan(layers.petZ); expect(layers.back).toBeLessThan(layers.body); expect(layers.front).toBeGreaterThan(layers.body);
    await home.screenshot({ path: `${output}/${id}-sofa-native92.png` });
    await captureCreature(page, `${id}-sofa-detail`);

    const box = (await actor(page).boundingBox())!, start = { x: box.x + box.width / 2, y: box.y + box.height * .4 };
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    try {
      await page.waitForTimeout(450); // Real deliberate hold, no clock substitution.
      await page.mouse.move(start.x + 50, start.y - 100, { steps: 12 });
      await expect(creature(page)).toHaveAttribute("data-state", "held"); await expectWorn(page, id);
      await expect(creature(page)).toHaveAttribute("data-sofa-depth", "clear"); await expect(foreground).toBeHidden();
      await captureCreature(page, `${id}-held-native92`);
      await page.waitForTimeout(120);
    } finally { await page.mouse.up(); }
    await expect(creature(page)).not.toHaveAttribute("data-state", "held");
    await placeAtVisibleCentre(page);
    const settings = page.getByRole("button", { name: "설정", exact: true });
    if (!await settings.isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
    await settings.click();
    const dialog = page.getByRole("dialog", { name: "설정", exact: true });
    await waitForOverlayEntrance(dialog); await expectWorn(page, id);
    await expectCompanionBehindOverlay(page, dialog);
    await expect(actor(page)).toHaveAttribute("tabindex", "-1");
    await page.screenshot({ path: `${output}/${id}-dialog-layer.png`, scale: "css" });
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expectWorn(page, id);
    expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
  });
}

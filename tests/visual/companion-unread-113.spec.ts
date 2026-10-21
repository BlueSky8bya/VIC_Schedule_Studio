import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_COLLECTION_KEY, COMPANION_BEHAVIOR_IDS } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FOOD_BOOK_ORDER as COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/collection-book-order";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { CAL_ZOOM_STEPS } from "@/lib/ui/calendar-zoom";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";

type Surface = "viewer" | "studio" | "preview";
type Seen = { foods: string[]; behaviors: string[]; situations: string[]; accessories: string[] };
type Receipt = { version: number; foods: string[]; behaviors: string[]; situations: string[]; gifts: { pending: string | null; unlocked: string[]; equipped: string | null; activeMs: number; interactionCredit: number }; seen?: Seen };
type Proof = { build: string; writes: string[]; errors: string[]; foreignReads: string[]; phases: unknown[] };
const output = process.env.VIC_UNREAD113_OUTPUT ?? ".scratch-pw/companion-113/unread/native";
const proofs = new WeakMap<Page, Proof>();
const legacy: Receipt = { version: 1, foods: [COMPANION_FOOD_KINDS[0]], behaviors: [COMPANION_BEHAVIOR_IDS[0], "stretch"], situations: [], gifts: { pending: null, unlocked: [COMPANION_WEARABLE_IDS[0]], equipped: COMPANION_WEARABLE_IDS[0], activeMs: 0, interactionCredit: 0 } };

test.use({ headless: true, viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, serviceWorkers: "block", trace: "off" });
test.setTimeout(120000);

async function fixture(page: Page, context: BrowserContext, surface: Surface, meal = false) {
  const fixtureBase = new URL(test.info().project.use.baseURL ?? "");
  if (fixtureBase.protocol !== "http:" || !["127.0.0.1", "127.0.0.2", "localhost", "[::1]"].includes(fixtureBase.hostname) || fixtureBase.username || fixtureBase.password) throw new Error("Unread fixture requires an explicit HTTP loopback baseURL");
  const fixtureOrigin = fixtureBase.origin;
  const proof: Proof = { build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), writes: [], errors: [], foreignReads: [], phases: [] };
  proofs.set(page, proof); context.on("page", other => other.on("pageerror", error => proof.errors.push(error.message)));
  page.on("pageerror", error => proof.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== fixtureOrigin) { proof.foreignReads.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previewReads.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    if (url.pathname === "/robots.txt") return route.fulfill({ status: 200, contentType: "text/plain", body: "fixture storage origin only" });
    if (url.pathname === "/" || url.pathname === "/studio") return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    return route.continue();
  });
  const initial = meal ? { ...legacy, foods: [], behaviors: [], gifts: { ...legacy.gifts, unlocked: [], equipped: null }, seen: { foods: [], behaviors: [], situations: [], accessories: [] } } : legacy;
  await page.addInitScript(({ key, epoch, preferences, care, collectionKey, initial, dark, meal }) => {
    if (localStorage.getItem("fixture.unread113")) return;
    localStorage.setItem("fixture.unread113", "seeded");
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": dark ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": meal ? "off" : "on", "vic.gfxPref": "max", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: meal, jump: meal, sleep: false, feeding: meal, petting: false, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: meal ? .55 : .05, affection: .6, energy: 1 }));
    localStorage.setItem(collectionKey, JSON.stringify(initial));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, collectionKey: COMPANION_COLLECTION_KEY, initial, dark: surface === "studio", meal });
  await visit(page, surface);
  return proof;
}

async function visit(page: Page, surface: Surface) {
  await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
}
async function settings(page: Page) {
  await page.bringToFront(); await settlePanelLayout(page);
  if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) { await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settlePanelLayout(page); }
  const gear = page.getByRole("button", { name: "설정", exact: true });
  if (!await gear.isVisible()) { await page.getByRole("button", { name: "패널 펼치기", exact: true }).click(); await settlePanelLayout(page); }
  await gear.click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await expect(dialog.locator(".rhh-companion-profile")).toBeVisible(); return dialog;
}
async function book(page: Page) {
  await page.bringToFront(); await settlePanelLayout(page);
  const entry = page.getByRole("button", { name: "빅타민 수첩 열기", exact: true }), launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true }), fold = page.locator('.vc-home [data-act="companion-home-fold"]');
  if (!await entry.isVisible()) { if (await launcher.isVisible()) await launcher.click(); else await fold.click(); await settlePanelLayout(page); }
  await expect(entry).toBeVisible(); await entry.click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(dialog).toBeVisible(); return dialog;
}
const read = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as Receipt, COMPANION_COLLECTION_KEY);
function unread(value: Receipt) {
  const missed = (owned: string[], seen?: string[]) => owned.filter(id => !(seen ?? owned).includes(id)).length;
  const foods = missed(value.foods, value.seen?.foods), memories = missed(value.behaviors, value.seen?.behaviors) + missed(value.situations, value.seen?.situations), accessories = missed(value.gifts.unlocked.filter(id => COMPANION_WEARABLE_IDS.includes(id as typeof COMPANION_WEARABLE_IDS[number])), value.seen?.accessories);
  return { foods, memories, accessories, total: foods + memories + accessories };
}
async function counts(page: Page, expected: { foods: number; memories: number; accessories: number; total: number }, label: string) {
  await expect.poll(async () => unread(await read(page))).toEqual(expected);
  proofs.get(page)!.phases.push({ label, counts: unread(await read(page)), state: await read(page) });
}
async function newlyDiscoveredInAnotherTab(page: Page, context: BrowserContext) {
  const before = await read(page), next: Receipt = { ...before, foods: [COMPANION_FOOD_KINDS[0], COMPANION_FOOD_KINDS[1], COMPANION_FOOD_KINDS.at(-1)!], behaviors: [...before.behaviors, COMPANION_BEHAVIOR_IDS[1]], situations: [COMPANION_SITUATION_IDS[0]], gifts: { ...before.gifts, unlocked: [COMPANION_WEARABLE_IDS[0], COMPANION_WEARABLE_IDS[1], COMPANION_WEARABLE_IDS.at(-1)!] }, seen: { foods: [...before.foods], behaviors: [...before.behaviors], situations: [...before.situations], accessories: [...before.gifts.unlocked] } };
  // Seeded valid persisted discoveries, not evidence of a real meal/gift.
  // A real second browser page changes storage; no forged StorageEvent or
  // application/runtime function is injected into the page under test.
  await writeFromOtherTab(page, context, next); return next;
}
async function writeFromOtherTab(page: Page, context: BrowserContext, next: Receipt) {
  const other = await context.newPage(); await other.goto("/robots.txt");
  await other.evaluate(({ key, next }) => localStorage.setItem(key, JSON.stringify(next)), { key: COMPANION_COLLECTION_KEY, next });
  await other.close(); await page.bringToFront();
}
async function turnUntil(dialog: Locator, target: Locator, next: string) {
  const grid = dialog.locator(".rhh-collection-grid:visible");
  await expect(grid).toBeVisible();
  await settlePanelLayout(dialog.page());
  const firstItem = () => grid.locator("button").first().evaluate(node => node.getAttribute("data-collection-index") ?? node.getAttribute("data-accessory"));
  for (let attempt = 0; attempt < 100 && !await target.isVisible(); attempt++) {
    const before = await firstItem(), rail = dialog.getByRole("slider", { name: /도감 페이지 선택|옷장 페이지 선택/ });
    const value = Number(await rail.inputValue()), backwards = next.startsWith("이전");
    expect(backwards ? value > 1 : value < Number(await rail.getAttribute("max"))).toBe(true);
    if (await target.isVisible()) break;
    await rail.focus(); await rail.press(backwards ? "PageUp" : "PageDown");
    // A native key may resolve before React/ResizeObserver commits the new
    // measured page. Wait for that page before deciding to advance again.
    await expect.poll(async () => await target.isVisible() || await firstItem() !== before).toBe(true);
  }
  await expect(target).toBeVisible();
}
async function inspectBadgePaint(page: Page, scope: Locator, label: string) {
  const paint = await scope.locator(".rhh-collection-unread,.vc-book-unread").evaluateAll(nodes => nodes.filter(node => node.getBoundingClientRect().width > 0).map(node => {
    const css = getComputedStyle(node), rect = node.getBoundingClientRect(), tile = node.closest(".rhh-collection-tile"), stamp = tile?.querySelector(".rhh-collection-stamp")?.getBoundingClientRect();
    const luminance = (raw: string) => {
      const values = raw.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; });
      return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
    };
    const ink = luminance(css.color), ground = luminance(css.backgroundColor);
    return { color: css.color, background: css.backgroundColor, contrast: (Math.max(ink, ground) + .05) / (Math.min(ink, ground) + .05), rect: rect.toJSON(), pointerEvents: css.pointerEvents, overlapsStamp: Boolean(stamp && rect.left < stamp.right && rect.right > stamp.left && rect.top < stamp.bottom && rect.bottom > stamp.top) };
  }));
  expect(paint.length).toBeGreaterThan(0);
  for (const badge of paint) { expect(badge.contrast).toBeGreaterThanOrEqual(4.5); expect(badge.pointerEvents).toBe("none"); expect(badge.overlapsStamp).toBe(false); }
  proofs.get(page)!.phases.push({ label, badgePaint: paint });
}

test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page); if (!proof) return;
  mkdirSync(output, { recursive: true }); const label = info.title.replace(/[^a-z0-9]+/gi, "-");
  writeFileSync(`${output}/${label}.json`, JSON.stringify({ ...proof, status: info.status, url: page.url(), final: await read(page).catch(() => null) }, null, 2));
  await page.screenshot({ path: `${output}/${label}-final.png` }).catch(() => {});
  expect(proof.writes).toEqual([]); expect(proof.errors).toEqual([]);
});

for (const surface of ["viewer", "studio", "preview"] as const) test(`113 ${surface}: legacy migration, seeded storage discoveries and shared native per-item acknowledgement survive reload`, async ({ page, context }) => {
  await fixture(page, context, surface);
  let dialog = await settings(page);
  await counts(page, { foods: 0, memories: 0, accessories: 0, total: 0 }, "legacy items are already seen");
  await expect(dialog.locator("[data-unread]")).toHaveCount(0);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  dialog = await book(page); await expect(dialog.locator("[data-unread]")).toHaveCount(0);
  await newlyDiscoveredInAnotherTab(page, context);
  const six = { foods: 2, memories: 2, accessories: 2, total: 6 };
  await counts(page, six, "seeded cross-tab discoveries have not been inspected");
  await expect(dialog.locator('[data-profile-page="discover"]')).toHaveAttribute("data-unread", /.+/);
  await expect(dialog.locator('[data-profile-page="dress"]')).toHaveAttribute("data-unread", /.+/);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  const entry = page.getByRole("button", { name: "빅타민 수첩 열기", exact: true }); await expect(entry).toHaveAttribute("data-unread", /.+/); await expect(entry.locator(".vc-book-unread")).toHaveText("!");
  await inspectBadgePaint(page, entry, "house book unread contrast and inert hit plane");
  mkdirSync(output, { recursive: true }); await entry.screenshot({ path: `${output}/${surface}-house-book-unread.png` });
  dialog = await settings(page); await dialog.getByRole("tab", { name: "도감", exact: true }).click();
  await expect(dialog.getByRole("button", { name: /^냠냠 도감 / })).toHaveAttribute("data-unread", /.+/);
  await counts(page, six, "settings open and tab switch never acknowledge");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); dialog = await book(page);
  await dialog.getByRole("tab", { name: "도감", exact: true }).click();
  const foodLast = dialog.locator('[data-food-index="179"]'); await turnUntil(dialog, foodLast, "다음 페이지");
  await foodLast.focus(); await counts(page, six, "page navigation and focus never acknowledge");
  await page.setViewportSize({ width: 1100, height: 640 }); await settlePanelLayout(page); await counts(page, six, "responsive automatic page adjustment never acknowledges");
  await page.setViewportSize({ width: 1440, height: 900 }); await settlePanelLayout(page); await turnUntil(dialog, foodLast, "다음 페이지");
  await expect(foodLast).toHaveAttribute("data-unread", /.+/);
  await inspectBadgePaint(page, dialog, "shared unread badges contrast and separate stamp corner");
  mkdirSync(output, { recursive: true }); await dialog.screenshot({ path: `${output}/${surface}-food-unread.png` });
  await foodLast.click(); await expect(foodLast).not.toHaveAttribute("data-unread");
  await counts(page, { foods: 1, memories: 2, accessories: 2, total: 5 }, "native food pointer clears only that item");
  const foodOne = dialog.locator('[data-food-index="1"]'); await turnUntil(dialog, foodOne, "이전 페이지");
  await foodOne.focus(); await expect(foodOne).toHaveAttribute("data-unread", /.+/);
  await dialog.locator('[data-food-index="0"]').focus(); await page.keyboard.press("ArrowRight");
  await expect(foodOne).toBeFocused();
  await counts(page, { foods: 0, memories: 2, accessories: 2, total: 4 }, "native tile Arrow selection acknowledges");
  await dialog.getByRole("button", { name: /^추억 도감 / }).click();
  const behavior = dialog.locator('[data-collection-index="1"]'); await expect(behavior).toHaveAttribute("data-unread", /.+/); await behavior.click();
  await counts(page, { foods: 0, memories: 1, accessories: 2, total: 3 }, "behavior pointer leaves situation unread");
  const moment = dialog.locator(`[data-collection-index="${COMPANION_BEHAVIOR_IDS.length}"]`); await turnUntil(dialog, moment, "다음 페이지");
  await moment.focus(); await expect(moment).toHaveAttribute("data-unread", /.+/); await moment.press("Space");
  await counts(page, { foods: 0, memories: 0, accessories: 2, total: 2 }, "situation keyboard acknowledges");
  await dialog.getByRole("tab", { name: "옷장", exact: true }).click();
  const accessoryLast = dialog.locator(`[data-accessory="${COMPANION_WEARABLE_IDS.at(-1)}"]`); await turnUntil(dialog, accessoryLast, "다음 페이지");
  await accessoryLast.focus(); await expect(accessoryLast).toHaveAttribute("data-unread", /.+/);
  await counts(page, { foods: 0, memories: 0, accessories: 2, total: 2 }, "wardrobe pages and focus never acknowledge");
  await accessoryLast.press("Enter");
  await counts(page, { foods: 0, memories: 0, accessories: 1, total: 1 }, "accessory keyboard clears only that item");
  const accessoryOne = dialog.locator(`[data-accessory="${COMPANION_WEARABLE_IDS[1]}"]`); await turnUntil(dialog, accessoryOne, "이전 페이지"); await accessoryOne.click();
  await counts(page, { foods: 0, memories: 0, accessories: 0, total: 0 }, "last accessory pointer acknowledges");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(entry).not.toHaveAttribute("data-unread");
  const acknowledged = await read(page); await visit(page, surface); dialog = await settings(page);
  await counts(page, { foods: 0, memories: 0, accessories: 0, total: 0 }, "reload preserves explicit acknowledgements");
  expect((await read(page)).seen).toEqual(acknowledged.seen); await expect(dialog.locator("[data-unread]")).toHaveCount(0);
});

test("113 seeded pending gift: native opening selects the received accessory without acknowledging it", async ({ page, context }) => {
  await fixture(page, context, "viewer"); let dialog = await book(page);
  const before = await read(page), accessory = COMPANION_WEARABLE_IDS[1];
  await writeFromOtherTab(page, context, { ...before, gifts: { ...before.gifts, pending: accessory }, seen: { foods: [...before.foods], behaviors: [...before.behaviors], situations: [...before.situations], accessories: [...before.gifts.unlocked] } });
  await counts(page, { foods: 0, memories: 0, accessories: 0, total: 0 }, "seeded unopened pending gift is not an owned discovery");
  await dialog.getByRole("tab", { name: "옷장", exact: true }).click(); await dialog.getByRole("button", { name: "선물 열기", exact: true }).click();
  const received = dialog.locator(`[data-accessory="${accessory}"]`);
  await expect(received).toHaveAttribute("aria-pressed", "true"); await expect(received).toHaveAttribute("data-unread", /.+/);
  await expect.poll(async () => unread(await read(page)).accessories).toBe(1);
  const opened = await read(page); expect(opened.gifts.pending).toBeNull(); expect(opened.gifts.unlocked).toContain(accessory);
  proofs.get(page)!.phases.push({ label: "seeded pending gift, actual native open; automatic selected accessory remains unread", state: opened });
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); dialog = await settings(page); await dialog.getByRole("tab", { name: "옷장", exact: true }).click();
  const tile = dialog.locator(`[data-accessory="${accessory}"]`); await expect(tile).toHaveAttribute("data-unread", /.+/); await tile.focus();
  expect(unread(await read(page)).accessories).toBe(1); await tile.press("Enter");
  await expect.poll(async () => unread(await read(page)).accessories).toBe(0);
  expect((await read(page)).situations).toEqual(opened.situations);
  expect(unread(await read(page)).memories).toBe(unread(opened).memories);
});

test("113 actual meal: recent-food automatic selection leaves unread in book and settings until native inspection", async ({ page, context }) => {
  test.setTimeout(125000); await page.setViewportSize({ width: 1920, height: 1100 });
  await fixture(page, context, "viewer", true); await openCompanionHome(page);
  const calendar = page.locator(".public-calendar-area").first(), box = (await calendar.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + 12); await page.keyboard.down("Control");
  try { for (let step = 1; step < CAL_ZOOM_STEPS.length; step++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(250); } } finally { await page.keyboard.up("Control"); }
  await page.setViewportSize({ width: 1920, height: 700 }); await settlePanelLayout(page);
  const floor = await page.evaluate(() => {
    const bars = [...document.querySelectorAll<HTMLElement>(".agenda-monthbar")].filter(node => getComputedStyle(node).position === "fixed").map(node => node.getBoundingClientRect());
    return Math.min(innerHeight - 18, ...bars.filter(rect => rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1).map(rect => rect.top - 8));
  });
  const actor = page.locator(".vc-actor"), pet = page.locator(".vc-companion");
  await expect(actor).toBeVisible(); await actor.focus(); await expect(actor).toBeFocused(); await actor.press("p"); await expect(pet).toHaveAttribute("data-placing", "");
  await page.mouse.click(740, floor); await page.mouse.move(1880, 50); await expect(pet).not.toHaveAttribute("data-state", "jump");
  await actor.focus(); await actor.press("Space"); await expect(pet).toHaveAttribute("data-state", "held");
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  const food = page.locator(".vc-food"); await expect(food).toHaveCount(1);
  const kind = (await food.getAttribute("data-kind"))!, index = COMPANION_FOOD_KINDS.indexOf(kind as typeof COMPANION_FOOD_KINDS[number]); expect(index).toBeGreaterThanOrEqual(0);
  const grip = (await food.boundingBox())!, at = await food.evaluate(node => { const m = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return { x: m.m41, y: m.m42 }; });
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
  await page.mouse.move(1100 + grip.x + grip.width / 2 - at.x, floor - 5 + grip.y + grip.height / 2 - at.y, { steps: 14 }); await page.mouse.up(); await page.mouse.move(1880, 50);
  await expect(food).not.toHaveAttribute("data-falling");
  await actor.focus(); await actor.press("Space"); await page.mouse.move(1880, 50);
  await expect(food).toHaveCount(0, { timeout: 85000 });
  const consumed = await read(page); expect(consumed.foods).toContain(kind); expect(unread(consumed).foods).toBe(1);
  proofs.get(page)!.phases.push({ label: "actual native food consumed; no RNG/clock/pose injection", kind, state: consumed });
  let dialog = await book(page); await dialog.getByRole("tab", { name: "도감", exact: true }).click();
  const recent = dialog.locator(`.rhh-food-grid [data-food-index="${index}"]`);
  await expect(recent).toHaveAttribute("data-recent", /.+/); await expect(recent).toHaveAttribute("aria-pressed", "true"); await expect(recent).toHaveAttribute("data-unread", /.+/);
  expect(unread(await read(page)).foods).toBe(1); mkdirSync(output, { recursive: true }); await dialog.screenshot({ path: `${output}/actual-meal-book-unread.png` });
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); dialog = await settings(page); await dialog.getByRole("tab", { name: "도감", exact: true }).click();
  await expect(dialog.locator(`.rhh-food-grid [data-food-index="${index}"]`)).toHaveAttribute("data-unread", /.+/);
  expect(unread(await read(page)).foods).toBe(1);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await page.reload(); await page.bringToFront(); await settlePanelLayout(page);
  dialog = await book(page); await dialog.getByRole("tab", { name: "도감", exact: true }).click();
  expect(unread(await read(page)).foods).toBe(1);
  const tile = dialog.locator(`.rhh-food-grid [data-food-index="${index}"]`); await turnUntil(dialog, tile, "다음 페이지"); await expect(tile).toHaveAttribute("data-unread", /.+/); await tile.click();
  await expect.poll(async () => unread(await read(page)).foods).toBe(0); await expect(tile).not.toHaveAttribute("data-unread");
  proofs.get(page)!.phases.push({ label: "actual meal unread survives automatic selection/surface change/reload, then native tile inspection acknowledges", kind, state: await read(page) });
});

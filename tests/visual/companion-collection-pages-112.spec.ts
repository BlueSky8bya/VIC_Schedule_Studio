import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_COLLECTION_KEY, COMPANION_BEHAVIOR_IDS, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { COMPANION_PERSONALITY_NAMES, DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FOOD_BOOK_ORDER as COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/collection-book-order";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";
import { selectCompanionCollectionIndex } from "./helpers/companion-collection";
test.use({ viewport: { width: 1440, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
type Surface = "viewer" | "studio" | "preview";
type FixtureOptions = { theme?: "light" | "dark"; collection?: CompanionCollection; reduce?: boolean; graphics?: "max" | "off" | "soft"; enabled?: boolean };

async function installFixture(page: Page, { theme = "light", collection, reduce = true, graphics = "max", enabled = false }: FixtureOptions = {}) {
  const writes: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await page.route("**/*", route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname === "/visual-fixture/studio" && previewReads.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { writes.push(pathname); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    if (request.method() === "GET" && (pathname === "/" || pathname === "/studio")) return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, care, life, key, epoch, theme, collection, collectionKey, reduce, graphics, enabled }) => {
    if (localStorage.getItem("fixture.discovery107")) return;
    localStorage.setItem("fixture.discovery107", "seeded");
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": theme === "dark" ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": reduce ? "on" : "off", "vic.gfxPref": graphics === "soft" ? "auto" : graphics })) localStorage.setItem(name, value);
    if (graphics === "soft") localStorage.setItem("vic.gfx", JSON.stringify({ mode: "soft", at: Date.now(), v: 3 }));
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: .23, affection: .64, habits: { sociability: .6, playfulness: .3, confidence: .5, credit: 0, generation: 0 }, life }));
    if (collection) localStorage.setItem(collectionKey, JSON.stringify(collection));
    else localStorage.removeItem(collectionKey);
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, life: createCompanionLife(() => 0), key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, theme, collection, collectionKey: COMPANION_COLLECTION_KEY, reduce, graphics, enabled });
  return { writes, errors };
}

async function openProfile(page: Page) {
  await page.bringToFront(); await settlePanelLayout(page);
  if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) {
    await page.getByRole("button", { name: "패널 접기", exact: true }).click();
    await settlePanelLayout(page);
  }
  const settings = page.getByRole("button", { name: "설정", exact: true });
  if (!await settings.isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  const profile = dialog.locator(".rhh-companion-profile");
  const together = profile.getByRole("tabpanel", { name: "함께 지내기", exact: true });
  await expect(together).toBeVisible();
  await expect(together.getByRole("region", { name: COMPANION_PERSONALITY_NAMES[DEFAULT_COMPANION_PREFERENCES.personality], exact: true })).toBeVisible();
  await expect(together.getByRole("button", { name: "옷장 열기", exact: true })).toBeVisible();
  return { dialog, profile, nav: profile.getByRole("tablist", { name: "빅타민 프로필", exact: true }) };
}

async function visitSurface(page: Page, surface: Surface) {
  await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
}

const readCollection = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as CompanionCollection, COMPANION_COLLECTION_KEY);

async function openCompanionBook(page: Page) {
  await page.bringToFront(); await settlePanelLayout(page);
  const entry = page.getByRole("button", { name: "빅타민 수첩 열기", exact: true });
  const home = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
  const fold = page.locator('.vc-home [data-act="companion-home-fold"]');
  await expect.poll(async () => await entry.isVisible() || await home.isVisible() || await fold.isVisible()).toBe(true);
  if (!await entry.isVisible()) {
    if (await home.isVisible()) await home.click();
    else await fold.click();
  }
  await expect(entry).toBeVisible(); await settlePanelLayout(page);
  await expect(entry).toHaveAttribute("data-act", "companion-book-open");
  await entry.click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveClass(/companion-book/);
  await expect(dialog.getByRole("tablist", { name: "설정 묶음", exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab")).toHaveText(["함께 지내기", "도감", "옷장", "환경설정"]);
  await expect(dialog.getByRole("button", { name: "옷장 열기", exact: true })).toBeVisible();
  await expect(dialog.getByRole("switch")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "닫기", exact: true })).toHaveAttribute("data-act", "companion-book-close");
  return { dialog, entry };
}



const output112 = process.env.COMPANION112_COLLECTION_OUTPUT ?? ".scratch-pw/companion-112/collection/native";
const catalogue112: CompanionCollection = { version: 1, foods: COMPANION_FOOD_KINDS.filter((_, index) => index !== 5), behaviors: COMPANION_BEHAVIOR_IDS.filter((_, index) => index !== 5), situations: [...COMPANION_SITUATION_IDS], gifts: { pending: null, unlocked: [...COMPANION_WEARABLE_IDS].filter((_, index) => index !== 5), equipped: "sunglasses", activeMs: 0, interactionCredit: 0 } };
async function sheet112(page: Page, name: string) {
  const sheet = page.locator(".rhh-collection-book:visible");
  await expect(sheet).toBeVisible();
  mkdirSync(output112, { recursive: true });
  await page.getByRole("dialog").screenshot({ path: `${output112}/${name}-initial.png` });
  writeFileSync(`${output112}/${name}-ancestors.json`, JSON.stringify(await sheet.evaluate(node => { const chain = []; for (let e: HTMLElement | null = node as HTMLElement; e; e = e.parentElement) { const s = getComputedStyle(e); chain.push({ cls: e.className, rect: e.getBoundingClientRect().toJSON(), display: s.display, height: s.height, flex: s.flex, min: s.minHeight, overflow: s.overflow }); } return chain; }), null, 2));
  await expect.poll(() => sheet.locator(".rhh-collection-grid").evaluate(node => node.getBoundingClientRect().height)).toBeGreaterThan(50);
  const geometry = await sheet.evaluate(node => {
    const rect = node.getBoundingClientRect(), list = node.querySelector("ul")!, grid = list.getBoundingClientRect();
    const ancestors: { className: string; overflow: number; scroll: number }[] = [];
    for (let element: HTMLElement | null = node as HTMLElement; element && !element.classList.contains("modal-card"); element = element.parentElement) ancestors.push({ className: element.className, overflow: element.scrollHeight - element.clientHeight, scroll: element.scrollTop });
    return { rect: rect.toJSON(), grid: grid.toJSON(), height: innerHeight, ancestors, buttons: [...node.querySelectorAll<HTMLButtonElement>("button")].map(button => ({ text: button.getAttribute("aria-label") ?? button.textContent, rect: button.getBoundingClientRect().toJSON() })), tiles: list.querySelectorAll("button").length, gridOverflow: list.scrollHeight - list.clientHeight, detailPosition: getComputedStyle(node.querySelector(".rhh-collection-detail")!).position };
  });
  expect(geometry.rect.bottom).toBeLessThanOrEqual(geometry.height - 8);
  expect(geometry.gridOverflow).toBeLessThanOrEqual(2); expect(geometry.detailPosition).toBe("static");
  expect(geometry.ancestors.filter(item => item.overflow > 2)).toEqual([]);
  expect(geometry.tiles).toBeGreaterThan(0); expect(geometry.tiles).toBeLessThanOrEqual(24);
  await expect(sheet.locator(".rhh-collection-stamp")).toHaveCount(0);
  for (const button of geometry.buttons) { expect(button.rect.width, button.text ?? "button").toBeGreaterThanOrEqual(43.9); expect(button.rect.height, button.text ?? "button").toBeGreaterThanOrEqual(43.9); expect(button.rect.bottom).toBeLessThanOrEqual(geometry.height - 8); }
  const before = geometry.ancestors.map(item => item.scroll);
  await sheet.locator(".rhh-collection-grid").hover(); await page.mouse.wheel(0, 900);
  const after = await sheet.evaluate(node => { const values: number[] = []; for (let element: HTMLElement | null = node as HTMLElement; element && !element.classList.contains("modal-card"); element = element.parentElement) values.push(element.scrollTop); return values; });
  expect(after).toEqual(before);
  mkdirSync(output112, { recursive: true }); writeFileSync(`${output112}/${name}.json`, JSON.stringify(geometry, null, 2));
  await page.getByRole("dialog").screenshot({ path: `${output112}/${name}.png` });
  return sheet;
}

test("112 baseline: capture previous long scroll and sticky overlap", async ({ page }) => {
  test.skip(process.env.COMPANION112_BASELINE !== "1", "Historical baseline only, never a final PASS claim");
  await page.setViewportSize({ width: 1440, height: 900 });
  const safety = await installFixture(page, { collection: catalogue112, enabled: true }); await visitSurface(page, "viewer");
  const { dialog, profile, nav } = await openProfile(page); await nav.getByRole("tab", { name: "도감", exact: true }).click();
  const body = dialog.locator(".rhh-panes"); await expect(profile.locator(".rhh-food-grid button")).toHaveCount(24);
  mkdirSync(output112, { recursive: true }); await dialog.screenshot({ path: `${output112}/baseline-before.png` });
  const before = await body.evaluate(node => ({ scroll: node.scrollTop, client: node.clientHeight, full: node.scrollHeight }));
  await body.hover(); await page.mouse.wheel(0, 460); await expect.poll(() => body.evaluate(node => node.scrollTop)).toBeGreaterThan(before.scroll);
  await dialog.screenshot({ path: `${output112}/baseline-after-wheel.png` });
  writeFileSync(`${output112}/baseline.json`, JSON.stringify({ before, after: await body.evaluate(node => ({ scroll: node.scrollTop, client: node.clientHeight, full: node.scrollHeight })), errors: safety.errors, writes: safety.writes }, null, 2));
});

for (const surface of ["viewer", "studio", "preview"] as const) for (const theme of ["light", "dark"] as const) test(`112 pages ${surface} ${theme}: native finite foods memories wardrobe, resize, keyboard and book`, async ({ page }) => {
  test.skip(process.env.COMPANION112_BASELINE === "1", "Separate baseline run"); test.setTimeout(100000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const safety = await installFixture(page, { theme, collection: catalogue112, enabled: true }); await visitSurface(page, surface);
  const { dialog, profile, nav } = await openProfile(page), before = await readCollection(page);
  await nav.getByRole("tab", { name: "도감", exact: true }).click();
  const foodGrid = profile.locator(".rhh-food-grid"); await expect(foodGrid).toBeVisible();
  await sheet112(page, `${surface}-${theme}-food-tall`);
  await foodGrid.locator("button[tabindex='0']").focus(); await page.keyboard.press("End");
  await expect(foodGrid.locator('[data-food-index="179"]')).toBeFocused(); await expect(profile.getByRole("button", { name: "다음 페이지", exact: true })).toBeDisabled();
  await page.keyboard.press("Home"); await expect(foodGrid.locator('[data-food-index="0"]')).toBeFocused();
  await selectCompanionCollectionIndex(page, foodGrid, 5);
  await expect(foodGrid.locator('[data-food-index="5"]')).toBeFocused(); await expect(profile.locator(".rhh-food-detail strong")).toHaveText("???"); await expect(foodGrid.locator('[data-food-index="5"]')).not.toHaveAttribute("data-found");
  await page.setViewportSize({ width: 1050, height: 640 });
  //131 reserves two readable rows on the short sheet; its measured width can
  //still fit six columns. Verify that real grid rather than112's old8 cap.
  await expect.poll(() => foodGrid.evaluate(node => getComputedStyle(node).gridTemplateRows.trim().split(/\s+/).length)).toBe(2);
  const shortColumns = await foodGrid.evaluate(node => getComputedStyle(node).gridTemplateColumns.trim().split(/\s+/).length);
  expect(shortColumns).toBeGreaterThanOrEqual(2); expect(shortColumns).toBeLessThanOrEqual(6);
  await expect(foodGrid.locator("button")).toHaveCount(shortColumns * 2);
  await expect(foodGrid.locator('[data-food-index="5"]')).toHaveAttribute("aria-pressed", "true");
  await sheet112(page, `${surface}-${theme}-food-short`);
  await profile.getByRole("button", { name: /^추억 도감 / }).click();
  const memories = profile.locator(".rhh-behavior-grid"); await memories.locator("button[tabindex='0']").focus(); await page.keyboard.press("End");
  await expect(memories.locator('[data-collection-index="23"]')).toBeFocused(); await expect(profile.getByRole("button", { name: "다음 페이지", exact: true })).toBeDisabled();
  await sheet112(page, `${surface}-${theme}-memories-short`);
  await nav.getByRole("tab", { name: "옷장", exact: true }).click();
  const wardrobe = profile.locator(".rhh-accessory-grid"); await expect(profile.locator('.rhh-wardrobe-preview')).toHaveAttribute("data-preview-accessory", "sunglasses");
  await wardrobe.locator("button[tabindex='0']").focus(); await page.keyboard.press("End");
  await expect(wardrobe.locator(`[data-accessory="${COMPANION_WEARABLE_IDS.at(-1)}"]`)).toBeFocused();
  await sheet112(page, `${surface}-${theme}-wardrobe-short`);
  await page.keyboard.press("Home"); await expect(wardrobe.locator('[data-accessory="sunglasses"]')).toBeFocused();
  await profile.locator('.rhh-wardrobe-detail [data-act="companion-accessory-equip"]').click();
  await expect.poll(async () => (await readCollection(page)).gifts.equipped).toBeNull();
  await expect(profile.locator('.rhh-wardrobe-preview')).toHaveAttribute("data-preview-accessory", "none");
  const after = await readCollection(page); expect(after.foods).toEqual(before.foods); expect(after.behaviors).toEqual(before.behaviors); expect(after.situations).toEqual(before.situations);
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  const book = await openCompanionBook(page); await book.dialog.getByRole("tab", { name: "도감", exact: true }).click();
  await sheet112(page, `${surface}-${theme}-book-short`);
  await page.keyboard.press("Escape"); await expect(book.dialog).toHaveCount(0);
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

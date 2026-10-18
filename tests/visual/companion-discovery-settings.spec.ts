import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_COLLECTION_KEY, COMPANION_BEHAVIOR_IDS, COMPANION_SITUATION_IDS, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { companionFoodChance, COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_FOOD_FACTS } from "@/lib/ui/viewer-companion/food-facts";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";
import { selectCompanionCollectionIndex } from "./helpers/companion-collection";

const regressionOutput = process.env.COMPANION112_COLLECTION_REGRESSION_OUTPUT ?? ".scratch-pw/companion-112/collection/regression";

test.use({ viewport: { width: 1440, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
type Surface = "viewer" | "studio" | "preview";
type FixtureOptions = { theme?: "light" | "dark"; collection?: CompanionCollection; reduce?: boolean; graphics?: "max" | "off" | "soft"; enabled?: boolean };
const seededCollection: CompanionCollection = { version: 1, situations: ["meal-finished"], foods: ["apple", "peach"], behaviors: ["ask-petting", "doze-curl"], gifts: { pending: "beret", unlocked: ["sunglasses"], equipped: "sunglasses", activeMs: 300000, interactionCredit: 1 } };

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
  await expect(profile.getByRole("region", { name: "빅타민 특성", exact: true })).toBeVisible();
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

async function openEnvironment(dialog: ReturnType<Page["getByRole"]>) {
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  await expect(dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab")).toHaveText(["기본", "움직임", "장난", "교감", "소리"]);
}

for (const surface of ["viewer", "studio", "preview"] as const) for (const theme of ["light", "dark"] as const) {
  test(`111 book ${surface} ${theme}: native direct settings share preferences and return focus after both close paths`, async ({ page }) => {
    const safety = await installFixture(page, { theme, collection: seededCollection, enabled: true });
    await visitSurface(page, surface);
    const { dialog, entry } = await openCompanionBook(page);
    await openEnvironment(dialog);
    const controls = dialog.getByRole("tablist", { name: "빅타민 설정", exact: true });
    await dialog.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true }).getByRole("radio", { name: "고양이", exact: true }).click();
    await dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).getByRole("radio", { name: "잠꾸러기", exact: true }).click();
    await controls.getByRole("tab", { name: "움직임", exact: true }).click();
    await dialog.getByRole("radiogroup", { name: "빅타민 걸음", exact: true }).getByRole("radio", { name: "발랄하게", exact: true }).click();
    await controls.getByRole("tab", { name: "교감", exact: true }).click();
    const feed = dialog.getByRole("switch", { name: "빅타민 밥주기 켜기/끄기", exact: true });
    await expect(feed).toHaveAttribute("aria-checked", "false"); await feed.click();
    await expect.poll(() => page.evaluate(() => {
      const prefs = JSON.parse(localStorage.getItem("vic.viewerCompanion")!);
      return [prefs.animalMode, prefs.personality, prefs.speed, prefs.feeding];
    })).toEqual(["cat", "sleepy", "lively", true]);
    await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "함께 지내기", exact: true }).click();
    await settlePanelLayout(page);
    mkdirSync(`${regressionOutput}/book`, { recursive: true });
    await page.screenshot({ path: `${regressionOutput}/book/${surface}-${theme}-book.png` });
    // Wheel the real book page, rather than accepting a masked/clipped body
    // just because Playwright can programmatically scroll a control into view.
    const body = dialog.locator(".rhh-companion-book-pages");
    const beforeWheel = await body.evaluate(element => element.scrollTop);
    await body.hover(); await page.mouse.wheel(0, 540);
    await expect.poll(() => body.evaluate(element => element.scrollTop)).toBeGreaterThan(beforeWheel);
    await openEnvironment(dialog);
    await controls.getByRole("tab", { name: "소리", exact: true }).click();
    await dialog.locator(".rhh-radio-playlist summary").click();
    const playlist = dialog.locator(".rhh-radio-playlist ul"), lastTrack = playlist.getByRole("checkbox").last();
    await playlist.hover(); await page.mouse.wheel(0, 2800);
    await expect(lastTrack).toBeInViewport({ ratio: 1 });
    await lastTrack.focus(); await expect(lastTrack).toBeFocused();
    await page.screenshot({ path: `${regressionOutput}/book/${surface}-${theme}-playlist-end.png` });
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await test.info().attach("book-close-focus", { body: JSON.stringify(await page.evaluate(() => ({ active: document.activeElement?.outerHTML.slice(0, 600), book: [...document.querySelectorAll<HTMLElement>('[data-act="companion-book-open"]')].map(node => ({ connected: node.isConnected, inert: Boolean(node.closest("[inert],[hidden]")), rect: node.getBoundingClientRect().toJSON() })) }))), contentType: "application/json" });
    await expect(dialog).toHaveCount(0); await expect(entry).toBeFocused();
    const reopened = await openCompanionBook(page);
    await openEnvironment(reopened.dialog);
    await expect(reopened.dialog.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true }).getByRole("radio", { name: "고양이", exact: true })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await expect(reopened.dialog).toHaveCount(0); await expect(entry).toBeFocused();
    const normal = await openProfile(page);
    await openEnvironment(normal.dialog);
    await expect(normal.dialog).not.toHaveClass(/companion-book/);
    await expect(normal.dialog.getByRole("tablist", { name: "설정 묶음", exact: true })).toBeVisible();
    await expect(normal.dialog.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true }).getByRole("radio", { name: "고양이", exact: true })).toHaveAttribute("aria-checked", "true");
    await expect(normal.dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).getByRole("radio", { name: "잠꾸러기", exact: true })).toHaveAttribute("aria-checked", "true");
    await normal.dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "움직임", exact: true }).click();
    await expect(normal.dialog.getByRole("radiogroup", { name: "빅타민 걸음", exact: true }).getByRole("radio", { name: "발랄하게", exact: true })).toHaveAttribute("aria-checked", "true");
    await normal.dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "교감", exact: true }).click();
    await expect(normal.dialog.getByRole("switch", { name: "빅타민 밥주기 켜기/끄기", exact: true })).toHaveAttribute("aria-checked", "true");
    expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
  });
}

for (const surface of ["viewer", "studio"] as const) {
  test(`111 book ${surface} OFF: closing after the house unmounts restores the visible standard settings entry`, async ({ page }) => {
    const safety = await installFixture(page, { collection: seededCollection, enabled: true });
    await visitSurface(page, surface);
    const gearWasVisible = await page.getByRole("button", { name: "설정", exact: true }).isVisible();
    const { dialog } = await openCompanionBook(page);
    await openEnvironment(dialog);
    await dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
    await expect(dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true })).toHaveAttribute("aria-checked", "false");
    await expect(page.locator(".vc-home,.vc-book-button")).toHaveCount(0);
    if (surface === "viewer") await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    else await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    const gear = page.getByRole("button", { name: "설정", exact: true });
    expect(await gear.isVisible()).toBe(gearWasVisible);
    // Compact studio keeps its settings button inside the collapsed panel.
    // The visible panel opener is the usable recovery target in that layout.
    const recovery = await gear.isVisible() ? gear : page.getByRole("button", { name: "패널 펼치기", exact: true });
    await expect(recovery).toBeVisible(); await expect(recovery).toBeFocused();
    if (!gearWasVisible) {
      await expect(recovery).toHaveAttribute("aria-pressed", "false");
      await recovery.press("Enter"); await settlePanelLayout(page);
      await expect(gear).toBeVisible();
    }
    const normal = await openProfile(page);
    await openEnvironment(normal.dialog);
    await expect(normal.dialog).not.toHaveClass(/companion-book/);
    await expect(normal.dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true })).toHaveAttribute("aria-checked", "false");
    await normal.dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).enabled)).toBe(true);
    await normal.dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(gear).toBeFocused();
    expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
  });
}

test("111 book compact1050: book and radio have separate44px targets and a contained readable page", async ({ page }) => {
  await page.setViewportSize({ width: 1050, height: 1000 });
  const safety = await installFixture(page, { theme: "dark", collection: seededCollection, enabled: true });
  await visitSurface(page, "studio");
  const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
  await expect(launcher).toBeVisible(); await launcher.click(); await settlePanelLayout(page);
  const entry = page.getByRole("button", { name: "빅타민 수첩 열기", exact: true });
  const radio = page.locator(".vc-radio-button:visible");
  await expect(entry).toBeVisible(); await expect(radio).toBeVisible();
  const bookRect = await entry.boundingBox(), radioRect = await radio.boundingBox();
  expect(bookRect).not.toBeNull(); expect(radioRect).not.toBeNull();
  expect(bookRect!.width).toBeGreaterThanOrEqual(44); expect(bookRect!.height).toBeGreaterThanOrEqual(44);
  expect(radioRect!.width).toBeGreaterThanOrEqual(44); expect(radioRect!.height).toBeGreaterThanOrEqual(44);
  expect(Math.min(bookRect!.x + bookRect!.width, radioRect!.x + radioRect!.width) - Math.max(bookRect!.x, radioRect!.x)).toBeLessThanOrEqual(0);
  mkdirSync(`${regressionOutput}/book`, { recursive: true });
  await page.screenshot({ path: `${regressionOutput}/book/compact1050-home.png` });
  const opened = await openCompanionBook(page); await settlePanelLayout(page);
  await expect(opened.dialog).toBeInViewport({ ratio: 1 });
  expect(await opened.dialog.evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.screenshot({ path: `${regressionOutput}/book/compact1050-book.png` });
  await opened.dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(entry).toBeFocused();
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

test("111 book PC to mobile: responsive fallback clears book mode and keeps standard settings on return", async ({ page }) => {
  const safety = await installFixture(page, { collection: seededCollection, enabled: true });
  await visitSurface(page, "viewer");
  await openCompanionBook(page);
  await page.setViewportSize({ width: 390, height: 844 }); await settlePanelLayout(page);
  const settings = page.getByRole("dialog", { name: "설정", exact: true });
  await expect(settings).toBeVisible(); await expect(settings).not.toHaveClass(/companion-book/);
  // Existing phone settings intentionally show a scrolling list of sections,
  // with the desktop-only category rail hidden.
  await expect(settings.getByRole("heading", { name: "글자", exact: true })).toBeVisible();
  await expect(settings.getByRole("slider", { name: "달력 글씨 크기(px)", exact: true })).toBeVisible();
  await expect(settings.getByRole("tab", { name: "빅타민", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "빅타민 수첩", exact: true })).toHaveCount(0);
  await expect(page.locator(".vc-home,.vc-companion,.vc-book-button")).toHaveCount(0);
  mkdirSync(`${regressionOutput}/book`, { recursive: true });
  await page.screenshot({ path: `${regressionOutput}/book/mobile-standard-fallback.png` });
  await page.setViewportSize({ width: 1440, height: 1100 }); await settlePanelLayout(page);
  await expect(settings).toBeVisible(); await expect(settings).not.toHaveClass(/companion-book/);
  await expect(settings.getByRole("tablist", { name: "설정 묶음", exact: true })).toBeVisible();
  await expect(settings.getByRole("tab", { name: "빅타민", exact: true })).toBeVisible();
  await expect(settings.locator(".rhh-companion-book-pages")).toHaveCount(0);
  await settings.getByRole("button", { name: "닫기", exact: true }).click();
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

for (const surface of ["viewer", "studio", "preview"] as const) for (const theme of ["light", "dark"] as const) {
  test(`${surface} ${theme}: real mini-nav discovers, opens, equips and retains local keepsakes`, async ({ page, context }) => {
    const safety = await installFixture(page, { theme, collection: seededCollection });
    mkdirSync(`${regressionOutput}/collection`, { recursive: true });
    await visitSurface(page, surface);
    let { dialog, profile, nav } = await openProfile(page);
    await expect(nav.getByRole("tab")).toHaveText(["함께 지내기", "도감", "옷장", "환경설정"]);
    await expect(profile.locator(".rhh-companion-portrait [data-preview-ready]")).toHaveCount(1);
    await expect(profile.locator(".rhh-companion-portrait [data-preview-accessory=\"sunglasses\"]")).toHaveCount(1);
    await expect(nav.locator('[tabindex="0"]')).toHaveCount(1);
    await expect(dialog.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true })).toHaveCount(0);
    await expect(profile.locator('[data-collection-art="behavior-stamp"],[data-collection-art="accessory"]')).toHaveCount(0);

    await nav.getByRole("tab", { name: "도감", exact: true }).click();
    const foods = profile.locator(".rhh-collection-grid:not(.rhh-behavior-grid):not(.rhh-accessory-grid)");
    await expect.poll(() => foods.getByRole("button").count()).toBeGreaterThan(0);
    expect(await foods.getByRole("button").count()).toBeLessThanOrEqual(24);
    await expect(profile.getByRole("button", { name: `냠냠 도감 2/${COMPANION_FOOD_KINDS.length}`, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(foods.locator("button[data-found]")).toHaveCount(2);
    await expect(foods.locator('[data-collection-art="food-stamp"]')).toHaveCount(2);
    await expect(foods.locator(".rhh-collection-rarity")).toHaveCount(2);
    for (const tile of await foods.locator("button:not([data-found])").all()) {
      await expect(tile).toHaveText("???");
      await expect(tile).toHaveAttribute("aria-label", /^\?\?\? · \d+$/);
      expect(await tile.locator(".vc-collection-art").evaluate(element => getComputedStyle(element).filter)).toContain("brightness(0)");
    }
    await expect(profile.locator('[data-collection-art="behavior-stamp"],[data-collection-art="accessory"]')).toHaveCount(0);
    await foods.getByRole("button", { name: "??? · 3", exact: true }).click();
    await expect(profile.locator(".rhh-collection-detail")).toContainText("아직 맛보기 전");
    await foods.getByRole("button", { name: "사과 · 맛봤어요", exact: true }).click();
    await expect(profile.locator(".rhh-collection-detail")).toContainText("사과");
    await expect(profile.locator(".rhh-collection-detail")).toBeInViewport();
    await expect(profile.locator(".rhh-collection-detail .rhh-collection-rarity")).toHaveText("흔한");
    await expect(profile.locator(".rhh-collection-chance")).toHaveText(`기본 등장 ${(companionFoodChance("apple") * 100).toFixed(1)}%`);
    await expect(profile.locator(".rhh-collection-fact")).toHaveText(COMPANION_FOOD_FACTS.apple);
    await dialog.screenshot({ path: `${regressionOutput}/collection/food-detail-${surface}-${theme}.png` });
    await page.screenshot({ path: `${regressionOutput}/collection/viewport-food-${surface}-${theme}.png` });
    await selectCompanionCollectionIndex(page, foods, 16);
    await expect(profile.locator(".rhh-collection-detail .rhh-collection-rarity")).toHaveCount(0);
    await expect(profile.locator(".rhh-collection-chance")).toHaveCount(0);
    await expect(profile.locator(".rhh-collection-fact")).toHaveText("아직 맛보기 전");
    await expect(profile.locator(".rhh-collection-detail")).not.toContainText("블루베리");
    expect(companionFoodChance("blueberry")).toBeLessThan(companionFoodChance("apple"));
    const fixedTargets = await profile.locator('[data-act="companion-collection-inspect"]').evaluateAll(elements => elements.map(element => element.getAttribute("data-act-opt")));
    expect(new Set(fixedTargets)).toEqual(new Set(["food"]));
    await foods.getByRole("button", { name: "??? · 17", exact: true }).focus();
    await page.keyboard.press("End");
    const lastFood = foods.locator(`[data-food-index="${COMPANION_FOOD_KINDS.length - 1}"]`);
    await expect(lastFood).toBeFocused();
    expect(await foods.getByRole("button").count()).toBeLessThanOrEqual(24);
    await expect(lastFood).toHaveAttribute("aria-label", `??? · ${COMPANION_FOOD_KINDS.length}`);
    await expect(profile.locator(".rhh-collection-detail")).toBeInViewport({ ratio: 1 });
    await expect(profile.locator(".rhh-collection-detail strong")).toHaveText("???");
    await page.screenshot({ path: `${regressionOutput}/collection/viewport-food-deep-${surface}-${theme}.png` });
    await page.keyboard.press("Home");
    await expect(foods.locator('[data-food-index="0"]')).toBeFocused();
    const pageSize = await foods.getByRole("button").count();
    await profile.getByRole("button", { name: "다음 간식", exact: true }).click();
    await expect(foods.locator(`[data-food-index="${pageSize}"]`)).toHaveAttribute("aria-pressed", "true");
    await foods.locator(`[data-food-index="${pageSize}"]`).focus(); await page.keyboard.press("ArrowLeft");
    await expect(foods.locator(`[data-food-index="${pageSize - 1}"]`)).toBeFocused();
    await page.keyboard.press("ArrowRight"); await expect(foods.locator(`[data-food-index="${pageSize}"]`)).toBeFocused();
    await expect(foods.getByRole("button")).toHaveCount(pageSize);
    await profile.getByRole("button", { name: "이전 간식", exact: true }).click();
    await expect(foods.locator('[data-food-index="0"]')).toHaveAttribute("aria-pressed", "true");
    await profile.getByRole("button", { name: "다음 간식", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(foods.locator(`[data-food-index="${pageSize}"]`)).toBeFocused();
    await profile.getByRole("button", { name: "이전 간식", exact: true }).focus(); await page.keyboard.press("Enter");
    await expect(foods.locator('[data-food-index="0"]')).toBeFocused();

    await profile.getByRole("button", { name: "추억 도감 3/24", exact: true }).click();
    const behaviors = profile.locator(".rhh-behavior-grid");
    const memoryTargets = new Set(await behaviors.locator('[data-act="companion-collection-inspect"]').evaluateAll(elements => elements.map(element => element.getAttribute("data-act-opt"))));
    expect(await behaviors.getByRole("button").count()).toBeLessThanOrEqual(24);
    await expect(profile.getByRole("button", { name: "특별한 순간", exact: true })).toHaveCount(0);
    await expect(profile.getByRole("group", { name: "도감 종류", exact: true }).getByRole("button")).toHaveCount(2);
    expect(await behaviors.locator('[data-collection-art="behavior-stamp"]').count()).toBeGreaterThan(0);
    await expect(profile.locator('[data-collection-art="food"]')).toHaveCount(0);
    await selectCompanionCollectionIndex(page, behaviors, 8);
    await expect(profile.locator(".rhh-collection-detail")).not.toContainText("고양이 모드");
    await expect(profile.locator(".rhh-collection-detail")).toContainText("아직 발견하지 못했어요");
    await page.keyboard.press("Home");
    await expect(behaviors.getByRole("button", { name: "쓰담해 줘 · 만났어요", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(behaviors.getByRole("button", { name: "??? · 2", exact: true })).toBeFocused();
    await page.keyboard.press("End");
    await expect(behaviors.getByRole("button", { name: "??? · 24", exact: true })).toBeFocused();
    await expect(profile.locator(".rhh-collection-detail")).toBeInViewport({ ratio: 1 });
    expect(await behaviors.getByRole("button", { name: "??? · 24", exact: true }).evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
    await expect(behaviors.locator('[tabindex="0"]')).toHaveCount(1);
    mkdirSync(`${regressionOutput}/collection`, { recursive: true });
    await dialog.screenshot({ path: `${regressionOutput}/collection/discovery-${surface}-${theme}.png` });
    await selectCompanionCollectionIndex(page, behaviors, 12);
    await expect(profile.locator(".rhh-collection-detail")).toHaveText("???아직 발견하지 못했어요.");
    await selectCompanionCollectionIndex(page, behaviors, COMPANION_BEHAVIOR_IDS.length + COMPANION_SITUATION_IDS.indexOf("meal-finished"));
    await expect(profile.locator(".rhh-collection-detail")).toContainText("싹싹 냠냠");
    await expect(profile.locator(".rhh-collection-detail")).not.toContainText("아직 발견");
    await expect(profile.locator(".rhh-collection-detail")).toBeInViewport({ ratio: 1 });
    expect(await behaviors.locator('[data-collection-art="situation-stamp"]').count()).toBeGreaterThan(0);
    for (const target of await behaviors.locator('[data-act="companion-collection-inspect"]').evaluateAll(elements => elements.map(element => element.getAttribute("data-act-opt")))) memoryTargets.add(target);
    expect(memoryTargets).toEqual(new Set(["behavior", "moment"]));
    await dialog.screenshot({ path: `${regressionOutput}/collection/moments-${surface}-${theme}.png` });
    await page.screenshot({ path: `${regressionOutput}/collection/viewport-moments-deep-${surface}-${theme}.png` });

    await nav.getByRole("tab", { name: "함께 지내기", exact: true }).click();
    await profile.getByRole("button", { name: "옷장 열기", exact: true }).click();
    await expect(nav.getByRole("tab", { name: "옷장", exact: true })).toHaveAttribute("aria-selected", "true");
    const accessories = profile.locator(".rhh-accessory-grid");
    expect(await accessories.getByRole("button").count()).toBeLessThanOrEqual(COMPANION_WEARABLE_IDS.length);
    const wearablePreview = profile.locator(".rhh-wardrobe-detail .rhh-wardrobe-preview");
    await expect(wearablePreview).toHaveAttribute("data-preview-accessory", "sunglasses");
    await expect(accessories.locator("button[data-found]")).toHaveCount(1);
    await expect(profile.getByRole("button", { name: "선물 열기", exact: true })).toBeVisible();
    expect(await readCollection(page)).toEqual(seededCollection);
    await accessories.getByRole("button", { name: "??? · 3", exact: true }).click();
    await expect(profile.locator(".rhh-collection-detail").getByRole("button", { name: /^(장착하기|벗기기)$/ })).toHaveCount(0);
    await accessories.getByRole("button", { name: "??? · 3", exact: true }).press("End");
    await expect(accessories.getByRole("button", { name: `??? · ${COMPANION_WEARABLE_IDS.length}`, exact: true })).toBeFocused();
    await expect(profile.locator(".rhh-collection-detail")).toBeInViewport({ ratio: 1 });
    await expect(profile.locator(".rhh-collection-detail strong")).toHaveText("???");
    await page.screenshot({ path: `${regressionOutput}/collection/viewport-wardrobe-deep-${surface}-${theme}.png` });
    await profile.getByRole("button", { name: "선물 열기", exact: true }).click();
    await expect(profile.getByRole("button", { name: "선물 열기", exact: true })).toHaveCount(0);
    await expect(accessories.locator('[data-accessory="beret"]')).toBeFocused();
    expect((await readCollection(page)).gifts).toMatchObject({ pending: null, unlocked: ["sunglasses", "beret"], equipped: "sunglasses" });
    await profile.locator(".rhh-collection-detail").getByRole("button", { name: "장착하기", exact: true }).click();
    await expect(accessories.getByRole("button", { name: "베레모 · 장착 중", exact: true })).toBeVisible();
    expect((await readCollection(page)).gifts.equipped).toBe("beret");
    await accessories.locator('[data-accessory="sunglasses"]').click();
    await profile.locator(".rhh-equipped-current").getByRole("button", { name: "벗기기", exact: true }).click();
    await expect(accessories.locator('[data-accessory="sunglasses"]')).toBeFocused();
    expect((await readCollection(page)).gifts.equipped).toBeNull();
    await expect(wearablePreview).toHaveAttribute("data-preview-accessory", "none");
    await expect(wearablePreview.locator(".vc-wearable-back,.vc-wearable-front")).toHaveCount(2);
    expect(await wearablePreview.locator(".vc-wearable-back,.vc-wearable-front").evaluateAll(nodes => nodes.every(node => (node as HTMLElement).hidden))).toBe(true);
    await accessories.locator('[data-accessory="beret"]').click();
    await profile.locator(".rhh-collection-detail").getByRole("button", { name: "장착하기", exact: true }).click();
    const wornButton = profile.locator(".rhh-collection-detail").getByRole("button", { name: "벗기기", exact: true });
    const primaryContrast = await wornButton.evaluate(node => {
      const style = getComputedStyle(node), canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
      const context = canvas.getContext("2d")!;
      const luminance = (value: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(channel => { const x = channel / 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }).reduce((sum, x, index) => sum + x * [.2126, .7152, .0722][index], 0); };
      const foreground = luminance(style.color), background = luminance(style.backgroundColor);
      return { color: style.color, background: style.backgroundColor, ratio: (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05) };
    });
    await test.info().attach("wardrobe-primary-contrast", { body: JSON.stringify(primaryContrast), contentType: "application/json" });
    expect(primaryContrast.ratio).toBeGreaterThanOrEqual(4.5);
    // Cover the selected item's primary action as well as the current-outfit
    // footer above: both must clear actual pixels, not merely a stored label.
    await wornButton.click();
    expect((await readCollection(page)).gifts.equipped).toBeNull();
    await expect(wearablePreview).toHaveAttribute("data-preview-accessory", "none");
    expect(await wearablePreview.locator(".vc-wearable-back,.vc-wearable-front").evaluateAll(nodes => nodes.every(node => (node as HTMLElement).hidden))).toBe(true);
    await accessories.locator('[data-accessory="beret"]').click();
    await profile.locator(".rhh-collection-detail").getByRole("button", { name: "장착하기", exact: true }).click();
    await expect(wearablePreview).toHaveAttribute("data-preview-accessory", "beret");
    await dialog.screenshot({ path: `${regressionOutput}/collection/gifts-${surface}-${theme}.png` });

    const keepsakes = await readCollection(page);
    await openEnvironment(dialog);
    await dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true }).click();
    await dialog.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
    expect(await readCollection(page)).toEqual(keepsakes);
    await expect(profile).toContainText("도감·선물 유지");
    await nav.getByRole("tab", { name: "함께 지내기", exact: true }).click();
    await nav.getByRole("tab", { name: "함께 지내기", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(nav.getByRole("tab", { name: "도감", exact: true })).toBeFocused();
    await page.keyboard.press("End");
    await expect(nav.getByRole("tab", { name: "환경설정", exact: true })).toBeFocused();
    await expect(nav.locator('[tabindex="0"]')).toHaveCount(1);

    // A real same-origin sibling produces native storage events. No event,
    // model callback, engine, clock, RNG or UI state is replaced.
    if (surface === "viewer" && theme === "light") {
      const sibling = await context.newPage();
      await sibling.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Local collection fixture</title>" }));
      await sibling.goto(new URL(page.url()).origin + "/visual-fixture/poster");
      await sibling.evaluate(key => {
        const value = JSON.parse(localStorage.getItem(key)!);
        value.foods.push("strawberry"); value.behaviors.push("stretch"); value.situations.push("home-rested");
        value.gifts.unlocked.push("bow"); value.gifts.equipped = "bow";
        localStorage.setItem(key, JSON.stringify(value));
      }, COMPANION_COLLECTION_KEY);
      await sibling.close(); await page.bringToFront();
      await nav.getByRole("tab", { name: "옷장", exact: true }).click();
      await expect(accessories.getByRole("button", { name: "나비 리본 · 장착 중", exact: true })).toBeVisible();
      await nav.getByRole("tab", { name: "도감", exact: true }).click();
      await expect(profile.getByRole("button", { name: `냠냠 도감 3/${COMPANION_FOOD_KINDS.length}`, exact: true })).toBeVisible();
      await expect(profile.getByRole("button", { name: "추억 도감 6/24", exact: true })).toBeVisible();
    }
    const persisted = await readCollection(page);
    await page.reload(); await page.bringToFront();
    if (surface === "preview") {
      if (!await page.locator(".viewer-fullscreen").count()) await page.locator(".io-preview").click();
      await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();
    }
    ({ dialog, profile, nav } = await openProfile(page));
    await openEnvironment(dialog);
    await expect(dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true })).toHaveAttribute("aria-checked", "false");
    await nav.getByRole("tab", { name: "옷장", exact: true }).click();
    await expect(profile.locator(`.rhh-accessory-grid [data-accessory="${persisted.gifts.equipped}"]`)).toContainText("장착 중");
    expect(await readCollection(page)).toEqual(persisted);
    expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
  });
}

test("fresh local discovery starts empty and never manufactures a pending gift", async ({ page }) => {
  expect(COMPANION_FOOD_KINDS).toHaveLength(180);
  const safety = await installFixture(page);
  await visitSurface(page, "viewer");
  const { profile, nav } = await openProfile(page);
  await nav.getByRole("tab", { name: "도감", exact: true }).click();
  await expect(profile.getByRole("button", { name: `냠냠 도감 0/${COMPANION_FOOD_KINDS.length}`, exact: true })).toBeVisible();
  await expect(profile.getByRole("button", { name: "추억 도감 0/24", exact: true })).toBeVisible();
  await expect(profile.locator("button[data-found]")).toHaveCount(0);
  await expect(profile.locator(".rhh-collection-detail strong")).toHaveText("???");
  await nav.getByRole("tab", { name: "옷장", exact: true }).click();
  await expect(profile.getByRole("button", { name: "선물 열기", exact: true })).toHaveCount(0);
  expect(await profile.locator(".rhh-accessory-grid button").count()).toBeLessThanOrEqual(COMPANION_WEARABLE_IDS.length);
  await expect(profile.locator(".rhh-wardrobe-preview")).toHaveAttribute("data-preview-ready", "");
  await expect(profile.locator(".rhh-wardrobe-preview")).toHaveAttribute("data-preview-accessory", "none");
  await expect(profile.locator(".rhh-accessory-grid button[data-found]")).toHaveCount(0);
  await expect(profile.locator(".rhh-collection-detail").getByRole("button", { name: /^(장착하기|벗기기)$/ })).toHaveCount(0);
  await expect(profile.getByRole("button", { name: "다시 보기", exact: true })).toBeDisabled();
  expect(await page.evaluate(key => localStorage.getItem(key), COMPANION_COLLECTION_KEY)).toBeNull();
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

test("111 lazy profile: optional collections, wardrobe and controls load only on their first real visit", async ({ page }) => {
  const build = process.env.VISUAL_TEST_BUILD_DIR ?? ".next";
  const manifest = JSON.parse(readFileSync(resolve(build, "react-loadable-manifest.json"), "utf8")) as Record<string, { id: number; files: string[] }>;
  const moduleChunk = (suffix: string) => {
    const entry = Object.entries(manifest).find(([key]) => key.endsWith(suffix))?.[1];
    expect(entry, `production dynamic boundary ${suffix}`).toBeDefined();
    const file = entry!.files.find(file => file.endsWith(".js") && new RegExp(`\\b${entry!.id}\\s*:`).test(readFileSync(resolve(build, file), "utf8")));
    expect(file, `own compiled module ${suffix}`).toBeDefined();
    return `/_next/${file!}`;
  };
  const deferred = { discover: moduleChunk(" -> ./companion-discovery"), dress: moduleChunk(" -> ./companion-wardrobe"), settings: moduleChunk(" -> @/components/shared/companion-settings") };
  const requests = new Set<string>();
  page.on("request", request => requests.add(new URL(request.url()).pathname));
  const safety = await installFixture(page);
  await visitSurface(page, "viewer");
  const { profile, nav } = await openProfile(page);
  await expect(profile.locator(".rhh-companion-portrait [data-preview-ready]")).toHaveCount(1);
  for (const chunk of Object.values(deferred)) expect(requests.has(chunk), chunk).toBe(false);
  const checkpoints: Record<string, string[]> = { together: [...requests].filter(path => path.endsWith(".js")) };
  for (const [key, label] of [["discover", "도감"], ["dress", "옷장"], ["settings", "환경설정"]] as const) {
    await nav.getByRole("tab", { name: label, exact: true }).click();
    await expect.poll(() => requests.has(deferred[key])).toBe(true);
    checkpoints[key] = [...requests].filter(path => path.endsWith(".js"));
  }
  await expect(profile.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true })).toBeVisible();
  mkdirSync(`${regressionOutput}/collection`, { recursive: true });
  writeFileSync(`${regressionOutput}/collection/lazy-boundaries.json`, JSON.stringify({ build: readFileSync(resolve(build, "BUILD_ID"), "utf8").trim(), deferred, checkpoints }, null, 2));
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

for (const mode of ["normal", "disabled", "reduce", "off", "soft"] as const) {
  test(`profile cursor ${mode}: native input respects saved motion and graphics without changing flags`, async ({ page }) => {
    const safety = await installFixture(page, { reduce: mode === "reduce", graphics: mode === "off" || mode === "soft" ? mode : "max", enabled: mode !== "disabled" });
    await visitSurface(page, "viewer");
    const { dialog, profile, nav } = await openProfile(page);
    const flags = () => page.evaluate(() => ({ reduce: document.documentElement.hasAttribute("data-reduce-motion"), graphics: document.documentElement.getAttribute("data-gfx"), savedReduce: localStorage.getItem("vic.reduceMotion"), savedGraphics: localStorage.getItem("vic.gfxPref"), enabled: JSON.parse(localStorage.getItem("vic.viewerCompanion")!).enabled }));
    const before = await flags();
    expect(before.reduce).toBe(mode === "reduce");
    expect(before.graphics).toBe(mode === "off" || mode === "soft" ? mode : null);
    expect(before.enabled).toBe(mode !== "disabled");
    await profile.hover({ position: { x: 25, y: 25 } });
    if (mode === "normal") {
      await expect(profile).toHaveAttribute("data-spotlight", "");
      expect(await profile.evaluate(element => [element.style.getPropertyValue("--profile-spot-x"), element.style.getPropertyValue("--profile-spot-y")].every(value => /^\d+(\.\d+)?px$/.test(value)))).toBe(true);
      await page.mouse.move(0, 0); await expect(profile).not.toHaveAttribute("data-spotlight");
    } else {
      await expect(profile).not.toHaveAttribute("data-spotlight");
      if (mode === "disabled") expect(await profile.evaluate(element => getComputedStyle(element, "::before").opacity)).toBe("0");
      else expect(await profile.evaluate(element => getComputedStyle(element, "::before").display)).toBe("none");
    }
    await nav.getByRole("tab", { name: "도감", exact: true }).click();
    const tile = profile.locator(".rhh-collection-tile").first();
    await tile.hover();
    if (mode !== "normal" && mode !== "disabled") expect(await tile.evaluate(element => getComputedStyle(element).transform)).toBe("none");
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    const reopened = await openProfile(page);
    await expect(reopened.profile).not.toHaveAttribute("data-spotlight");
    expect(await flags()).toEqual(before);
    expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
  });
}

// Existing mobile-companion-disabled.spec.ts owns phone/agenda/touch absence
// and preference restoration. These desktop cases never force that gate open.

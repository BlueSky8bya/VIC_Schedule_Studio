import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_COLLECTION_KEY, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { companionFoodChance } from "@/lib/ui/viewer-companion/snacks";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";

test.use({ viewport: { width: 1440, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
type Surface = "viewer" | "studio" | "preview";
type FixtureOptions = { theme?: "light" | "dark"; collection?: CompanionCollection; reduce?: boolean; graphics?: "max" | "off" | "soft" };
const seededCollection: CompanionCollection = { version: 1, foods: ["apple", "peach"], behaviors: ["ask-petting", "doze-curl"], gifts: { pending: "beret", unlocked: ["sunglasses"], equipped: "sunglasses", activeMs: 300000, interactionCredit: 1 } };

async function installFixture(page: Page, { theme = "light", collection, reduce = true, graphics = "max" }: FixtureOptions = {}) {
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
  await page.addInitScript(({ prefs, care, life, key, epoch, theme, collection, collectionKey, reduce, graphics }) => {
    if (localStorage.getItem("fixture.discovery106")) return;
    localStorage.setItem("fixture.discovery106", "seeded");
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": theme === "dark" ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": reduce ? "on" : "off", "vic.gfxPref": graphics === "soft" ? "auto" : graphics })) localStorage.setItem(name, value);
    if (graphics === "soft") localStorage.setItem("vic.gfx", JSON.stringify({ mode: "soft", at: Date.now(), v: 3 }));
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: .23, affection: .64, habits: { sociability: .6, playfulness: .3, confidence: .5, credit: 0, generation: 0 }, life }));
    if (collection) localStorage.setItem(collectionKey, JSON.stringify(collection));
    else localStorage.removeItem(collectionKey);
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, life: createCompanionLife(() => 0), key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, theme, collection, collectionKey: COMPANION_COLLECTION_KEY, reduce, graphics });
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
  await dialog.getByRole("tab", { name: "프로필", exact: true }).click();
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

for (const surface of ["viewer", "studio", "preview"] as const) for (const theme of ["light", "dark"] as const) {
  test(`${surface} ${theme}: real mini-nav discovers, opens, equips and retains local keepsakes`, async ({ page, context }) => {
    const safety = await installFixture(page, { theme, collection: seededCollection });
    await visitSurface(page, surface);
    let { dialog, profile, nav } = await openProfile(page);
    await expect(nav.getByRole("tab")).toHaveText(["함께 지내기", "발견 도감", "꾸미기"]);
    await expect(nav.locator('[data-collection-art-id="book-closed"]')).toHaveCount(1);
    await expect(nav.locator('[tabindex="0"]')).toHaveCount(1);
    await expect(dialog.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true })).toBeVisible();
    await expect(profile.locator('[data-collection-art="behavior-stamp"],[data-collection-art="accessory"]')).toHaveCount(0);

    await nav.getByRole("tab", { name: "발견 도감", exact: true }).click();
    await expect(nav.locator('[data-collection-art-id="book-open"]')).toHaveCount(1);
    const foods = profile.locator(".rhh-collection-grid:not(.rhh-behavior-grid):not(.rhh-accessory-grid)");
    await expect(foods.getByRole("button")).toHaveCount(36);
    await expect(profile.getByRole("button", { name: "먹거리 2/36", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(foods.locator("button[data-found]")).toHaveCount(2);
    await expect(foods.locator('[data-collection-art="food-stamp"]')).toHaveCount(2);
    await expect(foods.locator(".rhh-collection-rarity")).toHaveCount(36);
    await expect(profile.locator('[data-collection-art="behavior-stamp"],[data-collection-art="accessory"]')).toHaveCount(0);
    await foods.getByRole("button", { name: "딸기 · 아직 맛보지 않았어요", exact: true }).click();
    await expect(profile.locator(".rhh-collection-detail")).toContainText("아직 맛보지 않았어요");
    await foods.getByRole("button", { name: "사과 · 맛봤어요", exact: true }).click();
    await expect(profile.locator(".rhh-collection-detail")).toContainText("실제로 맛본 먹거리");
    await expect(profile.locator(".rhh-collection-detail .rhh-collection-rarity")).toHaveText("흔한");
    await expect(profile.locator(".rhh-collection-chance")).toHaveText(`기본 등장 확률 ${(companionFoodChance("apple") * 100).toFixed(1)}% · 직전 먹거리는 제외되어 실제 확률은 달라져요.`);
    await foods.getByRole("button", { name: "블루베리 · 아직 맛보지 않았어요", exact: true }).click();
    await expect(profile.locator(".rhh-collection-detail .rhh-collection-rarity")).toHaveText("귀한");
    await expect(profile.locator(".rhh-collection-chance")).toContainText(`${(companionFoodChance("blueberry") * 100).toFixed(1)}%`);
    expect(companionFoodChance("blueberry")).toBeLessThan(companionFoodChance("apple"));
    const fixedTargets = await profile.locator('[data-act="companion-collection-inspect"]').evaluateAll(elements => elements.map(element => element.getAttribute("data-act-opt")));
    expect(new Set(fixedTargets)).toEqual(new Set(["food"]));

    await profile.getByRole("button", { name: "만난 몸짓 2/12", exact: true }).click();
    const behaviors = profile.locator(".rhh-behavior-grid");
    await expect(behaviors.getByRole("button")).toHaveCount(12);
    await expect(behaviors.locator("button[data-found]")).toHaveCount(2);
    await expect(profile.locator('[data-collection-art="food"]')).toHaveCount(0);
    await behaviors.getByRole("button", { name: "폴짝 놀이 · 아직 만나지 않았어요", exact: true }).click();
    await expect(profile.locator(".rhh-collection-detail")).toContainText("고양이 모드");
    await expect(profile.locator(".rhh-collection-detail")).toContainText("이런 상황에서 만날 수 있어요");
    await page.keyboard.press("Home");
    await expect(behaviors.getByRole("button", { name: "쓰다듬어 주세요 · 만났어요", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(behaviors.getByRole("button", { name: "다정하게 기대기 · 아직 만나지 않았어요", exact: true })).toBeFocused();
    await page.keyboard.press("End");
    await expect(behaviors.getByRole("button", { name: "쭉 기지개 · 아직 만나지 않았어요", exact: true })).toBeFocused();
    await expect(behaviors.locator('[tabindex="0"]')).toHaveCount(1);
    mkdirSync(".scratch-pw/companion-106-settings", { recursive: true });
    await profile.screenshot({ path: `.scratch-pw/companion-106-settings/discovery-${surface}-${theme}.png` });

    await nav.getByRole("tab", { name: "꾸미기", exact: true }).click();
    const accessories = profile.locator(".rhh-accessory-grid");
    await expect(accessories.getByRole("button")).toHaveCount(6);
    await expect(accessories.locator("button[data-found]")).toHaveCount(1);
    await expect(profile.getByRole("button", { name: "선물 열기", exact: true })).toBeVisible();
    expect(await readCollection(page)).toEqual(seededCollection);
    await accessories.getByRole("button", { name: "리본 · 아직 받지 않았어요", exact: true }).click();
    await expect(profile.locator(".rhh-collection-detail").getByRole("button")).toHaveCount(0);
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
    await accessories.locator('[data-accessory="beret"]').click();
    await profile.locator(".rhh-collection-detail").getByRole("button", { name: "장착하기", exact: true }).click();
    await profile.screenshot({ path: `.scratch-pw/companion-106-settings/gifts-${surface}-${theme}.png` });

    const keepsakes = await readCollection(page);
    await nav.getByRole("tab", { name: "함께 지내기", exact: true }).click();
    await dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true }).click();
    await dialog.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
    expect(await readCollection(page)).toEqual(keepsakes);
    await expect(profile).toContainText("도감과 받은 선물은 간직해요");
    await nav.getByRole("tab", { name: "함께 지내기", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(nav.getByRole("tab", { name: "발견 도감", exact: true })).toBeFocused();
    await page.keyboard.press("End");
    await expect(nav.getByRole("tab", { name: "꾸미기", exact: true })).toBeFocused();
    await expect(nav.locator('[tabindex="0"]')).toHaveCount(1);

    // A real same-origin sibling produces native storage events. No event,
    // model callback, engine, clock, RNG or UI state is replaced.
    if (surface === "viewer" && theme === "light") {
      const sibling = await context.newPage();
      await sibling.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Local collection fixture</title>" }));
      await sibling.goto(new URL(page.url()).origin + "/visual-fixture/poster");
      await sibling.evaluate(key => {
        const value = JSON.parse(localStorage.getItem(key)!);
        value.foods.push("strawberry"); value.behaviors.push("stretch");
        value.gifts.unlocked.push("bow"); value.gifts.equipped = "bow";
        localStorage.setItem(key, JSON.stringify(value));
      }, COMPANION_COLLECTION_KEY);
      await sibling.close(); await page.bringToFront();
      await expect(accessories.getByRole("button", { name: "리본 · 장착 중", exact: true })).toBeVisible();
      await nav.getByRole("tab", { name: "발견 도감", exact: true }).click();
      await expect(profile.getByRole("button", { name: "먹거리 3/36", exact: true })).toBeVisible();
      await expect(profile.getByRole("button", { name: "만난 몸짓 3/12", exact: true })).toBeVisible();
    }
    const persisted = await readCollection(page);
    await page.reload(); await page.bringToFront();
    if (surface === "preview") {
      if (!await page.locator(".viewer-fullscreen").count()) await page.locator(".io-preview").click();
      await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();
    }
    ({ dialog, profile, nav } = await openProfile(page));
    await expect(dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true })).toHaveAttribute("aria-checked", "false");
    await nav.getByRole("tab", { name: "꾸미기", exact: true }).click();
    await expect(profile.locator(`.rhh-accessory-grid [data-accessory="${persisted.gifts.equipped}"]`)).toContainText("장착 중");
    expect(await readCollection(page)).toEqual(persisted);
    expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
  });
}

test("fresh local discovery starts empty and never manufactures a pending gift", async ({ page }) => {
  const safety = await installFixture(page);
  await visitSurface(page, "viewer");
  const { profile, nav } = await openProfile(page);
  await nav.getByRole("tab", { name: "발견 도감", exact: true }).click();
  await expect(profile.getByRole("button", { name: "먹거리 0/36", exact: true })).toBeVisible();
  await expect(profile.getByRole("button", { name: "만난 몸짓 0/12", exact: true })).toBeVisible();
  await expect(profile.locator("button[data-found]")).toHaveCount(0);
  await expect(profile.locator('[data-collection-art-id="discovery-seal"]')).toHaveCount(1);
  await nav.getByRole("tab", { name: "꾸미기", exact: true }).click();
  await expect(profile.getByRole("button", { name: "선물 열기", exact: true })).toHaveCount(0);
  await expect(profile.locator(".rhh-accessory-grid button")).toHaveCount(6);
  await expect(profile.locator(".rhh-accessory-grid button[data-found]")).toHaveCount(0);
  await expect(profile.locator(".rhh-collection-detail").getByRole("button")).toHaveCount(0);
  expect(await page.evaluate(key => localStorage.getItem(key), COMPANION_COLLECTION_KEY)).toBeNull();
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

for (const mode of ["normal", "reduce", "off", "soft"] as const) {
  test(`profile cursor ${mode}: native input respects saved motion and graphics without changing flags`, async ({ page }) => {
    const safety = await installFixture(page, { reduce: mode === "reduce", graphics: mode === "off" || mode === "soft" ? mode : "max" });
    await visitSurface(page, "viewer");
    const { dialog, profile, nav } = await openProfile(page);
    const flags = () => page.evaluate(() => ({ reduce: document.documentElement.hasAttribute("data-reduce-motion"), graphics: document.documentElement.getAttribute("data-gfx"), savedReduce: localStorage.getItem("vic.reduceMotion"), savedGraphics: localStorage.getItem("vic.gfxPref"), enabled: JSON.parse(localStorage.getItem("vic.viewerCompanion")!).enabled }));
    const before = await flags();
    expect(before.reduce).toBe(mode === "reduce");
    expect(before.graphics).toBe(mode === "off" || mode === "soft" ? mode : null);
    expect(before.enabled).toBe(false);
    await profile.hover({ position: { x: 25, y: 25 } });
    if (mode === "normal") {
      await expect(profile).toHaveAttribute("data-spotlight", "");
      expect(await profile.evaluate(element => [element.style.getPropertyValue("--profile-spot-x"), element.style.getPropertyValue("--profile-spot-y")].every(value => /^\d+(\.\d+)?px$/.test(value)))).toBe(true);
      await page.mouse.move(0, 0); await expect(profile).not.toHaveAttribute("data-spotlight");
    } else {
      await expect(profile).not.toHaveAttribute("data-spotlight");
      expect(await profile.evaluate(element => getComputedStyle(element, "::before").display)).toBe("none");
    }
    await nav.getByRole("tab", { name: "발견 도감", exact: true }).click();
    const tile = profile.locator(".rhh-collection-tile").first();
    await tile.hover();
    if (mode !== "normal") expect(await tile.evaluate(element => getComputedStyle(element).transform)).toBe("none");
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    const reopened = await openProfile(page);
    await expect(reopened.profile).not.toHaveAttribute("data-spotlight");
    expect(await flags()).toEqual(before);
    expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
  });
}

// Existing mobile-companion-disabled.spec.ts owns phone/agenda/touch absence
// and preference restoration. These desktop cases never force that gate open.

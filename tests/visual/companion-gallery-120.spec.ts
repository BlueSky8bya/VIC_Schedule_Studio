import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_BEHAVIOR_IDS, COMPANION_COLLECTION_KEY, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";
import { COMPANION_FOOD_NAMES } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_FOOD_BOOK_ORDER as COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/collection-book-order";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillDeclaredUiFontSheet } from "./helpers/readonly-font";
import { selectCompanionCollectionIndex } from "./helpers/companion-collection";
import { COMPANION_MEMORY_BOOK } from "@/lib/ui/viewer-companion/memory-book-order";

const output = process.env.COMPANION120_UI_OUTPUT ?? ".scratch-pw/companion-120/gallery";
const approvedFontUrls = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const catalogue: CompanionCollection = {
  version: 1, foods: COMPANION_FOOD_KINDS.slice(1), behaviors: COMPANION_BEHAVIOR_IDS.slice(1), situations: [...COMPANION_SITUATION_IDS],
  gifts: { pending: null, unlocked: ["sunglasses", "beret", "pixel-sunglasses"], equipped: "sunglasses", activeMs: 0, interactionCredit: 0 },
  seen: { foods: COMPANION_FOOD_KINDS.filter(food => food !== "bok-choy"), behaviors: [], situations: [], accessories: ["sunglasses"] },
};
const readCollection = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as CompanionCollection, COMPANION_COLLECTION_KEY);
// c062a41d (2026-10-21): the detail stage is a fixed 104px mat with 5px padding,
// so the enlarged detail art is 94px (the 120 floor of 96px is superseded).
const DETAIL_ART = 104 - 2 * 5 - .5;
// 2e38b029 (161): below 800px of viewport height the stage is 80px (70px art).
const SHORT_DETAIL_ART = 80 - 2 * 5 - .5;
const longestFood = catalogue.foods.reduce((longest, food) => COMPANION_FOOD_NAMES[food].length > COMPANION_FOOD_NAMES[longest].length ? food : longest);
// b03: the memory book is COMPANION_MEMORY_BOOK (legacy behaviours, moments, then the new memory families).
// The longest name is taken among the memories this fixture has found, so the detail shows it.
const memoryNames = COMPANION_MEMORY_BOOK.map(memory => memory.name);
const memoryFoundInCatalogue = (index: number) => ((COMPANION_MEMORY_BOOK[index].kind === "moment" ? catalogue.situations : catalogue.behaviors) as readonly string[]).includes(COMPANION_MEMORY_BOOK[index].id);
const longestMemoryIndex = memoryNames.reduce((longest, name, index) => memoryFoundInCatalogue(index) && (!memoryFoundInCatalogue(longest) || name.length > memoryNames[longest].length) ? index : longest, 0);

async function openProfile(page: Page, entry: "book" | "settings") {
  await page.bringToFront(); await settlePanelLayout(page);
  if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) {
    await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settlePanelLayout(page);
  }
  if (entry === "book") {
    const book = page.getByRole("button", { name: "빅타민 수첩 열기", exact: true });
    if (!await book.isVisible()) {
      const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
      if (await launcher.isVisible()) await launcher.click();
      else await page.locator('.vc-home [data-act="companion-home-fold"]').click();
    }
    await book.click();
  } else {
    const settings = page.getByRole("button", { name: "설정", exact: true });
    if (!await settings.isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
    await settings.click();
    await page.getByRole("dialog", { name: "설정", exact: true }).getByRole("tab", { name: "빅타민", exact: true }).click();
    // c3bec348: the gear opens the companion block on its "설정" page; the portrait is on "함께 지내기".
    await page.getByRole("dialog", { name: "설정", exact: true }).getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "함께 지내기", exact: true }).click();
  }
  const dialog = page.getByRole("dialog", { name: entry === "book" ? "빅타민 수첩" : "설정", exact: true });
  const profile = dialog.locator(".rhh-companion-profile");
  await expect(profile).toBeVisible(); await settlePanelLayout(page);
  return { dialog, profile, nav: profile.getByRole("tablist", { name: "빅타민 프로필", exact: true }) };
}

async function inspectPage(page: Page, dialog: Locator, sheet: Locator, name: string) {
  await expect(sheet).toBeVisible();
  await expect.poll(() => sheet.locator(".rhh-collection-grid button").count()).toBeGreaterThan(0);
  const geometry = await sheet.evaluate(node => {
    const list = node.querySelector<HTMLElement>("ul")!;
    const fitting = node.querySelector<HTMLElement>(".rhh-wardrobe-detail"), stage = fitting?.querySelector<HTMLElement>(".rhh-wardrobe-fitting-stage");
    const fittingStage = fitting && stage ? { width: stage.getBoundingClientRect().width, columnWidth: parseFloat(getComputedStyle(fitting).gridTemplateColumns), detail: fitting.getBoundingClientRect().toJSON(), parts: [...fitting.querySelectorAll<HTMLElement>(".rhh-wardrobe-preview, .rhh-wardrobe-description, .rhh-wardrobe-detail-copy > strong, button")].map(element => ({ name: element.className, rect: element.getBoundingClientRect().toJSON() })) } : null;
    const ancestors = [];
    for (let el: HTMLElement | null = node as HTMLElement; el && !el.classList.contains("modal-card"); el = el.parentElement) ancestors.push({ cls: el.className, overflow: el.scrollHeight - el.clientHeight });
    const book = node.closest(".rhh-collection-book") ?? node;
    const clipped = [...book.querySelectorAll<HTMLElement>("*")].filter(child => child.checkVisibility()).map(child => ({ cls: child.className, bottom: child.getBoundingClientRect().bottom })).filter(child => child.bottom > book.getBoundingClientRect().bottom + 1).slice(0, 8);
    return { clipped, bookStyle: { overflowY: getComputedStyle(book).overflowY, height: book.getBoundingClientRect().height }, ancestors, fittingStage, bottom: node.getBoundingClientRect().bottom, gridOverflow: list.scrollHeight - list.clientHeight, gridWidthOverflow: list.scrollWidth - list.clientWidth, columns: getComputedStyle(list).gridTemplateColumns.split(/\s+/).length, rows: getComputedStyle(list).gridTemplateRows.split(/\s+/).length, tiles: list.querySelectorAll("button").length, buttons: [...node.querySelectorAll("button")].map(button => { const rect = button.getBoundingClientRect(), view = book.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return { ...rect.toJSON(), disabled: button.disabled, inView: rect.y + rect.height / 2 >= view.top && rect.y + rect.height / 2 <= view.bottom, hit: hit === button || button.contains(hit) }; }) };
  });
  mkdirSync(output, { recursive: true }); await dialog.screenshot({ path: `${output}/${name}.png` });
  expect(geometry.bottom).toBeLessThanOrEqual(page.viewportSize()!.height - 8);
  // 2e38b029 (161): at 700px of height and below the notebook scrolls by design
  // (`.rhh-collection-book { overflow-y: auto }`). Above it a scrolling book is a
  // real defect (owner rule 476b1cd4: every book fits unscrolled at 701px and up).
  const short = page.viewportSize()!.height <= 700;
  expect(geometry.ancestors.filter(item => item.overflow > 2 && !(short && /\brhh-collection-book\b/.test(item.cls))), JSON.stringify({ clipped: geometry.clipped, book: geometry.bookStyle })).toEqual([]);
  expect(geometry.gridOverflow).toBeLessThanOrEqual(2); expect(geometry.gridWidthOverflow).toBeLessThanOrEqual(2);
  expect(geometry.tiles).toBeLessThanOrEqual(24);
  if (geometry.fittingStage) {
    expect(Math.abs(geometry.fittingStage.width - geometry.fittingStage.columnWidth)).toBeLessThanOrEqual(1);
    for (const part of geometry.fittingStage.parts) {
      expect(part.rect.top, part.name).toBeGreaterThanOrEqual(geometry.fittingStage.detail.top);
      expect(part.rect.bottom, part.name).toBeLessThanOrEqual(geometry.fittingStage.detail.bottom);
      expect(part.rect.left, part.name).toBeGreaterThanOrEqual(geometry.fittingStage.detail.left);
      expect(part.rect.right, part.name).toBeLessThanOrEqual(geometry.fittingStage.detail.right);
    }
  }
  for (const rect of geometry.buttons) { expect(rect.width).toBeGreaterThanOrEqual(43.9); expect(rect.height).toBeGreaterThanOrEqual(43.9); if (!rect.disabled && rect.inView) expect(rect.hit).toBe(true); }
  if (!short) expect(geometry.buttons.every(rect => rect.inView)).toBe(true);
  writeFileSync(`${output}/${name}.json`, JSON.stringify({ build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), geometry }, null, 2));
  return geometry;
}

for (const [surface, entry, theme, contents] of [["viewer", "book", "light", "partial"], ["viewer", "settings", "dark", "partial"], ["studio", "book", "dark", "partial"], ["studio", "settings", "light", "partial"], ["preview", "settings", "dark", "partial"], ["viewer", "settings", "light", "all-owned"], ["studio", "settings", "dark", "pending-gift"]] as const) {
  test(`120 ${surface} ${entry} ${theme} ${contents}: enlarged gallery, finite wardrobe and unread ownership`, async ({ page }, info) => {
    // The pending gift is a compact pill on the wardrobe heading line since 9e346ecc (owner call 2026-11-20), so the
    // gear's wardrobe page fits without scrolling with the 168px fitting preview minimum kept.
    info.setTimeout(90_000); const writes: string[] = [], errors: string[] = [], foreign: string[] = [], approvedFonts: string[] = [];
    const base = new URL(info.project.use.baseURL as string).origin;
    const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
    const previewReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
    page.on("pageerror", error => errors.push(error.message));
    await page.context().route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) {
        // b01-3 (197f7750): the settings font list links declared jsDelivr stylesheets.
        if (await fulfillDeclaredUiFontSheet(route)) return;
        if (request.method() === "GET" && request.resourceType() === "font" && approvedFontUrls.has(url.href) && ["fastly.jsdelivr.net", "hangeul.pstatic.net"].includes(url.hostname)) { approvedFonts.push(url.href); return route.continue(); }
        foreign.push(url.href); return route.abort();
      }
      if (surface === "preview" && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previewReads.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
      if (!["GET", "HEAD"].includes(request.method())) { writes.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "fixture blocks writes" }); }
      if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "fixture blocks all live API reads" });
      return route.continue();
    });
    const scenarioCatalogue: CompanionCollection = contents === "partial" ? catalogue : { ...catalogue, gifts: { ...catalogue.gifts, unlocked: COMPANION_WEARABLE_IDS.filter(id => contents !== "pending-gift" || id !== "pixel-sunglasses"), pending: contents === "pending-gift" ? "pixel-sunglasses" : null } };
    await page.addInitScript(({ catalogue, collectionKey, memory, preferences, epoch, epochKey, theme }) => {
      for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "on", "vic.gfxPref": "max", "vic.dark": theme === "dark" ? "on" : "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: false, feeding: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory }));
      localStorage.setItem(collectionKey, JSON.stringify(catalogue));
    }, { catalogue: scenarioCatalogue, collectionKey: COMPANION_COLLECTION_KEY, memory: DEFAULT_COMPANION_MEMORY, preferences: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, theme });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
    if (surface === "preview") {
      await page.locator(".io-preview").click();
      await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();
    }
    const { dialog, profile, nav } = await openProfile(page, entry), name = `${surface}-${entry}-${theme}-${contents}`;
    const portraitWidth = (await profile.locator(".rhh-companion-portrait .rhh-wardrobe-preview").boundingBox())!.width;
    await nav.getByRole("tab", { name: "도감", exact: true }).click();
    expect((await readCollection(page)).seen?.foods).not.toContain("bok-choy");
    const foodGrid = profile.locator(".rhh-food-grid");
    await selectCompanionCollectionIndex(page, foodGrid, COMPANION_FOOD_KINDS.indexOf("bok-choy"));
    await expect(profile.locator(".rhh-food-detail strong")).toHaveText("청경채");
    // 7dd1ac08 (2026-10-21): a tasted food's detail shows its watercolour seal
    // (food-stamp); the grid tiles keep the plain food art.
    await expect(profile.locator('.rhh-food-detail [data-collection-art="food-stamp"][data-collection-art-id="bok-choy"]')).toHaveCount(1);
    await expect(profile.locator('.rhh-food-detail [data-collection-art="food"]')).toHaveCount(0);
    await expect(profile.locator('.rhh-food-grid [data-collection-art="food-stamp"]')).toHaveCount(0);
    expect((await profile.locator(".rhh-food-detail .vc-collection-art").boundingBox())!.width).toBeGreaterThanOrEqual(DETAIL_ART);
    expect((await readCollection(page)).seen?.foods).toContain("bok-choy");
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-food`);
    await foodGrid.locator("button[tabindex='0']").focus(); await page.keyboard.press("Home");
    await expect(profile.locator(".rhh-food-detail strong")).toHaveText("???");
    await expect(profile.locator(".rhh-food-detail .rhh-collection-fact")).toHaveText("아직 맛보기 전");
    await profile.getByRole("button", { name: /^추억 도감/ }).click();
    await selectCompanionCollectionIndex(page, profile.locator(".rhh-behavior-grid"), 2);
    await expect(profile.locator(".rhh-memory-detail strong")).toHaveText("꾹꾹이");
    expect((await profile.locator(".rhh-memory-detail .vc-collection-art").boundingBox())!.width).toBeGreaterThanOrEqual(DETAIL_ART);
    // 886d977a / 2e38b029 (160/161, 2026-10-21): a tile's specimen is bounded by
    // its measured tile (at most 68px, square, never outside the target), so the
    // 120 floor of 72px is superseded; it stays a readable picture.
    const specimen = await profile.locator(".rhh-behavior-grid button").filter({ has: page.locator(".vc-collection-art") }).first().evaluate(button => {
      const tile = button.getBoundingClientRect(), art = button.querySelector(".vc-collection-art")!.getBoundingClientRect();
      return { width: art.width, height: art.height, inside: art.left >= tile.left - .5 && art.right <= tile.right + .5 && art.top >= tile.top - .5 && art.bottom <= tile.bottom + .5 };
    });
    expect(specimen.width).toBeGreaterThanOrEqual(40); expect(specimen.width).toBeLessThanOrEqual(68.5);
    expect(Math.abs(specimen.width - specimen.height)).toBeLessThan(.5); expect(specimen.inside).toBe(true);
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-memory`);
    await nav.getByRole("tab", { name: "옷장", exact: true }).click();
    const wardrobe = profile.locator(".rhh-companion-wardrobe"), preview = wardrobe.locator(".rhh-wardrobe-preview");
    await expect(wardrobe.locator(".rhh-gift-arrival")).toHaveCount(contents === "pending-gift" ? 1 : 0);
    await expect(preview).toHaveAttribute("data-preview-accessory", "sunglasses");
    // 476b1cd4 (2026-11-13, owner): the notebook wardrobe preview is capped at 168px so the card fits unscrolled.
    expect((await preview.boundingBox())!.width).toBeGreaterThanOrEqual(Math.min(portraitWidth, 168));
    await selectCompanionCollectionIndex(page, wardrobe.locator(".rhh-accessory-grid"), COMPANION_WEARABLE_IDS.indexOf("beret"));
    await expect(wardrobe.locator(".rhh-wardrobe-description")).toContainText("베레모");
    await expect(preview).toHaveAttribute("data-preview-accessory", "beret");
    expect((await readCollection(page)).gifts.equipped).toBe("sunglasses");
    await inspectPage(page, dialog, wardrobe, `${name}-wardrobe-beret`);
    await wardrobe.getByRole("button", { name: "장착하기", exact: true }).click();
    expect((await readCollection(page)).gifts.equipped).toBe("beret");
    await wardrobe.getByRole("button", { name: "벗기기", exact: true }).click();
    await expect(preview).toHaveAttribute("data-preview-accessory", "none");
    const wide = await inspectPage(page, dialog, wardrobe, `${name}-wardrobe`); expect(wide.rows).toBe(1);
    if (contents !== "partial") {
      await selectCompanionCollectionIndex(page, wardrobe.locator(".rhh-accessory-grid"), COMPANION_WEARABLE_IDS.indexOf("sunglasses"));
      await wardrobe.getByRole("button", { name: "장착하기", exact: true }).click();
      expect((await readCollection(page)).gifts.equipped).toBe("sunglasses");
    }
    await page.setViewportSize({ width: 1050, height: 640 });
    await expect.poll(() => wardrobe.locator(".rhh-accessory-grid button").count()).toBeLessThanOrEqual(6);
    await selectCompanionCollectionIndex(page, wardrobe.locator(".rhh-accessory-grid"), 26);
    await expect(wardrobe.locator(".rhh-wardrobe-detail-copy > strong")).toHaveText(contents === "partial" ? "???" : "토리님 수면 안대");
    // 476b1cd4 (2026-11-13, owner): below 767px of height the notebook fitting
    // stage is capped at 136px; the portrait keeps the shared 148px preview size.
    // An unknown item shows its silhouette in the same stage, not a preview.
    const narrowPreviewWidth = 148, narrowFittingWidth = 136;
    const fitting = wardrobe.locator(".rhh-wardrobe-fitting-stage").locator(".rhh-wardrobe-preview, :scope > .rhh-wardrobe-silhouette");
    await expect(fitting).toHaveCount(1);
    expect((await fitting.boundingBox())!.width).toBe(narrowFittingWidth);
    const narrow = await inspectPage(page, dialog, wardrobe, `${name}-wardrobe-short`); expect(narrow.rows).toBe(1);
    if (contents !== "partial") {
      await expect(wardrobe.getByRole("button", { name: "선글라스 벗기기", exact: true })).toBeVisible();
      await wardrobe.getByRole("button", { name: "장착하기", exact: true }).click();
      await expect(preview).toHaveAttribute("data-preview-accessory", "sleep-mask-tori");
      await expect(wardrobe.getByRole("button", { name: "벗기기", exact: true })).toBeVisible();
      await inspectPage(page, dialog, wardrobe, `${name}-wardrobe-short-equipped`);
    }
    await nav.getByRole("tab", { name: "함께 지내기", exact: true }).click();
    const portrait = (await profile.locator(".rhh-companion-portrait").boundingBox())!, portraitPreview = (await profile.locator(".rhh-companion-portrait .rhh-wardrobe-preview").boundingBox())!;
    expect(portraitPreview.width).toBe(narrowPreviewWidth);
    expect(portraitPreview.x).toBeGreaterThanOrEqual(portrait.x);
    expect(portraitPreview.x + portraitPreview.width).toBeLessThanOrEqual(portrait.x + portrait.width);
    await nav.getByRole("tab", { name: "도감", exact: true }).click();
    await profile.getByRole("button", { name: /^냠냠 도감/ }).click();
    await selectCompanionCollectionIndex(page, foodGrid, COMPANION_FOOD_KINDS.indexOf("bok-choy"));
    await expect(profile.locator(".rhh-food-detail strong")).toHaveText("청경채");
    expect((await profile.locator(".rhh-food-detail .vc-collection-art").boundingBox())!.width).toBeGreaterThanOrEqual(SHORT_DETAIL_ART);
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-food-short`);
    await selectCompanionCollectionIndex(page, foodGrid, COMPANION_FOOD_KINDS.indexOf(longestFood));
    await expect(profile.locator(".rhh-food-detail strong")).toHaveText(COMPANION_FOOD_NAMES[longestFood]);
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-food-short-long-name`);
    await profile.getByRole("button", { name: /^추억 도감/ }).click();
    await selectCompanionCollectionIndex(page, profile.locator(".rhh-behavior-grid"), 2);
    await expect(profile.locator(".rhh-memory-detail strong")).toHaveText("꾹꾹이");
    expect((await profile.locator(".rhh-memory-detail .vc-collection-art").boundingBox())!.width).toBeGreaterThanOrEqual(SHORT_DETAIL_ART);
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-memory-short`);
    await selectCompanionCollectionIndex(page, profile.locator(".rhh-behavior-grid"), longestMemoryIndex);
    await expect(profile.locator(".rhh-memory-detail strong")).toHaveText(memoryNames[longestMemoryIndex]);
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-memory-short-long-name`);
    expect(writes).toEqual([]); expect(errors).toEqual([]); expect(foreign).toEqual([]);
    writeFileSync(`${output}/${name}-requests.json`, JSON.stringify({ approvedFonts, blockedForeign: foreign, writes, errors }, null, 2));
  });
}

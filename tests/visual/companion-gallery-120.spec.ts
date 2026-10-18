import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_BEHAVIOR_IDS, COMPANION_BEHAVIOR_NAMES, COMPANION_COLLECTION_KEY, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_IDS, COMPANION_SITUATION_NAMES } from "@/lib/ui/viewer-companion/moments";
import { COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { settlePanelLayout } from "./helpers/panel-layout";
import { selectCompanionCollectionIndex } from "./helpers/companion-collection";

const output = process.env.COMPANION120_UI_OUTPUT ?? ".scratch-pw/companion-120/gallery";
const approvedFontUrls = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const catalogue: CompanionCollection = {
  version: 1, foods: COMPANION_FOOD_KINDS.slice(1), behaviors: COMPANION_BEHAVIOR_IDS.slice(1), situations: [...COMPANION_SITUATION_IDS],
  gifts: { pending: null, unlocked: ["sunglasses", "beret", "pixel-sunglasses"], equipped: "sunglasses", activeMs: 0, interactionCredit: 0 },
  seen: { foods: COMPANION_FOOD_KINDS.filter(food => food !== "bok-choy"), behaviors: [], situations: [], accessories: ["sunglasses"] },
};
const readCollection = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as CompanionCollection, COMPANION_COLLECTION_KEY);
const longestFood = catalogue.foods.reduce((longest, food) => COMPANION_FOOD_NAMES[food].length > COMPANION_FOOD_NAMES[longest].length ? food : longest);
const memoryNames = [...COMPANION_BEHAVIOR_IDS.map(id => COMPANION_BEHAVIOR_NAMES[id]), ...COMPANION_SITUATION_IDS.map(id => COMPANION_SITUATION_NAMES[id])];
const longestMemoryIndex = memoryNames.reduce((longest, name, index) => name.length > memoryNames[longest].length ? index : longest, 0);

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
    return { ancestors, fittingStage, bottom: node.getBoundingClientRect().bottom, gridOverflow: list.scrollHeight - list.clientHeight, gridWidthOverflow: list.scrollWidth - list.clientWidth, columns: getComputedStyle(list).gridTemplateColumns.split(/\s+/).length, rows: getComputedStyle(list).gridTemplateRows.split(/\s+/).length, tiles: list.querySelectorAll("button").length, buttons: [...node.querySelectorAll("button")].map(button => { const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return { ...rect.toJSON(), disabled: button.disabled, hit: hit === button || button.contains(hit) }; }) };
  });
  expect(geometry.bottom).toBeLessThanOrEqual(page.viewportSize()!.height - 8);
  expect(geometry.ancestors.filter(item => item.overflow > 2)).toEqual([]);
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
  for (const rect of geometry.buttons) { expect(rect.width).toBeGreaterThanOrEqual(43.9); expect(rect.height).toBeGreaterThanOrEqual(43.9); if (!rect.disabled) expect(rect.hit).toBe(true); }
  mkdirSync(output, { recursive: true });
  writeFileSync(`${output}/${name}.json`, JSON.stringify({ build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), geometry }, null, 2));
  await dialog.screenshot({ path: `${output}/${name}.png` });
  return geometry;
}

for (const [surface, entry, theme, contents] of [["viewer", "book", "light", "partial"], ["viewer", "settings", "dark", "partial"], ["studio", "book", "dark", "partial"], ["studio", "settings", "light", "partial"], ["preview", "settings", "dark", "partial"], ["viewer", "settings", "light", "all-owned"], ["studio", "settings", "dark", "pending-gift"]] as const) {
  test(`120 ${surface} ${entry} ${theme} ${contents}: enlarged gallery, finite wardrobe and unread ownership`, async ({ page }, info) => {
    info.setTimeout(90_000); const writes: string[] = [], errors: string[] = [], foreign: string[] = [], approvedFonts: string[] = [];
    const base = new URL(info.project.use.baseURL as string).origin;
    const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
    const previewReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
    page.on("pageerror", error => errors.push(error.message));
    await page.context().route("**/*", route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin !== base) {
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
    await expect(profile.locator('.rhh-food-detail [data-collection-art="food"]')).toHaveCount(1);
    await expect(profile.locator('[data-collection-art="food-stamp"]')).toHaveCount(0);
    expect((await profile.locator(".rhh-food-detail .vc-collection-art").boundingBox())!.width).toBeGreaterThanOrEqual(96);
    expect((await readCollection(page)).seen?.foods).toContain("bok-choy");
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-food`);
    await foodGrid.locator("button[tabindex='0']").focus(); await page.keyboard.press("Home");
    await expect(profile.locator(".rhh-food-detail strong")).toHaveText("???");
    await expect(profile.locator(".rhh-food-detail .rhh-collection-fact")).toHaveText("아직 맛보기 전");
    await profile.getByRole("button", { name: /^추억 도감/ }).click();
    await selectCompanionCollectionIndex(page, profile.locator(".rhh-behavior-grid"), 2);
    await expect(profile.locator(".rhh-memory-detail strong")).toHaveText("꾹꾹이");
    expect((await profile.locator(".rhh-memory-detail .vc-collection-art").boundingBox())!.width).toBeGreaterThanOrEqual(96);
    expect((await profile.locator(".rhh-behavior-grid button .vc-collection-art").first().boundingBox())!.width).toBeGreaterThanOrEqual(72);
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-memory`);
    await nav.getByRole("tab", { name: "옷장", exact: true }).click();
    const wardrobe = profile.locator(".rhh-companion-wardrobe"), preview = wardrobe.locator(".rhh-wardrobe-preview");
    await expect(wardrobe.locator(".rhh-gift-arrival")).toHaveCount(contents === "pending-gift" ? 1 : 0);
    await expect(preview).toHaveAttribute("data-preview-accessory", "sunglasses");
    expect((await preview.boundingBox())!.width).toBeGreaterThanOrEqual(portraitWidth);
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
    const narrowPreviewWidth = 148;
    expect((await preview.boundingBox())!.width).toBe(narrowPreviewWidth);
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
    expect((await profile.locator(".rhh-food-detail .vc-collection-art").boundingBox())!.width).toBeGreaterThanOrEqual(96);
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-food-short`);
    await selectCompanionCollectionIndex(page, foodGrid, COMPANION_FOOD_KINDS.indexOf(longestFood));
    await expect(profile.locator(".rhh-food-detail strong")).toHaveText(COMPANION_FOOD_NAMES[longestFood]);
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-food-short-long-name`);
    await profile.getByRole("button", { name: /^추억 도감/ }).click();
    await selectCompanionCollectionIndex(page, profile.locator(".rhh-behavior-grid"), 2);
    await expect(profile.locator(".rhh-memory-detail strong")).toHaveText("꾹꾹이");
    expect((await profile.locator(".rhh-memory-detail .vc-collection-art").boundingBox())!.width).toBeGreaterThanOrEqual(96);
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-memory-short`);
    await selectCompanionCollectionIndex(page, profile.locator(".rhh-behavior-grid"), longestMemoryIndex);
    await expect(profile.locator(".rhh-memory-detail strong")).toHaveText(memoryNames[longestMemoryIndex]);
    await inspectPage(page, dialog, profile.locator(".rhh-collection-book:visible"), `${name}-memory-short-long-name`);
    expect(writes).toEqual([]); expect(errors).toEqual([]); expect(foreign).toEqual([]);
    writeFileSync(`${output}/${name}-requests.json`, JSON.stringify({ approvedFonts, blockedForeign: foreign, writes, errors }, null, 2));
  });
}

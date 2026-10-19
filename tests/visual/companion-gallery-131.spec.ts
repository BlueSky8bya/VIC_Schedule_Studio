import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_BEHAVIOR_HINTS, COMPANION_BEHAVIOR_IDS, COMPANION_COLLECTION_KEY, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";
import { COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_FOOD_FACTS } from "@/lib/ui/viewer-companion/food-facts";
import { COMPANION_WEARABLE_IDS } from "@/lib/ui/viewer-companion/gifts";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { selectCompanionCollectionIndex } from "./helpers/companion-collection";

const output = process.env.COMPANION131_GALLERY_OUTPUT ?? ".scratch-pw/companion-131/gallery";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const longestFoodName = COMPANION_FOOD_KINDS.reduce((longest, kind) => COMPANION_FOOD_NAMES[kind].length > COMPANION_FOOD_NAMES[longest].length ? kind : longest);
const longestFoodFact = COMPANION_FOOD_KINDS.reduce((longest, kind) => COMPANION_FOOD_FACTS[kind].length > COMPANION_FOOD_FACTS[longest].length ? kind : longest);
const longestMemoryHint = COMPANION_BEHAVIOR_IDS.reduce((longest, id) => COMPANION_BEHAVIOR_HINTS[id].length > COMPANION_BEHAVIOR_HINTS[longest].length ? id : longest);
// Prior local fixtures test navigation/ACK only; they do not claim these foods,
// toys, memories or gifts were actually earned during this browser session.
const catalogue: CompanionCollection = {
  version: 1, foods: [...new Set([COMPANION_FOOD_KINDS[0], longestFoodName, longestFoodFact, COMPANION_FOOD_KINDS.at(-1)!])],
  behaviors: [...new Set([COMPANION_BEHAVIOR_IDS[0], COMPANION_BEHAVIOR_IDS[3], longestMemoryHint])], situations: [COMPANION_SITUATION_IDS[2]],
  gifts: { pending: null, unlocked: ["sunglasses", "beret"], equipped: "sunglasses", activeMs: 0, interactionCredit: 0 },
  seen: { foods: [], behaviors: [], situations: [], accessories: [] },
};
async function bounds(page: Page, book: Locator, rows: number | undefined, diagnostics: { path: string; samples: unknown[] }) {
  await expect(book).toBeVisible();
  const geometry = await book.evaluate(node => {
    const list = node.querySelector<HTMLElement>("ul")!, detail = node.querySelector<HTMLElement>(".rhh-collection-detail")!;
    const box = (element: Element) => { const rect = element.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }; };
    const ancestors = []; for (let element: HTMLElement | null = node as HTMLElement; element; element = element.parentElement) {
      const style = getComputedStyle(element);
      ancestors.push({ className: element.className, ...box(element), xOverflow: element.scrollWidth - element.clientWidth, yOverflow: element.scrollHeight - element.clientHeight, zoom: style.zoom, transform: style.transform, display: style.display, flex: style.flex, gap: style.gap });
      if (element.classList.contains("modal-card")) break;
    }
    return { detail: box(detail), detailOverflow: detail.scrollHeight - detail.clientHeight, detailWidthOverflow: detail.scrollWidth - detail.clientWidth, grid: box(list), rows: getComputedStyle(list).gridTemplateRows.split(/\s+/).length, gridOverflow: list.scrollHeight - list.clientHeight, gridWidthOverflow: list.scrollWidth - list.clientWidth, ancestors,
      buttons: [...node.querySelectorAll<HTMLButtonElement>("button")].map(button => { const rect = box(button), style = getComputedStyle(button), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2); return { ...rect, label: button.getAttribute("aria-label"), text: button.textContent, className: button.className, selected: button.getAttribute("aria-pressed"), cssWidth: style.width, cssHeight: style.height, minHeight: style.minHeight, zoom: style.zoom, transform: style.transform, disabled: button.disabled, hit: button === hit || button.contains(hit) }; }),
      hiddenArt: [...list.querySelectorAll("button:not([data-found])")].reduce((count, tile) => count + tile.querySelectorAll("[data-collection-art],img").length, 0),
      parts: [...detail.querySelectorAll(".rhh-wardrobe-preview,.rhh-wardrobe-description,.rhh-wardrobe-detail-copy > strong,.rhh-collection-detail-copy > *,button")].map(box),
    };
  });
  // Save before assertions: a failed hit target or unread transition must
  // retain its measured labels and geometry even when the test stops here.
  diagnostics.samples.push(geometry);
  writeFileSync(diagnostics.path, JSON.stringify(diagnostics.samples, null, 2));
  if (rows !== undefined) expect(geometry.rows).toBeGreaterThanOrEqual(rows);
  expect(geometry.gridOverflow).toBeLessThanOrEqual(2); expect(geometry.gridWidthOverflow).toBeLessThanOrEqual(2); expect(geometry.hiddenArt).toBe(0);
  expect(geometry.detailOverflow).toBeLessThanOrEqual(2); expect(geometry.detailWidthOverflow).toBeLessThanOrEqual(2);
  expect(geometry.ancestors.filter(item => item.xOverflow > 2 || item.yOverflow > 2)).toEqual([]);
  expect(geometry.grid.bottom).toBeLessThanOrEqual(page.viewportSize()!.height - 8);
  for (const button of geometry.buttons) { expect(button.width).toBeGreaterThanOrEqual(43.9); expect(button.height).toBeGreaterThanOrEqual(43.9); if (!button.disabled) expect(button.hit).toBe(true); }
  for (const part of geometry.parts) { expect(part.x).toBeGreaterThanOrEqual(geometry.detail.x); expect(part.right).toBeLessThanOrEqual(geometry.detail.right); expect(part.y).toBeGreaterThanOrEqual(geometry.detail.y); expect(part.bottom).toBeLessThanOrEqual(geometry.detail.bottom); }
  return geometry;
}
const sameSplit = (before: Awaited<ReturnType<typeof bounds>>, after: Awaited<ReturnType<typeof bounds>>) => {
  for (const key of ["detail", "grid"] as const) for (const dimension of ["x", "y", "width", "height"] as const) expect(Math.abs(after[key][dimension] - before[key][dimension]), `${key}.${dimension} stays fixed across unknown/found selection`).toBeLessThan(.5);
};

for (const [surface, entry, width, height, dark] of [["viewer", "book", 1050, 640, false], ["viewer", "settings", 1440, 900, true], ["studio", "book", 1920, 1100, true]] as const) test(`131 ${surface} ${entry} ${width}x${height}: unread traversal, keyboard pages and fixed gallery geometry`, async ({ page }, info) => {
  test.setTimeout(90000); const errors: string[] = [], rejected: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
    if (url.origin !== new URL(info.project.use.baseURL as string).origin || !["GET", "HEAD"].includes(request.method())) { rejected.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live API in fixture" });
    return route.continue();
  });
  await page.addInitScript(({ preferences, memory, catalogue, epoch, epochKey, dark }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "on", "vic.gfxPref": "off", "vic.dark": dark ? "on" : "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, sleep: false, feeding: false, ambientPrank: false, learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify(catalogue));
    localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify({ version: 1, toys: ["ball", "bell", "feather"], seen: ["ball"], toyTastes: {}, foodTastes: {} }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, catalogue, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, dark });
  await page.setViewportSize({ width, height });
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner&y=2025&m=11" : "/visual-fixture/poster?avatar=1"); await page.bringToFront(); await settlePanelLayout(page);
  if (entry === "book") {
    await expect.poll(async () => await page.getByRole("region", { name: "빅타민 집", exact: true }).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
    const room = await openCompanionHome(page); await room.locator('[data-home-action="book"]').click();
  } else {
    await page.getByRole("button", { name: "설정", exact: true }).click(); await page.getByRole("dialog", { name: "설정", exact: true }).getByRole("tab", { name: "빅타민", exact: true }).click();
  }
  const dialog = page.getByRole("dialog", { name: entry === "book" ? "빅타민 수첩" : "설정", exact: true }), profile = dialog.locator(".rhh-companion-profile"), nav = profile.getByRole("tablist", { name: "빅타민 프로필", exact: true });
  await expect(profile.locator(".rhh-wardrobe-preview")).toHaveAttribute("data-preview-ready", "");
  await dialog.evaluate(async node => {
    const opening = node.getAnimations().filter(animation => Number.isFinite(Number(animation.effect?.getTiming().iterations)));
    await Promise.all(opening.map(animation => animation.finished.catch(() => undefined)));
  });
  await nav.getByRole("tab", { name: "도감", exact: true }).click();
  const results: Record<string, unknown> = {}, name = `${surface}-${entry}-${width}-${height}`;
  mkdirSync(output, { recursive: true });
  const diagnostics = { path: `${output}/${name}-geometry.json`, samples: [] as unknown[] };
  const measure = (book: Locator, rows?: number) => bounds(page, book, rows, diagnostics);
  for (const [category, listName, known] of [["food", "냠냠 도감", 0], ["toy", "장난감 도감", 0], ["behavior", "추억 도감", 0]] as const) {
    await profile.locator(`[data-act="companion-collection-category"][data-act-opt="${category}"]`).click();
    const book = profile.locator(category === "toy" ? ".rhh-companion-toy-discovery" : ".rhh-companion-discovery"), grid = book.getByRole("list", { name: listName, exact: true });
    const unknown = category === "food" ? COMPANION_FOOD_KINDS.findIndex(kind => !catalogue.foods.includes(kind)) : category === "behavior" ? COMPANION_BEHAVIOR_IDS.findIndex(id => !catalogue.behaviors.includes(id)) : 1;
    await selectCompanionCollectionIndex(page, grid, unknown); const before = await measure(book, category === "food" ? 2 : undefined);
    await selectCompanionCollectionIndex(page, grid, known); sameSplit(before, await measure(book, category === "food" ? 2 : undefined));
    await selectCompanionCollectionIndex(page, grid, unknown);
    const unread = book.getByRole("button", { name: "다음 새 발견", exact: true }), inspected: number[] = [];
    for (let step = 0; await unread.isEnabled(); step++) {
      expect(step).toBeLessThan(6); await unread.click();
      const selected = grid.locator('[aria-pressed="true"]'); await expect(selected).toHaveAttribute("data-found", "true"); await expect(selected).not.toHaveAttribute("data-unread", "true");
      inspected.push(Number(await selected.getAttribute("data-collection-index"))); sameSplit(before, await measure(book, category === "food" ? 2 : undefined));
    }
    expect(inspected.length).toBeGreaterThan(0); expect(new Set(inspected).size).toBe(inspected.length); await expect(unread.locator(".rhh-collection-unread-count")).toHaveText("남은 새 발견 0개");
    const next = book.locator('[data-act="companion-collection-page"][data-act-opt="next"]');
    await grid.locator('[tabindex="0"]').focus(); await page.keyboard.press("Home"); await expect(grid.locator('[data-collection-index="0"]')).toBeFocused();
    await next.focus(); await page.keyboard.press("ArrowRight"); await expect(grid.locator('[tabindex="0"]')).toBeFocused();
    const pageFirst = Number(await grid.locator('[tabindex="0"]').getAttribute("data-collection-index")); expect(pageFirst).toBeGreaterThan(0);
    await page.keyboard.press("ArrowLeft"); await expect(grid.locator(`[data-collection-index="${pageFirst - 1}"]`)).toBeFocused();
    results[category] = { geometry: before, inspected, actualPageBoundaryIndex: pageFirst };
    await dialog.screenshot({ path: `${output}/${name}-${category}.png` });
  }
  await nav.getByRole("tab", { name: "옷장", exact: true }).click(); const wardrobe = profile.locator(".rhh-companion-wardrobe"), grid = wardrobe.getByRole("list", { name: "옷장 소품", exact: true });
  const unknown = COMPANION_WEARABLE_IDS.findIndex(id => !catalogue.gifts.unlocked.includes(id));
  await selectCompanionCollectionIndex(page, grid, unknown); const before = await measure(wardrobe);
  await selectCompanionCollectionIndex(page, grid, 0); sameSplit(before, await measure(wardrobe));
  const heading = wardrobe.locator(".rhh-collection-heading"); await expect(heading).toContainText("2/27");
  const headingVisible = await heading.isVisible();
  // The existing short-sheet layout omits this redundant title. Normal
  // sheets still prove the real owned2/27 bounds; every sheet proves the
  // always-visible page counter instead of measuring a hidden element.
  if (height > 700) expect(headingVisible).toBe(true);
  if (headingVisible) {
    const count = heading.locator(":scope > span").last(), countBox = (await count.boundingBox())!, headingBox = (await heading.boundingBox())!;
    expect(countBox.x).toBeGreaterThanOrEqual(headingBox.x); expect(countBox.x + countBox.width).toBeLessThanOrEqual(headingBox.x + headingBox.width);
  } else await expect(heading).toBeHidden();
  const pageCounter = wardrobe.locator(".rhh-collection-page-status > span").first(); await expect(pageCounter).toBeVisible(); await expect(pageCounter).toContainText(/\/\s*27$/);
  const counterBox = (await pageCounter.boundingBox())!, bookBox = (await wardrobe.boundingBox())!;
  expect(counterBox.x).toBeGreaterThanOrEqual(bookBox.x); expect(counterBox.x + counterBox.width).toBeLessThanOrEqual(bookBox.x + bookBox.width);
  await grid.locator('[tabindex="0"]').focus(); await page.keyboard.press("End"); await expect(grid.locator(`[data-collection-index="${COMPANION_WEARABLE_IDS.length - 1}"]`)).toBeFocused(); sameSplit(before, await measure(wardrobe));
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!) as CompanionCollection, COMPANION_COLLECTION_KEY);
  expect(saved.gifts.equipped).toBe("sunglasses"); expect(saved.gifts.unlocked).toEqual(catalogue.gifts.unlocked); expect(errors).toEqual([]); expect(rejected).toEqual([]);
  writeFileSync(`${output}/${name}.json`, JSON.stringify({ build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), priorLocalFixturesOnly: true, earnedInNativeSession: false, results, wardrobe: before, headingVisible, actualPageCounter: counterBox, errors, rejected }, null, 2));
  await dialog.screenshot({ path: `${output}/${name}.png` });
});

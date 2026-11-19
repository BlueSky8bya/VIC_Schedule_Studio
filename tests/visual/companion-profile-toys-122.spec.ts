import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_TOY_BOOK_ORDER } from "@/lib/ui/viewer-companion/collection-book-order";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

const out = process.env.COMPANION_PROFILE_UI_OUTPUT ?? ".scratch-pw/companion-122/profile-toys";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
async function fixture(page: Page, info: TestInfo, surface: "viewer" | "studio", dark = false, experienced = false) {
  const errors: string[] = [], rejected: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
    if (url.origin !== new URL(info.project.use.baseURL as string).origin || !["GET", "HEAD"].includes(request.method())) { rejected.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "Fixture has no live state" });
    return route.continue();
  });
  await page.addInitScript(({ preferences, memory, epoch, epochKey, dark, experienced }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "on", "vic.gfxPref": "off", "vic.dark": dark ? "on" : "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, sleep: false, feeding: false, ambientPrank: false, personality: "tidy", personalitySource: "manual" }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, life: { ...memory.life, favoriteFood: "peach", foodScores: { ...memory.life.foodScores, peach: .95 } } }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: experienced ? ["apple", "peach"] : [], behaviors: [], situations: [], gifts: { pending: null, unlocked: [], equipped: null, activeMs: 0, interactionCredit: 0 } }));
    if (experienced) localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify({ version: 1, toys: ["ball", "bell"], seen: [], toyTastes: { ball: { score: .6, accepted: 4, declined: 0 }, bell: { score: -.6, accepted: 2, declined: 6 } }, foodTastes: { apple: { score: -.6, accepted: 2, declined: 6 } } }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, dark, experienced });
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner&y=2025&m=11" : "/visual-fixture/poster?avatar=1"); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => await page.getByRole("region", { name: "빅타민 집", exact: true }).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  const room = await openCompanionHome(page);
  const open = async () => { await room.locator('[data-home-action="book"]').click(); const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(dialog).toBeVisible(); const profile = dialog.locator(".rhh-companion-profile"); await expect(profile.locator(".rhh-companion-interest")).toHaveAttribute("aria-label", "좋아하는 간식 · 복숭아"); await expect(profile.locator(".rhh-wardrobe-preview")).toBeVisible(); await expect(profile.locator(".rhh-wardrobe-preview")).toHaveAttribute("data-preview-ready", ""); return { dialog, profile }; };
  return { room, open, verify: () => { expect(errors).toEqual([]); expect(rejected).toEqual([]); } };
}
for (const [surface, dark, width] of [["viewer", false, 1440], ["studio", true, 1050]] as const) test(`122 ${surface} profile shows four readable illustrated tastes and only real manual toy discovery`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 780 }); const state = await fixture(page, info, surface, dark);
  expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanionTastes"))).toBeNull();
  // The room paints in stages (home-reveal.ts): press the chest once its "props" layer is painted, as a person can only
  // then see it. Pressed earlier (room still settling, resident not started) it takes nothing out.
  await expect.poll(() => state.room.locator(".vc-home-room").evaluate(node => { const shown = node.getAttribute("data-home-reveal"); return shown === null || shown.split(" ").includes("props"); })).toBe(true);
  await state.room.locator('[data-home-action="toys"]').click(); const toy = page.locator(".vc-toy").first(); await expect(toy).toBeVisible();
  const src = await toy.locator("img").getAttribute("src"), kind = COMPANION_TOY_KINDS.find(id => src?.endsWith(`toy-${id}.webp`))!; expect(kind).toBeDefined();
  // Taking a toy out is not a discovery (a2e6bf26): only a play the pet finishes adds it to the book. This still
  // resident never plays, so the real take-out must leave the record, the unread marks and every tile untouched.
  const knownToys = () => page.evaluate(() => (JSON.parse(localStorage.getItem("vic.viewerCompanionTastes") ?? "null") as { toys?: string[] } | null)?.toys ?? []);
  expect(await knownToys()).toEqual([]);
  const { dialog, profile } = await state.open(); const cards = profile.locator(".rhh-taste-card"); await expect(cards).toHaveCount(4);
  await expect(profile.locator(".rhh-profile-personality")).toHaveText("깔끔이");
  // A known taste carries its reason line inside the same <dd> (a44f46a2): the name leads, the reason follows.
  await expect(cards.locator("dd")).toHaveText([/^복숭아/, "알아가는 중", "알아가는 중", "알아가는 중"]);
  await expect(cards.locator(".rhh-taste-reason")).toHaveText(["원래 복숭아의 향긋한 과즙이 좋아요"]);
  // Read the real container, rather than injecting a narrow profile style.
  // A1050px desktop window alone does not imply a <=360px book container.
  const layout = await profile.evaluate(node => ({ width: node.getBoundingClientRect().width, portrait: getComputedStyle(node.querySelector(".rhh-companion-portrait")!).minHeight, preview: getComputedStyle(node.querySelector(".rhh-wardrobe-preview")!).width }));
  if (layout.width <= 360) { expect(layout.portrait).toBe("154px"); expect(layout.preview).toBe("124px"); }
  await info.attach("actual-profile-container", { body: JSON.stringify(layout), contentType: "application/json" });
  const geometry = await cards.evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, overflow: node.scrollWidth - node.clientWidth }; }));
  const bounds = (await dialog.boundingBox())!;
  for (const card of geometry) { expect(card.width).toBeGreaterThan(100); expect(card.overflow).toBeLessThanOrEqual(1); expect(card.x).toBeGreaterThanOrEqual(bounds.x); expect(card.right).toBeLessThanOrEqual(bounds.x + bounds.width); expect(card.bottom).toBeLessThanOrEqual(bounds.y + bounds.height); }
  expect(Math.abs(geometry[0].y - geometry[1].y)).toBeLessThan(1); expect(geometry[2].y).toBeGreaterThanOrEqual(geometry[0].bottom);
  mkdirSync(out, { recursive: true }); await dialog.screenshot({ path: `${out}/${surface}-tastes.png` });
  await profile.getByRole("tab", { name: "도감", exact: true }).click();
  const category = profile.locator('[data-act="companion-collection-category"][data-act-opt="toy"]'); await expect(category).not.toHaveAttribute("data-unread"); await category.click();
  const book = profile.locator(".rhh-companion-toy-discovery"); await expect(book).toBeVisible();
  // The page size is measured from the mounted grid (useCompanionCollectionLayout: default 4x2 until the first
  // measure). Read pages only after the book's entrance animations finished and the tile count held for two frames;
  // a read during that settle saw page 1 at the default size and page 2 at the measured one (first index 5 after 0..7).
  await expect.poll(() => book.evaluate(async node => {
    await Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined)));
    const count = () => node.querySelectorAll(".rhh-collection-tile").length, before = count();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return before === count() ? before : 0;
  })).toBeGreaterThan(0);
  const indexes: number[] = [];
  for (let i = 0; i < COMPANION_TOY_KINDS.length; i++) {
    const tiles = book.locator(".rhh-collection-tile"); indexes.push(...await tiles.evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-collection-index")))));
    const hiddenImages = await tiles.evaluateAll(nodes => nodes.filter(node => !node.hasAttribute("data-found")).reduce((n, node) => n + node.querySelectorAll("img").length, 0)); expect(hiddenImages).toBe(0);
    await expect(tiles.filter({ hasText: COMPANION_TOY_NAMES[kind] })).toHaveCount(0); await expect(book.locator("[data-found],[data-unread]")).toHaveCount(0);
    const next = book.getByRole("button", { name: "다음 페이지", exact: true }); if (await next.isDisabled()) break;
    // Read the next page only once it has replaced this one (a loaded machine painted the old page again).
    const last = indexes[indexes.length - 1]; await next.click();
    await expect.poll(() => tiles.first().getAttribute("data-collection-index").then(Number)).toBeGreaterThan(last);
  }
  expect(indexes).toEqual(COMPANION_TOY_KINDS.map((_, index) => index)); expect(await knownToys()).toEqual([]);
  const selectedBefore = await book.locator('[data-collection-index][aria-pressed="true"]').getAttribute("data-collection-index");
  // Left/Right belong to the page buttons everywhere in an open book (85c922c1); the category row keeps Home/End.
  // Leaving for another book and coming back keeps the toy that was selected.
  await category.focus(); await page.keyboard.press("End"); await expect(profile.locator('[data-act="companion-collection-category"][data-act-opt="behavior"]')).toBeFocused();
  await expect(profile.locator('[data-act="companion-collection-category"][data-act-opt="behavior"]')).toHaveAttribute("aria-pressed", "true"); await expect(book).toHaveCount(0);
  await category.click(); await expect(book).toBeVisible();
  await expect(book.locator(`[data-collection-index="${selectedBefore}"]`)).toHaveAttribute("aria-pressed", "true");
  const overflow = await profile.evaluate(node => node.scrollWidth - node.clientWidth); expect(overflow).toBeLessThanOrEqual(1);
  await expect(category).not.toHaveAttribute("data-unread", "true"); await dialog.screenshot({ path: `${out}/${surface}-toy-book.png` });
  state.verify();
});
test("122 profile reads bounded prior toy/food reactions without discovering other toys", async ({ page }, info) => {
  await page.setViewportSize({ width: 1050, height: 780 }); const state = await fixture(page, info, "viewer", true, true), { profile } = await state.open();
  //130 preserves prior reactions without inventing a sensory aversion from
  // old boredom refusals, or fabricating a reason the legacy record lacks.
  await expect(profile.locator(".rhh-taste-card dd")).toHaveText([/^복숭아/, "알아가는 중", /^통통 공/, "알아가는 중"]);
  // Liked things now say why (a44f46a2): the innate favourite and the toy it accepted four times. The two dislike
  // cards stay unknown, so no reason is made up for the old refusals.
  await expect(profile.locator(".rhh-taste-reason")).toHaveText(["원래 복숭아의 향긋한 과즙이 좋아요", "공을 통통 던지고 받아 보는 게 신나요 · 여러 번 놀아서 정들었어요"]);
  await expect(profile.locator(".rhh-taste-card[data-dislike] .rhh-taste-reason")).toHaveCount(0);
  await expect.poll(() => profile.locator(".rhh-taste-card img").evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const before = await page.evaluate(() => localStorage.getItem("vic.viewerCompanionTastes"));
  const legacy = JSON.parse(before!);
  expect(legacy.toys).toEqual(["ball", "bell"]); expect(legacy.seen).toEqual([]);
  expect(legacy.toyTastes.bell).toEqual({ score: -.6, accepted: 2, declined: 6 });
  await profile.getByRole("tab", { name: "도감", exact: true }).click(); await profile.locator('[data-act="companion-collection-category"][data-act-opt="toy"]').click();
  await expect(profile.locator(".rhh-companion-toy-discovery")).toBeVisible(); expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanionTastes"))).toBe(before);
  // The two toys of the prior record were never looked at: only they are found, and looking at one clears its own mark.
  const toyBook = profile.locator(".rhh-companion-toy-discovery"), toyCategory = profile.locator('[data-act="companion-collection-category"][data-act-opt="toy"]'); await expect(toyCategory).toHaveAttribute("data-unread", "true");
  // Turning pages with the range control inspects nothing (helpers/companion-collection.ts); the tile click does.
  const ballIndex = COMPANION_TOY_BOOK_ORDER.indexOf("ball"), ball = toyBook.locator(`[data-collection-index="${ballIndex}"]`), rail = toyBook.getByRole("slider");
  await rail.focus(); await page.keyboard.press("Home"); await expect(rail).toHaveValue("1");
  for (let turns = 0; !await ball.count(); turns++) { expect(turns).toBeLessThan(COMPANION_TOY_KINDS.length); const current = await rail.inputValue(); await rail.press("PageDown"); await expect(rail).not.toHaveValue(current); }
  await expect(ball).toHaveAttribute("data-found", "true"); await expect(ball).toHaveAccessibleName(`${COMPANION_TOY_NAMES.ball} · 만났어요`); await expect(ball).toHaveAttribute("data-unread", "true");
  await ball.click(); await expect(ball).not.toHaveAttribute("data-unread"); await expect(toyCategory).toHaveAttribute("data-unread", "true"); // the bell is still new
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionTastes")!).seen)).toContain("ball");
  // stage 3: the learned-state reset sits on "함께 지내기", after the habits; it asks once before resetting.
  await profile.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "함께 지내기", exact: true }).click();
  await profile.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
  await profile.getByRole("button", { name: "배운 습관 초기화 확정", exact: true }).click();
  const reset = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionTastes")!));
  expect(reset.toys).toEqual(["ball", "bell"]); expect(reset.seen).toContain("ball"); expect(reset.toyTastes).toEqual({}); expect(reset.foodTastes).toEqual({});
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCollection")!).foods)).toEqual(["apple", "peach"]);
  state.verify();
});

import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES } from "@/lib/ui/viewer-companion/toy-catalog";
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
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, sleep: false, feeding: false, ambientPrank: false, personality: "tidy" }));
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
  await state.room.locator('[data-home-action="toys"]').click(); const toy = page.locator(".vc-toy").first(); await expect(toy).toBeVisible();
  const src = await toy.locator("img").getAttribute("src"), kind = COMPANION_TOY_KINDS.find(id => src?.endsWith(`toy-${id}.webp`))!; expect(kind).toBeDefined();
  const { dialog, profile } = await state.open(); const cards = profile.locator(".rhh-taste-card"); await expect(cards).toHaveCount(4);
  await expect(profile.locator(".rhh-profile-personality")).toHaveText("깔끔이");
  await expect(cards.locator("dd")).toHaveText(["복숭아", "알아가는 중", "알아가는 중", "알아가는 중"]);
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
  const category = profile.locator('[data-act="companion-collection-category"][data-act-opt="toy"]'); await expect(category).toHaveAttribute("data-unread", "true"); await category.click();
  const book = profile.locator(".rhh-companion-toy-discovery"); await expect(book).toBeVisible();
  const indexes: number[] = []; let inspected = false;
  for (let i = 0; i < COMPANION_TOY_KINDS.length; i++) {
    const tiles = book.locator(".rhh-collection-tile"); indexes.push(...await tiles.evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-collection-index")))));
    const hiddenImages = await tiles.evaluateAll(nodes => nodes.filter(node => !node.hasAttribute("data-found")).reduce((n, node) => n + node.querySelectorAll("img").length, 0)); expect(hiddenImages).toBe(0);
    const known = tiles.filter({ hasText: COMPANION_TOY_NAMES[kind] });
    if (await known.count()) { await expect(known).toHaveAttribute("data-unread", "true"); await known.click(); await expect(known).not.toHaveAttribute("data-unread", "true"); inspected = true; }
    const next = book.getByRole("button", { name: "다음 장난감", exact: true }); if (await next.isDisabled()) break; await next.click();
  }
  expect(indexes).toEqual(COMPANION_TOY_KINDS.map((_, index) => index)); expect(inspected).toBe(true);
  const selectedBefore = await book.locator('[data-collection-index][aria-pressed="true"]').getAttribute("data-collection-index");
  await category.focus(); await page.keyboard.press("ArrowRight"); await expect(profile.locator('[data-act="companion-collection-category"][data-act-opt="behavior"]')).toBeFocused(); await page.keyboard.press("ArrowLeft"); await expect(category).toBeFocused();
  await expect(book.locator(`[data-collection-index="${selectedBefore}"]`)).toHaveAttribute("aria-pressed", "true");
  const overflow = await profile.evaluate(node => node.scrollWidth - node.clientWidth); expect(overflow).toBeLessThanOrEqual(1);
  await expect(category).not.toHaveAttribute("data-unread", "true"); await dialog.screenshot({ path: `${out}/${surface}-toy-book.png` });
  state.verify();
});
test("122 profile reads bounded prior toy/food reactions without discovering other toys", async ({ page }, info) => {
  await page.setViewportSize({ width: 1050, height: 780 }); const state = await fixture(page, info, "viewer", true, true), { profile } = await state.open();
  //130 preserves prior reactions without inventing a sensory aversion from
  // old boredom refusals, or fabricating a reason the legacy record lacks.
  await expect(profile.locator(".rhh-taste-card dd")).toHaveText(["복숭아", "알아가는 중", "통통 공", "알아가는 중"]);
  await expect(profile.locator(".rhh-taste-reason")).toHaveCount(0);
  await expect.poll(() => profile.locator(".rhh-taste-card img").evaluateAll(nodes => nodes.every(node => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const before = await page.evaluate(() => localStorage.getItem("vic.viewerCompanionTastes"));
  const legacy = JSON.parse(before!);
  expect(legacy.toys).toEqual(["ball", "bell"]); expect(legacy.seen).toEqual([]);
  expect(legacy.toyTastes.bell).toEqual({ score: -.6, accepted: 2, declined: 6 });
  await profile.getByRole("tab", { name: "도감", exact: true }).click(); await profile.locator('[data-act="companion-collection-category"][data-act-opt="toy"]').click();
  await expect(profile.locator(".rhh-companion-toy-discovery")).toBeVisible(); expect(await page.evaluate(() => localStorage.getItem("vic.viewerCompanionTastes"))).toBe(before);
  await profile.getByRole("tab", { name: "환경설정", exact: true }).click();
  await profile.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "기본", exact: true }).click();
  await profile.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
  const reset = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionTastes")!));
  expect(reset.toys).toEqual(["ball", "bell"]); expect(reset.seen).toEqual([]); expect(reset.toyTastes).toEqual({}); expect(reset.foodTastes).toEqual({});
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCollection")!).foods)).toEqual(["apple", "peach"]);
  state.verify();
});

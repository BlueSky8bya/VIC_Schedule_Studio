import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";

const copyOutput = process.env.COMPANION_COPY_REGRESSION_OUTPUT ?? ".scratch-pw/companion-114/copy";
test.use({ viewport: { width: 1440, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });

async function assertCompanionAppearance(dialog: Locator) {
  const profile = dialog.locator(".rhh-companion-profile");
  const nav = profile.getByRole("tablist", { name: "빅타민 프로필", exact: true });
  await expect(nav.getByRole("tab")).toHaveText(["함께 지내기", "도감", "옷장", "환경설정"]);
  await expect(nav.getByRole("tab", { name: "함께 지내기", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(profile.getByRole("button", { name: "옷장 열기", exact: true })).toBeVisible();
  await expect(profile.getByRole("switch")).toHaveCount(0);
  await expect.poll(() => nav.locator(".rhh-seg-thumb").evaluate(node => node.getAnimations().filter(animation => animation.playState === "running").length)).toBe(0);
  const appearance = await profile.evaluate(root => {
    const canvas = document.createElement("canvas"); canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const rgba = (value: string) => { context.clearRect(0, 0, 1, 1); context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data]; };
    const luminance = (rgb: number[]) => rgb.slice(0, 3).map(channel => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const contrast = (first: number[], second: number[]) => { const a = luminance(first), b = luminance(second); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const reading = [...root.querySelectorAll("h3,h4,p,li,dt,dd")].filter(element => element.getBoundingClientRect().width > 0).map(element => {
      let background = [255, 255, 255]; const ancestors: Element[] = [];
      for (let current: Element | null = element; current; current = current.parentElement) ancestors.unshift(current);
      for (const current of ancestors) { const color = rgba(getComputedStyle(current).backgroundColor), alpha = color[3] / 255; background = background.map((channel, index) => color[index] * alpha + channel * (1 - alpha)); }
      const foreground = rgba(getComputedStyle(element).color), alpha = foreground[3] / 255;
      return { text: element.textContent, contrast: contrast(foreground.slice(0, 3).map((channel, index) => channel * alpha + background[index] * (1 - alpha)), background) };
    });
    const selected = root.querySelector('.rhh-profile-nav [aria-selected="true"]')!.getBoundingClientRect(), thumb = root.querySelector(".rhh-profile-nav .rhh-seg-thumb")!.getBoundingClientRect();
    return { reading, thumbAlpha: rgba(getComputedStyle(root.querySelector(".rhh-profile-nav .rhh-seg-thumb")!).backgroundColor)[3], thumbAlignment: Math.abs(selected.x + selected.width / 2 - thumb.x - thumb.width / 2), controls: [...root.querySelectorAll("button")].filter(element => element.getBoundingClientRect().width > 0).map(element => { const rect = element.getBoundingClientRect(); return { name: element.getAttribute("aria-label") || element.textContent, width: rect.width, height: rect.height }; }) };
  });
  expect(appearance.thumbAlpha).toBe(255); expect(appearance.thumbAlignment).toBeLessThanOrEqual(2);
  // The retired four explanatory cards no longer inflate this count. Still
  // measure all11 real headings, facts, learned effects and recent-event text.
  expect(appearance.reading.length).toBeGreaterThanOrEqual(11);
  for (const row of appearance.reading) expect(row.contrast, row.text ?? "visible companion text").toBeGreaterThanOrEqual(4.5);
  for (const control of appearance.controls) { expect(control.height, control.name ?? "control height").toBeGreaterThanOrEqual(44); expect(control.width, control.name ?? "control width").toBeGreaterThanOrEqual(44); }
}

async function openTraits(page: Page) {
  await settlePanelLayout(page);
  // A restored preview may keep its overlay panel open. Use its real close
  // control before accessing the header button behind the panel scrim.
  if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) {
    await page.getByRole("button", { name: "패널 접기", exact: true }).click();
    await settlePanelLayout(page);
  }
  const settings = page.getByRole("button", { name: "설정", exact: true });
  if (!await settings.isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await settlePanelLayout(page);
  return { dialog, traits: dialog.locator(".rhh-companion-profile") };
}

for (const surface of ["viewer", "studio", "preview"] as const) for (const theme of ["light", "dark"] as const) {
  test(`${surface} ${theme}: actionable local traits preserve storage, OFF, native reset and reload`, async ({ page, context }) => {
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
    const initialLife = createCompanionLife(() => 0);
    const life = { ...initialLife, foodScores: { ...initialLife.foodScores, peach: .9 }, favoriteFood: "peach" as const, social: .8, play: .8, curiosity: .8, comfort: .8, recent: ["variety" as const] };
    await page.addInitScript(({ prefs, care, life, key, epoch, theme }) => {
      if (localStorage.getItem("fixture.traits107")) return;
      localStorage.setItem("fixture.traits107", "seeded");
      for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": theme === "dark" ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "on", "vic.gfxPref": "max" })) localStorage.setItem(name, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: .23, affection: .64, habits: { sociability: .6, playfulness: .3, confidence: .5, credit: 0, generation: 0 }, life }));
    }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, life, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, theme });
    await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
    await page.bringToFront(); await settlePanelLayout(page);
    if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
    const { dialog, traits } = await openTraits(page);
    await assertCompanionAppearance(dialog);
    await expect(traits.locator(".rhh-companion-portrait .rhh-wardrobe-preview-paused")).toHaveCount(0);
    await expect(traits.locator(".rhh-companion-facts dd").first()).toHaveText("복숭아");
    await expect(traits.locator(".rhh-profile-action-grid,.rhh-profile-action,.rhh-profile-try,.rhh-profile-motion-note,.rhh-trait-note")).toHaveCount(0);
    await expect(traits).not.toContainText("해보기");
    await expect(dialog.locator(".rhh-trait-reason")).toHaveText("최근 경험다른 간식 맛보기");
    await expect(traits.locator(".rhh-companion-summary button")).toHaveCount(1);
    await expect(traits.locator("input,[role=switch]")).toHaveCount(0);
    const layout = await traits.evaluate(region => ({ overflow: region.scrollWidth - region.clientWidth, rows: [...region.querySelectorAll("h3,li,p,dt,dd")].filter(node => node.getBoundingClientRect().width > 0).map(node => ({ font: parseFloat(getComputedStyle(node).fontSize), overflow: node.scrollWidth - node.clientWidth })), sections: [...region.querySelectorAll(".rhh-companion-summary,.rhh-profile-habits,.rhh-trait-reason")].map(node => { const box = node.getBoundingClientRect(); return { top: box.top, bottom: box.bottom }; }), fruit: region.querySelector(".rhh-companion-portrait .rhh-wardrobe-preview")?.getBoundingClientRect().width }));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.rows.length).toBeGreaterThan(8);
    for (const row of layout.rows) { expect(row.font).toBeGreaterThanOrEqual(13.5); expect(row.overflow).toBeLessThanOrEqual(1); }
    expect(layout.sections).toHaveLength(3);
    for (let index = 1; index < layout.sections.length; index++) expect(layout.sections[index].top).toBeGreaterThanOrEqual(layout.sections[index - 1].bottom);
    expect(layout.fruit).toBeGreaterThanOrEqual(132);
    mkdirSync(".scratch-pw/companion-114/copy/traits", { recursive: true });
    const profile = dialog.locator(".rhh-companion-profile");
    await page.screenshot({ path: `${copyOutput}/traits/viewport-profile-${surface}-${theme}.png` });
    await profile.screenshot({ path: `${copyOutput}/traits/${surface}-${theme}.png` });
    if (surface === "viewer" && theme === "light") {
      // A second real same-origin tab exercises the browser's storage event;
      // no model callback, event dispatch, state or geometry is substituted.
      const sibling = await context.newPage();
      await sibling.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Local storage fixture</title>" }));
      await sibling.goto(new URL(page.url()).origin + "/visual-fixture/poster");
      await sibling.evaluate(() => {
        const memory = JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!);
        memory.life = { ...memory.life, favoriteFood: "strawberry", foodScores: { ...memory.life.foodScores, strawberry: .95 }, social: .2, play: .2, curiosity: .2, comfort: .2, recent: ["new-flavor"] };
        memory.habits = { ...memory.habits, sociability: -.6, playfulness: -.3, confidence: -.5 };
        localStorage.setItem("vic.viewerCompanionCare", JSON.stringify(memory));
      });
      await sibling.close(); await page.bringToFront();
      await expect(traits.locator(".rhh-companion-facts dd").first()).toHaveText("딸기");
      await expect(dialog.getByRole("region", { name: "배운 습관", exact: true }).locator("li")).toHaveText(["마우스에서 조금 떨어져 걸어요.", "재롱을 덜 부려요.", "조금 더 오래 두리번거려요."]);
      await expect(dialog.locator(".rhh-trait-reason")).toHaveText("최근 경험새 간식 맛보기");
      // Real desktop resize exercises the shared responsive layout, keeping
      // the mobile capability gate intact rather than forcing hidden UI on.
      await page.setViewportSize({ width: 1050, height: 900 });
      await settlePanelLayout(page);
      await expect(dialog.getByRole("tab", { name: "함께 지내기", exact: true })).toBeVisible();
      const narrow = await profile.evaluate(element => ({ overflow: element.scrollWidth - element.clientWidth, rows: [...element.querySelectorAll("h3,h4,li,strong,p,dt,dd")].filter(node => node.getBoundingClientRect().width > 0).map(node => ({ overflow: node.scrollWidth - node.clientWidth, font: parseFloat(getComputedStyle(node).fontSize) })) }));
      expect(narrow.overflow).toBeLessThanOrEqual(1);
      expect(narrow.rows.length).toBeGreaterThan(8);
      for (const row of narrow.rows) { expect(row.overflow).toBeLessThanOrEqual(1); expect(row.font).toBeGreaterThanOrEqual(13.5); }
      await profile.screenshot({ path: `${copyOutput}/traits/narrow-desktop.png` });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await settlePanelLayout(page);
    }
    const rememberedEffects = await dialog.getByRole("region", { name: "배운 습관", exact: true }).locator("li").allTextContents();
    const learning = dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true });
    await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
    await learning.click(); await expect(learning).toHaveAttribute("aria-checked", "false");
    await dialog.getByRole("tab", { name: "함께 지내기", exact: true }).click();
    await expect(dialog.locator(".rhh-habit-paused")).toContainText("적용 중지");
    // OFF visibly marks these retained learned effects inactive.
    await expect(dialog.getByRole("region", { name: "배운 습관", exact: true }).locator("li")).toHaveText(rememberedEffects);
    expect((await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!))).learnFromYou).toBe(false);
    await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
    await dialog.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
    await dialog.getByRole("tab", { name: "함께 지내기", exact: true }).click();
    await expect(traits.locator(".rhh-companion-facts dd").first()).toHaveText("사과");
    await expect(dialog.getByRole("region", { name: "배운 습관", exact: true }).locator("li")).toHaveCount(0);
    await expect(dialog.getByRole("region", { name: "배운 습관", exact: true })).toContainText("아직 배운 습관이 없어요");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!));
    expect(saved.hunger).toBe(.23); expect(saved.affection).toBe(.64);
    await page.reload(); await page.bringToFront();
    if (surface === "preview") {
      if (!await page.locator(".viewer-fullscreen").count()) await page.locator(".io-preview").click();
      await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();
    }
    const reopened = await openTraits(page);
    await expect(reopened.traits.locator(".rhh-companion-facts dd").first()).toHaveText("사과");
    await reopened.dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
    await expect(reopened.dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true })).toHaveAttribute("aria-checked", "false");
    expect(writes).toEqual([]); expect(errors).toEqual([]);
  });
}

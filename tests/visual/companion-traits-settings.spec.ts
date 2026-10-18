import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";

test.use({ viewport: { width: 1440, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });

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
  await dialog.getByRole("tab", { name: "프로필", exact: true }).click();
  await settlePanelLayout(page);
  return { dialog, traits: dialog.getByRole("region", { name: "빅타민 특성", exact: true }) };
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
      if (localStorage.getItem("fixture.traits106")) return;
      localStorage.setItem("fixture.traits106", "seeded");
      for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": theme === "dark" ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "on", "vic.gfxPref": "max" })) localStorage.setItem(name, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: .23, affection: .64, habits: { sociability: .6, playfulness: .3, confidence: .5, credit: 0, generation: 0 }, life }));
    }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, life, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, theme });
    await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
    await page.bringToFront(); await settlePanelLayout(page);
    if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
    const { dialog, traits } = await openTraits(page);
    await expect(traits.locator(".rhh-trait-favorite strong")).toHaveText("복숭아");
    const actions = traits.locator(".rhh-profile-action");
    await expect(actions.locator("h4")).toHaveText(["마우스 곁에서 교감", "좋아하는 맛 고르기", "집에서 포근하게", "응원과 작은 장난"]);
    await expect(actions.nth(0)).toContainText("쓰다듬기를 부탁하거나 몸을 기대는 장면");
    await expect(actions.nth(1)).toContainText("거리와 좋아하는 맛을 함께");
    await expect(actions.nth(2)).toContainText("피곤하지 않아도");
    await expect(actions.nth(3)).toContainText("응원 동작을 연습");
    await expect(actions.locator(".rhh-profile-try")).toHaveCount(4);
    for (const hint of await actions.locator(".rhh-profile-try").allTextContents()) expect(hint.replace("해보기", "").trim().length).toBeGreaterThan(10);
    await expect(dialog.locator(".rhh-trait-reason")).toContainText("여러 맛을 골고루 알아가고 있어요");
    await expect(traits.locator("button,input,[role=switch]")).toHaveCount(0);
    const layout = await traits.evaluate(region => ({ overflow: region.scrollWidth - region.clientWidth, rows: [...region.querySelectorAll("h4,p,.rhh-trait-favorite-copy > span,.rhh-trait-favorite-copy > strong")].filter(node => node.getBoundingClientRect().width > 0).map(node => ({ font: parseFloat(getComputedStyle(node).fontSize), overflow: node.scrollWidth - node.clientWidth })), tiles: [...region.querySelectorAll(".rhh-profile-action")].map(node => { const box = node.getBoundingClientRect(); return { x: Math.round(box.x), y: Math.round(box.y) }; }), fruit: region.querySelector(".rhh-profile-food-art")?.getBoundingClientRect().width }));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    expect(layout.rows.length).toBeGreaterThan(8);
    for (const row of layout.rows) { expect(row.font).toBeGreaterThanOrEqual(13.5); expect(row.overflow).toBeLessThanOrEqual(1); }
    expect(new Set(layout.tiles.map(tile => tile.x)).size).toBe(2);
    expect(new Set(layout.tiles.map(tile => tile.y)).size).toBe(2);
    expect(layout.fruit).toBe(40);
    mkdirSync(".scratch-pw/companion-106-settings", { recursive: true });
    const profile = dialog.locator(".rhh-companion-profile");
    await profile.screenshot({ path: `.scratch-pw/companion-106-settings/${surface}-${theme}.png` });
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
      await expect(traits.locator(".rhh-trait-favorite strong")).toHaveText("딸기");
      await expect(actions.nth(0)).toContainText("먼저 다가오는 교감은 아직 뜸해요");
      await expect(actions.nth(2)).toContainText("피곤할 때 집에서 몸을 모아 쉬어요");
      await expect(actions.nth(3)).toContainText("응원 연습을 고를 바탕이 자라요");
      await expect(dialog.getByRole("region", { name: "배운 습관", exact: true }).locator("li")).toHaveText(["마우스와 거리를 조금 더 두려 해요.", "놀이보다 쉬어 가는 쪽으로 기울었어요.", "새로운 자리를 조금 더 오래 살펴요."]);
      // Real desktop resize exercises the shared responsive layout, keeping
      // the mobile capability gate intact rather than forcing hidden UI on.
      await page.setViewportSize({ width: 1050, height: 900 });
      await settlePanelLayout(page);
      await expect(dialog.getByRole("tab", { name: "프로필", exact: true })).toBeVisible();
      const narrow = await profile.evaluate(element => ({ overflow: element.scrollWidth - element.clientWidth, rows: [...element.querySelectorAll("h3,h4,li,strong,p")].filter(node => node.getBoundingClientRect().width > 0).map(node => ({ overflow: node.scrollWidth - node.clientWidth, font: parseFloat(getComputedStyle(node).fontSize) })) }));
      expect(narrow.overflow).toBeLessThanOrEqual(1);
      expect(narrow.rows.length).toBeGreaterThan(8);
      for (const row of narrow.rows) { expect(row.overflow).toBeLessThanOrEqual(1); expect(row.font).toBeGreaterThanOrEqual(13.5); }
      await profile.screenshot({ path: ".scratch-pw/companion-106-settings/narrow-desktop.png" });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await settlePanelLayout(page);
    }
    const learning = dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true });
    await learning.click(); await expect(learning).toHaveAttribute("aria-checked", "false");
    await expect(dialog.locator(".rhh-habit-paused")).toContainText("배우기 끔 · 기억은 보관");
    // OFF preserves stored memories while effects use the neutral defaults.
    await expect(actions.nth(0)).toContainText("쓰다듬기를 부탁하거나 몸을 기대는 장면");
    await expect(actions.nth(1)).toContainText("가까운 쪽을 먼저");
    await expect(actions.nth(2)).toContainText("피곤할 때 집에서 몸을 모아 쉬어요");
    await expect(actions.nth(3)).toContainText("응원 동작을 연습");
    await dialog.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
    await expect(traits.locator(".rhh-trait-favorite strong")).toHaveText("사과");
    await expect(dialog.getByRole("region", { name: "배운 습관", exact: true }).locator("li")).toHaveCount(0);
    await expect(dialog.getByRole("region", { name: "배운 습관", exact: true })).toContainText("아직 뚜렷한 변화는 없어요");
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!));
    expect(saved.hunger).toBe(.23); expect(saved.affection).toBe(.64);
    await page.reload(); await page.bringToFront();
    if (surface === "preview") {
      if (!await page.locator(".viewer-fullscreen").count()) await page.locator(".io-preview").click();
      await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();
    }
    const reopened = await openTraits(page);
    await expect(reopened.traits.locator(".rhh-trait-favorite strong")).toHaveText("사과");
    await expect(reopened.dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true })).toHaveAttribute("aria-checked", "false");
    expect(writes).toEqual([]); expect(errors).toEqual([]);
  });
}

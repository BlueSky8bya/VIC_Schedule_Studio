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
  test(`${surface} ${theme}: current local traits, native reset and reload share one readable card`, async ({ page, context }) => {
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
      if (localStorage.getItem("fixture.traits104")) return;
      localStorage.setItem("fixture.traits104", "seeded");
      for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": theme === "dark" ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "on", "vic.gfxPref": "max" })) localStorage.setItem(name, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: .23, affection: .64, habits: { sociability: .6, playfulness: .3, confidence: .5, credit: 0, generation: 0 }, life }));
    }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, life, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, theme });
    await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
    await page.bringToFront(); await settlePanelLayout(page);
    if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
    const { dialog, traits } = await openTraits(page);
    await expect(traits.locator(".rhh-trait-favorite strong")).toHaveText("복숭아");
    await expect(traits.locator(".rhh-trait-list dt")).toHaveText(["교감", "놀이", "호기심", "편안함"]);
    await expect(traits.locator(".rhh-trait-state")).toHaveText(["친근해요", "놀기 좋아요", "새로움 선호", "편안해요"]);
    await expect(traits.locator(".rhh-trait-description")).toHaveText(["곁에서 지내는 게 좋아요", "장난칠 거리를 찾아요", "새로운 곳이 궁금해요", "편안한 리듬으로 지내요"]);
    await expect(dialog.locator(".rhh-trait-reason")).toContainText("다른 맛도 골고루");
    await expect(traits.locator("button,input,[role=switch]")).toHaveCount(0);
    const layout = await traits.evaluate(region => ({ overflow: region.scrollWidth - region.clientWidth, rows: [...region.querySelectorAll("dt,dd,.rhh-trait-intro,.rhh-trait-note")].map(node => ({ font: parseFloat(getComputedStyle(node).fontSize), overflow: node.scrollWidth - node.clientWidth })) }));
    expect(layout.overflow).toBeLessThanOrEqual(1);
    for (const row of layout.rows) { expect(row.font).toBeGreaterThanOrEqual(13.5); expect(row.overflow).toBeLessThanOrEqual(1); }
    mkdirSync(".scratch-pw/companion-105-settings", { recursive: true });
    const profile = dialog.locator(".rhh-companion-profile");
    await profile.screenshot({ path: `.scratch-pw/companion-105-settings/${surface}-${theme}.png` });
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
      await expect(traits.locator(".rhh-trait-state")).toHaveText(["천천히 교감", "느긋해요", "익숙함 선호", "조심스러워요"]);
      await expect(traits.locator(".rhh-trait-description")).toHaveText(["조금 떨어져 지켜봐요", "느긋하게 쉬어 가요", "익숙한 곳을 살펴요", "조심스럽게 살피는 중"]);
      await expect(dialog.getByRole("region", { name: "배운 습관", exact: true }).locator("dd")).toHaveText(["혼자 노는 시간", "느긋하게 쉬엄쉬엄", "먼저 살피고 천천히"]);
      // Real desktop resize exercises the shared responsive layout, keeping
      // the mobile capability gate intact rather than forcing hidden UI on.
      await page.setViewportSize({ width: 1050, height: 900 });
      await settlePanelLayout(page);
      await expect(dialog.getByRole("tab", { name: "프로필", exact: true })).toBeVisible();
      const narrow = await profile.evaluate(element => ({ overflow: element.scrollWidth - element.clientWidth, rows: [...element.querySelectorAll("h3,dt,dd,strong,span,p")].filter(node => node.getBoundingClientRect().width > 0).map(node => ({ overflow: node.scrollWidth - node.clientWidth, font: parseFloat(getComputedStyle(node).fontSize) })) }));
      expect(narrow.overflow).toBeLessThanOrEqual(1);
      for (const row of narrow.rows) { expect(row.overflow).toBeLessThanOrEqual(1); expect(row.font).toBeGreaterThanOrEqual(13.5); }
      await profile.screenshot({ path: ".scratch-pw/companion-105-settings/narrow-desktop.png" });
      await page.setViewportSize({ width: 1440, height: 1100 });
      await settlePanelLayout(page);
    }
    const learning = dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true });
    await learning.click(); await expect(learning).toHaveAttribute("aria-checked", "false");
    await expect(dialog.locator(".rhh-habit-paused")).toContainText("배우기 끔 · 습관은 보관");
    await dialog.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
    await expect(traits.locator(".rhh-trait-favorite strong")).toHaveText("사과");
    await expect(traits.locator(".rhh-trait-state")).toHaveText(["알아가요", "고르게 지내요", "둘러봐요", "적응 중"]);
    await expect(traits.locator(".rhh-trait-description")).toHaveText(["조금씩 가까워지는 중", "놀고 쉬며 균형을 잡아요", "주변을 천천히 살펴요", "편한 리듬을 찾아가는 중"]);
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

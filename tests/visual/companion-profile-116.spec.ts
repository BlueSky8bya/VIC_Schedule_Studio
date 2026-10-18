import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";

const output = process.env.COMPANION116_UI_OUTPUT ?? ".scratch-pw/companion-116/ui/native";
const chunkDirectory = resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "static/chunks");
const settingsChunk = readdirSync(chunkDirectory).find(name => name.endsWith(".js") && readFileSync(join(chunkDirectory, name), "utf8").includes("rhh-companion-nav"));
if (!settingsChunk) throw new Error("missing compiled shared companion settings chunk");
const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
const previewReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
test.use({ isMobile: false, hasTouch: false, serviceWorkers: "block" });

async function openProfile(page: Page, entry: "book" | "settings") {
  await page.bringToFront();
  await settlePanelLayout(page);
  if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) {
    await page.getByRole("button", { name: "패널 접기", exact: true }).click();
    await settlePanelLayout(page);
  }
  if (entry === "book") {
    const book = page.getByRole("button", { name: "빅타민 수첩 열기", exact: true });
    if (!await book.isVisible()) {
      const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
      if (await launcher.isVisible()) await launcher.click();
      else await page.locator('.vc-home [data-act="companion-home-fold"]').click();
    }
    await expect(book).toBeVisible();
    await book.click();
  } else {
    const settings = page.getByRole("button", { name: "설정", exact: true });
    if (!await settings.isVisible()) {
      await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
      await settlePanelLayout(page);
    }
    await settings.click();
    await page.getByRole("dialog", { name: "설정", exact: true }).getByRole("tab", { name: "빅타민", exact: true }).click();
  }
  const dialog = page.getByRole("dialog", { name: entry === "book" ? "빅타민 수첩" : "설정", exact: true });
  await expect(dialog).toBeVisible();
  const profile = dialog.locator(".rhh-companion-profile");
  await expect(profile.locator(".rhh-companion-facts dd").first()).toHaveText("복숭아");
  await settlePanelLayout(page);
  return { dialog, profile, nav: profile.getByRole("tablist", { name: "빅타민 프로필", exact: true }) };
}

type Scenario = { surface: "viewer" | "studio" | "preview"; entry: "book" | "settings"; narrow: boolean; theme: "light" | "dark"; height: number; role: "owner" | "developer" };
const scenarios: Scenario[] = [];
for (const surface of ["viewer", "studio"] as const) for (const entry of ["book", "settings"] as const) for (const narrow of [false, true]) for (const theme of ["light", "dark"] as const) scenarios.push({ surface, entry, narrow, theme, height: 1100, role: "owner" });
scenarios.push({ surface: "viewer", entry: "book", narrow: true, theme: "light", height: 780, role: "owner" }, { surface: "preview", entry: "settings", narrow: false, theme: "dark", height: 780, role: "developer" });

for (const { surface, entry, narrow, theme, height, role } of scenarios) {
  test(`116 ${surface} ${entry} ${narrow ? "narrow" : "wide"} ${theme}${height === 780 ? " low780" : ""}: environment loading preserves document, dialog and keyboard controls`, async ({ page }, testInfo) => {
    testInfo.setTimeout(45_000);
    await page.setViewportSize({ width: narrow ? 1050 : 1440, height });
    const name = `${surface}-${entry}-${narrow ? "narrow" : "wide"}-${theme}${height === 780 ? "-low780" : ""}`;
    mkdirSync(output, { recursive: true });
    const errors: string[] = [], blocked: string[] = [], documents: string[] = [], fixtureReads: string[] = [];
    let navigationEvents = 0, chunkRequested = false;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    page.on("pageerror", error => errors.push(error.message));
    page.on("framenavigated", frame => { if (frame === page.mainFrame()) navigationEvents++; });
    await page.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documents.push(url.pathname);
      if (surface === "preview" && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previewReads.has(request.headers()["next-action"])) {
        fixtureReads.push("getPublicPreviewAction");
        return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
      }
      if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) || url.pathname.startsWith("/api/") || url.origin !== new URL(testInfo.project.use.baseURL as string).origin) {
        blocked.push(`${request.method()} ${url.pathname}`);
        return route.fulfill({ status: 503, body: "fixture blocks mutations, live state and external calls" });
      }
      if (basename(url.pathname) === settingsChunk) { chunkRequested = true; await gate; }
      return route.continue();
    });
    await page.addInitScript(({ memory, preferences, epoch, epochKey, theme }) => {
      for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.dark": theme === "dark" ? "on" : "off" })) localStorage.setItem(key, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, jump: false, sleep: false, feeding: false, ambientPrank: false, panelPrank: false, cardPrank: false, heartPrank: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, hunger: 0, affection: .2, energy: 1, life: { ...memory.life, favoriteFood: "peach", foodScores: { ...memory.life.foodScores, peach: .95 }, social: 1 } }));
    }, { memory: DEFAULT_COMPANION_MEMORY, preferences: DEFAULT_COMPANION_PREFERENCES, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, theme });
    await page.goto(surface === "viewer" ? "/visual-fixture/poster" : `/visual-fixture/studio?role=${role}&y=2025&m=11`);
    if (surface === "preview") {
      await page.getByRole("button", { name: "미리보기", exact: true }).click();
      await page.getByRole("menuitem", { name: "시청자 화면", exact: true }).click();
      await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible();
    }
    const { dialog, profile, nav } = await openProfile(page, entry);
    const profileHandle = await profile.elementHandle(), dialogHandle = await dialog.elementHandle(), navHandle = await nav.elementHandle();
    const geometry = async () => ({ document: await page.evaluate(() => ({ scrollX, scrollY, height: document.documentElement.scrollHeight, main: document.querySelector("main")?.getBoundingClientRect().toJSON() })), dialog: await dialogHandle!.evaluate(node => node.getBoundingClientRect().toJSON()) });
    const initial = { url: page.url(), documents: documents.length, navigationEvents, performance: await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, navigation: performance.getEntriesByType("navigation").length })), geometry: await geometry() };
    const badge = await profile.locator(".rhh-companion-interest").evaluate(node => ({ label: node.getAttribute("aria-label"), art: node.querySelector<HTMLElement>(".vc-collection-art")?.style.cssText ?? null, svg: node.querySelectorAll("svg").length }));
    const corners = await nav.evaluate(node => {
      const rect = node.getBoundingClientRect();
      return { overflow: getComputedStyle(node.parentElement!).overflow, radius: getComputedStyle(node.parentElement!).borderTopLeftRadius, navRadius: getComputedStyle(node).borderTopLeftRadius, hits: [rect.left + 5, rect.right - 5].map(x => { const hit = document.elementFromPoint(x, rect.top + 5); return { x, y: rect.top + 5, inside: !!hit && node.contains(hit), target: hit?.className }; }) };
    });
    await dialog.screenshot({ path: `${output}/${name}-together.png` });
    const environment = nav.getByRole("tab", { name: "환경설정", exact: true });
    // Native pointer path on first use, while its actual compiled chunk is held.
    await environment.click();
    await expect.poll(() => chunkRequested).toBe(true);
    await expect.poll(async () => await profile.getByRole("status").isVisible() || !await profile.isVisible()).toBe(true);
    const loading = await profile.getByRole("status").isVisible();
    await page.screenshot({ path: `${output}/${name}-loading.png` });
    const during = { profile: await profileHandle!.evaluate(node => node.isConnected), dialog: await dialogHandle!.evaluate(node => node.isConnected), nav: await navHandle!.evaluate(node => node.isConnected), profileVisible: await profile.isVisible(), dialogVisible: await dialog.isVisible(), navVisible: await nav.isVisible(), focusedPage: await page.evaluate(() => document.activeElement?.getAttribute("data-profile-page")), routeLoading: await page.getByText("일정표 불러오는 중…", { exact: true }).isVisible(), loading, documents: documents.length, navigationEvents, geometry: await geometry() };
    release();
    await expect(profile.getByRole("tablist", { name: "빅타민 설정", exact: true })).toBeVisible();
    await expect(environment).toHaveAttribute("aria-selected", "true");
    await settlePanelLayout(page);
    await dialog.screenshot({ path: `${output}/${name}-environment.png` });
    // A real native keyboard selection survives profile-page round trips.
    const subnav = profile.getByRole("tablist", { name: "빅타민 설정", exact: true });
    await subnav.getByRole("tab", { name: "기본", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(subnav.getByRole("tab", { name: "움직임", exact: true })).toBeFocused();
    await environment.focus(); await page.keyboard.press("Home");
    await expect(nav.getByRole("tab", { name: "함께 지내기", exact: true })).toBeFocused();
    await page.keyboard.press("End");
    await expect(environment).toBeFocused();
    await expect(subnav.getByRole("tab", { name: "움직임", exact: true })).toHaveAttribute("aria-selected", "true");
    const finitePages = [];
    for (const label of ["도감", "옷장"] as const) {
      await nav.getByRole("tab", { name: label, exact: true }).click();
      const book = profile.locator(".rhh-collection-book:visible");
      await expect(book).toBeVisible(); await settlePanelLayout(page);
      const bounds = await book.evaluate(node => {
        const root = node.closest('[role="dialog"]')!, header = root.querySelector(".modal-head")?.getBoundingClientRect(), sheet = node.getBoundingClientRect(), rect = root.getBoundingClientRect();
        const ancestors = [];
        for (let current: HTMLElement | null = node as HTMLElement; current && current !== root; current = current.parentElement) ancestors.push({ className: current.className, overflow: current.scrollHeight - current.clientHeight, scroll: current.scrollTop });
        return { sheet: sheet.toJSON(), dialog: rect.toJSON(), headerBottom: header?.bottom ?? rect.top, tiles: node.querySelectorAll(".rhh-collection-tile").length, documentScroll: scrollY, ancestors };
      });
      expect(bounds.sheet.top).toBeGreaterThanOrEqual(bounds.headerBottom); expect(bounds.sheet.bottom).toBeLessThanOrEqual(bounds.dialog.bottom);
      expect(bounds.sheet.left).toBeGreaterThanOrEqual(bounds.dialog.left); expect(bounds.sheet.right).toBeLessThanOrEqual(bounds.dialog.right);
      expect(bounds.tiles).toBeLessThanOrEqual(24); expect(bounds.documentScroll).toBe(initial.geometry.document.scrollY);
      expect(bounds.ancestors.filter(node => node.overflow > 2)).toEqual([]);
      await page.mouse.move(bounds.sheet.x + bounds.sheet.width / 2, bounds.sheet.y + bounds.sheet.height / 2);
      await page.mouse.wheel(0, 600); await settlePanelLayout(page);
      const afterWheel = await book.evaluate(node => {
        const scroll = [];
        for (let current: HTMLElement | null = node as HTMLElement; current && !current.classList.contains("modal-card"); current = current.parentElement) scroll.push(current.scrollTop);
        return { top: node.getBoundingClientRect().top, scrollY, scroll };
      });
      expect(afterWheel).toEqual({ top: bounds.sheet.top, scrollY: initial.geometry.document.scrollY, scroll: bounds.ancestors.map(node => node.scroll) });
      finitePages.push({ label, ...bounds, afterWheel });
      await dialog.screenshot({ path: `${output}/${name}-${label === "도감" ? "discovery" : "wardrobe"}.png` });
    }
    const after = { url: page.url(), documents: documents.length, navigationEvents, performance: await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, navigation: performance.getEntriesByType("navigation").length })), profile: await profileHandle!.evaluate(node => node === document.querySelector(".rhh-companion-profile")), dialog: await dialogHandle!.evaluate(node => node.isConnected), nav: await navHandle!.evaluate(node => node.isConnected) };
    writeFileSync(`${output}/${name}.json`, JSON.stringify({ settingsChunk, initial, badge, corners, during, after, finitePages, errors, blocked, fixtureReads }, null, 2));
    expect(after.url).toBe(initial.url); expect(after.performance).toEqual(initial.performance); expect(after.documents).toBe(initial.documents); expect(after.navigationEvents).toBe(initial.navigationEvents);
    expect([during.profile, during.dialog, during.nav, after.profile, after.dialog, after.nav]).toEqual(Array(6).fill(true));
    expect(errors).toEqual([]);
    expect.soft(loading, "first environment visit provides a local loading state").toBe(true);
    expect.soft([during.profileVisible, during.dialogVisible, during.navVisible], "lazy environment loading preserves the visible surrounding application").toEqual([true, true, true]);
    expect.soft(during.focusedPage).toBe("settings"); expect.soft(during.geometry).toEqual(initial.geometry);
    expect.soft(corners.hits.every(hit => hit.inside), "both visible tablist corners retain their actual hit region").toBe(true);
    expect.soft(badge.label).toBe("좋아하는 간식 · 복숭아");
    expect.soft(badge.svg).toBe(0); expect.soft(badge.art).toContain("/companion/collection/");
  });
}

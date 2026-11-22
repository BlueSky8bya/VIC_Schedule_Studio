import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { PREMIERE_STAGE_KEY, SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { describeTarget } from "@/lib/activity/labels";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";
import { openCompanionHome } from "./helpers/companion-home";
import { abortUnknownFixtureOrigin, fulfillDeclaredUiFontSheet, fulfillReadOnlyFont } from "./helpers/readonly-font";

type Surface = "viewer" | "studio";
// Since 5f2cc186 / ddf00884 (2026-11-13) the activity client only turns on where the root layout mounts
// RouteBeacon, and it mounts it for a really signed-in developer or owner alone (app/layout.tsx ActorTail).
// Viewers are never recorded; one case below proves that silence. The fixture has no signed-in actor, so the
// developer-studio capture cases could never observe an event: the owner removed them on 2026-11-20 rather
// than add a fixture seam. The pipeline itself is covered by the unit tests (tests/unit/activity-*.test.ts);
// the developer timeline/usage views below still render from synthetic reads.
type Event = { kind: string; target?: string | null; meta?: unknown; durMs?: number | null };
type Capture = { events: Event[]; mutations: string[]; unexpected: string[]; errors: string[]; reads: string[]; documentUrl?: string; buildId: string; requestOrigins: string[]; servedChunks: Array<{ url: string; sha256: string; localSha256: string }> };
const capture = new WeakMap<Page, Capture>();
const proofTasks = new WeakMap<Page, Promise<void>[]>();
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const new109Targets = ["companion-radio-list#open", "companion-radio-list#close", "companion-radio-volume", "companion-collection-page#prev", "companion-collection-page#next", "companion-collection-inspect#food", "companion-profile-page#discover", "companion-throw"];
const new110Targets = ["companion-book-open", "companion-book-close", "companion-collection-inspect#behavior", "companion-collection-inspect#moment"];
// Settings stage 4: the rare-prank switch is a retired label (old records only); its live successor is the one 장난치기 switch.
const new111Targets = ["companion-profile-page#settings", "companion-playful#on", "companion-playful#off", "companion-radio-source", "companion-radio-license"];
const new115Targets = ["companion-personality#tidy", "companion-personality#mischievous"];
const new137Targets = ["companion-personality#curious", "companion-personality#balanced"];
const new135Targets = ["companion-home-tv#on", "companion-home-tv#off", "companion-home-tv#next", "companion-home-light#on", "companion-home-light#off"];
const new141Targets = ["companion-home-curtain#open", "companion-home-curtain#shade", "companion-home-curtain#closed"];
const new142Targets = ["companion-personality-open"];
const drawingDiscardTargets = ["bp-discard-keep", "bp-discard-confirm"];
const acceptedSearchTargets = ["search-submit"];
const adoptedPrecisionTargets = ["detail-return-to-anchor", "editor-return-to-anchor", "cpop-hue"];
const sampleTargets = ["companion-pet", "companion-bonk", "companion-food-spawn", "companion-drag", "companion-shake", "companion-heart-clear", "companion-speed#lively", "companion-card-restore", "tag-filter-fold#close", "season-panel-fold#open", "premiere-resume", "premiere-other-month", "premiere-exit#calendar", "premiere-read", "premiere-cheer", "premiere-rehearsal", ...new109Targets, ...new110Targets, ...new111Targets, ...new115Targets, ...new135Targets, ...new141Targets, ...new142Targets];
const retired110Target = "companion-radio-mood#lively";
const memoryFilterTargets = ["companion-memory-filter#all", "companion-memory-filter#expression", "companion-memory-filter#pose", "companion-memory-filter#life"];
const readFixtureTargets = [...sampleTargets, ...new137Targets, ...memoryFilterTargets, ...drawingDiscardTargets, ...acceptedSearchTargets, ...adoptedPrecisionTargets, "companion-learning-reset", retired110Target];
const at = Date.parse("2026-06-10T03:00:00Z");

const auditPrefix = process.env.VIC_ACTIVITY_AUDIT_PREFIX ?? ".scratch-pw/companion-activity";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));

// A loopback alias and test-only WebDriver getter let the real client queue
// run. EVERY mutation is fulfilled locally before navigation: no event,
// presence, visit or server action can reach the application/production DB.
// The loopback alias follows whichever visual config runs this file (its baseURL port), unless the env pins one.
let activityBase = process.env.VIC_ACTIVITY_BASE_URL ?? "http://127.0.0.2:3100";
// eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture callback, not a React hook
test.use({ baseURL: async ({ baseURL }, use) => { if (!process.env.VIC_ACTIVITY_BASE_URL && baseURL) activityBase = baseURL.replace("//127.0.0.1", "//127.0.0.2"); await use(activityBase); }, viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  mkdirSync(".scratch-pw", { recursive: true });
  const buildDir = process.env.VISUAL_TEST_BUILD_DIR ?? ".next";
  const result: Capture = { events: [], mutations: [], unexpected: [], errors: [], reads: [], buildId: readFileSync(resolve(buildDir, "BUILD_ID"), "utf8").trim(), requestOrigins: [], servedChunks: [] }; capture.set(page, result);
  const pendingProof: Promise<void>[] = []; proofTasks.set(page, pendingProof);
  const manifest = JSON.parse(readFileSync(resolve(buildDir, "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const names = new Map(Object.entries(manifest).map(([id, value]) => [id, value.exportedName]));
  page.on("pageerror", error => result.errors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url());
    if (response.status() !== 200 || !/^\/_next\/static\/chunks\/app\/visual-fixture\/(poster|studio)\/page-[\w-]+\.js$/.test(url.pathname)) return;
    const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
    pendingProof.push((async () => {
      try {
        const bytes = await response.body(), local = readFileSync(resolve(buildDir, "static", url.pathname.slice("/_next/static/".length)));
        result.servedChunks.push({ url: response.url(), sha256: sha(bytes), localSha256: sha(local) });
      } catch (error) { result.errors.push(`fixture chunk proof: ${String(error)}`); }
    })());
  });
  await page.route("**/*", async route => {
    const request = route.request(), requestUrl = new URL(request.url()), pathname = requestUrl.pathname;
    if (!result.requestOrigins.includes(requestUrl.origin)) result.requestOrigins.push(requestUrl.origin);
    const origin = new URL(activityBase).origin;
    if (request.resourceType() === "font" && requestUrl.origin !== origin && requestUrl.origin !== origin.replace("127.0.0.2", "127.0.0.1")) return fulfillReadOnlyFont(route, fonts, result.unexpected);
    // The settings font list attaches declared jsDelivr stylesheets since 2026-11-16; answer them locally, empty.
    if (await fulfillDeclaredUiFontSheet(route)) return;
    if (await abortUnknownFixtureOrigin(route, new Set([origin, origin.replace("127.0.0.2", "127.0.0.1")]), result.unexpected)) return;
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      if (pathname === "/api/soop-live") return route.fulfill({ json: { live: false } });
      // Preserve the browser alias for the client guard, but also work with
      // the normal visual runner whose server binds only127.0.0.1.
      const url = new URL(request.url());
      if (url.hostname === "127.0.0.2") { url.hostname = "127.0.0.1"; return route.continue({ url: url.href }); }
      return route.continue();
    }
    result.mutations.push(`${request.method()} ${pathname}`);
    if (pathname === "/api/activity") {
      const body = request.postDataJSON() as { events?: Event[] };
      result.events.push(...body.events ?? []);
      return route.fulfill({ json: { ok: true, saved: body.events?.length ?? 0 } });
    }
    if (["/api/visit", "/api/presence", "/api/visit-session", "/api/visit-ping"].includes(pathname)) return route.fulfill({ json: { ok: true, skipped: true } });
    const name = names.get(request.headers()["next-action"]), response = mockedRead(name);
    if (response !== undefined) {
      result.reads.push(name!);
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(response)}\n` });
    }
    // Unknown writes stay blocked and fail the assertion; never fall through.
    result.unexpected.push(`${request.method()} ${pathname} ${name ?? ""}`);
    return route.fulfill({ status: 500, body: "blocked fixture mutation" });
  });
});
test.afterEach(async ({ page }, info) => {
  const result = capture.get(page)!;
  await Promise.all(proofTasks.get(page) ?? []);
  result.documentUrl = page.url();
  expect(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim()).toBe(result.buildId);
  expect(result.servedChunks.length).toBeGreaterThan(0);
  expect(result.servedChunks.every(chunk => chunk.sha256 === chunk.localSha256)).toBe(true);
  if (info.title.startsWith("110 ")) {
    const expectedOrigin = new URL(activityBase).origin;
    expect(new URL(page.url()).origin).toBe(expectedOrigin);
    expect(result.requestOrigins.every(origin => origin === expectedOrigin || origin === expectedOrigin.replace("127.0.0.2", "127.0.0.1"))).toBe(true);
  }
  writeFileSync(`${auditPrefix}-${info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 110)}.json`, JSON.stringify(result, null, 2));
  expect(result.unexpected).toEqual([]); expect(result.errors).toEqual([]);
});

function mockedRead(name?: string): unknown {
  if (name === "getPublicPreviewAction") return samplePublicScheduleData;
  // The developer header's report inbox asks for its badge number on mount (2026-11-13). A read; nothing unseen here.
  if (name === "getUnseenReportCountAction") return 0;
  if (name === "getActivityDayAction") return { ok: true, total: readFixtureTargets.length, visits: [{ key: "synthetic-companion-visit", account: "계정 #1", role: "developer", device: "desktop", startMs: at, endMs: at + readFixtureTargets.length * 5000, items: readFixtureTargets.map((target, index) => ({ t: at + index * 5000, kind: "ui.click", label: "누름", source: "client", target, targetLabel: null, meta: null, durMs: null })) }] };
  if (name === "getActivityUsageAction") return { ok: true, days: 30, since: "2026-05-12", until: "2026-06-10", rows: readFixtureTargets.map((target, index) => ({ kind: "ui.click", label: "누름", target, roles: index ? { viewer: 1, anon: 1 } : { developer: 1 }, total: index ? 2 : 1, auto: false })) };
}

async function setup(page: Page, surface: Surface, overrides: Partial<CompanionPreferences> = {}) {
  await page.addInitScript(({ epoch, key, premiere, preferences, care }) => {
    Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => false });
    for (const [name, value] of Object.entries({ [key]: epoch, [premiere]: "off", "vic.gfxPref": "max", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left", "vic.qa.companionStoredMotion": "1" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, premiere: PREMIERE_STAGE_KEY,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: true, feeding: true, heartPrank: false, ambientPrank: false, panelPrank: false, ...overrides }, care: { ...DEFAULT_COMPANION_CARE, hunger: .01, energy: 1 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=developer");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible();
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
}

test("viewer screen: real companion use and leaving the page send no activity or visit record", async ({ page }) => {
  await setup(page, "viewer"); await page.mouse.move(4, 4);
  await actor(page).focus(); await actor(page).press("Enter");
  await expect(pet(page)).toHaveAttribute("data-state", "petted");
  const home = await openCompanionHome(page, "keyboard");
  await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(page.locator(".vc-food")).toHaveCount(1);
  await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await waitForOverlayEntrance(dialog);
  await dialog.getByRole("tab", { name: "도감", exact: true }).click();
  await expect(dialog.locator(".rhh-food-grid")).toBeVisible();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toHaveCount(0);
  await page.locator(".public-event.is-clickable:visible").first().click();
  await expect(page.locator(".agenda-detail-sheet:visible")).toBeVisible();
  // The same leave signals that flush a developer's buffer at once (lib/activity/client.ts).
  await page.evaluate(() => { window.dispatchEvent(new window.Event("blur")); window.dispatchEvent(new window.Event("pagehide")); });
  await page.waitForTimeout(400);
  expect(capture.get(page)!.events).toEqual([]);
  expect(capture.get(page)!.mutations.filter(entry => /\/api\/(?:activity|visit|presence|visit-session|visit-ping)$/.test(entry))).toEqual([]);
});

test("developer timeline and low-use list render companion features from synthetic reads", async ({ page }) => {
  await setup(page, "studio");
  await page.locator('[data-act="calendar-cell"][aria-label^="2026-06-10 "]').dblclick({ position: { x: 14, y: 20 } });
  const open = page.locator('[data-act="open-day-visit"]'); await expect(open).toBeVisible(); await open.click();
  await expect(page.getByRole("button", { name: /행동 타임라인/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /적게 쓰인 기능/ })).toBeVisible();
  const usage = page.locator(".vcard").filter({ has: page.locator('[data-act="usage-open"]') });
  const showAll = usage.locator('[data-act="usage-show-all"]'); if (await showAll.isVisible()) await showAll.click();
  for (const target of [...sampleTargets, ...drawingDiscardTargets]) await expect(usage.locator(".usage-list > li").filter({ hasText: describeTarget("ui.click", target).name })).toBeVisible();
  await page.locator('[data-act="activity-expand-all"]').click();
  const timeline = page.locator(".vcard").filter({ has: page.locator('[data-act="activity-open"]') });
  await expect(timeline.locator(".act-gist-open")).toContainText("빅타민");
  await expect(timeline.locator(".act-gist-open")).not.toContainText("둘러보기만");
  await timeline.locator(".act-lines > summary").click();
  for (const target of [...sampleTargets, ...drawingDiscardTargets]) await expect(timeline.getByText(describeTarget("ui.click", target).name, { exact: true })).toBeVisible();
  await expect(timeline.getByText("빅타민 보라 하트 지우기", { exact: true })).toBeVisible();
  expect(capture.get(page)!.reads).toEqual(expect.arrayContaining(["getActivityDayAction", "getActivityUsageAction"]));
  await usage.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${auditPrefix}-timeline-and-usage.png` });
});

test("109 developer timeline and least-used list show the new fixed controls from synthetic reads", async ({ page }) => {
  await setup(page, "studio");
  await page.locator('[data-act="calendar-cell"][aria-label^="2026-06-10 "]').dblclick({ position: { x: 14, y: 20 } });
  await page.locator('[data-act="open-day-visit"]').click();
  const usage = page.locator(".vcard").filter({ has: page.locator('[data-act="usage-open"]') });
  const timeline = page.locator(".vcard").filter({ has: page.locator('[data-act="activity-open"]') });
  await expect(usage.getByRole("button", { name: /적게 쓰인 기능/ })).toBeVisible();
  await expect(timeline.getByRole("button", { name: /행동 타임라인/ })).toBeVisible();
  await usage.locator('[data-act="usage-show-all"]').click();
  await page.locator('[data-act="activity-expand-all"]').click();
  await timeline.locator(".act-lines > summary").click();
  for (const target of [...new109Targets, ...acceptedSearchTargets]) {
    const name = describeTarget("ui.click", target).name;
    await expect(usage.locator(".usage-list > li").filter({ hasText: name })).toBeVisible();
    await expect(timeline.getByText(name, { exact: true })).toBeVisible();
  }
  await expect(usage.locator(".usage-list")).not.toContainText("companion-");
  await expect(timeline.locator(".act-gist-open")).toContainText("빅타민");
  await expect(timeline.locator(".act-gist-open")).not.toContainText("둘러보기만");
  expect(capture.get(page)!.reads).toEqual(expect.arrayContaining(["getActivityDayAction", "getActivityUsageAction"]));
  await page.screenshot({ path: `${auditPrefix}-109-timeline-and-usage.png` });
});

test("110 developer views show book and unified memory uses while old radio mood stays historical", async ({ page }) => {
  await setup(page, "studio");
  await page.locator('[data-act="calendar-cell"][aria-label^="2026-06-10 "]').dblclick({ position: { x: 14, y: 20 } });
  await page.locator('[data-act="open-day-visit"]').click();
  const usage = page.locator(".vcard").filter({ has: page.locator('[data-act="usage-open"]') });
  const timeline = page.locator(".vcard").filter({ has: page.locator('[data-act="activity-open"]') });
  await expect(usage.getByRole("button", { name: /적게 쓰인 기능/ })).toBeVisible();
  await expect(timeline.getByRole("button", { name: /행동 타임라인/ })).toBeVisible();
  await usage.locator('[data-act="usage-show-all"]').click();
  await page.locator('[data-act="activity-expand-all"]').click();
  await timeline.locator(".act-lines > summary").click();
  for (const target of [...new110Targets, ...new115Targets, ...new135Targets, ...new137Targets, ...new141Targets, ...new142Targets, ...memoryFilterTargets, ...adoptedPrecisionTargets, "companion-learning-reset"]) {
    const name = describeTarget("ui.click", target).name;
    const usageRow = usage.locator('.usage-list:not([data-retired]) > li').filter({ hasText: name }), timelineRow = timeline.getByText(name, { exact: true });
    await usageRow.scrollIntoViewIfNeeded(); await expect(usageRow).toBeInViewport();
    await timelineRow.scrollIntoViewIfNeeded(); await expect(timelineRow).toBeInViewport();
  }
  const retired = describeTarget("ui.click", retired110Target);
  expect(retired.retired).toBe(true);
  await expect(usage.locator('.usage-list:not([data-retired])')).not.toContainText(retired.name);
  await usage.locator('[data-act="usage-retired-open"]').click();
  await expect(usage.locator('.usage-list[data-retired="1"]')).toContainText(retired.name);
  await expect(timeline.getByText(retired.name, { exact: true })).toBeVisible();
  await expect(usage.locator('.usage-list:not([data-retired])')).not.toContainText("companion-");
  expect(capture.get(page)!.reads).toEqual(expect.arrayContaining(["getActivityDayAction", "getActivityUsageAction"]));
  const bookCloseName = describeTarget("ui.click", "companion-book-close").name;
  await usage.locator('.usage-list:not([data-retired]) > li').filter({ hasText: bookCloseName }).scrollIntoViewIfNeeded();
  await timeline.getByText(bookCloseName, { exact: true }).scrollIntoViewIfNeeded();
  await usage.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${auditPrefix}-110-timeline-and-usage.png` });
});

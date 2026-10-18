import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_RADIO_TRACKS } from "@/lib/ui/viewer-companion/radio-catalog";
import { COMPANION_BEHAVIOR_IDS, COMPANION_COLLECTION_KEY } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_SITUATION_IDS } from "@/lib/ui/viewer-companion/moments";
import { PREMIERE_STAGE_KEY, SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { describeTarget } from "@/lib/activity/labels";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Event = { kind: string; target?: string | null; meta?: unknown; durMs?: number | null };
type Capture = { events: Event[]; mutations: string[]; unexpected: string[]; errors: string[]; reads: string[]; documentUrl?: string; buildId: string; requestOrigins: string[]; servedChunks: Array<{ url: string; sha256: string; localSha256: string }>; projectile?: { phase: string; vx: number; vy: number; state: string } };
const capture = new WeakMap<Page, Capture>();
const proofTasks = new WeakMap<Page, Promise<void>[]>();
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const targets = (page: Page) => capture.get(page)!.events.filter(event => event.kind === "ui.click").map(event => event.target);
const count = (page: Page, target: string) => targets(page).filter(value => value === target).length;
const new109Targets = ["companion-radio-list#open", "companion-radio-list#close", "companion-radio-volume", "companion-collection-page#prev", "companion-collection-page#next", "companion-collection-inspect#food", "companion-profile-page#discover", "companion-throw"];
const new110Targets = ["companion-book-open", "companion-book-close", "companion-collection-inspect#behavior", "companion-collection-inspect#moment"];
const new111Targets = ["companion-profile-page#settings", "companion-rare-prank#on", "companion-rare-prank#off", "companion-radio-source", "companion-radio-license"];
const new115Targets = ["companion-personality#tidy", "companion-personality#mischievous"];
const sampleTargets = ["companion-pet", "companion-bonk", "companion-food-spawn", "companion-drag", "companion-shake", "companion-heart-clear", "companion-speed#lively", "companion-card-restore", "tag-filter-fold#close", "season-panel-fold#open", "premiere-resume", "premiere-other-month", "premiere-exit#calendar", "premiere-read", "premiere-cheer", "premiere-rehearsal", ...new109Targets, ...new110Targets, ...new111Targets, ...new115Targets];
const retired110Target = "companion-radio-mood#lively";
const readFixtureTargets = [...sampleTargets, retired110Target];
const at = Date.parse("2026-06-10T03:00:00Z");
const auditPrefix = process.env.VIC_ACTIVITY_AUDIT_PREFIX ?? ".scratch-pw/companion-activity";

// A loopback alias and test-only WebDriver getter let the real client queue
// run. EVERY mutation is fulfilled locally before navigation: no event,
// presence, visit or server action can reach the application/production DB.
test.use({ baseURL: process.env.VIC_ACTIVITY_BASE_URL ?? "http://127.0.0.2:3100", viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
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
  await page.route("**/*", route => {
    const request = route.request(), requestUrl = new URL(request.url()), pathname = requestUrl.pathname;
    if (!result.requestOrigins.includes(requestUrl.origin)) result.requestOrigins.push(requestUrl.origin);
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
    const expectedOrigin = new URL(process.env.VIC_ACTIVITY_BASE_URL ?? "http://127.0.0.2:3100").origin;
    expect(new URL(page.url()).origin).toBe(expectedOrigin);
    expect(result.requestOrigins.every(origin => origin === expectedOrigin || origin === expectedOrigin.replace("127.0.0.2", "127.0.0.1"))).toBe(true);
  }
  writeFileSync(`${auditPrefix}-${info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 110)}.json`, JSON.stringify(result, null, 2));
  expect(result.unexpected).toEqual([]); expect(result.errors).toEqual([]);
});

function mockedRead(name?: string): unknown {
  if (name === "getPublicPreviewAction") return samplePublicScheduleData;
  if (name === "getActivityDayAction") return { ok: true, total: readFixtureTargets.length, visits: [{ key: "synthetic-companion-visit", account: "계정 #1", role: "developer", device: "desktop", startMs: at, endMs: at + readFixtureTargets.length * 5000, items: readFixtureTargets.map((target, index) => ({ t: at + index * 5000, kind: "ui.click", label: "누름", source: "client", target, targetLabel: null, meta: null, durMs: null })) }] };
  if (name === "getActivityUsageAction") return { ok: true, days: 30, since: "2026-05-12", until: "2026-06-10", rows: readFixtureTargets.map((target, index) => ({ kind: "ui.click", label: "누름", target, roles: index ? { viewer: 1, anon: 1 } : { developer: 1 }, total: index ? 2 : 1, auto: false })) };
  if (name === "getDayVisitDetailAction") {
    const summary = { visitors: 0, sessions: 0, glances: 0, avgSeconds: 0, totalSeconds: 0, peakConcurrent: 0 };
    const graph = { visits: { roles: {}, devices: {}, total: 0 }, occupancy: Array.from({ length: 24 }, () => ({ roles: {}, devices: {}, avg: 0, peak: 0 })), hasOccupancy: false };
    return { ok: true, data: { dateKey: "2026-06-10", viewer: graph, operator: graph, all: graph, ownerSessions: [], ownerVisits: [], ownerSeconds: 0, summaryViewer: summary, summaryOperator: summary, summaryAll: summary, operators: 0, newVisitors: 0, returningVisitors: 0, sessions: [], nowMark: null } };
  }
}

async function setup(page: Page, surface: Surface, autonomous = false, premiereSeconds?: number, overrides: Partial<CompanionPreferences> = {}) {
  await page.addInitScript(({ epoch, key, premiere, stageMode, preferences, care }) => {
    Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => false });
    for (const [name, value] of Object.entries({ [key]: epoch, [premiere]: stageMode, "vic.gfxPref": "max", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    // Fix the RNG stream to reproduce rare hiding. Native placement, the real
    // planner/state and the detail bridge remain intact.
    if (preferences.ambientPrank) { let draw = 0; Math.random = () => (++draw % 3 ? 0 : .999999); }
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, premiere: PREMIERE_STAGE_KEY, stageMode: premiereSeconds ? "on" : "off",
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: autonomous, jump: autonomous, sleep: true, feeding: true, heartPrank: false, ambientPrank: false, panelPrank: false, ...overrides }, care: { ...DEFAULT_COMPANION_CARE, hunger: .01, energy: 1, curiosity: overrides.ambientPrank ? .9 : DEFAULT_COMPANION_CARE.curiosity } });
  await page.goto(surface === "viewer" ? `/visual-fixture/poster?avatar=1${premiereSeconds ? `&premiere=${premiereSeconds}` : ""}` : "/visual-fixture/studio?role=developer");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  if (!premiereSeconds) await expect(actor(page)).toBeVisible();
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
}
async function flush(page: Page, expected: { target: string; n?: number }[] = [{ target: new URL(page.url()).pathname }]) {
  const complete = () => expected.every(item => capture.get(page)!.events.filter(event => event.target === item.target).length >= (item.n ?? 1));
  // If idle/size batching already delivered the expected action, there may
  // be no pending buffer. Otherwise arm the response listener before blur.
  const response = complete() ? undefined : page.waitForResponse(result => new URL(result.url()).pathname === "/api/activity");
  await page.evaluate(() => window.dispatchEvent(new window.Event("blur")));
  if (response) await response;
  await expect.poll(complete).toBe(true);
  // The intercepted fetch resolves asynchronously even though blur flushes
  // synchronously. A short settled window also detects duplicate click logs.
  await page.waitForTimeout(140);
}

/** Real native card placement plus the existing clock-controlled hide grace.
 * Only RNG and elapsed browser time are controlled. No action callback, bridge
 * event or companion DOM/state mutation is injected. */
async function hideInRealCard(page: Page, surface: Surface) {
  await page.clock.install();
  await setup(page, surface, true, undefined, { roam: true, jump: false, sleep: false, feeding: false, cardPrank: false, heartPrank: false, ambientPrank: true, panelPrank: false, learnFromYou: false });
  await page.mouse.move(4, 4);
  await page.waitForTimeout(200);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const selector = surface === "studio" ? '.studio-event-pill[data-companion-event="ordinary"][data-eventid]' : '.public-event[data-eventid]:not(.teaser)';
  const target = await page.locator(selector).evaluateAll((nodes, selector) => {
    const cards = nodes.map((node, index) => ({ node, index, r: node.getBoundingClientRect() }));
    const controls = [...document.querySelectorAll("button,a[href],input,select,textarea,[role=button],.vc-home")]
      .filter(node => !node.matches(`${selector},.public-day,.agenda-day,.studio-day`) && !node.closest(".vc-companion"))
      .map(node => node.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
    for (const card of cards) {
      const r = card.r;
      if (r.width < 92 || r.height <= 0 || r.top < 240 || r.top > innerHeight - 140 || card.node.closest(".dimmed,[hidden],[inert]")) continue;
      for (const fraction of [.5, .75, .25]) {
        const x = r.left + r.width * fraction, y = r.top - 24;
        const body = { left: x - 38, right: x + 38, top: r.top - 76, bottom: r.top - 3 };
        if (x < 50 || x > innerWidth - 50 || controls.some(c => c.left < body.right && c.right > body.left && c.top < body.bottom && c.bottom > body.top)) continue;
        const first = cards.filter(c => c.r.width > 0 && c.r.height > 0 && x >= c.r.left && x <= c.r.right && c.r.top > y).sort((a, b) => a.r.top - b.r.top)[0];
        if (first?.node === card.node) return { index: card.index, x, y, id: (card.node as HTMLElement).dataset.eventid! };
      }
    }
    return null;
  }, selector);
  expect(target, "a real public card top with full-body and native-control clearance").not.toBeNull();
  await actor(page).focus(); await actor(page).press("p");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(target!.x, target!.y); await page.mouse.move(4, 4);
  await page.clock.runFor(1200);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top/);
  await page.clock.fastForward(45_000);
  for (let step = 0; step < 30 && await pet(page).getAttribute("data-hide-phase") !== "hidden"; step++) await page.clock.runFor(1000);
  await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden");
  await expect(pet(page)).toHaveAttribute("data-hide-event", target!.id);
  await expect(pet(page)).toBeHidden();
  await page.clock.resume();
  await flush(page, [{ target: "companion-drag" }]);
  expect(count(page, "companion-find")).toBe(0); expect(count(page, "companion-extract")).toBe(0);
  return { card: page.locator(selector).nth(target!.index), id: target!.id };
}

for (const surface of ["viewer", "studio"] as const) {
  test(`110 ${surface}: book controls and unified memories record pointer and keyboard uses without private IDs`, async ({ page }) => {
    test.setTimeout(60_000);
    // Native UI only: no fake clock, RNG, action/state hook or discovery seed.
    // All mutations still end in this file's intercepted local queue.
    await setup(page, surface);
    const home = await openCompanionHome(page);
    const book = home.getByRole("button", { name: "빅타민 수첩 열기", exact: true });
    await book.click();
    const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
    await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
    await expect(dialog.locator(".rhh-companion-book-pages")).toBeVisible();
    await expect(dialog.locator(".rhh-nav")).toHaveCount(0);
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await book.focus(); await book.press("Enter");
    await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
    const panel = dialog.locator(".rhh-companion-book-pages");
    await panel.getByRole("tab", { name: "도감", exact: true }).click();
    const categories = panel.getByRole("group", { name: "도감 종류", exact: true });
    await expect(categories.getByRole("button")).toHaveCount(2);
    await categories.getByRole("button", { name: /^추억 도감 / }).click();
    await expect(categories.getByRole("button", { name: /재롱|특별한 순간/ })).toHaveCount(0);
    const memories = panel.locator(".rhh-behavior-grid button");
    await expect.poll(() => memories.count()).toBeGreaterThan(0);
    expect(await memories.count()).toBeLessThanOrEqual(24);
    const lastBehavior = panel.locator(`[data-collection-index="${COMPANION_BEHAVIOR_IDS.length - 1}"]`), firstMoment = panel.locator(`[data-collection-index="${COMPANION_BEHAVIOR_IDS.length}"]`);
    for (let pageIndex = 0; pageIndex < 12 && !await lastBehavior.count(); pageIndex++) await panel.getByRole("button", { name: "다음 추억", exact: true }).click();
    await lastBehavior.click();
    await lastBehavior.press("ArrowRight"); await expect(firstMoment).toBeFocused();
    await firstMoment.press("ArrowLeft"); await expect(lastBehavior).toBeFocused();
    await lastBehavior.press("End"); await expect(memories.last()).toBeFocused();
    await memories.last().press("Home"); await expect(memories.first()).toBeFocused();
    await panel.getByRole("tab", { name: "환경설정", exact: true }).click();
    await panel.getByRole("tab", { name: "소리", exact: true }).click();
    await expect(panel.locator('[data-act="companion-radio-mood"]')).toHaveCount(0);
    const close = dialog.getByRole("button", { name: "닫기", exact: true });
    await close.focus(); await close.press("Enter"); await expect(dialog).toHaveCount(0);
    await flush(page, [{ target: "companion-book-open", n: 2 }, { target: "companion-book-close", n: 2 }, { target: "companion-collection-inspect#moment", n: 2 }]);
    for (const target of ["companion-book-open", "companion-book-close"]) expect(count(page, target), target).toBe(2);
    expect(count(page, "companion-collection-inspect#behavior")).toBe(3);
    expect(count(page, "companion-collection-inspect#moment")).toBe(2);
    expect(targets(page).some(target => target?.startsWith("companion-radio-mood"))).toBe(false);
    const companionEvents = capture.get(page)!.events.filter(event => event.kind === "ui.click" && (event.target?.startsWith("companion-") || event.target?.startsWith("settings-companion-tab")));
    expect(companionEvents.every(event => event.meta === null && event.durMs === null)).toBe(true);
    const options = companionEvents.map(event => event.target?.split("#")[1]);
    for (const id of [...COMPANION_FOOD_KINDS, ...COMPANION_BEHAVIOR_IDS, ...COMPANION_SITUATION_IDS, ...COMPANION_RADIO_TRACKS.map(track => track.id)]) expect(options).not.toContain(id);
    expect(targets(page).filter(target => target?.startsWith("auto:.vc-") || target?.startsWith("auto:.rhh-"))).toEqual([]);
    await page.screenshot({ path: `${auditPrefix}-110-${surface}-book-activity.png` });
  });

  test(`${surface} finding and extracting a truly hidden companion report one completed use each`, async ({ page }) => {
    test.setTimeout(90_000);
    const target = await hideInRealCard(page, surface);
    const beforeMove = count(page, "companion-drag");
    if (surface === "studio") await target.card.locator(".pill-main strong").dblclick();
    else await target.card.locator(".event-main").click();
    const sheet = page.locator(surface === "studio" ? ".event-editor-panel.is-edit" : ".agenda-detail-sheet");
    await expect(sheet).toBeVisible(); await waitForOverlayEntrance(sheet);
    await expect(sheet).toHaveAttribute("data-companion-detail-event", target.id);
    await expect(pet(page)).toHaveAttribute("data-detail-guest", "");
    await expect(actor(page)).toBeVisible();
    const start = await actor(page).boundingBox(), panel = await sheet.boundingBox();
    expect(start).not.toBeNull(); expect(panel).not.toBeNull();
    const grip = { x: start!.x + start!.width / 2, y: start!.y + start!.height * .45 };
    const destination = { x: panel!.x > 150 ? panel!.x - 70 : panel!.x + panel!.width + 70, y: grip.y };
    expect(destination.x).toBeGreaterThan(50); expect(destination.x).toBeLessThan(1870);
    await page.mouse.move(grip.x, grip.y); await page.mouse.down();
    await page.mouse.move(destination.x, destination.y, { steps: 18 });
    await expect(pet(page)).toHaveAttribute("data-overlay-drag", "");
    await page.mouse.up(); await page.mouse.move(4, 4);
    await expect(sheet).toBeVisible(); await expect(actor(page)).toBeVisible();
    await expect(pet(page)).toHaveAttribute("data-hide-perch", "outside");
    await flush(page, [{ target: "companion-find" }, { target: "companion-extract" }]);
    expect(count(page, "companion-find")).toBe(1); expect(count(page, "companion-extract")).toBe(1);
    expect(count(page, "companion-drag")).toBe(beforeMove);
    expect(targets(page).filter(target => target?.startsWith("auto:.vc-"))).toEqual([]);
    await page.screenshot({ path: `${auditPrefix}-${surface}-find-extract.png` });
  });

  test(`${surface} hover and keyboard petting report completed affection once`, async ({ page }) => {
    await setup(page, surface); await page.mouse.move(4, 4);
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    const point = await pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.bottom - r.height * .42 }; });
    await page.mouse.move(point.x - 18, point.y); await expect(pet(page)).toHaveAttribute("data-petting", /^(ready|touch|hover)$/);
    for (const x of [point.x + 18, point.x - 18]) await page.mouse.move(x, point.y, { steps: 6 });
    await expect(pet(page)).toHaveAttribute("data-state", "petted");
    await page.mouse.move(4, 4); await flush(page, [{ target: "companion-pet" }]);
    expect(count(page, "companion-pet")).toBe(1);
    await page.waitForTimeout(950); await actor(page).focus(); await actor(page).press("Enter");
    await flush(page, [{ target: "companion-pet", n: 2 }]);
    expect(count(page, "companion-pet")).toBe(2);
    expect(count(page, "companion-bonk")).toBe(0);
    await page.screenshot({ path: `${auditPrefix}-${surface}-petting.png` });
  });

  test(`${surface} Escape completes moved pet and snack once but does not count an unmoved cancel`, async ({ page }) => {
    await setup(page, surface); await page.mouse.move(4, 4);
    await actor(page).focus(); await actor(page).press(" "); await actor(page).press("Escape");
    await actor(page).press("p"); await actor(page).press("Escape");
    await flush(page); const cancelled = count(page, "companion-drag");
    await actor(page).press(" "); await actor(page).press("ArrowRight"); await actor(page).press("ArrowUp");
    await actor(page).press("Escape"); await expect(pet(page)).not.toHaveAttribute("data-state", "held");
    const home = await openCompanionHome(page, "keyboard"); await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    const snack = page.locator(".vc-food"); await expect(snack).toHaveCount(1);
    await snack.focus(); await snack.press("Enter"); await snack.press("Escape");
    await snack.press("Enter"); await snack.press("ArrowLeft"); await snack.press("ArrowUp"); await snack.press("Escape");
    await snack.press("Escape"); await flush(page, [{ target: "companion-food-spawn" }]);
    expect(cancelled).toBe(0); expect(count(page, "companion-drag")).toBe(1); expect(count(page, "companion-food-move")).toBe(1);
  });

  test(`${surface} manual placement consumes the destination click before automatic usage tracking`, async ({ page }) => {
    await setup(page, surface); await page.mouse.move(4, 4);
    await expect(page.locator('.studio-workspace.editor-open,.agenda-detail-sheet')).toHaveCount(0);
    const card = page.locator(surface === "studio" ? '[data-companion-event="ordinary"][data-eventid]' : '.public-event[data-eventid]').first();
    const destination = await card.boundingBox(); expect(destination).not.toBeNull();
    await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
    await page.mouse.click(destination!.x + destination!.width / 2, destination!.y + destination!.height / 2);
    await expect(pet(page)).not.toHaveAttribute("data-placing");
    await expect(page.locator('.studio-workspace.editor-open,.agenda-detail-sheet')).toHaveCount(0);
    await flush(page, [{ target: "companion-drag" }]);
    expect(count(page, "companion-drag")).toBe(1);
    expect(targets(page)).toEqual(["companion-drag"]);
  });

  test(`${surface} shared panel disclosures and keyboard settings tabs keep named uses`, async ({ page }) => {
    await setup(page, surface);
    for (const name of ["태그 필터", "계절 배경", "빅타민 집"]) {
      const control = page.getByRole("button", { name, exact: true });
      await control.click(); await expect(control).toHaveAttribute("aria-expanded", "false");
      await control.click(); await expect(control).toHaveAttribute("aria-expanded", "true");
    }
    await page.getByRole("button", { name: "설정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await waitForOverlayEntrance(dialog);
    const selected = dialog.locator('.rhh-nav [role="tab"][aria-selected="true"]');
    await selected.focus(); await selected.press("ArrowDown");
    const next = await selected.getAttribute("data-tab"); expect(next).toBeTruthy(); expect(next).not.toBe("companion");
    await flush(page);
    for (const id of ["tag-filter-fold", "season-panel-fold", "companion-home-fold"]) for (const option of ["open", "close"]) expect(count(page, `${id}#${option}`)).toBe(1);
    expect(count(page, `settings-tab#${next}`)).toBe(1);
  });

  test(`${surface} direct companion gestures and food actions are batched once`, async ({ page }) => {
    await setup(page, surface);
    await page.waitForTimeout(800); await flush(page);
    expect(targets(page).filter(target => target?.startsWith("companion-"))).toEqual([]);
    const home = await openCompanionHome(page, "keyboard");
    await home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).focus();
    await home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).press("Enter");
    // This contract records the accepted recall request, not an instant
    // arrival across a potentially disconnected fixture route. Physical sofa
    // travel/occlusion belongs to the world suite; direct input can interrupt.
    await expect(pet(page)).toHaveAttribute("data-home-journey", "");
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    await actor(page).click({ delay: 70 }); await page.mouse.move(4, 4);
    await expect(pet(page)).toHaveAttribute("data-play", "bonk-tears");
    const box = await actor(page).boundingBox(); expect(box).not.toBeNull();
    const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height * .45 };
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + 120, Math.max(140, start.y - 100), { steps: 12 });
    await expect(pet(page)).toHaveAttribute("data-state", "held");
    // Put down deliberately, rather than exercise109's separately audited
    // velocity throw. The actual stationary release spends the drag once.
    await page.waitForTimeout(200);
    await page.mouse.up(); await page.mouse.move(4, 4);
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
    const food = page.locator(".vc-food"); await expect(food).toHaveCount(1);
    const snack = await food.boundingBox(); expect(snack).not.toBeNull();
    await page.mouse.move(snack!.x + snack!.width / 2, snack!.y + snack!.height / 2); await page.mouse.down();
    await page.mouse.move(950, 600, { steps: 15 }); await page.mouse.up();
    await food.focus(); await food.press("Delete"); await expect(food).toHaveCount(0);
    await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(food).toHaveCount(1);
    await home.getByRole("button", { name: "음식 버리기", exact: true }).click(); await expect(food).toHaveCount(0);
    await home.getByRole("button", { name: "음식 버리기", exact: true }).click();
    await flush(page, [{ target: "companion-food-clear" }]);
    for (const target of ["companion-home-call", "companion-bonk", "companion-drag", "companion-food-move", "companion-food-discard", "companion-food-clear"]) expect(count(page, target), target).toBe(1);
    expect(count(page, "companion-food-spawn")).toBe(2);
    expect(targets(page).filter(target => target?.startsWith("auto:.vc-"))).toEqual([]);
    expect(capture.get(page)!.events.filter(event => event.target?.startsWith("companion-")).every(event => !event.meta)).toBe(true);
  });

  test(`${surface} companion settings retain fixed selected options without duplicate clicks`, async ({ page }) => {
    await setup(page, surface);
    await page.getByRole("button", { name: "설정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "설정", exact: true }); await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
    await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
    const panel = dialog.locator("#rhh-tab-companion-panel");
    await panel.getByRole("tab", { name: "환경설정", exact: true }).click();
    const master = panel.locator('[data-act="companion-enabled"]');
    await master.click(); await expect(master).not.toBeChecked(); await master.click(); await expect(master).toBeChecked();
    for (const [tab, id] of [["움직임", "companion-roam"], ["장난", "companion-panel-prank"], ["장난", "companion-card-prank"], ["장난", "companion-rare-prank"], ["교감", "companion-petting-enabled"]]) {
      await panel.getByRole("tab", { name: tab, exact: true }).click();
      const toggle = panel.locator(`[data-act="${id}"]`); const checked = await toggle.isChecked();
      await toggle.click(); await expect(toggle).toBeChecked({ checked: !checked }); await toggle.click(); await expect(toggle).toBeChecked({ checked });
    }
    await panel.getByRole("tab", { name: "기본", exact: true }).click();
    await panel.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true }).getByRole("radio", { name: "고양이", exact: true }).click();
    await panel.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).getByRole("radio", { name: "잠꾸러기", exact: true }).click();
    for (const name of ["깔끔이", "사고뭉치"]) await panel.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).getByRole("radio", { name, exact: true }).click();
    const learning = panel.locator('[data-act="companion-learning-enabled"]');
    const learningBefore = await learning.isChecked();
    await learning.click(); await expect(learning).toBeChecked({ checked: !learningBefore });
    await learning.click(); await expect(learning).toBeChecked({ checked: learningBefore });
    await panel.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
    await panel.getByRole("tab", { name: "움직임", exact: true }).click();
    await panel.getByRole("radiogroup", { name: "빅타민 걸음", exact: true }).getByRole("radio", { name: "발랄하게", exact: true }).click();
    await flush(page, [{ target: "companion-speed#lively" }]);
    for (const id of ["companion-enabled", "companion-roam", "companion-panel-prank", "companion-card-prank", "companion-rare-prank", "companion-petting-enabled", "companion-learning-enabled"]) for (const option of ["on", "off"]) expect(count(page, `${id}#${option}`), `${id}#${option}`).toBe(1);
    for (const target of ["settings-tab#companion", "companion-animal#cat", "companion-personality#sleepy", ...new115Targets, "companion-speed#lively", "companion-learning-reset"]) expect(count(page, target), target).toBe(1);
    expect(targets(page).filter(target => target?.startsWith("companion-") && !target.includes("#"))).toEqual(["companion-learning-reset"]);
  });

  test(`109 ${surface}: native radio, range, food pages and throw emit fixed uses once`, async ({ page }) => {
    test.setTimeout(60_000);
    // This109 path does not install a clock or alter RNG, media, geometry,
    // planner state or callbacks. All mutations still terminate at the local
    // collector above; this is not a production DB/RLS test.
    await setup(page, surface);
    await page.getByRole("button", { name: "설정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "설정", exact: true });
    await waitForOverlayEntrance(dialog);
    await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
    const panel = dialog.locator("#rhh-tab-companion-panel");
    await panel.getByRole("tab", { name: "환경설정", exact: true }).click();
    await panel.getByRole("tab", { name: "소리", exact: true }).click();
    const radio = panel.locator(".rhh-companion-radio"), details = radio.locator("details"), summary = details.locator("summary");
    await summary.focus(); await summary.press("Enter"); await expect(details).toHaveAttribute("open", "");
    await summary.press("Enter"); await expect(details).not.toHaveAttribute("open");
    const volume = radio.getByRole("slider", { name: "라디오 음량", exact: true });
    const beforeVolume = Number(await volume.inputValue());
    await volume.focus(); await volume.press("ArrowRight"); await volume.press("Tab");
    await expect(volume).toHaveValue(String(beforeVolume + 5));

    for (const action of ["companion-radio-source", "companion-radio-license"]) {
      const popup = page.waitForEvent("popup"); await radio.locator(`[data-act="${action}"]`).click();
      await (await popup).close(); await page.bringToFront();
    }
    await panel.getByRole("tab", { name: "함께 지내기", exact: true }).click();
    const profile = panel.locator(".rhh-companion-profile"), profileTabs = profile.getByRole("tablist", { name: "빅타민 프로필", exact: true });
    await profileTabs.getByRole("tab", { name: "함께 지내기", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(profileTabs.getByRole("tab", { name: "도감", exact: true })).toHaveAttribute("aria-selected", "true");
    const foodGrid = profile.locator(".rhh-food-grid"); await expect.poll(() => foodGrid.locator("button").count()).toBeGreaterThan(0);
    const pageSize = await foodGrid.locator("button").count(); expect(pageSize).toBeLessThanOrEqual(24);
    await profile.getByRole("button", { name: "다음 간식", exact: true }).click();
    await expect(foodGrid.locator("button").first()).toHaveAttribute("data-food-index", String(pageSize));
    await foodGrid.locator("button").first().focus(); await page.keyboard.press("ArrowRight");
    await expect(foodGrid.locator(`[data-food-index="${pageSize + 1}"]`)).toBeFocused();
    await page.keyboard.press("Home"); await expect(foodGrid.locator('[data-food-index="0"]')).toBeFocused();
    await page.keyboard.press("End");
    const lastIndex = COMPANION_FOOD_KINDS.length - 1;
    await expect(foodGrid.locator(`[data-food-index="${lastIndex}"]`)).toBeFocused();
    await expect(foodGrid.locator("button")).toHaveCount(COMPANION_FOOD_KINDS.length % pageSize || pageSize);
    await profile.getByRole("button", { name: "이전 간식", exact: true }).click();
    await flush(page, [{ target: "companion-radio-list#close" }, { target: "companion-radio-volume" }, { target: "companion-collection-page#prev" }]);
    for (const target of ["companion-radio-source", "companion-radio-license", "companion-radio-list#open", "companion-radio-list#close", "companion-radio-volume", "companion-profile-page#discover", "companion-collection-page#next", "companion-collection-page#prev"]) expect(count(page, target), target).toBe(1);
    expect(count(page, "companion-collection-inspect#food")).toBe(3);

    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0);
    await expect(actor(page)).toBeVisible(); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    const beforeDrag = count(page, "companion-drag"), beforeThrow = count(page, "companion-throw");
    const box = await actor(page).boundingBox(); expect(box).not.toBeNull();
    const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height * .45 };
    const direction = start.x > 1600 ? -1 : 1;
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + direction * 90, Math.max(180, start.y - 70), { steps: 8 });
    await expect(pet(page)).toHaveAttribute("data-state", "held");
    await page.mouse.move(start.x + direction * 220, Math.max(120, start.y - 170), { steps: 6 });
    await page.mouse.up();
    await expect(pet(page)).toHaveAttribute("data-throw-phase", /^(launch|rise|apex|fall|landing)$/);
    capture.get(page)!.projectile = await pet(page).evaluate(node => {
      const element = node as HTMLElement;
      return { phase: element.dataset.throwPhase ?? "", vx: Number(element.dataset.throwVx), vy: Number(element.dataset.throwVy), state: element.dataset.state ?? "" };
    });
    await page.mouse.move(4, 4); await flush(page, [{ target: "companion-throw", n: beforeThrow + 1 }]);
    expect(count(page, "companion-throw")).toBe(beforeThrow + 1); expect(count(page, "companion-drag")).toBe(beforeDrag);
    const companionEvents = capture.get(page)!.events.filter(event => event.kind === "ui.click" && (event.target?.startsWith("companion-") || event.target?.startsWith("settings-companion-tab")));
    expect(companionEvents.every(event => event.meta === null && event.durMs === null)).toBe(true);
    const options = companionEvents.map(event => event.target?.split("#")[1]);
    for (const id of [...COMPANION_FOOD_KINDS, ...COMPANION_RADIO_TRACKS.map(track => track.id)]) expect(options).not.toContain(id);
    for (const field of ["favoriteFood", "foodId", "trackId", "life", "habits", "volume"]) expect(companionEvents.every(event => !event.meta || !Object.hasOwn(event.meta, field))).toBe(true);
    expect(targets(page).filter(target => target?.startsWith("auto:.vc-"))).toEqual([]);
    await page.screenshot({ path: `${auditPrefix}-109-${surface}-controls.png` });
  });
}

test("premiere buttons record named actions and count only successful manual cheers", async ({ page }) => {
  await setup(page, "viewer", false, 45);
  const stage = page.getByRole("dialog", { name: "최초공개 무대", exact: true }); await expect(stage).toBeVisible();
  const fan = stage.locator(".pm-fan").first(); await expect(fan).toBeVisible();
  await fan.click(); await fan.click();
  const hope = stage.getByRole("button", { name: "기대돼요", exact: true }); await hope.click();
  await expect(stage.getByRole("button", { name: "함께 기다리는 중", exact: true })).toHaveAttribute("aria-pressed", "true");
  await stage.getByRole("button", { name: "일정표 보기", exact: true }).click(); await expect(stage).toHaveCount(0);
  await page.getByRole("button", { name: "최초공개 다시 보기", exact: true }).click(); await expect(stage).toBeVisible();
  await expect(stage).not.toHaveClass(/pm-phase-return/); await waitForOverlayEntrance(stage);
  await expect.poll(() => stage.locator(".pm-screen").evaluate(node => Number(getComputedStyle(node).opacity))).toBe(1);
  await flush(page, [{ target: "premiere-resume" }]);
  for (const target of ["dt-hope", "premiere-cheer", "premiere-exit#calendar", "premiere-resume"]) expect(count(page, target), target).toBe(1);
  expect(targets(page).filter(target => target === "auto:button" || target?.startsWith("auto:.pm-"))).toEqual([]);
  await page.screenshot({ path: `${auditPrefix}-premiere.png` });
});

test("autonomous companion movement never records human feature use", async ({ page }) => {
  await setup(page, "viewer", true);
  await page.mouse.move(4, 4);
  const origin = await pet(page).boundingBox(); expect(origin).not.toBeNull();
  let autonomous = false;
  await expect.poll(async () => {
    const point = await pet(page).evaluate(node => ({ state: (node as HTMLElement).dataset.state, x: node.getBoundingClientRect().x }));
    autonomous ||= ["walk", "jump", "play"].includes(point.state ?? "");
    return autonomous && Math.abs(point.x - origin!.x) > 12;
  }, { timeout: 10000, intervals: [80] }).toBe(true);
  await flush(page);
  expect(capture.get(page)!.events.some(event => event.kind === "route.enter")).toBe(true);
  expect(targets(page).filter(target => target?.startsWith("companion-"))).toEqual([]);
});

test("developer timeline and low-use list render companion features from synthetic reads", async ({ page }) => {
  await setup(page, "studio");
  await page.locator('[data-act="calendar-cell"][aria-label^="2026-06-10 "]').dblclick({ position: { x: 14, y: 20 } });
  const open = page.locator('[data-act="open-day-visit"]'); await expect(open).toBeVisible(); await open.click();
  await expect(page.getByRole("button", { name: /행동 타임라인/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /적게 쓰인 기능/ })).toBeVisible();
  const usage = page.locator(".vcard").filter({ has: page.locator('[data-act="usage-open"]') });
  const showAll = usage.locator('[data-act="usage-show-all"]'); if (await showAll.isVisible()) await showAll.click();
  for (const target of sampleTargets) await expect(usage.locator(".usage-list > li").filter({ hasText: describeTarget("ui.click", target).name })).toBeVisible();
  await page.locator('[data-act="activity-expand-all"]').click();
  const timeline = page.locator(".vcard").filter({ has: page.locator('[data-act="activity-open"]') });
  await expect(timeline.locator(".act-gist-open")).toContainText("빅타민");
  await expect(timeline.locator(".act-gist-open")).not.toContainText("둘러보기만");
  await timeline.locator(".act-lines > summary").click();
  for (const target of sampleTargets) await expect(timeline.getByText(describeTarget("ui.click", target).name, { exact: true })).toBeVisible();
  await expect(timeline.getByText("빅타민 보라 하트 지우기", { exact: true })).toBeVisible();
  expect(capture.get(page)!.reads).toEqual(expect.arrayContaining(["getDayVisitDetailAction", "getActivityDayAction", "getActivityUsageAction"]));
  await usage.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${auditPrefix}-timeline-and-usage.png` });
});

for (const surface of ["viewer", "studio"] as const) test(`112 ${surface}: a real circular shake records once without learned traits`, async ({ page }) => {
  await setup(page, surface);
  const box = (await actor(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  await page.mouse.move(900, 500, { steps: 8 });
  for (let i = 0; i <= 40; i++) {
    const angle = i / 12 * Math.PI * 2;
    await page.mouse.move(900 + Math.cos(angle) * 105, 500 + Math.sin(angle) * 105); await page.waitForTimeout(32);
  }
  await expect(pet(page)).toHaveAttribute("data-held-dizzy", "");
  await page.waitForTimeout(120); await page.mouse.up();
  await flush(page, [{ target: "companion-shake" }]);
  expect(count(page, "companion-shake")).toBe(1);
  const recorded = capture.get(page)!.events.filter(event => event.target === "companion-shake");
  expect(recorded.every(event => event.meta === null && event.durMs === null)).toBe(true);
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
  for (const target of new109Targets) {
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
  for (const target of [...new110Targets, ...new115Targets]) {
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


for (const surface of ["viewer", "studio"] as const) test(`113 ${surface}: inspecting the current unread tile with Home records once`, async ({ page }) => {
  // Seeded local acquisition receipt; actual confirmation and queue are native.
  // The production acquisition path is verified separately by the meal case.
  await page.addInitScript(({ key, food }) => localStorage.setItem(key, JSON.stringify({ version: 1, foods: [food], behaviors: [], situations: [], gifts: { pending: null, unlocked: [], equipped: null, activeMs: 0, interactionCredit: 0 }, seen: { foods: [], behaviors: [], situations: [], accessories: [] } })), { key: COMPANION_COLLECTION_KEY, food: COMPANION_FOOD_KINDS[0] });
  await setup(page, surface);
  const home = await openCompanionHome(page), book = home.getByRole("button", { name: "빅타민 수첩 열기", exact: true });
  await expect(book).toHaveAttribute("data-unread", "true"); await book.click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await waitForOverlayEntrance(dialog); await dialog.getByRole("tab", { name: "도감", exact: true }).click();
  const tile = dialog.locator('.rhh-food-grid [data-food-index="0"]');
  await expect(tile).toHaveAttribute("data-unread", "true"); await tile.focus(); await tile.press("Home");
  await expect(tile).not.toHaveAttribute("data-unread"); await tile.press("Home");
  await flush(page, [{ target: "companion-collection-inspect#food" }]);
  expect(count(page, "companion-collection-inspect#food")).toBe(1);
  expect(JSON.stringify(capture.get(page)!.events)).not.toContain(COMPANION_FOOD_KINDS[0]);
  await tile.press("Enter"); await flush(page, [{ target: "companion-collection-inspect#food", n: 2 }]);
  expect(count(page, "companion-collection-inspect#food")).toBe(2);
});

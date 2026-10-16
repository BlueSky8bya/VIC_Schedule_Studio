import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { PREMIERE_STAGE_KEY, SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { describeTarget } from "@/lib/activity/labels";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Event = { kind: string; target?: string | null; meta?: unknown; durMs?: number | null };
type Capture = { events: Event[]; mutations: string[]; unexpected: string[]; errors: string[]; reads: string[] };
const capture = new WeakMap<Page, Capture>();
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const targets = (page: Page) => capture.get(page)!.events.filter(event => event.kind === "ui.click").map(event => event.target);
const count = (page: Page, target: string) => targets(page).filter(value => value === target).length;
const sampleTargets = ["companion-pet", "companion-food-spawn", "companion-drag", "companion-heart-clear", "companion-speed#lively"];
const at = Date.parse("2026-06-10T03:00:00Z");

// A loopback alias and test-only WebDriver getter let the real client queue
// run. EVERY mutation is fulfilled locally before navigation: no event,
// presence, visit or server action can reach the application/production DB.
test.use({ baseURL: "http://127.0.0.2:3100", viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  mkdirSync(".scratch-pw", { recursive: true });
  const result: Capture = { events: [], mutations: [], unexpected: [], errors: [], reads: [] }; capture.set(page, result);
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const names = new Map(Object.entries(manifest).map(([id, value]) => [id, value.exportedName]));
  page.on("pageerror", error => result.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
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
  writeFileSync(`.scratch-pw/companion-070-activity-${info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 90)}.json`, JSON.stringify(result, null, 2));
  expect(result.unexpected).toEqual([]); expect(result.errors).toEqual([]);
});

function mockedRead(name?: string): unknown {
  if (name === "getPublicPreviewAction") return samplePublicScheduleData;
  if (name === "getActivityDayAction") return { ok: true, total: sampleTargets.length, visits: [{ key: "synthetic-companion-visit", account: "계정 #1", role: "developer", device: "desktop", startMs: at, endMs: at + 60000, items: sampleTargets.map((target, index) => ({ t: at + index * 5000, kind: "ui.click", label: "누름", source: "client", target, targetLabel: null, meta: null, durMs: null })) }] };
  if (name === "getActivityUsageAction") return { ok: true, days: 30, since: "2026-05-12", until: "2026-06-10", rows: sampleTargets.map((target, index) => ({ kind: "ui.click", label: "누름", target, roles: index ? { viewer: 1, anon: 1 } : { developer: 1 }, total: index ? 2 : 1, auto: false })) };
  if (name === "getDayVisitDetailAction") {
    const summary = { visitors: 0, sessions: 0, glances: 0, avgSeconds: 0, totalSeconds: 0, peakConcurrent: 0 };
    const graph = { visits: { roles: {}, devices: {}, total: 0 }, occupancy: Array.from({ length: 24 }, () => ({ roles: {}, devices: {}, avg: 0, peak: 0 })), hasOccupancy: false };
    return { ok: true, data: { dateKey: "2026-06-10", viewer: graph, operator: graph, all: graph, ownerSessions: [], ownerVisits: [], ownerSeconds: 0, summaryViewer: summary, summaryOperator: summary, summaryAll: summary, operators: 0, newVisitors: 0, returningVisitors: 0, sessions: [], nowMark: null } };
  }
}

async function setup(page: Page, surface: Surface, autonomous = false) {
  await page.addInitScript(({ epoch, key, premiere, preferences, care }) => {
    Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => false });
    for (const [name, value] of Object.entries({ [key]: epoch, [premiere]: "off", "vic.gfxPref": "max", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, premiere: PREMIERE_STAGE_KEY,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: autonomous, jump: autonomous, sleep: true, feeding: true, heartPrank: false, ambientPrank: false, panelPrank: false }, care: { ...DEFAULT_COMPANION_CARE, hunger: .01, energy: 1 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=developer");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible();
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

for (const surface of ["viewer", "studio"] as const) {
  test(`${surface} direct companion gestures and food actions are batched once`, async ({ page }) => {
    await setup(page, surface);
    await page.waitForTimeout(800); await flush(page);
    expect(targets(page).filter(target => target?.startsWith("companion-"))).toEqual([]);
    const home = await openCompanionHome(page, "keyboard");
    await home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).focus();
    await home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }).press("Enter");
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
    await actor(page).click({ delay: 70 }); await page.mouse.move(4, 4);
    await expect(pet(page)).toHaveAttribute("data-play", "bonk-tears");
    const box = await actor(page).boundingBox(); expect(box).not.toBeNull();
    const start = { x: box!.x + box!.width / 2, y: box!.y + box!.height * .45 };
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await page.mouse.move(start.x + 120, Math.max(140, start.y - 100), { steps: 12 });
    await expect(pet(page)).toHaveAttribute("data-state", "held");
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
    const master = panel.locator('[data-act="companion-enabled"]');
    await master.click(); await expect(master).not.toBeChecked(); await master.click(); await expect(master).toBeChecked();
    for (const [tab, id] of [["움직임", "companion-roam"], ["장난", "companion-panel-prank"], ["장난", "companion-card-prank"], ["교감", "companion-petting-enabled"]]) {
      await panel.getByRole("tab", { name: tab, exact: true }).click();
      const toggle = panel.locator(`[data-act="${id}"]`); const checked = await toggle.isChecked();
      await toggle.click(); await expect(toggle).toBeChecked({ checked: !checked }); await toggle.click(); await expect(toggle).toBeChecked({ checked });
    }
    await panel.getByRole("tab", { name: "성격", exact: true }).click();
    await panel.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true }).getByRole("radio", { name: "고양이", exact: true }).click();
    await panel.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).getByRole("radio", { name: "잠꾸러기", exact: true }).click();
    await panel.getByRole("tab", { name: "움직임", exact: true }).click();
    await panel.getByRole("radiogroup", { name: "빅타민 걸음", exact: true }).getByRole("radio", { name: "발랄하게", exact: true }).click();
    await flush(page, [{ target: "companion-speed#lively" }]);
    for (const id of ["companion-enabled", "companion-roam", "companion-panel-prank", "companion-card-prank", "companion-petting-enabled"]) for (const option of ["on", "off"]) expect(count(page, `${id}#${option}`), `${id}#${option}`).toBe(1);
    for (const target of ["settings-tab#companion", "companion-animal#cat", "companion-personality#sleepy", "companion-speed#lively"]) expect(count(page, target), target).toBe(1);
    expect(targets(page).filter(target => target?.startsWith("companion-") && !target.includes("#"))).toEqual([]);
  });
}

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
  for (const target of sampleTargets) await expect(usage.locator(".usage-list > li").filter({ hasText: describeTarget("ui.click", target).name })).toBeVisible();
  await page.locator('[data-act="activity-expand-all"]').click();
  const timeline = page.locator(".vcard").filter({ has: page.locator('[data-act="activity-open"]') });
  await expect(timeline.locator(".act-gist-open")).toContainText("빅타민");
  await expect(timeline.locator(".act-gist-open")).not.toContainText("둘러보기만");
  await timeline.locator(".act-lines > summary").click();
  await expect(timeline.getByText("빅타민 쓰다듬기", { exact: true })).toBeVisible();
  await expect(timeline.getByText("빅타민 보라 하트 지우기", { exact: true })).toBeVisible();
  expect(capture.get(page)!.reads).toEqual(expect.arrayContaining(["getDayVisitDetailAction", "getActivityDayAction", "getActivityUsageAction"]));
  await usage.scrollIntoViewIfNeeded();
  await page.screenshot({ path: ".scratch-pw/companion-070-activity.png" });
});

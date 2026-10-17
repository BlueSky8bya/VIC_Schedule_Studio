import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY, PREMIERE_STAGE_KEY } from "@/lib/ui/motion";
import { describeTarget } from "@/lib/activity/labels";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";
import { openCompanionHome } from "./helpers/companion-home";

type Role = "owner" | "developer";
type Surface = "studio" | "viewer";
type Event = { kind: string; target?: string | null; meta?: unknown; durMs?: number | null };
type Frame = { at: number; stage: string; count: number; hidden: boolean; x: number; y: number; state: string; platform: string; surface: Surface; outside: boolean };
type ProbeWindow = Window & { composedProbe?: { stage: string; frames: Frame[]; raf: number; stopped: boolean }; composedSeed?: number; composedDraw?: number; composedRandom?: boolean };
type Proof = { events: Event[]; unknown: string[]; errors: string[]; reads: string[]; checkpoints: unknown[] };
const proofs = new WeakMap<Page, Proof>();
const prefix = process.env.VIC_COMPOSED_PREFIX ?? ".scratch-pw/companion-composed";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const cardSelector = (surface: Surface) => surface === "studio" ? '[data-companion-event="ordinary"][data-eventid]' : '.public-event[data-eventid]:not(.teaser)';
const targets = (page: Page, name: string) => proofs.get(page)!.events.filter(event => event.kind === "ui.click" && event.target === name);
const at = Date.parse("2026-06-10T03:00:00Z");

test.use({ baseURL: "http://127.0.0.2:3100", viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.beforeEach(async ({ page }) => {
  mkdirSync(".scratch-pw", { recursive: true });
  const proof: Proof = { events: [], unknown: [], errors: [], reads: [], checkpoints: [] }; proofs.set(page, proof);
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const names = new Map(Object.entries(manifest).map(([id, value]) => [id, value.exportedName]));
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (!["127.0.0.1", "127.0.0.2", "localhost"].includes(url.hostname)) return route.abort("blockedbyclient");
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      if (path === "/api/activity") {
        const body = request.postDataJSON() as { events?: Event[] };
        proof.events.push(...(body.events ?? []).map(({ kind, target, meta, durMs }) => ({ kind, target, meta, durMs })));
        return route.fulfill({ json: { ok: true, saved: body.events?.length ?? 0 } });
      }
      if (["/api/visit", "/api/presence", "/api/visit-session", "/api/visit-ping"].includes(path)) return route.fulfill({ json: { ok: true, skipped: true } });
      const name = names.get(request.headers()["next-action"]), value = readResponse(name, proof.events);
      if (value !== undefined) {
        proof.reads.push(name!); return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(value)}\n` });
      }
      proof.unknown.push(`${request.method()} ${path} ${name ?? ""}`);
      return route.fulfill({ status: 500, body: "blocked fixture mutation" });
    }
    if (path === "/api/soop-live") return route.fulfill({ json: { isLive: false } });
    if (path.includes("/teaser-state")) return route.fulfill({ json: { ok: true, schemaVersion: 1, sampledAtDbMs: Date.now(), entries: [] } });
    if (path === "/api/public/clock") { url.hostname = "127.0.0.1"; return route.continue({ url: url.href }); }
    if (path.startsWith("/api/")) return route.fulfill({ status: 503, body: "blocked fixture read" });
    if (url.hostname === "127.0.0.2") url.hostname = "127.0.0.1";
    return route.continue({ url: url.href });
  });
});
test.afterEach(async ({ page }, info) => {
  const frames = await page.evaluate(() => { const p = (window as ProbeWindow).composedProbe; if (!p) return []; p.stopped = true; cancelAnimationFrame(p.raf); return p.frames; }).catch(() => []);
  writeFileSync(`${prefix}-${info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 100)}.json`, JSON.stringify({ ...proofs.get(page), frames }, null, 2));
  expect(proofs.get(page)!.unknown).toEqual([]); expect(proofs.get(page)!.errors).toEqual([]);
});

function readResponse(name: string | undefined, events: Event[]): unknown {
  if (name === "getPublicPreviewAction") return samplePublicScheduleData;
  const used = events.filter(event => event.kind === "ui.click" && event.target);
  if (name === "getActivityDayAction") return { ok: true, total: used.length, visits: [{ key: "synthetic-composed-visit", account: "계정 #1", role: "developer", device: "desktop", startMs: at, endMs: at + 60000, items: used.map((event, index) => ({ t: at + index * 1000, kind: event.kind, label: "누름", source: "client", target: event.target, targetLabel: null, meta: null, durMs: null })) }] };
  if (name === "getActivityUsageAction") {
    const counts = new Map<string, number>(); for (const event of used) counts.set(event.target!, (counts.get(event.target!) ?? 0) + 1);
    return { ok: true, days: 30, since: "2026-05-12", until: "2026-06-10", rows: [...counts].map(([target, total]) => ({ kind: "ui.click", label: "누름", target, roles: { developer: total }, total, auto: false })) };
  }
  if (name === "getDayVisitDetailAction") {
    const summary = { visitors: 0, sessions: 0, glances: 0, avgSeconds: 0, totalSeconds: 0, peakConcurrent: 0 };
    const graph = { visits: { roles: {}, devices: {}, total: 0 }, occupancy: Array.from({ length: 24 }, () => ({ roles: {}, devices: {}, avg: 0, peak: 0 })), hasOccupancy: false };
    return { ok: true, data: { dateKey: "2026-06-10", viewer: graph, operator: graph, all: graph, ownerSessions: [], ownerVisits: [], ownerSeconds: 0, summaryViewer: summary, summaryOperator: summary, summaryAll: summary, operators: 0, newVisitors: 0, returningVisitors: 0, sessions: [], nowMark: null } };
  }
}
async function setup(page: Page, role: Role, autonomous = false, savedHeart = false) {
  await page.addInitScript(({ epoch, key, stage, preferences, care, autonomous, savedHeart }) => {
    Object.defineProperty(Navigator.prototype, "webdriver", { configurable: true, get: () => false });
    for (const [name, value] of Object.entries({ [key]: epoch, [stage]: "off", "vic.ambient": "off", "vic.sound": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    if (savedHeart) localStorage.setItem("vic.viewerCompanion.hearts", JSON.stringify({ version: 1, ids: ["evt-005"] }));
    const scope = window as ProbeWindow, native = Math.random; scope.composedRandom = autonomous; scope.composedSeed = 7151;
    Math.random = () => {
      if (scope.composedDraw !== undefined) return scope.composedDraw;
      if (!scope.composedRandom) return native();
      scope.composedSeed = (Math.imul(scope.composedSeed!, 1664525) + 1013904223) >>> 0; return scope.composedSeed / 4294967296;
    };
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, stage: PREMIERE_STAGE_KEY, autonomous, savedHeart,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: autonomous, jump: autonomous, sleep: !autonomous, feeding: !autonomous, heartPrank: false, cardPrank: autonomous, ambientPrank: false, panelPrank: false, learnFromYou: false, speed: autonomous ? "lively" : "normal" },
    care: { ...DEFAULT_COMPANION_CARE, hunger: .05, energy: 1 } });
  await page.goto(`/visual-fixture/studio?role=${role}`); await page.bringToFront(); await settle(page); await expect(actor(page)).toBeVisible();
}
async function settle(page: Page) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await page.waitForTimeout(180);
}
async function flush(page: Page, target: string, n = 1) {
  const done = () => targets(page, target).length >= n;
  const response = done() ? null : page.waitForResponse(res => new URL(res.url()).pathname === "/api/activity");
  await page.evaluate(() => window.dispatchEvent(new Event("blur"))); if (response) await response;
  await expect.poll(done).toBe(true); await page.waitForTimeout(140);
}
async function beginProbe(page: Page, random = false) {
  await page.evaluate(random => {
    const scope = window as ProbeWindow; if (random) { scope.composedSeed = 7151; scope.composedDraw = undefined; }
    const p = { stage: "begin", frames: [] as Frame[], raf: 0, stopped: false }; scope.composedProbe = p;
    const tick = () => {
      if (p.stopped) return;
      const nodes = document.querySelectorAll<HTMLElement>(".vc-companion"), node = nodes[0], box = node?.getBoundingClientRect();
      if (random) scope.composedDraw = ["walk", "jump"].includes(node?.dataset.state ?? "") ? .01 : undefined;
      p.frames.push({ at: performance.now(), stage: p.stage, count: nodes.length, hidden: !node || node.hidden || getComputedStyle(node).display === "none", x: box?.left ?? 0, y: box?.bottom ?? 0, state: node?.dataset.state ?? "", platform: node?.dataset.platform ?? "", surface: document.querySelector(".viewer-fullscreen") ? "viewer" : "studio", outside: !!box && (box.right < 0 || box.left > innerWidth || box.bottom < 0 || box.top > innerHeight) });
      p.raf = requestAnimationFrame(tick);
    }; p.raf = requestAnimationFrame(tick);
  }, random);
}
async function checkpoint(page: Page, label: string) {
  await expect(pet(page)).toHaveCount(1); await expect(actor(page)).toBeVisible();
  const state = await pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { state: (node as HTMLElement).dataset.state, platform: (node as HTMLElement).dataset.platform, x: r.left + r.width / 2, y: r.bottom, width: r.width, height: r.height, view: [innerWidth, innerHeight] }; });
  expect(state.x).toBeGreaterThan(0); expect(state.x).toBeLessThan(state.view[0]); expect(state.y).toBeGreaterThan(0); expect(state.y - state.height).toBeLessThan(state.view[1]);
  proofs.get(page)!.checkpoints.push({ label, ...state });
  console.log(JSON.stringify({ checkpoint: label, state: state.state, platform: state.platform }));
  await page.evaluate(label => { const p = (window as ProbeWindow).composedProbe; if (p) p.stage = label; }, label);
}
async function preview(page: Page, role: Role) {
  const before = await pet(page).boundingBox(), fromHome = await pet(page).getAttribute("data-platform") === "companion-home";
  if (role === "developer") { await page.locator(".preview-dd-trigger").click(); await page.getByRole("menuitem", { name: "시청자 화면", exact: true }).click(); }
  else await page.getByRole("button", { name: "시청자 화면 보여주기", exact: true }).click();
  await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settle(page); await checkpoint(page, "viewer-enter");
  if (fromHome) {
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
    expect(await page.evaluate(() => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top))).toBeLessThan(2);
  } else await nearbyHandoff(page, before);
}
async function studio(page: Page) {
  const before = await pet(page).boundingBox();
  await page.getByRole("button", { name: "편집실로 가기", exact: true }).click(); await expect(page.locator(".viewer-fullscreen")).toHaveCount(0); await settle(page); await checkpoint(page, "studio-return");
  await nearbyHandoff(page, before);
}
async function nearbyHandoff(page: Page, before: Awaited<ReturnType<ReturnType<Page["locator"]>["boundingBox"]>>) {
  const after = await pet(page).boundingBox(); expect(before).not.toBeNull(); expect(after).not.toBeNull();
  const delta = Math.hypot((after!.x - before!.x) / 1920, (after!.y - before!.y) / 1100);
  proofs.get(page)!.checkpoints.push({ label: "handoff-normalized-distance", delta });
  // The layouts have different card row heights. Transient shell memory must
  // choose a nearby real support, rather than resetting to its spawn point.
  expect(delta).toBeLessThan(.2);
}
async function flow(page: Page) {
  await page.evaluate(() => {
    document.documentElement.style.overflowY = "auto"; document.documentElement.style.scrollBehavior = "auto"; document.body.style.overflowY = "visible";
    if (!document.querySelector("[data-composed-spacer]")) { const el = document.createElement("div"); el.dataset.composedSpacer = ""; el.style.cssText = "height:1000px;pointer-events:none"; el.setAttribute("aria-hidden", "true"); document.body.append(el); }
  });
}
async function dragScroll(page: Page, surface: Surface) {
  await flow(page); await expect(actor(page)).toBeVisible();
  const identity = (await pet(page).elementHandle())!, box = (await actor(page).boundingBox())!, carrier = (await pet(page).boundingBox())!;
  const start = { x: box.x + box.width / 2, y: box.y + box.height * .45 }, offset = carrier.y + carrier.height - start.y;
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(1200, 420, { steps: 12 });
  await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.mouse.wheel(0, 80); await page.waitForTimeout(150);
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  const point = await page.locator(cardSelector(surface)).evaluateAll(nodes => {
    for (const node of nodes) { const r = node.getBoundingClientRect(); if (r.width > 110 && r.top > 250 && r.bottom < innerHeight - 100) return { x: r.left + r.width * .6, y: r.top - 20 }; }
    return { x: innerWidth * .65, y: innerHeight - 100 };
  });
  await page.mouse.move(point.x, point.y - offset, { steps: 14 }); await page.mouse.up(); await page.mouse.move(4, 4);
  await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await settle(page); await checkpoint(page, `${surface}-grab-wheel-drop`);
}
async function month(page: Page) {
  await page.locator('[data-act="month-next"]:visible').click(); await expect(page.locator(".month-title-text").first()).toContainText("7월"); await settle(page); await checkpoint(page, "next-month");
  await page.locator('[data-act="month-prev"]:visible').click(); await expect(page.locator(".month-title-text").first()).toContainText("6월"); await settle(page); await checkpoint(page, "previous-month");
}
async function popover(page: Page, surface: Surface) {
  const card = page.locator(cardSelector(surface)).filter({ has: page.locator(surface === "studio" ? ".pill-main strong" : ".event-main") }).first();
  await card.scrollIntoViewIfNeeded(); await page.waitForTimeout(220);
  if (surface === "studio") await card.locator(".pill-main strong").dblclick(); else await card.locator(".event-main").click();
  const panel = page.locator(surface === "studio" ? ".event-editor-panel.is-edit" : ".agenda-detail-sheet"); await expect(panel).toBeVisible(); await waitForOverlayEntrance(panel);
  await checkpoint(page, `${surface}-popover-open`); await panel.getByRole("button", { name: surface === "studio" ? "편집 카드 닫기" : "닫기", exact: true }).first().click(); await expect(panel).toBeHidden(); await settle(page); await checkpoint(page, `${surface}-popover-close`);
}
async function panels(page: Page) {
  const home = await openCompanionHome(page, "keyboard"), recall = home.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  const food = page.locator(".vc-food"); await expect(food).toHaveCount(1);
  const start = (await food.boundingBox())!, target = await home.evaluate(node => { const floor = node.querySelector(".vc-home-floor")!.getBoundingClientRect(), bed = node.querySelector(".vc-cushion-button")!.getBoundingClientRect(); return { x: bed.left + bed.width / 2, y: floor.bottom - 3 }; });
  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2); await page.mouse.down(); await page.mouse.move(target.x, target.y, { steps: 16 }); await page.mouse.up(); await page.mouse.move(4, 4);
  await expect(food).not.toHaveAttribute("data-falling"); await expect(food).toHaveJSProperty("hidden", false);
  const floorOffset = () => food.evaluate(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform), floor = document.querySelector(".vc-home-floor")!.getBoundingClientRect(); return { x: matrix.m41 - floor.left, y: matrix.m42 - floor.top, height: floor.height }; });
  await expect.poll(async () => { const p = await floorOffset(); return Math.abs(p.y - p.height + COMPANION_HOME_FLOOR_INSET); }).toBeLessThan(2);
  const offset = await floorOffset();
  await recall.focus(); await recall.press("Enter"); await expect(pet(page)).toHaveAttribute("data-platform", "companion-home"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  for (const expanded of [false, true]) for (const name of ["태그 필터", "계절 배경"]) {
    const toggle = page.getByRole("button", { name, exact: true });
    if (await toggle.getAttribute("aria-expanded") !== String(expanded)) await toggle.click();
    await settle(page); await checkpoint(page, `${name}-${expanded}`);
    const error = await page.evaluate(() => Math.abs(document.querySelector(".vc-companion")!.getBoundingClientRect().bottom - document.querySelector(".vc-home-cushion")!.getBoundingClientRect().top));
    expect(error).toBeLessThan(2);
    await expect(food).toBeVisible(); await expect(food).not.toHaveAttribute("data-falling");
    await expect.poll(async () => { const point = await floorOffset(); return Math.hypot(point.x - offset.x, point.y - offset.y); }).toBeLessThan(2);
  }
  await page.screenshot({ path: `${prefix}-floor-snack-${new URL(page.url()).searchParams.get("role") ?? "operator"}-${proofs.get(page)!.checkpoints.length}.png` });
  const clear = home.getByRole("button", { name: "음식 버리기", exact: true }); await clear.focus(); await clear.press("Enter"); await expect(food).toHaveCount(0);
}

for (const role of ["owner", "developer"] as const) test(`${role} repeated reordered grab scroll month popover panels and preview round trips stay coherent`, async ({ page }) => {
  test.setTimeout(120_000); await setup(page, role); await beginProbe(page);
  for (const order of [["drag", "month", "popover", "panels", "preview"], ["panels", "preview", "drag", "month", "popover"]]) {
    for (const step of order) {
      if (step === "drag") await dragScroll(page, "studio");
      if (step === "month") await month(page);
      if (step === "popover") await popover(page, "studio");
      if (step === "panels") await panels(page);
      if (step === "preview") { await preview(page, role); await dragScroll(page, "viewer"); await popover(page, "viewer"); await studio(page); }
    }
  }
  await flush(page, "companion-drag", 4); expect(targets(page, "companion-drag")).toHaveLength(4);
  const frames = await page.evaluate(() => (window as ProbeWindow).composedProbe!.frames);
  // Native scrollIntoView can carry a valid in-flight source offscreen.
  // Ordinary windows finish that journey instead of teleporting it. Preserve
  // those measurements; enforce visibility for direct grabs and stable checks.
  expect(frames.filter(frame => frame.count > 1 || frame.state === "held" && (frame.hidden || frame.outside))).toEqual([]);
  await page.screenshot({ path: `${prefix}-${role}-reordered.png` });
});

test("a real preview purple heart click clears only the saved souvenir and reaches the native activity queue and timeline", async ({ page }) => {
  await setup(page, "developer", false, true); await preview(page, "developer");
  const card = page.locator('.viewer-fullscreen .public-event[data-eventid="evt-005"]'), heart = card.locator(".event-heart");
  await card.hover(); await expect(heart).toBeVisible(); await expect(heart).toHaveAttribute("data-companion-hearted", ""); await expect(heart).toHaveAttribute("aria-pressed", "false");
  const before = await heart.textContent(); await heart.locator("svg").click();
  await expect(heart).not.toHaveAttribute("data-companion-hearted"); await expect(heart).toHaveAttribute("aria-pressed", "false"); expect(await heart.textContent()).toBe(before);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion.hearts")!).ids)).toEqual([]);
  await flush(page, "companion-heart-clear"); expect(targets(page, "companion-heart-clear")).toHaveLength(1); expect(targets(page, "event-heart")).toHaveLength(0);
  await page.screenshot({ path: `${prefix}-real-purple-clear.png` });
  await studio(page);
  await page.locator('[data-act="calendar-cell"][aria-label^="2026-06-10 "]').dblclick({ position: { x: 14, y: 20 } }); await page.locator('[data-act="open-day-visit"]').click();
  const usage = page.locator(".vcard").filter({ has: page.locator('[data-act="usage-open"]') });
  await expect(usage.locator(".usage-list > li").filter({ hasText: describeTarget("ui.click", "companion-heart-clear").name })).toBeVisible();
  await page.locator('[data-act="activity-expand-all"]').click();
  const timeline = page.locator(".vcard").filter({ has: page.locator('[data-act="activity-open"]') }); await timeline.locator(".act-lines > summary").click();
  await expect(timeline.getByText(describeTarget("ui.click", "companion-heart-clear").name, { exact: true })).toBeVisible();
  await page.screenshot({ path: `${prefix}-real-purple-timeline.png` });
});

for (const surface of ["studio", "viewer"] as const) test(`${surface} actual natural card mischief restores through a real click and records one completed use`, async ({ page }) => {
  test.setTimeout(85_000); await setup(page, "developer", true); if (surface === "viewer") await preview(page, "developer");
  const card = page.locator(`${surface === "viewer" ? ".viewer-fullscreen " : ""}${cardSelector(surface)}[data-eventid="evt-005"]`).first();
  await expect(card).toBeVisible();
  const body = (await actor(page).boundingBox())!, carrier = (await pet(page).boundingBox())!, destination = (await card.boundingBox())!;
  const start = { x: body.x + body.width / 2, y: body.y + body.height * .45 }, offset = carrier.y + carrier.height - start.y;
  await page.mouse.move(start.x, start.y); await page.mouse.down(); await page.mouse.move(destination.x + destination.width * .72, destination.y - 25 - offset, { steps: 18 }); await page.mouse.up(); await page.mouse.move(4, 4);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-.*-top/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump"); await beginProbe(page, true);
  const ruffled = page.locator("[data-vc-ruffled]");
  await expect(ruffled).toHaveCount(1, { timeout: 60_000 });
  await page.screenshot({ path: `${prefix}-${surface}-natural-ruffle.png` });
  await ruffled.click(); await expect(ruffled).toHaveCount(0);
  await flush(page, "companion-card-restore"); expect(targets(page, "companion-card-restore")).toHaveLength(1);
  await page.screenshot({ path: `${prefix}-${surface}-native-restored.png` });
});

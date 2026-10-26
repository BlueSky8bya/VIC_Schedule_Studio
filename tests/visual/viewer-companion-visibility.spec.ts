import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { getTodayKst, nowKstHm } from "@/lib/calendar/month";
import { companionSyntheticRead157 } from "./helpers/companion-synthetic-reads-157";

const KEY = "vic.companion.visibility.v1";
const DAY = 86_400_000;
const out = resolve(process.env.COMPANION_VISIBILITY_OUTPUT ?? ".scratch-pw/companion-visibility", `${getTodayKst()}-${nowKstHm().replace(":", "")}-${process.pid}-${Date.now()}`);
type TraceRecord = Record<string, unknown> & { at: number; stage: string; reason: string };
type Envelope = { schemaVersion: number; kind: string; revision: string; records: TraceRecord[] };
type Frame = { at: number; hidden: boolean; visible: boolean; same: boolean; state: string; platform: string; reason: string; hide: string; placing: boolean; x: number; y: number; width: number; height: number };
type BrowserProbe = { frames: Frame[]; stopped: boolean; raf: number; node: HTMLElement; started: number };
type Proof = { writes: string[]; errors: string[]; external: string[]; reads: string[]; deniedGets: string[]; blockedTelemetry: string[]; downloads: number; requestedDownloads: number; facts: Record<string, unknown> };
const proofs = new WeakMap<Page, Proof>();
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const recoveries = (trace: Envelope | null) => trace?.records.filter(r => r.stage === "recovery") ?? [];

test.use({ viewport: { width: 1920, height: 1000 }, hasTouch: false, isMobile: false, serviceWorkers: "block" });
test.beforeEach(async ({ page, baseURL }) => {
  mkdirSync(out, { recursive: true });
  const proof: Proof = { writes: [], errors: [], external: [], reads: [], deniedGets: [], blockedTelemetry: [], downloads: 0, requestedDownloads: 0, facts: {} }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  page.on("download", () => proof.downloads++);
  const origin = new URL(baseURL ?? "http://127.0.0.1:3104").origin;
  expect(["127.0.0.1", "localhost", "[::1]"]).toContain(new URL(origin).hostname);
  const buildDir = resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next"), buildId = readFileSync(resolve(buildDir, "BUILD_ID"), "utf8").trim();
  const manifest = JSON.parse(readFileSync(resolve(buildDir, "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  proof.facts.buildId = buildId;
  const publicRoot = resolve("public");
  const asset = (path: string) => {
    try {
      if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return false;
      const file = resolve(publicRoot, "." + decodeURIComponent(path));
      return file.startsWith(publicRoot + sep) && Boolean(statSync(file, { throwIfNoEntry: false })?.isFile());
    } catch { return false; }
  };
  const rsc = (value: unknown) => `0:${JSON.stringify({ a: "$@1", f: [], b: buildId })}\n1:${JSON.stringify(value)}\n`;
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);
    if (url.origin !== origin) {
      proof.external.push(`${method} ${url.origin}${url.pathname}`);
      if (mutation) proof.writes.push(`${method} external:${url.pathname}`);
      return route.abort();
    }
    if (method === "GET" && !url.search && !url.hash && ["/_vercel/insights/script.js", "/_vercel/speed-insights/script.js"].includes(url.pathname)) {
      proof.blockedTelemetry.push(url.pathname);
      return route.fulfill({ contentType: "application/javascript", body: "/* Telemetry bootstrap replaced with inert local QA content. */" });
    }
    const name = manifest[request.headers()["next-action"]]?.exportedName;
    if (method === "POST" && url.pathname === "/visual-fixture/poster" && name === "getAnonHeartIdsAction") {
      proof.reads.push(name); return route.fulfill({ contentType: "text/x-component", body: rsc([]) });
    }
    if (method === "POST" && url.pathname === "/visual-fixture/studio" && name === "getPublicPreviewAction") {
      proof.reads.push(name); return route.fulfill({ contentType: "text/x-component", body: rsc(samplePublicScheduleData) });
    }
    if (mutation) { proof.writes.push(`${method} ${url.pathname}`); return route.fulfill({ status: 503, body: "Synthetic visibility QA blocks writes" }); }
    const synthetic = companionSyntheticRead157(method, url, Date.now());
    if (synthetic) { proof.reads.push(synthetic.path); return route.fulfill({ status: synthetic.status, json: synthetic.json }); }
    if (url.pathname.startsWith("/api/")) { proof.reads.push(`denied:${url.pathname}`); return route.fulfill({ status: 404, body: "No live reads in visibility QA" }); }
    if (["GET", "HEAD"].includes(method) && (["/visual-fixture/poster", "/visual-fixture/studio"].includes(url.pathname)
      || url.pathname.startsWith("/_next/static/") || asset(url.pathname)
      || url.pathname === "/_next/image" && asset(url.searchParams.get("url") ?? ""))) return route.continue();
    proof.deniedGets.push(`${method} ${url.pathname}`);
    return route.fulfill({ status: 404, body: "Visibility QA permits only exact synthetic fixtures and actual local assets" });
  });
});

test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!;
  const frames = await finishProbe(page).catch(() => []);
  const trace = await readTrace(page).catch(error => ({ storageUnavailable: String(error) }));
  const name = info.titlePath.join("-").replace(/[^a-zA-Z0-9-]+/g, "-");
  writeFileSync(resolve(out, `${name}.json`), JSON.stringify({ status: info.status, syntheticFixturesOnly: true,
    scope: "Native controls plus explicitly identified one-shot source faults; no controller/world/state callback replacement. Clock/RNG control only in the deliberate-hide case.",
    ...proof, frames, trace }, null, 2), { flag: "wx" });
  if (!page.isClosed()) await page.screenshot({ path: resolve(out, `${name}.png`) });
  expect(proof.writes).toEqual([]); expect(proof.errors).toEqual([]); expect(proof.deniedGets).toEqual([]);
  expect(proof.downloads, "diagnostic export must require the explicit human-equivalent click").toBe(proof.requestedDownloads);
});

async function seed(page: Page, options: { hide?: boolean; stored?: string; denyTraceStorage?: boolean } = {}) {
  await page.addInitScript(({ key, epoch, preferences, care, traceKey, options }) => {
    Object.defineProperty(navigator, "webdriver", { configurable: true, get: () => true });
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }),
      "vic.reduceMotion": "off", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: Boolean(options.hide), jump: false,
      sleep: false, feeding: false, petting: false, heartPrank: false, cardPrank: false, panelPrank: false, rarePrank: false, ambientPrank: Boolean(options.hide), learnFromYou: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 2, ...care, hunger: .05, energy: 1, curiosity: .9 }));
    localStorage.removeItem("vic_panel_collapsed"); localStorage.removeItem("vic.panelSections");
    if (options.stored !== undefined) localStorage.setItem(traceKey, options.stored); else localStorage.removeItem(traceKey);
    if (options.hide) { let draws = 0; Math.random = () => (++draws % 3 ? 0 : .999999); }
    if (options.denyTraceStorage) {
      const get = Storage.prototype.getItem, set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
      Storage.prototype.getItem = function (key) { if (key === traceKey) throw new DOMException("Synthetic denied trace read", "SecurityError"); return get.call(this, key); };
      Storage.prototype.setItem = function (key, value) { if (key === traceKey) throw new DOMException("Synthetic denied trace write", "QuotaExceededError"); return set.call(this, key, value); };
      Storage.prototype.removeItem = function (key) { if (key === traceKey) throw new DOMException("Synthetic denied trace removal", "SecurityError"); return remove.call(this, key); };
    }
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, traceKey: KEY, options });
}

async function open(page: Page, surface = "viewer") {
  await page.goto(surface === "studio" ? "/visual-fixture/studio?role=owner&companionTrace=1" : "/visual-fixture/poster?avatar=1&companionTrace=1");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(a => a.playState === "running" && Number.isFinite(Number(a.effect?.getComputedTiming().endTime))).map(a => a.finished)); });
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await startProbe(page);
}

async function startProbe(page: Page) {
  await pet(page).evaluate(node => {
    const probe: BrowserProbe = { frames: [], stopped: false, raf: 0, node: node as HTMLElement, started: performance.now() };
    const tick = () => {
      if (probe.stopped) return;
      const n = probe.node, r = n.getBoundingClientRect();
      if (probe.frames.length < 6000) probe.frames.push({ at: performance.now() - probe.started, hidden: n.hidden,
        visible: !n.hidden && n.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight,
        same: n.isConnected && n === document.querySelector(".vc-companion"), state: n.dataset.state ?? "", platform: n.dataset.platform ?? "", reason: n.dataset.hiddenReason ?? "",
        hide: n.dataset.hidePhase ?? "", placing: n.hasAttribute("data-placing"), x: r.x + r.width / 2, y: r.bottom, width: r.width, height: r.height });
      probe.raf = requestAnimationFrame(tick);
    };
    (window as Window & { companionVisibilityProbe?: BrowserProbe }).companionVisibilityProbe = probe; tick();
  });
}
async function finishProbe(page: Page) {
  return page.evaluate(() => { const p = (window as Window & { companionVisibilityProbe?: BrowserProbe }).companionVisibilityProbe; if (!p) return [];
    p.stopped = true; cancelAnimationFrame(p.raf); return p.frames; });
}
async function frames(page: Page) { return page.evaluate(() => (window as Window & { companionVisibilityProbe?: BrowserProbe }).companionVisibilityProbe?.frames ?? []); }
async function readTrace(page: Page): Promise<Envelope | null> { return page.evaluate(key => { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }, KEY); }

async function exportTrace(page: Page, label: string): Promise<Envelope> {
  const save = page.getByRole("button", { name: "빅타민 진단 저장", exact: true });
  if (!await save.isVisible()) {
    await page.getByRole("button", { name: "설정", exact: true }).first().click();
  }
  await expect(page.locator("[data-companion-visibility-trace]")).toBeVisible(); await expect(save).toBeVisible();
  proofs.get(page)!.requestedDownloads++;
  const downloading = page.waitForEvent("download"); await save.click(); const download = await downloading;
  const file = resolve(out, `export-${label}.json`); await download.saveAs(file);
  const raw = readFileSync(file, "utf8"); proofs.get(page)!.facts[`export-${label}`] = { file, bytes: Buffer.byteLength(raw), suggestedName: download.suggestedFilename() };
  const trace = JSON.parse(raw) as Envelope; expect(Buffer.byteLength(raw)).toBeLessThanOrEqual(24 * 1024); assertProjection(trace); return trace;
}

function assertProjection(trace: Envelope, now = Date.now()) {
  expect(Object.keys(trace).sort()).toEqual(["kind", "records", "revision", "schemaVersion"]);
  expect(trace.schemaVersion).toBe(1); expect(trace.kind).toBe("local-companion-visibility"); expect(trace.revision).toMatch(/^(?:[a-f0-9]{40}|dev)$/);
  expect(trace.records.length).toBeLessThanOrEqual(24);
  for (const record of trace.records) {
    expect(Object.keys(record).every(key => ["at", "revision", "stage", "reason", "support", "action", "side", "context", "x", "y", "width", "height", "size", "hidden", "awaiting", "reduced"].includes(key))).toBe(true);
    expect(record.revision).toMatch(/^(?:[a-f0-9]{40}|dev)$/);
    expect(Number.isFinite(record.at)).toBe(true); expect(record.at).toBeGreaterThanOrEqual(now - 7 * DAY); expect(record.at).toBeLessThanOrEqual(now + 1000);
    expect(["observed", "recovery", "recovered", "unavailable", "cancelled"]).toContain(record.stage);
    expect(["visible", "schedule-hide", "home-hidden", "offscreen", "lost-support", "owned", "pending"]).toContain(record.reason);
    if (record.support !== undefined) expect(["home", "floor", "card", "calendar", "control", "none"]).toContain(record.support);
    if (record.action !== undefined) expect(["idle", "panel", "walk", "jump", "other"]).toContain(record.action);
    if (record.side !== undefined) expect(["left", "right", "none"]).toContain(record.side);
    if (record.context !== undefined) expect(["panel-transition", "scroll", "resize", "none"]).toContain(record.context);
    for (const key of ["x", "y", "width", "height", "size"]) if (record[key] !== undefined) {
      expect(Number.isFinite(record[key])).toBe(true); expect(Math.abs((record[key] as number) % 4)).toBe(0);
    }
    for (const key of ["hidden", "awaiting", "reduced"]) if (record[key] !== undefined) expect(typeof record[key]).toBe("boolean");
  }
}

/** One source mutation is an explicit synthetic fault, not a user reproduction.
 * The real P placement, geometry observer, controller and recovery stay intact. */
async function displaceOccupiedArrow(page: Page) {
  const right = page.locator('[data-companion-panel-side="right"]:visible').first(); await expect(right).toBeVisible();
  const body = (await actor(page).boundingBox())!, carrier = (await pet(page).boundingBox())!, arrow = (await right.boundingBox())!;
  const grip = { x: body.x + body.width / 2, y: body.y + body.height / 2 }, offset = carrier.y + carrier.height - grip.y;
  await page.mouse.move(grip.x, grip.y); await page.mouse.down(); await page.mouse.move(arrow.x + arrow.width / 2, arrow.y - 4 - offset, { steps: 15 });
  await page.waitForTimeout(190); await page.mouse.up(); await page.mouse.move(2, 2);
  await expect(pet(page)).toHaveAttribute("data-platform", "panel-side-right");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  const before = await right.evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, style: (node as HTMLElement).style.cssText }; });
  const started = await page.evaluate(() => {
    const probe = (window as Window & { companionVisibilityProbe?: BrowserProbe }).companionVisibilityProbe;
    if (!probe) throw new Error("Visibility probe must be installed before source fault injection");
    return performance.now() - probe.started;
  });
  await right.evaluate(node => { const source = node as HTMLElement; source.style.transition = "none"; source.style.transform = `translateX(${innerWidth * 2}px)`; });
  proofs.get(page)!.facts.sourceFaultSetup = { before, started, immediatelyAfter: await right.evaluate(node => ({
    x: node.getBoundingClientRect().x, style: (node as HTMLElement).style.cssText, transform: getComputedStyle(node).transform, transition: getComputedStyle(node).transition,
  })) };
  // Suppress only this source's80ms CSS transition for a one-shot fault.
  // Re-prove its real displacement; the actor/controller remains untouched.
  await expect.poll(async () => (await right.boundingBox())?.x ?? -1, { timeout: 1200, intervals: [16, 32, 64],
    message: "PRECONDITION: the actual occupied source must physically leave the viewport" }).toBeGreaterThan(page.viewportSize()!.width);
  const injected = await right.boundingBox();
  expect(injected!.x, "PRECONDITION: the actual occupied source must physically leave the viewport").toBeGreaterThan(page.viewportSize()!.width);
  return { before, injected, started, injection: "single actual occupied-arrow translateX; no world/geometry callback patch" };
}

async function assertRecovered(page: Page, since: number) {
  await expect.poll(async () => (await readTrace(page))?.records.filter(r => r.at >= since && r.stage === "recovered").length ?? 0,
    { timeout: 6500, message: "The new sustained-fault watchdog must complete; immediate ordinary gravity alone cannot pass" }).toBe(1);
  const trace = (await readTrace(page))!; assertProjection(trace);
  const episode = trace.records.filter(r => r.at >= since);
  expect(episode.some(r => r.stage === "observed" && ["offscreen", "lost-support"].includes(r.reason))).toBe(true);
  const recovery = episode.filter(r => r.stage === "recovery"); expect(recovery).toHaveLength(1);
  const observed = episode.find(r => r.stage === "observed" && r.reason === recovery[0].reason)!;
  expect(recovery[0].at - observed.at, "the sustained-fault gate must not be skipped").toBeGreaterThanOrEqual(1150);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  const actual = await pet(page).evaluate(node => { const r = node.getBoundingClientRect(); return { hidden: (node as HTMLElement).hidden, x: r.x, y: r.y, right: r.right, bottom: r.bottom, count: document.querySelectorAll(".vc-companion").length, width: innerWidth, height: innerHeight }; });
  expect(actual.count).toBe(1); expect(actual.hidden).toBe(false); expect(actual.x).toBeGreaterThanOrEqual(0); expect(actual.y).toBeGreaterThanOrEqual(0);
  expect(actual.right).toBeLessThanOrEqual(actual.width); expect(actual.bottom).toBeLessThanOrEqual(actual.height);
  return { trace, episode, actual };
}

for (const surface of ["viewer", "studio"]) test(`${surface} sustained offscreen source loss records one fresh measured recovery`, async ({ page }) => {
  test.setTimeout(25_000); await seed(page); await open(page, surface); const since = Date.now();
  const fault = await displaceOccupiedArrow(page); proofs.get(page)!.facts.fault = fault;
  const outcome = await assertRecovered(page, since); proofs.get(page)!.facts.outcome = outcome;
  const live = await frames(page); const recoveryFrames = live.filter(f => f.at >= fault.started);
  expect(recoveryFrames.some(f => f.hidden && ["bounds", "support", "vertical"].includes(f.reason)), "actual missing frames must be observed, not only a forged diagnostic label").toBe(true);
  expect(recoveryFrames.some(f => f.state === "jump" && !f.hidden), "recovery must contain finite airborne paint, not an endpoint-only teleport").toBe(true);
  expect(live.every(f => f.same)).toBe(true); proofs.get(page)!.facts.recoveryFrames = recoveryFrames;
  const count = recoveries(outcome.trace).length; await page.waitForTimeout(1600);
  expect(recoveries(await readTrace(page))).toHaveLength(count);
});

async function placeOnCard(page: Page, controlledClock = false) {
  const target = await page.locator(".public-event[data-eventid],.agenda-item[data-eventid],.agenda-event[data-eventid]").evaluateAll(nodes => {
    for (const node of nodes) {
      if (node.closest(".teaser,.dimmed,[hidden],[inert]")) continue;
      const r = node.getBoundingClientRect(); if (r.width < 100 || r.top < 180 || r.top > innerHeight - 150) continue;
      for (const part of [.8, .5, .2]) {
        const x = r.left + r.width * part, y = r.top - 3;
        if (x < 52 || x > innerWidth - 52) continue;
        const obstruction = [...document.querySelectorAll("button,a,input,select,textarea,[role='button']")].some(control => {
          if (control === node || control.closest(".vc-companion,.vc-home") || control.matches(".public-event,.agenda-event,.agenda-item,.public-day")) return false;
          const q = control.getBoundingClientRect(); return q.width > 0 && q.left < x + 38 && q.right > x - 38 && q.top < y + 3 && q.bottom > y - 74;
        });
        if (!obstruction) return { id: (node as HTMLElement).dataset.eventid!, x, y };
      }
    }
    return null;
  });
  expect(target, "PRECONDITION: native P placement needs a genuine clear schedule-card top").not.toBeNull();
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(target!.x, target!.y - 10); await page.mouse.move(2, 2);
  if (controlledClock) await page.clock.runFor(1200);
  await expect(pet(page)).toHaveAttribute("data-platform", /^card-\d+-top(?:-\d+)?$/); return target!;
}

test("ordinary lost-card gravity keeps its existing same-column recovery", async ({ page }) => {
  await seed(page); await open(page); const target = await placeOnCard(page), before = await frames(page), began = Date.now();
  const originalSupport = await pet(page).getAttribute("data-platform");
  const card = page.locator(`.public-event[data-eventid="${target.id}"]`); await card.evaluate(node => (node as HTMLElement).style.visibility = "hidden");
  await expect(pet(page)).not.toHaveAttribute("data-platform", originalSupport!, { timeout: 3500 });
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).not.toHaveAttribute("data-state", "jump", { timeout: 3500 });
  await page.waitForTimeout(1500);
  const after = (await frames(page)).slice(before.length); const grounded = after.at(-1)!;
  expect(grounded.visible).toBe(true); expect(grounded.same).toBe(true); expect(Math.abs(grounded.x - target.x)).toBeLessThan(1);
  expect((await readTrace(page))?.records.filter(r => r.at >= began && r.stage === "recovery") ?? [], "ordinary same-column recovery must win before emergency escalation").toEqual([]);
  proofs.get(page)!.facts.nativeLoss = { target, after };
});

test("deliberate schedule hide remains hidden without an emergency rescue", async ({ page }) => {
  test.setTimeout(30_000); await page.clock.install(); await seed(page, { hide: true }); await open(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  const target = await placeOnCard(page, true); await page.clock.fastForward(45_000);
  for (let step = 0; step < 30 && await pet(page).getAttribute("data-hide-phase") !== "hidden"; step++) await page.clock.runFor(1000);
  await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden"); await expect(pet(page)).toHaveJSProperty("hidden", true);
  const before = (await readTrace(page))?.records ?? []; await page.clock.runFor(2000);
  await expect(pet(page)).toHaveAttribute("data-hide-phase", "hidden"); await expect(pet(page)).toHaveJSProperty("hidden", true);
  const trace = (await readTrace(page))!; assertProjection(trace, await page.evaluate(() => Date.now()));
  expect(trace.records.some(r => r.reason === "schedule-hide")).toBe(true); expect(recoveries(trace)).toEqual([]);
  proofs.get(page)!.facts.deliberateHide = { target, clockAndRngControlled: true, before, trace };
});

test("native pointer hold keyboard hold and placement retain input ownership", async ({ page }) => {
  await seed(page); await open(page); const baseline = recoveries(await readTrace(page)).length;
  const r = (await actor(page).boundingBox())!; await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down();
  await page.mouse.move(900, 500, { steps: 10 }); await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.waitForTimeout(1600);
  await expect(pet(page)).toHaveAttribute("data-state", "held"); expect(recoveries(await readTrace(page))).toHaveLength(baseline);
  await page.mouse.up(); await expect(actor(page)).toBeVisible();
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held"); await page.waitForTimeout(1600);
  await expect(pet(page)).toHaveAttribute("data-state", "held"); expect(recoveries(await readTrace(page))).toHaveLength(baseline); await actor(page).press("Escape");
  await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", ""); await page.waitForTimeout(1600);
  await expect(pet(page)).toHaveAttribute("data-placing", ""); expect(recoveries(await readTrace(page))).toHaveLength(baseline); await actor(page).press("Escape");
});

test("explicit local export bounds retention and strips unknown or identifying fields", async ({ page }) => {
  const now = Date.now(), canary = "PRIVATE_VISIBILITY_CANARY_9cbed5", url = "https://example.invalid/visibility-secret";
  const records = Array.from({ length: 21 }, (_, i) => ({ at: now - (21 - i) * 1000, revision: "1".repeat(40), stage: "observed", reason: "offscreen", support: "calendar", action: "idle", side: "none", x: 800, y: 300, width: 1920, height: 1000, size: 92, hidden: true, reduced: false }));
  const stored = JSON.stringify({ schemaVersion: 1, kind: "local-companion-visibility", revision: "dev", records: [
    { ...records[0], at: now - 8 * DAY }, ...records, { ...records[0], at: now + DAY },
    { ...records[0], at: now, eventId: canary, platformId: canary, title: canary, body: canary, account: canary, nickname: canary, url }
  ], account: canary });
  await seed(page, { stored }); await open(page);
  // Canary DOM content is test input only; the diagnostics may never serialize it.
  await page.locator(".poster-page").evaluate((node, canary) => { const span = document.createElement("span"); span.hidden = true; span.textContent = canary; span.dataset.eventid = canary; node.append(span); }, canary);
  const since = Date.now(); proofs.get(page)!.facts.privacyFault = await displaceOccupiedArrow(page);
  proofs.get(page)!.facts.privacyRecovery = await assertRecovered(page, since);
  await page.waitForTimeout(1600); expect(proofs.get(page)!.downloads).toBe(0);
  const trace = await exportTrace(page, "privacy-retention"), raw = JSON.stringify(trace);
  expect(raw).not.toContain(canary); expect(raw).not.toContain(url); expect(trace.records).toHaveLength(24);
  expect(trace.records.some(r => r.revision === "1".repeat(40)), "valid prior-build provenance must survive sanitized reload").toBe(true);
  expect(trace.records.some(r => r.at === now - 8 * DAY || r.at === now + DAY)).toBe(false);
  proofs.get(page)!.facts.retention = { inputRecords: 24, outputRecords: trace.records.length, boundedBytes: Buffer.byteLength(raw), trace };
});

test("trace storage denial preserves the companion and offers an explicit memory export", async ({ page }) => {
  await seed(page, { denyTraceStorage: true }); await open(page); await expect(actor(page)).toBeVisible();
  proofs.get(page)!.facts.storageDeniedFault = await displaceOccupiedArrow(page);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/, { timeout: 6500 });
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump"); expect(proofs.get(page)!.downloads).toBe(0);
  const trace = await exportTrace(page, "storage-denied"); expect(trace.records.length).toBeGreaterThan(0); expect(trace.records.length).toBeLessThanOrEqual(24);
  expect(trace.records.some(r => r.stage === "observed" && ["offscreen", "lost-support"].includes(r.reason))).toBe(true);
  expect(recoveries(trace)).toHaveLength(1); expect(trace.records.filter(r => r.stage === "recovered")).toHaveLength(1);
  await expect(actor(page)).toBeVisible(); proofs.get(page)!.facts.memoryFallback = trace;
});

test("actual reduced motion completes one quiet measured recovery without an airborne animation", async ({ page }) => {
  await seed(page); await open(page);
  await page.getByRole("button", { name: "설정", exact: true }).first().click();
  const settings = page.getByRole("dialog", { name: "설정", exact: true }); await expect(settings).toBeVisible();
  await settings.getByRole("tab", { name: "움직임", exact: true }).click();
  await settings.locator('[data-act="생동감 있는 동작 켜기/끄기"]').click();
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");
  await settings.locator(".modal-head .modal-close").click(); await expect(settings).toBeHidden(); await expect(actor(page)).toBeVisible();
  const since = Date.now(), fault = await displaceOccupiedArrow(page); proofs.get(page)!.facts.quietFault = fault;
  const result = await assertRecovered(page, since), samples = (await frames(page)).filter(f => f.at >= fault.started);
  expect(result.episode.find(r => r.stage === "recovery")?.reduced).toBe(true);
  expect(result.episode.find(r => r.stage === "recovered")?.reduced).toBe(true);
  expect(samples.some(f => f.hidden && ["bounds", "support", "vertical"].includes(f.reason))).toBe(true);
  expect(samples.filter(f => f.state === "jump"), "the app's actual reduce-motion choice must suppress the finite recovery flight").toEqual([]);
  expect(samples.every(f => f.same)).toBe(true); proofs.get(page)!.facts.quietRecovery = { ...result, samples };
});

test("a real settings modal takes ownership of a pending fault and cancels emergency recovery", async ({ page }) => {
  await seed(page); await open(page); const since = Date.now();
  proofs.get(page)!.facts.pendingFault = await displaceOccupiedArrow(page);
  await expect.poll(async () => (await readTrace(page))?.records.some(r => r.at >= since && r.stage === "observed" && r.reason === "offscreen"),
    { timeout: 800, intervals: [16, 32, 64] }).toBe(true);
  expect((await readTrace(page))?.records.filter(r => r.at >= since && r.stage === "recovery") ?? []).toEqual([]);
  const ownershipAt = Date.now(); await page.getByRole("button", { name: "설정", exact: true }).first().click();
  const settings = page.getByRole("dialog", { name: "설정", exact: true }); await expect(settings).toBeVisible();
  await page.waitForTimeout(1700);
  await expect(settings).toBeVisible(); const trace = (await readTrace(page))!; assertProjection(trace);
  const episode = trace.records.filter(r => r.at >= since);
  proofs.get(page)!.facts.modalCancellation = { ownershipAt, elapsedBeyondGate: Date.now() - ownershipAt, episode };
  expect(episode.some(r => r.at >= ownershipAt - 100 && r.reason === "owned")).toBe(true);
  expect(episode.filter(r => ["recovery", "recovered"].includes(r.stage)), "the modal owner must cancel the pending1200ms lease").toEqual([]);
  expect((await frames(page)).every(f => f.same)).toBe(true);
  // Leave the real modal open: closing may legitimately admit a fresh episode,
  // which is a separate transition from the cancelled pending timer above.
});

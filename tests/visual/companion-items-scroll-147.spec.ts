import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const out = process.env.COMPANION147_OUTPUT ?? ".scratch-pw/companion-147/items-scroll";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type ItemSample = { type: "food" | "toy"; id: string; platform: string; eligible: boolean; shown: boolean; dx: number; dy: number; native: boolean; x: number; y: number; floorX: number; floorY: number };
type Frame = { phase: "scroll" | "frame" | "post-render"; at: number; scroll: number; items: ItemSample[] };
type ProbeWindow = Window & { items147?: { frames: Frame[]; stop(): void } };
const proofs = new WeakMap<Page, { errors: string[]; unexpected: string[]; notes: unknown[] }>();
const summary = (frames: Frame[]) => {
  const items = frames.flatMap(frame => frame.items).filter(item => item.eligible);
  return { samples: items.length, missing: items.filter(item => !item.shown), maxDx: Math.max(0, ...items.filter(item => item.shown).map(item => Math.abs(item.dx))), maxDy: Math.max(0, ...items.filter(item => item.shown).map(item => Math.abs(item.dy))), candidatesOver2Px: items.filter(item => item.shown && Math.max(Math.abs(item.dx), Math.abs(item.dy)) >= 2) };
};

test.use({ storageState: { cookies: [], origins: [] }, serviceWorkers: "block", trace: "on", video: { mode: "on", size: { width: 1920, height: 1100 } } });
test.setTimeout(75000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const proof = { errors: [] as string[], unexpected: [] as string[], notes: [] as unknown[] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  const origin = new URL(baseURL!).origin;
  const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previews = new Set(Object.entries(actions).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return fulfillReadOnlyFont(route, fonts, proof.unexpected);
    if (url.origin === origin && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previews.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.unexpected.push(request.method() + " " + url.origin + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No real API in fixture" });
    return route.continue();
  });
});

test("147 native food and toy drag release keep the actual grip and unanchored flight", async ({ page }) => {
  const home = await setup(page, "viewer", 1920, "full");
  await home.locator('[data-home-action="feed"]').click(); await expect(page.locator(".vc-food")).toHaveCount(1); await expect(page.locator(".vc-food")).not.toHaveAttribute("data-falling", { timeout: 7000 });
  await home.locator('[data-home-action="toys"]').click(); await expect(page.locator(".vc-toy")).toHaveCount(1); await expect(page.locator(".vc-toy")).toHaveAttribute("data-falling", "false", { timeout: 7000 });
  await page.setViewportSize({ width: 1920, height: 700 }); await settlePanelLayout(page);
  await expectRestingFloor(page);
  for (const type of ["food", "toy"] as const) {
    const item = page.locator(type === "food" ? ".vc-food" : ".vc-toy"), identity = await item.getAttribute(type === "food" ? "data-food" : "data-toy-id");
    await expect(item).toHaveAttribute("data-native-item-anchor", "");
    const beforeScroll = await page.evaluate(() => ({ top: document.scrollingElement!.scrollTop, range: document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight }));
    await page.mouse.move(1300, 400); await page.mouse.wheel(0, beforeScroll.top < beforeScroll.range / 2 ? 45 : -45);
    // No arbitrary delay between native wheel and the next physical grab.
    const original = (await item.boundingBox())!, start = { x: original.x + original.width / 2, y: original.y + original.height / 2 }, target = { x: type === "food" ? 1250 : 1460, y: type === "food" ? 270 : 190 };
    await page.mouse.move(start.x, start.y); await page.mouse.down();
    await expect(item).not.toHaveAttribute("data-native-item-anchor");
    const grabbed = (await item.boundingBox())!;
    expect(Math.hypot(grabbed.x - original.x, grabbed.y - original.y), `${type} does not jump on a native grab immediately following scroll`).toBeLessThan(2);
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await expect.poll(async () => { const moved = (await item.boundingBox())!; return Math.hypot(moved.x - (original.x + target.x - start.x), moved.y - (original.y + target.y - start.y)); }, { message: `${type} retains the original physical grab offset after detaching its floor anchor` }).toBeLessThan(2);
    const probe = await item.evaluateHandle((node, type) => {
      const state = { frames: [] as { at: number; x: number; y: number; falling: boolean; native: boolean }[], raf: 0, stopped: false };
      const sample = () => { if (state.stopped) return; const r = node.getBoundingClientRect(), falling = type === "food" ? node.hasAttribute("data-falling") : node.getAttribute("data-falling") === "true"; state.frames.push({ at: performance.now(), x: r.left + r.width / 2, y: r.bottom, falling, native: node.hasAttribute("data-native-item-anchor") }); state.raf = requestAnimationFrame(sample); };
      state.raf = requestAnimationFrame(sample); return state;
    }, type);
    await page.mouse.up();
    if (type === "food") await expect(item).not.toHaveAttribute("data-falling", { timeout: 8000 }); else await expect(item).toHaveAttribute("data-falling", "false", { timeout: 8000 });
    const frames = await probe.evaluate(state => { state.stopped = true; cancelAnimationFrame(state.raf); return state.frames; }); await probe.dispose();
    const air = frames.filter(frame => frame.falling);
    const afterScroll = await page.evaluate(() => document.scrollingElement!.scrollTop);
    proofs.get(page)!.notes.push({ check: "native-grip-release", type, identity, original, grabbed, beforeScroll, afterScroll, target, air, finalPlatform: await item.getAttribute("data-platform") });
    expect(Math.abs(afterScroll - beforeScroll.top), "real root wheel movement precedes each physical grab").toBeGreaterThan(10);
    expect(await item.getAttribute(type === "food" ? "data-food" : "data-toy-id")).toBe(identity);
    expect(air.length, `${type} has actual finite flight samples`).toBeGreaterThan(3); expect(air.every(frame => !frame.native), `${type} flight remains free of the former floor anchor`).toBe(true);
    expect(Math.max(...air.map(frame => frame.y)) - Math.min(...air.map(frame => frame.y))).toBeGreaterThan(10);
  }
});
test.afterEach(async ({ page }, info) => {
  const frames = await page.evaluate(() => { const probe = (window as ProbeWindow).items147; probe?.stop(); return probe?.frames ?? []; }).catch(() => []);
  mkdirSync(out, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  const buildId = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const observedClock = await page.evaluate(() => ({ timeOrigin: performance.timeOrigin, performanceNow: performance.now(), wallTimeMs: Date.now() })).catch(() => null);
  // DOM geometry can precede CSS anchor scroll compensation even in a zero-delay
  // post-rAF timer. Every phase remains a candidate, never a painted pass.
  const renderCandidates = frames.flatMap(frame => frame.items.filter(item => item.eligible && (!item.shown || Math.max(Math.abs(item.dx), Math.abs(item.dy)) >= 2)).map(item => ({ phase: frame.phase, at: frame.at, type: item.type, id: item.id, shown: item.shown, dx: item.dx, dy: item.dy })));
  const proof = proofs.get(page)!;
  const receipt = { schemaVersion: 1, kind: "companion-items-scroll-147", caseTitle: info.title, build: buildId, buildId, recordedAt: new Date().toISOString(), observedClock, status: info.status, admissionStatus: info.status === "passed" && !proof.errors.length && !proof.unexpected.length ? "passed" : "failed", renderedStatus: renderCandidates.length ? "needs_render_review" : "no_candidate_observed", renderThresholdCssPx: 2, renderCandidates, ...proof, phases: { rawScroll: summary(frames.filter(frame => frame.phase === "scroll")), rawFrame: summary(frames.filter(frame => frame.phase === "frame")), postRender: summary(frames.filter(frame => frame.phase === "post-render")) }, viewport: page.viewportSize(), frames, scope: "Admission asserts physical floor contact, native support, real scroll movement, per-item visibility, absence of missing post-timer objects and real grip/free flight. Every eligible >=2CSSpx error in scroll/rAF/post-timer DOM geometry remains needs_render_review. Only three fresh independent, case/build/raw-SHA-bound assessments of the original 1:1 trace/video can classify prepaint_observation; DOM admission alone does not prove painted alignment. No geometry/style/clock/RNG/engine injection." };
  const receiptPath = resolve(out, `${name}.json`);
  writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  await info.attach("actual-items-scroll-147", { path: receiptPath, contentType: "application/json" });
  await page.screenshot({ path: `${out}/${name}-final.png` }).catch(() => {});
  expect(proofs.get(page)!.errors).toEqual([]); expect(proofs.get(page)!.unexpected).toEqual([]);
});

async function setup(page: Page, surface: "viewer" | "studio" | "preview", width: number, mode: "full" | "soft" | "off") {
  await page.setViewportSize({ width, height: 780 });
  await page.addInitScript(({ defaults, memory, epoch, epochKey, mode }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": mode === "full" ? "max" : mode === "soft" ? "auto" : "off", "vic.gfx": JSON.stringify({ mode, v: 3, at: Date.now() }), "vic.dark": "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic_avatar_side": "left", "vic.premiereStage": "off", "vic.viewerCompanion": JSON.stringify({ version: 1, ...defaults, enabled: true, roam: false, sleep: false, sound: false, feeding: true, learnFromYou: false, ambientPrank: false }), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }) })) localStorage.setItem(key, value);
  }, { defaults: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, mode });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1&ambient=autumn" : "/visual-fixture/studio?role=owner&y=2026&m=10&hour=23&weather=clear");
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  if (width === 1100) { const fold = page.getByRole("button", { name: "패널 접기", exact: true }); if (await fold.isVisible()) { await fold.click(); await settlePanelLayout(page); } }
  await page.evaluate(() => document.fonts.ready);
  const home = await openCompanionHome(page); await settlePanelLayout(page);
  return home;
}

async function expectRestingFloor(page: Page) {
  const read = () => page.evaluate(inset => {
    const floor = document.querySelector(".vc-home-floor")!.getBoundingClientRect(), food = document.querySelector(".vc-food")!.getBoundingClientRect(), toy = document.querySelector(".vc-toy")!.getBoundingClientRect();
    return { floor: floor.bottom, food: food.bottom, toy: toy.bottom, foodError: Math.abs(food.bottom - floor.bottom), toyError: Math.abs(toy.bottom - (floor.bottom - inset)) };
  }, COMPANION_HOME_FLOOR_INSET);
  await expect.poll(async () => { const contact = await read(); return Math.max(contact.foodError, contact.toyError); }, { message: "Both actual objects must first touch the measured home floor before their scroll baseline is accepted" }).toBeLessThan(2);
  proofs.get(page)!.notes.push({ initialPhysicalFloorContact: await read() });
}

async function scrollSurface(page: Page, surface: "viewer" | "studio" | "preview", width: number) {
  const home = page.locator(".vc-home");
  if (surface === "studio") for (const section of ["tag-filter", "season"]) { const fold = page.locator(`.avatar-rail [data-panel-section-toggle="${section}"][aria-expanded="true"]`); if (await fold.isVisible()) { await fold.focus(); await fold.press("Enter"); await settlePanelLayout(page); } }
  for (const height of [620, 500, 420, 360]) {
    await page.setViewportSize({ width, height }); await settlePanelLayout(page);
    const result = await home.evaluate(node => {
      const root = document.scrollingElement;
      const scrollable = (element: Element) => element.scrollHeight - element.clientHeight >= 80 && (element === root || /auto|scroll/.test(getComputedStyle(element).overflowY));
      let owner: Element | null = node; while (owner && !scrollable(owner)) owner = owner.parentElement; if (!owner && root && scrollable(root)) owner = root;
      if (!owner) { const grid = document.querySelector(".studio-month-grid"); if (grid && scrollable(grid)) owner = grid; }
      if (!owner) return null;
      const fixed = (element: Element | null) => { for (let current = element; current; current = current.parentElement) if (getComputedStyle(current).position === "fixed") return true; return false; };
      const nearest = (element: Element | null) => { for (let current = element; current; current = current.parentElement) if (current.scrollHeight - current.clientHeight > 2 && (current === root || /auto|scroll/.test(getComputedStyle(current).overflowY))) return current; return root && root.scrollHeight - root.clientHeight > 2 ? root : null; };
      const r = owner === root ? { left: 0, right: innerWidth, top: 70, bottom: innerHeight } : owner.getBoundingClientRect();
      for (const fx of [.7, .5, .9, .3, .1]) for (const fy of [.5, .8, .2]) { const x = Math.max(2, r.left) + (Math.min(innerWidth - 2, r.right) - Math.max(2, r.left)) * fx, y = Math.max(80, r.top) + (Math.min(innerHeight - 3, r.bottom) - Math.max(80, r.top)) * fy, hit = document.elementFromPoint(x, y); if (hit && nearest(hit) === owner && !(owner === root && fixed(hit))) return { x, y, range: owner.scrollHeight - owner.clientHeight, owner: owner === root ? "root" : owner.className, fixedHouse: fixed(node) }; }
      return null;
    });
    if (result) {
      const handle = await home.evaluateHandle(node => { const root = document.scrollingElement; for (let current: Element | null = node; current; current = current.parentElement) if (current.scrollHeight - current.clientHeight >= 80 && (current === root || /auto|scroll/.test(getComputedStyle(current).overflowY))) return current; if (root && root.scrollHeight - root.clientHeight >= 80) return root; return document.querySelector(".studio-month-grid"); });
      return { ...result, handle };
    }
  }
  throw Error("No real overflow owner and native wheel target");
}

for (const [surface, width] of [["viewer", 1920], ["viewer", 1100], ["studio", 1920], ["preview", 1920]] as const) for (const mode of ["full", "soft", "off"] as const) test(`147 ${surface} ${width} ${mode} floor food and toy follow rapid native scroll`, async ({ page }) => {
  const home = await setup(page, surface, width, mode), scroll = await scrollSurface(page, surface, width), { handle: owner, ...scrollProof } = scroll;
  if (mode === "full") await expect(page.locator("html")).not.toHaveAttribute("data-gfx"); else await expect(page.locator("html")).toHaveAttribute("data-gfx", mode);
  proofs.get(page)!.notes.push({ scrollSurface: scrollProof });
  // Establish the real visible recipient before creating objects. Resizing a
  // house floor wholly below the viewport is a deliberate support recovery,
  // not a measurement of an item resting on that floor during visible scroll.
  await page.mouse.move(scroll.x, scroll.y); await page.mouse.wheel(0, scroll.range + 100); await expect.poll(() => owner.evaluate(node => node?.scrollTop)).toBe(scroll.range); await page.waitForTimeout(300);
  await home.locator('[data-home-action="feed"]').click(); await expect(page.locator(".vc-food")).toHaveCount(1); await expect(page.locator(".vc-food")).not.toHaveAttribute("data-falling", { timeout: 7000 });
  await home.locator('[data-home-action="toys"]').click(); await expect(page.locator(".vc-toy")).toHaveCount(1); await expect(page.locator(".vc-toy")).toHaveAttribute("data-falling", "false", { timeout: 7000 });
  await expect(page.locator(".vc-food")).toHaveAttribute("data-platform", /^companion-home-floor-food(?:-\d+)?$/);
  await expect(page.locator(".vc-toy")).toHaveAttribute("data-platform", /^companion-home-floor-food(?:-\d+)?$/);
  // Real box clicks may scroll into view (including retries when the resident
  // crosses the pointer). Re-establish the original native overflow endpoint
  // after those inputs so a sticky plateau cannot shrink the support denominator.
  await page.mouse.move(scroll.x, scroll.y); await page.mouse.wheel(0, scroll.range + 100);
  await expect.poll(() => owner.evaluate(node => node?.scrollTop), { message: "Native wheel restores the measured overflow endpoint after real food/toy creation" }).toBe(scroll.range);
  await settlePanelLayout(page); await page.waitForTimeout(180);
  await expectRestingFloor(page);
  const nativeEligible = await home.locator(".vc-home-floor").evaluate(floor => CSS.supports("position-anchor", "--vc-item") && CSS.supports("left", "anchor(left, 0px)") && [...document.querySelectorAll(".vc-food,.vc-toy")].every(node => Boolean(floor.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)));
  if (nativeEligible) for (const selector of [".vc-food", ".vc-toy"]) await expect(page.locator(selector)).toHaveAttribute("data-native-item-anchor", "");
  proofs.get(page)!.notes.push({ nativeEligible, expectedBothRetainedSameFloor: true });
  await page.evaluate(({ owner }) => {
    if (!owner) throw Error("No native owner");
    const floor = document.querySelector(".vc-home-floor")!, initial = floor.getBoundingClientRect();
    const objects = (["food", "toy"] as const).map(type => { const node = document.querySelector<HTMLElement>(type === "food" ? ".vc-food" : ".vc-toy")!; const r = node.getBoundingClientRect(); return { type, node, id: type === "food" ? node.dataset.food! : node.dataset.toyId!, dx: r.left + r.width / 2 - initial.left, dy: r.bottom - initial.top }; });
    const frames: Frame[] = []; let raf = 0, stopped = false; const timers = new Set<number>();
    const sample = (phase: Frame["phase"]) => { const f = floor.getBoundingClientRect(), h = floor.closest(".vc-home")!.getBoundingClientRect(); const items = objects.map(({ type, node, id, dx, dy }) => { const r = node.getBoundingClientRect(), px = f.left + dx, py = f.top + dy; const eligible = px >= 0 && px <= innerWidth && py >= 0 && py <= innerHeight && px >= h.left && px <= h.right && py >= h.top && py <= h.bottom; return { type, id, platform: node.dataset.platform ?? "", eligible, shown: node.isConnected && !node.hidden && r.width > 0 && r.height > 0, dx: r.left + r.width / 2 - px, dy: r.bottom - py, native: node.hasAttribute("data-native-item-anchor"), x: r.left + r.width / 2, y: r.bottom, floorX: f.left, floorY: f.top }; }); frames.push({ phase, at: performance.now(), scroll: owner.scrollTop, items }); };
    const onScroll = () => sample("scroll"); const frame = () => { if (stopped) return; sample("frame"); const timer = window.setTimeout(() => { timers.delete(timer); if (!stopped) sample("post-render"); }, 0); timers.add(timer); raf = requestAnimationFrame(frame); };
    window.addEventListener("scroll", onScroll, { capture: true, passive: true }); raf = requestAnimationFrame(frame);
    (window as ProbeWindow).items147 = { frames, stop() { stopped = true; cancelAnimationFrame(raf); for (const timer of timers) clearTimeout(timer); window.removeEventListener("scroll", onScroll, true); } };
  }, { owner });
  const step = Math.max(12, Math.min(80, Math.floor(scroll.range / 5)));
  for (let burst = 0; burst < 4; burst++) for (const delta of [-step, -step * 2, step, -step, step * 2, -step * 2, step * 2, -step, step * 2]) { await page.mouse.wheel(0, delta); await page.waitForTimeout(35); }
  await page.waitForTimeout(300);
  const frames = await page.evaluate(() => { const probe = (window as ProbeWindow).items147!; probe.stop(); return probe.frames; }), verdict = summary(frames.filter(frame => frame.phase === "post-render"));
  const floorMotionY = Math.max(...frames.map(frame => frame.items[0].floorY)) - Math.min(...frames.map(frame => frame.items[0].floorY));
  proofs.get(page)!.notes.push({ verdictPhase: "post-render", verdict, actualFloorMotionY: floorMotionY, identities: await page.locator(".vc-food,.vc-toy").evaluateAll(nodes => nodes.map(node => ({ food: (node as HTMLElement).dataset.food, toy: (node as HTMLElement).dataset.toyId, platform: (node as HTMLElement).dataset.platform }))) });
  expect(new Set(frames.map(frame => Math.round(frame.scroll))).size).toBeGreaterThan(2); expect(Math.max(...frames.map(frame => frame.scroll)) - Math.min(...frames.map(frame => frame.scroll))).toBeGreaterThan(40);
  for (const type of ["food", "toy"] as const) expect(frames.filter(frame => frame.phase === "post-render").flatMap(frame => frame.items).filter(item => item.eligible && item.type === type).length, `${type} requires its own visible floor sample denominator`).toBeGreaterThan(10);
  if (!scroll.fixedHouse) expect(floorMotionY, "a scrolling-house case must actually move its support, not merely the neighbouring calendar").toBeGreaterThan(8);
  expect(verdict.missing).toEqual([]);
  await home.screenshot({ path: `${out}/${surface}-${width}-${mode}-room.png` });
});

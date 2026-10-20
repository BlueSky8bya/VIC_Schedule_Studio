import { companionSpriteSources } from "@/lib/ui/viewer-companion/sprite-quality";
import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const captureOff = process.env.COMPANION149_CAPTURE_OFF === "1";
const output = process.env.COMPANION149_OUTPUT ?? ".scratch-pw/companion-149/native";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type Sample = { at: number; state: string; play: string; scene: string; row: number; pose: number; src: string; decoded: boolean; visible: boolean; x: number; y: number; platform: string; bob: number; tilt: number; scale: number; scaleY: number; propsCount: number; focused: boolean; accessoryVisible: boolean };
type ProbeWindow = Window & { living149?: { frames: Sample[]; stop(): void } };
type Proof = { errors: string[]; rejected: string[]; notes: unknown[]; build: string; html?: { path: string; sha256: string }; chunks: { path: string; sha256: string; matchesBuild: boolean }[]; pending: Promise<void>[] };
const proofs = new WeakMap<Page, Proof>();
const hash = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

test.use({ viewport: { width: 1920, height: 1100 }, storageState: { cookies: [], origins: [] }, serviceWorkers: "block", trace: captureOff ? "off" : "on", video: { mode: captureOff ? "off" : "on", size: { width: 1920, height: 1100 } } });
test.setTimeout(90000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const proof: Proof = { errors: [], rejected: [], notes: [], build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), chunks: [], pending: [] }; proofs.set(page, proof);
  const origin = new URL(baseURL!).origin;
  page.on("pageerror", error => proof.errors.push(error.message));
  const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previews = new Set(Object.entries(actions).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin !== origin || !url.pathname.startsWith("/_next/static/") || !/\.(js|css)$/.test(url.pathname)) return;
    proof.pending.push((async () => { const bytes = await response.body(); const local = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", url.pathname.slice("/_next/".length))); proof.chunks.push({ path: url.pathname, sha256: hash(bytes), matchesBuild: bytes.equals(local) }); })().catch(error => { proof.errors.push("Chunk proof: " + String(error)); }));
  });
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return fulfillReadOnlyFont(route, fonts, proof.rejected);
    if (url.origin === origin && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previews.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.rejected.push(request.method() + " " + url.origin + url.pathname); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No real API in fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!;
  const frames = await page.evaluate(() => { const probe = (window as ProbeWindow).living149; probe?.stop(); return probe?.frames ?? []; }).catch(() => []);
  await Promise.all(proof.pending); const { pending, ...summary } = proof; void pending;
  mkdirSync(output, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  const file = resolve(output, name + ".json");
  writeFileSync(file, JSON.stringify({ schemaVersion: 1, captureOff, ...summary, status: info.status, recordedAt: new Date().toISOString(), frames, scope: "Actual native fixture UI and read-only rAF, body transform, decoded sprite and geometry observations; no SVG props or application state is injected by the observer. Initial synthetic saved preferences/care and, where declared, collection/accessory state. No runtime/RNG/clock/geometry/brain/action replacement; no real API writes/login or daily-factory completion claim." }, null, 2));
  await info.attach("actual-living-149", { path: file, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.chunks.length).toBeGreaterThan(5); expect(proof.chunks.every(chunk => chunk.matchesBuild)).toBe(true);
});

async function setup(page: Page, surface: "viewer" | "studio" | "preview", mode = "full", glasses = false, dark = false) {
  await page.addInitScript(({ preferences, memory, epoch, epochKey, mode, glasses, dark }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": mode === "soft" ? "auto" : mode === "off" ? "off" : "max", "vic.gfx": JSON.stringify({ mode: mode === "reduced" ? "full" : mode, at: Date.now(), v: 3 }), "vic.reduceMotion": mode === "reduced" ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": dark ? "on" : "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, personality: "performer", personalitySource: "manual", sleep: false, feeding: false, petting: false, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }));
    if (glasses) localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: [], behaviors: [], situations: [], gifts: { unlocked: ["round-glasses"], equipped: "round-glasses", pending: null } }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, mode, glasses, dark });
  const response = await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner&y=2025&m=10&hour=12&weather=clear");
  const html = await response!.body(), proof = proofs.get(page)!; mkdirSync(output, { recursive: true });
  const path = resolve(output, `${test.info().title.replace(/[^a-z0-9]+/gi, "-")}-actual.html`); writeFileSync(path, html); proof.html = { path, sha256: hash(html) }; expect(html.toString("utf8")).toContain(proof.build);
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  if (page.viewportSize()?.width === 1120) {
    // <=1040px is intentionally unsupported. This smaller supported desktop
    // opens its real shared overlay rail, without overriding device/layout.
    const panel = page.locator('.poster-panel-ctl [data-act="panel-toggle"]').first();
    await expect(panel).toBeVisible(); if (await panel.getAttribute("aria-pressed") === "false") await panel.click(); await settlePanelLayout(page);
  }
  const home = await openCompanionHome(page);
  const homeShape = await home.evaluate(node => { const card = node.getBoundingClientRect(), room = node.querySelector(".vc-home-room")?.getBoundingClientRect(); return { width: card.width, roomWidth: room?.width ?? 0, presentation: node.getAttribute("data-home-presentation"), supportedDesktop: !matchMedia("(max-width: 1040px)").matches }; });
  proofs.get(page)!.notes.push({ actualHomeLayout: homeShape, viewport: page.viewportSize(), roomAtMost250: homeShape.roomWidth > 0 && homeShape.roomWidth <= 250, noDeviceGateOverride: true }); expect(homeShape.supportedDesktop).toBe(true);
  await expect(page.locator(".vc-companion")).toBeVisible();
  if (glasses) await expect(page.locator(".vc-companion .vc-wearable-front")).toBeVisible();
  if (mode === "off" || mode === "soft") await expect(page.locator("html")).toHaveAttribute("data-gfx", mode);
  if (mode === "reduced") await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");
  return home;
}
async function selectPerformer(page: Page) {
  const home = await openCompanionHome(page); await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  const group = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }); await group.getByRole("radio", { name: "동글이", exact: true }).click(); await group.getByRole("radio", { name: "재롱둥이", exact: true }).click();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden(); await page.mouse.move(2, 2);
}
async function probe(page: Page) {
  await page.evaluate(() => {
    (window as ProbeWindow).living149?.stop();
    const frames: Sample[] = []; const began = performance.now(); let request = 0, stopped = false;
    const sample = () => {
      if (stopped) return;
      const actor = document.querySelector<HTMLElement>(".vc-companion"), texture = actor?.querySelector<HTMLImageElement>(".vc-texture"), shape = actor?.querySelector<HTMLElement>(".vc-pose"), accessory = actor?.querySelector<HTMLElement>(".vc-wearable-front");
      const body = new DOMMatrixReadOnly(actor?.style.transform), pose = new DOMMatrixReadOnly(shape?.style.transform), rect = actor?.getBoundingClientRect(), size = parseFloat(actor?.style.getPropertyValue("--vc-size") ?? "92");
      frames.push({ at: performance.now() - began, state: actor?.dataset.state ?? "", play: actor?.dataset.play ?? "", scene: actor?.dataset.personalityScene ?? "", row: Math.round(parseFloat(actor?.style.getPropertyValue("--vc-row") ?? "0") * 40 / 100), pose: Number(actor?.dataset.pose ?? -1), src: texture?.currentSrc ?? "", decoded: Boolean(texture?.complete && texture.naturalWidth), visible: Boolean(actor && !actor.hidden && rect?.width && rect.height && getComputedStyle(actor).visibility !== "hidden"), x: body.m41 + size / 2, y: body.m42 + size, platform: actor?.dataset.platform ?? "", bob: pose.m42, tilt: Math.atan2(pose.m12, pose.m11) * 180 / Math.PI, scale: pose.a * pose.d - pose.b * pose.c, scaleY: Math.hypot(pose.c, pose.d), propsCount: actor?.querySelectorAll(".vc-cheer-props,[data-cheer-side]").length ?? 0, focused: Boolean(document.activeElement?.matches('.event-editor-panel [contenteditable="true"],.event-editor-panel textarea')), accessoryVisible: Boolean(accessory && !accessory.hidden && accessory.getBoundingClientRect().width) });
      request = requestAnimationFrame(sample);
    };
    request = requestAnimationFrame(sample); (window as ProbeWindow).living149 = { frames, stop() { stopped = true; cancelAnimationFrame(request); } };
  });
}
const read = (page: Page) => page.evaluate(() => (window as ProbeWindow).living149?.frames ?? []);
const range = (values: number[]) => Math.max(...values) - Math.min(...values);
/** Count actual separated above12px excursions, not authored progress/labels. */
function airborneBeats(values: number[]) {
  let count = 0, above = false;
  for (const value of values) { const next = value < -12; if (next && !above) count++; above = next; }
  return count;
}
function assertBodyCheer(frames: { at: number; bob: number; tilt: number; scale: number; scaleY: number }[]) {
  expect(frames.length).toBeGreaterThan(60);
  const duration = frames.at(-1)!.at - frames[0].at;
  expect(duration).toBeGreaterThan(3300); expect(duration).toBeLessThan(4200);
  const beats = airborneBeats(frames.map(frame => frame.bob)); expect(beats).toBeGreaterThanOrEqual(3); expect(beats).toBeLessThanOrEqual(5);
  expect(Math.min(...frames.map(frame => frame.bob))).toBeLessThan(-12);
  expect(Math.min(...frames.map(frame => frame.bob))).toBeGreaterThan(-27);
  expect(range(frames.map(frame => frame.tilt))).toBeGreaterThan(2);
  expect(Math.min(...frames.map(frame => frame.scaleY))).toBeLessThan(.98); expect(Math.max(...frames.map(frame => frame.scaleY))).toBeGreaterThan(1.01);
  expect(frames.every(frame => Math.abs(frame.scale - 1) < .002)).toBe(true);
  expect(Math.abs(frames.at(-1)!.bob)).toBeLessThan(2); expect(Math.abs(frames.at(-1)!.scaleY - 1)).toBeLessThan(.015);
  return { samples: frames.length, durationMs: duration, actualAirborneBeatsAbove12px: beats, maxLiftPx: -Math.min(...frames.map(frame => frame.bob)), minimumScaleY: Math.min(...frames.map(frame => frame.scaleY)), maximumScaleY: Math.max(...frames.map(frame => frame.scaleY)) };
}

for (const [surface, mode, glasses] of [["studio", "full", false], ["viewer", "full", false], ["preview", "full", false], ["studio", "full", true], ["studio", "soft", false], ["studio", "off", false], ["studio", "reduced", false]] as const) test(`149 ${surface} ${mode}${glasses ? " glasses" : ""} body pompom hops and clean recovery`, async ({ page }) => {
  await setup(page, surface, mode, glasses); await probe(page);
  let content;
  if (surface === "studio") {
    await page.locator('[data-act="calendar-cell"]').nth(10).dblclick({ position: { x: 14, y: 20 } });
    const editor = page.locator(".event-editor-panel:visible"); content = editor.getByRole("textbox", { name: "내용", exact: true }); await expect(editor).toBeVisible(); await content.fill("본체 응원 검수 초안"); await content.press("End");
  } else { await selectPerformer(page); await probe(page); }
  await expect(page.locator(".vc-cheer-props,[data-cheer-side]")).toHaveCount(0);
  if (mode !== "full") {
    await page.waitForTimeout(5000); const observed = await read(page), quietCheer = observed.filter(frame => frame.play === "cheer-rehearsal");
    expect(observed.length).toBeGreaterThan(30); expect(observed.every(frame => frame.propsCount === 0)).toBe(true); expect(quietCheer.every(frame => frame.bob > -3)).toBe(true);
    proofs.get(page)!.notes.push({ quietMode: mode, actualSamples: observed.length, cheerSamples: quietCheer.length, noPompomPropDOM: true, noHighCheerHops: true }); return;
  }
  await expect(page.locator('.vc-companion[data-state="play"][data-play="cheer-rehearsal"]')).toBeVisible({ timeout: 25000 });
  await page.waitForTimeout(1400);
  if (content) { await content.pressSequentially(" · 계속 입력", { delay: 70 }); await expect(content).toBeFocused(); await expect(content).toHaveText("본체 응원 검수 초안 · 계속 입력"); }
  await page.locator(".vc-companion").screenshot({ path: resolve(output, `${surface}-${mode}${glasses ? "-glasses" : ""}-mid-cheer.png`) });
  await expect(page.locator('.vc-companion[data-play="cheer-rehearsal"]')).toHaveCount(0, { timeout: 10000 }); await page.waitForTimeout(350);
  const all = await read(page), cheer = all.filter(frame => frame.play === "cheer-rehearsal" && frame.state === "play" && frame.decoded && frame.visible);
  const motion = assertBodyCheer(cheer);
  expect(cheer.every(frame => frame.row === 9 && frame.src.endsWith("/vitamin-action-09-eye-scale-143-v1.webp"))).toBe(true);
  expect(range(cheer.map(frame => frame.x))).toBeLessThan(1); expect(range(cheer.map(frame => frame.y))).toBeLessThan(1); expect(new Set(cheer.map(frame => frame.platform)).size).toBe(1);
  expect(all.every(frame => frame.propsCount === 0)).toBe(true);
  expect(all.some(frame => frame.at > cheer.at(-1)!.at + 100 && frame.play !== "cheer-rehearsal")).toBe(true);
  if (glasses) expect(cheer.filter(frame => frame.accessoryVisible).length).toBeGreaterThan(cheer.length * .9);
  proofs.get(page)!.notes.push({ actualBodyCheer: motion, sourcePreserved: true, fixedWorldSupport: true, cleanFollowingActionObserved: true, noPompomPropDOM: true, glasses });
  if (content) { await content.press("Escape"); await expect(page.locator(".event-editor-panel:visible")).toHaveCount(0); }
});

test("149 real book body cheer replay and manual OFF", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: [], behaviors: ["cheer-rehearsal"], situations: [], gifts: { unlocked: ["round-glasses"], equipped: "round-glasses", pending: null, activeMs: 0, interactionCredit: 0 } })));
  const home = await setup(page, "viewer"); await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }), tabs = dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true });
  await tabs.getByRole("tab", { name: "함께 지내기", exact: true }).click();
  let preview = dialog.getByRole("img", { name: "빅타민 미리보기", exact: true }); await expect(preview).toHaveAttribute("data-preview-ready", ""); await expect(preview.locator(".vc-wearable-front")).toBeVisible();
  const profile = await preview.evaluate(node => { const canvas = node.querySelector("canvas")!, pixels = canvas.getContext("2d")!.getImageData(80, 115, 40, 50).data; return { row: node.getAttribute("data-preview-row"), canvasPainted: pixels.some((value, index) => index % 4 === 3 && value > 200), propsCount: node.querySelectorAll(".vc-cheer-props,[data-cheer-side]").length }; });
  expect(profile.canvasPainted).toBe(true); expect(profile.propsCount).toBe(0); await dialog.screenshot({ path: resolve(output, "book-profile-body-cheer.png") });
  await tabs.getByRole("tab", { name: "옷장", exact: true }).click(); preview = dialog.getByRole("img", { name: "빅타민 미리보기", exact: true }); await expect(preview).toHaveAttribute("data-preview-ready", "");
  const stream = await preview.evaluateHandle(node => {
    const state = { frames: [] as { at: number; row: string; bob: number; tilt: number; scale: number; scaleY: number; propsCount: number }[], request: 0, stopped: false, stop() { state.stopped = true; cancelAnimationFrame(state.request); } }, began = performance.now();
    const sample = () => { if (state.stopped) return; const body = node.querySelector<HTMLElement>(".vc-pose"), pose = new DOMMatrixReadOnly(body?.style.transform); state.frames.push({ at: performance.now() - began, row: node.getAttribute("data-preview-row") ?? "", bob: pose.m42, tilt: Math.atan2(pose.b, pose.a) * 180 / Math.PI, scale: pose.a * pose.d - pose.b * pose.c, scaleY: Math.hypot(pose.c, pose.d), propsCount: node.querySelectorAll(".vc-cheer-props,[data-cheer-side]").length }); state.request = requestAnimationFrame(sample); };
    state.request = requestAnimationFrame(sample); return state;
  });
  await dialog.getByRole("button", { name: "다시 보기", exact: true }).click(); await expect(preview).toHaveAttribute("data-preview-row", "9"); await expect(preview).toHaveAttribute("data-preview-row", "0", { timeout: 6500 });
  const wardrobe = await stream.evaluate(state => { state.stop(); return state.frames; }); await stream.dispose();
  proofs.get(page)!.notes.push({ separateLocalBookPreview: true, initialKnownBehaviorOnly: "cheer-rehearsal", profile, wardrobeFrames: wardrobe, replayUsesNativeButton: true, noRuntimeDiscoveryInjected: true });
  // Ignore an auto-cycle tail before the native replay; validate its largest
  // contiguous body-row bout, preserving every raw sample above.
  const bouts: typeof wardrobe[] = []; let current: typeof wardrobe = [];
  for (const frame of wardrobe) { if (frame.row === "9") current.push(frame); else if (current.length) { bouts.push(current); current = []; } } if (current.length) bouts.push(current);
  const playback = bouts.sort((left, right) => right.length - left.length)[0] ?? [], motion = assertBodyCheer(playback); expect(wardrobe.every(frame => frame.propsCount === 0)).toBe(true);
  await dialog.getByRole("button", { name: "다시 보기", exact: true }).click(); await expect(preview).toHaveAttribute("data-preview-row", "9"); const old = await preview.elementHandle();
  await tabs.getByRole("tab", { name: "환경설정", exact: true }).click(); const master = dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }); await master.click(); await expect(master).toHaveAttribute("aria-checked", "false"); expect(await old!.evaluate(node => node.isConnected)).toBe(false); await old!.dispose();
  await tabs.getByRole("tab", { name: "옷장", exact: true }).click(); preview = dialog.getByRole("img", { name: "빅타민 미리보기", exact: true }); await expect(preview).toHaveAttribute("data-preview-ready", ""); await expect(dialog.getByRole("button", { name: "다시 보기", exact: true })).toBeDisabled();
  await page.waitForTimeout(750); await expect(preview).toHaveAttribute("data-preview-row", "0"); const quiet = await preview.locator(".vc-pose").evaluate(node => { const pose = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return { bob: pose.f, scaleY: Math.hypot(pose.c, pose.d) }; }); expect(Math.abs(quiet.bob)).toBeLessThan(.1); expect(Math.abs(quiet.scaleY - 1)).toBeLessThan(.002); await expect(dialog.locator(".vc-cheer-props,[data-cheer-side]")).toHaveCount(0);
  const known = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCollection")!).behaviors); expect(known).toEqual(["cheer-rehearsal"]); proofs.get(page)!.notes.push({ completeBodyMotion: motion, interruptedByNativeMasterOff: true, noPompomPropDOM: true });
});

test("149 known odd-food book preview only contracts recovers and stops on OFF", async ({ page }) => {
  // An explicit known-entry fixture exercises drawing and shared preview.
  // It is not an actual meal, consume ACK or discovery-causality test.
  await page.addInitScript(() => localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: [], behaviors: ["odd-food-reaction"], situations: [], gifts: { unlocked: ["round-glasses"], equipped: "round-glasses", pending: null, activeMs: 0, interactionCredit: 0 } })));
  const home = await setup(page, "viewer"); await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }), tabs = dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }); await tabs.getByRole("tab", { name: "옷장", exact: true }).click();
  let preview = dialog.getByRole("img", { name: "빅타민 미리보기", exact: true }); await expect(preview).toHaveAttribute("data-preview-ready", ""); await expect(preview.locator(".vc-wearable-front")).toBeVisible();
  const stream = await preview.evaluateHandle(node => {
    const state = { frames: [] as { at: number; row: string; bob: number; tilt: number; area: number; propsCount: number; accessoryVisible: boolean }[], request: 0, stopped: false, stop() { state.stopped = true; cancelAnimationFrame(state.request); } }, began = performance.now();
    const sample = () => { if (state.stopped) return; const body = node.querySelector<HTMLElement>(".vc-pose"), pose = new DOMMatrixReadOnly(body?.style.transform), accessory = node.querySelector<HTMLElement>(".vc-wearable-front"); state.frames.push({ at: performance.now() - began, row: node.getAttribute("data-preview-row") ?? "", bob: pose.f, tilt: Math.atan2(pose.b, pose.a) * 180 / Math.PI, area: pose.a * pose.d - pose.b * pose.c, propsCount: node.querySelectorAll(".vc-cheer-props,[data-cheer-side]").length, accessoryVisible: Boolean(accessory && !accessory.hidden && accessory.getBoundingClientRect().width) }); state.request = requestAnimationFrame(sample); };
    state.request = requestAnimationFrame(sample); return state;
  });
  await dialog.getByRole("button", { name: "다시 보기", exact: true }).click(); await expect(preview).toHaveAttribute("data-preview-row", "23"); await page.waitForTimeout(650);
  const drawing = await preview.evaluate((node, expectedSources) => { const canvas = node.querySelector("canvas")!, pixels = canvas.getContext("2d")!.getImageData(50, 60, 90, 100).data; return { painted: pixels.some((value, index) => index % 4 === 3 && value > 200), row: node.getAttribute("data-preview-row"), resourceSources: performance.getEntriesByType("resource").map(entry => entry.name).filter(name => expectedSources.includes(new URL(name).pathname)) }; }, companionSpriteSources(23));
  await dialog.screenshot({ path: resolve(output, "known-odd-food-preview-not-consume.png") }); await expect(preview).toHaveAttribute("data-preview-row", "0", { timeout: 4000 });
  const frames = await stream.evaluate(state => { state.stop(); return state.frames; }); await stream.dispose(); proofs.get(page)!.notes.push({ knownOddFoodVisualPreviewOnly: true, actualConsumeOrDiscoveryProved: false, initialKnownBehaviorOnly: "odd-food-reaction", frames, drawing });
  const bouts: typeof frames[] = []; let current: typeof frames = [];
  for (const frame of frames) { if (frame.row === "23") current.push(frame); else if (current.length) { bouts.push(current); current = []; } } if (current.length) bouts.push(current);
  const playback = bouts.sort((left, right) => right.length - left.length)[0] ?? []; expect(playback.length).toBeGreaterThan(20); const duration = playback.at(-1)!.at - playback[0].at; expect(duration).toBeGreaterThan(1900); expect(duration).toBeLessThan(2500); expect(drawing.painted).toBe(true); expect(drawing.resourceSources.length).toBeGreaterThan(0);
  let contractions = 0, contracted = false; for (const frame of playback) { const next = frame.bob < -.05; if (next && !contracted) contractions++; contracted = next; } expect(contractions).toBeGreaterThanOrEqual(2); expect(contractions).toBeLessThanOrEqual(3); expect(Math.min(...playback.map(frame => frame.bob))).toBeLessThan(-.5); expect(Math.max(...playback.map(frame => frame.tilt))).toBeGreaterThan(4); expect(Math.abs(playback.at(-1)!.bob)).toBeLessThan(.1); expect(playback.every(frame => Math.abs(frame.area - 1) < .002 && frame.propsCount === 0 && frame.accessoryVisible)).toBe(true);
  await dialog.getByRole("button", { name: "다시 보기", exact: true }).click(); await expect(preview).toHaveAttribute("data-preview-row", "23"); const old = await preview.elementHandle(); await tabs.getByRole("tab", { name: "환경설정", exact: true }).click(); const master = dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }); await master.click(); await expect(master).toHaveAttribute("aria-checked", "false"); expect(await old!.evaluate(node => node.isConnected)).toBe(false); await old!.dispose();
  await tabs.getByRole("tab", { name: "옷장", exact: true }).click(); preview = dialog.getByRole("img", { name: "빅타민 미리보기", exact: true }); await expect(preview).toHaveAttribute("data-preview-ready", ""); await expect(dialog.getByRole("button", { name: "다시 보기", exact: true })).toBeDisabled(); await page.waitForTimeout(500); await expect(preview).toHaveAttribute("data-preview-row", "0"); const known = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCollection")!).behaviors); expect(known).toEqual(["odd-food-reaction"]);
  proofs.get(page)!.notes.push({ oddFoodPreviewDurationMs: duration, actualContractionBeats: contractions, manualOffStopsKnownPreview: true, actualConsumeOrDiscoveryProved: false });
});

async function notebookBounds(page: Page, label: string) {
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  const geometry = await dialog.evaluate(node => {
    const card = node.getBoundingClientRect(), visible = (item: Element) => { const box = item.getBoundingClientRect(), css = getComputedStyle(item); return !item.closest("[hidden],[inert],[aria-hidden='true']") && box.width > 0 && box.height > 0 && css.visibility !== "hidden" && css.display !== "none"; };
    const buttons = [...node.querySelectorAll<HTMLElement>(".rhh-companion-settings button")].filter(visible).map(item => { const box = item.getBoundingClientRect(); return { text: item.textContent?.trim(), left: box.left, right: box.right, width: box.width, height: box.height, scrollWidth: item.scrollWidth, clientWidth: item.clientWidth }; });
    const counts = [...node.querySelectorAll<HTMLElement>(".rhh-collection-count")].filter(visible).map(item => { const box = item.getBoundingClientRect(); return { text: item.textContent, left: box.left, right: box.right, scrollWidth: item.scrollWidth, clientWidth: item.clientWidth }; });
    const footer = [...node.querySelectorAll<HTMLElement>(".rhh-collection-pages")].filter(visible).map(item => { const box = item.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right }; });
    return { card: { left: card.left, right: card.right, top: card.top, bottom: card.bottom }, buttons, counts, footer, horizontalOverflow: node.scrollWidth - node.clientWidth, theme: document.documentElement.dataset.theme ?? "light" };
  });
  proofs.get(page)!.notes.push({ notebookPage: label, geometry });
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(2);
  for (const button of geometry.buttons) { expect(button.left).toBeGreaterThanOrEqual(geometry.card.left - 1); expect(button.right).toBeLessThanOrEqual(geometry.card.right + 1); expect(button.width).toBeGreaterThanOrEqual(43.9); expect(button.height).toBeGreaterThanOrEqual(43.9); expect(button.scrollWidth - button.clientWidth).toBeLessThanOrEqual(2); }
  for (const count of geometry.counts) { expect(count.left).toBeGreaterThanOrEqual(geometry.card.left + 6); expect(count.right).toBeLessThanOrEqual(geometry.card.right - 6); expect(count.scrollWidth - count.clientWidth).toBeLessThanOrEqual(1); }
  for (const footer of geometry.footer) expect(footer.bottom).toBeLessThanOrEqual(geometry.card.bottom - 6);
  await dialog.screenshot({ path: resolve(output, label + ".png") });
}

for (const [width, dark] of [[1920, false], [1920, true], [1120, false], [1120, true]] as const) test(`149 notebook four tabs unknown silhouettes ${width} ${dark ? "dark" : "light"}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1120 ? 780 : 1100 }); await setup(page, "viewer", "full", true, dark);
  if (dark) await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const home = await openCompanionHome(page); await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }), tabs = dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }), name = `notebook-${width}-${dark ? "dark" : "light"}`;
  await tabs.getByRole("tab", { name: "함께 지내기", exact: true }).click(); await expect(dialog.locator(".rhh-companion-facts .rhh-taste-card")).toHaveCount(4); await notebookBounds(page, name + "-profile");
  await tabs.getByRole("tab", { name: "도감", exact: true }).click();
  for (const category of ["food", "toy", "behavior"]) {
    await dialog.locator(`[data-act="companion-collection-category"][data-act-opt="${category}"]`).click(); const grid = dialog.locator(".rhh-collection-grid:visible"), unknown = grid.locator("button:not([data-found])").first(); await expect(unknown).toBeVisible(); await unknown.click();
    const detail = dialog.locator(".rhh-collection-gallery-detail:visible"); await expect(detail).not.toHaveAttribute("data-found"); await expect(detail.locator(".rhh-collection-detail-title > strong")).toHaveText("???"); await expect(detail.locator(".rhh-collection-art-stage")).toBeVisible(); await expect(detail.locator(".rhh-collection-unknown")).toHaveCount(0);
    const before = await dialog.locator(".rhh-collection-page-rail:visible").inputValue(); await unknown.press("ArrowRight"); const after = await dialog.locator(".rhh-collection-page-rail:visible").inputValue(); expect(Number(after)).toBeGreaterThan(Number(before)); const previous = dialog.locator('.rhh-collection-pages:visible [data-page-direction="prev"]'), unreadPrevious = await previous.getAttribute("data-unread");
    // A discovered entry can make Next jump across pages. Left invokes the
    // actual previous button, whose ordinary destination is after-1, not an
    // invented undo of that unread jump. Observe its click without replacing it.
    const clicks = await previous.evaluateHandle(node => { const state = { count: 0, stop() { node.removeEventListener("click", clicked); } }; const clicked = () => { state.count++; }; node.addEventListener("click", clicked); return state; });
    await page.keyboard.press("ArrowLeft"); expect(await clicks.evaluate(state => { state.stop(); return state.count; })).toBe(1); await clicks.dispose();
    if (unreadPrevious === null) await expect(dialog.locator(".rhh-collection-page-rail:visible")).toHaveValue(String(Math.max(1, Number(after) - 1)));
    else await expect.poll(async () => Number(await dialog.locator(".rhh-collection-page-rail:visible").inputValue())).toBeLessThanOrEqual(Number(after)); await expect(dialog.locator(".rhh-collection-page-bar")).toHaveCount(0);
    await notebookBounds(page, name + "-" + category);
  }
  await tabs.getByRole("tab", { name: "옷장", exact: true }).click(); await expect(dialog.locator(".rhh-collection-heading > .rhh-collection-count")).toHaveText(/\d+\/\d+/); await notebookBounds(page, name + "-wardrobe-known");
  await dialog.locator(".rhh-accessory-grid button:not([data-found])").first().click(); await expect(dialog.locator(".rhh-wardrobe-detail-copy > strong")).toHaveText("???"); await expect(dialog.locator(".rhh-wardrobe-silhouette")).toBeVisible(); await notebookBounds(page, name + "-wardrobe-unknown");
  await tabs.getByRole("tab", { name: "환경설정", exact: true }).click(); await expect(dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).getByRole("radio")).toHaveCount(9); await notebookBounds(page, name + "-settings");
});

for (const [surface, width] of [["viewer", 1920], ["studio", 1920], ["preview", 1920], ["viewer", 1120]] as const) test(`149 curtain cord meets actual rod ${surface} ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1120 ? 780 : 1100 }); const home = await setup(page, surface), lamp = home.locator(".vc-home-lamp"), initialLamp = await lamp.getAttribute("aria-pressed"), measurements = [];
  for (let index = 0; index < 3; index++) {
    await page.mouse.move(2, 2);
    const measured = await home.evaluate(async node => {
      const image = node.querySelector<HTMLImageElement>(".vc-window-curtain-stage")!; await image.decode(); const rod = node.querySelector<HTMLElement>(".vc-window-curtain-overlay")!.getBoundingClientRect(), cord = node.querySelector<HTMLElement>(".vc-curtain-control > span")!.getBoundingClientRect();
      const expected = { x: rod.left + rod.width * 10 / 256, y: rod.top + rod.height * 17 / 192 }, actual = { x: cord.left + cord.width / 2, y: cord.top };
      return { phase: node.querySelector(".vc-home-window")?.getAttribute("data-curtain"), naturalSize: [image.naturalWidth, image.naturalHeight], rod: { left: rod.left, top: rod.top, width: rod.width, height: rod.height }, actual, expected, error: Math.hypot(actual.x - expected.x, actual.y - expected.y) };
    });
    measurements.push(measured); expect(measured.naturalSize).toEqual([256, 192]); expect(measured.error).toBeLessThanOrEqual(2);
    const curtain = home.locator('[data-home-action="curtain"]'), next = await curtain.getAttribute("data-act-opt"); await curtain.click(); await expect(home.locator(".vc-home-window")).toHaveAttribute("data-curtain", next!); await expect(lamp).toHaveAttribute("aria-pressed", initialLamp!);
  }
  proofs.get(page)!.notes.push({ actualRodPixelAttachment: measurements, curtainLightIndependent: true }); await page.mouse.move(2, 2); await home.screenshot({ path: resolve(output, `curtain-${surface}-${width}.png`) });
});

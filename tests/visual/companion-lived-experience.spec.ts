import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_CARE, DEFAULT_COMPANION_MEMORY, type CompanionMemory } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_LIFE, normalizeCompanionLife } from "@/lib/ui/viewer-companion/life";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FOOD_KINDS, COMPANION_FOOD_NAMES, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_COLLECTION_KEY, type CompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { type CompanionAccessoryId } from "@/lib/ui/viewer-companion/gifts";
import { COMPANION_RADIO_PREFERENCES_KEY } from "@/lib/ui/viewer-companion/radio-preferences";
import { COMPANION_RADIO_TRACKS } from "@/lib/ui/viewer-companion/radio-catalog";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Mode = "meal" | "social" | "cozy" | "cheer" | "nuzzle" | "accessory" | "radio-lively" | "radio-graceful" | "radio-calm" | "radio-off";
type CheerPaint = { propsCount: number; scale: number };
type Frame = { at: number; visibleFocusedMs: number; focused: boolean; hidden: boolean; state: string; living: string; play: string; requestedRow: number; row: number; pose: number; atlas: number; platform: string; foodGoal: string; episodeFood: string; dreaming: boolean; decoded: boolean; registered: boolean; src: string; expectedSrc: string; srcMatches: boolean; same: boolean; count: number; x: number; y: number; trick: string; beat: string; journey: string; accessoryPose: number; bodyBob: number; radio: string; radioGeneration: number; bodyTilt: number; wearable: { hidden: boolean; top: string; left: string; transform: string; background: string }; cheer: CheerPaint };
type Input = { type: string; key: string; target: string; trusted: boolean };
type Probe = { frames: Frame[]; inputs: Input[]; began: number; lastSample: number; lastActive: boolean; visibleFocusedMs: number; raf: number; previous: string; node: HTMLElement; input: (event: Event) => void };
type ProbeWindow = Window & { livedExperience104?: Probe; __companionSfxTrace?: string[] };
type Evidence = { writes: string[]; errors: string[]; care: unknown[]; media: Array<{ path: string; status: number }>; probe?: unknown };
const evidence = new WeakMap<Page, Evidence>();
const output = process.env.LIVED_EXPERIENCE_OUTPUT ?? ".scratch-pw/104-lived-experience";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const memory = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!) as CompanionMemory & { version: number });
const collection = (page: Page) => page.evaluate(key => { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as CompanionCollection : null; }, COMPANION_COLLECTION_KEY);

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const proof: Evidence = { writes: [], errors: [], care: [], media: [] }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  page.on("response", response => { const path = new URL(response.url()).pathname; if (path.startsWith("/companion/audio/radio/")) proof.media.push({ path, status: response.status() }); });
  const config = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "required-server-files.json"), "utf8"));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false, build: config.config.env.APP_COMMIT } });
    if (path.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    if (request.method() === "GET" && (path === "/" || path === "/studio")) return route.fulfill({ status: 200, body: "unused fixture navigation" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const build = readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
  const directory = `${output}/${build}`, label = info.title.replace(/[^a-z0-9]+/gi, "-").slice(0, 150); mkdirSync(directory, { recursive: true });
  const probe = await page.evaluate(() => {
    const p = (window as unknown as ProbeWindow).livedExperience104;
    const foodDom = [...document.querySelectorAll<HTMLElement>(".vc-food")].map(food => {
      const box = food.getBoundingClientRect(), style = getComputedStyle(food), transform = new DOMMatrixReadOnly(food.style.transform);
      return { id: food.dataset.food ?? "", kind: food.dataset.kind ?? "", platform: food.dataset.platform ?? "", falling: food.hasAttribute("data-falling"), eating: food.hasAttribute("data-eating"), selected: food.hasAttribute("data-selected"), connected: food.isConnected, visible: !food.hidden && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > .05, x: transform.m41, y: transform.m42, box: { x: box.x, y: box.y, width: box.width, height: box.height }, transform: food.style.transform };
    });
    const sounds = (window as unknown as ProbeWindow).__companionSfxTrace ?? [];
    if (!p) return { probeMissing: true, foodDom, sounds, focused: document.hasFocus(), hidden: document.hidden };
    cancelAnimationFrame(p.raf);
    for (const kind of ["pointerdown", "pointerup", "keydown", "keyup"]) document.removeEventListener(kind, p.input, true);
    return { frames: p.frames, inputs: p.inputs, visibleFocusedMs: p.visibleFocusedMs, foodDom, sounds, focused: document.hasFocus(), hidden: document.hidden };
  }).catch(error => ({ error: String(error) }));
  writeFileSync(`${directory}/${label}.json`, JSON.stringify({ build, title: info.title, status: info.status, ...evidence.get(page), finalProbe: probe }, null, 2));
  await page.screenshot({ path: `${directory}/${label}.png`, fullPage: true }).catch(() => {});
  expect(evidence.get(page)!.writes).toEqual([]); expect(evidence.get(page)!.errors).toEqual([]);
  if (probe && "inputs" in probe && probe.inputs) expect(probe.inputs.every(input => input.trusted)).toBe(true);
});

async function seed(page: Page, mode: Mode, accessory?: CompanionAccessoryId) {
  const radio = mode.startsWith("radio-");
  const life = mode === "social" || mode === "nuzzle" ? normalizeCompanionLife({ ...DEFAULT_COMPANION_LIFE, social: .85, curiosity: .2 })
    : mode === "cheer" ? normalizeCompanionLife({ ...DEFAULT_COMPANION_LIFE, play: .9, curiosity: .9, social: .1, comfort: .2 })
    : mode === "accessory" ? normalizeCompanionLife({ ...DEFAULT_COMPANION_LIFE, play: .2, curiosity: .1, social: .1, comfort: .2 })
    : radio ? normalizeCompanionLife({ ...DEFAULT_COMPANION_LIFE, play: mode === "radio-calm" ? .2 : .8, curiosity: .2, social: .7, comfort: mode === "radio-calm" ? .8 : .4 }) : null;
  await page.addInitScript(({ epoch, key, prefs, care, habits, life, mode, accessory, collectionKey, radio, radioKey }) => {
    // Passive successful-cue evidence only; no AudioContext, clock or cue is replaced.
    (window as unknown as ProbeWindow).__companionSfxTrace = [];
    if (localStorage.getItem("fixture.lived104")) return;
    localStorage.setItem("fixture.lived104", mode);
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.ambient": "off", "vic.sound": mode === "meal" || mode === "accessory" || radio ? "on" : "off", "vic.soundVol": "45", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    // Established saved care/preferences only. Meal/cozy deliberately use the
    // legacy snapshot so the real first-install migration chooses its own
    // random favorite. No RNG, focus, clock, brain or geometry is replaced.
    // A saved dog preference gives a genuine post-meal bow to witness. The
    // ordinary episode chooses/performs it; no requested frame is supplied.
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, animalMode: mode === "meal" ? "dog" : prefs.animalMode, roam: mode !== "cozy", jump: mode === "accessory", sleep: mode === "cozy", feeding: mode === "meal" || mode === "radio-lively", petting: mode !== "cheer" && mode !== "accessory", drag: true, personality: "affectionate", speed: "relaxed", heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: true }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: life ? 3 : 2, ...care, hunger: mode === "meal" ? .65 : .1, affection: mode === "nuzzle" ? .7 : .15, energy: mode === "cozy" ? .16 : .9, curiosity: mode === "cheer" ? .1 : care.curiosity, habits, ...(life ? { life } : {}) }));
    localStorage.setItem("vic.panelSections", JSON.stringify({ version: 1, "tag-filter": false, season: false, "companion-home": true }));
    if (accessory) localStorage.setItem(collectionKey, JSON.stringify({ version: 1, foods: [], behaviors: [], situations: [], gifts: { pending: null, unlocked: [accessory], equipped: null, activeMs: 0, interactionCredit: 0 } }));
    if (radio) {
      const mood = mode === "radio-off" ? "lively" : mode.slice(6);
      localStorage.setItem(radioKey, JSON.stringify({ enabled: true, volume: 35, react: mode !== "radio-off", moods: { lively: mood === "lively", graceful: mood === "graceful", calm: mood === "calm" }, excludedIds: [] }));
      localStorage.setItem(collectionKey, JSON.stringify({ version: 1, foods: [], behaviors: [], situations: [], gifts: { pending: null, unlocked: [], equipped: null, activeMs: 0, interactionCredit: 0 } }));
    }
    localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, habits: DEFAULT_COMPANION_MEMORY.habits, life, mode, accessory, collectionKey: COMPANION_COLLECTION_KEY, radio, radioKey: COMPANION_RADIO_PREFERENCES_KEY });
}
async function setup(page: Page, surface: Surface, mode: Mode, accessory?: CompanionAccessoryId) {
  await seed(page, mode, accessory);
  await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=developer&y=2025&m=11");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible(); await expect(pet(page)).toHaveAttribute("data-atlas", "hd");
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
  expect(companionSpriteMetadata.rows.length).toBeGreaterThanOrEqual(41);
  await startProbe(page); return (await pet(page).elementHandle())!;
}
async function startProbe(page: Page) {
  await pet(page).evaluate((node, metadata) => {
    const { rows, frames, atlases } = metadata;
    const el = node as HTMLElement;
    const began = performance.now();
    const p: Probe = { frames: [], inputs: [], began, lastSample: began, lastActive: document.hasFocus() && !document.hidden, visibleFocusedMs: 0, raf: 0, previous: "", node: el, input: () => {} };
    p.input = event => p.inputs.push({ type: event.type, key: event instanceof KeyboardEvent ? event.key : "", target: event.target instanceof Element ? event.target.closest("button")?.getAttribute("aria-label") ?? event.target.tagName : "", trusted: event.isTrusted });
    for (const kind of ["pointerdown", "pointerup", "keydown", "keyup"]) document.addEventListener(kind, p.input, { capture: true, passive: true });
    const sample = () => {
      // Read-only evidence clock. No app clock, RNG, focus or brain is replaced;
      // hidden/blurred intervals and suspended RAF gaps earn no visible time.
      const now = performance.now(), focused = document.hasFocus(), hidden = document.hidden, active = focused && !hidden, delta = now - p.lastSample;
      if (active && p.lastActive && delta >= 0 && delta < 1000) p.visibleFocusedMs += delta;
      p.lastSample = now; p.lastActive = active;
      const image = el.querySelector<HTMLImageElement>(".vc-texture"), requestedRow = Math.round(parseFloat(el.style.getPropertyValue("--vc-row")) * (rows.length - 1) / 100), pose = Number(el.dataset.pose), row = rows.findIndex(group => group.includes(pose)), m = new DOMMatrixReadOnly(el.style.transform), size = parseFloat(el.style.getPropertyValue("--vc-size"));
      const adopted = Number.isInteger(pose) && pose >= 0 ? frames[pose] : undefined, atlas = adopted ? atlases[adopted.atlas] : undefined;
      const src = image?.currentSrc ?? "", expectedSrc = atlas ? new URL(atlas.src, document.baseURI).href : "", srcMatches = Boolean(src && expectedSrc && src === expectedSrc);
      const wearable = el.querySelector<HTMLElement>(".vc-wearable-front"), body = el.querySelector<HTMLElement>(".vc-pose"), bodyMatrix = body ? new DOMMatrixReadOnly(body.style.transform) : new DOMMatrixReadOnly(), bodyBob = bodyMatrix.m42;
      const cheer: CheerPaint = { propsCount: el.querySelectorAll(".vc-cheer-props,[data-cheer-side]").length, scale: bodyMatrix.a * bodyMatrix.d - bodyMatrix.b * bodyMatrix.c };
      // CSS tracks the requested semantic row. Until a packet decodes, the
      // renderer safely retains an already adopted frame. Observe its actual
      // registered data-pose rather than mislabelling that20ms fallback. A
      // row membership alone is insufficient: its metadata frame must point
      // to the atlas actually adopted by the live image's currentSrc.
      const frame: Frame = { at: now - p.began, visibleFocusedMs: p.visibleFocusedMs, focused, hidden, state: el.dataset.state ?? "", living: el.dataset.living ?? "", play: el.dataset.play ?? "", requestedRow, row, pose, atlas: adopted?.atlas ?? -1, platform: el.dataset.platform ?? "", foodGoal: el.dataset.foodGoal ?? "", episodeFood: el.dataset.episodeFood ?? "", dreaming: el.hasAttribute("data-dreaming"), decoded: Boolean(image?.complete && image.naturalWidth), registered: Boolean(adopted && rows[row]?.includes(pose) && srcMatches), src, expectedSrc, srcMatches, same: el.isConnected && el === document.querySelector(".vc-companion"), count: document.querySelectorAll(".vc-companion").length, x: m.m41 + size / 2, y: m.m42 + size, trick: el.dataset.accessoryTrick ?? "", beat: el.dataset.accessoryBeat ?? "", journey: el.dataset.journey ?? "", accessoryPose: Number(el.dataset.accessoryPose ?? -1), bodyBob, radio: el.dataset.radioReaction ?? "", radioGeneration: Number(el.dataset.radioGeneration ?? 0), bodyTilt: Math.atan2(bodyMatrix.m12, bodyMatrix.m11) * 180 / Math.PI, wearable: { hidden: !wearable || wearable.hidden, top: wearable?.style.top ?? "", left: wearable?.style.left ?? "", transform: wearable?.style.transform ?? "", background: wearable?.style.backgroundImage ?? "" }, cheer };
      const signature = JSON.stringify([frame.state, frame.living, frame.play, frame.requestedRow, frame.row, frame.pose, frame.platform, frame.foodGoal, frame.dreaming, frame.decoded, frame.registered, frame.src, focused, hidden, frame.trick, frame.beat, frame.trick ? [frame.bodyBob, frame.wearable] : null, frame.radio, frame.radioGeneration, frame.radio ? [frame.bodyBob, frame.bodyTilt] : null, frame.play === "cheer-rehearsal" ? [frame.bodyBob, frame.bodyTilt, frame.cheer] : null]);
      if (signature !== p.previous) { p.frames.push(frame); p.previous = signature; }
      p.raf = requestAnimationFrame(sample);
    };
    (window as unknown as ProbeWindow).livedExperience104 = p; p.raf = requestAnimationFrame(sample);
  }, { rows: companionSpriteMetadata.rows, frames: companionSpriteMetadata.frames, atlases: companionSpriteMetadata.atlases });
}
const frames = (page: Page) => page.evaluate(() => (window as unknown as ProbeWindow).livedExperience104!.frames);
const sounds = (page: Page) => page.evaluate(() => (window as unknown as ProbeWindow).__companionSfxTrace ?? []);
async function waitVisibleFocused(page: Page, elapsed: number) {
  const started = await page.evaluate(() => (window as unknown as ProbeWindow).livedExperience104!.visibleFocusedMs);
  await expect.poll(() => page.evaluate(started => (window as unknown as ProbeWindow).livedExperience104!.visibleFocusedMs - started, started), { timeout: elapsed + 15000, intervals: [500] }).toBeGreaterThanOrEqual(elapsed);
}
function connectedCheer(observed: Frame[]): Frame[] | undefined {
  const playing = (frame: Frame) => frame.living === "cheer" && frame.play === "cheer-rehearsal" && frame.state === "play";
  const spread = (values: number[]) => Math.max(...values) - Math.min(...values);
  let bout: Frame[] = [];
  for (const frame of observed) {
    if (playing(frame)) { bout.push(frame); continue; }
    if (!bout.length) continue;
    const painted = bout.filter(item => item.row === 9 && item.decoded && item.registered && item.srcMatches && item.src.endsWith("/companion/hd/vitamin-action-09-eye-scale-143-v1.webp"));
    let airborneBeats = 0, above = false;
    for (const item of painted) { const next = item.bodyBob < -12; if (next && !above) airborneBeats++; above = next; }
    const duration = painted.length ? painted.at(-1)!.at - painted[0].at : 0;
    if (painted.length >= 12 && duration >= 3300 && duration <= 4200 && frame.at - bout[0].at < 4500
      && airborneBeats >= 3 && airborneBeats <= 5 && painted.every(item => item.cheer.propsCount === 0 && Math.abs(item.cheer.scale - 1) < .002)
      && Math.abs(painted.at(-1)!.bodyBob) < 2 && spread(painted.map(item => item.x)) < 1 && spread(painted.map(item => item.y)) < 1) return [painted[0], painted[Math.floor(painted.length / 2)], painted.at(-1)!];
    bout = [];
  }
}

async function clearFloorRay(page: Page, spread = 0, headroom = 96) {
  return page.evaluate(({ spread, headroom }) => {
    const y = innerHeight - 18;
    const visible = (element: Element) => { const r = element.getBoundingClientRect(), s = getComputedStyle(element); return r.width > 0 && r.height > 0 && s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity || 1) > .05; };
    const obstacles: DOMRect[] = [];
    for (const element of document.querySelectorAll("button,a[href],input,select,textarea,[role='button'],.vc-home")) if (!element.closest(".vc-companion") && visible(element)) obstacles.push(element.getBoundingClientRect());
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), range = document.createRange();
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      const parent = text.parentElement;
      if (!parent || parent.closest("script,style,svg,.sr-only,.vc-companion") || !visible(parent)) continue;
      range.selectNodeContents(text); for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) obstacles.push(r);
    }
    range.detach();
    const safe = (x: number) => obstacles.every(r => x + 50 < r.left || x - 50 > r.right || y + 4 < r.top || y - headroom > r.bottom);
    for (const fraction of [.62, .72, .42, .3, .88, .12, .82, .18]) { const x = Math.round(innerWidth * fraction); if (safe(x) && safe(x + 24) && safe(x - spread) && safe(x + spread)) return { x, y }; }
    throw new Error("No real unmodified clear floor ray for native placement");
  }, { spread, headroom });
}
async function placeAndHold(page: Page, spread = 0, headroom = 96) {
  const floor = await clearFloorRay(page, spread, headroom);
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(floor.x, floor.y); await page.mouse.move(2, 2);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  // Bottom controls can raise the real shared floor above innerHeight-18.
  // Use the actually landed feet for subsequent pointer/food input, never an
  // assumed lower floor that would deliberately drop the food off screen.
  return pet(page).evaluate(node => { const el = node as HTMLElement, m = new DOMMatrixReadOnly(el.style.transform), size = parseFloat(el.style.getPropertyValue("--vc-size")); return { x: m.m41 + size / 2, y: m.m42 + size }; });
}
async function dragFoodToFeet(page: Page, food: Locator, point: { x: number; y: number }) {
  const box = (await food.boundingBox())!, foot = await food.evaluate(node => { const m = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return { x: m.m41, y: m.m42 }; });
  const grip = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down();
  await page.mouse.move(point.x + grip.x - foot.x, point.y + grip.y - foot.y, { steps: 12 }); await page.mouse.up();
  await expect(food).not.toHaveAttribute("data-falling");
}
async function openTraits(page: Page) {
  const expand = page.getByRole("button", { name: "패널 펼치기", exact: true }), settings = page.getByRole("button", { name: "설정", exact: true });
  if (!await settings.isVisible() && await expand.isVisible()) await expand.click();
  await settings.click(); const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click(); await dialog.getByRole("tab", { name: "프로필", exact: true }).click();
  return dialog.getByRole("region", { name: "빅타민 특성", exact: true });
}

test("viewer: the complete radio corpus plays every real selected track through one shared media graph", async ({ page, context }) => {
  test.setTimeout(120000);
  const inspector = await context.newCDPSession(page), contexts = new Set<string>(), mediaSources = new Set<string>(), mediaErrors: unknown[] = [];
  inspector.on("WebAudio.contextCreated", ({ context }) => contexts.add(context.contextId));
  inspector.on("WebAudio.audioNodeCreated", ({ node }) => { if (/MediaElement/i.test(node.nodeType)) mediaSources.add(node.nodeId); });
  inspector.on("Media.playerErrorsRaised", event => mediaErrors.push(event));
  await inspector.send("WebAudio.enable"); await inspector.send("Media.enable");
  try {
    await setup(page, "viewer", "radio-off"); await openTraits(page);
    const dialog = page.getByRole("dialog", { name: "설정", exact: true });
    await dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "소리", exact: true }).click();
    const radio = dialog.locator(".rhh-companion-radio");
    for (const mood of ["우아하게", "잔잔하게"]) await radio.getByRole("button", { name: mood, exact: true }).click();
    await radio.getByText("곡 고르기", { exact: false }).click();
    expect(evidence.get(page)!.media).toEqual([]); expect(COMPANION_RADIO_TRACKS).toHaveLength(32);
    const played: Array<{ id: string; src: string; title: string; status: number[] }> = [];
    for (const [index, track] of COMPANION_RADIO_TRACKS.entries()) {
      await radio.getByRole("button", { name: `${track.title} 재생`, exact: true }).click();
      await expect(radio.locator(".rhh-radio-now > p")).toHaveText(track.title);
      const stop = radio.getByRole("button", { name: "정지", exact: true }); await expect(stop).toBeEnabled();
      await expect.poll(() => evidence.get(page)!.media.some(item => item.path === track.src && [200, 206].includes(item.status))).toBe(true);
      // Only selected past/current tracks may have a request; later songs
      // never preload. DevTools observes the actual browser graph read-only.
      expect(new Set(evidence.get(page)!.media.map(item => item.path))).toEqual(new Set(COMPANION_RADIO_TRACKS.slice(0, index + 1).map(item => item.src)));
      await page.waitForTimeout(220);
      played.push({ id: track.id, src: track.src, title: track.title, status: evidence.get(page)!.media.filter(item => item.path === track.src).map(item => item.status) });
      await stop.click(); await expect(stop).toBeDisabled();
      await expect(radio.locator(".rhh-radio-now > p")).toHaveText("재생 대기");
    }
    expect(played).toHaveLength(32); expect(contexts.size).toBe(1); expect(mediaSources.size).toBe(1); expect(mediaErrors).toEqual([]);
    evidence.get(page)!.care.push({ phase: "actual-32-track-selection-and-shared-graph", played, contextIds: [...contexts], mediaSourceIds: [...mediaSources], mediaErrors, limit: "Browser playback/graph evidence; no human listening or OBS hardware assertion." });
  } finally { await inspector.detach(); }
});

for (const surface of ["viewer", "studio"] as const) {
  for (const [mode, expected] of [["radio-lively", "bounce"], ["radio-graceful", "bored"], ["radio-calm", "calm"], ["radio-off", null]] as const) {
    test(`${surface}: ${mode} starts only on its real home click, respects actual temperament and stops without discovery rewards`, async ({ page }) => {
      test.setTimeout(45000);
      const identity = await setup(page, surface, mode);
      await openCompanionHome(page, "keyboard"); const floor = await placeAndHold(page, 0, 170);
      let ignoredFood: { id: string; kind: CompanionFoodKind } | undefined;
      if (mode === "radio-lively") {
        await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
        const food = page.locator(".vc-food"); await expect(food).toHaveCount(1);
        ignoredFood = { id: (await food.getAttribute("data-food"))!, kind: (await food.getAttribute("data-kind"))! as CompanionFoodKind };
        const landingCueOffset = (await sounds(page)).length;
        await dragFoodToFeet(page, food, { x: floor.x + 24, y: floor.y - 70 });
        await expect.poll(async () => (await sounds(page)).slice(landingCueOffset)).toContain("land");
        await expect.poll(() => food.evaluate((node, floor) => {
          const m = new DOMMatrixReadOnly((node as HTMLElement).style.transform);
          return Math.abs(m.m41 - floor.x - 24) < 2 && Math.abs(m.m42 - floor.y) < 2;
        }, floor)).toBe(true);
        expect((await memory(page)).hunger).toBeLessThan(.35);
      }
      // Releasing a held pet is a real direct command and correctly discards
      // an earlier music offer. Finish that input before the radio click.
      await actor(page).focus(); await actor(page).press("Space"); await page.mouse.move(2, 2);
      await expect(pet(page)).not.toHaveAttribute("data-state", "held");
      await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
      const radio = page.getByRole("button", { name: "라디오 켜기", exact: true });
      await expect(radio).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator(".vc-radio-notes")).toHaveCount(0);
      const hit = (await radio.boundingBox())!; expect(hit.width).toBeGreaterThanOrEqual(44); expect(hit.height).toBeGreaterThanOrEqual(44);
      const radioGeometry = await radio.evaluate(node => {
        const shelf = node.closest(".vc-home-shelf")!.getBoundingClientRect(), svg = node.querySelector("svg")!.getBoundingClientRect(), button = node.getBoundingClientRect();
        const zoom = Number(getComputedStyle(node).getPropertyValue("--shell-zoom")) || 1;
        return { zoom, width: button.width, height: button.height, svgWidth: svg.width, svgHeight: svg.height, buttonDx: button.x + button.width / 2 - shelf.x - 22 * zoom, buttonDy: button.y + button.height / 2 - shelf.y - 19 * zoom, svgDx: svg.x + svg.width / 2 - shelf.x - 22 * zoom, svgDy: svg.y + svg.height / 2 - shelf.y - 19 * zoom };
      });
      expect(Math.abs(radioGeometry.svgWidth - 44 * radioGeometry.zoom)).toBeLessThan(.1);
      expect(Math.abs(radioGeometry.svgHeight - 40 * radioGeometry.zoom)).toBeLessThan(.1);
      for (const delta of [radioGeometry.buttonDx, radioGeometry.buttonDy, radioGeometry.svgDx, radioGeometry.svgDy]) expect(Math.abs(delta)).toBeLessThan(.1);
      evidence.get(page)!.care.push({ phase: "real-radio-hit-and-preserved-art-centre", radioGeometry });
      expect(evidence.get(page)!.media).toEqual([]);
      const before = await memory(page), discoveries = await collection(page);
      // Saved mood filters express an ordinary user choice. The shipping
      // player still selects the actual song with its untouched RNG/media.
      await radio.click(); const stop = page.getByRole("button", { name: "라디오 끄기", exact: true });
      await expect(stop).toHaveAttribute("aria-pressed", "true", { timeout: 10000 });
      const notes = page.locator(".vc-radio-note"); await expect(notes).toHaveCount(3);
      await expect(notes.first()).toHaveCSS("animation-name", "vc-radio-note-float");
      const noteBefore = await notes.evaluateAll(nodes => nodes.map(node => { const style = getComputedStyle(node); return { transform: style.transform, opacity: style.opacity }; }));
      await page.waitForTimeout(180);
      const noteAfter = await notes.evaluateAll(nodes => nodes.map(node => { const style = getComputedStyle(node); return { transform: style.transform, opacity: style.opacity }; }));
      expect(noteAfter.some((note, index) => note.transform !== noteBefore[index].transform || note.opacity !== noteBefore[index].opacity)).toBe(true);
      evidence.get(page)!.care.push({ phase: "actual-playback-only-css-notes", noteBefore, noteAfter });
      if (mode === "radio-lively") {
        const room = (await page.locator(".vc-home-room").boundingBox())!;
        mkdirSync(output, { recursive: true });
        await page.screenshot({ path: `${output}/${surface}-radio-notes-native.png`, clip: room, scale: "css", animations: "allow" });
      }
      await expect.poll(() => evidence.get(page)!.media.some(item => [200, 206].includes(item.status))).toBe(true);
      const selected = [...new Set(evidence.get(page)!.media.map(item => item.path))]; expect(selected).toHaveLength(1);
      const track = COMPANION_RADIO_TRACKS.find(item => item.src === selected[0]); expect(track).toBeDefined();
      expect(track!.mood).toBe(mode === "radio-off" ? "lively" : mode.slice(6));
      if (expected) {
        await expect(pet(page)).toHaveAttribute("data-radio-reaction", expected, { timeout: 8000 });
        const generation = Number(await pet(page).getAttribute("data-radio-generation")); expect(generation).toBeGreaterThan(0);
        const box = (await pet(page).boundingBox())!, viewport = page.viewportSize()!, left = Math.max(0, box.x - 30), top = Math.max(0, box.y - 30);
        mkdirSync(output, { recursive: true });
        await page.screenshot({ path: `${output}/${surface}-${mode}-native92.png`, clip: { x: left, y: top, width: Math.min(viewport.width - left, box.width + 60), height: Math.min(viewport.height - top, box.height + 60) }, scale: "css" });
        await expect(pet(page)).not.toHaveAttribute("data-radio-reaction", { timeout: 8000 });
        const afterListening = await collection(page), performed = (await frames(page)).filter(frame => frame.radioGeneration === generation && frame.radio === expected);
        expect(performed.length).toBeGreaterThan(20);
        expect(performed.at(-1)!.at - performed[0].at).toBeGreaterThan(4700);
        expect(performed.at(-1)!.at - performed[0].at).toBeLessThan(6500);
        const adopted = performed.filter(frame => frame.registered && frame.decoded);
        expect(adopted.length).toBeGreaterThan(20);
        expect(adopted.every(frame => frame.same && frame.count === 1 && frame.focused && !frame.hidden && frame.srcMatches && [0, 1, 9, 10].includes(frame.row) && /^viewport-floor/.test(frame.platform))).toBe(true);
        expect(Math.max(...performed.map(frame => frame.x)) - Math.min(...performed.map(frame => frame.x))).toBeLessThan(1);
        expect(Math.max(...performed.map(frame => frame.y)) - Math.min(...performed.map(frame => frame.y))).toBeLessThan(1);
        expect(Math.max(...performed.map(frame => Math.abs(frame.bodyTilt)))).toBeGreaterThan(expected === "calm" ? .7 : 1.5);
        expect(afterListening?.behaviors).toEqual(discoveries?.behaviors); expect(afterListening?.situations).toEqual(discoveries?.situations);
        const after = await memory(page);
        for (const trait of ["sociability", "playfulness", "confidence"] as const) expect(after.habits[trait]).toBe(before.habits[trait]);
        expect(after.life.play).toBe(before.life.play); expect(after.life.recent).toEqual(before.life.recent);
        if (ignoredFood) {
          await expect(page.locator(`.vc-food[data-food="${ignoredFood.id}"]`)).toHaveCount(1);
          expect(afterListening?.foods).toEqual([]);
          expect(performed.every(frame => !frame.foodGoal && !frame.episodeFood)).toBe(true);
          expect(after.life.familiarity[ignoredFood.kind]).toBe(before.life.familiarity[ignoredFood.kind]);
          expect(Math.abs(after.life.foodScores[ignoredFood.kind] - before.life.foodScores[ignoredFood.kind])).toBeLessThan(.001);
        }
        evidence.get(page)!.care.push({ phase: "actual-radio-finite", mode, generation, track, before, after, ignoredFood, collection: afterListening });
      } else {
        await waitVisibleFocused(page, 6500);
        expect((await frames(page)).some(frame => frame.radio)).toBe(false);
        await expect(stop).toHaveAttribute("aria-pressed", "true");
      }
      if (mode === "radio-lively") {
        // Rendered-owner integration probe, distinct from a real timed
        // premiere: the shipping observer must revoke actual playback on
        // both surface roots. No clock, audio method or geometry is replaced.
        const surfaceRoot = page.locator(surface === "viewer" ? ".poster-page" : ".studio-shell").first();
        expect(await surfaceRoot.getAttribute("data-companion-premiere-owner")).toBeNull();
        await surfaceRoot.evaluate(node => node.setAttribute("data-companion-premiere-owner", "fixture-108-radio-guard"));
        try { await expect(page.getByRole("button", { name: "라디오 켜기", exact: true })).toHaveAttribute("aria-pressed", "false"); }
        finally { await surfaceRoot.evaluate(node => node.removeAttribute("data-companion-premiere-owner")); }
        await expect(page.locator(".vc-radio-notes")).toHaveCount(0);
        await waitVisibleFocused(page, 1200);
        await expect(page.getByRole("button", { name: "라디오 켜기", exact: true })).toHaveAttribute("aria-pressed", "false");
        evidence.get(page)!.care.push({ phase: "rendered-premiere-owner-stop-and-no-replay", surface, media: [...evidence.get(page)!.media] });
        await page.getByRole("button", { name: "라디오 켜기", exact: true }).click();
        await expect(stop).toHaveAttribute("aria-pressed", "true", { timeout: 10000 });
        await expect.poll(() => new Set(evidence.get(page)!.media.map(item => item.path)).size).toBe(2);
      }
      await stop.click(); await expect(page.getByRole("button", { name: "라디오 켜기", exact: true })).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator(".vc-radio-notes")).toHaveCount(0);
      await expect(pet(page)).not.toHaveAttribute("data-radio-reaction");
      // The actual cushion command owns exactly one plush cue. Revalidation
      // and the later arrival do not manufacture another button interaction.
      // A genuine held interval prevents an autonomous landing/discovery cue
      // from competing with this isolated assertion's existing burst guard.
      await actor(page).focus(); await actor(page).press("Space");
      await expect(pet(page)).toHaveAttribute("data-state", "held");
      await waitVisibleFocused(page, 1400);
      const offset = (await sounds(page)).length, cushion = page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
      await cushion.focus(); await cushion.press("Enter");
      await expect.poll(async () => (await sounds(page)).slice(offset).filter(cue => cue === "cushion").length).toBe(1);
      expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
    });
  }

  test(`${surface}: a native meal changes only the consumed food and retains its discoveries and real first seed through reload and settings`, async ({ page }) => {
    test.setTimeout(75000);
    await setup(page, surface, "meal"); const initial = await memory(page);
    expect(initial.version).toBe(3); expect(initial.life.favoriteFood).toBe(initial.life.seedFood);
    expect((await collection(page))?.foods ?? []).toEqual([]);
    await openCompanionHome(page, "keyboard"); const floor = await placeAndHold(page);
    // Placement is itself a real play experience. Earn the next learning
    // credit through19 seconds of genuine visible held time, never a clock jump.
    await page.waitForTimeout(19000);
    const cueOffset = (await sounds(page)).length;
    await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); const food = page.locator(".vc-food"); await expect(food).toHaveCount(1);
    await expect.poll(async () => (await sounds(page)).slice(cueOffset)).toContain("feed");
    const id = (await food.getAttribute("data-food"))!, kind = (await food.getAttribute("data-kind")) as CompanionFoodKind;
    // A real release above the existing floor gives the food its ordinary
    // gravity/landing boundary. No landing callback or geometry is supplied.
    await dragFoodToFeet(page, food, { x: floor.x + 24, y: floor.y - 90 });
    await expect.poll(async () => { const cues = (await sounds(page)).slice(cueOffset), feed = cues.indexOf("feed"); return feed >= 0 && cues.slice(feed + 1).includes("land"); }).toBe(true);
    const before = await memory(page); evidence.get(page)!.care.push({ phase: "before-meal", value: before, id, kind, successfulCues: (await sounds(page)).slice(cueOffset) });
    const spawned = await collection(page); expect(spawned?.foods ?? []).not.toContain(kind);
    evidence.get(page)!.care.push({ phase: "spawned-food-is-not-consumed", collection: spawned, id, kind });
    await actor(page).focus(); await actor(page).press("Space"); await page.mouse.move(2, 2);
    await expect(food).toHaveCount(0, { timeout: 25000 });
    await expect.poll(async () => (await memory(page)).life.foodScores[kind], { timeout: 6000 }).toBeGreaterThan(before.life.foodScores[kind] + .001);
    await expect.poll(async () => (await collection(page))?.foods ?? [], { timeout: 6000 }).toEqual([kind]);
    const after = await memory(page); evidence.get(page)!.care.push({ phase: "after-meal", value: after });
    expect(after.life.seedFood).toBe(initial.life.seedFood); expect(after.hunger).toBeLessThan(before.hunger - .25);
    for (const other of Object.keys(after.life.foodScores) as CompanionFoodKind[]) if (other !== kind) expect(Math.abs(after.life.foodScores[other] - before.life.foodScores[other])).toBeLessThan(.001);
    expect(after.life.recent).toContain(kind === before.life.favoriteFood ? "favorite-food" : "variety");
    const mealFrames = (await frames(page)).filter(frame => frame.state === "eat" && (frame.foodGoal === id || frame.episodeFood === id));
    expect(mealFrames.length).toBeGreaterThan(0); const lastEatingAt = Math.max(...mealFrames.map(frame => frame.at));
    // The actual completed meal's ordinary dog afterglow performs row29.
    // Require the adopted decoded/source-matched frame before checking its
    // stamp, so an intention or retained fallback cannot establish discovery.
    await expect.poll(async () => (await frames(page)).some(frame => frame.at > lastEatingAt && frame.row === 29 && frame.state === "play" && frame.same && frame.count === 1 && frame.decoded && frame.registered && frame.focused && !frame.hidden), { timeout: 10000, intervals: [50] }).toBe(true);
    await expect.poll(async () => (await collection(page))?.behaviors ?? [], { timeout: 6000 }).toContain("bow");
    const discovered = (await collection(page))!; evidence.get(page)!.care.push({ phase: "actual-consume-and-visible-bow-stamps", collection: discovered, id, kind });
    const observed = await frames(page); expect(observed.some(frame => frame.state === "eat" && (frame.foodGoal === id || frame.episodeFood === id))).toBe(true);
    expect(observed.filter(frame => frame.foodGoal).every(frame => frame.foodGoal === id)).toBe(true);
    evidence.get(page)!.probe = await page.evaluate(() => { const p = (window as unknown as ProbeWindow).livedExperience104!; return { beforeReloadFrames: p.frames, beforeReloadInputs: p.inputs, beforeReloadSounds: (window as unknown as ProbeWindow).__companionSfxTrace ?? [] }; });
    expect((evidence.get(page)!.probe as { beforeReloadInputs: Input[] }).beforeReloadInputs.every(input => input.trusted)).toBe(true);
    await page.reload(); await page.bringToFront(); await expect(actor(page)).toBeVisible();
    await startProbe(page);
    const reopened = await memory(page); expect(reopened.life.seedFood).toBe(initial.life.seedFood); expect(reopened.life.foodScores[kind]).toBeGreaterThan(before.life.foodScores[kind] + .001);
    const retained = await collection(page); expect(retained?.foods).toEqual(discovered.foods); expect(retained?.behaviors).toContain("bow");
    evidence.get(page)!.care.push({ phase: "reloaded-real-discoveries", collection: retained, id, kind });
    const traits = await openTraits(page); await expect(traits.locator(".rhh-companion-facts > div").filter({ has: page.locator("dt", { hasText: "좋아하는 간식" }) }).locator("dd")).toHaveText(COMPANION_FOOD_NAMES[reopened.life.favoriteFood]);
    const dialog = page.getByRole("dialog", { name: "설정", exact: true });
    await expect(dialog.locator(".rhh-trait-reason")).toContainText(/좋아하는 간식 먹기|다른 간식 맛보기|새 간식 맛보기|새 최애 간식/);
    await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "도감", exact: true }).click();
    await expect(dialog.getByRole("button", { name: new RegExp(`^냠냠 도감.*1/${COMPANION_FOOD_KINDS.length}$`) })).toHaveAttribute("aria-pressed", "true");
    const recordedFood = dialog.getByRole("button", { name: `${COMPANION_FOOD_NAMES[kind]} · 맛봤어요`, exact: true });
    await expect(recordedFood).toHaveAttribute("data-found", "true");
    await expect(recordedFood.locator(`[data-collection-art="food-stamp"][data-collection-art-id="${kind}"]`)).toHaveCount(1);
  });

  // Retired neckwear remains covered by the saved-alias world fixtures;
  // current wardrobe gestures exercise the strapless body-fit badge instead.
  for (const accessory of ["pixel-sunglasses", "baseball-cap", "bell-badge"] as const) {
    test(`${surface}: native ${accessory} wears, performs a finite gesture and earns only its actually visible situation`, async ({ page }) => {
      test.setTimeout(105000);
      const identity = await setup(page, surface, "accessory", accessory);
      expect((await collection(page))?.situations).toEqual([]);
      await openTraits(page); const dialog = page.getByRole("dialog", { name: "설정", exact: true });
      await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "옷장", exact: true }).click();
      await dialog.locator(`[data-accessory="${accessory}"]`).click();
      await dialog.locator('[data-act="companion-accessory-equip"][data-act-opt="on"]').click();
      await expect.poll(async () => (await collection(page))?.gifts.equipped).toBe(accessory);
      await dialog.getByRole("button", { name: "닫기", exact: true }).click();
      await expect(dialog).toHaveCount(0);
      // These gestures stay on the same x. The separate cheer test reserves
      // horizontal travel room; this vertical hop needs its real headroom.
      const floor = await placeAndHold(page, 0, 170);
      // Public native held input earns actual visible active time. The real
      // safe decision owns the action; no action/activeMs/RNG/clock is seeded.
      await waitVisibleFocused(page, 7500);
      expect((await collection(page))?.situations).not.toContain("accessory-trick");
      await actor(page).focus(); await actor(page).press("Space"); await page.mouse.move(2, 2);
      await expect(pet(page)).toHaveAttribute("data-accessory-beat", "show", { timeout: 65000 });
      mkdirSync(output, { recursive: true });
      await page.screenshot({ path: `${output}/${surface}-${accessory}-show-native.png`, fullPage: true });
      await expect.poll(async () => (await collection(page))?.situations ?? [], { timeout: 65000, intervals: [100] }).toContain("accessory-trick");
      const observed = await frames(page), settled = observed.find(frame => frame.trick === accessory && frame.beat === "settle" && frame.registered && frame.decoded && !frame.wearable.hidden);
      expect(settled).toBeDefined();
      const performed = observed.filter(frame => frame.trick === accessory && frame.journey === settled!.journey);
      const phases = performed.filter((frame, index, all) => index === 0 || frame.beat !== all[index - 1].beat).map(frame => frame.beat);
      expect(phases).toEqual(["prepare", "show", "settle"]);
      expect(performed.at(-1)!.at - performed[0].at).toBeGreaterThan(2200);
      expect(performed.at(-1)!.at - performed[0].at).toBeLessThan(4000);
      const witnessed = performed.filter(frame => ["show", "settle"].includes(frame.beat) && frame.registered && frame.decoded && !frame.wearable.hidden);
      expect(witnessed.some(frame => frame.beat === "show")).toBe(true); expect(witnessed.some(frame => frame.beat === "settle")).toBe(true);
      expect(witnessed.every(frame => frame.same && frame.count === 1 && frame.focused && !frame.hidden && frame.srcMatches && frame.accessoryPose === frame.pose && /^viewport-floor/.test(frame.platform) && frame.wearable.background.includes("/companion/"))).toBe(true);
      expect(new Set(witnessed.map(frame => frame.wearable.transform)).size).toBeGreaterThan(4);
      if (accessory === "baseball-cap") {
        expect(Math.min(...performed.map(frame => frame.bodyBob))).toBeLessThan(-20);
        expect(performed.some(frame => frame.row === 4 && frame.registered && frame.decoded)).toBe(true);
        expect(performed.some(frame => frame.row === 6 && frame.registered && frame.decoded)).toBe(true);
      }
      expect(Math.max(...performed.map(frame => frame.x)) - Math.min(...performed.map(frame => frame.x))).toBeLessThan(1);
      expect(Math.max(...performed.map(frame => frame.y)) - Math.min(...performed.map(frame => frame.y))).toBeLessThan(1);
      await expect(pet(page)).not.toHaveAttribute("data-accessory-trick");
      expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
      evidence.get(page)!.care.push({ phase: "actual-finite-accessory", accessory, floor, journey: settled!.journey, collection: await collection(page), successfulCues: await sounds(page) });
      await page.screenshot({ path: `${output}/${surface}-${accessory}-completed-native.png`, fullPage: true });
    });
  }

  test(`${surface}: a stable native pointer invites row33 contact and only real Enter petting earns affection`, async ({ page }) => {
    test.setTimeout(100000);
    const identity = await setup(page, surface, "social"), floor = await placeAndHold(page);
    // The real held input leaves autonomous actions paused but retains visible
    // active life time. No activeMs, action, callback, RNG or media is supplied.
    await page.waitForTimeout(46000); const before = await memory(page); evidence.get(page)!.care.push({ phase: "before-invitation", value: before });
    await page.mouse.move(floor.x + 130, floor.y - 70); await actor(page).focus(); await page.waitForTimeout(1200); await actor(page).press("Space");
    await expect.poll(async () => (await frames(page)).some(frame => frame.living === "social" && [33, 34].includes(frame.row) && frame.decoded && frame.registered), { timeout: 30000, intervals: [100] }).toBe(true);
    const invited = await memory(page); expect(invited.affection).toBeLessThanOrEqual(before.affection + .001); expect(invited.life.recent).not.toContain("kind-touch");
    expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
    await actor(page).focus(); await actor(page).press("Enter");
    await expect.poll(async () => (await memory(page)).life.recent.includes("kind-touch"), { timeout: 6000 }).toBe(true);
    const touched = await memory(page); evidence.get(page)!.care.push({ phase: "actual-petted", value: touched });
    expect(touched.affection).toBeGreaterThan(invited.affection + .04); expect(touched.life.social).toBeGreaterThan(invited.life.social);
    const observed = await frames(page); expect(observed.some(frame => frame.living === "social" && frame.state === "walk")).toBe(true);
    expect(observed.filter(frame => frame.living === "social").every(frame => frame.same && frame.count === 1)).toBe(true);
  });

  test(`${surface}: saved real affection permits native row34 nuzzling without inventing touch rewards`, async ({ page }) => {
    test.setTimeout(110000);
    const identity = await setup(page, surface, "nuzzle"), floor = await placeAndHold(page);
    await waitVisibleFocused(page, 46000);
    const before = await memory(page); evidence.get(page)!.care.push({ phase: "before-native-nuzzle", value: before });
    expect(before.affection).toBeGreaterThan(.6); expect(before.affection).toBeLessThan(.8);
    await page.mouse.move(floor.x + 130, floor.y - 70); await actor(page).focus(); await page.waitForTimeout(1200); await actor(page).press("Space");
    await expect.poll(async () => (await frames(page)).some(frame => frame.living === "social" && frame.play === "lean-nuzzle" && frame.state === "play" && frame.row === 34 && frame.decoded && frame.registered), { timeout: 30000, intervals: [100] }).toBe(true);
    // Let the real finite nuzzle and the ordinary five-second persistence
    // interval finish. No Enter/pointer petting input is supplied afterward.
    await waitVisibleFocused(page, 6000);
    const after = await memory(page); evidence.get(page)!.care.push({ phase: "after-native-nuzzle-no-touch", value: after });
    expect(after.affection).toBeLessThanOrEqual(before.affection + .001); expect(after.life.social).toBeCloseTo(before.life.social, 8);
    expect(after.life.recent).toEqual(before.life.recent); expect(after.life.recent).not.toContain("kind-touch");
    const observed = (await frames(page)).filter(frame => frame.living === "social" && frame.play === "lean-nuzzle" && frame.row === 34);
    expect(observed.length).toBeGreaterThan(0); expect(observed.every(frame => frame.same && frame.count === 1 && frame.decoded && frame.registered && frame.focused && !frame.hidden)).toBe(true);
    expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
    expect(await page.evaluate(() => (window as unknown as ProbeWindow).livedExperience104!.inputs.some(input => input.type === "keydown" && input.key === "Enter"))).toBe(false);
  });

  test(`${surface}: an actual sofa recall kneads, nests, curls into genuine quiet sleep and wakes on the same seat`, async ({ page }) => {
    test.setTimeout(75000);
    const identity = await setup(page, surface, "cozy"); await openCompanionHome(page, "keyboard"); await placeCompanionOnHomeFloor(page);
    // Native placement spends the first learning credit. Earn the next one
    // through actual visible held time so completed sleep can record rested.
    await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
    await waitVisibleFocused(page, 19000);
    const beforeSleep = await memory(page); evidence.get(page)!.care.push({ phase: "before-sofa-sleep", value: beforeSleep });
    await actor(page).focus(); await actor(page).press("Space");
    // The resident legitimately overlaps the cushion from the room floor.
    // Activate its real keyboard control rather than clicking through the pet.
    const cushion = page.getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
    await cushion.focus(); await cushion.press("Enter"); await page.mouse.move(2, 2);
    await expect.poll(async () => (await frames(page)).some(frame => frame.living === "cozy" && frame.row === 35 && frame.decoded && frame.registered), { timeout: 20000, intervals: [50] }).toBe(true);
    await expect.poll(async () => (await frames(page)).some(frame => frame.living === "cozy" && frame.row === 40 && frame.dreaming && frame.decoded && frame.registered), { timeout: 10000, intervals: [50] }).toBe(true);
    await expect.poll(async () => (await frames(page)).some(frame => frame.living === "cozy" && frame.row === 12), { timeout: 15000, intervals: [50] }).toBe(true);
    const observed = await frames(page), cozy = observed.filter(frame => frame.living === "cozy"), rows = cozy.map(frame => frame.row);
    const knead = rows.indexOf(35), nest = rows.indexOf(36), curl = cozy.findIndex(frame => frame.row === 40 && frame.dreaming), wake = rows.indexOf(12);
    expect(knead).toBeGreaterThanOrEqual(0); expect(nest).toBeGreaterThan(knead); expect(curl).toBeGreaterThan(nest); expect(wake).toBeGreaterThan(curl);
    expect(cozy.filter(frame => [35, 36, 40, 12].includes(frame.row)).every(frame => frame.platform === "companion-home" && frame.same && frame.count === 1 && frame.decoded && frame.registered)).toBe(true);
    const sleeping = cozy.filter(frame => frame.row === 40 && frame.dreaming); expect(sleeping.length).toBeGreaterThan(0);
    expect(Math.max(...sleeping.map(frame => frame.x)) - Math.min(...sleeping.map(frame => frame.x))).toBeLessThan(1);
    // Row12 begins before sleep actually completes. The completed real action
    // must restore needs and earn the corresponding persisted life experience.
    await expect.poll(async () => { const value = await memory(page); return value.energy > beforeSleep.energy + .18 && value.life.recent.includes("rested"); }, { timeout: 10000, intervals: [100] }).toBe(true);
    const rested = await memory(page); evidence.get(page)!.care.push({ phase: "completed-sofa-sleep", value: rested });
    expect(rested.energy).toBeGreaterThan(beforeSleep.energy + .18); expect(rested.life.recent).toContain("rested"); expect(rested.life.comfort).toBeGreaterThan(beforeSleep.life.comfort);
    expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
    await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  });

  test(`${surface}: genuine active floor time naturally performs and finishes the connected native pompom cheer`, async ({ page }) => {
    test.setTimeout(250000);
    const identity = await setup(page, surface, "cheer"); await placeAndHold(page, 90);
    const initial = await memory(page); expect(initial.life.play).toBeGreaterThan(.8); expect(initial.life.curiosity).toBeGreaterThan(.8);
    // Public native hold keeps the resident on its actual broad floor while
    // genuine focused time passes. Only persisted care/traits were seeded;
    // no action, activeMs, RNG, clock, geometry or media callback is supplied.
    await waitVisibleFocused(page, 91000); await expect(pet(page)).toHaveAttribute("data-state", "held");
    await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor/);
    const eligible = await memory(page); evidence.get(page)!.care.push({ phase: "after-genuine-cheer-wait", value: eligible });
    expect(eligible.energy).toBeGreaterThan(.6); expect(eligible.life.play).toBeGreaterThan(.8); expect(eligible.life.curiosity).toBeGreaterThan(.8);
    await actor(page).focus(); await actor(page).press("Space"); await page.mouse.move(2, 2);
    // Natural decisions retain their normal priority and early random chance.
    // The bounded observation also covers the ordinary first-rehearsal window.
    await expect.poll(async () => Boolean(connectedCheer(await frames(page))), { timeout: 120000, intervals: [100] }).toBe(true);
    const observed = await frames(page), sequence = connectedCheer(observed)!;
    expect(sequence.map(frame => frame.row)).toEqual([9, 9, 9]); expect(sequence[0].visibleFocusedMs).toBeGreaterThanOrEqual(90000);
    const performed = observed.filter(frame => frame.at >= sequence[0].at && frame.at <= sequence[2].at);
    expect(performed.length).toBeGreaterThanOrEqual(3);
    expect(performed.every(frame => frame.living === "cheer" && frame.play === "cheer-rehearsal" && frame.state === "play" && frame.row === 9 && frame.platform === sequence[0].platform && /^viewport-floor/.test(frame.platform) && frame.same && frame.count === 1 && frame.decoded && frame.registered && frame.focused && !frame.hidden && frame.src.endsWith("/companion/hd/vitamin-action-09-eye-scale-143-v1.webp"))).toBe(true);
    expect(Math.max(...performed.map(frame => frame.x)) - Math.min(...performed.map(frame => frame.x))).toBeLessThan(1);
    expect(Math.max(...performed.map(frame => frame.y)) - Math.min(...performed.map(frame => frame.y))).toBeLessThan(1);
    expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
    evidence.get(page)!.care.push({ phase: "after-natural-cheer", value: await memory(page) });
  });
}

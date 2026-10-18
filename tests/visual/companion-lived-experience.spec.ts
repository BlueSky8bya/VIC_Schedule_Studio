import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_CARE, DEFAULT_COMPANION_MEMORY, type CompanionMemory } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_LIFE, normalizeCompanionLife } from "@/lib/ui/viewer-companion/life";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FOOD_NAMES, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Mode = "meal" | "social" | "cozy" | "cheer" | "nuzzle";
type Frame = { at: number; visibleFocusedMs: number; focused: boolean; hidden: boolean; state: string; living: string; play: string; requestedRow: number; row: number; pose: number; atlas: number; platform: string; foodGoal: string; episodeFood: string; dreaming: boolean; decoded: boolean; registered: boolean; src: string; expectedSrc: string; srcMatches: boolean; same: boolean; count: number; x: number; y: number };
type Input = { type: string; key: string; target: string; trusted: boolean };
type Probe = { frames: Frame[]; inputs: Input[]; began: number; lastSample: number; lastActive: boolean; visibleFocusedMs: number; raf: number; previous: string; node: HTMLElement; input: (event: Event) => void };
type ProbeWindow = Window & { livedExperience104?: Probe };
type Evidence = { writes: string[]; errors: string[]; care: unknown[]; probe?: unknown };
const evidence = new WeakMap<Page, Evidence>();
const output = ".scratch-pw/104-lived-experience";
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const memory = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!) as CompanionMemory & { version: number });

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const proof: Evidence = { writes: [], errors: [], care: [] }; evidence.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  const config = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "required-server-files.json"), "utf8"));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false, build: config.config.env.APP_COMMIT } });
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
    if (!p) return { probeMissing: true, foodDom, focused: document.hasFocus(), hidden: document.hidden };
    cancelAnimationFrame(p.raf);
    for (const kind of ["pointerdown", "pointerup", "keydown", "keyup"]) document.removeEventListener(kind, p.input, true);
    return { frames: p.frames, inputs: p.inputs, visibleFocusedMs: p.visibleFocusedMs, foodDom, focused: document.hasFocus(), hidden: document.hidden };
  }).catch(error => ({ error: String(error) }));
  writeFileSync(`${directory}/${label}.json`, JSON.stringify({ build, title: info.title, status: info.status, ...evidence.get(page), finalProbe: probe }, null, 2));
  await page.screenshot({ path: `${directory}/${label}.png`, fullPage: true }).catch(() => {});
  expect(evidence.get(page)!.writes).toEqual([]); expect(evidence.get(page)!.errors).toEqual([]);
  if (probe && "inputs" in probe && probe.inputs) expect(probe.inputs.every(input => input.trusted)).toBe(true);
});

async function seed(page: Page, mode: Mode) {
  const life = mode === "social" || mode === "nuzzle" ? normalizeCompanionLife({ ...DEFAULT_COMPANION_LIFE, social: .85, curiosity: .2 })
    : mode === "cheer" ? normalizeCompanionLife({ ...DEFAULT_COMPANION_LIFE, play: .9, curiosity: .9, social: .1, comfort: .2 }) : null;
  await page.addInitScript(({ epoch, key, prefs, care, habits, life, mode }) => {
    if (localStorage.getItem("fixture.lived104")) return;
    localStorage.setItem("fixture.lived104", mode);
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    // Established saved care/preferences only. Meal/cozy deliberately use the
    // legacy snapshot so the real first-install migration chooses its own
    // random favorite. No RNG, focus, clock, brain or geometry is replaced.
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: mode !== "cozy", jump: false, sleep: mode === "cozy", feeding: mode === "meal", petting: mode !== "cheer", drag: true, personality: "affectionate", speed: "relaxed", heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, learnFromYou: true }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: life ? 3 : 2, ...care, hunger: mode === "meal" ? .65 : .1, affection: mode === "nuzzle" ? .7 : .15, energy: mode === "cozy" ? .16 : .9, curiosity: mode === "cheer" ? .1 : care.curiosity, habits, ...(life ? { life } : {}) }));
    localStorage.setItem("vic.panelSections", JSON.stringify({ version: 1, "tag-filter": false, season: false, "companion-home": true }));
    localStorage.removeItem("vic_panel_collapsed");
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, habits: DEFAULT_COMPANION_MEMORY.habits, life, mode });
}
async function setup(page: Page, surface: Surface, mode: Mode) {
  await seed(page, mode);
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
      // CSS tracks the requested semantic row. Until a packet decodes, the
      // renderer safely retains an already adopted frame. Observe its actual
      // registered data-pose rather than mislabelling that20ms fallback. A
      // row membership alone is insufficient: its metadata frame must point
      // to the atlas actually adopted by the live image's currentSrc.
      const frame: Frame = { at: now - p.began, visibleFocusedMs: p.visibleFocusedMs, focused, hidden, state: el.dataset.state ?? "", living: el.dataset.living ?? "", play: el.dataset.play ?? "", requestedRow, row, pose, atlas: adopted?.atlas ?? -1, platform: el.dataset.platform ?? "", foodGoal: el.dataset.foodGoal ?? "", episodeFood: el.dataset.episodeFood ?? "", dreaming: el.hasAttribute("data-dreaming"), decoded: Boolean(image?.complete && image.naturalWidth), registered: Boolean(adopted && rows[row]?.includes(pose) && srcMatches), src, expectedSrc, srcMatches, same: el.isConnected && el === document.querySelector(".vc-companion"), count: document.querySelectorAll(".vc-companion").length, x: m.m41 + size / 2, y: m.m42 + size };
      const signature = JSON.stringify([frame.state, frame.living, frame.play, frame.requestedRow, frame.row, frame.pose, frame.platform, frame.foodGoal, frame.dreaming, frame.decoded, frame.registered, frame.src, focused, hidden]);
      if (signature !== p.previous) { p.frames.push(frame); p.previous = signature; }
      p.raf = requestAnimationFrame(sample);
    };
    (window as unknown as ProbeWindow).livedExperience104 = p; p.raf = requestAnimationFrame(sample);
  }, { rows: companionSpriteMetadata.rows, frames: companionSpriteMetadata.frames, atlases: companionSpriteMetadata.atlases });
}
const frames = (page: Page) => page.evaluate(() => (window as unknown as ProbeWindow).livedExperience104!.frames);
async function waitVisibleFocused(page: Page, elapsed: number) {
  const started = await page.evaluate(() => (window as unknown as ProbeWindow).livedExperience104!.visibleFocusedMs);
  await expect.poll(() => page.evaluate(started => (window as unknown as ProbeWindow).livedExperience104!.visibleFocusedMs - started, started), { timeout: elapsed + 15000, intervals: [500] }).toBeGreaterThanOrEqual(elapsed);
}
function connectedCheer(observed: Frame[]): Frame[] | undefined {
  const cheer = observed.filter(frame => frame.living === "cheer" && frame.play === "cheer-rehearsal" && frame.state === "play");
  for (const [index, frame] of cheer.entries()) {
    if (frame.row !== 37) continue;
    const sequence = cheer.slice(index).filter((item, position, all) => position === 0 || item.row !== all[position - 1].row).slice(0, 3);
    if (sequence.length === 3 && sequence[1].row === 38 && sequence[2].row === 39 && sequence[2].at - frame.at < 4000) return sequence;
  }
}

async function clearFloorRay(page: Page, spread = 0) {
  return page.evaluate(spread => {
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
    const safe = (x: number) => obstacles.every(r => x + 50 < r.left || x - 50 > r.right || y + 4 < r.top || y - 96 > r.bottom);
    for (const fraction of [.62, .72, .42, .3]) { const x = Math.round(innerWidth * fraction); if (safe(x) && safe(x + 24) && safe(x - spread) && safe(x + spread)) return { x, y }; }
    throw new Error("No real unmodified clear floor ray for native placement");
  }, spread);
}
async function placeAndHold(page: Page, spread = 0) {
  const floor = await clearFloorRay(page, spread);
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
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click(); await dialog.getByRole("tab", { name: "성격", exact: true }).click();
  return dialog.getByRole("region", { name: "빅타민 특성", exact: true });
}

for (const surface of ["viewer", "studio"] as const) {
  test(`${surface}: a native meal changes only the consumed fruit and retains its real first seed through reload and settings`, async ({ page }) => {
    test.setTimeout(75000);
    await setup(page, surface, "meal"); const initial = await memory(page);
    expect(initial.version).toBe(3); expect(initial.life.favoriteFood).toBe(initial.life.seedFood);
    await openCompanionHome(page, "keyboard"); const floor = await placeAndHold(page);
    // Placement is itself a real play experience. Earn the next learning
    // credit through19 seconds of genuine visible held time, never a clock jump.
    await page.waitForTimeout(19000);
    await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); const food = page.locator(".vc-food"); await expect(food).toHaveCount(1);
    const id = (await food.getAttribute("data-food"))!, kind = (await food.getAttribute("data-kind")) as CompanionFoodKind;
    await dragFoodToFeet(page, food, { x: floor.x + 24, y: floor.y }); const before = await memory(page); evidence.get(page)!.care.push({ phase: "before-meal", value: before, id, kind });
    await actor(page).focus(); await actor(page).press("Space"); await page.mouse.move(2, 2);
    await expect(food).toHaveCount(0, { timeout: 25000 });
    await expect.poll(async () => (await memory(page)).life.foodScores[kind], { timeout: 6000 }).toBeGreaterThan(before.life.foodScores[kind] + .001);
    const after = await memory(page); evidence.get(page)!.care.push({ phase: "after-meal", value: after });
    expect(after.life.seedFood).toBe(initial.life.seedFood); expect(after.hunger).toBeLessThan(before.hunger - .25);
    for (const other of Object.keys(after.life.foodScores) as CompanionFoodKind[]) if (other !== kind) expect(Math.abs(after.life.foodScores[other] - before.life.foodScores[other])).toBeLessThan(.001);
    expect(after.life.recent).toContain(kind === before.life.favoriteFood ? "favorite-food" : "variety");
    const observed = await frames(page); expect(observed.some(frame => frame.state === "eat" && (frame.foodGoal === id || frame.episodeFood === id))).toBe(true);
    expect(observed.filter(frame => frame.foodGoal).every(frame => frame.foodGoal === id)).toBe(true);
    evidence.get(page)!.probe = await page.evaluate(() => { const p = (window as unknown as ProbeWindow).livedExperience104!; return { beforeReloadFrames: p.frames, beforeReloadInputs: p.inputs }; });
    expect((evidence.get(page)!.probe as { beforeReloadInputs: Input[] }).beforeReloadInputs.every(input => input.trusted)).toBe(true);
    await page.reload(); await page.bringToFront(); await expect(actor(page)).toBeVisible();
    await startProbe(page);
    const reopened = await memory(page); expect(reopened.life.seedFood).toBe(initial.life.seedFood); expect(reopened.life.foodScores[kind]).toBeGreaterThan(before.life.foodScores[kind] + .001);
    const traits = await openTraits(page); await expect(traits.locator(".rhh-trait-favorite strong")).toHaveText(COMPANION_FOOD_NAMES[reopened.life.favoriteFood]);
    await expect(traits.locator(".rhh-trait-reason")).not.toContainText("아직은 여러 맛과 놀이를 알아가는 중이에요.");
  });

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

  test(`${surface}: genuine active floor time naturally performs the connected native cheer rows37–39`, async ({ page }) => {
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
    expect(sequence.map(frame => frame.row)).toEqual([37, 38, 39]); expect(sequence[0].visibleFocusedMs).toBeGreaterThanOrEqual(90000);
    const performed = observed.filter(frame => frame.at >= sequence[0].at && frame.at <= sequence[2].at);
    expect(performed.length).toBeGreaterThanOrEqual(3);
    expect(performed.every(frame => frame.living === "cheer" && frame.play === "cheer-rehearsal" && frame.state === "play" && [37, 38, 39].includes(frame.row) && frame.platform === sequence[0].platform && /^viewport-floor/.test(frame.platform) && frame.same && frame.count === 1 && frame.decoded && frame.registered && frame.focused && !frame.hidden && frame.src.endsWith("/companion/hd/victamin-episodes-104-v1.webp"))).toBe(true);
    expect(Math.max(...performed.map(frame => frame.x)) - Math.min(...performed.map(frame => frame.x))).toBeLessThan(1);
    expect(Math.max(...performed.map(frame => frame.y)) - Math.min(...performed.map(frame => frame.y))).toBeLessThan(1);
    expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
    evidence.get(page)!.care.push({ phase: "after-natural-cheer", value: await memory(page) });
  });
}

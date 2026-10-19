import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { companionSpriteMetadata as registration } from "@/lib/ui/viewer-companion/sprite-quality";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const output = resolve(process.env.COMPANION_CARE_131_OUTPUT ?? ".scratch-pw/companion-131/care");
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
type Rect = { x: number; y: number; width: number; height: number; right: number; bottom: number };
type Item = { id: string; food: boolean; x: number; y: number; rect: Rect; platform: string; held: boolean; carried: boolean; falling: boolean; hidden: boolean; angle: number };
type Frame = { at: number; phase: string; focused: boolean; hidden: boolean; down: number; same: boolean; actor: { x: number; y: number; state: string; platform: string; row: number; pose: number; petting: string; textures: { src: string; complete: boolean }[] } | null; seat: Rect | null; floor: Rect | null; badge: Rect | null; items: Item[] };
type Input = { at: number; type: string; key: string; x: number; y: number; trusted: boolean; food: string | null; toy: string | null };
type Probe = { frames: Frame[]; inputs: Input[]; phase: string; initial: { preferences: string | null; care: string | null; tastes: string | null; collection: string | null }; stop: () => void };
type ProbeWindow = Window & { care131?: Probe };
const proofs = new WeakMap<Page, { writes: string[]; foreign: string[]; errors: string[]; notes: unknown[] }>();

test.use({ headless: true, viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", isMobile: false, hasTouch: false, storageState: { cookies: [], origins: [] }, video: { mode: "on", size: { width: 1920, height: 1100 } } });
test.setTimeout(65000);
test.beforeEach(async ({ page }, info) => {
  const proof = { writes: [] as string[], foreign: [] as string[], errors: [] as string[], notes: [] as unknown[] }; proofs.set(page, proof);
  const origin = new URL(info.project.use.baseURL as string).origin;
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 503, body: "Fixture forbids writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "Fixture has no live/private API" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const observed = await page.evaluate(() => { const probe = (window as ProbeWindow).care131; probe?.stop(); return probe ? { frames: probe.frames, inputs: probe.inputs, initial: probe.initial } : null; }).catch(() => null);
  const name = info.title.replace(/[^a-z0-9]+/gi, "-"); mkdirSync(output, { recursive: true });
  const path = resolve(output, `${name}.json`), videoSource = await page.video()?.path();
  writeFileSync(path, JSON.stringify({ build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), status: info.status, proof: proofs.get(page), observed, videoSource,
    scope: "Production-build fixture; native input and bounded read-only display samples at a target30Hz. Actual timestamps and original Playwright video are retained; encoded video frame rate is not asserted. No prior care/tastes/discoveries, RNG, clock, geometry, style, focus replacement or application callback injection. Saved device choices are described per case; not broadcaster hardware evidence." }, null, 2));
  await info.attach("care-131-native", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, `${name}.png`) }).catch(() => {});
  expect(proofs.get(page)!.writes).toEqual([]); expect(proofs.get(page)!.foreign).toEqual([]); expect(proofs.get(page)!.errors).toEqual([]);
});

async function prepare(page: Page, fresh = false) {
  await page.addInitScript(({ epoch, epochKey, preferences, fresh, rows }) => {
    const initial = { preferences: localStorage.getItem("vic.viewerCompanion"), care: localStorage.getItem("vic.viewerCompanionCare"), tastes: localStorage.getItem("vic.viewerCompanionTastes"), collection: localStorage.getItem("vic.viewerCompanionCollection") };
    // A fresh browser context supplies no prior companion state. The refresh
    // case writes only an explicit saved ON choice; an actual first visit may
    // persist its own real care before the subsequent native reload.
    if (fresh) { if (initial.preferences === null) localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: true })); }
    else localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, sleep: false, feeding: true, activeWhileVisible: true, learnFromYou: false, sound: false }));
    // Graphics/audio/layout are saved device choices, not a chosen actor pose,
    // food kind, toy kind, life state, RNG result or counterfeit elapsed time.
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
    const frames: Frame[] = [], inputs: Input[] = []; let request = 0, stopped = false, last = -Infinity, down = 0, firstActor: Element | null = null;
    const rect = (node: Element | null): Rect | null => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
    const input = (event: Event) => {
      if (inputs.length >= 3000) return;
      const pointer = event as PointerEvent, target = event.target instanceof Element ? event.target.closest<HTMLElement>(".vc-food,.vc-toy") : null;
      if (event.type === "pointerdown") down++;
      inputs.push({ at: performance.now(), type: event.type, key: event instanceof KeyboardEvent ? event.key : "", x: pointer.clientX ?? 0, y: pointer.clientY ?? 0, trusted: event.isTrusted, food: target?.dataset.food ?? null, toy: target?.dataset.toyId ?? null });
    };
    const sample = (at: number) => {
      if (stopped) return;
      if (at - last >= 32) {
        last = at; const node = document.querySelector<HTMLElement>(".vc-companion"), r = rect(node), matrix = node ? new DOMMatrixReadOnly(getComputedStyle(node).transform) : null;
        if (node && !firstActor) firstActor = node;
        const size = node ? parseFloat(node.style.getPropertyValue("--vc-size")) || 92 : 92;
        frames.push({ at, phase: probe.phase, focused: document.hasFocus(), hidden: document.hidden || !node || node.hidden || !r?.width || !r.height, down, same: !node || node === firstActor,
          actor: node && matrix ? { x: matrix.m41 + size / 2, y: matrix.m42 + size, state: node.dataset.state ?? "", platform: node.dataset.platform ?? "", row: Math.round(parseFloat(node.style.getPropertyValue("--vc-row")) / 100 * (rows - 1)), pose: Number(node.dataset.pose), petting: node.dataset.petting ?? "", textures: [...node.querySelectorAll<HTMLImageElement>(".vc-sprite > .vc-texture")].map(image => ({ src: image.currentSrc || image.src, complete: image.complete && image.naturalWidth > 0 })) } : null,
          seat: rect(document.querySelector(".vc-home-cushion")), floor: rect(document.querySelector(".vc-home-floor")), badge: rect(document.querySelector(".studio-build-copy")),
          items: [...document.querySelectorAll<HTMLElement>(".vc-food,.vc-toy")].map(item => { const food = item.matches(".vc-food"), box = rect(item)!, transform = new DOMMatrixReadOnly(getComputedStyle(item).transform), art = food ? item.firstElementChild : item.querySelector("img"), local = art ? new DOMMatrixReadOnly(getComputedStyle(art).transform) : new DOMMatrixReadOnly(); return { id: item.dataset.food ?? item.dataset.toyId ?? "", food, x: food ? transform.m41 : box.x + box.width / 2, y: food ? transform.m42 : box.bottom, rect: box, platform: item.dataset.platform ?? "", held: food ? item.hasAttribute("data-selected") : item.dataset.held === "true", carried: food ? item.hasAttribute("data-carried") : item.dataset.carried === "true", falling: food ? item.hasAttribute("data-falling") : item.dataset.falling === "true", hidden: item.hidden || box.width <= 0 || box.height <= 0, angle: Math.atan2(local.b, local.a) * 180 / Math.PI }; }),
        });
      }
      if (frames.length < 2400) request = requestAnimationFrame(sample);
    };
    const probe: Probe = { frames, inputs, initial, phase: "loading", stop: () => { stopped = true; cancelAnimationFrame(request); for (const type of ["pointerdown", "pointermove", "pointerup", "keydown", "keyup"]) document.removeEventListener(type, input, true); } };
    (window as ProbeWindow).care131 = probe;
    for (const type of ["pointerdown", "pointermove", "pointerup", "keydown", "keyup"]) document.addEventListener(type, input, true);
    request = requestAnimationFrame(sample);
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, fresh, rows: registration.rows.length });
}
const frames = (page: Page) => page.evaluate(() => (window as ProbeWindow).care131!.frames);
// Observation labels belong only to this harness, never to application state.
const phase = (page: Page, value: string) => page.evaluate(value => { (window as ProbeWindow).care131!.phase = value; }, value);
async function ready(page: Page, studio = false) {
  await page.goto(studio ? "/visual-fixture/studio?role=owner&y=2025&m=11" : "/visual-fixture/poster?avatar=1"); await page.bringToFront();
  await page.evaluate(() => document.fonts.ready); await expect(pet(page)).toBeVisible();
  // Full is the production default and intentionally omits data-gfx.
  await expect.poll(() => page.locator("html").evaluate(node => (node as HTMLElement).dataset.gfx ?? "full")).toBe("full");
  await expect.poll(async () => await home(page).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  const room = await openCompanionHome(page);
  await room.evaluate(async node => { for (let element: Element | null = node; element; element = element.parentElement) await Promise.allSettled(element.getAnimations().filter(animation => Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
}
async function hold(page: Page, held: boolean) {
  if ((await pet(page).getAttribute("data-state") === "held") !== held) { await actor(page).focus(); await actor(page).press("Space"); }
  if (held) await expect(pet(page)).toHaveAttribute("data-state", "held"); else await expect(pet(page)).not.toHaveAttribute("data-state", "held");
}
async function strokes(page: Page, count = 84) {
  const point = await pet(page).evaluate(node => { const rect = node.getBoundingClientRect(); return { x: rect.x + rect.width / 2, y: rect.bottom - rect.width * .45 }; });
  for (let index = 0; index < count; index++) { await page.mouse.move(point.x + Math.sin(index * Math.PI / 8) * 14, point.y); await page.waitForTimeout(32); }
}
const visibleActor = (trace: Frame[]) => trace.filter(frame => !frame.hidden && frame.actor);
function verifyFirstHome(frame: Frame) {
  const point = frame.actor!; expect(point.platform).toMatch(/^companion-home(?:-floor(?:-\d+)?)?$/);
  const surface = point.platform === "companion-home" ? frame.seat : frame.floor; expect(surface).not.toBeNull();
  expect(point.x).toBeGreaterThanOrEqual(surface!.x); expect(point.x).toBeLessThanOrEqual(surface!.right);
  expect(Math.abs(point.y - (point.platform === "companion-home" ? surface!.y : surface!.bottom - COMPANION_HOME_FLOOR_INSET))).toBeLessThan(1);
}

test("131 fresh refresh shows its first real resident inside the actual home without prior care", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 }); await prepare(page, true);
  await ready(page); await expect.poll(async () => visibleActor(await frames(page)).length).toBeGreaterThan(0);
  const first = visibleActor(await frames(page))[0]; expect(first).toBeDefined(); verifyFirstHome(first);
  const original = await page.evaluate(() => ({ initial: (window as ProbeWindow).care131!.initial, persistedActualCare: localStorage.getItem("vic.viewerCompanionCare"), frames: (window as ProbeWindow).care131!.frames }));
  expect(original.initial.preferences).toBeNull(); expect(original.initial.care).toBeNull(); expect(original.initial.tastes).toBeNull(); expect(original.initial.collection).toBeNull();
  proofs.get(page)!.notes.push({ firstNavigation: original, syntheticPriorCare: false, savedCompanionChoice: "version1 enabled:true only" });
  await page.reload({ waitUntil: "domcontentloaded" }); await page.bringToFront(); await expect(pet(page)).toBeVisible(); await expect.poll(async () => visibleActor(await frames(page)).length).toBeGreaterThan(0);
  const refreshed = visibleActor(await frames(page))[0]; expect(refreshed).toBeDefined(); verifyFirstHome(refreshed);
  proofs.get(page)!.notes.push({ actualReloadFirstVisible: refreshed, reloadRetainsOnlyActualSessionHistory: await page.evaluate(() => (window as ProbeWindow).care131!.initial) });
});

test("131 native smiling strokes keep decoded row9 and continue after real focus leaves without a schedule click", async ({ page }) => {
  await prepare(page); await ready(page); await placeCompanionOnHomeFloor(page);
  const sofa = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true }); await sofa.focus(); await sofa.press("Enter"); await page.mouse.move(2, 2);
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 25000 }); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await phase(page, "resident-strokes"); await strokes(page); await page.mouse.move(2, 2);
  const smiling = visibleActor(await frames(page)).filter(frame => frame.phase === "resident-strokes" && frame.actor!.state === "petted" && frame.actor!.row === 9 && registration.rows[9].includes(frame.actor!.pose));
  expect(smiling.length).toBeGreaterThan(12); expect(new Set(smiling.map(frame => frame.actor!.pose)).size).toBeGreaterThan(4);
  for (const frame of smiling) { expect(frame.same).toBe(true); expect(frame.actor!.textures).toHaveLength(1); expect(frame.actor!.textures[0].complete).toBe(true); expect(new URL(frame.actor!.textures[0].src).pathname).toBe(registration.atlases[registration.frames[frame.actor!.pose].atlas].src); }
  const peer = await page.context().newPage();
  try {
    await peer.setContent("<button style='width:200px;height:100px'>Other window</button>");
    const targetNative = await page.context().newCDPSession(page), peerNative = await page.context().newCDPSession(peer);
    // Remove Playwright's permanent focus override, without emulating a
    // desired result or replacing document.hasFocus/window input handlers.
    await targetNative.send("Emulation.setFocusEmulationEnabled", { enabled: false }); await peerNative.send("Emulation.setFocusEmulationEnabled", { enabled: false });
    await peer.bringToFront(); await peer.getByRole("button").click();
    const before = await page.evaluate(() => ({ focused: document.hasFocus(), hidden: document.hidden, down: (window as ProbeWindow).care131!.frames.at(-1)?.down ?? 0 }));
    expect(before.focused).toBe(false); expect(before.hidden).toBe(false); await phase(page, "first-hover-after-focus"); await strokes(page);
    const returned = visibleActor(await frames(page)).filter(frame => frame.phase === "first-hover-after-focus");
    expect(returned.every(frame => frame.down === before.down && frame.same)).toBe(true);
    expect(returned.some(frame => frame.actor!.state === "petted" && frame.actor!.petting !== "" && registration.rows[9].includes(frame.actor!.pose))).toBe(true);
    proofs.get(page)!.notes.push({ realFocusBefore: before, firstStrokesNoTargetPointerDown: true, actuallyUnfocusedSamples: returned.filter(frame => !frame.focused).length, scope: "Native mouse transport can activate the target tab. This does not prove continuously unfocused OS-window input or hardware OBS." });
  } finally { await peer.close(); }
});

test("131 a native toy released below the real studio badge stays present and reacquires a measured viewport floor", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 1100 }); await prepare(page); await ready(page, true); await hold(page, true);
  await home(page).locator('[data-home-action="toys"]').click(); const toy = page.locator(".vc-toy").first(); await expect(toy).toBeVisible(); await expect(toy).toHaveAttribute("data-falling", "false");
  const id = await toy.getAttribute("data-toy-id"), badge = page.locator(".studio-build-copy"); await expect(badge).toBeVisible();
  const actualBadge = (await badge.boundingBox())!, viewport = page.viewportSize()!, release = { x: actualBadge.x + actualBadge.width / 2, y: Math.min(viewport.height - 2, actualBadge.y + actualBadge.height + 6) };
  const from = (await toy.boundingBox())!; await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
  await page.mouse.move(release.x, release.y - 1, { steps: 18 }); await page.waitForTimeout(160); await phase(page, "below-badge-release"); await page.mouse.move(release.x, release.y); await page.mouse.up(); await page.mouse.move(2, 2);
  await page.waitForTimeout(2700); await expect(toy).toHaveCount(1); await expect(toy).toBeVisible(); await expect(toy).toHaveAttribute("data-toy-id", id!);
  const beforeResize = (await frames(page)).filter(frame => frame.phase === "below-badge-release");
  expect(beforeResize.some(frame => frame.items.some(item => item.id === id && item.platform === "" && item.falling))).toBe(true);
  expect(beforeResize.every(frame => frame.items.some(item => item.id === id && !item.hidden))).toBe(true);
  const last = beforeResize.at(-1)!.items.find(item => item.id === id)!;
  if (last.platform) { expect(last.platform).toMatch(/^viewport-floor(?:-food)?(?:-\d+)?$/); expect(last.rect.right <= actualBadge.x || last.rect.x >= actualBadge.x + actualBadge.width || last.rect.bottom <= actualBadge.y || last.rect.y >= actualBadge.y + actualBadge.height).toBe(true); }
  proofs.get(page)!.notes.push({ actualBadge, actualRelease: release, retainedAfterOldTwoSecondLimit: last, pendingWithoutInventedFloor: last.platform === "" });
  await phase(page, "native-width-resize"); await page.setViewportSize({ width: 1920, height: 1100 });
  await expect(toy).toHaveAttribute("data-platform", /^viewport-floor(?:-food)?(?:-\d+)?$/, { timeout: 6000 }); await expect(toy).toHaveAttribute("data-falling", "false"); await expect(toy).toHaveAttribute("data-toy-id", id!); await expect(toy).toBeVisible();
  const settled = (await toy.boundingBox())!, currentBadge = (await badge.boundingBox())!;
  expect(settled.width).toBeCloseTo(44, 2); expect(settled.height).toBeCloseTo(44, 2);
  expect(settled.x + settled.width <= currentBadge.x || settled.x >= currentBadge.x + currentBadge.width || settled.y + settled.height <= currentBadge.y || settled.y >= currentBadge.y + currentBadge.height).toBe(true);
  await hold(page, false);
});

test("131 actual food release follows a native parabola and a later stationary drop visibly flutters", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 1100 }); await prepare(page); await ready(page, true); await hold(page, true);
  await home(page).locator('[data-home-action="feed"]').click(); const food = page.locator(".vc-food").first(); await expect(food).toBeVisible(); await expect(food).not.toHaveAttribute("data-falling");
  const id = await food.getAttribute("data-food"), panel = (await page.locator(".avatar-dock-inner:visible").boundingBox())!, floor = (await home(page).locator(".vc-home-floor").boundingBox())!;
  const start = { x: panel.x + panel.width * .5, y: Math.max(panel.y + 90, floor.y + floor.height + 110) }; expect(start.y).toBeLessThan(page.viewportSize()!.height - 180);
  const begin = (await food.boundingBox())!; await page.mouse.move(begin.x + begin.width / 2, begin.y + begin.height / 2); await page.mouse.down(); await page.mouse.move(start.x, start.y, { steps: 14 }); await page.waitForTimeout(160);
  await phase(page, "native-food-throw");
  for (let step = 1; step <= 7; step++) { await page.mouse.move(start.x + step * 6, start.y - step * 7); await page.waitForTimeout(16); }
  await page.mouse.up(); await page.mouse.move(2, 2); await expect(food).toHaveAttribute("data-falling", ""); await expect(food).not.toHaveAttribute("data-falling", { timeout: 6000 });
  const raw = await page.evaluate(id => { const probe = (window as ProbeWindow).care131!; return { inputs: probe.inputs.filter(input => input.food === id && input.type === "pointerup"), frames: probe.frames }; }, id);
  const released = raw.inputs.at(-1)!; expect(released.trusted).toBe(true);
  const early = raw.frames.filter(frame => frame.phase === "native-food-throw" && frame.at >= released.at && frame.at <= released.at + 230).flatMap(frame => frame.items.filter(item => item.id === id && item.falling).map(item => ({ at: frame.at, ...item }))).filter((point, index, all) => index === 0 || Math.abs(point.x - all[index - 1].x) > .1);
  expect(early.length).toBeGreaterThanOrEqual(5); const first = early[0], middle = early[Math.floor(early.length / 2)], last = early.at(-1)!, u = middle.x - first.x, v = last.x - first.x;
  expect(v).toBeGreaterThan(20); const a = ((last.y - first.y) / v - (middle.y - first.y) / u) / (v - u), b = (middle.y - first.y) / u - a * u;
  const residuals = early.map(point => point.y - (first.y + b * (point.x - first.x) + a * (point.x - first.x) ** 2));
  expect(a).toBeGreaterThan(0); expect(Math.sqrt(residuals.reduce((sum, value) => sum + value ** 2, 0) / residuals.length)).toBeLessThan(2);
  expect(early.some(point => point.y < first.y - 2)).toBe(true); expect(early.some((point, index) => index > 0 && point.y > early[index - 1].y + .1)).toBe(true);
  for (const point of early) { expect(point.rect.width).toBeCloseTo(44, 2); expect(point.rect.height).toBeCloseTo(44, 2); }
  const second = (await food.boundingBox())!; await page.mouse.move(second.x + second.width / 2, second.y + second.height / 2); await page.mouse.down();
  const ordinary = { x: panel.x + panel.width * .35, y: Math.max(panel.y + 55, floor.y + floor.height + 90) }; await page.mouse.move(ordinary.x, ordinary.y, { steps: 16 }); await page.waitForTimeout(180); await phase(page, "stationary-food-drop"); await page.mouse.up(); await page.mouse.move(2, 2);
  await expect(food).toHaveAttribute("data-falling", ""); await expect(food).not.toHaveAttribute("data-falling", { timeout: 6000 });
  const flutter = (await frames(page)).filter(frame => frame.phase === "stationary-food-drop").flatMap(frame => frame.items.filter(item => item.id === id && item.falling));
  expect(flutter.length).toBeGreaterThanOrEqual(6); expect(flutter.some(item => item.angle > 1)).toBe(true); expect(flutter.some(item => item.angle < -1)).toBe(true);
  for (const point of flutter) { expect(point.rect.width).toBeCloseTo(44, 2); expect(point.rect.height).toBeCloseTo(44, 2); }
  await expect(food).toHaveAttribute("data-food", id!); await expect(food).toBeVisible();
  proofs.get(page)!.notes.push({ actualPanel: panel, actualNativeThrowRelease: released, observedParabola: { a, b, residuals, samples: early }, actualStationaryRelease: ordinary, flutterAngles: flutter.map(item => item.angle), forcedVelocityOrClock: false });
  await hold(page, false);
});

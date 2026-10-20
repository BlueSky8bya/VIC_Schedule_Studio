import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_FOOD_KINDS, type CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";
import { COMPANION_TOY_USES, companionToyPlayDuration } from "@/lib/ui/viewer-companion/toy-play";
import { COMPANION_FOOD_AFTERTASTES } from "@/lib/ui/viewer-companion/food-aftertaste";
import type { CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

const output = process.env.COMPANION149_OBJECTS_OUTPUT ?? ".scratch-pw/companion-149/objects-native-observations";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const hash = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
type Toy = { id: string; kind: string; use: string; carried: boolean; held: boolean; falling: boolean; decoded: boolean; visible: boolean; x: number; y: number; rotation: number; transform: string; scale: string; effect: string };
type Frame = { at: number; state: string; play: string; aftertaste: string; homeLife: string; platform: string; scene: string; placing: boolean; actorDecoded: boolean; row: number; x: number; y: number; home: { light: boolean; tv: string; night: boolean; contact: boolean }; toys: Toy[]; foods: { id: string; kind: string; eating: boolean; discarding: boolean }[] };
type ObjectWindow = Window & { objects149?: { frames: Frame[]; meals: { at: number; kind: string }[]; discoveries: { at: number; toys: string[] }[]; stop(): void } };
type Proof = { errors: string[]; rejected: string[]; build: string; notes: unknown[]; html?: { path: string; sha256: string }; chunks: { path: string; sha256: string; matchesBuild: boolean }[]; pending: Promise<void>[] };
const proofs = new WeakMap<Page, Proof>();
test.use({ viewport: { width: 1920, height: 1100 }, storageState: { cookies: [], origins: [] }, serviceWorkers: "block", trace: "on", video: { mode: "on", size: { width: 1920, height: 1100 } } });
test.setTimeout(110000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const buildRoot = process.env.VISUAL_TEST_BUILD_DIR ?? ".next", proof: Proof = { errors: [], rejected: [], build: readFileSync(resolve(buildRoot, "BUILD_ID"), "utf8").trim(), notes: [], chunks: [], pending: [] }; proofs.set(page, proof);
  const origin = new URL(baseURL!).origin;
  const actions = JSON.parse(readFileSync(resolve(buildRoot, "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previews = new Set(Object.entries(actions).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("pageerror", error => proof.errors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.origin !== origin || !url.pathname.startsWith("/_next/static/") || !/\.(js|css)$/.test(url.pathname)) return;
    proof.pending.push((async () => { const bytes = await response.body(), local = readFileSync(resolve(buildRoot, url.pathname.slice("/_next/".length))); proof.chunks.push({ path: url.pathname, sha256: hash(bytes), matchesBuild: bytes.equals(local) }); })().catch(error => { proof.errors.push("Chunk proof: " + String(error)); }));
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
  const observations = await page.evaluate(() => { const probe = (window as ObjectWindow).objects149; probe?.stop(); return probe ? { frames: probe.frames, meals: probe.meals, discoveries: probe.discoveries } : { frames: [], meals: [], discoveries: [] }; }).catch(() => ({ frames: [], meals: [], discoveries: [] }));
  const proof = proofs.get(page)!; await Promise.all(proof.pending); const { pending, ...summary } = proof; void pending;
  const name = info.title.replace(/[^a-z0-9]+/gi, "-"); mkdirSync(output, { recursive: true });
  const file = resolve(output, name + ".json"); writeFileSync(file, JSON.stringify({ schemaVersion: 1, ...summary, status: info.status, recordedAt: new Date().toISOString(), ...observations,
    scope: "Actual local native UI random objects and real input. Initial synthetic saved preferences/care/collection/tastes and house-light choice only; no runtime, RNG, clock, geometry, brain or action replacement. Studio house time uses its existing hour fixture query; TV uses real clicks and the real fifteen-second priority wait. Read-only DOM and event observations. Actual sampled kinds are separate from all84-toy/five-aftertaste pure coverage; unsampled rare kinds remain unrun. No operating DB/login/writes or daily-factory exhaustive claim." }, null, 2));
  await info.attach("native-objects-149", { path: file, contentType: "application/json" }); await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.chunks.length).toBeGreaterThan(5); expect(proof.chunks.every(chunk => chunk.matchesBuild)).toBe(true);
});

type HouseScenario = { personality: CompanionPersonality; energy: number; sleep: boolean; hour: number; light: boolean };
async function setup(page: Page, surface: "viewer" | "studio" | "preview", feeding = false, house?: HouseScenario) {
  await page.addInitScript(({ preferences, memory, feeding, foods, epoch, key, house }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, personality: house?.personality ?? (feeding ? "gourmet" : "mischievous"), personalitySource: "manual", roam: false, feeding, sleep: false, petting: false, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false, speed: "lively" }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: house?.energy ?? .95, hunger: feeding ? .95 : .05 }));
    if (house) localStorage.setItem("vic.companionHomeLight.v1", JSON.stringify({ version: 1, lit: house.light }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: feeding ? foods : [], behaviors: [], situations: [], gifts: { unlocked: [], equipped: null, pending: null } }));
    localStorage.setItem("vic.viewerCompanionTastes", JSON.stringify({ version: 1, toys: [], seen: [], toyTastes: {}, foodTastes: {}, reasons: [] }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, feeding, foods: COMPANION_FOOD_KINDS, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY, house });
  const response = await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : `/visual-fixture/studio?role=owner&y=2025&m=10&hour=${house?.hour ?? 12}&weather=clear`);
  const html = await response!.body(), proof = proofs.get(page)!; mkdirSync(output, { recursive: true });
  const path = resolve(output, `${test.info().title.replace(/[^a-z0-9]+/gi, "-")}-actual.html`); writeFileSync(path, html); proof.html = { path, sha256: hash(html) }; expect(html.toString("utf8")).toContain(proof.build);
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  await expect(page.locator(".vc-companion")).toBeVisible(); await openCompanionHome(page); await placeCompanionOnHomeFloor(page); await page.mouse.move(2, 2);
}
async function startRoaming(page: Page, enableAutomaticSleep = false) {
  const home = await openCompanionHome(page); await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "움직임", exact: true }).click();
  const roam = dialog.getByRole("switch", { name: "빅타민 돌아다니기 켜기/끄기", exact: true }); await expect(roam).toHaveAttribute("aria-checked", "false"); await roam.click(); await expect(roam).toHaveAttribute("aria-checked", "true");
  if (enableAutomaticSleep) { const sleep = dialog.getByRole("switch", { name: "빅타민 자동 잠자기 켜기/끄기", exact: true }); await expect(sleep).toHaveAttribute("aria-checked", "false"); await sleep.click(); await expect(sleep).toHaveAttribute("aria-checked", "true"); }
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden(); await page.mouse.move(2, 2);
}
async function probe(page: Page) {
  await page.evaluate(() => {
    (window as ObjectWindow).objects149?.stop(); const frames: Frame[] = [], meals: { at: number; kind: string }[] = [], discoveries: { at: number; toys: string[] }[] = [];
    const began = performance.now(); let request = 0, stopped = false;
    const meal = (event: Event) => meals.push({ at: performance.now() - began, kind: String((event as CustomEvent<{ kind?: string }>).detail?.kind ?? "") });
    const discovery = (event: Event) => { const detail = (event as CustomEvent<{ toys?: string[] }>).detail; discoveries.push({ at: performance.now() - began, toys: detail?.toys ?? [] }); };
    window.addEventListener("vic:companion-consumed-food", meal); window.addEventListener("vic:companion-tastes", discovery);
    const sample = () => {
      if (stopped) return; const actor = document.querySelector<HTMLElement>(".vc-companion"), image = actor?.querySelector<HTMLImageElement>(".vc-texture"), transform = new DOMMatrixReadOnly(actor?.style.transform), size = parseFloat(actor?.style.getPropertyValue("--vc-size") ?? "92");
      const toys: Toy[] = [...document.querySelectorAll<HTMLElement>(".vc-toy")].map(node => {
        const image = node.querySelector<HTMLImageElement>(".vc-toy-art"), rect = node.getBoundingClientRect(), css = getComputedStyle(node), matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
        return { id: node.dataset.toyId ?? "", kind: node.dataset.kind ?? "", use: node.dataset.toyUse ?? "", carried: node.dataset.carried === "true", held: node.dataset.held === "true", falling: node.dataset.falling === "true", decoded: Boolean(image?.complete && image.naturalWidth), visible: Boolean(!node.hidden && !node.closest("[hidden],[inert]") && rect.width > 0 && rect.height > 0 && css.display !== "none" && css.visibility === "visible" && rect.right > 0 && rect.left < innerWidth && rect.bottom > 0 && rect.top < innerHeight), x: matrix.m41, y: matrix.m42, rotation: Math.atan2(matrix.b, matrix.a) * 180 / Math.PI, transform: node.style.transform, scale: node.style.getPropertyValue("--vc-toy-play-scale"), effect: node.dataset.playEffect ?? "" };
      });
      const room = document.querySelector<HTMLElement>(".vc-home-room"), tool = document.querySelector<HTMLElement>(".vc-home-touch-tool");
      frames.push({ at: performance.now() - began, state: actor?.dataset.state ?? "", play: actor?.dataset.play ?? "", aftertaste: actor?.dataset.foodAftertaste ?? "", homeLife: actor?.dataset.homeLife ?? "", platform: actor?.dataset.platform ?? "", scene: actor?.dataset.personalityScene ?? "", placing: Boolean(actor?.hasAttribute("data-placing")), actorDecoded: Boolean(image?.complete && image.naturalWidth), row: Math.round(parseFloat(actor?.style.getPropertyValue("--vc-row") ?? "0") * 40 / 100), x: transform.m41 + size / 2, y: transform.m42 + size, home: { light: Boolean(room?.hasAttribute("data-lamp-lit")), tv: room?.dataset.tv ?? "", night: Boolean(room?.hasAttribute("data-night")), contact: Boolean(tool && !tool.hidden && tool.getBoundingClientRect().width > 0 && getComputedStyle(tool).visibility === "visible") }, toys, foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(node => ({ id: node.dataset.food ?? "", kind: node.dataset.kind ?? "", eating: node.hasAttribute("data-eating"), discarding: node.hasAttribute("data-discarding") })) });
      request = requestAnimationFrame(sample);
    };
    request = requestAnimationFrame(sample); (window as ObjectWindow).objects149 = { frames, meals, discoveries, stop() { stopped = true; cancelAnimationFrame(request); window.removeEventListener("vic:companion-consumed-food", meal); window.removeEventListener("vic:companion-tastes", discovery); } };
  });
}
const read = (page: Page) => page.evaluate(() => { const probe = (window as ObjectWindow).objects149!; return { frames: probe.frames, meals: probe.meals, discoveries: probe.discoveries }; });
const knownToys = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionTastes") ?? "{}").toys ?? [] as string[]);
async function prepareToy(page: Page, surface: "viewer" | "studio" | "preview") {
  await setup(page, surface); const home = await openCompanionHome(page); await home.getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
  const toy = page.locator(".vc-toy"); await expect(toy).toHaveCount(1); await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 10000 });
  const id = (await toy.getAttribute("data-toy-id"))!, kind = (await toy.getAttribute("data-kind"))! as CompanionToyKind;
  expect(await knownToys(page)).toEqual([]); await probe(page); await startRoaming(page);
  await expect(toy).toHaveAttribute("data-toy-use", COMPANION_TOY_USES[kind], { timeout: 65000 }); await expect(toy).toHaveAttribute("data-carried", "true");
  return { toy, id, kind };
}
for (const surface of ["studio", "viewer", "preview"] as const) test(`149 objects ${surface} random real toy completes its own use and collection`, async ({ page }) => {
  const { toy, id, kind } = await prepareToy(page, surface);
  await expect(toy).not.toHaveAttribute("data-toy-use", /.+/, { timeout: 6500 }); await expect.poll(() => knownToys(page)).toContain(kind); await page.waitForTimeout(300);
  const observed = await read(page), used = observed.frames.filter(frame => frame.toys.some(item => item.id === id && item.use === COMPANION_TOY_USES[kind] && item.carried));
  expect(used.length).toBeGreaterThan(15); expect(used.at(-1)!.at - used[0].at).toBeGreaterThan(companionToyPlayDuration(kind) - 220);
  const actual = used.map(frame => frame.toys.find(item => item.id === id)!);
  expect(actual.every(item => item.kind === kind && item.visible && item.decoded)).toBe(true); expect(new Set(actual.map(item => item.transform)).size).toBeGreaterThan(4);
  expect(Math.max(...used.map(frame => frame.x)) - Math.min(...used.map(frame => frame.x))).toBeLessThan(1); expect(Math.max(...used.map(frame => frame.y)) - Math.min(...used.map(frame => frame.y))).toBeLessThan(1);
  await expect(toy).toHaveCount(1); await expect(toy).toHaveAttribute("data-carried", "false");
  proofs.get(page)!.notes.push({ sampledKind: kind, sampledUse: COMPANION_TOY_USES[kind], sameRealToyId: id, actualUseFrames: used.length, actualUseMs: used.at(-1)!.at - used[0].at, allOtherUnselectedKindsNativeUnrun: true });
});
test("149 objects native body grab interrupts the first real toy use without a fake discovery", async ({ page }) => {
  const { toy, id, kind } = await prepareToy(page, "viewer");
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), box = (await actor.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2 - 25, { steps: 5 });
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", "held"); await expect(toy).not.toHaveAttribute("data-toy-use", /.+/); await expect(toy).toHaveAttribute("data-carried", "false");
  expect(await knownToys(page)).not.toContain(kind); await expect(toy).toHaveCSS("--vc-toy-play-scale", "1");
  await page.mouse.up(); await page.waitForTimeout(400); expect(await knownToys(page)).not.toContain(kind); await expect(toy).toHaveCount(1);
  proofs.get(page)!.notes.push({ sampledKind: kind, sameRealToyId: id, interruption: "native pointer grab of actor", noCompletedUseClaim: true });
});
test("149 objects actual random meal consumes once and only the eligible tasted recipe reacts", async ({ page }) => {
  await setup(page, "viewer", true); const home = await openCompanionHome(page); await home.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  const food = page.locator(".vc-food"); await expect(food).toHaveCount(1); const id = (await food.getAttribute("data-food"))!, kind = (await food.getAttribute("data-kind"))! as CompanionFoodKind;
  await probe(page); await startRoaming(page); await expect(food).toHaveAttribute("data-eating", "", { timeout: 65000 }); await expect(food).toHaveCount(0, { timeout: 12000 });
  const reaction = (COMPANION_FOOD_AFTERTASTES as Partial<Record<CompanionFoodKind, string>>)[kind];
  if (reaction) {
    await expect(page.locator(".vc-companion")).toHaveAttribute("data-food-aftertaste", reaction); await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-food-aftertaste", /.+/, { timeout: 4500 });
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCollection") ?? "{}").behaviors ?? [])).toContain("odd-food-reaction");
  } else await page.waitForTimeout(2400);
  const observed = await read(page), meal = observed.meals.find(event => event.kind === kind); expect(meal).toBeTruthy();
  expect(observed.frames.some(frame => frame.foods.some(item => item.id === id && item.eating && !item.discarding))).toBe(true);
  const nextMeal = observed.meals.find(event => event.at > meal!.at + 10), interval = observed.frames.filter(frame => frame.at >= meal!.at && (!nextMeal || frame.at < nextMeal.at));
  if (!reaction) { expect(interval.every(frame => !frame.aftertaste)).toBe(true); expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCollection") ?? "{}").behaviors ?? [])).not.toContain("odd-food-reaction"); }
  proofs.get(page)!.notes.push({ actualConsumedKind: kind, actualFoodId: id, expectedAftertaste: reaction ?? "none", actualConsumeEventsForKind: observed.meals.filter(event => event.kind === kind).length, unusualRecipesNotDrawnNativeUnrun: Object.keys(COMPANION_FOOD_AFTERTASTES).filter(food => food !== kind) });
});

const contactBefore = (frames: Frame[], at: number) => frames.some(frame => frame.at <= at && frame.at >= at - 650 && frame.home.contact && frame.actorDecoded);
async function nativeNatureTvAndPriorityWait(page: Page) {
  const room = page.locator(".vc-home-room"), tv = page.locator('.vc-home [data-home-action="tv"]');
  await expect(room).toHaveAttribute("data-tv", "off"); await tv.click(); await expect(room).toHaveAttribute("data-tv", "tori");
  await tv.click(); await expect(room).toHaveAttribute("data-tv", "nature");
  // Real user TV input owns15 seconds. This wall-time wait preserves it;
  // no fake clock or session-store setter is used to bypass the guard.
  await page.waitForTimeout(15500);
}
for (const personality of ["tidy", "gourmet"] as const) test(`149 objects night awake ${personality} reaches the lamp then resumes living`, async ({ page }) => {
  await setup(page, "studio", false, { personality, energy: .95, sleep: false, hour: 0, light: false });
  const room = page.locator(".vc-home-room"), lamp = page.locator('.vc-home [data-home-action="light"]');
  await expect(room).toHaveAttribute("data-night", "true"); await expect(lamp).toHaveAttribute("aria-pressed", "false"); await probe(page); await startRoaming(page);
  await expect(lamp).toHaveAttribute("aria-pressed", "true", { timeout: 65000 });
  await expect.poll(async () => { const { frames } = await read(page), lit = frames.find(frame => frame.home.light); return Boolean(lit && frames.some(frame => frame.at > lit.at + 200 && frame.actorDecoded && !frame.homeLife && !frame.home.contact && ["walk", "jump", "play"].includes(frame.state) && Math.hypot(frame.x - lit.x, frame.y - lit.y) > 8)); }, { timeout: 10000 }).toBe(true);
  const observed = await read(page), lit = observed.frames.find(frame => frame.home.light)!;
  expect(lit).toBeTruthy(); expect(contactBefore(observed.frames, lit.at)).toBe(true);
  const approach = observed.frames.filter(frame => frame.at <= lit.at && frame.actorDecoded);
  expect(Math.max(...approach.map(frame => frame.x)) - Math.min(...approach.map(frame => frame.x))).toBeGreaterThan(8);
  proofs.get(page)!.notes.push({ personality, actualFixtureHour: 0, initialSyntheticLight: false, nativeLightChangedAt: lit.at, actualContactBeforeLight: true, resumedLivingWithin10000ms: true, resumedEvidence: "decoded world movement beyond8px after the homeLife queue and contact both clear" });
});
test("149 objects automatic night sleep prepares TV and light through real controls", async ({ page }) => {
  await setup(page, "studio", false, { personality: "sleepy", energy: .08, sleep: true, hour: 0, light: true });
  await expect(page.locator(".vc-home-room")).toHaveAttribute("data-night", "true"); await nativeNatureTvAndPriorityWait(page); await probe(page); await startRoaming(page, true);
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", "sleep", { timeout: 80000 }); await page.waitForTimeout(750);
  const observed = await read(page), sleeping = observed.frames.find(frame => frame.state === "sleep"); expect(sleeping).toBeTruthy();
  expect(sleeping!.home.light).toBe(false); expect(["off", "tori"]).toContain(sleeping!.home.tv);
  const tvChanged = observed.frames.find(frame => frame.home.tv !== "nature"), lightOff = observed.frames.find(frame => !frame.home.light);
  expect(tvChanged).toBeTruthy(); expect(lightOff).toBeTruthy(); expect(contactBefore(observed.frames, tvChanged!.at)).toBe(true); expect(contactBefore(observed.frames, lightOff!.at)).toBe(true);
  expect(tvChanged!.at).toBeLessThan(sleeping!.at); expect(lightOff!.at).toBeLessThan(sleeping!.at);
  proofs.get(page)!.notes.push({ automaticSleep: "night fixture and initial saved fatigue; real automatic-sleep switch enabled only after the15.5s TV priority wait; no manual N input", actualFixtureHour: 0, actualManualTvPriorityWaitMs: 15500, originalChannel: "nature", actualSleepTv: sleeping!.home.tv, tvOffActuallyObserved: sleeping!.home.tv === "off", permittedToriExceptionSample: sleeping!.home.tv === "tori", sleepDurationNotFullySampled: true });
});
test("149 objects curious departure prepares TV and light before reaching the public calendar", async ({ page }) => {
  await setup(page, "studio", false, { personality: "curious", energy: .95, sleep: false, hour: 12, light: true });
  await expect(page.locator(".vc-home-room")).not.toHaveAttribute("data-night"); await nativeNatureTvAndPriorityWait(page); await probe(page); await startRoaming(page);
  await expect.poll(async () => (await read(page)).frames.some(frame => /^(card|date)-/.test(frame.platform) && frame.actorDecoded), { timeout: 80000 }).toBe(true);
  await page.waitForTimeout(600); const observed = await read(page), outside = observed.frames.find(frame => /^(card|date)-/.test(frame.platform) && frame.actorDecoded)!;
  expect(outside.home.light).toBe(false); expect(["off", "tori"]).toContain(outside.home.tv);
  const tvChanged = observed.frames.find(frame => frame.home.tv !== "nature"), lightOff = observed.frames.find(frame => !frame.home.light);
  expect(tvChanged).toBeTruthy(); expect(lightOff).toBeTruthy(); expect(contactBefore(observed.frames, tvChanged!.at)).toBe(true); expect(contactBefore(observed.frames, lightOff!.at)).toBe(true);
  expect(tvChanged!.at).toBeLessThan(outside.at); expect(lightOff!.at).toBeLessThan(outside.at);
  proofs.get(page)!.notes.push({ personality: "curious", actualFixtureHour: 12, actualManualTvPriorityWaitMs: 15500, originalChannel: "nature", actualPublicPlatform: outside.platform, actualPublicArrivalAt: outside.at, actualDepartureTv: outside.home.tv, tvOffActuallyObserved: outside.home.tv === "off", permittedToriExceptionSample: outside.home.tv === "tori" });
});

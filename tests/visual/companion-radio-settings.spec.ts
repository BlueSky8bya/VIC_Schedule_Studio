import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_RADIO_TRACKS } from "@/lib/ui/viewer-companion/radio-catalog";
import { COMPANION_RADIO_PREFERENCES_KEY } from "@/lib/ui/viewer-companion/radio-preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";

test.use({ viewport: { width: 1440, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block", trace: "off" });
async function fixture(page: Page, sound = true) {
  const writes: string[] = [], errors: string[] = [], musicRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (/^\/companion\/audio\/radio\/[^/]+\.ogg$/.test(new URL(request.url()).pathname)) musicRequests.push(new URL(request.url()).pathname); });
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await page.route("**/*", route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname === "/visual-fixture/studio" && previewReads.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { writes.push(pathname); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    if (request.method() === "GET" && (pathname === "/" || pathname === "/studio")) return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    return route.continue();
  });
  await page.addInitScript(() => {
    // Observe the real media→gain connection without adding nodes, replacing
    // audio samples, patching clocks/RNG or changing any automation parameter.
    const target = window as Window & { __companionRadioGainNodes?: GainNode[] };
    target.__companionRadioGainNodes = [];
    const create = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (element) {
      const source = create.call(this, element), connect = source.connect;
      Object.defineProperty(source, "connect", { value: (...args: unknown[]) => {
        if (args[0] instanceof GainNode) target.__companionRadioGainNodes!.push(args[0]);
        return Reflect.apply(connect, source, args);
      } });
      return source;
    };
  });
  await page.addInitScript(({ prefs, epochKey, epoch, radioKey, sound }) => {
    if (localStorage.getItem("fixture.radio108")) return;
    localStorage.setItem("fixture.radio108", "seeded");
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.sound": sound ? "on" : "off", "vic.soundVol": "45", "vic.soundCats": JSON.stringify({ tap: false, ui: false, celebrate: false, edit: false, alert: false }), "vic.ambient": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false }));
    localStorage.setItem(radioKey, JSON.stringify({ enabled: true, volume: 35, react: true, moods: { lively: true, graceful: true, calm: true }, excludedIds: [] }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, epochKey: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, radioKey: COMPANION_RADIO_PREFERENCES_KEY, sound });
  return { writes, errors, musicRequests };
}
async function openRadio(page: Page) {
  await page.bringToFront(); await settlePanelLayout(page);
  if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) { await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settlePanelLayout(page); }
  if (!await page.getByRole("button", { name: "설정", exact: true }).isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "소리", exact: true }).click();
  return { dialog, radio: dialog.locator(".rhh-companion-radio") };
}
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), COMPANION_RADIO_PREFERENCES_KEY);

async function assertRadioButtonGeometry(radio: Locator) {
  const buttons = radio.locator(".rhh-radio-actions > button");
  await expect(buttons).toHaveCount(3);
  await expect(radio.getByRole("group", { name: "라디오 분위기", exact: true })).toHaveCount(0);
  const readLifecycle = () => buttons.first().evaluate(element => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element), ancestors = [];
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const computed = getComputedStyle(ancestor);
      ancestors.push({ tag: ancestor.tagName, className: ancestor.className, transform: computed.transform, zoom: computed.zoom, animations: ancestor.getAnimations().map(animation => ({ state: animation.playState, currentTime: animation.currentTime, endTime: animation.effect?.getComputedTiming().endTime })) });
    }
    return { width: rect.width, height: rect.height, cssHeight: style.height, minHeight: style.minHeight, dpr: devicePixelRatio, physicalHeight: rect.height * devicePixelRatio, ancestors };
  });
  const before = await readLifecycle();
  // Dialog/tab transforms can still be finishing after the native tab clicks.
  // Measure the44px contract only once those real finite animations complete.
  await settlePanelLayout(radio.page());
  const after = await readLifecycle();
  await test.info().attach("radio-geometry-lifecycle", { body: JSON.stringify({ before, after }, null, 2), contentType: "application/json" });
  for (const button of await buttons.all()) {
    await expect(button).toHaveCSS("min-height", "44px");
    const geometry = await button.evaluate(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { label: element.textContent, width: rect.width, height: rect.height, radius: parseFloat(style.borderTopLeftRadius), mood: element.parentElement?.classList.contains("rhh-radio-moods") };
    });
    expect(geometry.height, `${geometry.label}: physical target height, including inherited studio zoom`).toBeGreaterThanOrEqual(44);
    expect(geometry.width, `${geometry.label}: physical target width`).toBeGreaterThanOrEqual(44);
    if (geometry.mood) expect(geometry.radius, `${geometry.label}: pill radius`).toBeGreaterThanOrEqual(Math.min(geometry.width, geometry.height) / 2);
  }
}

for (const surface of ["viewer", "studio", "preview"] as const) test(`${surface}: radio list edits stay local and persist, playback is explicit`, async ({ page, context }) => {
  const safety = await fixture(page);
  await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
  if (surface === "preview") { await settlePanelLayout(page); await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
  let { radio } = await openRadio(page);
  await assertRadioButtonGeometry(radio);
  expect(COMPANION_RADIO_TRACKS.length).toBeGreaterThanOrEqual(12);
  expect(safety.musicRequests).toEqual([]);
  await radio.getByText("곡 고르기", { exact: false }).click();
  await expect(radio.getByRole("checkbox")).toHaveCount(COMPANION_RADIO_TRACKS.length);
  await radio.getByRole("checkbox").first().uncheck();
  expect((await saved(page)).excludedIds).toEqual([COMPANION_RADIO_TRACKS[0].id]);
  await radio.getByRole("switch", { name: "빅타민 음악 반응 켜기/끄기", exact: true }).click();
  const volume = radio.getByRole("slider", { name: "라디오 음량", exact: true });
  await volume.focus(); await volume.press("Home"); await volume.press("ArrowRight");
  expect(await saved(page)).toMatchObject({ volume: 5, react: false });
  expect(await saved(page)).not.toHaveProperty("moods");
  expect(safety.musicRequests).toEqual([]);
  const eligible = COMPANION_RADIO_TRACKS.find(track => track.mood !== "lively" && track.id !== COMPANION_RADIO_TRACKS[0].id)!;
  await radio.getByRole("button", { name: `${eligible.title} 재생`, exact: true }).click();
  await expect(radio.locator(".rhh-radio-now > p")).toHaveText(eligible.title);
  await expect(radio.locator('[data-act="companion-radio-source"]')).toHaveAttribute("href", eligible.sourceUrl);
  await expect(radio.locator('[data-act="companion-radio-license"]')).toHaveAttribute("href", eligible.licenseUrl);
  await expect(radio.locator(".rhh-radio-attribution")).toContainText("Kevin MacLeod (incompetech.com)");
  await expect(radio.locator(".rhh-radio-attribution")).toContainText("음량보정");
  await expect(radio.getByRole("button", { name: "정지", exact: true })).toBeEnabled();
  expect(new Set(safety.musicRequests)).toEqual(new Set([eligible.src]));
  const expectedGain = Math.pow(.45, 1.6) * .05;
  await expect.poll(() => page.evaluate(() => (window as Window & { __companionRadioGainNodes?: GainNode[] }).__companionRadioGainNodes?.[0]?.gain.value ?? -1)).toBeCloseTo(expectedGain, 5);
  const nativeGain = await page.evaluate(() => {
    const nodes = (window as Window & { __companionRadioGainNodes?: GainNode[] }).__companionRadioGainNodes ?? [];
    return nodes.map(node => ({ gain: node.gain.value, contextState: node.context.state, sampleRate: node.context.sampleRate }));
  });
  expect(nativeGain).toHaveLength(1); expect(nativeGain[0].contextState).toBe("running");
  await test.info().attach("actual-radio-input-gain", { body: JSON.stringify({ expectedGain, masterVolume: 45, radioVolume: 5, creatureEffectsVolume: 60, nativeGain }, null, 2), contentType: "application/json" });
  await radio.getByRole("button", { name: "정지", exact: true }).click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeVisible();
  const selections = await saved(page);
  if (surface === "viewer") {
    const sibling = await context.newPage();
    await sibling.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Local radio fixture</title>" }));
    await sibling.goto(new URL(page.url()).origin + "/visual-fixture/radio");
    await sibling.evaluate(key => { const value = JSON.parse(localStorage.getItem(key)!); value.volume = 25; localStorage.setItem(key, JSON.stringify(value)); }, COMPANION_RADIO_PREFERENCES_KEY);
    await sibling.close(); await page.bringToFront();
    await expect(volume).toHaveValue("25"); selections.volume = 25;
  }
  const screenshotOutput = process.env.COMPANION_RADIO_UI_OUTPUT ?? ".scratch-pw/companion-111/radio-settings";
  mkdirSync(screenshotOutput, { recursive: true });
  await page.screenshot({ path: `${screenshotOutput}/radio-${surface}.png` });
  const targetAttributes = await radio.locator("[data-act]").evaluateAll(nodes => nodes.map(node => [node.getAttribute("data-act"), node.getAttribute("data-act-opt")]));
  expect(targetAttributes.every(([key, opt]) => key?.startsWith("companion-radio-") && (!opt || ["on", "off", "open", "close", "lively", "graceful", "calm"].includes(opt)))).toBe(true);
  await page.reload();
  if (surface === "preview" && !await page.locator(".viewer-fullscreen").count()) await page.locator(".io-preview").click();
  ({ radio } = await openRadio(page));
  expect(await saved(page)).toEqual(selections);
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeVisible();
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

test("radio empty pool, dedicated OFF, zero volume and global OFF keep play controls unavailable", async ({ page }) => {
  const safety = await fixture(page, false);
  await page.goto("/visual-fixture/poster");
  const { dialog, radio } = await openRadio(page);
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  await radio.getByText("곡 고르기", { exact: false }).click();
  for (const checkbox of await radio.getByRole("checkbox").all()) await checkbox.uncheck();
  await expect(radio).toContainText("선택한 곡이 없어요.");
  await dialog.locator('[data-tab="sound"]').click();
  await dialog.getByRole("switch", { name: "효과음 켜기/끄기", exact: true }).click();
  await dialog.locator('[data-tab="companion"]').click();
  await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "소리", exact: true }).click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  await radio.getByText("곡 고르기", { exact: false }).click();
  await radio.getByRole("checkbox").first().check();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeEnabled();
  const volume = radio.getByRole("slider", { name: "라디오 음량", exact: true });
  await volume.focus(); await volume.press("Home");
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  await volume.press("ArrowRight");
  await radio.getByRole("switch", { name: "빅타민 라디오 켜기/끄기", exact: true }).click();
  await expect(radio.getByRole("button", { name: "다음 곡", exact: true })).toBeDisabled();
  await radio.getByRole("switch", { name: "빅타민 라디오 켜기/끄기", exact: true }).click();
  await dialog.getByRole("switch", { name: "빅타민 효과음 켜기/끄기", exact: true }).click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  await dialog.getByRole("switch", { name: "빅타민 효과음 켜기/끄기", exact: true }).click();
  await dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  await dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
  await dialog.locator('[data-tab="sound"]').click();
  const globalVolume = dialog.getByRole("slider", { name: "효과음 음량", exact: true });
  await globalVolume.focus(); await globalVolume.press("Home");
  await dialog.locator('[data-tab="companion"]').click();
  await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "소리", exact: true }).click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  expect(safety.musicRequests).toEqual([]); expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});


for (const surface of ["viewer", "studio"] as const) test(`${surface}: first home radio gesture plays audible samples in a cold audio context`, async ({ page }) => {
  const safety = await fixture(page);
  await page.setViewportSize({ width: 1920, height: 1100 });
  await page.addInitScript(() => {
    localStorage.setItem("vic.ambient", "on");
    const target = window as Window & { __coldRadio?: { elements: HTMLMediaElement[]; analysers: AnalyserNode[]; states: string[]; resumes: number } };
    const observed: NonNullable<typeof target.__coldRadio> = target.__coldRadio = { elements: [], analysers: [], states: [], resumes: 0 };
    const resume = AudioContext.prototype.resume;
    AudioContext.prototype.resume = function () { observed.resumes++; return resume.call(this); };
    const create = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (element) {
      observed.elements.push(element); observed.states.push(this.state);
      this.addEventListener("statechange", () => observed.states.push(this.state));
      const source = create.call(this, element), analyser = this.createAnalyser();
      source.connect(analyser); observed.analysers.push(analyser);
      return source;
    };
  });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
  // Playwright locator readiness helpers can evaluate with userGesture.
  // Before the first real click, observe readiness exclusively through CDP
  // with userGesture:false, just like the autoplay boundary sound suite.
  const room = page.locator(".vc-home:visible"), radio = room.locator('[data-home-action="radio"]');
  const inspector = await page.context().newCDPSession(page);
  await expect.poll(async () => {
    const result = await inspector.send("Runtime.evaluate", { expression: "(()=>{const b=document.querySelector('[data-home-action=radio]');return Boolean(b&&b.getClientRects().length&&getComputedStyle(b).visibility!=='hidden'&&!b.closest('[inert]'));})()", returnByValue: true, userGesture: false });
    return result.result.value;
  }).toBe(true);
  const coldResult = await inspector.send("Runtime.evaluate", { expression: "JSON.stringify({activation:navigator.userActivation.hasBeenActive,elements:window.__coldRadio?.elements.length??0,resumes:window.__coldRadio?.resumes??0,sfx:document.documentElement.dataset.sfxLast??null})", returnByValue: true, userGesture: false });
  await inspector.detach();
  const cold = JSON.parse(coldResult.result.value as string);
  expect(cold).toEqual({ activation: false, elements: 0, resumes: 0, sfx: null });
  await radio.click();
  await expect(radio).toHaveAttribute("aria-pressed", "true");
  const read = () => page.evaluate(() => {
    const value = (window as Window & { __coldRadio?: { elements: HTMLMediaElement[]; analysers: AnalyserNode[]; states: string[]; resumes: number } }).__coldRadio!;
    const element = value.elements[0], analyser = value.analysers[0], samples = new Float32Array(analyser?.fftSize ?? 32);
    analyser?.getFloatTimeDomainData(samples);
    return { currentTime: element?.currentTime ?? 0, paused: element?.paused ?? true, ready: element?.readyState ?? 0, context: analyser?.context.state, peak: Math.max(...samples.map(Math.abs)), states: value.states, elements: value.elements.length, sfx: document.documentElement.dataset.sfxLast ?? null };
  });
  await expect.poll(read).toMatchObject({ paused: false, context: "running", elements: 1 });
  await expect.poll(async () => (await read()).currentTime).toBeGreaterThan(.15);
  await expect.poll(async () => (await read()).peak).toBeGreaterThan(.00001);
  const playing = await read();
  await test.info().attach("native-cold-radio", { body: JSON.stringify({ cold, playing, actualFirstHomeClick: true, settingsOpened: false }, null, 2), contentType: "application/json" });
  expect(playing.sfx).toBeNull();
  await radio.click(); await expect(radio).toHaveAttribute("aria-pressed", "false");
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

test("every active licensed recording decodes and produces real browser samples without fetching the retired playlist", async ({ page }) => {
  test.setTimeout(15000 + COMPANION_RADIO_TRACKS.length * 2500);
  const safety = await fixture(page);
  await page.addInitScript(() => {
    const target = window as Window & { __allRadio?: { media: HTMLMediaElement; analyser: AnalyserNode } };
    const create = AudioContext.prototype.createMediaElementSource;
    AudioContext.prototype.createMediaElementSource = function (media) {
      const source = create.call(this, media), analyser = this.createAnalyser();
      source.connect(analyser); target.__allRadio = { media, analyser }; return source;
    };
  });
  await page.goto("/visual-fixture/poster");
  const { radio } = await openRadio(page);
  await radio.getByText("곡 고르기", { exact: false }).click();
  const recordings: Array<{ id: string; src: string; time: number; peak: number; context: string }> = [];
  const read = () => page.evaluate(() => {
    const { media, analyser } = (window as Window & { __allRadio?: { media: HTMLMediaElement; analyser: AnalyserNode } }).__allRadio!;
    const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples);
    return { src: new URL(media.currentSrc || media.src).pathname, time: media.currentTime, peak: Math.max(...samples.map(Math.abs)), context: analyser.context.state };
  });
  for (const track of COMPANION_RADIO_TRACKS) {
    await radio.getByRole("button", { name: `${track.title} 재생`, exact: true }).click();
    await expect(radio.locator(".rhh-radio-now > p")).toHaveText(track.title);
    if (track.credit) {
      await expect(radio.locator(".rhh-radio-attribution")).toContainText(track.credit);
      await test.info().attach("credited-vocal-recording", { body: await radio.screenshot(), contentType: "image/png" });
    }
    await expect.poll(read).toMatchObject({ src: track.src, context: "running" });
    await expect.poll(async () => (await read()).time).toBeGreaterThan(.15);
    await expect.poll(async () => (await read()).peak).toBeGreaterThan(.00001);
    recordings.push({ id: track.id, ...await read() });
  }
  expect(new Set(safety.musicRequests)).toEqual(new Set(COMPANION_RADIO_TRACKS.map(track => track.src)));
  await radio.getByRole("button", { name: "정지", exact: true }).click();
  await test.info().attach("all-active-recordings-native-pcm", { body: JSON.stringify({ recordings, writes: safety.writes, errors: safety.errors }, null, 2), contentType: "application/json" });
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

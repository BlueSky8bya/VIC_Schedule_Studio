import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPANION_PERSONALITIES, COMPANION_PERSONALITY_NAMES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";

const output = process.env.COMPANION137_OUTPUT ?? ".scratch-pw/companion-137/native";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type Surface = "viewer" | "studio" | "preview";
type Frame = {
  at: number; state: string; signature: string; scene: string; beat: string; command: string; play: string; pose: number;
  x: number; y: number; platform: string; visible: boolean; decoded: boolean; tv: string; lit: boolean; curtain: string;
  toys: { id: string; carried: boolean; held: boolean; x: number; y: number }[]; foods: string[];
  washing: boolean; brush: { x: number; y: number; visible: boolean } | null;
};
type ProbeWindow = Window & { personality137?: { samples: Frame[]; stop: () => void } };
type Proof = { errors: string[]; rejected: string[]; previewReads: number; notes: unknown[] };
const proofs = new WeakMap<Page, Proof>();

test.use({ viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.setTimeout(110_000);

test.beforeEach(async ({ page, context, baseURL }) => {
  const proof: Proof = { errors: [], rejected: [], previewReads: 0, notes: [] }; proofs.set(page, proof);
  const origin = new URL(baseURL!).origin;
  const actions = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewIds = new Set(Object.entries(actions).filter(([, entry]) => entry.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("pageerror", error => proof.errors.push(error.message));
  await context.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
    if (url.origin === origin && request.method() === "POST" && url.pathname === "/visual-fixture/studio" && previewIds.has(request.headers()["next-action"])) {
      proof.previewReads++;
      // Fulfill this one known public read from a synthetic public DTO. No
      // server action executes and no private/live source is contacted.
      return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    }
    if (url.origin !== origin || !["GET", "HEAD"].includes(request.method())) { proof.rejected.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live APIs in native fixture" });
    return route.continue();
  });
});

test.afterEach(async ({ page }, info) => {
  const frames = await page.evaluate(() => { const probe = (window as ProbeWindow).personality137; probe?.stop(); return probe?.samples ?? []; }).catch(() => []);
  mkdirSync(output, { recursive: true }); const filename = info.title.replace(/[^a-z0-9]+/gi, "-");
  const path = resolve(output, filename + ".json");
  writeFileSync(path, JSON.stringify({ ...proofs.get(page), frames, status: info.status, capturedAt: new Date().toISOString(), scope: "Production-build native fixture interactions and read-only rAF observations. Initial local saved preferences/care only. No RNG/clock/brain/geometry/style injection. Not a144 native-scene, OBS, real-login or RLS claim." }, null, 2));
  await info.attach("personality137-native", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, filename + ".png") }).catch(() => {});
  expect(proofs.get(page)!.errors).toEqual([]); expect(proofs.get(page)!.rejected).toEqual([]);
});

async function fixture(page: Page, surface: Surface, options: { personality?: CompanionPersonality; summer?: boolean; roam?: boolean; reduced?: boolean; gfxOff?: boolean; hunger?: number } = {}) {
  await page.addInitScript(({ preferences, memory, epoch, epochKey, options }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": options.gfxOff ? "off" : "max", "vic.gfx": JSON.stringify({ mode: options.gfxOff ? "off" : "full", at: Date.now(), v: 3 }), "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": options.reduced ? "on" : "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, personality: options.personality ?? "balanced", roam: options.personality ? false : options.roam ?? true, sleep: false, feeding: true, sound: false, learnFromYou: false, heartPrank: false, cardPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: .9, hunger: options.hunger ?? .05 }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, options });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : `/visual-fixture/studio?role=owner&y=2025&m=${options.summer ? 7 : 10}&hour=${options.summer ? 12 : 21}&weather=clear`);
  await page.bringToFront(); await settlePanelLayout(page);
  if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); await settlePanelLayout(page); }
  await expect(page.locator(".vc-companion")).toBeVisible(); await page.evaluate(() => document.fonts.ready);
  //138 randomizes the first document personality. Deterministic scenario
  // preconditions use the real settings radio rather than seeded personality.
  if (options.personality) await selectNative(page, options.personality, options.roam ?? true);
  return openCompanionHome(page);
}

async function selectNative(page: Page, personality: CompanionPersonality, roam?: boolean) {
  const home = await openCompanionHome(page);
  const book = home.getByRole("button", { name: "빅타민 수첩 열기", exact: true });
  await expect(book).toBeVisible(); await book.click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true }); await expect(dialog).toBeVisible();
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  const group = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true });
  await expect(group.getByRole("radio")).toHaveCount(9);
  const option = group.getByRole("radio", { name: COMPANION_PERSONALITY_NAMES[personality], exact: true });
  if (await option.getAttribute("aria-checked") === "true") await group.locator('[role="radio"][aria-checked="false"]').first().click();
  await option.click(); await expect(option).toHaveAttribute("aria-checked", "true");
  if (roam !== undefined) {
    await dialog.getByRole("tab", { name: "움직임", exact: true }).click();
    await dialog.locator('[data-act="companion-roam"]').setChecked(roam);
  }
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden();
  await page.mouse.move(2, 2); await startProbe(page);
  return page.locator(".vc-companion");
}

async function startProbe(page: Page) {
  await page.evaluate(() => {
    (window as ProbeWindow).personality137?.stop();
    let request = 0, last = -Infinity, stopped = false; const began = performance.now(), samples: Frame[] = [];
    const sample = (now: number) => {
      if (stopped) return;
      if (now - last >= 40) {
        last = now; const actor = document.querySelector<HTMLElement>(".vc-companion"), texture = actor?.querySelector<HTMLImageElement>(".vc-texture"), r = actor?.getBoundingClientRect(), room = document.querySelector<HTMLElement>(".vc-home-room"), brush = document.querySelector<HTMLElement>(".vc-wash-tool"), brushRect = brush?.getBoundingClientRect();
        samples.push({ at: now - began, state: actor?.dataset.state ?? "", signature: actor?.dataset.personalityActivity ?? "", scene: actor?.dataset.personalityScene ?? "", beat: actor?.dataset.personalityBeat ?? "", command: actor?.dataset.personalityCommand ?? "", play: actor?.dataset.play ?? "", pose: Number(actor?.dataset.pose ?? -1), x: r ? r.left + r.width / 2 : NaN, y: r?.bottom ?? NaN, platform: actor?.dataset.platform ?? "", visible: Boolean(actor && !document.hidden && !actor.hidden && r!.width && getComputedStyle(actor).visibility !== "hidden" && Number(getComputedStyle(actor).opacity) > 0), decoded: Boolean(texture?.complete && texture.naturalWidth), tv: room?.dataset.tv ?? "off", lit: room?.hasAttribute("data-lamp-lit") ?? false, curtain: room?.querySelector<HTMLElement>(".vc-home-window")?.dataset.curtain ?? "",
          toys: [...document.querySelectorAll<HTMLElement>(".vc-toy")].map(node => { const box = node.getBoundingClientRect(); return { id: node.dataset.toyId!, carried: node.dataset.carried === "true", held: node.dataset.held === "true", x: box.left + box.width / 2, y: box.bottom }; }), foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(node => node.dataset.food!), washing: actor?.hasAttribute("data-washing") ?? false, brush: brush && brushRect ? { x: brushRect.left + brushRect.width / 2, y: brushRect.top + brushRect.height / 2, visible: !brush.hidden && getComputedStyle(brush).visibility !== "hidden" && brushRect.width > 0 } : null });
      }
      if (now - began < 130_000) request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).personality137 = { samples, stop() { stopped = true; cancelAnimationFrame(request); } }; request = requestAnimationFrame(sample);
  });
}
const frames = (page: Page) => page.evaluate(() => (window as ProbeWindow).personality137?.samples ?? []);
const duration = async (page: Page, ms: number) => expect.poll(async () => (await frames(page)).at(-1)?.at ?? 0, { timeout: ms + 8000, intervals: [250] }).toBeGreaterThanOrEqual(ms);
function signature(frame: Frame, personality: CompanionPersonality) {
  const timing = COMPANION_PLAY_TIMING[frame.play as keyof typeof COMPANION_PLAY_TIMING];
  return frame.visible && frame.decoded && frame.signature === personality && frame.state === "play" && Boolean(timing?.beats.some(beat => companionSpriteMetadata.rows[beat.row].includes(frame.pose)));
}
function meaningful(trace: readonly Frame[], index: number, personality: CompanionPersonality) {
  const frame = trace[index]; if (!frame.visible || !frame.decoded) return false;
  if (signature(frame, personality) || frame.state === "eat" || frame.toys.some(toy => toy.carried && !toy.held)) return true;
  if (!frame.scene || frame.signature !== personality) return false;
  if (frame.command === "watch" && frame.state === "look" && frame.tv !== "off") return true;
  if (["walk", "jump"].includes(frame.state)) {
    const previous = trace.slice(Math.max(0, index - 25), index).find(value => value.scene === frame.scene && value.beat === frame.beat);
    return Boolean(previous && Math.hypot(frame.x - previous.x, frame.y - previous.y) >= 8);
  }
  return false;
}

for (const surface of ["viewer", "studio", "preview"] as const) for (const personality of COMPANION_PERSONALITIES)
  test(`137 ${surface} native ${personality} selection expresses immediately and remains purposeful`, async ({ page }) => {
    await fixture(page, surface, { personality: personality === "balanced" ? "curious" : "balanced" });
    await selectNative(page, personality);
    await expect.poll(async () => (await frames(page)).some(frame => signature(frame, personality)), { timeout: 3500, intervals: [40] }).toBe(true);
    await duration(page, 20_000); const trace = await frames(page), first = trace.find(frame => signature(frame, personality))!;
    expect(first.at).toBeLessThanOrEqual(3000);
    expect(first.scene).toBe(`entry-${personality}`);
    const points = trace.flatMap((frame, index) => meaningful(trace, index, personality) ? [frame.at] : []);
    expect(points.length).toBeGreaterThan(2);
    const gaps = [points[0], ...points.slice(1).map((point, index) => point - points[index]), trace.at(-1)!.at - points.at(-1)!];
    expect(Math.max(...gaps), "decoded personality expression or actual purposeful progress must recur before10s").toBeLessThanOrEqual(10_000);
    expect(new Set(trace.filter(frame => frame.scene).map(frame => `${frame.scene}:${frame.beat}`)).size, "an entry label alone is not a full living sequence").toBeGreaterThan(1);
    expect(trace.every(frame => frame.foods.length <= 8 && frame.toys.length <= 4)).toBe(true);
    proofs.get(page)!.notes.push({ firstDecodedSignatureAt: first.at, largestMeaningfulGap: Math.max(...gaps), distinctStages: [...new Set(trace.map(frame => `${frame.scene}:${frame.beat}`))], selectionWasNativeRadio: true });
  });

for (const surface of ["viewer", "studio"] as const) test(`137 ${surface} tidy carries all four native toys to the actual box before removing their IDs`, async ({ page }) => {
  test.setTimeout(140_000);
  const home = await fixture(page, surface, { personality: "tidy" }); await placeCompanionOnHomeFloor(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), pet = page.locator(".vc-companion");
  await actor.focus(); await actor.press("Space"); await expect(pet).toHaveAttribute("data-state", "held");
  const ids: string[] = [];
  for (let i = 0; i < 4; i++) {
    await home.locator('[data-home-action="toys"]').click(); await expect(page.locator(".vc-toy")).toHaveCount(i + 1);
    const toy = page.locator(".vc-toy").last(); await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 6000 }); ids.push((await toy.getAttribute("data-toy-id"))!);
  }
  const box = (await home.locator(".vc-toy-box-opening").boundingBox())!, opening = { x: box.x + box.width / 2, y: box.y + box.height };
  await startProbe(page); await actor.focus(); await actor.press("Space"); await page.mouse.move(2, 2);
  await expect(page.locator(".vc-toy")).toHaveCount(0, { timeout: 75_000 }); const trace = await frames(page);
  for (const id of ids) {
    const carried = trace.filter(frame => frame.toys.some(toy => toy.id === id && toy.carried)); expect(carried.length, id).toBeGreaterThanOrEqual(2);
    const last = carried.at(-1)!, toy = last.toys.find(toy => toy.id === id)!;
    expect(Math.hypot(toy.x - opening.x, toy.y - opening.y), `${id} real painted return contact`).toBeLessThan(20);
    expect(trace.some(frame => frame.at > last.at && !frame.toys.some(toy => toy.id === id))).toBe(true);
  }
  expect(trace.every(frame => frame.toys.length <= 4 && frame.foods.length <= 8)).toBe(true);
  proofs.get(page)!.notes.push({ nativeIds: ids, actualBoxOpening: opening, sameIdCarryBeforeRemoval: true });
  const pad = (await home.locator(".vc-home-wash-pad").boundingBox())!, stance = { x: pad.x + pad.width / 2, y: pad.y + pad.height * .72 };
  await expect.poll(async () => (await frames(page)).some(frame => frame.washing && frame.brush?.visible && frame.platform === "companion-home-floor-400"), { timeout: 35_000, intervals: [100] }).toBe(true);
  await expect.poll(async () => {
    const contact = (await frames(page)).filter(frame => frame.washing && frame.brush?.visible && frame.platform === "companion-home-floor-400");
    return contact.length > 1 ? contact.at(-1)!.at - contact[0].at : 0;
  }, { timeout: 5000, intervals: [100] }).toBeGreaterThanOrEqual(500);
  const washed = (await frames(page)).filter(frame => frame.washing && frame.brush?.visible);
  expect(washed.every(frame => frame.toys.length === 0 && Math.abs(frame.x - stance.x) < 2 && Math.abs(frame.y - stance.y) < 2)).toBe(true);
  expect(washed.every(frame => frame.brush && Math.hypot(frame.brush.x - frame.x, frame.brush.y - (frame.y - 35)) < 65)).toBe(true);
  const lastWash = washed.at(-1)!;
  await expect.poll(async () => (await frames(page)).some(frame => frame.at > lastWash.at && frame.scene === lastWash.scene && Number(frame.beat) > Number(lastWash.beat)), { timeout: 12_000, intervals: [100] }).toBe(true);
  proofs.get(page)!.notes.push({ actualPadStance: stance, paintedBrushContactMs: lastWash.at - washed[0].at, finiteWashBeatAdvanced: true });
});

test("137 native take-outs retain the shared food8 and toy4 caps", async ({ page }) => {
  const home = await fixture(page, "studio", { personality: "balanced", roam: false });
  for (let i = 0; i < 12; i++) { await home.locator('[data-home-action="feed"]').click(); expect(await page.locator(".vc-food").count()).toBeLessThanOrEqual(8); }
  for (let i = 0; i < 6; i++) { await home.locator('[data-home-action="toys"]').click(); expect(await page.locator(".vc-toy").count()).toBeLessThanOrEqual(4); }
  expect(await page.locator(".vc-food").count()).toBe(8); expect(await page.locator(".vc-toy").count()).toBe(4);
});

test("137 summer homebody respects native manual15s choices then connects the real sofa TV curtain and persistent light", async ({ page }) => {
  const home = await fixture(page, "studio", { personality: "tidy", summer: true }); await placeCompanionOnHomeFloor(page);
  const lamp = home.locator(".vc-home-lamp"), tv = home.locator(".vc-home-tv"), room = home.locator(".vc-home-room");
  // Deliberately establish manual ON and OFF, even if these equal defaults.
  if (await lamp.getAttribute("aria-pressed") === "true") await lamp.click(); await lamp.click(); await expect(lamp).toHaveAttribute("aria-pressed", "true");
  for (let i = 0; i < 6; i++) await tv.click(); await expect(room).toHaveAttribute("data-tv", "off");
  const lastManual = await page.evaluate(() => performance.now());
  await selectNative(page, "homebody"); const postSelection = await page.evaluate(() => performance.now());
  await duration(page, Math.max(1000, 15_000 - (postSelection - lastManual))); const protectedFrames = await frames(page);
  const protectedThrough = 15_000 - (postSelection - lastManual) - 250;
  expect(protectedFrames.filter(frame => frame.at < protectedThrough).every(frame => frame.tv === "off" && frame.lit)).toBe(true);
  await expect.poll(async () => (await frames(page)).some(frame => frame.platform === "companion-home" && frame.tv !== "off" && frame.curtain === "closed" && !frame.lit && frame.state !== "sleep"), { timeout: 60_000, intervals: [200] }).toBe(true);
  const trace = await frames(page); expect(trace.some(frame => frame.state === "sleep")).toBe(false);
  proofs.get(page)!.notes.push({ manualPriorityMs: 15_000, protectedThrough, actualSummerRoom: await room.getAttribute("data-season"), noSleepPermissionBypass: true });
});

test("137 actual public editor input keeps its focus and text while the performer cheers beside the panel", async ({ page }) => {
  await fixture(page, "studio", { personality: "performer" });
  await page.locator('[data-act="calendar-cell"]').nth(10).dblclick({ position: { x: 14, y: 20 } });
  const editor = page.locator(".event-editor-panel:visible"), content = editor.getByRole("textbox", { name: "내용", exact: true });
  await expect(editor).toBeVisible(); await content.fill("응원 검수용 공개 초안"); await content.press("End");
  await startProbe(page);
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-working", "");
  await expect.poll(async () => (await frames(page)).some(frame => frame.scene === "working-performer" && signature(frame, "performer")), { timeout: 10_000, intervals: [100] }).toBe(true);
  await content.pressSequentially(" · 입력 계속", { delay: 80 });
  await expect(content).toBeFocused(); await expect(content).toHaveText("응원 검수용 공개 초안 · 입력 계속");
  expect(await page.locator(".vc-actor").evaluate(node => getComputedStyle(node).pointerEvents)).toBe("none");
  const panel = (await editor.boundingBox())!, trace = (await frames(page)).filter(frame => frame.scene === "working-performer" && signature(frame, "performer"));
  expect(trace.length).toBeGreaterThan(2);
  expect(trace.every(frame => frame.x + 38 <= panel.x || frame.x - 38 >= panel.x + panel.width || frame.y <= panel.y || frame.y - 70 >= panel.y + panel.height), "the actual cheering body stays beside the input panel").toBe(true);
  const closedAfter = (await frames(page)).at(-1)!.at;
  await content.press("Escape"); await expect(editor).toBeHidden();
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-working", "");
  await expect.poll(async () => (await frames(page)).some(frame => frame.at > closedAfter && !frame.scene.startsWith("working-") && signature(frame,"performer")), { timeout: 7000, intervals:[100] }).toBe(true);
  proofs.get(page)!.notes.push({ nativePublicInputFocusPreserved: true, meaningfulWorkingFrames: trace.length, editorOutsideBody: true, resumesNormalPersonalityAfterClose:true });
});

test("137 hungry gourmet uses the actual dispenser once and eats that same spawned food without scattering it", async ({ page }) => {
  await fixture(page, "studio", { personality: "gourmet", hunger: .6 }); await startProbe(page);
  await expect(page.locator(".vc-food").first()).toBeVisible({ timeout: 35_000 });
  const food = page.locator(".vc-food").first(), id = (await food.getAttribute("data-food"))!;
  expect(id).toBeTruthy();
  await expect(food).toHaveAttribute("data-eating", "", { timeout: 30_000 });
  await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", "eat");
  const mealFrames = await frames(page);
  expect(mealFrames.some(frame => frame.foods.includes(id))).toBe(true);
  await expect(page.locator(`.vc-food[data-food="${id}"]`)).toHaveCount(0, { timeout: 20_000 });
  const trace = await frames(page), seenIds = new Set(trace.flatMap(frame => frame.foods));
  expect(trace.some(frame => frame.state === "eat" && frame.foods.includes(id))).toBe(true);
  expect(seenIds.size, "stop at the first completed native meal, before a later hunger cycle").toBe(1);
  proofs.get(page)!.notes.push({ initialFixtureHunger: .6, nativeSpawnedFoodId: id, sameIdObservedEatingBeforeRemoval: true, nativeFeedButtonClicks: 0 });
});

type WorkSignalProof = { kind: string; keys: string[] };
type WorkProbeWindow = Window & { workSignals137?: WorkSignalProof[] };
async function observeWorkSignals(page: Page) {
  await page.evaluate(() => {
    const samples: WorkSignalProof[] = []; (window as WorkProbeWindow).workSignals137 = samples;
    window.addEventListener("vic:companion-public-work", event => {
      const detail = (event as CustomEvent).detail, kind = ["opened", "closed", "saved", "undo", "redo"].includes(detail?.kind) ? detail.kind as string : "invalid";
      samples.push({ kind, keys: detail && typeof detail === "object" ? Object.keys(detail) : [] });
    });
  });
}
const workSignals = (page: Page) => page.evaluate(() => (window as WorkProbeWindow).workSignals137 ?? []);

for (const accepted of [true, false]) test(`137 native public save ${accepted ? "success" : "failure"} emits a completion only after the fixture server ACK`, async ({ page }) => {
  let release: (() => void) | undefined, requested = 0;
  const gate = new Promise<void>(done => { release = done; });
  await page.route("**/api/studio-write", async route => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    const command = request.postDataJSON() as { op: string; payload: { visibilityScope?: string; teaser?: boolean } };
    expect(command.op).toBe("save"); expect(command.payload.visibilityScope).toBe("public"); expect(Boolean(command.payload.teaser)).toBe(false);
    requested++; await gate;
    return route.fulfill({ status: accepted ? 200 : 403, contentType: "application/json", body: JSON.stringify(accepted ? { ok: true, id: "synthetic-137-save" } : { ok: false, error: "검수용 저장 거절" }) });
  });
  await fixture(page, "studio", { personality: "performer" }); await observeWorkSignals(page);
  await page.locator('[data-act="calendar-cell"]').nth(10).dblclick({ position: { x: 14, y: 20 } });
  const content = page.locator(".event-editor-panel:visible").getByRole("textbox", { name: "내용", exact: true });
  await content.fill("고정 완료 신호 검수"); await content.press("Control+Enter");
  await expect.poll(() => requested, { timeout: 6000 }).toBe(1);
  expect((await workSignals(page)).filter(event => event.kind === "saved")).toEqual([]);
  release!();
  if (accepted) await expect.poll(async () => (await workSignals(page)).filter(event => event.kind === "saved").length, { timeout: 7000 }).toBe(1);
  else { await expect(page.getByText("저장 실패").first()).toBeVisible(); expect((await workSignals(page)).filter(event => event.kind === "saved")).toEqual([]); }
  const signals = await workSignals(page);
  expect(signals.some(event => event.kind === "opened")).toBe(true);
  expect(signals.every(event => event.keys.length === 1 && event.keys[0] === "kind")).toBe(true);
  proofs.get(page)!.notes.push({ nativeSaveServerAckAccepted: accepted, serverRequestsFulfilledLocally: requested, signals });
});

for (const limit of ["roam-off", "reduced", "gfx-off"] as const) test(`137 public editor respects ${limit} instead of resuming autonomous work`, async ({ page }) => {
  await fixture(page, "studio", { personality: "performer", roam: limit !== "roam-off", reduced: limit === "reduced", gfxOff: limit === "gfx-off" });
  await page.locator('[data-act="calendar-cell"]').nth(10).dblclick({ position: { x: 14, y: 20 } });
  const content = page.locator(".event-editor-panel:visible").getByRole("textbox", { name: "내용", exact: true });
  await expect(content).toBeVisible(); await content.fill("정지 설정을 지키는 공개 초안"); await startProbe(page);
  await duration(page, 4000);
  expect((await frames(page)).some(frame => frame.scene.startsWith("working-"))).toBe(false);
  await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-working", "");
  await expect(content).toHaveText("정지 설정을 지키는 공개 초안");
});

import { expect, test, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_PERSONALITIES, COMPANION_PERSONALITY_NAMES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_COLLECTION_KEY } from "@/lib/ui/viewer-companion/collection";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { companionPlayDuration, COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { fulfillReadOnlyFont } from "./helpers/readonly-font";

type Rect = { x: number; y: number; width: number; height: number };
type Tool = Rect & { visible: boolean; transform: string };
type Frame = {
  at: number; absolute: number; state: string; scene: string; beat: string; command: string; effect: string; platform: string;
  visible: boolean; decoded: boolean; pose: number; x: number; y: number; rect: Rect | null;
  facing: string; facingScale: number; facingTransform: string; boxOpening: Rect | null;
  pad: Rect | null; padFoot: number; washing: boolean; brush: Tool | null; paw: Tool | null; reaching: boolean; grade: number; inertiaFilter: string;
  tv: string; lit: boolean; curtain: string; radio: boolean; room: Rect | null;
  contacts: Partial<Record<"tv" | "light" | "curtain" | "radio", Rect>>;
  foods: { id: string; kind: string; eating: boolean; carried: boolean; discarding: boolean }[];
  toys: { id: string; carried: boolean; held: boolean }[];
};
type EntryInterruption = Pick<Frame, "absolute" | "state" | "scene" | "pose" | "visible" | "decoded"> & { trusted: boolean };
type ProbeWindow = Window & { agency141?: { frames: Frame[]; humanControls: { at: number; action: string }[]; entryChosenAt?: number; entryInterruption?: EntryInterruption; stop: () => void } };
type Proof = { build: string; errors: string[]; rejected: string[]; writes: string[]; notes: unknown[]; chunks: { url: string; served: string; local: string }[]; pending: Promise<void>[] };
type FixtureOptions = { personality?: CompanionPersonality; hunger?: number; energy?: number; sleep?: boolean; sound?: boolean; summer?: boolean; night?: boolean; roam?: boolean; cat?: boolean; interruptEntry?: boolean };
const output = resolve(process.env.COMPANION141_AGENCY_OUTPUT ?? ".scratch-pw/companion-141/home-agency");
const proofs = new WeakMap<Page, Proof>();
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const frames = (page: Page) => page.evaluate(() => (window as ProbeWindow).agency141?.frames ?? []);
const now = (page: Page) => page.evaluate(() => performance.now());
const latest = async (page: Page) => (await frames(page)).at(-1);
const genuine = (frame: Frame) => frame.visible && frame.decoded;
const washing = (frame: Frame) => genuine(frame) && frame.washing && frame.platform === "companion-home-floor-400" && frame.command === "wash" && frame.state === "play" && frame.brush?.visible;

test.use({ viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", isMobile: false, hasTouch: false, storageState: { cookies: [], origins: [] } });
test.setTimeout(120_000);
test.beforeEach(async ({ page, context, baseURL }) => {
  const origin = new URL(baseURL ?? "");
  expect(origin.protocol).toBe("http:"); expect(["127.0.0.1", "127.0.0.2", "localhost", "[::1]"]).toContain(origin.hostname);
  const directory = process.env.VISUAL_TEST_BUILD_DIR ?? ".next";
  const proof: Proof = { build: readFileSync(resolve(directory, "BUILD_ID"), "utf8").trim(), errors: [], rejected: [], writes: [], notes: [], chunks: [], pending: [] }; proofs.set(page, proof);
  const manifest = JSON.parse(readFileSync(resolve(directory, "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const preview = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  page.on("pageerror", error => proof.errors.push(error.message));
  page.on("response", response => {
    const url = new URL(response.url());
    if (response.status() !== 200 || url.origin !== origin.origin || !/^\/_next\/static\/chunks\/.+\.js$/.test(url.pathname)) return;
    proof.pending.push((async () => {
      const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
      proof.chunks.push({ url: url.pathname, served: hash(await response.body()), local: hash(readFileSync(resolve(directory, "static", url.pathname.slice("/_next/static/".length)))) });
    })().catch(error => { proof.errors.push(`served chunk proof: ${String(error)}`); }));
  });
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (request.resourceType() === "font" && url.origin !== origin.origin) return fulfillReadOnlyFont(route, fonts, proof.rejected);
    if (url.origin !== origin.origin) { proof.rejected.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort(); }
    if (request.method() === "POST" && url.pathname === "/visual-fixture/studio" && preview.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(`${request.method()} ${url.pathname}`); return route.abort(); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live/private API reads in native fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const trace = await page.evaluate(() => { const probe = (window as ProbeWindow).agency141; probe?.stop(); return { frames: probe?.frames ?? [], humanControls: probe?.humanControls ?? [] }; }).catch(() => ({ frames: [], humanControls: [] }));
  const proof = proofs.get(page)!; await Promise.allSettled(proof.pending); mkdirSync(output, { recursive: true });
  const name = info.title.replace(/[^a-z0-9]+/gi, "-"), path = resolve(output, `${name}.json`);
  writeFileSync(path, JSON.stringify({ status: info.status, proof: { ...proof, pending: undefined }, ...trace,
    scope: "Production-build synthetic fixture, initial saved preferences/care only; actual settings selection and native pointer/keyboard inputs. Read-only DOM/rAF/chunk observations. No RNG, clock, brain, geometry, style, actor/control callback or director injection. Not real-login, RLS, OBS, expert art approval or all-recipe coverage." }, null, 2));
  await info.attach("home-agency141", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, `${name}.png`) }).catch(() => {});
  expect(proof.errors).toEqual([]); expect(proof.rejected).toEqual([]); expect(proof.writes).toEqual([]);
  expect(proof.chunks.length).toBeGreaterThan(0); expect(proof.chunks.every(chunk => chunk.served === chunk.local)).toBe(true);
  expect(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim()).toBe(proof.build);
});

async function selectNative(page: Page, personality: CompanionPersonality, roam: boolean, deferPointerMove = false) {
  const home = await openCompanionHome(page); await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  const group = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }), option = group.getByRole("radio", { name: COMPANION_PERSONALITY_NAMES[personality], exact: true });
  if (await option.getAttribute("aria-checked") === "true") await group.locator('[role="radio"][aria-checked="false"]').first().click();
  await option.click(); await expect(option).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("tab", { name: "움직임", exact: true }).click(); await dialog.locator('[data-act="companion-roam"]').setChecked(roam);
  if (deferPointerMove) await page.evaluate(() => { const probe=(window as ProbeWindow).agency141;if (probe) probe.entryChosenAt=performance.now(); });
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden(); if (!deferPointerMove) await page.mouse.move(2, 2);
}
async function fixture(page: Page, options: FixtureOptions = {}) {
  proofs.get(page)!.notes.push({ initialSavedFixtureOnly: { hunger: options.hunger ?? .05, energy: options.energy ?? .9, sleep: options.sleep ?? false, sound: options.sound ?? false, animalMode: options.cat ? "cat" : "default" }, personalityConfirmedThroughNativeRadio: options.personality ?? "balanced" });
  await page.addInitScript(({ preferences, memory, epoch, epochKey, options }) => {
    // Prior local fixture state only. Fresh document personality is still
    // confirmed through the genuine radio after mount, never a runtime hook.
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.sound": options.sound ? "on" : "off", "vic.soundVol": "45", "vic.ambient": "off", "vic.reduceMotion": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, roam: false, jump: true, sleep: options.sleep ?? false, feeding: true, petting: false, learnFromYou: false, sound: options.sound ?? false, animalMode: options.cat ? "cat" : "default", heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...memory, energy: options.energy ?? .9, hunger: options.hunger ?? .05 }));
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, options });
  await page.goto(`/visual-fixture/studio?role=owner&y=2025&m=${options.summer ? 7 : 10}&hour=${options.night ? 21 : 12}&weather=clear`);
  await page.bringToFront(); await settlePanelLayout(page); await page.evaluate(() => document.fonts.ready);
  await expect(pet(page)).toBeVisible();
  // Prepare handles, measured point and read-only observation before the
  // greeting can start. After closing only focus/observe/native P remain.
  const interruption = options.interruptEntry ? await prepareNativeEntryInterruption(page) : undefined;
  await selectNative(page, options.personality ?? "balanced", options.roam ?? true, Boolean(interruption));
  if (interruption) { await interruptNativeEntryOnHomeFloor(page,interruption); return interruption.home; }
  const home = await openCompanionHome(page); await placeCompanionOnHomeFloor(page); await startProbe(page); return home;
}

/** Deliberately interrupt the newly chosen mischievous greeting through the
 * public keyboard placement. The observer captures the trusted key before
 * the normal product handler, never calling an engine/actor callback. */
async function prepareNativeEntryInterruption(page: Page) {
  const home = await openCompanionHome(page);
  const identity = (await pet(page).elementHandle())!;
  const bed = (await home.locator(".vc-plush-bed").boundingBox())!, floor = (await home.locator(".vc-home-floor").boundingBox())!;
  const point = { x: bed.x + bed.width / 2, y: floor.y + floor.height - COMPANION_HOME_FLOOR_INSET - 8 };
  await startProbe(page);
  await page.evaluate(() => {
    document.addEventListener("keydown", event => {
      const node = document.querySelector<HTMLElement>(".vc-companion"), p = (window as ProbeWindow).agency141;
      if (!p || !node || event.key.toLowerCase() !== "p" || !(event.target instanceof Node) || !node.contains(event.target)) return;
      const texture = node.querySelector<HTMLImageElement>(".vc-texture"), r = node.getBoundingClientRect();
      p.entryInterruption = { absolute: performance.now(), state: node.dataset.state ?? "", scene: node.dataset.personalityScene ?? "", pose: Number(node.dataset.pose ?? -1), trusted: event.isTrusted,
        visible: !document.hidden && !node.hidden && node.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) && r.width > 0 && r.height > 0,
        decoded: Boolean(texture?.complete && texture.naturalWidth && texture.getBoundingClientRect().width > 0) };
    }, { capture: true, once: true });
  });
  return { home, identity, point };
}

async function interruptNativeEntryOnHomeFloor(page: Page, prepared: Awaited<ReturnType<typeof prepareNativeEntryInterruption>>) {
  const { home, identity, point } = prepared;
  await actor(page).focus();
  // The actual first semantic beat of row31 must still be running while the
  // greeting is genuinely in flight; a historical completed frame cannot do.
  await expect.poll(async () => {
    const frame = await latest(page), actual = await now(page);
    return Boolean(frame && actual-frame.absolute < 100 && genuine(frame) && frame.scene === "entry-mischievous" && frame.state === "play"
      && companionSpriteMetadata.rows[31].includes(frame.pose));
  }, { timeout: 5000, intervals: [10] }).toBe(true);
  await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  const interrupted = await page.evaluate(() => (window as ProbeWindow).agency141!.entryInterruption!);
  expect(interrupted).toMatchObject({ trusted:true, scene:"entry-mischievous", state:"play", visible:true, decoded:true });
  expect(companionSpriteMetadata.rows[31]).toContain(interrupted.pose);
  const placingAt = await now(page);
  await page.mouse.click(point.x,point.y); await page.mouse.move(2,2);
  await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(async () => {
    const feet = await pet(page).evaluate(node => node.getBoundingClientRect().bottom), actualFloor = (await home.locator(".vc-home-floor").boundingBox())!;
    return Math.abs(feet-(actualFloor.y+actualFloor.height-COMPANION_HOME_FLOOR_INSET));
  }).toBeLessThan(2);
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
  const arrivedAt = await now(page);
  proofs.get(page)!.notes.push({ entryInterruptedNatively:interrupted, actualPlacingObservedAt:placingAt, actualFloorArrivedAt:arrivedAt, sameActorIdentity:true });
}

async function assertNativeEntryStayedInterrupted(page: Page) {
  const interrupted = await page.evaluate(() => (window as ProbeWindow).agency141!.entryInterruption!);
  const chosenAt = await page.evaluate(() => (window as ProbeWindow).agency141!.entryChosenAt!);
  expect(Number.isFinite(chosenAt)).toBe(true); expect(interrupted.absolute).toBeGreaterThan(chosenAt);
  const trace = await frames(page), entry = trace.filter(frame => frame.absolute>=chosenAt && genuine(frame) && frame.scene === "entry-mischievous" && frame.state === "play"
    && COMPANION_PLAY_TIMING.pounce.beats.some(beat => companionSpriteMetadata.rows[beat.row].includes(frame.pose)));
  expect(entry.length).toBeGreaterThan(0);
  const before = entry.filter(frame => frame.absolute <= interrupted.absolute);
  expect(before.length).toBeGreaterThan(0);
  expect(interrupted.absolute-before[0].absolute).toBeLessThan(COMPANION_PLAY_TIMING.pounce.beats[0].duration);
  // Retained first-frame labels cannot stand in for actual completion. The
  // recover row of the original entry must never finish after public P.
  expect(entry.some(frame => frame.absolute > interrupted.absolute && companionSpriteMetadata.rows[23].includes(frame.pose))).toBe(false);
  expect(entry.at(-1)!.absolute-entry[0].absolute).toBeLessThan(COMPANION_PLAY_TIMING.pounce.beats[0].duration);
  const meal = trace.find(frame => genuine(frame) && frame.scene === "routine-meal" && frame.state === "eat");
  expect(meal).toBeTruthy(); expect(meal!.absolute).toBeGreaterThan(interrupted.absolute);
  proofs.get(page)!.notes.push({ interruptedEntryNeverCompleted:true, nativeChoiceObservedAt:chosenAt, entryVisibleSpan:entry.at(-1)!.absolute-entry[0].absolute,
    actualMealAfterInterruptAt:meal!.absolute, interruptToMealMs:meal!.absolute-interrupted.absolute });
}

async function startProbe(page: Page) {
  await page.evaluate(() => {
    (window as ProbeWindow).agency141?.stop();
    let request = 0, last = -Infinity, stopped = false; const start = performance.now(), samples: Frame[] = [], humanControls: { at: number; action: string }[] = [];
    const recordHumanControl = (event: Event) => { const action = (event.target as Element | null)?.closest<HTMLElement>("[data-home-action]")?.dataset.homeAction; if (action && ["tv", "light", "curtain", "radio", "toys"].includes(action)) humanControls.push({ at: performance.now(), action }); };
    document.addEventListener("click", recordHumanControl, true);
    const readRect = (node?: Element | null): Rect | null => { if (!node) return null; const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const readTool = (selector: string): Tool | null => { const node = document.querySelector<HTMLElement>(selector), r = readRect(node); if (!node || !r) return null; const css = getComputedStyle(node); return { ...r, visible: !node.hidden && css.display !== "none" && css.visibility !== "hidden" && Number(css.opacity) > .05 && r.width > 0 && r.height > 0, transform: css.transform }; };
    const sample = (at: number) => {
      if (stopped) return;
      if (at - last >= 35) {
        last = at; const node = document.querySelector<HTMLElement>(".vc-companion"), texture = node?.querySelector<HTMLImageElement>(".vc-texture"), r = readRect(node), pad = readRect(document.querySelector(".vc-home-wash-pad")), roomNode = document.querySelector<HTMLElement>(".vc-home-room"), css = node && getComputedStyle(node);
        const facingNode = node?.querySelector(".vc-facing"), facingTransform = facingNode ? getComputedStyle(facingNode).transform : "none";
        const contacts: Frame["contacts"] = {};
        for (const [kind, selector] of [["tv", ".vc-home-tv-paint"], ["light", ".vc-home-lamp-handle"], ["curtain", ".vc-curtain-control > span"], ["radio", ".vc-radio-button .vc-object-paint"]] as const) { const rect = readRect(document.querySelector(selector)); if (rect) contacts[kind] = rect; }
        samples.push({ at: at - start, absolute: at, state: node?.dataset.state ?? "", scene: node?.dataset.personalityScene ?? "", beat: node?.dataset.personalityBeat ?? "", command: node?.dataset.personalityCommand || node?.dataset.homeReaching || "", effect: node?.dataset.personalityEffect ?? "", platform: node?.dataset.platform ?? "", pose: Number(node?.dataset.pose ?? -1),
          visible: Boolean(node && r?.width && !node.hidden && !document.hidden && css?.display !== "none" && css?.visibility !== "hidden" && Number(css?.opacity) > .05), decoded: Boolean(texture?.complete && texture.naturalWidth), x: r ? r.x + r.width / 2 : NaN, y: r ? r.y + r.height : NaN, rect: r, pad, padFoot: pad ? pad.y + pad.height * .72 : NaN,
          facing: node?.dataset.facing ?? "", facingScale: new DOMMatrixReadOnly(facingTransform).a, facingTransform, boxOpening: readRect(document.querySelector(".vc-home .vc-toy-box-opening")),
          washing: node?.hasAttribute("data-washing") ?? false, brush: readTool(".vc-wash-tool"), paw: readTool(".vc-home-touch-tool"), reaching: node?.hasAttribute("data-home-reaching") ?? false, grade: Number(css?.getPropertyValue("--vc-body-room-light") || 1), inertiaFilter: node?.querySelector(".vc-inertia") ? getComputedStyle(node.querySelector(".vc-inertia")!).filter : "",
          tv: roomNode?.dataset.tv ?? "off", lit: roomNode?.hasAttribute("data-lamp-lit") ?? false, curtain: document.querySelector<HTMLElement>(".vc-home-window")?.dataset.curtain ?? "", radio: document.querySelector('[data-home-action="radio"]')?.getAttribute("aria-pressed") === "true", room: readRect(roomNode), contacts,
          foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(food => ({ id: food.dataset.food ?? "", kind: food.dataset.kind ?? "", eating: food.hasAttribute("data-eating"), carried: food.hasAttribute("data-carried"), discarding: food.hasAttribute("data-discarding") })),
          toys: [...document.querySelectorAll<HTMLElement>(".vc-toy")].map(toy => ({ id: toy.dataset.toyId ?? "", carried: toy.dataset.carried === "true", held: toy.dataset.held === "true" })) });
      }
      if (at - start < 125_000) request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).agency141 = { frames: samples, humanControls, stop() { stopped = true; cancelAnimationFrame(request); document.removeEventListener("click", recordHumanControl, true); } }; request = requestAnimationFrame(sample);
  });
}
async function snapshot(page: Page, name: string) { mkdirSync(output, { recursive: true }); await page.screenshot({ path: resolve(output, `${test.info().title.replace(/[^a-z0-9]+/gi, "-")}-${name}.png`) }); }
async function waitElapsed(page: Page, since: number, milliseconds: number) { await expect.poll(async () => ((await latest(page))?.absolute ?? since) - since, { timeout: milliseconds + 5000, intervals: [100] }).toBeGreaterThanOrEqual(milliseconds); }
function contactWitness(trace: readonly Frame[], at: number, kind: "tv" | "light" | "curtain" | "radio") {
  return trace.filter(frame => frame.absolute <= at && frame.absolute >= at - 400 && genuine(frame) && frame.command === kind && frame.reaching && frame.paw?.visible && /^companion-home-floor/.test(frame.platform)).find(frame => {
    const control = frame.contacts[kind], paw = frame.paw!; if (!control || !frame.rect) return false;
    const x = paw.x + paw.width / 2, y = paw.y + paw.height / 2;
    return x >= control.x - 8 && x <= control.x + control.width + 8 && y >= control.y - 8 && y <= control.y + control.height + 8
      && Math.hypot(x - frame.x, y - (frame.y - frame.rect.height / 2)) <= frame.rect.height * 1.5;
  });
}
async function awaitEffect(page: Page, kind: "tv" | "light" | "curtain" | "radio", after: number, timeout = 80_000) {
  const value = (frame: Frame) => kind === "light" ? frame.lit : frame[kind];
  await expect.poll(async () => { const trace = await frames(page); return trace.some((frame, index) => index > 0 && frame.absolute > after && value(frame) !== value(trace[index - 1])); }, { timeout, intervals: [100] }).toBe(true);
  const trace = await frames(page), index = trace.findIndex((frame, index) => index > 0 && frame.absolute > after && value(frame) !== value(trace[index - 1]));
  const changed = trace[index], witnessed = contactWitness(trace, changed.absolute, kind);
  expect(witnessed, `first actual ${kind} value change must have prior painted physical contact`).toBeTruthy();
  const witness = witnessed!;
  proofs.get(page)!.notes.push({ actualSetter: kind, before: value(trace[index - 1]), after: value(changed), changedAt: changed.absolute, witnessedAt: witness.absolute, scene: witness.scene, beat: witness.beat, actualContact: witness.contacts[kind], paintedPaw: witness.paw, actor: witness.rect });
  return changed;
}
function assertEveryEffectWasPhysical(trace: readonly Frame[], after: number, kinds: readonly ("tv" | "light" | "curtain" | "radio")[]) {
  for (const kind of kinds) for (let index = 1; index < trace.length; index++) {
    const before = trace[index - 1], changed = trace[index];
    if (changed.absolute <= after || (kind === "light" ? changed.lit === before.lit : changed[kind] === before[kind])) continue;
    expect(contactWitness(trace, changed.absolute, kind), `${kind} changed at ${changed.absolute} without an actual painted reach/contact`).toBeTruthy();
  }
}

test("141 autonomous toy takeout visibly faces and touches the actual rim before a toy appears", async ({ page }) => {
  test.setTimeout(65000);
  const home = await fixture(page, { personality: "mischievous", hunger: .05, roam: false });
  await expect(page.locator(".vc-toy")).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).ambientPrank)).toBe(false);
  // This fixture deliberately starts every prank OFF. System takeout also
  // honors ambientPrank, so enable its existing human control before roaming;
  // an OFF-policy denial is not a failed physical rim/contact performance.
  await home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  await dialog.getByRole("tab", { name: "장난", exact: true }).click();
  await dialog.locator('[data-act="companion-hide"]').setChecked(true); await expect(dialog.locator('[data-act="companion-hide"]')).toBeChecked();
  await dialog.getByRole("tab", { name: "움직임", exact: true }).click();
  await dialog.locator('[data-act="companion-roam"]').setChecked(true); await expect(dialog.locator('[data-act="companion-roam"]')).toBeChecked();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await expect(dialog).toBeHidden(); await page.mouse.move(2, 2);
  proofs.get(page)!.notes.push({ initialAmbientPrank: false, autonomousTakeoutPermissionEnabledThroughNativeControl: true, originalOffDenialEvidence: "native-4-agency" });
  const began = await now(page);
  await expect.poll(async () => (await frames(page)).some(frame => frame.absolute >= began && frame.toys.length > 0), { timeout: 45000, intervals: [75] }).toBe(true);
  const trace = await frames(page), appeared = trace.find(frame => frame.absolute >= began && frame.toys.length > 0)!;
  expect(appeared.scene).toBe("M07"); expect(appeared.command).toBe("toy");
  const id = appeared.toys[0].id; expect(id).not.toBe("");
  const before = trace.filter(frame => frame.absolute < appeared.absolute && frame.absolute >= appeared.absolute - 400);
  const edgeDistance = (frame: Frame) => {
    const opening = frame.boxOpening, paw = frame.paw; if (!opening || !paw) return Infinity;
    const x = paw.x + paw.width / 2, y = paw.y + paw.height / 2, right = opening.x + opening.width, bottom = opening.y + opening.height;
    const outside = Math.hypot(x - Math.max(opening.x, Math.min(right, x)), y - Math.max(opening.y, Math.min(bottom, y)));
    return outside || Math.min(x - opening.x, right - x, y - opening.y, bottom - y);
  };
  const witnessed = before.find(frame => genuine(frame) && frame.scene === "M07" && frame.command === "toy" && frame.reaching && frame.paw?.visible
    && /^companion-home-floor(?:-\d+)?$/.test(frame.platform) && !frame.toys.some(toy => toy.id === id)
    && frame.boxOpening && frame.boxOpening.width > 0 && frame.boxOpening.height > 0 && edgeDistance(frame) <= 8);
  expect(witnessed, "the new physical ID needs a decoded body-floor reach and visible paw within8px of the actual rim in the preceding400ms").toBeTruthy();
  const witness = witnessed!, direction = witness.facing === "right" ? 1 : witness.facing === "left" ? -1 : 0;
  expect(direction).not.toBe(0); expect(Math.sign(witness.facingScale)).toBe(direction);
  expect((witness.paw!.x + witness.paw!.width / 2 - witness.x) * direction, "the actual facing layer must look toward its visible contacting paw").toBeGreaterThan(1);
  expect((witness.boxOpening!.x + witness.boxOpening!.width / 2 - witness.x) * direction).toBeGreaterThan(1);
  expect(appeared.absolute - witness.absolute).toBeLessThanOrEqual(400);
  expect(await page.evaluate(() => (window as ProbeWindow).agency141!.humanControls.filter(control => control.action === "toys"))).toEqual([]);
  proofs.get(page)!.notes.push({ initialToyCount: 0, autonomousScene: appeared.scene, actualNewToyId: id, appearedAt: appeared.absolute, witnessedAt: witness.absolute,
    rimDistance: edgeDistance(witness), actualOpening: witness.boxOpening, visiblePaw: witness.paw, actor: witness.rect, facing: witness.facing, facingTransform: witness.facingTransform, noManualToyTakeout: true });
  await snapshot(page, "actual-rim-contact-before-autonomous-takeout");
});

test("141 tidy actual wash stays on mat400 through lamp geometry delivery wheel and resize", async ({ page }) => {
  const home = await fixture(page, { personality: "tidy" });
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  await home.locator('[data-home-action="toys"]').click(); const toy = page.locator(".vc-toy"); await expect(toy).toHaveCount(1); await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 6000 });
  const id = (await toy.getAttribute("data-toy-id"))!; await actor(page).focus(); await actor(page).press("Space"); await page.mouse.move(2, 2);
  await expect(toy).toHaveCount(0, { timeout: 65_000 });
  await expect.poll(async () => (await frames(page)).some(frame => washing(frame)), { timeout: 35_000, intervals: [50] }).toBe(true);
  const first = (await frames(page)).find(frame => washing(frame))!; expect(["T05", "X-T-house", "routine-wash"]).toContain(first.scene);
  await expect(page.locator(".vc-wash-tool")).toBeVisible(); await snapshot(page, "brush-visible-before-geometry");
  const operations: number[] = [];
  await home.locator('[data-home-action="light"]').click(); operations.push(await now(page));
  await expect.poll(async () => { const frame = await latest(page); return frame && washing(frame) ? Math.abs(frame.y - frame.padFoot) : Infinity; }, { timeout: 700, intervals: [35] }).toBeLessThan(2.5);
  const calendar = (await page.locator(".studio-calendar-panel, .public-calendar-area").first().boundingBox())!;
  await page.mouse.move(calendar.x + calendar.width / 2, calendar.y + calendar.height / 2); await page.mouse.wheel(0, 150); operations.push(await now(page));
  await page.setViewportSize({ width: 1860, height: 1040 }); operations.push(await now(page)); await page.mouse.move(2, 2);
  await expect.poll(async () => { const frame = await latest(page); return frame && frame.absolute > operations.at(-1)! + 100 && washing(frame) ? Math.abs(frame.y - frame.padFoot) : Infinity; }, { timeout: 900, intervals: [35] }).toBeLessThan(2.5);
  await expect.poll(async () => { const washed = (await frames(page)).filter(frame => washing(frame) && frame.scene === first.scene); return washed.length > 1 ? washed.at(-1)!.absolute - washed[0].absolute : 0; }, { timeout: 4000, intervals: [50] }).toBeGreaterThanOrEqual(500);
  const washed = (await frames(page)).filter(frame => washing(frame) && frame.scene === first.scene), stable = washed.filter(frame => operations.every(at => frame.absolute < at || frame.absolute > at + 100));
  expect(stable.length).toBeGreaterThan(3); expect(stable.every(frame => Math.abs(frame.y - frame.padFoot) < 2.5 && Math.abs(frame.x - (frame.pad!.x + frame.pad!.width / 2)) < 2.5)).toBe(true);
  expect(washed.some(frame => frame.absolute > operations.at(-1)! && frame.pad && (Math.abs(frame.pad.x - first.pad!.x) > .5 || Math.abs(frame.pad.y - first.pad!.y) > .5)), "resize must actually move the measured mat, not merely fire an input").toBe(true);
  expect(new Set(washed.map(frame => frame.brush!.transform)).size).toBeGreaterThan(3);
  await expect.poll(async () => (await frames(page)).some(frame => genuine(frame) && frame.scene === first.scene && Number(frame.beat) > Number(first.beat)), { timeout: 12_000, intervals: [100] }).toBe(true);
  proofs.get(page)!.notes.push({ actualReturnedToyId: id, washScene: first.scene, paintedContactMs: washed.at(-1)!.absolute - washed[0].absolute, geometryInputsAt: operations, stableMatFrames: stable.length });
});

test("141 manual curtain cycles three phases with15s lease then homebody physically changes curtain light and TV", async ({ page }) => {
  const home = await fixture(page, { personality: "tidy", summer: true }), homeWindow = home.locator(".vc-home-window"), curtain = home.locator('[data-home-action="curtain"]'), lamp = home.locator('[data-home-action="light"]'), tv = home.locator('[data-home-action="tv"]');
  const phases = ["open", "shade", "closed"], initial = (await homeWindow.getAttribute("data-curtain"))!;
  for (let step = 1; step <= 3; step++) { await curtain.click(); await expect(homeWindow).toHaveAttribute("data-curtain", phases[(phases.indexOf(initial) + step) % 3]); }
  while (await homeWindow.getAttribute("data-curtain") !== "open") await curtain.click();
  if (await lamp.getAttribute("aria-pressed") === "true") await lamp.click(); await lamp.click();
  for (let step = 0; step < 6; step++) await tv.click(); await expect(home.locator(".vc-home-room")).toHaveAttribute("data-tv", "off");
  await curtain.click(); await curtain.click(); await curtain.click(); await expect(homeWindow).toHaveAttribute("data-curtain", "open");
  const manualAt = await page.evaluate(() => (window as ProbeWindow).agency141?.humanControls.filter(control => control.action === "curtain").at(-1)?.at ?? -1); expect(manualAt).toBeGreaterThan(0);
  // The final human click is captured before React paints its new phase.
  // Establish that actual paint separately; it is not an autonomous setter.
  await expect.poll(async () => { const frame = await latest(page); return Boolean(frame && frame.absolute > manualAt && frame.curtain === "open" && frame.lit && frame.tv === "off"); }, { timeout: 1000, intervals: [35] }).toBe(true);
  const automaticAfter = (await latest(page))!.absolute;
  expect(automaticAfter - manualAt, "the final manual state must settle promptly before observing autonomous effects").toBeLessThan(1000);
  proofs.get(page)!.notes.push({ manualCurtainClickAt: manualAt, actualManualPaintAt: automaticAfter, manualLeaseMs: 15_000 });
  await selectNative(page, "homebody", true);
  await waitElapsed(page, manualAt, 15_000);
  const protectedFrames = (await frames(page)).filter(frame => frame.absolute > manualAt && frame.absolute < manualAt + 14_900);
  expect(protectedFrames.length).toBeGreaterThan(100); expect(protectedFrames.every(frame => frame.curtain === "open")).toBe(true);
  await awaitEffect(page, "curtain", automaticAfter); await awaitEffect(page, "light", automaticAfter); await awaitEffect(page, "tv", automaticAfter);
  const trace = await frames(page); expect(trace.some(frame => frame.state === "sleep")).toBe(false);
  await expect.poll(async () => (await frames(page)).some(frame => genuine(frame) && frame.tv === "tori" && !frame.lit && frame.curtain === "closed"), { timeout: 20_000, intervals: [100] }).toBe(true);
  await snapshot(page, "actual-homebody-theatre");
  assertEveryEffectWasPhysical(await frames(page), automaticAfter, ["curtain", "light", "tv"]);
});

test("141 audible radio routine reaches the actual shelf before playback changes", async ({ page }) => {
  const home = await fixture(page, { personality: "homebody", sound: true, night: true });
  await expect(home.locator('[data-home-action="radio"]')).toHaveAttribute("aria-pressed", "false");
  const began = await now(page); const changed = await awaitEffect(page, "radio", began, 95_000); expect(changed.radio).toBe(true);
  await expect(home.locator(".vc-radio-notes")).toBeVisible(); await snapshot(page, "actual-radio-contact-and-notes");
  assertEveryEffectWasPhysical(await frames(page), began, ["radio"]);
  proofs.get(page)!.notes.push({ globalSoundInitiallyOn: true, companionSoundInitiallyOn: true, nativeInitialGesture: "book/settings", audioContextOrPlaybackMethodOverridden: false });
});

test("141 unlit room grades the actual resident and native outside placement restores brightness", async ({ page }) => {
  const home = await fixture(page, { personality: "balanced", night: true, roam: false }), lamp = home.locator('[data-home-action="light"]');
  if (await lamp.getAttribute("aria-pressed") === "true") await lamp.click(); await expect(lamp).toHaveAttribute("aria-pressed", "false");
  await expect.poll(async () => (await latest(page))?.grade ?? 1).toBeLessThan(.75);
  // The room token changes before the finite body-filter transition settles.
  await expect.poll(async () => { const frame = await latest(page); const level = Number(frame?.inertiaFilter.match(/brightness\(([^)]+)\)/)?.[1] ?? 1); return frame ? Math.abs(level - frame.grade) : 1; }, { timeout: 1000, intervals: [35] }).toBeLessThan(.02);
  const dark = (await latest(page))!; expect(dark.grade).toBeGreaterThanOrEqual(.5); expect(dark.inertiaFilter).toMatch(/brightness\(0\.[5-7]/);
  await snapshot(page, "resident-lamp-off");
  const room = (await home.locator(".vc-home-room").boundingBox())!;
  const target = await page.locator('[data-act="calendar-cell"]').evaluateAll((nodes, room) => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height * .65, width: r.width, height: r.height }; }).find(point => point.width > 70 && point.height > 45 && point.x > room.x + room.width + 120 && point.y > 130 && point.y < innerHeight - 100), room);
  expect(target).toBeTruthy(); await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(target!.x, target!.y); await page.mouse.move(2, 2); await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).not.toHaveAttribute("data-platform", /^companion-home/);
  await expect.poll(async () => (await latest(page))?.grade).toBe(1); await expect(pet(page).locator(".vc-inertia")).toHaveCSS("filter", "brightness(1)");
  await snapshot(page, "outside-brightness-restored");
});

for (const personality of COMPANION_PERSONALITIES) test(`141 common ${personality} actual middle-hunger meal is followed by real mat washing`, async ({ page }) => {
  const home = await fixture(page, { personality, hunger: .5, interruptEntry: personality === "mischievous" });
  await expect.poll(async () => (await frames(page)).some(frame => genuine(frame) && frame.state === "eat" && frame.foods.some(food => food.eating && !food.discarding)), { timeout: 65_000, intervals: [100] }).toBe(true);
  const eating = (await frames(page)).find(frame => genuine(frame) && frame.state === "eat" && frame.foods.some(food => food.eating && !food.discarding))!, food = eating.foods.find(food => food.eating && !food.discarding)!;
  await expect.poll(async () => (await frames(page)).some(frame => frame.absolute > eating.absolute && !frame.foods.some(item => item.id === food.id)), { timeout: 15_000, intervals: [100] }).toBe(true);
  const consumed = (await frames(page)).find(frame => frame.absolute > eating.absolute && !frame.foods.some(item => item.id === food.id))!;
  const actualCollection = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}").foods ?? [], COMPANION_COLLECTION_KEY); expect(actualCollection).toContain(food.kind);
  await expect.poll(async () => (await frames(page)).some(frame => frame.absolute > consumed.absolute && washing(frame) && frame.scene === "routine-wash"), { timeout: 35_000, intervals: [100] }).toBe(true);
  await expect.poll(async () => { const washed = (await frames(page)).filter(frame => frame.absolute > consumed.absolute && washing(frame) && frame.scene === "routine-wash"); return washed.length > 1 ? washed.at(-1)!.absolute - washed[0].absolute : 0; }, { timeout: 5000, intervals: [50] }).toBeGreaterThanOrEqual(500);
  const realFloor = (await home.locator(".vc-home-floor").boundingBox())!;
  const floorY = realFloor.y + realFloor.height - COMPANION_HOME_FLOOR_INSET;
  await expect.poll(async () => {
    const trace = await frames(page), washed = trace.filter(frame => frame.absolute > consumed.absolute && washing(frame) && frame.scene === "routine-wash");
    const lastWash = washed.at(-1); if (!lastWash) return false;
    // Only this routine's next required go (beat2) can prove its exit. A
    // different later owner cannot substitute for its omitted continuation.
    const exit = trace.filter(frame => genuine(frame) && frame.absolute > lastWash.absolute && frame.scene === "routine-wash" && frame.beat === "2" && frame.command === "go");
    const moved = exit.some(frame => ["walk", "jump"].includes(frame.state) && Math.hypot(frame.x-lastWash.x,frame.y-lastWash.y) >= 24);
    const arrived = exit.find(frame => /^companion-home-floor(?:-\d+)?$/.test(frame.platform) && frame.platform !== "companion-home-floor-400"
      && Math.abs(frame.y-floorY) < 2.5 && frame.x >= realFloor.x && frame.x <= realFloor.x+realFloor.width);
    if (!moved || !arrived) return false;
    const rows = personality === "mischievous" ? [17] : personality === "sleepy" ? [16] : COMPANION_PLAY_TIMING.bow.beats.map(beat => beat.row);
    const finalState = personality === "mischievous" ? "shake" : personality === "sleepy" ? "stretch" : "play";
    const finish = trace.filter(frame => genuine(frame) && frame.absolute >= arrived.absolute && frame.scene === "routine-wash" && frame.beat === "3" && frame.command === "pose"
      && frame.platform === arrived.platform && frame.state === finalState && rows.some(row => companionSpriteMetadata.rows[row].includes(frame.pose)));
    const expectedMs = personality === "mischievous" || personality === "sleepy" ? 900 : companionPlayDuration("bow");
    return finish.length >= 2 && finish.at(-1)!.absolute-finish[0].absolute >= expectedMs*.8-80;
  }, { timeout: 12_000, intervals: [50] }).toBe(true);
  if (personality === "mischievous") await assertNativeEntryStayedInterrupted(page);
  const trace = await frames(page); expect(trace.filter(frame => frame.state === "eat" && frame.foods.some(item => item.id === food.id)).length).toBeGreaterThan(2);
  expect(trace.some(frame => frame.foods.some(item => item.id === food.id && item.discarding))).toBe(false);
  proofs.get(page)!.notes.push({ personalityChosenNatively: personality, initialHunger: .5, initialAnimalPreference: "default", foodId: food.id, earnedKind: food.kind, realMealBeforeWash: true, sameRoutineActualExitAndFinishingGesture: true });
  if (await page.locator(".vc-wash-tool").isVisible()) await snapshot(page, "common-meal-then-brush");
});

for (const night of [false, true]) test(`141 ${night ? "night sleep" : "day nap"} uses curtain lamp sofa then actually sleeps and wakes`, async ({ page }) => {
  await fixture(page, { personality: "balanced", hunger: .05, energy: .25, sleep: true, night });
  await expect.poll(async () => (await frames(page)).some(frame => genuine(frame) && frame.state === "sleep" && frame.platform === "companion-home" && !frame.lit && frame.curtain === "closed"), { timeout: 80_000, intervals: [100] }).toBe(true);
  const sleeping = (await frames(page)).find(frame => genuine(frame) && frame.state === "sleep")!;
  expect(sleeping.scene).toBe(night ? "routine-sleep" : "routine-nap");
  await expect.poll(async () => { const painted = (await frames(page)).filter(frame => genuine(frame) && frame.scene === sleeping.scene && frame.state === "sleep"); return painted.length > 1 ? painted.at(-1)!.absolute - painted[0].absolute : 0; }, { timeout: 6000, intervals: [50] }).toBeGreaterThanOrEqual(500);
  await expect.poll(async () => (await frames(page)).some(frame => genuine(frame) && frame.absolute > sleeping.absolute && frame.scene === sleeping.scene && frame.state === "stretch"), { timeout: 12_000, intervals: [50] }).toBe(true);
  const trace = await frames(page);
  for (const kind of ["light", "curtain"] as const) {
    const index = trace.findIndex((frame, index) => index > 0 && (kind === "light" ? frame.lit !== trace[index - 1].lit : frame.curtain !== trace[index - 1].curtain));
    expect(index).toBeGreaterThan(0); expect(contactWitness(trace, trace[index].absolute, kind)).toBeTruthy();
  }
  await snapshot(page, "awake-after-real-sleep");
});

for (const night of [false, true]) test(`141 automatic sleep OFF prevents ${night ? "night" : "day"} sleeping even at low energy`, async ({ page }) => {
  await fixture(page, { personality: "balanced", hunger: .05, energy: .25, sleep: false, night });
  const began = await now(page); await waitElapsed(page, began, 28_000);
  const trace = (await frames(page)).filter(frame => frame.absolute >= began);
  expect(trace.length).toBeGreaterThan(100); expect(trace.some(frame => genuine(frame))).toBe(true);
  expect(trace.some(frame => frame.state === "sleep" || frame.scene === "routine-sleep" || frame.scene === "routine-nap")).toBe(false);
  proofs.get(page)!.notes.push({ initialEnergy: .25, sleep: false, night, observedActiveMilliseconds: trace.at(-1)!.absolute - trace[0].absolute });
});

test("141 compact home reaches the real curtain cord and lamp before a finite night sleep", async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 1100 });
  const home = await fixture(page, { personality: "balanced", hunger: .05, energy: .25, sleep: true, night: true });
  await expect(home).toHaveAttribute("data-home-presentation", "compact");
  const began = await now(page);
  await expect.poll(async () => (await frames(page)).some(frame => genuine(frame) && frame.state === "sleep" && frame.platform === "companion-home" && !frame.lit && frame.curtain === "closed"), { timeout: 80_000, intervals: [100] }).toBe(true);
  assertEveryEffectWasPhysical(await frames(page), began, ["curtain", "light"]);
  const trace = await frames(page), asleep = trace.find(frame => genuine(frame) && frame.state === "sleep")!;
  expect(asleep.room!.width).toBeGreaterThan(400);
  await expect.poll(async () => (await frames(page)).some(frame => genuine(frame) && frame.absolute > asleep.absolute && frame.state === "stretch" && frame.scene === "routine-sleep"), { timeout: 12_000, intervals: [50] }).toBe(true);
  await snapshot(page, "compact-room-awake");
});

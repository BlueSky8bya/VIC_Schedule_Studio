import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { COMPANION_PLAY_TIMING } from "@/lib/ui/viewer-companion/timing";
import { getCompanionBehaviorProfile } from "@/lib/ui/viewer-companion/behavior-profile";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const output = ".scratch-pw/companion-122/behavior";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
type Sample = { at: number; state: string; personality: string; play: string; pose: number; scene: string; toyAction: string; household: string; living: string; x: number; y: number; platform: string; decoded: boolean; hidden: boolean; foodIds: string[]; dispenser?: { x: number; y: number; width: number; height: number; bottom: number }; toys: { id: string; carried: boolean; held: boolean; x: number; y: number; modelX: number; modelY: number }[] };
type Probe = { samples: Sample[]; stop: () => void };
type ProbeWindow = Window & { personality122?: Probe };
type Proof = { writes: string[]; foreign: string[]; errors: string[]; build: string; notes: unknown[] };
const proofs = new WeakMap<Page, Proof>();
test.use({ headless: true, viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.setTimeout(90000);
test.beforeEach(async ({ page }) => {
  const proof: Proof = { writes: [], foreign: [], errors: [], notes: [], build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim() }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "No fixture writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live API in fixture" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!;
  const samples = await page.evaluate(() => { const probe = (window as ProbeWindow).personality122; probe?.stop(); return probe?.samples ?? []; }).catch(() => []);
  mkdirSync(output, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  const path = resolve(output, name + ".json");
  writeFileSync(path, JSON.stringify({ ...proof, status: info.status, samples, recordedAt: new Date().toISOString(), afterBuild: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), scope: "Actual local native fixture input. No RNG, clock, geometry, style or brain-state injection; initial saved preferences/care only. Not an OBS/production/device claim." }, null, 2));
  await info.attach("native-personality-toys", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(proof.writes).toEqual([]); expect(proof.foreign).toEqual([]); expect(proof.errors).toEqual([]);
});
async function setup(page: Page, personality: CompanionPersonality, options: { jump?: boolean; hunger?: number } = {}) {
  await page.addInitScript(({ personality, options, preferences, memory, epoch, epochKey }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, personality, jump: options.jump ?? true, sleep: false, sound: false }), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: options.hunger ?? .05 }), "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
  }, { personality, options, preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY });
  await page.goto("/visual-fixture/poster?avatar=1&ambient=autumn"); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(page.locator(".vc-companion")).toBeVisible();
  await startProbe(page);
}
async function startProbe(page: Page) {
  await page.evaluate(() => {
    (window as ProbeWindow).personality122?.stop();
    const began = performance.now(); let request = 0, last = -Infinity, stopped = false, dispenserRead = false;
    const samples: Sample[] = [];
    const sample = (now: number) => {
      if (stopped) return;
      if (now - last >= 50) {
        last = now; const pet = document.querySelector<HTMLElement>(".vc-companion"), texture = pet?.querySelector<HTMLImageElement>(".vc-texture"), rect = pet?.getBoundingClientRect();
        const dispenserPhase = pet?.dataset.household === "mischief" && pet.dataset.state === "look";
        const outlet = dispenserPhase && !dispenserRead ? document.querySelector(".vc-home .vc-dispenser-slot")?.getBoundingClientRect() : undefined;
        dispenserRead = Boolean(dispenserPhase);
        samples.push({ at: now - began, state: pet?.dataset.state ?? "", personality: pet?.dataset.personalityActivity ?? "", play: pet?.dataset.play ?? "", pose: Number(pet?.dataset.pose ?? -1), scene: pet?.dataset.scene ?? "", toyAction: pet?.dataset.toyAction ?? "", household: pet?.dataset.household ?? "", living: pet?.dataset.living ?? "", x: rect ? rect.left + rect.width / 2 : NaN, y: rect?.bottom ?? NaN, platform: pet?.dataset.platform ?? "", decoded: Boolean(texture?.complete && texture.naturalWidth), hidden: !pet || pet.hidden || document.hidden, foodIds: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(food => food.dataset.food!),
          ...(outlet ? { dispenser: { x: outlet.x, y: outlet.y, width: outlet.width, height: outlet.height, bottom: outlet.bottom } } : {}),
          toys: [...document.querySelectorAll<HTMLElement>(".vc-toy")].map(toy => { const rect = toy.getBoundingClientRect(), position = toy.style.transform.match(/^translate3d\(([-\d.]+)px,\s*([-\d.]+)px/); return { id: toy.dataset.toyId!, carried: toy.dataset.carried === "true", held: toy.dataset.held === "true", x: rect.left + rect.width / 2, y: rect.bottom, modelX: Number(position?.[1] ?? NaN), modelY: Number(position?.[2] ?? NaN) }; }) });
      }
      if (now - began < 80000) request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).personality122 = { samples, stop: () => { stopped = true; cancelAnimationFrame(request); } }; request = requestAnimationFrame(sample);
  });
}
const samples = (page: Page) => page.evaluate(() => (window as ProbeWindow).personality122!.samples);
function renderedPlay(sample: Sample) {
  if (sample.state !== "play" || !sample.decoded || sample.hidden) return false;
  const timing = COMPANION_PLAY_TIMING[sample.play as keyof typeof COMPANION_PLAY_TIMING];
  return Boolean(timing?.beats.some(beat => companionSpriteMetadata.rows[beat.row].includes(sample.pose)));
}
function renderedSignature(sample: Sample, personality: CompanionPersonality) { return sample.personality === personality && renderedPlay(sample); }
function meaningfulPersonalityActions(trace: readonly Sample[], personality: CompanionPersonality) {
  const profile = getCompanionBehaviorProfile({ ...DEFAULT_COMPANION_PREFERENCES, personality });
  const result: { kind: string; witness: Sample; from?: Sample; displacement?: number; changedSupport?: boolean }[] = [];
  let from: Sample | undefined, previous: Sample | undefined, owner = "", progressed = false, signatureSeen = false;
  const carried = new Set<string>();
  for (const sample of trace) {
    const decoded = sample.decoded && !sample.hidden;
    if (renderedSignature(sample, personality)) { result.push({ kind: "matching-performance", witness: sample }); signatureSeen = true; }
    const toyOwner = sample.toyAction === (personality === "tidy" ? "tidy" : "play");
    const fittingLiving = sample.living === "social" && personality === "affectionate" || sample.living === "cheer" && personality === "performer" || sample.living === "cozy" && ["sleepy", "homebody"].includes(personality);
    const newCarry = sample.toys.filter(toy => toy.carried && !toy.held && !carried.has(toy.id));
    for (const toy of sample.toys) if (toy.carried && !toy.held) carried.add(toy.id);
    if (decoded && toyOwner && newCarry.length) result.push({ kind: "actual-toy-pick", witness: sample });
    if (renderedPlay(sample) && (fittingLiving || toyOwner && sample.toys.some(toy => carried.has(toy.id) && !toy.held))) result.push({ kind: fittingLiving ? "matching-social-or-home-performance" : "actual-toy-performance", witness: sample });
    // Source-authored rare/context jobs remain meaningful after the first
    // decoded fitting expression. Their tag alone never proves progress.
    const allowedHousehold = sample.household === "tidy" && profile.tidyWeight > 0 || sample.household === "mischief" && profile.mischiefWeight > 0 && DEFAULT_COMPANION_PREFERENCES.ambientPrank;
    const nextOwner = signatureSeen && allowedHousehold ? "household:" + sample.household : toyOwner ? "toy:" + sample.toyAction : "";
    if (!decoded || !nextOwner || !sample.platform || !Number.isFinite(sample.x) || !Number.isFinite(sample.y)) { from = previous = undefined; owner = ""; progressed = false; continue; }
    if (owner !== nextOwner) { from = previous = undefined; progressed = false; owner = nextOwner; }
    if (["walk", "jump"].includes(sample.state)) {
      from ??= sample;
      const displacement = Math.hypot(sample.x - from.x, sample.y - from.y), changedSupport = sample.platform !== from.platform;
      // A new actual landing or ground walk proves24px forward progress.
      // The following witnesses require continued real horizontal motion or
      // another landing; a stationary goal tag/in-place jump arc is excluded.
      if (!progressed && displacement >= 24 && (changedSupport || sample.state === "walk" && Math.abs(sample.x - from.x) >= 24)) { progressed = true; result.push({ kind: owner + "-progress", from, witness: sample, displacement, changedSupport }); }
      else if (progressed && previous && (sample.platform !== previous.platform || Math.abs(sample.x - previous.x) >= .5)) result.push({ kind: owner + "-continued-progress", witness: sample });
    }
    previous = sample;
  }
  return result;
}
function meaningfulPersonalityAction(trace: readonly Sample[], personality: CompanionPersonality) { return meaningfulPersonalityActions(trace, personality).find(proof => proof.witness.at <= 10000); }
for (const personality of COMPANION_PERSONALITIES) test("122 " + personality + " starts a meaningful personality action within ten seconds and stays active for twenty-two seconds", async ({ page }) => {
  await setup(page, personality);
  // Always retain at least22s, including an initial-deadline failure. The
  // evidence's first10s and recurring gaps keep the same strict10s limit.
  await expect.poll(async () => (await samples(page)).at(-1)?.at ?? 0, { timeout: 24000, intervals: [100] }).toBeGreaterThanOrEqual(22000);
  const trace = await samples(page), observed = meaningfulPersonalityActions(trace, personality), proof = meaningfulPersonalityAction(trace, personality);
  const points = [0, ...observed.map(item => Math.max(0, item.witness.at)), trace.at(-1)!.at].sort((a, b) => a - b);
  const gaps = points.slice(1).map((at, index) => ({ from: points[index], to: at, ms: at - points[index] }));
  const firstCarry = trace.find(sample => sample.decoded && !sample.hidden && sample.toys.some(toy => toy.carried && !toy.held));
  const initialFoods = new Set(trace[0]?.foodIds ?? []), firstNewFood = trace.find(sample => sample.foodIds.some(id => !initialFoods.has(id)));
  const firstAsk = trace.find(sample => sample.play === "ask-petting" && renderedPlay(sample));
  const firstSignature = trace.find(sample => renderedSignature(sample, personality)), firstJob = trace.find(sample => sample.household || sample.toyAction);
  proofs.get(page)!.notes.push({ firstMeaningfulPersonalityAction: proof ?? null, firstSignature: firstSignature ?? null, firstSecondaryJob: firstJob ?? null, observedThrough: trace.at(-1)!.at, maximumMeaningfulGap: Math.max(...gaps.map(gap => gap.ms)), longestGaps: [...gaps].sort((a, b) => b.ms - a.ms).slice(0, 5), actualResultTimestamps: { firstCarry: firstCarry?.at ?? null, firstAsk: firstAsk?.at ?? null, firstNewFood: firstNewFood?.at ?? null }, travelDoesNotProveCompletedEffect: true, idleLookGenericTravelAndTagsAloneDoNotCount: true });
  expect(firstSignature, "a new job cannot replace the first fitting expression").toBeDefined();
  expect(firstSignature!.at).toBeLessThanOrEqual(10000);
  if (firstJob) expect(firstSignature!.at, "the first decoded expression precedes a new errand").toBeLessThanOrEqual(firstJob.at);
  expect(proof, "a rendered fitting action or actual purposeful progress starts within10s").toBeDefined();
  expect(Math.max(...gaps.map(gap => gap.ms)), "no interval exceeds10s without actual fitting performance or meaningful progress").toBeLessThanOrEqual(10000);
});

test("122 full tidy actually picks carries and returns all four naturally dispensed toys", async ({ page }) => {
  await setup(page, "tidy"); await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), pet = page.locator(".vc-companion");
  await actor.focus(); await actor.press("Space"); await expect(pet).toHaveAttribute("data-state", "held");
  const box = page.getByRole("region", { name: "빅타민 집", exact: true }).locator("[data-home-action=toys]");
  const ids: string[] = [];
  for (let index = 0; index < 4; index++) {
    await box.click(); await expect(page.locator(".vc-toy")).toHaveCount(index + 1);
    const toy = page.locator(".vc-toy").last(); await expect(toy).toBeVisible();
    const positionTransition = await toy.evaluate(node => { const style = getComputedStyle(node), properties = style.transitionProperty.split(","), durations = style.transitionDuration.split(",").map(value => parseFloat(value)); return { properties, durations, delaysPosition: properties.some((property, index) => ["all", "transform"].includes(property.trim()) && durations[index % durations.length] > 0) }; });
    proofs.get(page)!.notes.push({ actualToyPositionTransition: positionTransition });
    expect(positionTransition.delaysPosition, "the shared physics clock must paint actual toy position without a second button spring").toBe(false);
    await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 5000 });
    await expect(toy).toHaveAttribute("data-platform", /^companion-home-floor(?:-food)?(?:-\d+)?$/);
    ids.push((await toy.getAttribute("data-toy-id"))!);
  }
  const boxBounds = (await box.locator(".vc-toy-box-opening").boundingBox())!, opening = { x: boxBounds.x + boxBounds.width / 2, y: boxBounds.y + boxBounds.height };
  proofs.get(page)!.notes.push({ actualFourToyIds: ids, actualOpening: opening, settledBeforeRelease: (await samples(page)).at(-1) });
  await startProbe(page); await actor.focus(); await actor.press("Space"); await page.mouse.move(2, 2);
  await expect(pet).not.toHaveAttribute("data-state", "held");
  await expect(page.locator(".vc-toy")).toHaveCount(0, { timeout: 65000 });
  const trace = await samples(page);
  for (const id of ids) {
    const carried = trace.filter(sample => sample.toys.some(toy => toy.id === id && toy.carried));
    expect(carried.length, id + " was actually carried before removal").toBeGreaterThanOrEqual(2);
    const displayErrors = carried.map(sample => { const toy = sample.toys.find(toy => toy.id === id)!; return Math.hypot(toy.x - toy.modelX, toy.y - toy.modelY); });
    expect(Math.max(...displayErrors), id + " actual carry display follows the shared model position").toBeLessThan(1);
    const last = carried.at(-1)!;
    const delivered = last.toys.find(toy => toy.id === id)!;
    expect(Math.hypot(delivered.x - opening.x, delivered.y - opening.y), id + " reaches the real box opening before disappearing").toBeLessThan(20);
    expect(trace.some(sample => sample.at > last.at && !sample.toys.some(toy => toy.id === id)), id + " returned only after physical carry").toBe(true);
  }
  expect(trace.every(sample => sample.toys.length <= 4 && !sample.hidden && sample.decoded)).toBe(true);
  expect(trace.some(sample => sample.state === "eat")).toBe(false);
  proofs.get(page)!.notes.push({ actualFourToyIds: ids, actualOpening: opening, noNativeInputAfterRelease: true, completedAt: trace.at(-1)!.at });
});

test("122 mischievous completes a real dispenser food spawn from native home placement", async ({ page }) => {
  await setup(page, "mischievous"); await openCompanionHome(page); await placeCompanionOnHomeFloor(page);
  const slot = page.locator(".vc-home .vc-dispenser-slot"), pet = page.locator(".vc-companion");
  const initialSlot = (await slot.boundingBox())!, initialPet = (await pet.boundingBox())!;
  const initialFoods = await page.locator(".vc-food").evaluateAll(nodes => nodes.map(node => (node as HTMLElement).dataset.food!));
  proofs.get(page)!.notes.push({ nativePlacementOnly: true, actualInitialSlot: initialSlot, actualInitialRecipient: { x: initialPet.x + initialPet.width / 2, y: initialPet.y + initialPet.height }, initialFoods });
  await startProbe(page); await page.mouse.move(2, 2);
  await expect.poll(async () => (await samples(page)).some(sample => sample.foodIds.some(id => !initialFoods.includes(id))), { timeout: 45000, intervals: [100] }).toBe(true);
  const trace = await samples(page), appeared = trace.find(sample => sample.foodIds.some(id => !initialFoods.includes(id)));
  const effectSamples = trace.filter(sample => sample.dispenser).map(sample => ({ at: sample.at, outlet: sample.dispenser, actualRecipient: { x: sample.x, y: sample.y }, platform: sample.platform, decoded: sample.decoded, hidden: sample.hidden }));
  proofs.get(page)!.notes.push({ firstActualFood: appeared ?? null, actualDispenserAttempts: effectSamples, noManualFoodOrToySpawn: true });
  expect(appeared).toBeDefined(); expect(appeared!.at).toBeLessThanOrEqual(45000); expect(effectSamples.length).toBeGreaterThan(0);
  await expect(page.locator(".vc-food").first()).toBeVisible();
});

test("122 hungry jump-OFF companion stays meaningfully active when a real high snack is unreachable", async ({ page }) => {
  await setup(page, "gourmet", { jump: false, hunger: .7 }); await openCompanionHome(page);
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true }), pet = page.locator(".vc-companion");
  const floorY = await page.evaluate(() => {
    const bars = [...document.querySelectorAll<HTMLElement>(".agenda-monthbar")].filter(node => getComputedStyle(node).position === "fixed").map(node => node.getBoundingClientRect());
    return Math.min(innerHeight - 18, ...bars.filter(rect => rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1).map(rect => rect.top - 8));
  });
  await actor.focus(); await actor.press("p"); await page.mouse.click(470, floorY);
  await expect(pet).toHaveAttribute("data-platform", /^viewport-floor/); await expect(pet).not.toHaveAttribute("data-state", "jump");
  await actor.focus(); await actor.press("Space"); await expect(pet).toHaveAttribute("data-state", "held");
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  const food = page.locator(".vc-food").first(); await expect(food).toBeVisible(); await expect(food).not.toHaveAttribute("data-falling");
  const target = await page.locator(".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]").evaluateAll(nodes => {
    const rect = nodes.map(node => node.getBoundingClientRect()).find(rect => rect.width > 100 && rect.height > 20 && rect.top > 100 && rect.bottom < innerHeight - 200);
    return rect ? { x: rect.left + rect.width / 2, y: rect.top - 5 } : null;
  });
  expect(target, "fixture has an actual high card support").not.toBeNull();
  const rect = (await food.boundingBox())!, point = await food.evaluate(node => { const matrix = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return { x: matrix.m41, y: matrix.m42 }; });
  const grip = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down(); await page.mouse.move(target!.x + grip.x - point.x, target!.y + grip.y - point.y, { steps: 14 }); await page.mouse.up(); await page.mouse.move(2, 2);
  await expect(food).not.toHaveAttribute("data-falling");
  const snackBounds = (await food.boundingBox())!;
  expect(snackBounds.y + snackBounds.height).toBeLessThan(floorY - 150);
  await startProbe(page); await actor.focus(); await actor.press("Space"); await page.mouse.move(2, 2);
  await expect.poll(async () => (await samples(page)).some(sample => renderedSignature(sample, "gourmet")), { timeout: 10000, intervals: [50] }).toBe(true);
  expect((await samples(page)).some(sample => sample.state === "eat")).toBe(false);
  proofs.get(page)!.notes.push({ actualUnreachableFood: { target, snackBounds, actorFloor: floorY }, jump: false, hunger: .7 });
});

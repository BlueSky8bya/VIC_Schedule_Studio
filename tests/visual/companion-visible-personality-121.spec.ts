import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { companionSpriteMetadata } from "@/lib/ui/viewer-companion/sprite-quality";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";

const origin = "http://127.0.0.1:3117";
const output = ".scratch-pw/companion-121/visible-personality";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const forbiddenSleepCells = [10, 11, 40].flatMap(row => companionSpriteMetadata.rows[row]);
const socialWalkCells = [...companionSpriteMetadata.rows[2], ...companionSpriteMetadata.rows[20]];
type Point = { x: number; y: number };
type Food = Point & { id: string; carried: boolean; falling: boolean; discarding: boolean; eating: boolean; hidden: boolean };
type Sample = {
  at: number; state: string; play: string; household: string; living: string; scene: string; platform: string;
  pose: number; dreaming: boolean; hidden: boolean; pageHidden: boolean; focused: boolean; decoded: boolean;
  x: number; y: number; foods: Food[];
};
type Probe = {
  samples: Sample[]; marks: Record<string, number>; mutations: number;
  visibility: { at: number; hidden: boolean; focused: boolean }[]; elapsed: () => number; stop: () => void;
};
type ProbeWindow = Window & { visiblePersonality121?: Probe };
type Proof = { writes: string[]; foreign: string[]; api: string[]; errors: string[]; build: string; notes: unknown[] };
const proofs = new WeakMap<Page, Proof>();

test.use({ headless: true, viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.setTimeout(100000);

test.beforeEach(async ({ page }) => {
  const proof: Proof = { writes: [], foreign: [], api: [], errors: [], notes: [], build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim() };
  proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "No fixture writes" }); }
    if (url.pathname.startsWith("/api/")) { proof.api.push(url.pathname); return route.fulfill({ status: 404, body: "No live API in fixture" }); }
    return route.continue();
  });
});

test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!;
  const observed = await page.evaluate(() => {
    const probe = (window as ProbeWindow).visiblePersonality121; probe?.stop();
    return { samples: probe?.samples ?? [], marks: probe?.marks ?? {}, visibility: probe?.visibility ?? [], mutations: probe?.mutations ?? 0 };
  }).catch(() => ({ samples: [], marks: {}, visibility: [], mutations: 0 }));
  mkdirSync(output, { recursive: true });
  const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  const evidence = resolve(output, name + ".json");
  writeFileSync(evidence, JSON.stringify({ ...proof, ...observed, status: info.status, url: page.url(), recordedAt: new Date().toISOString(), afterBuild: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), scope: "Native local guarded fixture; persisted preferences/care only. No RNG, clock, geometry, CSS or product-state injection. Not a real OBS/device claim." }, null, 2));
  await info.attach("native-personality-evidence", { path: evidence, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(proof.writes).toEqual([]); expect(proof.foreign).toEqual([]); expect(proof.errors).toEqual([]);
});

async function fixture(page: Page, options: { personality?: CompanionPreferences["personality"]; animal?: CompanionPreferences["animalMode"]; energy?: number; hunger?: number } = {}) {
  await page.addInitScript(({ preferences, memory, options, epoch, key }) => {
    const prefs = { version: 1, ...preferences, enabled: true, activeWhileVisible: true, roam: true, sleep: false, sound: false, personality: options.personality ?? "curious", animalMode: options.animal ?? "default" };
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.viewerCompanion": JSON.stringify(prefs), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: options.energy ?? .95, hunger: options.hunger ?? .05 }), "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, options, epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY });
  await page.goto("/visual-fixture/poster?avatar=1&ambient=autumn");
  expect(new URL(page.url()).origin).toBe(origin);
  await page.bringToFront(); await settlePanelLayout(page);
  await expect(pet(page)).toBeVisible(); await openCompanionHome(page);
  const floorY = await page.evaluate(() => {
    const bars = [...document.querySelectorAll<HTMLElement>(".agenda-monthbar")].filter(node => getComputedStyle(node).position === "fixed").map(node => node.getBoundingClientRect());
    return Math.min(innerHeight - 18, ...bars.filter(rect => rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1).map(rect => rect.top - 8));
  });
  // Public keyboard placement chooses the real floor; it does not supply a
  // platform, body transform, action, animation age or internal brain value.
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(470, floorY); await page.mouse.move(1880, 80);
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  return { floorY };
}

async function closeHome(page: Page) {
  const close = page.getByRole("button", { name: "빅타민 집 닫기", exact: true });
  if (await close.isVisible()) await close.click(); else await page.locator('[data-act="companion-home-fold"]').click();
  await settlePanelLayout(page); await expect(page.locator(".vc-home-room")).not.toBeVisible();
}

async function startProbe(page: Page) {
  await page.evaluate(() => {
    const began = performance.now(); let raf = 0, last = -Infinity, stopped = false;
    const probe: Probe = { samples: [], marks: {}, visibility: [], mutations: 0, elapsed: () => performance.now() - began, stop: () => { stopped = true; cancelAnimationFrame(raf); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); } };
    const visibility = () => probe.visibility.push({ at: performance.now() - began, hidden: document.hidden, focused: document.hasFocus() });
    const observer = new MutationObserver(records => { probe.mutations += records.filter(record => record.target instanceof Element && Boolean(record.target.closest(".vc-companion,.vc-food"))).length; });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["style", "data-state", "data-pose", "data-platform", "data-play", "data-household", "data-living", "data-scene", "data-dreaming", "data-carried", "data-falling", "hidden"] });
    document.addEventListener("visibilitychange", visibility); visibility();
    const sample = (now: number) => {
      if (stopped) return;
      if (now - last >= 50) {
        last = now;
        const node = document.querySelector<HTMLElement>(".vc-companion"), rect = node?.getBoundingClientRect(), image = node?.querySelector<HTMLImageElement>(".vc-texture");
        probe.samples.push({ at: now - began, state: node?.dataset.state ?? "", play: node?.dataset.play ?? "", household: node?.dataset.household ?? "", living: node?.dataset.living ?? "", scene: node?.dataset.scene ?? "", platform: node?.dataset.platform ?? "", pose: Number(node?.dataset.pose ?? -1), dreaming: Boolean(node?.hasAttribute("data-dreaming")), hidden: !node || node.hidden, pageHidden: document.hidden, focused: document.hasFocus(), decoded: Boolean(image?.complete && image.naturalWidth > 0), x: rect ? rect.left + rect.width / 2 : -1, y: rect?.bottom ?? -1,
          foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(food => { const matrix = new DOMMatrixReadOnly(food.style.transform); return { id: food.dataset.food!, x: matrix.m41, y: matrix.m42, carried: food.hasAttribute("data-carried"), falling: food.hasAttribute("data-falling"), discarding: food.hasAttribute("data-discarding"), eating: food.hasAttribute("data-eating"), hidden: food.hidden }; }) });
      }
      if (now - began < 85000) raf = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).visiblePersonality121 = probe; raf = requestAnimationFrame(sample);
  });
}

const samples = (page: Page) => page.evaluate(() => (window as ProbeWindow).visiblePersonality121!.samples);
const mark = (page: Page, name: string) => page.evaluate(name => {
  const probe = (window as ProbeWindow).visiblePersonality121!;
  probe.marks[name] = probe.elapsed(); return probe.marks[name];
}, name);
async function release(page: Page) {
  await actor(page).focus(); await actor(page).press("Space");
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
}

async function addFood(page: Page, target: Point) {
  const count = await page.locator(".vc-food").count();
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  await expect(page.locator(".vc-food")).toHaveCount(count + 1);
  const food = page.locator(".vc-food").last();
  // Native dispensing first mounts a hidden node, then paints its actual
  // flight. Wait for that measured landing before acquiring a real grip.
  await expect(food).toBeVisible({ timeout: 8000 });
  await expect(food).not.toHaveAttribute("data-falling", { timeout: 8000 });
  await dragFood(page, food, target); return (await food.getAttribute("data-food"))!;
}
async function dragFood(page: Page, food: Locator, target: Point) {
  const rect = (await food.boundingBox())!, point = await food.evaluate(node => { const matrix = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return { x: matrix.m41, y: matrix.m42 }; });
  const grip = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down(); await page.mouse.move(target.x + grip.x - point.x, target.y + grip.y - point.y, { steps: 14 }); await page.mouse.up(); await page.mouse.move(1880, 80);
  await expect(food).not.toHaveAttribute("data-falling"); await expect(food).not.toHaveAttribute("data-selected");
}

for (const options of [{ animal: "dog", personality: "curious" }, { animal: "default", personality: "affectionate" }] as const) {
  test("121 " + options.animal + " " + options.personality + " notices a distant real cursor in about three seconds", async ({ page }) => {
    const { floorY } = await fixture(page, options);
    await closeHome(page); await startProbe(page); await release(page);
    const baseline = (await pet(page).boundingBox())!;
    const cueAt = await mark(page, "pointer-cue");
    await page.mouse.move(1050, floorY - 65, { steps: 4 });
    const isRenderedSocial = (sample: Sample) => sample.at >= cueAt && sample.living === "social" && (
      sample.play === "bow" && companionSpriteMetadata.rows[29].includes(sample.pose)
      || sample.play === "ask-petting" && companionSpriteMetadata.rows[33].includes(sample.pose)
      || sample.play === "lean-nuzzle" && companionSpriteMetadata.rows[34].includes(sample.pose)
      || sample.state === "walk" && socialWalkCells.includes(sample.pose) && Math.abs(sample.x - baseline.x - baseline.width / 2) > 4);
    await expect.poll(async () => (await samples(page)).some(isRenderedSocial), { timeout: 3200, intervals: [50] }).toBe(true);
    const trace = await samples(page), response = trace.find(isRenderedSocial)!;
    expect(response.at - cueAt).toBeLessThanOrEqual(3200);
    expect(response.decoded).toBe(true); expect(response.hidden).toBe(false);
    proofs.get(page)!.notes.push({ actualCursor: { x: 1050, y: floorY - 65 }, cueAt, firstRenderedSocial: response, responseMs: response.at - cueAt });
  });
}

function cleanup(trace: Sample[], ids: string[]) {
  for (const id of ids) {
    const carried = trace.filter(sample => sample.foods.some(food => food.id === id && food.carried));
    if (carried.length < 3) continue;
    const last = carried.at(-1)!, fall = trace.find(sample => sample.at > last.at && sample.foods.some(food => food.id === id && food.falling));
    const landed = fall && trace.find(sample => sample.at > fall.at && sample.foods.some(food => food.id === id && !food.carried && !food.falling && !food.hidden));
    if (fall && landed) return { id, carried, last, fall, landed };
  }
}

test("121 full tidy sees global scattered food and actually carries then puts it down without eating", async ({ page }) => {
  const { floorY } = await fixture(page, { personality: "tidy", hunger: .05 });
  const ids = [await addFood(page, { x: 720, y: floorY - 5 }), await addFood(page, { x: 1020, y: floorY - 5 })];
  await closeHome(page); await startProbe(page); await release(page); await page.mouse.move(1880, 80);
  await expect.poll(async () => Boolean(cleanup(await samples(page), ids)), { timeout: 65000, intervals: [250] }).toBe(true);
  const trace = await samples(page), result = cleanup(trace, ids)!;
  const points = result.carried.map(sample => sample.foods.find(food => food.id === result.id)!);
  expect(Math.max(...points.map(point => point.x)) - Math.min(...points.map(point => point.x))).toBeGreaterThan(40);
  const from = result.last.foods.find(food => food.id === result.id)!, to = result.fall.foods.find(food => food.id === result.id)!;
  expect(Math.hypot(to.x - from.x, to.y - from.y), "put begins at the actual carried drawing").toBeLessThan(35);
  expect(result.landed.at - result.fall.at).toBeLessThan(1800);
  expect(trace.some(sample => sample.state === "eat" || sample.foods.some(food => food.eating))).toBe(false);
  expect(await page.locator(".vc-food").count()).toBe(2);
  proofs.get(page)!.notes.push({ actualCleanup: result, fullCareFixture: true, noNativeFoodInteractionAfterRelease: true });
});

test("121 hungry companion prioritizes and actually bites a reachable native snack", async ({ page }) => {
  const { floorY } = await fixture(page, { personality: "gourmet", hunger: .88 });
  const id = await addFood(page, { x: 580, y: floorY - 5 });
  await closeHome(page); await startProbe(page); await release(page); await page.mouse.move(1880, 80);
  await expect.poll(async () => (await samples(page)).some(sample => sample.state === "eat" && sample.foods.some(food => food.id === id && food.eating)), { timeout: 18000, intervals: [100] }).toBe(true);
  const trace = await samples(page), bite = trace.find(sample => sample.state === "eat" && sample.foods.some(food => food.id === id && food.eating))!;
  expect(bite.household).toBe(""); expect(bite.living).not.toBe("cozy"); expect(bite.decoded).toBe(true);
  proofs.get(page)!.notes.push({ actualBite: bite });
});

test("121 mischievous visible minute has ten observable behavior changes with real activity", async ({ page }) => {
  const { floorY } = await fixture(page, { personality: "mischievous" });
  await addFood(page, { x: 680, y: floorY - 5 }); await addFood(page, { x: 880, y: floorY - 5 });
  await closeHome(page); await startProbe(page); await release(page); await page.mouse.move(1880, 80);
  const began = await mark(page, "minute-start");
  await page.waitForTimeout(60000);
  const trace = (await samples(page)).filter(sample => sample.at >= began && sample.at < began + 60000);
  const changes: { at: number; signature: string }[] = [];
  for (const sample of trace) {
    const signature = [sample.state, sample.play, sample.household, sample.living, sample.scene].join("|");
    if (changes.at(-1)?.signature !== signature) changes.push({ at: sample.at, signature });
  }
  proofs.get(page)!.notes.push({ minuteMs: trace.at(-1)!.at - trace[0].at, semanticChanges: changes, posesAreNotCountedAsNewBehaviors: true });
  expect(trace.at(-1)!.at - trace[0].at).toBeGreaterThan(59000);
  expect(trace.every(sample => !sample.pageHidden && !sample.hidden && sample.decoded)).toBe(true);
  expect(changes.length - 1, "ten real semantic changes; individual sprite frames do not count").toBeGreaterThanOrEqual(10);
  expect(new Set(trace.map(sample => sample.state)).size).toBeGreaterThanOrEqual(3);
  expect(Math.max(...trace.map(sample => sample.x)) - Math.min(...trace.map(sample => sample.x))).toBeGreaterThan(80);
});

test("121 automatic sleep OFF at low energy never adopts yawn sleep doze or dreaming art", async ({ page }) => {
  await fixture(page, { personality: "sleepy", energy: .08 });
  await closeHome(page); await startProbe(page); await release(page); await page.mouse.move(1880, 80);
  await page.waitForTimeout(30000);
  const trace = await samples(page);
  expect(trace.length).toBeGreaterThan(200);
  expect(trace.filter(sample => sample.state === "sleep" || sample.dreaming || forbiddenSleepCells.includes(sample.pose))).toEqual([]);
  expect(trace.every(sample => !sample.pageHidden && !sample.hidden && sample.decoded)).toBe(true);
  proofs.get(page)!.notes.push({ actualAdoptedPoses: [...new Set(trace.map(sample => sample.pose))], observedMs: trace.at(-1)!.at, forbiddenPhysicalCells: forbiddenSleepCells });
});

test("121 actual hidden tab freezes native companion work and resumes without sleep debt", async ({ page, context }, info) => {
  await fixture(page, { personality: "mischievous" });
  await closeHome(page); await startProbe(page); await release(page); await page.mouse.move(1880, 80);
  await page.waitForTimeout(1000);
  const other = await context.newPage(); await other.goto("about:blank"); await other.bringToFront();
  const actuallyHidden = await page.evaluate(() => document.hidden);
  if (!actuallyHidden) {
    proofs.get(page)!.notes.push({ actualVisibilityLimit: "Chromium kept the original page visible after a real tab switch; no synthetic visibility was supplied." });
    await other.close(); await page.bringToFront();
    info.annotations.push({ type: "native-visibility-limit", description: "Real tab switch did not produce document.hidden in this browser." });
    test.skip(true, "Browser did not expose actual hidden state; OS minimize/OBS remains separate.");
  }
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => ({ mutations: (window as ProbeWindow).visiblePersonality121!.mutations, pose: document.querySelector<HTMLElement>(".vc-companion")?.dataset.pose, transform: document.querySelector<HTMLElement>(".vc-companion")?.style.transform, care: localStorage.getItem("vic.viewerCompanionCare") }));
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({ mutations: (window as ProbeWindow).visiblePersonality121!.mutations, pose: document.querySelector<HTMLElement>(".vc-companion")?.dataset.pose, transform: document.querySelector<HTMLElement>(".vc-companion")?.style.transform, care: localStorage.getItem("vic.viewerCompanionCare") }));
  expect(after).toEqual(before);
  await other.close(); await page.bringToFront();
  await expect.poll(() => page.evaluate(() => document.hidden)).toBe(false);
  await expect(pet(page)).toBeVisible(); await page.waitForTimeout(1500);
  const trace = await samples(page);
  expect(trace.at(-1)!.decoded).toBe(true); expect(trace.at(-1)!.dreaming).toBe(false);
  proofs.get(page)!.notes.push({ actualHiddenFreeze: { before, after }, actualVisibility: await page.evaluate(() => (window as ProbeWindow).visiblePersonality121!.visibility) });
});

import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const output = resolve(process.env.COMPANION_HOUSEHOLD_131_OUTPUT ?? ".scratch-pw/companion-131/household-native");
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
type Item = Point & { id: string; kind: string; food: boolean; carried: boolean; held: boolean; falling: boolean; eating: boolean; nibble?: number; discarding: boolean; hidden: boolean; platform: string; rect: Rect };
type Frame = { at: number; focused: boolean; hidden: boolean; state: string; household: string; toyAction: string; actor: Point & { platform: string; hidden: boolean; decoded: boolean }; floor: Rect | null; bin: Point | null; opening: Point | null; items: Item[] };
type ProbeWindow = Window & { household131?: { frames: Frame[]; stop: () => void } };
type Proof = { writes: string[]; foreign: string[]; errors: string[]; notes: unknown[] };
const proofs = new WeakMap<Page, Proof>();

test.use({ headless: true, viewport: { width: 2400, height: 1100 }, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.setTimeout(120000);
test.beforeEach(async ({ page, baseURL }) => {
  const proof: Proof = { writes: [], foreign: [], errors: [], notes: [] }; proofs.set(page, proof);
  const origin = new URL(baseURL ?? "http://127.0.0.1:3117").origin;
  expect(new URL(origin).hostname).toBe("127.0.0.1");
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 503, body: "No fixture writes" }); }
    // In particular, no SOOP/live-state GET can leave this fixture boundary.
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live/private APIs" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const trace = await page.evaluate(() => { const probe = (window as ProbeWindow).household131; probe?.stop(); return probe?.frames ?? []; }).catch(() => []);
  const proof = proofs.get(page)!; mkdirSync(output, { recursive: true });
  const name = info.title.replace(/[^a-z0-9]+/gi, "-"), path = resolve(output, `${name}.json`);
  writeFileSync(path, JSON.stringify({ build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), status: info.status, proof, frames: trace,
    scope: "Production-build native fixture. Synthetic prior local personality/fullness/food preferences only, not earned history. Native spawn, placement and release followed by read-only actual painted journey. No RNG, clock, geometry, style, runtime-control or AI mutation. Pantry cases begin with real overlapping home-floor foods; they do not establish an outside-calendar-to-home route or an exact random favorite-ID roll. No real DB, broadcaster PC or OBS claim." }, null, 2));
  await info.attach("physical-household-131", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, `${name}.png`) }).catch(() => {});
  expect(proof.writes).toEqual([]); expect(proof.foreign).toEqual([]); expect(proof.errors).toEqual([]);
});

async function ready(page: Page, mode: "toy" | "full-nonfavorite" | "liked" | "mid-hunger" | "hungry") {
  // This is deliberately initial saved fixture state. Nothing changes care,
  // tastes, personality or the product clock after the real page has mounted.
  const life = structuredClone(DEFAULT_COMPANION_MEMORY.life);
  life.seedFood = life.favoriteFood = "durian";
  for (const kind of COMPANION_FOOD_KINDS) life.foodScores[kind] = mode === "liked" ? .8 : kind === "durian" ? .9 : .1;
  await page.addInitScript(({ epoch, epochKey, preferences, memory, life, mode }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true,
      personality: "tidy", animalMode: "default", speed: "normal", roam: true, jump: true, sleep: false, feeding: true, drag: true, sound: false,
      learnFromYou: mode === "liked", heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false }),
      "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, life, energy: .98, hunger: mode === "hungry" ? .9 : mode === "mid-hunger" ? .5 : .05 }),
      "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
    for (const key of ["vic.panelSections", "vic_panel_collapsed", "vic.viewerCompanionCollection", "vic.viewerCompanionGifts", "vic.viewerCompanionTastes"]) localStorage.removeItem(key);
  }, { epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, life, mode });
  await page.goto("/visual-fixture/studio?role=owner&y=2025&m=11"); await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(pet(page)).toBeVisible(); const room = await openCompanionHome(page);
  await room.evaluate(async element => Promise.all(element.getAnimations({ subtree: true }).filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished.catch(() => {}))));
  await placeCompanionOnHomeFloor(page);
  // A fresh resident can already occupy this point. Both the actual floor
  // and completed native placement mode are required before holding.
  const cancelledNativePlacement = await pet(page).getAttribute("data-placing") !== null;
  expect(cancelledNativePlacement).toBe(false);
  await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
  await expect.poll(async () => {
    const feet = await pet(page).evaluate(element => element.getBoundingClientRect().bottom), floor = (await home(page).locator(".vc-home-floor").boundingBox())!;
    return Math.abs(feet - floor.y - floor.height + 6);
  }).toBeLessThan(2);
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  proofs.get(page)!.notes.push({ initialSyntheticFixture: { personality: "tidy", hunger: mode === "hungry" ? .9 : mode === "mid-hunger" ? .5 : .05, favorite: "durian", score: mode === "liked" ? "all foods .8, learned preferences ON" : "other foods .1", mode }, nativePetPlacementAndTemporaryHold: true, cancelledNativePlacement });
}

async function probe(page: Page) {
  await page.evaluate(() => {
    const frames: Frame[] = []; let request = 0, last = -Infinity, stopped = false;
    const box = (element: Element | null): Rect | null => { if (!element) return null; const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const sample = (at: number) => {
      if (stopped) return;
      if (at - last >= 16) {
        last = at; const actor = document.querySelector<HTMLElement>(".vc-companion"), r = actor?.getBoundingClientRect(), texture = actor?.querySelector<HTMLImageElement>(".vc-texture");
        const bin = box(document.querySelector(".vc-home [data-companion-trash]")), opening = box(document.querySelector(".vc-home .vc-toy-box-opening"));
        frames.push({ at, focused: document.hasFocus(), hidden: document.hidden, state: actor?.dataset.state ?? "", household: actor?.dataset.household ?? "", toyAction: actor?.dataset.toyAction ?? "",
          actor: { x: r ? r.left + r.width / 2 : -1, y: r?.bottom ?? -1, platform: actor?.dataset.platform ?? "", hidden: !actor || actor.hidden, decoded: Boolean(texture?.complete && texture.naturalWidth) },
          floor: box(document.querySelector(".vc-home .vc-home-floor")), bin: bin && { x: bin.x + bin.width / 2, y: bin.y + bin.height * .35 }, opening: opening && { x: opening.x + opening.width / 2, y: opening.y + opening.height },
          items: [...document.querySelectorAll<HTMLElement>(".vc-food,.vc-toy")].map(node => {
            const food = node.matches(".vc-food"), rect = box(node)!, matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform), translation = node.style.transform.match(/^translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
            return { id: node.dataset.food ?? node.dataset.toyId ?? "", kind: node.dataset.kind ?? "", food, x: food ? matrix.m41 : Number(translation?.[1] ?? NaN), y: food ? matrix.m42 : Number(translation?.[2] ?? NaN),
              carried: food ? node.hasAttribute("data-carried") : node.dataset.carried === "true", held: node.dataset.held === "true", falling: food ? node.hasAttribute("data-falling") : node.dataset.falling === "true", eating: node.hasAttribute("data-eating"), ...(food ? { nibble: Number(node.style.getPropertyValue("--vc-nibble")) } : {}), discarding: node.hasAttribute("data-discarding"), hidden: node.hidden, platform: node.dataset.platform ?? "", rect };
          }) });
      }
      if (frames.length < 7200) request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).household131?.stop(); (window as ProbeWindow).household131 = { frames, stop: () => { stopped = true; cancelAnimationFrame(request); } }; request = requestAnimationFrame(sample);
  });
}
const frames = (page: Page) => page.evaluate(() => (window as ProbeWindow).household131?.frames ?? []);
const point = (node: Locator) => node.evaluate(element => { const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform); return { x: matrix.m41, y: matrix.m42 }; });
async function release(page: Page) {
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await page.mouse.move(2390, 8);
  proofs.get(page)!.notes.push({ afterThisNativeRelease: "read-only observation only; no item/body input, local-state writes, RNG or clock changes" });
}
async function snack(page: Page, count: number) {
  await home(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(page.locator(".vc-food")).toHaveCount(count);
  const node = page.locator(".vc-food").last(); await expect(node).not.toHaveAttribute("data-falling");
  await expect(node).toHaveAttribute("data-platform", /^companion-home-floor-food(?:-\d+)?$/);
  return node;
}
async function overlapFood(page: Page, node: Locator, target: Point) {
  const from = await point(node), r = (await node.boundingBox())!, grip = { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down();
  await page.mouse.move(target.x + grip.x - from.x, target.y + grip.y - from.y, { steps: 12 });
  // A genuine held-still pause selects put-down, not the new native throw.
  await page.waitForTimeout(140); await page.mouse.up(); await page.mouse.move(2390, 8);
  await expect(node).not.toHaveAttribute("data-falling"); await expect(node).toHaveAttribute("data-platform", /^companion-home-floor-food(?:-\d+)?$/);
  const actual = await point(node); expect(Math.hypot(actual.x - target.x, actual.y - target.y)).toBeLessThan(2);
}
function carryJourney(trace: Frame[], id: string) {
  const carried = trace.flatMap(frame => { const item = frame.items.find(item => item.id === id && item.carried && !item.discarding); return item ? [{ frame, item }] : []; });
  expect(carried.length, "this actual item must have multiple painted carry frames").toBeGreaterThanOrEqual(2);
  expect(carried.every(({ frame, item }) => !frame.hidden && !frame.actor.hidden && frame.actor.decoded && !item.hidden && Number.isFinite(item.x) && Number.isFinite(item.y))).toBe(true);
  const first = carried[0], last = carried.at(-1)!;
  expect(Math.max(...carried.map(({ item }) => Math.hypot(item.x - first.item.x, item.y - first.item.y))), "real carried paint must travel rather than merely vanish at pickup").toBeGreaterThan(12);
  return { first, last, carried };
}

test("131 tidy toy physically travels to its actual box opening before stash", async ({ page }) => {
  await ready(page, "toy"); await home(page).getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
  const toy = page.locator(".vc-toy"); await expect(toy).toHaveCount(1); await expect(toy).toHaveAttribute("data-falling", "false");
  const id = (await toy.getAttribute("data-toy-id"))!; await probe(page); await release(page);
  await expect.poll(async () => (await frames(page)).some(frame => frame.items.some(item => item.id === id && item.carried)), { timeout: 65000, intervals: [50, 100, 200] }).toBe(true);
  await expect(page.locator(`.vc-toy[data-toy-id="${id}"]`)).toHaveCount(0, { timeout: 45000 });
  await expect.poll(async () => (await frames(page)).some(frame => !frame.items.some(item => item.id === id)), { timeout: 1000 }).toBe(true);
  const trace = await frames(page), journey = carryJourney(trace, id); expect(journey.last.frame.opening).not.toBeNull();
  const destination = journey.last.frame.opening!; expect(Math.hypot(journey.last.item.x - destination.x, journey.last.item.y - destination.y)).toBeLessThan(20);
  expect(trace.some(frame => frame.at > journey.last.frame.at && !frame.items.some(item => item.id === id))).toBe(true);
  proofs.get(page)!.notes.push({ actualToy: id, firstCarry: journey.first, lastCarry: journey.last, actualOpening: destination, result: "physical carry then stash disappearance" });
});

test("131 full tidy pet carries a nonfavorite food to the actual bin before discard", async ({ page }) => {
  await ready(page, "full-nonfavorite"); let food = await snack(page, 1); const rolls: string[] = [];
  // A natural rare durian roll is not a nonfavorite. Native Delete and another
  // real food-button press are bounded explicit inputs, never a rerolled RNG.
  for (let attempt = 0; attempt < 3 && await food.getAttribute("data-kind") === "durian"; attempt++) {
    rolls.push("durian"); await food.focus(); await food.press("Delete"); food = await snack(page, 1);
  }
  const kind = await food.getAttribute("data-kind"); expect(kind).not.toBe("durian");
  const id = (await food.getAttribute("data-food"))!; await probe(page); await release(page);
  await expect.poll(async () => (await frames(page)).some(frame => frame.items.some(item => item.id === id && item.carried)), { timeout: 65000, intervals: [50, 100, 200] }).toBe(true);
  await expect(page.locator(`.vc-food[data-food="${id}"]`)).toHaveCount(0, { timeout: 45000 });
  const trace = await frames(page), journey = carryJourney(trace, id); expect(journey.last.frame.bin).not.toBeNull();
  const destination = journey.last.frame.bin!; expect(Math.hypot(journey.last.item.x - destination.x, journey.last.item.y - destination.y)).toBeLessThan(20);
  const discarding = trace.find(frame => frame.items.some(item => item.id === id && item.discarding)); expect(discarding, "finite native bin-discard paint must precede absence").toBeDefined();
  await expect.poll(async () => (await frames(page)).some(frame => frame.at > discarding!.at && !frame.items.some(item => item.id === id)), { timeout: 1000 }).toBe(true);
  proofs.get(page)!.notes.push({ actualFood: { id, kind }, rejectedActualRolls: rolls, firstCarry: journey.first, lastCarry: journey.last, actualBin: destination, discardAt: discarding!.at });
});

for (const mode of ["liked", "mid-hunger"] as const) test(mode === "liked" ? "131 liked food is carried into a free actual home pantry position" : "131 mid-hunger food is physically saved at home or actually eaten", async ({ page }) => {
  await ready(page, mode); const first = await snack(page, 1), firstId = (await first.getAttribute("data-food"))!, initial = await point(first);
  const second = await snack(page, 2), secondId = (await second.getAttribute("data-food"))!; await overlapFood(page, second, initial);
  const ids = [firstId, secondId]; await probe(page); await release(page);
  if (mode === "mid-hunger") {
    // Hunger can legitimately choose a real meal before storage. Require its
    // actual painted nibble and earned discovery, never unexplained absence.
    await expect.poll(async () => (await frames(page)).some(frame => frame.items.some(item => ids.includes(item.id) && (item.carried || frame.state === "eat" && item.eating))), { timeout: 65000, intervals: [50, 100, 200] }).toBe(true);
    const firstOutcome = (await frames(page)).find(frame => frame.items.some(item => ids.includes(item.id) && (item.carried || frame.state === "eat" && item.eating)))!;
    const meal = firstOutcome.state === "eat" && firstOutcome.items.find(item => ids.includes(item.id) && item.eating);
    if (meal) {
      await expect(page.locator(`.vc-food[data-food="${meal.id}"]`)).toHaveCount(0, { timeout: 45000 });
      const trace = await frames(page), witnessed = trace.filter(frame => frame.state === "eat" && frame.items.some(item => item.id === meal.id && item.eating));
      expect(witnessed.length).toBeGreaterThanOrEqual(2);
      expect(witnessed.every(frame => !frame.hidden && !frame.actor.hidden && frame.actor.decoded)).toBe(true);
      expect(trace.some(frame => frame.items.some(item => item.id === meal.id && item.discarding))).toBe(false);
      await expect.poll(() => page.evaluate(kind => (JSON.parse(localStorage.getItem("vic.viewerCompanionCollection") ?? "null")?.foods ?? []).includes(kind), meal.kind)).toBe(true);
      proofs.get(page)!.notes.push({ actualMidHungerOutcome: "witnessed real meal, not storage or unexplained disappearance", meal: { id: meal.id, kind: meal.kind }, paintedEatingFrames: witnessed.length });
      return;
    }
  }
  await expect.poll(async () => (await frames(page)).some(frame => frame.items.some(item => ids.includes(item.id) && item.carried)), { timeout: 65000, intervals: [50, 100, 200] }).toBe(true);
  const carriedId = (await frames(page)).flatMap(frame => frame.items.filter(item => ids.includes(item.id) && item.carried).map(item => item.id))[0];
  await expect.poll(async () => (await frames(page)).some(frame => {
    const item = frame.items.find(item => item.id === carriedId);
    return Boolean(item && !item.carried && !item.falling && !item.discarding && !item.hidden && /^companion-home-floor-food(?:-\d+)?$/.test(item.platform) && Math.hypot(item.x - initial.x, item.y - initial.y) >= 43.5);
  }), { timeout: 45000, intervals: [50, 100, 200] }).toBe(true);
  const trace = await frames(page), journey = carryJourney(trace, carriedId);
  const released = trace.find(frame => frame.at > journey.last.frame.at && frame.items.some(item => item.id === carriedId && !item.carried && !item.discarding));
  expect(released, "a real retained snack must be visible after its carried ownership ends").toBeDefined();
  const firstReleased = released!.items.find(item => item.id === carriedId)!, deltaMs = released!.at - journey.last.frame.at;
  const releaseDistance = Math.hypot(firstReleased.x - journey.last.item.x, firstReleased.y - journey.last.item.y);
  expect(releaseDistance, "put-down must begin at the last actually painted carried food, allowing elapsed physical gravity").toBeLessThanOrEqual(8 + 900 * (deltaMs / 1000) ** 2);
  const landed = trace.find(frame => frame.at > journey.first.frame.at && frame.items.some(item => item.id === carriedId && !item.carried && !item.falling && !item.hidden && /^companion-home-floor-food(?:-\d+)?$/.test(item.platform) && Math.hypot(item.x - initial.x, item.y - initial.y) >= 43.5))!;
  const stored = landed.items.find(item => item.id === carriedId)!, floor = landed.floor!; expect(floor).not.toBeNull();
  expect(stored.x).toBeGreaterThanOrEqual(floor.x + 21.5); expect(stored.x).toBeLessThanOrEqual(floor.x + floor.width - 21.5);
  expect(Math.abs(stored.y - floor.y - floor.height + 6)).toBeLessThan(2);
  expect(landed.items.filter(item => ids.includes(item.id))).toHaveLength(2); expect(trace.some(frame => frame.items.some(item => ids.includes(item.id) && item.discarding))).toBe(false);
  expect(landed.items.filter(item => item.id !== carriedId && ids.includes(item.id)).every(item => Math.hypot(item.x - stored.x, item.y - stored.y) >= 43.5)).toBe(true);
  proofs.get(page)!.notes.push({ actualFoods: ids, initialNativeOverlap: initial, carriedId, firstCarry: journey.first, lastCarry: journey.last, firstReleased, releaseDistance, releaseDeltaMs: deltaMs, actualPantryPut: { item: stored, floor, at: landed.at }, protectedLikeIsSyntheticHighScore: mode === "liked", exactFavoriteIdNativeBranchNotClaimed: true });
});

test("131 hungry sofa resident exits to the actual floor then eats and earns the real food discovery", async ({ page }) => {
  await ready(page, "hungry");
  const bed = (await home(page).locator(".vc-plush-bed").boundingBox())!, seat = (await home(page).locator(".vc-home-cushion").boundingBox())!;
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(bed.x + bed.width / 2, seat.y - .01); await page.mouse.move(2390, 8);
  await expect(pet(page)).not.toHaveAttribute("data-placing"); await expect(pet(page)).toHaveAttribute("data-platform", "companion-home");
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(async () => Math.abs(await pet(page).evaluate(node => node.getBoundingClientRect().bottom) - (await home(page).locator(".vc-home-cushion").boundingBox())!.y)).toBeLessThan(2);
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  const food = await snack(page, 1), id = (await food.getAttribute("data-food"))!, kind = (await food.getAttribute("data-kind"))!;
  const beforeCollection = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCollection") ?? "{}"));
  expect(beforeCollection.foods ?? [], "spawning the unknown food must not invent an earned discovery").not.toContain(kind);
  const sourceFood = await point(food); await probe(page); await release(page);
  await expect.poll(async () => (await frames(page)).filter(frame => frame.state === "eat" && frame.items.some(item => item.id === id && item.eating)).length,
    { timeout: 90000, intervals: [50, 100, 200] }).toBeGreaterThanOrEqual(2);
  await expect(page.locator(`.vc-food[data-food="${id}"]`)).toHaveCount(0, { timeout: 15000 });
  await expect.poll(() => page.evaluate(kind => (JSON.parse(localStorage.getItem("vic.viewerCompanionCollection") ?? "{}").foods ?? []).includes(kind), kind)).toBe(true);
  const trace = await frames(page), meal = trace.filter(frame => frame.state === "eat" && frame.items.some(item => item.id === id && item.eating));
  expect(meal.length).toBeGreaterThanOrEqual(2);
  expect(meal.every(frame => frame.focused && !frame.hidden && !frame.actor.hidden && frame.actor.decoded && !frame.items.find(item => item.id === id)!.hidden)).toBe(true);
  expect(new Set(meal.map(frame => frame.items.find(item => item.id === id)!.nibble)).size, "the actual eaten food must have multiple painted nibble scales").toBeGreaterThanOrEqual(2);
  const firstMeal = meal[0], floorArrival = trace.find(frame => frame.at < firstMeal.at && /^companion-home-floor(?:-\d+)?$/.test(frame.actor.platform) && frame.state !== "held");
  expect(trace.some(frame => frame.actor.platform === "companion-home")).toBe(true);
  expect(floorArrival, "the real sofa exit must reach the measured floor before eating").toBeDefined();
  expect(Math.abs(floorArrival!.actor.x - bed.x - bed.width / 2)).toBeLessThan(3);
  expect(Math.abs(floorArrival!.actor.y - floorArrival!.floor!.y - floorArrival!.floor!.height + 6)).toBeLessThan(2);
  expect(trace.some(frame => frame.at > floorArrival!.at && frame.at < firstMeal.at && frame.state === "walk" && /^companion-home-floor(?:-\d+)?$/.test(frame.actor.platform)
    && Math.abs(frame.actor.x - floorArrival!.actor.x) > 30), "the visible manual home-floor approach must follow the exit").toBe(true);
  expect(trace.some(frame => frame.items.some(item => item.id === id && (item.discarding || item.carried)))).toBe(false);
  await expect.poll(async () => (await frames(page)).some(frame => frame.at > meal.at(-1)!.at && !frame.items.some(item => item.id === id))).toBe(true);
  proofs.get(page)!.notes.push({ initialNativeCushion: { bed, seat }, actualFood: { id, kind, sourceFood }, syntheticPriorHunger: .9, learnFromYou: false,
    firstActualFloorArrival: floorArrival, firstMeal: meal[0], lastMeal: meal.at(-1), decodedNibbleFrames: meal.length, distinctNibbleScales: new Set(meal.map(frame => frame.items.find(item => item.id === id)!.nibble)).size,
    result: "actual sofa exit, real home-floor walk, painted eating, food absence and newly earned kind discovery; no carry/discard substitution" });
});

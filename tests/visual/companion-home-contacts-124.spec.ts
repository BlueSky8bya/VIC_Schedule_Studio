import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";

const output = resolve(process.env.COMPANION_CONTACTS_124_OUTPUT ?? ".scratch-pw/companion-124/contacts");
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
const build = () => readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim();
type Point = { x: number; y: number };
type Rect = Point & { width: number; height: number };
type ObjectSample = { id: string; rect: Rect; point: Point; hidden: boolean; platform: string; carried: boolean; held: boolean; falling: boolean; discarding: boolean };
type Frame = {
  at: number; viewport: { width: number; height: number }; room: Rect | null; floor: Rect | null; seat: Rect | null; bed: Rect | null; opening: Rect | null; slot: Rect | null;
  pet: { rect: Rect; platform: string; state: string; depth: string; decoded: boolean; hidden: boolean } | null;
  front: { rect: Rect; hidden: boolean; depth: string; localVisibility: string } | null; trashOver: boolean; foods: ObjectSample[]; toys: ObjectSample[];
};
type ContactProbe = { samples: Frame[]; stop: () => void };
type ProbeWindow = Window & { homeContacts124?: ContactProbe };
type Proof = { writes: string[]; foreign: string[]; errors: string[]; blockedAPIs: string[]; build: string; notes: unknown[] };
const proofs = new WeakMap<Page, Proof>();
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });

test.use({ headless: true, viewport: { width: 1920, height: 1100 }, serviceWorkers: "block", isMobile: false, hasTouch: false });
test.setTimeout(80000);
test.beforeEach(async ({ page }) => {
  const proof: Proof = { writes: [], foreign: [], errors: [], blockedAPIs: [], build: build(), notes: [] }; proofs.set(page, proof);
  page.on("pageerror", error => proof.errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      proof.foreign.push(request.method() + " " + url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { proof.writes.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "No fixture writes" }); }
    if (url.pathname === "/api/soop-live" && request.method() === "GET") return route.fulfill({ json: { live: false } });
    if (url.pathname.startsWith("/api/")) { proof.blockedAPIs.push(request.method() + " " + url.pathname); return route.fulfill({ status: 404, body: "No live or private API in fixture" }); }
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const samples = await page.evaluate(() => { const probe = (window as ProbeWindow).homeContacts124; probe?.stop(); return probe?.samples ?? []; }).catch(() => []);
  const proof = proofs.get(page)!, name = info.title.replace(/[^a-z0-9]+/gi, "-"); mkdirSync(output, { recursive: true });
  const path = resolve(output, name + ".json");
  writeFileSync(path, JSON.stringify({ ...proof, samples, status: info.status, recordedAt: new Date().toISOString(), afterBuild: build(), scope: "Local production-build fixture; native pointer/keyboard/viewport input and read-only actual DOM observations. Initial saved preferences/care only; no RNG, clock, geometry, style or brain injection. Not production/OBS/device evidence." }, null, 2));
  await info.attach("native-home-contacts-124", { path, contentType: "application/json" });
  await page.screenshot({ path: resolve(output, name + ".png") }).catch(() => {});
  expect(proof.writes).toEqual([]); expect(proof.foreign).toEqual([]); expect(proof.errors).toEqual([]);
});

async function fixture(page: Page, options: { studio?: boolean; roam?: boolean } = {}) {
  await page.addInitScript(({ preferences, memory, options, epoch, epochKey }) => {
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify({ version: 1, ...preferences, enabled: true, activeWhileVisible: true, personality: "tidy", roam: options.roam ?? false, sleep: false, sound: false, learnFromYou: false }), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: .9, hunger: .05 }), "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(key, value);
  }, { preferences: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, options, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY });
  await page.goto(options.studio ? "/visual-fixture/studio?role=owner&y=2025&m=11" : "/visual-fixture/poster?avatar=1&ambient=autumn");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(pet(page)).toBeVisible(); await openCompanionHome(page); await stable(home(page).locator(".vc-home-room"));
}

async function stable(node: Locator) {
  await node.evaluate(node => new Promise<void>((done, fail) => {
    let previous: DOMRect | undefined, consecutive = 0, frames = 0;
    const sample = () => {
      if (!node.isConnected) return fail(new Error("Native source was removed before settling"));
      const rect = node.getBoundingClientRect(); consecutive = previous && Math.max(Math.abs(rect.x - previous.x), Math.abs(rect.y - previous.y), Math.abs(rect.width - previous.width), Math.abs(rect.height - previous.height)) < .1 ? consecutive + 1 : 0; previous = rect;
      if (consecutive >= 4) done(); else if (++frames >= 240) fail(new Error("Actual source never settled in240 display frames")); else requestAnimationFrame(sample);
    }; requestAnimationFrame(sample);
  }));
}

async function probe(page: Page) {
  await page.evaluate(() => {
    (window as ProbeWindow).homeContacts124?.stop();
    const samples: Frame[] = [], began = performance.now(); let request = 0, stopped = false;
    const rect = (node: Element): Rect => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const box = (selector: string) => { const node = document.querySelector(selector); return node ? rect(node) : null; };
    const objects = (selector: string): ObjectSample[] => [...document.querySelectorAll<HTMLElement>(selector)].map(node => {
      const r = rect(node), food = node.classList.contains("vc-food"), matrix = food ? new DOMMatrixReadOnly(getComputedStyle(node).transform) : null;
      return { id: node.dataset.food ?? node.dataset.toyId ?? "", rect: r, point: matrix ? { x: matrix.m41, y: matrix.m42 } : { x: r.x + r.width / 2, y: r.y + r.height }, hidden: node.hidden || Boolean(node.closest("[hidden]")), platform: node.dataset.platform ?? "", carried: node.dataset.carried === "true", held: node.dataset.held === "true", falling: food ? node.hasAttribute("data-falling") : node.dataset.falling === "true", discarding: node.hasAttribute("data-discarding") };
    });
    const sample = (at: number) => {
      if (stopped) return;
      const pet = document.querySelector<HTMLElement>(".vc-companion"), front = document.querySelector<HTMLElement>(".vc-bed-foreground"), localFront = document.querySelector(".vc-bed-local-front"), texture = pet?.querySelector<HTMLImageElement>(".vc-texture");
      samples.push({ at: at - began, viewport: { width: innerWidth, height: innerHeight }, room: box(".vc-home-room"), floor: box(".vc-home-floor"), seat: box(".vc-home-cushion"), bed: box(".vc-plush-bed"), opening: box(".vc-toy-box-opening"), slot: box(".vc-dispenser-slot"),
        pet: pet ? { rect: rect(pet), platform: pet.dataset.platform ?? "", state: pet.dataset.state ?? "", depth: pet.dataset.sofaDepth ?? "", decoded: Boolean(texture?.complete && texture.naturalWidth), hidden: pet.hidden || document.hidden } : null,
        front: front ? { rect: rect(front), hidden: front.hidden, depth: front.dataset.depth ?? "", localVisibility: localFront ? getComputedStyle(localFront).visibility : "missing" } : null, trashOver: Boolean(document.querySelector(".vc-home [data-companion-trash][data-food-over]")), foods: objects(".vc-food"), toys: objects(".vc-toy") });
      if (samples.length < 7200) request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).homeContacts124 = { samples, stop: () => { stopped = true; cancelAnimationFrame(request); } }; request = requestAnimationFrame(sample);
  });
}
const samples = (page: Page) => page.evaluate(() => (window as ProbeWindow).homeContacts124!.samples);

async function foodOnFloor(page: Page) {
  const slot = (await home(page).locator(".vc-dispenser-slot").boundingBox())!;
  await home(page).getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  const food = page.locator(".vc-food").last(); await expect(food).toBeVisible(); await stable(food);
  const source = await food.evaluate(node => { const m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: m.m41, y: m.m42 }; });
  expect(Math.hypot(source.x - (slot.x - 40), source.y - (slot.y + slot.height + 4)), "manual food starts at its actual outlet tray").toBeLessThan(2);
  const destination = await home(page).locator(".vc-home-floor").evaluate((node, inset) => {
    const floor = node.getBoundingClientRect(), y = floor.bottom - inset;
    const controls = [...node.closest(".vc-home")!.querySelectorAll("button:not(.vc-cushion-button)")].map(control => control.getBoundingClientRect());
    for (let x = floor.left + 32; x <= floor.right - 32; x += 12) {
      const hit = document.elementFromPoint(x, floor.bottom - 2);
      if (!controls.some(r => x - 22 < r.right && x + 22 > r.left && y - 38 < r.bottom && y + 6 > r.top) && (hit === node || hit === node.parentElement || Boolean(hit?.closest(".vc-cushion-button")))) return { x, y: floor.bottom - 2 };
    }
    return null;
  }, COMPANION_HOME_FLOOR_INSET);
  expect(destination, "the measured floor exposes a real safe native food drop").not.toBeNull();
  const r = (await food.boundingBox())!, grab = { x: r.x + r.width / 2, y: r.y + r.height - 7 };
  await page.mouse.move(grab.x, grab.y); await page.mouse.down(); await page.mouse.move(destination!.x, destination!.y - 20, { steps: 12 }); await page.mouse.up(); await page.mouse.move(2, 2);
  await floorContact(page, food, "food");
  proofs.get(page)!.notes.push({ actualFeedSlot: slot, actualTraySource: source, actualNativeFloorRelease: { x: destination!.x, y: destination!.y - 20 }, foodId: await food.getAttribute("data-food") });
  return food;
}
async function toyOnFloor(page: Page) {
  await home(page).getByRole("button", { name: "장난감 상자 열기", exact: true }).click();
  const toy = page.locator(".vc-toy").last(); await expect(toy).toBeVisible(); await expect(toy).toHaveAttribute("data-falling", "false", { timeout: 5000 });
  await expect(toy).toHaveAttribute("data-platform", /^companion-home-floor(?:-food)?(?:-\d+)?$/); await floorContact(page, toy, "toy"); return toy;
}
async function floorContact(page: Page, object: Locator, kind: "food" | "toy") {
  await stable(object); await expect(object).toBeVisible();
  await expect.poll(async () => {
    const point = await object.evaluate((node, kind) => { const r = node.getBoundingClientRect(), m = new DOMMatrixReadOnly(getComputedStyle(node).transform); return kind === "food" ? m.m42 : r.bottom; }, kind);
    const floor = (await home(page).locator(".vc-home-floor").boundingBox())!;
    return Math.abs(point - (floor.y + floor.height - COMPANION_HOME_FLOOR_INSET));
  }, { message: kind + " remains attached to the actual home floor", timeout: 5000 }).toBeLessThan(2);
}

test("124 native home recall settles inside the real sofa and keeps one aligned foreground", async ({ page }) => {
  await fixture(page); await placeCompanionOnHomeFloor(page); const identity = (await pet(page).elementHandle())!; await probe(page);
  // Floor placement puts the resident over the sofa's center. Use its native
  // keyboard action so the foreground actor cannot intercept the setup click.
  const sofa = home(page).getByRole("button", { name: "쿠션으로 돌아가 쉬기", exact: true });
  await sofa.focus(); await sofa.press("Enter"); await page.mouse.move(2, 2);
  await expect(pet(page)).toHaveAttribute("data-platform", "companion-home", { timeout: 25000 }); await expect(pet(page)).toHaveAttribute("data-sofa-depth", "seat");
  await expect(page.locator(".vc-bed-foreground")).toBeVisible();
  const witness = await pet(page).evaluate(node => {
    const bed = document.querySelector<SVGSVGElement>(".vc-plush-bed")!.getBoundingClientRect(), seat = document.querySelector(".vc-home-cushion")!.getBoundingClientRect(), front = document.querySelector<HTMLElement>(".vc-bed-foreground")!, carrier = front.getBoundingClientRect(), r = node.getBoundingClientRect(), localSize = (node as HTMLElement).offsetWidth;
    const sprite = getComputedStyle(node.querySelector(".vc-sprite")!), values = sprite.clipPath.slice(6, -1).split(/\s+/).map(value => parseFloat(value) * (value.endsWith("%") ? localSize / 100 : 1));
    const [top, right = top, bottom = top, left = right] = values;
    const layers = [sprite, ...[".vc-pose", ".vc-contact", ".vc-reaction", ".vc-facing", ".vc-inertia"].map(selector => getComputedStyle(node.querySelector(selector)!))], scale = r.width / localSize;
    const body = [{ x: left, y: top }, { x: localSize - right, y: top }, { x: localSize - right, y: localSize - bottom }, { x: left, y: localSize - bottom }].map(point => {
      let p = new DOMPoint(point.x, point.y);
      for (const style of layers) { const [x, y] = style.transformOrigin.split(" ").map(parseFloat); p = new DOMPoint(p.x - x, p.y - y).matrixTransform(new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform)); p.x += x; p.y += y; }
      return { x: r.left + p.x * scale, y: r.top + p.y * scale };
    });
    return { footError: Math.abs(r.bottom - seat.top), body, innerLeft: bed.left + bed.width * 31 / 180, innerRight: bed.right - bed.width * 31 / 180, foregroundError: Math.max(Math.abs(carrier.left - bed.left), Math.abs(carrier.top - bed.top), Math.abs(carrier.width - bed.width), Math.abs(carrier.height - bed.height)), frontDepth: front.dataset.depth, frontZ: Number(getComputedStyle(front).zIndex), petZ: Number(getComputedStyle(node).zIndex), localVisibility: getComputedStyle(document.querySelector(".vc-bed-local-front")!).visibility };
  });
  proofs.get(page)!.notes.push({ actualResident: witness });
  expect(witness.footError).toBeLessThan(2); expect(witness.foregroundError).toBeLessThan(1); expect(witness.frontDepth).toBe("seat"); expect(witness.localVisibility).toBe("hidden"); expect(witness.frontZ).toBeGreaterThan(witness.petZ);
  expect(witness.body.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true); expect(Math.min(...witness.body.map(p => p.x))).toBeGreaterThanOrEqual(witness.innerLeft - .5); expect(Math.max(...witness.body.map(p => p.x))).toBeLessThanOrEqual(witness.innerRight + .5);
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
});

test("124 native outlet food reaches the real floor and disappears only after a real trash drag", async ({ page }) => {
  await fixture(page); await placeCompanionOnHomeFloor(page); await probe(page); const food = await foodOnFloor(page), id = (await food.getAttribute("data-food"))!;
  const bin = home(page).getByRole("button", { name: "음식 버리기", exact: true }), target = (await bin.boundingBox())!, r = (await food.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 12 });
  await expect.poll(async () => (await samples(page)).some(frame => frame.foods.some(food => food.id === id && food.discarding)), { message: "real native trash dwell reaches its finite discard paint", timeout: 3000 }).toBe(true); await page.mouse.up();
  await expect(page.locator(`.vc-food[data-food="${id}"]`)).toHaveCount(0, { timeout: 3000 });
  const trace = await samples(page), discarded = trace.filter(frame => frame.foods.some(food => food.id === id && food.discarding));
  expect(trace.some(frame => frame.trashOver)).toBe(true); expect(discarded.length, "actual finite discard paint precedes removal").toBeGreaterThan(0); proofs.get(page)!.notes.push({ actualTrash: target, discardedFoodId: id, discardFrames: discarded.length });
});

test("124 real settled home food and toy retain their source across a native rail width resize", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 1100 }); await fixture(page, { studio: true }); await expect(home(page)).toHaveAttribute("data-home-presentation", "panel"); await placeCompanionOnHomeFloor(page); await probe(page);
  const food = await foodOnFloor(page), toy = await toyOnFloor(page), foodNode = (await food.elementHandle())!, toyNode = (await toy.elementHandle())!;
  const before = { floor: (await home(page).locator(".vc-home-floor").boundingBox())!, foodId: await food.getAttribute("data-food"), toyId: await toy.getAttribute("data-toy-id") };
  await page.setViewportSize({ width: 1920, height: 1100 }); await expect(home(page)).toHaveAttribute("data-home-presentation", "panel"); await stable(home(page).locator(".vc-home-room"));
  await floorContact(page, food, "food"); await floorContact(page, toy, "toy"); const after = (await home(page).locator(".vc-home-floor").boundingBox())!;
  expect(Math.abs(after.width - before.floor.width), "the actual home support changes width, not merely the viewport").toBeGreaterThan(1);
  expect(await foodNode.evaluate(node => node.isConnected && node === document.querySelector(".vc-food"))).toBe(true); expect(await toyNode.evaluate(node => node.isConnected && node === document.querySelector(".vc-toy"))).toBe(true);
  await expect(food).toHaveAttribute("data-food", before.foodId!); await expect(toy).toHaveAttribute("data-toy-id", before.toyId!); await expect(toy).toHaveAttribute("data-platform", /^companion-home-floor(?:-food)?(?:-\d+)?$/);
  proofs.get(page)!.notes.push({ nativeResize: { from: { width: 2400, height: 1100 }, to: { width: 1920, height: 1100 } }, before, after, retainedActualDOM: true });
});

test("124 a genuinely carried tidy toy survives one native width resize and reaches the current real opening", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 1100 }); await fixture(page, { studio: true, roam: true }); await expect(home(page)).toHaveAttribute("data-home-presentation", "panel"); await placeCompanionOnHomeFloor(page);
  await actor(page).focus(); await actor(page).press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held");
  const toy = await toyOnFloor(page), id = (await toy.getAttribute("data-toy-id"))!, identity = (await pet(page).elementHandle())!, before = (await home(page).locator(".vc-home-room").boundingBox())!;
  await expect(pet(page)).toHaveAttribute("data-state", "held"); await probe(page); await actor(page).focus(); await actor(page).press("Space"); await page.mouse.move(2, 2);
  await expect(toy).toHaveAttribute("data-carried", "true", { timeout: 30000 });
  await expect.poll(async () => (await samples(page)).some(frame => frame.toys.some(toy => toy.id === id && toy.carried)), { message: "the read-only display probe actually witnesses this carried ID before resizing", timeout: 1000, intervals: [16, 16, 32] }).toBe(true);
  const beforeResize = (await samples(page)).filter(frame => frame.toys.some(toy => toy.id === id && toy.carried)).at(-1)!;
  await page.setViewportSize({ width: 1920, height: 1100 }); await expect(home(page)).toHaveAttribute("data-home-presentation", "panel");
  await expect(page.locator(`.vc-toy[data-toy-id="${id}"]`)).toHaveCount(0, { timeout: 45000 });
  await expect.poll(async () => (await samples(page)).some(frame => frame.at > beforeResize.at && !frame.toys.some(toy => toy.id === id)), { message: "the next real display sample witnesses this ID absent after its stash acknowledgement", timeout: 1000, intervals: [16, 16, 32] }).toBe(true);
  const trace = await samples(page), carried = trace.filter(frame => frame.toys.some(toy => toy.id === id && toy.carried)), resizedCarry = carried.filter(frame => frame.viewport.width === 1920 && frame.room && Math.abs(frame.room.width - before.width) > 1), last = carried.at(-1)!;
  expect(carried.length).toBeGreaterThanOrEqual(2); expect(resizedCarry.length, "the resize actually occurs while this real toy is still carried").toBeGreaterThan(0);
  expect(last.opening).not.toBeNull(); const delivered = last.toys.find(toy => toy.id === id)!, opening = { x: last.opening!.x + last.opening!.width / 2, y: last.opening!.y + last.opening!.height };
  const distance = Math.hypot(delivered.point.x - opening.x, delivered.point.y - opening.y);
  expect(distance, "the actual final carried foot reaches the current opening after resize").toBeLessThan(20);
  expect(trace.some(frame => frame.at > last.at && !frame.toys.some(toy => toy.id === id)), "physical carry precedes the actual stash acknowledgement").toBe(true);
  expect(carried.every(frame => frame.pet?.decoded && !frame.pet.hidden && frame.toys.every(toy => Number.isFinite(toy.point.x) && Number.isFinite(toy.point.y) && toy.point.x >= 0 && toy.point.y >= 0))).toBe(true);
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
  proofs.get(page)!.notes.push({ actualToyId: id, nativeResizeAfterActualCarry: beforeResize.at, actualResizeCarriedFrames: resizedCarry.length, lastActualCarry: last, actualCurrentOpening: opening, lastOpeningDistance: distance, noNativePlacementAfterRelease: true });
});

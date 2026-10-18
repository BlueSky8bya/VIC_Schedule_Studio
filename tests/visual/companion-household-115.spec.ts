import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";

type Surface = "viewer" | "studio";
type Point = { x: number; y: number };
type FoodSample = Point & { id: string; carried: boolean; falling: boolean; discarding: boolean; hidden: boolean };
type Sample = { at: number; household: string; state: string; platform: string; actor: Point; foods: FoodSample[]; focused: boolean; hidden: boolean };
type Probe = { samples: Sample[]; transitions: { at: number; id: string; attribute: string; value: string | null }[]; stop: () => void };
type ProbeWindow = Window & { household115?: Probe };
const output = process.env.VIC_HOUSE115_OUTPUT ?? ".scratch-pw/companion-115/household/native";
const proofs = new WeakMap<Page, { build: string; writes: string[]; errors: string[]; notes: unknown[]; scripts: string[] }>();
const pet = (page: Page) => page.locator(".vc-companion");
const foods = (page: Page) => page.locator(".vc-food");
const foodPoint = (food: Locator) => food.evaluate(node => { const matrix = new DOMMatrixReadOnly((node as HTMLElement).style.transform); return { x: matrix.m41, y: matrix.m42 }; });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

test.use({ headless: true, viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.setTimeout(120000);
test.beforeEach(async ({ page }) => {
  const proof = { build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), writes: [] as string[], errors: [] as string[], notes: [] as unknown[], scripts: [] as string[] }; proofs.set(page, proof);
  mkdirSync(output, { recursive: true });
  page.on("pageerror", error => proof.errors.push(error.message));
  page.on("response", response => { if (new URL(response.url()).pathname.startsWith("/_next/static/") && response.status() === 200) proof.scripts.push(new URL(response.url()).pathname); });
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    if (url.origin !== "http://127.0.0.1:3117") return route.fulfill({ status: 503, body: "fixture forbids external reads" });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const proof = proofs.get(page)!; mkdirSync(output, { recursive: true }); const name = info.title.replace(/[^a-z0-9]+/gi, "-");
  const probe = await page.evaluate(() => { const probe = (window as ProbeWindow).household115; probe?.stop(); return { samples: probe?.samples ?? [], transitions: probe?.transitions ?? [] }; }).catch(() => ({ samples: [], transitions: [] }));
  writeFileSync(`${output}/${name}.json`, JSON.stringify({ ...proof, ...probe, status: info.status, url: page.url(), afterBuild: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim() }, null, 2));
  await page.screenshot({ path: `${output}/${name}.png` }).catch(() => {});
  expect(proof.writes).toEqual([]); expect(proof.errors).toEqual([]);
});

async function dragFood(page: Page, food: Locator, target: Point) {
  const rect = (await food.boundingBox())!, at = await foodPoint(food), grip = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down();
  await page.mouse.move(target.x + grip.x - at.x, target.y + grip.y - at.y, { steps: 14 }); await page.mouse.up(); await page.mouse.move(1880, 80);
  await expect(food).not.toHaveAttribute("data-falling"); await expect(food).not.toHaveAttribute("data-selected");
}
async function setup(page: Page, surface: Surface, personality: "tidy" | "mischievous", count: number, homeStart: false | "floor" | "seat" = false) {
  await page.addInitScript(({ key, epoch, preferences, care, personality }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    localStorage.removeItem("vic.viewerCompanionCollection"); localStorage.removeItem("vic.viewerCompanionGifts");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, personality, animalMode: "default", speed: "normal", roam: true, jump: true, sleep: false, feeding: true, learnFromYou: false, heartPrank: false, cardPrank: false, ambientPrank: personality === "mischievous", panelPrank: false, rarePrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, energy: 1, hunger: .05 }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, personality });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?links=1" : "/visual-fixture/studio?role=owner&companionDrag=1");
  expect(new URL(page.url()).origin).toBe("http://127.0.0.1:3117"); await page.bringToFront(); await settlePanelLayout(page);
  await expect(pet(page)).toBeVisible(); await openCompanionHome(page);
  const floorY = await page.evaluate(() => {
    const bars = [...document.querySelectorAll<HTMLElement>(".agenda-monthbar")].filter(node => getComputedStyle(node).position === "fixed").map(node => node.getBoundingClientRect());
    return Math.min(innerHeight - 18, ...bars.filter(rect => rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1).map(rect => rect.top - 8));
  });
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  if (homeStart === "floor") await placeCompanionOnHomeFloor(page);
  else if (homeStart === "seat") {
    const seat = (await page.locator(".vc-home-cushion").boundingBox())!;
    await actor.focus(); await actor.press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
    await page.mouse.click(seat.x + seat.width / 2, seat.y + 2); await page.mouse.move(1880, 80);
    await expect(pet(page)).toHaveAttribute("data-platform", /^companion-home(?:-\d+)?$/); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  }
  else {
    await actor.focus(); await actor.press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
    await page.mouse.click(470, floorY); await page.mouse.move(1880, 80);
    await expect(pet(page)).not.toHaveAttribute("data-state", "jump"); await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  }
  if (!homeStart) { await actor.focus(); await actor.press("Space"); await expect(pet(page)).toHaveAttribute("data-state", "held"); }
  const ids: string[] = [];
  for (let index = 0; index < count; index++) {
    await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(foods(page)).toHaveCount(index + 1);
    const food = foods(page).last(); ids.push((await food.getAttribute("data-food"))!);
    await dragFood(page, food, { x: 650 + index * 150, y: floorY - 5 });
    expect((await foodPoint(food)).y).toBeCloseTo(floorY, 1);
  }
  // Hiding the real home disables its bin/dispenser recipient. This makes
  // tidy exercise its real gather-and-put route rather than a trash shortcut.
  if (personality === "tidy") {
    const close = page.getByRole("button", { name: "빅타민 집 닫기", exact: true });
    if (await close.isVisible()) await close.click(); else await page.locator('[data-act="companion-home-fold"]').click();
    await settlePanelLayout(page); await expect(page.locator(".vc-home-room")).not.toBeVisible();
  }
  await startProbe(page);
  if (!homeStart) { await actor.focus(); await actor.press("Space"); }
  await page.mouse.move(1880, 80);
  proofs.get(page)!.notes.push({ nativeSetup: true, personality, count, ids, floorY, homeStart, foodActionsAfterSetup: "none until explicit cancellation", noRngOrClockOverride: true });
  return { ids, floorY };
}
async function startProbe(page: Page) {
  await page.evaluate(() => {
    const samples: Sample[] = [], transitions: Probe["transitions"] = []; let request = 0, last = -Infinity, stopped = false; const began = performance.now();
    const observer = new MutationObserver(records => {
      for (const record of records) if (transitions.length < 20000 && record.target instanceof HTMLElement && record.target.matches(".vc-companion,.vc-food")) transitions.push({ at: performance.now() - began, id: record.target.dataset.food ?? "actor", attribute: record.attributeName ?? "", value: record.target.getAttribute(record.attributeName!) });
    });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-household", "data-carried", "data-falling", "data-state", "data-platform"] });
    const sample = (now: number) => {
      if (stopped) return;
      if (now - last >= 1000 / 30) {
        last = now; const actor = document.querySelector<HTMLElement>(".vc-companion"), rect = actor?.getBoundingClientRect();
        samples.push({ at: now - began, household: actor?.dataset.household ?? "", state: actor?.dataset.state ?? "", platform: actor?.dataset.platform ?? "", actor: { x: rect ? rect.left + rect.width / 2 : -1, y: rect?.bottom ?? -1 }, focused: document.hasFocus(), hidden: document.hidden,
          foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(food => { const m = new DOMMatrixReadOnly(food.style.transform); return { id: food.dataset.food!, x: m.m41, y: m.m42, carried: food.hasAttribute("data-carried"), falling: food.hasAttribute("data-falling"), discarding: food.hasAttribute("data-discarding"), hidden: food.hidden }; }) });
      }
      if (now - began < 115000) request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).household115 = { samples, transitions, stop: () => { stopped = true; cancelAnimationFrame(request); observer.disconnect(); } };
    request = requestAnimationFrame(sample);
  });
}
const samples = (page: Page) => page.evaluate(() => (window as ProbeWindow).household115?.samples ?? []);
function completeTidy(trace: Sample[]) {
  const routes = new Map<string, { carried: Sample[]; last: Sample; fall?: Sample }>();
  for (const sample of trace) for (const food of sample.foods) {
    if (food.carried) { const route = routes.get(food.id); if (route) { route.carried.push(sample); route.last = sample; } else routes.set(food.id, { carried: [sample], last: sample }); }
    else { const route = routes.get(food.id); if (!route) continue; if (food.falling) route.fall ??= sample; else if (route.fall && !food.hidden) return { id: food.id, carried: route.carried, last: route.last, fall: route.fall, landed: sample }; }
  }
}
function completeToss(trace: Sample[]) {
  for (let index = 1; index < trace.length; index++) for (const before of trace[index - 1].foods.filter(food => !food.falling && !food.carried && !food.hidden)) {
    if (!trace[index].foods.some(food => food.id === before.id && food.falling)) continue;
    const flight: { at: number; food: FoodSample }[] = [];
    for (let cursor = index; cursor < trace.length; cursor++) {
      const food = trace[cursor].foods.find(food => food.id === before.id); if (!food) break;
      flight.push({ at: trace[cursor].at, food }); if (!food.falling) break;
    }
    const final = flight.at(-1);
    if (final && !final.food.falling && Math.min(...flight.map(sample => sample.food.y)) < before.y - 5 && Math.abs(final.food.x - before.x) > 8) return { before, flight, final };
  }
}

for (const surface of ["viewer", "studio"] as const) {
  test(`${surface} tidy carries a full pet's scattered snacks along a real route then drops onto the first floor`, async ({ page }) => {
    await setup(page, surface, "tidy", 2);
    await expect(page.locator(".vc-food[data-carried]")).toBeVisible({ timeout: 85000 });
    await page.screenshot({ path: `${output}/${surface}-tidy-carrying.png` });
    await expect.poll(async () => Boolean(completeTidy(await samples(page))), { timeout: 100000, intervals: [250] }).toBe(true);
    const trace = await samples(page), route = completeTidy(trace)!;
    const carriedPoints = route.carried.map(sample => sample.foods.find(food => food.id === route.id)!);
    expect(Math.max(...carriedPoints.map(point => point.x)) - Math.min(...carriedPoints.map(point => point.x))).toBeGreaterThan(50);
    const previous = route.last.foods.find(food => food.id === route.id)!, firstFall = route.fall.foods.find(food => food.id === route.id)!;
    expect(distance(previous, firstFall), "put-down must start at the real carried drawing, not teleport to the target floor").toBeLessThan(32);
    const clearance = route.carried.map(sample => sample.actor.y - sample.foods.find(food => food.id === route.id)!.y - 2);
    expect(Math.min(...clearance), "held art must clear the ground throughout the carrying route").toBeGreaterThan(1);
    expect(route.landed.foods.find(food => food.id === route.id)!.y - firstFall.y, "put-down descends from the carried drawing").toBeGreaterThan(1);
    expect(route.landed.at - route.fall.at).toBeLessThan(1700); expect(route.last.at - route.carried[0].at).toBeLessThan(35000);
    expect(trace.every(sample => sample.foods.length <= 8 && !sample.hidden && sample.focused)).toBe(true);
    await page.screenshot({ path: `${output}/${surface}-tidy-completed.png` });
    proofs.get(page)!.notes.push({ actualTidy: route, minimumNominalArtGroundClearance: Math.min(...clearance), noMealRegistration: await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCollection") ?? "{}").foods ?? []) });
  });
  test(`${surface} native grabbing a carried snack immediately takes ownership from autonomous tidy`, async ({ page }) => {
    await setup(page, surface, "tidy", 2);
    const carried = page.locator(".vc-food[data-carried]"); await expect(carried).toBeVisible({ timeout: 100000 });
    const id = (await carried.getAttribute("data-food"))!, item = page.locator(`.vc-food[data-food="${id}"]`);
    const rect = (await item.boundingBox())!; await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    await expect(item).not.toHaveAttribute("data-carried"); await page.mouse.move(1100, 850, { steps: 18 });
    await page.waitForTimeout(200); await expect(item).not.toHaveAttribute("data-carried");
    await page.mouse.up(); await page.mouse.move(1880, 80); await expect(item).not.toHaveAttribute("data-falling");
    expect((await foodPoint(item)).x).toBeGreaterThan(1000); await expect(item).toBeVisible();
    proofs.get(page)!.notes.push({ actualNativeTakeover: id, final: await foodPoint(item) });
  });
  test(`${surface} mischievous actual food contact produces a finite physical arc without a synthetic trigger`, async ({ page }) => {
    await setup(page, surface, "mischievous", 1);
    await expect.poll(async () => Boolean(completeToss(await samples(page))), { timeout: 100000, intervals: [250] }).toBe(true);
    const trace = await samples(page), toss = completeToss(trace)!;
    expect(trace.some(sample => sample.household === "mischief")).toBe(true);
    expect(toss.final.at - toss.flight[0].at).toBeLessThan(1800); expect(toss.final.food.hidden).toBe(false);
    expect(trace.every(sample => sample.foods.length <= 8 && !sample.hidden && sample.focused)).toBe(true);
    const first = trace.find(sample => sample.at === toss.flight[0].at)!;
    expect(Math.hypot(first.actor.x - toss.before.x, first.actor.y - toss.before.y), "scatter starts only at actual creature/food contact").toBeLessThan(100);
    await page.screenshot({ path: `${output}/${surface}-mischief-toss-completed.png` });
    proofs.get(page)!.notes.push({ actualToss: toss, firstContact: first, selfDispensed: trace.some(sample => sample.foods.length > 1) });
  });
  for (const start of ["floor", "seat"] as const) test(`${surface} mischievous ${start} resident actually reaches its home dispenser and releases a real snack before tossing it`, async ({ page }) => {
    await setup(page, surface, "mischievous", 0, start);
    await expect(foods(page).first()).toBeVisible({ timeout: 85000 });
    const trace = await samples(page);
    expect(trace.some(sample => sample.household === "mischief")).toBe(true);
    await page.screenshot({ path: `${output}/${surface}-actual-self-dispense.png` });
    await expect.poll(async () => Boolean(completeToss(await samples(page))), { timeout: 45000, intervals: [250] }).toBe(true);
    const full = await samples(page), toss = completeToss(full)!;
    expect(full.some(sample => sample.foods.length > 0)).toBe(true); expect(toss.final.food.hidden).toBe(false); expect(toss.final.at - toss.flight[0].at).toBeLessThan(1800);
    expect(full.every(sample => sample.foods.length <= 8)).toBe(true);
    proofs.get(page)!.notes.push({ actualSelfDispenseWithZeroInitialSnacks: true, actualToss: toss });
  });
}

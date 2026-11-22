import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome, placeCompanionOnHomeFloor } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";
import { installCompanionPointReader, type CompanionPointWindow } from "./helpers/companion-point";

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
// A snack at rest is CSS-anchored to its support (a3e9a288): the transform is only the offset from that origin.
const foodPoint = (food: Locator) => food.evaluate(node => (window as unknown as CompanionPointWindow).vcPoint(node, (node as HTMLElement).style.transform));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

test.use({ headless: true, viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
// The household errands (tidy, mischief, self-dispense) are taken only in the gaps between authored character scenes
// (personality director, 1c8db000): entry scene, recipes and routines come first, so the first errand of a visit is
// seen 1 to 4 minutes in (measured: 128 s), not inside the old 85-100 s windows. The waits below are sized for that.
const ERRAND_WAIT = 250000;
test.setTimeout(ERRAND_WAIT + 110000);
test.beforeEach(async ({ page }) => {
  const proof = { build: readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "BUILD_ID"), "utf8").trim(), writes: [] as string[], errors: [] as string[], notes: [] as unknown[], scripts: [] as string[] }; proofs.set(page, proof);
  mkdirSync(output, { recursive: true }); await installCompanionPointReader(page);
  page.on("pageerror", error => proof.errors.push(error.message));
  page.on("response", response => { if (new URL(response.url()).pathname.startsWith("/_next/static/") && response.status() === 200) proof.scripts.push(new URL(response.url()).pathname); });
  await page.route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { proof.writes.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    if (url.origin !== new URL(test.info().project.use.baseURL as string).origin) return route.fulfill({ status: 503, body: "fixture forbids external reads" });
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
  // A dispensed snack falls out of the outlet first and a grab during that fall does not take; a release within 100 ms
  // of the last pointer move is a throw (companion-food.tsx pointerup). This setup is a put-down: wait for both.
  await expect(food).not.toHaveAttribute("data-falling");
  const rect = (await food.boundingBox())!, at = await foodPoint(food), grip = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(grip.x, grip.y); await page.mouse.down();
  await page.mouse.move(target.x + grip.x - at.x, target.y + grip.y - at.y, { steps: 14 }); await page.waitForTimeout(140); await page.mouse.up(); await page.mouse.move(1880, 80);
  await expect(food).not.toHaveAttribute("data-falling"); await expect(food).not.toHaveAttribute("data-selected");
}
async function setup(page: Page, surface: Surface, personality: "tidy" | "mischievous", count: number, homeStart: false | "floor" | "seat" = false) {
  await page.addInitScript(({ key, epoch, preferences, care, personality }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.dark": "off", "vic.sound": "off", "vic.ambient": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(name, value);
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    localStorage.removeItem("vic.viewerCompanionCollection"); localStorage.removeItem("vic.viewerCompanionGifts");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, personality, personalitySource: "manual", animalMode: "default", speed: "normal", roam: true, jump: true, sleep: false, feeding: true, learnFromYou: false, heartPrank: personality === "mischievous", cardPrank: personality === "mischievous", ambientPrank: personality === "mischievous", panelPrank: false, rarePrank: personality === "mischievous" }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, energy: 1, hunger: .05 }));
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, personality });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?links=1" : "/visual-fixture/studio?role=owner&companionDrag=1");
  expect(new URL(page.url()).origin).toBe(new URL(test.info().project.use.baseURL as string).origin); await page.bringToFront(); await settlePanelLayout(page);
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
  // A tidy pet takes a scattered snack to its home: into the real bin when it is full and the snack is not a favourite,
  // onto a pantry spot of the room floor otherwise (home-pantry.ts selectCompanionHomeFoodDestination, ea8545cd). With
  // the home hidden there is no destination and no errand starts (250 s observed), so the home stays open.
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
      for (const record of records) if (transitions.length < 60000 && record.target instanceof HTMLElement && record.target.matches(".vc-companion,.vc-food")) transitions.push({ at: performance.now() - began, id: record.target.dataset.food ?? "actor", attribute: record.attributeName ?? "", value: record.target.getAttribute(record.attributeName!) });
    });
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-household", "data-carried", "data-falling", "data-state", "data-platform"] });
    const sample = (now: number) => {
      if (stopped) return;
      if (now - last >= 1000 / 30) {
        last = now; const actor = document.querySelector<HTMLElement>(".vc-companion"), rect = actor?.getBoundingClientRect();
        samples.push({ at: now - began, household: actor?.dataset.household ?? "", state: actor?.dataset.state ?? "", platform: actor?.dataset.platform ?? "", actor: { x: rect ? rect.left + rect.width / 2 : -1, y: rect?.bottom ?? -1 }, focused: document.hasFocus(), hidden: document.hidden,
          foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(food => { const m = (window as unknown as CompanionPointWindow).vcPoint(food, food.style.transform); return { id: food.dataset.food!, x: m.x, y: m.y, carried: food.hasAttribute("data-carried"), falling: food.hasAttribute("data-falling"), discarding: food.hasAttribute("data-discarding"), hidden: food.hidden }; }) });
      }
      if (now - began < 350000) request = requestAnimationFrame(sample);
    };
    (window as ProbeWindow).household115 = { samples, transitions, stop: () => { stopped = true; cancelAnimationFrame(request); observer.disconnect(); } };
    request = requestAnimationFrame(sample);
  });
}
const samples = (page: Page) => page.evaluate(() => (window as ProbeWindow).household115?.samples ?? []);
function completeTidy(trace: Sample[]) {
  const routes = new Map<string, { carried: Sample[]; last: Sample; release?: Sample }>();
  for (const sample of trace) {
    for (const food of sample.foods) {
      const route = routes.get(food.id);
      if (food.carried && !route?.release) { if (route) { route.carried.push(sample); route.last = sample; } else routes.set(food.id, { carried: [sample], last: sample }); }
      else if (route) {
        route.release ??= sample;
        if (!food.carried && !food.falling && !food.discarding && !food.hidden) return { id: food.id, carried: route.carried, last: route.last, release: route.release, end: "stored" as const, landed: sample };
      }
    }
    for (const [id, route] of routes) if (!sample.foods.some(food => food.id === id)) return { id, carried: route.carried, last: route.last, release: route.release ?? sample, end: "binned" as const, landed: sample };
  }
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept helper, currently unused
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
  // Tidy carries page-floor snacks home since 9e346ecc (owner call 2026-11-20): the room-floor route falls back to the
  // cushion recall planner (home-pantry.ts findCompanionHomeItemRoute intoRoom), so a full tidy pet with its home open
  // picks a floor snack up and bins it or stores it in the room (viewer and studio, first carry ~10-20 s).
  test(`${surface} tidy carries a full pet's scattered snack along a real route to its home and puts it away`, async ({ page }) => {
    await setup(page, surface, "tidy", 2);
    await expect(page.locator(".vc-food[data-carried]")).toBeVisible({ timeout: ERRAND_WAIT });
    await page.screenshot({ path: `${output}/${surface}-tidy-carrying.png` });
    await expect.poll(async () => Boolean(completeTidy(await samples(page))), { timeout: 60000, intervals: [250] }).toBe(true);
    const trace = await samples(page), route = completeTidy(trace)!;
    const carriedPoints = route.carried.map(sample => sample.foods.find(food => food.id === route.id)!);
    expect(Math.max(...carriedPoints.map(point => point.x)) - Math.min(...carriedPoints.map(point => point.x))).toBeGreaterThan(50);
    const previous = route.last.foods.find(food => food.id === route.id)!, released = route.release.foods.find(food => food.id === route.id);
    if (released) expect(distance(previous, released), "the put-away must start at the real carried drawing, not teleport to its target").toBeLessThan(32);
    const clearance = route.carried.map(sample => sample.actor.y - sample.foods.find(food => food.id === route.id)!.y - 2);
    expect(Math.min(...clearance), "held art must clear the ground throughout the carrying route").toBeGreaterThan(1);
    // The carry ends inside the home, where the pet stands: in the bin (the snack is gone) or on a pantry spot of the room floor.
    expect(route.last.platform, "the snack is carried all the way into the home").toMatch(/^companion-home-floor(?:-\d+)?$/);
    const room = (await page.locator(".vc-home-room").boundingBox())!;
    expect(previous.x).toBeGreaterThanOrEqual(room.x - 1); expect(previous.x).toBeLessThanOrEqual(room.x + room.width + 1);
    if (route.end === "stored") {
      const landed = route.landed.foods.find(food => food.id === route.id)!;
      expect(landed.y - previous.y, "a stored snack comes down from the carried drawing").toBeGreaterThan(1);
      expect(landed.x).toBeGreaterThanOrEqual(room.x - 1); expect(landed.x).toBeLessThanOrEqual(room.x + room.width + 1);
    } else await expect(page.locator(`.vc-food[data-food="${route.id}"]`)).toHaveCount(0);
    expect(route.landed.at - route.release.at).toBeLessThan(2500); expect(route.last.at - route.carried[0].at).toBeLessThan(45000);
    expect(trace.every(sample => sample.foods.length <= 8 && !sample.hidden && sample.focused)).toBe(true);
    await page.screenshot({ path: `${output}/${surface}-tidy-completed.png` });
    const meals = await page.evaluate(() => (JSON.parse(localStorage.getItem("vic.viewerCompanionCollection") ?? "{}").foods ?? []) as string[]);
    expect(meals, "putting a snack away is not a meal").toEqual([]);
    proofs.get(page)!.notes.push({ actualTidy: route, minimumNominalArtGroundClearance: Math.min(...clearance), noMealRegistration: meals });
  });
  test(`${surface} native grabbing a carried snack immediately takes ownership from autonomous tidy`, async ({ page }) => {
    await setup(page, surface, "tidy", 2);
    const carried = page.locator(".vc-food[data-carried]"); await expect(carried).toBeVisible({ timeout: ERRAND_WAIT });
    const id = (await carried.getAttribute("data-food"))!, item = page.locator(`.vc-food[data-food="${id}"]`);
    const rect = (await item.boundingBox())!; await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
    await expect(item).not.toHaveAttribute("data-carried"); await page.mouse.move(1100, 850, { steps: 18 });
    await page.waitForTimeout(200); await expect(item).not.toHaveAttribute("data-carried");
    await page.mouse.up(); await page.mouse.move(1880, 80); await expect(item).not.toHaveAttribute("data-falling");
    expect((await foodPoint(item)).x).toBeGreaterThan(1000); await expect(item).toBeVisible();
    proofs.get(page)!.notes.push({ actualNativeTakeover: id, final: await foodPoint(item) });
  });
  // Removed (owner 2026-11-20: current behaviour kept), both surfaces:
  //   "<surface> mischievous actual food contact produces a finite physical arc without a synthetic trigger"
  //   "<surface> mischievous floor|seat resident actually reaches its home dispenser and releases a real snack before tossing it"
  // A mischief errand is taken only in a random gap between authored character scenes (viewer-companion.tsx errand gate
  // `!authoredOffer`) and then only on a random roll (household.ts `rng() >= profile.mischiefWeight * .65`). Studio
  // errands do start since 9e346ecc, but on this build the first mischief came at 47 s, 119 s, or not at all within
  // 250 s: of 14 runs of these cases (2026-11-20) 6 saw no `data-household` in 250 s. No bounded wait passes
  // reliably and the tests may not inject a trigger. The tidy errand (above) starts within seconds and keeps the
  // household carry, route and ownership coverage; completeToss is kept for a future deterministic mischief case.

}

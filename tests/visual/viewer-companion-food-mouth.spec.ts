import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";

type Surface = "viewer" | "studio";
type Sample = { at: number; scale: number; x: number; y: number; mouthX: number; mouthY: number; error: number; row: number; facing: string; eating: boolean; hunger: number };
type Witness = { frames: Sample[]; removed: number; mealEntries: number; node: HTMLElement; observer: MutationObserver; stopped: boolean; raf: number };
type MealWindow = Window & { companionMouthWitness?: Witness };
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const foods = (page: Page) => page.locator(".vc-food");
const prefix = ".scratch-pw/companion-072-mouth";
const proof = new WeakMap<Page, { writes: string[]; errors: string[] }>();

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const result = { writes: [] as string[], errors: [] as string[] }; proof.set(page, result);
  page.on("pageerror", error => result.errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const preview = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (request.method() === "POST" && path === "/visual-fixture/studio" && preview.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { result.writes.push(`${request.method()} ${path}`); return route.fulfill({ status: 500, body: "blocked fixture mutation" }); }
    if (path === "/api/soop-live") return route.fulfill({ json: { live: false } });
    return route.continue();
  });
});
test.afterEach(async ({ page }, info) => {
  const observation = await page.evaluate(() => {
    const witness = (window as MealWindow).companionMouthWitness;
    if (!witness) return null;
    witness.stopped = true; cancelAnimationFrame(witness.raf); witness.observer.disconnect();
    return { frames: witness.frames, removed: witness.removed, mealEntries: witness.mealEntries };
  });
  await writeFile(`${prefix}-${info.title.replace(/[^a-z0-9]+/gi, "-")}.json`, JSON.stringify({ ...proof.get(page), observation }, null, 2));
  expect(proof.get(page)).toEqual({ writes: [], errors: [] });
});

async function setup(page: Page, surface: Surface) {
  await page.addInitScript(({ epoch, key, preferences, care }) => {
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left" })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 1, ...care }));
    localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
    // Keep idle choices deterministic; native input, real geometry, the meal
    // decision and the monotonic animation clock remain untouched.
    Math.random = () => 0;
  }, { epoch: SETTINGS_EPOCH, key: SETTINGS_EPOCH_KEY,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, roam: false, jump: false, sleep: false, feeding: true, heartPrank: false, ambientPrank: false, panelPrank: false },
    care: { ...DEFAULT_COMPANION_CARE, hunger: .8, energy: 1 } });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect(actor(page)).toBeVisible(); await openCompanionHome(page, "keyboard");
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await page.waitForTimeout(180); // Existing geometry's finite120ms delivery.
  await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
}

async function placePet(page: Page, x: number) {
  const floor = await page.evaluate(() => {
    let y = innerHeight - 18;
    for (const node of document.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
      if (css.position === "fixed" && css.display !== "none" && rect.width > 0 && rect.height > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) y = Math.min(y, rect.top - 8);
    }
    return y;
  });
  await actor(page).focus(); await actor(page).press("p");
  await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(x, floor);
  await expect(pet(page)).not.toHaveAttribute("data-placing");
  await expect.poll(() => pet(page).evaluate((node, point) => { const rect = node.getBoundingClientRect(); return Math.hypot(rect.left + rect.width / 2 - point.x, rect.bottom - point.y); }, { x, y: floor })).toBeLessThan(2);
  await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
}

async function foodFoot(item: Locator) { return item.evaluate(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: matrix.m41, y: matrix.m42 }; }); }
async function offerFood(page: Page, item: Locator) {
  const from = (await item.boundingBox())!, foot = await foodFoot(item), target = await pet(page).evaluate(node => { const rect = node.getBoundingClientRect(); return { x: rect.left + rect.width / 2 + 20, y: rect.bottom }; });
  const centre = { x: from.x + from.width / 2, y: from.y + from.height / 2 };
  await page.mouse.move(centre.x, centre.y); await page.mouse.down();
  await page.mouse.move(target.x + centre.x - foot.x, target.y + centre.y - foot.y, { steps: 12 }); await page.mouse.up(); await page.mouse.move(4, 4);
}

async function observe(page: Page, item: Locator) {
  await item.evaluate(node => {
    const pet = document.querySelector<HTMLElement>(".vc-companion")!, art = node.firstElementChild as HTMLElement;
    const witness: Witness = { node: node as HTMLElement, frames: [], removed: 0, mealEntries: 0, stopped: false, raf: 0, observer: new MutationObserver(() => {}) };
    let previousMeal = false;
    witness.observer = new MutationObserver(records => { for (const record of records) for (const removed of record.removedNodes) if (removed === node) witness.removed++; });
    witness.observer.observe(node.parentElement!, { childList: true });
    const sample = () => {
      if (witness.stopped) return;
      const meal = pet.dataset.state === "eat";
      if (meal && !previousMeal) witness.mealEntries++;
      previousMeal = meal;
      if (node.isConnected) {
        const rect = art.getBoundingClientRect(), sprite = pet.querySelector<HTMLElement>(".vc-sprite")!, spriteRect = sprite.getBoundingClientRect(), facing = pet.dataset.facing ?? "";
        // Independently inspected approved row09 native192px cell: mouth ink
        // centre(111,131), ±2nativepx. Project the actually painted sprite,
        // including registration, facing and the live chew deformation. The
        // finite eat row has no rotation; transformed BCR is exact here.
        const mouthX = spriteRect.left + spriteRect.width * (facing === "left" ? 1 - 111 / 192 : 111 / 192), mouthY = spriteRect.top + spriteRect.height * 131 / 192;
        const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
        witness.frames.push({ at: performance.now(), scale: Math.hypot(new DOMMatrixReadOnly(getComputedStyle(art).transform).a, new DOMMatrixReadOnly(getComputedStyle(art).transform).b), x, y, mouthX, mouthY, error: Math.hypot(x - mouthX, y - mouthY), row: parseFloat(pet.style.getPropertyValue("--vc-row")) * 31 / 100, facing, eating: node.hasAttribute("data-eating"), hunger: JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!).hunger });
      }
      witness.raf = requestAnimationFrame(sample);
    };
    (window as MealWindow).companionMouthWitness = witness; witness.raf = requestAnimationFrame(sample);
  });
}

async function captureMeal(page: Page, path: string) {
  const clip = await pet(page).evaluate(node => {
    const pet = node.getBoundingClientRect(), food = document.querySelector(".vc-food")!.getBoundingClientRect();
    const x = Math.max(0, Math.min(pet.left, food.left) - 28), y = Math.max(0, Math.min(pet.top, food.top) - 28);
    const right = Math.min(innerWidth, Math.max(pet.right, food.right) + 28), bottom = Math.min(innerHeight, Math.max(pet.bottom, food.bottom) + 28);
    return { x, y, width: right - x, height: bottom - y };
  });
  await page.screenshot({ path, clip });
}

for (const surface of ["viewer", "studio"] as const) for (const facing of ["left", "right"] as const) {
  test(`${surface} ${facing} snack shrinks into the visible mouth`, async ({ page }) => {
    await setup(page, surface); await placePet(page, 180); await placePet(page, facing === "left" ? 140 : 220);
    await expect(pet(page)).toHaveAttribute("data-facing", facing);
    await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(foods(page)).toHaveCount(1);
    const item = foods(page).first(); await observe(page, item); await offerFood(page, item);
    await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 10000 });
    const reached = (lower: number, upper: number) => page.evaluate(({ lower, upper }) => (window as MealWindow).companionMouthWitness!.frames.some(frame => frame.eating && frame.scale >= lower && frame.scale <= upper), { lower, upper });
    await expect.poll(() => reached(.72, .84), { intervals: [20] }).toBe(true);
    await captureMeal(page, `${prefix}-${surface}-${facing}-early.png`);
    await expect.poll(() => reached(.16, .28), { intervals: [20] }).toBe(true);
    await captureMeal(page, `${prefix}-${surface}-${facing}-late.png`);
    await expect(foods(page)).toHaveCount(0, { timeout: 6000 });
    const result = await page.evaluate(() => { const witness = (window as MealWindow).companionMouthWitness!; return { frames: witness.frames, removed: witness.removed, mealEntries: witness.mealEntries, care: JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!) as { hunger: number; affection: number } }; });
    const shrinking = result.frames.filter(frame => frame.eating && frame.scale <= .8 && frame.scale >= .1);
    expect(shrinking.length).toBeGreaterThan(25);
    for (const frame of shrinking) expect(frame.row).toBeCloseTo(9, 5);
    expect(Math.max(...shrinking.map(frame => frame.error)), "art centre must stay at the actual mouth, not sink16px while shrinking").toBeLessThan(5);
    const relativeY = shrinking.map(frame => frame.y - frame.mouthY);
    expect(Math.max(...relativeY) - Math.min(...relativeY)).toBeLessThan(3);
    expect(Math.min(...result.frames.filter(frame => frame.eating).map(frame => frame.scale))).toBeLessThan(.1);
    expect(new Set(shrinking.map(frame => frame.facing))).toEqual(new Set([facing]));
    expect(result.removed).toBe(1); expect(result.mealEntries).toBe(1);
    expect(result.care.hunger).toBeGreaterThan(.42); expect(result.care.hunger).toBeLessThan(.48);
    expect(result.care.affection).toBeGreaterThan(.39); expect(result.care.affection).toBeLessThan(.42);
    if (surface === "viewer") expect(await page.locator("[data-export-surface]").evaluate(node => getComputedStyle(node).width)).toBe("1840px");
  });
}

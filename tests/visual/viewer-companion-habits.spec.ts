import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";
import { waitForOverlayEntrance } from "./helpers/companion-overlay";

type Surface = "viewer" | "studio";
type Habits = { sociability: number; playfulness: number; confidence: number; credit: number; generation: number };
type Memory = { version: number; hunger: number; affection: number; energy: number; curiosity: number; habits: Habits };
type Point = { x: number; y: number };
type Proof = { writes: string[]; errors: string[]; snapshots: { label: string; memory: Memory }[] };
const proof = new WeakMap<Page, Proof>();
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => pet(page).locator(".vc-actor");
const foods = (page: Page) => page.locator(".vc-food");
const traits = (habits: Habits) => ({ sociability: habits.sociability, playfulness: habits.playfulness, confidence: habits.confidence });
const needs = (memory: Memory) => ({ hunger: memory.hunger, affection: memory.affection, energy: memory.energy, curiosity: memory.curiosity });
const neutral = { sociability: 0, playfulness: 0, confidence: 0 };
const prefix = ".scratch-pw/companion-habits";

test.use({ viewport: { width: 1920, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.beforeEach(async ({ page }) => {
  const result: Proof = { writes: [], errors: [], snapshots: [] }; proof.set(page, result);
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
  await writeFile(`${prefix}-${info.title.replace(/[^a-z0-9]+/gi, "-")}.json`, JSON.stringify(proof.get(page), null, 2));
  expect(proof.get(page)?.writes).toEqual([]); expect(proof.get(page)?.errors).toEqual([]);
});

async function setup(page: Page, surface: Surface, options: { hunger?: number; habits?: Habits; dark?: boolean } = {}) {
  await page.addInitScript(({ key, epoch, preferences, care, habits, dark }) => {
    // Seed once only: native reload must retain the actual store, rather than
    // having an init script silently recreate the desired result each time.
    if (!sessionStorage.getItem("companion-habits-fixture-seeded")) {
      for (const [name, value] of Object.entries({ [key]: epoch, "vic.reduceMotion": "off", "vic.gfxPref": "max", "vic.ambient": "off", "vic.sound": "off", "vic.premiereStage": "off", "vic_avatar_side": "left", "vic.dark": dark ? "on" : "off" })) localStorage.setItem(name, value);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: habits ? 2 : 1, ...care, ...(habits ? { habits } : {}) }));
      localStorage.removeItem("vic.panelSections"); localStorage.removeItem("vic_panel_collapsed");
      sessionStorage.setItem("companion-habits-fixture-seeded", "1");
    }
    // Choose the existing stationary idle. Native input, the learning gate,
    // care clock, food completion and persistence remain the actual product.
    Math.random = () => 0;
  }, { key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled: true, learnFromYou: true, roam: false, jump: false, sleep: false, feeding: true, petting: true, heartPrank: false, ambientPrank: false, panelPrank: false },
    care: { ...DEFAULT_COMPANION_CARE, hunger: options.hunger ?? .05, energy: 1 }, habits: options.habits, dark: options.dark ?? false });
  await page.goto(surface === "viewer" ? "/visual-fixture/poster?avatar=1" : "/visual-fixture/studio?role=owner");
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(async () => { await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === "running" && Number.isFinite(Number(animation.effect?.getComputedTiming().endTime))).map(animation => animation.finished)); });
  await expect(actor(page)).toBeVisible(); await expect.poll(() => page.evaluate(() => document.hasFocus())).toBe(true);
}
async function memory(page: Page, label?: string): Promise<Memory> {
  const value = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!) as Memory);
  if (label) proof.get(page)!.snapshots.push({ label, memory: value });
  return value;
}
async function stableActor(page: Page) {
  await expect(actor(page)).toBeVisible();
  await expect(pet(page)).toHaveAttribute("data-presence", "active", { timeout: 6000 });
  await expect(pet(page)).not.toHaveAttribute("data-state", "held");
}
async function petOnce(page: Page) {
  await stableActor(page); await actor(page).focus(); await actor(page).press("Enter");
  await expect(pet(page)).toHaveAttribute("data-state", "petted");
}
async function openPersonality(page: Page) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await expect(dialog).toBeVisible(); await waitForOverlayEntrance(dialog);
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.locator("#rhh-tab-companion-panel").getByRole("tab", { name: "성격", exact: true }).click();
  await waitForOverlayEntrance(dialog);
  return dialog;
}
async function closeSettings(page: Page, dialog: Locator) {
  await dialog.locator(".modal-head .modal-close").click(); await expect(dialog).toHaveCount(0); await stableActor(page);
}
async function resetViaSettings(page: Page) {
  const dialog = await openPersonality(page); await dialog.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
  await expect.poll(async () => traits((await memory(page)).habits)).toEqual(neutral);
  await closeSettings(page, dialog);
}
async function floorY(page: Page) {
  return page.evaluate(() => {
    let y = innerHeight - 18;
    for (const node of document.querySelectorAll<HTMLElement>(".agenda-monthbar")) {
      const rect = node.getBoundingClientRect(), css = getComputedStyle(node);
      if (css.position === "fixed" && css.display !== "none" && rect.width > 0 && rect.height > 0 && rect.top >= innerHeight * .65 && rect.bottom <= innerHeight + 1) y = Math.min(y, rect.top - 8);
    }
    return y;
  });
}
async function placeOnFloor(page: Page) {
  const at = { x: 180, y: await floorY(page) };
  await actor(page).focus(); await actor(page).press("p"); await expect(pet(page)).toHaveAttribute("data-placing", "");
  await page.mouse.click(at.x, at.y); await page.mouse.move(4, 4);
  await expect(pet(page)).not.toHaveAttribute("data-placing"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect(pet(page)).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/);
  return at;
}
async function foodPoint(item: Locator) { return item.evaluate(node => { const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform); return { x: matrix.m41, y: matrix.m42 }; }); }
async function grabFood(page: Page, item: Locator) {
  const rect = (await item.boundingBox())!, point = await foodPoint(item), centre = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(centre.x, centre.y); await page.mouse.down(); return { x: centre.x - point.x, y: centre.y - point.y };
}
async function moveFood(page: Page, target: Point, offset: Point) { await page.mouse.move(target.x + offset.x, target.y + offset.y, { steps: 12 }); }

for (const surface of ["viewer", "studio"] as const) {
  test(`${surface} an earned petting habit survives reload while immediate repetitions cannot train twice`, async ({ page }) => {
    await setup(page, surface);
    const before = await memory(page, "legacy v1 before interaction");
    if (before.version === 2) { expect(traits(before.habits)).toEqual(neutral); expect(before.habits.credit).toBe(1); expect(before.habits.generation).toBe(0); }
    await petOnce(page);
    await expect.poll(async () => (await memory(page)).habits?.sociability, { intervals: [50], timeout: 7000 }).toBeGreaterThan(.02);
    const first = await memory(page, "first actual petting"); expect(first.version).toBe(2);
    expect(first.habits.sociability).toBeLessThan(.05); expect(first.habits.confidence).toBeGreaterThan(0); expect(first.habits.playfulness).toBeGreaterThan(0); expect(first.habits.credit).toBeLessThan(.08);
    // Reload immediately after the acknowledged experience, before the
    // ordinary five-second periodic care write can make a lost update pass.
    await page.reload(); await page.bringToFront(); await stableActor(page);
    expect(traits((await memory(page, "immediate reload retains the acknowledged experience")).habits)).toEqual(traits(first.habits));
    await petOnce(page);
    await expect.poll(async () => (await memory(page)).affection, { intervals: [50], timeout: 7000 }).toBeGreaterThan(first.affection + .04);
    const repeated = await memory(page, "second real petting within credit window");
    expect(traits(repeated.habits)).toEqual(traits(first.habits)); expect(repeated.habits.credit).toBeLessThan(.75);
    await page.reload(); await page.bringToFront(); await stableActor(page);
    expect(traits((await memory(page, "after native reload")).habits)).toEqual(traits(first.habits));
    if (surface === "viewer") expect(await page.locator("[data-export-surface]").evaluate(node => getComputedStyle(node).width)).toBe("1840px");
  });

  test(`${surface} learning off and native reset preserve needs and cannot be undone by settings cleanup`, async ({ page }) => {
    const seeded = { sociability: .45, playfulness: .3, confidence: .2, credit: 1, generation: 0 };
    await setup(page, surface, { hunger: .63, habits: seeded });
    let dialog = await openPersonality(page);
    const learning = dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true });
    await expect(learning).toBeChecked(); await learning.click(); await expect(learning).not.toBeChecked();
    await closeSettings(page, dialog); await petOnce(page);
    await expect.poll(async () => (await memory(page)).affection, { intervals: [50], timeout: 7000 }).toBeGreaterThan(.35);
    expect((await memory(page, "friendly input with learning off")).habits).toEqual(seeded);
    dialog = await openPersonality(page); const before = await memory(page, "before native reset");
    await dialog.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
    await expect.poll(async () => (await memory(page)).habits).toEqual({ ...neutral, credit: 1, generation: 1 });
    expect(needs(await memory(page, "immediately after reset"))).toEqual(needs(before));
    await waitForOverlayEntrance(dialog);
    await page.screenshot({ path: `${prefix}-${surface}-settings.png` });
    await closeSettings(page, dialog); await page.reload(); await page.bringToFront(); await stableActor(page);
    expect((await memory(page, "reset retained after cleanup and reload")).habits).toEqual({ ...neutral, credit: 1, generation: 1 });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!).learnFromYou as boolean)).toBe(false);
  });
}

test("viewer a short bonk and a successful normal drag earn different habits", async ({ page }) => {
  test.setTimeout(30000); await setup(page, "viewer");
  await actor(page).click({ delay: 65 }); await page.mouse.move(4, 4);
  await expect(pet(page)).toHaveAttribute("data-play", "bonk-tears");
  await expect.poll(async () => (await memory(page)).habits?.confidence).toBeLessThan(-.02);
  const bonked = await memory(page, "actual short bonk"); expect(bonked.habits.confidence).toBeGreaterThan(-.05); expect(bonked.habits.sociability).toBeLessThan(0);
  await resetViaSettings(page);
  const body = (await actor(page).boundingBox())!, carrier = (await pet(page).boundingBox())!, from = { x: body.x + body.width / 2, y: body.y + body.height * .45 };
  const target = { x: 550, y: await floorY(page) }, footOffset = carrier.y + carrier.height - from.y;
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(target.x, target.y - footOffset, { steps: 18 });
  await expect(pet(page)).toHaveAttribute("data-state", "held");
  expect(traits((await memory(page, "still held before a successful release")).habits)).toEqual(neutral);
  await page.mouse.up(); await page.mouse.move(4, 4);
  await expect(pet(page)).not.toHaveAttribute("data-state", "held"); await expect(pet(page)).not.toHaveAttribute("data-state", "jump");
  await expect.poll(async () => (await memory(page)).habits.playfulness).toBeGreaterThan(.02);
  const played = await memory(page, "successful native drag release"); expect(played.habits.confidence).toBeGreaterThan(0); expect(played.habits.sociability).toBeGreaterThan(0);
  expect(played.habits.playfulness).toBeLessThan(.05);
});

test("studio food earns a habit only after actual eating rather than spawning or holding", async ({ page }) => {
  test.setTimeout(30000); await setup(page, "studio", { hunger: .8 });
  await openCompanionHome(page, "keyboard"); await page.waitForTimeout(180);
  const foot = await placeOnFloor(page);
  // Deliberate positioning itself is a learned human play episode. Reset via
  // the real UI before isolating the separate food-completion credit below.
  await resetViaSettings(page); await openCompanionHome(page, "keyboard");
  await page.getByRole("button", { name: "밥 꺼내기", exact: true }).click(); await expect(foods(page)).toHaveCount(1);
  await page.waitForTimeout(350); expect(traits((await memory(page, "offered but uneaten food")).habits)).toEqual(neutral);
  const item = foods(page).first(), offset = await grabFood(page, item);
  await moveFood(page, { x: foot.x + 20, y: foot.y }, offset); await page.waitForTimeout(250);
  expect(traits((await memory(page, "held source is not a completed meal")).habits)).toEqual(neutral);
  await expect(pet(page)).not.toHaveAttribute("data-state", "eat");
  await page.mouse.up(); await page.mouse.move(4, 4);
  await expect(pet(page)).toHaveAttribute("data-state", "eat", { timeout: 6000 });
  expect(traits((await memory(page, "meal started but not completed")).habits)).toEqual(neutral);
  await expect(foods(page)).toHaveCount(0, { timeout: 6000 });
  await expect.poll(async () => (await memory(page)).habits.sociability).toBeGreaterThan(.01);
  const fed = await memory(page, "actual meal completion"); expect(fed.hunger).toBeLessThan(.5); expect(fed.habits.confidence).toBeGreaterThan(.02); expect(fed.habits.playfulness).toBeLessThan(.01);
  expect(fed.habits.credit).toBeLessThan(.2);
});

test("a native reset can relearn the exact same first petting after learning is switched back on", async ({ page }) => {
  await setup(page, "viewer", { dark: true }); await petOnce(page);
  await expect.poll(async () => (await memory(page)).habits?.sociability, { intervals: [50], timeout: 7000 }).toBeGreaterThan(.02);
  const first = await memory(page, "first learned triple before reset");
  const dialog = await openPersonality(page), learning = dialog.getByRole("switch", { name: "빅타민 함께 지내며 배우기 켜기/끄기", exact: true });
  await learning.click(); await expect(learning).not.toBeChecked();
  await dialog.getByRole("button", { name: "배운 습관 초기화", exact: true }).click();
  await expect.poll(async () => (await memory(page)).habits).toEqual({ ...neutral, credit: 1, generation: first.habits.generation + 1 });
  await learning.click(); await expect(learning).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await waitForOverlayEntrance(dialog);
  await page.screenshot({ path: `${prefix}-viewer-dark-settings.png` });
  await closeSettings(page, dialog); await petOnce(page);
  await expect.poll(async () => (await memory(page)).habits.sociability, { intervals: [50], timeout: 7000 }).toBeGreaterThan(.02);
  const relearned = await memory(page, "same accepted petting after reset and reenable");
  expect(traits(relearned.habits)).toEqual(traits(first.habits));
  expect(relearned.habits.generation).toBe(first.habits.generation + 1);
  await page.reload(); await page.bringToFront(); await stableActor(page);
  expect(traits((await memory(page, "relearned triple persists after native reload")).habits)).toEqual(traits(first.habits));
});

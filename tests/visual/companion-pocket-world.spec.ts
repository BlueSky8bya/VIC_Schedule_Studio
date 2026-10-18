import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { createCompanionLife } from "@/lib/ui/viewer-companion/life";
import { COMPANION_ACCESSORY_MOTION_MS } from "@/lib/ui/viewer-companion/accessory-motion";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { openCompanionHome } from "./helpers/companion-home";
import { settlePanelLayout } from "./helpers/panel-layout";

test.use({ viewport: { width: 1440, height: 1800 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
test.setTimeout(90_000);
const pet = (page: Page) => page.locator(".vc-companion");
const actor = (page: Page) => page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
const food = (page: Page) => page.locator(".vc-food");
const output = process.env.VIC_POCKET_OUTPUT ?? ".scratch-pw/companion-111/pocket-native";
async function environment(page: Page) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
  return dialog;
}
async function prepare(page: Page) {
  const writes: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.route("**/*", route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!["GET", "HEAD"].includes(request.method())) { writes.push(path); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (path.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live reads" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, care, life, epochKey, epoch }) => {
    localStorage.setItem(epochKey, epoch); localStorage.setItem("vic.sound", "off"); localStorage.setItem("vic.ambient", "off"); localStorage.setItem("vic.gfxPref", "max"); localStorage.setItem("vic.reduceMotion", "off");
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, enabled: true, roam: false, jump: false, sleep: false, feeding: true, petting: false, rarePrank: true, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false }));
    localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger: .05, energy: .98, life }));
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: [], behaviors: [], situations: [], gifts: { pending: null, unlocked: ["magic-pocket"], equipped: "magic-pocket", activeMs: 0, interactionCredit: 0 } }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_CARE, life: createCompanionLife(() => 0), epochKey: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH });
  await page.goto("/visual-fixture/poster"); await page.bringToFront(); await settlePanelLayout(page);
  await expect(actor(page)).toBeVisible();
  const room = await openCompanionHome(page);
  await room.getByRole("button", { name: "밥 꺼내기", exact: true }).click();
  await expect(food(page)).toHaveCount(1);
  const original = { id: (await food(page).getAttribute("data-food"))!, kind: (await food(page).getAttribute("data-kind"))! };
  const from = (await food(page).boundingBox())!;
  // A tall real viewport keeps the ordinary world floor visible and clear
  // of card text supports; the exact same authored gravity/colliders run.
  const drop = { x: 1010, y: 1650 };
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down(); await page.mouse.move(drop.x, drop.y, { steps: 12 }); await page.mouse.up(); await page.mouse.move(3, 3);
  await expect(food(page)).not.toHaveAttribute("data-falling", "");
  await room.locator('[data-home-action="close"]').click();
  const dialog = await environment(page);
  await dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "움직임", exact: true }).click();
  await dialog.getByRole("switch", { name: "빅타민 돌아다니기 켜기/끄기", exact: true }).click();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  // Real held time, no patched RNG/clock/AI/debug action. Release next to
  // the snack only after the equipped prop's ordinary readiness interval.
  const body = (await actor(page).boundingBox())!;
  const snack = (await food(page).boundingBox())!;
  mkdirSync(output, { recursive: true }); writeFileSync(`${output}/setup-${test.info().testId}.json`, JSON.stringify({ original, body, snack }, null, 2));
  await page.mouse.move(body.x + body.width / 2, body.y + body.height / 2); await page.mouse.down(); await page.mouse.move(snack.x + snack.width / 2 - 32, snack.y + snack.height / 2 - body.height / 2 - 24, { steps: 8 });
  await page.waitForTimeout(6500); await page.mouse.up(); await page.mouse.move(3, 3);
  await expect(pet(page)).toHaveAttribute("data-accessory-trick", "magic-pocket", { timeout: 30_000 });
  const before = await read(page);
  return { writes, errors, original, before };
}
async function read(page: Page) {
  return page.evaluate(() => {
    const memory = JSON.parse(localStorage.getItem("vic.viewerCompanionCare")!), collection = JSON.parse(localStorage.getItem("vic.viewerCompanionCollection")!);
    return { foods: [...document.querySelectorAll<HTMLElement>(".vc-food")].map(node => ({ id: node.dataset.food, kind: node.dataset.kind, eating: node.hasAttribute("data-eating"), transform: node.style.transform })), discoveredFoods: collection.foods, foodScores: memory.life.foodScores, familiarity: memory.life.familiarity, recent: memory.life.recent };
  });
}
async function absorbedBeforeCommit(page: Page) {
  await page.waitForFunction(duration => { const el = document.querySelector<HTMLElement>(".vc-companion"); if (!el || el.dataset.accessoryTrick !== "magic-pocket") return false; const p = (performance.now() - Number(el.dataset.journey)) / duration; return p >= .60 && p <= .73; }, COMPANION_ACCESSORY_MOTION_MS, { polling: "raf", timeout: 30_000 });
  await expect(food(page)).toHaveAttribute("data-eating", "");
}
for (const interruption of ["window-and-off", "drag"] as const) test(`magic pocket: ${interruption} before commit restores the original snack`, async ({ page }) => {
  const safety = await prepare(page); await absorbedBeforeCommit(page);
  if (interruption === "window-and-off") {
    const dialog = await environment(page);
    await dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "장난", exact: true }).click();
    await dialog.getByRole("switch", { name: "빅타민 희귀 소품 장난 켜기/끄기", exact: true }).click();
    await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  } else {
    const box = (await actor(page).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x - 60, box.y + 20, { steps: 6 }); await page.mouse.up();
  }
  await expect(food(page)).toHaveCount(1); await expect(food(page)).toHaveAttribute("data-food", safety.original.id); await expect(food(page)).toHaveAttribute("data-kind", safety.original.kind);
  await expect(food(page)).not.toHaveAttribute("data-eating", "");
  const after = await read(page);
  expect(after.discoveredFoods).toEqual(safety.before.discoveredFoods); expect(after.familiarity).toEqual(safety.before.familiarity);
  // Unfed taste scores naturally drift by tiny amounts on real needs ticks.
  // A meal would change familiarity and add a feeding reason; neither may
  // happen during the prop exchange. Native clocks remain untouched.
  const scoreDelta = Math.max(...Object.entries(after.foodScores as Record<string, number>).map(([key, value]) => Math.abs(value - safety.before.foodScores[key])));
  expect(scoreDelta).toBeLessThan(.001);
  expect(after.recent.filter((reason: string) => ["favorite-food", "new-flavor", "discovered-taste", "variety"].includes(reason))).toEqual(safety.before.recent.filter((reason: string) => ["favorite-food", "new-flavor", "discovered-taste", "variety"].includes(reason)));
  mkdirSync(output, { recursive: true }); writeFileSync(`${output}/${interruption}.json`, JSON.stringify({ ...safety, after }, null, 2)); await page.screenshot({ path: `${output}/${interruption}.png` });
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});
test("magic pocket: completed exchange creates one different snack without feeding or discovery", async ({ page }) => {
  const safety = await prepare(page);
  await absorbedBeforeCommit(page);
  const absorbed = await read(page);
  // Read only the unique committed replacement after the actual capture;
  // an unfilled-pocket spawn is deliberately not this exchange scenario.
  await expect.poll(async () => (await food(page).count()) === 1 && (await food(page).getAttribute("data-food")) !== safety.original.id, { timeout: 10_000 }).toBe(true);
  await expect(food(page)).toHaveCount(1); await expect(food(page)).not.toHaveAttribute("data-food", safety.original.id); await expect(food(page)).not.toHaveAttribute("data-kind", safety.original.kind);
  const after = await read(page);
  expect(after.discoveredFoods).toEqual(safety.before.discoveredFoods); expect(after.familiarity).toEqual(safety.before.familiarity);
  // Unfed taste scores naturally drift by tiny amounts on real needs ticks.
  // A meal would change familiarity and add a feeding reason; neither may
  // happen during the prop exchange. Native clocks remain untouched.
  const scoreDelta = Math.max(...Object.entries(after.foodScores as Record<string, number>).map(([key, value]) => Math.abs(value - safety.before.foodScores[key])));
  expect(scoreDelta).toBeLessThan(.001);
  expect(after.recent.filter((reason: string) => ["favorite-food", "new-flavor", "discovered-taste", "variety"].includes(reason))).toEqual(safety.before.recent.filter((reason: string) => ["favorite-food", "new-flavor", "discovered-taste", "variety"].includes(reason)));
  mkdirSync(output, { recursive: true }); writeFileSync(`${output}/completed.json`, JSON.stringify({ ...safety, absorbed, after }, null, 2)); await page.screenshot({ path: `${output}/completed.png` });
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

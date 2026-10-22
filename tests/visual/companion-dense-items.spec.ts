import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { MAX_COMPANION_FOOD } from "@/lib/ui/viewer-companion/food-capacity";
import { MAX_COMPANION_TOYS } from "@/lib/ui/viewer-companion/toys";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { chooseCompanionPersonality, openCompanionHome } from "./helpers/companion-home";
import { finishCompanionQa, guardCompanionQa, startCompanionQaProbe, type DailyProof } from "./helpers/companion-qa";
import { settlePanelLayout } from "./helpers/panel-layout";

type Operation = "hold-food" | "remove-food" | "move-actor" | "feeding-off" | "roam-off" | "master-off";
type Scenario = { id: string; personality: CompanionPersonality; hunger: number; seconds: 90 | 180 | 300; gap?: true; two?: true; operation?: Operation };
const scenarios: readonly Scenario[] = [
  { id: "dense-balanced-gap", personality: "balanced", hunger: .85, seconds: 180, gap: true },
  { id: "dense-gourmet-gap", personality: "gourmet", hunger: .85, seconds: 180, gap: true },
  { id: "dense-curious-full-five-minutes", personality: "curious", hunger: .12, seconds: 300 },
  { id: "dense-tidy-four-returns", personality: "tidy", hunger: .12, seconds: 300 },
  { id: "dense-two-food-control", personality: "balanced", hunger: .85, seconds: 90, gap: true, two: true },
  { id: "dense-selected-food-held-and-moved", personality: "gourmet", hunger: .85, seconds: 90, operation: "hold-food" },
  { id: "dense-selected-food-removed", personality: "balanced", hunger: .85, seconds: 90, operation: "remove-food" },
  { id: "dense-meal-manual-actor-interruption", personality: "balanced", hunger: .85, seconds: 90, operation: "move-actor" },
  { id: "dense-feeding-off-and-resume", personality: "gourmet", hunger: .85, seconds: 90, operation: "feeding-off" },
  { id: "dense-roam-off-and-resume", personality: "balanced", hunger: .85, seconds: 90, operation: "roam-off" },
  { id: "dense-master-off-repopulation", personality: "balanced", hunger: .85, seconds: 90, operation: "master-off" },
  { id: "dense-sleepy-full-five-minutes", personality: "sleepy", hunger: .12, seconds: 300 },
];

async function exposed(button: Locator) {
  const point = await button.evaluate(node => {
    const rect = node.getBoundingClientRect();
    for (const fy of [.5, .15, .85]) for (const fx of [.5, .15, .85]) {
      const x = rect.left + rect.width * fx, y = rect.top + rect.height * fy, hit = document.elementFromPoint(x, y);
      if (hit && (hit === node || node.contains(hit))) return { x, y };
    }
    return null;
  });
  expect(point, "native control has a real exposed hit target").not.toBeNull();
  await button.page().mouse.click(point!.x, point!.y);
}
async function settings(page: Page, tab: "motion" | "affection" | "personality" = "personality") {
  const home = await openCompanionHome(page); await exposed(home.getByRole("button", { name: "빅타민 수첩 열기", exact: true }));
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
  if (tab !== "personality") await dialog.locator(`[data-companion-tab="${tab}"]`).click();
  return dialog;
}
async function populate(page: Page, two = false) {
  const home = await openCompanionHome(page), foodCount = two ? 2 : MAX_COMPANION_FOOD, toyCount = two ? 0 : MAX_COMPANION_TOYS;
  // Real keyboard activation keeps the command on its named control while
  // freshly emitted physical objects cross the outlet's pointer hit area.
  const feed = home.getByRole("button", { name: "밥 꺼내기", exact: true }), box = home.getByRole("button", { name: "장난감 상자 열기", exact: true });
  for (let i = 0; i < foodCount; i++) { await feed.focus(); await feed.press("Enter"); await expect(page.locator(".vc-food")).toHaveCount(i + 1); }
  for (let i = 0; i < toyCount; i++) { await box.focus(); await box.press("Enter"); await expect(page.locator(".vc-toy")).toHaveCount(i + 1); }
  return { foods: await page.locator(".vc-food").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-food")!)), toys: await page.locator(".vc-toy").evaluateAll(nodes => nodes.map(n => n.getAttribute("data-toy-id")!)) };
}
/** Real placement keeps a hungry resident out of mouth reach while a person
 * fills capacity. Roam OFF still permits eating a snack already at its mouth. */
async function parkCompanionAwayFromFood(page: Page) {
  const home = await openCompanionHome(page), room = (await home.boundingBox())!;
  const point = await page.locator('.public-event[data-eventid]').evaluateAll((nodes, homeRight) => {
    for (const node of nodes) {
      const rect = node.getBoundingClientRect(), x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      if (rect.width > 48 && rect.top > 100 && rect.bottom < innerHeight - 30 && x > homeRight + 120 && hit && node.contains(hit)) return { x, y };
    }
    return null;
  }, room.x + room.width);
  expect(point, "a real exposed calendar card away from the food dispenser").not.toBeNull();
  const actor = page.locator(".vc-actor"), companion = page.locator(".vc-companion");
  await actor.focus(); await actor.press("p"); await expect(companion).toHaveAttribute("data-placing", "");
  await page.mouse.click(point!.x, point!.y); await page.mouse.move(2, 2); await expect(companion).not.toHaveAttribute("data-placing");
  await expect.poll(async () => { const rect = (await companion.boundingBox())!; return rect.x + rect.width / 2; }).toBeGreaterThan(room.x + room.width + 80);
  return { chosenRealCardPoint: point, actual: await companion.boundingBox() };
}
type DenseFrame = { at: number; data: Record<string, string>; x: number; y: number; objects: Array<{ type: string; data: Record<string, string>; x: number; y: number; width: number; height: number; hidden: boolean }>; box: { x: number; y: number } | null };
type DenseWindow = Window & { denseItemsProbe?: { stop(): void; read(): string } };
async function observeObjects(page: Page) {
  await page.evaluate(() => {
    const frames: string[] = []; let request = 0, previous = -Infinity, stopped = false;
    const tick = (at: number) => {
      if (stopped) return;
      if (at - previous >= 100) {
        previous = at; const actor = document.querySelector<HTMLElement>(".vc-companion"), rect = actor?.getBoundingClientRect();
        const box = document.querySelector(".vc-toy-box-opening")?.getBoundingClientRect();
        const objects = Array.from(document.querySelectorAll<HTMLElement>(".vc-food,.vc-toy")).map(node => {
          const r = node.getBoundingClientRect(); return { type: node.matches(".vc-food") ? "food" : "toy", data: { ...node.dataset }, x: r.left + r.width / 2, y: r.bottom, width: r.width, height: r.height, hidden: node.hidden || Boolean(node.closest("[hidden]")) };
        });
        frames.push(JSON.stringify({ at: performance.now(), data: actor ? { ...actor.dataset } : {}, x: rect ? rect.left + rect.width / 2 : 0, y: rect?.bottom ?? 0, objects, box: box ? { x: box.left + box.width / 2, y: box.bottom } : null }));
      }
      request = requestAnimationFrame(tick);
    };
    (window as DenseWindow).denseItemsProbe = Object.freeze({ stop() { stopped = true; cancelAnimationFrame(request); }, read() { return "[" + frames.join(",") + "]"; } });
    request = requestAnimationFrame(tick);
  });
}
async function intervene(page: Page, operation: Operation) {
  if (operation === "hold-food" || operation === "remove-food") {
    const handle = await page.waitForFunction(() => { const id = document.querySelector<HTMLElement>(".vc-companion")?.dataset.foodGoal; return id && Array.from(document.querySelectorAll<HTMLElement>(".vc-food")).some(n => n.dataset.food === id) ? id : null; });
    const id = await handle.jsonValue(); await handle.dispose(); const food = page.locator(`.vc-food[data-food="${id}"]`);
    await food.focus();
    if (operation === "remove-food") { await food.press("Delete"); await expect(food).toHaveCount(0); return { operation, id }; }
    await food.press("Enter"); await expect(food).toHaveAttribute("data-selected", "");
    await page.waitForTimeout(3000); await expect(food).toHaveCount(1);
    for (let i = 0; i < 5; i++) await food.press("ArrowRight"); await food.press("ArrowUp"); await food.press("Escape");
    await expect(food).not.toHaveAttribute("data-selected"); await page.mouse.move(2, 2); return { operation, id };
  }
  if (operation === "move-actor") {
    const actor = page.locator(".vc-actor"); await actor.focus(); await actor.press("Space"); await expect(page.locator(".vc-companion")).toHaveAttribute("data-state", "held");
    for (let i = 0; i < 3; i++) await actor.press("ArrowRight"); await actor.press("ArrowUp"); await actor.press("Escape");
    await expect(page.locator(".vc-companion")).not.toHaveAttribute("data-state", "held"); await page.mouse.move(2, 2); return { operation };
  }
  const dialog = await settings(page, operation === "feeding-off" ? "affection" : "motion");
  const toggle = dialog.locator(`[data-act="${operation === "feeding-off" ? "companion-feeding-enabled" : operation === "roam-off" ? "companion-roam" : "companion-enabled"}"]`);
  await toggle.click(); await expect(toggle).not.toBeChecked();
  if (operation === "master-off") { await expect(page.locator(".vc-companion,.vc-food,.vc-toy")).toHaveCount(0); }
  await page.waitForTimeout(3000); await toggle.click(); await expect(toggle).toBeChecked();
  if (operation === "master-off") { const roam = dialog.locator('[data-act="companion-roam"]'); await roam.click(); await expect(roam).not.toBeChecked(); }
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  if (operation === "master-off") {
    const ids = await populate(page); const motion = await settings(page, "motion"); await motion.locator('[data-act="companion-roam"]').click();
    await motion.getByRole("button", { name: "닫기", exact: true }).click(); await page.mouse.move(2, 2); return { operation, repopulated: ids };
  }
  await page.mouse.move(2, 2); return { operation };
}

for (const scenario of scenarios) test(`${scenario.id}: real capacity and continuous progress`, async ({ page, context, baseURL }, info) => {
  test.setTimeout((scenario.seconds + (scenario.gap ? 60 : 0) + 90) * 1000);
  let proof: DailyProof | undefined, completed = false, originalError: string | undefined;
  const notes: unknown[] = []; let frames: DenseFrame[] = [];
  try {
    proof = await guardCompanionQa(page, context, baseURL!);
    await page.addInitScript(({ preferences, care, key, epoch, hunger }) => {
      for (const [k, v] of Object.entries({ [key]: epoch, "vic.gfxPref": "max", "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": "off", "vic_avatar_side": "left", "vic.premiereStage": "off" })) localStorage.setItem(k, v);
      localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...preferences, enabled: true, roam: false, activeWhileVisible: true, sound: false }));
      localStorage.setItem("vic.viewerCompanionCare", JSON.stringify({ version: 3, ...care, hunger, energy: .9 }));
    }, { preferences: DEFAULT_COMPANION_PREFERENCES, care: DEFAULT_COMPANION_MEMORY, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, hunger: scenario.hunger });
    await page.goto("/visual-fixture/poster?avatar=1"); await page.bringToFront(); await settlePanelLayout(page); await page.evaluate(() => document.fonts.ready);
    await chooseCompanionPersonality(page, scenario.personality);
    if (scenario.gap) { const dialog = await settings(page), master = dialog.locator('[data-act="companion-enabled"]'); await master.click(); await expect(master).not.toBeChecked(); await page.waitForTimeout(60000); await master.click(); await expect(master).toBeChecked(); await dialog.getByRole("button", { name: "닫기", exact: true }).click(); }
    const beforePopulation = await settings(page, "motion"); await expect(beforePopulation.locator('[data-act="companion-roam"]')).not.toBeChecked();
    notes.push({ stage: "actual-population-preferences", preferences: await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("vic.viewerCompanion")!); return { enabled: p.enabled, roam: p.roam, feeding: p.feeding, personality: p.personality }; }) });
    await beforePopulation.getByRole("button", { name: "닫기", exact: true }).click();
    notes.push({ stage: "native-park-away-before-population", ...(await parkCompanionAwayFromFood(page)) });
    const ids = await populate(page, scenario.two); notes.push({ stage: "actual-initial-capacity", ids });
    const dialog = await settings(page, "motion"); await dialog.locator('[data-act="companion-roam"]').click(); await dialog.getByRole("button", { name: "닫기", exact: true }).click(); await page.mouse.move(2, 2);
    const began = Date.now();
    await observeObjects(page); await startCompanionQaProbe(page, { captureMs: scenario.seconds === 300 ? 310000 : scenario.seconds === 180 ? 190000 : 100000 });
    if (scenario.operation) notes.push(await intervene(page, scenario.operation));
    expect(Date.now() - began, "native intervention finishes within the observation window").toBeLessThan(scenario.seconds * 1000);
    await page.waitForTimeout(Math.max(0, scenario.seconds * 1000 + 500 - (Date.now() - began)));
    frames = await page.evaluate(() => JSON.parse((window as DenseWindow).denseItemsProbe!.read()));
    expect(frames.at(-1)!.at - frames[0].at).toBeGreaterThanOrEqual(scenario.seconds * 1000 - 1000);
    if (scenario.hunger >= .78 && !scenario.operation) {
      const eats = frames.filter(f => f.data.state === "eat"); expect(eats.length).toBeGreaterThan(12);
      expect(new Set(eats.map(f => f.data.foodGoal)).size).toBeGreaterThanOrEqual(2);
      expect(frames.some(f => f.data.state !== "eat" && !f.data.foodGoal && ["play", "jump", "look", "stretch", "shake"].includes(f.data.state))).toBe(true);
    }
    if (scenario.personality === "tidy") for (const id of ids.toys) {
      const carried = frames.filter(frame => frame.objects.some(object => object.data.toyId === id && object.data.carried === "true"));
      expect(carried.length, id + " has actual same-object carried samples").toBeGreaterThanOrEqual(2);
      const final = carried.at(-1)!, item = final.objects.find(object => object.data.toyId === id)!;
      expect(final.box).not.toBeNull(); expect(Math.hypot(item.x - final.box!.x, item.y - final.box!.y)).toBeLessThan(20);
      expect(frames.some(frame => frame.at > final.at && frame.at - final.at <= 1000 && !frame.objects.some(object => object.data.toyId === id))).toBe(true);
    }
    completed = true;
  } catch (error) { originalError = String(error); throw error; }
  finally {
    frames = await page.evaluate(() => { const probe = (window as DenseWindow).denseItemsProbe; probe?.stop(); return JSON.parse(probe?.read() ?? "[]"); }).catch(() => frames);
    const directory = resolve(process.env.COMPANION_QA_OUTPUT ?? ".scratch-pw/companion-dense-items"), file = resolve(directory, scenario.id + "-objects.json"); mkdirSync(directory, { recursive: true });
    writeFileSync(file, JSON.stringify({ scenario, notes, frames, originalError, geometryAnchor: "bottom-center, matching the canonical same-object box-delivery observer", limitation: "Synthetic initial saved care only. Actual native controls (keyboard population) and uninterrupted real clock/RNG/physics; original objects/ownership/geometry retained. No exhaustive art or model approval." }, null, 2), { flag: "wx" });
    await info.attach("dense-object-geometry", { path: file, contentType: "application/json" });
    if (proof) await finishCompanionQa(page, info, proof, { id: scenario.id, personality: scenario.personality, seconds: scenario.seconds }, completed, originalError);
  }
});

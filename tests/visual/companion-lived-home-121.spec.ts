import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { COMPANION_SCENE_MEMORY_KEY, newCompanionSceneMemory, type CompanionSceneMemory } from "@/lib/ui/viewer-companion/scene-memory";
import { openCompanionHome } from "./helpers/companion-home";

const out = ".scratch-pw/companion-121/rendered";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
async function fixture(page: Page, options: { personality?: CompanionPreferences["personality"]; roam?: boolean; sleep?: boolean; energy?: number; hunger?: number; theme?: string; surface?: string; season?: string; animal?: CompanionPreferences["animalMode"]; sceneMemory?: CompanionSceneMemory } = {}) {
  const posts: string[] = [], foreign: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== "http://127.0.0.1:3117") {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      foreign.push(url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { posts.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "No fixture writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live API in fixture" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, memory, epoch, epochKey, options, sceneKey }) => {
    if (options.sceneMemory) localStorage.setItem(sceneKey, JSON.stringify(options.sceneMemory));
    const saved = { version: 1, ...prefs, enabled: true, activeWhileVisible: true, sleep: options.sleep ?? false, roam: options.roam ?? false, personality: options.personality ?? "curious", animalMode: options.animal ?? "default", sound: false, ambientPrank: true };
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify(saved), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: options.energy ?? .8, hunger: options.hunger ?? .1 }), "vic.gfx": JSON.stringify({ mode: "full", at: Date.now(), v: 3 }), "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": options.theme === "dark" ? "on" : "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, options, sceneKey: COMPANION_SCENE_MEMORY_KEY });
  await page.goto(options.surface === "studio" ? "/visual-fixture/studio?role=owner&y=2025&m=11" : "/visual-fixture/poster?avatar=1&ambient=" + (options.season ?? "autumn"));
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => await page.getByRole("region", { name: "빅타민 집", exact: true }).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  await openCompanionHome(page);
  const room = page.getByRole("region", { name: "빅타민 집", exact: true });
  await expect(room).toBeVisible();
  return { room, posts, foreign, errors, async verify() { expect(errors).toEqual([]); expect(posts).toEqual([]); expect(foreign).toEqual([]); } };
}

for (const [surface, theme] of [["viewer", "light"], ["studio", "dark"]] as const) test("121 " + surface + " " + theme + " whole furniture affordance and organized real hitboxes", async ({ page }) => {
  const state = await fixture(page, { surface, theme });
  const controls = ["book", "radio", "home", "toys", "feed", "clearFood"];
  const targets = [];
  for (const action of controls) {
    const button = state.room.locator("[data-home-action='" + action + "']");
    await expect(button).toBeEnabled();
    const rect = (await button.boundingBox())!;
    expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(await button.evaluate(node => { const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return hit === node || node.contains(hit); })).toBe(true);
    targets.push({ action, ...rect });
    const art = button.locator(action === "home" ? ".vc-sofa-feedback" : ".vc-object-paint").first();
    await expect(art).toHaveCount(1);
    await page.mouse.move(2, 2); const before = await art.evaluate(node => getComputedStyle(node).transform);
    await button.hover(); await expect.poll(() => art.evaluate(node => getComputedStyle(node).transform)).not.toBe(before);
    await button.focus(); await expect(button).toBeFocused();
  }
  const food = targets.find(target => target.action === "feed")!, trash = targets.find(target => target.action === "clearFood")!;
  expect(Math.max(trash.x - (food.x + food.width), food.x - (trash.x + trash.width), trash.y - (food.y + food.height), food.y - (trash.y + trash.height))).toBeGreaterThanOrEqual(7);
  mkdirSync(out, { recursive: true }); writeFileSync(out + "/" + surface + "-furniture.json", JSON.stringify(targets, null, 2));
  await state.room.screenshot({ path: out + "/" + surface + "-home.png" }); await state.verify();
});

for (const width of [1920, 2400]) test("121 studio native rail retains physical hit44 at shell zoom: " + width, async ({ page }) => {
  await page.setViewportSize({ width, height: 1200 });
  const state = await fixture(page, { surface: "studio", theme: "dark" });
  await expect(state.room).toHaveAttribute("data-home-presentation", "panel");
  expect(await state.room.evaluate(node => Boolean(node.closest(".studio-shell .vc-home-host")))).toBe(true);
  const targets = [];
  for (const action of ["book", "radio", "home", "toys", "feed", "clearFood"]) {
    const button = state.room.locator("[data-home-action='" + action + "']");
    const rect = (await button.boundingBox())!;
    expect(rect.width, action + " physical width").toBeGreaterThanOrEqual(44);
    expect(rect.height, action + " physical height").toBeGreaterThanOrEqual(44);
    // Native hit testing also catches a grown target clipped by the room or
    // covered by its neighbour; a CSS width alone cannot establish the hit.
    expect(await button.evaluate(node => {
      const r = node.getBoundingClientRect();
      return [[r.x + 4, r.y + 4], [r.right - 4, r.y + 4], [r.x + 4, r.bottom - 4], [r.right - 4, r.bottom - 4], [r.x + r.width / 2, r.y + r.height / 2]].every(([x, y]) => {
        const hit = document.elementFromPoint(x, y); return hit === node || node.contains(hit);
      });
    }), action + " owns its native hit plane").toBe(true);
    targets.push({ action, ...rect });
  }
  const food = targets.find(target => target.action === "feed")!, trash = targets.find(target => target.action === "clearFood")!;
  expect(trash.x - food.x - food.width).toBeGreaterThanOrEqual(7);
  mkdirSync(out, { recursive: true });
  writeFileSync(out + "/studio-rail-" + width + "-targets.json", JSON.stringify(targets, null, 2));
  await state.room.screenshot({ path: out + "/studio-rail-" + width + ".png" });
  await state.verify();
});

for (const season of ["spring", "winter"] as const) test("121 viewed season maps into large window with ambient disabled: " + season, async ({ page }) => {
  const state = await fixture(page, { season });
  const window = state.room.locator(".vc-home-window");
  await expect(window).toHaveAttribute("data-season", season);
  const bounds = (await window.boundingBox())!;
  expect(bounds.width).toBeGreaterThanOrEqual(88); expect(bounds.height).toBeGreaterThanOrEqual(80);
  await state.room.screenshot({ path: (mkdirSync(out, { recursive: true }), out + "/window-" + season + ".png") }); await state.verify();
});

test("121 toy box emits a real finite toy; native dragging can return it without spawning food", async ({ page }) => {
  const state = await fixture(page), box = state.room.locator("[data-home-action=toys]");
  const foodCount = await page.locator(".vc-food").count();
  await box.click(); const toy = page.locator(".vc-toy").first(); await expect(toy).toBeVisible();
  await expect.poll(() => page.locator(".vc-toy").count()).toBe(1);
  const r = (await toy.boundingBox())!, to = (await box.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2); await page.mouse.down(); await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 }); await page.mouse.up();
  await expect(page.locator(".vc-toy")).toHaveCount(0); expect(await page.locator(".vc-food").count()).toBe(foodCount);
  await state.verify();
});

test("121 automatic sleep OFF stays awake at low energy and settings expose eight distinct personalities", async ({ page }) => {
  const state = await fixture(page, { roam: true, sleep: false, energy: .08, personality: "curious" });
  const pet = page.locator(".vc-companion");
  const states = await pet.evaluate(async node => {
    const rows: { state?: string; living?: string; presence?: string }[] = [], end = performance.now() + 5000;
    while (performance.now() < end) { const el = node as HTMLElement; rows.push({ state: el.dataset.state, living: el.dataset.living, presence: el.dataset.presence }); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); }
    return rows;
  });
  expect(states.length).toBeGreaterThan(20);
  expect(states.filter(value => value.state === "sleep" || value.living === "cozy")).toEqual([]);
  await state.room.locator("[data-home-action=book]").click(); const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
  await expect(dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).getByRole("radio")).toHaveCount(8);
  await dialog.getByRole("tab", { name: "움직임", exact: true }).click();
  await expect(dialog.getByRole("switch", { name: /자동 잠자기/ })).not.toBeChecked();
  await expect(dialog.getByRole("switch", { name: /다른 창/ })).toBeChecked();
  await dialog.screenshot({ path: (mkdirSync(out, { recursive: true }), out + "/eight-personalities.png") }); await state.verify();
});


test("121 a learned invitation accepts a real pet and reaches its happy ending without replaying the invitation", async ({ page }) => {
  const memory = { ...newCompanionSceneMemory(), greeting: "bow" as const, greetingCount: 3 };
  const state = await fixture(page, { sceneMemory: memory, roam: false, animal: "dog" });
  const pet = page.locator(".vc-companion"), actor = pet.locator(".vc-actor");
  await expect(actor).toBeVisible(); await actor.focus(); await actor.press("p");
  await page.mouse.click(800, 970); await page.mouse.move(2, 2);
  await expect(pet).not.toHaveAttribute("data-state", "jump");
  await state.room.locator("[data-home-action=book]").click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await dialog.getByRole("tab", { name: "환경설정", exact: true }).click();
  await dialog.getByRole("tab", { name: "움직임", exact: true }).click();
  await dialog.getByRole("switch", { name: "빅타민 돌아다니기 켜기/끄기", exact: true }).click();
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  const rect = (await pet.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2 + 100, rect.y - 30);
  await expect(pet).toHaveAttribute("data-scene", "10", { timeout: 12000 });
  await expect(pet).toHaveAttribute("data-scene-beat", "0");
  await actor.focus(); await actor.press("Enter");
  await expect(pet).toHaveAttribute("data-state", "petted");
  await expect(pet).toHaveAttribute("data-scene-beat", "2", { timeout: 12000 });
  await expect(pet).toHaveAttribute("data-play", "ask-petting");
  await state.verify();
});

import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPANION_PERSONALITIES, DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { DEFAULT_COMPANION_MEMORY } from "@/lib/ui/viewer-companion/care";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { COMPANION_SCENE_MEMORY_KEY, newCompanionSceneMemory, type CompanionSceneMemory } from "@/lib/ui/viewer-companion/scene-memory";
import { openCompanionHome } from "./helpers/companion-home";
import { expectCompanionMotion, setCompanionMotion } from "./helpers/companion-settings";

const out = ".scratch-pw/companion-121/rendered";
const fonts = new Set([...readFileSync(resolve("app/fonts.css"), "utf8").matchAll(/url\("(https:\/\/[^"\s]+\.woff2?)"\)/g)].map(match => match[1]));
async function fixture(page: Page, options: { personality?: CompanionPreferences["personality"]; roam?: boolean; sleep?: boolean; energy?: number; hunger?: number; theme?: string; surface?: string; season?: string; animal?: CompanionPreferences["animalMode"]; sceneMemory?: CompanionSceneMemory; reduce?: boolean; graphics?: "off" | "soft" } = {}) {
  const origin = new URL(test.info().project.use.baseURL!).origin;
  const posts: string[] = [], foreign: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.context().route("**/*", route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) {
      if (request.method() === "GET" && request.resourceType() === "font" && fonts.has(url.href)) return route.continue();
      foreign.push(url.origin + url.pathname); return route.abort();
    }
    if (!["GET", "HEAD"].includes(request.method())) { posts.push(request.method() + " " + url.pathname); return route.fulfill({ status: 503, body: "No fixture writes" }); }
    if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 404, body: "No live API in fixture" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, memory, epoch, epochKey, options, sceneKey }) => {
    if (options.sceneMemory) localStorage.setItem(sceneKey, JSON.stringify(options.sceneMemory));
    const saved = { version: 1, ...prefs, enabled: true, activeWhileVisible: true, sleep: options.sleep ?? false, roam: options.roam ?? false, personality: options.personality ?? "curious", personalitySource: "manual", animalMode: options.animal ?? "default", sound: false, ambientPrank: true };
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.viewerCompanion": JSON.stringify(saved), "vic.viewerCompanionCare": JSON.stringify({ version: 3, ...memory, energy: options.energy ?? .8, hunger: options.hunger ?? .1 }), "vic.gfx": JSON.stringify({ mode: options.graphics ?? "full", at: Date.now(), v: 3 }), "vic.gfxPref": options.graphics === "off" ? "off" : options.graphics === "soft" ? "auto" : "max", "vic.reduceMotion": options.reduce ? "on" : "off", "vic.sound": "off", "vic.ambient": "off", "vic.dark": options.theme === "dark" ? "on" : "off", "vic_avatar_side": "left" })) localStorage.setItem(key, value);
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, memory: DEFAULT_COMPANION_MEMORY, epoch: SETTINGS_EPOCH, epochKey: SETTINGS_EPOCH_KEY, options, sceneKey: COMPANION_SCENE_MEMORY_KEY });
  await page.goto(options.surface === "studio" ? "/visual-fixture/studio?role=owner&y=2025&m=11" : "/visual-fixture/poster?avatar=1&ambient=" + (options.season ?? "autumn"));
  await page.bringToFront(); await page.evaluate(() => document.fonts.ready);
  await expect.poll(async () => await page.getByRole("region", { name: "빅타민 집", exact: true }).isVisible() || await page.getByRole("button", { name: "빅타민 집 열기", exact: true }).isVisible()).toBe(true);
  await openCompanionHome(page);
  const room = page.getByRole("region", { name: "빅타민 집", exact: true });
  await expect(room).toBeVisible();
  // 4bd73c85 (2026-11-13): the room paints in stages on first load; hover/press feedback reads after it.
  await expect(room.locator(".vc-home-room")).not.toHaveAttribute("data-home-reveal", { timeout: 10000 });
  return { room, posts, foreign, errors, async verify() { expect(errors).toEqual([]); expect(posts).toEqual([]); expect(foreign).toEqual([]); } };
}

// Since a44f46a2 (2026-10-19) a fresh resident starts on the sofa or the home floor, in front of the
// furniture. The resident (and its sofa foreground) is a movable body, not a room layer: a native hit
// check asks which room element owns a point underneath it.
type RoomHitWindow = Window & { roomHit?: (x: number, y: number) => Element | null };
declare const roomHit: (x: number, y: number) => Element | null;
async function installRoomHit(page: Page) {
  await page.evaluate(() => { (window as RoomHitWindow).roomHit = (x, y) => document.elementsFromPoint(x, y).find(node => !node.closest(".vc-companion,.vc-bed-foreground")) ?? null; });
}

for (const [surface, theme] of [["viewer", "light"], ["studio", "dark"]] as const) test("121 " + surface + " " + theme + " whole furniture affordance and organized real hitboxes", async ({ page }) => {
  const state = await fixture(page, { surface, theme });
  const controls = ["book", "radio", "home", "toys", "feed", "clearFood"];
  await installRoomHit(page);
  const targets = [];
  for (const action of controls) {
    const button = state.room.locator("[data-home-action='" + action + "']");
    await expect(button).toBeEnabled();
    const rect = (await button.boundingBox())!;
    expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
    expect(await button.evaluate(node => { const r = node.getBoundingClientRect(), hit = roomHit(r.x + r.width / 2, r.y + r.height / 2); return hit === node || node.contains(hit); })).toBe(true);
    targets.push({ action, ...rect });
    const art = button.locator(action === "home" ? ".vc-sofa-feedback" : ".vc-object-paint").first();
    await expect(art).toHaveCount(1);
    await page.mouse.move(2, 2); const before = await art.evaluate(node => getComputedStyle(node).transform);
    // The resident may stand in front of the sofa (a44f46a2): hover a visible part of the object, as a person would.
    const position = await button.evaluate(node => {
      const r = node.getBoundingClientRect();
      for (const fy of [.5, .3, .7, .15, .85]) for (const fx of [.5, .25, .75, .1, .9]) {
        const x = r.x + r.width * fx, y = r.y + r.height * fy, hit = document.elementFromPoint(x, y);
        if (hit === node || node.contains(hit)) return { x: x - r.x, y: y - r.y };
      }
      return null;
    });
    expect(position, action + " shows a visible, directly hoverable part").not.toBeNull();
    await button.hover({ position: position! }); await expect.poll(() => art.evaluate(node => getComputedStyle(node).transform), { message: action + " art answers hover" }).not.toBe(before);
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
    await installRoomHit(page);
    expect(rect.width, action + " physical width").toBeGreaterThanOrEqual(44);
    expect(rect.height, action + " physical height").toBeGreaterThanOrEqual(44);
    // Native hit testing also catches a grown target clipped by the room or
    // covered by its neighbour; a CSS width alone cannot establish the hit.
    expect(await button.evaluate(node => {
      const r = node.getBoundingClientRect();
      return [[r.x + 4, r.y + 4], [r.right - 4, r.y + 4], [r.x + 4, r.bottom - 4], [r.right - 4, r.bottom - 4], [r.x + r.width / 2, r.y + r.height / 2]].every(([x, y]) => {
        const hit = roomHit(x, y); return hit === node || node.contains(hit);
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

test("121 automatic sleep OFF stays awake at low energy and settings expose all nine distinct personalities", async ({ page }) => {
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
  // stage 3: the character choices are on "함께 지내기" (where the book opens); sleep and other-window rows sit in the "더 보기" fold of "설정".
  await expect(dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).getByRole("radio")).toHaveCount(COMPANION_PERSONALITIES.length); // 9 since balanced (동글이) joined the 3x3 grid (1c8db000)
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "설정", exact: true }).click();
  await dialog.locator(".rhh-companion-more > summary").click();
  await expect(dialog.getByRole("switch", { name: /자동 잠자기/ })).not.toBeChecked();
  // Row renamed "다른 일 할 때도 놀기" (4cc48e31); the fixture saves it on, so it reads checked.
  await expect(dialog.getByRole("switch", { name: "빅타민 다른 일 할 때도 놀기 켜기/끄기", exact: true })).toBeChecked();
  await expect(dialog.getByRole("switch", { name: "빅타민 창이 떠 있어도 놀기 켜기/끄기", exact: true })).not.toBeChecked();
  await dialog.screenshot({ path: (mkdirSync(out, { recursive: true }), out + "/eight-personalities.png") }); await state.verify();
});


// Regression guard (fixed in 63ecc14a): the personality petting response (petting.ts) was once launched ~1.1 s after
// the pet that answers scene 10 with no regard for the active scene, ending it before the beat-2 cuddle.
test("121 a learned invitation accepts a real pet and reaches its happy ending without replaying the invitation", async ({ page }) => {
  const memory = { ...newCompanionSceneMemory(), greeting: "bow" as const, greetingCount: 3 };
  const state = await fixture(page, { sceneMemory: memory, roam: false, animal: "dog" });
  const pet = page.locator(".vc-companion"), actor = pet.locator(".vc-actor");
  await expect(actor).toBeVisible(); await actor.focus(); await actor.press("p");
  await page.mouse.click(800, 970); await page.mouse.move(2, 2);
  await expect(pet).not.toHaveAttribute("data-state", "jump");
  await state.room.locator("[data-home-action=book]").click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "설정", exact: true }).click(); // stage 3: no sub-tabs
  await expectCompanionMotion(dialog, "still"); await setCompanionMotion(dialog, "run"); // stage 4: roaming on = the movement level (jump stays on as seeded)
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  const rect = (await pet.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2 + 100, rect.y - 30);
  // Authored personality scenes (entry + one recipe, b04) outrank the learned invitation while roaming;
  // it follows them (measured about 8 s after the pointer settles), so allow 25 s instead of 12 s.
  await expect(pet).toHaveAttribute("data-scene", "10", { timeout: 25000 });
  await expect(pet).toHaveAttribute("data-scene-beat", "0");
  await actor.focus(); await actor.press("Enter");
  await expect(pet).toHaveAttribute("data-state", "petted");
  await expect(pet).toHaveAttribute("data-scene-beat", "2", { timeout: 12000 });
  await expect(pet).toHaveAttribute("data-play", "ask-petting");
  await state.verify();
});


for (const mode of ["reduced", "off", "soft"] as const) test("121 whole-object hover and press stay readable without motion: " + mode, async ({ page }) => {
  const state = await fixture(page, mode === "reduced" ? { reduce: true } : { graphics: mode });
  if (mode === "reduced") await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");
  else await expect(page.locator("html")).toHaveAttribute("data-gfx", mode);
  for (const action of ["book", "radio", "toys", "feed", "clearFood"]) {
    const button = state.room.locator("[data-home-action='" + action + "']"), paint = button.locator(".vc-object-paint").first();
    await page.mouse.move(2, 2); await page.locator(".vc-actor").focus();
    expect(await paint.evaluate(node => getComputedStyle(node).filter)).toBe("none");
    await button.hover(); await expect(paint).toHaveCSS("filter", "brightness(1.08)");
    await expect(paint).toHaveCSS("transform", "none");
    await page.mouse.down(); await expect(paint).toHaveCSS("filter", "brightness(0.94)");
    // Cancel the press outside the object so this affordance test does not
    // open settings, dispense food, or start audio as an incidental action.
    await page.mouse.move(2, 2); await page.mouse.up();
    await page.locator(".vc-actor").focus(); await expect(paint).toHaveCSS("filter", "none");
    await button.focus(); await page.keyboard.press("Shift+Tab"); await page.keyboard.press("Tab");
    await expect(button).toBeFocused(); await expect(paint).toHaveCSS("filter", "brightness(1.08)");
  }
  await state.verify();
});

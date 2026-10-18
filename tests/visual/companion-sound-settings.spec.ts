import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";

test.use({ viewport: { width: 1440, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
async function fixture(page: Page, reduce = false, genericSounds = false) {
  const writes: string[] = [], errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const manifest = JSON.parse(readFileSync(resolve(process.env.VISUAL_TEST_BUILD_DIR ?? ".next", "server/server-reference-manifest.json"), "utf8")).node as Record<string, { exportedName?: string }>;
  const previewReads = new Set(Object.entries(manifest).filter(([, action]) => action.exportedName === "getPublicPreviewAction").map(([id]) => id));
  await page.route("**/*", route => {
    const request = route.request(), pathname = new URL(request.url()).pathname;
    if (request.method() === "POST" && pathname === "/visual-fixture/studio" && previewReads.has(request.headers()["next-action"])) return route.fulfill({ contentType: "text/x-component", body: `0:{"a":"$@1","f":[],"b":"fixture"}\n1:${JSON.stringify(samplePublicScheduleData)}\n` });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) { writes.push(pathname); return route.fulfill({ status: 503, body: "fixture forbids writes" }); }
    if (pathname.startsWith("/api/")) return route.fulfill({ status: 503, body: "fixture forbids live API reads" });
    if (request.method() === "GET" && (pathname === "/" || pathname === "/studio")) return route.fulfill({ status: 200, contentType: "text/plain", body: "" });
    return route.continue();
  });
  await page.addInitScript(({ prefs, key, epoch, reduce, genericSounds }) => {
    // Passive trace only: no AudioContext, clock, engine or input is replaced.
    (window as Window & { __companionSfxTrace?: string[] }).__companionSfxTrace = [];
    if (localStorage.getItem("fixture.audio107")) return;
    localStorage.setItem("fixture.audio107", "seeded");
    for (const [name, value] of Object.entries({ [key]: epoch, "vic.sound": "on", "vic.soundVol": "45", "vic.ambient": "off", "vic.reduceMotion": reduce ? "on" : "off", "vic.gfxPref": "max", "vic.soundCats": JSON.stringify({ tap: genericSounds, ui: genericSounds, celebrate: genericSounds, edit: genericSounds, alert: genericSounds }) })) localStorage.setItem(name, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, key: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, reduce, genericSounds });
  return { writes, errors };
}
async function openSound(page: Page) {
  await page.bringToFront(); await settlePanelLayout(page);
  if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) { await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settlePanelLayout(page); }
  const settings = page.getByRole("button", { name: "설정", exact: true });
  if (!await settings.isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  const nav = dialog.getByRole("tablist", { name: "빅타민 설정", exact: true });
  await nav.getByRole("tab", { name: "소리", exact: true }).click();
  return { dialog, nav, sound: dialog.locator(".rhh-companion-sound") };
}
const trace = (page: Page) => page.evaluate(() => (window as Window & { __companionSfxTrace?: string[] }).__companionSfxTrace ?? []);
const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!));
async function beginAuditions(page: Page) {
  // Layout helpers use Playwright evaluate, whose Chromium transport grants
  // userGesture. Separate those legitimate setup discoveries from auditions
  // and allow the real authored cooldowns to finish without changing time.
  await page.waitForTimeout(1900);
  await page.evaluate(() => { (window as Window & { __companionSfxTrace?: string[] }).__companionSfxTrace = []; });
}

for (const surface of ["viewer", "studio", "preview"] as const) {
  test(`${surface}: native companion audio obeys independent mix and global master across reload`, async ({ page, context }) => {
    const safety = await fixture(page);
    await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
    // Observation must not unlock the very autoplay policy being tested.
    const inspector = await context.newCDPSession(page);
    const before = await inspector.send("Runtime.evaluate", { expression: "JSON.stringify({sounds:window.__companionSfxTrace||[],activated:navigator.userActivation?.hasBeenActive||false})", returnByValue: true, userGesture: false });
    await inspector.detach();
    expect(JSON.parse(before.result.value)).toEqual({ sounds: [], activated: false });
    await page.bringToFront(); await settlePanelLayout(page);
    if (surface === "preview") { await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
    let { dialog, nav, sound } = await openSound(page);
    await expect(nav.getByRole("tab")).toHaveText(["프로필", "움직임", "장난", "교감", "소리"]);
    await beginAuditions(page);
    const preview = sound.getByRole("button", { name: "돌보기 소리 미리 듣기", exact: true });
    await preview.click(); await expect.poll(() => trace(page)).toEqual(["pet"]);
    // Honor the real authored 120ms burst spacing; never advance a clock.
    await page.waitForTimeout(150);
    await sound.getByRole("button", { name: "발견·선물 소리 미리 듣기", exact: true }).click();
    await expect.poll(() => trace(page)).toEqual(["pet", "discover"]);
    const master = sound.getByRole("switch", { name: "빅타민 효과음 켜기/끄기", exact: true });
    await master.click(); await expect(master).toHaveAttribute("aria-checked", "false");
    await expect(preview).toBeDisabled();
    const volume = sound.getByRole("slider", { name: "빅타민 음량", exact: true });
    await volume.focus(); await volume.press("Home"); await volume.press("ArrowRight");
    await expect(volume).toHaveValue("5");
    expect(await trace(page)).toEqual(["pet", "discover"]);
    await sound.getByRole("switch", { name: "빅타민 움직임 소리 켜기/끄기", exact: true }).click();
    expect(await saved(page)).toMatchObject({ enabled: true, sound: false, soundVolume: 5, soundCare: true, soundMotion: false, soundKeepsakes: true });
    mkdirSync(".scratch-pw/companion-109-settings", { recursive: true });
    await sound.screenshot({ path: `.scratch-pw/companion-109-settings/audio-${surface}.png` });
    await page.screenshot({ path: `.scratch-pw/companion-109-settings/viewport-audio-${surface}.png` });
    // Native sibling storage event exercises shared controls without forging
    // a browser event or invoking the model's setters from the test.
    if (surface === "viewer") {
      const sibling = await context.newPage();
      await sibling.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Local sound fixture</title>" }));
      await sibling.goto(new URL(page.url()).origin + "/visual-fixture/poster");
      await sibling.evaluate(() => { const value = JSON.parse(localStorage.getItem("vic.viewerCompanion")!); value.soundVolume = 25; value.soundKeepsakes = false; localStorage.setItem("vic.viewerCompanion", JSON.stringify(value)); });
      await sibling.close(); await page.bringToFront();
      await expect(volume).toHaveValue("25");
      await expect(sound.getByRole("switch", { name: "빅타민 발견·선물 소리 켜기/끄기", exact: true })).toHaveAttribute("aria-checked", "false");
    }
    const persisted = await saved(page);
    await page.reload(); await page.bringToFront();
    if (surface === "preview" && !await page.locator(".viewer-fullscreen").count()) await page.locator(".io-preview").click();
    ({ dialog, nav, sound } = await openSound(page));
    expect(await saved(page)).toEqual(persisted);
    await expect(sound.getByRole("switch", { name: "빅타민 효과음 켜기/끄기", exact: true })).toHaveAttribute("aria-checked", "false");
    await sound.getByRole("switch", { name: "빅타민 효과음 켜기/끄기", exact: true }).click();
    await dialog.getByRole("tab", { name: "소리", exact: true }).first().click();
    await dialog.getByRole("switch", { name: "효과음 켜기/끄기", exact: true }).click();
    await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
    await expect(dialog).toContainText("전체 효과음이 꺼져 있어요.");
    await expect(sound.getByRole("button", { name: "돌보기 소리 미리 듣기", exact: true })).toBeDisabled();
    expect(await trace(page)).toEqual([]);
    expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
  });
}

test("native reduced-motion and creature OFF never audition motion or start companion sound", async ({ page }) => {
  const safety = await fixture(page, true);
  await page.goto("/visual-fixture/poster");
  const { dialog, sound } = await openSound(page);
  await beginAuditions(page);
  const motion = sound.getByRole("button", { name: "움직임 소리 미리 듣기", exact: true });
  await motion.click(); expect(await trace(page)).toEqual([]);
  await sound.getByRole("button", { name: "돌보기 소리 미리 듣기", exact: true }).click();
  await expect.poll(() => trace(page)).toEqual(["pet"]);
  await dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
  await expect(motion).toBeDisabled();
  await expect(sound.getByRole("button", { name: "돌보기 소리 미리 듣기", exact: true })).toBeDisabled();
  expect(await trace(page)).toEqual(["pet"]);
  expect(await saved(page)).toMatchObject({ enabled: false, sound: true, soundVolume: 60 });
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

test("native gift opening and wearing produce one companion cue without a generic click duplicate", async ({ page }) => {
  const safety = await fixture(page, false, true);
  await page.addInitScript(() => {
    if (localStorage.getItem("fixture.giftAudio107")) return;
    localStorage.setItem("fixture.giftAudio107", "seeded");
    localStorage.setItem("vic.viewerCompanionCollection", JSON.stringify({ version: 1, foods: [], behaviors: [], situations: [], gifts: { pending: "beret", unlocked: [], equipped: null, activeMs: 300000, interactionCredit: 1 } }));
  });
  await page.goto("/visual-fixture/poster");
  const { dialog } = await openSound(page);
  await dialog.getByRole("tab", { name: "프로필", exact: true }).click();
  const profile = dialog.locator(".rhh-companion-profile");
  await profile.getByRole("tab", { name: "옷장", exact: true }).click();
  await page.evaluate(() => { const target = window as Window & { __sfxTrace?: string[]; __companionSfxTrace?: string[] }; target.__sfxTrace = []; target.__companionSfxTrace = []; });
  await profile.getByRole("button", { name: "선물 열기", exact: true }).click();
  await expect.poll(() => trace(page)).toEqual(["gift"]);
  await expect(profile.locator('[data-accessory="beret"]')).toBeFocused();
  await page.waitForTimeout(150);
  await profile.getByRole("button", { name: "장착하기", exact: true }).click();
  await expect.poll(() => trace(page)).toEqual(["gift", "equip"]);
  await expect(profile.locator('[data-accessory="beret"]')).toContainText("장착 중");
  expect(await page.evaluate(() => (window as Window & { __sfxTrace?: string[] }).__sfxTrace)).toEqual([]);
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

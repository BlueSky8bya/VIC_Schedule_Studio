import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { COMPANION_RADIO_TRACKS } from "@/lib/ui/viewer-companion/radio-catalog";
import { COMPANION_RADIO_PREFERENCES_KEY } from "@/lib/ui/viewer-companion/radio-preferences";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "@/lib/ui/motion";
import { settlePanelLayout } from "./helpers/panel-layout";

test.use({ viewport: { width: 1440, height: 1100 }, isMobile: false, hasTouch: false, serviceWorkers: "block" });
async function fixture(page: Page, sound = true) {
  const writes: string[] = [], errors: string[] = [], musicRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (COMPANION_RADIO_TRACKS.some(track => new URL(request.url()).pathname === track.src)) musicRequests.push(new URL(request.url()).pathname); });
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
  await page.addInitScript(({ prefs, epochKey, epoch, radioKey, sound }) => {
    if (localStorage.getItem("fixture.radio108")) return;
    localStorage.setItem("fixture.radio108", "seeded");
    for (const [key, value] of Object.entries({ [epochKey]: epoch, "vic.sound": sound ? "on" : "off", "vic.soundVol": "45", "vic.soundCats": JSON.stringify({ tap: false, ui: false, celebrate: false, edit: false, alert: false }), "vic.ambient": "off", "vic.reduceMotion": "off", "vic.gfxPref": "max" })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, ...prefs, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false }));
    localStorage.setItem(radioKey, JSON.stringify({ enabled: true, volume: 35, react: true, moods: { lively: true, graceful: true, calm: true }, excludedIds: [] }));
  }, { prefs: DEFAULT_COMPANION_PREFERENCES, epochKey: SETTINGS_EPOCH_KEY, epoch: SETTINGS_EPOCH, radioKey: COMPANION_RADIO_PREFERENCES_KEY, sound });
  return { writes, errors, musicRequests };
}
async function openRadio(page: Page) {
  await page.bringToFront(); await settlePanelLayout(page);
  if (await page.locator(".viewer-fullscreen .panel-scrim").isVisible()) { await page.getByRole("button", { name: "패널 접기", exact: true }).click(); await settlePanelLayout(page); }
  if (!await page.getByRole("button", { name: "설정", exact: true }).isVisible()) await page.getByRole("button", { name: "패널 펼치기", exact: true }).click();
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 설정", exact: true }).getByRole("tab", { name: "소리", exact: true }).click();
  return { dialog, radio: dialog.locator(".rhh-companion-radio") };
}
const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!), COMPANION_RADIO_PREFERENCES_KEY);

async function assertRadioButtonGeometry(radio: Locator) {
  const buttons = radio.locator(".rhh-radio-moods > button, .rhh-radio-actions > button");
  await expect(buttons).toHaveCount(6);
  const readLifecycle = () => buttons.first().evaluate(element => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element), ancestors = [];
    for (let ancestor: Element | null = element; ancestor; ancestor = ancestor.parentElement) {
      const computed = getComputedStyle(ancestor);
      ancestors.push({ tag: ancestor.tagName, className: ancestor.className, transform: computed.transform, zoom: computed.zoom, animations: ancestor.getAnimations().map(animation => ({ state: animation.playState, currentTime: animation.currentTime, endTime: animation.effect?.getComputedTiming().endTime })) });
    }
    return { width: rect.width, height: rect.height, cssHeight: style.height, minHeight: style.minHeight, dpr: devicePixelRatio, physicalHeight: rect.height * devicePixelRatio, ancestors };
  });
  const before = await readLifecycle();
  // Dialog/tab transforms can still be finishing after the native tab clicks.
  // Measure the44px contract only once those real finite animations complete.
  await settlePanelLayout(radio.page());
  const after = await readLifecycle();
  await test.info().attach("radio-geometry-lifecycle", { body: JSON.stringify({ before, after }, null, 2), contentType: "application/json" });
  for (const button of await buttons.all()) {
    await expect(button).toHaveCSS("min-height", "44px");
    const geometry = await button.evaluate(element => {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { label: element.textContent, width: rect.width, height: rect.height, radius: parseFloat(style.borderTopLeftRadius), mood: element.parentElement?.classList.contains("rhh-radio-moods") };
    });
    expect(geometry.height, `${geometry.label}: physical target height, including inherited studio zoom`).toBeGreaterThanOrEqual(44);
    expect(geometry.width, `${geometry.label}: physical target width`).toBeGreaterThanOrEqual(44);
    if (geometry.mood) expect(geometry.radius, `${geometry.label}: pill radius`).toBeGreaterThanOrEqual(Math.min(geometry.width, geometry.height) / 2);
  }
}

for (const surface of ["viewer", "studio", "preview"] as const) test(`${surface}: radio list edits stay local and persist, playback is explicit`, async ({ page, context }) => {
  const safety = await fixture(page);
  await page.goto(surface === "viewer" ? "/visual-fixture/poster" : "/visual-fixture/studio?role=owner&y=2025&m=11");
  if (surface === "preview") { await settlePanelLayout(page); await page.locator(".io-preview").click(); await expect(page.locator(".viewer-fullscreen .poster-page")).toBeVisible(); }
  let { radio } = await openRadio(page);
  await assertRadioButtonGeometry(radio);
  expect(COMPANION_RADIO_TRACKS.length).toBeGreaterThanOrEqual(32);
  expect(safety.musicRequests).toEqual([]);
  await radio.getByText("곡 고르기", { exact: false }).click();
  await expect(radio.getByRole("checkbox")).toHaveCount(COMPANION_RADIO_TRACKS.length);
  await radio.getByRole("checkbox").first().uncheck();
  expect((await saved(page)).excludedIds).toEqual([COMPANION_RADIO_TRACKS[0].id]);
  await radio.getByRole("button", { name: "신나게", exact: true }).click();
  await radio.getByRole("switch", { name: "빅타민 음악 반응 켜기/끄기", exact: true }).click();
  const volume = radio.getByRole("slider", { name: "라디오 음량", exact: true });
  await volume.focus(); await volume.press("Home"); await volume.press("ArrowRight");
  expect(await saved(page)).toMatchObject({ volume: 5, react: false, moods: { lively: false, graceful: true, calm: true } });
  expect(safety.musicRequests).toEqual([]);
  const eligible = COMPANION_RADIO_TRACKS.find(track => track.mood !== "lively" && track.id !== COMPANION_RADIO_TRACKS[0].id)!;
  await radio.getByRole("button", { name: `${eligible.title} 재생`, exact: true }).click();
  await expect(radio.locator(".rhh-radio-now > p")).toHaveText(eligible.title);
  await expect(radio.getByRole("button", { name: "정지", exact: true })).toBeEnabled();
  expect(new Set(safety.musicRequests)).toEqual(new Set([eligible.src]));
  await radio.getByRole("button", { name: "정지", exact: true }).click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeVisible();
  const selections = await saved(page);
  if (surface === "viewer") {
    const sibling = await context.newPage();
    await sibling.route("**/*", route => route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Local radio fixture</title>" }));
    await sibling.goto(new URL(page.url()).origin + "/visual-fixture/radio");
    await sibling.evaluate(key => { const value = JSON.parse(localStorage.getItem(key)!); value.volume = 25; localStorage.setItem(key, JSON.stringify(value)); }, COMPANION_RADIO_PREFERENCES_KEY);
    await sibling.close(); await page.bringToFront();
    await expect(volume).toHaveValue("25"); selections.volume = 25;
  }
  mkdirSync(".scratch-pw/companion-109-settings", { recursive: true });
  await page.screenshot({ path: `.scratch-pw/companion-109-settings/radio-${surface}.png` });
  const targetAttributes = await radio.locator("[data-act]").evaluateAll(nodes => nodes.map(node => [node.getAttribute("data-act"), node.getAttribute("data-act-opt")]));
  expect(targetAttributes.every(([key, opt]) => key?.startsWith("companion-radio-") && (!opt || ["on", "off", "open", "close", "lively", "graceful", "calm"].includes(opt)))).toBe(true);
  await page.reload();
  if (surface === "preview" && !await page.locator(".viewer-fullscreen").count()) await page.locator(".io-preview").click();
  ({ radio } = await openRadio(page));
  expect(await saved(page)).toEqual(selections);
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeVisible();
  expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

test("radio empty pool, dedicated OFF, zero volume and global OFF keep play controls unavailable", async ({ page }) => {
  const safety = await fixture(page, false);
  await page.goto("/visual-fixture/poster");
  const { dialog, radio } = await openRadio(page);
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  for (const mood of ["신나게", "우아하게", "잔잔하게"]) await radio.getByRole("button", { name: mood, exact: true }).click();
  await expect(radio).toContainText("선택한 곡이 없어요.");
  await dialog.locator('[data-tab="sound"]').click();
  await dialog.getByRole("switch", { name: "효과음 켜기/끄기", exact: true }).click();
  await dialog.locator('[data-tab="companion"]').click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  await radio.getByRole("button", { name: "잔잔하게", exact: true }).click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeEnabled();
  const volume = radio.getByRole("slider", { name: "라디오 음량", exact: true });
  await volume.focus(); await volume.press("Home");
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  await volume.press("ArrowRight");
  await radio.getByRole("switch", { name: "빅타민 라디오 켜기/끄기", exact: true }).click();
  await expect(radio.getByRole("button", { name: "다음 곡", exact: true })).toBeDisabled();
  await radio.getByRole("switch", { name: "빅타민 라디오 켜기/끄기", exact: true }).click();
  await dialog.getByRole("switch", { name: "빅타민 효과음 켜기/끄기", exact: true }).click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  await dialog.getByRole("switch", { name: "빅타민 효과음 켜기/끄기", exact: true }).click();
  await dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  await dialog.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true }).click();
  await dialog.locator('[data-tab="sound"]').click();
  const globalVolume = dialog.getByRole("slider", { name: "효과음 음량", exact: true });
  await globalVolume.focus(); await globalVolume.press("Home");
  await dialog.locator('[data-tab="companion"]').click();
  await expect(radio.getByRole("button", { name: "재생", exact: true })).toBeDisabled();
  expect(safety.musicRequests).toEqual([]); expect(safety.writes).toEqual([]); expect(safety.errors).toEqual([]);
});

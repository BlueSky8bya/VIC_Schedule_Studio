import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

// Settings redesign stage 2-다, made switches 2026-11-20 (owner): each companion
// sound has its own tile with two parts. The speaker only plays the sound (also
// when it is switched off), through the level and site gates; the name with its
// small switch only turns that one sound on or off and never plays it, so a
// switch press is not mistaken for the sound.
test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

const sounds = (page: Page) => page.evaluate(() => (window as Window & { __companionSfxOrigins?: string[] }).__companionSfxOrigins ?? []);
async function open(page: Page, storage: Record<string, string> = {}, companion: Partial<CompanionPreferences> = {}) {
  await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 204 }) : route.continue());
  await page.route("**/api/**", route => route.fulfill({ status: 503, body: "fixture" }));
  await page.addInitScript(({ storage, companion }) => {
    (window as Window & { __companionSfxOrigins?: string[] }).__companionSfxOrigins = [];
    if (localStorage.getItem("fixture.auditions")) return;
    localStorage.setItem("fixture.auditions", "1");
    for (const [key, value] of Object.entries({ "vic.sound": "on", "vic.soundVol": "45", "vic.reduceMotion": "off", "vic.ambient": "off", "vic.soundCats": JSON.stringify({ tap: false, ui: false, celebrate: false, edit: false, alert: false }), ...storage })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify(companion));
  }, { storage, companion: { version: 1, ...DEFAULT_COMPANION_PREFERENCES, roam: false, jump: false, sleep: false, feeding: false, heartPrank: false, cardPrank: false, ambientPrank: false, panelPrank: false, rarePrank: false, ...companion } });
  await page.goto("/visual-fixture/poster");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "설정", exact: true }).click();
  const fold = dialog.locator(".rhh-sound-auditions");
  await expect(fold.locator(".rhh-sound-tile").first()).toBeHidden(); // folded until asked for
  await fold.locator("summary").click();
  // The companion may make a sound of its own meanwhile; only the tiles' sounds are read below.
  await page.waitForTimeout(1900);
  await page.evaluate(() => { (window as Window & { __companionSfxOrigins?: string[] }).__companionSfxOrigins = []; });
  return {
    dialog, fold,
    toggle: (name: string) => fold.getByRole("button", { name, exact: true }),
    listen: (name: string) => fold.getByRole("button", { name: `${name} 들어 보기`, exact: true }),
    tile: (name: string) => fold.locator(".rhh-sound-tile").filter({ has: page.getByRole("button", { name, exact: true }) }),
    level: (name: string) => dialog.getByRole("radiogroup", { name: "빅타민 소리", exact: true }).getByRole("radio", { name, exact: true }),
  };
}
const OWN = ["다 먹음", "넘어짐", "재주·반가움", "밥 흩뜨리기", "모자 얹힘"];
const clear = (page: Page) => page.evaluate(() => { (window as Window & { __companionSfxOrigins?: string[] }).__companionSfxOrigins = []; });

test("all 18 sounds have a speaker that plays it and a switch that only turns it on or off", async ({ page }) => {
  const { fold, toggle, listen, tile } = await open(page);
  await expect(fold.locator(".rhh-sound-board > .rhh-sound-tile")).toHaveCount(18);
  await expect(fold.locator(".rhh-sound-listen")).toHaveCount(18);
  await expect(fold.locator(".rhh-sound-toggle")).toHaveCount(18);
  await expect(fold.locator(".rhh-sound-group, .rhh-font-group-label")).toHaveCount(0);
  // Only the sounds the companion makes by itself carry the dot.
  await expect(fold.locator(".rhh-sound-tile[data-own] .rhh-sound-label")).toHaveText(OWN);
  await expect(fold.locator(".rhh-group-foot")).toHaveText(["스피커는 소리 듣기, 스위치는 그 소리만 켜고 끄기예요.", "점이 있는 소리는 빅타민이 혼자 내는 소리라, 빅타민 소리가 '전부'일 때만 나요."]);
  // Each switch says when its sound is heard; the tile shows it on hover.
  for (const button of await fold.locator(".rhh-sound-toggle").all()) {
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(button).toHaveAccessibleDescription((await button.locator("xpath=..").getAttribute("data-tip")) ?? "");
  }
  await expect(tile("점프 착지")).toHaveAttribute("data-tip", "점프하고 바닥에 내려올 때");
  const shown = () => tile("쓰다듬기").evaluate(node => getComputedStyle(node, "::before").opacity);
  expect(await shown()).toBe("0");
  await tile("쓰다듬기").hover();
  await expect.poll(shown).toBe("1");
  // The speaker plays the sound and changes nothing.
  await listen("점프 착지").click();
  await expect.poll(() => sounds(page)).toEqual(["land:direct"]);
  await expect(toggle("점프 착지")).toHaveAttribute("aria-pressed", "true");
  // Off: the switch slides off and nothing of the companion sounds, now or a moment later.
  const knob = () => toggle("점프 착지").locator(".rhh-sound-switch > i").evaluate(node => getComputedStyle(node).transform);
  expect(await knob()).not.toBe("none");
  await page.waitForTimeout(700); await clear(page);
  await toggle("점프 착지").click();
  await expect(toggle("점프 착지")).toHaveAttribute("aria-pressed", "false");
  await expect(tile("점프 착지")).toHaveClass(/(^|\s)is-muted(\s|$)/);
  await expect.poll(knob).toBe("none");
  expect(await toggle("점프 착지").locator(".rhh-sound-label").evaluate(node => getComputedStyle(node).textDecorationLine)).toBe("none");
  // Its split siblings keep their own choice.
  await expect(toggle("밥 떨어짐")).toHaveAttribute("aria-pressed", "true");
  await expect(toggle("모자 얹힘")).toHaveAttribute("aria-pressed", "true");
  // A switched-off sound can still be heard from its speaker.
  await listen("점프 착지").click();
  await expect.poll(() => sounds(page)).toEqual(["land:direct"]);
  // On again: the switch alone, no sound of the companion.
  await page.waitForTimeout(700); await clear(page);
  await toggle("점프 착지").click();
  await expect(toggle("점프 착지")).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(800);
  expect(await sounds(page)).toEqual([]);
  await listen("다 먹음").click();
  await expect.poll(() => sounds(page)).toContain("eat:auto");
});

test("a switched-off sound stays off after a reload", async ({ page }) => {
  const { toggle } = await open(page);
  await toggle("점프 착지").click();
  await expect(toggle("점프 착지")).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion") ?? "{}").soundMuted)).toEqual(["land"]);
  await page.reload();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  if (!(await dialog.isVisible())) await page.getByRole("button", { name: "설정", exact: true }).click();
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "설정", exact: true }).click();
  const fold = dialog.locator(".rhh-sound-auditions");
  await fold.locator("summary").click();
  await expect(fold.getByRole("button", { name: "점프 착지", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(fold.getByRole("button", { name: "밥 떨어짐", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("touch only: the companion's own sounds cannot be listened to but stay switchable; off: no speaker plays", async ({ page }) => {
  const { fold, toggle, listen, level } = await open(page);
  await level("만질 때만").click();
  await expect(listen("쓰다듬기")).toBeEnabled(); await expect(listen("놀이")).toBeEnabled();
  for (const name of OWN) { await expect(listen(name)).toBeDisabled(); await expect(toggle(name)).toBeEnabled(); }
  await toggle("넘어짐").click(); await toggle("넘어짐").click();
  await expect(toggle("넘어짐")).toHaveAttribute("aria-pressed", "true");
  await level("끔").click();
  for (const button of await fold.locator(".rhh-sound-listen").all()) await expect(button).toBeDisabled();
  for (const button of await fold.locator(".rhh-sound-toggle").all()) await expect(button).toBeEnabled();
  await level("전부").click();
  for (const button of await fold.locator(".rhh-sound-listen").all()) await expect(button).toBeEnabled();
});

test("a resting device and a silent site are not bypassed", async ({ page }) => {
  const { listen } = await open(page, { "vic.reduceMotion": "on" });
  // Reduced motion rests what it does by itself: those speakers are off, the rest still sound.
  await expect(listen("다 먹음")).toBeDisabled(); await expect(listen("넘어짐")).toBeDisabled();
  await expect(listen("들어 올리기")).toBeEnabled();
  await listen("들어 올리기").click();
  await expect.poll(() => sounds(page)).toContain("lift:direct");
  await page.close();
});

test("site sound off: no speaker plays and nothing sounds", async ({ page }) => {
  const { fold, toggle } = await open(page, { "vic.sound": "off" });
  for (const button of await fold.locator(".rhh-sound-listen").all()) await expect(button).toBeDisabled();
  await toggle("쓰다듬기").click(); await toggle("쓰다듬기").click();
  expect((await sounds(page)).filter(entry => !entry.endsWith(":auto"))).toEqual([]);
});

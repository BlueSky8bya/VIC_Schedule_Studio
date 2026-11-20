import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

// Settings redesign stage 2-다, made switches 2026-11-20 (owner): each companion
// sound has its own tile, and the tile switches that one sound off and on.
// Turning it on lets it be heard once, through the real gate. A tile is always
// pressable; one the level or the site keeps quiet right now is only dimmed.
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
  return { dialog, fold, tile: (name: string) => fold.getByRole("button", { name, exact: true }), level: (name: string) => dialog.getByRole("radiogroup", { name: "빅타민 소리", exact: true }).getByRole("radio", { name, exact: true }) };
}

const quiet = /\bis-quiet\b/;

test("all 18 sounds have a tile that switches that sound alone", async ({ page }) => {
  const { fold, tile } = await open(page);
  await expect(fold.getByRole("button")).toHaveCount(18);
  // One flat grid, no group names; only the sounds the companion makes by itself carry the dot.
  await expect(fold.locator(".rhh-sound-board > .rhh-sound-tile")).toHaveCount(18);
  await expect(fold.locator(".rhh-sound-group, .rhh-font-group-label")).toHaveCount(0);
  await expect(fold.locator(".rhh-sound-tile[data-own] .rhh-sound-label")).toHaveText(["다 먹음", "넘어짐", "재주·반가움", "밥 흩뜨리기", "모자 얹힘"]);
  await expect(fold.locator(".rhh-group-foot")).toHaveText(["누르면 그 소리만 꺼지고, 다시 누르면 켜지며 한 번 들려줘요.", "점이 있는 소리는 빅타민이 혼자 내는 소리라, 빅타민 소리가 '전부'일 때만 나요."]);
  // Each tile says when it is heard: spoken, and shown above it on hover.
  for (const button of await fold.getByRole("button").all()) { await expect(button).toHaveAccessibleDescription((await button.getAttribute("data-tip")) ?? ""); await expect(button).toHaveAttribute("aria-pressed", "true"); }
  await expect(tile("점프 착지")).toHaveAttribute("data-tip", "점프하고 바닥에 내려올 때");
  const shown = () => tile("쓰다듬기").evaluate(node => getComputedStyle(node, "::before").opacity);
  expect(await shown()).toBe("0");
  await tile("쓰다듬기").hover();
  await expect.poll(shown).toBe("1");
  // Off: silent, and its small switch slides off like every other switch here (no strike-through).
  const knob = () => tile("점프 착지").locator(".rhh-sound-switch > i").evaluate(node => getComputedStyle(node).transform);
  expect(await knob()).not.toBe("none");
  await tile("점프 착지").click();
  await expect(tile("점프 착지")).toHaveAttribute("aria-pressed", "false");
  await expect(tile("점프 착지")).toHaveClass(/\bis-muted\b/);
  await expect.poll(knob).toBe("none");
  expect(await tile("점프 착지").locator(".rhh-sound-label").evaluate(node => getComputedStyle(node).textDecorationLine)).toBe("none");
  await page.waitForTimeout(200);
  expect(await sounds(page)).toEqual([]);
  // Its split siblings keep their own choice.
  await expect(tile("밥 떨어짐")).toHaveAttribute("aria-pressed", "true");
  await expect(tile("모자 얹힘")).toHaveAttribute("aria-pressed", "true");
  // On again: the switch sound at once, the sound itself a beat later, heard once.
  await page.evaluate(() => { document.documentElement.removeAttribute("data-sfx-last"); });
  await tile("점프 착지").click();
  await expect(tile("점프 착지")).toHaveAttribute("aria-pressed", "true");
  expect(await sounds(page)).toEqual([]);
  await expect.poll(() => sounds(page)).toEqual(["land:direct"]);
  await page.waitForTimeout(200);
  await tile("다 먹음").click(); await tile("다 먹음").click();
  await expect.poll(() => sounds(page)).toContain("eat:auto");
});

test("a switched-off sound stays off after a reload", async ({ page }) => {
  const { tile } = await open(page);
  await tile("점프 착지").click();
  await expect(tile("점프 착지")).toHaveAttribute("aria-pressed", "false");
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

test("touch only: the companion's own sounds are dimmed but still switchable; off: all dimmed", async ({ page }) => {
  const { fold, tile, level } = await open(page);
  await level("만질 때만").click();
  await expect(tile("쓰다듬기")).not.toHaveClass(quiet); await expect(tile("놀이")).not.toHaveClass(quiet);
  for (const name of ["다 먹음", "넘어짐", "재주·반가움", "밥 흩뜨리기", "모자 얹힘"]) await expect(tile(name)).toHaveClass(quiet);
  await expect(tile("넘어짐")).toBeEnabled();
  await page.waitForTimeout(200);
  await page.evaluate(() => { (window as Window & { __companionSfxOrigins?: string[] }).__companionSfxOrigins = []; });
  await tile("넘어짐").click(); await tile("넘어짐").click(); // off, then on: the level still keeps it quiet
  await expect(tile("넘어짐")).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(800); // past the beat the sound waits after the switch sound
  expect(await sounds(page)).toEqual([]);
  await level("끔").click();
  for (const button of await fold.getByRole("button").all()) { await expect(button).toHaveClass(quiet); await expect(button).toBeEnabled(); }
  await level("전부").click();
  for (const button of await fold.getByRole("button").all()) await expect(button).not.toHaveClass(quiet);
});

test("a resting device and a silent site are not bypassed", async ({ page }) => {
  const { tile } = await open(page, { "vic.reduceMotion": "on" });
  // Reduced motion rests what it does by itself: those tiles are dimmed, the rest still sound.
  await expect(tile("다 먹음")).toHaveClass(quiet); await expect(tile("넘어짐")).toHaveClass(quiet);
  await expect(tile("들어 올리기")).not.toHaveClass(quiet);
  await tile("들어 올리기").click(); await tile("들어 올리기").click();
  await expect.poll(() => sounds(page)).toContain("lift:direct");
  await page.close();
});

test("site sound off: every tile is dimmed and nothing sounds", async ({ page }) => {
  const { fold, tile } = await open(page, { "vic.sound": "off" });
  for (const button of await fold.getByRole("button").all()) await expect(button).toHaveClass(quiet);
  await tile("쓰다듬기").click(); await tile("쓰다듬기").click();
  expect((await sounds(page)).filter(entry => !entry.endsWith(":auto"))).toEqual([]);
});

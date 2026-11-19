import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

// Settings redesign stage 2-다: each companion sound can be heard from its own
// tile. A tile is pressable exactly when the real sound could be heard now.
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

test("all 14 sounds have a tile; each is heard as the user's or as the companion's own", async ({ page }) => {
  const { fold, tile } = await open(page);
  await expect(fold.getByRole("button")).toHaveCount(14);
  // One flat grid, no group names; only the two sounds the companion makes by itself carry the dot.
  await expect(fold.locator(".rhh-sound-board > .rhh-sound-tile")).toHaveCount(14);
  await expect(fold.locator(".rhh-sound-group, .rhh-font-group-label")).toHaveCount(0);
  await expect(fold.locator(".rhh-sound-tile[data-own] .rhh-sound-label")).toHaveText(["다 먹음", "넘어짐"]);
  await expect(fold.locator(".rhh-group-foot")).toHaveText("점이 있는 소리는 빅타민이 혼자 내는 소리라, 빅타민 소리가 '전부'일 때만 나요.");
  // Each tile says when it is heard: spoken, and shown above it on hover.
  for (const button of await fold.getByRole("button").all()) await expect(button).toHaveAccessibleDescription((await button.getAttribute("data-tip")) ?? "");
  await expect(tile("쓰다듬기")).toHaveAttribute("data-tip", "쓰다듬을 때");
  const shown = () => tile("쓰다듬기").evaluate(node => getComputedStyle(node, "::before").opacity);
  expect(await shown()).toBe("0");
  await tile("쓰다듬기").hover();
  await expect.poll(shown).toBe("1");
  await tile("쓰다듬기").click();
  await expect.poll(() => sounds(page)).toContain("pet:direct");
  await page.waitForTimeout(200); // the authored 120ms spacing between any two sounds
  await tile("다 먹음").click();
  await expect.poll(() => sounds(page)).toContain("eat:auto");
  await page.waitForTimeout(200);
  await tile("착지").click();
  await expect.poll(() => sounds(page)).toContain("land:direct");
});

test("touch only: the companion's own sounds cannot be auditioned; off: none can", async ({ page }) => {
  const { fold, tile, level } = await open(page);
  await level("만질 때만").click();
  await expect(tile("쓰다듬기")).toBeEnabled(); await expect(tile("놀이")).toBeEnabled();
  await expect(tile("다 먹음")).toBeDisabled(); await expect(tile("넘어짐")).toBeDisabled();
  await level("끔").click();
  for (const button of await fold.getByRole("button").all()) await expect(button).toBeDisabled();
  await level("전부").click();
  for (const button of await fold.getByRole("button").all()) await expect(button).toBeEnabled();
});

test("a resting device and a silent site are not bypassed", async ({ page }) => {
  const { tile } = await open(page, { "vic.reduceMotion": "on" });
  // Reduced motion rests what it does by itself: those two tiles are off, the rest still sound.
  await expect(tile("다 먹음")).toBeDisabled(); await expect(tile("넘어짐")).toBeDisabled();
  await expect(tile("들어 올리기")).toBeEnabled();
  await tile("들어 올리기").click();
  await expect.poll(() => sounds(page)).toContain("lift:direct");
  await page.close();
});

test("site sound off: every tile is off and nothing sounds", async ({ page }) => {
  const { fold } = await open(page, { "vic.sound": "off" });
  for (const button of await fold.getByRole("button").all()) await expect(button).toBeDisabled();
  expect((await sounds(page)).filter(entry => !entry.endsWith(":auto"))).toEqual([]);
});

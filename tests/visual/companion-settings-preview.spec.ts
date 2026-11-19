import { expect, test, type Locator, type Page } from "@playwright/test";

// Settings redesign stage 5: choosing a character lets the small companion
// beside the choice move that way. It is a local drawing only: nothing is
// stored and the real companion is not touched. (The movement preview went with
// the movement setting, 2026-11-19.)
test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

async function open(page: Page, storage: Record<string, string> = {}, companion: Record<string, unknown> = {}) {
  await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 204 }) : route.continue());
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
  await page.addInitScript(({ storage, companion }) => {
    if (localStorage.getItem("fixture.preview")) return;
    localStorage.setItem("fixture.preview", "1");
    for (const [key, value] of Object.entries({ "vic.gfxPref": "max", "vic.reduceMotion": "off", "vic.sound": "off", ...storage })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: true, ...companion }));
  }, { storage, companion });
  await page.goto("/visual-fixture/poster");
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  return dialog;
}
/** Sprite rows the preview drew during the window. */
async function rows(host: Locator, ms: number) {
  const seen = new Set<string>(), end = Date.now() + ms;
  while (Date.now() < end) { seen.add(await host.locator(".rhh-wardrobe-preview").getAttribute("data-preview-row") ?? "none"); await host.page().waitForTimeout(50); }
  return [...seen];
}
const stored = (page: Page) => page.evaluate(() => localStorage.getItem("vic.viewerCompanion"));

test("the settings page has no movement choice and no movement preview", async ({ page }) => {
  const dialog = await open(page);
  await expect(dialog.getByRole("switch", { name: "빅타민 장난치기 켜기/끄기", exact: true })).toBeVisible();
  await expect(dialog.getByRole("radiogroup", { name: "빅타민 움직임", exact: true })).toHaveCount(0);
  await expect(dialog.locator('.rhh-motion-preview, [data-motion-preview], [data-settings-place="companion-roam"]')).toHaveCount(0);
});

test("the character preview replays the chosen character's move and stores only the choice", async ({ page }) => {
  const dialog = await open(page);
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "함께 지내기", exact: true }).click();
  const box = dialog.locator(".rhh-personality-preview"), portrait = dialog.locator(".rhh-companion-summary .rhh-wardrobe-preview");
  const group = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true });
  // Until a character is chosen there is no second drawing beside the portrait.
  await expect(box).toHaveCount(0);
  await group.scrollIntoViewIfNeeded();
  const before = await group.boundingBox();
  await group.getByRole("radio", { name: "깔끔이", exact: true }).click();
  await expect(box).toBeVisible();
  // It appears below the choices: nothing under the pointer moved.
  expect((await group.boundingBox())!.y).toBeCloseTo(before!.y, 0);
  expect((await box.boundingBox())!.y).toBeGreaterThan((await group.boundingBox())!.y);
  await expect(box).toHaveAttribute("data-personality-preview", "tidy");
  await expect(box.locator("strong")).toHaveText("깔끔이");
  // Grooming is the tidy character's move (sprite row 30).
  await expect.poll(async () => (await rows(box, 600)).includes("30"), { timeout: 10000 }).toBe(true);
  await group.getByRole("radio", { name: "재롱둥이", exact: true }).click();
  await expect(box).toHaveAttribute("data-personality-preview", "performer");
  await expect.poll(async () => (await rows(box, 600)).includes("9"), { timeout: 10000 }).toBe(true);
  expect(JSON.parse((await stored(page))!)).toMatchObject({ personality: "performer", personalitySource: "manual" });
  // Only one drawing moves at a time: the portrait rests while the preview plays, and the preview goes when the page is left.
  expect(await portrait.count()).toBe(1);
  const pages = dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true });
  await pages.getByRole("tab", { name: "도감", exact: true }).click();
  await pages.getByRole("tab", { name: "함께 지내기", exact: true }).click();
  await expect(box).toHaveCount(0);
});

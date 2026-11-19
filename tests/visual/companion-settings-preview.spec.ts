import { expect, test, type Locator, type Page } from "@playwright/test";

// Settings redesign stage 5: choosing a movement level or a character lets the
// small companion beside the choice move that way. It is a local drawing only:
// nothing is stored and the real companion is not touched.
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

test("the movement preview stands, walks, or walks and jumps with the chosen level", async ({ page }) => {
  const dialog = await open(page);
  const box = dialog.locator(".rhh-motion-preview"), level = (name: string) => dialog.getByRole("radiogroup", { name: "빅타민 움직임", exact: true }).getByRole("radio", { name, exact: true });
  await box.scrollIntoViewIfNeeded();
  await expect(box).toHaveAttribute("data-motion-preview", "run");
  await expect(box.locator(".rhh-wardrobe-preview")).toHaveAttribute("data-preview-ready", "");
  // Walking: the walk row, and never a jump.
  await level("걷기만").click();
  await expect(box).toHaveAttribute("data-motion-preview", "walk");
  await expect(box).toContainText("걸어서 돌아다녀요");
  await expect.poll(async () => (await rows(box, 600)).includes("2"), { timeout: 8000 }).toBe(true);
  expect((await rows(box, 4000)).filter(row => !["0", "2"].includes(row))).toEqual([]);
  // Running: both the walk and the jump are seen.
  await level("뛰어다니기").click();
  await expect(box).toContainText("걷다가 뛰어오르기도 해요");
  const run = new Set<string>();
  await expect.poll(async () => { for (const row of await rows(box, 800)) run.add(row); return run.has("2") && run.has("31"); }, { timeout: 20000 }).toBe(true);
  // Standing still: it only rests.
  await level("가만히").click();
  await expect(box).toContainText("제자리에 가만히 있어요");
  // A clip in flight is cut at once; from then on only the resting row is drawn.
  await expect.poll(async () => (await rows(box, 300)).join(), { timeout: 8000 }).toBe("0");
  expect(await rows(box, 3500)).toEqual(["0"]);
  // The preview writes nothing of its own: only the level the user chose is stored.
  expect(JSON.parse((await stored(page))!)).toMatchObject({ roam: false, jump: true });
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

test("a resting device, a resting companion and a stopped row show the preview at rest", async ({ page }) => {
  // The site's motion switch is off: the row says so and the preview does not move.
  const dialog = await open(page, { "vic.reduceMotion": "on" });
  const box = dialog.locator(".rhh-motion-preview");
  await box.scrollIntoViewIfNeeded();
  await expect(box.locator(".rhh-wardrobe-preview")).toHaveAttribute("data-preview-ready", "");
  expect(await rows(box, 3500)).toEqual(["0"]);
  await dialog.getByRole("radiogroup", { name: "빅타민 움직임", exact: true }).getByRole("radio", { name: "걷기만", exact: true }).click();
  expect(await rows(box, 3500)).toEqual(["0"]);
});

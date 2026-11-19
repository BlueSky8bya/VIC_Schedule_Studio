import { expect, test, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";

// Settings redesign stage 1: the screen says which outer setting is in the way
// and leads there. No rule changes; a link never switches the other setting.
test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false });

async function seed(page: Page, storage: Record<string, string>, companion: Partial<CompanionPreferences> = {}) {
  await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 204 }) : route.continue());
  await page.route("**/api/**", route => route.fulfill({ status: 503, body: "fixture" }));
  await page.addInitScript(({ storage, companion }) => {
    if (localStorage.getItem("fixture.reasons")) return;
    localStorage.setItem("fixture.reasons", "1");
    for (const [key, value] of Object.entries({ "vic.sound": "on", "vic.soundVol": "60", "vic.reduceMotion": "off", "vic.ambient": "off", ...storage })) localStorage.setItem(key, value);
    localStorage.setItem("vic.viewerCompanion", JSON.stringify(companion));
  }, { storage, companion: { version: 1, ...DEFAULT_COMPANION_PREFERENCES, ...companion } });
}
// Stage 3: the settings are one page of cards; the argument only names the card a test looks at.
async function companionSettings(page: Page, _card: string) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "설정", exact: true }).click();
  return dialog;
}
const saved = (page: Page) => page.evaluate(() => ({ companion: localStorage.getItem("vic.viewerCompanion"), reduce: localStorage.getItem("vic.reduceMotion"), sound: localStorage.getItem("vic.sound") }));

test("sound status says it sounds when nothing is in the way", async ({ page }) => {
  await seed(page, {});
  await page.goto("/visual-fixture/poster");
  const dialog = await companionSettings(page, "소리");
  const status = dialog.locator(".rhh-sound-status");
  await expect(status).toHaveText("지금 소리가 나요");
  await expect(status).toHaveAttribute("data-state", "on");
  await expect(dialog.locator(".rhh-note:visible")).toHaveCount(1);
});

test("reduced motion: rows keep their value, say why once, and the link shows the switch without flipping it", async ({ page }) => {
  await seed(page, { "vic.reduceMotion": "on" });
  await page.goto("/visual-fixture/poster");
  const dialog = await companionSettings(page, "장난");
  // Five pranks stopped by one setting say it once.
  const notes = dialog.locator(".rhh-companion-cards .rhh-note").filter({ hasText: "장난을 치지 않아요" });
  await expect(notes).toHaveCount(1);
  await expect(notes).toContainText("사이트의 '생동감 있는 동작'이 꺼져 있어 장난을 치지 않아요");
  // Stopped rows are dimmed, not disabled: the value still changes.
  const heart = dialog.getByRole("switch", { name: "빅타민 하트 콩 켜기/끄기", exact: true });
  await expect(heart).toBeChecked(); await expect(heart).toBeEnabled();
  await heart.click(); await expect(heart).not.toBeChecked(); await heart.click(); await expect(heart).toBeChecked();
  const before = await saved(page);
  await notes.getByRole("button", { name: "움직임 설정으로", exact: true }).click();
  const target = dialog.getByRole("switch", { name: "생동감 있는 동작 켜기/끄기", exact: true });
  await expect(target).toBeVisible(); await expect(target).toBeFocused(); await expect(target).not.toBeChecked();
  await expect(dialog.locator("[data-settings-place=site-motion]")).toHaveAttribute("data-flash", "");
  expect(await saved(page)).toEqual(before);
  // The reason leads back to the companion's own row too.
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  // The sound tab names the same reason: what it does by itself rests, the user's touch still sounds.
  await expect(dialog.locator(".rhh-sound-status")).toContainText("지금은 내가 만질 때만 소리가 나요 — 사이트의 '생동감 있는 동작'이 꺼져 있어요");
  await expect(dialog.locator(".rhh-sound-status")).toHaveAttribute("data-state", "partial");
});

test("site sound off: status and radio lead to the site switch; the site sound tab leads back", async ({ page }) => {
  await seed(page, { "vic.sound": "off" });
  await page.goto("/visual-fixture/poster");
  const dialog = await companionSettings(page, "소리");
  await expect(dialog.locator(".rhh-sound-status")).toContainText("지금은 소리가 안 나요 — 사이트 효과음이 꺼져 있어요");
  const radio = dialog.locator(".rhh-companion-radio");
  await expect(radio.locator(".rhh-radio-now p")).toHaveText("전체 소리가 꺼져 있어요");
  await radio.getByRole("button", { name: "소리 설정으로", exact: true }).click();
  const site = dialog.getByRole("switch", { name: "효과음 켜기/끄기", exact: true });
  await expect(site).toBeFocused(); await expect(site).not.toBeChecked();
  await dialog.getByRole("button", { name: "빅타민 소리로", exact: true }).click();
  const own = dialog.getByRole("radiogroup", { name: "빅타민 소리", exact: true }).getByRole("radio", { name: "전부", exact: true });
  await expect(own).toBeVisible(); await expect(own).toBeFocused(); await expect(own).toBeChecked();
  expect((await saved(page)).sound).toBe("off");
});

test("a blocked home radio opens its settings row with the reason instead of doing nothing", async ({ page }) => {
  await seed(page, { "vic.companionRadio.v1": JSON.stringify({ enabled: false, volume: 35, react: true, excludedIds: [] }) });
  await page.goto("/visual-fixture/poster");
  const button = page.locator(".vc-radio-button");
  await expect(button).toBeVisible();
  await button.click();
  const book = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  const radio = book.locator(".rhh-companion-radio");
  await expect(radio).toBeVisible();
  await expect(radio.locator(".rhh-radio-now p")).toHaveText("라디오가 꺼져 있어요");
  await expect(radio).toHaveAttribute("data-flash", "");
  // The switch that is in the way is right there and took focus.
  await expect(radio.getByRole("switch", { name: "빅타민 라디오 켜기/끄기", exact: true })).toBeFocused();
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem("vic.companionRadio.v1")))!).enabled).toBe(false);
});

test("the companion's own sound off does not block the radio: the home button plays (redesign 2-라)", async ({ page }) => {
  await seed(page, {}, { sound: false });
  await page.goto("/visual-fixture/poster");
  const button = page.locator(".vc-radio-button");
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-label", "라디오 켜기");
  await button.click();
  await expect(button).toHaveAttribute("aria-label", "라디오 끄기", { timeout: 15000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // The self-start row says why the companion will not start it by itself, and where that is set.
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "설정", exact: true }).click();
  const radio = dialog.locator(".rhh-companion-radio");
  await expect(radio).toContainText("빅타민 소리가 '끔'이라 스스로 라디오를 틀지 않아요");
  await expect(radio.getByRole("button", { name: "정지", exact: true })).toBeEnabled();
  await radio.getByRole("button", { name: "정지", exact: true }).click();
  await expect(button).toHaveAttribute("aria-label", "라디오 켜기");
});

test("from the book, a site reason leaves the book for the full settings", async ({ page }) => {
  await seed(page, { "vic.sound": "off" });
  await page.goto("/visual-fixture/poster");
  await page.locator(".vc-radio-button").click();
  const book = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await book.locator(".rhh-companion-radio").getByRole("button", { name: "소리 설정으로", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "설정", exact: true });
  const site = dialog.getByRole("switch", { name: "효과음 켜기/끄기", exact: true });
  await expect(site).toBeVisible(); await expect(site).toBeFocused(); await expect(site).not.toBeChecked();
  // The book's radio request ended with the book: from the full settings the companion tab opens on its settings page, and nothing is marked again.
  await dialog.getByRole("tab", { name: "빅타민", exact: true }).click();
  await expect(dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "설정", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.locator(".rhh-companion-radio")).not.toHaveAttribute("data-flash", "");
});

test("companion resting: one note, rows dimmed and still editable", async ({ page }) => {
  await seed(page, {}, { enabled: false });
  await page.goto("/visual-fixture/poster");
  const dialog = await companionSettings(page, "움직임");
  await expect(dialog.locator(".rhh-note-resting")).toHaveText("빅타민이 쉬는 중이라 아래 설정은 켜면 적용돼요");
  const roam = dialog.getByRole("switch", { name: "빅타민 돌아다니기 켜기/끄기", exact: true });
  await roam.click(); await expect(roam).not.toBeChecked();
  expect(JSON.parse((await saved(page)).companion!)).toMatchObject({ enabled: false, roam: false });
});

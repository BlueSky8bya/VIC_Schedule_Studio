import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEFAULT_COMPANION_PREFERENCES, type CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { companionMotionGroup, companionMotionRadio, companionPlayfulSwitch, expectCompanionMotion, setCompanionMotion } from "./helpers/companion-settings";

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
const savedCompanion = async (page: Page) => JSON.parse((await saved(page)).companion!) as Partial<CompanionPreferences>;
// Stage 4 rows: one movement choice (the place other rows lead back to) and one prank switch.
const motionRow = (dialog: Locator) => dialog.locator('[data-settings-place="companion-roam"]');
// `has` is looked up inside each row, so the inner locator starts from the page, not from the dialog.
const playfulRow = (dialog: Locator) => dialog.locator(".role-help-haptics").filter({ has: companionPlayfulSwitch(dialog.page()) });
const panelRow = (dialog: Locator) => dialog.locator(".role-help-haptics").filter({ has: dialog.page().getByRole("switch", { name: "빅타민 패널 자리 옮기기 켜기/끄기", exact: true }) });
const cardNote = (dialog: Locator, text: string) => dialog.locator(".rhh-companion-cards .rhh-note").filter({ hasText: text });

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
  // Stage 4: the four pranks are one switch, so the reason is said once under it.
  const notes = dialog.locator(".rhh-companion-cards .rhh-note").filter({ hasText: "장난을 치지 않아요" });
  await expect(notes).toHaveCount(1);
  await expect(notes).toContainText("사이트의 '생동감 있는 동작'이 꺼져 있어 장난을 치지 않아요");
  await expect(dialog.locator(".rhh-companion-cards .rhh-note").filter({ hasText: "사이트의 '생동감 있는 동작'이 꺼져 있어 걷거나 뛰지 않아요" })).toHaveCount(1);
  await expect(dialog.locator(".rhh-companion-cards .rhh-note").filter({ hasText: "사이트의 '생동감 있는 동작'이 꺼져 있어 패널을 옮기지 않아요" })).toHaveCount(1);
  // Stopped rows are dimmed, not disabled: the value still changes.
  const playful = companionPlayfulSwitch(dialog);
  await expect(playfulRow(dialog)).toHaveClass(/is-blocked/); await expect(motionRow(dialog)).toHaveClass(/is-blocked/);
  await expect(playful).toBeChecked(); await expect(playful).toBeEnabled();
  await playful.click(); await expect(playful).not.toBeChecked(); await playful.click(); await expect(playful).toBeChecked();
  await setCompanionMotion(dialog, "walk"); await setCompanionMotion(dialog, "run");
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
  await expect(motionRow(dialog)).toHaveClass(/is-blocked/); await expect(playfulRow(dialog)).toHaveClass(/is-blocked/);
  await expectCompanionMotion(dialog, "run");
  await setCompanionMotion(dialog, "still");
  expect(await savedCompanion(page)).toMatchObject({ enabled: false, roam: false });
  // Resting is said once at the top; the rows under it add no reason of their own.
  await expect(cardNote(dialog, "움직임이 '가만히'라")).toHaveCount(0);
});

test("movement is one choice of three written to the existing roam and jump fields", async ({ page }) => {
  await seed(page, {});
  await page.goto("/visual-fixture/poster");
  const dialog = await companionSettings(page, "움직임");
  await expect(companionMotionGroup(dialog).getByRole("radio")).toHaveText(["가만히", "걷기만", "뛰어다니기"]);
  await expect(dialog.locator('[data-act="companion-roam"],[data-act="companion-jump"]')).toHaveCount(0);
  await expectCompanionMotion(dialog, "run");
  await setCompanionMotion(dialog, "walk");
  expect(await savedCompanion(page)).toMatchObject({ roam: true, jump: false });
  // 가만히 writes only roam: the earlier jump choice is kept for an older screen.
  await setCompanionMotion(dialog, "still");
  expect(await savedCompanion(page)).toMatchObject({ roam: false, jump: false });
  await setCompanionMotion(dialog, "run");
  expect(await savedCompanion(page)).toMatchObject({ roam: true, jump: true });
  await setCompanionMotion(dialog, "still");
  expect(await savedCompanion(page)).toMatchObject({ roam: false, jump: true });
  // A jump left on under 가만히 still reads as 가만히, and no new field is stored.
  await expect(companionMotionRadio(dialog, "run")).toHaveAttribute("aria-checked", "false");
  expect(Object.keys(await savedCompanion(page)).filter(key => /^(motion|playful)|level/i.test(key))).toEqual([]);
});

test("장난치기 writes the four prank fields at once and leaves the panel row alone", async ({ page }) => {
  await seed(page, {});
  await page.goto("/visual-fixture/poster");
  const dialog = await companionSettings(page, "장난");
  await expect(dialog.locator('[data-act="companion-heart-prank"],[data-act="companion-card-prank"],[data-act="companion-hide"],[data-act="companion-rare-prank"]')).toHaveCount(0);
  const playful = companionPlayfulSwitch(dialog), panel = dialog.getByRole("switch", { name: "빅타민 패널 자리 옮기기 켜기/끄기", exact: true });
  await expect(playful).toHaveAttribute("data-act", "companion-playful");
  await expect(panel).toHaveAttribute("data-act", "companion-panel-prank");
  await expect(playful).toBeChecked(); await expect(panel).toBeChecked();
  await expect(playfulRow(dialog)).not.toHaveClass(/is-blocked/);
  await playful.click(); await expect(playful).not.toBeChecked();
  expect(await savedCompanion(page)).toMatchObject({ heartPrank: false, cardPrank: false, ambientPrank: false, rarePrank: false, panelPrank: true });
  await expect(panel).toBeChecked();
  // The panel row is its own choice in both directions.
  await panel.click(); await expect(panel).not.toBeChecked();
  expect(await savedCompanion(page)).toMatchObject({ heartPrank: false, cardPrank: false, ambientPrank: false, rarePrank: false, panelPrank: false });
  await playful.click(); await expect(playful).toBeChecked();
  expect(await savedCompanion(page)).toMatchObject({ heartPrank: true, cardPrank: true, ambientPrank: true, rarePrank: true, panelPrank: false });
  await expect(panel).not.toBeChecked();
});

test("가만히: 장난치기 is dimmed, says why, and its link shows the movement row without changing it", async ({ page }) => {
  await seed(page, { "vic.gfxPref": "max" }, { roam: false });
  await page.goto("/visual-fixture/poster");
  const dialog = await companionSettings(page, "장난");
  await expectCompanionMotion(dialog, "still");
  await expect(motionRow(dialog)).not.toHaveClass(/is-blocked/);
  await expect(playfulRow(dialog)).toHaveClass(/is-blocked/);
  await expect(panelRow(dialog)).toHaveClass(/is-blocked/);
  const note = cardNote(dialog, "움직임이 '가만히'라 장난을 치지 않아요");
  await expect(note).toHaveCount(1);
  await expect(cardNote(dialog, "움직임이 '가만히'라 패널을 옮기지 않아요")).toHaveCount(1);
  await expect(dialog.locator(".rhh-companion-radio")).toContainText("움직임이 '가만히'라 스스로 라디오를 틀지 않아요");
  // Dimmed, not disabled: the value still changes and is kept for later.
  const playful = companionPlayfulSwitch(dialog);
  await expect(playful).toBeChecked(); await expect(playful).toBeEnabled();
  await playful.click(); await expect(playful).not.toBeChecked(); await playful.click(); await expect(playful).toBeChecked();
  const before = await saved(page);
  await expect(motionRow(dialog)).not.toHaveAttribute("data-flash", "");
  await note.getByRole("button", { name: "움직임으로", exact: true }).click();
  await expect(motionRow(dialog)).toHaveAttribute("data-flash", "");
  await expect(motionRow(dialog)).toBeInViewport();
  await expect(companionMotionRadio(dialog, "still")).toBeFocused();
  await expectCompanionMotion(dialog, "still");
  expect(await saved(page)).toEqual(before);
  // Moving again lifts the reason from every row it stopped.
  await setCompanionMotion(dialog, "walk");
  await expect(cardNote(dialog, "움직임이 '가만히'라")).toHaveCount(0);
  await expect(playfulRow(dialog)).not.toHaveClass(/is-blocked/);
  await expect(panelRow(dialog)).not.toHaveClass(/is-blocked/);
});

test("background effect off: 장난치기 says what rests but is not dimmed; the panel row is", async ({ page }) => {
  await seed(page, { "vic.gfxPref": "off" });
  await page.goto("/visual-fixture/poster");
  await expect(page.locator("html")).toHaveAttribute("data-gfx", "off");
  const dialog = await companionSettings(page, "장난");
  const note = cardNote(dialog, "배경 효과가 꺼져 있어 소품 묘기와 일정 기울이기를 쉬어요");
  await expect(note).toHaveCount(1);
  await expect(note.getByRole("button", { name: "배경 설정으로", exact: true })).toBeVisible();
  await expect(playfulRow(dialog)).not.toHaveClass(/is-blocked/);
  await expect(motionRow(dialog)).not.toHaveClass(/is-blocked/);
  await expect(cardNote(dialog, "배경 효과가 꺼져 있어 패널을 옮기지 않아요")).toHaveCount(1);
  await expect(panelRow(dialog)).toHaveClass(/is-blocked/);
});

test("a legacy prank mix reads as 장난치기 off and is stored untouched until the switch is used", async ({ page }) => {
  await seed(page, {}, { heartPrank: false });
  await page.goto("/visual-fixture/poster");
  const dialog = await companionSettings(page, "장난");
  const playful = companionPlayfulSwitch(dialog);
  await expect(playful).not.toBeChecked();
  const mix = { heartPrank: false, cardPrank: true, ambientPrank: true, rarePrank: true, panelPrank: true };
  expect(await savedCompanion(page)).toMatchObject(mix);
  // Another row on the page does not rewrite the mix.
  await setCompanionMotion(dialog, "walk");
  expect(await savedCompanion(page)).toMatchObject({ ...mix, roam: true, jump: false });
  await expect(playful).not.toBeChecked();
  await playful.click(); await expect(playful).toBeChecked();
  expect(await savedCompanion(page)).toMatchObject({ heartPrank: true, cardPrank: true, ambientPrank: true, rarePrank: true, panelPrank: true });
  await playful.click(); await expect(playful).not.toBeChecked();
  expect(await savedCompanion(page)).toMatchObject({ heartPrank: false, cardPrank: false, ambientPrank: false, rarePrank: false, panelPrank: true });
});

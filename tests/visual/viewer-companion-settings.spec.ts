import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectQuietCompanionVisible } from "./helpers/companion-overlay";

// Settings redesign stage 3: the companion block has four pages under one shared
// power header. The settings gear opens on "설정", a single page of cards with no
// sub-tabs; look, character and learning live on "함께 지내기".
async function openCompanionSettings(page: Page) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const tab = page.getByRole("tab", { name: "빅타민", exact: true });
  if (await tab.isVisible()) await tab.click();
  return page.locator("#rhh-tab-companion-panel");
}
const pages = (panel: Locator) => panel.getByRole("tablist", { name: "빅타민 프로필", exact: true });

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.request().method() === "POST" ? route.fulfill({ status: 204 }) : route.continue());
  await page.route("**/api/soop-live**", route => route.fulfill({ json: { live: false } }));
});

test("dedicated companion settings preserve detailed choices across master OFF and reload", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("vic.viewerCompanion")) localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: false }));
  });
  await page.goto("/visual-fixture/poster");
  let panel = await openCompanionSettings(page);
  // From the gear, the settings page is the one that opens.
  await expect(pages(panel).getByRole("tab", { name: "설정", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(pages(panel).getByRole("tab")).toHaveText(["함께 지내기", "도감", "옷장", "설정"]);
  await expect(panel.getByRole("tablist", { name: "빅타민 설정", exact: true })).toHaveCount(0);
  const master = panel.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true });
  await expect(master).not.toBeChecked();
  await panel.getByRole("switch", { name: "빅타민 깡충 뛰기 켜기/끄기", exact: true }).click();
  await panel.getByRole("switch", { name: "빅타민 하트 콩 켜기/끄기", exact: true }).click();
  // Rarely changed rows are folded away until asked for.
  const more = panel.locator(".rhh-companion-more");
  await expect(panel.getByRole("radio", { name: "느긋하게", exact: true })).toBeHidden();
  await more.locator("summary").click();
  await panel.getByRole("radio", { name: "느긋하게", exact: true }).click();
  await panel.getByRole("switch", { name: "빅타민 밥주기 켜기/끄기", exact: true }).click();
  // Look and character are on "함께 지내기"; the power header stays above every page.
  await pages(panel).getByRole("tab", { name: "함께 지내기", exact: true }).click();
  await expect(master).toBeVisible();
  const animalMode = panel.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true });
  await expect(animalMode.getByRole("radio", { name: "빅타민", exact: true })).toBeChecked();
  await animalMode.getByRole("radio", { name: "고양이", exact: true }).click();
  await animalMode.getByRole("radio", { name: "강아지", exact: true }).click();
  await expect(animalMode.getByRole("radio", { name: "고양이", exact: true })).not.toBeChecked();
  await expect(animalMode.getByRole("radio", { name: "강아지", exact: true })).toBeChecked();
  await master.click();
  await expect(master).toBeChecked();
  await expectQuietCompanionVisible(page);
  await expect(master).toBeFocused();
  await master.click();
  await expect(master).not.toBeChecked();
  await page.reload();
  panel = await openCompanionSettings(page);
  await expect(panel.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true })).not.toBeChecked();
  await expect(panel.getByRole("switch", { name: "빅타민 깡충 뛰기 켜기/끄기", exact: true })).not.toBeChecked();
  await expect(panel.getByRole("switch", { name: "빅타민 하트 콩 켜기/끄기", exact: true })).not.toBeChecked();
  // The fold is not remembered: it starts closed again, with the choices inside kept.
  await expect(panel.getByRole("radio", { name: "느긋하게", exact: true })).toBeHidden();
  await panel.locator(".rhh-companion-more summary").click();
  await expect(panel.getByRole("radio", { name: "느긋하게", exact: true })).toBeChecked();
  await expect(panel.getByRole("switch", { name: "빅타민 밥주기 켜기/끄기", exact: true })).not.toBeChecked();
  await pages(panel).getByRole("tab", { name: "함께 지내기", exact: true }).click();
  await expect(panel.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true }).getByRole("radio", { name: "강아지", exact: true })).toBeChecked();
});

test("the four pages share one keyboard stop and the power header, and nothing new is stored", async ({ page }) => {
  await page.goto("/visual-fixture/poster");
  const panel = await openCompanionSettings(page);
  const monthBefore = await page.locator(".public-calendar-header h1").textContent();
  const tab = (name: string) => pages(panel).getByRole("tab", { name, exact: true });
  await tab("설정").focus();
  await page.keyboard.press("Home");
  await expect(tab("함께 지내기")).toBeFocused(); await expect(tab("함께 지내기")).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(tab("설정")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tab("함께 지내기")).toBeFocused();
  await page.keyboard.press("End");
  await expect(tab("설정")).toBeFocused();
  await expect(pages(panel).locator('[tabindex="0"]')).toHaveCount(1);
  for (const name of ["함께 지내기", "도감", "옷장", "설정"]) {
    await tab(name).click();
    await expect(panel.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true })).toBeVisible();
  }
  // Opening folds and walking the pages writes no preference and keeps the record's shape.
  await panel.locator(".rhh-companion-more summary").click();
  await panel.locator(".rhh-sound-auditions summary").click();
  const stored = await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("vic.")).sort());
  expect(stored.filter(key => /more|fold|open/i.test(key))).toEqual([]);
  await expect(page.locator(".public-calendar-header h1")).toHaveText(monthBefore!);
});

test("the character can be returned to the random draw without touching other choices", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("fixture.random")) { localStorage.setItem("fixture.random", "1"); localStorage.setItem("vic.viewerCompanion", JSON.stringify({ version: 1, enabled: false, roam: false, soundVolume: 25 })); }
  });
  await page.goto("/visual-fixture/poster");
  const panel = await openCompanionSettings(page);
  await pages(panel).getByRole("tab", { name: "함께 지내기", exact: true }).click();
  const random = panel.getByRole("button", { name: "무작위로 되돌리기", exact: true });
  await expect(random).toBeDisabled();
  await panel.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).getByRole("radio", { name: "깔끔이", exact: true }).click();
  await expect(random).toBeEnabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!))).toMatchObject({ personality: "tidy", personalitySource: "manual", roam: false, soundVolume: 25 });
  await random.click();
  await expect(random).toBeDisabled();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("vic.viewerCompanion")!));
  expect(after).toMatchObject({ version: 1, enabled: false, personality: "tidy", roam: false, soundVolume: 25 });
  expect(after.personalitySource).toBeUndefined();
});

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.

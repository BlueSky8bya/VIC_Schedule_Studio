import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectQuietCompanionVisible } from "./helpers/companion-overlay";

async function openCompanionSettings(page: Page) {
  await page.getByRole("button", { name: "설정", exact: true }).click();
  const tab = page.getByRole("tab", { name: "빅타민", exact: true });
  if (await tab.isVisible()) await tab.click();
  const panel = page.locator("#rhh-tab-companion-panel");
  // The companion tab opens on "함께 지내기"; the switches live on the 환경설정 page,
  // whose own sub-tabs are 기본 · 움직임 · 장난 · 교감 · 소리 (기본 first).
  await panel.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  return panel;
}
const subtabs = (panel: Locator) => panel.getByRole("tablist", { name: "빅타민 설정", exact: true });
// The profile wrapper shares the settings class name, so scope to the siblings of the sub-tab list.
const openSubpanels = (panel: Locator) => panel.locator('.rhh-companion-nav ~ [role="tabpanel"]:not([hidden])');

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
  const master = panel.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true });
  await expect(master).not.toBeChecked();
  await expect(subtabs(panel).getByRole("tab")).toHaveCount(5);
  await subtabs(panel).getByRole("tab", { name: "움직임", exact: true }).click();
  await panel.getByRole("switch", { name: "빅타민 깡충 뛰기 켜기/끄기", exact: true }).click();
  await panel.getByRole("radio", { name: "느긋하게", exact: true }).click();
  await panel.getByRole("tab", { name: "장난", exact: true }).click();
  await panel.getByRole("switch", { name: "빅타민 하트 콩 켜기/끄기", exact: true }).click();
  await panel.getByRole("tab", { name: "기본", exact: true }).click();
  const animalMode = panel.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true });
  await expect(animalMode.getByRole("radio", { name: "빅타민", exact: true })).toBeChecked();
  await animalMode.getByRole("radio", { name: "고양이", exact: true }).click();
  await animalMode.getByRole("radio", { name: "강아지", exact: true }).click();
  await expect(animalMode.getByRole("radio", { name: "고양이", exact: true })).not.toBeChecked();
  await expect(animalMode.getByRole("radio", { name: "강아지", exact: true })).toBeChecked();
  await panel.getByRole("tab", { name: "교감", exact: true }).click();
  await panel.getByRole("switch", { name: "빅타민 밥주기 켜기/끄기", exact: true }).click();
  await master.click();
  await expect(master).toBeChecked();
  await expectQuietCompanionVisible(page);
  await expect(master).toBeFocused();
  await master.click();
  await expect(master).not.toBeChecked();
  await page.reload();
  panel = await openCompanionSettings(page);
  await expect(panel.getByRole("switch", { name: "AI 빅타민 켜기/끄기", exact: true })).not.toBeChecked();
  await subtabs(panel).getByRole("tab", { name: "움직임", exact: true }).click();
  await expect(panel.getByRole("switch", { name: "빅타민 깡충 뛰기 켜기/끄기", exact: true })).not.toBeChecked();
  await expect(panel.getByRole("radio", { name: "느긋하게", exact: true })).toBeChecked();
  await panel.getByRole("tab", { name: "장난", exact: true }).click();
  await expect(panel.getByRole("switch", { name: "빅타민 하트 콩 켜기/끄기", exact: true })).not.toBeChecked();
  await panel.getByRole("tab", { name: "기본", exact: true }).click();
  await expect(panel.getByRole("radiogroup", { name: "빅타민 동물 모드", exact: true }).getByRole("radio", { name: "강아지", exact: true })).toBeChecked();
  await panel.getByRole("tab", { name: "교감", exact: true }).click();
  await expect(panel.getByRole("switch", { name: "빅타민 밥주기 켜기/끄기", exact: true })).not.toBeChecked();
});

test("companion subtabs support arrows, Home and End with one keyboard stop", async ({ page }) => {
  await page.goto("/visual-fixture/poster");
  const panel = await openCompanionSettings(page);
  const monthBefore = await page.locator(".public-calendar-header h1").textContent();
  const tab = (name: string) => subtabs(panel).getByRole("tab", { name, exact: true });
  const first = tab("기본"), last = tab("소리");
  await expect(first).toHaveAttribute("aria-selected", "true");
  await first.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tab("움직임")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(tab("장난")).toBeFocused();
  await page.keyboard.press("End");
  await expect(last).toBeFocused();
  await expect(last).toHaveAttribute("aria-selected", "true");
  await expect(openSubpanels(panel)).toHaveCount(1);
  await page.keyboard.press("ArrowRight");
  await expect(first).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Home");
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(last).toBeFocused();
  await page.keyboard.press("Home");
  await expect(first).toBeFocused();
  await expect(subtabs(panel).locator('[tabindex="0"]')).toHaveCount(1);
  await expect(page.locator(".public-calendar-header h1")).toHaveText(monthBefore!);
});

// PLAN-063: mobile companion positives are retired; mobile-companion-disabled.spec.ts covers absence and preference restoration.

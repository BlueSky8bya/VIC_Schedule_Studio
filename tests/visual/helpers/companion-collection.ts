import { expect, type Locator, type Page } from "@playwright/test";

/** Use the shipping roving keyboard path so a target may cross finite pages.
 * No scrollIntoView, DOM state changes or collection/runtime hooks. */
export async function selectCompanionCollectionIndex(page: Page, list: Locator, index: number) {
  await list.locator("button[tabindex='0']").focus();
  await page.keyboard.press("Home");
  for (let next = 0; next < index; next++) await page.keyboard.press("ArrowRight");
  await expect(list.locator("button[tabindex='0']")).toBeFocused();
}

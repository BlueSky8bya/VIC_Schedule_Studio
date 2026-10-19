import { expect, type Locator, type Page } from "@playwright/test";

/** Page navigation never inspects neighbours. Only the requested tile's real
 * click is an inspection; no scroll/state/runtime hooks or hidden ACKs. */
export async function selectCompanionCollectionIndex(page: Page, list: Locator, index: number) {
  const rail = list.locator("..").getByRole("slider"), tile = list.locator(`[data-collection-index="${index}"]`);
  if (await rail.isEnabled()) {
    await rail.focus(); await page.keyboard.press("Home"); await expect(rail).toHaveValue("1");
    for (let attempts = 0; !await tile.count(); attempts++) {
      const current = Number(await rail.inputValue()), maximum = Number(await rail.getAttribute("max"));
      expect(attempts).toBeLessThan(maximum); expect(current).toBeLessThan(maximum);
      await rail.press("PageDown"); await expect(rail).toHaveValue(String(current + 1));
    }
  }
  await tile.click(); await expect(tile).toBeFocused();
}

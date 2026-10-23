import { expect, type Page } from "@playwright/test";

/** Real placement input, followed by the existing gravity/support observer.
 * No product position/controller/RNG or clock is patched for meadow admission. */
export async function placeCompanionOnExposedBackground(page: Page, x = 90) {
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  const pet = page.locator(".vc-companion");
  await expect(actor).toBeVisible();
  await actor.focus(); await actor.press("p"); await expect(pet).toHaveAttribute("data-placing", "");
  await page.mouse.click(x, page.viewportSize()!.height - 100); await page.mouse.move(2, 2);
  await expect(pet).not.toHaveAttribute("data-placing");
  await expect(pet).toHaveAttribute("data-platform", /^viewport-floor(?:-\d+)?$/, { timeout: 7000 });
  return pet;
}

export async function enterCompanionMeadow(page: Page) {
  await page.waitForFunction(() => Boolean(window.__vicAmbient));
  const section = page.locator('[data-panel-section-toggle="season"]:visible').first();
  if (!await section.count()) {
    const expand = page.getByRole("button", { name: "패널 펼치기", exact: true });
    if (await expand.isVisible()) { await expand.focus(); await expand.press("Enter"); }
  }
  if (await section.getAttribute("aria-expanded") === "false") await section.click();
  const trigger = page.locator('[data-act="ambient-showcase"]:visible').first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  return trigger;
}

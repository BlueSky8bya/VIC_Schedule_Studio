import { expect, type Page } from "@playwright/test";

type HomeInput = "pointer" | "touch" | "keyboard";
type CareAction = "쓰다듬기" | "옮길 곳 고르기" | "여기서 낮잠" | "남은 밥 치우기";
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });

export async function openCompanionHome(page: Page, input: HomeInput = "pointer") {
  if (!await home(page).isVisible()) {
    const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
    if (input === "keyboard") { await launcher.focus(); await launcher.press("Enter"); }
    else if (input === "touch") await launcher.tap();
    else await launcher.click();
  }
  await expect(home(page)).toBeVisible();
  await expect(home(page)).toHaveCount(1);
  return home(page);
}

/** Use the same real care menu everywhere. Cushion and fruit remain their
 * direct room controls; no DOM dispatch, fake clock or product debug hook. */
export async function chooseCompanionCare(page: Page, action: CareAction, input: HomeInput = "pointer") {
  await expect(home(page)).toBeVisible();
  const trigger = home(page).getByRole("button", { name: "빅타민 돌보기", exact: true });
  const menu = home(page).getByRole("menu", { name: "빅타민 돌보기", exact: true });
  const wasOpen = await trigger.getAttribute("aria-expanded") === "true";
  if (!wasOpen) {
    if (input === "keyboard") { await trigger.focus(); await trigger.press("ArrowDown"); }
    else if (input === "touch") await trigger.tap();
    else await trigger.click();
  }
  await expect(menu).toBeVisible();
  const item = menu.getByRole("menuitem", { name: action, exact: true });
  if (input === "keyboard") {
    const items = menu.getByRole("menuitem");
    if (!wasOpen) await expect(items.first()).toBeFocused();
    else await expect.poll(() => menu.evaluate(node => node.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Home");
    const index = await items.evaluateAll((nodes, label) => nodes.findIndex(node => node.textContent?.trim() === label), action);
    expect(index).toBeGreaterThanOrEqual(0);
    for (let step = 0; step < index; step++) await page.keyboard.press("ArrowDown");
    await expect(item).toBeFocused(); await page.keyboard.press("Enter");
  } else if (input === "touch") await item.tap();
  else await item.click();
  await expect(page.getByRole("menu", { name: "빅타민 돌보기", exact: true })).toHaveCount(0);
}

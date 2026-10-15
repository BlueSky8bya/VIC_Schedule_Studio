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

/** Preserve the callers' care intent through the public direct interactions.
 * No removed menu, DOM dispatch, fake clock or product debug hook. */
export async function chooseCompanionCare(page: Page, action: CareAction, input: HomeInput = "pointer") {
  const actor = page.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  await expect(actor).toBeVisible();
  if (action === "남은 밥 치우기") {
    await openCompanionHome(page, input);
    const bin = home(page).getByRole("button", { name: "음식 버리기", exact: true });
    if (input === "keyboard") { await bin.focus(); await bin.press("Enter"); }
    else if (input === "touch") await bin.tap();
    else await bin.click();
  } else if (action === "쓰다듬기") {
    if (input === "keyboard") { await actor.focus(); await actor.press("Enter"); }
    else if (input === "touch") await actor.tap();
    else await actor.click();
  } else if (action === "옮길 곳 고르기" && input !== "keyboard") {
    if (input === "touch") { await actor.tap(); await actor.tap(); }
    else await actor.dblclick();
    await expect(page.locator(".vc-companion")).toHaveAttribute("data-placing", "");
  } else {
    await actor.focus(); await actor.press(action === "옮길 곳 고르기" ? "p" : "n");
  }
  await expect(page.getByRole("menu", { name: "빅타민 돌보기", exact: true })).toHaveCount(0);
}

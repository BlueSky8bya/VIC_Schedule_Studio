import { expect, type Page } from "@playwright/test";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";

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

/** Sofa/meal tests need a nearby real resident, not a random calendar start.
 * Use the same native placement and measured room-floor point as the contact
 * suite. The long, distance-dependent recall remains covered separately by
 * companion-committed-home.spec.ts; no product state or clock is supplied. */
export async function placeCompanionOnHomeFloor(page: Page) {
  const room = home(page), pet = page.locator(".vc-companion");
  const actor = pet.getByRole("button", { name: "빅타민 · 쓰다듬고 옮기기", exact: true });
  await expect(room).toBeVisible(); await expect(actor).toBeVisible();
  const identity = (await pet.elementHandle())!;
  const bed = (await room.locator(".vc-plush-bed").boundingBox())!, floor = (await room.locator(".vc-home-floor").boundingBox())!;
  const point = { x: bed.x + bed.width / 2, y: floor.y + floor.height - COMPANION_HOME_FLOOR_INSET - 8 };
  await actor.focus(); await actor.press("p"); await expect(pet).toHaveAttribute("data-placing", "");
  await page.mouse.click(point.x, point.y); await page.mouse.move(2, 2);
  await expect(pet).toHaveAttribute("data-platform", /^companion-home-floor(?:-\d+)?$/);
  await expect(pet).not.toHaveAttribute("data-state", "jump");
  await expect.poll(async () => {
    const feet = await pet.evaluate(node => node.getBoundingClientRect().bottom);
    const actualFloor = (await room.locator(".vc-home-floor").boundingBox())!;
    return Math.abs(feet - (actualFloor.y + actualFloor.height - COMPANION_HOME_FLOOR_INSET));
  }).toBeLessThan(2);
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
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
  } else {
    // Placement is an explicit keyboard alternative; pointer input uses drag.
    await actor.focus(); await actor.press(action === "옮길 곳 고르기" ? "p" : "n");
  }
  await expect(page.getByRole("menu", { name: "빅타민 돌보기", exact: true })).toHaveCount(0);
}

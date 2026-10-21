import { expect, type Page } from "@playwright/test";
import { COMPANION_HOME_FLOOR_INSET } from "@/lib/ui/viewer-companion/food";
import { COMPANION_PERSONALITY_NAMES, type CompanionPersonality } from "@/lib/ui/viewer-companion/preferences";
import { companionFloorPlacementSamplePasses157, type CompanionFloorPlacementSample157 } from "./companion-floor-placement-157";

type HomeInput = "pointer" | "touch" | "keyboard";
type CareAction = "쓰다듬기" | "옮길 곳 고르기" | "여기서 낮잠" | "남은 밥 치우기";
const home = (page: Page) => page.getByRole("region", { name: "빅타민 집", exact: true });

export async function openCompanionHome(page: Page, input: HomeInput = "pointer") {
  const launcher = page.getByRole("button", { name: "빅타민 집 열기", exact: true });
  await expect.poll(async () => await home(page).isVisible() || await launcher.isVisible()).toBe(true);
  if (!await home(page).isVisible()) {
    if (input === "keyboard") { await launcher.focus(); await launcher.press("Enter"); }
    else if (input === "touch") await launcher.tap();
    else await launcher.click();
  }
  await expect(home(page)).toBeVisible();
  await expect(home(page)).toHaveCount(1);
  return home(page);
}

/** A full document now chooses its own personality. Scenario setup uses the
 * real radio, preserving that product rule instead of seeding its selection. */
export async function chooseCompanionPersonality(page: Page, personality: CompanionPersonality) {
  const room = await openCompanionHome(page);
  await room.getByRole("button", { name: "빅타민 수첩 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "빅타민 수첩", exact: true });
  await dialog.getByRole("tablist", { name: "빅타민 프로필", exact: true }).getByRole("tab", { name: "환경설정", exact: true }).click();
  const option = dialog.getByRole("radiogroup", { name: "빅타민 성격", exact: true }).getByRole("radio", { name: COMPANION_PERSONALITY_NAMES[personality], exact: true });
  await option.click(); await expect(option).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(dialog).toBeHidden(); await page.mouse.move(2, 2);
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
  // Read every original condition in one browser frame. Separate retry
  // loops can miss a short floor stop and borrow idle from a later sofa trip.
  const floorNode = (await room.locator(".vc-home-floor").elementHandle())!;
  const observations: CompanionFloorPlacementSample157[] = [];
  try {
    await expect.poll(async () => {
      const sample = await page.evaluate(({ expected, floor, inset }) => {
        const node = document.querySelector(".vc-companion"), body = node?.getBoundingClientRect(), plane = floor.getBoundingClientRect();
        const platform = node?.getAttribute("data-platform") ?? "", state = node?.getAttribute("data-state") ?? "";
        const feet = body?.bottom ?? NaN, floorFeet = plane.bottom-inset;
        return { at: performance.now(), sameActor: expected.isConnected && floor.isConnected && node === expected,
          placingReleased: Boolean(node && !node.hasAttribute("data-placing")), platform, floorPlatform: /^companion-home-floor(?:-\d+)?$/.test(platform),
          state, notJump: Boolean(node && state !== "jump"), feet, floorFeet, feetError: Math.abs(feet-floorFeet) };
      }, { expected: identity, floor: floorNode, inset: COMPANION_HOME_FLOOR_INSET });
      observations.push(sample);
      return companionFloorPlacementSamplePasses157(sample);
    }, { timeout: 5000, intervals: [35] }).toBe(true);
  } finally { await floorNode.dispose(); }
  expect(await identity.evaluate(node => node.isConnected && node === document.querySelector(".vc-companion"))).toBe(true);
  return { point, observations };
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
